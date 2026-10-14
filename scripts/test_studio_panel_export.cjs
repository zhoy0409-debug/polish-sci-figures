/* Execute the production composition/export path. This is a DOM logic test;
 * actual browser rasterization and downloaded files have separate acceptance QA. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const helpers=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const copy=x=>JSON.parse(JSON.stringify(x));
class Element{
  constructor(tag){this.localName=tag;this.attrs={};this.children=[];this.ownText='';this.style={setProperty(k,v){this[k]=v;}};
    this.dataset=new Proxy({}, {get:(_,key)=>this.getAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase())),set:(_,key,value)=>{this.setAttribute('data-'+String(key).replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),value);return true;}});
    this.classList={add:name=>this.setAttribute('class',((this.getAttribute('class')||'')+' '+name).trim())};}
  get id(){return this.getAttribute('id')||'';}set id(v){this.setAttribute('id',v);}
  get textContent(){return this.ownText+this.children.map(n=>n.textContent).join('');}set textContent(v){this.ownText=String(v);this.children=[];}
  get attributes(){return Object.entries(this.attrs).map(([name,value])=>({name,localName:name,value}));}
  getAttribute(k){return this.attrs[k]??null;}setAttribute(k,v){this.attrs[k]=String(v);}hasAttribute(k){return k in this.attrs;}removeAttribute(k){delete this.attrs[k];}removeAttributeNode(a){delete this.attrs[a.name];}
  setAttributeNS(namespace,k,v){assert.equal(namespace,'http://www.w3.org/2000/xmlns/');this.setAttribute(k,v);}
  append(...nodes){for(const n of nodes){n.remove?.();n.parentNode=n.parentElement=this;this.children.push(n);}}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=this.parentNode=null;}
  matches(s){return s.split(',').some(part=>{const m=part.trim().match(/^(\*|[\w-]+)?(?:\[([\w-]+)([\^*$]?=)?["']?([^"'\]]*)["']?\])?$/);return !!m&&(!m[1]||m[1]==='*'||m[1]===this.localName)&&(!m[2]||(m[3]==='='?this.getAttribute(m[2])===m[4]:m[3]==='^='?(this.getAttribute(m[2])||'').startsWith(m[4]):m[3]==='$='?(this.getAttribute(m[2])||'').endsWith(m[4]):this.hasAttribute(m[2])));});}
  querySelectorAll(s){return this.children.filter(n=>n.matches).flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
  closest(s){for(let n=this;n;n=n.parentElement)if(n.matches?.(s))return n;return null;}
  getBBox(){
    const n=k=>Number(this.getAttribute(k)||0);
    if(this.localName==='text'){const size=n('font-size')||10,w=this.textContent.length*size*.55,anchor=this.getAttribute('text-anchor');return{x:n('x')-(anchor==='middle'?w/2:anchor==='end'?w:0),y:n('y')-size,width:w,height:size*1.25};}
    if(this.localName==='rect')return{x:n('x'),y:n('y'),width:n('width'),height:n('height')};
    if(this.localName==='line')return{x:Math.min(n('x1'),n('x2')),y:Math.min(n('y1'),n('y2')),width:Math.abs(n('x2')-n('x1')),height:Math.abs(n('y2')-n('y1'))};
    const boxes=this.children.filter(c=>c.getBBox).map(c=>c.getBBox());if(!boxes.length)return{x:0,y:0,width:0,height:0};const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return{x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
  }
}
const element=(tag,attrs={},text='')=>{const e=new Element(tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);e.textContent=text;return e;};
const positions=[{id:'a',x:0,y:0,width:330,height:300,statisticsBand:0,statisticsTop:0,statisticsFirstTop:0,conditionHeight:0},{id:'b',x:420,y:230,width:350,height:390,statisticsBand:50,statisticsTop:40,statisticsFirstTop:40,conditionHeight:60}];
const page={width:800,height:620,positions,cells:positions.map((p,i)=>({...p,row:i,col:i}))};
const overlay=(id,type,x,y,w,h,text)=>({id,type,x:x/page.width,y:y/page.height,w:w/page.width,h:h/page.height,text:text||'',font:'Arial',size:12,stroke:1,color:'#253247',opacity:1,fill:false,bold:false,locked:false});
const state={order:['a','b'],columns:2,gap:12,panels:{a:{variant:0,methodChoice:{key:'primary_test'},statistics:{analysis:{p:.03}}},b:{variant:0,methodChoice:{key:'primary_test'},statistics:{analysis:{p:.07}}}},exportSettings:{widthMm:800*25.4/72*2,dpi:600},overlays:[overlay('inside','text',490,400,80,20,'Inside B'),overlay('cross','line',405,500,65,0),overlay('outside','text',30,100,80,20,'Outside A')],alignmentGuides:[{id:'guide-1',axis:'x',position:520}]};
const assets={a:{variants:[{width:330,height:300,viewBox:[0,0,330,300]}]},b:{variants:[{width:350,height:240,viewBox:[0,0,350,240]}]}};
const calls={layouts:[],fit:[],edited:[],labels:[],offsets:[]};
const ctx={imageInsets:null,...helpers,NS:'http://www.w3.org/2000/svg',state:()=>state,copy,T:x=>x,selectedPanel:'b',selected:['e1'],selectedAnnotations:['inside'],showGuides:true,layoutMode:true,panelSelection:['b'],
  document:{createElementNS:(_,tag)=>new Element(tag),createTextNode:text=>({textContent:text}),createElement:tag=>new Element(tag),body:new Element('body')},
  layout:s=>{calls.layouts.push(s.order.slice());return page;},panel:id=>assets[id],fittedVariant:()=>null,
  editedSvg:(id,vi,s,raw)=>{calls.edited.push({id,vi,order:s.order.slice(),raw});const p=positions.find(p=>p.id===id),svg=element('svg',{viewBox:`0 0 ${p.width} ${p.height}`,'data-stat-first-header':p.statisticsFirstTop});svg.append(element('path',{id:'art-'+id,d:'M 40 100 L 60 80',stroke:'#334b70','data-key':'e0'}),element('text',{'font-size':12,x:50,y:125,'data-key':'e1'},'Plot '+id));return svg;},
  fitPlot:(svg,v,pos,margins)=>{calls.fit.push({pos:{...pos},margins:{...margins}});return false;},applyElementOffsets:(svg,id)=>calls.offsets.push(id),translateStatisticalElement:()=>{},namespace:svg=>svg,
  displayedPanelLabel:(s,id)=>{calls.labels.push({id,order:s.order.slice()});return{text:id==='a'?'A':'B',x:2,y:5,size:12,font:'Arial',bold:true};},
  annotationFirstTopHeight:id=>id==='a'?82:40,statisticalAnalysisFor:id=>({primary_test:{name:'Welch',source:id}}),statisticalExportRecords:s=>s.order.map(id=>({panel:id,analysis:s.panels[id].statistics.analysis})),
  gridFor:()=>({rows:2,places:{a:{row:0,col:0,rs:1,cs:1},b:{row:1,col:1,rs:1,cs:1}}})};
vm.createContext(ctx);
const extract=(begin,end)=>{const a=source.indexOf(begin),b=source.indexOf(end,a);assert.ok(a>0&&b>a,begin);return source.slice(a,b);};
vm.runInContext(extract('  function insetGeometry(','  function insetSelection(')+'\n'+extract('  function panelExportRegion(','  function refreshInsetGraphics(')+'\n'+extract('  function overlayNode(','  function refreshOverlaySelection(')+'\n'+extract('  function wrapPanelContent(','  function composite(')+'\n'+extract('  function composite(','  let autosaveQueue='),ctx);
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;},near=(a,b)=>{assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);checks++;};
const snapshot=JSON.stringify(state),full=ctx.composite(false,true,state);
eq(full.getAttribute('viewBox'),'0 0 800 620');near(parseFloat(full.getAttribute('width')),1600);near(parseFloat(full.getAttribute('height')),1240);
eq(full.querySelectorAll('svg').length,2);assert.ok(full.textContent.includes('Inside B')&&full.textContent.includes('Outside A'));
const single=ctx.composite(false,true,state,'b');
eq(single.getAttribute('viewBox'),'420 230 350 390','Panel crop uses its complete existing slot, including stats and condition rows');near(parseFloat(single.getAttribute('width')),700);near(parseFloat(single.getAttribute('height')),780);
eq(single.querySelectorAll('svg').length,1);eq(single.querySelectorAll('path').filter(p=>p.id==='art-b').length,1);eq(single.querySelectorAll('path').filter(p=>p.id==='art-a').length,0);
const texts=single.querySelectorAll('text').map(n=>n.textContent);assert.ok(texts.includes('B'),'Current B label is retained');assert.ok(!texts.includes('A'),'No relabeling to A');assert.ok(texts.includes('Plot b')&&texts.includes('Inside B'));assert.ok(!texts.includes('Plot a')&&!texts.includes('Outside A'));
eq(single.querySelectorAll('line').length,1,'Overlay crossing the crop boundary is retained for viewport clipping');eq(single.querySelectorAll('image').length,0,'Vector source text and paths are not rasterized for SVG export');
for(const svg of [full,single])for(const e of [svg,...svg.querySelectorAll('*')])for(const a of e.attributes){assert.ok(!a.name.startsWith('data-')&&a.name!=='class','No editor-only selection attributes');checks++;}
for(const svg of [full,single]){assert.ok(!svg.textContent.includes('拖动整张小图'));eq(svg.querySelectorAll('circle').length,0,'Move-handle dots are not exported');}
const meta=JSON.parse(single.children.find(n=>n.localName==='metadata').textContent);eq(meta.analysisChoices.map(r=>r.panel),['b']);eq(meta.statistics.map(r=>r.panel),['b']);
eq(JSON.stringify(state),snapshot,'Export never mutates order, labels, state, scientific values or geometry');for(const call of calls.layouts)eq(call,['a','b'],'Single-panel export uses complete composition geometry');for(const call of calls.labels)eq(call.order,['a','b'],'Labels are resolved with the complete original order');
const lastFit=calls.fit.at(-1);eq(lastFit.margins.top,126,'Common margins remain those of the full composition');eq(lastFit.pos.height,280,'Fitting keeps the original reserved body geometry');
assert.throws(()=>ctx.composite(false,true,state,'missing'),'An unknown panel must never silently export a different figure');
// Run the actual async exporter with deterministic image/canvas adapters. The
// TIFF byte codec is checked independently against Pillow, not mocked here.
async function testHandlers(){
  let active=state,hook=null,reflowHook=null,encodeHook=null,imageFails=false,nullCanvas=false,nullPng=false;
  const controls=new Map(),downloads=[],canvases=[],encoded=[],revoked=[],messages=[];
  const control=id=>{if(!controls.has(id)){const e=new Element('control');Object.assign(e,{value:'',disabled:false,open:false,listeners:{},focus(){},addEventListener(name,fn){this.listeners[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},replaceChildren(...nodes){this.children=[];this.append(...nodes);}});controls.set(id,e);}return controls.get(id);};
  const tinyPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a4xQAAAAASUVORK5CYII=','base64');
  Object.assign(ctx,{state:()=>active,project:{id:'project-1'},dataDrafts:{},exportBusy:false,exportRequest:null,$:control,Blob,Uint8Array,
    ensureCurrentReflows:async()=>{if(reflowHook)await reflowHook();},rasterResolution:async()=>{if(hook)await hook();return '';},
    XMLSerializer:class{serializeToString(svg){return JSON.stringify({attrs:svg.attrs,text:svg.textContent});}},
    Image:class{set src(value){this.url=value;queueMicrotask(()=>imageFails?this.onerror():this.onload());}},
    URL:{createObjectURL:()=>`blob:export-${downloads.length}`,revokeObjectURL:url=>revoked.push(url)},
    download:(blob,name)=>downloads.push({blob,name}),say:text=>messages.push(text),
    StudioTiff:{encodeAsync:async options=>{const canvas=canvases.at(-1);eq(canvas.width,0,'TIFF releases the canvas backing store before allocating encoder output');eq(canvas.height,0);eq(canvas.readSize,[options.width,options.height],'RGBA capture precedes canvas release');eq(options.data[0],73,'RGBA data survives canvas release');encoded.push(options);options.onProgress(.5);if(encodeHook)await encodeHook();return new Uint8Array([73,73,42,0]);}}
  });
  ctx.document.fonts={ready:Promise.resolve()};
  ctx.document.createElement=tag=>{if(tag!=='canvas')return new Element(tag);const canvas={width:0,height:0,calls:[],getContext(){if(nullCanvas)return null;const c={fillStyle:'',fillRect:(...args)=>canvas.calls.push(['fill',c.fillStyle,...args]),drawImage:(...args)=>canvas.calls.push(['draw',...args.slice(1)]),getImageData:(x,y,w,h)=>{canvas.readSize=[canvas.width,canvas.height];return{data:new Uint8ClampedArray([73,80,90,255]),width:w,height:h};}};return c;},toBlob(callback){callback(nullPng?null:new Blob([tinyPng],{type:'image/png'}));}};canvases.push(canvas);return canvas;};
  vm.runInContext(extract('  function refreshDataExport()','  function renderDataEditor(')+'\n'+extract('  function assertExportReady(','  $(\'closeImageExport\').onclick'),ctx);
  const expectReject=async(run,pattern)=>{const before=downloads.length;await assert.rejects(run,pattern);eq(downloads.length,before,'Rejected exports never trigger a download');eq(ctx.exportBusy,false,'Every failure releases the busy lock');};
  await expectReject(()=>ctx.exportFigure('jpg'),/文件格式/);await expectReject(()=>ctx.exportFigure('svg','missing'),/目标小图/);
  ctx.dataDrafts={b:[['draft']]};for(const format of ['svg','png','tif'])await expectReject(()=>ctx.exportFigure(format,'b'),/数据修改/);
  ctx.dataDrafts={a:[['draft']]};await expectReject(()=>ctx.exportFigure('svg'),/数据修改/);
  await ctx.exportFigure('svg','b');eq(downloads.at(-1).name,'figure-studio-panel-B.svg','Unrelated panel draft does not block a current panel export');eq(control('export').disabled,true);eq(control('tiff').disabled,true);ctx.dataDrafts={};
  for(const format of ['svg','png','tif'])for(const id of [null,'b']){
    const old=JSON.stringify(active),before=downloads.length;await ctx.exportFigure(format,id,{widthMm:30,dpi:600});eq(downloads.length,before+1);eq(downloads.at(-1).blob.type,format==='svg'?'image/svg+xml':format==='png'?'image/png':'image/tiff');eq(JSON.stringify(active),old,'Export-only physical size never modifies project settings');eq(ctx.exportBusy,false);eq(control('export').disabled,false);eq(control('tiff').disabled,false);
    if(format==='svg'){const saved=JSON.parse(await downloads.at(-1).blob.text());near(parseFloat(saved.attrs.width),30*72/25.4);eq(saved.attrs.viewBox,id?'420 230 350 390':'0 0 800 620');}
    else{const canvas=canvases.at(-1),expected=helpers.exportGeometry(id?350:800,id?390:620,{widthMm:30,dpi:600});eq(canvas.calls[0],['fill','#fff',0,0,expected.widthPx,expected.heightPx],'Raster output gets a white background at the requested actual pixel dimensions');eq(canvas.calls[1],['draw',0,0,expected.widthPx,expected.heightPx]);eq(canvas.width,0);eq(canvas.height,0,'Large backing stores are released');}
    if(format==='png'){const bytes=Buffer.from(await downloads.at(-1).blob.arrayBuffer()),index=bytes.indexOf(Buffer.from('pHYs'));assert.ok(index>0);eq(bytes.readUInt32BE(index+4),Math.round(600/.0254));}
  }
  for(const dpi of [600,900,1200]){await ctx.exportFigure('tif','b',{widthMm:25.4,dpi});const call=encoded.at(-1);eq(call.dpi,dpi);eq(call.width,dpi);eq(call.height,Math.round(dpi*390/350));eq(downloads.at(-1).name,`figure-studio-panel-B-${dpi}dpi.tif`);}
  await expectReject(()=>ctx.exportFigure('tif','b',{widthMm:2000,dpi:1200}),/画布容量/);await expectReject(()=>ctx.exportFigure('tif','b',{widthMm:20,dpi:300}),/分辨率/);
  // A data edit introduced during decode cannot produce a stale image; button
  // disabled states must continue to reflect those unsaved draft values.
  hook=()=>{ctx.dataDrafts={b:[['new draft']]};};await expectReject(()=>ctx.exportFigure('tif','b',{widthMm:20,dpi:600}),/数据修改/);eq(control('export').disabled,true);eq(control('png').disabled,true);eq(control('tiff').disabled,true);ctx.dataDrafts={};
  hook=()=>{active=copy(state);};await expectReject(()=>ctx.exportFigure('svg','b'),/图形已更新/);active=state;
  hook=()=>{ctx.project={id:'other-project'};};await expectReject(()=>ctx.exportFigure('png','b',{widthMm:20,dpi:600}),/图形已更新/);ctx.project={id:'project-1'};hook=null;
  reflowHook=()=>{ctx.project={id:'replaced-before-capture'};};await expectReject(()=>ctx.exportFigure('svg','b'),/目标小图/);ctx.project={id:'project-1'};reflowHook=null;
  imageFails=true;await expectReject(()=>ctx.exportFigure('png','b',{widthMm:20,dpi:600}),/栅格化失败/);imageFails=false;
  nullCanvas=true;await expectReject(()=>ctx.exportFigure('tif','b',{widthMm:20,dpi:600}),/画布容量/);nullCanvas=false;
  nullPng=true;await expectReject(()=>ctx.exportFigure('png','b',{widthMm:20,dpi:600}),/PNG 导出失败/);nullPng=false;
  encodeHook=()=>{throw Error('encoder failed');};await expectReject(()=>ctx.exportFigure('tif','b',{widthMm:20,dpi:600}),/encoder failed/);eq(canvases.at(-1).width,0);eq(canvases.at(-1).height,0);encodeHook=null;
  encodeHook=()=>{active=copy(state);};await expectReject(()=>ctx.exportFigure('tif','b',{widthMm:20,dpi:600}),/图形已更新/);active=state;encodeHook=null;
  assert.ok(revoked.length>=canvases.length,'All raster object URLs are released, including failed decodes');
  let release;hook=()=>new Promise(resolve=>{release=resolve;});const first=ctx.exportFigure('svg','b');while(!release)await Promise.resolve();const pending=downloads.length;await ctx.exportFigure('svg','b');eq(downloads.length,pending,'Repeated clicks cannot create a second simultaneous export');release();await first;hook=null;
  ctx.guard=fn=>fn;vm.runInContext(extract("  $('closeImageExport').onclick","  document.addEventListener('keydown'"),ctx);
  await ctx.openImageExport('b','tif');eq(control('imageExportDialog').open,true);eq(ctx.exportRequest.panelId,'b');eq(ctx.exportRequest.snapshot,state,'Preview stores the exact state identity');eq(control('imageExportFormat').value,'tif');eq(control('imageExportPreview').querySelectorAll('svg').length,2,'Dialog uses the same root and nested panel SVG');
  let prevented=0;ctx.exportBusy=true;control('closeImageExport').onclick();eq(control('imageExportDialog').open,true,'Close button cannot interrupt an active encode');control('imageExportDialog').listeners.cancel({preventDefault(){prevented++;}});eq(prevented,1,'Native dialog Escape is blocked during encode');ctx.exportBusy=false;control('imageExportDialog').listeners.cancel({preventDefault(){prevented++;}});eq(prevented,1);control('closeImageExport').onclick();eq(control('imageExportDialog').open,false);
  control('imageExportFormat').value='svg';control('imageExportWidth').value='30';ctx.updateImageExport();eq(control('imageExportDpiLabel').hidden,true);near(Number(control('imageExportHeight').value),33.43);
  control('imageExportHeight').value='39';control('imageExportHeight').oninput();near(Number(control('imageExportWidth').value),35);eq(control('downloadImageExport').disabled,false);
  control('imageExportFormat').value='tif';control('imageExportWidth').value='2000';ctx.updateImageExport();eq(control('downloadImageExport').disabled,true,'Capacity is checked before starting the encoder');
  // The dialog is bound to its preview, not the most recently selected panel or
  // a later state with identical-looking content. These are actual click handlers.
  await ctx.openImageExport('b','svg');ctx.selectedPanel='a';control('imageExportWidth').value='30';ctx.updateImageExport();const beforeDialog=downloads.length;
  await control('downloadImageExport').onclick();eq(downloads.length,beforeDialog+1);eq(downloads.at(-1).name,'figure-studio-panel-B.svg','Changing selection behind a dialog cannot change its target');eq(control('downloadImageExport').disabled,false);assert.match(control('imageExportStatus').textContent,/已导出/);checks++;
  active=copy(state);ctx.updateImageExport();eq(control('downloadImageExport').disabled,true,'A new state identity invalidates the preview even if content is equal');const beforeStale=downloads.length;
  await control('downloadImageExport').onclick();eq(downloads.length,beforeStale);assert.match(control('imageExportStatus').textContent,/图形已更新/);checks++;eq(control('downloadImageExport').disabled,true,'finally must not enable a stale preview');active=state;
  ctx.project={id:'project-2'};ctx.updateImageExport();eq(control('downloadImageExport').disabled,true);await control('downloadImageExport').onclick();eq(downloads.length,beforeStale);assert.match(control('imageExportStatus').textContent,/目标小图/);checks++;ctx.project={id:'project-1'};
  ctx.dataDrafts={b:[['pending']]};ctx.updateImageExport();eq(control('downloadImageExport').disabled,true);await control('downloadImageExport').onclick();eq(downloads.length,beforeStale);eq(control('downloadImageExport').disabled,true);ctx.dataDrafts={};ctx.selectedPanel='b';
  await ctx.openImageExport('b','svg');const beforeAwait=downloads.length;reflowHook=()=>{active=copy(state);};
  await control('downloadImageExport').onclick();eq(downloads.length,beforeAwait,'A state change during export preflight must invalidate the dialog preview, not export a fresh unpreviewed state');eq(control('downloadImageExport').disabled,true);active=state;reflowHook=null;
  // Capture-phase guards stop underlying delete, nudge and undo handlers while
  // preserving standard text-field editing and normal modal keyboard navigation.
  let capture;ctx.document.addEventListener=(name,fn,phase)=>{eq(name,'keydown');eq(phase,true);capture=fn;};ctx.document.querySelector=selector=>selector==='dialog[open]'&&control('imageExportDialog').open?control('imageExportDialog'):null;
  vm.runInContext(extract("  document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')",'  let savedLanguage'),ctx);
  const key=(key,extras={},editing=false)=>{const event={key,target:{closest:()=>editing?{}:null},prevented:0,stopped:0,preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},...extras};capture(event);return event;};
  control('imageExportDialog').open=true;
  for(const [name,mod] of [['Delete',{}],['Backspace',{}],['ArrowLeft',{}],['ArrowRight',{}],['ArrowUp',{}],['ArrowDown',{}],['z',{ctrlKey:true}],['Z',{ctrlKey:true,shiftKey:true}],['z',{metaKey:true}]]){const blocked=key(name,mod);eq(blocked.prevented,1);eq(blocked.stopped,1);const editable=key(name,mod,true);eq(editable.prevented,0);eq(editable.stopped,0);}
  for(const name of ['Tab','Enter','Escape','a']){const allowed=key(name);eq(allowed.prevented,0);eq(allowed.stopped,0);}
  control('imageExportDialog').open=false;for(const name of ['Delete','ArrowLeft']){const allowed=key(name);eq(allowed.prevented,0);eq(allowed.stopped,0);}
  eq(JSON.stringify(state),snapshot,'All exporter paths leave the original state untouched');
  console.log(`PASS panel export: ${checks} composition/crop/vector/state and async export assertions`);
}
testHandlers().catch(error=>{console.error(error);process.exitCode=1;});
