/* Production pointer/selection handlers in a bounded DOM mock, not a browser test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const {marqueeHit,alignmentSnap}=require(path),source=fs.readFileSync(require.resolve(path),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
function el(tag='g',data={},box={left:0,top:0,right:0,bottom:0}){
  const classes=new Set(),attrs={},n={localName:tag,dataset:data,style:{},children:[],parentElement:null,
    classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)},
    setAttribute(k,v){attrs[k]=String(v);if(k==='class'){classes.clear();String(v).split(' ').forEach(x=>classes.add(x));}},hasAttribute(k){return this.getAttribute(k)!=null;},getAttribute(k){if(k.startsWith('data-'))return data[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())];return attrs[k]??null;},
    removeAttribute(k){delete attrs[k];if(k==='class')classes.clear();if(k.startsWith('data-'))delete data[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())];},
    getBoundingClientRect:()=>({...box,width:box.right-box.left,height:box.bottom-box.top}),
    append(child){child.parentElement=this;this.children.push(child);},replaceChildren(...children){this.children=[];children.forEach(c=>this.append(c));},
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);},
    replaceWith(other){const p=this.parentElement;if(p){other.parentElement=p;p.children[p.children.indexOf(this)]=other;}},
    contains(node){return node===this||this.children.some(c=>c.contains(node));},
    matches(s){if(s==='[data-studio-hit-key]')return !!data.studioHitKey;if(s===tag)return true;if(s==='.chosen')return classes.has('chosen');if(s==='[data-panel]')return !!data.panel;if(s==='[data-key]'||s==='text[data-key]')return !!data.key&&(s[0]!=='t'||tag==='text');if(s==='[data-annotation]')return !!data.annotation;if(s==='[data-panel-label]')return !!data.panelLabel;const m=s.match(/^\[data-(panel|key|annotation|panel-label)="([^"]+)"\]$/);return m?data[m[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]===m[2]:false;},
    closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;},
    querySelectorAll(s){const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return s==='*'?all:all.filter(c=>c.matches(s));},
    querySelector(s){const parts=s.split(' ');if(parts.length===2)return this.querySelector(parts[0])?.querySelector(parts[1])||null;return this.querySelectorAll(s)[0]||null;},
    setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},
    transform:{baseVal:{consolidate:()=>null}},getScreenCTM:()=>null,
  };return n;
}
function harness({vector=false}={}){
  const svg=el('svg',{}, {left:100,top:80,right:700,bottom:500}),viewport=el('div',{}, {left:20,top:20,right:820,bottom:620});
  Object.assign(viewport,{clientLeft:2,clientTop:2,clientWidth:780,clientHeight:580,scrollLeft:0,scrollTop:0});viewport.append(svg);
  const a=el('g',{panel:'p0'},{left:110,top:90,right:360,bottom:480}),b=el('g',{panel:'p1'},{left:390,top:90,right:680,bottom:480});svg.append(a);svg.append(b);
  const t1=el('text',{key:'tick1'},{left:130,top:140,right:150,bottom:156}),t2=el('text',{key:'tick2'},{left:130,top:190,right:150,bottom:206}),t3=el('text',{key:'tick3'},{left:420,top:140,right:440,bottom:156});a.append(t1);a.append(t2);b.append(t3);
  const noteBox={left:480,top:280,right:540,bottom:310},note=el('g',{annotation:'note'},noteBox);svg.append(note);
  const selectionLayer=el(),workspaceLayer=el('svg');svg.append(selectionLayer);viewport.append(workspaceLayer);
  const s={order:['p0','p1'],panels:{p0:{variant:0,edits:{},label:{}},p1:{variant:0,edits:{},label:{}}},overlays:[{id:'note',x:.6,y:.5,w:.1,h:.1}]};
  const initial=copy(s),fields={scope:{value:'panel'},deleteElements:{disabled:true},viewport};let commits=0,renders=0,nativeClears=0,rafId=0;const raf=new Map(),messages=[];
  const ctx={svg,viewport,selectionLayer,workspaceLayer,NS:'svg',l:{width:600,height:420,positions:[]},marqueeHit,alignmentSnap,Math,copy,previewState:s,imageLinks:null,imageInsets:null,imageColorUI:null,refreshInsetGraphics(){assert.ok(s.overlays.every(a=>a.type!=='inset'),'This fixture contains ordinary annotations only');},renderAlignmentGuideControls(){},
    state:()=>s,panel:id=>({id,variants:[{width:300,viewBox:[0,0,300,420]}]}),$:id=>fields[id],T:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i]),isVisibleObject:()=>true,
    getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1',fill:'#222',stroke:'none'}),
    document:{createElementNS:(_,tag)=>el(tag),querySelectorAll:()=>[]},window:{getSelection:()=>({removeAllRanges(){nativeClears++;}})},
    requestAnimationFrame(fn){const id=++rafId;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),cancelQueuedZoom(){},
    render(){renders++;},renderSelectionProperties(){fields.deleteElements.disabled=!ctx.count();},renderOverlayProperties(){fields.deleteElements.disabled=!ctx.count();},
    showPane(){},renderDataEditor(){},renderMethods(){},renderInspector(){vm.runInContext('inspectorPanel=selectedPanel',ctx);},renderLabelControls(){},startInlineTextEdit:node=>{ctx.inlineTarget=node;},visualPanelOrder:()=>s.order,say:m=>messages.push(m),
    overlayNode:()=>el('g',{annotation:'note'},noteBox),commit(next){commits++;Object.assign(s,copy(next));},
    editsFor:()=>({}),setEdit(next,id,vi,key,prop,value){((next.panels[id].edits[vi]??={})[key]??={})[prop]=value;},
    selectPanelLabel(){},at:()=>null,destination:()=>null,zoomView:{},
  };ctx.overlayEditingSpace=require(path).overlayEditingSpace;if(vector)ctx.StudioVectorInteraction=require('../skills/polish-sci-figures/assets/figure-studio/vector-interaction.js');vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('function panelContentDelta('),source.indexOf('function nudgeSelectionState(')),ctx);
  vm.runInContext(source.slice(source.indexOf('  function canvasObjectTarget('),source.indexOf('  function addStatisticalHitAreas(')),ctx);
  const groups=source.slice(source.indexOf('  function selectionGroups('),source.indexOf('  const sizeNames='))+source.slice(source.indexOf('  function refreshOverlaySelection('),source.indexOf('  function renderOverlayProperties('));
  const local=source.slice(source.indexOf('    const screenRect=el=>'),source.indexOf('    let resizeDrag=null,panelDrag='));
  const behind=source.slice(source.indexOf('    const behindTarget=target=>'),source.indexOf('    svg.onpointerdown=e=>'));
  const handlers=source.slice(source.indexOf('    svg.onpointerdown=e=>'),source.indexOf('  function renderMethods(){'));
  vm.runInContext(`let selectedPanel='p0',inspectorPanel='p0',selected=[],elementSelections=[],selectionAnchor=null,selectedAnnotations=[],selectedPanelLabel=null,panelSelection=[],selectionAfterMarquee=false,layoutMode=false,original=false,boxSelect=false,activePane='detail',cancelSelectionGesture=null,cancelPanelGesture=null,cancelObjectGesture=null,selectedAlignmentGuide=null;
    let labelDrag=null,overlayDrag=null,elementDrag=null,guideDrag=null,marquee=null,suppressClick=false,resizeDrag=null,panelDrag=null,dragging=null,pending=null;
    const canvasPoint=e=>({x:(e.clientX-100)/600,y:(e.clientY-80)/420});const clearGhost=()=>{};
    ${groups}\n${local}\n${behind}\n${handlers.replace(/\n  }\s*$/,'')}
    globalThis.count=()=>selectionGroups().reduce((n,g)=>n+g.keys.length,0)+selectedAnnotations.length;
    globalThis.details=()=>({groups:selectionGroups(),annotations:selectedAnnotations,post:selectionAfterMarquee,active:!!marquee,suppress:suppressClick});
    globalThis.boxMode=value=>{boxSelect=value;};
  `,ctx);
  const event=(x,y,target=viewport,opts={})=>({button:0,buttons:1,pointerId:7,shiftKey:false,clientX:x,clientY:y,target,preventDefault(){this.prevented=true;},...opts});
  function tap(target,x,y,opts={}){const surface=svg.contains(target)?svg:viewport,e=event(x,y,target,opts);surface.onpointerdown(e);surface.onpointerup(e);surface.onclick(e);if(surface===svg)viewport.onclick(e);return e;}
  function drag(x,y,toX,toY,opts={}){const e=event(x,y,viewport,opts);viewport.onpointerdown(e);viewport.onpointermove(event(toX,toY,viewport,opts));return e;}
  function finish(x,y,opts={}){const e=event(x,y,viewport,opts);viewport.onpointerup(e);viewport.onclick(e);}
  function flush(){for(const [id,fn]of [...raf]){raf.delete(id);fn();}}
  return {ctx,svg,viewport,t1,t2,t3,note,selectionLayer,workspaceLayer,fields,event,tap,drag,finish,flush,raf,s,initial,messages,stats:()=>({commits,renders,nativeClears})};
}

// Gray origin, crossing the canvas boundary, coalesced live preview and finalized selection.
// A click sequence preserves the actual text nodes, including the first click in
// another panel. Pointer capture stays on text so dblclick is not retargeted to SVG.
const clicks=harness(),noteText=el('text',{}, {left:480,top:280,right:540,bottom:310});clicks.note.append(noteText);
clicks.tap(noteText,500,290);assert.equal(clicks.note.children[0],noteText);assert.equal(clicks.stats().renders,0);assert.equal(noteText.capture,7);
clicks.tap(noteText,500,290);assert.equal(clicks.note.children[0],noteText);assert.equal(clicks.stats().renders,0);clicks.svg.ondblclick(clicks.event(500,290,noteText));assert.equal(clicks.ctx.inlineTarget,noteText);
clicks.tap(clicks.t3,430,148);assert.equal(clicks.stats().renders,0,'first click in another panel only refreshes inspector');assert.equal(clicks.t3.capture,7);clicks.tap(clicks.t3,430,148);clicks.svg.ondblclick(clicks.event(430,148,clicks.t3));assert.equal(clicks.ctx.inlineTarget,clicks.t3);assert.ok(clicks.svg.contains(clicks.t3));assert.equal(clicks.stats().commits,0);
const h=harness(),down=h.drag(60,110,160,215);assert.equal(down.prevented,true);assert.equal(h.stats().nativeClears,1);
for(let i=0;i<20;i++)h.viewport.onpointermove(h.event(160+i/10,215));assert.equal(h.raf.size,1);h.flush();
assert.equal(h.selectionLayer.children.length,2);assert.ok(h.selectionLayer.children.every(n=>n.classList.contains('is-candidate')));
assert.equal(h.workspaceLayer.style.display,'block');h.finish(162,215);
assert.equal(h.ctx.count(),2);assert.ok(h.ctx.details().post);assert.equal(h.fields.deleteElements.disabled,false);
assert.ok(h.selectionLayer.children.every(n=>!n.classList.contains('is-candidate')));assert.ok(h.t1.classList.contains('chosen'));assert.equal(h.workspaceLayer.style.display,'none');
assert.equal(h.stats().commits,0);assert.deepEqual(h.s,h.initial);

// The first ordinary click after marquee clears; the next click selects normally.
h.tap(h.t3,430,148);assert.equal(h.ctx.count(),0);assert.equal(h.selectionLayer.children.length,0);assert.equal(h.fields.deleteElements.disabled,true);assert.equal(h.t1.classList.contains('chosen'),false);
h.tap(h.t3,430,148);assert.equal(h.ctx.count(),1);assert.equal(h.ctx.details().groups[0].id,'p1');
h.tap(h.viewport,55,60);assert.equal(h.ctx.count(),0);assert.equal(h.ctx.details().suppress,false);
h.tap(h.t1,140,148);assert.equal(h.ctx.count(),1,'gray tap must not consume next source click');
h.tap(h.viewport,55,60,{shiftKey:true});assert.equal(h.ctx.count(),1,'Shift gray tap keeps selection');
h.tap(h.svg,670,460);assert.equal(h.ctx.count(),0,'white blank clears');

// Source + inserted annotations are selected together; Shift annotation-only retains source selection.
const mixed=harness();mixed.drag(60,110,550,320);mixed.finish(550,320);assert.equal(mixed.ctx.count(),4);assert.equal(mixed.ctx.details().annotations.length,1);assert.equal(mixed.selectionLayer.children.length,4);
mixed.tap(mixed.viewport,50,50);assert.equal(mixed.ctx.count(),0);assert.equal(mixed.selectionLayer.children.length,0);
mixed.tap(mixed.t1,140,148);mixed.drag(470,270,550,320,{shiftKey:true});mixed.finish(550,320,{shiftKey:true});assert.equal(mixed.ctx.count(),2);assert.equal(mixed.ctx.details().groups[0].keys[0],'tick1');assert.equal(mixed.ctx.details().annotations[0],'note');
mixed.drag(470,270,550,320);mixed.finish(550,320);assert.equal(mixed.ctx.count(),1);assert.equal(mixed.ctx.details().groups.length,0,'annotation-only replaces old source groups');
mixed.tap(mixed.t1,140,148,{shiftKey:true});assert.equal(mixed.ctx.count(),2);assert.equal(mixed.ctx.details().annotations[0],'note','Shift source click retains previously selected annotation');assert.equal(mixed.ctx.details().groups[0].keys[0],'tick1');

// No duplicate SVG bubbling, toolbar/middle/right/scrollbar gestures are not intercepted.
for(const opt of [{button:1},{button:2}]){const k=harness(),e=k.event(50,50,k.viewport,opt);k.viewport.onpointerdown(e);assert.equal(k.ctx.details().active,false);assert.equal(e.prevented,undefined);}
for(const [x,y]of [[805,80],[100,610],[20,30]]){const k=harness(),e=k.event(x,y);k.viewport.onpointerdown(e);assert.equal(k.ctx.details().active,false);}
const ignored=harness();ignored.viewport.onpointerdown(ignored.event(140,148,ignored.t1));assert.equal(ignored.ctx.details().active,false);
ignored.viewport.onpointerdown(ignored.event(50,50,{closest:()=>({})}));assert.equal(ignored.ctx.details().active,false);

// Scroll/capture loss/cancel/lost button abort without history or stale overlay.
for(const ending of ['onscroll','onlostpointercapture','onpointercancel','buttons']){const k=harness();k.drag(60,110,160,215);k.flush();if(ending==='buttons')k.viewport.onpointermove(k.event(165,218,k.viewport,{buttons:0}));else k.viewport[ending]();assert.equal(k.ctx.details().active,false);assert.equal(k.ctx.count(),0);assert.equal(k.workspaceLayer.style.display,'none');assert.equal(k.selectionLayer.children.length,0);assert.equal(k.stats().commits,0);}

// Viewport clipping keeps feedback within its content box even when captured outside.
const clipped=harness();clipped.drag(60,110,2000,1800);clipped.flush();const rect=clipped.workspaceLayer.children[0];assert.ok(+rect.getAttribute('x')+ +rect.getAttribute('width')<=clipped.viewport.clientWidth);assert.ok(+rect.getAttribute('y')+ +rect.getAttribute('height')<=clipped.viewport.clientHeight);

// Selected-element movement remains available; a click adds no edit history.
const move=harness();move.tap(move.t1,140,148);move.tap(move.t1,140,148);assert.equal(move.stats().commits,0);assert.equal(move.ctx.count(),0);
move.tap(move.t1,140,148);move.svg.onpointerdown(move.event(140,148,move.t1));move.svg.onpointermove(move.event(150,152,move.t1));move.svg.onpointerup(move.event(150,152,move.t1));assert.equal(move.stats().commits,1);assert.ok(move.s.panels.p0.edits[0].tick1['offset-x']);

// A multi-panel selection moves as one group when started from a selected
// object in either panel, including its selected inserted annotation.
const multiMove=harness();multiMove.drag(60,110,550,320);multiMove.finish(550,320);assert.equal(multiMove.ctx.count(),4);
multiMove.svg.onpointerdown(multiMove.event(430,148,multiMove.t3));multiMove.svg.onpointermove(multiMove.event(440,152,multiMove.t3));multiMove.svg.onpointerup(multiMove.event(440,152,multiMove.t3));
assert.equal(multiMove.stats().commits,1,'an already-selected object in the second panel starts group movement');
for(const [id,key]of [['p0','tick1'],['p0','tick2'],['p1','tick3']]){assert.equal(+multiMove.s.panels[id].edits[0][key]['offset-x'],10);assert.equal(+multiMove.s.panels[id].edits[0][key]['offset-y'],4);}
assert.ok(Math.abs(multiMove.s.overlays[0].x-(.6+10/600))<1e-12);assert.ok(Math.abs(multiMove.s.overlays[0].y-(.5+4/420))<1e-12);
assert.ok(source.includes("$('viewport').classList.toggle('is-marquee-selecting',boxSelect)"));
assert.ok(source.includes('viewport.append(workspaceLayer)'),'feedback lives outside exported artboard SVG');
console.log('PASS workspace selection: gray origin, live/final outlines, clear click, Shift/mixed selection, cancellation, clipping and unchanged history.');

// A thin automatic bracket supports first-click selection and first-drag move.
for(const useProxy of [false,true]){
  const k=harness(),path=el('path',{key:'e900010',statBracket:'{}'},{left:160,top:100,right:240,bottom:110}),proxy=el('path',{studioHitKey:'e900010'});
  k.t1.parentElement.append(proxy);k.t1.parentElement.append(path);const target=useProxy?proxy:path;
  k.tap(target,180,105);assert.equal(k.ctx.details().groups[0].keys[0],'e900010');assert.equal(k.stats().commits,0);
  k.tap(k.viewport,50,50);
  k.svg.onpointerdown(k.event(180,105,target));k.svg.onpointermove(k.event(190,109,target));k.svg.onpointerup(k.event(190,109,target));
  assert.equal(k.stats().commits,1);assert.equal(+k.s.panels.p0.edits[0].e900010['offset-x'],10);assert.equal(+k.s.panels.p0.edits[0].e900010['offset-y'],4);assert.deepEqual(Object.keys(k.s.panels.p0.edits[0]),['e900010']);
}
console.log('PASS automatic bracket hit routing: pointer gestures update only the original stable key.');

for(const tag of ['path','rect','circle','ellipse','use','image']){
  const k=harness(),shape=el(tag,{key:'e30'},{left:170,top:110,right:210,bottom:140});k.t1.parentElement.append(shape);
  k.svg.onpointerdown(k.event(180,120,shape));k.svg.onpointermove(k.event(188,129,shape));k.svg.onpointerup(k.event(188,129,shape));
  assert.equal(k.stats().commits,1,tag+' supports first-drag movement');assert.equal(+k.s.panels.p0.edits[0].e30['offset-x'],8);assert.equal(+k.s.panels.p0.edits[0].e30['offset-y'],9);
}
const grouped=harness();grouped.s.panels.p0.elementGroups={0:[['tick1','tick2']]};grouped.svg.onpointerdown(grouped.event(140,148,grouped.t1));grouped.svg.onpointermove(grouped.event(150,152,grouped.t1));grouped.svg.onpointerup(grouped.event(150,152,grouped.t1));for(const key of ['tick1','tick2'])assert.equal(+grouped.s.panels.p0.edits[0][key]['offset-x'],10,'first drag respects user grouping');
console.log('PASS direct editable SVG movement: paths, rectangles, circles, ellipses, uses, images and user groups.');

// A persistent marquee tool still lets an existing selection be moved directly.
// Blank/unselected targets and Shift continue to start selection, not movement.
for(const start of ['selected','unselected','blank','shift']){
  const k=harness();k.ctx.boxMode(true);k.drag(60,110,160,215);k.finish(160,215);
  assert.equal(k.ctx.count(),2);
  const target=start==='blank'?k.svg:start==='unselected'?k.t3:k.t1;
  const x=start==='unselected'?430:start==='blank'?600:140,y=start==='blank'?450:148;
  k.svg.onpointerdown(k.event(x,y,target,{shiftKey:start==='shift'}));
  assert.equal(k.ctx.details().active,start!=='selected',start+' has the intended gesture');
  k.svg.onpointermove(k.event(x+10,y+4,target,{shiftKey:start==='shift'}));
  k.svg.onpointerup(k.event(x+10,y+4,target,{shiftKey:start==='shift'}));
  assert.equal(k.stats().commits,start==='selected'?1:0);
  if(start==='selected')for(const key of ['tick1','tick2']){
    assert.equal(+k.s.panels.p0.edits[0][key]['offset-x'],10);
    assert.equal(+k.s.panels.p0.edits[0][key]['offset-y'],4);
  }
}
const overlayBox=harness();overlayBox.ctx.boxMode(true);overlayBox.drag(60,110,550,320);overlayBox.finish(550,320);
const overlayStart=copy(overlayBox.s.overlays[0]);
overlayBox.svg.onpointerdown(overlayBox.event(500,290,overlayBox.note));
assert.equal(overlayBox.ctx.details().active,false,'selected annotation starts movement in marquee mode');
overlayBox.svg.onpointermove(overlayBox.event(510,294,overlayBox.note));overlayBox.svg.onpointerup(overlayBox.event(510,294,overlayBox.note));
assert.equal(overlayBox.stats().commits,1);
assert.ok(Math.abs(overlayBox.s.overlays[0].x-overlayStart.x-10/600)<1e-12);
for(const [id,key]of [['p0','tick1'],['p0','tick2'],['p1','tick3']])assert.equal(+overlayBox.s.panels[id].edits[0][key]['offset-x'],10,'annotation drag preserves mixed selection');

for(const cancel of ['onpointercancel','onlostpointercapture']){
  const k=harness();k.ctx.boxMode(true);k.drag(60,110,160,215);k.finish(160,215);
  k.svg.onpointerdown(k.event(140,148,k.t1));k.svg.onpointermove(k.event(150,152,k.t1));k.svg[cancel]();
  assert.equal(k.stats().commits,0,cancel+' aborts movement without recording preview state');assert.deepEqual(k.s,k.initial);
}

for(const selectedLabel of [true,false]){
  const k=harness(),label=el('text',{panelLabel:'p0'},{left:115,top:95,right:130,bottom:111});k.svg.append(label);
  k.ctx.l.positions.push({id:'p0',x:0,y:0,width:250,height:390});k.s.panels.p0.label={x:2,y:4};k.ctx.boxMode(true);
  if(selectedLabel)vm.runInContext("selectedPanelLabel='p0'",k.ctx);
  k.svg.onpointerdown(k.event(120,100,label));assert.equal(k.ctx.details().active,!selectedLabel);
  k.svg.onpointermove(k.event(130,104,label));k.svg.onpointerup(k.event(130,104,label));
  assert.equal(k.stats().commits,selectedLabel?1:0);
  if(selectedLabel){assert.equal(k.s.panels.p0.label.x,6);assert.ok(Math.abs(k.s.panels.p0.label.y-(4+4/390*100))<1e-12);}
}

// Persist the real gesture result through the production history validator.
const persisted=harness(),{History}=require(path);persisted.s.columns=2;persisted.s.gap=12;persisted.s.overlays=[];
delete persisted.s.panels.p0.label;delete persisted.s.panels.p1.label;
persisted.t1.dataset.key='e1';persisted.t2.dataset.key='e2';persisted.t3.dataset.key='e3';
const originalState=copy(persisted.s),timeline=new History(originalState);
persisted.ctx.commit=next=>{timeline.commit(next);Object.assign(persisted.s,copy(next));};
persisted.ctx.boxMode(true);persisted.drag(60,110,160,215);persisted.finish(160,215);
persisted.svg.onpointerdown(persisted.event(140,148,persisted.t1));
for(let step=1;step<=10;step++)persisted.svg.onpointermove(persisted.event(140+step,148+step*.4,persisted.t1));
persisted.svg.onpointerup(persisted.event(150,152,persisted.t1));
assert.equal(timeline.states.length,2,'one drag records one undo step, not every move event');
const saved=JSON.parse(JSON.stringify({current:timeline.current,history:timeline})),project={panels:[{id:'p0',variants:[{}]},{id:'p1',variants:[{}]}]};
const restored=History.restore(saved.history,project,saved.current);
assert.equal(restored.current.panels.p0.edits[0].e1['offset-x'],'10');
assert.equal(restored.current.panels.p0.edits[0].e2['offset-y'],'4');
assert.deepEqual(restored.undo(),originalState,'one undo restores both selected texts');
assert.deepEqual(restored.redo(),saved.current,'redo restores the persisted movement');
console.log('PASS marquee-to-drag: selected text/annotation/label, mixed selection, blank/Shift selection, single undo and project persistence.');

// Shift in ordinary object mode constrains the entire existing selection.
// The explicit marquee tool above retains its append-selection contract.
for(const [dx,dy,wantX,wantY]of [[10,4,10,0],[4,10,0,10],[10,9,9.5,9.5]]){
  const k=harness({vector:true});k.tap(k.t1,140,148);k.tap(k.t2,140,198,{shiftKey:true});assert.equal(k.ctx.count(),2);
  k.svg.onpointerdown(k.event(140,148,k.t1,{shiftKey:true,altKey:true}));assert.equal(k.ctx.details().active,false,'ordinary Shift on a selected object starts a constrained move');
  k.svg.onpointermove(k.event(140+dx,148+dy,k.t1,{shiftKey:true,altKey:true}));k.svg.onpointerup(k.event(140+dx,148+dy,k.t1,{shiftKey:true,altKey:true}));
  assert.equal(k.stats().commits,1,'one constrained movement makes one history step');assert.equal(k.ctx.count(),2,'constrained movement keeps the selection');
  for(const key of ['tick1','tick2']){assert.equal(+k.s.panels.p0.edits[0][key]['offset-x']||0,wantX);assert.equal(+k.s.panels.p0.edits[0][key]['offset-y']||0,wantY);}
}
const shiftTap=harness({vector:true});shiftTap.tap(shiftTap.t1,140,148);shiftTap.tap(shiftTap.t2,140,198,{shiftKey:true});shiftTap.tap(shiftTap.t1,140,148,{shiftKey:true});assert.equal(shiftTap.ctx.count(),2,'a Shift click on an already-selected object retains the existing selection');assert.equal(shiftTap.stats().commits,0,'a zero-motion Shift click is not an edit');assert.deepEqual(shiftTap.s,shiftTap.initial);
console.log('PASS ordinary-mode Shift gesture: horizontal/vertical/diagonal whole-selection constraints and zero-motion click without history.');

// A burst of native-object pointer events paints once; release flushes its own
// final coordinates before a single history commit, and cancel leaves no RAF.
const burst=harness();burst.tap(burst.t1,140,148);burst.svg.onpointerdown(burst.event(140,148,burst.t1));
for(let i=1;i<=80;i++)burst.svg.onpointermove(burst.event(140+i,148+i/2,burst.t1,{altKey:true}));
assert.equal(burst.raf.size,1);assert.equal(burst.stats().commits,0);assert.deepEqual(burst.s,burst.initial);
burst.flush();assert.equal(burst.raf.size,0);assert.equal(burst.stats().commits,0);
burst.svg.onpointermove(burst.event(230,193,burst.t1,{altKey:true}));burst.svg.onpointerup(burst.event(240,198,burst.t1,{altKey:true}));
assert.equal(burst.stats().commits,1);assert.equal(burst.raf.size,0);assert.equal(+burst.s.panels.p0.edits[0].tick1['offset-x'],100);assert.equal(+burst.s.panels.p0.edits[0].tick1['offset-y'],50);
const cancelled=harness();cancelled.tap(cancelled.t1,140,148);cancelled.svg.onpointerdown(cancelled.event(140,148,cancelled.t1));cancelled.svg.onpointermove(cancelled.event(160,170,cancelled.t1));assert.equal(cancelled.raf.size,1);cancelled.svg.onpointercancel();cancelled.flush();assert.equal(cancelled.raf.size,0);assert.equal(cancelled.stats().commits,0);assert.deepEqual(cancelled.s,cancelled.initial);
console.log('PASS object drag rAF burst: one pending frame, final release coordinates, one commit and no delayed repaint after cancel.');
