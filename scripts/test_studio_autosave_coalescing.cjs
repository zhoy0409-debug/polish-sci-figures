/* Production autosave scheduler with a deliberately stalled IndexedDB adapter.
 * These are ordering/snapshot tests, not native disk or browser frame-rate tests. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8');
const start=source.indexOf('  let autosaveQueue='),end=source.indexOf('  let pointerEditCommit=',start);assert.ok(start>=0&&end>start);
const clone=value=>JSON.parse(JSON.stringify(value)),pause=()=>new Promise(resolve=>setTimeout(resolve,2));
function makeHistory(value=0){const states=Array.from({length:81},(_,i)=>Object.freeze({value:i===80?value:i,panels:{p:{variant:0,edits:{0:{e1:{text:'Editable '+i}}}}}}));return {states,index:80,get current(){return this.states[this.index];},toJSON(){return {states:this.states,index:this.index};}};}
function fixture({raf=true,storageThrows=false}={}){
 const store=new Map(),calls=[],committed=new Map(),events=[],classes=new Set();let text='',serialized=0,collected=0;const status={classList:{add:v=>classes.add(v),remove:v=>classes.delete(v)},get textContent(){return text;},set textContent(v){text=v;events.push(v);}};
 const timers=new Map(),frames=[];let clock=0,timerId=0;
 // Run frame callbacks, a paint opportunity, then ready timer tasks explicitly.
 // The fallback still advances48ms when frames are unavailable; host CPU load
 // cannot make that fallback overtake a queued synthetic animation frame.
 async function turn(){await new Promise(resolve=>setImmediate(resolve));if(frames.length){clock+=16;for(const callback of frames.splice(0))callback(clock);events.push('paint');}else if(timers.size)clock=Math.max(clock,Math.min(...[...timers.values()].map(timer=>timer.due)));for(const [id,timer]of [...timers])if(timer.due<=clock&&timers.has(id)){timers.delete(id);timer.callback();}await new Promise(resolve=>setImmediate(resolve));}
 const ctx={project:{id:'A',panels:[{id:'p',variants:[{svg:'<svg><text>Editable vector</text></svg>'}]}]},history:makeHistory(),checkpoints:[{name:'Before',state:{value:-1}}],dataDrafts:{p:[['group','value'],['A','1']]},knownCache:null,localSavedCurrent:'',desktopSession:true,wbDraftVersion:0,wbWorkspace:null,restoredWBDraft:null,libraryIds:new Set(),$:()=>status,T:v=>v,
   setTimeout(callback,delay=0){const id=++timerId;timers.set(id,{callback,due:clock+delay});return id;},clearTimeout:id=>timers.delete(id),
   requestAnimationFrame:raf?callback=>frames.push(callback):undefined,
   JSON:{parse:JSON.parse,stringify(...args){serialized++;return JSON.stringify(...args);}},
   localStorage:{getItem(key){if(storageThrows)throw Error('Storage blocked');return store.get(key)??null;},setItem(key,value){if(storageThrows)throw Error('Storage blocked');store.set(key,value);}},
   currentPayload(){throw Error('Immediate history deep copy must not be used');},copy(){throw Error('Immediate history deep copy must not be used');},collectFigure(){collected++;},
   StudioLibrary:{put(storeName,record){assert.equal(storeName,'autosaves');events.push('write '+record.id);const saved=clone(record);let resolve,reject;const done=new Promise((yes,no)=>{resolve=yes;reject=no;});calls.push({record:saved,resolve:()=>{committed.set(record.id,saved);resolve();},reject});return done;}}
 };
 ctx.state=()=>ctx.history.current;vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nglobalThis.queue=()=>autosaveQueue;',ctx);
 return {ctx,store,calls,committed,events,classes,status,get serialized(){return serialized;},get collected(){return collected;},
   edit(value){const h=ctx.history;h.states=[...h.states.slice(-80),Object.freeze({value,panels:{p:{variant:0,edits:{0:{e1:{text:'Editable '+value}}}}}})];h.index=h.states.length-1;},
   switchProject(id,value=0){ctx.project={id,panels:[{id:'p',variants:[{svg:'<svg><text>'+id+'</text></svg>'}]}]};ctx.history=makeHistory(value);ctx.checkpoints=[];ctx.dataDrafts={};ctx.knownCache=store.get('figure-studio:'+id)??null;ctx.localSavedCurrent='';},
   async waitCalls(count){for(let i=0;i<100&&calls.length<count;i++)await turn();assert.equal(calls.length,count);},
   async idle(){let done=false;ctx.queue().then(()=>{done=true;});for(let i=0;i<100&&!done;i++)await turn();assert.equal(done,true,'the complete autosave queue must settle');},async settle(){let released=0;for(let i=0;i<100;i++){while(released<calls.length)calls[released++].resolve();await turn();if(released===calls.length){let done=false;ctx.queue().then(()=>{done=true;});await turn();if(done)return;}}throw Error('Autosave queue did not settle');}
 };
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
 await test('100 immediate edits do no serialization/deep copies and write only the newest full undo snapshot after paint',async()=>{
   const h=fixture(),initialProject=clone(h.ctx.project);for(let i=1;i<=100;i++){h.edit(i);assert.equal(h.ctx.persist(),true);}assert.equal(h.serialized,0);assert.equal(h.calls.length,0);assert.equal(h.status.textContent,'正在保存…');await h.waitCalls(1);const {payload}=h.calls[0].record;assert.equal(payload.state.value,100);assert.equal(payload.history.states.length,81);assert.deepEqual(payload.history.states[payload.history.index],payload.state);assert.ok(h.events.indexOf('paint')<h.events.indexOf('write A'));assert.deepEqual(payload.project,initialProject);assert.equal(payload.project.panels[0].variants[0].svg,initialProject.panels[0].variants[0].svg);h.calls[0].resolve();await h.idle();assert.equal(h.calls.length,1);assert.equal(h.status.textContent,'已自动保存 · 含撤销记录');assert.equal(h.ctx.localSavedCurrent,JSON.stringify({state:payload.state,checkpoints:payload.checkpoints,dataDrafts:payload.dataDrafts,wbDraftVersion:0,imageReview:null}));assert.equal(h.store.get('figure-studio:desktop-last-project'),'A');
 });
 await test('an in-flight write plus rapid edits keeps one successor and cannot mark older content as saved',async()=>{
   const h=fixture();h.edit(1);h.ctx.persist();await h.waitCalls(1);for(let i=2;i<=50;i++){h.edit(i);h.ctx.persist();}h.calls[0].resolve();await h.waitCalls(2);assert.equal(h.store.has('figure-studio:A'),false);assert.equal(h.status.textContent,'正在保存…');assert.equal(h.calls[1].record.payload.state.value,50);let flushed=false;h.ctx.queue().then(()=>{flushed=true;});await pause();assert.equal(flushed,false);h.calls[1].resolve();await h.idle();assert.equal(h.calls.length,2);assert.equal(h.committed.get('A').payload.state.value,50);assert.ok(h.store.has('figure-studio:A'));assert.equal(flushed,true);
 });
 await test('switching projects retains the prior project recovery marker and never changes the new project status or signature',async()=>{
   const h=fixture();h.edit(5);h.ctx.persist();await h.waitCalls(1);h.switchProject('B',20);h.ctx.persist();h.calls[0].resolve();await h.waitCalls(2);assert.ok(h.store.has('figure-studio:A'));assert.equal(h.ctx.knownCache,null);assert.equal(h.ctx.localSavedCurrent,'');assert.equal(h.store.has('figure-studio:desktop-last-project'),false);assert.equal(h.status.textContent,'正在保存…');h.calls[1].resolve();await h.idle();assert.equal(h.committed.get('A').payload.state.value,5);assert.equal(h.committed.get('B').payload.state.value,20);assert.equal(h.store.get('figure-studio:desktop-last-project'),'B');assert.equal(h.ctx.knownCache,h.store.get('figure-studio:B'));
 });
 await test('reopening the same project id replaces queued stale ownership and leaves the reopened undo history intact',async()=>{
   const h=fixture();h.edit(10);h.ctx.persist();await h.waitCalls(1);h.switchProject('A',40);h.ctx.knownCache=undefined;h.ctx.persist();h.calls[0].resolve();await h.waitCalls(2);assert.equal(h.ctx.localSavedCurrent,'');assert.equal(h.calls[1].record.payload.state.value,40);h.calls[1].resolve();await h.idle();assert.equal(h.committed.get('A').payload.history.states.at(-1).value,40);assert.equal(h.status.textContent,'已自动保存 · 含撤销记录');
 });
 await test('queued snapshots retain replaced draft tables, checkpoint arrays, review records and assets',async()=>{
   const h=fixture(),draft=h.ctx.dataDrafts.p,review={createdAt:'one',updatedAt:'two',reviews:{x:'old'}};h.ctx.project.imageDuplicateReview=review;h.ctx.persist();h.ctx.dataDrafts.p=[['group','value'],['A','99']];h.ctx.checkpoints.push({name:'Later',state:{value:99}});h.ctx.project.panels.push({id:'later',variants:[]});h.ctx.project.imageDuplicateReview={createdAt:'new',updatedAt:'new',reviews:{}};h.switchProject('B',1);await h.waitCalls(1);const {payload}=h.calls[0].record;assert.deepEqual(payload.dataDrafts.p,draft);assert.equal(payload.checkpoints.length,1);assert.equal(payload.project.panels.length,1);assert.deepEqual(payload.project.imageDuplicateReview,review);h.calls[0].resolve();await h.idle();assert.equal(h.ctx.localSavedCurrent,'');assert.ok(h.store.has('figure-studio:A'));
 });
 await test('localStorage conflicts block immediate and already queued writes without declaring data saved',async()=>{
   const h=fixture();h.store.set('figure-studio:A','another-window');assert.equal(h.ctx.persist(),false);assert.equal(h.calls.length,0);assert.equal(h.ctx.localSavedCurrent,'');assert.equal(h.status.textContent,'其他窗口已更新 · 请先下载当前工程');h.ctx.knownCache='another-window';assert.equal(h.ctx.persist(),true);h.store.set('figure-studio:A','updated-again');await h.idle();assert.equal(h.calls.length,0);assert.equal(h.status.textContent,'其他窗口已更新 · 请先下载当前工程');assert.equal(h.store.get('figure-studio:A'),'updated-again');
 });
 await test('a marker changed during slow storage is not overwritten by a stale completion',async()=>{
   const h=fixture();h.ctx.persist();await h.waitCalls(1);h.store.set('figure-studio:A','newer-window');h.calls[0].resolve();await h.idle();assert.equal(h.store.get('figure-studio:A'),'newer-window');assert.equal(h.ctx.knownCache,null);assert.equal(h.ctx.localSavedCurrent,'');assert.equal(h.status.textContent,'其他窗口已更新 · 请先下载当前工程');
 });
 await test('stale failures cannot replace a newer saving status; latest failures stay unsaved and can retry',async()=>{
   const h=fixture();h.ctx.persist();await h.waitCalls(1);h.edit(7);h.ctx.persist();h.calls[0].reject(Error('Slow storage failed'));await h.waitCalls(2);assert.equal(h.status.textContent,'正在保存…');assert.equal(h.classes.has('unsaved'),false);h.calls[1].reject(Error('Quota'));await h.idle();assert.equal(h.status.textContent,'自动保存失败 · 请下载工程');assert.equal(h.classes.has('unsaved'),true);h.ctx.persist();await h.waitCalls(3);h.calls[2].resolve();await h.idle();assert.equal(h.status.textContent,'已自动保存 · 含撤销记录');assert.equal(h.classes.has('unsaved'),false);
 });
 await test('a failed old project cannot dirty the current project and later projects continue saving',async()=>{
   const h=fixture();h.ctx.persist();await h.waitCalls(1);h.switchProject('B',12);h.ctx.persist();h.calls[0].reject(Error('A failed'));await h.waitCalls(2);assert.equal(h.status.textContent,'正在保存…');assert.equal(h.classes.has('unsaved'),false);h.calls[1].resolve();await h.idle();assert.equal(h.committed.get('B').payload.state.value,12);assert.equal(h.status.textContent,'已自动保存 · 含撤销记录');
 });
 await test('hidden-window fallback and blocked localStorage still flush IndexedDB; collected projects update only after latest success',async()=>{
   const h=fixture({raf:false,storageThrows:true});h.ctx.libraryIds.add('A');h.ctx.persist();await h.waitCalls(1);assert.equal(h.collected,0);h.calls[0].resolve();await h.idle();assert.equal(h.collected,1);assert.equal(h.committed.get('A').payload.history.states.length,81);assert.equal(h.status.textContent,'已自动保存 · 含撤销记录');
 });
 await test('WB draft snapshots are retained and an older draft completion cannot mark newer parameters saved',async()=>{
   const h=fixture();let draft={model:{lanes:['Control']}};h.ctx.wbWorkspace={snapshot:()=>clone(draft)};h.ctx.wbDraftVersion=1;h.ctx.persist();await h.waitCalls(1);draft.model.lanes[0]='Treatment';h.ctx.wbDraftVersion=2;h.calls[0].resolve();await h.idle();assert.equal(h.ctx.localSavedCurrent,'');assert.equal(h.calls[0].record.payload.wbDraft.model.lanes[0],'Control');h.ctx.persist();await h.waitCalls(2);assert.equal(h.calls[1].record.payload.wbDraft.model.lanes[0],'Treatment');assert.equal(h.calls[1].record.payload.wbDraftVersion,2);h.calls[1].resolve();await h.idle();assert.equal(JSON.parse(h.ctx.localSavedCurrent).wbDraftVersion,2);
 });
 console.log('PASS '+passed+' production autosave snapshot/coalescing/ordering checks');
})().catch(error=>{console.error(error);process.exitCode=1;});
