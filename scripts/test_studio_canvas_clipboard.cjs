/* The actual serializer and SVG geometry helpers, with a real XML DOM. */
'use strict';
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const api=require('../skills/polish-sci-figures/assets/figure-studio/canvas-clipboard.js');
const geometry=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
const rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js');
const color=require('../skills/polish-sci-figures/assets/figure-studio/image-color.js');
const NS='http://www.w3.org/2000/svg';
let passed=0;
function test(name,fn){fn();passed++;console.log('PASS '+name);}
const fixture=(body,attrs='')=>new JSDOM(`<svg xmlns="${NS}" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="200" viewBox="0 0 400 200" overflow="visible" ${attrs}>${body}</svg>`,{contentType:'image/svg+xml'}).window.document.documentElement;
const read=text=>new JSDOM(text,{contentType:'image/svg+xml'}).window.document.documentElement;
const bounds={x:0,y:0,width:400,height:200};
const copy=(svg,keys,options={})=>api.serialize({svg,keys,bounds,...options});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const map=(root,el,p={x:2,y:3})=>geometry.point(geometry.relativeMatrix(el,root),p);
const pointNear=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
const keyed=(root,key)=>root.querySelector(`[data-key="${key}"]`);
const named=(root,id)=>[...root.querySelectorAll('[id]')].find(node=>node.id.endsWith('-'+id));

test('a PDF text selection retains its 50x transform, character coordinates and mixed runs',()=>{
  const source=fixture('<g transform="translate(30 40) rotate(15)" font-family="Arial" fill="#223344"><text id="label" data-key="e1" transform="scale(50)" font-size=".24" x="0 .1 .2">P<tspan font-size="70%" baseline-shift="super" font-style="italic">2</tspan></text><rect data-key="e2" width="60" height="30"/></g>');
  const before=source.outerHTML,original=keyed(source,'e1'),result=copy(source,['e1']),out=read(result.svg),text=named(out,'label');
  pointNear(map(out,text),map(source,original));near(rich.pointSize(text)*rich.localFontScale(text,out),12);
  assert.equal(text.getAttribute('x'),'0 .1 .2');assert.equal(text.querySelector('tspan').getAttribute('font-size'),'70%');assert.equal(text.querySelector('tspan').getAttribute('baseline-shift'),'super');
  assert.equal(text.parentElement.getAttribute('fill'),'#223344');assert.equal(out.querySelector('rect'),null);assert.equal(source.outerHTML,before);assert.deepEqual(result.keys,['e1']);
});

test('canvas-pt bounds and panel viewBox matrix preserve visible size independently of zoom',()=>{
  const main=fixture('<svg data-panel="p" x="50" y="60" width="200" height="100" viewBox="10 20 100 50" overflow="visible"><g transform="translate(5 4) scale(2)"><path data-key="e1" id="shape" d="M0 0L10 10"/></g></svg>'),panel=main.querySelector('svg'),shape=keyed(panel,'e1'),before=map(main,shape),b={x:30,y:40,width:240,height:140};
  const result=copy(panel,['e1'],{bounds:b,matrix:geometry.relativeMatrix(panel,main)}),out=read(result.svg);
  pointNear(map(out,named(out,'shape')),{x:before.x-b.x,y:before.y-b.y});assert.equal(out.getAttribute('width'),'240pt');assert.equal(out.getAttribute('height'),'140pt');assert.deepEqual(result.viewBox,[0,0,240,140]);
});

test('nested SVG viewport percentages and ancestor clips remain in their original hierarchy',()=>{
  const source=fixture('<defs><clipPath id="crop" clipPathUnits="userSpaceOnUse"><rect x="20" y="10" width="200" height="100"/></clipPath></defs><g clip-path="url(#crop)" transform="translate(4 7)"><svg x="10%" y="20%" width="50%" height="50%" viewBox="5 10 100 30"><text id="nested" data-key="e1" font-size="8">Nested</text><path data-key="e2" d="M0 0L10 20"/></svg></g>');
  const out=read(copy(source,['e1']).svg),text=named(out,'nested');pointNear(map(out,text),map(source,keyed(source,'e1')));
  assert.equal(text.parentElement.getAttribute('width'),'50%');assert.equal(text.parentElement.getAttribute('viewBox'),'5 10 100 30');assert.match(text.parentElement.parentElement.getAttribute('clip-path'),/^url\(#clipboard-/);assert.equal(out.querySelectorAll('clipPath').length,1);
});

test('shared group opacity is preserved once and siblings keep document paint order',()=>{
  const source=fixture('<g opacity=".4" fill="#123456"><path id="first" data-key="e1" d="M0 0L20 20"/><path id="unused" data-key="e2" d="M0 0L30 30"/><path id="last" data-key="e3" d="M0 0L40 40"/></g>'),out=read(copy(source,['e3','e1']).svg),first=named(out,'first'),last=named(out,'last');
  assert.equal(first.parentElement,last.parentElement);assert.equal(first.parentElement.getAttribute('opacity'),'.4');assert.deepEqual([...first.parentElement.children].map(el=>el.id.split('-').at(-1)),['first','last']);assert.equal(named(out,'unused'),undefined);
});

test('definition dependencies are retained recursively, namespaced, and unrelated definitions removed',()=>{
  const source=fixture('<defs font-family="Arial"><path id="glyph" d="M0 0L5 5"/><g id="marker"><use xlink:href="#glyph"/></g><linearGradient id="color0"><stop offset="0" stop-color="red"/></linearGradient><linearGradient id="color1" xlink:href="#color0"/><path id="unused" d="M1 1L2 2"/></defs><g data-key="e1"><use href="#marker" x="20" y="30"/><path d="M0 0L10 10" fill="url(\'#color1\')"/></g>');
  const one=read(copy(source,['e1']).svg),two=read(copy(source,['e1']).svg);assert.equal(named(one,'unused'),undefined);assert.ok(named(one,'glyph'));assert.ok(named(one,'color0'));assert.notEqual(named(one,'glyph').id,named(two,'glyph').id);
  for(const root of [one,two])for(const node of root.querySelectorAll('*'))for(const a of [...node.attributes]){
    if(a.localName==='href'&&a.value.startsWith('#'))assert.ok([...root.querySelectorAll('[id]')].some(el=>el.id===a.value.slice(1)));
    for(const match of a.value.matchAll(/url\(#([^)]*)\)/g))assert.ok([...root.querySelectorAll('[id]')].some(el=>el.id===match[1]));
  }
});

test('tspan selection expands to the whole text and overlapping parent-child selections deduplicate',()=>{
  const source=fixture('<g data-key="e1" id="whole"><text data-key="e2">A<tspan data-key="e3" font-style="italic">B</tspan></text><path data-key="e4" d="M0 0L20 20"/></g>');
  const text=copy(source,['e3']);assert.deepEqual(text.keys,['e2']);assert.equal(read(text.svg).querySelector('text').textContent,'AB');
  const whole=copy(source,['e1','e2','e4']);assert.deepEqual(whole.keys,['e1']);assert.equal(whole.count,1);assert.equal(read(whole.svg).querySelectorAll('path').length,1);
});

test('referencing a definition group after one of its children retains the complete group',()=>{
  const source=fixture('<defs><g id="all"><path id="first" d="M0 0L10 10"/><path id="second" d="M20 20L30 30"/></g></defs><g data-key="e1"><use href="#first"/><use href="#all"/></g>'),out=read(copy(source,['e1']).svg);
  assert.ok(named(out,'first'));assert.ok(named(out,'second'));assert.equal(named(out,'all').children.length,2);
});

test('import-compatible numeric SVG IDs receive safe isolated output IDs',()=>{
  const out=read(copy(fixture('<defs><path id="123" d="M0 0L10 10"/></defs><use data-key="e1" href="#123"/>'),['e1']).svg);
  assert.ok(named(out,'123'));assert.equal(out.querySelector('use').getAttribute('href'),'#'+named(out,'123').id);
});

test('editor keys, highlights and statistical metadata never become new source data',()=>{
  const source=fixture('<metadata id="studio-stat-anchors">{"some":"data"}</metadata><g data-panel-content="p"><text data-key="e1" data-role="ticks" class="chosen" style="fill:#123456;cursor:move;outline:1px solid red">A</text></g>'),out=read(copy(source,['e1']).svg);
  assert.equal(out.querySelector('[data-key],[data-panel-content],[data-role],.chosen,metadata'),null);assert.equal(out.querySelector('text').style.fill,'#123456');assert.equal(out.querySelector('text').style.cursor,'');assert.equal(out.querySelector('text').style.outline,'');
});

test('embedded raster bytes and verified reversible image color adjustment survive copying',()=>{
  const raw='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVJcAAAAASUVORK5CYII=',source=fixture(`<image data-key="e1" id="raster" href="${raw}" width="80" height="50"/>`),image=keyed(source,'e1');
  color.apply(image,{exposureEv:.25,tint:.2},{root:source,id:'adjustment'});const before=source.outerHTML,out=read(copy(source,['e1']).svg),copied=named(out,'raster');
  assert.equal(copied.getAttribute('href'),raw);assert.equal(color.inspect(copied,out).exposureEv,.25);assert.equal(color.inspect(copied,out).tint,.2);assert.equal(source.outerHTML,before);
  color.apply(copied,{exposureEv:-.2},{root:out,id:'new-color'});assert.equal(copied.getAttribute('href'),raw);assert.equal(color.inspect(copied,out).exposureEv,-.2);
});

test('hidden, ambiguous, absent, definition and empty selections are rejected atomically',()=>{
  for(const [body,keys]of [['<path data-key="e1" display="none"/>',['e1']],['<g visibility="hidden"><text data-key="e1">A</text></g>',['e1']],['<path data-key="e1"/><path data-key="e1"/>',['e1']],['<path data-key="e1"/>',['e2']],['<defs><path data-key="e1"/></defs>',['e1']],['<path data-key="e1"/>',[]]]){
    const source=fixture(body),before=source.outerHTML;assert.throws(()=>copy(source,keys),error=>/^clipboard-/.test(error.code));assert.equal(source.outerHTML,before);
  }
});

test('missing, cyclic and outside-definition references fail rather than silently changing the artwork',()=>{
  for(const body of ['<use data-key="e1" href="#missing"/>','<defs><g id="loop"><use href="#loop"/></g></defs><use data-key="e1" href="#loop"/>','<path id="visible" d="M0 0L20 20"/><use data-key="e1" href="#visible"/>'])assert.throws(()=>copy(fixture(body),['e1']),error=>error.code==='clipboard-reference');
});

test('active content, external resources, stylesheet and arbitrary filters are not copied',()=>{
  for(const body of ['<g data-key="e1"><script>alert(1)</script></g>','<path data-key="e1" onclick="alert(1)"/>','<image data-key="e1" href="https://example.com/research.png"/>','<image data-key="e1" href="data:image/svg+xml;base64,PHN2Zz4="/>','<style>text{fill:red}</style><text data-key="e1">A</text>','<defs><filter id="fx"><feGaussianBlur stdDeviation="2"/></filter></defs><path data-key="e1" filter="url(#fx)"/>','<path data-key="e1" style="fill:url(https://example.com/a)"/>','<path data-key="e1" style="transform:scale(2)"/>']){
    const source=fixture(body),before=source.outerHTML;assert.throws(()=>copy(source,['e1']),error=>/^clipboard-/.test(error.code));assert.equal(source.outerHTML,before);
  }
});

test('a partial objectBoundingBox crop is rejected but the complete cropped group remains valid',()=>{
  const source=fixture('<defs><clipPath id="crop" clipPathUnits="objectBoundingBox"><rect x=".1" y=".1" width=".8" height=".8"/></clipPath></defs><g data-key="e1" clip-path="url(#crop)"><path data-key="e2" d="M0 0L20 20"/><path data-key="e3" d="M0 0L100 100"/></g>');
  assert.throws(()=>copy(source,['e2']),error=>error.code==='clipboard-clip');assert.ok(read(copy(source,['e1']).svg).querySelector('clipPath'));
});

test('invalid bounds and singular matrices are rejected before any partial output',()=>{
  const source=fixture('<path data-key="e1" d="M0 0L1 1"/>');
  for(const value of [{...bounds,width:0},{...bounds,height:Infinity},{...bounds,x:NaN}])assert.throws(()=>copy(source,['e1'],{bounds:value}));
  for(const value of [[0,0,0,0,0,0],[1,2,2,4,0,0],[1,0,0,1,Infinity,0],[1,0,0]])assert.throws(()=>copy(source,['e1'],{matrix:value}));
});

console.log(`${passed} canvas clipboard regression groups passed.`);
