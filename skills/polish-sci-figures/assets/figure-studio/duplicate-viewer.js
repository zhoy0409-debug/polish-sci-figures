/* Interactive review only: all matching comes from the recorded local check. */
'use strict';
const StudioDuplicateViewer = (() => {
  const NS='http://www.w3.org/2000/svg', MIN_ZOOM=.25, MAX_ZOOM=32;
  const finite=Number.isFinite;
  const text={
    '查看匹配细节':'Review matching details','关闭':'Close','并排查看':'Side by side','对齐叠加':'Aligned overlay',
    '同步缩放与平移':'Sync zoom & pan','显示匹配连线':'Show match lines','缩小':'Zoom out','放大':'Zoom in','适合窗口':'Fit',
    '滚轮缩放 · 拖动平移':'Scroll to zoom · Drag to pan','叠加透明度':'Overlay opacity','只看 A':'A only','叠加':'Blend','只看 B':'B only',
    '按住看 B':'Hold to view B','按住按钮或空格键查看 B，松开恢复叠加。':'Hold the button or Space to view B; release to restore the blend.',
    '原始图像':'Original image','映射后的检查预览':'Mapped review preview','检查预览':'Review preview','TIFF 检查预览':'TIFF review preview','低分辨率缩略图':'Low-resolution thumbnail',
    '正在读取这两张图片…':'Loading this image pair…','图片预览不可用。':'Image preview unavailable.',
    '此记录缺少有效对齐坐标，仍可并排查看。':'This record has no valid alignment coordinates. Side-by-side review remains available.',
    '完全相同的像素内容':'Identical pixel content','按已验证的匹配坐标对齐；空白区域表示该图片没有覆盖。':'Aligned using the recorded verified matches. Blank areas are outside that image’s coverage.',
    '匹配点：{0} 组':'Matched points: {0} pairs','当前视野显示 {0} / {1} 组匹配点':'Showing {0} / {1} matched point pairs in this view','匹配连线已隐藏':'Match lines hidden',
    '此匹配没有可显示的特征点。':'This match has no feature points to display.',
    '原图 {0} × {1} 像素':'Original: {0} × {1} pixels','预览 {0} × {1} 像素':'Preview: {0} × {1} pixels',
    '高位深图像采用亮度映射后的检查预览；原始像素不变。':'High-bit-depth images use an intensity-mapped review preview. Original pixels remain unchanged.',
    'TIFF 采用转换后的检查预览；原始文件不变，放大不会增加预览细节。':'TIFF uses a converted review preview. The original file remains unchanged; zooming cannot add preview detail.',
    '当前只有检查预览，放大不会增加原图中未保留的细节。':'Only a review preview is available here. Zooming cannot recover detail absent from that preview.',
    '蓝色为 A，红色为 B。同步模式按各图片的相对视野缩放和平移；叠加模式使用实际匹配变换。':'Blue marks A; red marks B. Sync uses relative image views. Overlay uses the actual matching transform.',
    '图片 A':'Image A','图片 B':'Image B','A / B 证据查看区':'A / B evidence viewer','叠加查看区':'Aligned overlay viewer',
    '已对齐的图片 B':'Aligned image B','当前缩放':'Current zoom'
  };
  function translate(t){return (key,...values)=>{const language=typeof document!=='undefined'?document.documentElement.lang:'en';
    const template=Object.hasOwn(text,key)?language.startsWith('zh')?key:text[key]:typeof t==='function'?t(key,...values):key;
    return template.replace(/\{(\d+)\}/g,(_,n)=>String(values[+n]??''));};}
  function affine(value){
    if(!Array.isArray(value)||value.length!==2||value.some(row=>!Array.isArray(row)||row.length!==3||row.some(v=>!finite(v))))return null;
    const [[a,c,e],[b,d,f]]=value,det=a*d-b*c;
    return finite(det)&&Math.abs(det)>1e-10?{a,b,c,d,e,f}:null;
  }
  function inverse(m){if(!m)return null;const det=m.a*m.d-m.b*m.c;if(!finite(det)||Math.abs(det)<1e-10)return null;
    return {a:m.d/det,b:-m.b/det,c:-m.c/det,d:m.a/det,e:(m.c*m.f-m.d*m.e)/det,f:(m.b*m.e-m.a*m.f)/det};}
  function point(m,p){return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};}
  function fitScale(view,image){return Math.max(.000001,Math.min(Math.max(1,view.width-32)/image.width,Math.max(1,view.height-32)/image.height));}
  function cameraMatrix(camera,view,image){const s=fitScale(view,image)*camera.zoom;return {a:s,b:0,c:0,d:s,e:view.width/2-camera.x*s,f:view.height/2-camera.y*s};}
  function fitCamera(image){return {zoom:1,x:image.width/2,y:image.height/2};}
  function zoomAround(camera,requested,anchor,view,image){
    const before=cameraMatrix(camera,view,image),world=point(inverse(before),anchor),zoom=Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,requested)),scale=fitScale(view,image)*zoom;
    return {zoom,x:world.x-(anchor.x-view.width/2)/scale,y:world.y-(anchor.y-view.height/2)/scale};
  }
  function panCamera(camera,delta,view,image){const scale=fitScale(view,image)*camera.zoom;return {...camera,x:camera.x-delta.x/scale,y:camera.y-delta.y/scale};}
  function syncCamera(camera,from,to){return {zoom:camera.zoom,x:camera.x/from.width*to.width,y:camera.y/from.height*to.height};}
  function analysisSize(info){const width=info?.analysisWidth,height=info?.analysisHeight;return finite(width)&&finite(height)&&width>0&&height>0&&width<=30000&&height<=30000?{width,height}:null;}
  function alignment(pair,a,b){
    const sa=analysisSize(a),sb=analysisSize(b);if(!sa||!sb)return null;
    if(pair?.kind==='exact'&&sa.width===sb.width&&sa.height===sb.height)return {a:1,b:0,c:0,d:1,e:0,f:0};
    return affine(pair?.transformAtoB);
  }
  function raster(data){return typeof data==='string'&&data.length<=16000100&&/^data:image\/(?:png|jpe?g|webp|bmp);base64,[a-z\d+/=\s]+$/i.test(data);}
  function sources(info,original){
    const mapped=!!info?.intensityMapping||info?.warnings?.includes('high_bit_depth_preview');
    const tiff=typeof original==='string'&&/^data:image\/tiff?[;,]/i.test(original),result=[];
    if(!mapped&&!tiff&&raster(original))result.push({url:original,kind:'original'});
    if(raster(info?.reviewPreview))result.push({url:info.reviewPreview,kind:mapped?'mapped':tiff?'converted':'review'});
    if(raster(info?.thumbnail))result.push({url:info.thumbnail,kind:'thumbnail'});
    return result.filter((item,i,items)=>items.findIndex(other=>other.url===item.url)===i);
  }
  function matchPoints(pair){const a=pair?.pointsA,b=pair?.pointsB;if(!Array.isArray(a)||!Array.isArray(b))return [];
    const result=[];for(let i=0;i<Math.min(a.length,b.length,200);i++){const pa=a[i],pb=b[i];if(Array.isArray(pa)&&Array.isArray(pb)&&pa.length===2&&pb.length===2&&[...pa,...pb].every(finite))result.push({a:{x:pa[0],y:pa[1]},b:{x:pb[0],y:pb[1]}});}return result;}
  const matrixText=m=>`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
  let active=null,serial=0;
  function open({pair={},a={},b={},sourceA,sourceB,t,onClose}={}){
    active?.close();
    const T=translate(t),focusBefore=document.activeElement,id=++serial,dialog=document.createElement('dialog');
    dialog.className='duplicate-viewer';dialog.id='duplicateEvidenceViewer';dialog.setAttribute('aria-labelledby','duplicateViewerTitle-'+id);
    const make=(tag,content,className)=>{const el=document.createElement(tag);if(content!==undefined)el.textContent=content;if(className)el.className=className;return el;};
    const svgNode=(tag,attrs={})=>{const el=document.createElementNS(NS,tag);for(const [key,value]of Object.entries(attrs))el.setAttribute(key,String(value));return el;};
    const button=(label,action,className)=>{const el=make('button',T(label),className);el.type='button';el.onclick=action;return el;};
    const check=(label,checked,action)=>{const wrap=make('label',undefined,'duplicate-viewer-check'),input=make('input');input.type='checkbox';input.checked=checked;input.onchange=()=>action(input.checked);wrap.append(input,make('span',T(label)));return {wrap,input};};
    const header=make('div',undefined,'duplicate-viewer-heading'),titles=make('div'),kicker=make('span','FIGURE STUDIO · IMAGE REVIEW','duplicate-viewer-kicker'),title=make('h2',T('查看匹配细节'));
    title.id='duplicateViewerTitle-'+id;titles.append(kicker,title);header.append(titles);const closeButton=button('关闭',()=>close(),'duplicate-viewer-close');header.append(closeButton);dialog.append(header);
    let closed=false,mode='side',sync=true,showLines=true,opacity=.5,compare='blend',peek=false,gesture=null,pendingMove=null,frame=0,activePane=0,ready=false;
    const infos=[a,b],sourceValues=[sourceA,sourceB],sizes=[analysisSize(a),analysisSize(b)],cameras=[null,null],loaded=[null,null],loaders=new Map();
    const transform=alignment(pair,a,b),back=inverse(transform),points=matchPoints(pair),hasPoints=points.length>0;
    let overlayCamera=null;
    const toolbar=make('div',undefined,'duplicate-viewer-toolbar'),modes=make('div',undefined,'duplicate-viewer-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label',T('A / B 证据查看区'));
    const sideButton=button('并排查看',()=>setMode('side')),overlayButton=button('对齐叠加',()=>setMode('overlay'));
    sideButton.id='duplicateViewerSide';overlayButton.id='duplicateViewerOverlay';overlayButton.disabled=!transform;overlayButton.title=!transform?T('此记录缺少有效对齐坐标，仍可并排查看。'):T('按已验证的匹配坐标对齐；空白区域表示该图片没有覆盖。');modes.append(sideButton,overlayButton);
    const syncCheck=check('同步缩放与平移',true,value=>{sync=value;if(value&&ready&&mode==='side'){cameras[1-activePane]=syncCamera(cameras[activePane],sizes[activePane],sizes[1-activePane]);schedule();}});
    syncCheck.input.id='duplicateViewerSync';
    const linesCheck=check('显示匹配连线',true,value=>{showLines=value;schedule();});linesCheck.input.id='duplicateViewerLines';linesCheck.input.disabled=!hasPoints;linesCheck.wrap.title=hasPoints?T('匹配点：{0} 组',points.length):T('此匹配没有可显示的特征点。');
    const zoomTools=make('div',undefined,'duplicate-viewer-zoom'),minus=button('缩小',()=>stepZoom(.8)),plus=button('放大',()=>stepZoom(1.25)),fit=button('适合窗口',reset),zoomValue=make('output','100%');
    minus.textContent='−';minus.setAttribute('aria-label',T('缩小'));minus.title=T('缩小');plus.textContent='+';plus.setAttribute('aria-label',T('放大'));plus.title=T('放大');fit.id='duplicateViewerFit';zoomValue.setAttribute('aria-label',T('当前缩放'));zoomTools.append(minus,zoomValue,plus,fit);toolbar.append(modes,syncCheck.wrap,linesCheck.wrap,zoomTools);dialog.append(toolbar);
    const status=make('p',T('正在读取这两张图片…'),'duplicate-viewer-status');status.id='duplicateViewerStatus';status.setAttribute('role','status');dialog.append(status);
    const stage=make('div',undefined,'duplicate-viewer-stage');dialog.append(stage);
    const sides=make('div',undefined,'duplicate-viewer-sides'),overlay=make('div',undefined,'duplicate-viewer-overlay');stage.append(sides,overlay);
    const panes=infos.map((info,index)=>{
      const pane=make('section',undefined,'duplicate-viewer-pane'),caption=make('div',undefined,'duplicate-viewer-caption'),letter=make('span',index?'B':'A','duplicate-viewer-letter '+(index?'is-b':'is-a'));
      const label=make('strong',info.label||T(index?'图片 B':'图片 A'));label.title=label.textContent;const badge=make('small','');caption.append(letter,label,badge);
      const surface=svgNode('svg',{'aria-label':T(index?'图片 B':'图片 A'),role:'img',tabindex:'0'});surface.classList.add('duplicate-viewer-surface');const group=svgNode('g'),image=svgNode('image',{preserveAspectRatio:'none'});group.append(image);surface.append(group);pane.append(caption,surface);sides.append(pane);
      bind(surface,index);return {pane,caption,badge,surface,group,image};
    });
    const overlayCaption=make('div',undefined,'duplicate-viewer-caption');overlayCaption.append(make('span','A + B','duplicate-viewer-letter'),make('strong',T('对齐叠加')));overlay.append(overlayCaption);
    const overlaySurface=svgNode('svg',{'aria-label':T('叠加查看区'),role:'img',tabindex:'0'});overlaySurface.classList.add('duplicate-viewer-surface');const overlayRoot=svgNode('g'),imageA=svgNode('image',{preserveAspectRatio:'none'}),imageB=svgNode('image',{preserveAspectRatio:'none'}),alignedB=svgNode('g');if(back)alignedB.setAttribute('transform',matrixText(back));alignedB.append(imageB);overlayRoot.append(imageA,alignedB);overlaySurface.append(overlayRoot);overlay.append(overlaySurface);bind(overlaySurface,2);
    const links=svgNode('svg',{'aria-hidden':'true'});links.classList.add('duplicate-viewer-links');stage.append(links);
    const overlayTools=make('div',undefined,'duplicate-viewer-overlay-tools'),opacityLabel=make('label',undefined,'duplicate-viewer-opacity'),opacityText=make('span',T('叠加透明度')),opacityInput=make('input'),opacityValue=make('output','50%');opacityInput.type='range';opacityInput.min='0';opacityInput.max='100';opacityInput.step='1';opacityInput.value='50';opacityInput.id='duplicateViewerOpacity';opacityInput.setAttribute('aria-label',T('叠加透明度'));opacityInput.oninput=()=>{opacity=Number(opacityInput.value)/100;compare='blend';schedule();};opacityLabel.append(opacityText,opacityInput,opacityValue);
    const compareButtons=['只看 A','叠加','只看 B'].map((label,index)=>button(label,()=>{compare=['a','blend','b'][index];schedule();}));
    const hold=button('按住看 B',()=>{});hold.id='duplicateViewerHold';hold.title=T('按住按钮或空格键查看 B，松开恢复叠加。');hold.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();peek=true;hold.setPointerCapture(event.pointerId);schedule();};
    const stopPeek=()=>{if(peek){peek=false;schedule();}};hold.onpointerup=stopPeek;hold.onpointercancel=stopPeek;hold.onlostpointercapture=stopPeek;hold.onblur=stopPeek;
    hold.onkeydown=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();event.stopPropagation();peek=true;schedule();}};hold.onkeyup=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();stopPeek();}};
    overlayTools.append(opacityLabel,...compareButtons,hold);dialog.append(overlayTools);
    const footer=make('div',undefined,'duplicate-viewer-footer'),help=make('p',T('滚轮缩放 · 拖动平移')),pointStatus=make('p',hasPoints?T('匹配点：{0} 组',points.length):T(pair.kind==='exact'?'完全相同的像素内容':'此匹配没有可显示的特征点。'));
    const sourceNote=make('p','','duplicate-viewer-source-note');footer.append(help,pointStatus,sourceNote);dialog.append(footer);
    const geometryNote=make('p',T('蓝色为 A，红色为 B。同步模式按各图片的相对视野缩放和平移；叠加模式使用实际匹配变换。'),'duplicate-viewer-explanation');dialog.append(geometryNote);
    function view(surface){const r=surface.getBoundingClientRect();return {width:Math.max(1,r.width),height:Math.max(1,r.height)};}
    function cameraFor(index){return index===2?overlayCamera:cameras[index];}
    function sizeFor(index){return sizes[index===2?0:index];}
    function surfaceFor(index){return index===2?overlaySurface:panes[index].surface;}
    function setCamera(index,value){if(index===2)overlayCamera=value;else{activePane=index;cameras[index]=value;if(sync)cameras[1-index]=syncCamera(value,sizes[index],sizes[1-index]);}}
    function bind(surface,index){
      surface.addEventListener('wheel',event=>{if(!ready)return;event.preventDefault();const r=surface.getBoundingClientRect(),v=view(surface),delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?v.height:1),anchor={x:event.clientX-r.left,y:event.clientY-r.top};setCamera(index,zoomAround(cameraFor(index),cameraFor(index).zoom*Math.exp(-Math.max(-600,Math.min(600,delta))*.002),anchor,v,sizeFor(index)));schedule();},{passive:false});
      surface.onpointerdown=event=>{if(event.button!==0||!ready)return;event.preventDefault();finishGesture();surface.focus({preventScroll:true});if(index!==2)activePane=index;gesture={index,pointerId:event.pointerId,surface,origin:{x:event.clientX,y:event.clientY},camera:{...cameraFor(index)},view:view(surface)};surface.setPointerCapture(event.pointerId);surface.classList.add('is-panning');};
      surface.onpointermove=event=>{if(!gesture||gesture.surface!==surface||gesture.pointerId!==event.pointerId)return;pendingMove={x:event.clientX,y:event.clientY};schedule();};
      surface.onpointerup=event=>{if(gesture?.surface===surface&&gesture.pointerId===event.pointerId){pendingMove={x:event.clientX,y:event.clientY};applyMove();finishGesture();schedule();}};
      surface.onpointercancel=()=>{finishGesture();schedule();};surface.onlostpointercapture=()=>{if(gesture?.surface===surface){finishGesture();schedule();}};
      surface.onkeydown=event=>{if(!ready)return;if(['+','=','-','0'].includes(event.key)){event.preventDefault();event.stopPropagation();if(index!==2)activePane=index;if(event.key==='0')reset();else stepZoom(event.key==='-'?.8:1.25);}};
    }
    function finishGesture(){if(!gesture)return;const old=gesture;gesture=null;pendingMove=null;old.surface.classList.remove('is-panning');if(old.surface.hasPointerCapture?.(old.pointerId))old.surface.releasePointerCapture(old.pointerId);}
    function applyMove(){if(!gesture||!pendingMove)return;const {index,origin,camera,view:v}=gesture;setCamera(index,panCamera(camera,{x:pendingMove.x-origin.x,y:pendingMove.y-origin.y},v,sizeFor(index)));pendingMove=null;}
    function stepZoom(factor){if(!ready)return;const index=mode==='overlay'?2:activePane,v=view(surfaceFor(index));setCamera(index,zoomAround(cameraFor(index),cameraFor(index).zoom*factor,{x:v.width/2,y:v.height/2},v,sizeFor(index)));schedule();}
    function reset(){if(!ready)return;finishGesture();if(mode==='overlay')overlayCamera=fitCamera(sizes[0]);else{cameras[0]=fitCamera(sizes[0]);cameras[1]=fitCamera(sizes[1]);}schedule();}
    function setMode(value){if(value==='overlay'&&!transform)return;finishGesture();peek=false;mode=value;sides.hidden=mode!=='side';overlay.hidden=mode!=='overlay';overlayTools.hidden=mode!=='overlay';syncCheck.wrap.hidden=mode!=='side';sideButton.setAttribute('aria-pressed',String(mode==='side'));overlayButton.setAttribute('aria-pressed',String(mode==='overlay'));schedule();}
    function schedule(){if(closed||frame)return;frame=requestAnimationFrame(render);}
    function dimensions(surface){const v=view(surface);surface.setAttribute('viewBox',`0 0 ${v.width} ${v.height}`);return v;}
    function render(){frame=0;if(closed)return;applyMove();if(!ready)return;
      const matrices=panes.map((pane,index)=>{const v=dimensions(pane.surface),m=cameraMatrix(cameras[index],v,sizes[index]);pane.group.setAttribute('transform',matrixText(m));return m;});
      const ov=dimensions(overlaySurface),om=cameraMatrix(overlayCamera,ov,sizes[0]);overlayRoot.setAttribute('transform',matrixText(om));
      const display=peek?'b':compare;imageA.style.opacity=display==='b'?'0':'1';alignedB.style.opacity=display==='a'?'0':display==='b'?'1':String(opacity);opacityValue.value=Math.round(opacity*100)+'%';opacityInput.value=String(Math.round(opacity*100));compareButtons.forEach((el,index)=>el.setAttribute('aria-pressed',String(['a','blend','b'][index]===display)));hold.setAttribute('aria-pressed',String(peek));
      const zoom=cameraFor(mode==='overlay'?2:activePane).zoom;zoomValue.value=Math.round(zoom*100)+'%';minus.disabled=zoom<=MIN_ZOOM;plus.disabled=zoom>=MAX_ZOOM;
      const area=links.getBoundingClientRect();links.setAttribute('viewBox',`0 0 ${Math.max(1,area.width)} ${Math.max(1,area.height)}`);links.replaceChildren();let visible=0;
      function screen(p,index){const surface=mode==='overlay'?overlaySurface:panes[index].surface,r=surface.getBoundingClientRect(),m=mode==='overlay'?om:matrices[index],q=point(m,mode==='overlay'&&index===1?point(back,p):p);if(q.x<0||q.y<0||q.x>r.width||q.y>r.height)return null;return {x:q.x+r.left-area.left,y:q.y+r.top-area.top};}
      if(showLines&&hasPoints){for(const match of points){const pa=screen(match.a,0),pb=screen(match.b,1);if(!pa||!pb)continue;visible++;links.append(svgNode('line',{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y,class:'duplicate-viewer-match-line'}),svgNode('circle',{cx:pa.x,cy:pa.y,r:3.1,class:'duplicate-viewer-match-a'}),svgNode('circle',{cx:pb.x,cy:pb.y,r:3.1,class:'duplicate-viewer-match-b'}));}}
      pointStatus.textContent=hasPoints?showLines?T('当前视野显示 {0} / {1} 组匹配点',visible,points.length):T('匹配连线已隐藏'):T(pair.kind==='exact'?'完全相同的像素内容':'此匹配没有可显示的特征点。');
    }
    async function load(info,original){
      for(const candidate of sources(info,original)){if(closed)return null;const img=new Image();img.decoding='async';try{await new Promise((resolve,reject)=>{loaders.set(img,()=>reject(Error('closed')));img.onload=resolve;img.onerror=reject;img.src=candidate.url;});if(closed)return null;if(!img.naturalWidth||!img.naturalHeight)continue;const geometry=analysisSize(info);if(candidate.kind==='original'&&geometry&&Math.abs((img.naturalWidth/img.naturalHeight)/(geometry.width/geometry.height)-1)>.015)continue;return {...candidate,width:img.naturalWidth,height:img.naturalHeight};}catch{}finally{img.onload=null;img.onerror=null;img.removeAttribute('src');loaders.delete(img);}}
      return null;
    }
    const blur=()=>{finishGesture();peek=false;schedule();};window.addEventListener('blur',blur);
    let observer=null;if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(schedule);observer.observe(stage);}else window.addEventListener('resize',schedule);
    function close(){if(closed)return;closed=true;finishGesture();if(frame)cancelAnimationFrame(frame);observer?.disconnect();window.removeEventListener('resize',schedule);window.removeEventListener('blur',blur);for(const [loader,cancel]of loaders){cancel();loader.onload=null;loader.onerror=null;loader.removeAttribute('src');}loaders.clear();for(const image of [imageA,imageB,...panes.map(pane=>pane.image)])image.removeAttribute('href');infos.length=sourceValues.length=loaded.length=0;sourceA=sourceB=null;if(dialog.open)dialog.close();dialog.remove();if(active?.id===id)active=null;if(focusBefore?.isConnected)focusBefore.focus({preventScroll:true});onClose?.();}
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.addEventListener('close',()=>{if(!closed)close();});
    const handle={id,close,destroy:close};active=handle;document.body.append(dialog);setMode('side');dialog.showModal();closeButton.focus({preventScroll:true});
    Promise.all(infos.map((info,index)=>load(info,sourceValues[index]))).then(values=>{
      if(closed)return;values.forEach((value,index)=>{loaded[index]=value;});if(values.some(value=>!value)){status.textContent=T('图片预览不可用。');minus.disabled=true;plus.disabled=true;fit.disabled=true;overlayButton.disabled=true;return;}
      values.forEach((value,index)=>{sizes[index]||={width:value.width,height:value.height};cameras[index]=fitCamera(sizes[index]);const image=panes[index].image;image.setAttribute('href',value.url);image.setAttribute('width',sizes[index].width);image.setAttribute('height',sizes[index].height);const badge=panes[index].badge;badge.textContent=T(({original:'原始图像',mapped:'映射后的检查预览',converted:'TIFF 检查预览',review:'检查预览',thumbnail:'低分辨率缩略图'})[value.kind]);badge.title=T('原图 {0} × {1} 像素',infos[index].width||value.width,infos[index].height||value.height)+(value.kind!=='original'?' · '+T('预览 {0} × {1} 像素',value.width,value.height):'');});
      for(const [index,image]of [[0,imageA],[1,imageB]]){image.setAttribute('href',values[index].url);image.setAttribute('width',sizes[index].width);image.setAttribute('height',sizes[index].height);}overlayCamera=fitCamera(sizes[0]);ready=true;
      status.textContent=transform?pair.kind==='exact'?T('完全相同的像素内容'):T('按已验证的匹配坐标对齐；空白区域表示该图片没有覆盖。'):T('此记录缺少有效对齐坐标，仍可并排查看。');
      sourceNote.textContent=values.some(value=>value.kind==='mapped')?T('高位深图像采用亮度映射后的检查预览；原始像素不变。'):values.some(value=>value.kind==='converted')?T('TIFF 采用转换后的检查预览；原始文件不变，放大不会增加预览细节。'):values.some(value=>value.kind!=='original')?T('当前只有检查预览，放大不会增加原图中未保留的细节。'):'';schedule();
    });
    return handle;
  }
  return {open,affine,inverse,point,fitScale,cameraMatrix,fitCamera,zoomAround,panCamera,syncCamera,analysisSize,alignment,raster,sources,matchPoints};
})();
if(typeof module!=='undefined')module.exports=StudioDuplicateViewer;
