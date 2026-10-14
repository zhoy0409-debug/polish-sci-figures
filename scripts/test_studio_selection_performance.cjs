/* Operation-count regressions for real selection/property helpers. These tests
 * measure work avoided, not browser frame rates or low-end device performance. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8');
const dom=new JSDOM('<div id="artboard"></div>'),doc=dom.window.document,NS='http://www.w3.org/2000/svg';
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);};
test('repeated selection readers build annotations/layout once and cannot poison the source cache',()=>{
  let current={panels:{p:{variant:0}}},builds=0,layouts=0;
  const asset={variants:[{svg:'original',width:100,viewBox:[0,0,100,100]}]},ctx={project:{panels:[asset]},StudioI18n:{language:'en'},compactFontEpoch:0,templateCache:new Map(),panel:()=>asset,state:()=>current,layout(){layouts++;return {positions:[{id:'p'}]};},fittedVariant:()=>null,editedSvg(id,vi){builds++;ctx.templateCache.set(id+'/'+vi,asset.variants[vi]);const svg=doc.createElementNS(NS,'svg');svg.innerHTML='<text data-key="e1">Original</text>';return svg;}};
  vm.createContext(ctx);vm.runInContext(section('  let editableSourceCache=null;','  function textPointSize('),ctx);
  const first=ctx.editableSource('p',0);first.querySelector('text').textContent='Uncommitted consumer mutation';
  for(let i=0;i<30;i++){const copy=ctx.editableSource('p',0);assert.equal(copy.querySelector('text').textContent,'Original');assert.equal(copy.getAttribute('data-editable-source'),'true');assert.notEqual(copy,first);}
  assert.equal(builds,1);assert.equal(layouts,1);
  current={panels:{p:{variant:0}}};ctx.editableSource('p',0);assert.equal(builds,2,'new undo/history state invalidates');
  ctx.project.statisticalRenders={newlyAvailable:{svg:'fresh metadata'}};ctx.editableSource('p',0);assert.equal(builds,3,'asynchronous metadata render invalidates without a history change');
  ctx.project.statisticalRenders.newlyAvailable={svg:'replacement'};ctx.editableSource('p',0);assert.equal(builds,4,'same-sized resource maps still detect a replaced value');
  ctx.templateCache.clear();ctx.editableSource('p',0);assert.equal(builds,5,'canvas source rebuild invalidates');
  ctx.StudioI18n.language='zh';ctx.editableSource('p',0);assert.equal(builds,6);
  ctx.compactFontEpoch++;ctx.editableSource('p',0);assert.equal(builds,7);
  asset.variants[0]={...asset.variants[0],svg:'new variant'};ctx.editableSource('p',0);assert.equal(builds,8);
  ctx.project={panels:[asset]};ctx.editableSource('p',0);assert.equal(builds,9,'a different project cannot reuse artwork');
});
test('many selected objects use one per-panel key index and deduplicate rich-text children',()=>{
  const board=doc.querySelector('#artboard'),svg=doc.createElementNS(NS,'svg');svg.dataset.panel='p';board.append(svg);
  svg.innerHTML=Array.from({length:600},(_,i)=>`<text data-key="e${i}"><tspan data-key="s${i}">${i}</tspan></text>`).join('');
  const keys=Array.from({length:600},(_,i)=>'e'+i).concat(['s1','e2']),ctx={$:()=>board,state:()=>({panels:{p:{}},overlays:[]}),selectionGroups:()=>[{id:'p',vi:0,keys}],selectedAnnotations:[],selectedPanelLabel:null};
  let keyQueries=0;const original=svg.querySelectorAll.bind(svg);svg.querySelectorAll=query=>{keyQueries++;return original(query);};
  vm.createContext(ctx);vm.runInContext(section('  function quickSelectedObjects(){','  function quickObjectTarget('),ctx);
  const result=ctx.quickSelectedObjects();assert.equal(result.length,600);assert.equal(keyQueries,1);assert.ok(result.every(item=>item.el.localName==='text'));assert.equal(result[1].key,'e1');
  ctx.state=()=>({panels:{p:{lockedElements:{0:['s1']}}},overlays:[]});const locked=ctx.quickSelectedObjects();assert.equal(locked.filter(item=>item.locked).length,1);assert.equal(locked.find(item=>item.key==='e1').locked,true);
});
test('multi-text size summary computes output geometry once rather than once per label',()=>{
  const count=40,svg=doc.createElementNS(NS,'svg');svg.innerHTML=Array.from({length:count},(_,i)=>`<text data-key="e${i}" font-size="8">${i}</text>`).join('');
  const fields={},$=id=>fields[id]||=(id==='font'?{options:[]}:{value:'',style:{}});let outputs=0,sizes=0;
  const ctx={selectedPanel:'p',selected:[],selectedAnnotations:[],selectedPanelLabel:null,original:false,$,panel:()=>({variants:[{}]}),state:()=>({panels:{p:{variant:0}}}),selectionGroups:()=>[{id:'p',vi:0,keys:Array.from({length:count},(_,i)=>'e'+i)}],StudioI18n:{panelName:()=>''},T:s=>s,currentOutput(){outputs++;return {scale:2};},editableSource:()=>svg,textOutputSize(el,id,vi,scale){assert.equal(scale,2);sizes++;return 16;},syncColorControls(){},renderFontTargets(){},renderHeatmapControls(){},renderRichTextControls(){},renderStatisticalLineControls(){},renderComponentStyle(){},renderQuickToolbar(){}};
  vm.createContext(ctx);vm.runInContext(section('  function renderSelectionProperties() {','  let literatureBrowser='),ctx);ctx.renderSelectionProperties();assert.equal(outputs,1);assert.equal(sizes,count);assert.equal($('fontSize').value,16);
});

test('statistical anchors are resolved once per current state and invalidated by display/source changes',()=>{
  let current={panels:{p:{variant:0,edits:{0:{}}}}},resolutions=0;
  const v={svg:'one',viewBox:[0,0,100,80],width:100},analysis={version:1},asset={variants:[v],analysis};
  const raw=doc.createElementNS(NS,'svg');raw.innerHTML='<g id="axes_1"/>';
  const ctx={project:{},compactFontEpoch:0,StudioI18n:{language:'en'},state:()=>current,panel:()=>asset,statisticalAnalysisFor:()=>asset.analysis,statisticalAnnotationSets:()=>[{comparisons:[{a:0,b:1,p:.02}],order:['a','b'],letters:true}],baseSvg:()=>raw.cloneNode(true),statisticalPlotAnchors(){resolutions++;return null;},statisticalFacetTitleElements:()=>[],T:x=>x};
  vm.createContext(ctx);vm.runInContext(section('  function statisticalAnnotationInfo(','  function statisticalExportRecords('),ctx);
  for(let i=0;i<30;i++)ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,1);
  current.panels.p.edits[0].e9000001={'font-size':'18'};ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,2,'mutable slider drafts do not reuse a wrong-size statistics plan');
  current.typography={font:'Arial',size:12};ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,3);
  current=JSON.parse(JSON.stringify(current));ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,4,'undo/reopen state has its own cache');
  ctx.project.statisticalRenders={'p/0':{svg:'new anchors'}};ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,5);
  ctx.project.heatmapRenders={'p/0':{svg:'new source'}};ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,6);
  asset.analysis={version:2};ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,7);
  v.svg='replacement artwork';ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,8);
  ctx.StudioI18n.language='zh';ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,9);
  ctx.compactFontEpoch++;ctx.statisticalAnnotationInfo('p');assert.equal(resolutions,10);
});

test('closed inspector records do no SVG or table work, then open with current data and cache unchanged reads',()=>{
  const d=new JSDOM('<details id="record"><summary>Record</summary><div id="dataInfo"></div></details><details id="quality"><summary>QA</summary><ul id="qa"></ul></details><details id="outer"><details id="inner"><div id="methods"></div></details></details>'),document=d.window.document;
  let current={panels:{p:{variant:0}}},builds=0;
  const asset={table:{rows:[['value'],['1']]},recipe:{view:'test'},analysis:{}};
  const ctx={document,project:{},selectedPanel:'p',activePane:'detail',state:()=>current,panel:()=>asset,StudioI18n:{language:'en'},T:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i]),$:id=>document.getElementById(id),editableSource(){builds++;const svg=document.createElementNS(NS,'svg');svg.innerHTML='<text>one</text><image/>';return svg;}};
  vm.createContext(ctx);vm.runInContext(section('  function inspectorDisclosureReady(','  function renderRecommendations(')+'\n'+section('  function renderInspectorRecord(','  // Reuse the current SVG on zoom;'),ctx);
  ctx.renderInspectorRecord('dataInfo');ctx.renderInspectorRecord('qa');assert.equal(builds,0);assert.equal(ctx.$('dataInfo').children.length,0);assert.equal(ctx.$('qa').children.length,0);
  asset.table={rows:[['value'],['42']]};current={panels:{p:{variant:0}}};ctx.renderInspectorRecord('dataInfo');ctx.renderInspectorRecord('qa');
  const record=ctx.$('record'),quality=ctx.$('quality');record.open=true;record.ontoggle();assert.match(ctx.$('dataInfo').textContent,/42/);assert.equal(builds,0);
  quality.open=true;quality.ontoggle();assert.equal(builds,1);const item=ctx.$('qa').firstChild;
  ctx.renderInspectorRecord('qa');assert.equal(builds,1);assert.equal(ctx.$('qa').firstChild,item,'unchanged visible record retains its DOM');
  quality.open=false;quality.ontoggle();current={panels:{p:{variant:0}}};ctx.renderInspectorRecord('qa');assert.equal(builds,1);quality.open=true;quality.ontoggle();assert.equal(builds,2,'dirty hidden QA refreshes on opening');
  let refreshes=0;ctx.$('inner').open=true;assert.equal(ctx.inspectorDisclosureReady('methods',()=>refreshes++),false,'closed outer details suppress nested method generation');ctx.$('outer').open=true;ctx.$('outer').ontoggle();assert.equal(refreshes,1);
  d.window.close();
});

dom.window.close();console.log(`${passed} selection performance operation-count regressions passed`);
