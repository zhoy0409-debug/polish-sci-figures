'use strict';
// Real serializer, import validation/sanitizer, command handlers and History.
// Bounding rectangles are deterministic DOM fixtures, not a browser paint claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),source=fs.readFileSync(path.join(base,'studio.js'),'utf8'),helpers=require(path.join(base,'studio.js')),clipboard=require(path.join(base,'canvas-clipboard.js')),geometry=require(path.join(base,'image-insets.js'));
const copy=value=>JSON.parse(JSON.stringify(value)),NS='http://www.w3.org/2000/svg',tick=()=>new Promise(resolve=>setImmediate(resolve));
const section=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start+1);assert.ok(start>=0&&end>start,a);return source.slice(start,end);};
const inserted=require(path.join(base,'element-insertions.js')),rich=require(path.join(base,'rich-text.js'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const selectedText=f=>{const node=f.live.querySelector(`[data-key="${f.ctx.selected[0]}"]`);return node?.matches('text')?node:node?.querySelector('text');};
async function until(test){for(let i=0;i<60;i++){if(test())return;await tick();}throw Error('Clipboard checkpoint did not arrive');}
function fixture(){
 const dom=new JSDOM(fs.readFileSync(path.join(base,'studio.html'),'utf8'),{url:'http://localhost/'}),w=dom.window,d=w.document;
 if(!w.CSSStyleDeclaration.prototype[Symbol.iterator])w.CSSStyleDeclaration.prototype[Symbol.iterator]=function*(){for(let i=0;i<this.length;i++)yield this.item(i);};
 for(const id of ['quickCopy','quickCut','quickPaste'])if(!d.getElementById(id)){const button=d.createElement('button');button.id=id;d.body.append(button);}
 const xml=`<svg xmlns="${NS}" viewBox="0 0 200 100" overflow="visible"><defs><clipPath id="clip"><rect width="180" height="90"/></clipPath></defs><g id="body" transform="translate(10 5)" opacity=".8" clip-path="url(#clip)" fill="#223344" font-family="Arial"><text id="pdfText" x="0 .2 .4" y=".8" transform="scale(50)" font-size=".24">ABC<tspan font-style="italic" font-size="70%">2</tspan></text><rect id="shape" x="80" y="10" width="20" height="30"/><path id="unselected" d="M 130 30 L 150 50"/></g></svg>`;
 const project=helpers.createBlankProject('c'.repeat(20),'Clipboard test');Object.assign(project.panels[0],{name:'Imported PDF',provenance:'user-import',variants:[{name:'imported_pdf',svg:xml,width:200,height:100,viewBox:[0,0,200,100],size:'original',preserveAspect:true}]});project.initialState.columns=2;project.initialState.grid={...helpers.gridFor(project.initialState),rows:2};
 const history=new helpers.History(project.initialState),messages=[],systemWrites=[],navigator={clipboard:{writeText:async text=>systemWrites.push(text),readText:async()=>systemWrites.at(-1)||''}};
 const ctx={...helpers,copy,project,history,selectedPanel:'panel-0',selected:[],elementSelections:[],selectionAnchor:null,selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,selectedEmptyCell:null,panelSelection:['panel-0'],layoutMode:false,showGuides:false,renderSerial:0,boxSelect:false,contentSelection:null,original:false,dragging:null,inlineEditor:null,pointerEditRefresh:false,pointerEditCommit:false,
 document:d,window:w,navigator,DOMParser:w.DOMParser,XMLSerializer:w.XMLSerializer,FileReader:w.FileReader,Image:w.Image,NS,StudioCanvasClipboard:clipboard,StudioElementInsertions:inserted,StudioImageInsets:geometry,StudioLayoutLock:require(path.join(base,'layout-lock.js')),StudioMasterFrame:require(path.join(base,'master-frame.js')),StudioTextFormatting:require(path.join(base,'text-formatting.js')),StudioRichText:rich,StudioSelectionTransformDOM:require(path.join(base,'selection-transform-dom.js')),
 getComputedStyle:node=>w.getComputedStyle(node),$:id=>d.getElementById(id),T:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[+i]),say:text=>messages.push(text),guard:fn=>async(...args)=>{try{return await fn(...args);}catch(e){messages.push(e.message);}},
 state:()=>ctx.history.current,panel:id=>ctx.project.panels.find(p=>p.id===id),isVisibleObject:el=>!el.closest('defs')&&el.style.display!=='none',validateProject(){},prepareTouchEditing(){},showPane(){},persist(){},
 annotationTopHeight:()=>0,annotationFirstTopHeight:()=>0,annotationHeight:()=>0,conditionMatrixHeight:()=>0,appendConditionMatrix(){},statisticalAnnotationInfo:()=>({placement:'plot',available:false}),fittedVariant:()=>null,fitPlot:()=>false,statisticalExportRecords:()=>[],paint:(node,prop)=>w.getComputedStyle(node).getPropertyValue(prop)||node.getAttribute(prop)||'',renderSelectionProperties(){},renderRichTextControls(){},renderQuickToolbar(){},
 localEngine:null,templateCache:new Map(),dataDrafts:{},dataSerial:0,dataTimer:null,setTimeout,clearTimeout,templateStarters:{},StudioGalleryContracts:{},button(text,fn){const b=d.createElement('button');b.textContent=text;b.onclick=fn;return b;},
 };
 ctx.editsFor=(id,vi,s=ctx.state())=>s.panels[id].edits[vi]||{};ctx.textPointSize=rich.pointSize;ctx.textPointFactor=(node,id,vi)=>rich.localFontScale(node,node.ownerSVGElement||node.closest('svg'));
 ctx.editableSource=(id,vi)=>ctx.editedSvg(id,vi);ctx.editableSourceSnapshot=ctx.editableSource;ctx.currentOutput=()=>helpers.exportGeometry(ctx.layout().width,ctx.layout().height,ctx.state().exportSettings);
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function elementInsertionsAPI(){'),source.indexOf('function imageInsetsAPI(){')),ctx);
 vm.runInContext(source.split('\n').filter(line=>/^  const (TAGS|ATTRS|STYLES) = new Set/.test(line)||/^  const DRAW =/.test(line)).join('\n')+source.slice(source.indexOf('  function safeValue('),source.indexOf('  function validateProject('))+section('  function isVisibleObject(','  // Editor-only hit areas'),ctx);
 vm.runInContext(source.slice(source.indexOf('  function selectionGroups(){'),source.indexOf('  const sizeNames=')),ctx);
 vm.runInContext(section('  function baseSvg(','  const heatmapUpgradeRequests=')+section('  function editedSvg(','  function clearStatisticalResultEdits(')+section('  function layout(s=state(),','  function plotFrame(')+section('  function namespace(svg) {','  let compactLayoutCache=')+section('  function wrapPanelContent(','  let autosaveQueue=')+section('  function matchSizes(','  function moveWithSizes(')+section('  function invalidateReleasedLayoutLocks(','  function migrateLabelHistory()'),ctx);
 ctx.applyElementOffsets=(svg,id,vi,s,unit)=>ctx.StudioSelectionTransformDOM.applyObjectTransforms(svg,ctx.editsFor(id,vi,s),unit);
 ctx.render=()=>d.getElementById('artboard').replaceChildren(ctx.composite(false,false));ctx.renderCanvas=ctx.render;
 vm.runInContext(source.slice(source.indexOf('  function deleteSelectedObjects(){'),source.indexOf('  function renderLabelControls(){')),ctx);
 vm.runInContext(source.slice(source.indexOf('  let imageDestination=null;'),source.indexOf('  let facetSplitRequest=')),ctx);
 vm.runInContext(source.slice(source.indexOf('  function installAsset('),source.indexOf('  let insertionCell=')),ctx);
 // Geometry is deterministic, while source sanitization, editedSvg, layout,
 // composite/export, command handlers and commits are the production functions.
 const main=()=>d.querySelector('#artboard > svg'),live=()=>main()?.querySelector('svg[data-panel="panel-0"]');
 const rectOf=(left,top,right,bottom)=>({x:left,y:top,left,top,right,bottom,width:right-left,height:bottom-top});
 const rectFrom=(root,node,box)=>{const m=node===root?{a:1,b:0,c:0,d:1,e:0,f:0}:geometry.relativeMatrix(node,root),view=root.getAttribute('viewBox').split(/[ ,]+/).map(Number),points=[{x:box.x,y:box.y},{x:box.x+box.width,y:box.y},{x:box.x,y:box.y+box.height},{x:box.x+box.width,y:box.y+box.height}].map(p=>geometry.point(m,p));return rectOf(100+(Math.min(...points.map(p=>p.x))-view[0])*2,100+(Math.min(...points.map(p=>p.y))-view[1])*2,100+(Math.max(...points.map(p=>p.x))-view[0])*2,100+(Math.max(...points.map(p=>p.y))-view[1])*2);};
 w.SVGElement.prototype.getBoundingClientRect=function(){const root=main();if(!root)return rectOf(0,0,0,0);let box;if(this.localName==='svg'){const b=this.getAttribute('viewBox').split(/[ ,]+/).map(Number);box={x:b[0],y:b[1],width:b[2],height:b[3]};}else if(this.localName==='text'){const x=parseFloat(this.getAttribute('x'))||0,y=parseFloat(this.getAttribute('y'))||0,size=rich.pointSize(this);box={x,y:y-size,width:Math.max(size*.6,this.textContent.length*size*.6),height:size*1.2};}else if(this.localName==='rect'){box={x:+this.getAttribute('x'),y:+this.getAttribute('y'),width:+this.getAttribute('width'),height:+this.getAttribute('height')};}else if(this.localName==='path'){const n=this.getAttribute('d').match(/-?\d+(?:\.\d+)?/g)?.map(Number)||[],x=n.filter((_,i)=>i%2===0),y=n.filter((_,i)=>i%2);box={x:Math.min(...x),y:Math.min(...y),width:Math.max(...x)-Math.min(...x),height:Math.max(...y)-Math.min(...y)};}if(box)return rectFrom(root,this,box);const children=[...this.children].filter(n=>!['defs','metadata','title','desc'].includes(n.localName)&&n.style.display!=='none').map(n=>n.getBoundingClientRect());return children.length?rectOf(Math.min(...children.map(r=>r.left)),Math.min(...children.map(r=>r.top)),Math.max(...children.map(r=>r.right)),Math.max(...children.map(r=>r.bottom))):rectOf(0,0,0,0);};
 ctx.render();const keys={text:live().querySelector('[id$="pdfText"]').dataset.key,shape:live().querySelector('[id$="shape"]').dataset.key,other:live().querySelector('[id$="unselected"]').dataset.key};ctx.selected=[keys.text,keys.shape];
 const key=(key,options={},target=d.body)=>{const e=new w.KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true,...options});target.dispatchEvent(e);return e;};
 return {ctx,w,d,get live(){return live();},get main(){return main();},messages,systemWrites,navigator,keys,key,close:()=>w.close()};
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
await test('ordinary paste appends editable PDF objects inside the occupied panel without changing production layout or export bounds',async()=>{
 const f=fixture(),c=f.ctx,original=f.live.outerHTML,raw=JSON.stringify(c.project.panels),before=copy(c.state()),beforeLayout=copy(c.layout()),exportBefore=c.composite(false,true),otherBefore=f.live.querySelector(`[data-key="${f.keys.other}"]`).getAttribute('d');
 await c.copyCanvasSelection();assert.equal(c.history.index,0);assert.equal(f.live.outerHTML,original);assert.equal(await c.pasteCanvasClipboard(),true);
 assert.equal(c.state().order.length,1);assert.equal(c.project.panels.length,1);assert.equal(c.selectedPanel,'panel-0');assert.equal(JSON.stringify(c.project.panels),raw);assert.deepEqual(copy(c.state().grid),before.grid);assert.deepEqual(copy(c.state().panels['panel-0'].edits),before.panels['panel-0'].edits);assert.deepEqual(copy(c.layout()),beforeLayout);
 const group=f.live.querySelector(`[data-key="${c.selected[0]}"]`),text=group.querySelector('text');assert.ok(+c.selected[0].slice(1)>=1000000000);assert.equal(text.getAttribute('transform'),'scale(50)');assert.equal(text.getAttribute('font-size'),'.24');assert.equal(text.querySelector('tspan').getAttribute('font-style'),'italic');assert.equal(group.querySelectorAll('clipPath').length,1);assert.equal(f.live.querySelector(`[data-key="${f.keys.other}"]`).getAttribute('d'),otherBefore);assert.equal(group.querySelector('[id$="unselected"]'),null);
 const exported=c.composite(false,true);for(const attr of ['viewBox','width','height'])assert.equal(exported.getAttribute(attr),exportBefore.getAttribute(attr));assert.equal(exported.querySelectorAll('text').length,2);assert.equal(exported.querySelector('[data-key]'),null);
 helpers.validateState(c.state(),c.project);const saved=copy(c.history.toJSON()),savedState=copy(c.state());c.history=helpers.History.restore(saved,c.project,savedState);c.render();assert.equal(f.live.querySelectorAll('text').length,2);c.history.undo();c.render();assert.equal(c.state().panels['panel-0'].insertedElements,undefined);assert.equal(f.live.querySelectorAll('text').length,1);c.history.redo();c.render();assert.equal(f.live.querySelectorAll('text').length,2);f.close();
});
await test('an explicitly selected empty cell still accepts a standalone copied panel while preserving original appearance',async()=>{
 const f=fixture(),c=f.ctx,raw=c.panel('panel-0').variants[0].svg,before=copy(c.state().panels['panel-0']);await c.copyCanvasSelection();c.selectedEmptyCell={row:1,col:1};c.trackCanvasClipboardCell(c.selectedEmptyCell);assert.equal(await c.pasteCanvasClipboard(),true);
 assert.equal(c.state().order.length,2);assert.deepEqual(copy(c.state().grid.places[c.selectedPanel]),{row:1,col:1,rs:1,cs:1});assert.deepEqual(copy(c.state().panels['panel-0']),before);assert.equal(c.panel('panel-0').variants[0].svg,raw);assert.equal(c.state().typography,undefined,'paste must pass preserveAppearance and avoid matchSizes default typography');
 const asset=c.panel(c.selectedPanel),out=new f.w.DOMParser().parseFromString(asset.variants[0].svg,'image/svg+xml');assert.equal(out.querySelectorAll('text').length,1);assert.equal(out.querySelector('text').getAttribute('transform'),'scale(50)');assert.equal(out.querySelectorAll('clipPath').length,1);helpers.validateState(c.state(),c.project);c.history.undo();assert.equal(c.state().order.length,1);c.history.redo();assert.equal(c.state().order.length,2);f.close();
});
await test('first Copy or Cut click commits inline PDF text and serializes the freshly rendered text, with separate undo steps',async()=>{
 for(const cut of [false,true]){
  const f=fixture(),c=f.ctx;c.selected=[f.keys.text];c.activePane='detail';c.persist=()=>{};c.renderSelectionProperties=()=>{};c.renderRichTextControls=()=>{};c.renderQuickToolbar=()=>{};
  c.Event=f.w.Event;c.requestAnimationFrame=fn=>setImmediate(fn);c.cancelAnimationFrame=clearImmediate;c.editsFor=(id,vi)=>c.state().panels[id].edits[vi]||{};
  c.StudioRichText=vm.runInNewContext(fs.readFileSync(path.join(base,'rich-text.js'),'utf8')+';StudioRichText;',{document:f.d});
  let renders=0;
  c.render=()=>{
   vm.runInContext('pointerEditRefresh=false;',c);renders++;
   const current=f.main.querySelector('svg[data-panel]'),fresh=current.cloneNode(true);
   for(const el of fresh.querySelectorAll('[data-key]')){
    el.getBoundingClientRect=current.querySelector(`[data-key="${el.dataset.key}"]`).getBoundingClientRect;
    const props=c.editsFor('panel-0',0)[el.dataset.key]||{};
    if(props.text!==undefined){helpers.preparePositionedTextEdit(el,props);c.StudioRichText.replaceText(el,props.text);}
    if(props['rich-text'])c.StudioRichText.apply(el,props['rich-text']);
    if(props.hidden==='true')el.style.display='none';
   }
   current.replaceWith(fresh);c.editableSource=()=>fresh;c.editableSourceSnapshot=c.editableSource;
  };
  const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+1));
  vm.runInContext(section('  let pointerEditCommit=','  function migrateLabelHistory(')+section('  function setEdit(','  let statisticalLineGesture=')+section('  function richTextTarget(){','  function renderRichTextControls(){')+section('  function startInlineTextEdit(','  $(\'addOverlay\').onclick=')+'\nsetupDirectTextEditing();',c);
  c.startInlineTextEdit(f.live.querySelector(`[data-key="${f.keys.text}"]`));const field=c.inlineEditor.element;field.value='Editable PDF label';
  const button=f.d.getElementById(cut?'quickCut':'quickCopy');button.dispatchEvent(new f.w.MouseEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));
  assert.equal(c.state().panels['panel-0'].edits[0]?.[f.keys.text]?.text,'Editable PDF label',f.messages.join('\n'));assert.equal(f.main.querySelector(`[data-key="${f.keys.text}"]`).textContent,'ABC2','the capture handler deliberately leaves the hit DOM intact');assert.equal(renders,0);
  button.dispatchEvent(new f.w.MouseEvent('pointerup',{button:0,bubbles:true,cancelable:true}));button.click();
  await until(()=>f.messages.some(message=>message.includes(cut?'已剪切':'已复制')));
  assert.ok(renders>=1);assert.equal(c.history.index,cut?2:1);c.trackCanvasClipboardCell({row:1,col:1});await c.pasteCanvasClipboard();
  const asset=c.panel(c.selectedPanel),out=new f.w.DOMParser().parseFromString(asset.variants[0].svg,'image/svg+xml');assert.equal(out.querySelector('text').textContent,'Editable PDF label');assert.equal(out.querySelector('text').getAttribute('transform'),'scale(50)');
  c.history.undo();if(cut){assert.equal(c.state().panels['panel-0'].edits[0][f.keys.text].hidden,'true');c.history.undo();}assert.equal(c.state().panels['panel-0'].edits[0][f.keys.text].text,'Editable PDF label');c.history.undo();assert.equal(c.state().panels['panel-0'].edits[0],undefined);f.close();
 }
});
await test('cut waits for full serialization and occupied-cell paste changes no original source or grid track',async()=>{
 const f=fixture(),c=f.ctx,grid=copy(c.state().grid);await c.copyCanvasSelection(true);assert.equal(c.history.index,1);assert.equal(c.state().panels['panel-0'].edits[0][f.keys.text].hidden,'true');assert.equal(c.state().panels['panel-0'].edits[0][f.keys.shape].hidden,'true');assert.equal(c.state().panels['panel-0'].edits[0][f.keys.other],undefined);c.trackCanvasClipboardCell({row:0,col:0});await c.pasteCanvasClipboard();assert.equal(c.state().order[0],'panel-0');assert.equal(c.state().order.length,1);assert.deepEqual(copy(c.state().grid),grid);assert.equal(c.history.index,2);c.history.undo();assert.equal(c.state().panels['panel-0'].insertedElements,undefined);c.history.undo();assert.equal(c.state().panels['panel-0'].edits[0],undefined);f.close();
});
await test('locked descendant, mixed overlay selection and serializer failure never partially delete',async()=>{
 const f=fixture(),c=f.ctx;c.state().panels['panel-0'].lockedElements={0:[f.keys.shape]};await c.copyCanvasSelection(true);assert.equal(c.history.index,0);assert.match(f.messages.at(-1),/解锁/);delete c.state().panels['panel-0'].lockedElements;c.selectedAnnotations=['standalone'];await c.copyCanvasSelection(true);assert.equal(c.history.index,0);assert.match(f.messages.at(-1),/同一小图/);c.selectedAnnotations=[];f.live.querySelector(`[data-key="${f.keys.text}"]`).setAttribute('filter','url(#missing)');await assert.rejects(c.copyCanvasSelection(true));assert.equal(c.history.index,0);f.close();
});
await test('source history changes during validation preserve a copy but never cut the new state',async()=>{
 const f=fixture(),c=f.ctx;let release;c.validateSvgImportFeatures=()=>new Promise(resolve=>release=resolve);const pending=c.copyCanvasSelection(true);await until(()=>release);const next=copy(c.state());next.title='Changed during copy';c.history.commit(next);release();await assert.rejects(pending,/未执行剪切/);assert.equal(c.history.index,1);assert.equal(c.state().panels['panel-0'].edits[0],undefined);await c.pasteCanvasClipboard();assert.equal(c.state().order.length,1);assert.equal(c.state().panels['panel-0'].insertedElements[0].length,1);f.close();
});
await test('Ctrl/Cmd shortcuts work on canvas, preserve native text/dialog shortcuts, and support reuse across project histories',async()=>{
 const f=fixture(),c=f.ctx;assert.equal(f.key('c').defaultPrevented,true);await until(()=>f.messages.some(m=>m.includes('已复制')));const input=f.d.createElement('textarea');f.d.body.append(input);input.focus();assert.equal(f.key('x',{},input).defaultPrevented,false);assert.equal(c.history.index,0);input.blur();const dialog=f.d.createElement('dialog');dialog.open=true;f.d.body.append(dialog);assert.equal(f.key('v').defaultPrevented,false);dialog.remove();
 c.project=helpers.createBlankProject('d'.repeat(20),'Destination');c.history=new helpers.History(c.project.initialState);c.selectedPanel='panel-0';c.selected=[];c.render();assert.equal(f.key('v',{ctrlKey:false,metaKey:true}).defaultPrevented,true);await until(()=>c.history.index===1);assert.equal(c.state().order.length,1);assert.equal(c.panel(c.selectedPanel).provenance,'blank-canvas');assert.equal(c.state().panels['panel-0'].insertedElements[0].length,1);assert.equal(c.editedSvg('panel-0',0).querySelectorAll('text').length,1);f.close();
});

await test('an immediate first Ctrl+C then Ctrl+V waits for validation and pastes exactly once',async()=>{
 const f=fixture(),c=f.ctx,validate=c.validateSvgImportFeatures;let release;c.validateSvgImportFeatures=async text=>{await new Promise(resolve=>release=resolve);return validate(text);};
 assert.equal(f.key('c').defaultPrevented,true);assert.equal(f.key('v').defaultPrevented,true);assert.equal(c.history.index,0);await until(()=>release);release();await until(()=>c.history.index===1);await tick();assert.equal(c.state().panels['panel-0'].insertedElements[0].length,1);assert.equal(f.live.querySelectorAll('text').length,2);assert.equal(f.systemWrites.at(-1),'ABC2');assert.equal(f.messages.some(m=>/请先复制/.test(m)),false);f.close();
});

await test('a native canvas paste inserts external plain text without an existing internal copy',async()=>{
 const f=fixture(),c=f.ctx,before=copy(c.layout()),event=new f.w.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:type=>type==='text/plain'?'External text\nSecond line':''}});f.d.body.dispatchEvent(event);assert.equal(event.defaultPrevented,true);await until(()=>c.history.index===1);
 assert.equal(c.state().order.length,1);assert.equal(c.project.panels.length,1);assert.deepEqual(copy(c.layout()),before);const text=selectedText(f);assert.equal(text.textContent,'External textSecond line');assert.equal(text.querySelectorAll('tspan').length,2);assert.equal(text.getAttribute('font-family'),'Arial');assert.equal(text.getAttribute('font-size'),'12');f.close();
});

await test('native text-field copy/paste stays native while system copy receives selected PDF text',async()=>{
 const f=fixture(),c=f.ctx;c.selected=[f.keys.text];await c.copyCanvasSelection();assert.equal(f.systemWrites.at(-1),'ABC2');const input=f.d.createElement('textarea');input.value='Native edit';f.d.body.append(input);input.focus();const event=new f.w.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(event,'clipboardData',{value:{getData:()=> 'Should stay native'}});input.dispatchEvent(event);assert.equal(event.defaultPrevented,false);assert.equal(c.history.index,0);assert.equal(f.key('c',{},input).defaultPrevented,false);assert.equal(f.key('v',{},input).defaultPrevented,false);f.close();
});

await test('switching projects during an asynchronous system clipboard read never pastes into the new project',async()=>{
 const f=fixture(),c=f.ctx;await c.copyCanvasSelection();let release;f.navigator.clipboard.readText=()=>new Promise(resolve=>release=resolve);assert.equal(f.key('v').defaultPrevented,true);await until(()=>release);
 c.project=helpers.createBlankProject('e'.repeat(20),'New destination');c.history=new helpers.History(c.project.initialState);c.selectedPanel='panel-0';c.selected=[];c.render();release('Text read for the old project');for(let i=0;i<5;i++)await tick();assert.equal(c.history.index,0,'an old paste request must not edit a different project');assert.equal(c.state().panels['panel-0'].insertedElements,undefined);f.close();
});

await test('inserted PDF text can be restyled, moved, copied again, exported and reopened without changing unrelated artwork',async()=>{
 const f=fixture(),c=f.ctx;c.selected=[f.keys.text];c.state().masterFrame={x:5,y:8,width:350,height:180};c.state().exportSettings={widthMm:80,dpi:600};const second=copy(c.panel('panel-0'));second.id='panel-1';second.variants[0].svg=second.variants[0].svg.replace('ABC','Other');c.project.panels.push(second);c.state().order.push('panel-1');c.state().panels['panel-1']={variant:0,edits:{}};c.state().grid.places['panel-1']={row:0,col:1,rs:1,cs:1};c.render();const other=JSON.stringify(c.state().panels['panel-1']),asset=JSON.stringify(c.project.panels),beforeLayout=copy(c.layout()),exportBefore=c.composite(false,true),native=c.editedSvg('panel-0',0).querySelector(`[data-key="${f.keys.text}"]`).outerHTML;
 await c.copyCanvasSelection();await c.pasteCanvasClipboard();const insertedText=selectedText(f),textKey=insertedText.dataset.key,oldPoint=geometry.point(geometry.relativeMatrix(insertedText,f.main),{x:0,y:0});
 const next=copy(c.state());next.panels['panel-0'].edits[0]={[textKey]:{text:'Changed copy','font-family':'Times New Roman','font-size':'.36','offset-x':'3','offset-y':'-2'}};assert.equal(c.commit(next,'style inserted'),true);const changed=f.live.querySelector(`[data-key="${textKey}"]`),at=geometry.point(geometry.relativeMatrix(changed,f.main),{x:0,y:0});assert.equal(changed.textContent,'Changed copy');assert.equal(changed.style.fontFamily,'Times New Roman');assert.equal(changed.style.fontSize,'0.36px');near(at.x,oldPoint.x+3);near(at.y,oldPoint.y-2);
 assert.equal(c.editedSvg('panel-0',0).querySelector(`[data-key="${f.keys.text}"]`).outerHTML,native);assert.equal(JSON.stringify(c.project.panels),asset);assert.equal(JSON.stringify(c.state().panels['panel-1']),other);assert.deepEqual(copy(c.layout()),beforeLayout);assert.deepEqual(copy(c.state().masterFrame),{x:5,y:8,width:350,height:180});
 c.setElementSelection([{id:'panel-0',vi:0,keys:[textKey]}]);await c.copyCanvasSelection();await c.pasteCanvasClipboard();assert.equal(c.state().panels['panel-0'].insertedElements[0].length,2);const latest=selectedText(f);assert.equal(latest.textContent,'Changed copy');assert.equal(latest.style.fontFamily,'Times New Roman');
 const exported=c.composite(false,true);for(const attr of ['viewBox','width','height'])assert.equal(exported.getAttribute(attr),exportBefore.getAttribute(attr));assert.equal([...exported.querySelectorAll('text')].filter(node=>node.textContent==='Changed copy').length,2);const restored=helpers.History.restore(copy(c.history.toJSON()),c.project,copy(c.state()));c.history=restored;c.render();assert.equal([...f.live.querySelectorAll('text')].filter(node=>node.textContent==='Changed copy').length,2);helpers.validateState(c.state(),c.project);f.close();
});
await test('a single pasted PDF text is selected immediately and the actual toolbar can change size and family without another canvas click',async()=>{
 const f=fixture(),c=f.ctx;c.selected=[f.keys.text];const asset=JSON.stringify(c.project.panels),grid=copy(c.state().grid);await c.copyCanvasSelection();await c.pasteCanvasClipboard();const key=c.selected[0];assert.equal(f.live.querySelector(`[data-key="${key}"]`).localName,'text');
 c.requestAnimationFrame=fn=>setImmediate(fn);c.cancelAnimationFrame=clearImmediate;c.textFormattingAPI=()=>c.StudioTextFormatting;c.richTextAPI=()=>c.StudioRichText;c.hex=c.StudioTextFormatting.hex;
 vm.runInContext(section('function validValue(','function heatmapCellInfo(')+section('  function setEdit(','  function manualPanelScale(')+section('  let quickPreview=null,','  function captureQuickCharacters(')+section('  function targetObjects(','  function paletteHeatmapInfo('),c);
 const bindings=source.split('\n').find(line=>line.includes("for(const [id,property]of [['quickFontSize','font-size']"));assert.ok(bindings);vm.runInContext(bindings+"\n"+source.split('\n').find(line=>line.trim().startsWith("$('font').onchange=")),c);
 const quick=f.d.getElementById('quickFontSize');quick.value='20';quick.dispatchEvent(new f.w.Event('change'));assert.equal(c.history.index,2);assert.equal(c.selected[0],key);const afterSize=f.live.querySelector(`[data-key="${key}"]`);near(rich.pointSize(afterSize)*rich.localFontScale(afterSize,f.main),20);assert.equal(afterSize.querySelector('tspan').getAttribute('font-style'),'italic');
 f.d.getElementById('scope').value='element';f.d.getElementById('font').value='Times New Roman';f.d.getElementById('font').dispatchEvent(new f.w.Event('change'));assert.equal(c.history.index,3);const afterFamily=f.live.querySelector(`[data-key="${key}"]`);assert.equal(afterFamily.style.fontFamily,'Times New Roman');near(rich.pointSize(afterFamily)*rich.localFontScale(afterFamily,f.main),20);assert.equal(JSON.stringify(c.project.panels),asset);assert.deepEqual(copy(c.state().grid),grid);f.close();
});
console.log(`PASS ${passed} canvas clipboard production integrations.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
