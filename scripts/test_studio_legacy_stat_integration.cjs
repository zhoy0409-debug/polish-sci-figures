/* Actual production sanitizer/variant readers in SVG DOM. Browser interactive
 * pointer, annotation and raster-output checks are performed separately. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/',source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8'),helpers=require(base+'studio.js'),cleanup=require(base+'legacy-stat-cleanup.js');
const dom=new JSDOM(''),document=dom.window.document,NS='http://www.w3.org/2000/svg',copy=x=>JSON.parse(JSON.stringify(x));let passed=0;
// CSSStyleDeclaration iteration exists in browsers; older JSDOM versions expose
// the same indexed properties without an iterator.
if(!dom.window.CSSStyleDeclaration.prototype[Symbol.iterator])dom.window.CSSStyleDeclaration.prototype[Symbol.iterator]=function*(){for(let i=0;i<this.length;i++)yield this[i];};
const parse=text=>new dom.window.DOMParser().parseFromString(text,'image/svg+xml').documentElement,serialize=node=>new dom.window.XMLSerializer().serializeToString(node);
function chunk(begin,end){const start=source.indexOf(begin),stop=source.indexOf(end,start+begin.length);assert.ok(start>=0&&stop>start,begin);return source.slice(start,stop);}
const declarations=source.split('\n').filter(line=>['const TAGS =','const ATTRS =','const STYLES =','const sizeNames='].some(marker=>line.includes(marker))).join('\n');
const ctx={document,DOMParser:dom.window.DOMParser,NS,T:x=>x,StudioLegacyStatCleanup:cleanup,
 StudioI18n:{validateDisplayNames(){}},StudioMarkStyle:require(base+'mark-style.js'),StudioGroupSpacing:require(base+'group-spacing.js'),
 paletteDeclaredColors:helpers.paletteDeclaredColors,svgElementMap:helpers.svgElementMap,validateState:helpers.validateState,
 project:null,templateCache:new Map(),panel:id=>ctx.project.panels.find(p=>p.id===id),reflowSpec:()=>({key:'cached-plot'}),heatmapCellInfo:helpers.heatmapCellInfo};
vm.createContext(ctx);vm.runInContext(declarations+'\n'+chunk('  function safeValue(','  function svgContentSummary(')+'\n'+chunk('  function inlineSvgStyles(','  async function validateSvgImportFeatures(')+'\n'+chunk('  function sanitize(','  const heatmapUpgradeRequests=')+'\n'+source.split('\n').find(line=>line.includes('  function statisticalSourceBinding('))+'\n'+chunk('  function statisticalAnchorMetadata(','  function statisticalSemanticPoint(')+'\n'+chunk('  function reflowSvg(','  const reflowRequests=')+'\n'+chunk('  function currentHeatmapMetadata(','  let editableSourceCache='),ctx);
const generator=fs.readFileSync(require.resolve('./fixtures/legacy-statistical-band-builder.txt'),'utf8');
const sizes=[['original',300,200],['portrait',200,300],['wide',450,200],['spanWide',600,200],['spanThree',900,200],['spanTall',300,400],['large',600,400]];
function oldVariant(size,style='stars'){
 const [name,width,height]=size,anchors={version:1,axes:[{axis:'axes_1',groups:[{group:'Control',facet:{column:'factor',value:'Line 1'},center:[40,100],members:['data-group']}]}]},root=parse(`<svg xmlns="${NS}" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}"><metadata id="studio-stat-anchors">${JSON.stringify(anchors)}</metadata><g id="axes_1"><g id="data-group"><path id="actual-data" d="M 20 100 L 80 60" stroke="#000"/></g><text id="axis-title" x="10" y="190">Time</text></g></svg>`),v={name,size:name,width,height,viewBox:[0,0,width,height],sha256:'a'.repeat(64)},s={panels:{p:{annotationStyle:style,annotationLine:'bracket'}},typography:{font:'Arial',size:9}},info={bandTitle:'本小图组间比较 · Value',sets:[{label:'Line 1',order:['Control','Stress'],comparisons:[{a:0,b:1,p:.003}]}],comparisons:[{a:0,b:1,p:.003}]},builder={document:root.ownerDocument,NS,statisticalBandLayout:helpers.statisticalBandLayout,statisticalBracketPath:helpers.statisticalBracketPath};
 vm.createContext(builder);vm.runInContext(generator,builder);builder.appendStatisticalBand(root,'p',0,s,v,info);
 // A source node added after the former footer must keep its original eN key.
 const note=root.ownerDocument.createElementNS(NS,'text');note.id='user-note';note.setAttribute('x','12');note.setAttribute('y','20');note.textContent='Keep my own caption';root.append(note);
 const full=root.getAttribute('viewBox').trim().split(/\s+/).map(Number);return{...v,height:full[3],viewBox:full,svg:serialize(root),preserveAspect:true};
}
function oldSanitize(text){const active=ctx.StudioLegacyStatCleanup;ctx.StudioLegacyStatCleanup=undefined;try{return ctx.sanitize(text);}finally{ctx.StudioLegacyStatCleanup=active;}}
function noFooter(root){assert.equal(root.querySelector('[data-stat-band]'),null);assert.equal([...root.querySelectorAll('text')].some(n=>/^本小图组间比较/.test(n.textContent)),false);assert.equal(serialize(root).includes('data-stat-band-height='),false);}
function test(name,run){run();passed++;console.log('PASS '+name);}
test('real sanitizer removes old footer while every retained original eN key stays stable',()=>{
 for(const size of sizes)for(const style of ['stars','p','letters']){
   const v=oldVariant(size,style),before=oldSanitize(v.svg),after=ctx.sanitize(v.svg);noFooter(after);assert.equal(after.studioLegacyStatCleaned,true);assert.equal(after.getAttribute('viewBox'),`0 0 ${size[1]} ${size[2]}`);assert.equal(after.getAttribute('height'),size[2]+'pt');
   for(const id of ['axes_1','data-group','actual-data','axis-title','user-note'])assert.equal(after.querySelector('#'+id).getAttribute('data-key'),before.querySelector('#'+id).getAttribute('data-key'),`${size[0]} ${style} ${id}`);
   assert.equal(after.querySelector('#studio-stat-anchors').textContent,before.querySelector('#studio-stat-anchors').textContent,'valid semantic scientific group metadata remain exact');
   assert.equal(after.querySelector('#actual-data').getAttribute('d'),before.querySelector('#actual-data').getAttribute('d'));assert.equal(after.querySelector('#user-note').textContent,'Keep my own caption');
 }
});
const variants=sizes.map(size=>oldVariant(size)),analysis={group_order:['Control','Stress'],pairwise:[{group_a:'Control',group_b:'Stress',p_adjusted:.003}]},project={schema:'figure-studio/1',id:'0123456789abcdef0123',title:'Synthetic legacy recovery',panels:[{id:'panel-0',name:'Synthetic old chart',variants,recipe:{family:'gallery',parameters:{view:'grouped_observations'}},analysis}],initialState:{order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}}};
test('validateProject normalizes all seven viewports but preserves source SVG, analysis and history',()=>{
 const saved=copy(project),history=new helpers.History(project.initialState),next=copy(project.initialState),noteKey=oldSanitize(variants[0].svg).querySelector('#user-note').getAttribute('data-key');next.panels['panel-0'].edits={0:{[noteKey]:{fill:'#4477aa','offset-x':'3'}}};history.commit(next);const beforeHistory=JSON.stringify(history.states),checkpoint=copy(next),beforeCheckpoint=JSON.stringify(checkpoint),beforeAnalysis=JSON.stringify(saved.panels[0].analysis);ctx.validateProject(saved);
 saved.panels[0].variants.forEach((v,i)=>{assert.deepEqual(Array.from(v.viewBox),[0,0,sizes[i][1],sizes[i][2]]);assert.equal(v.height,sizes[i][2]);assert.equal(v.svg,variants[i].svg);assert.equal(v.sha256,variants[i].sha256);});assert.equal(JSON.stringify(saved.panels[0].analysis),beforeAnalysis);assert.equal(JSON.stringify(history.states),beforeHistory);assert.equal(JSON.stringify(checkpoint),beforeCheckpoint);assert.equal(JSON.stringify(saved.initialState),JSON.stringify(project.initialState));
 history.undo();history.redo();assert.equal(history.current.panels['panel-0'].edits[0][noteKey].fill,'#4477aa');ctx.project=saved;
});
test('source, statistical upgrade and heatmap derived readers cannot return an old footer',()=>{
 const key='panel-0/0';ctx.templateCache.clear();noFooter(ctx.baseSvg('panel-0',0));const pan=ctx.project.panels[0],v=pan.variants[0];ctx.project.statisticalRenders={[key]:{binding:ctx.statisticalSourceBinding(pan,v),svg:variants[0].svg}};ctx.templateCache.clear();noFooter(ctx.baseSvg('panel-0',0));ctx.project.heatmapRenders={[key]:copy(variants[0])};ctx.templateCache.clear();noFooter(ctx.baseSvg('panel-0',0));
});
test('derived layout caches normalize once and reflow uses the restored viewport',()=>{
 const v=copy(variants[3]);ctx.project.layoutRenders={'cached-plot':v};const originalSvg=v.svg,rawHeight=v.height;
 const first=ctx.fittedVariant({},{});assert.equal(first,v);assert.ok(first.height<rawHeight);assert.equal(first.height,sizes[3][2]);assert.deepEqual(Array.from(first.viewBox),[0,0,sizes[3][1],sizes[3][2]]);assert.equal(first.svg,originalSvg);noFooter(ctx.reflowSvg('panel-0',0,first));
 let parses=0;const old=ctx.DOMParser;ctx.DOMParser=class extends old{parseFromString(...args){parses++;return super.parseFromString(...args);}};ctx.fittedVariant({},{});ctx.normalizeLegacyDerivedVariant(v);assert.equal(parses,0,'immutable source/dimensions do not trigger repeated SVG parsing');v.width=900;ctx.normalizeLegacyDerivedVariant(v);assert.ok(parses>0);assert.equal(v.height,v.width*v.viewBox[3]/v.viewBox[2]);ctx.DOMParser=old;
});
test('all seven recovered variants and cache readers remain footer-free after export cleanup',()=>{
 const exported=parse(`<svg xmlns="${NS}" width="1500pt" height="1500pt" viewBox="0 0 1500 1500"/>`);
 for(let vi=0;vi<7;vi++)exported.append(exported.ownerDocument.importNode(ctx.baseSvg('panel-0',vi),true));
 const exportLine=source.split('\n').find(line=>line.includes('if (exportMode) {const ownedColors='));assert.ok(exportLine,'production export cleanup exists');Object.assign(ctx,{root:exported,exportMode:true});vm.runInContext(exportLine,ctx);noFooter(exported);assert.equal(exported.querySelectorAll('[data-key]').length,0);assert.equal(exported.querySelectorAll('#user-note').length,7);assert.equal(exported.querySelectorAll('#actual-data').length,7);
});
test('ordinary custom caption and appendix text survives production sanitization',()=>{
 const raw=`<svg xmlns="${NS}" width="300pt" height="200pt" viewBox="0 0 300 200"><g id="axes_1"><path d="M 1 1 L 2 2"/></g><g id="user-section"><text x="12" y="170">Group comparisons</text><text x="12" y="190">My own prose and definitions</text></g></svg>`,safe=ctx.sanitize(raw);assert.equal(safe.studioLegacyStatCleaned,undefined);assert.equal(safe.querySelector('#user-section').textContent,'Group comparisonsMy own prose and definitions');assert.equal(safe.getAttribute('viewBox'),'0 0 300 200');
});
dom.window.close();console.log(`PASS legacy statistics integration: ${passed} scenarios, 21 true sanitizer/style/size recoveries plus project/cache/export readers`);
