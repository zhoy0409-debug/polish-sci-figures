'use strict';
// Run in the existing browser-preview job with its pinned jsdom dependency.
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const UI=require('../skills/polish-sci-figures/assets/figure-studio/image-insets-ui.js');
async function main(){
  const dom=new JSDOM('<!doctype html><html><head></head><body><aside><section id="typePanel"></section></aside><div id="annotations"></div><button id="focus">Back</button></body></html>',{pretendToBeVisual:true});
  const doc=dom.window.document;
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new dom.window.Event('close'));};
  const source={panelId:'p',variant:0,key:'e1',widthPx:1024,heightPx:768};let current={},lang='zh-CN',q={},preview=null,commits=[],factorCalls=[],roi=[],calStart=[],cancelled=0,calCancelled=0,calibrations=[],removed=0,resolveCalibration;
  const host={document:doc,detailContainer:doc.querySelector('aside'),annotationContainer:doc.querySelector('#annotations'),language:()=>lang,selection:()=>current,quality:()=>q,
    startROI:(...args)=>roi.push(args),startCalibration:s=>calStart.push(s),setFactor(value){factorCalls.push(value);if(current.inset)current.inset={...current.inset,factor:value};},
    update(patch,only){if(only)preview=patch;else{commits.push(patch);current.inset={...current.inset,...patch};preview=null;}},cancelPreview(){cancelled++;preview=null;},
    calibrate(value){calibrations.push(value);return new Promise(resolve=>{resolveCalibration=()=>{q.calibrated=true;resolve(true);};});},cancelCalibration(){calCancelled++;},remove(){removed++;current={source};}};
  const ui=UI.create(host),section=ui.element,$=selector=>doc.querySelector(selector),fire=(node,name,extra={})=>node.dispatchEvent(new dom.window.Event(name,{bubbles:true,cancelable:true,...extra})),key=(node,name)=>node.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:name,bubbles:true,cancelable:true}));
  assert.equal(section.hidden,true);assert.equal(doc.querySelectorAll('#imageInsetsControls').length,1);assert.equal(section.nextElementSibling.id,'typePanel');
  current={source,locked:false};ui.refresh();assert.equal(section.hidden,false);assert.equal(section.dataset.pane,'detail');assert.equal($('.inset-options').hidden,true);assert.equal($('[data-factor="2"]').getAttribute('aria-pressed'),'true');
  host.activePane=()=> 'palette';ui.refresh();assert.equal(section.hidden,true,'selection refresh cannot leak controls into another tab');host.activePane=()=> 'detail';ui.refresh();assert.equal(section.hidden,false);delete host.activePane;
  $('[data-factor="3"]').click();assert.deepEqual(factorCalls,[3]);$('.inset-primary').click();assert.equal(roi.length,1);assert.equal(roi[0][0],source);assert.equal(roi[0][1],undefined);assert.equal(roi[0][2],3);
  $('.inset-calibrate').click();assert.equal(calStart[0],source);
  current={source,inset:{id:'inset-1',factor:2.5,borderColor:'#ffffff',borderWidth:1,connectors:true,scaleBar:false},locked:false};q={effectiveDpi:180,targetDpi:600,calibrated:false,scaleOptions:[{valueUm:2,label:'2 μm'},{valueUm:5,label:'5 μm'},{valueUm:10,label:'10 μm'}]};ui.refresh();
  assert.equal(section.parentElement.id,'annotations');assert.equal(section.dataset.pane,'annotation');assert.equal($('.inset-options').hidden,false);assert.equal(section.querySelectorAll('[data-factor][aria-pressed="true"]').length,0,'free resize does not falsely highlight a preset');
  assert.equal($('[data-inset-control="scaleBar"]').disabled,true);assert.equal($('[data-inset-control="scaleLengthUm"]').closest('label').hidden,true);assert.match($('.inset-quality').textContent,/180.*600/);assert.match(section.textContent,/划线并输入其实际长度/);
  const color=$('[data-inset-control="borderColor"]'),width=$('[data-inset-control="borderWidth"]');
  for(const value of ['#112233','#334455','#556677']){color.value=value;fire(color,'input');}assert.equal(commits.length,0);assert.equal(current.inset.borderColor,'#ffffff');assert.deepEqual(preview,{borderColor:'#556677'});
  fire(color,'change');fire(color,'blur');assert.equal(commits.length,1);assert.equal(current.inset.borderColor,'#556677');
  width.value='2';fire(width,'input');key(width,'Enter');fire(width,'change');fire(width,'blur');assert.equal(commits.length,2,'Enter/change/blur creates one commit');
  width.value='4';fire(width,'input');key(width,'Escape');fire(width,'blur');assert.equal(commits.length,2);assert.equal(cancelled,1);assert.equal(width.value,'2');
  width.value='3';fire(width,'input');fire(width,'pointercancel');assert.equal(cancelled,2);assert.equal(preview,null);
  width.value='-1';fire(width,'input');fire(width,'change');assert.equal(commits.length,2);assert.equal(width.value,'2');
  color.value='#121212';fire(color,'input');current={...current,inset:{...current.inset,id:'inset-2'}};ui.refresh();assert.equal(cancelled,3,'stale selection cancels rather than applies');assert.equal(commits.length,2);
  current.locked=true;ui.refresh();assert.equal(color.disabled,true);assert.equal(width.disabled,true);assert.equal($('.inset-primary').disabled,true);assert.equal($('.inset-remove').disabled,true);
  current.locked=false;lang='en';ui.refresh();assert.equal(section.querySelector('h2').textContent,'Image inset');assert.match(section.textContent,/Trace the source scale bar/);assert.doesNotMatch(section.textContent,/[\u4e00-\u9fff]/);
  assert.equal(ui.requestCalibration({pixelLength:Infinity}),false);assert.equal(ui.requestCalibration({pixelLength:0}),false);
  $('#focus').focus();assert.equal(ui.requestCalibration({pixelLength:80}),true);const dialog=$('dialog'),real=dialog.querySelector('input'),confirm=dialog.querySelector('.primary');assert.equal(dialog.open,true);assert.equal(real.value,'','physical calibration is never invented');
  real.value='0';confirm.click();assert.match(dialog.querySelector('[role=alert]').textContent,/greater than zero/);assert.equal(calibrations.length,0);
  real.value='25';confirm.click();assert.deepEqual(calibrations,[25]);assert.equal(dialog.open,true,'keep dialog until host has committed');assert.equal(confirm.disabled,true);fire(dialog,'cancel');assert.equal(dialog.open,true,'pending commit is not falsely reported as cancelled');resolveCalibration();await Promise.resolve();await Promise.resolve();
  assert.equal(dialog.open,false);assert.equal(calCancelled,0);assert.equal(doc.activeElement.id,'focus');assert.equal($('[data-inset-control="scaleBar"]').disabled,false);assert.match(section.textContent,/common scale values; bar length adapts/);
  const scale=$('[data-inset-control="scaleBar"]');scale.checked=true;fire(scale,'change');assert.equal(current.inset.scaleBar,true);
  const scaleLength=$('[data-inset-control="scaleLengthUm"]');assert.equal(scaleLength.closest('label').hidden,false);assert.equal(scaleLength.value,'auto');assert.deepEqual([...scaleLength.options].map(option=>option.textContent),['Automatic','2 μm','5 μm','10 μm']);
  scaleLength.value='5';fire(scaleLength,'change');assert.equal(current.inset.scaleLengthUm,5);assert.deepEqual(commits.at(-1),{scaleLengthUm:5});scale.checked=false;fire(scale,'change');assert.equal(scaleLength.closest('label').hidden,true);assert.equal(current.inset.scaleLengthUm,5,'hiding a scale bar preserves the chosen value');scale.checked=true;fire(scale,'change');assert.equal(scaleLength.value,'5');
  q.scaleOptions=[{valueUm:1,label:'1 μm'},{valueUm:2,label:'2 μm'}];ui.refresh();assert.equal(scaleLength.value,'5');assert.equal(scaleLength.selectedOptions[0].disabled,true,'a now-unavailable manual value is not falsely shown as automatic');assert.match(scaleLength.selectedOptions[0].textContent,/outside the available range/);const beforeInvalid=commits.length;fire(scaleLength,'change');assert.equal(commits.length,beforeInvalid);
  scaleLength.value='auto';fire(scaleLength,'change');assert.equal(current.inset.scaleLengthUm,null);assert.deepEqual(commits.at(-1),{scaleLengthUm:null});assert.deepEqual([...scaleLength.options].map(option=>option.value),['auto','1','2']);
  assert.equal(ui.requestCalibration({pixelLength:30}),true);fire(dialog,'cancel');assert.equal(dialog.open,false);assert.equal(calCancelled,1);
  ui.requestCalibration({pixelLength:50});current={source:{...source,key:'e2'},locked:false};ui.refresh();assert.equal(dialog.open,false);assert.equal(calCancelled,2);assert.equal(section.dataset.pane,'detail');assert.equal(section.parentElement.tagName,'ASIDE');assert.equal(section.nextElementSibling.id,'typePanel');
  current={source,inset:{id:'inset-3',factor:4,borderColor:'#aabbcc',borderWidth:1,connectors:false,scaleBar:true},locked:false};ui.refresh();$('.inset-primary').click();assert.deepEqual(roi.at(-1),[source,'inset-3',4]);$('.inset-remove').click();assert.equal(removed,1);assert.equal(current.source,source,'delete inset keeps original source');assert.equal(section.dataset.pane,'detail');
  current={};ui.refresh();assert.equal(section.hidden,true);ui.destroy();assert.equal(doc.querySelector('#imageInsetsControls'),null);assert.equal(doc.querySelector('dialog'),null);ui.refresh();ui.destroy();
  console.log('PASS image inset UI: contextual single entry, bilingual controls, actual-factor presets, atomic preview/undo callbacks, stale/locked guards, ROI/delete routing, explicit physical calibration, asynchronous confirmation/cancel and source preservation.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
