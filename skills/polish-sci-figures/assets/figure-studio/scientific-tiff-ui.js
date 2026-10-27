/* Native TIFF import uses the existing canvas preview transaction. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioScientificTiffUI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(host){
    const doc=host.document||document,core=host.core||StudioScientificTiff;let active=null;
    function cancel(){active?.close(false);}
    async function open(file,target){
      cancel();if(!host.available())throw Error(host.language()==='en'?'Start the current local Windows engine to read TIFF; no cloud service is used.':'请启动当前 Windows 本机服务读取 TIFF；不会使用云端服务。');
      if(!file||file.size>core.MAX_BYTES)throw Error(host.language()==='en'?'TIFF limit: 64 MB':'TIFF 文件不能超过 64 MB');
      const en=()=>host.language()==='en',labels=new Map(),translate=(node,zh,english)=>{labels.set(node,[zh,english]);node.textContent=en()?english:zh;return node;};
      const el=(tag,zh,english,cls)=>{const node=doc.createElement(tag);if(tag==='button')node.type='button';if(zh!=null)translate(node,zh,english||zh);if(cls)node.className=cls;return node;};
      const panel=el('aside',null,null,'scientific-tiff-workspace');panel.id='scientificTiffWorkspace';panel.setAttribute('aria-label','TIFF');
      const heading=el('div',null,null,'scientific-tiff-heading'),title=el('h2','原生 TIFF 显示','Native TIFF display'),close=el('button','×');close.type='button';close.setAttribute('aria-label',en()?'Close & cancel':'关闭并取消');heading.append(title,close);panel.append(heading);
      panel.append(el('p','原始位深与采集元数据保留；这里只调整显示，不作密度定量。','Native bit depth and acquisition metadata are retained. These controls adjust display, not densitometry.','muted'));
      panel.append(el('p','比较同批荧光或密度时，请使用一致的显示窗。逐图建议范围不能作为信号强弱比较。','Use the same display window for comparable fluorescence or density images. Per-image suggested ranges do not establish relative signal strength.','muted'));
      panel.append(el('p','比例尺需依据采集标定确认；TIFF 打印 DPI 不会自动当作显微标定。选择重采样显示时，请按显示像素与原生像素的比例核对标尺。','Confirm scale bars from acquisition calibration. TIFF print DPI is not microscopy calibration. For resampled display, account for the display-to-native pixel ratio.','muted'));
      panel.append(el('p','每个文件最多 64 MB、每页 3200 万像素、128 页；工程原生 TIFF 合计最多 80 MB。同一原文件只保存一份。','Limits: 64 MB per file, 32 megapixels per page, 128 pages; 80 MB of native TIFF per project. Shared originals are stored once.','muted'));
      const filename=el('p');filename.textContent=file.name;panel.append(filename);
      const info=el('p',null,null,'muted');info.id='tiffMetadata';panel.append(info);
      const fields=el('fieldset'),legend=el('legend','选择原生平面与显示参数','Native plane and display');fields.append(legend);panel.append(fields);
      function field(id,zh,english,type='number'){
        const label=el('label'),caption=el('span',zh,english),input=el(type==='select'?'select':'input');input.id=id;if(type!=='select'){input.type=type;input.step='any';}label.append(caption,input);fields.append(label);return input;
      }
      const page=field('tiffPage','TIFF 页／OME 平面','TIFF page / OME plane','select');
      const lo=field('tiffMin','原生显示下限','Native display minimum'),hi=field('tiffMax','原生显示上限','Native display maximum'),gamma=field('tiffGamma','伽马（仅显示）','Gamma (display only)');gamma.min='.1';gamma.max='10';gamma.value='1';
      const lut=field('tiffLut','显示颜色','Display LUT','select');for(const [value,zh,english]of [['gray','灰度','Grayscale'],['green','绿色','Green'],['magenta','洋红','Magenta'],['cyan','青色','Cyan']]){const option=el('option',zh,english);option.value=value;lut.append(option);}
      const size=field('tiffFinalSize','保留时的显示分辨率','Display resolution when kept','select');for(const [value,zh,english]of [['0','原始像素尺寸','Native pixel dimensions'],['2048','最长边 2048（明确重采样）','2048 maximum edge (resampled)']]){const option=el('option',zh,english);option.value=value;size.append(option);}
      panel.append(el('p','调整时在真实画布预览，最长边 1024。保留时按上方分辨率生成 8 位显示 PNG；原始 TIFF 不降位、不覆盖。','Adjust on the real canvas using a 1024-edge preview. Keep generates an 8-bit display PNG at the chosen resolution; native TIFF bytes remain unchanged.','muted'));
      const status=el('p',null,null,'scientific-tiff-status');status.id='tiffStatus';status.setAttribute('role','status');panel.append(status);
      const details=el('details'),summary=el('summary','技术详情','Technical details'),errorDetail=el('p');details.append(summary,errorDetail);details.hidden=true;panel.append(details);
      const actions=el('div',null,null,'scientific-tiff-actions'),suggest=el('button','一键建议显示窗','Suggest display window'),keep=el('button','保留并导入','Keep & import','primary'),cancelButton=el('button','取消','Cancel');suggest.id='tiffSuggest';keep.id='tiffKeep';cancelButton.id='tiffCancel';actions.append(suggest,keep,cancelButton);panel.append(actions);
      let resolveDone;const done=new Promise(resolve=>resolveDone=resolve);
      let closed=false,source=null,metadata=null,sourceId=null,revision=0,ready=-1,pending=null,timer=null,running=false,applying=false;
      const controllers=new Set(),controls=[page,lo,hi,gamma,lut,size,suggest];
      const current=version=>{if(closed||revision!==version)return false;if(!host.valid(target)){message('导入目标已变化，请取消后重新选择。','The import target changed. Cancel and choose it again.');return false;}return true;};
      function sync(){fields.disabled=!metadata||applying;controls.forEach(input=>input.disabled=!metadata||applying||(input===suggest&&running));keep.disabled=!metadata||applying||running||ready!==revision;panel.setAttribute('aria-busy',String(running||applying||!metadata));}
      function message(zh,english){translate(status,zh,english);}
      function error(error){details.hidden=false;errorDetail.textContent=error.message;message('暂未完成显示：请检查页码、参数或文件支持范围。','Display is incomplete. Check the plane, parameters or supported file range.');}
      function closePanel(applied){if(closed)return;closed=true;clearTimeout(timer);pending=null;controllers.forEach(controller=>controller.abort());if(sourceId)host.release?.(sourceId);host.cancelPreview();panel.remove();doc.getElementById('language')?.removeEventListener('change',languageChanged);if(active?.panel===panel)active=null;resolveDone(!!applied);}
      function pageText(p){return (en()?'Page ':'第 ')+(p.index+1)+(en()?'':' 页')+` · ${p.width} × ${p.height} · ${p.bitsPerSample.join('/')} bit`+(p.supported?'':' · '+(en()?'unsupported':'暂不支持'));}
      function languageChanged(){for(const [node,pair]of labels)node.textContent=en()?pair[1]:pair[0];close.setAttribute('aria-label',en()?'Close & cancel':'关闭并取消');if(metadata)for(const option of page.options)option.textContent=pageText(metadata.pages[Number(option.value)]);paintInfo();}
      function paintInfo(){
        if(!metadata)return;const p=metadata.pages[Number(page.value)],position=p?.omePosition;
        const description=p?`${p.width} × ${p.height} · ${p.bitsPerSample.join('/')} bit · ${p.mode}`:'';
        const mapped=position?` · C${position.C} Z${position.Z} T${position.T}`:(en()?' · C/Z/T not inferred':' · 不推断 C/Z/T');
        info.textContent=description+mapped+(metadata.ome&&!metadata.ome.complete?(en()?' · partial OME mapping':' · OME 映射不完整'):'');
      }
      function configuration(edge=1024){
        const index=Number(page.value),p=metadata?.pages[index],low=Number(lo.value),high=Number(hi.value),g=Number(gamma.value),maximum=p?.bitsPerSample?.[0]===16?65535:255;
        if(!p?.supported||!lo.value||!hi.value||!gamma.value||![low,high,g].every(Number.isFinite)||low<0||high<=low||high>maximum||g<.1||g>10)throw Error(en()?'Complete a valid native range and gamma. The last preview is retained.':'请填写有效的原生范围和伽马；保留上一个有效预览。');
        return {page:index,window:[low,high],gamma:g,lut:lut.value,previewEdge:edge};
      }
      async function request(action,parameters={}){
        const controller=new AbortController();controllers.add(controller);
        try{
          try{return await host.request({action,...(sourceId?{sourceId}:{data:source?.data||rawData}),...parameters},controller.signal);}
          catch(error){
            if(!sourceId||!host.upload||controller.signal.aborted||!String(error.message).includes('TIFF session expired'))throw error;
            const uploaded=await host.upload(file,controller.signal);if(closed){host.release?.(uploaded.sourceId);throw new DOMException('Cancelled','AbortError');}
            if(uploaded.metadata.fileSha256!==metadata.fileSha256)throw Error('TIFF source checksum mismatch');
            sourceId=uploaded.sourceId;return await host.request({action,sourceId,...parameters},controller.signal);
          }
        }finally{controllers.delete(controller);}
      }
      async function prepare(result){
        const display=result.display,padding=display.data.endsWith('==')?2:display.data.endsWith('=')?1:0;
        const bytes=await core.decodeBase64(display.data,display.data.length/4*3-padding);
        if(await core.digest(bytes)!==display.sha256)throw Error('TIFF display PNG checksum mismatch');
        const image=new Image();image.src='data:image/png;base64,'+display.data;await image.decode();
        if(image.naturalWidth!==display.size[0]||image.naturalHeight!==display.size[1])throw Error('TIFF display PNG dimensions mismatch');
        return core.asset({name:file.name+(metadata.pages.length>1?(en()?' · page ':' · 第 ')+(result.native.page+1)+(en()?'':' 页'):''),source,result});
      }
      function onPreviewState(snapshot){if(snapshot.status==='cancelled'||snapshot.status==='error'){ready=-1;sync();if(!closed&&!applying)message('预览已取消；修改参数可重新预览，或关闭退出。','Preview cancelled. Change a parameter to preview again, or close.');}}
      function queue(kind='display'){if(closed||applying)return;pending={kind,revision:++revision};ready=-1;clearTimeout(timer);timer=setTimeout(drain,160);sync();}
      async function drain(){
        if(closed||running||!pending||!source)return;
        const task=pending;pending=null;running=true;sync();details.hidden=true;
        try{
          const config=configuration();
          if(task.kind==='suggest'){
            message('正在本机读取全图原生强度范围…','Reading the global native intensity range locally…');
            const result=await request('suggest',{page:config.page});if(!current(task.revision))return;
            lo.value=result.suggestedWindow[0];hi.value=result.suggestedWindow[1];gamma.value='1';queue();
          }else{
            message('正在本机解码并生成真实预览…','Decoding locally and generating the real preview…');
            const result=await request('display',config);if(!current(task.revision))return;
            const asset=await prepare(result);if(!current(task.revision))return;
            if(await host.preview(asset,source,target,{isCurrent:()=>current(task.revision),onState:onPreviewState})){ready=task.revision;message('真实画布预览 · 尚未写入工程','Real canvas preview · not saved to the project');}
          }
        }catch(caught){if(!closed&&caught.name!=='AbortError')error(caught);}
        finally{running=false;sync();if(pending&&!closed)drain();}
      }
      function pageChanged(){
        const p=metadata.pages[Number(page.value)],maximum=p?.bitsPerSample?.[0]===16?65535:255;
        lo.min='0';lo.max=String(maximum);hi.min='0';hi.max=String(maximum);lo.value='0';hi.value=String(maximum);gamma.value='1';lut.value='gray';
        for(const option of lut.options)option.disabled=p?.samplesPerPixel===3&&option.value!=='gray';paintInfo();queue();
      }
      close.onclick=cancelButton.onclick=()=>closePanel(false);suggest.onclick=()=>queue('suggest');page.onchange=pageChanged;
      const composing=new WeakSet();for(const input of [lo,hi,gamma,lut,size]){input.addEventListener('compositionstart',()=>composing.add(input));input.addEventListener('compositionend',()=>{composing.delete(input);queue();});input.addEventListener(input===lut||input===size?'change':'input',event=>{if(!event.isComposing&&!composing.has(input))queue();});}
      keep.onclick=async()=>{
        if(keep.disabled)return;applying=true;ready=-1;pending=null;clearTimeout(timer);const version=++revision;sync();details.hidden=true;
        try{
          message('正在生成所选分辨率的显示图…','Generating the selected display resolution…');
          const result=await request('display',configuration(Number(size.value)));if(!current(version))return;
          const asset=await prepare(result);if(!current(version))return;
          if(!await host.preview(asset,source,target,{isCurrent:()=>current(version),onState:onPreviewState}))throw Error('The preview target changed');
          if(!current(version)||!await host.keep(asset,source,target))throw Error('The import target changed');
          closePanel(true);
        }catch(caught){if(!closed&&caught.name!=='AbortError')error(caught);}
        finally{applying=false;sync();}
      };
      active={panel,close:closePanel};doc.body.append(panel);doc.getElementById('language')?.addEventListener('change',languageChanged);sync();message('正在本机读取 TIFF 元数据…','Reading native TIFF metadata locally…');
      let rawData='';
      (async()=>{
        try{
          const uploadController=new AbortController();controllers.add(uploadController);
          let uploaded,values;
          try{values=await Promise.all([host.readFile(file),file.arrayBuffer(),host.upload?host.upload(file,uploadController.signal).then(value=>{uploaded=value;return value;}):Promise.resolve()]);}finally{controllers.delete(uploadController);}
          const [url,buffer]=values;
          if(closed){if(uploaded?.sourceId)host.release?.(uploaded.sourceId);return;}
          if(uploaded)sourceId=uploaded.sourceId;
          rawData=url.slice(url.indexOf(',')+1);const fileSha=await core.digest(buffer);if(closed)return;
          const result=uploaded||await request('inspect');if(closed||!host.valid(target))return;
          metadata=result.metadata;if(metadata.fileSha256!==fileSha)throw Error('TIFF source checksum mismatch');
          source=core.sourceRecord({name:file.name,data:rawData,bytes:file.size,sha256:fileSha,metadata});
          for(const p of metadata.pages){const option=el('option');option.value=String(p.index);option.disabled=!p.supported;option.textContent=pageText(p);page.append(option);}
          const first=metadata.pages.find(p=>p.supported);if(!first)throw Error(metadata.pages[0].unsupportedReason||'No supported native plane');
          page.value=String(first.index);sync();pageChanged();
        }catch(caught){if(!closed&&caught.name!=='AbortError'){error(caught);sync();}}
      })();
      return done;
    }
    return {open,cancel};
  }
  return {create};
});
