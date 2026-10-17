'use strict';
/* Separate post-install continuation. Does not download or install an update.
 * Reads prior evidence without modifying it, then uses real Open and Save. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util'),{chromium}=require('playwright');
const priorDirectory=process.env.STUDIO_POST_UPDATE_PRIOR;assert.ok(priorDirectory,'Set STUDIO_POST_UPDATE_PRIOR to the preserved original real-update proof directory');
const prior=path.resolve(priorDirectory),originalReportFile=path.join(prior,'real-update-result.json'),originalProjectFile=path.join(prior,'project-before-update.json'),reportBytes=fs.readFileSync(originalReportFile),projectBytes=fs.readFileSync(originalProjectFile),original=JSON.parse(reportBytes),expected=JSON.parse(projectBytes);
const address=new URL(process.env.STUDIO_POST_UPDATE_URL||original.reopenURL);assert.equal(address.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(address.hostname));assert.equal(address.username+address.password,'');
const targetVersion=process.env.STUDIO_POST_UPDATE_VERSION||original.expectedAfter,out=path.resolve(process.env.STUDIO_POST_UPDATE_PROOF||'.cache/carbon-post-update-'+new Date().toISOString().replace(/[:.]/g,'-'));
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a new empty continuation proof directory');fs.mkdirSync(out,{recursive:true});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),tables=value=>value.project.panels.map(panel=>({id:panel.id,rows:panel.table?.rows??null,sha256:panel.table?.sha256??null}));
const report={kind:'separate_post_install_continuation',noDownloadOrInstallation:true,priorRunPassed:original.passed,priorFailure:original.failure||null,priorReportSHA256:hash(reportBytes),priorSavedProjectSHA256:hash(projectBytes),targetVersion,expectedProjectId:expected.project.id,updateCommands:[],dialogs:[],passed:false};
(async()=>{
  let browser,context,page,opening=false;
  const assertData=payload=>{assert.equal(payload.project.id,expected.project.id);assert.deepEqual(tables(payload),tables(expected),'every original scientific table row/value/hash is preserved');assert.deepEqual(payload.state,expected.state,'the saved editable state is preserved');};
  try{
    browser=await chromium.launch({headless:true,channel:'chrome'});context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});page=await context.newPage();
    const allowed=new Set(['打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。','Opening a project replaces the current workspace. If your edits have not been downloaded, cancel and save the project first.']);
    page.on('dialog',async dialog=>{if(opening&&dialog.type()==='confirm'&&allowed.has(dialog.message())){report.dialogs.push({kind:'explicit-project-open',type:'confirm',message:dialog.message(),action:'accept'});await dialog.accept();}else{report.dialogs.push({kind:'unexpected',type:dialog.type(),messageSHA256:hash(dialog.message()),action:'dismiss'});await dialog.dismiss();}});
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/update-install')try{report.updateCommands.push(JSON.parse(request.postData()||'{}').action);}catch{report.updateCommands.push('unreadable');}});
    await page.goto(address.origin+'/',{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#artboard > svg').waitFor({timeout:60000});
    report.servedBuild=await page.evaluate(()=>{const value=JSON.parse(document.getElementById('local-engine').textContent).updateInfo;return {currentVersion:value.currentVersion,suiteVersion:value.suiteVersion,platform:value.platform};});assert.equal(report.servedBuild.currentVersion,targetVersion);
    if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();await page.locator('#language').selectOption('en');
    async function save(name){const pending=page.waitForEvent('download',{timeout:30000});await page.locator('#save').click();const download=await pending,file=path.join(out,name);await download.saveAs(file);return JSON.parse(fs.readFileSync(file,'utf8'));}
    const autoload=await save('project-at-navigation.json');report.automaticProjectRestore=autoload.project.id===expected.project.id&&isDeepStrictEqual(autoload.state,expected.state)&&isDeepStrictEqual(tables(autoload),tables(expected));
    opening=true;try{await page.locator('#projectFile').setInputFiles(originalProjectFile);await page.waitForFunction(title=>document.querySelector('#projectTitle')?.textContent===title,expected.project.title_i18n?.en||expected.project.title,{timeout:30000});}finally{opening=false;}
    assert.equal(report.dialogs.some(item=>item.kind==='unexpected'),false,'unknown dialogs are dismissed and fail continuation');
    const saved=await save('project-after-explicit-open.json');assertData(saved);report.explicitSavedProjectReadable=true;report.scientificTableSHA256=hash(JSON.stringify(tables(saved)));await page.screenshot({path:path.join(out,'updated-editor-project-readability.png')});
    assert.deepEqual(report.updateCommands,[],'this continuation must not invoke the installed updater');report.passed=true;
  }catch(error){report.failure=error.message;throw error;}
  finally{
    const cleanup=[];try{await context?.close();}catch(error){cleanup.push({resource:'context',message:error.message});}try{await browser?.close();}catch(error){cleanup.push({resource:'browser',message:error.message});}
    if(cleanup.length){report.cleanupErrors=cleanup;report.passed=false;}
    report.originalEvidenceUnchanged=hash(fs.readFileSync(originalReportFile))===report.priorReportSHA256&&hash(fs.readFileSync(originalProjectFile))===report.priorSavedProjectSHA256;
    if(!report.originalEvidenceUnchanged){report.passed=false;report.failure='Original evidence changed during continuation';}
    fs.writeFileSync(path.join(out,'continuation-result.json'),JSON.stringify(report,null,2));if(!report.passed&&!report.failure)throw Error('Continuation cleanup failed');
  }
  if(!report.passed)throw Error(report.failure||'Post-install continuation failed');
  console.log(JSON.stringify({passed:report.passed,kind:report.kind,out,automaticProjectRestore:report.automaticProjectRestore,explicitSavedProjectReadable:report.explicitSavedProjectReadable}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
