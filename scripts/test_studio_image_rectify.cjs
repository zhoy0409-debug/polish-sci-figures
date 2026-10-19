'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const path='../skills/polish-sci-figures/assets/figure-studio/image-rectify.js',rectify=require(path);
const full=(w,h)=>[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
const image=(w,h,fn=(x,y)=>[x,y,x+y,255])=>{const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(fn(x,y),(y*w+x)*4);return {width:w,height:h,data};};
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`);
const map=(H,x,y)=>{const z=H[6]*x+H[7]*y+H[8];return {x:(H[0]*x+H[1]*y+H[2])/z,y:(H[3]*x+H[4]*y+H[5])/z};};
function throwsCode(fn,code){assert.throws(fn,e=>e.code===code,code);}

test('pixel boundaries include width/height and never silently sort, mirror, clamp or modify corners',()=>{
  const p=full(100,60),copy=JSON.stringify(p),valid=rectify.validateQuad(p,{width:100,height:60});assert.deepEqual(valid,p);assert.notEqual(valid,p);assert.equal(JSON.stringify(p),copy);
  for(const bad of [[],p.slice(0,3),[...p,{x:2,y:3}],p.map(v=>[v.x,v.y]),p.map((v,i)=>({...v,x:i? v.x:'0'})),p.map((v,i)=>({...v,x:i? v.x:Infinity}))])throwsCode(()=>rectify.validateQuad(bad,{width:100,height:60}),'INVALID_QUAD');
  throwsCode(()=>rectify.validateQuad([{x:-.001,y:0},...p.slice(1)],{width:100,height:60}),'OUT_OF_BOUNDS');
  throwsCode(()=>rectify.validateQuad([{x:0,y:0},{x:101,y:0},{x:100,y:60},{x:0,y:60}],{width:100,height:60}),'OUT_OF_BOUNDS');
  for(const bad of [[p[0],p[3],p[2],p[1]],[p[0],p[2],p[1],p[3]],[p[0],p[1],p[1],p[3]],[p[0],p[1],{x:30,y:20},p[3]],full(1e-8,1e-8)])throwsCode(()=>rectify.validateQuad(bad,{width:100,height:60}),'DEGENERATE_QUAD');
});
test('estimated ratio is explicit, explicit ratio is respected, 24.47MP source is allowed and output caps are enforced',()=>{
  assert.deepEqual(rectify.outputSize(full(120,80),{width:120,height:80}),{width:120,height:80,ratio:1.5,estimatedRatio:true});
  assert.deepEqual(rectify.outputSize(full(120,80),{width:120,height:80,ratio:2,widthPx:120}),{width:120,height:60,ratio:2,estimatedRatio:false});
  const big=rectify.outputSize(full(5712,4284),{width:5712,height:4284});assert.ok(big.width<=4096&&big.height<=4096&&big.width*big.height<=12000000);assert.equal(big.estimatedRatio,true);
  for(const bad of [0,-1,Infinity,NaN,'1.2',null])throwsCode(()=>rectify.outputSize(full(120,80),{width:120,height:80,ratio:bad}),'INVALID_SIZE');
  throwsCode(()=>rectify.outputSize(full(120,80),{width:120,height:80,ratio:10000}),'INVALID_SIZE');
  for(const bad of [0,2.5,'200'])throwsCode(()=>rectify.outputSize(full(120,80),{width:120,height:80,widthPx:bad}),'INVALID_SIZE');
  throwsCode(()=>rectify.outputSize(full(100,100),{width:100,height:100,widthPx:201}),'UPSCALE_LIMIT');
  throwsCode(()=>rectify.outputSize(full(5000,5000),{width:5000,height:5000,widthPx:4097}),'OUTPUT_LIMIT');
  throwsCode(()=>rectify.outputSize(full(5000,5000),{width:5000,height:5000,widthPx:4000}),'OUTPUT_LIMIT');
  throwsCode(()=>rectify.validateQuad(full(8000,5000),{width:8000,height:5000}),'SOURCE_LIMIT');
});
test('known independent projective matrix is recovered at all corners and interior points',()=>{
  // An external analytic fixture: x=(1.2u+.2v+4)/(.002u+.003v+1),
  // y=(.1u+1.1v+3)/(.002u+.003v+1). No image fitted by this test.
  const truth=[1.2,.2,4,.1,1.1,3,.002,.003,1],corners=[[0,0],[20,0],[20,10],[0,10]].map(([x,y])=>map(truth,x,y)),H=rectify.homography(corners,20,10);
  H.forEach((v,i)=>close(v,truth[i]));
  for(const [x,y] of [[0,0],[20,10],[7.25,4.75],[19.5,.5],[.5,9.5]]){const a=map(H,x,y),b=map(truth,x,y);close(a.x,b.x);close(a.y,b.y);}
});
test('near-pole projective mapping is refused instead of allocating or extrapolating outside pixels',()=>{
  // Test the low-level solver directly: the short far edge is still nonzero
  // and convex, but its projective denominator spans more than nine orders.
  const p=[{x:0,y:0},{x:30000,y:0},{x:15000+5e-6,y:30000},{x:15000-5e-6,y:30000}];
  throwsCode(()=>rectify.homography(p,100,100),'SINGULAR_HOMOGRAPHY');
});
test('identity retains every RGBA byte, including invisible RGB, without mutating source',()=>{
  const raw=image(7,5,(x,y)=>[(x*37+y*11)%256,(x+y*55)%256,(x*19+y*31)%256,(x+y)%3===0?0:(x*17+y*23)%256]),before=new Uint8ClampedArray(raw.data);
  const out=rectify.warpPixels(raw,full(7,5),{width:7,height:5});assert.deepEqual(out.data,before);assert.deepEqual(raw.data,before);assert.notEqual(out.data,raw.data);
});
test('integer crop selects exact source pixels with boundary coordinates; one-pixel crop is well defined',()=>{
  const raw=image(5,4,(x,y)=>[x*30,y*40,x+y,255]);
  const out=rectify.warpPixels(raw,[{x:1,y:1},{x:4,y:1},{x:4,y:3},{x:1,y:3}],{width:3,height:2});
  const expected=image(3,2,(x,y)=>[(x+1)*30,(y+1)*40,x+y+2,255]);assert.deepEqual(out.data,expected.data);
  assert.deepEqual(Array.from(rectify.warpPixels(raw,[{x:2,y:2},{x:3,y:2},{x:3,y:3},{x:2,y:3}],{width:1,height:1}).data),[60,80,4,255]);
});
test('bilinear interpolation premultiplies alpha and does not bleed hidden transparent green',()=>{
  const raw={width:2,height:2,data:Uint8ClampedArray.from([255,0,0,255,0,255,0,0,0,0,255,128,0,0,0,255])};
  assert.deepEqual(Array.from(rectify.warpPixels(raw,full(2,2),{width:1,height:1}).data),[102,0,51,160]);
  const allTransparent=image(2,2,()=>[100,200,250,0]);assert.deepEqual(Array.from(rectify.warpPixels(allTransparent,full(2,2),{width:1,height:1}).data),[0,0,0,0]);
});
test('upsampling has clamp-to-edge boundary support and centre registration, without blank fill',()=>{
  const raw=image(2,1,(x)=>[x?200:0,0,0,255]);const out=rectify.warpPixels(raw,full(2,1),{width:4,height:1});
  assert.deepEqual(Array.from(out.data),[0,0,0,255,50,0,0,255,150,0,0,255,200,0,0,255]);
});
test('perspective warp of a known affine intensity plane agrees with independently evaluated source coordinates',()=>{
  const raw=image(64,64,(x,y)=>[2*x,3*y,x+y,255]),truth=[1.2,.2,4,.1,1.1,3,.002,.003,1],p=[[0,0],[20,0],[20,10],[0,10]].map(([x,y])=>map(truth,x,y));
  const out=rectify.warpPixels(raw,p,{width:20,height:10});
  for(let y=0;y<10;y++)for(let x=0;x<20;x++){
    const source=map(truth,x+.5,y+.5),i=(y*20+x)*4;close(out.data[i],2*(source.x-.5),.50000001);close(out.data[i+1],3*(source.y-.5),.50000001);close(out.data[i+2],source.x+source.y-1,.50000001);assert.equal(out.data[i+3],255);
  }
});
test('invalid dimensions, high-depth arrays, malformed buffers and pre-aborted calls fail explicitly',()=>{
  throwsCode(()=>rectify.warpPixels({width:2,height:2,data:new Uint16Array(16)},full(2,2),{width:2,height:2}),'DECODE_FAILED');
  throwsCode(()=>rectify.warpPixels({width:2,height:2,data:new Uint8ClampedArray(15)},full(2,2),{width:2,height:2}),'DECODE_FAILED');
  throwsCode(()=>rectify.warpPixels(image(2,2),full(2,2),{width:0,height:2}),'INVALID_SIZE');
  const controller=new AbortController();controller.abort();throwsCode(()=>rectify.warpPixels(image(2,2),full(2,2),{width:2,height:2},{signal:controller.signal}),'ABORTED');
});

// Browser boundary fixtures exercise actual core control flow with deterministic
// decoded pixels. They are not a browser accuracy or private-photo acceptance.
function browserFixture({width=8,height=6,delayDecode=false,workerOptions=null}={}){
  const raw=image(width,height,(x,y)=>[x*20,y*20,x+y,255]),sourceBytes=Buffer.from('original encoded source bytes'),pngBytes=Buffer.from('encoded PNG output fixture');
  const href='data:image/png;base64,'+sourceBytes.toString('base64'),tasks=[],draws=[],canvases=[],encodedPixels=[],reads=[],live={count:0,peak:0,released:0,decoded:0};
  class FakeImage{
    constructor(){this.naturalWidth=width;this.naturalHeight=height;this.active=false;}
    async decode(){live.decoded++;}
    set src(value){if(!value){if(this.active){this.active=false;live.count--;live.released++;}return;}this.active=true;live.count++;live.peak=Math.max(live.peak,live.count);const finish=()=>this.onload?.();if(delayDecode)tasks.push(finish);else setTimeout(finish,0);}
  }
  class FakeImageData{constructor(data,w,h){this.data=data;this.width=w;this.height=h;}}
  class FakeReader{readAsDataURL(){setTimeout(()=>{this.result='data:image/png;base64,'+pngBytes.toString('base64');this.onload?.();},0);}abort(){this.onabort?.();}}
  const context={Uint8Array,Uint8ClampedArray,Image:FakeImage,ImageData:FakeImageData,FileReader:FakeReader,atob:v=>Buffer.from(v,'base64').toString('binary'),crypto:crypto.webcrypto,performance,setTimeout,clearTimeout,console,StudioImageInsets:{dimensionsFromHref(value){assert.equal(value,href);return {widthPx:width,heightPx:height};}},document:{createElement(tag){assert.equal(tag,'canvas');const target={width:0,height:0,toBlob(callback,mime){assert.equal(mime,'image/png');setTimeout(()=>callback(new Blob([pngBytes],{type:mime})),0);},getContext(){return {drawImage(...args){draws.push(args.slice(1));target.cropX=-args[1];target.cropY=-args[2];},getImageData(x,y,w,h){assert.equal(live.decoded,1,'Decode must finish before the first source pixel read');reads.push({x,y,w,h});return image(w,h,(xx,yy)=>{const at=((yy+y+target.cropY)*width+xx+x+target.cropX)*4;return Array.from(raw.data.slice(at,at+4));});},putImageData(data){encodedPixels.push(data);}};}};canvases.push(target);return target;}}};
  const background={workers:[],urls:[],revoked:[],programs:[],timers:new Map()};
  if(workerOptions){
    context.ArrayBuffer=ArrayBuffer;context.OffscreenCanvas=class{};context.createImageBitmap=()=>{throw Error('main bitmap must not decode');};
    context.Blob=class{constructor(parts){background.programs.push(parts.join(''));}};
    context.URL={createObjectURL(){const url='blob:controlled-core-'+background.urls.length;background.urls.push(url);return url;},revokeObjectURL(url){background.revoked.push(url);}};
    context.Worker=class{constructor(url){if(workerOptions.constructError)throw Error('controlled CSP rejection');this.url=url;this.terminated=0;background.workers.push(this);}postMessage(value){if(workerOptions.postError)throw Error('controlled message rejection');this.input=value;}terminate(){this.terminated++;}};
    context.setTimeout=(fn,ms)=>{if(ms===15000){const key={ms};background.timers.set(key,fn);return key;}return setTimeout(fn,ms);};
    context.clearTimeout=key=>{if(background.timers.has(key))background.timers.delete(key);else clearTimeout(key);};
  }
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve(path),'utf8')+'\nglobalThis.api=StudioImageRectify;',context);
  return {api:context.api,href,raw,sourceBytes,pngBytes,tasks,draws,canvases,encodedPixels,reads,live,background};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('strip reads keep exact pixel registration across boundaries and allow cancellation before sampling',async()=>{
  const f=browserFixture({width:12,height:97});
  await f.api.rectify(f.href,{corners:full(12,97),width:12,height:97});
  assert.equal(f.reads.length,4);assert.deepEqual(f.reads.map(r=>r.y),[0,32,64,96]);assert.ok(f.reads.every(r=>r.h<=32));
  assert.deepEqual(Array.from(f.encodedPixels[0].data),Array.from(image(12,97,(x,y)=>[x*20,y*20,x+y,255]).data));
  const g=browserFixture({width:12,height:97}),controller=new AbortController();
  await assert.rejects(g.api.rectify(g.href,{corners:full(12,97),width:12,height:97,signal:controller.signal,onProgress(e){if(e.stage==='decode'&&e.completed>0)controller.abort();}}),e=>e.code==='ABORTED');
  assert.equal(g.encodedPixels.length,0);assert.equal(g.live.count,0);assert.ok(g.canvases.every(c=>c.width===1&&c.height===1));
});
test('async core hashes original encoded bytes and actual PNG bytes, preserves provenance and reports actual preview size',async()=>{
  const f=browserFixture(),events=[],result=await f.api.rectify(f.href,{corners:full(8,6),width:8,height:6,previewMaxSide:4,onProgress:e=>events.push(e)});
  assert.equal(result.width,4);assert.equal(result.height,3);assert.equal(result.sourceWidth,8);assert.equal(result.sourceHeight,6);assert.equal(result.audit.schema,'figure-studio-image-rectification/1');
  assert.equal(result.audit.sourceSha256,crypto.createHash('sha256').update(f.sourceBytes).digest('hex'));assert.equal(result.audit.outputSha256,crypto.createHash('sha256').update(f.pngBytes).digest('hex'));
  assert.equal(result.audit.outputWidth,4);assert.equal(result.audit.requestedOutputWidth,8);assert.equal(result.audit.preview,true);assert.equal(result.audit.nonGenerative,true);assert.equal(result.audit.displayOnly,true);assert.equal(result.audit.quantitativeUse,false);assert.equal(result.audit.interpolation,'bilinear-premultiplied-alpha');
  assert.match(result.audit.boundaryConvention,/x\+0\.5/);assert.match(result.audit.antialiasing,/no area low-pass/);assert.deepEqual(f.draws.map(v=>v.map(n=>n||0)),[[0,0]]);assert.equal(f.live.count,0);assert.ok(f.canvases.every(c=>c.width===1&&c.height===1));
  assert.ok(events.some(e=>e.stage==='decode'&&e.fraction===1));assert.ok(events.some(e=>e.stage==='warp'&&e.fraction===1));assert.equal(events.at(-1).stage,'encode');assert.equal(events.at(-1).fraction,1);
});
test('async source crop reads only the original ROI plus bilinear neighbours, with no resize',async()=>{
  const f=browserFixture({width:30,height:20}),p=[{x:10,y:7},{x:14,y:7},{x:14,y:10},{x:10,y:10}];
  const result=await f.api.rectify(f.href,{corners:p,width:4,height:3});assert.deepEqual(f.draws,[[-9,-6]]);assert.equal(result.audit.preview,false);
  assert.deepEqual(Array.from(f.encodedPixels[0].data),Array.from(image(4,3,(x,y)=>[(x+10)*20,(y+7)*20,x+y+17,255]).data));assert.equal(f.live.count,0);
});
test('queued work snapshots corner coordinates instead of following mutable UI handles',async()=>{
  const f=browserFixture(),p=full(8,6),options={corners:p,width:8,height:6},pending=f.api.rectify(f.href,options);
  p[0].x=5;options.width=2;const result=await pending;assert.equal(result.width,8);assert.equal(result.audit.corners[0].x,0);assert.equal(result.audit.requestedOutputWidth,8);
});
test('cropped async perspective warp retains global source registration and the original homography',async()=>{
  const f=browserFixture({width:30,height:20}),truth=[1,.1,3,.05,.9,2,.002,.004,1],p=[[0,0],[8,0],[8,6],[0,6]].map(([x,y])=>map(truth,x,y));
  const result=await f.api.rectify(f.href,{corners:p,width:8,height:6});result.audit.H.forEach((v,i)=>close(v,truth[i]));
  const data=f.encodedPixels[0].data;
  for(let y=0;y<6;y++)for(let x=0;x<8;x++){const s=map(truth,x+.5,y+.5),i=(y*8+x)*4;close(data[i],20*(s.x-.5),.5000001);close(data[i+1],20*(s.y-.5),.5000001);close(data[i+2],s.x+s.y-1,.5000001);assert.equal(data[i+3],255);}
  assert.deepEqual(f.draws,[[-2,-1]]);
});
test('async work is serial and bounded; decode abort clears resources and queued abort never decodes',async()=>{
  const f=browserFixture({delayDecode:true}),a=new AbortController(),b=new AbortController();
  const first=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6,signal:a.signal}),second=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6,signal:b.signal});
  const firstCheck=assert.rejects(first,e=>e.name==='AbortError'&&e.code==='ABORTED'),secondCheck=assert.rejects(second,e=>e.code==='ABORTED');
  await assert.rejects(f.api.rectify(f.href,{corners:full(8,6),width:8,height:6}),e=>e.code==='BUSY');
  for(let i=0;i<50&&!f.tasks.length;i++)await tick();assert.equal(f.tasks.length,1);b.abort();a.abort();await Promise.all([firstCheck,secondCheck]);assert.equal(f.live.count,0);assert.equal(f.live.peak,1);assert.equal(f.live.released,1);
  const next=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6});for(let i=0;i<50&&f.tasks.length<2;i++)await tick();f.tasks[1]();await next;assert.equal(f.live.count,0);assert.equal(f.live.peak,1);
});
test('async abort during warp prevents encode and leaves no decoded image or output side effects',async()=>{
  const f=browserFixture({width:16,height:16}),controller=new AbortController();
  await assert.rejects(f.api.rectify(f.href,{corners:full(16,16),width:16,height:16,signal:controller.signal,onProgress(e){if(e.stage==='warp')controller.abort();}}),e=>e.code==='ABORTED');
  assert.equal(f.encodedPixels.length,0);assert.equal(f.live.count,0);assert.ok(f.canvases.every(c=>c.width===1&&c.height===1));
});
test('abort on the encode boundary does not allocate or write an output canvas',async()=>{
  const f=browserFixture(),controller=new AbortController();await assert.rejects(f.api.rectify(f.href,{corners:full(8,6),width:8,height:6,signal:controller.signal,onProgress(e){if(e.stage==='encode'&&e.completed===0)controller.abort();}}),e=>e.code==='ABORTED');assert.equal(f.encodedPixels.length,0);assert.equal(f.live.count,0);assert.equal(f.canvases.length,1);
});
test('async source guard never fetches URLs and rejects malformed or unsupported sources before decode',async()=>{
  const f=browserFixture();for(const href of ['https://example.invalid/private.png','file:///private.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/gif;base64,R0lGODlh','data:image/png;base64,!!!'])await assert.rejects(f.api.rectify(href,{corners:full(8,6),width:8,height:6}),e=>e.code==='UNSUPPORTED_SOURCE');
  assert.equal(f.live.peak,0);
});

test('saved provenance rejects malformed geometry, wrong original pointers and altered encoded-byte hashes before restoration',async()=>{
  // Header/encoded-byte fixture only; real browser decoding is a separate test.
  const old=globalThis.StudioImageInsets;
  globalThis.StudioImageInsets=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
  try{
    const bytes=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes);bytes.writeUInt32BE(13,8);bytes.write('IHDR',12);bytes.writeUInt32BE(8,16);bytes.writeUInt32BE(6,20);bytes[24]=8;bytes[25]=6;
    const output=Buffer.from(bytes);output[32]=1;
    const hrefs={sourceHref:'data:image/png;base64,'+bytes.toString('base64'),outputHref:'data:image/png;base64,'+output.toString('base64')},hash=b=>crypto.createHash('sha256').update(b).digest('hex');
    const r={schema:'figure-studio-image-rectification/1',outputVariant:0,originalVariant:1,nonGenerative:true,displayOnly:true,quantitativeUse:false,calibrationInherited:false,preview:false,interpolation:'bilinear-premultiplied-alpha',sampleFormat:'browser-decoded uint8 RGBA display pixels',sourceMime:'image/png',sourceSha256:hash(bytes),outputSha256:hash(output),sourceWidth:8,sourceHeight:6,outputWidth:8,outputHeight:6,ratioMode:'estimate',estimatedRatio:true,ratioValue:8/6,corners:full(8,6),requestedWidth:8,requestedHeight:6,requestedOutputWidth:8,requestedOutputHeight:6,sourcePanelId:'panel-0',sourceVariant:0,sourceKey:'e1',H:rectify.homography(full(8,6),8,6)};
    assert.equal(rectify.validateRecord(r,hrefs),true);assert.equal(await rectify.verifyRecord(r,hrefs),true);
    const oldRuler=globalThis.StudioImageStraighten;
    try{
      globalThis.StudioImageStraighten=require('../skills/polish-sci-figures/assets/figure-studio/image-straighten.js');
      const straight=globalThis.StudioImageStraighten.fromRuler([{x:0,y:3},{x:8,y:3}],{width:8,height:6}).audit,withRuler={...r,straighten:straight,straightenRefined:false};
      assert.equal(rectify.validateRecord(withRuler,hrefs),true);
      throwsCode(()=>rectify.validateRecord({...withRuler,straighten:{...straight,rotationDegrees:10}},hrefs),'INVALID_RECORD');
      throwsCode(()=>rectify.validateRecord({...withRuler,straightenRefined:'false'},hrefs),'INVALID_RECORD');
    }finally{globalThis.StudioImageStraighten=oldRuler;}
    for(const patch of [{schema:'broken'},{originalVariant:0},{nonGenerative:false},{calibrationInherited:true},{corners:'wrong'},{H:[NaN]},{sourceWidth:7},{requestedWidth:7},{ratioValue:2},{sourceSha256:'wrong'}])throwsCode(()=>rectify.validateRecord({...r,...patch},hrefs),'INVALID_RECORD');
    await assert.rejects(rectify.verifyRecord({...r,sourceSha256:'0'.repeat(64)},hrefs),e=>e.code==='INVALID_RECORD');
    await assert.rejects(rectify.verifyRecord(r,{...hrefs,sourceHref:hrefs.outputHref}),e=>e.code==='INVALID_RECORD');
  }finally{globalThis.StudioImageInsets=old;}
});
async function readyWorker(f){for(let i=0;i<100&&!f.background.workers.length;i++)await tick();assert.equal(f.background.workers.length,1);return f.background.workers[0];}
function replyPixels(f,worker,changes={}){const q=worker.input,pixels=image(q.width,q.height,(x,y)=>Array.from(f.raw.data.slice(((y+q.top)*f.raw.width+x+q.left)*4,((y+q.top)*f.raw.width+x+q.left)*4+4)));worker.onmessage?.({data:{ok:true,sourceWidth:f.raw.width,sourceHeight:f.raw.height,left:q.left,top:q.top,width:q.width,height:q.height,buffer:pixels.data.buffer,...changes}});}
test('worker ROI retains original integer neighbours, crop offsets, pixel registration, hashes and numerical sampler',async()=>{
  const f=browserFixture({width:30,height:20,workerOptions:{}}),p=[{x:10,y:7},{x:14,y:7},{x:14,y:10},{x:10,y:10}],pending=f.api.rectify(f.href,{corners:p,width:4,height:3}),worker=await readyWorker(f);
  assert.deepEqual({...worker.input},{href:f.href,sourceWidth:30,sourceHeight:20,left:9,top:6,width:6,height:5});replyPixels(f,worker);const result=await pending;
  assert.deepEqual(Array.from(f.encodedPixels[0].data),Array.from(image(4,3,(x,y)=>[(x+10)*20,(y+7)*20,x+y+17,255]).data));assert.equal(result.audit.sourceSha256,crypto.createHash('sha256').update(f.sourceBytes).digest('hex'));assert.equal(result.audit.outputSha256,crypto.createHash('sha256').update(f.pngBytes).digest('hex'));
  assert.deepEqual({...result.audit.sourcePixelRead},{route:'local-worker-offscreen-unit-scale',left:9,top:6,width:6,height:5,scale:1});assert.equal(result.audit.interpolation,'bilinear-premultiplied-alpha');assert.equal(result.audit.quantitativeUse,false);assert.equal(f.draws.length,0);assert.equal(f.live.peak,0);assert.equal(f.reads.length,0);assert.equal(worker.terminated,1);assert.deepEqual(f.background.revoked,f.background.urls);assert.equal(f.background.timers.size,0);
});
test('core worker validates every source/ROI dimension, offset, buffer type and exact byte length',async()=>{
  for(const changes of [{sourceWidth:9},{sourceHeight:7},{left:1},{top:1},{width:7},{height:5},{buffer:new ArrayBuffer(4)},{buffer:new Uint8Array(8*6*4)},{ok:1}]){
    const f=browserFixture({workerOptions:{}}),pending=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6}),checked=assert.rejects(pending,e=>e.code==='WORKER_FAILED'),worker=await readyWorker(f);replyPixels(f,worker,changes);await checked;assert.equal(worker.terminated,1);assert.equal(f.live.peak,0);assert.equal(f.encodedPixels.length,0);assert.equal(f.background.timers.size,0);assert.deepEqual(f.background.revoked,f.background.urls);
  }
});
test('core worker CSP, error, messageerror and decode rejection never retry on the main thread',async()=>{
  for(const options of [{constructError:true},{postError:true},{}]){const f=browserFixture({workerOptions:options}),pending=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6}),checked=assert.rejects(pending,e=>e.code==='WORKER_FAILED'&&!e.message.includes(f.href));if(!options.constructError&&!options.postError)(await readyWorker(f)).onerror({preventDefault(){}});await checked;assert.equal(f.live.peak,0);assert.equal(f.encodedPixels.length,0);assert.deepEqual(f.background.revoked,f.background.urls);assert.ok(f.background.workers.every(w=>w.terminated===1));}
  const f=browserFixture({workerOptions:{}}),pending=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6}),checked=assert.rejects(pending,e=>e.code==='WORKER_FAILED');(await readyWorker(f)).onmessageerror({});await checked;
  const g=browserFixture({workerOptions:{}}),failed=g.api.rectify(g.href,{corners:full(8,6),width:8,height:6}),failure=assert.rejects(failed,e=>e.code==='DECODE_FAILED');(await readyWorker(g)).onmessage({data:{ok:false,code:'DECODE_FAILED'}});await failure;assert.equal(g.live.peak,0);
});
test('core worker Abort, 15s deadline and serial queue release all resources and discard late results',async()=>{
  const f=browserFixture({workerOptions:{}}),a=new AbortController(),b=new AbortController(),one=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6,signal:a.signal}),two=f.api.rectify(f.href,{corners:full(8,6),width:8,height:6,signal:b.signal}),oneCheck=assert.rejects(one,e=>e.code==='ABORTED'),twoCheck=assert.rejects(two,e=>e.code==='ABORTED'),worker=await readyWorker(f),late=worker.onmessage;
  assert.equal([...f.background.timers.keys()][0].ms,15000);await assert.rejects(f.api.rectify(f.href,{corners:full(8,6),width:8,height:6}),e=>e.code==='BUSY');b.abort();a.abort();await Promise.all([oneCheck,twoCheck]);late({data:{ok:true}});assert.equal(f.background.workers.length,1);assert.equal(worker.terminated,1);assert.equal(f.background.timers.size,0);assert.equal(f.encodedPixels.length,0);assert.deepEqual(f.background.revoked,f.background.urls);
  const g=browserFixture({workerOptions:{}}),timed=g.api.rectify(g.href,{corners:full(8,6),width:8,height:6}),timeout=assert.rejects(timed,e=>e.code==='WORKER_TIMEOUT'),timedWorker=await readyWorker(g);[...g.background.timers.values()][0]();await timeout;assert.equal(timedWorker.terminated,1);assert.equal(g.background.timers.size,0);assert.equal(g.encodedPixels.length,0);assert.deepEqual(g.background.revoked,g.background.urls);
});
async function sourceWorkerBody({changes={},wrongDimensions=false,pixelFailure=false}={}){
  const f=browserFixture({width:30,height:20,workerOptions:{}}),controller=new AbortController(),pending=f.api.rectify(f.href,{corners:full(30,20),width:30,height:20,signal:controller.signal}),checked=assert.rejects(pending,e=>e.code==='ABORTED');await readyWorker(f);controller.abort();await checked;
  const messages=[],calls=[],bitmaps=[],targets=[],request={href:f.href,sourceWidth:30,sourceHeight:20,left:9,top:6,width:6,height:5,...changes};
  const context={self:{postMessage(value,transfer){messages.push({value,transfer});}},Uint8Array,Uint8ClampedArray,Blob,atob,createImageBitmap:async(...args)=>{calls.push(args);const bitmap={width:wrongDimensions?20:30,height:20,closed:0,close(){this.closed++;}};bitmaps.push(bitmap);return bitmap;},OffscreenCanvas:class{constructor(w,h){this.width=w;this.height=h;targets.push(this);}getContext(){return {drawImage(...args){calls.push(args);assert.equal(args.length,3,'No resize or destination scaling arguments');assert.equal(args[1],-9);assert.equal(args[2],-6);},getImageData(x,y,w,h){if(pixelFailure)throw Error('controlled read failure');assert.deepEqual([x,y,w,h],[0,0,6,5]);return image(w,h);}};}}};
  vm.createContext(context);vm.runInContext(f.background.programs[0],context);await context.self.onmessage({data:request});return {messages,calls,bitmaps,targets};
}
test('actual worker body uses one original bitmap and exact unit-scale translation without resize; closes bitmap and canvas on error',async()=>{
  const result=await sourceWorkerBody();assert.equal(result.messages[0].value.ok,true);assert.equal(result.calls[0].length,1,'createImageBitmap receives no resize options');assert.equal(result.calls.length,2);assert.equal(result.messages[0].value.buffer.byteLength,6*5*4);assert.equal(result.messages[0].transfer[0],result.messages[0].value.buffer);assert.ok(result.bitmaps.every(b=>b.closed===1));assert.ok(result.targets.every(c=>c.width===1&&c.height===1));
  for(const options of [{wrongDimensions:true},{pixelFailure:true}]){const failed=await sourceWorkerBody(options);assert.equal(failed.messages[0].value.ok,false);assert.ok(failed.bitmaps.every(b=>b.closed===1));assert.ok(failed.targets.every(c=>c.width===1&&c.height===1));if(options.wrongDimensions)assert.equal(failed.calls.length,1);}
});
test('ROI worker repeats embedded-only, source32MP and integer crop bounds before any bitmap decode',async()=>{
  for(const changes of [{href:'https://example.invalid/private.jpg'},{href:'data:image/svg+xml;base64,PHN2Zy8+'},{href:'data:image/png;base64,'+'A'.repeat(28000001)},{sourceWidth:8000,sourceHeight:5000},{sourceHeight:NaN},{left:-1},{top:.5},{width:0},{left:29,width:2},{top:19,height:2}]){const result=await sourceWorkerBody({changes});assert.equal(result.calls.length,0);assert.equal(result.messages[0].value.ok,false);assert.deepEqual(Object.keys(result.messages[0].value).sort(),['code','ok']);}
});
