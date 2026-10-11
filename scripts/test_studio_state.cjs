/* Run with node scripts/test_studio_state.cjs. No packages required. */
const assert = require('node:assert/strict');
const {History, validateState, complementary} = require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
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
