'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const file=path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.js');
const source=fs.readFileSync(file,'utf8'),{statisticsDataProfile:profile,statisticsMethodChoices:choices,History}=require(file);
const rows=[['sample_id','condition','Response'],['p1','Control','1.2'],['p2','Control','2.1'],['p3','Treated','3.2'],['p4','Treated','4.2']];
assert.equal(profile(rows).value,'Response');assert.equal(profile(rows).group,'condition');assert.equal(profile(rows).unit,'sample_id');assert.equal(profile(rows).kind,'continuous');
assert.equal(profile([['group','value'],['A','0'],['B','1']]).kind,'binary');
assert.equal(profile([['group','value'],['A','1'],['B','5']]).kind,'','integers do not identify scientific outcome type');
assert.equal(profile([['group','value'],['A','1.2'],['B','']]).validNumeric,false,'missing cells must be checked, never silently excluded');
assert.equal(profile([['group','value'],['A','yes'],['B','no']]).kind,'categorical');
assert.equal(profile([['group','a','b'],['A','1','2'],['B','3','4']]).value,'','ambiguous numeric columns require a choice');
assert.deepEqual(choices('independent','mean','continuous'),['welch','mannwhitney']);
assert.deepEqual(choices('independent','distribution','continuous'),['mannwhitney','welch']);
assert.deepEqual(choices('paired','mean','continuous'),['paired_t','wilcoxon']);
assert.deepEqual(choices('independent','mean','ordinal'),['mannwhitney']);
for(const kind of ['binary','count','survival','categorical'])assert.deepEqual(choices('independent','mean',kind),[]);
assert.deepEqual(choices('paired','mean','ordinal'),[],'paired ranks are not automatically interval-scale differences');
assert.deepEqual(choices('','mean','continuous'),[],'never infer a study design from values');
const copy=x=>JSON.parse(JSON.stringify(x)),base={order:['panel-0'],panels:{'panel-0':{variant:0,edits:{}}}},history=new History(base),asset={table:{rows,sha256:'figure-data'},recipe:{family:'independent'}},nodes={},requests=[];
const node=id=>nodes[id]??={value:id==='statisticsPreviewStyle'?'p':'',disabled:false,hidden:false,textContent:'',options:[]};
const ctx={console,copy,statisticsSession:{id:'panel-0',projectId:'project',source:asset,serial:1},statisticsRequest:0,statisticsReadyReason:()=>'',statisticsConfig:()=>({method:ctx.method,mode:'raw'}),method:'welch',statisticsRows:()=>rows,localEngine:{token:'test'},dataSerial:1,project:{id:'project'},selectedPanel:'panel-0',state:()=>history.current,panel:()=>asset,$:node,T:x=>x,StudioI18n:{language:'en'},statisticsControls:()=>{},statisticsResultSummary:()=>{},clearStatisticalResultEdits:()=>{},statisticalComparisons:()=>({letters:true}),renderStatisticsPreview:()=>{ctx.previews++;},previews:0,engineFetch:()=>new Promise(resolve=>requests.push(resolve)),commit:next=>{history.commit(next);return true;},statisticsInvalidate:()=>{ctx.statisticsSession.pending=null;},dataDrafts:{}};
node('statisticsSource').value='current';node('statisticsDialog').close=()=>{ctx.closed=true;};
ctx.transferStatisticalStyleEdits=()=>{}; // Actual SVG-key transfer is covered by test_studio_statistical_line_editing.cjs.
vm.createContext(ctx);
function load(start,end){vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),ctx);}
load('  function statisticsSessionValid(', '  function statisticsPreviewState(');
load('  function statisticsPreviewState(', '  function renderStatisticsPreview(');
load('  async function runStatisticsPreview(', "  $('closeStatistics').onclick");
vm.runInContext(source.split('\n').find(line=>line.startsWith("  $('applyStatistics').onclick=")),ctx);
const result=method=>({ok:true,json:async()=>({config:{method,mode:'raw'},data_sha256:'actual-rows',analysis:{method,primary_test:{pairwise:[{a:0,b:1,p:.04}]},group_order:['Control','Treated']}})});
(async()=>{
 const first=ctx.runStatisticsPreview();ctx.method='mannwhitney';const second=ctx.runStatisticsPreview();
 requests[1](result('mannwhitney'));await second;assert.equal(ctx.statisticsSession.pending.record.analysis.method,'mannwhitney');assert.equal(ctx.previews,1);
 requests[0](result('welch'));await first;assert.equal(ctx.statisticsSession.pending.record.analysis.method,'mannwhitney','late responses cannot replace the selected method');assert.equal(ctx.previews,1);assert.deepEqual(history.current,base,'preview has no effect on undo history or current figure');
 node('statisticsPreviewStyle').value='stars';node('applyStatistics').onclick();assert.equal(history.current.panels['panel-0'].annotationStyle,'stars');assert.equal(history.current.panels['panel-0'].statistics.analysis.method,'mannwhitney');history.undo();assert.deepEqual(history.current,base,'one undo restores the complete pre-analysis figure');history.redo();
 const third=ctx.runStatisticsPreview();ctx.dataSerial++;requests[2](result('mannwhitney'));await third;assert.equal(ctx.statisticsSession.pending,null,'changed figure data invalidates an in-flight result');assert.equal(node('applyStatistics').disabled,true);assert.match(node('statisticsRunStatus').textContent,/已变化/);
 console.log('Novice statistics: column inference, outcome/design gates, ranked choices, real preview staging, stale-response isolation, apply and single undo passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
