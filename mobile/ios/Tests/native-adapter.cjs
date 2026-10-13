'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Resources/native-adapter.js'), 'utf8');

function adapter(options = {}) {
  const calls = [], received = [];
  let expected = 0, index = 0;
  const native = {async postMessage(message) {
    calls.push(message);
    if (message.action === 'begin') { expected = message.bytes; return {id: 'export-1'}; }
    if (message.action === 'chunk') {
      assert.equal(message.index, index++); assert.equal(message.id, 'export-1');
      const bytes = Buffer.from(message.base64, 'base64'); assert.ok(bytes.length <= 256 * 1024);
      if (options.chunkError) throw Error('Disk full');
      received.push(bytes); return {bytes: received.reduce((sum, value) => sum + value.length, 0)};
    }
    if (message.action === 'finish') {
      assert.equal(Buffer.concat(received).length, expected);
      return options.cancel ? {cancelled: true} : {saved: true, name: calls[0].name, bytes: expected};
    }
    if (message.action === 'abort') return {cancelled: true};
    throw Error('Unexpected request');
  }};
  const window = {webkit: {messageHandlers: {figureStudioNative: native}}}; window.top = window;
  vm.runInNewContext(source, {window, Blob, Uint8Array, btoa: value => Buffer.from(value, 'binary').toString('base64'), atob: value => Buffer.from(value, 'base64').toString('binary')});
  return {bridge: window.StudioNativeBridge, calls, received};
}

(async () => {
  const bytes = Buffer.alloc(600001); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const saved = adapter();
  assert.equal(saved.bridge.platform, 'ios'); assert.equal(saved.bridge.bundledAssets, true);
  const result = await saved.bridge.saveBlob(new Blob([bytes]), 'real-data.tif');
  assert.equal(result.saved, true); assert.equal(result.bytes, bytes.length);
  assert.equal(saved.calls.filter(call => call.action === 'chunk').length, 3);
  assert.deepEqual(Buffer.concat(saved.received), bytes);
  const cancelled = adapter({cancel: true});
  assert.equal((await cancelled.bridge.saveBlob(new Blob(['test']), 'test.txt')).cancelled, true);
  const failed = adapter({chunkError: true});
  await assert.rejects(failed.bridge.saveBlob(new Blob(['test']), 'test.txt'), /Disk full/);
  assert.equal(failed.calls.at(-1).action, 'abort');
  const base64 = adapter();
  await base64.bridge.saveFile({name: 'image.png', mime: 'image/png', base64: bytes.toString('base64')});
  assert.deepEqual(Buffer.concat(base64.received), bytes);
  await assert.rejects(base64.bridge.saveFile({name: 'bad.txt', base64: 'invalid_='}), /base64/);
  const empty = adapter(); await empty.bridge.saveBlob(new Blob(), 'empty.txt');
  assert.equal(empty.calls.filter(call => call.action === 'chunk').length, 0);
  const locked = adapter(); const pending = locked.bridge.saveBlob(new Blob(['a']), 'one.txt');
  await assert.rejects(locked.bridge.saveBlob(new Blob(['b']), 'two.txt'), /dialog/); await pending;
  const noNative = {top: null}; noNative.top = noNative;
  vm.runInNewContext(source, {window: noNative}); assert.equal(noNative.StudioNativeBridge, undefined);
  new vm.Script(fs.readFileSync(path.join(__dirname, '../Resources/simulator-smoke.js'), 'utf8'));
  console.log('iOS adapter: sequential bounded chunks, exact bytes, cancellation, abort, empty files, busy state, base64 and syntax passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
