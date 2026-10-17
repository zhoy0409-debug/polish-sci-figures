/* Production discovery destination and asset transaction, using real History
 * and panel/grid state rules. Actual browser recommendation/render tests are
 * separate; these fixtures make no new scientific or image-accuracy claim. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../skills/polish-sci-figures/assets/figure-studio/studio.js'),source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
function extract(start,end){const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>=0&&b>a);return source.slice(a,b);}
const code=extract('  function applyDiscoveredAsset(','  function openFigureDiscovery(')+extract('  function installAsset(',"  $('importImage').onclick")+extract('  function availableFigureImportTarget(','  function cancelFileImport(');
function fixture({blank=false,columns=1,rows=1,count=1,span=1,locked=false,edited=false}={}){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text x="10" y="20">Original</text></svg>',panels=Array.from({length:count},(_,i)=>({id:'panel-'+i,name:'Original '+i,provenance:blank?'blank-canvas':'user-data',variants:[{name:'imported_svg',width:100,height:100,viewBox:[0,0,100,100],svg}],table:{rows:[['group','value'],['A',1.25]]},analysis:{}})),order=panels.map(p=>p.id),initial={order,columns,gap:12,grid:{rows,places:Object.fromEntries(order.map((id,i)=>[id,{row:Math.floor(i/columns),col:i%columns,rs:span,cs:1}]))},panels:Object.fromEntries(order.map(id=>[id,{variant:0,edits:edited?{0:{e0:{fill:'#176b5d'}}}:{},...(locked?{locked:true}:{})}]))};
  const project={id:'discovery-install-qa',panels,initialState:copy(initial)},history=new core.History(initial),ctx={...core,copy,project,history,state:()=>ctx.history.current,selectedPanel:'panel-0',selected:[],panelSelection:['panel-0'],elementSelections:[],templateCache:new Map(),editableSourceCache:null,compactLayoutCache:new WeakMap(),compactMetricCache:null,baseSvg(){},T:x=>x,StudioI18n:{language:'en'},panel:id=>ctx.project.panels.find(p=>p.id===id),validateProject(){if(ctx.rejectAsset)throw Error('Rejected asset');},matchSizes:x=>x,commit(next){if(ctx.rejectCommit)return false;ctx.history.commit(next);return true;},activateImportedFigure(){ctx.activations++;},activations:0};
  ctx.baseSvg.owner=project;ctx.baseSvg.bindings=new Map();vm.createContext(ctx);vm.runInContext(code,ctx);
  const asset={name:'Actual-data result fixture',variants:[{name:'grouped_points',width:100,height:100,viewBox:[0,0,100,100],svg:svg.replace('Original','Result')}],table:{rows:[['group','value'],['A',1.25],['B',2.5]]},analysis:{},discovery:{declarations:{design:'independent'},sourceRows:[['group','value'],['A',1.25],['B',2.5]],trace:['fixture']}};
  return {ctx,history,project,asset};
}
let passed=0;
function test(name,work){work();passed++;console.log('PASS '+name);}
for(const [name,options,expected]of [
  ['occupied full grid appends a row',{},{row:1,col:0,rs:1,cs:1}],
  ['occupied grid uses a real free cell',{columns:2},{row:0,col:1,rs:1,cs:1}],
  ['untouched blank canvas is replaced',{blank:true},{row:0,col:0,rs:1,cs:1}],
  ['edited blank canvas is retained',{blank:true,edited:true},{row:1,col:0,rs:1,cs:1}]
])test(name+' with one exact Undo/Redo',()=>{
  const f=fixture(options),beforeState=copy(f.history.current),beforeProject=copy(f.project),beforeAsset=copy(f.asset);f.ctx.applyDiscoveredAsset(f.asset);
  assert.equal(f.history.index,1);assert.equal(f.ctx.activations,1);assert.deepEqual(f.asset,beforeAsset,'Input candidate is not mutated');assert.deepEqual(copy(f.ctx.project.panels.slice(0,beforeProject.panels.length)),beforeProject.panels,'Original artwork, table and analysis retained');
  const result=copy(f.history.current),id=f.ctx.selectedPanel;assert.notEqual(id,'panel-0');assert.deepEqual(result.grid.places[id],expected);const replaces=options.blank&&!options.edited;assert.equal(result.order.length,replaces?1:2);if(!replaces)assert.deepEqual(result.panels['panel-0'],beforeState.panels['panel-0']);
  const installed=f.ctx.project.panels.find(p=>p.id===id);assert.equal(installed.provenance,'user-data');assert.deepEqual(copy(installed.table),beforeAsset.table);assert.deepEqual(copy(installed.discovery),beforeAsset.discovery);
  f.history.undo();assert.deepEqual(copy(f.history.current),beforeState);f.history.redo();assert.deepEqual(copy(f.history.current),result);
});
for(const [name,options,message]of [
  ['locked destination',{locked:true},/锁定/],
  ['panel capacity',{count:24,rows:24},/24/],
  ['row capacity without a free cell',{rows:24,span:24},/母版位置/]
])test(name+' fails atomically',()=>{const f=fixture(options),before=JSON.stringify(f.project),history=JSON.stringify(f.history.toJSON());assert.throws(()=>f.ctx.applyDiscoveredAsset(f.asset),message);assert.equal(f.ctx.project,f.project);assert.equal(JSON.stringify(f.project),before);assert.equal(JSON.stringify(f.history.toJSON()),history);assert.equal(f.ctx.activations,0);});
for(const flag of ['rejectAsset','rejectCommit'])test(flag+' restores owner, selection and history',()=>{const f=fixture(),before=JSON.stringify(f.project),history=JSON.stringify(f.history.toJSON());f.ctx[flag]=true;assert.throws(()=>f.ctx.applyDiscoveredAsset(f.asset));assert.equal(f.ctx.project,f.project);assert.equal(f.ctx.selectedPanel,'panel-0');assert.equal(JSON.stringify(f.project),before);assert.equal(JSON.stringify(f.history.toJSON()),history);assert.equal(f.ctx.activations,0);});
console.log('PASS '+passed+' discovery installation groups.');
