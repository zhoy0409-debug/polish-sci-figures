/* Independent physical X/Y panel gaps and the real immediate-preview controls. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const {History,validateState,gridFor,panelGaps,copyPanelGaps}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const copy=value=>JSON.parse(JSON.stringify(value)),range=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);};
const ids=['a','b','c','d'],assets=Object.fromEntries(ids.map(id=>[id,{id,table:{rows:[['group','value'],['Control','1'],['Treatment','2']]},analysis:{primary_test:{p_value:.032}},variants:[{width:320,height:240,svg:'unchanged artwork'}]}]));
const initial={order:ids,columns:2,gap:12,panels:Object.fromEntries(ids.map(id=>[id,{variant:0,edits:{}}]))},project={id:'gaps-test',panels:Object.values(assets),initialState:copy(initial)};
const ctx={gridFor,panel:id=>assets[id],annotationTopHeight:()=>0,annotationFirstTopHeight:()=>0,annotationHeight:()=>0,conditionMatrixHeight:()=>0,statisticalAnnotationInfo:()=>({placement:'plot'}),compactLayout:base=>base};
vm.createContext(ctx);vm.runInContext(range('  function layout(s=state(),skipCompact=false)','  function plotFrame('),ctx);
const baseline=ctx.layout(initial),evidence=JSON.stringify(assets);
assert.deepEqual(panelGaps(initial),{x:12,y:12});assert.equal(baseline.width,652);assert.equal(baseline.height,492);
for(const gap of [0,.5,6,24,100])for(const axis of ['X','Y']){
  const state={...copy(initial),['gap'+axis]:gap},layout=ctx.layout(state);validateState(state,project);
  assert.equal(layout[axis==='X'?'height':'width'],baseline[axis==='X'?'height':'width'],'Changing one direction retains the perpendicular physical dimension');
  for(const pos of layout.positions){const old=baseline.positions.find(other=>other.id===pos.id);assert.equal(pos.width,old.width);assert.equal(pos.height,old.height);assert.equal(pos[axis==='X'?'y':'x'],old[axis==='X'?'y':'x']);}
  const a=layout.positions[0],b=layout.positions[1],c=layout.positions[2];
  assert.equal(axis==='X'?b.x-a.x-a.width:c.y-a.y-a.height,gap,'The actual cell boundary gap equals the selected value');
}
const both={...copy(initial),gapX:0,gapY:37.5},bothLayout=ctx.layout(both);assert.deepEqual(panelGaps(both),{x:0,y:37.5});assert.equal(bothLayout.width,640);assert.equal(bothLayout.height,517.5);
// Spanning panels include only the crossed track's directional gaps.
const span={...copy(initial),gapX:25,gapY:7,order:['a','b','c'],grid:{rows:2,widths:[330,330],heights:[260,260],places:{a:{row:0,col:0,rs:1,cs:2},b:{row:1,col:0,rs:1,cs:1},c:{row:1,col:1,rs:1,cs:1}}}};delete span.panels.d;
const spanLayout=ctx.layout(span);assert.equal(spanLayout.positions[0].width,685);assert.equal(spanLayout.positions[1].y,267);assert.equal(spanLayout.height,527);
const vertical=copy(span);vertical.grid.places={a:{row:0,col:0,rs:2,cs:1},b:{row:0,col:1,rs:1,cs:1},c:{row:1,col:1,rs:1,cs:1}};
const verticalLayout=ctx.layout(vertical);assert.equal(verticalLayout.positions[0].height,527);assert.equal(verticalLayout.positions[1].x,355);
for(const key of ['gapX','gapY'])for(const value of [-1,100.1,NaN,Infinity,null,'12'])assert.throws(()=>validateState({...copy(initial),[key]:value},project),/工程布局无效/);
const presetTarget={gap:10,gapX:20,gapY:30,unrelated:'keep'};copyPanelGaps(presetTarget,{gap:8});assert.deepEqual(presetTarget,{gap:8,unrelated:'keep'},'Old presets remove stale directional overrides');
copyPanelGaps(presetTarget,{gap:12,gapX:0,gapY:32});assert.deepEqual(presetTarget,{gap:12,gapX:0,gapY:32,unrelated:'keep'});assert.match(range('  function pastePreset(',"  $('openLibrary').onclick="),/copyPanelGaps\(next,preset.sourceState\)/);

const controls=Object.fromEntries(['gap','gapSlider','gapY','gapYSlider','resetGap'].map(id=>[id,{value:'12'}])),history=new History(initial),frames=new Map(),draws=[],messages=[];let nextFrame=0,commits=0;
const ui={$:id=>controls[id],state:()=>history.current,project,copy,panelGaps,copyPanelGaps,T:value=>value,say:message=>messages.push(message),renderCanvas:(state=history.current)=>draws.push(copy(state)),requestAnimationFrame:callback=>{frames.set(++nextFrame,callback);return nextFrame;},cancelAnimationFrame:id=>frames.delete(id),commit:next=>{validateState(next,project);if(history.commit(next))commits++;ui.syncPanelGapControls();}};
vm.createContext(ui);vm.runInContext(range('  let panelGapPreview=',"  $('zoom').onchange="),ui);ui.syncPanelGapControls();
const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback());},key=(name,extras={})=>({key:name,preventDefault(){},...extras});
controls.gapSlider.onpointerdown();for(const value of [20,28,30]){controls.gapSlider.value=String(value);controls.gapSlider.oninput();}
assert.equal(frames.size,1);assert.equal(draws.length,0);assert.equal(commits,0);flush();assert.equal(draws.length,1);assert.deepEqual(panelGaps(draws[0]),{x:30,y:12});
controls.gapSlider.onchange();assert.equal(commits,1);assert.deepEqual(panelGaps(history.current),{x:30,y:12});assert.deepEqual(history.undo(),initial);history.redo();ui.syncPanelGapControls();
controls.gapY.value='3.5';controls.gapY.onkeydown(key('Enter'));assert.equal(commits,2);assert.deepEqual(panelGaps(history.current),{x:30,y:3.5});controls.gapY.onchange();assert.equal(commits,2,'Enter then blur is one history step');
// Repeated keyboard input is also a single gesture until keyup.
controls.gapYSlider.onkeydown(key('ArrowRight'));for(const value of [4,4.5,5]){controls.gapYSlider.value=String(value);controls.gapYSlider.oninput();controls.gapYSlider.onchange();}assert.equal(commits,2);controls.gapYSlider.onkeyup(key('ArrowRight'));assert.equal(commits,3);assert.equal(history.current.gapY,5);assert.equal(frames.size,0);
for(const value of ['', '-1','101','NaN']){controls.gap.value=value;controls.gap.onkeydown(key('Enter'));assert.equal(commits,3);assert.equal(panelGaps(history.current).x,30);}assert.equal(messages.length,4);
controls.gap.value='40';controls.gap.onkeydown(key('Enter',{isComposing:true}));assert.equal(commits,3,'IME composition does not submit');ui.syncPanelGapControls();
controls.gapSlider.value='50';controls.gapSlider.oninput();controls.gapSlider.onkeydown(key('Escape'));assert.equal(frames.size,0);assert.equal(commits,3);assert.equal(controls.gapSlider.value,30);
controls.gapYSlider.value='50';controls.gapYSlider.oninput();controls.gapYSlider.onpointercancel();assert.equal(commits,3);assert.equal(frames.size,0);assert.equal(controls.gapYSlider.value,5);
controls.gapSlider.value='60';controls.gapSlider.oninput();const elsewhere=copy(history.current);elsewhere.panels.a.locked=true;history.commit(elsewhere);controls.gapSlider.onchange();assert.equal(commits,3);assert.equal(history.current.gapX,30,'A stale preview cannot overwrite another edit');
controls.gapSlider.value='65';controls.gapSlider.oninput();ui.project={...project,id:'another-project'};controls.gapSlider.onchange();assert.equal(commits,3);assert.equal(frames.size,0);ui.project=project;
controls.resetGap.onclick();assert.equal(commits,4);assert.deepEqual(panelGaps(history.current),{x:12,y:12});assert.equal(history.current.gapX,undefined);assert.equal(history.current.panels.a.locked,true,'Resetting gaps preserves all chart settings');
history.undo();assert.deepEqual(panelGaps(history.current),{x:30,y:5});
project.initialState={...copy(initial),gapX:4,gapY:21};controls.resetGap.onclick();assert.deepEqual(panelGaps(history.current),{x:4,y:21},'Restore uses each direction of the actual initial project');
assert.equal(JSON.stringify(assets),evidence,'No geometry operation rewrites chart assets, source data or statistics');
const html=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.html'),'utf8');for(const id of ['gap','gapSlider','gapY','gapYSlider','resetGap'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
console.log('PASS: independent panel gaps; legacy state/presets, zero/decimal/bounds, physical X/Y isolation, spans, RAF preview, keyboard/Enter, one undo, cancellation and stale guards.');
