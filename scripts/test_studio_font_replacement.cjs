/* Actual font-choice DOM and source text-edit hooks. Browser glyph rendering
 * is deliberately left to the editor's separate visual acceptance. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const base='../skills/polish-sci-figures/assets/figure-studio/',format=require(base+'text-formatting.js'),main=require(base+'studio.js'),rich=require(base+'rich-text.js');
const source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8');
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}
function fixture(body){const dom=new JSDOM('<!doctype html><body><select id="font"><option>Arial</option><option>Times New Roman</option><option>Courier New</option></select><svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">'+body+'</svg></body>');return {dom,doc:dom.window.document,text:dom.window.document.querySelector('text'),select:dom.window.document.querySelector('select')};}
const label=(key,...args)=>key.replace(/\{(\d+)\}/g,(_,n)=>args[n]??'');
test('an unknown PDF family is shown as original rather than the stale Arial default',()=>{
 const {dom,select}=fixture(''),family='"ExampleResearchFace", "Times New Roman", Times, serif';let changes=0;select.addEventListener('change',()=>changes++);format.syncFontChoice(select,[family],label);
 assert.equal(select.value,family);assert.match(select.selectedOptions[0].textContent,/ExampleResearchFace/);assert.equal(select.selectedOptions[0].hasAttribute('data-source-font'),true);assert.equal(changes,0);
 select.value='Arial';select.dispatchEvent(new dom.window.Event('change'));assert.equal(changes,1,'choosing Arial now differs from the actual selected original family');assert.equal(select.value,'Arial');dom.window.close();
});
test('font stacks select their recognized first family; repeated sync does not accumulate source options',()=>{
 const {dom,select}=fixture('');format.syncFontChoice(select,['"Times New Roman", Times, serif'],label);assert.equal(select.value,'Times New Roman');assert.equal(select.querySelectorAll('[data-source-font]').length,0);
 for(const family of ['"UnknownOne", Arial, sans-serif','"UnknownTwo", serif','Arial, Helvetica, sans-serif'])format.syncFontChoice(select,[family],label);
 assert.equal(select.value,'Arial');assert.equal(select.querySelectorAll('[data-source-font]').length,0);assert.equal(format.firstFamily('"A, B Family", serif'),'A, B Family');dom.window.close();
});
test('mixed source families do not silently select an unrelated font',()=>{
 const {dom,select}=fixture('');format.syncFontChoice(select,['"UnknownOne", serif','Arial, sans-serif'],label);assert.equal(select.value,'');assert.equal(select.selectedOptions[0].disabled,true);assert.match(select.selectedOptions[0].textContent,/混合字体/);dom.window.close();
});
test('case variants of the same first family remain one font choice',()=>{
 const {dom,select}=fixture('');format.syncFontChoice(select,['Arial, Helvetica, sans-serif','"arial", sans-serif','ARIAL'],label);assert.equal(select.value,'Arial');assert.equal(select.querySelectorAll('[data-source-font]').length,0);
 format.syncFontChoice(select,['"Times New Roman", Times, serif','"times new roman", serif'],label);assert.equal(select.value,'Times New Roman');assert.equal(select.selectedOptions[0].disabled,false);dom.window.close();
});
test('explicit family replacement releases old font advances but preserves origin, transform and content',()=>{
 const {dom,text}=fixture('<g transform="translate(13 27)"><text x=".004 .012 .019" y=".020 .020 .020" dx="0 .001 .002" dy="0 0 0" font-size=".012" transform="matrix(1000 0 0 1000 20 30)" textLength=".025" lengthAdjust="spacingAndGlyphs" font-family="&quot;MissingFace&quot;, Arial, sans-serif">AV2</text></g>');const content=text.textContent,transform=text.getAttribute('transform'),parent=text.parentElement.getAttribute('transform');main.preparePositionedTextEdit(text,{'font-family':'Times New Roman'});
 assert.equal(text.getAttribute('x'),'0.004');assert.equal(text.getAttribute('y'),'0.02');assert.equal(text.getAttribute('dx'),'0');assert.equal(text.getAttribute('dy'),'0');assert.equal(text.hasAttribute('textLength'),false);assert.equal(text.hasAttribute('lengthAdjust'),false);assert.equal(text.getAttribute('transform'),transform);assert.equal(text.parentElement.getAttribute('transform'),parent);assert.equal(text.textContent,content);assert.equal(rich.pointSize(text),.012);dom.window.close();
});
test('new family and size retain separate line origins and partial scientific emphasis',()=>{
 const {dom,text}=fixture('<text font-size="12" transform="rotate(-30 10 20)"><tspan x="10 19" y="20 20" font-style="italic">P </tspan><tspan x="28 36 43" y="20 20 20">= 0</tspan><tspan x="10 17 24" y="44 44 44">H2O</tspan></text>');const spans=[...text.querySelectorAll('tspan')],snapshot=text.textContent;main.preparePositionedTextEdit(text,{'font-family':'Arial','font-size':'24'});
 assert.deepEqual(spans.map(n=>n.getAttribute('x')),['10','28','10']);assert.deepEqual(spans.map(n=>n.getAttribute('y')),['20','20','44']);assert.equal(spans[0].getAttribute('font-style'),'italic');assert.equal(text.textContent,snapshot);assert.equal(text.getAttribute('transform'),'rotate(-30 10 20)');dom.window.close();
});
test('one PDF run with mixed glyph baselines keeps math positions rather than flattening scripts',()=>{
 const {dom,text}=fixture('<text font-size="12" x="10 18 25" y="20 16 20" dx="0 1 0" textLength="25">x2y</text>');const before=text.outerHTML;format.reflowFontPositions(text);assert.equal(text.outerHTML,before,'mixed baseline positions remain unchanged during a family-only replacement');dom.window.close();
});
test('relative per-glyph superscript displacements are not collapsed',()=>{
 const {dom,text}=fixture('<text font-size="12"><tspan x="10 17 24" y="20" dy="0 -3 3" font-size="8">a2b</tspan></text>');const span=text.querySelector('tspan'),before=span.outerHTML;format.reflowFontPositions(text);assert.equal(span.outerHTML,before);dom.window.close();
});
test('family-only editing is idempotent and does not reapply size scaling',()=>{
 const {dom,text}=fixture('<text font-size="12" x="10 19 26" y="20 20 20">ABC</text>');main.preparePositionedTextEdit(text,{'font-family':'Arial','font-size':'24'});text.style.fontSize='24px';const first=text.outerHTML;main.preparePositionedTextEdit(text,{'font-family':'Arial'});assert.equal(text.outerHTML,first);assert.equal(rich.pointSize(text),24);dom.window.close();
});
test('production unified typography releases old PDF advances and preserves independent line and emphasis origins',()=>{
 const {dom,doc,text}=fixture('<text data-key="e1" font-family="MissingFace" font-size="12" transform="translate(5 7)"><tspan data-key="e2" x="10 19" y="20 20" font-style="italic">P </tspan><tspan data-key="e3" x="28 36 43" y="20 20 20">= 0</tspan><tspan data-key="e4" x="10 17 24" y="44 44 44">H2O</tspan></text>'),before=text.outerHTML,svg=doc.querySelector('svg').cloneNode(true);
 const start=source.indexOf('    if(!raw&&s.typography'),end=source.indexOf('    if(!raw && s.panels[id].geometry)',start);assert.ok(start>=0&&end>start);
 const state={panels:{p:{useUnifiedTypography:true}},typography:{font:'Times New Roman',size:12}},asset={provenance:'user-import',variants:[{width:400,viewBox:[0,0,400,200]}]},context={svg,s:state,id:'p',vi:0,raw:false,panel:()=>asset,textPointFactor:()=>1,textPointSize:rich.pointSize,preparePositionedTextEdit:main.preparePositionedTextEdit};vm.runInNewContext(source.slice(start,end),context);
 const output=svg.querySelector('text'),runs=[...output.querySelectorAll('tspan')];assert.equal(output.style.fontFamily,'Times New Roman');assert.equal(output.style.fontSize,'12px');assert.deepEqual(runs.map(n=>n.getAttribute('x')),['10','28','10']);assert.deepEqual(runs.map(n=>n.getAttribute('y')),['20','20','44']);assert.equal(runs[0].getAttribute('font-style'),'italic');assert.ok(runs.every(n=>n.style.fontFamily==='Times New Roman'));assert.equal(output.getAttribute('transform'),'translate(5 7)');assert.equal(output.textContent,text.textContent);assert.equal(text.outerHTML,before,'original import remains unchanged');dom.window.close();
});
test('same-family explicit replacement buttons always apply and restore keyboard editing focus',()=>{
 const {dom,doc,select}=fixture('');for(const id of ['replaceFontArial','replaceFontTimes','applyFont']){const button=doc.createElement('button');button.id=id;doc.body.append(button);}const size=doc.createElement('input');size.id='fontSize';size.value='14';doc.body.append(size);let calls=[],focus=0;
 const start=source.indexOf("  $('font').onchange="),end=source.indexOf("  $('bold').onclick=",start);assert.ok(start>=0&&end>start);
 const context={$:id=>doc.getElementById(id),updateStyle:(...args)=>calls.push(args),resumeSelectionKeyboard:()=>focus++,T:label,say(){},applyFont:()=>{throw Error('font apply action must include the selected family');}};vm.runInNewContext(source.slice(start,end),context);
 select.value='Arial';doc.getElementById('replaceFontArial').click();doc.getElementById('replaceFontArial').click();doc.getElementById('replaceFontTimes').click();assert.deepEqual(calls.map(c=>c.slice(0,3)),[['font-family','Arial','text'],['font-family','Arial','text'],['font-family','Times New Roman','text']]);assert.equal(focus,3);
 calls=[];doc.getElementById('applyFont').click();assert.equal(calls.length,1);assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),['font-family','Arial','text',{'font-size':'14'}]);dom.window.close();
});
console.log(`PASS ${passed} font replacement regressions (real DOM; no browser glyph-layout claim).`);
