'use strict';
const assert=require('node:assert/strict');
const zlib=require('node:zlib');
const {JSDOM}=require('jsdom');
const core=require('../skills/polish-sci-figures/assets/figure-studio/image-insets.js');
const UI=require('../skills/polish-sci-figures/assets/figure-studio/image-insets-ui.js');
const Controller=require('../skills/polish-sci-figures/assets/figure-studio/image-insets-controller.js');
const copy=v=>JSON.parse(JSON.stringify(v));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function crc(buffer){let c=0xffffffff;for(const v of buffer){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(kind,body){const k=Buffer.from(kind),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(body.length);sum.writeUInt32BE(crc(Buffer.concat([k,body])));return Buffer.concat([len,k,body,sum]);}
const head=Buffer.alloc(13);head.writeUInt32BE(1200);head.writeUInt32BE(800,4);head[8]=8;head[9]=2;
const href='data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',head),chunk('IDAT',zlib.deflateSync(Buffer.alloc((1200*3+1)*800))),chunk('IEND',Buffer.alloc(0))]).toString('base64');
function fixture({delay=false}={}){
 const dom=new JSDOM(`<!doctype html><html><head></head><body><aside><section id="typePanel"></section></aside><div id="annotation"></div><div id="viewport"><svg id="artboard" viewBox="0 0 600 400"><svg data-panel="panel-1" data-variant="0" x="20" y="30" width="300" height="200" viewBox="0 0 1200 800" overflow="visible"><image data-key="e1" width="1200" height="800" href="${href}"/></svg></svg></div></body></html>`,{pretendToBeVisual:true});
 const doc=dom.window.document,viewport=doc.querySelector('#viewport'),root=doc.querySelector('#artboard'),image=doc.querySelector('image');
 image.getScreenCTM=()=>({a:.5,b:0,c:0,d:.5,e:50,f:70}); // 2 CSS px per canvas pt, nonzero viewport scroll offsets.
 viewport.setPointerCapture=()=>{};viewport.releasePointerCapture=()=>{};
 dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new dom.window.Event('close'));};
 const source={panelId:'panel-1',variant:0,key:'e1'};let project={panels:[{id:'panel-1',variants:[{svg:'unused'}]}]};
 let state={order:['panel-1'],panels:{'panel-1':{variant:0}},overlays:[]},selection={source,locked:false},pending,controller,display,commits=[],messages=[],otherGestures=0,beforePreviews=0;
 const decode=()=>delay?new Promise(resolve=>{pending=()=>resolve({...core.dimensionsFromHref(href),href});}):Promise.resolve({...core.dimensionsFromHref(href),href});
 const host={core:{...core,decodeSource:decode},ui:UI,viewport,root:()=>root,state:()=>state,project:()=>project,selection:()=>selection,geometry:()=>({width:600,height:400,dx:0,dy:0}),layout:()=>({}),output:()=>({scale:1,dpi:600}),calibration:s=>state.panels[s.panelId]?.imageCalibrations?.[s.variant]?.[s.key],language:()=> 'en',activePane:()=>selection.inset?'annotation':'detail',detailContainer:doc.querySelector('aside'),annotationContainer:doc.querySelector('#annotation'),say:text=>messages.push(text),cancelOtherGestures:()=>otherGestures++,beforePreview:()=>beforePreviews++,
 commit(next,label){commits.push(copy(next));state=next;display=next;if(selection.inset)selection={...selection,inset:state.overlays.find(a=>a.id===selection.inset.id)};controller?.refresh();return true;},
 repaint(next){display=next||state;controller?.refresh();},selectInset(id){selection={inset:state.overlays.find(a=>a.id===id),locked:false};controller?.refresh();}};
 controller=Controller.create(host);
 function pointer(type,x,y,extra={}){const event=new dom.window.Event(type,{bubbles:true,cancelable:true});Object.assign(event,{clientX:x*.5+50,clientY:y*.5+70,pointerId:1,button:0,isPrimary:true,...extra});viewport.dispatchEvent(event);return event;}
 return {dom,doc,viewport,root,image,source,host,controller,pointer,commits,messages,get state(){return state;},get displayed(){return display;},get selected(){return selection;},set selected(s){selection=s;},get otherGestures(){return otherGestures;},get beforePreviews(){return beforePreviews;},setState(s){state=s;if(selection.inset)selection={...selection,inset:state.overlays.find(a=>a.id===selection.inset.id)};},setProject(p){project=p;},get project(){return project;},resolve(){pending();},close(){controller.destroy();dom.window.close();}};
}
const tests=[];const test=(name,fn)=>tests.push([name,fn]);
async function roi(f,factor=2,start=[96,96],end=[336,256]){assert.equal(await f.controller.startROI(f.source,undefined,factor),true);f.pointer('pointerdown',...start);f.pointer('pointermove',...end);f.pointer('pointerup',...end);return f.state.overlays.at(-1);}
test('real DOM ROI keeps source pixels and commits once with exact transformed geometry',async()=>{
 const f=fixture(),source=f.image.outerHTML;let bubbled=0;f.viewport.addEventListener('pointerdown',()=>bubbled++);
 const a=await roi(f);assert.equal(f.commits.length,1);assert.equal(bubbled,0);assert.equal(f.otherGestures,1);assert.deepEqual(a.roi,{x:.08,y:.12,w:.2,h:.2});near(a.w*600,120);near(a.h*400,80);assert.equal(a.source.widthPx,1200);assert.equal(a.source.heightPx,800);assert.equal(JSON.stringify(f.state).includes('data:image'),false);assert.equal(f.image.outerHTML,source);assert.equal(f.controller.exportReady(),true);near(core.quality(a,{geometry:f.host.geometry()}).effectiveDpi,144);f.close();
});
test('reverse drag, presets, redraw and canvas fitting preserve pixel aspect and existing style',async()=>{
 const f=fixture(),a=await roi(f,3,[336,256],[96,96]);near(a.w*600,180);near(a.h*400,120);const color=f.doc.querySelector('[data-inset-control="borderColor"]');color.value='#aabbcc';color.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));
 f.doc.querySelector('[data-factor="4"]').click();near(f.state.overlays[0].w*600,240);near(f.state.overlays[0].h*400,160);
 const id=a.id;await f.controller.startROI(f.source,id,4);f.pointer('pointerdown',0,0);f.pointer('pointerup',1200,800);assert.equal(f.state.overlays.length,1);assert.equal(f.state.overlays[0].id,id);assert.equal(f.state.overlays[0].color,'#aabbcc');near(f.state.overlays[0].w,1);near(f.state.overlays[0].h,1);assert.ok(f.messages.some(m=>m.includes('actual magnification is 2×')));f.close();
});
test('cross-tool hook runs once per local preview or ROI/calibration gesture, not per input',async()=>{
 const f=fixture();await roi(f);assert.equal(f.beforePreviews,1);const color=f.doc.querySelector('[data-inset-control="borderColor"]');for(const value of ['#112233','#445566','#778899']){color.value=value;color.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));}assert.equal(f.beforePreviews,2,'one shared-session cancellation at first paint only');color.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));color.value='#abcdef';color.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.beforePreviews,3);f.controller.cancel();await f.controller.startCalibration(f.source);assert.equal(f.beforePreviews,4);f.close();
});
test('one preview transaction survives repaint, escapes without history and change commits once',async()=>{
 const f=fixture();await roi(f);const color=f.doc.querySelector('[data-inset-control="borderColor"]'),count=f.commits.length;
 color.value='#ff0000';color.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.equal(f.state.overlays[0].color,'#ffffff');assert.equal(f.displayed.overlays[0].color,'#ff0000');f.controller.refresh();assert.equal(f.displayed.overlays[0].color,'#ff0000');assert.equal(f.commits.length,count);
 color.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.displayed.overlays[0].color,'#ffffff');assert.equal(f.commits.length,count);
 color.value='#112233';color.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));color.dispatchEvent(new f.dom.window.Event('change',{bubbles:true}));assert.equal(f.state.overlays[0].color,'#112233');assert.equal(f.commits.length,count+1);f.close();
});
test('same-ID state/project replacement and undo clear the old raw draft before Enter can reapply it',async()=>{
 const f=fixture();await roi(f);const width=f.doc.querySelector('[data-inset-control="borderWidth"]'),fire=type=>width.dispatchEvent(new f.dom.window.Event(type,{bubbles:true})),enter=()=>width.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})),count=f.commits.length,original=copy(f.state);
 width.value='2';fire('input');width.value='-';fire('input');const replacement=copy(f.state);replacement.overlays[0].stroke=1.5;f.setState(replacement);f.controller.refresh();assert.equal(width.value,'1.5');assert.equal(width.hasAttribute('aria-invalid'),false);assert.equal(f.displayed.overlays[0].stroke,1.5);enter();fire('blur');assert.equal(f.commits.length,count,'old invalid text cannot commit into the new same-ID state');
 width.value='3';fire('input');f.setProject(copy(f.project));f.controller.refresh();assert.equal(width.value,'1.5');enter();assert.equal(f.commits.length,count,'old valid preview cannot commit into a replacement project');assert.equal(f.displayed.overlays[0].stroke,1.5);
 width.value='4';fire('input');f.setState(original);f.controller.refresh();assert.equal(width.value,'1');enter();fire('change');fire('blur');assert.equal(f.commits.length,count,'undo replacement keeps its own value and history count');assert.equal(f.displayed.overlays[0].stroke,1);f.close();
});
test('cancel, blur, lost capture, second pointer and selection changes never create a partial inset',async()=>{
 for(const interrupt of [f=>f.doc.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})),f=>f.dom.window.dispatchEvent(new f.dom.window.Event('blur')),f=>f.pointer('pointercancel',300,300),f=>f.pointer('lostpointercapture',300,300),f=>f.pointer('pointerdown',300,300,{pointerId:2,isPrimary:false}),f=>{f.selected={};f.controller.refresh();}]){
  const f=fixture();f.viewport.style.cursor='grab';f.viewport.style.touchAction='pan-y';await f.controller.startROI(f.source);assert.equal(f.viewport.style.touchAction,'none');f.pointer('pointerdown',100,100);f.pointer('pointermove',300,300);interrupt(f);f.pointer('pointerup',300,300);assert.equal(f.commits.length,0);assert.equal(f.root.querySelector('[data-inset-gesture]'),null);assert.equal(f.viewport.style.cursor,'grab');assert.equal(f.viewport.style.touchAction,'pan-y');f.close();
 }
});
test('asynchronous decode rejects stale selection, project state and replaced DOM without late gestures',async()=>{
 for(const change of [f=>{f.selected={};},f=>f.setState(copy(f.state)),f=>f.image.replaceWith(f.image.cloneNode(true)),f=>f.controller.cancel()]){const f=fixture({delay:true}),pending=f.controller.startROI(f.source);change(f);f.resolve();assert.equal(await pending,false);f.pointer('pointerdown',100,100);f.pointer('pointerup',400,400);assert.equal(f.commits.length,0);f.close();}
});
test('calibration uses original horizontal pixel length, commits a physical scale and clamps saved bars',async()=>{
 const f=fixture();f.state.panels['panel-1'].scales={0:{e1:{length:200,calibration:900}}};await f.controller.startCalibration(f.source);f.pointer('pointerdown',950,736);f.pointer('pointerup',1150,750);assert.equal(f.commits.length,0);const dialog=f.doc.querySelector('dialog');assert.equal(dialog.open,true);assert.ok(dialog.textContent.includes('200.0 pixels'));
 const input=dialog.querySelector('input');input.value='20';dialog.querySelector('.primary').click();await Promise.resolve();await Promise.resolve();near(f.state.panels['panel-1'].imageCalibrations[0].e1,120);near(f.state.panels['panel-1'].scales[0].e1.length,96);assert.equal(dialog.open,false);assert.equal(f.commits.length,1);
 await roi(f);const scale=core.scaleInfo(f.state.overlays[0],{geometry:f.host.geometry(),calibration:120});near(scale.length/(f.state.overlays[0].w*600),scale.lengthUm/24);assert.deepEqual([...f.doc.querySelector('[data-inset-control="scaleLengthUm"]').options].slice(1).map(option=>+option.value),[2,5,10],'manual choices must be readable at the current physical display size');f.close();
});
test('calibration cancellation and stale selection do not attach measurements to another source',async()=>{
 const f=fixture();await f.controller.startCalibration(f.source);f.pointer('pointerdown',900,700);f.pointer('pointerup',1100,700);f.selected={};f.controller.refresh();const dialog=f.doc.querySelector('dialog');assert.equal(dialog.open,false);dialog.querySelector('input').value='20';dialog.querySelector('.primary').click();await Promise.resolve();assert.equal(f.commits.length,0);f.close();
});
test('locked objects, subpixel ROI, deletion and unavailable export preserve original source',async()=>{
 const f=fixture();f.selected={source:f.source,locked:true};assert.equal(await f.controller.startROI(f.source),false);f.selected={source:f.source,locked:false};await roi(f,2,[100,100],[100.1,101]);assert.equal(f.commits.length,0);await roi(f);const before=f.image.outerHTML;
 f.doc.querySelector('.inset-remove').click();assert.equal(f.state.overlays.length,0);assert.equal(f.image.outerHTML,before);f.selected={source:f.source,locked:false};await roi(f);f.image.remove();assert.equal(f.controller.exportReady(),false);assert.ok(f.messages.at(-1).includes('source'));f.close();
});
test('partial rectangular crop permits starting, but hidden pixels and calibration cannot be committed',async()=>{
 const f=fixture(),NS='http://www.w3.org/2000/svg',defs=f.doc.createElementNS(NS,'defs'),clip=f.doc.createElementNS(NS,'clipPath'),rect=f.doc.createElementNS(NS,'rect'),wrapper=f.doc.createElementNS(NS,'g');clip.id='crop';clip.setAttribute('clipPathUnits','userSpaceOnUse');for(const[k,v]of Object.entries({x:40,y:50,width:70,height:50}))rect.setAttribute(k,v);clip.append(rect);defs.append(clip);wrapper.setAttribute('clip-path','url(#crop)');wrapper.append(f.image.parentElement);f.root.append(defs,wrapper);
 assert.equal(await f.controller.startROI(f.source),true,'a partial crop does not disable all ROI gestures');f.pointer('pointerdown',96,96);f.pointer('pointerup',336,256);assert.equal(f.commits.length,1);
 const count=f.commits.length;await f.controller.startROI(f.source);f.pointer('pointerdown',100,100);f.pointer('pointerup',600,400);assert.equal(f.commits.length,count,'final sourceInfo rejects pixels hidden by the original clip');
 await f.controller.startCalibration(f.source);f.pointer('pointerdown',950,736);f.pointer('pointerup',1150,736);assert.equal(f.doc.querySelector('dialog').open,false);assert.equal(f.commits.length,count);f.close();
});
test('ROI redraw resets an oversized manual scale without changing true source calibration',async()=>{
 const f=fixture();f.state.panels['panel-1'].imageCalibrations={0:{e1:120}};const a=await roi(f);a.scaleLengthUm=15;
 assert.equal(await f.controller.startROI(f.source,a.id,2),true);f.pointer('pointerdown',96,96);f.pointer('pointerup',156,136);assert.equal(f.state.overlays[0].scaleLengthUm,undefined);near(f.state.panels['panel-1'].imageCalibrations[0].e1,120);assert.ok(f.messages.some(m=>m.includes('reset to Automatic')));assert.equal(f.controller.exportReady(),true);f.close();
});
test('an inset too small for its complete scale cannot silently export without that scale',async()=>{
 const f=fixture();f.state.panels['panel-1'].imageCalibrations={0:{e1:120}};await roi(f);f.state.overlays[0].w=.001;f.state.overlays[0].h=.001;assert.equal(f.controller.exportReady(),false);assert.ok(f.messages.at(-1).includes('too small'));f.state.overlays[0].showScale=false;assert.equal(f.controller.exportReady(),true);f.close();
});
test('English inline UI errors use the controller mapping and keep failed previews out of history',async()=>{
 const f=fixture();await roi(f);const count=f.commits.length;f.host.core.scaleInfo=()=>{throw Object.assign(Error('局部放大比例尺超出该区域的实际宽度。'),{code:'scale'});};const color=f.doc.querySelector('[data-inset-control="borderColor"]');color.value='#123456';color.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));assert.ok(f.doc.querySelector('#imageInsetsControls').textContent.includes('The scale bar exceeds the calibrated region.'));assert.equal(f.commits.length,count);assert.equal(f.state.overlays[0].color,'#ffffff');f.close();
});
test('quarter-turn ROI preserves display direction, aspect, DPI and original-axis calibration',async()=>{
 const f=fixture();f.image.setAttribute('transform','matrix(0 1 -1 0 800 0)');f.image.getScreenCTM=()=>({a:0,b:.5,c:-.5,d:0,e:450,f:70});
 await f.controller.startCalibration(f.source);f.pointer('pointerdown',64,950);f.pointer('pointerup',64,1150);const dialog=f.doc.querySelector('dialog');assert.equal(dialog.open,true);assert.ok(dialog.textContent.includes('200.0 pixels'));dialog.querySelector('input').value='20';dialog.querySelector('.primary').click();await Promise.resolve();await Promise.resolve();near(f.state.panels['panel-1'].imageCalibrations[0].e1,120);
 assert.equal(await f.controller.startROI(f.source,undefined,2),true);f.pointer('pointerdown',704,96);f.pointer('pointerup',544,336);const a=f.state.overlays[0];assert.equal(a.source.orientation,'rotate90');assert.deepEqual(a.roi,{x:.08,y:.12,w:.2,h:.2});near(a.w*600,80);near(a.h*400,120);near(core.quality(a,{geometry:f.host.geometry()}).effectiveDpi,144);near(core.scaleInfo(a,{geometry:f.host.geometry(),calibration:120}).physicalWidth,16);assert.equal(f.controller.exportReady(),true);f.doc.querySelector('[data-factor="3"]').click();near(f.state.overlays[0].w*600,120);near(f.state.overlays[0].h*400,180);f.close();
});
test('paper frame placement uses expanded/compacted display bounds while retaining source-space pixels',async()=>{
 for(const [frame,dx,dy]of [[{x:-160,y:-100,width:200,height:160},0,0],[{x:0,y:0,width:200,height:160},-100,-30],[{x:650,y:450,width:200,height:160},0,0]]){
  const f=fixture();try{
   f.host.geometry=()=>({width:600,height:400,dx,dy,frame});const before=f.image.outerHTML,a=await roi(f,2);assert.ok(a);assert.equal(a.documentCoordinates,true);const x=a.x*600+dx,y=a.y*400+dy;assert.ok(x>=frame.x-1e-7&&y>=frame.y-1e-7);assert.ok(x+a.w*600<=frame.x+frame.width+1e-7&&y+a.h*400<=frame.y+frame.height+1e-7);assert.equal(a.source.widthPx,1200);assert.deepEqual(a.roi,{x:.08,y:.12,w:.2,h:.2});assert.equal(f.image.outerHTML,before);assert.equal(f.controller.exportReady(),true);
  }finally{f.close();}
 }
});
(async()=>{for(const [name,run]of tests){await run();console.log('PASS '+name);}console.log(`${tests.length} image inset controller integration tests passed`);})().catch(error=>{console.error(error);process.exitCode=1;});
