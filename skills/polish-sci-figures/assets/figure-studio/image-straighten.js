/* Two-point ruler straightening is a global rigid rotation followed by an
 * inscribed crop. No perspective, lane-wise warp, fill or reconstruction. */
'use strict';
const StudioImageStraighten = (() => {
  const MAX_SIDE=4096, MAX_PIXELS=12000000, MAX_SOURCE_PIXELS=32000000;
  function fail(code){const text={INVALID_SIZE:'原图尺寸无效或超过本地处理上限。 / Invalid or oversized source dimensions.',INVALID_RULER:'请选择两个有效的原图像素点。 / Select two valid original-pixel points.',OUT_OF_BOUNDS:'标尺点必须位于原图内。 / Ruler points must be within the original image.',INVALID_BOUNDS:'裁剪边界必须是原图内的有效矩形。 / Crop bounds must be a valid rectangle inside the source.',SHORT_RULER:'标尺太短；至少需要 8 像素及原图对角线的 1%。 / The ruler must span at least 8 pixels and 1% of the source diagonal.',ANGLE_TARGET_MISMATCH:'标尺与目标方向相差超过 45°，请切换横向或竖向目标。 / The ruler differs from the target by more than 45 degrees; switch horizontal/vertical target.',NO_USABLE_RECTANGLE:'当前裁剪范围过窄，无法生成有效的拉正图片。 / The crop is too narrow to produce a usable straightened image.'};const e=new Error(text[code]||text.INVALID_RULER);e.code=code;throw e;}
  const finite=Number.isFinite;
  function boundsFor(value,width,height){
    const b=value===undefined?{x:0,y:0,width,height}:value;
    if(!b||typeof b!=='object'||!['x','y','width','height'].every(k=>finite(b[k]))||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>width||b.y+b.height>height)fail('INVALID_BOUNDS');
    return {x:b.x,y:b.y,width:b.width,height:b.height};
  }
  function maximumRectangle(width,height,angle){
    const c=Math.cos(Math.abs(angle)),s=Math.sin(Math.abs(angle)),den=c*c-s*s,candidates=[];
    const add=(w,h)=>{if(finite(w)&&finite(h)&&w>0&&h>0&&c*w+s*h<=width+1e-7&&s*w+c*h<=height+1e-7)candidates.push({width:w,height:h});};
    // At a maximum of log(w)+log(h), either both linear footprint constraints
    // are active, or one is active at its equal-contribution stationary point.
    if(Math.abs(den)>1e-12)add((width*c-height*s)/den,(height*c-width*s)/den);
    if(s>1e-12){add(width/(2*c),width/(2*s));add(height/(2*s),height/(2*c));}
    if(!candidates.length)fail('NO_USABLE_RECTANGLE');
    candidates.sort((a,b)=>b.width*b.height-a.width*a.height);return candidates[0];
  }
  function fromRuler(points,{width,height,bounds,target='horizontal'}={}){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>32767||height>32767||width*height>MAX_SOURCE_PIXELS)fail('INVALID_SIZE');
    if(!Array.isArray(points)||points.length!==2||points.some(p=>!p||!finite(p.x)||!finite(p.y)))fail('INVALID_RULER');
    if(points.some(p=>p.x<0||p.y<0||p.x>width||p.y>height))fail('OUT_OF_BOUNDS');
    if(!['horizontal','vertical'].includes(target))fail('INVALID_RULER');
    const b=boundsFor(bounds,width,height),originalPoints=points.map(p=>({x:p.x,y:p.y}));let dx=points[1].x-points[0].x,dy=points[1].y-points[0].y;
    const length=Math.hypot(dx,dy),minimumLength=Math.max(8,Math.hypot(width,height)*.01);if(length<minimumLength)fail('SHORT_RULER');
    // A ruler defines an unoriented line. Reversing its endpoints must neither
    // flip the image nor select the other 180-degree rotation.
    if(dx<0||dx===0&&dy<0){dx=-dx;dy=-dy;}
    const angle=Math.atan2(dy,dx),targetAngle=target==='horizontal'?0:Math.PI/2;
    let delta=angle-targetAngle;while(delta>Math.PI/2)delta-=Math.PI;while(delta<=-Math.PI/2)delta+=Math.PI;
    if(Math.abs(delta)>Math.PI/4+1e-12)fail('ANGLE_TARGET_MISMATCH');
    const maximum=maximumRectangle(b.width,b.height,delta),plannedStep=Math.max(1,maximum.width/MAX_SIDE,maximum.height/MAX_SIDE,Math.sqrt(maximum.width*maximum.height/MAX_PIXELS));
    const outputWidth=Math.floor(maximum.width/plannedStep),outputHeight=Math.floor(maximum.height/plannedStep);
    if(outputWidth<1||outputHeight<1||outputWidth>MAX_SIDE||outputHeight>MAX_SIDE||outputWidth*outputHeight>MAX_PIXELS)fail('NO_USABLE_RECTANGLE');
    const c=Math.cos(delta),s=Math.sin(delta),cx=b.x+b.width/2,cy=b.y+b.height/2;
    // Quantize the crop inwards with a COMMON source/output pixel step. Merely
    // rounding the two output dimensions would introduce nonuniform scaling.
    let step=Math.min(plannedStep,b.width/(Math.abs(c)*outputWidth+Math.abs(s)*outputHeight),b.height/(Math.abs(s)*outputWidth+Math.abs(c)*outputHeight));
    const cornersAt=value=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:cx+(x*c*outputWidth-y*s*outputHeight)*value/2,y:cy+(x*s*outputWidth+y*c*outputHeight)*value/2}));
    let corners=cornersAt(step);
    const outside=p=>p.x<b.x||p.x>b.x+b.width||p.y<b.y||p.y>b.y+b.height;
    // Strict boundary consumers reject even one floating-point ULP outside.
    // A common microscopic inward contraction preserves the rigid geometry.
    if(corners.some(outside)){step*=1-1e-12;corners=cornersAt(step);}
    if(corners.some(outside))fail('NO_USABLE_RECTANGLE');
    const angleDegrees=angle*180/Math.PI,rotationDegrees=-delta*180/Math.PI;
    const audit={schema:'figure-studio-ruler-straightening/1',method:'two-point global rigid straightening with inscribed crop',sourceWidth:width,sourceHeight:height,target,rulerPoints:originalPoints,lineLength:length,minimumRulerLength:minimumLength,angleDegrees,rotationDegrees,bounds:b,corners:corners.map(p=>({...p})),outputWidth,outputHeight,sourcePixelsPerOutputPixel:step,continuousMaximumWidth:maximum.width,continuousMaximumHeight:maximum.height,continuousMaximumArea:maximum.width*maximum.height,retainedArea:outputWidth*outputHeight*step*step,quantization:'common pixel step with inward integer crop',uniformScale:true,perspectiveCorrected:false,displayOnly:true,nonGenerative:true,physicalCalibrationInherited:false,boundaryConvention:'original pixel boundaries 0..width and 0..height',outsideFill:false};
    return {corners,angleDegrees,rotationDegrees,outputWidth,outputHeight,audit};
  }
  return {fromRuler,limits:Object.freeze({maxSide:MAX_SIDE,maxPixels:MAX_PIXELS,maxSourcePixels:MAX_SOURCE_PIXELS,minimumRulerPixels:8,minimumRulerDiagonalFraction:.01,maxTargetDifferenceDegrees:45})};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageStraighten;
