'use strict';
const assert=require('node:assert/strict'),quality=require('../skills/polish-sci-figures/assets/figure-studio/figure-quality.js');
const target={panel:'panel-0',variant:0,key:'e1'},text=(id,x,sizePt=10)=>({id,kind:'text',target:{...target,key:'e'+id},text:'Measured text',sizePt,box:{x,y:10,width:30,height:12},color:'#999999'});
const manifest={paper:{x:0,y:0,width:180,height:120},items:[text('1',10,6),text('2',20),text('3',175)],panels:[{id:'panel-0',bound:false}]},result=quality.inspect(manifest);
assert.equal(result.issues.filter(i=>i.code==='small-text').length,1);
assert.equal(result.issues.filter(i=>i.code==='text-overlap').length,1);
assert.equal(result.issues.filter(i=>i.code==='outside-canvas').length,1);
assert.equal(result.issues.filter(i=>i.code==='text-contrast').length,0,'Unknown background must not become a fabricated contrast finding');
assert.equal(result.coverage.find(i=>i.check==='统计与数据设计').status,'unverifiable');
assert.throws(()=>quality.profile({minTextPt:NaN}));assert.throws(()=>quality.inspect({items:[]}));
const confirmed=quality.inspect({...manifest,items:[{...text('1',10),background:'#ffffff',opaque:true}],panels:[{id:'panel-0',bound:true,analysis:{primary_estimand:{ci95:[2,1]}}}]});
assert(confirmed.issues.some(i=>i.code==='text-contrast'));assert(confirmed.issues.some(i=>i.code==='invalid-interval'));
assert.equal(quality.contrast('#000000','#ffffff'),21);assert.equal(quality.contrast('unknown','#fff'),null);
const crowded=quality.inspect({...manifest,items:Array.from({length:5000},(_,i)=>text(String(i),10))});assert.equal(crowded.summary.overlapComplete,false,'Saturation must be visible, never a false complete result');
console.log('PASS final-size rules, missing scientific evidence, interval validation, known-background contrast and bounded overlap coverage');

assert(quality.inspect({...manifest,items:[],panels:[{id:'panel-0',bound:true,analysis:{primary_estimand:{ci95:{0:1,1:2,length:2}}}}]}).issues.some(i=>i.code==='invalid-interval'),'Malformed structured interval must be reported without crashing');
