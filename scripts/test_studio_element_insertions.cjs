'use strict';
const assert=require('node:assert/strict');
const api=require('../skills/polish-sci-figures/assets/figure-studio/element-insertions.js');
const xml=text=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30"><text font-family="Unknown Research Font, Arial" font-size=".24" transform="scale(50)">${text}</text></svg>`;
const identity=[1,0,0,1,0,0],base=()=>({variant:0,edits:{0:{e1:{fill:'#123456'}}},lockedElements:{0:['e3']},contentTransforms:{0:identity},label:{text:'A'},geometry:{barWidth:1,groupGap:1}});
const record=(svg=xml('ABC'),keyStart=api.limits.minInsertionKey,matrix=identity)=>({svg,keyStart,matrix});
const invalid=fn=>assert.throws(fn,error=>error.code==='element-insertions');
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};

test('legacy projects need no migration and empty variant maps remain valid',()=>{assert.equal(api.validate(undefined,{variantCount:1}),true);assert.equal(api.validate({0:[]},{variantCount:1}),true);});
test('paste retains source text/font/geometry and every unrelated panel reference',()=>{
  const panel=base(),before=JSON.stringify(panel),svg=xml('A<tspan font-style="italic">2</tspan>'),result=api.append(panel,0,svg,[.5,0,0,.5,12,18],{variantCount:1});
  assert.notEqual(result.panel,panel);assert.equal(JSON.stringify(panel),before);assert.equal(result.record.svg,svg);assert.equal(result.key,'e1000000000');
  for(const key of ['edits','lockedElements','contentTransforms','label','geometry'])assert.equal(result.panel[key],panel[key]);assert.deepEqual(result.record.matrix,[.5,0,0,.5,12,18]);
});
test('successive and cross-variant pastes reserve stable disjoint keys without replacing earlier records',()=>{
  const first=api.append(base(),0,xml('One'),identity,{variantCount:2}),second=api.append(first.panel,1,xml('Two'),identity,{variantCount:2}),third=api.append(second.panel,0,xml('Three'),identity,{variantCount:2});
  assert.equal(second.keyStart,first.keyStart+100001);assert.equal(third.keyStart,second.keyStart+100001);assert.equal(third.panel.insertedElements[0][0],first.record);assert.equal(third.panel.insertedElements[1],second.panel.insertedElements[1]);assert.equal(first.panel.insertedElements[0].length,1);
  const restored=JSON.parse(JSON.stringify(third.panel));assert.equal(api.validate(restored.insertedElements,{variantCount:2}),true);assert.deepEqual(restored.insertedElements,third.panel.insertedElements);
});
test('one invalid paste cannot change state, edit references, clipboard source or input matrix',()=>{
  const panel=api.append(base(),0,xml('Keep'),identity,{variantCount:1}).panel,before=JSON.stringify(panel),matrix=[1,0,0,0,4,5];invalid(()=>api.append(panel,0,xml('Bad'),matrix,{variantCount:1}));assert.equal(JSON.stringify(panel),before);assert.deepEqual(matrix,[1,0,0,0,4,5]);
});
test('unknown record fields and malformed variant indices are rejected',()=>{
  for(const map of [{0:[{...record(),extra:true}]},{0:[{svg:xml('A'),matrix:identity}]},{'01':[record()]},{'-1':[record()]},{1:[record()]},[]])invalid(()=>api.validate(map,{variantCount:1}));
  invalid(()=>api.append(base(),1,xml('A'),identity,{variantCount:1}));
});
test('prototype pollution, getters and inherited records cannot enter saved state',()=>{
  for(const map of [JSON.parse('{"__proto__":[]}'),JSON.parse('{"constructor":[]}'),Object.create({0:[record()]})])invalid(()=>api.validate(map,{variantCount:1}));
  const getter={};Object.defineProperty(getter,'0',{enumerable:true,get(){throw Error('Getter must not execute');}});invalid(()=>api.validate(getter,{variantCount:1}));
  const polluted=Object.create({});Object.assign(polluted,record());invalid(()=>api.validate({0:[polluted]},{variantCount:1}));
  const matrix=[1,0,0,1,0,0];Object.defineProperty(matrix,'0',{enumerable:true,get(){throw Error('Array getter must not execute');}});invalid(()=>api.validate({0:[record(xml('A'),1e9,matrix)]},{variantCount:1}));
  const records=[record()];Object.setPrototypeOf(records,{[Symbol.iterator](){throw Error('Custom array prototype must not execute');}});invalid(()=>api.validate({0:records},{variantCount:1}));
});
test('plain records from another JavaScript realm retain the same safe immutable behavior',()=>{
  const vm=require('node:vm'),panel=vm.runInNewContext('JSON.parse('+JSON.stringify(JSON.stringify(base()))+')');
  const result=api.append(panel,0,xml('Cross realm'),identity,{variantCount:1});assert.equal(result.panel.edits,panel.edits);assert.equal(api.validate(vm.runInNewContext('JSON.parse('+JSON.stringify(JSON.stringify(result.panel.insertedElements))+')'),{variantCount:1}),true);
});
test('key starts must use reserved integer slots and may never overlap other variants',()=>{
  for(const start of [0,1e9-1,1e9+.5,1e9+1,NaN,Infinity,1e9+300*100001])invalid(()=>api.validate({0:[record(xml('A'),start)]},{variantCount:1}));
  invalid(()=>api.validate({0:[record()],1:[record()]},{variantCount:2}));
});
test('transforms reject singular, unbounded, sparse, non-number and augmented arrays',()=>{
  for(const matrix of [[1,0,0,0,0,0],[1,0,0,1,Infinity,0],[1,0,0,1,1e13,0],['1',0,0,1,0,0],[1,0,0,1,0],Array(6),Object.assign([1,0,0,1,0,0],{extra:1})])invalid(()=>api.validate({0:[record(xml('A'),1e9,matrix)]},{variantCount:1}));
});
test('active, external, declared and malformed SVG content is rejected without a DOM',()=>{
  for(const svg of [xml('<script>alert(1)</script>'),xml('<foreignObject/>'),xml('<image href="https://example.com/a.png"/>'),xml('<text onclick="alert(1)">X</text>'),xml('<rect fill="url(https://example.com/a)"/>'),xml('<image href="&#106;avascript:alert(1)"/>'),'<!DOCTYPE svg [<!ENTITY a SYSTEM "file:///x">]>'+xml('&a;'),xml('A').replace('viewBox="0 0 80 30"','viewBox="1 0 80 30"'),xml('A').replace('</svg>','</g>'),xml('A')+xml('B'),xml('A').replace('http://www.w3.org/2000/svg','http://example.com/svg'),xml('A').replace('<text ','<text onload="x" '),xml('\u0000')])invalid(()=>api.validate({0:[record(svg)]},{variantCount:1}));
});
test('local definitions, scientific labels, comments, image filters and embedded pixels are retained',()=>{
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 80 30"><!-- measured label --><defs><clipPath id="clip"><rect width="30" height="20"/></clipPath><filter id="f"><feComponentTransfer in="SourceGraphic"><feFuncR type="linear" slope="1" intercept="0"/><feFuncG type="linear" slope="1" intercept="0"/><feFuncB type="linear" slope="1" intercept="0"/><feFuncA type="identity"/></feComponentTransfer></filter></defs><g clip-path="url('#clip')"><text font-family="&quot;Unknown Serif&quot;, Arial">A&amp;B β µm</text><image href="data:image/png;base64,iVBORw0KGgo=" filter="url(#f)"/></g></svg>`;
  assert.equal(api.validate({0:[record(svg)]},{variantCount:1}),true);assert.equal(api.sourceInfo(svg).nodes,13);
  assert.equal(api.validate({0:[record(xml('<![CDATA[A < B & C]]>'))]},{variantCount:1}),true);
});
test('limits count UTF-8 bytes, aggregate elements and records before any state change',()=>{
  const tooMany=Array.from({length:301},(_,i)=>record(xml('A'),1e9+i*100001));invalid(()=>api.validate({0:tooMany},{variantCount:1}));
  const nodes=xml('<path/>'.repeat(99998));invalid(()=>api.validate({0:[record(nodes)]},{variantCount:1}));
  const unicode=xml('中'.repeat(6666667));assert.ok(unicode.length<api.limits.maxBytes);invalid(()=>api.validate({0:[record(unicode)]},{variantCount:1}));
  const huge=xml('A'.repeat(10000000));invalid(()=>api.validate({0:[record(huge),record(huge,1e9+100001)]},{variantCount:1}));
});
test('300 small pastes keep immutable source references and remain serializable',()=>{
  let panel=base();const svg=xml('A');for(let i=0;i<300;i++)panel=api.append(panel,0,svg,identity,{variantCount:1}).panel;assert.equal(panel.insertedElements[0].length,300);assert.ok(panel.insertedElements[0].every(r=>r.svg===svg));invalid(()=>api.append(panel,0,svg,identity,{variantCount:1}));assert.equal(api.validate(JSON.parse(JSON.stringify(panel.insertedElements)),{variantCount:1}),true);
});
console.log(`${passed} element insertion state groups passed`);
