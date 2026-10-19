'use strict';
/* Controlled detector and raster placeholders test UI lifecycles only.
 * The production quad/output planner and PreviewSessions are used unchanged.
 * No actual image detection, pixel correctness or accuracy claim is made. */
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const UI=require('../skills/polish-sci-figures/assets/figure-studio/image-rectify-ui.js');
const Sessions=require('../skills/polish-sci-figures/assets/figure-studio/preview-sessions.js');
const Geometry=require('../skills/polish-sci-figures/assets/figure-studio/image-rectify.js');
const copy=x=>JSON.parse(JSON.stringify(x)),tick=(ms=30)=>new Promise(r=>setTimeout(r,ms));
const A=[{x:60,y:40},{x:1140,y:60},{x:1120,y:750},{x:80,y:730}],B=[{x:200,y:100},{x:1000,y:120},{x:980,y:650},{x:220,y:670}];
function fixture(){
 const dom=new JSDOM('<!doctype html><body><aside><div id="controls"></div></aside><svg xmlns="http://www.w3.org/2000/svg"><image id="source" href="data:image/png;base64,c291cmNl"/></svg><div id="canvas">COMMITTED</div></body>',{pretendToBeVisual:true});
 const doc=dom.window.document,$=q=>doc.querySelector(q),source={panelId:'p1',variant:0,key:'im1'},href=$('#source').getAttribute('href');
 let project={},state={value:'committed'},fingerprint=null,settings=null,locked=false;
 const detectorCalls=[],rasterCalls=[],paints=[],commits=[],validations=[],messages=[];
 const result=(candidates=[A,B])=>({sourceWidth:1200,sourceHeight:800,candidates:candidates.map((corners,i)=>({id:'controlled-'+i,corners:copy(corners),score:1-i*.1,manualConfirmationRequired:true})),audit:{schema:'figure-studio-rectification-suggestions/1',method:'controlled-lifecycle-fixture',physicalRatioInferred:false,semanticContentIdentified:false}});
 const detector={detect:(sourceHref,options)=>new Promise((resolve,reject)=>{assert.equal(sourceHref,href);detectorCalls.push({options,resolve,reject});})};
 const core={validateQuad(points,size){validations.push(copy(points));return Geometry.validateQuad(points,size);},outputSize:Geometry.outputSize,
  rectify:async(sourceHref,options)=>{assert.equal(sourceHref,href);rasterCalls.push({options});const scale=options.previewMaxSide?Math.min(1,options.previewMaxSide/Math.max(options.width,options.height)):1;return {href:'data:image/png;base64,Y29udHJvbGxlZC1yYXN0ZXI=',width:Math.max(1,Math.round(options.width*scale)),height:Math.max(1,Math.round(options.height*scale)),sourceWidth:1200,sourceHeight:800,audit:{schema:'controlled-ui-raster/1',notActualPixels:true}};}};
 const manager=Sessions.create({identity:()=>[project,state,UI.identity(source)]});
 const host={document:doc,container:$('#controls'),detector,core,geometry:{dimensionsFromHref:()=>({widthPx:1200,heightPx:800})},previewSessions:manager,language:()=> 'en',selection:()=>({source,locked}),sources:()=>[{...source,locked}],resolve:()=>$('#source'),current:()=>fingerprint,settings:()=>settings,
  preview:(r,meta)=>{paints.push({result:r,meta});$('#canvas').textContent='PREVIEW '+meta.corners[0].x;},clearPreview:()=>{$('#canvas').textContent='COMMITTED';},
  commit:(r,label,meta)=>{commits.push({result:r,label,meta});state={value:'corrected'};return true;},say:m=>messages.push(m)};
 const ui=UI.create(host),control=n=>$('[data-rectify="'+n+'"]'),coord=n=>$('[data-rectify-coordinate="'+n+'"]');
 const fire=(n,type)=>n.dispatchEvent(new dom.window.Event(type,{bubbles:true,cancelable:true}));
 return {dom,doc,$,ui,host,control,coord,fire,detectorCalls,rasterCalls,paints,commits,validations,messages,href,result,
  input:(n,value)=>{n.value=value;fire(n,'input');},finish:(i,candidates)=>detectorCalls[i].resolve(result(candidates)),
  changeSource:()=>{$('#source').setAttribute('href',href+'changed');ui.refresh();},
  replaceOwner:()=>{project={};manager.sync();},saved:()=>JSON.stringify({project,state}),
  withSettings:value=>settings=value,close:()=>{ui.destroy();dom.window.close();}};
}
const tests=[],test=(name,work)=>tests.push([name,work]);
test('first open detects once, validates actual quad geometry, then creates only a real-manager draft',async()=>{
 const f=fixture();try{const baseline=f.saved();assert.equal(f.ui.open(),true);assert.equal(f.detectorCalls.length,1);assert.equal(f.ui.dialog.dataset.state,'detecting');assert.equal(f.rasterCalls.length,0);assert.equal(f.control('apply').disabled,true);assert.equal(f.detectorCalls[0].options.maxSide,640);
  f.finish(0);await tick();assert.equal(f.rasterCalls.length,1);assert.deepEqual(f.rasterCalls[0].options.corners,A);assert.ok(f.validations.length>=3);assert.equal(f.paints.length,1);assert.equal(f.ui.dialog.dataset.state,'previewing');assert.equal(f.control('apply').disabled,false);assert.equal(f.control('outlines').options.length,2);assert.equal(f.control('outlines').hidden,false);assert.match(f.control('autoNote').textContent,/Suggested from photo edges/);assert.equal(f.paints[0].meta.detection.candidateIndex,0);assert.equal(f.paints[0].meta.detection.manuallyRefined,false);assert.equal(f.commits.length,0);assert.equal(f.saved(),baseline);
 }finally{f.close();}
});
test('cancel aborts detection and ignores a detector that disregards its signal and resolves late',async()=>{
 const f=fixture();try{const baseline=f.saved();f.ui.open();const signal=f.detectorCalls[0].options.signal;f.control('cancel').click();assert.equal(signal.aborted,true);f.finish(0);await tick();assert.equal(f.ui.dialog.hidden,true);assert.equal(f.rasterCalls.length,0);assert.equal(f.paints.length,0);assert.equal(f.commits.length,0);assert.equal(f.$('#canvas').textContent,'COMMITTED');assert.equal(f.saved(),baseline);assert.equal(f.$('#source').getAttribute('href'),f.href);
 }finally{f.close();}
});
test('source or owner changes invalidate pending detection without late preview or history',async()=>{
 for(const method of ['changeSource','replaceOwner']){const f=fixture();try{f.ui.open();f[method]();assert.equal(f.detectorCalls[0].options.signal.aborted,true);f.finish(0);await tick();assert.equal(f.ui.dialog.hidden,true,method);assert.equal(f.rasterCalls.length,0,method);assert.equal(f.paints.length,0,method);assert.equal(f.commits.length,0,method);}finally{f.close();}}
});
test('manual coordinate input aborts detection; its late result cannot replace the actual edited quad',async()=>{
 const f=fixture();try{const baseline=f.saved();f.ui.open();f.input(f.coord('0-x'),'35');assert.equal(f.detectorCalls[0].options.signal.aborted,true);f.finish(0);await tick(290);assert.equal(f.coord('0-x').value,'35');assert.equal(f.rasterCalls.length,1);assert.equal(f.rasterCalls[0].options.corners[0].x,35);assert.equal(f.paints[0].meta.detection,null);assert.equal(f.commits.length,0);assert.equal(f.saved(),baseline);
 }finally{f.close();}
});
test('reopened session accepts its own newest detection and rejects the previous session result',async()=>{
 const f=fixture();try{f.ui.open();f.ui.open();assert.equal(f.detectorCalls.length,2);assert.equal(f.detectorCalls[0].options.signal.aborted,true);f.finish(1,[B]);await tick();assert.equal(f.coord('0-x').value,String(B[0].x));f.finish(0,[A]);await tick();assert.equal(f.coord('0-x').value,String(B[0].x));assert.equal(f.rasterCalls.length,1);assert.deepEqual(f.paints[0].meta.corners,B);assert.equal(f.commits.length,0);
 }finally{f.close();}
});
test('candidate switch remains editable and full-resolution Keep commits exactly once with refined provenance',async()=>{
 const f=fixture();try{f.ui.open();f.finish(0);await tick();f.control('outlines').value='1';f.fire(f.control('outlines'),'change');await tick();assert.deepEqual(f.paints.at(-1).meta.corners,B);assert.equal(f.paints.at(-1).meta.detection.candidateIndex,1);f.input(f.coord('0-x'),'201');await tick(290);assert.equal(f.paints.at(-1).meta.corners[0].x,201);assert.equal(f.paints.at(-1).meta.detection.manuallyRefined,true);assert.match(f.control('autoNote').textContent,/manually refined/);assert.equal(f.commits.length,0);
  f.control('apply').click();f.control('apply').click();await tick(50);assert.equal(f.commits.length,1);assert.equal(f.rasterCalls.at(-1).options.previewMaxSide,undefined);assert.equal(f.commits[0].meta.fullResolution,true);assert.equal(f.commits[0].meta.originalHref,f.href);assert.equal(f.commits[0].meta.detection.candidateIndex,1);assert.equal(f.commits[0].meta.detection.manuallyRefined,true);assert.equal(f.ui.dialog.hidden,true);assert.equal(f.$('#source').getAttribute('href'),f.href);
 }finally{f.close();}
});
test('empty detector result explicitly requests manual corners without pretending it found an outline',async()=>{
 const f=fixture();try{f.ui.open();f.finish(0,[]);await tick();assert.match(f.control('autoNote').textContent,/No sufficiently supported.*Select the area/);assert.equal(f.control('outlines').options.length,0);assert.equal(f.control('outlines').hidden,true);assert.equal(f.rasterCalls.length,1,'The unchanged full frame is only an editable manual draft');assert.equal(f.paints[0].meta.detection,null);assert.equal(f.commits.length,0);f.input(f.coord('0-x'),'25');await tick(290);assert.equal(f.paints.at(-1).meta.corners[0].x,25);assert.equal(f.commits.length,0);
 }finally{f.close();}
});
test('production quad validator rejects crossed detector corners before any raster or Keep',async()=>{
 const f=fixture();try{f.ui.open();const crossed=[{x:0,y:0},{x:1200,y:800},{x:1200,y:0},{x:0,y:800}];f.finish(0,[crossed]);await tick();assert.equal(f.rasterCalls.length,0);assert.equal(f.control('apply').disabled,true);assert.equal(f.ui.dialog.dataset.state,'error');assert.match(f.control('autoNote').textContent,/Select the area/);assert.equal(f.commits.length,0);assert.equal(f.$('#canvas').textContent,'COMMITTED');
 }finally{f.close();}
});
test('saved raw-source settings reopen without implicit detection or replacing their coordinates',async()=>{
 const f=fixture();try{f.withSettings({corners:copy(A),outputWidth:900,outputHeight:600,ratioMode:'custom',ratioValue:1.5,estimatedRatio:false});f.ui.open();await tick();assert.equal(f.detectorCalls.length,0);assert.equal(f.rasterCalls.length,1);assert.deepEqual(f.rasterCalls[0].options.corners,A);assert.equal(f.control('width').value,'900');assert.equal(f.control('ratio').value,'custom');assert.equal(f.commits.length,0);f.control('auto').click();assert.equal(f.detectorCalls.length,1,'An explicit Auto may replace a saved suggestion with a new draft');f.control('cancel').click();f.finish(0);await tick();assert.equal(f.commits.length,0);
 }finally{f.close();}
});
(async()=>{for(const [name,work]of tests){await work();console.log('PASS '+name);}console.log(tests.length+' controlled automatic-rectify UI groups passed; no detector/pixel accuracy claim');})().catch(error=>{console.error(error);process.exitCode=1;});
