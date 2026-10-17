/* Local DOM integration, not physical-browser/device testing.
 * Requires jsdom; keep it out of the product bundle. Example:
 * NODE_PATH=.cache/mobile-local-spike/node_modules node scripts/test_mobile_dom_preview.cjs
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const StudioMobileUI=require('../skills/polish-sci-figures/assets/figure-studio/mobile-ui.js');

function harness({captureOnViewport=false,deferCaptureLoss=false}={}){
  const dom=new JSDOM('<!doctype html><html lang="en"><body><header>Figure Studio</header><div class="workspace"><aside class="navigator"><button id="panelControl">Panel</button></aside><main><div id="viewport"><svg id="art"><rect id="object"/><foreignObject><input id="input"></foreignObject></svg></div></main><aside class="inspector"><input id="property"></aside></div></body></html>',{pretendToBeVisual:true});
  const {window}=dom,doc=window.document,viewport=doc.getElementById('viewport');
  const style=doc.createElement('style');style.textContent=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/mobile-ui.css'),'utf8');doc.head.append(style);
  let enabled=true,zoom=1,nextFrame=0,editActive=false,commits=0,lostEditing=0,appDown=0,appMove=0,appUp=0,appClicks=0,placementStarts=0;
  const mediaEvents=new window.EventTarget(),media={get matches(){return enabled;},addEventListener:(...args)=>mediaEvents.addEventListener(...args),removeEventListener:(...args)=>mediaEvents.removeEventListener(...args)};
  window.matchMedia=()=>media;
  const frames=new Map(),captures=new Map(),cancels=[],ends=[],zooms=[],more=[],pendingLoss=[];
  window.requestAnimationFrame=fn=>{const id=++nextFrame;frames.set(id,fn);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
  Object.defineProperties(viewport,{scrollWidth:{value:2000},scrollHeight:{value:1600},clientWidth:{value:400},clientHeight:{value:300}});
  viewport.scrollLeft=300;viewport.scrollTop=200;
  function event(type,id,x=100,y=100,pointerType='touch'){
    const e=new window.MouseEvent(type,{bubbles:true,cancelable:true,clientX:x,clientY:y,button:0,buttons:type==='pointerup'?0:1,detail:1});
    Object.defineProperties(e,{pointerId:{value:id},pointerType:{value:pointerType}});return e;
  }
  function lost(owner,id){const dispatch=()=>owner.dispatchEvent(event('lostpointercapture',id));if(deferCaptureLoss)pendingLoss.push(dispatch);else dispatch();}
  window.Element.prototype.setPointerCapture=function(id){const old=captures.get(id);if(old===this)return;captures.set(id,this);if(old)lost(old,id);};
  window.Element.prototype.hasPointerCapture=function(id){return captures.get(id)===this;};
  window.Element.prototype.releasePointerCapture=function(id){if(captures.get(id)!==this)return;captures.delete(id);lost(this,id);};
  function installArt(){
    let svg=doc.getElementById('art');
    if(!svg){svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='art';svg.innerHTML='<rect id="object"/>';viewport.append(svg);}
    // These handlers model Studio's existing preview/capture/commit lifecycle.
    svg.addEventListener('pointerdown',e=>{appDown++;editActive=true;(captureOnViewport?viewport:svg).setPointerCapture(e.pointerId);});
    svg.addEventListener('pointermove',()=>{appMove++;});
    svg.addEventListener('pointerup',()=>{appUp++;if(editActive)commits++;editActive=false;});
    svg.addEventListener('lostpointercapture',()=>{lostEditing++;if(editActive){editActive=false;installAfterRemoval();}});
    svg.addEventListener('click',()=>{appClicks++;});
    return svg;
  }
  function installAfterRemoval(){const old=doc.getElementById('art');old?.remove();installArt();}
  installArt();
  // Existing capture listeners are deliberately registered before init. The
  // module's document capture must still run before placement on the viewport.
  viewport.addEventListener('pointerdown',()=>placementStarts++,true);
  const mobile=StudioMobileUI.init({document:doc,viewport,getZoom:()=>zoom,
    zoomAt:(next,anchor)=>{zooms.push({next,anchor});zoom=next;},
    cancelInteraction:details=>{
      cancels.push(details);const wasActive=editActive;editActive=false;
      if(wasActive){
        const old=doc.getElementById('art');
        for(const [id,node]of [...captures])if(node===old||captureOnViewport&&node===viewport)node.releasePointerCapture(id);
        installAfterRemoval();
      }
    },onGestureEnd:details=>ends.push(details),onPanelMore:details=>more.push(details),fit:()=>{zoom=1;}});
  function send(type,id,x=100,y=100,target=doc.getElementById('object'),pointerType='touch'){
    const e=event(type,id,x,y,pointerType),receiver=type==='pointerdown'?target:(captures.get(id)||target);
    receiver.dispatchEvent(e);
    if(type==='pointerup'||type==='pointercancel')captures.get(id)?.releasePointerCapture(id);
    return e;
  }
  function flush(){for(const [id,fn]of [...frames]){frames.delete(id);fn();}}
  function setMedia(value){enabled=value;mediaEvents.dispatchEvent(new window.Event('change'));}
  return {window,doc,viewport,mobile,send,flush,setMedia,captures,cancels,ends,zooms,more,frames,flushLoss:()=>{for(const dispatch of pendingLoss.splice(0))dispatch();},
    stats:()=>({zoom,editActive,commits,lostEditing,appDown,appMove,appUp,appClicks,placementStarts}),destroy(){mobile.destroy();window.close();}};
}

async function run(){
  const h=harness(),{doc,viewport,mobile}=h;
  // JSDOM retains CSS var() expressions. The production token and the semantic
  // mobile selector jointly preserve the 16px input size; actual Chrome is
  // checked separately by test_studio_carbon_mobile_font.cjs.
  const tokens=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/theme-tokens.css'),'utf8');
  assert.match(tokens,/--fs-font-lg:\s*16px\s*;/,'mobile input font token must remain 16px');
  const inputFont=el=>assert.equal(h.window.getComputedStyle(el).fontSize,'var(--fs-font-lg)');
  assert.equal(doc.body.classList.contains('studio-mobile'),true);
  assert.equal(mobile.mode,'pan');assert.equal(doc.getElementById('mobilePan').textContent,'Pan');
  assert.equal(h.window.getComputedStyle(doc.getElementById('mobilePan')).minHeight,'44px');
  assert.equal(h.window.getComputedStyle(doc.querySelector('main')).maxHeight,'none');
  assert.equal(h.window.getComputedStyle(doc.body).overflow,'hidden');
  assert.equal(doc.querySelector('main').getAttribute('role'),'tabpanel');
  assert.equal(doc.querySelector('main').getAttribute('aria-labelledby'),'mobileTab-canvas');
  for(const type of ['text','number']){
    const input=doc.createElement('input');input.type=type;doc.querySelector('.inspector').append(input);
    inputFont(input);input.remove();
  }
  inputFont(doc.getElementById('property'));
  const select=doc.createElement('select');doc.querySelector('.navigator').append(select);
  inputFont(select);select.remove();
  const modeCancels=h.cancels.length;doc.getElementById('mobilePan').click();
  assert.equal(h.cancels.length,modeCancels+1);assert.equal(h.cancels.at(-1).reason,'mode-change');

  // Single touch is owned by Pan before either Studio capture or bubble handlers.
  assert.equal(h.send('pointerdown',1,100,100).defaultPrevented,true);
  h.send('pointermove',1,140,110);assert.equal(h.frames.size,1);h.flush();
  assert.equal(viewport.scrollLeft,260);assert.equal(viewport.scrollTop,190);
  h.send('pointerup',1,140,110);
  assert.equal(h.stats().appDown,0);assert.equal(h.stats().placementStarts,0);assert.equal(h.stats().commits,0);
  assert.equal(h.captures.size,0);assert.deepEqual(h.ends.at(-1),{cancelled:false,reason:'complete'});
  const ghostClick=new h.window.MouseEvent('click',{bubbles:true,cancelable:true,detail:1});doc.getElementById('object').dispatchEvent(ghostClick);
  assert.equal(ghostClick.defaultPrevented,true);assert.equal(h.stats().appClicks,0);

  // Mouse and pen continue through existing handlers even with the touch shell.
  for(const [id,type]of [[2,'mouse'],[3,'pen']]){assert.equal(h.send('pointerdown',id,80,80,undefined,type).defaultPrevented,false);h.send('pointerup',id,80,80,undefined,type);}
  assert.equal(h.stats().appDown,2);assert.equal(h.stats().commits,2);

  // Inputs inside the canvas never start camera movement or cancel editing.
  const input=doc.createElement('input');viewport.append(input);const count=h.cancels.length;
  assert.equal(h.send('pointerdown',4,10,10,input).defaultPrevented,false);
  h.send('pointerup',4,10,10,input);assert.equal(h.cancels.length,count);input.remove();

  // First Edit touch captures the old SVG. Second touch cancels that preview,
  // releases its capture, removes the SVG, then acquires both IDs on viewport.
  mobile.setMode('edit');h.send('pointerdown',10,100,100);
  const old=doc.getElementById('art');assert.equal(h.captures.get(10),old);assert.equal(h.stats().editActive,true);
  const commitsBefore=h.stats().commits,downsBefore=h.stats().appDown;
  assert.equal(h.send('pointerdown',11,200,100).defaultPrevented,true);
  assert.equal(old.isConnected,false);assert.equal(h.stats().lostEditing>0,true);assert.equal(h.stats().editActive,false);
  assert.equal(h.captures.get(10),viewport);assert.equal(h.captures.get(11),viewport);
  h.send('pointermove',11,300,100);h.flush();assert.equal(h.zooms.at(-1).next,2);
  h.send('pointerup',11,300,100);h.send('pointermove',10,120,100);h.flush();h.send('pointerup',10,120,100);
  assert.equal(h.stats().commits,commitsBefore);assert.equal(h.stats().appDown,downsBefore);assert.equal(h.captures.size,0);

  // A cancelled pinch must discard a queued update, consume its remaining touch,
  // and emit one cancelled end. A later touch starts a normal Edit operation.
  h.send('pointerdown',20,100,100);h.send('pointerdown',21,200,100);
  const zoomBefore=h.stats().zoom,endsBefore=h.ends.length;
  h.send('pointermove',21,280,100);assert.equal(h.frames.size,1);
  h.send('pointercancel',21,280,100);h.flush();h.send('pointermove',20,130,100);h.flush();h.send('pointerup',20,130,100);
  assert.equal(h.stats().zoom,zoomBefore);assert.equal(h.ends.length,endsBefore+1);assert.equal(h.ends.at(-1).cancelled,true);assert.equal(h.captures.size,0);
  h.send('pointerdown',22);h.send('pointerup',22);assert.equal(h.stats().commits,commitsBefore+1);

  // Losing a viewport capture cancels the complete gesture, not just one finger.
  mobile.setMode('pan');h.send('pointerdown',30);viewport.releasePointerCapture(30);
  const left=viewport.scrollLeft;h.send('pointermove',30,190,100);h.flush();h.send('pointerup',30,190,100);
  assert.equal(viewport.scrollLeft,left);assert.equal(h.ends.at(-1).cancelled,true);

  // Drawer views remove the hidden regions from keyboard interaction. Controls
  // stay mounted so switching drawers does not discard edits or selection state.
  const region=doc.querySelector('.inspector');mobile.showTab('adjustments');
  assert.equal(doc.querySelector('main').inert,true);assert.equal(region.inert,false);assert.equal(region.getAttribute('aria-hidden'),'false');
  assert.equal(doc.getElementById('mobileTab-adjustments').getAttribute('aria-selected'),'true');
  assert.equal(h.window.getComputedStyle(region).display,'block');
  assert.equal(h.window.getComputedStyle(doc.querySelector('.navigator')).display,'none');
  doc.getElementById('property').focus();mobile.showTab('panels');
  assert.equal(doc.activeElement,doc.getElementById('mobileTab-panels'));
  mobile.showTab('adjustments');
  doc.getElementById('mobileClose-'+region.id).click();assert.equal(doc.body.dataset.mobileTab,'canvas');
  assert.equal(doc.activeElement,doc.getElementById('mobileTab-canvas'));
  doc.getElementById('mobilePanelMore').click();assert.equal(h.more.at(-1).anchor.id,'mobilePanelMore');
  doc.documentElement.lang='zh-CN';await new Promise(resolve=>h.window.setTimeout(resolve,0));
  assert.equal(doc.getElementById('mobileTab-canvas').textContent,'画布');assert.equal(doc.getElementById('mobilePan').textContent,'移动画布');

  // Desktop restoration and teardown clean listeners, frames, captures and ARIA.
  mobile.setMode('pan');h.send('pointerdown',40);h.send('pointermove',40,180,100);assert.equal(h.frames.size,1);
  h.setMedia(false);assert.equal(h.frames.size,0);assert.equal(h.captures.size,0);assert.equal(doc.body.classList.contains('studio-mobile'),false);
  assert.equal(doc.querySelector('main').getAttribute('aria-hidden'),null);
  assert.equal(doc.querySelector('main').getAttribute('role'),null);assert.equal(doc.querySelector('main').getAttribute('aria-labelledby'),null);
  const prior=h.stats().appDown;h.send('pointerdown',41);h.send('pointerup',41);assert.equal(h.stats().appDown,prior+1);
  h.setMedia(true);h.send('pointerdown',42);mobile.destroy();
  assert.equal(h.captures.size,0);assert.equal(doc.getElementById('mobileWorkspaceTabs'),null);assert.equal(doc.querySelector('main').id,'');
  assert.equal(doc.body.classList.contains('studio-mobile'),false);assert.equal(doc.querySelector('.inspector').getAttribute('aria-hidden'),null);
  h.destroy();
  // Studio's gray-area marquee captures the viewport itself. Pointer-capture
  // notifications can arrive after release + reacquisition by the pinch owner.
  const queued=harness({captureOnViewport:true,deferCaptureLoss:true});
  queued.mobile.setMode('edit');queued.send('pointerdown',61,100,100);queued.send('pointerdown',62,200,100);
  queued.flushLoss();assert.equal(queued.captures.get(61),queued.viewport);
  queued.send('pointermove',62,300,100);queued.flush();assert.equal(queued.stats().zoom,2);
  queued.send('pointerup',62,300,100);queued.send('pointerup',61,100,100);queued.flushLoss();
  assert.equal(queued.stats().commits,0);assert.equal(queued.ends.at(-1).cancelled,false);queued.destroy();
  console.log('Mobile DOM: capture-before-placement, SVG replacement takeover, no edit commit, mouse/pen passthrough, cancel/lost capture, drawers, translation and teardown passed.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
