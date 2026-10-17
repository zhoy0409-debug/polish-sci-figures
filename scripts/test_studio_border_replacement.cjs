/* Production installAsset transaction without browser layout/renderer work. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editor=require('../skills/polish-sci-figures/assets/figure-studio/studio.js'),borders=require('../skills/polish-sci-figures/assets/figure-studio/object-borders.js');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8'),start=source.indexOf('  function installAsset('),end=source.indexOf("  $('importImage').onclick",start);assert.ok(start>0&&end>start);
const copy=value=>JSON.parse(JSON.stringify(value)),style={...borders.defaults};
function run(withBorders=true){
 const before={order:['panel-0','panel-5'],columns:2,gap:12,panels:{'panel-0':{variant:0,edits:{},label:{text:'A'}},'panel-5':{variant:0,edits:{}}},overlays:[{id:'annotation-1',locked:false}]};
 if(withBorders)before.objectBorders=[
  {target:{kind:'panel',panelId:'panel-0'},style},
  {target:{kind:'label',panelId:'panel-0'},style},
  {target:{kind:'element',panelId:'panel-0',variant:0,key:'e1'},style,sourceStamp:'original'},
  {target:{kind:'group',panelId:'panel-0',variant:0,keys:['e2','e3']},style,sourceStamp:'original'},
  {target:{kind:'panel',panelId:'panel-5'},style},
  {target:{kind:'overlay',id:'annotation-1'},style}];
 const snapshot=JSON.stringify(before),commits=[],context={copy,state:()=>before,project:{panels:[{id:'panel-0',variants:[]},{id:'panel-5',variants:[]}]},selectedPanel:'panel-0',selected:[],panelSelection:['panel-0'],elementSelections:[],templateCache:new Map(),StudioI18n:{language:'en'},T:value=>value,installPanelState:editor.installPanelState,validateProject:()=>{},validateState:()=>{},matchSizes:value=>value,commit:(next,label)=>{commits.push({next,label});return true;}};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);let adjusted=false;
 context.installAsset({initialVariant:0,name:'Replacement',variants:[]},'panel-0',null,'Updated',false,false,false,next=>{adjusted=true;next.qaSameTransaction=true;});
 assert.equal(commits.length,1);assert.equal(adjusted,true);assert.equal(commits[0].next.qaSameTransaction,true);assert.equal(JSON.stringify(before),snapshot,'replacement never mutates the previous history state');
 const id=context.selectedPanel;assert.equal(id,'panel-6');assert.equal(commits[0].next.order[0],id);
 if(withBorders){const records=commits[0].next.objectBorders;borders.validate(records);assert.equal(records.length,4);assert.equal(records.filter(r=>r.target.panelId===id).length,2);assert.ok(records.some(r=>r.target.panelId==='panel-5'));assert.ok(records.some(r=>r.target.kind==='overlay'));assert.ok(records.every(r=>!['element','group'].includes(r.target.kind)),'unverified element keys never migrate to new artwork');assert.match(commits[0].label,/2 element\/group border\(s\) reset/);}
 else assert.equal(commits[0].next.objectBorders,undefined,'old projects without decoration records remain compatible');
}
run(true);run(false);console.log('PASS replacement transaction: panel/label borders migrate; unverified element/group records reset with explicit notice; other panels/overlays, immutable history, optional axis state callback and old projects remain intact.');
