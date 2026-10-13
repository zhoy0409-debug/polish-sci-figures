const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(__dirname + '/bridge/native-bridge.js', 'utf8');
function setup(mode = 'save') {
  const messages = [], chunks = [];
  let meta;
  const host = {postMessage(raw) {
    const item = JSON.parse(raw); messages.push(item);
    let result;
    if (item.action === 'abort') result = {cancelled:true};
    if (item.action === 'begin') { meta = item; result = {stage:'ready'}; }
    if (item.action === 'chunk') { chunks.push(Buffer.from(item.base64, 'base64')); result = {stage:'chunk', received:item.offset + chunks.at(-1).length}; }
    if (item.action === 'finish') result = mode === 'cancel' ? {cancelled:true} : mode === 'error' ? {error:'Provider rejected write'} : {saved:true, name:meta.name, bytes:meta.size};
    queueMicrotask(() => host.onmessage({data:JSON.stringify({id:item.id, ...result})}));
  }};
  const window = {StudioAndroidHost:host};
  vm.runInNewContext(source, {window, Blob, Uint8Array, btoa, setTimeout, clearTimeout, Map, Date});
  return {bridge:window.StudioNativeBridge, messages, chunks};
}
test('chunked Blob preserves every byte and awaits saved response', async () => {
  const {bridge, messages, chunks} = setup();
  const bytes = Buffer.alloc(600001); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const result = await bridge.saveBlob(new Blob([bytes], {type:'image/tiff'}), 'figure.tif');
  assert.equal(result.saved, true); assert.equal(result.bytes, bytes.length);
  assert.ok(chunks.length > 3); assert.deepEqual(Buffer.concat(chunks), bytes);
  assert.ok(messages.every(item => JSON.stringify(item).length < 265000));
});
test('base64 streams without constructing a full decoded Blob', async () => {
  const {bridge, chunks} = setup();
  const bytes = Buffer.alloc(393217, 203);
  const result = await bridge.saveFile({name:'review.json', mime:'application/json', base64:bytes.toString('base64')});
  assert.equal(result.bytes, bytes.length); assert.deepEqual(Buffer.concat(chunks), bytes);
});
test('cancel is not saved; provider error is not success', async () => {
  const cancel = await setup('cancel').bridge.saveBlob(new Blob(['test']), 'test.txt');
  assert.equal(cancel.cancelled, true); assert.equal(cancel.saved, undefined);
  const state = setup('error');
  await assert.rejects(state.bridge.saveBlob(new Blob(['test']), 'test.txt'), /Provider rejected/);
  assert.equal(state.messages.at(-1).action, 'abort');
});
test('oversize, invalid names and concurrent saves rejected before native transfer', async () => {
  const state = setup();
  await assert.rejects(state.bridge.saveBlob(new Blob(['a']), '../bad.txt'), /filename/);
  assert.equal(state.messages.length, 0);
  await assert.rejects(state.bridge.saveFile({name:'a', base64:'==='}), /base64/);
  const first = state.bridge.saveBlob(new Blob(['a']), 'a.txt');
  await assert.rejects(state.bridge.saveBlob(new Blob(['b']), 'b.txt'), /current save/);
  await first;
});
