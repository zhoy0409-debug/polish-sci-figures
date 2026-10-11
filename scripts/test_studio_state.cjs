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
const fs=require('node:fs');
const i18n=require('../skills/polish-sci-figures/assets/figure-studio/i18n.js');
assert.equal(i18n.choose(null,'zh-TW'),'zh-CN');
assert.equal(i18n.choose(null,'fr-FR'),'en');
assert.equal(i18n.choose('en','zh-CN'),'en');
i18n.setLanguage('en');assert.equal(i18n.t('行数'),'Rows');
assert.equal(i18n.t('已保存命名版本「{0}」','我的中文版本'),'Saved version “我的中文版本”');
assert.equal(i18n.t('unknown-family'),'unknown-family');
i18n.setLanguage('zh-CN');assert.equal(i18n.t('已选 {0} 个元素',3),'已选 3 个元素');
const js=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8');
for(const match of js.matchAll(/'([^'\r\n]*[\u4e00-\u9fff][^'\r\n]*)'/g))assert.ok(Object.hasOwn(i18n.en,match[1]),'Missing English message: '+match[1]);
const html=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.html','utf8');
for(const match of html.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)){const key=match[1].trim();if(key!=='中文')assert.ok(Object.hasOwn(i18n.en,key),'Missing static English text: '+key);}
console.log('Bilingual catalog coverage, locale selection and user-text preservation passed');
const restored=History.restore(JSON.parse(JSON.stringify(timeline)),multi,timeline.current);
restored.undo();assert.deepEqual(restored.current,five);restored.redo();assert.deepEqual(restored.current,large);
const pendingRedo=new History(five);pendingRedo.commit(large);pendingRedo.undo();
const reopened=History.restore(JSON.parse(JSON.stringify(pendingRedo)),multi,five);reopened.redo();assert.deepEqual(reopened.current,large);
assert.throws(()=>History.restore({states:[large],index:0},multi,five),/不一致/);
assert.throws(()=>History.restore({states:[five],index:5},multi,five),/无效/);
const Preferences=require('../skills/polish-sci-figures/assets/figure-studio/memory.js');
const prefs=new Preferences(),palette=JSON.stringify(['#4477aa','#ee7733']);
const features={palette:[palette,palette],typography:[JSON.stringify(['Arial',12])],chart:['raincloud'],canvas:['portrait'],layout:[JSON.stringify([2,2,[[1,1],[1,1]]])]};
assert.equal(prefs.record(Preferences.fingerprint('project-a-state-1'),features),true);
assert.equal(prefs.record(Preferences.fingerprint('project-a-state-1'),features),false);
assert.deepEqual(prefs.top('palette'),[]);
prefs.record(Preferences.fingerprint('project-a-state-2'),features);
assert.deepEqual(prefs.top('palette'),[[palette,2]]);
prefs.enabled=false;assert.equal(prefs.record(Preferences.fingerprint('project-b'),features),false);
const remembered=new Preferences(JSON.parse(JSON.stringify(prefs)));assert.equal(remembered.enabled,false);assert.deepEqual(remembered.top('chart'),[['raincloud',2]]);
assert.equal(Preferences.valid('chart','<script>bad</script>'),false);
assert.equal(Preferences.valid('typography',JSON.stringify(['unknown',900])),false);
assert.equal(Preferences.valid('palette',JSON.stringify(['url(https://bad.test)'])),false);
remembered.clear();assert.deepEqual(remembered.top('palette'),[]);assert.equal(remembered.seen.length,0);
assert.equal(JSON.stringify(prefs).includes('svg'),false);
console.log('Persistent undo/redo, preference deduplication, pause, restore and clear passed');

const discovery=require('../skills/polish-sci-figures/assets/figure-studio/discovery.js');
assert.ok(Object.keys(discovery).length>=30);
for(const [stem,entry]of Object.entries(discovery)){
 assert.match(stem,/^[a-z0-9_]+$/);
 for(const lang of ['zh-CN','en']){assert.equal(entry[lang].length,3);for(const text of entry[lang])assert.ok(typeof text==='string'&&text.trim().length>0);}
}
console.log('Candidate discovery bilingual metadata passed');

const {resizePanel}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const eight={order:Array.from({length:8},(_,i)=>'p'+i),columns:3,gap:12,panels:Object.fromEntries(Array.from({length:8},(_,i)=>['p'+i,{variant:0,edits:{}}]))};
const eightProject={panels:eight.order.map(id=>({id,variants:[{}]}))};
const gridEight=arrange(eight,3,3),wideEight=resizePanel(gridEight,'p7',1,2);
validateState(wideEight,eightProject);assert.equal(wideEight.grid.places.p7.cs,2);
for(const id of eight.order.slice(0,7))assert.deepEqual(wideEight.grid.places[id],gridEight.grid.places[id]);
assert.throws(()=>resizePanel(gridEight,'p7',1,3),/不足/);
const four=clone(eight);four.order=four.order.slice(0,4);for(const key of Object.keys(four.panels))if(!four.order.includes(key))delete four.panels[key];
const whole=resizePanel(arrange(four,3,3),'p3',1,3);assert.deepEqual(whole.grid.places.p3,{row:1,col:0,rs:1,cs:3});
validateState(whole,{panels:four.order.map(id=>({id,variants:[{}]}))});
const resizeHistory=new History(gridEight);resizeHistory.commit(wideEight);resizeHistory.undo();assert.deepEqual(resizeHistory.current,gridEight);
console.log('Eight panels in 3x3, full-row panel, capacity rejection and resize undo passed');

const rich=clone(initial);rich.panels['panel-0'].label={text:'A',x:2,y:5,size:12,font:'Arial',bold:true};
rich.panels['panel-0'].scales={0:{e4:{calibration:1000,length:100,thickness:2,size:9,alpha:.7,position:'bl',font:'Arial',color:'#000000',bold:false,background:true}}};
rich.panels['panel-0'].locked=true;rich.panels['panel-0'].lockedElements={0:['e4']};rich.panels['panel-0'].elementGroups={0:[['e4','e5']]};validateState(rich,project);
const badScale=clone(rich);badScale.panels['panel-0'].scales[0].e4.calibration=0;assert.throws(()=>validateState(badScale,project));
const badLabel=clone(rich);badLabel.panels['panel-0'].label.x=101;assert.throws(()=>validateState(badLabel,project));
const richHistory=new History(initial);richHistory.commit(rich);const richRestored=History.restore(JSON.parse(JSON.stringify(richHistory)),project,rich);assert.deepEqual(richRestored.current,rich);
assert.throws(()=>resizePanel(rich,'panel-0',1,1),/锁定/);
assert.ok(!js.includes('[data-key=")'));
console.log('Labels, calibrated scales, locks and persistent feature state passed');

const {comparisonLetters}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
assert.deepEqual(comparisonLetters(3,[{a:0,b:1,p:.1},{a:1,b:2,p:.1},{a:0,b:2,p:.01}]),['a','ab','b']);
assert.throws(()=>comparisonLetters(3,[{a:0,b:1,p:.1}]),/完整/);
assert.deepEqual(comparisonLetters(2,[{a:0,b:1,p:.001}]),['a','b']);
console.log('Complete-comparison letter assignments and missing-result rejection passed');

const {methodOrder}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const methods={primary_test:{p_value:.5},sensitivity_test:{p_value:.001}};
assert.deepEqual(methodOrder(methods,'mean'),['primary_test','sensitivity_test']);
assert.deepEqual(methodOrder(methods,'distribution'),['sensitivity_test','primary_test']);
methods.primary_test.p_value=.0000001;assert.deepEqual(methodOrder(methods,'distribution'),['sensitivity_test','primary_test']);
console.log('Method recommendations follow target, never smallest P');

// Inserting tracks shifts downstream panels, preserves data and expands crossing spans.
const {insertTracks}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const insertedRows=insertTracks(gridEight,'row',1,3);
assert.equal(insertedRows.grid.rows,6);assert.equal(insertedRows.grid.places.p3.row,4);
assert.deepEqual(insertedRows.order,gridEight.order);assert.deepEqual(insertedRows.panels,gridEight.panels);
validateState(insertedRows,eightProject);
const insertedColumns=insertTracks(gridEight,'column',0,2);
assert.equal(insertedColumns.columns,5);assert.equal(insertedColumns.grid.places.p0.col,2);
validateState(insertedColumns,eightProject);
const crossing=insertTracks(wideEight,'column',2,2);
assert.equal(crossing.grid.places.p7.cs,4);validateState(crossing,eightProject);
const lockedGrid=clone(gridEight);lockedGrid.panels.p3.locked=true;
assert.throws(()=>insertTracks(lockedGrid,'row',1,2),/锁定/);
assert.throws(()=>insertTracks(gridEight,'column',1,4),/容量/);
assert.throws(()=>insertTracks(gridEight,'row',1,1.5),/容量/);
const insertHistory=new History(gridEight);insertHistory.commit(insertedRows);insertHistory.undo();assert.deepEqual(insertHistory.current,gridEight);
const fontState=clone(initial);fontState.panels['panel-0'].annotationFont={font:'Arial',size:14};validateState(fontState,project);
fontState.panels['panel-0'].annotationFont.size=0;assert.throws(()=>validateState(fontState,project));
console.log('Multi-track insertion, crossing spans, capacity, locks, undo and annotation font validation passed');

const fixedInsertion=insertTracks(gridEight,'column',1,2,{widths:[100,120,140],heights:[150,160,170]});
assert.deepEqual(fixedInsertion.grid.widths,[100,120,120,120,140]);validateState(fixedInsertion,eightProject);
console.log('Inserted tracks retain existing physical dimensions');

const {exportGeometry,pngWithDpi}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const sized=exportGeometry(720,360,{widthMm:180,dpi:600});
assert.equal(sized.heightMm,90);assert.equal(sized.widthPx,4252);assert.equal(sized.heightPx,2126);
assert.equal(exportGeometry(720,360).dpi,600);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4xQAAAAASUVORK5CYII=','base64');
const png600=Buffer.from(pngWithDpi(png,600)),pos=png600.indexOf(Buffer.from('pHYs'));
assert.ok(pos>0);assert.equal(png600.readUInt32BE(pos+4),23622);assert.equal(png600[pos+12],1);
const png1200=Buffer.from(pngWithDpi(png600,1200));assert.equal(png1200.length,png600.length);assert.equal(png1200.readUInt32BE(pos+4),47244);
console.log('Proportional publication sizing and real PNG DPI metadata passed');
