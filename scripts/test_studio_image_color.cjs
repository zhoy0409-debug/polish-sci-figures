'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const modulePath='../skills/polish-sci-figures/assets/figure-studio/image-color.js',color=require(modulePath);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
function pixels(w,h,rgb=[230,230,230]){const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4)data.set([...rgb,255],i);return {width:w,height:h,data};}
test('identity and zero strength retain source values exactly; adjustment records reject unknown inputs',()=>{
  const rgb=[.1,.3,.8];color.transform(rgb,{mode:'brightfield'}).forEach((v,i)=>close(v,rgb[i]));
  color.transform(rgb,{strength:0,exposureEv:2,temperature:1,tint:1,contrast:1.5,whiteBalance:[2,.5,1]}).forEach((v,i)=>close(v,rgb[i]));
  for(const bad of [{strength:2},{exposureEv:Infinity},{tint:1.001},{tint:-1.001},{tint:NaN},{tint:'0.2'},{whiteBalance:[1,1]},{mode:'tissue-normalization'},{href:'private'},{reference:'\nsecret'}])assert.throws(()=>color.validate(bad));
});
test('fluorescence uses identical linear coefficients for every channel and rejects white balance',()=>{
  const c=color.coefficients({mode:'fluorescence',exposureEv:1,contrast:1.2});assert.deepEqual(c.slopes,[2.4,2.4,2.4]);close(c.intercept,-.036);
  assert.throws(()=>color.validate({mode:'fluorescence',whiteBalance:[1,.99,1]}));assert.throws(()=>color.validate({mode:'fluorescence',temperature:.1}));
  for(const tint of [-.01,.01])assert.throws(()=>color.validate({mode:'fluorescence',tint}),/荧光/);
  assert.deepEqual(color.coefficients({mode:'fluorescence',exposureEv:1,contrast:1.2,tint:0}),c);
});
test('green-to-magenta tint is a mild whole-image linear gain and preserves zero-tint saved records',()=>{
  const magenta=color.coefficients({tint:1}),green=color.coefficients({tint:-1});
  assert.equal(magenta.slopes[0],magenta.slopes[2]);assert.ok(magenta.slopes[0]>1&&magenta.slopes[1]<1);
  for(let i=0;i<3;i++)close(magenta.slopes[i]*green.slopes[i],1);
  close(magenta.slopes[0]/magenta.slopes[1],2**.3);assert.equal(magenta.intercept,0);
  const old={mode:'brightfield',strength:.6,exposureEv:.2,temperature:-.3,contrast:1.1,whiteBalance:[1.02,1,.98],reference:'old-image'};
  assert.equal(color.validate(JSON.parse(JSON.stringify(old))).tint,0);
  const expected=old.whiteBalance.map((v,i)=>1+old.strength*(2**old.exposureEv*v*[2**(.2*old.temperature),1,2**(-.2*old.temperature)][i]*old.contrast-1));
  assert.deepEqual(color.coefficients(old).slopes,expected);
});
test('mild background proposal matches background, not tissue distribution, and records its limitation',()=>{
  const a=pixels(100,80,[230,225,220]),b=pixels(100,80,[228,228,228]);
  // Different central tissue does not enter the near-white border estimate.
  for(let y=20;y<60;y++)for(let x=20;x<80;x++){a.data.set([90,20,80,255],(y*100+x)*4);b.data.set([5,40,120,255],(y*100+x)*4);}
  const target=color.sample(a),reference=color.sample(b),suggestion=color.suggest(target,reference);
  assert.equal(target.background.eligible,true);assert.equal(suggestion.warnings[0].code,'estimated-background');
  const mapped=color.transform([230,225,220].map(v=>v/255),suggestion.adjustment);mapped.forEach(v=>close(v,228/255));
  assert.equal(suggestion.adjustment.contrast,1);assert.equal(suggestion.adjustment.temperature,0);
});
test('colored tissue, isolated pale patches, clipped whites and missing opacity do not become reference backgrounds',()=>{
  const reference=color.sample(pixels(80,80,[230,230,230]));
  for(const rgb of [[100,70,100],[255,255,255],[230,170,230]])assert.throws(()=>color.suggest(color.sample(pixels(80,80,rgb)),reference),/近白背景/);
  const patch=pixels(80,80,[90,40,90]);for(let x=0;x<80;x++)patch.data.set([230,230,230,255],x*4);
  assert.equal(color.sample(patch).background.eligible,false);
  const transparent=pixels(10,10);for(let i=3;i<transparent.data.length;i+=4)transparent.data[i]=0;assert.throws(()=>color.sample(transparent),/不透明/);
});
test('clipping estimates are based on channel counts and do not conceal saturated detail',()=>{
  const sample=color.sample(pixels(40,40,[230,100,10]));
  const identity=color.estimateClipping(sample,{});assert.equal(identity.additionalClippedFraction,0);
  const result=color.estimateClipping(sample,{exposureEv:2});close(result.additionalClippedFraction,1/3);assert.equal(result.warnings[0].code,'clipping');
  assert.throws(()=>color.estimateClipping({...sample,count:10},{}),/摘要/);
});
test('background estimate refuses large corrections and sampling is bounded',()=>{
  assert.throws(()=>color.suggest(color.sample(pixels(40,40,[204,204,204])),color.sample(pixels(40,40,[251,251,251]))),/差异较大/);
  assert.throws(()=>color.sample(pixels(385,1)),/尺寸/);
});
test('browser analysis stays local, serial, bounded, cancellable and releases decoded image resources',async()=>{
  let active=0,peak=0,released=0;const scheduled=[],raw=pixels(32,32);
  class FakeImage{
    constructor(){this.naturalWidth=this.naturalHeight=32;}
    set src(value){if(!value){released++;return;}assert.equal(value,'data:test');active++;peak=Math.max(peak,active);scheduled.push(()=>{active--;this.onload?.();});}
  }
  const context={Image:FakeImage,document:{createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){},getImageData:()=>raw})})},StudioImageInsets:{dimensionsFromHref(href){if(href!=='data:test')throw Error('Only embedded data');return {widthPx:32,heightPx:32};}},setTimeout,clearTimeout,console};
  vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve(modulePath),'utf8')+'\nglobalThis.api=StudioImageColor;',context);
  const api=context.api,first=api.analyze('data:test'),controller=new AbortController(),cancelled=api.analyze('data:test',{signal:controller.signal});
  const cancellation=assert.rejects(cancelled,{name:'AbortError'});controller.abort();
  await new Promise(setImmediate);assert.equal(scheduled.length,1);scheduled.shift()();await first;await cancellation;assert.equal(peak,1);assert.equal(released,1);
  await assert.rejects(api.analyze('https://example.invalid/private.png'),/embedded/);
});

if(process.argv.includes('--dom')){
  const {JSDOM}=require('jsdom');
  const fixture=()=>new JSDOM('<svg xmlns="http://www.w3.org/2000/svg"><image id="source" href="data:image/png;base64,iVBORw0KGgo=" x="3" y="4" width="120" height="80"/></svg>',{contentType:'image/svg+xml'}).window.document;
  test('SVG filter changes display only, can be strictly inspected and restores original raster',()=>{
    const doc=fixture(),root=doc.documentElement,image=root.querySelector('image'),before=image.outerHTML;
    const a=color.validate({exposureEv:.2,temperature:.1,reference:'reference-panel'}),filter=color.apply(image,a,{root,id:'display1'});
    assert.deepEqual(color.inspect(image,root),a);assert.equal(filter.getAttribute('color-interpolation-filters'),'linearRGB');
    assert.equal(filter.querySelector('feFuncA').getAttribute('type'),'identity');assert.equal(image.getAttribute('href'),'data:image/png;base64,iVBORw0KGgo=');
    assert.equal(color.clear(image,{root}),true);assert.equal(image.outerHTML,before);assert.equal(root.querySelectorAll('filter').length,0);
  });
  test('changing display does not stack filters or affect other images sharing an imported definition',()=>{
    const doc=fixture(),root=doc.documentElement,image=root.querySelector('image');color.apply(image,{exposureEv:.2},{root,id:'shared'});
    const copy=image.cloneNode(true);copy.id='other';root.append(copy);
    color.apply(image,{exposureEv:.5},{root,id:'shared'});assert.equal(color.inspect(copy,root).exposureEv,.2);assert.equal(color.inspect(image,root).exposureEv,.5);
    color.apply(image,{exposureEv:.7},{root,id:'shared'});assert.equal(root.querySelectorAll('filter').length,2);assert.equal(color.inspect(copy,root).exposureEv,.2);
  });
  test('validated live-image source cache never permits a changed href or modified filter',()=>{
    const doc=fixture(),root=doc.documentElement,image=root.querySelector('image'),href=image.getAttribute('href');
    color.apply(image,{exposureEv:.1},{root,id:'cached'});color.apply(image,{exposureEv:.2},{root,id:'cached'});
    image.setAttribute('href','https://example.invalid/changed.png');assert.throws(()=>color.apply(image,{exposureEv:.3},{root,id:'cached'}),/嵌入/);
    image.setAttribute('href','data:image/png;base64,not-valid!');assert.throws(()=>color.apply(image,{exposureEv:.3},{root,id:'cached'}),/嵌入/);
    image.setAttribute('href',href);root.querySelector('feFuncR').setAttribute('slope','123');assert.throws(()=>color.apply(image,{exposureEv:.3},{root,id:'cached'}),/参数/);
    assert.equal(image.getAttribute('href'),href);
  });
  test('forged marker, changed coefficients, external filter and ancestor effects are rejected',()=>{
    for(const mutate of [f=>f.querySelector('feFuncR').setAttribute('slope','7'),f=>f.append(f.ownerDocument.createElementNS('http://www.w3.org/2000/svg','feTurbulence')),f=>f.setAttribute('style','filter:blur(1px)')]){
      const doc=fixture(),root=doc.documentElement,image=root.querySelector('image'),filter=color.apply(image,{},{root});mutate(filter);assert.throws(()=>color.inspect(image,root),/滤镜/);
    }
    const doc=fixture(),root=doc.documentElement,image=root.querySelector('image');image.setAttribute('filter','url(https://example.invalid/a.svg#f)');assert.throws(()=>color.apply(image,{},{root}),/滤镜/);
    image.removeAttribute('filter');root.setAttribute('filter','blur(2px)');assert.throws(()=>color.apply(image,{},{root}),/滤镜/);
    root.removeAttribute('filter');image.setAttribute('href','https://example.invalid/remote.png');assert.throws(()=>color.apply(image,{},{root}),/嵌入/);
    const styled=fixture(),style=styled.createElementNS(root.namespaceURI,'style');style.textContent='image{filter:blur(2px)}';styled.documentElement.prepend(style);
    // Browser engines report stylesheet filters even when the image has no attribute.
    styled.defaultView.getComputedStyle=()=>({getPropertyValue:()=> 'blur(2px)'});assert.throws(()=>color.apply(styled.querySelector('image'),{},{root:styled.documentElement}),/滤镜/);
  });
  test('nested inset SVG can reproduce the same verified adjustment while retaining raw pixels',()=>{
    const doc=fixture(),root=doc.documentElement,image=root.querySelector('image');color.apply(image,{exposureEv:.3,tint:.45,whiteBalance:[1.03,1,.97]},{root});
    const svg=doc.createElementNS(root.namespaceURI,'svg'),crop=image.cloneNode(true);crop.removeAttribute('filter');crop.removeAttribute('data-studio-image-color');svg.append(crop);root.append(svg);
    color.apply(crop,color.inspect(image,root),{root:svg,id:'inset-color'});assert.deepEqual(color.inspect(crop,svg),color.inspect(image,root));assert.equal(crop.getAttribute('href'),image.getAttribute('href'));
  });
  test('old saved SVG filters without tint still verify, update and round-trip without losing original pixels',()=>{
    const doc=fixture(),root=doc.documentElement,image=root.querySelector('image'),raw=image.getAttribute('href');
    const legacy={mode:'brightfield',strength:.7,exposureEv:.2,temperature:.1,contrast:1.2,whiteBalance:[1.01,1,.99],reference:'old-reference'};
    const filter=color.apply(image,legacy,{root,id:'legacy-color'}),serialized=JSON.stringify(legacy);
    // This is the exact pre-tint metadata; its coefficients are unchanged.
    image.setAttribute('data-studio-image-color',serialized);filter.setAttribute('data-studio-image-color',serialized);
    const restored=new JSDOM(root.outerHTML,{contentType:'image/svg+xml'}).window.document,restoredRoot=restored.documentElement,restoredImage=restoredRoot.querySelector('image');
    const inspected=color.inspect(restoredImage,restoredRoot);assert.equal(inspected.tint,0);assert.equal(inspected.reference,'old-reference');
    color.apply(restoredImage,{...inspected,tint:-.4},{root:restoredRoot,id:'updated-color'});
    const again=new JSDOM(restoredRoot.outerHTML,{contentType:'image/svg+xml'}).window.document,againImage=again.querySelector('image');
    assert.equal(color.inspect(againImage,again.documentElement).tint,-.4);assert.equal(againImage.getAttribute('href'),raw);
    color.clear(againImage,{root:again.documentElement});assert.equal(againImage.getAttribute('href'),raw);assert.equal(again.querySelectorAll('filter').length,0);
    filter.querySelector('feFuncG').setAttribute('slope','1.234');assert.throws(()=>color.inspect(image,root),/参数/);
  });
}
