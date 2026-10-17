/* Production SVG export/import and saved-image adjustment integration; no raster screenshots. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/',helpers=require(base+'studio.js'),color=require(base+'image-color.js'),insets=require(base+'image-insets.js');
const code=fs.readFileSync(require.resolve(base+'studio.js'),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const extract=(start,end)=>{const a=code.indexOf(start),b=code.indexOf(end,a);assert.ok(a>=0&&b>a,start);return code.slice(a,b);};
const dom=new JSDOM('<!doctype html><html><body><div id="artboard"></div></body></html>',{pretendToBeVisual:true});
// jsdom's CSS declaration omits the standard browser iterator.
if(!dom.window.CSSStyleDeclaration.prototype[Symbol.iterator])dom.window.CSSStyleDeclaration.prototype[Symbol.iterator]=function*(){for(let i=0;i<this.length;i++)yield this.item(i);};
const document=dom.window.document,NS='http://www.w3.org/2000/svg',MARK='data-studio-image-color';
const href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4xQAAAAASUVORK5CYII=';
const source=`<svg xmlns="${NS}" viewBox="0 0 120 80"><image x="10" y="10" width="100" height="60" href="${href}"/></svg>`;
const project={panels:[{id:'panel-1',provenance:'user-import',variants:[{name:'Original',width:120,height:80,viewBox:[0,0,120,80],svg:source}]}]};
let state={order:['panel-1'],columns:1,gap:0,panels:{'panel-1':{variant:0,edits:{}}},overlays:[]},commits=0;
const geometry={width:120,height:80,positions:[{id:'panel-1',x:0,y:0,width:120,height:80}]},templateCache=new Map();
const ctx={...helpers,document,NS,DOMParser:dom.window.DOMParser,StudioImageColor:color,StudioI18n:{language:'en'},project,templateCache,renderSerial:0,imageColorPreview:[],state:()=>state,copy,panel:id=>project.panels.find(p=>p.id===id),layout:()=>geometry,$:id=>document.getElementById(id),T:x=>x,
  selectedPanel:null,selected:[],selectedAnnotations:[],showGuides:false,layoutMode:false,panelSelection:[],
  applyHeatmapPalette(){},applyHeatmapValueLabels(){},appendConditionMatrix(){},refreshHeatmapLabelContrast(){},editsFor:()=>({}),
  fittedVariant:()=>null,fitPlot:()=>false,applyElementOffsets(){},displayedPanelLabel:()=>null,statisticalExportRecords:()=>[],annotationFirstTopHeight:()=>0,
  refreshInsetGraphics(){},commit(next){state=next;commits++;},setTimeout,clearTimeout,
  // Import validates embedded decoding; this adapter never fetches or rasterizes.
  Image:class{set src(value){assert.equal(value,href);this.naturalWidth=this.naturalHeight=1;queueMicrotask(()=>this.onload());}}
};
ctx.previewCommitDepth=0;vm.createContext(ctx);vm.runInContext(extract('  function commitPreviewState(','  function refreshLivePreviews('),ctx);vm.runInContext(code.split('\n').filter(line=>/^  const (TAGS|ATTRS|STYLES) =/.test(line)).join('\n'),ctx);
for(const [a,b]of [
  ['  function safeValue(','  function svgContentSummary('],
  ['  function inlineSvgStyles(','  function validateProject('],
  ['  function baseSvg(','  const heatmapUpgradeRequests='],
  ['  function editedSvg(','  function clearStatisticalResultEdits('],
  ['  function namespace(','  let compactLayoutCache='],
  ['  function imageColorResolve(','  function refreshInsetGraphics('],
  ['  function wrapPanelContent(','  let autosaveQueue=']
])vm.runInContext(extract(a,b),ctx);
const imageOf=root=>root.querySelector('image'),record=root=>color.inspect(imageOf(root),root),serialize=root=>new dom.window.XMLSerializer().serializeToString(root);
function ref(){return {panelId:'panel-1',variant:0,key:imageOf(ctx.baseSvg('panel-1',0)).dataset.key};}
ctx.imageColorSources=()=>[{...ref(),locked:false}];
function preview(){const root=ctx.composite(false,false);document.getElementById('artboard').replaceChildren(root);return root;}
function exportSvg(){const result=ctx.composite(false,true);for(const image of result.querySelectorAll('image'))assert.equal(image.getAttribute('href'),href);return result;}
async function importSvg(text){await ctx.validateSvgImportFeatures(text);const clean=ctx.sanitize(text);project.panels[0].variants[0].svg=serialize(clean);templateCache.clear();state={...state,panels:{'panel-1':{variant:0,edits:{}}}};return clean;}
let count=0;function pass(label){console.log('PASS '+label);count++;}
(async()=>{
 const adjustment=color.validate({strength:.7,exposureEv:.25,temperature:-.2,tint:.3,contrast:1.12,whiteBalance:[1.02,1,.98],reference:'Original reference url(#sample)'});
 ctx.commitImageColors([{source:ref(),adjustment}],'adjust');assert.equal(commits,1);const exported=exportSvg();
 assert.deepEqual(record(exported),adjustment);assert.equal(exported.querySelectorAll(`[${MARK}]`).length,2);
 for(const el of [exported,...exported.querySelectorAll('*')])for(const attr of el.attributes)assert.ok(!attr.name.startsWith('data-')||attr.name===MARK,'only verified color records survive export');
 const clean=await importSvg(serialize(exported));assert.deepEqual(record(clean),adjustment);
 assert.deepEqual(ctx.imageColorCurrent(ref()),adjustment);assert.equal(imageOf(clean).getAttribute('href'),href);
 assert.equal(clean.querySelector('filter').querySelectorAll('[data-key]').length,0);assert.equal(clean.querySelector('filter').hasAttribute('data-key'),false);
 pass('actual composite export and validated SVG import preserve raw embedded bytes, verified filters and editable parameters');

 const baseText=project.panels[0].variants[0].svg;preview();
 const manual=color.validate({...ctx.imageColorCurrent(ref()),exposureEv:-.3,tint:-.4});
 ctx.showImageColorPreview([{source:ref(),adjustment:manual}]);assert.deepEqual(record(document.querySelector('#artboard > svg')),manual);
 ctx.clearImageColorPreview();assert.deepEqual(record(document.querySelector('#artboard > svg')),adjustment);assert.equal(project.panels[0].variants[0].svg,baseText);
 ctx.commitImageColors([{source:ref(),adjustment:manual}],'manual');const second=exportSvg();assert.deepEqual(record(second),manual);
 await importSvg(serialize(second));assert.deepEqual(ctx.imageColorCurrent(ref()),manual);assert.equal(imageOf(ctx.baseSvg('panel-1',0)).getAttribute('href'),href);
 pass('preview cancel returns to imported adjustment; manual edits survive another export and import without baking pixels');

 preview();ctx.showImageColorPreview([{source:ref(),adjustment:null}]);assert.equal(record(document.querySelector('#artboard > svg')),null);
 ctx.clearImageColorPreview();assert.deepEqual(record(document.querySelector('#artboard > svg')),manual);
 ctx.commitImageColors([{source:ref(),adjustment:null}],'reset');const identity=color.validate({mode:'brightfield'});
 assert.deepEqual(copy(ctx.imageColorCurrent(ref())),identity);assert.deepEqual(record(exportSvg()),identity);
 const saved=JSON.parse(JSON.stringify(state));state=saved;preview();assert.deepEqual(record(document.querySelector('#artboard > svg')),identity);
 const raw=ctx.editedSvg('panel-1',0,state,true);assert.equal(record(raw),null);assert.equal(imageOf(raw).getAttribute('href'),href);assert.equal(raw.querySelector('filter'),null);
 await importSvg(serialize(exportSvg()));assert.deepEqual(ctx.imageColorCurrent(ref()),identity);
 pass('reset remains neutral after saved-state restore and reimport; Compare original removes display adjustment only');

 const live=preview(),sourceRef=ref(),sourceImage=ctx.imageColorResolve(sourceRef);
 const inset={id:'annotation-1',type:'inset',x:.65,y:.65,w:.2,h:.3,text:'',font:'Arial',size:9,stroke:1,color:'#ffffff',opacity:1,fill:false,bold:false,locked:false,source:{...sourceRef,widthPx:1,heightPx:1},roi:{x:0,y:0,w:1,h:1},connector:true,showScale:false};
 const wrapper=document.createElementNS(NS,'g');wrapper.dataset.annotation=inset.id;wrapper.append(insets.renderContent(inset,{root:live,geometry}));live.append(wrapper);state.overlays=[inset];
 const cropImage=wrapper.querySelector('image[data-studio-inset-source]');assert.ok(cropImage,'real inset renderer creates the crop source: '+wrapper.querySelector('[data-inset-error]')?.getAttribute('data-inset-error'));const crop=cropImage.ownerSVGElement,geometryBefore=crop.getAttribute('viewBox');
 const mutationLog=[];for(const image of [sourceImage,cropImage]){const set=image.setAttribute.bind(image);image.setAttribute=(name,value)=>{if(name==='href'||name==='xlink:href')mutationLog.push(name);return set(name,value);};}
 let sourceUpdates=0,insetUpdates=0;ctx.StudioImageColor={...color,apply(image,...args){if(image===sourceImage)sourceUpdates++;if(image===cropImage)insetUpdates++;return color.apply(image,...args);}};
 for(const tint of [.1,.2,.3])ctx.showImageColorPreview([{source:sourceRef,adjustment:{...identity,tint}}]);
 assert.equal(sourceUpdates,3,'a moving slider applies each new value once, without restoring the preceding value first');assert.equal(insetUpdates,3);
 assert.equal(wrapper.querySelector('image[data-studio-inset-source]'),cropImage);assert.equal(cropImage.ownerSVGElement,crop);assert.equal(crop.getAttribute('viewBox'),geometryBefore);assert.deepEqual(mutationLog,[]);assert.equal(record(crop).tint,.3);
 ctx.showImageColorPreview([]);assert.deepEqual(record(live),identity);assert.deepEqual(record(crop),identity);assert.equal(sourceUpdates,4,'removing a preview target restores the saved display once');assert.equal(insetUpdates,4);assert.deepEqual(mutationLog,[]);
 state.overlays=[];wrapper.remove();ctx.StudioImageColor=color;
 pass('repeated preview ticks update only coefficients: one source update, stable inset image/crop DOM and no raw-href writes');

 const valid=ctx.baseSvg('panel-1',0),bad=valid.cloneNode(true);bad.querySelector('feFuncR').setAttribute('slope','99');
 await assert.rejects(ctx.validateSvgImportFeatures(serialize(bad)),/无法保留外观/);const cleanedBad=ctx.sanitize(serialize(bad));assert.equal(cleanedBad.querySelector('filter'),null);assert.equal(imageOf(cleanedBad).hasAttribute(MARK),false);
 const external=`<svg xmlns="${NS}" viewBox="0 0 120 80"><defs><filter id="external"><feGaussianBlur stdDeviation="2"/></filter></defs><image width="120" height="80" href="${href}" filter="url(#external)"/></svg>`;
 await assert.rejects(ctx.validateSvgImportFeatures(external),/无法保留外观/);
 const script=valid.cloneNode(true);script.querySelector('filter').append(document.createElementNS(NS,'script'));await assert.rejects(ctx.validateSvgImportFeatures(serialize(script)),/无法保留外观/);
 const foreign=valid.cloneNode(true),transfer=foreign.querySelector('feComponentTransfer'),fake=document.createElementNS('urn:untrusted','feComponentTransfer');fake.setAttribute('in','SourceGraphic');fake.append(...transfer.children);transfer.replaceWith(fake);await assert.rejects(ctx.validateSvgImportFeatures(serialize(foreign)),/无法保留外观/);
 const duplicate=valid.cloneNode(true);duplicate.append(duplicate.querySelector('filter').cloneNode(true));await assert.rejects(ctx.validateSvgImportFeatures(serialize(duplicate)),/无法保留外观/);
 pass('arbitrary, modified, script-bearing and ambiguous filters cannot use the reversible-filter import exception');
 dom.window.close();console.log(`${count} image-color production round-trip groups passed`);
})().catch(error=>{console.error(error);process.exitCode=1;dom.window.close();});
