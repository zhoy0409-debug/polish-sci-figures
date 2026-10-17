/* Discoverable workflow navigation and local command search; existing controls remain. */
'use strict';
const StudioExperienceTools=(()=>{
  function create(host){
    const doc=host.document||document,en=()=>host.language()==='en',t=(zh,eng)=>en()?eng:zh;
    const actions=[
      {id:'discovery',zh:'数据与智能选图',en:'Data & discovery',terms:'选图 数据 推荐 chart data discover',run:()=>host.discovery()},
      {id:'edit',zh:'编辑图形',en:'Edit artwork',terms:'文字 字体 对齐 edit text font align',run:()=>host.edit()},
      {id:'images',zh:'图片工具',en:'Image tools',terms:'图片 图像 照片 image photo microscopy',run:()=>openImages()},
      {id:'axes',zh:'统计与坐标轴',en:'Statistics & axes',terms:'坐标 横轴 纵轴 范围 长度 尺寸 刻度 间隔 外观 axis range size ticks scale statistics',run:()=>host.axes()},
      {id:'export',zh:'投稿导出',en:'Publication export',terms:'投稿 导出 svg png tif tiff export print',run:()=>host.export()},
      {id:'text-color',zh:'更改所选文字颜色',en:'Change selected text colour',terms:'改字色 字色 文字颜色 text font color colour',run:()=>host.textColor?host.textColor():host.edit()},
      {id:'label-color',zh:'图号改色',en:'Change panel label colour',terms:'图号 字体色 改色 label panel letter font color colour',run:()=>host.labelColor?host.labelColor():host.textColor?.()},
      {id:'typography',zh:'统一组图文字规格',en:'Unify figure typography',terms:'一键统一字号 统一字号 字号规范 typography size font uniform',run:()=>host.typography?host.typography():host.edit()},
      {id:'appearance',zh:'界面主题与画布周边',en:'Interface theme and canvas surround',terms:'外观 深色 浅色 主题 carbon pearl jade theme appearance surround',run:()=>host.appearance?.()},
      {id:'border',zh:'给选中对象加边框',en:'Frame selected objects',terms:'边框 透明框 病理图 形状 border frame outline',run:()=>host.borders()},
      {id:'duplicates',zh:'图片查重',en:'Screen image duplicates',terms:'查重 重复 重叠 图像完整性 duplicate overlap integrity',run:()=>host.duplicates('all')},
      {id:'color',zh:'匹配参考图／图片颜色与显示',en:'Match reference / image display',terms:'颜色 色调 亮度 对比度 参考色 统一图片颜色 colour color reference brightness contrast',run:()=>openImages('color')},
      {id:'links',zh:'关联总览与放大图',en:'Link overview and detail',terms:'定位 局部 放大图 关联 来源 ROI overview detail localization link inset',run:()=>host.links()},
      {id:'inset',zh:'绘制局部放大／比例尺',en:'Create zoom inset / scale bar',terms:'裁剪 放大 比例尺 标定 crop inset scale bar calibration',run:()=>openImages('inset')}
    ];
    const nav=doc.createElement('nav');nav.id='workflowNavigation';nav.className='workflow-navigation';nav.setAttribute('aria-label','Figure Studio workflows');
    doc.querySelector('.workspace')?.before(nav);
    const searchButton=doc.createElement('button');searchButton.id='commandSearch';searchButton.type='button';searchButton.className='command-search-trigger';doc.querySelector('.toolbar')?.append(searchButton);
    const commands=doc.createElement('dialog');commands.id='commandDialog';commands.className='experience-dialog';doc.body.append(commands);
    const images=doc.createElement('dialog');images.id='imageToolsDialog';images.className='experience-dialog image-tools-dialog';doc.body.append(images);
    const group=doc.createElement('div');group.className='quick-tool-group experience-context';group.id='contextImageActions';doc.getElementById('canvasQuickToolbar')?.prepend(group);
    const hint=doc.createElement('button');hint.id='imageScreeningHint';hint.type='button';hint.hidden=true;hint.className='image-screening-hint';hint.onclick=()=>launch(()=>host.duplicates('all'));nav.append(hint);
    function launch(action){try{commands.close();images.close();const result=action();if(result?.catch)result.catch(e=>host.say(e.message));}catch(e){host.say(e.message);}}
    function button(label,run,id){const b=doc.createElement('button');b.type='button';b.textContent=label;if(id)b.id=id;b.onclick=()=>launch(run);return b;}
    function openCommands(){commands.replaceChildren();const h=doc.createElement('h2');h.textContent=t('查找功能','Find a command');const input=doc.createElement('input');input.type='search';input.id='commandQuery';input.placeholder=t('例如：给病理图加边框、纵轴刻度间隔','Try: image border, Y-axis tick interval');input.setAttribute('aria-label',t('搜索功能','Search commands'));const results=doc.createElement('div');results.className='command-results';const paint=()=>{const q=input.value.trim().toLowerCase(),words=q.split(/\s+/);results.replaceChildren();const matches=actions.filter(a=>!q||words.every(w=>(a.zh+' '+a.en+' '+a.terms).toLowerCase().includes(w))||a.terms.split(' ').filter(w=>w.length>1).some(w=>q.includes(w)));for(const a of matches)results.append(button(en()?a.en:a.zh,a.run,'command-'+a.id));if(!matches.length){const p=doc.createElement('p');p.textContent=t('未找到；试试“边框”“查重”“坐标轴”。','No matches; try border, duplicates or axis.');results.append(p);}};input.oninput=paint;commands.append(h,button(t('关闭','Close'),()=>commands.close()),input,results);paint();commands.showModal();input.focus();}
    function openImages(focus){
      images.replaceChildren();const h=doc.createElement('h2');h.textContent=t('图片工具','Image tools');images.append(h,button(t('返回编辑器','Back to editor'),()=>images.close()));
      const sources=host.images(),intro=doc.createElement('p');intro.textContent=t(`当前有 ${sources.length} 张可识别图片。所有工具在本机运行；只有点击“开始检查”才扫描。`,`There are ${sources.length} identifiable images. Tools run locally; screening starts only when you click Start.`);images.append(intro);
      const label=doc.createElement('label');label.textContent=t('目标图片（颜色、局部放大与比例尺）','Target image (display, inset and scale bar)');const select=doc.createElement('select');select.id='imageToolTarget';const empty=doc.createElement('option');empty.value='';empty.textContent=t('请选择图片','Choose an image');select.append(empty);sources.forEach((source,i)=>{const o=doc.createElement('option');o.value=i;o.textContent=source.label||source.name||t(`图片 ${i+1}`,`Image ${i+1}`);select.append(o);});const current=host.selectedImage?.(),index=sources.findIndex(r=>current&&r.panelId===current.panelId&&r.variant===current.variant&&r.key===current.key);if(index>=0)select.value=index;else if(sources.length===1)select.value='0';label.append(select);images.append(label);
      const selectedAction=run=>()=>{if(select.value==='')throw Error(t('请先在上方选择一张图片。','Choose a target image above first.'));host.selectImage(sources[+select.value]);run();};
      const cards=doc.createElement('div');cards.className='image-tool-cards';
      const entries=[
        ['border',t('对象边框','Object borders'),t('独立装饰框；不改原图，不是 ROI。','Independent decorative frame; no source-pixel changes. Not an ROI.'),()=>host.borders(),false],
        ['duplicates',t('图片查重','Screen duplicates'),t('比较不同图片的像素或来源重叠；不检测同一图片内部复制，不判定学术不端。','Compare pixels or overlapping sources across images. No within-image copy detection or misconduct verdict.'),()=>host.duplicates('all'),sources.length<2],
        ['color',t('图片颜色与显示 → 匹配参考图','Image display → Match reference'),t('单图手动显示／明场参考色；荧光保留共同显示参数，不用于替代信号定量。','Manual display / brightfield reference colour. Fluorescence uses shared display parameters, not signal normalization.'),selectedAction(()=>host.color()),!sources.length],
        ['links',t('关联总览与放大图','Link overview and detail'),t('仅尝试同源或重叠视野；预览原图坐标，无法定位时不猜框。','For shared or overlapping fields only. Review source coordinates; no guessed ROI after failure.'),()=>host.links(),sources.length<2],
        ['inset',t('绘制局部放大／比例尺','Create inset / scale bar'),t('在当前图内选 ROI。物理比例尺需要真实采集标定。','Select an ROI in the image. Physical scale bars require acquisition calibration.'),selectedAction(()=>host.inset()),!sources.length]
      ];
      for(const [id,title,description,run,unavailable]of entries){const card=doc.createElement('article'),b=doc.createElement('button');b.type='button';b.id='imageTool-'+id;b.textContent=title;b.onclick=()=>{if(unavailable){const note=card.querySelector('[role="status"]');note.textContent=id==='duplicates'||id==='links'?t('请先导入至少两张独立图片；查重也可从原入口添加本机文件或体验示例。','Import at least two images first. Duplicate screening also accepts local files or its built-in example.'):t('请先导入图片。','Import an image first.');if(id==='duplicates')launch(()=>host.duplicates('files'));return;}if((id==='color'||id==='inset')&&select.value===''){const note=card.querySelector('[role="status"]');note.textContent=t('请先选择目标图片。','Choose a target image first.');select.focus();return;}launch(run);};const p=doc.createElement('p');p.textContent=description;const status=doc.createElement('p');status.setAttribute('role','status');card.append(b,p,status);cards.append(card);}images.append(cards);
      const disclosure=doc.createElement('details');disclosure.open=false;const summary=doc.createElement('summary');summary.textContent=t('检查状态与限制','Screening state and limits');const status=host.duplicateStatus?.(),note=doc.createElement('p');const states={idle:t('未启动','Not started'),running:t('检查中','Running'),review:t('需人工复核','Needs review'),complete:t('已完成','Complete'),unavailable:t('不能检查','Unavailable')};note.textContent=(states[status?.state]||states.idle)+' · '+t('未检查不等于通过；压平组图计一张图。','Not checked does not mean passed. A flattened montage counts as one image.');disclosure.append(summary,note);images.append(disclosure);images.showModal();if(focus)doc.getElementById('imageTool-'+focus)?.focus();
    }
    function refresh(){
      for(const a of actions.slice(0,5)){let b=nav.querySelector('[data-workflow="'+a.id+'"]');if(!b){b=button('',a.run);b.dataset.workflow=a.id;nav.append(b);}b.textContent=en()?a.en:a.zh;}
      searchButton.textContent=t('查找功能 ⌘ / Ctrl K','Find command ⌘ / Ctrl K');searchButton.onclick=openCommands;group.replaceChildren();
      for(const [id,zh,eng]of [['openObjectBorder','对象边框','Object borders'],['openImageTools','图片工具','Image tools']]){const b=doc.getElementById(id);if(b)b.textContent=t(zh,eng);}
      const count=doc.querySelectorAll('#artboard svg image[data-key]').length;hint.hidden=count<2;hint.textContent=t('已导入多张图片 · 可手动查重','Multiple images · Screen duplicates');hint.title=t('点击后先确认检查范围，不会自动扫描。','Review the scope before starting; no automatic scan.');nav.append(hint);
      const context=host.context?.()||{};if(context.selected){group.append(button(t('边框','Borders'),()=>host.borders(),'quickObjectBorder'));if(context.image){group.append(button(t('颜色与显示','Image display'),()=>host.color(),'quickImageDisplay'),button(t('图片查重','Duplicates'),()=>host.duplicates('selected'),'quickImageDuplicates'),button(t('关联放大图','Link detail'),()=>host.links(),'quickImageLinks'));}}
    }
    doc.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!doc.querySelector('dialog[open]')){event.preventDefault();openCommands();}});
    refresh();return {refresh,openImages,openCommands,actions,nav};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioExperienceTools;
