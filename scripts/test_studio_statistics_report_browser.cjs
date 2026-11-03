'use strict';
const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;

(async()=>{
  const url=H.localUrl(process.argv[2]),out=path.resolve(process.argv[3]);
  fs.mkdirSync(out,{recursive:true});
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{}:{channel:'chrome'});
  try{
    const {page,errors,remote}=await H.browserPage(browser);
    await page.goto(url);
    await H.dismiss(page);
    await page.locator('#language').selectOption('en');
    const before=await H.save(page);
    await H.revealTool(page,'configureStatistics');
    await page.locator('#configureStatistics').click();
    const report=page.locator('#exportStatisticsReport');
    assert(await report.isDisabled());
    await page.locator('#statisticsSource').selectOption('external');
    await page.locator('#statisticsTable').fill([
      'sample_id,group,value','private-id-A1,A,1.2','a2,A,2.3','a3,A,3.6',
      'b1,B,4.1','b2,B,5.4','b3,B,6.8',
      'c1,C,2.7','c2,C,3.9','c3,C,6.2'
    ].join('\n'));
    await page.locator('#statisticsGroup').selectOption('group');
    await page.locator('#statisticsValue').selectOption('value');
    await page.locator('#statisticsUnit').selectOption('sample_id');
    await page.locator('#statisticsDesign').selectOption('independent');
    await page.locator('#statisticsOutcome').selectOption('continuous');
    await page.locator('#statisticsUnitConfirmed').check();
    const response=page.waitForResponse(r=>r.url().endsWith('/api/analyze'));
    await page.locator('.statistics-method-card').first().click();
    const result=await(await response).json();
    assert(!result.error,result.error);
    assert.equal(result.analysis.correction,'Holm');
    await page.waitForFunction(()=>!document.getElementById('exportStatisticsReport').disabled);
    const pending=page.waitForEvent('download');
    await report.click();
    const downloaded=await pending;
    assert.equal(downloaded.suggestedFilename(),'statistical-report.html');
    const artifact=path.join(out,'statistical-report.html');
    await downloaded.saveAs(artifact);
    const reportPage=await page.context().newPage();
    await reportPage.setContent(fs.readFileSync(artifact,'utf8'));
    const rows=await reportPage.locator('tbody tr').all();
    assert.equal(rows.length,result.analysis.comparison_count);
    for(let i=0;i<rows.length;i++){
      const expected=result.analysis.primary_test.pairwise[i];
      const cells=await rows[i].locator('td').allTextContents();
      const display=n=>Number(n.toPrecision(6)).toString();
      assert(cells.includes(display(expected.estimate)));
      assert(cells.includes(display(expected.degrees_of_freedom)));
      assert.deepEqual(cells.slice(-2),[display(expected.p_raw),display(expected.p)]);
    }
    const retained=JSON.parse(await reportPage.locator('details pre').textContent());
    assert.deepEqual(retained.analysis,result.analysis);
    const body=await reportPage.locator('body').textContent();
    assert(body.includes(result.data_sha256));
    assert(!body.includes('private-id-A1'));
    assert.equal(await reportPage.locator('th i').count(),2);
    await reportPage.screenshot({path:path.join(out,'statistical-report.png'),fullPage:true});
    await page.locator('#statisticsOutcome').selectOption('ordinal');
    assert(await report.isDisabled());

    await page.locator('#statisticsSource').selectOption('results');
    await page.locator('#statisticsTable').fill('group_a,group_b,p_value\n<Control>,Treatment,0.01785');
    await page.locator('#statisticsGroupA').selectOption('group_a');
    await page.locator('#statisticsGroupB').selectOption('group_b');
    await page.locator('#statisticsPValue').selectOption('p_value');
    await page.locator('#statisticsAdjustment').selectOption('already_adjusted');
    await page.locator('#statisticsResultMethod').fill('External comparison');
    await page.locator('#statisticsCorrection').fill('Holm');
    await page.locator('#statisticsResultsConfirmed').check();
    await page.locator('#runStatistics').click();
    await page.waitForFunction(()=>!document.getElementById('exportStatisticsReport').disabled);
    const imported=page.waitForEvent('download');
    await report.click();
    await reportPage.setContent(fs.readFileSync(await(await imported).path(),'utf8'));
    assert.deepEqual(await reportPage.locator('tbody td').allTextContents(),['Treatment − <Control>','—','0.01785']);
    await page.locator('#closeStatistics').click();
    const after=await H.save(page);
    assert.deepEqual(after.project,before.project);
    assert.deepEqual(after.state,before.state);
    assert.deepEqual(after.history,before.history);
    assert.deepEqual(errors,[]);
    assert.deepEqual(remote,[]);
    console.log('Report download matches the live engine, excludes observations, invalidates stale results and preserves project history.');
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
