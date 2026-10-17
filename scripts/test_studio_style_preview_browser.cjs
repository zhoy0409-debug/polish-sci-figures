'use strict';
// Browser DOM correctness for reversible paint patches; full editor parity is
// covered separately. This is not a scientific image accuracy benchmark.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:false,args:['--no-first-run','--no-default-browser-check']});
 try{
  const page=await browser.newPage();
  await page.setContent('<svg xmlns="http://www.w3.org/2000/svg"><text id="t" x="20" y="30" style="fill:#123456 !important;letter-spacing:1px">P<tspan style="font-style:italic">value</tspan></text><rect id="r" width="40" height="40" fill="none" stroke="#314159"/><image id="i" width="1" height="1"/></svg>');
  await page.addScriptTag({path:path.join(ROOT,'skills/polish-sci-figures/assets/figure-studio/style-preview.js')});
  const result=await page.evaluate(()=>{
   const t=document.getElementById('t'),r=document.getElementById('r'),i=document.getElementById('i'),svg=document.querySelector('svg'),source=svg.outerHTML,child=t.firstElementChild,p=StudioStylePreview.create();
   for(let n=0;n<30;n++)p.paint([{node:t,props:{fill:n===29?'#abcdef':'#445566'}}]);
   if(getComputedStyle(t).fill!=='rgb(171, 205, 239)'||t.firstElementChild!==child||p.size!==1)throw Error('Continuous input must update only existing paint nodes');
   const last=svg.outerHTML;let caught=0;
   for(const patch of [[{node:r,props:{stroke:'#ffffff'}},{node:t,props:{fill:'url(#private)'}}],[{node:i,props:{fill:'#ffffff'}}],[{node:t,props:{'font-size':'12'}}],[{node:t,props:{opacity:'NaN'}}]]){try{p.paint(patch);}catch{caught++;}if(svg.outerHTML!==last)throw Error('Invalid patch changed the last valid canvas');}
   p.paint([{node:r,props:{stroke:'#ffffff',opacity:'0.5'}}]);
   if(t.getAttribute('style')!=='fill:#123456 !important;letter-spacing:1px'||r.getAttribute('fill')!=='none')throw Error('Changing targets must restore the first exact style and preserve hollow fill');
   p.restore();if(svg.outerHTML!==source||p.size!==0)throw Error('Cancel must restore exact SVG attributes, priorities and child identity: '+JSON.stringify({source,actual:svg.outerHTML,size:p.size}));
   p.paint([{node:t,props:{fill:'#ffffff'}},{node:r,props:{stroke:'#ffffff'}}]);t.remove();p.restore();svg.prepend(t);if(svg.outerHTML!==source)throw Error('Detached nodes must also restore without retaining a draft');
   return {groups:5,invalidBatches:caught,inputs:30,exactSvgRestored:true,childIdentityPreserved:t.firstElementChild===child};
  });
  assert.equal(result.invalidBatches,4);assert.equal(result.childIdentityPreserved,true);
  const out=path.resolve(process.env.STUDIO_STYLE_PREVIEW_PROOF||path.join(ROOT,'.cache/live-preview-style-component-'+Date.now()));assert.ok(!fs.existsSync(out),'Never overwrite earlier component evidence');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({...result,status:'PASS_COMPONENT_ONLY',browser:browser.version(),at:new Date().toISOString()},null,2));console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
