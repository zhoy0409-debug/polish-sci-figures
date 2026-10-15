/* Real production SVG preparation/rendering, serializer, presentation adapter,
 * persistent records and History. JSDOM does not certify font rasterisation or
 * interactive frame rates; those belong to browser acceptance. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),source=fs.readFileSync(path.join(base,'studio.js'),'utf8'),main=require(path.join(base,'studio.js'));
const clipboard=require(path.join(base,'canvas-clipboard.js')),insertions=require(path.join(base,'element-insertions.js')),geometry=require(path.join(base,'image-insets.js')),rich=require(path.join(base,'rich-text.js')),format=require(path.join(base,'text-formatting.js')),marks=require(path.join(base,'mark-style.js')),transforms=require(path.join(base,'selection-transform-dom.js'));
const locks=require(path.join(base,'layout-lock.js'));
const NS='http://www.w3.org/2000/svg',copy=value=>JSON.parse(JSON.stringify(value));
const block=(from,to)=>{const start=source.indexOf(from),end=source.indexOf(to,start+from.length);assert.ok(start>=0&&end>start,`${from} production block unavailable`);return source.slice(start,end);};
const svg=(body,box='0 0 200 100',width=200,height=100)=>`<svg xmlns="${NS}" width="${width}pt" height="${height}pt" viewBox="${box}">${body}</svg>`;
const original=svg('<defs><clipPath id="clip"><rect width="400" height="200"/></clipPath></defs><g id="axes_1" transform="translate(7 9)" clip-path="url(#clip)"><path id="original-axis" d="M20 20V180H450" fill="none" stroke="#202020"/><text id="original-tick" x="20 32 44" y="190" font-size="12" font-family="Arial">012</text><text id="original-statistic" x="180" y="30" font-size="10">P = 0.032</text><g id="PathCollection_1"><path id="original-point" d="M20 20L21 21" fill="#2468ac"/></g></g>','0 0 500 250',250,125);
function fixture(){
  const dom=new JSDOM('<input id="adaptSizes" type="checkbox" checked><div id="artboard"></div>'),w=dom.window,d=w.document;
  if(!w.CSSStyleDeclaration.prototype[Symbol.iterator])w.CSSStyleDeclaration.prototype[Symbol.iterator]=function*(){for(let i=0;i<this.length;i++)yield this.item(i);};
  const project=main.createBlankProject('a'.repeat(20),'Insertion lifecycle');
  Object.assign(project.panels[0],{provenance:'generated',recipe:{family:'custom'},analysis:{primary_test:{p_value:.032}},variants:[{name:'native',svg:original,width:250,height:125,viewBox:[0,0,500,250],size:'original'}]});
  project.panels.push({id:'panel-1',name:'Other',provenance:'user-import',recipe:{family:'pdf'},analysis:{},variants:[{name:'pdf',svg:svg('<text id="other" x="10" y="20" font-size="9">Other panel</text>'),width:200,height:100,viewBox:[0,0,200,100],size:'original'}]});
  project.initialState=main.arrange({order:['panel-0','panel-1'],columns:2,gap:12,typography:{font:'Times New Roman',size:10},panels:{'panel-0':{variant:0,edits:{}},'panel-1':{variant:0,edits:{}}}},2,1);
  let history=new main.History(project.initialState);
  const ctx={...main,document:d,DOMParser:w.DOMParser,XMLSerializer:w.XMLSerializer,NS,project,templateCache:new Map(),StudioCanvasClipboard:clipboard,StudioRichText:rich,StudioTextFormatting:format,StudioImageInsets:geometry,StudioMarkStyle:marks,StudioSelectionTransformDOM:transforms,
    StudioLegacyStatCleanup:require(path.join(base,'legacy-stat-cleanup.js')),state:()=>history.current,panel:id=>project.panels.find(p=>p.id===id),editsFor:(id,vi,s=history.current)=>s.panels[id].edits[vi]||{},T:value=>value,$:id=>d.getElementById(id)};
  vm.createContext(ctx);
  vm.runInContext(source.split('\n').filter(line=>/^  const (TAGS|ATTRS|STYLES) = new Set/.test(line)).join('\n')+block('  function safeValue(','  function validateProject(')+block('  function baseSvg(','  const heatmapUpgradeRequests=')+block('  function reflowSvg(','  const reflowRequests=')+block('  function textPointSize(','  function visibleTextOutputSizes(')+block('  function appendConditionMatrix(','  function annotationHeight(')+block('  function editedSvg(','  function clearStatisticalResultEdits(')+block('  function applyElementOffsets(','  function wrapPanelContent(')+block('  function paint(','  function hex(')+block('  function matchSizes(','  function moveWithSizes('),ctx);
  const commit=next=>{main.validateState(next,project);assert.equal(history.commit(next),true);};
  const capture=(body,id='pdf-text')=>{const root=ctx.sanitize(svg(body)),node=root.querySelector(`[id="${id}"]`);assert.ok(node);return clipboard.serialize({svg:root,keys:[node.dataset.key],bounds:{x:0,y:0,width:100,height:70},matrix:[1,0,0,1,0,0]});};
  function paste(snapshot,matrix=[2,0,0,2,30,40]){const current=history.current,next=copy(current),result=insertions.append(current.panels['panel-0'],0,snapshot.svg,matrix,{variantCount:1});next.panels['panel-0']=result.panel;const probe=ctx.baseSvg('panel-0',0,next);assert.ok(probe.querySelector(`[data-key="${result.key}"]`));commit(next);return result;}
  const render=(id='panel-0',s=history.current,raw=false,reflow=null)=>ctx.editedSvg(id,0,s,raw,reflow);
  return {ctx,project,dom,w,d,capture,paste,render,commit,get history(){return history;},reopen(){history=main.History.restore(copy(history.toJSON()),project,copy(history.current));},close(){w.close();}};
}
const pdf='<g font-family="Unlisted Research Serif, Arial" fill="#345678" opacity=".6"><text id="pdf-text" x="0 .2 .4" y=".8" transform="scale(50)" font-size=".24">ABC<tspan font-size="70%" font-style="italic">2</tspan></text></g>';
const insertedText=root=>[...root.querySelectorAll('text')].find(node=>Number(node.dataset.key?.slice(1))>=1e9),physicalSize=(root,node,ratio=.5)=>rich.pointSize(node)*Math.hypot(geometry.relativeMatrix(node,root).c,geometry.relativeMatrix(node,root).d)*ratio;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fitAPI(f){
  class Matrix{
    constructor(values=[1,0,0,1,0,0]){['a','b','c','d','e','f'].forEach((key,i)=>{this[key]=values[i];});}
    multiply(other){const result=geometry.multiply(this,other);return new Matrix(['a','b','c','d','e','f'].map(key=>result[key]));}
    inverse(){const result=geometry.inverse(this);return new Matrix(['a','b','c','d','e','f'].map(key=>result[key]));}
    translate(x,y){return this.multiply(new Matrix([1,0,0,1,x,y]));}
    transformPoint(point){return geometry.point(this,point);}
  }
  // Bridge JSDOM's missing SVGAnimatedTransformList to the same production
  // transform parser used for copying and presenting real imported artwork.
  Object.defineProperty(f.w.SVGElement.prototype,'transform',{configurable:true,get(){const node=this;return {baseVal:{consolidate(){const raw=node.getAttribute('transform');if(!raw)return null;const scratch=node.ownerDocument.createElementNS(NS,'svg'),probe=node.ownerDocument.createElementNS(NS,'g');probe.setAttribute('transform',raw);scratch.append(probe);return {matrix:geometry.relativeMatrix(probe,scratch)};}}};}});
  f.ctx.DOMMatrix=Matrix;vm.runInContext(block('  function plotFrame(','  let selectedAnnotations='),f.ctx);
  return {fit:(root,v=f.project.panels[0].variants[0],pos={width:320,height:200})=>f.ctx.fitPlot(root,v,pos,{left:60,right:18,top:52,bottom:36}),variant:f.project.panels[0].variants[0]};
}
let passed=0;const jobs=[],test=(name,fn)=>jobs.push({name,fn});

test('production base/render keep every existing element, original source, analysis and layout unchanged after paste',()=>{
  const f=fixture(),baseline=f.render(),other=f.render('panel-1').outerHTML,beforeProject=copy(f.project),beforeState=copy(f.history.current),snapshot=f.capture(pdf),added=f.paste(snapshot),out=f.render();
  for(const id of ['original-axis','original-tick','original-statistic','PathCollection_1'])assert.equal(out.querySelector(`[id="${id}"]`).outerHTML,baseline.querySelector(`[id="${id}"]`).outerHTML,id);
  for(const name of ['width','height','viewBox'])assert.equal(out.getAttribute(name),baseline.getAttribute(name));
  for(const field of ['grid','columns','gap','order','typography'])assert.deepEqual(f.history.current[field],beforeState[field]);
  assert.deepEqual(f.project,beforeProject);assert.equal(f.render('panel-1').outerHTML,other);assert.equal(f.project.panels[0].analysis.primary_test.p_value,.032);assert.equal(f.ctx.baseSvg('panel-0',0,beforeState).querySelectorAll('text').length,2);assert.ok(f.ctx.baseSvg('panel-0',0).querySelector(`[data-key="${added.key}"]`));
  const text=insertedText(out);assert.equal(text.getAttribute('font-size'),'.24');assert.equal(text.getAttribute('transform'),'scale(50)');assert.equal(text.parentElement.getAttribute('font-family'),'Unlisted Research Serif, Arial');assert.equal(text.parentElement.getAttribute('opacity'),'.6');assert.equal(text.getAttribute('x'),'0 .2 .4');assert.equal(text.querySelector('tspan').getAttribute('font-style'),'italic');near(physicalSize(out,text),12);f.close();
});

test('stable inserted keys support consecutive font/content/spacing edits without touching any old text',()=>{
  const f=fixture(),baseline=f.render().querySelector('#original-tick').outerHTML;f.paste(f.capture(pdf));let text=insertedText(f.render()),key=text.dataset.key,next=copy(f.history.current);
  next.panels['panel-0'].edits[0]={[key]:{'font-family':'Arial','font-size':'.3','letter-spacing':'.02','line-height':'1.7'}};f.commit(next);let out=f.render();text=out.querySelector(`[data-key="${key}"]`);assert.equal(text.style.fontFamily,'Arial');assert.equal(text.style.fontSize,'0.3px');assert.equal(text.style.letterSpacing,'0.02px');assert.equal(text.getAttribute('x'),'0');near(physicalSize(out,text),15);assert.equal(out.querySelector('#original-tick').outerHTML,baseline);
  next=copy(f.history.current);Object.assign(next.panels['panel-0'].edits[0][key],{text:'P = H2\nSecond line','rich-text':JSON.stringify(rich.format(null,'P = H2\nSecond line',0,1,'italic',true))});f.commit(next);out=f.render();text=out.querySelector(`[data-key="${key}"]`);assert.equal(text.textContent,'P = H2\nSecond line');assert.ok([...text.querySelectorAll('tspan')].some(span=>span.getAttribute('font-style')==='italic'||span.style.fontStyle==='italic'));assert.equal(out.querySelector('#original-tick').outerHTML,baseline);assert.equal(text.getAttribute('transform'),'scale(50)');f.reopen();assert.equal(insertedText(f.render()).textContent,'P = H2\nSecond line');f.close();
});

test('Undo/Redo and saved project restoration mount only the requested immutable snapshot',()=>{
  const f=fixture(),before=copy(f.history.current);f.paste(f.capture(pdf));const added=copy(f.history.current),key=insertedText(f.render()).dataset.key,next=copy(added);next.panels['panel-0'].edits[0]={[key]:{text:'Edited'}};f.commit(next);assert.equal(insertedText(f.render()).textContent,'Edited');f.history.undo();assert.equal(insertedText(f.render()).textContent,'ABC2');f.history.undo();assert.equal(insertedText(f.render()),undefined);assert.equal(insertedText(f.render('panel-0',added)).textContent,'ABC2');assert.equal(insertedText(f.ctx.baseSvg('panel-0',0,before)),undefined);f.history.redo();assert.equal(insertedText(f.render()).textContent,'ABC2');f.history.redo();f.reopen();assert.equal(insertedText(f.render()).textContent,'Edited');assert.deepEqual(f.project.initialState,before);f.close();
});

test('production offsets/resize adapter moves inserted group or child exactly once and preserves other objects',()=>{
  const f=fixture(),result=f.paste(f.capture(pdf)),rendered=f.render(),text=insertedText(rendered),textKey=text.dataset.key,p=geometry.point(geometry.relativeMatrix(text,rendered),{x:.2,y:.8}),axis=rendered.querySelector('#original-axis').outerHTML,next=copy(f.history.current);
  next.panels['panel-0'].edits[0]={[result.key]:{'offset-x':'3','offset-y':'-2'},[textKey]:{'object-transform':JSON.stringify([1.2,0,0,1.2,0,0]),'offset-x':'1','offset-y':'2'}};f.commit(next);const out=f.render();f.ctx.applyElementOffsets(out,'panel-0',0,f.history.current,2);const moved=out.querySelector(`[data-key="${textKey}"]`),point=geometry.point(geometry.relativeMatrix(moved,out),{x:.2,y:.8});near(point.x,p.x*1.2+8);near(point.y,p.y*1.2);assert.equal(out.querySelector('#original-axis').outerHTML,axis);assert.ok(moved.closest(`[data-key="${result.key}"]`));f.close();
});

test('inserted high keys use ordinary lock and keyboard nudge guards without statistical key collisions',()=>{
  const f=fixture();f.paste(f.capture(pdf));const key=insertedText(f.render()).dataset.key,next=copy(f.history.current);next.panels['panel-0'].lockedElements={0:[key]};f.commit(next);const before=copy(f.history.current),result=main.nudgeSelectionState(before,[{kind:'element',id:'panel-0',vi:0,key}],1,1,{width:500,height:300,positions:[]});assert.deepEqual(result.next,before);assert.equal(/^e9\d{5,}$/.test(key),false);const layout=main.statisticalLayout('stars',3,{variant:0,edits:{0:{[key]:{'font-size':'500'}}}});assert.equal(layout.fontSize,9);f.close();
});

test('actual absolute lock capture/restoration retains inserted text position and font after a cell viewport changes',()=>{
  const f=fixture();f.paste(f.capture(pdf));
  const canvas=f.d.createElementNS(NS,'svg');canvas.setAttribute('viewBox','0 0 1000 500');canvas.setAttribute('width','1000');canvas.setAttribute('height','500');f.d.getElementById('artboard').append(canvas);
  const first=f.render();first.dataset.panel='panel-0';first.dataset.variant='0';first.setAttribute('x','30');first.setAttribute('y','40');canvas.append(first);const text=insertedText(first),key=text.dataset.key,before=geometry.point(geometry.relativeMatrix(text,canvas),{x:.2,y:.8}),beforeSize=rich.pointSize(text)*Math.hypot(geometry.relativeMatrix(text,canvas).c,geometry.relativeMatrix(text,canvas).d),next=copy(f.history.current);
  const record=locks.captureElements(canvas,'panel-0',0,[key],{edits:next.panels['panel-0'].edits[0]||{},unit:2});locks.addElements(next.panels['panel-0'],record);next.panels['panel-0'].lockedElements={0:[key]};f.commit(next);f.reopen();
  const resized=f.render();resized.dataset.panel='panel-0';resized.dataset.variant='0';for(const [name,value]of Object.entries({x:120,y:100,width:400,height:200}))resized.setAttribute(name,value);first.replaceWith(resized);assert.equal(locks.apply(canvas,f.history.current),1);
  const restored=canvas.querySelector(`[data-key="${key}"]`),after=geometry.point(geometry.relativeMatrix(restored,canvas),{x:.2,y:.8});near(after.x,before.x);near(after.y,before.y);near(rich.pointSize(restored)*Math.hypot(geometry.relativeMatrix(restored,canvas).c,geometry.relativeMatrix(restored,canvas).d),beforeSize);assert.ok(restored.closest('[data-layout-lock-compensate]'));f.close();
});

test('native reflow keeps original mapping stable and pasted typography retains its captured appearance',()=>{
  const f=fixture(),flow={...f.project.panels[0].variants[0],svg:original.replace('viewBox="0 0 500 250"','viewBox="0 0 600 300"'),width:300,height:150,viewBox:[0,0,600,300]},baseline=f.render('panel-0',f.history.current,false,flow);f.paste(f.capture(pdf));const out=f.render('panel-0',f.history.current,false,flow);for(const id of ['original-axis','original-tick','original-statistic'])assert.equal(out.querySelector(`[id="${id}"]`).outerHTML,baseline.querySelector(`[id="${id}"]`).outerHTML);assert.equal(insertedText(out).parentElement.getAttribute('font-family'),'Unlisted Research Serif, Arial');assert.equal(out.getAttribute('viewBox'),'0 0 600 300');f.close();
});

test('destination mark visibility does not hide an independently pasted point collection',()=>{
  const f=fixture(),next=copy(f.history.current);next.panels['panel-0'].markStyle={pointsVisible:false};f.commit(next);const snapshot=f.capture('<g id="PathCollection_9"><path id="copied-point" d="M10 10L11 11" fill="#aabbcc"/></g>','PathCollection_9');f.paste(snapshot);const out=f.render(),originalPoint=out.querySelector('#PathCollection_1'),pasted=[...out.querySelectorAll('g[id]')].find(node=>node.id.endsWith('-PathCollection_9'));assert.equal(originalPoint.style.display,'none');assert.ok(pasted);assert.notEqual(pasted.style.display,'none');assert.notEqual(pasted.querySelector('path').style.display,'none');f.close();
});

test('automatic cell size adaptation retains pasted source variant and ordinary unmodified panels still adapt',()=>{
  const f=fixture(),panel=f.project.panels[0];panel.variants.push({...panel.variants[0],size:'spanWide'});const wider=s=>{const next=copy(s);next.grid.places['panel-0']={row:0,col:0,rs:1,cs:2};return next;};
  assert.equal(f.ctx.matchSizes(wider(f.history.current),['panel-0']).panels['panel-0'].variant,1,'an untouched native panel still uses its matching size variant');f.paste(f.capture(pdf));const before=f.history.current.panels['panel-0'].insertedElements,adapted=f.ctx.matchSizes(wider(f.history.current),['panel-0']);assert.equal(adapted.panels['panel-0'].variant,0);assert.deepEqual(adapted.panels['panel-0'].insertedElements,before);assert.equal(insertedText(f.render('panel-0',adapted)).textContent,'ABC2');f.close();
});

test('production copied multi-element wrapper can be copied, cut, deleted, nudged and protected by locks',async()=>{
  const f=fixture(),c=f.ctx,snapshot=f.capture('<g id="pair"><text x="10" y="20" font-family="Unknown Pair Font" font-size="12">A</text><rect x="30" y="10" width="20" height="20" fill="#234567"/></g>','pair'),added=f.paste(snapshot),messages=[];
  let groups=[{id:'panel-0',vi:0,keys:[added.key]}];
  Object.assign(c,{copy,history:f.history,original:false,selected:[added.key],elementSelections:[],selectionAnchor:null,selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,contentSelection:null,panelSelection:['panel-0'],fileImportSession:null,inlineEditor:null,pointerEditRefresh:false,getComputedStyle:el=>f.w.getComputedStyle(el),selectedLabelIds:()=>[],selectionGroups:()=>groups,setElementSelection:next=>{groups=next;},say:text=>messages.push(text),editableSource:(id,vi)=>f.render(id),commit:next=>{f.commit(next);c.render();return true;}});
  c.render=()=>{const canvas=f.d.createElementNS(NS,'svg');canvas.setAttribute('viewBox','0 0 500 250');canvas.setAttribute('width','500');canvas.setAttribute('height','250');canvas.getBoundingClientRect=()=>({left:0,top:0,right:1000,bottom:500,width:1000,height:500});const live=f.render();live.dataset.panel='panel-0';live.dataset.variant='0';live.getBoundingClientRect=()=>({left:0,top:0,right:500,bottom:250,width:500,height:250});for(const wrapper of live.querySelectorAll('[data-studio-inserted]'))wrapper.getBoundingClientRect=()=>({left:40,top:40,right:240,bottom:180,width:200,height:140});canvas.append(live);f.d.getElementById('artboard').replaceChildren(canvas);};c.render();
  vm.runInContext("const DRAW='path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use,image';"+block('  function isVisibleObject(','  function keysToObjects(')+block('  function deleteSelectedObjects(){','  function renderLabelControls(')+block('  let canvasClipboard=null,','  function canvasPasteDestination('),c);
  const wrapper=()=>f.d.querySelector(`[data-key="${added.key}"]`);assert.equal(c.isVisibleObject(wrapper()),true);assert.equal(c.canvasClipboardSelection().reason,undefined);
  const structural=f.d.createElementNS(NS,'g');structural.setAttribute('data-key',added.key);assert.equal(c.isVisibleObject(structural),false);structural.setAttribute('data-studio-inserted','true');structural.setAttribute('data-key','e2');assert.equal(c.isVisibleObject(structural),false);structural.setAttribute('data-key','e1030000300');assert.equal(c.isVisibleObject(structural),false);
  const before=copy(f.history.current);await c.copyCanvasSelection(false);assert.equal(f.history.index,1);assert.match(messages.at(-1),/已复制/);assert.deepEqual(f.history.current,before);const copied=vm.runInContext('canvasClipboard',c),out=new f.w.DOMParser().parseFromString(copied.svg,'image/svg+xml');assert.equal(out.querySelectorAll('text').length,1);assert.equal(out.querySelectorAll('rect').length,1);
  const nudged=main.nudgeSelectionState(before,[{kind:'element',id:'panel-0',vi:0,key:added.key}],3,-2,{width:500,height:250,positions:[]});assert.equal(nudged.next.panels['panel-0'].edits[0][added.key]['offset-x'],'3');assert.equal(nudged.next.panels['panel-0'].edits[0][added.key]['offset-y'],'-2');
  const locked=copy(f.history.current);locked.panels['panel-0'].lockedElements={0:[added.key]};f.commit(locked);assert.equal(c.canvasClipboardSelection().cutLocked,true);c.deleteSelectedObjects();assert.equal(f.history.current.panels['panel-0'].edits[0]?.[added.key],undefined);await c.copyCanvasSelection(true);assert.match(messages.at(-1),/解锁/);assert.equal(f.history.current.panels['panel-0'].edits[0]?.[added.key],undefined);f.history.undo();c.render();
  c.deleteSelectedObjects();assert.equal(f.history.current.panels['panel-0'].edits[0][added.key].hidden,'true');assert.equal(wrapper().style.display,'none');f.history.undo();c.render();assert.equal(wrapper().style.display,'');await c.copyCanvasSelection(true);assert.equal(f.history.current.panels['panel-0'].edits[0][added.key].hidden,'true');assert.match(messages.at(-1),/已剪切/);f.history.undo();c.render();assert.equal(wrapper().style.display,'');f.close();
});

test('native plot fitting excludes pasted PDF text from original axes/title fitting and keeps its physical geometry',()=>{
  const f=fixture(),{fit}=fitAPI(f),snapshot=f.capture(pdf),record={svg:snapshot.svg,matrix:[1,0,0,1,30,40],keyStart:1e9};
  const expected=f.render();assert.equal(fit(expected),true);clipboard.mountAll({svg:expected,insertions:[record]});
  const out=f.render();clipboard.mountAll({svg:out,insertions:[record]});const wrapper=out.querySelector('[data-studio-inserted]'),before=wrapper.outerHTML;assert.equal(fit(out),true);assert.equal(wrapper.parentElement,out);assert.equal(wrapper.outerHTML,before,'native axis fitting cannot write any pasted transforms or text properties');
  for(const id of ['original-axis','original-tick','original-statistic'])assert.equal(out.querySelector(`[id="${id}"]`).outerHTML,expected.querySelector(`[id="${id}"]`).outerHTML,id);
  const a=insertedText(out),b=insertedText(expected),actual=geometry.point(geometry.relativeMatrix(a,out),{x:.2,y:.8}),wanted=geometry.point(geometry.relativeMatrix(b,expected),{x:.2,y:.8});near(actual.x,wanted.x);near(actual.y,wanted.y);near(physicalSize(out,a,1),12);near(physicalSize(out,a,1),physicalSize(expected,b,1));assert.equal(out.getAttribute('viewBox'),'0 0 320 200');assert.equal(out.getAttribute('data-aligned-plot'),'true');f.close();
});

test('a pasted image cannot disable native plot fitting, while an original image retains the existing gate',()=>{
  const f=fixture(),{fit}=fitAPI(f),snapshot=f.capture('<image id="copied-image" href="data:image/png;base64,iVBORw0KGgo=" x="10" y="10" width="30" height="20"/>','copied-image'),record={svg:snapshot.svg,matrix:[1,0,0,1,30,40],keyStart:1e9},baseline=f.render();assert.equal(fit(baseline),true);
  const out=f.render();clipboard.mountAll({svg:out,insertions:[record]});const wrapper=out.querySelector('[data-studio-inserted]'),before=wrapper.outerHTML;assert.equal(fit(out),true);assert.equal(wrapper.parentElement,out);assert.equal(wrapper.outerHTML,before);assert.equal(out.querySelector('#original-axis').outerHTML,baseline.querySelector('#original-axis').outerHTML);
  const originalImage=f.render(),image=f.d.createElementNS(NS,'image');image.setAttribute('href','data:image/png;base64,iVBORw0KGgo=');image.setAttribute('width','30');image.setAttribute('height','20');originalImage.append(image);clipboard.mountAll({svg:originalImage,insertions:[record]});const unchanged=originalImage.outerHTML;assert.equal(fit(originalImage),false);assert.equal(originalImage.outerHTML,unchanged);f.close();
});

test('unsupported or undersized native fit reattaches every pasted wrapper without changing its contents',()=>{
  const f=fixture(),{fit,variant}=fitAPI(f),snapshot=f.capture(pdf),records=[{svg:snapshot.svg,matrix:[1,0,0,1,30,40],keyStart:1e9},{svg:snapshot.svg,matrix:[1,0,0,1,60,70],keyStart:1e9+100001}];
  for(const [v,pos]of [[{...variant,preserveAspect:true},{width:320,height:200}],[variant,{width:80,height:50}]]){const out=f.render();clipboard.mountAll({svg:out,insertions:records});const before=out.outerHTML,wrappers=[...out.querySelectorAll(':scope > [data-studio-inserted]')];assert.equal(fit(out,v,pos),false);assert.equal(out.outerHTML,before);assert.ok(wrappers.every(wrapper=>wrapper.parentElement===out));}f.close();
});

test('a native measurement exception restores pasted wrappers and removes its temporary measurement host',()=>{
  const f=fixture(),{fit}=fitAPI(f),snapshot=f.capture(pdf),out=f.render(),legend=f.d.createElementNS(NS,'g');legend.id='legend_1';legend.getBBox=()=>{throw Error('Deterministic SVG measurement failure');};out.append(legend);clipboard.mountAll({svg:out,insertions:[{svg:snapshot.svg,matrix:[1,0,0,1,30,40],keyStart:1e9}]});const wrapper=out.querySelector('[data-studio-inserted]'),before=wrapper.outerHTML,oldAxis=out.querySelector('#original-axis').outerHTML;assert.throws(()=>fit(out),/Deterministic SVG measurement failure/);assert.equal(wrapper.parentElement,out);assert.equal(wrapper.outerHTML,before);assert.equal(out.querySelector('#original-axis').outerHTML,oldAxis);assert.equal(out.parentElement,null,'failed fitting cannot leave the figure in a hidden measuring element');assert.equal(f.d.querySelectorAll('[style*="position: fixed"]').length,0);f.close();
});

(async()=>{for(const {name,fn}of jobs){await fn();passed++;console.log('PASS '+name);}console.log(`PASS ${passed} production element insertion render lifecycle groups.`);})().catch(error=>{console.error(error);process.exitCode=1;});
