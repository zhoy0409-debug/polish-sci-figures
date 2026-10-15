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
  vm.createContext(ctx);vm.runInContext(section('  let labelSelections=[];','  const sizeNames=')+section('  function quickSelectedObjects(){','  function quickObjectTarget('),ctx);
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

test('inspector thumbnails reuse artwork across track and export-size edits but invalidate real artwork changes',()=>{
  const clone=value=>JSON.parse(JSON.stringify(value));let current={columns:3,grid:{rows:1,widths:[100,100,100],heights:[80],places:{p:{row:0,col:0,rs:1,cs:1}}},panels:{p:{variant:0,edits:{0:{}},markStyle:{capWidth:8.5}}},typography:{font:'Arial',size:9},exportSettings:{widthMm:180,dpi:600}},charts=0,palettes=0;
  const asset={variants:[{name:'grouped_observations',svg:'original'}],analysis:{version:1}},fields={scope:{value:'current'},chartGoal:{value:'comparison'},topCount:{value:'3'}},ctx={project:{},selectedPanel:'p',activePane:'explore',inspectorPreviewCache:{},StudioI18n:{language:'en'},selectedAnnotations:[],selectedPanelLabel:null,selectionGroups:()=>[],state:()=>current,panel:()=>asset,$:id=>fields[id],renderChartChoices:()=>charts++,drawPalettes:()=>palettes++};
  vm.createContext(ctx);vm.runInContext(section('  function renderInspectorPreviews() {','  let categorySpacingGesture='),ctx);
  ctx.renderInspectorPreviews();assert.equal(charts,1);
  for(let i=0;i<50;i++){current=clone(current);current.grid.widths=[100+i,100-i,100];current.grid.heights=[80+i];current.grid.manualTracks=true;current.exportSettings={widthMm:180+i,dpi:i%2?300:600};ctx.renderInspectorPreviews();}
  assert.equal(charts,1,'resizing tracks/export and replacing history state never regenerate the seven thumbnail artwork variants');
  ctx.activePane='palette';ctx.renderInspectorPreviews();assert.equal(palettes,1);current=clone(current);current.grid.heights=[200];current.exportSettings.widthMm=220;ctx.renderInspectorPreviews();assert.equal(palettes,1,'palette previews also retain their SVG nodes when only output dimensions change');
  ctx.activePane='explore';ctx.renderInspectorPreviews();assert.equal(charts,1,'each pane has an independent valid artwork cache');
  const invalidates=(change,message)=>{const before=charts;change();ctx.renderInspectorPreviews();assert.equal(charts,before+1,message);ctx.renderInspectorPreviews();assert.equal(charts,before+1,'unchanged new artwork immediately becomes cached');};
  invalidates(()=>{current=clone(current);current.panels.p.markStyle.capWidth=12;},'an actual mark appearance change refreshes thumbnails');
  invalidates(()=>{current=clone(current);current.panels.p.edits[0].e1={fill:'#123456'};},'saved object styling refreshes thumbnails');
  invalidates(()=>{current=clone(current);current.typography.size=12;},'unified typography refreshes thumbnails');
  invalidates(()=>{current=clone(current);current.panels.p.variant=1;},'variant selection refreshes thumbnails');
  invalidates(()=>{asset.variants=[...asset.variants,{name:'compare_interaction',svg:'new'}];},'new source-variant assets refresh thumbnails');
  invalidates(()=>{ctx.project.statisticalRenders={'p/1':{svg:'anchor-upgrade'}};},'asynchronous statistical source upgrade refreshes thumbnails');
  invalidates(()=>{ctx.project.statisticalRenders['p/1']={svg:'replacement-upgrade'};},'a replacement source upgrade also refreshes thumbnails');
  invalidates(()=>{ctx.project.heatmapRenders={'p/1':{sha256:'new-render'}};},'new heatmap source hash refreshes thumbnails');
  invalidates(()=>{asset.analysis={version:2};},'analysis changes refresh recommendations');
  invalidates(()=>{current=clone(current);current.columns=4;},'column-count changes refresh available span choices');
  invalidates(()=>{current=clone(current);current.grid.rows=2;},'row-count changes refresh available span choices');
  invalidates(()=>{current=clone(current);current.grid.places.p.cs=2;},'changing this panel span refreshes choices');
  invalidates(()=>{ctx.StudioI18n.language='zh';},'language changes refresh labels');
  invalidates(()=>{ctx.$('chartGoal').value='trend';},'recommendation goal changes refresh candidates');
  invalidates(()=>{ctx.project={...ctx.project};},'a different project cannot inherit the prior cache');
});

test('cached size/span candidates apply and hover from the latest grid state without restoring stale tracks',()=>{
  const d=new JSDOM('<div id="sizes"></div><div id="slotChoices"></div><div id="rocRequirements"></div><div id="rocNeeds"></div><div id="candidates"></div><p id="candidateHint"></p><input id="chartGoal" value="comparison"><input id="topCount" value="3">'),document=d.window.document,clone=value=>JSON.parse(JSON.stringify(value)),commits=[],previews=[];
  let current={columns:3,grid:{rows:1,widths:[100,100,100],heights:[80],places:{p:{row:0,col:0,rs:1,cs:1}}},panels:{p:{variant:0,edits:{0:{}}}},exportSettings:{widthMm:180,dpi:600}};
  const asset={provenance:'user-import',analysis:{},variants:[{name:'grouped_observations',size:'original',width:100,height:80},{name:'grouped_observations',size:'wide',width:200,height:80}]};
  const ctx={document,selectedPanel:'p',selected:[],state:()=>current,panel:()=>asset,$:id=>document.getElementById(id),copy:clone,T:x=>x,guard:f=>f,sizeNames:{original:'Original',wide:'Wide'},StudioI18n:{language:'en'},StudioCatalogue:{rank:()=>[]},StudioDiscovery:{},renderLiteratureExamples(){},say(){},matchSizes:s=>s,resizePanel(s,id,rs,cs){const next=clone(s);next.grid.places[id].rs=rs;next.grid.places[id].cs=cs;return next;},editedSvg:()=>document.createElementNS(NS,'svg'),preview:svg=>svg,renderCanvas:s=>previews.push(s),commit(next){commits.push(next);current=next;},button(text,onClick){const b=document.createElement('button');b.textContent=text;b.onclick=onClick;return b;}};
  vm.createContext(ctx);vm.runInContext(section('  function renderChartChoices() {','  function renderInspectorPreviews() {'),ctx);ctx.renderChartChoices();
  const wide=ctx.$('sizes').children[1],span=ctx.$('slotChoices').children[1];assert.ok(wide);assert.ok(span);
  current=clone(current);current.grid.widths=[137,93,170];current.grid.heights=[143];current.grid.manualTracks=true;current.exportSettings={widthMm:240,dpi:300};
  const latestTracks=clone(current.grid),latestExport=clone(current.exportSettings);wide.onmouseenter();assert.deepEqual(JSON.parse(JSON.stringify(previews.at(-1).grid.widths)),latestTracks.widths);assert.equal(previews.at(-1).grid.heights[0],143);assert.equal(previews.at(-1).panels.p.variant,1);assert.equal(current.panels.p.variant,0,'hover never commits');
  wide.onclick();assert.equal(commits.length,1);assert.deepEqual(JSON.parse(JSON.stringify(current.grid.widths)),latestTracks.widths,'cached dimension click retains the newly dragged column widths');assert.deepEqual(JSON.parse(JSON.stringify(current.grid.heights)),latestTracks.heights);assert.deepEqual(JSON.parse(JSON.stringify(current.exportSettings)),latestExport);assert.equal(current.panels.p.variant,1);assert.equal(current.grid.places.p.cs,2);
  current=clone(current);current.grid.widths=[151,102,177];current.grid.heights=[190];current.exportSettings.widthMm=270;span.onmouseenter();assert.deepEqual(JSON.parse(JSON.stringify(previews.at(-1).grid.widths)),[151,102,177]);span.onclick();assert.equal(commits.length,2);assert.deepEqual(JSON.parse(JSON.stringify(current.grid.widths)),[151,102,177]);assert.equal(current.grid.heights[0],190);assert.equal(current.exportSettings.widthMm,270);assert.equal(current.panels.p.variant,1,'span selection retains the current figure variant');d.window.close();
});

test('the actual host finish settles 142 outlines without geometry reads and composes a second gesture from the new baseline',()=>{
  const d=new JSDOM('<svg id="host" xmlns="http://www.w3.org/2000/svg"><g id="outlines"></g><line id="axis" x1="20" x2="20" y1="20" y2="100"/></svg>'),document=d.window.document,svg=document.getElementById('host'),selectionLayer=document.getElementById('outlines'),axis=document.getElementById('axis'),count=142;
  const original=Array.from({length:count},(_,i)=>({x:i*2,y:5,width:10,height:4}));for(const box of original){const rect=document.createElementNS(NS,'rect');for(const [key,value]of Object.entries(box))rect.setAttribute(key,value);selectionLayer.append(rect);}
  let selectedReads=0,boxReads=0,props=0,quick=0,draws=0,captured,semantic=false;
  svg.getBoundingClientRect=()=>{throw Error('Host finish measured the canvas');};svg.getScreenCTM=()=>{throw Error('Host finish reread canvas CTM');};
  for(const rect of selectionLayer.children){rect.getBoundingClientRect=()=>{throw Error('Generic finish reread one of 142 outline boxes');};rect.getScreenCTM=()=>{throw Error('Generic finish reread outline CTM');};}
  axis.getBoundingClientRect=()=>{boxReads++;return {left:+axis.getAttribute('x1'),right:+axis.getAttribute('x2'),top:+axis.getAttribute('y1'),bottom:+axis.getAttribute('y2')};};
  const ctx={svg,l:{width:400,height:200},selectionLayer,selectionResize:null,StudioSelectionResize:{create:config=>{captured=config;return {};}},state:()=>({panels:{}}),commit:()=>true,T:x=>x,original:false,layoutMode:false,selectedNodes(){selectedReads++;assert.equal(semantic,true,'generic completion must not enumerate/measure selected objects again');return [axis];},drawSelection(nodes){draws++;selectionLayer.replaceChildren();for(const node of nodes){const b=node.getBoundingClientRect(),rect=document.createElementNS(NS,'rect');for(const [key,value]of Object.entries({x:b.left,y:b.top,width:b.right-b.left,height:b.bottom-b.top}))rect.setAttribute(key,value);selectionLayer.append(rect);}},renderSelectionProperties(){props++;ctx.renderQuickToolbar();},renderQuickToolbar(){quick++;}};
  vm.createContext(ctx);vm.runInContext(section("    if(typeof StudioSelectionResize!=='undefined')selectionResize=StudioSelectionResize.create({",'    zoomView.selectionResize=selectionResize;'),ctx);
  const first=[1.5,0,0,.8,4,2],second=[.9,0,0,1.2,-3,6],items=Array.from({length:count},()=>({kind:'element',semantic:null})),apply=(box,a)=>({x:box.x*a[0]+a[4],y:box.y*a[3]+a[5],width:box.width*a[0],height:box.height*a[3]});
  selectionLayer.setAttribute('transform','matrix('+first.join(' ')+')');captured.onFinish({committed:true,action:first,items});assert.equal(selectionLayer.hasAttribute('transform'),false);assert.equal(selectedReads,0);assert.equal(boxReads,0);assert.equal(draws,0);assert.equal(props,1);assert.equal(quick,1,'renderSelectionProperties already refreshes the quick toolbar');
  for(const [i,rect]of [...selectionLayer.children].entries())for(const [key,value]of Object.entries(apply(original[i],first)))assert.ok(Math.abs(+rect.getAttribute(key)-value)<1e-9);
  selectionLayer.setAttribute('transform','matrix('+second.join(' ')+')');captured.onFinish({committed:true,action:second,items});assert.equal(selectionLayer.hasAttribute('transform'),false);assert.equal(selectedReads,0);assert.equal(boxReads,0);assert.equal(props,2);assert.equal(quick,2);for(const [i,rect]of [...selectionLayer.children].entries())for(const [key,value]of Object.entries(apply(apply(original[i],first),second)))assert.ok(Math.abs(+rect.getAttribute(key)-value)<1e-9,'the second action composes once from already-baked geometry');
  semantic=true;selectionLayer.setAttribute('transform','matrix('+first.join(' ')+')');captured.onFinish({committed:true,action:first,items:[{kind:'element',semantic:{axisPreview:{}}}]});assert.equal(selectedReads,1);assert.equal(boxReads,1);assert.equal(draws,1);assert.equal(+selectionLayer.firstChild.getAttribute('y'),20);assert.equal(+selectionLayer.firstChild.getAttribute('height'),80,'semantic axis completion remeasures the actual generated axis extent');assert.equal(quick,3);
  captured.onFinish({committed:false,action:first,items});assert.equal(selectedReads,2);assert.equal(boxReads,2);assert.equal(draws,2,'a rejected/cancelled action uses the full restoration path');d.window.close();
});

test('actual partial commit keeps Undo/Redo enabled states and persistence in sync without rebuilding the canvas',()=>{
  const core=require('../skills/polish-sci-figures/assets/figure-studio/studio.js'),clone=value=>JSON.parse(JSON.stringify(value)),initial={order:['p'],columns:1,gap:12,panels:{p:{variant:0,edits:{0:{}}}}},history=new core.History(initial),project={panels:[{id:'p',variants:[{}]}]},fields={undo:{disabled:true},redo:{disabled:true}},notices=[];let persisted=0,rendered=0;
  const ctx={history,project,StudioLayoutLock:require('../skills/polish-sci-figures/assets/figure-studio/layout-lock.js'),original:true,state:()=>history.current,validateState:core.validateState,gridFor:core.gridFor,T:x=>x,$:id=>fields[id],say:x=>notices.push(x),persist:()=>persisted++,render:()=>rendered++};vm.createContext(ctx);vm.runInContext(section('function layoutLockAPI(){','function imageInsetsAPI(){')+section('  let pointerEditCommit=false,pointerEditRefresh=false;','  function migrateLabelHistory(){'),ctx);
  const next=clone(history.current);next.panels.p.edits[0].e1={'object-transform':'[2,0,0,2,3,4]'};assert.equal(ctx.commit(next,'Resize',false),true);assert.equal(history.index,1);assert.equal(fields.undo.disabled,false);assert.equal(fields.redo.disabled,true);assert.equal(persisted,1);assert.equal(rendered,0);assert.equal(ctx.original,false);
  history.undo();fields.undo.disabled=true;fields.redo.disabled=false;const branch=clone(history.current);branch.panels.p.edits[0].e1={'offset-x':'5'};assert.equal(ctx.commit(branch,'Move',false),true);assert.equal(history.states.length,2);assert.equal(history.index,1);assert.equal(fields.undo.disabled,false);assert.equal(fields.redo.disabled,true,'a new partial edit discards redo and updates the header immediately');assert.equal(persisted,2);assert.equal(rendered,0);
  const saved=JSON.parse(JSON.stringify(history.toJSON())),reopened=core.History.restore(saved,project,history.current);assert.deepEqual(reopened.current,history.current);assert.deepEqual(reopened.undo(),initial);reopened.redo();assert.equal(reopened.current.panels.p.edits[0].e1['offset-x'],'5');
  const invalid=clone(history.current);invalid.panels.p.edits[0].e1={'object-transform':'not JSON'};assert.equal(ctx.commit(invalid,'Invalid',false),false);assert.equal(history.index,1);assert.equal(fields.undo.disabled,false);assert.equal(fields.redo.disabled,true);assert.equal(persisted,2);assert.equal(rendered,0);assert.ok(notices.length>=3);
});

dom.window.close();console.log(`${passed} selection performance operation-count regressions passed`);
