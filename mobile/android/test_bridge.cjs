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
    if (item.action === 'check-updates') result = mode === 'update-error' ? {error:'Metadata unavailable'} : {result:{status:'up-to-date',platform:'android',currentVersion:'0.1.7',latestVersion:'0.1.7'}};
    if (item.action === 'open-release') result = {result:{opened:true}};
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
test('metadata is separate from the save transaction and transmits only the refresh flag', async () => {
  const state=setup(), save=state.bridge.saveBlob(new Blob(['research data']), 'project.json');
  const update=await state.bridge.checkUpdates({refresh:true,project:{secret:'never sent'}});
  assert.equal(update.status,'up-to-date');assert.equal((await save).saved,true);
  const request=state.messages.find(item=>item.action==='check-updates');
  assert.deepEqual(Object.keys(request).sort(),['action','id','refresh']);assert.equal(request.refresh,true);
  assert.equal(state.bridge.updateInfo.platform,'android');assert.ok(Object.isFrozen(state.bridge.updateInfo));
  await assert.rejects(state.bridge.checkUpdates({refresh:'yes'}),/boolean/);
});
test('metadata errors do not abort saving and official links use a separate native action', async () => {
  const state=setup('update-error');
  const save=state.bridge.saveBlob(new Blob(['research data']), 'project.json');
  await assert.rejects(state.bridge.checkUpdates(),/Metadata unavailable/);
  assert.equal((await save).saved,true);assert.equal(state.messages.some(item=>item.action==='abort'),false);
  assert.equal((await state.bridge.openExternal('https://github.com/zhoy0409-debug/polish-sci-figures/releases')).opened,true);
  const request=state.messages.find(item=>item.action==='open-release');
  assert.deepEqual(Object.keys(request).sort(),['action','id','url']);
});
