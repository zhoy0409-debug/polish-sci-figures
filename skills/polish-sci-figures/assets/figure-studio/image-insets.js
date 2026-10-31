/* Scientific image insets retain embedded source pixels. Coordinates and history
 * contain references and geometry only; rendering never resamples a preview. */
'use strict';
const StudioImageInsets = (() => {
  const NS='http://www.w3.org/2000/svg', XLINK='http://www.w3.org/1999/xlink';
  const MAX_PIXELS=64000000, MAX_SIDE=32767, MAX_URL=28000000, CACHE_SIZE=8, CACHE_BYTES=40000000;
  const EPS=1e-8, decoded=new Map(), dimensionsCache=new Map(), IDENTITY={a:1,b:0,c:0,d:1,e:0,f:0};
  let decodeQueue=Promise.resolve(),pendingDecodes=0;
  const fail=(code,message)=>{const error=new Error(message);error.code=code;throw error;};
  const finite=Number.isFinite;
  function pixels(w,h){return Number.isInteger(w)&&Number.isInteger(h)&&w>0&&h>0&&w<=MAX_SIDE&&h<=MAX_SIDE&&w*h<=MAX_PIXELS;}
  function multiply(m,n){return {a:m.a*n.a+m.c*n.b,b:m.b*n.a+m.d*n.b,c:m.a*n.c+m.c*n.d,d:m.b*n.c+m.d*n.d,e:m.a*n.e+m.c*n.f+m.e,f:m.b*n.e+m.d*n.f+m.f};}
  function inverse(m){const det=m.a*m.d-m.b*m.c;if(!finite(det)||Math.abs(det)<1e-12)fail('transform','图片变换无法可靠换算为原始像素。');return {a:m.d/det,b:-m.b/det,c:-m.c/det,d:m.a/det,e:(m.c*m.f-m.d*m.e)/det,f:(m.b*m.e-m.a*m.f)/det};}
  function point(m,p){return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};}
  function matrix(value){
    if(!value?.trim())return {...IDENTITY};
    let result={...IDENTITY},end=0;const regex=/([a-zA-Z]+)\s*\(([^()]*)\)/g;
    for(const match of value.matchAll(regex)){
      if(!/^[\s,]*$/.test(value.slice(end,match.index)))fail('transform','图片变换无法可靠换算为原始像素。');
      const input=match[2].trim(),tokens=input.match(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi)||[];
      if(!/^[\s,]*$/.test(input.replace(/[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?/gi,'')))fail('transform','图片变换无法可靠换算为原始像素。');
      const n=tokens.map(Number);if(n.some(v=>!finite(v)||Math.abs(v)>1e12))fail('transform','图片变换无法可靠换算为原始像素。');
      let t;const op=match[1];
      if(op==='matrix'&&n.length===6)t={a:n[0],b:n[1],c:n[2],d:n[3],e:n[4],f:n[5]};
      else if(op==='translate'&&(n.length===1||n.length===2))t={...IDENTITY,e:n[0],f:n[1]||0};
      else if(op==='scale'&&(n.length===1||n.length===2))t={...IDENTITY,a:n[0],d:n.length===2?n[1]:n[0]};
      else if(op==='rotate'&&(n.length===1||n.length===3)){
        const a=n[0]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),rotation={a:c,b:s,c:-s,d:c,e:0,f:0};
        t=n.length===3?multiply(multiply({...IDENTITY,e:n[1],f:n[2]},rotation),{...IDENTITY,e:-n[1],f:-n[2]}):rotation;
      }else if((op==='skewX'||op==='skewY')&&n.length===1)t={...IDENTITY,[op==='skewX'?'c':'b']:Math.tan(n[0]*Math.PI/180)};
      else fail('transform','图片变换无法可靠换算为原始像素。');
      result=multiply(result,t);end=match.index+match[0].length;
    }
    if(!end||!/^[\s,]*$/.test(value.slice(end))||Object.values(result).some(v=>!finite(v)))fail('transform','图片变换无法可靠换算为原始像素。');
    inverse(result);return result;
  }
  function length(value,basis,fallback){
    if(value==null||value==='')return fallback;
    const match=String(value).trim().match(/^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?)(px|pt|pc|in|cm|mm|q|%)?$/i);
    if(!match)fail('geometry','图片尺寸无法可靠换算为原始像素。');
    const unit=(match[2]||'').toLowerCase(),factor={'':1,px:1,pt:96/72,pc:16,in:96,cm:96/2.54,mm:96/25.4,q:96/101.6,'%':basis/100}[unit],v=+match[1]*factor;
    if(!finite(v))fail('geometry','图片尺寸无法可靠换算为原始像素。');return v;
  }
  function viewBox(node){
    const value=node.getAttribute('viewBox');if(!value)return null;
    const n=value.trim().split(/[\s,]+/).map(Number);
    if(n.length!==4||n.some(v=>!finite(v))||n[2]<=0||n[3]<=0)fail('geometry','图片尺寸无法可靠换算为原始像素。');return n;
  }
  function parentViewport(node){
    let svg=node.parentElement;while(svg&&svg.localName!=='svg')svg=svg.parentElement;
    if(!svg)return {width:NaN,height:NaN};
    const box=viewBox(svg);if(box)return {width:box[2],height:box[3]};
    const parent=parentViewport(svg);
    return {width:length(svg.getAttribute('width'),parent.width,parent.width),height:length(svg.getAttribute('height'),parent.height,parent.height)};
  }
  function aspect(value){
    const text=String(value||'xMidYMid meet').trim().replace(/^defer\s+/,'');
    const parts=text.split(/\s+/),align=parts[0],mode=parts[1]||'meet';
    if(parts.length>2||(!/^x(Min|Mid|Max)Y(Min|Mid|Max)$/.test(align)&&align!=='none')||!['meet','slice'].includes(mode))fail('aspect','图片纵横比设置不受支持。');
    return {align,mode,x:align==='none'?0:{Min:0,Mid:.5,Max:1}[align.slice(1,4)],y:align==='none'?0:{Min:0,Mid:.5,Max:1}[align.slice(5,8)]};
  }
  function fit(width,height,sourceWidth,sourceHeight,par){
    let sx=width/sourceWidth,sy=height/sourceHeight;
    if(par.align!=='none')sx=sy=par.mode==='slice'?Math.max(sx,sy):Math.min(sx,sy);
    return {sx,sy,x:(width-sourceWidth*sx)*par.x,y:(height-sourceHeight*sy)*par.y};
  }
  function svgMatrix(node){
    const parent=parentViewport(node),x=length(node.getAttribute('x'),parent.width,0),y=length(node.getAttribute('y'),parent.height,0),box=viewBox(node);
    const w=length(node.getAttribute('width'),parent.width,parent.width),h=length(node.getAttribute('height'),parent.height,parent.height);
    if(!(w>0&&h>0))fail('geometry','图片尺寸无法可靠换算为原始像素。');
    if(!box)return {...IDENTITY,e:x,f:y};
    const f=fit(w,h,box[2],box[3],aspect(node.getAttribute('preserveAspectRatio')));
    return {a:f.sx,b:0,c:0,d:f.sy,e:x+f.x-box[0]*f.sx,f:y+f.y-box[1]*f.sy};
  }
  function relativeMatrix(image,svgRoot){
    if(!image||!svgRoot||image===svgRoot)fail('source','未找到局部放大的原图。');
    const nodes=[];let node=image;
    while(node&&node!==svgRoot){nodes.unshift(node);node=node.parentElement;}
    if(node!==svgRoot)fail('source','未找到局部放大的原图。');
    let result={...IDENTITY};
    for(const item of nodes){
      if(item.style?.getPropertyValue('transform')||item.style?.getPropertyValue('transform-origin'))fail('transform','图片变换无法可靠换算为原始像素。');
      result=multiply(result,matrix(item.getAttribute('transform')||''));
      if(item.localName==='svg')result=multiply(result,svgMatrix(item));
    }
    inverse(result);return result;
  }
  function imageRect(image,widthPx,heightPx){
    if(image?.localName!=='image'||!pixels(widthPx,heightPx))fail('pixels','原图像素尺寸无效或超过局部放大的处理上限。');
    const parent=parentViewport(image),x=length(image.getAttribute('x'),parent.width,0),y=length(image.getAttribute('y'),parent.height,0),w=length(image.getAttribute('width'),parent.width,NaN),h=length(image.getAttribute('height'),parent.height,NaN);
    if(!(w>0&&h>0))fail('geometry','图片尺寸无法可靠换算为原始像素。');
    const f=fit(w,h,widthPx,heightPx,aspect(image.getAttribute('preserveAspectRatio'))),left=x+f.x,top=y+f.y;
    const vx=Math.max(0,(x-left)/(widthPx*f.sx)),vy=Math.max(0,(y-top)/(heightPx*f.sy)),right=Math.min(1,(x+w-left)/(widthPx*f.sx)),bottom=Math.min(1,(y+h-top)/(heightPx*f.sy));
    return {x:left,y:top,width:widthPx*f.sx,height:heightPx*f.sy,sx:f.sx,sy:f.sy,viewport:{x,y,width:w,height:h},visible:{x:vx,y:vy,w:right-vx,h:bottom-vy}};
  }
  const ORIENTATIONS={normal:[1,0,0,1],rotate90:[0,1,-1,0],rotate180:[-1,0,0,-1],rotate270:[0,-1,1,0],flipX:[-1,0,0,1],flipY:[1,0,0,-1],transpose:[0,1,1,0],transverse:[0,-1,-1,0]};
  function sourceOrientation(image,root){
    const m=relativeMatrix(image,root),x=Math.hypot(m.a,m.b),y=Math.hypot(m.c,m.d),axes=[m.a/x,m.b/x,m.c/y,m.d/y];
    const match=Object.entries(ORIENTATIONS).find(([,v])=>v.every((n,i)=>Math.abs(n-axes[i])<1e-7));
    if(!match)fail('orientation','局部放大支持 90° 整倍数旋转和翻转；请先还原原图的任意角度旋转或剪切。');return match[0];
  }
  function displayPixels(a){
    const orientation=a.source.orientation||'normal',axes=ORIENTATIONS[orientation];if(!axes)fail('orientation','局部放大方向无效。');
    const swapped=axes[0]===0,w=a.roi.w*a.source.widthPx,h=a.roi.h*a.source.heightPx;
    return {width:swapped?h:w,height:swapped?w:h,swapped,orientation};
  }
  function orientedCrop(a){
    const s=a.source,r=a.roi,axes=ORIENTATIONS[s.orientation||'normal'];if(!axes)fail('orientation','局部放大方向无效。');
    const [a1,b,c,d]=axes,m={a:a1,b,c,d,e:0,f:0},full=[{x:0,y:0},{x:s.widthPx,y:0},{x:0,y:s.heightPx},{x:s.widthPx,y:s.heightPx}].map(p=>point(m,p));
    m.e=-Math.min(...full.map(p=>p.x));m.f=-Math.min(...full.map(p=>p.y));
    const corners=[{x:r.x*s.widthPx,y:r.y*s.heightPx},{x:(r.x+r.w)*s.widthPx,y:r.y*s.heightPx},{x:r.x*s.widthPx,y:(r.y+r.h)*s.heightPx},{x:(r.x+r.w)*s.widthPx,y:(r.y+r.h)*s.heightPx}].map(p=>point(m,p)),x=Math.min(...corners.map(p=>p.x)),y=Math.min(...corners.map(p=>p.y)),size=displayPixels(a);
    return {x,y,width:size.width,height:size.height,matrix:m};
  }
  function hrefFor(image){
    const href=image?.getAttribute('href')||image?.getAttributeNS?.(XLINK,'href')||image?.getAttribute('xlink:href')||'';
    if(href.length>MAX_URL||!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(href))fail('source','局部放大仅支持工程中嵌入的静态 PNG、JPEG 或 WebP 图片。');
    return href;
  }
  function validRecord(a){
    const s=a?.source,r=a?.roi;
    if(s?.orientation!==undefined&&!Object.hasOwn(ORIENTATIONS,s.orientation))return false;
    if(a?.type!=='inset'||!/^annotation-\d+$/.test(a.id||'')||!s||!/^panel-\d+$/.test(s.panelId||'')||!Number.isInteger(s.variant)||s.variant<0||!/^e\d+$/.test(s.key||'')||!pixels(s.widthPx,s.heightPx)||!r||!['x','y','w','h'].every(k=>finite(r[k]))||r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>1+EPS||r.y+r.h>1+EPS||r.w*s.widthPx<1-EPS||r.h*s.heightPx<1-EPS||typeof a.connector!=='boolean'||typeof a.showScale!=='boolean'||(a.scaleLengthUm!==undefined&&(!finite(a.scaleLengthUm)||a.scaleLengthUm<=0)))return false;
    return (a.documentCoordinates===undefined||typeof a.documentCoordinates==='boolean')&&['x','y','w','h'].every(k=>finite(a[k])&&Math.abs(a[k])<=1e7)&&a.w>0&&a.h>0&&(a.documentCoordinates||a.x>=0&&a.y>=0&&a.x+a.w<=1+EPS&&a.y+a.h<=1+EPS);
  }
  function validate(a,project,state){
    if(!validRecord(a))fail('record','局部放大参数无效。');
    if(project){const panel=project.panels?.find(p=>p.id===a.source.panelId);if(!panel?.variants?.[a.source.variant])fail('source','未找到局部放大的原图。');}
    // A temporarily inactive/replaced panel may remain in an undo state. The
    // renderer hides it rather than substituting the same key in another view.
    if(state&&(!Array.isArray(state.order)||!state.panels))fail('record','局部放大参数无效。');return true;
  }
  function inside(r,b){return r.x>=b.x-EPS&&r.y>=b.y-EPS&&r.x+r.w<=b.x+b.w+EPS&&r.y+r.h<=b.y+b.h+EPS;}
  function checkClip(root,node,reference,image,corners){
    const id=reference.match(/^url\(\s*['"]?#([\w.:-]+)['"]?\s*\)$/)?.[1],matches=id?[...root.querySelectorAll('[id]')].filter(n=>n.id===id):[];
    const clip=matches.length===1?matches[0]:null,rect=clip?.firstElementChild;
    if(!clip||clip.localName!=='clipPath'||(clip.getAttribute('clipPathUnits')||'userSpaceOnUse')!=='userSpaceOnUse'||clip.children.length!==1||rect.localName!=='rect')fail('clip','该图片包含复杂裁剪或效果，暂不能准确定位局部放大区域。');
    for(const n of [clip,rect]){
      if(n.getAttribute('transform')||n.getAttribute('style')||['clip-path','mask','filter'].some(k=>n.getAttribute(k)&&n.getAttribute(k)!=='none')||['rx','ry'].some(k=>n.hasAttribute(k)&&Number(n.getAttribute(k))!==0))fail('clip','该图片包含复杂裁剪或效果，暂不能准确定位局部放大区域。');
    }
    // The clip's user space is the clipped element's, not its location in
    // <defs>. No bounding-box, rotated, rounded, or compound clip is guessed.
    const x=length(rect.getAttribute('x'),NaN,0),y=length(rect.getAttribute('y'),NaN,0),w=length(rect.getAttribute('width'),NaN,NaN),h=length(rect.getAttribute('height'),NaN,NaN),m=node===image?IDENTITY:relativeMatrix(image,node);
    if(!(w>0&&h>0)||(corners&&corners.map(p=>point(m,p)).some(p=>p.x<x-EPS||p.y<y-EPS||p.x>x+w+EPS||p.y>y+h+EPS)))fail('clip','局部放大区域超出原图当前可见的像素范围。');
  }
  function imageColorAPI(){if(typeof StudioImageColor!=='undefined')return StudioImageColor;if(typeof module!=='undefined'&&module.exports){try{return require('./image-color.js');}catch{}}return null;}
  function sourceInfo(a,root,{checkVisibility=true}={}){
    validate(a);const panels=[...root.querySelectorAll('[data-panel]')].filter(p=>p.getAttribute('data-panel')===a.source.panelId),panel=panels.length===1?panels[0]:null;
    if(!panel||(panel.hasAttribute('data-variant')&&Number(panel.getAttribute('data-variant'))!==a.source.variant))fail('source','未找到局部放大的原图。');
    const matches=[...panel.querySelectorAll('image[data-key]')].filter(n=>n.getAttribute('data-key')===a.source.key&&!n.closest('[data-inset-content]'));
    if(matches.length!==1)fail('source','未找到局部放大的原图。');const image=matches[0];
    if(image.closest('defs,symbol'))fail('source','该图片是复用的定义资源，请先选择可见的原图。');
    const clips=[];let colorAdjustment=null;
    for(let n=image;n&&n!==root;n=n.parentElement){
      const prop=k=>n.style?.getPropertyValue(k)||n.getAttribute(k)||'';
      if(prop('display')==='none'||['hidden','collapse'].includes(prop('visibility'))||(prop('opacity')!==''&&Number(prop('opacity'))===0))fail('hidden','局部放大的原图已隐藏。');
      if(prop('mask')&&prop('mask')!=='none')fail('clip','该图片包含复杂裁剪或效果，暂不能准确定位局部放大区域。');
      if(prop('filter')&&prop('filter')!=='none'){
        const api=imageColorAPI();if(n!==image||!api?.inspect||!api?.apply)fail('clip','该图片包含复杂裁剪或效果，暂不能准确定位局部放大区域。');
        try{colorAdjustment=api.inspect(image,root);}catch{fail('clip','该图片包含无法核实的颜色滤镜，请先还原该效果。');}if(!colorAdjustment)fail('clip','该图片包含无法核实的颜色滤镜，请先还原该效果。');
      }
      // A paper viewport does not crop the stored source pixels. Insets may
      // deliberately show a region whose source is outside the paper edge.
      // Only our direct canvas carrier gets this exemption; imported image
      // clipping and nested user groups still undergo the full ROI check.
      if(prop('clip-path')&&prop('clip-path')!=='none'&&!(n.parentElement===root&&n.hasAttribute('data-master-frame-content')))clips.push({node:n,reference:prop('clip-path')});
    }
    const href=hrefFor(image),intrinsic=dimensionsFromHref(href);
    if(intrinsic.widthPx!==a.source.widthPx||intrinsic.heightPx!==a.source.heightPx)fail('pixels','原图像素尺寸已变化，请重新选择局部放大区域。');
    const rect=imageRect(image,a.source.widthPx,a.source.heightPx),m=relativeMatrix(image,root),r=a.roi,orientation=sourceOrientation(image,root);
    if(orientation!==(a.source.orientation||'normal'))fail('orientation','原图旋转或翻转方向已变化，请重新框选局部放大区域。');
    if(checkVisibility&&!inside(r,rect.visible))fail('clip','局部放大区域超出原图当前可见的像素范围。');
    const local=[{x:rect.x+r.x*rect.width,y:rect.y+r.y*rect.height},{x:rect.x+(r.x+r.w)*rect.width,y:rect.y+r.y*rect.height},{x:rect.x+(r.x+r.w)*rect.width,y:rect.y+(r.y+r.h)*rect.height},{x:rect.x+r.x*rect.width,y:rect.y+(r.y+r.h)*rect.height}];
    for(const clip of clips)checkClip(root,clip.node,clip.reference,image,checkVisibility?local:null);
    // Nested SVG viewports can clip even without an explicit clip-path. Check
    // the ROI in each viewport's parent coordinates, including meet/slice.
    for(let n=image.parentElement;n&&n!==root;n=n.parentElement){
      if(n.localName!=='svg'||(n.style?.overflow||n.getAttribute('overflow'))==='visible')continue;
      const p=parentViewport(n),x=length(n.getAttribute('x'),p.width,0),y=length(n.getAttribute('y'),p.height,0),w=length(n.getAttribute('width'),p.width,p.width),h=length(n.getAttribute('height'),p.height,p.height),toParent=multiply(svgMatrix(n),relativeMatrix(image,n));
      if(!(w>0&&h>0)||(checkVisibility&&local.map(pt=>point(toParent,pt)).some(pt=>pt.x<x-EPS||pt.y<y-EPS||pt.x>x+w+EPS||pt.y>y+h+EPS)))fail('clip','局部放大区域超出原图当前可见的像素范围。');
    }
    return {image,href,rect,matrix:m,orientation,colorAdjustment,polygon:local.map(p=>point(m,p))};
  }
  function windowRect(a,geometry){
    if(!geometry||!finite(geometry.width)||!finite(geometry.height)||geometry.width<=0||geometry.height<=0||['dx','dy'].some(k=>geometry[k]!==undefined&&!finite(geometry[k])))fail('geometry','局部放大窗口尺寸无效。');
    const x=a.x*geometry.width,y=a.y*geometry.height,width=a.w*geometry.width,height=a.h*geometry.height;
    const size=displayPixels(a),fitted=fit(width,height,size.width,size.height,aspect('xMidYMid meet'));
    return {x,y,width,height,content:{x:x+fitted.x,y:y+fitted.y,width:size.width*fitted.sx,height:size.height*fitted.sy}};
  }
  function quality(a,{geometry,outputScale=1}={}){
    validate(a);if(!finite(outputScale)||outputScale<=0)fail('geometry','局部放大导出尺寸无效。');
    const content=windowRect(a,geometry).content,size=displayPixels(a),pixelWidth=size.width,pixelHeight=size.height,widthInches=content.width*outputScale/72,heightInches=content.height*outputScale/72;
    return {pixelWidth,pixelHeight,widthInches,heightInches,effectiveDpiX:pixelWidth/widthInches,effectiveDpiY:pixelHeight/heightInches,effectiveDpi:Math.min(pixelWidth/widthInches,pixelHeight/heightInches)};
  }
  function scaleInfo(a,{geometry,calibration,unit=1}={}){
    if(!(finite(calibration)&&calibration>0))return null;
    const r=windowRect(a,geometry).content,physicalWidth=calibration*displayPixels(a).width/a.source.widthPx;
    // Choose familiar physical distances and derive their exact display
    // length. Rounding a distance label while keeping a different line length
    // would falsely calibrate the inset.
    let lengthUm=a.scaleLengthUm;
    if(lengthUm===undefined){
      const u=finite(unit)&&unit>0?unit:1,targetDisplay=Math.min(24*u,r.width*.25),target=physicalWidth*targetDisplay/r.width,exponent=Math.floor(Math.log10(target)),candidates=[];
      for(let n=exponent-2;n<=exponent+1;n++)for(const factor of [1,2,5]){const value=factor*10**n,display=r.width*value/physicalWidth;if(finite(value)&&value>0&&display<=Math.min(36*u,r.width*.35)*(1+EPS))candidates.push(value);}
      const preferred=candidates.filter(v=>v>=target*.8*(1-EPS)&&v<=target*1.2*(1+EPS)),choices=preferred.length?preferred:candidates;
      choices.sort((x,y)=>Math.abs(x-target)-Math.abs(y-target));lengthUm=choices[0];
    }
    if(!(finite(lengthUm)&&lengthUm>0&&lengthUm<=physicalWidth*.8*(1+EPS)))fail('scale','局部放大比例尺超出该区域的实际宽度。');
    const length=r.width*lengthUm/physicalWidth,displayUnit=lengthUm>=1000?'mm':lengthUm<1?'nm':'μm',displayValue=lengthUm/(displayUnit==='mm'?1000:displayUnit==='nm'?.001:1);
    return {lengthUm,length,physicalWidth,displayUnit,displayValue,label:Number(displayValue.toPrecision(12))+' '+displayUnit,automatic:a.scaleLengthUm===undefined};
  }
  function renderContent(a,{root,geometry,calibration,unit=1}={}){
    const document=root?.ownerDocument||globalThis.document;if(!document)fail('source','未找到局部放大的原图。');
    const el=(tag,attrs={})=>{const n=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;},group=el('g',{'data-inset-content':a.id});
    try{
      validate(a);const source=sourceInfo(a,root),window=windowRect(a,geometry),dx=geometry.dx||0,dy=geometry.dy||0,polygon=source.polygon.map(p=>({x:p.x-dx,y:p.y-dy}));
      const color=a.color||'#ffffff',stroke=finite(a.stroke)&&a.stroke>0?a.stroke:1,opacity=finite(a.opacity)?a.opacity:1;
      group.setAttribute('opacity',opacity);
      if(a.connector){
        const center={x:window.x+window.width/2,y:window.y+window.height/2},nearest=polygon.reduce((p,q)=>Math.hypot(q.x-center.x,q.y-center.y)<Math.hypot(p.x-center.x,p.y-center.y)?q:p),target={x:Math.max(window.x,Math.min(window.x+window.width,nearest.x)),y:Math.max(window.y,Math.min(window.y+window.height,nearest.y))};
        group.append(el('line',{x1:nearest.x,y1:nearest.y,x2:target.x,y2:target.y,stroke:color,'stroke-width':stroke,'data-inset-connector':'true','pointer-events':'none'}));
      }
      group.append(el('polygon',{points:polygon.map(p=>`${p.x},${p.y}`).join(' '),fill:'none',stroke:color,'stroke-width':stroke,'data-inset-roi':'true','pointer-events':'none'}));
      const windowGroup=el('g',{'data-inset-window':'true'}),r=a.roi,s=a.source;
      if(a.fill)windowGroup.append(el('rect',{x:window.content.x,y:window.content.y,width:window.content.width,height:window.content.height,fill:color}));
      // Original encoded pixels, with an ROI viewBox. This is a display crop;
      // SVG remains self-contained and the original image is not rewritten.
      const oriented=orientedCrop(a),crop=el('svg',{x:window.x,y:window.y,width:window.width,height:window.height,viewBox:`${oriented.x} ${oriented.y} ${oriented.width} ${oriented.height}`,preserveAspectRatio:'xMidYMid meet',overflow:'hidden','pointer-events':'none'});
      const pixels=el('image',{x:0,y:0,width:s.widthPx,height:s.heightPx,href:source.href,preserveAspectRatio:'none','data-studio-inset-source':'true'});if((s.orientation||'normal')!=='normal'){const m=oriented.matrix;pixels.setAttribute('transform',`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);}crop.append(pixels);if(source.colorAdjustment)imageColorAPI().apply(pixels,source.colorAdjustment,{root:crop,id:'studio-inset-color-'+a.id});windowGroup.append(crop);
      // A meet viewport clips to its entire rectangular viewport, not its
      // viewBox bounds. Constrain it to the exact fitted ROI to prevent pixels
      // outside the ROI becoming visible in an unlocked-aspect letterbox.
      crop.setAttribute('x',window.content.x);crop.setAttribute('y',window.content.y);crop.setAttribute('width',window.content.width);crop.setAttribute('height',window.content.height);
      windowGroup.append(el('rect',{x:window.content.x,y:window.content.y,width:window.content.width,height:window.content.height,fill:'none',stroke:color,'stroke-width':stroke,'data-inset-frame':'true','pointer-events':'all'}));
      if(a.showScale){let scale;try{scale=scaleInfo(a,{geometry,calibration,unit});}catch(error){group.setAttribute('data-inset-scale-unavailable',error.code||'scale');group.setAttribute('data-inset-error',error.message);}if(scale){const margin=Math.max(stroke*2,Math.min(window.content.width,window.content.height)*.055),barHeight=Math.max(.7,Math.min(2,stroke))*(finite(unit)&&unit>0?unit:1),y=window.content.y+window.content.height-margin,fontSize=Math.max(1,Math.min(finite(a.size)?a.size:9,window.content.height*.18,window.content.width/(scale.label.length*.7+2)));
        const rgb=color.match(/^#([0-9a-f]{6})$/i)?.[1],dark=rgb?(parseInt(rgb.slice(0,2),16)*.2126+parseInt(rgb.slice(2,4),16)*.7152+parseInt(rgb.slice(4,6),16)*.0722)<140:false,textWidth=scale.label.length*fontSize*.62,bgWidth=Math.max(scale.length,textWidth)+margin,x=window.content.x+window.content.width-margin-Math.max(scale.length,textWidth)/2-scale.length/2;
        if(Math.max(scale.length,textWidth)+margin*1.5>window.content.width||margin*1.55+barHeight+fontSize>window.content.height){group.setAttribute('data-inset-scale-unavailable','scale');group.setAttribute('data-inset-error','放大窗口太小，无法完整显示比例尺；请扩大窗口。');group.append(windowGroup);return group;}
        windowGroup.append(el('rect',{x:x+scale.length/2-bgWidth/2,y:y-barHeight-margin*.55-fontSize,width:bgWidth,height:barHeight+margin+fontSize,rx:Math.min(2,fontSize*.2),fill:dark?'#ffffff':'#000000','fill-opacity':.7,'data-inset-scale-background':'true','pointer-events':'none'}));
        windowGroup.append(el('rect',{x,y:y-barHeight,width:scale.length,height:barHeight,fill:color,'data-inset-scale':'true','pointer-events':'none'}));
        const text=el('text',{x:x+scale.length/2,y:y-barHeight-margin*.55,'text-anchor':'middle','font-family':a.font||'Arial','font-size':fontSize,'font-weight':a.bold?'700':'400',fill:color,'data-inset-scale-label':'true','pointer-events':'none'});text.textContent=scale.label;windowGroup.append(text);
      }}
      group.append(windowGroup);return group;
    }catch(error){group.replaceChildren();group.setAttribute('data-inset-unavailable',error.code||'source');group.setAttribute('data-inset-error',error.message);return group;}
  }
  function headerDimensions(bytes,mime){
    const u16=(p,little=false)=>little?bytes[p]|bytes[p+1]<<8:bytes[p]<<8|bytes[p+1],u32=(p,little=false)=>little?(bytes[p]|bytes[p+1]<<8|bytes[p+2]<<16|bytes[p+3]<<24)>>>0:(bytes[p]*16777216+(bytes[p+1]<<16)+(bytes[p+2]<<8)+bytes[p+3])>>>0;
    let width,height,orientation=1;
    if(mime==='png'&&bytes.length>=24&&[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)&&String.fromCharCode(...bytes.slice(12,16))==='IHDR'){
      width=u32(16);height=u32(20);
      for(let p=8;p+8<=bytes.length;){const size=u32(p),kind=String.fromCharCode(...bytes.slice(p+4,p+8));if(kind==='acTL')fail('animation','动态图像暂不支持局部放大，请使用静态原图。');if(kind==='IDAT'||kind==='IEND')break;if(p+size+12>bytes.length)break;p+=size+12;}
    }
    else if(mime==='jpeg'&&bytes[0]===255&&bytes[1]===216){
      let p=2;while(p+4<=bytes.length){if(bytes[p++]!==255)break;while(bytes[p]===255)p++;const marker=bytes[p++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;const size=u16(p);if(size<2||p+size>bytes.length)break;
        if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=8){height=u16(p+3);width=u16(p+5);}
        if(marker===225&&size>=16&&String.fromCharCode(...bytes.slice(p+2,p+8))==='Exif\0\0'){
          const t=p+8,little=bytes[t]===73&&bytes[t+1]===73,big=bytes[t]===77&&bytes[t+1]===77;
          if((little||big)&&u16(t+2,little)===42){const offset=u32(t+4,little),ifd=t+offset;if(offset>=8&&ifd+2<=p+size){const count=u16(ifd,little);for(let i=0;i<count&&i<1024;i++){const e=ifd+2+i*12;if(e+12>p+size)break;if(u16(e,little)===274&&u16(e+2,little)===3&&u32(e+4,little)===1)orientation=u16(e+8,little);}}}
        }p+=size;
      }
    }else if(mime==='webp'&&bytes.length>=30&&String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'){
      const kind=String.fromCharCode(...bytes.slice(12,16));
      if(kind==='VP8X'){if(bytes[20]&2)fail('animation','动态图像暂不支持局部放大，请使用静态原图。');width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16);height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16);}
      else if(kind==='VP8 '&&bytes[23]===157&&bytes[24]===1&&bytes[25]===42){width=u16(26,true)&16383;height=u16(28,true)&16383;}
      else if(kind==='VP8L'&&bytes[20]===47){const bits=u32(21,true);width=(bits&16383)+1;height=((bits>>>14)&16383)+1;}
    }
    if([5,6,7,8].includes(orientation))[width,height]=[height,width];
    if(!pixels(width,height))fail('pixels','原图像素尺寸无效或超过局部放大的处理上限。');
    return {widthPx:width,heightPx:height,orientation:'display'};
  }
  function dimensionsFromHref(href){
    if(typeof href!=='string'||href.length>MAX_URL)fail('source','局部放大仅支持工程中嵌入的静态 PNG、JPEG 或 WebP 图片。');
    if(dimensionsCache.has(href))return {...dimensionsCache.get(href)};
    const match=href.match(/^data:image\/(png|jpeg|webp);base64,([a-z\d+/=\s]+)$/i);if(!match)fail('source','局部放大仅支持工程中嵌入的静态 PNG、JPEG 或 WebP 图片。');
    let binary;try{binary=atob(match[2].replace(/\s/g,''));}catch{fail('pixels','原图像素无法读取。');}
    // Avoid a string iterator and a JavaScript callback for every raster byte.
    // Header, animation/orientation checks and cache bounds remain identical.
    const decodedBytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)decodedBytes[i]=binary.charCodeAt(i);
    const result=headerDimensions(decodedBytes,match[1].toLowerCase());dimensionsCache.set(href,result);let bytes=[...dimensionsCache.keys()].reduce((sum,key)=>sum+key.length,0);while(dimensionsCache.size>CACHE_SIZE||bytes>CACHE_BYTES){const first=dimensionsCache.keys().next().value;bytes-=first.length;dimensionsCache.delete(first);}return {...result};
  }
  function decodeSource(image){
    let href,dimensions;try{href=hrefFor(image);if(decoded.has(href))return decoded.get(href);dimensions=dimensionsFromHref(href);}catch(error){return Promise.reject(error);}
    if(pendingDecodes>=4)return Promise.reject(new Error('正在读取其他原图，请稍后再试。'));
    pendingDecodes++;
    const load=decodeQueue.catch(()=>{}).then(()=>new Promise((resolve,reject)=>{
      const ImageCtor=image.ownerDocument?.defaultView?.Image||globalThis.Image;if(!ImageCtor){reject(new Error('原图像素无法读取。'));return;}
      const probe=new ImageCtor();let settled=false;
      const finish=(error)=>{if(settled)return;settled=true;clearTimeout(timer);probe.onload=probe.onerror=null;probe.src='';if(error)reject(error);else resolve({...dimensions,href});};
      const timer=setTimeout(()=>finish(new Error('原图读取超时，请重新选择图片。')),15000);
      probe.onload=()=>{if(!probe.naturalWidth||!probe.naturalHeight)finish(new Error('原图像素无法读取。'));else if(Math.abs(probe.naturalWidth/probe.naturalHeight-dimensions.widthPx/dimensions.heightPx)>1e-5)finish(new Error('原图方向或像素尺寸无法可靠确认。'));else finish();};
      probe.onerror=()=>finish(new Error('原图像素无法读取。'));probe.src=href;
    })).finally(()=>{pendingDecodes--;});decodeQueue=load.then(()=>{},()=>{});
    decoded.set(href,load);load.catch(()=>{if(decoded.get(href)===load)decoded.delete(href);});let bytes=[...decoded.keys()].reduce((sum,key)=>sum+key.length,0);while(decoded.size>CACHE_SIZE||bytes>CACHE_BYTES){const first=decoded.keys().next().value;bytes-=first.length;decoded.delete(first);}return load;
  }
  function clearCache(){decoded.clear();dimensionsCache.clear();}
  return {validate,imageRect,relativeMatrix,sourceInfo,sourceOrientation,displayPixels,windowRect,renderContent,quality,scaleInfo,decodeSource,clearCache,dimensionsFromHref,multiply,inverse,point,limits:{maxPixels:MAX_PIXELS,maxSide:MAX_SIDE,maxDataUrlBytes:MAX_URL}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageInsets;
