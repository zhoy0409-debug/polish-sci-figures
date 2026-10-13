/* Execute the production canvas handlers in a DOM mock; no browser simulation claim. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const {History,arrange,movePanel,resizePanel,gridFor,validateState,visualPanelOrder,displayedPanelLabel}=require(path);
const source=fs.readFileSync(require.resolve(path),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const ids=['p0','p1','p2','p3'],project={panels:ids.map(id=>({id,variants:[{name:'fixture',size:'original'}]}))};
const initial=arrange({order:ids,columns:3,gap:12,typography:{font:'Arial',size:9},panels:Object.fromEntries(ids.map((id,i)=>[id,{variant:0,edits:{0:{e1:{fill:'#526e9e','font-size':'11'}}},label:{text:String.fromCharCode(65+i),x:2,y:5,size:12,font:'Arial',bold:true}}]))},3,3);
const T=(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[i]);
function element(kind='g'){
  return {kind,dataset:{},style:{},attrs:{},children:[],replaceChildren(){this.children=[];},classList:{add(){},remove(){},toggle(){}},
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k];},
    append(node){node.parent=this;this.children.push(node);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);},
    closest(){return null;},querySelector(){return null;},querySelectorAll(){return [];},setPointerCapture(){}};
}
function harness(start=initial){
  let history=new History(start),commits=0,renders=0,validationCalls=0,selectionStarted=0;
  const svg=element('svg'),messages=[],windowEvents={},documentEvents={},fields={scope:{value:'element'},adaptSizes:{checked:false},layoutMode:element(),arrangePanels:element(),boxSelect:element(),viewport:element()};
  const l={width:324,height:264,cells:Array.from({length:9},(_,i)=>({row:Math.floor(i/3),col:i%3,x:i%3*112,y:Math.floor(i/3)*92,width:100,height:80}))};
  svg.getBoundingClientRect=()=>({left:20,top:30,width:648,height:528});
  const ctx={copy,svg,viewport:element(),workspaceLayer:element(),selectedNodes:()=>[],l,project,NS:'svg',T,Math,gridFor,movePanel,resizePanel,visualPanelOrder,displayedPanelLabel,
    state:()=>history.current,validateState(s,p){validationCalls++;return validateState(s,p);},
    $:id=>fields[id],document:{createElementNS:(_,kind)=>element(kind),querySelectorAll:()=>[],addEventListener:(type,fn)=>documentEvents[type]=fn},
    window:{getSelection:()=>({removeAllRanges(){}}),addEventListener:(type,fn)=>windowEvents[type]=fn},cancelQueuedZoom(){},cancelAnimationFrame(){},cancelOverlayPlacement(){ctx.placementCancels=(ctx.placementCancels||0)+1;},
    commit(next){validateState(next,project);const changed=history.commit(next);if(changed){commits++;renders++;}return true;},
    render(){renders++;},renderCanvas(){renders++;},say:message=>messages.push(message),mobileWorkspace:null,
    screenRect:()=>({left:0,top:0,right:0,bottom:0}),canvasPoint:e=>({x:(e.clientX-20)/648,y:(e.clientY-30)/528}),
    renderOverlayProperties(){throw Error('arrange mode must not move an annotation separately');},
    selectPanelLabel(){throw Error('arrange mode must not drag a label separately');},
    requestAnimationFrame(){selectionStarted++;return 1;},paintMarquee(){},drawSelection(){},
    drawAlignmentGuides(){},renderAlignmentGuideControls(){},snapLayer:element(),
  };
  vm.createContext(ctx);
  vm.runInContext(source.split('\n').find(line=>line.includes('  function prepareTouchEditing(')),ctx);
  vm.runInContext(source.slice(source.indexOf('  function canvasObjectTarget('),source.indexOf('  function addStatisticalHitAreas(')),ctx);
  const moveStart=source.indexOf('  function matchSizes('),moveEnd=source.indexOf('  function renderMasters(',moveStart);
  const destination=source.split('\n').find(line=>line.includes('    const destination=e=>'));
  const at=source.split('\n').find(line=>line.includes('    const at=cell=>'));
  const dropStart=source.indexOf('    const drop=e=>'),dropEnd=source.indexOf('    let labelDrag=',dropStart);
  const previewStart=source.indexOf('    let resizeDrag=null,panelDrag='),previewEnd=source.indexOf('    svg.onpointerdown=',previewStart);
  const pointerStart=previewEnd,pointerEnd=source.indexOf('    svg.ondblclick=',pointerStart);
  const syncStart=source.indexOf('  function syncCanvasModes('),syncEnd=source.indexOf('  function renderCanvas(',syncStart);
  const toggleStart=source.indexOf("  $('boxSelect').onclick="),toggleEnd=source.indexOf('\n',source.indexOf("$('arrangePanels').onclick=togglePanelArrange;",toggleStart));
  vm.runInContext(`let selectedPanel='p0',selected=[],elementSelections=[],selectedAnnotations=[],selectedPanelLabel=null,panelSelection=[],layoutMode=true,boxSelect=false,dragging=null,original=false,selectionAnchor=null,activePane='detail',selectionFrame=0;
    let labelDrag=null,overlayDrag=null,elementDrag=null,guideDrag=null,marquee=null,suppressClick=false,cancelPanelGesture=null,cancelSelectionGesture=null,cancelObjectGesture=null,selectionAfterMarquee=false,selectedAlignmentGuide=null;
    ${source.slice(moveStart,moveEnd)}
    ${destination}\n${at}\n${source.slice(dropStart,dropEnd)}
    ${source.slice(source.indexOf('    const beginMarquee='),previewStart)}
    ${source.slice(previewStart,previewEnd)}\n${source.slice(pointerStart,pointerEnd)}
    ${source.slice(syncStart,syncEnd)}\n${source.slice(toggleStart,toggleEnd)}
    globalThis.mode=(arrange,box=false)=>{layoutMode=arrange;boxSelect=box;};
    globalThis.details=()=>({layoutMode,boxSelect,dragging,panelDrag,marquee,selectedPanelLabel});
    globalThis.nativeDrag=id=>{layoutMode=true;dragging=id;};
    globalThis.sync=syncCanvasModes;globalThis.cancelOnRepaint=()=>cancelPanelGesture?.();
  `,ctx);
  vm.runInContext(source.split('\n').filter(line=>line.includes("window.addEventListener('blur'")||line.includes("document.addEventListener('keydown',e=>{if(e.key==='Escape'")).join('\n'),ctx);
  const target=(type='plot',id='p0')=>({closest(selector){
    if(type==='label'&&selector==='[data-panel-label]')return {dataset:{panelLabel:id},getAttribute:()=>id};
    if(type==='annotation'&&selector==='[data-annotation]')return {dataset:{annotation:'note'}};
    if(type==='grip'&&selector==='[data-panel-move]')return {dataset:{panelMove:id}};
    if(type==='resize'&&selector==='[data-resize]')return {getAttribute:key=>key==='data-resize-panel'?id:'right'};
    return null;
  }});
  function point(row,col,type='plot',id='p0',offset=0){return {button:0,shiftKey:false,pointerId:1,clientX:20+(col*112+40)*2+offset,clientY:30+(row*92+30)*2,target:target(type,id),preventDefault(){this.prevented=true;}};}
  return {svg,ctx,l,point,fields,messages,windowEvents,documentEvents,state:()=>history.current,history,stats:()=>({commits,renders,validationCalls,selectionStarted}),ghost:()=>svg.children.find(n=>n.dataset.panelDropPreview)};
}

// Arrange mode starts from existing chart marks, labels and annotations equally.
for(const type of ['plot','label','annotation']){
  const h=harness();h.svg.onpointerdown(h.point(0,0,type));h.svg.onpointermove(h.point(0,1,type));
  assert.equal(h.ghost().dataset.panelDropPreview,'valid');assert.equal(h.ghost().children[1].textContent,'交换位置');
  const first=h.stats();for(let i=0;i<40;i++)h.svg.onpointermove(h.point(0,1,type,'p0',i/10));
  assert.equal(h.stats().validationCalls,first.validationCalls,'same-cell moves reuse the pending candidate');
  assert.equal(h.stats().renders,0,'pointer movement never rebuilds canvas or inspector');
  h.svg.onpointerup(h.point(0,1,type));assert.equal(h.stats().commits,1);assert.equal(h.stats().renders,1,'committed move renders once');
  assert.deepEqual(gridFor(h.state()).places.p0,{row:0,col:1,rs:1,cs:1});assert.deepEqual(gridFor(h.state()).places.p1,{row:0,col:0,rs:1,cs:1});
  assert.deepEqual(h.state().panels,initial.panels,'source data, edits and labels survive a slot swap');
  assert.deepEqual(visualPanelOrder(h.state()).map(id=>displayedPanelLabel(h.state(),id).text),['A','B','C','D']);
  h.history.undo();assert.deepEqual(h.state(),initial);h.history.redo();assert.equal(gridFor(h.state()).places.p0.col,1);
}

// Direct frame grip operates without entering arrange mode; plain chart drag remains selection.
const direct=harness();direct.ctx.mode(false);direct.svg.onpointerdown(direct.point(0,0,'grip'));direct.svg.onpointermove(direct.point(2,2));direct.svg.onpointerup(direct.point(2,2));
assert.equal(direct.stats().commits,1);assert.equal(direct.fields.scope.value,'panel','whole-panel grip resets stale element scope');assert.equal(direct.ctx.details().layoutMode,false);assert.deepEqual(gridFor(direct.state()).places.p0,{row:2,col:2,rs:1,cs:1});
const edit=harness();edit.ctx.mode(false);edit.svg.onpointerdown(edit.point(0,0));assert.ok(edit.ctx.details().marquee);assert.equal(edit.ctx.details().panelDrag,null);edit.svg.onpointercancel();assert.equal(edit.stats().commits,0);

// Single click, sub-threshold jitter and dropping in the original slot add no history.
for(const offset of [0,1,8]){const h=harness();h.svg.onpointerdown(h.point(0,0));h.svg.onpointermove(h.point(0,0,'plot','p0',offset));h.svg.onpointerup(h.point(0,0,'plot','p0',offset));assert.equal(h.stats().commits,0);assert.deepEqual(h.state(),initial);}
// Out-of-canvas and cancelled gestures remove feedback without changing state.
for(const cancel of [false,true]){const h=harness();h.svg.onpointerdown(h.point(0,0));h.svg.onpointermove(h.point(1,2));assert.ok(h.ghost());if(cancel)h.svg.onpointercancel();else{const outside={...h.point(1,2),clientX:-30};h.svg.onpointermove(outside);assert.equal(h.ghost(),undefined);h.svg.onpointerup(outside);}assert.equal(h.stats().commits,0);assert.equal(h.ghost(),undefined);}
// Clicking a resize handle, or returning to the original span, must retain
// explicit physical track widths/heights instead of rebuilding the master.
const tracks=copy(initial);tracks.grid.widths=[240,280,320];tracks.grid.heights=[180,200,220];
for(const moved of [false,true]){const h=harness(tracks);h.svg.onpointerdown(h.point(0,0,'resize'));if(moved){h.svg.onpointermove(h.point(0,1,'resize'));h.svg.onpointermove(h.point(0,0,'resize'));}h.svg.onpointerup(h.point(0,0,'resize'));assert.equal(h.stats().commits,0);assert.deepEqual(h.state(),tracks);}
// Unexpected capture loss, released buttons, window blur, Escape and repaint
// cancel the operation without leaving global dragging or changing history.
for(const reason of ['capture','buttons','blur','escape','repaint']){
  const h=harness();h.svg.onpointerdown(h.point(0,0));h.svg.onpointermove(h.point(1,2));
  if(reason==='capture')h.svg.onlostpointercapture();
  if(reason==='buttons')h.svg.onpointermove({...h.point(1,2),buttons:0});
  if(reason==='blur')h.windowEvents.blur();
  if(reason==='escape'){const e={key:'Escape',preventDefault(){this.prevented=true;}};h.documentEvents.keydown(e);assert.equal(e.prevented,true);}
  if(reason==='repaint')h.ctx.cancelOnRepaint();
  assert.equal(h.ctx.details().dragging,null);assert.equal(h.ctx.details().panelDrag,null);assert.equal(h.ghost(),undefined);assert.equal(h.stats().commits,0);
  h.svg.onpointermove({...h.point(1,2),buttons:0});assert.equal(h.ghost(),undefined);
}
// Locked source cannot start; locked destinations preview as invalid and cannot swap.
const locked=copy(initial);locked.panels.p1.locked=true;const hLocked=harness(locked);hLocked.svg.onpointerdown(hLocked.point(0,1));assert.equal(hLocked.ctx.details().panelDrag,null);hLocked.svg.onpointerdown(hLocked.point(0,0));hLocked.svg.onpointermove(hLocked.point(0,1));assert.equal(hLocked.ghost().dataset.panelDropPreview,'invalid');hLocked.svg.onpointerup(hLocked.point(0,1));assert.equal(hLocked.stats().commits,0);assert.deepEqual(hLocked.state(),locked);
// Entire spanning slots exchange; an empty target preserves the moved span.
const wide=resizePanel(initial,'p0',1,2),span=harness(wide),other=gridFor(wide).places.p1;
span.svg.onpointerdown(span.point(0,0));span.svg.onpointermove(span.point(other.row,other.col));span.svg.onpointerup(span.point(other.row,other.col));assert.equal(gridFor(span.state()).places.p1.cs,2);assert.equal(gridFor(span.state()).places.p0.cs,1);assert.deepEqual(span.state().panels,wide.panels);
// Sidebar native drag shares the same target feedback and commit path.
const native=harness();native.ctx.nativeDrag('p0');native.svg.ondragover(native.point(2,1));assert.equal(native.ghost().children[1].textContent,'移动至此');native.svg.ondrop(native.point(2,1));assert.equal(gridFor(native.state()).places.p0.row,2);assert.equal(native.stats().commits,1);
// Native sidebar cancellation refreshes stale feedback; successful drop does
// not trigger a second canvas refresh on dragend.
const dragEnd=source.match(/b\.ondragend=\(\)=>\{if\(dragging\)\{dragging=null;renderCanvas\(\);\}\};/)[0];
for(const dropFirst of [false,true]){const h=harness();h.ctx.b={};vm.runInContext(dragEnd,h.ctx);h.ctx.nativeDrag('p0');h.svg.ondragover(h.point(2,1));if(dropFirst)h.svg.ondrop(h.point(2,1));const before=h.stats().renders;h.ctx.b.ondragend();assert.equal(h.ctx.details().dragging,null);assert.equal(h.stats().renders-before,dropFirst?0:1);}
// The visible tools are mutually exclusive and expose their state accurately.
const tools=harness();tools.ctx.mode(false,true);tools.fields.arrangePanels.onclick();assert.equal(tools.ctx.details().layoutMode,true);assert.equal(tools.ctx.details().boxSelect,false);assert.equal(tools.fields.scope.value,'panel');tools.ctx.sync();assert.equal(tools.fields.arrangePanels.attrs['aria-pressed'],'true');assert.equal(tools.fields.layoutMode.textContent,'完成排列');tools.fields.boxSelect.onclick();assert.equal(tools.ctx.details().layoutMode,false);assert.equal(tools.ctx.details().boxSelect,true);assert.equal(tools.ctx.placementCancels,2,'changing canvas modes leaves insertion mode');

console.log('Canvas panel drag handlers passed: arrange/direct grip, labels/annotations routing, cell-cached preview, swap/empty/span/locks, no-op threshold, outside/cancel, preservation, visual numbering, undo/redo and mode controls. Scope: production handlers in Node DOM mock.');
