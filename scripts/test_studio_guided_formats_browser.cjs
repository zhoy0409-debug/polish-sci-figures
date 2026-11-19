'use strict';

const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;

async function exercise(browser,url,source,out,viewport){
  const isPdf=path.extname(source).toLowerCase()==='.pdf';
  const sha=H.sha(fs.readFileSync(source));
  const {context,page,errors,remote}=await H.browserPage(browser,{viewport});
  const workflow=page.getByRole('region',{name:'首次编辑流程',exact:true});
  const guide=page.getByRole('dialog',{name:'使用向导',exact:true});
  const review=page.getByRole('complementary',{name:'图形质检与协作',exact:true});
  const click=(name,scope=page)=>scope.getByRole('button',{name,exact:true}).click();
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
  const notes={viewport,sourceSha256:sha};
  fs.mkdirSync(out,{recursive:true});
  page.setDefaultTimeout(10000);
  try{
    await page.goto(H.localUrl(url));
    await click('使用向导');
    await guide.getByRole('heading',{name:'从素材到成图',exact:true}).waitFor();
    const [file]=await Promise.all([page.waitForEvent('filechooser'),click('开始：导入素材',guide)]);
    await file.setFiles(path.resolve(source));

    if(isPdf){
      const chooser=page.getByRole('dialog',{name:'导入 PDF',exact:true});
      const status=chooser.locator('#pdfImportStatus');
      const add=chooser.getByRole('button',{name:'导入这一页',exact:true});
      const list=chooser.getByRole('combobox');
      await status.getByText(/混合内容/).waitFor();
      notes.mixedPreview=await status.innerText();
      await shot('01-pdf-mixed');
      const options=await list.getByRole('option').all();
      assert.equal(options.length,2);
      await list.selectOption({index:1});
      await status.getByText(/图片内部的文字和线条不能单独编辑/).waitFor();
      notes.flatPreview=await status.innerText();
      await shot('02-pdf-flat');
      await list.selectOption({index:0});
      await status.getByText(/混合内容/).waitFor();
      await add.click();
      await chooser.waitFor({state:'hidden'});
    }else{
      const notice=page.getByRole('dialog',{name:'图形已导入',exact:true});
      await notice.getByText(/图片内部的文字和线条不能单独编辑/).waitFor();
      await shot('01-png-import');
      await click('继续：修改图件',notice);
    }
    await workflow.getByText('修改图件',{exact:true}).waitFor();
    notes.editHint=await workflow.locator('span').innerText();
    await shot('03-guided-edit');
    await workflow.getByText(isPdf?/图片层内部的字不能单独改/:/图内文字和线条不能单独改/).waitFor();
    if(isPdf){
      const editable=page.locator('#artboard svg[data-panel] text');
      notes.pdfText=await editable.allTextContents();
      await editable.filter({hasText:/^Iris overview$/}).dblclick();
      const editor=page.locator('.canvas-text-editor');
      await editor.fill('Iris comparison');
      await editor.press('Enter');
      await editable.filter({hasText:/^Iris comparison$/}).waitFor();
    }else{
      await click('打开图片显示',workflow);
      const display=page.locator('#imageColorDialog');
      await display.getByRole('button',{name:/^调亮度和对比度/}).click();
      const slider=display.getByRole('slider',{name:'亮度',exact:true});
      assert.equal(await slider.evaluate(input=>input===document.activeElement),true);
      const label=display.getByText('亮度',{exact:true});
      assert.equal(await label.evaluate(node=>{
        const {x,y,width,height}=node.getBoundingClientRect();
        return document.elementFromPoint(x+width/2,y+height/2)===node;
      }),true,'Brightness label is visible when the guided shortcut lands');
      await display.getByRole('textbox',{name:'亮度 (EV)',exact:true}).fill('-0.12');
      await page.locator('#artboard image[data-studio-image-color]').waitFor();
      await shot('04-png-display-preview');
      await click('应用',display);
      await display.waitFor({state:'hidden'});
      await page.locator('#artboard image[data-studio-image-color]').waitFor();
    }
    await click('打开图形质检',workflow);
    await click('检查当前图形',review);
    await review.getByText(/检查完成/).waitFor();
    await workflow.getByText('导出成图',{exact:true}).waitFor();
    await review.getByText(isPdf?/图片层仍是位图/:/核对尺寸和图内细节后可选 PNG/).waitFor();
    const next=review.getByRole('button',{name:'下一步：打开导出选项',exact:true});
    assert.equal(await next.evaluate(button=>{
      const {left,top,right,bottom}=button.getBoundingClientRect();
      return [top+4,bottom-4].every(y=>button.contains(document.elementFromPoint((left+right)/2,y)));
    }),true,'The next action is fully visible as soon as the review finishes');
    await shot('05-review-complete');
    await next.click();
    await review.waitFor({state:'hidden'});
    const format=page.getByRole('button',{name:isPdf?/SVG.*可编辑矢量/:/PNG.*无损图像/});
    const [download]=await Promise.all([page.waitForEvent('download'),format.click()]);
    const output=path.join(out,isPdf?'iris-edited.svg':'iris-edited.png');
    await download.saveAs(output);
    const bytes=fs.readFileSync(output);
    if(isPdf){
      assert.match(bytes.toString(),/<text\b[\s\S]*?Iris comparison/);
      assert.match(bytes.toString(),/<image\b/);
    }else{
      assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      assert(bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0);
    }
    await workflow.getByText('图形已导出',{exact:true}).waitFor();
    await click('完成向导',workflow);
    await workflow.waitFor({state:'hidden'});
    const saved=await H.save(page);
    assert.equal(saved.history.index,2,'Import and edit should each take one history entry');
    if(!isPdf){
      const adjustments=Object.values(saved.state.panels)
        .flatMap(panel=>Object.values(panel.imageAdjustments||{}).flatMap(Object.values));
      assert.deepEqual(adjustments.map(value=>value.exposureEv),[-0.12]);
    }
    assert.equal(H.sha(fs.readFileSync(source)),sha);
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    notes.completed=true;
    notes.output=path.basename(output);
  }catch(error){
    await shot('stopped').catch(()=>{});
    throw error;
  }finally{
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(notes,null,2));
    console.log(JSON.stringify(notes));
    await context.close();
  }
}

async function main(){
  const [url,png,pdf,out,width='1440']=process.argv.slice(2);
  assert(url&&png&&pdf&&out,'Usage: node scripts/test_studio_guided_formats_browser.cjs LOCAL_URL PNG PDF OUTPUT [WIDTH]');
  const viewport={width:Number(width),height:width==='910'?512:900};
  const browser=await chromium.launch({channel:'chrome'});
  try{
    const outcomes=await Promise.allSettled([
      exercise(browser,url,png,path.join(out,'png'),viewport),
      exercise(browser,url,pdf,path.join(out,'pdf'),viewport)
    ]);
    const failures=outcomes.filter(result=>result.status==='rejected');
    failures.forEach(result=>console.error(result.reason));
    if(failures.length)process.exitCode=1;
  }finally{await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
