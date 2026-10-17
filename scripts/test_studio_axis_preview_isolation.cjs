/* Actual axis UI + shared PreviewSessions + History isolation. The producer is
 * a controlled settings fixture, not a scientific renderer or browser proof. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom'),UI=require('../skills/polish-sci-figures/assets/figure-studio/axis-settings-ui.js'),Sessions=require('../skills/polish-sci-figures/assets/figure-studio/preview-sessions.js'),{History}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const copy=x=>JSON.parse(JSON.stringify(x)),nativeSetTimeout=global.setTimeout,nativeClearTimeout=global.clearTimeout,timers=new Map();let timerId=0,passed=0;
global.setTimeout=fn=>{timers.set(++timerId,fn);return timerId;};global.clearTimeout=id=>timers.delete(id);
async function microtasks(){for(let i=0;i<24;i++)await Promise.resolve();}
async function settle(){for(let turn=0;turn<8;turn++){for(const [id,fn]of [...timers]){timers.delete(id);fn();}await microtasks();if(!timers.size)break;}}
async function test(name,run){await run();passed++;console.log('PASS '+name);}
function fixture(){
 const dom=new JSDOM('<div id="host"></div><svg id="canvas"><text data-key="e1">Original axis</text></svg>');global.document=dom.window.document;
 const canvas=document.getElementById('canvas'),original=canvas.outerHTML,project={id:'isolation-project',panels:[{id:'p',table:{rows:[['group','value'],['A','1.25'],['B','2.5']]},recipe:{family:'gallery'},analysis:{primary_test:{p_value:.032}},variants:[{svg:original}]}]},sourceBefore=JSON.stringify(project),history=new History({panels:{p:{axes:{y_min:0,y_max:10}}}}),initialHistory=JSON.stringify(history.toJSON());
 let selected='key-e1',persisted=0,commitCalls=0,session=null,produced=0;const resets=[];
 const manager=Sessions.create({identity:()=>[project,history.current,selected],requestFrame:fn=>setTimeout(fn,0),cancelFrame:clearTimeout});
 const context=()=>({contextKey:project.id+'/p/0/'+selected,stateRevision:history.current,native:true,engine:true,settings:copy(history.current.panels.p.axes),controls:{supported:true,x_range:true,y_range:true,log_scale:true}});
 function restore(){canvas.removeAttribute('data-axis-preview');}
 function begin(meta){if(session?.isCurrent())return;session=manager.begin({kind:'axis',originalValue:copy(history.current.panels.p.axes),valid:meta.isCurrent,render:value=>canvas.setAttribute('data-axis-preview',JSON.stringify(value)),restore,commit:value=>{commitCalls++;const next=copy(history.current);next.panels.p.axes=copy(value);history.commit(next);persisted++;},equal:(a,b)=>JSON.stringify(a)===JSON.stringify(b)});}
 const api=UI.mount(document.getElementById('host'),{language:'en',getContext:context,onBegin:begin,
  onPreview:async(settings,meta)=>{begin({...meta,isCurrent:meta.isSessionCurrent});return session.request(settings,async value=>{produced++;assert.equal(meta.signal.aborted,false);return copy(value);});},
  onCommit:async(settings,meta)=>{begin({...meta,isCurrent:meta.isSessionCurrent});const ok=await session.request(settings,async value=>copy(value));if(!ok||!meta.isCurrent())return false;return session.commit();},
  onCancel:()=>session?.cancel(),onInvalid:error=>session?.reject(error)});
 api.open({axis:'y'});const field=name=>api.element.querySelector(`[data-axis-field="${name}"]`),button=text=>[...api.element.querySelectorAll('button')].find(node=>node.textContent===text),change=(name,value)=>{field(name).value=String(value);field(name).dispatchEvent(new dom.window.Event('input'));};
 return {api,dom,canvas,history,manager,field,button,change,resets,sourceBefore,initialHistory,project,original,get persisted(){return persisted;},get commitCalls(){return commitCalls;},get produced(){return produced;},switchTarget(){selected='key-e2';manager.sync();api.refresh();},close(){api.destroy();assert.equal(JSON.stringify(project),sourceBefore,'raw rows, source SVG and analysis never change');dom.window.close();}};
}
(async()=>{try{
 await test('three valid previews never commit/persist; one Apply creates one reversible history step',async()=>{
  const f=fixture();for(const value of [1,2,3]){f.change('min',value);await settle();assert.equal(JSON.stringify(f.history.toJSON()),f.initialHistory);assert.equal(f.persisted,0);assert.equal(f.commitCalls,0);assert.equal(JSON.parse(f.canvas.getAttribute('data-axis-preview')).y_min,value);}
  assert.equal(f.produced,3);f.button('Apply').click();await settle();assert.equal(f.history.index,1);assert.equal(f.commitCalls,1);assert.equal(f.persisted,1);assert.equal(f.canvas.hasAttribute('data-axis-preview'),false);assert.equal(f.history.current.panels.p.axes.y_min,3);assert.deepEqual(copy(f.history.undo()).panels.p.axes,{y_min:0,y_max:10});assert.deepEqual(copy(f.history.redo()).panels.p.axes,{y_min:3,y_max:10});f.close();
 });
 await test('invalid and unfinished values retain last-valid canvas and reject shared commit',async()=>{
  const f=fixture();f.change('min',2);await settle();const valid=f.canvas.outerHTML;f.change('min',12);await settle();assert.equal(f.canvas.outerHTML,valid);assert.equal(f.manager.active.status,'error');assert.equal(f.button('Apply').disabled,true);assert.equal(await f.manager.active.commit(),false);assert.equal(f.commitCalls,0);
  const input=f.field('min');input.value='';Object.defineProperty(input,'validity',{configurable:true,value:{valid:false,badInput:true}});input.dispatchEvent(new f.dom.window.Event('input'));await settle();assert.equal(f.canvas.outerHTML,valid);assert.match(f.api.element.querySelector('[role=status]').textContent,/Finish entering/);delete input.validity;f.api.cancel();assert.equal(f.canvas.outerHTML,f.original);assert.equal(JSON.stringify(f.history.toJSON()),f.initialHistory);assert.equal(f.persisted,0);f.close();
 });
 await test('Reset, Cancel and Escape operate on drafts and keep the same input nodes',async()=>{
  const f=fixture(),input=f.field('min');f.button('Reset').click();await settle();assert.equal(f.api.state.draft.y_min,undefined);assert.equal(f.commitCalls,0);assert.equal(f.persisted,0);f.button('Cancel').click();assert.equal(f.field('min'),input);assert.equal(input.value,'0');assert.equal(f.canvas.outerHTML,f.original);
  f.change('min',4);await settle();input.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.canvas.outerHTML,f.original);assert.equal(f.api.isOpen,true);assert.equal(f.persisted,0);assert.equal(JSON.stringify(f.history.toJSON()),f.initialHistory);f.close();
 });
 await test('target changes invalidate a pending preview without exporting or changing history',async()=>{
  const f=fixture();f.change('min',5);f.switchTarget();await settle();assert.equal(f.canvas.outerHTML,f.original);assert.equal(f.persisted,0);assert.equal(f.commitCalls,0);assert.equal(JSON.stringify(f.history.toJSON()),f.initialHistory);assert.equal(f.api.state.dirty,false);f.close();
 });
 console.log(`PASS ${passed} axis UI/shared-session/history isolation regressions`);
}finally{global.setTimeout=nativeSetTimeout;global.clearTimeout=nativeClearTimeout;}})().catch(error=>{console.error(error);process.exitCode=1;});
