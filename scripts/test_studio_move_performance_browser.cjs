'use strict';
// Geometry/history correctness and event-to-paint latency are measured separately
// from CPU profiling and video recording. Only labelled synthetic SVG is used.
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H,[,,url,outArg,mode='candidate',countArg='5000']=process.argv;
const count=Number(countArg),out=path.resolve(outArg);assert(url&&outArg);assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const report={author:'a',platform:process.platform,architecture:process.arch,mode,elements:count,scope:'Synthetic SVG, real pointer events to second rAF; no profiler/video overhead, not arbitrary-project latency certification',samples:[],errors:[]};
const near=(a,b,message)=>assert(Math.abs(a-b)<.2,`${message}: ${a} / ${b}`);
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),{page:p,context,errors,remote}=await H.browserPage(browser);p.setDefaultTimeout(15000);
try{
 await p.goto(url);await H.newProject(p,'SYNTHETIC move performance '+count);await H.loadSvg(p,H.pressureSvg(count));await p.locator('#zoom').selectOption('1');
 const target=p.locator('#artboard rect[data-key]').first();await target.click();
 const initial=await H.save(p),root=await p.locator('#artboard>svg').elementHandle(),untouched=await p.locator('#artboard rect[data-key]').last().elementHandle();
 const source=JSON.stringify(initial.project.panels),initialBox=await target.boundingBox();let latest=initial;
 for(let i=0;i<14;i++){
  const b=await target.boundingBox(),dx=i%2?-15:15,dy=i%2?-7:7;
  await p.keyboard.down('Alt');await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:3});
  await p.evaluate(()=>{window.__movePaint=new Promise(resolve=>document.addEventListener('pointerup',()=>{const start=performance.now();requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(performance.now()-start)));},{once:true,capture:true}));});
  await p.mouse.up();const ms=await p.evaluate(()=>window.__movePaint);await p.keyboard.up('Alt');
  if(i>=2)report.samples.push(ms);
  const after=await target.boundingBox();near(after.x,b.x+dx,'Final pointer x');near(after.y,b.y+dy,'Final pointer y');
  const saved=await H.save(p);assert.equal(saved.history.index,latest.history.index+1,'One undo entry per drag');assert.equal(JSON.stringify(saved.project.panels),source,'Original SVG/data are immutable');latest=saved;
  if(mode==='candidate'){assert(await root.evaluate(n=>n.isConnected),'Pure movement must retain the canvas');assert(await untouched.evaluate(n=>n.isConnected),'Unselected nodes must be retained');}
 }
 report.p50=H.quantile(report.samples,.5);report.p95=H.quantile(report.samples,.95);report.max=Math.max(...report.samples);
 const moved=await H.save(p);
 // Retained motion must remain compatible with the existing resize controller.
 const handle=p.locator('[data-selection-resize="se"]');if(!await handle.isVisible())await target.click();await handle.waitFor();const h=await handle.boundingBox(),b=await target.boundingBox();await p.mouse.move(h.x+h.width/2,h.y+h.height/2);await p.mouse.down();await p.mouse.move(h.x+h.width/2+12,h.y+h.height/2+6,{steps:3});await p.mouse.up();assert((await target.boundingBox()).width>b.width);await p.locator('#undo').click();assert.deepEqual((await H.save(p)).state,moved.state);
 const beforeReopen=await target.boundingBox();await H.loadProject(p,moved);const reopened=await target.boundingBox();near(reopened.x,beforeReopen.x,'Canonical reopen x');near(reopened.y,beforeReopen.y,'Canonical reopen y');assert.deepEqual((await H.save(p)).state,moved.state);
 const modifier=process.platform==='darwin'?'Meta':'Control';await p.locator('#viewport').click({position:{x:5,y:5}});await p.keyboard.press(modifier+'+z');const undone=await H.save(p);assert.equal(undone.history.index,moved.history.index-1);await p.keyboard.press(modifier+'+Shift+z');assert.deepEqual((await H.save(p)).state,moved.state);
 // A cancelled translation must leave both the model and its visible position.
 await target.click();const c=await target.boundingBox();await p.mouse.move(c.x+c.width/2,c.y+c.height/2);await p.mouse.down();await p.mouse.move(c.x+c.width/2+25,c.y+c.height/2+11,{steps:2});await p.locator('#artboard>svg').dispatchEvent('pointercancel',{pointerId:1});await p.mouse.up();assert.deepEqual((await H.save(p)).state,moved.state);const cancelled=await target.boundingBox();near(cancelled.x,c.x,'Cancel x');near(cancelled.y,c.y,'Cancel y');
 const exported=await H.exportBytes(p,'export');assert.match(exported.toString(),/<svg/);report.originalSourcePreserved=true;report.oneUndoPerMove=true;report.canonicalReopen=true;report.resizeAfterMove=true;report.cancelRestored=true;report.samplesCount=report.samples.length;
 if(mode==='candidate'){report.pointerUpP95LimitMs=count>=10000?150:100;assert(report.p95<=report.pointerUpP95LimitMs,`Pointer-up p95 ${report.p95.toFixed(1)} ms exceeds ${report.pointerUpP95LimitMs} ms`);}
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.passed=true;
}catch(e){report.error=e.stack;await p.screenshot({path:path.join(out,'failure.png')});throw e;}finally{report.errors=errors;report.remote=remote;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await context.close();await browser.close();}console.log(JSON.stringify({passed:report.passed,mode,elements:count,p50:report.p50,p95:report.p95,max:report.max,oneUndoPerMove:report.oneUndoPerMove,canonicalReopen:report.canonicalReopen}));})().catch(e=>{console.error(e);process.exitCode=1;});
