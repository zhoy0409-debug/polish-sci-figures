/* Real legacy SVG structure + independent deterministic geometry adapter.
 * Browser glyph measurements remain part of interactive acceptance testing. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),spacing=require('../skills/polish-sci-figures/assets/figure-studio/group-spacing.js');
const files=['demo/workbench/raw_points_estimate_ci.svg','demo/workbench/estimation_graphic.svg'];
const claude='.cache/claude-qa-source/Fig_group_comparison.svg';if(fs.existsSync(path.join(root,claude)))files.push(claude);
for(const name of ['raw_points_estimate_ci','estimation_graphic'])for(const suffix of ['','-wide','-portrait']){const file=`.cache/legacy-group-metadata/${name}${suffix}.svg`;assert.ok(fs.existsSync(path.join(root,file)),`Missing current renderer fixture: run python scripts/test_legacy_group_metadata.py first (${file})`);files.push(file);}
const python=String.raw`import sys,json,xml.etree.ElementTree as E
def tree(e):return {'tag':e.tag.split('}')[-1],'attrs':{k.split('}')[-1]:v for k,v in e.attrib.items()},'text':e.text or '', 'children':[tree(c) for c in e]}
print(json.dumps([tree(E.parse(f).getroot()) for f in sys.argv[1:]]))`;
const runtime=process.env.PYTHON||[path.join(root,'.venv/bin/python'),path.join(root,'.venv/Scripts/python.exe')].find(file=>fs.existsSync(file))||'python';
const result=cp.spawnSync(runtime,['-c',python,...files.map(f=>path.join(root,f))],{encoding:'utf8',maxBuffer:4e6});assert.equal(result.status,0,result.stderr);
class Matrix{
  constructor(v=[1,0,0,1,0,0]){[this.a,this.b,this.c,this.d,this.e,this.f]=v;}
  multiply(m){return new Matrix([this.a*m.a+this.c*m.b,this.b*m.a+this.d*m.b,this.a*m.c+this.c*m.d,this.b*m.c+this.d*m.d,this.a*m.e+this.c*m.f+this.e,this.b*m.e+this.d*m.f+this.f]);}
  inverse(){const k=this.a*this.d-this.b*this.c;return new Matrix([this.d/k,-this.b/k,-this.c/k,this.a/k,(this.c*this.f-this.d*this.e)/k,(this.b*this.e-this.a*this.f)/k]);}
}
function transform(raw){let m=new Matrix();for(const match of (raw||'').matchAll(/(matrix|translate|scale|rotate)\(([^)]+)\)/g)){const v=match[2].trim().split(/[ ,]+/).map(Number);let n;if(match[1]==='matrix')n=new Matrix(v);else if(match[1]==='translate')n=new Matrix([1,0,0,1,v[0],v[1]||0]);else if(match[1]==='scale')n=new Matrix([v[0],0,0,v[1]??v[0],0,0]);else{const a=v[0]*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=v[1]||0,y=v[2]||0;n=new Matrix([c,s,-s,c,x-c*x+s*y,y-s*x-c*y]);}m=m.multiply(n);}return m;}
const combine=boxes=>{if(!boxes.length)return {x:0,y:0,width:0,height:0};const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};};
function transformed(b,m){const pts=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>[m.a*x+m.c*y+m.e,m.b*x+m.d*y+m.f]),x=Math.min(...pts.map(p=>p[0])),y=Math.min(...pts.map(p=>p[1]));return {x,y,width:Math.max(...pts.map(p=>p[0]))-x,height:Math.max(...pts.map(p=>p[1]))-y};}
class Node{
  constructor(v){this.localName=v.tag;this.attrs={...v.attrs};this.own=v.text||'';this.children=(v.children||[]).map(c=>new Node(c));this.children.forEach(c=>c.parentNode=c.parentElement=this);this.isConnected=true;this.style={display:'',setProperty(){}};}
  get id(){return this.attrs.id||'';}set id(value){this.attrs.id=value;}get namespaceURI(){return 'http://www.w3.org/2000/svg';}get textContent(){return this.own+this.children.map(c=>c.textContent).join('');}set textContent(v){this.own=v;this.children=[];}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,localName:name,value}));}removeAttributeNode(attr){delete this.attrs[attr.localName];}
  getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}removeAttribute(k){delete this.attrs[k];}
  hasAttribute(k){return k in this.attrs;}append(...nodes){for(const node of nodes){node.parentNode=node.parentElement=this;this.children.push(node);}}
  matches(selector){return selector.split(',').some(s=>{const m=s.trim().match(/^(?:([\w-]+))?(?:\[([\w-]+)(\^?=)?["']?([^"'\]]*)["']?\])?$/);return !!m&&(!m[1]||m[1]===this.localName)&&(!m[2]||(m[3]==='^='?(this.attrs[m[2]]||'').startsWith(m[4]):m[3]==='='?this.attrs[m[2]]===m[4]:m[2] in this.attrs));});}
  querySelectorAll(s){if(s.includes('] ')){const i=s.indexOf('] ')+1;return this.querySelectorAll(s.slice(0,i)).flatMap(n=>n.querySelectorAll(s.slice(i+1)));}return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}closest(s){for(let n=this;n;n=n.parentNode)if(n.matches(s))return n;return null;}contains(child){for(let n=child;n;n=n.parentNode)if(n===this)return true;return false;}
  remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=this.parentElement=null;}}
  get transform(){return {baseVal:{consolidate:()=>this.attrs.transform?{matrix:transform(this.attrs.transform)}:null}};}
  getScreenCTM(){return (this.parentNode?.getScreenCTM()||new Matrix()).multiply(transform(this.attrs.transform));}
  getBBox(){
    const a=this.attrs,num=k=>Number(a[k]||0);
    if(this.localName==='defs'||this.localName==='metadata')return {x:0,y:0,width:0,height:0};
    if(this.localName==='rect')return {x:num('x'),y:num('y'),width:num('width'),height:num('height')};
    if(this.localName==='text'){const size=Number((a.style||'').match(/(?:font-size:|font:)\s*([.\d]+)px/)?.[1]||a['font-size']||9),w=this.textContent.length*size*.53,anchor=(a.style||'').match(/text-anchor:\s*(\w+)/)?.[1]||a['text-anchor'];return {x:num('x')-(anchor==='middle'?w/2:anchor==='end'?w:0),y:num('y')-size*.8,width:w,height:size};}
    if(this.localName==='use'){const svg=this.closest('svg'),ref=svg.querySelector(`[id="${a.href?.slice(1)}"]`),b=ref?.getBBox()||{x:0,y:0,width:0,height:0};return {...b,x:b.x+num('x'),y:b.y+num('y')};}
    if(this.localName==='path'){const d=a.d||'';assert.ok((d.replace(/[eE][-+]?\d+/g,'').match(/[a-z]/ig)||[]).every(command=>'MLCQZz'.includes(command)), 'Adapter only supports absolute M/L/C/Q/Z paths');const values=(d.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[]).map(Number),pts=[];for(let i=0;i<values.length;i+=2)pts.push({x:values[i],y:values[i+1],width:0,height:0});return combine(pts);}
    // Empty Matplotlib tick-line groups have no rendered geometry. Unlike an
    // actual point/line, they must not pull a parent bounding box to (0, 0).
    return combine(this.children.filter(c=>!['defs','metadata'].includes(c.localName)).map(c=>transformed(c.getBBox(),transform(c.attrs.transform))).filter(b=>b.width||b.height));
  }
}
const fixtureTrees=JSON.parse(result.stdout),fresh=i=>new Node(fixtureTrees[i]);
let checks=0;
function eq(a,b,message){assert.deepEqual(a,b,message);checks++;}
function near(a,b){assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);checks++;}
function screenBox(node){return transformed(node.getBBox(),node.getScreenCTM());}
for(let i=0;i<fixtureTrees.length;i++){
  const svg=fresh(i),info=spacing.inspect(svg);assert.equal(info.available,true,files[i]+': '+info.reason);eq(info.axes.length,1,'Only the observed category axis participates');assert.ok(info.axes[0].groups[0].label.startsWith('Control')&&info.axes[0].groups[1].label.startsWith('Treatment'));
  const all=svg.querySelectorAll('path,use,text'),original=all.map(n=>({n,attrs:{...n.attrs},box:screenBox(n)})),effect=svg.querySelector('[id="axes_2"]'),effectBefore=effect&&JSON.stringify(effect.attrs)+JSON.stringify(effect.children.map(n=>n.attrs));
  const moved=spacing.apply(svg,.5);
  if(!moved.available){assert.ok(files[i].includes('legacy-group-metadata/estimation_graphic'));eq(moved.reason,'insufficient-group-space','Long labels that cannot fit are not squeezed or overlapped');for(const {n,attrs}of original)eq(n.attrs,attrs);continue;}
  assert.ok(moved.factor>=.5&&moved.factor<=moved.maxFactor);near(moved.axes[0].groups[1].newCenter-moved.axes[0].groups[0].newCenter,(info.axes[0].groups[1].center-info.axes[0].groups[0].center)*moved.factor);
  for(const {n,attrs,box} of original){const b=screenBox(n);near(b.y,box.y);near(b.width,box.width);near(b.height,box.height);eq(n.getAttribute('d'),attrs.d??null);eq(n.getAttribute('style'),attrs.style??null);}
  for(const group of moved.axes[0].groups)for(const node of group.nodes){const before=original.find(o=>o.n===node);if(before)near(screenBox(node).x-before.box.x,group.delta);}
  if(effect)eq(JSON.stringify(effect.attrs)+JSON.stringify(effect.children.map(n=>n.attrs)),effectBefore,'Effect-axis state does not change');
  spacing.apply(svg,.75);spacing.apply(svg,1);for(const {n,attrs}of original)eq(n.getAttribute('transform'),attrs.transform??null,'Repeated updates do not accumulate transforms');
  spacing.restore(svg);for(const {n,attrs}of original)eq(n.attrs,attrs,'Restore returns every original attribute');
  const plan=spacing.plan(info,10);assert.ok(plan.factor<10&&plan.factor>=1);for(const ax of plan.axes)for(const g of ax.groups){assert.ok(g.dataBounds.left+g.delta>=ax.frame.left-.5);assert.ok(g.dataBounds.right+g.delta<=ax.frame.right+.5);}
}
const numericSvg=fresh(0);numericSvg.querySelector('[id="xtick_1"] text').textContent='0';numericSvg.querySelector('[id="xtick_2"] text').textContent='1';eq(spacing.inspect(numericSvg).available,false,'Numeric axis is not inferred as categories');eq(spacing.inspect(numericSvg,{orders:[['0','1']]}).available,true,'Explicit group labels permit numeric names');
const unknownMatrix=fresh(0);unknownMatrix.querySelectorAll('[id^="ytick_"]').forEach((tick,i)=>tick.querySelector('text').textContent='Feature '+i);eq(spacing.inspect(unknownMatrix).reason,'coordinate-structure-must-remain-fixed','An unnamed imported matrix cannot be misidentified as independent groups');
const lineSvg=fresh(0),axis=lineSvg.querySelector('[id="axes_1"]'),clip=axis.querySelector('[clip-path]').getAttribute('clip-path'),cross=new Node({tag:'g',attrs:{id:'line2d_cross'},children:[{tag:'path',attrs:{d:'M 108 150 L 290 100','clip-path':clip}}]});cross.parentNode=cross.parentElement=axis;axis.children.push(cross);eq(spacing.inspect(lineSvg).available,false,'Paired lines cannot be assigned to one group');
const bar=fresh(0);bar.querySelector('[id="PathCollection_1"]').setAttribute('id','studio-bar-0');eq(spacing.inspect(bar).reason,'existing-bar-layout','No double application to existing bar geometry');
const zoomed=fresh(0);zoomed.setAttribute('transform','matrix(0.3 0 0 0.3 170 20)');const ordinary=spacing.apply(fresh(0),.7),zoomPlan=spacing.apply(zoomed,.7);near(ordinary.factor,zoomPlan.factor);ordinary.axes[0].groups.forEach((g,i)=>near(g.newCenter,zoomPlan.axes[0].groups[i].newCenter));
const nested=fresh(0),nestedAxis=nested.querySelector('[id="axes_1"]');nestedAxis.setAttribute('transform','matrix(1.3 0 0 0.8 20 14)');const nestedBefore=nested.querySelectorAll('use').map(node=>({node,box:screenBox(node)})),nestedPlan=spacing.apply(nested,.7);eq(nestedPlan.available,true);for(const {node,box}of nestedBefore){const b=screenBox(node);near(b.y,box.y);near(b.width,box.width);near(b.height,box.height);}const rotated=fresh(0);rotated.querySelector('[id="axes_1"]').setAttribute('transform','rotate(15)');eq(spacing.inspect(rotated).available,false,'Rotated category axes need a different coordinate contract');
for(const factor of [NaN,Infinity,-1,0])assert.throws(()=>spacing.plan({available:false,axes:[]},factor));
// Metadata pathway: explicit category identities also survive edited tick text.
const explicit=fresh(0),info=spacing.inspect(explicit),record={version:1,axes:info.axes.map(ax=>({axis:ax.id,groups:ax.groups.map(g=>({label:g.label,tick:g.nodes[0].id,members:g.nodes.map(n=>n.id)}))}))},metadata=new Node({tag:'metadata',attrs:{id:'studio-category-groups'},text:JSON.stringify(record)});metadata.parentNode=metadata.parentElement=explicit;explicit.children.push(metadata);explicit.querySelector('[id="xtick_1"] text').textContent='Revised label';eq(spacing.inspect(explicit).axes[0].explicit,true,'Explicit identities do not depend on edited display text');
eq(spacing.validateMetadata(record),true);eq(spacing.validateMetadata(JSON.stringify(record)),true);
for(const change of [r=>r.version=2,r=>r.extra=true,r=>r.axes[0].groups[0].members.push('bad"selector'),r=>r.axes[0].groups[0].tick='missing',r=>r.axes[0].groups[1].label=r.axes[0].groups[0].label]){const bad=JSON.parse(JSON.stringify(record));change(bad);eq(spacing.validateMetadata(bad),false);}
const exported=fresh(files.findIndex(file=>file.includes('legacy-group-metadata/raw_points_estimate_ci.svg')));spacing.apply(exported,.8);spacing.namespaceMetadata(exported,'f101-');for(const node of [exported,...exported.querySelectorAll('g,path,use,text,rect,clipPath,metadata')]){if(node.id)node.id='f101-'+node.id;for(const key of ['href','clip-path'])if(node.attrs[key])node.attrs[key]=node.attrs[key].replace(/#([\w.-]+)/g,'#f101-$1');}
const cloneTree=node=>({tag:node.localName,attrs:{...node.attrs},text:node.own,children:node.children.map(cloneTree)}),imported=new Node(cloneTree(exported)),reopened=spacing.inspect(imported);eq(reopened.available,true,'Exported prefixes retain explicit identities in a fresh DOM');eq(reopened.axes[0].explicit,true);
const importedBoxes=imported.querySelectorAll('path,use,text').map(node=>({node,box:screenBox(node)})),importedCenters=reopened.axes[0].groups.map(group=>group.center);const unchanged=spacing.apply(imported,1);eq(unchanged.available,true,'A freshly imported SVG treats its exported spacing as its baseline');unchanged.axes[0].groups.forEach((group,index)=>near(group.newCenter,importedCenters[index]));for(const {node,box}of importedBoxes)eq(screenBox(node),box,'Import at 100% preserves the exported positions and glyph dimensions');assert.ok(spacing.apply(imported,.7).available,'Namespaced reimport remains adjustable');
// Reuse the actual annotation/condition-axis selector and measurement functions.
// This catches renderer IDs silently pushing plot annotations back into a band.
const source=fs.readFileSync(path.join(root,'skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8'),start=source.indexOf('  function statisticalAnchorElements('),end=source.indexOf('  function statisticalAnnotationSets(',start);
const metadataStart=source.indexOf("      if (el.localName === 'metadata')"),metadataEnd=source.indexOf("      if (el.localName === 'style')",metadataStart);assert.ok(metadataStart>0&&metadataEnd>metadataStart);
const metadataContext={NS:'http://www.w3.org/2000/svg',StudioGroupSpacing:spacing,nodes:imported.querySelectorAll('metadata')};vm.createContext(metadataContext);vm.runInContext('for(const el of nodes){'+source.slice(metadataStart,metadataEnd)+'}',metadataContext);eq(imported.querySelectorAll('metadata').filter(n=>n.id.endsWith('studio-category-groups')).length,1,'Sanitization retains only validated category metadata');eq(spacing.inspect(imported).available,true,'Sanitized import remains adjustable');
class Point{constructor(x,y){this.x=x;this.y=y;}matrixTransform(m){return new Point(m.a*this.x+m.c*this.y+m.e,m.b*this.x+m.d*this.y+m.f);}}
let currentOrder=[];const context={DOMPoint:Point,document:{createElement:()=>({style:{},append(){},remove(){}}),body:{append(){}}},statisticalAnalysisFor:()=>({group_order:currentOrder})};vm.createContext(context);vm.runInContext(source.slice(start,end),context);
for(let i=0;i<fixtureTrees.length;i++){
  const svg=fresh(i),info=spacing.inspect(svg);currentOrder=info.axes[0].groups.map(g=>g.label);const anchors=context.statisticalAnchorElements(svg,currentOrder);assert.ok(anchors,files[i]+': production statistics must locate explicit or inferred groups');
  const before=context.measureStatisticalAnchors(svg,anchors),moved=spacing.apply(svg,.75);if(!moved.available)continue;
  const after=context.measureStatisticalAnchors(svg,context.statisticalAnchorElements(svg,currentOrder));after.centers.forEach((x,j)=>near(x,moved.axes[0].groups[j].newCenter));after.tops.forEach((y,j)=>near(y,before.tops[j]));
  const sets=context.conditionMatrixAxes(svg,'p',{});eq(sets.length,1);for(const [j,tick]of sets[0].anchors.nodes.entries())near(Number(tick.getAttribute('data-studio-category-center')),moved.axes[0].groups[j].newCenter);
}
const matrixStart=source.indexOf('  function measureConditionMatrixAxes('),matrixEnd=source.indexOf('  function annotationHeight(',matrixStart);assert.ok(matrixStart>0&&matrixEnd>matrixStart);
context.NS='http://www.w3.org/2000/svg';context.StudioGroupSpacing=spacing;context.document.createElementNS=(_,tag)=>new Node({tag,attrs:{}});context.editsFor=()=>({});context.statisticalTextWidth=(text,font,size)=>String(text).length*size*.53;context.translateStatisticalElement=()=>{};
let fixtureIndex=0;context.baseSvg=()=>fresh(fixtureIndex);context.editedSvg=()=>fresh(fixtureIndex);context.groupSpacingOrders=()=>[currentOrder];context.panel=()=>({variants:[{width:345.6,height:259.2,viewBox:[0,0,345.6,259.2]}]});
vm.runInContext(source.slice(matrixStart,matrixEnd),context);
for(fixtureIndex=0;fixtureIndex<fixtureTrees.length;fixtureIndex++){
  const svg=fresh(fixtureIndex),info=spacing.inspect(svg);currentOrder=info.axes[0].groups.map(g=>g.label);const config={enabled:true,font:{size:9,font:'Arial'},rows:[{label:'Exposure',values:Object.fromEntries(currentOrder.map(group=>[group,'high dose after treatment']))},{label:'Dose',values:Object.fromEntries(currentOrder.map((group,i)=>[group,String(i*28)]))}]},state={panels:{p:{variant:0,conditionMatrix:config,groupSpacing:{factor:.65}}},typography:{font:'Arial',size:9}},v={width:Number(svg.getAttribute('viewBox').split(/\s+/)[2]),viewBox:svg.getAttribute('viewBox').split(/\s+/).map(Number)};
  context.panel=()=>({variants:[v]});const reserved=context.conditionMatrixHeight('p',state),moved=spacing.apply(svg,.65);if(!moved.available)continue;const sourcePaths=svg.querySelectorAll('path').map(node=>node.getAttribute('d')),drawn=context.appendConditionMatrix(svg,'p',0,state,v);assert.ok(reserved>=drawn.totalHeight-1e-8,'Reserved matrix height covers the drawn layout after spacing');eq(svg.querySelectorAll('path').map(node=>node.getAttribute('d')),sourcePaths,'Condition table and group spacing do not alter source data paths');
  for(const row of svg.querySelectorAll('[data-condition-cell]')){const group=currentOrder.indexOf(row.getAttribute('data-condition-cell'));if(group>=0)near(Number(row.getAttribute('x')),moved.axes[0].groups[group].newCenter);}
}
console.log(`PASS category spacing: ${checks} geometry/identity assertions, ${files.length} real SVG fixtures (including Claude fixture when present)`);
