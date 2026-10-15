/* Reversible source-element deletion, keyboard guards and visual-order labels. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const {History,arrange,movePanel,validateState,visualPanelOrder,panelNumberStyle,displayedPanelLabel,migratePanelLabels,numberPanelLabels,removeSelectedItems,editingTextTarget}=require(file);
const source=fs.readFileSync(require.resolve(file),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const ids=Array.from({length:9},(_,i)=>'panel-'+i),project={panels:ids.map(id=>({id,variants:[{}]}))};
const label=(text)=>({text,x:2,y:5,size:12,font:'Arial',bold:true});
let initial=arrange({order:ids,columns:3,gap:12,panels:Object.fromEntries(ids.map((id,i)=>[id,{variant:0,edits:{},label:label(String.fromCharCode(65+i))}]))},3,3);
const visual=[ids[0],...ids.slice(2),ids[1]];
visual.forEach((id,i)=>{initial.grid.places[id]={row:Math.floor(i/3),col:i%3,rs:1,cs:1};});
assert.deepEqual(visualPanelOrder(initial),visual,'geometry, not stale id/order, determines visual sequence');
assert.equal(panelNumberStyle(initial),'upper');
assert.deepEqual(visual.map(id=>displayedPanelLabel(initial,id).text),[...'ABCDEFGHI']);
assert.equal(initial.panels[ids[1]].label.text,'B','view calculation must not rewrite source state');
const baseline=copy(initial),legacy=copy(initial);legacy.panels[ids[2]].label.text='Q';
const migrated=migratePanelLabels(legacy,baseline);
assert.equal(migrated.panels[ids[1]].label.manual,false,'a moved but unchanged original label remains automatic');
assert.equal(migrated.panels[ids[2]].label.manual,true,'changed legacy text is manual even when it is a single letter');
assert.equal(displayedPanelLabel(migrated,ids[2]).text,'Q');assert.equal(displayedPanelLabel(migrated,ids[1]).text,'I');
assert.equal(legacy.labelNumbering,undefined,'migration leaves the supplied state immutable');
assert.deepEqual(migratePanelLabels(migrated,baseline),migrated,'migration is idempotent');
const moved=movePanel(initial,ids[0],2,2);
assert.deepEqual(visualPanelOrder(moved).map(id=>displayedPanelLabel(moved,id).text),[...'ABCDEFGHI']);
initial.panels[ids[2]].label={...label('Primary'),manual:true};
assert.equal(displayedPanelLabel(movePanel(initial,ids[2],2,2),ids[2]).text,'Primary');
const numbered=numberPanelLabels(initial,'numeric',label(''));
assert.deepEqual(visual.map(id=>displayedPanelLabel(numbered,id).text),['1','2','3','4','5','6','7','8','9']);
assert.equal(numbered.panels[ids[2]].label.manual,false,'explicit restore-auto removes a manual override');
numbered.panels[ids[0]].label.x=8;
assert.equal(numberPanelLabels(numbered,'lower',label('')).panels[ids[0]].label.x,8,'renumbering preserves label placement');

const s=copy(initial);s.panels[ids[0]].edits={0:{e3:{fill:'#123456'}}};s.panels[ids[0]].lockedElements={0:['e4']};s.panels[ids[1]].locked=true;
s.overlays=[{id:'annotation-1',type:'text',x:.1,y:.1,w:.1,h:.1,text:'Note',font:'Arial',size:10,color:'#123456',opacity:1,stroke:1,locked:false,fill:false},{id:'annotation-2',type:'text',x:.2,y:.1,w:.1,h:.1,text:'Protected',font:'Arial',size:10,color:'#123456',opacity:1,stroke:1,locked:true,fill:false}];
const original=JSON.stringify(s),deleted=removeSelectedItems(s,{groups:[{id:ids[0],vi:0,keys:['e3','e3','e4']},{id:ids[1],vi:0,keys:['e3']}],annotations:['annotation-1','annotation-2']});
assert.equal(deleted.removed,2);assert.equal(deleted.next.panels[ids[0]].edits[0].e3.hidden,'true');assert.equal(deleted.next.panels[ids[0]].edits[0].e3.fill,'#123456');
assert.equal(deleted.next.panels[ids[0]].edits[0].e4,undefined);assert.deepEqual(deleted.next.overlays.map(x=>x.id),['annotation-2']);
assert.equal(JSON.stringify(s),original);assert.deepEqual(deleted.next.order,s.order);assert.deepEqual(deleted.next.grid,s.grid);assert.equal(Object.keys(deleted.next.panels).length,9);
validateState(deleted.next,project);const history=new History(s);history.commit(deleted.next);history.undo();assert.equal(JSON.stringify(history.current),original);history.redo();assert.equal(history.current.panels[ids[0]].edits[0].e3.hidden,'true');
assert.equal(History.restore(JSON.parse(JSON.stringify(history.toJSON())),project,history.current).current.panels[ids[0]].edits[0].e3.hidden,'true');
const bad=copy(deleted.next);bad.panels[ids[0]].edits[0].e3.hidden='false';assert.throws(()=>validateState(bad,project));
assert.equal(removeSelectedItems(s,{labelId:ids[0]}).next.panels[ids[0]].label,undefined);assert.ok(removeSelectedItems(s,{labelId:ids[1]}).next.panels[ids[1]].label,'locked label protected');
assert.deepEqual(removeSelectedItems(s).next.order,s.order,'no selected object never removes a panel');

// Execute the actual edit-application block; hidden state reaches both canvas and export.
const editsStart=source.indexOf('    if (!raw) for (const [key, props] of Object.entries(editsFor(id,vi,s))) {');
assert.ok(editsStart>=0,'the production source-edit loop must exist');
// Stop at this loop's own closing brace, not at a later rendering feature.
// Spacing/statistics may add early returns between those unrelated blocks.
const editsClose=source.slice(editsStart).match(/^ {4}\}/m);
assert.ok(editsClose,'the source-edit loop must have its own closing brace');
const editsEnd=editsStart+editsClose.index+editsClose[0].length;
const editDOM=new (require('jsdom').JSDOM)('<!doctype html>'),editSVG=editDOM.window.document.createElementNS('http://www.w3.org/2000/svg','svg'),node=editDOM.window.document.createElementNS('http://www.w3.org/2000/svg','text');node.setAttribute('data-key','e3');node.textContent='Source text';editSVG.append(node);
const ctx={preparePositionedTextEdit:require(file).preparePositionedTextEdit,raw:false,id:ids[0],vi:0,s:deleted.next,editsFor:()=>deleted.next.panels[ids[0]].edits[0],svg:editSVG};
const editIndexer=source.split('\n').find(line=>line.trimStart().startsWith('let editNodeIndex='));assert.ok(editIndexer,'extract the production shared key index with its consuming edit loop');
vm.runInNewContext(editIndexer+'\n'+source.slice(editsStart,editsEnd),ctx);assert.equal(node.style.display,'none');assert.equal(node.textContent,'Source text');editDOM.window.close();
assert.match(source,/const STYLES = new Set\(\['display'/,'hidden appearance survives sanitized SVG reimport');

// Actual keyboard listener: normal inputs, contenteditable and IME own their keys.
let keyboard,deleteCalls=0,undoCalls=0;let groups=[{id:ids[0],vi:0,keys:['e3']}];
const keyboardLine=source.split('\n').find(line=>line.includes("document.addEventListener('keydown',e=>{if(e.isComposing||editingTextTarget"));
assert.ok(keyboardLine);
vm.runInNewContext(keyboardLine,{document:{addEventListener:(_,handler)=>keyboard=handler,querySelector:()=>null},editingTextTarget,selectionGroups:()=>groups,selectedAnnotations:[],selectedPanelLabel:null,selectedAlignmentGuide:null,panelSelection:[],selectedEmptyCell:null,deleteSelectedObjects:()=>deleteCalls++,$:()=>({click:()=>undoCalls++})});
function press(key,target={closest:()=>null},extra={}){let prevented=false;keyboard({key,target,ctrlKey:false,metaKey:false,altKey:false,isComposing:false,preventDefault(){prevented=true;},...extra});return prevented;}
assert.equal(press('Delete'),true);assert.equal(press('Backspace'),true);assert.equal(deleteCalls,2);
for(const target of [{closest:()=>({tagName:'INPUT'})},{closest:()=>({tagName:'TEXTAREA'})},{closest:()=>({tagName:'SELECT'})},{isContentEditable:true,closest:()=>null}]){assert.equal(press('Delete',target),false);assert.equal(press('Backspace',target),false);}
assert.equal(press('Delete',undefined,{isComposing:true}),false);assert.equal(deleteCalls,2);
groups=[];assert.equal(press('Delete'),false);assert.equal(press('Backspace'),false);assert.equal(deleteCalls,2);
assert.equal(press('z',undefined,{ctrlKey:true}),true);assert.equal(undoCalls,1);

// Real label buttons: manual text, automatic reset, style change and position preservation.
let labelState=copy(initial);const fields={};for(const id of ['labelX','labelY','labelSize','font','labelBold','labelStyle','numberPanels','autoNumberLabels','applyPanelLabel','removePanelLabel','deleteElements','panelLabel'])fields[id]={value:'',checked:false,click(){this.onclick?.();}};
Object.assign(fields.labelX,{value:'8'});Object.assign(fields.labelY,{value:'6'});Object.assign(fields.labelSize,{value:'13'});fields.font.value='Arial';fields.labelBold.checked=true;fields.labelStyle.value='upper';
const labelsStart=source.indexOf('  const labelValues=text=>'),labelsEnd=source.indexOf("  $('groupSelection').onclick=",labelsStart);
const labelsContext={copy,state:()=>labelState,$:id=>fields[id],selectedPanel:ids[0],displayedPanelLabel,numberPanelLabels,currentOutput:()=>({scale:1}),say(){},deleteSelectedObjects(){},T:s=>s,commit(next){validateState(next,project);labelState=next;}};
vm.runInNewContext(source.slice(labelsStart,labelsEnd),labelsContext);
fields.panelLabel.value='Overview';fields.applyPanelLabel.click();assert.equal(labelState.panels[ids[0]].label.manual,true);assert.equal(displayedPanelLabel(labelState,ids[0]).text,'Overview');
fields.autoNumberLabels.checked=false;fields.autoNumberLabels.onchange();assert.equal(labelState.labelNumbering,false);const frozen=copy(labelState);labelState=movePanel(labelState,ids[3],2,2);assert.equal(displayedPanelLabel(labelState,ids[3]).text,frozen.panels[ids[3]].label.text);
fields.autoNumberLabels.checked=true;fields.autoNumberLabels.onchange();assert.equal(labelState.labelNumbering,'upper');assert.equal(labelState.panels[ids[0]].label.manual,false);
fields.labelStyle.value='lower';fields.labelStyle.onchange();assert.deepEqual(visualPanelOrder(labelState).map(id=>displayedPanelLabel(labelState,id).text),[...'abcdefghi']);
assert.equal(labelState.panels[ids[0]].label.x,8);assert.equal(labelState.panels[ids[0]].label.y,6);
fields.removePanelLabel.click();assert.equal(labelState.panels[ids[0]].label,undefined);assert.equal(labelState.order.length,9);

// Actual pointer handlers and label selection helper: click keeps the SVG alive,
// drag preserves the pointer-to-label offset, and double-click focuses editing.
let dragState=copy(baseline),dragCommits=0,selectionRefreshes=0,focused=0,captureTarget=null,inspectorBuilds=0;
const labelNode={dataset:{panelLabel:ids[0]},attrs:{},getAttribute:key=>key==='data-panel-label'?ids[0]:null,setAttribute(k,v){this.attrs[k]=+v;}};
labelNode.closest=selector=>['[data-panel-label]','text'].includes(selector)?labelNode:null;
labelNode.setPointerCapture=()=>{captureTarget=labelNode;};
const pointTarget=labelNode;
const svg={classList:{add(){},remove(){}},closest:()=>null,getBoundingClientRect:()=>({left:100,top:50,width:1440,height:1008}),setPointerCapture(){captureTarget=svg;},querySelector:()=>labelNode};
fields.panelLabelControls={open:false,scrollIntoView(){}};fields.panelLabel.focus=()=>focused++;fields.panelLabel.select=()=>focused++;
const dragFrames=new Map();let dragFrameId=0;
const dragContext={requestAnimationFrame(fn){const id=++dragFrameId;dragFrames.set(id,fn);return id;},cancelAnimationFrame(id){dragFrames.delete(id);},copy,svg,NS:'svg',T:s=>s,visualPanelOrder,displayedPanelLabel,panelNumberStyle,state:()=>dragState,$:id=>fields[id],inspectorPanel:null,
  document:{querySelectorAll:()=>[]},window:{getSelection:()=>({removeAllRanges(){}})},cancelQueuedZoom(){},
  renderDataEditor(){},renderMethods(){},renderInspector(){inspectorBuilds++;dragContext.inspectorPanel=ids[0];},renderSelectionProperties(){},renderLabelControls(){fields.panelLabel.value=displayedPanelLabel(dragState,ids[0]).text;},
  zoomView:{refreshSelection(){selectionRefreshes++;}},drawSelection(){selectionRefreshes++;},say(){},
  startInlineTextEdit(node){assert.equal(node,labelNode);focused++;},
  drawAlignmentGuides(){},renderAlignmentGuideControls(){},snapLayer:{replaceChildren(){}},alignmentContext:()=>({}),
  snappedDelta:(_,origin,event)=>({dx:(event.clientX-origin.x)/2,dy:(event.clientY-origin.y)/2,guides:[]}),
  commit(next){validateState(next,project);dragState=next;dragCommits++;},
  l:{width:720,height:504,positions:[{id:ids[0],x:0,y:0,width:240,height:168}]}
};
const selectStart=source.indexOf('  function selectPanelLabel('),selectEnd=source.indexOf('  function setEdit(',selectStart);
const pointerStart=source.indexOf('    svg.onpointerdown=e=>{'),pointerEnd=source.indexOf('    svg.onpointercancel=',pointerStart);
const behindStart=source.indexOf('    const behindTarget=target=>'),behindEnd=pointerStart;
assert.ok(behindStart>=0&&behindEnd>behindStart,'the real overlap-selection helpers precede pointer routing');
const doubleClick=source.split('\n').find(line=>line.includes('svg.ondblclick=event=>'));
const clickStart=source.indexOf('    svg.onclick=event=>{',pointerStart),clickEnd=source.indexOf('    viewport.onpointerdown=',clickStart);
vm.createContext(dragContext);
vm.runInContext(`let labelDrag=null,overlayDrag=null,elementDrag=null,guideDrag=null,marquee=null,suppressClick=false,pending=null,layoutMode=false,boxSelect=false,resizeDrag=null,panelDrag=null,ghost=null,dragging=null,original=false,selectedPanel='${ids[0]}',selected=[],elementSelections=[],selectionAnchor=null,selectedAnnotations=[],panelSelection=[],selectedPanelLabel=null,selectionAfterMarquee=false,activePane='explore',selectedAlignmentGuide=null;
let contentSelection=null;
${source.slice(source.indexOf('function panelContentDelta('),source.indexOf('function nudgeSelectionState('))}
${source.slice(source.indexOf('    const captureLabelMotion='),source.indexOf('    const selectedDragItems='))}
${source.slice(source.indexOf('  function selectionGroups(){'),source.indexOf('  const sizeNames='))}
${source.slice(selectStart,selectEnd)}
${source.slice(behindStart,behindEnd)}
${source.slice(pointerStart,pointerEnd)}
${doubleClick}
${source.slice(clickStart,clickEnd)}
globalThis.selectedLabel=()=>selectedPanelLabel;`,dragContext);
const pointer=(x=120,y=80)=>({button:0,shiftKey:false,target:pointTarget,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
svg.onpointerdown(pointer());svg.onpointerup(pointer());
assert.equal(dragCommits,0,'selecting a label does not add a history step');assert.equal(dragContext.selectedLabel(),ids[0]);assert.equal(fields.panelLabelControls.open,true);
const noMove={x:dragState.panels[ids[0]].label.x,y:dragState.panels[ids[0]].label.y};
svg.onpointerdown(pointer());svg.onpointermove(pointer(121,81));svg.onpointerup(pointer(121,81));
assert.equal(dragCommits,0);assert.equal(dragState.panels[ids[0]].label.x,noMove.x);assert.equal(dragState.panels[ids[0]].label.y,noMove.y);
svg.onpointerdown(pointer());svg.onpointermove(pointer(168,113.6));svg.onpointerup(pointer(168,113.6));
assert.equal(dragCommits,1);assert.ok(Math.abs(dragState.panels[ids[0]].label.x-12)<1e-9);assert.ok(Math.abs(dragState.panels[ids[0]].label.y-15)<1e-9);
assert.equal(labelNode.attrs.x,28.8);assert.ok(Math.abs(labelNode.attrs.y-25.2)<1e-9);assert.ok(selectionRefreshes>0);
// Model native capture retargeting: pointerup and its generated click use the
// capture target. Two complete down/up/click sequences precede dblclick.
function capturedClick(detail){
  captureTarget=null;
  const down=pointer();svg.onpointerdown(down);
  const clickTarget=captureTarget||down.target;
  svg.onpointerup({...pointer(),target:clickTarget});
  captureTarget=null;
  const click={...pointer(),target:clickTarget,detail};svg.onclick(click);
  return click;
}
focused=0;
const firstClick=capturedClick(1);assert.equal(firstClick.target,labelNode,'capture must preserve the label as native click target');
assert.equal(focused,0,'a single click selects without stealing input focus');
const secondClick=capturedClick(2);svg.ondblclick(secondClick);
assert.equal(focused,1,'full native down/up/click/dblclick sequence opens the clicked label in the shared inline editor');
assert.equal(inspectorBuilds,1,'repeated label clicks reuse the inspector instead of rebuilding all chart previews');
assert.equal(dragCommits,1,'two click sequences do not create drag history');
svg.ondblclick({...pointer(),target:svg});assert.equal(focused,1,'a double-click elsewhere never edits an earlier label');
dragState.panels[ids[0]].locked=true;svg.onpointerdown(pointer());svg.onpointermove(pointer(200,180));assert.equal(dragCommits,1,'locked label cannot start a new drag');

console.log('Source deletion and labels passed: hidden edits, locks, undo/reopen, keyboard text/IME guards, visual numbering, legacy initial-state migration, custom/manual controls, actual label click/double-click/drag, threshold and pointer-offset preservation.');
