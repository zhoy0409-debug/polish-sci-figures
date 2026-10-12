const assert=require('node:assert/strict');
const {marqueeHit}=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const rect={left:20,right:42,top:10,bottom:170};
const ticks=[20,50,80,110,140].map(y=>({left:24,right:41,top:y,bottom:y+10}));
assert.equal(ticks.filter(b=>marqueeHit(rect,b,true)).length,5);
assert.equal(marqueeHit(rect,{left:2,right:10,top:60,bottom:95},true),false,'axis title outside the band');
assert.equal(marqueeHit(rect,{left:50,right:75,top:165,bottom:175},true),false,'x tick outside the band');
assert.equal(marqueeHit({left:30,right:34,top:16,bottom:34},ticks[0],true),true,'text centres are enough; no pixel-perfect enclosing needed');
assert.equal(marqueeHit(rect,{left:20,right:42,top:60,bottom:60}),true,'zero-height lines remain selectable');
assert.equal(marqueeHit(rect,{left:18,right:44,top:60,bottom:70}),false,'large shapes still require enclosure');
assert.equal(marqueeHit(rect,{left:30,right:30,top:60,bottom:60}),false,'zero-area/invisible objects excluded');
assert.equal(marqueeHit(rect,{left:NaN,right:30,top:60,bottom:70}),false);
for(const scale of [.4,1,2]){const map=b=>Object.fromEntries(Object.entries(b).map(([k,v])=>[k,v*scale]));assert.equal(ticks.filter(b=>marqueeHit(map(rect),map(b),true)).length,5);}
console.log('Marquee: axis-only selection, text tolerance, shape/line bounds, invalid geometry and zoom passed.');
