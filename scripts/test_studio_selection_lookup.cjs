/* Real DOM work counts and scope/history equivalence. These are bounded
 * regression checks, not browser latency or scientific-algorithm benchmarks. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/studio.js','utf8'),core=require('../skills/polish-sci-figures/assets/figure-studio/studio.js'),format=require('../skills/polish-sci-figures/assets/figure-studio/text-formatting.js');
const copy=x=>JSON.parse(JSON.stringify(x)),NS='http://www.w3.org/2000/svg';
function part(a,b){const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>=0&&end>start);return source.slice(start,end);}
let passed=0;function test(name,run){run();passed++;console.log('PASS '+name);}
function fixture(count=100){
 const dom=new JSDOM('<div id="artboard"></div>'),document=dom.window.document,board=document.getElementById('artboard'),svg=document.createElementNS(NS,'svg');svg.dataset.panel='p';board.append(svg);
 svg.innerHTML='<defs><rect data-key="e6"/></defs><text data-key="e1" fill="#4477aa">A<tspan data-key="e2">B</tspan></text><text data-key="e3" fill="#4477aa">C<tspan data-key="e4">D</tspan></text><g style="display:none"><path data-key="e5"/></g><g data-key="e7"><path data-key="e8" fill="#4477aa" stroke="none"/></g><path data-key="e9" fill="none" stroke="#4477aa"/><rect data-key="e10" fill="url(#gradient)"/><image data-key="e11" href="data:image/png;base64,AA=="/>'+Array.from({length:count},(_,i)=>`<rect data-key="e${i+100}" fill="#4477aa" stroke="none"/>`).join('');
 const before=svg.outerHTML,history=new core.History({order:['p'],panels:{p:{variant:0,edits:{0:{}}}},overlays:[]}),fields={scope:{value:'element'},textRole:{value:'all'},channel:{value:'both'}},stats={visibility:0,drawScans:0,keyScans:0,queries:0,descendantScans:0},scan=dom.window.Element.prototype.querySelectorAll,query=svg.querySelector;
 dom.window.Element.prototype.querySelectorAll=function(selector){if(this===svg&&selector==='path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use,image')stats.drawScans++;if(selector==='[data-key]'){if(this===svg)stats.keyScans++;else stats.descendantScans++;}return scan.call(this,selector);};
 svg.querySelector=function(selector){if(selector.startsWith('[data-key='))stats.queries++;return query.call(this,selector);};
 const ctx={document,copy,history,selected:['e1'],selectedPanel:'p',selectedAnnotations:[],selectedLabelIds:()=>[],original:false,project:{panels:[{id:'p',analysis:{primary_test:{p_value:.032}},table:{rows:[['measurement'],['12.5']]},variants:[{width:100,viewBox:[0,0,100,100],svg:before}]}]},groups:[{id:'p',vi:0,keys:['e1']}],state:()=>history.current,$:id=>id==='artboard'?board:fields[id],selectionGroups:()=>ctx.groups,panel:()=>ctx.project.panels[0],editableSource:()=>svg,paint:format.paint,hex:format.hex,chromatic:format.chromatic,T:x=>x,say(){},currentOutput:()=>({scale:1}),editsFor:(id,vi,s=history.current)=>s.panels[id].edits[vi]||{},commit:next=>history.commit(next)};
 ctx.NS=NS;vm.createContext(ctx);vm.runInContext("const DRAW='path,rect,circle,ellipse,line,polyline,polygon,text,tspan,use,image';\n"+part('  function isVisibleObject(','  // Editor-only hit areas')+part('  function paint(','  function editsFor(')+part('  function setEdit(','  function manualPanelScale(')+part('  function targetObjects(','  function paletteHeatmapInfo(')+part('  function quickSelectedObjects(){','  function quickObjectTarget('),ctx);
 const visible=ctx.isVisibleObject;ctx.isVisibleObject=el=>{stats.visibility++;return visible(el);};
 return {ctx,svg,history,fields,stats,reset(){for(const key of Object.keys(stats))stats[key]=0;},keys:()=>Array.from(ctx.targetObjects('p',0,svg,'all'),el=>el.dataset.key),close(){assert.equal(svg.outerHTML,before,'property reads and style history never mutate source vectors');dom.window.close();}};
}
for(const count of [100,5000])test(count+' artists: one selected key does no unrelated visibility or lock work',()=>{
 const f=fixture(count);f.ctx.groups[0].keys=['e149'];assert.deepEqual(f.keys(),['e149']);assert.equal(f.stats.visibility,1);assert.equal(f.stats.drawScans,0);assert.equal(f.stats.keyScans,0);assert.equal(f.stats.descendantScans,0);assert.equal(f.stats.queries,1);
 f.reset();f.ctx.groups[0].keys=['e999999'];assert.deepEqual(f.keys(),[]);assert.equal(f.stats.visibility,0);assert.equal(f.stats.drawScans,0);
 f.reset();f.ctx.groups=[];assert.deepEqual(f.keys(),[]);assert.equal(f.stats.queries,0);assert.equal(f.stats.visibility,0);f.close();
});
test('small and large selections retain source order and use bounded key lookups',()=>{
 const f=fixture(5000);f.ctx.groups[0].keys=['e149','e102','e104','e102'];assert.deepEqual(f.keys(),['e102','e104','e149']);assert.equal(f.stats.visibility,3);assert.equal(f.stats.queries,3);
 f.reset();f.ctx.groups[0].keys=Array.from({length:1000},(_,i)=>'e'+(1099-i));const keys=f.keys();assert.equal(keys.length,1000);assert.equal(keys[0],'e100');assert.equal(keys[999],'e1099');assert.equal(f.stats.visibility,1000);assert.equal(f.stats.drawScans,1);assert.equal(f.stats.queries,0);assert.equal(f.stats.descendantScans,0);f.close();
});
test('selection scopes equal the previous implementation for hidden, defs, locked descendants, parents and roles',()=>{
 const f=fixture(),c=f.ctx,legacy=(kind='all')=>{const scope=f.fields.scope.value,selection=c.groups.find(g=>g.id==='p'&&g.vi===0),p=c.state().panels.p;if(p.locked)return [];let objects=c.keysToObjects(f.svg).filter(el=>![el,...el.querySelectorAll('[data-key]')].some(node=>(p.lockedElements?.[0]||[]).includes(node.dataset.key)));if(scope==='element')objects=selection?objects.filter(el=>selection.keys.includes(el.dataset.key)):[];else if(scope==='sameColor'){if(!selection)return [];const chosen=f.svg.querySelector(`[data-key="${c.selected[0]||''}"]`);if(!chosen)return [];const color=c.hex(c.paint(chosen,'fill'))||c.hex(c.paint(chosen,'stroke'));objects=objects.filter(el=>color&&['fill','stroke'].some(prop=>c.hex(c.paint(el,prop))===color));}if(kind==='text')objects=objects.filter(el=>el.matches('text,tspan')&&(scope==='element'||f.fields.textRole.value==='all'||el.dataset.role===f.fields.textRole.value));const included=new Set(objects);return objects.filter(el=>{for(let p=el.parentElement;p&&p!==f.svg;p=p.parentElement)if(included.has(p))return false;return true;}).map(el=>el.dataset.key);};
 const selected=['e149','e2','e1','e3','e4','e5','e6','e7','e8','e9','e10','e11'];
 for(const scope of ['element','sameColor','panel','all'])for(const locked of [[],['e2'],['e149']])for(const kind of ['all','text']){
  f.fields.scope.value=scope;c.groups=[{id:'p',vi:0,keys:selected}];c.state().panels.p.lockedElements={0:locked};assert.deepEqual(Array.from(c.targetObjects('p',0,f.svg,kind),el=>el.dataset.key),Array.from(legacy(kind)),`${scope}/${locked}/${kind}`);
 }
 f.fields.scope.value='element';c.groups[0].keys=['e9','e1','e2','e5','e6','e7'];c.state().panels.p.lockedElements={0:[]};assert.deepEqual(f.keys(),['e1','e9'],'small-key branch still excludes structural groups, defs, hidden and duplicate text children');c.state().panels.p.locked=true;assert.deepEqual(f.keys(),[]);f.close();
});
test('quick toolbar reads one live key without an index and never caches replaced descendants',()=>{
 const f=fixture(5000),c=f.ctx;c.groups[0].keys=['e2','e1'];const first=c.quickSelectedObjects();assert.equal(first.length,1);assert.equal(first[0].key,'e1');assert.equal(f.stats.keyScans,0);assert.equal(f.stats.queries,2);
 c.state().panels.p.lockedElements={0:['e2']};assert.equal(c.quickSelectedObjects()[0].locked,true);
 const old=f.svg.querySelector('[data-key="e1"]'),next=old.cloneNode(true);old.replaceWith(next);assert.equal(c.quickSelectedObjects()[0].el,next,'same-state semantic preview replacements cannot return a stale cached node');next.replaceWith(old);
 f.reset();c.groups[0].keys=Array.from({length:5000},(_,i)=>'e'+(i+100));assert.equal(c.quickSelectedObjects().length,5000);assert.equal(f.stats.keyScans,1);assert.equal(f.stats.queries,0);f.close();
});
test('real color handler keeps hollow/gradient/image rules, raw values, and exact undo/redo',()=>{
 const f=fixture(5000),c=f.ctx,raw=JSON.stringify(c.project),initial=copy(c.state());c.groups[0].keys=['e9','e10','e11','e149'];c.selected=['e9'];c.updateStyle('color','#c45770');assert.equal(f.history.index,1);const edits=c.state().panels.p.edits[0];assert.equal(edits.e9.stroke,'#c45770');assert.equal(edits.e9.fill,undefined);assert.equal(edits.e149.fill,'#c45770');assert.equal(edits.e10,undefined);assert.equal(edits.e11,undefined);const final=copy(c.state());assert.deepEqual(copy(f.history.undo()),initial);assert.deepEqual(copy(f.history.redo()),final);assert.equal(JSON.stringify(c.project),raw,'analysis, original measurements and source SVG are unchanged');f.close();
});
console.log(`PASS ${passed} selection lookup regressions`);
