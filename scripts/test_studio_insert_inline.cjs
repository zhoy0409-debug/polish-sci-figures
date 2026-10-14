/* Production placement/inline-edit handlers in a bounded DOM mock. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(path),'utf8');
const {History,arrange,validateState}=require(path),rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js'),copy=x=>JSON.parse(JSON.stringify(x));
function node(tag='div'){
  const classes=new Set(),handlers={};return {localName:tag,dataset:{},children:[],style:{},attrs:{},value:'',parent:null,handlers,
    classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
    setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},
    get firstChild(){return this.children[0];},append(n){n.parent=this;this.children.push(n);},remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);},
    addEventListener(type,handler,capture){(handlers[type]??=[]).push({handler,capture});},
    closest(){return null;},querySelector(){return null;},setPointerCapture(id){this.captured=id;},
    focus(){this.focused=true;},select(){this.selectionStart=0;this.selectionEnd=this.value.length;},setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;},
    getBoundingClientRect:()=>({left:180,top:130,width:70,height:20})};
}
function harness(){
  const project={id:'project',panels:[{id:'p0',variants:[{},{}],analysis:{p:.032}}]},initial=arrange({order:['p0'],columns:1,gap:12,panels:{p0:{variant:0,edits:{},label:{text:'A',x:2,y:5,size:12,font:'Arial',bold:true}}}},1,1);
  const history=new History(initial),viewport=node(),artboard=node(),svg=node('svg'),body=node(),docEvents={},winEvents={},frames=[],messages=[];let commits=0,clears=0,refreshes=0,clock=100;
  svg.getBoundingClientRect=()=>({left:100,top:80,width:600,height:400});
  const fields={viewport,artboard,addOverlay:node('button'),overlayType:node('select'),editOverlayText:node('button'),overlayLineDirection:node('select')};fields.overlayType.value='text';
  const sourceNode=node('text'),labelNode=node('text');sourceNode.dataset.key='e1';labelNode.dataset.panelLabel='p0';
  sourceNode.closest=s=>s==='[data-panel]'?{dataset:{panel:'p0'}}:s==='text[data-key]'?sourceNode:null;
  labelNode.closest=s=>s==='[data-panel-label]'?labelNode:null;
  function overlayText(id){const n=node('text');n.closest=s=>s==='[data-annotation]'?{dataset:{annotation:id}}:null;return n;}
  artboard.querySelector=selector=>selector==='svg'?svg:overlayText(selector.match(/data-annotation="([^"]+)"/)?.[1]);
  const ctx={pointerEditCommit:false,Math,Date:{now:()=>++clock},StudioRichText:rich,mobileWorkspace:null,project,copy,$:id=>fields[id],state:()=>history.current,panel:id=>project.panels.find(p=>p.id===id),
    layout:()=>({width:300,height:200,cells:[],positions:[{id:'p0',x:0,y:0,width:300,height:200}]}),currentOutput:()=>({scale:1}),
    T:s=>s,say:m=>messages.push(m),syncCanvasModes(){},renderSelectionProperties(){refreshes++;},renderRichTextControls(){},renderQuickToolbar(){},
    commit(next){validateState(next,project);if(history.commit(next))commits++;return true;},
    setEdit(s,id,vi,key,prop,val){((s.panels[id].edits[vi]??={})[key]??={})[prop]=val;},
    NS:"http://www.w3.org/2000/svg",cancelAnimationFrame(){},requestAnimationFrame:fn=>frames.push(fn),getComputedStyle:()=>({fontFamily:'Arial',fontSize:'10px'}),
    document:{body,createElementNS:(_ns,tag)=>node(tag),createElement:tag=>node(tag),querySelector:s=>s==='[data-placement-preview]'?body.children.find(n=>n.dataset.placementPreview):null,addEventListener:(type,fn)=>docEvents[type]=fn},
    window:{innerWidth:1000,innerHeight:800,getSelection:()=>({removeAllRanges(){clears++;}}),addEventListener:(type,fn)=>winEvents[type]=fn},
  };
  Object.assign(ctx,Object.fromEntries(["overlayInsertionGeometry","overlayLineGeometry","overlayEditingSpace","orientOverlayLine"].map(key=>[key,require(path)[key]])));
  vm.createContext(ctx);
  vm.runInContext(`let original=false,layoutMode=true,boxSelect=true,selectedPanel='p0',selected=[],elementSelections=[],selectedAnnotations=[],selectedPanelLabel=null,activePane='detail';
    const setElementSelection=g=>{elementSelections=g;selected=g[0]?.keys||[];};
    function richTextTarget(){let kind,id,key,text,vi=0;if(selectedPanelLabel){kind='label';id=selectedPanelLabel;text=state().panels[id].label.text;}else if(selectedAnnotations.length){kind='overlay';id=selectedAnnotations[0];text=state().overlays.find(a=>a.id===id).text;}else if(elementSelections.length){kind='element';({id,vi}=elementSelections[0]);key=elementSelections[0].keys[0];text=state().panels[id].edits[vi]?.[key]?.text||'P = 0.032';}else return null;return {kind,id,vi,key,text,record:JSON.stringify({baseText:text,runs:[]}),projectId:project.id,asset:panel(id),locked:kind==='overlay'?state().overlays.find(a=>a.id===id).locked:state().panels[id].locked,statistical:kind==='element'};}
    ${source.slice(source.indexOf('  function validRichTextTarget('),source.indexOf('  function renderRichTextControls('))}
    ${source.slice(source.indexOf('  let overlayPlacement='),source.indexOf('  const updateOverlay=',source.indexOf('  let overlayPlacement=')))}
    globalThis.status=()=>({overlayPlacement,placementDrag,inlineEditor,layoutMode,boxSelect,selectedAnnotations});
    globalThis.setOriginal=value=>{original=value;};`,ctx);
  const event=(x,y,target=svg,extra={})=>({button:0,buttons:1,clientX:x,clientY:y,target,pointerId:9,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},stopPropagation(){this.stopped=true;},...extra});
  const emit=(type,e)=>{for(const{handler}of viewport.handlers[type]||[])handler(e);return e;};
  const key=(key,extra={})=>event(0,0,svg,{key,shiftKey:false,isComposing:false,...extra});
  return{ctx,fields,svg,sourceNode,labelNode,body,history,project,winEvents,docEvents,frames,messages,emit,event,key,editor:()=>body.children.find(n=>n.localName==='textarea'),stats:()=>({commits,clears,refreshes}),flush:()=>{while(frames.length)frames.shift()();}};
}

// Canvas click places a text box at that point and starts inline input once.
let h=harness();h.fields.addOverlay.onclick();assert.equal(h.ctx.status().overlayPlacement,'text');assert.equal(h.ctx.status().layoutMode,false);assert.equal(h.ctx.status().boxSelect,false);
assert.ok(h.fields.viewport.classList.contains('is-inserting-overlay'));assert.equal(h.fields.addOverlay.attrs['aria-pressed'],'true');
const down=h.emit('pointerdown',h.event(220,180));assert.ok(down.prevented&&down.stopped);h.emit('pointerup',h.event(220,180));
assert.equal(h.stats().commits,1);assert.equal(h.ctx.status().overlayPlacement,null);const inserted=h.history.current.overlays[0];assert.equal(inserted.x,.2);assert.equal(inserted.y,.25);assert.equal(inserted.text,'文本');assert.equal(h.project.panels[0].analysis.p,.032);
h.flush();assert.ok(h.editor()?.focused);assert.equal(h.editor().selectionStart,0);assert.equal(h.editor().selectionEnd,2);h.editor().value='H2O';h.editor().onkeydown(h.key('Enter'));
assert.equal(h.history.current.overlays[0].text,'H2O');assert.equal(h.stats().commits,2);assert.equal(h.editor(),undefined);h.history.undo();assert.equal(h.history.current.overlays[0].text,'文本');h.history.redo();assert.equal(h.history.current.overlays[0].text,'H2O');

// Dragged shapes keep fractional geometry, including lines in all four directions.
for(const type of ['lineFree','rect','ellipse'])for(const [start,end]of [[[220,180],[460,340]],[[460,340],[220,180]],[[220,340],[460,180]],[[460,180],[220,340]]]){
  h=harness();h.ctx.armOverlayPlacement(type);h.emit('pointerdown',h.event(...start));h.emit('pointermove',h.event(...end));assert.ok(h.body.children.some(n=>n.dataset.placementPreview));assert.equal(h.stats().commits,0);
  h.emit('pointerup',h.event(...end));const a=h.history.current.overlays[0];assert.equal(a.x,.2);assert.equal(a.y,.25);assert.ok(Math.abs(a.w-.4)<1e-12);assert.ok(Math.abs(a.h-.4)<1e-12);assert.equal(!!a.reverseY,type==='lineFree'&&(end[0]-start[0])*(end[1]-start[1])<0);assert.equal(h.body.children.length,0);
  if(type==='lineFree'){const overlay=source.slice(source.indexOf('  function overlayNode('),source.indexOf('  function refreshOverlaySelection(')),line=overlay.split('\n').find(line=>line.includes('const attrs='));assert.ok(line,'Production overlay attributes remain present');const c={a,x:60,y:50,w:120,h:80};vm.runInNewContext(line+';globalThis.result=attrs;',c);assert.equal(c.result.x1,60);assert.equal(c.result.x2,180);assert.equal(c.result.y1,a.reverseY?130:50);assert.equal(c.result.y2,a.reverseY?50:130);}
}
h=harness();h.ctx.armOverlayPlacement('rect');h.emit('pointerdown',h.event(220,180));h.emit('pointerup',h.event(2000,1200));assert.ok(h.history.current.overlays[0].x+h.history.current.overlays[0].w<=1);assert.ok(h.history.current.overlays[0].y+h.history.current.overlays[0].h<=1);

// Straight tools keep their direction even with an imprecise diagonal gesture.
for(const type of ['line','lineVertical','bracket']){
  h=harness();h.ctx.armOverlayPlacement(type);h.emit('pointerdown',h.event(220,180));
  const preview=h.body.children.find(n=>n.dataset.placementPreview);assert.ok(preview);assert.equal(preview.firstChild.localName,type==='bracket'?'path':'line');
  for(let i=0;i<12;i++)h.emit('pointermove',h.event(320+i*4,200+i));assert.equal(h.frames.length,1,'many move events use one animation frame');h.flush();
  if(type==='line')assert.equal(preview.firstChild.attrs.y1,preview.firstChild.attrs.y2,'preview is actually horizontal');
  if(type==='lineVertical')assert.equal(preview.firstChild.attrs.x1,preview.firstChild.attrs.x2,'preview is actually vertical');
  h.emit('pointerup',h.event(460,340));let a=h.history.current.overlays[0];assert.equal(a.type,type==='bracket'?'bracket':'line');
  if(type==='line'){assert.equal(a.h,0);assert.equal(a.direction,'horizontal');assert.equal(a.y,.25);}
  if(type==='lineVertical'){assert.equal(a.w,0);assert.equal(a.direction,'vertical');assert.equal(a.x,.2);}
  if(type==='bracket'){assert.equal(a.h*200,5);assert.equal(a.text,'','manual bracket never invents statistical values');}
  assert.equal(h.stats().commits,1);assert.ok(h.emit('click',h.event(460,340)).stopped,'insertion click cannot deselect the result');
  assert.equal(h.emit('click',h.event(300,300)).stopped,undefined,'later clicks remain available');
}
for(const type of ['line','lineVertical']){h=harness();h.ctx.armOverlayPlacement(type);h.emit('pointerdown',h.event(220,180));h.emit('pointerup',h.event(...(type==='line'?[220,340]:[460,180])));const a=h.history.current.overlays[0];assert.ok(a.w+a.h>0,'perpendicular gesture must not produce an invisible line');}
// A diagonal line can be made perfectly horizontal or vertical with one control.
h=harness();h.ctx.armOverlayPlacement('lineFree');h.emit('pointerdown',h.event(220,180));h.emit('pointerup',h.event(460,340));h.fields.overlayLineDirection.value='horizontal';h.fields.overlayLineDirection.onchange();assert.equal(h.history.current.overlays[0].h,0);h.history.undo();assert.ok(h.history.current.overlays[0].h>0);h.history.redo();assert.equal(h.history.current.overlays[0].h,0);

// Selecting a tool and then clicking + arms the same tool; it never cancels.
for(const tool of ['line','lineVertical','lineFree','bracket','text']){h=harness();h.fields.overlayType.value=tool;h.fields.overlayType.onchange();assert.equal(h.ctx.status().overlayPlacement,tool);h.fields.addOverlay.onclick();assert.equal(h.ctx.status().overlayPlacement,tool);assert.equal(h.fields.addOverlay.attrs['aria-pressed'],'true');h.emit('pointerdown',h.event(220,180));h.emit('pointerup',h.event(460,200));assert.equal(h.stats().commits,1);assert.equal(h.fields.addOverlay.attrs['aria-pressed'],'false');}
h=harness();h.ctx.armOverlayPlacement('rect');h.emit('pointerdown',h.event(220,180));h.fields.addOverlay.onclick();assert.equal(h.ctx.status().overlayPlacement,'rect');assert.equal(h.ctx.status().placementDrag,null);assert.equal(h.stats().commits,0,'re-arming abandons only the unfinished gesture');
// Escape and pointer cancellation do not add history.

for(const reason of ['escape','pointercancel','lostpointercapture','blur','buttons']){h=harness();h.ctx.armOverlayPlacement('rect');h.emit('pointerdown',h.event(220,180));h.emit('pointermove',h.event(460,340));if(reason==='escape')h.docEvents.keydown(h.key('Escape'));else if(['pointercancel','lostpointercapture'].includes(reason))h.emit(reason,h.event(460,340));else if(reason==='blur')h.winEvents.blur();else if(reason==='buttons')h.emit('pointermove',h.event(460,340,h.svg,{buttons:0}));else h.fields.addOverlay.onclick();assert.equal(h.ctx.status().overlayPlacement,null);assert.equal(h.ctx.status().placementDrag,null);assert.equal(h.stats().commits,0);assert.equal(h.body.children.length,0);h.emit('pointerup',h.event(460,340));assert.equal(h.stats().commits,0);}
for(const extra of [{button:2},{button:1}]){h=harness();h.ctx.armOverlayPlacement('text');assert.equal(h.emit('pointerdown',h.event(220,180,h.svg,extra)).prevented,undefined);assert.equal(h.ctx.status().placementDrag,null);}
h=harness();h.ctx.armOverlayPlacement('text');h.emit('pointerdown',h.event(220,180,{closest:()=>({})}));assert.equal(h.ctx.status().placementDrag,null);h.ctx.cancelOverlayPlacement();h.ctx.setOriginal(true);h.ctx.armOverlayPlacement('text');assert.equal(h.ctx.status().overlayPlacement,null);

// Source text and panel labels use the same edit pipeline, without replacing data.
for(const type of ['source','label']){h=harness();const node=type==='source'?h.sourceNode:h.labelNode;h.ctx.startInlineTextEdit(node);assert.ok(h.editor());const before=copy(h.project);h.editor().value=type==='source'?'P = 0.040':'A1';h.editor().onkeydown(h.key('Enter'));assert.equal(h.stats().commits,1);assert.deepEqual(h.project,before);if(type==='source')assert.equal(h.history.current.panels.p0.edits[0].e1.text,'P = 0.040');else{assert.equal(h.history.current.panels.p0.label.text,'A1');assert.equal(h.history.current.panels.p0.label.manual,true);}}
h=harness();h.ctx.startInlineTextEdit(h.sourceNode);h.editor().value='Uncommitted';h.editor().onkeydown(h.key('Escape'));assert.equal(h.stats().commits,0);assert.equal(h.editor(),undefined);
h=harness();h.ctx.startInlineTextEdit(h.sourceNode);const editor=h.editor();editor.value='Line 1\nLine 2';editor.onkeydown(h.key('Enter',{shiftKey:true}));assert.equal(h.stats().commits,0);assert.equal(h.editor(),editor);editor.onkeydown(h.key('Enter',{isComposing:true}));assert.equal(h.stats().commits,0);editor.onblur();assert.equal(h.stats().commits,1);editor.onblur();assert.equal(h.stats().commits,1,'blur/Enter commit only once');
h=harness();h.ctx.startInlineTextEdit(h.sourceNode);h.editor().value='Stale edit';h.project.id='other';h.editor().onkeydown(h.key('Enter'));assert.equal(h.stats().commits,0,'switching project rejects stale inline target');
h=harness();h.history.current.panels.p0.locked=true;h.ctx.startInlineTextEdit(h.sourceNode);assert.equal(h.editor(),undefined);
console.log('PASS insertion and inline text: point placement, shape/line drag geometry, bounds, cancel/toolbar guards, text/label/overlay edit routing, Enter/Shift/IME/blur/Escape, stale/locked target rejection and undo. Production handlers in Node DOM mock.');
