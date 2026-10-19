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
function browserFixture({delayed=false}={}){
  const href='data:image/png;base64,aW1hZ2UtZml4dHVyZQ==',tasks=[],draws=[],canvases=[],live={count:0,peak:0};
  class FakeImage{constructor(){this.naturalWidth=5712;this.naturalHeight=4284;this.active=false;}set src(value){if(!value){if(this.active){this.active=false;live.count--;}return;}this.active=true;live.count++;live.peak=Math.max(live.peak,live.count);const done=()=>this.onload?.();if(delayed)tasks.push(done);else setTimeout(done,0);}}
  const context={Uint8Array,Uint8ClampedArray,setTimeout,clearTimeout,performance,Image:FakeImage,StudioImageInsets:{dimensionsFromHref(value){assert.equal(value,href);return {widthPx:5712,heightPx:4284};}},document:{createElement(tag){assert.equal(tag,'canvas');const target={width:0,height:0,getContext(){return {drawImage(...args){draws.push(args.slice(1));},getImageData(x,y,w,h){assert.ok(w<=640&&h<=640);return full(w,h);}};}};canvases.push(target);return target;}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve(modulePath),'utf8')+'\nglobalThis.api=StudioImageRectifyDetect;',context);return {api:context.api,href,tasks,draws,canvases,live};
}
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('browser entry reads at most a 640 analysis raster from the full-resolution display source and releases resources',async()=>{
  const f=browserFixture(),result=await f.api.detect(f.href);assert.equal(result.sourceWidth,5712);assert.equal(result.sourceHeight,4284);assert.equal(result.audit.analysisWidth,640);assert.equal(result.audit.analysisHeight,480);assert.deepEqual(f.draws,[[0,0,640,480]]);assert.equal(f.live.count,0);assert.ok(f.canvases.every(c=>c.width===1&&c.height===1));
});
test('browser entry is serial, bounded and cancellable without decoding queued aborted work',async()=>{
  const f=browserFixture({delayed:true}),a=new AbortController(),b=new AbortController(),first=f.api.detect(f.href,{signal:a.signal}),second=f.api.detect(f.href,{signal:b.signal}),checkA=assert.rejects(first,e=>e.name==='AbortError'),checkB=assert.rejects(second,e=>e.name==='AbortError');
  await assert.rejects(f.api.detect(f.href),e=>e.code==='BUSY');for(let i=0;i<50&&!f.tasks.length;i++)await tick();assert.equal(f.tasks.length,1);b.abort();a.abort();await Promise.all([checkA,checkB]);assert.equal(f.live.count,0);assert.equal(f.live.peak,1);assert.equal(f.canvases.length,0);
});
