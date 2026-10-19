'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),modulePath='../skills/polish-sci-figures/assets/figure-studio/image-rectify-detect.js',detect=require(modulePath);
const full=(w,h,fill=[190,190,190,255])=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data.set(fill,i);return {width:w,height:h,data};};
function inside(p,x,y){let value=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i].y>y)!==(p[j].y>y)&&x<(p[j].x-p[i].x)*(y-p[i].y)/(p[j].y-p[i].y)+p[i].x)value=!value;return value;}
function fillPolygon(image,p,rgb){for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(inside(p,x+.5,y+.5))image.data.set([...rgb,255],(y*image.width+x)*4);}
const outer=[{x:43,y:32},{x:281,y:44},{x:268,y:211},{x:59,y:199}],inner=[{x:66,y:62},{x:256,y:71},{x:247,y:173},{x:77,y:165}];
function screen(){const image=full(320,240);fillPolygon(image,outer,[15,18,21]);fillPolygon(image,inner,[237,238,235]);return image;}
function pointError(a,b){return Math.max(...a.map((v,i)=>Math.hypot(v.x-b[i].x,v.y-b[i].y)));}
test('uniform opaque and transparent images produce no invented candidate',async()=>{
  for(const image of [full(160,120),full(160,120,[255,0,255,0])]){const result=await detect.detectPixels(image);assert.deepEqual(result.candidates,[]);assert.equal(result.audit.manualConfirmationRequired,true);assert.equal(result.audit.physicalRatioInferred,false);assert.equal(result.audit.semanticContentIdentified,false);}
});
test('dense deterministic noise and incomplete three-sided edges are refused as uncertain',async()=>{
  const noisy=full(240,180);let seed=42;for(let i=0;i<noisy.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const value=seed>>>24;noisy.data.set([value,value,value,255],i);}
  const open=full(240,180);for(let y=30;y<150;y++)for(let x=35;x<205;x++)if(y<33||x<38||x>=202)open.data.set([10,10,10,255],(y*240+x)*4);
  for(const input of [noisy,open]){const result=await detect.detectPixels(input);assert.deepEqual(result.candidates,[],JSON.stringify(result.candidates));assert.match(result.audit.reason,/insufficient|no-four-sided/);}
});
test('a known two-region raster returns edge-supported convex proposals near an independently rasterized boundary',async()=>{
  const result=await detect.detectPixels(screen());assert.ok(result.candidates.length>0&&result.candidates.length<=5);
  assert.ok(result.candidates.some(c=>Math.min(pointError(c.corners,outer),pointError(c.corners,inner))<8),JSON.stringify(result.candidates));
  for(const c of result.candidates){assert.equal(c.manualConfirmationRequired,true);assert.ok(c.edgeSupport.length===4&&Math.min(...c.edgeSupport)>=.4);assert.ok(c.score>=0&&c.score<=1);assert.ok(c.areaFraction>=.04&&c.areaFraction<=.95);for(let i=0;i<4;i++){const a=c.corners[i],b=c.corners[(i+1)%4],d=c.corners[(i+2)%4];assert.ok((b.x-a.x)*(d.y-b.y)-(b.y-a.y)*(d.x-b.x)>0);}}
});
test('comparable strong inner boundaries outrank enclosing frames while both remain editable alternatives',async()=>{
  const result=await detect.detectPixels(screen()),innerCandidate=result.candidates.find(c=>pointError(c.corners,inner)<8),outerCandidate=result.candidates.find(c=>pointError(c.corners,outer)<8);
  assert.ok(innerCandidate&&outerCandidate);assert.equal(result.candidates[0],innerCandidate);assert.equal(innerCandidate.nestedComparableRegion,true);assert.ok(outerCandidate.outerBoundaryPenalty>0&&outerCandidate.outerBoundaryPenalty<=.03);assert.ok(outerCandidate.baseScore>innerCandidate.baseScore,'Fixture exercises an outer frame that originally had the stronger raw rank');
  assert.equal(innerCandidate.manualConfirmationRequired,true);assert.equal(outerCandidate.manualConfirmationRequired,true);assert.equal(result.audit.physicalRatioInferred,false);
});
test('a single strong boundary remains usable; nested ranking does not invent a smaller crop',async()=>{
  const input=full(320,240);fillPolygon(input,outer,[15,18,21]);const result=await detect.detectPixels(input);assert.ok(result.candidates.length);assert.ok(pointError(result.candidates[0].corners,outer)<8);assert.equal(result.candidates[0].outerBoundaryPenalty,0);assert.equal(result.candidates[0].nestedComparableRegion,false);
});
test('a weak inner intensity patch does not displace a well-supported enclosing boundary',async()=>{
  const input=full(320,240);fillPolygon(input,outer,[30,30,30]);fillPolygon(input,inner,[38,38,38]);const result=await detect.detectPixels(input);assert.ok(result.candidates.length);assert.ok(pointError(result.candidates[0].corners,outer)<8);assert.equal(result.candidates[0].outerBoundaryPenalty,0);
});
test('suggestions use original pixel boundaries after bounded analysis, without inferring aspect or crop semantics',async()=>{
  const result=await detect.detectPixels(screen(),{sourceWidth:5712,sourceHeight:4284});assert.equal(result.sourceWidth,5712);assert.equal(result.sourceHeight,4284);assert.equal(result.audit.analysisWidth,320);assert.equal(result.audit.analysisHeight,240);assert.equal(result.audit.downsampled,true);assert.equal(result.audit.physicalRatioInferred,false);
  assert.ok(result.candidates.some(c=>Math.min(pointError(c.corners.map(p=>({x:p.x*320/5712,y:p.y*240/4284})),outer),pointError(c.corners.map(p=>({x:p.x*320/5712,y:p.y*240/4284})),inner))<8));
});
test('bounded analysis rejects invalid buffers, oversized rasters and invalid original dimensions',async()=>{
  for(const [image,options]of [[{width:2,height:2,data:new Uint16Array(16)},{}],[{width:2,height:2,data:new Uint8Array(15)},{}],[full(641,1),{}],[full(32,32),{sourceWidth:8000,sourceHeight:5000}]])await assert.rejects(detect.detectPixels(image,options),e=>['INVALID_INPUT','SOURCE_LIMIT'].includes(e.code));
});
test('abort before analysis and during gradient work stops with AbortError',async()=>{
  const a=new AbortController();a.abort();await assert.rejects(detect.detectPixels(screen(),{signal:a.signal}),e=>e.code==='ABORTED'&&e.name==='AbortError');
  const b=new AbortController();await assert.rejects(detect.detectPixels(screen(),{signal:b.signal,onProgress(){b.abort();}}),e=>e.code==='ABORTED');
});
test('public browser entry never fetches URLs or accepts active/unsupported image formats',async()=>{
  for(const href of ['https://example.invalid/a.jpg','file:///a.jpg','data:image/svg+xml;base64,PHN2Zy8+','data:image/gif;base64,R0lGODlh'])await assert.rejects(detect.detect(href),e=>e.code==='UNSUPPORTED_SOURCE');
});
function browserFixture({delayed=false,withDecode=false}={}){
  const href='data:image/png;base64,aW1hZ2UtZml4dHVyZQ==',tasks=[],decodeTasks=[],draws=[],canvases=[],live={count:0,peak:0,decodeRequests:0,decodeCompleted:false};
  class FakeImage{constructor(){this.naturalWidth=5712;this.naturalHeight=4284;this.active=false;}set src(value){if(!value){if(this.active){this.active=false;live.count--;}return;}this.active=true;live.count++;live.peak=Math.max(live.peak,live.count);const done=()=>this.onload?.();if(delayed)tasks.push(done);else setTimeout(done,0);}}
  if(withDecode)FakeImage.prototype.decode=function(){live.decodeRequests++;assert.equal(this.decoding,'async');return new Promise((resolve,reject)=>decodeTasks.push({resolve(){live.decodeCompleted=true;resolve();},reject}));};
  const context={Uint8Array,Uint8ClampedArray,setTimeout,clearTimeout,performance,Image:FakeImage,StudioImageInsets:{dimensionsFromHref(value){assert.equal(value,href);return {widthPx:5712,heightPx:4284};}},document:{createElement(tag){assert.equal(tag,'canvas');const target={width:0,height:0,getContext(){return {drawImage(...args){if(withDecode)assert.equal(live.decodeCompleted,true);draws.push(args.slice(1));},getImageData(x,y,w,h){assert.ok(w<=640&&h<=640);return full(w,h);}};}};canvases.push(target);return target;}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve(modulePath),'utf8')+'\nglobalThis.api=StudioImageRectifyDetect;',context);return {api:context.api,href,tasks,decodeTasks,draws,canvases,live};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('browser entry reads at most a 640 analysis raster from the full-resolution display source and releases resources',async()=>{
  const f=browserFixture(),result=await f.api.detect(f.href);assert.equal(result.sourceWidth,5712);assert.equal(result.sourceHeight,4284);assert.equal(result.audit.analysisWidth,640);assert.equal(result.audit.analysisHeight,480);assert.deepEqual(f.draws,[[0,0,640,480]]);assert.equal(f.live.count,0);assert.ok(f.canvases.every(c=>c.width===1&&c.height===1));
});
test('browser entry is serial, bounded and cancellable without decoding queued aborted work',async()=>{
  const f=browserFixture({delayed:true}),a=new AbortController(),b=new AbortController(),first=f.api.detect(f.href,{signal:a.signal}),second=f.api.detect(f.href,{signal:b.signal}),checkA=assert.rejects(first,e=>e.name==='AbortError'),checkB=assert.rejects(second,e=>e.name==='AbortError');
  await assert.rejects(f.api.detect(f.href),e=>e.code==='BUSY');for(let i=0;i<50&&!f.tasks.length;i++)await tick();assert.equal(f.tasks.length,1);b.abort();a.abort();await Promise.all([checkA,checkB]);assert.equal(f.live.count,0);assert.equal(f.live.peak,1);assert.equal(f.canvases.length,0);
});
test('onload waits for asynchronous decode before drawing or reading the analysis canvas',async()=>{
  const f=browserFixture({withDecode:true}),result=f.api.detect(f.href);for(let i=0;i<50&&!f.decodeTasks.length;i++)await tick();assert.equal(f.live.decodeRequests,1);assert.equal(f.draws.length,0);assert.equal(f.canvases.length,0);f.decodeTasks[0].resolve();await result;assert.equal(f.draws.length,1);assert.equal(f.live.count,0);
});
test('abort or decoder failure while awaiting decode cannot read pixels or retain the image',async()=>{
  const f=browserFixture({withDecode:true}),controller=new AbortController(),pending=f.api.detect(f.href,{signal:controller.signal}),checked=assert.rejects(pending,e=>e.code==='ABORTED');for(let i=0;i<50&&!f.decodeTasks.length;i++)await tick();controller.abort();await checked;f.decodeTasks[0].resolve();await tick();assert.equal(f.draws.length,0);assert.equal(f.live.count,0);
  const g=browserFixture({withDecode:true}),failed=g.api.detect(g.href),failureCheck=assert.rejects(failed,e=>e.code==='DECODE_FAILED');for(let i=0;i<50&&!g.decodeTasks.length;i++)await tick();g.decodeTasks[0].reject(Error('decode fixture failure'));await failureCheck;assert.equal(g.draws.length,0);assert.equal(g.live.count,0);
});
function workerFixture({constructError=false,postError=false}={}){
  const href='data:image/png;base64,aW1hZ2UtZml4dHVyZQ==',workers=[],urls=[],revoked=[],timers=new Map(),cleared=[],blobs=[];
  class FakeBlob{constructor(parts,options){this.parts=parts;this.type=options.type;blobs.push(this);}}
  class FakeWorker{constructor(url){if(constructError)throw Error('CSP blocked private URL');this.url=url;this.terminated=0;workers.push(this);}postMessage(value){if(postError)throw Error('private post failure');this.input=value;}terminate(){this.terminated++;}}
  const context={Uint8Array,Uint8ClampedArray,ArrayBuffer,performance,Worker:FakeWorker,OffscreenCanvas:class{},createImageBitmap(){throw Error('main decoder must not run');},Blob:FakeBlob,URL:{createObjectURL(blob){assert.equal(blob.type,'application/javascript');const url='blob:local-test-'+urls.length;urls.push(url);return url;},revokeObjectURL(url){revoked.push(url);}},Image:class{constructor(){throw Error('worker failures must not use main fallback');}},StudioImageInsets:{dimensionsFromHref(){return {widthPx:5712,heightPx:4284};}},setTimeout(fn,ms){if(ms===15000){const key={ms};timers.set(key,fn);return key;}return setTimeout(fn,ms);},clearTimeout(key){if(timers.has(key)){cleared.push(key);timers.delete(key);}else clearTimeout(key);}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve(modulePath),'utf8')+'\nglobalThis.api=StudioImageRectifyDetect;',context);
  return {api:context.api,href,workers,urls,revoked,timers,cleared,blobs,async ready(){for(let i=0;i<50&&!workers.length;i++)await tick();return workers.at(-1);},reply(worker,overrides={}){worker.onmessage?.({data:{ok:true,sourceWidth:5712,sourceHeight:4284,width:640,height:480,buffer:full(640,480).data.buffer,...overrides}});}};
}
test('worker sampling transfers bounded analysis pixels and disposes its worker, URL and deadline',async()=>{
  const f=workerFixture(),pending=f.api.detect(f.href),worker=await f.ready();assert.equal(worker.input.href,f.href);assert.equal(worker.input.width,640);assert.equal(worker.input.height,480);assert.equal(f.timers.size,1);assert.equal([...f.timers.keys()][0].ms,15000);
  assert.match(f.blobs[0].parts[0],/function samplingWorker/);assert.doesNotMatch(f.blobs[0].parts[0],/fetch\s*\(/);f.reply(worker);const result=await pending;
  assert.equal(result.audit.sampling.route,'local-worker-offscreen');assert.equal(result.audit.sampling.thumbnailPixelsMayDifferBetweenBrowserSamplers,true);assert.equal(result.audit.sampling.sourcePixelsModified,false);assert.equal(worker.terminated,1);assert.deepEqual(f.revoked,f.urls);assert.equal(f.timers.size,0);assert.equal(worker.onmessage,null);
});
test('worker messages require exact source dimensions, analysis dimensions and transferred buffer length',async()=>{
  for(const overrides of [{sourceWidth:4284},{sourceHeight:5712},{width:639},{height:479},{buffer:new ArrayBuffer(4)},{buffer:new Uint8Array(640*480*4)},{ok:'true'},{}]){
    const f=workerFixture(),pending=f.api.detect(f.href),checked=assert.rejects(pending,e=>e.code==='WORKER_FAILED'&&!e.message.includes(f.href)),worker=await f.ready();
    if(Object.keys(overrides).length)f.reply(worker,overrides);else worker.onmessage({data:null});await checked;assert.equal(worker.terminated,1);assert.deepEqual(f.revoked,f.urls);assert.equal(f.timers.size,0);
  }
});
test('CSP/construction, worker errors and message errors reject without a blocking main-thread retry',async()=>{
  for(const options of [{constructError:true},{postError:true},{}]){
    const f=workerFixture(options),pending=f.api.detect(f.href),checked=assert.rejects(pending,e=>e.code==='WORKER_FAILED');if(!options.constructError&&!options.postError){const worker=await f.ready();worker.onerror({preventDefault(){}});}await checked;assert.deepEqual(f.revoked,f.urls);assert.equal(f.timers.size,0);assert.ok(f.workers.every(w=>w.terminated===1));
  }
  const f=workerFixture(),pending=f.api.detect(f.href),checked=assert.rejects(pending,e=>e.code==='WORKER_FAILED'),worker=await f.ready();worker.onmessageerror({});await checked;assert.equal(worker.terminated,1);
  const g=workerFixture(),failed=g.api.detect(g.href),failure=assert.rejects(failed,e=>e.code==='DECODE_FAILED'),decoder=await g.ready();decoder.onmessage({data:{ok:false,code:'DECODE_FAILED'}});await failure;assert.equal(decoder.terminated,1);
});
test('worker deadline and Abort terminate, revoke and ignore late delivery; queue remains serial',async()=>{
  const f=workerFixture(),controller=new AbortController(),pending=f.api.detect(f.href,{signal:controller.signal}),checked=assert.rejects(pending,e=>e.code==='ABORTED'),worker=await f.ready(),late=worker.onmessage;controller.abort();await checked;late({data:{ok:true}});assert.equal(worker.terminated,1);assert.equal(f.timers.size,0);assert.deepEqual(f.revoked,f.urls);
  const g=workerFixture(),timeout=g.api.detect(g.href),timeoutCheck=assert.rejects(timeout,e=>e.code==='WORKER_TIMEOUT'),timed=await g.ready();[...g.timers.values()][0]();await timeoutCheck;assert.equal(timed.terminated,1);assert.deepEqual(g.revoked,g.urls);assert.equal(g.timers.size,0);
  const h=workerFixture(),a=new AbortController(),b=new AbortController(),one=h.api.detect(h.href,{signal:a.signal}),two=h.api.detect(h.href,{signal:b.signal}),oneCheck=assert.rejects(one,e=>e.code==='ABORTED'),twoCheck=assert.rejects(two,e=>e.code==='ABORTED');await h.ready();await assert.rejects(h.api.detect(h.href),e=>e.code==='BUSY');b.abort();a.abort();await Promise.all([oneCheck,twoCheck]);assert.equal(h.workers.length,1);assert.equal(h.workers[0].terminated,1);
});
async function runWorkerBody({input={},mismatch=false,resizeFailure=false,pixelFailure=false}={}){
  const f=workerFixture(),controller=new AbortController(),pending=f.api.detect(f.href,{signal:controller.signal}),checked=assert.rejects(pending,e=>e.code==='ABORTED');await f.ready();const source=f.blobs[0].parts[0];controller.abort();await checked;
  const messages=[],bitmaps=[],calls=[],request={href:f.href,sourceWidth:5712,sourceHeight:4284,width:640,height:480,...input};
  const worker={self:{postMessage(value,transfer){messages.push({value,transfer});}},Uint8Array,Uint8ClampedArray,Blob,atob,createImageBitmap:async(value,options)=>{calls.push({value,options});if(options&&resizeFailure)throw Error('controlled resize failure');const bitmap={width:options?options.resizeWidth:(mismatch?4284:5712),height:options?options.resizeHeight:4284,closed:0,close(){this.closed++;}};bitmaps.push(bitmap);return bitmap;},OffscreenCanvas:class{constructor(w,h){assert.ok(w<=640&&h<=640);}getContext(){return {drawImage(bitmap){assert.equal(bitmap.closed,0);},getImageData(x,y,w,h){if(pixelFailure)throw Error('controlled pixel failure');return full(w,h);}};}}};
  vm.createContext(worker);vm.runInContext(source,worker);await worker.self.onmessage({data:request});return {messages,bitmaps,calls};
}
test('actual static worker body decodes only embedded bytes, verifies orientation, resizes high quality and closes bitmaps',async()=>{
  const result=await runWorkerBody();assert.equal(result.messages.length,1);const {value,transfer}=result.messages[0];assert.equal(value.ok,true);assert.equal(value.width,640);assert.equal(value.height,480);assert.equal(value.sourceWidth,5712);assert.equal(value.buffer.byteLength,640*480*4);assert.equal(transfer[0],value.buffer);assert.equal(result.calls.length,2);assert.equal(result.calls[0].value.type,'image/png');assert.deepEqual({...result.calls[1].options},{resizeWidth:640,resizeHeight:480,resizeQuality:'high'});assert.ok(result.bitmaps.every(b=>b.closed===1));
  for(const options of [{mismatch:true},{resizeFailure:true},{pixelFailure:true}]){const failed=await runWorkerBody(options);assert.equal(failed.messages[0].value.ok,false);assert.ok(failed.bitmaps.every(b=>b.closed===1));if(options.mismatch)assert.equal(failed.calls.length,1);}
});
test('static worker repeats the URL and 32MP/640 bounds before decoding and never echoes source bytes in errors',async()=>{
  for(const input of [{href:'https://example.invalid/private.jpg'},{href:'data:image/svg+xml;base64,PHN2Zy8+'},{href:'data:image/png;base64,'+'A'.repeat(28000001)},{sourceWidth:8000,sourceHeight:5000},{sourceWidth:NaN},{width:641},{height:0},{width:6000}]){const result=await runWorkerBody({input});assert.equal(result.calls.length,0);assert.equal(result.messages.length,1);assert.equal(result.messages[0].value.ok,false);assert.deepEqual(Object.keys(result.messages[0].value).sort(),['code','ok']);}
});
