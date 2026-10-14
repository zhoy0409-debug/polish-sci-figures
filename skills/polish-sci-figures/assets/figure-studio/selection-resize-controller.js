/* Canvas presentation resizing. One pointer gesture produces one history entry. */
'use strict';
const StudioSelectionResize=(()=>{
  const NS='http://www.w3.org/2000/svg',I=[1,0,0,1,0,0];
  const core=()=>typeof StudioSelectionTransform!=='undefined'?StudioSelectionTransform:require('./selection-transform.js');
  const array=m=>m?Array.isArray(m)?[...m]:[m.a,m.b,m.c,m.d,m.e,m.f]:[...I];
  const attr=m=>'matrix('+m.join(' ')+')';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const handles=['nw','n','ne','e','se','s','sw','w'];
  function create(config){
    const {svg,geometry:l}=config,G=core(),doc=svg.ownerDocument,t=config.t||((s)=>s);
    const layer=doc.createElementNS(NS,'g');layer.dataset.editorSelectionResize='true';layer.style.pointerEvents='none';svg.append(layer);
    let gesture=null,frame=0,disposed=false;
    const raf=fn=>(config.requestAnimationFrame||requestAnimationFrame)(fn),caf=id=>(config.cancelAnimationFrame||cancelAnimationFrame)(id);
    const matrix=node=>array(node?.getScreenCTM?.());
    const own=node=>array(node.transform?.baseVal?.consolidate()?.matrix);
    const rootMatrix=()=>matrix(svg);
    const point=e=>G.applyPoint(G.inverse(rootMatrix()),{x:e.clientX,y:e.clientY});
    const screenBox=node=>{
      const target=node.querySelector?.('[data-inset-frame]')||node,b=target.getBoundingClientRect(),m=G.inverse(rootMatrix());
      const a=G.applyPoint(m,{x:b.left,y:b.top}),z=G.applyPoint(m,{x:b.right,y:b.bottom});
      return {x:Math.min(a.x,z.x),y:Math.min(a.y,z.y),width:Math.abs(z.x-a.x),height:Math.abs(z.y-a.y)};
    };
    const union=boxes=>boxes.length?{x:Math.min(...boxes.map(b=>b.x)),y:Math.min(...boxes.map(b=>b.y)),width:Math.max(...boxes.map(b=>b.x+b.width))-Math.min(...boxes.map(b=>b.x)),height:Math.max(...boxes.map(b=>b.y+b.height))-Math.min(...boxes.map(b=>b.y))}:null;
    function contentBox(item){
      const panel=item.el.closest('[data-panel]'),page=screenBox(panel),backgrounds=[],boxes=[];
      for(const node of item.el.querySelectorAll('text,path,rect,circle,ellipse,line,polyline,polygon,use,image')){
        if(node.closest('defs,clipPath,mask,pattern,symbol')||node.closest('text')!==node&&node.localName==='tspan')continue;
        let hidden=false;for(let n=node;n&&n!==item.el;n=n.parentElement){const style=getComputedStyle(n);if(style.display==='none'||style.visibility==='hidden'||Number(style.opacity)===0){hidden=true;break;}}
        if(hidden)continue;
        const b=screenBox(node);if(!Object.values(b).every(Number.isFinite)||!b.width&&!b.height)continue;
        const style=getComputedStyle(node),white=/^(?:white|#fff(?:fff)?|rgb\(\s*255[, ]+255[, ]+255\s*\))$/i.test(style.fill),unpainted=style.fill==='none'&&style.stroke==='none';
        const knownPage=/(?:^|-)patch_1$/.test(node.parentElement?.id||'')&&/(?:^|-)figure_1$/.test(node.parentElement?.parentElement?.id||'');
        if(knownPage||white&&['none',''].includes(style.stroke)&&b.width>=page.width*.95&&b.height>=page.height*.95){if(node.dataset.key)backgrounds.push(node.dataset.key);continue;}
        if(!unpainted||node.localName==='text'||node.localName==='image')boxes.push(b);
      }
      item.backgroundKeys=backgrounds;return union(boxes)||screenBox(item.el);
    }
    function selected(){
      const s=config.state(),items=(config.selection()||[]).filter(item=>item.el?.isConnected!==false&&!item.locked&&!(item.kind==='overlay'?s.overlays?.find(a=>a.id===item.id)?.locked:s.panels[item.id]?.locked));
      const movable=items.filter(item=>item.el.localName!=='tspan'&&!items.some(other=>other!==item&&other.el.contains(item.el))&&!(item.kind==='element'&&s.panels[item.id]?.lockedElements?.[item.vi]?.includes(item.key)));
      return movable.filter(item=>{
        const owner=item.el.closest('[data-scale-owner]');
        // The owned scale bar already follows its image. Selecting both the
        // image and a bar label must not apply the same gesture twice.
        return !owner||!movable.some(other=>other.kind==='element'&&other.el.localName==='image'&&other.key===owner.dataset.scaleOwner&&other.el.closest('[data-panel]')===owner.closest('[data-panel]'));
      });
    }
    const bounds=items=>union(items.map(item=>item.kind==='content'?contentBox(item):screenBox(item.kind==='overlay'?(item.el.firstElementChild||item.el):item.el)));
    const handlePoint=(b,handle)=>({x:handle.includes('w')?b.x:handle.includes('e')?b.x+b.width:b.x+b.width/2,y:handle.includes('n')?b.y:handle.includes('s')?b.y+b.height:b.y+b.height/2});
    function handlePadding(items,b,ux,uy){
      if(gesture)return gesture.handlePadding;
      const item=items.length===1&&items[0],text=item&&(item.el.localName==='text'||item.kind==='label'||item.kind==='overlay'&&config.state().overlays?.find(a=>a.id===item.id)?.type==='text');
      // The 18px hit areas otherwise cover a small text line completely. Keep
      // its actual glyph box available for selection, dragging and double-click
      // editing; handles stay easy to acquire immediately outside that box.
      return text&&(b.width/ux<24||b.height/uy<24)?{x:10*ux,y:10*uy}:{x:0,y:0};
    }
    function refresh(){
      layer.replaceChildren();if(disposed||config.enabled?.()===false)return;
      const items=selected(),b=bounds(items);if(!b||!Object.values(b).every(Number.isFinite)||!b.width&&!b.height)return;
      const screen=svg.getBoundingClientRect(),ux=l.width/screen.width,uy=l.height/screen.height,padding=handlePadding(items,b,ux,uy);
      const rect=doc.createElementNS(NS,'rect');rect.setAttribute('class','selection-transform-outline');
      for(const [k,v]of Object.entries(b))rect.setAttribute(k,v);rect.setAttribute('vector-effect','non-scaling-stroke');layer.append(rect);
      for(const handle of handles){
        if(!b.width&&/[ew]/.test(handle)||!b.height&&/[ns]/.test(handle))continue;
        const anchor=handlePoint(b,handle),x=anchor.x+(handle.includes('w')?-padding.x:handle.includes('e')?padding.x:0),y=anchor.y+(handle.includes('n')?-padding.y:handle.includes('s')?padding.y:0);
        const group=doc.createElementNS(NS,'g');group.dataset.selectionResize=handle;group.style.pointerEvents='all';group.style.cursor=({n:'ns',s:'ns',e:'ew',w:'ew',nw:'nwse',se:'nwse',ne:'nesw',sw:'nesw'})[handle]+'-resize';
        const title=doc.createElementNS(NS,'title');title.textContent=t('拖动角点等比缩放；边点调整宽高；Shift 切换比例；Alt 围绕中心');group.append(title);
        for(const hit of [true,false]){const node=doc.createElementNS(NS,'rect'),size=hit?18:8;node.setAttribute('class',hit?'selection-resize-hit':'selection-resize-handle');for(const [k,v]of Object.entries({x:x-size*ux/2,y:y-size*uy/2,width:size*ux,height:size*uy,rx:2*ux}))node.setAttribute(k,v);node.setAttribute('vector-effect','non-scaling-stroke');group.append(node);}layer.append(group);
      }
    }
    function capture(items){
      const inverse=G.inverse(rootMatrix()),s=config.state();
      const snapshot=el=>({el,transform:el.getAttribute('transform'),own:own(el),parent:G.multiply(inverse,matrix(el.parentElement))});
      return items.map(item=>{
        const result={...item,...snapshot(item.el),attached:[]};
        if(item.kind==='element'||item.kind==='content'){
          const panel=item.el.closest('[data-panel]'),vb=panel.getAttribute('viewBox').trim().split(/[\s,]+/).map(Number),unit=vb[2]/parseFloat(panel.getAttribute('width'));
          const space=item.kind==='content'?panel:(panel.querySelector('[data-panel-content]')||panel);
          result.space=G.multiply(G.multiply(inverse,matrix(space)),[unit,0,0,unit,0,0]);
          const props=s.panels[item.id].edits?.[item.vi]?.[item.key]||{};
          result.saved=item.kind==='content'?s.panels[item.id].contentTransforms?.[item.vi]||I:G.multiply([1,0,0,1,+(props['offset-x']||0),+(props['offset-y']||0)],props['object-transform']?JSON.parse(props['object-transform']):I);
          if(item.kind==='element'&&item.el.localName==='image')result.attached=[...panel.querySelectorAll('[data-scale-owner]')].filter(node=>node.dataset.scaleOwner===item.key&&node.closest('[data-panel]')===panel&&!node.closest('defs,clipPath,mask,pattern,symbol')&&!items.some(other=>other.el===node||other.el.contains(node))).map(snapshot);
        }
        return result;
      });
    }
    function persistAction(g,action){
      const next=clone(g.base),sx=action[0],sy=action[3];
      for(const item of g.items){
        if(item.kind==='element'||item.kind==='content'){
          const delta=G.multiply(G.multiply(G.inverse(item.space),action),item.space),value=G.multiply(delta,item.saved),p=next.panels[item.id];
          if(item.kind==='content'){p.contentTransforms||={};p.contentTransforms[item.vi]=value;p.contentBackgrounds||={};p.contentBackgrounds[item.vi]=[...new Set([...(p.contentBackgrounds[item.vi]||[]),...(item.backgroundKeys||[])])];}
          else{p.edits[item.vi]||={};const props=p.edits[item.vi][item.key]||={};props['object-transform']=JSON.stringify(value);delete props['offset-x'];delete props['offset-y'];}
        }else if(item.kind==='overlay'){
          const a=next.overlays.find(a=>a.id===item.id),space=config.overlayGeometry?.(a)||{width:l.width,height:l.height,dx:0,dy:0},start={x:a.x*space.width+(space.dx||0),y:a.y*space.height+(space.dy||0)},p=G.applyPoint(action,start);
          a.x=(p.x-(space.dx||0))/space.width;a.y=(p.y-(space.dy||0))/space.height;a.w*=sx;a.h*=sy;a.size*=sy;a.stroke*=Math.sqrt(sx*sy);if(a.type==='text')a.stretch=(a.stretch||1)*sx/sy;
        }else if(item.kind==='label'){
          const pos=l.positions.find(p=>p.id===item.id),box=pos.renderBox||pos,a=next.panels[item.id].label,p=G.applyPoint(action,{x:box.x+box.width*a.x/100,y:box.y+box.height*a.y/100});
          a.x=(p.x-box.x)/box.width*100;a.y=(p.y-box.y)/box.height*100;a.size*=sy;a.stretch=(a.stretch||1)*sx/sy;
        }
      }
      return next;
    }
    function paint(){
      frame=0;const g=gesture;if(!g||!g.last||config.state()!==g.base)return;
      const e=g.last;let action;
      if(g.move){const p=point(e),delta=config.snapMove?.(g.moveContext,p.x-g.origin.x,p.y-g.origin.y,e.altKey)||{dx:p.x-g.origin.x,dy:p.y-g.origin.y};action=[1,0,0,1,delta.dx,delta.dy];}
      else{const mode=config.aspect?.()||'auto',options={shiftKey:e.shiftKey,altKey:e.altKey,minSize:1,maxScale:100,guides:config.snapGuides?.()||{},snapThreshold:5*l.width/svg.getBoundingClientRect().width};if(mode!=='auto')options.lockAspect=mode==='locked';const p=point(e),resizePoint={x:p.x-g.resizeOffset.x,y:p.y-g.resizeOffset.y},resize=G.resizeBox(g.bounds,g.handle,resizePoint,options);action=resize.matrix;config.onSnap?.(resize.snapped);}
      try{const next=persistAction(g,action);config.validate?.(next);g.next=next;g.action=action;
        for(const item of g.items.flatMap(item=>[item,...item.attached])){const local=G.multiply(G.multiply(G.multiply(G.inverse(item.parent),action),item.parent),item.own);item.el.setAttribute('transform',attr(local));}
        config.onPreview?.(next);refresh();
      }catch(error){config.onError?.(error);}
    }
    function start(e){
      if(e.button!==0||disposed||gesture||config.enabled?.()===false)return;
      const handle=e.target.closest?.('[data-selection-resize]')?.dataset.selectionResize,items=selected(),move=!handle&&items.length===1&&items[0].kind==='content'&&items[0].el.contains(e.target);
      if(!handle&&!move)return;const b=bounds(items);if(!b)return;
      e.preventDefault();e.stopImmediatePropagation();const origin=point(e),anchor=handle?handlePoint(b,handle):origin,screen=svg.getBoundingClientRect(),padding=handlePadding(items,b,l.width/screen.width,l.height/screen.height);
      // Resize from pointer displacement, not the outside hit target's absolute
      // coordinates. This also prevents a jump when its edge is grabbed.
      try{gesture={items:capture(items),bounds:b,base:config.state(),origin,resizeOffset:{x:origin.x-anchor.x,y:origin.y-anchor.y},handlePadding:padding,screen:{x:e.clientX,y:e.clientY},pointerId:e.pointerId,handle,move,moveContext:move?config.captureMove?.(items):null,moved:false,next:null};svg.setPointerCapture(e.pointerId);svg.classList.add('is-resizing-selection');}catch(error){gesture=null;config.onError?.(error);}
    }
    function move(e){if(!gesture||e.pointerId!==gesture.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(e.buttons===0){cancel();return;}gesture.moved ||= Math.hypot(e.clientX-gesture.screen.x,e.clientY-gesture.screen.y)>2;if(!gesture.moved)return;gesture.last={clientX:e.clientX,clientY:e.clientY,shiftKey:e.shiftKey,altKey:e.altKey};if(!frame)frame=raf(paint);}
    function finish(e){
      if(!gesture||e.pointerId!==gesture.pointerId)return;e.preventDefault();e.stopImmediatePropagation();if(frame)caf(frame);frame=0;
      if(gesture.moved){gesture.last={clientX:e.clientX,clientY:e.clientY,shiftKey:e.shiftKey,altKey:e.altKey};paint();}
      const g=gesture;gesture=null;svg.classList.remove('is-resizing-selection');if(svg.hasPointerCapture?.(e.pointerId))svg.releasePointerCapture(e.pointerId);
      if(g.moved&&g.next&&config.state()===g.base){const label=g.move?'已移动图内内容':g.items[0].kind==='content'?'已缩放整张小图':'已缩放所选对象';try{if(config.commit(g.next,t(label))!==true)restore(g);}catch(error){restore(g);config.onError?.(error);}}else restore(g);
      config.onSnap?.({});config.onFinish?.();
    }
    function restore(g){for(const item of (g?.items||[]).flatMap(item=>[item,...item.attached]))if(item.transform===null)item.el.removeAttribute('transform');else item.el.setAttribute('transform',item.transform);if(g)config.onPreview?.(g.base);refresh();}
    function cancel(){if(!gesture)return false;if(frame)caf(frame);frame=0;const g=gesture;gesture=null;svg.classList.remove('is-resizing-selection');restore(g);if(svg.hasPointerCapture?.(g.pointerId))svg.releasePointerCapture(g.pointerId);config.onSnap?.({});return true;}
    const cancelEvent=e=>{if(gesture&&e.pointerId===gesture.pointerId){e.stopImmediatePropagation();cancel();}};
    for(const [event,handler]of [['pointerdown',start],['pointermove',move],['pointerup',finish],['pointercancel',cancelEvent],['lostpointercapture',cancelEvent]])svg.addEventListener(event,handler,true);
    function fitContent(){const items=selected();if(items.length!==1||items[0].kind!=='content')return false;const b=bounds(items),pos=l.positions.find(p=>p.id===items[0].id),box=pos.renderBox||pos;if(!b||b.width<=0||b.height<=0)return false;const pad=Math.min(10,box.width*.04,box.height*.04),scale=Math.min((box.width-pad*2)/b.width,(box.height-pad*2)/b.height),action=[scale,0,0,scale,box.x+box.width/2-(b.x+b.width/2)*scale,box.y+box.height/2-(b.y+b.height/2)*scale],g={base:config.state(),items:capture(items)};try{const next=persistAction(g,action);config.validate?.(next);return config.commit(next,t('已缩放整张小图'));}catch(error){config.onError?.(error);return false;}}
    return {refresh,cancel,fitContent,isActive:()=>!!gesture,dispose(){cancel();disposed=true;layer.remove();for(const [event,handler]of [['pointerdown',start],['pointermove',move],['pointerup',finish],['pointercancel',cancelEvent],['lostpointercapture',cancelEvent]])svg.removeEventListener(event,handler,true);}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioSelectionResize;
