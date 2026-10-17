/* Scale bars use the full displayed source width for calibration and only the
 * visible image region for placement. This module never changes source pixels,
 * calibration, requested length, model state or text. Coordinates share the
 * image's parent; the caller applies any common ancestor transform normally. */
'use strict';
const StudioScaleGeometry=(()=>{
  const IDENTITY={a:1,b:0,c:0,d:1,e:0,f:0},EPS=1e-8;
  function fail(reason,message){const error=new Error(message);error.code='scale-geometry';error.reason=reason;throw error;}
  function insetsAPI(explicit){
    if(explicit)return explicit;
    if(typeof StudioImageInsets!=='undefined')return StudioImageInsets;
    if(typeof module!=='undefined'&&module.exports)return require('./image-insets.js');
    fail('source','The embedded image geometry API is unavailable.');
  }
  function property(node,name){return node.style?.getPropertyValue?.(name)||node.getAttribute?.(name)||'';}
  function checkEffects(image){
    // Arbitrary masks/clips can remove the proposed bar or source pixels.
    // No guessed bounding box or reinterpretation of their calibration is used.
    for(let node=image;node?.getAttribute;node=node.parentElement){
      for(const name of ['clip-path','mask']){const value=property(node,name).trim();if(value&&value!=='none')fail('clip','Additional image clipping or masking has no verified scale-bar placement.');}
      if(node===image){
        for(const name of ['transform','transform-origin','x','y','width','height']){const value=node.style?.getPropertyValue?.(name)?.trim();if(value&&value!=='none')fail('transform','CSS image geometry cannot be verified for this scale bar.');}
      }
    }
  }
  function geometry(image,cfg,{unit=1,matrix,api}={}){
    if(image?.localName!=='image')fail('source','Select an embedded raster image.');
    if(!cfg||![unit,cfg.calibration,cfg.length,cfg.size,cfg.thickness].every(Number.isFinite)||unit<=0||cfg.calibration<=0||cfg.length<=0||cfg.length>cfg.calibration*.8||cfg.size<6||cfg.size>36||cfg.thickness<.5||cfg.thickness>12||!['bl','br','tl','tr'].includes(cfg.position))fail('parameters','Scale calibration, length, appearance or placement is invalid.');
    if(matrix==null&&image.getAttribute('transform')?.trim())fail('transform','An explicit image transform matrix is required.');
    const m=matrix||IDENTITY;
    if(!['a','b','c','d','e','f'].every(key=>Number.isFinite(m[key]))||Math.abs(m.b)>EPS||Math.abs(m.c)>EPS||Math.abs(m.a)<1e-12||Math.abs(m.d)<1e-12)fail('transform','The image must have a verified unrotated, nondegenerate transform.');
    checkEffects(image);
    let intrinsic,rect;
    try{
      const source=image.getAttribute('href')||image.getAttributeNS?.('http://www.w3.org/1999/xlink','href')||image.getAttribute('xlink:href')||'',core=insetsAPI(api);
      intrinsic=core.dimensionsFromHref(source);rect=core.imageRect(image,intrinsic.widthPx,intrinsic.heightPx);
    }catch(error){if(error.code==='scale-geometry')throw error;fail('source','Embedded source dimensions or image fitting cannot be verified.');}
    const visible=rect.visible,fullWidth=Math.abs(m.a)*rect.width,fullHeight=Math.abs(m.d)*rect.height;
    if(!visible||![rect.x,rect.y,rect.width,rect.height,visible.x,visible.y,visible.w,visible.h,fullWidth,fullHeight].every(Number.isFinite)||Math.min(rect.width,rect.height,visible.w,visible.h,fullWidth,fullHeight)<=0)fail('source','The visible source-image region is invalid.');
    const vx=rect.x+visible.x*rect.width,vy=rect.y+visible.y*rect.height,vw=visible.w*rect.width,vh=visible.h*rect.height;
    const x=Math.min(m.a*vx+m.e,m.a*(vx+vw)+m.e),y=Math.min(m.d*vy+m.f,m.d*(vy+vh)+m.f),w=Math.abs(m.a*vw),h=Math.abs(m.d*vh);
    const size=cfg.size*unit,thick=cfg.thickness*unit,len=fullWidth*cfg.length/cfg.calibration,pad=5*unit,textWidth=String(cfg.length).length*size*.65+size*2,boxW=Math.max(len,textWidth)+2*pad,boxH=size+thick+3*pad;
    // Preserve the requested physical length. An overlong bar must never be
    // shortened to fit while retaining the original micrometre label.
    if(![x,y,w,h,size,thick,len,pad,textWidth,boxW,boxH].every(Number.isFinite)||boxW+2*pad>w+EPS||boxH+2*pad>h+EPS)fail('overflow','The complete requested scale bar and label do not fit in the visible image region.');
    const left=cfg.position.endsWith('r')?x+w-boxW-pad:x+pad,top=cfg.position.startsWith('t')?y+pad:y+h-boxH-pad;
    return {x,y,w,h,len,unit,size,thick,pad,textWidth,boxW,boxH,left,top,fullWidth,fullHeight,sourceWidthPx:intrinsic.widthPx,sourceHeightPx:intrinsic.heightPx};
  }
  return {geometry};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioScaleGeometry;
