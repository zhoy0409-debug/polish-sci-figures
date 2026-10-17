/* Geometry and local transport for linked image views. Layout never enters history. */
'use strict';
const StudioImageLinksController=(()=>{
  const hrefFor=image=>image?.getAttribute('href')||image?.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';
  const signatures=new Map(),EPS=1e-7;
  // Change detection only. This is not a security or content-authentication hash.
  function signature(href){
    if(signatures.has(href))return signatures.get(href);
    let a=2166136261,b=3339675911;for(let i=0;i<href.length;i++){const c=href.charCodeAt(i);a=Math.imul(a^c,16777619);b=Math.imul(b^c,2246822519);}
    const value=href.length.toString(36)+'-'+(a>>>0).toString(16)+'-'+(b>>>0).toString(16);signatures.set(href,value);
    let bytes=[...signatures.keys()].reduce((sum,key)=>sum+key.length,0);while(bytes>64000000||signatures.size>8){const key=signatures.keys().next().value;bytes-=key.length;signatures.delete(key);}return value;
  }
  const corners=r=>[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
  const anchor=d=>({roi:{...d.roi},orientation:d.orientation,widthPx:d.widthPx,heightPx:d.heightPx,signature:d.signature});
  function resolve(ref,root,state,core=StudioImageInsets){
    try{
      if(!root||!ref)return null;let image,roi;
      if(ref.insetId){
        const a=state.overlays?.find(a=>a.id===ref.insetId&&a.type==='inset');if(!a||!state.order.includes(a.source.panelId))return null;
        const group=[...root.querySelectorAll('[data-annotation]')].find(n=>n.dataset.annotation===ref.insetId);
        if(!group||group.querySelector('[data-inset-unavailable]'))return null;
        image=group.querySelector('[data-inset-window] image');roi={...a.roi};
      }else{
        if(!state.order.includes(ref.panelId)||state.panels[ref.panelId]?.variant!==ref.variant)return null;
        const panel=[...root.querySelectorAll('svg[data-panel]')].find(n=>n.dataset.panel===ref.panelId);
        image=panel&&[...panel.querySelectorAll('image[data-key]')].find(n=>n.dataset.key===ref.key&&!n.closest('defs,[data-inset-content]'));
      }
      if(!image)return null;
      const href=hrefFor(image),dimensions=core.dimensionsFromHref(href),orientation=core.sourceOrientation(image,root),rect=core.imageRect(image,dimensions.widthPx,dimensions.heightPx);
      roi||={...rect.visible};
      // Intersect simple rectangular clips in original pixel space, not screen pixels.
      for(let n=image;n&&n!==root;n=n.parentElement){
        const prop=k=>n.style?.getPropertyValue(k)||n.getAttribute(k)||'';
        if(prop('display')==='none'||['hidden','collapse'].includes(prop('visibility'))||prop('opacity')!==''&&Number(prop('opacity'))===0||prop('mask')&&prop('mask')!=='none')return null;
        const clip=prop('clip-path');if(!clip||clip==='none')continue;
        const match=clip.match(/^url\(#([\w.:-]+)\)$/),defs=match?[...root.querySelectorAll('[id]')].filter(d=>d.id===match[1]):[],def=defs[0],r=def?.children[0];
        if(defs.length!==1||def.localName!=='clipPath'||def.children.length!==1||r?.localName!=='rect'||def.getAttribute('clipPathUnits')&&def.getAttribute('clipPathUnits')!=='userSpaceOnUse'||[def,r].some(d=>['transform','style','rx','ry'].some(k=>d.hasAttribute(k))))return null;
        const values=['x','y','width','height'].map((key,i)=>{const raw=r.getAttribute(key);return raw===null&&i<2?0:/^[+-]?(?:\d*\.)?\d+(?:e[+-]?\d+)?$/i.test(raw||'')?Number(raw):NaN;});
        if(!values.every(Number.isFinite)||values[2]<=0||values[3]<=0)return null;
        const matrix=n===image?{a:1,b:0,c:0,d:1,e:0,f:0}:core.inverse(core.relativeMatrix(image,n)),mapped=corners({x:values[0],y:values[1],w:values[2],h:values[3]}).map(p=>core.point(matrix,p));
        if(mapped.some((p,i)=>{const q=mapped[(i+1)%4];return Math.abs(p.x-q.x)>EPS&&Math.abs(p.y-q.y)>EPS;}))return null;
        const left=Math.max(roi.x,(Math.min(...mapped.map(p=>p.x))-rect.x)/rect.width),top=Math.max(roi.y,(Math.min(...mapped.map(p=>p.y))-rect.y)/rect.height),right=Math.min(roi.x+roi.w,(Math.max(...mapped.map(p=>p.x))-rect.x)/rect.width),bottom=Math.min(roi.y+roi.h,(Math.max(...mapped.map(p=>p.y))-rect.y)/rect.height);
        if(right<=left||bottom<=top)return null;roi={x:left,y:top,w:right-left,h:bottom-top};
      }
      if(!ref.insetId){
        core.sourceInfo({id:'annotation-0',type:'inset',x:0,y:0,w:.1,h:.1,source:{...ref,...dimensions,orientation},roi,connector:false,showScale:false},root);
      }
      return {image,href,roi,...dimensions,orientation,signature:signature(href)};
    }catch{return null;}
  }
  function render(root,state,{core=StudioImageLinks,geometry=StudioImageInsets,links=state.imageLinks||[],onlyPanel=null}={}){
    const owner=ref=>ref.insetId?state.overlays?.find(a=>a.id===ref.insetId)?.source.panelId:ref.panelId;
    const group=root.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');group.setAttribute('data-image-links','true');
    // A linked chain owns its inset's source box, avoiding a second solid box
    // and an old direct-to-overview connector beneath the linked dashed one.
    for(const node of root.querySelectorAll('[data-image-link-suppressed]')){const previous=node.getAttribute('data-image-link-suppressed');if(previous)node.setAttribute('visibility',previous);else node.removeAttribute('visibility');node.removeAttribute('data-image-link-suppressed');}
    for(const link of links){if(!link.child.insetId)continue;const inset=[...root.querySelectorAll('[data-annotation]')].find(n=>n.dataset.annotation===link.child.insetId);for(const node of inset?.querySelectorAll('[data-inset-roi],[data-inset-connector]')||[]){if(!node.hasAttribute('data-image-link-suppressed'))node.setAttribute('data-image-link-suppressed',node.getAttribute('visibility')||'');node.setAttribute('visibility','hidden');}}
    for(const link of links){if(onlyPanel&&owner(link.parent)!==onlyPanel)continue;group.append(core.render(root,[link],{resolve:ref=>resolve(ref,root,state,geometry),parentOnly:!!onlyPanel&&owner(link.child)!==onlyPanel}));}
    return group;
  }
  function create(host){
    const core=host.core||StudioImageLinks,geometry=host.geometry||StudioImageInsets,UI=host.ui||StudioImageLinksUI;
    let preview=null,ui;
    const t=(zh,en)=>String(host.language?.()||'zh').startsWith('en')?en:zh;
    const current=()=>host.state().imageLinks||[];
    const get=ref=>resolve(ref,host.root(),host.state(),geometry);
    function sources(){
      const normal=host.sources().map(r=>({...r})),insets=(host.state().overlays||[]).filter(a=>a.type==='inset').map((a,i)=>({insetId:a.id,label:t('局部放大 ','Zoom inset ')+(i+1),selected:host.selectedInsets?.().includes(a.id),locked:!!a.locked}));
      return [...normal,...insets].filter(ref=>!!get(ref));
    }
    function draw(root=host.root(),state=host.state(),links=preview||state.imageLinks||[]){
      if(!root)return;for(const old of root.querySelectorAll(':scope > [data-image-links]'))old.remove();
      const group=render(root,state,{core,geometry,links});if(links.length)root.append(group);
    }
    async function match(refs,{signal}={}){
      const descriptors=refs.map(get);if(descriptors.some(d=>!d))throw Error(t('图片已变化，请重新选择。','The images changed. Select them again.'));
      const result=[],pending=[];
      for(let i=0;i<refs.length-1;i++){
        const parent=refs[i],child=refs[i+1],p=descriptors[i],c=descriptors[i+1],known=core.knownCropMatch(p,c),anchors={parent:anchor(p),child:anchor(c)};
        if(known)result.push({parent,child,...known,anchors,evidence:{...known.evidence,verified:true}});
        else pending.push(i);
      }
      // Known crops are exact and need neither a running engine nor image analysis.
      if(pending.length){
        const unavailable=reason=>pending.map(i=>({parent:refs[i],child:refs[i+1],polygon:null,evidence:{source:'feature-match',verified:false,reason}}));
        if(!host.engine?.())return [...result,...unavailable('engine-unavailable')];
        const images=descriptors.map((d,i)=>({id:'image-'+i,label:'Image '+(i+1),data:d.href,roi:d.roi}));
        let response,body;try{response=await host.fetch('/api/image-links',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':host.engine().token},body:JSON.stringify({images}),signal});body=await response.json();if(!response.ok)throw Error(body.error||t('图片定位未完成。','Image location could not be completed.'));}catch(error){if(error.name==='AbortError')throw error;if(result.length)return [...result,...unavailable('engine-unavailable')];throw error;}
        if(body.coordinateSpace!=='decoded-image-normalized'||!Array.isArray(body.pairs))throw Error(t('无法核实返回的图片坐标。','The returned image coordinates could not be verified.'));
        for(const i of pending){
          const p=descriptors[i],c=descriptors[i+1],pair=body.pairs.find(a=>a.parentId==='image-'+i&&a.childId==='image-'+(i+1));
          let polygon=null;if(pair?.status==='matched'&&Array.isArray(pair.parentCorners)&&pair.parentCorners.length===4){
            const raw=pair.parentCorners.map(a=>({x:(a[0]-p.roi.x)/p.roi.w,y:(a[1]-p.roi.y)/p.roi.h}));
            if(raw.every(a=>Number.isFinite(a.x)&&Number.isFinite(a.y)&&a.x>=-EPS&&a.y>=-EPS&&a.x<=1+EPS&&a.y<=1+EPS))polygon=raw.map(a=>core.rawToDisplay({x:Math.max(0,Math.min(1,a.x)),y:Math.max(0,Math.min(1,a.y))},p.orientation));
          }
          result.push({parent:refs[i],child:refs[i+1],polygon,anchors:{parent:anchor(p),child:anchor(c)},evidence:{source:'feature-match',verified:!!polygon,reason:pair?.reason||'unavailable',...(Number.isFinite(pair?.score)?{score:pair.score}:{})}});
        }
      }
      return result;
    }
    ui=UI.create({container:host.container,document:host.container.ownerDocument,core,language:host.language,activePane:host.activePane,say:host.say,sources,resolve:get,current,match,
      preview:links=>{preview=links;draw();},clearPreview:()=>{preview=null;draw();},
      commit:(links,message)=>{const next=JSON.parse(JSON.stringify(host.state()));next.imageLinks=core.validateAll(links);preview=null;return host.commit(next,message);},
      errorText:error=>error?.message&&!(/[\u4e00-\u9fff]/.test(error.message)&&String(host.language?.()).startsWith('en'))?error.message:t('无法完成图片关联，请核对图片后重试。','Image linking could not be completed. Check the source images and try again.'),
      reasonText:reason=>reason==='engine-unavailable'?t('定位上传的图片需要本机分析引擎。请使用安装版，或在编辑器内框选生成放大图。','Locating uploaded images requires the local analysis engine. Use the installed app, or create the crop in the editor.'):t('没有足够一致的特征，请核对图片顺序和来源，或重新框选区域。','There are not enough consistent features. Check the image order and source, or select the crop again.')
    });
    return {refresh:()=>ui.refresh(),open:()=>ui.open(),cancel:()=>ui.cancel(),destroy:()=>ui.destroy(),draw,resolve:get,sources,match,
      exportReady(panelId){const root=host.root();if(!root)return true;for(const link of current()){if(!link.visible)continue;if(panelId){const ref=link.parent,id=ref.insetId?host.state().overlays.find(a=>a.id===ref.insetId)?.source.panelId:ref.panelId;if(id!==panelId)continue;}const node=[...root.querySelectorAll('[data-image-link-id]')].find(n=>n.dataset.imageLinkId===link.id);if(!node||node.hasAttribute('data-image-link-unavailable')){host.say?.(t('关联图片已变化，请重新定位或隐藏该关联后再导出。','A linked image changed. Relocate or hide the link before exporting.'));return false;}}return true;}
    };
  }
  return {create,resolve,signature,anchor,render};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageLinksController;
