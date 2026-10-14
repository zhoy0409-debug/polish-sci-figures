'use strict';
const assert=require('node:assert/strict');
const api=require('../skills/polish-sci-figures/assets/figure-studio/statistical-line-geometry.js');
const studio=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8'),validation={};
vm.runInNewContext(source.slice(source.indexOf('function validValue('),source.indexOf('function heatmapCellInfo(')),validation);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
test('all supported shapes preserve path geometry and physical unit',()=>{
 for(const unit of [.25,1,2.5])for(const shape of ['bracket','line','rounded']){
  const d=studio.statisticalBracketPath(10*unit,80*unit,20*unit,unit,shape),s=api.fromPath(d,{}, {unit,automaticWidth:70*unit});
  near(s.left,10*unit);near(s.right,80*unit);near(s.y,20*unit);assert.equal(s.shape,shape);
  const r=api.setWidthPercent(s,70);near(r.width,49*unit);near(r.center,45*unit);
  assert.equal(r.d,studio.adjustedStatisticalBracket(10*unit,80*unit,20*unit,unit,r.patch,shape));
 }
});
test('percent remains 70 after save/reopen without a new state field',()=>{
 const s=api.snapshot({left:10,right:110,y:12,unit:1},{}),r=api.setWidthPercent(s,70);
 const reopened=api.fromPath(r.d,r.patch,{unit:1});near(reopened.percent,70);near(reopened.automaticWidth,100);
 const again=api.setWidthPercent(reopened,50);near(again.width,50);near(again.center,s.center);
});
test('nine mixed-width comparisons retain their own centres and lanes',()=>{
 const snapshots=Array.from({length:9},(_,i)=>api.snapshot({left:20+(i%3)*130,right:90+(i%3)*130+(i%2)*30,y:100-Math.floor(i/3)*20,unit:1},{}));
 for(const s of snapshots){const r=api.setWidthPercent(s,60);near(r.center,s.center);near(r.y,s.y);near(r.width,s.width*.6);}
});
test('asymmetric endpoints, P text and existing object transforms stay independent',()=>{
 const props={'stat-left':'4','stat-right':'8','offset-x':'3','offset-y':'-2','object-transform':'[2,0,0,1,20,30]',text:'P = 0.032','stroke-width':'1.2'},saved=JSON.stringify(props);
 const s=api.snapshot({left:16,right:68,y:40,unit:1,automaticWidth:40},props),r=api.setWidthPercent(s,75);
 near(r.center,42);near(r.width,30);assert.deepEqual(Object.keys(r.patch),['stat-left','stat-right']);assert.equal(JSON.stringify(props),saved);
 near(2*r.center+20,2*s.center+20);assert.equal(validation.validValue('stat-left',r.patch['stat-left']),true);
});
test('dragging endpoints fixes the opposite endpoint and cannot cross it',()=>{
 const s=api.snapshot({left:10,right:90,y:30,unit:1},{});
 let r=api.moveEndpoint(s,'left',50);near(r.right,90);near(r.left,50);
 r=api.moveEndpoint(s,'left',120);near(r.right,90);near(r.width,8);assert.equal(r.clamped,true);
 r=api.moveEndpoint(s,'right',-20);near(r.left,10);near(r.width,8);
 r=api.moveEndpoint(s,'left',30,{centered:true});near(r.center,s.center);near(r.left,30);near(r.right,70);
});
test('readable minimum, physical edit limits and old clamped geometry remain finite',()=>{
 const s=api.snapshot({left:20,right:60,y:4,unit:2},{});
 near(api.setWidthPercent(s,1).width,16);
 const large=api.setWidthPercent(s,100000);assert.equal(large.clamped,true);near(+large.patch['stat-left'],500);near(+large.patch['stat-right'],500);
 const old=api.snapshot({left:14,right:16,y:30,unit:1,automaticWidth:10},{'stat-left':'-100','stat-right':'-100'}),r=api.setWidthPercent(old,100);
 near(r.width,10);near(r.center,15);assert.equal(studio.adjustedStatisticalBracket(10,20,30,1,r.patch),r.d);
});
test('invalid or unowned geometry is rejected without changing prior edits',()=>{
 for(const d of ['M 0 0 L 20 20','M 0 0 H NaN','M0 0 H2 javascript:bad'])assert.throws(()=>api.fromPath(d,{}, {unit:1}));
 assert.throws(()=>api.snapshot({left:0,right:10,y:0,unit:0}));
 const s=api.snapshot({left:0,right:10,y:0,unit:1});for(const value of [NaN,Infinity,-1,0])assert.throws(()=>api.setWidthPercent(s,value));
 assert.throws(()=>api.moveEndpoint(s,'top',10));assert.throws(()=>api.setShape(s,'script'));
});
test('shape-only adjustment leaves width, values and text untouched',()=>{
 const s=api.snapshot({left:10,right:50,y:40,unit:1},{}),r=api.setShape(s,'rounded');
 assert.deepEqual(r.patch,{'stat-shape':'rounded'});assert.equal(r.d,studio.statisticalBracketPath(10,50,40,1,'rounded'));
});
console.log(`PASS ${count} statistical connector geometry checks`);
