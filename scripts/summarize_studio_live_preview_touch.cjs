/* Aggregate only explicitly executed touch-emulation conditions. Original raw
 * reports and failures remain untouched. No profile, endpoint or token output. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const FIELDS=['language','theme','status','currentVersion','servedHtmlSha256','localSourceProof','borderEntry','saveDraftCommittedOnly','actualTargetReachable','actualRasterDisplay','previewSizeFloor','mobileLayout','inputEvents','media','thirtyDraftInputs','cancelExact','singleCommitUndoRedo','originalImageHrefSha256'];
function main(a){
 assert.ok(a.inputs&&a.out&&a.kind&&a.label,'Explicit inputs/out/kind/label required');
 assert.ok(!fs.existsSync(a.out),'Never replace prior evidence');
 const reports=a.inputs.split(',').map(dir=>{const file=path.join(dir,'touch-acceptance.json'),bytes=fs.readFileSync(file);return{data:JSON.parse(bytes),rawReportSha256:sha(bytes)};});
 const report={schema:'figure-studio-touch-emulation-summary/2',label:a.label,kind:a.kind,status:'SCOPED_ACCEPTANCE_PASS',generatedAt:new Date().toISOString(),browser:reports[0].data.browser,harnessSha256:reports[0].data.harnessSha256,servedHtmlSha256:reports[0].data.htmlSha256,attempts:[],cases:[],scope:'Actual Chrome emulated touch on public H&E artwork. Two viewport sizes, two languages and two themes; fixed DPR 1. This is browser emulation, with automated field entry, and is separate from physical touchscreen, native keyboard/IME, Windows system scaling and novice-user studies.',limitations:['The raster-content floor and header/navigation geometry are engineering usability checks; screenshots require visual review.','The original image href is unchanged. This does not assess microscopy image interpretation or independent detection accuracy.','Installed identity requires the separate original Setup, file-manifest and protected-process proof. A source runtime is not an installed executable.']};
 const seen=new Set();
 for(const source of reports){
  const d=source.data;assert.equal(d.kind,a.kind);assert.equal(d.browser,report.browser);assert.equal(d.harnessSha256,report.harnessSha256);assert.equal(d.htmlSha256,report.servedHtmlSha256);assert.equal(d.conditions.deviceScaleFactor,1);assert.equal(d.conditions.hasTouch,true);assert.equal(d.conditions.isMobile,false);assert.equal(d.conditions.reducedMotion,'reduce');assert.equal(d.conditions.video,false);
  report.attempts.push({label:d.label,status:d.status,rawReportSha256:source.rawReportSha256,conditions:d.conditions,browserMode:d.browserMode,startedAt:d.startedAt,finishedAt:d.finishedAt});
  for(const c of d.cases){
   const key=[d.conditions.viewport.width,d.conditions.viewport.height,c.language,c.theme].join('/');assert.ok(!seen.has(key),'Do not merge repeated conditions or select the latest result silently');seen.add(key);
   const item={viewport:d.conditions.viewport,browserMode:d.browserMode,captureLabel:d.label,remoteRequestCount:c.remoteRequests.length,pageErrorCount:c.pageErrors.length};
   for(const field of FIELDS)if(c[field]!==undefined)item[field]=c[field];
   assert.equal(c.servedHtmlSha256,report.servedHtmlSha256);assert.equal(c.remoteRequests.length,0);assert.equal(c.pageErrors.length,0);
   if(c.status==='PASS'){
    assert.ok(c.localSourceProof?.byteExactOutsideDocumentedInjection,'Require exact injection-aware local HTML proof');
    for(const field of ['saveDraftCommittedOnly','thirtyDraftInputs','cancelExact','singleCommitUndoRedo'])assert.equal(c[field],true,field);
    assert.ok(c.actualTargetReachable.inViewport&&c.actualTargetReachable.artboardHit);
    assert.ok(c.actualRasterDisplay.contentWidthCssPx>=160&&c.actualRasterDisplay.contentHeightCssPx>=90,'Require actual decoded image-content floor');
    assert.deepEqual(c.mobileLayout.overlaps,[]);assert.ok(c.mobileLayout.workflowButtons.every(button=>button.textInside));
    if(d.conditions.viewport.width<=480)assert.ok(c.mobileLayout.headerHeightCssPx<=140);
   }else{report.status='SCOPED_ACCEPTANCE_HAS_FAILURES';item.failure='Original attempt retained; no unexecuted assertion is inferred to pass.';}
   report.cases.push(item);
  }
 }
 const expected=Number(a['expected-cases']||8);assert.equal(report.cases.length,expected,'Explicit full condition count required');
 const expectedKeys=[];for(const [w,h]of [[390,844],[1280,720]])for(const lang of ['en','zh-CN'])for(const theme of ['carbon','pearl'])expectedKeys.push([w,h,lang,theme].join('/'));
 if(expected===8)assert.deepEqual([...seen].sort(),expectedKeys.sort());
 report.caseCount=report.cases.length;report.passedCases=report.cases.filter(c=>c.status==='PASS').length;report.failedCases=report.caseCount-report.passedCases;
 const json=JSON.stringify(report,null,2);assert.ok(!/[A-Z]:[\\/]|X-Studio-Token|"token"\s*:|"nonce"\s*:|127\.0\.0\.1:\d+/i.test(json),'Forbidden private path/credential pattern');fs.mkdirSync(path.dirname(a.out),{recursive:true});fs.writeFileSync(a.out,json+'\n');console.log(JSON.stringify({status:report.status,cases:report.caseCount,rawReports:report.attempts.length}));return report;
}
if(require.main===module){const a=Object.fromEntries(process.argv.slice(2).map(v=>{const i=v.indexOf('=');assert.ok(v.startsWith('--')&&i>2);return[v.slice(2,i),v.slice(i+1)];}));main(a);}
module.exports={main,FIELDS};
