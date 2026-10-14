/* ROI gestures and contextual controls. History stores geometry, never image bytes. */
'use strict';
const StudioImageInsetsController = (() => {
  const NS='http://www.w3.org/2000/svg';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
  function create(host){
    const core=host.core||(typeof StudioImageInsets!=='undefined'?StudioImageInsets:null),UI=host.ui||(typeof StudioImageInsetsUI!=='undefined'?StudioImageInsetsUI:null);
    if(!core||!UI||!host.viewport)throw Error('Image inset controller dependencies are unavailable');
    const doc=host.viewport.ownerDocument,win=doc.defaultView;
    const t=(zh,en)=>String(host.language?.()||'zh').startsWith('en')?en:zh;
    const identity=s=>s?.inset?'inset:'+s.inset.id:s?.source?'source:'+JSON.stringify([s.source.panelId,s.source.variant,s.source.key]):'';
    const current=()=>host.selection?.()||{};
    const selectedSource=()=>current().source||current().inset?.source;
    let ui,armed=null,drag=null,calibrationPending=null,preview=null,serial=0,raf=0,overlay=null,destroyed=false,cancelling=false,previousCursor=null,previousTouchAction=null,fitNotice='';
    const listeners=[];
    function listen(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
    function textError(error){
      const errors={source:'The linked source image is unavailable or unsupported.',pixels:'The original image dimensions changed or cannot be verified.',transform:'This image transform cannot be mapped reliably to original pixels.',geometry:'The image or inset dimensions are invalid.',clip:'The region is outside the visible source or uses unsupported clipping.',hidden:'The source image is hidden.',record:'The inset settings are invalid.',scale:'The scale bar exceeds the calibrated region.',aspect:'The image aspect ratio cannot be mapped reliably.',orientation:'Insets support quarter-turn rotations and flips. Restore other rotations or skew, or redraw the region if the source orientation changed.',animation:'Animated images are not supported. Choose a static source image.','scale-display':'The inset is too small to show the complete scale bar. Enlarge the inset before exporting.'};
      const decodeErrors={'正在读取其他原图，请稍后再试。':'Other source images are being read. Please try again shortly.','原图像素无法读取。':'The source image pixels could not be read.','原图读取超时，请重新选择图片。':'Reading the source image timed out. Select it again.','原图方向或像素尺寸无法可靠确认。':'The source image orientation or pixel dimensions could not be verified.'};
      return String(host.language?.()||'zh').startsWith('en')?(errors[error?.code]||decodeErrors[error?.message]||error?.message||'The image inset operation could not be completed.'):(error?.message||'局部放大操作未完成。');
    }
    function report(error){host.say?.(textError(error));}
    function sourceDOM(source){
      const root=host.root(),p=host.state()?.panels?.[source?.panelId];
      if(!source||!root||!p||p.variant!==source.variant)throw Object.assign(Error(t('未找到局部放大的原图。','The linked source image is unavailable.')),{code:'source'});
      const panels=[...root.querySelectorAll('[data-panel]')].filter(n=>n.getAttribute('data-panel')===source.panelId);
      const images=panels.length===1?[...panels[0].querySelectorAll('image[data-key]')].filter(n=>n.getAttribute('data-key')===source.key&&!n.closest('[data-inset-content]')):[];
      if(images.length!==1)throw Object.assign(Error('Source image is unavailable'),{code:'source'});return images[0];
    }
    function context(){return {state:host.state(),project:host.project(),selection:identity(current())};}
    function unchanged(value){return !destroyed&&value?.state===host.state()&&value.project===host.project()&&value.selection===identity(current())&&!current().locked;}
    function prototype(source,dimensions,roi){return {id:'annotation-0',type:'inset',x:0,y:0,w:.1,h:.1,source:{panelId:source.panelId,variant:source.variant,key:source.key,widthPx:dimensions.widthPx,heightPx:dimensions.heightPx,...(source.orientation?{orientation:source.orientation}:{})},roi,connector:true,showScale:true};}
    function sourceProbe(source,image,dimensions){
      const rect=core.imageRect(image,dimensions.widthPx,dimensions.heightPx),a=prototype({...source,orientation:core.sourceOrientation(image,host.root())},dimensions,{...rect.visible});
      core.sourceInfo(a,host.root(),{checkVisibility:false});return {a,rect};
    }
    function clearPaint(){if(raf){win.cancelAnimationFrame(raf);raf=0;}overlay?.remove();overlay=null;}
    function clearGesture(){const old=drag;drag=null;armed=null;clearPaint();if(previousCursor!==null){host.viewport.style.cursor=previousCursor;host.viewport.style.touchAction=previousTouchAction;previousCursor=previousTouchAction=null;}if(old)try{host.viewport.releasePointerCapture(old.pointerId);}catch{}}
    function cancelPreview(){if(!preview)return;preview=null;host.repaint();}
    function cancelCalibration(){calibrationPending=null;clearPaint();}
    function cancel(){if(cancelling)return;cancelling=true;serial++;clearGesture();calibrationPending=null;cancelPreview();ui?.cancel();cancelling=false;}
    async function begin(mode,source,insetId,factor=2){
      cancel();host.cancelOtherGestures?.();if(destroyed||current().locked)return false;
      const token=++serial,owner=context();
      try{
        const image=sourceDOM(source),dimensions=await core.decodeSource(image);
        if(token!==serial||!unchanged(owner))return false;
        const currentImage=sourceDOM(source);if(currentImage!==image)return false;
        const {a,rect}=sourceProbe(source,image,dimensions);
        armed={...owner,mode,source:a.source,rect,image,insetId,factor:[2,3,4].includes(+factor)?+factor:2};
        previousCursor=host.viewport.style.cursor;previousTouchAction=host.viewport.style.touchAction;host.viewport.style.cursor='crosshair';host.viewport.style.touchAction='none';host.say?.(mode==='roi'?t('在原图内拖动框选放大区域；按 Esc 取消。','Drag a region inside the source image; press Esc to cancel.'):t('沿原图比例尺划线；按 Esc 取消。','Trace along the source scale bar; press Esc to cancel.'));return true;
      }catch(error){if(token===serial&&unchanged(owner))report(error);return false;}
    }
    function pixelPoint(event,value){
      const image=sourceDOM(value.source),m=image.getScreenCTM?.();if(!m)throw Object.assign(Error('Source transform is unavailable'),{code:'transform'});
      const p=core.point(core.inverse(m),{x:event.clientX,y:event.clientY}),r=value.rect;
      return {x:(p.x-r.x)/r.width,y:(p.y-r.y)/r.height};
    }
    function inBounds(p,b){return p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.w&&p.y<=b.y+b.h;}
    function bounded(p,b){return {x:clamp(p.x,b.x,b.x+b.w),y:clamp(p.y,b.y,b.y+b.h)};}
    function suppress(event){event.preventDefault();event.stopImmediatePropagation();}
    function paint(){
      raf=0;if(!drag||!unchanged(drag))return;
      try{
        const root=host.root(),r=drag.rect,m=core.relativeMatrix(sourceDOM(drag.source),root),a=drag.start,b=drag.end;
        const points=drag.mode==='roi'?[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}]:[a,{x:b.x,y:a.y}];
        if(!overlay||overlay.parentNode!==root){overlay?.remove();overlay=doc.createElementNS(NS,'g');overlay.setAttribute('data-inset-gesture','true');overlay.setAttribute('pointer-events','none');root.append(overlay);}
        const shape=doc.createElementNS(NS,drag.mode==='roi'?'polygon':'polyline');shape.setAttribute('points',points.map(p=>core.point(m,{x:r.x+p.x*r.width,y:r.y+p.y*r.height})).map(p=>`${p.x},${p.y}`).join(' '));shape.setAttribute('fill',drag.mode==='roi'?'#8dbaff22':'none');shape.setAttribute('stroke','#2d7ed6');shape.setAttribute('stroke-width','1.5');shape.setAttribute('vector-effect','non-scaling-stroke');overlay.replaceChildren(shape);
      }catch(error){cancel();report(error);}
    }
    function schedulePaint(){if(!raf)raf=win.requestAnimationFrame(paint);}
    function down(event){
      if(!armed&&!drag)return;
      if(drag&&event.pointerId!==drag.pointerId||event.isPrimary===false){suppress(event);cancel();return;}
      if(!armed||event.button!==0)return;suppress(event);
      if(!unchanged(armed)){cancel();return;}
      try{const p=pixelPoint(event,armed);if(!inBounds(p,armed.rect.visible))return;drag={...armed,pointerId:event.pointerId,start:p,end:p};try{host.viewport.setPointerCapture(event.pointerId);}catch{}schedulePaint();}catch(error){cancel();report(error);}
    }
    function move(event){
      if(!drag||event.pointerId!==drag.pointerId)return;suppress(event);if(!unchanged(drag)){cancel();return;}
      try{drag.end=bounded(pixelPoint(event,drag),drag.rect.visible);schedulePaint();}catch(error){cancel();report(error);}
    }
    function fitted(a,factor,keepPosition=false){
      fitNotice='';
      const info=core.sourceInfo(a,host.root()),g=host.geometry(a),p=info.polygon,size=core.displayPixels(a),edge=p[size.swapped?3:1],sourceWidth=Math.hypot(edge.x-p[0].x,edge.y-p[0].y);
      let width=sourceWidth*factor,height=width*size.height/size.width;
      if(!(width>0&&height>0&&g.width>0&&g.height>0))throw Object.assign(Error('Invalid inset size'),{code:'geometry'});
      const fit=Math.min(1,g.width/width,g.height/height);width*=fit;height*=fit;
      let x=keepPosition?a.x*g.width:Math.max(...p.map(v=>v.x))-(g.dx||0)+10,y=keepPosition?a.y*g.height:Math.min(...p.map(v=>v.y))-(g.dy||0);
      if(!keepPosition&&x+width>g.width)x=Math.min(...p.map(v=>v.x))-(g.dx||0)-width-10;
      Object.assign(a,{x:clamp(x,0,g.width-width)/g.width,y:clamp(y,0,g.height-height)/g.height,w:width/g.width,h:height/g.height});
      if(fit<1-1e-8)fitNotice=t('放大图已适配画布，实际显示倍率为 ','Inset fitted to the canvas; actual magnification is ')+Number((factor*fit).toFixed(2))+'×';return a;
    }
    function makeInset(value){
      const a=value.start,b=value.end,roi={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(b.x-a.x),h:Math.abs(b.y-a.y)};
      if(roi.w*value.source.widthPx<1||roi.h*value.source.heightPx<1)return false;
      const next=copy(host.state()),previous=value.insetId?next.overlays?.find(a=>a.id===value.insetId&&a.type==='inset'):null;
      if(value.insetId&&(!previous||previous.locked))return false;
      let number=Date.now();while(next.overlays?.some(a=>a.id==='annotation-'+number))number++;
      const result=previous||{x:0,y:0,w:.1,h:.1,id:'annotation-'+number,type:'inset',text:'',font:'Arial',size:9,stroke:1,color:'#ffffff',opacity:1,fill:false,bold:false,locked:false,connector:true,showScale:true};
      result.source={...value.source};result.roi=roi;fitted(result,value.factor,!!previous);let notice=fitNotice;
      const calibration=host.calibration(result.source);if(result.scaleLengthUm!==undefined&&calibration>0&&result.scaleLengthUm>calibration*core.displayPixels(result).width/result.source.widthPx*.8){delete result.scaleLengthUm;notice=[notice,t('原比例尺超出新区域，已切换为自动比例尺。','The saved scale bar exceeds the new region and has been reset to Automatic.')].filter(Boolean).join(' ');}
      core.validate(result,host.project(),next);if(!previous)next.overlays=[...(next.overlays||[]),result];
      if(host.commit(next,t('已更新局部放大','Image inset updated'))!==false){host.selectInset(result.id);if(notice)host.say?.(notice);return true;}return false;
    }
    function up(event){
      if(!drag||event.pointerId!==drag.pointerId)return;suppress(event);const value=drag;
      try{
        if(!unchanged(value)){cancel();return;}value.end=bounded(pixelPoint(event,value),value.rect.visible);clearGesture();
        if(value.mode==='roi'){makeInset(value);return;}
        const pixelLength=Math.abs(value.end.x-value.start.x)*value.source.widthPx;if(pixelLength<1)return;
        const lineRoi={x:Math.min(value.start.x,value.end.x),y:clamp(value.start.y,value.rect.visible.y,value.rect.visible.y+value.rect.visible.h-1/value.source.heightPx),w:pixelLength/value.source.widthPx,h:1/value.source.heightPx};
        core.sourceInfo(prototype(value.source,value.source,lineRoi),host.root());
        calibrationPending={...value,pixelLength};const full=host.calibration(value.source),initialLengthUm=full>0?pixelLength/value.source.widthPx*full:undefined;
        if(!ui.requestCalibration({pixelLength,initialLengthUm}))calibrationPending=null;
      }catch(error){cancel();report(error);}
    }
    function factorOf(a){try{const p=core.sourceInfo(a,host.root()).polygon,g=host.geometry(a),edge=p[core.displayPixels(a).swapped?3:1];return Number((a.w*g.width/Math.hypot(edge.x-p[0].x,edge.y-p[0].y)).toFixed(4));}catch{return 2;}}
    function uiSelection(){const s=current(),a=preview&&unchanged(preview)?preview.next.overlays.find(a=>a.id===s.inset?.id):s.inset;return {...s,source:s.source||a?.source,inset:a?{...a,factor:factorOf(a),borderColor:a.color,borderWidth:a.stroke,connectors:a.connector,scaleBar:a.showScale}:undefined};}
    function update(patch,onlyPreview=false){
      const s=current();if(!s.inset||s.locked)return false;const next=copy(host.state()),a=next.overlays.find(a=>a.id===s.inset.id);if(!a||a.locked)return false;
      for(const [key,value]of Object.entries(patch)){const mapped={borderColor:'color',borderWidth:'stroke',connectors:'connector',scaleBar:'showScale',scaleLengthUm:'scaleLengthUm'}[key];if(!mapped)continue;if(key==='scaleLengthUm'&&value===null)delete a.scaleLengthUm;else a[mapped]=value;}
      core.validate(a,host.project(),next);core.scaleInfo(a,{geometry:host.geometry(a),calibration:host.calibration(a.source)});
      if(onlyPreview){preview={...context(),next};host.repaint(next);return true;}preview=null;return host.commit(next,t('已更新局部放大','Image inset updated'));
    }
    function setFactor(factor){const s=current();if(!s.inset||s.locked||![2,3,4].includes(+factor))return false;cancelPreview();const next=copy(host.state()),a=next.overlays.find(a=>a.id===s.inset.id);if(!a||a.locked)return false;fitted(a,+factor,true);const notice=fitNotice,result=host.commit(next,t('已调整放大倍率','Inset magnification updated'));if(result!==false&&notice)host.say?.(notice);return result;}
    function calibrate(lengthUm){
      const value=calibrationPending;if(!value||!unchanged(value)||!Number.isFinite(lengthUm)||lengthUm<=0)return false;
      const full=lengthUm*value.source.widthPx/value.pixelLength;if(!Number.isFinite(full)||full<=0)return false;
      const next=copy(host.state()),p=next.panels[value.source.panelId],vi=value.source.variant,key=value.source.key;
      p.imageCalibrations||={};p.imageCalibrations[vi]||={};p.imageCalibrations[vi][key]=full;
      const cfg=p.scales?.[vi]?.[key];if(cfg){cfg.calibration=full;cfg.length=Math.min(cfg.length,full*.8);}
      for(const a of next.overlays||[])if(a.type==='inset'&&a.source.panelId===value.source.panelId&&a.source.variant===vi&&a.source.key===key&&a.scaleLengthUm>full*core.displayPixels(a).width/a.source.widthPx*.8)delete a.scaleLengthUm;
      calibrationPending=null;return host.commit(next,t('已标定原图比例尺','Source scale calibrated'));
    }
    function quality(){
      const s=uiSelection(),calibration=s.source?host.calibration(s.source):undefined,result={calibrated:Number.isFinite(calibration)&&calibration>0,targetDpi:host.output()?.dpi||600,scaleOptions:[]};
      if(!s.inset)return result;
      try{Object.assign(result,core.quality(s.inset,{geometry:host.geometry(s.inset),outputScale:host.output()?.scale||1}));if(result.calibrated){const geometry=host.geometry(s.inset),width=calibration*core.displayPixels(s.inset).width/s.inset.source.widthPx,max=width*.8,start=Math.floor(Math.log10(max))-4,display=core.windowRect(s.inset,geometry).content.width,minLength=Math.min(6,display*.1),automatic=core.scaleInfo({...s.inset,scaleLengthUm:undefined},{geometry,calibration});for(let exponent=start;exponent<=start+4;exponent++)for(const factor of [1,2,5]){const valueUm=factor*10**exponent;if(valueUm>0&&valueUm<=max){const scale=core.scaleInfo({...s.inset,scaleLengthUm:valueUm},{geometry,calibration});if(scale.length>=minLength&&scale.length<=display*.8)result.scaleOptions.push({valueUm,label:scale.label});}}if(automatic&&!result.scaleOptions.some(item=>Math.abs(item.valueUm-automatic.lengthUm)<=automatic.lengthUm*1e-8))result.scaleOptions.push({valueUm:automatic.lengthUm,label:automatic.label});result.scaleOptions.sort((a,b)=>a.valueUm-b.valueUm);}}catch{result.warning='unavailable';}return result;
    }
    function remove(){const s=current();if(!s.inset||s.locked)return false;cancelPreview();const next=copy(host.state());next.overlays=next.overlays.filter(a=>a.id!==s.inset.id||a.locked);return host.commit(next,t('已删除局部放大','Image inset deleted'));}
    function refresh(){
      if(destroyed)return;if(armed&&!unchanged(armed)||drag&&!unchanged(drag)||calibrationPending&&!unchanged(calibrationPending)){cancel();return;}
      if(preview&&!unchanged(preview)){preview=null;host.repaint();return;}ui?.refresh();
    }
    function exportReady(panelId){try{for(const a of host.state().overlays||[])if(a.type==='inset'&&(!panelId||a.source.panelId===panelId)){core.validate(a,host.project(),host.state());core.sourceInfo(a,host.root());core.quality(a,{geometry:host.geometry(a),outputScale:host.output()?.scale||1});if(a.showScale)core.scaleInfo(a,{geometry:host.geometry(a),calibration:host.calibration(a.source)});const rendered=core.renderContent(a,{root:host.root(),geometry:host.geometry(a),calibration:host.calibration(a.source)});if(rendered.hasAttribute('data-inset-unavailable')||rendered.hasAttribute('data-inset-scale-unavailable'))throw Object.assign(Error(rendered.getAttribute('data-inset-error')||'Image inset is unavailable'),{code:rendered.getAttribute('data-inset-unavailable')||'scale-display'});}return true;}catch(error){report(error);return false;}}
    ui=UI.create({document:doc,detailContainer:host.detailContainer,annotationContainer:host.annotationContainer,language:host.language,activePane:host.activePane,selection:uiSelection,quality,update,setFactor,remove,cancelPreview,calibrate,cancelCalibration,startROI:(...args)=>begin('roi',...args),startCalibration:source=>begin('calibration',source),errorText:textError,onError:report});
    listen(host.viewport,'pointerdown',down,true);listen(host.viewport,'pointermove',move,true);listen(host.viewport,'pointerup',up,true);
    listen(host.viewport,'pointercancel',event=>{if(armed||drag){suppress(event);cancel();}},true);
    listen(host.viewport,'lostpointercapture',event=>{if(drag?.pointerId===event.pointerId)cancel();},true);
    listen(doc,'keydown',event=>{if(event.key==='Escape'&&(armed||drag||calibrationPending||preview)){suppress(event);cancel();}},true);
    listen(win,'blur',()=>{if(armed||drag||calibrationPending||preview)cancel();});
    return {refresh,cancel,startROI:(...args)=>begin('roi',...args),startCalibration:source=>begin('calibration',source),hasSource(){try{return !!sourceDOM(selectedSource());}catch{return false;}},exportReady,destroy(){if(destroyed)return;cancel();destroyed=true;for(const off of listeners)off();ui.destroy();}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageInsetsController;
