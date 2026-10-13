'use strict';
const assert=require('node:assert/strict');
const check=require('../skills/polish-sci-figures/assets/figure-studio/duplicate-check.js');
const png='data:image/png;base64,aGVsbG8=';
function element(tag,attributes={},children=[]){
  const el={localName:tag,id:attributes.id,style:{},parentElement:null,children,
    getAttribute(name){return attributes[name]??null;},getAttributeNS(_namespace,name){return attributes['xlink:'+name]??null;},hasAttribute(name){return Object.hasOwn(attributes,name);},
    querySelectorAll(selector){const matches=node=>selector==='svg[data-panel]'?node.localName==='svg'&&node.hasAttribute('data-panel'):selector==='[id]'?node.hasAttribute('id'):selector.split(',').includes(node.localName);const found=[];for(const child of children){if(matches(child))found.push(child);found.push(...child.querySelectorAll(selector));}return found;}};
  for(const child of children)child.parentElement=el;return el;
}
const visible=element('image',{'data-key':'e1',href:png});
const external=element('image',{'data-key':'e2',href:'https://example.invalid/private.png'});
const hidden=element('g',{opacity:'0'},[element('image',{'data-key':'e3',href:png})]);
const definition=element('image',{id:'source','data-key':'e4','xlink:href':png});
const unused=element('image',{id:'unused',href:png});
const defs=element('defs',{},[definition,unused]);
const use=element('use',{'data-key':'e5',href:'#source'});
const vector=element('path',{'data-key':'e6',d:'M 0 0 L 1 1'});
const p1=element('svg',{'data-panel':'p1'},[visible,external,hidden,defs,use,vector]);
const p2=element('svg',{'data-panel':'p2'},[element('image',{'data-key':'e0',href:png})]);
const root=element('svg',{},[p1,p2]);
let result=check.collect(root,{label:id=>'Panel '+id,variant:()=>2});
assert.equal(result.images.length,3,'visible images and referenced definition only');
assert.deepEqual(Object.values(result.refs).map(r=>[r.panelId,r.key]),[['p1','e1'],['p1','e5'],['p2','e0']]);
assert.equal(result.refs['canvas-0'].vi,2);
assert.ok(result.images.every(image=>image.data===png),'does not rasterize vectors or load external links');
result=check.collect(root,{scope:'selected',groups:[{id:'p1',keys:['e5']}]});
assert.equal(result.images.length,1);assert.equal(result.refs['canvas-0'].key,'e5');
result=check.collect(root,{scope:'selected',panels:['p2']});assert.equal(result.images.length,1);assert.equal(result.refs['canvas-0'].panelId,'p2');
assert.equal(check.collect(root,{scope:'selected'}).images.length,0);
assert.equal(check.raster('data:image/svg+xml;base64,aGVsbG8='),false);
assert.equal(check.raster('javascript:alert(1)'),false);
assert.equal(check.raster(png),true);
const report=check.reportHTML({createdAt:'2026-10-13',result:{images:[{id:'a',label:'<script>alert(1)</script>',thumbnail:png},{id:'b',label:'B',thumbnail:png}],matches:[{a:'a',b:'b',kind:'exact',evidence:'https://example.invalid/leak'}],warnings:['<img src=x onerror=alert(1)>']}});
assert.ok(report.includes('&lt;script&gt;'));assert.ok(report.includes('&lt;img src=x'));
assert.ok(!report.includes('src="https://'),'reports reject external evidence URLs');
assert.ok(report.includes("default-src 'none'"));assert.equal((report.match(/<img /g)||[]).length,2,'thumbnail fallback for missing evidence');
// Exercise the UI controller with a small DOM adapter: no browser or network.
function controller(fetcher){
  const elements=new Map(),timers=new Map(),calls=[];let nextTimer=1,current=1,located=0;
  class Control{
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.value='';this.textContent='';}
    set innerHTML(html){for(const match of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=new Control(match[1]);el.id=match[3];el.hidden=/\bhidden\b/.test(match[2]);if(el.id==='duplicateScope')el.value='all';const text=match[2].match(/data-duplicate-text="([^"]+)"/);if(text)el.dataset.duplicateText=text[1];elements.set(el.id,el);this.children.push(el);}}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
    setAttribute(name,value){this[name]=value;}addEventListener(){}scrollIntoView(){}showModal(){this.open=true;}close(){this.open=false;}
    querySelectorAll(selector){const descendants=this.children.filter(c=>typeof c==='object');return descendants.filter(c=>selector==='[data-duplicate-text]'&&c.dataset.duplicateText);}
  }
  for(const id of ['checkImageDuplicates','language'])elements.set(id,new Control('button'));
  global.document={getElementById:id=>elements.get(id),createElement:tag=>new Control(tag),body:{append(el){elements.set(el.id,el);}}};
  global.location={protocol:'http:',hostname:'127.0.0.1'};
  global.matchMedia=()=>({matches:true});
  global.StudioI18n={en:{},language:'en',t(text,...values){return (global.StudioI18n.language==='en'?(global.StudioI18n.en[text]||text):text).replace(/\{(\d+)\}/g,(_,n)=>String(values[Number(n)]??''));}};
  global.setTimeout=fn=>{const id=nextTimer++;timers.set(id,fn);return id;};global.clearTimeout=id=>timers.delete(id);
  const api={engine:{duplicateEndpoint:'/api/image-duplicates',token:'local'},fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return fetcher(body);},collect:()=>({images:[{id:'a',label:'A',data:png},{id:'b',label:'B',data:png}],refs:{a:{panelId:'a',key:'e1'},b:{panelId:'b',key:'e2'}},skipped:[]}),snapshot:()=>current,isSnapshot:s=>s===current,locate:()=>{located++;return true;},say(){},download(){}};
  const ui=check.init(api);
  return {elements,calls,ui,get located(){return located;},mutate(){current++;},async tick(){const queued=[...timers.entries()];timers.clear();for(const [,fn]of queued)fn();await settle();}};
}
const response=data=>({ok:true,json:async()=>data});
const settle=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
const completed={status:'complete',result:{images:[{id:'a',label:'A',thumbnail:png},{id:'b',label:'B',thumbnail:png}],matches:[{a:'a',b:'b',kind:'exact',evidence:png}],warnings:[]}};
async function lifecycle(){
  const originals={document:global.document,location:global.location,matchMedia:global.matchMedia,StudioI18n:global.StudioI18n,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
  try{
    let giveStart;
    let h=controller(body=>body.action==='start'?new Promise(resolve=>{giveStart=resolve;}):response(body.action==='cancel'?{status:'running'}:{status:'cancelled'}));
    h.ui.open();const starting=h.elements.get('duplicateStart').onclick();h.elements.get('duplicateCancel').onclick();h.elements.get('closeImageDuplicates').onclick();
    giveStart(response({jobId:'job'}));await starting;await settle();
    assert.ok(h.calls.some(call=>call.action==='cancel'),'cancel before start response is not dropped');
    assert.equal(h.elements.get('duplicateCancel').hidden,true);h.ui.open();assert.equal(h.elements.get('duplicateStart').disabled,false,'cancelled check can restart after reopening');
    let status=0;
    h=controller(body=>{if(body.action==='start')return response({jobId:'job'});if(body.action==='cancel')return response({status:'running'});if(status++===0)throw Error('Network down');return response({status:'cancelled'});});
    await h.elements.get('duplicateStart').onclick();await settle();assert.equal(h.elements.get('duplicateStart').disabled,true,'network failure retains active job');
    assert.equal(h.elements.get('duplicateCancel').hidden,false);h.elements.get('duplicateCancel').onclick();await h.tick();assert.ok(h.calls.some(call=>call.action==='cancel'),'cancel survives lost polling connection');
    h=controller(body=>response(body.action==='start'?{jobId:'job'}:completed));await h.elements.get('duplicateStart').onclick();await settle();assert.equal(h.elements.get('duplicateResults').hidden,false);
    const locate=h.elements.get('duplicateMatches').children[0].children.find(el=>el.className==='duplicate-match-actions').children[0];h.mutate();locate.onclick();assert.equal(h.located,0,'stale results cannot select changed canvas objects');assert.equal(h.elements.get('duplicateSnapshotNote').hidden,false);
    let nextStart;
    h=controller(body=>body.action==='start'?nextStart?new Promise(()=>{}):response({jobId:'job'}):response(completed));await h.elements.get('duplicateStart').onclick();await settle();nextStart=true;h.elements.get('duplicateStart').onclick();h.elements.get('closeImageDuplicates').onclick();h.ui.open();assert.equal(h.elements.get('duplicateResults').hidden,true,'new scan must not reshow prior results on reopen');
    h=controller(()=>({ok:false,json:async()=>({error:'Malformed images / 图片格式无效'})}));global.StudioI18n.language='zh-CN';await h.elements.get('duplicateStart').onclick();await settle();assert.equal(h.elements.get('duplicateStart').disabled,false);assert.ok(h.elements.get('duplicateProgressText').textContent.includes('图片格式无效'),'bilingual failures work in either server language order');
    h=controller(body=>response(body.action==='start'?{jobId:'job'}:{unexpected:true}));await h.elements.get('duplicateStart').onclick();await settle();assert.equal(h.elements.get('duplicateStart').disabled,false,'malformed status does not poll forever');
    console.log('Image duplicate UI extraction, safe reports and lifecycle tests passed');
  }finally{Object.assign(global,originals);}
}
lifecycle().catch(error=>{console.error(error);process.exitCode=1;});
