/* Local scientific engine transport. No research data enters fetch/network. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = {createEngine: factory};
  else {
    const script = document.currentScript;
    root.StudioBrowserEngine = factory({workerURL: new URL('engine-worker.js', script.src).href});
  }
})(globalThis, function createEngine(options) {
  'use strict';
  options = options || {};
  const origin = options.origin || globalThis.location.origin;
  const workerURL = options.workerURL || new URL('engine-worker.js', globalThis.location.href).href;
  const makeWorker = options.workerFactory || (url => new Worker(url));
  const listeners = new Set(), jobs = new Map(), queue = [];
  const MAX_WAITING = 2, JOB_TTL = 900000;
  const endpoints = new Set(['/api/analyze', '/api/render', '/api/reflow', '/api/split-facets', '/api/image-duplicates', '/api/image-links', '/api/import-pdf']);
  let worker = null, active = null, initialization = null, resolveInit = null, rejectInit = null;
  let phase = 'idle', detail = '', sequence = 0, readyTimer = null, errorDetail = '', lastWarnings = [];
  let operationTimer = null, elapsedTimer = null, initializationStarted = null;
  let lastDurationMs = null, lastTotalDurationMs = null, lastInitializationMs = null;
  const json = (body, status = 200) => new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store'}});
  const failure = (message, status = 422, code) => json({error: message, ...(code ? {code} : {})}, status);
  const status = () => ({mode: 'browser', phase, detail, error: errorDetail, busy: !!active, queued: queue.length, initialized: !!worker && phase !== 'loading' && phase !== 'error', elapsedMs: active ? Date.now() - active.startedAt : 0, lastDurationMs, lastTotalDurationMs, lastInitializationMs, lastWarnings: lastWarnings.map(warning => ({...warning}))});
  function publish(next, message) {
    if (next) phase = next;
    if (message !== undefined) detail = message;
    else if (next) detail = '';
    for (const callback of listeners) { try { callback(status()); } catch (_) {} }
  }
  function finish(task, response) {
    if (task.signal && task.abort) task.signal.removeEventListener('abort', task.abort);
    task.payload = null;
    task.resolve(response);
  }
  function clearOperationTimers() {
    clearTimeout(operationTimer); clearInterval(elapsedTimer);
    operationTimer = elapsedTimer = null;
  }
  function stopWorker(reason = 'Local calculation cancelled / 已取消本地计算') {
    const previous = worker;
    worker = null;
    if (previous) previous.terminate();
    clearTimeout(readyTimer);
    clearOperationTimers();
    const reject = rejectInit;
    initialization = resolveInit = rejectInit = null;
    if (reject) reject(new Error(reason));
  }
  function fatal(message, responseStatus = 503, code = 'browser_engine_unavailable') {
    errorDetail = message;
    stopWorker(message);
    if (active) { const task = active; active = null; finish(task, failure(message, responseStatus, code)); }
    while (queue.length) finish(queue.shift(), failure(message, responseStatus, code));
    publish('error', message);
  }
  function ensureWorker() {
    if (initialization) return initialization;
    if (worker) return Promise.resolve(status());
    errorDetail = '';
    initializationStarted = Date.now();
    initialization = new Promise((resolve, reject) => { resolveInit = resolve; rejectInit = reject; });
    // A cancelled initialization can have only an explicit ready() caller.
    initialization.catch(() => {});
    const waiting = initialization;
    try {
      const current = makeWorker(workerURL);
      worker = current;
      current.onmessage = event => {
        if (worker !== current) return;
        const message = event.data || {};
        if (message.type === 'phase') { publish('loading', message.detail || message.phase || ''); return; }
        if (message.type === 'ready') {
          clearTimeout(readyTimer);
          lastInitializationMs = Date.now() - initializationStarted;
          const resolve = resolveInit;
          initialization = resolveInit = rejectInit = null;
          publish(active ? 'working' : 'ready');
          if (resolve) resolve(status());
          return;
        }
        if (message.type === 'fatal') { fatal(String(message.error || 'Unable to initialize the local engine')); return; }
        if (!active || message.id !== active.id) return;
        if (message.type === 'progress') {
          if (active.jobId && jobs.has(active.jobId)) jobs.get(active.jobId).progress = message.progress;
          return;
        }
        if (message.type === 'result') {
          const task = active;
          active = null;
          clearOperationTimers();
          lastDurationMs = Date.now() - task.dispatchedAt;
          lastTotalDurationMs = Date.now() - task.startedAt;
          lastWarnings = (Array.isArray(message.body?.warnings) ? message.body.warnings : []).slice(0, 4).filter(value => value && typeof value === 'object').map(value => Object.fromEntries(['code', 'en', 'zh', 'requestedFont', 'renderedFont'].filter(key => typeof value[key] === 'string').map(key => [key, value[key].slice(0, 700)])));
          finish(task, json(message.body, message.status || 200));
          publish('ready');
          pump();
        }
      };
      current.onerror = event => { if (worker === current) fatal(event.message || 'Local worker stopped unexpectedly / 本地计算线程意外停止'); };
      current.onmessageerror = () => { if (worker === current) fatal('Local worker message could not be decoded'); };
      readyTimer = setTimeout(() => { if (worker === current && initialization) fatal('Local engine initialization timed out / 本地引擎初始化超时'); }, options.initializationTimeout || 180000);
      publish('loading', 'runtime');
      current.postMessage({type: 'init'});
    } catch (error) { fatal(String(error.message || error)); }
    return waiting;
  }
  function pump() {
    if (active || !queue.length) return;
    const task = queue.shift();
    active = task;
    task.startedAt = Date.now();
    lastWarnings = [];
    elapsedTimer = setInterval(() => { if (active === task) publish(); }, 1000);
    ensureWorker().then(() => {
      if (active !== task || !worker) return;
      publish('working', task.endpoint);
      task.dispatchedAt = Date.now();
      operationTimer = setTimeout(() => {
        if (active === task) fatal('The local calculation exceeded its time limit. The worker has been stopped; reduce the data or retry. / 本地计算超过时间限制，计算线程已停止。请缩小数据规模或重试。', 504, 'operation_timeout');
      }, options.operationTimeout || 180000);
      worker.postMessage({type: 'call', id: task.id, endpoint: task.endpoint, payload: task.payload});
      // The worker now owns a structured-cloned string; release the main-thread copy.
      task.payload = null;
    }).catch(error => {
      if (active === task) fatal(String(error.message || error));
    });
  }
  function cancelTask(task) {
    if (active === task) {
      active = null;
      stopWorker();
      finish(task, failure('Local calculation cancelled / 已取消本地计算', 499, 'cancelled'));
      publish('idle');
      pump();
    } else {
      const index = queue.indexOf(task);
      if (index >= 0) { queue.splice(index, 1); finish(task, failure('Local calculation cancelled / 已取消本地计算', 499, 'cancelled')); publish(); }
    }
  }
  function enqueue(endpoint, payload, signal, jobId) {
    if (signal && signal.aborted) return Promise.resolve(failure('Local calculation cancelled / 已取消本地计算', 499, 'cancelled'));
    if (active && queue.length >= MAX_WAITING) return Promise.resolve(failure('The local engine is busy; wait for the current calculation / 本地引擎繁忙，请稍候', 429, 'queue_full'));
    return new Promise(resolve => {
      const task = {id: ++sequence, endpoint, payload, signal, jobId, resolve};
      if (signal) { task.abort = () => cancelTask(task); signal.addEventListener('abort', task.abort, {once: true}); }
      queue.push(task);
      if (jobId) jobs.get(jobId).task = task;
      pump();
    });
  }
  function cleanJobs() {
    for (const [id, job] of jobs) if (job.status !== 'running' && Date.now() - job.updated >= JOB_TTL) jobs.delete(id);
  }
  function publicJob(job) {
    const result = {status: job.status, progress: job.progress};
    if (job.result) result.result = job.result;
    if (job.error) result.error = job.error;
    return result;
  }
  async function duplicates(payload, signal) {
    cleanJobs();
    const keys = Object.keys(payload).sort().join(',');
    if (payload.action === 'start') {
      if (keys !== 'action,images' || !Array.isArray(payload.images) || payload.images.length < 2 || payload.images.length > 60) return failure('Choose 2–60 raster images / 请选择 2–60 张图片');
      let bytes = 0;
      for (const image of payload.images) {
        if (!image || typeof image !== 'object' || typeof image.id !== 'string' || typeof image.label !== 'string' || typeof image.data !== 'string') return failure('Each image requires id, label and raster data');
        bytes += image.data.length;
      }
      if (bytes > 40000000) return failure('Image check limit: 40 MB encoded / 本批图片超过 40 MB');
      if ([...jobs.values()].some(job => job.status === 'running')) return failure('An image check is already running; cancel it first / 已有查重任务，请先取消');
      if (active && queue.length >= MAX_WAITING) return failure('The local engine queue is full / 本地引擎任务队列已满', 429, 'queue_full');
      if (signal && signal.aborted) return failure('Local calculation cancelled / 已取消本地计算', 499, 'cancelled');
      while (jobs.size > 1) jobs.delete(jobs.keys().next().value);
      const jobId = 'browser-' + (++sequence) + '-' + Date.now().toString(36);
      const job = {status: 'running', progress: {stage: 'preparing', completed: 0, total: payload.images.length}, updated: Date.now()};
      jobs.set(jobId, job);
      enqueue('/api/image-duplicates', JSON.stringify({images: payload.images}), signal, jobId).then(async response => {
        const body = await response.json();
        job.task = null;
        if (job.status === 'cancelled') return;
        if (response.status === 499) job.status = 'cancelled';
        else if (response.ok) { job.status = 'complete'; job.result = body; }
        else { job.status = 'error'; job.error = body.error || 'Image check failed'; }
        job.updated = Date.now();
      });
      return json({jobId});
    }
    if (!['status', 'result', 'cancel'].includes(payload.action) || keys !== 'action,jobId' || typeof payload.jobId !== 'string' || payload.jobId.length > 100) return failure('Expected start, status, result or cancel');
    const job = jobs.get(payload.jobId);
    if (!job) return failure('Image check expired; run it again / 查重记录已过期，请重新检查');
    if (payload.action === 'cancel' && job.status === 'running') {
      job.status = 'cancelled'; job.updated = Date.now();
      if (job.task) cancelTask(job.task);
      job.task = null;
    }
    return json(publicJob(job));
  }
  async function fetchLocal(endpoint, request = {}) {
    let url, payload;
    try { url = new URL(endpoint, origin); } catch (_) { return failure('Unknown local endpoint', 404); }
    if (url.origin !== origin || url.search || url.hash || !endpoints.has(url.pathname)) return failure('Only declared local scientific operations are available', 404);
    if ((request.method || 'GET').toUpperCase() !== 'POST') return failure('POST required', 405);
    if (url.pathname === '/api/import-pdf') return failure('Editable PDF import is unavailable in this browser prototype. Use the desktop editor for editable PDF text, paths and images. / 此浏览器原型暂不支持可编辑 PDF 导入，请使用桌面编辑器提取 PDF 文字、路径和图片。', 501, 'editable_pdf_unavailable');
    if (typeof request.body !== 'string') return failure('A JSON object is required');
    const limit = ['/api/image-duplicates','/api/image-links'].includes(url.pathname) ? 44000000 : 3000000;
    if (request.body.length > limit || new TextEncoder().encode(request.body).length > limit) return failure('Request exceeds the local operation size limit', 413);
    try { payload = JSON.parse(request.body); } catch (_) { return failure('Malformed JSON'); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return failure('Request body must be an object');
    if (url.pathname === '/api/image-duplicates') return duplicates(payload, request.signal);
    return enqueue(url.pathname, request.body, request.signal);
  }
  function dispose() {
    const cancelled = failure('Local engine closed / 本地引擎已关闭', 499, 'cancelled');
    stopWorker();
    if (active) { const task = active; active = null; finish(task, cancelled.clone()); }
    while (queue.length) finish(queue.shift(), cancelled.clone());
    for (const job of jobs.values()) { if (job.status === 'running') { job.status = 'cancelled'; job.updated = Date.now(); } job.task = null; }
    publish('idle');
  }
  return Object.freeze({fetch: fetchLocal, ready: ensureWorker, status, dispose, subscribe(callback) {
    if (typeof callback !== 'function') throw new TypeError('Listener must be a function');
    listeners.add(callback); callback(status()); return () => listeners.delete(callback);
  }});
});
