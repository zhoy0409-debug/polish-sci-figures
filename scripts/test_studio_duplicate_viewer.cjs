'use strict';
const assert=require('node:assert/strict');
const viewer=require('../skills/polish-sci-figures/assets/figure-studio/duplicate-viewer.js');
const near=(a,b,message)=>assert.ok(Math.abs(a-b)<1e-8,`${message}: ${a} != ${b}`);
const same=(a,b,message)=>{near(a.x,b.x,message+' x');near(a.y,b.y,message+' y');};
const tests=[
  [[1,0,0],[0,1,0]],
  [[2,0,43],[0,2,-29]],
  [[0,-.6,355],[.6,0,18]],
  [[-.8,0,590],[0,.8,-23]],
  [[-.6,-.8,705],[-.8,.6,433]],
  [[1.2,.1,42],[.2,.9,-27]]
];
for(const raw of tests){const matrix=viewer.affine(raw),back=viewer.inverse(matrix);assert.ok(back);
  for(const p of [{x:0,y:0},{x:123.45,y:67.89},{x:899,y:575}])same(viewer.point(back,viewer.point(matrix,p)),p,'inverse maps crop/rotation/mirror back to A');
}
assert.equal(viewer.affine([[1,2,0],[2,4,0]]),null,'singular matrices must not create fake alignment');
assert.equal(viewer.affine([[Infinity,0,0],[0,1,0]]),null);assert.equal(viewer.affine([1,0,0,1,0,0]),null);
const a={analysisWidth:900,analysisHeight:600},b={analysisWidth:450,analysisHeight:300};
assert.equal(viewer.alignment({kind:'overlap'},a,b),null);
assert.equal(viewer.alignment({kind:'exact'},a,b),null,'different analysis geometry cannot assume identity');
assert.deepEqual(viewer.alignment({kind:'exact'},a,a),{a:1,b:0,c:0,d:1,e:0,f:0});
assert.equal(viewer.alignment({transformAtoB:tests[0]},{width:900,height:600},b),null,'original dimensions are not analysis coordinates');
// Original B has 3600 px width, preview 450 px; its analysis coordinate maps
// to A through the inverse, independently of the source image resolution.
const crop={transformAtoB:[[.5,0,-100],[0,.5,-50]],kind:'overlap'},back=viewer.inverse(viewer.alignment(crop,a,b));
same(viewer.point(back,{x:100,y:100}),{x:400,y:300},'analysis crop registration');
const view={width:623,height:401},image={width:900,height:600},camera={zoom:2.4,x:350,y:261};
for(const anchor of [{x:0,y:0},{x:50,y:327},{x:311.5,y:200.5},{x:622,y:400}]){
  const before=viewer.point(viewer.inverse(viewer.cameraMatrix(camera,view,image)),anchor);
  for(const zoom of [.01,.8,5,120]){const next=viewer.zoomAround(camera,zoom,anchor,view,image),after=viewer.point(viewer.inverse(viewer.cameraMatrix(next,view,image)),anchor);same(after,before,'zoom remains anchored even at limits');assert.ok(next.zoom>=.25&&next.zoom<=32);}
}
const next=viewer.panCamera(camera,{x:70,y:-41},view,image),position={x:401,y:288},oldScreen=viewer.point(viewer.cameraMatrix(camera,view,image),position),newScreen=viewer.point(viewer.cameraMatrix(next,view,image),position);
near(newScreen.x-oldScreen.x,70,'drag follows pointer horizontally');near(newScreen.y-oldScreen.y,-41,'drag follows pointer vertically');
const synced=viewer.syncCamera(camera,image,{width:600,height:300});near(synced.x/600,camera.x/900,'sync normalized x');near(synced.y/300,camera.y/600,'sync normalized y');assert.equal(synced.zoom,camera.zoom);
const png='data:image/png;base64,aGVsbG8=',jpeg='data:image/jpeg;base64,aGVsbG8=';
assert.equal(viewer.raster('https://example.invalid/a.png'),false);assert.equal(viewer.raster('data:image/svg+xml;base64,aGVsbG8='),false);assert.equal(viewer.raster('data:image/tiff;base64,aGVsbG8='),false);
assert.deepEqual(viewer.sources({reviewPreview:png,thumbnail:png},jpeg).map(x=>x.kind),['original','review']);
assert.deepEqual(viewer.sources({warnings:['high_bit_depth_preview'],reviewPreview:png,thumbnail:jpeg},jpeg).map(x=>x.kind),['mapped','thumbnail'],'high depth uses documented mapping instead of browser pixel conversion');
assert.deepEqual(viewer.sources({reviewPreview:png},'data:image/tiff;base64,aGVsbG8=').map(x=>x.kind),['converted'],'ordinary TIFF is format converted, not intensity mapped');
assert.deepEqual(viewer.sources({intensityMapping:{method:'percentile'},reviewPreview:png},'data:image/tiff;base64,aGVsbG8=').map(x=>x.kind),['mapped']);
assert.deepEqual(viewer.sources({thumbnail:png},'https://example.invalid/a.png').map(x=>x.kind),['thumbnail']);
assert.equal(viewer.matchPoints({pointsA:[[1,2],[NaN,4],[7]],pointsB:[[3,4],[5,6],[8]]}).length,1,'invalid match coordinates are not drawn');
const fs=require('node:fs'),source=fs.readFileSync('skills/polish-sci-figures/assets/figure-studio/duplicate-viewer.js','utf8');
assert.ok(!source.includes('</script>'),'viewer can be embedded in the standalone HTML script');
console.log('Interactive evidence viewer: affine, mirror/crop registration, anchored zoom, pan, sync and source safeguards passed');
