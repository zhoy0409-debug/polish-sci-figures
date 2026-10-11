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
  toJSON(){return {states:this.states,index:this.index};}
  static restore(saved,project,current){
    if(!saved)return new History(current);
    if(!Array.isArray(saved.states)||saved.states.length<1||saved.states.length>81||!Number.isInteger(saved.index)||saved.index<0||saved.index>=saved.states.length)throw Error('撤销记录无效');
    for(const s of saved.states)validateState(s,project);
    if(JSON.stringify(saved.states[saved.index])!==JSON.stringify(current))throw Error('撤销记录与当前状态不一致');
    const h=new History(current);h.states=copy(saved.states);h.index=saved.index;return h;
  }
}
const EDIT_KEYS = new Set(['fill', 'stroke', 'opacity', 'font-family', 'font-size', 'font-weight', 'text', 'stroke-width', 'text-anchor', 'offset-x', 'offset-y']);
function validValue(key, value) {
  if (typeof value !== 'string') return false;
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
function validateState(state, project) {
  if (!state || !Array.isArray(state.order) || state.order.length < 1 || state.order.length > 24 ||
      new Set(state.order).size !== state.order.length || !Number.isInteger(state.columns) || state.columns < 1 || state.columns > 6 ||
      !Number.isFinite(state.gap) || state.gap < 0 || state.gap > 100) throw Error('工程布局无效');
  if(state.overlays){if(!Array.isArray(state.overlays)||state.overlays.length>300||new Set(state.overlays.map(a=>a.id)).size!==state.overlays.length)throw Error('标注参数无效');for(const a of state.overlays){if(!/^annotation-\d+$/.test(a.id)||!['text','line','rect','ellipse'].includes(a.type)||!['x','y','w','h'].every(k=>Number.isFinite(a[k])&&a[k]>=0&&a[k]<=1)||a.x+a.w>1.001||a.y+a.h>1.001||typeof a.text!=='string'||a.text.length>2000||!validValue('fill',a.color)||!validValue('font-family',a.font)||!Number.isFinite(a.size)||a.size<.1||a.size>1000||!Number.isFinite(a.stroke)||a.stroke<=0||a.stroke>100||!Number.isFinite(a.opacity)||a.opacity<.05||a.opacity>1||typeof a.locked!=='boolean'||typeof a.fill!=='boolean'||(a.align&&!['start','middle','end'].includes(a.align)))throw Error('标注参数无效');}}
  if(state.exportSettings&&(!Number.isFinite(state.exportSettings.widthMm)||state.exportSettings.widthMm<20||state.exportSettings.widthMm>2000||![600,900,1200].includes(state.exportSettings.dpi)))throw Error('导出尺寸或分辨率无效');
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
    if(s?.methodChoice&&(!['primary_test','sensitivity_test'].includes(s.methodChoice.key)||!Number.isFinite(p.analysis?.[s.methodChoice.key]?.p_value)||typeof s.methodChoice.reason!=='string'||s.methodChoice.reason.length>500))throw Error('分析选择无效');
    if(s?.errorDirection&&!['both','positive','negative'].includes(s.errorDirection))throw Error('误差棒方向无效');
    if(s?.annotationFont&&(!validValue('font-family',s.annotationFont.font)||!Number.isFinite(s.annotationFont.size)||s.annotationFont.size<4||s.annotationFont.size>1000))throw Error('组图字体参数无效');
    if(s?.annotationStyle&&!['stars','hash','p','letters'].includes(s.annotationStyle))throw Error('标注样式无效');
    if(s?.scales)for(const [vi,entries]of Object.entries(s.scales)){if(!p.variants[vi]||!entries||typeof entries!=='object')throw Error('比例尺参数无效');for(const [key,v]of Object.entries(entries)){if(!/^e\d+$/.test(key)||!Number.isFinite(v.calibration)||v.calibration<=0||!Number.isFinite(v.length)||v.length<=0||v.length>v.calibration*.8||!Number.isFinite(v.thickness)||v.thickness<.5||v.thickness>12||!Number.isFinite(v.size)||v.size<6||v.size>36||!Number.isFinite(v.alpha)||v.alpha<0||v.alpha>1||!['bl','br','tl','tr'].includes(v.position)||!validValue('font-family',v.font)||!validValue('fill',v.color)||typeof v.bold!=='boolean'||typeof v.background!=='boolean')throw Error('比例尺参数无效');}}
    if(s?.label){const l=s.label;if(typeof l.text!=='string'||l.text.length>20||!Number.isFinite(l.x)||l.x<0||l.x>100||!Number.isFinite(l.y)||l.y<0||l.y>100||!Number.isFinite(l.size)||l.size<6||l.size>36||!validValue('font-family',l.font)||typeof l.bold!=='boolean')throw Error('图号参数无效');}
    if(s?.locked!==undefined&&typeof s.locked!=='boolean')throw Error('锁定状态无效');
    for(const field of ['lockedElements','elementGroups'])if(s?.[field])for(const [vi,items]of Object.entries(s[field])){if(!p.variants[vi]||!Array.isArray(items))throw Error('组合状态无效');const keys=field==='elementGroups'?items.flat():items;if(keys.some(k=>typeof k!=='string'||!/^e\d+$/.test(k)))throw Error('组合状态无效');}
    if(s?.geometry && (!Number.isFinite(s.geometry.barWidth)||s.geometry.barWidth<.5||s.geometry.barWidth>1.5||!Number.isFinite(s.geometry.groupGap)||s.geometry.groupGap<.65||s.geometry.groupGap>1.05))throw Error('柱形布局参数无效');
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
function parseDelimited(text,delimiter=','){
  const rows=[];let row=[],cell='',quoted=false;text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!cell||quoted)quoted=!quoted;else throw Error('Invalid quote in table');}
    else if(!quoted&&ch===delimiter){row.push(cell);cell='';}else if(!quoted&&(ch==='\n'||ch==='\r')){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}else cell+=ch;}
  if(quoted)throw Error('Unclosed quote in table');if(cell||row.length){row.push(cell);rows.push(row);}if(rows.length<2||rows.some(r=>r.length!==rows[0].length))throw Error('Table needs a header and consistent columns');return rows;
}
// Append-only assets make replacement and insertion undoable without duplicating image bytes.
function installPanelState(s,oldId,newId,initialVariant,cell){
  const next=copy(s);next.grid=copy(gridFor(s));
  if(oldId){if(s.panels[oldId].locked)throw Error('小图已锁定');const old=s.panels[oldId];next.order=next.order.map(id=>id===oldId?newId:id);next.grid.places[newId]=next.grid.places[oldId];delete next.grid.places[oldId];delete next.panels[oldId];next.panels[newId]={variant:initialVariant,edits:{},...(old.label?{label:copy(old.label)}:{}),...(old.geometry?{geometry:copy(old.geometry)}:{})};if(next.panelGroups)next.panelGroups=next.panelGroups.map(g=>g.map(id=>id===oldId?newId:id));}
  else{if(next.order.length>=24)throw Error('最多同时放置 24 张小图');if(!cell)throw Error('请先选择一个空格');const g=next.grid;if(cell.row<0||cell.col<0||cell.row>=g.rows||cell.col>=next.columns||next.order.some(id=>{const p=g.places[id];return cell.row>=p.row&&cell.row<p.row+p.rs&&cell.col>=p.col&&cell.col<p.col+p.cs;}))throw Error('请选择空格导入图片');next.order.push(newId);next.grid.places[newId]={...cell,rs:1,cs:1};next.panels[newId]={variant:initialVariant,edits:{}};}
  return next;
}
if (typeof module !== 'undefined') module.exports = {History, validateState, complementary, gridFor, arrange, movePanel, resizePanel, comparisonLetters, methodOrder, insertTracks, exportGeometry, pngWithDpi, installPanelState, parseDelimited};

if (typeof document !== 'undefined') (async () => {
  document.body.inert=true;
  const $ = id => document.getElementById(id), NS = 'http://www.w3.org/2000/svg';
  const T=StudioI18n.t;
  let savedLanguage;try{savedLanguage=localStorage.getItem('figure-studio:language');}catch{}
  StudioI18n.setLanguage(StudioI18n.choose(savedLanguage,navigator.languages?.[0]||navigator.language));
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
  const chartName=name=>StudioDiscovery[name]?.[StudioI18n.language]?.[0]||T(names[name]||name);
  const chartInsight=name=>StudioDiscovery[name]?.[StudioI18n.language]?.slice(1)||insights[name]?.map(T);
  let project, history, checkpoints = [], selectedPanel, selected = [], original = false, templateCache = new Map(), renderSerial = 0;
  let savedCurrent = '', localSavedCurrent = '', knownCache, message = '';
  let activePane = 'explore';
  let preferenceData;try{preferenceData=JSON.parse(localStorage.getItem('figure-studio:preferences')||'null');}catch{}
  const preferences=new StudioPreferences(preferenceData);
  let confirmPreferenceClear=false,clearedPreferences=null;
  let layoutMode=false, dragging=null,panelSelection=[];
  const sizeNames={original:'原始横竖比例',portrait:'竖版',wide:'加宽横版',spanThree:'跨三列横版',spanWide:'跨两列横版',spanTall:'跨两行竖版',large:'重点大图'};
  function showPane(name) {
    activePane=name;
    document.querySelectorAll('[data-pane]').forEach(el=>{el.hidden=el.getAttribute('data-pane')!==name;});
    document.querySelectorAll('[data-tab]').forEach(el=>{el.setAttribute('aria-pressed',String(el.getAttribute('data-tab')===name));});
    $('textRole').parentElement.hidden=name!=='detail';
    renderCanvas();
  }
  const state = () => history.current;
  const saveSignature = () => JSON.stringify({state:state(),checkpoints,dataDrafts});
  const panel = id => project.panels.find(p => p.id === id);
  const variant = id => panel(id).variants[state().panels[id].variant];
  const say = text => { message = text; $('status').textContent = T(text); };
  function safeValue(value) {
    if (/[<>]|(?:javascript|expression|@import|https?:|file:)/i.test(value)) return false;
    const urls = [...value.matchAll(/url\((.*?)\)/gi)];
    return urls.every(m => /^\s*['"]?#[\w.:-]+['T("]?\s*$/.test(m[1]));
  }
  function sanitize(text) {
    if (typeof text !== 'string' || text.length > 20000000 || /<!ENTITY/i.test(text)) throw Error(T('SVG 无效或超过大小限制'));
    const xml = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (xml.querySelector('parsererror') || xml.documentElement.localName !== 'svg') throw Error(T('无法解析 SVG'));
    const root = xml.documentElement;
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (el.localName === 'metadata') { el.remove(); continue; }
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
    if (p?.schema !== 'figure-studio/1' || !/^[a-f0-9]{20}$/.test(p.id) || typeof p.title !== 'string' || !Array.isArray(p.panels) || !p.panels.length || p.panels.length > 512) throw Error(T('不是受支持的 Figure Studio 工程'));
    const ids = new Set();
    for (const pan of p.panels) {
      if (!/^panel-\d+$/.test(pan.id) || ids.has(pan.id) || typeof pan.name !== 'string' || !Array.isArray(pan.variants) || !pan.variants.length || pan.variants.length > 128) throw Error(T('工程面板无效'));
      ids.add(pan.id);
      const first = pan.variants[0];
      for (const v of pan.variants) {
        if (typeof v.name !== 'string' || !Number.isFinite(v.width) || !Number.isFinite(v.height) || Math.min(v.width,v.height) <= 0 || Math.max(v.width,v.height) > 14400 || !Array.isArray(v.viewBox) || v.viewBox.length!==4 || !v.viewBox.every(Number.isFinite) || Math.min(...v.viewBox.slice(2))<=0 || Math.abs(v.width/v.viewBox[2] - v.height/v.viewBox[3])>1e-5) throw Error(T('SVG 尺寸无效'));
        if(v.size && !Object.hasOwn(sizeNames,v.size))throw Error(T('未知的画布规格'));
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
  function keysToObjects(svg) { return [...svg.querySelectorAll(DRAW)].filter(el=>isVisibleObject(el)&&/^e\d+$/.test(el.getAttribute('data-key')||'')); }
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
  function comparisonsFor(id){const a=panel(id).analysis,order=a.group_order||[];if(Array.isArray(a.pairwise))return a.pairwise.filter(c=>Number.isInteger(c.a)&&Number.isInteger(c.b)&&c.a>=0&&c.b>=0&&c.a<order.length&&c.b<order.length&&c.a!==c.b&&Number.isFinite(c.p)&&c.p>=0&&c.p<=1);const test=a[state().panels[id].methodChoice?.key||'primary_test'];if(order.length===2&&Number.isFinite(test?.p_value))return [{a:0,b:1,p:test.p_value}];return [];}
  function annotationHeight(id,s){return s.panels[id].annotationStyle&&panel(id).variants[s.panels[id].variant].name==='bar_raw_points'?(s.panels[id].annotationStyle==='letters'?20:20*comparisonsFor(id).length):0;}
  function drawingHeight(id,s){return panel(id).variants[s.panels[id].variant].height+annotationHeight(id,s);}
  function editedSvg(id, vi, s=state(), raw=false) {
    const svg = baseSvg(id,vi);
    if(!raw&&s.typography&&!s.panels[id].locked&&!['gallery','roc','roc_results'].includes(panel(id).recipe?.family)){const v=panel(id).variants[vi],ratio=v.viewBox[2]/v.width;for(const text of svg.querySelectorAll('text')){const locked=s.panels[id].lockedElements?.[vi]||[];if([text,...text.querySelectorAll('tspan')].some(el=>locked.includes(el.getAttribute('data-key'))))continue;const role=text.getAttribute('data-role'),size=(s.typography.size+(['axis','other'].includes(role)?1:0))*ratio,previous=parseFloat(text.style.fontSize||text.getAttribute('font-size')||size);text.style.fontFamily=s.typography.font;text.style.fontSize=size+'px';for(const child of text.querySelectorAll('tspan')){const old=parseFloat(child.style.fontSize||child.getAttribute('font-size'));child.style.fontFamily=s.typography.font;if(Number.isFinite(old)&&previous>0)child.style.fontSize=old*size/previous+'px';}}}
    if(!raw && s.panels[id].geometry){
      const bars=[...svg.querySelectorAll('[id^="studio-bar-"]')].map(group=>{const path=group.querySelector('path'),values=path?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);return values?.length>=8?{group,cx:(values[0]+values[2])/2}:null;}).filter(Boolean);
      if(bars.length){const center=bars.reduce((sum,b)=>sum+b.cx,0)/bars.length,{barWidth,groupGap}=s.panels[id].geometry;
        bars.forEach(({group,cx},i)=>{const delta=(cx-center)*(groupGap-1);group.setAttribute('transform',`translate(${cx+delta} 0) scale(${barWidth} 1) translate(${-cx} 0)`);for(const el of svg.querySelectorAll(`[id^="studio-group-${i}-"]`))el.setAttribute('transform',`translate(${delta} 0)`);});
      }
    }
    if(!raw&&s.panels[id].errorDirection&&s.panels[id].errorDirection!=='both'){
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
    if (!raw) for (const [key, props] of Object.entries(editsFor(id,vi,s))) {
      const el=svg.querySelector(`[data-key="${key}"]`); if (!el) continue;
      for (const [prop,val] of Object.entries(props)) {
        if (prop==='text') { if (el.matches('text,tspan') && !el.children.length) el.textContent=val; }
        else if(!prop.startsWith('offset-'))el.style.setProperty(prop, (prop==='font-size'||prop==='stroke-width') ? val+'px' : val);
      }
    }
    if(!raw&&s.panels[id].annotationStyle&&panel(id).variants[vi].name==='bar_raw_points'){
      const style=s.panels[id].annotationStyle,comparisons=comparisonsFor(id),v=panel(id).variants[vi],ratio=v.viewBox[2]/v.width,header=annotationHeight(id,s)*ratio;
      const centers=[...svg.querySelectorAll('[id^="studio-bar-"]')].map(g=>{const nums=g.querySelector('path').getAttribute('d').match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi).map(Number),x=(nums[0]+nums[2])/2,m=g.transform.baseVal.consolidate()?.matrix;return m?m.a*x+m.e:x;});
      if(header&&centers.length){
        // Measure the actual bars, observations and error bars before reserving annotation headroom.
        const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;visibility:hidden;pointer-events:none';host.append(svg);document.body.append(host);
        const tops=centers.map((_,i)=>{const objects=[...svg.querySelectorAll(`[id="studio-bar-${i}"],[id^="studio-group-${i}-"]`)];return Math.min(...objects.map(el=>el.getBBox().y));});svg.remove();host.remove();
        const content=document.createElementNS(NS,'g');content.setAttribute('transform',`translate(0 ${header})`);for(const child of [...svg.children])if(child.localName!=='defs')content.append(child);svg.append(content);svg.setAttribute('viewBox',`${v.viewBox[0]} ${v.viewBox[1]} ${v.viewBox[2]} ${v.viewBox[3]+header}`);
        const addText=(x,y,value,isP=false,anchorY=null,gap=8)=>{const text=document.createElementNS(NS,'text');text.setAttribute('x',x);text.setAttribute('y',y);text.setAttribute('text-anchor','middle');if(anchorY!==null){text.setAttribute('data-stat-top',anchorY);text.setAttribute('data-stat-gap',gap);}text.setAttribute('font-family',s.panels[id].annotationFont?.font||s.typography?.font||'Arial');text.setAttribute('font-size',(s.panels[id].annotationFont?.size||s.typography?.size||9)*ratio);if(isP){const symbol=document.createElementNS(NS,'tspan');symbol.textContent='P';symbol.setAttribute('font-style','italic');text.append(symbol,document.createTextNode(value));}else text.textContent=value;svg.append(text);};
        if(style==='letters'){const letters=comparisonLetters(centers.length,comparisons);letters.forEach((text,i)=>addText(centers[i],header+tops[i]-8*ratio,text,false,header+tops[i],8));}
        else comparisons.forEach((c,i)=>{const x1=centers[c.a],x2=centers[c.b],y=header+Math.min(...tops)-(i*20+12)*ratio,path=document.createElementNS(NS,'path');path.setAttribute('d',`M ${x1} ${y+3*ratio} V ${y} H ${x2} V ${y+3*ratio}`);path.setAttribute('data-stat-bracket',JSON.stringify({x1,x2,top:header+Math.min(...tops),gap:i*20+12}));path.setAttribute('fill','none');path.setAttribute('stroke','#20242A');path.setAttribute('stroke-width',.7*ratio);svg.append(path);const n=c.p<.0001?4:c.p<.001?3:c.p<.01?2:c.p<.05?1:0;addText((x1+x2)/2,y-3*ratio,style==='p'?(c.p===0?' < 0.001':' = '+c.p.toPrecision(3)):n?(style==='hash'?'#':'*').repeat(n):'ns',style==='p',header+Math.min(...tops),i*20+15);});
      }
    }
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
    let generated=900000;for(const el of svg.querySelectorAll('text,path,line,rect'))if(!el.closest('defs')&&!el.hasAttribute('data-key')){el.setAttribute('data-key','e'+generated++);const props=editsFor(id,vi,s)[el.getAttribute('data-key')]||{};if(!raw)for(const [prop,value]of Object.entries(props))if(!prop.startsWith('offset-')){if(prop==='text')el.textContent=value;else el.style.setProperty(prop,(prop==='font-size'||prop==='stroke-width')?value+'px':value);}}
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
    const g=gridFor(s), sum=a=>a.reduce((x,y)=>x+y,0);
    const widths=g.widths?.slice()||Array(s.columns).fill(0),heights=g.heights?.slice()||Array(g.rows).fill(0);
    const grow=(a,start,span,size)=>{const deficit=size-sum(a.slice(start,start+span))-s.gap*(span-1);if(deficit>0)for(let i=start;i<start+span;i++)a[i]+=deficit/span;};
    // First satisfy ordinary cells, then spanning cells. Every artwork retains its physical size.
    for(const id of [...s.order].sort((a,b)=>g.places[a].rs*g.places[a].cs-g.places[b].rs*g.places[b].cs)){
      const p=g.places[id],v=panel(id).variants[s.panels[id].variant];grow(widths,p.col,p.cs,v.width);grow(heights,p.row,p.rs,drawingHeight(id,s));
    }
    const fallbackW=Math.min(...widths.filter(x=>x>0)),fallbackH=Math.min(...heights.filter(x=>x>0));
    for(let i=0;i<widths.length;i++)if(!widths[i])widths[i]=fallbackW;
    const minimumHeight=Math.max(...s.order.map(id=>annotationHeight(id,s)))+222;
    for(let i=0;i<heights.length;i++)heights[i]=Math.max(heights[i]||fallbackH,minimumHeight);
    const box=p=>({x:sum(widths.slice(0,p.col))+s.gap*p.col,y:sum(heights.slice(0,p.row))+s.gap*p.row,width:sum(widths.slice(p.col,p.col+p.cs))+s.gap*(p.cs-1),height:sum(heights.slice(p.row,p.row+p.rs))+s.gap*(p.rs-1)});
    const cells=[];for(let row=0;row<g.rows;row++)for(let col=0;col<s.columns;col++)cells.push({row,col,...box({row,col,rs:1,cs:1})});
    return {width:sum(widths)+s.gap*(s.columns-1),height:sum(heights)+s.gap*(g.rows-1),cells,positions:s.order.map(id=>({id,...box(g.places[id])}))};
  }

  function plotFrame(svg,v){
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
    const objects=[...legends,...[...svg.querySelectorAll('text,use')].filter(el=>!el.closest('defs')&&!el.closest('[id^="legend_"]'))];
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
      if(titles.has(el)){const t=titles.get(el);x=margins.left+t.x-titleLeft;y=margins.top-20+t.y-titleBottom;}
      const wanted=new DOMMatrix().translate(x-p.x,y-p.y).multiply(physical).multiply(M),local=A.multiply(parent).inverse().multiply(wanted);
      el.setAttribute('transform',`matrix(${local.a} ${local.b} ${local.c} ${local.d} ${local.e} ${local.f})`);
    }
    for(const group of svg.querySelectorAll('[id^="studio-bar-"]')){const values=group.querySelector('path')?.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);if(values?.length>=8){const cx=(values[0]+values[2])/2;group.setAttribute('transform',(group.getAttribute('transform')||'')+` translate(${cx} 0) scale(${1/sx} 1) translate(${-cx} 0)`);}}
    for(const el of svg.querySelectorAll('path,line,polyline,rect'))if(!el.closest('defs'))el.setAttribute('vector-effect','non-scaling-stroke');
    for(const path of svg.querySelectorAll('[data-stat-bracket]')){const info=JSON.parse(path.getAttribute('data-stat-bracket')),left=A.transformPoint({x:info.x1,y:info.top}),right=A.transformPoint({x:info.x2,y:info.top}),y=left.y-info.gap,inverse=A.inverse();path.setAttribute('d',`M ${left.x} ${y+3} V ${y} H ${right.x} V ${y+3}`);path.setAttribute('transform',`matrix(${inverse.a} 0 0 ${inverse.d} ${inverse.e} ${inverse.f})`);}
    // The page background belongs to the viewport, not to the data coordinate transform.
    svg.querySelector('[id="figure_1"] > [id="patch_1"]')?.remove();
    const content=document.createElementNS(NS,'g');content.setAttribute('transform',`matrix(${A.a} 0 0 ${A.d} ${A.e} ${A.f})`);for(const child of [...svg.children])if(child.localName!=='defs')content.append(child);svg.append(content);
    svg.setAttribute('viewBox',`0 0 ${pos.width} ${pos.height}`);svg.setAttribute('data-aligned-plot','true');return true;
  }
  let selectedAnnotations=[];
  function overlayNode(a,l,editing=true){
    const group=document.createElementNS(NS,'g');group.dataset.annotation=a.id;const x=a.x*l.width,y=a.y*l.height,w=a.w*l.width,h=a.h*l.height,el=document.createElementNS(NS,a.type);
    const attrs=a.type==='text'?{x,y,'text-anchor':a.align||'start','font-family':a.font,'font-size':a.size,'font-weight':a.bold?'700':'400',fill:a.color}:a.type==='line'?{x1:x,y1:y,x2:x+w,y2:y+h,stroke:a.color,'stroke-width':a.stroke}:a.type==='rect'?{x,y,width:w,height:h,stroke:a.color,'stroke-width':a.stroke,fill:a.fill?a.color:'none'}:{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2,stroke:a.color,'stroke-width':a.stroke,fill:a.fill?a.color:'none'};
    for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);el.setAttribute('opacity',a.opacity);el.style.pointerEvents=a.type==='text'?'all':'visiblePainted';
    if(a.type==='text')a.text.split('\n').forEach((line,i)=>{const t=document.createElementNS(NS,'tspan');t.textContent=line;t.setAttribute('x',x);t.setAttribute('dy',i?a.size*1.25:0);el.append(t);});group.append(el);
    if(editing){group.style.cursor=a.locked?'default':'move';if(selectedAnnotations.includes(a.id)){const rect=document.createElementNS(NS,'rect');const textWidth=Math.max(...a.text.split('\n').map(t=>t.length))*a.size*.65;for(const [k,v]of Object.entries({x:x-3-(a.type==='text'?(a.align==='middle'?textWidth/2:a.align==='end'?textWidth:0):0),y:y-(a.type==='text'?a.size:0)-3,width:(a.type==='text'?Math.max(20,textWidth):w)+6,height:(a.type==='text'?a.size*1.25*a.text.split('\n').length:Math.max(h,3))+6,fill:'none',stroke:'#626bd3','stroke-width':1,'stroke-dasharray':'3 2'}))rect.setAttribute(k,v);rect.style.pointerEvents='none';group.append(rect);
      if(a.type!=='text'&&!a.locked){const handle=document.createElementNS(NS,'rect');for(const [k,v]of Object.entries({x:x+w-4,y:y+h-4,width:8,height:8,fill:'#626bd3'}))handle.setAttribute(k,v);handle.dataset.overlayResize=a.id;group.append(handle);}
    }}return group;
  }
  function renderOverlayProperties(){
    selectedAnnotations=selectedAnnotations.filter(id=>state().overlays?.some(a=>a.id===id));const a=state().overlays?.find(a=>a.id===selectedAnnotations[0]);$('overlaySelectionInfo').textContent=T('已选 {0} 个标注',selectedAnnotations.length);
    for(const id of ['applyOverlay','lockOverlay','unlockOverlay','deleteOverlay'])$(id).disabled=!a;
    if(a){$('overlayAlign').value=a.align||'start';$('overlayText').value=a.text;$('overlayFont').value=a.font;$('overlaySize').value=(a.size*currentOutput().scale).toFixed(1);$('overlayColor').value=a.color;$('overlayStroke').value=a.stroke*currentOutput().scale;$('overlayOpacity').value=a.opacity;$('overlayFill').checked=a.fill;$('overlayBold').checked=a.bold;$('overlayText').disabled=a.type!=='text'||selectedAnnotations.length!==1;}
  }
  function applyElementOffsets(svg,id,vi,s,unit){
    const matrix=el=>{const nodes=[];for(let n=el;n&&n!==svg;n=n.parentElement)nodes.unshift(n);let m=new DOMMatrix();for(const n of nodes){const t=n.transform?.baseVal.consolidate()?.matrix;if(t)m=m.multiply(new DOMMatrix([t.a,t.b,t.c,t.d,t.e,t.f]));}return m;};
    for(const [key,props]of Object.entries(editsFor(id,vi,s))){const dx=+(props['offset-x']||0)*unit,dy=+(props['offset-y']||0)*unit;if(!dx&&!dy)continue;const el=svg.querySelector(`[data-key="${key}"]`);if(!el||el.localName==='tspan')continue;const m=new DOMMatrix().translate(dx,dy).multiply(matrix(el));for(const prop of ['fill','stroke'])el.style.setProperty(prop,paint(el,prop));el.setAttribute('transform',`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);el.removeAttribute('clip-path');svg.append(el);}
  }
  function composite(raw=false, exportMode=false, s=state()) {
    const l=layout(s), root=document.createElementNS(NS,'svg');
    root.setAttribute('xmlns',NS);root.setAttribute('viewBox',`0 0 ${l.width} ${l.height}`); root.setAttribute('width',l.width+'pt');root.setAttribute('height',l.height+'pt');
    if(exportMode){const output=exportGeometry(l.width,l.height,s.exportSettings);root.setAttribute('width',output.widthPt+'pt');root.setAttribute('height',output.heightPt+'pt');}
    const description=document.createElementNS(NS,'desc');description.textContent=JSON.stringify({analysisChoices:s.order.filter(id=>s.panels[id].methodChoice).map(id=>({panel:id,...s.panels[id].methodChoice,result:panel(id).analysis[s.panels[id].methodChoice.key]}))});root.append(description);
    const margins={left:60,right:18,top:Math.max(52,...s.order.map(id=>annotationHeight(id,s)+26)),bottom:36};

    for (const pos of l.positions) {
      const vi=s.panels[pos.id].variant,v=panel(pos.id).variants[vi],svg=editedSvg(pos.id,vi,s,raw),fitted=!s.panels[pos.id].locked&&fitPlot(svg,v,pos,margins);if(!raw)applyElementOffsets(svg,pos.id,vi,s,fitted?1:v.viewBox[2]/v.width);namespace(svg);
      svg.setAttribute('x',fitted?pos.x:pos.x+(pos.width-v.width)/2);svg.setAttribute('y',fitted?pos.y:pos.y+(pos.height-(raw?v.height:drawingHeight(pos.id,s)))/2);svg.setAttribute('width',fitted?pos.width:v.width);svg.setAttribute('height',fitted?pos.height:(raw?v.height:drawingHeight(pos.id,s)));svg.setAttribute('data-panel',pos.id);svg.setAttribute('overflow','visible');
      if (!exportMode && !raw && pos.id===selectedPanel && s.panels[pos.id].variant===state().panels[pos.id].variant) for (const key of selected) svg.querySelector(`[data-key="${key}"]`)?.classList.add('chosen');
      root.append(svg);
    }
    for(const pos of l.positions){const label=s.panels[pos.id].label;if(!label)continue;const text=document.createElementNS(NS,'text');text.textContent=label.text;for(const [key,value]of Object.entries({x:pos.x+pos.width*label.x/100,y:pos.y+pos.height*label.y/100,'font-size':label.size,'font-family':label.font,'font-weight':label.bold?'700':'400',fill:'#20242A'}))text.setAttribute(key,value);if(!exportMode){text.setAttribute('data-panel-label',pos.id);text.style.cursor='move';}root.append(text);}
    if(layoutMode&&!exportMode){
      for(const cell of l.cells){const rect=document.createElementNS(NS,'rect');for(const k of ['x','y','width','height'])rect.setAttribute(k,cell[k]);rect.setAttribute('fill','#176b58');rect.setAttribute('fill-opacity','.025');rect.setAttribute('stroke','#85a99b');rect.setAttribute('stroke-width','1');rect.setAttribute('stroke-dasharray','4 4');rect.dataset.row=cell.row;rect.dataset.col=cell.col;root.append(rect);}
      for(const [i,pos]of l.positions.entries()){const t=document.createElementNS(NS,'text');t.setAttribute('x',pos.x+7);t.setAttribute('y',pos.y+16);t.setAttribute('font-size','12');t.setAttribute('fill','#176b58');t.style.pointerEvents='none';t.textContent=String(i+1).padStart(2,'0');root.append(t);}
      for(const pos of l.positions){
        const outline=document.createElementNS(NS,'rect');for(const key of ['x','y','width','height'])outline.setAttribute(key,pos[key]);outline.setAttribute('fill','none');outline.setAttribute('stroke','#176b58');outline.setAttribute('stroke-width','2');outline.style.pointerEvents='none';root.append(outline);
        for(const [edge,x,y]of [['right',pos.x+pos.width,pos.y+pos.height/2],['bottom',pos.x+pos.width/2,pos.y+pos.height],['corner',pos.x+pos.width,pos.y+pos.height]]){const handle=document.createElementNS(NS,'rect');handle.setAttribute('x',x-6);handle.setAttribute('y',y-6);handle.setAttribute('width','12');handle.setAttribute('height','12');handle.setAttribute('rx','2');handle.setAttribute('fill','#176b58');handle.setAttribute('stroke','white');handle.setAttribute('data-resize',edge);handle.setAttribute('data-resize-panel',pos.id);handle.style.cursor=edge==='right'?'ew-resize':edge==='bottom'?'ns-resize':'nwse-resize';root.append(handle);}
      }

    }
    for(const a of s.overlays||[])root.append(overlayNode(a,l,!exportMode));
    if (exportMode) for (const el of [root,...root.querySelectorAll('*')]) for (const a of [...el.attributes]) if (a.name.startsWith('data-') || a.name==='class') el.removeAttributeNode(a);
    return root;
  }
  let autosaveQueue=Promise.resolve(),autosaveTicket=0;
  function persist() {
    const key='figure-studio:'+project.id;
    try{const previous=localStorage.getItem(key);if(knownCache!==undefined&&previous!==knownCache){$('autosaveStatus').textContent=T('其他窗口已更新 · 请先下载当前工程');localSavedCurrent='';return false;}}catch{}
    const ticket=++autosaveTicket,payload=currentPayload(),signature=saveSignature(),stamp=JSON.stringify({idb:true,savedAt:new Date().toISOString(),ticket});
    // Immutable assets are stored once per project, never duplicated inside history states.
    payload.project={...project,panels:[...project.panels]};
    $('autosaveStatus').textContent=T('正在保存…');
    autosaveQueue=autosaveQueue.catch(()=>{}).then(()=>StudioLibrary.put('autosaves',{id:payload.project.id,payload})).then(()=>{
      if(ticket!==autosaveTicket)return;
      try{localStorage.setItem(key,stamp);knownCache=stamp;}catch{}
      localSavedCurrent=signature;$('autosaveStatus').textContent=T('已自动保存 · 含撤销记录');$('autosaveStatus').classList.remove('unsaved');
      if(libraryIds.has(project.id))collectFigure();
    }).catch(()=>{$('autosaveStatus').textContent=T('自动保存失败 · 请下载工程');$('autosaveStatus').classList.add('unsaved');});return true;
  }
  function commit(next,label) {try{validateState(next,project);for(const id of state().order)if(state().panels[id].locked&&(!next.panels[id]||next.panels[id].locked)){if(JSON.stringify(gridFor(state()).places[id])!==JSON.stringify(gridFor(next).places[id])||JSON.stringify(state().panels[id])!==JSON.stringify(next.panels[id]))throw Error(T('小图已锁定'));}}catch(e){say(e.message);return false;}if(history.commit(next)){original=false;persist();render();say(label+T(' · 已记录，可撤销'));}return true;}
  function setEdit(next,id,vi,key,prop,value) {
    const edits=next.panels[id].edits; edits[vi] ||= {}; edits[vi][key] ||= {}; edits[vi][key][prop]=value;
  }
  function targetObjects(id,vi,svg,kind) {
    const scope=$('scope').value, selectedHere=id===selectedPanel && vi===state().panels[id].variant;
    if(state().panels[id].locked)return [];
    let objects=keysToObjects(svg).filter(el=>![el,...el.querySelectorAll('[data-key]')].some(node=>(state().panels[id].lockedElements?.[vi]||[]).includes(node.getAttribute('data-key'))));
    if(scope==='element') objects=selectedHere ? objects.filter(el=>selected.includes(el.getAttribute('data-key'))) : [];
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
    for(const id of scope==='all'?next.order:[selectedPanel]) {
      if((scope==='panel'||scope==='all')&&$('textRole').value==='all'&&prop==='font-family'&&extras['font-size']&&!next.panels[id].locked){next.panels[id].annotationFont={font:value,size:+extras['font-size']/currentOutput().scale};}
      const vs=!previewOnly&&(scope==='all'||scope==='panel')?panel(id).variants.map((_,i)=>i):[next.panels[id].variant];
      for(const vi of vs){const svg=editedSvg(id,vi);for(const el of targetObjects(id,vi,svg,kind)){
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
    if(changed){if(previewOnly){renderCanvas(next);say(T('实时预览 · 松开滑块或确认颜色后记录一次修改'));}else commit(next,T('已更新 {0} 个属性',changed));}else say(T('当前范围没有适用元素。黑白坐标与连续色标不参与整图改色。'));
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
    for(const [key,count]of preferences.top('palette')){const colors=JSON.parse(key),next=paletteState(colors),b=button(T('常用配色'),()=>commit(next,T('已应用常用配色')));b.className='palette';const sw=document.createElement('div');sw.className='swatches';colors.forEach(color=>{const i=document.createElement('i');i.style.background=color;sw.append(i);});b.append(sw,preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)));b.onmouseenter=()=>renderCanvas(next);b.onmouseleave=()=>renderCanvas();append(b,count);}
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
      const vi=variants.findIndex(v=>v.name===current.name&&(v.size||'original')===size);if(vi>=0)next.panels[id].variant=vi;
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
    $('palettes').replaceChildren();
    for(const [name,colors] of palettes) {
      const next=paletteState(colors),b=button('',()=>commit(next,T('已应用 ')+T(name)));b.className='palette';
      b.onmouseenter=()=>{renderCanvas(next);say(T('预览 ')+T(name)+T(' · 点击应用，移开还原'));};b.onmouseleave=()=>{renderCanvas();say(T('已返回当前编辑版'));};
      const sw=document.createElement('div');sw.className='swatches';colors.forEach(c=>{const i=document.createElement('i');i.style.background=c;sw.append(i);});
      const label=document.createElement('span');label.textContent=T(name);b.append(sw,preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)),label);$('palettes').append(b);
    }
    $('complementPreview').replaceChildren();
  }
  let variantRequest=0;
  async function activateVariant(index){
    const request=++variantRequest,id=selectedPanel,source=panel(id),target=source.variants[index],projectId=project.id;
    if(state().panels[id].locked)return;
    if(['gallery','roc'].includes(source.recipe?.family)&&localEngine&&target.name!==(source.recipe.family==='gallery'?source.recipe.parameters.view:source.recipe.studio_view||'roc')){
      const recipe=copy(source.recipe),oldSize=variant(id).size||'original';if(recipe.family==='gallery')recipe.parameters.view=target.name;else recipe.studio_view=target.name;
      say(T('正在准备所选样式…'));
      const response=await fetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe,rows:source.table.rows})});
      const result=await response.json();if(!response.ok)throw Error(result.error);
      if(request!==variantRequest||project.id!==projectId||selectedPanel!==id||!state().order.includes(id)||state().panels[id].locked||panel(id)!==source)return;
      result.panel.name=source.name;result.panel.initialVariant=Math.max(0,result.panel.variants.findIndex(v=>v.name===target.name&&(v.size||'original')===oldSize));installAsset(result.panel,id,null,T('已切换候选图'),true);
    }else{const next=copy(state());next.panels[id].variant=index;selected=[];commit(matchSizes(next,[id]),T('已切换候选图'));}
  }
  function renderInspector() {
    const pan=panel(selectedPanel),vi=state().panels[selectedPanel].variant;
    $('selectionTitle').textContent=selected.length?T('已选 {0} 个元素',selected.length):T('当前小图 · ')+StudioI18n.panelName(pan);
    $('textContent').value='';$('textContent').disabled=true;$('applyText').disabled=true;
    if(selected.length===1){const svg=editedSvg(selectedPanel,vi),el=svg.querySelector(`[data-key="${selected[0]}"]`);if(el){
      $('fillMode').value=paint(el,'fill')==='none'?'none':'solid';$('elementStroke').value=(parseFloat(el.style.strokeWidth||el.getAttribute('stroke-width')||'1')*pan.variants[vi].width/pan.variants[vi].viewBox[2]*currentOutput().scale).toFixed(2);$('textAlign').value=el.style.textAnchor||el.getAttribute('text-anchor')||'start';const fill=hex(paint(el,'fill')),stroke=hex(paint(el,'stroke'));
      const h=(fill&&chromatic(fill)?fill:null)||(stroke&&chromatic(stroke)?stroke:null)||fill||stroke;if(h)$('color').value=h;
      const size=parseFloat(el.style.fontSize||el.getAttribute('font-size')||'');if(Number.isFinite(size))$('fontSize').value=(size*pan.variants[vi].width/pan.variants[vi].viewBox[2]*currentOutput().scale).toFixed(1);
      const family=(el.style.fontFamily||el.getAttribute('font-family')||'').replace(/["']/g,'');if([...$('font').options].some(o=>o.value===family))$('font').value=family;
      const alpha=parseFloat(el.style.opacity||el.getAttribute('opacity')||'1');$('opacity').value=String(alpha*100);$('opacityValue').value=Math.round(alpha*100)+'%';
      if(el.matches('text,tspan')&&!el.children.length){$('textContent').value=el.textContent;$('textContent').disabled=false;$('applyText').disabled=false;}
    }}
    syncColorControls();renderFontTargets();
    $('errorDirection').value=state().panels[selectedPanel].errorDirection||'both';$('annotationStyle').value=state().panels[selectedPanel].annotationStyle||'';
    $('barGeometry').hidden=pan.variants[vi].name!=='bar_raw_points';const geometry=state().panels[selectedPanel].geometry||{barWidth:1,groupGap:1};$('barWidth').value=geometry.barWidth;$('groupGap').value=geometry.groupGap;
    const scale=state().panels[selectedPanel].scales?.[vi]?.[selected[0]];if(scale){for(const [id,key]of [['scaleCalibration','calibration'],['scaleLength','length'],['scalePosition','position'],['scaleThickness','thickness'],['scaleFontSize','size'],['scaleAlpha','alpha']])$(id).value=scale[key];$('scaleBold').checked=scale.bold;$('scaleBackground').checked=scale.background;}
    const current=pan.variants[vi];$('sizes').replaceChildren();
    const sizeState=i=>{if(state().panels[selectedPanel].locked)throw Error(T('小图已锁定'));const v=pan.variants[i],span=({wide:[1,2],spanWide:[1,2],spanThree:[1,3],spanTall:[2,1],large:[2,2]})[v.size];const next=span?resizePanel(state(),selectedPanel,...span):copy(state());if(span)next.typography||={font:'Arial',size:9};next.panels[selectedPanel].variant=i;return next;};
    pan.variants.forEach((v,i)=>{if(v.name!==current.name)return;let next,error;try{next=sizeState(i);}catch(e){error=e.message;}const b=button('',()=>{if(error)return say(T(error));selected=[];commit(next,T('已切换画布规格'));});b.className='candidate'+(i===vi?' active':'');const text=document.createElement('span');text.textContent=T(sizeNames[v.size||'original'])+` · ${(v.width*25.4/72).toFixed(0)} × ${(v.height*25.4/72).toFixed(0)} mm`;b.setAttribute('aria-label',T('画布 ')+T(sizeNames[v.size||'original']));b.append(preview(editedSvg(selectedPanel,i)),text);if(error)b.title=T(error);b.onmouseenter=()=>{if(next)renderCanvas(next);};b.onmouseleave=()=>renderCanvas();$('sizes').append(b);});
    $('slotChoices').replaceChildren();
    for(const [label,rs,cs] of [['1 × 1',1,1],['跨 2 列',1,2],['跨 3 列',1,3],['整行',1,state().columns],['跨 2 行',2,1]]){let next,error;try{next=matchSizes(resizePanel(state(),selectedPanel,rs,cs),[selectedPanel]);}catch(e){error=e.message;}const b=button(T(label),()=>{if(error)return say(T(error));selected=[];commit(next,T('已应用跨格'));});b.disabled=!!error;if(error)b.title=T(error);b.onmouseenter=()=>{if(next)renderCanvas(next);};b.onmouseleave=()=>renderCanvas();$('slotChoices').append(b);}

    if($('sizes').children.length===1){const note=document.createElement('p');note.className='muted';note.textContent=T('此图只有原始尺寸。用受支持的绘图配方和源数据准备尺寸候选后，可直接切换。');$('sizes').append(note);}
    $('rocRequirements').hidden=pan.analysis?.family!=='roc';$('rocNeeds').replaceChildren();
    if(pan.analysis?.family==='roc')for(const [name,entry]of Object.entries(StudioDiscovery)){if(!name.startsWith('roc_requires_'))continue;const [title,need,note]=entry[StudioI18n.language];const card=document.createElement('p');card.className='muted';card.textContent=title+' · '+need+' — '+note;$('rocNeeds').append(card);}
    $('candidates').replaceChildren();
    $('candidateHint').textContent=pan.variants.length>1?T('预览使用当前数据；排序依据数据结构与表达目的。'):T('单独导入的 SVG 无数据驱动候选；需先用原 skill 生成候选图包。');
    const ranked=StudioCatalogue.rank(pan,$('chartGoal').value);ranked.slice(0,+$('topCount').value).forEach(({v,i},rank)=>{const sameSize=pan.variants.findIndex(x=>x.name===v.name&&(x.size||'original')===(current.size||'original'));if(sameSize>=0){i=sameSize;v=pan.variants[i];}const b=button('',guard(()=>activateVariant(i)));b.className='candidate'+(i===vi?' active':'');b.setAttribute('aria-label',chartName(v.name));
      b.onmouseenter=()=>{const next=copy(state());next.panels[selectedPanel].variant=i;renderCanvas(next);say(T('整图预览：')+(chartName(v.name))+T(' · 点击应用，移开还原'));};b.onmouseleave=()=>{renderCanvas();say(T('已返回当前编辑版'));};
      const text=document.createElement('span');text.textContent=(rank===0?T('推荐 · '):`${rank+1} · `)+chartName(v.name);
      const explanation=document.createElement('small'),hint=chartInsight(v.name);explanation.className='candidate-insight';explanation.textContent=hint?T('适合：')+T(hint[0]).replace(/[。.]$/,'')+(StudioI18n.language==='en'?'. ':'。')+T(hint[1]):T('由上游分析流程提供；请结合下方分析记录判断它适合回答的问题。');
      b.append(preview(editedSvg(selectedPanel,i)),text,explanation);$('candidates').append(b);});
    drawPalettes();
    $('dataInfo').replaceChildren();
    const dataNote=document.createElement('p');dataNote.className='muted';dataNote.textContent=pan.table?T('源数据快照；在“数据表”中编辑。'):T('未嵌入原始表；下方仅显示已有配方与分析。');$('dataInfo').append(dataNote);
    if(pan.table?.rows){const wrap=document.createElement('div');wrap.className='table-scroll';const table=document.createElement('table');for(const [i,row]of pan.table.rows.slice(0,101).entries()){const tr=document.createElement('tr');for(const value of row){const td=document.createElement(i===0?'th':'td');td.textContent=String(value);tr.append(td);}table.append(tr);}wrap.append(table);$('dataInfo').append(wrap);}
    const pre=document.createElement('pre');pre.textContent=JSON.stringify({recipe:pan.recipe,analysis:pan.analysis},null,2);$('dataInfo').append(pre);
    $('qa').replaceChildren();const svg=editedSvg(selectedPanel,vi);
    const items=[T('当前小图：{0} 个文字对象，{1} 个栅格图层。',svg.querySelectorAll('text').length,svg.querySelectorAll('image').length),T('配色、字号修改后需重新核对碰撞与可读性。'),T('数据修订与图形样式保留独立版本。')];
    if(!svg.querySelector('text'))items.push(T('本图没有可编辑文字，路径化或栅格文字不能直接改字体。'));
    for(const text of items){const li=document.createElement('li');li.textContent=text;$('qa').append(li);}
  }
  function renderCanvas(previewState=state()) {
    if(!previewState?.order)previewState=state();
    const svg=composite(original,false,previewState),l=layout(previewState);$('artboard').replaceChildren(svg);
    for(const el of svg.querySelectorAll('[id*="studio-bar-"] path,circle,ellipse,rect'))if(!el.closest('defs'))el.style.pointerEvents='all';
    const output=exportGeometry(l.width,l.height,previewState.exportSettings),widthPx=output.widthPt*96/72,zoom=$('zoom').value==='fit'?Math.min(1,Math.max(200,$('viewport').clientWidth-48)/widthPx,Math.max(200,$('viewport').clientHeight-48)/(output.heightPt*96/72)):+$('zoom').value;
    svg.style.width=widthPx*zoom+'px';svg.style.height=output.heightPt*96/72*zoom+'px';
    $('dimensions').textContent=T('{0} 行 × {1} 列 · {2} × {3} mm',gridFor(previewState).rows,previewState.columns,output.widthMm.toFixed(1),output.heightMm.toFixed(1));
    $('exportWidth').value=output.widthMm.toFixed(2);$('exportHeight').value=output.heightMm.toFixed(2);$('exportDpi').value=String(output.dpi);$('exportPixels').textContent=T('{0} × {1} px · {2} dpi · 锁定纵横比',output.widthPx,output.heightPx,output.dpi);
    const textSizes=[...svg.querySelectorAll('text')].map(el=>{const id=el.closest('[data-panel]')?.getAttribute('data-panel'),v=id?panel(id).variants[previewState.panels[id].variant]:null;return parseFloat(el.style.fontSize||el.getAttribute('font-size'))*output.scale*(v?v.width/v.viewBox[2]:1);}).filter(Number.isFinite);$('exportFontNote').textContent=textSizes.length?T('缩放后最小文字约 {0} pt；请按期刊要求核对。',Math.min(...textSizes).toFixed(1)):'';
    const destination=e=>{const r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*l.width,y=(e.clientY-r.top)/r.height*l.height;return l.cells.find(c=>x>=c.x&&x<=c.x+c.width&&y>=c.y&&y<=c.y+c.height);};
    svg.oncontextmenu=e=>{const cell=destination(e);if(!cell)return;e.preventDefault();const id=at(cell),el=e.target.closest('[data-key]'),annotation=e.target.closest('[data-annotation]');selectedAnnotations=annotation?[annotation.dataset.annotation]:[];
      if(id&&!annotation){const same=id===selectedPanel;selectedPanel=id;if(!panelSelection.includes(id))panelSelection=[id];
        if(el&&isVisibleObject(el)&&!layoutMode){const key=el.getAttribute('data-key');if(!same||!selected.includes(key))selected=state().panels[id].elementGroups?.[state().panels[id].variant]?.find(g=>g.includes(key))||[key];$('scope').value='element';}
        else{selected=[];$('scope').value='panel';}render();}
      openInsertMenu(cell,e.clientX,e.clientY,true,!!id);
    };
    const at=cell=>cell&&state().order.find(id=>{const p=gridFor(state()).places[id];return cell.row>=p.row&&cell.row<p.row+p.rs&&cell.col>=p.col&&cell.col<p.col+p.cs;});
    const drop=e=>{if(!dragging)return;const cell=destination(e),id=dragging;dragging=null;if(cell){selectedPanel=id;selected=[];try{commit(moveWithSizes(state(),id,cell.row,cell.col),T('已移动 / 交换小图'));}catch(error){say(T(error.message));}}};
    let labelDrag=null,overlayDrag=null,elementDrag=null,marquee=null,suppressClick=false;
    const canvasPoint=e=>{const r=svg.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
    let resizeDrag=null,ghost=null,pending=null;
    const clearGhost=()=>{ghost?.remove();ghost=null;pending=null;};
    svg.onpointerdown=e=>{if(e.button!==0)return;const mark=e.target.closest('[data-annotation]');if(mark){const id=mark.dataset.annotation;if(!selectedAnnotations.includes(id))selectedAnnotations=e.shiftKey?[...selectedAnnotations,id]:[id];activePane='annotation';renderOverlayProperties();document.querySelectorAll('[data-pane]').forEach(el=>el.hidden=el.getAttribute('data-pane')!=='annotation');svg.setPointerCapture(e.pointerId);const a=state().overlays.find(a=>a.id===id);if(!a.locked){overlayDrag={point:canvasPoint(e),resize:!!e.target.closest('[data-overlay-resize]'),id,next:copy(state())};}return;}const target=e.target.closest('[data-panel-label]');if(target){const id=target.getAttribute('data-panel-label');if(state().panels[id].locked)return say(T('小图已锁定'));labelDrag=id;svg.setPointerCapture(e.pointerId);return;}if(!layoutMode){const el=e.target.closest('[data-key]'),pan=e.target.closest('[data-panel]');if(el&&pan&&pan.dataset.panel===selectedPanel&&selected.includes(el.dataset.key)){
        const p=state().panels[selectedPanel];if(p.locked)return say(T('小图已锁定'));const keys=selected.filter(k=>!p.lockedElements?.[p.variant]?.includes(k));if(!keys.length)return say(T('元素已锁定'));const nodes=keys.map(k=>svg.querySelector(`[data-panel="${selectedPanel}"] [data-key="${k}"]`)).filter(Boolean).filter(el=>el.localName!=='tspan');
        elementDrag={point:canvasPoint(e),id:selectedPanel,vi:p.variant,keys:nodes.map(el=>el.dataset.key),next:copy(state()),nodes:nodes.map(el=>({el,transform:el.getAttribute('transform'),matrix:el.transform.baseVal.consolidate()?.matrix,screen:el.parentElement.getScreenCTM()})),screen:{x:e.clientX,y:e.clientY}};svg.setPointerCapture(e.pointerId);e.preventDefault();return;
      }marquee={target:e.target,point:canvasPoint(e),screen:{x:e.clientX,y:e.clientY},append:e.shiftKey,moved:false};svg.setPointerCapture(e.pointerId);return;}e.preventDefault();const handle=e.target.closest('[data-resize]');const id=handle?.getAttribute('data-resize-panel')||at(destination(e));if(id&&state().panels[id].locked){say(T('小图已锁定'));return;}if(id&&e.shiftKey){panelSelection=panelSelection.includes(id)?panelSelection.filter(x=>x!==id):[...panelSelection,id];selectedPanel=id;render();return;}if(id){selectedPanel=id;svg.setPointerCapture(e.pointerId);if(handle){resizeDrag={id,edge:handle.getAttribute('data-resize'),place:copy(gridFor(state()).places[id])};}else dragging=id;}};
    svg.onpointermove=e=>{if(elementDrag){const p=canvasPoint(e),dx=(p.x-elementDrag.point.x)*l.width,dy=(p.y-elementDrag.point.y)*l.height;for(const key of elementDrag.keys){const old=editsFor(elementDrag.id,elementDrag.vi)[key]||{};setEdit(elementDrag.next,elementDrag.id,elementDrag.vi,key,'offset-x',String(+(old['offset-x']||0)+dx));setEdit(elementDrag.next,elementDrag.id,elementDrag.vi,key,'offset-y',String(+(old['offset-y']||0)+dy));}
      for(const item of elementDrag.nodes){if(!item.screen)continue;const sm=item.screen,inv=new DOMMatrix([sm.a,sm.b,sm.c,sm.d,sm.e,sm.f]).inverse(),a=inv.transformPoint({x:elementDrag.screen.x,y:elementDrag.screen.y}),b=inv.transformPoint({x:e.clientX,y:e.clientY}),m=item.matrix;item.el.setAttribute('transform',`translate(${b.x-a.x} ${b.y-a.y}) `+(item.transform||''));}return;}if(overlayDrag){const p=canvasPoint(e),dx=p.x-overlayDrag.point.x,dy=p.y-overlayDrag.point.y;for(const a of overlayDrag.next.overlays){const old=state().overlays.find(x=>x.id===a.id);if(!selectedAnnotations.includes(a.id)||old.locked)continue;if(overlayDrag.resize&&a.id===overlayDrag.id){a.w=Math.max(.005,Math.min(1-old.x,old.w+dx));a.h=Math.max(0,Math.min(1-old.y,old.h+dy));}else{a.x=Math.max(0,Math.min(1-a.w,old.x+dx));a.y=Math.max(0,Math.min(1-a.h,old.y+dy));}svg.querySelector(`[data-annotation="${a.id}"]`)?.replaceWith(overlayNode(a,l));}return;}
      if(marquee){const p=canvasPoint(e);marquee.end=p;marquee.moved ||= Math.hypot(e.clientX-marquee.screen.x,e.clientY-marquee.screen.y)>4;if(marquee.moved){e.preventDefault();svg.querySelector('[data-marquee]')?.remove();const box=document.createElementNS(NS,'rect');for(const [k,v]of Object.entries({x:Math.min(p.x,marquee.point.x)*l.width,y:Math.min(p.y,marquee.point.y)*l.height,width:Math.abs(p.x-marquee.point.x)*l.width,height:Math.abs(p.y-marquee.point.y)*l.height,fill:'#626bd3','fill-opacity':.1,stroke:'#626bd3','stroke-width':1}))box.setAttribute(k,v);box.dataset.marquee='true';box.style.pointerEvents='none';svg.append(box);}return;}if(labelDrag){const pos=l.positions.find(p=>p.id===labelDrag),r=svg.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*l.width,y=(e.clientY-r.top)/r.height*l.height;pending=copy(state());pending.panels[labelDrag].label.x=Math.max(0,Math.min(100,(x-pos.x)/pos.width*100));pending.panels[labelDrag].label.y=Math.max(0,Math.min(100,(y-pos.y)/pos.height*100));const text=svg.querySelector(`[data-panel-label="${labelDrag}"]`);text.setAttribute('x',x);text.setAttribute('y',y);return;}if(!layoutMode||(!resizeDrag&&!dragging))return;const cell=destination(e);if(!cell)return;clearGhost();let valid=true;
      try{if(resizeDrag){const {id,edge,place:p}=resizeDrag;const rs=edge==='right'?p.rs:Math.max(1,cell.row-p.row+1),cs=edge==='bottom'?p.cs:Math.max(1,cell.col-p.col+1);pending=matchSizes(resizePanel(state(),id,rs,cs),[id]);}else pending=moveWithSizes(state(),dragging,cell.row,cell.col);validateState(pending,project);}catch{valid=false;pending=null;}
      const id=resizeDrag?.id||dragging,p=pending?gridFor(pending).places[id]:{row:cell.row,col:cell.col,rs:1,cs:1};const covered=l.cells.filter(c=>c.row>=p.row&&c.row<p.row+p.rs&&c.col>=p.col&&c.col<p.col+p.cs);if(!covered.length)return;
      const x=Math.min(...covered.map(c=>c.x)),y=Math.min(...covered.map(c=>c.y)),right=Math.max(...covered.map(c=>c.x+c.width)),bottom=Math.max(...covered.map(c=>c.y+c.height));ghost=document.createElementNS(NS,'rect');for(const [key,value]of Object.entries({x,y,width:right-x,height:bottom-y,fill:valid?'#176b58':'#c54837','fill-opacity':.18,stroke:valid?'#176b58':'#c54837','stroke-width':3}))ghost.setAttribute(key,value);ghost.style.pointerEvents='none';svg.append(ghost);
    };
    svg.onpointerup=e=>{if(elementDrag){const next=elementDrag.next;elementDrag=null;suppressClick=true;commit(next,T('已移动所选元素'));return;}if(overlayDrag){const next=overlayDrag.next;overlayDrag=null;suppressClick=true;commit(next,T('已调整标注位置'));render();return;}if(marquee){const m=marquee;marquee=null;if(!m.moved){svg.onclick({target:m.target,shiftKey:m.append});suppressClick=true;return;}if(m.moved){const rect={left:Math.min(e.clientX,m.screen.x),right:Math.max(e.clientX,m.screen.x),top:Math.min(e.clientY,m.screen.y),bottom:Math.max(e.clientY,m.screen.y)},inside=el=>{const b=el.getBoundingClientRect();return b.width>0&&b.height>0&&b.left>=rect.left&&b.right<=rect.right&&b.top>=rect.top&&b.bottom<=rect.bottom;};
        const annotations=[...svg.querySelectorAll('[data-annotation]')].filter(inside).map(el=>el.dataset.annotation);
        const hits=[...svg.querySelectorAll('[data-panel] [data-key]')].filter(el=>isVisibleObject(el)&&!el.closest('defs')&&inside(el)&&el.localName!=='tspan');const ids=[...new Set(hits.map(el=>el.closest('[data-panel]').dataset.panel))];
        if(annotations.length){selectedAnnotations=m.append?[...new Set([...selectedAnnotations,...annotations])]:annotations;selected=[];panelSelection=[];activePane='annotation';}
        else if(ids.length===1){selectedAnnotations=[];selectedPanel=ids[0];const keys=hits.map(el=>el.dataset.key);selected=m.append?[...new Set([...selected,...keys])]:keys;panelSelection=[selectedPanel];$('scope').value='element';activePane='detail';}
        else{selectedAnnotations=[];panelSelection=m.append?[...new Set([...panelSelection,...ids])]:ids;selected=[];if(ids.length)selectedPanel=ids[0];$('scope').value='panel';}
        suppressClick=true;render();say(T('框选完成'));return;}}
      if(labelDrag){if(pending)commit(pending,T('已调整图号'));labelDrag=null;pending=null;return;}if(!layoutMode)return;if(resizeDrag){if(pending){selected=[];commit(pending,T('已应用跨格'));}resizeDrag=null;clearGhost();render();}else{clearGhost();drop(e);render();}};
    svg.onpointercancel=()=>{elementDrag=null;overlayDrag=null;marquee=null;dragging=null;resizeDrag=null;clearGhost();render();};
    svg.ondragover=e=>{if(layoutMode&&dragging)e.preventDefault();};svg.ondrop=e=>{e.preventDefault();drop(e);};
    svg.onclick=event=>{
      if(suppressClick){suppressClick=false;return;}if(event.target.closest('[data-annotation]')){render();return;}selectedAnnotations=[];
      if(event.target.closest('[data-panel-label]'))return;
      if(layoutMode)return;
      if(original)return;
      const pan=event.target.closest('[data-panel]');if(!pan)return;
      const id=pan.getAttribute('data-panel'),el=event.target.closest('[data-key]');
      if(id!==selectedPanel){selectedPanel=id;selected=[];}
      if(el && isVisibleObject(el)) {const key=el.getAttribute('data-key');const members=state().panels[id].elementGroups?.[state().panels[id].variant]?.find(g=>g.includes(key))||[key];selected=event.shiftKey?[...new Set([...selected,...members])]:members;$('scope').value='element';activePane='detail';}
      else {selected=[];$('scope').value='panel';}
      render();
    };
  }
  function renderMethods(){
    const a=panel(selectedPanel).analysis,goal=$('analysisGoal').value,keys=methodOrder(a,goal);$('methodCards').replaceChildren();
    if(!keys.length){$('methodRequirements').textContent=T('此图没有可比较的检验结果。先确认研究设计与分析目标。');return;}
    const choices=state().panels[selectedPanel].methodChoice;
    keys.forEach((key,i)=>{const result=a[key],card=document.createElement('div');card.className='method-card';const title=document.createElement('strong');title.textContent=(i===0?T('条件推荐：'):T('备选／敏感性分析：'))+result.name;
      const explanation=document.createElement('p');explanation.className='muted';explanation.textContent=key==='primary_test'?T('针对均值问题；独立性或配对结构由分析方案确认。小样本、强偏态和极端值需结合诊断判断。'):a.design==='paired'?T('配对秩方法关注差值的秩结构；Wilcoxon 的位置解释需要差值分布对称，不能仅凭“不正态”选择。'):T('秩方法关注分布差异，不能无条件解释为均值或中位数差异。');
      const number=document.createElement('p'),symbol=document.createElement('i');symbol.textContent='P';number.append(symbol,document.createTextNode(' = '+result.p_value.toPrecision(4)));
      if(key==='primary_test'&&Number.isFinite(a.primary_estimand?.estimate)){const effect=a.primary_estimand;number.append(document.createTextNode(' · '+effect.name+' = '+effect.estimate.toPrecision(4)+' · 95% CI ['+effect.ci95.map(x=>Number(x).toPrecision(4)).join(', ')+']'));}
      if(key==='sensitivity_test'){const note=document.createElement('p');note.className='muted';note.textContent=T('当前分析包未提供该秩方法的独立效应量区间；不借用均值差 CI。');card.append(note);}
      const choose=button(choices?.key===key?T('当前选择'):T('采用这个已计算方法'),()=>{if(key!=='primary_test'&&a.display_p_value)return say(T('原图已嵌入主分析 P 值，请先由分析流程重绘'));const reason=$('methodReason').value.trim();if(!reason)return say(T('请填写方法选择与研究问题的关系'));const next=copy(state());next.panels[selectedPanel].methodChoice={key,reason,goal};delete next.panels[selectedPanel].annotationStyle;commit(next,T('分析选择已记录，请重新确认统计标注'));});card.prepend(title,explanation,number);card.append(choose);$('methodCards').append(card);
    });
    $('methodRequirements').textContent=T('其他方向需补充条件：协变量调整／ANCOVA 需协变量与模型；混合模型需重复或层级结构；置换检验需可交换性与重排单位；稳健／截尾方法需明确目标量；分类结局需列联表或广义线性模型；生存分析需时间与删失信息。');
  }
  function render() {
    if(!state().order.includes(selectedPanel)){selectedPanel=state().order[0];selected=[];panelSelection=[];}
    renderDataEditor();
    renderOverlayProperties();
    templateCache.clear();
    renderMethods();
    const label=state().panels[selectedPanel].label||{text:'',x:2,y:5,size:12,bold:true};$('panelLabel').value=label.text;$('labelX').value=label.x;$('labelY').value=label.y;$('labelSize').value=label.size;$('labelBold').checked=label.bold;
    $('projectTitle').textContent=project.title;$('columns').value=state().columns;$('gap').value=state().gap;$('gapSlider').value=state().gap;
    const g=gridFor(state()),p=g.places[selectedPanel];$('rows').value=g.rows;$('targetRow').value=p.row+1;$('targetCol').value=p.col+1;$('rowSpan').value=p.rs;$('colSpan').value=p.cs;
    $('layoutMode').textContent=layoutMode?T('结束布局编辑'):T('编辑布局');$('layoutMode').setAttribute('aria-pressed',String(layoutMode));
    $('undo').disabled=history.index===0;$('redo').disabled=history.index===history.states.length-1;
    $('compare').textContent=original?T('返回编辑版'):T('原始外观');
    $('panels').replaceChildren();state().order.forEach((id,i)=>{const b=button('',event=>{panelSelection=event?.shiftKey?(panelSelection.includes(id)?panelSelection.filter(x=>x!==id):[...panelSelection,id]):[id];selectedPanel=id;selected=[];$('scope').value='panel';activePane='explore';render();});b.className='panel-button'+(id===selectedPanel||panelSelection.includes(id)?' active':'');b.setAttribute('aria-label',T('选择面板 ')+(i+1));b.draggable=true;b.ondragstart=()=>{dragging=id;layoutMode=true;renderCanvas();};b.ondragend=()=>{dragging=null;};b.ondragover=e=>e.preventDefault();b.ondrop=e=>{e.preventDefault();if(dragging){const pos=gridFor(state()).places[id],source=dragging;dragging=null;commit(moveWithSizes(state(),source,pos.row,pos.col),T('已交换小图'));}};const n=document.createElement('b');n.textContent=String(i+1).padStart(2,'0');const name=document.createElement('span');name.textContent=StudioI18n.panelName(panel(id))+(state().panels[id].locked?' 🔒':'')+((state().panelGroups||[]).some(g=>g.includes(id))?' ⛓':'');b.append(n,name);$('panels').append(b);});
    $('versions').replaceChildren();for(const saved of checkpoints)$('versions').append(button(saved.name,()=>{selected=[];commit(saved.state,T('已恢复版本 ')+saved.name);}));
    renderMasters();renderCanvas();renderInspector();renderRecommendations();showPane(activePane);
  }
  function download(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  function svgText(){return new XMLSerializer().serializeToString(composite(false,true));}
  function guard(fn) {return async(...args)=>{try{await fn(...args);}catch(e){say(T('未完成：')+T(e.message));}};}
  $('language').onchange=()=>{
    const drafts=Object.fromEntries(['textContent','fontSize','font','color','opacity','versionName'].map(id=>[id,$(id).value]));
    StudioI18n.setLanguage($('language').value);
    try{localStorage.setItem('figure-studio:language',StudioI18n.language);}catch{}
    localizeStatic();render();
    for(const [id,value]of Object.entries(drafts))$(id).value=value;
    $('opacityValue').value=$('opacity').value+'%';
    $('autosaveStatus').textContent=T($('autosaveStatus').classList.contains('unsaved')?'自动保存失败 · 请下载工程':'已自动保存 · 含撤销记录');
    say(T('界面语言已切换；图内文字、数据和编辑历史保持不变。'));
  };
  $('rememberPreferences').onchange=()=>{preferences.enabled=$('rememberPreferences').checked;savePreferences();renderRecommendations();};
  $('clearPreferences').onclick=()=>{if(!confirmPreferenceClear){confirmPreferenceClear=true;renderRecommendations();say(T('清除本浏览器的偏好记忆？当前图形、版本和撤销记录不会删除。'));return;}clearedPreferences=copy(preferences.toJSON());preferences.clear();confirmPreferenceClear=false;savePreferences();renderRecommendations();say(T('偏好记忆已清除。'));};
  $('restorePreferences').onclick=()=>{if(!clearedPreferences)return;const previous=new StudioPreferences(clearedPreferences);preferences.enabled=previous.enabled;preferences.seen=previous.seen;preferences.counts=previous.counts;clearedPreferences=null;savePreferences();renderRecommendations();say(T('偏好记忆已恢复。'));};
  $('analysisGoal').onchange=renderMethods;
  $('annotationStyle').onchange=()=>{try{const next=copy(state()),style=$('annotationStyle').value;if(!style){delete next.panels[selectedPanel].annotationStyle;}else{const comparisons=comparisonsFor(selectedPanel);if(!comparisons.length)throw Error(T('缺少已确认的比较结果'));if(style==='letters')comparisonLetters(panel(selectedPanel).analysis.group_order.length,comparisons);next.panels[selectedPanel].annotationStyle=style;}commit(next,T('已切换统计标注'));}catch(e){say(T(e.message));}};
  const scaleSelection=()=>{const vi=state().panels[selectedPanel].variant;if(selected.length!==1)return null;const img=baseSvg(selectedPanel,vi).querySelector(`[data-key="${selected[0]}"]`);if(img?.localName!=='image')return null;const m=img.transform.baseVal.consolidate()?.matrix;if(m&&(Math.abs(m.b)>1e-8||Math.abs(m.c)>1e-8))return null;return {vi,key:selected[0]};};
  const updateScale=(previewOnly=false)=>{const choice=scaleSelection();if(!choice)return say(T('请选中一张未旋转的栅格图像'));const next=copy(state()),p=next.panels[selectedPanel];p.scales||={};p.scales[choice.vi]||={};p.scales[choice.vi][choice.key]={calibration:+$('scaleCalibration').value,length:+$('scaleLength').value,position:$('scalePosition').value,thickness:+$('scaleThickness').value,size:+$('scaleFontSize').value,bold:$('scaleBold').checked,background:$('scaleBackground').checked,alpha:+$('scaleAlpha').value,font:$('font').value,color:$('color').value};if(p.locked||p.lockedElements?.[choice.vi]?.includes(choice.key))return say(T('元素已锁定'));if(previewOnly){try{validateState(next,project);renderCanvas(next);}catch{}}else commit(next,T('已更新比例尺'));};
  $('applyScale').onclick=()=>updateScale();
  for(const id of ['scaleCalibration','scaleLength','scalePosition','scaleThickness','scaleFontSize','scaleBold','scaleBackground','scaleAlpha']){$(id).oninput=()=>updateScale(true);$(id).onchange=()=>updateScale();}
  $('removeScale').onclick=()=>{const choice=scaleSelection();if(!choice)return say(T('请选中一张未旋转的栅格图像'));const next=copy(state());if(next.panels[selectedPanel].lockedElements?.[choice.vi]?.includes(choice.key))return say(T('元素已锁定'));if(next.panels[selectedPanel].scales?.[choice.vi])delete next.panels[selectedPanel].scales[choice.vi][choice.key];commit(next,T('已更新比例尺'));};
  const labelValues=text=>({text,x:+$('labelX').value,y:+$('labelY').value,size:+$('labelSize').value,font:$('font').value,bold:$('labelBold').checked});
  $('numberPanels').onclick=()=>{const next=copy(state());next.order.forEach((id,i)=>{if(!next.panels[id].locked)next.panels[id].label=labelValues($('labelStyle').value==='numeric'?String(i+1):String.fromCharCode(($('labelStyle').value==='lower'?97:65)+i));});commit(next,T('已调整图号'));};
  $('applyPanelLabel').onclick=()=>{const next=copy(state());next.panels[selectedPanel].label=labelValues($('panelLabel').value);commit(next,T('已调整图号'));};
  $('removePanelLabel').onclick=()=>{const next=copy(state());delete next.panels[selectedPanel].label;commit(next,T('已调整图号'));};
  $('groupSelection').onclick=()=>{const next=copy(state());if(selected.length>1){const p=next.panels[selectedPanel],vi=p.variant;p.elementGroups||={};p.elementGroups[vi]=(p.elementGroups[vi]||[]).filter(g=>!g.some(k=>selected.includes(k)));p.elementGroups[vi].push([...selected]);}else if(panelSelection.length>1){next.panelGroups=(next.panelGroups||[]).filter(g=>!g.some(id=>panelSelection.includes(id)));next.panelGroups.push([...panelSelection]);}else return say(T('请先多选小图或元素'));commit(next,T('已组合'));};
  $('ungroupSelection').onclick=()=>{const next=copy(state()),p=next.panels[selectedPanel];if(selected.length){if(p.elementGroups)p.elementGroups[p.variant]=(p.elementGroups[p.variant]||[]).filter(g=>!g.some(k=>selected.includes(k)));}else next.panelGroups=(next.panelGroups||[]).filter(g=>!g.includes(selectedPanel));commit(next,T('已拆分组合'));};
  const lockSelection=value=>{const next=copy(state()),p=next.panels[selectedPanel];if(selected.length){p.lockedElements||={};const keys=new Set(p.lockedElements[p.variant]||[]);selected.forEach(k=>value?keys.add(k):keys.delete(k));p.lockedElements[p.variant]=[...keys];}else for(const id of panelSelection.length?panelSelection:[selectedPanel])next.panels[id].locked=value;commit(next,T(value?'已锁定所选内容':'已解锁所选内容'));};
  $('lockSelection').onclick=()=>lockSelection(true);$('unlockSelection').onclick=()=>lockSelection(false);
  $('undo').onclick=()=>{history.undo();selected=[];original=false;render();persist();say(T('已撤销'));};
  $('redo').onclick=()=>{history.redo();selected=[];original=false;render();persist();say(T('已重做'));};
  $('compare').onclick=()=>{original=!original;renderCanvas();$('compare').textContent=original?T('返回编辑版'):T('原始外观');say(original?T('原版对照：当前布局与候选，未应用外观修改。'):T('已返回编辑版'));};
  $('reset').onclick=()=>{selected=[];commit(project.initialState,T('已恢复 AI 首版；仍可撤销此次恢复'));};
  $('errorDirection').onchange=()=>{const next=copy(state());next.panels[selectedPanel].errorDirection=$('errorDirection').value;commit(next,T('已更新误差棒方向'));};
  $('applyStroke').onclick=()=>updateStyle('stroke-width',$('elementStroke').value,'shape');
  $('elementStroke').onchange=()=>updateStyle('stroke-width',$('elementStroke').value,'shape');
  $('fillMode').onchange=()=>{if($('fillMode').value==='')return;updateStyle('fill',$('fillMode').value==='none'?'none':$('color').value,'shape',$('fillMode').value==='none'?{stroke:$('color').value}:{});};
  $('textAlign').onchange=()=>updateStyle('text-anchor',$('textAlign').value,'text');
  $('overlayAlign').onchange=()=>{const next=copy(state());for(const a of next.overlays||[])if(selectedAnnotations.includes(a.id)&&!a.locked&&a.type==='text')a.align=$('overlayAlign').value;commit(next,T('已更新标注'));};
  document.querySelectorAll('[data-align-objects]').forEach(button=>button.onclick=()=>{
    const mode=button.dataset.alignObjects,root=$('artboard'),svg=root.querySelector('svg'),next=copy(state());
    const nodes=selectedAnnotations.length?selectedAnnotations.map(id=>({id,node:root.querySelector(`[data-annotation="${id}"] > :first-child`)})):selected.map(id=>({id,node:root.querySelector(`[data-panel="${selectedPanel}"] [data-key="${id}"]`)}));
    const items=nodes.filter(x=>x.node).map(x=>({...x,b:x.node.getBoundingClientRect()}));if(items.length<2)return say(T('请选择至少两个对象'));
    const horizontal=['left','center','right'].includes(mode),low=Math.min(...items.map(x=>horizontal?x.b.left:x.b.top)),high=Math.max(...items.map(x=>horizontal?x.b.right:x.b.bottom));
    const target=['left','top'].includes(mode)?low:['right','bottom'].includes(mode)?high:(low+high)/2,box=svg.getBoundingClientRect(),l=layout();
    for(const item of items){const b=item.b,current=mode==='left'?b.left:mode==='right'?b.right:mode==='top'?b.top:mode==='bottom'?b.bottom:horizontal?(b.left+b.right)/2:(b.top+b.bottom)/2,delta=(target-current)/(horizontal?box.width:box.height);
      if(selectedAnnotations.length){const a=next.overlays.find(a=>a.id===item.id);if(a.locked)continue;const k=horizontal?'x':'y';a[k]=Math.max(0,Math.min(1-(horizontal?a.w:a.h),a[k]+delta));}
      else{const panelState=next.panels[selectedPanel];if(panelState.locked||panelState.lockedElements?.[panelState.variant]?.includes(item.id))continue;const vi=panelState.variant,key=horizontal?'offset-x':'offset-y',old=editsFor(selectedPanel,vi)[item.id]||{};setEdit(next,selectedPanel,vi,item.id,key,String(+(old[key]||0)+delta*(horizontal?l.width:l.height)));}
    }commit(next,T('已对齐所选对象'));
  });
  $('scope').onchange=()=>{drawPalettes();renderRecommendations();renderFontTargets();};$('textRole').onchange=()=>{renderFontTargets();say(T('文字类别已选择，下一次文字样式操作将使用此范围。'));};
  document.querySelectorAll('[data-tab]').forEach(el=>{el.onclick=()=>showPane(el.getAttribute('data-tab'));});
  for(const id of ['barWidth','groupGap']){$(id).oninput=()=>{if(state().panels[selectedPanel].locked)return;const next=copy(state());next.panels[selectedPanel].geometry={barWidth:+$('barWidth').value,groupGap:+$('groupGap').value};renderCanvas(next);};$(id).onchange=()=>{const next=copy(state());next.panels[selectedPanel].geometry={barWidth:+$('barWidth').value,groupGap:+$('groupGap').value};commit(next,T('已调整柱宽和组间距'));};}
  $('resetBars').onclick=()=>{const next=copy(state());delete next.panels[selectedPanel].geometry;commit(next,T('已恢复自动柱形布局'));};
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
    const common=['#4477aa','#66ccee','#228833','#ccbb44','#ee6677','#aa3377','#333333','#ffffff'];
    if(!recent){try{recent=JSON.parse(localStorage.getItem('figure-studio:recent-colors')||'[]');}catch{recent=[];}}
    for(const [id,values]of [['quickSwatches',common],['recentSwatches',Array.isArray(recent)?recent:[]]]){
      $(id).replaceChildren();for(const value of values.filter(v=>/^#[0-9a-f]{6}$/i.test(v)).slice(0,8)){
        const b=button('',()=>{$('color').value=value;applyChosenColor();});b.title=value.toUpperCase();b.setAttribute('aria-label',value.toUpperCase());b.style.backgroundColor=value;$(id).append(b);
      }
    }syncColorControls();
  }
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
    for(const id of $('scope').value==='all'?state().order:[selectedPanel]){const vi=state().panels[id].variant;count+=targetObjects(id,vi,editedSvg(id,vi),'text').length;}
    $('fontTargetInfo').textContent=count?T('将修改 {0} 个文字对象；输入后回车或移开即可应用。',count):T('当前未选中文字。请点选文字，或将范围改为当前小图。');
    for(const id of ['font','fontSize','applyFont','bold'])$(id).disabled=!count;
  }
  $('unifyTypography').onclick=()=>{
    const next=copy(state());next.typography={font:$('font').value,size:Math.min(72,Math.max(6,+$('fontSize').value||9))/currentOutput().scale};
    for(const id of next.order){const p=next.panels[id];if(p.locked)continue;delete p.annotationFont;for(const [vi,edits]of Object.entries(p.edits))for(const [key,props]of Object.entries(edits)){if((p.lockedElements?.[vi]||[]).includes(key))continue;delete props['font-family'];delete props['font-size'];}}
    commit(next,T('已统一组图文字规格'));
  };
  function applyFont(previewOnly=false){const n=+$('fontSize').value;if(!Number.isFinite(n)||n<4||n>72){if(!previewOnly)say(T('字号应为 4–72 pt。'));return;}updateStyle('font-family',$('font').value,'text',{'font-size':String(n)},previewOnly);}
  let fontPreview;
  $('fontSize').oninput=()=>{cancelAnimationFrame(fontPreview);fontPreview=requestAnimationFrame(()=>applyFont(true));};
  $('fontSize').onchange=()=>{cancelAnimationFrame(fontPreview);applyFont();};
  $('fontSize').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();cancelAnimationFrame(fontPreview);applyFont();}};
  $('font').onchange=()=>applyFont();
  $('applyFont').onclick=()=>applyFont();
  $('bold').onclick=()=>{
    const vi=state().panels[selectedPanel].variant,svg=editedSvg(selectedPanel,vi),objects=targetObjects(selectedPanel,vi,svg,'text');
    const allBold=objects.length&&objects.every(el=>['bold','700'].includes(el.style.fontWeight||el.getAttribute('font-weight')));
    updateStyle('font-weight',allBold?'400':'700','text');
  };
  $('applyText').onclick=()=>{if(state().panels[selectedPanel].locked||state().panels[selectedPanel].lockedElements?.[state().panels[selectedPanel].variant]?.includes(selected[0]))return say(T('元素已锁定'));if(selected.length!==1)return;const next=copy(state());setEdit(next,selectedPanel,next.panels[selectedPanel].variant,selected[0],'text',$('textContent').value);commit(next,T('已修改文字；请核对标签与数据含义'));};
  $('complement').onclick=()=>{
    const base=$('color').value,other=complementary(base),next=paletteState([base,other]);
    const b=button('',()=>commit(next,T('已应用互补配色')));b.className='palette';const label=document.createElement('span');label.textContent=base+' + '+other+T(' · 点击应用（不代表色觉无障碍已验证）');b.append(preview(editedSvg(selectedPanel,state().panels[selectedPanel].variant,next)),label);$('complementPreview').replaceChildren(b);
  };
  function insertOverlay(type,cell=null){const next=copy(state()),l=layout(),box=cell?l.cells.find(c=>c.row===cell.row&&c.col===cell.col):l.positions.find(p=>p.id===selectedPanel);const x=(box?box.x+box.width*.15:l.width*.3)/l.width,y=(box?box.y+box.height*.2:l.height*.3)/l.height;const a={id:'annotation-'+Date.now(),type,x,y,w:Math.min(.15,1-x),h:type==='line'?0:Math.min(.08,1-y),text:type==='text'?T('文本'):'',font:'Arial',size:10/currentOutput().scale,stroke:1/currentOutput().scale,color:'#253247',opacity:1,fill:false,bold:false,locked:false};next.overlays=[...(next.overlays||[]),a];selectedAnnotations=[a.id];activePane='annotation';commit(next,T('已插入标注'));}
  $('addOverlay').onclick=()=>insertOverlay($('overlayType').value);
  const updateOverlay=(previewOnly=false)=>{const next=copy(state());for(const a of next.overlays||[])if(selectedAnnotations.includes(a.id)&&!a.locked){Object.assign(a,{font:$('overlayFont').value,size:+$('overlaySize').value/currentOutput().scale,color:$('overlayColor').value,stroke:+$('overlayStroke').value/currentOutput().scale,opacity:+$('overlayOpacity').value,fill:$('overlayFill').checked,bold:$('overlayBold').checked});if(a.type==='text'&&selectedAnnotations.length===1)a.text=$('overlayText').value;}if(previewOnly){try{validateState(next,project);renderCanvas(next);}catch{}}else commit(next,T('已更新标注'));};
  $('applyOverlay').onclick=()=>updateOverlay();
  $('overlayOpacity').oninput=()=>updateOverlay(true);
  for(const id of ['overlayFont','overlaySize','overlayColor','overlayStroke','overlayOpacity','overlayFill','overlayBold'])$(id).onchange=()=>$('applyOverlay').click();
  for(const [id,value]of [['lockOverlay',true],['unlockOverlay',false]])$(id).onclick=()=>{const next=copy(state());for(const a of next.overlays||[])if(selectedAnnotations.includes(a.id))a.locked=value;commit(next,T(value?'已锁定所选内容':'已解锁所选内容'));};
  $('deleteOverlay').onclick=()=>{const next=copy(state());next.overlays=(next.overlays||[]).filter(a=>!selectedAnnotations.includes(a.id)||a.locked);commit(next,T('已删除未锁定标注'));};
  $('chartGoal').onchange=()=>render();$('topCount').onchange=()=>render();
  const templatePreviews=JSON.parse($('templatePreviews').textContent);
  const templateStarters=JSON.parse($('templateStarters').textContent);
  let catalogueCategory='current';
  function renderChartLibrary(){
    const pan=panel(selectedPanel),ranked=StudioCatalogue.rank(pan,$('chartGoal').value),available=new Map(ranked.map(x=>[x.v.name,x]));$('chartCategories').replaceChildren();
    const categories={current:[T('当前数据可用'),T('当前数据可用')],...StudioCatalogue.labels};
    for(const [key,names]of Object.entries(categories)){const b=button(names[StudioI18n.language==='en'?1:0],()=>{catalogueCategory=key;renderChartLibrary();});b.setAttribute('aria-pressed',String(catalogueCategory===key));$('chartCategories').append(b);}
    const query=$('chartSearch').value.trim().toLocaleLowerCase(),language=StudioI18n.language==='en'?'en':'zh';
    $('allCharts').replaceChildren();const names=(catalogueCategory==='current'?[...available.keys()]:[...new Set([...available.keys(),...Object.keys(StudioDiscovery),...StudioCatalogue.names])].filter(name=>StudioCatalogue.category(name)===catalogueCategory)).filter(name=>!query||[name,chartName(name),...Object.values(StudioDiscovery[name]||{}).flat()].join(' ').toLocaleLowerCase().includes(query));
    for(const name of names){const entry=StudioDiscovery[name]?.[StudioI18n.language],candidate=available.get(name),card=document.createElement('article');card.className='catalogue-card';const heading=document.createElement('h3');heading.textContent=entry?.[0]||chartName(name);card.append(heading);const badge=document.createElement('span');badge.className='preview-badge';badge.textContent=T(candidate?'当前数据':templatePreviews[name]?'示例数据':'样式示意');card.append(badge);
      if(candidate){const choose=button('',guard(async()=>{$('chartLibrary').close();await activateVariant(candidate.i);}));choose.className='chart-choice';choose.setAttribute('aria-label',T('选择样式：')+chartName(name));choose.append(preview(editedSvg(selectedPanel,candidate.i)));choose.disabled=state().panels[selectedPanel].locked;card.append(choose);}else{const sample=templatePreviews[name]||StudioCatalogue.schematic(name);if(sample){const thumb=preview(sanitize(sample));thumb.classList.add('template-thumbnail');card.append(thumb);}if(templateStarters[name]){const start=button(T('使用示例开始'),guard(async()=>{const destination=selectedPanel,projectId=project.id;start.disabled=true;try{const starter=templateStarters[name];const response=await fetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify(starter)});const result=await response.json();if(!response.ok)throw Error(result.error);if(project.id!==projectId||!state().order.includes(destination))throw Error(T('目标已变化，请重新选择导入位置'));result.panel.name=name;result.panel.provenance='synthetic-template';installAsset(result.panel,destination,null,T('已载入示例；请替换为自己的数据'));$('chartLibrary').close();showPane('data');}finally{start.disabled=false;}}));start.disabled=!localEngine||state().panels[selectedPanel].locked;card.append(start);}else{const unavailable=button(T('查看所需数据'),()=>{description.scrollIntoView({block:'nearest'});description.classList.add('requirements-active');});card.append(unavailable);}}
      const description=document.createElement('p');description.textContent=(candidate?T('当前数据可用'):T('需要相应数据或计算结果'))+' · '+(entry?entry.slice(1).join(' — '):T('请查看分析记录'));card.append(description);
      if(card.querySelector('svg')){const enlarge=button(T('放大预览'),()=>{$('chartDetailTitle').textContent=heading.textContent;$('chartDetailBadge').textContent=badge.textContent;$('chartDetailDescription').textContent=description.textContent;$('chartDetailArt').replaceChildren(namespace(card.querySelector('svg').cloneNode(true)));$('chartDetail').showModal();});enlarge.className='preview-enlarge';enlarge.setAttribute('aria-label',T('放大预览')+' · '+heading.textContent);card.append(enlarge);}
      $('allCharts').append(card);
    }
    $('chartCount').textContent=T('{0} 个图表样式',names.length);
    if(!names.length){const empty=document.createElement('p');empty.textContent=T('没有匹配的图表，请调整搜索词或类别。');$('allCharts').append(empty);}
  }
  $('closeChartDetail').onclick=()=>$('chartDetail').close();
  $('chartSearch').oninput=renderChartLibrary;
  $('moreCharts').onclick=()=>{catalogueCategory='current';$('chartSearch').value='';renderChartLibrary();$('chartLibrary').showModal();};$('closeCharts').onclick=()=>$('chartLibrary').close();
  let dataDrafts={},dataPage=0,dataTimer=null,dataBusy=false,dataSerial=0;
  const localEngine=$('local-engine')?JSON.parse($('local-engine').textContent):null;
  function dataRows(){return dataDrafts[selectedPanel]||panel(selectedPanel)?.table?.rows;}
  function refreshDataExport(){const pending=Object.keys(dataDrafts).some(id=>state().order.includes(id));$('export').disabled=pending;$('png').disabled=pending;}
  function renderDataEditor(){
    const pan=panel(selectedPanel);if(!pan)return;const rows=dataRows(),locked=state().panels[selectedPanel]?.locked;
    $('dataEngineStatus').textContent=!rows?T('此图片没有原始数据表；不能从像素推断实验数据。'):localEngine?T('本机计算已连接 · 数据不会上传到外部服务'):T('独立 HTML 可查看数据；实时重算请用 studio_server.py 启动本机编辑器。');
    for(const id of ['addDataRow','importData','recomputeData','addDataColumn'])$(id).disabled=!rows||!localEngine||locked;
    $('discardData').disabled=!dataDrafts[selectedPanel];$('editableData').replaceChildren();refreshDataExport();if(!rows){$('dataPageInfo').textContent='';return;}
    dataPage=Math.max(0,Math.min(dataPage,Math.ceil((rows.length-1)/20)-1));const start=1+dataPage*20,end=Math.min(rows.length,start+20),table=document.createElement('table'),head=document.createElement('tr');
    head.append(document.createElement('th'));rows[0].forEach((name,c)=>{const th=document.createElement('th');const columnLabel=StudioGalleryContracts[pan.recipe?.parameters?.view]?.columns?.[name];th.textContent=columnLabel?.[StudioI18n.language==='en'?1:0]||name;th.title=name;const del=button('×',()=>{const changed=copy(dataRows());for(const row of changed)row.splice(c,1);editData(changed);renderDataEditor();});del.title=T('删除此列');del.disabled=locked||!localEngine;th.append(del);head.append(th);});table.append(head);
    for(let r=start;r<end;r++){const tr=document.createElement('tr'),label=document.createElement('td');label.textContent=String(r);const del=button('−',()=>{const changed=copy(dataRows());changed.splice(r,1);editData(changed);renderDataEditor();});del.setAttribute('aria-label',T('删除第 {0} 行',r));del.disabled=locked||!localEngine;label.append(del);tr.append(label);rows[r].forEach((value,c)=>{const td=document.createElement('td'),input=document.createElement('input');input.value=value;input.dataset.row=r;input.dataset.column=c;input.setAttribute('aria-label',T('第 {0} 行 · {1}',r,rows[0][c]));input.disabled=locked||!localEngine;input.oninput=()=>{const changed=copy(dataRows());changed[r][c]=input.value;editData(changed);};td.append(input);tr.append(td);});table.append(tr);}
    $('editableData').append(table);$('dataPageInfo').textContent=T('{0}–{1} / {2} 行',start,end-1,rows.length-1);$('dataPrev').disabled=dataPage===0;$('dataNext').disabled=end>=rows.length;
  }
  function editData(rows){dataDrafts[selectedPanel]=rows;dataSerial++;$('dataEditStatus').textContent=T('数据已修改，等待重算；导出暂不可用');$('discardData').disabled=false;refreshDataExport();persist();clearTimeout(dataTimer);dataTimer=setTimeout(recomputeData,650);}
  async function recomputeData(){
    if(dataBusy||!localEngine||!dataDrafts[selectedPanel])return;const id=selectedPanel,serial=dataSerial,projectId=project.id,rows=copy(dataDrafts[id]),source=panel(id),oldName=variant(id).name,oldSize=variant(id).size||'original';
    if(state().panels[id].locked)return;dataBusy=true;$('dataEditStatus').textContent=T('正在更新图形…');
    try{const response=await fetch(localEngine.endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Studio-Token':localEngine.token},body:JSON.stringify({recipe:source.recipe,rows})});const result=await response.json();if(!response.ok)throw Error(result.error);
      if(serial!==dataSerial||project.id!==projectId||!state().order.includes(id)||selectedPanel!==id||state().panels[id].locked)return;
      const asset=result.panel;asset.name=source.name;asset.initialVariant=Math.max(0,asset.variants.findIndex(v=>v.name===oldName&&(v.size||'original')===oldSize));
      const focused=document.activeElement,focus=focused?.dataset.row?{row:focused.dataset.row,column:focused.dataset.column}:null;
      delete dataDrafts[id];installAsset(asset,id,null,T('数据与图形已更新；可撤销'),true);
      $('dataEditStatus').textContent=T('已同步重算 · {0} 秒 · 原始版本仍可撤销',result.seconds);
      if(focus)$('editableData').querySelector(`[data-row="${focus.row}"][data-column="${focus.column}"]`)?.focus();
    }catch(e){if(serial===dataSerial){$('dataEditStatus').textContent=T('尚未应用：')+e.message;say(T('当前图仍对应上次有效数据；请修正数据表。'));}}
    finally{dataBusy=false;if(serial!==dataSerial&&dataDrafts[selectedPanel])dataTimer=setTimeout(recomputeData,100);}
  }
  $('addDataRow').onclick=()=>{const rows=copy(dataRows());rows.push(rows[0].map(()=>''));dataPage=Math.floor((rows.length-2)/20);editData(rows);renderDataEditor();};
  $('addDataColumn').onclick=()=>{const name=$('newColumnName').value.trim(),rows=copy(dataRows());if(!name||rows[0].includes(name))return;rows[0].push(name);for(const row of rows.slice(1))row.push('');editData(rows);renderDataEditor();};
  $('discardData').onclick=()=>{delete dataDrafts[selectedPanel];dataSerial++;clearTimeout(dataTimer);persist();renderDataEditor();$('dataEditStatus').textContent=T('已恢复上次有效数据');};
  $('recomputeData').onclick=()=>{if(!dataDrafts[selectedPanel]&&dataRows()){dataDrafts[selectedPanel]=copy(dataRows());dataSerial++;refreshDataExport();}recomputeData();};$('dataPrev').onclick=()=>{dataPage--;renderDataEditor();};$('dataNext').onclick=()=>{dataPage++;renderDataEditor();};
  $('importData').onclick=()=>{$('dataFile').value='';$('dataFile').click();};
  $('dataFile').onchange=guard(async()=>{const file=$('dataFile').files[0];if(!file)return;if(file.size>2000000)throw Error(T('数据表不能超过 2 MB'));editData(parseDelimited(await file.text(),file.name.endsWith('.tsv')?'\t':','));dataPage=0;renderDataEditor();});
  let imageDestination=null;
  function chooseImage(oldId,cell){if(oldId&&state().panels[oldId].locked)return say(T('小图已锁定'));imageDestination={oldId,cell,projectId:project.id};$('imageFile').value='';$('imageFile').click();}
  function installAsset(asset,oldId,cell,label,preserveAppearance=false){
    if(project.panels.length>=512)throw Error(T('工程版本资源已达上限，请另存为新工程'));
    const profile=preserveAppearance&&oldId?captureProfile()[state().order.indexOf(oldId)]:null;
    const id='panel-'+(Math.max(...project.panels.map(p=>+p.id.slice(6)))+1);asset={...asset,id};
    const next=installPanelState(state(),oldId,id,asset.initialVariant||0,cell),candidate={...project,panels:[...project.panels,asset]};validateProject(candidate);validateState(next,candidate);
    project=candidate;
    if(profile){
      asset.variants.forEach((v,vi)=>{const svg=sanitize(v.svg),colors=[];for(const el of keysToObjects(svg))for(const prop of ['fill','stroke']){const c=hex(paint(el,prop));if(c&&chromatic(c)&&!colors.includes(c))colors.push(c);}
        for(const el of keysToObjects(svg)){const key=el.getAttribute('data-key');if(colors.length===profile.colors.length)for(const prop of ['fill','stroke']){const index=colors.indexOf(hex(paint(el,prop)));if(index>=0){setEdit(next,id,vi,key,prop,profile.colors[index]);const alpha=profile.opacity?.[profile.colors[index]];if(Number.isFinite(alpha))setEdit(next,id,vi,key,'opacity',String(alpha));}}
          if(el.localName==='text'){const style=profile.roles[el.getAttribute('data-role')||'other'];if(style){if(validValue('font-family',style.font))setEdit(next,id,vi,key,'font-family',style.font);const size=style.size*v.viewBox[2]/v.width;if(validValue('font-size',String(size)))setEdit(next,id,vi,key,'font-size',String(size));if(validValue('font-weight',style.weight))setEdit(next,id,vi,key,'font-weight',style.weight);}}
        }
      });
      const old=state().panels[oldId];if(old.annotationStyle&&asset.analysis?.primary_test&&JSON.stringify(panel(oldId).analysis.group_order)===JSON.stringify(asset.analysis.group_order)){next.panels[id].annotationStyle=old.annotationStyle;if(old.annotationFont)next.panels[id].annotationFont=copy(old.annotationFont);}
    }
    selectedPanel=id;selected=[];panelSelection=[id];templateCache.clear();commit(preserveAppearance?next:matchSizes(next,[id]),label);
  }
  $('importImage').onclick=()=>chooseImage(selectedPanel,null);
  $('imageFile').onchange=guard(async()=>{const file=$('imageFile').files[0],target=imageDestination;if(!file||!target)return;if(project.id!==target.projectId||target.oldId&&!state().order.includes(target.oldId))throw Error(T('目标已变化，请重新选择导入位置'));if(file.size>20000000)throw Error(T('图片不能超过 20 MB'));
    let svg,width,height,viewBox;
    if(file.name.toLowerCase().endsWith('.svg')){const raw=await file.text();if(/<!ENTITY/i.test(raw))throw Error(T('不支持 XML 实体'));const clean=sanitize(raw);viewBox=(clean.getAttribute('viewBox')||'').trim().split(/[ ,]+/).map(Number);if(viewBox.length!==4||!viewBox.every(Number.isFinite)||viewBox[2]<=0||viewBox[3]<=0)throw Error(T('SVG 需要有效 viewBox'));width=360;height=360*viewBox[3]/viewBox[2];svg=new XMLSerializer().serializeToString(clean);}
    else{if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error(T('支持 PNG、JPEG、WebP 或 SVG'));const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(T('图片无法解码')));img.src=url;});width=360;height=360*img.naturalHeight/img.naturalWidth;viewBox=[0,0,width,height];svg=`<svg xmlns="${NS}" width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="${url}"/></svg>`;}
    installAsset({name:file.name,variants:[{name:'imported_image',svg,width,height,viewBox,size:'original'}],initialVariant:0,recipe:{source:file.name},analysis:{},table:null,provenance:'user-import'},target.oldId,target.cell,T('图片已导入；可撤销恢复原图'));
  });
  let insertionCell=null;
  function openInsertMenu(cell,x,y,context=false,hasPanel=true){
    insertionCell={row:cell.row,col:cell.col};const menu=$('insertMenu');menu.hidden=false;$('insertCount').value='1';updateInsertCapacity();
    menu.querySelector('strong').textContent=T(context?'快捷操作':'扩展母版');menu.setAttribute('aria-label',T(context?'快捷操作':'插入行或列'));
    let actions=$('contextActions');if(!actions){actions=document.createElement('div');actions.id='contextActions';actions.className='context-actions';menu.insertBefore(actions,menu.children[1]);}actions.replaceChildren();actions.hidden=!context;
    const add=(label,run,disabled=false)=>{const b=button(T(label),()=>{menu.hidden=true;run();});b.disabled=disabled;actions.append(b);};
    const reveal=(id,pane='detail')=>{showPane(pane);const target=$(id);for(let p=target.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;target.scrollIntoView({block:'nearest'});target.focus();};
    if(context){
      if(selected.length||selectedAnnotations.length)add('对象对齐',()=>{showPane(selectedAnnotations.length?'annotation':'detail');document.querySelector(`[data-pane="${selectedAnnotations.length?'annotation':'detail'}"] .object-align`)?.scrollIntoView({block:'nearest'});});
      for(const [type,name]of [['text','插入文本'],['line','插入直线'],['rect','插入矩形'],['ellipse','插入椭圆']])add(name,()=>insertOverlay(type,insertionCell));
      if(selectedAnnotations.length){add('标注属性',()=>{showPane('annotation');renderOverlayProperties();});add('删除标注',()=>$('deleteOverlay').click());}
      add(hasPanel?'替换当前小图…':'在此空格导入图片…',()=>chooseImage(hasPanel?selectedPanel:null,insertionCell),hasPanel&&state().panels[selectedPanel].locked);
      add('↶ 撤销',()=>$('undo').click(),$('undo').disabled);add('↷ 重做',()=>$('redo').click(),$('redo').disabled);
      if(hasPanel){const p=state().panels[selectedPanel],locked=p.locked||selected.some(k=>p.lockedElements?.[p.variant]?.includes(k));
        add('颜色与透明度…',()=>reveal('colorHex'),locked);
        add('字体与字号…',()=>reveal('fontSize'),locked||$('fontSize').disabled);
        add('图型与横竖预览…',()=>showPane('explore'),p.locked);
        add('位置与跨格…',()=>reveal('rowSpan'),p.locked);
        add('图号与位置…',()=>reveal('panelLabel'),p.locked);
        if(!$('barGeometry').hidden)add('统计标注…',()=>reveal('annotationStyle'),p.locked);
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
  $('layoutMode').onclick=()=>{layoutMode=!layoutMode;selected=[];render();};
  $('moveTo').onclick=()=>commit(moveWithSizes(state(),selectedPanel,+$('targetRow').value-1,+$('targetCol').value-1),T('已移动 / 交换小图'));
  $('applySpan').onclick=()=>{try{commit(matchSizes(resizePanel(state(),selectedPanel,+$('rowSpan').value,+$('colSpan').value),[selectedPanel]),T('已应用跨格'));}catch(e){say(e.message);}};
  $('gapSlider').oninput=()=>{const next=copy(state());next.gap=+$('gapSlider').value;$('gap').value=next.gap;renderCanvas(next);};
  $('gapSlider').onchange=()=>{const next=copy(state());next.gap=+$('gapSlider').value;commit(next,T('已修改间距'));};
  $('resetGap').onclick=()=>{const next=copy(state());next.gap=project.initialState.gap;commit(next,T('已恢复初始版本推荐间距'));};
  $('gap').onchange=()=>{const n=+$('gap').value;if(!Number.isFinite(n)||n<0||n>100)return say(T('间距应为 0–100 pt。'));const next=copy(state());next.gap=n;commit(next,T('已修改间距'));};
  $('zoom').onchange=renderCanvas;
  for(const [name,delta]of[['moveUp',-1],['moveDown',1]])$(name).onclick=()=>{const s=state(),i=s.order.indexOf(selectedPanel),j=i+delta;if(j<0||j>=s.order.length)return;const p=gridFor(s).places[s.order[j]];commit(moveWithSizes(s,selectedPanel,p.row,p.col),T('已调整面板顺序'));};
  $('checkpoint').onclick=()=>{const name=$('versionName').value.trim();if(!name)return say(T('请输入版本名称。'));if(checkpoints.length>=20)return say(T('已保存 20 个版本，请另存工程后继续整理。'));checkpoints.push({name,state:copy(state())});$('versionName').value='';persist();render();learnPreferences();say(T('已保存版本「{0}」',name));};

  const libraryIds=new Set();let libraryQueue=Promise.resolve(),libraryRecords=[],presetRecords=[];
  function currentPayload(){return {project,state:copy(state()),history:copy(history.toJSON()),checkpoints:copy(checkpoints),dataDrafts:copy(dataDrafts)};}
  function validatePayload(payload){validateProject(payload.project);validateState(payload.state,payload.project);History.restore(payload.history,payload.project,payload.state);if(!Array.isArray(payload.checkpoints)||payload.checkpoints.length>20)throw Error(T('版本无效'));for(const c of payload.checkpoints){if(typeof c.name!=='string'||c.name.length>60)throw Error(T('版本名称无效'));validateState(c.state,payload.project);}return payload;}
  function libraryWrite(record){libraryIds.add(record.id);const task=libraryQueue.catch(()=>{}).then(()=>StudioLibrary.put('figures',record));libraryQueue=task;task.catch(()=>{$('libraryStatus').textContent=T('总览保存失败，请下载工程备份。');});return task;}
  function collectFigure(){return libraryWrite({id:project.id,name:project.title||project.name||project.id,updatedAt:new Date().toISOString(),payload:currentPayload()});}
  function libraryThumbnail(payload){
    const old={project,history,checkpoints,selectedPanel,selected,original,layoutMode};
    try{project=payload.project;history=new History(payload.state);checkpoints=payload.checkpoints;selectedPanel=state().order[0];selected=[];original=false;layoutMode=false;templateCache.clear();return preview(composite(false,true));}
    finally{({project,history,checkpoints,selectedPanel,selected,original,layoutMode}=old);templateCache.clear();}
  }
  async function openCollected(record){
    validatePayload(record.payload);await collectFigure();await libraryQueue;
    const payload=(await StudioLibrary.list('figures')).find(r=>r.id===record.id)?.payload||record.payload;project=copy(payload.project);history=History.restore(payload.history,project,payload.state);checkpoints=copy(payload.checkpoints);dataDrafts=copy(payload.dataDrafts||{});dataSerial++;selectedPanel=state().order[0];selected=[];panelSelection=[];templateCache.clear();original=false;knownCache=localStorage.getItem('figure-studio:'+project.id);savedCurrent=saveSignature();persist();render();$('libraryDialog').close();say(T('工程已恢复'));
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
      const scale=Object.values(p.scales?.[vi]||{})[0];return {colors:colors.length<=8?colors:[],opacity,roles,geometry:p.geometry,label:p.label,annotationStyle:p.annotationStyle,annotationFont:p.annotationFont,scale};
    });
  }
  function pastePreset(preset){
    const next=copy(state());if(preset.sourceState.exportSettings)next.exportSettings=copy(preset.sourceState.exportSettings);if(preset.sourceState.typography)next.typography=copy(preset.sourceState.typography);next.gap=preset.sourceState.gap;
    let skipped=0;
    next.order.forEach((id,index)=>{const profile=preset.profile[index]||preset.profile[0],target=next.panels[id];if(target.locked){skipped++;return;}if(!profile)return;
      if(profile.geometry)target.geometry=copy(profile.geometry);
      if(profile.annotationFont)target.annotationFont=copy(profile.annotationFont);
      if(profile.annotationStyle&&comparisonsFor(id).length){try{if(profile.annotationStyle==='letters')comparisonLetters(panel(id).analysis.group_order.length,comparisonsFor(id));target.annotationStyle=profile.annotationStyle;}catch{}}
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
  $('exportLibrary').onclick=guard(async()=>{await collectFigure();await renderLibrary();download(new Blob([JSON.stringify({format:'figure-studio-library-v1',figures:libraryRecords,presets:presetRecords})],{type:'application/json'}),'figure-studio-library.json');});
  $('importLibrary').onclick=()=>$('libraryFiles').click();
  $('libraryFiles').onchange=guard(async()=>{
    const records=[],presets=[];for(const file of $('libraryFiles').files){if(file.size>100000000)throw Error(T('工程超过 100 MB'));const input=JSON.parse(await file.text());if(input.format==='figure-studio-library-v1'){if(!Array.isArray(input.figures)||!Array.isArray(input.presets))throw Error(T('该工程需要重新导入'));records.push(...input.figures);presets.push(...input.presets);}else{validatePayload(input);records.push({id:input.project.id,name:input.project.title||input.project.id,updatedAt:new Date().toISOString(),payload:input});}}
    for(const r of records){validatePayload(r.payload);if(r.id!==r.payload.project.id||typeof r.name!=='string'||typeof r.updatedAt!=='string')throw Error(T('该工程需要重新导入'));}
    for(const p of presets){const source=records.find(r=>r.id===p.sourceId)||libraryRecords.find(r=>r.id===p.sourceId);if(!source||typeof p.id!=='string'||typeof p.name!=='string'||!Array.isArray(p.profile))throw Error(T('该工程需要重新导入'));validateState(p.sourceState,source.payload.project);}
    // Imports with existing IDs retain existing local edits; new figures are added.
    const existing=new Set((await StudioLibrary.list('figures')).map(r=>r.id));for(const r of records)if(!existing.has(r.id))await libraryWrite(r);
    const existingPresets=new Set((await StudioLibrary.list('presets')).map(p=>p.id));for(const p of presets)if(!existingPresets.has(p.id))await StudioLibrary.put('presets',p);
    $('libraryFiles').value='';await renderLibrary();
  });
  StudioLibrary.list('figures').then(records=>records.forEach(r=>libraryIds.add(r.id))).catch(()=>{});

  $('save').onclick=()=>{download(new Blob([JSON.stringify(currentPayload(),null,2)],{type:'application/json'}),'figure-studio-project.json');savedCurrent=saveSignature();learnPreferences();say(T('已下载工程；包含原图、当前修改和版本。'));};
  $('load').onclick=()=>$('projectFile').click();
  $('projectFile').onchange=guard(async()=>{
    const file=$('projectFile').files[0];if(!file)return;if(file.size>100000000)throw Error(T('工程超过 100 MB'));
    const payload=JSON.parse(await file.text());validateProject(payload.project);validateState(payload.state,payload.project);
    const restoredHistory=History.restore(payload.history,payload.project,payload.state);
    if(!Array.isArray(payload.checkpoints)||payload.checkpoints.length>20)throw Error(T('版本无效'));
    for(const c of payload.checkpoints){if(typeof c.name!=='string'||c.name.length>60)throw Error(T('版本名称无效'));validateState(c.state,payload.project);}
    if(!confirm(T('打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。')))return;
    project=payload.project;history=restoredHistory;checkpoints=payload.checkpoints;dataDrafts=copy(payload.dataDrafts||{});dataSerial++;selectedPanel=state().order[0];selected=[];templateCache.clear();original=false;savedCurrent=saveSignature();knownCache=undefined;persist();render();say(T('工程已恢复'));$('projectFile').value='';
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
    if(['number','text'].includes(input.type)&&!input.onkeydown&&input.onchange)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.blur();}};
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
  $('export').onclick=guard(async()=>{const svg=composite(false,true),notice=await rasterResolution(svg,currentOutput().dpi);download(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}),'figure-studio.svg');say(T('已导出可编辑 SVG。请继续运行原 skill 的最终尺寸与排版 QA。')+(notice?' '+notice:''));});
  $('png').onclick=guard(async()=>{
    const output=currentOutput(),{widthPx:w,heightPx:h,dpi}=output;
    if(w*h>120000000||Math.max(w,h)>32767)throw Error(T('输出超过浏览器画布容量，请保留投稿尺寸并导出 SVG 后转换。'));
    $('png').disabled=true;
    let url;
    try{await document.fonts.ready;const svg=composite(false,true),notice=await rasterResolution(svg,dpi);url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));
      const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error(T('SVG 栅格化失败，请使用 SVG 导出')));img.src=url;});const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error(T('PNG 导出失败'));const bytes=pngWithDpi(new Uint8Array(await blob.arrayBuffer()),dpi);download(new Blob([bytes],{type:'image/png'}),'figure-studio-'+dpi+'dpi.png');say(T('已导出 {0} × {1} px，{2} dpi；物理尺寸 {3} × {4} mm。',w,h,dpi,output.widthMm.toFixed(2),output.heightMm.toFixed(2))+(notice?' '+notice:''));
    }finally{if(url)URL.revokeObjectURL(url);$('png').disabled=false;}
  });
  document.addEventListener('keydown',e=>{if(e.target.matches('input,textarea,select'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();$(e.shiftKey?'redo':'undo').click();}});
  window.addEventListener('resize',()=>{if(project)renderCanvas();});
  window.addEventListener('beforeunload',e=>{if(history&&saveSignature()!==savedCurrent&&saveSignature()!==localSavedCurrent){e.preventDefault();e.returnValue='';}});
  try {
    project=JSON.parse($('project').textContent);validateProject(project);history=new History(project.initialState);selectedPanel=state().order[0];savedCurrent=saveSignature();
    try {knownCache=localStorage.getItem('figure-studio:'+project.id);let saved=JSON.parse(knownCache||'null');if(saved?.idb){const record=await StudioLibrary.get('autosaves',project.id);if(!record)throw Error('Missing autosave');saved=record.payload;validateProject(saved.project);project=saved.project;}if(saved){validateState(saved.state,project);if(!Array.isArray(saved.checkpoints)||saved.checkpoints.length>20)throw Error(T('缓存版本无效'));for(const c of saved.checkpoints)validateState(c.state,project);try{history=History.restore(saved.history,project,saved.state);message=T('已恢复本浏览器的自动保存。');}catch{history=new History(saved.state);message=T('当前编辑已恢复，但旧撤销记录不可用。');}checkpoints=saved.checkpoints;dataDrafts=saved.dataDrafts||{};}}catch{message=T('未恢复本地缓存；可用「打开工程」导入已保存项目。');}
    $('scope').value='panel';render();if(message)say(message);
    persist();
  } catch(e){const div=document.createElement('div');div.className='fatal';div.textContent=T('无法打开工程：')+T(e.message);document.body.replaceChildren(div);}finally{document.body.inert=false;}
})();
