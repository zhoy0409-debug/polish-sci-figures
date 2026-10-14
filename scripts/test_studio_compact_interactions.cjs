/* Compact canvas interaction coordinates. Production helpers/handlers run in
 * deterministic DOM adapters; browser ink measurement has separate QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(file),'utf8');
const {History,nudgeSelectionState,overlayEditingSpace,overlayInsertionGeometry,resizeOverlayGeometry}=require(file),compact=require('../skills/polish-sci-figures/assets/figure-studio/compact-whitespace.js');
const copy=value=>JSON.parse(JSON.stringify(value));let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;},near=(a,b)=>{assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);checks++;};
const positions=[{id:'a',x:0,y:0,width:500,height:400},{id:'b',x:500,y:0,width:500,height:400}];
const baseLayout={width:1000,height:400,positions,cells:positions.map((p,col)=>({...p,row:0,col}))},places={a:{row:0,col:0,rs:1,cs:1},b:{row:0,col:1,rs:1,cs:1}},ink={a:{x:40,y:30,width:400,height:330},b:{x:540,y:30,width:420,height:330}};
const state={order:['a','b'],columns:2,gap:0,compactWhitespace:true,grid:{rows:1,places},panels:{a:{variant:0,edits:{},label:{text:'A',x:10,y:12}},b:{variant:0,edits:{},label:{text:'B',x:10,y:12}}},overlays:[{id:'note',type:'rect',x:.65,y:.5,w:.05,h:.04,font:'Arial',size:12,stroke:1,color:'#526e9e',opacity:1,fill:false,text:''}],table:{rows:[['value'],['-4'],['2']]},analysis:{p:.00013}};
const plan=compact.plan({layout:baseLayout,places,ink,overlays:[{id:'note',box:{x:650,y:200,width:50,height:16}}]});assert.ok(plan.available);const l=plan.layout;
assert.ok(l.width<baseLayout.width&&l.height<baseLayout.height);eq(l.positions[1].x,l.positions[0].width,'Zero grid gap stays zero after safe trimming');
const physical=a=>{const space=compact.overlayGeometry(l,a.id);return{x:a.x*space.width+space.dx,y:a.y*space.height+space.dy,width:a.w*space.width,height:a.h*space.height};};
const labelPhysical=(s,id)=>{const cell=l.positions.find(p=>p.id===id),p=cell.renderBox||cell;return{x:p.x+p.width*s.panels[id].label.x/100,y:p.y+p.height*s.panels[id].label.y/100};};
const selected=[{kind:'element',id:'b',vi:0,key:'e1'},{kind:'label',id:'b'},{kind:'overlay',id:'note'}],before=JSON.stringify(state);
for(const [dx,dy]of [[1,0],[0,10],[-.1,.1],[10,-5]]){
  const {next}=nudgeSelectionState(state,selected,dx,dy,l),a=physical(state.overlays[0]),b=physical(next.overlays[0]),la=labelPhysical(state,'b'),lb=labelPhysical(next,'b');
  near(b.x-a.x,dx);near(b.y-a.y,dy);near(b.width,a.width);near(b.height,a.height);near(lb.x-la.x,dx);near(lb.y-la.y,dy);
  near(+next.panels.b.edits[0].e1['offset-x']||0,dx);near(+next.panels.b.edits[0].e1['offset-y']||0,dy);eq(next.analysis,state.analysis);eq(next.table,state.table);
}
eq(JSON.stringify(state),before,'Pure movement preserves its input');
const baseline=nudgeSelectionState(state,selected,1,1,baseLayout).next;near((baseline.overlays[0].x-state.overlays[0].x)*1000,1);near((baseline.panels.b.label.x-state.panels.b.label.x)*500/100,1);
const history=new History(state),moved=nudgeSelectionState(state,selected,4,3,l).next;history.commit(moved);eq(history.undo(),state);eq(history.redo(),moved);eq(JSON.parse(JSON.stringify(moved)),moved,'Compact edits use ordinary serializable project state');
eq(compact.plan({layout:baseLayout,places:{...places,b:{row:0,col:1,rs:1,cs:2}},ink}).available,false,'Spanning panels retain the original layout');
const extract=(begin,end)=>{const start=source.indexOf(begin),stop=source.indexOf(end,start);assert.ok(start>0&&stop>start,begin);return source.slice(start,stop);};
function element(tag){return{localName:tag,dataset:{},attrs:{},children:[],style:{},setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},append(...children){this.children.push(...children);},textContent:''};}
const ctx={imageLinks:null,copy,overlayEditingSpace,overlayInsertionGeometry,resizeOverlayGeometry,StudioCompactWhitespace:compact,NS:'svg',selectedAnnotations:[],document:{createElementNS:(_,tag)=>element(tag),createTextNode:text=>({textContent:text})}};vm.createContext(ctx);vm.runInContext(extract('  function refreshInsetGraphics(','  function overlayNode(')+'\n'+extract('  function overlayNode(','  function refreshOverlaySelection('),ctx);
const note=ctx.overlayNode(state.overlays[0],l,false),rect=note.children[0];near(+rect.attrs.width,50);near(+rect.attrs.height,16);eq(rect.attrs['stroke-width'],'1');assert.ok(note.attrs.transform?.startsWith('translate('));assert.ok(!note.attrs.transform.includes('scale'),'Compact overlays are translated, never scaled');
const afterNote=ctx.overlayNode(nudgeSelectionState(state,selected,1,2,l).next.overlays[0],l,false);near(+afterNote.children[0].attrs.x-+rect.attrs.x,1);near(+afterNote.children[0].attrs.y-+rect.attrs.y,2);eq(afterNote.attrs.transform,note.attrs.transform,'Gesture preview holds the original compact layout');
// Actual insertion handler translates the visible pointer rectangle back to
// uncropped storage coordinates, preserving its dimensions and diagonal sense.
let current=state,commits=0;Object.assign(ctx,{state:()=>current,layout:()=>l,selectedPanel:'b',selected:[],elementSelections:[],selectedPanelLabel:null,activePane:'detail',T:s=>s,currentOutput:()=>({scale:1}),Date:{now:()=>100+commits},requestAnimationFrame(){},commit(next){current=next;commits++;}});
vm.runInContext(extract('  function insertOverlay(','  function startInlineTextEdit('),ctx);
for(const type of ['text','rect','ellipse','line']){
  current=copy(state);const p=l.positions[1],visible={x:(p.x+80)/l.width,y:(p.y+90)/l.height,w:25/l.width,h:18/l.height,reverseY:true};
  ctx.insertOverlay(type,null,visible);const a=current.overlays.at(-1),orig=positions[1],render=p.renderBox;
  near(a.x*1000+render.x-orig.x,visible.x*l.width);near(a.y*400+render.y-orig.y,visible.y*l.height);near(a.w*1000,25);near(a.h*400,18);eq(!!a.reverseY,type==='line');eq(a.size,10);eq(a.stroke,1);
}
const unchanged={x:.2,y:.3,w:.1,h:.05};eq(overlayInsertionGeometry(baseLayout,unchanged,'b'),unchanged,'Default layout insertion is unchanged');
const firstClick={x:80/l.width,y:80/l.height,w:20/l.width,h:10/l.height},firstMapped=overlayInsertionGeometry(l,firstClick,'b');near(firstMapped.x*1000+l.positions[0].renderBox.x,80,'Visible clicked panel takes precedence over previous selection');
// Actual drag and bounds helpers apply physical deltas to stored source units.
current=copy(state);const paints=[];Object.assign(ctx,{l,svg:{querySelector:()=>({replaceWith:n=>paints.push(n)}),getBoundingClientRect:()=>({width:l.width*2,height:l.height*2})},paintSnapGuides(){}});
vm.runInContext(extract('    const moveOverlayItems=','    const drawSelection=')+'\nglobalThis.move=moveOverlayItems;globalThis.bound=boundedObjectDelta;',ctx);
const drag={overlayIds:['note'],next:copy(current)};ctx.move(drag,{dx:12,dy:-6});near((drag.next.overlays[0].x-current.overlays[0].x)*1000,12);near((drag.next.overlays[0].y-current.overlays[0].y)*400,-6);eq(drag.next.overlays[0].w,current.overlays[0].w);eq(drag.next.overlays[0].h,current.overlays[0].h);near(ctx.bound(drag,{dx:9999,dy:9999}).dx,(1-.65-.05)*1000);
// Execute the actual pointer-move branches for shape resizing and panel labels.
Object.assign(ctx,{guideDrag:null,elementDrag:null,overlayDrag:null,labelDrag:null,marquee:null,panelDrag:null,resizeDrag:null,layoutMode:false,dragging:null,pending:null,drawSelection(){},snappedDelta:()=>({dx:15,dy:6}),canvasPoint:e=>({x:e.clientX/(l.width*2),y:e.clientY/(l.height*2)})});
const frames=new Map();let frameId=0;Object.assign(ctx,{requestAnimationFrame(fn){const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame(id){frames.delete(id);}});
const flushFrame=()=>{const jobs=[...frames.values()];frames.clear();jobs.forEach(fn=>fn());};
vm.runInContext(extract('    const prepareObjectDrag=','    const moveNativeItems=')+'\n'+extract('    const paintObjectPointer=e=>','    svg.onpointerup=e=>'),ctx);
ctx.overlayDrag={id:'note',resize:true,moved:false,screen:{x:0,y:0},point:{x:0,y:0},next:copy(current)};ctx.svg.onpointermove({buttons:1,clientX:40,clientY:20});flushFrame();near((ctx.overlayDrag.next.overlays[0].w-current.overlays[0].w)*1000,20);near((ctx.overlayDrag.next.overlays[0].h-current.overlays[0].h)*400,10);ctx.overlayDrag=null;
const labelNode=element('text');ctx.svg.querySelector=()=>labelNode;ctx.labelDrag={id:'b',point:{x:0,y:0},start:{...state.panels.b.label},alignment:{},moved:false};ctx.svg.onpointermove({buttons:1,clientX:30,clientY:12});flushFrame();const labelBefore=labelPhysical(state,'b'),labelAfter=labelPhysical(ctx.pending,'b');near(labelAfter.x-labelBefore.x,15);near(labelAfter.y-labelBefore.y,6);near(+labelNode.attrs.x,labelAfter.x);near(+labelNode.attrs.y,labelAfter.y);
// The production nudge painter also uses the same uncropped label percentage,
// so there is no preview-to-commit coordinate jump within a fixed layout.
Object.assign(ctx,{zoomView:{},previewState:current,labelDrag:null,alignmentContext:()=>({bounds:null,targets:[]}),alignmentSnap:()=>({guides:[]}),selectedNodes:()=>[],paintSnapGuides(){},drawAlignmentGuides(){}});
vm.runInContext(extract('    zoomView.nudgeCanvas=','    svg.classList.toggle'),ctx);
const preview=ctx.zoomView.nudgeCanvas.capture([{kind:'label',id:'b',el:labelNode}]),nudged=nudgeSelectionState(state,[{kind:'label',id:'b'}],1,2,l).next;preview.draw(nudged,{dx:1,dy:2});const painted=labelPhysical(nudged,'b');near(+labelNode.attrs.x,painted.x);near(+labelNode.attrs.y,painted.y);
// Toolbar alignment converts a CSS-pixel distance into physical source-space
// deltas for mixed overlays and panel labels, without scaling either object.
current=copy(state);const labelItem={kind:'label',id:'b',el:{getBoundingClientRect:()=>({left:600,right:620,top:0,bottom:20})}},overlayItem={kind:'overlay',id:'note',el:{getBoundingClientRect:()=>({left:700,right:730,top:0,bottom:20})}};
Object.assign(ctx,{original:false,cancelQuickPreview(){},quickSelectedObjects:()=>[labelItem,overlayItem],say(){},$:()=>({querySelector:()=>ctx.svg})});
vm.runInContext(extract('  function alignSelectedObjects(','  function renderQuickToolbar('),ctx);ctx.alignSelectedObjects('left');near((current.overlays[0].x-state.overlays[0].x)*1000,-50);near(current.panels.b.label.x,state.panels.b.label.x);eq(current.overlays[0].size,state.overlays[0].size);eq(current.overlays[0].w,state.overlays[0].w);
eq(JSON.stringify(state),before,'Preview gestures do not touch live data or state');
console.log(`PASS compact interaction: ${checks} coordinate/size/identity/undo assertions`);
