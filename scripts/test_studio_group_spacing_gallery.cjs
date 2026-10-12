/* Real current renderers, both category directions, connected paths, and edits. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),spacing=require('../skills/polish-sci-figures/assets/figure-studio/group-spacing.js');
const adapter=fs.readFileSync(path.join(__dirname,'test_studio_group_spacing.cjs'),'utf8'),context={assert};
const begin=adapter.indexOf('class Matrix{'),end=adapter.indexOf('const fixtureTrees=');assert.ok(begin>=0&&end>begin);
vm.runInNewContext(adapter.slice(begin,end)+';this.Node=Node;this.transformed=transformed;',context);
const folder=path.join(root,'.cache/group-spacing-gallery'),manifestFile=path.join(folder,'manifest.json');
assert.ok(fs.existsSync(manifestFile),'Run python scripts/build_group_spacing_fixtures.py first');
const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
const runtime=process.env.PYTHON||[path.join(root,'.venv/bin/python'),path.join(root,'.venv/Scripts/python.exe')].find(fs.existsSync)||'python';
const py=String.raw`import json,sys,xml.etree.ElementTree as E,pathlib
def tree(e):return {'tag':e.tag.split('}')[-1],'attrs':{k.split('}')[-1]:v for k,v in e.attrib.items()},'text':e.text or '', 'children':[tree(c) for c in e]}
base=pathlib.Path(sys.argv[1]);entries=json.loads((base/'manifest.json').read_text(encoding='utf-8'))
print(json.dumps([tree(E.parse(base/e['file']).getroot()) for e in entries]))`;
const parsed=cp.spawnSync(runtime,['-c',py,folder],{cwd:root,encoding:'utf8',maxBuffer:64e6});assert.equal(parsed.status,0,parsed.stderr);
const trees=JSON.parse(parsed.stdout),box=node=>context.transformed(node.getBBox(),node.getScreenCTM());
let checks=0,movable=0,blocked=0,connected=0,vertical=0;const limited=[];
const eq=(a,b,message)=>{assert.deepEqual(a&&typeof a==="object"?JSON.parse(JSON.stringify(a)):a,b&&typeof b==="object"?JSON.parse(JSON.stringify(b)):b,message);checks++;},near=(a,b,message)=>{assert.ok(Math.abs(a-b)<1e-6,`${message}: ${a} != ${b}`);checks++;};
const failures=[];
for(const [i,entry]of manifest.entries()){
  const svg=new context.Node(trees[i]),info=spacing.inspect(svg,{view:entry.view}),name=entry.view+'/'+entry.case;
  if(!info.available){failures.push(name+': '+info.reason);continue;}
  const nodes=svg.querySelectorAll('g,path,use,text,rect,circle,ellipse'),original=nodes.map(node=>({node,attrs:{...node.attrs},text:node.textContent,box:box(node)}));
  const unchanged=spacing.apply(svg,1,{view:entry.view});
  if(unchanged.available)for(const item of original){near(box(item.node).x,item.box.x,name+' baseline x');near(box(item.node).y,item.box.y,name+' baseline y');}
  spacing.restore(svg);
  const moved=spacing.apply(svg,.6,{view:entry.view});
  if(!moved.available){eq(moved.reason,'insufficient-group-space',name+' safe nonoverlap rejection');for(const item of original)eq(item.node.attrs,item.attrs,name+' rejected operation is atomic');limited.push(name);blocked++;continue;}
  movable++;
  for(const axis of moved.axes){
    const direction=axis.direction||'x',orthogonal=direction==='x'?'y':'x';if(direction==='y')vertical++;
    for(const [j,group]of axis.groups.entries()){
      if(j)near(group.newCenter-axis.groups[j-1].newCenter,(group.center-axis.groups[j-1].center)*moved.factor,name+' category interval');
      for(const node of group.nodes){const item=original.find(item=>item.node===node);assert.ok(item);const after=box(node);near(after[direction],item.box[direction]+group.delta,name+' full group translation');near(after[orthogonal],item.box[orthogonal],name+' response coordinate unchanged');near(after.width,item.box.width,name+' glyph width unchanged');near(after.height,item.box.height,name+' glyph height unchanged');}
      for(const node of group.texts)near(Number(node.getAttribute(direction==='y'?'data-studio-category-center-y':'data-studio-category-center')),group.newCenter,name+' semantic center');
    }
    for(const connection of axis.connections||[]){
      connected++;const values=connection.node.getAttribute('d').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/ig).map(Number);
      connection.vertices.forEach((v,j)=>{near(values[j*2+(direction==='x'?1:0)],direction==='x'?v.y:v.x,name+' connection response unchanged');near(values[j*2+(direction==='x'?0:1)],(direction==='x'?v.x:v.y)+axis.groups[v.index].delta,name+' connection category matches marker');});
    }
    for(const label of axis.annotations||[]){const item=original.find(o=>o.node===label.node),delta=label.indices.reduce((n,index)=>n+axis.groups[index].delta,0)/label.indices.length;near(box(label.node)[direction],item.box[direction]+delta,name+' comparison label follows both groups');eq(label.node.textContent,item.text,name+' comparison text remains unchanged');}
  }
  if(entry.view==='compare_cumming'){eq(moved.axes.length,2,name+' observation and effect axes both participate');for(const group of moved.axes[0].groups){const effect=moved.axes[1].groups.find(g=>g.label===group.label);assert.ok(effect);near(group.newCenter,effect.newCenter,name+' observation and effect columns remain aligned');}}
  for(const item of original){eq(item.node.getAttribute('style'),item.attrs.style??null,name+' no typography/style scaling');if(item.node.localName==='text')eq(item.node.textContent,item.text,name+' scientific text retained');}
  spacing.restore(svg);for(const item of original)eq(item.node.attrs,item.attrs,name+' complete undo');
}
assert.deepEqual(failures,[],'Every declared supported family must expose actual category geometry');
const previews=JSON.parse(fs.readFileSync(path.join(root,'skills/polish-sci-figures/assets/figure-studio/catalogue-previews.json'),'utf8'));
for(const view of ['compare_bracket_p','compare_bracket_stars','compare_control_symbols','compare_ridgeline','coverage_tracks','gene_arrows','parallel_coordinates'])assert.ok(previews[view].includes('studio-spacing-'),view+' packaged preview includes the current semantic anchors');
// Even a valid category SVG must not bypass a view whose adjacency/angles are data.
for(const view of ['correlation_circles','singlecell_dots','oncoprint_matrix','clustered_matrix','classification_counts','rose_frequency','radar_profile','missingness_matrix']){
  assert.ok(previews[view],view+' catalogue fixture exists');const svg=new context.Node(trees[0]),before=JSON.stringify(svg.attrs);const result=spacing.apply(svg,.6,{view});eq(result.available,false,view+' structural guard');eq(result.reason,'coordinate-structure-must-remain-fixed');eq(svg.querySelectorAll('[data-studio-category-center]').length,0,view+' never partially translates categories');
}
assert.ok(vertical>20,'Vertical categorical families are exercised');assert.ok(connected>50,'Paired and interaction endpoints are exercised');
console.log(`PASS gallery group spacing: ${checks} geometry assertions; ${manifest.length} actual SVGs, ${movable} movable, ${blocked} safely space-limited, ${vertical} vertical axes, ${connected} connections.`);
if(limited.length)console.log('Safe limits:',limited.join(', '));
