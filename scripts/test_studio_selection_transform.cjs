'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const path='../skills/polish-sci-figures/assets/figure-studio/selection-transform.js',geometry=require(path);
let passed=0;
const close=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<=tol*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
function samePoint(actual,expected){close(actual.x,expected.x);close(actual.y,expected.y);}
function sameBounds(actual,expected){for(const key of ['x','y','width','height'])close(actual[key],expected[key]);}
function test(name,run){run();passed++;console.log('PASS '+name);}
const box={x:10,y:20,width:100,height:50};
test('all eight handles preserve the opposite anchor and map the original box',()=>{
  const cases={nw:[{x:-40,y:-5},{x:-40,y:-5,width:150,height:75}],n:[{x:60,y:-5},{x:10,y:-5,width:100,height:75}],ne:[{x:160,y:-5},{x:10,y:-5,width:150,height:75}],e:[{x:160,y:45},{x:10,y:20,width:150,height:50}],se:[{x:160,y:95},{x:10,y:20,width:150,height:75}],s:[{x:60,y:95},{x:10,y:20,width:100,height:75}],sw:[{x:-40,y:95},{x:-40,y:20,width:150,height:75}],w:[{x:-40,y:45},{x:-40,y:20,width:150,height:50}]};
  for(const [handle,[pointer,expected]]of Object.entries(cases)){
    const result=geometry.resizeBox(box,handle,pointer);sameBounds(result.bounds,expected);samePoint(geometry.applyPoint(result.matrix,result.anchor),result.anchor);samePoint(geometry.applyPoint(result.matrix,{x:box.x,y:box.y}),{x:expected.x,y:expected.y});samePoint(geometry.applyPoint(result.matrix,{x:box.x+box.width,y:box.y+box.height}),{x:expected.x+expected.width,y:expected.y+expected.height});assert.equal(result.clamped,false);
  }
});
test('corner aspect projection is nearest to an off-ratio pointer',()=>{
  const result=geometry.resizeBox({x:0,y:0,width:100,height:50},'se',{x:200,y:80});close(result.scaleX,1.92);close(result.scaleY,1.92);samePoint(result.point,{x:192,y:96});
  // The residual is perpendicular to the allowed aspect-preserving diagonal.
  close((200-result.point.x)*100+(80-result.point.y)*50,0);
});
test('Shift reverses corner aspect only and explicit locking works on sides',()=>{
  const free=geometry.resizeBox(box,'se',{x:210,y:95},{shiftKey:true});sameBounds(free.bounds,{x:10,y:20,width:200,height:75});assert.equal(free.lockAspect,false);
  const reLocked=geometry.resizeBox(box,'se',{x:210,y:120},{lockAspect:false,shiftKey:true});close(reLocked.scaleX,2);close(reLocked.scaleY,2);assert.equal(reLocked.lockAspect,true);
  const side=geometry.resizeBox(box,'e',{x:210,y:500},{shiftKey:true});close(side.scaleX,2);close(side.scaleY,1);
  const sideLocked=geometry.resizeBox(box,'e',{x:210,y:500},{lockAspect:true});sameBounds(sideLocked.bounds,{x:10,y:-5,width:200,height:100});samePoint(sideLocked.anchor,{x:10,y:45});
});
test('Alt resizes around the original centre for both side and corner handles',()=>{
  const free=geometry.resizeBox(box,'e',{x:160,y:999},{altKey:true});sameBounds(free.bounds,{x:-40,y:20,width:200,height:50});samePoint(free.anchor,{x:60,y:45});
  const locked=geometry.resizeBox(box,'nw',{x:-40,y:-5},{altKey:true});sameBounds(locked.bounds,{x:-40,y:-5,width:200,height:100});samePoint(geometry.applyPoint(locked.matrix,{x:60,y:45}),{x:60,y:45});
});
test('crossing an anchor never flips the selection and minimum dimensions are bounded',()=>{
  const result=geometry.resizeBox(box,'se',{x:-100,y:-200},{lockAspect:false,minSize:{width:8,height:6}});sameBounds(result.bounds,{x:10,y:20,width:8,height:6});assert.equal(result.clamped,true);assert.ok(result.scaleX>0&&result.scaleY>0);
  const maximum=geometry.resizeBox(box,'se',{x:1e7,y:5e6},{maxScale:3});close(maximum.scaleX,3);close(maximum.scaleY,3);assert.equal(maximum.clamped,true);
  const tiny=geometry.resizeBox({x:0,y:0,width:.001,height:.002},'se',{x:-1,y:-1},{minSize:1,maxScale:10});sameBounds(tiny.bounds,{x:0,y:0,width:.01,height:.02});assert.equal(tiny.minimumUnreachable,true);assert.equal(tiny.scaleX,10);
});
test('horizontal and vertical zero-size lines remain finite and retain their zero dimension',()=>{
  const horizontal=geometry.resizeBox({x:10,y:20,width:100,height:0},'se',{x:210,y:900});sameBounds(horizontal.bounds,{x:10,y:20,width:200,height:0});assert.deepEqual(horizontal.degenerate,{x:false,y:true});close(horizontal.scaleX,2);close(horizontal.scaleY,2);
  const vertical=geometry.resizeBox({x:10,y:20,width:0,height:100},'s',{x:999,y:220});sameBounds(vertical.bounds,{x:10,y:20,width:0,height:200});close(vertical.scaleX,1);close(vertical.scaleY,2);
  for(const handle of geometry.handles){const result=geometry.resizeBox({x:10,y:20,width:0,height:0},handle,{x:-50,y:100},{altKey:true});sameBounds(result.bounds,{x:10,y:20,width:0,height:0});assert.deepEqual(result.matrix,[1,0,0,1,0,0]);}
  const noWidth=geometry.resizeBox({x:10,y:20,width:0,height:100},'e',{x:200,y:20});sameBounds(noWidth.bounds,{x:10,y:20,width:0,height:100});
});
test('free-axis snapping reaches both guides without changing the opposite corner',()=>{
  const result=geometry.resizeBox(box,'se',{x:207,y:117},{lockAspect:false,guides:{x:[210],y:[120]},snapThreshold:4});sameBounds(result.bounds,{x:10,y:20,width:200,height:100});assert.deepEqual(result.snapped,{x:210,y:120});samePoint(geometry.applyPoint(result.matrix,{x:10,y:20}),{x:10,y:20});
  const off=geometry.resizeBox(box,'e',{x:207,y:45},{guides:{x:[210]},snapThreshold:2});assert.deepEqual(off.snapped,{});close(off.bounds.width,197);
});
test('locked snapping chooses the nearest feasible axis and reports actual alignments only',()=>{
  const result=geometry.resizeBox({x:0,y:0,width:100,height:50},'se',{x:198,y:99},{guides:{x:[200],y:[103]},snapThreshold:5});close(result.scaleX,2);close(result.scaleY,2);assert.deepEqual(result.snapped,{x:200});
  const compatible=geometry.resizeBox({x:0,y:0,width:100,height:50},'se',{x:198,y:99},{guides:{x:[200],y:[100]},snapThreshold:3});assert.deepEqual(compatible.snapped,{x:200,y:100});
  const impossible=geometry.resizeBox({x:0,y:0,width:100,height:50},'se',{x:300,y:150},{maxScale:2,guides:{x:[202],y:[-1]},snapThreshold:5});close(impossible.scaleX,2);assert.deepEqual(impossible.snapped,{});
});
test('west/north centre snapping remains exact and input objects are immutable',()=>{
  const options={altKey:true,lockAspect:false,guides:{x:[-40],y:[-5]},snapThreshold:4},before=JSON.stringify({box,options});
  const result=geometry.resizeBox(box,'nw',{x:-38,y:-3},options);sameBounds(result.bounds,{x:-40,y:-5,width:200,height:100});assert.deepEqual(result.snapped,{x:-40,y:-5});assert.equal(JSON.stringify({box,options}),before);
});
test('matrix composition and inverse preserve an existing rotated PDF transform',()=>{
  const pdf=[0,-50,50,0,30,200],resize=geometry.resizeBox(box,'se',{x:210,y:120}).matrix,composed=geometry.multiply(resize,pdf),p={x:.2,y:.5};
  samePoint(geometry.applyPoint(composed,p),geometry.applyPoint(resize,geometry.applyPoint(pdf,p)));samePoint(geometry.applyPoint(geometry.inverse(composed),geometry.applyPoint(composed,p)),p);assert.deepEqual(pdf,[0,-50,50,0,30,200]);
  const parent=[2,0,0,3,10,20],local=geometry.multiply(geometry.multiply(geometry.inverse(parent),resize),parent);samePoint(geometry.applyPoint(parent,geometry.applyPoint(local,p)),geometry.applyPoint(resize,geometry.applyPoint(parent,p)));
});
test('invalid inputs are rejected instead of producing NaN matrices',()=>{
  const valid={x:100,y:100};for(const invalid of [{...box,width:-1},{...box,x:Infinity},{...box,height:NaN},null])assert.throws(()=>geometry.resizeBox(invalid,'se',valid));
  for(const options of [{maxScale:0},{minScale:0},{minScale:2,maxScale:1},{maxScale:1e9},{minSize:-1},{minSize:{width:1,height:NaN}},{lockAspect:'yes'},{altKey:1},{guides:{x:[Infinity]}},{guides:{x:'5'}},{snapThreshold:-1}])assert.throws(()=>geometry.resizeBox(box,'se',valid,options));
  assert.throws(()=>geometry.resizeBox(box,'invalid',valid));assert.throws(()=>geometry.resizeBox(box,'se',{x:NaN,y:0}));assert.throws(()=>geometry.inverse([1,2,2,4,0,0]));assert.throws(()=>geometry.multiply([1,0,0,1,0,0],[1,0,Infinity,1,0,0]));
});
test('deterministic mixed-handle cases maintain positive scale, anchors, bounds and invertibility',()=>{
  let seed=9173;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
  for(let i=0;i<800;i++){
    const b={x:random()*200-100,y:random()*200-100,width:i%31?random()*500+1:0,height:i%37?random()*200+1:0},handle=geometry.handles[i%8],options={shiftKey:i%3===0,altKey:i%5===0,maxScale:8,minScale:.05,minSize:.1},result=geometry.resizeBox(b,handle,{x:random()*1000-500,y:random()*800-400},options);
    assert.ok(result.matrix.every(Number.isFinite));assert.ok(result.scaleX>0&&result.scaleY>0&&result.scaleX<=8&&result.scaleY<=8);samePoint(geometry.applyPoint(result.matrix,result.anchor),result.anchor);close(result.bounds.width,b.width*result.scaleX);close(result.bounds.height,b.height*result.scaleY);const p={x:b.x+b.width*.4,y:b.y+b.height*.6};samePoint(geometry.applyPoint(geometry.inverse(result.matrix),geometry.applyPoint(result.matrix,p)),p);
  }
});
test('the same standalone module exposes the browser global without DOM dependencies',()=>{
  const context={};vm.runInNewContext(fs.readFileSync(require.resolve(path),'utf8'),context);assert.equal(typeof context.StudioSelectionTransform.resizeBox,'function');const result=context.StudioSelectionTransform.resizeBox(box,'e',{x:210,y:45});close(result.scaleX,2);assert.equal(result.scaleY,1);
});
console.log(`PASS ${passed} selection-transform tests, including 800 deterministic geometry cases; pure canvas-pt math, no browser interaction claim.`);
