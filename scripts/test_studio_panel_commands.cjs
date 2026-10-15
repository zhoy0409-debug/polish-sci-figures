'use strict';
const assert=require('node:assert/strict');
const commands=require('../skills/polish-sci-figures/assets/figure-studio/panel-commands.js');
const studio=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const clone=value=>JSON.parse(JSON.stringify(value));let count=0;
const test=(name,fn)=>{fn();console.log('PASS '+name);count++;};
function fixture(){
  const project=studio.createBlankProject('0123456789abcdefabcd'),asset=project.panels[0];
  project.panels=['a','b','c','blank'].map(id=>({...clone(asset),id}));
  const state={order:['a','b','c'],columns:2,gap:12,grid:{rows:2,widths:[240,300],heights:[180,220],manualTracks:true,places:{a:{row:0,col:0,rs:1,cs:1},b:{row:0,col:1,rs:1,cs:1},c:{row:1,col:0,rs:1,cs:1}}},panels:{a:{variant:0,edits:{}},b:{variant:0,edits:{}},c:{variant:0,edits:{}}}};
  project.initialState=clone(state);return {project,state};
}
const frames=[{id:'a',x:20,y:30,width:80,height:50},{id:'b',x:170,y:45,width:100,height:70},{id:'c',x:60,y:170,width:50,height:100}];
const keyAnchor=(frame,mode)=>['left','center','right'].includes(mode)?frame.x+(mode==='right'?frame.width:mode==='center'?frame.width/2:0):frame.y+(mode==='bottom'?frame.height:mode==='middle'?frame.height/2:0);
test('multi-cell deletion is a single immutable transaction; mixed locked selections retain their grid tracks',()=>{
  const {project,state}=fixture();state.panels.b.locked=true;const before=clone(state),assets=JSON.stringify(project.panels);
  const info=commands.deletionInfo(state,['a','a','b','stale']);assert.deepEqual(info,{removed:['a'],skipped:[{id:'b',reason:'panel-locked'}],needsReplacement:false});
  const result=commands.removePanels(state,['a','b','c']);studio.validateState(result.state,project);assert.deepEqual(result.removed,['a','c']);assert.deepEqual(result.state.order,['b']);assert.deepEqual(result.selection,['b']);assert.deepEqual(result.state.grid.widths,state.grid.widths);assert.deepEqual(result.state.grid.heights,state.grid.heights);assert.deepEqual(result.state.grid.places.b,state.grid.places.b);assert.deepEqual(state,before);assert.equal(JSON.stringify(project.panels),assets);
  const history=new studio.History(state);history.commit(result.state);assert.equal(history.states.length,2);history.undo();assert.deepEqual(history.current,state);history.redo();assert.deepEqual(history.current,result.state);
});
test('locked descendants and locked linked inset prevent parent deletion/alignment',()=>{
  const {state}=fixture();state.panels.a.lockedElements={0:['e2']};state.overlays=[{id:'annotation-1',type:'inset',source:{panelId:'b'},locked:true}];
  assert.deepEqual(commands.deletionInfo(state,['a','b','c']).skipped,[{id:'a',reason:'content-locked'},{id:'b',reason:'inset-locked'}]);
  const aligned=commands.alignPanels(state,['a','b','c'],'left',{frames});assert.deepEqual(aligned.changed.map(change=>change.id),['c']);assert.equal(aligned.state.panels.a,state.panels.a);assert.equal(aligned.state.panels.b,state.panels.b);
});
test('a separately locked panel label also protects its owning frame from deletion or alignment',()=>{
  const {state}=fixture();state.panels.a.label={text:'A',locked:true};assert.equal(commands.deletionInfo(state,['a']).skipped[0].reason,'label-locked');assert.equal(commands.removePanels(state,['a']).state,state);
  const result=commands.alignPanels(state,['a','b'],'left',{frames});assert.equal(result.state.panels.a,state.panels.a);assert.deepEqual(result.changed.map(change=>change.id),['b']);assert.equal(result.target,20);
});
test('deleted panels clean only related groups, inset ownership and image links',()=>{
  const {state}=fixture();state.panelGroups=[['a','b','c']];state.overlays=[{id:'annotation-1',type:'text',text:'Keep'},{id:'annotation-2',type:'inset',source:{panelId:'a'}},{id:'annotation-3',type:'inset',source:{panelId:'c'}}];
  state.imageLinks=[{id:'l1',parent:{panelId:'a'},child:{panelId:'b'}},{id:'l2',parent:{panelId:'b'},child:{insetId:'annotation-2'}},{id:'l3',parent:{panelId:'b'},child:{insetId:'annotation-3'}}];
  const next=commands.removePanels(state,['a']).state;assert.deepEqual(next.panelGroups,[['b','c']]);assert.deepEqual(next.overlays.map(item=>item.id),['annotation-1','annotation-3']);assert.deepEqual(next.imageLinks.map(item=>item.id),['l3']);
});
test('deleting every cell requires one appended blank asset and Undo restores every original cell',()=>{
  const {project,state}=fixture();assert.equal(commands.deletionInfo(state,state.order).needsReplacement,true);assert.throws(()=>commands.removePanels(state,state.order),/空白/);assert.throws(()=>commands.removePanels(state,state.order,{replacementId:'a'}),/空白/);
  const result=commands.removePanels(state,state.order,{replacementId:'blank'});assert.deepEqual(result.state.order,['blank']);assert.deepEqual(result.state.grid.places.blank,state.grid.places.a);assert.deepEqual(result.selection,['blank']);assert.equal(result.replacementId,'blank');studio.validateState(result.state,project);
  const history=new studio.History(state);history.commit(result.state);const restored=studio.History.restore(JSON.parse(JSON.stringify(history.toJSON())),project,result.state);restored.undo();assert.deepEqual(restored.current,state);assert.equal(project.panels.length,4);
});
test('stale or all-locked deletion is a no-op and malformed physical metrics cannot corrupt the grid',()=>{
  const {state}=fixture();assert.equal(commands.removePanels(state,['missing']).state,state);state.panels.a.locked=true;assert.equal(commands.removePanels(state,['a']).state,state);
  for(const metrics of [{widths:[240],heights:[180,220]},{widths:[240,NaN],heights:[180,220]},{widths:[240,300],heights:[180,Infinity]}])assert.throws(()=>commands.removePanels(state,['b'],{metrics}),/布局/);
});
for(const mode of ['left','center','right','top','middle','bottom'])test('global '+mode+' alignment moves physical panel frames without changing grid slots or scaling artwork',()=>{
  const {project,state}=fixture(),before=clone(state),assets=JSON.stringify(project.panels),result=commands.alignPanels(state,state.order,mode,{frames,bounds:{width:600,height:500}});studio.validateState(result.state,project);assert.ok(result.changed.length);
  const after=frames.map(frame=>commands.frameWithOffset(frame,result.state.panels[frame.id])),anchors=after.map(frame=>keyAnchor(frame,mode));assert.ok(anchors.every(value=>Math.abs(value-result.target)<1e-9));
  for(let i=0;i<after.length;i++){assert.equal(after[i].width,frames[i].width);assert.equal(after[i].height,frames[i].height);assert.equal(after[i].width/after[i].height,frames[i].width/frames[i].height);}
  assert.equal(result.state.grid,state.grid);assert.deepEqual(result.state.grid.places,state.grid.places);assert.equal(result.state.panels.a.edits,state.panels.a.edits);assert.deepEqual(state,before);assert.equal(JSON.stringify(project.panels),assets);
  const repeated=commands.alignPanels(result.state,state.order,mode,{frames:after,bounds:{width:600,height:500}});assert.equal(repeated.state,result.state);assert.deepEqual(repeated.changed,[]);
});
test('alignment accumulates existing offsets once and leaves the perpendicular coordinate untouched',()=>{
  const {state}=fixture();state.panels.a.frameOffset={x:15,y:25};const actual=frames.map(frame=>commands.frameWithOffset(frame,state.panels[frame.id]));const result=commands.alignPanels(state,['a','b'],'right',{frames:actual});
  assert.equal(result.state.panels.a.frameOffset.y,25);assert.equal(result.state.panels.a.frameOffset.x,170);assert.equal(commands.frameWithOffset(frames[0],result.state.panels.a).x+80,270);assert.equal(result.state.panels.c,state.panels.c);
});
test('a locked selected panel is a stationary alignment reference; all locked selections are no-ops',()=>{
  const {state}=fixture();state.panels.b.locked=true;const result=commands.alignPanels(state,['a','b'],'left',{frames});assert.equal(result.target,170);assert.equal(result.state.panels.b,state.panels.b);assert.deepEqual(result.changed.map(change=>change.id),['a']);assert.deepEqual(result.skipped,[{id:'b',reason:'panel-locked'}]);
  state.panels.a.locked=true;assert.equal(commands.alignPanels(state,['a','b'],'center',{frames}).state,state);
});
test('mother bounds clamp the shared alignment target instead of independently breaking alignment',()=>{
  const {state}=fixture(),outside=[{id:'a',x:-20,y:0,width:80,height:50},{id:'b',x:140,y:30,width:100,height:70}];
  const result=commands.alignPanels(state,['a','b'],'left',{frames:outside,bounds:{width:240,height:100}});assert.equal(result.target,0);assert.equal(result.clamped,true);for(const frame of outside){const offset=result.state.panels[frame.id].frameOffset;assert.equal(frame.x+offset.x,0);assert.equal(offset.y,0);}
  assert.throws(()=>commands.alignPanels(state,['a','b'],'left',{frames:outside,bounds:{width:90,height:100}}),/母版/);assert.throws(()=>commands.alignPanels(state,['a','b'],'left',{frames:outside,bounds:{width:Infinity,height:100}}),/母版/);
});
test('missing/unmeasurable frames fail without edits; unknown ids and singleton alignment do nothing',()=>{
  const {state}=fixture();assert.throws(()=>commands.alignPanels(state,['a','b'],'left',{frames:[frames[0]]}),/测量/);assert.throws(()=>commands.alignPanels(state,['a','b'],'left',{frames:[frames[0],{...frames[1],width:0}]}),/测量/);assert.throws(()=>commands.alignPanels(state,['a','b'],'diagonal',{frames}),/方向/);assert.equal(commands.alignPanels(state,['a','stale'],'left',{frames}).state,state);
  for(const value of [{x:NaN,y:0},{x:0,y:Infinity},{x:1e8,y:0}])assert.throws(()=>commands.frameWithOffset(frames[0],{frameOffset:value}),/位置/);
});
test('empty row deletion preserves widths and surviving source spans in one undoable operation',()=>{
  const {project,state}=fixture();state.grid.rows=3;state.grid.heights=[180,90,220];state.grid.places.c.row=2;const before=clone(state),result=commands.removeEmptyTrack(state,{row:1,col:1});assert.equal(result.removed,true);assert.equal(result.axis,'row');assert.equal(result.index,1);assert.deepEqual(result.state.grid.heights,[180,220]);assert.equal(result.state.grid.places.c.row,1);assert.deepEqual(result.state.grid.widths,[240,300]);assert.deepEqual(state,before);studio.validateState(result.state,project);
  const history=new studio.History(state);history.commit(result.state);history.undo();assert.deepEqual(history.current,state);
});
test('empty column removal preserves custom widths and adjusts logical column only',()=>{
  const {project,state}=fixture();state.columns=3;state.grid.widths=[240,90,300];state.grid.places.b.col=2;const result=commands.removeEmptyTrack(state,{row:1,col:1},{axis:'column'});assert.equal(result.removed,true);assert.equal(result.state.columns,2);assert.deepEqual(result.state.grid.widths,[240,300]);assert.equal(result.state.grid.places.b.col,1);assert.deepEqual(result.state.panels,state.panels);studio.validateState(result.state,project);
});
test('an occupied row/column or a spanned cell cannot be silently removed or reflowed',()=>{
  const {state}=fixture();assert.deepEqual(commands.removeEmptyTrack(state,{row:1,col:1}),{state,removed:false,reason:'occupied-track'});assert.equal(commands.removeEmptyTrack(state,{row:0,col:0}).reason,'occupied-cell');
  state.order=['a'];state.panels={a:state.panels.a};state.grid.places={a:{row:0,col:0,rs:2,cs:2}};assert.equal(commands.removeEmptyTrack(state,{row:1,col:1}).reason,'occupied-cell');assert.throws(()=>commands.removeEmptyTrack(state,{row:8,col:0}),/空格/);
});
test('empty-track removal never shifts a locked frame; later empty tracks can safely disappear',()=>{
  const {state}=fixture();state.grid.rows=3;state.grid.heights=[180,90,220];state.grid.places.c.row=2;state.panels.c.locked=true;
  const result=commands.removeEmptyTrack(state,{row:1,col:1});assert.equal(result.state,state);assert.equal(result.reason,'locked-panel');assert.equal(result.id,'c');
  state.grid.places.c.row=1;const end=commands.removeEmptyTrack(state,{row:2,col:1});assert.equal(end.removed,true);assert.deepEqual(end.state.panels.c,state.panels.c);assert.deepEqual(end.state.grid.places.c,state.grid.places.c);
});
if(process.argv.includes('--dom')){
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<input id="input"><textarea></textarea><select></select><div contenteditable="true"><span>Typing</span></div><div role="textbox"><span>Typing</span></div><div id="canvas"></div>'),doc=dom.window.document;
  test('Delete/Backspace event guard preserves text inputs, editable regions and IME composition',()=>{
    for(const key of ['Delete','Backspace']){
      assert.equal(commands.isDeleteEvent({key,target:doc.getElementById('canvas')}),true);
      for(const target of [...doc.querySelectorAll('input,textarea,select,[contenteditable] span,[role="textbox"] span')])assert.equal(commands.isDeleteEvent({key,target}),false);
      for(const property of ['ctrlKey','metaKey','altKey','isComposing','defaultPrevented'])assert.equal(commands.isDeleteEvent({key,target:doc.getElementById('canvas'),[property]:true}),false);
    }
    assert.equal(commands.isDeleteEvent({key:'Enter',target:doc.getElementById('canvas')}),false);
  });dom.window.close();
}
console.log(count+' whole-panel command checks passed');
