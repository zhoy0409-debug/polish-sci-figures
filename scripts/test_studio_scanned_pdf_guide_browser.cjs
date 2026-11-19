'use strict';

const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;

const imageHash=async image=>H.sha(await image.evaluate(node=>node.getAttribute('href')||node.getAttribute('xlink:href')));
const activeAsset=snapshot=>snapshot.project.panels.find(panel=>panel.id===snapshot.state.order[0]);

async function editAnnotation(page,annotation,text){
  const box=await annotation.boundingBox();
  await page.mouse.dblclick(box.x+box.width*.5,box.y+box.height*.5);
  const editor=page.getByRole('textbox',{name:'画布文字编辑',exact:true});
  await editor.fill(text);
  await editor.press('Enter');
  await annotation.getByText(text,{exact:true}).waitFor();
}

async function openProject(page,url,projectPath){
  page.setDefaultTimeout(10000);
  await page.goto(H.localUrl(url));
  const open=page.locator('#projectStart').getByRole('button',{name:'打开工程',exact:true});
  const [picker]=await Promise.all([page.waitForEvent('filechooser'),open.click()]);
  await picker.setFiles(projectPath);
  await page.getByText('工程已恢复',{exact:true}).waitFor();
  return H.save(page);
}

async function saveProjectFile(page,projectPath){
  const save=page.getByRole('button',{name:'保存',exact:true});
  const [download]=await Promise.all([page.waitForEvent('download'),save.click()]);
  await download.saveAs(projectPath);
  return JSON.parse(fs.readFileSync(projectPath,'utf8'));
}

async function verifyRestored(page,snapshot,expected,scanHash){
  assert.deepEqual(snapshot.state,expected.state,'The saved page and annotation must be restored exactly');
  assert.equal(snapshot.project.id,expected.project.id);
  assert.deepEqual(activeAsset(snapshot),activeAsset(expected),'The imported PDF page and its metadata must be preserved');
  assert.equal(await imageHash(page.locator('#artboard svg[data-panel] image')),scanHash);
  await page.locator('#artboard [data-annotation] text').getByText(expected.state.overlays[0].text,{exact:true}).waitFor();
}

async function reopenAndCheckHistory(browser,url,viewport,out,savedPath,saved,scanHash){
  const {context,page,errors,remote}=await H.browserPage(browser,{viewport});
  const original=saved.state.overlays[0],updatedText='Second note 02';
  const scan=page.locator('#artboard svg[data-panel] image');
  const annotation=page.locator('#artboard [data-annotation] text');
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
  const backupHash=H.sha(fs.readFileSync(savedPath));
  try{
    const reopened=await openProject(page,url,savedPath);
    await verifyRestored(page,reopened,saved,scanHash);
    assert.deepEqual(reopened.history,saved.history,'Reopening must restore the existing undo history');
    await shot('05-project-reopened');

    await editAnnotation(page,annotation,updatedText);
    const edited=await H.save(page);
    assert.equal(edited.history.index,reopened.history.index+1);
    assert.deepEqual(edited.history.states.slice(0,edited.history.index),reopened.history.states.slice(0,reopened.history.index+1));
    assert.equal(edited.state.overlays[0].text,updatedText);
    const stateWithoutNewText=structuredClone(edited.state);
    Object.assign(stateWithoutNewText.overlays[0],{text:original.text,richText:original.richText});
    assert.deepEqual(stateWithoutNewText,reopened.state,'The new edit may only change the annotation text');
    assert.equal(await imageHash(scan),scanHash);
    await shot('06-annotation-changed-after-reopen');

    await page.getByRole('button',{name:/^撤销/}).click();
    const undone=await H.save(page);
    await verifyRestored(page,undone,reopened,scanHash);
    assert.equal(undone.history.index,reopened.history.index);
    assert.deepEqual(undone.history,{...edited.history,index:reopened.history.index},'Undo must move back exactly one step and preserve the history');
    await shot('07-after-one-undo');

    await page.getByRole('button',{name:/^重做/}).click();
    const redoPath=path.join(out,'scan-page-02-after-redo.json');
    const redone=await saveProjectFile(page,redoPath);
    await verifyRestored(page,redone,edited,scanHash);
    assert.deepEqual(redone.history,edited.history,'Redo must reapply exactly the one undone edit');
    await shot('08-after-one-redo');
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    await context.close();

    const proof=await H.browserPage(browser,{viewport});
    try{
      const final=await openProject(proof.page,url,redoPath);
      await verifyRestored(proof.page,final,redone,scanHash);
      assert.deepEqual(final.history,redone.history,'The second reopen must restore the full redo state and undo history');
      assert.equal(await proof.page.getByRole('button',{name:/^撤销/}).isEnabled(),true);
      assert.equal(await proof.page.getByRole('button',{name:/^重做/}).isDisabled(),true);
      assert.equal(H.sha(fs.readFileSync(savedPath)),backupHash);
      assert.deepEqual(proof.errors,[]);
      assert.deepEqual(proof.remote,[]);
      await proof.page.screenshot({path:path.join(out,'09-redone-project-reopened.png')});
      return {reopened:true,indexOnReopen:reopened.history.index,indexAfterEdit:edited.history.index,indexAfterUndo:undone.history.index,
        indexAfterRedo:redone.history.index,indexAfterReopeningRedo:final.history.index,originalText:original.text,editedText:updatedText,
        restoredText:undone.state.overlays[0].text,persistedRedoText:final.state.overlays[0].text,onlyLatestEditUndone:true,
        onlyLatestEditRedone:true,redoAndHistoryPersisted:true};
    }catch(error){
      await proof.page.screenshot({path:path.join(out,'redo-reopen-stopped.png')}).catch(()=>{});
      throw error;
    }finally{
      await proof.context.close();
    }
  }catch(error){
    await shot('roundtrip-stopped').catch(()=>{});
    throw error;
  }finally{
    await context.close();
  }
}

async function main(){
  const [url,source,output,width='1440']=process.argv.slice(2);
  assert(url&&source&&output,'Usage: node scripts/test_studio_scanned_pdf_guide_browser.cjs LOCAL_URL THREE_PAGE_SCAN_PDF OUTPUT [WIDTH]');
  const viewport={width:Number(width),height:width==='910'?512:900};
  const out=path.resolve(output),sha=H.sha(fs.readFileSync(source));
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome'});
  const {context,page,errors,remote}=await H.browserPage(browser,{viewport});
  const workflow=page.getByRole('region',{name:'首次编辑流程',exact:true});
  const review=page.getByRole('complementary',{name:'图形质检与协作',exact:true});
  const click=(name,scope=page)=>scope.getByRole('button',{name,exact:true}).click();
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
  const notes={viewport,sourceSha256:sha};
  page.setDefaultTimeout(10000);
  try{
    await page.goto(H.localUrl(url));
    await click('使用向导');
    const guide=page.getByRole('dialog',{name:'使用向导',exact:true});
    await guide.getByRole('heading',{name:'从素材到成图',exact:true}).waitFor();
    const [file]=await Promise.all([page.waitForEvent('filechooser'),click('开始：导入素材',guide)]);
    await file.setFiles(path.resolve(source));
    const chooser=page.getByRole('dialog',{name:'导入 PDF',exact:true});
    const pick=chooser.getByRole('combobox',{name:'选择页面'});
    const preview=chooser.locator('#pdfImportPreview image');
    await chooser.getByText(/图片内部的文字和线条不能单独编辑/).waitFor();
    assert.equal(await pick.getByRole('option').count(),3);
    const first=await imageHash(preview);
    await pick.selectOption({label:'第 2 页，共 3 页'});
    await chooser.getByText(/图片内部的文字和线条不能单独编辑/).waitFor();
    const second=await imageHash(preview);
    assert.notEqual(second,first,'The chosen second page is a different image');
    await shot('01-selected-page-2');
    await click('导入这一页',chooser);
    await chooser.waitFor({state:'hidden'});

    await workflow.getByText('修改图件',{exact:true}).waitFor();
    notes.editHint=await workflow.locator('span').innerText();
    notes.editActions=await workflow.getByRole('button').allTextContents();
    const raster=page.locator('#artboard svg[data-panel] image');
    const plotText=page.locator('#artboard svg[data-panel] text');
    assert.equal(await imageHash(raster),second,'The actual canvas contains the selected page');
    assert.equal(await plotText.count(),0);
    await shot('02-after-import');
    const box=await raster.boundingBox();
    await page.mouse.dblclick(box.x+box.width*.2,box.y+box.height*.09);
    assert.equal(await page.locator('.canvas-text-editor').isVisible(),false);
    await workflow.getByText(/新加的标注可单独编辑/).waitFor();
    await click('调整整页显示',workflow);
    const display=page.locator('#imageColorDialog');
    await display.waitFor();
    await click('关闭并取消',display);
    await display.waitFor({state:'hidden'});
    await click('添加文字标注',workflow);
    await page.getByText(/点击画布任意位置输入文字/).waitFor();
    const target=await raster.boundingBox();
    await page.mouse.click(target.x+target.width*.17,target.y+target.height*.83);
    const editor=page.locator('.canvas-text-editor');
    await editor.fill('Scan note 02');
    await editor.press('Enter');
    const annotation=page.locator('#artboard [data-annotation] text');
    await annotation.getByText('Scan note 02',{exact:true}).waitFor();
    await editAnnotation(page,annotation,'Review note 02');
    await shot('03-annotation-edited');
    assert.equal(await imageHash(raster),second);

    const beforeSkip=await H.save(page);
    await click('跳过，直接编辑',workflow);
    await workflow.waitFor({state:'hidden'});
    await annotation.getByText('Review note 02',{exact:true}).waitFor();
    const afterSkip=await H.save(page);
    assert.deepEqual(afterSkip.state,beforeSkip.state);
    assert.deepEqual(afterSkip.history,beforeSkip.history);
    await click('向导');
    await click('使用向导');
    await click('继续首次流程',guide);
    await workflow.getByText('修改图件',{exact:true}).waitFor();

    await click('打开图形质检',workflow);
    await click('检查当前图形',review);
    await review.getByText(/检查完成/).waitFor();
    await workflow.getByText('导出成图',{exact:true}).waitFor();
    notes.reviewHint=await review.locator('.quality-first-figure-format').innerText();
    await review.getByText(/扫描图内细节请看预览/).waitFor();
    const next=review.getByRole('button',{name:'下一步：打开导出选项',exact:true});
    assert.equal(await next.evaluate(button=>{
      const {left,top,right,bottom}=button.getBoundingClientRect();
      return [top+4,bottom-4].every(y=>button.contains(document.elementFromPoint((left+right)/2,y)));
    }),true,'Export is reachable immediately after checking the scanned page');
    const [reportFile]=await Promise.all([page.waitForEvent('download'),click('保存检查报告',review)]);
    const report=JSON.parse(fs.readFileSync(await reportFile.path(),'utf8'));
    assert.equal(report.summary.texts,1,'Only the new annotation is measurable text');
    await shot('04-review-complete');
    await next.click();
    const format=page.getByRole('button',{name:/PNG.*无损图像/});
    const [download]=await Promise.all([page.waitForEvent('download'),format.click()]);
    const filePath=path.join(out,'iris-page-02-annotated.png');
    await download.saveAs(filePath);
    const bytes=fs.readFileSync(filePath);
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);
    await workflow.getByText('图形已导出',{exact:true}).waitFor();
    const savedPath=path.join(out,'scan-page-02-project.json');
    const saved=await saveProjectFile(page,savedPath);
    assert.equal(saved.state.order.length,1);
    const asset=activeAsset(saved);
    assert.equal(asset.analysis.import.page,2);
    assert.ok(asset.analysis.import.warningCodes.includes('image_only'));
    assert.equal(saved.state.overlays.length,1);
    assert.equal(saved.state.overlays[0].text,'Review note 02');
    assert.equal(await imageHash(raster),second);
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    await context.close();
    const roundtrip=await reopenAndCheckHistory(browser,url,viewport,out,savedPath,saved,second);
    assert.equal(H.sha(fs.readFileSync(source)),sha);
    Object.assign(notes,{importedPage:2,pageCount:3,annotationReedited:true,rasterUnchanged:true,oneClickSkipPreservedState:true,resumedAtEdit:true,measuredTexts:report.summary.texts,pngExported:true,usedFunctionSearch:false,roundtrip,completed:true});
  }catch(error){
    await shot('stopped').catch(()=>{});
    throw error;
  }finally{
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(notes,null,2));
    console.log(JSON.stringify(notes));
    await context.close();
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
