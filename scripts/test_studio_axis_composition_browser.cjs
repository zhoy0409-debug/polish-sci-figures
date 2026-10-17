/* Real local editor and renderer, with explicitly synthetic composition-tail
 * events followed by ordinary Chrome keyboard editing. This is a DOM event
 * regression, never a Windows native IME or candidate-window acceptance test.
 * Never starts a service, installs, or modifies registry. */
'use strict';
const H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert,ROOT,sha}=H;
const {verifyFile}=require('./verify_studio_served_html.cjs');
const {installedProof,expectedCapability,checkCapability}=require('./test_studio_duplicate_responsiveness_browser.cjs');

function options(argv){
  const values=Object.fromEntries(argv.map(arg=>{const i=arg.indexOf('=');assert.ok(arg.startsWith('--')&&i>2,'Use --name=value');return[arg.slice(2,i),arg.slice(i+1)];}));
  for(const key of ['env','url','html','expected-html-sha256','expected-version','out'])assert.ok(values[key],'Explicit --'+key+' required');
  assert.ok(['source-runtime','installed-windows'].includes(values.env));
  assert.match(values['expected-html-sha256'],/^[a-f0-9]{64}$/);
  assert.match(values['expected-version'],/^\d+\.\d+\.\d+$/);
  const o={kind:values.env,url:H.localUrl(values.url),html:path.resolve(values.html),expectedHtmlHash:values['expected-html-sha256'],expectedVersion:values['expected-version'],out:path.resolve(values.out)};
  assert.equal(sha(fs.readFileSync(o.html)),o.expectedHtmlHash);
  assert.ok(!fs.existsSync(o.out),'Never overwrite an earlier run');
  if(o.kind==='installed-windows'){
    assert.ok(values['installed-exe']);assert.match(values['expected-exe-sha256']||'',/^[a-f0-9]{64}$/);
    o.installedExe=path.resolve(values['installed-exe']);o.expectedExeHash=values['expected-exe-sha256'];o.expectedInAppInstall=expectedCapability(values['expected-in-app-install']);
  }
  return o;
}

function exactPayload(actual,before){
  for(const key of ['project','state','history','checkpoints','dataDrafts'])assert.deepEqual(actual[key],before[key],'Uncommitted '+key+' changed');
}

async function main(o){
  const {chromium}=require('playwright');
  fs.mkdirSync(o.out,{recursive:true});
  const file=path.join(o.out,'acceptance.json');
  const report={schema:'figure-studio-axis-composition-browser/1',status:'RUNNING',kind:o.kind,startedAt:new Date().toISOString(),harnessSha256:sha(fs.readFileSync(__filename)),themes:[],scope:'Actual public Iris project, local axis rendering, Save/reopen, Undo/Redo and SVG export in headful Chrome. The rejected composition and its trailing input/change are deliberately dispatched synthetic DOM events. Subsequent correction, deletion and cancel use ordinary browser keyboard actions. This is not native Windows IME acceptance.'};
  const persist=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
  let browser;
  try{
    report.installedBefore=installedProof(o);persist();
    browser=await chromium.launch({channel:'chrome',headless:false});report.browser=browser.version();
    for(const theme of ['carbon','pearl']){
      const s=await H.browserPage(browser,{viewport:{width:1440,height:900},deviceScaleFactor:1,recordVideo:{dir:path.join(o.out,'video'),size:{width:1440,height:900}}});
      const {page,context}=s,row={theme,status:'RUNNING',checks:[],axisRequests:[]};report.themes.push(row);persist();
      try{
        const response=await context.request.get(o.url);assert.ok(response.ok());row.localSourceProof=verifyFile(o.html,await response.body(),o.expectedHtmlHash);
        await page.goto(o.url);await page.locator('#language').selectOption('en');
        row.servedBuild=await page.evaluate(()=>{const x=JSON.parse(document.getElementById('local-engine').textContent).updateInfo;return{currentVersion:x.currentVersion,platform:x.platform,architecture:x.architecture,inAppInstall:x.inAppInstall};});
        assert.equal(row.servedBuild.currentVersion,o.expectedVersion);
        if(o.kind==='installed-windows'){assert.equal(row.servedBuild.platform,'windows');assert.equal(row.servedBuild.architecture,'x86_64');checkCapability(row.servedBuild.inAppInstall,o.expectedInAppInstall);}
        await page.locator('#appearanceMenu summary').click();await page.locator('#studioTheme').selectOption(theme);await page.locator('#appearanceMenu summary').click();
        await H.loadProject(page,H.publicIris());await page.waitForFunction(()=>document.getElementById('projectTitle').textContent.includes('Iris'));
        await page.locator('[data-tab="detail"]').click();await page.locator('#professionalAxes').click();
        const host=page.locator('#professionalAxesHost'),field=key=>host.locator('[data-axis-field="'+key+'"]'),max=field('max'),apply=host.getByRole('button',{name:'Apply',exact:true}),preview=page.locator('#artboard svg[data-preview-kind="axes"]');
        await page.waitForFunction(()=>{const input=document.querySelector('#professionalAxesHost [data-axis-field="max"]');return input&&!input.disabled;});
        await host.locator('.axis-settings-live input').check();
        const endpoint=await page.evaluate(()=>new URL(JSON.parse(document.getElementById('local-engine').textContent).endpoint,location.href).href);
        page.on('request',request=>{if(request.method()==='POST'&&request.url()===endpoint){const body=request.postDataJSON();if(body?.axes)row.axisRequests.push({axes:body.axes});}});
        const baseline=await H.save(page);
        const ticks=host.locator('details').nth(1);if(!await ticks.evaluate(node=>node.open))await ticks.locator('summary').click();
        await field('major_step').fill('1');
        await max.fill('10');await host.locator('[role="status"]').getByText('Preview only; not applied.',{exact:true}).waitFor({timeout:90000});
        assert.ok(await preview.locator('text').filter({hasText:/^10(?:\.0+)?$/}).count());
        const lastValid=await preview.innerHTML(),requestCount=row.axisRequests.length;
        exactPayload(await H.save(page),baseline);row.checks.push('real-maximum-10-preview-keeps-project-history-and-source-uncommitted');

        async function rejectedTail(){
          await max.evaluate(input=>{
            input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));
            input.value='';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'中文'}));
            input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'中文'}));
            input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:false,inputType:'insertText',data:'中文'}));
            input.dispatchEvent(new Event('change',{bubbles:true}));
          });
        }
        await rejectedTail();await max.press('Enter');await page.waitForTimeout(450);
        assert.equal(await max.getAttribute('aria-invalid'),'true');assert.equal(await apply.isDisabled(),true);assert.equal(await preview.innerHTML(),lastValid);assert.equal(row.axisRequests.length,requestCount);
        exactPayload(await H.save(page),baseline);
        await max.evaluate(input=>{
          input.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));
          input.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:''}));
          input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:false,inputType:'insertText',data:''}));
          input.dispatchEvent(new Event('change',{bubbles:true}));
        });
        await max.press('Enter');await page.waitForTimeout(450);
        assert.equal(await max.getAttribute('aria-invalid'),'true');assert.equal(await apply.isDisabled(),true);assert.equal(await preview.innerHTML(),lastValid);assert.equal(row.axisRequests.length,requestCount);exactPayload(await H.save(page),baseline);
        row.checks.push('second-synthetic-cancelled-composition-cannot-clear-the-first-rejection-or-delete-the-last-range');
        await field('min').fill('0');await page.waitForTimeout(450);
        assert.equal(await apply.isDisabled(),true);assert.equal(await preview.innerHTML(),lastValid);assert.equal(row.axisRequests.length,requestCount);exactPayload(await H.save(page),baseline);
        row.checks.push('synthetic-rejected-composition-tail-and-another-field-cannot-delete-maximum-or-start-render-or-commit');

        await max.press('Control+A');await max.press('1');await max.press('1');
        await host.locator('[role="status"]').getByText('Preview only; not applied.',{exact:true}).waitFor({timeout:90000});
        assert.ok(await preview.locator('text').filter({hasText:/^11(?:\.0+)?$/}).count());assert.equal(await apply.isDisabled(),false);
        await apply.click();await host.locator('[role="status"]').getByText('Axis settings applied.',{exact:true}).waitFor({timeout:90000});
        const committed=await H.save(page),id=committed.state.order[0],asset=committed.project.panels.find(panel=>panel.id===id);
        assert.equal(asset.recipe.axis_settings.y_max,11);assert.equal(committed.history.index,baseline.history.index+1);assert.deepEqual(asset.table.rows,baseline.project.panels[0].table.rows);
        for(const source of baseline.project.panels)assert.deepEqual(committed.project.panels.find(panel=>panel.id===source.id),source,'An original source asset changed');
        await page.locator('#undo').click();assert.deepEqual((await H.save(page)).state,baseline.state);await page.locator('#redo').click();exactPayload(await H.save(page),committed);
        await H.newProject(page,'EMPTY before real Iris reopen');
        const empty=await H.save(page);assert.notEqual(empty.project.id,committed.project.id);assert.equal(empty.project.panels[0].provenance,'blank-canvas');
        await H.loadProject(page,committed,'public-iris-axis-roundtrip.json');exactPayload(await H.save(page),committed);
        const svg=await H.exportBytes(page,'export');assert.match(svg.toString('utf8'),/>11(?:\.0+)?</);fs.writeFileSync(path.join(o.out,theme+'-maximum-11.svg'),svg);row.exportSha256=sha(svg);
        row.checks.push('ordinary-keyboard-correction-commits-maximum-11-once-and-real-undo-redo-save-reopen-export-retain-source');

        await page.locator('[data-tab="detail"]').click();await page.locator('#professionalAxes').click();
        await rejectedTail();await max.press('Control+A');await max.press('Backspace');
        await host.locator('[role="status"]').getByText('Preview only; not applied.',{exact:true}).waitFor({timeout:90000});
        assert.equal(await max.inputValue(),'');assert.equal(await apply.isDisabled(),false);assert.ok(row.axisRequests.length>requestCount);
        assert.ok(!('y_max' in row.axisRequests[row.axisRequests.length-1].axes),'Deliberate clear must actually request Automatic');
        await max.press('Escape');await page.waitForTimeout(150);assert.equal(await preview.count(),0);exactPayload(await H.save(page),committed);
        row.checks.push('ordinary-deliberate-Backspace-can-request-Automatic-and-Escape-restores-exact-committed-range');
        row.screenshot=theme+'-axis-composition-regression.png';await page.screenshot({path:path.join(o.out,row.screenshot)});
        const final=await context.request.get(o.url);assert.ok(final.ok());assert.deepEqual(verifyFile(o.html,await final.body(),o.expectedHtmlHash),row.localSourceProof);
        assert.deepEqual(s.remote,[]);assert.deepEqual(s.errors,[]);row.status='PASS';
      }catch(error){row.status='FAIL_RETAINED_NO_RETRY';row.error=error.stack;throw error;}
      finally{const video=page.video();row.videoFile=path.basename(await video.path());await context.close();row.videoSha256=sha(fs.readFileSync(path.join(o.out,'video',row.videoFile)));row.remoteRequests=s.remote;row.pageErrors=s.errors;persist();}
    }
    report.installedAfter=installedProof(o);assert.deepEqual(report.installedAfter,report.installedBefore);report.status='PASS';
  }catch(error){report.status='FAIL_RETAINED_NO_RETRY';report.error=error.stack;process.exitCode=1;}
  finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();persist();}
  return report;
}

if(require.main===module)main(options(process.argv.slice(2))).then(report=>console.log(JSON.stringify({status:report.status,themes:report.themes.map(row=>({theme:row.theme,status:row.status,checks:row.checks})),error:report.error}))).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={options,exactPayload,main};
