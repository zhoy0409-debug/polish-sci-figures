/* Independent character-format regression: real helpers/handlers, bounded SVG DOM.
 * This is not a browser rendering or native text-selection test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const rich=require('../skills/polish-sci-figures/assets/figure-studio/rich-text.js');
const main='../skills/polish-sci-figures/assets/figure-studio/studio.js';
const {History,arrange,validateState}=require(main),source=fs.readFileSync(require.resolve(main),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x)),encoded=x=>JSON.stringify(x);
const record=(text,runs=[])=>({baseText:text,runs});
const styles=r=>{const result=Array.from({length:r.baseText.length},()=>({}));for(const run of r.runs)for(let i=run.start;i<run.end;i++)result[i]={...run.style};return result;};

// UTF-16 browser selections keep Chinese text and surrogate pairs intact.
const text='组α🧪 P = 0.032';
let value=rich.format(null,text,3,5,'bold',true); // starts at the low surrogate
assert.deepEqual(value.runs,[{start:2,end:5,style:{bold:true}}]);
value=rich.format(null,text,3,4,'italic',true); // only the emoji low surrogate
assert.deepEqual(value.runs,[{start:2,end:4,style:{italic:true}}]);
value=rich.format(value,text,6,7,'script','super');
assert.equal(value.baseText,text);assert.equal(styles(value)[6].script,'super');
const p='P = 0.032';let pRecord=rich.format(null,p,0,1,'italic',true);
assert.equal(styles(pRecord)[0].italic,true);assert.deepEqual(styles(pRecord).slice(1),Array.from({length:p.length-1},()=>({})));
pRecord=rich.format(pRecord,p,4,p.length,'bold',true);assert.equal(styles(pRecord)[4].bold,true);
pRecord=rich.format(pRecord,p,5,7,'clear');assert.deepEqual(styles(pRecord)[5],{bold:false,italic:false,script:'normal'});assert.equal(styles(pRecord)[4].bold,true);assert.equal(styles(pRecord)[7].bold,true);
assert.equal(rich.format(pRecord,p,0,1,'italic').runs[0].style.italic,false,'toggle emits explicit normal style');
const old=record('P = 0.032 units',[{start:0,end:1,style:{italic:true}},{start:4,end:9,style:{bold:true}},{start:10,end:15,style:{italic:true}}]);
const mapped=rich.remap(old,'P = 0.1250 units');
assert.deepEqual(mapped.runs,[{start:0,end:1,style:{italic:true}},{start:11,end:16,style:{italic:true}}]);
assert.deepEqual(old.runs[1],{start:4,end:9,style:{bold:true}},'remap is immutable');
assert.deepEqual(rich.remap(record('Old',[{start:0,end:3,style:{bold:true}}]),'New title').runs,[{start:0,end:9,style:{bold:true}}]);
for(const invalid of [null,{},record('a',[{start:0,end:2,style:{bold:true}}]),record('abc',[{start:1,end:3,style:{italic:true}},{start:2,end:3,style:{bold:true}}]),record('abc',[{start:0,end:1,style:{color:'red'}}]),record('abc',[{start:0,end:1,style:{bold:'true'}}]),record('abc',[{start:0,end:1,style:{script:'top'}}]),{baseText:'a',runs:[],html:'<script>'}])assert.equal(rich.valid(encoded(invalid)),false);
assert.equal(rich.valid(encoded(pRecord)),true);assert.equal(rich.valid('<i>P</i>'),false);
assert.throws(()=>rich.format(null,p,2,2,'bold'));assert.throws(()=>rich.format(null,p,0,1,'color'));

// SVG DOM adapter leaves native structure and glyph positions visible to helpers.
class Node{
  constructor(doc,tag='',text=''){this.ownerDocument=doc;this.localName=tag;this.nodeType=tag==='#text'?3:tag==='#fragment'?11:1;this.nodeValue=text;this.childNodes=[];this.parentNode=null;this.attributes={};this.dataset={};this.style={setProperty(k,v){this[k]=String(v);}};this.value='';this.handlers={};this.classList={add(){}};this.selectionStart=this.selectionEnd=0;}
  get parentElement(){return this.parentNode?.nodeType===1?this.parentNode:null;}
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get textContent(){return this.nodeType===3?this.nodeValue:this.childNodes.map(n=>n.textContent).join('');}
  set textContent(s){if(this.nodeType===3)this.nodeValue=String(s);else this.replaceChildren(this.ownerDocument.createTextNode(String(s)));}
  appendChild(n){if(n.nodeType===11){for(const c of [...n.childNodes])this.appendChild(c);n.childNodes=[];return n;}n.parentNode=this;this.childNodes.push(n);return n;}
  append(...nodes){for(const n of nodes)this.appendChild(typeof n==='string'?this.ownerDocument.createTextNode(n):n);}
  replaceChildren(...nodes){for(const n of this.childNodes)n.parentNode=null;this.childNodes=[];this.append(...nodes);}
  replaceChild(next,old){const i=this.childNodes.indexOf(old);assert.ok(i>=0);const replacement=next.nodeType===11?[...next.childNodes]:[next];for(const n of replacement)n.parentNode=this;this.childNodes.splice(i,1,...replacement);old.parentNode=null;if(next.nodeType===11)next.childNodes=[];}
  setAttribute(k,v){this.attributes[k]=String(v);if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  hasAttribute(k){return Object.hasOwn(this.attributes,k);}
  matches(query){return query.split(',').some(q=>{const m=q.trim().match(/^(\w+)?(?:\[([^=\]]+)(?:="([^"]*)")?\])?$/);return !!m&&(!m[1]||m[1]===this.localName)&&(!m[2]||this.hasAttribute(m[2])&&(m[3]===undefined||this.getAttribute(m[2])===m[3]));});}
  querySelectorAll(query){return this.children.flatMap(c=>[...(c.matches(query)?[c]:[]),...c.querySelectorAll(query)]);}
  querySelector(query){return this.querySelectorAll(query)[0]||null;}
  closest(query){return this.matches(query)?this:this.parentElement?.closest(query)||null;}
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);}
  focus(){this.ownerDocument.activeElement=this;}
  setSelectionRange(start,end){this.selectionStart=start;this.selectionEnd=end;}
  select(){this.setSelectionRange(0,this.value.length);}
  click(){if(!this.disabled)this.onclick?.();}
  scrollIntoView(){}
}
const doc={createElementNS:(_,tag)=>new Node(doc,tag),createElement:tag=>new Node(doc,tag),createTextNode:s=>new Node(doc,'#text',s),createDocumentFragment:()=>new Node(doc,'#fragment')};
const elem=(tag,text,attrs={})=>{const n=doc.createElementNS('',tag);if(text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
function characterStyles(root){const out=[];function walk(n,inherited={}){const st={...inherited};if(n.nodeType===1){for(const[k,v]of Object.entries(n.style))if(typeof v!=='function')st[k]=v;for(const [key,prop]of [['font-style','fontStyle'],['font-weight','fontWeight'],['baseline-shift','baselineShift'],['font-size','fontSize']])if(n.hasAttribute(key)&&!Object.hasOwn(st,prop))st[prop]=n.getAttribute(key);}if(n.nodeType===3)for(let i=0;i<n.nodeValue.length;i++)out.push({...st});else n.childNodes.forEach(c=>walk(c,st));}walk(root);return out;}
let svgText=elem('text',p,{'font-size':10});rich.apply(svgText,rich.format(null,p,0,1,'italic',true));
assert.equal(svgText.textContent,p);assert.equal(characterStyles(svgText)[0].fontStyle,'italic');assert.equal(characterStyles(svgText)[4].fontStyle,undefined);assert.equal(svgText.querySelectorAll('[data-rich-run]').length,1);
const chem='H2O x2';svgText=elem('text',chem);value=rich.format(null,chem,1,2,'script','sub');value=rich.format(value,chem,5,6,'script','super');rich.apply(svgText,value);
assert.equal(svgText.textContent,chem);assert.equal(characterStyles(svgText)[1].baselineShift,'sub');assert.equal(characterStyles(svgText)[5].baselineShift,'super');assert.equal(characterStyles(svgText)[1].fontSize,'70%');
svgText=elem('text');svgText.append(elem('tspan','P',{'font-style':'italic','font-size':10,x:12,y:20}),elem('tspan',' = 0.032',{'font-size':10}));
assert.equal(rich.nativeStyles(svgText).runs[0].style.italic,true);rich.replaceText(svgText,'P = 0.125');
assert.equal(svgText.getAttribute('x'),'12');assert.equal(svgText.getAttribute('y'),'20');assert.equal(svgText.textContent,'P = 0.125');assert.equal(characterStyles(svgText)[0].fontStyle,'italic');assert.equal(characterStyles(svgText)[5].fontStyle,undefined);
rich.replaceText(svgText,'P = 0.125\nsecond line');assert.equal(svgText.textContent,'P = 0.125\nsecond line');assert.ok(svgText.children.some(n=>n.getAttribute('dy')==='1.25em'));
const unsafe='<script>alert(1)</script>';svgText=elem('text','Original');rich.replaceText(svgText,unsafe);assert.equal(svgText.textContent,unsafe);assert.equal(svgText.querySelectorAll('script').length,0);
svgText=elem('text');svgText.append(elem('tspan','P',{'font-style':'italic','font-size':10}),elem('tspan',' = 0.032',{'font-size':10}));
rich.apply(svgText,rich.format(rich.nativeStyles(svgText),p,0,1,'clear'));assert.equal(characterStyles(svgText)[0].fontStyle,'normal','clear overrides original source italic');
svgText=elem('text');svgText.append(elem('tspan','10',{'font-size':10,x:12,y:20}),elem('tspan','3',{'font-size':7,x:24,y:16}));
assert.equal(styles(rich.nativeStyles(svgText))[2].script,'super');rich.apply(svgText,rich.format(rich.nativeStyles(svgText),'103',2,3,'clear'));
assert.equal(svgText.textContent,'103');assert.equal(svgText.getAttribute('y'),'20');assert.equal(characterStyles(svgText)[2].baselineShift,'baseline');assert.equal(characterStyles(svgText)[2].fontSize,'100%');assert.ok(svgText.querySelectorAll('tspan').every(n=>n.getAttribute('y')!=='16'&&n.getAttribute('font-size')!=='7'),'clear removes original absolute exponent offset/size');
assert.equal(rich.pointSize(svgText),10);svgText.style.fontSize='24px';assert.equal(rich.pointSize(svgText),24);const sub=elem('tspan','2');sub.style.fontSize='70%';svgText.append(sub);assert.equal(rich.pointSize(svgText),24,'relative 70% is not misread as 70 pt');

// Real character toolbar: focus and selected range survive its own synchronous
// state refresh; formatting buttons never depend on browser text remaining selected.
const savedDocument=globalThis.document;globalThis.document=doc;
try{
  const host=elem('section'),calls=[];let activeText=p,activeRecord=record(p),controller;
  const sync=()=>controller.sync({identity:'element/p0/e1',text:activeText,statistical:true});
  controller=rich.mount(host,{t:x=>x,format(action,start,end){calls.push({action,start,end});activeRecord=rich.format(activeRecord,activeText,start,end,['sub','super','normal'].includes(action)?'script':action,['sub','super','normal'].includes(action)?action:undefined);sync();},text(next){calls.push({text:next});activeRecord=rich.remap(activeRecord,next);activeText=next;sync();}});
  sync();const field=host.children.find(n=>n.localName==='textarea'),toolbar=host.children.find(n=>n.localName==='div'),italic=toolbar.children.find(n=>n.dataset.action==='italic');
  field.focus();field.setSelectionRange(0,1);let prevented=false;italic.onpointerdown({preventDefault(){prevented=true;}});italic.click();
  assert.ok(prevented);assert.deepEqual(calls[0],{action:'italic',start:0,end:1});assert.equal(doc.activeElement,field);assert.deepEqual(controller.selection(),[0,1]);assert.equal(styles(activeRecord)[0].italic,true);assert.equal(styles(activeRecord)[5].italic,undefined);
  field.setSelectionRange(4,9);field.onkeydown({key:'b',ctrlKey:true,preventDefault(){},stopPropagation(){}});assert.deepEqual(calls.at(-1),{action:'bold',start:4,end:9});assert.equal(styles(activeRecord)[4].bold,true);assert.equal(field.selectionStart,4);assert.equal(field.selectionEnd,9);
  const beforeIME=calls.length;field.oncompositionstart();field.value='中文 P';field.oninput();assert.equal(calls.length,beforeIME);field.onkeydown({key:'Enter',isComposing:true,stopPropagation(){},preventDefault(){throw Error('IME confirmation must stay native');}});assert.equal(calls.length,beforeIME,'IME confirmation does not commit unfinished text');field.oncompositionend();assert.equal(calls.length,beforeIME+1);assert.equal(calls.at(-1).text,'中文 P');
  let stopped=false;field.onkeydown({key:'Enter',shiftKey:true,stopPropagation(){stopped=true;},preventDefault(){throw Error('Shift + Enter must retain newline');}});assert.ok(stopped);assert.equal(calls.length,beforeIME+1);
  controller.sync({identity:'other',text:'Locked',locked:true});assert.equal(field.disabled,true);assert.ok(toolbar.children.every(n=>n.disabled));controller.sync(null);assert.equal(host.hidden,true);
}finally{if(savedDocument===undefined)delete globalThis.document;else globalThis.document=savedDocument;}

// Execute actual state handlers. Display edits cannot mutate analysis/table values.
const project={id:'test-project',panels:[{id:'p0',variants:[{},{}],analysis:{primary_test:{p_value:.032}},sourceData:{rows:[['group','value'],['Control','1'],['Treatment','2']]}}]};
const initial=arrange({order:['p0'],columns:1,gap:12,panels:{p0:{variant:0,edits:{},label:{text:'A',x:2,y:5,size:12,font:'Arial',bold:true}}},overlays:[{id:'annotation-1',type:'text',text:'H2O',x:.1,y:.1,w:.2,h:.1,font:'Arial',size:10,color:'#123456',opacity:1,stroke:1,locked:false,fill:false}]},1,1);
let history=new History(initial),commits=0;const messages=[];
const ctx={StudioRichText:rich,project,copy,state:()=>history.current,panel:id=>project.panels.find(p=>p.id===id),T:s=>s,say:s=>messages.push(s),
  setEdit(s,id,vi,key,prop,val){((s.panels[id].edits[vi]??={})[key]??={})[prop]=val;},commit(s){validateState(s,project);if(history.commit(s))commits++;return true;}};
vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('  function validRichTextTarget('),source.indexOf('  function renderRichTextControls(')),ctx);
const target={kind:'element',id:'p0',vi:0,key:'e900001',text:p,record:null,el:elem('text',p),locked:false,statistical:true,projectId:project.id,asset:project.panels[0]};
const scientificBefore=encoded(project);assert.equal(ctx.formatSelectedRichText('italic',0,1,target),true);
assert.equal(rich.parse(history.current.panels.p0.edits[0].e900001['rich-text']).runs[0].end,1);assert.equal(history.current.panels.p0.edits[0].e900001.text,undefined);
assert.equal(ctx.changeRichText('P = 0.040',target),true);assert.equal(history.current.panels.p0.edits[0].e900001.text,'P = 0.040');assert.equal(encoded(project),scientificBefore);
const count=commits;for(const changed of [{locked:true},{projectId:'old'},{asset:{}},{vi:1}])assert.equal(ctx.formatSelectedRichText('bold',0,1,{...target,...changed}),false);assert.equal(commits,count);
assert.equal(ctx.changeRichText('x'.repeat(501),target),false);assert.equal(commits,count);
const overlay={kind:'overlay',id:'annotation-1',text:'H2O',el:elem('text','H2O'),locked:false,projectId:project.id};assert.equal(ctx.formatSelectedRichText('sub',1,2,overlay),true);assert.equal(rich.parse(history.current.overlays[0].richText).runs[0].style.script,'sub');
const label={kind:'label',id:'p0',text:'A',el:elem('text','A'),locked:false,projectId:project.id};assert.equal(ctx.changeRichText('A1',label),true);assert.equal(history.current.panels.p0.label.manual,true);assert.equal(history.current.panels.p0.label.text,'A1');
history.undo();assert.equal(history.current.panels.p0.label.text,'A');history.redo();assert.equal(history.current.panels.p0.label.text,'A1');
validateState(History.restore(copy(history.toJSON()),project,history.current).current,project);
const invalidState=copy(history.current);invalidState.panels.p0.edits[0].e900001['rich-text']='<i>P</i>';assert.throws(()=>validateState(invalidState,project));

// Whole-element font changes scale only persistent source runs. Newly inserted
// rich spans inherit the parent font, with their 70% ratio; never save a null key.
const fontText=elem('text',undefined,{'data-key':'e1','font-size':12}),fontChild=elem('tspan','Native',{'data-key':'e2','font-size':12}),richChild=elem('tspan','2');richChild.style.fontSize='70%';fontText.append(fontChild,richChild);
const fontState={order:['p0'],panels:{p0:{variant:0,edits:{}}}},fontContext={copy,original:false,selected:['e1'],selectedPanel:'p0',state:()=>fontState,$:id=>({value:id==='scope'?'element':'all'}),selectionGroups:()=>[{id:'p0',vi:0,keys:['e1']}],panel:()=>({variants:[{viewBox:[0,0,100,100],width:100}]}),editableSource:()=>fontText,targetObjects:()=>[fontText],currentOutput:()=>({scale:1}),validValue:()=>true,textPointFactor:()=>1,textPointSize:rich.pointSize,T:x=>x,say(){},setEdit:ctx.setEdit,commit:s=>{fontContext.saved=s;}};
vm.runInNewContext(source.slice(source.indexOf('  function updateStyle('),source.indexOf('  function paletteHeatmapInfo(')),fontContext);fontContext.updateStyle('font-size','24','text');
assert.deepEqual(Object.keys(fontContext.saved.panels.p0.edits[0]).sort(),['e1','e2']);assert.equal(fontContext.saved.panels.p0.edits[0].e2['font-size'],'24');assert.equal(richChild.style.fontSize,'70%');

// Actual generated-element edit hook marks manual display, then applies character styles.
const generatedSvg=elem('svg'),generated=elem('text',p,{'data-stat-result':'true'});generatedSvg.append(generated);
const generatedProps={text:'P = 0.040','rich-text':encoded(rich.format(null,'P = 0.040',0,1,'italic',true))};
const generatedBlock=source.slice(source.indexOf('  function editedSvg('),source.indexOf('  function clearStatisticalResultEdits(')).split('\n').filter(line=>line.includes('let generated=900000')||line.includes("typeof StudioRichText!=='undefined'")&&line.includes("props['rich-text']")).join('\n');
assert.ok(generatedBlock.length>0&&generatedBlock.length<5000);
const generatedContext={svg:generatedSvg,id:'p0',vi:0,s:history.current,raw:false,StudioRichText:rich,editsFor:()=>({e900000:generatedProps})};
// Only complete generation/application lines; subsequent translation has separate tests.
vm.runInNewContext(generatedBlock.split('\n').filter(line=>line.includes('let generated=900000')||line.includes("typeof StudioRichText!=='undefined'" )&&line.includes("props['rich-text']")).join('\n'),generatedContext);
assert.equal(generated.textContent,'P = 0.040');assert.equal(generated.getAttribute('data-stat-original'),p);assert.equal(generated.getAttribute('data-stat-manual'),'true');assert.equal(characterStyles(generated)[0].fontStyle,'italic');assert.equal(characterStyles(generated)[5].fontStyle,undefined);
assert.equal(encoded(project),scientificBefore);
console.log('PASS character formatting: UTF-16 ranges, P-only italic, sub/superscript, immutable remapping, schema rejection, SVG text safety/native origins, actual edit guards, undo/reopen and manual-statistical display provenance. Node/DOM scope.');
