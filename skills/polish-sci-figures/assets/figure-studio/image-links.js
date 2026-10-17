/* Persistent image-to-detail relationships, drawn from original pixel geometry.
 * No raster copies, screenshots, feature guessing or automatic color matching. */
'use strict';
const StudioImageLinks=(()=>{
  const NS='http://www.w3.org/2000/svg',EPS=1e-8,MAX_LINKS=1000;
  const directions=['normal','rotate90','rotate180','rotate270','flipX','flipY','transpose','transverse'];
  const fail=(message)=>{throw new Error(message);},numeric=v=>typeof v==='number'&&Number.isFinite(v),token=v=>typeof v==='string'&&/^[\w.:-]{1,160}$/.test(v);
  const api=()=>typeof StudioImageInsets!=='undefined'?StudioImageInsets:globalThis.StudioImageInsets;
  function reference(ref){
    if(!ref||typeof ref!=='object'||Array.isArray(ref))fail('图片关联引用无效。');
    if(Object.hasOwn(ref,'insetId')){if(Object.keys(ref).length!==1||!token(ref.insetId))fail('局部放大引用无效。');return {insetId:ref.insetId};}
    if(Object.keys(ref).some(k=>!['panelId','variant','key'].includes(k))||!token(ref.panelId)||!token(ref.key)||!Number.isInteger(ref.variant)||ref.variant<0||ref.variant>10000)fail('图片关联引用无效。');
    return {panelId:ref.panelId,variant:ref.variant,key:ref.key};
  }
  const refKey=ref=>JSON.stringify(reference(ref));
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function polygon(points){
    if(!Array.isArray(points)||points.length!==4||points.some(p=>!p||Object.keys(p).some(k=>!['x','y'].includes(k))||!numeric(p.x)||!numeric(p.y)||p.x<0||p.x>1||p.y<0||p.y>1))fail('图片对应区域必须是图内的四个有效坐标。');
    const values=points.map((p,i)=>cross(p,points[(i+1)%4],points[(i+2)%4]));if(values.some(v=>Math.abs(v)<EPS)||!(values.every(v=>v>0)||values.every(v=>v<0)))fail('图片对应区域必须为不交叉的凸四边形。');
    return points.map(p=>({x:p.x,y:p.y}));
  }
  function validate(value){
    if(!value||typeof value!=='object'||Object.keys(value).some(k=>!['id','parent','child','polygon','visible','connectors','color','stroke','dash','evidence','anchors'].includes(k))||typeof value.id!=='string'||!/[A-Za-z0-9_-]{1,100}/.test(value.id)||!/^[-\w]+$/.test(value.id)||value.id.length>100)fail('图片关联记录无效。');
    const parent=reference(value.parent),child=reference(value.child);if(refKey(parent)===refKey(child))fail('图片不能关联自身。');
    const a={id:value.id,parent,child,polygon:polygon(value.polygon),visible:value.visible??true,connectors:value.connectors??true,color:value.color??'#202020',stroke:value.stroke??1,dash:value.dash??'short'};
    if(typeof a.visible!=='boolean'||typeof a.connectors!=='boolean'||!/^#[a-fA-F0-9]{6}$/.test(a.color)||!numeric(a.stroke)||a.stroke<.25||a.stroke>6||!['short','long','dot','solid'].includes(a.dash))fail('图片关联样式无效。');
    a.color=a.color.toLowerCase();if(value.evidence!==undefined){const e=value.evidence;if(!e||Object.keys(e).some(k=>!['source','score'].includes(k))||!['known-crop','feature-match','manual-confirmed'].includes(e.source)||e.score!==undefined&&(!numeric(e.score)||e.score<0||e.score>1)||e.source==='manual-confirmed'&&e.score!==undefined)fail('图片匹配证据无效。');a.evidence={source:e.source};if(e.score!==undefined)a.evidence.score=e.score;}
    if(value.anchors!==undefined){if(!value.anchors||Object.keys(value.anchors).length!==2||!Object.hasOwn(value.anchors,'parent')||!Object.hasOwn(value.anchors,'child'))fail('图片关联的原图记录无效。');a.anchors={parent:anchor(value.anchors.parent),child:anchor(value.anchors.child)};}
    return a;
  }
  function validateAll(values){
    if(!Array.isArray(values)||values.length>MAX_LINKS)fail('图片关联数量超出处理上限。');const result=values.map(validate),ids=new Set(),edges=new Map();
    for(const a of result){if(ids.has(a.id))fail('图片关联编号重复。');ids.add(a.id);const p=refKey(a.parent);if(!edges.has(p))edges.set(p,[]);edges.get(p).push(refKey(a.child));}
    const done=new Set(),visiting=new Set();function visit(key){if(visiting.has(key))fail('图片关联不能形成循环。');if(done.has(key))return;visiting.add(key);for(const child of edges.get(key)||[])visit(child);visiting.delete(key);done.add(key);}for(const key of edges.keys())visit(key);return result;
  }
  function rawToDisplay(p,orientation='normal'){
    if(!directions.includes(orientation)||!numeric(p?.x)||!numeric(p?.y))fail('图片方向或坐标无效。');const {x,y}=p;
    return {normal:{x,y},rotate90:{x:1-y,y:x},rotate180:{x:1-x,y:1-y},rotate270:{x:y,y:1-x},flipX:{x:1-x,y},flipY:{x,y:1-y},transpose:{x:y,y:x},transverse:{x:1-y,y:1-x}}[orientation];
  }
  function displayToRaw(p,orientation='normal'){return rawToDisplay(p,{rotate90:'rotate270',rotate270:'rotate90'}[orientation]||orientation);}
  function roi(value){
    if(!value||Object.keys(value).some(k=>!['x','y','w','h'].includes(k))||!['x','y','w','h'].every(k=>numeric(value[k]))||value.x<-EPS||value.y<-EPS||value.w<=0||value.h<=0||value.x+value.w>1+EPS||value.y+value.h>1+EPS)fail('图片可见裁剪范围无效。');
    const x=Math.max(0,value.x),y=Math.max(0,value.y),right=Math.min(1,value.x+value.w),bottom=Math.min(1,value.y+value.h);if(right<=x||bottom<=y)fail('图片可见裁剪范围无效。');return {x,y,w:right-x,h:bottom-y};
  }
  function anchor(value){
    if(!value||Object.keys(value).some(k=>!['roi','orientation','widthPx','heightPx','signature'].includes(k))||!Number.isInteger(value.widthPx)||!Number.isInteger(value.heightPx)||value.widthPx<1||value.heightPx<1||value.widthPx>32767||value.heightPx>32767||value.widthPx*value.heightPx>64000000||!directions.includes(value.orientation)||!token(value.signature))fail('图片关联的原图记录无效。');
    return {roi:roi(value.roi),orientation:value.orientation,widthPx:value.widthPx,heightPx:value.heightPx,signature:value.signature};
  }
  const corners=r=>[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
  const href=image=>image?.getAttribute?.('href')||image?.getAttributeNS?.('http://www.w3.org/1999/xlink','href')||'';
  function descriptor(value){
    if(!value?.image||value.image.localName!=='image'||!Number.isInteger(value.widthPx)||!Number.isInteger(value.heightPx)||value.widthPx<1||value.heightPx<1||value.widthPx>32767||value.heightPx>32767||value.widthPx*value.heightPx>64000000||!directions.includes(value.orientation||'normal'))fail('关联图片暂不可用。');
    return {...value,roi:roi(value.roi),orientation:value.orientation||'normal'};
  }
  function knownCropMatch(parentValue,childValue){
    const parent=descriptor(parentValue),child=descriptor(childValue),p=parent.roi,c=child.roi;
    if(!href(parent.image).startsWith('data:image/')||href(parent.image)!==href(child.image)||parent.widthPx!==child.widthPx||parent.heightPx!==child.heightPx)return null;
    if(c.x<p.x-EPS||c.y<p.y-EPS||c.x+c.w>p.x+p.w+EPS||c.y+c.h>p.y+p.h+EPS||Math.abs(c.w-p.w)<EPS&&Math.abs(c.h-p.h)<EPS)return null;
    const points=corners(c).map(q=>rawToDisplay({x:Math.max(0,Math.min(1,(q.x-p.x)/p.w)),y:Math.max(0,Math.min(1,(q.y-p.y)/p.h))},parent.orientation));
    return {polygon:polygon(points),evidence:{source:'known-crop'}};
  }
  function geometry(value,ref,root,snapshot){
    const d=descriptor(value),insets=api();if(!insets)fail('图片坐标模块不可用。');let reached=false;const clips=[];
    if(snapshot&&(d.signature!==snapshot.signature||d.widthPx!==snapshot.widthPx||d.heightPx!==snapshot.heightPx||d.orientation!==snapshot.orientation||['x','y','w','h'].some(k=>Math.abs(d.roi[k]-snapshot.roi[k])>EPS)))fail('关联图片的原图、裁剪或方向已变化，请重新匹配。');
    for(let node=d.image;node;node=node.parentElement){
      if(node.getAttribute('hidden')!==null||node.getAttribute('display')==='none'||node.getAttribute('visibility')==='hidden'||node.style?.display==='none'||node.style?.visibility==='hidden'||node.getAttribute('opacity')!==null&&Number(node.getAttribute('opacity'))<=0||node.style?.opacity!==''&&node.style?.opacity!==undefined&&Number(node.style.opacity)<=0)fail('关联图片已隐藏。');
      if(node.hasAttribute('mask')||node.style?.getPropertyValue('clip-path')||node.style?.getPropertyValue('mask'))fail('关联图片包含无法可靠换算的裁剪。');
      const computed=node.ownerDocument?.defaultView?.getComputedStyle?.(node);if(computed?.display==='none'||computed?.visibility==='hidden'||computed?.opacity!==''&&computed?.opacity!==undefined&&Number(computed.opacity)<=0)fail('关联图片已隐藏。');
      const clip=node.getAttribute('clip-path');if(clip&&clip!=='none')clips.push({node,clip});
      if(node===root){reached=true;break;}
    }
    if(!reached)fail('关联图片已移除。');
    if(!ref.insetId){const owner=d.image.closest('[data-panel]');if(owner&&(owner.getAttribute('data-panel')!==ref.panelId||owner.hasAttribute('data-variant')&&Number(owner.getAttribute('data-variant'))!==ref.variant))fail('关联图片版本已变化。');}
    const m=insets.relativeMatrix(d.image,root),rect=insets.imageRect(d.image,d.widthPx,d.heightPx),orientation=insets.sourceOrientation(d.image,root);
    if(orientation!==d.orientation)fail('关联图片方向已变化。');const r=d.roi,v=rect.visible;
    if(v&&(r.x<v.x-EPS||r.y<v.y-EPS||r.x+r.w>v.x+v.w+EPS||r.y+r.h>v.y+v.h+EPS))fail('关联区域超出图片可见范围。');
    const project=p=>insets.point(m,{x:rect.x+p.x*d.widthPx*rect.sx,y:rect.y+p.y*d.heightPx*rect.sy});
    const quad=corners(r).map(project);
    for(const {node,clip}of clips){
      const match=clip.match(/^url\(#([\w.:-]+)\)$/),defs=match?[...root.querySelectorAll('[id]')].filter(n=>n.id===match[1]):[];if(defs.length!==1)fail('关联图片裁剪引用无效。');
      const def=defs[0],rect=def.children[0];if(def.localName!=='clipPath'||def.children.length!==1||rect?.localName!=='rect'||def.hasAttribute('transform')||def.hasAttribute('style')||def.getAttribute('clipPathUnits')&&def.getAttribute('clipPathUnits')!=='userSpaceOnUse'||rect.hasAttribute('transform')||rect.hasAttribute('style')||rect.hasAttribute('rx')||rect.hasAttribute('ry'))fail('关联图片包含无法可靠换算的裁剪。');
      const coords=['x','y','width','height'].map((key,i)=>{const text=rect.getAttribute(key);if(text==null&&i<2)return 0;if(!/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?$/i.test(text||''))fail('关联图片裁剪尺寸无效。');return Number(text);});
      if(!coords.every(Number.isFinite)||coords[2]<=0||coords[3]<=0)fail('关联图片裁剪尺寸无效。');
      const matrix=node===root?{a:1,b:0,c:0,d:1,e:0,f:0}:insets.relativeMatrix(node,root),bounds=corners({x:coords[0],y:coords[1],w:coords[2],h:coords[3]}).map(p=>insets.point(matrix,p));
      if(quad.some(p=>{const values=bounds.map((q,i)=>cross(q,bounds[(i+1)%4],p));return !(values.every(v=>v>=-EPS)||values.every(v=>v<=EPS));}))fail('关联区域超出图片可见裁剪范围。');
    }
    return {descriptor:d,project,quad};
  }
  const intersects=(a,b,c,d)=>cross(a,b,c)*cross(a,b,d)<-EPS&&cross(c,d,a)*cross(c,d,b)<-EPS;
  function inside(p,poly){const values=poly.map((a,i)=>cross(a,poly[(i+1)%poly.length],p));return values.every(v=>v>EPS)||values.every(v=>v<-EPS);}
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
  function connections(parent,child){
    // Overlapping windows have no exterior pair of detail connectors.
    const separate=[parent,child].some(poly=>poly.some((p,i)=>{const q=poly[(i+1)%4],axis={x:p.y-q.y,y:q.x-p.x},a=parent.map(v=>v.x*axis.x+v.y*axis.y),b=child.map(v=>v.x*axis.x+v.y*axis.y);return Math.max(...a)<Math.min(...b)-EPS||Math.max(...b)<Math.min(...a)-EPS;}));
    if(!separate)return [];
    const candidates=[];for(let p=0;p<4;p++)for(let c=0;c<4;c++){
      const a=parent[p],b=child[c],mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
      if(distance(a,b)<EPS||inside(a,child)||inside(b,parent)||inside(mid,parent)||inside(mid,child))continue;
      if([parent,child].some(poly=>poly.some((v,i)=>intersects(a,b,v,poly[(i+1)%4]))))continue;
      candidates.push({p,c,a,b,length:distance(a,b)});
    }
    let best=null;for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){const a=candidates[i],b=candidates[j];if(a.p===b.p||a.c===b.c||intersects(a.a,a.b,b.a,b.b))continue;const length=a.length+b.length;if(!best||length<best.length)best={length,lines:[a,b]};}
    return best?.lines.map(({a,b})=>[a,b])||[];
  }
  function render(root,values,{resolve,unit=1,parentOnly=false}={}){
    if(!root?.ownerDocument||typeof resolve!=='function'||!numeric(unit)||unit<=0||unit>1000||typeof parentOnly!=='boolean')fail('图片关联绘制环境无效。');
    const all=validateAll(values),doc=root.ownerDocument,group=doc.createElementNS(NS,'g');group.setAttribute('data-image-links','true');
    const make=(name,attrs)=>{const node=doc.createElementNS(NS,name);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
    for(const a of all){if(!a.visible)continue;const item=make('g',{'data-image-link-id':a.id});group.append(item);try{
      const parent=geometry(resolve(a.parent),a.parent,root,a.anchors?.parent),child=parentOnly?null:geometry(resolve(a.child),a.child,root,a.anchors?.child),r=parent.descriptor.roi;
      const poly=a.polygon.map(p=>{const q=displayToRaw(p,parent.descriptor.orientation);return parent.project({x:r.x+q.x*r.w,y:r.y+q.y*r.h});});
      const stroke=a.stroke*unit,attrs={fill:'none',stroke:a.color,'stroke-width':stroke,'pointer-events':'stroke','stroke-linejoin':'round'};
      if(a.dash!=='solid')attrs['stroke-dasharray']=({short:[4,3],long:[8,4],dot:[.5,3]}[a.dash]).map(n=>n*unit).join(' ');if(a.dash==='dot')attrs['stroke-linecap']='round';
      item.append(make('polygon',{...attrs,points:poly.map(p=>p.x+','+p.y).join(' '),'data-image-link-roi':'true'}));
      if(a.connectors&&child)for(const [start,end]of connections(poly,child.quad))item.append(make('line',{...attrs,x1:start.x,y1:start.y,x2:end.x,y2:end.y,'data-image-link-connector':'true'}));
    }catch(error){item.replaceChildren();item.setAttribute('data-image-link-unavailable',String(error.message||'关联图片暂不可用。').slice(0,240));}}
    return group;
  }
  return {validate,validateAll,refKey,rawToDisplay,displayToRaw,knownCropMatch,connections,render,limits:{maxLinks:MAX_LINKS}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageLinks;
