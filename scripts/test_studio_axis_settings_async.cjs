/* Controlled requests prove latest-only preview without rendering or CPU work. */
'use strict';
const assert=require('node:assert/strict');let JSDOM;try{({JSDOM}=require('jsdom'));}catch{({JSDOM}=require('../.cache/mobile-local-spike/node_modules/jsdom'));}
const UI=require('../skills/polish-sci-figures/assets/figure-studio/axis-settings-ui.js');
const nativeSetTimeout=global.setTimeout,nativeClearTimeout=global.clearTimeout,timers=new Map();let timerId=0;
global.setTimeout=callback=>{timers.set(++timerId,callback);return timerId;};global.clearTimeout=id=>timers.delete(id);
const copy=value=>JSON.parse(JSON.stringify(value));
async function flush(){for(let i=0;i<16;i++)await Promise.resolve();}
async function flushTimers(){for(const [id,callback]of [...timers]){timers.delete(id);callback();}await flush();}
function harness(){
 const dom=new JSDOM('<div id="host"></div>');global.document=dom.window.document;
 let current={contextKey:'project/A/panel/0/key-e1',stateRevision:0,native:true,engine:true,settings:{},controls:{supported:true,x_range:true,y_range:true,log_scale:true}},language='en';
 const previews=[],commits=[],cancels=[],begins=[];let visual='original';
 const api=UI.mount(document.getElementById('host'),{language:()=>language,getContext:()=>current,onBegin:meta=>begins.push(meta),
  onPreview:(settings,meta)=>new Promise((resolve,reject)=>previews.push({settings:copy(settings),meta,resolve(){if(meta.isCurrent())visual=JSON.stringify(settings);resolve();},reject})),
  onCommit:(settings,meta)=>new Promise((resolve,reject)=>commits.push({settings:copy(settings),meta,resolve(){if(meta.isCurrent()){current={...current,stateRevision:current.stateRevision+1,settings:copy(settings)};visual=JSON.stringify(settings);}resolve({contextKey:current.contextKey});},reject})),
  onCancel:meta=>{cancels.push(meta);visual=JSON.stringify(current.settings);}});
 api.open({axis:'y'});const field=key=>api.element.querySelector('[data-axis-field="'+key+'"]'),button=text=>[...api.element.querySelectorAll('button')].find(node=>node.textContent===text),live=api.element.querySelector('.axis-settings-live input'),status=()=>api.element.querySelector('[role=status]').textContent;
 const change=value=>{field('min').value=String(value);field('min').dispatchEvent(new dom.window.Event('input'));};
 return {api,dom,previews,commits,cancels,begins,field,button,live,status,change,visual:()=>visual,set(value){current={...current,...value};},setLanguage(value){language=value;},close(){api.destroy();dom.window.close();}};
}
(async()=>{
 const latest=harness();assert.equal(latest.begins.length,1,'opening captures the baseline before any input');latest.change(1);await flushTimers();latest.change(2);assert.equal(latest.previews[0].meta.signal.aborted,true,'new input aborts an old request before the debounce');latest.change(3);await flushTimers();assert.equal(latest.previews.length,2,'intermediate draft 2 is coalesced');assert.equal(latest.previews[1].settings.y_min,3);assert.equal(latest.begins[0].isCurrent(),true,'session validity survives newer draft revisions');
 latest.previews[1].resolve();await flush();const visible=latest.visual();latest.previews[0].resolve();await flush();assert.equal(latest.visual(),visible,'a late old response cannot replace the latest preview');assert.equal(latest.commits.length,0);assert.match(latest.status(),/not applied/);latest.button('Apply').click();latest.button('Apply').click();assert.equal(latest.commits.length,1,'only one explicit commit is dispatched');latest.commits[0].resolve();await flush();assert.equal(latest.status(),'Axis settings applied.');assert.equal(latest.api.state.dirty,false);latest.close();

 const invalid=harness();invalid.change(1);await flushTimers();invalid.previews[0].resolve();await flush();const lastValid=invalid.visual();invalid.change(40);invalid.field('max').value='10';invalid.field('max').dispatchEvent(new invalid.dom.window.Event('input'));await flushTimers();assert.equal(invalid.previews.length,1);assert.equal(invalid.visual(),lastValid);assert.equal(invalid.button('Apply').disabled,true);assert.match(invalid.status(),/Minimum must be less/);invalid.close();

 const manual=harness();manual.live.checked=false;manual.change(1);await flushTimers();assert.equal(manual.previews.length,0,'live-off never previews or auto-commits');assert.equal(manual.commits.length,0);manual.button('Apply').click();assert.equal(manual.commits.length,1);assert.equal(manual.button('Apply').disabled,true);assert.equal(manual.button('Reset').disabled,true);manual.api.cancel();assert.equal(manual.commits[0].meta.signal.aborted,true);manual.commits[0].resolve();await flush();assert.equal(manual.field('min').value,'');assert.notEqual(manual.status(),'Axis settings applied.','cancelled commit cannot set success');manual.close();

 const switched=harness();switched.change(1);await flushTimers();switched.set({contextKey:'different-project/panel-0/key-e2',settings:{y_min:9}});switched.api.refresh();assert.equal(switched.previews[0].meta.signal.aborted,true);assert.equal(switched.cancels.at(-1).reason,'context-changed');switched.previews[0].resolve();await flush();assert.equal(switched.field('min').value,'9');assert.notEqual(switched.status(),'Preview only; not applied.');switched.close();

 const undo=harness();undo.change(2);await flushTimers();undo.set({stateRevision:1,settings:{y_min:7}});undo.api.refresh();assert.equal(undo.previews[0].meta.isCurrent(),false);undo.previews[0].resolve();await flush();assert.equal(undo.field('min').value,'7');assert.equal(undo.api.state.dirty,false);undo.close();

 const language=harness();language.change(4);const input=language.field('min');input.focus();language.setLanguage('zh');language.api.relocalize();assert.equal(language.field('min'),input);assert.equal(input.value,'4');assert.equal(language.dom.window.document.activeElement,input,'language changes preserve the active input');assert.equal(language.api.state.draft.y_min,4);language.api.close();await flushTimers();assert.equal(language.previews.length,0);language.close();
 console.log('PASS axis async drafts: immediate abort/debounce/latest result, stable session capture, invalid last-valid, manual single commit, cancel/close/selection/state invalidation, language focus retention.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.setTimeout=nativeSetTimeout;global.clearTimeout=nativeClearTimeout;});
