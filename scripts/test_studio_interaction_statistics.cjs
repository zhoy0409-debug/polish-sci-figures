/* Real synthetic interaction plots: point-bound vertical comparisons, no footer. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),asset='../skills/polish-sci-figures/assets/figure-studio/',source=fs.readFileSync(require.resolve(asset+'studio.js'),'utf8'),helpers=require(asset+'studio.js'),widths=require(asset+'statistical-line-geometry.js');
const python=process.env.PYTHON||[path.join(root,'.venv/Scripts/python.exe'),path.join(root,'.venv/bin/python')].find(fs.existsSync)||'python';
const program=String.raw`
import io,json,sys,xml.etree.ElementTree as E
from pathlib import Path
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'scripts'),str(root/'skills/polish-sci-figures/scripts')]
from test_grouped_stat_metadata import observations,serialize,gallery_compare,plt
from studio_statistics import analyze
def tree(e):return {'tag':e.tag.split('}')[-1],'attrs':{k.split('}')[-1]:v for k,v in e.attrib.items()},'text':e.text or '', 'children':[tree(c) for c in e]}
output=[]
for size in [(4.8,3.6),(7.2,3.6),(3.6,4.8)]:
 data=observations(['Rescue','Control','Stress'],['Line 3','Line 1','Line 2'])
 rows=[data.columns.tolist(),*data.astype(str).values.tolist()]
 config={'mode':'raw','group':'group','value':'value','unit':'unit','facet':'factor','design':'independent','method':'welch','family':'all_pairs','design_confirmed':True,'unit_role':'independent_experimental_unit','order':['Stress','Rescue','Control']}
 result=analyze({'family':'gallery','parameters':{'view':'compare_interaction'}},rows,config)
 fig=gallery_compare.render(data,'compare_interaction',figsize=size)
 raw=serialize(fig);plt.close(fig)
 output.append({'svg':tree(E.fromstring(raw)),'analysis':result['analysis'],'size':size})
 directory=root/'.cache/interaction-statistics-qa';directory.mkdir(parents=True,exist_ok=True)
 (directory/('interaction-'+str(size[0])+'.svg')).write_text(raw,encoding='utf-8')
print(json.dumps(output,ensure_ascii=False))
`;
const built=cp.spawnSync(python,['-X','utf8','-c',program,root],{cwd:root,encoding:'utf8',maxBuffer:8e6});assert.equal(built.status,0,built.stderr);const fixtures=JSON.parse(built.stdout);
const adapter=fs.readFileSync(path.join(__dirname,'test_studio_group_spacing.cjs'),'utf8'),dom={assert};vm.runInNewContext(adapter.slice(adapter.indexOf('class Matrix{'),adapter.indexOf('const fixtureTrees='))+';this.Node=Node;this.Matrix=Matrix;',dom);const {Node,Matrix}=dom;
Matrix.prototype.translate=function(x,y){return this.multiply(new Matrix([1,0,0,1,x,y]));};Matrix.prototype.transformPoint=function(p){return {x:this.a*p.x+this.c*p.y+this.e,y:this.b*p.x+this.d*p.y+this.f};};
const append=Node.prototype.append;Node.prototype.append=function(...nodes){for(const node of nodes){node.remove?.();if(!node.matches)node.matches=()=>false;if(!node.querySelectorAll)node.querySelectorAll=()=>[];}return append.apply(this,nodes);};
const section=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert.ok(a>0&&b>a,start);return source.slice(a,b);},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
let fixture,svg,state,variant;const ctx={...helpers,project:{},NS:'svg',DOMMatrix:Matrix,T:x=>x,state:()=>state,panel:()=>({variants:[variant]}),baseSvg:()=>svg,statisticalAnalysisFor:()=>fixture.analysis,conditionMatrixHeight:()=>0,editsFor:()=>state.panels.p.edits[0],paint:(_,p)=>p==='stroke'?'#26364b':'none',document:{createElementNS:(_,tag)=>new Node({tag,attrs:{}}),createTextNode:text=>({textContent:text})}};
vm.createContext(ctx);vm.runInContext(section('  function statisticalAnchorElements(','  function renderStatisticalAnnotations(')+section('  function anchoredStatisticalLayout(','  function measureConditionMatrixAxes(')+section('  function annotationHeight(','  function editedSvg(')+section('  function applyElementOffsets(','  function wrapPanelContent('),ctx);
function reset(item,style='p',size=9){fixture=item;svg=new Node(item.svg);const box=svg.getAttribute('viewBox').split(/\s+/).map(Number);variant={name:'compare_interaction',viewBox:box,width:box[2],height:box[3],preserveAspect:true};state={panels:{p:{variant:0,edits:{0:{}},annotationStyle:style,annotationFont:{font:'Arial',size}}}};}
let checks=0;
let movedLabels=0,checkedAgainstSegments=0;
// Independent line/rectangle clipping: compare the rendered label box against
// every real mean line/error stem, not the implementation's obstacle intervals.
function segmentHitsBox(a,b,box){let lo=0,hi=1;for(const [p,q]of [[a.x-b.x,a.x-box.left],[b.x-a.x,box.right-a.x],[a.y-b.y,a.y-box.top],[b.y-a.y,box.bottom-a.y]]){if(Math.abs(p)<1e-10){if(q<0)return false;continue;}const r=q/p;if(p<0)lo=Math.max(lo,r);else hi=Math.min(hi,r);if(lo>hi)return false;}return true;}
function realDataSegments(axis){return axis.children.filter(n=>/^(?:studio-mark-|LineCollection|line2d_)/.test(n.id)&&n.querySelector('[clip-path]')).flatMap(group=>group.querySelectorAll('path').filter(n=>!n.closest('defs')&&n.getAttribute('clip-path')).flatMap(n=>{const values=(n.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[]).map(Number),points=[];for(let i=0;i+1<values.length;i+=2)points.push({x:values[i],y:values[i+1]});return points.slice(1).map((b,i)=>[points[i],b]);}));}
for(const item of fixtures)for(const style of ['p','stars','letters']){
 reset(item,style);const before=JSON.stringify(item.analysis),original=svg.querySelectorAll('path').map(node=>[node,node.getAttribute('d')]),box=svg.getAttribute('viewBox'),info=ctx.statisticalAnnotationInfo('p');
 assert.equal(info.placement,'vertical',JSON.stringify({size:item.size,style,reason:info.reason,plan:info.plotSets&&ctx.verticalStatisticalLayout(info.plotSets,style,state.panels.p,{},1).plans.map(p=>({fits:p.fits,rail:p.rail,frame:p.set.labelFrame,items:p.items.map(i=>({fit:i.plan.fits,width:i.plan.width,y:i.labelY,height:i.height}))}))}));assert.equal(info.available,true);assert.equal(ctx.annotationHeight('p',state),0);assert.equal(ctx.drawingHeight('p',state),variant.height);
 assert.equal(ctx.appendVerticalStatistics(svg,'p',0,state,variant,info),true);assert.equal(svg.getAttribute('viewBox'),box);assert.equal(svg.hasAttribute('data-stat-band-height'),false);
 const lines=svg.querySelectorAll('[data-stat-bracket]'),texts=svg.querySelectorAll('[data-stat-vertical-label]');assert.equal(lines.length,style==='letters'?0:9);assert.equal(texts.length,9);
 for(const [node,d]of original)assert.equal(node.getAttribute('d'),d);
 for(const set of info.plotSets){
  const paths=lines.filter(node=>node.getAttribute('data-stat-facet')===set.label),labels=texts.filter(node=>node.getAttribute('data-stat-facet')===set.label),planned=ctx.verticalStatisticalLayout([set],style,state.panels.p,{},1).plans[0];
  assert.equal(labels.length,3);const wanted=style==='letters'?helpers.comparisonLetters(3,set.comparisons):set.comparisons.map(c=>style==='p'?'P'+helpers.statisticalPText(c.p):helpers.statisticalSymbol(c.p,style));
  assert.equal(JSON.stringify(labels.map(n=>n.textContent.replace(/\s/g,''))),JSON.stringify(Array.from(wanted,n=>n.replace(/\s/g,''))));
  for(const [i,node]of paths.entries()){const record=JSON.parse(node.getAttribute('data-stat-bracket')),comparison=set.comparisons[i],m=node.transform.baseVal.consolidate().matrix,a=m.transformPoint({x:record.x1,y:record.top}),b=m.transformPoint({x:record.x2,y:record.top});near(a.y,set.points[comparison.a].y);near(b.y,set.points[comparison.b].y);near(a.x,b.x);assert.equal(record.orientation,'vertical');}
  const segments=realDataSegments(set.axis),textX=planned.x+planned.side*(planned.rail+planned.gap);
  for(const item of planned.items){assert.ok(item.labelY>=set.frame.y);assert.ok(item.labelY+item.height<=set.frame.y+set.frame.height);if(Math.abs(item.labelY-(item.y-item.height/2))>1)movedLabels++;const left=planned.side===1?textX:textX-item.plan.width,box={left:left-1.5,right:left+item.plan.width+1.5,top:item.labelY-1.5,bottom:item.labelY+item.height+1.5};for(const [a,b]of segments){assert.equal(segmentHitsBox(a,b,box),false,`${style}/${item.index}: label must not cover real data segment`);checkedAgainstSegments++;}}
 }
 assert.equal(JSON.stringify(item.analysis),before);checks++;
}
assert.ok(movedLabels>0,'The actual intersecting labels move to nearby free space');assert.ok(checkedAgainstSegments>100,'Check actual series and errors across every size/style');checks++;
reset(fixtures[0]);let info=ctx.statisticalAnnotationInfo('p');ctx.appendVerticalStatistics(svg,'p',0,state,variant,info);const line=svg.querySelector('[data-stat-bracket]');line.setAttribute('data-key','e900000');const m=line.transform.baseVal.consolidate().matrix,start=widths.fromPath(line.getAttribute('d'),{}, {unit:1}),change=widths.setWidthPercent(start,70),oldCenter=m.transformPoint({x:start.center,y:start.y});state.panels.p.edits[0]={e900000:{...change.patch,'offset-x':'3','offset-y':'-2'}};ctx.applyElementOffsets(svg,'p',0,state,1);const resized=widths.fromPath(line.getAttribute('d'),change.patch,{unit:1}),newCenter=line.transform.baseVal.consolidate().matrix.transformPoint({x:resized.center,y:resized.y});near(resized.percent,70);near(newCenter.x,oldCenter.x+3);near(newCenter.y,oldCenter.y-2);checks++;
reset(fixtures[0],'p',90);info=ctx.statisticalAnnotationInfo('p');assert.equal(info.available,false);assert.equal(info.placement,'analysis');assert.equal(ctx.annotationHeight('p',state),0);assert.equal(ctx.drawingHeight('p',state),variant.height);checks++;
reset(fixtures[0]);svg.querySelector('[id="studio-stat-anchors"]').remove();info=ctx.statisticalAnnotationInfo('p');assert.equal(info.placement,'analysis');assert.equal(info.available,false);assert.equal(info.comparisons.length,9);assert.equal(ctx.annotationHeight('p',state),0);assert.match(info.reason,/分析面板/);checks++;
reset(fixtures[0]);ctx.appendVerticalStatistics(svg,'p',0,state,variant,ctx.statisticalAnnotationInfo('p'));svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
const escape=value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),serialize=node=>node.localName?`<${node.localName} ${Object.entries(node.attrs).map(([k,v])=>`${k==='href'?'xlink:href':k}="${escape(v)}"`).join(' ')}>${escape(node.own||'')}${node.children.map(serialize).join('')}</${node.localName}>`:escape(node.textContent||'');
fs.writeFileSync(path.join(root,'.cache/interaction-statistics-qa/interaction-annotated.svg'),serialize(svg));
console.log(`PASS interaction statistics: ${checks} groups; ${checkedAgainstSegments} independent real data/label collision checks, upright values, unchanged geometry/results, no canvas growth, vertical resize/movement and honest unplaceable results.`);
