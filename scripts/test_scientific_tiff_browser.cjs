'use strict';
// Production Chrome + the real loopback decoder. Synthetic byte fixtures are
// engineering checks, not a native installed-app or detector-accuracy claim.
const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert,sha}=H,fixture=require('./fixtures/scientific-tiff-uint16.json');
const url=H.localUrl(process.argv[2]||'http://127.0.0.1:19529/');
const out=path.resolve(process.argv[3]||'.cache/next-stable-windows-20261028/browser-tiff-source-1');
fs.mkdirSync(out,{recursive:true});

(async()=>{
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{headless:true}:{channel:process.env.STUDIO_TIFF_BROWSER||'chrome',headless:true});
  const {context,page,remote,errors}=await H.browserPage(browser,{viewport:{width:1600,height:1000},recordVideo:{dir:path.join(out,'video')}});
  const checks=[],report={author:'a',scope:'Production Chrome and real local Pillow TIFF API; public synthetic byte fixture; not Windows installation or independent image-detection accuracy',browser:browser.version(),checks};
  const transportErrors=[];let binaryUploads=0;
  page.on('request',request=>{
    if(new URL(request.url()).pathname!=='/api/import-tiff'||request.method()!=='POST')return;
    if(request.headers()['content-type']==='image/tiff'){binaryUploads++;return;}
    try{const body=request.postData(),payload=JSON.parse(body);if('data'in payload||!payload.sourceId||body.length>4096)transportErrors.push('display requests must use short local IDs, never repeated original base64');}
    catch{transportErrors.push('invalid TIFF control transport');}
  });
  const original=Buffer.from(fixture.data,'base64');
  async function save(name){const value=await H.save(page);fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2));return value;}
  async function startImport(){
    await page.locator('#importFiles').click();
    await page.locator('#imageFile').setInputFiles({name:fixture.name,mimeType:'image/tiff',buffer:original});
    await page.locator('#scientificTiffWorkspace').waitFor({state:'visible'});
    await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false,{},{timeout:30000});
  }
  async function ready(){await page.waitForFunction(()=>document.getElementById('tiffKeep')?.disabled===false,{},{timeout:30000});}
  try{
    await page.goto(url);await H.dismiss(page);await H.newProject(page,'PUBLIC synthetic TIFF acceptance');
    const before=await save('before.json');
    await startImport();
    assert.equal(await page.locator('#artboard > svg[data-preview-kind="scientific-tiff"]').count(),1);
    const during=await save('during-preview.json');
    assert.deepEqual(during.project,before.project,'native source store and imported asset remain ephemeral until Keep');
    assert.deepEqual(during.state,before.state);assert.deepEqual(during.history,before.history);
    await page.locator('#tiffMin').fill('100');await page.locator('#tiffMax').fill('4095');
    await page.locator('#tiffGamma').fill('1.4');await page.locator('#tiffLut').selectOption('green');await ready();
    await page.screenshot({path:path.join(out,'native-display-preview.png')});
    await page.locator('#language').selectOption('en');
    assert.equal(await page.locator('#scientificTiffWorkspace h2').textContent(),'Native TIFF display');
    assert.match(await page.locator('#tiffPage option').first().textContent(),/^Page 1/);
    await page.locator('#appearanceMenu summary').click();await page.locator('#studioTheme').selectOption('pearl');await page.locator('#appearanceMenu summary').click();
    await page.screenshot({path:path.join(out,'native-display-pearl-english.png')});
    await page.locator('#appearanceMenu summary').click();await page.locator('#studioTheme').selectOption('carbon');await page.locator('#appearanceMenu summary').click();
    await page.locator('#language').selectOption('zh-CN');
    await page.locator('#tiffCancel').click();
    await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
    const cancelled=await save('cancelled.json');
    assert.deepEqual(cancelled.project,before.project);assert.deepEqual(cancelled.state,before.state);assert.deepEqual(cancelled.history,before.history);
    checks.push('Actual canvas native-window/gamma/LUT preview, bilingual live controls and Carbon/Pearl themes; save excludes draft; cancel retains exact project, source store and history');

    await startImport();await page.locator('#tiffSuggest').click();await ready();
    assert.equal(await page.locator('#tiffMin').inputValue(),'0');assert.equal(await page.locator('#tiffMax').inputValue(),'65535');
    await page.locator('#tiffMax').fill('4095');await ready();
    await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
    await page.locator('#scientificSourceInfo').waitFor({state:'visible'});
    const kept=await save('kept.json'),id=kept.state.order[0],asset=kept.project.panels.find(p=>p.id===id),record=asset.analysis.scientificImage;
    assert.equal(kept.history.index,before.history.index+1,'one Keep is one undo record');
    assert.equal(record.sourceSha256,sha(original));assert.equal(kept.project.scientificSources[record.sourceSha256].data,fixture.data);
    assert.equal(record.nativeSamplesSha256,fixture.result.native.samplesSha256);assert.equal(record.display.quantitative,false);
    const href=await page.locator('#artboard image').first().getAttribute('href');
    assert.equal(sha(Buffer.from(href.split(',')[1],'base64')),record.display.sha256);
    checks.push('One-click global native min/max suggestion and real full-resolution Keep; source bit depth, bytes, page/sample hashes and display provenance retained');

    const download=page.waitForEvent('download');await page.locator('#downloadScientificSource').click();
    assert.deepEqual(fs.readFileSync(await(await download).path()),original,'source download is the exact TIFF, not a reconstructed PNG');
    await page.locator('#undo').click();const undone=await save('undone.json');assert.deepEqual(undone.state,before.state);
    await page.locator('#redo').click();const redone=await save('redone.json');assert.deepEqual(redone.state,kept.state);
    checks.push('Exact original TIFF download plus one-step Undo/Redo; immutable native bytes remain available for Redo');

    const reopened=JSON.parse(JSON.stringify(redone));reopened.project.title='PUBLIC TIFF reopened and verified';
    await H.loadProject(page,reopened,'PUBLIC-TIFF-reopen.json');
    await page.locator('#projectTitle').filter({hasText:'PUBLIC TIFF reopened and verified'}).waitFor();
    const afterReopen=await save('reopened.json');
    assert.deepEqual(afterReopen.project.scientificSources,kept.project.scientificSources);
    assert.deepEqual(afterReopen.state,kept.state);
    const corrupted=JSON.parse(JSON.stringify(afterReopen));corrupted.project.title='MUST NOT OPEN';
    const source=corrupted.project.scientificSources[record.sourceSha256];source.data=(source.data[0]==='A'?'B':'A')+source.data.slice(1);
    await H.loadProject(page,corrupted,'PUBLIC-corrupt-native.json');
    await page.locator('#status').filter({hasText:/SHA-256/}).waitFor();
    const rejected=await save('rejected-native.json');assert.deepEqual(rejected.project,afterReopen.project);assert.deepEqual(rejected.state,afterReopen.state);
    checks.push('Saved native-source project reopens only after integrity verification; corrupted original is refused without replacing active edits');

    const oldPanel=JSON.parse(JSON.stringify(rejected.state.panels[id]));
    await startImport();await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
    const shared=await save('shared-source.json');assert.equal(shared.state.order.length,2);
    assert.deepEqual(shared.state.panels[id],oldPanel);assert.equal(Object.keys(shared.project.scientificSources).length,1);
    assert.equal(JSON.stringify(shared.project).split(fixture.data).length-1,1,'two displays store only one original TIFF');
    checks.push('A second display shares the original byte record and preserves the first panel and its manual state');
    await page.locator('#newScientificDisplay').click();await ready();
    const currentRecord=shared.project.panels.find(p=>p.id===shared.state.order.at(-1)).analysis.scientificImage;
    assert.equal(await page.locator('#tiffMax').inputValue(),String(currentRecord.display.window[1]));
    assert.equal(await page.locator('#tiffGamma').inputValue(),String(currentRecord.display.gamma));
    assert.equal(await page.locator('#tiffLut').inputValue(),currentRecord.display.lut);
    assert.equal(await page.locator('#tiffPage').inputValue(),String(currentRecord.page));
    assert.equal(await page.locator('#tiffKeep').textContent(),'保留新显示');
    await page.locator('#tiffMax').fill('2000');await ready();
    const newDraft=await save('new-display-draft.json');assert.deepEqual(newDraft.project,shared.project);assert.deepEqual(newDraft.state,shared.state);assert.deepEqual(newDraft.history,shared.history);
    await page.locator('#tiffCancel').click();
    const newCancelled=await save('new-display-cancel.json');assert.deepEqual(newCancelled.project,shared.project);assert.deepEqual(newCancelled.state,shared.state);
    await page.locator('#newScientificDisplay').click();await ready();
    await page.locator('#tiffMax').fill('2000');await page.locator('#tiffGamma').fill('1.2');await page.locator('#tiffLut').selectOption('cyan');await ready();
    await page.locator('#tiffKeep').click();await page.locator('#scientificTiffWorkspace').waitFor({state:'hidden'});
    const newDisplay=await save('new-display-kept.json'),newId=newDisplay.state.order.at(-1),newRecord=newDisplay.project.panels.find(p=>p.id===newId).analysis.scientificImage;
    assert.equal(newDisplay.state.order.length,3);assert.equal(newDisplay.history.index,shared.history.index+1);
    for(const oldId of shared.state.order)assert.deepEqual(newDisplay.state.panels[oldId],shared.state.panels[oldId]);
    assert.deepEqual(newDisplay.project.scientificSources,shared.project.scientificSources);
    assert.equal(newRecord.sourceSha256,currentRecord.sourceSha256);assert.equal(newRecord.nativeSamplesSha256,currentRecord.nativeSamplesSha256);
    assert.deepEqual(newRecord.display.window,[0,2000]);assert.equal(newRecord.display.gamma,1.2);assert.equal(newRecord.display.lut,'cyan');
    await page.locator('#undo').click();assert.deepEqual((await save('new-display-undo.json')).state,shared.state);
    await page.locator('#redo').click();assert.deepEqual((await save('new-display-redo.json')).state,newDisplay.state);
    await H.loadProject(page,newDisplay,'PUBLIC-new-native-display.json');assert.deepEqual((await save('new-display-reopen.json')).state,newDisplay.state);
    checks.push('Retained original reopens with current plane/window/gamma/LUT for a separate display; real preview/save/cancel, shared original, old manual states, one undo, redo and reopen verified');
    assert.ok(binaryUploads>=3);assert.deepEqual(transportErrors,[]);
    checks.push('Each original uploads once as local binary; subsequent previews use short-lived local IDs without repeatedly serializing raw bytes');
    const misconfigured=await H.browserPage(browser),unexpected=[];
    try{
      await misconfigured.page.route(url,async route=>{
        const response=await route.fetch(),text=await response.text();
        const changed=text.replace(/"tiffEndpoint"\s*:\s*"\/api\/import-tiff"/,'"tiffEndpoint":"https://www.ebi.ac.uk/api/import-tiff"');
        assert.notEqual(changed,text);await route.fulfill({response,body:changed});
      });
      misconfigured.page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.includes('import-tiff'))unexpected.push(r.url());});
      await misconfigured.page.goto(url);await H.dismiss(misconfigured.page);await H.newProject(misconfigured.page,'PUBLIC endpoint privacy guard');
      await misconfigured.page.locator('#importFiles').click();await misconfigured.page.locator('#imageFile').setInputFiles({name:fixture.name,mimeType:'image/tiff',buffer:original});
      await misconfigured.page.locator('#status').filter({hasText:/本机服务|local Windows engine/}).waitFor();
      assert.deepEqual(unexpected,[]);assert.deepEqual(misconfigured.remote,[]);assert.deepEqual(misconfigured.errors,[]);
      checks.push('A deliberately misconfigured external TIFF endpoint is refused before upload, even though the domain is otherwise allowed for literature searches');
    }finally{await misconfigured.context.close();}
    assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);assert.equal(sha(original),fixture.metadata.fileSha256);
    await page.screenshot({path:path.join(out,'native-source-roundtrip.png')});
    report.passed=true;report.remoteRequests=0;report.pageErrors=0;
  }catch(error){report.passed=false;report.error=error.message;await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
  finally{fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await context.close();await browser.close();}
  checks.forEach(check=>console.log('PASS '+check));
})().catch(error=>{console.error(error);process.exitCode=1;});
