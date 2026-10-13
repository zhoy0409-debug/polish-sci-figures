'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const start=source.indexOf('  async function download(blob,name)');
const end=source.indexOf('  function svgText()',start);
assert.ok(start>=0&&end>start);
function harness(bridge){
  const events=[];
  const ctx={StudioNativeBridge:bridge,T:s=>s,say:s=>events.push(['status',s]),
    URL:{createObjectURL:()=>{events.push(['url']);return'blob:local';},revokeObjectURL:url=>events.push(['revoke',url])},
    document:{createElement:()=>({click(){events.push(['download',this.download]);}})},setTimeout:fn=>fn()};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nglobalThis.save=download;',ctx);
  return{save:ctx.save,events};
}
(async()=>{
  const blob=new Blob(['synthetic figure'],{type:'image/svg+xml'});
  let complete;
  const native=harness({bundledAssets:true,saveBlob:(value,name)=>{assert.equal(value,blob);assert.equal(name,'figure.svg');return new Promise(resolve=>{complete=resolve;});}});
  let done=false;const waiting=native.save(blob,'figure.svg').then(value=>{done=true;return value;});
  await Promise.resolve();assert.equal(done,false,'system picker completion must be awaited');assert.equal(native.events.length,0);
  complete({saved:true});assert.equal(await waiting,true);assert.equal(native.events.length,0,'native save must not also download a browser blob URL');
  const cancelled=harness({bundledAssets:true,saveBlob:async()=>({cancelled:true})});
  assert.equal(await cancelled.save(blob,'figure.svg'),false);assert.deepEqual(cancelled.events,[['status','保存已取消']]);
  for(const bridge of [{bundledAssets:true},{bundledAssets:true,saveBlob:async()=>({})},{bundledAssets:true,saveBlob:async()=>{throw Error('Device storage is full');}}]){
    const failed=harness(bridge);await assert.rejects(failed.save(blob,'figure.svg'));assert.equal(failed.events.length,0,'native failure must not claim success or fall back');
  }
  const browser=harness(undefined);assert.equal(await browser.save(blob,'figure.svg'),true);
  assert.deepEqual(browser.events,[['url'],['download','figure.svg'],['revoke','blob:local']]);
  const offline=fs.readFileSync(path.join(__dirname,'../web/offline.js'),'utf8');
  const ctx={window:{StudioNativeBridge:{bundledAssets:true}},navigator:new Proxy({},{get(){throw Error('Native app must not access service workers');}})};
  vm.createContext(ctx);vm.runInContext(offline,ctx);const api=ctx.window.StudioBrowserOffline;
  assert.equal(api.status().bundled,true);assert.equal((await api.install()).ready,true);assert.equal((await api.refresh()).ready,true);
  let notified;api.subscribe(value=>{notified=value;});assert.equal(notified.phase,'ready');
  console.log('Native save: completion, cancellation, failures and browser fallback passed; bundled offline path makes no service-worker requests.');
})().catch(error=>{console.error(error);process.exitCode=1;});
