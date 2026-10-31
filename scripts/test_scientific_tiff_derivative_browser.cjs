'use strict';
// Encoded six-pixel public TIFF: actual editor transactions and local engines.
// This is a provenance regression, not geometry detection accuracy or native UI.
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs'),fixture=require('./fixtures/scientific-tiff-uint16.json');
const {fs,path,assert}=H,url=H.localUrl(process.argv[2]||'http://127.0.0.1:19531/'),out=path.resolve(process.argv[3]||'.cache/next-stable-windows-20261028/browser-tiff-derivative-r1');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{headless:true}:{channel:process.env.STUDIO_TIFF_BROWSER||'chrome',headless:true}),{context,page,remote,errors}=await H.browserPage(browser,{viewport:{width:1600,height:1000},recordVideo:{dir:path.join(out,'video')}}),checks=[];
  async function original(){const event=page.waitForEvent('download');await page.locator('#downloadScientificSource').click();assert.equal(fs.readFileSync(await(await event).path()).toString('base64'),fixture.data);}
  async function preview(){
    await page.locator('#artboard image[data-key]').first().click();if(await page.locator('.studio-drawers').count()){await page.locator('#drawerTaskbar [data-drawer-category="image"]').click();await page.locator('[data-drawer-tool="rectify"]').click();}else{await page.locator('[data-workflow="images"]').click();await page.locator('#imageTool-rectify').click();}await page.locator('#imageRectifyDialog').waitFor({state:'visible'});
    const quad=[{x:0,y:0},{x:3,y:0},{x:3,y:2},{x:0,y:2}];
    for(let i=0;i<4;i++)for(const axis of ['x','y'])await page.locator('[data-rectify-coordinate="'+i+'-'+axis+'"]').fill(String(quad[i][axis]));
    await page.locator('[data-rectify="width"]').fill('3');await page.locator('[data-rectify="preview"]').click();
    await page.waitForFunction(()=>document.getElementById('imageRectifyDialog')?.dataset.state==='previewing'&&!document.querySelector('[data-rectify="apply"]').disabled,{},{timeout:60000});
  }
  try{
    await page.goto(url);await H.dismiss(page);await H.newProject(page,'PUBLIC native TIFF correction provenance');
    await H.openImport(page);await page.locator('#imageFile').setInputFiles({name:fixture.name,mimeType:'image/tiff',buffer:Buffer.from(fixture.data,'base64')});
    await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false);await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
    const baseline=await H.save(page),sourcePanel=baseline.project.panels.find(p=>p.id===baseline.state.order[0]);await original();
    await preview();const draft=await H.save(page);assert.deepEqual(draft.project,baseline.project);assert.deepEqual(draft.state,baseline.state);await page.locator('[data-rectify="cancel"]').click();
    const cancelled=await H.save(page);assert.deepEqual(cancelled.project,baseline.project);assert.deepEqual(cancelled.history,baseline.history);checks.push('Native-TIFF correction preview/cancel retains the exact source, project and history');
    await preview();await page.locator('[data-rectify="apply"]').click();await page.locator('#imageRectifyDialog').waitFor({state:'hidden'});await page.locator('#scientificSourceInfo').waitFor({state:'visible'});
    const kept=await H.save(page),panel=kept.project.panels.find(p=>p.id===kept.state.order[0]),origin=panel.analysis.scientificOrigin;
    assert.equal(origin.sourcePanelId,sourcePanel.id);assert.equal(origin.sourceSha256,sourcePanel.analysis.scientificImage.sourceSha256);assert.equal(origin.displaySha256,sourcePanel.analysis.scientificImage.display.sha256);
    assert.equal(panel.analysis.scientificImage,undefined,'a corrected display must not claim to be an untransformed native plane');assert.equal(panel.analysis.imageRectification.sourceSha256,origin.displaySha256);assert.equal(panel.analysis.imageRectification.calibrationInherited,false);
    assert.equal(kept.history.index,baseline.history.index+1);assert.deepEqual(kept.project.scientificSources,baseline.project.scientificSources);assert.match(await page.locator('#scientificSourceText').textContent(),/未继承标定/);await original();checks.push('Keep records one undo, original display-to-TIFF lineage, separate display-only correction and no inherited calibration; raw TIFF still downloads exactly');
    if(await page.locator('.studio-drawers').count()){assert(await page.locator('.rectify-completed').isVisible());await page.locator('.rectify-completed [data-rectify="colour"]').click();await page.locator('#imageColorDialog').waitFor({state:'visible'});assert.equal(await page.locator('.studio-tool-bank').getAttribute('data-tool'),'color');await page.locator('[data-color="cancel"]').click();assert.deepEqual((await H.save(page)).state,kept.state);checks.push('The real post-correction colour action opens its canonical image-display drawer and Cancel preserves the correction');}
    if(!await page.locator('.studio-drawers').count())await page.locator('[data-tab="detail"]').click();assert.match(await page.locator('[data-rectify="version"] option[value="original"]').textContent(),/校正前显示图/);
    await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,baseline.state);await page.locator('#redo').click();assert.deepEqual((await H.save(page)).state,kept.state);await original();
    const reopened=JSON.parse(JSON.stringify(kept));reopened.project.title='PUBLIC verified corrected native TIFF';await H.loadProject(page,reopened);await page.waitForFunction(title=>document.getElementById('projectTitle').textContent===title,reopened.project.title);await original();checks.push('Undo/redo and project reopen preserve source access and retained native bytes');
    await preview();await page.locator('[data-rectify="apply"]').click();await page.locator('#imageRectifyDialog').waitFor({state:'hidden'});const repeated=await H.save(page),again=repeated.project.panels.find(p=>p.id===repeated.state.order[0]);assert.deepEqual(again.analysis.scientificOrigin,origin);assert.deepEqual(repeated.project.scientificSources,baseline.project.scientificSources);await original();checks.push('Repeated correction refers to the same retained native original without duplicating bytes or creating a false native-pixel claim');
    const bad=JSON.parse(JSON.stringify(repeated));bad.project.panels.find(p=>p.id===bad.state.order[0]).analysis.scientificOrigin.sourceSha256='0'.repeat(64);await H.loadProject(page,bad,'PUBLIC-bad-lineage.json',{expectReplacement:false});await page.locator('#status').filter({hasText:/derivative/}).waitFor();assert.deepEqual((await H.save(page)).project,repeated.project);checks.push('Tampered original lineage is rejected without replacing the active project');
    const missing=JSON.parse(JSON.stringify(repeated));delete missing.project.scientificSources;for(const p of missing.project.panels)delete p.analysis.scientificImage;await H.loadProject(page,missing,'PUBLIC-missing-lineage.json',{expectReplacement:false});await page.locator('#status').filter({hasText:/derivative/}).waitFor();assert.deepEqual((await H.save(page)).project,repeated.project);checks.push('Removing the native source store and base record cannot bypass derivative validation');
    await page.locator('#newScientificDisplay').click();await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false);
    assert.equal(await page.locator('#tiffPage').inputValue(),String(sourcePanel.analysis.scientificImage.page));
    assert.equal(await page.locator('#tiffMax').inputValue(),String(sourcePanel.analysis.scientificImage.display.window[1]));
    await page.locator('#tiffGamma').fill('1.5');await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false);
    assert.deepEqual((await H.save(page)).project,repeated.project);await page.locator('#tiffCancel').click();
    assert.deepEqual((await H.save(page)).state,repeated.state);
    await page.locator('#newScientificDisplay').click();await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false);
    await page.locator('#tiffGamma').fill('1.5');await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false);
    await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
    const redisplayed=await H.save(page),newPanel=redisplayed.project.panels.find(p=>p.id===redisplayed.state.order.at(-1));
    assert.equal(redisplayed.state.order.length,2);assert.equal(redisplayed.history.index,repeated.history.index+1);
    assert.deepEqual(redisplayed.state.panels[again.id],repeated.state.panels[again.id]);
    assert.deepEqual(redisplayed.project.panels.find(p=>p.id===again.id),again);
    assert.deepEqual(redisplayed.project.scientificSources,repeated.project.scientificSources);
    assert.equal(newPanel.analysis.scientificImage.nativeSamplesSha256,sourcePanel.analysis.scientificImage.nativeSamplesSha256);
    assert.equal(newPanel.analysis.scientificImage.display.gamma,1.5);
    assert.equal(newPanel.analysis.scientificOrigin,undefined);assert.equal(newPanel.analysis.imageRectification,undefined);
    await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,repeated.state);await original();
    await page.locator('#redo').click();assert.deepEqual((await H.save(page)).state,redisplayed.state);await original();
    checks.push('A corrected derivative can create a new native-plane display with inherited display parameters, while retaining its own correction/state and original bytes; cancel, one undo and redo verified');
    assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);await page.locator('#scientificSourceInfo').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'public-native-tiff-correction-source.png')});fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({author:'a',scope:'Public six-pixel synthetic TIFF, production Chrome and actual local decoder/correction engine; provenance only, not independent detection accuracy or Windows installation',browser:browser.version(),checks,remoteRequests:0,pageErrors:[],passed:true},null,2));checks.forEach(x=>console.log('PASS '+x));
  }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
