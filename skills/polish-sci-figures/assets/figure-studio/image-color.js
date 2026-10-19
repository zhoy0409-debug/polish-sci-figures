/* Reversible, whole-image display adjustments. Source pixels are never replaced.
 * Automatic suggestions compare unsaturated near-white border backgrounds only;
 * they are not stain normalization or acquisition calibration. */
'use strict';
const StudioImageColor=(()=>{
  const NS='http://www.w3.org/2000/svg',MARK='data-studio-image-color',MAX_SIDE=384,MAX_PENDING=4;
  let queue=Promise.resolve(),pending=0,serial=0;
  const validatedHrefs=new WeakMap();
  const finite=Number.isFinite,fail=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
  const defaults={mode:'brightfield',strength:1,exposureEv:0,temperature:0,tint:0,contrast:1,whiteBalance:[1,1,1]};
  function validate(value){
    if(!value||typeof value!=='object'||Array.isArray(value))fail('parameters','图像显示参数无效。');
    if(Object.keys(value).some(k=>!['mode','strength','exposureEv','temperature','tint','contrast','whiteBalance','reference'].includes(k)))fail('parameters','图像显示参数含不支持的字段。');
    const a={...defaults,...value,whiteBalance:value.whiteBalance===undefined?[1,1,1]:value.whiteBalance};
    if(!['brightfield','fluorescence'].includes(a.mode))fail('parameters','请选择明场或荧光显示模式。');
    for(const [key,min,max] of [['strength',0,1],['exposureEv',-2,2],['temperature',-1,1],['tint',-1,1],['contrast',.5,1.5]])if(typeof a[key]!=='number'||!finite(a[key])||a[key]<min||a[key]>max)fail('parameters','图像显示参数超出允许范围。');
    if(!Array.isArray(a.whiteBalance)||a.whiteBalance.length!==3||a.whiteBalance.some(n=>typeof n!=='number'||!finite(n)||n<.5||n>2))fail('parameters','背景白平衡参数无效。');
    if(a.reference!==undefined&&(typeof a.reference!=='string'||a.reference.length>240||/[\x00-\x1f\x7f]/.test(a.reference)))fail('parameters','参考图片信息无效。');
    if(a.mode==='fluorescence'&&(a.temperature!==0||a.tint!==0||a.whiteBalance.some(n=>n!==1)))fail('fluorescence','荧光图仅支持共同的线性增益和对比度，不支持逐图白平衡。');
    // Fixed field order makes exported filter metadata independently verifiable.
    const result={mode:a.mode,strength:a.strength,exposureEv:a.exposureEv,temperature:a.temperature,tint:a.tint,contrast:a.contrast,whiteBalance:[...a.whiteBalance]};
    if(a.reference!==undefined)result.reference=a.reference;return result;
  }
  function coefficients(value){
    const a=validate(value),exposure=2**a.exposureEv,warm=[2**(.2*a.temperature),1,2**(-.2*a.temperature)],tint=[2**(.15*a.tint),2**(-.15*a.tint),2**(.15*a.tint)];
    return {slopes:a.whiteBalance.map((v,i)=>1+a.strength*(exposure*v*warm[i]*tint[i]*a.contrast-1)),intercept:a.strength*.18*(1-a.contrast)};
  }
  const toLinear=v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4;
  const toSrgb=v=>v<=.0031308?v*12.92:1.055*v**(1/2.4)-.055;
  function transform(rgb,value){const c=coefficients(value);return rgb.map((v,i)=>toSrgb(Math.max(0,Math.min(1,toLinear(v)*c.slopes[i]+c.intercept))));}
  const warning=(code,message)=>({code,message});
  function sample(imageData){
    const {width,height,data}=imageData||{};
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>MAX_SIDE||height>MAX_SIDE||!data||data.length!==width*height*4)fail('sample','图像采样尺寸无效。');
    const hist=[0,1,2].map(()=>Array(256).fill(0)),backgroundHist=[0,1,2].map(()=>Array(256).fill(0));
    const border=Math.max(1,Math.floor(Math.min(width,height)*.08)),sides=[0,0,0,0],eligibleSides=[0,0,0,0];let count=0,borderCount=0,backgroundCount=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const n=(y*width+x)*4;if(data[n+3]<250)continue;const rgb=[data[n],data[n+1],data[n+2]];
      if(rgb.some(v=>!Number.isInteger(v)||v<0||v>255))fail('sample','图像采样像素无效。');
      count++;rgb.forEach((v,i)=>hist[i][v]++);
      const edges=[y<border,x>=width-border,y>=height-border,x<border];if(!edges.some(Boolean))continue;
      borderCount++;edges.forEach((hit,i)=>{if(hit)sides[i]++;});
      // Exclude clipped whites and colorful tissue. Spatial border coverage is
      // checked as well; an isolated pale feature is not a white reference.
      if(Math.min(...rgb)<204||Math.max(...rgb)>251||Math.max(...rgb)-Math.min(...rgb)>31)continue;
      backgroundCount++;rgb.forEach((v,i)=>backgroundHist[i][v]++);edges.forEach((hit,i)=>{if(hit)eligibleSides[i]++;});
    }
    if(!count)fail('sample','没有可分析的不透明像素。');
    const quantile=(h,q)=>{let sum=0;for(let i=0;i<256;i++){sum+=h[i];if(sum>=Math.max(1,backgroundCount*q))return i/255;}return 0;};
    const rgb=backgroundHist.map(h=>quantile(h,.5)),spread=backgroundHist.map(h=>quantile(h,.9)-quantile(h,.1));
    const eligible=backgroundCount>=Math.max(24,borderCount*.1)&&sides.every((v,i)=>v>0&&eligibleSides[i]>=Math.max(4,v*.05))&&spread.every(n=>n<=.08);
    return {version:1,width,height,count,hist,background:{eligible,count:backgroundCount,fraction:backgroundCount/Math.max(1,borderCount),rgb,spread,borderCoverage:eligibleSides.map((n,i)=>n/Math.max(1,sides[i]))},warnings:[warning('sampled-display','分析基于原图的有界显示采样；裁切比例为预览估计。')]};
  }
  function validSample(s){
    if(!s||s.version!==1||!Number.isInteger(s.count)||s.count<1||s.count>MAX_SIDE*MAX_SIDE||!Array.isArray(s.hist)||s.hist.length!==3||s.hist.some(h=>!Array.isArray(h)||h.length!==256||h.some(v=>!Number.isInteger(v)||v<0)||h.reduce((n,v)=>n+v,0)!==s.count))fail('sample','图像采样摘要无效。');return s;
  }
  function estimateClipping(summary,value){
    const s=validSample(summary),c=coefficients(value);let low=0,high=0,additional=0;
    for(let ch=0;ch<3;ch++)for(let v=0;v<256;v++){const n=s.hist[ch][v],mapped=toLinear(v/255)*c.slopes[ch]+c.intercept;if(mapped<=0)low+=n;if(mapped>=1)high+=n;if(v>0&&v<255&&(mapped<0||mapped>1))additional+=n;}
    const total=s.count*3,warnings=[];if(additional/total>.001)warnings.push(warning('clipping','当前参数可能截断亮部或暗部细节，请降低强度或曝光。'));
    return {lowFraction:low/total,highFraction:high/total,additionalClippedFraction:additional/total,warnings};
  }
  // RGB channel histograms describe display values, never stain concentration
  // or biological signal. Keep the same bounded original sample for both views.
  function displayStatistics(summary,value=defaults){
    const s=validSample(summary),c=coefficients(value),before=Array(256).fill(0),after=Array(256).fill(0);
    for(let ch=0;ch<3;ch++)for(let v=0;v<256;v++){
      const n=s.hist[ch][v],mapped=toLinear(v/255)*c.slopes[ch]+c.intercept;
      const bin=Math.round(toSrgb(Math.max(0,Math.min(1,mapped)))*255);
      before[v]+=n;after[bin]+=n;
    }
    const total=s.count*3,clipping=estimateClipping(s,value);
    return {pixels:s.count,width:s.width,height:s.height,before,after,
      originalLowFraction:before[0]/total,originalHighFraction:before[255]/total,...clipping};
  }
  function suggest(target,reference){
    validSample(target);validSample(reference);
    for(const s of [target,reference])if(!s.background?.eligible||!Array.isArray(s.background.rgb)||s.background.rgb.length!==3||s.background.rgb.some(v=>!finite(v)||v<.8||v>251/255))fail('background','未找到足够且未饱和的近白背景，无法自动匹配；请使用手动预览。');
    const ratios=target.background.rgb.map((v,i)=>toLinear(reference.background.rgb[i])/toLinear(v));
    if(ratios.some(v=>v<.75||v>1.333333334))fail('background-difference','参考背景差异较大，未自动套用强校正；请使用手动预览。');
    const gain=(ratios[0]*ratios[1]*ratios[2])**(1/3),adjustment=validate({mode:'brightfield',exposureEv:Math.log2(gain),whiteBalance:ratios.map(v=>v/gain)});
    return {adjustment,warnings:[warning('estimated-background','建议仅匹配参考图的近白背景色与亮度，并非采集校准；请比较原图后确认。'),...estimateClipping(target,adjustment).warnings]};
  }
  // An explicit photo/brightfield display suggestion, never a detector of image
  // modality. Neutralization uses only the existing spatial near-white gate;
  // otherwise all channels receive the same conservative global adjustment.
  function suggestAuto(summary,{mode}={}){
    const s=validSample(summary);if(mode!=='brightfield')fail('auto-mode','请明确选择拍摄照片／明场展示用途；荧光图不提供单图自动校色。');
    const quantile=q=>{let n=0;const target=Math.max(1,Math.ceil(s.count*3*q));for(let value=0;value<256;value++){n+=s.hist[0][value]+s.hist[1][value]+s.hist[2][value];if(n>=target)return value/255;}return 1;};
    const low=quantile(.01),median=quantile(.5),high=quantile(.99),range=high-low;
    if(range<2/255)fail('auto-flat','有效显示变化不足，未自动增强；请使用手动预览。');
    const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),background=s.background;
    const backgroundEligible=background?.eligible===true&&Array.isArray(background.rgb)&&background.rgb.length===3&&background.rgb.every(v=>finite(v)&&v>=.8&&v<=251/255);
    let whiteBalance=[1,1,1],whiteBalanceApplied=false;
    if(backgroundEligible&&Math.max(...background.rgb)-Math.min(...background.rgb)>3/255){
      const linear=background.rgb.map(toLinear),neutral=(linear[0]*linear[1]*linear[2])**(1/3);
      whiteBalance=linear.map(v=>clamp(neutral/v,.94,1.06));whiteBalanceApplied=whiteBalance.some(v=>Math.abs(v-1)>1e-12);
    }
    const exposureEv=high>0&&high<.9&&median<.65?clamp(.2*Math.log2(toLinear(.9)/toLinear(high)),0,.12):0;
    const contrast=1+clamp((.85-range)*.12,0,.1);
    let adjustment,clipping;
    // The permitted small display proposal is reduced as a whole rather than
    // clipping each channel independently or hiding the added endpoint counts.
    for(const strength of [1,.75,.5,.25,.125,.0625,.03125,.015625]){
      adjustment=validate({mode,strength,exposureEv,contrast,whiteBalance});clipping=estimateClipping(s,adjustment);
      if(clipping.additionalClippedFraction<=.001)break;
    }
    if(clipping.additionalClippedFraction>.001)fail('auto-clipping','自动建议可能增加显示截断，未套用；请降低曝光或手动调整。');
    const evidence={version:1,method:'bounded-global-photo-display-v1',samplePixels:s.count,lowQuantile:low,medianQuantile:median,highQuantile:high,backgroundEligible,whiteBalanceApplied,strengthReduced:adjustment.strength<1,newlyClippedChannelFraction:clipping.additionalClippedFraction,maximumNewlyClippedChannelFraction:.001,modeDeclared:mode,localOnly:true,calibrated:false};
    return {adjustment,method:evidence.method,evidence,warnings:[warning('auto-display-only','仅为拍摄照片的保守全局显示建议，不是色度校准、染色标准化或定量信号校正。'),warning(whiteBalanceApplied?'auto-background':'auto-no-white-balance',whiteBalanceApplied?'依据符合门槛的近白边界背景估计轻微中性色偏。':'未自动调整白平衡；仅建议共同的全局亮度与对比度。'),...clipping.warnings]};
  }
  function aborted(signal){if(signal?.aborted){const e=new Error('已取消图像分析。');e.name='AbortError';throw e;}}
  function analyze(href,{signal,maxSide=MAX_SIDE}={}){
    if(!Number.isInteger(maxSide)||maxSide<32||maxSide>MAX_SIDE)return Promise.reject(new Error('图像采样尺寸无效。'));
    const insets=typeof StudioImageInsets!=='undefined'?StudioImageInsets:globalThis.StudioImageInsets;
    let dimensions;try{aborted(signal);if(!insets?.dimensionsFromHref)fail('source','原图读取模块不可用。');dimensions=insets.dimensionsFromHref(href);}catch(e){return Promise.reject(e);}
    if(pending>=MAX_PENDING)return Promise.reject(new Error('正在读取其他图片，请稍后再试。'));
    pending++;
    const job=queue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
      try{aborted(signal);}catch(e){reject(e);return;}
      if(typeof Image==='undefined'||!globalThis.document?.createElement){reject(new Error('当前环境无法读取原图。'));return;}
      const image=new Image();let finished=false,timer;
      const finish=(error,result)=>{if(finished)return;finished=true;clearTimeout(timer);signal?.removeEventListener('abort',onAbort);image.onload=image.onerror=null;image.src='';error?reject(error):resolve(result);};
      const onAbort=()=>{const e=new Error('已取消图像分析。');e.name='AbortError';finish(e);};
      signal?.addEventListener('abort',onAbort,{once:true});timer=setTimeout(()=>finish(new Error('读取原图超时，请重试。')),15000);
      image.onload=()=>{let canvas;try{
        aborted(signal);if(!image.naturalWidth||!image.naturalHeight||Math.abs(image.naturalWidth/image.naturalHeight-dimensions.widthPx/dimensions.heightPx)>1e-5)fail('source','原图方向无法可靠读取。');
        const scale=Math.min(1,maxSide/Math.max(image.naturalWidth,image.naturalHeight));canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});if(!ctx)fail('source','当前环境无法读取原图。');ctx.drawImage(image,0,0,canvas.width,canvas.height);
        const result=sample(ctx.getImageData(0,0,canvas.width,canvas.height));result.sourceWidth=dimensions.widthPx;result.sourceHeight=dimensions.heightPx;finish(null,result);
      }catch(error){finish(error);}finally{if(canvas){canvas.width=canvas.height=1;}}};
      image.onerror=()=>finish(new Error('原图像素无法读取。'));image.src=href;
    })).finally(()=>pending--);queue=job.catch(()=>{});return job;
  }
  const encoded=value=>JSON.stringify(validate(value));
  const attr=(node,key,value)=>node.setAttribute(key,String(value));
  function make(doc,name,attributes={}){const node=doc.createElementNS(NS,name);for(const [key,value]of Object.entries(attributes))attr(node,key,value);return node;}
  function find(root,id){return [...root.querySelectorAll('[id]')].filter(n=>n.id===id);}
  function effect(node){return (node.style?.getPropertyValue('filter')||node.getAttribute('filter')||'').trim();}
  function checkComputed(image,declared){
    const view=image.ownerDocument?.defaultView;if(!view?.getComputedStyle)return;
    const actual=view.getComputedStyle(image).getPropertyValue('filter').trim();if(!actual)return;
    if((!declared||declared==='none')&&actual==='none'||actual===declared)return;
    const reference=text=>{const m=text.match(/^url\(["']?([^"')]+)["']?\)$/);if(!m)return null;try{return new URL(m[1],image.ownerDocument.baseURI).href;}catch{return null;}};
    if(reference(actual)&&reference(actual)===reference(declared))return;
    fail('filter','此图片含已有滤镜，不能安全叠加颜色匹配。');
  }
  function inspect(image,root=image?.ownerSVGElement){
    if(!image||image.localName!=='image'||image.namespaceURI!==NS||!root?.querySelectorAll)fail('filter','请选择嵌入的位图。');
    const value=effect(image),meta=image.getAttribute(MARK);checkComputed(image,value);if(!value||value==='none'){if(meta)fail('filter','图片颜色记录与显示滤镜不一致。');return null;}
    const match=value.match(/^url\(#([A-Za-z_][\w.:-]{0,159})\)$/);if(!match||!meta||meta.length>2048)fail('filter','此图片含已有滤镜，不能安全叠加颜色匹配。');
    let a,stored;try{stored=JSON.parse(meta);a=validate(stored);}catch{fail('filter','图片颜色记录无效。');}const matches=find(root,match[1]);if(matches.length!==1)fail('filter','图片颜色滤镜引用不唯一。');
    // Old saved filters omit tint. Verify their exact earlier metadata and
    // unchanged coefficients, then expose the normalized zero-tint record.
    const canonicalValue={...a};if(!Object.hasOwn(stored,'tint'))delete canonicalValue.tint;
    const f=matches[0],canonical=JSON.stringify(canonicalValue),c=coefficients(a);
    const expected={id:match[1],x:'0%',y:'0%',width:'100%',height:'100%',filterUnits:'objectBoundingBox','color-interpolation-filters':'linearRGB',[MARK]:canonical};
    if(f.localName!=='filter'||f.namespaceURI!==NS||f.attributes.length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>f.getAttribute(k)!==v)||f.children.length!==1)fail('filter','图片颜色滤镜结构不受支持。');
    const transfer=f.children[0];if(transfer.localName!=='feComponentTransfer'||transfer.namespaceURI!==NS||transfer.attributes.length!==1||transfer.getAttribute('in')!=='SourceGraphic'||transfer.children.length!==4)fail('filter','图片颜色滤镜结构不受支持。');
    [...transfer.children].forEach((func,i)=>{const expected=i===3?{type:'identity'}:{type:'linear',slope:String(c.slopes[i]),intercept:String(c.intercept)};if(func.localName!==['feFuncR','feFuncG','feFuncB','feFuncA'][i]||func.namespaceURI!==NS||func.children.length||func.attributes.length!==Object.keys(expected).length||Object.entries(expected).some(([k,v])=>func.getAttribute(k)!==v))fail('filter','图片颜色滤镜参数与记录不一致。');});return a;
  }
  function clear(image,{root=image?.ownerSVGElement}={}){
    const a=inspect(image,root);if(!a)return false;const id=effect(image).slice(5,-1),f=find(root,id)[0];image.removeAttribute('filter');image.style?.removeProperty('filter');image.removeAttribute(MARK);
    // Generated filters may be shared after importing SVG. Do not break another image.
    if(![...root.querySelectorAll('image')].some(n=>effect(n)==='url(#'+id+')'))f?.remove();return true;
  }
  function apply(image,value,{root=image?.ownerSVGElement,id}={}){
    const a=validate(value);inspect(image,root);
    const href=image.getAttribute('href')||image.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';
    // A slider changes display coefficients, not the source. Validate a new
    // byte string once per live image; every changed href is checked again.
    if(validatedHrefs.get(image)!==href){if(href.length>28000000||!/^data:image\/(?:png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(href))fail('source','颜色调整仅支持工程中嵌入的静态 PNG、JPEG 或 WebP 原图。');validatedHrefs.set(image,href);}
    for(let node=image.parentElement;node;node=node.parentElement){if(effect(node)&&effect(node)!=='none'||node.getAttribute('mask'))fail('filter','此图片含已有滤镜，不能安全叠加颜色匹配。');if(node===root)break;}
    const meta=encoded(a),coeff=coefficients(a);let key=id||'studio-image-color-'+(++serial);if(!/^[A-Za-z_][\w.:-]{0,140}$/.test(key))fail('filter','图片颜色滤镜编号无效。');
    clear(image,{root});while(find(root,key).length)key=(id||'studio-image-color')+'-'+(++serial);
    const doc=image.ownerDocument,f=make(doc,'filter',{id:key,x:'0%',y:'0%',width:'100%',height:'100%',filterUnits:'objectBoundingBox','color-interpolation-filters':'linearRGB',[MARK]:meta}),transfer=make(doc,'feComponentTransfer',{in:'SourceGraphic'});
    for(let i=0;i<3;i++)transfer.append(make(doc,['feFuncR','feFuncG','feFuncB'][i],{type:'linear',slope:coeff.slopes[i],intercept:coeff.intercept}));transfer.append(make(doc,'feFuncA',{type:'identity'}));f.append(transfer);
    let defs=[...root.children].find(n=>n.localName==='defs'&&n.namespaceURI===NS);if(!defs){defs=make(doc,'defs');root.insertBefore(defs,root.firstChild);}defs.append(f);image.style?.removeProperty('filter');attr(image,'filter','url(#'+key+')');attr(image,MARK,meta);return f;
  }
  return {validate,coefficients,transform,sample,analyze,suggest,suggestAuto,estimateClipping,displayStatistics,inspect,apply,clear,defaults:{...defaults,whiteBalance:[1,1,1]},limits:{maxSide:MAX_SIDE,maxPending:MAX_PENDING}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageColor;
