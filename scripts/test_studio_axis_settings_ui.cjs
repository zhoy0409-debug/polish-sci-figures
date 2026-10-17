/* Independent DOM contract for the professional axis editor. Real renderer and
 * integrated browser acceptance are separate tests; this does not simulate data. */
'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
let JSDOM;try{({JSDOM}=require('jsdom'));}catch{({JSDOM}=require('../.cache/mobile-local-spike/node_modules/jsdom'));}
const dom=new JSDOM('<!doctype html><div id="host"></div>');global.document=dom.window.document;
const UI=require('../skills/polish-sci-figures/assets/figure-studio/axis-settings-ui.js');
const calls=[],imported=[],resets=[];let current={native:true,engine:true,locked:false,settings:{x_min:1,x_max:10},controls:{supported:true,x_range:true,y_range:true,log_scale:true,geometry:{plot_width_pt:240,plot_height_pt:160},effective:[{x_min:0,x_max:10,y_min:0,y_max:20}]}};
const api=UI.mount(document.getElementById('host'),{getContext:()=>current,onApply:async(settings,scope)=>calls.push({settings,scope}),onImportedApply:async(value)=>imported.push(value),onReset:async(value)=>resets.push(value),language:()=> 'en'});
const field=name=>api.element.querySelector('[data-axis-field="'+name+'"]'),buttons=()=>[...api.element.querySelectorAll('button')],apply=()=>buttons().find(n=>n.textContent==='Apply'),live=()=>api.element.querySelector('.axis-settings-live input');
function change(name,value){const n=field(name);n.value=String(value);n.dispatchEvent(new dom.window.Event('change'));}
async function flush(){for(let i=0;i<5;i++)await Promise.resolve();}
(async()=>{
  assert.equal(api.element.hidden,true);api.open({axis:'y'});live().checked=false;assert.equal(api.element.hidden,false);
  change('min',-5);change('max',25);change('major_step',5);change('axis_width_pt',1.2);apply().click();await flush();
  assert.equal(calls.length,1);assert.equal(calls[0].settings.y_min,-5);assert.equal(calls[0].settings.x_min,1);assert.equal(calls[0].settings.y_axis_width_pt,1.2);assert.equal(calls[0].settings.x_axis_width_pt,undefined);
  change('major_count',4);apply().click();await flush();assert.equal(calls.length,1);assert.match(api.element.querySelector('[role=status]').textContent,/either a major/);
  change('major_step','');apply().click();await flush();assert.equal(calls.length,2);assert.equal(calls[1].settings.y_major_count,4);
  const select=api.element.querySelector('.axis-settings-row select');select.value='panel';select.dispatchEvent(new dom.window.Event('change'));live().checked=false;change('axis_width_pt',2);apply().click();await flush();
  assert.equal(calls[2].settings.axis_width_pt,2);assert.equal(calls[2].settings.y_min,undefined,'panel style application must not copy X range onto Y');
  current={...current,controls:{...current.controls,x_range:false,log_scale:false}};api.open({axis:'x'});assert.equal(field('min').disabled,true);assert.equal(field('axis_width_pt').disabled,false);assert.equal(field('scale').disabled,true);
  current={...current,locked:true};api.refresh(true);assert.equal(apply().disabled,true);assert.match(api.element.querySelector('.axis-settings-notice').textContent,/locked/);
  current={native:false,engine:false,settings:{},imported:{supported:true,axis:'y',scale:'linear',min:0,max:10}};api.open({axis:'y'});live().checked=false;
  assert.equal(field('min').disabled,false);assert.equal(field('major_step').disabled,true);assert.equal(field('plot_width_pt').disabled,true);
  change('min',-2);change('max',15);apply().click();await flush();assert.equal(imported.length,1);assert.deepEqual(imported[0].extension,{version:1,axis:'y',scale:'linear',min:-2,max:15});
  change('min',1);apply().click();await flush();assert.equal(imported.length,1);assert.match(api.element.querySelector('[role=status]').textContent,/only extend/);
  buttons().find(n=>n.textContent==='Reset').click();await flush();assert.equal(resets.length,1);
  current={native:false,imported:{supported:false}};api.refresh(true);assert.equal(apply().disabled,true);assert.match(api.element.querySelector('.axis-settings-notice').textContent,/no verified/);
  api.close();assert.equal(api.isOpen,false);api.destroy();assert.equal(document.querySelector('[data-axis-settings]'),null);
  console.log('PASS professional axis UI: 4 sections, numeric input, scope-safe appearance, category refusal, log capability, imported extension limits, lock, reset, lifecycle.');
})().catch(error=>{console.error(error);process.exitCode=1;});
