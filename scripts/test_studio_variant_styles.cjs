/* Semantic style transfer across size variants; no browser or DOM package required. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const filename='skills/polish-sci-figures/assets/figure-studio/studio.js';
const {svgElementSignature,svgElementMap,transferVariantEdits,resizePanel,gridFor,arrange,History,validateState,heatmapCellInfo}=require('../'+filename);
class Element {
  constructor(tag,attrs={},text='',children=[]){this.localName=tag;this.attrs=attrs;this.content=text;this.children=children;for(const child of children)child.parentElement=this;this.dataset=new Proxy({},{get:(_,key)=>this.attrs['data-'+key],set:(_,key,value)=>{this.attrs['data-'+key]=value;return true;}});}
  get id(){return this.attrs.id||'';}
  get textContent(){return this.content+this.children.map(child=>child.textContent).join('');}
  getAttribute(name){return this.attrs[name]??null;}
  cloneNode(){return new Element(this.localName,{...this.attrs},this.content,this.children.map(child=>child.cloneNode(true)));}
  querySelectorAll(selector){const matches=node=>selector==='[data-key]'?'data-key'in node.attrs:selector==='text'?node.localName==='text':selector.startsWith('[id^=')?node.id.startsWith(selector.slice(6,-2)):false;
    const result=[];const visit=node=>{for(const child of node.children){if(matches(child))result.push(child);visit(child);}};visit(this);return result;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const node=(tag,id,text='',children=[])=>new Element(tag,id?{id}: {},text,children);
function keys(root){let serial=0;const visit=element=>{element.attrs['data-key']='e'+serial++;element.children.forEach(visit);};visit(root);return root;}
function fixture(values,serial){
  const axis=(direction,labels)=>node('g',direction==='x'?'matplotlib.axis_1':'matplotlib.axis_2','',[
    ...labels.map((value,i)=>node('g',direction+'tick_'+(i+1),'',[
      node('g','line2d_'+serial++,'',[node('path','')]),
      node('g','text_'+serial++,'',[node('text','',String(value))])])),
    node('g','text_'+serial++,'',[node('text','',direction==='x'?'Concentration':'Response')])]);
  const plot=node('g','axes_1','',[axis('x',[0,5,10]),axis('y',values),
    node('g','PathCollection_'+serial++,'',[node('use',''),node('use','')])]);
  return keys(node('svg','','',[node('g','figure_1','',[plot])]));
}
const from=fixture([0,5,10],1),to=fixture([0,2.5,5,7.5,10],40);
const text=(svg,axis,value)=>svg.querySelectorAll('text').find(el=>el.textContent===value&&svgElementSignature(el).includes('axis:'+axis+'/'));
const oldTick=text(from,'y','5'),newTick=text(to,'y','5'),newOther=text(to,'y','2.5');
const oldKey=oldTick.getAttribute('data-key'),newKey=newTick.getAttribute('data-key');
assert.notEqual(oldKey,newKey,'Fixture must move document-order keys');
assert.equal(svgElementSignature(oldTick),svgElementSignature(newTick));
assert.notEqual(svgElementSignature(oldTick),svgElementSignature(text(to,'x','5')));
assert.notEqual(svgElementSignature(oldTick),svgElementSignature(newOther));
const mapping=svgElementMap(from,to);assert.equal(mapping.get(oldKey),newKey);
const mark=root=>root.querySelectorAll('[data-key]').find(el=>el.localName==='use');
const oldMark=mark(from).getAttribute('data-key'),newMark=mark(to).getAttribute('data-key');
assert.equal(mapping.get(oldMark),newMark,'An inserted tick must not shift a data-mark edit');
const original={name:'compare_raincloud',size:'original',width:100,height:100,viewBox:[0,0,100,100]};
const target={name:'compare_raincloud',size:'spanWide',width:200,height:100,viewBox:[0,0,400,200]};
const props={'font-size':'12','font-family':'Arial','font-weight':'700',fill:'#3f6da3',opacity:'.4','offset-x':'7','offset-y':'-3'};
const panel={variant:0,edits:{0:{[oldKey]:props,[oldMark]:{'stroke-width':'2',fill:'none',stroke:'#c95770'}},1:{[newKey]:{'font-size':'8','text':'stale'}}},lockedElements:{0:[oldKey,oldMark]},elementGroups:{0:[[oldKey,oldMark]]}};
const snapshot=JSON.stringify(panel),transferred=transferVariantEdits(panel,0,1,mapping,original,target);
assert.equal(JSON.stringify(panel),snapshot,'Source state must remain immutable for undo');
assert.equal(transferred.edits[1][newKey]['font-size'],'24','12 pt must survive a viewBox unit change');
assert.equal(transferred.edits[1][newMark]['stroke-width'],'4');
for(const property of ['font-family','font-weight','fill','opacity','offset-x','offset-y'])assert.equal(transferred.edits[1][newKey][property],props[property]);
assert.equal(transferred.edits[1][newKey].text,undefined,'Stale target overrides must not reappear');
assert.deepEqual(transferred.lockedElements[1],[newKey,newMark]);
assert.deepEqual(transferred.elementGroups[1],[[newKey,newMark]]);
assert.equal(transferred.edits[1][newOther.getAttribute('data-key')],undefined,'Never redirect 5 to 2.5 by tick index');
const back=transferVariantEdits(transferred,1,0,svgElementMap(to,from),target,original);
assert.deepEqual(back.edits[0][oldKey],props);assert.deepEqual(back.lockedElements[0],panel.lockedElements[0]);
// Disappearing ticks remain archived with the source variant, not copied to another tick.
const missing=text(to,'y','7.5').getAttribute('data-key');transferred.edits[1][missing]={'fill':'#123456'};
const smaller=transferVariantEdits(transferred,1,0,svgElementMap(to,from),target,original);
assert.equal(smaller.edits[1][missing].fill,'#123456');
assert.ok(!Object.values(smaller.edits[0]).some(entry=>entry.fill==='#123456'));
// Real matchSizes path, followed by undo/redo, preserves font/color/locks/groups.
const state=arrange({order:['panel-0'],columns:3,gap:12,panels:{'panel-0':panel}},3,3);
const project={panels:[{id:'panel-0',variants:[original,target]}]},history=new History(state);
const script=fs.readFileSync(filename,'utf8'),start=script.indexOf('  function matchSizes('),end=script.indexOf('  function moveWithSizes(',start);
const context={$:()=>({checked:true}),gridFor,panel:()=>project.panels[0],state:()=>history.current,layout:()=>({positions:[]}),
  fittedVariant:()=>null,baseSvg:(_,index)=>index===0?from:to,svgElementMap,transferVariantEdits};
vm.createContext(context);vm.runInContext(script.slice(start,end),context);
const resized=context.matchSizes(resizePanel(history.current,'panel-0',1,2));validateState(resized,project);history.commit(resized);
assert.equal(history.current.panels['panel-0'].variant,1);
assert.equal(history.current.panels['panel-0'].edits[1][newKey]['font-size'],'24');
history.undo();assert.equal(history.current.panels['panel-0'].edits[0][oldKey]['font-size'],'12');
history.redo();assert.equal(history.current.panels['panel-0'].edits[1][newKey]['font-size'],'24');
const untouched=JSON.parse(JSON.stringify(state));untouched.panels['panel-0']={variant:0,edits:{}};
context.state=()=>untouched;context.baseSvg=()=>{throw Error('Unedited previews should not parse both SVGs');};
assert.equal(context.matchSizes(resizePanel(untouched,'panel-0',1,2)).panels['panel-0'].variant,1);
// An old saved heatmap acquires scalar metadata without renumbering user edits.
const scalar=value=>{const b=Buffer.alloc(8);b.writeDoubleBE(value);return b.toString('hex');};
function heatFixture(upgraded=false){
  const items=upgraded?[node('g','studio-heat-source-0','',[node('path','')])]:[];
  for(let index=0;index<2;index++){
    items.push(node('g','studio-heat-box-'+index,'',[node('path','')]));
    // Equal numeric values in different cells must still have different identities.
    const id='studio-heat-value-'+index+'-'+scalar(.5)+'-'+(upgraded?'c95770':'3f6da3')+'-1-1'+(upgraded?'-'+scalar(.7)+'-d-'+scalar(.4):'');
    items.push(node('g',id,'',[node('text','',index?'0.50':'0.5')]));
  }
  return keys(node('svg','','',[node('g','figure_1','',[node('g','axes_1','',items)])]));
}
const oldHeat=heatFixture(),newHeat=heatFixture(true),heatMap=svgElementMap(oldHeat,newHeat);
const oldCells=oldHeat.querySelectorAll('text'),newCells=newHeat.querySelectorAll('text');
assert.equal(svgElementSignature(oldCells[0]),svgElementSignature(newCells[0]),'Metadata normalization and rendered formatting must not break a cell identity');
assert.notEqual(svgElementSignature(oldCells[0]),svgElementSignature(newCells[1]),'Equal-value cells retain their row/column identity');
for(let i=0;i<2;i++)assert.equal(heatMap.get(oldCells[i].getAttribute('data-key')),newCells[i].getAttribute('data-key'));
const heatOldKey=oldCells[0].getAttribute('data-key'),heatOldOther=oldCells[1].getAttribute('data-key');
const heatState={variant:0,edits:{0:{[heatOldKey]:{'font-size':'14','offset-x':'5','offset-y':'-2',hidden:'true'},[heatOldOther]:{fill:'#123456'}}},lockedElements:{0:[heatOldKey]},elementGroups:{0:[[heatOldKey,heatOldOther]]}};
const heatSnapshot=JSON.stringify(heatState),heatProject={heatmapRenders:{'panel-0/0':{svg:'enriched'}}},heatCache=new Map();
const upgradeContext={project:heatProject,templateCache:heatCache,panel:()=>({variants:[{svg:'source'}]}),sanitize:text=>(text==='source'?oldHeat:newHeat).cloneNode(true),svgElementMap};
vm.createContext(upgradeContext);
vm.runInContext(script.slice(script.indexOf('  function baseSvg('),script.indexOf('  const heatmapUpgradeRequests=')),upgradeContext);
const enriched=upgradeContext.baseSvg('panel-0',0),upgradedCells=enriched.querySelectorAll('text');
assert.equal(upgradedCells[0].getAttribute('data-key'),heatOldKey);
assert.equal(upgradedCells[1].getAttribute('data-key'),heatOldOther);
assert.equal(heatState.edits[0][upgradedCells[0].getAttribute('data-key')]['font-size'],'14');
assert.equal(heatState.edits[0][upgradedCells[0].getAttribute('data-key')]['offset-x'],'5');
assert.equal(heatState.edits[0][upgradedCells[0].getAttribute('data-key')].hidden,'true');
assert.ok(heatState.lockedElements[0].includes(upgradedCells[0].getAttribute('data-key')));
assert.deepEqual(heatState.elementGroups[0][0],upgradedCells.map(cell=>cell.getAttribute('data-key')));
assert.equal(JSON.stringify(heatState),heatSnapshot,'Asset enrichment must never change the history state');
const enrichedKeys=enriched.querySelectorAll('[data-key]').map(el=>el.getAttribute('data-key'));
assert.equal(new Set(enrichedKeys).size,enrichedKeys.length,'New artists must not collide with retained old keys');
const freshArtist=enriched.querySelectorAll('[data-key]').find(el=>el.id==='studio-heat-source-0');assert.ok(+freshArtist.getAttribute('data-key').slice(1)>=3000000);
upgradedCells[0].attrs['data-key']='local-only';assert.equal(upgradeContext.baseSvg('panel-0',0).querySelectorAll('text')[0].getAttribute('data-key'),heatOldKey,'Consumers must receive a cloned enriched SVG');
const oldMetadataId=oldCells[0].parentElement.id,newMetadataId=newCells[0].parentElement.id;
const legacyRender={svg:`<svg><g id="${oldMetadataId}"/></svg>`},modernRender={svg:`<svg><g id="${newMetadataId}"/></svg>`};
const flowContext={heatmapCellInfo,reflowSpec:()=>({key:'heat-cache'}),project:{layoutRenders:{'heat-cache':legacyRender}}};
vm.createContext(flowContext);vm.runInContext(script.slice(script.indexOf('  function currentHeatmapMetadata('),script.indexOf('  function editableSource(')),flowContext);
assert.equal(flowContext.fittedVariant({},{}),null,'A legacy fitted SVG must not override an enriched base SVG');
flowContext.project.layoutRenders['heat-cache']=modernRender;assert.equal(flowContext.fittedVariant({},{}),modernRender);
assert.equal(flowContext.currentHeatmapMetadata({svg:'<svg><g id="axes_1"/></svg>'}),true,'Non-heatmap caches remain valid');
// Verify semantic matching against actual Matplotlib exports with different dimensions.
const files=['.cache/studio-reflow-qa/compare_raincloud_0.svg','.cache/studio-reflow-qa/compare_raincloud_1.svg'];
let actual=0;
if(files.every(file=>fs.existsSync(file))){
  const program="import json,sys,xml.etree.ElementTree as E\ndef tree(e):\n return dict(tag=e.tag.split('}')[-1],attrs=dict(e.attrib),text=e.text or '',children=[tree(c) for c in e if c.tag.split('}')[-1] not in ('metadata','style')])\nprint(json.dumps([tree(E.parse(p).getroot()) for p in sys.argv[1:]]))";
  const result=spawnSync('.venv/Scripts/python.exe',['-c',program,...files],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const inflate=obj=>new Element(obj.tag,obj.attrs,obj.text,obj.children.map(inflate));
  const [a,b]=JSON.parse(result.stdout).map(item=>keys(inflate(item))),map=svgElementMap(a,b);
  for(const el of a.querySelectorAll('text')){const signature=svgElementSignature(el),matching=b.querySelectorAll('text').find(other=>svgElementSignature(other)===signature);if(matching){assert.equal(map.get(el.getAttribute('data-key')),matching.getAttribute('data-key'));actual++;}}
  assert.ok(actual>=8,'Expected real axis labels and ticks to map across actual exports');
}
console.log(`Semantic size transfer passed: tick-value ancestry, marker style, physical text/stroke/offset units, locks/groups, missing ticks, matchSizes undo/redo; old/new heatmap metadata keys preserve fontsize/offset/hidden/lock/group edits; ${actual} actual SVG text matches.`);
