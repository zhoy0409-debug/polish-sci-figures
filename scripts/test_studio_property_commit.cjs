/* Real input bindings + layout reducers, without a browser or simulated change-on-blur. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const filename='skills/polish-sci-figures/assets/figure-studio/studio.js';
const source=fs.readFileSync(filename,'utf8');
const {History,arrange,resizePanel,gridFor,validateState}=require('../'+filename);
const ids=Array.from({length:9},(_,i)=>'panel-'+i);
const project={panels:ids.map(id=>({id,variants:[{}]}))};
const initial={order:ids,columns:3,gap:12,panels:Object.fromEntries(ids.map(id=>[id,{variant:0,edits:{}}]))};
const history=new History(arrange(initial,3,3));
let selectedPanel=ids[0],status='',submissions=0;
const elements={};
function input(id,type='number',value=''){
  return elements[id]={id,type,value,disabled:false,events:{},
    addEventListener(event,run){this.events[event]=run;},
    blur(){throw Error('Enter must not depend on a browser blur/change event');},
    edit(value){this.value=String(value);this.events.input?.({target:this});},
    enter(extra={}){let prevented=false;this.onkeydown?.({key:'Enter',preventDefault(){prevented=true;},...extra});return prevented;}};
}
for(const id of ['rows','rowSpan','colSpan','labelX','labelY','labelSize'])input(id);
for(const id of ['panelLabel','textContent','overlayText'])input(id,'text');
input('columns','select-one','3');input('labelBold','checkbox');
const actionIds=['applyGrid','applySpan','applyPanelLabel','applyText','applyOverlay','applyFont','applyColor','applyStroke','applyScale'];
for(const id of actionIds)elements[id]={disabled:false,hidden:false,click(){if(!this.disabled)this.onclick?.();}};
const $=id=>elements[id];
function refresh(){const grid=gridFor(history.current),place=grid.places[selectedPanel];$('rows').value=String(grid.rows);$('columns').value=String(history.current.columns);$('rowSpan').value=String(place.rs);$('colSpan').value=String(place.cs);}
function commit(next,label){validateState(next,project);if(history.commit(next)){submissions++;status=label;refresh();}}
$('applyGrid').onclick=()=>commit(arrange(history.current,+$('rows').value,+$('columns').value),'grid');
$('applySpan').onclick=()=>{try{commit(resizePanel(history.current,selectedPanel,+$('rowSpan').value,+$('colSpan').value),'span');}catch(error){status=error.message;}};
const custom=input('custom','number','9');let customCalls=0;
custom.onkeydown=()=>customCalls++;custom.onchange=()=>{};
const field=input('gap','number','12');let gapCalls=0;field.onchange=()=>gapCalls++;
const start=source.indexOf('  const directProperties=');
const end=source.indexOf("  $('resetOutputSize').onclick",start);
assert.ok(start>=0&&end>start,'Could not find production property bindings');
vm.runInNewContext(source.slice(start,end),{$,setupDirectTextEditing(){},document:{querySelectorAll:()=>Object.values(elements).filter(el=>el.type)}});
refresh();

// Exact reported sequence: add a row, then span the first panel across two columns.
$('rows').edit(4);assert.ok($('rows').enter());
assert.equal(gridFor(history.current).rows,4);assert.equal(status,'grid');
$('colSpan').edit(2);assert.ok($('colSpan').enter());
assert.equal(gridFor(history.current).places[selectedPanel].cs,2);assert.equal(status,'span');
assert.equal(submissions,2);assert.equal(history.states.length,3);
assert.equal($('applySpan').hidden,true,'No extra Apply button should be needed');
// Native change after Enter, including repeated Enter, must not duplicate the action/history.
const before=JSON.stringify(history.toJSON());$('colSpan').onchange();$('colSpan').enter();
assert.equal(JSON.stringify(history.toJSON()),before);assert.equal(submissions,2);
history.undo();assert.equal(gridFor(history.current).places[selectedPanel].cs,1);
history.redo();assert.equal(gridFor(history.current).places[selectedPanel].cs,2);refresh();
// Spinner / blur change remains immediate, and a new edit resets deduplication.
$('colSpan').edit(3);$('colSpan').onchange();
assert.equal(gridFor(history.current).places[selectedPanel].cs,3);
$('colSpan').edit(1);$('colSpan').enter();
assert.equal(gridFor(history.current).places[selectedPanel].cs,1);
$('rowSpan').edit(2);$('rowSpan').enter();
assert.equal(gridFor(history.current).places[selectedPanel].rs,2);
// Invalid values and IME confirmation may not alter the canvas.
const valid=JSON.stringify(history.current);$('colSpan').edit(9);$('colSpan').enter();
assert.equal(JSON.stringify(history.current),valid);assert.match(status,/超出/);
refresh();$('colSpan').edit(2);assert.equal($('colSpan').enter({isComposing:true}),false);
assert.equal(JSON.stringify(history.current),valid);
$('colSpan').enter();assert.equal(gridFor(history.current).places[selectedPanel].cs,2);
// Existing dedicated handlers remain intact; generic scalar properties submit once.
custom.enter();assert.equal(customCalls,1);
field.edit(18);field.enter();field.onchange();assert.equal(gapCalls,1);
field.edit(19);field.onchange();assert.equal(gapCalls,2);
// The reflow cache key belongs in the client cache, not in the strict API body.
const bridge=source.slice(source.indexOf('  async function ensureReflows('),source.indexOf('  async function ensureCurrentReflows('));
assert.ok(bridge.includes('JSON.stringify({recipe,rows,width,height})'));
assert.ok(!bridge.includes('JSON.stringify(spec)'));
console.log('Property commit regression passed: rows → span, direct Enter, change deduplication, undo/redo, invalid/IME inputs and legacy handlers.');
