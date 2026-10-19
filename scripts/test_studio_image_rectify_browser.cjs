/* Whole-app, controlled headless Chromium acceptance for local photo correction.
 * Explicit local source/quad; actual production automatic suggestions are checked
 * for lifecycle and display behavior, never treated as independent accuracy truth.
 * Outputs can contain private photos and derivatives:
 * keep the entire fresh .cache output private; never distribute it as public QA.
 * No production hooks, source/result substitution, network fixtures or native app.
 */
'use strict';
const H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert,ROOT,sha}=H;
const {parseArgs,isDeepStrictEqual}=require('node:util');
const {execFileSync}=require('node:child_process');

function options(argv){
 const {values:a}=parseArgs({args:argv,options:Object.fromEntries(['url','out','source','source-sha256','quad','html','expected-html-sha256','python','browser','width','label','video','expect-worker'].map(k=>[k,{type:'string'}])),strict:true});
 for(const k of ['url','out','source','source-sha256','quad','html','expected-html-sha256','python'])assert.ok(a[k],'Explicit --'+k+' is required');
 assert.match(a['source-sha256'],/^[a-f0-9]{64}$/);assert.match(a['expected-html-sha256'],/^[a-f0-9]{64}$/);
 const quad=JSON.parse(a.quad);assert.ok(Array.isArray(quad)&&quad.length===4&&quad.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)),'Four explicit original-pixel TL/TR/BR/BL corners required');
 const width=Number(a.width||1024);assert.ok(Number.isInteger(width)&&width>=128&&width<=4096);
 for(const flag of ['video','expect-worker'])assert.ok(a[flag]===undefined||['true','false'].includes(a[flag]));return {url:H.localUrl(a.url),out:path.resolve(a.out),source:path.resolve(a.source),sourceSha:a['source-sha256'],quad:quad.map(([x,y])=>({x,y})),html:path.resolve(a.html),htmlSha:a['expected-html-sha256'],python:path.resolve(a.python),browser:a.browser?path.resolve(a.browser):null,width,video:a.video!=='false',expectWorker:a['expect-worker']==='true',label:a.label||'private-local-photo-correction'};
}
function plain(value,{cache=false}={}){
 const p=path.resolve(value),boundary=cache?path.join(ROOT,'.cache'):path.parse(p).root;
 if(cache)assert.ok(p.startsWith(boundary+path.sep),'Private evidence must be under this repository .cache');
 for(let q=p;;q=path.dirname(q)){
  if(fs.existsSync(q))assert.ok(!fs.lstatSync(q).isSymbolicLink(),'Reparse/symbolic-link path refused');
  if(q===boundary||q===path.dirname(q))break;
 }
 return p;
}
function active(p){return p.state.order.map(id=>p.project.panels.find(v=>v.id===id));}
function fiveHashes(p){return Object.fromEntries(['project','state','history','checkpoints','dataDrafts'].map(k=>[k,sha(JSON.stringify(p[k]))]));}
function hrefFromSvg(svg){const m=svg.match(/(?:href|xlink:href)=["'](data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+)["']/);assert.ok(m,'Actual embedded bitmap required');return m[1];}
function bitmapHash(href){const m=href.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);assert.ok(m);return sha(Buffer.from(m[2],'base64'));}
function unchanged(actual,expected){assert.deepEqual(actual,expected,'Draft/cancellation must preserve all five saved containers and source resources');}
async function frames(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function save(page,out,label,{persist=false}={}){
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#save').click()]);
 const bytes=fs.readFileSync(await download.path()),payload=JSON.parse(bytes),file=path.join(out,label+'.json');
 if(persist)fs.writeFileSync(file,bytes,{flag:'wx'});
 return {payload,bytes,sha256:sha(bytes),file:persist?file:null,containers:fiveHashes(payload)};
}
async function setTheme(page,theme){await page.locator('#appearanceMenu summary').click();await page.locator('#studioTheme').selectOption(theme);await page.locator('#appearanceMenu summary').click();assert.equal(await page.locator('html').getAttribute('data-theme'),theme);}
async function exportsAt(page,o,label){
 const values={};if(!await page.locator('#tiff').isVisible())await page.locator('#exportMenu summary').click();
 await page.locator('#tiff').click();await page.locator('#imageExportDialog').waitFor({state:'visible'});
 await page.locator('#imageExportWidth').fill('25.4');await page.locator('#imageExportDpi').selectOption('600');
 for(const [format,suffix] of [['svg','svg'],['png','png'],['tif','tif']]){
  await page.locator('#imageExportFormat').selectOption(format);await page.waitForFunction(()=>!document.getElementById('downloadImageExport').disabled);
  const [d]=await Promise.all([page.waitForEvent('download'),page.locator('#downloadImageExport').click()]);
  const bytes=fs.readFileSync(await d.path()),file=path.join(o.out,label+'.'+suffix);fs.writeFileSync(file,bytes,{flag:'wx'});
  values[format]={file:path.basename(file),bytes:bytes.length,sha256:sha(bytes)};
  if(format==='svg'){
   values.svg.canonicalSha256=sha(H.canonicalSvg(bytes));
   assert.ok(!/data-rectify-handle|data-preview-kind|imageRectify-originalSvg/.test(bytes.toString()),'Editor corner handles/draft markers must never enter SVG export');
   values.svg.metadata=await page.evaluate(xml=>{const d=new DOMParser().parseFromString(xml,'image/svg+xml');if(d.querySelector('parsererror'))throw Error('Exported SVG is not valid XML');return JSON.parse(d.querySelector('metadata')?.textContent||'{}');},bytes.toString());
  }
 }
 await page.locator('#closeImageExport').click();if(await page.locator('#exportMenu').evaluate(n=>n.open))await page.locator('#exportMenu summary').click();
 values.pixels=JSON.parse(execFileSync(o.python,[path.join(ROOT,'scripts/inspect_studio_export_pixels.py'),path.join(o.out,label+'.png'),path.join(o.out,label+'.tif')],{encoding:'utf8',windowsHide:true}));
 for(const k of ['width','height','rgbaSha256'])assert.equal(values.pixels[0][k],values.pixels[1][k],'PNG/TIFF independent decoded '+k+' must agree');
 assert.ok(values.pixels[1].dpi.every(v=>Math.abs(v-600)<.001));
 return values;
}
function sameExport(a,b){assert.equal(a.svg.canonicalSha256,b.svg.canonicalSha256);for(let i=0;i<2;i++)for(const k of ['width','height','rgbaSha256'])assert.equal(a.pixels[i][k],b.pixels[i][k]);}
async function openRectify(page,entry='workflow'){
 await page.locator('#artboard image[data-key]').first().click();
 if(entry==='quick'){await page.locator('#quickImageRectify').click();}
 else {if(!await page.locator('#imageTool-rectify').isVisible())await page.locator('[data-workflow="images"]').click();await page.locator('#imageTool-rectify').click();}
 await page.locator('#imageRectifyDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#imageRectifyDialog').evaluate(n=>n.tagName),'SECTION');
 assert.equal(await page.locator('dialog[open]:modal').count(),0,'Correction is a nonmodal dock on the actual canvas');
}
async function openColor(page){
 await page.locator('#artboard image[data-key]').first().click();
 if(!await page.locator('#imageTool-color').isVisible())await page.locator('[data-workflow="images"]').click();
 await page.locator('#imageTool-color').click();await page.locator('#imageColorDialog').waitFor({state:'visible'});
}
async function corners(page,quad,width){
 for(let i=0;i<4;i++)for(const axis of ['x','y'])await page.locator('[data-rectify-coordinate="'+i+'-'+axis+'"]').fill(String(quad[i][axis]));
 await page.locator('[data-rectify="ratio"]').selectOption('estimate');await page.locator('[data-rectify="width"]').fill(String(width));
 await page.locator('[data-rectify="preview"]').click();
}
async function ready(page){
 await page.waitForFunction(()=>document.getElementById('imageRectifyDialog')?.dataset.state==='previewing'&&!document.querySelector('[data-rectify="apply"]').disabled,{},{timeout:60000});
 await page.locator('#artboard>svg[data-preview-kind="image-rectify"]').waitFor({state:'visible'});
}
async function readCorners(page){return page.locator('#imageRectifyDialog').evaluate(n=>Array.from({length:4},(_,i)=>Object.fromEntries(['x','y'].map(axis=>[axis,Number(n.querySelector('[data-rectify-coordinate="'+i+'-'+axis+'"]').value)]))));}
async function drawSourceRuler(page,points){
 await page.locator('[data-rectify="rulerTarget"]').selectOption('horizontal');if(await page.locator('[data-rectify="ruler"]').getAttribute('aria-pressed')!=='true')await page.locator('[data-rectify="ruler"]').click();
 const svg=page.locator('#imageRectify-originalSvg');await svg.scrollIntoViewIfNeeded();
 const screen=await svg.evaluate((n,ps)=>{const m=n.getScreenCTM();if(!m)throw Error('Source SVG screen transform missing');return ps.map(p=>({x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f}));},points);
 for(const p of screen)assert.ok(p.x>0&&p.y>0&&p.x<1440&&p.y<1000,'The actual source-line gesture must be within the visible browser viewport');
 await page.mouse.move(screen[0].x,screen[0].y);await page.mouse.down();await page.mouse.move(screen[1].x,screen[1].y,{steps:12});await page.mouse.up();await ready(page);
 const actual=await page.locator('#imageRectifyDialog').evaluate(n=>Array.from({length:2},(_,i)=>Object.fromEntries(['x','y'].map(axis=>[axis,Number(n.querySelector('[data-rectify-ruler-coordinate="'+i+'-'+axis+'"]').value)]))));
 for(let i=0;i<2;i++)for(const k of ['x','y'])assert.ok(Math.abs(actual[i][k]-points[i][k])<=2,'Real pointer mapping must retain the explicitly chosen source-pixel endpoints within display/input rounding');
 return actual;
}
// Read-only, action-scoped timing observers. These never replace application APIs,
// defer a result, change the decoder, or add work to a production progress source.
async function armTiming(page,kind,selector,label){
 await page.evaluate(({kind,selector,label})=>{
  if(window.__photoQaTiming)throw Error('Previous QA timing observer not collected');
  const record={label,kind,selector,units:'milliseconds, performance.now clock',armedAt:performance.now(),input:null,states:[],longTasks:[],mainCanvasMutationAt:null,observedReadyAt:null,secondAnimationFrameAt:null,stillReadyAtSecondFrame:false};
  const visible=n=>!!n&&!n.hidden&&getComputedStyle(n).display!=='none';
  const isReady=()=>kind==='rectify'?visible(document.getElementById('imageRectifyDialog'))&&document.getElementById('imageRectifyDialog').dataset.state==='previewing'&&!document.querySelector('[data-rectify="apply"]').disabled:visible(document.getElementById('imageColorDialog'))&&visible(document.querySelector('[data-color="autoNote"]'))&&!!document.querySelector('[data-color="autoNote"]').textContent.trim()&&!document.querySelector('[data-color="auto"]').disabled&&!!document.querySelector('#artboard image[data-studio-image-color]');
  let previous='',queued=false;
  const scan=(canvasChanged=false)=>{
   if(!record.input)return;
   const state=kind==='rectify'?document.getElementById('imageRectifyDialog')?.dataset.state||'absent':(document.querySelector('[data-color="auto"]')?.disabled?'busy':'idle')+'|note:'+!!document.querySelector('[data-color="autoNote"]')?.textContent.trim()+'|canvas:'+!!document.querySelector('#artboard image[data-studio-image-color]');
   if(state!==previous){record.states.push({at:performance.now(),state});previous=state;}
   // In color UI an earlier/default preview may exist while analysis runs.
   // Require a new actual artboard mutation in this ready observation rather
   // than timing the note/controls against a stale earlier canvas candidate.
   if(isReady()&&canvasChanged&&!queued){queued=true;record.observedReadyAt=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>{record.secondAnimationFrameAt=performance.now();record.stillReadyAtSecondFrame=isReady();}));}
  };
  const input=event=>{if(!record.input&&event.target.closest(selector)){record.input={type:event.type,at:performance.now(),isTrusted:event.isTrusted};}};
  document.addEventListener('pointerdown',input,true);
  const mutation=new MutationObserver(records=>{const canvasChanged=!!record.input&&records.some(m=>(m.target.nodeType===1?m.target:m.target.parentElement)?.closest('#artboard'));if(canvasChanged)record.mainCanvasMutationAt=performance.now();scan(canvasChanged);});mutation.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});
  let tasks=null;try{tasks=new PerformanceObserver(list=>{for(const e of list.getEntries())if(record.input&&e.startTime+e.duration>=record.input.at)record.longTasks.push({startTime:e.startTime,duration:e.duration,name:e.name});});tasks.observe({type:'longtask'});}catch{}
  record.longTaskObserverSupported=!!tasks;
  window.__photoQaTiming={record,stop(){scan();record.collectorStoppedAt=performance.now();document.removeEventListener('pointerdown',input,true);mutation.disconnect();if(tasks){for(const e of tasks.takeRecords())if(record.input&&e.startTime+e.duration>=record.input.at)record.longTasks.push({startTime:e.startTime,duration:e.duration,name:e.name});tasks.disconnect();}delete window.__photoQaTiming;return record;}};
 },{kind,selector,label});
}
async function collectTiming(page){
 await page.waitForFunction(()=>window.__photoQaTiming?.record.secondAnimationFrameAt!==null,{},{timeout:90000});
 const value=await page.evaluate(()=>window.__photoQaTiming.stop());
 assert.equal(value.input?.type,'pointerdown');assert.equal(value.input.isTrusted,true);assert.equal(value.stillReadyAtSecondFrame,true);assert.ok(value.observedReadyAt>=value.input.at&&value.secondAnimationFrameAt>=value.observedReadyAt);
 value.inputToObservedReadyMs=value.observedReadyAt-value.input.at;value.inputToSecondAnimationFrameMs=value.secondAnimationFrameAt-value.input.at;
 value.scope='Single local-photo UI observation after ordinary file import; includes actual decoding, analysis and preview work reached by the action. Not cold-start, detector accuracy, FPS, percentile, native or population performance evidence.';return value;
}
async function colorReady(page){await page.waitForFunction(()=>{const d=document.getElementById('imageColorDialog'),n=document.querySelector('[data-color="autoNote"]'),b=document.querySelector('[data-color="auto"]');return d&&!d.hidden&&n&&!n.hidden&&n.textContent.trim()&&b&&!b.disabled&&document.querySelector('#artboard image[data-studio-image-color]');},{},{timeout:90000});await frames(page);}
async function currentCanvas(page){
 const result=await page.locator('#artboard>svg').evaluate(svg=>{const r=svg.getBoundingClientRect(),v=document.getElementById('viewport').getBoundingClientRect(),left=Math.max(0,r.left,v.left),right=Math.min(innerWidth,r.right,v.right),top=Math.max(0,r.top,v.top),bottom=Math.min(innerHeight,r.bottom,v.bottom),x=(left+right)/2,y=(top+bottom)/2;return {widthCssPx:right-left,heightCssPx:bottom-top,hitArtboard:!!document.elementFromPoint(x,y)?.closest('#artboard'),kind:svg.dataset.previewKind||null,href:svg.querySelector('image')?.getAttribute('href'),markup:svg.outerHTML};});
 assert.ok(result.widthCssPx>100&&result.heightCssPx>90&&result.hitArtboard,'Actual canvas candidate must remain visibly reachable');
 result.hrefSha256=bitmapHash(result.href);result.markupSha256=sha(result.markup);delete result.href;delete result.markup;return result;
}
async function actualDisplayColor(page){
 return page.locator('#artboard image[data-key]').first().evaluate(n=>{const raw=n.getAttribute('data-studio-image-color'),filter=n.getAttribute('filter'),id=filter?.match(/^url\(#([A-Za-z_][\w.:-]*)\)$/)?.[1],definition=id?[...document.querySelectorAll('#artboard filter')].find(f=>f.id===id):null;return {key:n.getAttribute('data-key'),parameters:raw?JSON.parse(raw):null,filterApplied:!!definition?.querySelector('feComponentTransfer'),href:n.getAttribute('href')};}).then(value=>{value.encodedBitmapSha256=bitmapHash(value.href);delete value.href;return value;});
}

async function run(o){
 plain(o.out,{cache:true});plain(o.source);plain(o.html);assert.ok(!fs.existsSync(o.out),'Never overwrite private acceptance evidence');
 const source=fs.readFileSync(o.source);assert.equal(sha(source),o.sourceSha,'Explicit source bytes must match');assert.equal(source.readUInt16BE(0),0xffd8,'This acceptance imports an actual JPEG through the JPEG file UI');assert.equal(sha(fs.readFileSync(o.html)),o.htmlSha);const sourcePrefix=source.toString('base64').slice(0,256);
 fs.mkdirSync(o.out);fs.copyFileSync(__filename,path.join(o.out,'harness-captured.cjs'));
 const report={schema:'figure-studio-image-rectify-browser/2',kind:'actual-whole-app-controlled-headless-browser',privateLocalOnly:true,redistributionAllowed:false,containsPrivatePhotoDerivatives:true,passed:false,label:o.label,harnessSha256:sha(fs.readFileSync(__filename)),startedAtUTC:new Date().toISOString(),source:{sha256:o.sourceSha,bytes:source.length},manualOriginalPixelCorners:o.quad,quadIsAlgorithmGroundTruth:false,requestedWidth:o.width,cases:[],pageErrors:[],externalRequests:[],requests:[],sourcePayloadLeak:false,scope:'Actual local automatic suggestions, manual photo geometry/display, editor transactions, integrity rejection and export regression. Manual corners and automatic candidates are not detector truth, calibrated reconstruction, band quantification, colorimetric calibration, new scientific validity, IME or native Windows acceptance. Only the exact supplied loopback origin is permitted; no remote service responses are fabricated.'};
 report.frozenHtml={sha256:o.htmlSha,bytes:fs.statSync(o.html).size};report.geometry={viewport:{width:1440,height:1000},deviceScaleFactor:1};report.workerOfflineRequested=o.expectWorker;report.workerEvents=[];report.networkObservationScope='Browser-context HTTP requests, including dedicated-worker traffic; nonlocal HTTP routes are aborted. Worker source URLs are classified without storing their full URL or any private href.';
 let browser,context,page,expectedProjectOpen=false;const target=path.join(o.out,'image-rectify-result.json'),persist=()=>fs.writeFileSync(target,JSON.stringify(report,null,2));
 const step=async(name,work)=>{const row={name,status:'RUNNING'};report.cases.push(row);persist();try{await work(row);row.status='PASS';}catch(e){row.status='FAIL';row.error=e.message;try{await page.screenshot({path:path.join(o.out,name+'-failure.png')});}catch{}throw e;}finally{persist();}};
 try{
  const {chromium}=require('playwright');browser=await chromium.launch({headless:true,...(o.browser?{executablePath:o.browser}:{})});report.browser=browser.version();
  report.recordingRequested=o.video;context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,...(o.video?{recordVideo:{dir:path.join(o.out,'video'),size:{width:1440,height:1000}}}:{})});page=await context.newPage();page.setDefaultTimeout(15000);
  const allowed=new URL(o.url).origin;
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(/^https?:$/.test(u.protocol)&&u.origin!==allowed){report.externalRequests.push(u.origin+u.pathname);return route.abort();}return route.continue();});
  context.on('request',request=>{const u=new URL(request.url());if(/^https?:$/.test(u.protocol)){let issuer='frame';try{request.frame();}catch{issuer='worker-or-unattributed';}report.requests.push({method:request.method(),pathname:u.pathname,issuer});const body=request.postDataBuffer();if(u.href.includes(sourcePrefix)||u.href.includes(encodeURIComponent(sourcePrefix))||body&&(body.includes(source)||body.includes(Buffer.from(sourcePrefix))))report.sourcePayloadLeak=true;}});
  let workerSerial=0;const observedWorkers=new WeakMap();
  const observeWorkers=(owner,label)=>owner.on('worker',worker=>{const id=++workerSerial,url=worker.url();let localBlob=false;try{localBlob=url.startsWith('blob:')&&new URL(url.slice(5)).origin===allowed;}catch{}const row={id,page:label,event:'created',atUTC:new Date().toISOString(),urlKind:url.startsWith('blob:')?'blob':url.startsWith('data:')?'data':'other',trustedLocalBlob:localBlob};observedWorkers.set(worker,id);report.workerEvents.push(row);worker.on('close',()=>report.workerEvents.push({id,page:label,event:'closed',atUTC:new Date().toISOString()}));});observeWorkers(page,'main');
  page.on('pageerror',e=>report.pageErrors.push(e.message));
  page.on('dialog',async d=>{
   if(expectedProjectOpen&&d.type()==='confirm'&&/^(Opening a project replaces the current workspace\.|打开工程将替换当前工作区。)/.test(d.message())){expectedProjectOpen=false;report.expectedProjectReplacementConfirmations=(report.expectedProjectReplacementConfirmations||0)+1;await d.accept();return;}
   report.unexpectedDialogs??=[];report.unexpectedDialogs.push({type:d.type(),message:d.message()});await d.dismiss();
  });
  const response=await context.request.get(o.url);assert.ok(response.ok());report.actualServedHtmlSha256=sha(await response.body());assert.equal(report.actualServedHtmlSha256,o.htmlSha,'Actual served HTML must match frozen source');
  await page.goto(o.url);await page.locator('#language').selectOption('en');await H.newProject(page,'LOCAL PRIVATE photo correction acceptance');
  let baseline,baselineExports,kept,correctedHref;
  await step('ordinary-file-import',async e=>{
   await page.locator('#importFiles').click();await page.locator('#imageFile').setInputFiles({name:'LOCAL-PRIVATE-photo.jpg',mimeType:'image/jpeg',buffer:source});
   await page.waitForFunction(()=>document.querySelectorAll('#artboard image[data-key]').length===1);
   if(await page.locator('#importContentDialog[open]').count())await page.locator('#importContentDialog button').last().click();await page.locator('#zoom').selectOption('fit');
   baseline=await save(page,o.out,'private-original-project',{persist:true});const image=page.locator('#artboard image[data-key]').first(),href=await image.getAttribute('href');assert.equal(bitmapHash(href),o.sourceSha,'Imported encoded JPEG must be byte exact');
   report.source.dimensions=await image.evaluate(async n=>{const im=new Image();im.src=n.getAttribute('href');await im.decode();return {width:im.naturalWidth,height:im.naturalHeight};});
   for(const p of o.quad)assert.ok(p.x>=0&&p.y>=0&&p.x<=report.source.dimensions.width&&p.y<=report.source.dimensions.height);
   baselineExports=await exportsAt(page,o,'original');e.savedRawSha256=baseline.sha256;e.fiveContainerHashes=baseline.containers;e.originalJpegByteExact=true;e.export=baselineExports;
   await page.screenshot({path:path.join(o.out,'private-original-canvas.png')});
  });
  await step('actual-auto-geometry-candidates-and-cancel',async e=>{
   const workerStart=report.workerEvents.length;
   await armTiming(page,'rectify','#imageTool-rectify','first-auto-after-ordinary-import');await openRectify(page);await ready(page);e.firstAuto=await collectTiming(page);
   if(o.expectWorker){e.firstAutoWorkerFacts=report.workerEvents.slice(workerStart);assert.ok(e.firstAutoWorkerFacts.some(w=>w.event==='created'&&w.trustedLocalBlob),'The actual automatic workflow must create a local Blob Worker on this supported Chrome');}
   e.firstAuto.priorWork='Ordinary file import and the committed original SVG/PNG/TIFF exports were completed first. This is first opening of the correction controls, not a cold image decode or cold application start.';
   assert.ok(e.firstAuto.states.some(s=>s.state==='detecting'),'The actual first-open detector must be observed, not substituted by a ready manual draft');
   e.candidateCount=await page.locator('[data-rectify="outlines"] option').count();assert.ok(e.candidateCount>=1&&e.candidateCount<=5,'This explicit photo must produce actual bounded candidates; their shape is not accuracy ground truth');
   e.initialCorners=await readCorners(page);for(const p of e.initialCorners)assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.y>=0&&p.x<=report.source.dimensions.width&&p.y<=report.source.dimensions.height);
   e.note=await page.locator('[data-rectify="autoNote"]').textContent();assert.ok(e.note.trim());e.canvas=await currentCanvas(page);unchanged((await save(page,o.out,'automatic-draft-not-saved')).payload,baseline.payload);
   await page.screenshot({path:path.join(o.out,'private-automatic-geometry.png')});
   if(e.candidateCount>1){const choice=page.locator('[data-rectify="outlines"]');await choice.selectOption('1');await ready(page);e.secondCorners=await readCorners(page);assert.notDeepEqual(e.secondCorners,e.initialCorners,'Selecting another actual candidate must update editable source coordinates');assert.equal(await choice.inputValue(),'1');unchanged((await save(page,o.out,'second-auto-candidate')).payload,baseline.payload);e.actualCandidateSelection=true;}
   await armTiming(page,'rectify','[data-rectify="auto"]','repeated-auto-same-source');await page.locator('[data-rectify="auto"]').click();await ready(page);e.repeatedAuto=await collectTiming(page);assert.deepEqual(await readCorners(page),e.initialCorners,'Repeated actual deterministic analysis must restore its first candidate');
   await page.locator('[data-rectify="cancel"]').click();await page.waitForFunction(()=>!document.querySelector('#artboard>svg[data-preview-kind]'));unchanged((await save(page,o.out,'automatic-cancelled')).payload,baseline.payload);
   e.noCommitOrAddedResource=true;e.scope='Actual browser decode and heuristic edge analysis on one private monitor photograph; candidate coordinates are suggestions requiring manual confirmation. This checks usable controls and draft safety, not precision/recall, physical aspect ratio or automatic gel semantics.';
  });
  await step('preview-invalid-and-cancel',async e=>{
   await openRectify(page);await corners(page,o.quad,o.width);await ready(page);const good=await currentCanvas(page);assert.notEqual(good.hrefSha256,o.sourceSha);unchanged((await save(page,o.out,'draft-not-persisted')).payload,baseline.payload);
   const handle=page.locator('[data-rectify-handle="0"]');await handle.focus();await handle.press('ArrowRight');assert.equal(Number(await page.locator('[data-rectify-coordinate="0-x"]').inputValue()),o.quad[0].x+1);await handle.press('ArrowLeft');await ready(page);
   const draftExports=await exportsAt(page,o,'during-private-preview');sameExport(draftExports,baselineExports);unchanged((await save(page,o.out,'draft-after-export')).payload,baseline.payload);
   await page.locator('[data-rectify="compare"]').click();assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),o.sourceSha);await page.locator('[data-rectify="compare"]').click();await ready(page);
   const lastGood=await currentCanvas(page);await page.locator('[data-rectify-coordinate="0-x"]').fill(String(o.quad[1].x));await page.locator('[data-rectify-coordinate="0-y"]').fill(String(o.quad[1].y));
   await page.waitForFunction(()=>document.querySelector('[data-rectify="apply"]').disabled&&document.getElementById('imageRectifyDialog').dataset.state==='error');assert.equal((await currentCanvas(page)).hrefSha256,lastGood.hrefSha256,'Invalid quad retains the actual last good candidate');unchanged((await save(page,o.out,'invalid-draft')).payload,baseline.payload);
   await page.screenshot({path:path.join(o.out,'private-invalid-quad.png')});await page.locator('[data-rectify="cancel"]').click();await page.waitForFunction(()=>!document.querySelector('#artboard>svg[data-preview-kind]'));unchanged((await save(page,o.out,'cancelled')).payload,baseline.payload);
   e.realMainCanvas=good;e.cornerKeyboardOnePixel=true;e.lastValidRetained=true;e.noDraftSavedOrExported=true;e.allFiveContainersCancelExact=true;e.draftExports=draftExports;
  });
  await step('same-task-preview-undo-stale-fence',async e=>{
   await openRectify(page,'quick');await corners(page,o.quad,o.width);await ready(page);
   // Actual DOM button handlers in one task create a deterministic cancellation
   // boundary without replacing any computation, promise, source or result.
   e.atInvalidation=await page.evaluate(()=>{document.querySelector('[data-rectify="preview"]').click();const d=document.getElementById('imageRectifyDialog'),result={state:d.dataset.state,applyDisabled:document.querySelector('[data-rectify="apply"]').disabled};document.getElementById('undo').click();return result;});
   assert.equal(e.atInvalidation.state,'pending','Actual asynchronous request must be pending at invalidation');assert.equal(e.atInvalidation.applyDisabled,true);
   await page.waitForFunction(()=>!document.querySelector('#artboard>svg[data-preview-kind]'));await page.waitForTimeout(500);
   assert.equal(await page.locator('#imageRectifyDialog').isVisible(),false);assert.equal(await page.locator('#artboard image[data-key]').count(),0,'Undo cancels preview and undoes the prior image import');
   await page.locator('#redo').click();const restored=await save(page,o.out,'stale-redo');assert.deepEqual(restored.payload.state,baseline.payload.state);assert.deepEqual(active(restored.payload),active(baseline.payload));assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),o.sourceSha);
   e.noLatePreviewOrCommit=true;e.boundary='Same-task DOM activation of real Preview and Undo buttons; no delayed/fabricated response or production hook.';
  });
  await step('keep-one-undo-and-save-reopen',async e=>{
   await openRectify(page);await corners(page,o.quad,o.width);await ready(page);await setTheme(page,'pearl');await page.screenshot({path:path.join(o.out,'private-pearl-preview.png')});await setTheme(page,'carbon');await page.screenshot({path:path.join(o.out,'private-carbon-preview.png')});
   await page.locator('[data-rectify="apply"]').click();await page.locator('#imageRectifyDialog').waitFor({state:'hidden',timeout:90000});kept=await save(page,o.out,'private-corrected-project',{persist:true});
   assert.equal(kept.payload.history.index,baseline.payload.history.index+1);assert.deepEqual(kept.payload.project.panels.find(p=>p.id===active(baseline.payload)[0].id),active(baseline.payload)[0]);
   const panel=active(kept.payload)[0],audit=panel.analysis.imageRectification;assert.equal(panel.variants.length,2);assert.equal(bitmapHash(hrefFromSvg(panel.variants[1].svg)),o.sourceSha);assert.equal(audit.sourceSha256,o.sourceSha);assert.deepEqual(audit.corners,o.quad);assert.equal(audit.outputWidth,o.width);assert.equal(audit.preview,false);assert.equal(audit.nonGenerative,true);assert.equal(audit.displayOnly,true);assert.equal(audit.quantitativeUse,false);assert.equal(audit.calibrationInherited,false);assert.equal(audit.ratioMode,'estimate');assert.equal(audit.estimatedRatio,true);
   correctedHref=hrefFromSvg(panel.variants[0].svg);assert.equal(audit.outputSha256,bitmapHash(correctedHref),'Audit binds the actual produced PNG bytes');assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),bitmapHash(correctedHref));
   await armTiming(page,'color','[data-rectify="colour"]','post-keep-one-click-auto-color-corrected-raster');await page.locator('[data-rectify="colour"]').click();await colorReady(page);e.postKeepAutoColor=await collectTiming(page);e.postKeepColorNote=await page.locator('[data-color="autoNote"]').textContent();unchanged((await save(page,o.out,'post-keep-auto-color-draft')).payload,kept.payload);await page.locator('[data-color="cancel"]').click();unchanged((await save(page,o.out,'post-keep-auto-color-cancel')).payload,kept.payload);
   await page.locator('#undo').click();let p=(await save(page,o.out,'undo-kept')).payload;assert.deepEqual(p.state,baseline.payload.state);assert.deepEqual(active(p),active(baseline.payload));assert.equal(p.history.index,baseline.payload.history.index);assert.deepEqual(p.checkpoints,baseline.payload.checkpoints);assert.deepEqual(p.dataDrafts,baseline.payload.dataDrafts);
   await page.locator('#redo').click();unchanged((await save(page,o.out,'redo-kept')).payload,kept.payload);
   expectedProjectOpen=true;await page.locator('#projectFile').setInputFiles(kept.file);
   await page.waitForFunction(()=>/^(Project restored|工程已恢复)$/.test(document.getElementById('status').textContent.trim()));assert.equal(expectedProjectOpen,false);assert.equal(report.expectedProjectReplacementConfirmations,1,'Exactly one actual project-replacement confirmation must be accepted');
   const reopened=await save(page,o.out,'private-reopened-project',{persist:true});unchanged(reopened.payload,kept.payload);assert.equal(reopened.sha256,kept.sha256,'Saved/reopened JSON bytes remain exact');
   e.actualProjectReplacementConfirmedOnce=true;e.originalEncodedBitmapRetained=true;e.originalSourceAssetRetained=true;e.newVariants=2;e.oneUndoRestoresActiveSourceAndState=true;e.unusedDerivedAssetRetention='Existing append-only resource contract; Undo does not remove unused resources';e.rawSavedSha256=kept.sha256;e.rawReopenedSha256=reopened.sha256;e.audit=audit;e.fiveContainerHashes=kept.containers;
  });
  await step('damaged-saved-project-rejected-before-replacement',async e=>{
   const before=await save(page,o.out,'before-damaged-import'),damaged=JSON.parse(kept.bytes.toString()),asset=active(damaged)[0];asset.analysis.imageRectification.sourceSha256='0'.repeat(64);
   const bytes=Buffer.from(JSON.stringify(damaged)),file=path.join(o.out,'private-deliberately-damaged-project.json');fs.writeFileSync(file,bytes,{flag:'wx'});const confirms=report.expectedProjectReplacementConfirmations||0,unexpected=report.unexpectedDialogs?.length||0;
   await page.locator('#projectFile').setInputFiles(file);
   await page.waitForFunction(()=>/failed verification|校验失败/.test(document.getElementById('status').textContent),{},{timeout:90000});
   assert.equal(report.expectedProjectReplacementConfirmations||0,confirms);assert.equal(report.unexpectedDialogs?.length||0,unexpected,'Tampered source hash must be rejected before even asking to replace a workspace');unchanged((await save(page,o.out,'after-damaged-import')).payload,before.payload);
   e.damagedFileSha256=sha(bytes);e.onlyMutation='Active correction record sourceSha256 changed to 64 zeroes';e.observedError=await page.locator('#status').textContent();e.noReplacementConfirmation=true;e.allFiveContainersExact=true;e.authenticRawBitmapRetained=true;
  });
  await step('corrected-old-exports-and-themes',async e=>{
   e.exports=[];for(const theme of ['carbon','pearl']){await setTheme(page,theme);const x=await exportsAt(page,o,'corrected-'+theme);assert.equal(x.svg.metadata.imageProcessing.length,1);assert.equal(x.svg.metadata.imageProcessing[0].sourceSha256,o.sourceSha);assert.equal(x.svg.metadata.imageProcessing[0].calibrationInherited,false);assert.equal(x.svg.metadata.imageProcessing[0].quantitativeUse,false);e.exports.push({theme,...x});}
   sameExport(e.exports[0],e.exports[1]);assert.notEqual(e.exports[0].pixels[0].rgbaSha256,baselineExports.pixels[0].rgbaSha256);assert.deepEqual(active((await save(page,o.out,'after-exports')).payload),active(kept.payload));await setTheme(page,'carbon');
   e.pngTiffPixelsIndependentDecoderExact=true;e.svgIsEditableEmbeddedImage=true;e.themeDoesNotChangeExportPixels=true;await page.screenshot({path:path.join(o.out,'private-corrected-canvas.png')});
  });
  await step('visible-original-version-and-no-double-warp',async e=>{
   await page.locator('#artboard image[data-key]').first().click();await page.locator('[data-tab="detail"]').click();
   const chooser=page.locator('[data-rectify="version"]');await chooser.waitFor({state:'visible'});await chooser.selectOption('original');
   await page.waitForFunction(()=>document.querySelector('[data-rectify="version"]')?.value==='original');await frames(page);
   assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),o.sourceSha);
   const originalVariant=await save(page,o.out,'visible-original-variant');assert.equal(originalVariant.payload.state.panels[originalVariant.payload.state.order[0]].variant,1);
   const originalAgain=await exportsAt(page,o,'visible-original-variant');assert.equal(originalAgain.svg.metadata.imageProcessing,undefined,'Original variant must not be labelled as geometrically processed');
   await chooser.selectOption('corrected');await frames(page);assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),bitmapHash(correctedHref));
   const before=await save(page,o.out,'before-reopen-rectify');await openRectify(page,'quick');
   assert.equal(bitmapHash(await page.locator('#imageRectify-originalSvg image').getAttribute('href')),o.sourceSha,'Reopening always samples the retained raw source rather than the already corrected raster');
   for(let i=0;i<4;i++)for(const axis of ['x','y'])assert.equal(Number(await page.locator('[data-rectify-coordinate="'+i+'-'+axis+'"]').inputValue()),o.quad[i][axis]);
   assert.equal(Number(await page.locator('[data-rectify="width"]').inputValue()),o.width);await ready(page);unchanged((await save(page,o.out,'reopened-draft')).payload,before.payload);
   await page.screenshot({path:path.join(o.out,'private-reopened-original-source.png')});await page.locator('[data-rectify="cancel"]').click();unchanged((await save(page,o.out,'cancel-reopened')).payload,before.payload);
   e.ordinaryOriginalCorrectedSelect=true;e.originalEncodedBytesExact=true;e.originalSvgProcessingMetadataAbsent=true;e.reopenUsesRawSource=true;e.cornersAndWidthRestored=true;e.reopenCancelAllFiveContainersExact=true;e.originalVariantExports=originalAgain;
  });
  await step('colour-after-correction',async e=>{
   await openColor(page);const dialog=page.locator('#imageColorDialog');
   const before=await save(page,o.out,'before-colour'),input=dialog.locator('[data-color-number="exposureEv"]');await input.fill('0.25');await page.waitForFunction(()=>document.querySelector('#artboard image[data-studio-image-color]'));
   unchanged((await save(page,o.out,'during-colour')).payload,before.payload);await dialog.locator('[data-color="apply"]').click();await dialog.waitFor({state:'hidden'});const after=await save(page,o.out,'after-colour');assert.equal(after.payload.history.index,before.payload.history.index+1);assert.deepEqual(active(after.payload),active(before.payload));assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),bitmapHash(correctedHref));
   await page.locator('#undo').click();const undone=await save(page,o.out,'undo-colour');assert.deepEqual(undone.payload.state,before.payload.state);assert.deepEqual(active(undone.payload),active(before.payload));e.correctedBitmapNotRewritten=true;e.colourOneUndo=true;e.originalStillByteExact=bitmapHash(hrefFromSvg(active(undone.payload)[0].variants[1].svg))===o.sourceSha;
  });
  await step('actual-auto-colour-cancel-apply-and-one-undo',async e=>{
   const before=await save(page,o.out,'before-auto-colour'),dialog=page.locator('#imageColorDialog');
   await openColor(page);
   await armTiming(page,'color','[data-color="auto"]','auto-color-corrected-raster');await dialog.locator('[data-color="auto"]').click();await colorReady(page);e.firstAuto=await collectTiming(page);e.note=await dialog.locator('[data-color="autoNote"]').textContent();assert.match(e.note,/balance|白平衡|manual|手动/i,'Actual photo adjustment evidence or fallback must be explained');
   unchanged((await save(page,o.out,'during-auto-colour')).payload,before.payload);await page.screenshot({path:path.join(o.out,'private-automatic-colour.png')});
   await armTiming(page,'color','[data-color="auto"]','repeated-auto-color-same-corrected-raster');await dialog.locator('[data-color="auto"]').click();await colorReady(page);e.repeatedAuto=await collectTiming(page);unchanged((await save(page,o.out,'during-repeated-auto-colour')).payload,before.payload);
   await dialog.locator('[data-color="mode"]').selectOption('fluorescence');assert.equal(await dialog.locator('[data-color="auto"]').isDisabled(),true,'Photo auto color must remain unavailable in fluorescence mode');await dialog.locator('[data-color="cancel"]').click();unchanged((await save(page,o.out,'cancel-auto-colour')).payload,before.payload);
   await openColor(page);await dialog.locator('[data-color="auto"]').click();await colorReady(page);
   e.adjustmentInputValues=await dialog.locator('[data-color-number]').evaluateAll(ns=>Object.fromEntries(ns.map(n=>[n.dataset.colorNumber,n.value])));await dialog.locator('[data-color="apply"]').click();await dialog.waitFor({state:'hidden'});
   const after=await save(page,o.out,'after-auto-colour');assert.equal(after.payload.history.index,before.payload.history.index+1);assert.notDeepEqual(after.payload.state,before.payload.state,'Actual automatic photo adjustments must be committed on Apply');assert.deepEqual(active(after.payload),active(before.payload));assert.equal(bitmapHash(await page.locator('#artboard image[data-key]').first().getAttribute('href')),bitmapHash(correctedHref),'Display color adjustment must not rewrite the corrected or original encoded image');
   await page.locator('#undo').click();const undone=await save(page,o.out,'undo-auto-colour');assert.deepEqual(undone.payload.state,before.payload.state);assert.deepEqual(active(undone.payload),active(before.payload));assert.equal(bitmapHash(hrefFromSvg(active(undone.payload)[0].variants[1].svg)),o.sourceSha);
   e.actualLocalSuggestion=true;e.cancelAllFiveContainersExact=true;e.fluorescenceDisabled=true;e.applyExactlyOneUndo=true;e.originalAndCorrectedEncodedBytesUnchanged=true;e.scope='Conservative global photographic display suggestion on the corrected raster. No calibrated color recovery, intensity correction or scientific quantification claim.';
  });
  await step('actual-ruler-drag-global-rotation-cancel-keep-and-reopen',async e=>{
   // Restore the actual Auto-color Apply undone by the preceding group. Ruler
   // must preserve these display parameters without baking them into the PNG.
   await page.locator('#redo').click();await frames(page);const before=await save(page,o.out,'before-ruler'),sourceColor=await actualDisplayColor(page),sourceState=before.payload.state.panels[before.payload.state.order[0]],inherited=sourceState.imageAdjustments?.[sourceState.variant]?.[sourceColor.key];assert.ok(inherited);assert.deepEqual(sourceColor.parameters,inherited);assert.equal(sourceColor.filterApplied,true);e.inheritedColorParameters=inherited;
   const reference=o.quad.slice(0,2).map(p=>({...p}));e.explicitApproximatePhotoReference=reference;e.referenceIsIndependentGroundTruth=false;
   await openRectify(page,'quick');await ready(page);e.actualDraggedPoints=await drawSourceRuler(page,reference);assert.equal(await page.locator('[data-rectify="rulerLine"]').isVisible(),true);
   e.observedNote=await page.locator('[data-rectify="rulerNote"]').textContent();assert.match(e.observedNote,/whole-image rotation|整体旋转/);e.preview=await currentCanvas(page);const previewColor=await actualDisplayColor(page);assert.deepEqual(previewColor.parameters,inherited);assert.equal(previewColor.filterApplied,true);unchanged((await save(page,o.out,'ruler-draft-not-saved')).payload,before.payload);await page.screenshot({path:path.join(o.out,'private-ruler-line-preview.png')});
   const lastGood=await currentCanvas(page);await page.locator('[data-rectify-ruler-coordinate="1-x"]').fill(String(e.actualDraggedPoints[0].x+1));await page.locator('[data-rectify-ruler-coordinate="1-y"]').fill(String(e.actualDraggedPoints[0].y));
   await page.waitForFunction(()=>document.getElementById('imageRectifyDialog').dataset.state==='error'&&document.querySelector('[data-rectify="apply"]').disabled);assert.equal((await currentCanvas(page)).hrefSha256,lastGood.hrefSha256,'Too-short ruler must retain the actual last good preview');unchanged((await save(page,o.out,'invalid-short-ruler')).payload,before.payload);
   await page.locator('[data-rectify="cancel"]').click();unchanged((await save(page,o.out,'cancel-ruler')).payload,before.payload);
   await openRectify(page,'quick');await ready(page);const actual=await drawSourceRuler(page,reference);unchanged((await save(page,o.out,'ruler-before-keep')).payload,before.payload);
   await page.locator('[data-rectify="apply"]').click();await page.locator('#imageRectifyDialog').waitFor({state:'hidden',timeout:90000});const after=await save(page,o.out,'private-ruler-kept-project',{persist:true}),record=active(after.payload)[0].analysis.imageRectification,audit=record.straighten;
   assert.equal(after.payload.history.index,before.payload.history.index+1);assert.equal(audit.schema,'figure-studio-ruler-straightening/1');assert.deepEqual(audit.rulerPoints,actual);assert.equal(audit.target,'horizontal');assert.equal(audit.uniformScale,true);assert.equal(audit.perspectiveCorrected,false);assert.equal(audit.outsideFill,false);assert.equal(audit.physicalCalibrationInherited,false);assert.equal(audit.nonGenerative,true);assert.equal(record.straightenRefined,false);assert.equal(record.sourceSha256,o.sourceSha);assert.equal(record.outputWidth,audit.outputWidth);assert.equal(record.outputHeight,audit.outputHeight);
   const angle=Math.atan2(actual[1].y-actual[0].y,actual[1].x-actual[0].x)*180/Math.PI;assert.ok(Math.abs(audit.angleDegrees-angle)<1e-7);assert.ok(Math.abs(audit.rotationDegrees+angle)<1e-7,'Horizontal ruler applies the opposite global image rotation');
   const c=record.corners,top={x:c[1].x-c[0].x,y:c[1].y-c[0].y},left={x:c[3].x-c[0].x,y:c[3].y-c[0].y},scale=audit.sourcePixelsPerOutputPixel;
   assert.ok(Math.abs(top.x*left.x+top.y*left.y)<1e-6*Math.hypot(top.x,top.y)*Math.hypot(left.x,left.y),'Actual ruler source quad must remain orthogonal');assert.ok(Math.abs(Math.hypot(top.x,top.y)/audit.outputWidth-scale)<1e-7);assert.ok(Math.abs(Math.hypot(left.x,left.y)/audit.outputHeight-scale)<1e-7,'Both output axes must use the same source pixel scale');
   assert.equal(bitmapHash(hrefFromSvg(active(after.payload)[0].variants[1].svg)),o.sourceSha);assert.equal(bitmapHash(hrefFromSvg(active(after.payload)[0].variants[0].svg)),record.outputSha256);const derivedState=after.payload.state.panels[after.payload.state.order[0]];assert.deepEqual(derivedState.imageAdjustments?.[0]?.e1,inherited,'The corrected variant retains the exact previously applied global display settings');assert.equal(derivedState.imageAdjustments?.[1],undefined,'The retained RAW variant must remain without inherited display adjustments');const keptColor=await actualDisplayColor(page);assert.deepEqual(keptColor.parameters,inherited);assert.equal(keptColor.filterApplied,true);assert.equal(keptColor.encodedBitmapSha256,record.outputSha256);
   await page.screenshot({path:path.join(o.out,'private-ruler-kept-canvas.png')});await page.locator('#undo').click();const undo=await save(page,o.out,'undo-ruler');assert.deepEqual(undo.payload.state,before.payload.state);assert.deepEqual(active(undo.payload),active(before.payload));assert.equal(undo.payload.history.index,before.payload.history.index);
   await page.locator('#redo').click();unchanged((await save(page,o.out,'redo-ruler')).payload,after.payload);
   const confirms=report.expectedProjectReplacementConfirmations||0;expectedProjectOpen=true;await page.locator('#projectFile').setInputFiles(after.file);await page.waitForFunction(()=>/^(Project restored|工程已恢复)$/.test(document.getElementById('status').textContent.trim()));assert.equal(expectedProjectOpen,false);assert.equal(report.expectedProjectReplacementConfirmations,confirms+1);const reopened=await save(page,o.out,'private-ruler-reopened-project',{persist:true});unchanged(reopened.payload,after.payload);assert.equal(reopened.sha256,after.sha256);
   e.audit=audit;e.allFiveContainersCancelExact=true;e.tooShortRejectedWithLastGood=true;e.displayColorPreservedInPreviewAndCorrectedState=true;e.rawVariantUnadjustedAndByteExact=true;e.oneUndoRestoresPriorActiveSourceAndState=true;e.rawSavedSha256=after.sha256;e.rawReopenedSha256=reopened.sha256;e.privateEditableExample={file:path.basename(after.file),bytes:after.bytes.length,sha256:after.sha256};e.scope='Real two-point mouse gesture on the private photograph, global rigid rotation and inscribed crop. The line is an approximate user-picked display reference, not a physical scale bar, semantic gel detector, nonlinear lane correction or calibrated restoration.';
  });
  if(o.expectWorker)await step('actual-worker-cancel-and-browser-offline-auto',async e=>{
   // A separate fresh page gives this real producer no inherited module cache.
   // Browser offline simulation starts only after the ordinary page/import UI
   // has loaded. It is explicitly not a claim about OS/network disconnection.
   let offlinePage;try{
    offlinePage=await context.newPage();offlinePage.setDefaultTimeout(15000);observeWorkers(offlinePage,'browser-offline');offlinePage.on('pageerror',error=>report.pageErrors.push('browser-offline: '+error.message));offlinePage.on('dialog',async d=>{report.unexpectedDialogs??=[];report.unexpectedDialogs.push({type:d.type(),message:d.message(),page:'browser-offline'});await d.dismiss();});
    await offlinePage.goto(o.url);await offlinePage.locator('#language').selectOption('en');await H.newProject(offlinePage,'LOCAL PRIVATE browser-offline Worker acceptance');
    await offlinePage.locator('#importFiles').click();await offlinePage.locator('#imageFile').setInputFiles({name:'LOCAL-PRIVATE-photo.jpg',mimeType:'image/jpeg',buffer:source});await offlinePage.waitForFunction(()=>document.querySelectorAll('#artboard image[data-key]').length===1);if(await offlinePage.locator('#importContentDialog[open]').count())await offlinePage.locator('#importContentDialog button').last().click();await offlinePage.locator('#zoom').selectOption('fit');
    const baseline=await save(offlinePage,o.out,'private-browser-offline-original',{persist:true}),workerStart=report.workerEvents.length;
    await context.setOffline(true);e.offlineMechanism='Playwright BrowserContext.setOffline(true), after local page/import; not an OS disconnect';
    const creation=offlinePage.waitForEvent('worker');await openRectify(offlinePage);const worker=await creation,id=observedWorkers.get(worker);assert.ok(id);const startFact=report.workerEvents.find(w=>w.id===id&&w.event==='created');assert.equal(startFact.trustedLocalBlob,true);assert.equal(report.workerEvents.some(w=>w.id===id&&w.event==='closed'),false,'The actual producer must still be live when cancellation is exercised');
    e.beforeCancellation=await offlinePage.locator('#imageRectifyDialog').evaluate(n=>({state:n.dataset.state,applyDisabled:n.querySelector('[data-rectify="apply"]').disabled}));assert.equal(e.beforeCancellation.state,'detecting');assert.equal(e.beforeCancellation.applyDisabled,true);
    const closed=new Promise(resolve=>worker.once('close',resolve));e.cancelRequestedAtUTC=new Date().toISOString();await offlinePage.keyboard.press('Escape');await offlinePage.locator('#imageRectifyDialog').waitFor({state:'hidden'});
    let closeTimer;try{await Promise.race([closed,new Promise((_,reject)=>{closeTimer=setTimeout(()=>reject(Error('Actual decoder Worker did not close after user Escape cancellation')),5000);})]);}finally{clearTimeout(closeTimer);}
    const closeFact=report.workerEvents.find(w=>w.id===id&&w.event==='closed');assert.ok(closeFact);assert.ok(Date.parse(closeFact.atUTC)>=Date.parse(e.cancelRequestedAtUTC));e.cancelledWorker={id,created:startFact,closed:closeFact,cancelInput:'trusted keyboard Escape in the real correction dock'};
    await frames(offlinePage);await offlinePage.waitForTimeout(500);assert.equal(await offlinePage.locator('#imageRectifyDialog').isVisible(),false);assert.equal(await offlinePage.locator('#artboard>svg[data-preview-kind]').count(),0);unchanged((await save(offlinePage,o.out,'private-browser-offline-after-cancel')).payload,baseline.payload);
    await openRectify(offlinePage);await ready(offlinePage);e.candidateCount=await offlinePage.locator('[data-rectify="outlines"] option').count();assert.ok(e.candidateCount>=1&&e.candidateCount<=5);e.actualOfflinePreview=await currentCanvas(offlinePage);e.actualOfflineCorners=await readCorners(offlinePage);unchanged((await save(offlinePage,o.out,'private-browser-offline-ready')).payload,baseline.payload);await offlinePage.screenshot({path:path.join(o.out,'private-browser-offline-worker-ready.png')});
    await offlinePage.locator('[data-rectify="cancel"]').click();unchanged((await save(offlinePage,o.out,'private-browser-offline-final-cancel')).payload,baseline.payload);e.workerFacts=report.workerEvents.slice(workerStart);e.browserOfflineAutoCompleted=true;e.allFiveContainersCancelExact=true;e.noLateResultOrCommitAfterCancelledWorker=true;e.scope='Actual local Blob Worker creation, live-producer Escape cancellation/closure and subsequent complete automatic detection/preview under browser offline simulation. No mocked decoder/result, artificial producer delay, OS disconnect or native-install claim.';
   }catch(error){if(offlinePage)try{await offlinePage.screenshot({path:path.join(o.out,'private-browser-offline-worker-failure.png')});}catch{}throw error;}finally{await context.setOffline(false);await offlinePage?.close();}
  });
  const finalResponse=await context.request.get(o.url);assert.ok(finalResponse.ok());report.finalServedHtmlSha256=sha(await finalResponse.body());assert.equal(report.finalServedHtmlSha256,o.htmlSha);assert.deepEqual(report.externalRequests,[]);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.unexpectedDialogs||[],[]);assert.equal(report.sourcePayloadLeak,false);
  if(o.expectWorker)assert.ok(report.workerEvents.filter(w=>w.event==='created').every(w=>w.trustedLocalBlob),'Every observed decoder Worker must use a local Blob URL');
  report.originalFileStillExact=sha(fs.readFileSync(o.source))===o.sourceSha;assert.equal(report.originalFileStillExact,true);report.passed=true;
 }catch(error){report.failure=error.message;throw error;}finally{
  try{await context?.close();}finally{await browser?.close();}
  const videoDir=path.join(o.out,'video');report.originalRecordings=fs.existsSync(videoDir)?fs.readdirSync(videoDir).filter(n=>n.endsWith('.webm')).map(n=>{const f=path.join(videoDir,n),b=fs.readFileSync(f);return{file:'video/'+n,bytes:b.length,sha256:sha(b),unedited:true};}):[];
  report.privateOriginalScreenshots=fs.readdirSync(o.out).filter(n=>/^private-.*\.png$/.test(n)).map(n=>{const b=fs.readFileSync(path.join(o.out,n));return {file:n,bytes:b.length,sha256:sha(b),unedited:true};});
  report.finishedAtUTC=new Date().toISOString();persist();
 }
 console.log(JSON.stringify({passed:report.passed,privateLocalOnly:true,out:o.out,cases:report.cases.length,reportSha256:sha(fs.readFileSync(target))}));
}
if(require.main===module)run(options(process.argv.slice(2))).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={options,run,acceptanceHelpers:{save,exportsAt,openRectify,ready,armTiming,collectTiming,frames}};
