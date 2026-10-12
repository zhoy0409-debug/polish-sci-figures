/* Independent checks against actual generated gallery SVG structure.
 * Source measurements are synthetic fixtures; P values are computed by the
 * current analysis engine, never taken from a visual reference image.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),file='../skills/polish-sci-figures/assets/figure-studio/studio.js',source=fs.readFileSync(require.resolve(file),'utf8'),helpers=require(file);
const python=String.raw`
import io,json,sys,xml.etree.ElementTree as E
from pathlib import Path
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'skills/make-sci-data-figures/scripts'),str(root/'skills/polish-sci-figures/scripts')]
import gallery_compare, gallery_registry
from figure_workbench import style
from studio_statistics import analyze
import matplotlib.pyplot as plt
style('Arial')
out=[];fixture=gallery_compare.fixtures()
def tree(el):
 return {'tag':el.tag.split('}')[-1],'attrs':{k.split('}')[-1]:v for k,v in el.attrib.items()},'text':el.text or '', 'children':[tree(c) for c in el]}
for name,view,count in [('raincloud','compare_raincloud',0),('two_facets','compare_facet_boxes',2),('three_facets','compare_facet_boxes',3)]:
 data=fixture[view].copy()
 if not count:data.iloc[0,data.columns.get_loc('value')]=12.5
 if count==2:data=data[data.factor.isin(['Day 1','Day 7'])]
 if count:
  data.loc[(data.factor=='Day 7')&(data.group=='Treatment'),'value']+=2
  data.loc[(data.factor=='Day 14')&(data.group=='Treatment'),'value']-=3
  data.loc[(data.factor=='Day 14')&(data.group=='Rescue'),'value']+=1
 rows=[data.columns.tolist()]+data.astype(str).values.tolist()
 recipe={'family':'gallery','parameters':{'view':view}}
 config={'mode':'raw','group':'group','value':'value','unit':'unit','design':'independent','method':'welch','family':'all_pairs','design_confirmed':True,'unit_role':'independent_experimental_unit'}
 if count:config['facet']='factor'
 result=analyze(recipe,rows,config)
 for label,size in [('narrow',(3.6,3.6)),('wide',(7.2,3.6)),('portrait',(4.8,5.4))]:
  fig=gallery_registry.render(data,view,figsize=size);stream=io.BytesIO();fig.savefig(stream,format='svg',metadata={'Date':None});plt.close(fig)
  svg=E.fromstring(stream.getvalue());out.append({'name':name,'size':label,'analysis':result['analysis'],'svg':tree(svg)})
print(json.dumps(out,ensure_ascii=False,allow_nan=False))
`;
const generated=cp.spawnSync(path.join(root,'.venv/Scripts/python.exe'),['-c',python,root],{encoding:'utf8',maxBuffer:12*1024*1024});
assert.equal(generated.status,0,generated.stderr);const fixtures=JSON.parse(generated.stdout);

// Minimal DOM for selector/attribute logic only. Geometry checks below use
// actual clip rectangles and source tick coordinates, not browser glyph boxes.
class Node {
  constructor(value){this.localName=value.tag;this.attrs={...value.attrs};this.ownText=value.text||'';this.children=(value.children||[]).map(v=>new Node(v));this.children.forEach(c=>c.parentElement=this);this.style={};}
  get id(){return this.attrs.id||'';}get textContent(){return this.ownText+this.children.map(c=>c.textContent).join('');}set textContent(v){this.ownText=String(v);this.children=[];}
  getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}hasAttribute(k){return k in this.attrs;}
  matches(selector){return selector.split(',').some(s=>{s=s.trim();const m=s.match(/^(?:([\w-]+))?(?:\[([\w-]+)(\^?=)?["']?([^"'\]]*)["']?\])?$/);if(!m)return false;return (!m[1]||m[1]===this.localName)&&(!m[2]||(m[3]==='^='?(this.attrs[m[2]]||'').startsWith(m[4]):m[3]==='='?this.attrs[m[2]]===m[4]:m[2] in this.attrs));});}
  querySelectorAll(selector){const parts=selector.trim().split(/\s+(?=[^\]]*(?:\[|$))/);if(parts.length>1){const ancestor=parts.slice(0,-1).join(' '),tail=parts.at(-1);return this.querySelectorAll(ancestor).flatMap(n=>n.querySelectorAll(tail));}return this.children.filter(c=>typeof c.matches==='function').flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){for(let n=this;n;n=n.parentElement)if(n.matches(selector))return n;return null;}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
  get transform(){return {baseVal:{consolidate:()=>{const raw=this.getAttribute('transform'),match=raw?.match(/^matrix\(([^)]+)\)$/);if(match)return {matrix:new Matrix(match[1].split(/[ ,]+/).map(Number))};if(raw&&!/^rotate\(-?0(?: |\))/.test(raw))throw Error('Unsupported test transform: '+raw);return null;}}};}
}
class Matrix{
  constructor(v=[1,0,0,1,0,0]){[this.a,this.b,this.c,this.d,this.e,this.f]=v;}
  multiply(m){return new Matrix([this.a*m.a+this.c*m.b,this.b*m.a+this.d*m.b,this.a*m.c+this.c*m.d,this.b*m.c+this.d*m.d,this.a*m.e+this.c*m.f+this.e,this.b*m.e+this.d*m.f+this.f]);}
  inverse(){const k=this.a*this.d-this.b*this.c;return new Matrix([this.d/k,-this.b/k,-this.c/k,this.a/k,(this.c*this.f-this.d*this.e)/k,(this.b*this.e-this.a*this.f)/k]);}
  translate(x,y){return this.multiply(new Matrix([1,0,0,1,x,y]));}
}
const range=(a,b)=>{const start=source.indexOf(a),end=source.indexOf(b,start);assert.ok(start>0&&end>start,a);return source.slice(start,end);};
const anchorCode=range('  function statisticalAnchorElements(','  function measureStatisticalAnchors('),infoCode=range('  function statisticalAnnotationSets(','  function statisticalExportRecords('),drawCode=range('  function appendStatisticalBand(','  function annotationHeight(');
let currentSvg,currentFixture,currentState;
const ctx={...helpers,T:x=>x,NS:'svg',DOMMatrix:Matrix,document:{createElementNS:(_,tag)=>new Node({tag,attrs:{}}),createTextNode:text=>({textContent:text})},state:()=>currentState,panel:()=>{const viewBox=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number);return {variants:[{preserveAspect:true,viewBox,width:viewBox[2],height:viewBox[3]}]};},baseSvg:()=>currentSvg,statisticalAnalysisFor:()=>currentFixture.analysis};
vm.createContext(ctx);vm.runInContext(anchorCode+'\n'+infoCode+'\n'+drawCode,ctx);
ctx.measureStatisticalAnchors=(svg,anchors)=>{const frame=ctx.statisticalAxisFrame(svg,anchors.axis);return {centers:anchors.nodes.map(n=>+n.getAttribute('x')),tops:anchors.nodes.map(()=>frame.y+5)};};
const snapshots=[];
const textWidth=(text,size)=>Array.from(text).reduce((sum,c)=>sum+(/\s/.test(c)?.32:/[\u2e80-\uffff]/.test(c)?1:/[MW@]/.test(c)?.95:/[il.,:;'|]/.test(c)?.3:/[A-Z]/.test(c)?.75:.6),0)*size;
for(const fixture of fixtures){
  currentFixture=fixture;currentSvg=new Node(fixture.svg);currentState={panels:{p:{variant:0}}};
  const info=ctx.statisticalAnnotationInfo('p'),expected=fixture.name==='raincloud'?'plot':'facets';
  assert.equal(info.placement,expected,fixture.name+' should use actual category axes');assert.equal(info.plotSets.length,fixture.name==='three_facets'?3:fixture.name==='two_facets'?2:1);assert.equal(info.rowCount,fixture.name==='three_facets'?2:1);
  for(const set of info.plotSets){assert.equal(JSON.stringify(set.anchors.nodes.map(t=>t.textContent)),JSON.stringify(set.order));if(set.facet)assert.equal(set.title.textContent,set.label);}
  const originalAnalysis=JSON.stringify(fixture.analysis);
  for(const fontSize of [9,24,32])for(const style of ['p','stars','letters'])for(const format of style==='p'?['standard','precise']:['standard']){
    currentSvg=new Node(fixture.svg);currentState={panels:{p:{variant:0,annotationStyle:style,annotationPFormat:format,annotationFont:{font:'Arial',size:fontSize}}}};
    const before=ctx.statisticalAnnotationInfo('p'),box=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number),v={width:box[2],height:box[3],viewBox:box};
    const originalPaths=currentSvg.querySelectorAll('path').map(p=>[p,p.getAttribute('d')]),metrics=ctx.anchoredStatisticalLayout(before,style,currentState.panels.p,{},1,0);
    assert.equal(metrics.header,Math.max(0,helpers.statisticalLayout(style,3,currentState.panels.p).header+3*(metrics.maxLines-1)*metrics.lineHeight-(before.topInsetReuse||0)),'spacing uses maximum within-facet count, wrapped lines and the available source top margin');assert.equal(metrics.totalHeader,metrics.header*before.rowCount);
    const savedAxes=before.plotSets.map(set=>({axis:set.axis,title:set.title,titleY:set.title?+set.title.getAttribute('y'):null,row:set.row,frame:set.frame,label:set.label}));
    const build=range('    if(!raw&&s.panels[id].annotationStyle&&statisticalAnnotationInfo','    if(!raw)for(const [key,cfg]');
    Object.assign(ctx,{raw:false,id:'p',vi:0,s:currentState,svg:currentSvg,reflow:v});vm.runInContext(build,ctx);
    if(before.placement==='band'){assert.ok(currentSvg.hasAttribute('data-stat-band-height'),'unfittable text falls back to a readable named result band');for(const [p,d]of originalPaths)assert.equal(p.getAttribute('d'),d);snapshots.push({name:fixture.name,size:fixture.size,fontSize,style,format,placement:'band'});continue;}
    assert.equal(currentSvg.getAttribute('data-stat-preserve'),'true','actual editedSvg path invokes anchored rendering');
    const afterBox=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number);assert.deepEqual(afterBox,[...box.slice(0,3),box[3]+metrics.totalHeader]);
    for(const [p,d]of originalPaths)assert.equal(p.getAttribute('d'),d,'original data path is not deformed');
    for(const axis of savedAxes){const m=axis.axis.transform.baseVal.consolidate().matrix;assert.equal(m.a,1);assert.equal(m.d,1);assert.ok(Math.abs(m.f-(axis.row+1)*metrics.header)<1e-8);if(axis.title){const t=axis.title.transform.baseVal.consolidate().matrix;assert.ok(Math.abs(t.f+metrics.header)<1e-8);}}
    const texts=currentSvg.children.filter(n=>n.localName==='text'&&n.hasAttribute('data-stat-result')),lines=currentSvg.children.filter(n=>n.localName==='path'&&n.hasAttribute('data-stat-bracket'));
    assert.equal(texts.length,before.plotSets.length*3);assert.equal(lines.length,style==='letters'?0:before.plotSets.length*3);
    for(const set of savedAxes){const own=texts.filter(n=>n.getAttribute('data-stat-facet')===set.label);assert.equal(own.length,3);const expectedSet=before.plotSets.find(s=>s.label===set.label),expectedText=(style==='letters'?helpers.comparisonLetters(3,expectedSet.comparisons):expectedSet.comparisons.map(c=>c.p)).map(value=>metrics.labelPlan(value,expectedSet).lines.join(''));assert.equal(JSON.stringify(own.map(n=>n.textContent)),JSON.stringify(expectedText),'each facet displays only its own calculated P values or letters');const top=Math.min(...own.map(t=>+t.getAttribute('y')-fontSize));if(set.title)assert.ok(set.titleY+set.row*metrics.header+4<top,'facet title remains above its statistical text');if(set.row){const previousBottom=Math.max(...savedAxes.filter(a=>a.row===set.row-1).map(a=>a.frame.y+a.frame.height+(a.row+1)*metrics.header));assert.ok(top>previousBottom,'lower-facet statistical text cannot enter the preceding row plot');}for(const text of own){const width=+text.getAttribute('data-stat-label-width'),center=+text.getAttribute('x');assert.ok(center-width/2>=set.frame.x-1e-8&&center+width/2<=set.frame.x+set.frame.width+1e-8,'text stays inside its own facet, not only the overall figure');}}
    for(const text of texts){assert.ok(+text.getAttribute('y')-fontSize>=0);assert.ok(+text.getAttribute('y')+(+text.getAttribute('data-stat-lines')-1)*metrics.lineHeight+fontSize*.3<afterBox[3]);const width=Math.max(...text.children.map(run=>textWidth(run.textContent,fontSize))),center=+text.getAttribute('x');assert.ok(center-width/2>=box[0]&&center+width/2<=box[0]+box[2],`${fixture.name}/${fixture.size}/${fontSize}/${style}: result text exceeds horizontal SVG bounds (${text.textContent})`);}
    snapshots.push({name:fixture.name,size:fixture.size,fontSize,style,format,header:metrics.header,totalHeader:metrics.totalHeader,rows:before.rowCount});
  }
  assert.equal(JSON.stringify(fixture.analysis),originalAnalysis,'standard and precise presentation never modify computed analysis values');
  if(fixture.name!=='raincloud'){
    const original=fixture.analysis;currentSvg=new Node(fixture.svg);currentFixture={...fixture,analysis:JSON.parse(JSON.stringify(original))};currentFixture.analysis.facets[0].label='Unknown facet';assert.equal(ctx.statisticalAnnotationInfo('p').placement,'band');
    currentFixture=fixture;currentSvg=new Node(fixture.svg);let sets=ctx.statisticalAnnotationInfo('p').plotSets;sets[0].title.textContent=sets[1].title.textContent;assert.equal(ctx.statisticalAnnotationInfo('p').placement,'band','duplicate/absent facet titles never guess a match');
    currentSvg=new Node(fixture.svg);sets=ctx.statisticalAnnotationInfo('p').plotSets;sets[0].title.textContent='';assert.equal(ctx.statisticalAnnotationInfo('p').placement,'band','missing titles use named results instead of guessed axis position');
  }
}

// With a multi-row facet figure beside a single plot, reserve the greatest
// first header and internal-row headers separately. Only physical translations
// are used; the first body edge remains aligned and neither SVG leaves its slot.
const assets={},states={},metricsById={},drawings={};
for(const [id,name,fontSize]of [['a','three_facets',9],['b','raincloud',32]]){
  currentFixture=fixtures.find(f=>f.name===name&&f.size==='wide');currentSvg=new Node(currentFixture.svg);currentState={panels:{p:{variant:0,annotationStyle:'p',annotationFont:{font:'Arial',size:fontSize}}}};
  const info=ctx.statisticalAnnotationInfo('p'),box=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number),v={width:box[2],height:box[3],viewBox:box,name:'fixture',svg:'studio-plot-frame',sha256:id};
  metricsById[id]=ctx.anchoredStatisticalLayout(info,'p',currentState.panels.p,{},1,0);ctx.appendAnchoredStatistics(currentSvg,'p',0,currentState,v,info);drawings[id]=currentSvg;assets[id]={variants:[v],table:{rows:[]},recipe:{family:'gallery',parameters:{view:'fixture'}}};states[id]={variant:0,annotationStyle:'p'};
}
const mixed={order:['a','b'],columns:2,gap:12,grid:{rows:1,widths:[550,550],places:{a:{row:0,col:0,rs:1,cs:1},b:{row:0,col:1,rs:1,cs:1}}},panels:states};
const layoutContext={copy:x=>JSON.parse(JSON.stringify(x)),gridFor:s=>s.grid,panel:id=>assets[id],conditionMatrixHeight:()=>0,annotationHeight:id=>metricsById[id].totalHeader,annotationTopHeight:id=>metricsById[id].totalHeader,annotationFirstTopHeight:id=>metricsById[id].header,statisticalAnnotationInfo:()=>({placement:'facets'})};
vm.createContext(layoutContext);vm.runInContext(range('  function layout(s=state())','  function plotFrame(')+'\n'+range('  function reflowSpec(','  function currentHeatmapMetadata('),layoutContext);
const mixedLayout=layoutContext.layout(mixed),firstMax=Math.max(...Object.values(metricsById).map(m=>m.header)),innerMax=Math.max(...Object.values(metricsById).map(m=>m.totalHeader-m.header)),bodyTops=[];
const positionLine=source.split('\n').find(line=>line.includes('const height=fitted?fitPos.height:')&&line.includes('statisticsFirstTop'));
assert.ok(positionLine);
for(const pos of mixedLayout.positions){
  assert.equal(pos.statisticsFirstTop,firstMax);assert.equal(pos.statisticsTop,firstMax+innerMax);
  const request=layoutContext.reflowSpec(pos,mixed);assert.equal(request.height,259.2,'backend receives only source body size, not statistical headroom');
  const svg=drawings[pos.id],v=assets[pos.id].variants[0],bodyPos={...pos,height:pos.height-pos.statisticsTop-pos.statisticsBand};
  vm.runInNewContext(positionLine.trim(),{svg,v,pos,bodyPos,fitPos:pos,fitted:false});
  bodyTops.push(+svg.getAttribute('y')+metricsById[pos.id].header);
  assert.ok(+svg.getAttribute('y')>=pos.y-1e-8);assert.ok(+svg.getAttribute('y')+ +svg.getAttribute('height')<=pos.y+pos.height+1e-8,'translated figure including all facet headers stays inside its slot');
}
assert.ok(Math.abs(bodyTops[0]-bodyTops[1])<1e-8,'first body edge of multi-row facets and adjacent plot is aligned');

// Different annotation styles in adjacent versions of the same faceted chart
// share both the first plot edge and the first facet-title baseline.
for(const [id,style]of [['a','letters'],['b','p']]){
  currentFixture=fixtures.find(f=>f.name==='two_facets'&&f.size==='wide');currentSvg=new Node(currentFixture.svg);currentState={panels:{p:{variant:0,annotationStyle:style,annotationFont:{font:'Arial',size:24}}}};
  const info=ctx.statisticalAnnotationInfo('p'),box=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number),v={width:box[2],height:box[3],viewBox:box,name:'fixture',svg:'studio-plot-frame',sha256:id};
  metricsById[id]=ctx.anchoredStatisticalLayout(info,style,currentState.panels.p,{},1,0);ctx.appendAnchoredStatistics(currentSvg,'p',0,currentState,v,info);drawings[id]=currentSvg;assets[id].variants=[v];
}
const titleLine=source.split('\n').find(line=>line.includes('const titleShift=')&&line.includes('data-stat-facet-title'));assert.ok(titleLine);
const titleBaselines=[];
for(const pos of layoutContext.layout(mixed).positions){
  const svg=drawings[pos.id],v=assets[pos.id].variants[0],bodyPos={...pos,height:pos.height-pos.statisticsTop-pos.statisticsBand};
  vm.runInNewContext(titleLine.trim(),{svg,v,pos,raw:false,fitted:false,translateStatisticalElement:ctx.translateStatisticalElement,namespace:()=>{}});
  vm.runInNewContext(positionLine.trim(),{svg,v,pos,bodyPos,fitPos:pos,fitted:false});
  const title=svg.querySelector('[data-stat-facet-title="0"]'),axis=title.closest('[id^="axes_"]');
  titleBaselines.push(+svg.getAttribute('y')+ +title.getAttribute('y')+title.transform.baseVal.consolidate().matrix.f+axis.transform.baseVal.consolidate().matrix.f);
}
assert.ok(Math.abs(titleBaselines[0]-titleBaselines[1])<1e-8,'adjacent letter and P-value facet titles share a baseline');

// User-facing facet titles are presentation, not analysis identifiers. Resolve
// the edited source with stable axis/tick/key identity after changing its text.
const hideTitleLine=source.split('\n').find(line=>line.includes('showFacetTitles===false')&&line.includes('title.style.display'));
assert.ok(hideTitleLine);const editBlock=range('    if (!raw) for (const [key, props]','    // Work on complete category groups');
const keyTree=node=>{let n=0;const visit=el=>{el.setAttribute('data-key','e'+n++);for(const child of el.children)if(child.localName)visit(child);};visit(node);return node;};
let titleEditCases=0;
for(const fixture of fixtures.filter(f=>f.name!=='raincloud'))for(const fontSize of [9,24,32])for(const show of [true,false]){
  currentFixture=fixture;currentSvg=keyTree(new Node(fixture.svg));currentState={panels:{p:{variant:0,annotationStyle:'p',annotationFont:{font:'Arial',size:fontSize},showFacetTitles:show}}};
  const info=ctx.statisticalAnnotationInfo('p'),box=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number),v={width:box[2],height:box[3],viewBox:box};
  assert.equal(info.hasFacetTitles,true);const sourceKeys=info.plotSets.map(set=>set.title.getAttribute('data-key')),edits={};
  sourceKeys.forEach((key,i)=>{edits[key]={text:'Edited heading '+(i+1)};});
  edits[info.plotSets[0].anchors.nodes[0].getAttribute('data-key')]={text:'Visible control alias'};
  currentSvg=keyTree(new Node(fixture.svg));const sourcePaths=currentSvg.querySelectorAll('path').map(p=>[p,p.getAttribute('d')]);
  Object.assign(ctx,{svg:currentSvg,raw:false,id:'p',vi:0,s:currentState,editsFor:()=>edits});
  vm.runInContext(hideTitleLine.trim()+'\n'+editBlock,ctx);
  const titles=ctx.statisticalFacetTitleElements(currentSvg);assert.equal(titles.length,sourceKeys.length);
  for(const [i,title]of titles.entries()){assert.equal(title.textContent,'Edited heading '+(i+1));assert.equal(title.style.display,show?undefined:'none');}
  assert.equal(ctx.statisticalPlotAnchors(currentSvg,info.sets),null,'edited visual titles no longer match original analysis labels');
  const resolved=ctx.resolvedStatisticalPlotAnchors(currentSvg,info.plotSets);assert.equal(resolved.length,info.plotSets.length);
  resolved.forEach((set,i)=>{assert.equal(set.label,info.plotSets[i].label);assert.equal(set.title.getAttribute('data-key'),sourceKeys[i]);});
  const m=ctx.anchoredStatisticalLayout(info,'p',currentState.panels.p,{},1,0),visible=ctx.anchoredStatisticalLayout(info,'p',{...currentState.panels.p,showFacetTitles:true},{},1,0);
  assert.equal(visible.totalHeader-m.totalHeader,show?0:6*info.rowCount,'hidden titles recover only their own explicit row clearance');
  assert.equal(ctx.appendAnchoredStatistics(currentSvg,'p',0,currentState,v,info),true);
  for(const [p,d]of sourcePaths)assert.equal(p.getAttribute('d'),d,'title edits and hiding never deform source data');
  const results=currentSvg.children.filter(n=>n.localName==='text'&&n.hasAttribute('data-stat-result'));
  assert.equal(results.length,info.plotSets.length*3);
  for(const set of info.plotSets){const own=results.filter(t=>t.getAttribute('data-stat-facet')===set.label);assert.equal(JSON.stringify(own.map(t=>t.textContent)),JSON.stringify(set.comparisons.map(c=>m.labelPlan(c.p,set).lines.join(''))),'renaming the displayed facet cannot exchange its comparisons');}
  titleEditCases++;
}
currentSvg=keyTree(new Node(fixtures.find(f=>f.name==='two_facets').svg));Object.assign(ctx,{svg:currentSvg,raw:true,id:'p',s:{panels:{p:{showFacetTitles:false}}}});vm.runInContext(hideTitleLine.trim(),ctx);assert.ok(ctx.statisticalFacetTitleElements(currentSvg).every(t=>t.style.display===undefined),'raw/original source remains available');

// Condition rows retain source group identities rather than trusting the order
// of form columns. Mock only the browser's artist bounds, using actual tick
// centers, source clip frames and the production translations already applied.
ctx.measureConditionMatrixAxes=(svg,sets)=>sets.map(set=>({...set,centers:set.anchors.nodes.map(n=>+n.getAttribute('x')),bottom:set.frame.y+set.frame.height+(set.axis.transform.baseVal.consolidate()?.matrix.f||0)+22}));
ctx.editsFor=()=>({});let conditionCases=0;const conditionSnapshots=[];
for(const fixture of fixtures)for(const fontSize of [9,12,24,32])for(const rowCount of [2,8]){
  currentFixture=fixture;const base=keyTree(new Node(fixture.svg)),box=base.getAttribute('viewBox').split(/\s+/).map(Number),v={width:box[2],height:box[3],viewBox:box,svg:'source'};
  ctx.baseSvg=()=>base;ctx.panel=()=>({variants:[v]});currentSvg=keyTree(new Node(fixture.svg));
  const rows=Array.from({length:rowCount},(_,i)=>({label:'Factor '+(i+1),values:{Treatment:i%2?'-':'+',Control:'-',Obsolete:'never displayed'}}));
  currentState={panels:{p:{variant:0,annotationStyle:'p',annotationFont:{font:'Arial',size:9},conditionMatrix:{enabled:true,groups:['Rescue','Obsolete','Treatment','Control'],rows,font:{font:'Arial',size:fontSize}}}}};
  const condition=ctx.conditionMatrixInfo('p'),statistics=ctx.statisticalAnnotationInfo('p'),expectedGroups=['Control','Treatment','Rescue'];
  assert.equal(JSON.stringify(condition.groups),JSON.stringify(expectedGroups));assert.equal(condition.enabled,true);
  const originalPaths=currentSvg.querySelectorAll('path').map(p=>[p,p.getAttribute('d')]);ctx.appendAnchoredStatistics(currentSvg,'p',0,currentState,v,statistics);
  const beforeBox=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number),axesBefore=new Map(currentSvg.querySelectorAll('[id^="axes_"]').map(a=>[a.id,a.transform.baseVal.consolidate()?.matrix.f||0]));
  const plan=ctx.appendConditionMatrix(currentSvg,'p',0,currentState,v);assert.ok(plan&&plan.totalHeight>0,JSON.stringify({name:fixture.name,size:fixture.size,fontSize,rowCount,height:plan?.totalHeight,fits:plan?.fits,actual:plan?.size,sets:plan?.sets.map(p=>({width:p.labelWidth,cells:p.cellWidths,left:p.left,right:p.right,centers:p.centers}))}));assert.equal(plan.heights.length,condition.rowCount);
  assert.equal(+currentSvg.getAttribute('data-condition-height'),plan.totalHeight);assert.equal(currentSvg.getAttribute('viewBox').split(/\s+/).map(Number)[3],beforeBox[3]+plan.totalHeight);
  const cells=currentSvg.querySelectorAll('[data-condition-cell]');assert.equal(cells.length,condition.sets.length*rowCount*4);
  assert.equal(plan.requestedSize,fontSize);assert.ok(plan.size>=6&&plan.size<=fontSize);assert.equal(+currentSvg.getAttribute('data-condition-font-size'),plan.size);assert.ok(cells.every(c=>+c.getAttribute('font-size')===plan.size));
  for(const set of condition.sets){const axis=currentSvg.querySelector(`[id="${set.axis.id}"]`),prior=plan.heights.slice(0,set.row).reduce((a,b)=>a+b,0);assert.ok(Math.abs(axis.transform.baseVal.consolidate().matrix.f-axesBefore.get(axis.id)-prior)<1e-8);
    for(let r=0;r<rowCount;r++)for(const [i,group]of expectedGroups.entries()){const cell=cells.find(c=>c.getAttribute('data-condition-axis')===axis.id&&c.getAttribute('data-condition-row')===String(r)&&c.getAttribute('data-condition-cell')===group);assert.ok(cell);assert.equal(cell.textContent,rows[r].values[group]||'—');assert.equal(+cell.getAttribute('x'),+set.anchors.nodes[i].getAttribute('x'));}
  }
  for(const set of plan.sets)for(const row of set.rows){assert.ok(row.label.width<=set.labelWidth+.01);row.values.forEach((value,i)=>assert.ok(value.width<=set.cellWidths[i]+.01));assert.ok(set.right+row.values[0].width/2<set.centers[0],'row heading cannot enter the first value');}
  const totalCanvasHeight=+currentSvg.getAttribute('viewBox').split(/\s+/)[3];for(const cell of cells){const bottom=+cell.getAttribute('y')+(cell.children.length-1)*plan.lineHeight+plan.size*.3;assert.ok(bottom<totalCanvasHeight,'condition rows stay within the expanded vector canvas');}
  assert.ok(cells.every(c=>!c.textContent.includes('never displayed')));assert.equal(new Set(cells.map(c=>c.getAttribute('data-key'))).size,cells.length,'each cell remains an independently editable source element');
  for(const [p,d]of originalPaths)assert.equal(p.getAttribute('d'),d);
  for(const node of currentSvg.querySelectorAll('[data-stat-top],[data-stat-bracket]')){const row=+node.getAttribute('data-stat-row'),expected=plan.heights.slice(0,row).reduce((a,b)=>a+b,0);assert.ok(Math.abs((node.transform.baseVal.consolidate()?.matrix.f||0)-expected)<1e-8,'statistics follow their own facet row after condition insertion');}
  conditionCases++;conditionSnapshots.push({name:fixture.name,size:fixture.size,fontSize,rowCount,totalHeight:plan.totalHeight,actualSize:plan.size,fits:plan.fits});
}
const noMatrix=keyTree(new Node(fixtures[0].svg)),noMatrixBefore=JSON.stringify(noMatrix.attrs);assert.equal(ctx.appendConditionMatrix(noMatrix,'p',0,{panels:{p:{}}},{svg:'source'}),null);assert.equal(JSON.stringify(noMatrix.attrs),noMatrixBefore,'unconfigured condition rows do not reserve space');assert.equal(ctx.appendConditionMatrix(noMatrix,'p',0,{panels:{p:{conditionMatrix:{enabled:false,rows:[{label:'X',values:{}}]}}}},{svg:'source'}),null);
const matrixFixture=fixtures.find(f=>f.name==='two_facets'&&f.size==='narrow'),matrixBase=keyTree(new Node(matrixFixture.svg)),matrixBox=matrixBase.getAttribute('viewBox').split(/\s+/).map(Number),matrixVariant={width:matrixBox[2],height:matrixBox[3],viewBox:matrixBox,svg:'source'};
ctx.baseSvg=()=>matrixBase;ctx.panel=()=>({variants:[matrixVariant]});currentFixture=matrixFixture;currentSvg=keyTree(new Node(matrixFixture.svg));currentState={panels:{p:{variant:0,conditionMatrix:{enabled:true,groups:['Control','Treatment','Rescue'],rows:[{label:'Condition',values:{Control:'W'.repeat(40),Treatment:'10 µM',Rescue:'5 µM'}}],font:{font:'Arial',size:32}}}}};
const blockedBox=currentSvg.getAttribute('viewBox'),blocked=ctx.appendConditionMatrix(currentSvg,'p',0,currentState,matrixVariant);assert.equal(blocked.fits,false);assert.equal(blocked.totalHeight,0);assert.equal(currentSvg.getAttribute('data-condition-blocked'),'true');assert.equal(currentSvg.querySelectorAll('[data-condition-cell]').length,0);assert.equal(currentSvg.getAttribute('viewBox'),blockedBox,'unfittable data is not silently drawn over neighbouring columns');assert.equal(currentState.panels.p.conditionMatrix.rows[0].values.Treatment,'10 µM','values are preserved for widening, never truncated');

// Table reservation is shared by the whole ending row, and kept out of the
// data-renderer height just like the statistical headroom/footer reservations.
const matrixHeight=conditionSnapshots.find(p=>p.name==='three_facets'&&p.size==='wide'&&p.fontSize===24&&p.rowCount===8).totalHeight;
layoutContext.conditionMatrixHeight=id=>id==='a'?matrixHeight:0;
for(const pos of layoutContext.layout(mixed).positions){assert.equal(pos.conditionHeight,matrixHeight);assert.equal(layoutContext.reflowSpec(pos,mixed).height,259.2,'compound render gets its original body height, without squeezing in condition rows');}
const spanning=JSON.parse(JSON.stringify(mixed));spanning.grid.rows=2;spanning.grid.places.a.rs=2;spanning.grid.places.b.row=1;
const spanPositions=layoutContext.layout(spanning).positions;assert.equal(spanPositions[0].conditionHeight,spanPositions[1].conditionHeight,'a spanning panel reserves condition rows on its ending grid row');

// Use actual SVG artist bounds for the edited raincloud regression. The KDE
// polygons contain only M/L coordinates, so their extrema are exact here.
// Marker Bezier control points are conservative; browser QA covers glyph ink.
const unionBounds=boxes=>{const valid=boxes.filter(b=>b&&Object.values(b).every(Number.isFinite));if(!valid.length)return {x:0,y:0,width:0,height:0};const x=Math.min(...valid.map(b=>b.x)),y=Math.min(...valid.map(b=>b.y));return {x,y,width:Math.max(...valid.map(b=>b.x+b.width))-x,height:Math.max(...valid.map(b=>b.y+b.height))-y};};
Node.prototype.getBBox=function(){
  if(this.localName==='path'){const values=(this.getAttribute('d')||'').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)?.map(Number)||[],points=[];for(let i=0;i+1<values.length;i+=2)points.push({x:values[i],y:values[i+1],width:0,height:0});return unionBounds(points);}
  if(this.localName==='use'){let root=this;while(root.parentElement)root=root.parentElement;const target=root.querySelector(`[id="${(this.getAttribute('href')||'').slice(1)}"]`),box=target?.getBBox()||{x:0,y:0,width:0,height:0};return {...box,x:box.x+(+this.getAttribute('x')||0),y:box.y+(+this.getAttribute('y')||0)};}
  return unionBounds(this.children.filter(n=>n.localName!=='defs'&&typeof n.getBBox==='function').map(n=>n.getBBox()));
};
Node.prototype.getScreenCTM=function(){let matrix=new Matrix();for(let node=this;node;node=node.parentElement){const own=node.transform?.baseVal.consolidate()?.matrix;if(own)matrix=own.multiply(matrix);}return matrix;};
Node.prototype.remove=function(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;};
ctx.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}};
ctx.document.createElement=tag=>new Node({tag,attrs:{}});ctx.document.body=new Node({tag:'body',attrs:{}});
vm.runInContext(range('  function measureStatisticalAnchors(','  function statisticalAnnotationSets('),ctx);
const densitySnapshots=[];
for(const fixture of fixtures.filter(f=>f.name==='raincloud'))for(const fontSize of [9,24,32]){
  currentFixture=fixture;currentSvg=new Node(fixture.svg);const box=currentSvg.getAttribute('viewBox').split(/\s+/).map(Number),v={width:box[2],height:box[3],viewBox:box,preserveAspect:true};
  ctx.baseSvg=()=>currentSvg;ctx.panel=()=>({variants:[v]});currentState={panels:{p:{variant:0,annotationStyle:'p',annotationFont:{font:'Arial',size:fontSize}}}};
  const info=ctx.statisticalAnnotationInfo('p');if(info.placement==='band')continue;
  const set=info.plotSets[0],density=set.anchors.artists.filter(n=>/^FillBetweenPolyCollection/.test(n.id));assert.equal(density.length,3,'every real KDE polygon is a measured statistical obstacle');
  const measured=ctx.measureStatisticalAnchors(currentSvg,set.anchors),withoutDensity=ctx.measureStatisticalAnchors(currentSvg,{...set.anchors,artists:set.anchors.artists.filter(n=>!density.includes(n))}),densityTop=Math.max(set.frame.y,Math.min(...density.map(n=>n.getBBox().y)));
  assert.ok(Math.min(...measured.tops)<=densityTop+1e-6,'annotation base includes the visible KDE tail');assert.ok(Math.min(...measured.tops)<Math.min(...withoutDensity.tops)-1,'this fixture reproduces the former sample-only height error');
  assert.equal(info.topInsetReuse,40,'reuse the existing 56pt top inset minus the physical 16pt outer margin');
  const metrics=ctx.anchoredStatisticalLayout(info,'p',currentState.panels.p,{},1,0),before=currentSvg.querySelectorAll('path').map(n=>n.getAttribute('d'));
  ctx.appendAnchoredStatistics(currentSvg,'p',0,currentState,v,info);
  const lines=currentSvg.querySelectorAll('[data-stat-bracket]'),lowest=Math.max(...lines.map(n=>{const b=JSON.parse(n.getAttribute('data-stat-bracket'));return b.top-b.gap+3;}));
  assert.ok(lowest<densityTop+metrics.header,'including bracket feet, the lowest comparison is above the visible density contour');assert.equal(JSON.stringify(currentSvg.querySelectorAll('path').slice(0,before.length).map(n=>n.getAttribute('d'))),JSON.stringify(before),'density and data paths are unchanged');
  // Axis titles, tick labels and generated statistics cannot be obstacles.
  assert.ok(set.anchors.artists.every(n=>!n.id.startsWith('matplotlib.axis')&&!n.id.startsWith('text_')));
  densitySnapshots.push({size:fixture.size,fontSize,densityTop,observationsTop:Math.min(...withoutDensity.tops),lowestBracket:lowest,addedHeader:metrics.header,reusedInset:info.topInsetReuse});
}
assert.ok(densitySnapshots.length>=8);
const proof=path.join(root,'.cache/facet-statistics-qa');fs.mkdirSync(proof,{recursive:true});
fs.writeFileSync(path.join(proof,'raincloud-contours.json'),JSON.stringify(densitySnapshots,null,2));
fs.writeFileSync(path.join(proof,'fixture-structure.json'),JSON.stringify(fixtures.map(f=>({name:f.name,size:f.size,axes:new Node(f.svg).querySelectorAll('[id^="axes_"]').map(a=>({id:a.id,text:a.querySelectorAll('text').map(t=>t.textContent)}))})),null,2));
fs.writeFileSync(path.join(proof,'layouts.json'),JSON.stringify({scope:'Production matching/drawing logic with real SVG structures; artist bounds and font metrics require browser QA',snapshots,titleEditCases,conditionCases,conditionSnapshots},null,2));
console.log(`PASS ${fixtures.length} real SVG fixtures / ${snapshots.length} layout cases (${snapshots.filter(s=>s.placement==='band').length} safe width fallbacks), ${titleEditCases} title editing/hiding, ${conditionCases} condition row cases: facet identities, per-row headroom, source paths, bounds, title/body alignment and 9/24/32 pt.`);
