/* Real scale-controls adapter: calibration belongs to its source image. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8'),from=source.indexOf('  let scaleControlsContext='),to=source.indexOf('  function refreshLivePreviews(',from);assert.ok(from>=0&&to>from);
const names=['scaleCalibration','scaleLength','scalePosition','scaleThickness','scaleFontSize','scaleAlpha','scaleBold','scaleBackground'];
const dom=new JSDOM('<body><div id="artboard"><svg data-panel="panel-0"><image data-key="e1"/><image data-key="e2"/><image data-key="e3"/></svg></div>'+names.map(id=>`<input id="${id}" ${['scaleBold','scaleBackground'].includes(id)?'type="checkbox"':''}>`).join('')+'</body>'),$=id=>dom.window.document.getElementById(id);
const saved={calibration:100,length:20,position:'bl',thickness:2,size:9,alpha:.7,bold:true,background:false},current={panels:{'panel-0':{variant:0,scales:{0:{e1:saved}},imageCalibrations:{0:{e2:200}}}}},project={id:'public-engineering-controls'};
const ctx={$,state:()=>current,project,selectedPanel:'panel-0',selected:['e1']};vm.createContext(ctx);vm.runInContext(source.slice(from,to),ctx);
const raw=JSON.stringify(current);ctx.syncScaleControls();assert.equal($('scaleCalibration').value,'100');assert.equal($('scaleLength').value,'20');assert.equal($('scaleBold').checked,true);
ctx.selected=['e2'];ctx.syncScaleControls();assert.equal($('scaleCalibration').value,'200','An explicitly calibrated second source uses its own width');
ctx.selected=['e3'];ctx.syncScaleControls();assert.equal($('scaleCalibration').value,'','An uncalibrated source must not inherit another image width');$('scaleCalibration').value='150';ctx.syncScaleControls();assert.equal($('scaleCalibration').value,'150','A same-target draft is not erased');assert.equal(JSON.stringify(current),raw,'Field sync cannot create a scale or write calibration');
current.panels['panel-0'].scales[0].e3={...saved,calibration:150,length:30};ctx.syncScaleControls();assert.equal($('scaleLength').value,'30');delete current.panels['panel-0'].scales[0].e3;ctx.syncScaleControls();assert.equal($('scaleCalibration').value,'','Undo of the record returns to unknown calibration');
ctx.selected=['e1'];ctx.syncScaleControls();assert.equal($('scaleCalibration').value,'100');assert.equal($('scaleLength').value,'20');assert.equal($('scaleBackground').checked,false);
const html=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.html','utf8');assert.match(html,/<input id="scaleCalibration"[^>]+value=""/);assert.equal(JSON.stringify(current),raw);
console.log('PASS source-specific scale controls, unknown calibration, unchanged drafts, undo and restored appearance; no model writes.');dom.window.close();
