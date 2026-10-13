/* Figure Studio: original assets + reversible style differences. No network or libraries. */
'use strict';
const copy = x => JSON.parse(JSON.stringify(x));
const PROJECT_FILE_LIMIT = 200000000;
function projectFileBlob(payload){const blob=new Blob([JSON.stringify(payload)],{type:'application/json'});if(blob.size>PROJECT_FILE_LIMIT)throw Error('工程超过 200 MB，请拆分工程后保存。');return blob;}
class History {
  constructor(state) { this.states = [copy(state)]; this.index = 0; }
  get current() { return this.states[this.index]; }
  commit(state) {
    if (JSON.stringify(state) === JSON.stringify(this.current)) return false;
    this.states = this.states.slice(0, this.index + 1); this.states.push(copy(state));
    if (this.states.length > 81) this.states.shift();
    this.index = this.states.length - 1; return true;
  }
  undo() { if (this.index > 0) this.index--; return this.current; }
  redo() { if (this.index < this.states.length - 1) this.index++; return this.current; }
  toJSON(){return {states:this.states,index:this.index};}
  static restore(saved,project,current){
    if(!saved)return new History(current);
    if(!Array.isArray(saved.states)||saved.states.length<1||saved.states.length>81||!Number.isInteger(saved.index)||saved.index<0||saved.index>=saved.states.length)throw Error('撤销记录无效');
    for(const s of saved.states)validateState(s,project);
    if(JSON.stringify(saved.states[saved.index])!==JSON.stringify(current))throw Error('撤销记录与当前状态不一致');
    const h=new History(current);h.states=copy(saved.states);h.index=saved.index;return h;
  }
}
const EDIT_KEYS = new Set(['fill', 'stroke', 'opacity', 'font-family', 'font-size', 'font-weight', 'text', 'rich-text', 'stroke-width', 'text-anchor', 'offset-x', 'offset-y', 'hidden', 'stat-left', 'stat-right', 'stat-shape']);
function richTextAPI(){return typeof StudioRichText!=='undefined'?StudioRichText:typeof module!=='undefined'&&module.exports?require('./rich-text.js'):null;}
function validValue(key, value) {
  if (typeof value !== 'string') return false;
  if(key==='rich-text')return !!richTextAPI()?.valid(value);
  if(key==='hidden')return value==='true';
  if(key==='stat-left'||key==='stat-right')return Number.isFinite(+value)&&Math.abs(+value)<=500;
  if(key==='stat-shape')return ['bracket','line','rounded'].includes(value);
  if(key==='offset-x'||key==='offset-y')return Number.isFinite(+value)&&Math.abs(+value)<=14400;
  if(key==='stroke-width')return Number.isFinite(+value)&&+value>=0&&+value<=100;
  if(key==='text-anchor')return ['start','middle','end'].includes(value);
  if (key === 'text') return value.length <= 500;
  if (key === 'fill' || key === 'stroke') return value==='none'||/^#[0-9a-f]{6}$/i.test(value);
  if (key === 'opacity') return Number.isFinite(+value) && +value >= .05 && +value <= 1;
  if (key === 'font-size') return Number.isFinite(+value) && +value >= .1 && +value <= 1000;
  if (key === 'font-family') return ['Arial', 'Times New Roman', 'DejaVu Sans', 'Calibri', 'SimSun'].includes(value);
  if (key === 'font-weight') return ['400', '700'].includes(value);
  return false;
}
function heatmapCellInfo(id){
  const m=String(id||'').match(/studio-heat-value-(\d+)-([a-f\d]{16})-([a-f\d]{6})-([01])-(\d)(?:-([a-f\d]{16})-([sd])-([a-f\d]{16}))?$/i);if(!m)return null;
  const bytes=Uint8Array.from(m[2].match(/../g),x=>parseInt(x,16)),value=new DataView(bytes.buffer).getFloat64(0,false);
  return Number.isFinite(value)?{index:m[1],value,background:'#'+m[3],visible:m[4]==='1',decimals:+m[5],normalized:m[6]?heatmapFloat(m[6]):null,kind:m[7]==='d'?'diverging':'sequential',midpoint:m[8]?heatmapFloat(m[8]):.5}:null;
}
function heatmapFloat(encoded){const bytes=Uint8Array.from(encoded.match(/../g),x=>parseInt(x,16));return new DataView(bytes.buffer).getFloat64(0,false);}
function validateHeatmapPalette(cfg){if(!cfg||!Array.isArray(cfg.stops)||![2,3].includes(cfg.stops.length)||cfg.stops.some(c=>typeof c!=='string'||!/^#[a-f\d]{6}$/i.test(c)))throw Error('热图配色参数无效');return cfg;}
function heatmapPaletteColor(position,palette,midpoint=.5){
  validateHeatmapPalette(palette);const colors=palette.stops,t=Math.min(1,Math.max(0,position));
  let a=colors[0],b=colors.at(-1),f=t;
  if(colors.length===3){const mid=Math.min(1-1e-12,Math.max(1e-12,midpoint));if(t<=mid){b=colors[1];f=t/mid;}else{a=colors[1];f=(t-mid)/(1-mid);}}
  const rgb=c=>c.slice(1).match(/../g).map(x=>parseInt(x,16)),aa=rgb(a),bb=rgb(b);
  return '#'+aa.map((v,i)=>Math.round(v+(bb[i]-v)*f).toString(16).padStart(2,'0')).join('');
}
function applyHeatmapPalette(svg,palette){
  if(!palette)return;validateHeatmapPalette(palette);let recolored=false;
  for(const group of svg.querySelectorAll('[id*="studio-heat-value-"]')){
    const info=heatmapCellInfo(group.id);if(!info||!Number.isFinite(info.normalized))continue;
    const box=svg.querySelector(`[id$="studio-heat-box-${info.index}"] path`);if(!box)continue;
    box.style.opacity='1';box.style.fill=heatmapPaletteColor(info.normalized,palette,info.midpoint);recolored=true;
  }
  if(!recolored)return;
  for(const source of svg.querySelectorAll('[id*="studio-heat-source-"]'))source.style.opacity='0';
  for(const scale of svg.querySelectorAll('[id*="studio-heat-scale-"]')){
    const match=scale.id.match(/studio-heat-scale-([sd])-([a-f\d]{16})-([a-f\d_]+)$/i);if(!match)continue;
    const positions=match[3].split('_').map(heatmapFloat),paths=[...scale.querySelectorAll('path')].filter(p=>!p.closest('defs'));
    if(paths.length!==positions.length)throw Error('热图色标不匹配');
    paths.forEach((path,index)=>{path.style.fill=heatmapPaletteColor(positions[index],palette,heatmapFloat(match[2]));});
  }
}
function heatmapNumber(value,decimals){
  if(!Number.isFinite(value)||!Number.isInteger(decimals)||decimals<0||decimals>6)throw Error('热图数值参数无效');
  const result=value.toFixed(decimals);return Number(result)===0?(0).toFixed(decimals):result;
}
function heatmapContrast(color){
  const css=String(color).match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);if(css)color='#'+css.slice(1).map(x=>(+x).toString(16).padStart(2,'0')).join('');
  if(!/^#[a-f\d]{6}$/i.test(color))return '#000000';
  const rgb=color.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  const L=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;return 1.05/(L+.05)>(L+.05)/.05?'#ffffff':'#000000';
}
function validateHeatmapLabels(cfg){
  if(!cfg||typeof cfg.visible!=='boolean'||!Number.isInteger(cfg.decimals)||cfg.decimals<0||cfg.decimals>6||!Number.isFinite(cfg.fontSize)||cfg.fontSize<.1||cfg.fontSize>1000||!(cfg.color==='auto'||/^#[a-f\d]{6}$/i.test(cfg.color)))throw Error('热图数值参数无效');
  return cfg;
}
// Runs on the same editable SVG used by canvas, saved projects and exports.
function applyHeatmapValueLabels(svg,cfg,unit=1,palette=null,mapPalette=true){
  if(cfg)validateHeatmapLabels(cfg);
  if(mapPalette)applyHeatmapPalette(svg,palette);
  const fitted=[];
  const context=typeof document!=='undefined'?document.createElement('canvas').getContext('2d'):null;
  for(const group of svg.querySelectorAll('[id*="studio-heat-value-"]')){
    const info=heatmapCellInfo(group.id);if(!info)continue;
    const texts=[...group.querySelectorAll('text')];if(!texts.length)continue;
    const shown=cfg?cfg.visible:info.visible;
    group.style.opacity=shown?'1':'0';
    for(const t of texts){t.style.opacity=shown?'1':'0';for(const child of t.querySelectorAll('[style]'))child.style.opacity=shown?'1':'0';}
    if(!shown)continue;
    const first=texts[0],oldSize=parseFloat(first.style.fontSize||first.getAttribute('font-size'))||8;
    const suffix=/%\s*$/.test(first.textContent)?'%':'';
    first.textContent=heatmapNumber(info.value,cfg?cfg.decimals:info.decimals)+suffix;
    let size=cfg?cfg.fontSize*unit:oldSize;
    const box=svg.querySelector(`[id$="studio-heat-box-${info.index}"] path`),nums=box?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);
    if(nums?.length>=8){
      const xs=nums.filter((_,i)=>i%2===0),ys=nums.filter((_,i)=>i%2===1),width=Math.max(...xs)-Math.min(...xs),height=Math.max(...ys)-Math.min(...ys);
      let maxWidth=0;for(const t of texts){if(context)context.font=`${size}px ${(first.style.fontFamily||first.getAttribute('font-family')||'Arial').replaceAll("'",'')}`;maxWidth=Math.max(maxWidth,context?context.measureText(t.textContent).width:t.textContent.length*size*.62);}
      size*=Math.min(1,width*.86/Math.max(maxWidth,.01),height*.78/(size*texts.length*1.2));
      // Single-line values are centred on the cell, independent of font size.
      if(texts.length===1){first.setAttribute('x',(Math.min(...xs)+Math.max(...xs))/2);first.setAttribute('y',(Math.min(...ys)+Math.max(...ys))/2);first.removeAttribute('transform');first.setAttribute('text-anchor','middle');first.setAttribute('dominant-baseline','central');}
    }
    const background=palette&&Number.isFinite(info.normalized)?(box?.style.fill||heatmapPaletteColor(info.normalized,palette,info.midpoint)):info.background;
    for(const t of texts){t.style.fontSize=size+'px';t.style.fill=cfg?.color&&cfg.color!=='auto'?cfg.color:heatmapContrast(background);for(const child of t.querySelectorAll('tspan')){const old=parseFloat(child.style.fontSize||child.getAttribute('font-size'));if(Number.isFinite(old))child.style.fontSize=(old*size/oldSize)+'px';child.style.fill=t.style.fill;}}
    fitted.push({texts,size});
  }
  // One matrix uses one actual font size, including cells with a longer sign or
  // more digits; larger requested sizes never silently create overlapping text.
  const uniform=Math.min(...fitted.map(item=>item.size));
  for(const {texts,size}of fitted)for(const text of texts){text.style.fontSize=uniform+'px';for(const child of text.querySelectorAll('tspan')){const previous=parseFloat(child.style.fontSize);if(Number.isFinite(previous))child.style.fontSize=previous*uniform/size+'px';}}
  return svg;
}
// A palette or single-cell color edit can change contrast after default label
// formatting. This final pass only adjusts inherited color: explicit text
// styles, custom font sizes, opacity and hidden/deleted objects are preserved.
function refreshHeatmapLabelContrast(svg,cfg,palette,edits={}){
  if(cfg?.color&&cfg.color!=='auto')return svg;
  for(const group of svg.querySelectorAll('[id*="studio-heat-value-"]')){
    const info=heatmapCellInfo(group.id);if(!info)continue;
    const box=svg.querySelector(`[id$="studio-heat-box-${info.index}"] path`);
    const background=palette&&Number.isFinite(info.normalized)?(box?.style.fill||heatmapPaletteColor(info.normalized,palette,info.midpoint)):info.background;
    const color=heatmapContrast(background);
    for(const text of group.querySelectorAll('text')){
      const props=edits[text.getAttribute('data-key')]||{};
      if(!Object.hasOwn(props,'fill'))text.style.fill=color;
      for(const span of text.querySelectorAll('tspan'))if(!Object.hasOwn(edits[span.getAttribute('data-key')]||{},'fill'))span.style.fill=Object.hasOwn(props,'fill')?text.style.fill:color;
    }
  }
  return svg;
}
function validateAlignmentGuides(guides){
  if(!Array.isArray(guides)||new Set(guides.map(guide=>guide?.id)).size!==guides.length||guides.some(guide=>!guide||typeof guide.id!=='string'||!/^guide-\d+$/.test(guide.id)||!['x','y'].includes(guide.axis)||!Number.isFinite(guide.position)||guide.position<0))throw Error('对齐参考线参数无效');return guides;
}
function alignmentSnap(bounds,targets,dx,dy,tolerance=5,disabled=false){
  if(disabled||!bounds)return {dx,dy,guides:[]};const guides=[];let result={dx,dy};
  for(const axis of ['x','y']){const start=axis==='x'?'left':'top',end=axis==='x'?'right':'bottom',delta=axis==='x'?dx:dy,moving=[bounds[start]+delta,(bounds[start]+bounds[end])/2+delta,bounds[end]+delta];let best=null;
    for(const target of targets){if(target.axis!==axis)continue;for(const anchor of moving){const correction=target.position-anchor,distance=Math.abs(correction);if(distance>tolerance)continue;const priority=target.manual?0:1;if(!best||priority<best.priority||priority===best.priority&&distance<best.distance)best={...target,correction,distance,priority};}}
    if(best){result[axis==='x'?'dx':'dy']+=best.correction;guides.push(best);}
  }return {...result,guides};
}
function panelGaps(s){return {x:s.gapX??s.gap,y:s.gapY??s.gap};}
function copyPanelGaps(target,source){target.gap=source.gap;for(const key of ['gapX','gapY']){if(source[key]!==undefined)target[key]=source[key];else delete target[key];}return target;}
function validateState(state, project) {
  if(state?.alignmentGuides!==undefined)validateAlignmentGuides(state.alignmentGuides);
  if(state?.compactWhitespace!==undefined&&typeof state.compactWhitespace!=='boolean')throw Error('留白设置无效');
  if (!state || !Array.isArray(state.order) || state.order.length < 1 || state.order.length > 24 ||
      new Set(state.order).size !== state.order.length || !Number.isInteger(state.columns) || state.columns < 1 || state.columns > 6 ||
      !Number.isFinite(state.gap) || state.gap < 0 || state.gap > 100) throw Error('工程布局无效');
  for(const key of ['gapX','gapY'])if(state[key]!==undefined&&(!Number.isFinite(state[key])||state[key]<0||state[key]>100))throw Error('工程布局无效');
  if(state.overlays){if(!Array.isArray(state.overlays)||state.overlays.length>300||new Set(state.overlays.map(a=>a.id)).size!==state.overlays.length)throw Error('标注参数无效');for(const a of state.overlays){if(!/^annotation-\d+$/.test(a.id)||!['text','line','bracket','rect','ellipse'].includes(a.type)||!['x','y','w','h'].every(k=>Number.isFinite(a[k])&&a[k]>=0&&a[k]<=1)||a.x+a.w>1.001||a.y+a.h>1.001||typeof a.text!=='string'||a.text.length>2000||!validValue('fill',a.color)||!validValue('font-family',a.font)||!Number.isFinite(a.size)||a.size<.1||a.size>1000||!Number.isFinite(a.stroke)||a.stroke<=0||a.stroke>100||!Number.isFinite(a.opacity)||a.opacity<.05||a.opacity>1||typeof a.locked!=='boolean'||typeof a.fill!=='boolean'||(a.align&&!['start','middle','end'].includes(a.align)))throw Error('标注参数无效');}}
  for(const a of state.overlays||[])if(a.direction!==undefined&&!['horizontal','vertical','free'].includes(a.direction))throw Error('标注参数无效');
  for(const a of state.overlays||[])if(a.richText!==undefined&&!validValue('rich-text',a.richText))throw Error('字符格式无效');
  if(state.exportSettings&&(!Number.isFinite(state.exportSettings.widthMm)||state.exportSettings.widthMm<20||state.exportSettings.widthMm>2000||![600,900,1200].includes(state.exportSettings.dpi)))throw Error('导出尺寸或分辨率无效');
  if(state.labelNumbering!==undefined&&state.labelNumbering!==false&&!['upper','lower','numeric'].includes(state.labelNumbering))throw Error('图号参数无效');
  if(state.panelGroups){const seen=new Set();if(!Array.isArray(state.panelGroups))throw Error('组合状态无效');for(const group of state.panelGroups){if(!Array.isArray(group)||group.length<2)throw Error('组合状态无效');for(const id of group){if(!state.order.includes(id)||seen.has(id))throw Error('组合状态无效');seen.add(id);}}}
  if(state.typography&&(!validValue('font-family',state.typography.font)||!Number.isFinite(state.typography.size)||state.typography.size<6||state.typography.size>1000))throw Error('组图字体参数无效');
  if (state.grid) {
    const g=state.grid, occupied=new Set();
    if(!Number.isInteger(g.rows)||g.rows<1||g.rows>24||!g.places)throw Error('母版行数无效');
    for(const [key,length]of [['widths',state.columns],['heights',g.rows]])if(g[key]&&(!Array.isArray(g[key])||g[key].length!==length||g[key].some(n=>!Number.isFinite(n)||n<=0||n>14400)))throw Error('工程布局无效');
    for(const id of state.order){const p=g.places[id];
      if(!p||!['row','col','rs','cs'].every(k=>Number.isInteger(p[k]))||p.row<0||p.col<0||p.rs<1||p.cs<1||p.row+p.rs>g.rows||p.col+p.cs>state.columns)throw Error('小图超出母版');
      for(let r=p.row;r<p.row+p.rs;r++)for(let c=p.col;c<p.col+p.cs;c++){const key=r+':'+c;if(occupied.has(key))throw Error('小图位置重叠');occupied.add(key);}
    }
  }
  for (const id of state.order) {
    const p=project.panels.find(p=>p.id===id);if(!p)throw Error('面板顺序无效');
    const s = state.panels?.[p.id];
    if(s?.statistics!==undefined)validateStatistics(s.statistics);
    if(s?.heatmapLabels!==undefined)validateHeatmapLabels(s.heatmapLabels);
    if(s?.heatmapPalette!==undefined)validateHeatmapPalette(s.heatmapPalette);
    if(s?.methodChoice&&(!['primary_test','sensitivity_test'].includes(s.methodChoice.key)||!Number.isFinite(p.analysis?.[s.methodChoice.key]?.p_value)||typeof s.methodChoice.reason!=='string'||s.methodChoice.reason.length>500))throw Error('分析选择无效');
    if(s?.errorDirection&&!['both','positive','negative'].includes(s.errorDirection))throw Error('误差棒方向无效');
    if(s?.markStyle&&(typeof s.markStyle!=='object'||Array.isArray(s.markStyle)||Object.entries(s.markStyle).some(([k,v])=>!({pointScale:[.25,3],capWidth:[0,16],errorWidth:[.25,4]})[k]||!Number.isFinite(v)||v<({pointScale:.25,capWidth:0,errorWidth:.25})[k]||v>({pointScale:3,capWidth:16,errorWidth:4})[k])))throw Error('点与误差棒样式无效');
    if(s?.annotationFont&&(!validValue('font-family',s.annotationFont.font)||!Number.isFinite(s.annotationFont.size)||s.annotationFont.size<.1||s.annotationFont.size>1000))throw Error('组图字体参数无效');
    if(s?.annotationStyle&&!['stars','hash','p','letters'].includes(s.annotationStyle))throw Error('标注样式无效');
    if(s?.annotationLine&&!['bracket','line','rounded'].includes(s.annotationLine))throw Error('统计连接线样式无效');
    if(s?.annotationPFormat&&!['standard','precise'].includes(s.annotationPFormat))throw Error('P 值显示格式无效');
    for(const prop of ['bold','italic'])if(s?.annotationFont?.[prop]!==undefined&&typeof s.annotationFont[prop]!=='boolean')throw Error('组图字体参数无效');
    if(s?.useUnifiedTypography!==undefined&&typeof s.useUnifiedTypography!=='boolean')throw Error('组图字体参数无效');
    if(s?.showFacetTitles!==undefined&&typeof s.showFacetTitles!=='boolean')throw Error('分面标题设置无效');
    if(s?.conditionMatrix){const m=s.conditionMatrix;if(m.enabled!==undefined&&typeof m.enabled!=='boolean'||!Array.isArray(m.groups)||m.groups.length>50||m.groups.some(g=>typeof g!=='string'||g.length>200)||!Array.isArray(m.rows)||m.rows.length>8||m.rows.some(r=>!r||typeof r.label!=='string'||r.label.length>80||!r.values||typeof r.values!=='object'||Array.isArray(r.values)||Object.keys(r.values).length>100||Object.values(r.values).some(v=>typeof v!=='string'||v.length>40)))throw Error('分组条件表参数无效');if(m.font&&(!validValue('font-family',m.font.font)||!Number.isFinite(m.font.size)||m.font.size<.1||m.font.size>1000||['bold','italic'].some(k=>m.font[k]!==undefined&&typeof m.font[k]!=='boolean')))throw Error('分组条件表参数无效');}
    if(s?.scales)for(const [vi,entries]of Object.entries(s.scales)){if(!p.variants[vi]||!entries||typeof entries!=='object')throw Error('比例尺参数无效');for(const [key,v]of Object.entries(entries)){if(!/^e\d+$/.test(key)||!Number.isFinite(v.calibration)||v.calibration<=0||!Number.isFinite(v.length)||v.length<=0||v.length>v.calibration*.8||!Number.isFinite(v.thickness)||v.thickness<.5||v.thickness>12||!Number.isFinite(v.size)||v.size<6||v.size>36||!Number.isFinite(v.alpha)||v.alpha<0||v.alpha>1||!['bl','br','tl','tr'].includes(v.position)||!validValue('font-family',v.font)||!validValue('fill',v.color)||typeof v.bold!=='boolean'||typeof v.background!=='boolean')throw Error('比例尺参数无效');}}
    if(s?.label){const l=s.label;if(l.manual!==undefined&&typeof l.manual!=='boolean')throw Error('图号参数无效');if(typeof l.text!=='string'||l.text.length>20||!Number.isFinite(l.x)||l.x<0||l.x>100||!Number.isFinite(l.y)||l.y<0||l.y>100||!Number.isFinite(l.size)||l.size<6||l.size>36||!validValue('font-family',l.font)||typeof l.bold!=='boolean')throw Error('图号参数无效');}
    if(s?.label?.richText!==undefined&&!validValue('rich-text',s.label.richText))throw Error('字符格式无效');
    if(s?.locked!==undefined&&typeof s.locked!=='boolean')throw Error('锁定状态无效');
    for(const field of ['lockedElements','elementGroups'])if(s?.[field])for(const [vi,items]of Object.entries(s[field])){if(!p.variants[vi]||!Array.isArray(items))throw Error('组合状态无效');const keys=field==='elementGroups'?items.flat():items;if(keys.some(k=>typeof k!=='string'||!/^e\d+$/.test(k)))throw Error('组合状态无效');}
    if(s?.geometry && (!Number.isFinite(s.geometry.barWidth)||s.geometry.barWidth<.5||s.geometry.barWidth>1.5||!Number.isFinite(s.geometry.groupGap)||s.geometry.groupGap<.65||s.geometry.groupGap>1.05))throw Error('柱形布局参数无效');
    if(s?.groupSpacing && (!Number.isFinite(s.groupSpacing.factor)||s.groupSpacing.factor<.5||s.groupSpacing.factor>1.25))throw Error('组间距参数无效');
    if (!s || !Number.isInteger(s.variant) || !p.variants[s.variant] || !s.edits || typeof s.edits !== 'object') throw Error('候选图状态无效');
    for (const [v, edits] of Object.entries(s.edits)) {
      if (!/^\d+$/.test(v) || !p.variants[+v] || !edits || typeof edits !== 'object') throw Error('样式版本无效');
      for (const [key, props] of Object.entries(edits)) {
        if (!/^e\d+$/.test(key) || !props || typeof props !== 'object') throw Error('元素标识无效');
        for (const [prop, value] of Object.entries(props)) if (!EDIT_KEYS.has(prop) || !validValue(prop, value)) throw Error('不支持的样式差异');
      }
    }
  }
  return true;
}
function complementary(hex) {
  const rgb = hex.match(/[0-9a-f]{2}/gi)?.map(s => parseInt(s, 16));
  if (!rgb || rgb.length !== 3) throw Error('无效颜色');
  const hi = Math.max(...rgb), lo = Math.min(...rgb);
  return '#' + rgb.map(n => (hi + lo - n).toString(16).padStart(2, '0')).join('');
}
function visualPanelOrder(s){
  const grid=gridFor(s);return [...s.order].sort((a,b)=>grid.places[a].row-grid.places[b].row||grid.places[a].col-grid.places[b].col||s.order.indexOf(a)-s.order.indexOf(b));
}
function panelNumberStyle(s){
  if(s.labelNumbering===false)return false;
  if(['upper','lower','numeric'].includes(s.labelNumbering))return s.labelNumbering;
  const labels=s.order.map(id=>s.panels[id].label?.text).filter(Boolean);
  if(labels.length&&labels.every(text=>/^[a-z]$/.test(text)))return 'lower';
  if(labels.length&&labels.every(text=>/^\d+$/.test(text)))return 'numeric';
  return 'upper';
}
function panelLabelText(index,style){return style==='numeric'?String(index+1):String.fromCharCode((style==='lower'?97:65)+index);}
function displayedPanelLabel(s,id){
  const label=s.panels[id]?.label;if(!label)return null;
  const style=panelNumberStyle(s),auto=style&&!label.manual&&!s.panels[id].locked&&/^(?:[A-Za-z]|\d+)$/.test(label.text);
  return auto?{...label,text:panelLabelText(visualPanelOrder(s).indexOf(id),style)}:{...label};
}
function migratePanelLabels(s,initial){
  const next=copy(s);if(next.labelNumbering!==undefined)return next;
  next.labelNumbering=panelNumberStyle(initial||s);
  for(const id of next.order){const label=next.panels[id].label;if(!label||label.manual!==undefined)continue;
    const baseline=initial?.panels[id]?.label;label.manual=!baseline||label.text!==baseline.text;
  }
  return next;
}
function numberPanelLabels(s,style,defaults){
  if(!['upper','lower','numeric'].includes(style))throw Error('图号参数无效');
  const next=copy(s);next.labelNumbering=style;
  visualPanelOrder(next).forEach((id,i)=>{const p=next.panels[id];if(!p.locked)p.label={...defaults,...p.label,text:panelLabelText(i,style),manual:false};});
  return next;
}
function removeSelectedItems(s,{groups=[],annotations=[],labelId=null}={}){
  const next=copy(s);let removed=0;
  for(const group of groups){const p=next.panels[group.id];if(!p||p.locked||p.variant!==group.vi)continue;
    for(const key of new Set(group.keys)){if(!/^e\d+$/.test(key)||(p.lockedElements?.[group.vi]||[]).includes(key))continue;
      p.edits[group.vi]||={};p.edits[group.vi][key]||={};if(p.edits[group.vi][key].hidden!=='true'){p.edits[group.vi][key].hidden='true';removed++;}
    }
  }
  const chosen=new Set(annotations);next.overlays=(next.overlays||[]).filter(a=>{const remove=chosen.has(a.id)&&!a.locked;if(remove)removed++;return !remove;});
  if(labelId&&next.panels[labelId]?.label&&!next.panels[labelId].locked){delete next.panels[labelId].label;removed++;}
  return {next,removed};
}
function editingTextTarget(target){return !!(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));}
// Compact mode only translates overlays; stored coordinates remain tied to
// the uncropped composition so gestures never change their physical size.
function overlayEditingSpace(geometry){return {width:geometry.compact?.sourceWidth||geometry.width,height:geometry.compact?.sourceHeight||geometry.height};}
// Line endpoints use physical canvas units so angle snapping is independent of
// the page aspect ratio. The opposite endpoint stays anchored during resizing.
function overlayLineEndpoints(a,space){const x=a.x*space.width,y=a.y*space.height,w=a.w*space.width,h=a.h*space.height;return [{x,y:y+(a.reverseY?h:0)},{x:x+w,y:y+(a.reverseY?0:h)}];}
function overlayLineGeometry(anchor,point,space,direction='free',shift=false){
  let dx=point.x-anchor.x,dy=point.y-anchor.y;
  if(direction==='horizontal')dy=0;else if(direction==='vertical')dx=0;
  else if(shift){if(Math.abs(dx)>Math.abs(dy)*2.4142)dy=0;else if(Math.abs(dy)>Math.abs(dx)*2.4142)dx=0;else {const d=Math.max(Math.abs(dx),Math.abs(dy));dx=Math.sign(dx)*d;dy=Math.sign(dy)*d;}}
  else {if(Math.abs(dy)<=Math.min(6,Math.abs(dx)*.12))dy=0;else if(Math.abs(dx)<=Math.min(6,Math.abs(dy)*.12))dx=0;}
  // Shorten along the same direction at the edge rather than bending the line.
  const factor=Math.max(0,Math.min(1,dx>0?(space.width-anchor.x)/dx:dx<0?-anchor.x/dx:1,dy>0?(space.height-anchor.y)/dy:dy<0?-anchor.y/dy:1));
  const end={x:anchor.x+dx*factor,y:anchor.y+dy*factor};
  return {x:Math.min(anchor.x,end.x)/space.width,y:Math.min(anchor.y,end.y)/space.height,w:Math.abs(end.x-anchor.x)/space.width,h:Math.abs(end.y-anchor.y)/space.height,reverseY:dx*dy<0};
}
function resizeOverlayGeometry(a,endpoint,dx,dy,space,shift=false){
  if(a.type==='line'){const ends=overlayLineEndpoints(a,space),moving=ends[endpoint===0?0:1],anchor=ends[endpoint===0?1:0];return {...a,...overlayLineGeometry(anchor,{x:moving.x+dx,y:moving.y+dy},space,a.direction||'free',shift)};}
  if(a.type==='bracket'){const moving=(a.x+(endpoint===0?0:a.w))*space.width,anchor=(a.x+(endpoint===0?a.w:0))*space.width,end=Math.max(0,Math.min(space.width,moving+dx));return {...a,x:Math.min(anchor,end)/space.width,w:Math.max(.001,Math.abs(end-anchor)/space.width)};}
  return {...a,w:Math.max(.005,Math.min(1-a.x,a.w+dx/space.width)),h:Math.max(0,Math.min(1-a.y,a.h+dy/space.height))};
}
function orientOverlayLine(a,direction,space){
  if(direction==='free')return {...a,direction};
  const cx=(a.x+a.w/2)*space.width,cy=(a.y+a.h/2)*space.height,length=Math.hypot(a.w*space.width,a.h*space.height),half=Math.min(length/2,direction==='horizontal'?Math.min(cx,space.width-cx):Math.min(cy,space.height-cy));
  return {...a,direction,reverseY:false,...(direction==='horizontal'?{x:(cx-half)/space.width,y:cy/space.height,w:half*2/space.width,h:0}:{x:cx/space.width,y:(cy-half)/space.height,w:0,h:half*2/space.height})};
}
function overlayInsertionGeometry(geometry,point,preferredId=null){
  if(!geometry.compact)return {...point};
  const {width,height}=overlayEditingSpace(geometry),x=point.x*geometry.width,y=point.y*geometry.height;
  const pos=geometry.positions.find(p=>x>=p.x&&x<=p.x+p.width&&y>=p.y&&y<=p.y+p.height)||geometry.positions.find(p=>p.id===preferredId);
  const original=pos&&geometry.compact.originalPositions?.find(p=>p.id===pos.id),render=pos?.renderBox||pos,dx=original?render.x-original.x:0,dy=original?render.y-original.y:0;
  return {...point,x:(x-dx)/width,y:(y-dy)/height,...(point.w!==undefined?{w:point.w*geometry.width/width}:{}),...(point.h!==undefined?{h:point.h*geometry.height/height}:{})};
}
function nudgeSelectionState(base,items,dx,dy,geometry,next=copy(base)){
  const width=geometry.width,height=geometry.height,overlaySpace=overlayEditingSpace(geometry),round=value=>Math.round(value*1e9)/1e9;
  let minX=-Infinity,maxX=Infinity,minY=-Infinity,maxY=Infinity;
  const movable=items.filter(item=>{
    if(item.locked)return false;
    if(item.kind==='guide')return base.alignmentGuides?.some(g=>g.id===item.id);
    if(item.kind==='overlay'){const a=base.overlays?.find(a=>a.id===item.id);return a&&!a.locked;}
    const p=base.panels[item.id];return p&&!p.locked&&(item.kind==='label'?!!p.label:p.variant===item.vi&&!p.lockedElements?.[item.vi]?.includes(item.key));
  });
  for(const item of movable){
    if(item.kind==='overlay'){const a=base.overlays?.find(a=>a.id===item.id);if(!a)continue;minX=Math.max(minX,-a.x*overlaySpace.width);maxX=Math.min(maxX,(1-a.x-a.w)*overlaySpace.width);minY=Math.max(minY,-a.y*overlaySpace.height);maxY=Math.min(maxY,(1-a.y-a.h)*overlaySpace.height);}
    if(item.kind==='label'){const label=base.panels[item.id]?.label,cell=geometry.positions.find(p=>p.id===item.id),pos=cell?.renderBox||cell;if(!label||!pos)continue;minX=Math.max(minX,-label.x/100*pos.width);maxX=Math.min(maxX,(100-label.x)/100*pos.width);minY=Math.max(minY,-label.y/100*pos.height);maxY=Math.min(maxY,(100-label.y)/100*pos.height);}
    if(item.kind==='element'){const old=base.panels[item.id]?.edits[item.vi]?.[item.key]||{};minX=Math.max(minX,-14400-(+old['offset-x']||0));maxX=Math.min(maxX,14400-(+old['offset-x']||0));minY=Math.max(minY,-14400-(+old['offset-y']||0));maxY=Math.min(maxY,14400-(+old['offset-y']||0));}
    if(item.kind==='guide'){const guide=base.alignmentGuides?.find(g=>g.id===item.id);if(!guide)continue;if(guide.axis==='x'){minX=Math.max(minX,-guide.position);maxX=Math.min(maxX,width-guide.position);}else{minY=Math.max(minY,-guide.position);maxY=Math.min(maxY,height-guide.position);}}
  }
  dx=round(Math.max(minX,Math.min(maxX,dx)));dy=round(Math.max(minY,Math.min(maxY,dy)));
  for(const item of movable){
    if(item.kind==='element'){const p=base.panels[item.id];if(!p||p.variant!==item.vi||p.lockedElements?.[item.vi]?.includes(item.key))continue;const old=p.edits[item.vi]?.[item.key]||{},edits=next.panels[item.id].edits;edits[item.vi]||={};const value={...old};for(const [key,delta]of [['offset-x',dx],['offset-y',dy]]){if(delta)value[key]=String(round((+old[key]||0)+delta));else if(!Object.hasOwn(old,key))delete value[key];}if(Object.keys(value).length)edits[item.vi][item.key]=value;else delete edits[item.vi][item.key];if(!Object.keys(edits[item.vi]).length&&!p.edits[item.vi])delete edits[item.vi];}
    else if(item.kind==='overlay'){const old=base.overlays?.find(a=>a.id===item.id),a=next.overlays?.find(a=>a.id===item.id);if(a&&old){a.x=dx?round(old.x+dx/overlaySpace.width):old.x;a.y=dy?round(old.y+dy/overlaySpace.height):old.y;}}
    else if(item.kind==='label'){const old=base.panels[item.id]?.label,label=next.panels[item.id]?.label,cell=geometry.positions.find(p=>p.id===item.id),pos=cell?.renderBox||cell;if(old&&label&&pos){label.x=dx?round(old.x+dx/pos.width*100):old.x;label.y=dy?round(old.y+dy/pos.height*100):old.y;}}
    else if(item.kind==='guide'){const old=base.alignmentGuides?.find(g=>g.id===item.id),guide=next.alignmentGuides?.find(g=>g.id===item.id),delta=guide?.axis==='x'?dx:dy;if(old&&guide)guide.position=delta?round(old.position+delta):old.position;}
  }
  return {next,dx,dy};
}
function gridFor(s) {
  return s.grid || {rows:Math.ceil(s.order.length/s.columns),places:Object.fromEntries(s.order.map((id,i)=>[id,{row:Math.floor(i/s.columns),col:i%s.columns,rs:1,cs:1}]))};
}
function arrange(s,rows,columns,kind='regular',spans={}) {
  const next=copy(s);next.columns=columns;next.grid={rows,places:{}};
  const occupied=new Set();
  for(const [i,id] of next.order.entries()){
    const span=spans[id] || (i===0?({wide:[1,2],tall:[2,1],hero:[2,2]}[kind]||[1,1]):[1,1]);
    const [rs,cs]=span;let found=false;
    for(let r=0;r+rs<=rows&&!found;r++)for(let c=0;c+cs<=columns&&!found;c++){
      const keys=[];for(let y=r;y<r+rs;y++)for(let x=c;x<c+cs;x++)keys.push(y+':'+x);
      if(keys.every(k=>!occupied.has(k))){keys.forEach(k=>occupied.add(k));next.grid.places[id]={row:r,col:c,rs,cs};found=true;}
    }
    if(!found)throw Error('母版位置不足，请增加行列或减小跨格范围');
  }
  return next;
}
function movePanel(s,id,row,col) {
  const next=copy(s);next.grid=copy(gridFor(s));const places=next.grid.places,from=copy(places[id]);
  if(row>=from.row&&row<from.row+from.rs&&col>=from.col&&col<from.col+from.cs)return next;
  const other=next.order.find(x=>x!==id&&row>=places[x].row&&row<places[x].row+places[x].rs&&col>=places[x].col&&col<places[x].col+places[x].cs);
  if(other){places[id]=copy(places[other]);places[other]=from;}else places[id]={...from,row,col};
  next.order.sort((a,b)=>places[a].row-places[b].row||places[a].col-places[b].col);
  return next;
}
// Resize the chosen slot first; preserve unaffected placements and repack displaced panels.
function resizePanel(s,id,rs,cs){
  if(s.panels[id].locked)throw Error('小图已锁定');
  const next=copy(s),g=gridFor(s);next.grid={rows:g.rows,places:{}};
  if(!Number.isInteger(rs)||!Number.isInteger(cs)||rs<1||cs<1||rs>g.rows||cs>s.columns)throw Error('小图超出母版');
  const occupied=new Set(),fits=p=>p.row>=0&&p.col>=0&&p.row+p.rs<=g.rows&&p.col+p.cs<=s.columns&&Array.from({length:p.rs},(_,r)=>Array.from({length:p.cs},(_,c)=>(p.row+r)+':'+(p.col+c))).flat().every(k=>!occupied.has(k));
  const put=(key,p)=>{next.grid.places[key]=copy(p);for(let r=p.row;r<p.row+p.rs;r++)for(let c=p.col;c<p.col+p.cs;c++)occupied.add(r+':'+c);};
  put(id,{row:Math.min(g.places[id].row,g.rows-rs),col:Math.min(g.places[id].col,s.columns-cs),rs,cs});
  const pending=[];
  for(const key of s.order)if(key!==id){if(fits(g.places[key]))put(key,g.places[key]);else pending.push(key);}
  for(const key of pending){const p=g.places[key];let found=false;for(let row=0;row<g.rows&&!found;row++)for(let col=0;col<s.columns&&!found;col++){const slot={...p,row,col};if(fits(slot)){put(key,slot);found=true;}}if(!found)throw Error('母版位置不足，请增加行列或减小跨格范围');}
  next.order.sort((a,b)=>next.grid.places[a].row-next.grid.places[b].row||next.grid.places[a].col-next.grid.places[b].col);
  return next;
}
function comparisonLetters(count,comparisons,alpha=.05){
  const matrix=Array.from({length:count},()=>Array(count).fill(null));
  for(const c of comparisons){if(!Number.isInteger(c.a)||!Number.isInteger(c.b)||c.a<0||c.b<0||c.a>=count||c.b>=count||c.a===c.b||!Number.isFinite(c.p)||c.p<0||c.p>1)throw Error('比较结果无效');if(matrix[c.a][c.b]!==null)throw Error('比较结果无效');matrix[c.a][c.b]=matrix[c.b][c.a]=c.p;}
  if(count>10||count<2)throw Error('字母分组需要完整两两比较');
  for(let a=0;a<count;a++)for(let b=a+1;b<count;b++)if(matrix[a][b]===null)throw Error('字母分组需要完整两两比较');
  const cliques=[];for(let mask=1;mask<(1<<count);mask++){const members=Array.from({length:count},(_,i)=>i).filter(i=>mask&(1<<i));if(members.every(a=>members.every(b=>a===b||matrix[a][b]>=alpha)))cliques.push(mask);}
  const maximal=cliques.filter(mask=>!cliques.some(other=>other!==mask&&(other&mask)===mask));
  return Array.from({length:count},(_,i)=>maximal.map((mask,k)=>mask&(1<<i)?String.fromCharCode(97+k%26)+(k>=26?Math.floor(k/26):''):'').join(''));
}
function statisticalComparisons(analysis={},panelState={}){
  analysis=analysis||{};
  const order=analysis.group_order||[],key=panelState.methodChoice?.key||'primary_test',test=analysis[key];
  if(!Array.isArray(order)||order.length<2||new Set(order).size!==order.length)return {order:[],comparisons:[],reason:'需要分组顺序与已计算的组间比较结果。'};
  const supplied=Array.isArray(test?.pairwise)?test.pairwise:key==='primary_test'&&Array.isArray(analysis.pairwise)?analysis.pairwise:null;
  const comparisons=supplied?supplied.map(c=>({...c})):order.length===2&&Number.isFinite(test?.p_value)?[{a:0,b:1,p:test.p_value}]:[];
  const seen=new Set();
  for(const c of comparisons){const pair=[c.a,c.b].sort((a,b)=>a-b).join(':');if(!Number.isInteger(c.a)||!Number.isInteger(c.b)||c.a<0||c.b<0||c.a>=order.length||c.b>=order.length||c.a===c.b||!Number.isFinite(c.p)||c.p<0||c.p>1||seen.has(pair))return {order,comparisons:[],reason:'比较结果无效：请核对组别索引、重复比较和 P 值。'};seen.add(pair);}
  if(!comparisons.length)return {order,comparisons,reason:'需要已计算的组间比较结果；总体检验 P 值不能替代两两比较。'};
  let letters=false;try{comparisonLetters(order.length,comparisons);letters=true;}catch{}
  const letterReason=order.length>10?'超过 10 组时请选择连线标注。':'字母分组需要完整两两比较。';
  return {order,comparisons,letters,letterReason,reason:'',method:supplied?(test?.pairwise_method||analysis.pairwise_method||test?.name||''):(test?.name||''),zero:comparisons.some(c=>c.p===0)};
}
function statisticsDataProfile(rows=[],mapping={}){
  const header=rows[0]||[],body=rows.slice(1),names=header.map(name=>String(name).trim().toLowerCase()),named=aliases=>header[names.findIndex(name=>aliases.includes(name))]||'';
  const numeric=name=>{const i=header.indexOf(name);return i>=0&&body.length>0&&body.every(row=>String(row[i]??'').trim()!==''&&Number.isFinite(Number(row[i])));};
  const group=mapping.group||named(['group','condition','treatment','组别','分组','处理']),unit=mapping.unit||named(['unit','subject','subject_id','patient','patient_id','sample','sample_id','id','编号','样本编号','实验单位']);
  const candidates=header.filter(name=>name!==group&&name!==unit&&numeric(name)),preferred=named(['value','response','measurement','outcome','数值','测量值']);
  const value=mapping.value||(preferred||(candidates.length===1?candidates[0]:'')),vi=header.indexOf(value),gi=header.indexOf(group),ui=header.indexOf(unit),values=vi<0?[]:body.map(row=>row[vi]),numbers=values.map(Number),validNumeric=!!value&&numeric(value),unique=[...new Set(values.map(String))];
  const nonempty=values.filter(v=>String(v??'').trim()!==''),kind=validNumeric?(unique.length===2&&numbers.every(n=>n===0||n===1)?'binary':numbers.some(n=>!Number.isInteger(n))?'continuous':''):value&&nonempty.length&&nonempty.every(v=>!Number.isFinite(Number(v)))?'categorical':'';
  const groups=gi<0?[]:[...new Set(body.map(row=>String(row[gi]??'').trim()).filter(Boolean))],units=ui<0?[]:body.map(row=>String(row[ui]??'').trim());
  return {group,value,unit,kind,validNumeric,rows:body.length,groups,missingValues:values.filter(v=>String(v??'').trim()==='').length,unitCount:new Set(units.filter(Boolean)).size,candidates};
}
function statisticsMethodChoices(design,goal='mean',kind='continuous'){
  if(!['independent','paired'].includes(design)||!['continuous','ordinal'].includes(kind)||kind==='ordinal'&&design==='paired')return [];
  let choices=design==='independent'?['welch','mannwhitney']:['paired_t','wilcoxon'];
  if(kind==='ordinal')return ['mannwhitney'];
  if(goal==='distribution')choices.reverse();return choices;
}
function validateStatistics(value){
  if(!value||typeof value!=='object'||!['current','external','results'].includes(value.binding)||typeof value.tableKey!=='string'||value.tableKey.length>128||!value.config||typeof value.config!=='object'||JSON.stringify(value.config).length>16000)throw Error('统计分析记录无效');
  if(value.stale!==undefined&&typeof value.stale!=='boolean')throw Error('统计分析记录无效');
  if(value.analysis){const sets=value.analysis.facets||[value.analysis];if(!Array.isArray(sets)||!sets.length||sets.length>24||sets.some(set=>statisticalComparisons(set).reason))throw Error('统计分析记录无效');}
  else if(!value.stale)throw Error('统计分析记录无效');
  if(value.inputRows&&(!Array.isArray(value.inputRows)||value.inputRows.length>10001||value.inputRows.some(row=>!Array.isArray(row)||row.length>100||row.some(cell=>typeof cell!=='string'||cell.length>1000))))throw Error('统计分析记录无效');
  return true;
}
function statisticalPText(p,mode='standard'){
  if(!Number.isFinite(p)||p<0||p>1)throw Error('比较结果无效');
  // Preserve zero as supplied. Its reporting limit cannot be inferred from a rounded zero.
  if(p===0)return ' = 0';
  if(mode!=='precise')return p<.001?' < 0.001':' = '+p.toFixed(3);
  const value=p<.001?p.toExponential(2):p.toPrecision(3),parts=value.split('e');
  if(parts.length===1)return ' = '+value;
  const superscripts={'-':'⁻','+':'','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  return ' = '+parts[0]+' × 10'+String(Number(parts[1])).split('').map(c=>superscripts[c]).join('');
}
function statisticalSymbol(p,style='stars'){
  if(!Number.isFinite(p)||p<0||p>1)throw Error('比较结果无效');
  const n=p<.0001?4:p<.001?3:p<.01?2:p<.05?1:0;return n?(style==='hash'?'#':'*').repeat(n):'ns';
}
function statisticalLabelPlan(value,style,width,fontSize,measure=null,format='standard'){
  const measureText=measure||((text)=>Array.from(String(text)).reduce((n,c)=>n+(/\s/.test(c)?.32:/[\u2e80-\uffff]/.test(c)?1:/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]/.test(c)?.45:/[il.,]/.test(c)?.3:/[MW@]/.test(c)?.95:.66),0)*fontSize);
  const formatted=style==='p'?statisticalPText(value,format):'',full=style==='p'?'P'+formatted:style==='letters'?String(value):statisticalSymbol(value,style),candidates=[[full]];
  if(style==='p'){
    const numeric=formatted.replace(/^ [=<] /,''),operator=formatted.includes('<')?'<':'=';candidates.push(['P '+operator,numeric]);
    if(format==='precise'&&value>0){const [mantissa,exponent]=value.toExponential(2).split('e'),superscript={'-':'⁻','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'},power='× 10'+String(Number(exponent)).split('').map(c=>superscript[c]||c).join('');candidates.push(['P = '+mantissa,power],['P =',mantissa,power]);}
  }
  const widths=candidates.map(lines=>Math.max(...lines.map(line=>measureText(line)))),index=widths.findIndex(n=>n<=width+.01),chosen=index>=0?index:widths.indexOf(Math.min(...widths));
  return {lines:candidates[chosen],width:widths[chosen],fits:index>=0};
}
let statisticalMeasureContext;
function statisticalTextWidth(text,font,size,bold=false,italic=false){
  try{statisticalMeasureContext??=document.createElement('canvas').getContext?.('2d');if(statisticalMeasureContext){statisticalMeasureContext.font=`${italic?'italic ':''}${bold?'700 ':''}${size}px "${font}"`;return statisticalMeasureContext.measureText(text).width;}}catch{}
  return statisticalLabelPlan(text,'letters',Infinity,size).width*(bold?1.08:1)*(italic?1.04:1);
}
function statisticalBracketPath(x1,x2,y,unit=1,shape='bracket'){
  const left=Math.min(x1,x2),right=Math.max(x1,x2),tip=3*unit,r=Math.min(2*unit,(right-left)/4);
  if(shape==='line')return `M ${left} ${y} H ${right}`;
  if(shape==='rounded')return `M ${left} ${y+tip} V ${y+r} Q ${left} ${y} ${left+r} ${y} H ${right-r} Q ${right} ${y} ${right} ${y+r} V ${y+tip}`;
  return `M ${left} ${y+tip} V ${y} H ${right} V ${y+tip}`;
}
function adjustedStatisticalBracket(left,right,y,unit,props={},shape='bracket'){
  const x1=Math.min(left,right)-Number(props['stat-left']||0)*unit,x2=Math.max(left,right)+Number(props['stat-right']||0)*unit;
  const center=(x1+x2)/2,span=Math.max(2*unit,x2-x1);
  return statisticalBracketPath(center-span/2,center+span/2,y,unit,props['stat-shape']||shape);
}
function statisticalLayout(style,count,panelState={},typography={},unit=1,vi=panelState.variant){
  const baseSize=Number(panelState.annotationFont?.size||typography?.size||9);
  const overrides=Object.entries(panelState.edits?.[vi]||{}).filter(([key,props])=>/^e9\d{5,}$/.test(key)&&props.hidden!=='true').map(([,props])=>Number(props['font-size'])/unit).filter(n=>Number.isFinite(n)&&n>0);
  const fontSize=Math.max(baseSize,...overrides),pitch=Math.max(20,fontSize*1.35+8),labelGap=Math.max(3,fontSize*.25),firstGap=Math.max(12,fontSize*.3),letterGap=Math.max(8,fontSize*.4);
  const header=!style||count<1?0:style==='letters'?letterGap+fontSize+6:firstGap+(count-1)*pitch+labelGap+fontSize+6;
  return {fontSize,pitch,labelGap,firstGap,letterGap,header};
}
function statisticalBandLayout(info,style,width,panelState={},typography={},unit=1,vi=panelState.variant){
  const fontSize=statisticalLayout(style,Math.max(1,info.comparisons?.length||0),panelState,typography,unit,vi).fontSize;
  const pad=12,inner=Math.max(24,width-pad*2),lineHeight=fontSize*1.4,titleSize=fontSize,rows=[];
  // Conservative font metrics keep this deterministic in previews, exports and tests.
  // Wrap labels without truncating group names, values or mathematical exponents.
  const measure=(text,bold=!!panelState.annotationFont?.bold)=>statisticalTextWidth(text,panelState.annotationFont?.font||typography?.font||'Arial',fontSize,bold,!!panelState.annotationFont?.italic);
  const wrap=(text,limit,bold=!!panelState.annotationFont?.bold)=>{const lines=[];let line='';for(const token of String(text).split(/(\s+)/)){if(!token)continue;if(measure(line+token,bold)<=limit){line+=token;continue;}if(line.trim())lines.push(line.trim());line='';for(const c of token){if(line&&measure(line+c,bold)>limit){lines.push(line);line='';}line+=c;}}if(line.trim()||!lines.length)lines.push(line.trim());return lines;};
  const titleLines=wrap(info.bandTitle||'Panel comparisons',inner,true);
  let y=12+titleLines.length*lineHeight+8;
  const sets=info.sets||[info];
  for(const set of sets){
    if(set.label){const lines=wrap(set.label,inner,true),height=lines.length*lineHeight+8;rows.push({kind:'facet',labelLines:lines,resultLines:[],y,height});y+=height;}
    if(!set.comparisons?.length){const labelLines=wrap(info.noticeText||'No valid comparison results',inner),height=labelLines.length*lineHeight+8;rows.push({kind:'notice',labelLines,resultLines:[],reason:set.reason,y,height});y+=height;continue;}
    const letters=style==='letters'?comparisonLetters(set.order.length,set.comparisons):null;
    const entries=letters?set.order.map((label,i)=>({label:String(label),result:letters[i],isP:false,group:i})):set.comparisons.map(c=>({label:String(set.order[c.a])+'  —  '+String(set.order[c.b]),result:style==='p'?'P'+statisticalPText(c.p,panelState.annotationPFormat):statisticalSymbol(c.p,style),isP:style==='p',comparison:{a:c.a,b:c.b,p:c.p}}));
    const resultWidth=Math.max(40,...entries.map(entry=>measure(entry.result)+8)),sideBySide=resultWidth<=inner*.48,labelWidth=sideBySide?inner-resultWidth-16:inner;
    for(const entry of entries){const labelLines=wrap(entry.label,labelWidth),resultLines=entry.isP?statisticalLabelPlan(entry.comparison.p,'p',sideBySide?resultWidth:inner,fontSize,measure,panelState.annotationPFormat).lines:wrap(entry.result,sideBySide?resultWidth:inner),bodyLines=sideBySide?Math.max(labelLines.length,resultLines.length):labelLines.length+resultLines.length,height=bodyLines*lineHeight+12+(letters?0:8);
      rows.push({kind:letters?'letters':'comparison',...entry,labelLines,resultLines,sideBySide,resultX:sideBySide?width-pad-resultWidth:pad,y,height,lineHeight});y+=height;
    }
  }
  return {height:Math.ceil(y+6),fontSize,titleSize,titleLines,lineHeight,pad,rows};
}
function statisticalMethodName(name){return ({
  'Welch two-sample t-test; Holm-adjusted pairwise comparisons':'Welch t 检验（Holm 校正）','Paired t-test; Holm-adjusted pairwise comparisons':'配对 t 检验（Holm 校正）','Mann–Whitney U distribution test; Holm-adjusted pairwise comparisons':'Mann–Whitney U 检验（Holm 校正）','Wilcoxon signed-rank test; Holm-adjusted pairwise comparisons':'Wilcoxon 符号秩检验（Holm 校正）','Welch two-sample t-test':'Welch 两独立样本 t 检验','Paired t-test':'配对 t 检验',
  'Mann-Whitney U rank/distribution test':'Mann–Whitney U 秩检验','Wilcoxon signed-rank test':'Wilcoxon 符号秩检验',
  'Welch one-way ANOVA':'Welch 单因素方差分析','Kruskal-Wallis rank/distribution test':'Kruskal–Wallis 秩检验',
  'Welch t-tests with Holm correction':'Welch t 检验（Holm 校正）','Holm':'Holm 校正'
})[name]||name||'';}
function methodOrder(analysis,goal='mean'){
  const keys=['primary_test','sensitivity_test'].filter(k=>analysis[k]&&Number.isFinite(analysis[k].p_value));
  return goal==='distribution'?keys.reverse():keys;
}
function insertTracks(s,axis,index,count=1,metrics=null){
  const next=copy(s),grid=copy(gridFor(s)),isRow=axis==='row';
  if(!['row','column'].includes(axis))throw Error('插入方向无效');
  const length=isRow?grid.rows:s.columns,limit=isRow?24:6;
  if(!Number.isInteger(index)||index<0||index>length||!Number.isInteger(count)||count<1||length+count>limit)throw Error('插入数量超出当前母版容量');
  const start=isRow?'row':'col',span=isRow?'rs':'cs';
  for(const id of next.order){const p=grid.places[id],before=JSON.stringify(p);if(p[start]>=index)p[start]+=count;else if(p[start]+p[span]>index)p[span]+=count;if(s.panels[id].locked&&JSON.stringify(p)!==before)throw Error('插入会移动或扩展已锁定小图，请先解锁');}
  if(metrics){grid.widths=copy(metrics.widths);grid.heights=copy(metrics.heights);}
  const track=isRow?'heights':'widths';if(grid[track]){const size=grid[track][Math.min(index,grid[track].length-1)];grid[track].splice(index,0,...Array(count).fill(size));}
  if(isRow)grid.rows+=count;else next.columns+=count;next.grid=grid;return next;
}
function exportGeometry(widthPt,heightPt,settings){
  const widthMm=settings?.widthMm||widthPt*25.4/72,dpi=settings?.dpi||600,scale=widthMm/(widthPt*25.4/72),heightMm=heightPt*25.4/72*scale;
  return {widthMm,heightMm,dpi,scale,widthPt:widthPt*scale,heightPt:heightPt*scale,widthPx:Math.round(widthMm/25.4*dpi),heightPx:Math.round(heightMm/25.4*dpi)};
}
function pngWithDpi(bytes,dpi){
  const read=(a,i)=>((a[i]*0x1000000)+(a[i+1]<<16)+(a[i+2]<<8)+a[i+3])>>>0;
  const put=(a,i,n)=>{a[i]=n>>>24;a[i+1]=(n>>>16)&255;a[i+2]=(n>>>8)&255;a[i+3]=n&255;};
  if(bytes.length<33||bytes[0]!==137||String.fromCharCode(...bytes.slice(1,4))!=='PNG')throw Error('PNG data invalid');
  const chunk=new Uint8Array(21);put(chunk,0,9);chunk.set([112,72,89,115],4);const ppm=Math.round(dpi/0.0254);put(chunk,8,ppm);put(chunk,12,ppm);chunk[16]=1;
  let crc=0xffffffff;for(const b of chunk.slice(4,17)){crc^=b;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}put(chunk,17,(crc^0xffffffff)>>>0);
  const parts=[bytes.slice(0,8)];for(let i=8;i<bytes.length;){const end=i+read(bytes,i)+12;if(end>bytes.length)throw Error('PNG data invalid');const type=String.fromCharCode(...bytes.slice(i+4,i+8));if(type!=='pHYs')parts.push(bytes.slice(i,end));if(type==='IHDR')parts.push(chunk);i=end;}
  const result=new Uint8Array(parts.reduce((n,a)=>n+a.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
}
function dataTableValidation(rows,recipe={},contracts={}){
  const contract=contracts[recipe.parameters?.view],roles={relationship:['x','y','unit','group'],timecourse:['time','value','group','unit'],composition:['sample','category','value','group'],matrix:['row','column','value']},numericRoles={relationship:['x','y'],timecourse:['time','value'],composition:['value'],matrix:['value']};
  let required=[],numeric=[];
  if(recipe.family==='gallery'&&contract){required=contract.required||[];numeric=contract.numeric||[];}
  else if(recipe.family==='roc'){required=['outcome','score','unit','cohort'].map(key=>recipe.parameters?.[key]).filter(Boolean);numeric=[recipe.parameters?.score].filter(Boolean);}
  else if(roles[recipe.family]){required=roles[recipe.family].map(key=>recipe[key]).filter(Boolean);numeric=numericRoles[recipe.family].map(key=>recipe[key]).filter(Boolean);}
  else if(recipe.group&&recipe.value){required=[recipe.group,recipe.value,recipe.subject].filter(Boolean);numeric=[recipe.value];}
  const errors=[],add=(row,column,code,name='')=>errors.push({row,column,code,name}),header=rows?.[0]||[],body=rows?.slice(1)||[],numbers=new Set(numeric),needed=new Set(required);
  if(!Array.isArray(rows)||!header.length||!body.length)add(-1,-1,'empty');
  if(header.length>100||body.length>10000)add(-1,-1,'size');
  header.forEach((name,column)=>{if(!String(name??'').trim())add(0,column,'header');else if(header.indexOf(name)!==column||header.lastIndexOf(name)!==column)add(0,column,'duplicate',name);});
  for(const name of needed)if(!header.includes(name))add(0,-1,'column',name);
  for(let i=0;i<body.length;i++){
    const row=body[i];if(!Array.isArray(row)){add(i+1,-1,'shape');continue;}
    if(row.length>header.length)for(let c=header.length;c<row.length;c++)add(i+1,c,'extra');
    for(let c=0;c<header.length;c++){
      const text=String(row[c]??''),name=header[c];
      if(text.length>1000){add(i+1,c,'length',name);continue;}
      if(!text.trim()){if(needed.has(name)||c>=row.length)add(i+1,c,'missing',name);continue;}
      if(numbers.has(name)&&(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim())||!Number.isFinite(Number(text))))add(i+1,c,'number',name);
    }
  }
  return {valid:!errors.length,errors,required,numeric,rows:body.length};
}
function parseDelimited(text,delimiter=',',allowRagged=false,minRows=2){
  const rows=[];let row=[],cell='',quoted=false;text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else throw Error('Invalid quote in table');}
    else if(!quoted&&ch===delimiter){row.push(cell);cell='';}else if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=ch;}
  if(quoted)throw Error('Unclosed quote in table');if(cell||row.length){row.push(cell);rows.push(row);}if(rows.length<minRows||!allowRagged&&rows.some(r=>r.length!==rows[0].length))throw Error('Table needs a header and consistent columns');return rows;
}
// Append-only assets make replacement and insertion undoable without duplicating image bytes.
function installPanelState(s,oldId,newId,initialVariant,cell){
  const next=copy(s);next.grid=copy(gridFor(s));
  if(oldId){if(s.panels[oldId].locked)throw Error('小图已锁定');const old=s.panels[oldId];next.order=next.order.map(id=>id===oldId?newId:id);next.grid.places[newId]=next.grid.places[oldId];delete next.grid.places[oldId];delete next.panels[oldId];next.panels[newId]={variant:initialVariant,edits:{},...(old.label?{label:copy(old.label)}:{}),...(old.geometry?{geometry:copy(old.geometry)}:{}),...(old.groupSpacing?{groupSpacing:copy(old.groupSpacing)}:{}),...(old.heatmapLabels?{heatmapLabels:copy(old.heatmapLabels)}:{}),...(old.heatmapPalette?{heatmapPalette:copy(old.heatmapPalette)}:{})};if(next.panelGroups)next.panelGroups=next.panelGroups.map(g=>g.map(id=>id===oldId?newId:id));}
  else{if(next.order.length>=24)throw Error('最多同时放置 24 张小图');if(!cell)throw Error('请先选择一个空格');const g=next.grid;if(cell.row<0||cell.col<0||cell.row>=g.rows||cell.col>=next.columns||next.order.some(id=>{const p=g.places[id];return cell.row>=p.row&&cell.row<p.row+p.rs&&cell.col>=p.col&&cell.col<p.col+p.cs;}))throw Error('请选择空格导入图片');next.order.push(newId);next.grid.places[newId]={...cell,rs:1,cs:1};next.panels[newId]={variant:initialVariant,edits:{}};}
  return next;
}
// A facet split is one state transaction. Other panels keep their grid cells;
// new tracks are appended only when no existing horizontal run is available.
function splitPanelState(s,oldId,assets,metrics=null){
  const old=s.panels[oldId];if(!old||!s.order.includes(oldId))throw Error('目标已变化，请重新选择');if(old.locked)throw Error('小图已锁定');
  if(!Array.isArray(assets)||assets.length<2||assets.length>6||new Set(assets.map(asset=>asset.id)).size!==assets.length||assets.some(asset=>s.panels[asset.id]))throw Error('分面拆分结果无效');
  if(s.order.length-1+assets.length>24)throw Error('最多同时放置 24 张小图');
  const next=copy(s),g=copy(gridFor(s)),from=g.places[oldId],ids=assets.map(asset=>asset.id);next.grid=g;
  if(metrics){g.widths=copy(metrics.widths);g.heights=copy(metrics.heights);}
  if(next.columns<ids.length){if(g.widths)g.widths.push(...Array(ids.length-next.columns).fill(g.widths[from.col]));next.columns=ids.length;}
  const occupied=new Set();for(const id of s.order)if(id!==oldId){const p=g.places[id];for(let r=p.row;r<p.row+p.rs;r++)for(let c=p.col;c<p.col+p.cs;c++)occupied.add(r+':'+c);}
  let destination=null;const rows=[from.row,...Array.from({length:g.rows},(_,i)=>i).filter(row=>row!==from.row)];
  for(const row of rows){const columns=[Math.min(from.col,next.columns-ids.length),...Array.from({length:next.columns-ids.length+1},(_,i)=>i)];for(const col of columns)if(ids.every((_,i)=>!occupied.has(row+':'+(col+i)))){destination={row,col};break;}if(destination)break;}
  if(!destination){if(g.rows>=24)throw Error('母版位置不足，请增加行列或减小跨格范围');destination={row:g.rows,col:0};g.rows++;if(g.heights)g.heights.push(g.heights[from.row]);}
  next.order=next.order.flatMap(id=>id===oldId?ids:[id]);delete next.panels[oldId];delete g.places[oldId];
  const inherited=['geometry','groupSpacing','errorDirection','markStyle','annotationFont','annotationLine','annotationPFormat','showFacetTitles'];
  assets.forEach((asset,index)=>{const p={variant:asset.initialVariant||0,edits:{}};for(const key of inherited)if(old[key]!==undefined)p[key]=copy(old[key]);
    if(old.label)p.label={...copy(old.label),manual:index===0&&old.label.manual===true};
    if(asset.statistics){p.statistics=copy(asset.statistics);if(old.annotationStyle)p.annotationStyle=old.annotationStyle;}
    else if(asset.analysis?.primary_test&&old.annotationStyle)p.annotationStyle=old.annotationStyle;
    if(old.conditionMatrix){const order=asset.statistics?.analysis?.group_order||asset.analysis?.group_order||asset.table?.rows?.slice(1).map(row=>row[asset.table.rows[0].indexOf('group')]).filter(value=>value!==undefined)||[],groups=[...new Set(order.map(String))];if(groups.length&&groups.some(group=>old.conditionMatrix.groups.includes(group)))p.conditionMatrix={...copy(old.conditionMatrix),groups,rows:old.conditionMatrix.rows.map(row=>({label:row.label,values:Object.fromEntries(groups.filter(group=>Object.hasOwn(row.values,group)).map(group=>[group,row.values[group]]))}))};}
    next.panels[asset.id]=p;g.places[asset.id]={row:destination.row,col:destination.col+index,rs:1,cs:1};
  });
  next.order.sort((a,b)=>g.places[a].row-g.places[b].row||g.places[a].col-g.places[b].col);
  for(const id of ids){const p=next.panels[id];if(p.label&&!p.label.manual)p.label.text=panelLabelText(visualPanelOrder(next).indexOf(id),panelNumberStyle(next)||'upper');}
  if(next.panelGroups)next.panelGroups=next.panelGroups.map(group=>group.flatMap(id=>id===oldId?ids:[id]));
  return next;
}
// Hit tolerance is measured in screen pixels, independent of figure zoom or DPI.
function marqueeHit(rect,box,isText=false){
  if(![rect.left,rect.right,rect.top,rect.bottom,box.left,box.right,box.top,box.bottom].every(Number.isFinite))return false;
  const t=isText?2:1,w=box.right-box.left,h=box.bottom-box.top;
  if(w<0||h<0||(!w&&!h))return false;
  if(isText)return (box.left+box.right)/2>=rect.left-t&&(box.left+box.right)/2<=rect.right+t&&(box.top+box.bottom)/2>=rect.top-t&&(box.top+box.bottom)/2<=rect.bottom+t;
  return box.left>=rect.left-t&&box.right<=rect.right+t&&box.top>=rect.top-t&&box.bottom<=rect.bottom+t;
}
// SVG artist numbers and document-order keys change with canvas size.
// Match semantic ancestry instead; ticks are identified by their displayed value.
function svgElementSignature(el){
  const parts=[],generic=/^(text|patch|line2d|PathCollection|PolyCollection|LineCollection|QuadMesh|image)_\d+$/;
  for(let node=el;node&&node.localName!=='svg';node=node.parentElement){
    if(node.localName==='defs'||node.localName==='clipPath')return null;
    const id=node.id||'',tick=id.match(/^([xy])tick_\d+$/);
    if(tick){
      const text=node.querySelector('text');if(!text)return null;
      const label=text.textContent.replace(/\s+/g,'').replace(/\u2212/g,'-');
      const value=label!==''&&Number.isFinite(Number(label))?String(Number(label)):label;
      parts.unshift(tick[1]+'tick:'+JSON.stringify(value));
    }else if(/^matplotlib\.axis_\d+$/.test(id)){
      const axis=node.querySelector('[id^="xtick_"]')?'x':node.querySelector('[id^="ytick_"]')?'y':String(Number(id.split('_').pop())%2?'x':'y');
      parts.unshift('axis:'+axis);
    }else if(/^studio-heat-(?:value|cell)-/.test(id))parts.unshift(id.split('-').slice(0,4).join('-'));
    else if(id&&!generic.test(id))parts.unshift(id);
    else{
      const family=generic.test(id)?id.replace(/_\d+$/,''):'';
      const siblings=[...(node.parentElement?.children||[])].filter(other=>other.localName===node.localName&&(family?other.id?.replace(/_\d+$/,'')===family:!generic.test(other.id||'')));
      parts.unshift(node.localName+(family?':'+family:'')+':'+siblings.indexOf(node));
    }
  }
  return parts.join('/');
}
function svgElementMap(source,target){
  const index=root=>{const map=new Map();for(const el of root.querySelectorAll('[data-key]')){const signature=svgElementSignature(el);if(signature!==null){if(map.has(signature))map.set(signature,null);else map.set(signature,el.getAttribute('data-key'));}}return map;};
  const from=index(source),to=index(target),mapping=new Map();
  for(const [signature,key]of from){const match=to.get(signature);if(key&&match)mapping.set(key,match);}
  return mapping;
}
// Data replacement may change artist numbers, ticks and statistical values.
// Retain manual wording only for unchanged, unambiguous descriptive text.
function stableTextEditSignature(el){
  if(!['text','tspan'].includes(el.localName))return null;
  let text=el;while(text&&text.localName!=='text')text=text.parentElement;if(!text)return null;
  const ancestors=[];for(let node=text;node&&node.localName!=='svg';node=node.parentElement)ancestors.push(node);
  if(ancestors.some(node=>/^(?:studio-heat-(?:value|cell)-|studio-stat)/.test(node.id||'')||node.getAttribute('data-stat-result')!==null||node.getAttribute('data-condition-cell')!==null))return null;
  const raw=text.textContent,plain=raw.trim(),tick=ancestors.find(node=>/^[xy]tick_\d+$/.test(node.id||'')),axis=ancestors.find(node=>/^matplotlib\.axis_\d+$/.test(node.id||'')),legend=ancestors.find(node=>/^legend_\d+$/.test(node.id||''));
  if(!plain)return null;
  let owner,role;
  if(legend){
    // Result-bearing legends are regenerated from data, even when rounding
    // happens to leave the original displayed number unchanged.
    if(/(?:\b(?:AUC|CI|SD|SEM|HR|OR|RR|NES)\b|\b[PpNnrtFz]\s*[=<>≤≥]|[=<>≤≥]|\d\s*%)/.test(plain))return null;
    owner=legend;role='legend';
  }else if(tick){
    if(/^[+\-\u2212]?(?:\d|\.\d)/.test(plain)||!/[A-Za-z\u0370-\u03ff\u3400-\u9fff]/.test(plain))return null;
    owner=axis;role='category';
  }else if(axis){
    if(/\d\s*%/.test(plain)||Number.isFinite(Number(plain.replace(/\u2212/g,'-')))||!/[A-Za-z\u0370-\u03ff\u3400-\u9fff]/.test(plain))return null;
    owner=axis;role='axis-title';
  }else return null;
  if(!owner)return null;
  const path=[];for(let node=el;node!==text;node=node.parentElement)path.unshift([...node.parentElement.children].indexOf(node));
  return JSON.stringify([svgElementSignature(owner),role,raw,path,el.textContent]);
}
function migrateStableTextEdits(source,target,edits,sourceVariant,targetVariant){
  const index=root=>{const result=new Map();for(const el of root.querySelectorAll('[data-key]')){const signature=stableTextEditSignature(el);if(signature!==null)result.set(signature,result.has(signature)?null:el.getAttribute('data-key'));}return result;};
  const from=index(source),to=index(target),result={},ratio=(targetVariant.viewBox[2]/targetVariant.width)/(sourceVariant.viewBox[2]/sourceVariant.width);
  for(const [signature,key]of from){const destination=to.get(signature),props=key&&edits?.[key];if(!destination||!props)continue;
    for(const [prop,value]of Object.entries(props)){const adjusted=['font-size','stroke-width'].includes(prop)?String(+value*ratio):value;if(EDIT_KEYS.has(prop)&&validValue(prop,adjusted)){result[destination]??={};result[destination][prop]=adjusted;}}
  }
  return result;
}
function transferVariantEdits(panelState,from,to,mapping,sourceVariant,targetVariant){
  if(from===to)return copy(panelState);
  const next=copy(panelState),source=next.edits[from]||{},edits={...(next.edits[to]||{})};
  const unitRatio=(targetVariant.viewBox[2]/targetVariant.width)/(sourceVariant.viewBox[2]/sourceVariant.width);
  const destinations=new Set(mapping.values());
  for(const [key,destination]of mapping){
    delete edits[destination];
    if(source[key]){
      edits[destination]=copy(source[key]);
      for(const prop of ['font-size','stroke-width'])if(prop in edits[destination])edits[destination][prop]=String(+edits[destination][prop]*unitRatio);
      // Offsets are already stored in physical pt; do not scale with the canvas.
    }
  }
  next.edits[to]=edits;
  if(next.lockedElements){
    const retained=(next.lockedElements[to]||[]).filter(key=>!destinations.has(key));
    next.lockedElements[to]=[...new Set([...retained,...(next.lockedElements[from]||[]).map(key=>mapping.get(key)).filter(Boolean)])];
  }
  if(next.elementGroups){
    const retained=(next.elementGroups[to]||[]).filter(group=>!group.some(key=>destinations.has(key)));
    const groups=(next.elementGroups[from]||[]).map(group=>[...new Set(group.map(key=>mapping.get(key)).filter(Boolean))]).filter(group=>group.length>1);
    next.elementGroups[to]=[...retained,...groups];
  }
  if(next.scales){
    const scales={...(next.scales[to]||{})};for(const [key,destination]of mapping){delete scales[destination];if(next.scales[from]?.[key])scales[destination]=copy(next.scales[from][key]);}next.scales[to]=scales;
  }
  next.variant=to;return next;
}
// Preview-only zoom math: physical publication dimensions and source SVG stay intact.
function clampPreviewZoom(value){
  return Math.min(4,Math.max(.1,typeof value==='number'&&!Number.isNaN(value)?value:1));
}
function wheelPreviewZoom(current,delta,mode=0,pageHeight=800){
  if(!Number.isFinite(delta))return clampPreviewZoom(current);
  const unit=mode===1?16:mode===2?(Number.isFinite(pageHeight)&&pageHeight>0?pageHeight:800):1;
  return clampPreviewZoom(clampPreviewZoom(current)*Math.exp(-delta*unit*.002));
}
function zoomAnchorScroll({before,after,point,scrollLeft,scrollTop,scrollWidth,scrollHeight,viewportWidth,viewportHeight}){
  const axis=(start,extent,newStart,newExtent,pointer,scroll,total,visible)=>{
    if(![start,extent,newStart,newExtent,pointer,scroll,total,visible].every(Number.isFinite)||extent<=0||newExtent<=0)return 0;
    const requested=scroll+newStart+(pointer-start)/extent*newExtent-pointer;
    return Math.max(0,Math.min(Math.max(0,total-visible),requested));
  };
  return {
    left:axis(before.left,before.width,after.left,after.width,point.x,scrollLeft,scrollWidth,viewportWidth),
    top:axis(before.top,before.height,after.top,after.height,point.y,scrollTop,scrollHeight,viewportHeight)
  };
}
const SWATCH_SCHEMES=Object.freeze([
  {id:'research-red-blue',name:'科研红蓝',sequentialName:'科研蓝色阶',colors:['#3f6da3','#c95770','#93accb','#d2b6bb','#69758b','#263b58'],continuousStops:['#3f6da3','#f4f5f7','#c95770'],sequentialStops:['#f0f3f8','#3f6da3']},
  {id:'blue-copper',name:'蓝橙青',divergingName:'蓝橙',sequentialName:'琥珀色阶',colors:['#245a81','#d97732','#31918b','#a36691','#bba352','#65728b'],continuousStops:['#245a81','#f7f5f2','#c76b28'],sequentialStops:['#fff3dc','#98521f']},
  // Retain saved scheme IDs, but make the alternatives different hue families.
  {id:'soft-groups',name:'青绿珊瑚',sequentialName:'青绿色阶',colors:['#177f78','#d56459','#76558f','#d4a64b','#467bac','#798b64'],continuousStops:['#177f78','#f6f5ef','#c7544e'],sequentialStops:['#eaf5ed','#11675e']},
  {id:'slate-plum',name:'紫金',sequentialName:'紫罗兰色阶',colors:['#72549a','#c49b32','#4b8791','#bc6e8c','#6b7485','#96a66c'],continuousStops:['#72549a','#f7f5f0','#ae851c'],sequentialStops:['#f1edf8','#604087']},
  {id:'cool-tones',name:'海蓝色阶',kind:'sequential',colors:['#163f64','#32678c','#4f8cad','#78acc4','#a3cad9','#d4e7ec'],continuousStops:['#edf7fb','#5a9ab9','#163f64'],sequentialStops:['#edf7fb','#163f64']},
  {id:'warm-tones',name:'赤陶色阶',kind:'sequential',colors:['#7d342e','#a24e39','#c5714e','#dc9670','#eab996','#f3ddbe'],continuousStops:['#fff3e5','#ce825a','#7d342e'],sequentialStops:['#fff3e5','#7d342e']},
  {id:'neutral-gray',name:'墨色灰阶',kind:'sequential',colors:['#35383e','#595e66','#7c828a','#a0a5ad','#c2c6cc','#e0e3e8'],continuousStops:['#f3f4f6','#989da5','#35383e'],sequentialStops:['#f3f4f6','#35383e']},
  {id:'distinct',name:'Okabe–Ito 多组',divergingName:'蓝朱红',sequentialName:'朱红色阶',colors:['#e69f00','#56b4e9','#009e73','#d55e00','#cc79a7','#0072b2'],continuousStops:['#0072b2','#f7f5ef','#d55e00'],sequentialStops:['#fff1e8','#aa4600']}
].map(scheme=>Object.freeze({...scheme,colors:Object.freeze(scheme.colors),continuousStops:Object.freeze(scheme.continuousStops),sequentialStops:Object.freeze(scheme.sequentialStops)})));
function swatchSchemeFor(id){return SWATCH_SCHEMES.find(scheme=>scheme.id===id)||SWATCH_SCHEMES[0];}
function paletteSchemes(info){return info?.kind==='diverging'?SWATCH_SCHEMES.filter(scheme=>scheme.kind!=='sequential'):SWATCH_SCHEMES;}
function paletteSchemeName(scheme,info){return info?.kind==='sequential'?(scheme.sequentialName||scheme.name):info?.kind==='diverging'?(scheme.divergingName||scheme.name):scheme.name;}
function paletteDeclaredColors(text){
  if(typeof text!=='string'||text.length>8192)return null;
  try{const colors=JSON.parse(text);return Array.isArray(colors)&&colors.length>0&&colors.length<=64&&colors.every(color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color))?[...new Set(colors.map(color=>color.toLowerCase()))]:null;}catch{return null;}
}
function classifySvgContent(root){
  const counts={text:0,vector:0,image:0,outlined:0},ids=new Map([root,...root.querySelectorAll('[id]')].filter(el=>el.id).map(el=>[el.id,el])),box=String(root.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);
  const value=(el,prop,fallback='')=>{for(let p=el;p;p=p.parentElement){const v=p.style?.getPropertyValue(prop)||p.getAttribute(prop);if(v)return v;}return fallback;};
  const background=el=>{
    if(box.length!==4||el.getAttribute('transform')||value(el,'stroke','none')!=='none'||!['white','#fff','#ffffff','rgb(255, 255, 255)'].includes(value(el,'fill').toLowerCase()))return false;
    const [x,y,w,h]=box,near=(a,b)=>Math.abs(a-b)<.01;
    if(el.localName==='rect')return near(Number(el.getAttribute('x')||0),x)&&near(Number(el.getAttribute('y')||0),y)&&near(Number(el.getAttribute('width')),w)&&near(Number(el.getAttribute('height')),h);
    if(el.localName!=='path')return false;
    const d=el.getAttribute('d')||'';if(/[^MLZz\d\s.,+eE-]/.test(d))return false;const n=(d.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[]).map(Number);if(![8,10].includes(n.length))return false;
    const points=Array.from({length:n.length/2},(_,i)=>[n[i*2],n[i*2+1]]);return [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].every(c=>points.some(p=>near(p[0],c[0])&&near(p[1],c[1])))&&points.every(p=>(near(p[0],x)||near(p[0],x+w))&&(near(p[1],y)||near(p[1],y+h)));
  };
  const visit=(el,seen=new Set(),referenced=false)=>{
    if(!el||seen.size>24||seen.has(el)||['metadata','title','desc','style','clipPath','linearGradient','radialGradient','stop'].includes(el.localName)||!referenced&&el.localName==='defs')return;
    if(value(el,'display')==='none'||value(el,'visibility')==='hidden'||Number(value(el,'opacity','1'))===0)return;
    if(el.localName==='use'){const ref=el.getAttribute('href')||el.getAttributeNS?.('http://www.w3.org/1999/xlink','href'),target=ids.get(String(ref||'').replace(/^#/,''));if(!target)return;const next=new Set(seen);next.add(el);if(target.localName==='path'&&/(?:Sans|Serif|Mono|Arial|Helvetica|Times|Symbol|STIX|DejaVu|Liberation|MT).*-[\da-f]{2,6}$|^glyph\d+-\d+$/i.test(target.id||''))counts.outlined++;visit(target,next,true);return;}
    if(el.localName==='image'){if((el.getAttribute('href')||el.getAttributeNS?.('http://www.w3.org/1999/xlink','href'))&&parseFloat(el.getAttribute('width'))>0&&parseFloat(el.getAttribute('height'))>0)counts.image++;return;}
    if(el.localName==='text'){if(el.textContent.trim())counts.text++;return;}
    if(['path','rect','circle','ellipse','line','polyline','polygon'].includes(el.localName)){if(!background(el)&&(value(el,'fill','black')!=='none'||value(el,'stroke','none')!=='none'))counts.vector++;return;}
    for(const child of el.children||[])visit(child,seen,referenced);
  };
  visit(root);return {...counts,kind:counts.image?(counts.vector||counts.text?'mixed':'raster'):counts.text?'text-vector':counts.vector?'vector':'empty'};
}
function preparePositionedTextEdit(el,props){
  if(!['text','tspan'].includes(el.localName))return;
  const nodes=[el,...el.querySelectorAll('tspan')],lists=[];
  for(const node of nodes)for(const key of ['x','y','dx','dy']){const source=node.getAttribute(key);if(!source)continue;const values=source.trim().split(/[\s,]+/).map(Number);if(values.length>1&&values.every(Number.isFinite))lists.push({node,key,values});}
  if(!lists.length)return;
  // Source PDFs often locate every character. These positions describe the
  // original string; retaining them after an insertion would overlap new text.
  if(Object.hasOwn(props,'text')&&props.text!==el.textContent){
    for(const {node,key,values}of lists)node.setAttribute(key,String(values[0]));
    el.removeAttribute('textLength');el.removeAttribute('lengthAdjust');return;
  }
  const size=Number(props['font-size']);let original=NaN;
  for(let node=el;node&&!Number.isFinite(original);node=node.parentElement)original=parseFloat(node.style?.getPropertyValue('font-size')||node.getAttribute('font-size'));
  if(!Number.isFinite(size)||size<=0||!Number.isFinite(original)||original<=0)return;
  const ratio=size/original;
  for(const {node,key,values}of lists){const anchor=key==='x'||key==='y'?values[0]:0;node.setAttribute(key,values.map(value=>anchor+(value-anchor)*ratio).join(' '));}
  const length=Number(el.getAttribute('textLength'));if(length>0)el.setAttribute('textLength',String(length*ratio));
}
function createBlankProject(id,title='新建组图'){
  if(!/^[a-f0-9]{20}$/.test(id)||typeof title!=='string'||!title.trim()||title.length>100)throw Error('新工程名称无效');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="345.6pt" height="259.2pt" viewBox="0 0 345.6 259.2"><rect width="345.6" height="259.2" fill="#ffffff"/></svg>';
  return {schema:'figure-studio/1',id,title:title.trim(),...(title==='新建组图'?{title_i18n:{'zh-CN':'新建组图',en:'Untitled figure'}}:{}),desktopStarter:true,panels:[{id:'panel-0',name:'blank_canvas',name_i18n:{'zh-CN':'空白画布',en:'Blank canvas'},provenance:'blank-canvas',recipe:{},analysis:{},table:null,initialVariant:0,variants:[{name:'blank_canvas',svg,width:345.6,height:259.2,viewBox:[0,0,345.6,259.2],size:'original',preserveAspect:true}]}],initialState:{order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}}};
}
if (typeof module !== 'undefined') module.exports = {preparePositionedTextEdit,classifySvgContent,refreshHeatmapLabelContrast,heatmapFloat,validateHeatmapPalette,heatmapPaletteColor,applyHeatmapPalette,heatmapCellInfo,heatmapNumber,heatmapContrast,validateHeatmapLabels,applyHeatmapValueLabels,History, validateState, complementary, gridFor, arrange, movePanel, resizePanel, comparisonLetters, methodOrder, insertTracks, exportGeometry, pngWithDpi, installPanelState, dataTableValidation, parseDelimited, visualPanelOrder,panelNumberStyle,panelLabelText,displayedPanelLabel,migratePanelLabels,numberPanelLabels,removeSelectedItems,editingTextTarget,marqueeHit,clampPreviewZoom,wheelPreviewZoom,zoomAnchorScroll,svgElementSignature,svgElementMap,transferVariantEdits,SWATCH_SCHEMES,swatchSchemeFor,paletteSchemes,paletteSchemeName,paletteDeclaredColors};
if(typeof module!=='undefined')Object.assign(module.exports,{statisticsDataProfile,statisticsMethodChoices,stableTextEditSignature,migrateStableTextEdits,panelGaps,copyPanelGaps,createBlankProject,nudgeSelectionState,overlayEditingSpace,overlayLineEndpoints,overlayLineGeometry,resizeOverlayGeometry,orientOverlayLine,overlayInsertionGeometry,splitPanelState,validateAlignmentGuides,alignmentSnap,statisticalComparisons,statisticalPText,statisticalSymbol,statisticalLabelPlan,statisticalTextWidth,statisticalBracketPath,adjustedStatisticalBracket,statisticalLayout,statisticalBandLayout,statisticalMethodName});

function bindHeaderMenus(root){
  const menus=Array.from(root.querySelectorAll('header .header-menu'));
  const closeMenus=except=>{for(const menu of menus)if(menu!==except)menu.open=false;};
  for(const menu of menus){
    const summary=menu.querySelector('summary');
    menu.addEventListener('toggle',()=>{if(menu.open)closeMenus(menu);});
    menu.addEventListener('click',event=>{const button=event.target.closest?.('button');if(button&&!button.disabled){closeMenus();summary.focus({preventScroll:true});}},true);
    menu.addEventListener('keydown',event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      const buttons=Array.from(menu.querySelectorAll('button:not(:disabled)'));if(!buttons.length)return;
      event.preventDefault();closeMenus(menu);menu.open=true;
      const current=buttons.indexOf(root.activeElement),last=buttons.length-1;
      const index=event.key==='Home'?0:event.key==='End'?last:event.key==='ArrowDown'?(current+1)%buttons.length:current<0?last:(current-1+buttons.length)%buttons.length;
      buttons[index].focus({preventScroll:true});
    });
  }
  root.addEventListener('pointerdown',event=>{if(!event.target.closest?.('header .header-menu'))closeMenus();});
  root.addEventListener('keydown',event=>{if(event.key!=='Escape'||root.querySelector('dialog[open]'))return;const open=menus.find(menu=>menu.open);if(!open)return;event.preventDefault();event.stopImmediatePropagation();closeMenus();open.querySelector('summary').focus({preventScroll:true});},true);
}

if (typeof document !== 'undefined') (async () => {
  document.body.inert=true;
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const T=StudioI18n.t;
  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')&&!editingTextTarget(e.target)&&(['Delete','Backspace','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')){e.preventDefault();e.stopImmediatePropagation();}},true);
  let savedLanguage;try{savedLanguage=localStorage.getItem('figure-studio:language');}catch{}
  const systemLanguage=navigator.languages?.[0]||navigator.language;
  StudioI18n.setLanguage(StudioI18n.choose(savedLanguage,document.body.dataset.desktopStarter==='true'&&globalThis.StudioNativeBridge?.bundledAssets!==true?'zh-CN':systemLanguage));
  // Capture the static interface before any scientific or user-authored content is rendered.
  const staticText=[],staticAttributes=[];
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){const node=walker.currentNode;if(!node.parentElement.closest('script,style,svg,#language')&&node.textContent.trim())staticText.push([node,node.textContent]);}
  for(const el of document.querySelectorAll('[placeholder],[aria-label],[title]'))for(const key of ['placeholder','aria-label','title'])if(el.hasAttribute(key))staticAttributes.push([el,key,el.getAttribute(key)]);
  function localizeStatic(){
    document.documentElement.lang=StudioI18n.language;document.title=T('Figure Studio · 科研图形编辑器');$('language').value=StudioI18n.language;
    for(const [node,text]of staticText)if(node.isConnected)node.textContent=text.replace(text.trim(),T(text.trim()));
    for(const [el,key,text]of staticAttributes)if(el.isConnected)el.setAttribute(key,T(text));
  }
  localizeStatic();
  bindHeaderMenus(document);
  const DRAW = 'path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use,image';
  const TAGS = new Set(['svg','g','a','symbol','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','use','clipPath','linearGradient','radialGradient','stop','image','title','desc']);
  const ATTRS = new Set(['id','x','y','x1','y1','x2','y2','dx','dy','cx','cy','fx','fy','fr','r','rx','ry','width','height','viewBox','preserveAspectRatio','d','points','transform','fill','stroke','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','clip-path','font-family','font-size','font-style','font-weight','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','baseline-shift','textLength','lengthAdjust','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','color-interpolation','clipPathUnits','href','version','color','display','visibility']);
  const STYLES = new Set(['display','visibility','fill','stroke','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','clip-path','font','font-family','font-size','font-style','font-weight','font-stretch','font-variant','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','baseline-shift','stop-color','stop-opacity','color-interpolation','color']);
  const names = {raw_points_estimate_ci:'原始点 + 均值及置信区间',box_raw_points:'箱线图 + 原始点',violin_raw_points:'小提琴图 + 原始点',raincloud:'雨云图',estimation_graphic:'估计图：显示组间效应',paired_trajectories:'配对轨迹',paired_difference:'个体变化量',paired_estimation:'配对估计图',group_estimate_forest:'组别均值与区间',roc:'ROC 曲线',precision_recall:'精确率–召回率曲线'};
  const insights = {
    raw_points_estimate_ci:['关心组间平均差异与个体离散程度','同时看到每个观测值、均值和不确定性；不会只留下柱子的高度。'],
    box_raw_points:['关心中位数、四分位范围与分布离散程度','保留原始点，帮助辨认相同均值下不同的数据分布。须结合样本量解读。'],
    violin_raw_points:['关心分布形状；原流程已允许密度估计','能看到偏态或多峰的线索；外形受样本量和带宽影响，不替代检验。'],
    raincloud:['希望一起观察原始点与分布形状','同屏比较个体、分布和摘要；适用于原流程判定可绘制的连续数据。'],
    estimation_graphic:['核心问题是两组相差多少','把组间效应量及其区间直接画出来；比仅比较高度更便于读出差异大小。'],
    paired_trajectories:['关注同一对象前后如何变化','连线保留配对关系，展示个体变化方向；只适用于已确认的配对数据。'],
    paired_difference:['关注个体变化量及平均变化','围绕零线比较变化方向和幅度；保留配对差值，不把两次测量当独立样本。'],
    paired_estimation:['同时关注配对关系与效应大小','并列展示原始配对数据与差值区间，帮助判断变化量及其不确定性。'],
    group_estimate_forest:['需要清楚比较多组的估计值和区间','集中展示各组均值及不确定性；这不是自动计算的组间差异检验。'],
    roc:['关注不同阈值下灵敏度与假阳性率的权衡','展示分类区分能力；与 PR 图回答的问题不同，不能仅按美观互换。'],
    precision_recall:['关注检出率与阳性预测准确性的权衡','可观察召回增加时精确率如何变化；受阳性率影响，跨队列比较需结合背景。']
  };
  let swatchScheme=SWATCH_SCHEMES[0].id;
  try{swatchScheme=swatchSchemeFor(localStorage.getItem('figure-studio:swatch-scheme')).id;}catch{}
  const chartName=name=>StudioDiscovery[name]?.[StudioI18n.language]?.[0]||T(names[name]||name);
  const chartInsight=name=>StudioDiscovery[name]?.[StudioI18n.language]?.slice(1)||insights[name]?.map(T);
  let project, history, checkpoints = [], selectedPanel, selected = [], original = false, templateCache = new Map(), renderSerial = 0;
  let savedCurrent = '', localSavedCurrent = '', knownCache, message = '';
  let exportBusy=false,exportRequest=null;
  let duplicateCheck=null;
  let desktopSession=false,welcomeDismissed=false,newProjectBusy=false,desktopRestoredPayload=null;
  let activePane = 'explore',inspectorPanel=null,inspectorPreviewCache={};
  let preferenceData;try{preferenceData=JSON.parse(localStorage.getItem('figure-studio:preferences')||'null');}catch{}
  const preferences=new StudioPreferences(preferenceData);
  let confirmPreferenceClear=false,clearedPreferences=null;
  let layoutMode=false, dragging=null,panelSelection=[],showGuides=true,cancelPanelGesture=null,cancelSelectionGesture=null,cancelObjectGesture=null,selectedAlignmentGuide=null,mobileWorkspace=null;
  let elementSelections=[],selectionAnchor=null,boxSelect=false,selectedPanelLabel=null,selectionAfterMarquee=false;
  function selectionGroups(){
    if(selectionAnchor===selected&&elementSelections.length)return elementSelections.filter(g=>state().panels[g.id]?.variant===g.vi);
    return selected.length?[{id:selectedPanel,vi:state().panels[selectedPanel].variant,keys:selected}]:[];
  }
  function setElementSelection(groups){
    selectedPanelLabel=null;
    elementSelections=groups.filter(g=>g.keys.length);const first=elementSelections[0];
    if(first)selectedPanel=first.id;selected=first?[...first.keys]:[];selectionAnchor=selected;
    panelSelection=elementSelections.map(g=>g.id);selectedAnnotations=[];
  }
  const sizeNames={original:'原始横竖比例',portrait:'竖版',wide:'加宽横版',spanThree:'跨三列横版',spanWide:'跨两列横版',spanTall:'跨两行竖版',large:'重点大图'};
  function showPane(name,repaint=true) {
    activePane=name;
    document.querySelectorAll('[data-pane]').forEach(el=>{el.hidden=el.getAttribute('data-pane')!==name;});
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-pressed',String(el.getAttribute('data-tab')===name));});
    $('textRole').parentElement.hidden=name!=='detail';
    renderInspectorPreviews();
    if(repaint){renderCanvas();if(mobileWorkspace?.enabled)mobileWorkspace.showTab('adjustments');}
  }
  const state = () => history.current;
  const saveSignature = () => JSON.stringify({state:state(),checkpoints,dataDrafts,imageReview:project?.imageDuplicateReview?{createdAt:project.imageDuplicateReview.createdAt,updatedAt:project.imageDuplicateReview.updatedAt,reviews:project.imageDuplicateReview.reviews}:null});
  const panel = id => project.panels.find(p => p.id === id);
  const variant = id => panel(id).variants[state().panels[id].variant];
  const say = text => { message = text; $('status').textContent = T(text); };
  function safeValue(value) {
    if (/[<>]|(?:javascript|expression|@import|https?:|file:)/i.test(value)) return false;
    const urls = [...value.matchAll(/url\((.*?)\)/gi)];
    return urls.every(m => /^\s*['"]?#[\w.:-]+['T("]?\s*$/.test(m[1]));
  }
  function svgContentSummary(info,importInfo=null){
    if(Array.isArray(importInfo?.warningCodes)&&importInfo.warningCodes.includes('page_appearance'))return pdfWarningText('page_appearance')+' '+T('可整体移动、缩放或删除这个图层。');
    if(info.kind==='raster')return T('这是嵌入图片：可移动、缩放或删除整张图片；图片内部的文字和线条不能单独编辑。可导入保留文字和矢量对象的原始文件。');
    if(info.kind==='empty')return T('未发现可见的图形或文字对象，请检查源文件是否含有外部资源或不受支持的内容。');
    const summary=info.kind==='mixed'?T('混合内容：{0} 个文字对象、{1} 个矢量对象、{2} 个图片层。文字和矢量可独立编辑；图片层内部细节不能拆开编辑。',info.text,info.vector,info.image):info.text?T('可编辑内容：{0} 个文字对象、{1} 个矢量对象。点选可修改，直接拖动或用方向键微调；Delete 删除。',info.text,info.vector):T('检测到 {0} 个矢量对象，可单独移动、改色或删除。没有原生文字；已经转成轮廓的字只能作为形状调整。',info.vector);
    return info.outlined&&info.text?summary+' '+T('部分文字已转为轮廓，只能作为形状编辑。'):summary;
  }
  function showImportedContentNotice(info){
    const inspector=document.querySelector('.inspector');if(inspector)inspector.scrollTop=0;
    if(!['raster','mixed'].includes(info.kind)&&!info.outlined)return;
    let dialog=$('importContentDialog');
    if(!dialog){
      dialog=document.createElement('dialog');dialog.id='importContentDialog';dialog.className='import-content-dialog';dialog.setAttribute('aria-labelledby','importContentDialogTitle');
      const title=document.createElement('h2');title.id='importContentDialogTitle';const body=document.createElement('p');body.className='import-content-description';const note=document.createElement('p');note.className='muted';const close=document.createElement('button');close.className='primary';close.type='button';close.onclick=()=>dialog.close();dialog.append(title,body,note,close);document.body.append(dialog);
      dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();});
    }
    dialog.querySelector('h2').textContent=T('图形已导入');dialog.querySelector('.import-content-description').textContent=svgContentSummary(info);dialog.querySelector('.muted').textContent=T('导入结果已保留，可用撤销恢复。');dialog.querySelector('button').textContent=T('关闭');if(!dialog.open)dialog.showModal();
  }
  function inlineSvgStyles(root){
    const styles=[...root.querySelectorAll('style')];if(!styles.length)return;
    const winners=new Map(),simple=/^(?:\*|[a-zA-Z_][\w-]*)?(?:[.#][a-zA-Z_][\w-]*)*$/,failure=()=>Error(T('此 SVG 使用了暂不支持的样式规则，请从原软件以行内样式导出；文件尚未导入。'));let order=0;
    for(const sheet of styles){
      if(/^\s*\*\s*\{\s*stroke-linejoin:\s*round;\s*stroke-linecap:\s*butt\s*\}\s*$/.test(sheet.textContent)){root.setAttribute('stroke-linejoin','round');root.setAttribute('stroke-linecap','butt');continue;}
      const css=sheet.textContent.replace(/\/\*[\s\S]*?\*\//g,'');if(css.length>100000||/@|\\|<|>\s*\{/.test(css))throw failure();
      const rules=[...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];if(css.replace(/([^{}]+)\{([^{}]*)\}/g,'').trim()||rules.length>200)throw failure();
      for(const rule of rules){
        const probe=document.createElement('span').style;probe.cssText=rule[2];
        for(const prop of [...probe])if(!STYLES.has(prop)&&!prop.startsWith('-inkscape-')||!safeValue(probe.getPropertyValue(prop)))throw failure();
        for(const selector of rule[1].split(',').map(value=>value.trim())){
          const parts=selector.replace(/\s*>\s*/g,' ').trim().split(/\s+/);if(selector.length>300||!selector||parts.some(part=>!part||!simple.test(part))||/>{2}|^>|>$/.test(selector)||++order>1000)throw failure();
          const specificity=(selector.match(/#/g)||[]).length*10000+(selector.match(/\./g)||[]).length*100+parts.filter(part=>/^[a-zA-Z_]/.test(part)).length;
          let nodes;try{nodes=[...(root.matches(selector)?[root]:[]),...root.querySelectorAll(selector)];}catch{throw failure();}
          for(const el of nodes){if(el.namespaceURI!==NS||!el.style||!TAGS.has(el.localName))continue;const record=winners.get(el)||new Map();winners.set(el,record);for(const prop of [...probe]){if(!STYLES.has(prop))continue;const candidate={value:probe.getPropertyValue(prop),important:probe.getPropertyPriority(prop)==='important',specificity,order},old=record.get(prop);if(!old||+candidate.important>+old.important||candidate.important===old.important&&(specificity>old.specificity||specificity===old.specificity&&order>=old.order))record.set(prop,candidate);}}
        }
      }
    }
    for(const [el,record]of winners)for(const [prop,candidate]of record){const value=el.style.getPropertyValue(prop),important=el.style.getPropertyPriority(prop)==='important';if(!value||candidate.important&&!important)el.style.setProperty(prop,candidate.value);}
    styles.forEach(sheet=>sheet.remove());
  }
  async function validateSvgImportFeatures(raw){
    if(typeof raw!=='string'||raw.length>20000000||/<!ENTITY/i.test(raw))throw Error(T('SVG 无效或超过大小限制'));
    const xml=new DOMParser().parseFromString(raw,'image/svg+xml'),root=xml.documentElement;
    if(xml.querySelector('parsererror')||root.localName!=='svg'||root.namespaceURI!==NS)throw Error(T('无法解析 SVG'));
    inlineSvgStyles(root);
    const ids=new Map([root,...root.querySelectorAll('[id]')].filter(el=>el.id).map(el=>[el.id,el])),images=new Set(),unsupported=new Set(['filter','mask','pattern','foreignObject','textPath','marker']);
    const effect=name=>{throw Error(T('该 SVG 使用当前无法保留外观的效果（{0}）。请在原软件中将该效果转换为普通路径后再导入；当前图形未改变。',name));};
    const brokenReference=()=>{throw Error(T('SVG 中存在缺失或外部链接的图形资源。请从原软件导出自包含 SVG 后重新导入；当前图形未改变。'));};
    const value=(el,prop)=>el.style?.getPropertyValue(prop)||el.getAttribute(prop)||'';
    const neutralStyles={'mix-blend-mode':['normal','initial','unset'],isolation:['auto','initial','unset'],filter:['none','initial','unset'],mask:['none','initial','unset'],marker:['none','initial','unset'],'marker-start':['none','initial','unset'],'marker-mid':['none','initial','unset'],'marker-end':['none','initial','unset']};
    const visit=(el,trail=new Set(),referenced=false)=>{
      if(el.namespaceURI!==NS||['metadata','title','desc','style'].includes(el.localName)||!referenced&&['defs','symbol'].includes(el.localName))return;
      if(value(el,'display')==='none'||value(el,'visibility')==='hidden'||value(el,'opacity')!==''&&Number(value(el,'opacity'))===0)return;
      if(trail.has(el)||trail.size>32)brokenReference();const next=new Set(trail);next.add(el);
      if(unsupported.has(el.localName))effect(el.localName);
      // The stylesheet path already rejects unsupported CSS. Apply the same
      // appearance contract to inline declarations before sanitize can drop them.
      for(const prop of [...(el.style||[])]){
        const paint=el.style.getPropertyValue(prop).trim().toLowerCase();
        if(STYLES.has(prop)||prop.startsWith('-inkscape-')||['cursor','pointer-events'].includes(prop)||neutralStyles[prop]?.includes(paint))continue;
        effect(prop);
      }
      for(const prop of ['mix-blend-mode','isolation']){const paint=value(el,prop).trim().toLowerCase();if(paint&&!neutralStyles[prop].includes(paint))effect(prop);}
      for(const prop of ['filter','mask','marker','marker-start','marker-mid','marker-end']){const paint=value(el,prop).trim();if(paint&&!['none','initial','unset','inherit'].includes(paint))effect(prop);}
      for(const prop of ['fill','stroke','clip-path'])for(const match of value(el,prop).matchAll(/url\((.*?)\)/gi)){
        const target=match[1].trim().replace(/^['"]|['"]$/g,'');if(!/^#[\w.:-]+$/.test(target)||!ids.has(target.slice(1)))brokenReference();visit(ids.get(target.slice(1)),next,true);
      }
      if(el.localName==='image'){
        const href=el.getAttribute('href')||el.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';
        if(!href||!href.startsWith('data:'))throw Error(T('SVG 中的图片未嵌入或链接已缺失。请在原软件中嵌入图片后重新导入；当前图形未改变。'));
        if(!/^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(href))throw Error(T('SVG 的嵌入图片无效或格式不受支持。请重新嵌入 PNG、JPEG、GIF 或 WebP 图片后再导入。'));
        images.add(href);return;
      }
      if(['use','linearGradient','radialGradient'].includes(el.localName)){
        const href=el.getAttribute('href')||el.getAttributeNS('http://www.w3.org/1999/xlink','href')||'';if(href||el.localName==='use'){if(!/^#[\w.:-]+$/.test(href)||!ids.has(href.slice(1)))brokenReference();visit(ids.get(href.slice(1)),next,true);}if(el.localName==='use')return;
      }
      for(const child of el.children)visit(child,next,referenced);
    };
    visit(root);
    if(classifySvgContent(root).kind==='empty')throw Error(T('SVG 中未发现可导入的可见内容；当前图形未改变。'));
    // Validate only embedded bytes. No request is ever made to an external URL.
    for(const href of images)await new Promise((resolve,reject)=>{const image=new Image(),fail=()=>reject(Error(T('SVG 中的嵌入图片无法读取。请从原软件重新嵌入有效图片再导出；当前图形未改变。'))),timer=setTimeout(()=>{image.onload=image.onerror=null;fail();},10000);image.onload=()=>{clearTimeout(timer);if(image.naturalWidth>0&&image.naturalHeight>0)resolve();else fail();};image.onerror=()=>{clearTimeout(timer);fail();};image.src=href;});
  }
  function sanitize(text) {
    if (typeof text !== 'string' || text.length > 20000000 || /<!ENTITY/i.test(text)) throw Error(T('SVG 无效或超过大小限制'));
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') throw Error(T('无法解析 SVG'));
    const root = xml.documentElement;
    inlineSvgStyles(root);
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.localName === 'metadata') {
        if(el.namespaceURI===NS&&/(?:^|-)studio-category-groups$/.test(el.id)&&!el.children.length&&typeof StudioGroupSpacing!=='undefined'&&StudioGroupSpacing.validateMetadata(el.textContent)){const value=JSON.parse(el.textContent),id=el.id;for(const attr of [...el.attributes])el.removeAttributeNode(attr);el.id=id;el.textContent=JSON.stringify(value);}
        else if(el.namespaceURI===NS&&/(?:^|-)studio-series-colors$/.test(el.id)&&!el.children.length&&paletteDeclaredColors(el.textContent)){const value=paletteDeclaredColors(el.textContent),id=el.id;for(const attr of [...el.attributes])el.removeAttributeNode(attr);el.id=id;el.textContent=JSON.stringify(value);}
        else if(el.namespaceURI===NS&&/(?:^|-)studio-mark-styles$/.test(el.id)&&!el.children.length&&typeof StudioMarkStyle!=='undefined'&&StudioMarkStyle.validateMetadata(el.textContent)){const value=JSON.parse(el.textContent),id=el.id;for(const attr of [...el.attributes])el.removeAttributeNode(attr);el.id=id;el.textContent=JSON.stringify(value);}
        else if(el.namespaceURI===NS&&/(?:^|-)studio-stat-anchors$/.test(el.id)&&!el.children.length&&statisticalAnchorMetadata(el.textContent)){const value=statisticalAnchorMetadata(el.textContent),id=el.id;for(const attr of [...el.attributes])el.removeAttributeNode(attr);el.id=id;el.textContent=JSON.stringify(value);}else el.remove();
        continue;
      }
      if (el.localName === 'style') {
        if (!/^\s*\*\s*\{\s*stroke-linejoin:\s*round;\s*stroke-linecap:\s*butt\s*\}\s*$/.test(el.textContent)) throw Error(T('请先把 SVG 样式表转换为行内样式'));
        root.setAttribute('stroke-linejoin', 'round'); root.setAttribute('stroke-linecap', 'butt'); el.remove(); continue;
      }
      if (el.namespaceURI !== NS || !TAGS.has(el.localName)) { el.remove(); continue; }
      for (const attr of [...el.attributes]) {
        if (attr.name === 'xmlns' || attr.name === 'xmlns:xlink') continue;
        if (attr.name === 'style') {
          const probe = document.createElement('span'); probe.style.cssText = attr.value; el.removeAttribute('style');
          for (const prop of [...probe.style]) if (STYLES.has(prop) && safeValue(probe.style.getPropertyValue(prop))) el.style.setProperty(prop, probe.style.getPropertyValue(prop));
        } else if (attr.localName === 'href') {
          if (!/^#[\w.:-]+$/.test(attr.value) && !(el.localName === 'image' && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(attr.value))) el.removeAttributeNode(attr);
        } else if (!ATTRS.has(attr.localName) || !safeValue(attr.value)) el.removeAttributeNode(attr);
      }
    }
    [root, ...root.querySelectorAll('*')].filter(el=>el.localName!=='metadata').forEach((el, i) => el.setAttribute('data-key', 'e' + i));
    for (const el of root.querySelectorAll('text,tspan')) {
      const ids = []; let p = el;
      while (p && p !== root) { ids.push(p.id || ''); p = p.parentElement; }
      const role = ids.some(x=>/^legend/.test(x)) ? 'legend' : ids.some(x=>/^[xy]tick/.test(x)) ? 'ticks' : ids.some(x=>/^matplotlib.axis/.test(x)) ? 'axis' : 'other';
      el.setAttribute('data-role', role);
    }
    return document.importNode(root, true);
  }
  function validateProject(p) {
    if (p?.schema !== 'figure-studio/1' || !/^[a-f0-9]{20}$/.test(p.id) || typeof p.title !== 'string' || !Array.isArray(p.panels) || !p.panels.length || p.panels.length > 512) throw Error(T('不是受支持的 Figure Studio 工程'));
    StudioI18n.validateDisplayNames(p,'title');
    const ids = new Set();
    for (const pan of p.panels) {
      if (!/^panel-\d+$/.test(pan.id) || ids.has(pan.id) || typeof pan.name !== 'string' || !Array.isArray(pan.variants) || !pan.variants.length || pan.variants.length > 128) throw Error(T('工程面板无效'));
      StudioI18n.validateDisplayNames(pan);
      ids.add(pan.id);
      const first = pan.variants[0];
      for (const v of pan.variants) {
        if (typeof v.name !== 'string' || !Number.isFinite(v.width) || !Number.isFinite(v.height) || Math.min(v.width,v.height) <= 0 || Math.max(v.width,v.height) > 14400 || !Array.isArray(v.viewBox) || v.viewBox.length!==4 || !v.viewBox.every(Number.isFinite) || Math.min(...v.viewBox.slice(2))<=0 || Math.abs(v.width/v.viewBox[2] - v.height/v.viewBox[3])>1e-5) throw Error(T('SVG 尺寸无效'));
        if(v.size && !Object.hasOwn(sizeNames,v.size))throw Error(T('未知的画布规格'));
        sanitize(v.svg);
      }
    }
    validateState(p.initialState, p);
    if(p.imageDuplicateReview!=null){try{StudioDuplicateReview.validate(p.imageDuplicateReview,p.id);}catch{throw Error(T('查重复核记录无效'));}}
  }
  function baseSvg(id, vi) {
    const key = id + '/' + vi;
    if (!templateCache.has(key)) {
      const pan=panel(id),v=pan.variants[vi],upgrade=project.statisticalRenders?.[key],source=sanitize(upgrade&&upgrade.binding===statisticalSourceBinding(pan,v)?upgrade.svg:v.svg),enriched=project.heatmapRenders?.[key];
      if(enriched){const target=sanitize(enriched.svg),keys=new Map([...svgElementMap(source,target)].map(([oldKey,newKey])=>[newKey,oldKey]));let fresh=3000000;for(const el of target.querySelectorAll('[data-key]'))el.dataset.key=keys.get(el.dataset.key)||'e'+fresh++;templateCache.set(key,target);}
      else templateCache.set(key,source);
    }
    return templateCache.get(key).cloneNode(true);
  }
  const heatmapUpgradeRequests=new WeakMap(),heatmapUpgradeFailures=new WeakMap();
  const statisticalUpgradeRequests=new WeakMap(),statisticalUpgradeFailures=new WeakMap();
  function statisticalSourceBinding(source,v){return JSON.stringify([v.sha256,source.table?.sha256,source.recipe]);}
  async function ensureStatisticalMetadata(){
    if(!localEngine||engineConnection!=='connected'||typeof StudioStatisticalMetadata==='undefined')return;
    const owner=project,id=selectedPanel,p=state().panels[id],source=panel(id),vi=p?.variant,v=source?.variants[vi],key=id+'/'+vi;
    if(!p?.annotationStyle||source?.recipe?.family!=='gallery'||!source.table||!['grouped_observations','compare_facet_boxes'].includes(v?.name)||v.svg.includes('studio-stat-anchors'))return;
    const binding=statisticalSourceBinding(source,v),requestKey=key+'/'+binding;if(owner.statisticalRenders?.[key]?.binding===binding)return;
    let running=statisticalUpgradeRequests.get(owner);if(!running){running=new Set();statisticalUpgradeRequests.set(owner,running);}if(running.has(requestKey))return;
    let failed=statisticalUpgradeFailures.get(owner);if(!failed){failed=new Map();statisticalUpgradeFailures.set(owner,failed);}if(Date.now()-(failed.get(requestKey)||0)<30000)return;
    running.add(requestKey);const serial=dataSerial;
    try{
      const recipe=copy(source.recipe);recipe.parameters={view:v.name};
      const response=await engineFetch(localEngine.reflowEndpoint||'/api/reflow',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe,rows:source.table.rows,width:v.width,height:v.height})}),result=await response.json();
      if(!response.ok)throw Error(result.error);
      if(project!==owner||dataSerial!==serial||panel(id)!==source||statisticalSourceBinding(source,v)!==binding)return;
      const originalSvg=sanitize(v.svg),fresh=sanitize(result.variant.svg);if(!StudioStatisticalMetadata.attach(originalSvg,fresh))throw Error(T('当前旧图无法自动匹配统计位置，请在数据表中点击“更新图形”。'));
      owner.statisticalRenders||={};owner.statisticalRenders[key]={binding,svg:new XMLSerializer().serializeToString(originalSvg)};
      templateCache.delete(key);inspectorPreviewCache={};render();persist();
    }catch(error){failed.set(requestKey,Date.now());if(project===owner&&selectedPanel===id)say(error.message);}
    finally{running.delete(requestKey);}
  }
  async function ensureHeatmapMetadata(){
    if(!localEngine||engineConnection!=='connected')return;
    const owner=project;if(heatmapUpgradeRequests.has(owner))return heatmapUpgradeRequests.get(owner);if(Date.now()-(heatmapUpgradeFailures.get(owner)||0)<30000)return;
    const jobs=[];
    for(const id of state().order){const source=panel(id);if(source.recipe?.family!=='gallery'||!source.table)continue;
      source.variants.forEach((v,vi)=>{const key=id+'/'+vi;if(owner.heatmapRenders?.[key]||!v.svg.includes('studio-heat-value-'))return;const node=sanitize(v.svg).querySelector('[id*="studio-heat-value-"]'),info=node&&heatmapCellInfo(node.id);if(info&&!Number.isFinite(info.normalized))jobs.push({id,vi,key,source,v});});}
    if(!jobs.length)return;
    const task=(async()=>{for(const {key,source,v}of jobs){
      const recipe=copy(source.recipe);recipe.parameters={...recipe.parameters,view:v.name};
      const response=await engineFetch(localEngine.reflowEndpoint||'/api/reflow',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe,rows:source.table.rows,width:v.width,height:v.height})}),result=await response.json();
      if(!response.ok)throw Error(result.error);const fresh=result.variant,svg=sanitize(fresh.svg),info=heatmapCellInfo(svg.querySelector('[id*="studio-heat-value-"]')?.id||'');
      if(Math.abs(fresh.width-v.width)>.01||Math.abs(fresh.height-v.height)>.01||!Number.isFinite(info?.normalized))throw Error(T('热图配色元数据更新失败'));
      owner.heatmapRenders||={};owner.heatmapRenders[key]=fresh;
    }
    if(project===owner){templateCache.clear();render();persist();}
    })();heatmapUpgradeRequests.set(owner,task);
    task.catch(error=>{heatmapUpgradeFailures.set(owner,Date.now());if(project===owner)say(T('热图配色元数据更新失败')+'：'+error.message);}).finally(()=>heatmapUpgradeRequests.delete(owner));return task;
  }
  // Re-render to the actual slot size. These are derived vector assets, not new
  // edit-history versions. Keep original keys by semantic SVG ancestry so a
  // changed tick count cannot redirect a user's colour/font edit to a new object.
  function reflowSvg(id,vi,v){
    const source=baseSvg(id,vi),target=sanitize(v.svg);
    const keys=new Map([...svgElementMap(source,target)].map(([oldKey,newKey])=>[newKey,oldKey]));
    let fresh=2000000;for(const el of target.querySelectorAll('[data-key]'))el.dataset.key=keys.get(el.dataset.key)||'e'+fresh++;
    return target;
  }
  const reflowRequests=new Map();let reflowTimer=null;
  function reflowSpec(pos,s){
    pos=pos.renderBox||pos;
    const source=panel(pos.id),v=source.variants[s.panels[pos.id].variant];
    if(!source.table||!['gallery','roc'].includes(source.recipe?.family)||!v.svg.includes('studio-plot-frame')||s.panels[pos.id].locked)return null;
    const width=+pos.width.toFixed(3),height=+(pos.height-(pos.statisticsBand||0)-(pos.statisticsTop||0)-(pos.conditionHeight||0)).toFixed(3);
    if(Math.abs(v.width-width)<.01&&Math.abs(v.height-height)<.01)return null;
    const recipe=copy(source.recipe);if(recipe.family==='gallery')recipe.parameters.view=v.name;else recipe.studio_view=v.name;
    return {key:v.sha256+(v.svg.includes('studio-heat-value-')?'@heatmap2':'')+(['grouped_observations','compare_facet_boxes'].includes(v.name)?'@stats1':'')+'@'+width+'x'+height,recipe,rows:source.table.rows,width,height};
  }
  function currentHeatmapMetadata(v){const id=v?.svg?.match(/id="([^"<>]*studio-heat-value-[^"<>]+)"/)?.[1];return !id||Number.isFinite(heatmapCellInfo(id)?.normalized);}
  function fittedVariant(pos,s){const spec=reflowSpec(pos,s),v=spec&&project.layoutRenders?.[spec.key];return v&&currentHeatmapMetadata(v)?v:null;}
  function editableSource(id,vi,s=state()){
    const pos=s.panels[id].variant===vi?layout(s).positions.find(p=>p.id===id):null;
    return editedSvg(id,vi,s,false,pos?fittedVariant(pos,s):null);
  }
  function textPointSize(el){
    if(typeof StudioRichText!=='undefined')return StudioRichText.pointSize(el);
    const own=parseFloat(el.style.fontSize||el.getAttribute('font-size'));
    if(Number.isFinite(own))return own;
    const runs=[...el.querySelectorAll('tspan')].map(n=>parseFloat(n.style.fontSize||n.getAttribute('font-size'))).filter(Number.isFinite);
    return runs.length?Math.max(...runs):12;
  }
  async function ensureReflows(s=state()){
    if(!localEngine)return;
    const owner=project,jobs=layout(s).positions.map(pos=>reflowSpec(pos,s)).filter(spec=>spec&&(!owner.layoutRenders?.[spec.key]||!currentHeatmapMetadata(owner.layoutRenders[spec.key])));
    await Promise.all(jobs.map(spec=>{if(reflowRequests.has(spec.key))return reflowRequests.get(spec.key);
      const task=(async()=>{const {recipe,rows,width,height}=spec;const response=await engineFetch(localEngine.reflowEndpoint||'/api/reflow',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe,rows,width,height})}),result=await response.json();if(!response.ok)throw Error(result.error);
        const v=result.variant;if(Math.abs(v.width-spec.width)>.01||Math.abs(v.height-spec.height)>.01||typeof v.svg!=='string')throw Error(T('重排尺寸不匹配'));sanitize(v.svg);
        owner.layoutRenders||={};owner.layoutRenders[spec.key]=v;
        // Bound cached SVGs, retaining the most recent compositions in saved projects.
        const keys=Object.keys(owner.layoutRenders);let bytes=keys.reduce((n,k)=>n+owner.layoutRenders[k].svg.length,0);while(bytes>16000000&&keys.length>1){const key=keys.shift();bytes-=owner.layoutRenders[key].svg.length;delete owner.layoutRenders[key];}
      })();reflowRequests.set(spec.key,task);task.finally(()=>reflowRequests.delete(spec.key)).catch(()=>{});return task;
    }));
  }
  async function ensureCurrentReflows(){let snapshot;do{snapshot=state();await ensureReflows(snapshot);}while(snapshot!==state());}
  function isVisibleObject(el) {
    if(!el.matches(DRAW)||el.closest('defs,clipPath,[id$="studio-plot-frame"]'))return false;
    for(let n=el;n&&n.localName!=='svg';n=n.parentElement){if(n.style?.display==='none'||n.style?.visibility==='hidden'||n.getAttribute('display')==='none'||n.getAttribute('visibility')==='hidden')return false;const opacity=n.style?.opacity||n.getAttribute('opacity');if(opacity!==null&&opacity!==''&&+opacity===0)return false;}
    return true;
  }
  function keysToObjects(svg) { return [...svg.querySelectorAll(DRAW)].filter(el=>isVisibleObject(el)&&/^e\d+$/.test(el.getAttribute('data-key')||'')); }
  // Editor-only hit areas never have data-key: selection, saved edits and export
  // continue to address the original vector path rather than an invisible copy.
  function canvasObjectTarget(target){
    const proxy=target.closest('[data-studio-hit-key]');
    return proxy?proxy.closest('[data-panel]')?.querySelector(`[data-key="${proxy.dataset.studioHitKey}"]`):(target.closest('text[data-key]')||target.closest('[data-key]'));
  }
  function addStatisticalHitAreas(svg){
    for(const source of svg.querySelectorAll('path[data-stat-bracket][data-key]')){
      if(!isVisibleObject(source))continue;
      const hit=document.createElementNS(NS,'path');
      for(const prop of ['d','transform','clip-path'])if(source.hasAttribute(prop))hit.setAttribute(prop,source.getAttribute(prop));
      for(const [prop,value]of Object.entries({'data-studio-hit-key':source.dataset.key,fill:'none',stroke:'transparent','stroke-width':12,'vector-effect':'non-scaling-stroke','aria-hidden':'true'}))hit.setAttribute(prop,value);
      hit.style.pointerEvents='stroke';hit.style.cursor='move';const text=[...source.parentElement.children].find(el=>el.localName==='text'&&(el.hasAttribute('data-stat-top')||el.hasAttribute('data-stat-result')));if(text)text.before(hit);else source.before(hit);
    }
  }
  function paint(el, prop) {
    let current = el;
    while (current?.namespaceURI === NS) {
      const value = current.style?.getPropertyValue(prop) || current.getAttribute(prop);
      if (value) return value;
      current = current.parentElement;
    }
    return prop === 'fill' ? '#000000' : 'none';
  }
  function hex(value) {
    if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase();
    if (/^#[\da-f]{3}$/i.test(value)) return '#' + value.slice(1).split('').map(x=>x+x).join('').toLowerCase();
    const m = value.match(/^rgb\(\s*(\d+)[, ]+\s*(\d+)[, ]+\s*(\d+)\s*\)$/i);
    return m ? '#' + m.slice(1).map(x => (+x).toString(16).padStart(2,'0')).join('') : null;
  }
  function chromatic(value) { const h = hex(value); if (!h) return false; const rgb=h.slice(1).match(/../g).map(x=>parseInt(x,16)); return Math.max(...rgb)-Math.min(...rgb)>18; }
  function editsFor(id, vi, s=state()) { return s.panels[id].edits[vi] || {}; }
  function statisticalAnalysisFor(id,s=state()){
    const result=s.panels[id].statistics;
    if(result)return result.stale||result.tableKey!==(panel(id).table?.sha256||'')?{}:result.analysis;
    return panel(id).analysis;
  }
  function comparisonsFor(id,s=state()){return statisticalComparisons(statisticalAnalysisFor(id,s),s.panels[id]).comparisons;}
  function statisticalAnchorElements(svg,order,onlyAxis=null){
    const bars=onlyAxis?[]:order.map((_,i)=>svg.querySelector(`[id="studio-bar-${i}"]`));
    if(bars.length&&bars.every(bar=>bar?.querySelector('path')))return {kind:'bars',nodes:bars};
    // A compound plot may contain marginal densities or a color scale. Accept a
    // unique matching category axis, never infer groups from numeric coordinates.
    const axes=onlyAxis?[onlyAxis]:[...svg.querySelectorAll('[id^="axes_"]')],normal=value=>String(value).replace(/\s+/g,''),matches=[];
    for(const axis of axes){
      const ticks=[...axis.querySelectorAll('[id^="xtick_"]')].map(tick=>tick.querySelector('text')).filter(Boolean);
      if(ticks.length!==order.length||new Set(order.map(normal)).size!==order.length||ticks.some((tick,i)=>normal([...(tick.closest?.('[id^="xtick_"]')?.querySelectorAll('text')||[tick])].map(text=>text.textContent).join(' '))!==normal(order[i])))continue;
      const artists=[...axis.children].filter(el=>/^(?:PathCollection|PolyCollection|FillBetweenPolyCollection|LineCollection|line2d_|patch_|studio-mark-|studio-category-a\d+-g\d+-(?:points|mean|cap\d+|ci\d*)$)/.test(el.id)&&el.querySelector('[clip-path]'));
      if(artists.length)matches.push({kind:'categories',nodes:ticks,artists,axis});
    }
    return matches.length===1?matches[0]:null;
  }
  function statisticalAxisFrame(svg,axis){
    if(!axis)return null;
    for(const node of axis.querySelectorAll('[clip-path]')){const id=node.getAttribute?.('clip-path')?.match(/url\(#([^\s)]+)\)/)?.[1],rect=id&&svg.querySelector(`[id="${id}"] rect`);if(!rect)continue;const frame=Object.fromEntries(['x','y','width','height'].map(key=>[key,Number(rect.getAttribute(key))]));if(Object.values(frame).every(Number.isFinite)&&frame.width>0&&frame.height>0)return frame;}
    return null;
  }
  function statisticalAnchorMetadata(text){
    try{
      if(typeof text!=='string'||text.length>262144)return null;
      const value=JSON.parse(text),id=x=>typeof x==='string'&&/^[A-Za-z_][\w.:-]{0,159}$/.test(x),label=x=>typeof x==='string'&&x.length>0&&x.length<=4000,axes=new Set(),members=new Set();
      if(value.version!==1||!Array.isArray(value.axes)||!value.axes.length||value.axes.length>32)return null;
      for(const axis of value.axes){
        if(!id(axis.axis)||axes.has(axis.axis)||!Array.isArray(axis.groups)||!axis.groups.length||axis.groups.length>1024)return null;axes.add(axis.axis);
        const cells=new Set();for(const cell of axis.groups){
          if(!label(cell.group)||!cell.facet||!label(cell.facet.column)||!label(cell.facet.value)||!Array.isArray(cell.center)||cell.center.length!==2||!cell.center.every(Number.isFinite)||!Array.isArray(cell.members)||!cell.members.length||cell.members.length>64)return null;
          const key=JSON.stringify([cell.facet.column,cell.facet.value,cell.group]);if(cells.has(key))return null;cells.add(key);
          for(const member of cell.members){if(!id(member)||members.has(member))return null;members.add(member);}
        }
      }return value;
    }catch{return null;}
  }
  function statisticalSemanticPoint(svg,node,center){
    // Matplotlib's declared centers use the same user coordinates as its artists.
    // Apply current group translations without relying on displayed tick text.
    let [x,y]=center;for(let el=node;el&&el!==svg;el=el.parentElement){const m=el.transform?.baseVal.consolidate()?.matrix;if(m)[x,y]=[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f];}return {x,y};
  }
  function statisticalLabelFrames(sets){
    for(const set of sets){
      const peers=sets.filter(other=>other.axis===set.axis).sort((a,b)=>a.centers.reduce((n,x)=>n+x,0)/a.centers.length-b.centers.reduce((n,x)=>n+x,0)/b.centers.length),i=peers.indexOf(set),left=i?(Math.max(...peers[i-1].centers)+Math.min(...set.centers))/2:set.frame.x,right=i<peers.length-1?(Math.max(...set.centers)+Math.min(...peers[i+1].centers))/2:set.frame.x+set.frame.width;
      set.labelFrame={x:left,width:Math.max(1,right-left)};
    }return sets;
  }
  function statisticalSemanticAnchors(svg,sets){
    const records=[...svg.querySelectorAll('metadata')].filter(node=>/(?:^|-)studio-stat-anchors$/.test(node.id||'')).map(node=>statisticalAnchorMetadata(node.textContent));
    if(!records.length||records.some(record=>!record))return null;
    const matches=[];
    for(const set of sets){
      if(!set.facet)return null;
      const candidates=[];for(const record of records.flatMap(value=>value.axes)){
        const entries=record.groups.filter(cell=>cell.facet.value===set.label&&(!set.facetColumn||cell.facet.column===set.facetColumn));if(entries.length!==set.order.length||new Set(entries.map(cell=>cell.facet.column)).size!==1)continue;
        const cells=set.order.map(group=>entries.filter(cell=>cell.group===group));if(cells.some(cell=>cell.length!==1))continue;
        const axis=svg.querySelector(`[id="${record.axis}"]`),frame=statisticalAxisFrame(svg,axis);if(!axis||!frame)continue;
        const groups=cells.map(([cell])=>({...cell,nodes:cell.members.map(member=>svg.querySelector(`[id="${member}"]`))}));
        if(groups.some(cell=>cell.nodes.some(node=>!node||node.closest(`[id="${record.axis}"]`)!==axis)))continue;
        const centers=groups.map(cell=>statisticalSemanticPoint(svg,cell.nodes[0],cell.center).x);
        if(centers.some(x=>!Number.isFinite(x)||x<frame.x-.5||x>frame.x+frame.width+.5)||new Set(centers).size!==centers.length)continue;
        candidates.push({...set,axis,frame,title:null,centers,anchors:{kind:'semantic',axis,groups,nodes:groups.map(cell=>cell.nodes[0])}});
      }if(candidates.length!==1)return null;matches.push(candidates[0]);
    }
    const rows=[];for(const match of matches.slice().sort((a,b)=>a.frame.y-b.frame.y)){let row=rows.findIndex(y=>Math.abs(y-match.frame.y)<1);if(row<0){row=rows.length;rows.push(match.frame.y);}match.row=row;}
    return statisticalLabelFrames(matches);
  }
  function statisticalPlotAnchors(svg,sets){
    const valid=sets.filter(set=>!set.reason&&set.comparisons.length);if(valid.length!==sets.length)return null;
    const semantic=statisticalSemanticAnchors(svg,valid);if(semantic)return semantic;
    const axes=[...svg.querySelectorAll('[id^="axes_"]')],normal=value=>String(value).trim().replace(/\s+/g,' '),used=new Set(),matches=[];
    for(const set of valid){
      let anchors,title=null;
      if(set.facet){
        const candidates=axes.flatMap(axis=>[...axis.children].filter(child=>/^text_/.test(child.id||'')).flatMap(child=>[...child.querySelectorAll('text')].filter(text=>normal(text.textContent)===normal(set.label)).map(text=>({axis,title:text}))));
        if(candidates.length!==1||used.has(candidates[0].axis))return null;
        title=candidates[0].title;anchors=statisticalAnchorElements(svg,set.order,candidates[0].axis);
      }else anchors=statisticalAnchorElements(svg,set.order);
      if(!anchors)return null;const axis=anchors.axis||anchors.nodes[0]?.closest?.('[id^="axes_"]'),frame=statisticalAxisFrame(svg,axis);if(set.facet&&!frame)return null;
      used.add(axis);matches.push({...set,anchors,axis,title,frame});
    }
    const rows=[];for(const match of matches.slice().sort((a,b)=>(a.frame?.y||0)-(b.frame?.y||0))){const y=match.frame?.y||0;let row=rows.findIndex(value=>Math.abs(value-y)<1);if(row<0){row=rows.length;rows.push(y);}match.row=row;}
    return matches;
  }
  function statisticalFacetTitleElements(svg){
    const axes=[...svg.querySelectorAll('[id^="axes_"]')];if(axes.length<2)return [];
    return axes.flatMap(axis=>{const frame=statisticalAxisFrame(svg,axis);if(!frame)return [];const titles=[...axis.children].filter(child=>/^text_/.test(child.id||'')).flatMap(child=>[...child.querySelectorAll('text')]).filter(text=>{const x=Number(text.getAttribute('x')),y=Number(text.getAttribute('y')),anchor=text.style?.textAnchor||text.getAttribute('text-anchor');return Number.isFinite(x)&&Number.isFinite(y)&&y<frame.y&&frame.y-y<Math.max(36,frame.height*.2)&&Math.abs(x-frame.x-frame.width/2)<Math.max(1,frame.width*.02)&&(anchor==='middle'||String(text.getAttribute('style')||'').includes('text-anchor: middle'));});return titles.length===1?titles:[];});
  }
  function resolvedStatisticalPlotAnchors(svg,references){
    if(!references?.length)return null;
    if(references.every(ref=>ref.anchors.kind==='semantic'))return statisticalSemanticAnchors(svg,references);
    const resolved=[];for(const ref of references){const axis=ref.axis?.id&&svg.querySelector(`[id="${ref.axis.id}"]`);if(!axis)return null;const ticks=[...axis.querySelectorAll('[id^="xtick_"]')].map(tick=>tick.querySelector('text')).filter(Boolean);if(ticks.length!==ref.order.length)return null;
      const sourceTicks=ref.anchors.nodes.map(node=>node.closest?.('[id^="xtick_"]')?.id);if(sourceTicks.some((key,i)=>!key||ticks[i].closest?.('[id^="xtick_"]')?.id!==key))return null;
      const artists=[...axis.children].filter(el=>/^(?:PathCollection|PolyCollection|FillBetweenPolyCollection|LineCollection|line2d_|patch_|studio-mark-|studio-category-a\d+-g\d+-(?:points|mean|cap\d+|ci\d*)$)/.test(el.id)&&el.querySelector('[clip-path]'));if(!artists.length)return null;const titleKey=ref.title?.getAttribute('data-key'),title=titleKey?svg.querySelector(`[data-key="${titleKey}"]`):null;
      resolved.push({...ref,axis,title,frame:statisticalAxisFrame(svg,axis),anchors:{kind:'categories',nodes:ticks,artists,axis}});
    }return resolved;
  }
  function conditionMatrixAxes(svg,id,s=state()){
    const analysis=statisticalAnalysisFor(id,s)||{},orders=(analysis.facets||[analysis]).map(result=>result.group_order).filter(Array.isArray),sets=[];
    for(const axis of svg.querySelectorAll('[id^="axes_"]')){
      const frame=statisticalAxisFrame(svg,axis),ticks=[...axis.querySelectorAll('[id^="xtick_"]')].map(tick=>tick.querySelector('text')).filter(Boolean),order=ticks.map(tick=>[...(tick.closest?.('[id^="xtick_"]')?.querySelectorAll('text')||[tick])].map(text=>text.textContent.trim()).join(' ').replace(/\s+/g,' '));
      if(!frame||!order.length||order.length>32||new Set(order).size!==order.length||order.some(label=>!label))continue;
      const normalize=value=>String(value).trim().replace(/\s+/g,' '),declared=orders.some(labels=>labels.length===order.length&&labels.every((label,i)=>normalize(label)===normalize(order[i])));
      if(orders.length&&!declared)continue;
      // Numeric coordinates (time, concentration, PCA, ROC) are not group labels.
      if(!declared&&order.some(label=>/^[+−-]?(?:\d*\.)?\d+(?:[eE][+−-]?\d+)?%?$/.test(label)))continue;
      const anchors=statisticalAnchorElements(svg,order,axis);if(!anchors)continue;
      sets.push({axis,frame,anchors,order,label:statisticalFacetTitleElements(svg).find(title=>title.closest('[id^="axes_"]')===axis)?.textContent||'',row:0});
    }
    const rows=[];for(const set of sets.slice().sort((a,b)=>a.frame.y-b.frame.y)){let row=rows.findIndex(y=>Math.abs(y-set.frame.y)<1);if(row<0){row=rows.length;rows.push(set.frame.y);}set.row=row;}
    return sets;
  }
  function conditionMatrixGroups(id,s=state(),vi=s.panels[id].variant){return [...new Set(conditionMatrixAxes(baseSvg(id,vi),id,s).flatMap(set=>set.order))];}
  function conditionMatrixInfo(id,s=state(),vi=s.panels[id].variant,svg=null){
    const config=s.panels[id].conditionMatrix,source=svg||baseSvg(id,vi),sets=conditionMatrixAxes(source,id,s),width=Number(source.getAttribute('viewBox').split(/\s+/)[2]);
    return {sets,width,groups:[...new Set(sets.flatMap(set=>set.order))],rowCount:sets.length?1+Math.max(...sets.map(set=>set.row)):0,available:sets.length>0,enabled:!!config&&config.enabled!==false&&Array.isArray(config.rows)&&config.rows.length>0,reason:sets.length?'':'当前图没有可匹配的分类横轴。'};
  }
  function conditionMatrixTextLines(value,width,font,size,bold,italic,splitLong=false){
    const text=String(value??'').trim()||'—',measure=line=>statisticalTextWidth(line,font,size,bold,italic),lines=[];let current='';
    for(const word of text.split(/\s+/)){if(measure(word)>width&&splitLong){for(const character of Array.from(word)){if(current&&measure(current+character)>width){lines.push(current);current='';}current+=character;}continue;}const joined=current?current+' '+word:word;if(current&&measure(joined)>width){lines.push(current);current=word;}else current=joined;}
    if(current)lines.push(current);return {lines,width:Math.max(...lines.map(measure)),fits:lines.every(line=>measure(line)<=width+.01)};
  }
  function conditionMatrixLayout(info,config,typography,unit=1){
    const font=config?.font?.font||typography?.font||'Arial',size=config?.font?.size||typography?.size||9,bold=!!config?.font?.bold,italic=!!config?.font?.italic,lineHeight=size*1.3,rows=(config?.rows||[]).slice(0,8),pad=6,gap=5,sets=[];
    for(const set of info.sets||[]){const peers=info.sets.filter(peer=>peer.row===set.row).sort((a,b)=>a.frame.x-b.frame.x),index=peers.indexOf(set),previous=peers[index-1],next=peers[index+1],centers=set.anchors.nodes.map(tick=>Number(tick.getAttribute('data-studio-category-center')??tick.closest?.('[id^="xtick_"]')?.querySelector('use')?.getAttribute('x')??tick.getAttribute('x'))/unit),spacing=centers.length>1?Math.min(...centers.slice(1).map((x,i)=>Math.abs(x-centers[i]))):set.frame.width/unit;
      const left=previous?(previous.frame.x+previous.frame.width+set.frame.x)/unit/2:pad,rightBound=next?(set.frame.x+set.frame.width+next.frame.x)/unit/2:(info.width||set.frame.x+set.frame.width+20)/unit-pad,cellWidths=centers.map(center=>Math.max(1,Math.min(spacing-8,2*(rightBound-center)))),valueRows=rows.map(row=>set.order.map((group,i)=>conditionMatrixTextLines(Object.prototype.hasOwnProperty.call(row.values||{},group)?row.values[group]:'—',cellWidths[i],font,size,bold,italic))),right=centers[0]-Math.max(0,...valueRows.map(values=>values[0]?.width||0))/2-gap,labelWidth=Math.max(1,right-left),plannedRows=rows.map((row,index)=>{const label=conditionMatrixTextLines(row.label,labelWidth,font,size,bold,italic,true),values=valueRows[index];return {label,values,height:Math.max(label.lines.length,...values.map(value=>value.lines.length))*lineHeight+gap};});
      sets.push({...set,centers,left,right,rightBound,labelWidth,cellWidths,rows:plannedRows});
    }
    const rowHeights=Array.from({length:info.rowCount||0},(_,row)=>{const own=sets.filter(set=>set.row===row);return rows.map((_,i)=>Math.max(...own.map(set=>set.rows[i].height)));}),heights=rowHeights.map(values=>pad+values.reduce((a,b)=>a+b,0)+pad),fits=sets.every(set=>set.rows.every(row=>row.label.fits&&row.values.every(value=>value.fits)));
    if(!fits&&size>6){const factor=Math.min(...sets.flatMap(set=>set.rows.flatMap(row=>[set.labelWidth/row.label.width,...row.values.map((value,i)=>set.cellWidths[i]/value.width)]))),adjusted=Math.max(6,Math.floor(Math.min(size-.1,size*factor*.98)*10)/10);return {...conditionMatrixLayout(info,{...config,font:{...config.font,font,size:adjusted}},typography,unit),requestedSize:size};}
    return {font,size,requestedSize:size,bold,italic,lineHeight,pad,sets,rowHeights,heights,totalHeight:fits?heights.reduce((a,b)=>a+b,0):0,fits};
  }
  function measureStatisticalAnchors(svg,anchors){
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';host.append(svg);document.body.append(host);
    try{
      const root=svg.getScreenCTM(),matrix=el=>root.inverse().multiply(el.getScreenCTM()),bounds=el=>{const b=el.getBBox(),m=matrix(el),points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(m));return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};};
      if(anchors.kind==='semantic'){
        const frame=statisticalAxisFrame(svg,anchors.axis),centers=anchors.groups.map(cell=>new DOMPoint(...cell.center).matrixTransform(matrix(cell.nodes[0])).x),tops=anchors.groups.map(cell=>{const boxes=cell.nodes.filter(node=>node.style?.display!=='none').map(bounds).filter(b=>Object.values(b).every(Number.isFinite));return boxes.length?Math.max(frame.y,Math.min(...boxes.map(b=>b.top))):frame.y;});return {centers,tops};
      }
      const centers=anchors.nodes.map(node=>{if(anchors.kind==='bars')return (bounds(node).left+bounds(node).right)/2;const declared=node.getAttribute('data-studio-category-center');if(declared!==null&&Number.isFinite(Number(declared)))return Number(declared);const point=node.closest?.('[id^="xtick_"]')?.querySelector('use')||node;return new DOMPoint(parseFloat(point.getAttribute('x'))||0,parseFloat(point.getAttribute('y'))||0).matrixTransform(matrix(point)).x;});
      let tops;
      if(anchors.kind==='bars')tops=anchors.nodes.map((bar,i)=>Math.min(...[bar,...svg.querySelectorAll(`[id^="studio-group-${i}-"]`)].map(el=>bounds(el).top)));
      else{const frame=statisticalAxisFrame(svg,anchors.axis),boxes=anchors.artists.map(bounds).map(b=>frame?{left:Math.max(b.left,frame.x),right:Math.min(b.right,frame.x+frame.width),top:Math.max(b.top,frame.y),bottom:Math.min(b.bottom,frame.y+frame.height)}:b).filter(b=>Object.values(b).every(Number.isFinite)&&b.right>=b.left&&b.bottom>=b.top),fallback=boxes.length?Math.min(...boxes.map(b=>b.top)):frame?.y||0,spacing=Math.min(...centers.slice(1).map((x,i)=>Math.abs(x-centers[i])));tops=centers.map(x=>{const near=boxes.filter(b=>b.right>=x-spacing*.45&&b.left<=x+spacing*.45);return near.length?Math.min(...near.map(b=>b.top)):fallback;});}
      return {centers,tops};
    }finally{svg.remove();host.remove();}
  }
  function statisticalAnnotationSets(id,s=state()){
    const analysis=statisticalAnalysisFor(id,s)||{},facets=Array.isArray(analysis.facets)&&analysis.facets.length?analysis.facets:null;
    return (facets||[analysis]).map((result,i)=>({...statisticalComparisons(result,s.panels[id]),label:facets?String(result.label||String(i+1)):'',facet:!!facets,facetColumn:analysis.facet_column||''}));
  }
  function statisticalAnnotationInfo(id,s=state(),vi=s.panels[id].variant){
    const sets=statisticalAnnotationSets(id,s),valid=sets.filter(set=>!set.reason&&set.comparisons.length),first=valid[0]||sets[0];
    if(!valid.length)return {...first,sets,available:false,placement:'band'};
    const svg=baseSvg(id,vi);if(s.panels[id].groupSpacing&&typeof StudioGroupSpacing!=='undefined')StudioGroupSpacing.apply(svg,s.panels[id].groupSpacing.factor,{orders:groupSpacingOrders(id,s),view:panel(id).variants[vi].name});
    const plotSets=statisticalPlotAnchors(svg,sets),anchors=plotSets?.length===1?plotSets[0].anchors:null;
    const placement=plotSets?(first.facet?'facets':'plot'):'band',preservePlot=!!plotSets&&(!!panel(id).variants[vi].preserveAspect||svg.querySelectorAll('[id^="axes_"]').length!==1||placement==='facets');
    const value=s.panels[id].statistics?.config?.value,bandTitle=T('本小图组间比较')+(value?' · '+String(value):'');
    const info={...first,sets,anchors,plotSets,preservePlot,hasFacetTitles:!!plotSets?.some(set=>set.title)||statisticalFacetTitleElements(svg).length>0,rowCount:plotSets?1+Math.max(...plotSets.map(set=>set.row)):1,placement,available:true,reason:'',bandTitle,noticeText:T('该分面尚无有效比较结果。'),comparisons:valid.flatMap(set=>set.comparisons),letters:valid.every(set=>set.letters),letterReason:valid.find(set=>!set.letters)?.letterReason||'',zero:valid.some(set=>set.zero)};
    const p=s.panels[id],v=panel(id).variants[vi],unit=plotSets?v.viewBox[2]/v.width:1;
    // Single-axis vector templates already include a physical top margin. Reuse
    // that clear margin rather than reserving the complete statistics band twice.
    if(info.preservePlot&&plotSets?.length===1&&info.rowCount===1&&!info.hasFacetTitles&&plotSets[0].frame){
      const set=plotSets[0],hasHeading=[...svg.querySelectorAll('text')].some(text=>!text.closest('defs')&&(!text.closest('[id^="axes_"]')||text.parentElement?.parentElement===set.axis&&/^text_/.test(text.parentElement?.id||'')&&Number(text.getAttribute('y'))<set.frame.y));
      if(!hasHeading)info.topInsetReuse=Math.max(0,set.frame.y/unit-16);
    }
    if(plotSets&&p.annotationStyle&&(p.annotationStyle!=='letters'||info.letters)){const plan=anchoredStatisticalLayout(info,p.annotationStyle,p,s.typography,unit,vi);if(!plan.fits)info.placement='band';else if(plan.maxLines>1)info.preservePlot=true;}return info;
  }
  function statisticalExportRecords(s){
    return s.order.filter(id=>s.panels[id].statistics).map(id=>{const record=s.panels[id].statistics;return {panel:id,binding:record.binding,tableKey:record.tableKey,data_sha256:record.data_sha256,stale:!!record.stale,config:record.config,analysis:record.analysis};});
  }
  function renderStatisticalAnnotations(){
    const icon=(style,lineOnly=false)=>{const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 100 48');svg.setAttribute('aria-hidden','true');const add=(tag,attrs,text)=>{const node=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);if(text)node.textContent=text;svg.append(node);};
      if(!lineOnly){add('path',{d:'M 17 43 V 29 H 37 V 43 M 63 43 V 22 H 83 V 43',fill:'#c5cedb',stroke:'none'});add('path',{d:'M 12 43 H 88',fill:'none',stroke:'#758094','stroke-width':1});}
      if(lineOnly||['stars','hash','p'].includes(style))add('path',{d:statisticalBracketPath(27,73,lineOnly?20:16,1.6,lineOnly?style:'bracket'),fill:'none',stroke:'#334b70','stroke-width':1.4,'stroke-linejoin':'round'});
      if(!lineOnly&&style){if(style==='letters'){add('text',{x:27,y:23,'text-anchor':'middle',fill:'#334b70','font-size':13,'font-family':'Arial'},'a');add('text',{x:73,y:16,'text-anchor':'middle',fill:'#334b70','font-size':13,'font-family':'Arial'},'b');}else add('text',{x:50,y:11,'text-anchor':'middle',fill:'#334b70','font-size':style==='p'?10:13,'font-family':'Arial'},style==='p'?'P = …':style==='hash'?'##':'**');}return svg;};
    if(!$('statisticalStyleChoices').children.length)for(const [value,label]of [['','无附加标注'],['letters','字母分组'],['stars','星号'],['hash','井号'],['p','具体 P 值']]){const control=button('',()=>{$('annotationStyle').value=value;$('annotationStyle').onchange();});control.dataset.statStyle=value;const caption=document.createElement('span');caption.dataset.statCaption=label;control.append(icon(value),caption);$('statisticalStyleChoices').append(control);}
    if(!$('statisticalLineChoices').children.length)for(const [value,label]of [['bracket','括号'],['line','横线'],['rounded','圆角括号']]){const control=button('',()=>{$('annotationLine').value=value;$('annotationLine').onchange();});control.dataset.statLine=value;const caption=document.createElement('span');caption.dataset.statCaption=label;control.append(icon(value,true),caption);$('statisticalLineChoices').append(control);}
    for(const caption of document.querySelectorAll('[data-stat-caption]'))caption.textContent=T(caption.dataset.statCaption);
    const p=state().panels[selectedPanel],info=statisticalAnnotationInfo(selectedPanel),style=p.annotationStyle||'',locked=!!p.locked;
    $('annotationStyle').value=style;$('annotationLine').value=p.annotationLine||'bracket';
    $('annotationPFormat').value=p.annotationPFormat||'standard';$('annotationPFormat').disabled=locked;$('statisticalPFormatControls').hidden=style!=='p';
    $('statisticalFontFamily').value=p.annotationFont?.font||state().typography?.font||'Arial';$('statisticalBold').checked=!!p.annotationFont?.bold;$('statisticalItalic').checked=!!p.annotationFont?.italic;
    for(const key of ['statisticalFontFamily','statisticalBold','statisticalItalic'])$(key).disabled=locked||!style;
    $('facetTitleOptions').hidden=!statisticalFacetTitleElements(baseSvg(selectedPanel,p.variant)).length;$('showFacetTitles').checked=p.showFacetTitles!==false;$('showFacetTitles').disabled=locked;
    for(const control of document.querySelectorAll('[data-stat-style]')){const value=control.dataset.statStyle;control.setAttribute('aria-pressed',String(value===style));control.disabled=locked;control.title=T(value&&(!info.available||value==='letters'&&!info.letters)?'完成分析后自动应用此样式':'选择即生效');}
    for(const option of $('annotationStyle').options)option.disabled=locked;
    $('statisticalLineControls').hidden=!style||style==='letters'||!info.available;
    for(const control of document.querySelectorAll('[data-stat-line]')){control.setAttribute('aria-pressed',String(control.dataset.statLine===(p.annotationLine||'bracket')));control.disabled=locked;}
    $('statisticalStatus').textContent=info.available?T('已连接 {0} 组比较；标注随组别位置更新。',info.comparisons.length)+(info.method?' '+T(statisticalMethodName(info.method)):'')+(info.letters?'':' '+T(info.letterReason)):T(info.reason);
    $('statisticalPrecisionNote').hidden=!info.zero;
    for(const id of ['configureStatistics','methodConfigureStatistics']){const control=$(id);if(control){control.disabled=locked;control.textContent=T(p.statistics&&!p.statistics.stale?'更新统计分析':'完成统计分析');}}
    $('statisticalWorkflowNote').textContent=T(p.statistics?.stale?'图形数据已变化，请更新连接的比较数据。':info.placement==='band'?'自动统计结果区：按组别与分层排版，保留复合图的原有比例。':'缺少结果时可分析当前数据或连接已有比较结果。');
    const diagnostics=statisticalAnalysisFor(selectedPanel)?.diagnostics||[];if(diagnostics.length)$('statisticalWorkflowNote').textContent+=' '+[...new Set(diagnostics.map(d=>d[StudioI18n.language==='en'?'en':'zh']))].join(' ');
    $('statisticalFontSize').value=+((p.annotationFont?.size||state().typography?.size||9)*currentOutput().scale).toFixed(2);$('statisticalFontSize').disabled=locked||!style;
  }
  function renderHeatmapControls(){
    const tools=$('heatmapTools');if(!tools)return;
    const vi=state().panels[selectedPanel].variant,source=baseSvg(selectedPanel,vi),node=source.querySelector('[id*="studio-heat-value-"]'),info=node&&heatmapCellInfo(node.id);
    tools.hidden=!info;tools.style.display=info?'':'none';if(!info)return;
    const cfg=state().panels[selectedPanel].heatmapLabels||{visible:info.visible,decimals:info.decimals,fontSize:parseFloat(node.querySelector('text')?.style.fontSize)||8,color:'auto'};
    $('heatmapValues').checked=cfg.visible;$('heatmapDecimals').value=cfg.decimals;$('heatmapFontSize').value=+(cfg.fontSize*currentOutput().scale).toFixed(2);$('heatmapColorMode').value=cfg.color==='auto'?'auto':'custom';$('heatmapColor').value=cfg.color==='auto'?'#000000':cfg.color;$('heatmapColorHex').value=$('heatmapColor').value.toUpperCase();
    for(const input of tools.querySelectorAll('input,select'))input.disabled=!!state().panels[selectedPanel].locked||(input.id!=='heatmapValues'&&!cfg.visible)||(['heatmapColor','heatmapColorHex'].includes(input.id)&&cfg.color==='auto');
    const live=$('artboard').querySelector(`[data-panel="${selectedPanel}"]`),sizes=[...live?.querySelectorAll('[id*="studio-heat-value-"] text')||[]].map(t=>parseFloat(t.style.fontSize)).filter(Number.isFinite),actual=sizes.length?Math.min(...sizes)*currentOutput().scale:cfg.fontSize*currentOutput().scale,requested=cfg.fontSize*currentOutput().scale;
    $('heatmapFitStatus').textContent=!cfg.visible?'':actual<requested-.05?T('实际字号 {0} pt（设置上限 {1} pt）。减少小数位或放宽小图可使用更大字号。',actual.toFixed(1),requested.toFixed(1)):T('实际字号 {0} pt',actual.toFixed(1));

  }
  function updateHeatmapLabels(event){
    if(event?.target?.id==='heatmapColorHex'){const value=$('heatmapColorHex').value.trim();if(!/^#[a-f\d]{6}$/i.test(value))return say(T('请输入有效的 HEX 色值，例如 #4477AA。'));$('heatmapColor').value=value;}
    if(state().panels[selectedPanel].locked)return say(T('小图已锁定'));
    if(!$('heatmapDecimals').checkValidity()||!$('heatmapFontSize').checkValidity())return say(T('热图数值参数无效'));
    const next=copy(state());next.panels[selectedPanel].heatmapLabels={visible:$('heatmapValues').checked,decimals:Number($('heatmapDecimals').value),fontSize:Number($('heatmapFontSize').value)/currentOutput().scale,color:$('heatmapColorMode').value==='auto'?'auto':$('heatmapColor').value};
    commit(next,T('已更新热图数值标注'));
  }
  for(const id of ['heatmapValues','heatmapDecimals','heatmapFontSize','heatmapColorMode','heatmapColor','heatmapColorHex'])if($(id)){
    $(id).addEventListener('change',updateHeatmapLabels);
    if(['heatmapFontSize','heatmapDecimals','heatmapColor'].includes(id))$(id).addEventListener('input',updateHeatmapLabels);
    if(['number','text'].includes($(id).type))$(id).addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();updateHeatmapLabels(event);}});
  }
  function appendStatisticalBand(svg,id,vi,s,v,info){
    const p=s.panels[id],unit=v.viewBox[2]/v.width,plan=statisticalBandLayout(info,p.annotationStyle,v.width,p,s.typography,unit,vi),start=v.viewBox[1]+v.viewBox[3],group=document.createElementNS(NS,'g'),font=p.annotationFont?.font||s.typography?.font||'Arial',size=p.annotationFont?.size||s.typography?.size||9;
    group.setAttribute('data-stat-band','whole-panel');group.setAttribute('transform',`translate(${v.viewBox[0]} ${start})`);
    const add=(tag,attrs)=>{const el=document.createElementNS(NS,tag);for(const [k,value]of Object.entries(attrs))el.setAttribute(k,value);group.append(el);return el;};
    const text=(lines,x,y,fontSize=size,isP=false,bold=false)=>{const el=add('text',{x:x*unit,y:y*unit,'font-family':font,'font-size':fontSize*unit,fill:'#26364b','font-weight':bold||p.annotationFont?.bold?'700':'400','font-style':p.annotationFont?.italic?'italic':'normal','data-stat-result':'true'});lines.forEach((line,i)=>{const run=document.createElementNS(NS,'tspan');run.setAttribute('x',x*unit);run.setAttribute('dy',i?plan.lineHeight*unit:0);if(isP&&i===0&&line.startsWith('P')){const symbol=document.createElementNS(NS,'tspan');symbol.setAttribute('font-style','italic');symbol.textContent='P';run.append(symbol,document.createTextNode(line.slice(1)));}else run.textContent=line;el.append(run);});return el;};
    add('path',{d:`M ${plan.pad*unit} ${4*unit} H ${(v.width-plan.pad)*unit}`,fill:'none',stroke:'#d7dfe9','stroke-width':.6*unit,'data-stat-decoration':'true'});
    text(plan.titleLines,plan.pad,12+plan.titleSize,size,false,true);
    for(const row of plan.rows){
      if(row.kind==='facet'){text(row.labelLines,plan.pad,row.y+plan.fontSize,size,false,true);continue;}
      if(row.kind==='notice'){text(row.labelLines,plan.pad,row.y+plan.fontSize);continue;}
      text(row.labelLines,plan.pad,row.y+plan.fontSize);
      const valueY=row.y+plan.fontSize+(row.sideBySide?0:row.labelLines.length*plan.lineHeight);
      text(row.resultLines,row.resultX,valueY,size,row.isP);
      if(row.kind==='comparison'){
        const lineY=valueY+(row.resultLines.length-1)*plan.lineHeight+Math.max(5,plan.fontSize*.3),lineRight=v.width-plan.pad;
        add('path',{d:statisticalBracketPath(row.resultX*unit,lineRight*unit,lineY*unit,unit,p.annotationLine||'bracket'),fill:'none',stroke:'#8290a3','stroke-width':.65*unit,'data-stat-result':'true','data-stat-bracket':JSON.stringify({x1:row.resultX*unit,x2:lineRight*unit,top:lineY*unit,gap:0,unit,shape:p.annotationLine||'bracket'})});
      }
    }
    svg.append(group);svg.setAttribute('data-stat-band-height',plan.height);svg.setAttribute('data-stat-source-height',v.height);svg.setAttribute('viewBox',`${v.viewBox[0]} ${v.viewBox[1]} ${v.viewBox[2]} ${v.viewBox[3]+plan.height*unit}`);
    return plan;
  }
  function anchoredStatisticalLayout(info,style,p,typography,unit,vi){
    const sets=info.plotSets||info.sets||[info],font=p.annotationFont?.font||typography?.font||'Arial';let count=Math.max(...sets.map(set=>set.comparisons?.length||0)),metrics=statisticalLayout(style,count,p,typography,unit,vi);
    const makePlan=(value,frame)=>statisticalLabelPlan(value,style,frame?Math.max(1,frame.width/unit-8):Infinity,metrics.fontSize,text=>statisticalTextWidth(text,font,metrics.fontSize,!!p.annotationFont?.bold,!!p.annotationFont?.italic),p.annotationPFormat),values=set=>style==='letters'?comparisonLetters(set.order.length,set.comparisons):set.comparisons.map(c=>c.p);
    // If a large label cannot fit its cluster, give clusters separate vertical
    // lanes on the plot. Keep their true endpoints instead of making a table.
    const stagger=sets.some(set=>set.anchors?.kind==='semantic'&&values(set).some(value=>!makePlan(value,set.labelFrame||set.frame).fits||(style==='letters'&&set.centers?.length>1&&makePlan(value,set.frame).width*unit>Math.min(...set.centers.slice().sort((a,b)=>a-b).slice(1).map((x,i)=>x-set.centers.slice().sort((a,b)=>a-b)[i]))-2)));
    const laneOffsets=new Map();if(stagger){let maximum=0;for(const row of new Set(sets.map(set=>set.row))){let offset=0;for(const set of sets.filter(set=>set.row===row)){laneOffsets.set(set.label,offset);offset+=values(set).length;}maximum=Math.max(maximum,offset);}count=maximum;metrics=statisticalLayout('p',count,p,typography,unit,vi);}
    const lineHeight=metrics.fontSize*1.25,labelPlan=(value,set)=>makePlan(value,stagger?set.frame:set.labelFrame||set.frame);
    const plans=sets.flatMap(set=>style==='letters'?comparisonLetters(set.order.length,set.comparisons).map(value=>labelPlan(value,set)):set.comparisons.map(c=>labelPlan(c.p,set))),maxLines=Math.max(1,...plans.map(plan=>plan.lines.length)),extra=(maxLines-1)*lineHeight,titleClearance=p.showFacetTitles===false&&info.hasFacetTitles?6:0,header=Math.max(0,metrics.header+count*extra-titleClearance-(info.topInsetReuse||0));
    return {...metrics,pitch:metrics.pitch+extra,header,lineHeight,labelPlan,maxLines,stagger,laneOffsets,fits:plans.every(plan=>plan.fits),rowCount:info.rowCount||1,totalHeader:header*(info.rowCount||1)};
  }
  function legacyAnchoredStatisticalKeys(id,vi,s,info){
    const v=panel(id).variants[vi];
    // Only this older view used the result band. Facet boxes already had plot
    // anchors, so their existing generated keys must keep their original order.
    if(v.name!=='grouped_observations'||typeof v.svg!=='string'||v.svg.includes('studio-stat-anchors'))return null;
    const p=s.panels[id],style=p.annotationStyle,plan=statisticalBandLayout(info,style,v.width,p,s.typography,v.viewBox[2]/v.width,vi),sets=info.sets||[info],keys=new Map();
    const identity=(set,role,item)=>JSON.stringify([set.label,role,style==='letters'?['group',set.order[item]]:['pair',set.order[item.a],set.order[item.b]]]);
    let serial=900002,setIndex=-1; // Original band decoration and title.
    for(const row of plan.rows){
      if(row.kind==='facet'){setIndex++;serial++;continue;}
      if(row.kind==='notice'){serial++;continue;}
      const set=sets[Math.max(0,setIndex)],item=row.kind==='letters'?row.group:row.comparison;
      serial++; // Retired descriptive row label: never reuse it for a P value.
      keys.set(identity(set,'text',item),'e'+serial++);
      if(row.kind==='comparison')keys.set(identity(set,'line',item),'e'+serial++);
    }
    return {end:serial,get:(set,role,item)=>keys.get(identity(set,role,item))};
  }
  function translateStatisticalElement(svg,el,dy){
    const chain=[];for(let node=el.parentElement;node&&node!==svg;node=node.parentElement)chain.unshift(node);let parent=new DOMMatrix();for(const node of chain){const m=node.transform?.baseVal.consolidate()?.matrix;if(m)parent=parent.multiply(new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]));}
    const m=el.transform?.baseVal.consolidate()?.matrix,own=m?new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]):new DOMMatrix(),adjusted=parent.inverse().multiply(new DOMMatrix().translate(0,dy)).multiply(parent).multiply(own);el.setAttribute('transform',`matrix(${adjusted.a} ${adjusted.b} ${adjusted.c} ${adjusted.d} ${adjusted.e} ${adjusted.f})`);
  }
  function appendAnchoredStatistics(svg,id,vi,s,v,info){
    const sets=statisticalPlotAnchors(svg,info.sets)||resolvedStatisticalPlotAnchors(svg,info.plotSets);if(!sets)return false;
    const p=s.panels[id],style=p.annotationStyle,unit=v.viewBox[2]/v.width,rowCount=1+Math.max(...sets.map(set=>set.row)),metrics=anchoredStatisticalLayout({...info,plotSets:sets,rowCount},style,p,s.typography,unit,vi),header=metrics.header*unit,legacyKeys=legacyAnchoredStatisticalKeys(id,vi,s,info);
    if(legacyKeys)svg.setAttribute('data-stat-legacy-key-end',legacyKeys.end);
    const retainKey=(node,set,role,item)=>{const key=legacyKeys?.get(set,role,item);if(key){node.setAttribute('data-key',key);node.setAttribute('data-stat-legacy-key','true');}};
    const measured=sets.map(set=>({...set,...measureStatisticalAnchors(svg,set.anchors)})),rowTops=Array.from({length:rowCount},(_,row)=>Math.min(...sets.filter(set=>set.row===row).map(set=>set.frame?.y||0)));
    // Insert physical annotation space before every facet row. Artists, axes,
    // glyphs and auxiliary panels are translated together, never rescaled.
    for(const axis of svg.querySelectorAll('[id^="axes_"]')){const frame=statisticalAxisFrame(svg,axis),known=sets.find(set=>set.axis===axis),row=known?.row??(frame?rowTops.reduce((best,y,i)=>Math.abs(frame.y-y)<Math.abs(frame.y-rowTops[best])?i:best,0):0);translateStatisticalElement(svg,axis,(row+1)*header);}
    const movedHeadings=new Set();for(const set of sets){const titles=set.title?[set.title]:[...set.axis?.children||[]].filter(child=>/^text_/.test(child.id||'')).flatMap(child=>[...child.querySelectorAll('text')]).filter(text=>set.frame&&Number(text.getAttribute('y'))<set.frame.y);for(const title of titles)if(!movedHeadings.has(title)){translateStatisticalElement(svg,title,-header);title.setAttribute('data-stat-facet-title',set.row);movedHeadings.add(title);}}
    // A legend above grouped observations must stay above the newly reserved
    // comparison lanes; otherwise the highest comparison can collide with it.
    for(const axis of new Set(sets.filter(set=>set.anchors.kind==='semantic').map(set=>set.axis)))for(const legend of axis.querySelectorAll('[id^="legend_"]'))translateStatisticalElement(svg,legend,-header);
    const addText=(x,y,plan,isP,top,gap,set,item)=>{const width=plan.width*unit,frame=metrics.stagger?set.frame:set.labelFrame||set.frame;if(frame)x=Math.max(frame.x+4*unit+width/2,Math.min(frame.x+frame.width-4*unit-width/2,x));y-=(plan.lines.length-1)*metrics.lineHeight*unit;const text=document.createElementNS(NS,'text');for(const [key,val]of Object.entries({x,y,'text-anchor':'middle','font-family':p.annotationFont?.font||s.typography?.font||'Arial','font-size':(p.annotationFont?.size||s.typography?.size||9)*unit,'font-weight':p.annotationFont?.bold?'700':'400','font-style':p.annotationFont?.italic?'italic':'normal',fill:'#26364b','data-stat-top':top,'data-stat-gap':gap,'data-stat-facet':set.label||'','data-stat-row':set.row,'data-stat-result':'true','data-stat-lines':plan.lines.length,'data-stat-label-width':width}))text.setAttribute(key,val);plan.lines.forEach((line,i)=>{const run=document.createElementNS(NS,'tspan');run.setAttribute('x',x);run.setAttribute('dy',i?metrics.lineHeight*unit:0);if(isP&&line.startsWith('P')){const symbol=document.createElementNS(NS,'tspan');symbol.textContent='P';symbol.setAttribute('font-style','italic');run.append(symbol,document.createTextNode(line.slice(1)));}else run.textContent=line;text.append(run);});retainKey(text,set,'text',item);svg.append(text);};
    for(const set of measured){const shift=(set.row+1)*header,tops=set.tops.map(top=>top+shift),base=metrics.stagger?Math.min(...measured.filter(peer=>peer.row===set.row).flatMap(peer=>peer.tops))+shift:Math.min(...tops),lane=metrics.laneOffsets.get(set.label)||0;
      if(style==='letters'){const letters=comparisonLetters(set.order.length,set.comparisons);letters.forEach((letter,i)=>{const top=metrics.stagger?base:tops[i],gap=metrics.stagger?metrics.firstGap+(lane+i)*metrics.pitch:metrics.letterGap;addText(set.centers[i],top-gap*unit,metrics.labelPlan(letter,set),false,top,gap,set,i);});}
      else set.comparisons.forEach((comparison,i)=>{const x1=set.centers[comparison.a],x2=set.centers[comparison.b],gap=(lane+i)*metrics.pitch+metrics.firstGap,y=base-gap*unit,path=document.createElementNS(NS,'path'),shape=p.annotationLine||'bracket';for(const [key,val]of Object.entries({d:statisticalBracketPath(x1,x2,y,unit,shape),fill:'none',stroke:'#26364b','stroke-width':.7*unit,'data-stat-bracket':JSON.stringify({x1,x2,top:base,gap,shape,unit}),'data-stat-facet':set.label||'','data-stat-row':set.row,'data-stat-result':'true'}))path.setAttribute(key,val);retainKey(path,set,'line',comparison);svg.append(path);addText((x1+x2)/2,y-metrics.labelGap*unit,metrics.labelPlan(comparison.p,set),style==='p',base,gap+metrics.labelGap,set,comparison);});
    }
    svg.setAttribute('data-stat-header',metrics.totalHeader);svg.setAttribute('data-stat-first-header',metrics.header);svg.setAttribute('data-stat-preserve','true');svg.setAttribute('viewBox',`${v.viewBox[0]} ${v.viewBox[1]} ${v.viewBox[2]} ${v.viewBox[3]+metrics.totalHeader*unit}`);return true;
  }
  function measureConditionMatrixAxes(svg,sets){
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';host.append(svg);document.body.append(host);
    try{const root=svg.getScreenCTM(),matrix=node=>root.inverse().multiply(node.getScreenCTM()),point=(node,x,y)=>new DOMPoint(x,y).matrixTransform(matrix(node));return sets.map(set=>{
      const centers=set.anchors.nodes.map(node=>{const declared=node.getAttribute('data-studio-category-center');if(declared!==null&&Number.isFinite(Number(declared)))return Number(declared);const tick=node.closest?.('[id^="xtick_"]')?.querySelector('use')||node;return point(tick,Number(tick.getAttribute('x'))||0,Number(tick.getAttribute('y'))||0).x;}),xaxis=set.anchors.nodes[0]?.closest('[id^="matplotlib.axis_"]'),texts=[...xaxis?.querySelectorAll('text')||[]].filter(node=>node.style.display!=='none');
      const bottom=Math.max(point(set.axis,set.frame.x,set.frame.y+set.frame.height).y,...texts.map(node=>{const box=node.getBBox();return Math.max(...[[box.x,box.y],[box.x+box.width,box.y],[box.x,box.y+box.height],[box.x+box.width,box.y+box.height]].map(([x,y])=>point(node,x,y).y));}));return {...set,centers,bottom};
    });}finally{svg.remove();host.remove();}
  }
  const conditionSpacingHeightCache=new WeakMap();
  function conditionMatrixHeight(id,s,vi=s.panels[id].variant){
    const config=s.panels[id].conditionMatrix;if(!config||config.enabled===false||!config.rows?.length)return 0;
    const v=panel(id).variants[vi],info=conditionMatrixInfo(id,s,vi);
    if(!info.available)return 0;
    if(s.panels[id].groupSpacing&&typeof StudioGroupSpacing!=='undefined'){
      let cache=conditionSpacingHeightCache.get(s);if(!cache){cache=new Map();conditionSpacingHeightCache.set(s,cache);}const key=id+'/'+vi,previous=cache.get(key);if(previous?.source===v)return previous.height;
      const svg=editedSvg(id,vi,s,false,null,true);StudioGroupSpacing.apply(svg,s.panels[id].groupSpacing.factor,{orders:groupSpacingOrders(id,s),view:v.name});const sets=resolvedStatisticalPlotAnchors(svg,info.sets);if(sets)info.sets=sets;
      const height=conditionMatrixLayout(info,config,s.typography,v.viewBox[2]/v.width).totalHeight;cache.set(key,{source:v,height});return height;
    }
    return conditionMatrixLayout(info,config,s.typography,v.viewBox[2]/v.width).totalHeight;
  }
  function appendConditionMatrix(svg,id,vi,s,v){
    const p=s.panels[id],config=p.conditionMatrix;if(!config||config.enabled===false||!config.rows?.length)return null;
    const reference=conditionMatrixInfo(id,s,vi,v.svg===panel(id).variants[vi].svg?null:reflowSvg(id,vi,v)),sets=resolvedStatisticalPlotAnchors(svg,reference.sets);if(!sets?.length)return null;
    const info={...reference,sets},unit=v.viewBox[2]/v.width,plan=conditionMatrixLayout(info,config,s.typography,unit);if(!plan.fits){svg.setAttribute('data-condition-blocked','true');return plan;}const measured=measureConditionMatrixAxes(svg,sets),before=row=>plan.heights.slice(0,row).reduce((a,b)=>a+b,0)*unit;
    // Make room below each category-axis row. The original data and glyphs
    // keep their physical dimensions; following facet rows only translate.
    const rowTops=Array.from({length:info.rowCount},(_,row)=>Math.min(...sets.filter(set=>set.row===row).map(set=>set.frame.y))),bottoms=Array.from({length:info.rowCount},(_,row)=>Math.max(...measured.filter(set=>set.row===row).map(set=>set.bottom)));
    for(const axis of svg.querySelectorAll('[id^="axes_"]')){const own=sets.find(set=>set.axis===axis),frame=statisticalAxisFrame(svg,axis),row=own?.row??(frame?rowTops.reduce((best,y,i)=>Math.abs(frame.y-y)<Math.abs(frame.y-rowTops[best])?i:best,0):0);if(before(row))translateStatisticalElement(svg,axis,before(row));}
    for(const node of svg.querySelectorAll('[data-stat-top],[data-stat-bracket]')){const row=Number(node.getAttribute('data-stat-row'))||0;if(before(row))translateStatisticalElement(svg,node,before(row));}
    for(const band of svg.querySelectorAll('[data-stat-band]'))translateStatisticalElement(svg,band,plan.totalHeight*unit);
    const group=document.createElementNS(NS,'g');group.setAttribute('data-condition-matrix','true');
    const key=(axis,row,column)=>{let hash=2166136261;for(const char of axis+'|'+row+'|'+column){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}return 'e8'+(hash>>>0);};
    const text=(lines,x,y,set,row,column)=>{const node=document.createElementNS(NS,'text');for(const [name,value]of Object.entries({x,y,'text-anchor':column==='@label'?'end':'middle','font-family':plan.font,'font-size':plan.size*unit,'font-weight':plan.bold?'700':'400','font-style':plan.italic?'italic':'normal',fill:'#26364b','data-condition-cell':column,'data-condition-row':row,'data-condition-axis':set.axis.id,'data-key':key(set.axis.id,row,column)}))node.setAttribute(name,value);lines.forEach((line,i)=>{const span=document.createElementNS(NS,'tspan');span.setAttribute('x',x);span.setAttribute('dy',i?plan.lineHeight*unit:0);span.textContent=line;node.append(span);});const props=editsFor(id,vi,s)[node.getAttribute('data-key')]||{};for(const [prop,value]of Object.entries(props))if(!prop.startsWith('offset-')){if(prop==='hidden')node.style.display='none';else if(prop==='text')node.textContent=value;else node.style.setProperty(prop,(prop==='font-size'||prop==='stroke-width')?value+'px':value);}group.append(node);};
    for(const set of plan.sets){const positions=measured.find(entry=>entry.axis===set.axis),start=bottoms[set.row]+before(set.row)+plan.pad*unit;let y=start+plan.size*unit;set.rows.forEach((row,index)=>{text(row.label.lines,set.right*unit,y,set,index,'@label');row.values.forEach((value,i)=>text(value.lines,positions.centers[i],y,set,index,set.order[i]));y+=plan.rowHeights[set.row][index]*unit;});}
    svg.append(group);const box=svg.getAttribute('viewBox').split(/\s+/).map(Number);svg.setAttribute('viewBox',`${box[0]} ${box[1]} ${box[2]} ${box[3]+plan.totalHeight*unit}`);svg.setAttribute('data-condition-height',plan.totalHeight);svg.setAttribute('data-condition-fits',String(plan.fits));svg.setAttribute('data-condition-font-size',plan.size);svg.setAttribute('data-condition-font-requested',plan.requestedSize);return plan;
  }
  function annotationHeight(id,s,vi=s.panels[id].variant,width=panel(id).variants[vi].width){const p=s.panels[id],style=p.annotationStyle;if(!style)return 0;const info=statisticalAnnotationInfo(id,s,vi),v=panel(id).variants[vi];if(!info.available||style==='letters'&&!info.letters)return 0;return info.placement==='band'?statisticalBandLayout(info,style,width,p,s.typography,v.viewBox[2]/v.width,vi).height:anchoredStatisticalLayout(info,style,p,s.typography,v.viewBox[2]/v.width,vi).totalHeader;}
  function annotationTopHeight(id,s){return s.panels[id].annotationStyle&&statisticalAnnotationInfo(id,s).placement!=='band'?annotationHeight(id,s):0;}
  function annotationFirstTopHeight(id,s){const total=annotationTopHeight(id,s);return total?total/(statisticalAnnotationInfo(id,s).rowCount||1):0;}
  function drawingHeight(id,s){return panel(id).variants[s.panels[id].variant].height+annotationHeight(id,s)+conditionMatrixHeight(id,s);}
  function groupSpacingOrders(id,s){const analysis=statisticalAnalysisFor(id,s)||{};return [analysis,...(analysis.facets||[])].map(result=>result.group_order).filter(Array.isArray);}
  function editedSvg(id, vi, s=state(), raw=false, reflow=null, spacingSource=false) {
    const svg = reflow?reflowSvg(id,vi,reflow):baseSvg(id,vi);
    if(!raw&&s.panels[id].showFacetTitles===false)for(const title of statisticalFacetTitleElements(svg))title.style.display='none';
    if(!raw)applyHeatmapPalette(svg,s.panels[id].heatmapPalette);
    if(!raw&&s.typography&&!s.panels[id].locked&&(panel(id).provenance!=='user-import'||s.panels[id].useUnifiedTypography)&&!['gallery','roc','roc_results'].includes(panel(id).recipe?.family)){const v=panel(id).variants[vi],ratio=v.viewBox[2]/v.width;for(const text of svg.querySelectorAll('text')){const locked=s.panels[id].lockedElements?.[vi]||[];if([text,...text.querySelectorAll('tspan')].some(el=>locked.includes(el.getAttribute('data-key'))))continue;const role=text.getAttribute('data-role'),size=(s.typography.size+(['axis','other'].includes(role)?1:0))*ratio,previous=parseFloat(text.style.fontSize||text.getAttribute('font-size')||size);preparePositionedTextEdit(text,{'font-size':String(size)});text.style.fontFamily=s.typography.font;text.style.fontSize=size+'px';for(const child of text.querySelectorAll('tspan')){const old=parseFloat(child.style.fontSize||child.getAttribute('font-size'));child.style.fontFamily=s.typography.font;if(Number.isFinite(old)&&previous>0)child.style.fontSize=old*size/previous+'px';}}}
    if(!raw && s.panels[id].geometry){
      const bars=[...svg.querySelectorAll('[id^="studio-bar-"]')].map(group=>{const path=group.querySelector('path'),values=path?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);return values?.length>=8?{group,cx:(values[0]+values[2])/2}:null;}).filter(Boolean);
      if(bars.length){const center=bars.reduce((sum,b)=>sum+b.cx,0)/bars.length,{barWidth,groupGap}=s.panels[id].geometry;
        bars.forEach(({group,cx},i)=>{const delta=(cx-center)*(groupGap-1);group.setAttribute('transform',`translate(${cx+delta} 0) scale(${barWidth} 1) translate(${-cx} 0)`);for(const el of svg.querySelectorAll(`[id^="studio-group-${i}-"]`))el.setAttribute('transform',`translate(${delta} 0)`);});
      }
    }
    const marks=typeof StudioMarkStyle!=='undefined'?StudioMarkStyle.inspect(svg):null;
    if(!raw&&marks)StudioMarkStyle.apply(svg,s.panels[id].markStyle,s.panels[id].errorDirection||'both');
    if(!raw&&!marks?.errors.length&&s.panels[id].errorDirection&&s.panels[id].errorDirection!=='both'){
      const direction=s.panels[id].errorDirection;
      for(const bar of svg.querySelectorAll('[id^="studio-bar-"]')){
        const i=bar.id.match(/studio-bar-(\d+)$/)?.[1],values=bar.querySelector('path')?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);if(i===undefined||!values||values.length<8)continue;
        // The bar's second horizontal edge is the estimate, including negative bars.
        const center=values[5];
        for(const group of svg.querySelectorAll(`[id^="studio-group-${i}-error-"]`)){
          for(const path of group.querySelectorAll('path:not(defs path)')){const v=path.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);if(v?.length===4&&Math.abs(v[0]-v[2])<.001){path.setAttribute('d',direction==='positive'?`M ${v[0]} ${center} L ${v[2]} ${Math.min(v[1],v[3])}`:`M ${v[0]} ${Math.max(v[1],v[3])} L ${v[2]} ${center}`);}}
          for(const cap of group.querySelectorAll('use')){const y=+cap.getAttribute('y');if(direction==='positive'?y>center:y<center)cap.style.display='none';}
        }
      }
    }
    if(!raw)applyHeatmapValueLabels(svg,s.panels[id].heatmapLabels,panel(id).variants[vi].viewBox[2]/panel(id).variants[vi].width,s.panels[id].heatmapPalette,false);
    if (!raw) for (const [key, props] of Object.entries(editsFor(id,vi,s))) {
      const el=svg.querySelector(`[data-key="${key}"]`); if (!el) continue;
      preparePositionedTextEdit(el,props);
      for (const [prop,val] of Object.entries(props)) {
        if(prop==='hidden'){el.style.display='none';}
        else if (prop==='text') { if (el.matches('text,tspan')) {if(typeof StudioRichText!=='undefined')StudioRichText.replaceText(el,val);else el.textContent=val;} }
        else if(prop!=='rich-text'&&!prop.startsWith('offset-')&&!prop.startsWith('stat-'))el.style.setProperty(prop, (prop==='font-size'||prop==='stroke-width') ? val+'px' : val);
      }
    }
    // Work on complete category groups after typography, before dependent
    // statistics/conditions; never scale glyphs or mutate source assets.
    if(spacingSource)return svg;
    if(!raw&&s.panels[id].groupSpacing&&typeof StudioGroupSpacing!=='undefined')StudioGroupSpacing.apply(svg,s.panels[id].groupSpacing.factor,{orders:groupSpacingOrders(id,s),view:panel(id).variants[vi].name});
    if(!raw&&s.panels[id].annotationStyle&&statisticalAnnotationInfo(id,s,vi).available){
      const info=statisticalAnnotationInfo(id,s,vi),style=s.panels[id].annotationStyle,v=reflow||panel(id).variants[vi];
      if(info.placement==='band'&&(style!=='letters'||info.letters))appendStatisticalBand(svg,id,vi,s,v,info);
      else if(info.preservePlot&&(style!=='letters'||info.letters))appendAnchoredStatistics(svg,id,vi,s,v,info);
      else if(info.placement==='plot'){
      const comparisons=info.comparisons,ratio=v.viewBox[2]/v.width,metrics=statisticalLayout(style,comparisons.length,s.panels[id],s.typography,ratio,vi),header=annotationHeight(id,s,vi,v.width)*ratio;
      const anchors=statisticalAnchorElements(svg,info.order),{centers,tops}=anchors?measureStatisticalAnchors(svg,anchors):{centers:[],tops:[]};
      if(header&&centers.length){
        // Keep figure-level summaries above the newly reserved annotation band.
        // Conjugating the translation preserves their original nested transforms.
        for(const title of svg.querySelectorAll('text[data-role="other"]'))if(!title.closest('[id^="axes_"]')&&!title.closest('defs')){
          const chain=[];for(let node=title.parentElement;node&&node!==svg;node=node.parentElement)chain.unshift(node);
          let parent=new DOMMatrix();for(const node of chain){const m=node.transform?.baseVal.consolidate()?.matrix;if(m)parent=parent.multiply(new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]));}
          const m=title.transform?.baseVal.consolidate()?.matrix,own=m?new DOMMatrix([m.a,m.b,m.c,m.d,m.e,m.f]):new DOMMatrix(),adjusted=parent.inverse().multiply(new DOMMatrix().translate(0,-header)).multiply(parent).multiply(own);
          title.setAttribute('transform',`matrix(${adjusted.a} ${adjusted.b} ${adjusted.c} ${adjusted.d} ${adjusted.e} ${adjusted.f})`);
        }
        // Measure actual data artists, then reserve physical space for each text layer.
        const content=document.createElementNS(NS,'g');content.setAttribute('transform',`translate(0 ${header})`);for(const child of [...svg.children])if(child.localName!=='defs')content.append(child);svg.append(content);svg.setAttribute('viewBox',`${v.viewBox[0]} ${v.viewBox[1]} ${v.viewBox[2]} ${v.viewBox[3]+header}`);
        svg.setAttribute('data-stat-header',metrics.header);
        const addText=(x,y,value,isP=false,anchorY=null,gap=8)=>{const text=document.createElementNS(NS,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.setAttribute('text-anchor','middle');if(anchorY!==null){text.setAttribute('data-stat-top',anchorY);text.setAttribute('data-stat-gap',gap);}text.setAttribute('font-family',s.panels[id].annotationFont?.font||s.typography?.font||'Arial');text.setAttribute('font-size',(s.panels[id].annotationFont?.size||s.typography?.size||9)*ratio);text.setAttribute('font-weight',s.panels[id].annotationFont?.bold?'700':'400');text.setAttribute('font-style',s.panels[id].annotationFont?.italic?'italic':'normal');if(isP){const symbol=document.createElementNS(NS,'tspan');symbol.textContent='P';symbol.setAttribute('font-style','italic');text.append(symbol,document.createTextNode(value));}else text.textContent=value;svg.append(text);};
        if(style==='letters'){const letters=comparisonLetters(centers.length,comparisons);letters.forEach((text,i)=>addText(centers[i],header+tops[i]-metrics.letterGap*ratio,text,false,header+tops[i],metrics.letterGap));}
        else comparisons.forEach((c,i)=>{const x1=centers[c.a],x2=centers[c.b],gap=i*metrics.pitch+metrics.firstGap,y=header+Math.min(...tops)-gap*ratio,path=document.createElementNS(NS,'path'),shape=s.panels[id].annotationLine||'bracket';path.setAttribute('d',statisticalBracketPath(x1,x2,y,ratio,shape));path.setAttribute('data-stat-bracket',JSON.stringify({x1,x2,top:header+Math.min(...tops),gap,shape,unit:ratio}));path.setAttribute('fill','none');path.setAttribute('stroke','#20242A');path.setAttribute('stroke-width',.7*ratio);svg.append(path);addText((x1+x2)/2,y-metrics.labelGap*ratio,style==='p'?statisticalPText(c.p,s.panels[id].annotationPFormat):statisticalSymbol(c.p,style),style==='p',header+Math.min(...tops),gap+metrics.labelGap);});
      }
      }
    }
    if(!raw)appendConditionMatrix(svg,id,vi,s,reflow||panel(id).variants[vi]);
    if(!raw)for(const [key,cfg]of Object.entries(s.panels[id].scales?.[vi]||{})){
      const img=svg.querySelector(`[data-key="${key}"]`);if(!img||img.localName!=='image')continue;
      const matrix=img.transform.baseVal.consolidate()?.matrix||{a:1,b:0,c:0,d:1,e:0,f:0};if(Math.abs(matrix.b)>1e-8||Math.abs(matrix.c)>1e-8)continue;
      const ix=+img.getAttribute('x')||0,iy=+img.getAttribute('y')||0,iw=+img.getAttribute('width'),ih=+img.getAttribute('height');
      const x=Math.min(matrix.a*ix+matrix.e,matrix.a*(ix+iw)+matrix.e),y=Math.min(matrix.d*iy+matrix.f,matrix.d*(iy+ih)+matrix.f),w=Math.abs(matrix.a*iw),h=Math.abs(matrix.d*ih);
      const unit=panel(id).variants[vi].viewBox[2]/panel(id).variants[vi].width,size=cfg.size*unit,thick=cfg.thickness*unit,len=w*cfg.length/cfg.calibration,pad=5*unit,textWidth=String(cfg.length).length*size*.65+size*2;
      const boxW=Math.max(len,textWidth)+2*pad,boxH=size+thick+3*pad,left=cfg.position.endsWith('r')?x+w-boxW-pad:x+pad,top=cfg.position.startsWith('t')?y+pad:y+h-boxH-pad;
      const group=document.createElementNS(NS,'g'),add=(tag,attrs,text)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text)el.textContent=text;group.append(el);};
      if(cfg.background)add('rect',{x:left,y:top,width:boxW,height:boxH,fill:'#ffffff',opacity:cfg.alpha});
      add('rect',{x:left+(boxW-len)/2,y:top+pad,width:len,height:thick,fill:cfg.color});
      add('text',{x:left+boxW/2,y:top+pad*2+thick+size*.8,'text-anchor':'middle','font-size':size,'font-family':cfg.font,'font-weight':cfg.bold?'700':'400',fill:cfg.color},cfg.length+' μm');img.parentElement.append(group);
    }
    if(!raw)refreshHeatmapLabelContrast(svg,s.panels[id].heatmapLabels,s.panels[id].heatmapPalette,editsFor(id,vi,s));
    let generated=900000;generated=Math.max(generated,Number(svg.getAttribute('data-stat-legacy-key-end'))||0);const generatedUsed=new Set([...svg.querySelectorAll('[data-key]')].map(el=>el.getAttribute('data-key')));for(const el of svg.querySelectorAll('text,path,line,rect'))if(!el.closest('defs')&&(!el.hasAttribute('data-key')||el.hasAttribute('data-stat-legacy-key'))){if(!el.hasAttribute('data-key')){while(generatedUsed.has('e'+generated))generated++;el.setAttribute('data-key','e'+generated++);}const props=editsFor(id,vi,s)[el.getAttribute('data-key')]||{};if(!raw)for(const [prop,value]of Object.entries(props))if(prop!=='rich-text'&&!prop.startsWith('offset-')&&!prop.startsWith('stat-')){if(prop==='hidden')el.style.display='none';else if(prop==='text'){if(el.hasAttribute('data-stat-result')||el.hasAttribute('data-stat-top')){el.setAttribute('data-stat-manual','true');el.setAttribute('data-stat-original',el.textContent);}if(typeof StudioRichText!=='undefined')StudioRichText.replaceText(el,value);else el.textContent=value;}else el.style.setProperty(prop,(prop==='font-size'||prop==='stroke-width')?value+'px':value);}}
    if(!raw&&typeof StudioRichText!=='undefined')for(const [key,props]of Object.entries(editsFor(id,vi,s)))if(props['rich-text']){const el=svg.querySelector(`[data-key="${key}"]`);if(el?.matches('text,tspan'))StudioRichText.apply(el,props['rich-text']);}
    return svg;
  }
  function clearStatisticalResultEdits(next,id,previous=state()){
    const reset=['text','hidden','offset-x','offset-y','stat-left','stat-right','stat-shape'],target=next.panels[id];
    for(const [vi,edits]of Object.entries(target.edits||{})){
      if(!Object.values(edits).some(props=>reset.some(key=>key in props)))continue;
      const keys=new Set();
      // Both renderings matter: a method/style switch can produce different
      // generated keys, while stale results exist only in the new rendering.
      for(const snapshot of [previous,next]){
        const svg=editedSvg(id,+vi,snapshot);
        for(const node of svg.querySelectorAll('[data-stat-top],[data-stat-bracket],[data-stat-result]')){const key=node.getAttribute('data-key');if(key)keys.add(key);}
      }
      for(const key of keys){const props=edits[key];if(!props)continue;for(const prop of reset)delete props[prop];if(!Object.keys(props).length)delete edits[key];}
    }
  }
  function clearStatisticalFontEdits(next,id,props,previous=state()){
    const reset=props.filter(prop=>['font-size','font-family','font-weight','font-style'].includes(prop)),target=next.panels[id];if(!reset.length)return;
    for(const [vi,edits]of Object.entries(target.edits||{})){
      if(!Object.values(edits).some(values=>reset.some(prop=>prop in values)))continue;
      const keys=new Set();for(const snapshot of [previous,next]){const svg=editedSvg(id,+vi,snapshot);for(const node of svg.querySelectorAll('[data-stat-top],[data-stat-bracket],[data-stat-result]'))for(const child of [node,...node.querySelectorAll('[data-key]')]){const key=child.getAttribute('data-key');if(key)keys.add(key);}}
      for(const key of keys){const values=edits[key];if(!values)continue;for(const prop of reset)delete values[prop];if(!Object.keys(values).length)delete edits[key];}
    }
  }
  function transferStatisticalStyleEdits(next,id,previous=state(),force=false){
    const before=previous.panels[id],after=next.panels[id];if(!force&&before.annotationStyle===after.annotationStyle)return;
    const compatible=['p','stars','hash'].includes(before.annotationStyle)&&['p','stars','hash'].includes(after.annotationStyle);
    const statistical=node=>['data-stat-top','data-stat-bracket','data-stat-result'].some(attr=>node.hasAttribute(attr)),generated=node=>/^e9\d{5}$/.test(node.getAttribute('data-key')||'');
    const variants=new Set([...Object.keys(after.edits||{}),...Object.keys(after.lockedElements||{}),...Object.keys(after.elementGroups||{})]);
    for(const vi of variants){
      // Inspect clean renderings: a former line's properties must never shape a
      // new letter, and changing annotation count also shifts later scale bars.
      const cleanOld=copy(previous),cleanNew=copy(next);cleanOld.panels[id].edits={};cleanNew.panels[id].edits={};
      const oldNodes=[...editedSvg(id,+vi,cleanOld).querySelectorAll('[data-key]')].filter(generated),newNodes=[...editedSvg(id,+vi,cleanNew).querySelectorAll('[data-key]')].filter(generated),mapping=new Map(),newStatistics=new Map();
      const pair=(oldList,newList)=>{if(oldList.length!==newList.length)return;oldList.forEach((node,index)=>{if(node.localName===newList[index].localName)mapping.set(node.getAttribute('data-key'),newList[index].getAttribute('data-key'));});};
      pair(oldNodes.filter(node=>!statistical(node)),newNodes.filter(node=>!statistical(node)));
      if(compatible)pair(oldNodes.filter(statistical),newNodes.filter(statistical));
      for(const node of newNodes.filter(statistical))newStatistics.set(node.getAttribute('data-key'),node);
      const oldKeys=new Set(oldNodes.map(node=>node.getAttribute('data-key'))),keyFor=key=>oldKeys.has(key)?mapping.get(key):/^e9\d{5}$/.test(key)?undefined:key,edits={};
      for(const [key,props]of Object.entries(after.edits?.[vi]||{})){const target=keyFor(key);if(!target)continue;const values=copy(props),node=newStatistics.get(target);if(node){delete values.text;if(values['rich-text']&&typeof StudioRichText!=='undefined'){const record=StudioRichText.remap(values['rich-text'],node.textContent);if(record.runs.length)values['rich-text']=JSON.stringify(record);else delete values['rich-text'];}}if(Object.keys(values).length)edits[target]=values;}
      if(after.edits?.[vi])after.edits[vi]=edits;
      if(after.lockedElements?.[vi])after.lockedElements[vi]=after.lockedElements[vi].map(keyFor).filter(Boolean);
      if(after.elementGroups?.[vi])after.elementGroups[vi]=after.elementGroups[vi].map(group=>group.map(keyFor).filter(Boolean)).filter(group=>group.length>1);
    }
  }
  function renderAlignmentGuideControls(){
    const guides=state().alignmentGuides||[];if(!guides.some(guide=>guide.id===selectedAlignmentGuide))selectedAlignmentGuide=null;
    if($('deleteAlignmentGuide'))$('deleteAlignmentGuide').disabled=!selectedAlignmentGuide;
    if($('clearAlignmentGuides'))$('clearAlignmentGuides').disabled=!guides.length;
    if($('alignmentGuideStatus'))$('alignmentGuideStatus').textContent=guides.length?T('共 {0} 条参考线；拖动调整，按 Delete 删除所选线。',guides.length):T('参考线仅用于编辑对齐，不随图片导出。');
    if($('canvasQuickToolbar'))renderQuickToolbar();
  }
  function addAlignmentGuide(axis){const next=copy(state()),l=layout(next);next.alignmentGuides||=[];const number=Math.max(Date.now(),0,...next.alignmentGuides.map(guide=>Number(guide.id.slice(6))+1));selectedAlignmentGuide='guide-'+number;next.alignmentGuides.push({id:selectedAlignmentGuide,axis,position:(axis==='x'?l.width:l.height)/2});commit(next,T('已添加对齐参考线'));}
  function deleteAlignmentGuide(){if(!selectedAlignmentGuide)return false;const next=copy(state());next.alignmentGuides=(next.alignmentGuides||[]).filter(guide=>guide.id!==selectedAlignmentGuide);selectedAlignmentGuide=null;return commit(next,T('已删除对齐参考线'));}
  function namespace(svg) {
    const prefix = 'f' + (++renderSerial) + '-';
    if(typeof StudioGroupSpacing!=='undefined')StudioGroupSpacing.namespaceMetadata(svg,prefix);
    for(const node of svg.querySelectorAll('metadata'))if(/(?:^|-)studio-stat-anchors$/.test(node.id||'')){const record=statisticalAnchorMetadata(node.textContent);if(record){for(const axis of record.axes){axis.axis=prefix+axis.axis;for(const cell of axis.groups)cell.members=cell.members.map(id=>prefix+id);}node.textContent=JSON.stringify(record);}}
    for (const el of [svg,...svg.querySelectorAll('*')]) {
      if (el.id) el.id=prefix+el.id;
      for (const a of [...el.attributes]) {
        if (a.localName==='href' && a.value.startsWith('#')) a.value='#'+prefix+a.value.slice(1);
        else if (/url\(/i.test(a.value)) a.value=a.value.replace(/url\(\s*['"]?#([^\s)'" ]+)['"]?\s*\)/g,(_,id)=>`url(#${prefix}${id})`);
      }
    }
    return svg;
  }
  let compactLayoutCache=new WeakMap(),compactMetricCache=null,compactFontEpoch=0;
  function compactLayout(base,s){
    const sources=s.order.map(id=>panel(id).variants[s.panels[id].variant]),renders=Object.entries(project.layoutRenders||{}).map(([key,v])=>key+':'+v.sha256).join('|')+';'+Object.entries(project.heatmapRenders||{}).map(([key,v])=>key+':'+v.sha256).join('|')+';'+Object.entries(project.statisticalRenders||{}).map(([key,v])=>key+':'+v.binding).join('|'),cached=compactLayoutCache.get(s),language=StudioI18n.language;
    if(cached?.owner===project&&cached.renders===renders&&cached.fontEpoch===compactFontEpoch&&cached.language===language&&cached.sources.every((v,i)=>v===sources[i]))return cached.layout;
    let result;const g=gridFor(s);
    if(s.order.some(id=>g.places[id].cs!==1||g.places[id].rs!==1))result={available:false,reason:'spanning-panels',layout:base};
    else try{
      // Gutter dragging changes only cell translations. Reuse local ink bounds
      // instead of measuring every glyph/point again on each animation frame.
      const metricKey=!(s.overlays?.length)?JSON.stringify({...s,gap:undefined,gapX:undefined,gapY:undefined}):null,previous=compactMetricCache;
      let measured;
      if(metricKey&&previous?.owner===project&&previous.key===metricKey&&previous.renders===renders&&previous.fontEpoch===compactFontEpoch&&previous.language===language&&previous.sources.every((v,i)=>v===sources[i])){
        measured={ink:Object.fromEntries(base.positions.map(pos=>{const box=previous.ink[pos.id];return [pos.id,box?{...box,x:box.x+pos.x,y:box.y+pos.y}:null];})),overlays:[]};
      }else{
        measured=StudioCompactWhitespace.measure(composite(false,false,s,null,true));
        if(metricKey)compactMetricCache={owner:project,key:metricKey,renders,fontEpoch:compactFontEpoch,language,sources,ink:Object.fromEntries(base.positions.map(pos=>{const box=measured.ink[pos.id];return [pos.id,box?{...box,x:box.x-pos.x,y:box.y-pos.y}:null];}))};
      }
      result=StudioCompactWhitespace.plan({layout:base,places:g.places,...measured,padding:4});
    }catch{result={available:false,reason:'unmeasurable',layout:base};}
    const next={...result.layout,compactStatus:{available:result.available,reason:result.reason}};
    compactLayoutCache.set(s,{owner:project,renders,fontEpoch:compactFontEpoch,language,sources,layout:next});return next;
  }
  function renderCompactWhitespaceControls(){
    const control=$('compactWhitespace');if(!control)return;control.checked=!!state().compactWhitespace;control.disabled=original;
    const l=state().compactWhitespace?layout():null,status=l?.compactStatus,reason=status?.reason;
    $('compactWhitespaceStatus').textContent=original?T('返回编辑版后调整留白。'):!state().compactWhitespace?T('保留标题、轴标签与图例；只移除没有内容的外部留白。'):reason==='spanning-panels'?T('当前布局含跨格小图；保持原留白，改为单格布局后可收紧。'):reason==='cross-panel-overlay'?T('有标注跨越小图边界；保持原留白，移入单个格子后可收紧。'):reason==='outside-panel-content'?T('部分内容超出小图边界；保持原留白，请先调整内容位置。'):status?.available?T('已收紧横向 {0} pt、纵向 {1} pt；编辑后自动重新计算。',(l.compact.reducedX).toFixed(1),(l.compact.reducedY).toFixed(1)):T('当前内容无法可靠测量，已保留原留白。');
  }
  function bindCompactWhitespaceControls(){
    if(!$('compactWhitespace'))return;
    $('compactWhitespace').onchange=()=>{const next=copy(state());next.compactWhitespace=$('compactWhitespace').checked;commit(next,T(next.compactWhitespace?'已自动收紧留白':'已恢复原始留白'));};
    document.fonts?.addEventListener?.('loadingdone',()=>{compactFontEpoch++;compactLayoutCache=new WeakMap();if(state().compactWhitespace){renderCanvas();renderCompactWhitespaceControls();}});
  }
  function layout(s=state(),skipCompact=false) {
    const g=gridFor(s), sum=a=>a.reduce((x,y)=>x+y,0),gapX=s.gapX??s.gap,gapY=s.gapY??s.gap;
    const widths=g.widths?.slice()||Array(s.columns).fill(0),heights=g.heights?.slice()||Array(g.rows).fill(0);
    const grow=(a,start,span,size,gap)=>{const deficit=size-sum(a.slice(start,start+span))-gap*(span-1);if(deficit>0)for(let i=start;i<start+span;i++)a[i]+=deficit/span;};
    const ordered=[...s.order].sort((a,b)=>g.places[a].rs*g.places[a].cs-g.places[b].rs*g.places[b].cs);
    // Resolve physical widths first, then reserve a common footer in each ending row.
    // The original artwork is never stretched to create statistical annotation space.
    for(const id of ordered){const p=g.places[id],v=panel(id).variants[s.panels[id].variant];grow(widths,p.col,p.cs,v.width,gapX);}
    const fallbackW=Math.min(...widths.filter(x=>x>0));
    for(let i=0;i<widths.length;i++)if(!widths[i])widths[i]=fallbackW;
    const conditionHeights=Array(g.rows).fill(0),statisticsBands=Array(g.rows).fill(0),statisticsFirstTops=Array(g.rows).fill(0),statisticsInnerTops=Array(g.rows).fill(0);
    for(const id of ordered){const p=g.places[id],total=annotationTopHeight(id,s),first=annotationFirstTopHeight(id,s);statisticsFirstTops[p.row]=Math.max(statisticsFirstTops[p.row],first);statisticsInnerTops[p.row]=Math.max(statisticsInnerTops[p.row],total-first);}
    const statisticsTops=statisticsFirstTops.map((first,i)=>first+statisticsInnerTops[i]);
    for(const id of ordered){const p=g.places[id],vi=s.panels[id].variant;if(!s.panels[id].annotationStyle||statisticalAnnotationInfo(id,s).placement!=='band')continue;const width=sum(widths.slice(p.col,p.col+p.cs))+gapX*(p.cs-1),height=Math.max(annotationHeight(id,s,vi,width),annotationHeight(id,s,vi));statisticsBands[p.row+p.rs-1]=Math.max(statisticsBands[p.row+p.rs-1],height);}
    for(const id of ordered){const p=g.places[id];conditionHeights[p.row+p.rs-1]=Math.max(conditionHeights[p.row+p.rs-1],conditionMatrixHeight(id,s));}
    for(const id of ordered){const p=g.places[id],v=panel(id).variants[s.panels[id].variant];grow(heights,p.row,p.rs,v.height+statisticsTops[p.row]+statisticsBands[p.row+p.rs-1]+conditionHeights[p.row+p.rs-1],gapY);}
    const fallbackH=Math.min(...heights.filter(x=>x>0));
    for(let i=0;i<heights.length;i++)heights[i]=Math.max(heights[i]||fallbackH,222+statisticsTops[i]+statisticsBands[i]+conditionHeights[i]);
    const box=p=>({x:sum(widths.slice(0,p.col))+gapX*p.col,y:sum(heights.slice(0,p.row))+gapY*p.row,width:sum(widths.slice(p.col,p.col+p.cs))+gapX*(p.cs-1),height:sum(heights.slice(p.row,p.row+p.rs))+gapY*(p.rs-1)});
    const cells=[];for(let row=0;row<g.rows;row++)for(let col=0;col<s.columns;col++)cells.push({row,col,...box({row,col,rs:1,cs:1})});
    const result={width:sum(widths)+gapX*(s.columns-1),height:sum(heights)+gapY*(g.rows-1),cells,positions:s.order.map(id=>({id,...box(g.places[id]),conditionHeight:conditionHeights[g.places[id].row+g.places[id].rs-1],statisticsBand:statisticsBands[g.places[id].row+g.places[id].rs-1],statisticsTop:statisticsTops[g.places[id].row],statisticsFirstTop:statisticsFirstTops[g.places[id].row]}))};
    return !skipCompact&&s.compactWhitespace&&typeof StudioCompactWhitespace!=='undefined'?compactLayout(result,s):result;
  }

  function plotFrame(svg,v){
    if(svg.hasAttribute('data-stat-band-height')||svg.hasAttribute('data-stat-preserve')||svg.hasAttribute('data-condition-height'))return null;
    if(v.preserveAspect)return null;
    if(svg.querySelector('image')||svg.querySelectorAll('[id^="axes_"]').length!==1)return null;
    const rects=[...svg.querySelectorAll('clipPath rect')];if(!rects.length)return null;
    const r=rects.sort((a,b)=>(+b.getAttribute('width'))*(+b.getAttribute('height'))-(+a.getAttribute('width'))*(+a.getAttribute('height')))[0];
    const ratio=v.width/v.viewBox[2],header=(+svg.getAttribute('viewBox').split(/\s+/)[3]-v.viewBox[3])*ratio;
    return {x:+r.getAttribute('x')*ratio,y:+r.getAttribute('y')*ratio+header,w:+r.getAttribute('width')*ratio,h:+r.getAttribute('height')*ratio,ratio,header};
  }
  function fitPlot(svg,v,pos,margins){
    const f=plotFrame(svg,v);if(!f||pos.width<=margins.left+margins.right+30||pos.height<=margins.top+margins.bottom+30)return false;
    const sx=(pos.width-margins.left-margins.right)/f.w,sy=(pos.height-margins.top-margins.bottom)/f.h;
    const A=new DOMMatrix([sx*f.ratio,0,0,sy*f.ratio,margins.left-sx*f.x,margins.top-sy*f.y]);
    const globalMatrix=el=>{const chain=[];for(let n=el;n&&n!==svg;n=n.parentElement)chain.unshift(n);let m=new DOMMatrix();for(const n of chain){const t=n.transform?.baseVal.consolidate()?.matrix;if(t)m=m.multiply(new DOMMatrix([t.a,t.b,t.c,t.d,t.e,t.f]));}return m;};
    const physical=new DOMMatrix([f.ratio,0,0,f.ratio,0,0]);
    const map=(value,start,length,newStart,newLength,end,newEnd)=>value<start?value*newStart/start:value>start+length?newStart+newLength+(value-start-length)*(newEnd-newStart-newLength)/(end-start-length):newStart+(value-start)*newLength/length;
    const legends=[...svg.querySelectorAll('[id^="legend_"]')];
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none';host.append(svg);document.body.append(host);
    const legendAnchors=new Map(legends.map(el=>{const b=el.getBBox();return [el,{x:b.x+b.width,y:b.y+b.height}];}));svg.remove();host.remove();
    const objects=[...legends,...[...svg.querySelectorAll('text,use,[data-studio-cap]')].filter(el=>!el.closest('defs')&&!el.closest('[id^="legend_"]'))];
    const titles=new Map(objects.filter(el=>el.localName==='text'&&el.getAttribute('data-role')==='other'&&!el.closest('[id^="axes_"]')).map(el=>[el,physical.multiply(globalMatrix(el)).transformPoint({x:parseFloat(el.getAttribute('x'))||0,y:parseFloat(el.getAttribute('y'))||0})]));
    const titleLeft=Math.min(...[...titles.values()].map(p=>p.x)),titleBottom=Math.max(...[...titles.values()].map(p=>p.y));
    // Anchor positions follow the new axes. Glyphs and marker symbols retain physical size.
    for(const el of objects){const parent=globalMatrix(el.parentElement),own=el.transform?.baseVal.consolidate()?.matrix,L=own?new DOMMatrix([own.a,own.b,own.c,own.d,own.e,own.f]):new DOMMatrix(),M=parent.multiply(L),p=physical.multiply(M).transformPoint(legendAnchors.get(el)||{x:parseFloat(el.getAttribute('x'))||0,y:parseFloat(el.getAttribute('y'))||0});
      let x=map(p.x,f.x,f.w,margins.left,pos.width-margins.left-margins.right,v.width,pos.width),y=map(p.y,f.y,f.h,margins.top,pos.height-margins.top-margins.bottom,v.height+f.header,pos.height);
      // Tick labels keep a physical baseline offset rather than inheriting a
      // compressed source margin when a panel spans or changes aspect ratio.
      if(el.localName==='text'){
        const fontSize=parseFloat(el.style.fontSize||el.getAttribute('font-size')||'9')*f.ratio;
        if(el.closest('[id^="xtick_"]'))y=pos.height-margins.bottom+Math.max(11,fontSize*1.3);
        else if(el.closest('[id^="ytick_"]'))x=margins.left-5;
        else if(el.getAttribute('data-role')==='axis'&&el.closest('[id="matplotlib.axis_1"]'))y=pos.height-margins.bottom+Math.max(26,fontSize*2.7);
        else if(el.getAttribute('data-role')==='axis'&&el.closest('[id="matplotlib.axis_2"]'))x=Math.max(10,margins.left-38);
      }
      if(el.hasAttribute('data-stat-top')){const anchor=A.transformPoint({x:0,y:+el.getAttribute('data-stat-top')});y=anchor.y-(+el.getAttribute('data-stat-gap'));}
      if(titles.has(el)){const t=titles.get(el);x=margins.left+t.x-titleLeft;y=margins.top-(Number(svg.getAttribute('data-stat-header'))||0)-18+t.y-titleBottom;}
      const wanted=new DOMMatrix().translate(x-p.x,y-p.y).multiply(physical).multiply(M),local=A.multiply(parent).inverse().multiply(wanted);
      el.setAttribute('transform',`matrix(${local.a} ${local.b} ${local.c} ${local.d} ${local.e} ${local.f})`);
    }
    for(const group of svg.querySelectorAll('[id^="studio-bar-"]')){const values=group.querySelector('path')?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);if(values?.length>=8){const cx=(values[0]+values[2])/2;group.setAttribute('transform',(group.getAttribute('transform')||'')+` translate(${cx} 0) scale(${1/sx} 1) translate(${-cx} 0)`);}}
    for(const el of svg.querySelectorAll('path,line,polyline,rect'))if(!el.closest('defs'))el.setAttribute('vector-effect','non-scaling-stroke');
    for(const path of svg.querySelectorAll('[data-stat-bracket]')){const info=JSON.parse(path.getAttribute('data-stat-bracket')),left=A.transformPoint({x:info.x1,y:info.top}),right=A.transformPoint({x:info.x2,y:info.top}),y=left.y-info.gap,inverse=A.inverse();path.setAttribute('d',statisticalBracketPath(left.x,right.x,y,1,info.shape));path.setAttribute('data-stat-display',JSON.stringify({x1:left.x,x2:right.x,y}));path.setAttribute('transform',`matrix(${inverse.a} 0 0 ${inverse.d} ${inverse.e} ${inverse.f})`);}
    // The page background belongs to the viewport, not to the data coordinate transform.
    svg.querySelector('[id="figure_1"] > [id="patch_1"]')?.remove();
    const content=document.createElementNS(NS,'g');content.setAttribute('transform',`matrix(${A.a} 0 0 ${A.d} ${A.e} ${A.f})`);for(const child of [...svg.children])if(child.localName!=='defs')content.append(child);svg.append(content);
    svg.setAttribute('viewBox',`0 0 ${pos.width} ${pos.height}`);svg.setAttribute('data-aligned-plot','true');return true;
  }
  let selectedAnnotations=[];
  function overlayNode(a,l,editing=true){
    const geometry=l.compact&&typeof StudioCompactWhitespace!=='undefined'?StudioCompactWhitespace.overlayGeometry(l,a.id):{width:l.width,height:l.height,dx:0,dy:0};
    const group=document.createElementNS(NS,'g');group.dataset.annotation=a.id;if(geometry.dx||geometry.dy)group.setAttribute('transform',`translate(${geometry.dx} ${geometry.dy})`);const x=a.x*geometry.width,y=a.y*geometry.height,w=a.w*geometry.width,h=a.h*geometry.height,el=document.createElementNS(NS,a.type==='bracket'?'path':a.type);
    const attrs=a.type==='text'?{x,y,'text-anchor':a.align||'start','font-family':a.font,'font-size':a.size,'font-weight':a.bold?'700':'400',fill:a.color}:a.type==='line'?{x1:x,y1:y+(a.reverseY?h:0),x2:x+w,y2:y+(a.reverseY?0:h),stroke:a.color,'stroke-width':a.stroke}:a.type==='bracket'?{d:`M ${x} ${y+h} V ${y} H ${x+w} V ${y+h}`,fill:'none',stroke:a.color,'stroke-width':a.stroke}:a.type==='rect'?{x,y,width:w,height:h,stroke:a.color,'stroke-width':a.stroke,fill:a.fill?a.color:'none'}:{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2,stroke:a.color,'stroke-width':a.stroke,fill:a.fill?a.color:'none'};
    for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);el.setAttribute('opacity',a.opacity);el.style.pointerEvents=a.type==='text'?'all':'visiblePainted';
    if(a.type==='text')a.text.split('\n').forEach((line,i)=>{const t=document.createElementNS(NS,'tspan');t.textContent=line;t.setAttribute('x',x);t.setAttribute('dy',i?a.size*1.25:0);if(i)el.append(document.createTextNode('\n'));el.append(t);});if(a.type==='text'&&a.richText&&typeof StudioRichText!=='undefined')StudioRichText.apply(el,a.richText);group.append(el);
    if(editing){group.style.cursor=a.locked?'default':'move';if(['line','bracket'].includes(a.type)){const hit=el.cloneNode(false);hit.dataset.overlayHit='true';hit.setAttribute('stroke','transparent');hit.setAttribute('stroke-width',12);hit.setAttribute('vector-effect','non-scaling-stroke');hit.style.pointerEvents='stroke';group.append(hit);}if(selectedAnnotations.includes(a.id)){const rect=document.createElementNS(NS,'rect');const textWidth=Math.max(...a.text.split('\n').map(t=>t.length))*a.size*.65;for(const [k,v]of Object.entries({x:x-3-(a.type==='text'?(a.align==='middle'?textWidth/2:a.align==='end'?textWidth:0):0),y:y-(a.type==='text'?a.size:0)-3,width:(a.type==='text'?Math.max(20,textWidth):w)+6,height:(a.type==='text'?a.size*1.25*a.text.split('\n').length:Math.max(h,3))+6,fill:'none',stroke:'#7185a8','stroke-width':1,'stroke-dasharray':'3 2','vector-effect':'non-scaling-stroke'}))rect.setAttribute(k,v);rect.style.pointerEvents='none';group.append(rect);
      if(a.type!=='text'&&!a.locked){const ends=a.type==='line'?overlayLineEndpoints(a,geometry):a.type==='bracket'?[{x,y},{x:x+w,y}]:[{x:x+w,y:y+h}];for(const [i,end]of ends.entries()){const handle=document.createElementNS(NS,'circle');for(const [k,v]of Object.entries({cx:end.x,cy:end.y,r:4,fill:'#fff',stroke:'#526e9e','stroke-width':1.5,'vector-effect':'non-scaling-stroke'}))handle.setAttribute(k,v);handle.dataset.overlayResize=a.id;handle.dataset.overlayEndpoint=String(i);handle.style.cursor=a.type==='line'?(a.direction==='vertical'?'ns-resize':a.direction==='horizontal'?'ew-resize':'crosshair'):a.type==='bracket'?'ew-resize':'nwse-resize';group.append(handle);}}
    }}return group;
  }
  function refreshOverlaySelection(svg,l){
    // Selection decorations can change without replacing the text/shape being
    // clicked; keeping that node lets the browser recognize a double-click.
    for(const a of state().overlays||[]){const group=svg.querySelector(`[data-annotation="${a.id}"]`);if(!group)continue;for(const child of [...group.children].slice(1))child.remove();const fresh=overlayNode(a,l);for(const child of [...fresh.children].slice(1))group.append(child);}
  }
  function renderOverlayProperties(){
    selectedAnnotations=selectedAnnotations.filter(id=>state().overlays?.some(a=>a.id===id));const a=state().overlays?.find(a=>a.id===selectedAnnotations[0]);$('overlaySelectionInfo').textContent=T('已选 {0} 个标注',selectedAnnotations.length);
    $('overlayLineControls').hidden=!(a?.type==='line'&&selectedAnnotations.length===1);$('overlayLineDirection').value=a?.direction||(a?.h===0?'horizontal':a?.w===0?'vertical':'free');$('overlayLineDirection').disabled=!!a?.locked;
    if($('editOverlayText')){$('editOverlayText').hidden=!(a?.type==='text'&&selectedAnnotations.length===1);$('editOverlayText').disabled=!!a?.locked;}
    for(const id of ['applyOverlay','lockOverlay','unlockOverlay','deleteOverlay'])$(id).disabled=!a;
    if(a){$('overlayAlign').value=a.align||'start';$('overlayText').value=a.text;$('overlayFont').value=a.font;$('overlaySize').value=(a.size*currentOutput().scale).toFixed(1);$('overlayColor').value=a.color;$('overlayStroke').value=a.stroke*currentOutput().scale;$('overlayOpacity').value=a.opacity;$('overlayFill').checked=a.fill;$('overlayBold').checked=a.bold;$('overlayText').disabled=a.type!=='text'||selectedAnnotations.length!==1;}
    renderRichTextControls();renderQuickToolbar();
  }
  function applyElementOffsets(svg,id,vi,s,unit){
    const matrix=el=>{const nodes=[];for(let n=el;n&&n!==svg;n=n.parentElement)nodes.unshift(n);let m=new DOMMatrix();for(const n of nodes){const t=n.transform?.baseVal.consolidate()?.matrix;if(t)m=m.multiply(new DOMMatrix([t.a,t.b,t.c,t.d,t.e,t.f]));}return m;};
    // Endpoint adjustments are physical presentation units, after fitting and
    // before ordinary object offsets. Calculated comparison values stay intact.
    for(const [key,props]of Object.entries(editsFor(id,vi,s))){
      if(!['stat-left','stat-right','stat-shape'].some(prop=>Object.hasOwn(props,prop)))continue;
      const el=svg.querySelector(`[data-key="${key}"]`);if(!el?.hasAttribute('data-stat-bracket'))continue;
      const info=JSON.parse(el.getAttribute('data-stat-bracket')),display=el.getAttribute('data-stat-display'),geometry=display?JSON.parse(display):{x1:info.x1,x2:info.x2,y:info.top-info.gap*(info.unit||unit)},m=matrix(el),left=m.transformPoint({x:geometry.x1,y:geometry.y}),right=m.transformPoint({x:geometry.x2,y:geometry.y});
      for(const prop of ['fill','stroke'])el.style.setProperty(prop,paint(el,prop));el.setAttribute('d',adjustedStatisticalBracket(left.x,right.x,left.y,unit,props,info.shape));el.removeAttribute('transform');el.setAttribute('data-stat-adjusted','true');svg.append(el);
    }
    for(const [key,props]of Object.entries(editsFor(id,vi,s))){const dx=+(props['offset-x']||0)*unit,dy=+(props['offset-y']||0)*unit;if(!dx&&!dy)continue;const el=svg.querySelector(`[data-key="${key}"]`);if(!el||el.localName==='tspan')continue;const m=new DOMMatrix().translate(dx,dy).multiply(matrix(el));for(const prop of ['fill','stroke'])el.style.setProperty(prop,paint(el,prop));el.setAttribute('transform',`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);el.removeAttribute('clip-path');svg.append(el);}
  }
  function composite(raw=false, exportMode=false, s=state(), onlyPanel=null,skipCompact=false) {
    const l=layout(s,skipCompact), root=document.createElementNS(NS,'svg');
    const region=onlyPanel?l.positions.find(pos=>pos.id===onlyPanel):null;
    if(onlyPanel&&!region)throw Error(T('目标小图已不存在，请重新选择'));
    const positions=region?[region]:l.positions;
    root.setAttribute('xmlns',NS);if(!exportMode)root.setAttribute('overflow','visible');root.setAttribute('viewBox',`0 0 ${l.width} ${l.height}`); root.setAttribute('width',l.width+'pt');root.setAttribute('height',l.height+'pt');
    if(exportMode){const output=exportGeometry(l.width,l.height,s.exportSettings);root.setAttribute('width',output.widthPt+'pt');root.setAttribute('height',output.heightPt+'pt');}
    if(region){const scale=exportMode?exportGeometry(l.width,l.height,s.exportSettings).scale:1;root.setAttribute('viewBox',`${region.x} ${region.y} ${region.width} ${region.height}`);root.setAttribute('width',region.width*scale+'pt');root.setAttribute('height',region.height*scale+'pt');root.setAttribute('overflow','hidden');}
    const description=document.createElementNS(NS,'metadata');description.textContent=JSON.stringify({analysisChoices:s.order.filter(id=>(!onlyPanel||id===onlyPanel)&&s.panels[id].methodChoice).map(id=>({panel:id,...s.panels[id].methodChoice,result:statisticalAnalysisFor(id,s)?.[s.panels[id].methodChoice.key]})),statistics:statisticalExportRecords(s).filter(record=>!onlyPanel||record.panel===onlyPanel)});root.append(description);
    const margins={left:60,right:18,top:Math.max(52,...s.order.map(id=>annotationFirstTopHeight(id,s)+44)),bottom:36};

    for (const position of positions) {
      const pos=position.renderBox||position;
      const vi=s.panels[pos.id].variant,flow=fittedVariant(pos,s),v=flow||panel(pos.id).variants[vi],svg=editedSvg(pos.id,vi,s,raw,flow),bodyPos={...pos,height:pos.height-(pos.statisticsBand||0)-(pos.statisticsTop||0)-(pos.conditionHeight||0)},fitPos={...pos,height:pos.height-(pos.statisticsBand||0)-(pos.conditionHeight||0)},fitted=!s.panels[pos.id].locked&&fitPlot(svg,v,fitPos,margins);if(!raw)applyElementOffsets(svg,pos.id,vi,s,fitted?1:v.viewBox[2]/v.width);
      const titleShift=(pos.statisticsFirstTop||0)-(Number(svg.getAttribute('data-stat-first-header'))||0);if(!raw&&!fitted&&titleShift>0)for(const title of svg.querySelectorAll('[data-stat-facet-title]'))translateStatisticalElement(svg,title,-titleShift*v.viewBox[2]/v.width);namespace(svg);
      const height=fitted?fitPos.height:Number(svg.getAttribute('viewBox').split(/\s+/)[3])*v.width/v.viewBox[2],ownHeader=Number(svg.getAttribute('data-stat-first-header')||svg.getAttribute('data-stat-header'))||0;svg.setAttribute('x',fitted?pos.x:pos.x+(pos.width-v.width)/2);svg.setAttribute('y',fitted?pos.y:pos.y+(pos.statisticsFirstTop||0)-ownHeader+(bodyPos.height-v.height)/2);svg.setAttribute('width',fitted?pos.width:v.width);svg.setAttribute('height',height);svg.setAttribute('data-panel',pos.id);svg.setAttribute('overflow','visible');
      if (!exportMode && !raw && pos.id===selectedPanel && s.panels[pos.id].variant===state().panels[pos.id].variant) for (const key of selected) svg.querySelector(`[data-key="${key}"]`)?.classList.add('chosen');
      if(position.renderBox&&typeof StudioCompactWhitespace!=='undefined')StudioCompactWhitespace.appendPanel(root,svg,position);else root.append(svg);
    }
    for(const position of positions){const pos=position.renderBox||position,label=displayedPanelLabel(s,pos.id);if(!label)continue;const text=document.createElementNS(NS,'text');text.textContent=label.text;for(const [key,value]of Object.entries({x:pos.x+pos.width*label.x/100,y:pos.y+pos.height*label.y/100,'font-size':label.size,'font-family':label.font,'font-weight':label.bold?'700':'400',fill:'#20242A'}))text.setAttribute(key,value);if(label.richText&&typeof StudioRichText!=='undefined')StudioRichText.apply(text,label.richText);if(!exportMode){text.setAttribute('data-panel-label',pos.id);text.setAttribute('aria-label',T('图号 {0}：单击选择，双击编辑',label.text));text.style.cursor='move';}root.append(text);}
    if(!exportMode&&(showGuides||layoutMode)){
      const guides=document.createElementNS(NS,'g');guides.dataset.editorGuides='true';guides.style.pointerEvents='none';
      const occupied=new Set(),g=gridFor(s);
      for(const pos of l.positions){const p=g.places[pos.id];for(let row=p.row;row<p.row+p.rs;row++)for(let col=p.col;col<p.col+p.cs;col++)occupied.add(row+':'+col);}
      const slots=[...l.positions,...l.cells.filter(c=>!occupied.has(c.row+':'+c.col))];
      for(const slot of slots){const rect=document.createElementNS(NS,'rect');for(const k of ['x','y','width','height'])rect.setAttribute(k,slot[k]);rect.setAttribute('vector-effect','non-scaling-stroke');rect.setAttribute('class','slot-guide'+(slot.id===selectedPanel||panelSelection.includes(slot.id)?' is-selected':''));rect.dataset.guideSlot=slot.id||`empty-${slot.row}-${slot.col}`;guides.append(rect);}
      root.append(guides);
    }
    if(!exportMode&&!raw){
      for(const pos of l.positions){if(s.panels[pos.id].locked)continue;
        const grip=document.createElementNS(NS,'g');grip.dataset.panelMove=pos.id;grip.setAttribute('class','panel-move-handle'+(pos.id===selectedPanel?' is-selected':''));grip.setAttribute('aria-label',T('拖动整张小图'));grip.setAttribute('role','button');
        const title=document.createElementNS(NS,'title');title.textContent=T('拖动整张小图');grip.append(title);
        const x=pos.x+pos.width/2-15,y=pos.y-16,rect=document.createElementNS(NS,'rect');for(const [key,value]of Object.entries({x,y,width:30,height:14,rx:4,fill:'#f4f6fa',stroke:'#aab7cb','stroke-width':.7,'vector-effect':'non-scaling-stroke'}))rect.setAttribute(key,value);grip.append(rect);
        for(const dx of [10,15,20])for(const dy of [5,9]){const dot=document.createElementNS(NS,'circle');dot.setAttribute('cx',x+dx);dot.setAttribute('cy',y+dy);dot.setAttribute('r',1);dot.setAttribute('fill','#63758f');grip.append(dot);}root.append(grip);
      }
    }
    if(layoutMode&&!exportMode){
      for(const pos of l.positions){
        if(s.panels[pos.id].locked)continue;
        for(const [edge,x,y]of [['right',pos.x+pos.width,pos.y+pos.height/2],['bottom',pos.x+pos.width/2,pos.y+pos.height],['corner',pos.x+pos.width,pos.y+pos.height]]){const handle=document.createElementNS(NS,'rect');handle.setAttribute('x',x-4);handle.setAttribute('y',y-4);handle.setAttribute('width','8');handle.setAttribute('height','8');handle.setAttribute('rx','2');handle.setAttribute('fill','#647ca9');handle.setAttribute('stroke','white');handle.setAttribute('data-resize',edge);handle.setAttribute('data-resize-panel',pos.id);handle.style.cursor=edge==='right'?'ew-resize':edge==='bottom'?'ns-resize':'nwse-resize';root.append(handle);}
      }

    }
    for(const a of s.overlays||[]){
      if(region){const geometry=l.compact&&typeof StudioCompactWhitespace!=='undefined'?StudioCompactWhitespace.overlayGeometry(l,a.id):{width:l.width,height:l.height,dx:0,dy:0},w=a.type==='text'?Math.max(...a.text.split('\n').map(t=>t.length))*a.size:Math.abs(a.w*geometry.width),h=a.type==='text'?a.size*1.25*a.text.split('\n').length:Math.abs(a.h*geometry.height),pad=a.stroke||1,x=a.x*geometry.width+geometry.dx-(a.type==='text'?(a.align==='middle'?w/2:a.align==='end'?w:0):0),y=a.y*geometry.height+geometry.dy-(a.type==='text'?a.size:0);if(x+w+pad<region.x||x-pad>region.x+region.width||y+h+pad<region.y||y-pad>region.y+region.height)continue;}
      root.append(overlayNode(a,l,!exportMode));
    }
    if (exportMode) for (const el of [root,...root.querySelectorAll('*')]) for (const a of [...el.attributes]) if (a.name.startsWith('data-') || a.name==='class') el.removeAttributeNode(a);
    return root;
  }
  let autosaveQueue=Promise.resolve(),autosaveTicket=0,duplicateReviewSaveTimer=null;
  function persist() {
    const key='figure-studio:'+project.id;
    try{const previous=localStorage.getItem(key);if(knownCache!==undefined&&previous!==knownCache){$('autosaveStatus').textContent=T('其他窗口已更新 · 请先下载当前工程');localSavedCurrent='';return false;}}catch{}
    const ticket=++autosaveTicket,payload=currentPayload(),signature=saveSignature(),stamp=JSON.stringify({idb:true,savedAt:new Date().toISOString(),ticket});
    // Immutable assets are stored once per project, never duplicated inside history states.
    payload.project={...project,panels:[...project.panels]};
    $('autosaveStatus').textContent=T('正在保存…');
    autosaveQueue=autosaveQueue.catch(()=>{}).then(()=>StudioLibrary.put('autosaves',{id:payload.project.id,payload})).then(()=>{
      if(ticket!==autosaveTicket)return;
      try{localStorage.setItem(key,stamp);knownCache=stamp;if(desktopSession)localStorage.setItem('figure-studio:desktop-last-project',payload.project.id);}catch{}
      localSavedCurrent=signature;$('autosaveStatus').textContent=T('已自动保存 · 含撤销记录');$('autosaveStatus').classList.remove('unsaved');
      if(libraryIds.has(project.id))collectFigure();
    }).catch(()=>{$('autosaveStatus').textContent=T('自动保存失败 · 请下载工程');$('autosaveStatus').classList.add('unsaved');});return true;
  }
  function commit(next,label,renderNow=true) {try{validateState(next,project);for(const id of state().order)if(state().panels[id].locked&&(!next.panels[id]||next.panels[id].locked)){if(JSON.stringify(gridFor(state()).places[id])!==JSON.stringify(gridFor(next).places[id])||JSON.stringify(state().panels[id])!==JSON.stringify(next.panels[id]))throw Error(T('小图已锁定'));}}catch(e){say(e.message);return false;}if(history.commit(next)){original=false;persist();if(renderNow)render();say(label+T(' · 已记录，可撤销'));}return true;}
  function migrateLabelHistory(){
    const initial=project.initialState;
    history.states=history.states.map(s=>migratePanelLabels(s,initial));
    checkpoints=checkpoints.map(item=>({...item,state:migratePanelLabels(item.state,initial)}));
    project.initialState=migratePanelLabels(initial,initial);
  }
  function deleteSelectedObjects(){
    if(original)return say(T('请先退出原版对照。'));
    const groups=selectionGroups().map(g=>{const source=editableSource(g.id,g.vi),locked=state().panels[g.id].lockedElements?.[g.vi]||[];return {...g,keys:g.keys.filter(key=>{const el=source.querySelector(`[data-key="${key}"]`);return el&&isVisibleObject(el)&&![el,...el.querySelectorAll('[data-key]')].some(n=>locked.includes(n.getAttribute('data-key')));})};});
    const result=removeSelectedItems(state(),{groups,annotations:selectedAnnotations,labelId:selectedPanelLabel});
    if(!result.removed)return say(T('请选择未锁定的图内元素'));
    selected=[];elementSelections=[];selectionAnchor=null;selectedAnnotations=[];selectedPanelLabel=null;
    commit(result.next,T('已删除 {0} 个元素；可撤销',result.removed));
  }
  function renderLabelControls(){
    const p=state().panels[selectedPanel],label=displayedPanelLabel(state(),selectedPanel)||{text:'',x:2,y:5,size:12,font:'Arial',bold:true};
    $('panelLabel').value=label.text;$('labelX').value=label.x;$('labelY').value=label.y;$('labelSize').value=label.size;$('labelBold').checked=label.bold;
    if(selectedPanelLabel&&label.font)$('font').value=label.font;
    $('autoNumberLabels').checked=!!panelNumberStyle(state());$('labelStyle').value=panelNumberStyle(state())||'upper';
    for(const id of ['panelLabel','labelX','labelY','labelSize','labelBold','applyPanelLabel','removePanelLabel'])$(id).disabled=!!p.locked;
  }
  function selectPanelLabel(id,focus=false){
    const panelChanged=inspectorPanel!==id;
    selectedPanel=id;selected=[];elementSelections=[];selectionAnchor=null;selectedAnnotations=[];panelSelection=[id];selectedPanelLabel=id;activePane='detail';
    if(panelChanged){renderDataEditor();renderMethods();renderInspector();}else renderSelectionProperties();
    renderLabelControls();
    document.querySelectorAll('[data-pane]').forEach(el=>el.hidden=el.getAttribute('data-pane')!=='detail');
    document.querySelectorAll('[data-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.getAttribute('data-tab')==='detail')));
    document.querySelectorAll('#panels .panel-button').forEach((button,i)=>button.classList.toggle('active',visualPanelOrder(state())[i]===id));
    zoomView?.refreshSelection?.();$('panelLabelControls').open=true;$('panelLabelControls').scrollIntoView({block:'nearest'});
    if(focus){$('panelLabel').focus();$('panelLabel').select();}
  }
  function setEdit(next,id,vi,key,prop,value) {
    const edits=next.panels[id].edits; edits[vi] ||= {}; edits[vi][key] ||= {}; edits[vi][key][prop]=value;
  }
  let statisticalLineGesture=null,statisticalLineFrame=0;
  function selectedStatisticalLine(){
    const groups=selectionGroups();if(groups.length!==1||groups[0].keys.length!==1)return null;
    const {id,vi,keys}=groups[0],key=keys[0],el=editableSource(id,vi).querySelector(`[data-key="${key}"]`);if(!el?.hasAttribute('data-stat-bracket'))return null;
    const p=state().panels[id],v=panel(id).variants[vi];return {id,vi,key,el,unit:v.viewBox[2]/v.width,props:editsFor(id,vi)[key]||{},locked:original||p.locked||p.lockedElements?.[vi]?.includes(key)};
  }
  function renderStatisticalLineControls(){
    const host=$('selectedStatisticalLine');if(!host)return;const target=selectedStatisticalLine();host.hidden=!target;if(!target)return;
    const output=currentOutput().scale,info=JSON.parse(target.el.getAttribute('data-stat-bracket'));
    for(const [name,prop]of [['statLineLeft','stat-left'],['statLineRight','stat-right']]){$(name).value=Number(target.props[prop]||0)*output;$(name+'Value').value=+(Number(target.props[prop]||0)*output).toFixed(1)+' pt';}
    $('statLineWidth').value=+(parseFloat(target.props['stroke-width']||target.el.getAttribute('stroke-width')||.7)/target.unit*output).toFixed(2);$('statLineWidthValue').value=$('statLineWidth').value+' pt';$('statLineShape').value=target.props['stat-shape']||info.shape||'bracket';
    for(const control of host.querySelectorAll('input,select,button'))control.disabled=!!target.locked;
  }
  function cancelStatisticalLinePreview(repaint=false){if(statisticalLineFrame)cancelAnimationFrame(statisticalLineFrame);statisticalLineFrame=0;statisticalLineGesture=null;if(repaint){renderCanvas();renderStatisticalLineControls();}}
  function previewStatisticalLine(prop,value){
    const target=selectedStatisticalLine();if(!target||target.locked)return;const output=currentOutput().scale,stored=prop==='stat-shape'?value:String(Number(value)*(prop==='stroke-width'?target.unit:1)/output);if(!validValue(prop,stored))return;
    let gesture=statisticalLineGesture;if(!gesture||gesture.state!==state()||gesture.id!==target.id||gesture.key!==target.key){cancelStatisticalLinePreview();const s=state(),position=layout(s).positions.find(pos=>pos.id===target.id),pos=position?.renderBox||position;if(!pos)return;gesture=statisticalLineGesture={...target,owner:project,state:s,pos,flow:fittedVariant(pos,s),markStyle:true,info:{},margins:{left:60,right:18,top:Math.max(52,...s.order.map(id=>annotationFirstTopHeight(id,s)+44)),bottom:36}};}
    gesture.next=copy(gesture.state);setEdit(gesture.next,target.id,target.vi,target.key,prop,stored);
    if(statisticalLineFrame)return;statisticalLineFrame=requestAnimationFrame(()=>{statisticalLineFrame=0;if(gesture.owner!==project||gesture.state!==state()||selectedPanel!==gesture.id){cancelStatisticalLinePreview(true);return;}previewCategorySpacing(gesture,gesture.next);});
  }
  function finishStatisticalLine(){
    const gesture=statisticalLineGesture;if(!gesture)return;cancelStatisticalLinePreview();if(gesture.owner!==project||gesture.state!==state()||selectedPanel!==gesture.id)return renderCanvas();commit(gesture.next,T('已调整所选统计连接线；分析结果保持原值'));
  }
  function bindStatisticalLineControls(){
    if(!$('selectedStatisticalLine'))return;
    for(const [name,prop]of [['statLineLeft','stat-left'],['statLineRight','stat-right'],['statLineWidth','stroke-width'],['statLineShape','stat-shape']]){const input=$(name);input.oninput=()=>{if($(name+'Value'))$(name+'Value').value=input.value+' pt';previewStatisticalLine(prop,input.value);};input.onchange=()=>{previewStatisticalLine(prop,input.value);finishStatisticalLine();};input.onblur=finishStatisticalLine;input.onpointercancel=()=>cancelStatisticalLinePreview(true);input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelStatisticalLinePreview(true);}else if(event.key==='Enter'){event.preventDefault();finishStatisticalLine();}};}
    $('resetStatLine').onclick=()=>{const target=selectedStatisticalLine();if(!target||target.locked)return;cancelStatisticalLinePreview();const next=copy(state()),props=next.panels[target.id].edits[target.vi]?.[target.key];if(props){for(const prop of ['stat-left','stat-right','stat-shape','stroke-width','offset-x','offset-y'])delete props[prop];if(!Object.keys(props).length)delete next.panels[target.id].edits[target.vi][target.key];}commit(next,T('已恢复所选连接线的自动位置与样式'));};
  }
  // Rich-text adapters share the same history, persistence and export state as
  // other edits. A manual display override never rewrites analysis records.
  let richTextEditor=null;
  function richTextTarget(){
    if(typeof StudioRichText==='undefined')return null;
    if(selectedPanelLabel){const id=selectedPanelLabel,label=displayedPanelLabel(state(),id);if(!label)return null;const el=document.createElementNS(NS,'text');el.textContent=label.text;el.style.fontWeight=label.bold?'700':'400';return {identity:'label/'+id,kind:'label',id,text:label.text,record:label.richText,el,locked:state().panels[id].locked,projectId:project.id};}
    if(selectedAnnotations.length===1){const a=state().overlays?.find(a=>a.id===selectedAnnotations[0]);if(a?.type==='text'){const el=overlayNode(a,layout(),false).querySelector('text');return {identity:'overlay/'+a.id,kind:'overlay',id:a.id,text:a.text,record:a.richText,el,locked:a.locked,projectId:project.id};}}
    const groups=selectionGroups();if(groups.length!==1||groups[0].keys.length!==1)return null;
    const {id,vi,keys}=groups[0],svg=editableSource(id,vi),node=svg.querySelector(`[data-key="${keys[0]}"]`),el=node?.closest('text')||node;if(!el?.matches('text'))return null;
    const key=el.getAttribute('data-key'),props=editsFor(id,vi)[key]||{},locked=state().panels[id].locked||[el,...el.querySelectorAll('[data-key]')].some(n=>(state().panels[id].lockedElements?.[vi]||[]).includes(n.getAttribute('data-key'))),statistical=el.hasAttribute('data-stat-result')||el.hasAttribute('data-stat-top');
    return {identity:`element/${id}/${vi}/${key}`,kind:'element',id,vi,key,text:el.textContent,record:props['rich-text'],el,locked,statistical,manual:statistical&&Object.hasOwn(props,'text'),projectId:project.id,asset:panel(id)};
  }
  function validRichTextTarget(target){
    if(!target||target.locked||target.projectId!==project.id)return false;
    if(target.kind==='element')return panel(target.id)===target.asset&&state().panels[target.id]?.variant===target.vi&&!state().panels[target.id].locked&&!(state().panels[target.id].lockedElements?.[target.vi]||[]).includes(target.key);
    if(target.kind==='overlay')return !!state().overlays?.some(a=>a.id===target.id&&!a.locked);
    return !!state().panels[target.id]?.label&&!state().panels[target.id].locked;
  }
  function saveRichText(next,target,record,text){
    const encoded=JSON.stringify(record);
    if(target.kind==='element'){setEdit(next,target.id,target.vi,target.key,'rich-text',encoded);if(text!==undefined)setEdit(next,target.id,target.vi,target.key,'text',text);}
    else if(target.kind==='overlay'){const a=next.overlays.find(a=>a.id===target.id);a.richText=encoded;if(text!==undefined)a.text=text;}
    else{const label=next.panels[target.id].label;label.richText=encoded;if(text!==undefined){label.text=text;label.manual=true;}}
  }
  function formatSelectedRichText(action,start,end,target=richTextTarget()){
    if(!validRichTextTarget(target))return false;
    try{const native=target.record||StudioRichText.nativeStyles(target.el),property=['super','sub','normal'].includes(action)?'script':action,value=property==='script'?action:undefined,record=StudioRichText.format(native,target.text,start,end,property,value),next=copy(state());saveRichText(next,target,record);return commit(next,T('已更新所选字符格式'));}catch(error){say(T(error.message));return false;}
  }
  function changeRichText(value,target=richTextTarget()){
    if(!validRichTextTarget(target)||typeof value!=='string')return false;
    const limit=target.kind==='label'?20:target.kind==='overlay'?2000:500;if(value.length>limit){say(T('文字长度超出当前元素限制'));return false;}
    if(value===target.text)return true;
    try{const record=StudioRichText.remap(target.record||StudioRichText.nativeStyles(target.el),value),next=copy(state());saveRichText(next,target,record,value);return commit(next,T(target.statistical?'已修改显示文字；分析记录保持原值':'已修改文字；请核对标签与数据含义'));}catch(error){say(T(error.message));return false;}
  }
  function renderRichTextControls(){
    const host=$('richTextControls');if(!host||typeof StudioRichText==='undefined')return;
    richTextEditor||=StudioRichText.mount(host,{t:T,format:formatSelectedRichText,text:changeRichText});
    const target=richTextTarget();richTextEditor.sync(target);
    // The unified character editor handles parent text with existing tspans.
    $('textContent').closest('label').hidden=!!target;$('applyText').hidden=true;
  }
  function focusRichTextControls(){activePane='detail';showPane('detail');renderRichTextControls();richTextEditor?.focus();}
  function getActiveRichTextSelection(){
    const field=document.activeElement,inline=field?.matches?.('.canvas-text-editor'),sidebar=field?.id==='richTextContent';
    if(!inline&&!sidebar)return null;
    const start=field.selectionStart,end=field.selectionEnd,target=richTextTarget();
    return target&&field.value===target.text&&Number.isInteger(start)&&Number.isInteger(end)&&end>start?{target,start,end}:null;
  }
  function targetObjects(id,vi,svg,kind) {
    const scope=$('scope').value, selection=selectionGroups().find(g=>g.id===id&&g.vi===vi),selectedHere=!!selection;
    if(state().panels[id].locked)return [];
    let objects=keysToObjects(svg).filter(el=>![el,...el.querySelectorAll('[data-key]')].some(node=>(state().panels[id].lockedElements?.[vi]||[]).includes(node.getAttribute('data-key'))));
    if(scope==='element') objects=selectedHere ? objects.filter(el=>selection.keys.includes(el.getAttribute('data-key'))) : [];
    else if(scope==='sameColor') {
      if(!selectedHere) return [];
      const chosen=svg.querySelector(`[data-key="${selected[0] || ''}"]`);
      if(!chosen) return [];
      const color=hex(paint(chosen,'fill')) || hex(paint(chosen,'stroke'));
      objects=objects.filter(el=>color && ['fill','stroke'].some(prop=>hex(paint(el,prop))===color));
    }
    if(kind==='text') objects=objects.filter(el=>el.matches('text,tspan') && (scope==='element'||$('textRole').value==='all'||el.getAttribute('data-role')===$('textRole').value));
    // Parent text already carries the style; avoid multiplying opacity through tspans.
    return objects.filter(el=>!objects.some(parent=>parent!==el && parent.contains(el)));
  }
  function updateStyle(prop,value,kind='all',extras={},previewOnly=false) {
    if(original) return say(T('请先退出原版对照。'));
    const scope=$('scope').value;
    if((scope==='element'||scope==='sameColor')&&!selected.length)return say(T('请先点选图内元素。'));
    const next=copy(state());let changed=0;
    for(const id of scope==='all'?next.order:scope==='element'?selectionGroups().map(g=>g.id):[selectedPanel]) {
      if((scope==='panel'||scope==='all')&&$('textRole').value==='all'&&prop==='font-family'&&extras['font-size']&&!next.panels[id].locked){next.panels[id].annotationFont={...next.panels[id].annotationFont,font:value,size:+extras['font-size']/currentOutput().scale};}
      const vs=!previewOnly&&(scope==='all'||scope==='panel')?panel(id).variants.map((_,i)=>i):[next.panels[id].variant];
      for(const vi of vs){const svg=editableSource(id,vi);for(const el of targetObjects(id,vi,svg,kind)){
        const key=el.getAttribute('data-key');
        if(kind==='shape'&&!el.matches('path,rect,circle,ellipse,line,polyline,polygon,use'))continue;
        if(prop==='color') {
          if(el.localName==='image')continue;
          for(const channel of ($('channel').value==='both'?['fill','stroke']:[$('channel').value])) {
            const current=paint(el,channel);
            if(current==='none'||/url\(/.test(current))continue;
            if((scope==='panel'||scope==='all')&&!chromatic(current))continue;
            setEdit(next,id,vi,key,channel,value);changed++;
          }
        } else {
          for(const [property,requested] of Object.entries({[prop]:value,...extras})) {
            let final=requested;
            if(property==='font-size'||property==='stroke-width') final=String(+requested/currentOutput().scale*panel(id).variants[vi].viewBox[2]/panel(id).variants[vi].width);
            if(validValue(property,final)){
              setEdit(next,id,vi,key,property,final);changed++;
              // Preserve run-level italics and sub/superscript size ratios.
              if(el.localName==='text' && (property==='font-family'||property==='font-size')) {
                const oldSize=textPointSize(el);
                for(const child of el.querySelectorAll('tspan[data-key]')) {
                  if(property==='font-family')setEdit(next,id,vi,child.getAttribute('data-key'),property,final);
                  else {const size=parseFloat(child.style.fontSize||child.getAttribute('font-size')||'');if(Number.isFinite(size)&&oldSize>0)setEdit(next,id,vi,child.getAttribute('data-key'),property,String(size*Number(final)/oldSize));}
                }
              }
            }
          }
        }
      }}
    }
    if(changed){if(previewOnly){renderCanvas(next);say(T('实时预览 · 松开滑块或确认颜色后记录一次修改'));}else commit(next,T('已更新 {0} 个属性',changed));}else say(T('当前范围没有适用元素。黑白坐标与连续色标不参与整图改色。'));
  }
  function paletteHeatmapInfo(id=selectedPanel,vi){
    if(!id)return null;const saved=state().panels[id];if(!saved)return null;vi??=saved.variant;
    const node=baseSvg(id,vi).querySelector('[id*="studio-heat-value-"]'),info=node&&heatmapCellInfo(node.id);
    return info&&Number.isFinite(info.normalized)&&['sequential','diverging'].includes(info.kind)?info:null;
  }
  function paletteStops(scheme,info){return info?.kind==='sequential'?scheme.sequentialStops:scheme.continuousStops;}
  function paletteGradient(stops,info){
    const positions=stops.length===3&&info?.kind==='diverging'&&Number.isFinite(info.midpoint)?[0,Math.max(0,Math.min(1,info.midpoint)),1]:stops.map((_,i)=>i/(stops.length-1));
    return `linear-gradient(90deg, ${stops.map((color,i)=>`${color} ${positions[i]*100}%`).join(', ')})`;
  }
  function paletteStrip(colors,info=null){
    const sw=document.createElement('div');sw.className='swatches';
    if(info){sw.className+=' continuous-swatches';sw.style.background=paletteGradient(colors,info);sw.title=T('低值 → 高值');sw.setAttribute('role','img');sw.setAttribute('aria-label',T('连续色阶：{0}',colors.join(' → ')));}
    else colors.forEach(color=>{const chip=document.createElement('i');chip.style.background=color;sw.append(chip);});
    return sw;
  }
  function paletteFixedDecoration(el,root) {
    for(let node=el;node&&node!==root;node=node.parentElement){
      if(/matplotlib\.axis_\d+$/.test(node.id||'')||/studio-(?:plot-frame|facet-title)/.test(node.id||'')||node.getAttribute('data-stat-result')!==null||node.getAttribute('data-stat-band')!==null||node.getAttribute('data-condition-matrix')!==null)return true;
      // Matplotlib spines are unclipped, unfilled patch paths. Filled bars and
      // density contours remain eligible, as do clipped data outlines.
      if(/(?:^|-)patch_\d+$/.test(node.id||'')&&el.localName==='path'&&paint(el,'fill')==='none'&&!el.getAttribute('clip-path'))return true;
    }
    return false;
  }
  function paletteSourceColors(base,targets,elementScope=false){
    const present=[];
    for(const el of targets){
      if(!elementScope&&(paletteFixedDecoration(el,base)||['text','tspan','image'].includes(el.localName)))continue;
      for(const prop of ['fill','stroke']){const color=hex(paint(el,prop));if(color&&!present.includes(color))present.push(color);}
    }
    if(!elementScope){
      try{
        const declared=paletteDeclaredColors(base.querySelector('[id$="studio-series-colors"]')?.textContent);
        // A supplied series palette defines the order, including neutral series.
        // Median/reference/decorative ink must never consume a category color.
        if(declared){
          const ordered=declared.filter(color=>present.includes(color));
          const unmapped=present.filter(color=>chromatic(color)&&!ordered.includes(color));
          // An untagged continuous mesh may share one endpoint with the series
          // palette. Keep the existing continuous-scale guard in that case.
          if(ordered.length&&unmapped.length<=4)return ordered;
        }
      }catch{}
    }
    return present.filter(chromatic);
  }
  function preparePaletteTargets(){
    const saved=state(),scope=$('scope').value,elementScope=['element','sameColor'].includes(scope),entries=[];
    for(const id of scope==='all'?saved.order:[selectedPanel])for(let vi=0;vi<panel(id).variants.length;vi++){
      const p=saved.panels[id];if(p.locked||elementScope&&vi!==p.variant)continue;
      const base=baseSvg(id,vi),meta=base.querySelector('[id*="studio-heat-value-"]');
      if(!elementScope&&meta){
        const info=heatmapCellInfo(meta.id);if(!Number.isFinite(info?.normalized))continue;
        const locked=new Set(p.lockedElements?.[vi]||[]),resetKeys=[],retained=[];
        let svg=null;
        // Only user-edited/locked objects need inspecting. Most heatmaps need no
        // complete editedSvg render to prepare a different continuous scale.
        for(const key of new Set([...Object.keys(p.edits[vi]||{}),...locked])){
          const el=base.querySelector(`[data-key="${key}"]`);let node=el,continuous=false;
          while(node&&node!==base){if(/studio-heat-(?:source|box|scale)-/.test(node.id||'')){continuous=true;break;}node=node.parentElement;}
          if(!continuous)continue;
          if(locked.has(key)){svg??=editedSvg(id,vi);const current=svg.querySelector(`[data-key="${key}"]`);for(const prop of ['fill','stroke']){const value=paint(current,prop);if(value&&value!=='none')retained.push({key,prop,value});}}
          else resetKeys.push(key);
        }
        entries.push({id,vi,info,resetKeys,retained});continue;
      }
      const svg=editedSvg(id,vi);
      const targets=targetObjects(id,vi,svg,'all');
      const targetKeys=new Set(targets.map(el=>el.getAttribute('data-key')));
      const allColors=paletteSourceColors(base,elementScope?[...base.querySelectorAll('[data-key]')].filter(el=>targetKeys.has(el.getAttribute('data-key'))):keysToObjects(base),elementScope);
      const channels=[];for(const el of targets){if(el.localName==='image')continue;const key=el.getAttribute('data-key'),originalEl=base.querySelector(`[data-key="${key}"]`);if(!originalEl||!elementScope&&paletteFixedDecoration(originalEl,base))continue;for(const prop of ['fill','stroke']){const index=allColors.indexOf(hex(paint(originalEl,prop)));if(index>=0)channels.push({key,prop,index});}}
      entries.push({id,vi,allColors,channels});
    }
    return {saved,scope,panelId:selectedPanel,entries};
  }
  function paletteState(colors,scheme=null,prepared=null) {
    const current=state(),next=copy(current);
    if(!prepared||prepared.saved!==current||prepared.scope!==$('scope').value||prepared.panelId!==selectedPanel)prepared=preparePaletteTargets();
    for(const entry of prepared.entries){
      const {id,vi}=entry;
      if(entry.info){
        if(!scheme||entry.info.kind==='diverging'&&scheme.kind==='sequential')continue;
        next.panels[id].heatmapPalette={stops:[...paletteStops(scheme,entry.info)]};
        for(const key of entry.resetKeys){const old=next.panels[id].edits[vi]?.[key];if(old){delete old.fill;delete old.stroke;if(!Object.keys(old).length)delete next.panels[id].edits[vi][key];}}
        for(const {key,prop,value}of entry.retained)setEdit(next,id,vi,key,prop,value);
      }else{
        // No cycling a categorical palette across a continuous scale.
        if(entry.allColors.length>colors.length)continue;
        for(const {key,prop,index}of entry.channels)setEdit(next,id,vi,key,prop,colors[index]);
      }
    }
    return next;
  }
  function bindPaletteCard(card,scheme,next,baseState){
    let timer=null,previewed=false,inside=false;
    const cancel=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
    card.onmouseenter=()=>{
      inside=true;cancel();if(JSON.stringify(next)===JSON.stringify(state()))return;
      timer=setTimeout(()=>{timer=null;if(!inside||card.isConnected===false||state()!==baseState)return;previewed=true;renderCanvas(next);say(T('预览 ')+T(scheme.name)+T(' · 点击应用，移开还原'));},100);
    };
    card.onpointerdown=event=>{if(!event.button)cancel();};
    card.onmouseleave=()=>{inside=false;cancel();if(previewed){previewed=false;renderCanvas();say(T('已返回当前编辑版'));}};
    card.onclick=()=>{inside=false;cancel();previewed=false;commit(paletteState(scheme.colors,scheme),T('已应用 ')+T(scheme.name));};
  }
  function preview(svg) {namespace(svg);svg.removeAttribute('width');svg.removeAttribute('height');return svg;}
  function button(text,action){const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;}
  function savePreferences(){try{localStorage.setItem('figure-studio:preferences',JSON.stringify(preferences));}catch{say(T('偏好记忆未保存；当前图形编辑不受影响。'));}}
  function learnPreferences(){
    const features={palette:[],typography:[],chart:[],canvas:[],layout:[]};
    for(const id of state().order){
      const vi=state().panels[id].variant,v=panel(id).variants[vi],svg=editedSvg(id,vi),colors=[];
      for(const el of keysToObjects(svg))for(const prop of ['fill','stroke']){const color=hex(paint(el,prop));if(color&&chromatic(color)&&!colors.includes(color))colors.push(color);}
      if(colors.length&&colors.length<=8)features.palette.push(JSON.stringify(colors));
      const overrides=editsFor(id,vi),text=keysToObjects(svg).filter(el=>el.localName==='text');
      const chosen=text.filter(el=>{const props=overrides[el.getAttribute('data-key')];return props&&('font-size'in props||'font-family'in props);});
      const counts={};for(const el of chosen.length?chosen:text){const family=(el.style.fontFamily||el.getAttribute('font-family')||'').replace(/["']/g,'').trim(),size=parseFloat(el.style.fontSize||el.getAttribute('font-size'))*v.width/v.viewBox[2],key=JSON.stringify([family,Math.round(size*10)/10]);if(StudioPreferences.valid('typography',key))counts[key]=(counts[key]||0)+1;}
      features.typography.push(...Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,chosen.length?3:1).map(x=>x[0]));
      features.chart.push(v.name);features.canvas.push(v.size||'original');
    }
    const g=gridFor(state());features.layout.push(JSON.stringify([g.rows,state().columns,state().order.map(id=>[g.places[id].rs,g.places[id].cs])]));
    if(preferences.record(StudioPreferences.fingerprint(project.id+JSON.stringify(state())),features))savePreferences();
    renderRecommendations();
  }
  function renderRecommendations(){
    $('rememberPreferences').checked=preferences.enabled;$('recommendations').replaceChildren();
    $('clearPreferences').textContent=T(confirmPreferenceClear?'再次点击确认清除':'清除偏好记忆');$('restorePreferences').hidden=!clearedPreferences;
    $('memorySummary').textContent=preferences.enabled?T('已记住 {0} 次不同的主动保存选择。',preferences.seen.length):T('偏好学习与推荐已暂停。');
    if(!preferences.enabled)return;
    const host=$('recommendations'),pan=panel(selectedPanel),current=variant(selectedPanel);
    const append=(b,count)=>{const note=document.createElement('small');note.className='candidate-insight';note.textContent=T('主动保存 {0} 次 · 点击应用',count);b.append(note);host.append(b);};
    for(const [key,count]of preferences.top('palette')){const colors=JSON.parse(key),scheme=SWATCH_SCHEMES.find(item=>JSON.stringify(item.colors)===JSON.stringify(colors)),next=paletteState(colors,scheme);if(JSON.stringify(next)===JSON.stringify(state()))continue;const b=button(T('常用配色'),()=>commit(next,T('已应用常用配色')));b.className='palette';const info=paletteHeatmapInfo(),sw=paletteStrip(info&&scheme?paletteStops(scheme,info):colors,info&&scheme?info:null);b.append(sw,preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)));b.onmouseenter=()=>renderCanvas(next);b.onmouseleave=()=>renderCanvas();append(b,count);}
    for(const [key,count]of preferences.top('typography')){const [font,size]=JSON.parse(key),b=button(font+' · '+size+' pt',()=>updateStyle('font-family',font,'text',{'font-size':String(size)}));b.className='candidate';b.style.fontFamily=font;b.onmouseenter=()=>updateStyle('font-family',font,'text',{'font-size':String(size)},true);b.onmouseleave=()=>renderCanvas();append(b,count);}
    for(const [key,count]of preferences.top('chart')){const vi=pan.variants.findIndex(v=>v.name===key&&(v.size||'original')===(current.size||'original'));if(vi<0)continue;const next=copy(state());next.panels[selectedPanel].variant=vi;const b=button(chartName(key),guard(()=>activateVariant(vi)));b.className='candidate';b.append(preview(editedSvg(selectedPanel,vi,next)));b.onmouseenter=()=>renderCanvas(next);b.onmouseleave=()=>renderCanvas();append(b,count);}
    for(const [key,count]of preferences.top('canvas')){const vi=pan.variants.findIndex(v=>v.name===current.name&&(v.size||'original')===key);if(vi<0)continue;let next;try{const span=({wide:[1,2],spanWide:[1,2],spanThree:[1,3],spanTall:[2,1],large:[2,2]})[key];next=span?resizePanel(state(),selectedPanel,...span):copy(state());}catch{continue;}next.panels[selectedPanel].variant=vi;const b=button(T(sizeNames[key]),()=>{selected=[];commit(next,T('已切换画布规格'));});b.className='candidate';b.append(preview(editedSvg(selectedPanel,vi,next)));b.onmouseenter=()=>renderCanvas(next);b.onmouseleave=()=>renderCanvas();append(b,count);}
    for(const [key,count]of preferences.top('layout')){const [rows,columns,spans]=JSON.parse(key);if(spans.length!==state().order.length)continue;let next;try{next=matchSizes(arrange(state(),rows,columns,'regular',Object.fromEntries(state().order.map((id,i)=>[id,spans[i]]))));}catch{continue;}const b=button(T('常用母版：{0} 行 × {1} 列',rows,columns),()=>commit(next,T('已应用常用母版')));b.className='candidate';b.onmouseenter=()=>renderCanvas(next);b.onmouseleave=()=>renderCanvas();append(b,count);}
    if(!host.children.length){const note=document.createElement('p');note.className='muted';note.textContent=T('继续保存满意的结果，重复使用的偏好会出现在这里。');host.append(note);}
  }
  function matchSizes(next,ids=next.order){
    next.typography ||= {font:'Arial',size:9};
    if(!$('adaptSizes').checked)return next;
    for(const id of ids){const p=gridFor(next).places[id],variants=panel(id).variants,current=variants[next.panels[id].variant],size=p.cs>=2&&p.rs>=2?'large':p.cs>=3&&p.rs===1?'spanThree':p.cs>p.rs?'spanWide':p.rs>p.cs?'spanTall':'original';
      const vi=variants.findIndex(v=>v.name===current.name&&(v.size||'original')===size),from=next.panels[id].variant;
      if(vi>=0&&vi!==from){
        const saved=next.panels[id],hasOverrides=[from,vi].some(index=>['edits','scales'].some(field=>Object.keys(saved[field]?.[index]||{}).length)||['lockedElements','elementGroups'].some(field=>saved[field]?.[index]?.length));
        if(!hasOverrides){saved.variant=vi;continue;}
        const position=state().panels[id]?.variant===from?layout(state()).positions.find(pos=>pos.id===id):null,flow=position?fittedVariant(position,state()):null;
        const source=flow?reflowSvg(id,from,flow):baseSvg(id,from),target=baseSvg(id,vi);
        next.panels[id]=transferVariantEdits(next.panels[id],from,vi,svgElementMap(source,target),current,variants[vi]);
      }
    }return next;
  }
  function moveWithSizes(s,id,row,col){
    const members=s.panelGroups?.find(g=>g.includes(id))||[id],g=gridFor(s);
    if(members.some(key=>s.panels[key].locked))throw Error(T('小图已锁定'));
    let next;
    if(members.length>1){next=copy(s);next.grid=copy(g);const dr=row-g.places[id].row,dc=col-g.places[id].col;for(const key of members){next.grid.places[key].row+=dr;next.grid.places[key].col+=dc;}validateState(next,project);next.order.sort((a,b)=>next.grid.places[a].row-next.grid.places[b].row||next.grid.places[a].col-next.grid.places[b].col);}
    else{next=movePanel(s,id,row,col);for(const key of s.order)if(s.panels[key].locked&&JSON.stringify(g.places[key])!==JSON.stringify(next.grid.places[key]))throw Error(T('小图已锁定'));}
    return matchSizes(next,next.order.filter(key=>JSON.stringify(g.places[key])!==JSON.stringify(next.grid.places[key])));
  }

  function renderMasters(){
    $('masters').replaceChildren();
    for(const [label,rows,cols,kind]of [[T('2 行 × 2 列'),2,2,'regular'],[T('3 行 × 3 列'),3,3,'regular'],[T('4 行 × 3 列'),4,3,'regular'],[T('5 行 × 3 列'),5,3,'regular'],[T('横向并列'),1,Math.min(6,state().order.length),'regular'],[T('纵向叙事'),state().order.length,1,'regular'],[T('上方宽图'),Math.max(2,Math.ceil((state().order.length+1)/2)),2,'wide'],[T('左侧长图'),Math.max(2,Math.ceil((state().order.length+1)/2)),2,'tall'],[T('重点大图'),Math.max(2,Math.ceil((state().order.length+3)/3)),3,'hero']]){
      let next;try{next=matchSizes(arrange(state(),rows,cols,kind));}catch{continue;}
      const b=button('',()=>{selected=[];commit(next,T('已应用母版 ')+label);});b.className='master';b.setAttribute('aria-pressed',String(JSON.stringify(next.grid)===JSON.stringify(gridFor(state()))));b.setAttribute('aria-label',T('母版 ')+label);
      const icon=document.createElementNS(NS,'svg');icon.setAttribute('viewBox',`0 0 ${cols*20} ${rows*20}`);
      for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const rect=document.createElementNS(NS,'rect');rect.setAttribute('x',c*20+1);rect.setAttribute('y',r*20+1);rect.setAttribute('width',18);rect.setAttribute('height',18);rect.setAttribute('fill','#f7f8fa');rect.setAttribute('stroke','#dce0e6');rect.setAttribute('stroke-width','.6');icon.append(rect);}
      for(const [i,id]of next.order.entries()){const p=next.grid.places[id],rect=document.createElementNS(NS,'rect');rect.setAttribute('x',p.col*20+1);rect.setAttribute('y',p.row*20+1);rect.setAttribute('width',p.cs*20-2);rect.setAttribute('height',p.rs*20-2);rect.setAttribute('fill',id===selectedPanel?'#b9c8df':'#e1e5ec');rect.setAttribute('stroke','#c6ceda');rect.setAttribute('stroke-width','.6');icon.append(rect);const t=document.createElementNS(NS,'text');t.setAttribute('x',(p.col+p.cs/2)*20);t.setAttribute('y',(p.row+p.rs/2)*20);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','central');t.setAttribute('font-family','Arial, sans-serif');t.setAttribute('font-weight','500');t.setAttribute('fill','#344054');t.setAttribute('font-size',8);t.textContent=i+1;icon.append(t);}
      const text=document.createElement('span');text.textContent=label;b.append(icon,text);
      b.onmouseenter=()=>{renderCanvas(next);say(T('母版预览：')+label+T(' · 点击应用，移开还原'));};b.onmouseleave=()=>{renderCanvas();say(T('已返回当前布局'));};$('masters').append(b);
    }
  }
  function drawPalettes() {
    drawColorSwatches();
    $('palettes').replaceChildren();
    $('complementPreview').replaceChildren();
    const vi=state().panels[selectedPanel].variant,base=baseSvg(selectedPanel,vi),info=paletteHeatmapInfo(selectedPanel,vi),elementScope=['element','sameColor'].includes($('scope').value);
    const currentColors=paletteSourceColors(base,keysToObjects(base),elementScope);
    if(!elementScope&&!info&&(base.querySelector('[id*="studio-heat-value-"]')||currentColors.length>Math.max(...SWATCH_SCHEMES.map(scheme=>scheme.colors.length)))){
      const note=document.createElement('p');note.className='muted palette-unavailable';
      note.textContent=T(base.querySelector('[id*="studio-heat-value-"]')?'当前热图缺少数值映射信息，请重新生成图形后更换色阶。':'当前小图的连续色标暂不支持整套配色，可选择单个元素调整颜色。');$('palettes').append(note);return;
    }
    const prepared=preparePaletteTargets();
    for(const scheme of paletteSchemes(elementScope?null:info)) {
      const {name,colors}=scheme,next=paletteState(colors,scheme,prepared),b=button('',()=>{});b.className='palette';
      bindPaletteCard(b,scheme,next,prepared.saved);
      const sw=paletteStrip(info&&!elementScope?paletteStops(scheme,info):colors,info&&!elementScope?info:null);
      const label=document.createElement('span');label.className='palette-name';label.textContent=T(paletteSchemeName(scheme,elementScope?null:info));
      const kind=document.createElement('small');kind.className='palette-kind';kind.textContent=T(info&&!elementScope?(info.kind==='diverging'?'中性色分隔低值与高值':'数值从低到高的连续色阶'):scheme.kind==='sequential'?'同色系 · 深浅区分':'分类配色 · 不同色相');
      b.append(sw,preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)),label,kind);$('palettes').append(b);
    }
  }
  function updateConditionMatrix(edit,message='分组条件表已更新'){
    if(original||state().panels[selectedPanel].locked)return;
    const groups=conditionMatrixGroups(selectedPanel);if(!groups.length)return;
    const next=copy(state()),p=next.panels[selectedPanel];p.conditionMatrix||={enabled:true,groups,rows:[],font:{font:next.typography?.font||'Arial',size:9/currentOutput().scale}};
    p.conditionMatrix.groups=groups;edit(p.conditionMatrix);commit(next,T(message));
  }
  function renderConditionMatrix(){
    const p=state().panels[selectedPanel],info=conditionMatrixInfo(selectedPanel),config=p.conditionMatrix,disabled=original||p.locked||!info.available,editor=$('conditionMatrixEditor');
    $('conditionMatrixEnabled').checked=!!config&&config.enabled!==false;$('conditionMatrixEnabled').disabled=disabled;$('addConditionRow').disabled=disabled||(config?.rows?.length||0)>=8;
    $('conditionMatrixSize').value=((config?.font?.size||state().typography?.size||9)*currentOutput().scale).toFixed(1);$('conditionMatrixSize').disabled=disabled;
    $('conditionMatrixStatus').textContent=info.reason?T(info.reason):T('每列与组别对应；空白项显示为 —。');editor.replaceChildren();
    if(!info.available||!config?.rows?.length)return;
    if(config.enabled!==false){const v=panel(selectedPanel).variants[p.variant],plan=conditionMatrixLayout(info,config,state().typography,v.viewBox[2]/v.width);if(!plan.fits)$('conditionMatrixStatus').textContent=T('当前列宽不足，请加宽小图或缩短条件文字。');else if(plan.size<plan.requestedSize-.01)$('conditionMatrixStatus').textContent=T('实际字号 {0} pt；加宽小图可使用设置字号。',(plan.size*currentOutput().scale).toFixed(1));}
    const table=document.createElement('table'),head=document.createElement('thead'),body=document.createElement('tbody'),tr=document.createElement('tr');table.className='condition-matrix-table';
    for(const label of [T('条件'),...info.groups,'']){const th=document.createElement('th');th.textContent=label;th.scope='col';tr.append(th);}head.append(tr);table.append(head,body);
    config.rows.forEach((row,index)=>{const line=document.createElement('tr');
      const inputCell=(value,label,key)=>{const cell=document.createElement('td'),input=document.createElement('input');input.type='text';input.value=value||'';input.maxLength=key===null?80:40;input.placeholder=key===null?T('条件'):'—';input.setAttribute('aria-label',label);input.disabled=disabled;
        const save=()=>{if(input.value===(value||''))return;updateConditionMatrix(matrix=>{if(key===null)matrix.rows[index].label=input.value;else matrix.rows[index].values[key]=input.value;});};input.onchange=save;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save();}};cell.append(input);line.append(cell);};
      inputCell(row.label,T('条件行 {0}',index+1),null);for(const group of info.groups)inputCell(row.values?.[group],T('条件 {0} · {1}',index+1,group),group);
      const cell=document.createElement('td'),remove=button('×',()=>updateConditionMatrix(matrix=>matrix.rows.splice(index,1)));remove.setAttribute('aria-label',T('删除条件行 {0}',index+1));remove.disabled=disabled;cell.append(remove);line.append(cell);body.append(line);
    });editor.append(table);
  }
  $('conditionMatrixEnabled').onchange=()=>updateConditionMatrix(matrix=>{matrix.enabled=$('conditionMatrixEnabled').checked;if(matrix.enabled&&!matrix.rows.length)matrix.rows.push({label:T('条件'),values:{}});});
  $('addConditionRow').onclick=()=>updateConditionMatrix(matrix=>{if(matrix.rows.length<8){matrix.enabled=true;matrix.rows.push({label:T('条件 {0}',matrix.rows.length+1),values:{}});}});
  $('conditionMatrixSize').onchange=()=>{const input=$('conditionMatrixSize');if(!input.value||!input.validity.valid)return;updateConditionMatrix(matrix=>{matrix.font={...(matrix.font||{}),font:matrix.font?.font||state().typography?.font||'Arial',size:+input.value/currentOutput().scale};});};
  $('conditionMatrixSize').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('conditionMatrixSize').onchange();}};
  const categoricalAxisViews=new Set(['compare_bar_sd','compare_bar_points','compare_mean_sd','compare_mean_ci','compare_box','compare_box_points','compare_notched_box','compare_violin','compare_violin_box','compare_swarm','compare_strip_median','compare_raincloud','compare_log_points','compare_bracket_stars','compare_bracket_p','compare_control_symbols','compare_paired_lines','compare_interaction','compare_facet_boxes','compare_dose_trend']);
  const numericAxisViews=new Set(['relation_scatter','relation_transparent','relation_regression_ci','relation_group_regression','relation_color','relation_bubble','relation_density_contour','relation_density_fill','relation_identity','relation_loess','relation_model_compare','relation_labelled','relation_residual_fitted','relation_residual_qq','relation_influence','compare_density','compare_ecdf','compare_hist_facets','time_individual_paths','time_mean_replicates','time_mean_sd','time_mean_band','time_small_multiples','time_baseline_change','time_steps','time_series','time_moving_average','time_supplied_fit','time_interrupted','time_stacked_area','time_percent_area','time_pk_target','time_mutant_window']);
  const axisInputMap={axisXMin:'x_min',axisXMax:'x_max',axisYMin:'y_min',axisYMax:'y_max',firstGroupGap:'first_group_gap'};
  let axisPending=null,axisRequest=0,axisBusy=false,axisTimer=null;
  function axisControlsInfo(source=panel(selectedPanel)){
    if(source.axis_controls)return source.axis_controls;
    const view=source.recipe?.family==='gallery'?source.recipe.parameters?.view:'',category=categoricalAxisViews.has(view),numeric=numericAxisViews.has(view),xOnly=['compare_cleveland','compare_ridgeline'].includes(view),supported=category||numeric||xOnly;
    return {supported,first_group_gap:category,x_range:numeric||xOnly,y_range:category||numeric,reference_lines:numeric?['x','y']:category?['y']:xOnly?['x']:[],defaults:{}};
  }
  function renderAxisControls(){
    const source=panel(selectedPanel),info=axisControlsInfo(source),locked=state().panels[selectedPanel].locked,settings=axisPending?.id===selectedPanel?axisPending.axes:source.recipe?.axis_settings||{};
    $('axisControls').hidden=!info.supported;$('firstGroupControls').hidden=!info.first_group_gap;$('xRangeControls').hidden=!info.x_range;$('yRangeControls').hidden=!info.y_range;
    for(const [id,key]of Object.entries(axisInputMap)){const el=$(id);el.value=settings[key]??'';el.placeholder=Number.isFinite(info.defaults?.[key])?String(+info.defaults[key].toPrecision(4)):T('自动');el.disabled=locked||!localEngine;}
    $('firstGroupGapSlider').value=settings.first_group_gap??info.defaults?.first_group_gap??.5;$('firstGroupGapSlider').disabled=locked||!localEngine;$('resetAxes').disabled=locked||!localEngine;
    $('axisControlStatus').textContent=(info.warnings||[]).map(w=>typeof w==='string'?w:w[StudioI18n.language==='en'?'en':'zh']).filter(Boolean).join(' ');
    renderReferenceLines(settings,info);
  }
  function renderReferenceLines(settings,info){
    const allowed=info.reference_lines||[],locked=state().panels[selectedPanel].locked||!localEngine,rows=settings.reference_lines||[];$('referenceLineControls').hidden=!allowed.length;$('referenceLines').replaceChildren();
    rows.forEach((line,index)=>{const card=document.createElement('div');card.className='reference-line-card';
      const field=(label,el)=>{const wrap=document.createElement('label');wrap.textContent=T(label);el.setAttribute('aria-label',T('参考线 {0} · {1}',index+1,T(label)));el.disabled=locked;wrap.append(el);card.append(wrap);return el;};
      const update=(key,value)=>{try{const next=axisSettingsFromControls();next.reference_lines||=copy(rows);next.reference_lines[index][key]=value;queueAxisSettings(next);}catch(e){$('axisControlStatus').textContent=e.message;}};
      const axis=document.createElement('select');for(const value of allowed){const option=document.createElement('option');option.value=value;option.textContent=T(value==='x'?'竖线（横轴值）':'横线（纵轴值）');axis.append(option);}field('方向',axis).value=line.axis;axis.onchange=()=>update('axis',axis.value);
      const value=document.createElement('input');value.type='number';value.step='any';field('坐标值',value).value=line.value;value.onchange=()=>{if(value.value!==''&&Number.isFinite(+value.value))update('value',+value.value);};value.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();value.onchange();}};
      const style=document.createElement('select');for(const [key,label]of [['dashed','虚线'],['dotted','点线'],['solid','实线']]){const option=document.createElement('option');option.value=key;option.textContent=T(label);style.append(option);}field('线型',style).value=line.style||'dotted';style.onchange=()=>update('style',style.value);
      const width=document.createElement('input');width.type='number';width.min='.1';width.max='6';width.step='.1';field('线宽（pt）',width).value=line.width||.8;width.onchange=()=>{if(width.value&&width.validity.valid)update('width',+width.value);};
      const color=document.createElement('input');color.type='color';field('颜色',color).value=line.color||'#7b8797';color.oninput=()=>update('color',color.value);
      const remove=button(T('移除'),()=>{const next=axisSettingsFromControls();next.reference_lines=(next.reference_lines||rows).filter((_,i)=>i!==index);queueAxisSettings(next,true);});remove.disabled=locked;card.append(remove);$('referenceLines').append(card);
    });
    $('addReferenceLine').disabled=locked||rows.length>=8;$('addZeroLine').disabled=locked||rows.length>=8||!allowed.includes('y');
  }
  function axisSettingsFromControls(){
    const info=axisControlsInfo(),settings=copy(axisPending?.id===selectedPanel?axisPending.axes:panel(selectedPanel).recipe?.axis_settings||{});
    for(const [id,key]of Object.entries(axisInputMap)){if(key==='first_group_gap'?!info.first_group_gap:key.startsWith('x_')?!info.x_range:!info.y_range)continue;const el=$(id);if(el.value.trim()===''){delete settings[key];continue;}const value=Number(el.value);if(!Number.isFinite(value)||!el.validity.valid)throw Error(T('请输入有效的坐标数值'));settings[key]=value;}
    for(const axis of ['x','y'])if(Number.isFinite(settings[axis+'_min'])&&Number.isFinite(settings[axis+'_max'])&&settings[axis+'_min']>=settings[axis+'_max'])throw Error(T('坐标下限必须小于上限'));
    return settings;
  }
  function queueAxisSettings(settings,immediate=false){
    if(!localEngine||state().panels[selectedPanel].locked)return;
    if(dataDrafts[selectedPanel]){$('axisControlStatus').textContent=T('请先完成当前数据修改，再调整坐标。');return;}
    axisPending={id:selectedPanel,projectId:project.id,axes:settings,request:++axisRequest};clearTimeout(axisTimer);$('axisControlStatus').textContent=T('正在重绘坐标与参考线…');if(immediate)applyAxisSettings();else axisTimer=setTimeout(applyAxisSettings,400);
  }
  async function applyAxisSettings(){
    if(axisBusy||!axisPending)return;const task=axisPending,id=task.id;
    if(task.projectId!==project.id||selectedPanel!==id||!state().panels[id]||dataDrafts[id]){axisPending=null;return;}
    const source=panel(id),record=state().panels[id].statistics,statistics=record?.binding==='current'&&!record.stale?record.config:undefined,statsSnapshot=JSON.stringify(record),serial=dataSerial,oldName=variant(id).name,oldSize=variant(id).size||'original';axisBusy=true;
    try{const response=await engineFetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe:source.recipe,rows:source.table.rows,axes:task.axes,statistics})}),result=await response.json();if(!response.ok)throw Error(result.error);
      if(axisPending!==task||project.id!==task.projectId||selectedPanel!==id||!state().panels[id]||state().panels[id].locked||panel(id)!==source||dataSerial!==serial||JSON.stringify(state().panels[id].statistics)!==statsSnapshot)return;
      axisPending=null;const asset=result.panel;asset.name=source.name;asset.initialVariant=Math.max(0,asset.variants.findIndex(v=>v.name===oldName&&(v.size||'original')===oldSize));installAsset(asset,id,null,T('坐标与参考线已更新'),true,true);
    }catch(error){if(axisPending===task&&project.id===task.projectId&&selectedPanel===id){axisPending=null;$('axisControlStatus').textContent=String(error.message).split(' / ')[StudioI18n.language==='en'?1:0]||error.message;}}
    finally{axisBusy=false;if(axisPending===task)axisPending=null;else if(axisPending)applyAxisSettings();}
  }
  for(const id of Object.keys(axisInputMap)){$(id).onchange=()=>{try{queueAxisSettings(axisSettingsFromControls());}catch(e){$('axisControlStatus').textContent=e.message;}};$(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();try{queueAxisSettings(axisSettingsFromControls(),true);}catch(error){$('axisControlStatus').textContent=error.message;}}};}
  $('firstGroupGapSlider').oninput=()=>{$('firstGroupGap').value=$('firstGroupGapSlider').value;try{queueAxisSettings(axisSettingsFromControls());}catch(e){$('axisControlStatus').textContent=e.message;}};
  $('resetAxes').onclick=()=>queueAxisSettings({},true);
  function addReferenceLine(zero=false){const settings=axisSettingsFromControls(),info=axisControlsInfo(),axis=(info.reference_lines||[]).includes('y')?'y':'x',range=info.effective?.[0]||info.defaults||{},lo=range[axis+'_min']??0,hi=range[axis+'_max']??1,value=zero?0:range[axis+'_scale']==='log'?Math.sqrt(lo*hi):(lo+hi)/2;settings.reference_lines=[...(settings.reference_lines||[]),{axis,value:+value.toPrecision(5),style:zero?'solid':'dotted',width:.8,color:'#7b8797'}];queueAxisSettings(settings,true);}
  $('addReferenceLine').onclick=()=>addReferenceLine();$('addZeroLine').onclick=()=>addReferenceLine(true);
  let variantRequest=0;
  async function activateVariant(index){
    const request=++variantRequest,id=selectedPanel,source=panel(id),target=source.variants[index],owner=project,serial=dataSerial,initialVariant=state().panels[id].variant;
    if(state().panels[id].locked||!target)return;
    if(dataDrafts[id])return say(T('请先完成当前数据更新'));
    if(['gallery','roc'].includes(source.recipe?.family)&&localEngine&&target.name!==(source.recipe.family==='gallery'?source.recipe.parameters.view:source.recipe.studio_view||'roc')){
      const recipe=copy(source.recipe),oldSize=variant(id).size||'original';if(recipe.family==='gallery')recipe.parameters.view=target.name;else recipe.studio_view=target.name;
      say(T('正在准备所选样式…'));
      const record=state().panels[id].statistics,statistics=record?.binding==='current'&&!record.stale?record.config:undefined,statsSnapshot=JSON.stringify(record);
      const response=await engineFetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe,rows:source.table.rows,statistics})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      if(request!==variantRequest||project!==owner||selectedPanel!==id||!state().order.includes(id)||state().panels[id].locked||panel(id)!==source)return;
      if(dataSerial!==serial||dataDrafts[id]||state().panels[id].variant!==initialVariant||JSON.stringify(state().panels[id].statistics)!==statsSnapshot)return say(T('目标已变化，请重新选择'));
      result.panel.name=source.name;result.panel.initialVariant=Math.max(0,result.panel.variants.findIndex(v=>v.name===target.name&&(v.size||'original')===oldSize));installAsset(result.panel,id,null,T('已切换候选图'),true,true);
    }else{const next=copy(state());next.panels[id].variant=index;selected=[];commit(matchSizes(next,[id]),T('已切换候选图'));}
  }
  // Arrow-key repeats preview only the selected artists. One release is one
  // history step; steps are measured in final-publication points, not pixels.
  let nudgeGesture=null,nudgeFrame=0;
  const nudgeSelectionKey=()=>JSON.stringify({groups:selectionGroups(),annotations:selectedAnnotations,label:selectedPanelLabel,guide:selectedAlignmentGuide});
  function validNudgeGesture(gesture){return gesture&&gesture.owner===project&&gesture.base===state()&&gesture.selection===nudgeSelectionKey()&&gesture.canvas===zoomView?.nudgeCanvas&&gesture.assets.every(([id,asset])=>panel(id)===asset);}
  function finishNudge(save=true,restore=true,quiet=false){
    const gesture=nudgeGesture;if(!gesture)return false;nudgeGesture=null;if(nudgeFrame)cancelAnimationFrame(nudgeFrame);nudgeFrame=0;
    const valid=validNudgeGesture(gesture);
    if(save&&valid){if(JSON.stringify(gesture.next)!==JSON.stringify(gesture.base)){if(quiet)gesture.preview.draw(gesture.next,{dx:gesture.dx,dy:gesture.dy});commit(gesture.next,T('已微调所选对象'),!quiet);if(quiet){$('undo').disabled=history.index===0;$('redo').disabled=history.index===history.states.length-1;}}else if(restore)gesture.preview.draw(gesture.base,{dx:0,dy:0});}
    else if(restore&&gesture.canvas===zoomView?.nudgeCanvas)gesture.preview.draw(state(),{dx:0,dy:0});
    gesture.preview.clear();
    return true;
  }
  function focusCanvasForKeyboard(event){
    const viewport=$('viewport');if(!viewport||event.button!==0||inlineEditor||editingTextTarget(event.target))return;
    const onArtboard=event.target?.closest?.('#artboard'),r=viewport.getBoundingClientRect(),left=r.left+viewport.clientLeft,top=r.top+viewport.clientTop;
    if(!onArtboard&&(event.target!==viewport||event.clientX<left||event.clientX>=left+viewport.clientWidth||event.clientY<top||event.clientY>=top+viewport.clientHeight))return;
    viewport.setAttribute('tabindex','-1');viewport.focus({preventScroll:true});
  }
  function keyboardNudge(event){
    const direction={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(!direction||event.defaultPrevented||event.isComposing||editingTextTarget(event.target)||event.target?.closest?.('[role="separator"]')||event.ctrlKey||event.metaKey||original||layoutMode||dragging||overlayPlacement||inlineEditor)return false;
    if(zoomView?.nudgeCanvas?.isPreview||zoomView?.nudgeCanvas?.isGestureActive?.())return false;
    if(nudgeGesture&&!validNudgeGesture(nudgeGesture))finishNudge(false);
    if(!nudgeGesture){
      cancelQueuedZoom();cancelQuickPreview();const canvas=zoomView?.nudgeCanvas;if(!canvas)return false;
      const items=selectedAlignmentGuide?[{kind:'guide',id:selectedAlignmentGuide}]:quickSelectedObjects().filter(item=>!item.locked);
      if(!items.length)return false;const base=state(),assets=[...new Set(items.filter(item=>item.kind==='element').map(item=>item.id))].map(id=>[id,panel(id)]);
      nudgeGesture={base,next:copy(base),owner:project,selection:nudgeSelectionKey(),canvas,assets,items,preview:canvas.capture(items),keys:new Set(),dx:0,dy:0};
    }
    event.preventDefault();const gesture=nudgeGesture,step=(event.altKey ? .1 : event.shiftKey ? 10 : 1)/currentOutput().scale;
    const result=nudgeSelectionState(gesture.base,gesture.items,gesture.dx+direction[0]*step,gesture.dy+direction[1]*step,gesture.canvas.geometry,gesture.next);
    gesture.dx=result.dx;gesture.dy=result.dy;gesture.keys.add(event.key);
    if(!nudgeFrame)nudgeFrame=requestAnimationFrame(()=>{nudgeFrame=0;if(validNudgeGesture(gesture))gesture.preview.draw(gesture.next,{dx:gesture.dx,dy:gesture.dy});else finishNudge(false);});
    return true;
  }
  // Frequent actions use explicit selection, independent of the inspector scope.
  let quickPreview=null,quickPreviewFrame=0,quickCharacterSelection=null;
  function quickSelectedObjects(){
    const board=$('artboard'),s=state(),items=[];
    if(!board)return items;
    for(const group of selectionGroups())for(const key of group.keys){
      const source=board.querySelector(`[data-panel="${group.id}"] [data-key="${key}"]`),el=source?.closest('text')||source;if(!el)continue;
      const parentKey=el.getAttribute('data-key'),p=s.panels[group.id],locked=p.locked||[el,...el.querySelectorAll('[data-key]')].some(n=>(p.lockedElements?.[group.vi]||[]).includes(n.getAttribute('data-key')));
      if(!items.some(item=>item.kind==='element'&&item.id===group.id&&item.key===parentKey))items.push({kind:'element',id:group.id,vi:group.vi,key:parentKey,el,locked,text:el.matches('text')?el.textContent:null});
    }
    for(const id of selectedAnnotations){const a=s.overlays?.find(a=>a.id===id),el=board.querySelector(`[data-annotation="${id}"] > :first-child`);if(a&&el)items.push({kind:'overlay',id,el,locked:a.locked,text:a.type==='text'?a.text:null});}
    if(selectedPanelLabel){const label=displayedPanelLabel(s,selectedPanelLabel),el=board.querySelector(`[data-panel-label="${selectedPanelLabel}"]`);if(label&&el)items.push({kind:'label',id:selectedPanelLabel,el,locked:s.panels[selectedPanelLabel].locked,text:label.text});}
    return items;
  }
  function quickObjectTarget(item,s=state()){
    const record=item.kind==='element'?editsFor(item.id,item.vi,s)[item.key]?.['rich-text']:item.kind==='overlay'?s.overlays.find(a=>a.id===item.id)?.richText:s.panels[item.id].label?.richText;
    return {...item,identity:[item.kind,item.id,item.vi,item.key].join('/'),record,projectId:project.id,asset:item.kind==='element'?panel(item.id):undefined};
  }
  function quickUniformStyle(record,text,property){return StudioRichText.remap(record,text).runs.filter(run=>run.style[property]===true).reduce((n,run)=>n+run.end-run.start,0)===text.length&&text.length>0;}
  function quickObjectSize(item){
    const s=state(),scale=currentOutput().scale;
    if(item.kind==='overlay')return s.overlays.find(a=>a.id===item.id).size*scale;
    if(item.kind==='label')return displayedPanelLabel(s,item.id).size*scale;
    const v=panel(item.id).variants[item.vi];return textPointSize(item.el)*v.width/v.viewBox[2]*scale;
  }
  function quickStyleState(base,items,property,value){
    const next=copy(base),scale=currentOutput().scale;
    for(const item of items){if(item.locked||property==='font-size'&&item.text===null)continue;
      if(item.kind==='element'){
        if(property==='color'){if(item.el.localName==='image')continue;for(const channel of ['fill','stroke']){const current=paint(item.el,channel);if(current&&current!=='none'&&!/url\(/.test(current))setEdit(next,item.id,item.vi,item.key,channel,value);}}
        else{const v=panel(item.id).variants[item.vi],size=+value/scale*v.viewBox[2]/v.width,oldSize=textPointSize(item.el);setEdit(next,item.id,item.vi,item.key,'font-size',String(size));
          for(const child of item.el.querySelectorAll('tspan[data-key]')){const raw=child.style.fontSize||child.getAttribute('font-size')||'';if(/%|em/.test(raw))continue;const childSize=parseFloat(raw);if(Number.isFinite(childSize)&&oldSize>0)setEdit(next,item.id,item.vi,child.getAttribute('data-key'),'font-size',String(childSize*size/oldSize));}}
      }else if(item.kind==='overlay'){const a=next.overlays.find(a=>a.id===item.id);a[property==='color'?'color':'size']=property==='color'?value:+value/scale;}
      else if(property==='font-size')next.panels[item.id].label.size=+value/scale;
    }return next;
  }
  function cancelQuickPreview(restore=true){if(quickPreviewFrame)cancelAnimationFrame(quickPreviewFrame);quickPreviewFrame=0;const had=!!quickPreview;quickPreview=null;if(had&&restore)renderCanvas();}
  function previewQuickStyle(property,value){
    if(original||property==='font-size'&&(!Number.isFinite(+value)||+value<Number($('quickFontSize').min||4)||+value>Number($('quickFontSize').max||72))||property==='color'&&!/^#[0-9a-f]{6}$/i.test(value)){cancelQuickPreview();return false;}
    if(!quickPreview||quickPreview.base!==state()||quickPreview.property!==property){cancelQuickPreview(false);quickPreview={base:state(),items:quickSelectedObjects(),property};}
    quickPreview.next=quickStyleState(quickPreview.base,quickPreview.items,property,value);
    if(property==='color')$('quickColor').closest('label').style.setProperty('--quick-color',value);
    if(!quickPreviewFrame)quickPreviewFrame=requestAnimationFrame(()=>{quickPreviewFrame=0;if(quickPreview?.base===state())renderCanvas(quickPreview.next);else quickPreview=null;});return true;
  }
  function commitQuickStyle(property,value){
    if(original||!previewQuickStyle(property,value)||!quickPreview||quickPreview.property!==property)return;
    const next=quickPreview.next;cancelQuickPreview(false);if(commit(next,T(property==='color'?'已更新所选对象颜色':'已更新所选文字字号'))&&property==='color')rememberColor(value);
  }
  function captureQuickCharacters(event){
    event.preventDefault();quickCharacterSelection=getActiveRichTextSelection();
    const field=document.activeElement;if(field?.matches?.('.canvas-text-editor')&&field.selectionEnd>field.selectionStart&&typeof inlineEditor!=='undefined'&&inlineEditor?.target)quickCharacterSelection={target:inlineEditor.target,start:field.selectionStart,end:field.selectionEnd,inline:true};
  }
  function formatQuickCharacters(action){
    if(original)return;cancelQuickPreview();let selection=quickCharacterSelection;quickCharacterSelection=null;
    // Close the inline session before formatting so its old record cannot later
    // overwrite this character edit when the textarea loses focus.
    if(selection?.inline){inlineEditor?.finish(true);selection={...selection,target:richTextTarget()};}
    if(selection?.target&&selection.end>selection.start&&validRichTextTarget(selection.target))return formatSelectedRichText(action,selection.start,selection.end,selection.target);
    if(['super','sub'].includes(action)){focusRichTextControls();const field=$('richTextContent');field?.setSelectionRange(0,0);return say(T('请先选中需要设置的字符'));}
    const items=quickSelectedObjects().filter(item=>!item.locked&&item.text!==null&&item.text.length);if(!items.length)return;
    const targets=items.map(item=>quickObjectTarget(item)),records=targets.map(target=>target.record||StudioRichText.nativeStyles(target.el));
    const enabled=targets.every((target,i)=>quickUniformStyle(records[i],target.text,action)),next=copy(state());
    targets.forEach((target,i)=>saveRichText(next,target,StudioRichText.format(records[i],target.text,0,target.text.length,action,!enabled)));
    commit(next,T('已更新所选字符格式'));
  }
  function alignSelectedObjects(mode){
    if(original||!['left','center','right','top','middle','bottom'].includes(mode))return;
    cancelQuickPreview();const items=quickSelectedObjects().filter(item=>!item.locked).map(item=>({...item,b:item.el.getBoundingClientRect()}));if(items.length<2)return say(T('请选择至少两个对象'));
    const svg=$('artboard').querySelector('svg'),box=svg.getBoundingClientRect(),l=layout(),horizontal=['left','center','right'].includes(mode),low=Math.min(...items.map(item=>horizontal?item.b.left:item.b.top)),high=Math.max(...items.map(item=>horizontal?item.b.right:item.b.bottom)),target=['left','top'].includes(mode)?low:['right','bottom'].includes(mode)?high:(low+high)/2,next=copy(state());
    for(const item of items){const b=item.b,current=mode==='left'?b.left:mode==='right'?b.right:mode==='top'?b.top:mode==='bottom'?b.bottom:horizontal?(b.left+b.right)/2:(b.top+b.bottom)/2,delta=(target-current)/(horizontal?box.width:box.height),distance=delta*(horizontal?l.width:l.height);
      if(item.kind==='overlay'){const a=next.overlays.find(a=>a.id===item.id),key=horizontal?'x':'y',space=overlayEditingSpace(l);a[key]=Math.max(0,Math.min(1-(horizontal?a.w:a.h),a[key]+distance/(horizontal?space.width:space.height)));}
      else if(item.kind==='label'){const cell=l.positions.find(pos=>pos.id===item.id),pos=cell.renderBox||cell,label=next.panels[item.id].label,key=horizontal?'x':'y';label[key]=Math.max(0,Math.min(100,label[key]+distance/(horizontal?pos.width:pos.height)*100));}
      else{const prop=horizontal?'offset-x':'offset-y';setEdit(next,item.id,item.vi,item.key,prop,String(+(editsFor(item.id,item.vi)[item.key]?.[prop]||0)+distance));}
    }commit(next,T('已对齐所选对象'));
  }
  function renderQuickToolbar(){
    if(!$('canvasQuickToolbar'))return;const all=quickSelectedObjects(),items=all.filter(item=>!item.locked),text=items.filter(item=>item.text!==null),guide=!!selectedAlignmentGuide;
    for(const id of ['quickFontSize','quickBold','quickItalic','quickSuperscript','quickSubscript'])$(id).disabled=original||!text.length;
    for(const id of ['quickSuperscript','quickSubscript'])$(id).disabled=original||text.length!==1||all.length!==1;
    $('quickFontSize').min=String(items.some(item=>item.kind==='label')?6*currentOutput().scale:4);$('quickFontSize').max=String(items.some(item=>item.kind==='label')?Math.min(72,36*currentOutput().scale):72);
    $('quickAlignAction').disabled=original||items.length<2;$('quickColor').disabled=original||!items.some(item=>item.kind!=='label'&&item.el.localName!=='image');$('quickDelete').disabled=original||(!items.length&&!guide);
    for(const id of ['quickInsertText','overlayType','addOverlay','quickGuideAction'])$(id).disabled=original;
    for(const option of $('quickGuideAction').options){if(option.value==='delete')option.disabled=!guide;if(option.value==='clear')option.disabled=!(state().alignmentGuides||[]).length;}
    if(document.activeElement!==$('quickFontSize')){const sizes=text.map(quickObjectSize),same=sizes.length&&sizes.every(size=>Math.abs(size-sizes[0])<.05);$('quickFontSize').value=same?+sizes[0].toFixed(1):'';$('quickFontSize').placeholder=sizes.length?T('混合'):'';}
    const color=items.find(item=>item.kind!=='label'&&item.el.localName!=='image');if(color&&document.activeElement!==$('quickColor')){const value=color.kind==='overlay'?state().overlays.find(a=>a.id===color.id).color:hex(paint(color.el,'fill'))||hex(paint(color.el,'stroke'));if(value){$('quickColor').value=value;$('quickColor').closest('label').style.setProperty('--quick-color',value);}}
    for(const [id,property]of [['quickBold','bold'],['quickItalic','italic']]){let active=false;try{active=!!text.length&&text.every(item=>{const target=quickObjectTarget(item),record=StudioRichText.parse(target.record||StudioRichText.nativeStyles(item.el),target.text);return quickUniformStyle(record,target.text,property);});}catch{}$(id).setAttribute('aria-pressed',String(!!active));}
    $('quickSelectionStatus').textContent=guide?T('已选参考线'):all.length?T('已选 {0} 个对象',all.length):T('选择对象以编辑');
    $('quickSelectionStatus').title=T('方向键微调 1 pt；Shift + 方向键 10 pt；Alt + 方向键 0.1 pt。');
  }
  function setupQuickToolbar(){
    if(!$('canvasQuickToolbar'))return;
    $('addOverlay').textContent='+';$('addOverlay').title=T('插入标注');$('addOverlay').setAttribute('aria-label',T('插入标注'));
    $('quickInsertText').onclick=()=>{cancelQuickPreview();$('overlayType').value='text';armOverlayPlacement('text');};
    $('overlayType').onchange=()=>{cancelQuickPreview();armOverlayPlacement($('overlayType').value);};
    $('quickGuideAction').onchange=()=>{const action=$('quickGuideAction').value;$('quickGuideAction').value='';const target={horizontal:'addHorizontalGuide',vertical:'addVerticalGuide',delete:'deleteAlignmentGuide',clear:'clearAlignmentGuides'}[action];if(target){cancelQuickPreview();$(target)?.click();}};
    $('quickAlignAction').onchange=()=>{const mode=$('quickAlignAction').value;$('quickAlignAction').value='';alignSelectedObjects(mode);};
    for(const [id,action]of [['quickBold','bold'],['quickItalic','italic'],['quickSuperscript','super'],['quickSubscript','sub']]){$(id).onpointerdown=captureQuickCharacters;$(id).onclick=()=>formatQuickCharacters(action);}
    for(const [id,property]of [['quickFontSize','font-size'],['quickColor','color']]){const input=$(id);input.oninput=()=>previewQuickStyle(property,input.value);input.onchange=()=>commitQuickStyle(property,input.value);input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();commitQuickStyle(property,input.value);}else if(event.key==='Escape'){event.preventDefault();cancelQuickPreview();input.blur();renderQuickToolbar();}};}
    $('quickDelete').onclick=()=>{cancelQuickPreview();if(selectedAlignmentGuide)deleteAlignmentGuide();else deleteSelectedObjects();};
  }
  function renderSelectionProperties() {
    const pan=panel(selectedPanel),vi=state().panels[selectedPanel].variant;
    const count=selectionGroups().reduce((n,g)=>n+g.keys.length,0);
    $('deleteElements').disabled=original||(!count&&!selectedAnnotations.length&&!selectedPanelLabel);
    $('selectionTitle').textContent=selectedPanelLabel?T('当前图号 · {0}',displayedPanelLabel(state(),selectedPanelLabel)?.text||''):count?T('已选 {0} 个元素',count):T('当前小图 · ')+StudioI18n.panelName(pan);
    $('textContent').value='';$('textContent').disabled=true;$('applyText').disabled=true;
    if(selected.length===1){const svg=editableSource(selectedPanel,vi),el=svg.querySelector(`[data-key="${selected[0]}"]`);if(el){
      $('fillMode').value=paint(el,'fill')==='none'?'none':'solid';$('elementStroke').value=(parseFloat(el.style.strokeWidth||el.getAttribute('stroke-width')||'1')*pan.variants[vi].width/pan.variants[vi].viewBox[2]*currentOutput().scale).toFixed(2);$('textAlign').value=el.style.textAnchor||el.getAttribute('text-anchor')||'start';const fill=hex(paint(el,'fill')),stroke=hex(paint(el,'stroke'));
      const h=(fill&&chromatic(fill)?fill:null)||(stroke&&chromatic(stroke)?stroke:null)||fill||stroke;if(h)$('color').value=h;
      const size=parseFloat(el.style.fontSize||el.getAttribute('font-size')||'');if(Number.isFinite(size))$('fontSize').value=(size*pan.variants[vi].width/pan.variants[vi].viewBox[2]*currentOutput().scale).toFixed(1);
      const family=(el.style.fontFamily||el.getAttribute('font-family')||'').replace(/["']/g,'');if([...$('font').options].some(o=>o.value===family))$('font').value=family;
      const alpha=parseFloat(el.style.opacity||el.getAttribute('opacity')||'1');$('opacity').value=String(alpha*100);$('opacityValue').value=Math.round(alpha*100)+'%';
      if(el.matches('text,tspan')&&!el.children.length){$('textContent').value=el.textContent;$('textContent').disabled=false;$('applyText').disabled=false;}
    }}
    if(count>1){const text=selectionGroups().flatMap(g=>{const svg=editableSource(g.id,g.vi);return g.keys.map(k=>svg.querySelector(`[data-key="${k}"]`)).filter(el=>el?.matches('text,tspan'));});const sizes=text.map(el=>textPointSize(el)*currentOutput().scale).filter(Number.isFinite);if(sizes.length){const same=sizes.every(n=>Math.abs(n-sizes[0])<.01);$('fontSize').value=same?sizes[0].toFixed(1):'';$('fontSize').placeholder=same?'':T('混合');}}
    syncColorControls();renderFontTargets();renderHeatmapControls();renderRichTextControls();renderStatisticalLineControls();renderQuickToolbar();
  }
  let literatureBrowser=null,literaturePreview=null;
  function previewLiteratureChart(view){
    const source=panel(selectedPanel),current=variant(selectedPanel),index=source.variants.findIndex(v=>v.name===view&&(v.size||'original')===(current.size||'original'));
    const vi=index<0?source.variants.findIndex(v=>v.name===view):index;if(vi<0||dataDrafts[selectedPanel])return say(T('请先完成当前数据更新'));
    literaturePreview={owner:project,source,id:selectedPanel,vi};$('literaturePreviewTitle').textContent=chartName(view);
    $('literatureFigurePreview').replaceChildren(preview(editedSvg(selectedPanel,vi)));$('literaturePreviewDialog').showModal();
  }
  $('closeLiteraturePreview').onclick=()=>{$('literaturePreviewDialog').close();literaturePreview=null;};
  $('applyLiteraturePreview').onclick=guard(async()=>{const pending=literaturePreview;$('literaturePreviewDialog').close();literaturePreview=null;if(!pending||project!==pending.owner||selectedPanel!==pending.id||panel(pending.id)!==pending.source||dataDrafts[pending.id])return;await activateVariant(pending.vi);});
  function renderLiteratureExamples(){
    if(typeof StudioLiterature==='undefined'||!$('literatureExamples'))return;
    literatureBrowser||=StudioLiterature.mount($('literatureExamples'),{getContext:()=>{const source=panel(selectedPanel);return {views:source?.table&&!['blank-canvas','user-import'].includes(source.provenance)?StudioCatalogue.rank(source,$('chartGoal').value).map(({v})=>v.name):[],goal:$('chartGoal').value,language:StudioI18n.language,contextKey:project.id+'/'+selectedPanel+'/'+(source?.table?.sha256||'')};},onPreview:previewLiteratureChart});
    literatureBrowser.refresh();
  }
  function renderChartChoices() {
    const pan=panel(selectedPanel),vi=state().panels[selectedPanel].variant;
    const current=pan.variants[vi];$('sizes').replaceChildren();
    const sizeState=i=>{if(state().panels[selectedPanel].locked)throw Error(T('小图已锁定'));const v=pan.variants[i],span=({wide:[1,2],spanWide:[1,2],spanThree:[1,3],spanTall:[2,1],large:[2,2]})[v.size];const next=span?resizePanel(state(),selectedPanel,...span):copy(state());if(span)next.typography||={font:'Arial',size:9};next.panels[selectedPanel].variant=i;return next;};
    pan.variants.forEach((v,i)=>{if(v.name!==current.name)return;let next,error;try{next=sizeState(i);}catch(e){error=e.message;}const b=button('',()=>{if(error)return say(T(error));selected=[];commit(next,T('已切换画布规格'));});b.className='candidate'+(i===vi?' active':'');const text=document.createElement('span');text.textContent=T(sizeNames[v.size||'original'])+` · ${(v.width*25.4/72).toFixed(0)} × ${(v.height*25.4/72).toFixed(0)} mm`;b.setAttribute('aria-label',T('画布 ')+T(sizeNames[v.size||'original']));b.append(preview(editedSvg(selectedPanel,i)),text);if(error)b.title=T(error);b.onmouseenter=()=>{if(next)renderCanvas(next);};b.onmouseleave=()=>renderCanvas();$('sizes').append(b);});
    $('slotChoices').replaceChildren();
    for(const [label,rs,cs] of [['1 × 1',1,1],['跨 2 列',1,2],['跨 3 列',1,3],['整行',1,state().columns],['跨 2 行',2,1]]){let next,error;try{next=matchSizes(resizePanel(state(),selectedPanel,rs,cs),[selectedPanel]);}catch(e){error=e.message;}const b=button(T(label),()=>{if(error)return say(T(error));selected=[];commit(next,T('已应用跨格'));});b.disabled=!!error;if(error)b.title=T(error);b.onmouseenter=()=>{if(next)renderCanvas(next);};b.onmouseleave=()=>renderCanvas();$('slotChoices').append(b);}

    if($('sizes').children.length===1){const note=document.createElement('p');note.className='muted';note.textContent=T('此图只有原始尺寸。用受支持的绘图配方和源数据准备尺寸候选后，可直接切换。');$('sizes').append(note);}
    $('rocRequirements').hidden=pan.analysis?.family!=='roc';$('rocNeeds').replaceChildren();
    if(pan.analysis?.family==='roc')for(const [name,entry]of Object.entries(StudioDiscovery)){if(!name.startsWith('roc_requires_'))continue;const [title,need,note]=entry[StudioI18n.language];const card=document.createElement('p');card.className='muted';card.textContent=title+' · '+need+' — '+note;$('rocNeeds').append(card);}
    $('candidates').replaceChildren();
    $('candidateHint').textContent=pan.variants.length>1?T('预览使用当前数据；排序依据数据结构与表达目的。'):T('此图暂无可直接切换的图型；可从完整图型库选择模板。');
    const ranked=['blank-canvas','user-import'].includes(pan.provenance)?[]:StudioCatalogue.rank(pan,$('chartGoal').value);ranked.slice(0,+$('topCount').value).forEach(({v,i},rank)=>{const sameSize=pan.variants.findIndex(x=>x.name===v.name&&(x.size||'original')===(current.size||'original'));if(sameSize>=0){i=sameSize;v=pan.variants[i];}const b=button('',guard(()=>activateVariant(i)));b.className='candidate'+(i===vi?' active':'');b.setAttribute('aria-label',chartName(v.name));
      b.onmouseenter=()=>{const next=copy(state());next.panels[selectedPanel].variant=i;renderCanvas(next);say(T('整图预览：')+(chartName(v.name))+T(' · 点击应用，移开还原'));};b.onmouseleave=()=>{renderCanvas();say(T('已返回当前编辑版'));};
      const text=document.createElement('span');text.textContent=(rank===0?T('推荐 · '):`${rank+1} · `)+chartName(v.name);
      const explanation=document.createElement('small'),hint=chartInsight(v.name);explanation.className='candidate-insight';explanation.textContent=hint?T('适合：')+T(hint[0]).replace(/[。.]$/,'')+(StudioI18n.language==='en'?'. ':'。')+T(hint[1]):T('由上游分析流程提供；请结合下方分析记录判断它适合回答的问题。');
      b.append(preview(editedSvg(selectedPanel,i)),text,explanation);$('candidates').append(b);});
    renderLiteratureExamples();
  }
  function renderInspectorPreviews() {
    if(!['explore','palette'].includes(activePane))return;
    const signature=JSON.stringify([selectedPanel,StudioI18n.language,$('scope').value,$('chartGoal').value,$('topCount').value,selectionGroups(),selectedAnnotations,selectedPanelLabel,project.heatmapRenders?.[selectedPanel+'/'+state().panels[selectedPanel].variant]?.sha256]),cached=inspectorPreviewCache[activePane];
    if(cached?.state===state()&&cached.project===project&&cached.signature===signature)return;
    if(activePane==='explore')renderChartChoices();else drawPalettes();
    inspectorPreviewCache[activePane]={state:state(),project,signature};
  }
  let categorySpacingGesture=null,categorySpacingFrame=0,categorySpacingCache=null;
  function categorySpacingFactor(p,info){return info?.barGeometry?p?.geometry?.groupGap??1:p?.groupSpacing?.factor??1;}
  function categorySpacingLimits(info){return info?.barGeometry?[.65,1.05]:[.5,1.25];}
  function setCategorySpacing(p,factor,info){if(info?.barGeometry){p.geometry={barWidth:p.geometry?.barWidth??1,groupGap:factor};delete p.groupSpacing;}else p.groupSpacing={factor};}
  function categorySpacingInspection(id=selectedPanel,s=state()){
    const p=s.panels[id],vi=p?.variant;if(!p||typeof StudioGroupSpacing==='undefined')return {available:false,reason:'unavailable-category-geometry'};
    const pos=layout(s).positions.find(value=>value.id===id),flow=pos&&fittedVariant(pos,s),cached=categorySpacingCache;
    if(cached?.owner===project&&cached.state===s&&cached.id===id&&cached.vi===vi&&cached.flow===flow)return cached.info;
    const svg=editedSvg(id,vi,s,false,flow,true),info=StudioGroupSpacing.inspect(svg,{orders:groupSpacingOrders(id,s),view:panel(id).variants[vi].name}),locked=new Set(p.lockedElements?.[vi]||[]);
    if(info.reason==='existing-bar-layout')Object.assign(info,{available:!locked.size,reason:locked.size?'locked-category-element':'',barGeometry:true,axes:[]});
    if(info.available&&!info.barGeometry){const plan=StudioGroupSpacing.plan(info,p.groupSpacing?.factor??1);if(!plan.available)Object.assign(info,{available:false,reason:plan.reason});}
    if(info.available&&info.axes.some(axis=>[...axis.groups.flatMap(group=>group.nodes),...(axis.connections||[]).map(item=>item.node),...(axis.annotations||[]).map(item=>item.node)].some(node=>[node,...node.querySelectorAll('[data-key]')].some(el=>locked.has(el.getAttribute('data-key'))))))Object.assign(info,{available:false,reason:'locked-category-element'});
    categorySpacingCache={owner:project,state:s,id,vi,flow,info};return info;
  }
  function categorySpacingMessage(info,requested,actual){
    if(!info.available)return T(({'coordinate-structure-must-remain-fixed':'此图的坐标间隔具有数值或矩阵意义，保留原始比例。','locked-category-element':'组内有已锁定元素，请先解锁。','insufficient-group-space':'当前图没有足够空间调整组间距，请增大小图尺寸。'})[info.reason]||'当前图无法可靠识别独立类别组，不能调整组间距。');
    if(Number.isFinite(actual)&&Math.abs(actual-requested)>.005)return T('实际间距 {0}%（设置 {1}%）；已保留组间安全距离与轴内边界。',Math.round(actual*100),Math.round(requested*100));
    return T('100% 为原始间距；整组平移，数据与图形大小保持不变。');
  }
  function renderGroupSpacingControls(){
    if(!$('categorySpacing'))return;
    const p=state().panels[selectedPanel],info=categorySpacingInspection(),requested=categorySpacingFactor(p,info),disabled=original||!!p?.locked||!info.available,live=$('artboard').querySelector(`[data-panel="${selectedPanel}"]`),value=live?.getAttribute('data-studio-group-spacing-actual'),actual=info.barGeometry||value===null||value===undefined?requested:Number(value),[min,max]=categorySpacingLimits(info);
    $('categorySpacing').min=min;$('categorySpacing').max=max;$('categorySpacingPercent').min=Math.round(min*100);$('categorySpacingPercent').max=Math.round(max*100);if($('categorySpacingMin'))$('categorySpacingMin').textContent=Math.round(min*100)+'%';if($('categorySpacingMax'))$('categorySpacingMax').textContent=Math.round(max*100)+'%';
    $('categorySpacing').value=requested;$('categorySpacingPercent').value=Math.round(requested*100);
    for(const id of ['categorySpacing','categorySpacingPercent'])$(id).disabled=disabled;
    $('resetGroupSpacing').disabled=original||!!p?.locked||(info.barGeometry?requested===1:!p?.groupSpacing);
    $('categorySpacingStatus').textContent=original?T('返回编辑版后调整组间距。'):p?.locked?T('小图已锁定'):categorySpacingMessage(info,requested,actual);
  }
  // Only replace the selected panel during a gesture. The surrounding SVG,
  // pointer handlers, other panels and property controls retain their identity.
  function previewCategorySpacing(gesture,next){
    const live=$('artboard').querySelector(`[data-panel="${gesture.id}"]`);if(!live)return;
    const nextCondition=conditionMatrixHeight(gesture.id,next,gesture.vi);
    if(Math.abs(nextCondition-(gesture.pos.conditionHeight||0))>.01){
      renderCanvas(next);const current=$('artboard').querySelector(`[data-panel="${gesture.id}"]`),actual=Number(current?.getAttribute('data-studio-group-spacing-actual')??categorySpacingFactor(next.panels[gesture.id],gesture.info)),info={...gesture.info,available:current?.getAttribute('data-studio-group-spacing-available')!=='false',reason:current?.getAttribute('data-studio-group-spacing-reason')||gesture.info.reason};gesture.lastPreview={factor:categorySpacingFactor(next.panels[gesture.id],gesture.info),actual,info};$('categorySpacingStatus').textContent=categorySpacingMessage(info,categorySpacingFactor(next.panels[gesture.id],gesture.info),actual);return;
    }
    const pos=gesture.pos,vi=gesture.vi,v=gesture.flow||panel(gesture.id).variants[vi],svg=editedSvg(gesture.id,vi,next,false,gesture.flow),fitPos={...pos,height:pos.height-(pos.statisticsBand||0)-(pos.conditionHeight||0)},fitted=!next.panels[gesture.id].locked&&fitPlot(svg,v,fitPos,gesture.margins);
    applyElementOffsets(svg,gesture.id,vi,next,fitted?1:v.viewBox[2]/v.width);
    const titleShift=(pos.statisticsFirstTop||0)-(Number(svg.getAttribute('data-stat-first-header'))||0);if(!fitted&&titleShift>0)for(const title of svg.querySelectorAll('[data-stat-facet-title]'))translateStatisticalElement(svg,title,-titleShift*v.viewBox[2]/v.width);
    namespace(svg);for(const name of ['x','y','width','data-panel','overflow']){const value=live.getAttribute(name);if(value!==null)svg.setAttribute(name,value);}
    svg.setAttribute('height',fitted?fitPos.height:Number(svg.getAttribute('viewBox').split(/\s+/)[3])*v.width/v.viewBox[2]);
    for(const key of selected)svg.querySelector(`[data-key="${key}"]`)?.classList.add('chosen');
    for(const el of svg.querySelectorAll('[id*="studio-bar-"] path,circle,ellipse,rect'))if(!el.closest('defs'))el.style.pointerEvents='all';
    addStatisticalHitAreas(svg);live.replaceWith(svg);zoomView?.refreshSelection?.();
    if(gesture.markStyle)return;
    const actual=Number(svg.getAttribute('data-studio-group-spacing-actual')??categorySpacingFactor(next.panels[gesture.id],gesture.info)),available=svg.getAttribute('data-studio-group-spacing-available')!=='false',info={...gesture.info,available,reason:svg.getAttribute('data-studio-group-spacing-reason')||gesture.info.reason};gesture.lastPreview={factor:categorySpacingFactor(next.panels[gesture.id],gesture.info),actual,info};$('categorySpacingStatus').textContent=categorySpacingMessage(info,categorySpacingFactor(next.panels[gesture.id],gesture.info),actual);
  }
  function cancelCategorySpacing(repaint=false){
    if(categorySpacingFrame)cancelAnimationFrame(categorySpacingFrame);categorySpacingFrame=0;const gesture=categorySpacingGesture;categorySpacingGesture=null;
    if(repaint&&gesture?.owner===project)renderCanvas();if(repaint)renderGroupSpacingControls();
  }
  function categorySpacingCurrent(gesture){return gesture&&gesture.owner===project&&gesture.state===state()&&gesture.id===selectedPanel&&gesture.vi===state().panels[gesture.id]?.variant&&!state().panels[gesture.id]?.locked&&!original;}
  function prepareCategorySpacing(){
    if(categorySpacingCurrent(categorySpacingGesture))return categorySpacingGesture;
    cancelCategorySpacing();const s=state(),p=s.panels[selectedPanel],info=categorySpacingInspection();if(original||p?.locked||!info.available)return null;
    const position=layout(s).positions.find(value=>value.id===selectedPanel),pos=position?.renderBox||position;if(!pos)return null;
    return categorySpacingGesture={owner:project,state:s,id:selectedPanel,vi:p.variant,pos,flow:fittedVariant(pos,s),info,margins:{left:60,right:18,top:Math.max(52,...s.order.map(id=>annotationFirstTopHeight(id,s)+44)),bottom:36}};
  }
  function queueCategorySpacing(value,source=null){
    const factor=Number(value),gesture=prepareCategorySpacing();if(!gesture)return;const [min,max]=categorySpacingLimits(gesture.info);if(!Number.isFinite(factor)||factor<min||factor>max)return;
    gesture.factor=factor;if(source!==$('categorySpacing'))$('categorySpacing').value=factor;if(source!==$('categorySpacingPercent'))$('categorySpacingPercent').value=Math.round(factor*100);
    if(categorySpacingFrame)return;categorySpacingFrame=requestAnimationFrame(()=>{categorySpacingFrame=0;if(!categorySpacingCurrent(gesture)){cancelCategorySpacing(true);return;}const next=copy(gesture.state);setCategorySpacing(next.panels[gesture.id],gesture.factor,gesture.info);previewCategorySpacing(gesture,next);});
  }
  function finishCategorySpacing(value){
    const factor=Number(value),gesture=categorySpacingGesture||prepareCategorySpacing();if(!gesture)return renderGroupSpacingControls();
    const valid=categorySpacingCurrent(gesture);cancelCategorySpacing();if(!valid){renderCanvas();renderGroupSpacingControls();return;}
    const [min,max]=categorySpacingLimits(gesture.info);if(!Number.isFinite(factor)||factor<min||factor>max){renderCanvas();renderGroupSpacingControls();say(T('组间距应为 {0}%–{1}%。',Math.round(min*100),Math.round(max*100)));return;}
    if(Math.abs(categorySpacingFactor(gesture.state.panels[gesture.id],gesture.info)-factor)<1e-8){renderCanvas();renderGroupSpacingControls();return;}
    const next=copy(gesture.state);setCategorySpacing(next.panels[gesture.id],factor,gesture.info);if(gesture.lastPreview?.factor!==factor)previewCategorySpacing(gesture,next);if(gesture.lastPreview?.info.available===false){renderCanvas();renderGroupSpacingControls();say(categorySpacingMessage(gesture.lastPreview.info,factor,1));return;}commit(next,T('已调整组间距；可撤销'));
  }
  function bindCategorySpacingControls(){
    const range=$('categorySpacing'),number=$('categorySpacingPercent');if(!range||!number)return;
    range.oninput=()=>queueCategorySpacing(range.value,range);range.onchange=()=>finishCategorySpacing(range.value);range.onpointercancel=()=>cancelCategorySpacing(true);
    number.oninput=()=>{if(number.validity.valid)queueCategorySpacing(Number(number.value)/100,number);};number.onchange=()=>finishCategorySpacing(Number(number.value)/100);
    // Tab and clicking Save must commit the preview even if the browser omits change.
    for(const input of [range,number])input.onblur=()=>{if(categorySpacingGesture)finishCategorySpacing(input===number?Number(number.value)/100:range.value);};
    for(const input of [range,number])input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelCategorySpacing(true);}else if(event.key==='Enter'){event.preventDefault();finishCategorySpacing(input===number?Number(number.value)/100:range.value);}};
    $('resetGroupSpacing').onclick=()=>{cancelCategorySpacing();if(original||state().panels[selectedPanel]?.locked)return;const info=categorySpacingInspection();if(!info.available)return;const next=copy(state());if(info.barGeometry)setCategorySpacing(next.panels[selectedPanel],1,info);else delete next.panels[selectedPanel].groupSpacing;commit(next,T('已恢复原始组间距'));};
  }
  let markGesture=null,markFrame=0;
  function markInspection(){const p=state().panels[selectedPanel];return typeof StudioMarkStyle!=='undefined'?StudioMarkStyle.inspect(baseSvg(selectedPanel,p.variant)):{points:[],errors:[]};}
  function renderMarkControls(){
    if(!$('markControls'))return;
    const p=state().panels[selectedPanel],style=p.markStyle||{},info=markInspection(),legacy=panel(selectedPanel).variants[p.variant].name==='bar_raw_points',errors=info.errors.length>0,hasCenter=info.errors.some(e=>e.segments.some(s=>s.axis==='y'&&s.center));
    $('markControls').hidden=!info.points.length&&!errors&&!legacy;$('pointControls').hidden=!info.points.length;$('errorControls').hidden=!errors&&!legacy;
    $('pointScale').value=style.pointScale??1;$('pointScaleValue').value=Math.round((style.pointScale??1)*100)+'%';
    const cap=style.capWidth??info.errors[0]?.capWidth??6,line=style.errorWidth??info.errors[0]?.lineWidth??1;$('errorCapWidth').value=cap;$('errorCapValue').value=cap;$('errorLineWidth').value=line;$('errorLineValue').value=line;
    const locked=original||p.locked||!!p.lockedElements?.[p.variant]?.length;
    $('pointScale').disabled=locked||!info.points.length;$('errorDirection').disabled=locked||(!hasCenter&&!legacy);$('errorCapWidth').disabled=locked||!errors;$('errorLineWidth').disabled=locked||!errors;
    $('resetMarkStyle').disabled=locked||(!p.markStyle&&!p.errorDirection);
    $('errorStyleHint').textContent=T(errors?'拖动即时预览；端帽长度设为 0 可隐藏端帽。':'此旧图可调整方向；更新数据后可调整端帽与线宽。');
  }
  function cancelMarkGesture(repaint=false){if(markFrame)cancelAnimationFrame(markFrame);markFrame=0;markGesture=null;if(repaint){renderCanvas();renderMarkControls();}}
  function prepareMarkGesture(){
    const s=state(),p=s.panels[selectedPanel];if(original||p.locked||p.lockedElements?.[p.variant]?.length)return null;
    if(markGesture?.owner===project&&markGesture.state===s&&markGesture.id===selectedPanel)return markGesture;
    cancelMarkGesture();const position=layout(s).positions.find(x=>x.id===selectedPanel),pos=position?.renderBox||position;if(!pos)return null;
    return markGesture={owner:project,state:s,id:selectedPanel,vi:p.variant,pos,flow:fittedVariant(pos,s),markStyle:true,info:{},margins:{left:60,right:18,top:Math.max(52,...s.order.map(id=>annotationFirstTopHeight(id,s)+44)),bottom:36}};
  }
  function bindMarkControls(){
    for(const [name,key,output] of [['pointScale','pointScale','pointScaleValue'],['errorCapWidth','capWidth','errorCapValue'],['errorLineWidth','errorWidth','errorLineValue']]){
      const input=$(name);if(!input)continue;
      input.oninput=()=>{const gesture=prepareMarkGesture();if(!gesture)return;const value=Number(input.value);$(output).value=key==='pointScale'?Math.round(value*100)+'%':value;gesture.key=key;gesture.value=value;if(key==='pointScale'&&!gesture.pointNodes){const live=$('artboard').querySelector(`[data-panel="${gesture.id}"]`);gesture.pointNodes=live&&StudioMarkStyle.inspect(live).points.flatMap(group=>[...group.querySelectorAll('use')].map(node=>({node,transform:node.getAttribute('transform')||'',x:Number(node.getAttribute('x')||0),y:Number(node.getAttribute('y')||0)})));}gesture.next=copy(gesture.state);gesture.next.panels[gesture.id].markStyle={...gesture.next.panels[gesture.id].markStyle,[key]:value};if(markFrame)return;markFrame=requestAnimationFrame(()=>{markFrame=0;if(gesture.state!==state()||gesture.id!==selectedPanel||gesture.owner!==project){cancelMarkGesture();return;}if(gesture.key==='pointScale'&&gesture.pointNodes?.length&&gesture.pointNodes.every(item=>item.node.isConnected)){const factor=gesture.value/(gesture.state.panels[gesture.id].markStyle?.pointScale??1);for(const {node,transform,x,y}of gesture.pointNodes)node.setAttribute('transform',`${transform} translate(${x} ${y}) scale(${factor}) translate(${-x} ${-y})`);zoomView?.refreshSelection?.();}else previewCategorySpacing(gesture,gesture.next);});};
      input.onchange=()=>{const gesture=markGesture;if(!gesture?.next)return;cancelMarkGesture();if(gesture.state===state()&&gesture.id===selectedPanel&&gesture.owner===project)commit(gesture.next,T('已调整样本点与误差棒；可撤销'));};
      input.onpointercancel=()=>cancelMarkGesture(true);input.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelMarkGesture(true);}};
    }
    if($('resetMarkStyle'))$('resetMarkStyle').onclick=()=>{cancelMarkGesture();const next=copy(state());delete next.panels[selectedPanel].markStyle;delete next.panels[selectedPanel].errorDirection;commit(next,T('已恢复原始点与误差棒'));};
  }
  bindMarkControls();
  function renderInspector() {
    inspectorPanel=selectedPanel;
    renderSelectionProperties();renderFacetSplitControls();
    const pan=panel(selectedPanel),vi=state().panels[selectedPanel].variant;
    const contentNote=$('importContentInfo');if(contentNote){contentNote.hidden=pan.provenance==='blank-canvas'||!!pan.table;contentNote.textContent=contentNote.hidden?'':svgContentSummary(classifySvgContent(baseSvg(selectedPanel,vi)),pan.analysis?.import);}
    $('errorDirection').value=state().panels[selectedPanel].errorDirection||'both';renderMarkControls();renderStatisticalAnnotations();renderAxisControls();renderConditionMatrix();
    $('barGeometry').hidden=pan.variants[vi].name!=='bar_raw_points';const geometry=state().panels[selectedPanel].geometry||{barWidth:1,groupGap:1};$('barWidth').value=geometry.barWidth;$('groupGap').value=geometry.groupGap;renderGroupSpacingControls();
    const scale=state().panels[selectedPanel].scales?.[vi]?.[selected[0]];if(scale){for(const [id,key]of [['scaleCalibration','calibration'],['scaleLength','length'],['scalePosition','position'],['scaleThickness','thickness'],['scaleFontSize','size'],['scaleAlpha','alpha']])$(id).value=scale[key];$('scaleBold').checked=scale.bold;$('scaleBackground').checked=scale.background;}
    renderInspectorPreviews();
    $('dataInfo').replaceChildren();
    const dataNote=document.createElement('p');dataNote.className='muted';dataNote.textContent=pan.table?T('源数据快照；在“数据表”中编辑。'):T('未嵌入原始表；下方仅显示已有配方与分析。');$('dataInfo').append(dataNote);
    if(pan.table?.rows){const wrap=document.createElement('div');wrap.className='table-scroll';const table=document.createElement('table');for(const [i,row]of pan.table.rows.slice(0,101).entries()){const tr=document.createElement('tr');for(const value of row){const td=document.createElement(i===0?'th':'td');td.textContent=String(value);tr.append(td);}table.append(tr);}wrap.append(table);$('dataInfo').append(wrap);}
    const pre=document.createElement('pre');pre.textContent=JSON.stringify({recipe:pan.recipe,analysis:pan.analysis},null,2);$('dataInfo').append(pre);
    $('qa').replaceChildren();const svg=editedSvg(selectedPanel,vi);
    const items=[T('当前小图：{0} 个文字对象，{1} 个栅格图层。',svg.querySelectorAll('text').length,svg.querySelectorAll('image').length),T('配色、字号修改后需重新核对碰撞与可读性。'),T('数据修订与图形样式保留独立版本。')];
    if(!svg.querySelector('text'))items.push(T('本图没有可编辑文字，路径化或栅格文字不能直接改字体。'));
    for(const text of items){const li=document.createElement('li');li.textContent=text;$('qa').append(li);}
  }
  // Reuse the current SVG on zoom; do not regenerate panels or reset selection.
  let zoomView=null,zoomFrame=0,queuedZoom=null,fitZoomFrame=0;
  function previewFitZoom(width,height){
    const viewport=$('viewport'),css=getComputedStyle(viewport);
    const x=(parseFloat(css.paddingLeft)||0)+(parseFloat(css.paddingRight)||0);
    const y=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0);
    return clampPreviewZoom(Math.min(1,Math.max(1,viewport.clientWidth-x)/width,Math.max(1,viewport.clientHeight-y)/height));
  }
  function syncZoomControl(zoom,fit=false){
    const control=$('zoom'),percent=Math.round(zoom*1000)/10;
    let custom=control.querySelector('[data-custom-zoom]');
    if(fit){control.value='fit';if(custom)custom.hidden=true;}
    else{
      const preset=[...control.options].find(o=>o.value!=='fit'&&!o.hasAttribute('data-custom-zoom')&&Math.abs(+o.value-zoom)<1e-7);
      if(preset){control.value=preset.value;if(custom)custom.hidden=true;}
      else{if(!custom){custom=document.createElement('option');custom.dataset.customZoom='true';control.append(custom);}custom.value=String(zoom);custom.textContent=percent+'%';custom.hidden=false;control.value=custom.value;}
    }
    control.title=T('预览缩放 {0}%；Alt + 滚轮缩放',percent);
  }
  function cancelQueuedZoom({preserveControl=false}={}){
    if(zoomFrame)cancelAnimationFrame(zoomFrame);zoomFrame=0;
    const pending=queuedZoom;queuedZoom=null;
    if(pending&&!preserveControl&&zoomView)syncZoomControl(zoomView.zoom,zoomView.fit);
  }
  function applyPreviewZoom(zoom,point,fit=false){
    const viewport=$('viewport'),view=zoomView;if(!view?.svg.isConnected)return;
    const before=view.svg.getBoundingClientRect();
    const next=fit?previewFitZoom(view.width,view.height):clampPreviewZoom(zoom);
    view.svg.style.width=view.width*next+'px';view.svg.style.height=view.height*next+'px';view.zoom=next;view.fit=fit;
    if(fit){viewport.scrollLeft=0;viewport.scrollTop=0;}
    else{
      const rect=viewport.getBoundingClientRect();point||={x:rect.left+viewport.clientLeft+viewport.clientWidth/2,y:rect.top+viewport.clientTop+viewport.clientHeight/2};
      const scroll=zoomAnchorScroll({before,after:view.svg.getBoundingClientRect(),point,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop,scrollWidth:viewport.scrollWidth,scrollHeight:viewport.scrollHeight,viewportWidth:viewport.clientWidth,viewportHeight:viewport.clientHeight});
      viewport.scrollLeft=scroll.left;viewport.scrollTop=scroll.top;
    }
    view.refreshSelection?.();
    syncZoomControl(next,fit);
  }
  function schedulePreviewFit(){
    if(fitZoomFrame||!zoomView?.fit||queuedZoom)return;
    fitZoomFrame=requestAnimationFrame(()=>{
      fitZoomFrame=0;
      const view=zoomView,viewport=$('viewport');
      // A manual zoom may have arrived since this layout notification.
      if(!view?.fit||queuedZoom||!view.svg.isConnected)return;
      const css=getComputedStyle(viewport),x=(parseFloat(css.paddingLeft)||0)+(parseFloat(css.paddingRight)||0),y=(parseFloat(css.paddingTop)||0)+(parseFloat(css.paddingBottom)||0);
      if(viewport.clientWidth<=x||viewport.clientHeight<=y)return;
      // Read final layout and size the existing SVG absolutely, never by its
      // previous displayed size. Equal results do not feed resize loops.
      if(Math.abs(previewFitZoom(view.width,view.height)-view.zoom)>1e-7)applyPreviewZoom(null,null,true);
    });
  }
  function observePreviewFit(){
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedulePreviewFit):null;
    observer?.observe($('viewport'));
    // Mobile controls and their CSS are installed after the first render.
    schedulePreviewFit();
    return observer;
  }
  $('viewport').addEventListener('wheel',event=>{
    if(!event.altKey&&!event.ctrlKey)return;
    event.preventDefault();
    if(event.buttons||!zoomView?.svg.isConnected)return;
    queuedZoom={zoom:wheelPreviewZoom(queuedZoom?.zoom??zoomView.zoom,event.deltaY,event.deltaMode,$('viewport').clientHeight),point:{x:event.clientX,y:event.clientY}};
    if(!zoomFrame)zoomFrame=requestAnimationFrame(()=>{zoomFrame=0;const pending=queuedZoom;queuedZoom=null;if(pending)applyPreviewZoom(pending.zoom,pending.point);});
  },{passive:false});
  function syncCanvasModes(){
    for(const id of ['layoutMode','arrangePanels']){const control=$(id);if(!control)continue;control.textContent=T(layoutMode?'完成排列':'排列小图');control.setAttribute('aria-pressed',String(layoutMode));control.title=T('排列模式：拖动整张小图至目标格；完成后返回元素编辑');}
    $('boxSelect').setAttribute('aria-pressed',String(boxSelect));
    $('viewport').classList.toggle('is-marquee-selecting',boxSelect);
  }
  function renderCanvas(previewState=state()) {
    if(nudgeGesture)finishNudge(false,false);
    cancelPanelGesture?.();cancelSelectionGesture?.();cancelObjectGesture?.();cancelPanelGesture=null;cancelSelectionGesture=null;cancelObjectGesture=null;syncCanvasModes();
    if(!previewState?.order)previewState=state();
    cancelQueuedZoom({preserveControl:true});
    clearTimeout(reflowTimer);
    if(previewState===state()&&localEngine&&engineConnection==='connected'){const owner=project,snapshot=state();if(layout(snapshot).positions.some(pos=>{const spec=reflowSpec(pos,snapshot);return spec&&!fittedVariant(pos,snapshot);}))reflowTimer=setTimeout(async()=>{try{say(T('正在校准绘图区…'));await ensureReflows(snapshot);if(project===owner&&state()===snapshot){renderCanvas();persist();say(T('绘图区已对齐'));}}catch(error){say(T('绘图区重排未完成：')+error.message);}},120);}
    const svg=composite(original,false,previewState),l=layout(previewState);$('artboard').replaceChildren(svg);
    if(!original)addStatisticalHitAreas(svg);
    for(const el of svg.querySelectorAll('[id*="studio-bar-"] path,circle,ellipse,rect'))if(!el.closest('defs')&&!el.closest('[data-editor-guides]'))el.style.pointerEvents='all';
    const output=exportGeometry(l.width,l.height,previewState.exportSettings),widthPx=output.widthPt*96/72,heightPx=output.heightPt*96/72,fit=$('zoom').value==='fit',zoom=fit?previewFitZoom(widthPx,heightPx):clampPreviewZoom(+$('zoom').value);
    svg.style.width=widthPx*zoom+'px';svg.style.height=heightPx*zoom+'px';
    zoomView={svg,width:widthPx,height:heightPx,zoom,fit};syncZoomControl(zoom,fit);
    $('dimensions').textContent=T('{0} 行 × {1} 列 · {2} × {3} mm',gridFor(previewState).rows,previewState.columns,output.widthMm.toFixed(1),output.heightMm.toFixed(1));
    $('exportWidth').value=output.widthMm.toFixed(2);$('exportHeight').value=output.heightMm.toFixed(2);$('exportDpi').value=String(output.dpi);$('exportPixels').textContent=T('{0} × {1} px · {2} dpi · 锁定纵横比',output.widthPx,output.heightPx,output.dpi);
    const textSizes=[...svg.querySelectorAll('text')].map(el=>{const id=el.closest('[data-panel]')?.getAttribute('data-panel'),v=id?panel(id).variants[previewState.panels[id].variant]:null;return parseFloat(el.style.fontSize||el.getAttribute('font-size'))*output.scale*(v?v.width/v.viewBox[2]:1);}).filter(Number.isFinite);$('exportFontNote').textContent=textSizes.length?T('缩放后最小文字约 {0} pt；请按期刊要求核对。',Math.min(...textSizes).toFixed(1)):'';
    const destination=e=>{const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*l.width,y=(e.clientY-r.top)/r.height*l.height;return l.cells.find(c=>x>=c.x&&x<=c.x+c.width&&y>=c.y&&y<=c.y+c.height);};
    svg.oncontextmenu=e=>{const cell=destination(e);if(!cell)return;e.preventDefault();const labelTarget=e.target.closest('[data-panel-label]'),id=labelTarget?.dataset.panelLabel||at(cell),el=canvasObjectTarget(e.target),annotation=e.target.closest('[data-annotation]');selectedAnnotations=annotation?[annotation.dataset.annotation]:[];selectedPanelLabel=labelTarget?id:null;
      if(id&&!annotation){const same=id===selectedPanel;selectedPanel=id;if(!panelSelection.includes(id))panelSelection=[id];
        if(el&&isVisibleObject(el)&&!layoutMode){const key=el.getAttribute('data-key');if(!same||!selected.includes(key))selected=state().panels[id].elementGroups?.[state().panels[id].variant]?.find(g=>g.includes(key))||[key];$('scope').value='element';}
        else{selected=[];$('scope').value='panel';}render();}
      openInsertMenu(cell,e.clientX,e.clientY,true,!!id,id);
    };
    const at=cell=>cell&&state().order.find(id=>{const p=gridFor(state()).places[id];return cell.row>=p.row&&cell.row<p.row+p.rs&&cell.col>=p.col&&cell.col<p.col+p.cs;});
    let hoverSlot=null;
    const hoverGuide=e=>{const cell=destination(e),key=cell?(at(cell)||`empty-${cell.row}-${cell.col}`):null;if(key===hoverSlot)return;svg.querySelector('.slot-guide.is-hovered')?.classList.remove('is-hovered');svg.querySelector('.panel-move-handle.is-hovered')?.classList.remove('is-hovered');hoverSlot=key;if(key){svg.querySelector(`[data-guide-slot="${key}"]`)?.classList.add('is-hovered');svg.querySelector(`[data-panel-move="${key}"]`)?.classList.add('is-hovered');}};
    svg.addEventListener('pointermove',hoverGuide,{passive:true});
    svg.addEventListener('pointerleave',()=>{svg.querySelector('.slot-guide.is-hovered')?.classList.remove('is-hovered');svg.querySelector('.panel-move-handle.is-hovered')?.classList.remove('is-hovered');hoverSlot=null;});
    const drop=e=>{if(!dragging)return false;const cell=destination(e),id=dragging;dragging=null;if(!cell)return false;const from=gridFor(state()).places[id];if(cell.row>=from.row&&cell.row<from.row+from.rs&&cell.col>=from.col&&cell.col<from.col+from.cs)return false;
      try{const next=moveWithSizes(state(),id,cell.row,cell.col);validateState(next,project);selectedPanel=id;selected=[];elementSelections=[];selectedPanelLabel=null;panelSelection=[id];$('scope').value='panel';return commit(next,T('已移动 / 交换小图'));}catch(error){say(T(error.message));return false;}};
    let labelDrag=null,overlayDrag=null,elementDrag=null,guideDrag=null,marquee=null,suppressClick=false;
    const canvasPoint=e=>{const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
    const selectionLayer=document.createElementNS(NS,'g');selectionLayer.dataset.editorSelection='true';selectionLayer.style.pointerEvents='none';svg.append(selectionLayer);
    const viewport=$('viewport');viewport.querySelector('[data-workspace-selection]')?.remove();const workspaceLayer=document.createElementNS(NS,'svg');workspaceLayer.dataset.workspaceSelection='true';workspaceLayer.setAttribute('class','workspace-selection-layer');workspaceLayer.setAttribute('aria-hidden','true');workspaceLayer.style.display='none';viewport.append(workspaceLayer);
    const screenRect=el=>{const b=el.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom};};
    const alignmentLayer=document.createElementNS(NS,'g');alignmentLayer.dataset.editorAlignment='true';alignmentLayer.setAttribute('aria-hidden','true');svg.append(alignmentLayer);
    const snapLayer=document.createElementNS(NS,'g');snapLayer.dataset.editorSnap='true';snapLayer.style.pointerEvents='none';snapLayer.setAttribute('aria-hidden','true');svg.append(snapLayer);
    const drawAlignmentGuides=(snapshot=state())=>{alignmentLayer.replaceChildren();for(const guide of snapshot.alignmentGuides||[]){if(guide.position>(guide.axis==='x'?l.width:l.height))continue;const group=document.createElementNS(NS,'g');group.dataset.alignmentGuide=guide.id;group.setAttribute('class','alignment-guide'+(guide.id===selectedAlignmentGuide?' is-selected':''));for(const hit of [true,false]){const line=document.createElementNS(NS,'line'),attrs=guide.axis==='x'?{x1:guide.position,x2:guide.position,y1:0,y2:l.height}:{x1:0,x2:l.width,y1:guide.position,y2:guide.position};for(const [key,value]of Object.entries(attrs))line.setAttribute(key,value);line.setAttribute('class',hit?'alignment-guide-hit':'alignment-guide-line');line.setAttribute('vector-effect','non-scaling-stroke');group.append(line);}alignmentLayer.append(group);}};
    drawAlignmentGuides(previewState);renderAlignmentGuideControls();
    const objectScreenBox=node=>screenRect(node.dataset?.annotation?(node.firstElementChild||node):node);
    const alignmentContext=nodes=>{const r=svg.getBoundingClientRect(),sx=l.width/r.width,sy=l.height/r.height,box=node=>{const b=objectScreenBox(node);return {left:(b.left-r.left)*sx,right:(b.right-r.left)*sx,top:(b.top-r.top)*sy,bottom:(b.bottom-r.top)*sy};},boxes=nodes.map(box),bounds=boxes.length?{left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))}:null,targets=(state().alignmentGuides||[]).map(guide=>({axis:guide.axis,position:guide.position,manual:true,id:guide.id}));
      const add=b=>{for(const position of [b.left,(b.left+b.right)/2,b.right])targets.push({axis:'x',position});for(const position of [b.top,(b.top+b.bottom)/2,b.bottom])targets.push({axis:'y',position});};add({left:0,top:0,right:l.width,bottom:l.height});for(const pos of l.positions)add({left:pos.x,top:pos.y,right:pos.x+pos.width,bottom:pos.y+pos.height});
      for(const node of svg.querySelectorAll('text[data-key],path[data-key],rect[data-key],line[data-key],image[data-key],[data-annotation],[data-panel-label]')){if(nodes.some(moving=>moving===node||moving.contains?.(node)||node.contains?.(moving))||node.closest('defs')||node.closest('[data-editor-alignment]')||!isVisibleObject(node)&&!node.dataset.annotation&&!node.dataset.panelLabel)continue;const b=box(node);if(!Object.values(b).every(Number.isFinite)||b.right-b.left<.1&&b.bottom-b.top<.1)continue;add(b);}return {bounds,targets};};
    const paintSnapGuides=guides=>{snapLayer.replaceChildren();for(const guide of guides){const line=document.createElementNS(NS,'line'),attrs=guide.axis==='x'?{x1:guide.position,x2:guide.position,y1:0,y2:l.height}:{x1:0,x2:l.width,y1:guide.position,y2:guide.position};for(const [key,value]of Object.entries(attrs))line.setAttribute(key,value);line.setAttribute('class','object-alignment-snap');line.setAttribute('vector-effect','non-scaling-stroke');snapLayer.append(line);}};
    const snappedDelta=(context,origin,e)=>{const r=svg.getBoundingClientRect(),dx=(e.clientX-origin.x)/r.width*l.width,dy=(e.clientY-origin.y)/r.height*l.height,result=alignmentSnap(context?.bounds,context?.targets||[],dx,dy,6*l.width/r.width,e.altKey);paintSnapGuides(result.guides);return result;};
    const selectedDragItems=()=>selectionGroups().flatMap(group=>{const p=state().panels[group.id];if(p.locked)return [];return group.keys.filter(key=>!p.lockedElements?.[group.vi]?.includes(key)).map(key=>({id:group.id,vi:group.vi,el:svg.querySelector(`[data-panel="${group.id}"] [data-key="${key}"]`)})).filter(item=>item.el&&item.el.localName!=='tspan');}).map(item=>({...item,key:item.el.dataset.key,transform:item.el.getAttribute('transform'),screen:item.el.parentElement.getScreenCTM()}));
    const moveNativeItems=(drag,delta)=>{const r=svg.getBoundingClientRect(),screenDelta={x:delta.dx/l.width*r.width,y:delta.dy/l.height*r.height};for(const item of drag.nodes||[]){const old=editsFor(item.id,item.vi)[item.key]||{};setEdit(drag.next,item.id,item.vi,item.key,'offset-x',String(+(old['offset-x']||0)+delta.dx));setEdit(drag.next,item.id,item.vi,item.key,'offset-y',String(+(old['offset-y']||0)+delta.dy));if(!item.screen)continue;const sm=item.screen,inv=new DOMMatrix([sm.a,sm.b,sm.c,sm.d,sm.e,sm.f]).inverse(),a=inv.transformPoint({x:0,y:0}),b=inv.transformPoint(screenDelta);item.el.setAttribute('transform',`translate(${b.x-a.x} ${b.y-a.y}) `+(item.transform||''));}};
    const moveOverlayItems=(drag,delta)=>{const space=overlayEditingSpace(l);for(const id of drag.overlayIds||[]){const old=state().overlays.find(a=>a.id===id),a=drag.next.overlays.find(a=>a.id===id);if(!old||old.locked)continue;a.x=old.x+delta.dx/space.width;a.y=old.y+delta.dy/space.height;svg.querySelector(`[data-annotation="${id}"]`)?.replaceWith(overlayNode(a,l));}};
    const boundedObjectDelta=(drag,delta)=>{const overlays=(drag.overlayIds||[]).map(id=>state().overlays.find(a=>a.id===id)).filter(Boolean);if(!overlays.length)return delta;const space=overlayEditingSpace(l),bounded={...delta,dx:Math.max(-Math.min(...overlays.map(a=>a.x))*space.width,Math.min(Math.min(...overlays.map(a=>1-a.x-a.w))*space.width,delta.dx)),dy:Math.max(-Math.min(...overlays.map(a=>a.y))*space.height,Math.min(Math.min(...overlays.map(a=>1-a.y-a.h))*space.height,delta.dy))};if(bounded.dx!==delta.dx||bounded.dy!==delta.dy)paintSnapGuides((delta.guides||[]).filter(guide=>guide.axis==='x'?bounded.dx===delta.dx:bounded.dy===delta.dy));return bounded;};
    const drawSelection=(nodes,candidate=false)=>{
      selectionLayer.replaceChildren();const r=svg.getBoundingClientRect(),sx=l.width/r.width,sy=l.height/r.height;
      for(const node of nodes){const b=node.box||screenRect(node.el||node),rect=document.createElementNS(NS,'rect');for(const [k,v]of Object.entries({x:(b.left-r.left-2)*sx,y:(b.top-r.top-2)*sy,width:Math.max(4,b.right-b.left+4)*sx,height:Math.max(4,b.bottom-b.top+4)*sy,rx:2*sx}))rect.setAttribute(k,v);rect.setAttribute('class','selection-outline'+(candidate?' is-candidate':''));selectionLayer.append(rect);}
    };
    const selectedNodes=()=>[...selectionGroups().flatMap(g=>g.keys.map(k=>svg.querySelector(`[data-panel="${g.id}"] [data-key="${k}"]`)).filter(Boolean)),...(selectedPanelLabel?[svg.querySelector(`[data-panel-label="${selectedPanelLabel}"]`)].filter(Boolean):[]),...selectedAnnotations.map(id=>svg.querySelector(`[data-annotation="${id}"]`)).filter(Boolean)];
    drawSelection(selectedNodes());
    zoomView.refreshSelection=()=>drawSelection(selectedNodes());
    zoomView.nudgeCanvas={geometry:l,isPreview:previewState!==state(),isGestureActive:()=>!!(elementDrag||overlayDrag||labelDrag||guideDrag||marquee||resizeDrag||panelDrag),capture(items){
      const native=items.filter(item=>item.kind==='element').map(item=>({...item,transform:item.el.getAttribute('transform'),screen:item.el.parentElement.getScreenCTM()}));
      const context=alignmentContext(items.filter(item=>item.el).map(item=>item.el));
      const draw=(snapshot,delta)=>{
        const r=svg.getBoundingClientRect(),screenDelta={x:delta.dx/l.width*r.width,y:delta.dy/l.height*r.height};
        for(const item of native){if(!delta.dx&&!delta.dy){if(item.transform===null)item.el.removeAttribute('transform');else item.el.setAttribute('transform',item.transform);continue;}const sm=item.el.parentElement?.getScreenCTM();if(!sm)continue;const inv=new DOMMatrix([sm.a,sm.b,sm.c,sm.d,sm.e,sm.f]).inverse(),a=inv.transformPoint({x:0,y:0}),b=inv.transformPoint(screenDelta);item.el.setAttribute('transform',`translate(${b.x-a.x} ${b.y-a.y}) `+(item.transform||''));}
        for(const item of items){
          if(item.kind==='overlay'){const a=snapshot.overlays?.find(a=>a.id===item.id);if(a)svg.querySelector(`[data-annotation="${item.id}"]`)?.replaceWith(overlayNode(a,l));}
          else if(item.kind==='label'){const label=snapshot.panels[item.id]?.label,cell=l.positions.find(p=>p.id===item.id),pos=cell?.renderBox||cell;if(label&&pos){item.el.setAttribute('x',pos.x+pos.width*label.x/100);item.el.setAttribute('y',pos.y+pos.height*label.y/100);}}
        }
        if(items.some(item=>item.kind==='guide'))drawAlignmentGuides(snapshot);
        // Visual alignment hints only: an exact fine adjustment is never snapped.
        paintSnapGuides(alignmentSnap(context.bounds,context.targets,delta.dx,delta.dy,.35*l.width/r.width).guides);drawSelection(selectedNodes());
      };
      return {draw,clear:()=>paintSnapGuides([])};
    }};
    svg.classList.toggle('is-marquee-selecting',boxSelect);svg.classList.toggle('is-arranging-panels',layoutMode);
    const selectable=el=>{
      if(!isVisibleObject(el)||el.localName==='tspan'||el.closest('[id$="studio-plot-frame"]'))return false;
      const id=el.closest('[data-panel]')?.dataset.panel,p=state().panels[id];if(!p||p.locked||p.lockedElements?.[p.variant]?.includes(el.dataset.key))return false;
      const css=getComputedStyle(el);return css.display!=='none'&&css.visibility!=='hidden'&&+css.opacity!==0&&(el.localName==='image'||css.fill!=='none'||css.stroke!=='none');
    };
    const marqueeResult=(m,e)=>{
      const rect={left:Math.min(e.clientX,m.screen.x),right:Math.max(e.clientX,m.screen.x),top:Math.min(e.clientY,m.screen.y),bottom:Math.max(e.clientY,m.screen.y)},hits=[];
      for(const entry of m.panels){if(rect.right<entry.box.left||rect.left>entry.box.right||rect.bottom<entry.box.top||rect.top>entry.box.bottom)continue;
        if(!entry.objects)entry.objects=[...entry.el.querySelectorAll('[data-key]')].filter(selectable).map(el=>({el,id:entry.el.dataset.panel,key:el.dataset.key,box:screenRect(el),text:el.localName==='text'}));
        hits.push(...entry.objects.filter(item=>marqueeHit(rect,item.box,item.text)));
      }
      const annotations=m.annotations.filter(item=>marqueeHit(rect,item.box));return {rect,hits,annotations};
    };
    let selectionFrame=0;
    const paintMarquee=()=>{selectionFrame=0;if(!marquee?.moved)return;const result=marqueeResult(marquee,marquee.last);marquee.result=result;drawSelection([...result.hits,...result.annotations],true);
      const vr=viewport.getBoundingClientRect(),left=vr.left+viewport.clientLeft,top=vr.top+viewport.clientTop,w=viewport.clientWidth,h=viewport.clientHeight;
      workspaceLayer.style.display='block';workspaceLayer.style.left=viewport.scrollLeft+'px';workspaceLayer.style.top=viewport.scrollTop+'px';workspaceLayer.style.width=w+'px';workspaceLayer.style.height=h+'px';workspaceLayer.setAttribute('viewBox',`0 0 ${w} ${h}`);workspaceLayer.replaceChildren();
      const x=Math.max(0,Math.min(w,result.rect.left-left)),y=Math.max(0,Math.min(h,result.rect.top-top)),right=Math.max(x,Math.min(w,result.rect.right-left)),bottom=Math.max(y,Math.min(h,result.rect.bottom-top)),box=document.createElementNS(NS,'rect');box.setAttribute('class','selection-marquee');box.dataset.marquee='true';for(const [k,v]of Object.entries({x,y,width:right-x,height:bottom-y}))box.setAttribute(k,v);workspaceLayer.append(box);
      const label=document.createElementNS(NS,'text');label.setAttribute('class','selection-count');label.setAttribute('x',Math.max(4,Math.min(w-110,right+8)));label.setAttribute('y',Math.max(15,y-7));label.setAttribute('font-size',12);label.textContent=T('已选 {0} 个元素',result.hits.length+result.annotations.length);workspaceLayer.append(label);
    };
    const finishSelectionUI=()=>{refreshOverlaySelection(svg,l);const nodes=selectedNodes();svg.querySelectorAll('.chosen').forEach(el=>el.classList.remove('chosen'));nodes.forEach(el=>el.classList.add('chosen'));drawSelection(nodes);if(inspectorPanel!==selectedPanel){renderDataEditor();renderMethods();renderInspector();renderLabelControls();}else renderSelectionProperties();if(selectedAnnotations.length)renderOverlayProperties();showPane(activePane,false);document.querySelectorAll('#panels .panel-button').forEach((button,i)=>button.classList.toggle('active',panelSelection.includes(visualPanelOrder(state())[i])));};
    const clearCanvasSelection=()=>{
      selectedAlignmentGuide=null;drawAlignmentGuides();renderAlignmentGuideControls();selected=[];elementSelections=[];selectionAnchor=null;selectedAnnotations=[];selectedPanelLabel=null;panelSelection=[];selectionAfterMarquee=false;$('scope').value='panel';
      svg.querySelectorAll('.chosen').forEach(el=>el.classList.remove('chosen'));drawSelection([]);workspaceLayer.replaceChildren();workspaceLayer.style.display='none';
      refreshOverlaySelection(svg,l);
      renderSelectionProperties();renderOverlayProperties();document.querySelectorAll('#panels .panel-button').forEach(el=>el.classList.remove('active'));say(T('选择一个元素'));
    };
    const beginMarquee=(e,capture=svg)=>{
      marquee={target:e.target,capture,pointerId:e.pointerId,point:canvasPoint(e),screen:{x:e.clientX,y:e.clientY},append:e.shiftKey,clearOnTap:selectionAfterMarquee&&!e.shiftKey,moved:false,canSelect:!layoutMode&&!original,panels:[...svg.querySelectorAll('[data-panel]')].map(el=>({el,box:screenRect(el)})),annotations:[...svg.querySelectorAll('[data-annotation]')].filter(el=>!state().overlays.find(a=>a.id===el.dataset.annotation)?.locked).map(el=>({el,box:screenRect(el)}))};
      if(marquee.canSelect){svg.classList.add('is-marquee-selecting');viewport.classList.add('is-marquee-selecting');}capture.setPointerCapture(e.pointerId);
    };
    const stopMarqueeFeedback=()=>{workspaceLayer.replaceChildren();workspaceLayer.style.display='none';viewport.classList.toggle('is-marquee-selecting',boxSelect);svg.classList.toggle('is-marquee-selecting',boxSelect);};
    cancelSelectionGesture=()=>{if(!marquee)return false;const capture=marquee.capture,pointerId=marquee.pointerId;marquee=null;cancelAnimationFrame(selectionFrame);selectionFrame=0;stopMarqueeFeedback();drawSelection(selectedNodes());if(capture?.hasPointerCapture?.(pointerId))capture.releasePointerCapture(pointerId);return true;};
    let resizeDrag=null,panelDrag=null,ghost=null,pending=null,previewCell=null;
    const clearGhost=()=>{ghost?.remove();ghost=null;pending=null;previewCell=null;svg.classList.remove('is-drop-invalid');};
    const previewLayoutDrop=e=>{
      const cell=destination(e);if(!cell){clearGhost();return;}
      const key=[resizeDrag?.id||dragging,resizeDrag?.edge||'move',cell.row,cell.col].join(':');if(key===previewCell)return;clearGhost();previewCell=key;let valid=true;
      try{if(resizeDrag){const {id,edge,place:p}=resizeDrag;const rs=edge==='right'?p.rs:Math.max(1,cell.row-p.row+1),cs=edge==='bottom'?p.cs:Math.max(1,cell.col-p.col+1);pending=rs===p.rs&&cs===p.cs?copy(state()):matchSizes(resizePanel(state(),id,rs,cs),[id]);}else pending=moveWithSizes(state(),dragging,cell.row,cell.col);validateState(pending,project);}catch{valid=false;pending=null;}
      const id=resizeDrag?.id||dragging,p=pending?gridFor(pending).places[id]:{row:cell.row,col:cell.col,rs:1,cs:1};const covered=l.cells.filter(c=>c.row>=p.row&&c.row<p.row+p.rs&&c.col>=p.col&&c.col<p.col+p.cs);if(!covered.length)return;
      const x=Math.min(...covered.map(c=>c.x)),y=Math.min(...covered.map(c=>c.y)),right=Math.max(...covered.map(c=>c.x+c.width)),bottom=Math.max(...covered.map(c=>c.y+c.height)),color=valid?'#526e9e':'#a64f58';
      ghost=document.createElementNS(NS,'g');ghost.dataset.panelDropPreview=valid?'valid':'invalid';ghost.style.pointerEvents='none';svg.classList.toggle('is-drop-invalid',!valid);
      const rect=document.createElementNS(NS,'rect');for(const [name,value]of Object.entries({x,y,width:right-x,height:bottom-y,fill:color,'fill-opacity':.09,stroke:color,'stroke-width':1.5,'vector-effect':'non-scaling-stroke'}))rect.setAttribute(name,value);ghost.append(rect);
      const label=document.createElementNS(NS,'text'),px=l.width/svg.getBoundingClientRect().width;for(const [name,value]of Object.entries({x:x+8*px,y:y+18*px,fill:color,'font-family':'Arial, sans-serif','font-size':12*px,'font-weight':'600','paint-order':'stroke',stroke:'white','stroke-width':3*px,'stroke-linejoin':'round'}))label.setAttribute(name,value);
      label.textContent=!valid?T('无法放置'):resizeDrag?T('调整跨格'):at(cell)&&at(cell)!==id?T('交换位置'):T('移动至此');ghost.append(label);svg.append(ghost);
    };
    svg.onpointerdown=e=>{cancelQueuedZoom();if(e.button!==0||original)return;e.preventDefault();window.getSelection()?.removeAllRanges();const guideTarget=e.target.closest('[data-alignment-guide]');if(guideTarget){selectedAlignmentGuide=guideTarget.dataset.alignmentGuide;selected=[];elementSelections=[];selectedAnnotations=[];selectedPanelLabel=null;const guide=state().alignmentGuides.find(item=>item.id===selectedAlignmentGuide);guideDrag={id:guide.id,axis:guide.axis,position:guide.position,screen:{x:e.clientX,y:e.clientY},moved:false,next:copy(state())};drawAlignmentGuides();renderAlignmentGuideControls();drawSelection([]);svg.setPointerCapture(e.pointerId);return;}selectedAlignmentGuide=null;drawAlignmentGuides();renderAlignmentGuideControls();const moveHandle=e.target.closest('[data-panel-move]'),mark=e.target.closest('[data-annotation]');if(mark&&!layoutMode&&!boxSelect&&(!e.shiftKey||e.target.closest('[data-overlay-resize]'))){const id=mark.dataset.annotation;if(!selectedAnnotations.includes(id)){selectedAnnotations=[id];selected=[];elementSelections=[];selectedPanelLabel=null;}activePane='annotation';renderOverlayProperties();document.querySelectorAll('[data-pane]').forEach(el=>el.hidden=el.getAttribute('data-pane')!=='annotation'&&!['statisticalAnnotations','conditionMatrixControls'].includes(el.id));(e.target.closest('text')||svg).setPointerCapture(e.pointerId);const a=state().overlays.find(a=>a.id===id);if(!a.locked){overlayDrag={screen:{x:e.clientX,y:e.clientY},moved:false,clearOnTap:selectionAfterMarquee&&!e.shiftKey,point:canvasPoint(e),resize:!!e.target.closest('[data-overlay-resize]'),endpoint:+(e.target.closest('[data-overlay-resize]')?.dataset.overlayEndpoint||0),id,next:copy(state())};if(!overlayDrag.resize){overlayDrag.nodes=selectedDragItems();overlayDrag.overlayIds=selectedAnnotations.filter(id=>!state().overlays.find(a=>a.id===id)?.locked);overlayDrag.alignment=alignmentContext([...overlayDrag.nodes.map(item=>item.el),...overlayDrag.overlayIds.map(id=>svg.querySelector(`[data-annotation="${id}"]`)).filter(Boolean)]);svg.classList.add('is-dragging-object');}}return;}const target=e.target.closest('[data-panel-label]');if(target&&!layoutMode&&!boxSelect&&!e.shiftKey){const id=target.getAttribute('data-panel-label');if(state().panels[id].locked)return say(T('小图已锁定'));selectedPanel=id;selected=[];elementSelections=[];selectionAnchor=null;selectedAnnotations=[];panelSelection=[id];selectedPanelLabel=id;labelDrag={id,point:{x:e.clientX,y:e.clientY},start:{...state().panels[id].label},alignment:alignmentContext([target]),moved:false,clearOnTap:selectionAfterMarquee&&!e.shiftKey};svg.classList.add('is-dragging-object');target.setPointerCapture(e.pointerId);return;}if(!layoutMode&&!moveHandle){const el=canvasObjectTarget(e.target),pan=e.target.closest('[data-panel]');let newSelection=false;if(!boxSelect&&!e.shiftKey&&!selectionAfterMarquee&&el&&isVisibleObject(el)&&el.localName!=='tspan'&&pan&&!state().panels[pan.dataset.panel].locked&&!state().panels[pan.dataset.panel].lockedElements?.[state().panels[pan.dataset.panel].variant]?.includes(el.dataset.key)&&!selectionGroups().some(group=>group.id===pan.dataset.panel&&group.keys.includes(el.dataset.key))){setElementSelection([{id:pan.dataset.panel,vi:state().panels[pan.dataset.panel].variant,keys:state().panels[pan.dataset.panel].elementGroups?.[state().panels[pan.dataset.panel].variant]?.find(group=>group.includes(el.dataset.key))||[el.dataset.key]}]);selectedAnnotations=[];selectedPanelLabel=null;activePane='detail';$('scope').value='element';newSelection=true;finishSelectionUI();}if(!boxSelect&&!e.shiftKey&&el&&pan&&selectionGroups().some(group=>group.id===pan.dataset.panel&&group.keys.includes(el.dataset.key))){
        const p=state().panels[pan.dataset.panel];if(p.locked)return say(T('小图已锁定'));const nodes=selectedDragItems();if(!nodes.length)return say(T('元素已锁定'));const overlayIds=selectedAnnotations.filter(id=>!state().overlays.find(a=>a.id===id)?.locked);
        elementDrag={moved:false,newSelection,point:canvasPoint(e),id:selectedPanel,vi:p.variant,keys:nodes.map(item=>item.key),next:copy(state()),nodes,overlayIds,screen:{x:e.clientX,y:e.clientY},alignment:alignmentContext([...nodes.map(item=>item.el),...overlayIds.map(id=>svg.querySelector(`[data-annotation="${id}"]`)).filter(Boolean)])};svg.classList.add('is-dragging-object');(e.target.closest('text')||svg).setPointerCapture(e.pointerId);e.preventDefault();return;
      }beginMarquee(e,e.target.closest('text')||svg);return;}e.preventDefault();const handle=e.target.closest('[data-resize]');const id=moveHandle?.dataset.panelMove||handle?.getAttribute('data-resize-panel')||at(destination(e));if(id&&state().panels[id].locked){say(T('小图已锁定'));return;}if(id&&e.shiftKey){panelSelection=panelSelection.includes(id)?panelSelection.filter(x=>x!==id):[...panelSelection,id];selectedPanel=id;render();return;}if(id){selectedPanel=id;selected=[];elementSelections=[];selectedAnnotations=[];selectedPanelLabel=null;panelSelection=[id];$('scope').value='panel';svg.setPointerCapture(e.pointerId);if(handle){resizeDrag={id,edge:handle.getAttribute('data-resize'),place:copy(gridFor(state()).places[id])};}else{dragging=id;panelDrag={x:e.clientX,y:e.clientY,moved:false};}}};
    svg.onpointermove=e=>{if((panelDrag||resizeDrag||elementDrag||overlayDrag||labelDrag||guideDrag)&&e.buttons===0){svg.onpointercancel();return;}if(guideDrag){guideDrag.moved ||= Math.hypot(e.clientX-guideDrag.screen.x,e.clientY-guideDrag.screen.y)>3;if(!guideDrag.moved)return;const r=svg.getBoundingClientRect(),delta=guideDrag.axis==='x'?(e.clientX-guideDrag.screen.x)/r.width*l.width:(e.clientY-guideDrag.screen.y)/r.height*l.height,guide=guideDrag.next.alignmentGuides.find(item=>item.id===guideDrag.id);guide.position=Math.max(0,Math.min(guideDrag.axis==='x'?l.width:l.height,guideDrag.position+delta));drawAlignmentGuides(guideDrag.next);return;}if(elementDrag){elementDrag.moved ||= Math.hypot(e.clientX-elementDrag.screen.x,e.clientY-elementDrag.screen.y)>3;if(!elementDrag.moved)return;const delta=boundedObjectDelta(elementDrag,snappedDelta(elementDrag.alignment,elementDrag.screen,e));moveNativeItems(elementDrag,delta);moveOverlayItems(elementDrag,delta);drawSelection(selectedNodes());return;}if(overlayDrag){overlayDrag.moved ||= Math.hypot(e.clientX-overlayDrag.screen.x,e.clientY-overlayDrag.screen.y)>3;if(!overlayDrag.moved)return;if(!overlayDrag.resize){const delta=boundedObjectDelta(overlayDrag,snappedDelta(overlayDrag.alignment,overlayDrag.screen,e));moveNativeItems(overlayDrag,delta);moveOverlayItems(overlayDrag,delta);drawSelection(selectedNodes());return;}const p=canvasPoint(e),space=overlayEditingSpace(l),dx=(p.x-overlayDrag.point.x)*l.width,dy=(p.y-overlayDrag.point.y)*l.height,a=overlayDrag.next.overlays.find(a=>a.id===overlayDrag.id),old=state().overlays.find(a=>a.id===overlayDrag.id);Object.assign(a,resizeOverlayGeometry(old,overlayDrag.endpoint,dx,dy,space,e.shiftKey));if(!overlayDrag.frame)overlayDrag.frame=requestAnimationFrame(()=>{if(!overlayDrag?.resize)return;overlayDrag.frame=0;const current=overlayDrag.next.overlays.find(item=>item.id===overlayDrag.id);svg.querySelector(`[data-annotation="${current.id}"]`)?.replaceWith(overlayNode(current,l));});return;}
      if(marquee){if(e.buttons===0){cancelSelectionGesture();return;}marquee.last={clientX:e.clientX,clientY:e.clientY};marquee.moved ||= Math.hypot(e.clientX-marquee.screen.x,e.clientY-marquee.screen.y)>3;if(marquee.moved&&marquee.canSelect){e.preventDefault();if(!selectionFrame)selectionFrame=requestAnimationFrame(paintMarquee);}return;}if(labelDrag){const {id,point,start}=labelDrag,cell=l.positions.find(p=>p.id===id),pos=cell.renderBox||cell,r=svg.getBoundingClientRect();labelDrag.moved ||= Math.hypot(e.clientX-point.x,e.clientY-point.y)>3;if(!labelDrag.moved)return;pending=copy(state());const delta=snappedDelta(labelDrag.alignment,point,e),label=pending.panels[id].label;label.x=Math.max(0,Math.min(100,start.x+delta.dx/pos.width*100));label.y=Math.max(0,Math.min(100,start.y+delta.dy/pos.height*100));const text=svg.querySelector(`[data-panel-label="${id}"]`);text.setAttribute('x',pos.x+pos.width*label.x/100);text.setAttribute('y',pos.y+pos.height*label.y/100);drawSelection([text]);return;}if((!layoutMode&&!panelDrag)||(!resizeDrag&&!dragging))return;if(panelDrag&&!panelDrag.moved){panelDrag.moved=Math.hypot(e.clientX-panelDrag.x,e.clientY-panelDrag.y)>3;if(!panelDrag.moved)return;svg.classList.add('is-dragging-panel');}previewLayoutDrop(e);
    };
    svg.onpointerup=e=>{if(overlayDrag?.frame)cancelAnimationFrame(overlayDrag.frame);svg.classList.remove('is-dragging-object');snapLayer.replaceChildren();if(guideDrag){const {next,moved}=guideDrag;guideDrag=null;suppressClick=true;if(moved)commit(next,T('已移动对齐参考线'));return;}if(elementDrag){const {next,moved,newSelection}=elementDrag;elementDrag=null;suppressClick=true;if(moved)commit(next,T('已移动所选元素'));else if(newSelection)finishSelectionUI();else clearCanvasSelection();return;}if(overlayDrag){const {next,moved,clearOnTap}=overlayDrag;overlayDrag=null;suppressClick=true;if(moved)commit(next,T('已调整标注位置'));else if(clearOnTap)clearCanvasSelection();else finishSelectionUI();return;}if(marquee){const m=marquee;cancelAnimationFrame(selectionFrame);selectionFrame=0;marquee=null;stopMarqueeFeedback();if(!m.moved){if(m.capture===viewport){if(!m.append)clearCanvasSelection();}else if(m.clearOnTap)clearCanvasSelection();else svg.onclick({target:m.target,shiftKey:m.append,clientX:e.clientX,clientY:e.clientY});suppressClick=true;return;}if(!m.canSelect){drawSelection(selectedNodes());return;}
        const {hits,annotations}=marqueeResult(m,e),annotationIds=m.append?[...new Set([...selectedAnnotations,...annotations.map(a=>a.el.dataset.annotation)])]:annotations.map(a=>a.el.dataset.annotation);
        const groups=m.append?selectionGroups().map(g=>({...g,keys:[...g.keys]})):[];
        for(const hit of hits){let group=groups.find(g=>g.id===hit.id);if(!group){group={id:hit.id,vi:state().panels[hit.id].variant,keys:[]};groups.push(group);}if(!group.keys.includes(hit.key))group.keys.push(hit.key);}
        setElementSelection(groups);selectedAnnotations=annotationIds;
        if(annotationIds.length&&!groups.length){activePane='annotation';renderOverlayProperties();}else{$('scope').value='element';activePane='detail';}
        selectionAfterMarquee=!!(groups.length||annotationIds.length);suppressClick=true;finishSelectionUI();say(T('已选 {0} 个元素',selectionGroups().reduce((n,g)=>n+g.keys.length,0)+selectedAnnotations.length));return;}
      if(labelDrag){const {id,moved,clearOnTap}=labelDrag;labelDrag=null;suppressClick=true;if(pending)commit(pending,T('已调整图号'));pending=null;if(clearOnTap&&!moved)clearCanvasSelection();else selectPanelLabel(id);return;}if(!layoutMode&&!panelDrag)return;suppressClick=true;svg.classList.remove('is-dragging-panel');if(resizeDrag){previewLayoutDrop(e);const next=pending;resizeDrag=null;clearGhost();selected=[];if(!next||JSON.stringify(next.grid)===JSON.stringify(gridFor(state()))||!commit(next,T('已应用跨格')))render();}else{const moved=!!panelDrag?.moved;panelDrag=null;clearGhost();if(!moved)dragging=null;if(!moved||!drop(e))render();}};
    svg.onpointercancel=()=>{if(overlayDrag?.frame)cancelAnimationFrame(overlayDrag.frame);cancelSelectionGesture?.();cancelAnimationFrame(selectionFrame);elementDrag=null;overlayDrag=null;labelDrag=null;guideDrag=null;marquee=null;dragging=null;snapLayer.replaceChildren();panelDrag=null;resizeDrag=null;svg.classList.remove('is-dragging-panel','is-dragging-object');clearGhost();render();};
    cancelObjectGesture=()=>{if(!elementDrag&&!overlayDrag&&!labelDrag&&!guideDrag)return false;elementDrag=null;overlayDrag=null;labelDrag=null;guideDrag=null;snapLayer.replaceChildren();svg.classList.remove('is-dragging-object');return true;};
    cancelPanelGesture=()=>{if(!panelDrag&&!resizeDrag)return false;dragging=null;panelDrag=null;resizeDrag=null;svg.classList.remove('is-dragging-panel');clearGhost();return true;};
    svg.onlostpointercapture=()=>{if(marquee)cancelSelectionGesture();else if(panelDrag||resizeDrag||elementDrag||overlayDrag||labelDrag||guideDrag)svg.onpointercancel();};
    svg.ondragstart=e=>e.preventDefault();
    svg.ondragover=e=>{if(layoutMode&&dragging){e.preventDefault();previewLayoutDrop(e);}};svg.ondragleave=()=>clearGhost();svg.ondrop=e=>{e.preventDefault();clearGhost();drop(e);};
    svg.ondblclick=event=>{const text=event.target.closest('text');if(text){event.preventDefault();startInlineTextEdit(text);}};
    svg.onclick=event=>{
      if(suppressClick){suppressClick=false;return;}const mark=event.target.closest('[data-annotation]');if(mark){if(!selectedAnnotations.includes(mark.dataset.annotation)){selectedAnnotations=event.shiftKey?[...selectedAnnotations,mark.dataset.annotation]:[mark.dataset.annotation];if(!event.shiftKey){selected=[];elementSelections=[];selectedPanelLabel=null;}}activePane='annotation';finishSelectionUI();return;}const appendAnnotations=event.shiftKey?[...selectedAnnotations]:[];if(!event.shiftKey)selectedAnnotations=[];
      if(event.target.closest('[data-panel-label]')){selectPanelLabel(event.target.closest('[data-panel-label]').dataset.panelLabel);return;}
      selectedPanelLabel=null;
      if(layoutMode)return;
      if(original)return;
      const pan=event.target.closest('[data-panel]'),id=pan?.getAttribute('data-panel')||(Number.isFinite(event.clientX)?at(destination(event)):null);if(!id){if(!event.shiftKey)clearCanvasSelection();return;}
      const hit=canvasObjectTarget(event.target),el=hit?.closest('text[data-key]')||hit;
      if(el && isVisibleObject(el)) {const key=el.getAttribute('data-key'),members=state().panels[id].elementGroups?.[state().panels[id].variant]?.find(g=>g.includes(key))||[key],groups=event.shiftKey?selectionGroups().map(g=>({...g,keys:[...g.keys]})):[];let group=groups.find(g=>g.id===id);if(!group){group={id,vi:state().panels[id].variant,keys:[]};groups.push(group);}for(const k of members)if(!group.keys.includes(k))group.keys.push(k);setElementSelection(groups);$('scope').value='element';activePane='detail';}
      else {if(!event.shiftKey){selectedPanel=id;clearCanvasSelection();}return;}
      selectedAnnotations=appendAnnotations;finishSelectionUI();
    };
    viewport.onpointerdown=e=>{
      if(e.button!==0||svg.contains(e.target)||e.target.closest('button,input,select,textarea,[role="button"]'))return;
      const r=viewport.getBoundingClientRect(),x=e.clientX-r.left-viewport.clientLeft,y=e.clientY-r.top-viewport.clientTop;
      if(x<0||y<0||x>=viewport.clientWidth||y>=viewport.clientHeight)return;
      cancelQueuedZoom();e.preventDefault();window.getSelection()?.removeAllRanges();beginMarquee(e,viewport);
    };
    viewport.onpointermove=e=>{if(marquee?.capture===viewport)svg.onpointermove(e);};
    viewport.onpointerup=e=>{if(marquee?.capture===viewport)svg.onpointerup(e);};
    viewport.onpointercancel=()=>{if(marquee?.capture===viewport)cancelSelectionGesture();};
    viewport.onlostpointercapture=()=>{if(marquee?.capture===viewport)cancelSelectionGesture();};
    viewport.onclick=e=>{if(!svg.contains(e.target))suppressClick=false;};
    viewport.onscroll=()=>{if(marquee)cancelSelectionGesture();};
  }
  function renderMethods(){
    const record=state().panels[selectedPanel].statistics,a=statisticalAnalysisFor(selectedPanel)||{},goal=$('analysisGoal').value,keys=methodOrder(a,goal);$('methodCards').replaceChildren();
    $('analysisGoal').disabled=!!record;$('methodReason').disabled=!!record;
    if(record){
      const sets=(a.facets||[a]).map(set=>({set,info:statisticalComparisons(set)})).filter(item=>!item.info.reason);
      for(const {set,info}of sets){const card=document.createElement('div');card.className='method-card';const title=document.createElement('strong');title.textContent=[set.label,T(statisticalMethodName(info.method))].filter(Boolean).join(' · ');const count=document.createElement('p');count.textContent=T('已连接 {0} 项组间比较。',info.comparisons.length);card.append(title,count);$('methodCards').append(card);}
      $('methodRequirements').textContent=T(sets.length?'使用已连接的分析结果；可通过“更新统计分析”更改方法或数据。':record.stale||!Object.keys(a).length?'图形数据已变化，请更新连接的比较数据。':'此图没有可比较的检验结果。先确认研究设计与分析目标。');return;
    }
    if(!keys.length){$('methodRequirements').textContent=T('此图没有可比较的检验结果。先确认研究设计与分析目标。');return;}
    const choices=state().panels[selectedPanel].methodChoice;
    keys.forEach((key,i)=>{const result=a[key],card=document.createElement('div');card.className='method-card';const title=document.createElement('strong');title.textContent=(i===0?T('条件推荐：'):T('备选／敏感性分析：'))+T(statisticalMethodName(result.name));
      const explanation=document.createElement('p');explanation.className='muted';explanation.textContent=key==='primary_test'?T('针对均值问题；独立性或配对结构由分析方案确认。小样本、强偏态和极端值需结合诊断判断。'):a.design==='paired'?T('配对秩方法关注差值的秩结构；Wilcoxon 的位置解释需要差值分布对称，不能仅凭“不正态”选择。'):T('秩方法关注分布差异，不能无条件解释为均值或中位数差异。');
      const number=document.createElement('p'),symbol=document.createElement('i');symbol.textContent='P';number.append(symbol,document.createTextNode(' = '+result.p_value.toPrecision(4)));
      if(key==='primary_test'&&Number.isFinite(a.primary_estimand?.estimate)){const effect=a.primary_estimand;number.append(document.createTextNode(' · '+effect.name+' = '+effect.estimate.toPrecision(4)+' · 95% CI ['+effect.ci95.map(x=>Number(x).toPrecision(4)).join(', ')+']'));}
      if(key==='sensitivity_test'){const note=document.createElement('p');note.className='muted';note.textContent=T('当前分析包未提供该秩方法的独立效应量区间；不借用均值差 CI。');card.append(note);}
      const choose=button(choices?.key===key?T('当前选择'):T('采用这个已计算方法'),()=>{if(key!=='primary_test'&&a.display_p_value)return say(T('原图已嵌入主分析 P 值，请先由分析流程重绘'));const reason=$('methodReason').value.trim();if(!reason)return say(T('请填写方法选择与研究问题的关系'));const next=copy(state());delete next.panels[selectedPanel].statistics;next.panels[selectedPanel].methodChoice={key,reason,goal};delete next.panels[selectedPanel].annotationStyle;commit(next,T('分析选择已记录，请重新确认统计标注'));});card.prepend(title,explanation,number);card.append(choose);$('methodCards').append(card);
    });
    $('methodRequirements').textContent=T('其他方向需补充条件：协变量调整／ANCOVA 需协变量与模型；混合模型需重复或层级结构；置换检验需可交换性与重排单位；稳健／截尾方法需明确目标量；分类结局需列联表或广义线性模型；生存分析需时间与删失信息。');
  }
  function render() {
    if(!state().order.includes(selectedPanel)){selectedPanel=state().order[0];selected=[];panelSelection=[];}
    renderProjectStart();
    renderDataEditor();
    renderOverlayProperties();
    templateCache.clear();
    renderMethods();
    if(selectedPanelLabel&&(selectedPanelLabel!==selectedPanel||!state().panels[selectedPanelLabel]?.label||selected.length||selectedAnnotations.length))selectedPanelLabel=null;renderLabelControls();
    $('projectTitle').textContent=StudioI18n.projectTitle(project);$('columns').value=state().columns;syncPanelGapControls();
    const g=gridFor(state()),p=g.places[selectedPanel];$('rows').value=g.rows;$('targetRow').value=p.row+1;$('targetCol').value=p.col+1;$('rowSpan').value=p.rs;$('colSpan').value=p.cs;
    syncCanvasModes();
    $('undo').disabled=history.index===0;$('redo').disabled=history.index===history.states.length-1;
    $('compare').textContent=original?T('返回编辑'):T('对照原图');$('compare').setAttribute('aria-pressed',String(original));renderGroupSpacingControls();
    $('panels').replaceChildren();visualPanelOrder(state()).forEach((id,i)=>{const b=button('',event=>{panelSelection=event?.shiftKey?(panelSelection.includes(id)?panelSelection.filter(x=>x!==id):[...panelSelection,id]):[id];selectedPanel=id;selected=[];elementSelections=[];selectionAnchor=null;selectedAnnotations=[];selectedPanelLabel=null;selectedAlignmentGuide=null;$('scope').value='panel';render();});b.className='panel-button'+(id===selectedPanel||panelSelection.includes(id)?' active':'');b.setAttribute('aria-label',T('选择面板 ')+(i+1));b.draggable=true;b.ondragstart=()=>{dragging=id;layoutMode=true;renderCanvas();};b.ondragend=()=>{if(dragging){dragging=null;renderCanvas();}};b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();if(dragging){const pos=gridFor(state()).places[id],source=dragging;dragging=null;commit(moveWithSizes(state(),source,pos.row,pos.col),T('已交换小图'));}};const n=document.createElement('b');n.textContent=String(i+1).padStart(2,'0');const name=document.createElement('span');name.textContent=StudioI18n.panelName(panel(id))+(state().panels[id].locked?' 🔒':'')+((state().panelGroups||[]).some(g=>g.includes(id))?' ⛓':'');b.append(n,name);$('panels').append(b);});
    $('versions').replaceChildren();for(const saved of checkpoints)$('versions').append(button(saved.name,()=>{selected=[];commit(saved.state,T('已恢复版本 ')+saved.name);}));
    renderMasters();renderCanvas();renderInspector();renderRecommendations();showPane(activePane,false);renderHeatmapControls();renderCompactWhitespaceControls();
    renderConnectionNotice();ensureHeatmapMetadata().catch(()=>{});ensureStatisticalMetadata().catch(()=>{});literatureBrowser?.refresh();duplicateCheck?.refresh();
  }
  async function download(blob,name) {
    const native=globalThis.StudioNativeBridge;
    if(native?.bundledAssets===true){
      if(typeof native.saveBlob!=='function')throw Error(T('本地文件保存不可用，请重试或重新打开应用。'));
      const result=await native.saveBlob(blob,name);
      if(result?.cancelled){say(T('保存已取消'));return false;}
      if(result?.saved!==true)throw Error(T('文件尚未保存，请重试。'));
      return true;
    }
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);return true;
  }
  function svgText(){return new XMLSerializer().serializeToString(composite(false,true));}
  function guard(fn) {return async(...args)=>{try{await fn(...args);}catch(e){say(T('未完成：')+T(e.message));}};}
  $('language').onchange=()=>{
    const drafts=Object.fromEntries(['textContent','fontSize','font','color','opacity','versionName'].map(id=>[id,$(id).value]));
    StudioI18n.setLanguage($('language').value);
    try{localStorage.setItem('figure-studio:language',StudioI18n.language);}catch{}
    localizeStatic();render();drawColorSwatches();workspaceSizing?.translate();
    for(const [id,value]of Object.entries(drafts))$(id).value=value;
    $('opacityValue').value=$('opacity').value+'%';
    $('autosaveStatus').textContent=T($('autosaveStatus').classList.contains('unsaved')?'自动保存失败 · 请下载工程':'已自动保存 · 含撤销记录');
    say(T('界面语言已切换；图内文字、数据和编辑历史保持不变。'));
  };
  $('rememberPreferences').onchange=()=>{preferences.enabled=$('rememberPreferences').checked;savePreferences();renderRecommendations();};
  $('clearPreferences').onclick=()=>{if(!confirmPreferenceClear){confirmPreferenceClear=true;renderRecommendations();say(T('清除本浏览器的偏好记忆？当前图形、版本和撤销记录不会删除。'));return;}clearedPreferences=copy(preferences.toJSON());preferences.clear();confirmPreferenceClear=false;savePreferences();renderRecommendations();say(T('偏好记忆已清除。'));};
  $('restorePreferences').onclick=()=>{if(!clearedPreferences)return;const previous=new StudioPreferences(clearedPreferences);preferences.enabled=previous.enabled;preferences.seen=previous.seen;preferences.counts=previous.counts;clearedPreferences=null;savePreferences();renderRecommendations();say(T('偏好记忆已恢复。'));};
  $('analysisGoal').onchange=renderMethods;
  $('annotationStyle').onchange=()=>{try{const next=copy(state()),style=$('annotationStyle').value,p=next.panels[selectedPanel];if(p.locked)throw Error('小图已锁定');if(!style){delete p.annotationStyle;}else{const info=statisticalAnnotationInfo(selectedPanel);if(!info.available||style==='letters'&&!info.letters){openStatistics(style);return;}p.annotationStyle=style;}transferStatisticalStyleEdits(next,selectedPanel);selected=[];elementSelections=[];selectionAnchor=null;commit(next,T('已切换统计标注'));}catch(e){renderStatisticalAnnotations();say(T(e.message));}};
  $('annotationLine').onchange=()=>{try{const next=copy(state()),p=next.panels[selectedPanel];if(p.locked)throw Error('小图已锁定');if(!statisticalAnnotationInfo(selectedPanel).available)throw Error('缺少已确认的比较结果');p.annotationLine=$('annotationLine').value;commit(next,T('已更新统计连接线'));}catch(e){renderStatisticalAnnotations();say(T(e.message));}};
  $('annotationPFormat').onchange=()=>{try{const next=copy(state()),p=next.panels[selectedPanel];if(p.locked)throw Error('小图已锁定');p.annotationPFormat=$('annotationPFormat').value;clearStatisticalResultEdits(next,selectedPanel);commit(next,T('已更新 P 值显示格式'));}catch(e){renderStatisticalAnnotations();say(T(e.message));}};
  $('showFacetTitles').onchange=()=>{const next=copy(state()),p=next.panels[selectedPanel];if(p.locked)return;p.showFacetTitles=$('showFacetTitles').checked;commit(next,T('已更新分面标题显示'));};
  for(const key of ['statisticalFontFamily','statisticalBold','statisticalItalic'])$(key).onchange=()=>{const next=copy(state()),p=next.panels[selectedPanel];if(p.locked||!p.annotationStyle)return;p.annotationFont={...p.annotationFont,font:$('statisticalFontFamily').value,size:p.annotationFont?.size||next.typography?.size||9,bold:$('statisticalBold').checked,italic:$('statisticalItalic').checked};clearStatisticalFontEdits(next,selectedPanel,[{statisticalFontFamily:'font-family',statisticalBold:'font-weight',statisticalItalic:'font-style'}[key]]);commit(next,T('已更新统计标注字体'));};
  $('statisticalAnalysis').onclick=()=>openStatistics(state().panels[selectedPanel].annotationStyle||'p');
  $('configureStatistics').onclick=()=>openStatistics(state().panels[selectedPanel].annotationStyle||'p');
  $('methodConfigureStatistics').onclick=()=>openStatistics(state().panels[selectedPanel].annotationStyle||'p');
  const updateStatisticalFont=()=>{const value=+$('statisticalFontSize').value;if(!Number.isFinite(value)||value<4||value>72||!$('statisticalFontSize').value)return;const next=copy(state()),p=next.panels[selectedPanel];if(p.locked||!p.annotationStyle)return;p.annotationFont={...p.annotationFont,font:p.annotationFont?.font||next.typography?.font||'Arial',size:value/currentOutput().scale};clearStatisticalFontEdits(next,selectedPanel,['font-size']);commit(next,T('已调整统计标注字号'));};
  $('statisticalFontSize').oninput=updateStatisticalFont;$('statisticalFontSize').onchange=updateStatisticalFont;$('statisticalFontSize').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();updateStatisticalFont();}};
  const scaleSelection=()=>{const vi=state().panels[selectedPanel].variant;if(selected.length!==1)return null;const img=baseSvg(selectedPanel,vi).querySelector(`[data-key="${selected[0]}"]`);if(img?.localName!=='image')return null;const m=img.transform.baseVal.consolidate()?.matrix;if(m&&(Math.abs(m.b)>1e-8||Math.abs(m.c)>1e-8))return null;return {vi,key:selected[0]};};
  const updateScale=(previewOnly=false)=>{const choice=scaleSelection();if(!choice)return say(T('请选中一张未旋转的栅格图像'));const next=copy(state()),p=next.panels[selectedPanel];p.scales||={};p.scales[choice.vi]||={};p.scales[choice.vi][choice.key]={calibration:+$('scaleCalibration').value,length:+$('scaleLength').value,position:$('scalePosition').value,thickness:+$('scaleThickness').value,size:+$('scaleFontSize').value,bold:$('scaleBold').checked,background:$('scaleBackground').checked,alpha:+$('scaleAlpha').value,font:$('font').value,color:$('color').value};if(p.locked||p.lockedElements?.[choice.vi]?.includes(choice.key))return say(T('元素已锁定'));if(previewOnly){try{validateState(next,project);renderCanvas(next);}catch{}}else commit(next,T('已更新比例尺'));};
  $('applyScale').onclick=()=>updateScale();
  for(const id of ['scaleCalibration','scaleLength','scalePosition','scaleThickness','scaleFontSize','scaleBold','scaleBackground','scaleAlpha']){$(id).oninput=()=>updateScale(true);$(id).onchange=()=>updateScale();}
  $('removeScale').onclick=()=>{const choice=scaleSelection();if(!choice)return say(T('请选中一张未旋转的栅格图像'));const next=copy(state());if(next.panels[selectedPanel].lockedElements?.[choice.vi]?.includes(choice.key))return say(T('元素已锁定'));if(next.panels[selectedPanel].scales?.[choice.vi])delete next.panels[selectedPanel].scales[choice.vi][choice.key];commit(next,T('已更新比例尺'));};
  const labelValues=text=>({text,x:+$('labelX').value,y:+$('labelY').value,size:+$('labelSize').value,font:$('font').value,bold:$('labelBold').checked});
  $('numberPanels').onclick=()=>commit(numberPanelLabels(state(),$('labelStyle').value,labelValues('')),T('已按布局自动编号'));
  $('labelStyle').onchange=()=>$('numberPanels').click();
  $('autoNumberLabels').onchange=()=>{if($('autoNumberLabels').checked)return $('numberPanels').click();const next=copy(state());for(const id of next.order)if(!next.panels[id].locked&&next.panels[id].label)next.panels[id].label=displayedPanelLabel(state(),id);next.labelNumbering=false;commit(next,T('已切换手动编号'));};
  $('applyPanelLabel').onclick=()=>{const next=copy(state()),previous=displayedPanelLabel(state(),selectedPanel),value=$('panelLabel').value;next.panels[selectedPanel].label={...labelValues(value),manual:previous?.manual||value!==previous?.text};commit(next,T('已调整图号'));};
  $('deleteElements').onclick=deleteSelectedObjects;
  $('removePanelLabel').onclick=()=>{const next=copy(state());delete next.panels[selectedPanel].label;commit(next,T('已调整图号'));};
  $('groupSelection').onclick=()=>{const next=copy(state());if(selected.length>1){const p=next.panels[selectedPanel],vi=p.variant;p.elementGroups||={};p.elementGroups[vi]=(p.elementGroups[vi]||[]).filter(g=>!g.some(k=>selected.includes(k)));p.elementGroups[vi].push([...selected]);}else if(panelSelection.length>1){next.panelGroups=(next.panelGroups||[]).filter(g=>!g.some(id=>panelSelection.includes(id)));next.panelGroups.push([...panelSelection]);}else return say(T('请先多选小图或元素'));commit(next,T('已组合'));};
  $('ungroupSelection').onclick=()=>{const next=copy(state()),p=next.panels[selectedPanel];if(selected.length){if(p.elementGroups)p.elementGroups[p.variant]=(p.elementGroups[p.variant]||[]).filter(g=>!g.some(k=>selected.includes(k)));}else next.panelGroups=(next.panelGroups||[]).filter(g=>!g.includes(selectedPanel));commit(next,T('已拆分组合'));};
  const lockSelection=value=>{const next=copy(state()),p=next.panels[selectedPanel];if(selected.length){p.lockedElements||={};const keys=new Set(p.lockedElements[p.variant]||[]);selected.forEach(k=>value?keys.add(k):keys.delete(k));p.lockedElements[p.variant]=[...keys];}else for(const id of panelSelection.length?panelSelection:[selectedPanel])next.panels[id].locked=value;commit(next,T(value?'已锁定所选内容':'已解锁所选内容'));};
  $('lockSelection').onclick=()=>lockSelection(true);$('unlockSelection').onclick=()=>lockSelection(false);
  $('undo').onclick=()=>{history.undo();selected=[];original=false;render();persist();say(T('已撤销'));};
  $('redo').onclick=()=>{history.redo();selected=[];original=false;render();persist();say(T('已重做'));};
  $('compare').onclick=()=>{cancelOverlayPlacement();original=!original;renderCanvas();$('compare').textContent=original?T('返回编辑'):T('对照原图');$('compare').setAttribute('aria-pressed',String(original));say(original?T('原版对照：当前布局与候选，未应用外观修改。'):T('已返回编辑版'));};
  $('reset').onclick=()=>{selected=[];commit(project.initialState,T('已恢复 AI 首版；仍可撤销此次恢复'));};
  $('errorDirection').onchange=()=>{const next=copy(state());next.panels[selectedPanel].errorDirection=$('errorDirection').value;commit(next,T('已更新误差棒方向'));};
  $('applyStroke').onclick=()=>updateStyle('stroke-width',$('elementStroke').value,'shape');
  $('elementStroke').onchange=()=>updateStyle('stroke-width',$('elementStroke').value,'shape');
  $('fillMode').onchange=()=>{if($('fillMode').value==='')return;updateStyle('fill',$('fillMode').value==='none'?'none':$('color').value,'shape',$('fillMode').value==='none'?{stroke:$('color').value}:{});};
  $('textAlign').onchange=()=>updateStyle('text-anchor',$('textAlign').value,'text');
  $('overlayAlign').onchange=()=>{const next=copy(state());for(const a of next.overlays||[])if(selectedAnnotations.includes(a.id)&&!a.locked&&a.type==='text')a.align=$('overlayAlign').value;commit(next,T('已更新标注'));};
  document.querySelectorAll('[data-align-objects]').forEach(button=>button.onclick=()=>alignSelectedObjects(button.dataset.alignObjects));
  $('scope').onchange=()=>{drawColorSwatches();renderInspectorPreviews();renderRecommendations();renderFontTargets();};$('textRole').onchange=()=>{renderFontTargets();say(T('文字类别已选择，下一次文字样式操作将使用此范围。'));};
  document.querySelectorAll('[data-tab]').forEach(el=>{el.onclick=()=>showPane(el.getAttribute('data-tab'));});
  for(const id of ['barWidth','groupGap']){$(id).oninput=()=>{if(state().panels[selectedPanel].locked)return;const next=copy(state());next.panels[selectedPanel].geometry={barWidth:+$('barWidth').value,groupGap:+$('groupGap').value};renderCanvas(next);};$(id).onchange=()=>{const next=copy(state());next.panels[selectedPanel].geometry={barWidth:+$('barWidth').value,groupGap:+$('groupGap').value};commit(next,T('已调整柱宽和组间距'));};}
  $('resetBars').onclick=()=>{const next=copy(state());delete next.panels[selectedPanel].geometry;commit(next,T('已恢复自动柱形布局'));};
  bindCategorySpacingControls();
  bindStatisticalLineControls();
  bindCompactWhitespaceControls();
  function syncColorControls(){
    const value=$('color').value.toUpperCase();$('colorHex').value=value;
    for(const b of document.querySelectorAll('.color-swatches button'))b.setAttribute('aria-pressed',String(b.title===value));
  }
  function rememberColor(value){
    let recent=[];try{recent=JSON.parse(localStorage.getItem('figure-studio:recent-colors')||'[]');}catch{}
    recent=[value,...(Array.isArray(recent)?recent:[]).filter(c=>/^#[0-9a-f]{6}$/i.test(c)&&c!==value)].slice(0,8);
    try{localStorage.setItem('figure-studio:recent-colors',JSON.stringify(recent));}catch{}
    drawColorSwatches(recent);
  }
  function applyChosenColor(){updateStyle('color',$('color').value);rememberColor($('color').value);syncColorControls();}
  function drawColorSwatches(recent){
    const info=paletteHeatmapInfo(),available=paletteSchemes(info),scheme=available.find(item=>item.id===swatchScheme)||available[0],common=[...(info?paletteStops(scheme,info):scheme.colors),'#000000','#ffffff'];
    swatchScheme=scheme.id;
    $('swatchScheme').replaceChildren();
    for(const item of available){const option=document.createElement('option');option.value=item.id;option.textContent=T(paletteSchemeName(item,info));$('swatchScheme').append(option);}
    $('swatchScheme').value=scheme.id;
    if(!recent){try{recent=JSON.parse(localStorage.getItem('figure-studio:recent-colors')||'[]');}catch{recent=[];}}
    for(const [id,values]of [['quickSwatches',common],['recentSwatches',Array.isArray(recent)?recent:[]]]){
      const host=$(id),colors=[...new Set(values.filter(v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)).map(v=>v.toUpperCase()))].slice(0,8);
      host.replaceChildren();
      if(id==='quickSwatches'&&info)host.append(paletteStrip(paletteStops(scheme,info),info));
      for(const value of colors){
        const b=button('',()=>{$('color').value=value;applyChosenColor();});
        b.className='color-swatch';b.title=value;b.setAttribute('aria-label',value);
        b.style.setProperty('--swatch-color',value);
        const linear=value.slice(1).match(/../g).map(v=>{const c=parseInt(v,16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});
        const lightness=.2126*linear[0]+.7152*linear[1]+.0722*linear[2];
        b.style.setProperty('--swatch-ink',lightness>.24?'#25344a':'#ffffff');
        const chip=document.createElement('span');chip.className='swatch-chip';chip.setAttribute('aria-hidden','true');
        const mark=document.createElementNS('http://www.w3.org/2000/svg','svg');mark.classList.add('swatch-check');mark.setAttribute('viewBox','0 0 16 16');mark.setAttribute('aria-hidden','true');mark.setAttribute('focusable','false');
        const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d','M3.5 8 6.5 11 12.5 4.8');mark.append(path);chip.append(mark);b.append(chip);host.append(b);
      }
      if(id==='recentSwatches'&&!colors.length){const empty=document.createElement('span');empty.className='swatch-empty';empty.textContent=StudioI18n.language==='en'?'No recent colors':'暂无最近颜色';host.append(empty);}
    }syncColorControls();
  }
  $('swatchScheme').onchange=()=>{
    swatchScheme=swatchSchemeFor($('swatchScheme').value).id;
    try{localStorage.setItem('figure-studio:swatch-scheme',swatchScheme);}catch{}
    drawColorSwatches();
  };
  $('applySwatchScheme').onclick=()=>{
    if(original)return say(T('请先退出原版对照。'));
    if(['element','sameColor'].includes($('scope').value)&&!selectionGroups().some(group=>group.keys.length))return say(T('请先选择要配色的元素。'));
    const scheme=swatchSchemeFor(swatchScheme),next=paletteState(scheme.colors,scheme);
    if(JSON.stringify(next)===JSON.stringify(state()))return say(T('当前范围没有可应用的配色对象。'));
    commit(next,T('已应用配色方案：{0}',T(scheme.name)));
  };
  $('applyColor').onclick=applyChosenColor;
  $('color').oninput=()=>{syncColorControls();updateStyle('color',$('color').value,'all',{},true);};
  $('color').onchange=applyChosenColor;
  $('colorHex').oninput=()=>{$('colorError').textContent='';};
  $('colorHex').onchange=()=>{let value=$('colorHex').value.trim();if(!value.startsWith('#'))value='#'+value;const normalized=hex(value);if(!normalized){$('colorError').textContent=T('请输入有效的 HEX 色值，例如 #4477AA。');return;}$('color').value=normalized;applyChosenColor();};
  drawColorSwatches();
  $('opacity').oninput=()=>{$('opacityValue').value=$('opacity').value+'%';updateStyle('opacity',String(+$('opacity').value/100),'all',{},true);};
  $('opacity').onchange=()=>updateStyle('opacity',String(+$('opacity').value/100));
  function renderFontTargets(){
    if(!project||!history)return;let count=0;
    for(const id of $('scope').value==='all'?state().order:$('scope').value==='element'?selectionGroups().map(g=>g.id):[selectedPanel]){const vi=state().panels[id].variant;count+=targetObjects(id,vi,editableSource(id,vi),'text').length;}
    $('fontTargetInfo').textContent=count?T('将修改 {0} 个文字对象；输入后回车或移开即可应用。',count):T('当前未选中文字。请点选文字，或将范围改为当前小图。');
    for(const id of ['font','fontSize','applyFont','bold'])$(id).disabled=!count;
  }
  $('unifyTypography').onclick=()=>{
    const next=copy(state());next.typography={font:$('font').value,size:Math.min(72,Math.max(6,+$('fontSize').value||9))/currentOutput().scale};
    for(const id of next.order){const p=next.panels[id];if(p.locked)continue;if(panel(id).provenance==='user-import')p.useUnifiedTypography=true;delete p.annotationFont;for(const [vi,edits]of Object.entries(p.edits))for(const [key,props]of Object.entries(edits)){if((p.lockedElements?.[vi]||[]).includes(key))continue;delete props['font-family'];delete props['font-size'];}}
    commit(next,T('已统一组图文字规格'));
  };
  function applyFont(previewOnly=false){const n=+$('fontSize').value;if(!Number.isFinite(n)||n<4||n>72){if(!previewOnly)say(T('字号应为 4–72 pt。'));return;}updateStyle('font-size',String(n),'text',{},previewOnly);}
  let fontPreview;
  $('fontSize').oninput=()=>{cancelAnimationFrame(fontPreview);fontPreview=requestAnimationFrame(()=>applyFont(true));};
  $('fontSize').onchange=()=>{cancelAnimationFrame(fontPreview);applyFont();};
  $('fontSize').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();cancelAnimationFrame(fontPreview);applyFont();}};
  $('font').onchange=()=>updateStyle('font-family',$('font').value,'text');
  $('applyFont').onclick=()=>applyFont();
  $('bold').onclick=()=>{
    const vi=state().panels[selectedPanel].variant,svg=editedSvg(selectedPanel,vi),objects=targetObjects(selectedPanel,vi,svg,'text');
    const allBold=objects.length&&objects.every(el=>['bold','700'].includes(el.style.fontWeight||el.getAttribute('font-weight')));
    updateStyle('font-weight',allBold?'400':'700','text');
  };
  $('applyText').onclick=()=>{if(state().panels[selectedPanel].locked||state().panels[selectedPanel].lockedElements?.[state().panels[selectedPanel].variant]?.includes(selected[0]))return say(T('元素已锁定'));if(selected.length!==1)return;const next=copy(state());setEdit(next,selectedPanel,next.panels[selectedPanel].variant,selected[0],'text',$('textContent').value);commit(next,T('已修改文字；请核对标签与数据含义'));};
  $('complement').onclick=()=>{
    const base=$('color').value,other=complementary(base),next=paletteState([base,other]);
    if(JSON.stringify(next)===JSON.stringify(state()))return say(T('当前范围没有可应用的配色对象。'));
    const b=button('',()=>commit(next,T('已应用互补配色')));b.className='palette';const label=document.createElement('span');label.textContent=base+' + '+other+T(' · 点击应用（不代表色觉无障碍已验证）');b.append(preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)),label);$('complementPreview').replaceChildren(b);
  };
  let overlayPlacement=null,placementDrag=null,inlineEditor=null,placementFrame=0,placementClickPending=false;
  function prepareTouchEditing(){if(mobileWorkspace?.enabled){mobileWorkspace.setMode('edit');mobileWorkspace.showTab('canvas');}}
  function cancelOverlayPlacement(){cancelAnimationFrame(placementFrame);placementFrame=0;overlayPlacement=null;placementDrag=null;$('viewport').classList.remove('is-inserting-overlay');$('addOverlay').setAttribute('aria-pressed','false');$('addOverlay').title=T('插入标注');$('quickInsertText')?.setAttribute('aria-pressed','false');document.querySelector('[data-placement-preview]')?.remove();}
  function armOverlayPlacement(type){if(original)return;prepareTouchEditing();inlineEditor?.finish(true);cancelOverlayPlacement();overlayPlacement=type;$('overlayType').value=type;layoutMode=false;boxSelect=false;syncCanvasModes();$('viewport').classList.add('is-inserting-overlay');$('addOverlay').setAttribute('aria-pressed','true');$('addOverlay').title=T('点击画布放置；Esc 取消');$('quickInsertText')?.setAttribute('aria-pressed',String(type==='text'));say(T(type==='text'?'点击画布任意位置输入文字；Esc 取消。':type==='line'?'点击或拖动画水平线；拖动两端调整长度。Esc 取消。':type==='lineVertical'?'点击或拖动画垂直线；拖动两端调整长度。Esc 取消。':type==='lineFree'?'拖动画线；靠近水平或垂直自动吸附，Shift 固定方向。Esc 取消。':type==='bracket'?'拖动设置比较括号的宽度；文字可单独插入。Esc 取消。':'在画布中拖动绘制形状；Esc 取消。'));}
  function insertOverlay(tool,cell=null,geometry=null){const type=tool.startsWith('line')?'line':tool,direction=tool==='lineVertical'?'vertical':tool==='lineFree'?'free':'horizontal',next=copy(state()),l=layout(),box=cell?l.cells.find(c=>c.row===cell.row&&c.col===cell.col):l.positions.find(p=>p.id===selectedPanel),point=geometry||{x:(box?box.x+box.width*.15:l.width*.3)/l.width,y:(box?box.y+box.height*.2:l.height*.3)/l.height},mapped=overlayInsertionGeometry(l,{...point,w:geometry?.w??(direction==='vertical'?0:.15),h:geometry?.h??(type==='bracket'?5/currentOutput().scale/l.height:type==='line'?(direction==='vertical'?.15:0):.08)},box?.id||selectedPanel);const x=Math.max(0,Math.min(.999,mapped.x)),y=Math.max(0,Math.min(.999,mapped.y));const a={id:'annotation-'+Date.now(),type,x,y,w:Math.min(mapped.w,1-x),h:Math.min(mapped.h,1-y),text:type==='text'?T('文本'):'',font:'Arial',size:10/currentOutput().scale,stroke:1/currentOutput().scale,color:'#253247',opacity:1,fill:false,bold:false,locked:false};if(type==='line'){a.direction=direction;if(geometry?.reverseY)a.reverseY=true;}next.overlays=[...(next.overlays||[]),a];selectedAnnotations=[a.id];selected=[];elementSelections=[];selectedPanelLabel=null;activePane='annotation';commit(next,T('已插入标注'));if(type==='text')requestAnimationFrame(()=>startInlineTextEdit($('artboard').querySelector(`[data-annotation="${a.id}"] text`),true));return a.id;}
  function placementGeometry(drag,event){
    const {type,point,rect}=drag,anchor={x:point.x*rect.width,y:point.y*rect.height},end={x:Math.max(0,Math.min(rect.width,event.clientX-rect.left)),y:Math.max(0,Math.min(rect.height,event.clientY-rect.top))};
    if(type.startsWith('line'))return overlayLineGeometry(anchor,end,rect,type==='lineVertical'?'vertical':type==='lineFree'?'free':'horizontal',event.shiftKey);
    if(type==='bracket')return {x:Math.min(anchor.x,end.x)/rect.width,y:point.y,w:Math.max(.001,Math.abs(end.x-anchor.x)/rect.width),h:Math.min(1-point.y,drag.depth)};
    return {x:Math.min(anchor.x,end.x)/rect.width,y:Math.min(anchor.y,end.y)/rect.height,w:Math.max(.001,Math.abs(end.x-anchor.x)/rect.width),h:Math.max(.001,Math.abs(end.y-anchor.y)/rect.height)};
  }
  function paintPlacementPreview(){
    placementFrame=0;const drag=placementDrag;if(!drag||drag.type==='text')return;const rect=drag.rect,g=placementGeometry(drag,drag.last),x=g.x*rect.width,y=g.y*rect.height,w=g.w*rect.width,h=g.h*rect.height;let ghost=document.querySelector('[data-placement-preview]');
    if(!ghost){ghost=document.createElementNS(NS,'svg');ghost.dataset.placementPreview='true';ghost.setAttribute('class','overlay-placement-preview');Object.assign(ghost.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});ghost.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);const shape=document.createElementNS(NS,drag.type.startsWith('line')?'line':drag.type==='bracket'?'path':drag.type);ghost.append(shape);document.body.append(ghost);}
    const shape=ghost.firstChild,attrs=drag.type.startsWith('line')?{x1:x,y1:y+(g.reverseY?h:0),x2:x+w,y2:y+(g.reverseY?0:h)}:drag.type==='bracket'?{d:`M ${x} ${y+h} V ${y} H ${x+w} V ${y+h}`} :drag.type==='ellipse'?{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2}:{x,y,width:w,height:h};
    for(const [key,value]of Object.entries(attrs))shape.setAttribute(key,value);shape.setAttribute('fill','none');shape.setAttribute('stroke','#526e9e');shape.setAttribute('stroke-width','1.5');shape.setAttribute('stroke-linecap','round');
  }
  function startInlineTextEdit(node,selectAll=false){
    if(!node||original||typeof richTextTarget!=='function')return;inlineEditor?.finish(true);
    const overlay=node.closest('[data-annotation]'),label=node.closest('[data-panel-label]'),pan=node.closest('[data-panel]'),text=node.closest('text[data-key]')||node;
    if(overlay){selectedAnnotations=[overlay.dataset.annotation];selected=[];elementSelections=[];selectedPanelLabel=null;activePane='annotation';}
    else if(label){selectedAnnotations=[];selected=[];elementSelections=[];selectedPanelLabel=label.dataset.panelLabel;selectedPanel=selectedPanelLabel;}
    else if(pan&&text.dataset.key){selectedAnnotations=[];selectedPanelLabel=null;setElementSelection([{id:pan.dataset.panel,vi:state().panels[pan.dataset.panel].variant,keys:[text.dataset.key]}]);activePane='detail';}
    else return;
    const target=richTextTarget();if(!target||target.locked)return;const rect=node.getBoundingClientRect(),style=getComputedStyle(node),editor=document.createElement('textarea');editor.className='canvas-text-editor';editor.setAttribute('aria-label',T('画布文字编辑'));editor.value=target.text;editor.maxLength=2000;editor.style.left=Math.min(window.innerWidth-180,Math.max(0,rect.left))+'px';editor.style.top=Math.min(window.innerHeight-60,Math.max(0,rect.top))+'px';editor.style.width=Math.min(450,Math.max(180,rect.width+30))+'px';editor.style.height=Math.max(46,Math.min(200,rect.height+26))+'px';editor.style.fontFamily=style.fontFamily;editor.style.fontSize=Math.max(14,Math.min(24,parseFloat(style.fontSize)||14))+'px';editor.title=T('Enter 完成，Shift + Enter 换行，Esc 取消');
    let finished=false;const finish=save=>{if(finished)return;finished=true;inlineEditor=null;editor.remove();if(save&&editor.value!==target.text)changeRichText(editor.value,target);else renderSelectionProperties();};inlineEditor={finish,element:editor,target};editor.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();finish(false);}else if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();finish(true);}};editor.onblur=()=>finish(true);editor.onpointerdown=e=>e.stopPropagation();document.body.append(editor);editor.focus();if(selectAll)editor.select();else editor.setSelectionRange(editor.value.length,editor.value.length);renderRichTextControls();
  }
  $('addOverlay').onclick=()=>armOverlayPlacement($('overlayType').value);
  $('overlayType').onchange=()=>armOverlayPlacement($('overlayType').value);
  $('overlayLineDirection').onchange=()=>{const next=copy(state()),space=overlayEditingSpace(layout());for(const a of next.overlays||[])if(a.type==='line'&&selectedAnnotations.includes(a.id)&&!a.locked)Object.assign(a,orientOverlayLine(a,$('overlayLineDirection').value,space));commit(next,T('已调整直线方向'));};
  $('editOverlayText').onclick=()=>{const id=selectedAnnotations[0];if(id)startInlineTextEdit($('artboard').querySelector(`[data-annotation="${id}"] text`));};
  $('viewport').addEventListener('pointerdown',e=>{placementClickPending=false;if(!overlayPlacement||e.button!==0||e.target.closest('button,input,select,textarea'))return;const svg=$('artboard').querySelector('svg'),rect=svg?.getBoundingClientRect();if(!rect)return;e.preventDefault();e.stopImmediatePropagation();window.getSelection()?.removeAllRanges();const point={x:Math.max(0,Math.min(.999,(e.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(.999,(e.clientY-rect.top)/rect.height))};placementDrag={type:overlayPlacement,point,rect,depth:overlayPlacement==='bracket'?5/currentOutput().scale/layout().height:0,screen:{x:e.clientX,y:e.clientY},last:e,pointerId:e.pointerId};$('viewport').setPointerCapture(e.pointerId);paintPlacementPreview();},true);
  $('viewport').addEventListener('pointermove',e=>{if(!placementDrag)return;if(e.buttons===0){cancelOverlayPlacement();return;}e.preventDefault();e.stopImmediatePropagation();placementDrag.last=e;if(!placementFrame)placementFrame=requestAnimationFrame(paintPlacementPreview);},true);
  $('viewport').addEventListener('pointerup',e=>{if(!placementDrag)return;e.preventDefault();e.stopImmediatePropagation();const drag=placementDrag,{type,point,screen}=drag,moved=Math.hypot(e.clientX-screen.x,e.clientY-screen.y)>3,geometry=moved&&type!=='text'?placementGeometry(drag,e):point,visibleGeometry=(type.startsWith('line')||type==='bracket')&&geometry.w!==undefined&&Math.hypot(geometry.w*drag.rect.width,(type==='bracket'?0:geometry.h)*drag.rect.height)<3?point:geometry;cancelOverlayPlacement();placementClickPending=true;insertOverlay(type,null,visibleGeometry);},true);
  // The click generated after pointer-up must not deselect the newly inserted
  // object or steal focus from its inline text editor.
  $('viewport').addEventListener('click',e=>{if(!placementClickPending)return;placementClickPending=false;e.preventDefault();e.stopImmediatePropagation();},true);
  $('viewport').addEventListener('pointercancel',()=>cancelOverlayPlacement(),true);
  $('viewport').addEventListener('lostpointercapture',()=>{if(placementDrag)cancelOverlayPlacement();},true);
  window.addEventListener('blur',()=>{if(placementDrag)cancelOverlayPlacement();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlayPlacement){e.preventDefault();e.stopImmediatePropagation();cancelOverlayPlacement();say(T('已取消插入'));}},true);
  const updateOverlay=(previewOnly=false)=>{const next=copy(state());for(const a of next.overlays||[])if(selectedAnnotations.includes(a.id)&&!a.locked){Object.assign(a,{font:$('overlayFont').value,size:+$('overlaySize').value/currentOutput().scale,color:$('overlayColor').value,stroke:+$('overlayStroke').value/currentOutput().scale,opacity:+$('overlayOpacity').value,fill:$('overlayFill').checked,bold:$('overlayBold').checked});if(a.type==='text'&&selectedAnnotations.length===1)a.text=$('overlayText').value;}if(previewOnly){try{validateState(next,project);renderCanvas(next);}catch{}}else commit(next,T('已更新标注'));};
  $('applyOverlay').onclick=()=>updateOverlay();
  $('overlayOpacity').oninput=()=>updateOverlay(true);
  for(const id of ['overlayFont','overlaySize','overlayColor','overlayStroke','overlayOpacity','overlayFill','overlayBold'])$(id).onchange=()=>$('applyOverlay').click();
  for(const [id,value]of [['lockOverlay',true],['unlockOverlay',false]])$(id).onclick=()=>{const next=copy(state());for(const a of next.overlays||[])if(selectedAnnotations.includes(a.id))a.locked=value;commit(next,T(value?'已锁定所选内容':'已解锁所选内容'));};
  $('deleteOverlay').onclick=()=>{const next=copy(state());next.overlays=(next.overlays||[]).filter(a=>!selectedAnnotations.includes(a.id)||a.locked);commit(next,T('已删除未锁定标注'));};
  $('chartGoal').onchange=renderInspectorPreviews;$('topCount').onchange=renderInspectorPreviews;
  const templatePreviews=JSON.parse($('templatePreviews').textContent);
  const templateStarters=JSON.parse($('templateStarters').textContent);
  let catalogueCategory='current',catalogueStartMode=false,catalogueSearchTimer=null;
  function chartLibraryNames(available,query){return (!query&&catalogueCategory==='current'?[...available.keys()]:[...new Set([...available.keys(),...Object.keys(StudioDiscovery),...StudioCatalogue.names])].filter(name=>query||StudioCatalogue.category(name)===catalogueCategory)).filter(name=>!catalogueStartMode||templateStarters[name]).filter(name=>name!=='blank_canvas').filter(name=>!query||[name,chartName(name),...Object.values(StudioDiscovery[name]||{}).flat()].join(' ').toLocaleLowerCase().includes(query));}
  function renderChartLibrary(){
    clearTimeout(catalogueSearchTimer);
    const pan=panel(selectedPanel),ranked=StudioCatalogue.rank(pan,$('chartGoal').value),available=new Map(ranked.map(x=>[x.v.name,x]));$('chartCategories').replaceChildren();
    const categories={...(catalogueStartMode?{}:{current:[T('当前数据可用'),T('当前数据可用')]}),...StudioCatalogue.labels};
    for(const [key,names]of Object.entries(categories)){const b=button(names[StudioI18n.language==='en'?1:0],()=>{catalogueCategory=key;$('chartSearch').value='';renderChartLibrary();});b.setAttribute('aria-pressed',String(!$('chartSearch').value.trim()&&catalogueCategory===key));$('chartCategories').append(b);}
    const query=$('chartSearch').value.trim().toLocaleLowerCase(),language=StudioI18n.language==='en'?'en':'zh';
    $('allCharts').replaceChildren();const names=chartLibraryNames(available,query);
    for(const name of names){const entry=StudioDiscovery[name]?.[StudioI18n.language],candidate=available.get(name),card=document.createElement('article');card.className='catalogue-card';const heading=document.createElement('h3');heading.textContent=entry?.[0]||chartName(name);card.append(heading);const badge=document.createElement('span');badge.className='preview-badge';badge.textContent=T(candidate?'当前数据':templatePreviews[name]?'示例数据':'样式示意');card.append(badge);
      if(candidate){const choose=button('',guard(async()=>{$('chartLibrary').close();await activateVariant(candidate.i);}));choose.className='chart-choice';choose.setAttribute('aria-label',T('选择样式：')+chartName(name));choose.append(preview(editedSvg(selectedPanel,candidate.i)));choose.disabled=state().panels[selectedPanel].locked;card.append(choose);}else{const sample=templatePreviews[name]||StudioCatalogue.schematic(name);if(sample){const thumb=preview(sanitize(sample));thumb.classList.add('template-thumbnail');card.append(thumb);}if(templateStarters[name]){const start=button(T('使用示例开始'),guard(async()=>{const destination=selectedPanel,projectId=project.id;start.disabled=true;try{const starter=templateStarters[name];const response=await engineFetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify(starter)});const result=await response.json();if(!response.ok)throw Error(result.error);if(project.id!==projectId||!state().order.includes(destination))throw Error(T('目标已变化，请重新选择导入位置'));result.panel.name=name;result.panel.provenance='synthetic-template';installAsset(result.panel,destination,null,T('已载入示例；请替换为自己的数据'));$('chartLibrary').close();showPane('data');}finally{start.disabled=false;}}));start.disabled=!localEngine||state().panels[selectedPanel].locked;card.append(start);}else{const unavailable=button(T('查看所需数据'),()=>{description.scrollIntoView({block:'nearest'});description.classList.add('requirements-active');});card.append(unavailable);}}
      const description=document.createElement('p');description.textContent=(candidate?T('当前数据可用'):T('需要相应数据或计算结果'))+' · '+(entry?entry.slice(1).join(' — '):T('请查看分析记录'));card.append(description);
      if(card.querySelector('svg')){const enlarge=button(T('放大预览'),()=>{$('chartDetailTitle').textContent=heading.textContent;$('chartDetailBadge').textContent=badge.textContent;$('chartDetailDescription').textContent=description.textContent;$('chartDetailArt').replaceChildren(namespace(card.querySelector('svg').cloneNode(true)));$('chartDetail').showModal();});enlarge.className='preview-enlarge';enlarge.setAttribute('aria-label',T('放大预览')+' · '+heading.textContent);card.append(enlarge);}
      $('allCharts').append(card);
    }
    $('chartCount').textContent=T('{0} 个图表样式',names.length);
    if(!names.length){const empty=document.createElement('p');empty.textContent=T('没有匹配的图表，请调整搜索词或类别。');$('allCharts').append(empty);}
  }
  $('closeChartDetail').onclick=()=>$('chartDetail').close();
  $('chartSearch').oninput=()=>{clearTimeout(catalogueSearchTimer);catalogueSearchTimer=setTimeout(renderChartLibrary,150);};$('chartSearch').onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();renderChartLibrary();}};
  $('moreCharts').onclick=()=>{catalogueStartMode=false;catalogueCategory=panel(selectedPanel).provenance==='blank-canvas'?'distribution':'current';$('chartSearch').value='';renderChartLibrary();$('chartLibrary').showModal();};$('closeCharts').onclick=()=>$('chartLibrary').close();$('chartLibrary').addEventListener('close',()=>clearTimeout(catalogueSearchTimer));
  let dataDrafts={},dataPage=0,dataTimer=null,dataBusy=false,dataSerial=0;
  const localEngine=$('local-engine')?JSON.parse($('local-engine').textContent):null;
  let engineConnection='connected',engineRefreshPromise=null;
  function engineConnectionText(kind=engineConnection){if(localEngine?.mode==='browser')return T('设备内计算暂不可用。工程与数据草稿已保留，请重试初始化。');return T(kind==='authorization'?'本机服务已重新启动。工程与数据草稿已保留；请重新连接后继续。':'本机绘图服务连接中断。工程与数据草稿已保留；请打开编辑器服务后重新连接。');}
  function renderConnectionNotice(){
    let notice=$('engineConnectionNotice');if(engineConnection==='connected'){if(notice)notice.hidden=true;return;}
    if(!notice){notice=document.createElement('div');notice.id='engineConnectionNotice';notice.className='engine-connection-notice';notice.setAttribute('role','status');const text=document.createElement('span'),retry=document.createElement('button');text.id='engineConnectionMessage';retry.id='reconnectEngine';retry.type='button';retry.onclick=async()=>{retry.disabled=true;try{await refreshEngineConnection();setEngineConnection('connected');say(T('已重新连接。工程与草稿保持不变，请继续刚才的操作。'));}catch(error){say(error.message);}finally{retry.disabled=false;}};notice.append(text,retry);$('viewport').before(notice);}
    notice.hidden=false;$('engineConnectionMessage').textContent=engineConnectionText();$('reconnectEngine').textContent=T('重新连接');
    if($('dataEngineStatus'))$('dataEngineStatus').textContent=engineConnectionText();
  }
  function setEngineConnection(kind){engineConnection=kind;renderConnectionNotice();if(kind==='connected'&&$('dataEngineStatus')&&dataRows())$('dataEngineStatus').textContent=T('本机计算已连接 · 数据不会上传到外部服务');}
  function engineConnectionError(kind){setEngineConnection(kind);const error=new Error(engineConnectionText(kind));error.connection=true;return error;}
  async function refreshEngineConnection(){
    if(engineRefreshPromise)return engineRefreshPromise;
    engineRefreshPromise=(async()=>{
      if(localEngine?.mode==='browser'){
        if(!globalThis.StudioBrowserEngine)throw engineConnectionError('offline');
        try{await globalThis.StudioBrowserEngine.ready();return localEngine;}catch{throw engineConnectionError('offline');}
      }
      if(!localEngine||location.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(location.hostname))throw engineConnectionError('authorization');
      let response;try{response=await fetch(new URL('/',location.href).href,{cache:'no-store',credentials:'same-origin'});}catch{throw engineConnectionError('offline');}
      if(!response.ok)throw engineConnectionError('authorization');
      const documentCopy=new DOMParser().parseFromString(await response.text(),'text/html');let fresh;try{fresh=JSON.parse(documentCopy.querySelector('#local-engine')?.textContent||'null');}catch{}
      if(!fresh||typeof fresh.token!=='string'||fresh.token.length<20||fresh.endpoint!=='/api/render'||Object.entries(fresh).some(([key,value])=>key.endsWith('Endpoint')&&!['/api/reflow','/api/analyze','/api/split-facets','/api/import-pdf','/api/image-duplicates'].includes(value)))throw engineConnectionError('authorization');
      localEngine.token=fresh.token;return fresh;
    })();try{return await engineRefreshPromise;}finally{engineRefreshPromise=null;}
  }
  async function engineFetch(endpoint,options){
    // Browser previews calculate in their local worker. A missing or failed worker
    // must never fall back to posting scientific data to the hosting server.
    if(localEngine?.mode==='browser'){
      if(!globalThis.StudioBrowserEngine)throw engineConnectionError('offline');
      let response;try{response=await globalThis.StudioBrowserEngine.fetch(endpoint,options);}catch{throw engineConnectionError('offline');}
      if(globalThis.StudioBrowserEngine.status().phase==='error')setEngineConnection('offline');
      else if(response.ok)setEngineConnection('connected');
      return response;
    }
    let response;try{response=await fetch(endpoint,options);}catch{throw engineConnectionError('offline');}
    if(response.status===403&&['/api/render','/api/reflow','/api/analyze','/api/split-facets','/api/import-pdf'].includes(endpoint)){
      let rejection;try{rejection=await response.clone().json();}catch{}
      if(rejection?.error==='Local editor authorization required'){
        const previous=options.headers?.['X-Studio-Token'];if(localEngine.token===previous)await refreshEngineConnection();
        // Only a newly issued token may retry a refused request. An unchanged
        // token does not hide Host/Origin rejection, and there is no retry loop.
        if(localEngine.token===previous)throw engineConnectionError('authorization');
        try{response=await fetch(endpoint,{...options,headers:{...options.headers,'X-Studio-Token':localEngine.token}});}catch{throw engineConnectionError('offline');}
        if(response.status===403)throw engineConnectionError('authorization');
      }
    }
    if(response.ok)setEngineConnection('connected');return response;
  }

  let statisticsSession=null,statisticsRequest=0,statisticsTimer=null;
  const statisticFieldIds=['statisticsGroup','statisticsValue','statisticsUnit','statisticsFacet','statisticsFilter','statisticsGroupA','statisticsGroupB','statisticsPValue','statisticsResultFacet'];
  const statisticsMethods={
    welch:['Welch t 检验','比较两组平均水平；允许两组波动大小不同。','小样本需关注严重偏态或极端值。'],
    mannwhitney:['Mann–Whitney U 检验','比较两组数值的排序和分布，也适合独立等级评分。','不是通用的中位数检验；分布形状影响解释。'],
    paired_t:['配对 t 检验','比较同一样本前后／不同条件下的平均变化。','小样本需关注配对差值的分布与极端值。'],
    wilcoxon:['Wilcoxon 符号秩检验','比较同一样本的配对差值，使用差值的符号和排序。','位置差异的解释要求配对差值分布对称。']
  };
  function statisticsRows(){return $('statisticsSource').value==='current'?panel(statisticsSession.id).table?.rows:parseDelimited($('statisticsTable').value.trim(),$('statisticsTable').value.includes('\t')?'\t':',');}
  function statisticsProfile(){let rows=[];try{rows=statisticsRows()||[];}catch{}return statisticsDataProfile(rows,{group:$('statisticsGroup').value,value:$('statisticsValue').value,unit:$('statisticsUnit').value==='__row__'?'':$('statisticsUnit').value});}
  function statisticsColumns(restore={}){
    const mode=$('statisticsSource').value,external=mode!=='current';$('statisticsExternal').hidden=!external;$('statisticsRawFields').hidden=mode==='results';$('statisticsResultsFields').hidden=mode!=='results';
    let rows;try{rows=statisticsRows()||[];}catch{rows=[];}
    const header=rows[0]||[],profile=statisticsDataProfile(rows),suggestions={statisticsGroup:[profile.group],statisticsValue:[profile.value],statisticsUnit:[profile.unit],statisticsFacet:['factor','facet'],statisticsGroupA:['group_a','a'],statisticsGroupB:['group_b','b'],statisticsPValue:['p_value','p_adjusted','p'],statisticsResultFacet:['facet','stratum']};
    for(const field of statisticFieldIds){const el=$(field),previous=el.value;el.replaceChildren(new Option(T('请选择列'),''));if(field==='statisticsUnit')el.add(new Option(T('每行一个独立样本（无编号列）'),'__row__'));for(const name of header)el.add(new Option(name,name));const suggest=(suggestions[field]||[]).find(n=>header.includes(n)),restored=restore[field];el.value=Object.hasOwn(restore,field)?(restored===''||header.includes(restored)||restored==='__row__'?restored:suggest||''):header.includes(previous)||field==='statisticsUnit'&&previous==='__row__'?previous:suggest||'';}
    if(!$('statisticsUnit').value&&!profile.unit)$('statisticsUnit').value='__row__';
    $('statisticsDataSummary').textContent=header.length?T('{0} 条记录 · {1} 列',Math.max(0,rows.length-1),header.length):T('请连接包含组别、数值及实验单位编号的数据表，或导入已有比较结果。');
    if(!$('statisticsOutcome').value)$('statisticsOutcome').value=statisticsProfile().kind;
    statisticsControls();
  }
  function statisticsReadyReason(){
    if(!localEngine)return T('请使用本机编辑器启动此工程，以连接统计分析。');
    if(!statisticsSession)return '';
    if(dataDrafts[statisticsSession.id])return T('请先完成当前数据的更新，再进行统计分析。');
    if($('statisticsSource').value==='results')return $('statisticsResultsConfirmed').checked?'':T('确认已有结果与当前图形的对应关系后，即可预览。');
    const profile=statisticsProfile(),kind=$('statisticsOutcome').value,design=$('statisticsDesign').value;
    if(!profile.group||!profile.value)return T('请展开数据列设置，选择组别列和测量值列。');
    if(!profile.validNumeric&&!['categorical','survival'].includes(kind))return T('测量值列含空白或非数值，请检查数据；不会自动删除记录。');
    if(!kind)return T('请确认这些数值是测量值、等级评分，还是其他类型。');
    if(!['continuous','ordinal'].includes(kind))return T('此数据类型需要专门方法，请连接相应分析的比较结果。');
    if(profile.groups.length<2)return T('需要至少两个组别才能比较。');
    if(!design)return T('请选择比较的是同一批样本，还是不同样本。');
    if(kind==='ordinal'&&design==='paired')return T('配对等级评分需要专门方法，请连接相应分析的比较结果。');
    if(design==='paired'&&$('statisticsUnit').value==='__row__')return T('请展开数据列设置，选择真实样本编号；不能按行号猜测配对。');
    if(!$('statisticsUnit').value)return T('请选择样本编号列。');
    if(!$('statisticsUnitConfirmed').checked)return T('请确认一个编号／一行代表一个真实样本。');
    return '';
  }
  function statisticsControls(){
    const design=$('statisticsDesign').value,kind=$('statisticsOutcome').value,goal=$('statisticsGoal').value,prior=$('statisticsMethod').value,method=$('statisticsMethod'),profile=statisticsProfile(),choices=statisticsMethodChoices(design,goal,kind);method.replaceChildren(new Option('',''));choices.forEach(key=>method.add(new Option(T(statisticsMethods[key][0]),key)));if(choices.includes(prior))method.value=prior;
    const mapping=[profile.group&&T('组别：{0}',profile.group),profile.value&&T('数值：{0}',profile.value),profile.groups.length&&T('{0} 组',profile.groups.length)].filter(Boolean);$('statisticsMappingSummary').textContent=mapping.join(' · ')||T('请展开数据列设置，选择组别列和测量值列。');
    $('statisticsGoalLabel').hidden=kind==='ordinal';
    $('statisticsUnitConfirmation').textContent=T($('statisticsUnit').value==='__row__'?'每一行是一个不同的独立样本（患者、动物等），不是同一样本的重复读数。':'每个编号代表一个独立样本（患者、动物等）；同一样本的重复读数已汇总。');
    const reason=statisticsReadyReason();$('statisticsInspectData').hidden=$('statisticsSource').value!=='current'||(!dataDrafts[statisticsSession?.id]&&profile.validNumeric&&!statisticsSession?.failure);$('statisticsReadyHint').textContent=reason||T('选择一种方法即可计算；应用前可自由切换标注样式。');$('runStatistics').disabled=!!reason||!!statisticsSession?.busy||($('statisticsSource').value!=='results'&&!method.value);
    $('statisticsMethodCards').replaceChildren();choices.forEach((key,index)=>{const card=button('',()=>{$('statisticsMethod').value=key;statisticsInvalidate(false);statisticsControls();runStatisticsPreview();});card.className='statistics-method-card';card.disabled=!!reason;card.setAttribute('aria-pressed',String(method.value===key));card.setAttribute('aria-label',T(statisticsMethods[key][0]));const rank=document.createElement('span');rank.className='statistics-rank';rank.textContent=T(index===0?'首选 · 按数据类型与比较目标':'备选 · 回答不同的比较问题');const name=document.createElement('strong');name.textContent=T(statisticsMethods[key][0]);const detail=document.createElement('small');detail.textContent=T(statisticsMethods[key][1]);const condition=document.createElement('small');condition.textContent=T(statisticsMethods[key][2]);card.append(rank,name,detail,condition);$('statisticsMethodCards').append(card);});
    const specialist={binary:'二分类结局：独立组可考虑 Fisher 精确检验／卡方检验；两条件配对数据可考虑 McNemar 检验。请连接已完成的相应比较结果。',count:'事件计数：可考虑 Poisson／负二项模型，并确认观察时长与数据变异。请连接已完成的相应比较结果。',survival:'生存结局：需生存时间和事件／删失状态，可考虑 log-rank 检验或 Cox 模型。请连接已完成的相应比较结果。',categorical:'分类结局：需按类别频数选择列联表检验或分类模型。请连接已完成的相应比较结果。'};
    $('statisticsMethodNote').textContent=choices.length?T('推荐不按 P 值排序。多组时执行两两比较，并统一进行 Holm 校正。'):T(specialist[kind]||reason);
    $('statisticsImportResults').hidden=!(['binary','count','survival','categorical'].includes(kind)||kind==='ordinal'&&design==='paired');
    $('statisticsControlLabel').hidden=$('statisticsFamily').value!=='control';const control=$('statisticsControl'),chosen=control.value;control.replaceChildren();for(const value of profile.groups)control.add(new Option(value,value));if([...control.options].some(o=>o.value===chosen))control.value=chosen;
    $('statisticsResultControlLabel').hidden=$('statisticsResultFamily').value!=='control';$('statisticsCorrectionLabel').hidden=$('statisticsAdjustment').value!=='already_adjusted';
  }
  function statisticsResultSummary(analysis){
    const region=$('statisticsRunStatus');region.replaceChildren();if(!analysis)return;for(const diagnostic of analysis.diagnostics||[]){const note=document.createElement('p');note.textContent=diagnostic[StudioI18n.language==='en'?'en':'zh'];region.append(note);}
    const precision=n=>Number(n.toPrecision(3)).toString();
    for(const set of analysis.facets||[analysis]){const info=statisticalComparisons(set);if(info.reason)continue;const heading=document.createElement('strong');heading.textContent=[set.label,T(statisticalMethodName(info.method))].filter(Boolean).join(' · ');region.append(heading);const table=document.createElement('table');table.className='statistics-result-table';const head=document.createElement('tr');for(const text of ['组间比较','样本量',analysis.correction==='none'?'P 值':'校正后的 P 值']){const th=document.createElement('th');th.textContent=T(text);head.append(th);}table.append(head);for(const c of info.comparisons){const row=document.createElement('tr'),label=document.createElement('td'),count=document.createElement('td'),number=document.createElement('td');label.textContent=`${info.order[c.a]} — ${info.order[c.b]}`;count.textContent=Number.isFinite(c.n_a)?`${c.n_a} / ${c.n_b}`:'—';const p=document.createElement('i');p.textContent='P';number.append(p,document.createTextNode(statisticalPText(c.p)));row.append(label,count,number);table.append(row);if(Number.isFinite(c.estimate)&&Array.isArray(c.ci95)){const effect=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=3;cell.textContent=T('均值差（后组 − 前组）：{0}；95% CI：{1} 至 {2}',precision(c.estimate),precision(c.ci95[0]),precision(c.ci95[1]));effect.append(cell);table.append(effect);}}region.append(table);}
    const footnote=document.createElement('p');footnote.className='muted';footnote.hidden=!(analysis.facets||[analysis]).some(set=>(set.primary_test?.pairwise||[]).some(c=>Array.isArray(c.ci95)));footnote.textContent=T('均值差的 95% CI 为单项区间，未作多重比较校正。P 值不能代替差异大小与实际意义。');region.append(footnote);
  }
  function statisticsInvalidate(clearMethod=false){
    clearTimeout(statisticsTimer);statisticsRequest++;if(statisticsSession){statisticsSession.pending=null;statisticsSession.busy=false;statisticsSession.failure=false;}if(clearMethod)$('statisticsMethod').value='';$('applyStatistics').disabled=true;$('statisticsPreviewStyleControls').hidden=true;$('statisticsPreviewBadge').textContent='';$('statisticsRunStatus').replaceChildren();$('statisticsPreview').replaceChildren();const p=document.createElement('p');p.textContent=T('选择方法后，这里显示当前图形的真实分析结果。');$('statisticsPreview').append(p);
  }
  function openStatistics(style='p'){
    if(state().panels[selectedPanel].locked)return;statisticsRequest++;statisticsSession={id:selectedPanel,projectId:project.id,source:panel(selectedPanel),style,serial:dataSerial,pending:null};
    const record=state().panels[selectedPanel].statistics,config=record?.config||{};$('statisticsPanelName').textContent=StudioI18n.panelName(panel(selectedPanel));const profile=statisticsDataProfile(panel(selectedPanel).table?.rows||[]);$('statisticsSource').value=record?.binding||(profile.group&&profile.value?'current':'results');$('statisticsTable').value=record?.inputRows?record.inputRows.map(r=>r.join('\t')).join('\n'):'';
    $('statisticsDesign').value=config.design||'';$('statisticsOutcome').value=config.outcome_type||'';$('statisticsGoal').value=config.goal||'mean';$('statisticsFamily').value=style==='letters'?'all_pairs':config.family||'all_pairs';$('statisticsFilterValue').value=config.filter_value||'';$('statisticsUnitConfirmed').checked=!!config.design_confirmed&&!record?.stale;$('statisticsResultsConfirmed').checked=!!config.results_confirmed&&!record?.stale;
    $('statisticsResultFamily').value=config.family||'all_pairs';$('statisticsResultControl').value=config.control||'';$('statisticsAdjustment').value=config.adjustment||'';$('statisticsResultMethod').value=config.method_label||'';$('statisticsCorrection').value=config.correction_method||'';
    const restore={};for(const [field,key]of Object.entries({statisticsGroup:'group',statisticsValue:'value',statisticsUnit:'unit',statisticsFacet:'facet',statisticsFilter:'filter_column',statisticsGroupA:'group_a',statisticsGroupB:'group_b',statisticsPValue:'p_value',statisticsResultFacet:'facet'}))if(Object.hasOwn(config,key))restore[field]=config[key];if(config.unit_mode==='row')restore.statisticsUnit='__row__';
    statisticsColumns(restore);if(config.method)$('statisticsMethod').value=config.method;if(config.control)$('statisticsControl').value=config.control;statisticsInvalidate();statisticsControls();$('statisticsMapping').open=!profile.group||!profile.value;$('statisticsPreviewStyle').value=['p','stars','hash','letters'].includes(style)?style:'p';
    $('statisticsOverrideNotice').hidden=!Object.values(state().panels[selectedPanel].edits||{}).some(edits=>Object.entries(edits).some(([key,props])=>/^e9\d{5,}$/.test(key)&&['text','offset-x','offset-y','stat-left','stat-right','stat-shape'].some(prop=>Object.hasOwn(props,prop))));
    if(!$('statisticsDialog').open)$('statisticsDialog').showModal();
    if(record&&!record.stale&&!statisticsReadyReason()&&(config.method||config.mode==='results'))runStatisticsPreview();
  }
  function statisticsConfig(){
    const mode=$('statisticsSource').value;
    if(mode==='results')return {mode:'results',group_a:$('statisticsGroupA').value,group_b:$('statisticsGroupB').value,p_value:$('statisticsPValue').value,...($('statisticsResultFacet').value?{facet:$('statisticsResultFacet').value}:{}),method_label:$('statisticsResultMethod').value.trim(),adjustment:$('statisticsAdjustment').value,correction_method:$('statisticsCorrection').value.trim(),results_confirmed:$('statisticsResultsConfirmed').checked,family:$('statisticsResultFamily').value,...($('statisticsResultFamily').value==='control'?{control:$('statisticsResultControl').value.trim()}:{})};
    const rowUnit=$('statisticsUnit').value==='__row__',config={mode:'raw',group:$('statisticsGroup').value,value:$('statisticsValue').value,unit:rowUnit?'':$('statisticsUnit').value,...(rowUnit?{unit_mode:'row'}:{}),outcome_type:$('statisticsOutcome').value,design:$('statisticsDesign').value,goal:$('statisticsOutcome').value==='ordinal'?'distribution':$('statisticsGoal').value,method:$('statisticsMethod').value,family:$('statisticsFamily').value,design_confirmed:$('statisticsUnitConfirmed').checked,unit_role:'independent_experimental_unit'};
    if($('statisticsFacet').value)config.facet=$('statisticsFacet').value;if(config.family==='control')config.control=$('statisticsControl').value;if($('statisticsFilter').value){config.filter_column=$('statisticsFilter').value;config.filter_value=$('statisticsFilterValue').value.trim();}return config;
  }
  function statisticsSessionValid(session,config){return statisticsSession===session&&project.id===session.projectId&&selectedPanel===session.id&&state().order.includes(session.id)&&!state().panels[session.id].locked&&panel(session.id)===session.source&&dataSerial===session.serial&&JSON.stringify(config)===JSON.stringify(statisticsConfig());}
  function statisticsPreviewState(session){
    const next=copy(state()),p=next.panels[session.id],pending=session.pending;p.statistics=copy(pending.record);delete p.methodChoice;
    const letters=(pending.record.analysis.facets||[pending.record.analysis]).every(set=>statisticalComparisons(set).letters),style=$('statisticsPreviewStyle').value;p.annotationStyle=style==='letters'&&!letters?'p':style;transferStatisticalStyleEdits(next,session.id,state(),true);clearStatisticalResultEdits(next,session.id,next);return next;
  }
  function renderStatisticsPreview(){
    const session=statisticsSession;if(!session?.pending)return;const next=statisticsPreviewState(session),svg=composite(false,true,next,session.id,true);svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('role','img');svg.setAttribute('aria-label',T('当前图形的统计标注预览'));$('statisticsPreview').replaceChildren(svg);$('statisticsPreviewStyleControls').hidden=false;$('statisticsPreviewBadge').textContent=T('预览 · 尚未应用');
    const letters=(session.pending.record.analysis.facets||[session.pending.record.analysis]).every(set=>statisticalComparisons(set).letters);for(const option of $('statisticsPreviewStyle').options)if(option.value==='letters')option.disabled=!letters;$('statisticsPreviewStyle').value=next.panels[session.id].annotationStyle;$('applyStatistics').disabled=false;
  }
  async function runStatisticsPreview(){
    const session=statisticsSession,reason=statisticsReadyReason();if(!session||reason){$('statisticsReadyHint').textContent=reason;return;}const config=statisticsConfig();if(config.mode==='raw'&&!config.method)return;const request=++statisticsRequest,binding=$('statisticsSource').value;session.pending=null;session.busy=true;session.failure=false;$('applyStatistics').disabled=true;$('runStatistics').disabled=true;$('statisticsPreviewBadge').textContent=T('正在计算…');$('statisticsRunStatus').textContent=T('正在计算比较结果…');
    try{
      const rows=copy(statisticsRows());if(!rows?.length)throw Error(T('请连接有效数据表。'));
      const response=await engineFetch(localEngine.analyzeEndpoint||'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe:session.source.recipe,rows,config})});const result=await response.json();if(!response.ok)throw Error(result.error);
      if(request!==statisticsRequest||statisticsSession!==session)return;
      if(!statisticsSessionValid(session,config))throw Error(T('数据或分析设置已变化，请重新分析。'));
      session.pending={config,record:{binding,tableKey:session.source.table?.sha256||'',config:result.config,analysis:result.analysis,data_sha256:result.data_sha256,...(binding!=='current'?{inputRows:rows}:{})}};statisticsResultSummary(result.analysis);renderStatisticsPreview();
    }catch(e){if(request===statisticsRequest&&statisticsSession===session){session.pending=null;session.failure=true;$('statisticsPreviewBadge').textContent=T('请检查数据');const parts=String(e.message).split(' / ');$('statisticsRunStatus').textContent=parts.length>1?(StudioI18n.language==='en'?parts.slice(1).join(' / '):parts[0]):e.message;}}
    finally{if(request===statisticsRequest&&statisticsSession===session){session.busy=false;statisticsControls();}}
  }
  $('closeStatistics').onclick=()=>$('statisticsDialog').close();$('statisticsDialog').addEventListener('close',()=>{clearTimeout(statisticsTimer);statisticsRequest++;statisticsSession=null;renderStatisticalAnnotations();});
  $('statisticsSource').onchange=()=>{statisticsInvalidate(true);$('statisticsOutcome').value='';$('statisticsUnitConfirmed').checked=false;$('statisticsResultsConfirmed').checked=false;statisticsColumns();};
  $('statisticsTable').oninput=()=>{statisticsInvalidate(true);$('statisticsUnitConfirmed').checked=false;$('statisticsResultsConfirmed').checked=false;$('statisticsOutcome').value='';clearTimeout(statisticsTimer);statisticsTimer=setTimeout(statisticsColumns,180);};
  for(const id of ['statisticsDesign','statisticsGoal','statisticsOutcome'])$(id).onchange=()=>{statisticsInvalidate(true);if(id!=='statisticsGoal')$('statisticsUnitConfirmed').checked=false;statisticsControls();};
  for(const id of [...statisticFieldIds,'statisticsFamily','statisticsMethod','statisticsAdjustment','statisticsResultFamily','statisticsControl','statisticsUnitConfirmed','statisticsResultsConfirmed','statisticsFilterValue','statisticsResultMethod','statisticsCorrection','statisticsResultControl'])$(id).onchange=()=>{statisticsInvalidate();statisticsControls();if($('statisticsMethod').value&&!statisticsReadyReason())runStatisticsPreview();};
  $('statisticsInspectData').onclick=()=>{const session=statisticsSession;if(!session||$('statisticsSource').value!=='current')return;const rows=dataDrafts[session.id]||session.source.table?.rows||[],value=rows[0]?.indexOf($('statisticsValue').value);let target=null;for(let r=1;r<rows.length&&!target;r++)for(const name of [$('statisticsGroup').value,$('statisticsValue').value,$('statisticsUnit').value]){const c=rows[0].indexOf(name);if(c>=0&&(String(rows[r][c]??'').trim()===''||c===value&&!Number.isFinite(Number(rows[r][c])))){target={r,c};break;}}$('statisticsDialog').close();showPane('data',false);dataPage=target?Math.floor((target.r-1)/20):0;renderDataEditor();if(target){const cell=$('editableData').querySelector(`[data-row="${target.r}"][data-column="${target.c}"]`);cell?.focus();cell?.scrollIntoView({block:'center',behavior:'smooth'});}};
  $('statisticsImportResults').onclick=()=>{$('statisticsSource').value='results';$('statisticsSource').onchange();};
  $('statisticsChooseFile').onclick=()=>{$('statisticsFile').value='';$('statisticsFile').click();};
  $('statisticsFile').onchange=guard(async()=>{const file=$('statisticsFile').files[0],session=statisticsSession;if(!file)return;if(file.size>2000000)throw Error(T('数据表不能超过 2 MB'));const content=await file.text();if(statisticsSession!==session)return;statisticsInvalidate(true);$('statisticsTable').value=content;$('statisticsOutcome').value='';$('statisticsUnitConfirmed').checked=false;$('statisticsResultsConfirmed').checked=false;statisticsColumns();});
  $('runStatistics').onclick=runStatisticsPreview;$('statisticsPreviewStyle').onchange=renderStatisticsPreview;
  $('applyStatistics').onclick=()=>{const session=statisticsSession;if(!session?.pending||!statisticsSessionValid(session,session.pending.config)){statisticsInvalidate();statisticsControls();$('statisticsRunStatus').textContent=T('数据或分析设置已变化，请重新分析。');return;}const next=statisticsPreviewState(session);if(commit(next,T('统计结果与标注已更新')))$('statisticsDialog').close();};
  function dataRows(){return dataDrafts[selectedPanel]||panel(selectedPanel)?.table?.rows;}
  function refreshDataExport(){const pending=exportBusy||Object.keys(dataDrafts).some(id=>state().order.includes(id));for(const id of ['export','png','tiff'])if($(id))$(id).disabled=pending;}
  function currentDataValidation(){return dataTableValidation(dataRows(),panel(selectedPanel)?.recipe||{},StudioGalleryContracts);}
  function dataErrorMessage(error){
    return T(({empty:'需要列名及至少一行数据。',size:'最多 100 列、10000 行数据。',header:'请填写列名。',duplicate:'列名重复，请使用唯一名称。',column:'缺少必需列：{0}',shape:'此行的列数与表头不一致。',extra:'此值没有对应列名，请补充列名或移除多余单元格。',length:'单元格不能超过 1000 个字符。',missing:'此单元格必须填写。',number:'请输入数字，例如 -2.5 或 1e-3，不要附带单位。'})[error.code],error.name);
  }
  function focusDataError(error){
    if(error.row===0||error.column<0){$('dataAdvanced').open=true;$('dataStructureMode').checked=true;}
    if(error.row>0)dataPage=Math.floor((error.row-1)/20);renderDataEditor();
    if(error.code==='column'){$('newColumnName').value=error.name;$('newColumnName').focus();$('dataAdvanced').scrollIntoView({block:'nearest'});return;}
    const input=$('editableData').querySelector(`[data-row="${Math.max(0,error.row)}"][data-column="${Math.max(0,error.column)}"]`);
    if(input){input.focus();input.scrollIntoView({block:'nearest',inline:'nearest'});}else $('dataAdvanced').scrollIntoView({block:'nearest'});
  }
  function paintDataValidation(focus=false){
    const result=currentDataValidation(),rows=dataRows(),locked=state().panels[selectedPanel]?.locked,lookup=new Map(result.errors.filter(e=>e.column>=0).map(e=>[`${e.row}:${e.column}`,e]));
    $('recomputeData').disabled=!rows||!localEngine||locked||dataBusy||!result.valid;
    $('dataContractHint').textContent=result.required.length?T('保留这些列名：{0}',result.required.join(' · ')):T('第一行为列名，每行代表一条记录。');
    $('dataValidationStatus').classList.toggle('has-errors',!result.valid);$('dataValidationStatus').textContent=!rows?'':result.valid?T('基础检查通过 · {0} 行，更新时继续检查模板规则。',result.rows):T('发现 {0} 处需要修改；点击下方提示定位。',result.errors.length);
    for(const input of $('editableData').querySelectorAll('input[data-row]')){const error=lookup.get(`${input.dataset.row}:${input.dataset.column}`),cell=input.parentElement;input.setAttribute('aria-invalid',String(!!error));input.title=error?dataErrorMessage(error):'';cell.classList.toggle('data-error-cell',!!error);cell.querySelector('.data-cell-error')?.remove();if(error){const hint=document.createElement('p');hint.className='data-cell-error';hint.id=`data-error-${input.dataset.row}-${input.dataset.column}`;hint.textContent=dataErrorMessage(error);input.setAttribute('aria-describedby',hint.id);cell.append(hint);}else input.removeAttribute('aria-describedby');}
    $('dataErrors').replaceChildren();for(const error of result.errors.slice(0,4)){const location=error.row>0?T('第 {0} 行 · {1}',error.row,rows?.[0]?.[error.column]||T('额外单元格')):T('表头'),control=button(location+' — '+dataErrorMessage(error),()=>focusDataError(error));$('dataErrors').append(control);}
    if(result.errors.length>4){const rest=document.createElement('span');rest.className='muted';rest.textContent=T('还有 {0} 处；修正后自动更新此列表。',result.errors.length-4);$('dataErrors').append(rest);}
    if(focus&&result.errors.length)focusDataError(result.errors[0]);return result;
  }
  function renderDataEditor(){
    const pan=panel(selectedPanel);if(!pan)return;const rows=dataRows(),locked=state().panels[selectedPanel]?.locked;
    $('dataEngineStatus').textContent=!rows?T('此图片没有原始数据表；不能从像素推断实验数据。'):localEngine?(engineConnection==='connected'?T('本机计算已连接 · 数据不会上传到外部服务'):engineConnectionText()):T('独立 HTML 可查看数据；请使用 Figure Studio 打开工程以更新图形。');
    for(const id of ['addDataRow','importData','pasteData','checkData','recomputeData','addDataColumn'])$(id).disabled=!rows||!localEngine||locked;
    $('discardData').disabled=!dataDrafts[selectedPanel];$('editableData').replaceChildren();$('editableData').classList.toggle('is-editing-structure',$('dataStructureMode').checked);refreshDataExport();if(!rows){$('dataPageInfo').textContent='';$('dataValidationStatus').textContent='';$('dataErrors').replaceChildren();$('dataContractHint').textContent='';return;}
    dataPage=Math.max(0,Math.min(dataPage,Math.ceil((rows.length-1)/20)-1));const start=1+dataPage*20,end=Math.min(rows.length,start+20),table=document.createElement('table'),head=document.createElement('tr'),columns=Math.min(100,Math.max(rows[0].length,...rows.slice(start,end).map(row=>row.length)));
    head.append(document.createElement('th'));for(let c=0;c<columns;c++){const name=rows[0][c]||'',th=document.createElement('th'),caption=document.createElement('span'),columnLabel=StudioGalleryContracts[pan.recipe?.parameters?.view]?.columns?.[name];caption.className='data-column-label';caption.textContent=columnLabel?.[StudioI18n.language==='en'?1:0]||name||T('额外列 {0}',c+1);th.title=name;const input=document.createElement('input');input.value=name;input.className='data-column-name data-structure-action';input.dataset.row=0;input.dataset.column=c;input.setAttribute('aria-label',T('第 {0} 列名称',c+1));input.disabled=locked||!localEngine;input.onchange=()=>{const changed=copy(dataRows());while(changed[0].length<=c)changed[0].push('');changed[0][c]=input.value;editData(changed);renderDataEditor();};const del=button('×',()=>{const changed=copy(dataRows());for(const row of changed)row.splice(c,1);editData(changed);renderDataEditor();});del.className='data-structure-action';del.title=T('删除此列');del.disabled=locked||!localEngine;th.append(caption,input,del);head.append(th);}table.append(head);
    for(let r=start;r<end;r++){const tr=document.createElement('tr'),label=document.createElement('td');label.textContent=String(r);const del=button('−',()=>{const changed=copy(dataRows());changed.splice(r,1);editData(changed);renderDataEditor();});del.className='data-structure-action';del.setAttribute('aria-label',T('删除第 {0} 行',r));del.disabled=locked||!localEngine;label.append(del);tr.append(label);for(let c=0;c<columns;c++){const td=document.createElement('td'),input=document.createElement('input');input.value=rows[r][c]??'';input.dataset.row=r;input.dataset.column=c;input.setAttribute('aria-label',T('第 {0} 行 · {1}',r,rows[0][c]||T('额外列 {0}',c+1)));input.disabled=locked||!localEngine;input.oninput=()=>{const changed=copy(dataRows());while(changed[r].length<=c)changed[r].push('');changed[r][c]=input.value;editData(changed);};input.onpaste=e=>{const text=e.clipboardData?.getData('text/plain');if(!text?.includes('\t')&&!text?.includes('\n'))return;try{const cells=parseDelimited(text,text.includes('\t')?'\t':',',true,1),changed=copy(dataRows());if(r+cells.length>10001||c+Math.max(...cells.map(row=>row.length))>100)return;e.preventDefault();for(let i=0;i<cells.length;i++){while(changed.length<=r+i)changed.push(changed[0].map(()=>''));for(let j=0;j<cells[i].length;j++){while(changed[r+i].length<=c+j)changed[r+i].push('');changed[r+i][c+j]=cells[i][j];}}editData(changed);renderDataEditor();}catch{}};td.append(input);tr.append(td);}table.append(tr);}
    $('editableData').append(table);$('dataPageInfo').textContent=T('{0}–{1} / {2} 行',start,end-1,rows.length-1);$('dataPrev').disabled=dataPage===0;$('dataNext').disabled=end>=rows.length;paintDataValidation();
  }
  let dataValidationTimer=null;
  function editData(rows){dataDrafts[selectedPanel]=rows;dataSerial++;$('dataEditStatus').textContent=T('数据已修改，等待重算；导出暂不可用');$('discardData').disabled=false;refreshDataExport();persist();clearTimeout(dataTimer);clearTimeout(dataValidationTimer);dataValidationTimer=setTimeout(()=>paintDataValidation(),100);if($('dataAutoUpdate').checked)dataTimer=setTimeout(recomputeData,650);}
  async function recomputeData(){
    if(dataBusy||!localEngine||!dataDrafts[selectedPanel])return;const id=selectedPanel,serial=dataSerial,projectId=project.id,rows=copy(dataDrafts[id]),source=panel(id),oldName=variant(id).name,oldSize=variant(id).size||'original',record=state().panels[id].statistics,statistics=record?.binding==='current'&&!record.stale?record.config:undefined,statisticsSnapshot=JSON.stringify(record);
    if(state().panels[id].locked)return;if(!paintDataValidation().valid){$('dataEditStatus').textContent=T('请修正标红单元格；原始输入与当前图形已保留。');return;}dataBusy=true;$('recomputeData').disabled=true;$('dataEditStatus').textContent=T('正在更新图形…');
    try{const response=await engineFetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe:source.recipe,rows,statistics})});const result=await response.json();if(!response.ok)throw Error(result.error);
      if(serial!==dataSerial||project.id!==projectId||!state().order.includes(id)||selectedPanel!==id||state().panels[id].locked||JSON.stringify(state().panels[id].statistics)!==statisticsSnapshot)return;
      const asset=result.panel;asset.name=source.name;asset.initialVariant=Math.max(0,asset.variants.findIndex(v=>v.name===oldName&&(v.size||'original')===oldSize));
      const focused=document.activeElement,focus=focused?.dataset.row?{row:focused.dataset.row,column:focused.dataset.column}:null;
      installAsset(asset,id,null,T('数据与图形已更新；可撤销'),true);delete dataDrafts[id];refreshDataExport();persist();
      $('dataEditStatus').textContent=T('已同步重算 · {0} 秒 · 原始版本仍可撤销',result.seconds);
      if(focus)$('editableData').querySelector(`[data-row="${focus.row}"][data-column="${focus.column}"]`)?.focus();
    }catch(e){if(serial===dataSerial){$('dataEditStatus').textContent=T('尚未应用：')+e.message;say(e.connection?e.message:T('当前图仍对应上次有效数据；请修正数据表。'));}}
    finally{dataBusy=false;if(project.id===projectId&&selectedPanel===id)paintDataValidation();if(serial!==dataSerial&&dataDrafts[selectedPanel]&&$('dataAutoUpdate').checked)dataTimer=setTimeout(recomputeData,100);}
  }
  $('addDataRow').onclick=()=>{const rows=copy(dataRows());rows.push(rows[0].map(()=>''));dataPage=Math.floor((rows.length-2)/20);editData(rows);renderDataEditor();};
  $('addDataColumn').onclick=()=>{const name=$('newColumnName').value.trim(),rows=copy(dataRows());if(!name||rows[0].includes(name))return;rows[0].push(name);for(const row of rows.slice(1))row.push('');editData(rows);renderDataEditor();};
  $('discardData').onclick=()=>{delete dataDrafts[selectedPanel];dataSerial++;clearTimeout(dataTimer);persist();renderDataEditor();$('dataEditStatus').textContent=T('已恢复上次有效数据');};
  $('recomputeData').onclick=()=>{if(!dataDrafts[selectedPanel]&&dataRows()){dataDrafts[selectedPanel]=copy(dataRows());dataSerial++;refreshDataExport();}recomputeData();};$('dataPrev').onclick=()=>{dataPage--;renderDataEditor();};$('dataNext').onclick=()=>{dataPage++;renderDataEditor();};
  $('checkData').onclick=()=>paintDataValidation(true);
  $('dataStructureMode').onchange=()=>renderDataEditor();
  $('dataAutoUpdate').onchange=()=>{clearTimeout(dataTimer);if($('dataAutoUpdate').checked&&dataDrafts[selectedPanel])recomputeData();};
  $('pasteData').onclick=()=>{$('dataPasteText').value='';$('dataPasteText').placeholder=(dataRows()?.[0]||[]).join('\t');$('dataPasteStatus').textContent='';$('dataPasteDialog').showModal();$('dataPasteText').focus();};
  $('closeDataPaste').onclick=()=>$('dataPasteDialog').close();
  $('dataPasteText').oninput=()=>{$('dataPasteStatus').textContent='';};
  function stageDataText(text,delimiter){const rows=parseDelimited(text,delimiter|| (text.includes('\t')?'\t':','),true);if(rows.length>10001||rows[0].length>100)throw Error(T('最多 100 列、10000 行数据。'));editData(rows);dataPage=0;renderDataEditor();}
  $('applyDataPaste').onclick=()=>{try{stageDataText($('dataPasteText').value);$('dataPasteDialog').close();}catch(e){$('dataPasteStatus').textContent=T('无法读取表格：{0}',e.message);}};
  $('importData').onclick=()=>{$('dataFile').value='';$('dataFile').click();};
  $('dataFile').onchange=guard(async()=>{const file=$('dataFile').files[0],projectId=project.id,id=selectedPanel;if(!file)return;if(file.size>2000000)throw Error(T('数据表不能超过 2 MB'));const text=await file.text();if(project.id!==projectId||selectedPanel!==id||state().panels[id].locked)return;try{stageDataText(text,file.name.toLowerCase().endsWith('.tsv')?'\t':',');}catch(e){$('dataPasteText').value=text;$('dataPasteStatus').textContent=T('无法读取表格：{0}',e.message);$('dataPasteDialog').showModal();}});
  let imageDestination=null;
  function chooseImage(oldId,cell){if(oldId&&state().panels[oldId].locked)return say(T('小图已锁定'));imageDestination={oldId,cell,projectId:project.id};$('imageFile').value='';$('imageFile').click();}
  let facetSplitRequest=0,facetSplitBusy=false;
  function facetSplitInfo(source=panel(selectedPanel)){
    if(source.recipe?.family!=='gallery'||source.recipe?.parameters?.view!=='compare_facet_boxes'||!Array.isArray(source.table?.rows))return null;
    const rows=source.table.rows,column=rows[0]?.indexOf('factor');if(column<0)return null;
    const labels=[...new Set(rows.slice(1).map(row=>String(row[column]??'').trim()).filter(Boolean))];return labels.length>1?{column:'factor',labels}:null;
  }
  function renderFacetSplitControls(){
    const section=$('splitFacetControls');if(!section)return;const info=facetSplitInfo();section.hidden=!info;if(!info)return;
    const unavailable=!localEngine,locked=state().panels[selectedPanel].locked,capacity=info.labels.length>6||state().order.length+info.labels.length-1>24,pending=!!dataDrafts[selectedPanel];
    $('splitFacets').disabled=facetSplitBusy||unavailable||locked||capacity||pending;
    $('splitFacetStatus').textContent=T(facetSplitBusy?'正在生成独立分面…':locked?'小图已锁定':pending?'请先完成当前数据更新':unavailable?'分面拆分需要本机绘图服务':capacity?'拆分数量超出当前组图容量':'将 {0} 个分面横向排列；其他小图保留，可一次撤销。',info.labels.length);
  }
  function copyFacetAppearance(next,id,asset,profile,source,sourceState,facet){
    let sourceSvg=baseSvg(source.id,sourceState.variant),axis=null,title=null;
    const candidates=[...sourceSvg.querySelectorAll('g[id^="axes_"]')].map(node=>({node,title:[...node.querySelectorAll('text')].find(text=>text.textContent.trim()===String(facet.label??facet.value)&&!text.closest('[id^="matplotlib.axis_"],[id^="xtick_"],[id^="ytick_"]'))})).filter(entry=>entry.title);
    if(candidates.length===1){axis=candidates[0].node;title=candidates[0].title;for(const other of [...sourceSvg.querySelectorAll('g[id^="axes_"]')])if(other!==axis)other.remove();}
    for(const [vi,v]of asset.variants.entries()){
      const svg=sanitize(v.svg),colors=[];for(const el of keysToObjects(svg))for(const prop of ['fill','stroke']){const c=hex(paint(el,prop));if(c&&chromatic(c)&&!colors.includes(c))colors.push(c);}
      for(const el of keysToObjects(svg)){const key=el.getAttribute('data-key');if(colors.length===profile.colors.length)for(const prop of ['fill','stroke']){const index=colors.indexOf(hex(paint(el,prop)));if(index>=0){setEdit(next,id,vi,key,prop,profile.colors[index]);const alpha=profile.opacity?.[profile.colors[index]];if(Number.isFinite(alpha))setEdit(next,id,vi,key,'opacity',String(alpha));}}
        if(el.localName==='text'){const style=profile.roles[el.getAttribute('data-role')||'other'];if(style){for(const [prop,value]of [['font-family',style.font],['font-weight',style.weight],['font-size',String(style.size*v.viewBox[2]/v.width)]])if(validValue(prop,value))setEdit(next,id,vi,key,prop,value);}}
      }
      if(axis){const targetAxis=svg.querySelector('g[id^="axes_"]');if(!targetAxis)continue;axis.id=targetAxis.id;const mapping=svgElementMap(sourceSvg,svg),targetTitle=svg.querySelector('[id*="studio-facet-title"] text');if(title&&targetTitle)mapping.set(title.getAttribute('data-key'),targetTitle.getAttribute('data-key'));
        const old=source.variants[sourceState.variant],ratio=(v.viewBox[2]/v.width)/(old.viewBox[2]/old.width),props=sourceState.edits[sourceState.variant]||{};
        for(const [key,dest]of mapping){if(!props[key])continue;const transferred=copy(props[key]);for(const prop of ['font-size','stroke-width'])if(transferred[prop]!==undefined)transferred[prop]=String(+transferred[prop]*ratio);next.panels[id].edits[vi]||={};next.panels[id].edits[vi][dest]={...next.panels[id].edits[vi][dest],...transferred};}
        const locked=(sourceState.lockedElements?.[sourceState.variant]||[]).map(key=>mapping.get(key)).filter(Boolean);if(locked.length){next.panels[id].lockedElements||={};next.panels[id].lockedElements[vi]=locked;}
        const groups=(sourceState.elementGroups?.[sourceState.variant]||[]).map(group=>group.map(key=>mapping.get(key)).filter(Boolean)).filter(group=>group.length>1);if(groups.length){next.panels[id].elementGroups||={};next.panels[id].elementGroups[vi]=groups;}
      }
    }
  }
  function installFacetAssets(result,oldId){
    if(!Array.isArray(result.panels)||result.panels.length<2||result.panels.length>6||result.panels.some(item=>!item.panel||!item.facet))throw Error(T('分面拆分结果无效'));
    const expected=facetSplitInfo(panel(oldId));if(!expected||result.panels.length!==expected.labels.length||result.panels.some((item,i)=>item.facet.column!==expected.column||String(item.facet.value)!==expected.labels[i]))throw Error(T('分面拆分结果无效'));
    if(project.panels.length+result.panels.length>512)throw Error(T('工程版本资源已达上限，请另存为新工程'));
    const before=state(),source=panel(oldId),profile=captureProfile()[before.order.indexOf(oldId)],first=Math.max(...project.panels.map(p=>+p.id.slice(6)))+1,assets=result.panels.map((entry,i)=>({...entry.panel,id:'panel-'+(first+i)})),currentLayout=layout(),metrics={widths:currentLayout.cells.filter(cell=>cell.row===0).map(cell=>cell.width),heights:currentLayout.cells.filter(cell=>cell.col===0).map(cell=>cell.height)};
    const next=splitPanelState(before,oldId,assets,metrics),candidate={...project,panels:[...project.panels,...assets]};
    for(let i=0;i<assets.length;i++)copyFacetAppearance(next,assets[i].id,assets[i],profile,source,before.panels[oldId],result.panels[i].facet);
    validateProject(candidate);validateState(next,candidate);
    const previousProject=project,previousPanel=selectedPanel;project=candidate;selectedPanel=assets[0].id;selected=[];elementSelections=[];selectedAnnotations=[];selectedPanelLabel=null;panelSelection=assets.map(asset=>asset.id);templateCache.clear();
    try{if(!commit(next,T('已将 {0} 个分面拆成独立小图',assets.length))){project=previousProject;selectedPanel=previousPanel;render();return false;}}catch(error){project=previousProject;selectedPanel=previousPanel;throw error;}return true;
  }
  async function splitSelectedFacets(){
    const id=selectedPanel,source=panel(id),info=facetSplitInfo(source);if(!info||!localEngine||facetSplitBusy||state().panels[id].locked)return;
    if(dataDrafts[id])throw Error(T('请先完成当前数据更新'));
    const snapshot=state(),projectId=project.id,request=++facetSplitRequest;facetSplitBusy=true;renderFacetSplitControls();
    try{const response=await engineFetch(localEngine.splitFacetsEndpoint||'/api/split-facets',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe:source.recipe,rows:source.table.rows,...(snapshot.panels[id].statistics?{statistics:snapshot.panels[id].statistics}:{})})}),result=await response.json();if(!response.ok)throw Error(result.error);
      if(request!==facetSplitRequest||project.id!==projectId||source!==panel(id)||state()!==snapshot||selectedPanel!==id||state().panels[id]?.locked)return say(T('目标已变化，请重新选择'));
      installFacetAssets(result,id);
    }finally{facetSplitBusy=false;renderFacetSplitControls();}
  }
  if($('splitFacets'))$('splitFacets').onclick=guard(splitSelectedFacets);
  function installAsset(asset,oldId,cell,label,preserveAppearance=false,preserveStatistics=false){
    if(project.panels.length>=512)throw Error(T('工程版本资源已达上限，请另存为新工程'));
    if(preserveAppearance&&oldId)StudioI18n.preserveDisplayNames(asset,panel(oldId));
    const profile=preserveAppearance&&oldId?captureProfile()[state().order.indexOf(oldId)]:null;
    const id='panel-'+(Math.max(...project.panels.map(p=>+p.id.slice(6)))+1);asset={...asset,id};
    const next=installPanelState(state(),oldId,id,asset.initialVariant||0,cell),candidate={...project,panels:[...project.panels,asset]};validateProject(candidate);validateState(next,candidate);
    project=candidate;
    if(profile){
      asset.variants.forEach((v,vi)=>{const svg=sanitize(v.svg),colors=[];for(const el of keysToObjects(svg))for(const prop of ['fill','stroke']){const c=hex(paint(el,prop));if(c&&chromatic(c)&&!colors.includes(c))colors.push(c);}
        for(const el of keysToObjects(svg)){const key=el.getAttribute('data-key');if(colors.length===profile.colors.length)for(const prop of ['fill','stroke']){const index=colors.indexOf(hex(paint(el,prop)));if(index>=0){setEdit(next,id,vi,key,prop,profile.colors[index]);const alpha=profile.opacity?.[profile.colors[index]];if(Number.isFinite(alpha))setEdit(next,id,vi,key,'opacity',String(alpha));}}
          if(el.localName==='text'){const style=profile.roles[el.getAttribute('data-role')||'other'];if(style){if(validValue('font-family',style.font))setEdit(next,id,vi,key,'font-family',style.font);const size=style.size*v.viewBox[2]/v.width;if(validValue('font-size',String(size)))setEdit(next,id,vi,key,'font-size',String(size));if(validValue('font-weight',style.weight))setEdit(next,id,vi,key,'font-weight',style.weight);}}
        }
        const sourceAsset=panel(oldId),matches=sourceAsset.variants.map((old,index)=>({old,index})).filter(({old})=>old.name===v.name&&(old.size||'original')===(v.size||'original'));
        if(matches.length===1){const {old,index}=matches[0],explicit=state().panels[oldId].edits[index];if(explicit&&Object.keys(explicit).length){const retained=migrateStableTextEdits(baseSvg(oldId,index),svg,explicit,old,v);for(const [key,props]of Object.entries(retained))for(const [prop,value]of Object.entries(props))setEdit(next,id,vi,key,prop,value);}}
      });
      const old=state().panels[oldId],record=old.statistics;
      if(old.annotationPFormat)next.panels[id].annotationPFormat=old.annotationPFormat;
      if(old.showFacetTitles!==undefined)next.panels[id].showFacetTitles=old.showFacetTitles;
      if(old.conditionMatrix)next.panels[id].conditionMatrix=copy(old.conditionMatrix);
      if(asset.statistics){next.panels[id].statistics={...copy(asset.statistics),binding:'current',tableKey:asset.table?.sha256||''};}
      else if(record){if(old.annotationFont)next.panels[id].annotationFont=copy(old.annotationFont);if(old.annotationLine)next.panels[id].annotationLine=old.annotationLine;next.panels[id].statistics=copy(record);next.panels[id].statistics.tableKey=asset.table?.sha256||'';if(!preserveStatistics){next.panels[id].statistics.stale=true;delete next.panels[id].statistics.analysis;}}
      const available=next.panels[id].statistics?!next.panels[id].statistics.stale:asset.analysis?.primary_test&&JSON.stringify(panel(oldId).analysis.group_order)===JSON.stringify(asset.analysis.group_order);
      if(old.annotationStyle&&available){next.panels[id].annotationStyle=old.annotationStyle;if(old.annotationFont)next.panels[id].annotationFont=copy(old.annotationFont);if(old.annotationLine)next.panels[id].annotationLine=old.annotationLine;const updated=next.panels[id].statistics?.analysis;if(old.annotationStyle==='letters'&&updated&&!(updated.facets||[updated]).every(set=>statisticalComparisons(set).letters))next.panels[id].annotationStyle='p';}
    }
    selectedPanel=id;selected=[];panelSelection=[id];templateCache.clear();commit(preserveAppearance?next:matchSizes(next,[id]),label);
  }
  $('importImage').onclick=()=>chooseImage(selectedPanel,null);
  let pdfImportSession=null;
  function pdfWarningText(code,message){const labels={page_appearance:'这一页使用了目前无法分别保真转换的颜色混合或透明效果，已保留为整页图片，内部细节暂不能单独编辑。这是转换能力的限制，不代表原 PDF 本身只有图片。',image_resolution:'拉伸的图片已按适合编辑的分辨率重新采样，以保持操作流畅。',font_substitution:'PDF 文字仍可编辑；使用本机可用字体，请在导出前核对字形。',text_spacing:'部分文字缺少原始字符间距，请核对这些文字的排版。',appearance_layer:'部分图层含暂不支持的 PDF 绘制效果，已保留为图片；这部分内部细节不能单独编辑，其他已识别对象仍可编辑。',image_only:'这一页只有图片内容。图片可移动、缩放；图片内部文字和图形不能单独编辑。',outlined_text:'未发现原生文字。已经转为轮廓的文字可以作为矢量形状调整，不能直接改字。'};return T(labels[code]||message);}
  function validateImportTarget(target){if(project.id!==target.projectId||target.oldId&&!state().order.includes(target.oldId))throw Error(T('目标已变化，请重新选择导入位置'));if(target.oldId&&state().panels[target.oldId].locked)throw Error(T('小图已锁定'));}
  function readFileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error(T('文件无法读取')));r.readAsDataURL(file);});}
  function pdfImportError(message){const messages={
    'This PDF page produces too much image data for interactive editing. Import a smaller page or reduce embedded image resolution.':'这一页转换后的图片数据过大，请导入较小范围，或降低内嵌图片的分辨率后重试。',
    'This PDF page is too complex for interactive editing. Import a smaller section or simplify the artwork.':'这一页的图形内容过于复杂，请导入较小范围或简化图形后重试。',
    'This PDF is damaged or password protected. Save an unlocked copy and try again.':'PDF 已损坏或设有密码，请另存为可正常打开的无密码副本后重试。',
    'This PDF page is blank. Choose another page.':'这一页是空白页，请选择其他页面。',
    'Choose a PDF with between 1 and 200 pages.':'请选择 1–200 页的 PDF，可先在原软件中导出需要的页面。',
    'The selected file is not a PDF.':'文件内容不是有效的 PDF。',
    'PDF import requires pypdfium2. Install the current Figure Studio release or update the skill dependencies.':'当前环境缺少 PDF 解析组件，请安装最新版 Figure Studio，或更新技能依赖。',
    'PDF import requires pypdf. Install the current Figure Studio release or update the skill dependencies.':'当前环境缺少 PDF 解析组件，请安装最新版 Figure Studio，或更新技能依赖。',
    'This page has too many special effects for interactive import. Simplify the PDF before importing.':'这一页的特殊绘制效果过多，请在原软件中简化后重新导入。',
    'This page has too many objects for interactive editing.':'这一页的对象过多，请先导出需要的小图，再单独导入。',
    'This page has too many path segments for interactive editing.':'这一页的路径过于复杂，请先导出需要的小图，再单独导入。',
    'This page has too many characters for interactive editing.':'这一页的文字过多，请先导出需要的小图，再单独导入。'};return T(messages[message]||message);}
  async function pdfRequest(session,action,page=0){
    const response=await engineFetch(localEngine.pdfEndpoint||'/api/import-pdf',{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({data:session.data,action,page})}),result=await response.json();
    if(!response.ok)throw Error(pdfImportError(result.error));return result.pdf;
  }
  async function previewPdfPage(){
    const session=pdfImportSession;if(!session)return;const revision=++session.revision,index=Number($('pdfImportPage').value);session.result=null;$('applyPdfImport').disabled=true;$('pdfImportStatus').textContent=T('正在识别这一页…');$('pdfImportWarnings').replaceChildren();$('pdfImportPreview').replaceChildren();
    try{const result=await pdfRequest(session,'page',index);if(pdfImportSession!==session||session.revision!==revision)return;const clean=sanitize(result.svg);session.result={...result,svg:new XMLSerializer().serializeToString(clean)};$('pdfImportPreview').append(clean);$('pdfImportStatus').textContent=typeof classifySvgContent==='function'?svgContentSummary(classifySvgContent(clean),result):T('已识别 {0} 个文本、{1} 个矢量对象、{2} 张图片',result.editable.texts,result.editable.paths,result.editable.images);for(const [i,warning]of (result.warnings||[]).entries()){if(result.warningCodes?.[i]==='page_appearance')continue;const li=document.createElement('li');li.textContent=pdfWarningText(result.warningCodes?.[i],warning);$('pdfImportWarnings').append(li);}$('applyPdfImport').disabled=false;}
    catch(error){if(pdfImportSession===session&&session.revision===revision)$('pdfImportStatus').textContent=T('未完成：')+error.message;}
  }
  async function openPdfImport(file,target){
    if(!localEngine)throw Error(T('PDF 需要本机解析。请用 Figure Studio 桌面版打开此工程，或先将 PDF 导出为 SVG。'));
    const session={file,target,data:null,result:null,revision:0};pdfImportSession=session;$('pdfImportName').textContent=file.name;$('pdfImportPage').replaceChildren();$('pdfImportPage').disabled=true;$('pdfImportPreview').replaceChildren();$('pdfImportWarnings').replaceChildren();$('pdfImportStatus').textContent=T('正在读取 PDF…');$('applyPdfImport').disabled=true;$('pdfImportDialog').showModal();
    try{const url=await readFileDataUrl(file);if(pdfImportSession!==session)return;session.data=url.slice(url.indexOf(',')+1);const info=await pdfRequest(session,'inspect');if(pdfImportSession!==session)return;for(let index=0;index<info.pageCount;index++){const option=document.createElement('option');option.value=index;option.textContent=T('第 {0} 页，共 {1} 页',index+1,info.pageCount);$('pdfImportPage').append(option);}$('pdfImportPage').disabled=info.pageCount===1;await previewPdfPage();}
    catch(error){if(pdfImportSession===session)$('pdfImportStatus').textContent=T('未完成：')+error.message;}
  }
  $('pdfImportPage').onchange=previewPdfPage;
  $('closePdfImport').onclick=()=>$('pdfImportDialog').close();
  $('pdfImportDialog').addEventListener('close',()=>{pdfImportSession=null;});
  $('applyPdfImport').onclick=guard(()=>{const session=pdfImportSession,result=session?.result;if(!result)return;validateImportTarget(session.target);const width=result.widthPt,height=result.heightPt;if(!Number.isFinite(width)||!Number.isFinite(height)||Math.min(width,height)<=0||Math.max(width,height)>14400)throw Error(T('SVG 尺寸无效'));const pageName=session.file.name+(result.pageCount>1?' · '+T('第 {0} 页',result.pageIndex+1):'');installAsset({name:pageName,variants:[{name:'imported_pdf',svg:result.svg,width,height,viewBox:[0,0,width,height],size:'original',preserveAspect:true}],initialVariant:0,recipe:{source:session.file.name},analysis:{import:{format:'pdf',page:result.pageIndex+1,editable:result.editable,warnings:result.warnings||[],warningCodes:result.warningCodes||[],rasterizedObjects:result.rasterizedObjects||0}},table:null,provenance:'user-import'},session.target.oldId,session.target.cell,T('PDF 已导入；可撤销恢复原图'));$('pdfImportDialog').close();showPane('detail');});
  $('imageFile').onchange=guard(async()=>{const file=$('imageFile').files[0],target=imageDestination;if(!file||!target)return;validateImportTarget(target);if(file.size>20000000)throw Error(T('文件不能超过 20 MB'));
    if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){await openPdfImport(file,target);return;}
    let svg,width,height,viewBox,contentInfo={kind:'raster',text:0,vector:0,image:1,outlined:0};
    if(file.name.toLowerCase().endsWith('.svg')){const raw=await file.text();if(/<!ENTITY/i.test(raw))throw Error(T('不支持 XML 实体'));await validateSvgImportFeatures(raw);const clean=sanitize(raw);contentInfo=classifySvgContent(clean);viewBox=(clean.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);if(viewBox.length!==4||!viewBox.every(Number.isFinite)||viewBox[2]<=0||viewBox[3]<=0)throw Error(T('SVG 需要有效 viewBox'));width=360;height=360*viewBox[3]/viewBox[2];svg=new XMLSerializer().serializeToString(clean);}
    else{if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error(T('支持 PNG、JPEG、WebP、SVG 或 PDF'));const url=await readFileDataUrl(file);const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(T('图片无法解码')));img.src=url;});width=360;height=360*img.naturalHeight/img.naturalWidth;viewBox=[0,0,width,height];svg=`<svg xmlns="${NS}" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="${url}"/></svg>`;}
    validateImportTarget(target);installAsset({name:file.name,variants:[{name:'imported_image',svg,width,height,viewBox,size:'original',preserveAspect:true}],initialVariant:0,recipe:{source:file.name},analysis:{},table:null,provenance:'user-import'},target.oldId,target.cell,T('图片已导入；可撤销恢复原图'));showPane('detail');showImportedContentNotice(contentInfo);
  });
  let insertionCell=null;
  function openInsertMenu(cell,x,y,context=false,hasPanel=true,contextPanelId=null){
    insertionCell={row:cell.row,col:cell.col};const menu=$('insertMenu');menu.hidden=false;$('insertCount').value='1';updateInsertCapacity();
    menu.querySelector('strong').textContent=T(context?'快捷操作':'扩展母版');menu.setAttribute('aria-label',T(context?'快捷操作':'插入行或列'));
    let actions=$('contextActions');if(!actions){actions=document.createElement('div');actions.id='contextActions';actions.className='context-actions';menu.insertBefore(actions,menu.children[1]);}actions.replaceChildren();actions.hidden=!context;
    const add=(label,run,disabled=false)=>{const b=button(T(label),()=>{menu.hidden=true;run();});b.disabled=disabled;actions.append(b);};
    const reveal=(id,pane=null)=>{const target=$(id);showPane(pane||target.closest('[data-pane]')?.getAttribute('data-pane')||'detail');for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;target.scrollIntoView({block:'nearest'});target.focus();};
    if(context){
      if(hasPanel){const exportId=contextPanelId||selectedPanel;add('单图另存为…',guard(()=>openImageExport(exportId)),exportBusy||!!dataDrafts[exportId]);}
      if(selected.length||selectedAnnotations.length)add('对象对齐',()=>{showPane(selectedAnnotations.length?'annotation':'detail');document.querySelector(`[data-pane="${selectedAnnotations.length?'annotation':'detail'}"] .object-align`)?.scrollIntoView({block:'nearest'});});
      for(const [type,name]of [['text','插入文本'],['line','插入水平线'],['lineVertical','插入垂直线'],['bracket','插入比较括号'],['rect','插入矩形'],['ellipse','插入椭圆']])add(name,()=>insertOverlay(type,insertionCell));
      if(selectionGroups().length||selectedPanelLabel)add('删除所选元素',deleteSelectedObjects);
      if(selectedAnnotations.length){add('标注属性',()=>{showPane('annotation');renderOverlayProperties();});add('删除标注',()=>$('deleteOverlay').click());}
      add(hasPanel?'替换当前小图…':'在此空格导入图片…',()=>chooseImage(hasPanel?selectedPanel:null,insertionCell),hasPanel&&state().panels[selectedPanel].locked);
      add('↶ 撤销',()=>$('undo').click(),$('undo').disabled);add('↷ 重做',()=>$('redo').click(),$('redo').disabled);
      if(hasPanel){const p=state().panels[selectedPanel],locked=p.locked||selected.some(k=>p.lockedElements?.[p.variant]?.includes(k));
        add('颜色与透明度…',()=>reveal('colorHex'),locked);
        add('字体与字号…',()=>reveal('fontSize'),locked||$('fontSize').disabled);
        add('图型与横竖预览…',()=>showPane('explore'),p.locked);
        add('位置与跨格…',()=>reveal('rowSpan'),p.locked);
        add('图号与位置…',()=>reveal('panelLabel'),p.locked);
        add('统计标注…',()=>reveal('statisticalAnnotations'));
        if(scaleSelection())add('图像比例尺…',()=>reveal('scaleCalibration'),locked);
        add('组合',()=>$('groupSelection').click(),locked||(selected.length<2&&panelSelection.length<2));
        const grouped=selected.length?p.elementGroups?.[p.variant]?.some(g=>g.some(k=>selected.includes(k))):state().panelGroups?.some(g=>g.includes(selectedPanel));
        add('拆分',()=>$('ungroupSelection').click(),locked||!grouped);
        add('锁定',()=>$('lockSelection').click(),locked);
        add('解锁',()=>$('unlockSelection').click(),!locked||(p.locked&&selected.length>0));
      }
    }
    menu.style.left=Math.max(8,Math.min(x,window.innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,window.innerHeight-menu.offsetHeight-8))+'px';(context?actions.querySelector('button:not(:disabled)'):$('insertCount'))?.focus();
  }
  function updateInsertCapacity(){
    const rows=24-gridFor(state()).rows,cols=6-state().columns,n=+$('insertCount').value;
    $('insertCapacity').textContent=T('当前还可插入 {0} 行、{1} 列；跨越插入位置的小图会扩展。',rows,cols);
    for(const b of $('insertMenu').querySelectorAll('[data-insert]'))b.disabled=!Number.isInteger(n)||n<1||n>(['above','below'].includes(b.dataset.insert)?rows:cols);
  }
  $('insertCount').oninput=updateInsertCapacity;
  $('insertTrackMenu').onclick=()=>{const cell=gridFor(state()).places[selectedPanel],r=$('insertTrackMenu').getBoundingClientRect();openInsertMenu(cell,r.left,r.bottom+6);};
  $('closeInsert').onclick=()=>$('insertMenu').hidden=true;
  for(const b of $('insertMenu').querySelectorAll('[data-insert]'))b.onclick=()=>{if(!insertionCell)return;const direction=b.dataset.insert,isRow=['above','below'].includes(direction),index=(isRow?insertionCell.row:insertionCell.col)+(['below','right'].includes(direction)?1:0),count=+$('insertCount').value;
    try{const currentLayout=layout(),metrics={widths:currentLayout.cells.filter(c=>c.row===0).map(c=>c.width),heights:currentLayout.cells.filter(c=>c.col===0).map(c=>c.height)},next=insertTracks(state(),isRow?'row':'column',index,count,metrics);$('insertMenu').hidden=true;commit(next,T('已插入 {0} {1}',count,T(isRow?'行':'列')));}catch(e){$('insertCapacity').textContent=T(e.message);}
  };
  document.addEventListener('pointerdown',e=>{if(!$('insertMenu').hidden&&!$('insertMenu').contains(e.target)&&e.target!==$('insertTrackMenu'))$('insertMenu').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('insertMenu').hidden=true;});
  $('applyGrid').onclick=()=>{try{commit(matchSizes(arrange(state(),+$('rows').value,+$('columns').value)),T('已更新行列母版'));}catch(e){say(e.message);}};
  $('adaptSizes').onchange=renderMasters;
  $('boxSelect').onclick=()=>{prepareTouchEditing();cancelOverlayPlacement();boxSelect=!boxSelect;layoutMode=false;dragging=null;renderCanvas();};
  const togglePanelArrange=()=>{prepareTouchEditing();cancelOverlayPlacement();layoutMode=!layoutMode;boxSelect=false;dragging=null;selected=[];elementSelections=[];selectedAnnotations=[];selectedPanelLabel=null;selectionAfterMarquee=false;$('scope').value='panel';original=false;render();if(layoutMode)say(T('拖动整张小图至目标格：有图则交换，空位则移入。'));};
  $('layoutMode').onclick=togglePanelArrange;$('arrangePanels').onclick=togglePanelArrange;
  $('toggleGuides').onclick=()=>{showGuides=!showGuides;$('toggleGuides').setAttribute('aria-pressed',String(showGuides));renderCanvas();};
  $('moveTo').onclick=()=>commit(moveWithSizes(state(),selectedPanel,+$('targetRow').value-1,+$('targetCol').value-1),T('已移动 / 交换小图'));
  $('applySpan').onclick=()=>{try{commit(matchSizes(resizePanel(state(),selectedPanel,+$('rowSpan').value,+$('colSpan').value),[selectedPanel]),T('已应用跨格'));}catch(e){say(e.message);}};
  let panelGapPreview=null,panelGapFrame=0;
  function syncPanelGapControls(s=state()){
    const gaps=panelGaps(s);for(const [axis,input,slider]of [['x','gap','gapSlider'],['y','gapY','gapYSlider']]){$(input).value=gaps[axis];$(slider).value=gaps[axis];}
  }
  function cancelPanelGapPreview(repaint=true){
    if(panelGapFrame)cancelAnimationFrame(panelGapFrame);panelGapFrame=0;const hadPreview=!!panelGapPreview;panelGapPreview=null;syncPanelGapControls();if(repaint&&hadPreview)renderCanvas();
  }
  function beginPanelGapPreview(axis){
    if(panelGapPreview&&(panelGapPreview.axis!==axis||panelGapPreview.base!==state()||panelGapPreview.project!==project))cancelPanelGapPreview();
    if(!panelGapPreview)panelGapPreview={axis,base:state(),project,next:null,keyActive:false};return panelGapPreview;
  }
  function previewPanelGap(axis,value){
    const n=Number(value);if(!Number.isFinite(n)||n<0||n>100)return;
    const preview=beginPanelGapPreview(axis),next=copy(preview.base);next[axis==='x'?'gapX':'gapY']=n;preview.next=next;syncPanelGapControls(next);
    if(!panelGapFrame)panelGapFrame=requestAnimationFrame(()=>{panelGapFrame=0;const current=panelGapPreview;if(!current)return;if(current.base!==state()||current.project!==project)return cancelPanelGapPreview();if(current.next)renderCanvas(current.next);});
  }
  function finishPanelGapPreview(axis,value){
    if(String(value).trim()===''||!Number.isFinite(Number(value))||+value<0||+value>100){cancelPanelGapPreview();say(T('间距应为 0–100 pt。'));return;}
    const preview=panelGapPreview;if(preview&&(preview.axis!==axis||preview.base!==state()||preview.project!==project))return cancelPanelGapPreview();
    const next=copy(state());next[axis==='x'?'gapX':'gapY']=Number(value);const unchanged=panelGaps(state())[axis]===Number(value);cancelPanelGapPreview(false);
    if(unchanged){renderCanvas();return;}commit(next,T(axis==='x'?'已修改横向图间留白':'已修改纵向图间留白'));
  }
  for(const [axis,inputId,sliderId]of [['x','gap','gapSlider'],['y','gapY','gapYSlider']]){
    const input=$(inputId),slider=$(sliderId);slider.onpointerdown=()=>beginPanelGapPreview(axis);slider.oninput=()=>previewPanelGap(axis,slider.value);
    slider.onchange=()=>{if(!panelGapPreview?.keyActive)finishPanelGapPreview(axis,slider.value);};slider.onpointercancel=()=>cancelPanelGapPreview();
    slider.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancelPanelGapPreview();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))beginPanelGapPreview(axis).keyActive=true;};
    slider.onkeyup=e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(e.key))finishPanelGapPreview(axis,slider.value);};
    slider.onblur=()=>{if(panelGapPreview?.axis===axis)finishPanelGapPreview(axis,slider.value);};
    input.onchange=()=>finishPanelGapPreview(axis,input.value);input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();finishPanelGapPreview(axis,input.value);}else if(e.key==='Escape'){e.preventDefault();cancelPanelGapPreview();}};
  }
  $('resetGap').onclick=()=>{cancelPanelGapPreview(false);commit(copyPanelGaps(copy(state()),project.initialState),T('已恢复初始版本推荐间距'));};
  $('zoom').onchange=()=>{const value=$('zoom').value;cancelQueuedZoom({preserveControl:true});applyPreviewZoom(+value,null,value==='fit');};
  for(const [name,delta]of[['moveUp',-1],['moveDown',1]])$(name).onclick=()=>{const s=state(),i=s.order.indexOf(selectedPanel),j=i+delta;if(j<0||j>=s.order.length)return;const p=gridFor(s).places[s.order[j]];commit(moveWithSizes(s,selectedPanel,p.row,p.col),T('已调整面板顺序'));};
  $('checkpoint').onclick=()=>{const name=$('versionName').value.trim();if(!name)return say(T('请输入版本名称。'));if(checkpoints.length>=20)return say(T('已保存 20 个版本，请另存工程后继续整理。'));checkpoints.push({name,state:copy(state())});$('versionName').value='';persist();render();learnPreferences();say(T('已保存版本「{0}」',name));};

  const libraryIds=new Set();let libraryQueue=Promise.resolve(),libraryRecords=[],presetRecords=[];
  function currentPayload(){return {project,state:copy(state()),history:copy(history.toJSON()),checkpoints:copy(checkpoints),dataDrafts:copy(dataDrafts)};}
  function validatePayload(payload){validateProject(payload.project);validateState(payload.state,payload.project);History.restore(payload.history,payload.project,payload.state);if(!Array.isArray(payload.checkpoints)||payload.checkpoints.length>20)throw Error(T('版本无效'));for(const c of payload.checkpoints){if(typeof c.name!=='string'||c.name.length>60)throw Error(T('版本名称无效'));validateState(c.state,payload.project);}return payload;}
  function libraryWrite(record){libraryIds.add(record.id);const task=libraryQueue.catch(()=>{}).then(()=>StudioLibrary.put('figures',record));libraryQueue=task;task.catch(()=>{$('libraryStatus').textContent=T('总览保存失败，请下载工程备份。');});return task;}
  function renderProjectStart(){
    const start=$('projectStart');if(!start)return;
    start.hidden=welcomeDismissed||!!state().overlays?.length||!!state().alignmentGuides?.length||!state().order.every(id=>panel(id).provenance==='blank-canvas');
    $('startTemplates').disabled=!localEngine;
    $('startEngineNote').hidden=!!localEngine;
  }
  function openStartTemplates(){catalogueStartMode=true;catalogueCategory='distribution';$('chartSearch').value='';renderChartLibrary();$('chartLibrary').showModal();}
  function openNewProjectDialog(){
    inlineEditor?.finish(true);$('newProjectName').value='';$('newProjectStatus').textContent='';$('newProjectDialog').showModal();$('newProjectName').focus();
  }
  async function createNewProject(){
    if(newProjectBusy)return;
    const title=$('newProjectName').value.trim()||'新建组图',snapshot=state(),sourceProject=project,requestName=title;
    const id=Array.from(crypto.getRandomValues(new Uint8Array(10)),n=>n.toString(16).padStart(2,'0')).join(''),fresh=createBlankProject(id,requestName);
    validateProject(fresh);newProjectBusy=true;$('confirmNewProject').disabled=true;$('newProjectStatus').textContent=T('正在保存当前工程…');
    try{
      await collectFigure();await autosaveQueue;
      if(!$('newProjectDialog').open||state()!==snapshot||project!==sourceProject)return;
      // Persist the new empty project before changing the visible workspace.
      const initial={project:fresh,state:copy(fresh.initialState),history:new History(fresh.initialState).toJSON(),checkpoints:[],dataDrafts:{}};
      await StudioLibrary.put('autosaves',{id:fresh.id,payload:initial});
      if(!$('newProjectDialog').open||state()!==snapshot||project!==sourceProject)return;
      project=fresh;history=new History(fresh.initialState);checkpoints=[];dataDrafts={};dataSerial++;
      selectedPanel='panel-0';selected=[];elementSelections=[];selectionAnchor=null;selectedAnnotations=[];selectedPanelLabel=null;selectedAlignmentGuide=null;panelSelection=[];original=false;layoutMode=false;boxSelect=false;welcomeDismissed=false;activePane='explore';inspectorPanel=null;
      templateCache.clear();knownCache=null;localSavedCurrent='';savedCurrent=saveSignature();migrateLabelHistory();$('scope').value='panel';$('newProjectDialog').close();persist();render();say(T('已新建工程；上一工程保存在“项目与预设”。'));
    }catch(error){$('newProjectStatus').textContent=T('未新建：当前工程尚未安全保存。请下载工程备份后重试。');throw error;}
    finally{newProjectBusy=false;$('confirmNewProject').disabled=false;}
  }
  if($('newProject'))$('newProject').onclick=openNewProjectDialog;
  if($('confirmNewProject'))$('confirmNewProject').onclick=guard(createNewProject);
  if($('cancelNewProject'))$('cancelNewProject').onclick=()=>$('newProjectDialog').close();
  if($('backupBeforeNew'))$('backupBeforeNew').onclick=()=>$('save').click();
  if($('startTemplates'))$('startTemplates').onclick=openStartTemplates;
  if($('startImportImage'))$('startImportImage').onclick=()=>$('importImage').click();
  if($('startOpenProject'))$('startOpenProject').onclick=()=>$('load').click();
  if($('dismissProjectStart'))$('dismissProjectStart').onclick=()=>{welcomeDismissed=true;renderProjectStart();};
  function collectFigure(){return libraryWrite({id:project.id,name:project.title||project.name||project.id,updatedAt:new Date().toISOString(),payload:currentPayload()});}
  function libraryThumbnail(payload){
    const old={project,history,checkpoints,selectedPanel,selected,original,layoutMode};
    try{project=payload.project;history=new History(payload.state);checkpoints=payload.checkpoints;selectedPanel=state().order[0];selected=[];original=false;layoutMode=false;templateCache.clear();return preview(composite(false,true));}
    finally{({project,history,checkpoints,selectedPanel,selected,original,layoutMode}=old);templateCache.clear();}
  }
  async function openCollected(record){
    validatePayload(record.payload);await collectFigure();await libraryQueue;
    const payload=(await StudioLibrary.list('figures')).find(r=>r.id===record.id)?.payload||record.payload;project=copy(payload.project);history=History.restore(payload.history,project,payload.state);checkpoints=copy(payload.checkpoints);dataDrafts=copy(payload.dataDrafts||{});dataSerial++;selectedPanel=state().order[0];selected=[];panelSelection=[];templateCache.clear();original=false;knownCache=localStorage.getItem('figure-studio:'+project.id);migrateLabelHistory();savedCurrent=saveSignature();persist();render();$('libraryDialog').close();say(T('工程已恢复'));
  }
  async function renderLibrary(){
    await libraryQueue;[libraryRecords,presetRecords]=await Promise.all([StudioLibrary.list('figures'),StudioLibrary.list('presets')]);
    libraryRecords.forEach(r=>libraryIds.add(r.id));const chosen=$('presetChoice').value;$('presetChoice').replaceChildren();
    for(const p of presetRecords.filter(p=>$('showArchived').checked||!libraryRecords.find(r=>r.id===p.sourceId)?.archived)){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;$('presetChoice').append(option);}if(presetRecords.some(p=>p.id===chosen))$('presetChoice').value=chosen;$('pasteCurrent').disabled=!$('presetChoice').options.length;$('restorePreset').disabled=!$('presetChoice').options.length;
    $('libraryGrid').replaceChildren();
    for(const record of libraryRecords.filter(r=>$('showArchived').checked||!r.archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))){
      const card=document.createElement('article');card.className='library-card';const title=document.createElement('h3');title.textContent=record.name;card.append(title);
      try{validateState(record.payload.state,record.payload.project);card.append(libraryThumbnail(record.payload));card.append(button(T('打开并细调'),guard(()=>openCollected(record))));}catch{const error=document.createElement('p');error.textContent=T('该工程需要重新导入');card.append(error);}
      card.append(button(T(record.archived?'恢复归档':'归档'),guard(async()=>{await libraryWrite({...record,archived:!record.archived});await renderLibrary();})));$('libraryGrid').append(card);
    }
    $('libraryStatus').textContent=T('本地总览：{0} 张组图，{1} 个预设。',libraryRecords.length,presetRecords.length);
  }
  function captureProfile(){
    return state().order.map(id=>{const p=state().panels[id],vi=p.variant,svg=editedSvg(id,vi),v=panel(id).variants[vi],colors=[],roles={},opacity={};
      for(const el of svg.querySelectorAll('[data-key]'))for(const prop of ['fill','stroke']){const c=hex(paint(el,prop));if(c&&chromatic(c)&&!colors.includes(c)){colors.push(c);opacity[c]=parseFloat(el.style.opacity||el.getAttribute('opacity')||'1');}}
      for(const el of svg.querySelectorAll('text')){const role=el.getAttribute('data-role')||'other';if(!roles[role])roles[role]={font:(el.style.fontFamily||el.getAttribute('font-family')||'').replace(/["']/g,''),size:parseFloat(el.style.fontSize||el.getAttribute('font-size'))*v.width/v.viewBox[2],weight:el.style.fontWeight||el.getAttribute('font-weight')};}
      const scale=Object.values(p.scales?.[vi]||{})[0];return {colors:colors.length<=8?colors:[],opacity,roles,geometry:p.geometry,groupSpacing:p.groupSpacing,label:p.label,annotationStyle:p.annotationStyle,annotationLine:p.annotationLine,annotationPFormat:p.annotationPFormat,annotationFont:p.annotationFont,showFacetTitles:p.showFacetTitles,scale};
    });
  }
  function pastePreset(preset){
    const next=copy(state());if(preset.sourceState.exportSettings)next.exportSettings=copy(preset.sourceState.exportSettings);if(preset.sourceState.typography)next.typography=copy(preset.sourceState.typography);copyPanelGaps(next,preset.sourceState);if(preset.sourceState.compactWhitespace!==undefined)next.compactWhitespace=preset.sourceState.compactWhitespace;else delete next.compactWhitespace;
    let skipped=0;
    next.order.forEach((id,index)=>{const profile=preset.profile[index]||preset.profile[0],target=next.panels[id];if(target.locked){skipped++;return;}if(!profile)return;
      if(profile.geometry)target.geometry=copy(profile.geometry);
      if(profile.groupSpacing)target.groupSpacing=copy(profile.groupSpacing);
      if(profile.annotationFont)target.annotationFont=copy(profile.annotationFont);
      if(profile.annotationPFormat)target.annotationPFormat=profile.annotationPFormat;
      if(profile.showFacetTitles!==undefined)target.showFacetTitles=profile.showFacetTitles;
      if(profile.annotationStyle&&comparisonsFor(id).length){try{if(profile.annotationStyle==='letters')comparisonLetters(panel(id).analysis.group_order.length,comparisonsFor(id));target.annotationStyle=profile.annotationStyle;if(profile.annotationLine)target.annotationLine=profile.annotationLine;}catch{}}
      if(target.label&&profile.label){const text=target.label.text;target.label={...copy(profile.label),text};}
      for(const scales of Object.values(target.scales||{}))for(const cfg of Object.values(scales))if(profile.scale){const {calibration,length}=cfg;Object.assign(cfg,profile.scale,{calibration,length});}
      panel(id).variants.forEach((v,vi)=>{const svg=editedSvg(id,vi),colors=[];
        for(const el of svg.querySelectorAll('[data-key]'))for(const prop of ['fill','stroke']){const c=hex(paint(el,prop));if(c&&chromatic(c)&&!colors.includes(c))colors.push(c);}
        for(const el of svg.querySelectorAll('[data-key]')){const key=el.getAttribute('data-key');if((target.lockedElements?.[vi]||[]).includes(key)||[...el.querySelectorAll('[data-key]')].some(child=>(target.lockedElements?.[vi]||[]).includes(child.getAttribute('data-key'))))continue;
          if(colors.length<=profile.colors.length)for(const prop of ['fill','stroke']){const i=colors.indexOf(hex(paint(el,prop)));if(i>=0){setEdit(next,id,vi,key,prop,profile.colors[i]);const alpha=profile.opacity?.[profile.colors[i]];if(Number.isFinite(alpha)&&alpha>=.05&&alpha<=1)setEdit(next,id,vi,key,'opacity',String(alpha));}}
          if(el.localName==='text'){const style=profile.roles[el.getAttribute('data-role')||'other'];if(style){if(validValue('font-family',style.font))setEdit(next,id,vi,key,'font-family',style.font);if(validValue('font-weight',style.weight))setEdit(next,id,vi,key,'font-weight',style.weight);if(Number.isFinite(style.size)&&style.size>=4&&style.size<=72){const size=style.size*v.viewBox[2]/v.width,old=parseFloat(el.style.fontSize||el.getAttribute('font-size')||'12');setEdit(next,id,vi,key,'font-size',String(size));for(const child of el.querySelectorAll('tspan[data-key]')){const n=parseFloat(child.style.fontSize||child.getAttribute('font-size'));if(Number.isFinite(n)&&old>0)setEdit(next,id,vi,child.getAttribute('data-key'),'font-size',String(n*size/old));}}}}
        }
      });
    });
    if($('pasteLayout').checked&&preset.sourceState.order.length===next.order.length&&!next.order.some(id=>next.panels[id].locked)){
      const sourceGrid=gridFor(preset.sourceState);next.columns=preset.sourceState.columns;next.grid={rows:sourceGrid.rows,...(sourceGrid.widths?{widths:copy(sourceGrid.widths),heights:copy(sourceGrid.heights)}:{}),places:Object.fromEntries(next.order.map((id,i)=>[id,copy(sourceGrid.places[preset.sourceState.order[i]])]))};
    }
    if(!commit(next,T('已粘贴编辑预设'))){$('libraryStatus').textContent=$('status').textContent;return;}$('libraryStatus').textContent=T('已粘贴可迁移样式；数据、文字与统计结果保留。锁定小图跳过 {0} 张。',skipped);
  }
  $('openLibrary').onclick=guard(async()=>{await collectFigure();await renderLibrary();$('libraryDialog').showModal();});
  $('closeLibrary').onclick=()=>$('libraryDialog').close();
  $('collectCurrent').onclick=guard(async()=>{await collectFigure();await renderLibrary();});
  $('capturePreset').onclick=guard(async()=>{const name=$('presetName').value.trim();if(!name)return say(T('请输入预设名称'));await collectFigure();const preset={id:'preset-'+Date.now()+'-'+Math.random().toString(16).slice(2),name,sourceId:project.id,sourceState:copy(state()),profile:captureProfile()};await StudioLibrary.put('presets',preset);await renderLibrary();$('presetChoice').value=preset.id;});
  $('showArchived').onchange=guard(renderLibrary);
  $('restorePreset').onclick=()=>{const preset=presetRecords.find(p=>p.id===$('presetChoice').value);if(!preset)return;if(preset.sourceId!==project.id){$('libraryStatus').textContent=T('完整恢复仅适用于该预设的原工程；其他工程请粘贴可迁移样式。');return;}commit(copy(preset.sourceState),T('已恢复成稿全部参数'));};
  $('pasteCurrent').onclick=guard(async()=>{const preset=presetRecords.find(p=>p.id===$('presetChoice').value);if(preset)pastePreset(preset);});
  $('exportLibrary').onclick=guard(async()=>{await collectFigure();await renderLibrary();await download(projectFileBlob({format:'figure-studio-library-v1',figures:libraryRecords,presets:presetRecords}),'figure-studio-library.json');});
  $('importLibrary').onclick=()=>$('libraryFiles').click();
  $('libraryFiles').onchange=guard(async()=>{
    const records=[],presets=[];for(const file of $('libraryFiles').files){if(file.size>PROJECT_FILE_LIMIT)throw Error(T('工程超过 200 MB，请拆分工程后保存。'));const input=JSON.parse(await file.text());if(input.format==='figure-studio-library-v1'){if(!Array.isArray(input.figures)||!Array.isArray(input.presets))throw Error(T('该工程需要重新导入'));records.push(...input.figures);presets.push(...input.presets);}else{validatePayload(input);records.push({id:input.project.id,name:input.project.title||input.project.id,updatedAt:new Date().toISOString(),payload:input});}}
    for(const r of records){validatePayload(r.payload);if(r.id!==r.payload.project.id||typeof r.name!=='string'||typeof r.updatedAt!=='string')throw Error(T('该工程需要重新导入'));}
    for(const p of presets){const source=records.find(r=>r.id===p.sourceId)||libraryRecords.find(r=>r.id===p.sourceId);if(!source||typeof p.id!=='string'||typeof p.name!=='string'||!Array.isArray(p.profile))throw Error(T('该工程需要重新导入'));validateState(p.sourceState,source.payload.project);}
    // Imports with existing IDs retain existing local edits; new figures are added.
    const existing=new Set((await StudioLibrary.list('figures')).map(r=>r.id));for(const r of records)if(!existing.has(r.id))await libraryWrite(r);
    const existingPresets=new Set((await StudioLibrary.list('presets')).map(p=>p.id));for(const p of presets)if(!existingPresets.has(p.id))await StudioLibrary.put('presets',p);
    $('libraryFiles').value='';await renderLibrary();
  });
  StudioLibrary.list('figures').then(records=>records.forEach(r=>libraryIds.add(r.id))).catch(()=>{});

  $('save').onclick=guard(async()=>{const signature=saveSignature();if(await download(projectFileBlob(currentPayload()),'figure-studio-project.json')===false)return;savedCurrent=signature;learnPreferences();say(T('已下载工程；包含原图、当前修改和版本。'));});
  $('load').onclick=()=>{const input=$('projectFile');input.value='';input.click();};
  $('projectFile').onchange=guard(async()=>{
    const file=$('projectFile').files[0];if(!file)return;if(file.size>PROJECT_FILE_LIMIT)throw Error(T('工程超过 200 MB，请拆分工程后保存。'));
    const payload=JSON.parse(await file.text());validateProject(payload.project);validateState(payload.state,payload.project);
    const restoredHistory=History.restore(payload.history,payload.project,payload.state);
    if(!Array.isArray(payload.checkpoints)||payload.checkpoints.length>20)throw Error(T('版本无效'));
    for(const c of payload.checkpoints){if(typeof c.name!=='string'||c.name.length>60)throw Error(T('版本名称无效'));validateState(c.state,payload.project);}
    if(!confirm(T('打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。')))return;
    project=payload.project;history=restoredHistory;checkpoints=payload.checkpoints;dataDrafts=copy(payload.dataDrafts||{});dataSerial++;selectedPanel=state().order[0];selected=[];templateCache.clear();original=false;migrateLabelHistory();savedCurrent=saveSignature();knownCache=undefined;persist();render();say(T('工程已恢复'));$('projectFile').value='';
  });
  $('dimensions').onclick=()=>{$('exportOptions').open=true;$('exportOptions').scrollIntoView({block:'nearest'});$('exportWidth').focus();};
  function currentOutput(){const l=layout();return exportGeometry(l.width,l.height,state().exportSettings);}
  function setOutputWidth(width){const next=copy(state());next.exportSettings={widthMm:width,dpi:+$('exportDpi').value};commit(next,T('已等比例调整投稿尺寸'));}
  $('exportWidth').onchange=()=>setOutputWidth(+$('exportWidth').value);
  $('exportHeight').onchange=()=>{const l=layout();setOutputWidth(+$('exportHeight').value*l.width/l.height);};
  $('exportDpi').onchange=()=>setOutputWidth(currentOutput().widthMm);
  $('exportPreset').onchange=()=>{if($('exportPreset').value)setOutputWidth(+$('exportPreset').value);};
  // Property choices apply immediately. Numeric/text fields commit on Enter or blur.
  const directProperties={applyGrid:['rows','columns'],applySpan:['rowSpan','colSpan'],applyPanelLabel:['panelLabel','labelX','labelY','labelSize','labelBold'],applyText:['textContent'],applyOverlay:['overlayText']};
  for(const [action,fields] of Object.entries(directProperties))for(const id of fields){const input=$(id);input.onchange=()=>$(action).click();}
  for(const input of document.querySelectorAll('.navigator input,.inspector input')){
    if(!['number','text'].includes(input.type)||input.onkeydown||!input.onchange)continue;
    // Enter must submit explicitly: blur alone does not reliably emit change.
    // A subsequent native change event must not add a second undo step.
    const change=input.onchange;let submittedValue=null;
    input.addEventListener('input',()=>{submittedValue=null;});
    input.onchange=e=>{if(submittedValue===input.value)return;change.call(input,e);submittedValue=input.value;};
    input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();input.onchange(e);}};
  }
  for(const id of ['applyGrid','applySpan','applyPanelLabel','applyText','applyOverlay','applyFont','applyColor','applyStroke','applyScale'])$(id).hidden=true;

  $('resetOutputSize').onclick=()=>{const next=copy(state());delete next.exportSettings;commit(next,T('已恢复原始物理尺寸'));};
  async function rasterResolution(svg,dpi){
    const images=[...svg.querySelectorAll('image')];if(!images.length)return '';
    const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;visibility:hidden;pointer-events:none';host.append(svg);document.body.append(host);let lowest=Infinity,count=0;
    try{for(const image of images){const box=image.getBoundingClientRect(),src=image.getAttribute('href')||image.getAttributeNS('http://www.w3.org/1999/xlink','href');if(!src||!box.width||!box.height)continue;const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(T('原始栅格图像无法解码')));img.src=src;});const effective=Math.min(img.naturalWidth/(box.width/96),img.naturalHeight/(box.height/96));lowest=Math.min(lowest,effective);if(effective<dpi-1)count++;}}
    finally{svg.remove();host.remove();}
    return count?T('{0} 张原始图片不足目标分辨率，最低约 {1} dpi；放大不能补回细节。',count,Math.round(lowest)):'';
  }
  function assertExportReady(panelId=null){
    if(panelId&&!state().order.includes(panelId))throw Error(T('目标小图已不存在，请重新选择'));
    if(Object.keys(dataDrafts).some(id=>state().order.includes(id)&&(!panelId||id===panelId)))throw Error(T('请先完成或撤销数据修改，再导出图形'));
  }
  function exportTarget(panelId=null,settings=null){
    assertExportReady(panelId);const snapshot=state(),l=layout(snapshot),pos=panelId?l.positions.find(p=>p.id===panelId):null,whole=exportGeometry(l.width,l.height,snapshot.exportSettings);
    const w=pos?pos.width:l.width,h=pos?pos.height:l.height,widthMm=settings?.widthMm??w*whole.scale*25.4/72,dpi=settings?.dpi??whole.dpi;
    if(!Number.isFinite(widthMm)||widthMm<1||widthMm>2000||![600,900,1200].includes(dpi))throw Error(T('导出尺寸或分辨率无效'));
    const output=exportGeometry(w,h,{widthMm,dpi}),svg=composite(false,true,snapshot,panelId);
    svg.setAttribute('width',output.widthPt+'pt');svg.setAttribute('height',output.heightPt+'pt');
    const label=panelId?displayedPanelLabel(snapshot,panelId)?.text:null,name=panelId?'figure-studio-panel-'+(label||String(snapshot.order.indexOf(panelId)+1)):'figure-studio';
    return {svg,output,snapshot,projectId:project.id,name:name.replace(/[<>:"/\\|?*\x00-\x1F]/g,'_').slice(0,100)};
  }
  function updateImageExport(preserveStatus=false){
    if(!exportRequest)return;const format=$('imageExportFormat').value,widthMm=+$('imageExportWidth').value,dpi=+$('imageExportDpi').value,h=widthMm/exportRequest.ratio;
    $('imageExportHeight').value=Number.isFinite(h)?h.toFixed(2):'';$('imageExportDpiLabel').hidden=format==='svg';
    const wpx=Math.round(widthMm/25.4*dpi),hpx=Math.round(h/25.4*dpi),valid=Number.isFinite(widthMm)&&widthMm>=1&&widthMm<=2000;
    const exceeds=format!=='svg'&&(wpx*hpx>(format==='tif'?64000000:120000000)||Math.max(wpx,hpx)>32767);
    $('imageExportDetail').textContent=format==='svg'?T('矢量图形与文字保持可编辑；放大不降低矢量清晰度。'):T('{0} × {1} px · {2} dpi · 锁定纵横比',wpx,hpx,dpi)+(format==='tif'?T(' · RGB TIFF 约 {0} MB',(wpx*hpx*3/1000000).toFixed(1)):'');
    const pending=exportRequest.projectId!==project.id||exportRequest.snapshot!==state()||exportRequest.panelId&&!state().order.includes(exportRequest.panelId)||Object.keys(dataDrafts).some(id=>state().order.includes(id)&&(!exportRequest.panelId||id===exportRequest.panelId));
    if(exceeds||preserveStatus!==true)$('imageExportStatus').textContent=exceeds?T('输出超过浏览器画布容量，请保留投稿尺寸并导出 SVG 后转换。'):pending?T('请先完成或撤销数据修改，再导出图形'):'';
    $('downloadImageExport').disabled=exportBusy||!valid||exceeds||pending;
  }
  async function openImageExport(panelId=null,format='svg'){
    assertExportReady(panelId);const projectId=project.id;await ensureCurrentReflows();await document.fonts.ready;
    if(project.id!==projectId)throw Error(T('目标已变化，请重新选择导入位置'));
    const target=exportTarget(panelId);exportRequest={panelId,projectId,snapshot:target.snapshot,ratio:target.output.widthMm/target.output.heightMm};
    $('imageExportTitle').textContent=T(panelId?'单图另存为…':'导出整张组图');
    $('imageExportScope').textContent=panelId?T('按当前格子边界导出，保留图号、统计标注和编辑；不含网格与操作手柄。'):T('导出整张组图，保留当前排版；不含网格与操作手柄。');
    $('imageExportPreview').replaceChildren(target.svg);$('imageExportFormat').value=format;$('imageExportWidth').value=target.output.widthMm.toFixed(2);$('imageExportDpi').value=String(target.output.dpi);updateImageExport();$('imageExportDialog').showModal();
  }
  async function exportFigure(format,panelId=null,settings=null,expectedSnapshot=null){
    if(exportBusy)return;if(!['svg','png','tif'].includes(format))throw Error(T('文件格式无效'));
    assertExportReady(panelId);if(expectedSnapshot&&state()!==expectedSnapshot)throw Error(T('图形已更新，请关闭后重新打开导出预览'));const projectId=project.id;exportBusy=true;refreshDataExport();let url,canvas;
    try{
      await ensureCurrentReflows();await document.fonts.ready;if(project.id!==projectId)throw Error(T('目标小图已不存在，请重新选择'));if(expectedSnapshot&&state()!==expectedSnapshot)throw Error(T('图形已更新，请关闭后重新打开导出预览'));
      const {svg,output,snapshot,name}=exportTarget(panelId,settings),{widthPx:w,heightPx:h,dpi}=output;
      if(format!=='svg'&&(w*h>(format==='tif'?64000000:120000000)||Math.max(w,h)>32767))throw Error(T('输出超过浏览器画布容量，请保留投稿尺寸并导出 SVG 后转换。'));
      const notice=await rasterResolution(svg,dpi),xml=new XMLSerializer().serializeToString(svg);let blob,filename;
      if(format==='svg'){blob=new Blob([xml],{type:'image/svg+xml'});filename=name+'.svg';}
      else{
        url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(T('SVG 栅格化失败，请使用 SVG 导出')));img.src=url;});
        canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw Error(T('输出超过浏览器画布容量，请保留投稿尺寸并导出 SVG 后转换。'));
        ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
        if(format==='tif'){
          const rgba=ctx.getImageData(0,0,w,h);canvas.width=0;canvas.height=0;const bytes=await StudioTiff.encodeAsync({width:w,height:h,data:rgba.data,dpi,onProgress:f=>{if($('imageExportDialog').open)$('imageExportStatus').textContent=T('正在生成文件… {0}%',Math.round(f*100));}});blob=new Blob([bytes],{type:'image/tiff'});
        }else{const png=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!png)throw Error(T('PNG 导出失败'));blob=new Blob([pngWithDpi(new Uint8Array(await png.arrayBuffer()),dpi)],{type:'image/png'});}
        filename=name+'-'+dpi+'dpi.'+format;
      }
      assertExportReady(panelId);if(project.id!==projectId||state()!==snapshot)throw Error(T('导出期间图形已更新，请重新导出'));
      if(await download(blob,filename)===false){if($('imageExportDialog').open)$('imageExportStatus').textContent=T('保存已取消');return;}
      const status=(format==='svg'?T('已导出可编辑 SVG。'):T('已导出 {0} × {1} px，{2} dpi；物理尺寸 {3} × {4} mm。',w,h,dpi,output.widthMm.toFixed(2),output.heightMm.toFixed(2)))+(notice?' '+notice:'');say(status);if($('imageExportDialog').open)$('imageExportStatus').textContent=status;
    }finally{if(url)URL.revokeObjectURL(url);if(canvas){canvas.width=0;canvas.height=0;}exportBusy=false;refreshDataExport();updateImageExport(true);}
  }
  $('closeImageExport').onclick=()=>{if(!exportBusy)$('imageExportDialog').close();};
  $('imageExportDialog').addEventListener('cancel',e=>{if(exportBusy)e.preventDefault();});
  for(const id of ['imageExportWidth','imageExportFormat','imageExportDpi'])$(id).oninput=updateImageExport;
  $('imageExportHeight').oninput=()=>{if(exportRequest){$('imageExportWidth').value=(+$('imageExportHeight').value*exportRequest.ratio).toFixed(2);updateImageExport();}};
  $('downloadImageExport').onclick=async()=>{if(!exportRequest||exportBusy)return;$('downloadImageExport').disabled=true;$('imageExportStatus').textContent=T('正在生成文件… {0}%',0);try{if(project.id!==exportRequest.projectId)throw Error(T('目标小图已不存在，请重新选择'));if(state()!==exportRequest.snapshot)throw Error(T('图形已更新，请关闭后重新打开导出预览'));await exportFigure($('imageExportFormat').value,exportRequest.panelId,{widthMm:+$('imageExportWidth').value,dpi:+$('imageExportDpi').value},exportRequest.snapshot);}catch(e){$('imageExportStatus').textContent=T('未完成：')+T(e.code==='TIFF_CAPACITY'?'输出超过浏览器画布容量，请保留投稿尺寸并导出 SVG 后转换。':e.message);say($('imageExportStatus').textContent);}finally{updateImageExport(true);}};
  $('export').onclick=guard(()=>exportFigure('svg'));
  $('png').onclick=guard(()=>exportFigure('png'));
  $('tiff').onclick=guard(()=>openImageExport(null,'tif'));
  document.addEventListener('keydown',e=>{if(!e.isComposing&&!editingTextTarget(e.target)&&nudgeGesture){if(e.key==='Escape'){e.preventDefault();finishNudge(false);return;}if(['Delete','Backspace'].includes(e.key)||(e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z')finishNudge(true,true,true);}keyboardNudge(e);});
  document.addEventListener('keyup',e=>{if(!nudgeGesture)return;nudgeGesture.keys.delete(e.key);if(!nudgeGesture.keys.size)finishNudge(true);});
  document.addEventListener('pointerdown',e=>{finishNudge(true,true,true);focusCanvasForKeyboard(e);},true);
  window.addEventListener('blur',()=>finishNudge(true));
  document.addEventListener('keydown',e=>{if(e.isComposing||editingTextTarget(e.target))return;if(['Delete','Backspace'].includes(e.key)&&selectedAlignmentGuide&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();deleteAlignmentGuide();return;}if(['Delete','Backspace'].includes(e.key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(selectionGroups().length||selectedAnnotations.length||selectedPanelLabel)){e.preventDefault();deleteSelectedObjects();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}});
  window.addEventListener('blur',()=>{if(cancelPanelGesture?.()||cancelSelectionGesture?.()||cancelObjectGesture?.())render();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(cancelPanelGesture?.()||cancelSelectionGesture?.()||cancelObjectGesture?.())){e.preventDefault();render();}});
  window.addEventListener('resize',schedulePreviewFit);
  window.addEventListener('beforeunload',e=>{if(history&&saveSignature()!==savedCurrent&&saveSignature()!==localSavedCurrent){e.preventDefault();e.returnValue='';}});
  if($('addHorizontalGuide'))$('addHorizontalGuide').onclick=()=>addAlignmentGuide('y');
  if($('addVerticalGuide'))$('addVerticalGuide').onclick=()=>addAlignmentGuide('x');
  if($('deleteAlignmentGuide'))$('deleteAlignmentGuide').onclick=deleteAlignmentGuide;
  if($('clearAlignmentGuides'))$('clearAlignmentGuides').onclick=()=>{const next=copy(state());next.alignmentGuides=[];selectedAlignmentGuide=null;commit(next,T('已清除对齐参考线'));};
  setupQuickToolbar();
  const workspaceSizing=typeof StudioWorkspace!=='undefined'?StudioWorkspace.init({t:T,resize:schedulePreviewFit}):null;
  try {
    project=JSON.parse($('project').textContent);validateProject(project);desktopSession=project.desktopStarter===true;
    if(desktopSession){try{const last=localStorage.getItem('figure-studio:desktop-last-project');if(last&&/^[a-f0-9]{20}$/.test(last)&&last!==project.id){const recent=await StudioLibrary.get('autosaves',last);if(recent?.payload){validatePayload(recent.payload);project=recent.payload.project;desktopRestoredPayload=recent.payload;}}}catch{}}
    history=new History(project.initialState);selectedPanel=state().order[0];savedCurrent=saveSignature();
    try {knownCache=localStorage.getItem('figure-studio:'+project.id);let saved=desktopRestoredPayload||JSON.parse(knownCache||'null');if(saved?.idb){const record=await StudioLibrary.get('autosaves',project.id);if(!record)throw Error('Missing autosave');saved=record.payload;StudioI18n.restoreDisplayNames(saved.project,project);validateProject(saved.project);project=saved.project;}if(saved){validateState(saved.state,project);if(!Array.isArray(saved.checkpoints)||saved.checkpoints.length>20)throw Error(T('缓存版本无效'));for(const c of saved.checkpoints)validateState(c.state,project);try{history=History.restore(saved.history,project,saved.state);message=T('已恢复本浏览器的自动保存。');}catch{history=new History(saved.state);message=T('当前编辑已恢复，但旧撤销记录不可用。');}checkpoints=saved.checkpoints;dataDrafts=saved.dataDrafts||{};}}catch{message=T('未恢复本地缓存；可用「打开工程」导入已保存项目。');}
    migrateLabelHistory();$('scope').value='panel';render();if(message)say(message);
    if(typeof StudioMobileUI!=='undefined')mobileWorkspace=StudioMobileUI.init({
      viewport:$('viewport'),workspace:document.querySelector('.workspace'),t:T,
      getZoom:()=>zoomView?.zoom??1,zoomAt:(zoom,point)=>applyPreviewZoom(zoom,point),
      fit:()=>{cancelQueuedZoom();applyPreviewZoom(null,null,true);},
      cancelInteraction:()=>{
        cancelQueuedZoom();cancelOverlayPlacement();
        // Run every cancellation hook: a short-circuit would leave a second
        // gesture alive when a two-finger pan takes over an object drag.
        const cancelled=[cancelPanelGesture?.(),cancelSelectionGesture?.(),cancelObjectGesture?.()];
        if(cancelled.some(Boolean))renderCanvas();
      },
      onPanelMore:({anchor})=>{const cell=gridFor(state()).places[selectedPanel],r=anchor.getBoundingClientRect();openInsertMenu(cell,r.left,r.bottom+6,true,true,selectedPanel);},
      onTabChange:name=>{if(name==='canvas')schedulePreviewFit();}
    });
    const previewFitObserver=observePreviewFit();
    if(typeof StudioDuplicateCheck!=='undefined')duplicateCheck=StudioDuplicateCheck.init({
      engine:localEngine,fetch:engineFetch,download:(blob,name)=>download(blob,name).catch(error=>say(T('未完成：')+T(error.message))),say,
      projectId:()=>project.id,
      getReviewRecord:()=>project.imageDuplicateReview||null,
      saveReviewRecord:record=>{
        if(record?.projectId!==project.id)return false;
        StudioDuplicateReview.validate(record,project.id);
        // Review records are immutable and stored once, outside plot undo states.
        const owner=project,previous=project.imageDuplicateReview;project.imageDuplicateReview=record;clearTimeout(duplicateReviewSaveTimer);
        if(previous?.result!==record.result)return persist();
        // Notes update the downloadable project immediately; coalesce disk writes
        // while typing so a large image report cannot stall every keystroke.
        $('autosaveStatus').textContent=T('正在保存…');
        duplicateReviewSaveTimer=setTimeout(()=>{if(project===owner)persist();},300);return true;
      },
      resolveRefs:refs=>StudioDuplicateReview.resolve(refs,StudioDuplicateCheck.collect(original?composite(false):$('artboard'),{variant:id=>state().panels[id].variant})),
      snapshot:()=>({projectId:project.id,state:state()}),isSnapshot:value=>!!value&&value.projectId===project.id&&value.state===state(),
      collect:scope=>StudioDuplicateCheck.collect($('artboard'),{scope,groups:selectionGroups(),panels:panelSelection,label:id=>StudioI18n.panelName(panel(id)),variant:id=>state().panels[id].variant}),
      locate:refs=>{
        refs=StudioDuplicateReview.resolve(refs,StudioDuplicateCheck.collect(original?composite(false):$('artboard'),{variant:id=>state().panels[id].variant}));if(!refs)return false;
        const groups=[];
        for(const ref of refs){if(!state().panels[ref.panelId]||state().panels[ref.panelId].variant!==ref.vi||!ref.key)return false;
          const host=[...$('artboard').querySelectorAll('svg[data-panel]')].find(el=>el.dataset.panel===ref.panelId),target=host&&[...host.querySelectorAll('[data-key]')].find(el=>el.dataset.key===ref.key);if(!target)return false;
          let group=groups.find(item=>item.id===ref.panelId);if(!group){group={id:ref.panelId,vi:ref.vi,keys:[]};groups.push(group);}if(!group.keys.includes(ref.key))group.keys.push(ref.key);
        }
        if(!groups.length)return false;original=false;layoutMode=false;setElementSelection(groups);activePane='detail';$('scope').value='element';render();
        const targets=[];for(const ref of refs){const host=[...$('artboard').querySelectorAll('svg[data-panel]')].find(el=>el.dataset.panel===ref.panelId),target=host&&[...host.querySelectorAll('[data-key]')].find(el=>el.dataset.key===ref.key);if(target){target.classList.add('duplicate-located');targets.push(target);}}
        // Fit the union, so both matched sources remain visible even in distant cells.
        const viewport=$('viewport'),area=StudioDuplicateReview.bounds(targets.map(el=>el.getBoundingClientRect()));
        if(area&&zoomView){cancelQueuedZoom();const factor=Math.min(Math.max(1,viewport.clientWidth-72)/area.width,Math.max(1,viewport.clientHeight-72)/area.height);applyPreviewZoom(Math.min(4,zoomView.zoom*factor),{x:area.left+area.width/2,y:area.top+area.height/2});
          const after=StudioDuplicateReview.bounds(targets.map(el=>el.getBoundingClientRect())),box=viewport.getBoundingClientRect();if(after){viewport.scrollLeft+=after.left+after.width/2-box.left-viewport.clientLeft-viewport.clientWidth/2;viewport.scrollTop+=after.top+after.height/2-box.top-viewport.clientTop-viewport.clientHeight/2;}
        }return true;
      }
    });
    persist();
  } catch(e){const div=document.createElement('div');div.className='fatal';div.textContent=T('无法打开工程：')+T(e.message);document.body.replaceChildren(div);}finally{document.body.inert=false;}
})();
