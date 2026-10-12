/* Content and CSS import checks run production helpers in a bounded DOM adapter. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(file),'utf8'),{classifySvgContent}=require(file);
class Style{
  constructor(){this.values=new Map();}
  set cssText(value){this.values.clear();for(const declaration of value.split(';')){const pair=declaration.match(/^\s*([\w-]+)\s*:\s*(.*?)\s*$/);if(pair)this.setProperty(pair[1],pair[2].replace(/\s*!important$/,''),/!important$/.test(pair[2])?'important':'');}}
  getPropertyValue(key){return this.values.get(key)?.value||'';}getPropertyPriority(key){return this.values.get(key)?.priority||'';}
  setProperty(key,value,priority=''){this.values.set(key,{value:String(value),priority});}
  [Symbol.iterator](){return this.values.keys();}
}
class Node{
  constructor(tag,attrs={},children=[],text=''){this.localName=tag;this.attrs={...attrs};this.children=children;this.own=text;this.style=new Style();this.style.cssText=attrs.style||'';this.children.forEach(child=>child.parentElement=this);}
  get namespaceURI(){return 'svg';}get id(){return this.attrs.id||'';}get textContent(){return this.own+this.children.map(child=>child.textContent).join('');}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,localName:name,value:String(value)}));}
  get dataset(){return Object.fromEntries(Object.entries(this.attrs).filter(([k])=>k.startsWith('data-')).map(([k,v])=>[k.slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase()),v]));}
  getAttribute(key){return this.attrs[key]??null;}setAttribute(key,v){this.attrs[key]=String(v);}hasAttribute(key){return key in this.attrs;}
  removeAttribute(key){delete this.attrs[key];if(key==='style')this.style.cssText='';}removeAttributeNode(attr){this.removeAttribute(attr.name);}
  getAttributeNS(_,key){return this.getAttribute(key);}
  matches(selector){if(selector==='*')return true;const attr=selector.match(/^([a-z]+)?\[([^=\]]+)(?:="([^"]+)")?\]$/);if(attr)return (!attr[1]||attr[1]===this.localName)&&this.hasAttribute(attr[2])&&(attr[3]===undefined||this.getAttribute(attr[2])===attr[3]);if(selector==='path[data-stat-bracket][data-key]')return this.localName==='path'&&this.hasAttribute('data-stat-bracket')&&this.hasAttribute('data-key');if(selector[0]==='#')return this.id===selector.slice(1);if(selector[0]==='.')return (this.attrs.class||'').split(/\s+/).includes(selector.slice(1));return this.localName===selector;}
  querySelectorAll(selector){const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);return all.filter(child=>child.matches(selector));}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  remove(){const p=this.parentElement;if(p)p.children=p.children.filter(child=>child!==this);}
  before(node){const p=this.parentElement;node.parentElement=p;p.children.splice(p.children.indexOf(this),0,node);}
}
const n=(...args)=>new Node(...args),root=children=>n('svg',{viewBox:'0 0 100 100'},children),image=()=>n('image',{href:'data:image/png;base64,AA==',width:100,height:100}),background=()=>n('rect',{width:100,height:100,fill:'#fff'});
for(const bg of [background(),n('path',{fill:'white',d:'M 0 100 L 100 100 L 100 0 L 0 0 z'})])assert.equal(classifySvgContent(root([bg,image()])).kind,'raster','an SVG wrapper around an image does not create editable text');
let info=classifySvgContent(root([n('defs',{},[n('path',{id:'unused'})]),n('g',{display:'none'},[n('text',{},[],'hidden')]),image()]));assert.deepEqual(info,{text:0,vector:0,image:1,outlined:0,kind:'raster'});
info=classifySvgContent(root([image(),n('text',{},[],'Live text'),n('circle',{r:10})]));assert.equal(info.kind,'mixed');assert.equal(info.text,1);assert.equal(info.vector,1);
info=classifySvgContent(root([n('defs',{},[n('path',{id:'DejaVuSans-41',d:'M 1 1 L 2 2'})]),n('use',{href:'#DejaVuSans-41'})]));assert.equal(info.kind,'vector');assert.equal(info.outlined,1);assert.equal(info.text,0);
assert.equal(classifySvgContent(root([background()])).kind,'empty');
assert.equal(classifySvgContent(root([n('defs',{},[n('use',{id:'cycle',href:'#cycle'})]),n('use',{href:'#cycle'})])).kind,'empty');
const context={document:{createElement:()=>({style:new Style()}),createElementNS:(_,tag)=>n(tag)},T:x=>x,NS:'svg',TAGS:new Set(['svg','g','path','rect','circle','text']),isVisibleObject:el=>el.style.getPropertyValue('display')!=='none'};vm.createContext(context);
vm.runInContext(source.split('\n').find(line=>line.includes('const STYLES = new Set'))+source.slice(source.indexOf('  function safeValue('),source.indexOf('  function svgContentSummary('))+source.slice(source.indexOf('  function inlineSvgStyles('),source.indexOf('  function sanitize(')),context);
const style=text=>n('style',{},[],text),shape=n('path',{id:'plot',class:'st0',style:'stroke: blue'}),styled=root([style('.st0 { fill: red; stroke: green } #plot { fill: purple }'),shape]);
context.inlineSvgStyles(styled);assert.equal(shape.style.getPropertyValue('fill'),'purple');assert.equal(shape.style.getPropertyValue('stroke'),'blue');assert.equal(styled.querySelectorAll('style').length,0);
const important=n('path',{class:'st0',style:'fill: blue'});context.inlineSvgStyles(root([style('.st0 {fill: red !important}'),important]));assert.equal(important.style.getPropertyValue('fill'),'red');
const rdf=n('RDF');delete rdf.style;Object.defineProperty(rdf,'namespaceURI',{value:'http://www.w3.org/1999/02/22-rdf-syntax-ns#'});const rdfShape=n('path');context.inlineSvgStyles(root([n('metadata',{},[rdf]),style('* {stroke-linejoin:round;stroke-linecap:butt;stroke-miterlimit:4}'),rdfShape]));assert.equal(rdfShape.style.getPropertyValue('stroke-linejoin'),'round','Matplotlib universal CSS skips non-SVG RDF metadata that has no style API');
const ownImportant=n('path',{class:'st0',style:'fill: blue !important'});context.inlineSvgStyles(root([style('.st0 {fill: red !important}'),ownImportant]));assert.equal(ownImportant.style.getPropertyValue('fill'),'blue');
for(const css of ['@import "https://remote/style.css";','.st0 {fill:url(https://remote/a)}','path:hover {fill:red}','path {filter: blur(1px)}','@media screen { path {fill:red} }'])assert.throws(()=>context.inlineSvgStyles(root([style(css),n('path',{class:'st0'})])),'unsafe or unsupported style fails explicitly');
// A proxy preserves original geometry, maps to one key, and sits behind P text.
vm.runInContext(source.slice(source.indexOf('  function canvasObjectTarget('),source.indexOf('  function paint(')),context);
const bracket=n('path',{'data-key':'e900001','data-stat-bracket':'{}',d:'M 10 20 V 15 H 70 V 20',transform:'translate(1 2)'}),label=n('text',{'data-key':'e900002','data-stat-top':'15'},[],'P = 0.032'),panel=n('svg',{'data-panel':'p'},[label,bracket]);context.addStatisticalHitAreas(panel);
const hit=panel.children[0];assert.equal(hit.getAttribute('stroke-width'),'12');assert.equal(hit.getAttribute('vector-effect'),'non-scaling-stroke');assert.equal(hit.getAttribute('d'),bracket.getAttribute('d'));assert.equal(hit.getAttribute('transform'),'translate(1 2)');assert.equal(hit.hasAttribute('data-key'),false);assert.equal(context.canvasObjectTarget(hit),bracket);assert.equal(panel.children[1],label,'text is painted above the transparent line corridor');
assert.equal(source.slice(source.indexOf('  function composite('),source.indexOf('  function renderOverlayProperties(')).includes('addStatisticalHitAreas('),false,'export composition never creates editor hit targets');
console.log('PASS SVG content: actual raster/mixed/native-text/vector classification, glyph and background handling, safe CSS cascade, unsupported CSS rejection, and isolated statistical hit proxies.');

(async()=>{
  const trees=new Map();let serial=0,decoded=0;
  context.classifySvgContent=classifySvgContent;context.setTimeout=setTimeout;context.clearTimeout=clearTimeout;
  context.DOMParser=class{parseFromString(raw){return {documentElement:trees.get(raw),querySelector:()=>null};}};
  context.Image=class{set src(href){decoded++;this.naturalWidth=this.naturalHeight=href.endsWith('GOOD')?10:0;queueMicrotask(()=>this.naturalWidth?this.onload():this.onerror());}};
  const check=tree=>{const id='fixture-'+ ++serial;trees.set(id,tree);return context.validateSvgImportFeatures(id);};
  // Unused effects in defs do not make an otherwise ordinary SVG incompatible.
  await check(root([n('defs',{},[n('filter',{id:'unused'})]),n('path',{d:'M 1 1 L 2 2'})]));
  for(const [tag,attribute]of [['filter','filter'],['mask','mask'],['pattern','fill'],['marker','marker-end']]){
    const tree=root([n('defs',{},[n(tag,{id:'effect'})]),n('path',{d:'M 1 1 L 2 2',[attribute]:'url(#effect)'})]);
    await assert.rejects(check(tree),/当前无法保留外观的效果/);
  }
  for(const tag of ['foreignObject','textPath'])await assert.rejects(check(root([n(tag,{},[],'content')])),/当前无法保留外观的效果/);
  for(const css of ['mix-blend-mode:multiply','mix-blend-mode:screen;opacity:0.5','isolation:isolate','transform:translateX(2px)','paint-order:stroke fill'])await assert.rejects(check(root([n('path',{d:'M 1 1 L 2 2',style:css})])),/当前无法保留外观的效果/,'unsupported inline appearance must never be silently stripped');
  await check(root([n('path',{d:'M 1 1 L 2 2',style:'mix-blend-mode:normal;isolation:auto;opacity:0.35;fill-opacity:0.4;stroke-opacity:0.5'})]));
  await assert.rejects(check(root([n('g',{style:'mix-blend-mode:multiply'},[n('rect',{width:20,height:20})])])),/当前无法保留外观的效果/,'a parent group blend is also checked');
  for(const href of [undefined,'https://example.invalid/private.png','file:///private.png'])await assert.rejects(check(root([n('image',{width:20,height:20,...(href?{href}:{})})])),/图片未嵌入/);
  assert.equal(decoded,0,'external images are rejected before any image request is created');
  for(const node of [n('use',{href:'#missing'}),n('use',{href:'external.svg#plot'}),n('path',{fill:'url(#missing)'})])await assert.rejects(check(root([node])),/缺失或外部链接/);
  await assert.rejects(check(root([background()])),/未发现可导入/);
  await assert.rejects(check(root([n('image',{width:20,height:20,href:'data:image/png;base64,AA=='})])),/嵌入图片无法读取/);
  await check(root([n('image',{width:20,height:20,href:'data:image/png;base64,GOOD'})]));
  const clip=root([n('defs',{},[n('clipPath',{id:'clip'},[n('rect',{width:20,height:20})])]),n('path',{'clip-path':'url(#clip)',d:'M 1 1 L 2 2'})]);await check(clip);
  await check(root([n('defs',{},[n('linearGradient',{id:'gradient'},[n('stop',{offset:0,'stop-color':'red'})])]),n('path',{fill:'url(#gradient)',d:'M 1 1 L 2 2'})]));
  await assert.rejects(check(root([n('defs',{},[n('linearGradient',{id:'gradient',href:'https://example.invalid/gradient.svg#g'})]),n('path',{fill:'url(#gradient)',d:'M 1 1 L 2 2'})])),/缺失或外部链接/);
  const focusedGradient=n('radialGradient',{id:'focused',cx:'50%',cy:'50%',r:'50%',fx:'30%',fy:'65%',fr:'8%','color-interpolation':'linearRGB'},[n('stop',{offset:0,'stop-color':'red'})]),lettering=n('text',{'letter-spacing':'1.2','word-spacing':'2.4','stroke-miterlimit':'7',style:'letter-spacing:1.5px;word-spacing:3px;stroke-miterlimit:6;opacity:0.45;fill-opacity:0.3;stroke-opacity:0.7'},[],'Text with spacing'),faithful=root([n('defs',{},[focusedGradient]),n('rect',{width:30,height:30,fill:'url(#focused)'}),lettering]);
  await check(faithful);
  // Exercise the actual sanitizer, not just allowlist membership, so both
  // presentation attributes and inline values must survive the saved SVG.
  vm.runInContext(source.split('\n').filter(line=>line.includes('const TAGS = new Set')||line.includes('const ATTRS = new Set')).join('\n')+source.slice(source.indexOf('  function sanitize('),source.indexOf('  function validateProject(')),context);context.document.importNode=node=>node;
  trees.set('faithful-import',faithful);const clean=context.sanitize('faithful-import'),gradient=clean.querySelector('#focused');for(const [prop,value]of Object.entries({fx:'30%',fy:'65%',fr:'8%','color-interpolation':'linearRGB'}))assert.equal(gradient.getAttribute(prop),value);
  for(const [prop,value]of Object.entries({'letter-spacing':'1.2','word-spacing':'2.4','stroke-miterlimit':'7'}))assert.equal(lettering.getAttribute(prop),value);
  for(const [prop,value]of Object.entries({'letter-spacing':'1.5px','word-spacing':'3px','stroke-miterlimit':'6',opacity:'0.45','fill-opacity':'0.3','stroke-opacity':'0.7'}))assert.equal(lettering.style.getPropertyValue(prop),value);
  const branch=source.slice(source.indexOf("if(file.name.toLowerCase().endsWith('.svg'))"),source.indexOf("else{if(!['image/png'",source.indexOf("if(file.name.toLowerCase().endsWith('.svg'))")));
  assert.ok(branch.includes('await validateSvgImportFeatures(raw);const clean=sanitize(raw)'),'user SVG import waits for validation before installing or replacing any asset');
  const inspector={scrollTop:420},fields=Object.fromEntries(['h2','.import-content-description','.muted','button'].map(key=>[key,{textContent:''}]));let shown=0;
  const dialog={open:false,querySelector:key=>fields[key],showModal(){shown++;this.open=true;},close(){this.open=false;}};
  const notice={document:{querySelector:()=>inspector},$:()=>dialog,T:x=>x,svgContentSummary:info=>info.kind};vm.createContext(notice);vm.runInContext(source.slice(source.indexOf('  function showImportedContentNotice('),source.indexOf('  function inlineSvgStyles(')),notice);
  notice.showImportedContentNotice({kind:'text-vector'});assert.equal(shown,0);assert.equal(inspector.scrollTop,0,'native vector import reveals the persistent inspector notice without a modal');
  notice.showImportedContentNotice({kind:'raster'});assert.equal(shown,1);assert.equal(fields['.import-content-description'].textContent,'raster');
  notice.showImportedContentNotice({kind:'mixed'});assert.equal(shown,1,'an existing notice is updated, not stacked');assert.equal(fields['.import-content-description'].textContent,'mixed');dialog.close();
  notice.showImportedContentNotice({kind:'vector',outlined:2});assert.equal(shown,2,'outlined text also explains its editing limits after import');
  const handler=source.slice(source.indexOf("  $('imageFile').onchange="),source.indexOf('  let insertionCell='));assert.ok(handler.indexOf('installAsset(')<handler.indexOf('showImportedContentNotice(contentInfo)'),'notice is informational after import, never an approval step');assert.ok(handler.includes('await openPdfImport(file,target);return;'),'PDF keeps its own preview and gets no second notice');
  console.log('PASS SVG import guard: unused definitions allowed; referenced effects, foreign/text paths, absent/external resources, invalid embedded images and empty imports rejected before asset mutation.');
  console.log('PASS imported-content notice: raster/mixed/outlines only, displayed after asset installation, inspector reset and no duplicate PDF dialog.');
})().catch(error=>{console.error(error);process.exitCode=1;});
