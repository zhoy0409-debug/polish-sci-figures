/* Explicit four-corner photo correction. Drafts are local; Keep creates one version. */
'use strict';
const StudioImageRectifyUI=(()=>{
  const NS='http://www.w3.org/2000/svg',copy=value=>JSON.parse(JSON.stringify(value));
  const identity=s=>JSON.stringify([s?.panelId,s?.variant,s?.key]);
  const words={
    entry:['一键矫正与微调…','Auto straighten & refine…'],title:['裁剪与透视校正','Crop & perspective correction'],
    auto:['一键矫正','Auto straighten'],detecting:['正在本机识别照片边界…','Finding photo edges locally…'],
    autoReady:['已按照片边缘生成建议；请核对目标区域，可切换边界或拖动四角微调。','Suggested from photo edges. Check the subject boundary; choose another outline or refine the corners.'],
    noEdges:['未找到足够可靠的四边边界；请拖动四角指定区域。','No sufficiently supported four-edge outline was found. Select the area with the corner handles.'],
    outline:['边界方案 {0}','Outline {0}'],manual:['已手动微调自动建议','Automatic outline manually refined'],
    ruler:['标尺拉正','Ruler straighten'],rulerTarget:['参考线拉至','Align ruler to'],horizontal:['水平','Horizontal'],vertical:['垂直','Vertical'],
    rulerHint:['在原图拖一条参考线。标尺按所选范围整体旋转，会替代当前四角透视；可取消。','Drag a reference line on the source. This rotates the selected bounds as a whole and replaces the four-corner perspective; you can cancel.'],
    rulerDrawing:['拖出参考线后松手，预览整体拉正；尚未保留。','Release the reference line to preview whole-image straightening. Nothing is kept yet.'],
    rulerAngle:['参考线角度 {0}° · 整体旋转 {1}° · 内接裁剪','Ruler angle {0}° · whole-image rotation {1}° · inscribed crop'],
    rulerRefined:['标尺结果已手动微调；当前四角可能包含透视变化，原参考线仅作操作记录。','The ruler result was refined manually. Current corners may include perspective changes; the original ruler remains an operation record.'],
    rulerShort:['参考线太短，请沿需要拉直的方向拖出更长的线；保留上一个有效预览。','The ruler is too short. Draw a longer line along the direction to straighten. The last valid preview remains.'],
    rulerInvalid:['参考线或所选范围不可用，请重新拖线或调整范围。','The ruler or selected bounds are unusable. Draw it again or adjust the bounds.'],
    source:['原图 · 拖动四角或微调坐标','Original · drag corners or edit coordinates'],
    help:['按所选原图生成矫正版本并保留原图；可一次撤销。旧比例尺与 ROI 不会自动继承。','Create a corrected version from the selected source and retain the original. Undo restores it in one step. Existing scale bars and ROIs are not inherited.'],
    original:['原图','Original'],previewImage:['校正预览','Corrected preview'],corner:['角点 {0} · {1}','Corner {0} · {1}'],
    tl:['左上','top left'],tr:['右上','top right'],br:['右下','bottom right'],bl:['左下','bottom left'],
    reset:['恢复原图四角','Reset to source corners'],crop:['改为矩形裁剪框','Use rectangular crop box'],
    cropHint:['矩形框根据当前四点的外接范围生成，可继续拖动四角。','The rectangle uses the current four-point bounds. Its corners remain editable.'],
    keyboard:['角点可用方向键微调 1 像素，Shift + 方向键微调 10 像素。坐标为原图像素。','Arrow keys move a corner by 1 source pixel; Shift + arrows move it by 10. Coordinates use source pixels.'],
    ratio:['输出宽高比','Output aspect ratio'],estimate:['按所选边长估计','Estimate from selected edges'],custom:['自定义宽 ÷ 高','Custom width ÷ height'],
    ratioHint:['估计比例只是展示选择，不能据此推断实物真实比例或尺寸。已知比例时请明确指定。','An estimated ratio is a display choice, not a measurement of the subject. Specify a known ratio when available.'],
    width:['输出宽度（像素）','Output width (pixels)'],output:['输出 {0} × {1} 像素','Output {0} × {1} pixels'],
    preview:['预览校正','Preview correction'],apply:['保留校正','Keep correction'],cancel:['取消','Cancel'],close:['关闭并取消','Close & cancel'],
    compare:['对照原图','Show original'],compareBack:['返回校正预览','Show correction'],adjust:['调整四角','Adjust corners'],
    idle:['在原图上调整四角；预览不会保存或增加撤销记录。','Adjust the source corners. A preview does not save or add an Undo step.'],
    pending:['正在本机生成透视预览…','Generating the perspective preview locally…'],
    ready:['真实画布预览中 · 尚未保留 · Esc 取消','Actual canvas preview · not kept · Esc cancels'],
    keeping:['正在本机生成完整输出…','Generating the full output locally…'],
    decoding:['正在本机读取原图…','Reading source pixels locally…'],warpProgress:['正在重采样校正像素… {0}%','Resampling corrected pixels… {0}%'],encoding:['正在编码校正 PNG…','Encoding the corrected PNG…'],
    invalid:['请完成有效的四角、比例和输出宽度；保留上一个有效预览。','Complete valid corners, ratio and output width. The last valid preview remains.'],
    quad:['四角需按左上、右上、右下、左下围成不交叉的凸四边形，并位于原图内。','Corners must form a non-crossing convex quadrilateral in top-left, top-right, bottom-right, bottom-left order, inside the source.'],
    changed:['原图、选择或锁定状态已变化；已取消本次校正。','The source, selection or lock changed. This correction was cancelled.'],
    unavailable:['请选择未锁定、可读取的 PNG、JPEG 或 WebP 原图。','Select an unlocked, readable PNG, JPEG or WebP source.'],
    failed:['未能生成校正预览；请调整四角或减小输出尺寸。','The correction could not be generated. Adjust the corners or reduce the output size.'],
    limit:['输出尺寸超过本机处理上限，请减小宽度。','The output exceeds local processing limits. Reduce its width.'],upscale:['输出尺寸过大；放大不能恢复原图细节，请减小宽度。','The requested enlargement cannot restore source detail. Reduce the width.'],
    applied:['已保留透视校正版本','Perspective correction kept'],local:['仅本机几何重采样；不补画、不生成新内容。原始图像单独保留。','Local geometric resampling only. No inpainting or generated content. The original is retained separately.'],
    colour:['一键校色与微调','Auto color & refine next'],version:['图片版本','Image version'],corrected:['已校正','Corrected'],retained:['保留原图','Retained original'],retainedDisplay:['校正前显示图','Display before correction']
  };
  function create(host){
    const doc=host.document||globalThis.document,win=doc?.defaultView||globalThis;
    const core=host.core||(typeof StudioImageRectify!=='undefined'?StudioImageRectify:null);
    const detector=host.detector||(typeof StudioImageRectifyDetect!=='undefined'?StudioImageRectifyDetect:null);
    const straightener=host.straightener||(typeof StudioImageStraighten!=='undefined'?StudioImageStraighten:null);
    const geometry=host.geometry||(typeof StudioImageInsets!=='undefined'?StudioImageInsets:null);
    const Sessions=host.sessionsCore||(typeof StudioPreviewSessions!=='undefined'?StudioPreviewSessions:null);
    if(!doc||!host.container||!core||!geometry?.dimensionsFromHref||!host.previewSessions&&!Sessions)throw Error('Photo correction requires a container, image engine and preview sessions');
    const t=(key,...args)=>(words[key]?.[String(host.language?.()||'zh').startsWith('en')?1:0]||key).replace(/\{(\d+)\}/g,(_,i)=>args[+i]??'');
    const el=(tag,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;return n;},svg=(tag,attrs={})=>{const n=doc.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
    const control=(tag,name,cls)=>{const n=el(tag,cls);n.dataset.rectify=name;return n;},button=(name,cls)=>{const n=control('button',name,cls);n.type='button';return n;};
    const ref=s=>({panelId:s.panelId,variant:s.variant,key:s.key});
    const hrefOf=n=>n?.getAttribute('href')||n?.getAttributeNS?.('http://www.w3.org/1999/xlink','href')||'';
    const current=()=>host.selection?.()||{},fingerprint=s=>JSON.stringify(host.current?.(s)??null);
    const errorText=error=>t(({INVALID_QUAD:'quad',OUT_OF_BOUNDS:'quad',DEGENERATE_QUAD:'quad',SINGULAR_HOMOGRAPHY:'quad',INVALID_SIZE:'invalid',OUTPUT_LIMIT:'limit',UPSCALE_LIMIT:'upscale',UNSUPPORTED_SOURCE:'unavailable',SOURCE_LIMIT:'limit',DECODE_FAILED:'unavailable'})[error?.code]||'failed');
    let own=null,destroyed=false,lastFocus=null,drag=null;const composing=new Set();
    const manager=host.previewSessions||Sessions.create({identity:()=>[identity(current().source),hrefOf(host.resolve?.(current().source)),fingerprint(current().source)]});
    const entrySection=el('section','image-rectify-entry'),entry=button('entry'),versionLabel=el('label','rectify-version'),versionCaption=el('span'),version=control('select','version');for(const name of ['corrected','original']){const option=el('option');option.value=name;version.append(option);}versionLabel.append(versionCaption,version);versionLabel.hidden=true;entrySection.id='imageRectifyControls';entrySection.dataset.pane='detail';entrySection.append(entry,versionLabel);host.container.append(entrySection);
    const dialog=el('section','image-rectify-dialog');dialog.id='imageRectifyDialog';dialog.hidden=true;dialog.setAttribute('role','region');dialog.setAttribute('aria-labelledby','imageRectifyTitle');
    const heading=el('div','rectify-heading'),title=el('h2'),closeButton=button('close');title.id='imageRectifyTitle';heading.append(title,closeButton);
    const help=el('p','rectify-help'),originalCaption=el('h3'),stage=control('div','original','rectify-original'),sourceSvg=svg('svg',{id:'imageRectify-originalSvg',role:'img',preserveAspectRatio:'xMidYMid meet',tabindex:'-1'}),image=svg('image',{preserveAspectRatio:'none'}),polygon=svg('polygon',{'data-rectify':'polygon',fill:'#49c3a522',stroke:'#49c3a5','stroke-width':2,'vector-effect':'non-scaling-stroke'}),handleLayer=svg('g',{'data-rectify':'handles'}),rulerLayer=svg('g',{'pointer-events':'none'}),rulerUnder=svg('line',{stroke:'#fff','stroke-width':5,'vector-effect':'non-scaling-stroke'}),rulerLine=svg('line',{'data-rectify':'rulerLine',stroke:'#176b5d','stroke-width':2,'vector-effect':'non-scaling-stroke'}),rulerEnds=[0,1].map(i=>svg('circle',{'data-rectify-ruler-point':i,fill:'#f4f1e9',stroke:'#176b5d','stroke-width':2,'vector-effect':'non-scaling-stroke'}));
    rulerLayer.append(rulerUnder,rulerLine,...rulerEnds);rulerLayer.style.display='none';sourceSvg.append(image,polygon,handleLayer,rulerLayer);stage.append(sourceSvg);
    const handles=[];
    for(let i=0;i<4;i++){
      const g=svg('g',{'data-rectify-handle':i,tabindex:'0',role:'slider','aria-valuemin':0}),circle=svg('circle',{r:9,fill:'#f4f1e9',stroke:'#176b5d','stroke-width':2,'vector-effect':'non-scaling-stroke'}),text=svg('text',{'text-anchor':'middle','dominant-baseline':'central',fill:'#153b34','font-family':'Arial','font-weight':700,'font-size':11,'pointer-events':'none'});text.textContent=String(i+1);g.append(circle,text);handleLayer.append(g);handles.push(g);
    }
    const keyboard=el('p','rectify-help'),coordinates=el('div','rectify-coordinates'),coordinateFields=[];
    for(let i=0;i<4;i++){
      const row=el('fieldset'),legend=el('legend');row.append(legend);const fields={legend};
      for(const axis of ['x','y']){const label=el('label'),caption=el('span'),input=el('input');caption.textContent=axis.toUpperCase();Object.assign(input,{type:'text',inputMode:'decimal',value:'0'});input.dataset.rectifyCoordinate=i+'-'+axis;input.setAttribute('aria-label',(i+1)+' '+axis.toUpperCase());label.append(caption,input);row.append(label);fields[axis]=input;}coordinateFields.push(fields);coordinates.append(row);
    }
    const pointActions=el('div','rectify-row'),autoButton=button('auto','primary'),outlines=control('select','outlines'),autoNote=control('p','autoNote','rectify-help'),reset=button('reset'),crop=button('crop');autoButton.hidden=!detector;outlines.hidden=true;pointActions.append(autoButton,reset,crop);
    const rulerControls=el('div','rectify-ruler-controls'),rulerButton=button('ruler'),rulerTargetLabel=el('label'),rulerTargetCaption=el('span'),rulerTarget=control('select','rulerTarget'),rulerNote=control('p','rulerNote','rectify-help'),rulerCoordinates=el('div','rectify-coordinates rectify-ruler-coordinates'),rulerFields=[];rulerButton.hidden=!straightener;rulerButton.setAttribute('aria-pressed','false');rulerNote.setAttribute('role','status');for(const name of ['horizontal','vertical']){const option=el('option');option.value=name;rulerTarget.append(option);}rulerTargetLabel.append(rulerTargetCaption,rulerTarget);rulerControls.append(rulerButton,rulerTargetLabel);rulerControls.hidden=!straightener;
    for(let i=0;i<2;i++){const fieldset=el('fieldset'),legend=el('legend');legend.textContent=String(i+1);fieldset.append(legend);const fields={};for(const axis of ['x','y']){const label=el('label'),caption=el('span'),input=el('input');caption.textContent=axis.toUpperCase();Object.assign(input,{type:'text',inputMode:'decimal'});input.dataset.rectifyRulerCoordinate=i+'-'+axis;input.setAttribute('aria-label','Ruler '+(i+1)+' '+axis.toUpperCase());label.append(caption,input);fieldset.append(label);fields[axis]=input;}rulerFields.push(fields);rulerCoordinates.append(fieldset);}rulerCoordinates.hidden=true;
    const settings=el('div','rectify-settings'),ratioLabel=el('label'),ratioCaption=el('span'),ratio=control('select','ratio');
    for(const [value,label]of [['estimate',''],['4:3','4:3'],['16:9','16:9'],['1:1','1:1'],['custom','']]){const option=el('option');option.value=value;option.textContent=label;ratio.append(option);}ratioLabel.append(ratioCaption,ratio);
    const customLabel=el('label'),customCaption=el('span'),customRatio=control('input','customRatio');Object.assign(customRatio,{type:'text',inputMode:'decimal',value:'1'});customLabel.append(customCaption,customRatio);
    const widthLabel=el('label'),widthCaption=el('span'),width=control('input','width');Object.assign(width,{type:'text',inputMode:'numeric',value:''});widthLabel.append(widthCaption,width);
    const output=control('output','outputSize'),ratioHint=el('p','rectify-help');settings.append(ratioLabel,customLabel,widthLabel,output,ratioHint);
    const processed=el('div','rectify-result'),processedCaption=el('h3'),processedImage=control('img','processed');processedImage.alt='';processed.hidden=true;processed.append(processedCaption,processedImage);
    const actions=el('div','rectify-actions'),previewButton=button('preview'),compare=button('compare'),adjust=button('adjust'),cancelButton=button('cancel'),apply=button('apply','primary'),status=control('p','status','rectify-status'),local=el('p','rectify-help');status.setAttribute('role','status');status.setAttribute('aria-live','polite');actions.append(previewButton,compare,adjust,cancelButton,apply);
    dialog.append(heading,help,originalCaption,stage,keyboard,pointActions,outlines,autoNote,rulerControls,rulerNote,rulerCoordinates,coordinates,settings,processed,status,local,actions);(host.dockContainer||host.container.closest?.('aside.inspector')||host.container).prepend(dialog);
    const completed=el('section','rectify-completed');completed.hidden=true;const completedNote=el('p'),colour=button('colour');completed.append(completedNote,colour);host.container.prepend(completed);colour.hidden=typeof host.color!=='function';colour.onclick=()=>{completed.hidden=true;host.color?.();};
    function available(){const s=current();return !!s.source&&!s.locked;}
    function fresh(value=own){
      if(!value||destroyed||current().locked||identity(current().source)!==value.id)return false;
      const live=(host.sources?.()||[]).find(s=>identity(s)===value.id);
      return !!live&&!live.locked&&hrefOf(host.resolve(value.source))===value.href&&fingerprint(value.source)===value.fingerprint;
    }
    function contextMeta(value,candidate,fullResolution,meta={}){return {...meta,source:ref(value.source),originalHref:value.href,corners:copy(candidate.corners),outputWidth:candidate.width,outputHeight:candidate.height,ratioMode:candidate.ratioMode,ratioValue:candidate.ratioValue,estimatedRatio:candidate.estimatedRatio,detection:value.detection?copy(value.detection):null,straighten:candidate.straighten?copy(candidate.straighten):null,straightenRefined:candidate.straightenRefined===true,fullResolution};}
    function inputError(message){if(!own)return;own.ready=false;own.error=message||t('invalid');status.textContent=own.error;dialog.dataset.state='error';apply.disabled=true;own.preview?.reject(own.error);}
    function framePoints(value){return [{x:0,y:0},{x:value.width,y:0},{x:value.width,y:value.height},{x:0,y:value.height}];}
    function paintPoints(){if(!own)return;polygon.setAttribute('points',own.points.map(p=>p.x+','+p.y).join(' '));const factor=Math.max(1,own.width/384,own.height/288);handles.forEach((g,i)=>{const p=own.points[i];g.setAttribute('transform',`translate(${p.x} ${p.y}) scale(${factor})`);g.setAttribute('aria-valuenow',i+1);g.setAttribute('aria-valuetext',p.x.toFixed(1)+', '+p.y.toFixed(1));});}
    function paintFields(){if(!own)return;coordinateFields.forEach((f,i)=>{for(const axis of ['x','y']){f[axis].value=String(own.points[i][axis]);f[axis].removeAttribute('aria-invalid');}});paintPoints();}
    function readCandidate(){
      if(!own)throw Error(t('invalid'));
      if(own.rulerInvalid)throw Error(t('rulerInvalid'));
      if(drag?.kind==='ruler')throw Error(t('rulerDrawing'));
      const points=coordinateFields.map(fields=>Object.fromEntries(['x','y'].map(axis=>{const raw=fields[axis].value.trim(),n=Number(raw),valid=raw!==''&&Number.isFinite(n);fields[axis].toggleAttribute('aria-invalid',!valid);if(!valid)throw Error(t('invalid'));return [axis,n];})));
      core.validateQuad(points,{width:own.width,height:own.height});
      const rawWidth=width.value.trim(),widthPx=rawWidth===''?undefined:Number(rawWidth);
      if(widthPx!==undefined&&(!Number.isInteger(widthPx)||widthPx<1))throw Error(t('invalid'));
      let aspect='estimate';if(ratio.value==='custom'){const raw=customRatio.value.trim();aspect=Number(raw);if(raw===''||!Number.isFinite(aspect)||aspect<=0)throw Error(t('invalid'));}else if(ratio.value!=='estimate'){const parts=ratio.value.split(':').map(Number);aspect=parts[0]/parts[1];}
      const size=core.outputSize(points,{width:own.width,height:own.height,ratio:aspect,...(widthPx===undefined?{}:{widthPx})});
      if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1)throw Error(t('invalid'));
      own.points=points;paintPoints();output.textContent=t('output',size.width,size.height);return {corners:points,width:size.width,height:size.height,ratioMode:ratio.value==='estimate'?'estimate':ratio.value==='custom'?'custom':'fixed',ratioValue:Number.isFinite(size.ratio)?size.ratio:size.width/size.height,estimatedRatio:typeof size.estimatedRatio==='boolean'?size.estimatedRatio:ratio.value==='estimate',straighten:own.straighten?copy(own.straighten):null,straightenRefined:own.straightenRefined===true};
    }
    function setControlsDisabled(disabled){for(const input of dialog.querySelectorAll('input,select'))input.disabled=disabled;for(const b of [autoButton,rulerButton,reset,crop,previewButton,compare,adjust])b.disabled=disabled;handles.forEach(g=>g.setAttribute('aria-disabled',String(disabled)));apply.disabled=disabled||!own?.ready||!!own?.error;}
    function paintState(info){
      const value=own;if(!value)return;
      if(['cancelled','invalidated'].includes(info.status)&&!value.finishing){close(false);return;}
      if(info.status==='error'){value.error=info.error||t('failed');value.ready=false;status.textContent=value.error;dialog.dataset.state='error';}
      else if(info.pending){value.ready=false;status.textContent=t(value.keeping?'keeping':'pending');dialog.dataset.state='pending';}
      else if(info.status==='previewing'&&value.last&&value.lastKey===value.requestedKey){value.ready=true;value.error='';status.textContent=t('ready');dialog.dataset.state='previewing';}
      apply.disabled=value.keeping||!value.ready||!!value.error;
    }
    function paintResult(value,work){
      if(!own||!work.isCurrent()||!fresh())return;
      const rendered=own.showOriginal?host.clearPreview?.():host.preview?.(value.result,contextMeta(own,value.candidate,value.fullResolution,work));if(rendered===false)throw Error(t('failed'));
      own.last=value;own.lastKey=JSON.stringify(value.candidate);processedImage.src=value.result.href;processed.hidden=false;
    }
    function requestPreview(delayMs=250,fullResolution=false){
      if(!own||own.keeping&&!fullResolution)return Promise.resolve(false);
      stopDetection();
      if(!fresh()){cancelChanged();return Promise.resolve(false);}
      let candidate;try{candidate=readCandidate();}catch(error){inputError(error?.code?errorText(error):t('invalid'));return Promise.resolve(false);}
      if(composing.size){inputError(t('invalid'));return Promise.resolve(false);}
      const value=own;value.error='';value.ready=false;value.requestedKey=JSON.stringify(candidate);
      return value.preview.request(candidate,async(draft,work)=>{
        let result;try{result=await core.rectify(value.href,{corners:copy(draft.corners),width:draft.width,height:draft.height,...(!fullResolution?{previewMaxSide:768}:{}),signal:work.signal,onProgress:progress=>{if(!fullResolution||own!==value||!work.isCurrent())return;if(progress?.stage==='warp'&&Number.isFinite(progress.fraction))status.textContent=t('warpProgress',Math.round(Math.max(0,Math.min(1,progress.fraction))*100));else if(progress?.stage==='decode')status.textContent=t('decoding');else if(progress?.stage==='encode')status.textContent=t('encoding');}});}catch(error){if(error?.name==='AbortError')throw error;throw Error(errorText(error));}
        if(!work.isCurrent()||own!==value||!fresh(value))throw new DOMException('Correction superseded','AbortError');
        if(!result||!/^data:image\/png;base64,/i.test(result.href||'')||!Number.isInteger(result.width)||!Number.isInteger(result.height)||result.width<1||result.height<1||result.sourceWidth!==value.width||result.sourceHeight!==value.height||!result.audit||fullResolution&&(result.width!==draft.width||result.height!==draft.height))throw Error(t('failed'));
        return {result,candidate:copy(draft),fullResolution};
      },{delayMs});
    }
    function boundsOf(points){const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};}
    function paintRulerLine(points=own?.rulerPoints){rulerLayer.style.display=points?'':'none';if(!points)return;for(const line of [rulerUnder,rulerLine])for(const [key,value]of Object.entries({x1:points[0].x,y1:points[0].y,x2:points[1].x,y2:points[1].y}))line.setAttribute(key,String(value));const factor=Math.max(1,own.width/384,own.height/288);rulerEnds.forEach((node,i)=>{node.setAttribute('cx',String(points[i].x));node.setAttribute('cy',String(points[i].y));node.setAttribute('r',String(4*factor));});}
    function paintRulerFields(){rulerCoordinates.hidden=!own?.rulerPoints;if(!own?.rulerPoints)return;rulerFields.forEach((fields,i)=>{for(const axis of ['x','y']){fields[axis].value=String(own.rulerPoints[i][axis]);fields[axis].removeAttribute('aria-invalid');}});}
    function paintRulerNote(){rulerNote.hidden=!straightener;if(!straightener)return;const audit=own?.straighten;rulerNote.textContent=t('rulerHint')+(audit?' '+t('rulerAngle',Number(audit.angleDegrees).toFixed(2),Number(audit.rotationDegrees).toFixed(2)):'')+(own?.straightenRefined?' '+t('rulerRefined'):'');}
    function setRulerMode(active){if(own)own.rulerArmed=active;rulerButton.setAttribute('aria-pressed',String(active));sourceSvg.classList.toggle('is-ruler',active);}
    function clearRuler(){if(own){own.straighten=null;own.straightenRefined=false;own.rulerPoints=null;own.rulerBounds=null;own.rulerInvalid=false;}setRulerMode(false);paintRulerLine(null);paintRulerFields();paintRulerNote();}
    function markRulerRefined(){if(own?.rulerInvalid){clearRuler();return;}if(!own?.straighten)return;own.straightenRefined=true;own.rulerBounds=null;paintRulerNote();}
    function applyRuler(points,{bounds,updateFields=true,delayMs=0}={}){
      if(!own||own.keeping||!straightener||!fresh()||composing.size)return false;stopDetection();const value=own;value.rulerPoints=copy(points);paintRulerLine();if(updateFields)paintRulerFields();
      try{
        const result=straightener.fromRuler(points,{width:value.width,height:value.height,bounds:bounds||value.rulerBounds||boundsOf(value.points),target:rulerTarget.value});
        core.validateQuad(result.corners,{width:value.width,height:value.height});if(!Number.isInteger(result.outputWidth)||!Number.isInteger(result.outputHeight)||result.outputWidth<1||result.outputHeight<1||!result.audit)throw Error(t('rulerInvalid'));
        value.points=copy(result.corners);value.straighten=copy(result.audit);value.straightenRefined=false;value.rulerBounds=copy(result.audit.bounds);value.rulerInvalid=false;value.detection=null;autoNote.textContent='';outlines.hidden=true;
        ratio.value='custom';customRatio.value=String(result.outputWidth/result.outputHeight);customLabel.hidden=false;width.value=String(result.outputWidth);paintFields();paintRulerNote();requestPreview(delayMs);return true;
      }catch(error){value.rulerInvalid=true;paintRulerNote();inputError(t(error?.code==='SHORT_RULER'?'rulerShort':'rulerInvalid'));return false;}
    }
    function stopDrag(restore=false){const old=drag;drag=null;if(old)try{sourceSvg.releasePointerCapture?.(old.pointerId);}catch{}if(restore&&old&&own===old.session){own.points=copy(old.points);own.straightenRefined=old.straightenRefined===true;if(old.kind==='ruler'){own.rulerPoints=old.rulerPoints?copy(old.rulerPoints):null;own.rulerBounds=old.rulerBounds?copy(old.rulerBounds):null;}paintFields();paintRulerLine();paintRulerFields();paintRulerNote();requestPreview(0);}}
    function close(cancelSession=true){const value=own;stopDetection();own=null;composing.clear();stopDrag();if(cancelSession)value?.preview?.cancel('closed');host.clearPreview?.();image.removeAttribute('href');processedImage.removeAttribute('src');processed.hidden=true;dialog.hidden=true;dialog.open=false;if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});lastFocus=null;}
    function stopDetection(){if(own?.detectController){own.detectController.abort();own.detectController=null;autoButton.disabled=false;}}
    function useOutline(index){
      const value=own,item=value?.outlines?.[index];if(!item||!fresh(value))return;
      clearRuler();
      core.validateQuad(item.corners,{width:value.width,height:value.height});value.points=copy(item.corners);
      value.detection={...copy(value.detectAudit),candidateIndex:index,manuallyRefined:false};
      autoNote.textContent=t('autoReady');paintFields();requestPreview(0);
    }
    async function autoStraighten(){
      if(!own||own.keeping||!detector||!fresh())return;stopDetection();clearRuler();
      const value=own,controller=new AbortController();value.detectController=controller;value.ready=false;value.preview.reject(t('detecting'));apply.disabled=true;autoButton.disabled=true;status.textContent=t('detecting');dialog.dataset.state='detecting';
      try{
        const result=await detector.detect(value.href,{signal:controller.signal,maxSide:640});
        if(controller.signal.aborted||own!==value||value.detectController!==controller||!fresh(value))return;
        value.detectController=null;autoButton.disabled=false;
        if(result.sourceWidth!==value.width||result.sourceHeight!==value.height||!Array.isArray(result.candidates))throw Error(t('failed'));
        value.outlines=result.candidates.slice(0,5);value.detectAudit=result.audit;outlines.replaceChildren();
        value.outlines.forEach((item,i)=>{core.validateQuad(item.corners,{width:value.width,height:value.height});const option=el('option');option.value=String(i);option.textContent=t('outline',i+1);outlines.append(option);});outlines.hidden=value.outlines.length<2;
        if(!value.outlines.length){autoNote.textContent=t('noEdges');await requestPreview(0);return;}
        outlines.value='0';useOutline(0);
      }catch(error){if(own===value&&!controller.signal.aborted){autoNote.textContent=t('noEdges');inputError(error?.message||t('failed'));}}
      finally{if(own===value&&value.detectController===controller){value.detectController=null;autoButton.disabled=false;}}
    }
    function refined(event){if(event?.type==='pointerdown'&&own?.rulerArmed)return;if(own?.detection){own.detection.manuallyRefined=true;autoNote.textContent=t('manual');}}
    autoButton.onclick=autoStraighten;outlines.onchange=()=>{try{useOutline(Number(outlines.value));}catch(error){inputError(error?.message||t('failed'));}};
    coordinates.addEventListener('input',refined);sourceSvg.addEventListener('pointerdown',refined);sourceSvg.addEventListener('keydown',refined);
    function cancelChanged(){close();host.say?.(t('changed'));}
    function sourcePoint(event){
      const m=sourceSvg.getScreenCTM?.();if(!m)throw Error(t('failed'));const det=m.a*m.d-m.b*m.c;if(!Number.isFinite(det)||Math.abs(det)<1e-12)throw Error(t('failed'));
      return {x:Math.max(0,Math.min(own.width,(m.d*(event.clientX-m.e)-m.c*(event.clientY-m.f))/det)),y:Math.max(0,Math.min(own.height,(-m.b*(event.clientX-m.e)+m.a*(event.clientY-m.f))/det))};
    }
    sourceSvg.addEventListener('pointerdown',event=>{if(!own||own.keeping||event.button!==0||event.isPrimary===false)return;const target=event.target.closest?.('[data-rectify-handle]');if(!own.rulerArmed&&!target)return;if(!fresh())return cancelChanged();event.preventDefault();event.stopPropagation();stopDrag();if(own.rulerArmed){stopDetection();const p=sourcePoint(event);own.rulerBounds||=boundsOf(own.points);drag={kind:'ruler',pointerId:event.pointerId,session:own,start:p,end:p,bounds:copy(own.rulerBounds),points:copy(own.points),straightenRefined:own.straightenRefined,rulerPoints:own.rulerPoints?copy(own.rulerPoints):null,rulerBounds:copy(own.rulerBounds)};own.ready=false;own.preview.reject(t('rulerDrawing'));status.textContent=t('rulerDrawing');paintRulerLine([p,p]);}else drag={pointerId:event.pointerId,index:Number(target.dataset.rectifyHandle),session:own,points:copy(own.points),straightenRefined:own.straightenRefined};try{sourceSvg.setPointerCapture?.(event.pointerId);}catch{}target?.focus?.();});
    sourceSvg.addEventListener('pointermove',event=>{if(!drag||!own||drag.session!==own||event.pointerId!==drag.pointerId)return;event.preventDefault();if(!fresh())return cancelChanged();try{if(drag.kind==='ruler'){drag.end=sourcePoint(event);paintRulerLine([drag.start,drag.end]);return;}markRulerRefined();own.points[drag.index]=sourcePoint(event);paintFields();requestPreview();}catch(error){inputError(error.message);}});
    sourceSvg.addEventListener('pointerup',event=>{if(event.pointerId!==drag?.pointerId)return;event.preventDefault();const value=drag;if(!fresh())return cancelChanged();if(value.kind==='ruler'){try{value.end=sourcePoint(event);stopDrag();applyRuler([value.start,value.end],{bounds:value.bounds});}catch(error){stopDrag(true);inputError(t('rulerInvalid'));}return;}stopDrag();requestPreview(0);});
    sourceSvg.addEventListener('pointercancel',event=>{if(event.pointerId===drag?.pointerId)stopDrag(true);});sourceSvg.addEventListener('lostpointercapture',event=>{if(event.pointerId===drag?.pointerId)stopDrag(true);});
    handles.forEach((handle,i)=>handle.addEventListener('keydown',event=>{if(!own||own.keeping)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;event.preventDefault();event.stopPropagation();markRulerRefined();refined();const step=event.shiftKey?10:1;own.points[i]={x:Math.max(0,Math.min(own.width,own.points[i].x+delta[0]*step)),y:Math.max(0,Math.min(own.height,own.points[i].y+delta[1]*step))};paintFields();requestPreview();}));
    for(const fields of coordinateFields)for(const axis of ['x','y'])fields[axis].addEventListener('input',()=>{markRulerRefined();requestPreview();});
    for(const field of [width,customRatio])field.addEventListener('input',()=>{markRulerRefined();requestPreview();});
    ratio.onchange=()=>{markRulerRefined();customLabel.hidden=ratio.value!=='custom';requestPreview();};
    rulerButton.onclick=()=>{if(!own||own.keeping||!straightener)return;stopDrag(true);stopDetection();if(!own.rulerArmed)own.rulerBounds||=boundsOf(own.points);setRulerMode(!own.rulerArmed);paintRulerNote();if(own.rulerArmed)sourceSvg.focus?.({preventScroll:true});};
    rulerTarget.onchange=()=>{if(own?.rulerPoints)applyRuler(own.rulerPoints,{updateFields:false});};
    function updateRulerFields(delayMs=250){if(!own||own.keeping||composing.size)return;try{const points=rulerFields.map(inputs=>Object.fromEntries(['x','y'].map(key=>{const raw=inputs[key].value.trim(),n=Number(raw);if(raw===''||!Number.isFinite(n))throw Error();return [key,n];})));applyRuler(points,{updateFields:false,delayMs});}catch{own.rulerInvalid=true;inputError(t('rulerInvalid'));}}
    for(const fields of rulerFields)for(const axis of ['x','y'])fields[axis].addEventListener('input',()=>updateRulerFields());
    reset.onclick=()=>{if(!own)return;clearRuler();own.points=framePoints(own);paintFields();requestPreview(0);};
    crop.onclick=()=>{if(!own)return;clearRuler();const xs=own.points.map(p=>p.x),ys=own.points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),r=Math.max(...xs),b=Math.max(...ys);own.points=[{x,y},{x:r,y},{x:r,y:b},{x,y:b}];paintFields();requestPreview(0);};
    previewButton.onclick=()=>requestPreview(0);
    compare.onclick=()=>{if(!own||!own.last)return;const value=own;if(!fresh(value))return cancelChanged();try{value.showOriginal=!value.showOriginal;compare.setAttribute('aria-pressed',String(value.showOriginal));compare.textContent=t(value.showOriginal?'compareBack':'compare');const rendered=value.showOriginal?host.clearPreview?.():host.preview?.(value.last.result,contextMeta(value,value.last.candidate,value.last.fullResolution,{isCurrent:()=>own===value&&fresh(value)}));if(rendered===false)throw Error(t('failed'));}catch(error){inputError(error?.message||t('failed'));}};
    adjust.onclick=()=>{setRulerMode(false);stage.scrollIntoView?.({block:'center'});handles[0].focus?.({preventScroll:true});};
    cancelButton.onclick=close;closeButton.onclick=close;
    dialog.addEventListener('compositionstart',event=>{if(event.target.matches('input')){composing.add(event.target);inputError(t('invalid'));}});dialog.addEventListener('compositionend',event=>{composing.delete(event.target);if(own&&!composing.size){if(event.target.matches('[data-rectify-ruler-coordinate]'))updateRulerFields();else requestPreview();}});
    dialog.addEventListener('keydown',event=>{event.stopPropagation();if(event.isComposing||event.keyCode===229||composing.has(event.target))return;if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Enter'&&event.target.matches('input')){event.preventDefault();if(event.target.matches('[data-rectify-ruler-coordinate]'))updateRulerFields(0);else requestPreview(0);}});dialog.addEventListener('keyup',event=>event.stopPropagation());
    apply.onclick=async()=>{
      if(!own||own.keeping||!own.ready||own.error||composing.size)return;
      const value=own;if(!fresh(value))return cancelChanged();value.keeping=true;value.showOriginal=false;setControlsDisabled(true);compare.setAttribute('aria-pressed','false');compare.textContent=t('compare');
      try{if(!await requestPreview(0,true)||own!==value||!fresh(value))return;value.finishing=true;const ok=await value.preview.commit();if(ok&&own===value){close(false);completed.hidden=false;completedNote.textContent=t('applied');host.say?.(t('applied'));refresh();}else value.finishing=false;}
      catch(error){if(own===value){value.error=error?.message||t('failed');status.textContent=value.error;}}
      finally{if(own===value){value.keeping=false;setControlsDisabled(false);}}
    };
    function translate(){
      autoButton.textContent=t('auto');outlines.setAttribute('aria-label',t('outline',''));
      rulerButton.textContent=t('ruler');rulerTargetCaption.textContent=t('rulerTarget');for(const option of rulerTarget.options)option.textContent=t(option.value);paintRulerNote();rulerFields.forEach((fields,i)=>{for(const axis of ['x','y'])fields[axis].setAttribute('aria-label',t('ruler')+' '+(i+1)+' '+axis.toUpperCase());});
      entry.textContent=t('entry');versionCaption.textContent=t('version');version.querySelector('[value="corrected"]').textContent=t('corrected');version.querySelector('[value="original"]').textContent=t(host.versions?.()?.nativeDisplay?'retainedDisplay':'retained');title.textContent=t('title');help.textContent=t('help');originalCaption.textContent=t('source');keyboard.textContent=t('keyboard');reset.textContent=t('reset');crop.textContent=t('crop');crop.title=t('cropHint');ratioCaption.textContent=t('ratio');ratio.querySelector('[value="estimate"]').textContent=t('estimate');ratio.querySelector('[value="custom"]').textContent=t('custom');customCaption.textContent=t('custom');widthCaption.textContent=t('width');ratioHint.textContent=t('ratioHint');processedCaption.textContent=t('previewImage');previewButton.textContent=t('preview');apply.textContent=t('apply');cancelButton.textContent=t('cancel');closeButton.textContent=t('close');compare.textContent=t(own?.showOriginal?'compareBack':'compare');adjust.textContent=t('adjust');local.textContent=t('local');colour.textContent=t('colour');sourceSvg.setAttribute('aria-label',t('source'));processedImage.alt=t('previewImage');
      ['tl','tr','br','bl'].forEach((name,i)=>{const label=t('corner',i+1,t(name));coordinateFields[i].legend.textContent=label;handles[i].setAttribute('aria-label',label);});
    }
    function open(){
      if(destroyed||!available())return false;if(own)close();completed.hidden=true;
      try{
        const selected=current(),source=ref(selected.source),node=host.resolve(source),href=hrefOf(node);if(!/^data:image\/(png|jpeg|webp);base64,/i.test(href))throw Error(t('unavailable'));
        const size=geometry.dimensionsFromHref(href);if(!Number.isInteger(size.widthPx)||!Number.isInteger(size.heightPx))throw Error(t('unavailable'));
        own={source,id:identity(source),href,width:size.widthPx,height:size.heightPx,fingerprint:fingerprint(source),points:[],ready:false,error:'',keeping:false,finishing:false,showOriginal:false,last:null};const value=own;own.points=framePoints(own);clearRuler();rulerTarget.value='horizontal';
        value.preview=manager.begin({kind:'image-rectify',originalValue:null,valid:()=>own===value&&fresh(value),render:paintResult,restore:()=>host.clearPreview?.(),commit:(rendered,meta)=>host.commit(rendered.result,t('applied'),contextMeta(value,rendered.candidate,true,meta)),onState:paintState});
        if(own!==value||!fresh(value)){close();return false;}
        sourceSvg.setAttribute('viewBox',`0 0 ${value.width} ${value.height}`);image.setAttribute('width',String(value.width));image.setAttribute('height',String(value.height));image.setAttribute('href',href);ratio.value='estimate';customRatio.value='1';width.value='';
        const settings=host.settings?.(source);if(settings){core.validateQuad(settings.corners,{width:value.width,height:value.height});value.points=copy(settings.corners);if(!Number.isInteger(settings.outputWidth)||settings.outputWidth<1)throw Error(t('invalid'));width.value=String(settings.outputWidth);if(settings.ratioMode!=='estimate'){const savedRatio=settings.ratioValue;if(!Number.isFinite(savedRatio)||savedRatio<=0)throw Error(t('invalid'));const preset=['4:3','16:9','1:1'].find(name=>{const parts=name.split(':').map(Number);return Math.abs(parts[0]/parts[1]-savedRatio)<1e-12;});ratio.value=settings.ratioMode==='fixed'&&preset?preset:'custom';customRatio.value=String(savedRatio);}if(settings.straighten){value.straighten=copy(settings.straighten);value.straightenRefined=settings.straightenRefined===true;value.rulerPoints=copy(settings.straighten.rulerPoints);value.rulerBounds=value.straightenRefined?null:copy(settings.straighten.bounds);rulerTarget.value=settings.straighten.target;paintRulerLine();paintRulerFields();}}
        customLabel.hidden=ratio.value!=='custom';compare.setAttribute('aria-pressed','false');paintFields();autoNote.textContent='';outlines.hidden=true;lastFocus=doc.activeElement;dialog.hidden=false;dialog.open=true;setControlsDisabled(false);translate();status.textContent=t('idle');dialog.dataset.state='idle';host.reveal?.();dialog.scrollIntoView?.({block:'nearest'});handles[0].focus?.({preventScroll:true});if(detector&&!settings)autoStraighten();else requestPreview(0);return true;
      }catch(error){close();host.say?.(error?.message||t('unavailable'));return false;}
    }
    function refresh(){if(destroyed)return;translate();const versions=host.versions?.();entrySection.hidden=!current().source&&!versions?.available;entry.disabled=!available();entry.title=current().reason||'';versionLabel.hidden=!versions?.available;if(versions?.available)version.value=versions.value;version.disabled=!!current().locked;if(own&&!own.finishing&&!fresh())cancelChanged();}
    version.onchange=()=>{const value=version.value;close();try{const result=host.selectVersion?.(value);if(result?.catch)result.catch(error=>host.say?.(error?.message||t('failed')));}catch(error){host.say?.(error?.message||t('failed'));}refresh();};
    entry.onclick=open;
    function destroy(){if(destroyed)return;close();destroyed=true;entrySection.remove();dialog.remove();completed.remove();}
    refresh();return {open,cancel:close,refresh,destroy,element:entrySection,dialog};
  }
  return {create,identity};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioImageRectifyUI;
