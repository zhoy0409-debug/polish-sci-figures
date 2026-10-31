/* Production keyboard controller and SVG preview in DOM mocks, not browser QA. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const {History,nudgeSelectionState,editingTextTarget,historyShortcut,alignmentSnap}=require(file);
const source=fs.readFileSync(require.resolve(file),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+' != '+b);
const geometry={width:400,height:300,positions:[{id:'p',x:10,y:12,width:180,height:140},{id:'q',x:210,y:12,width:180,height:140}]};
const initial={panels:{
 p:{variant:0,edits:{0:{e1:{fill:'#526e9e','offset-x':'2'},e900000:{'font-size':'24'},e800001:{text:'+'}}},label:{text:'A',x:2,y:4}},
 q:{variant:0,edits:{},label:{text:'B',x:2,y:4}},
 locked:{variant:0,edits:{},locked:true}
 },overlays:[{id:'note',x:.25,y:.4,w:.2,h:.1,text:'kbind',locked:false},{id:'fixed',x:0,y:0,w:.1,h:.1,locked:true}],
 alignmentGuides:[{id:'guide-1',axis:'x',position:100},{id:'guide-2',axis:'y',position:80}],
 analysis:{primary_test:{pairwise:[{a:0,b:1,p:.0000245}]}},table:{rows:[['value'],['-4'],['2']]}};
const native=(id,key,extra={})=>({kind:'element',id,vi:0,key,...extra});
const items=[native('p','e1'),native('p','e900000'),native('p','e900001'),native('p','e800001'),native('q','e12'),{kind:'overlay',id:'note'},{kind:'label',id:'q'}];
// Mixed elements retain every text/style/data value, and share one physical delta.
{
 const before=JSON.stringify(initial),{next}=nudgeSelectionState(initial,items,3,-2,geometry);
 for(const item of items.filter(x=>x.kind==='element')){const edit=next.panels[item.id].edits[0][item.key];near(+edit['offset-x'],item.key==='e1'?5:3);near(+edit['offset-y'],-2);}
 near(next.overlays[0].x,.2575);near(next.overlays[0].y,.4-2/300);near(next.panels.q.label.x,2+3/180*100);
 assert.equal(next.panels.p.edits[0].e900000['font-size'],'24');assert.equal(next.panels.p.edits[0].e800001.text,'+');
 assert.deepEqual(next.analysis,initial.analysis);assert.deepEqual(next.table,initial.table);assert.equal(JSON.stringify(initial),before);
 const restored=nudgeSelectionState(initial,items,0,0,geometry,next).next;assert.deepEqual(restored,initial,'returning to the start must not leave empty edits');
}
{
 const base=copy(initial);base.panels.p.lockedElements={0:['e900000']};base.overlays[0].x=1-base.overlays[0].w;
 const lockedItems=[native('locked','e1'),native('p','e900000'),native('p','e9',{vi:1}),{kind:'overlay',id:'fixed'},{kind:'label',id:'locked'}];
 assert.deepEqual(nudgeSelectionState(base,lockedItems,10,10,geometry).next,base);
 const result=nudgeSelectionState(base,[native('q','e12'),{kind:'overlay',id:'note'}],30,5,geometry);near(result.dx,0);near(result.dy,5);near(+result.next.panels.q.edits[0].e12['offset-y'],5);
 const guide=nudgeSelectionState(initial,[{kind:'guide',id:'guide-1'}],500,5,geometry);near(guide.next.alignmentGuides[0].position,400);
 near(nudgeSelectionState(initial,[{kind:'guide',id:'guide-1'}],guide.dx-1,5,geometry).next.alignmentGuides[0].position,399);
 assert.deepEqual(nudgeSelectionState(initial,[{kind:'guide',id:'guide-1'}],0,4,geometry).next,initial,'a vertical guide does not move vertically');
}
// A whole-figure selection uses final figure points, survives repeated keys,
// and returning to the origin does not create an identity-only history entry.
{
 const base=copy(initial),whole=[{kind:'content',id:'p',vi:0}];
 const moved=nudgeSelectionState(base,whole,3,-2,geometry).next;
 assert.deepEqual(moved.panels.p.contentTransforms[0],[1,0,0,1,3,-2]);
 assert.deepEqual(nudgeSelectionState(base,whole,0,0,geometry,moved).next,base);
 base.panels.p.contentTransforms={0:[0,2,-3,0,20,30]};
 const result=nudgeSelectionState(base,[native('p','e1')],6,4,geometry).next.panels.p.edits[0].e1;
 near(+result['offset-x'],4);near(+result['offset-y'],-2);
 base.panels.p.lockedElements={0:['e1']};
 assert.deepEqual(nudgeSelectionState(base,whole,3,5,geometry).next,base);
}
function target(type='canvas'){
 return {isContentEditable:type==='contenteditable',closest(selector){
  if(selector==='[role="separator"]')return type==='separator'?this:null;
  if(selector==='#artboard')return type==='canvas'?this:null;
  return ['input','textarea','select','contenteditable','textbox'].includes(type)?this:null;
 }};
}
function harness(){
 let history=new History(initial),objects=items,groups=[{id:'p',vi:0,keys:['e1','e900000','e900001','e800001']},{id:'q',vi:0,keys:['e12']}],frames=new Map(),serial=0,draws=[],clears=0,commits=0,renders=0,focuses=0,scale=1;
 const documentEvents={},windowEvents={},assets={p:{id:'p'},q:{id:'q'}};
 const buttons={undo:{disabled:true,click(){if(!this.disabled)this.onclick?.();}},redo:{disabled:true,click(){if(!this.disabled)this.onclick?.();}}};
 const viewport={clientLeft:1,clientTop:1,clientWidth:400,clientHeight:300,getBoundingClientRect:()=>({left:20,top:30}),setAttribute(k,v){this[k]=v;},focus(options){assert.equal(options.preventScroll,true);focuses++;}};
 const preview={draw(s,delta){draws.push({s:copy(s),delta:copy(delta)});},clear(){clears++;}};
 const ctx={copy,nudgeSelectionState,editingTextTarget,historyShortcut,history,project:{id:'figure'},original:false,layoutMode:false,dragging:null,overlayPlacement:null,inlineEditor:null,
  contentSelection:null,selectedAnnotations:['note'],selectedPanelLabel:'q',selectedAlignmentGuide:null,panelSelection:[],selectedEmptyCell:null,
  state:()=>history.current,panel:id=>assets[id],selectionGroups:()=>groups,quickSelectedObjects:()=>objects,currentOutput:()=>({scale}),
  zoomView:{nudgeCanvas:{geometry,capture:()=>preview}},cancelQueuedZoom(){},cancelQuickPreview(){},
  $:id=>id==='viewport'?viewport:buttons[id],T:s=>s,selected:[],persist(){},say(){},
  render(){renders++;buttons.undo.disabled=history.index===0;buttons.redo.disabled=history.index===history.states.length-1;},
  commit(next,label,renderNow=true){if(history.commit(next)){commits++;if(renderNow)renders++;}return true;},
  requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
  document:{addEventListener:(type,fn)=>{(documentEvents[type]||=[]).push(fn);},querySelector:()=>null},
  window:{addEventListener:(type,fn)=>{(windowEvents[type]||=[]).push(fn);}}
 };
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function panelContentDelta('),source.indexOf('function nudgeSelectionState(')),ctx);
 vm.runInContext(source.slice(source.indexOf('  let labelSelections=[];'),source.indexOf('  const sizeNames=')),ctx);
 const start=source.indexOf('  // Arrow-key repeats'),end=source.indexOf('  // Frequent actions',start);
 assert.ok(start>0&&end>start);vm.runInContext(source.slice(start,end),ctx);
 const bindingStart=source.indexOf("  document.addEventListener('keydown',e=>{if(!e.isComposing&&!editingTextTarget(e.target)&&nudgeGesture)"),bindingEnd=source.indexOf("  document.addEventListener('keydown',e=>{if(e.isComposing",bindingStart);
 assert.ok(bindingStart>0&&bindingEnd>bindingStart);vm.runInContext(source.slice(bindingStart,bindingEnd),ctx);
 const event=(key,extra={})=>({key,target:target(),button:0,clientX:80,clientY:80,preventDefault(){this.defaultPrevented=true;},...extra});
 return {ctx,viewport,assets,buttons,objects(value){objects=value;},groups(value){groups=value;},scale(value){scale=value;},
  installActualUndo(){vm.runInContext(source.split('\n').filter(line=>line.includes("$('undo').onclick=")||line.includes("$('redo').onclick=")||line.includes("document.addEventListener('keydown',e=>{if(e.isComposing||editingTextTarget(e.target))return;")).join('\n'),ctx);},
  dispatch(type,key,extra={}){const e=event(key,extra);for(const fn of documentEvents[type]||[])fn(e);return e;},
  blur(){for(const fn of windowEvents.blur||[])fn();},flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());},
  read:()=>({current:history.current,commits,renders,draws,clears,focuses,pending:frames.size,history}),
  resetSelection(){groups=[];ctx.selectedAnnotations=[];ctx.selectedPanelLabel=null;},
  gesture:()=>vm.runInContext('nudgeGesture',ctx)};
}
{
 const h=harness(),before=copy(h.read().current);
 for(let i=0;i<35;i++)assert.equal(h.dispatch('keydown','ArrowRight',{repeat:i>0}).defaultPrevented,true);
 assert.equal(h.read().pending,1);assert.equal(h.read().commits,0);assert.deepEqual(h.read().current,before);
 h.flush();assert.equal(h.read().draws.length,1);near(h.read().draws[0].delta.dx,35);
 h.dispatch('keyup','ArrowRight');assert.equal(h.read().commits,1);assert.equal(h.read().renders,1);near(+h.read().current.panels.p.edits[0].e1['offset-x'],37);
 assert.equal(h.ctx.selectedAnnotations[0],'note');assert.equal(h.ctx.selectedPanelLabel,'q');assert.deepEqual(h.read().history.undo(),before);h.read().history.redo();near(+h.read().current.panels.p.edits[0].e1['offset-x'],37);
}
for(const [mods,step]of [[{},1],[{shiftKey:true},10],[{altKey:true},.1],[{altKey:true,shiftKey:true},.1]]){
 const h=harness();h.scale(2);h.dispatch('keydown','ArrowDown',mods);h.dispatch('keyup','ArrowDown');near(+h.read().current.panels.p.edits[0].e900000['offset-y'],step/2);near(h.read().current.overlays[0].y,.4+step/2/300);
}
{
 const h=harness();h.dispatch('keydown','ArrowRight');h.dispatch('keydown','ArrowDown');h.dispatch('keyup','ArrowRight');assert.equal(h.read().commits,0);
 h.dispatch('keyup','Shift');assert.equal(h.read().commits,0);h.dispatch('keyup','ArrowDown');assert.equal(h.read().commits,1);
 near(+h.read().current.panels.p.edits[0].e1['offset-x'],3);near(+h.read().current.panels.p.edits[0].e1['offset-y'],1);
}
{
 const h=harness();h.dispatch('keydown','ArrowRight');h.flush();h.dispatch('keydown','Escape');
 assert.equal(h.read().commits,0);assert.equal(h.read().pending,0);assert.equal(h.gesture(),null);near(h.read().draws.at(-1).delta.dx,0);assert.ok(h.read().clears);
 h.dispatch('keydown','ArrowUp');h.blur();assert.equal(h.read().commits,1);near(+h.read().current.panels.p.edits[0].e1['offset-y'],-1);
}
{
 const h=harness();h.dispatch('keydown','ArrowRight');h.dispatch('keydown','ArrowLeft');h.dispatch('keyup','ArrowRight');h.dispatch('keyup','ArrowLeft');assert.equal(h.read().commits,0,'net-zero gesture needs no undo step');
}
{
 const h=harness();h.dispatch('keydown','ArrowRight');assert.equal(h.read().draws.length,0);
 h.dispatch('pointerdown','',{target:target()});assert.equal(h.read().commits,1);assert.equal(h.read().renders,0,'capture commit must preserve pointer target identity');
 near(h.read().draws.at(-1).delta.dx,1);assert.equal(h.read().pending,0);assert.equal(h.read().focuses,1);
 h.dispatch('keyup','ArrowRight');assert.equal(h.read().commits,1);
}
for(const action of [{key:'z',ctrlKey:true},{key:'z',metaKey:true},{key:'Delete'},{key:'Backspace'}]){
 const h=harness();h.dispatch('keydown','ArrowRight');h.dispatch('keydown',action.key,action);
 assert.equal(h.read().commits,1);assert.equal(h.read().renders,0);assert.equal(h.gesture(),null);
 assert.deepEqual(h.read().history.undo(),initial,'Undo after held arrows restores that gesture');
}
// Run both production key listeners and the actual Undo button callback. Native
// disabled buttons ignore click(), which is essential on the very first edit.
for(const modifier of [{ctrlKey:true},{metaKey:true}]){
 const h=harness();h.installActualUndo();assert.equal(h.buttons.undo.disabled,true);
 h.dispatch('keydown','ArrowRight');h.dispatch('keydown','z',modifier);
 assert.equal(h.read().commits,1);assert.equal(h.read().history.index,0);assert.deepEqual(h.read().current,initial);
 assert.equal(h.buttons.undo.disabled,true);assert.equal(h.buttons.redo.disabled,false);
 // A new quiet pointer commit invalidates the redo branch and enables Undo.
 h.dispatch('keydown','ArrowDown');h.dispatch('pointerdown','');
 assert.equal(h.read().history.index,1);assert.equal(h.buttons.undo.disabled,false);assert.equal(h.buttons.redo.disabled,true);
 h.buttons.undo.click();assert.deepEqual(h.read().current,initial);
}
// Hover-only candidate/layout canvases and any mouse gesture refuse keyboard
// edits before capturing objects or touching history.
for(const name of ['candidate','layout','element','overlay','label','guide','marquee','resize','panel']){
 const h=harness();const canvas=h.ctx.zoomView.nudgeCanvas;
 canvas.isPreview=['candidate','layout'].includes(name);
 canvas.isGestureActive=()=>!canvas.isPreview;
 canvas.capture=()=>{throw Error('blocked canvas must not capture a nudge');};
 assert.ok(!h.dispatch('keydown','ArrowRight').defaultPrevented,name);
 assert.equal(h.read().pending,0);assert.equal(h.read().commits,0);assert.equal(h.gesture(),null);assert.deepEqual(h.read().current,initial);
}
for(const type of ['input','textarea','select','contenteditable','textbox','separator']){
 const h=harness();const e=h.dispatch('keydown','ArrowDown',{target:target(type)});assert.ok(!e.defaultPrevented,type);assert.equal(h.read().commits,0);assert.equal(h.read().pending,0);
}
for(const block of [{isComposing:true},{ctrlKey:true},{metaKey:true},{defaultPrevented:true}]){
 const h=harness();const e=h.dispatch('keydown','ArrowRight',block);assert.equal(h.read().pending,0);assert.equal(h.gesture(),null);if(!block.defaultPrevented)assert.ok(!e.defaultPrevented);
}
for(const name of ['original','layoutMode','dragging','overlayPlacement','inlineEditor']){
 const h=harness();h.ctx[name]=true;assert.ok(!h.dispatch('keydown','ArrowLeft').defaultPrevented,name);assert.equal(h.read().pending,0);
}
{
 const h=harness();h.objects(items.map(item=>({...item,locked:true})));assert.ok(!h.dispatch('keydown','ArrowLeft').defaultPrevented);
 h.ctx.selectedAlignmentGuide='guide-2';h.dispatch('keydown','ArrowUp',{shiftKey:true});h.dispatch('keyup','ArrowUp');near(h.read().current.alignmentGuides[1].position,70);
}
for(const invalidate of [
 h=>{h.ctx.project={id:'another'};},h=>{h.assets.p={id:'replacement'};},
 h=>h.resetSelection(),h=>{h.ctx.zoomView.nudgeCanvas={geometry,capture(){throw Error('not used');}};},
 h=>h.read().history.commit({...copy(initial),unrelated:'new transaction'})
]){
 const h=harness();h.dispatch('keydown','ArrowRight');invalidate(h);h.flush();assert.equal(h.read().commits,0);assert.equal(h.gesture(),null);assert.equal(h.read().pending,0);
}
{
 const h=harness();
 h.dispatch('pointerdown','',{target:h.viewport,clientX:30,clientY:40});assert.equal(h.read().focuses,1);
 h.dispatch('pointerdown','',{target:h.viewport,clientX:421,clientY:40});assert.equal(h.read().focuses,1,'scrollbar edge must not take focus');
 h.dispatch('pointerdown','',{target:target('input')});h.dispatch('pointerdown','',{button:2});assert.equal(h.read().focuses,1);
 h.ctx.inlineEditor={};h.dispatch('pointerdown','');assert.equal(h.read().focuses,1,'active inline editor owns its focus');
}
// Production adapter converts display CSS pixels through each parent matrix.
// A nearby alignment target may produce a guide but may not alter exact nudges.
class Matrix{
 constructor(v=[1,0,0,1,0,0]){[this.a,this.b,this.c,this.d,this.e,this.f]=v;}
 inverse(){const {a,b,c,d,e,f}=this,det=a*d-b*c;return new Matrix([d/det,-b/det,-c/det,a/det,(c*f-d*e)/det,(b*e-a*f)/det]);}
 transformPoint(p){return {x:this.a*p.x+this.c*p.y+this.e,y:this.b*p.x+this.d*p.y+this.f};}
}
function svgNode(attrs={},matrix=new Matrix()){
 return {attrs:{...attrs},parentElement:{getScreenCTM:()=>matrix},getAttribute(k){return this.attrs[k]??null;},setAttribute(k,v){this.attrs[k]=String(v);},removeAttribute(k){delete this.attrs[k];}};
}
for(const zoom of [.25,1,3.5]){
 let liveZoom=zoom;
 const text=svgNode({transform:'rotate(-90)'},new Matrix([0,2*zoom,-2*zoom,0,70,30])),stat=svgNode({},new Matrix([zoom,0,0,zoom,50,60])),label=svgNode(),overlay={replaceWith(node){this.last=node;}};
 text.parentElement.getScreenCTM=()=>new Matrix([0,2*liveZoom,-2*liveZoom,0,70,30]);stat.parentElement.getScreenCTM=()=>new Matrix([liveZoom,0,0,liveZoom,50,60]);
 let guides=[],outlines=0,manual=null;
 const l=geometry,svg={getBoundingClientRect:()=>({width:l.width*liveZoom,height:l.height*liveZoom}),querySelector:s=>s.includes('annotation')?overlay:null},selectionLayer=svgNode();
 const adapterItems=[native('p','e1',{el:text}),native('p','e900000',{el:stat}),{kind:'overlay',id:'note'},{kind:'label',id:'q',el:label},{kind:'guide',id:'guide-1'}];
 const ctx={imageLinks:null,zoomView:{},l,svg,selectionLayer,state:()=>initial,previewState:initial,selectionResize:null,elementDrag:null,overlayDrag:null,labelDrag:null,guideDrag:null,marquee:null,resizeDrag:null,panelDrag:null,DOMMatrix:Matrix,alignmentSnap,alignmentContext:()=>({bounds:{left:10,right:20,top:10,bottom:20},targets:[{axis:'x',position:11.1,manual:true}]}),overlayNode:a=>copy(a),drawAlignmentGuides:s=>manual=s.alignmentGuides[0].position,paintSnapGuides:g=>guides=g,drawSelection:()=>outlines++,selectedNodes:()=>[]};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('    const captureLabelMotion='),source.indexOf('    const selectedDragItems=')),ctx);const at=source.indexOf('    zoomView.nudgeCanvas='),end=source.indexOf('    svg.classList.toggle',at);assert.ok(at>0&&end>at);vm.runInContext(source.slice(source.indexOf('  function refreshInsetGraphics('),source.indexOf('  function overlayNode('))+'\n'+source.slice(at,end),ctx);
 assert.equal(ctx.zoomView.nudgeCanvas.isPreview,false);assert.equal(ctx.zoomView.nudgeCanvas.isGestureActive(),false);
 for(const key of ['elementDrag','overlayDrag','labelDrag','guideDrag','marquee','resizeDrag','panelDrag']){ctx[key]={};assert.equal(ctx.zoomView.nudgeCanvas.isGestureActive(),true,key);ctx[key]=null;}
 ctx.previewState=copy(initial);ctx.previewState.panels.p.variant=1;vm.runInContext(source.slice(source.indexOf('  function refreshInsetGraphics('),source.indexOf('  function overlayNode('))+'\n'+source.slice(at,end),ctx);assert.equal(ctx.zoomView.nudgeCanvas.isPreview,true);
 ctx.previewState={...initial,columns:3};vm.runInContext(source.slice(source.indexOf('  function refreshInsetGraphics('),source.indexOf('  function overlayNode('))+'\n'+source.slice(at,end),ctx);assert.equal(ctx.zoomView.nudgeCanvas.isPreview,true);
 ctx.previewState=initial;vm.runInContext(source.slice(source.indexOf('  function refreshInsetGraphics('),source.indexOf('  function overlayNode('))+'\n'+source.slice(at,end),ctx);
 const preview=ctx.zoomView.nudgeCanvas.capture(adapterItems),next=nudgeSelectionState(initial,adapterItems,1,.1,l).next;
 preview.draw(next,{dx:1,dy:.1});
 const translated=text.attrs.transform.match(/^translate\(([^ ]+) ([^)]+)\)/);near(+translated[1],.05);near(+translated[2],-.5);assert.ok(text.attrs.transform.endsWith('rotate(-90)'));
 const statTranslated=stat.attrs.transform.match(/^translate\(([^ ]+) ([^)]+)\)/);near(+statTranslated[1],1);near(+statTranslated[2],.1);
 near(+label.attrs.x,210+180*.02+1);near(overlay.last.x,.25+1/400);near(manual,101);assert.ok(guides.length);assert.equal(selectionLayer.attrs.transform,'translate(1 0.1)','the captured selection outline follows the exact fine adjustment');assert.equal(outlines,0,'keyboard preview must not reread all selected boxes');
 liveZoom*=1.5;preview.draw(nudgeSelectionState(initial,adapterItems,2,.2,l).next,{dx:2,dy:.2});const afterZoom=stat.attrs.transform.match(/^translate\(([^ ]+) ([^)]+)\)/);near(+afterZoom[1],2);near(+afterZoom[2],.2);
 preview.draw(initial,{dx:0,dy:0});preview.clear();assert.equal(text.attrs.transform,'rotate(-90)');assert.equal(stat.attrs.transform,undefined);assert.equal(selectionLayer.attrs.transform,'translate(0 0)');assert.equal(guides.length,0);
}
console.log('PASS keyboard nudge: mixed targets, final-pt steps, one-gesture undo, native disabled-button Ctrl+Z, pointer/hover preview exclusions, locks/input/IME, stale guards, focus and SVG matrix preview at 3 zooms.');
