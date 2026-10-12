/* Production pointer/selection handlers in a bounded DOM mock, not a browser test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const {marqueeHit,alignmentSnap}=require(path),source=fs.readFileSync(require.resolve(path),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
function el(tag='g',data={},box={left:0,top:0,right:0,bottom:0}){
  const classes=new Set(),attrs={},n={localName:tag,dataset:data,style:{},children:[],parentElement:null,
    classList:{add(...v){v.forEach(x=>classes.add(x));},remove(...v){v.forEach(x=>classes.delete(x));},toggle(x,on){if(on??!classes.has(x))classes.add(x);else classes.delete(x);},contains:x=>classes.has(x)},
    setAttribute(k,v){attrs[k]=String(v);if(k==='class'){classes.clear();String(v).split(' ').forEach(x=>classes.add(x));}},getAttribute(k){if(k.startsWith('data-'))return data[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())];return attrs[k]??null;},
    getBoundingClientRect:()=>({...box,width:box.right-box.left,height:box.bottom-box.top}),
    append(child){child.parentElement=this;this.children.push(child);},replaceChildren(...children){this.children=[];children.forEach(c=>this.append(c));},
    remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this);},
    replaceWith(other){const p=this.parentElement;if(p){other.parentElement=p;p.children[p.children.indexOf(this)]=other;}},
    contains(node){return node===this||this.children.some(c=>c.contains(node));},
    matches(s){if(s===tag)return true;if(s==='.chosen')return classes.has('chosen');if(s==='[data-panel]')return !!data.panel;if(s==='[data-key]'||s==='text[data-key]')return !!data.key&&(s[0]!=='t'||tag==='text');if(s==='[data-annotation]')return !!data.annotation;const m=s.match(/^\[data-(panel|key|annotation)="([^"]+)"\]$/);return m?data[m[1]]===m[2]:false;},
    closest(s){return this.matches(s)?this:this.parentElement?.closest(s)||null;},
    querySelectorAll(s){const all=this.children.flatMap(c=>[c,...c.querySelectorAll('*')]);return s==='*'?all:all.filter(c=>c.matches(s));},
    querySelector(s){const parts=s.split(' ');if(parts.length===2)return this.querySelector(parts[0])?.querySelector(parts[1])||null;return this.querySelectorAll(s)[0]||null;},
    setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;},
    transform:{baseVal:{consolidate:()=>null}},getScreenCTM:()=>null,
  };return n;
}
function harness(){
  const svg=el('svg',{}, {left:100,top:80,right:700,bottom:500}),viewport=el('div',{}, {left:20,top:20,right:820,bottom:620});
  Object.assign(viewport,{clientLeft:2,clientTop:2,clientWidth:780,clientHeight:580,scrollLeft:0,scrollTop:0});viewport.append(svg);
  const a=el('g',{panel:'p0'},{left:110,top:90,right:360,bottom:480}),b=el('g',{panel:'p1'},{left:390,top:90,right:680,bottom:480});svg.append(a);svg.append(b);
  const t1=el('text',{key:'tick1'},{left:130,top:140,right:150,bottom:156}),t2=el('text',{key:'tick2'},{left:130,top:190,right:150,bottom:206}),t3=el('text',{key:'tick3'},{left:420,top:140,right:440,bottom:156});a.append(t1);a.append(t2);b.append(t3);
  const noteBox={left:480,top:280,right:540,bottom:310},note=el('g',{annotation:'note'},noteBox);svg.append(note);
  const selectionLayer=el(),workspaceLayer=el('svg');svg.append(selectionLayer);viewport.append(workspaceLayer);
  const s={order:['p0','p1'],panels:{p0:{variant:0,edits:{},label:{}},p1:{variant:0,edits:{},label:{}}},overlays:[{id:'note',x:.6,y:.5,w:.1,h:.1}]};
  const initial=copy(s),fields={scope:{value:'panel'},deleteElements:{disabled:true},viewport};let commits=0,renders=0,nativeClears=0,rafId=0;const raf=new Map(),messages=[];
  const ctx={svg,viewport,selectionLayer,workspaceLayer,NS:'svg',l:{width:600,height:420,positions:[]},marqueeHit,alignmentSnap,Math,copy,previewState:s,renderAlignmentGuideControls(){},
    state:()=>s,$:id=>fields[id],T:(s,...args)=>s.replace(/\{(\d+)\}/g,(_,i)=>args[i]),isVisibleObject:()=>true,
    getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1',fill:'#222',stroke:'none'}),
    document:{createElementNS:(_,tag)=>el(tag),querySelectorAll:()=>[]},window:{getSelection:()=>({removeAllRanges(){nativeClears++;}})},
    requestAnimationFrame(fn){const id=++rafId;raf.set(id,fn);return id;},cancelAnimationFrame:id=>raf.delete(id),cancelQueuedZoom(){},
    render(){renders++;},renderSelectionProperties(){fields.deleteElements.disabled=!ctx.count();},renderOverlayProperties(){fields.deleteElements.disabled=!ctx.count();},
    showPane(){},renderDataEditor(){},renderMethods(){},renderInspector(){vm.runInContext('inspectorPanel=selectedPanel',ctx);},renderLabelControls(){},startInlineTextEdit:node=>{ctx.inlineTarget=node;},visualPanelOrder:()=>s.order,say:m=>messages.push(m),
    overlayNode:()=>el('g',{annotation:'note'},noteBox),commit(next){commits++;Object.assign(s,copy(next));},
    editsFor:()=>({}),setEdit(next,id,vi,key,prop,value){((next.panels[id].edits[vi]??={})[key]??={})[prop]=value;},
    selectPanelLabel(){},at:()=>null,destination:()=>null,zoomView:{},
  };ctx.overlayEditingSpace=require(path).overlayEditingSpace;vm.createContext(ctx);
  const groups=source.slice(source.indexOf('  function selectionGroups('),source.indexOf('  const sizeNames='))+source.slice(source.indexOf('  function refreshOverlaySelection('),source.indexOf('  function renderOverlayProperties('));
  const local=source.slice(source.indexOf('    const screenRect=el=>'),source.indexOf('    let resizeDrag=null,panelDrag='));
  const handlers=source.slice(source.indexOf('    svg.onpointerdown=e=>'),source.indexOf('  function renderMethods(){'));
  vm.runInContext(`let selectedPanel='p0',inspectorPanel='p0',selected=[],elementSelections=[],selectionAnchor=null,selectedAnnotations=[],selectedPanelLabel=null,panelSelection=[],selectionAfterMarquee=false,layoutMode=false,original=false,boxSelect=false,activePane='detail',cancelSelectionGesture=null,cancelPanelGesture=null,cancelObjectGesture=null,selectedAlignmentGuide=null;
    let labelDrag=null,overlayDrag=null,elementDrag=null,guideDrag=null,marquee=null,suppressClick=false,resizeDrag=null,panelDrag=null,dragging=null,pending=null;
    const canvasPoint=e=>({x:(e.clientX-100)/600,y:(e.clientY-80)/420});const clearGhost=()=>{};
    ${groups}\n${local}\n${handlers.replace(/\n  }\s*$/,'')}
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
