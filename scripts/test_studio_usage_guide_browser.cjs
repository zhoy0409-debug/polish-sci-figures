'use strict';
const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;

async function main(){
  const [url,fixture,output]=process.argv.slice(2);
  assert(url&&fixture&&output,'Usage: node scripts/test_studio_usage_guide_browser.cjs LOCAL_URL IRIS_PROJECT OUTPUT');
  const project=JSON.parse(fs.readFileSync(fixture,'utf8')),out=path.resolve(output);
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome'});
  const {context,page,errors,remote}=await H.browserPage(browser);
  page.setDefaultTimeout(12000);
  const guide=page.locator('#studioUsageGuide');
  async function open(topic){
    await page.locator('#studioHelpMenu summary').click();
    await page.locator('#openStudioGuide').click();
    await guide.waitFor();
    if(topic)await guide.locator('[data-guide-topic="'+topic+'"]').click();
  }
  const step=id=>guide.locator('#usageGuideStep-'+id).click();
  const focused=()=>page.evaluate(()=>document.activeElement?.id);
  try{
    await page.goto(H.localUrl(url));
    assert.equal(await guide.isVisible(),false);
    await page.locator('#startStudioGuide').waitFor();
    const initial=await H.save(page);
    await page.locator('#startStudioGuide').click();
    assert.equal(await guide.locator('[data-guide-topic]').count(),7);
    await guide.getByRole('button',{name:'跳过，直接编辑',exact:true}).click();
    assert.equal(await guide.isVisible(),false);
    assert.equal(await page.locator('#projectStart').isVisible(),false);
    const skipped=await H.save(page);
    assert.deepEqual(skipped.state,initial.state);
    assert.deepEqual(skipped.history,initial.history);

    await H.loadProject(page,project);
    const before=await H.save(page),label=id=>page.locator(`#artboard text[data-panel-label="${id}"]`);
    const [a,b,c]=before.state.order;
    await open('projects');
    const picker=page.waitForEvent('filechooser');
    await step('open');
    assert.equal((await picker).isMultiple(),false);
    await open('data');
    await step('discovery');
    const discovery=page.locator('#figureDiscoveryDialog');
    await discovery.getByRole('button',{name:'关闭并取消对照'}).click();
    await discovery.waitFor({state:'hidden'});

    await open('labels');
    await step('layout');
    await page.locator('#rows').waitFor();
    assert.equal(await focused(),'rows');
    await open('labels');
    await step('align');
    assert.equal(await focused(),'viewport');
    await label(a).click();
    await label(b).click({modifiers:['Shift']});
    await label(c).click({modifiers:['Shift']});
    await open('labels');
    await step('align');
    await page.locator('[data-alignment-action="match-labels"]').waitFor();
    await page.keyboard.press('Escape');

    await open('images');
    await step('rectify');
    const images=page.locator('#imageToolsDialog');
    await images.locator('#imageTool-rectify').click();
    await images.getByText('请先导入图片。',{exact:true}).waitFor();
    await images.getByRole('button',{name:'返回编辑器',exact:true}).click();

    await page.locator(`#artboard svg[data-panel="${c}"] text[data-key]`).first().click();
    await label(c).click();
    await open('ai');
    await page.screenshot({path:path.join(out,'guide-ai.png')});
    await step('handoff');
    assert.equal(await focused(),'qualityEditRequest');
    const quality=page.locator('#qualityWorkspace');
    await quality.locator('#qualityEditRequest').fill('只调整 C 的颜色。');
    await quality.getByRole('button',{name:/复制局部 Skill 任务/}).click();
    const prompt=quality.locator('.quality-handoff textarea');
    await prompt.waitFor();
    const copied=await prompt.inputValue();
    const task=JSON.parse(copied.split('\n\n')[1]);
    assert.deepEqual(task.panels.map(panel=>panel.displayLabel),['C']);
    await open('ai');
    await step('clipboard');
    assert.equal(await focused(),'qualityPreviewClipboard');
    assert.equal(await quality.locator('.quality-preview-bar').isVisible(),false);
    await quality.getByText('粘贴 Skill 修改',{exact:true}).click();
    const op={schema:'figure-studio-operations/1',projectId:task.projectId,base:{[c]:task.panels[0].revision},
      operations:[{type:'panel.label.style',panel:c,style:{fill:'#176b5d'}}]};
    await quality.getByRole('textbox',{name:'粘贴 Skill 修改'}).fill(JSON.stringify(op));
    await quality.getByRole('button',{name:'预览粘贴的修改'}).click();
    await quality.getByText('小图 C · 1 项修改',{exact:true}).waitFor();
    await open('ai');
    await guide.locator('#skipStudioGuide').click();
    assert.equal(await quality.locator('.quality-preview-bar').isVisible(),true);
    assert.equal(await label(c).getAttribute('fill'),'#176b5d');
    await open('ai');
    await page.keyboard.press('Escape');
    await guide.waitFor({state:'hidden'});
    assert.equal(await quality.locator('.quality-preview-bar').isVisible(),true);
    await quality.getByRole('button',{name:'取消预览'}).click();
    await quality.getByRole('button',{name:'关闭质检'}).click();

    await open('export');
    await step('export-settings');
    await page.locator('#exportWidth').waitFor();
    await open('export');
    await step('export-menu');
    await page.getByRole('button',{name:/SVG.*可编辑矢量/}).waitFor();
    await page.keyboard.press('Escape');
    const after=await H.save(page);
    assert.deepEqual(after.project.panels,before.project.panels);
    assert.deepEqual(after.state,before.state);
    assert.deepEqual(after.history,before.history);

    await page.setViewportSize({width:910,height:512});
    await open('labels');
    assert(await guide.evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1));
    await guide.locator('#skipStudioGuide').click();
    await page.locator('#language').selectOption('en');
    await page.locator('#commandSearch').click();
    await page.locator('#commandQuery').fill('usage guide');
    await page.locator('#command-usage-guide').click();
    await guide.getByRole('heading',{name:'Usage guide',exact:true}).waitFor();
    await guide.getByRole('button',{name:'Skip to editing',exact:true}).click();

    const mobile=await H.browserPage(browser,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    try{
      await mobile.page.goto(H.localUrl(url));
      await mobile.page.locator('#dismissProjectStart').click();
      assert.equal(await mobile.page.locator('#projectStart').isVisible(),false);
      await mobile.page.locator('#studioHelpMenu summary').click();
      await mobile.page.locator('#openStudioGuide').click();
      const narrowGuide=mobile.page.locator('#studioUsageGuide');
      await narrowGuide.waitFor();
      assert(await narrowGuide.evaluate(dialog=>dialog.scrollWidth<=dialog.clientWidth+1));
      await narrowGuide.locator('#skipStudioGuide').click();
      assert.equal(await narrowGuide.isVisible(),false);
      assert.deepEqual(mobile.errors,[]);
      assert.deepEqual(mobile.remote,[]);
    }finally{await mobile.context.close();}

    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    const result={browser:browser.version(),route:'local-loopback',topics:7,firstRunSkip:true,
      skipWhilePreviewing:true,projectUnchanged:true,selectionPreserved:true,compactWidths:[910,390],
      verifiedRoutes:['open','discovery','layout','align','rectify','handoff','clipboard','export-settings','export-menu','command-search']};
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }catch(error){
    await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
    throw error;
  }finally{await context.close();await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
