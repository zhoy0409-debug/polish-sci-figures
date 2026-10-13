/* Optional installation of public application assets only; no project data cache. */
(function () {
  'use strict';
  // Native previews ship the verified public assets inside the application.
  // They must not attempt to register a web cache or download a second runtime.
  if(window.StudioNativeBridge?.bundledAssets===true){
    const state=Object.freeze({supported:true,phase:'ready',ready:true,bundled:true,completed:0,total:0});
    window.StudioBrowserOffline=Object.freeze({install:async()=>({...state}),refresh:async()=>({...state}),status:()=>({...state}),subscribe(listener){listener({...state});return()=>{};}});
    return;
  }
  const base = new URL('./', document.currentScript.src);
  const listeners = new Set();
  let state = {supported: !!navigator.serviceWorker && !!globalThis.isSecureContext, phase: 'not-installed', completed: 0, total: 0};
  let pending = null;
  function publish(value) {
    state = {...state, ...value};
    for (const listener of listeners) { try { listener({...state}); } catch (_) {} }
  }
  function ask(worker, type = 'offline-status') {
    return new Promise((resolve, reject) => {
      if (!worker) return resolve({ready: false});
      const channel = new MessageChannel();
      const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Offline status timed out')); }, type === 'offline-repair' ? 300000 : 5000);
      channel.port1.onmessage = event => { clearTimeout(timer); channel.port1.close(); resolve(event.data); };
      worker.postMessage({type}, [channel.port2]);
    });
  }
  async function refresh() {
    if (!state.supported) return {...state};
    const registration = await navigator.serviceWorker.getRegistration(base.href);
    const value = await ask(registration && registration.active);
    publish(value.ready ? {phase: 'ready', ...value} : {phase: 'not-installed', ready: false});
    return {...state};
  }
  async function install() {
    if (!state.supported) throw new Error('Offline installation needs HTTPS or localhost and a supporting browser / 离线安装需要 HTTPS 或 localhost，以及支持的浏览器');
    if (pending) return pending;
    pending = (async () => {
      publish({phase: 'installing', error: '', ready: false});
      const registration = await navigator.serviceWorker.register(new URL('service-worker.js', base), {scope: base.pathname, updateViaCache: 'none'});
      const candidate = registration.installing || registration.waiting;
      if (candidate) await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Offline installation timed out')), 300000);
        const check = () => {
          if (candidate.state === 'activated') { clearTimeout(timer); candidate.removeEventListener('statechange', check); resolve(); }
          if (candidate.state === 'redundant') { clearTimeout(timer); candidate.removeEventListener('statechange', check); reject(new Error('Offline asset installation failed')); }
        };
        candidate.addEventListener('statechange', check); check();
      });
      let value = await ask(registration.active);
      // register() does not reinstall unchanged code. Repair a cache which has
      // been partially evicted even when this worker version is already active.
      if (!value.ready) value = await ask(registration.active, 'offline-repair');
      if (!value.ready) throw new Error('The offline asset cache is incomplete / 离线资源尚未完整缓存');
      publish({phase: 'ready', ...value});
      return {...state};
    })().catch(error => { publish({phase: 'error', ready: false, error: String(error.message || error)}); throw error; }).finally(() => { pending = null; });
    return pending;
  }
  if (state.supported) navigator.serviceWorker.addEventListener('message', event => {
    if (event.data && event.data.type === 'offline-progress') publish({phase: 'installing', completed: event.data.completed, total: event.data.total});
  });
  window.StudioBrowserOffline = Object.freeze({install, refresh, status: () => ({...state}), subscribe(listener) {
    listeners.add(listener); listener({...state}); return () => listeners.delete(listener);
  }});
})();
