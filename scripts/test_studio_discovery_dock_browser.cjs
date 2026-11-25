'use strict';

const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;
const url=H.localUrl(process.argv[2]);
const output=path.resolve(process.argv[3]);
assert(!fs.existsSync(output), 'Use a new evidence directory');
fs.mkdirSync(output,{recursive:true});

async function settle(page){
  await page.evaluate(async()=>{
    await document.fonts.ready;
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}

async function geometry(page){
  await settle(page);
  return page.locator('#figureDiscoveryDialog').evaluate(dialog=>{
    const sidebar=dialog.closest('.inspector');
    const rect=dialog.getBoundingClientRect();
    return {
      width:rect.width,
      sidebarWidth:sidebar.getBoundingClientRect().width,
      sidebarChildren:sidebar.children.length,
      owner:dialog.closest('[data-drawer-owner]')?.dataset.drawerOwner,
      active:dialog.closest('.studio-tool-bank')?.dataset.tool,
      fieldWidth:dialog.querySelector('#discoveryData').getBoundingClientRect().width,
      documentWidth:document.documentElement.scrollWidth,
      viewport:innerWidth,
      canvasVisible:!!document.querySelector('#artboard>svg')?.getBoundingClientRect().width
    };
  });
}

async function assertDock(page){
  const result=await geometry(page);
  assert.equal(result.sidebarChildren,2,'Discovery belongs inside the existing drawer');
  assert.equal(result.owner,'discovery');
  assert.equal(result.active,'discovery');
  assert(result.width>=200,JSON.stringify(result));
  assert(result.fieldWidth>=150,JSON.stringify(result));
  assert(result.documentWidth<=result.viewport,JSON.stringify(result));
  assert(result.canvasVisible,'Keep the actual artboard available for comparison');
  return result;
}

async function openFromMenu(page){
  await page.locator('[data-drawer-category=data]').click();
  await page.locator('[data-drawer-tool=discovery]').click();
  await page.locator('#figureDiscoveryDialog[open]').waitFor();
}

function sourceProject(project){
  const {layoutRenders,...source}=project;
  return source;
}

async function main(){
  const browser=await chromium.launch({headless:true,
    ...(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:'chrome'})});
  const report={scope:'Real browser with the local production renderer and labelled synthetic data',
    browser:browser.version(),cases:[],errors:[],remote:[]};
  let current;
  try{
    for(const [width,route]of [[910,'start'],[1440,'start'],[1440,'menu'],[1920,'menu']]){
      const session=await H.browserPage(browser,{viewport:{width,height:900}});
      current=session.page;
      try{
        await current.goto(url);
        if(route==='start')await current.locator('#startDiscovery').click();
        else {await H.dismiss(current);await openFromMenu(current);}
        await current.locator('#figureDiscoveryDialog[open]').waitFor();
        const initial=await assertDock(current);
        await current.locator('#discoveryData').fill('draft,keep\nA,1');
        await current.locator('#drawerTools').click();
        await current.locator('#drawerTools').click();
        await assertDock(current);
        assert.equal(await current.locator('#discoveryData').inputValue(),'draft,keep\nA,1');
        await current.locator('#language').selectOption('en');
        await assertDock(current);
        assert.equal(await current.locator('#discoveryData').inputValue(),'draft,keep\nA,1');
        await current.locator('#appearanceMenu summary').click();
        await current.locator('#studioTheme').selectOption('pearl');
        await current.locator('#appearanceMenu summary').click();
        await assertDock(current);
        report.cases.push({width,route,initial,english:await geometry(current)});
        if(width===1440)await current.screenshot({path:path.join(output,'after-'+route+'.png')});
      }finally{
        report.errors.push(...session.errors);
        report.remote.push(...session.remote);
        await session.context.close();
      }
    }

    const session=await H.browserPage(browser,{viewport:{width:1366,height:900}});
    current=session.page;
    try{
      await current.goto(url);
      await H.dismiss(current);
      await current.locator('#language').selectOption('en');
      const before=await H.save(current);
      await current.locator('#drawerCloseTools').click();
      await current.keyboard.press('Control+k');
      await current.locator('#commandQuery').fill('discover');
      await current.locator('#command-discovery').click();
      await assertDock(current);
      await current.locator('#discoveryFile').setInputFiles(path.join(__dirname,'fixtures/discovery/independent.csv'));
      await current.locator('#discoverySummary').getByText(/6 rows/).waitFor();
      for(const [name,value]of Object.entries({data_level:'raw',design:'independent',
        outcome_type:'continuous',technical_replicates:'no',nesting:'none'})){
        await current.locator('#discovery-'+name).selectOption(value);
      }
      await current.locator('#discovery-unit_confirmed').check();
      await current.locator('#discoveryRun').click();
      await current.waitForFunction(()=>/Generated [1-9]/.test(document.getElementById('discoveryStatus').textContent),null,{timeout:60000});
      const count=await current.locator('#discoveryCards .discovery-card svg').count();
      assert(count>=3,'Compare several actual-data renderings');
      await current.locator('#discoveryCards .discovery-preview').first().click();
      await current.waitForFunction(()=>document.querySelector('#artboard>svg[data-preview-kind="discovery"]'));
      await current.screenshot({path:path.join(output,'actual-data-preview.png')});
      const previewSaved=await H.save(current);
      assert.deepEqual(previewSaved.state,before.state);
      assert.deepEqual(sourceProject(previewSaved.project),sourceProject(before.project));
      await current.locator('.discovery-preview-actions button').first().click();
      assert.deepEqual((await H.save(current)).state,before.state);
      await current.locator('#drawerBack').click();
      await current.locator('[data-drawer-tool=discovery]').click();
      await assertDock(current);
      assert.equal(await current.locator('#discoveryCards .discovery-card svg').count(),count);
      assert.equal(await current.locator('#discovery-design').inputValue(),'independent');
      assert(await current.locator('#discovery-unit_confirmed').isChecked());
      await current.locator('#discoveryCards .discovery-apply').first().click();
      await current.waitForFunction(()=>!document.getElementById('figureDiscoveryDialog').open);
      const applied=await H.save(current);
      assert.equal(applied.history.index,before.history.index+1);
      const installed=applied.project.panels.find(panel=>panel.id===applied.state.order[0]);
      assert.equal(installed.provenance,'user-data');
      assert.equal(installed.table.rows.length,7);
      await current.locator('#undo').click();
      assert.deepEqual((await H.save(current)).state,before.state);
      await current.locator('#redo').click();
      assert.deepEqual((await H.save(current)).state,applied.state);
      await current.locator('#projectFile').setInputFiles({name:'discovery-save.json',mimeType:'application/json',
        buffer:Buffer.from(JSON.stringify(applied))});
      await current.waitForFunction(()=>document.getElementById('status').textContent.includes('restored'));
      assert.deepEqual((await H.save(current)).state,applied.state);
      await current.screenshot({path:path.join(output,'applied-and-reopened.png')});
      report.workflow={actualDataViews:count,retainedFields:true,previewCancelled:true,
        oneCommit:true,undoRedo:true,saveReopen:true};
    }finally{
      report.errors.push(...session.errors);
      report.remote.push(...session.remote);
      await session.context.close();
    }
    assert.deepEqual(report.errors,[]);
    assert.deepEqual(report.remote,[]);
    report.passed=true;
  }catch(error){
    report.error=error.stack;
    if(current&&!current.isClosed())await current.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
    throw error;
  }finally{
    fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));
    await browser.close();
  }
  console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
