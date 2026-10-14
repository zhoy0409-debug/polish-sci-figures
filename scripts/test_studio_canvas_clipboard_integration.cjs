'use strict';
// Real serializer, import validation/sanitizer, command handlers and History.
// Bounding rectangles are deterministic DOM fixtures, not a browser paint claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{JSDOM}=require('jsdom');
const base=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),source=fs.readFileSync(path.join(base,'studio.js'),'utf8'),helpers=require(path.join(base,'studio.js')),clipboard=require(path.join(base,'canvas-clipboard.js')),geometry=require(path.join(base,'image-insets.js'));
const copy=value=>JSON.parse(JSON.stringify(value)),NS='http://www.w3.org/2000/svg',tick=()=>new Promise(resolve=>setImmediate(resolve));
async function until(test){for(let i=0;i<60;i++){if(test())return;await tick();}throw Error('Clipboard checkpoint did not arrive');}
function fixture(){
 const dom=new JSDOM(fs.readFileSync(path.join(base,'studio.html'),'utf8'),{url:'http://localhost/'}),w=dom.window,d=w.document;
 if(!w.CSSStyleDeclaration.prototype[Symbol.iterator])w.CSSStyleDeclaration.prototype[Symbol.iterator]=function*(){for(let i=0;i<this.length;i++)yield this.item(i);};
 for(const id of ['quickCopy','quickCut','quickPaste'])if(!d.getElementById(id)){const button=d.createElement('button');button.id=id;d.body.append(button);}
 const xml=`<svg xmlns="${NS}" viewBox="0 0 200 100" overflow="visible"><defs><clipPath id="clip"><rect width="180" height="90"/></clipPath></defs><g id="body" transform="translate(10 5)" opacity=".8" clip-path="url(#clip)" fill="#223344" font-family="Arial"><text id="pdfText" data-key="e1" x="0 .2 .4" y=".8" transform="scale(50)" font-size=".24">ABC<tspan font-style="italic" font-size="70%">2</tspan></text><rect id="shape" data-key="e2" x="80" y="10" width="20" height="30"/><path id="unselected" data-key="e3" d="M 130 30 L 150 50"/></g></svg>`;
 const project=helpers.createBlankProject('c'.repeat(20),'Clipboard test');Object.assign(project.panels[0],{name:'Imported PDF',provenance:'user-import',variants:[{name:'imported_pdf',svg:xml,width:200,height:100,viewBox:[0,0,200,100],size:'original',preserveAspect:true}]});project.initialState.columns=2;project.initialState.grid={...helpers.gridFor(project.initialState),rows:2};
 const history=new helpers.History(project.initialState),messages=[],main=d.createElementNS(NS,'svg');main.setAttribute('viewBox','0 0 400 200');main.setAttribute('width','400');main.setAttribute('height','200');const live=d.importNode(new w.DOMParser().parseFromString(xml,'image/svg+xml').documentElement,true);live.dataset.panel='panel-0';live.setAttribute('x','0');live.setAttribute('y','0');live.setAttribute('width','200');live.setAttribute('height','100');main.append(live);d.getElementById('artboard').append(main);
 main.getBoundingClientRect=()=>({left:100,top:100,right:900,bottom:500,width:800,height:400});
 for(const [key,rect]of [['e1',{left:120,top:130,right:200,bottom:160,width:80,height:30}],['e2',{left:260,top:120,right:300,bottom:180,width:40,height:60}],['e3',{left:360,top:160,right:400,bottom:200,width:40,height:40}]])live.querySelector(`[data-key="${key}"]`).getBoundingClientRect=()=>rect;
 const ctx={...helpers,copy,project,history,selectedPanel:'panel-0',selected:['e1','e2'],elementSelections:[],selectionAnchor:null,selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,panelSelection:['panel-0'],layoutMode:false,boxSelect:false,contentSelection:null,original:false,dragging:null,inlineEditor:null,pointerEditRefresh:false,pointerEditCommit:false,
 document:d,window:w,DOMParser:w.DOMParser,XMLSerializer:w.XMLSerializer,FileReader:w.FileReader,Image:w.Image,NS,StudioCanvasClipboard:clipboard,StudioImageInsets:geometry,
 getComputedStyle:node=>w.getComputedStyle(node),$:id=>d.getElementById(id),T:(text,...args)=>text.replace(/\{(\d+)\}/g,(_,i)=>args[+i]),say:text=>messages.push(text),guard:fn=>async(...args)=>{try{return await fn(...args);}catch(e){messages.push(e.message);}},
 state:()=>ctx.history.current,panel:id=>ctx.project.panels.find(p=>p.id===id),editableSource:()=>live,isVisibleObject:el=>!el.closest('defs')&&el.style.display!=='none',validateProject(){},matchSizes:s=>s,commit:next=>ctx.history.commit(next),prepareTouchEditing(){},showPane(){},renderCanvas(){},
 localEngine:null,templateCache:new Map(),dataDrafts:{},dataSerial:0,dataTimer:null,setTimeout,clearTimeout,templateStarters:{},StudioGalleryContracts:{},button(text,fn){const b=d.createElement('button');b.textContent=text;b.onclick=fn;return b;},
 };
 vm.createContext(ctx);
 vm.runInContext(source.split('\n').filter(line=>/^  const (TAGS|ATTRS|STYLES) = new Set/.test(line)).join('\n')+source.slice(source.indexOf('  function safeValue('),source.indexOf('  function validateProject(')),ctx);
 vm.runInContext(source.slice(source.indexOf('  function selectionGroups(){'),source.indexOf('  const sizeNames=')),ctx);
 vm.runInContext(source.slice(source.indexOf('  function deleteSelectedObjects(){'),source.indexOf('  function renderLabelControls(){')),ctx);
 vm.runInContext(source.slice(source.indexOf('  let imageDestination=null;'),source.indexOf('  let facetSplitRequest=')),ctx);
 vm.runInContext(source.slice(source.indexOf('  function installAsset('),source.indexOf('  let insertionCell=')),ctx);
 const key=(key,options={},target=d.body)=>{const e=new w.KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true,...options});target.dispatchEvent(e);return e;};
 return {ctx,w,d,live,main,messages,key,close:()=>w.close()};
}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
await test('copy and paste preserve editable PDF text/transforms/defs and place one new panel in the selected empty cell',async()=>{
 const f=fixture(),c=f.ctx,original=f.live.outerHTML;await c.copyCanvasSelection();assert.equal(c.history.index,0);assert.equal(f.live.outerHTML,original);c.trackCanvasClipboardCell({row:1,col:1});assert.equal(c.pasteCanvasClipboard(),true);assert.equal(c.state().order.length,2);assert.deepEqual(copy(c.state().grid.places[c.selectedPanel]),{row:1,col:1,rs:1,cs:1});const asset=c.panel(c.selectedPanel),out=new f.w.DOMParser().parseFromString(asset.variants[0].svg,'image/svg+xml');assert.equal(out.querySelectorAll('text').length,1);assert.equal(out.querySelector('text').getAttribute('transform'),'scale(50)');assert.equal(out.querySelector('text').getAttribute('font-size'),'.24');assert.equal(out.querySelector('tspan').getAttribute('font-style'),'italic');assert.equal(out.querySelectorAll('clipPath').length,1);assert.equal(out.querySelector('svg svg').getAttribute('overflow'),'visible','the import sanitizer must preserve artwork outside its old panel viewport');assert.equal([...out.querySelectorAll('[id]')].some(n=>n.id.endsWith('-unselected')),false);helpers.validateState(c.state(),c.project);c.history.undo();assert.equal(c.state().order.length,1);c.history.redo();assert.equal(c.state().order.length,2);f.close();
});
await test('first Copy or Cut click commits inline PDF text and serializes the freshly rendered text, with separate undo steps',async()=>{
 for(const cut of [false,true]){
  const f=fixture(),c=f.ctx;c.selected=['e1'];c.activePane='detail';c.persist=()=>{};c.renderSelectionProperties=()=>{};c.renderRichTextControls=()=>{};c.renderQuickToolbar=()=>{};
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
   current.replaceWith(fresh);c.editableSource=()=>fresh;
  };
  const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+1));
  vm.runInContext(section('  let pointerEditCommit=','  function migrateLabelHistory(')+section('  function setEdit(','  let statisticalLineGesture=')+section('  function richTextTarget(){','  function renderRichTextControls(){')+section('  function startInlineTextEdit(','  $(\'addOverlay\').onclick=')+'\nsetupDirectTextEditing();',c);
  c.startInlineTextEdit(f.live.querySelector('[data-key=e1]'));const field=c.inlineEditor.element;field.value='Editable PDF label';
  const button=f.d.getElementById(cut?'quickCut':'quickCopy');button.dispatchEvent(new f.w.MouseEvent('pointerdown',{button:0,bubbles:true,cancelable:true}));
  assert.equal(c.state().panels['panel-0'].edits[0]?.e1?.text,'Editable PDF label',f.messages.join('\n'));assert.equal(f.main.querySelector('[data-key=e1]').textContent,'ABC2','the capture handler deliberately leaves the hit DOM intact');assert.equal(renders,0);
  button.dispatchEvent(new f.w.MouseEvent('pointerup',{button:0,bubbles:true,cancelable:true}));button.click();
  await until(()=>f.messages.some(message=>message.includes(cut?'已剪切':'已复制')));
  assert.ok(renders>=1);assert.equal(c.history.index,cut?2:1);c.trackCanvasClipboardCell({row:1,col:1});c.pasteCanvasClipboard();
  const asset=c.panel(c.selectedPanel),out=new f.w.DOMParser().parseFromString(asset.variants[0].svg,'image/svg+xml');assert.equal(out.querySelector('text').textContent,'Editable PDF label');assert.equal(out.querySelector('text').getAttribute('transform'),'scale(50)');
  c.history.undo();if(cut){assert.equal(c.state().panels['panel-0'].edits[0].e1.hidden,'true');c.history.undo();}assert.equal(c.state().panels['panel-0'].edits[0].e1.text,'Editable PDF label');c.history.undo();assert.equal(c.state().panels['panel-0'].edits[0],undefined);f.close();
 }
});
await test('cut waits for successful complete serialization and records one undo; paste never overwrites an occupied cell',async()=>{
 const f=fixture(),c=f.ctx;await c.copyCanvasSelection(true);assert.equal(c.history.index,1);assert.equal(c.state().panels['panel-0'].edits[0].e1.hidden,'true');assert.equal(c.state().panels['panel-0'].edits[0].e2.hidden,'true');assert.equal(c.state().panels['panel-0'].edits[0].e3,undefined);c.trackCanvasClipboardCell({row:0,col:0});c.pasteCanvasClipboard();assert.equal(c.state().order[0],'panel-0');assert.equal(c.state().order.length,2);assert.deepEqual(copy(c.state().grid.places[c.selectedPanel]),{row:0,col:1,rs:1,cs:1});assert.equal(c.history.index,2);c.history.undo();assert.equal(c.state().order.length,1);c.history.undo();assert.equal(c.state().panels['panel-0'].edits[0],undefined);f.close();
});
await test('locked descendant, mixed overlay selection and serializer failure never partially delete',async()=>{
 const f=fixture(),c=f.ctx;c.state().panels['panel-0'].lockedElements={0:['e2']};await c.copyCanvasSelection(true);assert.equal(c.history.index,0);assert.match(f.messages.at(-1),/解锁/);delete c.state().panels['panel-0'].lockedElements;c.selectedAnnotations=['standalone'];await c.copyCanvasSelection(true);assert.equal(c.history.index,0);assert.match(f.messages.at(-1),/同一小图/);c.selectedAnnotations=[];f.live.querySelector('[data-key=e1]').setAttribute('filter','url(#missing)');await assert.rejects(c.copyCanvasSelection(true));assert.equal(c.history.index,0);f.close();
});
await test('source history changes during validation preserve a copy but never cut the new state',async()=>{
 const f=fixture(),c=f.ctx;let release;c.validateSvgImportFeatures=()=>new Promise(resolve=>release=resolve);const pending=c.copyCanvasSelection(true);await until(()=>release);const next=copy(c.state());next.title='Changed during copy';c.history.commit(next);release();await assert.rejects(pending,/未执行剪切/);assert.equal(c.history.index,1);assert.equal(c.state().panels['panel-0'].edits[0],undefined);c.pasteCanvasClipboard();assert.equal(c.state().order.length,2);f.close();
});
await test('Ctrl/Cmd shortcuts work on canvas, preserve native text/dialog shortcuts, and support reuse across project histories',async()=>{
 const f=fixture(),c=f.ctx;assert.equal(f.key('c').defaultPrevented,true);await until(()=>f.messages.some(m=>m.includes('已复制')));const input=f.d.createElement('textarea');f.d.body.append(input);input.focus();assert.equal(f.key('x',{},input).defaultPrevented,false);assert.equal(c.history.index,0);input.blur();const dialog=f.d.createElement('dialog');dialog.open=true;f.d.body.append(dialog);assert.equal(f.key('v').defaultPrevented,false);dialog.remove();
 c.project=helpers.createBlankProject('d'.repeat(20),'Destination');c.history=new helpers.History(c.project.initialState);c.selectedPanel='panel-0';c.selected=[];assert.equal(f.key('v',{ctrlKey:false,metaKey:true}).defaultPrevented,true);await until(()=>c.history.index===1);assert.equal(c.state().order.length,1);assert.equal(c.panel(c.selectedPanel).provenance,'user-import');f.close();
});
console.log(`PASS ${passed} canvas clipboard production integrations.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
