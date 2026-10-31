/* Device appearance only. Never reads or mutates figure data or project history. */
'use strict';
const StudioTheme = (() => {
  const storageKey = 'figure-studio:appearance:v1';
  const themes = new Set(['carbon', 'pearl']);
  const surrounds = new Set(['neutral', 'dark', 'light']);
  function normalize(value) {
    return {theme: themes.has(value?.theme) ? value.theme : 'carbon',
      surround: surrounds.has(value?.surround) ? value.surround : 'neutral'};
  }
  function mount(options = {}) {
    const doc = options.document || document, root = doc.documentElement;
    const language = options.language || (() => doc.documentElement.lang);
    const t = (zh, en) => language() === 'en' ? en : zh;
    let preference = normalize(), storageFailed = false, lastKind = null;
    let store;
    try { store = Object.hasOwn(options, 'storage') ? options.storage : doc.defaultView?.localStorage; } catch { storageFailed = true; }
    try { preference = normalize(JSON.parse(store?.getItem(storageKey) || 'null')); } catch {}
    const apply = () => {
      root.dataset.theme = preference.theme;
      root.dataset.canvasSurround = preference.surround;
    };
    apply();
    const menu = doc.createElement('details'); menu.className = 'header-appearance'; menu.id = 'appearanceMenu';
    const summary = doc.createElement('summary'); summary.setAttribute('role', 'button');
    const symbol = doc.createElement('span'); symbol.className = 'appearance-symbol'; symbol.textContent = '◐'; symbol.setAttribute('aria-hidden', 'true');
    const caption = doc.createElement('span'); summary.append(symbol, caption);
    const panel = doc.createElement('div'); panel.className = 'appearance-menu';
    const themeLabel = doc.createElement('label'), theme = doc.createElement('select'); theme.id = 'studioTheme';
    for (const [value, title] of [['carbon', 'Carbon Atelier'], ['pearl', 'Pearl Pro']]) {
      const option = doc.createElement('option'); option.value = value; option.textContent = title; theme.append(option);
    }
    const themeText = doc.createElement('span'); themeLabel.append(themeText, theme);
    const surroundLabel = doc.createElement('label'), surround = doc.createElement('select'); surround.id = 'studioSurround';
    for (const value of surrounds) { const option = doc.createElement('option'); option.value = value; surround.append(option); }
    const surroundText = doc.createElement('span'); surroundLabel.append(surroundText, surround);
    const note = doc.createElement('p'); note.className = 'appearance-feedback'; note.setAttribute('role', 'status');
    panel.append(themeLabel, surroundLabel, note); menu.append(summary, panel);
    doc.querySelector('.toolbar')?.prepend(menu);
    const identity = doc.createElement('div'); identity.className = 'project-identity';
    const title = doc.createElement('strong'); title.id = 'headerProjectTitle'; identity.append(title);
    const saved = doc.getElementById('autosaveStatus'); if (saved) identity.append(saved);
    doc.querySelector('header .brand')?.after(identity);
    const context = doc.createElement('div'); context.className = 'inspector-context';
    const contextLabel = doc.createElement('span'); contextLabel.className = 'inspector-context-label';
    const contextKind = doc.createElement('strong'); contextKind.id = 'inspectorSelectionKind';
    const contextMeta = doc.createElement('small'); contextMeta.id = 'inspectorSelectionMeta';
    context.append(contextLabel, contextKind, contextMeta); doc.querySelector('aside.inspector')?.prepend(context);
    const labels = {canvas: ['画布与小图', 'Canvas & panel'], text: ['文字', 'Text'], image: ['图片', 'Image'],
      shape: ['矢量图形', 'Vector artwork'], axes: ['坐标轴', 'Axes'], multiple: ['多个对象', 'Multiple objects'],
      label: ['小图标签', 'Panel label'], guide: ['对齐参考线', 'Alignment guide']};
    const groupIds = ['objectAlignmentPanel', 'paragraphPanel', 'componentStyle', 'markControls', 'axisControls', 'heatmapTools', 'panelLabelControls'];
    const groups = groupIds.map(id => doc.getElementById(id)).filter(Boolean);
    const groupFor = {canvas: 'componentStyle', text: 'paragraphPanel', shape: 'componentStyle', axes: 'axisControls', multiple: 'objectAlignmentPanel', label: 'panelLabelControls'};
    let selection = {kind: 'canvas', count: 0};
    const quick = doc.getElementById('canvasQuickToolbar');
    let toolbarFrame = 0, toolbarTimer = 0, toolbarWidth = -1;
    // Reserve the larger contextual layout at this width. Measure only this
    // small toolbar after resize/language changes, never the scientific SVG or
    // on object selection. Hidden text tools must not make fit-to-window jump.
    function reserveToolbar() {
      toolbarFrame = 0;
      if (!quick || !quick.isConnected) return;
      const width = quick.getBoundingClientRect().width;
      if (!width) return;
      const previous = quick.dataset.context, previousKind = quick.dataset.selectionKind, oldMinimum = quick.style.minHeight;
      const group = doc.getElementById('contextImageActions');
      const children = group ? [...group.childNodes] : [];
      const focused = group?.contains(doc.activeElement) ? doc.activeElement : null;
      let height = 0;
      try {
        quick.style.minHeight = '0px';
        for (const kind of ['text', 'image']) {
          quick.dataset.context = kind;
          if(doc.body.classList.contains('studio-drawers'))quick.dataset.selectionKind=kind;
          if (group) {
            group.replaceChildren();
            const labels = kind === 'image' ? doc.body.classList.contains('studio-drawers') ? [['边框','Borders'],['透视校正','Perspective'],['颜色与显示','Image display']] : [['边框','Borders'],['颜色与显示','Image display'],['图片查重','Duplicates'],['关联放大图','Link detail']] : [['边框','Borders']];
            for (const pair of labels) { const button = doc.createElement('button'); button.type = 'button'; button.textContent = t(...pair); group.append(button); }
          }
          height = Math.max(height, quick.getBoundingClientRect().height);
        }
      } finally {
        if (previous === undefined) delete quick.dataset.context; else quick.dataset.context = previous;
        if(previousKind===undefined)delete quick.dataset.selectionKind;else quick.dataset.selectionKind=previousKind;
        if (group) group.replaceChildren(...children);
        focused?.focus({preventScroll: true});
        quick.style.minHeight = height > 0 ? `${Math.ceil(height)}px` : oldMinimum;
      }
    }
    const scheduleToolbar = (settle = false) => {
      doc.defaultView.clearTimeout(toolbarTimer);
      if (settle) {
        doc.defaultView.cancelAnimationFrame(toolbarFrame); toolbarFrame = 0;
        // Sidebar dragging already fits the preview each frame. Preserve the
        // reserved height during that gesture; measure once the width settles.
        toolbarTimer = doc.defaultView.setTimeout(() => { toolbarTimer = 0; scheduleToolbar(); }, 100);
      } else if (!toolbarFrame) toolbarFrame = doc.defaultView.requestAnimationFrame(reserveToolbar);
    };
    const toolbarObserver = quick && typeof doc.defaultView.ResizeObserver === 'function' ? new doc.defaultView.ResizeObserver(entries => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        if (Math.abs(width - toolbarWidth) > .5) { const initial = toolbarWidth < 0; toolbarWidth = width; scheduleToolbar(!initial); }
      }
    }) : null;
    if (quick) toolbarObserver?.observe(quick);
    const onResize = () => scheduleToolbar(true);
    doc.defaultView.addEventListener('resize', onResize);
    function renderContext() {
      const pair = labels[selection.kind] || labels.canvas;
      contextLabel.textContent = t('当前选中', 'Current selection'); contextKind.textContent = t(...pair);
      contextMeta.textContent = selection.count > 1 ? t(`${selection.count} 个对象 · 高级设置仍可展开`, `${selection.count} objects · Advanced controls remain available`) : t('常用属性优先 · 更多选项可展开', 'Common properties first · Expand for advanced controls');
      context.dataset.kind = selection.kind;
    }
    function setSelection(value) {
      const next = {kind: Object.hasOwn(labels, value?.kind) ? value.kind : 'canvas', count: Math.max(0, Number(value?.count) || 0)};
      if (next.kind !== selection.kind || next.count !== selection.count) { selection = next; renderContext(); }
      if (lastKind !== next.kind) {
        lastKind = next.kind;
        const quick = doc.getElementById('canvasQuickToolbar'); if (quick) quick.dataset.context = next.kind;
        if(!doc.body.classList.contains('studio-drawers'))for (const group of groups) { const open = group.id === groupFor[next.kind] && !group.hidden; if (group.open !== open) group.open = open; }
      }
    }
    const syncDocument = () => {
      const text = doc.getElementById('projectTitle')?.textContent || t('新建组图', 'Untitled figure');
      if (title.textContent !== text) title.textContent = text;
      title.title = text;
      if (saved) {
        const text = saved.textContent || '';
        saved.dataset.saveState = /正在保存|saving/i.test(text) ? 'saving' : /失败|failed|could not|error/i.test(text) ? 'error' : /其他窗口|another window|other window/i.test(text) ? 'conflict' : /保存|saved/i.test(text) ? 'saved' : 'idle';
        identity.dataset.saveState = saved.dataset.saveState;
      }
    };
    function refresh() {
      caption.textContent = t('外观', 'Appearance'); summary.title = t('界面主题与画布周边；不改变作品', 'Interface theme and canvas surround; artwork stays unchanged');
      themeText.textContent = t('界面主题', 'Interface theme'); theme.setAttribute('aria-label', themeText.textContent); theme.value = preference.theme;
      surroundText.textContent = t('画布周边', 'Canvas surround'); surround.setAttribute('aria-label', surroundText.textContent); surround.value = preference.surround;
      const names = {neutral: ['中性灰蓝', 'Neutral slate'], dark: ['深石墨', 'Dark graphite'], light: ['浅中性灰', 'Light neutral']};
      for (const option of surround.options) option.textContent = t(...names[option.value]);
      note.textContent = storageFailed ? t('外观已应用，偏好未能保存；下次打开可重新选择。', 'Appearance applied, but the preference could not be saved. Select it again next time.') : t('仅记忆此设备的外观，不改变图中配色、图片或导出。', 'Remembered on this device only. Figure colours, images and exports stay unchanged.');
      note.dataset.state = storageFailed ? 'warning' : 'info'; renderContext(); syncDocument();
      scheduleToolbar();
    }
    function update(value) {
      preference = normalize({...preference, ...value}); apply();
      try { store?.setItem(storageKey, JSON.stringify(preference)); storageFailed = !store; } catch { storageFailed = true; }
      refresh();
    }
    theme.addEventListener('change', () => update({theme: theme.value}));
    surround.addEventListener('change', () => update({surround: surround.value}));
    const onOutside = event => { if (menu.open && !menu.contains(event.target)) menu.open = false; };
    const onEscape = event => { if (event.key === 'Escape' && menu.open && menu.contains(doc.activeElement)) { event.preventDefault(); menu.open = false; summary.focus(); } };
    doc.addEventListener('pointerdown', onOutside); doc.addEventListener('keydown', onEscape);
    const onLanguage = () => queueMicrotask(refresh); doc.getElementById('language')?.addEventListener('change', onLanguage);
    const observer = new doc.defaultView.MutationObserver(syncDocument);
    const sourceTitle = doc.getElementById('projectTitle'); if (sourceTitle) observer.observe(sourceTitle, {childList: true, characterData: true, subtree: true});
    if (saved) observer.observe(saved, {childList: true, characterData: true, subtree: true});
    // Observe just two short status/title nodes, never the artwork subtree.
    refresh(); setSelection(selection);
    return {refresh, selection: setSelection, update, preferences: () => ({...preference}), destroy() { observer.disconnect(); toolbarObserver?.disconnect(); doc.defaultView.cancelAnimationFrame(toolbarFrame); doc.defaultView.clearTimeout(toolbarTimer); doc.defaultView.removeEventListener('resize', onResize); if (quick) quick.style.minHeight = ''; menu.remove(); context.remove(); if (saved) doc.querySelector('.header-controls')?.append(saved); identity.remove(); doc.getElementById('language')?.removeEventListener('change', onLanguage); doc.removeEventListener('pointerdown', onOutside); doc.removeEventListener('keydown', onEscape); }};
  }
  return {mount, normalize, storageKey};
})();
if (typeof module !== 'undefined' && module.exports) module.exports = StudioTheme;
