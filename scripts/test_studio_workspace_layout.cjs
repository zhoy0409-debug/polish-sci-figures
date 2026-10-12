/* Actual resizable-workspace controller with deterministic DOM/RAF/storage. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {fit,init}=require('../skills/polish-sci-figures/assets/figure-studio/workspace-layout.js');
for(const total of [751,800,1200,2200])for(const side of [null,'left','right'])for(const [left,right]of [[220,320],[800,900],[-1,-3],[NaN,Infinity]]){
  const fitted=fit(total,left,right,side);assert.ok(fitted.left>=150);assert.ok(fitted.right>=220);assert.ok(fitted.left+fitted.right+272<=total+1,'center remains at least 260 px, within integer rounding');
}
function node(){const classes=new Set();return{children:[],dataset:{},attrs:{},classList:{add:s=>classes.add(s),remove:s=>classes.delete(s),contains:s=>classes.has(s)},style:{setProperty(k,v){this[k]=v;}},append(n){this.children.push(n);},setAttribute(k,v){this.attrs[k]=String(v);},setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(id){if(this.capture===id)this.capture=null;}};}
const previous=Object.fromEntries(['document','window','localStorage','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,globalThis[k]]));
function harness(storage=new Map(),width=1200){
  const workspace=node(),body=node(),events={},raf=new Map();workspace.clientWidth=width;let serial=0,resizes=0,saves=0,translated=false;
  globalThis.document={querySelector:()=>workspace,body,createElement:()=>node()};globalThis.window={addEventListener:(k,fn)=>events[k]=fn};
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem(key,value){storage.set(key,value);saves++;}};
  globalThis.requestAnimationFrame=fn=>{raf.set(++serial,fn);return serial;};globalThis.cancelAnimationFrame=id=>raf.delete(id);
  const controller=init({resize:()=>resizes++,t:s=>translated?'EN:'+s:s}),left=workspace.children[0],right=workspace.children[1];
  const event=(x,extra={})=>({button:0,buttons:1,clientX:x,pointerId:4,preventDefault(){this.prevented=true;},...extra});
  const flush=()=>{for(const[id,fn]of [...raf]){raf.delete(id);fn();}};
  const widths=()=>({left:parseFloat(workspace.style['--navigator-width']),right:parseFloat(workspace.style['--inspector-width'])});
  return{workspace,body,events,raf,controller,left,right,event,flush,widths,storage,stats:()=>({resizes,saves}),translate(){translated=true;controller.translate();}};
}
try{
  let h=harness();assert.deepEqual(h.widths(),{left:220,right:320});assert.equal(h.left.attrs.role,'separator');assert.equal(h.left.attrs['aria-orientation'],'vertical');assert.equal(h.left.tabIndex,0);assert.equal(h.workspace.children.length,2);
  const baseline=h.stats();h.left.onpointerdown(h.event(100));for(let i=1;i<=30;i++)h.left.onpointermove(h.event(100+i*3));assert.equal(h.raf.size,1);assert.equal(h.stats().resizes,baseline.resizes);assert.equal(h.stats().saves,0);h.flush();assert.deepEqual(h.widths(),{left:310,right:320});assert.equal(h.stats().resizes,baseline.resizes+1);
  h.left.onpointermove(h.event(200));assert.equal(h.raf.size,1);h.left.onpointerup(h.event(200));assert.equal(h.raf.size,0);assert.deepEqual(h.widths(),{left:320,right:320});assert.equal(h.stats().saves,1);assert.equal(h.body.classList.contains('is-resizing-workspace'),false);assert.equal(h.left.capture,null);
  const saved=h.storage;h=harness(saved);assert.deepEqual(h.widths(),{left:320,right:320},'saved widths restore on reopen');h.right.onpointerdown(h.event(900));h.right.onpointermove(h.event(950));h.flush();assert.deepEqual(h.widths(),{left:320,right:270});h.right.onpointerup();assert.equal(h.stats().saves,1);
  for(const reason of ['cancel','lost','blur','buttons','escape']){h=harness();h.left.onpointerdown(h.event(100));h.left.onpointermove(h.event(180));h.flush();assert.equal(h.widths().left,300);if(reason==='cancel')h.left.onpointercancel();if(reason==='lost')h.left.onlostpointercapture();if(reason==='blur')h.events.blur();if(reason==='buttons')h.left.onpointermove(h.event(180,{buttons:0}));if(reason==='escape')h.left.onkeydown(h.event(0,{key:'Escape'}));assert.deepEqual(h.widths(),{left:220,right:320});assert.equal(h.stats().saves,0);assert.equal(h.body.classList.contains('is-resizing-workspace'),false);h.left.onpointerup();assert.equal(h.stats().saves,0);}
  h=harness();h.left.onpointerdown(h.event(100));h.left.onpointermove(h.event(160));assert.equal(h.raf.size,1);h.left.onpointercancel();assert.equal(h.raf.size,0);h.flush();assert.deepEqual(h.widths(),{left:220,right:320},'cancel removes a queued frame');
  h=harness();h.left.onpointerdown(h.event(100,{button:2}));h.left.onpointermove(h.event(200));assert.equal(h.raf.size,0);assert.equal(h.stats().saves,0);
  h=harness();h.left.onkeydown(h.event(0,{key:'ArrowRight'}));assert.equal(h.widths().left,230);h.left.onkeydown(h.event(0,{key:'ArrowLeft',shiftKey:true}));assert.equal(h.widths().left,190);h.left.onkeydown(h.event(0,{key:'Home'}));assert.equal(h.widths().left,220);h.right.onkeydown(h.event(0,{key:'ArrowRight',shiftKey:true}));assert.equal(h.widths().right,280);h.right.ondblclick();assert.equal(h.widths().right,320);assert.equal(h.stats().saves,5);
  h=harness();h.left.onpointerdown(h.event(0));h.left.onpointermove(h.event(10000));h.flush();assert.ok(h.widths().left+h.widths().right<=928);h.left.onpointerup();h.right.onpointerdown(h.event(1000));h.right.onpointermove(h.event(-10000));h.flush();assert.ok(h.widths().left>=150&&h.widths().right>=220);assert.ok(h.widths().left+h.widths().right<=928);h.right.onpointerup();
  for(const side of ['left','right']){h=harness();const handle=h[side],origin=side==='left'?100:900,sign=side==='left'?1:-1;handle.onpointerdown(h.event(origin));handle.onpointermove(h.event(origin+sign*800));h.flush();const maximum=h.widths()[side];handle.onpointermove(h.event(origin+sign*790));h.flush();assert.equal(h.widths()[side],maximum-10,'reversing after a clamped drag moves immediately, without an overshoot dead zone');handle.onpointercancel();}
  h.translate();assert.ok(h.left.attrs['aria-label'].startsWith('EN:'));assert.ok(h.right.title.startsWith('EN:'));
  h=harness();h.left.onpointerdown(h.event(100));h.left.onpointermove(h.event(180));h.left.onpointerup();assert.deepEqual(h.widths(),{left:300,right:320});h.workspace.clientWidth=600;h.events.resize();h.events.resize();assert.equal(h.raf.size,1);h.flush();h.workspace.clientWidth=1200;h.events.resize();h.flush();assert.deepEqual(h.widths(),{left:300,right:320},'mobile roundtrip preserves the user width preference');
  const malformed=new Map([['figure-studio-workspace-widths-v1','not-json']]);h=harness(malformed);assert.deepEqual(h.widths(),{left:220,right:320});
  const css=fs.readFileSync(require.resolve('../skills/polish-sci-figures/assets/figure-studio/workspace-layout.css'),'utf8');assert.match(css,/@media\(max-width:750px\)/);assert.match(css,/prefers-reduced-motion/);
  console.log('PASS resizable workspace: fit bounds, one RAF per burst, final unflushed movement, persisted reopen, cancel/capture/blur/buttons/Escape, keyboard/reset, mobile preference roundtrip, malformed storage and translated handles. Node DOM scope.');
}finally{for(const[k,v]of Object.entries(previous))if(v===undefined)delete globalThis[k];else globalThis[k]=v;}
