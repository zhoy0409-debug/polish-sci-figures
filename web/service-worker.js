/* Generated version is replaced by the local builder. Never handles research POSTs. */
'use strict';
const VERSION = '__STUDIO_CACHE_VERSION__';
const CACHE = 'figure-studio-local-prototype-' + VERSION;
const base = new URL('./', self.location.href);
let knownAssets = null, installingAssets = null;
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('');
function assetURL(path) {
  if (typeof path !== 'string' || !/^[a-zA-Z0-9_.\-/]+$/.test(path) || path.split('/').includes('..')) throw new Error('Invalid offline asset path');
  const url = new URL(path, base);
  if (!url.href.startsWith(base.href)) throw new Error('Offline asset escapes scope');
  return url.href;
}
async function inventory() {
  if (knownAssets) return knownAssets;
  const cache = await caches.open(CACHE);
  const response = await cache.match(new URL('offline-manifest.json', base).href);
  if (!response) return new Set();
  const manifest = await response.json();
  return knownAssets = new Set(manifest.files.map(entry => assetURL(entry.path)));
}
async function cacheAssets() {
  if (installingAssets) return installingAssets;
  installingAssets = populateCache().finally(() => { installingAssets = null; });
  return installingAssets;
}
async function populateCache() {
  const url = new URL('offline-manifest.json', base).href;
  const response = await fetch(url, {credentials: 'omit', redirect: 'error', cache: 'no-store'});
  if (!response.ok) throw new Error('Offline manifest missing');
  const manifest = await response.clone().json();
  if (manifest.version !== VERSION || manifest.schema !== 'figure-studio-offline/1') throw new Error('Offline asset version mismatch');
  const cache = await caches.open(CACHE);
  // Clear the completion marker before repairing an incomplete existing version.
  await cache.delete(url);
  knownAssets = null;
  let completed = 0;
  try {
    for (const entry of manifest.files) {
      const asset = assetURL(entry.path);
      const received = await fetch(asset, {credentials: 'omit', redirect: 'error', cache: 'no-store'});
      if (!received.ok) throw new Error('Offline asset missing: ' + entry.path);
      const bytes = await received.arrayBuffer();
      if (bytes.byteLength !== entry.bytes || await digest(bytes) !== entry.sha256) throw new Error('Offline asset checksum mismatch: ' + entry.path);
      await cache.put(asset, new Response(bytes, {headers: received.headers}));
      completed++;
      for (const client of await self.clients.matchAll({includeUncontrolled: true})) client.postMessage({type: 'offline-progress', completed, total: manifest.files.length});
    }
    // This marker is stored last. A partial install never reports ready.
    await cache.put(url, response);
    knownAssets = new Set(manifest.files.map(entry => assetURL(entry.path)));
    await self.skipWaiting();
  } catch (error) { await caches.delete(CACHE); throw error; }
}
self.addEventListener('install', event => event.waitUntil(cacheAssets()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  const previous = (await caches.keys()).filter(name => name.startsWith('figure-studio-local-prototype-') && name !== CACHE);
  // Retain at most one previous public app version; never touch another app's cache.
  for (const name of previous.slice(0, -1)) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => {
  if (event.data && ['offline-status', 'offline-repair'].includes(event.data.type) && event.ports[0]) event.waitUntil((async () => {
    if (event.data.type === 'offline-repair') {
      try { await cacheAssets(); }
      catch (error) { event.ports[0].postMessage({ready: false, error: String(error.message || error)}); return; }
    }
    const cache = await caches.open(CACHE), names = await inventory();
    let ready = !installingAssets && names.size > 0 && !!await cache.match(new URL('offline-manifest.json', base).href);
    // Check every expected entry rather than relying on a stale flag after eviction.
    for (const name of names) if (!await cache.match(name)) { ready = false; break; }
    event.ports[0].postMessage({ready, version: VERSION, assets: names.size});
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== base.origin || url.search || url.hash || !url.href.startsWith(base.href)) return;
  event.respondWith((async () => {
    const names = await inventory();
    const target = url.href === base.href ? new URL('starter.html', base).href : url.href;
    if (names.has(target) || target === new URL('offline-manifest.json', base).href) {
      const cached = await (await caches.open(CACHE)).match(target);
      if (cached) return cached;
    }
    return fetch(request);
  })());
});
