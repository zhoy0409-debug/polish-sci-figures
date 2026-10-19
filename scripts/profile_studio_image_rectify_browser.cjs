'use strict';
/* Private actual-browser CPU diagnosis. Sampling/trace overhead is deliberate:
 * these timings are not normal latency acceptance or detector accuracy evidence.
 * Uses the same ordinary UI/import/export/timing helpers as whole-app acceptance.
 * Never substitutes a result, modifies application source, or uploads an image. */
const H=require('./test_studio_carbon_helpers.cjs');
const Acceptance=require('./test_studio_image_rectify_browser.cjs');
const {fs,path,assert,ROOT,sha}=H;
const UI=Acceptance.acceptanceHelpers;
function json(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2),{flag:'wx'});return {file:path.basename(file),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))};}
function plain(p){for(let q=path.resolve(p);;q=path.dirname(q)){if(fs.existsSync(q))assert.ok(!fs.lstatSync(q).isSymbolicLink(),'Reparse path refused');if(q===path.dirname(q))break;}}
function metricValues(raw){return Object.fromEntries(raw.metrics.map(r=>[r.name,r.value]));}
function frame(node){const f=node.callFrame;return {functionName:f.functionName||'(anonymous)',url:f.url,line:f.lineNumber+1,column:f.columnNumber+1};}
function profileWeights(profile,start=profile.startTime,end=profile.endTime){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),own=new Map(),inclusive=new Map();
 for(const n of profile.nodes)for(const child of n.children||[])parents.set(child,n.id);
 assert.equal(profile.samples.length,profile.timeDeltas.length);
 let time=profile.startTime,total=0;
 const add=(map,id,weight)=>{const node=nodes.get(id);if(!node)return;const f=frame(node),key=JSON.stringify(f),entry=map.get(key)||{...f,weightUs:0,sampleCount:0};entry.weightUs+=weight;entry.sampleCount++;map.set(key,entry);};
 for(let i=0;i<profile.samples.length;i++){
  const previous=time;time+=profile.timeDeltas[i];const weight=Math.max(0,Math.min(time,end)-Math.max(previous,start));if(!weight)continue;total+=weight;const id=profile.samples[i];add(own,id,weight);const seen=new Set();let current=id;
  while(nodes.has(current)&&!seen.has(current)){seen.add(current);add(inclusive,current,weight);current=parents.get(current);}
 }
 const rows=map=>[...map.values()].sort((a,b)=>b.weightUs-a.weightUs).map(r=>({...r,weightedMs:r.weightUs/1000,fractionOfSampledWindow:total?r.weightUs/total:null}));
 return {weightedWindowMs:total/1000,profileSamples:profile.samples.length,profileNodes:profile.nodes.length,topSelf:rows(own).slice(0,40),topInclusive:rows(inclusive).filter(r=>r.functionName!=='(root)').slice(0,40),scope:'Raw timeDeltas-weighted sampled call frames. Inclusive parents overlap and must not be summed; sampled wall-time weights include native/program/idle intervals, not independent CPU-utilization measurements.'};
}
function traceSummary(trace){
 const events=trace.traceEvents;assert.ok(Array.isArray(events));const threads=events.filter(e=>e.ph==='M'&&e.name==='thread_name'&&e.args?.name==='CrRendererMain').map(e=>({pid:e.pid,tid:e.tid}));
 const main=new Set(threads.map(t=>t.pid+':'+t.tid)),complete=events.filter(e=>e.ph==='X'&&Number.isFinite(e.dur)&&main.has(e.pid+':'+e.tid));const groups=new Map();
 for(const e of complete){const row=groups.get(e.name)||{name:e.name,count:0,totalNestedDurationUs:0,maxDurationUs:0};row.count++;row.totalNestedDurationUs+=e.dur;row.maxDurationUs=Math.max(row.maxDurationUs,e.dur);groups.set(e.name,row);}
 const basic=e=>({name:e.name,ts:e.ts,dur:e.dur,pid:e.pid,tid:e.tid});
 return {mainThreads:threads,completeEvents:complete.length,byNestedDuration:[...groups.values()].sort((a,b)=>b.totalNestedDurationUs-a.totalNestedDurationUs).slice(0,60),longestMainEvents:complete.slice().sort((a,b)=>b.dur-a.dur).slice(0,40).map(basic),longestImageDecodeOrParseEventsAllThreads:events.filter(e=>e.ph==='X'&&Number.isFinite(e.dur)&&/decode|image|parse|svg/i.test(e.name)).sort((a,b)=>b.dur-a.dur).slice(0,50).map(basic),scope:'Complete main-thread trace events, plus explicitly separate image/decode/parse events on all threads. Durations can nest/overlap and are not additive percentages. Full original event arguments and stacks remain only in the private raw trace.'};
}
async function stopTrace(cdp,file){
 const done=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const result=await done;assert.ok(result.stream);const fd=fs.openSync(file,'wx');
 try{for(;;){const part=await cdp.send('IO.read',{handle:result.stream});fs.writeSync(fd,part.base64Encoded?Buffer.from(part.data,'base64'):Buffer.from(part.data));if(part.eof)break;}}finally{fs.closeSync(fd);await cdp.send('IO.close',{handle:result.stream});}
 return {file:path.basename(file),bytes:fs.statSync(file).size,sha256:sha(fs.readFileSync(file))};
}
async function capture(page,cdp,o,label,selector,action){
 await UI.armTiming(page,'rectify',selector,label);
 const before=await cdp.send('Performance.getMetrics');
 await cdp.send('Profiler.start');await cdp.send('Tracing.start',{categories:'devtools.timeline,v8.execute,blink.user_timing,toplevel,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream',options:'record-as-much-as-possible'});
 await action();await UI.ready(page);const timing=await UI.collectTiming(page);const stopped=await cdp.send('Profiler.stop');const after=await cdp.send('Performance.getMetrics');
 const rawProfile=json(path.join(o.out,label+'.cpuprofile'),stopped.profile),rawTrace=await stopTrace(cdp,path.join(o.out,label+'.trace.json'));
 const profile=stopped.profile,nav=metricValues(before).NavigationStart,weighted=profileWeights(profile),longTasks=[];
 assert.ok(Number.isFinite(nav),'CDP NavigationStart is needed for explicit long-task/profile clock alignment');
 for(const task of timing.longTasks){const start=nav*1e6+task.startTime*1000,end=start+task.duration*1000;longTasks.push({...task,cpuProfileWindowUs:{start,end},...profileWeights(profile,start,end)});}
 const metrics=json(path.join(o.out,label+'.metrics.json'),{before,after,delta:Object.fromEntries(Object.entries(metricValues(after)).map(([k,v])=>[k,v-(metricValues(before)[k]||0)])),clockAlignment:{navigationStartSeconds:nav,profileStartUs:profile.startTime,profileEndUs:profile.endTime,method:'CDP monotonic NavigationStart seconds plus PerformanceObserver relative milliseconds; CPU profile timestamps are microseconds.'}});
 const trace=JSON.parse(fs.readFileSync(path.join(o.out,rawTrace.file),'utf8'));
 const attribution=json(path.join(o.out,label+'.attribution.json'),{schema:'figure-studio-photo-cpu-attribution/1',label,rawProfile,rawTrace,metrics,timing,weighted,longTasks,traceSummary:traceSummary(trace),diagnosticOnly:true,samplingIntervalUs:100,traceAndSamplingOverhead:true});
 return {label,rawProfile,rawTrace,metrics,attribution,timing,topSelf:weighted.topSelf.slice(0,12),topInclusive:weighted.topInclusive.slice(0,15),longTaskWeightedWindows:longTasks.map(t=>({startTime:t.startTime,duration:t.duration,weightedWindowMs:t.weightedWindowMs,topSelf:t.topSelf.slice(0,6),topInclusive:t.topInclusive.slice(0,8)}))};
}
async function run(o){
 assert.ok(o.out.startsWith(path.join(ROOT,'.cache')+path.sep));plain(o.out);plain(o.source);plain(o.html);assert.equal(fs.existsSync(o.out),false);const source=fs.readFileSync(o.source);assert.equal(sha(source),o.sourceSha);assert.equal(sha(fs.readFileSync(o.html)),o.htmlSha);assert.equal(o.video,false,'CPU diagnosis has no recording overhead');
 fs.mkdirSync(o.out);fs.copyFileSync(__filename,path.join(o.out,'profiler-captured.cjs'));fs.copyFileSync(path.join(ROOT,'scripts/test_studio_image_rectify_browser.cjs'),path.join(o.out,'acceptance-helpers-captured.cjs'));
 const result={schema:'figure-studio-photo-cpu-diagnostic/1',passed:false,diagnosticOnly:true,privateLocalOnly:true,redistributionAllowed:false,source:{sha256:o.sourceSha,bytes:source.length},htmlSha256:o.htmlSha,harnessSha256:sha(fs.readFileSync(__filename)),acceptanceHelpersSha256:sha(fs.readFileSync(path.join(ROOT,'scripts/test_studio_image_rectify_browser.cjs'))),startedAtUTC:new Date().toISOString(),samplingIntervalUs:100,geometry:{viewport:{width:1440,height:1000},deviceScaleFactor:1},captures:[],externalRequests:[],pageErrors:[],scope:'Actual local-photo whole-app first/repeated Auto CPU diagnosis. CDP profiling and tracing add overhead; no normal latency, accuracy, native, or population performance acceptance claim.'};
 let browser,context,page;try{
  const {chromium}=require('playwright');browser=await chromium.launch({headless:true,...(o.browser?{executablePath:o.browser}:{})});result.browser=browser.version();context=await browser.newContext({...result.geometry});page=await context.newPage();page.setDefaultTimeout(30000);const origin=new URL(o.url).origin;
  await context.route('**/*',r=>{const u=new URL(r.request().url());if(/^https?:$/.test(u.protocol)&&u.origin!==origin){result.externalRequests.push(u.origin+u.pathname);return r.abort();}return r.continue();});page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('dialog',async d=>{result.unexpectedDialogs??=[];result.unexpectedDialogs.push({type:d.type(),message:d.message()});await d.dismiss();});
  const response=await context.request.get(o.url);assert.ok(response.ok());assert.equal(sha(await response.body()),o.htmlSha);await page.goto(o.url);await page.locator('#language').selectOption('en');await H.newProject(page,'LOCAL PRIVATE CPU diagnosis');
  await page.locator('#importFiles').click();await page.locator('#imageFile').setInputFiles({name:'LOCAL-PRIVATE-photo.jpg',mimeType:'image/jpeg',buffer:source});await page.waitForFunction(()=>document.querySelectorAll('#artboard image[data-key]').length===1);if(await page.locator('#importContentDialog[open]').count())await page.locator('#importContentDialog button').last().click();await page.locator('#zoom').selectOption('fit');
  const baseline=await UI.save(page,o.out,'private-original-project',{persist:true});result.priorOriginalExports=await UI.exportsAt(page,o,'private-original-export');result.priorWork='Exact acceptance helpers: ordinary JPEG import, saved original project, original SVG/PNG/TIFF exports with independent PNG/TIFF decoder check. Decoding may be warm before first correction open.';
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:100});
  result.captures.push(await capture(page,cdp,o,'first-auto','#imageTool-rectify',()=>UI.openRectify(page)));await page.screenshot({path:path.join(o.out,'private-first-auto.png')});
  result.captures.push(await capture(page,cdp,o,'repeat-auto','[data-rectify="auto"]',()=>page.locator('[data-rectify="auto"]').click()));await page.screenshot({path:path.join(o.out,'private-repeat-auto.png')});
  await page.locator('[data-rectify="cancel"]').click();const after=await UI.save(page,o.out,'private-after-cancel',{persist:true});assert.deepEqual(after.payload,baseline.payload);result.allFiveContainersCancelExact=true;result.sourceStillExact=sha(fs.readFileSync(o.source))===o.sourceSha;assert.equal(result.sourceStillExact,true);assert.deepEqual(result.externalRequests,[]);assert.deepEqual(result.pageErrors,[]);assert.deepEqual(result.unexpectedDialogs||[],[]);
  const final=await context.request.get(o.url);assert.ok(final.ok());assert.equal(sha(await final.body()),o.htmlSha);await cdp.detach();result.passed=true;
 }catch(error){result.failure=error.message;if(page)try{await page.screenshot({path:path.join(o.out,'private-failure.png')});}catch{}throw error;}finally{try{await context?.close();}finally{await browser?.close();}result.finishedAtUTC=new Date().toISOString();const receipt=json(path.join(o.out,'cpu-diagnostic-result.json'),result);console.log(JSON.stringify({passed:result.passed,out:o.out,receipt}));}
}
if(require.main===module)run(Acceptance.options(process.argv.slice(2))).catch(e=>{console.error(e.stack);process.exitCode=1;});
module.exports={profileWeights,traceSummary,run};
