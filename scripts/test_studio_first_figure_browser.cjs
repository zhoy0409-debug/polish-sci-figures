'use strict';
const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;

async function main(){
  const [url,source,destination,width='1440']=process.argv.slice(2);
  assert(url&&source&&destination,'Usage: node scripts/test_studio_first_figure_browser.cjs LOCAL_URL IRIS_SVG OUTPUT [WIDTH]');
  const out=path.resolve(destination),viewport={width:Number(width),height:width==='910'?512:900};
  const original=fs.readFileSync(source),sha=H.sha(original);
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch({channel:'chrome'});
  const {context,page,errors,remote}=await H.browserPage(browser,{viewport});
  const guide=page.getByRole('dialog',{name:'使用向导',exact:true});
  const workflow=page.getByRole('region',{name:'首次编辑流程',exact:true});
  const click=(name,scope=page)=>scope.getByRole('button',{name,exact:true}).click();
  const shot=name=>page.screenshot({path:path.join(out,name+'.png')});
  const text=(tab,value)=>tab.locator('#artboard svg[data-panel] text').filter({hasText:value});
  const edited=/^Sepal length \(cm\)$/;
  page.setDefaultTimeout(12000);
  try{
    await page.goto(H.localUrl(url));
    await click('使用向导');
    await guide.getByRole('heading',{name:'从素材到成图',exact:true}).waitFor();
    await shot('01-home-guide');
    let file=page.waitForEvent('filechooser');
    await click('开始：导入素材',guide);
    await (await file).setFiles([]);
    await workflow.getByRole('button',{name:'导入素材',exact:true}).waitFor();
    file=page.waitForEvent('filechooser');
    await click('导入素材',workflow);
    await (await file).setFiles(path.resolve(source));
    await workflow.getByText('修改图件',{exact:true}).waitFor();
    await workflow.getByText(/双击画布上的可编辑文字/).waitFor();
    await shot('02-guided-edit');

    await click('跳过，直接编辑',workflow);
    await workflow.waitFor({state:'hidden'});
    await text(page,/^X$/).dblclick();
    const editor=page.locator('.canvas-text-editor');
    await editor.fill('Sepal length (cm)');
    await editor.press('Enter');
    await text(page,edited).waitFor();
    await click('向导');
    await click('使用向导');
    await click('继续首次流程',guide);
    await workflow.getByText('修改图件',{exact:true}).waitFor();
    await click('打开图形质检',workflow);
    await workflow.getByText(/在质检面板点/).waitFor();
    const review=page.getByRole('complementary',{name:'图形质检与协作',exact:true});
    await click('检查当前图形',review);
    await workflow.getByText('导出成图',{exact:true}).waitFor();
    await review.getByText(/检查完成/).waitFor();
    await shot('03-guided-export');
    await click('下一步：打开导出选项',review);
    await review.waitFor({state:'hidden'});
    const [exported]=await Promise.all([page.waitForEvent('download'),
      page.getByRole('button',{name:/SVG.*可编辑矢量/}).click()]);
    await exported.saveAs(path.join(out,'iris-edited.svg'));
    const vector=fs.readFileSync(path.join(out,'iris-edited.svg'),'utf8');
    assert.match(vector,/<text\b/);
    assert(vector.includes('Sepal length (cm)'));
    await workflow.getByText('图形已导出',{exact:true}).waitFor();
    await click('完成向导',workflow);
    await workflow.waitFor({state:'hidden'});

    const savedEvent=page.waitForEvent('download');
    await click('保存');
    const savedPath=path.join(out,'iris-edited-project.json');
    await (await savedEvent).saveAs(savedPath);
    const saved=JSON.parse(fs.readFileSync(savedPath,'utf8'));
    assert.equal(saved.history.index,2,'Import and manual edit should account for the two history entries');
    const reopened=await context.newPage();
    reopened.on('dialog',dialog=>dialog.accept());
    await reopened.goto(H.localUrl(url));
    await reopened.getByRole('button',{name:'项目',exact:true}).click();
    const reopenFile=reopened.waitForEvent('filechooser');
    await reopened.getByRole('button',{name:'打开工程',exact:true}).click();
    await (await reopenFile).setFiles(savedPath);
    await reopened.getByText('工程已恢复',{exact:true}).waitFor();
    await text(reopened,edited).waitFor();
    await reopened.getByRole('button',{name:/^撤销/}).click();
    await text(reopened,/^X$/).waitFor();
    await reopened.close();
    assert.equal(H.sha(fs.readFileSync(source)),sha);
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    const result={viewport,entry:'home guide',usedFunctionSearch:false,importCancelStayedAtImport:true,svgImported:true,skippedAndResumed:true,manuallyEdited:true,
      reviewCompleted:true,svgExported:true,projectReopened:true,oneUndo:true,sourceSha256:sha};
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }catch(error){
    await shot('stopped').catch(()=>{});
    throw error;
  }finally{await context.close();await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
