/* Run with node scripts/test_studio_state.cjs. No packages required. */
const assert = require('node:assert/strict');
const {History, validateState, complementary, arrange, gridFor, movePanel} = require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const project={panels:[{id:'panel-0',variants:[{},{}]}]};
const initial={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{}}}};
const clone=x=>JSON.parse(JSON.stringify(x));
const history=new History(initial);
let next=clone(initial);next.panels['panel-0'].edits={0:{e5:{fill:'#4477aa',opacity:'0.5'}}};
validateState(next,project);history.commit(next);next.panels['panel-0'].edits[0].e5.fill='#ee7733';
assert.equal(history.current.panels['panel-0'].edits[0].e5.fill,'#4477aa','commits must not alias mutable input');
history.undo();assert.deepEqual(history.current,initial);history.redo();
assert.equal(history.current.panels['panel-0'].edits[0].e5.opacity,'0.5');
history.undo();const branch=clone(initial);branch.panels['panel-0'].variant=1;history.commit(branch);
history.redo();assert.equal(history.current.panels['panel-0'].variant,1,'redo cannot leak a discarded branch');
for(let i=0;i<120;i++){const state=clone(history.current);state.gap=i%100;history.commit(state);}
assert.equal(history.states.length,81);
assert.equal(JSON.stringify(history.states).includes('svg'),false,'history must not duplicate assets');
for(const bad of [
  {...initial,order:['panel-0','panel-0']},
  {...initial,gap:NaN},
  {...initial,columns:0},
  {...initial,panels:{'panel-0':{variant:10,edits:{}}}},
  {...initial,panels:{'panel-0':{variant:0,edits:{0:{e1:{onclick:'alert(1)'}}}}}},
  {...initial,panels:{'panel-0':{variant:0,edits:{0:{e1:{fill:'url(https://bad.test)'}}}}}},
]) assert.throws(()=>validateState(bad,project));
assert.equal(complementary('#4477aa'),'#aa7744');
console.log('Figure Studio state/history validation passed');
const ids=Array.from({length:15},(_,i)=>'panel-'+i);
const multi={panels:ids.map(id=>({id,variants:[{}]}))};
const base={order:ids,columns:3,gap:12,panels:Object.fromEntries(ids.map(id=>[id,{variant:0,edits:{}}]))};
const five=arrange(base,5,3);validateState(five,multi);
assert.equal(gridFor(five).rows,5);
assert.throws(()=>arrange(base,4,3),/位置不足/);
const swapped=movePanel(five,'panel-0',4,2);validateState(swapped,multi);
assert.equal(swapped.order[14],'panel-0');assert.equal(swapped.order[0],'panel-14');
const large=arrange(base,6,3,'hero');validateState(large,multi);
assert.deepEqual(large.grid.places['panel-0'],{row:0,col:0,rs:2,cs:2});
const largeSwap=movePanel(large,'panel-0',0,2);validateState(largeSwap,multi);
assert.equal(largeSwap.grid.places['panel-1'].cs,2,'swap carries complete slots');
assert.deepEqual(movePanel(large,'panel-0',1,1),large,'click within own span must not move it');
const moved=movePanel(five,'panel-0',6,0);assert.throws(()=>validateState(moved,multi),/超出/);
const sparse=arrange(base,6,3);const emptyMove=movePanel(sparse,'panel-0',5,2);validateState(emptyMove,multi);
assert.equal(emptyMove.grid.places['panel-0'].row,5);
const overlap=copyForTest(five);overlap.grid.places['panel-1']=copyForTest(overlap.grid.places['panel-0']);assert.throws(()=>validateState(overlap,multi),/重叠/);
function copyForTest(x){return JSON.parse(JSON.stringify(x));}
const timeline=new History(five);timeline.commit(large);timeline.undo();assert.deepEqual(timeline.current,five);timeline.redo();assert.deepEqual(timeline.current,large);
console.log('15-panel grid, spanning slots, swaps, empty moves, overlap bounds and undo passed');
