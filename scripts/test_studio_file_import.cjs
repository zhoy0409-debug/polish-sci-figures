'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),source=fs.readFileSync(path.join(base,'studio.js'),'utf8'),helpers=require(path.join(base,'studio.js'));
const copy=value=>JSON.parse(JSON.stringify(value)),svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 80"><text x="4" y="18">Editable</text></svg>';
const file=(name,body=svg)=>({name,type:name.endsWith('.svg')?'image/svg+xml':'text/csv',size:body.length,text:async()=>body});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(test){for(let i=0;i<80;i++){if(test())return;await tick();}throw Error('Expected import checkpoint did not arrive');}
function fixture(){
  const dom=new JSDOM(fs.readFileSync(path.join(base,'studio.html'),'utf8'),{url:'http://localhost/'}),w=dom.window,d=w.document;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){if(!this.open)return;this.open=false;queueMicrotask(()=>this.dispatchEvent(new w.Event('close')));};
  const project=helpers.createBlankProject('1'.repeat(20),'Import test'),history=new helpers.History(project.initialState),messages=[],panes=[],staged=[],requests=[],timers=new Map();let timerSerial=0;
  const ctx={...helpers,copy,project,history,selectedPanel:'panel-0',selected:[],elementSelections:[],selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,panelSelection:[],layoutMode:true,boxSelect:true,contentSelection:'panel-0',original:true,dragging:null,
    document:d,window:w,FileReader:w.FileReader,Image:w.Image,XMLSerializer:w.XMLSerializer,NS:'http://www.w3.org/2000/svg',dataSerial:0,dataBusy:false,dataTimer:null,setTimeout:fn=>{timers.set(++timerSerial,fn);return timerSerial;},clearTimeout:id=>timers.delete(id),refreshDataExport(){},persist(){},paintDataValidation:()=>({valid:true}),
    $:id=>d.getElementById(id),T:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[+i]),say:text=>messages.push(text),guard:fn=>(...args)=>Promise.resolve().then(()=>fn(...args)).catch(error=>messages.push(error.message)),
    localEngine:{endpoint:'/api/reflow',pdfEndpoint:'/api/import-pdf',token:'synthetic'},dataDrafts:{},StudioI18n:{language:'zh-CN',preserveDisplayNames(){}},captureProfile:()=>ctx.state().order.map(()=>null),StudioGalleryContracts:{compare:{required:['group','value'],'zh-CN':['Compare','Independent groups']}},templateCache:new Map(),templateStarters:{compare:{recipe:{family:'gallery',parameters:{view:'compare'}},rows:[['group','value'],['A','1']]}},chartName:name=>name,
    state:()=>ctx.history.current,panel:id=>ctx.project.panels.find(p=>p.id===id),variant:id=>ctx.panel(id).variants[ctx.state().panels[id].variant],validateProject(){},matchSizes:s=>s,commit:next=>ctx.history.commit(next),prepareTouchEditing(){},showPane:name=>panes.push(name),renderCanvas(){},
    sanitize:text=>new w.DOMParser().parseFromString(text,'image/svg+xml').documentElement,validateSvgImportFeatures:async()=>{},classifySvgContent:()=>({kind:'text-vector'}),showImportedContentNotice(){},svgContentSummary:()=>'',
    button(text,handler){const b=d.createElement('button');b.textContent=text;b.onclick=handler;return b;},
    stageDataText(text,delimiter){assert.equal(ctx.layoutMode,false);assert.equal(ctx.boxSelect,false);assert.equal(ctx.selected.length,0);assert.equal(ctx.elementSelections.length,0);const rows=helpers.parseDelimited(text,delimiter,true);staged.push({id:ctx.selectedPanel,rows});ctx.dataDrafts[ctx.selectedPanel]=rows;},
    engineFetch:async(url,options)=>{const body=JSON.parse(options.body);requests.push(body);if(body.action==='inspect')return {ok:true,json:async()=>({pdf:{pageCount:1}})};if(body.action==='page')return {ok:true,json:async()=>({pdf:{svg,widthPt:100,heightPt:80,pageCount:1,pageIndex:0,editable:{texts:1,paths:0,images:0},warnings:[]}})};return {ok:true,json:async()=>({panel:{name:'Data',recipe:body.recipe,table:{rows:body.rows},analysis:{},variants:[{name:'compare',svg,width:100,height:80,viewBox:[0,0,100,80]}]}})};}
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(source.indexOf('  let imageDestination=null;'),source.indexOf('  let facetSplitRequest=')),ctx);
  vm.runInContext(source.slice(source.indexOf('  function installAsset('),source.indexOf('  let insertionCell=')),ctx);
  vm.runInContext(source.slice(source.indexOf('  async function recomputeData('),source.indexOf("  $('addDataRow').onclick=")),ctx);
  return {ctx,w,d,messages,panes,staged,requests,timers,close:()=>w.close()};
}
let count=0;
async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{
await test('batch SVG replaces only blank placeholder, appends rows in one undo per file, and exits arrange mode',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('one.svg'),file('two.svg'),file('three.svg')]);
 assert.equal(c.state().order.length,3);assert.equal(c.state().grid.rows,3);assert.equal(c.history.states.length,4);assert.equal(c.layoutMode,false);assert.equal(c.boxSelect,false);assert.equal(c.contentSelection,null);assert.equal(f.d.getElementById('scope').value,'panel');
 assert.deepEqual(c.state().order.map(id=>c.panel(id).name),['one.svg','two.svg','three.svg']);
 c.history.undo();assert.equal(c.state().order.length,2);assert.equal(c.state().grid.rows,2);c.history.redo();assert.equal(c.state().order.length,3);f.close();
});
await test('drop on an occupied cell adds a new panel while an explicit replace affects only the first file',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('original.svg')]);const original=c.selectedPanel;
 const event=new f.w.Event('drop',{bubbles:true,cancelable:true});Object.defineProperty(event,'dataTransfer',{value:{types:['Files'],files:[file('dropped.svg')]}});
 c.droppedFiles(event,{row:0,col:0},original);event.dataTransfer.files=[];await until(()=>c.state().order.length===2);await tick();assert.equal(c.panel(original).name,'original.svg');assert.ok(c.state().order.includes(original));
 await c.importFiles([file('replace.svg'),file('append.svg')],{oldId:original,projectId:c.project.id,history:c.history});assert.equal(c.state().order.length,3);assert.ok(!c.state().order.includes(original));assert.ok(event.defaultPrevented);f.close();
});
await test('an empty-cell drop fills forward and preserves existing panel positions',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('existing.svg')]);const first=c.selectedPanel,next=copy(c.state());next.columns=3;next.grid.rows=2;c.history.commit(next);
 await c.importFiles([file('a.svg'),file('b.svg')],{cell:{row:0,col:1}});
 const ids=c.state().order;assert.deepEqual(copy(c.state().grid.places[first]),{row:0,col:0,rs:1,cs:1});assert.equal(c.state().grid.places[ids[1]].col,1);assert.equal(c.state().grid.places[ids[2]].col,2);f.close();
});
await test('unsupported/oversized files report failures and do not stop later valid files',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('bad.exe'),{...file('large.svg'),size:20000001},file('ok.svg')]);assert.deepEqual(c.state().order.map(id=>c.panel(id).name),['ok.svg']);assert.match(f.messages.at(-1),/bad.exe/);assert.match(f.messages.at(-1),/large.svg/);f.close();
});
await test('reopening the same project ID during asynchronous decode cannot mutate the new history',async()=>{
 const f=fixture(),c=f.ctx;let release;const pending=c.importFiles([{...file('late.svg'),text:()=>new Promise(resolve=>release=resolve)}]);await until(()=>release);
 c.history=new helpers.History(c.project.initialState);release(svg);await pending;assert.equal(c.state().order[0],'panel-0');assert.equal(c.history.states.length,1);f.close();
});
await test('PDF queue waits for Apply/Close; cancel remaining files does not install stale pages',async()=>{
 const f=fixture(),c=f.ctx,pdf=new f.w.File(['%PDF-synthetic'],'one.pdf',{type:'application/pdf'}),pending=c.importFiles([pdf,file('next.svg')]);
 await until(()=>!f.d.getElementById('applyPdfImport').disabled);assert.equal(c.state().order[0],'panel-0');await f.d.getElementById('applyPdfImport').onclick();await pending;assert.equal(c.state().order.length,2);assert.equal(c.panel(c.state().order[0]).name,'one.pdf');
 const pending2=c.importFiles([pdf,file('never.svg')]);await until(()=>f.d.getElementById('pdfImportDialog').open);c.cancelFileImport();await pending2;assert.equal(c.state().order.length,2);assert.ok(!c.project.panels.some(p=>p.name==='never.svg'));f.close();
});
await test('CSV without a template opens an explicit chooser and generates from user rows without installing sample data',async()=>{
 const f=fixture(),c=f.ctx,pending=c.importFiles([file('study.csv','group,value\nA,12\nB,18')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);
 assert.equal(c.history.states.length,1);assert.match(f.d.getElementById('fileDataTemplateHint').textContent,/group, value/);assert.equal(f.d.querySelector('#fileDataTemplate optgroup').label,'列名匹配的模板');await f.d.getElementById('applyFileDataImport').onclick();await pending;
 assert.equal(c.state().order.length,1);assert.deepEqual(copy(c.panel(c.selectedPanel).table.rows),[['group','value'],['A','12'],['B','18']]);assert.equal(c.history.states.length,2);assert.equal(f.requests[0].rows[1][1],'12');f.close();
});
await test('CSV targeting existing data waits for Apply and routes through production data-editor staging',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('chart.svg')]);c.panel(c.selectedPanel).table={rows:[['group','value'],['A','1']]};c.panel(c.selectedPanel).recipe={family:'gallery'};
 c.layoutMode=true;c.boxSelect=true;c.selected=['stale-text'];c.elementSelections=[{panelId:'other',key:'e1'}];
 const pending=c.importFiles([file('replacement.csv','group,value\nA,22')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);assert.equal(f.staged.length,0);await f.d.getElementById('applyFileDataImport').onclick();await pending;assert.equal(f.staged.length,1);assert.equal(f.staged[0].rows[1][1],'22');assert.equal(c.state().order.length,1);assert.equal(f.panes.at(-1),'data');f.close();
});
await test('consecutive CSV files cannot silently overwrite an unapplied draft',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('chart.svg')]);c.panel(c.selectedPanel).table={rows:[['group','value'],['A','1']]};c.panel(c.selectedPanel).recipe={family:'gallery'};
 const pending=c.importFiles([file('first.csv','group,value\nA,22'),file('second.csv','group,value\nA,33')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);await f.d.getElementById('applyFileDataImport').onclick();await until(()=>f.d.querySelector('#fileDataImportDialog h2')?.textContent.includes('second.csv'));
 assert.equal(f.d.getElementById('fileDataDraftNotice').hidden,false);await f.d.getElementById('applyFileDataImport').onclick();assert.equal(f.staged.length,1);assert.match(f.d.querySelector('#fileDataImportDialog [role=status]').textContent,/请先确认/);f.d.getElementById('replaceFileDataDraft').checked=true;await f.d.getElementById('applyFileDataImport').onclick();await pending;assert.equal(f.staged.length,2);assert.equal(c.dataDrafts[c.selectedPanel][1][1],'33');f.close();
});
await test('unmatched templates stay available with their own required columns and study description',async()=>{
 const f=fixture(),c=f.ctx;c.templateStarters.paired={recipe:{family:'gallery',parameters:{view:'paired'}},rows:[['unit','before','after'],['A','1','2']]};c.StudioGalleryContracts.paired={required:['unit','before','after'],'zh-CN':['Paired','Same subjects before and after']};const pending=c.importFiles([file('study.csv','group,value\nA,12')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);
 const picker=f.d.getElementById('fileDataTemplate');assert.equal(picker.value,'compare');assert.equal(picker.querySelectorAll('optgroup').length,2);picker.value='paired';picker.onchange();assert.match(f.d.getElementById('fileDataTemplateHint').textContent,/unit, before, after.*Same subjects/);c.cancelFileImport();await pending;f.close();
});
await test('no matching headers require an explicit template choice; editing headers refreshes groups without switching the choice',async()=>{
 const f=fixture(),c=f.ctx;c.StudioGalleryContracts.compare.required=['unit','group','value'];c.templateStarters.above={recipe:{family:'gallery',parameters:{view:'above'}},rows:[['group','value','p','method'],['A','1','.05','supplied']]};c.StudioGalleryContracts.above={required:['group','value','p','method']};const pending=c.importFiles([file('study.csv','group,value\nA,12')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);
 const picker=f.d.getElementById('fileDataTemplate'),apply=f.d.getElementById('applyFileDataImport'),input=f.d.getElementById('fileDataText');assert.equal(picker.value,'');assert.equal(picker.selectedOptions[0].disabled,true);assert.equal(apply.disabled,true);assert.match(f.d.getElementById('fileDataTemplateMatch').textContent,/未找到列名完全匹配/);await apply.onclick();assert.equal(f.requests.length,0,'no alphabetical statistical template is sent automatically');
 picker.value='compare';picker.onchange();assert.equal(apply.disabled,false);assert.match(f.d.getElementById('fileDataTemplateHint').textContent,/unit, group, value/);
 input.value='group,value,p,method\nA,12,.05,supplied';input.oninput();for(const [id,fn]of [...f.timers]){f.timers.delete(id);await fn();}assert.equal(picker.value,'compare','typing never switches the chosen study design');assert.equal(picker.querySelector('optgroup').label,'列名匹配的模板');assert.equal(picker.querySelector('optgroup option').value,'above');assert.equal(picker.selectedOptions[0].parentElement.label,'其他模板');c.cancelFileImport();await pending;f.close();
});
await test('cancelling CSV while local generation runs discards the late result',async()=>{
 const f=fixture(),c=f.ctx;let release;c.engineFetch=()=>new Promise(resolve=>release=resolve);const pending=c.importFiles([file('cancel.csv','group,value\nA,12')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);const applying=f.d.getElementById('applyFileDataImport').onclick();await until(()=>release);c.cancelFileImport();await pending;
 release({ok:true,json:async()=>({panel:{}})});await applying;assert.equal(c.history.states.length,1);f.close();
});
await test('the import queue invalidates an already-running data response and resumes Auto only after closing',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('chart.svg')]);const id=c.selectedPanel;c.panel(id).table={rows:[['group','value'],['A','1']]};c.panel(id).recipe={family:'gallery'};c.dataDrafts[id]=[['group','value'],['A','2']];f.d.getElementById('dataAutoUpdate').checked=true;
 let release,requests=0;c.engineFetch=()=>{requests++;return new Promise(resolve=>release=resolve);};const before=c.history.states.length,oldSerial=c.dataSerial,inflight=c.recomputeData();await until(()=>release);
 const pending=c.importFiles([file('new.csv','group,value\nA,12')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);assert.equal(c.dataSerial,oldSerial+1);await c.recomputeData();assert.equal(requests,1,'queue does not start another recompute');release({ok:true,json:async()=>({panel:{variants:[]},seconds:1})});await inflight;assert.equal(c.history.states.length,before,'old response cannot replace the destination panel');
 for(const fn of [...f.timers.values()])await fn();assert.equal(requests,1,'retry during chooser is held');c.cancelFileImport();await pending;assert.equal(f.d.getElementById('dataAutoUpdate').checked,true);assert.equal(c.dataDrafts[id][1][1],'2');assert.equal(f.timers.size,1,'one recompute is resumed after closing');f.close();
});
await test('mixed CSV and SVG imports recompute every pending Auto target without changing the final canvas selection',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('first.svg'),file('second.svg')]);const [first,second]=c.state().order;
 for(const id of [first,second]){c.panel(id).table={rows:[['group','value'],['A','1']]};c.panel(id).recipe={family:'gallery',parameters:{view:'compare'}};}
 c.dataDrafts[second]=[['group','value'],['A','8']];c.dataValidationTimer=null;c.dataPage=0;c.renderDataEditor=()=>{};
 vm.runInContext(source.split('\n').filter(line=>line.startsWith('  function editData(')||line.startsWith('  function stageDataText(')).join('\n'),c);
 const pending=c.importFiles([file('replacement.csv','group,value\nA,22'),file('next.svg')],{dataPanelId:first});await until(()=>f.d.getElementById('fileDataImportDialog')?.open);await f.d.getElementById('applyFileDataImport').onclick();await pending;
 const final=c.selectedPanel;c.selected=['e1'];c.elementSelections=[{id:final,vi:0,keys:['e1']}];c.panelSelection=[final];assert.equal(c.panel(final).name,'next.svg');
 for(let step=0;f.timers.size&&step<20;step++){const [id,fn]=f.timers.entries().next().value;f.timers.delete(id);await fn();}
 assert.equal(f.requests.length,2);assert.deepEqual(f.requests.map(r=>r.rows[1][1]),['22','8']);assert.equal(c.selectedPanel,final);assert.deepEqual(c.selected,['e1']);assert.deepEqual(copy(c.elementSelections),[{id:final,vi:0,keys:['e1']}]);assert.deepEqual(c.panelSelection,[final]);
 assert.equal(c.dataDrafts[first],undefined);assert.equal(c.dataDrafts[second],undefined);assert.equal(c.panel(c.state().order[0]).table.rows[1][1],'22');assert.equal(c.panel(c.state().order[1]).table.rows[1][1],'8');assert.equal(f.timers.size,0);helpers.validateState(c.state(),c.project);f.close();
});
await test('Auto off retains the exact imported draft and explicitly reports that the chart still needs updating',async()=>{
 const f=fixture(),c=f.ctx;await c.importFiles([file('chart.svg')]);const id=c.selectedPanel;c.panel(id).table={rows:[['group','value'],['A','1']]};c.panel(id).recipe={family:'gallery',parameters:{view:'compare'}};f.d.getElementById('dataAutoUpdate').checked=false;
 const pending=c.importFiles([file('replacement.csv','group,value\nA,22'),file('next.svg')]);await until(()=>f.d.getElementById('fileDataImportDialog')?.open);await f.d.getElementById('applyFileDataImport').onclick();await pending;
 for(const [timer,fn]of [...f.timers]){f.timers.delete(timer);await fn();}assert.equal(f.requests.length,0);assert.equal(c.dataDrafts[id][1][1],'22');assert.equal(c.panel(id).table.rows[1][1],'1');assert.match(f.messages.at(-1),/1 张小图的数据尚未更新/);assert.match(f.d.getElementById('importQueueStatus').textContent,/更新图形/);f.close();
});
await test('background data responses cannot consume a newer draft or mutate a reopened history',async()=>{
 for(const change of ['draft','history']){
  const f=fixture(),c=f.ctx;await c.importFiles([file('chart.svg')]);const id=c.selectedPanel;c.panel(id).table={rows:[['group','value'],['A','1']]};c.panel(id).recipe={family:'gallery',parameters:{view:'compare'}};c.dataDrafts[id]=[['group','value'],['A','22']];
  let release;c.engineFetch=()=>new Promise(resolve=>release=resolve);const pending=c.recomputeData({id,background:true});await until(()=>release);const before=c.history.index;
  if(change==='draft')c.dataDrafts[id]=[['group','value'],['A','33']];else c.history=new helpers.History(copy(c.state()));
  release({ok:true,json:async()=>({panel:{variants:[{name:'compare',svg,width:100,height:80,viewBox:[0,0,100,80]}]},seconds:1})});await pending;assert.equal(c.panel(id).table.rows[1][1],'1');assert.equal(c.dataDrafts[id][1][1],change==='draft'?'33':'22');assert.equal(c.history.index,change==='history'?0:before);f.close();
 }
});
console.log(`PASS ${count} file import DOM integrations; no native file picker or real PDF engine is simulated as tested.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
