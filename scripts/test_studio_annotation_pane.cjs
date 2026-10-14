/* Inspector routing executes the real pane/reveal handlers. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const base=path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),html=fs.readFileSync(path.join(base,'studio.html'),'utf8'),source=fs.readFileSync(path.join(base,'studio.js'),'utf8');
const sections=[...html.matchAll(/<(?:section|div|details)\b([^>]*\bdata-pane="[^"]+"[^>]*)>/g)].map(match=>({id:match[1].match(/\bid="([^"]+)"/)?.[1],pane:match[1].match(/\bdata-pane="([^"]+)"/)[1]}));
for(const id of ['statisticalAnnotations','conditionMatrixControls']){
 const matches=sections.filter(section=>section.id===id);assert.equal(matches.length,1,id+' has exactly one inspector instance');assert.equal(matches[0].pane,'annotation',id+' belongs to the annotation pane');
 assert.equal([...html.matchAll(new RegExp(`\\bid="${id}"`,'g'))].length,1,'no duplicated controls or element IDs');
}
const nodes=sections.map(section=>({...section,hidden:false,getAttribute:key=>key==='data-pane'?section.pane:null})),tabs=['explore','detail','color','data','annotation'].map(pane=>({pane,attrs:{},getAttribute:key=>key==='data-tab'?pane:null,setAttribute(k,v){this.attrs[k]=v;}})),textRole={parentElement:{}},calls=[];
const ctx={imageLinks:null,imageInsets:null,imageColorUI:null,document:{querySelectorAll:selector=>selector==='[data-pane]'?nodes:tabs},$:()=>textRole,renderInspectorPreviews:()=>calls.push('previews'),renderCanvas:()=>calls.push('canvas'),mobileWorkspace:null};
const start=source.indexOf('  function showPane('),end=source.indexOf('  const state =',start);assert.ok(start>0&&end>start);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
for(const pane of ['detail','explore','data','color','annotation','detail','annotation']){
 ctx.showPane(pane,false);
 for(const node of nodes)assert.equal(node.hidden,node.pane!==pane,'switching tabs exposes only that pane, including statistical and condition controls');
 for(const tab of tabs)assert.equal(tab.attrs['aria-pressed'],String(tab.pane===pane));
 assert.equal(textRole.parentElement.hidden,pane!=='detail');
}
assert.equal(calls.filter(value=>value==='canvas').length,0,'pane-only changes do not force an unnecessary canvas repaint');

// Context-menu shortcuts discover the actual owning pane rather than always
// opening Properties, which left the moved annotation controls invisible.
const revealLine=source.split('\n').find(line=>line.includes('const reveal=(id,pane='));assert.ok(revealLine);
const targets={},opened=[],actions=new Map();
for(const [id,pane]of [['statisticalAnnotations','annotation'],['fontSize','detail']]){
 const details={tagName:'DETAILS',open:false,parentElement:null};targets[id]={parentElement:details,closest:()=>({getAttribute:()=>pane}),scrollIntoView:options=>{targets[id].scrolled=options.block;},focus:()=>{targets[id].focused=true;}};
}
const context={$:id=>targets[id],showPane:pane=>opened.push(pane),add:(label,action)=>actions.set(label,action)};
vm.createContext(context);vm.runInContext(revealLine+'\n'+source.split('\n').find(line=>line.includes("add('统计标注…',()=>reveal(")),context);
actions.get('统计标注…')();assert.deepEqual(opened,['annotation']);assert.equal(targets.statisticalAnnotations.parentElement.open,true);assert.equal(targets.statisticalAnnotations.scrolled,'nearest');assert.equal(targets.statisticalAnnotations.focused,true);
vm.runInContext("reveal('fontSize');",context);assert.deepEqual(opened,['annotation','detail'],'other shortcuts retain their own Properties pane');
console.log('PASS annotation inspector: unique controls, annotation-only tab visibility, accessible tab state, context-menu pane routing and reveal.');
