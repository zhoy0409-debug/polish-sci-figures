/* Production axis handlers with deterministic async responses; not browser input QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const start=source.indexOf('  const categoricalAxisViews='),end=source.indexOf('  for(const id of Object.keys(axisInputMap))',start);
assert.ok(start>0&&end>start);const code=source.slice(start,end),copy=x=>JSON.parse(JSON.stringify(x));
function harness(){
  const nodes=new Map(),calls=[],installs=[],timers=[],current={order:['p'],panels:{p:{variant:1,statistics:{binding:'current',tableKey:'h',config:{method:'welch'},analysis:{p:.032}}}}};
  const rows=[['group','unit','value'],['Control','c1','-20'],['Treatment','t1','30']];
  const sourcePanel={name:'Negative observations',recipe:{family:'gallery',parameters:{view:'compare_bar_points'},axis_settings:{y_min:-40}},table:{rows},variants:[{name:'compare_bar_points'},{name:'compare_bar_points',size:'wide'}],axis_controls:{supported:true,first_group_gap:true,x_range:false,y_range:true,reference_lines:['y'],defaults:{first_group_gap:.5}}};
  let selectedSource=sourcePanel;
  const c={copy,selectedPanel:'p',project:{id:'project'},dataSerial:4,dataDrafts:{},localEngine:{endpoint:'/api/render',token:'test-only'},StudioI18n:{language:'en'},T:x=>x,state:()=>current,panel:()=>selectedSource,variant:()=>sourcePanel.variants[1],$:id=>{if(!nodes.has(id))nodes.set(id,{value:'',validity:{valid:true},textContent:''});return nodes.get(id);},setTimeout:f=>(timers.push(f),timers.length),clearTimeout:()=>{},fetch:(url,options)=>new Promise(resolve=>calls.push({url,body:JSON.parse(options.body),resolve})),installAsset:(...args)=>installs.push(args)};
  vm.createContext(c);vm.runInContext(code,c);
  return {c,current,sourcePanel,rows,calls,installs,timers,setSource:value=>{selectedSource=value;}};
}
function resolve(call,ok=true){call.resolve({ok,json:async()=>ok?{panel:{variants:[{name:'compare_bar_points',size:'original'},{name:'compare_bar_points',size:'wide'}],recipe:{axis_settings:copy(call.body.axes)},table:{rows:copy(call.body.rows)}}}:{error:'Invalid axis bounds'}});}
async function tick(){for(let i=0;i<5;i++)await Promise.resolve();}
async function run(){
  const first=harness(),snapshot=JSON.stringify(first.rows),settings={first_group_gap:-.25,y_min:-40,y_max:60,reference_lines:[{axis:'y',value:0,style:'solid',width:.8,color:'#7b8797'}]};
  first.c.queueAxisSettings(settings);const waiting=first.c.applyAxisSettings();assert.equal(first.calls.length,1);assert.deepEqual(first.calls[0].body.rows,first.rows);assert.deepEqual(first.calls[0].body.axes,settings);assert.deepEqual(first.calls[0].body.statistics,{method:'welch'});resolve(first.calls[0]);await waiting;
  assert.equal(first.installs.length,1);const args=first.installs[0];assert.equal(args[0].name,first.sourcePanel.name);assert.equal(args[0].initialVariant,1);assert.equal(args[1],'p');assert.equal(args[4],true);assert.equal(args[5],true,'geometry update keeps valid linked statistics');assert.equal(JSON.stringify(first.rows),snapshot);
  for(const binding of ['external','results']){const h=harness();h.current.panels.p.statistics.binding=binding;h.c.queueAxisSettings({y_min:-40});const p=h.c.applyAxisSettings();assert.equal(h.calls[0].body.statistics,undefined);resolve(h.calls[0]);await p;assert.equal(h.installs[0][5],true);}
  for(const mutate of [h=>{h.c.project.id='other';},h=>{h.c.selectedPanel='other';},h=>{h.current.panels.p.locked=true;},h=>{delete h.current.panels.p;},h=>{h.setSource({...h.sourcePanel});},h=>{h.c.dataSerial++;h.c.dataDrafts.p=[['value'],['-99']];},h=>{h.current.panels.p.statistics.config.method='mannwhitney';}]){
    const h=harness();h.c.queueAxisSettings({y_min:-40});const p=h.c.applyAxisSettings();mutate(h);resolve(h.calls[0]);await p;assert.equal(h.installs.length,0,'obsolete request cannot replace new data, source, analysis, project or locked panel');
  }
  for(const mutate of [h=>{h.current.panels.p.locked=true;},h=>{h.c.dataDrafts.p=[['value'],['2']];},h=>{h.c.localEngine=null;}]){const h=harness();mutate(h);h.c.queueAxisSettings({y_min:-40});await h.c.applyAxisSettings();assert.equal(h.calls.length,0,'locked, draft or offline panel does not dispatch axis edits');}
  const rapid=harness();rapid.c.queueAxisSettings({y_min:-40});const p=rapid.c.applyAxisSettings();rapid.c.queueAxisSettings({y_min:-30,y_max:50});resolve(rapid.calls[0]);await p;await tick();assert.equal(rapid.installs.length,0);assert.equal(rapid.calls.length,2);assert.deepEqual(rapid.calls[1].body.axes,{y_min:-30,y_max:50});resolve(rapid.calls[1]);await tick();assert.equal(rapid.installs.length,1);assert.deepEqual(rapid.installs[0][0].recipe.axis_settings,{y_min:-30,y_max:50},'two quick changes install only the most recent geometry');
  const failed=harness();failed.c.queueAxisSettings({y_min:100});const fp=failed.c.applyAxisSettings();resolve(failed.calls[0],false);await fp;assert.equal(failed.installs.length,0);assert.equal(failed.c.$('axisControlStatus').textContent,'Invalid axis bounds');failed.c.queueAxisSettings({});const retry=failed.c.applyAxisSettings();resolve(failed.calls[1]);await retry;assert.equal(failed.installs.length,1,'failure releases the busy flag for retry/reset');
  const controls=harness();controls.c.$('firstGroupGap').value='-0.25';controls.c.$('axisYMin').value='-40';controls.c.$('axisYMax').value='60';let parsed=controls.c.axisSettingsFromControls();assert.equal(parsed.first_group_gap,-.25);assert.equal(parsed.y_min,-40);assert.equal(parsed.y_max,60);controls.c.$('axisYMin').value='';parsed=controls.c.axisSettingsFromControls();assert.equal(parsed.y_min,undefined,'blank field restores automatic axis extent');controls.c.$('axisYMin').value='80';assert.throws(()=>controls.c.axisSettingsFromControls());controls.c.$('axisYMin').value='-Infinity';assert.throws(()=>controls.c.axisSettingsFromControls());
  console.log('PASS actual axis queue/apply handlers: immutable source rows, current/external analyses, draft/lock/source/project/analysis guards, latest request wins, retry/reset, negative input and automatic bounds.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
