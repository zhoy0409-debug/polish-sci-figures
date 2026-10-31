/* One canonical tool location per task. Original controls and scientific
   controllers are retained; drawer navigation owns no project state. */
'use strict';
const StudioDrawerWorkspace=(()=>{
  const ALIASES={edit:'fonts',typography:'fonts',paragraph:'fonts','text-color':'colour-lines','label-color':'colour-lines','submission-profile':'export',group:'organization',lock:'organization',aspect:'canvas-tools'};
  const SEARCH_ONLY=new Set(['appearance','checkpoints','open-project','save-project','history-undo','history-redo','feedback','download-metrics','layers','preferences']);
  const OWNER={duplicates:'export','legend-style':'data'};
  function canonical(action){return ALIASES[action.id]||action.id;}
  function catalog(actions){
    const byId=new Map(actions.map(a=>[a.id,a])),result=new Map();
    for(const a of actions){if(SEARCH_ONLY.has(a.id)||a.id==='images')continue;const id=canonical(a),primary=byId.get(id)||a,owner=OWNER[primary.id]||primary.category;
      if(!result.has(id))result.set(id,{id,owner,action:primary,aliases:[]});
      const item=result.get(id);item.aliases.push(a.id);
    }
    const organization=result.get('organization');if(organization)organization.action={...organization.action,zh:'组合、锁定与解锁',en:'Group, lock & unlock'};
    return [...result.values()];
  }
  function create(adapter){
    const doc=adapter.document,win=doc.defaultView;if(!win?.matchMedia?.('(min-width: 751px)').matches||win.matchMedia('(pointer: coarse)').matches)return null;
    const workspace=doc.querySelector('.workspace'),left=doc.querySelector('.navigator'),right=doc.querySelector('.inspector');if(!workspace||!left||!right)return null;
    const node=id=>doc.getElementById(id),en=()=>adapter.language()==='en',t=(zh,eng)=>en()?eng:zh,labels=[],menus=catalog(adapter.actions);
    const el=(name,cls)=>{const n=doc.createElement(name);if(cls)n.className=cls;return n;},caption=(n,zh,eng)=>{labels.push([n,zh,eng]);return n;},button=(id,zh,eng,run)=>{const b=caption(el('button'),zh,eng);b.type='button';b.id=id;b.onclick=run;return b;};
    let category='style',view='catalog',active=null,leftView='project',previousLanguage=null,immersive=null;
    doc.body.classList.add('studio-drawers');workspace.classList.add('studio-drawer-shell');
    const oldLeft=[...left.children],oldRight=[...right.children],leftRail=el('nav','studio-drawer-rail'),rail=el('nav','studio-drawer-rail'),leftBody=el('div','studio-drawer-body'),body=el('div','studio-drawer-body'),bank=el('div','studio-tool-bank'),list=el('div','studio-tool-list'),context=el('div','studio-drawer-context');
    leftRail.setAttribute('aria-label',t('工程抽屉','Project drawers'));rail.setAttribute('aria-label',t('工具抽屉','Tool drawer'));
    function heading(container,closeId,close){const h=el('div','studio-drawer-heading'),title=el('strong');h.append(title,button(closeId,'收起','Collapse',close));container.append(h);return title;}
    const leftTitle=heading(leftBody,'drawerCloseProject',()=>openLeft(false)),title=heading(body,'drawerCloseTools',()=>openRight(false));
    const back=button('drawerBack','返回本类工具','Back to this category',()=>openCategory(category));back.className='studio-drawer-back';back.hidden=true;body.append(back,context,list,bank);
    const leftGroups={project:el('div'),layers:el('div')};
    // Layout and output settings have one home in their task drawer. Versions
    // belong to the project drawer, not publication output.
    const layout=node('workspaceLayout'),output=node('exportOptions');
    for(const n of oldLeft){if(n===layout||n===output)continue;if(n.id==='layerPanel')leftGroups.layers.append(n);else leftGroups.project.append(n);}
    if(node('workspaceNavigatorTabs'))node('workspaceNavigatorTabs').hidden=true;
    leftBody.append(...Object.values(leftGroups));left.replaceChildren(leftRail,leftBody);
    bank.append(...oldRight);if(layout)bank.append(layout);if(output)bank.append(output);
    // Attach the bank before resolving IDs: getElementById never finds a
    // detached subtree. Reuse, rather than clone, every original control.
    right.replaceChildren(rail,body);
    // Keep the single selected-object/source context above every tool. It is
    // never cloned into separate category forms.
    for(const selector of ['.inspector-context','.inspector-selection','#importContentInfo','#scientificSourceInfo']){const n=bank.querySelector(selector);if(n)context.append(n);}
    const scope=node('scope')?.parentElement;if(scope)context.append(scope);
    for(const id of ['paragraphPanel','objectAlignmentPanel'])if(node(id))bank.append(node(id));
    const secondary=bank.querySelector('.workspace-secondary-properties');if(secondary&&!secondary.children.length)secondary.remove();
    const painter=doc.querySelector('#workspaceSelectionTools .text-tools');if(painter){painter.id='drawerFormattingTools';bank.append(painter);painter.querySelector('.text-spacing-toggle')?.setAttribute('hidden','');}
    function moveGroup(id,selector){const n=doc.querySelector(selector);if(n){n.id=id;bank.append(n);}return n;}
    moveGroup('drawerClipboard','#workspaceSelectionTools .quick-clipboard-group');
    const canvasControls=el('section');canvasControls.id='drawerCanvasControls';
    for(const id of ['selectPanelContent','fitPanelContent','selectionAspect','restoreShape','restoreAllShapes']){const n=node(id);if(n)canvasControls.append(n);}
    bank.append(canvasControls);
    // Separate chart geometry from object paint, and manual guides from
    // annotation appearance. All controls keep their original node/handler.
    const bars=node('barGeometry');if(bars){const box=el('section');box.dataset.pane='detail';box.id='drawerBars';box.append(bars);bank.append(box);}
    const guide=node('addHorizontalGuide')?.closest('details');if(guide){guide.id='drawerGuides';bank.append(guide);}
    if(guide)for(const id of ['toggleGuides','quickGuideAction'])if(node(id))guide.append(node(id));
    if(layout&&node('insertTrackMenu'))layout.append(node('insertTrackMenu'));
    const organization=node('groupSelection')?.closest('details');if(organization)for(const id of ['quickGroup','quickUnlockSelected','unlockAll'])if(node(id))organization.append(node(id));
    for(const id of ['workspaceCanvasTools','workspaceSelectionTools'])node(id)?.remove();
    if(node('memoryDetails'))leftGroups.project.append(node('memoryDetails'));
    const shape=node('overlayType')?.closest('.quick-tool-group');if(shape){shape.id='drawerInsertAnnotation';bank.append(shape);}
    const discovery=node('openDiscovery');if(discovery){const box=el('section');box.id='drawerDiscovery';box.append(discovery);bank.append(box);}
    const variants=node('sizes')?.closest('section');if(variants){const box=el('section');box.dataset.pane='explore';box.id='drawerPanelGeometry';for(const n of [...variants.children]){if(n.localName==='h2'&&n.nextElementSibling?.textContent?.includes('数据结构'))break;if(n===node('candidateHint')||n.contains(node('chartGoal')))break;box.append(n);if(n===node('slotChoices'))break;}bank.append(box);}
    const exportActions=el('div','studio-drawer-export-actions');exportActions.id='drawerExportActions';for(const id of ['export','png','tiff'])if(node(id))exportActions.append(node(id));bank.append(exportActions);
    // Progressive disclosure uses the original fields and controllers. Opening
    // a tool never recreates its form or resets an in-flight preview.
    function disclosure(id,zh,eng){const box=el('details','drawer-advanced');box.id=id;box.append(caption(el('summary'),zh,eng));return box;}
    const fontPanel=node('typePanel');
    if(fontPanel){
      const paragraphTitle=node('paragraphPanel')?.querySelector('summary');if(paragraphTitle)caption(paragraphTitle,'行距、字距与缩进','Spacing & indents');
      const advanced=disclosure('drawerFontAdvanced','批量调整与字体替换','Batch changes & font replacement');
      // The unified editor owns both the live text field and character tools.
      // Keep the original host; a separate legacy-only drawer becomes empty
      // whenever renderRichTextControls hides the replaced legacy input.
      const content=node('workspaceCharacterFormats')||disclosure('drawerTextContent','文字内容','Text content');content.classList.add('drawer-advanced');
      content.addEventListener('toggle',()=>{if(content.open)win.requestAnimationFrame?.(()=>{if(content.open&&content.isConnected)content.scrollIntoView({block:'nearest'});});});
      for(const id of ['textRole','fontTargetInfo','replaceFontArial','replaceFontTimes','unifyTypography']){const n=node(id);if(!n)continue;const part=n.closest('label,.font-replacements')||n;advanced.append(part);}
      const note=fontPanel.querySelector('.font-replacement-note');if(note)advanced.append(note);
      for(const id of ['textContent','applyText']){const n=node(id);if(n)content.append(n.closest('label')||n);}
      fontPanel.append(content,advanced);fontPanel.open=true;
      const fontLabel=node('font')?.closest('label'),sizeLabel=node('fontSize')?.closest('label');
      if(fontLabel){fontPanel.querySelector('summary')?.after(fontLabel);if(sizeLabel)fontLabel.after(sizeLabel);}
      const first=bank.querySelector('[data-drawer-owner]')||bank.firstChild;bank.insertBefore(fontPanel,first);
      // Keep full character and paragraph controls after the basic type form.
      let after=fontPanel;for(const id of ['paragraphPanel','drawerFormattingTools']){const n=node(id);if(n){after.after(n);after=n;}}
    }
    const layoutBar=doc.querySelector('.canvas-layoutbar'),quickBar=node('canvasQuickToolbar');
    if(layoutBar&&quickBar){
      // A single contextual row replaces the two permanent canvas rows.
      const arrange=node('arrangePanels');if(arrange&&layout)layout.append(arrange);
      const duplicate=node('checkImageDuplicates');if(duplicate)exportActions.append(duplicate);
      const align=node('quickAlignAction');if(align&&node('objectAlignmentPanel'))node('objectAlignmentPanel').append(align);
      quickBar.append(...layoutBar.children);layoutBar.remove();
      const view=el('div','drawer-view-controls');view.id='drawerViewControls';
      for(const n of [node('dimensions'),node('zoom')?.closest('label')])if(n)view.append(n);
      quickBar.append(view);
      // Only toolbar layout is observed. Original nodes/handlers move together;
      // no object tree reads or extra controls enter the selection hot path.
      const overflow=el('div','drawer-quick-overflow'),more=button('drawerQuickMore','更多','More',()=>setMore(!quickBar.classList.contains('drawer-more-open'))),menu=el('div','drawer-quick-menu');
      menu.id='drawerQuickMenu';more.setAttribute('aria-controls',menu.id);more.setAttribute('aria-expanded','false');menu.setAttribute('role','group');overflow.append(more,menu);quickBar.insertBefore(overflow,view);overflow.hidden=true;
      const secondary=[node('quickImportFiles'),node('boxSelect'),node('contextImageActions'),node('quickAlignmentToggle')?.closest('.quick-tool-group'),quickBar.querySelector('.quick-object-group'),node('quickDelete')].filter(Boolean).map(n=>{const marker=doc.createComment('toolbar '+n.id);n.before(marker);return{n,marker};});
      function setMore(open){quickBar.classList.toggle('drawer-more-open',open);more.setAttribute('aria-expanded',String(open));if(open){const r=more.getBoundingClientRect(),width=Math.min(240,win.innerWidth-24),top=r.bottom+6;menu.style.width=width+'px';menu.style.left=Math.max(12,Math.min(r.left,win.innerWidth-width-12))+'px';menu.style.top=top+'px';menu.style.maxHeight=Math.max(80,win.innerHeight-top-12)+'px';}}
      let compact=false;
      // Reserve space for longer English/fallback font metrics as well as Chinese.
      function reflowQuick(){const next=quickBar.clientWidth<1200;if(next===compact)return;compact=next;setMore(false);overflow.hidden=!compact;quickBar.classList.toggle('drawer-quick-compact',compact);for(const {n,marker}of secondary)if(compact)menu.append(n);else marker.after(n);}
      const quickObserver=typeof win.ResizeObserver==='function'?new win.ResizeObserver(reflowQuick):null;quickObserver?.observe(quickBar);win.addEventListener('resize',reflowQuick);win.requestAnimationFrame?.(reflowQuick);
      doc.addEventListener('pointerdown',e=>{if(!overflow.contains(e.target))setMore(false);});
      doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing&&e.keyCode!==229&&!e.defaultPrevented&&quickBar.classList.contains('drawer-more-open')){setMore(false);more.focus();e.preventDefault();e.stopPropagation();}});
      menu.addEventListener('click',e=>{if(e.target.closest('button')&&!e.target.closest('input,select'))setMore(false);});
      const focusButton=button('drawerImmersive','专注画布','Focus canvas',()=>{if(immersive){const saved=immersive;immersive=null;openLeft(saved.left,saved.view);openRight(saved.right);}else{immersive={left:workspace.dataset.leftOpen==='true',right:workspace.dataset.rightOpen==='true',view:leftView};openLeft(false);openRight(false);}focusButton.setAttribute('aria-pressed',String(!!immersive));});
      focusButton.className='drawer-focus-canvas';focusButton.setAttribute('aria-pressed','false');view.append(focusButton);
    }
    const targets={fonts:['#typePanel','#workspaceCharacterFormats','#paragraphPanel','#drawerFormattingTools'], 'colour-lines':['#workspaceObjectStyle'],border:['#objectBorderDialog'],axes:['#professionalAxesHost','#axisControls'],'data-table':['section[data-pane="data"]'],statistics:['#methodExplorer','#dataInfo'],'stat-annotation':['#statisticalAnnotations','#conditionMatrixControls','#selectedStatisticalLine'],'category-spacing':['#categorySpacingControls'],'legend-style':['#componentStyle'],'chart-variants':['#chartGoal','#literatureExamples'],'panel-geometry':['#drawerPanelGeometry'],palette:['#palettes'],marks:['#markControls'],bars:['#drawerBars'],heatmap:['#heatmapTools'],preferences:['#memoryDetails'],rectify:['#imageRectifyDialog'],color:['#imageColorDialog'],links:['#imageLinksDialog'],inset:['#imageInsetsControls'],'scale-bar':['#scaleCalibration'], 'panel-label':['#panelLabelControls'],layout:['#workspaceLayout'],organization:['#groupSelection'], 'object-align':['#objectAlignmentPanel'],export:['#exportOptions','#drawerExportActions','#qa'],guides:['#drawerGuides'],annotations:['#overlayFont','#drawerInsertAnnotation'],clipboard:['#drawerClipboard'],'canvas-tools':['#drawerCanvasControls'],review:['#qualityWorkspace']};
    function rootOf(n){if(!n||!bank.contains(n))return null;while(n.parentElement!==bank)n=n.parentElement;return n;}
    targets.discovery=['#drawerDiscovery'];targets.rectify.push('#imageRectifyControls','.rectify-completed');targets.color.push('#imageColorControls');targets.links.push('#imageLinksControls');
    function roots(id){const out=new Set();for(const selector of targets[id]||[])for(const n of bank.querySelectorAll(selector)){const root=rootOf(n);if(root)out.add(root);}return out;}
    for(const item of menus)for(const root of roots(item.id)){root.dataset.drawerOwner=item.id;root.dataset.drawerCategoryOwner=item.owner;if(item.id==='stat-annotation'&&root.dataset.pane==='detail')root.dataset.pane='annotation';}
    for(const [id,n]of Object.entries(leftGroups))n.dataset.drawerLeft=id;
    function resizeIf(changed,anchor){if(changed){win.dispatchEvent(new win.Event('resize'));adapter.restoreViewAnchor?.(anchor);}}
    function openLeft(open=true,next=leftView){if(open&&immersive){immersive=null;node('drawerImmersive')?.setAttribute('aria-pressed','false');}const changed=workspace.dataset.leftOpen!==String(open),anchor=changed&&adapter.captureViewAnchor?.();leftView=next;workspace.dataset.leftOpen=String(open);leftBody.hidden=!open;for(const [id,n]of Object.entries(leftGroups))n.hidden=id!==next;leftTitle.textContent=next==='layers'?t('图层与对象','Layers & objects'):t('工程与版本','Project & versions');for(const b of leftRail.children)b.setAttribute('aria-pressed',String(open&&b.dataset.view===next));resizeIf(changed,anchor);}
    function openRight(open=true){if(open&&immersive){immersive=null;node('drawerImmersive')?.setAttribute('aria-pressed','false');}const changed=workspace.dataset.rightOpen!==String(open),anchor=changed&&adapter.captureViewAnchor?.();workspace.dataset.rightOpen=String(open);body.hidden=!open;rail.firstElementChild?.setAttribute('aria-pressed',String(open));resizeIf(changed,anchor);}
    function selectRoots(id){bank.querySelectorAll(':scope > .studio-tool-active').forEach(n=>n.classList.remove('studio-tool-active'));for(const n of roots(id))n.classList.add('studio-tool-active');bank.dataset.tool=id;}
    function paneFor(fallback='detail'){if(view==='catalog')return 'detail';if(active==='palette')return 'palette';if(['chart-variants','panel-geometry','discovery'].includes(active))return 'explore';if(active==='data-table')return 'data';if(active==='inset'&&node('imageInsetsControls')?.dataset.pane==='annotation')return 'annotation';if(['annotations','stat-annotation'].includes(active))return 'annotation';return 'detail';}
    function openTool(id,label){const item=menus.find(x=>x.id===id);if(!item)return false;const changed=active!==id||view!=='tool';category=item.owner;active=id;view='tool';title.textContent=label||(en()?item.action.en:item.action.zh);back.hidden=false;list.hidden=true;bank.hidden=false;context.hidden=false;selectRoots(id);if(id==='fonts'&&fontPanel)fontPanel.open=true;openRight(true);updateBar();if(changed){body.scrollTop=0;adapter.syncPane?.(paneFor());}return true;}
    function openCategory(id){category=id;active=null;view='catalog';title.textContent=categoryName(id);back.hidden=true;bank.hidden=true;context.hidden=false;list.hidden=false;list.replaceChildren();for(const item of menus.filter(x=>x.owner===id)){const b=el('button');b.type='button';b.dataset.drawerTool=item.id;b.textContent=en()?item.action.en:item.action.zh;b.onclick=()=>adapter.launch(item.action);list.append(b);}if(!list.children.length){const p=el('p');p.textContent=t('此类操作从顶部菜单进入，也可以使用功能检索。','Use the header menu or function search for these actions.');list.append(p);}body.scrollTop=0;openRight(true);updateBar();adapter.syncPane?.('detail');}
    const categories=adapter.categories.filter(row=>menus.some(item=>item.owner===row[0]));
    function categoryName(id){const row=categories.find(x=>x[0]===id);return row?(en()?row[2]:row[1]):id;}
    const taskbar=el('nav','studio-taskbar');taskbar.id='drawerTaskbar';taskbar.setAttribute('aria-label',t('工具类别','Tool categories'));for(const [id]of categories){const b=el('button');b.type='button';b.dataset.drawerCategory=id;b.onclick=()=>openCategory(id);taskbar.append(b);}workspace.before(taskbar);adapter.legacyNavigation.hidden=true;
    function updateBar(){for(const b of taskbar.children){b.textContent=categoryName(b.dataset.drawerCategory);b.setAttribute('aria-pressed',String(b.dataset.drawerCategory===category));}}
    for(const [id,zh,eng]of [['project','工程','Project'],['layers','图层','Layers']]){const b=button('drawerLeft-'+id,zh,eng,()=>openLeft(workspace.dataset.leftOpen!=='true'||leftView!==id,id));b.dataset.view=id;leftRail.append(b);}
    rail.append(button('drawerTools','工具','Tools',()=>openRight(workspace.dataset.rightOpen!=='true')));
    function prepare(action){if(action.id==='layers'){openLeft(true,'layers');return;}if(action.id==='checkpoints'||action.id==='preferences'){openLeft(true,'project');if(action.id==='checkpoints'&&node('workspaceVersions'))node('workspaceVersions').open=true;return;}if(action.id==='images'){openCategory('image');return;}if(SEARCH_ONLY.has(action.id))return;const id=canonical(action),panel={border:'#objectBorderDialog',rectify:'#imageRectifyDialog',color:'#imageColorDialog',links:'#imageLinksDialog',axes:'[data-axis-settings]'}[id],existing=panel&&bank.querySelector(panel),resume=existing&&!existing.hidden;openTool(id,en()?action.en:action.zh);if(resume){existing.querySelector('input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled)')?.focus({preventScroll:true});return true;}}
    function revealControl(target){for(const item of menus)if([...roots(item.id)].some(n=>n.contains(target)||n===target)){openTool(item.id);return true;}if(leftGroups.layers.contains(target)){openLeft(true,'layers');return true;}if(leftGroups.project.contains(target)){openLeft(true,'project');return true;}return false;}
    doc.addEventListener('click',event=>{const b=event.target.closest('button,summary');if(!b)return;
      if(b.id==='dimensions'||b.closest('#exportMenu')&&b.localName==='summary'){if(b.localName==='summary')event.preventDefault();openTool('export');if(output)output.open=true;}
      if(['quickObjectBorder','openObjectBorder'].includes(b.id))openTool('border');
      if(['quickImageRectify','imageTool-rectify'].includes(b.id))openTool('rectify');
      if(['quickImageDisplay','imageTool-color'].includes(b.id))openTool('color');
      if(['quickImageLinks','imageTool-links'].includes(b.id))openTool('links');
      if(b.id==='openProfessionalAxes')openTool('axes');
    },true);
    // Observe only explicit tool-panel visibility, never the scientific SVG or
    // selection hot path. Programmatic/legacy entries land in their same owner.
    const observed=new Map();for(const [id,selector]of [['border','#objectBorderDialog'],['axes','[data-axis-settings]'],['color','#imageColorDialog'],['rectify','#imageRectifyDialog'],['links','#imageLinksDialog']]){const n=bank.querySelector(selector);if(!n)continue;observed.set(n,{id,hidden:n.hidden});}
    const observer=new win.MutationObserver(records=>{for(const record of records){const entry=observed.get(record.target);if(!entry)continue;const was=entry.hidden;entry.hidden=record.target.hidden;if(was&&!entry.hidden){openTool(entry.id);record.target.querySelector('input:not(:disabled):not([type=hidden]),select:not(:disabled),textarea:not(:disabled)')?.focus({preventScroll:true});}}});
    for(const n of observed.keys())observer.observe(n,{attributes:true,attributeFilter:['hidden']});
    function refresh(){const language=adapter.language();if(language===previousLanguage)return;previousLanguage=language;for(const [n,zh,eng]of labels){n.textContent=t(zh,eng);if(n.id==='drawerImmersive')n.title=t('隐藏／恢复两侧面板，保留当前视图','Hide / restore side panels, keeping the current view');}updateBar();leftTitle.textContent=leftView==='layers'?t('图层与对象','Layers & objects'):t('工程与版本','Project & versions');if(view==='catalog')openCategory(category);else if(active)title.textContent=en()?menus.find(x=>x.id===active).action.en:menus.find(x=>x.id===active).action.zh;}
    adapter.hierarchy.onReveal=revealControl;
    refresh();openLeft(false);openCategory('style');
    return {openTool,openCategory,openLeft,prepare,revealControl,refresh,paneFor,menus,bank,roots,destroy(){observer.disconnect();}};
  }
  return {create,catalog,canonical,SEARCH_ONLY};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioDrawerWorkspace;
