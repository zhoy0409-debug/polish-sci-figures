'use strict';
const assert=require('node:assert/strict');
const check=require('../skills/polish-sci-figures/assets/figure-studio/duplicate-check.js');
const reviewStore=require('../skills/polish-sci-figures/assets/figure-studio/duplicate-review.js');
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
assert.ok(report.includes("default-src 'none'"));assert.equal((report.match(/<img /g)||[]).length,2,'inventory thumbnail fallback for missing evidence');assert.ok(report.includes('href="#image-1"'));
const batchImages=Array.from({length:60},(_,i)=>({id:String(i),label:'Image '+i,thumbnail:png})),batchMatches=batchImages.flatMap((a,i)=>batchImages.slice(i+1).map(b=>({a:a.id,b:b.id,kind:'overlap'})));
const boundedReport=check.reportHTML({createdAt:'today',result:{images:batchImages,matches:batchMatches,warnings:['review_preview_limit']}});
assert.equal(batchMatches.length,1770);assert.equal((boundedReport.match(/<img /g)||[]).length,60,'large reports embed each thumbnail once, not twice per pair');assert.ok(!boundedReport.includes('review_preview_limit'),'preview-limit warning is translated');assert.ok(boundedReport.length<1500000);
assert.equal(check.pairKey({a:'b',b:'a'}),check.pairKey({a:'a',b:'b'}),'review keys survive reversed pair order');
const unsafeReview={createdAt:'2026-10-13',reviews:{[check.pairKey({a:'a',b:'b'})]:{status:'legitimate',note:'<script>alert(1)</script>\n"review"'}},result:{images:[{id:'a',label:'A'},{id:'b',label:'B'}],matches:[{a:'a',b:'b',kind:'exact'}]}};
const reviewedReport=check.reportHTML(unsafeReview);
assert.ok(reviewedReport.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),'review notes are escaped in reports');
assert.ok(!reviewedReport.includes('<script>'));assert.ok(reviewedReport.includes('合理复用'));
const redacted=check.exportRecord({...unsafeReview,sources:[{id:'a',label:'A',data:png}],refs:{a:{panelId:'p',vi:0,key:'e1',sourceId:'a',data:png}}});
assert.equal(redacted.sources[0].data,undefined);assert.equal(redacted.refs.a.data,undefined);assert.equal(redacted.reviews,unsafeReview.reviews);
// Exercise the UI controller with a small DOM adapter: no browser or network.
function controller(fetcher,options={}){
  const elements=new Map(),timers=new Map(),calls=[],saved=[],downloads=[],views=[],messages=[],records=options.records||new Map(),invalid=new Set();let nextTimer=1,current=1,located=0,project='project-1',collected=options.collected||{images:[{id:'a',label:'A',data:png},{id:'b',label:'B',data:png}],refs:{a:{panelId:'panel-1',vi:0,key:'e1',data:png},b:{panelId:'panel-2',vi:0,key:'e2',data:png}},skipped:[]};
  class Control{
    constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.hidden=false;this.disabled=false;this.open=false;this.value='';this.textContent='';}
    set innerHTML(html){for(const match of html.matchAll(/<([\w-]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const el=new Control(match[1]);el.id=match[3];el.hidden=/\bhidden\b/.test(match[2]);if(el.id==='duplicateScope')el.value='all';const text=match[2].match(/data-duplicate-text="([^"]+)"/);if(text)el.dataset.duplicateText=text[1];elements.set(el.id,el);this.children.push(el);}}
    append(...children){this.children.push(...children);}replaceChildren(...children){this.children=children;}
    setAttribute(name,value){this[name]=value;}addEventListener(name,callback){this['on'+name]=callback;}scrollIntoView(){}showModal(){this.open=true;}close(){this.open=false;}click(){return this.onclick?.();}
    querySelectorAll(selector){const descendants=this.children.filter(c=>typeof c==='object');return descendants.flatMap(c=>[...(selector==='[data-duplicate-text]'&&c.dataset.duplicateText?[c]:[]),...c.querySelectorAll(selector)]);}
  }
  for(const id of ['checkImageDuplicates','language'])elements.set(id,new Control('button'));
  global.document={getElementById:id=>elements.get(id),createElement:tag=>new Control(tag),body:{append(el){elements.set(el.id,el);}}};
  global.location={protocol:'http:',hostname:'127.0.0.1'};
  global.matchMedia=()=>({matches:true});
  global.StudioDuplicateViewer={open:args=>{args.closed=0;views.push(args);return {close(){args.closed++;args.onClose?.();},destroy(){}};}};
  global.FileReader=class{readAsDataURL(file){this.result=file.data;Promise.resolve().then(()=>this.onload());}};
  global.StudioI18n={en:{},language:'en',t(text,...values){return (global.StudioI18n.language==='en'?(global.StudioI18n.en[text]||text):text).replace(/\{(\d+)\}/g,(_,n)=>String(values[Number(n)]??''));}};
  global.setTimeout=fn=>{const id=nextTimer++;timers.set(id,fn);return id;};global.clearTimeout=id=>timers.delete(id);
  const api={engine:{duplicateEndpoint:'/api/image-duplicates',token:'local'},fetch:async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);return fetcher(body);},collect:()=>collected,snapshot:()=>current,isSnapshot:s=>s===current,locate:()=>{located++;return true;},say:text=>messages.push(text),download:(blob,name)=>downloads.push({blob,name})};
  if(options.persistence)Object.assign(api,{projectId:()=>project,getReviewRecord:()=>records.get(project)||null,saveReviewRecord(record){assert.equal(record.projectId,project,'cannot save into another project');if(options.validate)reviewStore.validate(record,project);records.set(project,record);saved.push(record);},resolveRefs(refs){assert.ok(refs.every(ref=>ref.data===png),'content validation receives original image bytes');return refs.some(ref=>invalid.has(ref.panelId))?null:refs.map(ref=>({...ref,vi:current}));}});
  const ui=check.init(api);
  return {elements,calls,ui,records,saved,downloads,views,messages,invalid,get located(){return located;},mutate(){current++;},setProject(value){project=value;},setCollected(value){collected=value;},async tick(){const queued=[...timers.entries()];timers.clear();for(const [,fn]of queued)fn();await settle();}};
}
const response=data=>({ok:true,json:async()=>data});
const settle=async()=>{for(let n=0;n<20;n++)await Promise.resolve();};
const completed={status:'complete',result:{images:[{id:'a',label:'A',thumbnail:png},{id:'b',label:'B',thumbnail:png}].map(item=>({...item,width:64,height:64,analysisWidth:64,analysisHeight:64})),matches:[{a:'a',b:'b',kind:'exact',evidence:png}],warnings:[]}};
const child=(card,name)=>card.children.find(el=>el.className===name);
const cardOf=h=>h.elements.get('duplicateMatches').children[0];
const controlsOf=h=>{const controls=child(cardOf(h),'duplicate-review-controls');return {status:controls.children[0].children[0],note:controls.children[1].children[0],recorded:controls.children[2]};};
async function lifecycle(){
  const originals={document:global.document,location:global.location,matchMedia:global.matchMedia,StudioI18n:global.StudioI18n,StudioDuplicateViewer:global.StudioDuplicateViewer,FileReader:global.FileReader,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
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
    // The primary integration validates individual original image bytes, not a whole-figure snapshot.
    h=controller(body=>response(body.action==='start'?{jobId:'job'}:completed),{persistence:true,validate:true});
    h.ui.open();await h.elements.get('duplicateStart').onclick();await settle();
    const initial=h.records.get('project-1');assert.equal(initial.format,'figure-studio-image-check-v2');
    assert.equal(initial.sources[0].data,png);assert.equal(initial.refs.a.sourceId,'a');assert.equal(initial.refs.a.data,undefined,'source bytes stored once');
    const originalCard=cardOf(h),reviewControls=controlsOf(h);reviewControls.status.value='legitimate';reviewControls.status.onchange();
    const afterStatus=h.records.get('project-1');assert.notEqual(afterStatus,initial);assert.equal(Object.keys(initial.reviews).length,0,'saved snapshots are immutable');
    reviewControls.note.value='Same control intentionally shown twice. <check>';
    reviewControls.note.oninput();const afterNote=h.records.get('project-1');
    assert.notEqual(afterNote,afterStatus);assert.notEqual(afterNote.reviews,afterStatus.reviews);assert.equal(afterNote.result,initial.result);assert.equal(afterNote.sources,initial.sources,'keystrokes reuse source buffers');
    assert.equal(afterStatus.reviews[check.pairKey({a:'a',b:'b'})].note,'');assert.equal(cardOf(h),originalCard,'typing does not replace result cards');
    assert.equal(controlsOf(h).note,reviewControls.note,'typing keeps the textarea and caret');assert.equal(reviewControls.recorded.textContent,'Recorded');
    reviewControls.note.value='x'.repeat(2100);reviewControls.note.oninput();assert.equal(h.records.get('project-1').reviews[check.pairKey({a:'a',b:'b'})].note.length,2000);
    reviewControls.note.value='Review completed <check>.';reviewControls.note.oninput();
    const actions=child(originalCard,'duplicate-match-actions');actions.children[1].onclick();assert.equal(h.views.length,1);assert.equal(h.views[0].sourceA,png);assert.equal(h.views[0].pair.kind,'exact');
    child(originalCard,'duplicate-evidence duplicate-evidence-button').onclick();assert.equal(h.views.length,2,'evidence itself opens details');
    h.mutate();actions.children[0].onclick();assert.equal(h.located,1,'layout moves do not invalidate original image references');
    h.ui.open();h.invalid.add('panel-1');child(cardOf(h),'duplicate-match-actions').children[0].onclick();assert.equal(h.located,1,'a changed source blocks location');assert.ok(h.elements.get('duplicateSnapshotNote').textContent.includes('source image'));
    h.elements.get('duplicateExportJSON').onclick();h.elements.get('duplicateExportHTML').onclick();
    const exported=JSON.parse(await h.downloads[0].blob.text());assert.equal(exported.sources[0].data,undefined);assert.equal(exported.refs.a.data,undefined);assert.equal(exported.reviews[check.pairKey({a:'a',b:'b'})].status,'legitimate');
    const exportedHTML=await h.downloads[1].blob.text();assert.ok(exportedHTML.includes('Legitimate reuse'));assert.ok(exportedHTML.includes('Review completed &lt;check&gt;.'));
    const records=h.records;
    h=controller(body=>response(body.action==='start'?{jobId:'job'}:completed),{persistence:true,records});h.ui.open();
    assert.equal(h.elements.get('duplicateResults').hidden,false,'saved project restores results without another scan');assert.equal(controlsOf(h).status.value,'legitimate');assert.equal(controlsOf(h).note.value,'Review completed <check>.');
    assert.equal(h.calls.length,0);child(cardOf(h),'duplicate-match-actions').children[1].onclick();assert.equal(h.views[0].sourceB,png,'saved project restores image detail sources');
    global.StudioI18n.language='zh-CN';h.elements.get('language').onchange();assert.equal(controlsOf(h).recorded.textContent,'已记录');assert.equal(child(cardOf(h),'duplicate-match-actions').children[1].textContent,'查看详情');
    h.elements.get('duplicateExportHTML').onclick();assert.ok((await h.downloads[0].blob.text()).includes('合理复用'),'Chinese report includes the review decision');
    // A failed or cancelled replacement scan must never erase the last successful review.
    for(const mode of ['error','cancelled','complete-after-cancel']){
      let resolveStatus;
      h=controller(body=>body.action==='start'?response({jobId:'job'}):body.action==='cancel'?response({status:'running'}):new Promise(resolve=>{resolveStatus=resolve;}),{persistence:true,records});
      const previous=records.get('project-1');await h.elements.get('duplicateStart').onclick();await settle();
      if(mode!=='error')h.elements.get('duplicateCancel').onclick();
      resolveStatus(response(mode==='error'?{status:'error',error:'failed'}:mode==='cancelled'?{status:'cancelled'}:completed));await settle();
      assert.equal(records.get('project-1'),previous,mode+' preserves persisted completed record');assert.equal(h.saved.length,0);assert.equal(h.elements.get('duplicateResults').hidden,false,'old results return after '+mode);
    }
    // Switching projects during either start or status responses cannot commit old results.
    let finishStart;
    h=controller(body=>body.action==='start'?new Promise(resolve=>{finishStart=resolve;}):response({status:'cancelled'}),{persistence:true,records});
    const oldStarting=h.elements.get('duplicateStart').onclick();h.setProject('project-2');h.ui.refresh();
    finishStart(response({jobId:'detached'}));await oldStarting;await settle();assert.equal(h.saved.length,0);assert.equal(records.has('project-2'),false);assert.ok(h.calls.some(call=>call.action==='cancel'&&call.jobId==='detached'));
    assert.equal(h.elements.get('duplicateResults').hidden,true);h.setProject('project-1');h.ui.open();assert.equal(controlsOf(h).status.value,'legitimate','returning to old project restores its record');
    let finishStatus;
    h=controller(body=>body.action==='start'?response({jobId:'job'}):body.action==='cancel'?response({status:'running'}):new Promise(resolve=>{finishStatus=resolve;}),{persistence:true,records});
    await h.elements.get('duplicateStart').onclick();await settle();h.setProject('project-2');finishStatus(response(completed));await settle();assert.equal(h.saved.length,0);assert.equal(records.has('project-2'),false);
    // Source exclusions actually change the submitted batch; changing scope resets exclusions.
    h=controller(body=>response(body.action==='start'?{jobId:'job'}:{status:'cancelled'}),{persistence:true,collected:{images:[{id:'a',label:'A',data:png},{id:'b',label:'B',data:png},{id:'c',label:'C',data:png}],refs:{a:{panelId:'a',vi:0,key:'e1'},b:{panelId:'b',vi:0,key:'e2'},c:{panelId:'c',vi:0,key:'e3'}},skipped:[]}});
    let grid=child(h.elements.get('duplicateFileList'),'duplicate-source-list');assert.ok(grid.children.every(item=>item.children[0].children[1].tagName==='span'),'pre-scan checklist does not decode original images');const checkbox=grid.children[2].children[0].children[0];checkbox.checked=false;checkbox.onchange();
    assert.ok(h.elements.get('duplicateSourceStatus').textContent.includes('2 of 3'));await h.elements.get('duplicateStart').onclick();await settle();assert.deepEqual(h.calls.find(call=>call.action==='start').images.map(image=>image.id),['a','b']);
    h.elements.get('duplicateScope').onchange();assert.ok(h.elements.get('duplicateSourceStatus').textContent.includes('3 of 3'));
    // Local originals are retained for a reopened project's detail view, but never inserted into the canvas.
    const localResult={status:'complete',result:{images:[{id:'a',label:'A',thumbnail:png},{id:'file-1',label:'local.png',thumbnail:png}],matches:[{a:'a',b:'file-1',kind:'overlap'}],warnings:[]}};
    h=controller(body=>response(body.action==='start'?{jobId:'job'}:localResult),{persistence:true,collected:{images:[{id:'a',label:'A',data:png}],refs:{a:{panelId:'a',vi:0,key:'e1'}},skipped:[]}});
    h.elements.get('duplicateFiles').files=[{name:'local.png',type:'image/png',size:5,data:png}];await h.elements.get('duplicateFiles').onchange();await h.elements.get('duplicateStart').onclick();await settle();
    assert.equal(child(cardOf(h),'duplicate-match-actions').children[0].textContent,'Locate canvas image');assert.equal(h.records.get('project-1').sources.length,2);assert.equal(Object.keys(h.records.get('project-1').refs).length,1);
    child(cardOf(h),'duplicate-match-actions').children[1].onclick();assert.equal(h.views[0].sourceB,png);assert.equal(h.views[0].sourceA,png);
    h.elements.get('closeImageDuplicates').onclick();assert.equal(h.views[0].closed,1,'closing the result dialog closes its detail viewer');h.ui.open();child(cardOf(h),'duplicate-match-actions').children[1].onclick();h.setProject('another');h.ui.refresh();assert.equal(h.views[1].closed,1,'project switching closes the previous project detail viewer');
    console.log('Image duplicate UI extraction, safe reports, review persistence and project lifecycle tests passed');
  }finally{Object.assign(global,originals);}
}
lifecycle().catch(error=>{console.error(error);process.exitCode=1;});
