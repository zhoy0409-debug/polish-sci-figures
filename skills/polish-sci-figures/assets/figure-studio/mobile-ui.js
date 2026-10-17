/* Touch workspace shell. Scientific computation and edit history stay in Studio. */
'use strict';
const StudioMobileUI = (() => {
  const MIN_ZOOM=.1, MAX_ZOOM=4, MIN_PINCH_DISTANCE=8;
  const labels={
    '画布':'Canvas','图层':'Panels','调整':'Adjustments','工作区切换':'Workspace views',
    '移动画布':'Pan','编辑图形':'Edit','适合窗口':'Fit','小图操作':'Panel actions',
    '返回画布':'Back to canvas','触控工具':'Touch tools',
    '单指移动画布，双指缩放':'Drag to pan. Pinch to zoom.',
    '单指选择或编辑，双指移动和缩放':'Touch to select or edit. Use two fingers to pan and zoom.',
    '当前小图的操作与单独导出':'Actions and export for the current panel'
  };
  const clampZoom=value=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Number.isFinite(value)?value:1));
  function sample(points){
    const pair=[...points.values()].slice(0,2);
    if(!pair.length)return null;
    return {ids:pair.map(p=>p.id),x:pair.reduce((sum,p)=>sum+p.x,0)/pair.length,
      y:pair.reduce((sum,p)=>sum+p.y,0)/pair.length,
      distance:pair.length===2?Math.hypot(pair[1].x-pair[0].x,pair[1].y-pair[0].y):0};
  }
  function samePointers(a,b){return !!a&&!!b&&a.ids.length===b.ids.length&&a.ids.every((id,i)=>id===b.ids[i]);}
  function gestureDelta(before,after,zoom){
    if(!samePointers(before,after))return null;
    const ratio=before.ids.length===2&&before.distance>=MIN_PINCH_DISTANCE&&after.distance>=MIN_PINCH_DISTANCE
      ?after.distance/before.distance:1;
    return {zoom:clampZoom(clampZoom(zoom)*ratio),anchor:{x:before.x,y:before.y},
      panX:after.x-before.x,panY:after.y-before.y};
  }
  function compensatedScroll(left,top,delta,bounds){
    return {left:Math.max(0,Math.min(Math.max(0,bounds.width-bounds.clientWidth),left-delta.panX)),
      top:Math.max(0,Math.min(Math.max(0,bounds.height-bounds.clientHeight),top-delta.panY))};
  }
  function createTouchSession(initialMode='pan'){
    const points=new Map();let mode=initialMode==='edit'?'edit':'pan',active=false,aborted=false;
    const valid=p=>p&&Number.isFinite(p.id)&&Number.isFinite(p.x)&&Number.isFinite(p.y);
    return {
      get mode(){return mode;},get active(){return active;},get aborted(){return aborted;},
      get size(){return points.size;},ids:()=>[...points.keys()],has:id=>points.has(id),
      snapshot:()=>active&&!aborted?sample(points):null,
      begin(p){
        if(!valid(p)||points.has(p.id))return {consume:active,start:false};
        points.set(p.id,{...p});const start=!active&&(mode==='pan'||points.size>=2);
        if(start)active=true;
        return {consume:active,start,cancelEditing:start,rebase:active};
      },
      move(p){if(!valid(p)||!points.has(p.id))return {consume:false};points.set(p.id,{...p});return {consume:active};},
      end(id,cancelled=false){
        if(!points.has(id))return {consume:false,finished:false};
        const consume=active;points.delete(id);aborted ||= cancelled;
        const finished=points.size===0,wasCancelled=aborted;
        if(finished){active=false;aborted=false;}
        return {consume,finished,cancelled:wasCancelled,rebase:consume&&!finished};
      },
      abort(){const wasActive=active;aborted=true;return wasActive;},
      reset(){const ids=[...points.keys()];points.clear();active=false;aborted=false;return ids;},
      setMode(next){mode=next==='edit'?'edit':'pan';return this.reset();}
    };
  }
  function init(options={}){
    const doc=options.document||globalThis.document;
    if(!doc)return {destroy(){},refresh(){},showTab(){},setMode(){}};
    const win=doc.defaultView||globalThis,body=doc.body;
    const viewport=options.viewport||doc.getElementById('viewport'),workspace=options.workspace||doc.querySelector('.workspace');
    const main=options.main||workspace?.querySelector('main'),navigator=options.navigator||workspace?.querySelector('.navigator'),inspector=options.inspector||workspace?.querySelector('.inspector');
    if(!viewport||!workspace||!main||!navigator||!inspector)throw Error('Mobile workspace requires canvas, panels and adjustments regions.');
    const media=win.matchMedia('(max-width: 1024px), (pointer: coarse)'),session=createTouchSession('pan');
    let enabled=false,tab='canvas',frame=0,last=null,destroyed=false,blockClickUntil=0,gestureStarted=false;
    const captured=new Set(),listeners=[],localized=[];
    const T=key=>{
      const language=doc.documentElement.lang||'zh-CN';
      if(Object.hasOwn(labels,key))return language.startsWith('zh')?key:labels[key];
      return typeof options.t==='function'?options.t(key):key;
    };
    function listen(node,type,fn,opts){node.addEventListener(type,fn,opts);listeners.push(()=>node.removeEventListener(type,fn,opts));}
    function translate(node,key,attribute){localized.push({node,key,attribute});if(attribute)node.setAttribute(attribute,T(key));else node.textContent=T(key);}
    function button(id,label,action){const b=doc.createElement('button');b.id=id;b.type='button';translate(b,label);b.addEventListener('click',action);return b;}
    const previous=new Map([main,navigator,inspector].map(node=>[node,{id:node.id,inert:node.inert,aria:node.getAttribute('aria-hidden'),role:node.getAttribute('role'),labelledBy:node.getAttribute('aria-labelledby')}]));
    if(!main.id)main.id='mobileCanvasRegion';if(!navigator.id)navigator.id='mobilePanelsRegion';if(!inspector.id)inspector.id='mobileAdjustmentsRegion';
    const bar=doc.createElement('div');bar.id='mobileTouchTools';bar.className='mobile-touch-tools';bar.setAttribute('role','toolbar');translate(bar,'触控工具','aria-label');
    const modes=doc.createElement('div');modes.className='mobile-modes';modes.setAttribute('role','group');
    const pan=button('mobilePan','移动画布',()=>setMode('pan')),edit=button('mobileEdit','编辑图形',()=>setMode('edit'));
    modes.append(pan,edit);
    const fit=button('mobileFit','适合窗口',()=>{resetGesture('fit');options.fit?.();});
    const more=button('mobilePanelMore','小图操作',()=>{resetGesture('panel-actions');options.onPanelMore?.({anchor:more});});
    translate(more,'当前小图的操作与单独导出','title');more.disabled=typeof options.onPanelMore!=='function';
    bar.append(modes,fit,more);main.prepend(bar);
    const hint=doc.createElement('div');hint.className='mobile-touch-hint';hint.id='mobileTouchHint';bar.after(hint);
    const navigation=doc.createElement('nav');navigation.id='mobileWorkspaceTabs';navigation.className='mobile-workspace-tabs';navigation.setAttribute('role','tablist');translate(navigation,'工作区切换','aria-label');
    const buttons={};
    for(const [name,key,region]of [['canvas','画布',main],['panels','图层',navigator],['adjustments','调整',inspector]]){
      const b=button('mobileTab-'+name,key,()=>showTab(name));b.dataset.mobileTab=name;b.setAttribute('role','tab');b.setAttribute('aria-controls',region.id);buttons[name]=b;navigation.append(b);
    }
    workspace.after(navigation);
    const scrim=button('mobileDrawerScrim','返回画布',()=>showTab('canvas'));scrim.className='mobile-drawer-scrim';scrim.tabIndex=-1;workspace.append(scrim);
    const drawerCloses=[];
    for(const region of [navigator,inspector]){
      const close=button('mobileClose-'+region.id,'返回画布',()=>{showTab('canvas');buttons.canvas.focus();});
      close.className='mobile-drawer-close';region.prepend(close);drawerCloses.push(close);
    }
    function cancelFrame(){if(frame)win.cancelAnimationFrame(frame);frame=0;}
    function release(id){captured.delete(id);try{if(viewport.hasPointerCapture(id))viewport.releasePointerCapture(id);}catch{}}
    function capture(id){try{viewport.setPointerCapture(id);captured.add(id);}catch{}}
    function stop(event){if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();}
    function editingTarget(target){return !!target?.closest?.('button,input,select,textarea,a[href],[contenteditable]:not([contenteditable="false"]),[role="slider"],[role="textbox"]');}
    function cancelApp(reason){options.cancelInteraction?.({reason,pointerIds:session.ids()});}
    function resetGesture(reason){
      cancelFrame();const wasStarted=gestureStarted,wasActive=session.active,hadPointers=session.size>0;
      if(session.size||wasStarted)cancelApp(reason);
      const ids=session.reset();for(const id of ids)release(id);last=null;gestureStarted=false;
      if(wasActive||hadPointers)blockClickUntil=Date.now()+700;
      if(wasStarted)options.onGestureEnd?.({cancelled:true,reason});
    }
    function setMode(mode,{cancelArmed=true}={}){
      const hadGesture=session.size>0||gestureStarted;
      resetGesture('mode-change');
      // An insertion tool may be armed before there is any pointer gesture.
      // Explicit mode changes must disarm it immediately, not on the next touch.
      if(cancelArmed&&!hadGesture)cancelApp('mode-change');
      session.setMode(mode);
      body.dataset.mobileMode=session.mode;pan.setAttribute('aria-pressed',String(session.mode==='pan'));edit.setAttribute('aria-pressed',String(session.mode==='edit'));
      hint.textContent=T(session.mode==='pan'?'单指移动画布，双指缩放':'单指选择或编辑，双指移动和缩放');
    }
    function updateRegions(){
      body.dataset.mobileTab=tab;
      for(const [name,node]of [['canvas',main],['panels',navigator],['adjustments',inspector]]){
        // Adjustments share the workspace with the live canvas. Only the panel
        // navigator is a modal drawer; previewing a field must not inert or dim
        // the figure the user is changing.
        const visible=!enabled||name===tab||name==='canvas'&&tab==='adjustments';
        node.inert=enabled&&!visible;
        if(enabled){node.setAttribute('aria-hidden',String(!visible));node.setAttribute('role','tabpanel');node.setAttribute('aria-labelledby',buttons[name].id);}
        else{const saved=previous.get(node);node.inert=saved.inert;restoreAttribute(node,'aria-hidden',saved.aria);restoreAttribute(node,'role',saved.role);restoreAttribute(node,'aria-labelledby',saved.labelledBy);}
        buttons[name].setAttribute('aria-selected',String(name===tab));buttons[name].tabIndex=name===tab?0:-1;
      }
      scrim.hidden=!enabled||tab!=='panels';
    }
    function restoreAttribute(node,name,value){if(value===null)node.removeAttribute(name);else node.setAttribute(name,value);}
    function showTab(next){
      if(!Object.hasOwn(buttons,next))return;
      resetGesture('workspace-change');tab=next;updateRegions();
      if(enabled&&[main,navigator,inspector].some(node=>node.inert&&node.contains(doc.activeElement)))buttons[next].focus({preventScroll:true});
      options.onTabChange?.(next);
    }
    function refresh(){
      if(destroyed)return;
      const next=media.matches;
      if(enabled!==next){resetGesture('viewport-change');enabled=next;body.classList.toggle('studio-mobile',enabled);tab='canvas';}
      for(const item of localized){if(item.attribute)item.node.setAttribute(item.attribute,T(item.key));else item.node.textContent=T(item.key);}
      hint.textContent=T(session.mode==='pan'?'单指移动画布，双指缩放':'单指选择或编辑，双指移动和缩放');
      updateRegions();
    }
    function paint(){
      frame=0;const current=session.snapshot();if(!current)return;
      const delta=gestureDelta(last,current,options.getZoom?.()??1);last=current;if(!delta)return;
      const zoom=clampZoom(options.getZoom?.()??1);
      if(Math.abs(delta.zoom-zoom)>1e-8)options.zoomAt?.(delta.zoom,delta.anchor);
      // zoomAt preserves the previous midpoint; this adds the fingers' midpoint
      // movement without rebuilding the figure or adding an edit-history entry.
      const scroll=compensatedScroll(viewport.scrollLeft,viewport.scrollTop,delta,{width:viewport.scrollWidth,height:viewport.scrollHeight,clientWidth:viewport.clientWidth,clientHeight:viewport.clientHeight});
      viewport.scrollLeft=scroll.left;viewport.scrollTop=scroll.top;
    }
    function queue(){if(!frame)frame=win.requestAnimationFrame(paint);}
    function point(event){return {id:event.pointerId,x:event.clientX,y:event.clientY};}
    function down(event){
      if(event.pointerType!=='touch'){if(event.pointerType==='mouse')blockClickUntil=0;return;}
      if(!enabled||tab==='panels'||!viewport.contains(event.target)||editingTarget(event.target))return;
      const action=session.begin(point(event));
      if(!action.consume)return;stop(event);
      if(action.start){cancelFrame();cancelApp(session.size>1?'pinch-start':'pan-start');gestureStarted=true;}
      if(action.rebase)last=session.snapshot();
      for(const id of session.ids())capture(id);
    }
    function move(event){
      if(event.pointerType!=='touch'||!session.has(event.pointerId))return;
      const action=session.move(point(event));if(!action.consume)return;stop(event);
      if(!session.aborted)queue();
    }
    function end(event){
      if(event.pointerType!=='touch'||!session.has(event.pointerId))return;
      const cancelled=event.type==='pointercancel';
      if(session.active){stop(event);if(!cancelled){session.move(point(event));cancelFrame();paint();}else cancelFrame();}
      const action=session.end(event.pointerId,cancelled);release(event.pointerId);
      if(cancelled){cancelApp('pointer-cancel');last=null;}
      else last=session.snapshot();
      if(action.consume||cancelled)blockClickUntil=Date.now()+700;
      if(action.finished&&gestureStarted){gestureStarted=false;options.onGestureEnd?.({cancelled:action.cancelled,reason:action.cancelled?'pointer-cancel':'complete'});}
    }
    function lostCapture(event){
      if(event.pointerType!=='touch'||event.target!==viewport||!captured.has(event.pointerId))return;
      // A prior editor marquee may release this same viewport, then we acquire
      // it for pinch. Its queued loss event must not cancel the new ownership.
      if(viewport.hasPointerCapture(event.pointerId))return;
      captured.delete(event.pointerId);cancelFrame();session.abort();last=null;cancelApp('capture-lost');
    }
    // Document capture precedes Studio's placement listeners on the viewport.
    // In Edit mode the first touch reaches Studio; the second cancels that edit
    // preview and owns both touches until every finger has lifted.
    for(const [type,fn]of [['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',lostCapture]])listen(doc,type,fn,{capture:true,passive:false});
    listen(doc,'click',event=>{if(enabled&&Date.now()<blockClickUntil&&event.detail!==0&&viewport.contains(event.target)&&!editingTarget(event.target))stop(event);},{capture:true});
    listen(navigation,'keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const keys=Object.keys(buttons),index=keys.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;
      event.preventDefault();showTab(keys[next]);buttons[keys[next]].focus();
    });
    listen(doc,'keydown',event=>{if(enabled&&event.key==='Escape'&&tab!=='canvas'&&!doc.querySelector('dialog[open]')){event.preventDefault();showTab('canvas');buttons.canvas.focus();}});
    listen(win,'blur',()=>{resetGesture('window-blur');});
    listen(doc,'visibilitychange',()=>{if(doc.hidden)resetGesture('document-hidden');});
    if(media.addEventListener)listen(media,'change',refresh);else{media.addListener(refresh);listeners.push(()=>media.removeListener(refresh));}
    const observer=new win.MutationObserver(refresh);observer.observe(doc.documentElement,{attributes:true,attributeFilter:['lang']});
    setMode('pan',{cancelArmed:false});refresh();
    return {refresh,showTab,setMode,get mode(){return session.mode;},get enabled(){return enabled;},
      destroy(){
        if(destroyed)return;resetGesture('destroy');destroyed=true;observer.disconnect();for(const remove of listeners)remove();
        for(const id of [...captured])release(id);bar.remove();hint.remove();navigation.remove();scrim.remove();drawerCloses.forEach(node=>node.remove());
        body.classList.remove('studio-mobile');delete body.dataset.mobileTab;delete body.dataset.mobileMode;
        for(const [node,saved]of previous){node.inert=saved.inert;node.id=saved.id;restoreAttribute(node,'aria-hidden',saved.aria);restoreAttribute(node,'role',saved.role);restoreAttribute(node,'aria-labelledby',saved.labelledBy);}
      }
    };
  }
  return {init,createTouchSession,gestureDelta,compensatedScroll,clampZoom};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioMobileUI;
if(typeof globalThis!=='undefined')globalThis.StudioMobileUI=StudioMobileUI;
