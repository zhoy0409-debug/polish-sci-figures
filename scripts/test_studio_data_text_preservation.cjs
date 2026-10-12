/* Real Matplotlib data updates + production installAsset. Bounded DOM adapter;
 * actual browser editing/rendering has separate acceptance coverage. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),filename='../skills/polish-sci-figures/assets/figure-studio/studio.js',helpers=require(filename),source=fs.readFileSync(require.resolve(filename),'utf8'),rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js');
const copy=x=>JSON.parse(JSON.stringify(x));let checks=0;const eq=(a,b,message)=>{assert.deepEqual(a,b,message);checks++;};
class Node{
  constructor(tag,attrs={},text='',children=[]){this.localName=tag;this.attrs={...attrs};this.ownText=text;this.children=children;for(const n of children)n.parentElement=this;}
  get id(){return this.attrs.id||'';}get textContent(){return this.ownText+this.children.map(n=>n.textContent).join('');}
  getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}
  querySelectorAll(selector){const matches=n=>selector.split(',').some(s=>s==='[data-key]'?n.getAttribute('data-key')!==null:s==='text'||s==='tspan'?n.localName===s:s.startsWith('[id^=')?n.id.startsWith(s.slice(6,-2)):false);return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
const make=(tag,id,text='',children=[])=>new Node(tag,id?{id}:{},text,children),inflate=t=>new Node(t.tag,t.attrs,t.text,(t.children||[]).map(inflate));
function keys(svg){let i=0;const walk=n=>{if(!['metadata','style'].includes(n.localName))n.setAttribute('data-key','e'+i++);n.children.forEach(walk);};walk(svg);return svg;}
const python=process.env.PYTHON||[path.join(root,'.venv','bin','python'),path.join(root,'.venv','Scripts','python.exe')].find(fs.existsSync)||'python';
const program=String.raw`
import io,json,sys,xml.etree.ElementTree as E
from pathlib import Path
sys.path.insert(0,str(Path(sys.argv[1])/'skills/make-sci-data-figures/scripts'))
import pandas as pd, matplotlib.pyplot as plt, gallery_registry
from figure_workbench import style
style('Arial')
rows=[('Control',v) for v in [9.4,9.7,10.1,10.2,10.5,10.8,11.0,11.1]]+[('Treatment',v) for v in [11.3,11.8,12.0,12.2,12.4,12.7,13.0,13.1]]
def tree(e):
 return dict(tag=e.tag.split('}')[-1],attrs=dict(e.attrib),text=e.text or '',children=[tree(c) for c in e if c.tag.split('}')[-1] not in ('metadata','style')])
out=[]
for size,wh in [('original',(4.8,3.6)),('wide',(7.2,3.6)),('portrait',(4.8,5.4))]:
 pair=[]
 for value in [9.4,9.5]:
  data=pd.DataFrame(rows,columns=['group','value']);data['unit']=['subject-'+str(i) for i in range(len(data))];data.loc[0,'value']=value
  fig=gallery_registry.render(data,'compare_raincloud',figsize=wh);buf=io.StringIO();fig.savefig(buf,format='svg');plt.close(fig);svg=E.fromstring(buf.getvalue());box=list(map(float,svg.attrib['viewBox'].split()))
  pair.append(dict(name='compare_raincloud',size=size,width=wh[0]*72,height=wh[1]*72,viewBox=box,svg=json.dumps(tree(svg)),value=value))
 out.append(pair)
print(json.dumps(out))
`;
const generated=cp.spawnSync(python,['-c',program,root],{encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(generated.status,0,generated.stderr);const pairs=JSON.parse(generated.stdout);
const title=svg=>svg.querySelectorAll('text').find(n=>n.textContent==='Value'&&helpers.stableTextEditSignature(n));
const propKey=n=>n.getAttribute('data-key');
const textProps={text:'Response H2O', 'rich-text':JSON.stringify(rich.format(rich.format(null,'Response H2O',0,8,'italic',true),'Response H2O',10,11,'script','sub')),'font-size':'24','font-family':'Arial','font-weight':'700',fill:'#934c70','offset-x':'2.5','offset-y':'-1.5'};
for(const [before,after]of pairs){
  const a=keys(inflate(JSON.parse(before.svg))),b=keys(inflate(JSON.parse(after.svg))),old=title(a),fresh=title(b);assert.ok(old&&fresh);
  const numeric=a.querySelectorAll('text').find(n=>/^\d+(?:\.\d+)?$/.test(n.textContent));assert.ok(numeric);
  const edits={[propKey(old)]:textProps,[propKey(numeric)]:{text:'999'},e900000:{text:'P = 0.001'}};
  const moved=helpers.migrateStableTextEdits(a,b,edits,before,after);eq(moved[propKey(fresh)],textProps);eq(Object.keys(moved).length,1,'numeric ticks/generated results never migrate');eq(after.value,9.5);eq(JSON.stringify(edits[propKey(old)]),JSON.stringify(textProps));
  const scaled=helpers.migrateStableTextEdits(a,b,edits,before,{...after,viewBox:[0,0,after.viewBox[2]*2,after.viewBox[3]*2]});eq(scaled[propKey(fresh)]['font-size'],'48');eq(scaled[propKey(fresh)]['offset-x'],'2.5','physical offsets are not rescaled');
}
// Stable identities use axes and legend ownership, never globally matching a
// string. Ordinal artist IDs and numeric tick count are deliberately changed.
function synthetic(changed=false){return keys(make('svg','', '',[
 make('g','axes_1','',[make('g','matplotlib.axis_1','',[make('g','xtick_1','',[make('g','text_5','',[make('text','',changed?'Rescue':'Control')])]),make('g','text_6','',[make('text','','Value')])]),make('g','matplotlib.axis_2','',[make('g','ytick_1','',[make('text','','1')]),make('g','text_7','',[make('text','','Value')])]),make('g','text_8','',[make('text','','P = 0.032')]),make('g','PathCollection_1','',[make('use','')])]),
 make('g','legend_1','',[make('g','text_9','',[make('text','','Group A')]),make('g','text_10','',[make('text','','AUC = 0.89')])])
 ]));}
const sa=synthetic(),sb=synthetic(true),all=sa.querySelectorAll('[data-key]'),se=Object.fromEntries(all.map(n=>[propKey(n),{text:'Manual '+n.textContent}])),sm=helpers.migrateStableTextEdits(sa,sb,se,pairs[0][0],pairs[0][1]);
const labels=sb.querySelectorAll('text');eq(Object.keys(sm).length,3);for(const n of labels.filter(n=>['Value','Group A'].includes(n.textContent)))assert.ok(sm[propKey(n)]);for(const n of labels.filter(n=>!['Value','Group A'].includes(n.textContent)))eq(sm[propKey(n)],undefined);
const values=sa.querySelectorAll('text').filter(n=>n.textContent==='Value');assert.notEqual(helpers.stableTextEditSignature(values[0]),helpers.stableTextEditSignature(values[1]));
const revised=synthetic();revised.querySelectorAll('text').find(n=>n.textContent==='Value').ownText='Different measure';eq(Object.keys(helpers.migrateStableTextEdits(sa,revised,se,pairs[0][0],pairs[0][1])).length,3,'changed source title does not inherit old wording');
const offset=keys(make('svg','','',[make('g','axes_1','',[make('g','matplotlib.axis_2','',[make('text','','1e6')])])])).querySelector('text');eq(helpers.stableTextEditSignature(offset),null,'numeric axis offset/scientific multiplier is regenerated too');
const compound=keys(make('svg','','',[make('g','axes_1','',[make('g','matplotlib.axis_2','',[make('text','','H',[make('tspan','','2'),make('tspan','','O')])])])])),copyCompound=keys(inflate({tag:'svg',children:[{tag:'g',attrs:{id:'axes_1'},children:[{tag:'g',attrs:{id:'matplotlib.axis_2'},children:[{tag:'text',text:'H',children:[{tag:'tspan',text:'2'},{tag:'tspan',text:'O'}]}]}]}]}));
const sub=compound.querySelectorAll('tspan')[0],subTarget=copyCompound.querySelectorAll('tspan')[0],subProps={'rich-text':JSON.stringify(rich.format(null,'2',0,1,'script','sub')),fill:'#225588'};
eq(helpers.migrateStableTextEdits(compound,copyCompound,{[propKey(sub)]:subProps},pairs[0][0],pairs[0][1])[propKey(subTarget)],subProps,'native tspan character formatting survives');
// Real installAsset installs matching size variants, preserves appearance,
// creates one undo state, and never mutates source assets or old history.
const oldVariants=pairs.map(pair=>pair[0]),newVariants=pairs.map(pair=>pair[1]);
const initial={order:['panel-0'],columns:1,gap:12,panels:{'panel-0':{variant:0,edits:{},geometry:{barWidth:1.2,groupGap:.8},groupSpacing:{factor:.8}}}};
oldVariants.forEach((v,i)=>{const svg=keys(inflate(JSON.parse(v.svg))),label=title(svg),category=svg.querySelectorAll('text').find(n=>n.textContent==='Control');initial.panels['panel-0'].edits[i]={[propKey(label)]:copy(textProps),[propKey(category)]:{text:'Vehicle',fill:'#225588'}};});
const history=new helpers.History(initial),oldAsset={id:'panel-0',name:'Fixture',variants:oldVariants,table:{rows:[['group','value'],['Control','9.4']]},analysis:{}};
const ctx={...helpers,copy,History:helpers.History,T:x=>x,StudioI18n:{preserveDisplayNames(){}},project:{id:'test',panels:[oldAsset]},state:()=>history.current,panel:id=>ctx.project.panels.find(p=>p.id===id),captureProfile:()=>[{colors:[],roles:{}}],sanitize:value=>keys(inflate(JSON.parse(value))),baseSvg:(id,vi)=>keys(inflate(JSON.parse(ctx.panel(id).variants[vi].svg))),keysToObjects:svg=>svg.querySelectorAll('[data-key]'),hex:()=>null,paint:()=>null,chromatic:()=>false,validateProject(){},validValue:()=>true,templateCache:new Map(),commit:next=>history.commit(next),matchSizes:s=>s,setEdit(next,id,vi,key,prop,value){next.panels[id].edits[vi]??={};next.panels[id].edits[vi][key]??={};next.panels[id].edits[vi][key][prop]=value;}};
const start=source.indexOf('  function installAsset('),end=source.indexOf("  $('importImage').onclick",start);assert.ok(start>0&&end>start);vm.createContext(ctx);vm.runInContext(source.slice(start,end),ctx);
const original=JSON.stringify(oldAsset),replacement={name:'Fixture',initialVariant:0,variants:newVariants,table:{rows:[['group','value'],['Control','9.5']]},analysis:{}};
ctx.installAsset(replacement,'panel-0',null,'updated',true);eq(history.states.length,2);const newId=history.current.order[0];
newVariants.forEach((v,i)=>{const svg=keys(inflate(JSON.parse(v.svg))),category=svg.querySelectorAll('text').find(n=>n.textContent==='Control');eq(history.current.panels[newId].edits[i][propKey(title(svg))],textProps);eq(history.current.panels[newId].edits[i][propKey(category)].text,'Vehicle');});
eq(history.current.panels[newId].geometry,initial.panels['panel-0'].geometry);eq(history.current.panels[newId].groupSpacing,initial.panels['panel-0'].groupSpacing);eq(ctx.panel(newId).table.rows[1][1],'9.5');eq(JSON.stringify(oldAsset),original);eq(history.undo(),initial);history.redo();eq(history.current.panels[newId].edits[0][propKey(title(keys(inflate(JSON.parse(newVariants[0].svg)))))]['rich-text'],textProps['rich-text']);
for(const altered of [{name:'compare_box_points'},{size:'unmatched-size'}]){history.undo();ctx.installAsset({...replacement,variants:[{...newVariants[0],...altered}]},'panel-0',null,'different',true);eq(history.current.panels[history.current.order[0]].edits,{},'unmatched view/size cannot inherit an old text edit');}
console.log(`PASS data text preservation: ${checks} guards; 6 actual raincloud SVGs, three sizes, 9.4→9.5 update, semantic title/category/legend identity, rich text, source units, numeric/statistical exclusion, production installAsset and undo/redo.`);
