'use strict';
/* Controlled pixel distributions + actual color engine/PreviewSession DOM.
 * No native image-quality, colorimetric calibration or Windows claim. */
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const Core=require('../skills/polish-sci-figures/assets/figure-studio/image-color.js');
const UI=require('../skills/polish-sci-figures/assets/figure-studio/image-color-ui.js');
const Sessions=require('../skills/polish-sci-figures/assets/figure-studio/preview-sessions.js');
const copy=v=>JSON.parse(JSON.stringify(v)),tick=(ms=35)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(predicate,label){const deadline=Date.now()+2000;while(!predicate()){if(Date.now()>deadline)throw Error('Timed out waiting for actual temporary SVG: '+label);await tick(10);}}
function sample({background=[230,225,220],gray=false,clipping=false,flat=false}={}){
 const width=96,height=80,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const border=x<10||y<10||x>=width-10||y>=height-10;
  let rgb=flat?[110,110,110]:border?background:gray?Array(3).fill(45+(x*3+y*2)%171):clipping?[254,254,254]:[50+(x*3)%170,45+(y*3)%160,55+(x+y)%155];
  if(gray&&border)rgb=[230,230,230];data.set([...rgb,255],(y*width+x)*4);
 }
 return Core.sample({width,height,data});
}
const tests=[],test=(name,fn)=>tests.push([name,fn]);
test('near-white spatial gate supports a mild global cast suggestion without editing source summaries',()=>{
 const s=sample(),before=JSON.stringify(s),a=Core.suggestAuto(s,{mode:'brightfield'}),b=Core.suggestAuto(s,{mode:'brightfield'});
 assert.deepEqual(a,b);assert.equal(a.evidence.whiteBalanceApplied,true);assert.equal(a.evidence.calibrated,false);assert.equal(a.evidence.backgroundEligible,true);assert.equal(a.adjustment.reference,undefined);assert.ok(a.adjustment.whiteBalance.every(v=>v>=.94&&v<=1.06));
 const mapped=Core.transform(s.background.rgb,a.adjustment),spread=rgb=>Math.max(...rgb)-Math.min(...rgb);assert.ok(spread(mapped)<spread(s.background.rgb),'known mild border cast is reduced by a single global mapping');assert.equal(JSON.stringify(s),before);assert.ok(a.evidence.newlyClippedChannelFraction<=.001);assert.ok(a.warnings.some(w=>w.code==='auto-display-only'));
});
test('gray remains neutral and absence of eligible white borders never enables invented white balance',()=>{
 for(const s of [sample({gray:true}),sample({background:[120,90,70]})]){
  const r=Core.suggestAuto(s,{mode:'brightfield'});assert.deepEqual(r.adjustment.whiteBalance,[1,1,1]);assert.equal(r.evidence.whiteBalanceApplied,false);assert.ok(r.warnings.some(w=>w.code==='auto-no-white-balance'));const c=Core.coefficients(r.adjustment);assert.equal(c.slopes[0],c.slopes[1]);assert.equal(c.slopes[1],c.slopes[2]);assert.ok(r.adjustment.exposureEv<=.12);assert.ok(r.adjustment.contrast<=1.1);for(const v of [.1,.3,.7]){const mapped=Core.transform([v,v,v],r.adjustment);assert.equal(mapped[0],mapped[1]);assert.equal(mapped[1],mapped[2]);}
 }
});
test('additional endpoint clipping reduces the whole proposal and is independently recomputable',()=>{
 const s=sample({background:[230,220,220],clipping:true}),r=Core.suggestAuto(s,{mode:'brightfield'});assert.equal(r.evidence.strengthReduced,true);assert.ok(r.adjustment.strength<1);assert.ok(r.evidence.newlyClippedChannelFraction<=.001);assert.equal(Core.estimateClipping(s,r.adjustment).additionalClippedFraction,r.evidence.newlyClippedChannelFraction);assert.deepEqual(Core.validate(r.adjustment),r.adjustment);
});
test('explicit photo purpose is required; fluorescence, flat displays and invalid summaries refuse suggestions',()=>{
 for(const mode of [undefined,'fluorescence','automatic-modality'])assert.throws(()=>Core.suggestAuto(sample(),{mode}),e=>e.code==='auto-mode');assert.throws(()=>Core.suggestAuto(sample({flat:true}),{mode:'brightfield'}),e=>e.code==='auto-flat');assert.throws(()=>Core.suggestAuto({...sample(),count:0},{mode:'brightfield'}));
});
function fixture({inputSample=sample(),delayed=false}={}){
 const dom=new JSDOM('<!doctype html><html><head></head><body><aside><div id="controls"></div></aside><button id="focus">Focus</button><svg xmlns="http://www.w3.org/2000/svg"><image id="image" width="120" height="80"/></svg></body></html>',{pretendToBeVisual:true});
 const doc=dom.window.document,$=s=>doc.querySelector(s),image=$('#image'),root=image.ownerSVGElement;
 const href='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFhkAAAAASUVORK5CYII=';image.setAttribute('href',href);
 const source={panelId:'panel-1',variant:0,key:'e1',selected:true,locked:false};let state={adjustment:null},project={},commits=[],previews=[],analyses=[],pending=[],language='en';
 const manager=Sessions.create({identity:()=>[project,state,UI.identity(source)]});
 const paint=adjustment=>{if(adjustment)Core.apply(image,adjustment,{root,id:'actual-display'});else Core.clear(image,{root});};
 const engine={...Core,analyze:(value,options)=>{assert.equal(value,href);analyses.push({value,options});return delayed?new Promise(resolve=>pending.push(()=>resolve(inputSample))):Promise.resolve(inputSample);}};
 const ui=UI.create({document:doc,container:$('aside'),core:engine,previewSessions:manager,language:()=>language,selection:()=>({source,locked:false}),sources:()=>[source],resolve:()=>image,current:()=>state.adjustment,
  preview:entries=>{previews.push(copy(entries));paint(entries[0]?.adjustment||null);},clearPreview:()=>paint(state.adjustment),commit:entries=>{commits.push(copy(entries));state={adjustment:copy(entries[0].adjustment)};paint(state.adjustment);return true;}});
 const control=name=>$('[data-color="'+name+'"]'),number=name=>$('[data-color-number="'+name+'"]'),fire=(node,type)=>node.dispatchEvent(new dom.window.Event(type,{bubbles:true,cancelable:true}));
 return {dom,$,ui,control,number,fire,image,root,href,get state(){return state;},get commits(){return commits;},get previews(){return previews;},get analyses(){return analyses;},release:()=>pending.splice(0).forEach(fn=>fn()),setLanguage:value=>{language=value;ui.refresh();},close:()=>{ui.destroy();dom.window.close();}};
}
test('one photo and no reference can auto-preview actual SVG coefficients, then cancel exactly',async()=>{const f=fixture();try{
 const originalState=copy(f.state),source=f.image.getAttribute('href');f.ui.open();await tick();assert.equal(f.control('reference').closest('.color-wide').hidden,true);assert.equal(f.control('auto').disabled,false);const calls=f.analyses.length;assert.equal(await f.ui.auto(),true);await until(()=>Core.inspect(f.image,f.root)?.whiteBalance.some(v=>v!==1),'automatic white-balance coefficients');assert.equal(f.analyses.length,calls,'reuse the existing bounded source sample, not a reference or second fetch');assert.equal(f.commits.length,0);assert.equal(f.control('autoNote').hidden,false);assert.match(f.control('autoNote').textContent,/not colorimetric/);assert.equal(f.image.getAttribute('href'),source);f.control('cancel').click();assert.deepEqual(f.state,originalState);assert.equal(Core.inspect(f.image,f.root),null);assert.equal(f.image.getAttribute('href'),source);
 }finally{f.close();}});
test('manual refinement preserves exact proposal parameters; Apply commits once and saved values round-trip',async()=>{const f=fixture();try{
 await f.ui.auto();await until(()=>Core.inspect(f.image,f.root)?.whiteBalance.some(v=>v!==1),'automatic parameters before refinement');const automatic=Core.inspect(f.image,f.root);f.number('temperature').value='.2';f.fire(f.number('temperature'),'input');await until(()=>Core.inspect(f.image,f.root)?.temperature===.2,'manual refinement');const refined=Core.inspect(f.image,f.root);assert.deepEqual(refined.whiteBalance,automatic.whiteBalance);assert.equal(refined.exposureEv,automatic.exposureEv);assert.match(f.control('autoNote').textContent,/refined manually/);f.control('apply').click();f.control('apply').click();await until(()=>f.commits.length===1,'one Apply');assert.deepEqual(f.state.adjustment,refined);assert.equal(f.image.getAttribute('href'),f.href);f.ui.open();await tick();assert.equal(f.number('temperature').value,'0.2');f.control('cancel').click();assert.deepEqual(Core.inspect(f.image,f.root),refined);
 }finally{f.close();}});
test('fluorescence disables auto balancing while retaining manual identical-channel display controls',async()=>{const f=fixture();try{
 f.ui.open();await tick();f.control('mode').value='fluorescence';f.fire(f.control('mode'),'change');await until(()=>Core.inspect(f.image,f.root)?.mode==='fluorescence','explicit fluorescence mode');assert.equal(f.control('auto').disabled,true);const count=f.analyses.length;assert.equal(await f.ui.auto(),false);assert.equal(f.analyses.length,count);f.number('exposureEv').value='.2';f.fire(f.number('exposureEv'),'input');await until(()=>Core.inspect(f.image,f.root)?.exposureEv===.2,'shared fluorescence exposure');const adjustment=Core.inspect(f.image,f.root);assert.equal(adjustment.mode,'fluorescence');assert.deepEqual(adjustment.whiteBalance,[1,1,1]);assert.equal(adjustment.temperature,0);assert.equal(adjustment.tint,0);assert.equal(f.commits.length,0);
 }finally{f.close();}});
test('no-background note is explicit, bilingual, and reports no inferred calibrated white point',async()=>{const input=sample({background:[120,90,70]}),f=fixture({inputSample:input});try{
 assert.equal(await f.ui.auto(),true);const expected=Core.suggestAuto(input,{mode:'brightfield'}).adjustment;await until(()=>JSON.stringify(Core.inspect(f.image,f.root))===JSON.stringify(expected),'global suggestion without a white background');assert.match(f.control('autoNote').textContent,/White balance was not adjusted/);assert.deepEqual(Core.inspect(f.image,f.root).whiteBalance,[1,1,1]);f.setLanguage('zh-CN');assert.equal(f.control('auto').textContent,'一键校色（拍摄照片）');assert.match(f.control('autoNote').textContent,/未调整白平衡/);assert.equal(f.commits.length,0);
 }finally{f.close();}});
test('flat-sample refusal preserves prior display and still permits manual correction',async()=>{const f=fixture({inputSample:sample({flat:true})});try{
 f.ui.open();await tick();f.number('contrast').value='1.05';f.fire(f.number('contrast'),'input');await until(()=>Core.inspect(f.image,f.root)?.contrast===1.05,'prior manual contrast');const before=Core.inspect(f.image,f.root);assert.equal(await f.ui.auto(),false);await tick();assert.deepEqual(Core.inspect(f.image,f.root),before);assert.match(f.$('.color-error').textContent,/too little display variation/);assert.equal(f.number('contrast').disabled,false);assert.equal(f.commits.length,0);
 }finally{f.close();}});
test('cancelled async auto analysis never paints or commits late results',async()=>{const f=fixture({delayed:true});try{
 const run=f.ui.auto();await tick();const analyses=f.analyses.slice(),beforeCancel=f.previews.length;assert.ok(analyses.length>=1);f.ui.cancel();assert.equal(analyses.at(-1).options.signal.aborted,true);f.release();assert.equal(await run,false);await tick();assert.equal(f.previews.length,beforeCancel,'late analysis may not add another temporary paint after cancellation');assert.equal(f.commits.length,0);assert.equal(Core.inspect(f.image,f.root),null);assert.equal(f.image.getAttribute('href'),f.href);
 }finally{f.close();}});
(async()=>{for(const [name,fn]of tests){await fn();console.log('PASS '+name);}console.log(tests.length+' controlled auto-color groups passed; no colorimetric/native photo accuracy claim');})().catch(error=>{console.error(error);process.exitCode=1;});
