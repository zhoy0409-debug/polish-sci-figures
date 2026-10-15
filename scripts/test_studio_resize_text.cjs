/* Production read/write/render helpers with real SVG DOM. No browser font
 * rasterizer is claimed: assertions use the actual SVG affine/em basis. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/';
const source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8'),html=fs.readFileSync(require.resolve(base+'studio.html'),'utf8');
const main=require(base+'studio.js'),rich=require(base+'rich-text.js'),geometry=require(base+'image-insets.js'),affine=require(base+'selection-transform.js'),presentation=require(base+'selection-transform-dom.js'),gridResize=require(base+'grid-resize-ui.js');
const copy=value=>JSON.parse(JSON.stringify(value)),NS='http://www.w3.org/2000/svg';
const close=(actual,expected,label='')=>assert.ok(Math.abs(actual-expected)<=1e-8*Math.max(1,Math.abs(expected)),`${label}: ${actual} != ${expected}`);
let passed=0;const failures=[];
function test(name,run){try{run();passed++;console.log('PASS '+name);}catch(error){failures.push(error);console.error('FAIL '+name+'\n'+error.stack);}}
function chunk(start,end){const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Missing production block '+start);return source.slice(a,b);}
const editBlock=chunk('    // Prepare all positioned text before styles change inherited font bases.','    // Work on complete category groups');
const typographyBlock=chunk('    if(!raw&&s.typography','    if(!raw && s.panels[id].geometry)');
const helpers=[
  chunk('  let labelSelections=[];','  const sizeNames='),
  chunk('  function selectionCommandInfo(){','  function renderSelectionCommands(){'),
  chunk('function validPresentationMatrix(','function heatmapCellInfo('),
  chunk('  function textPointSize(','  async function ensureReflows('),
  chunk('  function paint(el, prop)','  function statisticalAnalysisFor('),
  chunk('  function setEdit(','  let statisticalLineGesture='),
  chunk('  function targetObjects(','  function paletteHeatmapInfo('),
  chunk('  function quickSelectedObjects(','  function cancelQuickPreview('),
  chunk('  function renderQuickToolbar(','  function setupQuickToolbar('),
  chunk('  function renderSelectionProperties(','  let literatureBrowser='),
  chunk('  function namespace(svg)','  let compactLayoutCache='),
  chunk('  function applyElementOffsets(','  let autosaveQueue='),
  chunk('  function previewCategorySpacing(','  function cancelCategorySpacing('),
  `function editedSvg(id,vi,s=state(),raw=false){const svg=parse();${typographyBlock}${editBlock}return svg;}`
].join('\n');
function harness(body,{width=400,viewWidth=400,scale=1,keys=['e1'],edits={},content=[1,0,0,1,0,0],backgrounds=[],typography=null,manual=null}={}){
  const dom=new JSDOM(html),document=dom.window.document,$=id=>document.getElementById(id);
  const raw=`<svg xmlns="${NS}" width="${width}pt" height="200pt" viewBox="0 0 ${viewWidth} ${200*viewWidth/width}">${body}</svg>`;
  const asset={id:'p0',name:'Synthetic imported PDF',provenance:'user-import',variants:[{width,height:200,viewBox:[0,0,viewWidth,200*viewWidth/width],svg:raw}]};
  const project={id:'resize-text-regression',panels:[asset]},initial={order:['p0'],columns:1,gap:0,panels:{p0:{variant:0,edits:{0:copy(edits)},contentTransforms:{0:[...content]},contentBackgrounds:{0:[...backgrounds]},useUnifiedTypography:!!typography}},...(typography?{typography}:{}),overlays:[]};
  if(manual)initial.grid={rows:1,widths:[manual.width],heights:[manual.height],manualTracks:true,places:{p0:{row:0,col:0,rs:1,cs:1}}};
  let current=copy(initial);const history=new main.History(current),messages=[];
  const parse=()=>new dom.window.DOMParser().parseFromString(raw,'image/svg+xml').documentElement;
  const layout=()=>{const w=current.grid?.widths?.[0]||width,h=current.grid?.heights?.[0]||200;return {width:w,height:h,positions:[{id:'p0',x:0,y:0,width:w,height:h}],cells:[]};};
  const ctx={copy,NS,document,$,parse,StudioGridResize:gridResize,StudioRichText:rich,StudioTextFormatting:require(base+'text-formatting.js'),StudioImageInsets:geometry,StudioSelectionTransform:affine,StudioSelectionTransformDOM:presentation,StudioI18n:{panelName:p=>p.name},project,preparePositionedTextEdit:main.preparePositionedTextEdit,
    original:false,selectedPanel:'p0',selected:[...keys],selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,panelSelection:[],contentSelection:null,selectedEmptyCell:null,textTools:null,layoutMode:false,showGuides:false,renderSerial:0,
    state:()=>current,panel:()=>asset,currentOutput:()=>({scale}),layout,
    selectionGroups:()=>[{id:'p0',vi:0,keys:[...ctx.selected]}],keysToObjects:svg=>[...svg.querySelectorAll('[data-key]')],
    T:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[i]),say:text=>messages.push(text),
    renderSelectionCommands(){},renderEditingPanels(){},syncColorControls(){},renderFontTargets(){},renderComponentStyle(){},renderHeatmapControls(){},renderRichTextControls(){},renderStatisticalLineControls(){},
    fittedVariant:()=>null,fitPlot:()=>false,statisticalExportRecords:()=>[],statisticalAnalysisFor:()=>null,annotationFirstTopHeight:()=>0,gridFor:main.gridFor,displayedPanelLabel:()=>null,exportGeometry:main.exportGeometry,
    conditionMatrixHeight:()=>0,addStatisticalHitAreas:()=>{},zoomView:null,categorySpacingFactor:()=>1,categorySpacingMessage:()=>'',
    commit(next){main.validateState(next,project);history.commit(next);current=copy(next);render();return true;},renderCanvas:next=>render(next||current)
  };
  vm.createContext(ctx);vm.runInContext(helpers,ctx);
  ctx.editableSource=(id,vi,s=current)=>{const svg=ctx.editedSvg(id,vi,s);svg.setAttribute('data-editable-source','true');return svg;};
  function render(s=current){const root=ctx.composite(false,false,s);$('artboard').replaceChildren(root);return root;}
  $('scope').value='element';render();
  const node=key=>$('artboard').querySelector(`[data-key="${key||ctx.selected[0]}"]`);
  const readings=()=>{ctx.renderSelectionProperties();return {sidebar:$('fontSize').value,quick:$('quickFontSize').value};};
  const effective=(el=node(),root=$('artboard').querySelector('svg'))=>rich.pointSize(el)*rich.localFontScale(el,root)*scale;
  return {ctx,dom,document,$,asset,project,history,initial,raw,node,readings,render,effective,current:()=>current,replace(next){current=copy(next);render();},quick(value){ctx.commit(ctx.quickStyleState(current,ctx.quickSelectedObjects(),'font-size',String(value)));},close(){dom.window.close();}};
}

test('content scaling is included once by live and detached text controls',()=>{
  const h=harness('<text data-key="e1" font-family="Arial" font-size=".24" transform="matrix(50 0 0 50 30 40)" x="0 .1 .2">ABC</text>',{content:[2,0,0,3,10,20]});try{
    close(h.effective(),36);assert.deepEqual(h.readings(),{sidebar:'36',quick:'36'});
    h.ctx.updateStyle('font-size','18','text');close(h.effective(),18);assert.deepEqual(h.readings(),{sidebar:'18',quick:'18'});close(+h.current().panels.p0.edits[0].e1['font-size'],.12);
    h.quick(30);close(h.effective(),30);assert.deepEqual(h.readings(),{sidebar:'30',quick:'30'});assert.deepEqual(h.current().panels.p0.contentTransforms[0],[2,0,0,3,10,20]);assert.equal(h.asset.variants[0].svg,h.raw);
  }finally{h.close();}
});

test('individual scaling, rotation, content scaling, viewport and export pt agree',()=>{
  const h=harness('<text data-key="e1" font-size=".24" transform="matrix(0 50 -50 0 30 40)">ABC</text>',{width:200,viewWidth:400,scale:2,content:[2,0,0,3,0,0],edits:{e1:{'object-transform':'[1.5,0,0,2,4,8]'}}});try{
    close(h.effective(),36);assert.deepEqual(h.readings(),{sidebar:'36',quick:'36'});h.ctx.updateStyle('font-size','24','text');close(h.effective(),24);h.quick(12);close(h.effective(),12);assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});
  }finally{h.close();}
});

test('manual cells scale figures in both directions but sidebar/quick 12 pt stays physical 12 pt',()=>{
 for(const manual of [{width:200,height:120},{width:800,height:400}]){
  const h=harness('<text data-key="e1" font-family="Arial" font-size=".24" transform="matrix(50 0 0 50 30 40)">PDF label</text>',{manual});try{
   const factor=Math.min(manual.width/400,manual.height/200);close(h.effective(),12*factor);assert.deepEqual(h.readings(),{sidebar:String(12*factor),quick:String(12*factor)});
   h.ctx.updateStyle('font-size','12','text');close(h.effective(),12);assert.deepEqual(h.readings(),{sidebar:'12',quick:'12'});close(+h.current().panels.p0.edits[0].e1['font-size'],12/(50*factor));
   h.quick(9);close(h.effective(),9);assert.deepEqual(h.readings(),{sidebar:'9',quick:'9'});h.quick(12);close(h.effective(),12);const exported=h.ctx.composite(false,true,h.current()),text=exported.querySelector('text');close(rich.pointSize(text)*rich.localFontScale(text,exported),12);assert.equal(h.asset.variants[0].svg,h.raw);
  }finally{h.close();}
 }
});

test('mark/group-spacing live previews retain contain viewport and prior content editing',()=>{
 for(const manual of [{width:200,height:120},{width:800,height:400}]){
  const h=harness('<text data-key="e1" font-size="12" x="40" y="40">Value</text><path data-key="e2" d="M 20 100 L 180 60"/>',{manual,content:[1.2,0,0,1.2,8,12]});try{
   const panel=()=>h.$('artboard').querySelector('svg[data-panel]'),read=()=>Object.fromEntries(['x','y','width','height','viewBox'].map(key=>[key,panel().getAttribute(key)])),before=read(),font=h.effective();h.ctx.fitPlot=()=>{throw Error('Manual preview must not stretch a chart');};
   for(const markStyle of [true,false]){const next=copy(h.current());next.panels.p0.markStyle={pointScale:1.5,errorWidth:2};h.ctx.previewCategorySpacing({id:'p0',vi:0,pos:h.ctx.layout().positions[0],flow:{width:900,height:100,viewBox:[0,0,900,100]},margins:{},info:{},markStyle},next);assert.deepEqual(read(),before);close(h.effective(),font);assert.equal(panel().querySelector('[data-panel-content]').getAttribute('transform'),'matrix(1.2 0 0 1.2 8 12)');h.render(next);assert.deepEqual(read(),before);close(h.effective(),font);}
  }finally{h.close();}
 }
});

test('resized ancestor group is included in detached read/write as well as live quick toolbar',()=>{
  const h=harness('<g data-key="e9" transform="translate(30 20)"><text data-key="e1" font-size="6" transform="scale(2)">Nested</text></g>',{content:[2,0,0,3,0,0],edits:{e9:{'object-transform':'[2,0,0,2,0,0]'}}});try{
    close(h.effective(),72);assert.deepEqual(h.readings(),{sidebar:'72',quick:'72'});h.ctx.updateStyle('font-size','24','text');close(h.effective(),24);assert.deepEqual(h.readings(),{sidebar:'24',quick:'24'});h.quick(18);close(h.effective(),18);
  }finally{h.close();}
});

test('changing only font family preserves physical size after whole-content scaling',()=>{
  const h=harness('<text data-key="e1" font-size="12" font-family="Arial">ABC<tspan data-key="e2" font-size="8">sub</tspan></text>',{content:[2,0,0,3,10,20]});try{
    const before=h.effective(),transforms=copy(h.current().panels.p0.contentTransforms);h.ctx.updateStyle('font-family','Times New Roman','text');close(h.effective(),before);close(rich.pointSize(h.node('e2')),8);assert.deepEqual(h.current().panels.p0.contentTransforms,transforms);assert.equal(h.node().style.fontFamily,'Times New Roman');assert.deepEqual(h.readings(),{sidebar:'36',quick:'36'});
  }finally{h.close();}
});

test('unified typography retains resize multiplication and stored child-size ratios',()=>{
  const h=harness('<text data-key="e1" data-role="title" font-size="12">ABC<tspan data-key="e2" font-size="6">sub</tspan></text>',{content:[2,0,0,3,0,0],typography:{font:'Arial',size:8}});try{
    close(h.effective(),24);close(rich.pointSize(h.node('e2')),4);assert.deepEqual(h.readings(),{sidebar:'24',quick:'24'});const next=copy(h.current());next.typography.font='Times New Roman';h.replace(next);close(h.effective(),24);assert.equal(h.node().style.fontFamily,'Times New Roman');
  }finally{h.close();}
});

test('export, JSON/history restoration and original comparison preserve exact geometry',()=>{
  const raster='data:image/png;base64,AA==',h=harness(`<defs><clipPath id="crop"><rect width="150" height="100"/></clipPath></defs><g clip-path="url(#crop)"><text data-key="e1" font-size=".012" transform="scale(1000)" x="0 .006 .012">ABC</text><image data-key="e2" href="${raster}" width="60" height="40"/></g>`,{content:[1.5,0,0,2,15,10],edits:{e1:{'object-transform':'[2,0,0,2,0,0]'}}});try{
    h.quick(18);const physical=h.effective(),saved=JSON.parse(JSON.stringify({project:h.project,state:h.current(),history:h.history})),history=main.History.restore(saved.history,saved.project,saved.state);assert.deepEqual(history.current,saved.state);h.replace(history.current);close(h.effective(),physical);
    const exported=h.ctx.composite(false,true,h.current()),text=exported.querySelector('text');close(rich.pointSize(text)*rich.localFontScale(text,exported),physical);assert.equal(exported.querySelector('[data-key]'),null);assert.equal(exported.querySelector('image').getAttribute('href'),raster);assert.match(text.parentElement.getAttribute('clip-path'),/^url\(#f\d+-crop\)$/);assert.ok(exported.querySelector('clipPath'));
    const original=h.ctx.composite(true,true,h.current());close(rich.pointSize(original.querySelector('text'))*rich.localFontScale(original.querySelector('text'),original),12);assert.equal(h.asset.variants[0].svg,h.raw);
  }finally{h.close();}
});

test('fitting retains one unscaled page background and keeps definitions in place',()=>{
  const h=harness('<defs><clipPath id="c"><rect width="400" height="200"/></clipPath></defs><g id="figure_1"><g id="patch_1" fill="#ffffff"><rect data-key="e9" width="400" height="200"/></g><text data-key="e1" font-size="12">ABC</text></g>',{content:[3,0,0,3,10,20],backgrounds:['e9']});try{
    const live=h.$('artboard').querySelector('svg[data-panel]'),wrapper=live.querySelector('[data-panel-content]'),backgrounds=[...live.children].filter(n=>n.localName==='rect');assert.equal(backgrounds.length,1);close(geometry.relativeMatrix(backgrounds[0],live).a,1);close(geometry.relativeMatrix(h.node(),live).a,3);assert.equal(wrapper.querySelector('[data-key="e9"]').style.display,'none');assert.equal(live.querySelector('defs').parentElement,live);assert.equal(backgrounds[0].style.fill,'#ffffff');
    const exported=h.ctx.composite(false,true,h.current()),panel=exported.querySelector('svg');assert.equal([...panel.children].filter(n=>n.localName==='rect').length,1);assert.equal(panel.querySelector('defs').parentElement,panel);assert.equal(h.asset.variants[0].svg,h.raw);
  }finally{h.close();}
});

test('keyboard nudges retain canvas distance after scale, rotation and saved reopening',()=>{
  for(const matrix of [[2,0,0,3,10,20],[0,2,-3,0,10,20],[.5,0,0,.5,10,20]]){
    const h=harness('<text data-key="e1" font-size="12" x="10" y="20">ABC</text>',{content:matrix});try{
      const before=geometry.point(geometry.relativeMatrix(h.node(),h.$('artboard').querySelector('svg')),{x:10,y:20}),baseState=h.current(),item={kind:'element',id:'p0',vi:0,key:'e1',el:h.node()};
      const result=main.nudgeSelectionState(baseState,[item],1,-2,h.ctx.layout());h.replace(result.next);const after=geometry.point(geometry.relativeMatrix(h.node(),h.$('artboard').querySelector('svg')),{x:10,y:20});close(after.x-before.x,1);close(after.y-before.y,-2);assert.deepEqual(baseState.panels.p0.edits[0],{});close(result.dx,1);close(result.dy,-2);
    }finally{h.close();}
  }
});
console.log(`${passed} resize/text/render integrations passed`);
if(failures.length){console.error(`${failures.length} integration(s) failed`);process.exitCode=1;}

