/* Execute the production editedSvg pipeline: matrix defaults -> user edits ->
 * final contrast pass. No browser dependencies or mirrored ordering. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const filename='skills/polish-sci-figures/assets/figure-studio/studio.js';
const api=require('../'+filename),source=fs.readFileSync(filename,'utf8');
function node(attrs={},text=''){
  return {attrs:{...attrs},textContent:text,localName:'text',children:[],style:{fontSize:'8px',fontFamily:'Arial',opacity:'0',setProperty(key,value){this[key]=value;if(key==='font-size')this.fontSize=value;}},
    getAttribute(key){return this.attrs[key]??null;},setAttribute(key,value){this.attrs[key]=String(value);},removeAttribute(key){delete this.attrs[key];},
    querySelectorAll(){return[];},closest(){return null;},matches(query){return query.split(',').includes(this.localName);},hasAttribute(key){return Object.hasOwn(this.attrs,key);}};
}
function matrix(){
  const texts=Array.from({length:56},(_,i)=>node({'data-key':'e'+i},'0.50'));
  const groups=texts.map((text,i)=>({id:`studio-heat-value-${i}-3fe0000000000000-eeeeee-1-2`,style:{},querySelectorAll:query=>query==='text'?[text]:[]}));
  const boxes=texts.map(()=>{const p=node({d:'M 0 0 L 40 0 L 40 32 L 0 32 z'});p.localName='path';return p;});
  return {texts,groups,boxes,querySelectorAll(query){if(query.includes('studio-heat-value-'))return groups;if(query==='text,path,line,rect')return texts;return[];},
    querySelector(query){if(query.includes('studio-heat-box-'))return boxes[+query.match(/box-(\d+)/)[1]];if(query.includes('data-key'))return texts[+query.match(/e(\d+)/)[1]];return null;}};
}
let state={panels:{'panel-0':{variant:0,edits:{},heatmapLabels:{visible:true,decimals:2,fontSize:8,color:'auto'}}}};
const start=source.indexOf('  function editedSvg('),end=source.indexOf('  function namespace(',start);assert.ok(start>=0&&end>start);
const render=vm.runInNewContext(source.slice(start,end)+'\neditedSvg;',{
  state:()=>state,baseSvg:matrix,reflowSvg:matrix,panel:()=>({recipe:{family:'gallery'},variants:[{name:'clustered_matrix',viewBox:[0,0,345.6,259.2],width:345.6}]}),
  editsFor:(id,vi,s)=>s.panels[id].edits[vi]||{},
  appendConditionMatrix:()=>{}, // This fixture has no group-condition overlay.
  applyHeatmapPalette:api.applyHeatmapPalette,applyHeatmapValueLabels:api.applyHeatmapValueLabels,refreshHeatmapLabelContrast:api.refreshHeatmapLabelContrast
});
let svg=render('panel-0',0,state);assert.ok(svg.texts.every(t=>t.style.fontSize==='8px'&&t.style.opacity==='1'));
// A single user-selected cell becomes 12 pt, while the other 55 remain 8 pt.
state.panels['panel-0'].edits={0:{e0:{'font-size':'12'}}};svg=render('panel-0',0,state);
assert.equal(svg.texts[0].style.fontSize,'12px');assert.ok(svg.texts.slice(1).every(t=>t.style.fontSize==='8px'));
// The same editing route supports a five-cell selection without affecting others.
state.panels['panel-0'].edits={0:Object.fromEntries([0,2,8,12,35].map(i=>['e'+i,{'font-size':'12'}]))};svg=render('panel-0',0,state);
assert.equal(svg.texts.filter(t=>t.style.fontSize==='12px').length,5);assert.equal(svg.texts.filter(t=>t.style.fontSize==='8px').length,51);
// Explicit deletion, opacity and text paint survive the final contrast pass.
Object.assign(state.panels['panel-0'].edits[0],{e0:{hidden:'true','font-size':'12'},e2:{opacity:'0.35','font-size':'12'},e8:{fill:'#c95770','font-size':'12'}});
svg=render('panel-0',0,state);assert.equal(svg.texts[0].style.display,'none');assert.equal(svg.texts[2].style.opacity,'0.35');assert.equal(svg.texts[8].style.fill,'#c95770');
// Matrix defaults can subsequently change; explicit cell settings remain explicit.
state.panels['panel-0'].heatmapLabels.fontSize=9;svg=render('panel-0',0,state);
assert.equal(svg.texts[1].style.fontSize,'9px');assert.equal(svg.texts[8].style.fontSize,'12px');assert.equal(svg.texts[0].style.display,'none');
// A global visibility-off setting hides the groups without erasing local edits.
state.panels['panel-0'].heatmapLabels.visible=false;svg=render('panel-0',0,state);assert.ok(svg.groups.every(g=>g.style.opacity==='0'));
state.panels['panel-0'].heatmapLabels.visible=true;svg=render('panel-0',0,state);assert.equal(svg.texts[0].style.display,'none');assert.equal(svg.texts[8].style.fontSize,'12px');
console.log('Heatmap production pipeline passed: 1/5 selected cells 8→12 pt, other 55/51 unchanged; hidden, opacity, custom color and global defaults preserved.');
