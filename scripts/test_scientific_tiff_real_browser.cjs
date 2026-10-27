'use strict';
// Explicitly supplied, permitted local images. The manifest and generated
// projects/screenshots can contain private data and must not be published.
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert,sha,quantile}=H;
assert.ok(process.argv[2]&&process.argv[3]&&process.argv[4],'Use local URL, permitted-image manifest JSON and private output directory');
const url=H.localUrl(process.argv[2]),manifest=JSON.parse(fs.readFileSync(path.resolve(process.argv[3]),'utf8'));
const out=path.resolve(process.argv[4]);fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const report={author:'a',privateEvidence:true,scope:'Real permitted images in production Chrome with actual local TIFF decoder. Software engineering and byte preservation, not native installation or independent detector accuracy.',browser:browser.version(),cases:[]};
  try{
    for(const entry of manifest){
      assert.ok(fs.statSync(entry.path).isFile());assert.equal(sha(fs.readFileSync(entry.path)),entry.fileSha256);
      const {context,page,remote,errors}=await H.browserPage(browser,{viewport:{width:1600,height:1000}});
      const result={index:entry.index,sourceBytes:entry.bytes,sourceSha256:entry.fileSha256,phases:[]};report.cases.push(result);
      async function measured(name,action){
        await page.evaluate(name=>{const q=window.__nativeTiffEngineering;q.active={name,start:performance.now(),frames:[],longTasks:[]};},name);
        const value=await action();
        const phase=await page.evaluate(()=>{const q=window.__nativeTiffEngineering,p=q.active;q.active=null;return {...p,wallMs:performance.now()-p.start};});
        const frames=phase.frames;result.phases.push({name,procedureWallMs:phase.wallMs,frameCallbackP50Ms:quantile(frames,.5),frameCallbackP95Ms:quantile(frames,.95),maxFrameCallbackGapMs:frames.length?Math.max(...frames):null,longTasks:phase.longTasks.length,longTaskTotalMs:phase.longTasks.reduce((sum,n)=>sum+n,0)});
        return value;
      }
      try{
        await page.goto(url);await H.dismiss(page);await H.newProject(page,'PRIVATE permitted TIFF '+entry.index);
        await page.evaluate(()=>{
          const q=window.__nativeTiffEngineering={active:null,last:performance.now()};
          function frame(now){if(q.active)q.active.frames.push(now-q.last);q.last=now;requestAnimationFrame(frame);}requestAnimationFrame(frame);
          new PerformanceObserver(list=>{if(q.active)for(const item of list.getEntries())q.active.longTasks.push(item.duration);}).observe({type:'longtask'});
        });
        await measured('select-file-to-real-preview',async()=>{
          await page.locator('#importFiles').click();await page.locator('#imageFile').setInputFiles(entry.path);
          await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false,{},{timeout:120000});
        });
        const bits=entry.metadata.pages[0].bitsPerSample[0],maximum=bits===16?65535:255;
        await measured('global-display-adjustment',async()=>{
          await page.locator('#tiffMin').fill('2');await page.locator('#tiffMax').fill(String(maximum-2));await page.locator('#tiffGamma').fill('1.1');
          await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false,{},{timeout:120000});
        });
        await page.locator('#tiffFinalSize').selectOption(String(entry.displayEdge));
        await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false,{},{timeout:120000});
        await measured('keep-selected-resolution',async()=>{
          await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden',timeout:120000});
          await page.locator('#scientificSourceInfo').waitFor({state:'visible'});
        });
        const projectFile=await measured('save-project-download',async()=>{
          const event=page.waitForEvent('download');await page.locator('#save').click();return await(await event).path();
        });
        const saved=JSON.parse(fs.readFileSync(projectFile,'utf8')),asset=saved.project.panels.find(p=>p.id===saved.state.order[0]),native=asset.analysis.scientificImage;
        assert.equal(native.sourceSha256,entry.fileSha256);assert.equal(native.nativeSamplesSha256,entry.nativeSamplesSha256);
        assert.equal(saved.project.scientificSources[entry.fileSha256].data,fs.readFileSync(entry.path).toString('base64'));
        result.nativeSamplesMatch=true;result.projectRetainsOriginalBytes=true;result.projectFileBytes=fs.statSync(projectFile).size;
        await measured('download-original',async()=>{
          const event=page.waitForEvent('download');await page.locator('#downloadScientificSource').click();
          assert.equal(sha(fs.readFileSync(await(await event).path())),entry.fileSha256);
        });
        await H.newProject(page,'PRIVATE empty reopen sentinel');
        await measured('reopen-saved-native-project',async()=>{
          await page.locator('#projectFile').setInputFiles(projectFile);
          await page.locator('#projectTitle').filter({hasText:'PRIVATE permitted TIFF '+entry.index}).waitFor({timeout:120000});
          await page.locator('#scientificSourceInfo').waitFor({state:'visible'});
        });
        assert.equal(sha(fs.readFileSync(entry.path)),entry.fileSha256);assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
        result.inputUnchanged=true;result.remoteRequests=0;result.pageErrors=0;result.passed=true;
        await page.screenshot({path:path.join(out,'private-case-'+entry.index+'.png')});
        console.log('PASS permitted local TIFF case',entry.index,entry.bytes,'bytes; native source/save/reopen/download exact');
      }catch(error){result.passed=false;result.error=error.message;await page.screenshot({path:path.join(out,'private-failure-'+entry.index+'.png')}).catch(()=>{});throw error;}
      finally{fs.writeFileSync(path.join(out,'private-result.json'),JSON.stringify(report,null,2));await context.close();}
    }
    report.passed=true;
  }finally{fs.writeFileSync(path.join(out,'private-result.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
