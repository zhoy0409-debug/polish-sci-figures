'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
function fixture(){
  const button={disabled:false},messages=[],downloads=[];let complete,fail,learned=0;
  const ctx={Blob,project:{id:'previous'},history:{id:1,toJSON:()=>({states:[{text:'before'}],index:0})},savedCurrent:'unsaved',stateValue:{text:'before'},checkpoints:[],dataDrafts:{},copy:v=>JSON.parse(JSON.stringify(v)),state:()=>ctx.stateValue,
    $:()=>button,guard:fn=>fn,T:v=>v,say:v=>messages.push(v),saveSignature:()=>JSON.stringify(ctx.stateValue),learnPreferences:()=>learned++,StudioI18n:{language:'en'},PROJECT_FILE_LIMIT:200000000,
    download:async(blob,name)=>{downloads.push({payload:JSON.parse(await blob.text()),name});return ctx.downloadResult;},
    StudioProjectCodec:{serialize(payload){const snapshot=JSON.stringify(payload);return new Promise((resolve,reject)=>{complete=()=>resolve(new Blob([snapshot],{type:'application/json'}));fail=reject;});}}};
  vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function currentPayload('),source.indexOf('  function validatePayload(')),ctx);
  vm.runInContext(source.slice(source.indexOf("  $('save').onclick=guard("),source.indexOf("  $('load').onclick=")),ctx);
  return {ctx,button,messages,downloads,complete:()=>complete(),fail:error=>fail(error),learned:()=>learned};
}
(async()=>{
  let f=fixture(),task=f.button.onclick();assert.equal(f.button.disabled,true);f.ctx.stateValue.text='later';f.complete();await task;
  assert.equal(f.downloads[0].payload.state.text,'before');assert.equal(f.ctx.savedCurrent,JSON.stringify({text:'before'}));assert.notEqual(f.ctx.savedCurrent,f.ctx.saveSignature());assert.equal(f.learned(),0);assert.match(f.messages.at(-1),/之后的修改/);assert.equal(f.button.disabled,false);
  f=fixture();task=f.button.onclick();f.ctx.project={id:'new-project'};f.ctx.history={id:2};f.complete();await task;assert.equal(f.ctx.savedCurrent,'unsaved');assert.equal(f.learned(),0);assert.match(f.messages.at(-1),/当前工程未标记/);
  f=fixture();task=f.button.onclick();f.complete();await task;assert.equal(f.ctx.savedCurrent,f.ctx.saveSignature());assert.equal(f.learned(),1);assert.equal(f.button.disabled,false);
  f=fixture();task=f.button.onclick();f.fail(Error('background error'));await assert.rejects(task,/background error/);assert.equal(f.ctx.savedCurrent,'unsaved');assert.equal(f.button.disabled,false);
  f=fixture();f.ctx.downloadResult=false;task=f.button.onclick();f.complete();await task;assert.equal(f.ctx.savedCurrent,'unsaved');assert.equal(f.learned(),0);assert.equal(f.button.disabled,false);
  console.log('PASS production async Save handler: call-time snapshot, later edits remain unsaved, project replacement remains unsaved, failures/cancel retain status and re-enable Save');
})().catch(error=>{console.error(error);process.exitCode=1;});
