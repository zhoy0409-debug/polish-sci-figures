/* Execute the editor's real transport function; a browser worker must fail closed. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../skills/polish-sci-figures/assets/figure-studio/studio.js'), 'utf8');
const controller = source.slice(source.indexOf('  async function engineFetch('), source.indexOf('  let statisticsSession='));
function setup(mode, bridge) {
  const observed = {network: [], local: [], connections: [], refreshes: 0};
  const context = {Response, localEngine: {mode, token: 'original-token'},
    fetch: async (...args) => { observed.network.push(args); return new Response('{}'); },
    setEngineConnection: value => observed.connections.push(value),
    engineConnectionError: value => new Error('connection:' + value),
    refreshEngineConnection: async () => { observed.refreshes++; context.localEngine.token = 'refreshed-token'; }};
  if (bridge) context.StudioBrowserEngine = {
    fetch: async (...args) => { observed.local.push(args); return bridge.fetch(...args); },
    status: bridge.status || (() => ({phase: 'ready'}))
  };
  vm.createContext(context); vm.runInContext(controller, context);
  return {context, observed};
}
(async () => {
  const request = {method: 'POST', body: '{"private":"synthetic fixture"}', headers: {'X-Studio-Token': 'original-token'}};
  let fixture = setup('browser', {fetch: async () => new Response('{"answer":42}')});
  assert.deepEqual(await (await fixture.context.engineFetch('/api/analyze', request)).json(), {answer: 42});
  assert.equal(fixture.observed.local[0][1], request); assert.equal(fixture.observed.network.length, 0);
  assert.deepEqual(fixture.observed.connections, ['connected']);
  for (const bridge of [undefined, {fetch: async () => { throw Error('worker failed'); }}]) {
    fixture = setup('browser', bridge);
    await assert.rejects(fixture.context.engineFetch('/api/render', request), /connection:offline/);
    assert.equal(fixture.observed.network.length, 0, 'A missing worker must not send the data to HTTP');
  }
  fixture = setup('browser', {fetch: async () => new Response('{"error":"Local editor authorization required"}', {status: 403})});
  assert.equal((await fixture.context.engineFetch('/api/render', request)).status, 403);
  assert.equal(fixture.observed.refreshes, 0); assert.equal(fixture.observed.network.length, 0);
  fixture = setup('browser', {fetch: async () => new Response('{}', {status: 503}), status: () => ({phase: 'error'})});
  assert.equal((await fixture.context.engineFetch('/api/render', request)).status, 503);
  assert.deepEqual(fixture.observed.connections, ['offline']); assert.equal(fixture.observed.network.length, 0);
  fixture = setup(undefined);
  assert.equal((await fixture.context.engineFetch('/api/render', request)).status, 200);
  assert.equal(fixture.observed.network.length, 1); assert.equal(fixture.observed.local.length, 0);
  fixture.context.fetch = async (url, options) => {
    fixture.observed.network.push([url, options]);
    return options.headers['X-Studio-Token'] === 'original-token'
      ? new Response('{"error":"Local editor authorization required"}', {status: 403}) : new Response('{}');
  };
  assert.equal((await fixture.context.engineFetch('/api/render', request)).status, 200);
  assert.equal(fixture.observed.refreshes, 1);
  assert.equal(fixture.observed.network.at(-1)[1].headers['X-Studio-Token'], 'refreshed-token');
  console.log('Browser transport keeps scientific requests in the worker, fails closed, and preserves desktop token refresh.');
})().catch(error => { console.error(error); process.exitCode = 1; });
