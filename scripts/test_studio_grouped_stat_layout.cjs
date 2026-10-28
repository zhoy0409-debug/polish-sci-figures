/* Real grouped-observation SVGs and calculated within-factor comparisons.
 * The DOM adapter measures source artists deterministically; browser acceptance
 * still checks actual glyph ink and pointer interaction at the final size. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),asset='../skills/polish-sci-figures/assets/figure-studio/',source=fs.readFileSync(require.resolve(asset+'studio.js'),'utf8'),helpers=require(asset+'studio.js'),spacing=require(asset+'group-spacing.js');
const runtime=process.env.PYTHON||[path.join(root,'.venv/bin/python'),path.join(root,'.venv/Scripts/python.exe')].find(fs.existsSync)||'python';
const python=String.raw`
import io,json,sys,xml.etree.ElementTree as E
from pathlib import Path
import numpy as np,pandas as pd
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'skills/make-sci-data-figures/scripts'),str(root/'skills/polish-sci-figures/scripts')]
from figure_workbench import style
from gallery_registry import render
from gallery_marks import prepare_marks,embed_marks
from studio_statistics import analyze
import matplotlib.pyplot as plt
style('Arial')
def tree(e):return {'tag':e.tag.split('}')[-1],'attrs':{k.split('}')[-1]:v for k,v in e.attrib.items()},'text':e.text or '', 'children':[tree(c) for c in e]}
out=[]
for name,factors,groups,changed,size in [
 ('original',['Line 1','Line 2','Line 3'],['Control','Stress','Rescue'],False,(4.8,3.6)),
 ('wide',['Line 1','Line 2','Line 3'],['Control','Stress','Rescue'],False,(7.2,3.6)),
 ('portrait',['Line 1','Line 2','Line 3'],['Control','Stress','Rescue'],False,(4.8,5.4)),
 ('data-replaced',['Line 1','Line 2','Line 3'],['Control','Stress','Rescue'],True,(4.8,3.6)),
 ('reordered',['Line 3','Line 1','Line 2'],['Rescue','Control','Stress'],False,(7.2,3.6)),
 ('escaped-labels',['Line <1>','Line &2','Line "3"'],['Control','Stress','Rescue'],False,(7.2,3.6))]:
 rows=[]
 for f in factors:
  fi=next(i for i in range(3) if str(i+1) in f)
  for g in groups:
   gi=['Control','Stress','Rescue'].index(g)
   for n,residual in enumerate([-.8,-.2,.1,.35,.55,1.0]):
    value=8+fi*3+[0,2.2,.65][gi]+residual*(1+gi*.12)
    if changed and fi==1 and gi==1:value+=12
    rows.append([f,g,f'{gi}-{n}',value])
 data=pd.DataFrame(rows,columns=['factor','group','unit','value'])
 config={'mode':'raw','group':'group','value':'value','unit':'unit','facet':'factor','design':'independent','method':'welch','family':'all_pairs','design_confirmed':True,'unit_role':'independent_experimental_unit','order':['Stress','Rescue','Control']}
 record=analyze({'family':'gallery','parameters':{'view':'grouped_observations'}},[data.columns.tolist()]+data.astype(str).values.tolist(),config)
 fig=render(data,'grouped_observations',figsize=size);prepare_marks(fig);stream=io.StringIO()
 with plt.rc_context({'svg.fonttype':'none'}):fig.savefig(stream,format='svg',metadata={'Date':None})
 raw=embed_marks(stream.getvalue(),fig);ax=fig.axes[0];expected={}
 # Independently derive each bar's data position, never reuse metadata centers.
 for fi,f in enumerate(factors):
  expected[f]={}
  for gi,g in enumerate(groups):
   x=fi+(gi-(len(groups)-1)/2)*(.7/len(groups));px,_=ax.transData.transform((x,0));expected[f][g]=px*72/fig.dpi
 plt.close(fig)
 out.append({'name':name,'svg':tree(E.fromstring(raw)),'analysis':record['analysis'],'config':record['config'],'sha256':record['data_sha256'],'expected':expected})
print(json.dumps(out,ensure_ascii=False,allow_nan=False))
`;
const result=cp.spawnSync(runtime,['-c',python,root],{cwd:root,encoding:'utf8',maxBuffer:16e6});assert.equal(result.status,0,result.stderr);const fixtures=JSON.parse(result.stdout);

// Reuse the same independent affine/path adapter as the category-spacing
// regression, with compound selectors needed by generated statistics.
const adapter=fs.readFileSync(path.join(__dirname,'test_studio_group_spacing.cjs'),'utf8'),dom={assert};
vm.runInNewContext(adapter.slice(adapter.indexOf('class Matrix{'),adapter.indexOf('const fixtureTrees='))+';this.Node=Node;this.Matrix=Matrix;this.transformed=transformed;',dom);
const {Node,Matrix}=dom;
Matrix.prototype.translate=function(x,y){return this.multiply(new Matrix([1,0,0,1,x,y]));};
Matrix.prototype.transformPoint=function(p){return {x:this.a*p.x+this.c*p.y+this.e,y:this.b*p.x+this.d*p.y+this.f};};
Node.prototype.matches=function(selector){return selector.split(',').some(part=>{const s=part.trim(),tag=s.match(/^([\w-]+)/)?.[1],attrs=[...s.matchAll(/\[([\w-]+)(\^?=)?["']?([^"'\]]*)["']?\]/g)];return (!tag||tag===this.localName)&&attrs.every(([,key,op,value])=>op==='^='?(this.attrs[key]||'').startsWith(value):op==='='?this.attrs[key]===value:key in this.attrs);});};
Object.defineProperty(Node.prototype,'attributes',{get(){const owner=this;return Object.keys(this.attrs).map(name=>({name,localName:name,get value(){return owner.attrs[name];},set value(value){owner.attrs[name]=value;}}));}});
Node.prototype.getAttributeNames=function(){return Object.keys(this.attrs);};
Node.prototype.getAttributeNode=function(name){return this.attributes.find(attribute=>attribute.name===name)||null;};
const append=Node.prototype.append;Node.prototype.append=function(...nodes){for(const node of nodes){node.remove?.();if(!node.matches)node.matches=()=>false;if(!node.querySelectorAll)node.querySelectorAll=()=>[];}return append.apply(this,nodes);};
const clone=value=>JSON.parse(JSON.stringify(value)),near=(actual,expected,message)=>assert.ok(Math.abs(actual-expected)<1e-5,`${message}: ${actual} != ${expected}`);
const slice=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>0&&b>a,start);return source.slice(a,b);};
let fixture,svg,state,variant;
const drawingNode=tag=>{const node=new Node({tag,attrs:{}});node.style.setProperty=function(k,v){this[k]=String(v);};return node;};
const ctx={...helpers,project:{},NS:'http://www.w3.org/2000/svg',StudioGroupSpacing:spacing,DOMMatrix:Matrix,DOMPoint:class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return {x:m.a*this.x+m.c*this.y+m.e,y:m.b*this.x+m.d*this.y+m.f};}},T:x=>x,state:()=>state,panel:()=>({variants:[variant],table:{sha256:fixture.sha256}}),baseSvg:()=>svg,statisticalAnalysisFor:()=>fixture.analysis,editsFor:()=>state.panels.p.edits[0]||{},document:{createElement:()=>({style:{},append(){},remove(){}}),body:{append(){}},createElementNS:(_,tag)=>drawingNode(tag),createTextNode:text=>({textContent:text})}};
const nodeTree=node=>({tag:node.localName,attrs:{...node.attrs},text:node.own||'',children:node.children.map(nodeTree)});
ctx.baseSvg=()=>new Node(nodeTree(svg));ctx.groupSpacingOrders=()=>fixture.analysis.facets.map(set=>set.group_order);
vm.createContext(ctx);vm.runInContext(slice('  function statisticalAnchorElements(','  function renderStatisticalAnnotations(')+'\n'+slice('  function anchoredStatisticalLayout(','  function measureConditionMatrixAxes('),ctx);
function reset(item,style='p',size=9){fixture=item;svg=new Node(item.svg);const viewBox=svg.getAttribute('viewBox').split(/\s+/).map(Number);variant={width:viewBox[2],height:viewBox[3],viewBox,preserveAspect:true,name:'grouped_observations'};state={panels:{p:{variant:0,edits:{0:{}},statistics:{config:item.config},annotationStyle:style,annotationFont:{font:'Arial',size}}}};}
const snapshots=[];
for(const item of fixtures){
 reset(item);const info=ctx.statisticalAnnotationInfo('p');
 assert.notEqual(info.placement,'band',item.name+': within-factor comparisons belong above their matching bar clusters');
 assert.equal(info.plotSets.length,3);assert.equal(info.rowCount,1,'three clusters share one categorical axis row');
 for(const set of info.plotSets){const measured=ctx.measureStatisticalAnchors(svg,set.anchors);set.order.forEach((group,index)=>near(measured.centers[index],item.expected[set.label][group],item.name+'/'+set.label+'/'+group+' identity matches bar center'));}
 for(const size of [9,14,24,32])for(const style of ['p','stars','letters'])for(const factor of [.8,1,1.1]){
  reset(item,style,size);state.panels.p.groupSpacing={factor};const original=JSON.stringify(item.analysis),before=svg.querySelectorAll('path').map(node=>({node,d:node.getAttribute('d')}));
  const sourceInfo=ctx.statisticalAnnotationInfo('p');
  assert.notEqual(sourceInfo.placement,'band',`${item.name}/${style}/${size}: plot annotations must not be moved to a bottom result table`);
  const moved=spacing.apply(svg,factor,{view:'grouped_observations'});
  assert.ok(moved.available,`${item.name}: category spacing stays supported (${moved.reason})`);
  const active=ctx.statisticalPlotAnchors(svg,sourceInfo.sets),measurements=active.map(set=>({set,...ctx.measureStatisticalAnchors(svg,set.anchors)}));
  for(const {set,centers}of measurements){const cluster=moved.axes[0].groups.find(group=>group.label===set.label);assert.ok(cluster);set.order.forEach((group,index)=>near(centers[index],item.expected[set.label][group]+cluster.delta,'spacing follows entire cluster without changing series offsets'));}
  assert.equal(ctx.appendAnchoredStatistics(svg,'p',0,state,variant,sourceInfo),true);
  assert.equal(svg.hasAttribute('data-stat-band-height'),false);
  for(const {node,d}of before)assert.equal(node.getAttribute('d'),d,'annotation layout cannot rewrite source data paths');
  const texts=svg.querySelectorAll('text').filter(node=>node.hasAttribute('data-stat-result')),lines=svg.querySelectorAll('[data-stat-bracket]');
  assert.equal(texts.length,9);assert.equal(lines.length,style==='letters'?0:9);
  const boxes=texts.map(node=>{const x=Number(node.getAttribute('x')),y=Number(node.getAttribute('y')),width=Number(node.getAttribute('data-stat-label-width')),count=Number(node.getAttribute('data-stat-lines'));return {left:x-width/2,right:x+width/2,top:y-size,bottom:y+(count-1)*size*1.25+size*.3};});
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){
   const x=Math.min(boxes[a].right,boxes[b].right)-Math.max(boxes[a].left,boxes[b].left),y=Math.min(boxes[a].bottom,boxes[b].bottom)-Math.max(boxes[a].top,boxes[b].top);
   assert.ok(x<=.01||y<=.01,`${item.name}/${style}/${size}/${factor}: statistical text ${a} and ${b} overlap in planned glyph bounds`);
  }
  const header=Number(svg.getAttribute('data-stat-header')),height=Number(svg.getAttribute('viewBox').split(/\s+/)[3]);
  for(const {set,centers,tops}of measurements){
   const ownLines=lines.filter(node=>node.getAttribute('data-stat-facet')===set.label),ownTexts=texts.filter(node=>node.getAttribute('data-stat-facet')===set.label);
   assert.equal(ownTexts.length,3,'each factor keeps its own result family');
   const expectedText=style==='letters'?helpers.comparisonLetters(set.order.length,set.comparisons):set.comparisons.map(c=>style==='p'?'P'+helpers.statisticalPText(c.p):helpers.statisticalSymbol(c.p,style));
   assert.equal(JSON.stringify(ownTexts.map(node=>node.textContent.replace(/\s/g,''))),JSON.stringify(Array.from(expectedText,value=>value.replace(/\s/g,''))),'only the matching factor calculated values appear above its cluster');
   ownLines.forEach((node,index)=>{const bracket=JSON.parse(node.getAttribute('data-stat-bracket')),comparison=set.comparisons[index];near(bracket.x1,centers[comparison.a],'left comparison endpoint');near(bracket.x2,centers[comparison.b],'right comparison endpoint');assert.ok(bracket.top-bracket.gap+3<Math.min(...tops)+header,'bracket feet stay above every artist in the cluster');});
   for(const text of ownTexts){assert.ok(Number(text.getAttribute('y'))>=size,'statistical text is not cropped above the SVG');assert.ok(Number(text.getAttribute('y'))<height,'statistical text stays within the SVG');assert.equal(text.getAttribute('font-size'),String(size));}
  }
  assert.equal(JSON.stringify(item.analysis),original,'presentation does not modify the calculated results');
  snapshots.push({name:item.name,style,size,requestedSpacing:factor,spacing:moved.factor,header,height});
 }
}

// Display labels are editable; scientific identities come from the renderer's
// explicit map. Missing or ambiguous identities must never guess other bars.
reset(fixtures[0]);
for(const text of svg.querySelectorAll('text'))if(Object.hasOwn(fixture.expected,text.textContent))text.textContent='User renamed '+text.textContent;
assert.notEqual(ctx.statisticalAnnotationInfo('p').placement,'band','renaming a displayed factor does not discard its semantic comparison');
for(const corrupt of [
 record=>{record.axes[0].groups.pop();},
 record=>{record.axes[0].groups.push(clone(record.axes[0].groups[0]));},
 record=>{record.axes[0].groups[0].members=['missing-source-artist'];},
 record=>{record.axes[0].groups[0].facet.value='Unmeasured factor';}
]){
 reset(fixtures[0]);const meta=svg.querySelector('[id="studio-stat-anchors"]');assert.ok(meta,'real renderer supplies statistical identity metadata');const record=JSON.parse(meta.textContent);corrupt(record);meta.textContent=JSON.stringify(record);
 assert.equal(ctx.statisticalAnnotationInfo('p').placement,'analysis','invalid semantic identity does not draw a plausible but wrong bracket');
}

// Export namespaces must update the semantic references as well as visible
// artist IDs. A sanitized reimport with retained analysis can still match them.
reset(fixtures[0]);ctx.renderSerial=0;vm.runInContext(slice('  function namespace(','  let compactLayoutCache='),ctx);ctx.namespace(svg);
const namespaced=svg.querySelectorAll('metadata').find(node=>node.id.endsWith('studio-stat-anchors'));assert.ok(namespaced.id.startsWith('f1-'));
const cleanStart=source.indexOf("      if (el.localName === 'metadata')"),cleanEnd=source.indexOf("      if (el.localName === 'style')",cleanStart);assert.ok(cleanStart>0&&cleanEnd>cleanStart);
ctx.nodes=[namespaced];vm.runInContext('for(const el of nodes){'+source.slice(cleanStart,cleanEnd)+'}',ctx);
assert.equal(svg.querySelectorAll('metadata').includes(namespaced),true,'import sanitization preserves validated statistical anchors');
const reopened=ctx.statisticalAnnotationInfo('p');assert.notEqual(reopened.placement,'band');for(const set of reopened.plotSets){const measured=ctx.measureStatisticalAnchors(svg,set.anchors);set.order.forEach((group,index)=>near(measured.centers[index],fixture.expected[set.label][group],'namespaced source retains its scientific group identity'));}

// Exercise generated-element editing and physical movement with these new
// anchored lines/text, rather than only preconstructed generic annotations.
const keyLine=source.split('\n').find(line=>line.includes('let generated=900000;'));assert.ok(keyLine);const keys='{'+keyLine+'}';
vm.runInContext(slice('  function applyElementOffsets(','  function composite('),ctx);ctx.paint=(_,prop)=>prop==='stroke'?'#26364b':'none';
for(const size of [9,24]){
 reset(fixtures[1],'p',size);let n=0;for(const node of svg.querySelectorAll('text,path,line,rect'))if(!node.closest('defs'))node.setAttribute('data-key','e'+n++);
 const info=ctx.statisticalAnnotationInfo('p');ctx.appendAnchoredStatistics(svg,'p',0,state,variant,info);
 Object.assign(ctx,{svg,id:'p',vi:0,s:state,raw:false});vm.runInContext(keys,ctx);
 let line=svg.querySelector('[data-stat-bracket]'),text=svg.querySelectorAll('text').find(node=>node.hasAttribute('data-stat-result'));const lineKey=line.getAttribute('data-key'),textKey=text.getAttribute('data-key'),before=JSON.stringify(fixture.analysis),bracket=JSON.parse(line.getAttribute('data-stat-bracket'));
 assert.match(lineKey,/^e\d+$/);assert.match(textKey,/^e\d+$/);assert.notEqual(lineKey,textKey);
 state.panels.p.edits[0]={[lineKey]:{'stat-left':'4','stat-right':'6','stat-shape':'line','offset-x':'3','offset-y':'-2'},[textKey]:{'offset-x':'5','offset-y':'-4','font-weight':'700',text:'User text'}};
 // A fresh redraw must reapply saved text/style edits to the same generated
 // comparison, as it does when changing canvas size or restoring a project.
 svg=new Node(fixture.svg);n=0;for(const node of svg.querySelectorAll('text,path,line,rect'))if(!node.closest('defs'))node.setAttribute('data-key','e'+n++);
 ctx.appendAnchoredStatistics(svg,'p',0,state,variant,ctx.statisticalAnnotationInfo('p'));ctx.svg=svg;vm.runInContext(keys,ctx);
 line=svg.querySelector(`[data-key="${lineKey}"]`);text=svg.querySelector(`[data-key="${textKey}"]`);
 assert.equal(text.textContent,'User text');assert.equal(text.style['font-weight'],'700');assert.equal(text.getAttribute('data-stat-manual'),'true');
 ctx.applyElementOffsets(svg,'p',0,state,1);
 const endpoints=line.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/ig).map(Number);near(endpoints[0],Math.min(bracket.x1,bracket.x2)-4,'manual left extension');near(endpoints[2],Math.max(bracket.x1,bracket.x2)+6,'manual right extension');
 assert.equal(line.getAttribute('transform'),'matrix(1 0 0 1 3 -2)','generated line stays independently movable');
 assert.equal(text.getAttribute('transform'),'matrix(1 0 0 1 5 -4)','generated text stays independently movable');
 assert.equal(JSON.stringify(fixture.analysis),before,'moving and editing automatic marks does not change the analysis');
}
// Old grouped projects drew a result band. Its generated IDs include titles and
// row labels, so sequentially renumbering plot marks would redirect saved edits.
// Discover old keys from the actual band DOM, not from the new migration helper.
vm.runInContext(fs.readFileSync('scripts/fixtures/legacy-statistical-band-builder.txt','utf8'),ctx);
let restoredLegacyCases=0;
for(const item of [fixtures[0],fixtures[4]])for(const style of ['p','stars','letters']){
 reset(item,style);variant.svg='<svg><!-- legacy grouped source without statistical anchors --></svg>';
 const sourceKeys=()=>{let serial=0;for(const node of svg.querySelectorAll('text,path,line,rect'))if(!node.closest('defs'))node.setAttribute('data-key','e'+serial++);};
 sourceKeys();let info=ctx.statisticalAnnotationInfo('p');ctx.appendStatisticalBand(svg,'p',0,state,variant,{...info,placement:'band'});
 Object.assign(ctx,{svg,id:'p',vi:0,s:state,raw:false});vm.runInContext(keys,ctx);
 const band=svg.querySelector('[data-stat-band]'),oldGenerated=svg.querySelectorAll('[data-key]').filter(node=>/^e9\d{5}$/.test(node.getAttribute('data-key'))),expected=[];
 let active=null;
 for(let i=0;i<band.children.length;i++){
  const node=band.children[i];if(node.localName!=='text')continue;
  const facet=info.sets.find(set=>set.label===node.textContent);if(facet){active=facet;continue;}if(!active)continue;
  const names=style==='letters'?active.order:active.comparisons.map(c=>active.order[c.a]+'  —  '+active.order[c.b]),index=names.indexOf(node.textContent);if(index<0)continue;
  const text=band.children[i+1],line=style==='letters'?null:band.children[i+2];assert.equal(text.localName,'text');if(line)assert.ok(line.hasAttribute('data-stat-bracket'));
  expected.push({facet:active.label,label:node.textContent,textKey:text.getAttribute('data-key'),lineKey:line?.getAttribute('data-key'),text:text.textContent});
 }
 assert.equal(expected.length,9);
 const resultKeys=new Set(expected.flatMap(row=>[row.textKey,row.lineKey].filter(Boolean))),retired=oldGenerated.filter(node=>!resultKeys.has(node.getAttribute('data-key'))).map(node=>node.getAttribute('data-key'));
 const nextGenerated='e'+(900000+oldGenerated.length),edited=clone(state);
 edited.panels.p.edits[0]=Object.fromEntries(retired.map(key=>[key,{text:'Retired band label must not become a result',fill:'#990099'}]));
 for(const row of expected){edited.panels.p.edits[0][row.textKey]={text:'Manual '+row.facet+' '+row.label,'font-weight':'700','offset-x':'2','offset-y':'-3'};if(row.lineKey)edited.panels.p.edits[0][row.lineKey]={'stat-left':'3','stat-right':'2','stat-shape':'line','offset-x':'4','offset-y':'-2'};}
 edited.panels.p.edits[0][nextGenerated]={fill:'#123456'};
 edited.panels.p.lockedElements={0:expected.slice(0,2).map(row=>row.textKey)};edited.panels.p.elementGroups={0:[expected.slice(0,2).map(row=>row.textKey)]};
 const history=new helpers.History(state);history.commit(edited);const checkpoint=clone(edited),before=JSON.stringify({history:history.states,checkpoint});
 for(const snapshot of [history.current,(history.undo(),history.current),(history.redo(),history.current),checkpoint]){
  state=snapshot;svg=new Node(item.svg);sourceKeys();info=ctx.statisticalAnnotationInfo('p');ctx.appendAnchoredStatistics(svg,'p',0,state,variant,info);
  const scale=ctx.document.createElementNS(ctx.NS,'rect');svg.append(scale);
  Object.assign(ctx,{svg,s:state});vm.runInContext(keys,ctx);ctx.applyElementOffsets(svg,'p',0,state,1);
  for(const row of expected){
   const text=svg.querySelector(`[data-key="${row.textKey}"]`);assert.equal(text?.localName,'text');assert.equal(text.getAttribute('data-stat-facet'),row.facet);
   assert.equal(text.textContent,state.panels.p.edits[0]?.[row.textKey]?.text||row.text);
   if(row.lineKey){const line=svg.querySelector(`[data-key="${row.lineKey}"]`);assert.ok(line?.hasAttribute('data-stat-bracket'));assert.equal(line.getAttribute('data-stat-facet'),row.facet);if(state.panels.p.edits[0]?.[row.lineKey])assert.equal(line.getAttribute('transform'),'matrix(1 0 0 1 4 -2)');}
  }
  for(const key of retired)assert.equal(svg.querySelector(`[data-key="${key}"]`),null,'retired title/facet/row keys must remain unused');
  assert.equal(scale.getAttribute('data-key'),nextGenerated,'later scale-bar elements keep their former band-era keys');if(state.panels.p.edits[0]?.[nextGenerated])assert.equal(scale.style.fill,'#123456');
  for(const key of state.panels.p.lockedElements?.[0]||[])assert.equal(svg.querySelector(`[data-key="${key}"]`).localName,'text');
  const all=svg.querySelectorAll('[data-key]').map(node=>node.getAttribute('data-key'));assert.equal(new Set(all).size,all.length,'explicit legacy keys never collide with generated keys');restoredLegacyCases++;
 }
 assert.equal(JSON.stringify({history:history.states,checkpoint}),before,'upgrade does not rewrite undo/redo/checkpoint edit records');
}
const out=path.join(root,'.cache/grouped-statistics-qa');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'layouts.json'),JSON.stringify({scope:'Real renderers and production annotation/spacing code; browser glyph and pointer checks remain separate.',snapshots,restoredLegacyCases},null,2));
console.log(`PASS grouped statistics: ${fixtures.length} source/data/order/size fixtures, ${snapshots.length} direct-on-plot layouts with real spacing, source geometry and analysis preserved.`);
console.log(`PASS legacy statistical edits: ${restoredLegacyCases} actual band-to-plot renders retain result/line/scale keys, manual text/offsets, locks, groups and undo/redo/checkpoints; retired label keys remain unused.`);
