/* Real SVG DOM fixtures; expected lengths are physical basis-vector lengths,
 * not a second implementation of the production transform parser. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {JSDOM}=require('jsdom');
const rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const main=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
let passed=0;
function fixture(body,attrs='viewBox="0 0 400 200" width="400" height="200"'){
  const dom=new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`,{contentType:'image/svg+xml'});
  return {dom,root:dom.window.document.documentElement,text:dom.window.document.querySelector('text')};
}
function close(actual,expected){assert.ok(Math.abs(actual-expected)<=1e-10*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);}
function test(name,fn){fn();passed++;console.log(`PASS ${name}`);}
function scale(body,expected,attrs){const {root,text}=fixture(body,attrs),before=root.outerHTML;close(rich.localFontScale(text,root),expected);assert.equal(root.outerHTML,before,'geometry reads cannot rewrite source transforms or character positions');}
test('PDF local one-point font with 50× transform retains its effective size',()=>{
  const {root,text}=fixture('<text font-size="1" transform="matrix(50 0 0 50 30 40)" x="0 .66 1.33" y="0 0 0">ABC</text>');
  close(rich.pointSize(text),1);close(rich.localFontScale(text,root),50);close(rich.pointSize(text)*rich.localFontScale(text,root),50);
});
test('PDF 1000× matrix permits a tiny local font without losing physical em size',()=>{
  // From actual PDFium import of synthetic Tf=.012, Tm=1000 at (30,180).
  const {root,text}=fixture('<text id="pdf-object-4" font-size="0.012" transform="matrix(1000 0 0 1000 30 120)" x="0 .008003998 .014004" y="0 0 0">Sca</text>');
  const before=root.outerHTML;close(rich.pointSize(text),.012);close(rich.localFontScale(text,root),1000);close(rich.pointSize(text)*rich.localFontScale(text,root),12);close(12/rich.localFontScale(text,root),.012);assert.equal(root.outerHTML,before);
});
test('rotation and reflection preserve em length',()=>{
  scale('<text font-size="1" transform="translate(370 265) rotate(-90) scale(12)">Rotated</text>',12);
  scale('<text transform="matrix(-50 0 0 -50 0 0)">Reflected</text>',50);
});
test('ancestor affine matrix and own rotation compose in SVG order',()=>{
  scale('<g transform="matrix(2 3 4 5 30 40)"><text transform="rotate(90)">Affine</text></g>',Math.sqrt(13));
  scale('<g transform="scale(2 5)"><text transform="rotate(90)">Rotated in stretched parent</text></g>',2);
});
test('skew uses the vertical em vector rather than only matrix d',()=>{
  scale('<text transform="skewX(45)">Skewed</text>',Math.sqrt(2));
  scale('<g transform="skewX(45)"><text transform="scale(3)">Skewed scaled</text></g>',3*Math.sqrt(2));
});
test('nested SVG nonuniform viewport and percentage dimensions are included',()=>{
  scale('<svg x="30" y="20" width="200" height="80" viewBox="0 0 100 20" preserveAspectRatio="none"><text>Nested</text></svg>',4);
  scale('<svg width="50%" height="50%" viewBox="0 0 100 20" preserveAspectRatio="none"><text>Percent viewport</text></svg>',5);
});
test('nested meet viewport plus own transform has one conversion only',()=>{
  scale('<g transform="scale(3)"><svg x="12" y="8" width="200" height="80" viewBox="0 0 100 20"><text transform="scale(2)">Meet</text></svg></g>',12);
});
test('the specified root coordinate system excludes its viewport and transform',()=>{
  scale('<text transform="scale(2)">Root-local</text>',2,'viewBox="0 0 400 200" width="800" height="400" transform="scale(5)"');
  const {root,text}=fixture('<svg width="200" height="100" viewBox="0 0 100 50"><text transform="scale(3)">Inner root</text></svg>');
  close(rich.localFontScale(text,root),6);close(rich.localFontScale(text,text.parentElement),3);
});
test('malformed, singular, CSS-transformed and unrelated geometry fails explicitly',()=>{
  for(const transform of ['scale(0)','matrix(1 2 2 4 0 0)','scale(NaN)','translate(no)','matrix(1e13 0 0 1 0 0)']){
    const {root,text}=fixture(`<text transform="${transform}">Invalid</text>`);assert.throws(()=>rich.localFontScale(text,root));
  }
  const {root,text}=fixture('<text style="transform:scale(2)">CSS transform</text>');assert.throws(()=>rich.localFontScale(text,root));
  const one=fixture('<text>One</text>'),two=fixture('<text>Two</text>');assert.throws(()=>rich.localFontScale(one.text,two.root));assert.throws(()=>rich.localFontScale(null,root));
});
test('an unattached lightweight untransformed text has identity geometry',()=>{
  close(rich.localFontScale({parentElement:null,getAttribute(){return null;},style:{}},null),1);
  assert.throws(()=>rich.localFontScale({parentElement:null,getAttribute(name){return name==='transform'?'scale(50)':null;},style:{}},null));
});
test('absolute font units convert to local SVG user units, never matrix units',()=>{
  for(const [unit,value]of [['12pt',16],['12px',12],['1pc',16],['.5in',48],['2.54cm',96],['25.4mm',96],['101.6q',96],['1.2e-2',.012]]){
    const {text}=fixture(`<text font-size="${unit}" transform="scale(1000)">Units</text>`);close(rich.pointSize(text),value);
  }
  const {text}=fixture('<text font-size="12" style="font-size: 9pt">Inline priority</text>');close(rich.pointSize(text),12);
});
test('local inherited and relative sizes preserve their parent font basis',()=>{
  for(const [body,expected]of [
    ['<g font-size="9pt"><g><text>Inherited</text></g></g>',12],
    ['<g font-size="20"><g font-size="50%"><text>Relative ancestor</text></g></g>',10],
    ['<g font-size="20"><text font-size="70%">Relative own</text></g>',14],
    ['<g font-size="20"><text font-size=".5em">Relative em</text></g>',10],
    ['<g font-size="20"><text><tspan font-size="8">x</tspan><tspan font-size="5.6" dy="-2">2</tspan></text></g>',8],
    ['<text>No explicit size</text>',12]
  ]){const {text}=fixture(body);close(rich.pointSize(text),expected);}
});
test('native character-run sizes keep pt-to-local ratios through text replacement',()=>{
  const {text}=fixture('<text><tspan x="10" y="30" font-size="9pt">x</tspan><tspan x="20" y="25" font-size="6pt">2</tspan></text>');
  close(rich.pointSize(text),12);assert.equal(rich.nativeStyles(text).runs.at(-1).style.script,'super');
  rich.replaceText(text,'y2');close(rich.pointSize(text),12);assert.equal(text.getAttribute('y'),'30');
});
function extracted(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
function edit(next,id,vi,key,prop,value){(((next.panels[id].edits[vi]??={})[key]??={}))[prop]=value;}
const factorCode=extracted('  function textPointFactor(','  async function ensureReflows(');
test('actual live and detached point conversion agrees and accepts not-yet-installed facets',()=>{
  const variant={width:200,viewBox:[0,0,400,200]},ctx={StudioRichText:rich,panel:()=>({variants:[variant]}),textPointSize:rich.pointSize,currentOutput:()=>({scale:2})};vm.createContext(ctx);vm.runInContext(factorCode,ctx);
  const detached=fixture('<text font-size=".2" transform="scale(50)">ABC</text>'),live=fixture('<svg data-panel="p" width="200" height="100" viewBox="0 0 400 200"><text font-size=".2" transform="scale(50)">ABC</text></svg>');
  close(ctx.textPointFactor(detached.text,'p',0),25);close(ctx.textPointFactor(live.text,'p',0),25);close(ctx.textOutputSize(live.text,'p',0),10);
  ctx.panel=()=>undefined;close(ctx.textPointFactor(detached.text,'new-facet',0,variant),25);
});
test('actual unified typography retains relative tspans and correctly converts absolute pt',()=>{
  const {root,text}=fixture('<text font-size="12pt" data-role="title"><tspan font-size="6pt">a</tspan><tspan font-size="70%">b</tspan><tspan font-size=".5em">c</tspan><tspan>d</tspan></text>');
  const line=source.split('\n').find(line=>line.startsWith('    if(!raw&&s.typography&&'));assert.ok(line);
  const ctx={raw:false,svg:root,id:'p',vi:0,s:{typography:{font:'Arial',size:20},panels:{p:{useUnifiedTypography:true}}},panel:()=>({provenance:'user-import',recipe:{family:'pdf'},variants:[{width:400,viewBox:[0,0,400,200]}]}),StudioRichText:rich,textPointSize:rich.pointSize,preparePositionedTextEdit:main.preparePositionedTextEdit};vm.createContext(ctx);vm.runInContext(factorCode+'\n'+line,ctx);
  close(rich.pointSize(text),20);const spans=text.querySelectorAll('tspan');close(rich.pointSize(spans[0]),10);assert.equal(spans[1].getAttribute('font-size'),'70%');assert.equal(spans[1].style.fontSize,'');assert.equal(spans[2].style.fontSize,'');close(rich.pointSize(spans[1]),14);close(rich.pointSize(spans[2]),10);close(rich.pointSize(spans[3]),20);
});
test('actual facet style copy can run before the new asset enters the project',()=>{
  const sourceVariant={width:100,viewBox:[0,0,100,100]},newVariant={...sourceVariant,svg:'<text data-key="e1" transform="scale(50)" font-size="1">New facet</text>'},asset={id:'new',variants:[newVariant]},next={panels:{new:{edits:{}}}};
  const ctx={StudioRichText:rich,panel:id=>id==='old'?{variants:[sourceVariant]}:undefined,baseSvg:()=>fixture('<text>Source</text>').root,sanitize:body=>fixture(body).root,keysToObjects:svg=>[...svg.querySelectorAll('[data-key]')],hex:()=>null,paint:()=>null,chromatic:()=>false,validValue:()=>true,setEdit:edit};vm.createContext(ctx);vm.runInContext(factorCode+extracted('  function copyFacetAppearance(','  function installFacetAssets('),ctx);
  ctx.copyFacetAppearance(next,'new',asset,{colors:[],roles:{other:{font:'Arial',weight:'400',size:12}}},{id:'old',variants:[sourceVariant]},{variant:0,edits:{}},{label:'Day 1'});close(Number(next.panels.new.edits[0].e1['font-size']),.24);
});
test('actual preset paste preserves relative runs while scaling an absolute pt subscript',()=>{
  const {root}=fixture('<text data-key="e1" font-size="12pt"><tspan data-key="e2" font-size="6pt">a</tspan><tspan data-key="e3" font-size="70%">b</tspan><tspan data-key="e4" font-size=".5em">c</tspan></text>'),state={order:['p'],panels:{p:{variant:0,edits:{}}}},variant={width:400,viewBox:[0,0,400,200]};let result;
  const ctx={StudioRichText:rich,state:()=>state,copy:x=>JSON.parse(JSON.stringify(x)),panel:()=>({variants:[variant]}),editedSvg:()=>root.cloneNode(true),textPointSize:rich.pointSize,setEdit:edit,validValue:()=>true,copyPanelGaps(){},hex:()=>null,paint:()=>null,chromatic:()=>false,$:()=>({checked:false}),T:x=>x,commit:next=>{result=next;return true;}};vm.createContext(ctx);vm.runInContext(factorCode+extracted('  function pastePreset(',"  $('openLibrary').onclick="),ctx);
  ctx.pastePreset({sourceState:{order:['p']},profile:[{colors:[],roles:{other:{font:'Arial',weight:'400',size:20}}}]});close(Number(result.panels.p.edits[0].e1['font-size']),20);close(Number(result.panels.p.edits[0].e2['font-size']),10);assert.equal(result.panels.p.edits[0].e3,undefined);assert.equal(result.panels.p.edits[0].e4,undefined);
});
const sourceEditLoop=extracted('    // Prepare all positioned text before styles change inherited font bases.','    // Work on complete category groups');
function renderSourceEdits(body,edits){
  const {root}=fixture(body),ctx={svg:root,raw:false,id:'p',vi:0,s:{},editsFor:()=>edits,preparePositionedTextEdit:main.preparePositionedTextEdit,StudioRichText:rich};vm.runInNewContext(sourceEditLoop,ctx);return root;
}
test('actual edit loop scales parent and child character positions exactly once in either saved order',()=>{
  const body='<text data-key="e1" font-size="12" x="10 16 22" y="20 20 20"><tspan data-key="e2" font-size="12" x="0 6 12" y="20 19 20" dx="0 1 2">ABC</tspan></text>';
  for(const keys of [['e1','e2'],['e2','e1']]){
    const edits=Object.fromEntries(keys.map(key=>[key,{'font-size':'24'}])),svg=renderSourceEdits(body,edits);
    assert.equal(svg.querySelector('text').getAttribute('x'),'10 22 34');assert.equal(svg.querySelector('tspan').getAttribute('x'),'0 12 24');assert.equal(svg.querySelector('tspan').getAttribute('y'),'20 18 20');assert.equal(svg.querySelector('tspan').getAttribute('dx'),'0 2 4');close(rich.pointSize(svg.querySelector('tspan')),24);
  }
});
test('pending child size uses the original inherited font before the parent style is written',()=>{
  const svg=renderSourceEdits('<g font-size="12"><text data-key="e1"><tspan data-key="e2" x="0 6 12">ABC</tspan></text></g>',{e1:{'font-size':'24'},e2:{'font-size':'36'}});
  assert.equal(svg.querySelector('tspan').getAttribute('x'),'0 18 36');close(rich.pointSize(svg.querySelector('tspan')),36);
});
test('a resized child owns nested unedited coordinates while siblings follow their parent',()=>{
  const body='<text data-key="e1" font-size="12"><tspan data-key="e2" font-size="6"><tspan data-key="e3" x="0 3 6">ABC</tspan></tspan><tspan data-key="e4" x="0 6 12">DEF</tspan></text>';
  const svg=renderSourceEdits(body,{e1:{'font-size':'24'},e2:{'font-size':'18'}});assert.equal(svg.querySelector('[data-key="e3"]').getAttribute('x'),'0 9 18');assert.equal(svg.querySelector('[data-key="e4"]').getAttribute('x'),'0 12 24');
});
test('continuous size previews, repeated rendering and saved edit reload never accumulate positions',()=>{
  const body='<text data-key="e1" font-size="12"><tspan data-key="e2" font-size="12" x="0 6 12">ABC</tspan></text>';
  for(const size of [18,24,36,12,24]){const edits={e1:{'font-size':String(size)},e2:{'font-size':String(size)}};const first=renderSourceEdits(body,edits),again=renderSourceEdits(body,JSON.parse(JSON.stringify(edits)));assert.equal(first.outerHTML,again.outerHTML);assert.equal(first.querySelector('tspan').getAttribute('x'),`0 ${size/2} ${size}`);}
  const changed=renderSourceEdits(body,{e1:{text:'A longer label','font-size':'24'},e2:{'font-size':'24'}});assert.equal(changed.querySelector('text').textContent,'A longer label');assert.equal(changed.querySelector('[data-key="e2"]'),null);
});
test('actual toolbar refresh retains the full physical font range for labels and text',()=>{
  const fields={},field=id=>fields[id]??={value:'',options:[],style:{setProperty(){}},setAttribute(){},closest(){return {style:{setProperty(){}}};}},text=fixture('<text font-size="200">Label</text>').text;
  const ctx={$:field,quickSelectedObjects:()=>[{kind:'label',id:'p',el:text,text:'Label'}],state:()=>({alignmentGuides:[]}),original:false,selectedAlignmentGuide:null,currentOutput:()=>({scale:50}),document:{activeElement:null},quickObjectSize:()=>200,quickObjectTarget:()=>({text:'Label',el:text}),quickUniformStyle:()=>false,StudioRichText:rich,T:x=>x};vm.createContext(ctx);vm.runInContext(extracted('  function renderQuickToolbar(','  function setupQuickToolbar('),ctx);ctx.renderQuickToolbar();assert.equal(field('quickFontSize').min,'0.1');assert.equal(field('quickFontSize').max,'1000');assert.equal(field('quickFontSize').value,200);
});
test('direct text inherits the parent size while all-tspan math text retains its child base',()=>{
  const {text}=fixture('<g font-size="24"><text>ABC<tspan font-size="12">sub</tspan></text></g>');close(rich.pointSize(text),24);close(rich.pointSize(text.querySelector('tspan')),12);
  const math=fixture('<g font-size="24"><text> \n <tspan font-size="12">x</tspan><tspan font-size="8">2</tspan> </text></g>');close(rich.pointSize(math.text),12);
});
test('actual font edit halves inherited direct text and its absolute subscript together',()=>{
  const body='<g font-size="24"><text data-key="e1">ABC<tspan data-key="e2" font-size="12">sub</tspan></text></g>',{root,text}=fixture(body),initial={order:['p'],panels:{p:{variant:0,edits:{}}}},variant={width:400,viewBox:[0,0,400,200]};let saved;
  const ctx={StudioRichText:rich,copy:x=>JSON.parse(JSON.stringify(x)),original:false,selected:['e1'],selectedPanel:'p',state:()=>initial,$:id=>({value:id==='scope'?'element':'all'}),selectionGroups:()=>[{id:'p',vi:0,keys:['e1']}],panel:()=>({variants:[variant]}),editableSource:()=>root,targetObjects:()=>[text],currentOutput:()=>({scale:1}),validValue:()=>true,textPointSize:rich.pointSize,T:x=>x,say(){},setEdit:edit,commit:next=>{saved=next;}};vm.createContext(ctx);vm.runInContext(factorCode+extracted('  function updateStyle(','  function paletteHeatmapInfo('),ctx);
  close(ctx.textOutputSize(text,'p',0),24);ctx.updateStyle('font-size','12','text');assert.equal(saved.panels.p.edits[0].e1['font-size'],'12');assert.equal(saved.panels.p.edits[0].e2['font-size'],'6');
  const rendered=renderSourceEdits(body,saved.panels.p.edits[0]);close(rich.pointSize(rendered.querySelector('text')),12);close(rich.pointSize(rendered.querySelector('tspan')),6);assert.equal(root.querySelector('text').style.fontSize,'','the source SVG remains unchanged');
});
console.log(`PASS ${passed} SVG text geometry and local-font regressions (real DOM attributes; no browser layout or drag claim).`);
