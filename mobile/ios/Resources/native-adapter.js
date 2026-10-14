/* Injected before application scripts: local files and fixed official release checks. */
(function () {
  'use strict';
  const native = window.webkit?.messageHandlers?.figureStudioNative;
  if (!native || window !== window.top) return;
  const chunkBytes = 256 * 1024, maxBytes = 256 * 1024 * 1024;
  let busy = false;
  const send = body => native.postMessage(body);
  function encoded(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  async function saveBlob(blob, name) {
    if (!(blob instanceof Blob) || typeof name !== 'string' || !name.trim()) throw new TypeError('A file and filename are required');
    if (blob.size > maxBytes) throw new Error('iOS preview export limit: 256 MiB / iOS 预览版最多导出 256 MiB');
    if (busy) throw new Error('Finish or cancel the open save dialog first / 请先完成或取消当前保存');
    busy = true;
    let id = null;
    try {
      ({id} = await send({action: 'begin', name, mime: blob.type || 'application/octet-stream', bytes: blob.size}));
      let index = 0;
      for (let offset = 0; offset < blob.size; offset += chunkBytes) {
        const bytes = new Uint8Array(await blob.slice(offset, offset + chunkBytes).arrayBuffer());
        await send({action: 'chunk', id, index: index++, base64: encoded(bytes)});
      }
      return await send({action: 'finish', id});
    } catch (error) {
      if (id) { try { await send({action: 'abort', id}); } catch (_) {} }
      throw error;
    } finally { busy = false; }
  }
  async function saveFile({name, mime = 'application/octet-stream', base64}) {
    if (typeof base64 !== 'string' || base64.length > Math.ceil(maxBytes / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw new Error('Invalid base64 export');
    const parts = [];
    for (let offset = 0; offset < base64.length; offset += 32768) {
      const binary = atob(base64.slice(offset, offset + 32768));
      parts.push(Uint8Array.from(binary, value => value.charCodeAt(0)));
    }
    return saveBlob(new Blob(parts, {type: mime}), name);
  }
  const updateInfo=Object.freeze({...window.__studioNativeUpdateInfo,platform:'ios',channel:'preview'});
  delete window.__studioNativeUpdateInfo;
  function checkUpdates(options={}) {
    if(!options||typeof options!=='object'||Object.keys(options).some(key=>key!=='refresh')||options.refresh!==undefined&&typeof options.refresh!=='boolean')return Promise.reject(new TypeError('Invalid update request'));
    return send({action:'checkUpdates',refresh:options.refresh===true});
  }
  function openExternal(url) {
    if(typeof url!=='string'||url.length>700||!/^(?:https:\/\/github\.com\/zhoy0409-debug\/polish-sci-figures\/releases)(?:\/latest|\/tag\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}|\/download\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(url)||url.includes('..'))return Promise.reject(new TypeError('Only official release links are allowed'));
    return send({action:'openUpdateLink',url}).then(result=>result?.opened===true);
  }
  Object.defineProperty(window, 'StudioNativeBridge', {value: Object.freeze({platform: 'ios', bundledAssets: true, updateInfo, checkUpdates, openExternal, saveBlob, saveFile}), configurable: false, writable: false});
})();
