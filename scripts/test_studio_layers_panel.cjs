/* Production virtual list and host adapter: deterministic work budgets, not a
 * timing threshold that varies with the CI machine. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const layers=require('../skills/polish-sci-figures/assets/figure-studio/layers-panel.js');
const {selectionAlignmentPlan}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8');
const NS='http://www.w3.org/2000/svg';let passed=0;
const test=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
function fixture(count=20){
 const dom=new JSDOM('<input id="search"><div id="host"></div><button id="more">More</button>',{pretendToBeVisual:true}),doc=dom.window.document,svg=doc.createElementNS(NS,'svg');
 for(let i=0;i<count;i++){const node=doc.createElementNS(NS,i%2?'path':'text');node.dataset.key='e'+i;if(node.localName==='text')node.textContent='Label '+i;svg.append(node);}
 const calls=[],host=doc.getElementById('host'),search=doc.getElementById('search'),more=doc.getElementById('more');let language='zh';
 const translated={'图层显示栏':'Layers','文字 ':'Text ','图片':'Image','路径':'Path','显示更多':'Show more','显示元素':'Show object','隐藏元素':'Hide object','锁定元素':'Lock object','解锁元素':'Unlock object'};
 const ui=layers.create({host,search,more,t:zh=>language==='en'?(translated[zh]||zh):zh,choose:(...a)=>calls.push(['choose',...a]),visibility:(...a)=>calls.push(['visibility',...a]),lock:(...a)=>calls.push(['lock',...a])});
 const context={source:svg,key:'p/a/0',revision:{},selected:new Set(),edits:{},locked:new Set(),panelLocked:false,readonly:false};ui.update(context);
 return {dom,doc,svg,host,search,more,calls,ui,context,update:patch=>{Object.assign(context,patch);ui.update(context);},language:value=>language=value,close(){ui.destroy();dom.window.close();}};
}
test('large import builds one linear index and keeps selection work bounded to visible rows',()=>{const f=fixture(12000);try{
 const node=f.host.querySelector('[data-layer-key="e11999"]'),initial={...f.ui.stats},budget=Math.ceil(340/layers.ROW_HEIGHT)+layers.OVERSCAN*2;
 assert.equal(f.ui.stats.indexes,1);assert.equal(f.ui.stats.indexedRows,12000);assert.ok(f.ui.stats.createdRows<=budget);assert.equal(f.host.getAttribute('aria-rowcount'),'150');
 // A layer selection must not invoke any SVG parser, full selector, or index.
 f.svg.querySelectorAll=()=>{throw Error('Unexpected SVG traversal on selection');};f.doc.createTreeWalker=()=>{throw Error('Unexpected index rebuild on selection');};
 for(let i=0;i<250;i++)f.update({selected:new Set(['e'+(11999-i%15)])});
 assert.equal(f.ui.stats.indexes,initial.indexes);assert.equal(f.ui.stats.createdRows,initial.createdRows);assert.equal(f.host.querySelector('[data-layer-key="e11999"]'),node);assert.ok(f.host.querySelectorAll('.studio-layer-row').length<=budget);
 console.log(`BUDGET 12,000 objects: ${initial.indexes} index, ${initial.createdRows} mounted rows; 250 selections: 0 indexes, 0 new rows`);
 }finally{f.close();}});
test('definition/span subtrees and keyed containers are excluded; frozen wrappers retain editable leaves',()=>{const f=fixture(0);try{
 f.svg.innerHTML='<defs><path data-key="definition"/></defs><clipPath><rect data-key="clip"/></clipPath><mask><rect data-key="mask"/></mask><g data-key="group"><text data-key="text">A<tspan data-key="span">B</tspan></text><g data-layout-lock-compensate="a"><path data-key="locked"/></g></g><g data-key="empty"/><image data-key="image"/>';
 assert.deepEqual(layers.collect(f.svg).map(item=>item.key),['image','empty','locked','text']);assert.equal(layers.collect(f.svg).at(-1).node.textContent,'AB');
 }finally{f.close();}});
test('show more, scrolling and search stay virtual and do not lose the search field focus',()=>{const f=fixture(1000);try{
 f.more.click();assert.equal(f.host.getAttribute('aria-rowcount'),'300');f.host.scrollTop=280*layers.ROW_HEIGHT;f.host.dispatchEvent(new f.dom.window.Event('scroll'));f.ui.flush();assert.ok(f.host.querySelector('[data-layer-key="e719"]'));assert.ok(f.host.querySelectorAll('.studio-layer-row').length<=18);
 f.search.focus();f.search.value='Label 100';f.search.dispatchEvent(new f.dom.window.Event('input'));assert.equal(f.doc.activeElement,f.search);assert.equal(f.host.getAttribute('aria-rowcount'),'1');assert.ok(f.host.querySelector('[data-layer-key="e100"]'));assert.equal(f.more.hidden,true);assert.equal(f.host.scrollTop,0);
 f.search.value='missing';f.search.dispatchEvent(new f.dom.window.Event('input'));assert.equal(f.host.getAttribute('aria-rowcount'),'0');assert.equal(f.host.querySelector('.studio-layer-empty').hidden,false);assert.equal(f.ui.stats.indexes,1);
 }finally{f.close();}});
test('selection, hidden and locked tones and actions remain independent and accessible',()=>{const f=fixture(4);try{
 f.update({selected:new Set(['e2']),locked:new Set(['e2']),edits:{e1:{hidden:'true'}}});const locked=f.host.querySelector('[data-layer-key="e2"]'),hidden=f.host.querySelector('[data-layer-key="e1"]');
 assert.equal(locked.getAttribute('aria-selected'),'true');assert.ok(locked.classList.contains('is-locked'));assert.equal(locked.querySelector('[data-layer-action="visibility"]').disabled,true);assert.equal(locked.querySelector('[data-layer-action="lock"]').getAttribute('aria-label'),'解锁元素');assert.ok(hidden.classList.contains('is-hidden'));
 locked.querySelector('.layer-name').dispatchEvent(new f.dom.window.MouseEvent('click',{bubbles:true,shiftKey:true}));locked.querySelector('[data-layer-action="lock"]').click();hidden.querySelector('[data-layer-action="visibility"]').click();assert.deepEqual(f.calls,[['choose','e2',true],['lock','e2',false],['visibility','e1',false]]);
 f.update({readonly:true});assert.ok([...f.host.querySelectorAll('.layer-action')].every(button=>button.disabled));assert.equal(locked.querySelector('.layer-name').disabled,false,'original and locked artwork can still be inspected');
 f.language('en');f.update({readonly:false});assert.equal(locked.querySelector('[data-layer-action="lock"]').getAttribute('aria-label'),'Unlock object');assert.equal(f.host.getAttribute('aria-label'),'Layers');assert.match(locked.querySelector('.layer-name').textContent,/Text Label 2/);
 }finally{f.close();}});
test('keyboard focus can reach every admitted row and never bubbles into canvas nudging',()=>{const f=fixture(200);try{
 let escaped=0;f.doc.addEventListener('keydown',()=>escaped++);f.host.querySelector('.layer-name').focus();const key=value=>f.doc.activeElement.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true}));
 key('End');assert.equal(f.doc.activeElement.closest('[data-layer-key]').dataset.layerKey,'e50');assert.equal(f.doc.activeElement.closest('[data-layer-key]').getAttribute('aria-rowindex'),'150');key('ArrowUp');assert.equal(f.doc.activeElement.closest('[data-layer-key]').dataset.layerKey,'e51');key('Home');assert.equal(f.doc.activeElement.closest('[data-layer-key]').dataset.layerKey,'e199');key('ArrowLeft');assert.equal(f.doc.activeElement.dataset.layerAction,'lock');assert.equal(escaped,0);assert.equal(f.ui.stats.indexes,1);
 }finally{f.close();}});
test('new canvas after style/locks reuses keyed rows and preserves expanded range and scroll',()=>{const f=fixture(500);try{
 f.more.click();f.host.scrollTop=10*layers.ROW_HEIGHT;f.ui.flush();const row=f.host.querySelector('[data-layer-key="e490"]'),created=f.ui.stats.createdRows,next=f.svg.cloneNode(true);next.querySelector('[data-key="e490"]').textContent='Renamed label';f.update({source:next,revision:{},locked:new Set(['e490'])});
 assert.equal(f.host.querySelector('[data-layer-key="e490"]'),row);assert.equal(f.host.scrollTop,360);assert.equal(f.host.getAttribute('aria-rowcount'),'300');assert.equal(f.ui.stats.createdRows,created);assert.match(row.textContent,/Renamed label/);assert.ok(row.classList.contains('is-locked'));
 f.update({key:'p/b/0'});assert.equal(f.host.scrollTop,0);assert.equal(f.host.getAttribute('aria-rowcount'),'150');
 }finally{f.close();}});
test('host adapter uses live presentation, selection completion and existing shared commands',()=>{
 const ids=['layerObjects','layerSearch','layerMore','layerUnlock','layerUnlockAll','quickUnlockSelected','scope','objectAlignmentPanel',...['line-height','letter-spacing','left','right','first'].map(v=>'para-'+v)],dom=new JSDOM(ids.map(id=>`<${id==='layerSearch'||id.startsWith('para-')?'input':'div'} id="${id}"></${id==='layerSearch'||id.startsWith('para-')?'input':'div'}>`).join('')+'<div id="artboard"><svg xmlns="'+NS+'"><svg data-panel="a" data-variant="0"><text data-key="e1">Live generated result</text><path data-key="e2"/></svg></svg></div>',{pretendToBeVisual:true}),doc=dom.window.document;
 const current={panels:{a:{variant:0,edits:{},lockedElements:{0:[]}}}},calls=[],ctx={document:doc,StudioLayersPanel:layers,project:{id:'p'},selectedPanel:'a',original:false,activePane:'detail',state:()=>current,$:id=>doc.getElementById(id),T:s=>s,selectionGroups:()=>ctx.groups,groups:[],setElementSelection:g=>ctx.groups=g,editsFor:()=>current.panels.a.edits[0]||{},zoomView:{finishSelectionUI:()=>{calls.push('selection');ctx.renderEditingPanels();}},renderCanvas:()=>{throw Error('Layer selection redrew the artwork');},editedSvg:()=>{throw Error('Layer list rendered a second SVG');},lockSelection:v=>calls.push(['lock',v]),hasAnyLocks:()=>false,unlockEverything(){},quickSelectedObjects:()=>[],selectionCommandInfo:()=>({panels:[]}),copy:v=>JSON.parse(JSON.stringify(v)),setEdit(next,id,vi,key,p,v){((next.panels[id].edits[vi]||={})[key]||={})[p]=v;},commit:next=>{current.panels=next.panels;calls.push('commit');}};
 ctx.selectionAlignmentPlan=selectionAlignmentPlan;const begin=source.indexOf('  // Layer UI uses'),end=source.indexOf('  function renderSelectionProperties()',begin);vm.createContext(ctx);vm.runInContext(source.slice(begin,end),ctx);ctx.renderEditingPanels();const row=doc.querySelector('[data-layer-key="e1"]');assert.match(row.textContent,/Live generated result/);row.querySelector('.layer-name').click();assert.equal(calls[0],'selection');assert.equal(row.getAttribute('aria-selected'),'true');row.querySelector('[data-layer-action="lock"]').click();assert.deepEqual(calls.at(-1),['lock',true]);row.querySelector('[data-layer-action="visibility"]').click();assert.equal(current.panels.a.edits[0].e1.hidden,'true');assert.equal(calls.at(-1),'commit');assert.match(source,/zoomView\.finishSelectionUI=finishSelectionUI/);ctx.layersPanel.destroy();dom.window.close();
});
test('offline bundler includes the production virtual list before its host',()=>{const builder=fs.readFileSync('skills/polish-sci-figures/scripts/figure_studio.py','utf8');assert.ok(builder.indexOf("'layers-panel.js'")<builder.indexOf("'studio.js'"));});
test('selection updates do not force scroll layout; scroll and explicit flush remain authoritative',()=>{const f=fixture(5000);try{let reads=0,position=0;Object.defineProperty(f.host,'scrollTop',{configurable:true,get(){reads++;return position;},set(value){position=value;}});for(let i=0;i<20;i++)f.update({selected:new Set(['e'+i])});assert.equal(reads,0,'Selection must not read scroll geometry after writing canvas styles');position=360;f.host.dispatchEvent(new f.dom.window.Event('scroll'));assert.equal(reads,1);f.ui.flush();assert.equal(reads,2);assert([...f.host.querySelectorAll('[data-layer-key]')].some(row=>Number(row.getAttribute('aria-rowindex'))>10),'Real scroll position still controls virtualization');}finally{f.close();}});
console.log(`${passed} layer panel tests passed`);
