/* Actual scale planner and state validator; no inferred specimen calibration. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Core=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const Scale=require('../skills/polish-sci-figures/assets/figure-studio/scale-geometry.js');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const start=source.indexOf('  const updateScale='),end=source.indexOf("  $('applyScale')",start);assert.ok(start>=0&&end>start);
const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(){
 const project={panels:[{id:'panel-0',variants:[{}]}]},initial={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}},history=new Core.History(initial),fields={};
 for(const [id,value]of Object.entries({scaleCalibration:'100',scaleLength:'20',scalePosition:'bl',scaleThickness:'2',scaleFontSize:'9',scaleAlpha:'.7',font:'',color:'#000000'}))fields[id]={value};
 fields.scaleBold={checked:false};fields.scaleBackground={checked:true};
 const viewport={localName:'svg',getAttribute:name=>name==='viewBox'?'0 0 600 340':null,parentElement:null},attributes={width:'600',height:'340',href:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4xQAAAAASUVORK5CYII='},image={localName:'image',parentElement:viewport,getAttribute:name=>attributes[name]??null,style:{getPropertyValue:()=>''}};
 const ctx={state:()=>history.current,copy,project,selectedPanel:'panel-0',scaleSelection:()=>({vi:0,key:'e1'}),$:id=>fields[id],T:x=>x,say:()=>undefined,validateState:Core.validateState,scaleGeometryFor:(id,vi,key,cfg)=>Scale.geometry(image,cfg),commit:next=>history.commit(next),renderCanvas:()=>{}};
 vm.createContext(ctx);vm.runInContext(source.slice(start,end)+'\nglobalThis.plan=updateScale;',ctx);
 return {ctx,fields,history,plan:()=>ctx.plan(false,true)};
}
let checks=0;
for(const [name,setup,expected]of [
 ['unselected text font on image',()=>{},'Arial'],
 ['project typography',f=>{const s=copy(f.history.current);s.typography={font:'Times New Roman',size:9};f.history.commit(s);},'Times New Roman'],
 ['existing scale font',f=>{const s=f.plan();s.panels['panel-0'].scales[0].e1.font='DejaVu Sans';f.history.commit(s);},'DejaVu Sans'],
 ['explicit font selection',f=>{f.fields.font.value='Calibri';},'Calibri']
]){const f=fixture();setup(f);const before=JSON.stringify(f.history.toJSON()),next=f.plan();assert.equal(next.panels['panel-0'].scales[0].e1.font,expected,name);assert.equal(next.panels['panel-0'].scales[0].e1.calibration,100);assert.equal(next.panels['panel-0'].scales[0].e1.length,20);assert.equal(JSON.stringify(f.history.toJSON()),before,'Planning cannot persist a draft');checks++;}
const f=fixture();for(const [id,bad]of [['scaleCalibration','0'],['scaleLength','81'],['scaleFontSize','2']]){const old=f.fields[id].value;f.fields[id].value=bad;assert.throws(f.plan,/比例尺/);f.fields[id].value=old;}checks++;
console.log(`PASS ${checks} actual scale planner groups; calibration values are explicit engineering inputs, not specimen truth.`);
