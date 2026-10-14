/* Browser interaction helpers implemented independently for Figure Studio.
 * Behavior references: VectorCraft 0a33cff3f6e2a1e9e672f4c3816f58cd8d3d032e,
 * crates/tools/src/select.rs:339,545 and crates/tools/src/bbox.rs:106.
 * No Rust engine, artwork, branding or interface resources are copied here.
 */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.StudioVectorInteraction=api;})(typeof window!=='undefined'?window:globalThis,()=>{
  'use strict';
  const finite=value=>typeof value==='number'&&Number.isFinite(value),clean=value=>Object.is(value,-0)?0:value;

  function constrainDelta(dx,dy,shift=false){
    if(!finite(dx)||!finite(dy))throw TypeError('Invalid movement coordinates');
    if(!shift||dx===0&&dy===0)return {dx:clean(dx),dy:clean(dy)};
    // Project onto the nearest permitted direction. Axis drags retain their
    // moving component; diagonals share one scalar, with no trigonometric dust.
    const x=Math.abs(dx),y=Math.abs(dy),direction=Math.round(Math.atan2(y,x)/(Math.PI/4));
    if(direction===0)return {dx:clean(dx),dy:0};
    if(direction===2)return {dx:0,dy:clean(dy)};
    const amount=x/2+y/2;return {dx:clean(Math.sign(dx)*amount),dy:clean(Math.sign(dy)*amount)};
  }

  function constrainedMove(dx,dy,{shift=false,snap}={}){
    const base=constrainDelta(dx,dy,shift),unchanged=()=>({...base,guides:[]});
    // A diagonal snap needs a scalar-on-line solution. Until that exists,
    // retain the exact direction and do not announce a discarded guide.
    if(typeof snap!=='function'||shift&&(base.dx===0&&base.dy===0||base.dx!==0&&base.dy!==0))return unchanged();
    let result;try{result=snap(base.dx,base.dy);}catch{return unchanged();}
    if(!result||!finite(result.dx)||!finite(result.dy))return unchanged();
    const guides=Array.isArray(result.guides)?result.guides.filter(g=>g&&typeof g==='object'):[];
    if(!shift)return {dx:clean(result.dx),dy:clean(result.dy),guides};
    const axis=base.dy===0?'x':'y';return {dx:axis==='x'?clean(result.dx):0,dy:axis==='y'?clean(result.dy):0,guides:guides.filter(g=>g.axis===axis)};
  }

  function sourceEligible(node,svg){
    if(!node||node.nodeType!==1||node===svg||!svg.contains(node)||node.localName==='svg')return false;
    if(node.closest?.('[data-editor-guides],defs,clipPath,mask,pattern,symbol'))return false;
    // State-based locks, classes and scientific metadata remain the host's
    // responsibility. These explicit DOM states also guard default callers.
    for(let current=node;current;current=current.parentElement){
      if(current.hasAttribute('hidden')||current.getAttribute('aria-hidden')==='true'||current.getAttribute('data-locked')==='true'||current.getAttribute('data-hidden')==='true')return false;
      const style=current.style,display=style?.display||current.getAttribute('display'),visibility=style?.visibility||current.getAttribute('visibility'),opacity=style?.opacity||current.getAttribute('opacity');
      if(display==='none'||visibility==='hidden'||visibility==='collapse'||opacity!==null&&opacity!==''&&Number(opacity)===0)return false;
      if(current===svg)break;
    }
    return true;
  }

  function pickBehind({svg,x,y,normalize=node=>node,isEditable=()=>true,isSelected=()=>false}={}){
    if(!svg||typeof svg.contains!=='function'||!finite(x)||!finite(y)||typeof normalize!=='function'||typeof isEditable!=='function'||typeof isSelected!=='function')return null;
    const document=svg.ownerDocument;if(typeof document?.elementsFromPoint!=='function')return null;
    let hits;try{hits=document.elementsFromPoint(x,y);}catch{return null;}
    const candidates=[],seen=new Set();
    for(const hit of hits||[]){
      if(!hit||hit.nodeType!==1||hit===svg||!svg.contains(hit)||hit.closest?.('[data-editor-guides],defs,clipPath,mask,pattern,symbol'))continue;
      // A transparent statistical hit proxy can be aria-hidden itself. Resolve
      // it first, then check the real source rather than rejecting the proxy.
      const source=normalize(hit);
      if(!sourceEligible(source,svg)||seen.has(source)||!isEditable(source,hit))continue;
      seen.add(source);candidates.push(source);
    }
    if(!candidates.length)return null;
    let current=-1;for(let i=0;i<candidates.length;i++)if(isSelected(candidates[i]))current=i;
    return candidates[(current+1)%candidates.length];
  }

  return {constrainDelta,constrainedMove,pickBehind};
});
