'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
const {clickQuick,openImport}=require('./test_studio_carbon_helpers.cjs');

(async()=>{
  const [, , html, destination, photo, screenshot, projectFile]=process.argv;
  const out=path.resolve(destination);
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:'chrome'});
  const errors=[];
  const open=async()=>{
    const page=await browser.newPage({viewport:{width:1520,height:1000}});
    page.setDefaultTimeout(9000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(/^[a-z]+:\/\//i.test(html)?html:pathToFileURL(path.resolve(html)).href);
    await page.waitForFunction(()=>!document.body.inert&&document.querySelector('#artboard>svg'));
    if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();
    await page.locator('#projectFile').setInputFiles(projectFile);
    await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('工程已恢复'));
    return page;
  };
  const shot=(page,name)=>page.screenshot({path:path.join(out,name+'.png')});
  async function save(page,name,trigger='#save'){
    const event=page.waitForEvent('download');
    await page.locator(trigger).click();
    const download=await event;
    const file=path.join(out,name+'.json');
    await download.saveAs(file);
    return {file,data:JSON.parse(fs.readFileSync(file,'utf8'))};
  }
  async function checkSearch(page,term,name,openAction=false){
    await page.keyboard.press('Control+k');
    await page.locator('#commandQuery').fill(term);
    const first=page.locator('#commandDialog .command-results button').first();
    assert.equal(await first.textContent(),name,term);
    if(openAction)await first.click();
    else await page.locator('#commandDialog .command-heading button').click();
  }
  const raw=JSON.parse(fs.readFileSync(projectFile,'utf8'));
  try{
    const chart=await open();
    const original=await save(chart,'chart-original');
    assert.deepEqual(original.data.project.panels,raw.project.panels);
    const [a,b,c]=raw.state.order;
    assert(raw.project.panels[0].table?.rows.length>1,'Skill project must preserve a real data binding');
    const primary=chart.locator('#contextColorAction');
    assert.equal(await primary.textContent(),'换配色');
    for(const term of ['换色','一键换色','调色'])await checkSearch(chart,term,'换配色');
    await clickQuick(chart,'contextColorAction');
    const card=chart.locator('#palettes button.palette').first();
    await card.hover();
    await chart.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('点击应用'),{},{timeout:6000});
    await shot(chart,'chart-palette-preview');
    await chart.mouse.move(0,0);
    await chart.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('已返回当前编辑版'));
    const chartCancelled=await save(chart,'chart-cancelled');
    assert.deepEqual(chartCancelled.data.state,original.data.state);
    await card.click();
    const chartChanged=await save(chart,'chart-changed');
    assert.equal(chartChanged.data.history.index,original.data.history.index+1);
    assert.deepEqual(chartChanged.data.project,original.data.project);
    for(const id of [b,c])assert.deepEqual(chartChanged.data.state.panels[id],original.data.state.panels[id]);
    await chart.locator('#projectFile').setInputFiles(chartChanged.file);
    await chart.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('工程已恢复'));
    assert.deepEqual((await save(chart,'chart-reopened')).data.state,chartChanged.data.state);
    await chart.locator('#undo').click();
    assert.deepEqual((await save(chart,'chart-undone')).data.state,original.data.state);

    // Modify one text object on A through its own colour field.
    const aText=chart.locator(`#artboard [data-panel="${a}"] text[data-key]`).first();
    await aText.click();
    await checkSearch(chart,'改色','图元改色',true);
    const hex=chart.locator('#colorHex');
    await hex.fill('#334455');
    await hex.press('Enter');
    const human=await save(chart,'human-a-edit');
    assert.notDeepEqual(human.data.state.panels[a],original.data.state.panels[a]);
    assert.deepEqual(human.data.state.panels[c],original.data.state.panels[c]);
    await chart.locator(`#artboard [data-panel="${c}"] text[data-key]`).first().click();
    await chart.locator('#openQualityWorkspace').click();
    const review=chart.locator('#qualityWorkspace');
    const handoff=(await save(chart,'scoped-inspection','#qualityWorkspace button:has-text("请 AI 检查当前图")')).data;
    assert.deepEqual(handoff.panels.map(panel=>panel.id),[c]);
    assert.equal(handoff.task.panel,c);
    assert(handoff.instructions.includes(c));
    assert(!handoff.panels[0].table&&!handoff.panels[0].svg&&!handoff.panels[0].analysis);
    await shot(chart,'handoff');
    const panel=handoff.panels[0],text=panel.elements.find(el=>el.tag==='text'&&!el.locked);
    const patch={schema:'figure-studio-operations/1',projectId:handoff.projectId,base:{[c]:panel.revision},
      operations:[{type:'element.style',panel:c,variant:panel.variant,key:text.key,style:{fill:'#176b5d'}}]};
    const input=review.locator('input[type=file]');
    const upload=value=>input.setInputFiles({name:'operations.json',mimeType:'application/json',buffer:Buffer.from(value)});
    await upload(JSON.stringify(patch));
    await review.locator('.quality-preview-bar').waitFor();
    await chart.waitForFunction(({panel,key})=>document.querySelector(`#artboard [data-panel="${panel}"] [data-key="${key}"]`)?.style.getPropertyValue('fill')==='rgb(23, 107, 93)',{panel:c,key:text.key});
    assert.deepEqual((await save(chart,'patch-preview-saved')).data.state,human.data.state);
    await shot(chart,'ai-c-preview');
    await review.getByRole('button',{name:'取消预览',exact:true}).click();
    assert.deepEqual((await save(chart,'patch-cancelled')).data.state,human.data.state);
    await upload(JSON.stringify(patch));
    await review.getByRole('button',{name:'保留修改',exact:true}).click();
    const kept=await save(chart,'patch-kept');
    assert.equal(kept.data.history.index,human.data.history.index+1);
    for(const id of [a,b])assert.deepEqual(kept.data.state.panels[id],human.data.state.panels[id]);
    assert.deepEqual(kept.data.project,human.data.project);
    assert.equal(kept.data.state.panels[c].edits[panel.variant][text.key].fill,'#176b5d');
    for(const [value,message] of [[JSON.stringify(patch),'目标小图已变化'],[JSON.stringify({...patch,projectId:'00000000000000000000'}),'工程身份不匹配'],['{','不是有效的 JSON']]){
      await upload(value);
      await chart.waitForFunction(msg=>document.querySelector('.quality-status')?.textContent.includes(msg),message);
      assert(await review.locator('.quality-preview-bar').isHidden());
    }
    assert.deepEqual((await save(chart,'failed-imports')).data,kept.data);
    await chart.locator('#undo').click();
    assert.deepEqual((await save(chart,'patch-undone')).data.state,human.data.state);
    await chart.close();

    for(const [inputFile,kind,button] of [[photo,'photo','校色'],[screenshot,'png','显示调整']]){
      const page=await open();
      const chooser=page.waitForEvent('filechooser');
      await openImport(page);
      await (await chooser).setFiles(inputFile);
      await page.waitForFunction(()=>document.querySelector('#artboard svg image[data-key]'));
      const notice=page.locator('#importContentDialog[open]');
      if(await notice.count())await notice.locator('button').last().click();
      const action=page.locator('#contextColorAction');
      assert.equal(await action.textContent(),button);
      if(kind==='png')assert.match(await action.getAttribute('title'),/源 SVG 或原始数据/);
      await checkSearch(page,'一键校色',button);
      await checkSearch(page,'调色',button);
      const before=await save(page,kind+'-before');
      await clickQuick(page,'contextColorAction');
      const display=page.locator('#imageColorDialog');
      await display.waitFor();
      if(kind==='photo'){
        await page.waitForFunction(()=>document.querySelector('#artboard image[data-key]')?.hasAttribute('filter'));
      }else{
        await display.locator('[data-color-number=exposureEv]').first().fill('.4');
      }
      await shot(page,kind+'-preview');
      await display.locator('[data-color=cancel]').click();
      assert.deepEqual((await save(page,kind+'-cancelled')).data.state,before.data.state);
      await clickQuick(page,'contextColorAction');
      if(kind==='photo')await page.waitForFunction(()=>document.querySelector('#artboard image[data-key]')?.hasAttribute('filter'));
      else await display.locator('[data-color-number=exposureEv]').first().fill('.4');
      await display.locator('[data-color=apply]').click();
      await display.waitFor({state:'hidden'});
      const after=await save(page,kind+'-kept');
      assert.equal(after.data.history.index,before.data.history.index+1);
      assert.deepEqual(after.data.project,before.data.project);
      await page.locator('#projectFile').setInputFiles(after.file);
      await page.waitForFunction(()=>document.querySelector('#status')?.textContent.includes('工程已恢复'));
      assert.deepEqual((await save(page,kind+'-reopened')).data.state,after.data.state);
      await page.locator('#undo').click();
      assert.deepEqual((await save(page,kind+'-undone')).data.state,before.data.state);
      await page.close();
    }
    assert.deepEqual(errors,[]);
    console.log('Skill project with data binding; palette, JPEG and PNG contextual actions; C-only local handoff, preview, cancel, commit, conflicts and undo passed.');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
