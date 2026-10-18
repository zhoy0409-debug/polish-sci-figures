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
test('1001 confirmed byte ratios conserve ten-heart progress with at most one partial vessel',()=>{
  for(let received=0;received<=1000;received++){
    const view=Scene.presentation({installation:{status:'downloading',received,total:1000}}),hearts=Scene.heartProgress(view);
    assert.equal(hearts.mode,'known');assert.equal(hearts.levels.length,10);
    assert.ok(hearts.levels.every(level=>Number.isFinite(level)&&level>=0&&level<=1));
    assert.ok(Math.abs(hearts.levels.reduce((sum,level)=>sum+level,0)-received/100)<1e-10,'confirmed bytes determine total vessel heights');
    assert.ok(hearts.levels.every((level,index)=>index===0||hearts.levels[index-1]>=level),'fill order stays left to right');
    assert.ok(hearts.levels.filter(level=>level>0&&level<1).length<=1);
    assert.equal(hearts.levels.filter(level=>level===1).length,Math.floor(received/100));
    assert.equal(view.ready,false,'even all downloaded bytes cannot grant installation permission');
  }
  assert.deepEqual(Scene.heartProgress(Scene.presentation({installation:{status:'downloading',received:370,total:1000}})).levels.map(value=>Math.round(value*10)),[10,10,10,7,0,0,0,0,0,0]);
  assert.deepEqual(Scene.heartProgress(Scene.presentation({installation:{status:'ready'}})).levels,Array(10).fill(1));
});
test('unknown, disconnected, invalid and unrelated stages never invent filled hearts',()=>{
  for(const status of ['checking','downloading']){
    const view=Scene.presentation({installation:{status,received:520,total:0}}),hearts=Scene.heartProgress(view);
    assert.equal(hearts.mode,'unknown');assert.deepEqual(hearts.levels,Array(10).fill(0));
  }
  for(const status of ['idle','preparing','installing','error','cancelled','unsupported'])assert.deepEqual(Scene.heartProgress(Scene.presentation({installation:{status,received:100,total:100}})),{mode:'inactive',levels:Array(10).fill(0)});
  const paused=Scene.presentation({installation:{status:'downloading',received:52,total:100},confirmedInstallation:{status:'downloading',received:52,total:100},connectionLost:true});
  assert.equal(paused.ratio,.52);assert.deepEqual(Scene.heartProgress(paused),{mode:'inactive',levels:Array(10).fill(0)});
  for(const ratio of [NaN,Infinity,-Infinity,-.01,1.01,'0.5',null,undefined])assert.deepEqual(Scene.heartProgress({state:'downloading',determinate:true,ratio}),{mode:'inactive',levels:Array(10).fill(0)});
  assert.deepEqual(Scene.heartProgress({state:'downloading',determinate:true,ratio:.5,invalid:true}),{mode:'inactive',levels:Array(10).fill(0)});
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
test('the original small ink cat geometry is preserved and its dog companion stays equally simple',()=>{
  const f=fixture(),container=f.doc.createElement('div'),ui=Scene.create({document:f.doc,container});f.doc.body.append(container);
  const cat=container.querySelector('.mascot-cat'),dog=container.querySelector('.mascot-dog');
  assert.ok(cat.querySelector('.mascot-cat-head'));assert.ok(dog.querySelector('.mascot-dog-head'));
  assert.ok(cat.querySelector('.mascot-cat-hop'));assert.ok(dog.querySelector('.mascot-dog-hop'));
  // These are the actual ef27dbe small-cat coordinates. Reclassifying its
  // groups for scoped animation must not redesign the familiar silhouette.
  const originalPaths=['M75 48C88 55 93 47 89 40','M22 25 20 9Q20 3 26 8L37 17Q48 13 59 17L72 8Q78 3 77 12L75 29Q86 40 79 52Q74 61 48 61Q22 61 17 52Q10 39 22 25Z','m25 12 2 12 8-5Zm47 0-9 8 9 4Z','m45 44 2 2 2-2M47 46v3'];
  const catPaths=[...cat.querySelectorAll('path')].map(node=>node.getAttribute('d'));
  for(const value of originalPaths)assert.ok(catPaths.includes(value),'retained original cat path: '+value);
  assert.deepEqual([...cat.querySelectorAll('.mascot-cat-eyes ellipse,ellipse.mascot-cat-eyes')].map(node=>['cx','cy','rx','ry'].map(name=>node.getAttribute(name))),[['36','36','2.8','4.2'],['57','36','2.8','4.2']]);
  assert.notEqual(dog.querySelector('.mascot-dog-head').innerHTML,cat.querySelector('.mascot-cat-head').innerHTML,'the dog must have a distinct ear/muzzle silhouette');
  assert.ok(dog.querySelector('.mascot-dog-tail'));assert.ok(dog.querySelector('.mascot-dog-eyes'));
  assert.equal(dog.querySelectorAll('.mascot-dog-ear').length,2);assert.ok(dog.querySelector('.mascot-dog-muzzle'));
  assert.equal(dog.querySelectorAll('.mascot-dog-eyes ellipse,ellipse.mascot-dog-eyes').length,2);
  assert.ok(dog.querySelectorAll('path').length>=4&&dog.querySelectorAll('path').length<=14,'a compact local vector dog, without the old layered fur anatomy');
  const artwork=container.querySelector('.update-companion');
  assert.equal(artwork.querySelectorAll('image,script,foreignObject,animate,linearGradient,radialGradient,filter,.mascot-paw-work,.mascot-paw-greet').length,0);
  assert.ok(artwork.querySelectorAll('path').length<=35,'the original cat/dog composition remains a small flat illustration');
  for(const node of container.querySelectorAll('[id]'))assert.match(node.id,/^fs-update-/);
  assert.equal(container.getAttribute('aria-hidden'),'true');ui.destroy();f.dom.window.close();
});
test('repeated and concurrent scenes keep local SVG definitions unique and remove them on destruction',()=>{
  const f=fixture(),seen=new Set(),instances=[];
  try{
    for(let index=0;index<4;index++){
      const container=f.doc.createElement('div');f.doc.body.append(container);const ui=Scene.create({document:f.doc,container});instances.push({container,ui});
      ui.setActive(true);ui.refresh(Scene.presentation({installation:{status:'downloading',received:52,total:100}}));
      const ids=[...container.querySelectorAll('.update-heart-row [id]')];assert.ok(ids.length>0);
      for(const node of ids){assert.ok(!seen.has(node.id));seen.add(node.id);assert.equal(f.doc.getElementById(node.id),node);}
      assert.equal(container.querySelectorAll('.update-heart').length,10);assert.equal(container.querySelector('.update-heart-row').getAttribute('aria-hidden'),'true');
      for(const node of container.querySelectorAll('.update-heart [fill],.update-heart [stroke],.update-heart [clip-path]'))for(const name of ['fill','stroke','clip-path']){
        const value=node.getAttribute(name)||'';if(!value.startsWith('url('))continue;
        assert.match(value,/^url\(#[A-Za-z0-9-]+\)$/);assert.ok(node.closest('svg').querySelector('[id="'+value.slice(5,-1)+'"]'),'every definition belongs to its own heart SVG');
      }
      if(index===1){const first=instances[0];first.ui.destroy();assert.equal(first.container.children.length,0);first.ui.refresh(Scene.presentation({installation:{status:'ready'}}));assert.equal(first.container.children.length,0,'destroyed scenes cannot recreate hearts');}
    }
    const ids=[...f.doc.querySelectorAll('.update-heart-row [id]')].map(node=>node.id);assert.equal(new Set(ids).size,ids.length);
  }finally{for(const {ui,container} of instances){ui.destroy();container.remove();}assert.equal(f.doc.querySelectorAll('.update-heart-row').length,0);f.dom.window.close();}
});
test('hidden, closed, reduced motion and explicit motion off all pause; no timer drives the scene',()=>{
  assert.doesNotMatch(fs.readFileSync(path.join(base,'update-scene.js'),'utf8'),/\b(?:setTimeout|setInterval)\s*\(/,'decorative feedback uses CSS and lifecycle events, never a synthetic progress timer');
  const f=fixture(),container=f.doc.createElement('div'),ui=Scene.create({document:f.doc,container});f.doc.body.append(container);
  assert.equal(container.dataset.animation,'off');ui.setActive(true);ui.refresh(Scene.presentation({installation:{status:'downloading',received:13,total:100}}));assert.equal(container.dataset.animation,'on');
  f.reduce(true);assert.equal(container.dataset.animation,'off');ui.refresh(Scene.presentation({installation:{status:'downloading',received:52,total:100}}));assert.equal(container.style.getPropertyValue('--update-progress'),'0.52');
  f.reduce(false);assert.equal(container.dataset.animation,'on');ui.setEnabled(false);assert.equal(container.dataset.animation,'off');ui.setEnabled(true);f.visibility('hidden');assert.equal(container.dataset.animation,'off');f.visibility('visible');assert.equal(container.dataset.animation,'on');
  f.intersection(false);assert.equal(container.dataset.animation,'off');f.intersection(true);assert.equal(container.dataset.animation,'on');
  ui.refresh(Scene.presentation({installation:{status:'ready'}}));assert.equal(container.dataset.celebrate,'true');ui.setActive(false);assert.equal(container.dataset.celebrate,'false');assert.equal(container.dataset.animation,'off');ui.setActive(true);ui.refresh(Scene.presentation({installation:{status:'ready'}}));assert.equal(container.dataset.celebrate,'false','reopening cannot endlessly celebrate');
  ui.destroy();assert.equal(f.mediaConnected(),false);f.dom.window.close();
});
test('first closed scene constructs no heart SVG and destruction cannot recreate it',()=>{
  const f=fixture(),container=f.doc.createElement('div'),create=f.doc.createElementNS.bind(f.doc);let created=0;f.doc.createElementNS=(...args)=>{created++;return create(...args);};f.doc.body.append(container);
  const ui=Scene.create({document:f.doc,container});try{const companion=container.querySelector('.update-companion').innerHTML;for(let index=0;index<50;index++)ui.refresh(Scene.presentation({installation:{status:'downloading',received:index,total:100}}));assert.equal(created,0);assert.equal(container.querySelectorAll('.update-heart-row,.update-heart,defs [id]').length,0);assert.equal(container.querySelector('.update-companion').innerHTML,companion);ui.destroy();ui.setActive(true);assert.equal(created,0);assert.equal(container.children.length,0);}finally{ui.destroy();container.remove();f.dom.window.close();}
});
test('closed refresh never writes cached heart nodes; eight reopenings reuse IDs and show the latest view',()=>{
  const f=fixture(),container=f.doc.createElement('div');f.doc.body.append(container);const ui=Scene.create({document:f.doc,container});
  const cases=[[{status:'downloading',received:0,total:0},Array(10).fill(0)],[{status:'downloading',received:37,total:100},[1,1,1,.7,0,0,0,0,0,0]],[{status:'downloading',received:99,total:100},[1,1,1,1,1,1,1,1,1,.9]],[{status:'ready'},Array(10).fill(1)]];
  try{ui.setActive(true);ui.refresh(Scene.presentation({installation:cases[0][0]}));const row=container.querySelector('.update-heart-row'),ids=[...row.querySelectorAll('[id]')].map(n=>n.id),observer=new f.dom.window.MutationObserver(()=>{});assert.equal(ids.length,70);const companion=container.querySelector('.update-companion').innerHTML;
    for(let index=0;index<8;index++){const[input,expected]=cases[index%4];ui.setActive(false);assert.equal(container.querySelectorAll('.update-heart-row,defs [id]').length,0);for(const id of ids)assert.equal(f.doc.getElementById(id),null);observer.observe(row,{subtree:true,attributes:true,childList:true});ui.refresh(Scene.presentation({installation:input}));assert.equal(observer.takeRecords().length,0,'closed refresh must not write even detached heart attributes');observer.disconnect();ui.setActive(true);ui.refresh(Scene.presentation({installation:input}));assert.equal(container.querySelector('.update-heart-row'),row);assert.deepEqual([...row.querySelectorAll('[id]')].map(n=>n.id),ids);assert.equal(new Set(ids).size,70);[...row.querySelectorAll('.update-heart')].forEach((n,i)=>assert.ok(Math.abs(Number(n.dataset.level)-expected[i])<1e-12));assert.equal(container.querySelector('.update-companion').innerHTML,companion);}
    ui.destroy();assert.equal(f.doc.querySelectorAll('.update-heart-row,.update-companion').length,0);ui.setActive(true);assert.equal(container.children.length,0);
  }finally{ui.destroy();container.remove();f.dom.window.close();}
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
  const closing=fixture();let current={status:'checking',supported:true},pending=false,resolveStatus;
  const live=Updates.create({document:closing.doc,container:closing.doc.querySelector('header'),storage:closing.storage,language:()=> 'en',info,check:async()=>available,installPollMs:100000,installUpdate:async()=>pending?new Promise(resolve=>{resolveStatus=resolve;}):current}),find=selector=>live.dialog.querySelector(selector);
  try{
    live.open();await live.check();await tick();const row=find('.update-heart-row'),ids=[...row.querySelectorAll('[id]')].map(n=>n.id);
    for(const [input,expected]of[[{status:'downloading',supported:true,received:0,total:0},Array(10).fill(0)],[{status:'downloading',supported:true,received:37,total:100},[1,1,1,.7,0,0,0,0,0,0]],[{status:'downloading',supported:true,received:99,total:100},[1,1,1,1,1,1,1,1,1,.9]],[{status:'ready',supported:true},Array(10).fill(1)]]){
      pending=true;live.open();await tick();assert.equal(typeof resolveStatus,'function');live.close();assert.equal(find('.update-heart-row'),null);const observer=new closing.dom.window.MutationObserver(()=>{});observer.observe(row,{subtree:true,attributes:true,childList:true});current=input;pending=false;resolveStatus(input);resolveStatus=null;await tick();assert.equal(find('.update-heart-row'),null);assert.equal(observer.takeRecords().length,0);observer.disconnect();
      live.open();assert.equal(find('.update-heart-row'),row,'real update-check open reattaches the cached row');assert.deepEqual([...row.querySelectorAll('[id]')].map(n=>n.id),ids);[...row.querySelectorAll('.update-heart')].forEach((n,i)=>assert.ok(Math.abs(Number(n.dataset.level)-expected[i])<1e-12,'latest confirmed closed response must be displayed synchronously on reopen'));await tick();
    }
    console.log('PASS actual update-check lifecycle fixture: status resolves while closed, detached nodes untouched, reopen synchronously shows latest unknown/37/99/ready view');passed++;
  }finally{live.destroy();closing.dom.window.close();}

  console.log(`${passed} update scene checks passed (controlled fixture, no real download or installation)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
