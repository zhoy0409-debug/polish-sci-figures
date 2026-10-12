/* Palette choices update swatches only; applying a scheme is explicit and undoable. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='skills/polish-sci-figures/assets/figure-studio/studio.js';
const source=fs.readFileSync(file,'utf8');
const {SWATCH_SCHEMES,swatchSchemeFor,History}=require('../'+file);
const i18n=require('../skills/polish-sci-figures/assets/figure-studio/i18n.js');
assert.equal(SWATCH_SCHEMES.length,8);assert.equal(new Set(SWATCH_SCHEMES.map(s=>s.id)).size,8);
for(const scheme of SWATCH_SCHEMES){assert.equal(scheme.colors.length,6);assert.equal(new Set(scheme.colors).size,6);assert.ok(scheme.colors.every(c=>/^#[\da-f]{6}$/.test(c)));assert.equal(scheme.continuousStops.length,3);assert.equal(scheme.sequentialStops.length,2);assert.ok([...scheme.continuousStops,...scheme.sequentialStops].every(c=>/^#[\da-f]{6}$/.test(c)));assert.ok(i18n.en[scheme.name]);}
assert.equal(swatchSchemeFor('invalid').id,'research-red-blue');
const registry=fs.readFileSync('skills/make-sci-data-figures/scripts/gallery_registry.py','utf8');
const defaults=JSON.parse('['+registry.match(/COLORS=\[([^\]]+)\]/)[1].replaceAll("'",'"')+']');
assert.deepEqual(SWATCH_SCHEMES[0].colors.slice(0,3),defaults.slice(0,3));
assert.ok(SWATCH_SCHEMES[0].colors.every(color=>defaults.includes(color)),'Default colors must be from the actual gallery series');
assert.deepEqual(SWATCH_SCHEMES[0].continuousStops,[defaults[0],'#f4f5f7',defaults[1]]);
class Element {
  constructor(){this.children=[];this.attributes={};this.style={setProperty(){}};this.classList={add(){}};this.value='';}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(name,value){this.attributes[name]=String(value);}
}
const elements=Object.fromEntries(['swatchScheme','quickSwatches','recentSwatches','color','applySwatchScheme','applyColor','scope'].map(id=>[id,new Element()]));
elements.scope.value='panel';
const storage=new Map(),history=new History({colors:['#3f6da3','#c95770']});let selected=[],message='',applies=0,singleColors=0;
const context={SWATCH_SCHEMES,swatchSchemeFor,swatchScheme:SWATCH_SCHEMES[0].id,$:id=>elements[id],original:false,
  StudioI18n:i18n,T:i18n.t,document:{createElement:()=>new Element(),createElementNS:()=>new Element()},
  localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  button:(text,onclick)=>Object.assign(new Element(),{textContent:text,onclick}),syncColorControls(){},
  applyChosenColor(){singleColors++;},selectionGroups:()=>selected,state:()=>history.current,paletteHeatmapInfo:()=>null,
  paletteState:colors=>{applies++;return {colors:[...colors]};},commit:next=>history.commit(next),say:value=>message=value};
const begin=source.indexOf('  function drawColorSwatches('),end=source.indexOf("  $('color').oninput",begin);
assert.ok(begin>=0&&end>begin);vm.createContext(context);vm.runInContext(source.slice(begin,end),context);
context.drawColorSwatches();
assert.equal(elements.swatchScheme.children.length,8);assert.equal(elements.quickSwatches.children.length,8);
assert.deepEqual(elements.quickSwatches.children.slice(0,3).map(el=>el.title),defaults.slice(0,3).map(c=>c.toUpperCase()));
assert.deepEqual(elements.quickSwatches.children.slice(-2).map(el=>el.title),['#000000','#FFFFFF']);
const before=JSON.stringify(history.toJSON());
for(const scheme of SWATCH_SCHEMES){elements.swatchScheme.value=scheme.id;elements.swatchScheme.onchange();assert.equal(elements.quickSwatches.children[0].title,scheme.colors[0].toUpperCase());}
assert.equal(JSON.stringify(history.toJSON()),before);assert.equal(applies,0);assert.equal(singleColors,0);
assert.equal(storage.get('figure-studio:swatch-scheme'),'distinct');
elements.quickSwatches.children[0].onclick();assert.equal(singleColors,1,'One-color behavior must remain intact');
elements.scope.value='element';elements.applySwatchScheme.onclick();assert.equal(applies,0);assert.match(message,/选择/);
elements.scope.value='panel';elements.applySwatchScheme.onclick();assert.equal(applies,1);assert.equal(history.states.length,2);
assert.deepEqual(history.current.colors,SWATCH_SCHEMES.at(-1).colors);history.undo();assert.deepEqual(history.current.colors,['#3f6da3','#c95770']);
selected=[{id:'panel-0',keys:['e5']}];elements.scope.value='element';elements.applySwatchScheme.onclick();assert.equal(applies,2);
i18n.setLanguage('en');context.drawColorSwatches();assert.equal(elements.swatchScheme.children[0].textContent,'Research red–blue');
assert.equal(elements.swatchScheme.value,'distinct','Language switching must preserve the scheme');i18n.setLanguage('zh-CN');

// Execute the existing categorical palette reducer, including its continuous-scale guard.
const categorical=[{key:'e1',fill:'#3f6da3',stroke:'none'},{key:'e2',fill:'#c95770',stroke:'none'},
                   {key:'e3',fill:'#000000',stroke:'none'}];
const continuous=Array.from({length:8},(_,i)=>({key:'e'+(i+10),fill:'#'+(0x254f90+i*0x070501).toString(16),stroke:'none'}));
const assets={A:categorical,B:continuous};
const chart={order:['A','B'],panels:{A:{variant:0,edits:{}},B:{variant:0,edits:{}}}};
const svg=id=>({objects:assets[id],querySelector:selector=>selector.includes('studio-heat-value-')?null:assets[id].find(el=>el.key===selector.match(/"([^"]+)"/)[1])});
for(const item of [...categorical,...continuous])item.getAttribute=key=>key==='data-key'?item.key:null;
const reducer={$:()=>({value:'all'}),copy:x=>JSON.parse(JSON.stringify(x)),state:()=>chart,selectedPanel:'A',panel:()=>({variants:[{}]}),
  editedSvg:id=>svg(id),baseSvg:id=>svg(id),targetObjects:(id,vi,root)=>root.objects,keysToObjects:root=>root.objects,
  hex:value=>/^#[\da-f]{6}$/.test(value)?value:null,paint:(el,prop)=>el[prop],
  chromatic:value=>{const rgb=value.slice(1).match(/../g).map(n=>parseInt(n,16));return Math.max(...rgb)-Math.min(...rgb)>18;},
  setEdit:(next,id,vi,key,prop,value)=>{next.panels[id].edits[vi]??={};next.panels[id].edits[vi][key]??={};next.panels[id].edits[vi][key][prop]=value;}};
const paletteStart=source.indexOf('  function preparePaletteTargets('),paletteEnd=source.indexOf('  function preview(',paletteStart);
vm.createContext(reducer);vm.runInContext(source.slice(paletteStart,paletteEnd),reducer);
const changed=reducer.paletteState(SWATCH_SCHEMES[1].colors);
assert.equal(changed.panels.A.edits[0].e1.fill,SWATCH_SCHEMES[1].colors[0]);
assert.equal(changed.panels.A.edits[0].e3,undefined,'Black axis text must remain unchanged');
assert.deepEqual(changed.panels.B.edits,{},'A categorical scheme may not cycle across a continuous scale');
assert.deepEqual(chart.panels.A.edits,{},'Palette previews must preserve the original chart state');
console.log('8 scheme data, gallery-exact default, swatch-only switching, local preference, single color, explicit apply/undo, empty selection, translation and continuous-scale protection passed.');
