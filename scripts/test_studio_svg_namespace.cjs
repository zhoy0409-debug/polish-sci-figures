'use strict';
// Production ID isolation with actual SVG DOMs; no timing or pixel accuracy claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8');
const spacing=require('../skills/polish-sci-figures/assets/figure-studio/group-spacing.js');
function section(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+1);assert.ok(start>=0&&end>start);return source.slice(start,end);}
const dom=new JSDOM(),doc=dom.window.document,NS='http://www.w3.org/2000/svg';
const ctx={renderSerial:0,StudioGroupSpacing:spacing};vm.createContext(ctx);
vm.runInContext(section('  function statisticalAnchorMetadata(','  function statisticalSemanticPoint(')+section('  function namespace(svg) {','  let compactLayoutCache='),ctx);
const svg=body=>{const node=doc.createElementNS(NS,'svg');node.setAttribute('viewBox','0 0 500 300');node.innerHTML=body;return node;};
let tests=0;function test(name,run){run();tests++;console.log('PASS '+name);}

test('5000 plain objects retain full ID isolation without materializing unrelated Attr wrappers',()=>{
 const node=svg('<text x="10" y="20">P = 0.032</text>'+Array.from({length:4999},(_,i)=>`<rect data-key="e${i}" data-measurement="${i/7}" x="${i%100}" y="${i%50}" width="1" height="2" fill="#4477aa"/>`).join(''));
 const original=node.outerHTML,first=node.firstElementChild,rect=node.lastElementChild,start=ctx.renderSerial;
 let attributeMaps=0;const prototype=dom.window.Element.prototype,descriptor=Object.getOwnPropertyDescriptor(prototype,'attributes');
 Object.defineProperty(prototype,'attributes',{...descriptor,get(){attributeMaps++;return descriptor.get.call(this);}});
 try{assert.equal(ctx.namespace(node),node);assert.equal(node.outerHTML,original);assert.equal(node.firstElementChild,first);assert.equal(node.lastElementChild,rect);assert.ok(attributeMaps<10,'Coordinate/value attributes must not allocate per-element Attr maps');assert.equal(ctx.renderSerial,start+1);}
 finally{Object.defineProperty(prototype,'attributes',descriptor);}
});
test('root/child IDs and all local reference forms stay unique across copies',()=>{
 const original=svg('<defs><clipPath id="clip"><rect width="10" height="20"/></clipPath><linearGradient id="gradient"><stop offset="0" stop-color="#123456"/></linearGradient></defs><g id="plot" clip-path="url(#clip)"><rect id="mark" x="4" y="7" fill="url(\'#gradient\')" data-custom="url(#clip)"/><use href="#mark"/><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#mark"/></g>');original.id='root';
 const bytes=original.outerHTML,start=ctx.renderSerial,a=ctx.namespace(original.cloneNode(true)),b=ctx.namespace(original.cloneNode(true));
 for(const [i,node]of [a,b].entries()){
  const p='f'+(start+i+1)+'-';assert.equal(node.id,p+'root');assert.equal(node.querySelector('g').getAttribute('clip-path'),'url(#'+p+'clip)');
  const mark=node.querySelector('g rect');assert.equal(mark.id,p+'mark');assert.equal(mark.getAttribute('data-custom'),'url(#'+p+'clip)');assert.equal(mark.getAttribute('fill'),'url(#'+p+'gradient)');assert.equal(mark.getAttribute('x'),'4');assert.equal(mark.getAttribute('y'),'7');
  for(const use of node.querySelectorAll('use'))assert.equal(use.getAttribute('href')||use.getAttributeNS('http://www.w3.org/1999/xlink','href'),'#'+p+'mark');
 }
 const ids=node=>[node.id,...node.querySelectorAll('[id]')].map(x=>typeof x==='string'?x:x.id);assert.equal(ids(a).some(id=>ids(b).includes(id)),false);assert.equal(original.outerHTML,bytes);
});
test('dangling custom url and entity-decoded href still use the full path',()=>{
 for(const body of ['<rect data-custom="url(\'#missing\')"/>','<use href="&#35;missing"/>','<use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="&#35;missing"/>']){
  const node=svg(body),p='f'+(ctx.renderSerial+1)+'-';ctx.namespace(node);assert.ok(node.outerHTML.includes(p+'missing'));
 }
});
test('images and unknown metadata retain the established conservative path',()=>{
 const color='{"reference":"url(#unrelated)","gamma":1.2}',node=svg('<metadata>{"sampleCount":12,"window":[0,4095]}</metadata><image href="data:image/png;base64,AA=="/>');node.querySelector('image').setAttribute('data-studio-image-color',color);
 const before=node.outerHTML,serial=ctx.renderSerial;ctx.namespace(node);assert.equal(ctx.renderSerial,serial+1);assert.equal(node.outerHTML,before);assert.equal(node.querySelector('image').getAttribute('data-studio-image-color'),color);
});
test('scientific anchor metadata keeps labels, centers and comparison identity',()=>{
 const record={version:1,axes:[{axis:'axis',groups:[{group:'实验组',facet:{column:'method',value:'WB'},center:[3,7],members:['point']}]}]};
 const node=svg('<metadata id="studio-stat-anchors"></metadata><g id="axis"><rect id="point" x="3" y="7"/></g>');node.querySelector('metadata').textContent=JSON.stringify(record);
 const p='f'+(ctx.renderSerial+1)+'-';ctx.namespace(node);const actual=JSON.parse(node.querySelector('metadata').textContent);assert.equal(actual.axes[0].axis,p+'axis');assert.deepEqual(actual.axes[0].groups[0],{...record.axes[0].groups[0],members:[p+'point']});assert.equal(node.querySelector('metadata').id,p+'studio-stat-anchors');assert.deepEqual(record.axes[0].groups[0].members,['point']);
});
dom.window.close();console.log('PASS '+tests+' SVG namespace isolation and large-plain-artwork cases');
