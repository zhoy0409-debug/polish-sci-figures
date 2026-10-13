'use strict';
const vm = require('node:vm');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const source = fs.readFileSync(require('node:path').join(__dirname, '../web/service-worker.js'), 'utf8').replace('__STUDIO_CACHE_VERSION__', 'test-version');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function harness({corrupt = false} = {}) {
  const files = [{path: 'starter.html', data: '<html>public blank editor</html>'}, {path: 'runtime/module.wasm', data: 'public program bytes'}];
  const base = 'http://localhost:8877/', manifest = {schema: 'figure-studio-offline/1', version: 'test-version', files: files.map(({path, data}) => ({path, bytes: Buffer.byteLength(data), sha256: sha(data)}))};
  const available = new Map(files.map(({path, data}) => [base + path, corrupt && path.endsWith('wasm') ? 'tampered' : data]));
  available.set(base + 'offline-manifest.json', JSON.stringify(manifest));
  const allCaches = new Map(), handlers = {}, events = [], requests = [];
  let offline = false;
  const caches = {
    async open(name) {
      if (!allCaches.has(name)) allCaches.set(name, new Map());
      const map = allCaches.get(name);
      return {async match(key) { const entry = map.get(String(key)); return entry && entry.clone(); }, async put(key, value) { map.set(String(key), value.clone()); }, async delete(key) { return map.delete(String(key)); }};
    },
    async delete(name) { return allCaches.delete(name); },
    async keys() { return [...allCaches.keys()]; },
  };
  const fetch = async input => {
    const url = typeof input === 'string' ? input : input.url;
    requests.push(url);
    if (offline) throw new Error('Network is disconnected');
    return new Response(available.get(url) || '', {status: available.has(url) ? 200 : 404});
  };
  const self = {location: {href: base + 'service-worker.js'}, addEventListener(type, callback) { handlers[type] = callback; }, clients: {async matchAll() { return [{postMessage(value) { events.push(value); }}]; }, async claim() {}}, async skipWaiting() {}};
  vm.runInNewContext(source, {self, caches, fetch, crypto: crypto.webcrypto, URL, Response, Set, Uint8Array, Array, Error});
  const run = type => { let promise; handlers[type]({waitUntil(value) { promise = value; }}); return promise; };
  return {allCaches, events, requests, run, handlers, disconnect() { offline = true; }, reconnect() { offline = false; }, base};
}
(async () => {
  const h = harness(); await h.run('install');
  h.allCaches.set('figure-studio-local-prototype-old1', new Map());
  h.allCaches.set('figure-studio-local-prototype-old2', new Map());
  h.allCaches.set('unrelated-app-cache', new Map());
  await h.run('activate');
  assert.ok(!h.allCaches.has('figure-studio-local-prototype-old1'));
  assert.ok(h.allCaches.has('figure-studio-local-prototype-old2') && h.allCaches.has('unrelated-app-cache'));
  assert.equal(h.events.length, 2); assert.equal(h.events[1].completed, 2);
  h.disconnect(); const count = h.requests.length;
  for (const url of [h.base, h.base + 'starter.html', h.base + 'runtime/module.wasm']) {
    let response;
    h.handlers.fetch({request: {url, method: 'GET'}, respondWith(value) { response = value; }});
    assert.equal((await response).status, 200);
  }
  assert.equal(h.requests.length, count, 'Cached public assets must cause zero network calls while offline');
  let attempted = false;
  h.handlers.fetch({request: {url: h.base + 'api/analyze', method: 'POST', body: 'private data'}, respondWith() { attempted = true; }});
  assert.equal(attempted, false, 'Research POSTs must never be handled or cached');
  let status, waiting;
  h.handlers.message({data: {type: 'offline-status'}, ports: [{postMessage(value) { status = value; }}], waitUntil(value) { waiting = value; }});
  await waiting; assert.equal(status.ready, true);
  const cache = [...h.allCaches.values()][0]; cache.delete(h.base + 'runtime/module.wasm');
  h.handlers.message({data: {type: 'offline-status'}, ports: [{postMessage(value) { status = value; }}], waitUntil(value) { waiting = value; }});
  await waiting; assert.equal(status.ready, false, 'Evicted assets invalidate offline readiness');
  h.reconnect();
  h.handlers.message({data: {type: 'offline-repair'}, ports: [{postMessage(value) { status = value; }}], waitUntil(value) { waiting = value; }});
  await waiting; assert.equal(status.ready, true, 'The unchanged active worker must repair evicted entries');
  h.disconnect();
  let repaired;
  h.handlers.fetch({request: {url: h.base + 'runtime/module.wasm', method: 'GET'}, respondWith(value) { repaired = value; }});
  assert.equal(await (await repaired).text(), 'public program bytes');
  const broken = harness({corrupt: true});
  await assert.rejects(() => broken.run('install'), /checksum mismatch/);
  assert.equal(broken.allCaches.size, 0, 'A failed install must not leave a ready or partial cache');
  console.log(JSON.stringify({passed: true, tests: 7, offlineAssetRequests: 0}));
})().catch(error => { console.error(error); process.exitCode = 1; });
