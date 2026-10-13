/* Upgrade real legacy Matplotlib cells by geometry without renumbering edits. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),metadata=require('../skills/polish-sci-figures/assets/figure-studio/statistical-metadata.js');
const python=process.env.PYTHON||[path.join(root,'.venv/Scripts/python.exe'),path.join(root,'.venv/bin/python')].find(fs.existsSync)||'python';
const program=String.raw`
import io,json,sys,xml.etree.ElementTree as E
from pathlib import Path
from unittest.mock import patch
root=Path(sys.argv[1]);sys.path[:0]=[str(root/'skills/make-sci-data-figures/scripts'),str(root/'skills/polish-sci-figures/scripts')]
import pandas as pd,matplotlib.pyplot as plt
import gallery_registry,gallery_workbench,gallery_compare
from figure_workbench import style
from gallery_marks import prepare_marks,embed_marks
from studio_server import reflow
def tree(node):return {'tag':node.tag.split('}')[-1],'attrs':{k.split('}')[-1]:v for k,v in node.attrib.items()},'text':node.text or '', 'children':[tree(c) for c in node]}
def export(data,view,size,legacy):
 if not legacy:
  rows=[data.columns.tolist(),*data.astype(str).values.tolist()]
  result=reflow({'family':'gallery','parameters':{'view':view},'font':'DejaVu Sans'},rows,size[0]*72,size[1]*72)
  assert abs(result['width']-size[0]*72)<1e-6 and abs(result['height']-size[1]*72)<1e-6
  return tree(E.fromstring(result['svg']))
 owner={'grouped_observations':gallery_workbench,'compare_facet_boxes':gallery_compare}[view]
 with patch.object(owner,'tag_stat_group',(lambda *args:None) if legacy else owner.tag_stat_group):
  fig=gallery_registry.render(data,view,figsize=size);prepare_marks(fig);stream=io.StringIO();fig.savefig(stream,format='svg',metadata={'Date':None});raw=embed_marks(stream.getvalue(),fig);plt.close(fig)
 return tree(E.fromstring(raw))
style('DejaVu Sans');output=[]
for view in ['grouped_observations','compare_facet_boxes']:
 for size in [(4.8,3.6),(7.2,3.6)]:
  data=pd.DataFrame([{'factor':f,'group':g,'unit':str(n),'value':12+fi*4+gi*2.5+r}
    for fi,f in enumerate(['Line 1','Line &2','Line <3>']) for gi,g in enumerate(['Control','Stress','Rescue'])
    for n,r in enumerate([-1.2,-.4,.2,.8,1.1,1.8])])
  output.append({'view':view,'size':size,'source':export(data,view,size,True),'fresh':export(data,view,size,False)})
print(json.dumps(output,ensure_ascii=False,allow_nan=False))
`;
const result=cp.spawnSync(python,['-X','utf8','-c',program,root],{cwd:root,encoding:'utf8',maxBuffer:16e6});assert.equal(result.status,0,result.stderr);
class Element{
  constructor(raw){this.localName=raw.tag;this.attrs={...raw.attrs};this.content=raw.text||'';this.children=(raw.children||[]).map(c=>new Element(c));for(const child of this.children)child.parentElement=this;this.ownerDocument=document;}
  get id(){return this.attrs.id||'';}set id(value){this.attrs.id=value;}
  get textContent(){return this.content+this.children.map(c=>c.textContent).join('');}set textContent(value){this.content=String(value);this.children=[];}
  getAttribute(name){return this.attrs[name]??null;}getAttributeNS(_,name){return this.getAttribute(name);}
  setAttribute(name,value){this.attrs[name]=String(value);}
  querySelectorAll(selector){const out=[],visit=node=>{for(const child of node.children){if(selector==='*'||child.localName===selector)out.push(child);visit(child);}};visit(this);return out;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  appendChild(child){this.children.push(child);child.parentElement=this;return child;}
}
const document={createElementNS:(_,name)=>new Element({tag:name,attrs:{},children:[]})};
const raw=node=>({tag:node.localName,attrs:{...node.attrs},text:node.content,children:node.children.map(raw)});
const keyTree=node=>{[node,...node.querySelectorAll('*')].forEach((n,i)=>n.setAttribute('data-key','e'+i));return node;};
const byId=(svg,id)=>[svg,...svg.querySelectorAll('*')].find(n=>n.id===id);
const clone=node=>new Element(raw(node));
const input=JSON.parse(result.stdout),fixtures=input.map(item=>({...item,source:keyTree(new Element(item.source)),fresh:keyTree(new Element(item.fresh))}));
const meta=svg=>JSON.parse(byId(svg,'studio-stat-anchors').textContent);
let checks=0;
for(const fixture of fixtures){
  const source=clone(fixture.source),before=JSON.stringify(raw(source)),freshBefore=JSON.stringify(raw(fixture.fresh));
  // Real saved edit records are keyed to unchanged original nodes, including
  // style/offset/hidden overrides, lock lists and manually selected groups.
  const artists=source.querySelectorAll('g').filter(n=>n.parentElement?.id==='axes_1'&&(n.id.startsWith('studio-mark-')||/^patch_[3-9]$/.test(n.id)));
  const keys=artists.slice(0,5).map(n=>n.getAttribute('data-key')),state={edits:Object.fromEntries(keys.map(k=>[k,{fill:'#abc123','offset-x':'3',hidden:'true'}])),lockedElements:keys,elementGroups:[keys]};
  const stateBefore=JSON.stringify(state);assert.ok(keys.length>=3);
  assert.equal(metadata.attach(source,fixture.fresh),true,fixture.view+' '+fixture.size);checks++;
  const appended=source.children.pop();assert.equal(appended.id,'studio-stat-anchors');assert.equal(JSON.stringify(raw(source)),before,'No old node, ID, key, path, defs or style changes');
  source.appendChild(appended);assert.equal(JSON.stringify(raw(fixture.fresh)),freshBefore,'Fresh renderer output stays immutable');
  assert.equal(JSON.stringify(state),stateBefore);for(const key of keys)assert.ok(source.querySelectorAll('*').find(n=>n.getAttribute('data-key')===key));
  const upgraded=meta(source),expected=meta(fixture.fresh);assert.equal(upgraded.axes.length,expected.axes.length);
  for(const [ai,axis]of upgraded.axes.entries())for(const [ci,cell]of axis.groups.entries()){
    const fresh=expected.axes[ai].groups[ci];assert.equal(cell.group,fresh.group);assert.deepEqual(cell.facet,fresh.facet);assert.deepEqual(cell.center,fresh.center);assert.equal(cell.members.length,fresh.members.length);
    for(const id of cell.members)assert.equal(byId(source,id).parentElement.id,axis.axis);
  }
  assert.equal(metadata.attach(source,fixture.fresh),false,'Existing metadata is not overwritten');
}
const first=fixtures[0],freshMeta=meta(first.fresh),firstMember=freshMeta.axes[0].groups[0].members[0];
function rejects(label,editSource,editFresh=()=>{}){
  const source=clone(first.source),fresh=clone(first.fresh);editSource(source);editFresh(fresh);const before=JSON.stringify(raw(source));
  assert.equal(metadata.attach(source,fresh),false,label);assert.equal(JSON.stringify(raw(source)),before,label+' fails atomically');checks++;
}
rejects('Changed canvas',source=>source.setAttribute('width','350pt'));
rejects('Changed root transform',source=>source.setAttribute('transform','translate(12 0)'));
rejects('Changed clipping',source=>{const rect=source.querySelector('clipPath').querySelector('rect');rect.setAttribute('width',String(Number(rect.getAttribute('width'))-10));});
rejects('Changed category labels',source=>{const text=source.querySelectorAll('text').find(n=>n.textContent==='Line 1');text.textContent='Different factor';});
rejects('Changed data location',()=>{},fresh=>{const path=byId(fresh,firstMember).querySelector('path');path.setAttribute('d',path.getAttribute('d').replace(/\d+(?:\.\d+)?/,n=>String(Number(n)+1)));});
rejects('Duplicate artist geometry is ambiguous',source=>{const artist=source.querySelectorAll('g').find(n=>n.parentElement?.id==='axes_1'&&n.id.startsWith('studio-mark-')&&n.querySelector('use'));const duplicate=clone(artist);duplicate.id='duplicated-artist';// Definitions may carry IDs: drop them; original defs remain resolvable.
  duplicate.children=duplicate.children.filter(n=>n.localName!=='defs');source.querySelectorAll('g').find(n=>n.id==='axes_1').appendChild(duplicate);});
rejects('Changed marker shape',source=>{const artist=source.querySelectorAll('g').find(n=>n.parentElement?.id==='axes_1'&&n.id.startsWith('studio-mark-')&&n.querySelector('use'));const use=artist.querySelector('use'),shape=byId(source,use.getAttribute('href').slice(1));shape.setAttribute('d',shape.getAttribute('d')+' M 0 0 L 1 1');});
rejects('Unresolved marker',source=>{const use=source.querySelectorAll('g').find(n=>n.parentElement?.id==='axes_1'&&n.id.startsWith('studio-mark-')&&n.querySelector('use')).querySelector('use');use.setAttribute('href','#absent-marker');});
rejects('External marker',()=>{},fresh=>{const use=fresh.querySelectorAll('g').find(n=>n.id.startsWith('studio-mark-stat-')&&n.querySelector('use')).querySelector('use');use.setAttribute('href','https://invalid.example/marker.svg');});
rejects('Missing metadata member',()=>{},fresh=>{const node=byId(fresh,'studio-stat-anchors'),value=meta(fresh);value.axes[0].groups[0].members[0]='absent-artist';node.textContent=JSON.stringify(value);});
rejects('Duplicate statistical cell',()=>{},fresh=>{const node=byId(fresh,'studio-stat-anchors'),value=meta(fresh);value.axes[0].groups.push(value.axes[0].groups[0]);node.textContent=JSON.stringify(value);});
rejects('Invalid anchor center',()=>{},fresh=>{const node=byId(fresh,'studio-stat-anchors'),value=meta(fresh);value.axes[0].groups[0].center[0]='12';node.textContent=JSON.stringify(value);});
rejects('Member from another axis',()=>{},fresh=>{const node=byId(fresh,firstMember);node.parentElement.children=node.parentElement.children.filter(n=>n!==node);fresh.appendChild(node);});
console.log(`PASS statistical metadata: ${checks} real legacy/current geometry and atomic refusal cases; original artwork, edits, IDs, keys, locks and groups retained.`);
