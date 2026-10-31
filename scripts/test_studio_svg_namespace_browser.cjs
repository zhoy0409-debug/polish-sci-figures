'use strict';
// Explicit two-snapshot comparison using public fixtures; no installed UI claim.
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs'),{fs,path,assert,sha}=H;
const a=Object.fromEntries(process.argv.slice(2).map(x=>{const i=x.indexOf('=');assert.ok(i>2);return[x.slice(2,i),x.slice(i+1)];}));
for(const name of ['before-url','after-url','before-html','after-html','out'])assert.ok(a[name],name+' required');
const out=path.resolve(a.out);assert.ok(!fs.existsSync(out),'Never overwrite an earlier comparison');fs.mkdirSync(out,{recursive:true});
const ids='<svg xmlns="http://www.w3.org/2000/svg" width="500pt" height="300pt" viewBox="0 0 500 300"><defs><clipPath id="clip"><rect x="25" y="45" width="420" height="220"/></clipPath><linearGradient id="gradient"><stop offset="0" stop-color="#4477aa"/><stop offset="1" stop-color="#66aabb"/></linearGradient><path id="mark" d="M -3 0 L 0 -3 L 3 0 L 0 3 Z"/></defs><text x="25" y="28" font-size="14" font-family="Arial">PUBLIC linked SVG references</text><g clip-path="url(#clip)"><rect x="20" y="40" width="450" height="240" fill="url(#gradient)"/><use href="#mark" x="90" y="100" fill="#aa3377"/><use href="#mark" x="320" y="210" fill="#332288"/></g></svg>';
const inputs=[{name:'plain-5000',svg:H.pressureSvg(5000)},{name:'local-id-references',svg:ids},{name:'iris150-public-he',iris:true}];
const report={author:'a',scope:'Actual Chrome and two exact frozen production HTML snapshots, public scientific data and public SVG fixtures. Not installed Windows, physical latency or independent image detection accuracy.',checks:[],comparisons:[]};
async function pixels(page,bytes){return page.evaluate(async data=>{const image=await createImageBitmap(new Blob([new Uint8Array(data)],{type:'image/png'}));try{const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;return{width:canvas.width,height:canvas.height,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',rgba))].map(v=>v.toString(16).padStart(2,'0')).join('')};}finally{image.close();}},[...bytes]);}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version();
 try{
  const snapshots={};
  for(const which of ['before','after']){
   const url=H.localUrl(a[which+'-url']),html=fs.readFileSync(a[which+'-html']);
   snapshots[which]=[];
   for(const input of inputs){
    const {context,page,remote,errors}=await H.browserPage(browser,{viewport:{width:1440,height:900}});
    try{
     const response=await context.request.get(url);assert.equal(sha(await response.body()),sha(html),'Actual served HTML must match the explicit immutable snapshot');
     await page.goto(url);await H.dismiss(page);
     if(input.iris){await H.loadProject(page,H.publicIris());await H.loadSvg(page,H.publicHe().svg);}
     else{await H.newProject(page,'PUBLIC SVG isolation comparison');await H.loadSvg(page,input.svg);}
     const saved=await H.save(page),source=JSON.stringify(saved.project.panels.map(p=>({variants:p.variants,table:p.table,analysis:p.analysis}))),state=JSON.stringify(saved.state);
     const exported=await H.exportBytes(page,'export'),png=await H.exportBytes(page,'png'),raster=await pixels(page,png);
     const after=await H.save(page);assert.equal(JSON.stringify(after.project.panels.map(p=>({variants:p.variants,table:p.table,analysis:p.analysis}))),source);assert.equal(JSON.stringify(after.state),state);
     const record={name:input.name,htmlSha256:sha(html),sourceSha256:sha(source),stateSha256:sha(state),rawSvgSha256:sha(exported),canonicalSvgSha256:sha(H.canonicalSvg(exported)),pngSha256:sha(png),decodedPng:raster,remoteRequests:remote.length,pageErrors:errors};
     if(input.iris)assert.equal(saved.project.panels.find(p=>p.table?.rows?.length===151).table.rows.length-1,150);
     fs.writeFileSync(path.join(out,which+'-'+input.name+'.svg'),exported);fs.writeFileSync(path.join(out,which+'-'+input.name+'.png'),png);await page.screenshot({path:path.join(out,which+'-'+input.name+'-canvas.png')});
     assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);snapshots[which].push(record);
    }finally{await context.close();}
   }
  }
  for(let i=0;i<inputs.length;i++){
   const before=snapshots.before[i],after=snapshots.after[i];assert.equal(before.sourceSha256,after.sourceSha256,'Source variants, measurement rows and analysis stay identical across snapshots');
   assert.equal(before.canonicalSvgSha256,after.canonicalSvgSha256,'Only the existing incrementing fNN- ID prefix may differ');assert.deepEqual(before.decodedPng,after.decodedPng,'Actual decoded export pixels must be identical');
   report.comparisons.push({name:inputs[i].name,before,after,sourceEqual:true,canonicalSvgEqual:true,decodedExportPixelsEqual:true});
  }
  report.checks=['5000-object plain SVG source and decoded PNG export retained','Local clip/gradient/use references retain the same exported artwork','150 real Iris observations and licensed public H&E source retain SVG, data, analysis and decoded PNG pixels'];report.passed=true;
 }catch(error){report.passed=false;report.error=error.stack;throw error;}
 finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();}
 report.checks.forEach(check=>console.log('PASS '+check));
})().catch(error=>{console.error(error);process.exitCode=1;});
