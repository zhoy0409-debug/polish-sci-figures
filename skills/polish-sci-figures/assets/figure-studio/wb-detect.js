/* Bounded local display-image suggestions, never a quantitative measurement.
 * No network, automatic acceptance, or modification of acquisition bytes. */
'use strict';
const StudioWBDetect=(()=>{
  function analyze({width:w,height:h,data}){
    const at=(x,y)=>data[4*(y*w+x)]*.2126+data[4*(y*w+x)+1]*.7152+data[4*(y*w+x)+2]*.0722;
    const edges=[];for(let y=0;y<h;y+=3)for(let x=0;x<w;x+=3)if(x<w*.08||x>w*.92||y<h*.08||y>h*.92)edges.push(at(x,y));edges.sort((a,b)=>a-b);const bg=edges[Math.floor(edges.length/2)],dark=bg>=127,ink=new Float32Array(w*h);let saturated=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=at(x,y);ink[y*w+x]=Math.max(0,dark?bg-v:v-bg);if(v<1||v>254)saturated++;}
    const profile=angle=>{const p=new Float64Array(h),n=new Uint32Array(h),s=Math.tan(angle*Math.PI/180);for(let y=1;y<h-1;y++)for(let x=Math.floor(w*.08);x<w*.92;x++){const r=Math.round(y-(x-w/2)*s);if(r>=0&&r<h){p[r]+=ink[y*w+x];n[r]++;}}for(let y=0;y<h;y++)p[y]/=n[y]||1;return p;};
    const residual=p=>{const q=new Float64Array(p.length);for(let i=0;i<p.length;i++){let sum=0,n=0;for(let j=Math.max(0,i-12);j<=Math.min(p.length-1,i+12);j++){sum+=p[j];n++;}q[i]=Math.max(0,p[i]-sum/n);}return q;};
    function peaks(p,max){const values=[...p].sort((a,b)=>a-b),floor=values[Math.floor(values.length*.2)],noise=values[Math.floor(values.length*.4)]-floor,threshold=Math.max(2.5,noise*2,Math.max(...p)*.22),runs=[];let start=null;for(let i=2;i<p.length-2;i++){if(p[i]>threshold){if(start===null)start=i;}else if(start!==null){if(i-start>=2)runs.push({start,end:i,centre:(start+i-1)/2,strength:Math.max(...p.slice(start,i))});start=null;}}return runs.sort((a,b)=>b.strength-a.strength).slice(0,max).sort((a,b)=>a.centre-b.centre);}
    let best={angle:0,score:-1,profile:null};for(let angle=-6;angle<=6;angle+=.5){const p=residual(profile(angle)),score=p.reduce((n,v)=>n+v*v,0);if(score>best.score)best={angle,score,profile:p};}
    const bands=peaks(best.profile,16),xp=new Float64Array(w);for(let x=0;x<w;x++){let sum=0,n=0;for(const b of bands)for(let y=Math.max(0,b.start-2);y<Math.min(h,b.end+2);y++){sum+=ink[y*w+x];n++;}xp[x]=sum/(n||1);}const lanes=peaks(xp,24),centres=lanes.map(l=>l.centre);
    return {angle:best.angle,bands,lanes:lanes.map((l,i)=>({centre:l.centre,left:i?(centres[i-1]+l.centre)/2:Math.max(0,l.start-(l.end-l.start)/2),right:i<lanes.length-1?(l.centre+centres[i+1])/2:Math.min(w,l.end+(l.end-l.start)/2)})),audit:{algorithm:'local-projection-residual/1',polarity:dark?'dark-on-light':'light-on-dark',analysisWidth:w,analysisHeight:h,saturatedDisplayFraction:saturated/(w*h),angleSearchDegrees:[-6,6],confirmed:false,quantitative:false},status:bands.length&&lanes.length>=2?'suggestions':'manual-recommended'};
  }
  async function detect(href,{signal}={}){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const size=StudioImageInsets.dimensionsFromHref(href),scale=Math.min(1,768/Math.max(size.widthPx,size.heightPx)),w=Math.max(1,Math.round(size.widthPx*scale)),h=Math.max(1,Math.round(size.heightPx*scale)),bitmap=await createImageBitmap(await StudioWesternBlot.blob(href),{resizeWidth:w,resizeHeight:h,resizeQuality:'high'});
    const canvas=new OffscreenCanvas(w,h),ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);bitmap.close();const pixels=ctx.getImageData(0,0,w,h);canvas.width=canvas.height=1;
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');const url=URL.createObjectURL(new Blob(['onmessage=e=>{try{postMessage({value:('+analyze.toString()+')(e.data)})}catch(e){postMessage({error:String(e)})}}'],{type:'application/javascript'}));
    const result=await new Promise((resolve,reject)=>{let worker,timer;const finish=(v,e)=>{clearTimeout(timer);worker?.terminate();URL.revokeObjectURL(url);signal?.removeEventListener('abort',cancel);e?reject(e):resolve(v);},cancel=()=>finish(null,new DOMException('Cancelled','AbortError'));try{worker=new Worker(url);signal?.addEventListener('abort',cancel,{once:true});worker.onmessage=e=>e.data.error?finish(null,Error(e.data.error)):finish(e.data.value);worker.onerror=e=>finish(null,Error(e.message));timer=setTimeout(()=>finish(null,Error('Local WB detection timed out')),30000);worker.postMessage({width:w,height:h,data:pixels.data},[pixels.data.buffer]);}catch(e){finish(null,e);}});
    return {...result,bands:result.bands.map(b=>({...b,start:b.start/scale,end:b.end/scale,centre:b.centre/scale})),lanes:result.lanes.map(l=>({left:l.left/scale,right:l.right/scale,centre:l.centre/scale})),audit:{...result.audit,sourceWidth:size.widthPx,sourceHeight:size.heightPx,analysisScale:scale}};
  }
  return {detect,analyze};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioWBDetect;
