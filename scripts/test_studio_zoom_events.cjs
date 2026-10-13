/* Actual controller/listener execution in a bounded DOM mock; not a browser test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const helpers = require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const source = fs.readFileSync(path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.js'),'utf8');
const css = fs.readFileSync(path.join(__dirname,'../skills/polish-sci-figures/assets/figure-studio/studio.css'),'utf8');
const controller = source.slice(source.indexOf('  // Reuse the current SVG on zoom;'),source.indexOf('  function renderCanvas('));
const near = (a,b) => assert.ok(Math.abs(a-b)<1e-8, `${a} != ${b}`);
let frames = new Map(),frameId=0,styleWrites=0,redraws=0,scrollX=0,scrollY=0;
const resizeObservers=[];
const listeners = new Map(),windowListeners = new Map();
const makeOption = value => ({value:String(value),dataset:{},hidden:false,textContent:'',hasAttribute(name){return name==='data-custom-zoom'&&Object.hasOwn(this.dataset,'customZoom');}});
const control={value:'1',title:'',options:['fit',.1,.25,.5,.75,1,1.5,2,3,4].map(makeOption),querySelector(){return this.options.find(o=>o.hasAttribute('data-custom-zoom'))||null;},append(o){this.options.push(o);}};
const svg={isConnected:true,style:new Proxy({width:'1000px',height:'700px'},{set(target,key,value){styleWrites++;target[key]=value;return true;}}),
  getBoundingClientRect(){const width=parseFloat(this.style.width),height=parseFloat(this.style.height);const left=80+32+Math.max(0,(viewport.clientWidth-64-width)/2)-viewport.scrollLeft,top=50+32-viewport.scrollTop;return {left,top,width,height,right:left+width,bottom:top+height};}
};
const viewport={clientWidth:900,clientHeight:620,clientLeft:0,clientTop:0,
  get scrollWidth(){return Math.max(this.clientWidth,parseFloat(svg.style.width)+64);},
  get scrollHeight(){return Math.max(this.clientHeight,parseFloat(svg.style.height)+64);},
  get scrollLeft(){return scrollX;},set scrollLeft(v){scrollX=Math.max(0,Math.min(this.scrollWidth-this.clientWidth,v));},
  get scrollTop(){return scrollY;},set scrollTop(v){scrollY=Math.max(0,Math.min(this.scrollHeight-this.clientHeight,v));},
  addEventListener(name,fn,options){listeners.set(name,{fn,options});},getBoundingClientRect(){return {left:80,top:50};}
};
const sandbox={...helpers,console,
  $:id=>({viewport,zoom:control})[id],
  T:(s,...values)=>s.replace(/\{(\d+)\}/g,(_,n)=>values[+n]),
  getComputedStyle:()=>({paddingLeft:'32px',paddingRight:'32px',paddingTop:'32px',paddingBottom:'32px'}),
  document:{createElement:()=>makeOption('')},
  ResizeObserver:class {constructor(callback){this.callback=callback;resizeObservers.push(this);}observe(node){this.node=node;}},
  requestAnimationFrame:fn=>{const id=++frameId;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
  window:{addEventListener:(name,fn)=>windowListeners.set(name,fn),getSelection:()=>({removeAllRanges(){}})},project:{},svg,
  markRedraw:()=>redraws++,commit:()=>{throw Error('Preview fit must not add edit history');}
};
vm.createContext(sandbox);
vm.runInContext(source.slice(source.indexOf('  function canvasObjectTarget('),source.indexOf('  function addStatisticalHitAreas(')),sandbox);
// The resize mock runs the current source's zoom subsection; plot generation is stubbed.
const zoomStart=source.indexOf('    const output=exportGeometry(l.width,l.height,previewState.exportSettings),widthPx=');
const zoomEnd=source.indexOf("    $('dimensions').textContent=",zoomStart);
const zoomRender=source.slice(zoomStart,zoomEnd);
assert.ok(zoomStart>=0&&zoomEnd>zoomStart);
const changeLine=source.match(/^  \$\('zoom'\)\.onchange=.*$/m)?.[0];
const resizeLine=source.match(/^  window\.addEventListener\('resize'.*$/m)?.[0];
assert.ok(changeLine&&resizeLine);
vm.runInContext(controller+`
  zoomView={svg,width:1000,height:700,zoom:1,fit:false};
  function renderCanvas(){markRedraw();cancelQueuedZoom({preserveControl:true});const l={width:750,height:525},previewState={};${zoomRender}}
  ${changeLine}
  ${resizeLine}
  globalThis.inspectZoom=()=>({zoom:zoomView.zoom,pending:!!queuedZoom,frame:zoomFrame,svg:zoomView.svg,fit:zoomView.fit});
  globalThis.bindSelectionRefresh=callback=>{zoomView.refreshSelection=callback;};
  globalThis.setZoom=applyPreviewZoom;
  globalThis.flushQueued=cancelQueuedZoom;
  globalThis.observeFit=observePreviewFit;
`,sandbox);
const flush=()=>{const work=[...frames.values()];frames.clear();for(const fn of work)fn();};
const wheel=(options={})=>{const e={altKey:false,ctrlKey:false,buttons:0,deltaY:-100,deltaMode:0,clientX:430,clientY:280,prevented:0,preventDefault(){this.prevented++;},...options};listeners.get('wheel').fn(e);return e;};
assert.equal(listeners.get('wheel').options.passive,false,'modified wheel must be cancelable');

let e=wheel();assert.equal(e.prevented,0);assert.equal(frames.size,0);
e=wheel({shiftKey:true});assert.equal(e.prevented,0);assert.equal(frames.size,0);
const originalNode=svg,initialWidth=svg.style.width,writesBefore=styleWrites;
e=wheel({altKey:true,deltaY:-30});assert.equal(e.prevented,1);
wheel({altKey:true,deltaY:-40});wheel({altKey:true,deltaY:-50});
assert.equal(frames.size,1,'multiple wheel events share one animation frame');
assert.equal(svg.style.width,initialWidth,'no synchronous SVG sizing before animation frame');
flush();near(sandbox.inspectZoom().zoom,Math.exp(.24));
assert.equal(styleWrites-writesBefore,2,'one width and one height write per frame');
assert.equal(sandbox.inspectZoom().svg,originalNode);assert.equal(redraws,0);
const custom=control.querySelector();assert.ok(custom&&!custom.hidden);assert.match(custom.textContent,/^127\.1%$/);near(+control.value,Math.exp(.24));

const scale=sandbox.inspectZoom().zoom;
e=wheel({altKey:true,buttons:1});assert.equal(e.prevented,1);assert.equal(frames.size,0);near(sandbox.inspectZoom().zoom,scale);
e=wheel({ctrlKey:true,deltaY:20});assert.equal(e.prevented,1);flush();near(sandbox.inspectZoom().zoom,scale*Math.exp(-.04));
wheel({altKey:true,deltaY:-1e6});flush();assert.equal(sandbox.inspectZoom().zoom,4);assert.equal(control.value,'4');assert.equal(custom.hidden,true);
wheel({ctrlKey:true,deltaY:1e6});flush();assert.equal(sandbox.inspectZoom().zoom,.1);assert.equal(control.value,'0.1');
assert.equal(redraws,0,'wheel never redraws the plot');

// Dropdown zoom uses the same existing artwork and remains preview-only.
control.value='2';control.onchange();assert.equal(sandbox.inspectZoom().zoom,2);assert.equal(redraws,0);
control.value='fit';control.onchange();near(sandbox.inspectZoom().zoom,Math.min(1,836/1000,556/700));
assert.equal(control.value,'fit');assert.equal(viewport.scrollLeft,0);assert.equal(viewport.scrollTop,0);
viewport.clientWidth=560;viewport.clientHeight=400;windowListeners.get('resize')();
assert.equal(frames.size,1);flush();
assert.equal(redraws,0);near(sandbox.inspectZoom().zoom,Math.min(1,496/1000,336/700));assert.equal(control.value,'fit');
control.value='2';control.onchange();viewport.clientWidth=700;windowListeners.get('resize')();
assert.equal(sandbox.inspectZoom().zoom,2,'window resize preserves fixed zoom');assert.equal(control.value,'2');
const oldCount=control.options.length;wheel({altKey:true,deltaY:12});flush();wheel({altKey:true,deltaY:8});flush();assert.equal(control.options.length,oldCount,'dynamic option reused');

// First render can occur before the mobile shell frees the viewport. The
// post-initialization frame must fit the final layout, without another render.
viewport.clientWidth=390;viewport.clientHeight=64;control.value='fit';control.onchange();
assert.equal(sandbox.inspectZoom().zoom,.1);
const observer=sandbox.observeFit();assert.equal(observer.node,viewport);assert.equal(frames.size,1);
viewport.clientHeight=430;observer.callback();observer.callback();
assert.equal(frames.size,1,'startup and observer changes coalesce');flush();
near(sandbox.inspectZoom().zoom,Math.min(1,326/1000,366/700));
assert.equal(sandbox.inspectZoom().svg,originalNode);assert.equal(redraws,0);
const fitWrites=styleWrites,settled=sandbox.inspectZoom().zoom;
for(let i=0;i<3;i++){observer.callback();flush();near(sandbox.inspectZoom().zoom,settled);}
assert.equal(styleWrites,fitWrites,'identical size notifications do not resize or compound the scale');
// Hiding a welcome card changes the viewport without a window resize.
viewport.clientHeight=600;viewport.clientWidth=800;observer.callback();flush();
near(sandbox.inspectZoom().zoom,Math.min(1,736/1000,536/700));assert.equal(redraws,0);
// Hidden/transient zero layout must not shrink a previously usable canvas.
const visibleZoom=sandbox.inspectZoom().zoom;viewport.clientHeight=0;observer.callback();flush();
near(sandbox.inspectZoom().zoom,visibleZoom);viewport.clientHeight=600;
// Fixed zoom, a manual choice after queueing, and a pending modified wheel
// all take precedence over automatic layout fitting.
control.value='2';control.onchange();viewport.clientHeight=500;observer.callback();
assert.equal(frames.size,0);assert.equal(sandbox.inspectZoom().zoom,2);
control.value='fit';control.onchange();observer.callback();
control.value='1.5';control.onchange();flush();assert.equal(sandbox.inspectZoom().zoom,1.5);
control.value='fit';control.onchange();const pendingBase=sandbox.inspectZoom().zoom;
observer.callback();wheel({altKey:true,deltaY:-20});viewport.clientWidth=700;
flush();near(sandbox.inspectZoom().zoom,helpers.wheelPreviewZoom(pendingBase,-20));
assert.equal(sandbox.inspectZoom().fit,false);assert.equal(redraws,0);
control.value='fit';control.onchange();const wheelBase=sandbox.inspectZoom().zoom;
wheel({ctrlKey:true,deltaY:-10});observer.callback();assert.equal(frames.size,1);
flush();near(sandbox.inspectZoom().zoom,helpers.wheelPreviewZoom(wheelBase,-10));
assert.equal(sandbox.inspectZoom().svg,originalNode);assert.equal(redraws,0);

// Run the real pointerdown handler in box-select mode. A pending wheel frame
// must be discarded before capturing selection geometry.
const pointerStart=source.indexOf('    svg.onpointerdown=e=>{');
const pointerEnd=source.indexOf('    svg.onpointermove=',pointerStart);
assert.ok(pointerStart>=0&&pointerEnd>pointerStart);
svg.querySelectorAll=()=>[];svg.classList={add(){}};svg.setPointerCapture=()=>{};
vm.runInContext(`let original=false,layoutMode=false,boxSelect=true,marquee=null,selectionAfterMarquee=false,selectedAlignmentGuide=null;
  const drawAlignmentGuides=()=>{},renderAlignmentGuideControls=()=>{};
  const viewport=$('viewport');viewport.classList={add(){}};
  const canvasPoint=()=>({x:.5,y:.5}),state=()=>({overlays:[]}),screenRect=el=>el.getBoundingClientRect();
  ${source.slice(source.indexOf('    const beginMarquee='),source.indexOf('    const stopMarqueeFeedback='))}
  ${source.slice(pointerStart,pointerEnd)}
  globalThis.inspectMarquee=()=>marquee;
`,sandbox);
control.value='fit';control.onchange();const fitBefore=sandbox.inspectZoom().zoom,fitWidth=svg.style.width;
wheel({altKey:true,deltaY:-150});assert.equal(frames.size,1);
const down={button:0,shiftKey:false,target:{closest:()=>null},pointerId:1,clientX:430,clientY:280,preventDefault(){}};
svg.onpointerdown(down);assert.equal(frames.size,0);assert.equal(sandbox.inspectZoom().pending,false);
assert.ok(sandbox.inspectMarquee());flush();near(sandbox.inspectZoom().zoom,fitBefore);
assert.equal(svg.style.width,fitWidth);assert.equal(control.value,'fit');assert.equal(sandbox.inspectZoom().fit,true);
// Canceling a pending wheel must not override the user's newer dropdown choice.
wheel({altKey:true,deltaY:-120});control.value='1.5';control.onchange();flush();
assert.equal(sandbox.inspectZoom().zoom,1.5);assert.equal(control.value,'1.5');assert.equal(sandbox.inspectZoom().fit,false);
wheel({altKey:true,deltaY:-120});control.value='fit';control.onchange();windowListeners.get('resize')();flush();
assert.equal(control.value,'fit');assert.equal(sandbox.inspectZoom().fit,true);

// Existing selections use fresh screen geometry when a selection is drawn at any zoom.
const canvasPointCode=source.match(/^    const canvasPoint=e=>.*$/m)?.[0];
const selectionStart=source.indexOf('    const drawSelection=(nodes,candidate=false)=>{');
const selectionEnd=source.indexOf('    const selectedNodes=',selectionStart);
const selectionCode=source.slice(selectionStart,selectionEnd);
assert.ok(canvasPointCode&&selectionStart>=0&&selectionEnd>selectionStart);
const selectionLayer={children:[],replaceChildren(){this.children=[];},append(el){this.children.push(el);}};
const createSvgElement=()=>({attributes:{},setAttribute(k,v){this.attributes[k]=String(v);}});
const selectSandbox={svg,l:{width:720,height:504},NS:'svg',selectionLayer,document:{createElementNS:createSvgElement},screenRect:el=>el.getBoundingClientRect()};
vm.createContext(selectSandbox);
vm.runInContext(`${canvasPointCode}\n${selectionCode}\nglobalThis.canvasPoint=canvasPoint;globalThis.drawSelection=drawSelection;`,selectSandbox);
for(const z of [.1,.37,1,4]){
  sandbox.setZoom(z,{x:430,y:280});const r=svg.getBoundingClientRect();
  const point=selectSandbox.canvasPoint({clientX:r.left+r.width*.3,clientY:r.top+r.height*.6});near(point.x,.3);near(point.y,.6);
  const box={left:r.left+r.width*.2,top:r.top+r.height*.3,right:r.left+r.width*.3,bottom:r.top+r.height*.4};
  selectSandbox.drawSelection([{box}]);const a=selectionLayer.children[0].attributes;
  near(+a.x*r.width/720,box.left-r.left-2);near(+a.y*r.height/504,box.top-r.top-2);
  near(+a.width*r.width/720,box.right-box.left+4);near(+a.height*r.height/504,box.bottom-box.top+4);
  near(+a.rx*r.width/720,2);
}
// Existing outlines refresh after CSS dimensions and scroll settle. Their
// physical padding remains 2 px even when zoom moves from 10% to 400%.
let outlineRefreshes=0;
const selectedNode={getBoundingClientRect(){const r=svg.getBoundingClientRect();return {left:r.left+r.width*.2,top:r.top+r.height*.3,right:r.left+r.width*.3,bottom:r.top+r.height*.4};}};
sandbox.bindSelectionRefresh(()=>{outlineRefreshes++;selectSandbox.drawSelection([selectedNode]);});
const redrawsBefore=redraws;
for(const z of [.1,4,.3,2]){
  sandbox.setZoom(z,{x:430,y:280});const r=svg.getBoundingClientRect(),box=selectedNode.getBoundingClientRect(),a=selectionLayer.children[0].attributes;
  near(box.left-r.left-(+a.x*r.width/720),2);near(+a.rx*r.width/720,2);
}
assert.equal(outlineRefreshes,4);assert.equal(redraws,redrawsBefore,'selection refresh must not redraw data');
assert.ok(source.includes('zoomView.refreshSelection=()=>drawSelection(selectedNodes());'));
assert.match(css,/#artboard \.selection-outline\s*\{[^}]*vector-effect:\s*non-scaling-stroke/s);
assert.match(css,/#artboard \.selection-marquee\s*\{[^}]*vector-effect:\s*non-scaling-stroke/s);
console.log('Actual zoom event controller (Node DOM mock): startup/layout observer fit, coalescing, no repeated scaling or redraw/history, manual/pending zoom preservation, wheels, clamps, dropdown, pointerdown cancellation and selection coordinates passed.');
console.log('Scope: source event handlers in a DOM mock, not native browser wheel/pinch execution.');
