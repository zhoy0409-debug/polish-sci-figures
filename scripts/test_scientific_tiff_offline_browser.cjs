'use strict';
// Real file:// editor and Worker, with independent Pillow native/display goldens.
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs'),{pathToFileURL}=require('node:url');
const {fs,path,assert,sha}=H;
const [,,html,fixturesPath,outArg]=process.argv,out=path.resolve(outArg);fs.mkdirSync(out,{recursive:true});
(async()=>{
 const fixtures=JSON.parse(fs.readFileSync(fixturesPath)),report={author:'a',scope:'Offline browser and real embedded decoder; public synthetic files, independent Pillow golden native samples and display pixels',cases:[]};
 const browser=await chromium.launch({headless:true,...(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:process.env.STUDIO_TIFF_BROWSER||'chrome'})}),{context,page,errors,remote}=await H.browserPage(browser);
 try{
 await page.goto(pathToFileURL(path.resolve(html)).href);await page.locator('#language').selectOption('zh-CN');await H.newProject(page,'SYNTHETIC offline TIFF');
 for(const fixture of fixtures){
  const result=await page.evaluate(async f=>{
   const adapter=StudioScientificTiffBrowser.create();let id;
   try{const bytes=Uint8Array.from(atob(f.data),c=>c.charCodeAt(0)),file=new File([bytes],f.name+'.tiff',{type:'image/tiff'}),opened=await adapter.upload(file);id=opened.sourceId;
    const result=await adapter.request({sourceId:id,action:'display',page:f.page||0,window:f.window||[0,65535],gamma:f.gamma||1,lut:f.lut||'gray'});
    const png=new Blob([Uint8Array.from(atob(result.display.data),c=>c.charCodeAt(0))],{type:'image/png'}),image=await createImageBitmap(png),canvas=new OffscreenCanvas(image.width,image.height),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,image.width,image.height).data,rgb=new Uint8Array(image.width*image.height*3);for(let i=0;i<rgb.length/3;i++)rgb.set(rgba.subarray(i*4,i*4+3),i*3);
    return {ok:true,native:result.native.samplesSha256,file:opened.metadata.fileSha256,rgb:await StudioScientificTiff.digest(rgb),ome:opened.metadata.ome};
   }catch(e){return {ok:false,error:e.message};}finally{adapter.destroy();}
  },fixture);
  report.cases.push({name:fixture.name,...result});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
  assert.equal(result.ok,fixture.valid,fixture.name+' '+result.error);if(fixture.valid){assert.equal(result.native,fixture.native,fixture.name+' native');assert.equal(result.file,fixture.fileSha256);assert.equal(result.rgb,fixture.displayRgbSha256,fixture.name+' pixels');}
  console.log('PASS '+fixture.name);
 }
 const fixture=fixtures.find(f=>f.name==='u16-tiff_lzw'),before=await H.save(page);
 await H.openImport(page);await page.locator('#imageFile').setInputFiles({name:'SYNTHETIC-offline.tiff',mimeType:'image/tiff',buffer:Buffer.from(fixture.data,'base64')});await page.waitForFunction(()=>document.querySelector('#tiffKeep')?.disabled===false);
 assert.match(await page.locator('#tiffStatus').innerText(),/保留并导入/);await page.screenshot({path:path.join(out,'offline-tiff-preview.png')});await page.locator('#tiffCancel').click();assert.deepEqual((await H.save(page)).state,before.state);
 await H.openImport(page);await page.locator('#imageFile').setInputFiles({name:'SYNTHETIC-offline.tiff',mimeType:'image/tiff',buffer:Buffer.from(fixture.data,'base64')});await page.waitForFunction(()=>document.querySelector('#tiffKeep')?.disabled===false);await page.locator('#tiffSuggest').click();await page.waitForFunction(()=>document.querySelector('#tiffKeep')?.disabled===false);await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
 const saved=await H.save(page),record=saved.project.panels.find(p=>p.analysis.scientificImage)?.analysis.scientificImage;assert.equal(record.nativeSamplesSha256,fixture.native);assert.equal(record.sourceSha256,fixture.fileSha256);assert.equal(saved.project.scientificSources[fixture.fileSha256].data,fixture.data);assert.equal(saved.history.index-before.history.index,1);
 await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,before.state);await H.loadProject(page,saved);assert.deepEqual((await H.save(page)).state,saved.state);await H.revealTool(page,'scientificSourceInfo');assert(await page.locator('#newScientificDisplay').isEnabled());
 await page.locator('#newScientificDisplay').click();await page.waitForFunction(()=>document.querySelector('#tiffKeep')?.disabled===false);await page.locator('#tiffCancel').click();assert.deepEqual((await H.save(page)).state,saved.state);
 const invalid=fixtures.find(f=>f.name==='float-refused');await H.openImport(page);await page.locator('#imageFile').setInputFiles({name:'UNSUPPORTED-float.tiff',mimeType:'image/tiff',buffer:Buffer.from(invalid.data,'base64')});await page.locator('#tiffStatus[role="alert"]').waitFor();assert(await page.locator('#tiffKeep').isDisabled());await page.locator('#tiffCancel').click();assert.deepEqual((await H.save(page)).state,saved.state);
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.ui={cancel:true,keep:true,undo:true,reopen:true,newDisplay:true,originalBytes:true,remoteRequests:0,pageErrors:0};report.passed=true;fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
