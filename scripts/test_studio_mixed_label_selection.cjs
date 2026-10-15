/* Production host selection/pointer routing plus real controller/DOM resizing.
 * Browser geometry boundaries come from the existing bounded fixtures. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{createRequire}=require('node:module');
const directory=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),source=fs.readFileSync(path.join(directory,'studio.js'),'utf8'),studio=require(path.join(directory,'studio.js')),clone=x=>JSON.parse(JSON.stringify(x));
const fixtureFile=path.resolve(__dirname,'test_studio_workspace_selection.cjs'),fixtureSource=fs.readFileSync(fixtureFile,'utf8'),fixtureContext={require:createRequire(fixtureFile),console};
vm.createContext(fixtureContext);vm.runInContext(fixtureSource.slice(0,fixtureSource.indexOf('// Gray origin'))+'\nglobalThis.makeHarness=harness;globalThis.makeElement=el;',fixtureContext);
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('PASS '+name);};
function harness(){
  const h=fixtureContext.makeHarness();h.t1.dataset.key='e1';h.t2.dataset.key='e2';h.t3.dataset.key='e1';
  Object.assign(h.s,{columns:2,gap:12,labelNumbering:'upper',grid:{rows:1,places:{p0:{row:0,col:0,rs:1,cs:1},p1:{row:0,col:1,rs:1,cs:1}}}});h.ctx.displayedPanelLabel=studio.displayedPanelLabel;h.ctx.removeSelectedItems=studio.removeSelectedItems;
  for(const id of ['p0','p1'])h.s.panels[id].label={text:id==='p0'?'A':'B',x:5,y:8,size:12,font:'Arial',bold:true};
  h.ctx.l.positions=[{id:'p0',x:0,y:0,width:260,height:420},{id:'p1',x:280,y:0,width:320,height:420}];
  const labels=['p0','p1'].map((id,index)=>{const left=index?396:113,node=fixtureContext.makeElement('text',{panelLabel:id},{left,top:100,right:left+14,bottom:118});node.textContent=index?'B':'A';h.svg.append(node);return node;});
  h.note.append(fixtureContext.makeElement('text',{},h.note.getBoundingClientRect()));h.s.overlays[0].type='text';h.s.overlays[0].text='Note';
  const query=h.svg.querySelector.bind(h.svg);h.svg.querySelector=selector=>selector.endsWith(' > :first-child')?query(selector.slice(0,-' > :first-child'.length))?.children[0]||null:query(selector);
  for(const id of ['panelLabel','panelLabelControls','font'])h.fields[id]={value:'',scrollIntoView(){},focus(){},select(){}};
  h.fields.artboard=h.svg;h.ctx.editsFor=(id,vi)=>h.s.panels[id].edits[vi]||{};h.ctx.editableSource=id=>h.svg.querySelector(`[data-panel="${id}"]`);
  vm.runInContext(extract('  function selectPanelLabel(','  function setEdit(')+extract('  function quickSelectedObjects(){','  function quickObjectTarget(')+extract('  function selectionCommandInfo(){','  function renderQuickToolbar(){')+extract('  function deleteSelectedObjects(){','  function renderLabelControls(){'),h.ctx);
  return {...h,labels,details:()=>clone(vm.runInContext('({groups:selectionGroups(),labels:selectedLabelIds(),annotations:selectedAnnotations})',h.ctx)),select(groups,labelIds=[]){h.ctx.inputGroups=groups;h.ctx.inputLabels=labelIds;vm.runInContext('setElementSelection(inputGroups);setLabelSelection(inputLabels);',h.ctx);},marquee(){h.drag(60,90,550,320);h.finish(550,320);}};
}
test('marquee includes both panel labels, native objects and inserted annotation in one shared selection',()=>{
  const h=harness();h.marquee();const selected=h.details();assert.equal(selected.groups.reduce((n,g)=>n+g.keys.length,0),3);assert.deepEqual(selected.labels,['p0','p1']);assert.deepEqual(selected.annotations,['note']);assert.equal(h.selectionLayer.children.length,6);assert.ok(h.labels.every(label=>label.classList.contains('chosen')));assert.equal(h.ctx.quickSelectedObjects().length,6);assert.equal(h.stats().commits,0);
});
test('Shift click appends labels to a native selection and a later Shift native click retains both labels',()=>{
  const h=harness();h.tap(h.t1,140,148);h.tap(h.labels[0],120,108,{shiftKey:true});h.tap(h.labels[1],402,108,{shiftKey:true});assert.deepEqual(h.details().labels,['p0','p1']);assert.deepEqual(h.details().groups,[{id:'p0',vi:0,keys:['e1']}]);
  h.tap(h.t3,430,148,{shiftKey:true});assert.deepEqual(h.details().labels,['p0','p1']);assert.equal(h.details().groups.length,2);assert.equal(h.stats().commits,0);
});
for(const start of ['label','native'])test('drag from selected '+start+' moves native objects, both labels and annotation once per pointer gesture',()=>{
  const h=harness();h.marquee();const target=start==='label'?h.labels[1]:h.t3,x=start==='label'?402:430,y=start==='label'?108:148,old=clone(h.s),event=(px,py)=>h.event(px,py,target,{altKey:true});
  h.svg.onpointerdown(event(x,y));for(const d of [3,6,10])h.svg.onpointermove(event(x+d,y+4));assert.equal(h.stats().commits,0);assert.equal(h.raf.size,1);h.flush();assert.equal(h.stats().commits,0);h.svg.onpointerup(event(x+10,y+4));assert.equal(h.stats().commits,1);
  for(const [id,key]of [['p0','e1'],['p0','e2'],['p1','e1']]){assert.equal(+h.s.panels[id].edits[0][key]['offset-x'],10);assert.equal(+h.s.panels[id].edits[0][key]['offset-y'],4);}
  for(const [id,width]of [['p0',260],['p1',320]]){assert.ok(Math.abs(h.s.panels[id].label.x-old.panels[id].label.x-10/width*100)<1e-10);assert.ok(Math.abs(h.s.panels[id].label.y-old.panels[id].label.y-4/420*100)<1e-10);}
  assert.ok(Math.abs(h.s.overlays[0].x-old.overlays[0].x-10/600)<1e-10);assert.ok(Math.abs(h.s.overlays[0].y-old.overlays[0].y-4/420)<1e-10);
});
test('persistent box-select mode lets any selected label start moving the complete mixed selection',()=>{
  const h=harness();h.ctx.boxMode(true);h.marquee();const old=clone(h.s),event=(x,y)=>h.event(x,y,h.labels[1],{altKey:true});h.svg.onpointerdown(event(402,108));h.svg.onpointermove(event(412,112));h.flush();h.svg.onpointerup(event(412,112));assert.equal(h.stats().commits,1);assert.equal(+h.s.panels.p0.edits[0].e1['offset-x'],10);assert.ok(Math.abs(h.s.panels.p1.label.x-old.panels.p1.label.x-10/320*100)<1e-10);assert.deepEqual(h.details().labels,['p0','p1']);
});
test('marquee includes locked labels for batch unlock while their edit protection remains active',()=>{
  const h=harness();h.s.panels.p0.label.locked=true;h.marquee();assert.deepEqual(h.details().labels,['p0','p1']);assert.ok(h.details().groups.some(group=>group.id==='p0'));
  h.select([{id:'p0',vi:0,keys:['e1']}],['p0','p1']);const all=h.ctx.quickSelectedObjects();assert.equal(all.find(item=>item.kind==='label'&&item.id==='p0').locked,true);assert.equal(all.find(item=>item.kind==='element'&&item.id==='p0').locked,false);assert.equal(h.ctx.selectionCommandInfo().canLock,true);assert.equal(h.ctx.selectionCommandInfo().canUnlock,true);
});
test('actual Delete command removes selected native objects, both labels and annotation in one recoverable state',()=>{
  const h=harness();h.marquee();const before=clone(h.s),history=new studio.History(h.s);let commits=0;h.ctx.commit=next=>{history.commit(next);Object.assign(h.s,clone(next));commits++;return true;};
  h.ctx.deleteSelectedObjects();assert.equal(commits,1);assert.equal(h.s.panels.p0.label,undefined);assert.equal(h.s.panels.p1.label,undefined);assert.equal(h.s.panels.p0.edits[0].e1.hidden,'true');assert.equal(h.s.panels.p0.edits[0].e2.hidden,'true');assert.equal(h.s.panels.p1.edits[0].e1.hidden,'true');assert.deepEqual(h.s.overlays,[]);assert.deepEqual(h.s.order,before.order);history.undo();assert.deepEqual(history.current,before);
});
test('mixed Delete leaves a locked label and locked native object untouched',()=>{
  const h=harness();h.s.panels.p0.label.locked=true;h.s.panels.p1.lockedElements={0:['e1']};h.select([{id:'p0',vi:0,keys:['e1']},{id:'p1',vi:0,keys:['e1']}],['p0','p1']);h.ctx.deleteSelectedObjects();assert.ok(h.s.panels.p0.label);assert.equal(h.s.panels.p1.label,undefined);assert.equal(h.s.panels.p0.edits[0].e1.hidden,'true');assert.equal(h.s.panels.p1.edits[0]?.e1,undefined);
});
test('production resize host supplies all selected labels with their own lock flags alongside native geometry',()=>{
  const h=harness();h.select([{id:'p0',vi:0,keys:['e1']}],['p0','p1']);h.s.panels.p1.label.locked=true;let config;
  h.ctx.StudioSelectionResize={create:value=>(config=value,{refresh(){},cancel(){return false;}})};
  vm.runInContext(extract("    if(typeof StudioSelectionResize!=='undefined')selectionResize=",'    drawSelection(selectedNodes());'),h.ctx);
  const selected=clone(config.selection().map(({kind,id,key,locked})=>({kind,id,...(key?{key}:{}),...(locked!==undefined?{locked}:{})})));
  assert.deepEqual(selected,[{kind:'element',id:'p0',key:'e1'},{kind:'label',id:'p0',locked:false},{kind:'label',id:'p1',locked:true}]);assert.equal(config.resizeHandles(config.selection()),null,'a mixed selection uses shared selection bounds');
});
// Reuse the established real-DOM controller fixture, then drive real handles.
const resizeFile=path.resolve(__dirname,'test_studio_selection_resize_integration.cjs'),resizeSource=fs.readFileSync(resizeFile,'utf8'),resizeContext={require:createRequire(resizeFile),console,global:globalThis};
vm.createContext(resizeContext);vm.runInContext(resizeSource.slice(0,resizeSource.indexOf("test('actual eight handles"))+'\nglobalThis.makeResizeFixture=fixture;',resizeContext);
test('real SVG resize gesture scales native geometry and two panel labels together with one commit',()=>{
  const f=resizeContext.makeResizeFixture();try{
    const items=[f.item()];for(const [id,x]of [['p1',20],['p2',310]]){const label=f.doc.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('x',x);label.setAttribute('y',30);label.setAttribute('font-size',12);label.setAttribute('data-test-box',`${x},30,20,10`);label.textContent=id;f.svg.append(label);items.push({kind:'label',id,el:label});}
    f.select(items);const outline=f.svg.querySelector('.selection-transform-outline'),width=+outline.getAttribute('width'),height=+outline.getAttribute('height'),start=f.down('se'),end={x:start.x+width*.2,y:start.y+height*.2};f.move(end);f.frame();assert.equal(f.commits.length,0);f.up(end);assert.equal(f.commits.length,1);assert.equal(f.errors.length,0);assert.ok(Math.abs(f.state.panels.p1.label.size-14.4)<1e-9);assert.ok(Math.abs(f.state.panels.p2.label.size-14.4)<1e-9);assert.ok(Math.abs(JSON.parse(f.state.panels.p1.edits[0].e1['object-transform'])[0]-1.2)<1e-9);assert.ok(f.state.panels.p2.label.x>5);
  }finally{f.close();}
});
test('mixed drag stops every selected component at the first label boundary instead of producing invalid percentages',()=>{
  const h=harness();h.s.panels.p0.label.x=95;h.select([{id:'p0',vi:0,keys:['e1']}],['p0','p1']);const event=x=>h.event(x,148,h.t1,{altKey:true});h.svg.onpointerdown(event(140));h.svg.onpointermove(event(1140));h.flush();h.svg.onpointerup(event(1140));
  assert.equal(h.stats().commits,1);assert.ok(Math.abs(h.s.panels.p0.label.x-100)<1e-9);assert.ok(Math.abs(+h.s.panels.p0.edits[0].e1['offset-x']-13)<1e-9);assert.ok(Math.abs(h.s.panels.p1.label.x-(5+13/320*100))<1e-9);
});
test('actual mixed lock command locks each selected label and selected native key without locking their entire panels',()=>{
  const h=require('./helpers/studio-command-fixture.cjs').create({ids:['p0','p1']});try{h.selectObjects([{id:'p0',vi:0,keys:['e1']}],['p0','p1']);h.$('lockSelection').onclick();const locked=h.history.current;assert.equal(locked.panels.p0.label.locked,true);assert.equal(locked.panels.p1.label.locked,true);assert.ok(locked.panels.p0.lockedElements[0].includes('e1'));assert.notEqual(locked.panels.p0.locked,true);assert.notEqual(locked.panels.p1.locked,true);assert.ok(locked.panels.p0.layoutLock.elements[0][0].svg.includes('data-key="e1"'));assert.ok(locked.panels.p0.layoutLock.label.svg.includes('data-panel-label="p0"'));assert.ok(locked.panels.p1.layoutLock.label.svg.includes('data-panel-label="p1"'));h.$('unlockSelection').onclick();const released=h.history.current;assert.equal(released.panels.p0.label.locked,false);assert.equal(released.panels.p1.label.locked,false);assert.ok(!released.panels.p0.lockedElements[0].includes('e1'));assert.equal(released.panels.p0.layoutLock.label.locked,false);assert.equal(released.panels.p1.layoutLock.label.locked,false);assert.equal(h.stats().commits,2);h.history.undo();assert.deepEqual(h.history.current,locked);}finally{h.close();}
});
console.log(checks+' mixed-label production integration checks passed');

