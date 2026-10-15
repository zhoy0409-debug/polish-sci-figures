/* Real XML DOM, real production clipboard serializer/composer and geometry. */
'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const api=require('../skills/polish-sci-figures/assets/figure-studio/canvas-clipboard.js');
const geometry=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
const color=require('../skills/polish-sci-figures/assets/figure-studio/image-color.js');
const NS='http://www.w3.org/2000/svg',XLINK='http://www.w3.org/1999/xlink';
const read=xml=>new JSDOM(xml,{contentType:'image/svg+xml'}).window.document.documentElement;
const fixture=(body,attrs='')=>read(`<svg xmlns="${NS}" xmlns:xlink="${XLINK}" width="400pt" height="200pt" viewBox="10 20 400 200" ${attrs}>${body}</svg>`);
const snapshot=source=>api.serialize({svg:source,keys:['e1'],bounds:{x:30,y:40,width:80,height:60},matrix:[1,0,0,1,0,0]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(a),Math.abs(b)),`${a} != ${b}`);
const coords=(root,node,p={x:2,y:3})=>geometry.point(geometry.relativeMatrix(node,root),p);
const nearPoint=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
const tail=(root,id)=>[...root.querySelectorAll('[id]')].find(node=>node.id.endsWith('-'+id));
const refsExist=root=>{const ids=[...root.querySelectorAll('[id]')].map(node=>node.id);assert.equal(new Set(ids).size,ids.length);for(const node of root.querySelectorAll('*'))for(const attr of [...node.attributes]){if(attr.localName==='href'&&attr.value.startsWith('#'))assert.ok(ids.includes(attr.value.slice(1)));for(const m of attr.value.matchAll(/url\(#([^)]*)\)/g))assert.ok(ids.includes(m[1]));}};
let passed=0;function test(name,fn){fn();passed++;console.log('PASS '+name);}

test('pasting into an occupied panel preserves all old nodes, editing keys and paper dimensions',()=>{
  const source=fixture('<g font-family="UnlistedResearchFont" fill="#123456"><text data-key="e1" id="copied-text" x="1 .2 .4" y=".8" transform="scale(50)" font-size=".24">ABC<tspan font-style="italic">2</tspan></text></g>');
  const destination=fixture('<defs data-key="e1"><clipPath id="crop" data-key="e2"><rect data-key="e3" width="200" height="100"/></clipPath></defs><g data-key="e4" transform="translate(8 9)"><text data-key="e5" id="original">Keep exactly</text></g>','data-key="e0"');
  const before=destination.outerHTML,sourceBefore=source.outerHTML,original=destination.querySelector('#original').parentElement.outerHTML;
  const result=api.append({svg:destination,snapshot:snapshot(source),matrix:[1,0,0,1,50,60]}),out=read(result.svg);
  for(const attr of ['width','height','viewBox'])assert.equal(out.getAttribute(attr),destination.getAttribute(attr));
  assert.equal(out.querySelector('#original').parentElement.outerHTML,original);assert.equal(out.querySelector('[data-key=e5]').id,'original');
  assert.equal(out.querySelectorAll('text').length,2);assert.equal(out.querySelector(`[id="${result.selectedId}"]`).getAttribute('data-key'),result.key);
  assert.equal(destination.outerHTML,before);assert.equal(source.outerHTML,sourceBefore);assert.ok(result.keys.every(key=>+key.slice(1)>5));
});

test('PDF text keeps its 50x matrix, per-character advances, mixed runs and physical point mapping',()=>{
  const source=fixture('<g transform="translate(14 22) rotate(13)" font-family="UnlistedResearchFont, Arial" opacity=".4"><text id="copy" data-key="e1" transform="scale(50)" font-size=".24" x="0 .1 .2" y=".8">AB<tspan font-size="70%" baseline-shift="super" font-style="italic">2</tspan></text></g>');
  const snap=snapshot(source),destination=fixture('<text data-key="e8">Different</text>'),m=[.5,0,0,.5,100,120];
  const out=read(api.append({svg:destination,snapshot:snap,matrix:m}).svg),text=tail(out,'copy');
  const old=coords(source,source.querySelector('text')),local={x:old.x-snap.bounds.x,y:old.y-snap.bounds.y};
  nearPoint(coords(out,text),geometry.point({a:m[0],b:m[1],c:m[2],d:m[3],e:m[4],f:m[5]},local));
  assert.equal(text.getAttribute('transform'),'scale(50)');assert.equal(text.getAttribute('font-size'),'.24');assert.equal(text.getAttribute('x'),'0 .1 .2');assert.equal(text.querySelector('tspan').getAttribute('font-size'),'70%');assert.equal(text.querySelector('tspan').getAttribute('baseline-shift'),'super');
  assert.equal(text.parentElement.getAttribute('opacity'),'.4');assert.equal(text.parentElement.parentElement.getAttribute('opacity'),null);
});

test('root inherited typography is captured without multiplying root opacity or clipping',()=>{
  const source=fixture('<text data-key="e1">Inherited</text>','opacity=".5"');
  const values={'font-family':'"Research Sans", Arial, sans-serif','font-size':'13px','font-style':'italic','font-weight':'700','fill':'rgb(20, 40, 60)','stroke':'none','opacity':'.5','clip-path':'url(#unrelated-outer-clip)','transform':'matrix(2, 0, 0, 2, 0, 0)'};
  source.ownerDocument.defaultView.getComputedStyle=()=>({getPropertyValue:key=>values[key]||''});
  const out=read(snapshot(source).svg),root=[...out.querySelectorAll('svg')][0];
  assert.equal(root.style.fontFamily,values['font-family']);assert.equal(root.style.fontSize,'13px');assert.equal(root.style.fontStyle,'italic');assert.equal(root.style.fill,values.fill);
  assert.equal(root.getAttribute('opacity'),'.5');assert.equal(root.style.opacity,'');assert.equal(root.style.clipPath,'');assert.equal(root.style.transform,'');
});

test('declared source font attributes and styles stay authoritative over computed fallbacks',()=>{
  const source=fixture('<text data-key="e1">A</text>','font-family="CustomFace" font-size="8" style="font-weight:600"');
  source.ownerDocument.defaultView.getComputedStyle=()=>({getPropertyValue:key=>({'font-family':'Arial','font-size':'16px','font-weight':'400'})[key]||''});
  const out=read(snapshot(source).svg),root=out.querySelector('svg');
  assert.equal(root.getAttribute('font-family'),'CustomFace');assert.equal(root.style.fontFamily,'');assert.equal(root.getAttribute('font-size'),'8');assert.equal(root.style.fontSize,'');assert.equal(root.style.fontWeight,'600');
});

test('an explicit inherited root font is resolved before the copy moves to a different parent',()=>{
  const source=fixture('<text data-key="e1">A</text>','font-family="inherit" style="font-size:inherit"');
  source.ownerDocument.defaultView.getComputedStyle=()=>({getPropertyValue:key=>({'font-family':'CustomFace, Arial','font-size':'9px'})[key]||''});
  const out=read(snapshot(source).svg),root=out.querySelector('svg');assert.equal(root.style.fontFamily,'CustomFace, Arial');assert.equal(root.style.fontSize,'9px');
});

test('ordinary font inheritance introduces no Chromium-expanded font-variant shorthand or redundant stretch',()=>{
  const source=fixture('<text data-key="e1">Ordinary imported text</text>'),window=source.ownerDocument.defaultView,proto=window.CSSStyleDeclaration.prototype,setProperty=proto.setProperty;let variantWrites=0;
  window.getComputedStyle=()=>({getPropertyValue:key=>({'font-family':'Arial','font-size':'13px','font-variant':'normal','font-stretch':'100%'})[key]||''});
  proto.setProperty=function(prop,value,...rest){if(prop==='font-variant'){variantWrites++;setProperty.call(this,'font-variant-ligatures','normal');}return setProperty.call(this,prop,value,...rest);};
  const out=read(snapshot(source).svg),root=out.querySelector('svg');assert.equal(variantWrites,0);assert.equal(root.style.getPropertyValue('font-variant'),'');assert.equal(root.style.getPropertyValue('font-stretch'),'');assert.equal(root.style.fontFamily,'Arial');assert.equal(root.style.fontSize,'13px');
});

test('recursive definitions, xlink references, source selection IDs and repeated pastes remain independent',()=>{
  const source=fixture('<defs><path id="glyph" d="M0 0L5 5"/><g id="marker"><use xlink:href="#glyph"/></g><linearGradient id="grad"><stop stop-color="red"/></linearGradient></defs><g data-key="e1" id="selection"><use href="#marker"/><rect width="20" height="30" fill="url(#grad)"/></g>');
  const snap=snapshot(source),destination=fixture('<defs data-key="e1"><path id="glyph" data-key="e2" d="M0 0L1 1"/></defs><text data-key="e3">Original</text>');
  const first=api.append({svg:destination,snapshot:snap,matrix:[1,0,0,1,5,6]}),second=api.append({svg:read(first.svg),snapshot:snap,matrix:[1,0,0,1,15,16]}),out=read(second.svg);
  assert.notEqual(first.selectedId,second.selectedId);assert.equal(out.querySelector('#glyph').getAttribute('d'),'M0 0L1 1');refsExist(out);
  const keys=[...out.querySelectorAll('[data-key]')].map(node=>node.getAttribute('data-key'));assert.equal(new Set(keys).size,keys.length);assert.ok(second.keys.every(key=>!first.keys.includes(key)));
});

test('verified raster adjustment survives ID remapping and remains reversible without changing pixels',()=>{
  const raw='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVJcAAAAASUVORK5CYII=',source=fixture(`<image data-key="e1" id="raster" href="${raw}" width="50" height="40"/>`);
  color.apply(source.querySelector('image'),{exposureEv:.25,tint:.2},{root:source,id:'adjustment'});
  const out=read(api.append({svg:fixture('<text data-key="e9">Keep</text>'),snapshot:snapshot(source),matrix:[1,0,0,1,0,0]}).svg),image=out.querySelector('image');
  assert.equal(image.getAttribute('href'),raw);assert.equal(color.inspect(image,out).exposureEv,.25);refsExist(out);
  color.apply(image,{exposureEv:-.2},{root:out,id:'new-adjustment'});assert.equal(image.getAttribute('href'),raw);assert.equal(color.inspect(image,out).exposureEv,-.2);
});

test('unsafe copied fragments fail atomically and cannot alter existing destination objects',()=>{
  const destination=fixture('<text data-key="e1" id="keep">Keep</text>'),before=destination.outerHTML;
  const wrap=body=>({svg:`<svg xmlns="${NS}" viewBox="0 0 80 60">${body}</svg>`,width:80,height:60});
  for(const body of ['<script>bad()</script>','<text onclick="bad()">A</text>','<image href="https://example.com/image.png"/>','<path style="fill:url(https://example.com/remote)"/>','<use href="#missing"/>','<defs><g id="loop"><use href="#loop"/></g></defs><use href="#loop"/>','<path style="transform:scale(2)"/>','<style>text {fill:red}</style><text>A</text>','<path filter="url(#missing)"/>']){
    assert.throws(()=>api.append({svg:destination,snapshot:wrap(body)}),error=>/^clipboard-/.test(error.code));assert.equal(destination.outerHTML,before);
  }
});

test('invalid dimensions, duplicate keys, singular matrices and malformed XML never produce a partial paste',()=>{
  const destination=fixture('<text data-key="e1">Keep</text>'),before=destination.outerHTML,snap=snapshot(fixture('<text data-key="e1">Copy</text>'));
  for(const options of [{snapshot:{...snap,width:0}},{snapshot:{...snap,svg:snap.svg.replace('viewBox="0 0 80 60"','viewBox="0 0 81 60"')}},{matrix:[0,0,0,0,0,0]},{keyStart:-1},{snapshot:{...snap,svg:'<svg><not-closed>'}},{snapshot:{...snap,svg:'<!DOCTYPE svg><svg/>'}}]){
    assert.throws(()=>api.append({svg:destination,snapshot:snap,...options}),error=>/^clipboard-/.test(error.code));assert.equal(destination.outerHTML,before);
  }
  const ambiguous=fixture('<text data-key="e1">A</text><text data-key="e1">B</text>');assert.throws(()=>api.append({svg:ambiguous,snapshot:snap}),error=>error.code==='clipboard-selection');
});

test('requested key range reserves future imported objects without renumbering existing content',()=>{
  const out=api.append({svg:fixture('<text data-key="e2">Keep</text>'),snapshot:snapshot(fixture('<text data-key="e1">Copy</text>')),keyStart:7000000});
  assert.equal(out.key,'e7000000');assert.ok(out.keys.every(key=>+key.slice(1)>=7000000));assert.equal(read(out.svg).querySelector('[data-key=e2]').textContent,'Keep');
});

test('mounting lightweight records preserves source keys and stable inserted keys on every fresh render',()=>{
  const snap=snapshot(fixture('<text id="stable-text" data-key="e1" transform="scale(50)" font-size=".24">Stable</text>'));
  const insertions=[{svg:snap.svg,matrix:[1,0,0,1,10,20],keyStart:1000000000},{svg:snap.svg,matrix:[1,0,0,1,40,50],keyStart:1000100001}],first=fixture('<text id="original" data-key="e4">Original</text>'),second=fixture('<text id="original" data-key="e4">Original</text>');
  const before=first.querySelector('text').outerHTML,a=api.mountAll({svg:first,insertions}),b=api.mountAll({svg:second,insertions});
  assert.equal(a.svg,first);assert.equal(first.querySelector('#original').outerHTML,before);assert.equal(first.querySelectorAll('text').length,3);assert.deepEqual(a.keys,['e1000000000','e1000100001']);assert.deepEqual(a.groups.map(group=>group.keys),b.groups.map(group=>group.keys));assert.ok(a.keys.every(key=>first.querySelector(`[data-key="${key}"]`).getAttribute('data-studio-inserted')==='true'));
  assert.notEqual(a.groups[0].selectedId,b.groups[0].selectedId);for(const root of [first,second])refsExist(root);
});

test('only the newly generated reserved-key wrapper owns the inserted marker',()=>{
  const source=fixture('<g data-key="e1" data-studio-inserted="true"><text data-studio-inserted="true">Copy</text></g>'),snap=snapshot(source);assert.equal(read(snap.svg).querySelector('[data-studio-inserted]'),null);
  const target=fixture('<text data-key="e9">Keep</text>'),result=api.mountAll({svg:target,insertions:[{svg:snap.svg,matrix:[1,0,0,1,0,0],keyStart:1000000000}]});assert.equal(target.querySelectorAll('[data-studio-inserted]').length,1);assert.equal(target.querySelector('[data-studio-inserted]').getAttribute('data-key'),result.keys[0]);assert.equal(target.querySelector('[data-studio-inserted]').getAttribute('data-studio-inserted'),'true');
});

test('mountAll validates all records before one atomic append and rejects overlapping stable ranges',()=>{
  const snap=snapshot(fixture('<text data-key="e1">Copy</text>')),good={svg:snap.svg,matrix:[1,0,0,1,0,0],keyStart:1000000000};
  for(const bad of [{...good,svg:snap.svg.replace('</svg>','<script>bad()</script></svg>')},{...good,keyStart:1000000001},{...good,keyStart:1},{...good,keyStart:undefined},{...good,matrix:[0,0,0,0,0,0]}]){
    const target=fixture('<text data-key="e5">Original</text>'),before=target.outerHTML;assert.throws(()=>api.mountAll({svg:target,insertions:[good,bad]}),error=>/^clipboard-/.test(error.code));assert.equal(target.outerHTML,before);
  }
  const existing=fixture('<text data-key="e1000000002">Original</text>'),before=existing.outerHTML;assert.throws(()=>api.mountAll({svg:existing,insertions:[good]}),error=>error.code==='clipboard-selection');assert.equal(existing.outerHTML,before);
});

test('mounting many records never deep-clones or serializes the existing destination',()=>{
  const snap=snapshot(fixture('<text data-key="e1">Cached repeated content</text>')),target=fixture('<g data-key="e1"><text data-key="e2">Keep original</text></g>'),original=target.querySelector('g'),insertions=Array.from({length:20},(_,index)=>({svg:snap.svg,matrix:[1,0,0,1,index,index],keyStart:1000000000+index*100001}));
  target.cloneNode=()=>{throw Error('A render must not clone the entire destination per paste');};Object.defineProperty(target,'outerHTML',{get(){throw Error('A render must not serialize the entire destination per paste');}});
  const result=api.mountAll({svg:target,insertions});assert.equal(result.groups.length,20);assert.equal(target.querySelector('g'),original);assert.equal(target.querySelectorAll('text').length,21);
});

test('validateOnly prepares stable groups and editable text keys without cloning, serializing or mounting the destination',()=>{
  const source=fixture('<defs><text id="definition-text">Definition</text></defs><g data-key="e1"><use href="#definition-text"/><text id="actual-label">Editable</text></g>'),snap=snapshot(source),target=fixture('<text data-key="e9">Keep original</text>'),before=target.innerHTML;
  target.cloneNode=()=>{throw Error('A preflight must not clone the destination');};Object.defineProperty(target,'outerHTML',{get(){throw Error('A preflight must not serialize the destination');}});
  const record={svg:snap.svg,matrix:[1,0,0,1,1,2],keyStart:1000000000},result=api.mountAll({svg:target,insertions:[record],validateOnly:true});
  assert.equal(target.innerHTML,before);assert.equal(result.groups[0].key,'e1000000000');assert.equal(result.groups[0].textKeys.length,1);assert.ok(result.groups[0].keys.includes(result.groups[0].textKeys[0]));assert.equal(target.querySelector(`[data-key="${result.groups[0].textKeys[0]}"]`),null);
  const mounted=api.mountAll({svg:target,insertions:[record]});assert.deepEqual(mounted.groups[0].textKeys,result.groups[0].textKeys);assert.equal(target.querySelector(`[data-key="${result.groups[0].textKeys[0]}"]`).textContent,'Editable');
});

test('validateOnly still rejects a later invalid record without partially mounting an earlier one',()=>{
  const snap=snapshot(fixture('<text data-key="e1">Copy</text>')),target=fixture('<text data-key="e5">Original</text>'),before=target.outerHTML,good={svg:snap.svg,matrix:[1,0,0,1,0,0],keyStart:1000000000},bad={...good,keyStart:1000100001,svg:snap.svg.replace('</svg>','<use href="#missing"/></svg>')};
  assert.throws(()=>api.mountAll({svg:target,insertions:[good,bad],validateOnly:true}),error=>error.code==='clipboard-reference');assert.equal(target.outerHTML,before);
});

test('cached templates cannot be modified by a previous mounted result or destination styling',()=>{
  const snap=snapshot(fixture('<text id="unaltered" data-key="e1" font-family="UnknownFace" font-size="12">Still original</text>')),record={svg:snap.svg,matrix:[1,0,0,1,0,0],keyStart:1000000000};
  const first=fixture('<text data-key="e2">Keep</text>'),a=api.mountAll({svg:first,insertions:[record]});tail(first,'unaltered').textContent='User edited copy';tail(first,'unaltered').setAttribute('font-family','Arial');
  const second=fixture('<text data-key="e2">Keep</text>','font-family="Times New Roman" fill="red"'),b=api.mountAll({svg:second,insertions:[record]});
  assert.equal(tail(second,'unaltered').textContent,'Still original');assert.equal(tail(second,'unaltered').getAttribute('font-family'),'UnknownFace');assert.equal(a.keys[0],b.keys[0]);
});

test('computed root paint references keep their definitions before serialization and remain local on paste',()=>{
  const source=fixture('<defs><linearGradient id="inherited-gradient"><stop stop-color="blue"/></linearGradient></defs><text data-key="e1">Gradient</text>');
  source.ownerDocument.defaultView.getComputedStyle=()=>({getPropertyValue:key=>key==='fill'?'url(#inherited-gradient)':''});
  const snap=snapshot(source),out=read(snap.svg);assert.ok(tail(out,'inherited-gradient'));refsExist(out);
  const target=fixture('<text data-key="e9">Keep</text>');api.mountAll({svg:target,insertions:[{svg:snap.svg,keyStart:1000000000,matrix:[1,0,0,1,0,0]}]});refsExist(target);
});

console.log(`${passed} canvas clipboard append regression groups passed.`);
