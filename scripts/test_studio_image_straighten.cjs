'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),straighten=require('../skills/polish-sci-figures/assets/figure-studio/image-straighten.js'),rectify=require('../skills/polish-sci-figures/assets/figure-studio/image-rectify.js');
const close=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<=tol,`${a} != ${b}`),line=(degrees,length=100,center={x:200,y:150})=>{const angle=degrees*Math.PI/180,dx=Math.cos(angle)*length/2,dy=Math.sin(angle)*length/2;return [{x:center.x-dx,y:center.y-dy},{x:center.x+dx,y:center.y+dy}];};
function checkRigid(result,width,height,bounds={x:0,y:0,width,height}){
  const p=result.corners,edge=(a,b)=>({x:b.x-a.x,y:b.y-a.y}),a=edge(p[0],p[1]),b=edge(p[0],p[3]),c=edge(p[3],p[2]),d=edge(p[1],p[2]);
  close(a.x,c.x);close(a.y,c.y);close(b.x,d.x);close(b.y,d.y);close(a.x*b.x+a.y*b.y,0,1e-6);assert.ok(a.x*b.y-a.y*b.x>0);
  for(const q of p){assert.ok(q.x>=bounds.x&&q.x<=bounds.x+bounds.width);assert.ok(q.y>=bounds.y&&q.y<=bounds.y+bounds.height);}
  const H=rectify.homography(p,result.outputWidth,result.outputHeight),u=Math.hypot(H[0],H[3]),v=Math.hypot(H[1],H[4]);close(u,v);close(H[0]*H[1]+H[3]*H[4],0);close(H[6],0);close(H[7],0);close(u,result.audit.sourcePixelsPerOutputPixel);
  rectify.validateQuad(p,{width,height});assert.ok(result.outputWidth<=4096&&result.outputHeight<=4096&&result.outputWidth*result.outputHeight<=12000000);
}
test('horizontal and vertical references preserve full frame at zero rotation, with no fill or calibration inheritance',()=>{
  for(const [degrees,target] of [[0,'horizontal'],[90,'vertical']]){const result=straighten.fromRuler(line(degrees),{width:400,height:300,target});close(result.rotationDegrees,0);assert.deepEqual(result.corners,[{x:0,y:0},{x:400,y:0},{x:400,y:300},{x:0,y:300}]);assert.equal(result.outputWidth,400);assert.equal(result.outputHeight,300);assert.equal(result.audit.outsideFill,false);assert.equal(result.audit.physicalCalibrationInherited,false);checkRigid(result,400,300);}
});
test('known ruler angles produce one global rotation; endpoint reversal does not mirror or rotate by 180 degrees',()=>{
  for(const [degrees,target,expected] of [[13,'horizontal',-13],[-27,'horizontal',27],[78,'vertical',12],[-80,'vertical',-10],[45,'horizontal',-45],[-45,'horizontal',45]]){
    const points=line(degrees),a=straighten.fromRuler(points,{width:400,height:300,target}),b=straighten.fromRuler(points.slice().reverse(),{width:400,height:300,target});close(a.rotationDegrees,expected);close(a.rotationDegrees,b.rotationDegrees);assert.deepEqual(a.corners,b.corners);assert.equal(a.outputWidth,b.outputWidth);assert.equal(a.outputHeight,b.outputHeight);checkRigid(a,400,300);
  }
});
test('maximum continuous area agrees with an independent dense one-dimensional feasible-rectangle oracle',()=>{
  for(const degrees of [7,23,30,44,45]){
    const result=straighten.fromRuler(line(degrees),{width:400,height:200,bounds:{x:0,y:0,width:400,height:200}}),angle=degrees*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);let best=0;
    // Exhaustive admissible widths; the two footprint inequalities give the
    // largest possible height at each width, independently of the production
    // active-constraint solution.
    for(let width=.05;width<=400;width+=.05){const height=Math.min((400-c*width)/s,(200-s*width)/c);if(height>0)best=Math.max(best,width*height);}
    assert.ok(result.audit.continuousMaximumArea>=best-1e-5);assert.ok(result.audit.continuousMaximumArea-best<2);assert.ok(result.audit.retainedArea<=result.audit.continuousMaximumArea+1e-6);checkRigid(result,400,200);
  }
});
test('nonzero crop bounds are respected and their centre stays fixed under the rigid crop',()=>{
  const bounds={x:110,y:70,width:250,height:170},result=straighten.fromRuler(line(19),{width:500,height:400,bounds});checkRigid(result,500,400,bounds);close(result.corners.reduce((s,p)=>s+p.x,0)/4,235);close(result.corners.reduce((s,p)=>s+p.y,0)/4,155);
});
test('large output uses the same scale in both axes after integer dimensions and remains under actual renderer caps',()=>{
  const width=6000,height=5000,points=line(8,1500,{x:3000,y:2500}),result=straighten.fromRuler(points,{width,height});checkRigid(result,width,height);assert.ok(result.audit.sourcePixelsPerOutputPixel>1);assert.equal(Number.isInteger(result.outputWidth),true);assert.equal(Number.isInteger(result.outputHeight),true);assert.equal(result.audit.uniformScale,true);assert.equal(result.audit.perspectiveCorrected,false);
});
test('short rulers, invalid points, bounds and mismatched targets fail explicitly',()=>{
  const hasCode=(fn,code)=>assert.throws(fn,e=>e.code===code);
  hasCode(()=>straighten.fromRuler([{x:1,y:1},{x:1,y:1}],{width:400,height:300}),'SHORT_RULER');hasCode(()=>straighten.fromRuler([{x:1,y:1},{x:8,y:1}],{width:400,height:300}),'SHORT_RULER');
  hasCode(()=>straighten.fromRuler([{x:100,y:100},{x:150,y:100}],{width:6000,height:5000}),'SHORT_RULER');
  hasCode(()=>straighten.fromRuler([{x:-1,y:1},{x:100,y:1}],{width:400,height:300}),'OUT_OF_BOUNDS');hasCode(()=>straighten.fromRuler([{x:NaN,y:1},{x:100,y:1}],{width:400,height:300}),'INVALID_RULER');
  for(const bounds of [{x:-1,y:0,width:100,height:100},{x:300,y:100,width:101,height:100},{x:0,y:0,width:0,height:10}])hasCode(()=>straighten.fromRuler(line(0),{width:400,height:300,bounds}),'INVALID_BOUNDS');
  hasCode(()=>straighten.fromRuler(line(70),{width:400,height:300,target:'horizontal'}),'ANGLE_TARGET_MISMATCH');hasCode(()=>straighten.fromRuler(line(10),{width:400,height:300,target:'vertical'}),'ANGLE_TARGET_MISMATCH');
});
