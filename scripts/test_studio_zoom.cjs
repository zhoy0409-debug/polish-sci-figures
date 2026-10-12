const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {clampPreviewZoom, wheelPreviewZoom, zoomAnchorScroll, exportGeometry} = require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

for (const [input, expected] of [[-1,.1],[.25,.25],[3,3],[12,4],[Infinity,4],[-Infinity,.1],[NaN,1]]) {
  assert.equal(clampPreviewZoom(input), expected);
}
assert.ok(wheelPreviewZoom(1,-120) > 1);
assert.ok(wheelPreviewZoom(1,120) < 1);
near(wheelPreviewZoom(1,3,1), wheelPreviewZoom(1,48,0));
near(wheelPreviewZoom(1,.1,2,600), wheelPreviewZoom(1,60,0));
near(wheelPreviewZoom(wheelPreviewZoom(1,-80),80), 1);
assert.equal(wheelPreviewZoom(1,-1e6),4);
assert.equal(wheelPreviewZoom(1,1e6),.1);
assert.equal(wheelPreviewZoom(.5,NaN),.5);

// Large artwork: the data position at the pointer must stay there after scrolling.
let input = {
  before:{left:-168,top:-68,width:1000,height:800},
  after:{left:-168,top:-68,width:1500,height:1200},
  point:{x:450,y:250},scrollLeft:200,scrollTop:100,
  scrollWidth:1564,scrollHeight:1264,viewportWidth:700,viewportHeight:500
};
let result = zoomAnchorScroll(input);
near(result.left,509); near(result.top,259);
near(input.after.left+(input.point.x-input.before.left)/input.before.width*input.after.width-(result.left-input.scrollLeft), input.point.x);
near(input.after.top+(input.point.y-input.before.top)/input.before.height*input.after.height-(result.top-input.scrollTop), input.point.y);

// Horizontal auto margins disappear when a centered artwork becomes wider.
result = zoomAnchorScroll({
  before:{left:250,top:32,width:500,height:300},after:{left:32,top:32,width:1000,height:600},
  point:{x:500,y:200},scrollLeft:0,scrollTop:0,
  scrollWidth:1064,scrollHeight:664,viewportWidth:1000,viewportHeight:400
});
near(result.left,32); near(result.top,168);

// Browser scroll bounds take priority when an edge cannot stay at the pointer.
result = zoomAnchorScroll({...input,scrollWidth:750,scrollHeight:510});
assert.deepEqual(result,{left:50,top:10});
result = zoomAnchorScroll({...input,after:{left:250,top:32,width:500,height:300},scrollLeft:0,scrollTop:0,scrollWidth:700,scrollHeight:500});
assert.deepEqual(result,{left:0,top:0});
result = zoomAnchorScroll({...input,before:{left:0,top:0,width:0,height:NaN}});
assert.deepEqual(result,{left:0,top:0});

// Repeated reciprocal changes preserve the anchor away from scroll boundaries.
for (const ratio of [.75,1,1.25,2]) {
  const after={...input.before,width:input.before.width*ratio,height:input.before.height*ratio};
  const actual=zoomAnchorScroll({...input,after,scrollWidth:5000,scrollHeight:5000});
  const expectedLeft=input.scrollLeft+(input.point.x-input.before.left)*(ratio-1);
  const expectedTop=input.scrollTop+(input.point.y-input.before.top)*(ratio-1);
  near(actual.left,Math.max(0,expectedLeft));near(actual.top,Math.max(0,expectedTop));
}

// Source review guard: the wheel/update path must not trigger the renderer or history.
const source=fs.readFileSync(path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const zoomCode=source.slice(source.indexOf('  function applyPreviewZoom('),source.indexOf('  function syncCanvasModes('));
assert.ok(zoomCode.includes('requestAnimationFrame'));
assert.ok(zoomCode.includes('{passive:false}'));
assert.ok(zoomCode.includes('if(!event.altKey&&!event.ctrlKey)return;'));
assert.doesNotMatch(zoomCode,/\b(renderCanvas|composite|commit|fetch|ensureReflows)\s*\(/);
assert.doesNotMatch(zoomCode,/exportSettings|\.setAttribute\s*\(/);
const output=exportGeometry(720,480,{widthMm:180,dpi:600});
wheelPreviewZoom(1,-240);
assert.deepEqual(exportGeometry(720,480,{widthMm:180,dpi:600}),output);

const i18n=require('../skills/polish-sci-figures/assets/figure-studio/i18n.js');
i18n.setLanguage('en');
assert.match(i18n.t('Alt + 滚轮：以鼠标位置缩放；普通滚轮：滚动画布'),/Alt \+ wheel/);
assert.equal(i18n.t('预览缩放 {0}%；Alt + 滚轮缩放',125),'Preview zoom 125%; Alt + wheel to zoom');
console.log('Preview zoom: scale limits, wheel units, cursor anchor, centered/overflow layout, scroll bounds, preview-only path and English labels passed.');
