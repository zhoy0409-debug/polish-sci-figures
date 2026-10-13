'use strict';
const assert=require('node:assert/strict');
const {createTouchSession,gestureDelta,compensatedScroll,clampZoom}=require('../skills/polish-sci-figures/assets/figure-studio/mobile-ui.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const point=(id,x,y)=>({id,x,y});

// Edit mode passes one finger to the editor; the second takes ownership and
// cancels its pending drag. Lifting only one finger must not resume that drag.
let session=createTouchSession('edit');
assert.deepEqual(session.begin(point(9,100,100)),{consume:false,start:false,cancelEditing:false,rebase:false});
assert.equal(session.move(point(9,103,105)).consume,false);
assert.equal(session.snapshot(),null);
assert.deepEqual(session.begin(point(2,200,100)),{consume:true,start:true,cancelEditing:true,rebase:true});
assert.deepEqual(session.snapshot().ids,[9,2]);
assert.equal(session.end(2).finished,false);
assert.equal(session.move(point(9,120,130)).consume,true);
assert.deepEqual(session.end(9),{consume:true,finished:true,cancelled:false,rebase:false});
assert.equal(session.active,false);assert.equal(session.size,0);
assert.equal(session.begin(point(3,10,10)).consume,false);
session.reset();

// A pan starts immediately and consumes every event; no object edit is started.
session=createTouchSession('pan');
assert.equal(session.begin(point(5,100,100)).start,true);
const before=session.snapshot();session.move(point(5,145,70));
let delta=gestureDelta(before,session.snapshot(),1);
assert.deepEqual(delta,{zoom:1,anchor:{x:100,y:100},panX:45,panY:-30});
assert.deepEqual(compensatedScroll(200,100,delta,{width:1000,height:1000,clientWidth:400,clientHeight:400}),{left:155,top:130});

// Pinch zoom is around the old midpoint, then translation follows the new one.
session.begin(point(7,245,70));let first=session.snapshot();
session.move(point(5,105,80));session.move(point(7,305,80));
delta=gestureDelta(first,session.snapshot(),1.25);
near(delta.zoom,2.5);assert.deepEqual(delta.anchor,{x:195,y:70});near(delta.panX,10);near(delta.panY,10);
// Model a content coordinate at the midpoint: zoomAt preserves its old screen
// position, and the compensated scroll moves it exactly to the new midpoint.
const afterZoomScroll={left:250,top:160};
const afterPan=compensatedScroll(afterZoomScroll.left,afterZoomScroll.top,delta,{width:2000,height:2000,clientWidth:400,clientHeight:400});
near(delta.anchor.x+afterZoomScroll.left-afterPan.left,session.snapshot().x);
near(delta.anchor.y+afterZoomScroll.top-afterPan.top,session.snapshot().y);

// Pointer IDs, not event order or x-order, define the pair. A third finger does
// not move the camera. Removing one of the active pair causes a clean rebase.
const stable=session.snapshot();session.begin(point(1,900,900));
assert.deepEqual(session.snapshot(),stable);session.move(point(1,850,800));assert.deepEqual(session.snapshot(),stable);
session.end(5);assert.equal(gestureDelta(stable,session.snapshot(),2.5),null);
assert.deepEqual(session.snapshot().ids,[7,1]);

// Cancel/lost capture consume remaining touches without applying any more pan
// or zoom, then clear completely. The next gesture starts independently.
assert.equal(session.end(7,true).cancelled,true);assert.equal(session.aborted,true);assert.equal(session.snapshot(),null);
assert.equal(session.move(point(1,100,100)).consume,true);assert.equal(session.snapshot(),null);
assert.deepEqual(session.end(1),{consume:true,finished:true,cancelled:true,rebase:false});
assert.equal(session.aborted,false);assert.equal(session.size,0);
session.begin(point(4,1,1));assert.equal(session.abort(),true);assert.equal(session.snapshot(),null);
session.reset();assert.equal(session.active,false);assert.equal(session.aborted,false);

// Near-coincident fingertips cannot cause an extreme jump. Zoom bounds preserve
// panning, and scroll bounds take priority at content edges.
first={ids:[1,2],x:50,y:60,distance:0};
delta=gestureDelta(first,{...first,x:55,distance:100},1);
assert.equal(delta.zoom,1);assert.equal(delta.panX,5);
delta=gestureDelta({...first,distance:100},{...first,x:80,y:10,distance:1000},3);
assert.equal(delta.zoom,4);assert.equal(delta.panX,30);
assert.deepEqual(compensatedScroll(0,40,delta,{width:200,height:200,clientWidth:400,clientHeight:100}),{left:0,top:90});
assert.equal(clampZoom(.01),.1);assert.equal(clampZoom(8),4);assert.equal(clampZoom(NaN),1);
session=createTouchSession('edit');session.begin(point(8,0,0));
assert.deepEqual(session.setMode('pan'),[8]);assert.equal(session.size,0);assert.equal(session.mode,'pan');
assert.equal(session.begin(point(NaN,0,0)).consume,false);assert.equal(session.size,0);
session.begin(point(8,0,0));assert.equal(session.begin(point(8,20,20)).start,false);assert.equal(session.size,1);
assert.deepEqual(session.end(99),{consume:false,finished:false});
console.log('Mobile gestures: edit takeover, pan/pinch anchors, pointer identity, third finger, cancellation, bounds and mode reset passed.');
