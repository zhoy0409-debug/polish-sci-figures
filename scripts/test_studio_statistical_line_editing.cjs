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

// Execute the actual sidebar preview/finish handlers: many preview updates form
// one reversible operation, and a project/selection change cannot commit it.
const base={order:['p'],panels:{p:{variant:0,edits:{0:{}},statistics:{analysis:{primary_test:{p_value:.032}}}}}},history=new helpers.History(base),nodes={},callbacks=[];
const ctx={...helpers,copy,project:{id:'project'},selectedPanel:'p',state:()=>history.current,currentOutput:()=>({scale:2}),selectedStatisticalLine:()=>({id:'p',vi:0,key:'e900003',unit:2,locked:ctx.locked}),layout:()=>({positions:[{id:'p',height:200,width:300}]}),fittedVariant:()=>null,annotationFirstTopHeight:()=>0,requestAnimationFrame:cb=>{callbacks.push(cb);return callbacks.length;},cancelAnimationFrame:()=>{},renderCanvas:()=>{},renderStatisticalLineControls:()=>{},previewCategorySpacing:(_,s)=>{ctx.preview=s;},commit:s=>history.commit(s),T:x=>x,$:id=>nodes[id]??={}};
vm.createContext(ctx);vm.runInContext(range('function validValue(','function heatmapCellInfo(')+'\n'+range('  function setEdit(','  function selectedStatisticalLine(')+'\n'+range('  function cancelStatisticalLinePreview(','  function bindStatisticalLineControls('),ctx);
ctx.previewStatisticalLine('stat-left','12');ctx.previewStatisticalLine('stat-left','18');callbacks.pop()();assert.equal(ctx.preview.panels.p.edits[0].e900003['stat-left'],'9');assert.deepEqual(history.current,base,'slider movement previews without committing');
ctx.finishStatisticalLine();assert.equal(history.states.length,2);assert.equal(history.current.panels.p.edits[0].e900003['stat-left'],'9');assert.equal(history.current.panels.p.statistics.analysis.primary_test.p_value,.032);history.undo();assert.deepEqual(history.current,base);
ctx.previewStatisticalLine('stat-right','8');ctx.project={id:'different'};ctx.finishStatisticalLine();assert.deepEqual(history.current,base,'changing projects discards the pending geometry edit');
ctx.locked=true;ctx.previewStatisticalLine('stat-right','8');ctx.finishStatisticalLine();assert.deepEqual(history.current,base,'locked lines cannot be adjusted');

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
