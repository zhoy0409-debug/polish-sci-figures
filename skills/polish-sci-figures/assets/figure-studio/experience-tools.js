/* Discoverable workflow navigation and local command search; existing controls remain. */
'use strict';
const StudioExperienceTools=(()=>{
  // Rearrange existing controls once. Never clone fields, rebuild a live draft,
  // touch project state, or add canvas reads to the selection hot path.
  function workspaceHierarchy(doc,language){
    if(!doc.defaultView?.matchMedia?.('(min-width: 751px)').matches||!doc.querySelector('.navigator'))return null;
    const labels=[],menus=[],node=id=>doc.getElementById(id);
    const title=(el,zh,en)=>{labels.push([el,zh,en]);return el;};
    function foldSection(section,id,zh,en){
      if(!section)return null;
      const box=doc.createElement('details'),summary=title(doc.createElement('summary'),zh,en);
      box.id=id;box.className='workspace-disclosure';
      for(const attr of section.attributes)if(attr.name!=='id'&&attr.name!=='class')box.setAttribute(attr.name,attr.value);
      section.replaceWith(box);box.append(summary);
      const heading=section.querySelector(':scope > h2');heading?.remove();
      box.append(...section.childNodes);return box;
    }
    const navigator=doc.querySelector('.navigator'),inspector=doc.querySelector('.inspector');
    const help=doc.createElement('details');help.id='workspaceEditingHelp';help.className='workspace-disclosure';help.append(title(doc.createElement('summary'),'操作提示','Editing tips'));
    const notes=[...navigator.children].filter(el=>el.matches('p.muted'));
    if(notes.length){notes[0].before(help);help.append(...notes);}
    foldSection(node('masters')?.closest('section'),'workspaceLayout','排版与间距','Layout & spacing');
    foldSection(node('versions')?.closest('section'),'workspaceVersions','版本与检查点','Versions & checkpoints');
    const text=foldSection(node('typePanel'),'typePanel','文字与字体','Text & fonts');
    const appearance=foldSection(node('elementStroke')?.closest('section'),'workspaceObjectStyle','颜色与线条','Colour & lines');
    foldSection(node('categorySpacingControls'),'categorySpacingControls','图表组间距','Chart group spacing');
    if(text&&node('textRole'))text.querySelector('summary').after(node('textRole').parentElement);
    const rich=node('richTextControls');
    if(rich){const box=doc.createElement('details');box.id='workspaceCharacterFormats';box.className='workspace-disclosure';rich.before(box);box.append(title(doc.createElement('summary'),'文字内容与字符格式','Text content & character formatting'),rich);}
    const secondary=doc.createElement('section');secondary.dataset.pane='detail';secondary.className='workspace-secondary-properties';
    if(text)text.after(secondary);
    for(const id of ['paragraphPanel','objectAlignmentPanel']){const box=node(id);if(box){box.open=false;secondary.append(box);}}
    if(node('componentStyle'))node('componentStyle').open=false;
    // Context/selection and the five existing mode tabs always precede details.
    const tabs=inspector?.querySelector('.inspector-tabs');
    if(tabs){const heading=inspector.querySelector('.inspector-heading');if(heading)inspector.prepend(heading);}
    function menu(id,zh,en,controls,bar){
      if(!bar)return null;
      const box=doc.createElement('details'),summary=title(doc.createElement('summary'),zh,en),content=doc.createElement('div');
      box.id=id;box.className='workspace-tool-disclosure';content.className='workspace-tool-menu';content.setAttribute('role','group');box.append(summary,content);bar.append(box);
      for(const [zh,en,nodes]of controls){const section=doc.createElement('div');section.className='workspace-menu-section';section.append(title(doc.createElement('p'),zh,en));for(const control of nodes)if(control)section.append(control);content.append(section);}
      box.addEventListener('toggle',()=>{if(!box.open)return;for(const other of menus)if(other!==box)other.open=false;const rect=summary.getBoundingClientRect(),width=Math.min(284,doc.defaultView.innerWidth-24);content.style.width=width+'px';content.style.left=Math.max(12,Math.min(rect.left,doc.defaultView.innerWidth-width-12))+'px';content.style.top=Math.min(rect.bottom+6,doc.defaultView.innerHeight-180)+'px';});
      menus.push(box);return box;
    }
    const canvas=doc.querySelector('.canvas-layoutbar'),quick=node('canvasQuickToolbar');
    menu('workspaceCanvasTools','画布工具','Canvas tools',[
      ['整图缩放','Panel scaling',['selectPanelContent','fitPanelContent'].map(node)],
      ['网格与参考线','Grid & guides',['toggleGuides','insertTrackMenu','quickGuideAction'].map(node)]
    ],canvas);
    menu('workspaceSelectionTools','更多工具','More tools',[
      ['对象组织','Object organization',['quickGroup','quickUnlockSelected','unlockAll'].map(node)],
      ['尺寸与比例','Size & proportions',[quick?.querySelector('.quick-resize-group'),...['restoreShape','restoreAllShapes'].map(node)]],
      ['剪贴板','Clipboard',[quick?.querySelector('.quick-clipboard-group')]],
      ['文字与颜色工具','Text & colour tools',[quick?.querySelector('.text-tools')]]
    ],quick);
    doc.addEventListener('pointerdown',event=>{for(const box of menus)if(box.open&&!box.contains(event.target))box.open=false;});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&!event.isComposing&&!event.defaultPrevented)for(const box of menus)if(box.open){box.open=false;box.querySelector('summary').focus();event.preventDefault();break;}});
    doc.defaultView.addEventListener('resize',()=>menus.forEach(box=>{box.open=false;}));
    doc.body.classList.add('workspace-focused');
    let previousLanguage=null;
    function refresh(){const lang=language();if(lang===previousLanguage)return;previousLanguage=lang;for(const [el,zh,en]of labels)el.textContent=lang==='en'?en:zh;}
    function reveal(id){const target=node(id);if(!target)return false;api.onReveal?.(target);const pane=target.closest('[data-pane]')?.dataset.pane;if(pane&&doc.querySelector('[data-tab="'+pane+'"]')?.getAttribute('aria-pressed')!=='true')doc.querySelector('[data-tab="'+pane+'"]')?.click();if(target.localName==='details')target.open=true;for(let p=target.parentElement;p;p=p.parentElement)if(p.localName==='details')p.open=true;target.scrollIntoView({block:'nearest'});(target.localName==='details'?target.querySelector('button,input,select,summary'):target)?.focus();target.classList.add('workspace-found-control');doc.defaultView.setTimeout(()=>target.classList.remove('workspace-found-control'),1400);return true;}
    const shortcuts=doc.createElement('nav');shortcuts.id='workspaceNavigatorTabs';shortcuts.setAttribute('aria-label','Workspace sections');
    for(const [id,zh,en]of [['layerSearch','图层','Layers'],['rows','排版','Layout'],['exportWidth','导出','Export']]){const button=title(doc.createElement('button'),zh,en);button.type='button';button.dataset.workspaceJump=id;button.onclick=()=>reveal(id);shortcuts.append(button);}
    node('projectTitle')?.after(shortcuts);
    const api={refresh,reveal,text,appearance};refresh();return api;
  }
  const guideTopics=[
    {id:'first-figure',title:['从素材到成图','Make your first figure'],steps:[
      ['journey','开始：导入素材','Start: import artwork','导入素材、在画布上修改、运行质检，然后导出。每一步的入口会留在画布上方。','Import artwork, edit it on the canvas, review it, and export. The next action stays above the canvas.']
    ]},
    {id:'projects',title:['打开与保存工程','Open & save a project'],steps:[
      ['open','打开工程','Open project','用保存过的工程继续编辑，恢复图层和撤销记录。','Resume a saved project with its layers and undo history.'],
      ['import','导入已有图件','Import artwork','把现有的 SVG、PDF、图片或流程图导入画布。','Bring an existing SVG, PDF, image or diagram onto the canvas.'],
      ['save','保存工程备份','Save project backup','从备份重开可以继续编辑；投稿图从导出菜单生成。','Reopen this backup to continue editing. Use Export for submission files.']
    ]},
    {id:'data',title:['从数据作图','Make a chart from data'],steps:[
      ['discovery','打开智能选图','Open chart discovery','导入或粘贴数据表，核对变量后再选择图型。','Import or paste a table, then check the variables before choosing a chart.'],
      ['templates','查看可编辑模板','Browse editable templates','也可以先选一个模板，再换成你的数据。','You can also start with a template and replace its sample data.'],
      ['statistics','打开统计分析','Open statistics','生成图形后可核对统计设置、结果与标注。','After plotting, review the analysis settings, results and annotations.']
    ]},
    {id:'labels',title:['组图与图号','Layouts & panel labels'],steps:[
      ['layout','打开排版与间距','Open layout & spacing','先确定小图的行列、尺寸和间距。','Set the rows, columns, sizes and spacing of the panels.'],
      ['align','前往图号对齐','Go to panel-label alignment','先点参照图号 A，再按住 Shift 点 B 和 C。点击“按首选图号统一字号和基线”后预览。','Select reference label A, then Shift-click B and C. Choose Match font size and baseline to preview.']
    ]},
    {id:'images',title:['处理科研图片','Work with scientific images'],steps:[
      ['import','导入原图','Import source images','选用原始图片或已保存的工程，便于核对来源。','Start from source images or a saved project so you can verify provenance.'],
      ['rectify','打开矫正工具','Open straightening tools','选中需要拉直的图，先比较预览，再保留调整。','Choose an image to straighten and compare the preview before keeping it.'],
      ['inset','打开局部放大工具','Open inset tools','选原图和放大区域；添加物理比例尺需要真实标定。','Choose the source image and region. A physical scale bar requires calibration.'],
      ['duplicates','打开图片查重','Open duplicate screening','核对检查范围，开始后逐项复核疑似重复。','Check the screening scope, then review any possible duplicates.']
    ]},
    {id:'ai',title:['让 AI 帮你精修','Refine with AI'],steps:[
      ['handoff','打开局部任务','Open scoped task','先选目标小图或图号，填写要改的内容，然后复制任务到 ChatGPT 或 Claude。','Select a panel or label, describe the edit and copy the task into ChatGPT or Claude.'],
      ['clipboard','前往剪贴板预览','Go to clipboard preview','复制回复后，从剪贴板预览。核对原值和新值，再决定是否保留。','Copy the reply, then preview from the clipboard. Check the before and after values before keeping it.']
    ]},
    {id:'export',title:['质检与投稿导出','Review & export'],steps:[
      ['review','打开图形质检','Open figure review','检查最终尺寸下的文字、线宽和遮挡，按结果定位。','Check text, line widths and overlaps at final size, then locate findings.'],
      ['export-settings','打开导出设置','Open export settings','先设置最终宽度和分辨率，核对图形实际尺寸。','Set the final width and resolution and check the resulting dimensions.'],
      ['export-menu','打开导出选项','Open export options','按投稿要求选择文件格式。保留工程备份，方便之后修改。','Choose the submission format and retain a project backup for later edits.']
    ]}
  ];
  function create(host){
    const doc=host.document||document,en=()=>host.language()==='en',t=(zh,eng)=>en()?eng:zh;
    const hierarchy=workspaceHierarchy(doc,host.language);
    const support=typeof StudioSupport!=='undefined'?StudioSupport.create(host):null;
    const actions=[
      {id:'discovery',zh:'数据与智能选图',en:'Data & discovery',terms:'选图 数据 推荐 chart data discover',run:()=>host.discovery()},
      {id:'edit',zh:'编辑图形',en:'Edit artwork',terms:'文字 字体 对齐 edit text font align',run:()=>host.edit()},
      {id:'images',zh:'图片工具',en:'Image tools',terms:'图片 图像 照片 显微图 荧光 image photo fluorescence microscopy',run:()=>openImages()},
      {id:'axes',zh:'坐标轴设置',en:'Axis settings',terms:'坐标 横轴 纵轴 范围 长度 尺寸 刻度 间隔 外观 axis range size ticks scale',run:()=>host.axes()},
      {id:'export',zh:'投稿导出',en:'Publication export',terms:'投稿 导出 svg png tif tiff export print',run:()=>host.export()},
      {id:'text-color',zh:'更改所选文字颜色',en:'Change selected text colour',terms:'改字色 字色 文字颜色 text font color colour',run:()=>host.textColor?host.textColor():host.edit()},
      {id:'label-color',zh:'图号改色',en:'Change panel label colour',terms:'图号 字体色 改色 label panel letter font color colour',run:()=>host.labelColor?host.labelColor():host.textColor?.()},
      {id:'typography',zh:'统一组图文字规格',en:'Unify figure typography',terms:'一键统一字号 统一字号 字号规范 typography size font uniform',run:()=>host.typography?host.typography():host.edit()},
      {id:'appearance',zh:'界面主题与画布周边',en:'Interface theme and canvas surround',terms:'外观 深色 浅色 主题 carbon pearl jade theme appearance surround',run:()=>host.appearance?.()},
      {id:'border',zh:'给选中对象加边框',en:'Frame selected objects',terms:'边框 透明框 病理图 形状 border frame outline',run:()=>host.borders()},
      {id:'duplicates',zh:'图片查重',en:'Screen image duplicates',terms:'查重 重复 重叠 图像完整性 duplicate overlap integrity',run:()=>host.duplicates('all')},
      {id:'rectify',zh:'一键矫正与微调',en:'Auto straighten & refine',terms:'照片 拍斜 透视 四角 拉正 矫正 裁剪 拉直 标尺 电泳 条带 泳道 WB western blot ruler deskew perspective rectify straighten crop photo corners',run:()=>host.selectedImage?.()?host.rectify?.():openImages('rectify')},
      {id:'color',zh:'匹配参考图／图片颜色与显示',en:'Match reference / image display',terms:'校色 一键校色 调色 颜色 色调 亮度 对比度 参考色 统一图片颜色 colour color reference brightness contrast',run:()=>host.selectedImage?.()?host.color():openImages('color')},
      {id:'links',zh:'关联总览与放大图',en:'Link overview and detail',terms:'定位 局部 放大图 关联 来源 ROI overview detail localization link inset',run:()=>host.links()},
      {id:'inset',zh:'绘制局部放大图',en:'Create a zoom inset',terms:'裁剪 放大 局部 ROI crop inset zoom',run:()=>openImages('inset')}
    ];
    // Resolve the later-mounted tools when invoked; keep the five main workflows.
    if(typeof host.review==='function')actions.push({id:'review',zh:'图形质检与问题定位',en:'Review figure and locate issues',terms:'图形质检 图形检查 最终字号 线宽 figure review quality preflight text size line width',run:()=>host.review()});
    if(typeof host.submissionProfiles==='function')actions.push({id:'submission-profile',zh:'投稿配置与尺寸预检',en:'Submission profiles and size review',terms:'投稿配置 期刊要求 最大高度 配置导入 submission profile requirements maximum height',run:()=>host.submissionProfiles()});
    if(support)actions.push({id:'feedback',zh:'使用反馈',en:'Send feedback',terms:'反馈 建议 不好用 问题 错误 联系作者 feedback problem suggestion bug contact',run:()=>support.openFeedback()},{id:'download-metrics',zh:'下载统计（扣除验收）',en:'Downloads excluding QA',terms:'下载 统计 下载量 验收 download count metrics statistics QA',run:()=>support.openMetrics()});
    if(hierarchy)for(const [id,target,zh,eng,terms]of [
      ['layout','rows','排版、行列与图间距','Layout, grid & spacing','排版 布局 行列 间距 layout grid gap spacing'],
      ['layers','layerSearch','查找图层与对象','Find layers & objects','图层 元素 查找 layer object search'],
      ['checkpoints','versionName','保存版本与检查点','Save a version checkpoint','保存版本 检查点 checkpoint version'],
      ['fonts','font','字体与字号','Fonts & text size','字体 字号 font typography text size'],
      ['paragraph','para-line-height','段落、行距与字距','Paragraph & text spacing','段落 行距 字距 缩进 paragraph spacing indent'],
      ['colour-lines','colorHex','颜色、线宽与透明度','Colour, stroke & opacity','颜色 线宽 透明度 color colour stroke opacity'],
      ['canvas-tools','selectPanelContent','缩放整图与画布工具','Panel scaling & canvas tools','缩放整图 适合格子 网格 辅助线 canvas scaling fit guides'],
      ['group','quickGroup','组合与取消组合','Group & ungroup','组合 取消组合 group ungroup'],
      ['lock','quickLock','锁定与解锁对象','Lock & unlock objects','锁定 解锁 lock unlock'],
      ['clipboard','quickCopy','复制、剪切与粘贴','Copy, cut & paste','复制 剪切 粘贴 copy cut paste clipboard'],
      ['aspect','selectionAspect','缩放比例与还原比例','Resize & restore proportions','缩放 比例 拉伸 还原 aspect resize proportions'],
      ['guides','quickGuideAction','对齐参考线','Alignment guides','参考线 辅助线 guides alignment'],
      ['scale-bar','scaleCalibration','物理比例尺与标定','Physical scale bar & calibration','比例尺 标定 微米 scale bar calibration micron'],
      ['panel-label','panelLabel','面板图号与编号','Panel labels & numbering','图号 编号 标签 panel label numbering'],
      ['annotations','overlayType','插入文字、线条与形状','Insert text, lines & shapes','插入 文字 线条 箭头 矩形 椭圆 annotation insert text line shape'],
      ['statistics','methodConfigureStatistics','统计分析与已有结果','Statistical analysis & existing results','统计 分析 比较 检验 statistical analysis test comparison'],
      ['data-table','pasteData','查看与编辑数据表','View & edit the data table','数据表 编辑 粘贴 data table edit paste'],
      ['open-project','load','打开工程','Open a project','打开 工程 项目 open project'],
      ['save-project','save','保存工程备份','Save a project backup','保存 工程 备份 save project backup'],
      ['history-undo','undo','撤销编辑','Undo an edit','撤销 ctrl z undo'],
      ['history-redo','redo','重做编辑','Redo an edit','重做 ctrl y redo'],
      ['legend-style','componentRole','坐标文字与图例样式','Axis text & legend styling','图例 标题 刻度 文字 legend title tick style'],
      ['category-spacing','categorySpacing','图表组间距','Chart group spacing','组间距 类别 间隔 category group spacing'],
      ['chart-variants','chartGoal','同数据图形与推荐','Same-data chart alternatives','候选 图型 推荐 变体 candidates chart alternatives'],
      ['panel-geometry','sizes','小图方向、比例与跨格','Panel orientation, proportions & span','横版 竖版 跨格 分面 orientation portrait landscape facet span'],
      ['palette','palettes','图表配色方案','Chart colour palettes','换色 一键换色 换配色 改色 配色 色板 互补色 palette scheme complementary'],
      ['marks','markControls','样本点与误差棒','Sample points & error bars','样本点 误差棒 points error bars'],
      ['bars','barGeometry','柱宽与柱间距','Bar width & spacing','柱宽 柱形 间距 bar width gap'],
      ['heatmap','heatmapTools','热图数值与显示','Heatmap values & display','热图 小数 数值 heatmap decimals values'],
      ['stat-annotation','statisticalAnnotations','统计标注与条件表','Statistical annotations & condition table','统计标注 括号 P值 条件表 statistical annotations brackets condition'],
      ['preferences','memoryDetails','本机偏好设置','Local preferences','偏好 记忆 重置 preferences memory reset'],
      ['object-align','objectAlignmentPanel','对象对齐与等距分布','Align & distribute objects','对象对齐 等距 分布 左对齐 水平居中 align distribute objects']
    ])actions.push({id,zh,en:eng,terms,target,run:()=>{if(['fonts','paragraph','colour-lines'].includes(id))host.edit();hierarchy.reveal(target);const control=doc.getElementById(target);if(control?.disabled)host.say(control.title||t('请先在画布选中适用的对象。','Select an applicable object on the canvas first.'));}});
    if(typeof host.westernBlot==='function')actions.push({id:'western-blot',zh:'WB 条带处理与组图',en:'WB processing & composition',terms:'WB western blot 蛋白 条带 剪膜 整膜 曝光 裁切 拉正 marker kDa PPT PowerPoint',run:()=>host.westernBlot()});
    actions.push({id:'usage-guide',zh:'使用向导',en:'Usage guide',terms:'帮助 怎么用 找不到 入门 教程 开始 用法 walkthrough help how to onboarding start',run:()=>openGuide()});
    const categories=[
      ['data','数据与图表','Data & charts'],['style','文字与对象样式','Text & object style'],['image','图片处理','Image processing'],
      ['layout','排版与画布','Layout & canvas'],['annotation','标注与测量','Annotations & measurement'],['export','检查与导出','Review & export'],['project','工程与界面','Project & interface']
    ];
    const categoryIds={data:['discovery','axes','statistics','data-table','category-spacing','chart-variants','marks','bars','heatmap','legend-style'],style:['edit','text-color','label-color','typography','border','fonts','paragraph','colour-lines','palette'],image:['images','rectify','color','western-blot'],layout:['layout','layers','canvas-tools','group','lock','clipboard','aspect','guides','object-align','panel-geometry'],annotation:['links','inset','scale-bar','panel-label','annotations','stat-annotation'],export:['export','review','submission-profile','duplicates'],project:['appearance','checkpoints','open-project','save-project','history-undo','history-redo','feedback','download-metrics','preferences']};
    for(const action of actions)action.category=categories.find(([id])=>categoryIds[id].includes(action.id))?.[0]||'project';
    const nav=doc.createElement('nav');nav.id='workflowNavigation';nav.className='workflow-navigation';nav.setAttribute('aria-label','Figure Studio workflows');
    doc.querySelector('.workspace')?.before(nav);
    const searchButton=doc.createElement('button');searchButton.id='commandSearch';searchButton.type='button';searchButton.className='command-search-trigger';doc.querySelector('.toolbar')?.append(searchButton);
    const help=doc.createElement('details'),helpTitle=doc.createElement('summary'),helpContent=doc.createElement('div');
    help.id='studioHelpMenu';help.className='header-menu';helpTitle.setAttribute('role','button');helpContent.className='header-menu-content';
    const helpGuide=button('',()=>{help.open=false;openGuide();},'openStudioGuide');
    const startGuide=button('',openGuide,'startStudioGuide');
    helpContent.append(helpGuide);help.append(helpTitle,helpContent);doc.querySelector('.toolbar')?.append(help);
    doc.querySelector('.project-start-actions')?.prepend(startGuide);
    let feedbackButton=null,metricsButton=null;
    if(support){
      feedbackButton=button('',()=>{help.open=false;support.openFeedback();},'openStudioFeedback');
      metricsButton=button('',()=>{help.open=false;support.openMetrics();},'openDownloadMetrics');
      helpContent.append(feedbackButton,metricsButton);
    }
    const commands=doc.createElement('dialog');commands.id='commandDialog';commands.className='experience-dialog';doc.body.append(commands);
    const images=doc.createElement('dialog');images.id='imageToolsDialog';images.className='experience-dialog image-tools-dialog';doc.body.append(images);
    const guide=doc.createElement('dialog');guide.id='studioUsageGuide';guide.className='experience-dialog usage-guide';guide.setAttribute('aria-labelledby','studioUsageGuideTitle');doc.body.append(guide);
    let selectedTopic=guideTopics[0].id;
    const journeyBar=doc.createElement('section'),journeyCopy=doc.createElement('div'),journeyTitle=doc.createElement('strong'),journeyHint=doc.createElement('span'),journeyActions=doc.createElement('div');
    journeyBar.id='studioFirstFigure';journeyBar.className='first-figure-guide';journeyBar.hidden=true;
    journeyTitle.setAttribute('role','status');journeyCopy.append(journeyTitle,journeyHint);
    journeyActions.className='first-figure-actions';
    const journeyTool=button('',()=>{
      if(journey.stage==='export')return openExportSettings(true);
      if(journey.kind==='image')return host.color();
      const action=actions.find(item=>item.id==='colour-lines');
      if(action)launch(action);else host.edit();
    });
    const journeyNext=button('',()=>nextInJourney()),journeySkip=button('',pauseJourney);
    journeyNext.className='primary';journeyActions.append(journeyTool,journeyNext,journeySkip);journeyBar.append(journeyCopy,journeyActions);
    doc.getElementById('viewport')?.before(journeyBar);
    const reviewNext=button('',()=>openExportMenu(true));
    const reviewSize=button('',()=>openExportSettings(true));
    const reviewSkip=button('',pauseJourney);
    let journey=null,journeyLanguage=null;
    const group=doc.createElement('div');group.className='quick-tool-group experience-context';group.id='contextImageActions';doc.getElementById('canvasQuickToolbar')?.prepend(group);
    const hint=doc.createElement('button');hint.id='imageScreeningHint';hint.type='button';hint.hidden=true;hint.className='image-screening-hint';hint.onclick=()=>launch(()=>host.duplicates('all'));nav.append(hint);
    const primaryColor=doc.createElement('button');
    primaryColor.id='contextColorAction';
    primaryColor.type='button';
    primaryColor.hidden=true;
    group.before(primaryColor);
    const colorAliases=new Set(['换色','一键换色','改色','校色','一键校色','调色','换配色','recolor','recolour','auto color','auto colour']);
    function colorAction(kind,objectOnly=false){
      const names={photo:['校色','Auto colour'],chart:objectOnly?['图元改色','Change object colour']:['换配色','Change palette'],raster:['显示调整','Adjust display'],wb:['WB 显示设置','WB display settings']};
      const name=names[kind];
      if(!name||!host.contextColor)return null;
      return {id:'context-color',zh:name[0],en:name[1],category:kind==='chart'?'style':'image',run:()=>host.contextColor(kind,objectOnly)};
    }
    let workbench=null;
    function launch(action){try{commands.close();images.close();if(typeof action!=='function'&&workbench?.prepare(action))return;const result=typeof action==='function'?action():action.run();if(result?.catch)result.catch(e=>host.say(e.message));}catch(e){host.say(e.message);}}
    function button(label,run,id){const b=doc.createElement('button');b.type='button';b.textContent=label;if(id)b.id=id;b.onclick=()=>launch(run);return b;}
    const click=id=>doc.getElementById(id)?.click();
    function openExportSettings(guided=false){
      if(guided&&host.leaveReviewForExport?.()===false)return;
      const action=actions.find(item=>item.id==='export');if(action)launch(action);
    }
    function openExportMenu(guided=false){
      if(guided&&host.leaveReviewForExport?.()===false)return;
      const menu=doc.getElementById('exportMenu');
      if(!menu)return;
      if(workbench||!menu.open)menu.querySelector('summary')?.click();
      doc.getElementById('export')?.focus();
    }
    function paintJourney(){
      journeyLanguage=host.language();
      journeyBar.hidden=!journey||journey.paused;
      const reviewActions=doc.getElementById('qualityFirstFigureActions');
      if(reviewActions){
        reviewActions.hidden=journeyBar.hidden||journey.stage!=='export';
        if(!reviewActions.hidden&&!reviewActions.hasChildNodes())reviewActions.append(reviewSize,reviewNext,reviewSkip);
        reviewNext.textContent=t('下一步：打开导出选项','Next: open export options');
        reviewSize.textContent=t('导出尺寸','Export dimensions');
        reviewSkip.textContent=t('跳过，直接编辑','Skip to editing');
      }
      if(journeyBar.hidden)return;
      journeyBar.dataset.stage=journey.stage;
      journeyBar.setAttribute('aria-label',t('首次编辑流程','First figure workflow'));
      const editHint=journey.kind==='text'
        ?t('双击画布上的可编辑文字，输入后按 Enter 确认。改完后打开质检。','Double-click editable text on the canvas, then press Enter to keep the change. Open review when ready.')
        :journey.kind==='image'
          ?t('可调整整张图片的显示，或另加标注。改完后打开质检。','Adjust the image display or add annotations. Open review when ready.')
          :t('选中画布上的图形可调整颜色或线条。改完后打开质检。','Select a shape on the canvas to change colour or stroke. Open review when ready.');
      const stages={
        import:[t('导入素材','Import artwork'),t('选择一个 SVG、PDF 或图片文件。','Choose an SVG, PDF, or image file.'),t('导入素材','Import artwork')],
        edit:[t('修改图件','Edit artwork'),editHint,t('打开图形质检','Open figure review')],
        review:[t('检查图形','Review the figure'),t('在质检面板点「检查当前图形」。完成后这里会显示导出入口。','Click Review current figure in the review panel. Export becomes available here when the check finishes.'),t('前往检查按钮','Go to review button')],
        export:[t('导出成图','Export the figure'),journey.kind==='image'
          ?t('核对尺寸后可选 PNG。要继续调整排版，请保存工程。','Check the dimensions before choosing PNG. Save the project to keep editing the layout.')
          :t('核对最终尺寸。SVG 保留矢量和可编辑文字，PNG 可直接作为图片使用。','Check the final dimensions. SVG retains vectors and editable text. PNG is ready to use as an image.'),t('打开导出选项','Open export options')],
        done:[t('图形已导出','Figure exported'),t('还要继续编辑时，可用「保存」留一份工程备份。','Use Save to keep a project backup for later editing.'),t('完成向导','Finish guide')]
      };
      const [title,hint,next]=stages[journey.stage];
      journeyTitle.textContent=title;journeyHint.textContent=hint;journeyNext.textContent=next;
      const editTool=journey.stage==='edit'&&journey.kind!=='text';
      journeyTool.hidden=!editTool&&journey.stage!=='export';
      journeyTool.textContent=editTool?(journey.kind==='image'?t('打开图片显示','Open image display'):t('打开颜色工具','Open colour tools')):t('导出尺寸','Export dimensions');
      journeySkip.textContent=t('跳过，直接编辑','Skip to editing');journeySkip.hidden=journey.stage==='done';
    }
    function startJourney(){
      if(journey){journey.paused=false;paintJourney();journeyNext.focus();return;}
      journey={stage:'import',kind:null,paused:false,owner:host.journeyOwner?.()};paintJourney();click('quickImportFiles');
    }
    function pauseJourney(){
      if(!journey||journey.paused)return;
      const focusWasInside=journeyBar.contains(doc.activeElement);
      const focusWasOnReview=doc.activeElement===reviewSkip;
      journey.paused=true;paintJourney();
      if(focusWasInside)helpTitle.focus();
      else if(focusWasOnReview)doc.getElementById('qualityScan')?.focus();
    }
    function nextInJourney(){
      if(journey.stage==='import')click('quickImportFiles');
      if(journey.stage==='edit'||journey.stage==='review'){
        journey.stage='review';paintJourney();host.review?.();
      }else if(journey.stage==='export')openExportMenu(true);
      else if(journey.stage==='done'){journey=null;paintJourney();helpTitle.focus();}
    }
    function journeyEvent(event,kind){
      if(!journey)return;
      if(event==='imported'&&['import','edit'].includes(journey.stage)){journey.stage='edit';journey.kind=kind();}
      else if(event==='reviewed'&&['edit','review'].includes(journey.stage))journey.stage='export';
      else if(event==='exported'&&journey.stage==='export')journey.stage='done';
      else return;
      paintJourney();
    }
    function openGuide(){
      if(guide.open)return;
      const heading=doc.createElement('div'),title=doc.createElement('h2');
      heading.className='command-heading';title.id='studioUsageGuideTitle';title.textContent=t('使用向导','Usage guide');
      const skip=button(t('跳过，直接编辑','Skip to editing'),()=>{
        guide.close();
        pauseJourney();
        if(doc.getElementById('projectStart')?.hidden===false)doc.getElementById('dismissProjectStart')?.click();
      },'skipStudioGuide');
      heading.append(title,skip);
      const body=doc.createElement('div'),topicNav=doc.createElement('nav'),details=doc.createElement('section');
      body.className='usage-guide-body';topicNav.setAttribute('aria-label',t('选择任务','Choose a task'));
      details.className='usage-guide-steps';details.setAttribute('aria-labelledby','usageGuideTopicTitle');body.append(topicNav,details);
      const command=id=>{const found=actions.find(a=>a.id===id);if(found)launch(found);};
      const routes={
        journey:startJourney,
        open:()=>click('load'),import:()=>click('quickImportFiles'),save:()=>click('save'),
        discovery:()=>command('discovery'),
        templates:()=>{
          if(doc.getElementById('startTemplates')?.disabled){
            host.say(t('可编辑模板需要本机绘图服务。你仍可打开工程或导入已有图件。','Editable templates need the local rendering engine. You can still open a project or import artwork.'));
            return;
          }
          click('startTemplates');
        },
        statistics:()=>click('methodConfigureStatistics'),
        layout:()=>{
          if(workbench){workbench.openTool('layout');const controls=doc.getElementById('workspaceLayout');if(controls)controls.open=true;}
          else click('mobileTab-panels');
          doc.getElementById('rows')?.focus();
        },
        align:()=>host.guideAlignment?.(),
        rectify:()=>command('rectify'),inset:()=>openImages('inset'),duplicates:()=>host.duplicates('all'),
        handoff:()=>host.guideHandoff?.('request'),clipboard:()=>host.guideHandoff?.('clipboard'),
        review:()=>command('review'),'export-settings':openExportSettings,
        'export-menu':openExportMenu
      };
      function show(topic){
        selectedTopic=topic.id;
        for(const item of topicNav.children)item.setAttribute('aria-pressed',String(item.dataset.guideTopic===selectedTopic));
        const name=doc.createElement('h3'),list=doc.createElement('ol');name.id='usageGuideTopicTitle';name.textContent=t(...topic.title);
        for(const [route,zh,en,copy,english] of topic.steps){
          const item=doc.createElement('li'),text=doc.createElement('p');
          text.textContent=t(copy,english);
          const caption=route==='journey'&&journey?t('继续首次流程','Resume first figure'):t(zh,en);
          item.append(text,button(caption,()=>{guide.close();routes[route]();},'usageGuideStep-'+route));
          list.append(item);
        }
        details.replaceChildren(name,list);
      }
      for(const topic of guideTopics){
        const tab=button(t(...topic.title),()=>show(topic));tab.dataset.guideTopic=topic.id;topicNav.append(tab);
      }
      guide.replaceChildren(heading,body);
      show(guideTopics.find(topic=>topic.id===selectedTopic));
      guide.showModal();topicNav.querySelector('[aria-pressed="true"]')?.focus();
    }
    function openCommands(){
      commands.replaceChildren();const header=doc.createElement('div');header.className='command-heading';const h=doc.createElement('h2');h.textContent=t('功能检索','Find a function');header.append(h,button(t('关闭','Close'),()=>commands.close()));
      const input=doc.createElement('input');input.type='search';input.id='commandQuery';input.placeholder=t('输入想做的事：拉直图片、调字距、加比例尺…','Describe the task: straighten a photo, text spacing, scale bar…');input.setAttribute('aria-label',t('搜索功能','Search commands'));
      const categoryBar=doc.createElement('div');categoryBar.className='command-categories';categoryBar.setAttribute('role','group');categoryBar.setAttribute('aria-label',t('功能分类','Function categories'));
      const results=doc.createElement('div');results.className='command-results';results.setAttribute('aria-label',t('检索结果','Search results'));let currentCategory='common';
      const common=['discovery','fonts','border','rectify','layout','review','export','usage-guide'];
      const paint=()=>{const q=input.value.trim().toLowerCase(),words=q.split(/\s+/);results.replaceChildren();
        for(const b of categoryBar.children)b.setAttribute('aria-pressed',String(!q&&b.dataset.category===currentCategory));
        const score=a=>{const label=(a.zh+' '+a.en).toLowerCase(),text=label+' '+a.terms.toLowerCase();return label.includes(q)?3:words.every(w=>text.includes(w))?2:a.terms.split(' ').filter(w=>w.length>1).some(w=>q.includes(w))?1:0;};
        const found=actions.filter(a=>q?score(a)>0:currentCategory==='common'?common.includes(a.id):a.category===currentCategory);if(q)found.sort((a,b)=>score(b)-score(a));
        const matches=workbench?(()=>{const rows=new Map();for(const a of found){const item=workbench.menus.find(x=>x.aliases.includes(a.id)),id=item?.id||a.id;if(!rows.has(id))rows.set(id,{...(item?.action||a),id,category:item?.owner||a.category,run:a.run});}return [...rows.values()];})():found;
        const preferred=colorAliases.has(q)?colorAction(host.context?.().color,q==='改色'):null;
        if(preferred)matches.unshift(preferred);
        const orderedCategories=preferred?[...categories.filter(c=>c[0]===preferred.category),...categories.filter(c=>c[0]!==preferred.category)]:categories;
        for(const [id,zh,eng]of orderedCategories){const items=matches.filter(a=>a.category===id);if(!items.length)continue;const group=doc.createElement('section');group.className='command-category-results';const heading=doc.createElement('h3');heading.textContent=t(zh,eng);group.append(heading);
          for(const a of items){const b=button('',a,'command-'+a.id),name=doc.createElement('strong');name.textContent=en()?a.en:a.zh;b.setAttribute('aria-label',name.textContent);b.append(name);const key={ 'history-undo':'Ctrl Z','history-redo':'Ctrl Y' }[a.id];if(key){const hint=doc.createElement('kbd');hint.textContent=key;b.append(hint);}group.append(b);}results.append(group);}
        if(!matches.length){const p=doc.createElement('p');p.textContent=t('未找到；试试“边框”“查重”“坐标轴”，或点击上方分类。','No matches; try border, duplicates or axis, or choose a category.');results.append(p);}
      };
      for(const [id,zh,eng]of [['common','常用','Common'],...categories]){const b=doc.createElement('button');b.type='button';b.dataset.category=id;b.textContent=t(zh,eng);b.onclick=()=>{currentCategory=id;input.value='';paint();};categoryBar.append(b);}
      input.oninput=paint;input.onkeydown=event=>{if(event.isComposing||event.keyCode===229)return;if(event.key==='ArrowDown'){event.preventDefault();results.querySelector('button')?.focus();}else if(event.key==='Enter'){event.preventDefault();results.querySelector('button')?.click();}};
      results.addEventListener('keydown',event=>{const buttons=[...results.querySelectorAll('button')],i=buttons.indexOf(doc.activeElement);if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();buttons[(i+(event.key==='ArrowDown'?1:buttons.length-1))%buttons.length]?.focus();}});
      commands.append(header,input,categoryBar,results);paint();commands.showModal();input.focus();
    }
    function openImages(focus){
      if(workbench&&!focus){workbench.openCategory('image');return;}
      images.replaceChildren();const h=doc.createElement('h2');h.textContent=t('图片工具','Image tools');images.append(h,button(t('返回编辑器','Back to editor'),()=>images.close()));
      const sources=host.images(),intro=doc.createElement('p');intro.textContent=t(`当前有 ${sources.length} 张可识别图片。所有工具在本机运行；只有点击“开始检查”才扫描。`,`There are ${sources.length} identifiable images. Tools run locally; screening starts only when you click Start.`);images.append(intro);
      const label=doc.createElement('label');label.textContent=t('目标图片（校正、颜色、局部放大与比例尺）','Target image (perspective, display, inset and scale bar)');const select=doc.createElement('select');select.id='imageToolTarget';const empty=doc.createElement('option');empty.value='';empty.textContent=t('请选择图片','Choose an image');select.append(empty);sources.forEach((source,i)=>{const o=doc.createElement('option');o.value=i;o.textContent=source.label||source.name||t(`图片 ${i+1}`,`Image ${i+1}`);select.append(o);});const current=host.selectedImage?.(),index=sources.findIndex(r=>current&&r.panelId===current.panelId&&r.variant===current.variant&&r.key===current.key);if(index>=0)select.value=index;else if(sources.length===1)select.value='0';label.append(select);images.append(label);
      const selectedAction=run=>()=>{if(select.value==='')throw Error(t('请先在上方选择一张图片。','Choose a target image above first.'));host.selectImage(sources[+select.value]);run();};
      const cards=doc.createElement('div');cards.className='image-tool-cards';
      const entries=[
        ['border',t('对象边框','Object borders'),t('独立装饰框；不改原图，不是 ROI。','Independent decorative frame; no source-pixel changes. Not an ROI.'),()=>host.borders(),false],
        ['duplicates',t('图片查重','Screen duplicates'),t('比较不同图片的像素或来源重叠；不检测同一图片内部复制，不判定学术不端。','Compare pixels or overlapping sources across images. No within-image copy detection or misconduct verdict.'),()=>host.duplicates('all'),sources.length<2],
        ['rectify',t('一键矫正与微调','Auto straighten & refine'),t('自动识别边界、标尺拉正或四角微调，先在画布预览。保留原图，不生成内容。','Use automatic outlines, a ruler or four-corner refinement, then preview on canvas. The original is retained; no content is generated.'),selectedAction(()=>host.rectify?.()),!sources.length],
        ['color',t('图片颜色与显示 → 匹配参考图','Image display → Match reference'),t('单图手动显示／明场参考色；荧光保留共同显示参数，不用于替代信号定量。','Manual display / brightfield reference colour. Fluorescence uses shared display parameters, not signal normalization.'),selectedAction(()=>host.color()),!sources.length],
        ['links',t('关联总览与放大图','Link overview and detail'),t('仅尝试同源或重叠视野；预览原图坐标，无法定位时不猜框。','For shared or overlapping fields only. Review source coordinates; no guessed ROI after failure.'),()=>host.links(),sources.length<2],
        ['inset',t('绘制局部放大／比例尺','Create inset / scale bar'),t('在当前图内选 ROI。物理比例尺需要真实采集标定。','Select an ROI in the image. Physical scale bars require acquisition calibration.'),selectedAction(()=>host.inset()),!sources.length]
      ];
      for(const [id,title,description,run,unavailable]of entries.filter(row=>!workbench||!focus||row[0]===focus)){const card=doc.createElement('article'),b=doc.createElement('button');b.type='button';b.id='imageTool-'+id;b.textContent=title;b.onclick=()=>{if(unavailable){const note=card.querySelector('[role="status"]');note.textContent=id==='duplicates'||id==='links'?t('请先导入至少两张独立图片；查重也可从原入口添加本机文件或体验示例。','Import at least two images first. Duplicate screening also accepts local files or its built-in example.'):t('请先导入图片。','Import an image first.');if(id==='duplicates')launch(()=>host.duplicates('files'));return;}if(['rectify','color','inset'].includes(id)&&select.value===''){const note=card.querySelector('[role="status"]');note.textContent=t('请先选择目标图片。','Choose a target image first.');select.focus();return;}launch(run);};const p=doc.createElement('p');p.textContent=description;const status=doc.createElement('p');status.setAttribute('role','status');card.append(b,p,status);cards.append(card);}images.append(cards);
      const disclosure=doc.createElement('details');disclosure.open=false;const summary=doc.createElement('summary');summary.textContent=t('检查状态与限制','Screening state and limits');const status=host.duplicateStatus?.(),note=doc.createElement('p');const states={idle:t('未启动','Not started'),running:t('检查中','Running'),review:t('需人工复核','Needs review'),complete:t('已完成','Complete'),unavailable:t('不能检查','Unavailable')};note.textContent=(states[status?.state]||states.idle)+' · '+t('未检查不等于通过；压平组图计一张图。','Not checked does not mean passed. A flattened montage counts as one image.');disclosure.append(summary,note);images.append(disclosure);images.showModal();if(focus)doc.getElementById('imageTool-'+focus)?.focus();
    }
    function refresh(){
      hierarchy?.refresh();
      workbench?.refresh();
      if(journey&&journey.owner!==host.journeyOwner?.()){journey=null;paintJourney();}
      else if(journey&&journeyLanguage!==host.language())paintJourney();
      helpTitle.textContent=t('向导','Guide');helpGuide.textContent=startGuide.textContent=t('使用向导','Usage guide');
      const skipStart=doc.getElementById('dismissProjectStart');
      if(skipStart)skipStart.textContent=t('跳过，直接编辑','Skip to editing');
      if(support){feedbackButton.textContent=t('使用反馈','Send feedback');metricsButton.textContent=t('下载统计（扣除验收）','Downloads excluding QA');}
      for(const a of actions.slice(0,5)){let b=nav.querySelector('[data-workflow="'+a.id+'"]');if(!b){b=button('',a);b.dataset.workflow=a.id;nav.append(b);}b.textContent=en()?a.en:a.zh;}
      searchButton.textContent=t('功能检索 · Ctrl K','Find function · Ctrl K');searchButton.onclick=openCommands;group.replaceChildren();
      for(const [id,zh,eng]of [['openObjectBorder','对象边框','Object borders'],['openImageTools','图片工具','Image tools']]){const b=doc.getElementById(id);if(b)b.textContent=t(zh,eng);}
      const count=doc.querySelectorAll('#artboard svg image[data-key]').length;hint.hidden=count<2;hint.textContent=t('已导入多张图片 · 可手动查重','Multiple images · Screen duplicates');hint.title=t('点击后先确认检查范围，不会自动扫描。','Review the scope before starting; no automatic scan.');nav.append(hint);
      const context=host.context?.()||{},preferred=colorAction(context.color);
      primaryColor.hidden=!preferred;
      if(preferred){
        primaryColor.textContent=t(preferred.zh,preferred.en);
        primaryColor.title=context.color==='raster'?t('位图整体显示调整。逐个图元换色请导入源 SVG 或原始数据。','Adjust raster display. Import the source SVG or data to recolour individual elements.'):primaryColor.textContent;
        primaryColor.onclick=()=>launch(preferred.run);
      }
      if(context.selected){group.append(button(t('边框','Borders'),()=>host.borders(),'quickObjectBorder'));if(context.image){if(host.rectify)group.append(button(t('透视校正','Perspective'),()=>host.rectify(),'quickImageRectify'));group.append(button(t('颜色与显示','Image display'),()=>host.color(),'quickImageDisplay'));if(!workbench)group.append(button(t('图片查重','Duplicates'),()=>host.duplicates('selected'),'quickImageDuplicates'),button(t('关联放大图','Link detail'),()=>host.links(),'quickImageLinks'));}}
    }
    doc.addEventListener('keydown',event=>{if(!event.defaultPrevented&&!event.isComposing&&event.keyCode!==229&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!doc.querySelector('dialog[open]')){event.preventDefault();openCommands();}});
    const drawers=host.drawerWorkspace||(typeof StudioDrawerWorkspace!=='undefined'?StudioDrawerWorkspace:null);
    if(hierarchy&&drawers)workbench=drawers.create({document:doc,language:host.language,hierarchy,actions,categories,legacyNavigation:nav,launch,syncPane:host.syncPane,captureViewAnchor:host.captureViewAnchor,restoreViewAnchor:host.restoreViewAnchor});
    refresh();return {refresh,openImages,openCommands,openGuide,journeyEvent,actions,nav,workbench};
  }
  return {create,workspaceHierarchy};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioExperienceTools;
