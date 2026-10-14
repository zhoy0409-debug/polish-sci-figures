'use strict';
const assert=require('node:assert/strict');
const {constrainDelta,constrainedMove,pickBehind}=require('../skills/polish-sci-figures/assets/figure-studio/vector-interaction.js');
let checks=0;
const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};

test('free moves retain exact finite coordinates, including sub-point adjustments',()=>{
  assert.deepEqual(constrainDelta(123.456,-.0125,false),{dx:123.456,dy:-.0125});assert.deepEqual(constrainDelta(-0,0,true),{dx:0,dy:0});
  for(const bad of [NaN,Infinity,-Infinity,'2',null]){assert.throws(()=>constrainDelta(bad,0),TypeError);assert.throws(()=>constrainDelta(0,bad),TypeError);}
});
test('Shift projects positive and negative motion onto horizontal, vertical or exact diagonals',()=>{
  for(const [dx,dy,result] of [[100,10,{dx:100,dy:0}],[-100,10,{dx:-100,dy:0}],[10,100,{dx:0,dy:100}],[10,-100,{dx:0,dy:-100}],[80,60,{dx:70,dy:70}],[-80,60,{dx:-70,dy:70}],[80,-60,{dx:70,dy:-70}],[-80,-60,{dx:-70,dy:-70}]])assert.deepEqual(constrainDelta(dx,dy,true),result);
  for(let dx=-120;dx<=120;dx+=7)for(let dy=-120;dy<=120;dy+=9){const r=constrainDelta(dx,dy,true);assert.ok(r.dx===0||r.dy===0||Math.abs(r.dx)===Math.abs(r.dy));assert.ok(Number.isFinite(r.dx)&&Number.isFinite(r.dy));}
  assert.deepEqual(constrainDelta(Number.MAX_VALUE,Number.MAX_VALUE,true),{dx:Number.MAX_VALUE,dy:Number.MAX_VALUE});
});
test('unconstrained snapping runs once and preserves applicable guides',()=>{
  let calls=0;const guide={axis:'x',position:100},result=constrainedMove(10,20,{snap:(dx,dy)=>{calls++;assert.equal(dx,10);assert.equal(dy,20);return {dx:12,dy:22,guides:[guide]};}});assert.equal(calls,1);assert.deepEqual(result,{dx:12,dy:22,guides:[guide]});
});
test('axis snapping cannot reintroduce an unwanted perpendicular movement or guide',()=>{
  const x={axis:'x',position:100},y={axis:'y',position:200},unknown={orientation:'horizontal'};let calls=0;
  const horizontal=constrainedMove(100,10,{shift:true,snap:(dx,dy)=>{calls++;assert.deepEqual({dx,dy},{dx:100,dy:0});return {dx:104,dy:7,guides:[x,y,unknown]};}});assert.deepEqual(horizontal,{dx:104,dy:0,guides:[x]});
  const vertical=constrainedMove(-10,100,{shift:true,snap:()=>{calls++;return {dx:5,dy:105,guides:[x,y]};}});assert.deepEqual(vertical,{dx:0,dy:105,guides:[y]});assert.equal(calls,2);
});
test('diagonal and zero Shift moves do not invoke a snap that would lie about direction',()=>{
  let calls=0;const snap=()=>{calls++;return {dx:20,dy:35,guides:[{axis:'x'}]};};assert.deepEqual(constrainedMove(30,40,{shift:true,snap}),{dx:35,dy:35,guides:[]});assert.deepEqual(constrainedMove(0,0,{shift:true,snap}),{dx:0,dy:0,guides:[]});assert.equal(calls,0);
});
test('invalid or failed snapping retains valid free/constrained geometry without fake guides',()=>{
  for(const snap of [()=>null,()=>({dx:NaN,dy:0}),()=>({dx:1,dy:Infinity,guides:[{axis:'x'}]}),()=>{throw Error('Stale snap cache');}]){assert.deepEqual(constrainedMove(100,10,{shift:true,snap}),{dx:100,dy:0,guides:[]});assert.deepEqual(constrainedMove(100,10,{snap}),{dx:100,dy:10,guides:[]});}
});

if(process.argv.includes('--dom')){
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<svg id="canvas" xmlns="http://www.w3.org/2000/svg"><svg data-panel="a"><path id="top" data-key="e1"/><path id="middle" data-key="e2"/><path id="bottom" data-key="e3"/><path id="proxy1" data-studio-hit-key="e1" aria-hidden="true"/><path id="proxy2" data-studio-hit-key="e1"/></svg><svg data-panel="b"><path id="otherPanel" data-key="e1"/></svg><g data-annotation="e1"><rect id="annotation"/></g><path id="locked" data-locked="true"/><g opacity="0"><path id="invisible"/></g><path id="hidden" visibility="hidden"/><g hidden=""><path id="parentHidden"/></g><g data-editor-guides="true"><rect id="guide"/></g><defs><path id="defined"/></defs></svg><svg id="foreign" xmlns="http://www.w3.org/2000/svg"><path id="outsider"/></svg>',{pretendToBeVisual:true}),d=dom.window.document,svg=d.getElementById('canvas'),node=id=>d.getElementById(id);let calls=0,stack=[],selected=new Set();
  d.elementsFromPoint=(x,y)=>{calls++;assert.equal(x,40);assert.equal(y,50);return stack;};
  const options={svg,x:40,y:50,normalize:hit=>hit.hasAttribute('data-studio-hit-key')?node('top'):hit,isEditable:hit=>hit.dataset.stateLocked!=='true',isSelected:hit=>selected.has(hit)},pick=()=>pickBehind(options);
  test('one top-first native hit-stack collection cycles all overlaps and wraps',()=>{
    stack=[node('top'),node('middle'),node('bottom'),svg];selected.clear();let before=calls;assert.equal(pick(),node('top'));assert.equal(calls,before+1);selected=new Set([node('top')]);assert.equal(pick(),node('middle'));selected=new Set([node('middle')]);assert.equal(pick(),node('bottom'));selected=new Set([node('bottom')]);assert.equal(pick(),node('top'));selected=new Set([node('top'),node('middle')]);assert.equal(pick(),node('bottom'));
  });
  test('duplicate transparent proxies normalize to one real scientific source',()=>{
    stack=[node('proxy1'),node('proxy2'),node('top'),node('middle'),svg];selected=new Set([node('top')]);const before=calls;assert.equal(pick(),node('middle'));assert.equal(calls,before+1);assert.equal(node('proxy1').getAttribute('aria-hidden'),'true');assert.equal(node('top').getAttribute('data-key'),'e1');
  });
  test('DOM and state locks, hidden parents, editor guides, definitions and foreign canvases are excluded',()=>{
    node('top').dataset.stateLocked='true';stack=[node('outsider'),node('guide'),node('defined'),node('locked'),node('hidden'),node('parentHidden'),node('invisible'),node('top'),node('middle'),svg];selected.clear();assert.equal(pick(),node('middle'));delete node('top').dataset.stateLocked;
    stack=[node('outsider'),node('locked'),node('hidden'),svg];assert.equal(pick(),null);
    stack=[node('middle')];svg.dataset.locked='true';assert.equal(pick(),null);delete svg.dataset.locked;
  });
  test('equal metadata keys across panels and annotations remain distinct identities',()=>{
    stack=[node('top'),node('otherPanel'),node('annotation'),svg];selected=new Set([node('top')]);assert.equal(pick(),node('otherPanel'));selected=new Set([node('otherPanel')]);assert.equal(pick(),node('annotation'));selected=new Set([node('annotation')]);assert.equal(pick(),node('top'));
  });
  test('normalization cannot smuggle a foreign or root node into the current canvas',()=>{
    stack=[node('top')];assert.equal(pickBehind({...options,normalize:()=>node('outsider')}),null);assert.equal(pickBehind({...options,normalize:()=>svg}),null);assert.equal(pickBehind({...options,normalize:()=>null}),null);assert.equal(pickBehind({...options,normalize:()=>({key:'e1'})}),null);
  });
  test('native clipped hit stack is authoritative; no bbox scan or artwork mutation occurs',()=>{
    stack=[node('bottom')];selected.clear();for(const el of [svg,node('top'),node('middle'),node('bottom')])el.getBoundingClientRect=()=>{throw Error('Bounding boxes must not be scanned');};const before=svg.outerHTML,count=calls;assert.equal(pick(),node('bottom'));assert.equal(calls,count+1);assert.equal(svg.outerHTML,before);assert.equal(pickBehind({...options,x:NaN}),null);assert.equal(calls,count+1);
  });
  test('absent native picking and invalid coordinates return no selection safely',()=>{
    const old=d.elementsFromPoint;delete d.elementsFromPoint;assert.equal(pick(),null);d.elementsFromPoint=()=>{throw Error('Unavailable native hit test');};assert.equal(pick(),null);d.elementsFromPoint=old;assert.equal(pickBehind(),null);assert.equal(pickBehind({...options,svg:null}),null);assert.equal(pickBehind({...options,y:Infinity}),null);assert.equal(pickBehind({...options,normalize:null}),null);
  });
  dom.window.close();
}

if(process.argv.includes('--dom')){
  const fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom'),directory='../skills/polish-sci-figures/assets/figure-studio/',studio=require(directory+'studio.js'),controller=require(directory+'selection-resize-controller.js'),source=fs.readFileSync(require.resolve(directory+'studio.js'),'utf8');
  const dom=new JSDOM('<select id="scope"><option value="panel">Panel</option><option value="element">Element</option></select><svg id="canvas" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240"><svg data-panel="p1" viewBox="0 0 200 100"><g data-panel-content="true"><path id="nativeTop" data-key="e1" d="M 0 0 L 20 20"/><path id="groupOne" data-key="e2"/><path id="groupTwo" data-key="e3"/><path id="proxy" data-studio-hit-key="e1" aria-hidden="true"/></g></svg><svg data-panel="p2" viewBox="0 0 200 100"><rect id="otherPanel" data-key="e1" x="20" y="20" width="80" height="40"/></svg><g data-annotation="anno1"><line id="overlayLine" x1="0" x2="20"/><circle id="overlayResize" data-overlay-resize="anno1"/></g><text data-panel-label="p1" id="label"><tspan id="labelChild">A</tspan></text><g data-selection-resize="se"><rect id="resizeHandle"/></g><g data-grid-resize="outer"><rect id="gridHandle"/></g><g data-panel-move="p1"><rect id="panelMove"/></g><g data-resize="right"><rect id="panelResize"/></g><g data-alignment-guide="guide-1"><rect id="alignmentGuide"/></g></svg><svg id="foreign" xmlns="http://www.w3.org/2000/svg"><path id="foreignPath" data-key="e1"/></svg>',{pretendToBeVisual:true}),d=dom.window.document,svg=d.getElementById('canvas'),node=id=>d.getElementById(id),initial={order:['p1','p2'],columns:2,gap:12,panels:{p1:{variant:0,edits:{},elementGroups:{0:[['e2','e3']]},label:{text:'A',x:5,y:10,size:12}},p2:{variant:0,edits:{}}},overlays:[{id:'anno1',type:'line',x:.1,y:.2,w:.1,h:0,size:12,stroke:1}]},history=new studio.History(initial),messages=[],marquees=[];
  let calls=0,uiCalls=0,stack=[],resizeApi=null,selectionReads=0;
  d.elementsFromPoint=()=>{calls++;return stack;};
  const ctx={svg,window:dom.window,document:d,DRAW:'path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use,image',StudioVectorInteraction:{constrainDelta,constrainedMove,pickBehind},state:()=>history.current,selected:[],elementSelections:[],selectionAnchor:null,selectedPanel:'p1',selectedAnnotations:[],selectedPanelLabel:null,panelSelection:[],contentSelection:null,activePane:'detail',layoutMode:false,suppressClick:false,boxSelect:false,selectionAfterMarquee:false,selectedAlignmentGuide:null,original:false,elementDrag:null,labelDrag:null,overlayDrag:null,guideDrag:null,
    $:id=>d.getElementById(id),T:text=>text,say:text=>messages.push(text),finishSelectionUI:()=>{uiCalls++;resizeApi?.refresh();},cancelQueuedZoom:()=>{},drawAlignmentGuides:()=>{},renderAlignmentGuideControls:()=>{},selectedDragItems:()=>ctx.selectionGroups().flatMap(group=>group.keys.map(key=>({id:group.id,vi:group.vi,key,el:svg.querySelector(`[data-panel="${group.id}"] [data-key="${key}"]`)}))),canvasPoint:e=>({x:e.clientX/600,y:e.clientY/240}),beginMarquee:e=>marquees.push(e),render:()=>{throw Error('Selecting behind must not rebuild the canvas');},commit:()=>{throw Error('Selecting behind must not edit history');}};
  vm.createContext(ctx);
  const sections=[['  function selectionGroups(){','  const sizeNames='],['  function isVisibleObject(el) {','  function keysToObjects('],['  function canvasObjectTarget(target){','  function addStatisticalHitAreas('],['    const behindTarget=target=>{','    svg.onpointerdown=e=>'],['    svg.onpointerdown=e=>','    const paintObjectPointer=e=>']];
  for(const [start,end]of sections){const from=source.indexOf(start),to=source.indexOf(end,from);assert.ok(from>=0&&to>from,`Missing actual host code ${start}`);vm.runInContext(source.slice(from,to),ctx);}
  vm.runInContext('globalThis.behind={behindTarget,behindEditable,behindSelected,chooseBehind};',ctx);
  const event=(target=node('nativeTop'),mods={})=>({target,button:0,pointerId:7,clientX:40,clientY:50,ctrlKey:false,metaKey:false,shiftKey:false,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...mods}),choose=(mods={})=>ctx.behind.chooseBehind(event(node('nativeTop'),mods)),resetSelection=()=>{ctx.setElementSelection([]);ctx.selectedAnnotations=[];ctx.selectedPanelLabel=null;ctx.panelSelection=[];ctx.selectedPanel='p1';ctx.selectedAlignmentGuide=null;ctx.contentSelection=null;ctx.layoutMode=false;ctx.boxSelect=false;ctx.elementDrag=null;ctx.selectionAfterMarquee=false;ctx.suppressClick=false;},plain=value=>JSON.parse(JSON.stringify(value));

  test('actual host code continues from a normal frontmost selection with Ctrl or Command',()=>{
    resetSelection();stack=[node('proxy'),node('nativeTop'),node('otherPanel')];ctx.setElementSelection([{id:'p1',vi:0,keys:['e1']}]);const before=calls,index=history.index,states=history.states.length,content=JSON.stringify(history.current),ui=uiCalls;
    assert.equal(choose({ctrlKey:true}),true);assert.equal(calls,before+1);assert.equal(ctx.selectedPanel,'p2');assert.deepEqual(plain(ctx.selectionGroups()),[{id:'p2',vi:0,keys:['e1']}]);assert.equal(ctx.suppressClick,true);assert.equal(uiCalls,ui+1);
    assert.equal(choose({metaKey:true}),true);assert.equal(ctx.selectedPanel,'p1');assert.equal(history.index,index);assert.equal(history.states.length,states);assert.equal(JSON.stringify(history.current),content);assert.equal(d.getElementById('scope').value,'element');
    const withoutModifier=calls;assert.equal(choose(),false);assert.equal(calls,withoutModifier);
  });
  test('actual host normalization cycles native sources, another panel, overlay and panel label',()=>{
    resetSelection();stack=[node('proxy'),node('nativeTop'),node('otherPanel'),node('overlayLine'),node('labelChild'),node('foreignPath')];assert.equal(choose({ctrlKey:true}),true);assert.equal(ctx.selectedPanel,'p1');assert.equal(ctx.selected[0],'e1');
    choose({ctrlKey:true});assert.equal(ctx.selectedPanel,'p2');choose({ctrlKey:true});assert.deepEqual(plain(ctx.selectedAnnotations),['anno1']);assert.equal(ctx.selected.length,0);assert.equal(ctx.activePane,'annotation');
    choose({ctrlKey:true});assert.equal(ctx.selectedPanelLabel,'p1');assert.equal(ctx.selectedAnnotations.length,0);assert.equal(ctx.contentSelection,null);choose({ctrlKey:true});assert.equal(ctx.selected[0],'e1');assert.equal(ctx.selectedPanelLabel,null);assert.equal(ctx.selectedAnnotations.length,0);
  });
  test('actual grouped selection is atomic and any locked member rejects the group',()=>{
    resetSelection();stack=[node('groupOne'),node('groupTwo'),node('otherPanel')];choose({ctrlKey:true});assert.deepEqual(plain(ctx.selected),['e2','e3']);choose({ctrlKey:true});assert.equal(ctx.selectedPanel,'p2');
    resetSelection();history.current.panels.p1.lockedElements={0:['e3']};choose({ctrlKey:true});assert.equal(ctx.selectedPanel,'p2');delete history.current.panels.p1.lockedElements;
  });
  test('actual host filters panel/overlay state locks and hidden native artwork',()=>{
    resetSelection();stack=[node('nativeTop'),node('otherPanel'),node('overlayLine'),node('labelChild')];history.current.panels.p1.locked=true;history.current.overlays[0].locked=true;choose({ctrlKey:true});assert.equal(ctx.selectedPanel,'p2');history.current.panels.p2.locked=true;assert.equal(choose({ctrlKey:true}),false);
    delete history.current.panels.p1.locked;delete history.current.panels.p2.locked;delete history.current.overlays[0].locked;node('nativeTop').style.display='none';resetSelection();choose({ctrlKey:true});assert.equal(ctx.selectedPanel,'p2');node('nativeTop').style.display='';
  });
  test('actual layout and all resize/guide controls take priority without querying an overlap stack',()=>{
    resetSelection();stack=[node('nativeTop'),node('otherPanel')];let before=calls;ctx.layoutMode=true;assert.equal(choose({ctrlKey:true}),false);assert.equal(calls,before);ctx.layoutMode=false;
    for(const id of ['resizeHandle','gridHandle','panelMove','panelResize','alignmentGuide','overlayResize']){before=calls;assert.equal(ctx.behind.chooseBehind(event(node(id),{ctrlKey:true})),false,id);assert.equal(calls,before,id);assert.equal(ctx.behind.behindTarget(node(id)),null,id);}
  });
  test('actual pointer-down keeps Shift marquee mode and allows constrained movement outside that mode',()=>{
    resetSelection();ctx.setElementSelection([{id:'p1',vi:0,keys:['e1']}]);const before=marquees.length;ctx.boxSelect=true;svg.onpointerdown(event(node('nativeTop'),{shiftKey:true}));assert.equal(marquees.length,before+1);assert.equal(ctx.elementDrag,null);assert.deepEqual(plain(ctx.selected),['e1']);
    ctx.boxSelect=false;svg.setPointerCapture=()=>{};svg.onpointerdown(event(node('nativeTop'),{shiftKey:true}));assert.ok(ctx.elementDrag);assert.equal(ctx.elementDrag.appendOnTap,true);assert.equal(marquees.length,before+1);ctx.elementDrag=null;
  });
  test('actual content controller lets modified clicks reach host cycling but retains resize-handle ownership',()=>{
    resetSelection();ctx.contentSelection='p1';stack=[node('proxy'),node('nativeTop'),node('otherPanel')];const oldStyle=global.getComputedStyle,proto=dom.window.SVGElement.prototype,identity={a:1,b:0,c:0,d:1,e:0,f:0};
    global.getComputedStyle=el=>({display:el.style.display||'block',visibility:el.style.visibility||'visible',opacity:el.style.opacity||'1',fill:el.style.fill||'#456789',stroke:el.style.stroke||'none'});
    for(const panel of svg.querySelectorAll('svg[data-panel]')){panel.setAttribute('width','200');panel.setAttribute('height','100');}
    proto.getScreenCTM=function(){return identity;};proto.getBoundingClientRect=function(){return this===svg?{x:0,y:0,left:0,top:0,right:600,bottom:240,width:600,height:240}:{x:20,y:20,left:20,top:20,right:100,bottom:60,width:80,height:40};};svg.setPointerCapture=()=>{};svg.releasePointerCapture=()=>{};svg.hasPointerCapture=()=>false;
    let commits=0,hostEvents=0;
    resizeApi=controller.create({svg,geometry:{width:600,height:240,positions:[{id:'p1',x:0,y:0,width:200,height:100}]},state:()=>history.current,selection:()=>{selectionReads++;return ctx.contentSelection?[{kind:'content',id:'p1',vi:0,el:svg.querySelector('[data-panel="p1"] [data-panel-content]')}]:[];},commit:()=>{commits++;return true;},requestAnimationFrame:()=>1,cancelAnimationFrame:()=>{}});resizeApi.refresh();
    const listener=e=>{hostEvents++;ctx.behind.chooseBehind(e);},fire=(target,mods)=>{const e=new dom.window.MouseEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,clientX:40,clientY:50,...mods});Object.defineProperty(e,'pointerId',{value:9});target.dispatchEvent(e);return e;};svg.addEventListener('pointerdown',listener);
    try{
      let reads=selectionReads;const e=fire(node('nativeTop'),{ctrlKey:true});assert.equal(hostEvents,1);assert.equal(resizeApi.isActive(),false);assert.equal(ctx.contentSelection,null);assert.equal(ctx.selectedPanel,'p1');assert.equal(e.defaultPrevented,true,'Host consumes the selection click');assert.equal(commits,0);assert.equal(selectionReads,reads+1,'Only the host selection refresh runs; controller start does not rescan content');
      ctx.contentSelection='p1';ctx.setElementSelection([{id:'p1',vi:0,keys:['e1']}]);ctx.contentSelection='p1';resizeApi.refresh();fire(node('nativeTop'),{metaKey:true});assert.equal(hostEvents,2);assert.equal(resizeApi.isActive(),false);assert.equal(ctx.selectedPanel,'p2');assert.equal(ctx.contentSelection,null);
      ctx.contentSelection='p1';resizeApi.refresh();const handle=svg.querySelector('[data-editor-selection-resize] [data-selection-resize="se"]');assert.ok(handle);const before=hostEvents;fire(handle,{ctrlKey:true});assert.equal(resizeApi.isActive(),true);assert.equal(hostEvents,before,'Resize control consumes the gesture before host cycling');resizeApi.cancel();assert.equal(commits,0);
    }finally{svg.removeEventListener('pointerdown',listener);resizeApi.dispose();resizeApi=null;global.getComputedStyle=oldStyle;}
  });
  dom.window.close();
}
console.log(`PASS ${checks} vector interaction checks`);
