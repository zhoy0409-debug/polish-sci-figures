/* Real SVG DOM regression for saved presentation transforms; no layout mocks. */
'use strict';
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const api=require('../skills/polish-sci-figures/assets/figure-studio/selection-transform-dom.js');
const geometry=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
const rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js');
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const pointNear=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
const record=values=>({'object-transform':JSON.stringify(values)});
const fixture=(body,attrs='')=>new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="400" height="200" ${attrs}>${body}</svg>`,{contentType:'image/svg+xml'}).window.document.documentElement;
const node=(root,key)=>root.querySelector(`[data-key="${key}"]`);
const map=(root,el,p={x:7,y:11})=>geometry.point(geometry.relativeMatrix(el,root),p);
const affine=(values,p)=>({x:values[0]*p.x+values[2]*p.y+values[4],y:values[1]*p.x+values[3]*p.y+values[5]});

test('offsets remain panel physical pt despite rotated/scaled ancestors',()=>{
  const root=fixture('<g transform="translate(30 40) rotate(90) scale(3 2)"><path data-key="e1" transform="translate(2 4)" d="M0 0L20 30"/></g>'),el=node(root,'e1'),parent=el.parentElement,before=map(root,el);
  const result=api.applyObjectTransforms(root,{e1:{'offset-x':'5','offset-y':'-3'}},2);
  pointNear(map(root,el),{x:before.x+10,y:before.y-6});assert.equal(el.parentElement,parent);assert.equal(result.changed,1);
});

test('PDF 50x and 1000x text matrices scale without rewriting local fonts or positions',()=>{
  for(const scale of [50,1000]){
    const root=fixture(`<g transform="rotate(30)"><text data-key="e1" font-size="${12/scale}" transform="matrix(${scale} 0 0 ${scale} 30 40)" x="0 .008 .014" y="0 0 0">ABC</text></g>`),el=node(root,'e1'),before=map(root,el),font=el.getAttribute('font-size'),x=el.getAttribute('x');
    api.applyObjectTransforms(root,{e1:record([3,0,0,3,10,-4])});pointNear(map(root,el),affine([3,0,0,3,10,-4],before));
    near(rich.pointSize(el)*rich.localFontScale(el,root),36);assert.equal(el.getAttribute('font-size'),font);assert.equal(el.getAttribute('x'),x);
  }
});

test('nonuniform resizing includes rotation in the physical text em basis',()=>{
  const root=fixture('<g transform="rotate(90)"><text data-key="e1" font-size="12">Text</text></g>'),el=node(root,'e1');
  api.applyObjectTransforms(root,{e1:record([2,0,0,3,0,0])});near(rich.pointSize(el)*rich.localFontScale(el,root),24);
});

test('nested SVG percentages, viewBox origin and meet viewport remain intact',()=>{
  const root=fixture('<g transform="translate(5 7)"><svg x="30" y="20" width="50%" height="40%" viewBox="10 15 100 20"><text data-key="e1" transform="rotate(20)">Nested</text></svg></g>'),el=node(root,'e1'),viewport=el.parentElement,attrs=[...viewport.attributes].map(a=>[a.name,a.value]),before=map(root,el);
  api.applyObjectTransforms(root,{e1:record([2,0,0,.5,8,-6])});pointNear(map(root,el),affine([2,0,0,.5,8,-6],before));assert.deepEqual([...viewport.attributes].map(a=>[a.name,a.value]),attrs);
});

test('a selected nested SVG applies its x/y/viewBox exactly once',()=>{
  const root=fixture('<g transform="rotate(15)"><svg data-key="e1" transform="translate(4 2)" x="30" y="20" width="200" height="80" viewBox="10 15 100 20" preserveAspectRatio="none"><path d="M0 0L10 10"/></svg></g>'),el=node(root,'e1'),before=map(root,el);
  api.applyObjectTransforms(root,{e1:record([1.4,0,0,.8,12,9])});pointNear(map(root,el),affine([1.4,0,0,.8,12,9],before));assert.equal(el.getAttribute('viewBox'),'10 15 100 20');
});

test('parent/child edits use a pre-mutation snapshot independent of edit order',()=>{
  const source='<g data-key="e1" transform="translate(20 10) rotate(30)"><path data-key="e2" transform="scale(2)" d="M0 0L20 30"/></g>',parent=[2,0,0,2,5,7],child=[1.5,0,0,.5,-2,3],one=fixture(source),two=fixture(source),before=map(one,node(one,'e2'));
  api.applyObjectTransforms(one,{e1:record(parent),e2:record(child)});api.applyObjectTransforms(two,{e2:record(child),e1:record(parent)});
  pointNear(map(one,node(one,'e2')),affine(parent,affine(child,before)));assert.equal(one.outerHTML,two.outerHTML);
});

test('an ancestor-only action transforms descendants once',()=>{
  const root=fixture('<g data-key="e1" transform="scale(5)"><text data-key="e2" font-size="2">AB<tspan data-key="e3">C</tspan></text></g>'),el=node(root,'e2');
  api.applyObjectTransforms(root,{e1:record([2,0,0,2,0,0]),e3:record([2,0,0,2,0,0])});near(rich.pointSize(el)*rich.localFontScale(el,root),20);assert.equal(node(root,'e3').hasAttribute('transform'),false);
});

test('legacy offsets apply after scaling and are not scaled themselves',()=>{
  const root=fixture('<path data-key="e1" d="M0 0L20 30"/>'),el=node(root,'e1'),before=map(root,el);
  api.applyObjectTransforms(root,{e1:{...record([2,0,0,3,4,5]),'offset-x':'7','offset-y':'-2'}},2);
  pointNear(map(root,el),{x:2*before.x+22,y:3*before.y+6});
});

test('owned scale bars follow their image with independent original transforms',()=>{
  const href='data:image/png;base64,AA==',root=fixture(`<g transform="translate(30 10) rotate(90)"><image data-key="e1" href="${href}" transform="scale(2 3)" width="100" height="50"/><g data-scale-owner="e1" transform="translate(7 3)"><rect width="10" height="1"/><text font-size="6">20 μm</text></g></g>`),image=node(root,'e1'),bar=root.querySelector('[data-scale-owner]'),beforeImage=map(root,image),beforeBar=map(root,bar),parents=[image.parentElement,bar.parentElement],delta=[.5,0,0,1.5,4,8];
  const result=api.applyObjectTransforms(root,{e1:record(delta)});pointNear(map(root,image),affine(delta,beforeImage));pointNear(map(root,bar),affine(delta,beforeBar));assert.equal(result.changed,2);assert.equal(image.getAttribute('href'),href);assert.deepEqual([image.parentElement,bar.parentElement],parents);assert.equal(bar.querySelector('text').textContent,'20 μm');
});

test('clip paths, group opacity, filters, inherited fonts and paint order survive',()=>{
  const root=fixture('<defs><clipPath id="crop"><rect width="100" height="50"/></clipPath></defs><g clip-path="url(#crop)" opacity=".6" filter="url(#effect)" font-size="9pt" fill="#abcdef"><text data-key="e1" clip-path="url(#crop)">Clipped</text><path data-key="e2" d="M0 0L20 30"/></g>'),el=node(root,'e1'),parent=el.parentElement,children=[...parent.children],attrs=[...parent.attributes].map(a=>[a.name,a.value]);
  api.applyObjectTransforms(root,{e1:record([2,0,0,2,3,4])});assert.equal(el.parentElement,parent);assert.equal(el.getAttribute('clip-path'),'url(#crop)');assert.deepEqual([...parent.children],children);assert.deepEqual([...parent.attributes].map(a=>[a.name,a.value]),attrs);near(rich.pointSize(el),12);
});

test('missing targets, text runs and definition glyphs do not receive transforms',()=>{
  const root=fixture('<defs><path data-key="e1" d="M0 0L1 1"/></defs><text>A<tspan data-key="e2">B</tspan></text><g data-scale-owner="e3"><rect width="10" height="1"/></g>'),before=root.outerHTML;
  const result=api.applyObjectTransforms(root,{e1:record([2,0,0,2,0,0]),e2:record([2,0,0,2,0,0]),e3:record([2,0,0,2,0,0])});assert.equal(result.changed,0);assert.deepEqual(result.skipped.map(x=>x.reason),['definition','text-run','missing']);assert.equal(root.outerHTML,before);
});

test('invalid/singular geometry fails before any object is partially changed',()=>{
  for(const invalid of [record([0,0,0,0,0,0]),record([1,2,2,4,0,0]),record([1,0,0,1,null,0]),{'object-transform':'not JSON'},{'offset-x':'Infinity'}]){
    const root=fixture('<path data-key="e1" d="M0 0L1 1"/><path data-key="e2" d="M0 0L1 1"/>'),before=root.outerHTML;
    assert.throws(()=>api.applyObjectTransforms(root,{e1:record([2,0,0,2,0,0]),e2:invalid}));assert.equal(root.outerHTML,before);
  }
  for(const body of ['<g style="transform:scale(2)"><path data-key="e2"/></g>','<g transform="scale(0)"><path data-key="e2"/></g>','<path data-key="e2"/><path data-key="e2"/>']){
    const root=fixture('<path data-key="e1"/>'+body),before=root.outerHTML;assert.throws(()=>api.applyObjectTransforms(root,{e1:record([2,0,0,2,0,0]),e2:record([2,0,0,2,0,0])}));assert.equal(root.outerHTML,before);
  }
});

test('identity state does not rewrite attributes',()=>{
  const root=fixture('<text data-key="e1" transform="translate(3 4) rotate(90)">ABC</text>'),before=root.outerHTML;
  assert.equal(api.applyObjectTransforms(root,{e1:{...record([1,0,0,1,0,0]),'offset-x':'0'}}).changed,0);assert.equal(root.outerHTML,before);
});

test('saved state re-renders deterministically, with no accumulated source mutation',()=>{
  const source='<g transform="rotate(20)"><text data-key="e1" transform="scale(1000)" font-size=".012">PDF</text></g>',edits={e1:{...record([2,0,0,1.5,8,9]),'offset-x':'3'}},saved=JSON.stringify(edits),first=fixture(source),second=fixture(source);
  api.applyObjectTransforms(first,edits);api.applyObjectTransforms(second,JSON.parse(saved));assert.equal(first.outerHTML,second.outerHTML);assert.equal(JSON.stringify(edits),saved);assert.equal(fixture(source).querySelector('text').getAttribute('transform'),'scale(1000)');
  const imported=new JSDOM(first.outerHTML,{contentType:'image/svg+xml'}).window.document.documentElement;pointNear(map(imported,node(imported,'e1')),map(first,node(first,'e1')));
});
console.log(`${passed} selection transform DOM regressions passed`);
