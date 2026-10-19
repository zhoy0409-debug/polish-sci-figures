/* Local, non-generative planar rectification of a display raster. The caller
 * retains the original encoded source and owns preview/history transactions.
 * Coordinates refer to pixel boundaries, not pixel centre indices. */
'use strict';
const StudioImageRectify = (() => {
  const MAX_SIDE=4096, MAX_PIXELS=12000000, MAX_SOURCE_PIXELS=32000000, MAX_SOURCE_SIDE=32767;
  const MAX_URL=28000000, MAX_UPSCALE=2, CHUNK_MS=8, MAX_PENDING=2;
  const MESSAGES={
    INVALID_QUAD:['请按左上、右上、右下、左下选择四个角。','Select four corners in top-left, top-right, bottom-right, bottom-left order.'],
    OUT_OF_BOUNDS:['四个角必须位于原图边界内。','Corners must be inside the original image boundaries.'],
    DEGENERATE_QUAD:['四角不能交叉、重合、反向或近乎共线。','Corners must form a non-degenerate, clockwise convex quadrilateral.'],
    INVALID_SIZE:['输出尺寸或宽高比无效。','The output size or aspect ratio is invalid.'],
    OUTPUT_LIMIT:['输出最多为 4096 像素边长、1200 万像素。','Output is limited to 4096 pixels per side and 12 megapixels.'],
    ENCODE_LIMIT:['输出 PNG 过大，请减小输出宽度（数据地址上限 2800 万字符）。','The output PNG is too large; reduce its width (28 million data URL character limit).'],
    UPSCALE_LIMIT:['输出尺寸过大；每个方向最多放大至所选边长的两倍。','Output cannot exceed twice the selected edge length in either direction.'],
    UNSUPPORTED_SOURCE:['仅支持工程中嵌入的静态 PNG、JPEG 或 WebP 原图。','Use an embedded static PNG, JPEG or WebP source.'],
    SOURCE_LIMIT:['原图超过本地校正上限：3200 万像素或数据地址 2800 万字符。','The source exceeds the local limit of 32 megapixels or 28 million data URL characters.'],
    DECODE_FAILED:['无法可靠读取原图像素或方向。','The source pixels or orientation could not be read reliably.'],
    SINGULAR_HOMOGRAPHY:['四角变换不稳定或穿过投影无穷远，请重新选择。','The projective mapping is unstable or crosses a projective pole.'],
    BUSY:['正在校正其他图片，请稍后重试。','Another image is being rectified; try again shortly.'],
    UNAVAILABLE:['当前浏览器不支持本地图片校正。','This browser does not support local image rectification.'],
    ABORTED:['已取消图片校正。','Image rectification was cancelled.']
  };
  let pending=0, queue=Promise.resolve();
  function error(code){const text=MESSAGES[code]||MESSAGES.DECODE_FAILED,e=new Error(text.join(' / '));e.code=code;if(code==='ABORTED')e.name='AbortError';return e;}
  function fail(code){throw error(code);}
  function aborted(signal){if(signal?.aborted)fail('ABORTED');}
  const finite=Number.isFinite, distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
  function sourceSize(width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)fail('INVALID_SIZE');
    if(width>MAX_SOURCE_SIDE||height>MAX_SOURCE_SIDE||width*height>MAX_SOURCE_PIXELS)fail('SOURCE_LIMIT');
  }
  function destinationSize(width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)fail('INVALID_SIZE');
    if(width>MAX_SIDE||height>MAX_SIDE||width*height>MAX_PIXELS)fail('OUTPUT_LIMIT');
  }
  function quad(points){
    if(!Array.isArray(points)||points.length!==4||points.some(p=>!p||typeof p!=='object'||!finite(p.x)||!finite(p.y)))fail('INVALID_QUAD');
    const p=points.map(({x,y})=>({x,y})),extent=Math.max(...p.map(v=>v.x))-Math.min(...p.map(v=>v.x)),vertical=Math.max(...p.map(v=>v.y))-Math.min(...p.map(v=>v.y));
    const scale=Math.max(extent,vertical),epsilon=Math.max(1e-12,scale*scale*1e-10);
    if(!finite(scale)||scale<=1e-6)fail('DEGENERATE_QUAD');
    for(let i=0;i<4;i++){
      const a=p[i],b=p[(i+1)%4],c=p[(i+2)%4],cross=(b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x);
      // Positive winding in image coordinates (y increases downwards). This
      // rejects concavity, crossings and mirrors without silently sorting.
      if(!finite(cross)||cross<=epsilon||distance(a,b)<=1e-6)fail('DEGENERATE_QUAD');
    }
    return p;
  }
  function validateQuad(points,{width,height}={}){
    sourceSize(width,height);const p=quad(points);
    if(p.some(v=>v.x<0||v.y<0||v.x>width||v.y>height))fail('OUT_OF_BOUNDS');
    homography(p,1,1);
    return p;
  }
  function edges(p){return {horizontal:Math.max(distance(p[0],p[1]),distance(p[3],p[2])),vertical:Math.max(distance(p[0],p[3]),distance(p[1],p[2])),meanWidth:(distance(p[0],p[1])+distance(p[3],p[2]))/2,meanHeight:(distance(p[0],p[3])+distance(p[1],p[2]))/2};}
  function checkUpscale(p,width,height){const edge=edges(p);if(width>edge.horizontal*MAX_UPSCALE+1e-8||height>edge.vertical*MAX_UPSCALE+1e-8)fail('UPSCALE_LIMIT');}
  function outputSize(points,{width,height,ratio='estimate',widthPx}={}){
    const p=validateQuad(points,{width,height}),edge=edges(p),estimatedRatio=ratio==='estimate';
    const aspect=estimatedRatio?edge.meanWidth/edge.meanHeight:ratio;
    if(typeof aspect!=='number'||!finite(aspect)||aspect<=0)fail('INVALID_SIZE');
    let w,h;
    if(widthPx!==undefined){
      if(!Number.isInteger(widthPx)||widthPx<1)fail('INVALID_SIZE');w=widthPx;h=Math.max(1,Math.round(w/aspect));
    }else{
      // Estimate is a display convenience, never recovery of a physical ratio.
      let natural=Math.max(1,edge.meanWidth);
      natural=Math.min(natural,MAX_SIDE,MAX_SIDE*aspect,Math.sqrt(MAX_PIXELS*aspect),edge.vertical*MAX_UPSCALE*aspect);
      w=Math.max(1,Math.floor(natural));h=Math.max(1,Math.round(w/aspect));
      // Rounding at a limit can add one row; reduce the automatic size only.
      while((w>MAX_SIDE||h>MAX_SIDE||w*h>MAX_PIXELS)&&w>1){w--;h=Math.max(1,Math.round(w/aspect));}
    }
    if(w/aspect<1)fail('INVALID_SIZE');
    destinationSize(w,h);checkUpscale(p,w,h);
    return {width:w,height:h,ratio:aspect,estimatedRatio};
  }
  function homography(points,width,height){
    destinationSize(width,height);const p=quad(points),[a,b,c,d]=p;
    const dx1=b.x-c.x,dx2=d.x-c.x,dx3=a.x-b.x+c.x-d.x,dy1=b.y-c.y,dy2=d.y-c.y,dy3=a.y-b.y+c.y-d.y;
    let g=0,h=0;
    if(Math.abs(dx3)+Math.abs(dy3)>1e-12){
      const det=dx1*dy2-dx2*dy1,scale=Math.max(Math.abs(dx1),Math.abs(dx2),Math.abs(dy1),Math.abs(dy2));
      if(!finite(det)||Math.abs(det)<=Math.max(1e-14,scale*scale*1e-12))fail('SINGULAR_HOMOGRAPHY');
      g=(dx3*dy2-dx2*dy3)/det;h=(dx1*dy3-dx3*dy1)/det;
    }
    const H=[(b.x-a.x+g*b.x)/width,(d.x-a.x+h*d.x)/height,a.x,(b.y-a.y+g*b.y)/width,(d.y-a.y+h*d.y)/height,a.y,g/width,h/height,1];
    const den=[1,1+g,1+g+h,1+h],max=Math.max(...den.map(Math.abs));
    if(H.some(v=>!finite(v))||den.some(v=>v<=max*1e-9))fail('SINGULAR_HOMOGRAPHY');
    // Verify the independent corner equations after the analytical solve.
    for(let i=0;i<4;i++){
      const x=(i===1||i===2)?width:0,y=i>=2?height:0,z=H[6]*x+H[7]*y+1;
      if(Math.hypot((H[0]*x+H[1]*y+H[2])/z-p[i].x,(H[3]*x+H[4]*y+H[5])/z-p[i].y)>Math.max(1e-7,Math.max(...p.map(v=>Math.abs(v.x)+Math.abs(v.y)))*1e-9))fail('SINGULAR_HOMOGRAPHY');
    }
    return H;
  }
  function pixelData(imageData){
    if(!imageData||!Number.isInteger(imageData.width)||!Number.isInteger(imageData.height))fail('INVALID_SIZE');
    sourceSize(imageData.width,imageData.height);
    const data=imageData.data;
    if(!(data instanceof Uint8ClampedArray)&&!(data instanceof Uint8Array))fail('DECODE_FAILED');
    if(data.length!==imageData.width*imageData.height*4)fail('DECODE_FAILED');return imageData;
  }
  function sampler(imageData,p,size,offset={x:0,y:0},originalSize=imageData){
    const H=homography(p,size.width,size.height),data=imageData.data,iw=imageData.width,ih=imageData.height;
    const out={width:size.width,height:size.height,data:new Uint8ClampedArray(size.width*size.height*4)};
    const identity=offset.x===0&&offset.y===0&&iw===size.width&&ih===size.height&&p.every((v,i)=>v.x===[0,iw,iw,0][i]&&v.y===[0,0,ih,ih][i]);
    function rows(first,last){
      if(identity){out.data.set(data.subarray(first*iw*4,last*iw*4),first*iw*4);return;}
      for(let y=first;y<last;y++){
        const cy=y+.5,ax=H[1]*cy+H[2],ay=H[4]*cy+H[5],az=H[7]*cy+1;
        for(let x=0;x<size.width;x++){
          const cx=x+.5,z=H[6]*cx+az;
          if(!finite(z)||Math.abs(z)<1e-12)fail('SINGULAR_HOMOGRAPHY');
          const bx=(H[0]*cx+ax)/z,by=(H[3]*cx+ay)/z;
          // A valid convex footprint never needs invented outside pixels.
          if(!finite(bx)||!finite(by)||bx< -1e-6||by< -1e-6||bx>originalSize.width+1e-6||by>originalSize.height+1e-6)fail('OUT_OF_BOUNDS');
          const sx=Math.max(0,Math.min(iw-1,bx-.5-offset.x)),sy=Math.max(0,Math.min(ih-1,by-.5-offset.y));
          const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(iw-1,x0+1),y1=Math.min(ih-1,y0+1),fx=sx-x0,fy=sy-y0;
          const i00=(y0*iw+x0)*4,i10=(y0*iw+x1)*4,i01=(y1*iw+x0)*4,i11=(y1*iw+x1)*4;
          const w00=(1-fx)*(1-fy)*data[i00+3],w10=fx*(1-fy)*data[i10+3],w01=(1-fx)*fy*data[i01+3],w11=fx*fy*data[i11+3],alpha=w00+w10+w01+w11;
          const r=w00*data[i00]+w10*data[i10]+w01*data[i01]+w11*data[i11],g=w00*data[i00+1]+w10*data[i10+1]+w01*data[i01+1]+w11*data[i11+1],b=w00*data[i00+2]+w10*data[i10+2]+w01*data[i01+2]+w11*data[i11+2];
          const at=(y*size.width+x)*4;
          out.data[at]=alpha>0?r/alpha:0;out.data[at+1]=alpha>0?g/alpha:0;out.data[at+2]=alpha>0?b/alpha:0;out.data[at+3]=alpha;
        }
      }
    }
    return {out,H,rows};
  }
  function warpPixels(imageData,points,{width,height}={},options={}){
    pixelData(imageData);const p=validateQuad(points,imageData);destinationSize(width,height);checkUpscale(p,width,height);aborted(options.signal);
    const job=sampler(imageData,p,{width,height});for(let y=0;y<height;y++){aborted(options.signal);job.rows(y,y+1);}return job.out;
  }
  const now=()=>globalThis.performance?.now?.()??Date.now(),yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
  function progress(callback,stage,completed,total){if(typeof callback==='function')callback({stage,completed,total,fraction:total?completed/total:0});}
  function insetsApi(){if(typeof StudioImageInsets!=='undefined')return StudioImageInsets;return globalThis.StudioImageInsets;}
  function source(href){
    if(typeof href!=='string'||href.length>MAX_URL)fail(typeof href==='string'?'SOURCE_LIMIT':'UNSUPPORTED_SOURCE');
    const match=href.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z\d+/=\s]+)$/);
    if(!match||!insetsApi()?.dimensionsFromHref)fail('UNSUPPORTED_SOURCE');
    let dimensions;try{dimensions=insetsApi().dimensionsFromHref(href);}catch(e){if(e.code==='pixels')fail('DECODE_FAILED');fail('UNSUPPORTED_SOURCE');}
    sourceSize(dimensions.widthPx,dimensions.heightPx);
    return {width:dimensions.widthPx,height:dimensions.heightPx,mime:'image/'+match[1],base64:match[2]};
  }
  async function hashSource(base64,signal){
    aborted(signal);if(!globalThis.crypto?.subtle||typeof atob!=='function')fail('UNAVAILABLE');
    let binary;try{binary=atob(base64.replace(/\s/g,''));}catch{fail('UNSUPPORTED_SOURCE');}
    const bytes=new Uint8Array(binary.length);
    for(let start=0;start<binary.length;start+=262144){aborted(signal);const end=Math.min(binary.length,start+262144);for(let i=start;i<end;i++)bytes[i]=binary.charCodeAt(i);await yieldTask();}
    binary=null;const digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);aborted(signal);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  }
  function decode(href,dimensions,signal){
    return new Promise((resolve,reject)=>{
      aborted(signal);if(typeof Image!=='function'){reject(error('UNAVAILABLE'));return;}
      const image=new Image();image.decoding='async';let settled=false;
      const finish=(e)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);image.onload=image.onerror=null;if(e){image.src='';reject(e);}else resolve(image);};
      const cancel=()=>finish(error('ABORTED')),timer=setTimeout(()=>finish(error('DECODE_FAILED')),15000);
      image.onload=async()=>{if(image.naturalWidth!==dimensions.width||image.naturalHeight!==dimensions.height)return finish(error('DECODE_FAILED'));try{if(typeof image.decode==='function')await image.decode();aborted(signal);finish();}catch(e){finish(e?.code?e:error('DECODE_FAILED'));}};
      image.onerror=()=>finish(error('DECODE_FAILED'));signal?.addEventListener('abort',cancel,{once:true});image.src=href;
    });
  }
  function canvas(width,height){
    if(!globalThis.document?.createElement)fail('UNAVAILABLE');const result=document.createElement('canvas');result.width=width;result.height=height;return result;
  }
  async function encode(output,signal){
    aborted(signal);
    const target=canvas(output.width,output.height);
    try{
      const context=target.getContext('2d');if(!context||typeof ImageData!=='function')fail('UNAVAILABLE');
      context.putImageData(new ImageData(output.data,output.width,output.height),0,0);aborted(signal);
      const blob=await new Promise((resolve,reject)=>{if(!target.toBlob){reject(error('UNAVAILABLE'));return;}target.toBlob(value=>value?resolve(value):reject(error('DECODE_FAILED')),'image/png');});
      aborted(signal);
      if(blob.size*4/3+64>MAX_URL)fail('ENCODE_LIMIT');
      if(!globalThis.crypto?.subtle||typeof blob.arrayBuffer!=='function')fail('UNAVAILABLE');
      const digest=await globalThis.crypto.subtle.digest('SHA-256',await blob.arrayBuffer());aborted(signal);
      const outputSha256=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
      const href=await new Promise((resolve,reject)=>{
        if(typeof FileReader!=='function'){reject(error('UNAVAILABLE'));return;}const reader=new FileReader();
        const cancel=()=>{reader.abort();reject(error('ABORTED'));};
        const done=()=>signal?.removeEventListener('abort',cancel);
        reader.onload=()=>{done();resolve(reader.result);};reader.onerror=()=>{done();reject(error('DECODE_FAILED'));};reader.onabort=()=>{done();reject(error('ABORTED'));};
        signal?.addEventListener('abort',cancel,{once:true});reader.readAsDataURL(blob);
      });
      aborted(signal);if(typeof href!=='string'||!href.startsWith('data:image/png;base64,')||href.length>MAX_URL)fail('ENCODE_LIMIT');return {href,outputSha256};
    }finally{target.width=target.height=1;}
  }
  async function work(href,{corners,width,height,previewMaxSide,signal,onProgress}={}){
    aborted(signal);const dimensions=source(href),p=validateQuad(corners,dimensions);destinationSize(width,height);checkUpscale(p,width,height);
    const requestedOutputWidth=width,requestedOutputHeight=height;
    if(previewMaxSide!==undefined){
      if(!Number.isInteger(previewMaxSide)||previewMaxSide<1||previewMaxSide>MAX_SIDE)fail('INVALID_SIZE');
      const scale=Math.min(1,previewMaxSide/Math.max(width,height));width=Math.max(1,Math.round(width*scale));height=Math.max(1,Math.round(height*scale));
    }
    progress(onProgress,'decode',0,1);let sourceSha256=verifiedHashes.get(href);
    if(!sourceSha256){sourceSha256=await hashSource(dimensions.base64,signal);rememberHash(href,sourceSha256);}delete dimensions.base64;
    let image=null,input=null,inputCanvas=null;
    try{
      image=await decode(href,dimensions,signal);aborted(signal);
      // Include the one-pixel interpolation neighbourhood. Crop in original
      // coordinates without a resize, so a small ROI needs no full RGBA copy.
      const left=Math.max(0,Math.floor(Math.min(...p.map(v=>v.x))-.5)),top=Math.max(0,Math.floor(Math.min(...p.map(v=>v.y))-.5));
      const right=Math.min(dimensions.width,Math.ceil(Math.max(...p.map(v=>v.x))+.5)),bottom=Math.min(dimensions.height,Math.ceil(Math.max(...p.map(v=>v.y))+.5));
      inputCanvas=canvas(right-left,bottom-top);const context=inputCanvas.getContext('2d',{willReadFrequently:true});if(!context)fail('UNAVAILABLE');
      // The full original is drawn at unit scale with only a translation. No
      // thumbnail or analysis raster is substituted for the source.
      context.drawImage(image,-left,-top);
      const iw=right-left,ih=bottom-top;input={width:iw,height:ih,data:new Uint8ClampedArray(iw*ih*4)};
      // Read the same unit-scale pixels in bounded strips. Decoder work has
      // completed above; yield between reads so Escape and new drafts can run.
      let readRow=0;
      while(readRow<ih){
        aborted(signal);const start=now();
        do{const rows=Math.min(32,ih-readRow),strip=context.getImageData(0,readRow,iw,rows);input.data.set(strip.data,readRow*iw*4);readRow+=rows;}while(readRow<ih&&now()-start<CHUNK_MS);
        progress(onProgress,'decode',readRow,ih);if(readRow<ih)await yieldTask();
      }
      inputCanvas.width=inputCanvas.height=1;inputCanvas=null;image.src='';image=null;aborted(signal);progress(onProgress,'decode',1,1);
      const job=sampler(input,p,{width,height},{x:left,y:top},dimensions);let row=0;
      while(row<height){
        aborted(signal);const start=now();do{job.rows(row,row+1);row++;}while(row<height&&now()-start<CHUNK_MS);
        progress(onProgress,'warp',row,height);if(row<height)await yieldTask();
      }
      input=null;aborted(signal);progress(onProgress,'encode',0,1);await yieldTask();const encoded=await encode(job.out,signal);aborted(signal);progress(onProgress,'encode',1,1);
      return {href:encoded.href,width,height,sourceWidth:dimensions.width,sourceHeight:dimensions.height,audit:{schema:'figure-studio-image-rectification/1',sourceSha256,outputSha256:encoded.outputSha256,sourceMime:dimensions.mime,sourceWidth:dimensions.width,sourceHeight:dimensions.height,corners:p,H:job.H,outputWidth:width,outputHeight:height,requestedOutputWidth,requestedOutputHeight,preview:width!==requestedOutputWidth||height!==requestedOutputHeight,interpolation:'bilinear-premultiplied-alpha',antialiasing:'bilinear only; no area low-pass or reconstruction',boundaryConvention:'original/destination pixel boundaries 0..width and 0..height; sample destination centres x+0.5,y+0.5',sampleFormat:'browser-decoded uint8 RGBA display pixels',colorHandling:'browser default decode; no intensity or local adjustments',displayOnly:true,quantitativeUse:false,nonGenerative:true}};
    }catch(e){if(e?.code||e?.name==='AbortError')throw e;throw error('DECODE_FAILED');}
    finally{if(image)image.src='';if(inputCanvas)inputCanvas.width=inputCanvas.height=1;input=null;}
  }
  function rectify(href,options={}){
    if(!options||typeof options!=='object')return Promise.reject(error('INVALID_SIZE'));
    if(options.signal?.aborted)return Promise.reject(error('ABORTED'));
    if(pending>=MAX_PENDING)return Promise.reject(error('BUSY'));
    // Corner handles are mutable UI objects. Freeze the requested values at
    // invocation so queued work cannot acquire a later gesture's geometry.
    const request={...options,corners:Array.isArray(options.corners)?options.corners.map(p=>p&&typeof p==='object'?{x:p.x,y:p.y}:p):options.corners};
    pending++;const result=queue.catch(()=>{}).then(()=>work(href,request));queue=result.then(()=>{},()=>{});return result.finally(()=>{pending--;});
  }
  // Saved provenance controls which bytes can be used as the original on the
  // next edit. Check its geometry synchronously; imported payloads also verify
  // both encoded-byte hashes asynchronously before replacing the workspace.
  function validateRecord(record,{sourceHref,outputHref}={}){
    const bad=()=>{throw Object.assign(new Error('Invalid photo-correction record'),{code:'INVALID_RECORD'});};
    try{
      const r=record,s=source(sourceHref),o=source(outputHref);
      if(!r||r.schema!=='figure-studio-image-rectification/1'||r.outputVariant!==0||r.originalVariant!==1||r.nonGenerative!==true||r.displayOnly!==true||r.quantitativeUse!==false||r.calibrationInherited!==false||typeof r.preview!=='boolean'||r.interpolation!=='bilinear-premultiplied-alpha'||r.sampleFormat!=='browser-decoded uint8 RGBA display pixels'||r.sourceMime!==s.mime||o.mime!=='image/png'||!['sourceSha256','outputSha256'].every(k=>/^[a-f0-9]{64}$/.test(r[k]||'')))bad();
      if(r.sourceWidth!==s.width||r.sourceHeight!==s.height||r.outputWidth!==o.width||r.outputHeight!==o.height||!['estimate','fixed','custom'].includes(r.ratioMode)||r.estimatedRatio!==(r.ratioMode==='estimate')||!finite(r.ratioValue)||r.ratioValue<=0)bad();
      destinationSize(r.outputWidth,r.outputHeight);validateQuad(r.corners,s);
      const plan=outputSize(r.corners,{...s,ratio:r.estimatedRatio?'estimate':r.ratioValue,widthPx:r.requestedWidth});
      if(plan.width!==r.requestedWidth||plan.height!==r.requestedHeight||r.requestedOutputWidth!==r.requestedWidth||r.requestedOutputHeight!==r.requestedHeight||Math.abs(plan.ratio-r.ratioValue)>1e-10*Math.max(1,plan.ratio)||r.preview!==(r.outputWidth!==r.requestedWidth||r.outputHeight!==r.requestedHeight)||!/^panel-\d+$/.test(r.sourcePanelId)||!Number.isInteger(r.sourceVariant)||r.sourceVariant<0||!/^e\d+$/.test(r.sourceKey))bad();
      const expected=homography(r.corners,r.outputWidth,r.outputHeight);
      if(!Array.isArray(r.H)||r.H.length!==9||r.H.some((v,i)=>!finite(v)||Math.abs(v-expected[i])>1e-9*Math.max(1,Math.abs(expected[i]))))bad();
      if(r.straighten){
        const ruler=typeof StudioImageStraighten!=='undefined'?StudioImageStraighten:globalThis.StudioImageStraighten;
        if(!ruler||typeof r.straightenRefined!=='boolean')bad();
        const stored=r.straighten,planned=ruler.fromRuler(stored.rulerPoints,{width:s.width,height:s.height,bounds:stored.bounds,target:stored.target}).audit;
        const same=(a,b)=>typeof b==='number'?finite(a)&&Math.abs(a-b)<=1e-9*Math.max(1,Math.abs(b)):b&&typeof b==='object'?!!a&&typeof a==='object'&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>same(a[k],b[k])):a===b;
        if(!same(stored,planned)||!r.straightenRefined&&(!same(r.corners,planned.corners)||r.requestedWidth!==planned.outputWidth||r.requestedHeight!==planned.outputHeight))bad();
      }else if(r.straightenRefined!==undefined)bad();
      return true;
    }catch{bad();}
  }
  const verifiedHashes=new Map();
  function rememberHash(href,hash){verifiedHashes.set(href,hash);while(verifiedHashes.size>4)verifiedHashes.delete(verifiedHashes.keys().next().value);}
  async function verifyRecord(record,hrefs,options={}){
    validateRecord(record,hrefs);if(record.preview)throw Object.assign(new Error('A preview cannot be restored as a saved correction'),{code:'INVALID_RECORD'});
    for(const [href,key]of [[hrefs.sourceHref,'sourceSha256'],[hrefs.outputHref,'outputSha256']]){
      aborted(options.signal);let actual=verifiedHashes.get(href);
      if(!actual){actual=await hashSource(source(href).base64,options.signal);rememberHash(href,actual);}
      if(actual!==record[key])throw Object.assign(new Error('Photo-correction source or output hash does not match'),{code:'INVALID_RECORD'});
    }
    return true;
  }
  return {validateQuad,outputSize,homography,warpPixels,rectify,validateRecord,verifyRecord,limits:Object.freeze({maxSide:MAX_SIDE,maxPixels:MAX_PIXELS,maxSourcePixels:MAX_SOURCE_PIXELS,maxSourceSide:MAX_SOURCE_SIDE,maxDataUrlCharacters:MAX_URL,maxUpscale:MAX_UPSCALE,maxPending:MAX_PENDING,chunkBudgetMs:CHUNK_MS}),errorMessages:MESSAGES};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageRectify;
