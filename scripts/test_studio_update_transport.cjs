'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const start=source.indexOf('    const updateNative=globalThis.StudioNativeBridge;'),end=source.indexOf('    migrateLabelHistory();',start);
assert.ok(start>0&&end>start);
function create(localEngine,native){
  let host;const calls=[],ctx={StudioNativeBridge:native,localEngine,StudioI18n:{language:'en'},document:{querySelector:()=>({})},StudioUpdateCheck:{create:options=>(host=options,{})},engineFetch:async(endpoint,options)=>{calls.push({endpoint,options});return {ok:true,json:async()=>({status:'up-to-date'})};}};
  vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);return {get host(){return host;},calls};
}
(async()=>{
  const info={platform:'windows',currentVersion:'0.1.7',channel:'stable'},desktop=create({updatesEndpoint:'/api/updates',updateInfo:info,token:'loopback-only'},null),signal=new AbortController().signal;
  assert.equal(desktop.host.autoCheck,true,'Packaged software automatically checks for new versions');assert.equal(desktop.host.info(),info);
  await desktop.host.check({signal,refresh:true});assert.equal(desktop.calls[0].endpoint,'/api/updates');assert.equal(desktop.calls[0].options.signal,signal);assert.deepEqual(JSON.parse(desktop.calls[0].options.body),{refresh:true});assert.equal(desktop.calls[0].options.headers['X-Studio-Token'],'loopback-only');
  const requests=[],opened=[],native={updateInfo:{platform:'android'},checkUpdates:async options=>(requests.push(options),{status:'up-to-date'}),openExternal:url=>opened.push(url)},mobile=create({mode:'browser'},native);
  await mobile.host.check({signal,refresh:false});assert.equal(mobile.calls.length,0,'Native checks never route through the scientific worker');assert.deepEqual(JSON.parse(JSON.stringify(requests)),[{refresh:false}]);assert.equal(mobile.host.info(),native.updateInfo);mobile.host.openExternal('official-test');assert.deepEqual(opened,['official-test']);
  assert.equal(create({mode:'browser'},null).host,undefined,'Offline HTML must not pretend to be an installed app');
  assert.equal(create({updatesEndpoint:'https://other.example'},null).host,undefined);
  console.log('PASS production update wiring: automatic packaged checks, strict local endpoint, refresh-only body, auth/abort, native bridge, no fake browser installation');
})().catch(error=>{console.error(error);process.exitCode=1;});
