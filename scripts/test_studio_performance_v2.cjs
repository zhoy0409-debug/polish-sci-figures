/* Pure protocol tests: no browser, timing claims, or private fixtures. */
'use strict';
const assert=require('node:assert/strict'),B=require('./benchmark_studio_carbon_browser_v2.cjs'),C=require('./compare_studio_performance_v2.cjs');
let count=0;function test(name,body){body();count++;console.log('PASS '+name);}
const copy=value=>JSON.parse(JSON.stringify(value));
test('selection and explicit tab events must match the actual target',()=>{
 const hit={type:'pointerdown',key:'e2'},wrong={type:'pointerdown',key:'e1'};assert.equal(B.primary({name:'select-text',targetKey:'e2',inputs:[wrong,hit]}),hit);
 const to={type:'click',tab:'palette'},from={type:'click',tab:'detail'};assert.equal(B.primary({name:'tab-detail-to-palette',toTab:'palette',inputs:[from,to]}),to);
});
test('a below-threshold drag move cannot become the primary feedback event',()=>{
 const down={type:'pointerdown',x:0,y:0,at:0},small={type:'pointermove',x:2,y:0,at:1},drag={type:'pointermove',x:12,y:3,at:2};assert.equal(B.primary({name:'drag-shape',inputs:[down,small,drag]}),drag);assert.equal(B.primary({name:'drag-shape',inputs:[down,small]}),undefined);
});
function operation(iteration,latency,warmup=false){const at=iteration*1000;return{name:'select-text',iteration,warmup,targetKey:'e1',verified:true,start:at,end:at+1000,inputs:[{type:'pointerdown',key:'e1',at,nextRaf:at+latency,secondRaf:at+latency+16}],frames:[],longTasks:[]};}
test('fixed 20 samples use nearest-rank P95 and preserve the maximum',()=>{
 const data=[operation(0,900,true),...Array.from({length:20},(_,i)=>operation(i+1,i+1))],s=B.summarize(data,['select-text'])['select-text'];assert.equal(s.samples,20);assert.equal(s.inputToNextRafMs.p50,10);assert.equal(s.inputToNextRafMs.p95,19);assert.equal(data.at(-1).inputs[0].nextRaf-data.at(-1).inputs[0].at,20);assert.deepEqual(s.commitToSecondRafMs,{p50:null,p95:null});
});
function run(latency){return{summarySha256:'summary-fixture',rawSha256:'raw-fixture',summary:{schema:'figure-studio-interaction-benchmark/2',protocol:{samplesPerOperation:20,warmupIterations:3,settleMinimumMs:250,operationOrder:['select-text','text-colour']},measurement:'presentation opportunity, not pixel latency',browser:'TEST-ONLY Chrome',browserMode:'headful',recording:{enabled:false},platform:'win32',architecture:'x64',logicalCpus:4,node:'test',label:'synthetic protocol fixture',fixtures:[{elements:5000,kind:'synthetic_pressure_only',svgSha256:'same-engineering-svg',viewport:{width:1440,height:900},deviceScaleFactor:1,geometry:[],summary:Object.fromEntries(['select-text','text-colour'].map(name=>[name,{samples:20,verifiedOperations:20,...Object.fromEntries(C.METRICS.map(metric=>[metric,metric==='commitToSecondRafMs'?{p50:null,p95:null}:{p50:latency,p95:latency+1}])),frames:{count:0},longTasks:{count:0}}]))}]}};}
test('three-way descriptive comparison retains all metrics and both baselines',()=>{
 const report=C.compare({baseline20:run(100),baseline21:run(120),candidate:run(80)});assert.equal(report.status,'COMPLETE_PROTOCOL_MATCHED');const op=report.fixtures[0].operations['select-text'];assert.deepEqual(Object.keys(op.changes.baseline20),C.METRICS);assert.equal(op.changes.baseline20.inputToNextRafMs.p50.deltaMs,-20);assert.equal(op.changes.baseline21.inputToNextRafMs.p50.deltaMs,-40);assert.equal(report.core5000Facts.baseline20.selectAndColourNextRafP50AndP95AllImproved,true);assert.equal(op.changes.baseline20.commitToSecondRafMs.p95.improved,null);assert.match(report.interpretation,/not statistical significance/);
 const equal=C.compare({baseline20:run(100),baseline21:run(100),candidate:run(100)});assert.equal(equal.core5000Facts.baseline20.selectAndColourNextRafP50AndP95AllImproved,false);
});
test('mismatched protocol, browser, fixture, viewport, or DPR is rejected',()=>{
 for(const mutate of [r=>r.summary.protocol.warmupIterations++,r=>r.summary.protocol.samplesPerOperation++,r=>r.summary.protocol.settleMinimumMs++,r=>r.summary.protocol.operationOrder.reverse(),r=>r.summary.browser='different',r=>r.summary.recording.enabled=true,r=>r.summary.fixtures[0].svgSha256='different',r=>r.summary.fixtures[0].viewport.width++,r=>r.summary.fixtures[0].deviceScaleFactor=1.25]){const candidate=copy(run(80));mutate(candidate);assert.throws(()=>C.compare({baseline20:run(100),baseline21:run(120),candidate}));}
});
console.log('PASS '+count+' v2 protocol regression groups');
