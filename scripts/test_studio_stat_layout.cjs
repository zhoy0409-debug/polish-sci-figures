/* Statistical annotation layout checks; source helpers/DOM blocks, not browser typography QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const source=fs.readFileSync(require.resolve(file),'utf8'),helpers=require(file),{statisticalLayout}=helpers;
assert.equal(typeof statisticalLayout,'function','production statistical layout helper must be exported');
const measureStart=source.indexOf('let statisticalMeasureContext;'),measureEnd=source.indexOf('function statisticalBracketPath(',measureStart),canvasMeasure={font:'',measureText(text){this.measured=text;return {width:123};}},measureContext={...helpers,document:{createElement:()=>({getContext:()=>canvasMeasure})}};
assert.ok(measureStart>0&&measureEnd>measureStart);vm.runInNewContext(source.slice(measureStart,measureEnd),measureContext);
for(const bold of [false,true])for(const italic of [false,true]){assert.equal(measureContext.statisticalTextWidth('P < 0.001','Times New Roman',24,bold,italic),123);assert.equal(canvasMeasure.font,`${italic?'italic ':''}${bold?'700 ':''}24px "Times New Roman"`);assert.equal(canvasMeasure.measured,'P < 0.001');}
assert.ok(helpers.statisticalTextWidth('P < 0.001','Arial',24,true,true)>helpers.statisticalTextWidth('P < 0.001','Arial',24),'non-browser fallback reserves extra space for bold/italic');

// Physical font size controls spacing rather than a fixed 20 pt step.
for(const size of [9,24,32])for(const count of [1,3,6])for(const style of ['stars','hash','p']){
  const m=statisticalLayout(style,count,{variant:0,annotationFont:{font:'Arial',size}},{});
  assert.equal(m.fontSize,size);assert.ok(m.pitch>=size*1.35+8,'adjacent lines need font-dependent separation');
  assert.ok(m.header>0);assert.ok(m.firstGap>=0);assert.ok(m.labelGap>=0);
  const bands=Array.from({length:count},(_,i)=>{const baseline=-m.firstGap-i*m.pitch-m.labelGap;return {top:baseline-size,bottom:baseline+size*.3};});
  for(let i=1;i<bands.length;i++)assert.ok(bands[i].bottom<bands[i-1].top,'successive text bands remain separate at the requested font size');
  assert.ok(m.header>=-bands.at(-1).top,'reserved header contains the highest statistical text');
}
for(const size of [24,32]){const m=statisticalLayout('letters',4,{variant:0,annotationFont:{font:'Arial',size}},{});assert.ok(m.header>=m.letterGap+size,'letter annotation headroom follows font size');}

// Generated element overrides participate in physical spacing; unrelated source edits do not.
const overrides={variant:0,annotationFont:{font:'Arial',size:9},edits:{0:{e42:{'font-size':'500'},e900001:{'font-size':'64'}}}};
const physical=statisticalLayout('p',3,overrides,{},2,0);assert.equal(physical.fontSize,32);assert.ok(physical.pitch>40);
assert.equal(statisticalLayout('p',3,overrides,{},2,1).fontSize,9,'other variants do not borrow font-size edits');

// Execute the production annotation builder, including its metadata on reflowed canvases.
function drawingNode(tag){const n=node(tag);n.children=[];n.append=(...items)=>{for(const item of items){if(item.parent)item.parent.children=item.parent.children.filter(x=>x!==item);item.parent=n;n.children.push(item);}};n.querySelectorAll=()=>[];return n;}
const buildStart=source.indexOf('    if(!raw&&s.panels[id].annotationStyle&&statisticalAnnotationInfo'),buildEnd=source.indexOf('    if(!raw)for(const [key,cfg]',buildStart);
assert.ok(buildStart>0&&buildEnd>buildStart);
const conditionHelpers={},conditionStart=source.indexOf('  function appendConditionMatrix('),conditionEnd=source.indexOf('  function annotationHeight(',conditionStart);vm.runInNewContext(source.slice(conditionStart,conditionEnd),conditionHelpers);
for(const size of [24,32])for(const [width,height]of [[345.6,259.2],[703.2,259.2],[1050,400],[345.6,540]])for(const format of ['standard','precise']){
  const svg=drawingNode('svg'),panelState={variant:0,annotationStyle:'p',annotationPFormat:format,annotationFont:{font:'Arial',size,bold:format==='precise',italic:format==='precise'}},s={panels:{p:panelState}},comparisons=[{a:0,b:1,p:0},{a:0,b:2,p:.000012345},{a:1,b:2,p:.032}],m=statisticalLayout('p',3,panelState),flow={width,height,viewBox:[0,0,width,height]};
  vm.runInNewContext(source.slice(buildStart,buildEnd),{...helpers,...conditionHelpers,raw:false,id:'p',vi:0,s,svg,reflow:flow,NS:'svg',panel:()=>({variants:[{width:345.6,height:259.2,viewBox:[0,0,345.6,259.2]}],analysis:{group_order:['A','B','C'],pairwise:comparisons}}),statisticalAnnotationInfo:()=>({available:true,placement:'plot',order:['A','B','C'],comparisons}),comparisonsFor:()=>comparisons,statisticalAnchorElements:()=>({}),measureStatisticalAnchors:()=>({centers:[80,width/2,width-80],tops:[80,60,70]}),annotationHeight:()=>m.header,document:{createElementNS:(_,tag)=>drawingNode(tag),createTextNode:text=>({textContent:text})}});
  const viewBox=svg.getAttribute('viewBox').split(' ').map(Number);assert.equal(viewBox[2],width,'statistical headroom retains actual reflow width');assert.equal(viewBox[3],height+m.header,'headroom is added to actual reflow height');
  const texts=svg.children.filter(n=>n.localName==='text'),lines=svg.children.filter(n=>n.localName==='path');assert.equal(texts.length,3);assert.equal(lines.length,3);
  assert.equal(+svg.getAttribute('data-stat-header'),m.header);
  for(let i=0;i<3;i++){const bracket=JSON.parse(lines[i].getAttribute('data-stat-bracket'));assert.equal(bracket.gap,m.firstGap+i*m.pitch);assert.equal(+texts[i].getAttribute('data-stat-gap'),bracket.gap+m.labelGap);assert.equal(+texts[i].getAttribute('font-size'),size);assert.equal(texts[i].children.map(c=>c.textContent).join(''),'P'+helpers.statisticalPText(comparisons[i].p,format),'legacy plot rendering uses the selected P display format');assert.equal(texts[i].children[0].getAttribute('font-style'),'italic');assert.equal(texts[i].getAttribute('font-weight'),format==='precise'?'700':'400');assert.equal(texts[i].getAttribute('font-style'),format==='precise'?'italic':'normal');}
}

// Execute the production generated-element edit block, including the hidden mapping.
function node(tag,key){const attrs=new Map(key?[['data-key',key]]:[]);return {localName:tag,style:{setProperty(k,v){this[k]=v;}},textContent:'Original',closest:()=>null,hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v)};}
const path=node('path'),text=node('text'),existing=node('text','e5'),nodes=[path,text,existing];
const start=source.indexOf('    let generated=900000;'),end=source.indexOf('    return svg;',start);
assert.ok(start>=0&&end>start);
const ctx={raw:false,id:'panel-0',vi:0,s:{},svg:{querySelectorAll:()=>nodes},editsFor:()=>({e900000:{hidden:'true'},e900001:{hidden:'true','font-size':'32',fill:'#526e9e'}})};
vm.runInNewContext(source.slice(start,end),ctx);
assert.equal(path.style.display,'none','generated comparison line deletion reaches output');assert.equal(text.style.display,'none','generated statistical text deletion reaches output');assert.equal(text.style.fontSize||text.style['font-size'],'32px');assert.equal(existing.style.display,undefined,'unselected source content remains visible');
const raw=node('text');vm.runInNewContext(source.slice(start,end),{...ctx,raw:true,svg:{querySelectorAll:()=>[raw]}});assert.equal(raw.style.display,undefined,'original comparison remains unedited');

// Summary anchoring must use its independent band instead of the statistical ladder.
const titleLine=source.split('\n').find(line=>line.includes('if(titles.has(el))'));
assert.ok(titleLine&&titleLine.includes('data-stat-header'),'summary position must subtract the reserved statistical band');
for(const size of [24,32])for(const count of [1,3,6]){
  const m=statisticalLayout('p',count,{variant:0,annotationFont:{font:'Arial',size}},{}),margins={left:60,top:m.header+44};
  const el={},titles=new Map([[el,{x:80,y:16}]]),context={el,titles,margins,titleLeft:80,titleBottom:16,svg:{getAttribute:()=>m.header},x:0,y:0};
  vm.runInNewContext(titleLine.trim(),context);
  const highestBaseline=margins.top-m.firstGap-(count-1)*m.pitch-m.labelGap,highestTextTop=highestBaseline-size;
  assert.ok(context.y+3<highestTextTop,'summary baseline and descender stay above the statistical text band');
  assert.ok(context.y>=0,'summary stays inside the canvas');
}
console.log('PASS statistical layout: 9/24/32 pt spacing, 1/3/6 comparisons, generated overrides and hidden edits, independent summary band. Scope: production helper/DOM block checks; browser font metrics are separate.');
