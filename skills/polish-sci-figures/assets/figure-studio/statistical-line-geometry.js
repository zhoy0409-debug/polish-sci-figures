/* Presentation-only statistical connector geometry. All coordinates are in
 * the path's space, BEFORE object-transform/offsets. Capture once per gesture;
 * map pointer coordinates through the existing inverse CTM in the host.
 * A returned patch uses the existing physical-pt stat-left/stat-right fields.
 * No group binding, P value, text, transform, DOM or history is changed here. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.StudioStatisticalLineGeometry=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const shapes=new Set(['bracket','line','rounded']),LIMIT=500;
  const finite=Number.isFinite,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function number(n,label){if(!finite(n)||Math.abs(n)>1e8)throw TypeError('Invalid '+label);return n;}
  function extension(props,key){const value=props[key]??0,n=typeof value==='number'?value:Number(value);if(!finite(n)||Math.abs(n)>LIMIT)throw TypeError('Invalid '+key);return n;}
  function snapshot(geometry,props={},options={}){
    if(!geometry||!props||!options)throw TypeError('Missing statistical geometry');
    const left=number(geometry.left,'left endpoint'),right=number(geometry.right,'right endpoint'),y=number(geometry.y,'height'),unit=number(geometry.unit,'unit');
    if(unit<=0||right<=left)throw TypeError('Statistical line must have positive width and unit');
    const width=right-left,center=(left+right)/2,extLeft=extension(props,'stat-left'),extRight=extension(props,'stat-right');
    const shape=props['stat-shape']||geometry.shape||'bracket';if(!shapes.has(shape))throw TypeError('Invalid statistical line shape');
    // Normal saved lines reveal their automatic span exactly. A formerly
    // inverted, clamped line needs its explicit metadata span, never a guess.
    const inferred=width>2*unit+1e-8?width-(extLeft+extRight)*unit:undefined;
    const automaticWidth=geometry.automaticWidth??inferred;
    if(automaticWidth!==undefined&&(!finite(automaticWidth)||automaticWidth<=0||automaticWidth>1e8))throw TypeError('Invalid automatic width');
    const minPt=options.minWidthPt??8;if(!finite(minPt)||minPt<2||minPt>100)throw TypeError('Invalid minimum readable width');
    const minWidth=Math.min(width,minPt*unit),baseCenter=center-(extRight-extLeft)*unit/2;
    return Object.freeze({left,right,y,unit,width,center,shape,extLeft,extRight,automaticWidth,
      baseLeft:automaticWidth===undefined?undefined:baseCenter-automaticWidth/2,
      baseRight:automaticWidth===undefined?undefined:baseCenter+automaticWidth/2,
      minWidth,percent:automaticWidth===undefined?null:100*width/automaticWidth});
  }
  function fromPath(d,props={},options={}){
    if(typeof d!=='string'||d.length>2048)throw TypeError('Invalid statistical path');
    const tokens=d.match(/[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[];
    if(d.replace(/[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g,'').replace(/[\s,]/g,''))throw TypeError('Invalid statistical path');
    const commands=tokens.filter(t=>/^[A-Za-z]$/.test(t)).join(''),values=tokens.filter(t=>!(/^[A-Za-z]$/.test(t))).map(Number);
    if(values.some(v=>!finite(v)))throw TypeError('Invalid statistical path coordinates');
    let left,right,y,shape;
    if(commands==='MH'&&values.length===3){[left,y,right]=values;shape='line';}
    else if(commands==='MVHV'&&values.length===5){left=values[0];y=values[2];right=values[3];shape='bracket';}
    else if(commands==='MVQHQV'&&values.length===13){left=values[0];y=values[4];right=values[8];shape='rounded';}
    else throw TypeError('Unsupported statistical connector path');
    return snapshot({left,right,y,shape,unit:options.unit,automaticWidth:options.automaticWidth},props,options);
  }
  function path(left,right,y,unit,shape){
    const tip=3*unit,r=Math.min(2*unit,(right-left)/4);
    if(shape==='line')return `M ${left} ${y} H ${right}`;
    if(shape==='rounded')return `M ${left} ${y+tip} V ${y+r} Q ${left} ${y} ${left+r} ${y} H ${right-r} Q ${right} ${y} ${right} ${y+r} V ${y+tip}`;
    return `M ${left} ${y+tip} V ${y} H ${right} V ${y+tip}`;
  }
  const text=n=>String(Object.is(n,-0)?0:+n.toFixed(9));
  function result(s,left,right,requestedWidth,shape=s.shape){
    const a=s.baseLeft??s.left+s.extLeft*s.unit,b=s.baseRight??s.right-s.extRight*s.unit;
    const patch={'stat-left':text((a-left)/s.unit),'stat-right':text((right-b)/s.unit)};
    const width=right-left;
    return {patch,left,right,y:s.y,width,center:(left+right)/2,percent:s.automaticWidth===undefined?null:100*width/s.automaticWidth,
      clamped:Math.abs(width-requestedWidth)>1e-7,d:path(left,right,s.y,s.unit,shape)};
  }
  function setWidth(s,requestedWidth){
    number(requestedWidth,'requested width');if(requestedWidth<=0)throw TypeError('Width must be positive');
    const a=s.baseLeft??s.left+s.extLeft*s.unit,b=s.baseRight??s.right-s.extRight*s.unit;
    const maxHalf=Math.min(s.center-a+LIMIT*s.unit,b-s.center+LIMIT*s.unit);
    const minHalf=Math.max(s.minWidth/2,s.center-a-LIMIT*s.unit,b-s.center-LIMIT*s.unit);
    if(maxHalf<minHalf)throw TypeError('Statistical line cannot retain its centre within edit limits');
    const half=clamp(requestedWidth/2,minHalf,maxHalf);
    return result(s,s.center-half,s.center+half,requestedWidth);
  }
  function scaleWidth(s,factor){number(factor,'width factor');if(factor<=0)throw TypeError('Width factor must be positive');return setWidth(s,s.width*factor);}
  function setWidthPercent(s,percent){number(percent,'width percent');if(percent<=0||s.automaticWidth===undefined)throw TypeError('A positive percentage and automatic span are required');return setWidth(s,s.automaticWidth*percent/100);}
  function moveEndpoint(s,side,x,options={}){
    number(x,'endpoint');if(!['left','right'].includes(side))throw TypeError('Unknown statistical endpoint');
    if(options.centered!==undefined&&typeof options.centered!=='boolean')throw TypeError('Invalid centred drag');
    if(options.centered)return setWidth(s,Math.max(s.minWidth,2*(side==='left'?s.center-x:x-s.center)));
    const a=s.baseLeft??s.left+s.extLeft*s.unit,b=s.baseRight??s.right-s.extRight*s.unit;
    const left=side==='left'?clamp(x,a-LIMIT*s.unit,Math.min(a+LIMIT*s.unit,s.right-s.minWidth)):s.left;
    const right=side==='right'?clamp(x,Math.max(b-LIMIT*s.unit,s.left+s.minWidth),b+LIMIT*s.unit):s.right;
    return result(s,left,right,side==='left'?s.right-x:x-s.left);
  }
  function setShape(s,shape){if(!shapes.has(shape))throw TypeError('Invalid statistical line shape');return {patch:{'stat-shape':shape},d:path(s.left,s.right,s.y,s.unit,shape)};}
  return Object.freeze({snapshot,fromPath,scaleWidth,setWidthPercent,moveEndpoint,setShape});
});
