/* Reliable chart component targets for scoped formatting. No figure mutation,
 * numeric inference or positional classification of unlabelled imported PDFs. */
'use strict';
const StudioComponentStyle=(()=>{
  const ROLES=['axes','ticks','axis','legend'],DEFS='defs,clipPath,mask,pattern,symbol';
  const idIs=(node,part)=>new RegExp('(?:^|[-_])'+part+'$').test(node?.id||'');
  const G=()=>typeof StudioImageInsets!=='undefined'?StudioImageInsets:require('./image-insets.js');
  function segment(node){
    if(node?.localName==='line'){const values=['x1','y1','x2','y2'].map(k=>Number(node.getAttribute(k)||0));return values.every(Number.isFinite)?[{x:values[0],y:values[1]},{x:values[2],y:values[3]}]:null;}
    if(node?.localName!=='path')return null;
    const n='([+-]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][+-]?\\d+)?)',d=(node.getAttribute('d')||'').trim(),match=d.match(new RegExp('^M\\s*'+n+'[\\s,]+'+n+'\\s*L\\s*'+n+'[\\s,]+'+n+'\\s*$'));
    if(!match)return null;const v=match.slice(1).map(Number);return v.every(Number.isFinite)?[{x:v[0],y:v[1]},{x:v[2],y:v[3]}]:null;
  }
  function collect(svg,{lockedKeys=[]}={}){
    const result=Object.fromEntries(ROLES.map(role=>[role,[]]));if(svg?.localName!=='svg')return result;
    const locked=new Set(lockedKeys),visibility=new Map(),ids=new Map(),tickGroups=new Map(),candidates=[];
    for(const node of svg.querySelectorAll('[id]')){const id=node.id;if(ids.has(id))ids.set(id,null);else ids.set(id,node);}
    function available(node){
      if(!node||node.closest(DEFS))return false;if(visibility.has(node))return visibility.get(node);
      const value=name=>node.style?.getPropertyValue(name)||node.getAttribute(name)||'',opacity=value('opacity');
      let ok=!locked.has(node.getAttribute('data-key'))&&value('display')!=='none'&&!['hidden','collapse'].includes(value('visibility'))&&!(opacity!==''&&Number(opacity)===0);
      // Only attached DOM has a useful computed cascade; detached SVG sources
      // retain their sanitized presentation attributes and inline styles.
      if(ok&&node.isConnected){const view=node.ownerDocument?.defaultView,style=view?.getComputedStyle?.(node);if(style)ok=style.display!=='none'&&!['hidden','collapse'].includes(style.visibility)&&!(style.opacity!==''&&Number(style.opacity)===0);}
      if(ok&&node!==svg)ok=available(node.parentElement);visibility.set(node,ok);return ok;
    }
    const ancestors=node=>{const list=[];for(let p=node;p&&p!==svg;p=p.parentElement)list.push(p);return list;};
    const withKey=node=>!!node.getAttribute('data-key');
    function unlockedText(node){return available(node)&&(!locked.size||![...node.querySelectorAll('[data-key]')].some(child=>locked.has(child.getAttribute('data-key'))));}
    for(const text of svg.querySelectorAll('text')){
      if(!withKey(text)||!text.textContent.trim()||!unlockedText(text))continue;
      const explicit=text.getAttribute('data-role'),parents=ancestors(text),role=['ticks','axis','legend'].includes(explicit)?explicit:parents.some(p=>idIs(p,'legend_\\d+'))?'legend':parents.some(p=>idIs(p,'[xy]tick_\\d+'))?'ticks':parents.some(p=>idIs(p,'matplotlib\\.axis_\\d+'))?'axis':null;
      if(role)result[role].push(text);
    }
    // A tick <use> references one perpendicular stroke. Grid paths inside the
    // same tick group are deliberately excluded; their artist is not a tick.
    for(const use of svg.querySelectorAll('use')){
      if(!withKey(use)||!available(use))continue;
      const parents=ancestors(use),tick=parents.find(p=>idIs(p,'[xy]tick_\\d+')),axis=tick&&ancestors(tick.parentElement).find(p=>idIs(p,'matplotlib\\.axis_\\d+'));
      if(!tick||!axis)continue;
      const href=use.getAttribute('href')||use.getAttributeNS('http://www.w3.org/1999/xlink','href')||'',definition=href.startsWith('#')?ids.get(href.slice(1)):null,shape=segment(definition);
      if(!shape||Math.hypot(shape[1].x-shape[0].x,shape[1].y-shape[0].y)<=0)continue;
      result.axes.push(use);if(!tickGroups.has(axis))tickGroups.set(axis,[]);tickGroups.get(axis).push(use);
    }
    for(const node of svg.querySelectorAll('path,line,polyline')){
      if(!withKey(node)||!available(node))continue;
      if(['axes','axis-line','axis-tick'].includes(node.getAttribute('data-role'))){result.axes.push(node);continue;}
      const patch=node.parentElement,axes=patch?.parentElement;
      if(!idIs(patch,'patch_\\d+')||!idIs(axes,'axes_\\d+')||!segment(node))continue;
      // Matplotlib spines are unfilled, unclipped direct axes/patch artists.
      // A clipping region or polygon is a plot/data patch, not a spine.
      const fill=node.style?.fill||node.getAttribute('fill')||'';
      if(fill&&fill!=='none'||ancestors(node).some(p=>['clip-path','mask','filter'].some(k=>{const v=p.style?.getPropertyValue(k)||p.getAttribute(k);return v&&v!=='none';})))continue;
      candidates.push({node,axes});
    }
    // Numeric extrapolation is unnecessary for formatting: categorical and
    // scientific-notation axes are still identifiable by their tick family.
    // Require at least two distinct tick positions on the spine, not closeness
    // to arbitrary data or a colour match.
    for(const {node,axes}of candidates){
      try{
        const geometry=G(),m=geometry.relativeMatrix(node,svg),ends=segment(node).map(p=>geometry.point(m,p)),dx=ends[1].x-ends[0].x,dy=ends[1].y-ends[0].y,length=Math.hypot(dx,dy);if(!Number.isFinite(length)||length<=0)continue;
        const tolerance=Math.max(1e-6,length*1e-6);let matched=false;
        for(const [axis,uses]of tickGroups){if(axis.parentElement!==axes)continue;const positions=[];
          for(const use of uses){const p=geometry.point(geometry.relativeMatrix(use,svg),{x:Number(use.getAttribute('x')||0),y:Number(use.getAttribute('y')||0)}),cross=((p.x-ends[0].x)*dy-(p.y-ends[0].y)*dx)/length,along=((p.x-ends[0].x)*dx+(p.y-ends[0].y)*dy)/length;if(Number.isFinite(cross)&&Math.abs(cross)<=tolerance&&along>=-tolerance&&along<=length+tolerance&&!positions.some(v=>Math.abs(v-along)<tolerance))positions.push(along);}
          if(positions.length>=2){matched=true;break;}
        }
        if(matched)result.axes.push(node);
      }catch{/* Unsupported imported transforms stay available for direct editing. */}
    }
    return result;
  }
  function targets(svg,role,options){if(!ROLES.includes(role))return [];return collect(svg,options)[role];}
  function inspect(svg,options){return Object.fromEntries(Object.entries(collect(svg,options)).map(([role,nodes])=>[role,nodes.length]));}
  return {targets,inspect};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioComponentStyle;
