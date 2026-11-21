'use strict';
const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;

async function main(){
  const [url,projectFile,destination]=process.argv.slice(2);
  assert(url&&projectFile&&destination,'Usage: node scripts/test_studio_daily_roundtrip_browser.cjs LOCAL_URL PROJECT OUTPUT');
  const out=path.resolve(destination);
  fs.mkdirSync(out,{recursive:true});
  const sourceBytes=fs.readFileSync(projectFile), source=JSON.parse(sourceBytes.toString('utf8'));
  const sourceHash=H.sha(sourceBytes);
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:'chrome'});
  const {context,page,errors,remote}=await H.browserPage(browser);
  const start=()=>performance.now(), measurements={};
  async function dragProject(tab,bytes){
    const transfer=await tab.evaluateHandle(encoded=>{
      const dt=new DataTransfer(), body=Uint8Array.from(atob(encoded),char=>char.charCodeAt(0));
      dt.items.add(new File([body],'saved-figure-studio-project.json',{type:'application/json'}));
      return dt;
    },bytes.toString('base64'));
    try{
      await tab.locator('#viewport').dispatchEvent('dragover',{dataTransfer:transfer});
      await tab.locator('#viewport').dispatchEvent('drop',{dataTransfer:transfer});
      await tab.waitForFunction(()=>document.getElementById('status')?.textContent.includes('工程已恢复'));
    }finally{await transfer.dispose();}
  }
  try{
    await page.goto(H.localUrl(url));
    await H.dismiss(page);
    let began=start();
    await dragProject(page,sourceBytes);
    measurements.dragToOpenedMs=Math.round(start()-began);
    const before=await H.save(page);
    assert.equal(before.project.id,source.project.id);
    assert.deepEqual(before.project.panels,source.project.panels);
    const id=before.state.order[0],panel=before.project.panels.find(value=>value.id===id);
    assert(panel.table?.rows.length>1);
    const initialEdits=before.state.panels[id].edits;
    const art=page.locator(`#artboard [data-panel="${id}"] text[data-key]`);
    await art.first().click();
    await page.locator('#openQualityWorkspace').click();
    const review=page.locator('#qualityWorkspace');
    began=start();
    const scan=review.getByRole('button',{name:'检查当前图形'});
    const saveReport=review.getByRole('button',{name:'保存检查报告'});
    await scan.click();
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('#qualityWorkspace button')).some(button=>button.textContent==='保存检查报告'&&!button.disabled));
    measurements.finalSizeReviewMs=Math.round(start()-began);
    const pending=page.waitForEvent('download');
    await saveReport.click();
    await (await pending).saveAs(path.join(out,'review.json'));
    const report=JSON.parse(fs.readFileSync(path.join(out,'review.json'),'utf8'));
    assert(report.summary.objects>0&&report.summary.texts>0);

    await review.getByText('与 Skill 协作',{exact:true}).click();
    let fileHandoffs=0;
    const countHandoff=()=>fileHandoffs++;
    page.on('download',countHandoff);
    began=start();
    await review.getByRole('button',{name:'复制局部 Skill 任务（含图中文字）'}).click();
    const prompt=review.locator('.quality-handoff textarea');
    await prompt.waitFor();
    const content=await prompt.inputValue();
    measurements.prepareTaskMs=Math.round(start()-began);
    const task=JSON.parse(content.slice(content.indexOf('\n\n')+2));
    assert.deepEqual(task.panels.map(p=>p.id),[id]);
    assert(!task.panels[0].table&&!task.panels[0].analysis);
    assert.equal(task.task.scope,'styles');
    assert(task.panels[0].elements.every(e=>e.tag==='text'||task.selection.keys.includes(e.key)));
    const rawEdits=initialEdits[task.panels[0].variant]||{};
    const target=task.panels[0].elements.find(e=>e.tag==='text'&&!e.locked&&!rawEdits[e.key]&&e.text.trim());
    assert(target,'The existing chart must have a separate editable label for a targeted change');
    const patch={schema:'figure-studio-operations/1',projectId:task.projectId,base:{[id]:task.panels[0].revision},
      operations:[{type:'element.style',panel:id,variant:task.panels[0].variant,key:target.key,style:{fill:'#176b5d'}}]};
    await review.getByText('粘贴 Skill 修改',{exact:true}).click();
    await review.getByRole('textbox',{name:'粘贴 Skill 修改'}).fill(JSON.stringify(patch));
    began=start();
    await review.getByRole('button',{name:'预览粘贴的修改'}).click();
    await review.locator('.quality-preview-bar').waitFor();
    measurements.pasteToPreviewMs=Math.round(start()-began);
    assert.equal(fileHandoffs,0);
    page.off('download',countHandoff);
    await page.locator('#artboard').screenshot({path:path.join(out,'preview.png')});
    await review.getByRole('button',{name:'保留修改'}).click();
    const kept=await H.save(page);
    assert.equal(kept.history.index,before.history.index+1);
    assert.deepEqual(kept.project.panels,before.project.panels);
    const expected=structuredClone(before.state);
    expected.panels[id].edits[task.panels[0].variant]??={};
    expected.panels[id].edits[task.panels[0].variant][target.key]={fill:'#176b5d'};
    assert.deepEqual(kept.state,expected);
    const saved=Buffer.from(JSON.stringify(kept));
    fs.writeFileSync(path.join(out,'kept-project.json'),saved);
    await page.close();

    const reopened=await context.newPage();
    reopened.on('pageerror',error=>errors.push(error.message));
    reopened.on('dialog',dialog=>dialog.accept());
    await reopened.goto(H.localUrl(url));
    await H.dismiss(reopened);
    began=start();
    await dragProject(reopened,saved);
    measurements.reopenMs=Math.round(start()-began);
    const reopenedProject=await H.save(reopened);
    assert.deepEqual(reopenedProject.state,kept.state);
    assert.deepEqual(reopenedProject.history,kept.history);
    const svg=await H.exportBytes(reopened,'export');
    const png=await H.exportBytes(reopened,'png');
    assert(svg.toString().includes('<svg'));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    fs.writeFileSync(path.join(out,'final.svg'),svg);
    fs.writeFileSync(path.join(out,'final.png'),png);
    await reopened.locator('#undo').click();
    assert.deepEqual((await H.save(reopened)).state,before.state);
    assert.equal(H.sha(fs.readFileSync(projectFile)),sourceHash);
    assert.deepEqual(remote,[]);
    assert.deepEqual(errors,[]);
    const result={browser:browser.version(),observations:panel.table.rows.length-1,
      retainedVariants:panel.variants.length,priorManualEdits:Object.values(initialEdits).flatMap(v=>Object.keys(v)).length,
      originalSha256:sourceHash,measurements,fileHandoffs,reportSummary:report.summary,
      history:{before:before.history.index,after:kept.history.index},exports:{svg:svg.length,png:png.length}};
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }finally{await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
