/* Controlled promises/timers reproduce slow native reflow without CPU work. */
'use strict';
const assert=require('node:assert/strict');let JSDOM;try{({JSDOM}=require('jsdom'));}catch{({JSDOM}=require('../.cache/mobile-local-spike/node_modules/jsdom'));}
const UI=require('../skills/polish-sci-figures/assets/figure-studio/axis-settings-ui.js');
const nativeSetTimeout=global.setTimeout,nativeClearTimeout=global.clearTimeout,timers=new Map();let timerId=0;
global.setTimeout=callback=>{timers.set(++timerId,callback);return timerId;};global.clearTimeout=id=>timers.delete(id);
const copy=value=>JSON.parse(JSON.stringify(value));
async function flush(){for(let i=0;i<16;i++)await Promise.resolve();}
async function flushTimers(){for(const [id,callback]of [...timers]){timers.delete(id);callback();}await flush();}
function harness(){
 global.document=new JSDOM('<div id="host"></div>').window.document;
 let current={contextKey:'project/A',native:true,engine:true,settings:{},controls:{supported:true,x_range:true,y_range:true,log_scale:true}};
 const calls=[],resets=[];
 const api=UI.mount(document.getElementById('host'),{language:'en',getContext:()=>current,onApply:(settings,scope)=>new Promise((resolve,reject)=>calls.push({settings:copy(settings),scope,resolve,reject})),onReset:async input=>{resets.push(input);current={...current,settings:{}};}});
 api.open({axis:'y'});const field=key=>api.element.querySelector('[data-axis-field="'+key+'"]'),button=text=>[...api.element.querySelectorAll('button')].find(node=>node.textContent===text),live=api.element.querySelector('.axis-settings-live input'),status=()=>api.element.querySelector('[role=status]').textContent;
 const change=value=>{field('min').value=String(value);field('min').onchange();};
 return {api,calls,resets,field,button,live,status,change,set(value){current={...current,...value};}};
}
(async()=>{
 const latest=harness();latest.live.checked=false;latest.change(1);latest.button('Apply').click();assert.equal(latest.calls.length,1);assert.equal(latest.button('Apply').disabled,true);assert.equal(latest.button('Reset').disabled,true);
 latest.live.checked=true;latest.change(2);await flushTimers();latest.change(3);await flushTimers();assert.equal(latest.calls.length,1,'a slow request is not duplicated concurrently');
 latest.set({contextKey:'project/B',settings:{y_min:1}});latest.api.refresh();latest.calls[0].resolve({contextKey:'project/B'});await flush();assert.equal(latest.calls.length,2,'the newest live draft is dispatched after the previous request');assert.equal(latest.calls[1].settings.y_min,3,'intermediate draft 2 is coalesced');assert.notEqual(latest.status(),'Axis settings applied.','the first response cannot claim the latest draft is applied');
 latest.set({contextKey:'project/C',settings:{y_min:3}});latest.calls[1].resolve({contextKey:'project/C'});await flush();assert.equal(latest.status(),'Axis settings applied.');latest.api.destroy();

 const manual=harness();manual.live.checked=false;manual.change(1);manual.button('Apply').click();manual.change(2);manual.button('Apply').click();assert.equal(manual.calls.length,1,'manual Apply is explicitly disabled while busy');manual.set({settings:{y_min:1}});manual.calls[0].resolve();await flush();assert.equal(manual.calls.length,1,'live-off edits require a new explicit Apply');assert.match(manual.status(),/newer edits are pending/);assert.equal(manual.field('min').value,'2');assert.equal(manual.button('Apply').disabled,false);manual.button('Apply').click();assert.equal(manual.calls[1].settings.y_min,2);manual.set({settings:{y_min:2}});manual.calls[1].resolve();await flush();assert.equal(manual.status(),'Axis settings applied.');manual.api.destroy();

 const switched=harness();switched.live.checked=false;switched.change(1);switched.button('Apply').click();switched.live.checked=true;switched.change(2);await flushTimers();switched.set({contextKey:'different-project/panel-0',settings:{y_min:9}});switched.api.refresh();switched.calls[0].resolve({contextKey:'project/A'});await flush();assert.equal(switched.calls.length,1,'a stale queued draft cannot transfer to a different project/selection');assert.equal(switched.field('min').value,'9');assert.equal(switched.status(),'');switched.api.destroy();

 const reopened=harness();reopened.live.checked=false;reopened.change(1);reopened.button('Apply').click();reopened.api.close();reopened.set({contextKey:'project/new-selection',settings:{y_min:7}});reopened.api.open({axis:'y'});reopened.button('Reset').click();assert.equal(reopened.resets.length,0,'reset is explicitly disabled during a pending request');reopened.calls[0].resolve({contextKey:'project/A'});await flush();assert.equal(reopened.field('min').value,'7');assert.equal(reopened.status(),'','an old response cannot overwrite a reopened panel status');reopened.button('Reset').click();await flush();assert.equal(reopened.resets.length,1);assert.equal(reopened.field('min').value,'');reopened.api.destroy();
 console.log('PASS slow axis reflow: latest live draft wins, intermediate edits coalesce, manual busy Apply/reset disabled, live-off edits remain pending, project/selection/close guards prevent stale UI pollution.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.setTimeout=nativeSetTimeout;global.clearTimeout=nativeClearTimeout;});
