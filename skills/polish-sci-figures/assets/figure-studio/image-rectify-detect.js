/* Local edge-supported quadrilateral suggestions. This is a bounded geometric
 * heuristic, not semantic gel recognition or an image authenticity detector.
 * Every result requires manual review; physical aspect ratio is never inferred. */
'use strict';
const StudioImageRectifyDetect = (() => {
  const MAX_SIDE=640, MAX_PIXELS=MAX_SIDE*MAX_SIDE, MAX_SOURCE_PIXELS=32000000, MAX_URL=28000000;
  const MAX_EDGES=25000, MAX_LINES=32, MAX_QUADS=2400, MAX_CANDIDATES=5, CHUNK_MS=8, MIN_RANK=.82;
  const PI=Math.PI,cos=new Float64Array(180),sin=new Float64Array(180);
  for(let t=0;t<180;t++){cos[t]=Math.cos(t*PI/180);sin[t]=Math.sin(t*PI/180);}
  let pending=0,queue=Promise.resolve();
  const now=()=>globalThis.performance?.now?.()??Date.now(),yieldTask=()=>new Promise(resolve=>setTimeout(resolve,0));
  function error(code){const messages={ABORTED:'已取消边缘建议。 / Edge suggestions cancelled.',INVALID_INPUT:'图像像素或尺寸无效。 / Invalid image pixels or dimensions.',UNSUPPORTED_SOURCE:'仅支持嵌入的静态 PNG、JPEG 或 WebP。 / Use an embedded static PNG, JPEG or WebP.',SOURCE_LIMIT:'原图超过 3200 万像素或分析边长超过 640。 / Source exceeds 32 megapixels or analysis exceeds 640 pixels per side.',DECODE_FAILED:'无法可靠读取原图或展示方向。 / Cannot read the source pixels or display orientation.',UNAVAILABLE:'当前浏览器无法执行本地边缘建议。 / Local edge suggestions are unavailable in this browser.',BUSY:'正在分析另一张图片，请稍后再试。 / Another image is being analyzed; try again shortly.'};const e=new Error(messages[code]||messages.INVALID_INPUT);e.code=code;if(code==='ABORTED')e.name='AbortError';return e;}
  function check(signal){if(signal?.aborted)throw error('ABORTED');}
  function progress(fn,stage,completed,total){if(typeof fn==='function')fn({stage,completed,total,fraction:total?completed/total:0});}
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function area(p){let sum=0;for(let i=0;i<p.length;i++)sum+=p[i].x*p[(i+1)%p.length].y-p[(i+1)%p.length].x*p[i].y;return sum/2;}
  function canonical(points,width,height){
    if(points.some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>width||p.y>height))return null;
    const cx=points.reduce((n,p)=>n+p.x,0)/4,cy=points.reduce((n,p)=>n+p.y,0)/4,p=points.slice().sort((a,b)=>Math.atan2(a.y-cy,a.x-cx)-Math.atan2(b.y-cy,b.x-cx));
    if(area(p)<0)p.reverse();let first=0;for(let i=1;i<4;i++)if(p[i].x+p[i].y<p[first].x+p[first].y)first=i;const q=p.slice(first).concat(p.slice(0,first));
    const minimum=Math.min(width,height)*.08;
    for(let i=0;i<4;i++)if(cross(q[i],q[(i+1)%4],q[(i+2)%4])<=1e-5||Math.hypot(q[i].x-q[(i+1)%4].x,q[i].y-q[(i+1)%4].y)<minimum)return null;
    const fraction=area(q)/(width*height);return fraction>=.04&&fraction<=.95?q:null;
  }
  function intersection(a,b){const d=a.nx*b.ny-a.ny*b.nx;if(Math.abs(d)<.12)return null;return {x:(a.rho*b.ny-a.ny*b.rho)/d,y:(a.nx*b.rho-a.rho*b.nx)/d};}
  function overlap(a,b){
    let subject=a.slice();
    for(let i=0;i<4&&subject.length;i++){
      const start=b[i],end=b[(i+1)%4],out=[];let previous=subject.at(-1),prevInside=cross(start,end,previous)>=0;
      for(const current of subject){const inside=cross(start,end,current)>=0;if(inside!==prevInside){const dx=current.x-previous.x,dy=current.y-previous.y,ex=end.x-start.x,ey=end.y-start.y,det=dx*ey-dy*ex;if(Math.abs(det)>1e-10){const t=((start.x-previous.x)*ey-(start.y-previous.y)*ex)/det;out.push({x:previous.x+t*dx,y:previous.y+t*dy});}}if(inside)out.push(current);previous=current;prevInside=inside;}subject=out;
    }
    const common=Math.abs(area(subject));return common/(area(a)+area(b)-common);
  }
  async function analyze(image,{signal,onProgress,sourceWidth=image?.width,sourceHeight=image?.height}={}){
    check(signal);const w=image?.width,h=image?.height,data=image?.data;
    if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||!(data instanceof Uint8Array||data instanceof Uint8ClampedArray)||data.length!==w*h*4)throw error('INVALID_INPUT');
    if(w>MAX_SIDE||h>MAX_SIDE||w*h>MAX_PIXELS||!Number.isInteger(sourceWidth)||!Number.isInteger(sourceHeight)||sourceWidth<1||sourceHeight<1||sourceWidth>32767||sourceHeight>32767||sourceWidth*sourceHeight>MAX_SOURCE_PIXELS)throw error('SOURCE_LIMIT');
    const audit={schema:'figure-studio-rectification-suggestions/1',method:'Sobel / non-maximum suppression / hysteresis / orientation-constrained Hough / four-side support and contrast consistency',scoreMeaning:'Heuristic edge/contrast ranking, not a probability or accuracy estimate.',analysisWidth:w,analysisHeight:h,downsampled:w!==sourceWidth||h!==sourceHeight,physicalRatioInferred:false,manualConfirmationRequired:true,semanticContentIdentified:false,edgeCoordinateConvention:'analysis pixel centres x+0.5,y+0.5 mapped to original pixel boundaries',limits:{maxAnalysisSide:MAX_SIDE,maxVotingEdges:MAX_EDGES,maxLines:MAX_LINES,maxEvaluatedQuads:MAX_QUADS,maxCandidates:MAX_CANDIDATES},limitations:['Edges may identify an outer monitor frame, page, or another rectangular region.','No semantic gel recognition, physical ratio recovery, detail reconstruction, or independent accuracy claim.']};
    const done=(candidates,reason,extra={})=>{check(signal);return {sourceWidth,sourceHeight,candidates,audit:{...audit,...extra,reason}};};
    if(w<32||h<32)return done([],'image-too-small-for-four-edge-support');
    const total=w*h,gray=new Float32Array(total),gx=new Float32Array(total),gy=new Float32Array(total),magnitude=new Float32Array(total),opaque=new Uint8Array(total),hist=new Uint32Array(362);
    let clock=now();
    for(let y=0;y<h;y++){
      check(signal);for(let x=0;x<w;x++){const i=y*w+x,j=i*4;gray[i]=(77*data[j]+150*data[j+1]+29*data[j+2])/256;opaque[i]=data[j+3]>=230?1:0;}
      if(now()-clock>=CHUNK_MS){progress(onProgress,'edges',y,h*2);await yieldTask();clock=now();}
    }
    let nonzero=0;
    for(let y=2;y<h-2;y++){
      check(signal);for(let x=2;x<w-2;x++){
        const i=y*w+x;if(!opaque[i-w-1]||!opaque[i-w]||!opaque[i-w+1]||!opaque[i-1]||!opaque[i]||!opaque[i+1]||!opaque[i+w-1]||!opaque[i+w]||!opaque[i+w+1])continue;
        const a=gray[i-w-1],b=gray[i-w],c=gray[i-w+1],d=gray[i-1],e=gray[i+1],f=gray[i+w-1],g=gray[i+w],j=gray[i+w+1];
        gx[i]=-a+c-2*d+2*e-f+j;gy[i]=-a-2*b-c+f+2*g+j;const m=Math.hypot(gx[i],gy[i]);magnitude[i]=m;if(m>4){hist[Math.min(361,Math.floor(m/4))]++;nonzero++;}
      }
      if(now()-clock>=CHUNK_MS){progress(onProgress,'edges',h+y,h*2);await yieldTask();clock=now();}
    }
    if(nonzero<32)return done([],'insufficient-contrast',{edgeCount:0,lineCount:0,evaluatedQuads:0});
    let count=0,quantile=0;for(;quantile<hist.length;quantile++){count+=hist[quantile];if(count>=nonzero*.85)break;}
    const high=Math.max(32,quantile*4*.65),low=high*.4,nms=new Uint8Array(total),edge=new Uint8Array(total),work=new Int32Array(total);let tail=0;
    for(let y=3;y<h-3;y++){
      check(signal);for(let x=3;x<w-3;x++){
        const i=y*w+x,m=magnitude[i];if(m<low)continue;
        const ax=Math.abs(gx[i]),ay=Math.abs(gy[i]);let before,after;
        if(ay<=ax*.41421356){before=i-1;after=i+1;}else if(ax<=ay*.41421356){before=i-w;after=i+w;}else if(gx[i]*gy[i]>=0){before=i-w-1;after=i+w+1;}else{before=i-w+1;after=i+w-1;}
        if(m<magnitude[before]||m<magnitude[after])continue;nms[i]=1;if(m>=high){edge[i]=1;work[tail++]=i;}
      }
      if(now()-clock>=CHUNK_MS){await yieldTask();clock=now();}
    }
    for(let head=0;head<tail;head++){
      check(signal);const i=work[head];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const k=i+dy*w+dx;if(nms[k]&&!edge[k]){edge[k]=1;work[tail++]=k;}}
      if((head&1023)===0&&now()-clock>=CHUNK_MS){await yieldTask();clock=now();}
    }
    progress(onProgress,'edges',1,1);if(tail<32)return done([],'insufficient-connected-edges',{edgeCount:tail,lineCount:0,evaluatedQuads:0,highThreshold:high});
    const stride=Math.max(1,Math.ceil(tail/MAX_EDGES)),indices=[];for(let i=0;i<tail;i+=stride)indices.push(work[i]);
    const radius=Math.ceil(Math.hypot(w,h)/2),rhoBins=2*radius+1,accumulator=new Float32Array(180*rhoBins);
    clock=now();
    for(let k=0;k<indices.length;k++){
      check(signal);const i=indices[k],x=i%w+.5,y=Math.floor(i/w)+.5;let normal=Math.atan2(gy[i],gx[i])*180/PI;normal=(normal+180)%180;const theta=Math.round(normal),weight=Math.min(3,magnitude[i]/high);
      for(let delta=-6;delta<=6;delta++){const t=(theta+delta+180)%180,r=Math.round((x*cos[t]+y*sin[t])/2)+radius;accumulator[t*rhoBins+r]+=weight*(1-Math.abs(delta)*.075);}
      if((k&255)===0&&now()-clock>=CHUNK_MS){progress(onProgress,'lines',k,indices.length);await yieldTask();clock=now();}
    }
    const minimumVotes=Math.max(14,Math.min(w,h)*.12/stride),peaks=[];
    for(let t=0;t<180;t++){
      check(signal);for(let r=1;r<rhoBins-1;r++){const value=accumulator[t*rhoBins+r];if(value<minimumVotes||value<accumulator[t*rhoBins+r-1]||value<accumulator[t*rhoBins+r+1])continue;peaks.push({nx:cos[t],ny:sin[t],rho:(r-radius)*2,votes:value});}
      if(now()-clock>=CHUNK_MS){await yieldTask();clock=now();}
    }
    peaks.sort((a,b)=>b.votes-a.votes);const lines=[];
    for(const p of peaks){if(lines.some(q=>{const dot=p.nx*q.nx+p.ny*q.ny;return Math.abs(dot)>Math.cos(6*PI/180)&&Math.abs(p.rho-(dot>=0?q.rho:-q.rho))<8;}))continue;lines.push(p);if(lines.length>=MAX_LINES)break;}
    // Refine quantized Hough normals with a weighted orthogonal line fit to
    // nearby, similarly oriented edge samples; no new source pixels are made.
    for(const line of lines){
      let sw=0,sx=0,sy=0,sxx=0,syy=0,sxy=0;
      for(let k=0;k<indices.length;k++){
        const i=indices[k],x=i%w+.5,y=Math.floor(i/w)+.5,m=magnitude[i];if(Math.abs(line.nx*x+line.ny*y-line.rho)>4||Math.abs(line.nx*gx[i]+line.ny*gy[i])<m*.85)continue;
        const weight=Math.min(3,m/high);sw+=weight;sx+=weight*x;sy+=weight*y;sxx+=weight*x*x;syy+=weight*y*y;sxy+=weight*x*y;
      }
      if(sw>8){const x=sx/sw,y=sy/sw,xx=sxx/sw-x*x,yy=syy/sw-y*y,xy=sxy/sw-x*y,angle=.5*Math.atan2(2*xy,xx-yy);let nx=-Math.sin(angle),ny=Math.cos(angle);if(nx*line.nx+ny*line.ny<0){nx=-nx;ny=-ny;}const rho=nx*x+ny*y;if(nx*line.nx+ny*line.ny>Math.cos(5*PI/180)&&Math.abs(rho-line.rho)<7)Object.assign(line,{nx,ny,rho});}
      check(signal);if(now()-clock>=CHUNK_MS){await yieldTask();clock=now();}
    }
    progress(onProgress,'lines',1,1);
    const pairs=[];
    for(let a=0;a<lines.length;a++)for(let b=a+1;b<lines.length;b++){
      const p=lines[a],q=lines[b],dot=p.nx*q.nx+p.ny*q.ny;if(Math.abs(dot)<Math.cos(30*PI/180))continue;
      const sign=dot>=0?1:-1;if(Math.abs(p.rho-sign*q.rho)<Math.min(w,h)*.08)continue;
      let nx=p.nx+sign*q.nx,ny=p.ny+sign*q.ny,norm=Math.hypot(nx,ny);pairs.push({a,b,nx:nx/norm,ny:ny/norm});
    }
    const shapes=[];
    for(let i=0;i<pairs.length;i++){
      const a=pairs[i];for(let j=i+1;j<pairs.length;j++){
        const b=pairs[j];if(a.a===b.a||a.a===b.b||a.b===b.a||a.b===b.b||Math.abs(a.nx*b.nx+a.ny*b.ny)>Math.cos(35*PI/180))continue;
        const p=canonical([intersection(lines[a.a],lines[b.a]),intersection(lines[a.b],lines[b.a]),intersection(lines[a.b],lines[b.b]),intersection(lines[a.a],lines[b.b])],w,h);if(!p)continue;
        shapes.push({corners:p,votes:lines[a.a].votes+lines[a.b].votes+lines[b.a].votes+lines[b.b].votes});
      }
      check(signal);if(now()-clock>=CHUNK_MS){await yieldTask();clock=now();}
    }
    shapes.sort((a,b)=>b.votes-a.votes);const supported=[];let evaluated=0;
    function sideSupport(a,b){
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length,steps=Math.min(160,Math.max(12,Math.ceil(length/3)));let found=0;
      for(let i=0;i<steps;i++){
        const f=(i+.5)/steps,x=a.x+dx*f,y=a.y+dy*f;let hit=false;
        for(let offset=-4;offset<=4;offset++){const px=Math.floor(x+nx*offset),py=Math.floor(y+ny*offset);if(px<0||py<0||px>=w||py>=h)continue;const at=py*w+px;if(edge[at]&&Math.abs(gx[at]*nx+gy[at]*ny)>=magnitude[at]*.8){hit=true;break;}}
        if(hit)found++;
      }
      return found/steps;
    }
    function boundaryEvidence(points){
      const medians=[];
      for(let side=0;side<4;side++){
        const a=points[side],b=points[(side+1)%4],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length,ny=dx/length,values=[];
        // A genuine bounded region often has a consistent inside/outside
        // contrast on all four sides. This penalizes a mixed rectangle made
        // from unrelated long UI separators; it does not identify gel content.
        for(let step=0;step<40;step++){
          const f=(step+.5)/40,x=a.x+dx*f,y=a.y+dy*f;let difference=0,n=0;
          for(const radius of [5,9]){const ix=Math.floor(x+nx*radius),iy=Math.floor(y+ny*radius),ox=Math.floor(x-nx*radius),oy=Math.floor(y-ny*radius);if(ix<0||iy<0||ox<0||oy<0||ix>=w||ox>=w||iy>=h||oy>=h||!opaque[iy*w+ix]||!opaque[oy*w+ox])continue;difference+=gray[iy*w+ix]-gray[oy*w+ox];n++;}if(n)values.push(difference/n);
        }
        values.sort((a,b)=>a-b);medians.push(values.length?values[Math.floor(values.length/2)]:0);
      }
      const absolute=medians.map(Math.abs),sum=absolute.reduce((a,b)=>a+b,0),consistency=sum?Math.abs(medians.reduce((a,b)=>a+b,0))/sum:0,mean=sum/4,minimum=Math.min(...absolute);
      return {consistency,score:consistency*Math.min(1,mean/64)*(mean ? .5+.5*minimum/mean : 0)};
    }
    for(const shape of shapes.slice(0,MAX_QUADS)){
      check(signal);evaluated++;const supports=shape.corners.map((p,i)=>sideSupport(p,shape.corners[(i+1)%4])),mean=supports.reduce((a,b)=>a+b,0)/4,minimum=Math.min(...supports),fraction=area(shape.corners)/(w*h);
      if(minimum>=.4&&mean>=.68){
        const boundary=boundaryEvidence(shape.corners),perimeter=shape.corners.reduce((sum,p,i)=>sum+Math.hypot(p.x-shape.corners[(i+1)%4].x,p.y-shape.corners[(i+1)%4].y),0),compactness=Math.min(1,16*area(shape.corners)/(perimeter*perimeter));
        // Compactness is a soft ranking preference over very narrow UI bars,
        // not a recovered physical aspect ratio or a hard crop constraint.
        const score=mean*.45+minimum*.2+boundary.score*.2+compactness*.15;
        if(score>=MIN_RANK)supported.push({...shape,edgeSupport:supports,areaFraction:fraction,boundaryContrastEvidence:boundary.score,contrastConsistency:boundary.consistency,compactness,score});
      }
      if(now()-clock>=CHUNK_MS){progress(onProgress,'candidates',evaluated,Math.min(MAX_QUADS,shapes.length));await yieldTask();clock=now();}
    }
    supported.sort((a,b)=>b.score-a.score);const selected=[];
    for(const candidate of supported){if(selected.some(kept=>overlap(kept.corners,candidate.corners)>.88))continue;selected.push(candidate);if(selected.length===MAX_CANDIDATES)break;}
    const candidates=selected.map((c,i)=>({id:'edge-region-'+(i+1),corners:c.corners.map(p=>({x:p.x*sourceWidth/w,y:p.y*sourceHeight/h})),score:c.score,edgeSupport:c.edgeSupport,boundaryContrastEvidence:c.boundaryContrastEvidence,contrastConsistency:c.contrastConsistency,compactness:c.compactness,areaFraction:c.areaFraction,manualConfirmationRequired:true,label:'Edge-supported region '+(i+1)}));
    progress(onProgress,'candidates',1,1);
    return done(candidates,candidates.length?'edge-supported-candidates-require-manual-review':'no-four-sided-region-with-sufficient-edge-support',{edgeCount:tail,votingEdgeCount:indices.length,lineCount:lines.length,evaluatedQuads:evaluated,generatedQuads:shapes.length,highThreshold:high,lowThreshold:low,minimumMeanSideSupport:.68,minimumIndividualSideSupport:.4,minimumHeuristicRank:MIN_RANK,ambiguousTopCandidates:candidates.length>1&&candidates[0].score-candidates[1].score<.03,topRankGap:candidates.length>1?candidates[0].score-candidates[1].score:null});
  }
  function insets(){if(typeof StudioImageInsets!=='undefined')return StudioImageInsets;return globalThis.StudioImageInsets;}
  function decode(href,size,signal){return new Promise((resolve,reject)=>{
    check(signal);if(typeof Image!=='function'){reject(error('UNAVAILABLE'));return;}const image=new Image();let settled=false;
    const finish=e=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);image.onload=image.onerror=null;if(e){image.src='';reject(e);}else resolve(image);};
    const cancel=()=>finish(error('ABORTED')),timer=setTimeout(()=>finish(error('DECODE_FAILED')),15000);image.onload=()=>image.naturalWidth===size.widthPx&&image.naturalHeight===size.heightPx?finish():finish(error('DECODE_FAILED'));image.onerror=()=>finish(error('DECODE_FAILED'));signal?.addEventListener('abort',cancel,{once:true});image.src=href;
  });}
  async function work(href,{signal,onProgress,maxSide=MAX_SIDE}={}){
    check(signal);if(typeof href!=='string'||href.length>MAX_URL||!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(href)||!insets()?.dimensionsFromHref)throw error('UNSUPPORTED_SOURCE');
    if(!Number.isInteger(maxSide)||maxSide<32||maxSide>MAX_SIDE)throw error('SOURCE_LIMIT');let size;try{size=insets().dimensionsFromHref(href);}catch{throw error('UNSUPPORTED_SOURCE');}
    if(size.widthPx*size.heightPx>MAX_SOURCE_PIXELS)throw error('SOURCE_LIMIT');
    const scale=Math.min(1,maxSide/Math.max(size.widthPx,size.heightPx)),w=Math.max(1,Math.round(size.widthPx*scale)),h=Math.max(1,Math.round(size.heightPx*scale));
    let image=null,target=null;try{
      progress(onProgress,'decode',0,1);image=await decode(href,size,signal);check(signal);if(!globalThis.document?.createElement)throw error('UNAVAILABLE');
      target=document.createElement('canvas');target.width=w;target.height=h;const context=target.getContext('2d',{willReadFrequently:true});if(!context)throw error('UNAVAILABLE');context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';context.drawImage(image,0,0,w,h);const pixels=context.getImageData(0,0,w,h);target.width=target.height=1;target=null;image.src='';image=null;check(signal);progress(onProgress,'decode',1,1);
      return await analyze(pixels,{signal,onProgress,sourceWidth:size.widthPx,sourceHeight:size.heightPx});
    }finally{if(image)image.src='';if(target)target.width=target.height=1;}
  }
  function detect(href,options={}){
    if(options?.signal?.aborted)return Promise.reject(error('ABORTED'));if(pending>=2)return Promise.reject(error('BUSY'));pending++;
    const settings={...options},result=queue.then(()=>work(href,settings));queue=result.then(()=>{},()=>{});return result.finally(()=>{pending--;});
  }
  return {detect,detectPixels:analyze,limits:Object.freeze({maxSide:MAX_SIDE,maxPixels:MAX_PIXELS,maxSourcePixels:MAX_SOURCE_PIXELS,maxCandidates:MAX_CANDIDATES,maxVotingEdges:MAX_EDGES,maxLines:MAX_LINES,maxEvaluatedQuads:MAX_QUADS,chunkBudgetMs:CHUNK_MS})};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageRectifyDetect;
