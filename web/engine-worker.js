/* One private Python runtime per editor. Only bundled public assets may be fetched. */
'use strict';
const base = new URL('./', self.location.href), originalFetch = self.fetch.bind(self);
const originalImportScripts = self.importScripts.bind(self);
let manifest = null, pyodide = null, initialization = null, activeId = null, computationLocked = false;
const allowed = new Map();
function permitted(input, init = {}) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, base);
  const method = String(init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
  if (computationLocked || url.origin !== base.origin || url.search || url.hash || !allowed.has(url.href) || method !== 'GET' || init.body || (input && input.body)) throw new Error('Only bundled public assets may be fetched; scientific data stays in this worker');
  return url;
}
self.fetch = async (input, init = {}) => {
  const url = permitted(input, init);
  const response = await originalFetch(url.href, {method: 'GET', credentials: 'omit', redirect: 'error', cache: 'default'});
  if (!response.ok) throw new Error('Missing local asset: ' + url.pathname);
  const expected = allowed.get(url.href);
  if (!expected) return response;
  const bytes = await response.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
  if (digest !== expected) throw new Error('Local asset checksum mismatch: ' + url.pathname);
  return new Response(bytes, {status: 200, headers: response.headers});
};
self.importScripts = (...urls) => {
  for (const url of urls) permitted(url);
  originalImportScripts(...urls.map(url => new URL(url, base).href));
};
// This application has no network compute service, sockets or submitted code.
self.XMLHttpRequest = class { constructor() { throw new Error('XMLHttpRequest is unavailable in the local scientific worker'); } };
self.WebSocket = class { constructor() { throw new Error('WebSocket is unavailable in the local scientific worker'); } };
self.EventSource = class { constructor() { throw new Error('EventSource is unavailable in the local scientific worker'); } };
self._studio_progress = encoded => { if (activeId !== null) self.postMessage({type: 'progress', id: activeId, progress: JSON.parse(encoded)}); };

async function initialize() {
  if (initialization) return initialization;
  initialization = (async () => {
    allowed.set(new URL('engine-manifest.json', base).href, null);
    manifest = await (await self.fetch(new URL('engine-manifest.json', base))).json();
    if (manifest.schema !== 'figure-studio-browser-engine/1' || manifest.runtime.version !== '0.29.3') throw new Error('Unsupported local runtime manifest');
    for (const entry of manifest.files) {
      if (typeof entry.path !== 'string' || !/^[a-zA-Z0-9_.\-/]+$/.test(entry.path) || entry.path.split('/').includes('..') || !/^[0-9a-f]{64}$/.test(entry.sha256)) throw new Error('Invalid local asset manifest');
      const url = new URL(entry.path, base);
      if (!url.href.startsWith(base.href)) throw new Error('Asset path escapes bundle');
      allowed.set(url.href, entry.sha256);
    }
    self.postMessage({type: 'phase', detail: 'runtime'});
    // Check script bytes before importScripts executes the local pinned runtime.
    await self.fetch(new URL('runtime/pyodide.js', base));
    self.importScripts(new URL('runtime/pyodide.js', base).href);
    pyodide = await self.loadPyodide({indexURL: new URL('runtime/', base).href, stdout() {}, stderr() {}});
    self.postMessage({type: 'phase', detail: 'scientific-packages'});
    await pyodide.loadPackage(manifest.runtime.packages);
    self.postMessage({type: 'phase', detail: 'scientific-modules'});
    // Sequential mounting bounds transient buffers on machines with little memory.
    for (const source of manifest.pythonSources) {
      if (!source.destination.startsWith('/suite/') || source.destination.includes('..')) throw new Error('Invalid Python source mount');
      const bytes = new Uint8Array(await (await self.fetch(new URL(source.path, base))).arrayBuffer());
      pyodide.FS.mkdirTree(source.destination.slice(0, source.destination.lastIndexOf('/')));
      pyodide.FS.writeFile(source.destination, bytes);
    }
    const bootstrap = await (await self.fetch(new URL('engine-bootstrap.py', base))).text();
    await pyodide.runPythonAsync(bootstrap);
    computationLocked = true;
    self.postMessage({type: 'ready', runtime: '0.29.3', heapBytes: pyodide._module.HEAP8.length});
  })();
  return initialization;
}
self.onmessage = async event => {
  const message = event.data || {};
  try {
    if (message.type === 'init') { await initialize(); return; }
    if (message.type !== 'call' || activeId !== null || !Number.isSafeInteger(message.id) || typeof message.endpoint !== 'string' || typeof message.payload !== 'string') throw new Error('Invalid or overlapping local worker operation');
    await initialize();
    activeId = message.id;
    pyodide.globals.set('_studio_endpoint', message.endpoint);
    pyodide.globals.set('_studio_payload', message.payload);
    const encoded = await pyodide.runPythonAsync('_studio_dispatch(_studio_endpoint, _studio_payload)');
    const result = JSON.parse(encoded);
    pyodide.globals.delete('_studio_endpoint');
    pyodide.globals.delete('_studio_payload');
    self.postMessage({type: 'result', id: activeId, status: result.status, body: result.body});
    activeId = null;
  } catch (error) {
    self.postMessage({type: 'fatal', error: String(error.message || error)});
  }
};
