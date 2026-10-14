/* Panel removal: production state, history, list buttons and asynchronous guards. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const base='../skills/polish-sci-figures/assets/figure-studio/';
const api=require(base+'studio.js'),i18n=require(base+'i18n.js'),copy=x=>JSON.parse(JSON.stringify(x));
const source=fs.readFileSync(require.resolve(base+'studio.js'),'utf8');
const extract=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,start);return source.slice(a,b);};
let checks=0;const pass=name=>{checks++;console.log('PASS '+name);};
function fixture(count=3){
  const project=api.createBlankProject('0123456789abcdefabcd'),asset=project.panels[0];
  project.panels=Array.from({length:count},(_,i)=>({...copy(asset),id:'panel-'+i,name:'Synthetic '+i,name_i18n:undefined,provenance:'user-import',table:{rows:[['value'],[String(i+1)]]}}));
  const state={order:project.panels.map(p=>p.id),columns:count,gap:12,grid:{rows:1,widths:Array(count).fill(345.6),heights:[259.2],places:Object.fromEntries(project.panels.map((p,i)=>[p.id,{row:0,col:i,rs:1,cs:1}]))},panels:Object.fromEntries(project.panels.map(p=>[p.id,{variant:0,edits:{}}]))};
  project.initialState=copy(state);return {project,state};
}
const annotation=(id,extra={})=>({id,type:'text',x:.1,y:.1,w:.1,h:.1,text:'Keep user note',font:'Arial',size:9,stroke:1,color:'#ffffff',opacity:1,fill:false,bold:false,locked:false,...extra});
const inset=(id,panelId)=>annotation(id,{type:'inset',text:'',source:{panelId,variant:0,key:'e1',widthPx:1200,heightPx:800},roi:{x:.1,y:.1,w:.2,h:.2},connector:true,showScale:false});
const ref=id=>({panelId:id,variant:0,key:'e1'}),link=(id,parent,child)=>({id,parent,child,polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]});
{
  const {project,state}=fixture(),snapshot=JSON.stringify(state),original=JSON.stringify(project.panels);
  state.panelGroups=[['panel-0','panel-1','panel-2']];state.overlays=[annotation('annotation-1'),inset('annotation-2','panel-1'),inset('annotation-3','panel-2')];
  state.imageLinks=[link('links-1',ref('panel-0'),ref('panel-1')),link('links-2',ref('panel-1'),{insetId:'annotation-2'}),link('links-3',ref('panel-0'),{insetId:'annotation-3'})];
  const before=copy(state),next=api.removePanelState(state,'panel-1');api.validateState(next,project);
  assert.deepEqual(next.order,['panel-0','panel-2']);assert.equal(next.panels['panel-1'],undefined);assert.equal(next.grid.places['panel-1'],undefined);
  assert.deepEqual(next.grid.places['panel-2'],state.grid.places['panel-2']);assert.deepEqual(next.grid.widths,state.grid.widths);assert.deepEqual(next.panelGroups,[['panel-0','panel-2']]);
  assert.deepEqual(next.overlays.map(a=>a.id),['annotation-1','annotation-3']);assert.deepEqual(next.imageLinks.map(a=>a.id),['links-3']);assert.deepEqual(state,before);assert.equal(JSON.stringify(project.panels),original);
  const history=new api.History(state);history.commit(next);assert.equal(history.index,1);history.undo();assert.deepEqual(history.current,state);history.redo();assert.deepEqual(history.current,next);
  const restored=api.History.restore(JSON.parse(JSON.stringify(history.toJSON())),project,next);restored.undo();assert.deepEqual(restored.current,state);
  pass('removal preserves cells, source assets and unrelated overlays; owned insets/links are removed and restored by one undo, including saved history');
}
{
  const {project,state}=fixture(2);state.panelGroups=[['panel-0','panel-1']];const next=api.removePanelState(state,'panel-0');assert.deepEqual(next.panelGroups,[]);api.validateState(next,project);
  state.panels['panel-0'].locked=true;const before=JSON.stringify(state);assert.throws(()=>api.removePanelState(state,'panel-0'),/锁定/);assert.equal(JSON.stringify(state),before);assert.throws(()=>api.removePanelState(state,'panel-9'),/目标/);
  pass('singleton groups are dissolved; locked and missing panels cannot be removed');
}
{
  const {project,state}=fixture(1),blank={...copy(api.createBlankProject(project.id).panels[0]),id:'panel-1'};project.panels.push(blank);
  const next=api.removePanelState(state,'panel-0',blank.id);api.validateState(next,project);assert.deepEqual(next.order,['panel-1']);assert.deepEqual(next.grid.places['panel-1'],state.grid.places['panel-0']);
  const history=new api.History(state);history.commit(next);history.undo();assert.deepEqual(history.current,state);assert.equal(project.panels[0].table.rows[1][0],'1');
  pass('last-panel removal replaces it with a valid editable blank canvas and restores the original panel/data on undo');
}
if(!process.argv.includes('--dom')){console.log(`${checks} panel deletion groups passed; pass --dom for actual button/handler integration`);process.exit(0);}
const {JSDOM}=require('jsdom');
function harness(count=3){
  const setup=fixture(count),dom=new JSDOM('<div id="panels"></div><select id="scope"><option value="panel">Panel</option></select><dialog id="statisticsDialog"></dialog><input id="dataAutoUpdate" type="checkbox">'),doc=dom.window.document;
  let current=copy(setup.state);const history=new api.History(current),cleared=[],scheduled=[],messages=[];let renderCount=0,cancelled=0;
  const ctx={...api,copy,document:doc,NS:'http://www.w3.org/2000/svg',StudioI18n:i18n,T:i18n.t,$:id=>doc.getElementById(id),state:()=>current,project:setup.project,original:false,
    selectedPanel:'panel-0',selected:[],elementSelections:[],selectionAnchor:null,selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,panelSelection:[],dragging:null,layoutMode:false,
    dataDrafts:{'panel-0':[['value'],['manually typed']]},dataSerial:20,dataTimer:'data',dataValidationTimer:'validation',axisPending:null,axisRequest:1,axisTimer:'axis',statisticsSession:null,statisticsRequest:1,statisticsTimer:'stats',facetSplitRequest:4,
    panel:id=>ctx.project.panels.find(p=>p.id===id),say:x=>messages.push(x),guard:fn=>event=>fn(event),clearTimeout:id=>cleared.push(id),setTimeout:(fn,delay)=>{scheduled.push({fn,delay});return 99;},recomputeData(){},
    cancelPanelGesture:()=>cancelled++,cancelSelectionGesture:()=>cancelled++,cancelObjectGesture:()=>cancelled++,
    validateProject:p=>{assert.ok(p.panels.length);api.validateState(p.initialState,p);},
    layout:()=>({cells:setup.state.grid.widths.map((width,col)=>({row:0,col,width,height:259.2})),positions:setup.state.order.map((id,col)=>({id,width:345.6,height:259.2,x:col*357.6,y:0}))}),
    button:(text,fn)=>{const b=doc.createElement('button');b.textContent=text;b.onclick=fn;return b;},
    commit:(next,label,renderNow)=>{assert.equal(renderNow,false);api.validateState(next,ctx.project);history.commit(next);current=history.current;messages.push(label);return true;},
    render:()=>{renderCount++;ctx.renderPanelList();},renderCanvas:()=>{throw Error('Trash must not start a drag or select a panel');}
  };
  vm.createContext(ctx);vm.runInContext(extract('  function removePanel(id){','  function render() {'),ctx);ctx.renderPanelList();
  return {ctx,dom,doc,history,current:()=>current,cleared,scheduled,messages,renderCount:()=>renderCount,cancelled:()=>cancelled,close:()=>dom.window.close()};
}
i18n.setLanguage('en');
{
  const h=harness();let bubbled=0;h.doc.getElementById('panels').addEventListener('click',()=>bubbled++);h.doc.getElementById('panels').addEventListener('pointerdown',()=>bubbled++);
  const remove=h.doc.querySelector('[data-panel-id="panel-0"] .panel-delete'),draft=copy(h.ctx.dataDrafts['panel-0']);assert.match(remove.getAttribute('aria-label'),/^Delete panel/);assert.equal(remove.parentElement.querySelectorAll('button button').length,0);
  remove.dispatchEvent(new h.dom.window.Event('pointerdown',{bubbles:true}));const drag=new h.dom.window.Event('dragstart',{bubbles:true,cancelable:true});remove.dispatchEvent(drag);assert.ok(drag.defaultPrevented);remove.click();
  assert.equal(bubbled,0);assert.equal(h.history.index,1);assert.deepEqual(copy(h.current().order),['panel-1','panel-2']);assert.equal(h.ctx.selectedPanel,'panel-1');assert.equal(h.ctx.layoutMode,false);assert.equal(h.ctx.dataSerial,21);assert.equal(h.ctx.facetSplitRequest,5);assert.equal(h.cancelled(),3);assert.deepEqual(h.cleared,['data','validation']);assert.deepEqual(h.ctx.dataDrafts['panel-0'],draft);assert.equal(h.renderCount(),1);
  const activeDrafts=Object.keys(h.ctx.dataDrafts).filter(id=>h.current().order.includes(id));assert.equal(activeDrafts.length,0,'inactive draft cannot block export');h.history.undo();assert.deepEqual(h.history.current,h.ctx.project.initialState);assert.deepEqual(h.ctx.dataDrafts['panel-0'],draft);h.close();
  pass('actual trash pointer/click is isolated from selection/drag; one commit invalidates late jobs while preserving inactive drafts for undo');
}
{
  const h=harness(1),original=JSON.stringify(h.ctx.project.panels[0]);h.ctx.axisPending={id:'panel-0'};h.ctx.statisticsSession={id:'panel-0'};h.ctx.removePanel('panel-0');
  const blank=h.ctx.project.panels.at(-1);assert.equal(blank.provenance,'blank-canvas');assert.equal(h.ctx.project.panels.length,2);assert.deepEqual(copy(h.current().order),[blank.id]);assert.equal(JSON.stringify(h.ctx.project.panels[0]),original);assert.equal(h.ctx.axisPending,null);assert.equal(h.ctx.statisticsSession,null);assert.equal(h.ctx.axisRequest,2);assert.equal(h.ctx.statisticsRequest,2);assert.ok(h.cleared.includes('axis')&&h.cleared.includes('stats'));api.validateState(h.current(),h.ctx.project);
  const saved=JSON.parse(JSON.stringify({project:h.ctx.project,state:h.current(),history:h.history.toJSON(),dataDrafts:h.ctx.dataDrafts}));const restored=api.History.restore(saved.history,saved.project,saved.state);restored.undo();assert.deepEqual(restored.current,saved.project.initialState);assert.equal(saved.dataDrafts['panel-0'][1][0],'manually typed');h.close();
  pass('actual last-delete handler creates same-size blank asset, cancels matching analysis timers and saves recoverable original data/draft/history');
}
{
  const h=harness(2);h.current().panels['panel-0'].locked=true;h.ctx.renderPanelList();const remove=h.doc.querySelector('[data-panel-id="panel-0"] .panel-delete');assert.ok(remove.disabled);remove.click();h.ctx.removePanel('panel-0');assert.equal(h.history.index,0);assert.equal(h.ctx.dataSerial,20);assert.match(h.messages.at(-1),/locked|锁定/);h.close();
  pass('locked panel is disabled in the actual list and also rejected by the handler');
}
console.log(`${checks} panel deletion groups passed`);
