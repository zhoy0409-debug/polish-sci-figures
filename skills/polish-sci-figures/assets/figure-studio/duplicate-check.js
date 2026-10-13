/* Local image screening. Image bytes never leave the loopback editor service. */
'use strict';
const StudioDuplicateCheck = (() => {
  const LIMIT = {images:60, bytes:12000000, characters:40000000};
  const raster = value => typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp|tiff?|bmp);base64,[a-z\d+/=\s]+$/i.test(value);
  const translations = {
    '图片查重':'Check images','检查图中是否重复使用了图片':'Check for repeated images in your figure',
    '在本机检查，原图保持不变。':'Checked locally. Original images stay unchanged.',
    '检查范围':'Check scope','当前组图':'Current figure','已选图片或小图':'Selected images or panels','仅本地文件':'Local files only',
    '添加本地图片':'Add local images','清空文件':'Clear files','关闭':'Close','开始检查':'Start check','取消检查':'Cancel check',
    '只读取图片图层，不把坐标轴或文字当作图片比较。整页图片会作为一张图检查，不自动拆分内部小图。':'Only raster image layers are compared, not vector axes or text. A flattened page is checked as one image; internal panels are not automatically separated.',
    '打开已安装的 Figure Studio，或由 skill 启动本机编辑器，即可使用图片查重。当前离线页面没有连接检测服务。':'Open the installed Figure Studio, or launch the local editor through the skill, to check images. This offline page is not connected to the screening service.',
    '没有找到可检查的图片图层。可添加本地图片；纯矢量图形无需作为图片查重。':'No raster image layers found. Add local images to check; vector-only artwork is not compared as an image.',
    '请先选择图片或小图，或切换到“当前组图”。':'Select images or panels first, or choose Current figure.',
    '需要至少两张图片。':'At least two images are needed.',
    '{0} 张图片 · {1} 对比较':'{0} images · {1} pairs',
    '跳过 {0} 个隐藏、外链或不支持的图片图层。':'Skipped {0} hidden, externally linked or unsupported image layers.',
    '每批最多 60 张图片；请缩小选择范围。':'Check up to 60 images per batch; narrow the selection.',
    '图片数据超过本机检查容量，请减少图片数量或缩小原图。':'Image data exceeds the local screening capacity. Use fewer or smaller images.',
    '文件过大或不是支持的图片：{0}':'Image too large or unsupported: {0}',
    '读取图片失败：{0}':'Could not read image: {0}',
    '正在准备检查…':'Preparing the check…','正在读取图片':'Reading images','正在比较图片':'Comparing images',
    '正在生成匹配证据':'Building match evidence','检查中…':'Checking…','取消中…':'Cancelling…','已取消检查。':'Check cancelled.',
    '检查未完成：{0}':'Check could not finish: {0}',
    '连接暂时中断，正在重试；检查任务和取消请求已保留。':'Connection interrupted. Retrying; the check and any cancellation request are retained.',
    '检测服务暂不可用，请重新连接本机编辑器。':'The screening service is unavailable. Reconnect the local editor.',
    '发现 {0} 对需要复核的图片':'{0} image pairs to review','未发现达到检测阈值的重复线索':'No repeated-image candidates met the screening thresholds',
    '这是辅助筛查，请结合原图与实验记录复核；未检出不等于保证没有重复。':'Review candidates against original images and experiment records. No matches is not a guarantee that no duplication exists.',
    '相同图像':'Identical image','疑似变换重复':'Possible transformed duplicate','疑似局部重叠':'Possible partial overlap',
    '{0} 个匹配点 · 特征覆盖 {1}% / {2}%':'{0} matching points · feature coverage {1}% / {2}%',
    '匹配证据':'Match evidence','定位这两张图':'Locate this pair','下载证据图':'Download evidence',
    '外部文件':'External file','导出 HTML 报告':'Export HTML report','导出 JSON 记录':'Export JSON record',
    '检查时的图片快照':'Image snapshot at check time','图片已更新，请重新检查后再定位。':'Images have changed. Run the check again before locating them.',
    '这对图片来自本地文件，不在当前画布内。':'This pair comes from local files and is not on the canvas.',
    '图形在检查后已发生变化；以下结果对应检查时的快照。':'The figure has changed. These results refer to the snapshot taken at check time.',
    '结果与说明':'Results & notes','图片清单':'Image inventory','图片':'Image','移除 {0}':'Remove {0}',
    '检查结束':'Check complete','同一图层内部的重复不在此次检查范围内。':'Repetition within a single image layer is not checked.',
    '添加的图片只用于查重，不会插入或修改画布。':'Added files are used for screening only; they do not change the canvas.',
    '检查嵌入的原始图片内容，包括画布上被裁切遮挡的部分。':'Embedded source images are checked, including areas hidden by canvas cropping.',
    '图片细节不足，仅可靠检查完全相同的内容。':'Too little image detail for reliable transformed matching; exact-image checks remain available.',
    '可区分的特征较少，变换或局部重复可能无法检出。':'Few distinctive features; transformed or partial duplication may not be detected.',
    '重复纹理较多，已抑制可能造成误报的特征匹配。':'Repetitive texture detected; ambiguous feature matches are suppressed to reduce false positives.',
    '高位深图片已用强度映射生成检查预览；原始像素未修改，映射参数保存在 JSON 记录中。':'A mapped intensity preview is used for this high-bit-depth image. Original pixels are unchanged; mapping parameters are included in the JSON record.',
    '本地文件 {0}':'Local file {0}','尚未选择本地图片。':'No local images selected.',
    '继续显示 {0} 对结果':'Show {0} more pairs',
    '因图片较多，部分结果仅提供缩略图；可缩小批次后重新生成证据图。':'Some pairs show thumbnails only because the batch is large. Recheck a smaller batch to generate evidence.',
    '查看上次结果':'View last results','已定位疑似重复图片；原图未修改。':'Located the candidate images; originals are unchanged.'
  };
  function hidden(node, boundary) {
    for(let current=node; current && current!==boundary; current=current.parentElement){
      if(['defs','clipPath','mask','symbol'].includes(current.localName))return true;
      const style=typeof getComputedStyle==='function'?getComputedStyle(current):current.style;
      if(current.hasAttribute?.('hidden')||current.getAttribute?.('display')==='none'||current.getAttribute?.('visibility')==='hidden'||current.getAttribute?.('opacity')==='0'||style?.display==='none'||style?.visibility==='hidden'||style?.opacity==='0')return true;
    }
    return false;
  }
  function collect(root, {scope='all', groups=[], panels=[], label=id=>id, variant=()=>0}={}) {
    const images=[],refs={},skipped=[];
    if(!root)return {images,refs,skipped};
    const groupMap=new Map(groups.map(g=>[g.id,new Set(g.keys)]));
    for(const panel of root.querySelectorAll('svg[data-panel]')){
      const panelId=panel.getAttribute('data-panel'),keys=groupMap.get(panelId);
      if(scope==='selected'&&!keys&&!panels.includes(panelId))continue;
      let number=0;
      for(const node of panel.querySelectorAll('image,use')){
        const key=node.getAttribute('data-key');
        if(scope==='selected'&&groups.length&&(!keys||!keys.has(key)))continue;
        if(hidden(node,panel.parentElement)){if(node.localName==='image')skipped.push('hidden');continue;}
        let sources=[node];
        if(node.localName==='use'){
          const href=node.getAttribute('href')||node.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';
          const target=href.startsWith('#')?[...panel.querySelectorAll('[id]')].find(el=>el.id===href.slice(1)):null;
          sources=target?.localName==='image'?[target]:target?[...target.querySelectorAll('image')]:[];
        }
        for(const source of sources){
          const data=source.getAttribute('href')||source.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';
          if(!raster(data)){skipped.push('unsupported');continue;}
          const id='canvas-'+images.length,vi=variant(panelId);
          images.push({id,label:(label(panelId)+' · '+(++number)).slice(0,200),data});refs[id]={panelId,vi,key,data};
        }
      }
    }
    return {images,refs,skipped};
  }
  const escape = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function warningText(w,t=x=>x,language='en'){
    const keys={low_information:'图片细节不足，仅可靠检查完全相同的内容。',few_distinctive_features:'可区分的特征较少，变换或局部重复可能无法检出。',repetitive_texture:'重复纹理较多，已抑制可能造成误报的特征匹配。',high_bit_depth_preview:'高位深图片已用强度映射生成检查预览；原始像素未修改，映射参数保存在 JSON 记录中。',evidence_limit:'因图片较多，部分结果仅提供缩略图；可缩小批次后重新生成证据图。'};
    if(typeof w==='string'){if(keys[w])return t(keys[w]);const parts=w.split(' / ');return parts.length>1?(parts.find(part=>/[\u3400-\u9fff]/.test(part)===(language!=='en'))||parts[language==='en'?1:0]):w;}return w?.[language==='en'?'en':'zh']||w?.message||JSON.stringify(w);
  }
  function reportHTML(record,t=x=>x,language='en'){
    const result=record.result,images=new Map((result.images||[]).map(item=>[item.id,item]));
    const img=(data,alt)=>raster(data)?`<img src="${data.replace(/\s/g,'')}" alt="${escape(alt)}">`:'';
    const cards=(result.matches||[]).map(pair=>{const a=images.get(pair.a)||{},b=images.get(pair.b)||{};return `<article><h2>${escape(a.label||pair.a)} · ${escape(b.label||pair.b)}</h2><p>${escape(t(kindKey(pair.kind)))}</p>${raster(pair.evidence)?img(pair.evidence,t('匹配证据')):`<div class="pair">${img(a.thumbnail,a.label)}${img(b.thumbnail,b.label)}</div>`}<p>${escape(t('{0} 个匹配点 · 特征覆盖 {1}% / {2}%',pair.inliers||0,Math.round((pair.coverageA||0)*100),Math.round((pair.coverageB||0)*100)))}</p></article>`;}).join('');
    return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><title>Figure Studio · ${escape(t('图片查重'))}</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#26364b;background:#f7f9fc;max-width:1100px;margin:40px auto;padding:0 24px}article{background:white;border:1px solid #dce3ed;border-radius:14px;padding:24px;margin:24px 0}h1{font-size:32px}h2{font-size:18px;overflow-wrap:anywhere}img{max-width:100%;max-height:650px;object-fit:contain}.pair{display:flex;gap:12px}.pair img{width:49%}li{overflow-wrap:anywhere}small{color:#69788f}<\/style><\/head><body><h1>Figure Studio · ${escape(t('图片查重'))}</h1><p>${escape(record.createdAt)}</p><p>${escape(t('检查时的图片快照'))}: ${images.size} · ${escape(t('发现 {0} 对需要复核的图片',(result.matches||[]).length))}</p><p>${escape(t('这是辅助筛查，请结合原图与实验记录复核；未检出不等于保证没有重复。'))}</p>${cards}<h2>${escape(t('结果与说明'))}</h2><ul>${(result.warnings||[]).map(w=>`<li>${escape(warningText(w,t,language))}</li>`).join('')}</ul><h2>${escape(t('图片清单'))}</h2><ol>${[...images.values()].map(item=>`<li>${escape(item.label)} · ${Number(item.width)||0} × ${Number(item.height)||0}<br><small>SHA-256: ${escape(item.sha256||'')}</small>${(item.warnings||[]).map(w=>`<p>${escape(warningText(w,t,language))}</p>`).join('')}</li>`).join('')}</ol><\/body><\/html>`;
  }
  function kindKey(kind){return ({exact:'相同图像',transformed:'疑似变换重复',overlap:'疑似局部重叠'})[kind]||'疑似局部重叠';}
  function init(api){
    Object.assign(StudioI18n.en,translations);
    const t=StudioI18n.t,$=id=>document.getElementById(id),button=$('checkImageDuplicates');
    if(!button)return null;
    const dialog=document.createElement('dialog');dialog.id='imageDuplicateDialog';dialog.className='duplicate-dialog';dialog.setAttribute('aria-labelledby','duplicateTitle');
    dialog.innerHTML=`<div class="duplicate-heading"><div><span class="duplicate-kicker">FIGURE STUDIO · IMAGE CHECK</span><h2 id="duplicateTitle" data-duplicate-text="图片查重"></h2><p class="muted" data-duplicate-text="在本机检查，原图保持不变。"></p></div><button id="closeImageDuplicates" data-duplicate-text="关闭"></button></div><div id="duplicateOfflineNote" class="duplicate-note" hidden></div><div class="duplicate-inputs"><label><span data-duplicate-text="检查范围"></span><select id="duplicateScope"><option value="all" data-duplicate-text="当前组图"></option><option value="selected" data-duplicate-text="已选图片或小图"></option><option value="files" data-duplicate-text="仅本地文件"></option></select></label><button id="duplicateAddFiles" data-duplicate-text="添加本地图片"></button><button id="duplicateClearFiles" data-duplicate-text="清空文件" hidden></button><input id="duplicateFiles" type="file" accept="image/png,image/jpeg,image/webp,image/tiff,image/bmp,.tif,.tiff" multiple hidden></div><p class="duplicate-help" data-duplicate-text="只读取图片图层，不把坐标轴或文字当作图片比较。整页图片会作为一张图检查，不自动拆分内部小图。"></p><div id="duplicateFileList" class="duplicate-file-list"></div><p id="duplicateSourceStatus" role="status"></p><p id="duplicateSourceWarnings" class="duplicate-help"></p><div class="duplicate-actions"><button id="duplicateStart" class="primary" data-duplicate-text="开始检查"></button><button id="duplicateCancel" data-duplicate-text="取消检查" hidden></button><progress id="duplicateProgress" max="1" value="0" hidden></progress><span id="duplicateProgressText" role="status" aria-live="polite"></span></div><p id="duplicateSnapshotNote" class="duplicate-note" hidden></p><section id="duplicateResults" aria-live="polite" hidden><div class="duplicate-result-heading"><h3 id="duplicateResultTitle"></h3><div><button id="duplicateExportHTML" data-duplicate-text="导出 HTML 报告"></button><button id="duplicateExportJSON" data-duplicate-text="导出 JSON 记录"></button></div></div><p class="duplicate-help" data-duplicate-text="这是辅助筛查，请结合原图与实验记录复核；未检出不等于保证没有重复。"></p><ul id="duplicateResultWarnings" class="duplicate-help"></ul><div id="duplicateMatches"></div></section>`;
    document.body.append(dialog);
    let files=[],nextFile=1,source=null,active=null,record=null,snapshot=null,refs={},pollTimer=null,reading=false,shownMatches=24;
    const available=()=>!!api.engine?.duplicateEndpoint && api.engine.duplicateEndpoint==='/api/image-duplicates' && location.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(location.hostname);
    const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
    function warnText(w){return warningText(w,t,StudioI18n.language);}
    function localize(){
      button.textContent=t(active?'检查中…':'图片查重');button.title=t('检查图中是否重复使用了图片');
      for(const el of dialog.querySelectorAll('[data-duplicate-text]'))el.textContent=t(el.dataset.duplicateText);
      $('duplicateOfflineNote').textContent=t('打开已安装的 Figure Studio，或由 skill 启动本机编辑器，即可使用图片查重。当前离线页面没有连接检测服务。');
      $('duplicateOfflineNote').hidden=available();refreshSources();if(record&&!active)renderResult();
    }
    function refreshSources(){
      source=$('duplicateScope').value==='files'?{images:[],refs:{},skipped:[]}:api.collect($('duplicateScope').value);
      const images=[...source.images,...files];let problem='';
      if(images.length>LIMIT.images)problem=t('每批最多 60 张图片；请缩小选择范围。');
      else if(images.some(item=>item.data.length>LIMIT.bytes*4/3+150)||images.reduce((n,item)=>n+item.data.length,0)>LIMIT.characters)problem=t('图片数据超过本机检查容量，请减少图片数量或缩小原图。');
      else if(images.length<2)problem=t(images.length?'需要至少两张图片。':$('duplicateScope').value==='selected'?'请先选择图片或小图，或切换到“当前组图”。':$('duplicateScope').value==='files'?'尚未选择本地图片。':'没有找到可检查的图片图层。可添加本地图片；纯矢量图形无需作为图片查重。');
      $('duplicateSourceStatus').textContent=problem||t('{0} 张图片 · {1} 对比较',images.length,images.length*(images.length-1)/2);
      $('duplicateSourceWarnings').textContent=(source.skipped.length?t('跳过 {0} 个隐藏、外链或不支持的图片图层。',source.skipped.length)+' ':'')+(source.images.length?t('检查嵌入的原始图片内容，包括画布上被裁切遮挡的部分。')+' ':'')+(files.length?t('添加的图片只用于查重，不会插入或修改画布。'):'');
      $('duplicateStart').disabled=!!problem||!!active||reading||!available();$('duplicateScope').disabled=!!active||reading;$('duplicateAddFiles').disabled=!!active||reading;$('duplicateClearFiles').hidden=!files.length;$('duplicateClearFiles').disabled=!!active||reading;
      $('duplicateFileList').replaceChildren();for(const file of files){const item=node('span',undefined,'duplicate-file');item.append(node('span',file.label));const remove=node('button','×');remove.type='button';remove.setAttribute('aria-label',t('移除 {0}',file.label));remove.disabled=!!active;remove.onclick=()=>{files=files.filter(f=>f!==file);refreshSources();};item.append(remove);$('duplicateFileList').append(item);}
      return images;
    }
    function setBusy(busy){$('duplicateCancel').hidden=!busy;$('duplicateCancel').disabled=!!active?.cancelRequested;$('duplicateProgress').hidden=!busy;button.textContent=t(busy?'检查中…':'图片查重');refreshSources();}
    async function request(body){
      const response=await api.fetch(api.engine.duplicateEndpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':api.engine.token},body:JSON.stringify(body)});
      let result;try{result=await response.json();}catch{const e=Error(t('检测服务暂不可用，请重新连接本机编辑器。'));e.terminal=true;throw e;}
      if(!response.ok||!result||typeof result!=='object'||Array.isArray(result)){const e=Error(result?.error||t('检测服务暂不可用，请重新连接本机编辑器。'));e.terminal=true;throw e;}return result;
    }
    function error(error){clearTimeout(pollTimer);$('duplicateProgressText').textContent=t('检查未完成：{0}',warnText(error.message||error));active=null;setBusy(false);}
    async function poll(job){
      if(active!==job)return;
      try{if(job.cancelRequested&&!job.cancelSent){await request({action:'cancel',jobId:job.jobId});job.cancelSent=true;}const reply=await request({action:'status',jobId:job.jobId});if(active!==job)return;
        const p=reply.progress||{},key=({images:'正在读取图片',pairs:'正在比较图片',load:'正在读取图片',loading:'正在读取图片',prepare:'正在读取图片',preparing:'正在读取图片',extract:'正在读取图片',compare:'正在比较图片',comparing:'正在比较图片',evidence:'正在生成匹配证据'})[p.stage]||'检查中…';
        $('duplicateProgress').value=p.total?Math.min(1,p.completed/p.total):0;$('duplicateProgressText').textContent=t(key)+(p.total?' '+p.completed+' / '+p.total:'');
        if(reply.status==='complete'){record={format:'figure-studio-image-check-v1',createdAt:new Date().toISOString(),scope:job.scope,sources:job.sources,result:reply.result};snapshot=job.snapshot;refs=job.refs;active=null;setBusy(false);$('duplicateProgressText').textContent=t('检查结束');renderResult();if(dialog.open)$('duplicateResults').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
        else if(reply.status==='cancelled'){active=null;setBusy(false);$('duplicateProgressText').textContent=t('已取消检查。');}
        else if(reply.status==='error'){const e=Error(reply.error||t('检测服务暂不可用，请重新连接本机编辑器。'));e.terminal=true;throw e;}
        else if(reply.status==='running')pollTimer=setTimeout(()=>poll(job),650);
        else {const e=Error(t('检测服务暂不可用，请重新连接本机编辑器。'));e.terminal=true;throw e;}
      }catch(e){if(active!==job)return;if(e.terminal)error(e);else{$('duplicateProgressText').textContent=t('连接暂时中断，正在重试；检查任务和取消请求已保留。');pollTimer=setTimeout(()=>poll(job),1800);}}
    }
    async function start(){
      if(active)return;const images=refreshSources();if($('duplicateStart').disabled)return;
      const job={scope:$('duplicateScope').value,sources:images.map(({id,label})=>({id,label})),snapshot:api.snapshot(),refs:source.refs};active=job;record=null;snapshot=null;refs={};shownMatches=24;setBusy(true);$('duplicateProgressText').textContent=t('正在准备检查…');$('duplicateResults').hidden=true;$('duplicateSnapshotNote').hidden=true;
      try{const reply=await request({action:'start',images});if(active!==job)return;job.jobId=reply.jobId;if(!job.jobId)throw Error(t('检测服务暂不可用，请重新连接本机编辑器。'));poll(job);}catch(e){if(active===job)error(e);}
    }
    function renderResult(){
      if(!record)return;const result=record.result||{},matches=result.matches||[],images=new Map((result.images||[]).map(item=>[item.id,item]));$('duplicateResults').hidden=false;
      $('duplicateSnapshotNote').hidden=!Object.keys(refs).length||api.isSnapshot(snapshot);$('duplicateSnapshotNote').textContent=t('图形在检查后已发生变化；以下结果对应检查时的快照。');
      $('duplicateResultTitle').textContent=t(matches.length?'发现 {0} 对需要复核的图片':'未发现达到检测阈值的重复线索',matches.length);$('duplicateResultWarnings').replaceChildren(...(result.warnings||[]).map(w=>node('li',warnText(w))));$('duplicateMatches').replaceChildren();
      for(const item of images.values())for(const warning of item.warnings||[])$('duplicateResultWarnings').append(node('li',(item.label||item.id)+' — '+warnText(warning)));
      for(const pair of matches.slice(0,shownMatches)){
        const a=images.get(pair.a)||{},b=images.get(pair.b)||{},card=node('article',undefined,'duplicate-match');card.append(node('span',t(kindKey(pair.kind)),'duplicate-match-kind'));const names=node('div',undefined,'duplicate-pair-names');names.append(node('strong',a.label||pair.a),node('strong',b.label||pair.b));card.append(names);
        const evidence=node('div',undefined,'duplicate-evidence');if(raster(pair.evidence)){const img=node('img');img.src=pair.evidence;img.alt=t('匹配证据')+': '+(a.label||pair.a)+' / '+(b.label||pair.b);img.loading='lazy';evidence.append(img);}else for(const item of [a,b]){if(raster(item.thumbnail)){const img=node('img');img.src=item.thumbnail;img.alt=item.label||t('图片');img.loading='lazy';evidence.append(img);}}card.append(evidence);
        if(pair.inliers)card.append(node('p',t('{0} 个匹配点 · 特征覆盖 {1}% / {2}%',pair.inliers,Math.round((pair.coverageA||0)*100),Math.round((pair.coverageB||0)*100)),'duplicate-help'));
        const actions=node('div',undefined,'duplicate-match-actions'),locate=node('button',t('定位这两张图'));locate.disabled=!refs[pair.a]&&!refs[pair.b];if(locate.disabled)locate.title=t('这对图片来自本地文件，不在当前画布内。');locate.onclick=()=>{if(!api.isSnapshot(snapshot)){ $('duplicateSnapshotNote').hidden=false;$('duplicateSnapshotNote').textContent=t('图片已更新，请重新检查后再定位。');return;}const selected=[refs[pair.a],refs[pair.b]].filter(Boolean);if(api.locate(selected)){dialog.close();api.say(t('已定位疑似重复图片；原图未修改。'));}else{$('duplicateSnapshotNote').hidden=false;$('duplicateSnapshotNote').textContent=t('图片已更新，请重新检查后再定位。');}};actions.append(locate);
        if(raster(pair.evidence)){const save=node('button',t('下载证据图'));save.onclick=()=>{const value=pair.evidence.split(',')[1].replace(/\s/g,''),bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0)),mime=pair.evidence.slice(5,pair.evidence.indexOf(';')),extension=mime.split('/')[1].replace('jpeg','jpg');api.download(new Blob([bytes],{type:mime}),'figure-studio-image-match-'+(matches.indexOf(pair)+1)+'.'+extension);};actions.append(save);}card.append(actions);$('duplicateMatches').append(card);
      }
      if(matches.length>shownMatches){const more=node('button',t('继续显示 {0} 对结果',Math.min(24,matches.length-shownMatches)));more.className='duplicate-more';more.onclick=()=>{shownMatches+=24;renderResult();};$('duplicateMatches').append(more);}
    }
    button.onclick=()=>{localize();if(!dialog.open)dialog.showModal();};$('closeImageDuplicates').onclick=()=>dialog.close();$('duplicateScope').onchange=refreshSources;$('duplicateAddFiles').onclick=()=>$('duplicateFiles').click();$('duplicateClearFiles').onclick=()=>{files=[];refreshSources();};$('duplicateStart').onclick=start;
    $('duplicateFiles').onchange=async()=>{reading=true;refreshSources();const problems=[];try{for(const file of $('duplicateFiles').files){if(files.length+source.images.length>=LIMIT.images){problems.push(t('每批最多 60 张图片；请缩小选择范围。'));break;}if(file.size>LIMIT.bytes||!(/\.(?:png|jpe?g|webp|tiff?|bmp)$/i.test(file.name)||/^image\/(?:png|jpe?g|webp|tiff?|bmp)$/i.test(file.type))){problems.push(t('文件过大或不是支持的图片：{0}',file.name));continue;}try{let data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});if(!raster(data)){const ext=file.name.split('.').at(-1).toLowerCase();data=data.replace(/^data:[^;]*;/,'data:image/'+({jpg:'jpeg',tif:'tiff'}[ext]||ext)+';');}if(!raster(data))throw Error('invalid');if(files.reduce((n,item)=>n+item.data.length,0)+source.images.reduce((n,item)=>n+item.data.length,0)+data.length>LIMIT.characters){problems.push(t('图片数据超过本机检查容量，请减少图片数量或缩小原图。'));break;}files.push({id:'file-'+nextFile++,label:file.name.slice(0,200),data});}catch{problems.push(t('读取图片失败：{0}',file.name));}}}finally{reading=false;$('duplicateFiles').value='';refreshSources();if(problems.length)$('duplicateSourceWarnings').textContent=problems.join(' ');}};
    $('duplicateCancel').onclick=()=>{const job=active;if(!job)return;job.cancelRequested=true;$('duplicateCancel').disabled=true;$('duplicateProgressText').textContent=t('取消中…');};
    $('duplicateExportJSON').onclick=()=>{if(record)api.download(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}),'figure-studio-image-check.json');};
    $('duplicateExportHTML').onclick=()=>{if(record)api.download(new Blob([reportHTML(record,t,StudioI18n.language)],{type:'text/html;charset=utf-8'}),'figure-studio-image-check.html');};
    $('language')?.addEventListener('change',localize);localize();return {open:button.onclick,refresh:()=>{if(dialog.open){refreshSources();if(record){$('duplicateSnapshotNote').hidden=!Object.keys(refs).length||api.isSnapshot(snapshot);}}}};
  }
  return {init,collect,reportHTML,raster,LIMIT};
})();
if(typeof module!=='undefined')module.exports=StudioDuplicateCheck;
