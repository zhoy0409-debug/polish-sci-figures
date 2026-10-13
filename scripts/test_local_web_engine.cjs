/* Contract/lifecycle tests without a browser or remote services. */
'use strict';
const assert = require('node:assert/strict');
const {createEngine} = require('../web/local-engine.js');
const tick = () => new Promise(resolve => setImmediate(resolve));
const request = body => ({method: 'POST', body: JSON.stringify(body)});
let tests = 0;
function harness(options = {}) {
  const workers = [];
  class Worker {
    constructor() { this.messages = []; this.terminated = false; workers.push(this); }
    postMessage(value) { this.messages.push(value); }
    emit(value) { this.onmessage({data: value}); }
    terminate() { this.terminated = true; }
    ready() { this.emit({type: 'ready'}); }
    result(body = {}, status = 200) { const call = this.messages.findLast(x => x.type === 'call'); this.emit({type: 'result', id: call.id, status, body}); }
  }
  return {workers, engine: createEngine({origin: 'http://localhost:8877', workerURL: 'http://localhost:8877/engine-worker.js', workerFactory: () => new Worker(), ...options})};
}
(async () => {
  {
    const {engine, workers} = harness();
    assert.equal(workers.length, 0);
    assert.equal((await engine.fetch('https://example.com/api/analyze', request({}))).status, 404);
    assert.equal((await engine.fetch('/api/analyze?data=secret', request({}))).status, 404);
    assert.equal((await engine.fetch('/api/analyze', {method: 'GET'})).status, 405);
    assert.equal((await engine.fetch('/api/analyze', {method: 'POST', body: '{'})).status, 422);
    const pdf = await engine.fetch('/api/import-pdf', request({data: 'anything'}));
    assert.equal(pdf.status, 501); assert.equal((await pdf.json()).code, 'editable_pdf_unavailable');
    assert.equal(workers.length, 0); tests++;
  }
  {
    const {engine, workers} = harness();
    const phases = [], off = engine.subscribe(s => phases.push(s.phase));
    const pending = engine.fetch('/api/analyze', request({recipe: {}, rows: [], config: {}}));
    assert.equal(workers.length, 1); assert.equal(workers[0].messages.length, 1);
    workers[0].ready(); await tick();
    assert.equal(workers[0].messages[1].endpoint, '/api/analyze');
    workers[0].result({analysis: {p: .25}, warnings: [{code: 'browser_font_fallback', en: 'Explicit fallback', zh: '明确字体替代', researchRows: 'never expose'}]});
    assert.deepEqual((await (await pending).json()).analysis, {p: .25});
    assert.equal(engine.status().lastWarnings[0].en, 'Explicit fallback');
    assert.equal(engine.status().lastWarnings[0].researchRows, undefined);
    assert.equal(typeof engine.status().lastDurationMs, 'number');
    assert.equal(typeof engine.status().lastInitializationMs, 'number');
    assert.ok(phases.includes('loading') && phases.includes('working') && phases.includes('ready'));
    const p2 = engine.fetch('/api/reflow', request({})); await tick();
    assert.equal(engine.status().lastWarnings.length, 0);
    assert.equal(workers.length, 1); workers[0].result({variant: {}}); await p2;
    off(); engine.dispose(); tests++;
  }
  {
    const {engine, workers} = harness({operationTimeout: 10});
    const pending = engine.fetch('/api/analyze', request({}));
    workers[0].ready();
    const response = await pending;
    assert.equal(response.status, 504); assert.equal((await response.json()).code, 'operation_timeout');
    assert.ok(workers[0].terminated); assert.equal(engine.status().busy, false);
    engine.dispose(); tests++;
  }
  {
    const {engine, workers} = harness();
    const first = engine.fetch('/api/render', request({}));
    const second = engine.fetch('/api/analyze', request({}));
    const third = engine.fetch('/api/reflow', request({}));
    assert.equal((await engine.fetch('/api/render', request({}))).status, 429);
    assert.equal(engine.status().queued, 2);
    workers[0].ready(); await tick(); workers[0].result({n: 1}); await tick();
    workers[0].result({n: 2}); await tick(); workers[0].result({n: 3});
    assert.deepEqual(await Promise.all([first, second, third].map(async p => (await (await p).json()).n)), [1, 2, 3]);
    engine.dispose(); tests++;
  }
  {
    const {engine, workers} = harness();
    const controller = new AbortController();
    const first = engine.fetch('/api/analyze', {...request({}), signal: controller.signal});
    const second = engine.fetch('/api/render', request({}));
    controller.abort();
    assert.equal((await first).status, 499); assert.ok(workers[0].terminated);
    assert.equal(workers.length, 2); workers[0].ready(); // stale worker cannot resolve the new generation
    workers[1].ready(); await tick(); workers[1].result({panel: {id: 'new'}});
    assert.equal((await (await second).json()).panel.id, 'new');
    engine.dispose(); tests++;
  }
  {
    const {engine, workers} = harness();
    const images = [{id: 'a', label: 'A', data: 'data:image/png;base64,YQ=='}, {id: 'b', label: 'B', data: 'data:image/png;base64,Yg=='}];
    const started = await (await engine.fetch('/api/image-duplicates', request({action: 'start', images}))).json();
    assert.ok(started.jobId);
    assert.equal((await engine.fetch('/api/image-duplicates', request({action: 'start', images}))).status, 422);
    workers[0].ready(); await tick();
    const call = workers[0].messages.findLast(x => x.type === 'call');
    workers[0].emit({type: 'progress', id: call.id, progress: {stage: 'comparing', completed: 1, total: 1}});
    let state = await (await engine.fetch('/api/image-duplicates', request({action: 'status', jobId: started.jobId}))).json();
    assert.equal(state.progress.stage, 'comparing');
    workers[0].result({schema: 'image-duplicate-check/1', matches: [{a: 'a', b: 'b', kind: 'exact'}]}); await tick();
    state = await (await engine.fetch('/api/image-duplicates', request({action: 'result', jobId: started.jobId}))).json();
    assert.equal(state.status, 'complete'); assert.equal(state.result.matches.length, 1);
    const next = await (await engine.fetch('/api/image-duplicates', request({action: 'start', images}))).json(); await tick();
    const cancelled = await (await engine.fetch('/api/image-duplicates', request({action: 'cancel', jobId: next.jobId}))).json();
    assert.equal(cancelled.status, 'cancelled'); assert.ok(workers[0].terminated);
    engine.dispose(); tests++;
  }
  {
    const {engine, workers} = harness();
    const first = engine.fetch('/api/render', request({})); const second = engine.fetch('/api/render', request({}));
    workers[0].emit({type: 'fatal', error: 'missing offline wheel'});
    assert.equal((await first).status, 503); assert.equal((await second).status, 503);
    assert.equal(workers.length, 1); assert.equal(engine.status().phase, 'error');
    engine.dispose(); tests++;
  }
  console.log(JSON.stringify({passed: true, tests}));
})().catch(error => { console.error(error); process.exitCode = 1; });
