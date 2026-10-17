'use strict';
// Component fixture only. No releases are fetched and no installer is started.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),Scene=require(path.join(base,'update-scene.js')),Updates=require(path.join(base,'update-check.js'));
const info={currentVersion:'0.1.20',platform:'windows',architecture:'x86_64',channel:'stable',inAppInstall:true};
const available={...info,status:'update-available',latestVersion:'0.1.21',downloadUrl:'https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.21/polish-sci-figures-Studio-0.1.21-Setup-x64.exe'};
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
test('all scene states derive from confirmed protocol and connection state',()=>{
  for(const [input,state] of [[{},'idle'],[{busy:true},'checking'],[{result:{status:'up-to-date'}},'current'],[{result:{status:'offline'}},'paused'],[{installation:{status:'ready'},connectionLost:true},'paused'],[{installation:{status:'ready'}},'ready'],[{installation:{status:'downloading',received:100,total:100}},'verifying']])assert.equal(Scene.presentation(input).state,state);
  for(const status of ['checking','downloading','preparing','installing','cancelled','error'])assert.equal(Scene.presentation({installation:{status}}).state,status);
  assert.equal(Scene.presentation({installation:{status:'preparing'}}).ready,false);assert.equal(Scene.presentation({installation:{status:'installing'}}).ready,false);
});
test('0, 13, 52, 99 and 100 percent are byte ratios; unknown total cannot manufacture percent',()=>{
  for(const received of [0,13,52,99,100]){const value=Scene.presentation({installation:{status:'downloading',received,total:100}});assert.equal(value.ratio,received/100);assert.equal(value.state,received===100?'verifying':'downloading');assert.equal(value.ready,false);}
  const unknown=Scene.presentation({installation:{status:'downloading',received:52,total:0}});assert.equal(unknown.determinate,false);assert.equal(unknown.indeterminate,true);assert.equal(unknown.ratio,0);
});
test('each explicit download has its own monotonic epoch; regressions do not become fictional max values',()=>{
  let sample=null;for(const received of [0,13,52,99,100])sample=Scene.acceptProgress(sample,{status:'downloading',received,total:100});
  assert.throws(()=>Scene.acceptProgress(sample,{status:'downloading',received:52,total:100}),/backwards/);
  assert.throws(()=>Scene.acceptProgress(sample,{status:'downloading',received:100,total:101}),/size changed/);
  const reset=Scene.acceptProgress(sample,{status:'downloading',received:13,total:200},{newJob:true});assert.deepEqual(reset,{received:13,total:200});assert.deepEqual(sample,{received:100,total:100});
});
test('paused preparation retains only confirmed package progress, never installation progress or an optimistic stage',()=>{
  const optimistic={status:'preparing',received:100,total:100},confirmed={status:'ready',received:100,total:100};
  const view=Scene.presentation({installation:optimistic,confirmedInstallation:confirmed,connectionLost:true});
  assert.equal(view.state,'paused');assert.equal(view.ratio,1);assert.equal(view.confirmedStage,'ready');assert.deepEqual(view.confirmedDownload,{received:100,total:100});
  assert.equal(view.ready,false);assert.equal(view.determinate,false);assert.equal(view.working,true);
  const unknown=Scene.presentation({installation:{status:'checking'},connectionLost:true});assert.equal(unknown.ratio,0);assert.equal(unknown.confirmedStage,null);assert.equal(unknown.confirmedDownload,null);
});
function fixture(){
  const artwork=fs.readFileSync(path.join(base,'mascot-scene.svg'),'utf8'),dom=new JSDOM('<!doctype html><html><head></head><body><header></header><template id="studioUpdateMascotTemplate">'+artwork+'</template></body></html>',{url:'http://127.0.0.1:18767/'}),doc=dom.window.document;
  let visibility='visible',reduce=false,onMediaChange,onIntersection,observed;Object.defineProperty(doc,'visibilityState',{configurable:true,get:()=>visibility});
  dom.window.matchMedia=()=>({get matches(){return reduce;},addEventListener(type,fn){onMediaChange=fn;},removeEventListener(type,fn){if(onMediaChange===fn)onMediaChange=null;}});
  dom.window.IntersectionObserver=class{constructor(fn){onIntersection=fn;}observe(node){observed=node;}disconnect(){onIntersection=null;}};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>memory.set(key,value)};
  return {dom,doc,storage,visibility(value){visibility=value;doc.dispatchEvent(new dom.window.Event('visibilitychange'));},reduce(value){reduce=value;onMediaChange?.();},intersection(value){onIntersection?.([{target:observed,isIntersecting:value}]);},mediaConnected:()=>!!onMediaChange};
}
test('original layered cat and dog are local vectors with distinct rest, work and greeting poses',()=>{
  const f=fixture(),container=f.doc.createElement('div'),ui=Scene.create({document:f.doc,container});f.doc.body.append(container);
  assert.ok(container.querySelector('.mascot-cat .mascot-cat-head'));assert.ok(container.querySelector('.mascot-dog .mascot-dog-head'));
  assert.ok(container.querySelector('.mascot-cat .mascot-paw-work'));assert.ok(container.querySelector('.mascot-dog .mascot-paw-greet'));
  assert.equal(container.querySelectorAll('image,script,foreignObject,animate').length,0);
  for(const node of container.querySelectorAll('[id]'))assert.match(node.id,/^fs-update-/);
  assert.equal(container.getAttribute('aria-hidden'),'true');ui.destroy();f.dom.window.close();
});
test('hidden, closed, reduced motion and explicit motion off all pause; no timer drives the scene',()=>{
  const f=fixture(),container=f.doc.createElement('div'),ui=Scene.create({document:f.doc,container});f.doc.body.append(container);
  assert.equal(container.dataset.animation,'off');ui.setActive(true);ui.refresh(Scene.presentation({installation:{status:'downloading',received:13,total:100}}));assert.equal(container.dataset.animation,'on');
  f.reduce(true);assert.equal(container.dataset.animation,'off');ui.refresh(Scene.presentation({installation:{status:'downloading',received:52,total:100}}));assert.equal(container.style.getPropertyValue('--update-progress'),'0.52');
  f.reduce(false);assert.equal(container.dataset.animation,'on');ui.setEnabled(false);assert.equal(container.dataset.animation,'off');ui.setEnabled(true);f.visibility('hidden');assert.equal(container.dataset.animation,'off');f.visibility('visible');assert.equal(container.dataset.animation,'on');
  f.intersection(false);assert.equal(container.dataset.animation,'off');f.intersection(true);assert.equal(container.dataset.animation,'on');
  ui.refresh(Scene.presentation({installation:{status:'ready'}}));assert.equal(container.dataset.celebrate,'true');ui.setActive(false);assert.equal(container.dataset.celebrate,'false');assert.equal(container.dataset.animation,'off');ui.setActive(true);ui.refresh(Scene.presentation({installation:{status:'ready'}}));assert.equal(container.dataset.celebrate,'false','reopening cannot endlessly celebrate');
  ui.destroy();assert.equal(f.mediaConnected(),false);f.dom.window.close();
});
(async()=>{
  const f=fixture(),tick=()=>new Promise(resolve=>setTimeout(resolve,0));let next={status:'downloading',supported:true,received:0,total:100},calls=[];
  const host={document:f.doc,container:f.doc.querySelector('header'),storage:f.storage,language:()=> 'en',info,check:async()=>available,installPollMs:100000,installUpdate:async action=>{calls.push(action);return next;}};
  const ui=Updates.create(host),q=s=>ui.dialog.querySelector(s),sample=async value=>{next=value;ui.open();await ui.check();await tick();};
  try{
    for(const received of [0,13,52,99,100]){await sample({status:'downloading',supported:true,received,total:100});assert.equal(q('progress').value,received);assert.equal(q('.update-progress-percent').textContent,received+'%');assert.equal(q('#studioInstallUpdate').hidden,true);assert.equal(q('.update-progress-scene').dataset.state,received===100?'verifying':'downloading');}
    await sample({status:'ready',supported:true});assert.equal(q('#studioInstallUpdate').hidden,false);assert.equal(q('#studioInstallUpdate').disabled,true);
    next={status:'downloading',supported:true,received:13,total:200};q('.update-download').click();await tick();assert.equal(q('progress').value,13,'explicit new download resets prior byte history');assert.equal(q('.update-progress-percent').textContent,'6%');
    await sample({status:'downloading',supported:true,received:5,total:200});assert.equal(q('.update-progress-scene').dataset.state,'paused');assert.equal(q('progress').value,13,'the last confirmed sample is preserved, never replaced with fake progress');assert.match(q('.update-error').textContent,/invalid status/);assert.equal(q('#studioInstallUpdate').hidden,true);
    next={status:'downloading',supported:true,received:25,total:0};q('#studioRetryUpdateStatus').click();await tick();assert.equal(q('.update-progress-percent').hidden,true);assert.equal(q('progress').hasAttribute('value'),false);
    next={status:'cancelled',supported:true};q('#studioCancelUpdateDownload').click();await tick();assert.equal(q('.update-progress-scene').dataset.state,'cancelled');assert.equal(q('#studioInstallUpdate').hidden,true);
    q('#studioUpdateMotion').checked=false;q('#studioUpdateMotion').dispatchEvent(new f.dom.window.Event('change'));assert.equal(q('.update-progress-scene').dataset.animation,'off');assert.equal(f.storage.getItem('figure-studio:update-motion'),'off');
    ui.close();assert.equal(q('.update-progress-scene').dataset.animation,'off');
    console.log('PASS component transport fixture: real UI byte captions, verification gate, new epoch, rejected regression, unknown total, cancellation, persistent manual motion control');passed++;
  }finally{ui.destroy();f.dom.window.close();}
  const disconnected=fixture();let response={status:'ready',supported:true,received:100000000,total:100000000},reject=false;
  const controls=Updates.create({document:disconnected.doc,container:disconnected.doc.querySelector('header'),storage:disconnected.storage,language:()=> 'en',info,check:async()=>available,installPollMs:100000,installUpdate:async()=>{if(reject)throw Error('Expected old-service disconnect');return response;}}),node=selector=>controls.dialog.querySelector(selector);
  try{
    controls.open();await controls.check();await tick();
    node('#studioUpdateSaved').checked=true;node('#studioUpdateSaved').dispatchEvent(new disconnected.dom.window.Event('change'));
    reject=true;node('#studioInstallUpdate').click();await tick();
    assert.equal(node('.update-progress-scene').dataset.state,'paused');assert.equal(node('.update-progress-scene').style.getPropertyValue('--update-progress'),'1');
    assert.match(node('.update-progress-caption').textContent,/Last confirmed stage: Ready when you are/);assert.doesNotMatch(node('.update-progress-caption').textContent,/Last confirmed stage: Preparing/,'optimistic request intent is not server confirmation');
    assert.match(node('.update-progress-caption').textContent,/Confirmed download: 100\.0 \/ 100\.0 MB \(package download, not installation progress\)/);
    assert.equal(node('progress').hasAttribute('value'),false);assert.equal(node('.update-progress-percent').hidden,true);assert.equal(node('#studioInstallUpdate').hidden,true);
    reject=false;response={status:'preparing',supported:true,received:100000000,total:100000000};node('#studioRetryUpdateStatus').click();await tick();
    reject=true;controls.open();await controls.check();await tick();
    assert.match(node('.update-progress-caption').textContent,/Last confirmed stage: Preparing to install/);assert.equal(node('.update-progress-scene').style.getPropertyValue('--update-progress'),'1');assert.equal(node('.update-progress-scene').dataset.celebrate,'false');
    assert.equal(node('progress').hasAttribute('value'),false);assert.equal(node('#studioInstallUpdate').hidden,true);
    reject=false;response={status:'error',supported:true};node('#studioRetryUpdateStatus').click();await tick();
    reject=true;node('.update-download').click();await tick();
    assert.equal(node('.update-progress-scene').dataset.state,'paused');assert.equal(node('.update-progress-scene').style.getPropertyValue('--update-progress'),'0');assert.doesNotMatch(node('.update-progress-caption').textContent,/Last confirmed stage|Confirmed download|100\.0/,'a new failed download cannot reuse the old job snapshot');assert.equal(node('#studioInstallUpdate').hidden,true);
    console.log('PASS disconnected preparation fixture: server-confirmed phase/bytes retained, installation remains unknown, optimistic phase excluded, new download resets snapshot');passed++;
  }finally{controls.destroy();disconnected.dom.window.close();}
  console.log(`${passed} update scene checks passed (controlled fixture, no real download or installation)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
