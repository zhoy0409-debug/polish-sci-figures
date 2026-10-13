/* Local Android export adapter. No network access or research-data logging. */
(() => {
  'use strict';
  const host = window.StudioAndroidHost;
  if (!host || typeof host.postMessage !== 'function') return;
  const MAX = 200000000, CHUNK = 196608, WAIT = 610000;
  let active = null, serial = 0;
  const pending = new Map();
  host.onmessage = event => {
    let value;
    try { value = JSON.parse(event.data); } catch (_) { return; }
    const item = pending.get(value.id);
    if (!item) return;
    pending.delete(value.id); clearTimeout(item.timer);
    if (value.error) item.reject(new Error(String(value.error)));
    else item.resolve(value);
  };
  function command(id, data, timeout = WAIT) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Save timed out / 保存已超时')); }, timeout);
      pending.set(id, {resolve, reject, timer});
      try { host.postMessage(JSON.stringify({id, ...data})); }
      catch (error) { clearTimeout(timer); pending.delete(id); reject(error); }
    });
  }
  function encode(bytes) {
    let text = '';
    for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(text);
  }
  async function transfer(name, mime, size, chunks) {
    if (active) throw new Error('Finish or cancel the current save first / 请先完成或取消当前保存');
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX) throw new Error('Export limit: 200 MB / 导出上限为 200 MB');
    if (typeof name !== 'string' || !name.trim() || name.length > 240 || /[\\/\x00-\x1f\x7f]/.test(name) || name === '.' || name === '..') throw new Error('Invalid filename / 文件名无效');
    mime = String(mime || 'application/octet-stream').split(';')[0].trim();
    if (!/^[A-Za-z0-9.+-]+\/[A-Za-z0-9.+-]+$/.test(mime)) throw new Error('Invalid file type / 文件类型无效');
    const id = 'save_' + Date.now().toString(36) + '_' + (++serial);
    active = id;
    try {
      const start = await command(id, {action:'begin', name, mime, size});
      if (start.stage !== 'ready') throw new Error('Save could not start / 无法开始保存');
      let offset = 0;
      for await (const chunk of chunks()) {
        const reply = await command(id, {action:'chunk', offset, base64:chunk.base64});
        offset += chunk.bytes;
        if (reply.stage !== 'chunk' || reply.received !== offset) throw new Error('Incomplete file transfer / 文件传输不完整');
      }
      if (offset !== size) throw new Error('File size changed / 文件大小发生变化');
      const result = await command(id, {action:'finish'});
      if (result.cancelled === true) return {cancelled:true};
      if (result.saved !== true || result.bytes !== size || result.name !== name) throw new Error('Save was not confirmed / 未确认文件已保存');
      return {saved:true, name, bytes:size};
    } catch (error) {
      // Finish bounded cleanup before allowing another save to reuse the native slot.
      try { await command(id, {action:'abort'}, 2000); } catch (_) {}
      throw error;
    } finally { active = null; }
  }
  async function saveBlob(blob, name) {
    if (!(blob instanceof Blob)) throw new TypeError('A Blob is required');
    return transfer(name, blob.type, blob.size, async function* () {
      for (let offset = 0; offset < blob.size; offset += CHUNK) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + CHUNK).arrayBuffer());
        yield {base64:encode(bytes), bytes:bytes.length};
      }
    });
  }
  async function saveFile({name, mime, base64} = {}) {
    if (typeof base64 !== 'string' || base64.length > Math.ceil(MAX / 3) * 4 || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Invalid base64 file');
    const size = base64.length / 4 * 3 - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
    return transfer(name, mime, size, async function* () {
      for (let offset = 0; offset < base64.length; offset += CHUNK / 3 * 4) {
        const part = base64.slice(offset, offset + CHUNK / 3 * 4);
        yield {base64:part, bytes:part.length / 4 * 3 - (part.endsWith('==') ? 2 : part.endsWith('=') ? 1 : 0)};
      }
    });
  }
  Object.defineProperty(window, 'StudioNativeBridge', {value:Object.freeze({platform:'android', bundledAssets:true, saveBlob, saveFile}), configurable:false, writable:false});
})();
