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
    '检查预览已达到容量上限，部分图片详情使用缩略图；可缩小批次重新检查。':'The review-preview limit was reached. Some detail views use thumbnails; recheck a smaller batch for larger previews.',
    '查看上次结果':'View last results','已定位疑似重复图片；原图未修改。':'Located the candidate images; originals are unchanged.',
    '查看详情':'View details','复核状态':'Review status','待复核':'Pending review','合理复用':'Legitimate reuse','需要替换':'Needs replacement',
    '复核备注':'Review note','记录复核依据或需要处理的事项':'Record the reason for your decision or the next action',
    '已记录':'Recorded','定位画布中的图片':'Locate canvas image',
    '这对图片中的原图已更换或移除，请重新检查后再定位。已保存的证据仍可查看。':'A source image in this pair was changed or removed. Recheck before locating it; saved evidence remains available.',
    '部分原图已更换或移除；以下是已保存的检查结果，仍可查看证据和记录复核。':'Some source images were changed or removed. These saved results remain available for evidence review and notes.',
    '详情查看器暂不可用，请重新打开编辑器。':'The detail viewer is unavailable. Reopen the editor.',
    '查重复核记录无效':'Invalid image review record','查重复核记录已随工程保存。':'Image review saved with the project.',
    '复核记录未能保存：{0}':'Could not save review record: {0}',
    '选择需要检查的图片':'Select images to check','已选 {0} / {1} 张':'{0} of {1} images selected',
    '全选':'Select all','取消全选':'Deselect all','包含 {0}':'Include {0}',
    '工程已切换，本次检查已停止；原工程已有的结果保持不变。':'Project changed. This check was stopped; the previous project’s saved results are unchanged.'
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
  const pairKey = pair => JSON.stringify([pair.a,pair.b].sort());
  const statusKey = status => ({pending:'待复核',legitimate:'合理复用',replace:'需要替换'})[status]||'待复核';
  function reviewFor(record,pair){const value=record.reviews?.[pairKey(pair)]||{};return {status:['pending','legitimate','replace'].includes(value.status)?value.status:'pending',note:typeof value.note==='string'?value.note.slice(0,2000):'',updatedAt:value.updatedAt||''};}
  // Reports contain evidence previews, never the original image payloads stored in a project.
  function exportRecord(record){
    const refs=Object.fromEntries(Object.entries(record.refs||{}).map(([id,ref])=>[id,{panelId:ref.panelId,vi:ref.vi,key:ref.key,sourceId:ref.sourceId||id}]));
    return {format:record.format,projectId:record.projectId,createdAt:record.createdAt,updatedAt:record.updatedAt,scope:record.scope,sources:(record.sources||[]).map(({id,label})=>({id,label})),refs,reviews:record.reviews||{},result:record.result};
  }
  function warningText(w,t=x=>x,language='en'){
    const keys={low_information:'图片细节不足，仅可靠检查完全相同的内容。',few_distinctive_features:'可区分的特征较少，变换或局部重复可能无法检出。',repetitive_texture:'重复纹理较多，已抑制可能造成误报的特征匹配。',high_bit_depth_preview:'高位深图片已用强度映射生成检查预览；原始像素未修改，映射参数保存在 JSON 记录中。',evidence_limit:'因图片较多，部分结果仅提供缩略图；可缩小批次后重新生成证据图。',review_preview_limit:'检查预览已达到容量上限，部分图片详情使用缩略图；可缩小批次重新检查。'};
    if(typeof w==='string'){if(keys[w])return t(keys[w]);const parts=w.split(' / ');return parts.length>1?(parts.find(part=>/[\u3400-\u9fff]/.test(part)===(language!=='en'))||parts[language==='en'?1:0]):w;}return w?.[language==='en'?'en':'zh']||w?.message||JSON.stringify(w);
  }
  function reportHTML(record,t=x=>x,language='en'){
    const result=record.result,images=new Map((result.images||[]).map(item=>[item.id,item])),anchors=new Map([...images.keys()].map((id,index)=>[id,'image-'+(index+1)]));
    const img=(data,alt)=>raster(data)?`<img src="${data.replace(/\s/g,'')}" alt="${escape(alt)}">`:'';
    // Evidence can be omitted in large batches. Link to one inventory thumbnail per source,
    // rather than embedding that thumbnail again for every one of its matching pairs.
    const sourceLink=(id,item)=>`<a href="#${anchors.get(id)||'images'}">${escape(item.label||id)}</a>`;
    const cards=(result.matches||[]).map(pair=>{const a=images.get(pair.a)||{},b=images.get(pair.b)||{},review=reviewFor(record,pair);return `<article><h2>${escape(a.label||pair.a)} · ${escape(b.label||pair.b)}</h2><p>${escape(t(kindKey(pair.kind)))}</p>${raster(pair.evidence)?img(pair.evidence,t('匹配证据')):`<p>${escape(t('图片清单'))}: ${sourceLink(pair.a,a)} · ${sourceLink(pair.b,b)}</p>`}<p>${escape(t('{0} 个匹配点 · 特征覆盖 {1}% / {2}%',pair.inliers||0,Math.round((pair.coverageA||0)*100),Math.round((pair.coverageB||0)*100)))}</p><p><strong>${escape(t('复核状态'))}:</strong> ${escape(t(statusKey(review.status)))}</p>${review.note?`<p style="white-space:pre-wrap;overflow-wrap:anywhere"><strong>${escape(t('复核备注'))}:</strong> ${escape(review.note)}</p>`:''}</article>`;}).join('');
    return `<!doctype html><html lang="${escape(language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><title>Figure Studio · ${escape(t('图片查重'))}</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#26364b;background:#f7f9fc;max-width:1100px;margin:40px auto;padding:0 24px}article{background:white;border:1px solid #dce3ed;border-radius:14px;padding:24px;margin:24px 0}h1{font-size:32px}h2{font-size:18px;overflow-wrap:anywhere}img{max-width:100%;max-height:650px;object-fit:contain}.pair{display:flex;gap:12px}.pair img{width:49%}li{overflow-wrap:anywhere}small{color:#69788f}<\/style><\/head><body><h1>Figure Studio · ${escape(t('图片查重'))}</h1><p>${escape(record.createdAt)}</p><p>${escape(t('检查时的图片快照'))}: ${images.size} · ${escape(t('发现 {0} 对需要复核的图片',(result.matches||[]).length))}</p><p>${escape(t('这是辅助筛查，请结合原图与实验记录复核；未检出不等于保证没有重复。'))}</p>${cards}<h2>${escape(t('结果与说明'))}</h2><ul>${(result.warnings||[]).map(w=>`<li>${escape(warningText(w,t,language))}</li>`).join('')}</ul><h2 id="images">${escape(t('图片清单'))}</h2><ol>${[...images.values()].map(item=>`<li id="${anchors.get(item.id)}">${img(item.thumbnail,item.label)}<br>${escape(item.label)} · ${Number(item.width)||0} × ${Number(item.height)||0}<br><small>SHA-256: ${escape(item.sha256||'')}</small>${(item.warnings||[]).map(w=>`<p>${escape(warningText(w,t,language))}</p>`).join('')}</li>`).join('')}</ol><\/body><\/html>`;
  }
  function kindKey(kind){return ({exact:'相同图像',transformed:'疑似变换重复',overlap:'疑似局部重叠'})[kind]||'疑似局部重叠';}
  function init(api){
    Object.assign(StudioI18n.en,translations);
    const t=StudioI18n.t,$=id=>document.getElementById(id),button=$('checkImageDuplicates');
    if(!button)return null;
    const dialog=document.createElement('dialog');dialog.id='imageDuplicateDialog';dialog.className='duplicate-dialog';dialog.setAttribute('aria-labelledby','duplicateTitle');
    dialog.innerHTML=`<div class="duplicate-heading"><div><span class="duplicate-kicker">FIGURE STUDIO · IMAGE CHECK</span><h2 id="duplicateTitle" data-duplicate-text="图片查重"></h2><p class="muted" data-duplicate-text="在本机检查，原图保持不变。"></p></div><button id="closeImageDuplicates" data-duplicate-text="关闭"></button></div><div id="duplicateOfflineNote" class="duplicate-note" hidden></div><div class="duplicate-inputs"><label><span data-duplicate-text="检查范围"></span><select id="duplicateScope"><option value="all" data-duplicate-text="当前组图"></option><option value="selected" data-duplicate-text="已选图片或小图"></option><option value="files" data-duplicate-text="仅本地文件"></option></select></label><button id="duplicateAddFiles" data-duplicate-text="添加本地图片"></button><button id="duplicateClearFiles" data-duplicate-text="清空文件" hidden></button><input id="duplicateFiles" type="file" accept="image/png,image/jpeg,image/webp,image/tiff,image/bmp,.tif,.tiff" multiple hidden></div><p class="duplicate-help" data-duplicate-text="只读取图片图层，不把坐标轴或文字当作图片比较。整页图片会作为一张图检查，不自动拆分内部小图。"></p><div id="duplicateFileList" class="duplicate-file-list"></div><p id="duplicateSourceStatus" role="status"></p><p id="duplicateSourceWarnings" class="duplicate-help"></p><div class="duplicate-actions"><button id="duplicateStart" class="primary" data-duplicate-text="开始检查"></button><button id="duplicateCancel" data-duplicate-text="取消检查" hidden></button><progress id="duplicateProgress" max="1" value="0" hidden></progress><span id="duplicateProgressText" role="status" aria-live="polite"></span></div><p id="duplicateSnapshotNote" class="duplicate-note" hidden></p><section id="duplicateResults" aria-live="polite" hidden><div class="duplicate-result-heading"><h3 id="duplicateResultTitle"></h3><div><button id="duplicateExportHTML" data-duplicate-text="导出 HTML 报告"></button><button id="duplicateExportJSON" data-duplicate-text="导出 JSON 记录"></button></div></div><p class="duplicate-help" data-duplicate-text="这是辅助筛查，请结合原图与实验记录复核；未检出不等于保证没有重复。"></p><ul id="duplicateResultWarnings" class="duplicate-help"></ul><div id="duplicateMatches"></div></section>`;
    document.body.append(dialog);
    let files=[],nextFile=1,source=null,active=null,record=null,snapshot=null,pollTimer=null,reading=false,shownMatches=24,readGeneration=0,detailViewer=null;
    let project=api.projectId?.()??null,savedRecord=null;
    const excluded=new Set();
    const available=()=>!!api.engine?.duplicateEndpoint && api.engine.duplicateEndpoint==='/api/image-duplicates' && location.protocol==='http:' && ['127.0.0.1','localhost','[::1]'].includes(location.hostname);
    const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el;};
    const currentProject=()=>api.projectId?.()??null;
    function warnText(w){return warningText(w,t,StudioI18n.language);}
    function closeDetails(){detailViewer?.close();detailViewer=null;}
    function cancelDetached(job){if(job?.jobId)request({action:'cancel',jobId:job.jobId}).catch(()=>{});}
    function syncProject(){
      const nextProject=currentProject(),changed=nextProject!==project;
      if(changed){
        closeDetails();
        const oldJob=active;active=null;clearTimeout(pollTimer);cancelDetached(oldJob);
        project=nextProject;files=[];excluded.clear();reading=false;readGeneration++;snapshot=null;shownMatches=24;record=null;savedRecord=null;
        $('duplicateProgressText').textContent=oldJob?t('工程已切换，本次检查已停止；原工程已有的结果保持不变。'):'';
        $('duplicateCancel').hidden=true;$('duplicateProgress').hidden=true;
      }
      const saved=api.getReviewRecord?.()||null;
      const reload=!!api.getReviewRecord&&!active&&(changed||saved!==savedRecord);
      if(reload){closeDetails();savedRecord=saved;record=saved&&saved.projectId===project?saved:null;snapshot=null;shownMatches=24;}
      if(changed||reload){$('duplicateResults').hidden=!record;$('duplicateSnapshotNote').hidden=true;}
      return changed||reload;
    }
    function persist(next){
      if(next.projectId!==currentProject())return false;
      record=next;savedRecord=next;
      try{if(api.saveReviewRecord?.(next)===false)throw Error(t('查重复核记录无效'));return true;}
      catch(error){$('duplicateProgressText').textContent=t('复核记录未能保存：{0}',warnText(error.message||error));return false;}
    }
    function localize(){
      syncProject();button.textContent=t(active?'检查中…':'图片查重');button.title=t('检查图中是否重复使用了图片');
      for(const el of dialog.querySelectorAll('[data-duplicate-text]'))el.textContent=t(el.dataset.duplicateText);
      $('duplicateOfflineNote').textContent=t('打开已安装的 Figure Studio，或由 skill 启动本机编辑器，即可使用图片查重。当前离线页面没有连接检测服务。');
      $('duplicateOfflineNote').hidden=available();refreshSources();if(record&&!active)renderResult();else $('duplicateResults').hidden=true;
    }
    function refreshSources(){
      source=$('duplicateScope').value==='files'?{images:[],refs:{},skipped:[]}:api.collect($('duplicateScope').value);
      const all=[...source.images,...files],images=all.filter(item=>!excluded.has(item.id));let problem='';
      if(images.length>LIMIT.images)problem=t('每批最多 60 张图片；请缩小选择范围。');
      else if(images.some(item=>item.data.length>LIMIT.bytes*4/3+150)||images.reduce((n,item)=>n+item.data.length,0)>LIMIT.characters)problem=t('图片数据超过本机检查容量，请减少图片数量或缩小原图。');
      else if(images.length<2)problem=t(all.length?'需要至少两张图片。':$('duplicateScope').value==='selected'?'请先选择图片或小图，或切换到“当前组图”。':$('duplicateScope').value==='files'?'尚未选择本地图片。':'没有找到可检查的图片图层。可添加本地图片；纯矢量图形无需作为图片查重。');
      $('duplicateSourceStatus').textContent=(all.length?t('已选 {0} / {1} 张',images.length,all.length)+' · ':'')+(problem||t('{0} 张图片 · {1} 对比较',images.length,images.length*(images.length-1)/2));
      $('duplicateSourceWarnings').textContent=(source.skipped.length?t('跳过 {0} 个隐藏、外链或不支持的图片图层。',source.skipped.length)+' ':'')+(source.images.length?t('检查嵌入的原始图片内容，包括画布上被裁切遮挡的部分。')+' ':'')+(files.length?t('添加的图片只用于查重，不会插入或修改画布。'):'');
      $('duplicateStart').disabled=!!problem||!!active||reading||!available();$('duplicateScope').disabled=!!active||reading;$('duplicateAddFiles').disabled=!!active||reading;$('duplicateClearFiles').hidden=!files.length;$('duplicateClearFiles').disabled=!!active||reading;
      const list=$('duplicateFileList');list.replaceChildren();
      if(all.length){
        const heading=node('div',undefined,'duplicate-source-heading');heading.append(node('span',t('选择需要检查的图片')));
        const toggle=node('button',t(images.length===all.length?'取消全选':'全选'));toggle.type='button';toggle.disabled=!!active||reading;toggle.onclick=()=>{if(images.length===all.length)all.forEach(item=>excluded.add(item.id));else excluded.clear();refreshSources();};heading.append(toggle);list.append(heading);
        const grid=node('div',undefined,'duplicate-source-list');
        for(const image of all){
          const item=node('div',undefined,'duplicate-source-item'),label=node('label'),checkbox=node('input');checkbox.type='checkbox';checkbox.checked=!excluded.has(image.id);checkbox.disabled=!!active||reading;checkbox.setAttribute('aria-label',t('包含 {0}',image.label));
          checkbox.onchange=()=>{if(checkbox.checked)excluded.delete(image.id);else excluded.add(image.id);refreshSources();};label.append(checkbox);
          const prior=(record?.sources||[]).find(item=>item.id===image.id&&item.data===image.data),preview=prior?(record.result?.images||[]).find(item=>item.id===prior.id)?.thumbnail:null;
          if(raster(preview)){const thumbnail=node('img',undefined,'duplicate-source-thumbnail');thumbnail.src=preview;thumbnail.alt='';thumbnail.loading='lazy';label.append(thumbnail);}else label.append(node('span',(image.data.match(/^data:image\/([^;]+)/i)?.[1]||'IMG').toUpperCase(),'duplicate-source-thumbnail'));
          label.append(node('span',image.label));item.append(label);
          if(files.includes(image)){const remove=node('button','×');remove.type='button';remove.setAttribute('aria-label',t('移除 {0}',image.label));remove.disabled=!!active||reading;remove.onclick=()=>{files=files.filter(file=>file!==image);excluded.delete(image.id);refreshSources();};item.append(remove);}grid.append(item);
        }
        list.append(grid);
      }
      return images;
    }
    function setBusy(busy){$('duplicateCancel').hidden=!busy;$('duplicateCancel').disabled=!!active?.cancelRequested;$('duplicateProgress').hidden=!busy;button.textContent=t(busy?'检查中…':'图片查重');refreshSources();}
    async function request(body){
      const response=await api.fetch(api.engine.duplicateEndpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':api.engine.token},body:JSON.stringify(body)});
      let result;try{result=await response.json();}catch{const error=Error(t('检测服务暂不可用，请重新连接本机编辑器。'));error.terminal=true;throw error;}
      if(!response.ok||!result||typeof result!=='object'||Array.isArray(result)){const error=Error(result?.error||t('检测服务暂不可用，请重新连接本机编辑器。'));error.terminal=true;throw error;}return result;
    }
    function restoreResults(){if(record)renderResult();else $('duplicateResults').hidden=true;}
    function error(error){clearTimeout(pollTimer);$('duplicateProgressText').textContent=t('检查未完成：{0}',warnText(error.message||error));active=null;setBusy(false);restoreResults();}
    function isCurrent(job){if(currentProject()!==project){syncProject();setBusy(false);restoreResults();}return active===job&&job.projectId===project;}
    async function poll(job){
      if(!isCurrent(job))return;
      try{
        if(job.cancelRequested&&!job.cancelSent){await request({action:'cancel',jobId:job.jobId});job.cancelSent=true;if(!isCurrent(job))return;}
        const reply=await request({action:'status',jobId:job.jobId});if(!isCurrent(job))return;
        const progress=reply.progress||{},key=({images:'正在读取图片',pairs:'正在比较图片',load:'正在读取图片',loading:'正在读取图片',prepare:'正在读取图片',preparing:'正在读取图片',extract:'正在读取图片',compare:'正在比较图片',comparing:'正在比较图片',evidence:'正在生成匹配证据'})[progress.stage]||'检查中…';
        $('duplicateProgress').value=progress.total?Math.min(1,progress.completed/progress.total):0;$('duplicateProgressText').textContent=t(key)+(progress.total?' '+progress.completed+' / '+progress.total:'');
        if(reply.status==='complete'){
          if(!reply.result||!Array.isArray(reply.result.images)||!Array.isArray(reply.result.matches)){const invalid=Error(t('检测服务暂不可用，请重新连接本机编辑器。'));invalid.terminal=true;throw invalid;}
          // Cancellation never replaces a completed report, even if the server finished just before it arrived.
          if(job.cancelRequested){active=null;setBusy(false);$('duplicateProgressText').textContent=t('已取消检查。');restoreResults();return;}
          const now=new Date().toISOString(),next={format:'figure-studio-image-check-v2',projectId:job.projectId,createdAt:now,updatedAt:now,scope:job.scope,sources:job.sources,refs:job.refs,reviews:{},result:reply.result};
          snapshot=job.snapshot;active=null;$('duplicateProgressText').textContent=t('检查结束');persist(next);setBusy(false);renderResult();
          if(dialog.open)$('duplicateResults').scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
        }else if(reply.status==='cancelled'){active=null;setBusy(false);$('duplicateProgressText').textContent=t('已取消检查。');restoreResults();}
        else if(reply.status==='error'){const failure=Error(reply.error||t('检测服务暂不可用，请重新连接本机编辑器。'));failure.terminal=true;throw failure;}
        else if(reply.status==='running')pollTimer=setTimeout(()=>poll(job),650);
        else {const invalid=Error(t('检测服务暂不可用，请重新连接本机编辑器。'));invalid.terminal=true;throw invalid;}
      }catch(failure){if(!isCurrent(job))return;if(failure.terminal)error(failure);else{$('duplicateProgressText').textContent=t('连接暂时中断，正在重试；检查任务和取消请求已保留。');pollTimer=setTimeout(()=>poll(job),1800);}}
    }
    async function start(){
      syncProject();if(active)return;const images=refreshSources();if($('duplicateStart').disabled)return;
      const ids=new Set(images.map(image=>image.id)),refs=Object.fromEntries(Object.entries(source.refs).filter(([id])=>ids.has(id)).map(([id,ref])=>[id,{panelId:ref.panelId,vi:ref.vi,key:ref.key,sourceId:id}]));
      const job={projectId:project,scope:$('duplicateScope').value,sources:images.map(({id,label,data})=>({id,label,data})),snapshot:api.snapshot?.(),refs};
      active=job;shownMatches=24;setBusy(true);$('duplicateProgressText').textContent=t('正在准备检查…');$('duplicateResults').hidden=true;$('duplicateSnapshotNote').hidden=true;
      try{const reply=await request({action:'start',images});job.jobId=reply.jobId;if(!isCurrent(job)){cancelDetached(job);return;}if(!job.jobId)throw Error(t('检测服务暂不可用，请重新连接本机编辑器。'));poll(job);}catch(failure){if(isCurrent(job))error(failure);}
    }
    function sourceRefs(ids){
      const originals=new Map((record?.sources||[]).map(image=>[image.id,image]));
      return ids.map(id=>record?.refs?.[id]).filter(Boolean).map(ref=>({...ref,data:originals.get(ref.sourceId)?.data}));
    }
    function resolve(ids){
      const refs=sourceRefs(ids);if(!refs.length)return [];
      if(record?.projectId!==currentProject())return null;
      try{if(api.resolveRefs){const resolved=api.resolveRefs(refs);return Array.isArray(resolved)&&resolved.length===refs.length?resolved:null;}return api.isSnapshot?.(snapshot)?refs:null;}catch{return null;}
    }
    function updateSnapshotNote(){
      const changed=record&&resolve(Object.keys(record.refs||{}))===null;
      $('duplicateSnapshotNote').hidden=!changed;$('duplicateSnapshotNote').textContent=t('部分原图已更换或移除；以下是已保存的检查结果，仍可查看证据和记录复核。');
    }
    function renderResult(){
      if(!record||active)return;
      const renderedRecord=record,result=record.result||{},matches=result.matches||[],images=new Map((result.images||[]).map(item=>[item.id,item]));$('duplicateResults').hidden=false;updateSnapshotNote();
      $('duplicateResultTitle').textContent=t(matches.length?'发现 {0} 对需要复核的图片':'未发现达到检测阈值的重复线索',matches.length);$('duplicateResultWarnings').replaceChildren(...(result.warnings||[]).map(w=>node('li',warnText(w))));$('duplicateMatches').replaceChildren();
      for(const item of images.values())for(const warning of item.warnings||[])$('duplicateResultWarnings').append(node('li',(item.label||item.id)+' — '+warnText(warning)));
      for(const pair of matches.slice(0,shownMatches)){
        const a=images.get(pair.a)||{},b=images.get(pair.b)||{},card=node('article',undefined,'duplicate-match');card.append(node('span',t(kindKey(pair.kind)),'duplicate-match-kind'));const names=node('div',undefined,'duplicate-pair-names');names.append(node('strong',a.label||pair.a),node('strong',b.label||pair.b));card.append(names);
        const validCard=()=>record?.result===renderedRecord.result&&record?.projectId===currentProject();
        const details=()=>{if(!validCard()){localize();return;}if(typeof StudioDuplicateViewer==='undefined'){api.say(t('详情查看器暂不可用，请重新打开编辑器。'));return;}closeDetails();const originals=new Map((record.sources||[]).map(item=>[item.id,item.data]));detailViewer=StudioDuplicateViewer.open({pair,a,b,sourceA:originals.get(pair.a),sourceB:originals.get(pair.b),t,onClose:()=>{detailViewer=null;}});};
        const evidence=node('button',undefined,'duplicate-evidence duplicate-evidence-button');evidence.type='button';evidence.setAttribute('aria-label',t('查看详情')+': '+(a.label||pair.a)+' / '+(b.label||pair.b));evidence.onclick=details;
        if(raster(pair.evidence)){const img=node('img');img.src=pair.evidence;img.alt=t('匹配证据')+': '+(a.label||pair.a)+' / '+(b.label||pair.b);img.loading='lazy';evidence.append(img);}else for(const item of [a,b]){if(raster(item.thumbnail)){const img=node('img');img.src=item.thumbnail;img.alt=item.label||t('图片');img.loading='lazy';evidence.append(img);}}card.append(evidence);
        if(pair.inliers)card.append(node('p',t('{0} 个匹配点 · 特征覆盖 {1}% / {2}%',pair.inliers,Math.round((pair.coverageA||0)*100),Math.round((pair.coverageB||0)*100)),'duplicate-help'));
        const actions=node('div',undefined,'duplicate-match-actions'),pairRefs=sourceRefs([pair.a,pair.b]),locate=node('button',t(pairRefs.length===1?'定位画布中的图片':'定位这两张图'));locate.disabled=!pairRefs.length;
        if(locate.disabled)locate.title=t('这对图片来自本地文件，不在当前画布内。');
        locate.onclick=()=>{if(!validCard()){localize();return;}const selected=resolve([pair.a,pair.b]);if(selected?.length&&api.locate(selected)){dialog.close();api.say(t('已定位疑似重复图片；原图未修改。'));}else{$('duplicateSnapshotNote').hidden=false;$('duplicateSnapshotNote').textContent=t('这对图片中的原图已更换或移除，请重新检查后再定位。已保存的证据仍可查看。');}};actions.append(locate);
        const detail=node('button',t('查看详情'));detail.onclick=details;actions.append(detail);
        if(raster(pair.evidence)){const save=node('button',t('下载证据图'));save.onclick=()=>{const value=pair.evidence.split(',')[1].replace(/\s/g,''),bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0)),mime=pair.evidence.slice(5,pair.evidence.indexOf(';')),extension=mime.split('/')[1].replace('jpeg','jpg');api.download(new Blob([bytes],{type:mime}),'figure-studio-image-match-'+(matches.indexOf(pair)+1)+'.'+extension);};actions.append(save);}card.append(actions);
        const review=reviewFor(record,pair),controls=node('div',undefined,'duplicate-review-controls'),statusLabel=node('label',t('复核状态')),status=node('select');
        for(const value of ['pending','legitimate','replace']){const option=node('option',t(statusKey(value)));option.value=value;status.append(option);}status.value=review.status;statusLabel.append(status);
        const noteLabel=node('label',t('复核备注')),note=node('textarea',undefined,'duplicate-review-note');note.value=review.note;note.maxLength=2000;note.rows=2;note.placeholder=t('记录复核依据或需要处理的事项');noteLabel.append(note);
        const recorded=node('span',review.updatedAt?t('已记录'):'','duplicate-review-saved');recorded.setAttribute('role','status');recorded.setAttribute('aria-live','polite');
        const update=()=>{if(!validCard()){localize();return;}const previous=reviewFor(record,pair),nextStatus=['pending','legitimate','replace'].includes(status.value)?status.value:'pending',nextNote=note.value.slice(0,2000);if(nextStatus===previous.status&&nextNote===previous.note)return;const now=new Date().toISOString(),next={...record,updatedAt:now,reviews:{...record.reviews,[pairKey(pair)]:{status:nextStatus,note:nextNote,updatedAt:now}}};recorded.textContent=persist(next)?t('已记录'):'';};
        status.onchange=update;note.oninput=update;controls.append(statusLabel,noteLabel,recorded);card.append(controls);$('duplicateMatches').append(card);
      }
      if(matches.length>shownMatches){const more=node('button',t('继续显示 {0} 对结果',Math.min(24,matches.length-shownMatches)));more.className='duplicate-more';more.onclick=()=>{shownMatches+=24;renderResult();};$('duplicateMatches').append(more);}
    }
    button.onclick=()=>{localize();if(!dialog.open)dialog.showModal();};$('closeImageDuplicates').onclick=()=>{closeDetails();dialog.close();};dialog.addEventListener('close',closeDetails);$('duplicateScope').onchange=()=>{excluded.clear();refreshSources();};$('duplicateAddFiles').onclick=()=>$('duplicateFiles').click();$('duplicateClearFiles').onclick=()=>{for(const file of files)excluded.delete(file.id);files=[];refreshSources();};$('duplicateStart').onclick=start;
    $('duplicateFiles').onchange=async()=>{
      syncProject();const generation=++readGeneration,fileProject=project,chosen=[...$('duplicateFiles').files],problems=[];reading=true;refreshSources();
      try{for(const file of chosen){
        if(generation!==readGeneration||currentProject()!==fileProject)break;
        if(files.length>=LIMIT.images){problems.push(t('每批最多 60 张图片；请缩小选择范围。'));break;}
        if(file.size>LIMIT.bytes||!(/\.(?:png|jpe?g|webp|tiff?|bmp)$/i.test(file.name)||/^image\/(?:png|jpe?g|webp|tiff?|bmp)$/i.test(file.type))){problems.push(t('文件过大或不是支持的图片：{0}',file.name));continue;}
        try{let data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});if(generation!==readGeneration||currentProject()!==fileProject)break;
          if(!raster(data)){const ext=file.name.split('.').at(-1).toLowerCase();data=data.replace(/^data:[^;]*;/,'data:image/'+({jpg:'jpeg',tif:'tiff'}[ext]||ext)+';');}if(!raster(data))throw Error('invalid');
          if(files.reduce((n,item)=>n+item.data.length,0)+data.length>LIMIT.characters){problems.push(t('图片数据超过本机检查容量，请减少图片数量或缩小原图。'));break;}
          files.push({id:'file-'+nextFile++,label:file.name.slice(0,200),data});
        }catch{problems.push(t('读取图片失败：{0}',file.name));}
      }}finally{if(generation===readGeneration){reading=false;$('duplicateFiles').value='';syncProject();refreshSources();if(problems.length)$('duplicateSourceWarnings').textContent=problems.join(' ');}}
    };
    $('duplicateCancel').onclick=()=>{const job=active;if(!job)return;job.cancelRequested=true;$('duplicateCancel').disabled=true;$('duplicateProgressText').textContent=t('取消中…');};
    $('duplicateExportJSON').onclick=()=>{syncProject();if(record)api.download(new Blob([JSON.stringify(exportRecord(record),null,2)],{type:'application/json'}),'figure-studio-image-check.json');};
    $('duplicateExportHTML').onclick=()=>{syncProject();if(record)api.download(new Blob([reportHTML(record,t,StudioI18n.language)],{type:'text/html;charset=utf-8'}),'figure-studio-image-check.html');};
    $('language')?.addEventListener('change',localize);localize();return {open:button.onclick,refresh:()=>{const changed=syncProject();if(dialog.open){refreshSources();if(changed)restoreResults();else if(record&&!active)updateSnapshotNote();}}};
  }
  return {init,collect,reportHTML,exportRecord,pairKey,raster,LIMIT};
})();
if(typeof module!=='undefined')module.exports=StudioDuplicateCheck;
