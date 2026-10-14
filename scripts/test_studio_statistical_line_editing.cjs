'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const file='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(file),'utf8'),helpers=require(file),copy=x=>JSON.parse(JSON.stringify(x));
const range=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start,a);return source.slice(start,end);};
class Matrix{
  constructor(v=[1,0,0,1,0,0]){[this.a,this.b,this.c,this.d,this.e,this.f]=v;}
  multiply(m){return new Matrix([this.a*m.a+this.c*m.b,this.b*m.a+this.d*m.b,this.a*m.c+this.c*m.d,this.b*m.c+this.d*m.d,this.a*m.e+this.c*m.f+this.e,this.b*m.e+this.d*m.f+this.f]);}
  translate(x,y){return this.multiply(new Matrix([1,0,0,1,x,y]));}
  transformPoint(p){return {x:this.a*p.x+this.c*p.y+this.e,y:this.b*p.x+this.d*p.y+this.f};}
}
function fixture(unit,fit=false,band=false){
  const attrs={'data-key':'e900003','data-stat-bracket':JSON.stringify({x1:20*unit,x2:60*unit,top:100*unit,gap:10,unit,shape:'bracket'})},style={setProperty(k,v){this[k]=v;}},svg={append(el){el.parentElement=this;},querySelector:()=>node};
  const parent=fit?{parentElement:svg,transform:{baseVal:{consolidate:()=>({matrix:new Matrix([2,0,0,3,10,15])})}}}:band?{parentElement:svg,transform:{baseVal:{consolidate:()=>({matrix:new Matrix([1,0,0,1,0,200*unit])})}}}:svg;
  const node={localName:'path',style,parentElement:parent,hasAttribute:k=>k in attrs,getAttribute:k=>attrs[k]??null,setAttribute:(k,v)=>{attrs[k]=String(v);},removeAttribute:k=>{delete attrs[k];}};
  Object.defineProperty(node,'transform',{get:()=>({baseVal:{consolidate:()=>{const values=attrs.transform?.match(/matrix\(([^)]+)\)/)?.[1].split(/[, ]+/).map(Number);return values?{matrix:new Matrix(values)}:null;}}})});
  if(fit){attrs.transform='matrix(0.5 0 0 0.3333333333333333 -5 -5)';attrs['data-stat-display']=JSON.stringify({x1:50,x2:130,y:305});}
  return {svg,node,attrs};
}
const production=range('  function applyElementOffsets(','  function composite('),props={'stat-left':'4','stat-right':'8','stat-shape':'line','offset-x':'3','offset-y':'-2'};
for(const [unit,fit,band]of [[1,false,false],[2,false,false],[1,true,false],[2,false,true]]){
  const f=fixture(unit,fit,band),state={panels:{p:{edits:{0:{e900003:copy(props)}}}}},before=JSON.stringify(state),ctx={...helpers,DOMMatrix:Matrix,editsFor:()=>state.panels.p.edits[0],paint:(_,prop)=>prop==='stroke'?'#26364b':'none'};
  vm.createContext(ctx);vm.runInContext(production,ctx);ctx.applyElementOffsets(f.svg,'p',0,state,unit);
  const expected=fit?'M 46 305 H 138':`M ${16*unit} ${(band?290:90)*unit} H ${68*unit}`;
  assert.equal(f.attrs.d,expected,'extensions use physical units through fitted and nested band coordinates');
  assert.equal(f.attrs.transform,`matrix(1 0 0 1 ${3*unit} ${-2*unit})`,'ordinary movement remains independent of endpoint changes');
  assert.equal(f.node.parentElement,f.svg);assert.equal(f.attrs['data-stat-adjusted'],'true');assert.equal(JSON.stringify(state),before,'rendering never changes stored analysis or edits');
}
assert.equal(helpers.adjustedStatisticalBracket(10,20,30,1,{'stat-left':'-100','stat-right':'-100','stat-shape':'line'}),'M 14 30 H 16','inward endpoints do not invert the comparison line');

// Run production sidebar handlers over multiple live paths. A slider event
// patches only those paths; analysis/history remain untouched until release.
const G=require('../skills/polish-sci-figures/assets/figure-studio/statistical-line-geometry.js');
const base={order:['p'],panels:{p:{variant:0,edits:{0:{}},statistics:{analysis:{primary_test:{p_value:.032}}}}}},history=new helpers.History(base),callbacks=new Map();let frameId=0,refreshes=0;
function lineTarget(key,left,right){const f=fixture(2);f.attrs.d=`M ${left} 93 V 90 H ${right} V 93`;f.attrs['data-key']=key;f.node.isConnected=true;return {id:'p',vi:0,key,unit:2,props:{},geometry:G.fromPath(f.attrs.d,{}, {unit:2}),el:f.node,hit:{setAttribute(k,v){this[k]=v;}},locked:false};}
const targets=[lineTarget('e900003',40,120),lineTarget('e900005',160,280)],nodes={};
const ctx={...helpers,StudioStatisticalLineGeometry:G,copy,project:{id:'project'},state:()=>history.current,currentOutput:()=>({scale:2}),selectedStatisticalLines:()=>targets.map(t=>({...t,locked:ctx.locked})),requestAnimationFrame:cb=>{callbacks.set(++frameId,cb);return frameId;},cancelAnimationFrame:id=>callbacks.delete(id),zoomView:{refreshSelection:()=>refreshes++},renderStatisticalLineControls:()=>{},commit:s=>history.commit(s),T:x=>x,$:id=>nodes[id]??={}};
vm.createContext(ctx);vm.runInContext(range('function validValue(','function heatmapCellInfo(')+'\n'+range('  function setEdit(','  function selectedStatisticalLines(')+'\n'+range('  function cancelStatisticalLinePreview(','  function bindStatisticalLineControls('),ctx);
const flush=()=>{const pending=[...callbacks.values()];callbacks.clear();pending.forEach(cb=>cb());};
ctx.previewStatisticalLine('stat-span','90');ctx.previewStatisticalLine('stat-span','70');assert.equal(callbacks.size,1,'many inputs share one animation frame');flush();
for(const t of targets){const box=G.fromPath(t.el.getAttribute('d'),{}, {unit:2});assert.equal(box.width,t.geometry.width*.7);assert.equal(box.center,t.geometry.center);assert.equal(t.hit.d,t.el.getAttribute('d'),'wide hit area follows the visible connector');}
assert.equal(refreshes,1);assert.deepEqual(history.current,base,'previews never change history');ctx.finishStatisticalLine();assert.equal(history.states.length,2);assert.equal(history.current.panels.p.edits[0].e900003['stat-left'],'-6');assert.equal(history.current.panels.p.edits[0].e900005['stat-left'],'-9');assert.equal(history.current.panels.p.statistics.analysis.primary_test.p_value,.032);history.undo();assert.deepEqual(history.current,base);
ctx.previewStatisticalLine('stat-left','12');ctx.previewStatisticalLine('stat-left','18');flush();ctx.finishStatisticalLine();assert.equal(history.current.panels.p.edits[0].e900003['stat-left'],'9');history.undo();
const beforeCancel=targets.map(t=>t.el.getAttribute('d'));ctx.previewStatisticalLine('stat-right','8');flush();ctx.cancelStatisticalLinePreview(true);assert.deepEqual(targets.map(t=>t.el.getAttribute('d')),beforeCancel,'Escape restores live geometry');assert.deepEqual(history.current,base);
ctx.previewStatisticalLine('stat-right','8');ctx.project={id:'different'};ctx.finishStatisticalLine();assert.deepEqual(history.current,base,'a project change discards pending geometry edits');
ctx.locked=true;ctx.previewStatisticalLine('stat-right','8');ctx.finishStatisticalLine();assert.deepEqual(history.current,base,'locked lines cannot be adjusted');

// Stored endpoints remain in source-panel pt: contain resizing only changes
// their final displayed pt. Exercise the real target lookup and controls too.
for(const contain of [.5,2]){
  const unit=2,output=1.5,key='e900003',f=fixture(unit),initial={order:['p'],columns:1,gap:0,panels:{p:{variant:0,edits:{0:{[key]:{'stat-left':'4'}}}}},grid:{rows:1,widths:[200*contain],heights:[150*contain],places:{p:{row:0,col:0,rs:1,cs:1}},manualTracks:true}},h=new helpers.History(initial),pending=[];
  const live={hasAttribute:()=>false,getAttribute:k=>k==='viewBox'?'0 0 400 300':k==='width'?String(200*contain):null,querySelectorAll:()=>[f.node],querySelector:()=>null};f.node.dataset={key};f.node.isConnected=true;
  const fields={artboard:{querySelector:()=>live},selectedStatisticalLine:{querySelectorAll:()=>[]}};
  const c={...helpers,StudioStatisticalLineGeometry:G,copy,project:{id:'manual'},original:false,selectionGroups:()=>[{id:'p',vi:0,keys:[key]}],isVisibleObject:()=>true,state:()=>h.current,panel:()=>({variants:[{width:200,viewBox:[0,0,400,300]}]}),editsFor:()=>h.current.panels.p.edits[0],currentOutput:()=>({scale:output}),$:id=>fields[id]??={},T:x=>x,requestAnimationFrame:fn=>(pending.push(fn),pending.length),cancelAnimationFrame:()=>pending.splice(0),zoomView:{refreshSelection(){}},commit:next=>{h.commit(next);render();return true;}};
  function render(){const props=h.current.panels.p.edits[0][key]||{};f.attrs.d=helpers.adjustedStatisticalBracket(40,120,90,unit,props);f.attrs['stroke-width']=props['stroke-width']||'1';delete f.node.style['stroke-width'];}
  vm.createContext(c);vm.runInContext(range('function validValue(','function heatmapCellInfo(')+'\n'+range('  function setEdit(','  let componentGesture='),c);render();c.renderStatisticalLineControls();
  assert.equal(Number(fields.statLineLeft.value),4*contain*output,'existing source-pt extension is displayed in final pt');
  const target=c.selectedStatisticalLines()[0];assert.equal(target.presentationScale,contain);assert.equal(target.unit,unit,'rendering/storage retain their original unit');
  c.previewStatisticalLine('stat-left','6');pending.splice(0).forEach(fn=>fn());c.finishStatisticalLine();c.renderStatisticalLineControls();
  const saved=h.current.panels.p.edits[0][key];assert.ok(Math.abs(Number(saved['stat-left'])-6/(contain*output))<1e-9);assert.equal(Number(fields.statLineLeft.value),6);
  const actualLeft=G.fromPath(f.attrs.d,saved,{unit}).left;assert.ok(Math.abs((40-actualLeft)/unit*contain*output-6)<1e-9,'committed endpoint moves by exactly the requested final pt');
  c.previewStatisticalLine('stroke-width','2');pending.splice(0).forEach(fn=>fn());assert.ok(Math.abs(parseFloat(f.node.style['stroke-width'])/unit*contain*output-2)<1e-9);c.finishStatisticalLine();c.renderStatisticalLineControls();assert.equal(Number(fields.statLineWidth.value),2);assert.ok(Math.abs(Number(f.attrs['stroke-width'])/unit*contain*output-2)<1e-9);
  const restored=helpers.History.restore(JSON.parse(JSON.stringify(h.toJSON())),{panels:[{id:'p',variants:[{}]}]},h.current);assert.deepEqual(restored.current,h.current);h.undo();render();h.redo();render();c.renderStatisticalLineControls();assert.equal(Number(fields.statLineWidth.value),2);
  const before=f.attrs.d;c.previewStatisticalLine('stat-right','8');pending.splice(0).forEach(fn=>fn());c.cancelStatisticalLinePreview(true);assert.equal(f.attrs.d,before,'Escape retains the saved contained line');
}

// Generated keys vary between comparison lines and letters. The real style
// transfer keeps later scale-bar edits attached to the same non-statistic node.
const rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js');
const textFormat=JSON.stringify({baseText:'P < 0.001',runs:[{start:0,end:1,style:{italic:true}},{start:2,end:9,style:{bold:true}}]});
const styled={panels:{p:{annotationStyle:'p',annotationFont:{size:14},statistics:{analysis:{primary_test:{p_value:.00001}}},edits:{0:{e5:{text:'Ordinary title'},e900000:{'stat-left':'-15','offset-y':'4','stroke-width':'1.5'},e900001:{text:'Manually changed P','rich-text':textFormat,'font-size':'14'},e900002:{text:'50 μm','offset-y':'7'}}},lockedElements:{0:['e900000','e900002','e5']},elementGroups:{0:[['e900000','e900001'],['e5','e900002']]}}}};
function generatedNodes(style){const specs=style==='letters'?[['text','a',true],['text','b',true],['text','c',true]]:style?[['path','',true],['text',style==='p'?'P < 0.001':style==='stars'?'****':'####',true]]:[];specs.push(['text','10 μm',false]);return specs.map(([localName,textContent,stat],index)=>({localName,textContent,getAttribute:key=>key==='data-key'?'e'+(900000+index):null,hasAttribute:key=>stat&&(key===(localName==='path'?'data-stat-bracket':'data-stat-top'))}));}
const styleContext={copy,StudioRichText:rich,state:()=>styled,editedSvg:(id,vi,s)=>({querySelectorAll:selector=>generatedNodes(s.panels[id].annotationStyle).filter(node=>selector==='[data-key]'||['data-stat-top','data-stat-bracket','data-stat-result'].some(attr=>node.hasAttribute(attr)))})};vm.createContext(styleContext);vm.runInContext(range('  function transferStatisticalStyleEdits(','  function renderAlignmentGuideControls('),styleContext);
const original=JSON.stringify(styled),stars=copy(styled);stars.panels.p.annotationStyle='stars';styleContext.transferStatisticalStyleEdits(stars,'p');
assert.deepEqual(stars.panels.p.edits[0].e900000,styled.panels.p.edits[0].e900000,'compatible styles retain line width, endpoint and position');
assert.equal(stars.panels.p.edits[0].e900001.text,undefined,'the chosen stars cannot be hidden by old manually typed P text');
assert.equal(stars.panels.p.edits[0].e900001['rich-text'],undefined,'P-only or former digit formatting cannot become a star string');
assert.equal(stars.panels.p.edits[0].e900001['font-size'],'14');assert.deepEqual(stars.panels.p.edits[0].e900002,styled.panels.p.edits[0].e900002);
const whole=copy(styled);whole.panels.p.edits[0].e900001['rich-text']=JSON.stringify({baseText:'P < 0.001',runs:[{start:0,end:9,style:{bold:true}}]});const hash=copy(whole);hash.panels.p.annotationStyle='hash';styleContext.transferStatisticalStyleEdits(hash,'p',whole);assert.deepEqual(JSON.parse(hash.panels.p.edits[0].e900001['rich-text']),{baseText:'####',runs:[{start:0,end:4,style:{bold:true}}]},'whole-text formatting remaps to new symbols without freezing P text');
for(const style of ['letters',undefined]){const next=copy(styled);next.panels.p.annotationStyle=style;styleContext.transferStatisticalStyleEdits(next,'p');const scaleKey=style?'e900003':'e900000';assert.deepEqual(next.panels.p.edits[0][scaleKey],styled.panels.p.edits[0].e900002,'scale-bar edits survive generated-key shifts');if(style)for(const key of ['e900000','e900001','e900002'])assert.equal(next.panels.p.edits[0][key],undefined,'letters never inherit comparison-line or P overrides');assert.deepEqual(next.panels.p.edits[0].e5,styled.panels.p.edits[0].e5);assert.deepEqual([...next.panels.p.lockedElements[0]],[scaleKey,'e5']);assert.deepEqual(next.panels.p.annotationFont,{size:14});assert.equal(next.panels.p.statistics.analysis.primary_test.p_value,.00001);}
assert.equal(JSON.stringify(styled),original,'style transfer leaves previous history and scientific results intact');
const letters=copy(styled);letters.panels.p.annotationStyle='letters';styleContext.transferStatisticalStyleEdits(letters,'p');const newAnalysis=copy(letters);newAnalysis.panels.p.annotationStyle='p';styleContext.transferStatisticalStyleEdits(newAnalysis,'p',letters,true);
vm.runInContext(range('  function clearStatisticalResultEdits(','  function clearStatisticalFontEdits('),styleContext);styleContext.clearStatisticalResultEdits(newAnalysis,'p',newAnalysis);
assert.deepEqual(newAnalysis.panels.p.edits[0].e900002,styled.panels.p.edits[0].e900002,'reanalysis resets only current result keys, never a remapped scale bar occupying a former letter key');
console.log('Statistical line editing: physical endpoints, fitted/band layouts, separate offsets, bounded length, preview staging, one undo, project/lock guards and analysis integrity passed');
