/* Figure Studio: original assets + reversible style differences. No network or libraries. */
'use strict';
const copy = x => JSON.parse(JSON.stringify(x));
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
}
const EDIT_KEYS = new Set(['fill', 'stroke', 'opacity', 'font-family', 'font-size', 'font-weight', 'text']);
function validValue(key, value) {
  if (typeof value !== 'string') return false;
  if (key === 'text') return value.length <= 500;
  if (key === 'fill' || key === 'stroke') return /^#[0-9a-f]{6}$/i.test(value);
  if (key === 'opacity') return Number.isFinite(+value) && +value >= .05 && +value <= 1;
  if (key === 'font-size') return Number.isFinite(+value) && +value >= .1 && +value <= 1000;
  if (key === 'font-family') return ['Arial', 'Times New Roman', 'DejaVu Sans', 'Calibri', 'SimSun'].includes(value);
  if (key === 'font-weight') return ['400', '700'].includes(value);
  return false;
}
function validateState(state, project) {
  if (!state || !Array.isArray(state.order) || state.order.length !== project.panels.length ||
      new Set(state.order).size !== state.order.length || !Number.isInteger(state.columns) || state.columns < 1 || state.columns > 6 ||
      !Number.isFinite(state.gap) || state.gap < 0 || state.gap > 100) throw Error('工程布局无效');
  for (const p of project.panels) {
    if (!state.order.includes(p.id)) throw Error('面板顺序无效');
    const s = state.panels?.[p.id];
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
if (typeof module !== 'undefined') module.exports = {History, validateState, complementary};

if (typeof document !== 'undefined') (() => {
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const DRAW = 'path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use,image';
  const TAGS = new Set(['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','use','clipPath','linearGradient','radialGradient','stop','image','title','desc']);
  const ATTRS = new Set(['id','x','y','x1','y1','x2','y2','dx','dy','cx','cy','r','rx','ry','width','height','viewBox','preserveAspectRatio','d','points','transform','fill','stroke','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','clip-path','font-family','font-size','font-style','font-weight','text-anchor','dominant-baseline','alignment-baseline','baseline-shift','textLength','lengthAdjust','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','clipPathUnits','href','version','color']);
  const STYLES = new Set(['fill','stroke','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','clip-path','font','font-family','font-size','font-style','font-weight','font-stretch','font-variant','text-anchor','dominant-baseline','alignment-baseline','baseline-shift','stop-color','stop-opacity','color']);
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
  const palettes = [ ['克制蓝橙',['#4477aa','#ee7733','#228833','#cc6677','#aa3377','#66ccee']], ['Okabe–Ito',['#0072b2','#d55e00','#009e73','#cc79a7','#e69f00','#56b4e9']], ['柔和科研',['#487b8d','#d78c66','#7b9c85','#b989a2','#b7a15a','#7385aa']] ];
  let project, history, checkpoints = [], selectedPanel, selected = [], original = false, templateCache = new Map(), renderSerial = 0, saveTimer;
  let savedCurrent = '', message = '';
  let activePane = 'explore';
  function showPane(name) {
    activePane=name;
    document.querySelectorAll('[data-pane]').forEach(el=>{el.hidden=el.getAttribute('data-pane')!==name;});
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-pressed',String(el.getAttribute('data-tab')===name));});
    $('textRole').parentElement.hidden=name!=='detail';
    renderCanvas();
  }
  const state = () => history.current;
  const saveSignature = () => JSON.stringify({state:state(),checkpoints});
  const panel = id => project.panels.find(p => p.id === id);
  const variant = id => panel(id).variants[state().panels[id].variant];
  const say = text => { message = text; $('status').textContent = text; };
  function safeValue(value) {
    if (/[<>]|(?:javascript|expression|@import|https?:|file:)/i.test(value)) return false;
    const urls = [...value.matchAll(/url\((.*?)\)/gi)];
    return urls.every(m => /^\s*['"]?#[\w.:-]+['"]?\s*$/.test(m[1]));
  }
  function sanitize(text) {
    if (typeof text !== 'string' || text.length > 20000000 || /<!ENTITY/i.test(text)) throw Error('SVG 无效或超过大小限制');
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') throw Error('无法解析 SVG');
    const root = xml.documentElement;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.localName === 'metadata') { el.remove(); continue; }
      if (el.localName === 'style') {
        if (!/^\s*\*\s*\{\s*stroke-linejoin:\s*round;\s*stroke-linecap:\s*butt\s*\}\s*$/.test(el.textContent)) throw Error('请先把 SVG 样式表转换为行内样式');
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
    [root, ...root.querySelectorAll('*')].forEach((el, i) => el.setAttribute('data-key', 'e' + i));
    for (const el of root.querySelectorAll('text,tspan')) {
      const ids = []; let p = el;
      while (p && p !== root) { ids.push(p.id || ''); p = p.parentElement; }
      const role = ids.some(x=>/^legend/.test(x)) ? 'legend' : ids.some(x=>/^[xy]tick/.test(x)) ? 'ticks' : ids.some(x=>/^matplotlib.axis/.test(x)) ? 'axis' : 'other';
      el.setAttribute('data-role', role);
    }
    return document.importNode(root, true);
  }
  function validateProject(p) {
    if (p?.schema !== 'figure-studio/1' || !/^[a-f0-9]{20}$/.test(p.id) || typeof p.title !== 'string' || !Array.isArray(p.panels) || !p.panels.length || p.panels.length > 24) throw Error('不是受支持的 Figure Studio 工程');
    const ids = new Set();
    for (const pan of p.panels) {
      if (!/^panel-\d+$/.test(pan.id) || ids.has(pan.id) || typeof pan.name !== 'string' || !Array.isArray(pan.variants) || !pan.variants.length || pan.variants.length > 64) throw Error('工程面板无效');
      ids.add(pan.id);
      const first = pan.variants[0];
      for (const v of pan.variants) {
        if (typeof v.name !== 'string' || !Number.isFinite(v.width) || !Number.isFinite(v.height) || Math.min(v.width,v.height) <= 0 || Math.max(v.width,v.height) > 14400 || !Array.isArray(v.viewBox) || v.viewBox.length!==4 || !v.viewBox.every(Number.isFinite) || Math.min(...v.viewBox.slice(2))<=0 || Math.abs(v.width/v.viewBox[2] - v.height/v.viewBox[3])>1e-5) throw Error('SVG 尺寸无效');
        if (Math.abs(v.width-first.width)>1e-4 || Math.abs(v.height-first.height)>1e-4 || JSON.stringify(v.viewBox)!==JSON.stringify(first.viewBox)) throw Error('候选图画布不一致');
        sanitize(v.svg);
      }
    }
    validateState(p.initialState, p);
  }
  function baseSvg(id, vi) {
    const key = id + '/' + vi;
    if (!templateCache.has(key)) templateCache.set(key, sanitize(panel(id).variants[vi].svg));
    return templateCache.get(key).cloneNode(true);
  }
  function isVisibleObject(el) { return el.matches(DRAW) && !el.closest('defs,clipPath'); }
  function keysToObjects(svg) { return [...svg.querySelectorAll(DRAW)].filter(isVisibleObject); }
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
  function editedSvg(id, vi, s=state(), raw=false) {
    const svg = baseSvg(id,vi);
    if (!raw) for (const [key, props] of Object.entries(editsFor(id,vi,s))) {
      const el=svg.querySelector(`[data-key="${key}"]`); if (!el) continue;
      for (const [prop,val] of Object.entries(props)) {
        if (prop==='text') { if (el.matches('text,tspan') && !el.children.length) el.textContent=val; }
        else el.style.setProperty(prop, prop==='font-size' ? val+'px' : val);
      }
    }
    return svg;
  }
  function namespace(svg) {
    const prefix = 'f' + (++renderSerial) + '-';
    for (const el of [svg,...svg.querySelectorAll('*')]) {
      if (el.id) el.id=prefix+el.id;
      for (const a of [...el.attributes]) {
        if (a.localName==='href' && a.value.startsWith('#')) a.value='#'+prefix+a.value.slice(1);
        else if (/url\(/i.test(a.value)) a.value=a.value.replace(/url\(\s*['"]?#([^\s)'" ]+)['"]?\s*\)/g,(_,id)=>`url(#${prefix}${id})`);
      }
    }
    return svg;
  }
  function layout(s=state()) {
    const widths=Array(s.columns).fill(0), heights=Array(Math.ceil(s.order.length/s.columns)).fill(0);
    s.order.forEach((id,i)=>{ const v=panel(id).variants[s.panels[id].variant]; widths[i%s.columns]=Math.max(widths[i%s.columns],v.width); heights[Math.floor(i/s.columns)]=Math.max(heights[Math.floor(i/s.columns)],v.height); });
    const effective= Math.min(s.columns,s.order.length);
    return {width:widths.slice(0,effective).reduce((a,b)=>a+b,0)+s.gap*(effective-1),height:heights.reduce((a,b)=>a+b,0)+s.gap*(heights.length-1),positions:s.order.map((id,i)=>({id,x:widths.slice(0,i%s.columns).reduce((a,b)=>a+b,0)+s.gap*(i%s.columns),y:heights.slice(0,Math.floor(i/s.columns)).reduce((a,b)=>a+b,0)+s.gap*Math.floor(i/s.columns)}))};
  }
  function composite(raw=false, exportMode=false, s=state()) {
    const l=layout(s), root=document.createElementNS(NS,'svg');
    root.setAttribute('xmlns',NS);root.setAttribute('viewBox',`0 0 ${l.width} ${l.height}`); root.setAttribute('width',l.width+'pt');root.setAttribute('height',l.height+'pt');
    for (const pos of l.positions) {
      const vi=s.panels[pos.id].variant,v=panel(pos.id).variants[vi],svg=namespace(editedSvg(pos.id,vi,s,raw));
      svg.setAttribute('x',pos.x);svg.setAttribute('y',pos.y);svg.setAttribute('width',v.width);svg.setAttribute('height',v.height);svg.setAttribute('data-panel',pos.id);
      if (!exportMode && !raw && pos.id===selectedPanel && s.panels[pos.id].variant===state().panels[pos.id].variant) for (const key of selected) svg.querySelector(`[data-key="${key}"]`)?.classList.add('chosen');
      root.append(svg);
    }
    if (exportMode) for (const el of [root,...root.querySelectorAll('*')]) for (const a of [...el.attributes]) if (a.name.startsWith('data-') || a.name==='class') el.removeAttributeNode(a);
    return root;
  }
  function persist() {
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
      try {localStorage.setItem('figure-studio:'+project.id,JSON.stringify({state:state(),checkpoints}));}
      catch {say('浏览器本地空间不足或不可用，请点击「保存工程」下载当前修改。');}
    },180);
  }
  function commit(next,label) {if(history.commit(next)){original=false;persist();render();say(label+' · 已记录，可撤销');}}
  function setEdit(next,id,vi,key,prop,value) {
    const edits=next.panels[id].edits; edits[vi] ||= {}; edits[vi][key] ||= {}; edits[vi][key][prop]=value;
  }
  function targetObjects(id,vi,svg,kind) {
    const scope=$('scope').value, selectedHere=id===selectedPanel && vi===state().panels[id].variant;
    let objects=keysToObjects(svg);
    if(scope==='element') objects=selectedHere ? objects.filter(el=>selected.includes(el.getAttribute('data-key'))) : [];
    else if(scope==='sameColor') {
      if(!selectedHere) return [];
      const chosen=svg.querySelector(`[data-key="${selected[0] || ''}"]`);
      if(!chosen) return [];
      const color=hex(paint(chosen,'fill')) || hex(paint(chosen,'stroke'));
      objects=objects.filter(el=>color && ['fill','stroke'].some(prop=>hex(paint(el,prop))===color));
    }
    if(kind==='text') objects=objects.filter(el=>el.matches('text,tspan') && ($('textRole').value==='all'||el.getAttribute('data-role')===$('textRole').value));
    // Parent text already carries the style; avoid multiplying opacity through tspans.
    return objects.filter(el=>!objects.some(parent=>parent!==el && parent.contains(el)));
  }
  function updateStyle(prop,value,kind='all',extras={},previewOnly=false) {
    if(original) return say('请先退出原版对照。');
    const scope=$('scope').value;
    if((scope==='element'||scope==='sameColor')&&!selected.length)return say('请先点选图内元素。');
    const next=copy(state());let changed=0;
    for(const id of scope==='all'?next.order:[selectedPanel]) {
      const vs=(scope==='all'||scope==='panel')?panel(id).variants.map((_,i)=>i):[next.panels[id].variant];
      for(const vi of vs){const svg=editedSvg(id,vi);for(const el of targetObjects(id,vi,svg,kind)){
        const key=el.getAttribute('data-key');
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
            if(property==='font-size') final=String(+requested*panel(id).variants[vi].viewBox[2]/panel(id).variants[vi].width);
            if(validValue(property,final)){
              setEdit(next,id,vi,key,property,final);changed++;
              // Preserve run-level italics and sub/superscript size ratios.
              if(el.localName==='text' && (property==='font-family'||property==='font-size')) {
                const oldSize=parseFloat(el.style.fontSize||el.getAttribute('font-size')||'12');
                for(const child of el.querySelectorAll('tspan')) {
                  if(property==='font-family')setEdit(next,id,vi,child.getAttribute('data-key'),property,final);
                  else {const size=parseFloat(child.style.fontSize||child.getAttribute('font-size')||'');if(Number.isFinite(size)&&oldSize>0)setEdit(next,id,vi,child.getAttribute('data-key'),property,String(size*Number(final)/oldSize));}
                }
              }
            }
          }
        }
      }}
    }
    if(changed){if(previewOnly){renderCanvas(next);say('实时预览 · 松开滑块或确认颜色后记录一次修改');}else commit(next,'已更新 '+changed+' 个属性');}else say('当前范围没有适用元素。黑白坐标与连续色标不参与整图改色。');
  }
  function paletteState(colors) {
    const next=copy(state()),scope=$('scope').value;
    for(const id of scope==='all'?next.order:[selectedPanel]) for(let vi=0;vi<panel(id).variants.length;vi++) {
      if((scope==='element'||scope==='sameColor')&&vi!==next.panels[id].variant)continue;
      const svg=editedSvg(id,vi),base=baseSvg(id,vi);
      const targets=targetObjects(id,vi,svg,'all');
      const targetKeys=new Set(targets.map(el=>el.getAttribute('data-key')));
      const allColors=[];
      for(const el of keysToObjects(base)){
        if((scope==='element'||scope==='sameColor')&&!targetKeys.has(el.getAttribute('data-key')))continue;
        for(const prop of ['fill','stroke']){const h=hex(paint(el,prop));if(h&&chromatic(h)&&!allColors.includes(h))allColors.push(h);}
      }
      // No cycling a six-colour categorical palette over a continuous colour scale.
      if(allColors.length>colors.length)continue;
      for(const el of targets) {
        if(el.localName==='image')continue;
        const originalEl=base.querySelector(`[data-key="${el.getAttribute('data-key')}"]`);
        for(const prop of ['fill','stroke']){const i=allColors.indexOf(hex(paint(originalEl,prop)));if(i>=0)setEdit(next,id,vi,el.getAttribute('data-key'),prop,colors[i]);}
      }
    }
    return next;
  }
  function preview(svg) {namespace(svg);svg.removeAttribute('width');svg.removeAttribute('height');return svg;}
  function button(text,action){const b=document.createElement('button');b.textContent=text;b.onclick=action;return b;}
  function drawPalettes() {
    $('palettes').replaceChildren();
    for(const [name,colors] of palettes) {
      const next=paletteState(colors),b=button('',()=>commit(next,'已应用 '+name));b.className='palette';
      b.onmouseenter=()=>{renderCanvas(next);say('预览 '+name+' · 点击应用，移开还原');};b.onmouseleave=()=>{renderCanvas();say('已返回当前编辑版');};
      const sw=document.createElement('div');sw.className='swatches';colors.forEach(c=>{const i=document.createElement('i');i.style.background=c;sw.append(i);});
      const label=document.createElement('span');label.textContent=name;b.append(sw,preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)),label);$('palettes').append(b);
    }
    $('complementPreview').replaceChildren();
  }
  function renderInspector() {
    const pan=panel(selectedPanel),vi=state().panels[selectedPanel].variant;
    $('selectionTitle').textContent=selected.length?`已选 ${selected.length} 个元素`:'当前小图 · '+pan.name;
    $('textContent').value='';$('textContent').disabled=true;$('applyText').disabled=true;
    if(selected.length===1){const svg=editedSvg(selectedPanel,vi),el=svg.querySelector(`[data-key="${selected[0]}"]`);if(el){
      const fill=hex(paint(el,'fill')),stroke=hex(paint(el,'stroke'));
      const h=(fill&&chromatic(fill)?fill:null)||(stroke&&chromatic(stroke)?stroke:null)||fill||stroke;if(h)$('color').value=h;
      const size=parseFloat(el.style.fontSize||el.getAttribute('font-size')||'');if(Number.isFinite(size))$('fontSize').value=(size*pan.variants[vi].width/pan.variants[vi].viewBox[2]).toFixed(1);
      const family=(el.style.fontFamily||el.getAttribute('font-family')||'').replace(/["']/g,'');if([...$('font').options].some(o=>o.value===family))$('font').value=family;
      const alpha=parseFloat(el.style.opacity||el.getAttribute('opacity')||'1');$('opacity').value=String(alpha*100);$('opacityValue').value=Math.round(alpha*100)+'%';
      if(el.matches('text,tspan')&&!el.children.length){$('textContent').value=el.textContent;$('textContent').disabled=false;$('applyText').disabled=false;}
    }}
    $('candidates').replaceChildren();
    $('candidateHint').textContent=pan.variants.length>1?'来自同一上游绘图包；预览使用真实 SVG。不同形式的统计含义请查看分析记录。':'单独导入的 SVG 无数据驱动候选；需先用原 skill 生成候选图包。';
    pan.variants.forEach((v,i)=>{const b=button('',()=>{const next=copy(state());next.panels[selectedPanel].variant=i;selected=[];commit(next,'已切换候选图');});b.className='candidate'+(i===vi?' active':'');b.setAttribute('aria-label',names[v.name]||v.name);
      b.onmouseenter=()=>{const next=copy(state());next.panels[selectedPanel].variant=i;renderCanvas(next);say('整图预览：'+(names[v.name]||v.name)+' · 点击应用，移开还原');};b.onmouseleave=()=>{renderCanvas();say('已返回当前编辑版');};
      const text=document.createElement('span');text.textContent=names[v.name]||v.name;
      const explanation=document.createElement('small'),hint=insights[v.name];explanation.className='candidate-insight';explanation.textContent=hint?'适合：'+hint[0]+'。'+hint[1]:'由上游分析流程提供；请结合下方分析记录判断它适合回答的问题。';
      b.append(preview(editedSvg(selectedPanel,i)),text,explanation);$('candidates').append(b);});
    drawPalettes();
    $('dataInfo').replaceChildren();
    const dataNote=document.createElement('p');dataNote.className='muted';dataNote.textContent=pan.table?'原始表只读，外观调整不改变分析。':'未嵌入原始表；下方仅显示已有配方与分析。';$('dataInfo').append(dataNote);
    if(pan.table?.rows){const wrap=document.createElement('div');wrap.className='table-scroll';const table=document.createElement('table');for(const [i,row]of pan.table.rows.slice(0,101).entries()){const tr=document.createElement('tr');for(const value of row){const td=document.createElement(i===0?'th':'td');td.textContent=String(value);tr.append(td);}table.append(tr);}wrap.append(table);$('dataInfo').append(wrap);}
    const pre=document.createElement('pre');pre.textContent=JSON.stringify({recipe:pan.recipe,analysis:pan.analysis},null,2);$('dataInfo').append(pre);
    $('qa').replaceChildren();const svg=editedSvg(selectedPanel,vi);
    const items=[`当前小图：${svg.querySelectorAll('text').length} 个文字对象，${svg.querySelectorAll('image').length} 个栅格图层。`,'配色、字号修改后需重新核对碰撞与可读性。','工程只保存外观差异；新数据请从分析流程重新生成。'];
    if(!svg.querySelector('text'))items.push('本图没有可编辑文字，路径化或栅格文字不能直接改字体。');
    for(const text of items){const li=document.createElement('li');li.textContent=text;$('qa').append(li);}
  }
  function renderCanvas(previewState=state()) {
    if(!previewState?.order)previewState=state();
    const svg=composite(original,false,previewState),l=layout(previewState);$('artboard').replaceChildren(svg);
    const widthPx=l.width*96/72,zoom=$('zoom').value==='fit'?Math.min(1,Math.max(200,$('viewport').clientWidth-48)/widthPx):+$('zoom').value;
    svg.style.width=widthPx*zoom+'px';svg.style.height=l.height*96/72*zoom+'px';
    $('dimensions').textContent=`${(l.width*25.4/72).toFixed(1)} × ${(l.height*25.4/72).toFixed(1)} mm · 原尺寸拼版`;
    svg.onclick=event=>{
      if(original)return;
      const pan=event.target.closest('[data-panel]');if(!pan)return;
      const id=pan.getAttribute('data-panel'),el=event.target.closest('[data-key]');
      if(id!==selectedPanel){selectedPanel=id;selected=[];}
      if(el && isVisibleObject(el)) {const key=el.getAttribute('data-key');selected=event.shiftKey?(selected.includes(key)?selected.filter(k=>k!==key):[...selected,key]):[key];$('scope').value='element';activePane='detail';}
      else selected=[];
      render();
    };
  }
  function render() {
    $('projectTitle').textContent=project.title;$('columns').value=state().columns;$('gap').value=state().gap;
    $('undo').disabled=history.index===0;$('redo').disabled=history.index===history.states.length-1;
    $('compare').textContent=original?'返回编辑版':'查看原版';
    $('panels').replaceChildren();state().order.forEach((id,i)=>{const b=button('',()=>{selectedPanel=id;selected=[];$('scope').value='panel';activePane='explore';render();});b.className='panel-button'+(id===selectedPanel?' active':'');b.setAttribute('aria-label','选择面板 '+(i+1));const n=document.createElement('b');n.textContent=String(i+1).padStart(2,'0');const name=document.createElement('span');name.textContent=panel(id).name;b.append(n,name);$('panels').append(b);});
    $('versions').replaceChildren();for(const saved of checkpoints)$('versions').append(button(saved.name,()=>{selected=[];commit(saved.state,'已恢复版本 '+saved.name);}));
    renderCanvas();renderInspector();showPane(activePane);
  }
  function download(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function svgText(){return new XMLSerializer().serializeToString(composite(false,true));}
  function guard(fn) {return async(...args)=>{try{await fn(...args);}catch(e){say('未完成：'+e.message);}};}
  $('undo').onclick=()=>{history.undo();selected=[];original=false;render();persist();say('已撤销');};
  $('redo').onclick=()=>{history.redo();selected=[];original=false;render();persist();say('已重做');};
  $('compare').onclick=()=>{original=!original;renderCanvas();$('compare').textContent=original?'返回编辑版':'查看原版';say(original?'原版对照：当前布局与候选，未应用外观修改。':'已返回编辑版');};
  $('reset').onclick=()=>{selected=[];commit(project.initialState,'已恢复 AI 首版；仍可撤销此次恢复');};
  $('scope').onchange=drawPalettes;$('textRole').onchange=()=>say('文字类别已选择，下一次文字样式操作将使用此范围。');
  document.querySelectorAll('[data-tab]').forEach(el=>{el.onclick=()=>showPane(el.getAttribute('data-tab'));});
  $('applyColor').onclick=()=>updateStyle('color',$('color').value);
  $('color').oninput=()=>updateStyle('color',$('color').value,'all',{},true);
  $('color').onchange=()=>updateStyle('color',$('color').value);
  $('opacity').oninput=()=>{$('opacityValue').value=$('opacity').value+'%';updateStyle('opacity',String(+$('opacity').value/100),'all',{},true);};
  $('opacity').onchange=()=>updateStyle('opacity',String(+$('opacity').value/100));
  $('applyFont').onclick=()=>{const n=+$('fontSize').value;if(!Number.isFinite(n)||n<4||n>72)return say('字号应为 4–72 pt。');updateStyle('font-family',$('font').value,'text',{'font-size':String(n)});};
  $('bold').onclick=()=>{
    const vi=state().panels[selectedPanel].variant,svg=editedSvg(selectedPanel,vi),objects=targetObjects(selectedPanel,vi,svg,'text');
    const allBold=objects.length&&objects.every(el=>['bold','700'].includes(el.style.fontWeight||el.getAttribute('font-weight')));
    updateStyle('font-weight',allBold?'400':'700','text');
  };
  $('applyText').onclick=()=>{if(selected.length!==1)return;const next=copy(state());setEdit(next,selectedPanel,next.panels[selectedPanel].variant,selected[0],'text',$('textContent').value);commit(next,'已修改文字；请核对标签与数据含义');};
  $('complement').onclick=()=>{
    const base=$('color').value,other=complementary(base),next=paletteState([base,other]);
    const b=button('',()=>commit(next,'已应用互补配色'));b.className='palette';const label=document.createElement('span');label.textContent=base+' + '+other+' · 点击应用（不代表色觉无障碍已验证）';b.append(preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)),label);$('complementPreview').replaceChildren(b);
  };
  $('columns').onchange=()=>{const next=copy(state());next.columns=+$('columns').value;commit(next,'已修改列数');};
  $('gap').onchange=()=>{const n=+$('gap').value;if(!Number.isFinite(n)||n<0||n>100)return say('间距应为 0–100 pt。');const next=copy(state());next.gap=n;commit(next,'已修改间距');};
  $('zoom').onchange=renderCanvas;
  for(const [name,delta]of[['moveUp',-1],['moveDown',1]])$(name).onclick=()=>{const next=copy(state()),i=next.order.indexOf(selectedPanel),j=i+delta;if(j<0||j>=next.order.length)return;[next.order[i],next.order[j]]=[next.order[j],next.order[i]];commit(next,'已调整面板顺序');};
  $('checkpoint').onclick=()=>{const name=$('versionName').value.trim();if(!name)return say('请输入版本名称。');if(checkpoints.length>=20)return say('已保存 20 个命名版本，请另存工程后继续整理。');checkpoints.push({name,state:copy(state())});$('versionName').value='';persist();render();say('已保存命名版本「'+name+'」');};
  $('save').onclick=()=>{download(new Blob([JSON.stringify({project,state:state(),checkpoints},null,2)],{type:'application/json'}),'figure-studio-project.json');savedCurrent=saveSignature();say('已下载工程；包含原图、当前修改和命名版本。');};
  $('load').onclick=()=>$('projectFile').click();
  $('projectFile').onchange=guard(async()=>{
    const file=$('projectFile').files[0];if(!file)return;if(file.size>100000000)throw Error('工程超过 100 MB');
    const payload=JSON.parse(await file.text());validateProject(payload.project);validateState(payload.state,payload.project);
    if(!Array.isArray(payload.checkpoints)||payload.checkpoints.length>20)throw Error('命名版本无效');
    for(const c of payload.checkpoints){if(typeof c.name!=='string'||c.name.length>60)throw Error('版本名称无效');validateState(c.state,payload.project);}
    if(!confirm('打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。'))return;
    project=payload.project;history=new History(payload.state);checkpoints=payload.checkpoints;selectedPanel=state().order[0];selected=[];templateCache.clear();original=false;savedCurrent=saveSignature();persist();render();say('工程已恢复');$('projectFile').value='';
  });
  $('export').onclick=()=>{download(new Blob([svgText()],{type:'image/svg+xml'}),'figure-studio.svg');say('已导出可编辑 SVG。请继续运行原 skill 的最终尺寸与排版 QA。');};
  $('png').onclick=guard(async()=>{
    const l=layout(),dpi=300,w=Math.ceil(l.width/72*dpi),h=Math.ceil(l.height/72*dpi);
    if(w*h>40000000)throw Error('300 dpi 输出超过 4000 万像素，请导出 SVG 后用专业工具转换');
    await document.fonts.ready;
    const url=URL.createObjectURL(new Blob([svgText()],{type:'image/svg+xml'}));
    try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('SVG 栅格化失败，请使用 SVG 导出'));img.src=url;});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error('PNG 导出失败');download(blob,'figure-studio-300dpi.png');say(`已导出 ${w} × ${h} px；按 ${(l.width*25.4/72).toFixed(1)} mm 放置约为 300 dpi。PNG 本身不含可编辑文字。`);}finally{URL.revokeObjectURL(url);}
  });
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}});
  window.addEventListener('resize',()=>{if(project)renderCanvas();});
  window.addEventListener('beforeunload',e=>{if(history&&saveSignature()!==savedCurrent){e.preventDefault();e.returnValue='';}});
  try {
    project=JSON.parse($('project').textContent);validateProject(project);history=new History(project.initialState);selectedPanel=state().order[0];savedCurrent=saveSignature();
    try {const saved=JSON.parse(localStorage.getItem('figure-studio:'+project.id)||'null');if(saved){validateState(saved.state,project);if(!Array.isArray(saved.checkpoints)||saved.checkpoints.length>20)throw Error('缓存版本无效');for(const c of saved.checkpoints)validateState(c.state,project);history=new History(saved.state);checkpoints=saved.checkpoints;message='已恢复本浏览器的自动保存。';}}catch{message='未恢复本地缓存；可用「打开工程」导入已保存项目。';}
    $('scope').value='panel';render();if(message)say(message);
  } catch(e){const div=document.createElement('div');div.className='fatal';div.textContent='无法打开工程：'+e.message;document.body.replaceChildren(div);}
})();
