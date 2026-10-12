/* Execute the palette reducer and preview-card rendering with real scalar color mapping. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(file,'utf8');
const {SWATCH_SCHEMES,swatchSchemeFor,heatmapCellInfo,heatmapPaletteColor,History}=require('../'+file);
const clone=value=>JSON.parse(JSON.stringify(value));
const scalar=value=>{const b=Buffer.alloc(8);b.writeDoubleBE(value);return b.toString('hex');};
class Node {
  constructor(id='',key='',fill='none'){this.id=id;this.key=key;this.fill=fill;this.stroke='none';this.localName='path';this.children=[];this.style={setProperty(){}};this.attributes={};this.parentElement=null;}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(name,value){this.attributes[name]=String(value);}
  getAttribute(name){return name==='data-key'?this.key:this.attributes[name]??null;}
  querySelectorAll(selector){return selector==='[data-key]'?this.objects||[]:[];}
}
const assets={};
for(const [id,kind,legacy]of [['H','diverging',false],['S','sequential',false],['L','diverging',true]]){
  const root=new Node(),meta=new Node('studio-heat-value-0-'+scalar(-2)+'-3f6da3-1-1'+(legacy?'':'-'+scalar(0)+'-'+(kind==='diverging'?'d':'s')+'-'+scalar(.4)));
  const cellGroup=new Node('studio-heat-box-0'),scaleGroup=new Node('studio-heat-scale-s-'+scalar(.4)+'-'+scalar(0)),box=new Node('','cell','#3f6da3'),scale=new Node('','legend','#3f6da3'),label=new Node('','label','#000000');
  cellGroup.parentElement=root;scaleGroup.parentElement=root;box.parentElement=cellGroup;scale.parentElement=scaleGroup;label.parentElement=root;
  box.style.opacity='0'; // Native heatmaps use hidden vector hit-boxes over their original mesh.
  root.objects=[box,scale,label];root.meta=meta;assets[id]=root;
}
assets.C=new Node();assets.C.objects=[new Node('','cat1','#3f6da3'),new Node('','cat2','#c95770'),new Node('','axis','#000000')];
assets.R=new Node();assets.R.objects=Array.from({length:9},(_,i)=>new Node('','e'+i,'#'+(0x254f90+i*0x070501).toString(16)));
for(const root of Object.values(assets))root.querySelector=selector=>selector.includes('studio-heat-value-')?root.meta||null:root.objects.find(el=>el.key===selector.match(/"([^"]+)"/)?.[1])||null;
let chart={order:Object.keys(assets),panels:Object.fromEntries(Object.keys(assets).map(id=>[id,{variant:0,edits:{}}]))};
chart.panels.H.edits={0:{cell:{fill:'#00ff00',opacity:'.65','offset-x':'4'},legend:{fill:'#ff0000'},label:{'font-size':'12'}}};
let history=new History(chart),renders=0,svgRenders=0;
const timers=new Map();let timerId=0;const flushTimers=()=>{for(const [id,run]of [...timers]){timers.delete(id);run();}};
const elements=Object.fromEntries(['scope','palettes','complementPreview'].map(id=>[id,new Node()]));elements.scope.value='panel';
const context={SWATCH_SCHEMES,swatchSchemeFor,heatmapCellInfo,copy:clone,$:id=>elements[id],selectedPanel:'H',state:()=>history.current,panel:()=>({variants:[{}]}),baseSvg:id=>assets[id],
  editedSvg:(id,vi,s=history.current)=>{svgRenders++;return {objects:assets[id].objects,querySelector:assets[id].querySelector,renderedColor:s.panels[id].heatmapPalette?heatmapPaletteColor(.2,s.panels[id].heatmapPalette,.4):'#3f6da3'};},
  targetObjects:(id,vi,svg)=>elements.scope.value==='element'?[assets[id].objects[0]]:svg.objects,keysToObjects:svg=>svg.objects.filter(node=>node.style.opacity!=='0'),
  hex:value=>/^#[\da-f]{6}$/.test(value)?value:null,paint:(el,prop)=>el?.[prop],chromatic:value=>{const c=value.slice(1).match(/../g).map(v=>parseInt(v,16));return Math.max(...c)-Math.min(...c)>18;},
  setEdit:(next,id,vi,key,prop,value)=>{const p=next.panels[id];p.edits[vi]??={};p.edits[vi][key]??={};p.edits[vi][key][prop]=value;},
  document:{createElement:()=>new Node()},button:(text,onclick)=>Object.assign(new Node(),{textContent:text,onclick}),T:value=>value,
  preview:svg=>svg,commit:next=>history.commit(next),renderCanvas:()=>renders++,say(){},drawColorSwatches(){},
  setTimeout:run=>{timers.set(++timerId,run);return timerId;},clearTimeout:id=>timers.delete(id)};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('  function paletteHeatmapInfo('),source.indexOf('  function preview(')),context);
vm.runInContext(source.slice(source.indexOf('  function drawPalettes('),source.indexOf('  function updateConditionMatrix(')),context);
context.selectedPanel=undefined;
assert.equal(context.paletteHeatmapInfo(),null,'The initial swatches must render before project/history initialization');
context.selectedPanel='H';
const original=JSON.stringify(history.current);
for(const scheme of SWATCH_SCHEMES){
  const next=context.paletteState(scheme.colors,scheme);
  assert.deepEqual(clone(next.panels.H.heatmapPalette.stops),scheme.continuousStops);
  assert.deepEqual(clone(next.panels.H.edits[0].cell),{opacity:'.65','offset-x':'4'});
  assert.equal(next.panels.H.edits[0].legend,undefined);
  assert.equal(next.panels.H.edits[0].label['font-size'],'12');
}
assert.equal(JSON.stringify(history.current),original,'Hover-preview state must not mutate saved colors or styles');
elements.scope.value='all';const all=context.paletteState(SWATCH_SCHEMES[1].colors,SWATCH_SCHEMES[1]);
assert.deepEqual(clone(all.panels.S.heatmapPalette.stops),SWATCH_SCHEMES[1].sequentialStops);
assert.equal(all.panels.C.edits[0].cat1.fill,SWATCH_SCHEMES[1].colors[0]);
assert.deepEqual(clone(all.panels.R.edits),{});assert.equal(all.panels.L.heatmapPalette,undefined);
elements.scope.value='element';const cell=context.paletteState(SWATCH_SCHEMES[1].colors,SWATCH_SCHEMES[1]);
assert.equal(cell.panels.H.heatmapPalette,undefined,'A selected cell must not recolor the entire matrix');
assert.equal(cell.panels.H.edits[0].cell.fill,SWATCH_SCHEMES[1].colors[0]);
elements.scope.value='panel';context.drawPalettes();
assert.equal(elements.palettes.children.length,8);
const cards=elements.palettes.children;
assert.ok(cards.every(card=>card.children[0].style.background.startsWith('linear-gradient(')));
assert.ok(cards.every(card=>card.children[0].children.length===0),'Heatmaps must use a continuous strip, not category chips');
assert.equal(new Set(cards.map(card=>card.children[1].renderedColor)).size,8,'Every scheme must alter the actual plotted color');
cards[1].onmouseenter();assert.equal(renders,0,'Pointer entry must not synchronously block a following click');flushTimers();assert.equal(renders,1);assert.equal(JSON.stringify(history.current),original);
cards[1].onclick();assert.deepEqual(clone(history.current.panels.H.heatmapPalette.stops),SWATCH_SCHEMES[1].continuousStops);
const afterClickRenders=renders;cards[1].onmouseleave();assert.equal(renders,afterClickRenders,'Leaving a committed card must not restore a previous hover frame');
history.undo();assert.equal(JSON.stringify(history.current),original);history.redo();assert.ok(history.current.panels.H.heatmapPalette);
for(const id of ['R','L']){context.selectedPanel=id;context.drawPalettes();assert.equal(elements.palettes.children.length,1);assert.equal(elements.palettes.children[0].className,'muted palette-unavailable');assert.equal(elements.palettes.children[0].onclick,undefined);}
context.selectedPanel='H';chart=clone(history.current);chart.panels.H.locked=true;history=new History(chart);
assert.equal(JSON.stringify(context.paletteState(SWATCH_SCHEMES[2].colors,SWATCH_SCHEMES[2])),JSON.stringify(chart));
// Seven size variants still need only the eight displayed SVG thumbnail renders.
chart=clone(chart);chart.panels.H.locked=false;chart.panels.H.edits={};history=new History(chart);context.panel=()=>({variants:Array.from({length:7},()=>({}))});
svgRenders=0;context.drawPalettes();assert.equal(svgRenders,8,'Preparing eight palettes must not perform 56 hidden heatmap SVG renders');
const quickCard=elements.palettes.children[2],beforeQuick=renders;
quickCard.onmouseenter();assert.equal(timers.size,1);quickCard.onpointerdown({button:0});assert.equal(timers.size,0);quickCard.onclick();flushTimers();assert.equal(renders,beforeQuick,'An immediate click cancels the unneeded hover draw');
// A card made before another edit must commit from the latest state.
context.drawPalettes();const staleCard=elements.palettes.children[3],fresh=clone(history.current);fresh.panels.H.edits={0:{label:{'font-size':'19'}}};history.commit(fresh);
staleCard.onclick();assert.equal(history.current.panels.H.edits[0].label['font-size'],'19');
assert.deepEqual(clone(history.current.panels.H.heatmapPalette.stops),SWATCH_SCHEMES[3].continuousStops);
console.log('8 real-color preview cards, scalar/sequential scopes, old metadata/ROC guards, style preservation, single-cell edits, locks and undo/redo; seven-size render budget, cancellable hover, committed leave and latest-state clicks passed.');
