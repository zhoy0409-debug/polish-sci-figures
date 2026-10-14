/* Selection resizing is pure geometry in root-canvas points (pt).
 * No DOM, font mutation, source pixels, grid changes or history writes occur here.
 * matrix maps ORIGINAL root-canvas coordinates to the resized coordinates; the
 * caller must conjugate it into each object's parent coordinate system before
 * composing with that object's existing transform. Never replace a PDF matrix.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudioSelectionTransform=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const HANDLES={nw:[-1,-1],n:[0,-1],ne:[1,-1],e:[1,0],se:[1,1],s:[0,1],sw:[-1,1],w:[-1,0]};
  const LIMITS=Object.freeze({minScale:1e-6,maxScale:1e6});
  const finite=Number.isFinite;
  function fail(message){throw new TypeError(message);}
  function point(value,name){if(!value||!finite(value.x)||!finite(value.y))fail((name||'Point')+' must have finite x and y');return {x:value.x,y:value.y};}
  function affine(value){if(!Array.isArray(value)||value.length!==6||!value.every(finite))fail('Affine matrix must contain six finite numbers');return value;}
  function checkedMatrix(value){affine(value);return value;}
  // Column-vector SVG convention: multiply(left,right) applies right first.
  function multiply(left,right){
    const [a,b,c,d,e,f]=affine(left),[g,h,i,j,k,l]=affine(right);
    return checkedMatrix([a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f]);
  }
  function inverse(value){
    const [a,b,c,d,e,f]=affine(value),det=a*d-b*c;
    if(!finite(det)||det===0)fail('Affine matrix is not invertible');
    return checkedMatrix([d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det]);
  }
  function applyPoint(matrix,value){const [a,b,c,d,e,f]=affine(matrix),p=point(value);return point({x:a*p.x+c*p.y+e,y:b*p.x+d*p.y+f},'Transformed point');}
  function bounds(value){
    const p=point(value,'Bounds');if(!finite(value.width)||!finite(value.height)||value.width<0||value.height<0)fail('Bounds must have nonnegative finite dimensions');
    if(!finite(p.x+value.width)||!finite(p.y+value.height))fail('Bounds overflow');return {...p,width:value.width,height:value.height};
  }
  function booleanOption(options,key){if(options[key]!==undefined&&typeof options[key]!=='boolean')fail(key+' must be boolean');return options[key];}
  function optionsFor(value,corner){
    if(!value||typeof value!=='object'||Array.isArray(value))fail('Options must be an object');
    const explicit=booleanOption(value,'lockAspect'),shift=booleanOption(value,'shiftKey')||false,centered=booleanOption(value,'altKey')||false;
    const minScale=value.minScale??.01,maxScale=value.maxScale??100;
    if(!finite(minScale)||!finite(maxScale)||minScale<LIMITS.minScale||maxScale>LIMITS.maxScale||minScale>maxScale)fail('Scale limits must be positive, ordered and within supported bounds');
    const requested=value.minSize??.5,minSize=typeof requested==='number'?{width:requested,height:requested}:requested;
    if(!minSize||!finite(minSize.width)||!finite(minSize.height)||minSize.width<0||minSize.height<0)fail('Minimum size must be nonnegative');
    const guides=value.guides??{},threshold=value.snapThreshold??0;
    if(!guides||typeof guides!=='object'||Array.isArray(guides)||!finite(threshold)||threshold<0)fail('Snap settings are invalid');
    for(const axis of ['x','y'])if(guides[axis]!==undefined&&(!Array.isArray(guides[axis])||!guides[axis].every(finite)))fail('Guides must be finite coordinates');
    return {lockAspect:corner&&shift?!(explicit??true):(explicit??corner),centered,minScale,maxScale,minSize,guides,threshold};
  }
  const close=(a,b)=>Math.abs(a-b)<=32*Number.EPSILON*Math.max(1,Math.abs(a),Math.abs(b));
  function resizeBox(input,handle,requestedPoint,options={}){
    const original=bounds(input),requested=point(requestedPoint);if(typeof handle!=='string'||!Object.hasOwn(HANDLES,handle))fail('Unknown resize handle');const direction=HANDLES[handle];
    const [hx,hy]=direction,corner=!!(hx&&hy),cfg=optionsFor(options,corner),center={x:original.x+original.width/2,y:original.y+original.height/2};
    // A side handle anchors its inactive axis at the centre. If aspect is
    // explicitly locked, the orthogonal dimension therefore grows symmetrically.
    const anchor={x:cfg.centered||!hx?center.x:hx<0?original.x+original.width:original.x,y:cfg.centered||!hy?center.y:hy<0?original.y+original.height:original.y};
    const initialPoint={x:hx<0?original.x:hx>0?original.x+original.width:center.x,y:hy<0?original.y:hy>0?original.y+original.height:center.y};
    const vector={x:initialPoint.x-anchor.x,y:initialPoint.y-anchor.y};
    const active={x:!!hx&&vector.x!==0,y:!!hy&&vector.y!==0};
    const minimum={x:original.width?Math.max(cfg.minScale,cfg.minSize.width/original.width):cfg.minScale,y:original.height?Math.max(cfg.minScale,cfg.minSize.height/original.height):cfg.minScale};
    const limit=(value,min)=>Math.max(Math.min(min,cfg.maxScale),Math.min(cfg.maxScale,value));
    let sx=1,sy=1,clamped=false,minimumUnreachable=false;
    if(cfg.lockAspect&&(active.x||active.y)){
      // Orthogonal projection onto the aspect-preserving handle ray keeps the
      // resulting corner as close as possible to the pointer in canvas space.
      const denominator=vector.x*vector.x+vector.y*vector.y;
      const raw=((requested.x-anchor.x)*vector.x+(requested.y-anchor.y)*vector.y)/denominator;
      if(!finite(raw))fail('Resize geometry overflow');
      const min=Math.max(original.width?minimum.x:cfg.minScale,original.height?minimum.y:cfg.minScale);
      sx=sy=limit(raw,min);clamped=!close(sx,raw);minimumUnreachable=min>cfg.maxScale;
    }else{
      if(active.x){const raw=(requested.x-anchor.x)/vector.x;if(!finite(raw))fail('Resize geometry overflow');sx=limit(raw,minimum.x);clamped||=!close(sx,raw);minimumUnreachable||=minimum.x>cfg.maxScale;}
      if(active.y){const raw=(requested.y-anchor.y)/vector.y;if(!finite(raw))fail('Resize geometry overflow');sy=limit(raw,minimum.y);clamped||=!close(sy,raw);minimumUnreachable||=minimum.y>cfg.maxScale;}
    }
    if(cfg.threshold>0){
      const candidates=[];
      for(const axis of ['x','y']){
        if(!active[axis])continue;const current=anchor[axis]+vector[axis]*(axis==='x'?sx:sy);
        for(const guide of cfg.guides[axis]||[]){
          const distance=Math.abs(current-guide);if(distance>cfg.threshold)continue;
          const factor=(guide-anchor[axis])/vector[axis],min=cfg.lockAspect?Math.max(original.width?minimum.x:cfg.minScale,original.height?minimum.y:cfg.minScale):minimum[axis];
          // A guide across the anchor or beyond the allowed scale cannot create
          // a flip or falsely claim snapping after a size clamp.
          if(!finite(factor)||factor<=0||!close(limit(factor,min),factor))continue;
          candidates.push({axis,guide,factor,distance});
        }
      }
      candidates.sort((a,b)=>a.distance-b.distance||(a.axis===b.axis?a.guide-b.guide:a.axis==='x'?-1:1));
      if(cfg.lockAspect){if(candidates.length)sx=sy=candidates[0].factor;}
      else for(const axis of ['x','y']){const snap=candidates.find(item=>item.axis===axis);if(snap){if(axis==='x')sx=snap.factor;else sy=snap.factor;}}
    }
    const matrix=checkedMatrix([sx,0,0,sy,anchor.x*(1-sx),anchor.y*(1-sy)]);
    const next=bounds({x:anchor.x+(original.x-anchor.x)*sx,y:anchor.y+(original.y-anchor.y)*sy,width:original.width*sx,height:original.height*sy});
    const finalPoint=point({x:anchor.x+vector.x*sx,y:anchor.y+vector.y*sy}),snapped={};
    if(cfg.threshold>0)for(const axis of ['x','y'])if(active[axis]){
      const matches=(cfg.guides[axis]||[]).filter(guide=>close(finalPoint[axis],guide));if(matches.length)snapped[axis]=matches.sort((a,b)=>a-b)[0];
    }
    return {bounds:next,scaleX:sx,scaleY:sy,matrix,anchor,point:finalPoint,handle,lockAspect:cfg.lockAspect,centered:cfg.centered,snapped,clamped,minimumUnreachable,degenerate:{x:original.width===0,y:original.height===0}};
  }
  return Object.freeze({resizeBox,multiply,inverse,applyPoint,handles:Object.freeze(Object.keys(HANDLES)),limits:LIMITS});
});
