'use strict';
// Production command handlers + real DOM focus + History; no alternate command model.
const assert=require('node:assert/strict'),vm=require('node:vm');
const {create,source,api,copy}=require('./helpers/studio-command-fixture.cjs');
let checks=0;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function test(name,fn){fn();checks++;console.log('PASS '+name);}
const object=(id,x,y,w,h,locked=false)=>({id,locked,b:{left:x,right:x+w,top:y,bottom:y+h}});
test('six alignments retain a locked reference and leave the other axis untouched',()=>{
  const a=object('a',10,20,10,20,true),b=object('b',60,80,30,10);
  for(const [mode,dx,dy]of [['left',-50,0],['center',-60,0],['right',-70,0],['top',0,-60],['middle',0,-55],['bottom',0,-50]]){
    const plan=api.selectionAlignmentPlan([a,b],mode);assert.equal(plan.length,1);assert.equal(plan[0].item,b);near(plan[0].dx,dx);near(plan[0].dy,dy);
  }
});
test('distribution preserves the two end objects and creates equal gaps for unequal widths',()=>{
  const objects=[object('a',10,20,20,15),object('b',80,70,30,25),object('c',160,150,10,10)],before=copy(objects);
  for(const mode of ['distribute-x','distribute-y']){
    const plan=api.selectionAlignmentPlan([objects[2],objects[0],objects[1]],mode),axis=mode.endsWith('x')?'dx':'dy',start=mode.endsWith('x')?'left':'top',end=mode.endsWith('x')?'right':'bottom';
    near(plan[0][axis],0);near(plan.at(-1)[axis],0);
    near(plan[1].item.b[start]+plan[1][axis]-plan[0].item.b[end],plan[2].item.b[start]-plan[1].item.b[end]-plan[1][axis]);
  }
  assert.deepEqual(objects,before);assert.deepEqual(api.selectionAlignmentPlan(objects.slice(0,2),'distribute-x'),[]);
  assert.deepEqual(api.selectionAlignmentPlan(objects.map((item,i)=>({...item,locked:i===1})),'distribute-x'),[]);
});
function harness(){
  const f=create(),ctx=f.ctx,viewport=f.doc.createElement('div');viewport.id='viewport';f.doc.body.append(viewport);
  const select=f.doc.createElement('select');select.id='quickAlignAction';select.innerHTML='<option value="">Align</option><option value="left">Left</option><option value="distribute-x">Distribute</option>';f.doc.body.append(select);
  let frames=new Map(),serial=0,captures=0,draws=0;
  Object.assign(ctx,{currentOutput:()=>({scale:1}),inlineEditor:null,overlayPlacement:null,zoomView:{},cancelQueuedZoom(){},requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),quickSelectedObjects:()=>[]});
  const paint=f.ctx.render;ctx.render=()=>{paint();ctx.zoomView.nudgeCanvas={geometry:ctx.layout(),isPreview:false,isGestureActive:()=>false,capture(items){captures++;assert.ok(items.every(item=>item.kind==='panel'));return {draw(){draws++;},clear(){}};}};};ctx.render();
  vm.runInContext(source.slice(source.indexOf('  // Arrow-key repeats'),source.indexOf('  // Frequent actions')),ctx);
  const start=source.indexOf("  document.addEventListener('keydown',e=>{if(!e.isComposing&&!editingTextTarget(e.target)&&nudgeGesture)"),end=source.indexOf("  document.addEventListener('keydown',e=>{if(e.isComposing",start);vm.runInContext(source.slice(start,end),ctx);
  return {...f,viewport,select,flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());},stats:()=>({...f.stats(),captures,draws,pending:frames.size}),up(key){f.doc.activeElement.dispatchEvent(new f.dom.window.KeyboardEvent('keyup',{key,bubbles:true}));}};
}
test('align from a focused select returns focus and immediately accepts a shared keyboard nudge',()=>{
  const f=harness();try{
    f.selectPanels(['panel-0','panel-1']);f.select.focus();assert.equal(f.doc.activeElement,f.select);
    f.ctx.alignSelectedObjects('left');assert.equal(f.doc.activeElement,f.viewport,'alignment must hand arrow keys back to the canvas');
    const aligned=copy(f.history.current),selection=copy(f.ctx.panelSelection),step=f.stats().commits;
    assert.equal(f.press('ArrowRight',f.doc.activeElement).defaultPrevented,true);f.flush();f.up('ArrowRight');
    assert.equal(f.stats().commits,step+1);for(const id of selection)near(f.history.current.panels[id].frameOffset.x,(aligned.panels[id].frameOffset?.x||0)+1);
    assert.deepEqual(f.ctx.panelSelection,selection);f.press('z',f.viewport,{ctrlKey:true});assert.deepEqual(f.history.current,aligned);
  }finally{f.close();}
});
test('several held arrows coalesce once; a following alignment commits their exact movement first',()=>{
  const f=harness();try{
    f.selectPanels(['panel-0','panel-1']);f.ctx.alignSelectedObjects('left');const before=f.stats().commits;
    for(let i=0;i<20;i++)f.press('ArrowRight',f.viewport,{repeat:i>0});assert.equal(f.stats().pending,1);assert.equal(f.stats().commits,before);
    f.ctx.alignSelectedObjects('top');assert.equal(f.stats().commits,before+1);near(f.history.current.panels['panel-0'].frameOffset.x,20);near(f.history.current.panels['panel-1'].frameOffset.x,-192);
    f.up('ArrowRight');assert.equal(f.stats().commits,before+1,'a stale release must not repeat the first gesture');assert.equal(f.stats().pending,0);
  }finally{f.close();}
});
test('selected panels can nudge in arrange mode while fixed labels/elements keep their owning panel stationary',()=>{
  const f=harness();try{
    f.selectPanels(['panel-0','panel-1']);f.ctx.alignSelectedObjects('left');f.ctx.layoutMode=true;
    f.history.current.panels['panel-1'].label.locked=true;const fixed=copy(f.history.current.panels['panel-1']);
    f.press('ArrowRight',f.viewport);f.up('ArrowRight');near(f.history.current.panels['panel-0'].frameOffset.x,1);assert.deepEqual(f.history.current.panels['panel-1'],fixed);
  }finally{f.close();}
});
test('panel distribution is one reversible change and survives the next align and arrow command',()=>{
  const f=harness();try{
    const next=copy(f.history.current);next.panels['panel-1'].frameOffset={x:-60,y:0};f.history.states[f.history.index]=next;f.ctx.render();f.selectPanels(next.order);const before=copy(next),count=f.stats().commits;
    f.ctx.alignSelectedObjects('distribute-x');const frames=f.ctx.layout().positions;near(frames[1].x-frames[0].x-frames[0].width,frames[2].x-frames[1].x-frames[1].width);assert.equal(f.stats().commits,count+1);
    f.press('z',f.viewport,{ctrlKey:true});assert.deepEqual(f.history.current,before);f.ctx.alignSelectedObjects('left');f.press('ArrowRight',f.viewport,{altKey:true});f.up('ArrowRight');
    for(const id of next.order)near(f.history.current.panels[id].frameOffset.x,(id==='panel-0'?0:id==='panel-1'?-212:-424)+.1);
  }finally{f.close();}
});
test('panel gestures stop at the artboard edge as one group and zero-return adds no state',()=>{
  const f=create();try{
    const base=f.history.current,l=f.ctx.layout(),items=base.order.map(id=>({kind:'panel',id}));assert.deepEqual(api.nudgeSelectionState(base,items,10,0,l).next,base,'rightmost selected panel is already at the page edge');
    const next=copy(base);next.panels['panel-2'].label.locked=true;assert.deepEqual(api.nudgeSelectionState(next,[{kind:'panel',id:'panel-2'}],-10,0,l).next,next);
  }finally{f.close();}
});
console.log(`${checks} continuous focus/alignment/distribution/keyboard checks passed`);
