'use strict';
/* Real installed updater acceptance. NO request routes, mocked responses or
 * fabricated progress. This script performs an installation only when the
 * operator explicitly sets STUDIO_REAL_UPDATE_INSTALL=YES. Keep proof private. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util'),{chromium}=require('playwright');
const rawURL=process.env.STUDIO_REAL_UPDATE_URL;
assert.ok(rawURL,'Set STUDIO_REAL_UPDATE_URL to the explicitly prepared installed regression client');
function loopback(value){const url=new URL(value);assert.equal(url.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'only the local installed updater may be controlled');assert.equal(url.username+url.password,'');return url.origin+'/';}
const origin=loopback(rawURL),reopen=process.env.STUDIO_REAL_UPDATE_REOPEN_URL?loopback(process.env.STUDIO_REAL_UPDATE_REOPEN_URL):origin;
const expectedBefore=process.env.STUDIO_REAL_UPDATE_FROM||'0.1.19',expectedAfter=process.env.STUDIO_REAL_UPDATE_TO||'0.1.20';
assert.equal(process.env.STUDIO_REAL_UPDATE_INSTALL,'YES','This action starts a real installation. The operator must explicitly set STUDIO_REAL_UPDATE_INSTALL=YES.');
const out=path.resolve(process.env.STUDIO_REAL_UPDATE_PROOF||'.cache/carbon-real-windows-update-'+new Date().toISOString().replace(/[:.]/g,'-'));
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a new empty proof directory for each run; prior update evidence must not be appended or overwritten');fs.mkdirSync(out,{recursive:true});
const elapsed=(()=>{const start=process.hrtime.bigint();return()=>Number(process.hrtime.bigint()-start)/1e6;})(),events=[],observed=new Set();
const report={kind:'real_installed_updater',clientDescription:process.env.STUDIO_REAL_UPDATE_CLIENT_DESCRIPTION||'operator-supplied installed local client',sourceURL:origin,reopenURL:reopen,expectedBefore,expectedAfter,installCommands:0,downloadCommands:0,observedStages:[],unobservedStages:[],limitations:[],passed:false};
function log(kind,value={}){const event={at:new Date().toISOString(),elapsedMs:elapsed(),kind,...value};events.push(event);fs.appendFileSync(path.join(out,'timed-events.jsonl'),JSON.stringify(event)+'\n');}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tables=payload=>payload.project.panels.map(panel=>({id:panel.id,rows:panel.table?.rows??null,sha256:panel.table?.sha256??null}));
function assertScientificData(actual,expected,label){assert.equal(actual.project.id,expected.project.id,label+': original project identity');assert.deepEqual(tables(actual),tables(expected),label+': every original panel table row/value and table hash must survive');}
async function health(url){try{const response=await fetch(url,{signal:AbortSignal.timeout(1800)});if(!response.ok)return null;const html=await response.text(),match=html.match(/<script id="local-engine" type="application\/json">([\s\S]*?)<\/script>/);const info=match?JSON.parse(match[1]).updateInfo:null;return info?{currentVersion:info.currentVersion,suiteVersion:info.suiteVersion,platform:info.platform}:null;}catch{return null;}}
(async()=>{
  let browser,context,page,video,sampleTimer,sampling=false,lastUI='',lastBytes=null,installClicked=false,projectOpenExpected=false;
  const checkDialogs=()=>assert.ok(!report.unexpectedDialogs?.length,'An unexpected browser dialog was dismissed; acceptance must stop');
  async function sample(){if(sampling||!page||page.isClosed())return;sampling=true;try{
    const value=await page.evaluate(()=>{const scene=document.querySelector('.update-progress-scene'),progress=document.querySelector('#studioUpdateDialog progress'),caption=document.querySelector('.update-progress-caption');return scene?{scene:scene.dataset.state,motion:scene.dataset.motion,animation:scene.dataset.animation,indeterminate:scene.dataset.indeterminate,ratio:scene.style.getPropertyValue('--update-progress'),received:progress?.hasAttribute('value')?progress.value:null,total:progress?.hasAttribute('value')?progress.max:null,percent:document.querySelector('.update-progress-percent')?.hidden?null:document.querySelector('.update-progress-percent')?.textContent,caption:caption?.textContent,summary:document.querySelector('.update-summary')?.textContent}:null;});
    if(value){const stamp=JSON.stringify(value);if(stamp!==lastUI){lastUI=stamp;log('ui',value);observed.add(value.scene);}}
  }catch{if(installClicked)log('ui-temporarily-unreachable');}finally{sampling=false;}}
  async function saveProject(name){checkDialogs();const pending=page.waitForEvent('download',{timeout:30000});await page.locator('#save').click();const download=await pending,target=path.join(out,name);await download.saveAs(target);const bytes=fs.readFileSync(target),payload=JSON.parse(bytes);assert.ok(payload.project&&payload.state,'the Save command must produce a readable actual project');checkDialogs();log('project-saved',{file:name,sha256:hash(bytes),projectId:payload.project.id});return {target,bytes,payload};}
  async function openProject(file,payload){projectOpenExpected=true;try{await page.locator('#projectFile').setInputFiles(file);const expectedTitle=payload.project.title_i18n?.en||payload.project.title;await page.waitForFunction(title=>document.querySelector('#projectTitle')?.textContent===title,expectedTitle,{timeout:30000});checkDialogs();}finally{projectOpenExpected=false;}}
  try{
    // Video initialization can fail before a page exists (for example, a
    // missing ffmpeg binary). Every acquired resource is already in finally's
    // scope; no update action has happened at this point.
    browser=await chromium.launch({headless:process.env.STUDIO_REAL_UPDATE_HEADLESS!=='0',channel:'chrome'});
    context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true,recordVideo:{dir:path.join(out,'video'),size:{width:1280,height:900}}});
    page=await context.newPage();video=page.video();
    const openMessages=new Set(['打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。','Opening a project replaces the current workspace. If your edits have not been downloaded, cancel and save the project first.']);
    page.on('dialog',async dialog=>{
      const expected=dialog.type()==='confirm'&&projectOpenExpected&&openMessages.has(dialog.message());
      if(expected){log('browser-dialog',{kind:'open-project-confirmation',type:dialog.type(),message:dialog.message(),action:'accept'});try{await dialog.accept();}catch{(report.unexpectedDialogs??=[]).push({kind:'open-project-accept-failed'});}}
      else{const record={kind:'unexpected-browser-dialog',type:dialog.type(),message:'Unrecognized dialog text withheld to avoid exposing local paths',messageSHA256:hash(dialog.message()),action:'dismiss'};(report.unexpectedDialogs??=[]).push(record);log('browser-dialog',record);try{await dialog.dismiss();}catch{}}
    });
    page.on('pageerror',error=>log('browser-error',{message:error.message}));
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/update-install')try{const action=JSON.parse(request.postData()||'{}').action;if(action==='install'){report.installCommands++;assert.equal(report.installCommands,1,'installation must never be repeated');}if(action==='download')report.downloadCommands++;log('updater-request',{action});}catch(error){log('request-inspection-error',{message:error.message});}});
    page.on('response',async response=>{if(new URL(response.url()).pathname!=='/api/update-install')return;try{
      const value=await response.json(),record={httpStatus:response.status(),status:value.status,received:value.received,total:value.total,error:value.error,errorStage:value.errorStage};log('updater-response',record);if(value.status)observed.add(value.status);
      if(value.status==='downloading'&&Number.isFinite(value.received)){if(lastBytes!==null&&value.received<lastBytes){report.progressViolation=true;log('nonmonotonic-backend-progress',{previous:lastBytes,received:value.received});}lastBytes=value.received;}
    }catch{log('updater-response-unreadable',{httpStatus:response.status(),afterInstallClick:installClicked});}});
    page.on('requestfailed',request=>{if(new URL(request.url()).pathname==='/api/update-install')log('updater-transport-disconnected',{afterInstallClick:installClicked,reason:request.failure()?.errorText});});
    await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#save').waitFor({timeout:60000});
    report.before=await health(origin);assert.equal(report.before?.currentVersion,expectedBefore);assert.equal(report.before?.platform,'windows');
    if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();await page.locator('#language').selectOption('en');
    let inputPayload=null;
    if(process.env.STUDIO_REAL_UPDATE_PROJECT){const input=path.resolve(process.env.STUDIO_REAL_UPDATE_PROJECT),bytes=fs.readFileSync(input);inputPayload=JSON.parse(bytes);assert.ok(inputPayload.project&&inputPayload.state);await openProject(input,inputPayload);report.inputProjectSha256=hash(bytes);log('operator-project-opened',{sha256:hash(bytes),projectId:inputPayload.project.id});}
    const saved=await saveProject('project-before-update.json');report.savedProject={file:path.basename(saved.target),sha256:hash(saved.bytes),projectId:saved.payload.project.id};
    if(inputPayload)assertScientificData(saved.payload,inputPayload,'before installation');report.scientificTableSha256=hash(JSON.stringify(tables(saved.payload)));
    await page.locator('#studioCheckUpdates').click();await page.locator('.update-download').waitFor({state:'visible',timeout:60000});
    const latest=await page.locator('.update-versions dd').last().innerText();assert.equal(latest,expectedAfter,'stop if the real release offer differs from the intended target');
    assert.equal(await page.locator('.update-download').innerText(),'Download and prepare update','installed capability must be available');
    await page.screenshot({path:path.join(out,'before-real-download.png')});sampleTimer=setInterval(()=>sample(),250);checkDialogs();await page.locator('.update-download').click();log('user-started-real-download');
    const downloadDeadline=Date.now()+(Number(process.env.STUDIO_REAL_UPDATE_DOWNLOAD_TIMEOUT_MS)||600000);let ready=false;
    while(Date.now()<downloadDeadline){checkDialogs();await sample();if(await page.locator('#studioInstallUpdate').isVisible()){ready=true;break;}if(await page.locator('.update-error').isVisible())throw Error('The real updater reported an error before ready: '+await page.locator('.update-error').innerText());await delay(500);}
    assert.ok(ready,'the real updater did not confirm ready before the download deadline');assert.ok(observed.has('ready'),'the ready UI must correspond to an observed backend/UI ready state');assert.ok(!report.progressViolation,'real backend progress regressed within this download');
    await page.screenshot({path:path.join(out,'real-package-verified-ready.png')});assert.equal(await page.locator('#studioInstallUpdate').isDisabled(),true);
    // The project has already been downloaded and parsed above. One explicit
    // checkbox and click authorizes this single real installation attempt.
    checkDialogs();await page.locator('#studioUpdateSaved').check();await page.locator('#studioInstallUpdate').click();installClicked=true;log('user-confirmed-install-once');
    const installDeadline=Date.now()+(Number(process.env.STUDIO_REAL_UPDATE_INSTALL_TIMEOUT_MS)||600000);let after=null,originalDisconnected=false;
    while(Date.now()<installDeadline){
      checkDialogs();await sample();const current=await health(origin);if(!current){if(!originalDisconnected){originalDisconnected=true;log('old-origin-unreachable',{installingObserved:observed.has('installing')});}}
      else if(current.currentVersion===expectedAfter){after=current;break;}
      if(reopen!==origin){const alternate=await health(reopen);if(alternate?.currentVersion===expectedAfter){after=alternate;break;}}
      if(!originalDisconnected&&await page.locator('.update-error').isVisible().catch(()=>false))throw Error('The real updater reported an installation error: '+await page.locator('.update-error').innerText());
      await delay(1000);
    }
    assert.ok(after,'a real updated server did not reopen at the configured origin(s) before the deadline');report.after=after;report.originalDisconnected=originalDisconnected;report.installingHandshakeObserved=observed.has('installing');
    if(!report.installingHandshakeObserved)report.limitations.push('The installing response was not observed. Reopening at the target version is recorded separately; external helper evidence is required to verify that brief handoff.');
    clearInterval(sampleTimer);sampleTimer=null;
    await page.goto(reopen,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#artboard > svg').waitFor({timeout:60000});if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();
    const first=await saveProject('project-after-reopen.json');report.automaticProjectRestore=first.payload.project.id===saved.payload.project.id&&isDeepStrictEqual(first.payload.state,saved.payload.state)&&isDeepStrictEqual(tables(first.payload),tables(saved.payload));
    if(!report.automaticProjectRestore){await openProject(saved.target,saved.payload);const reopened=await saveProject('project-after-explicit-open.json');assertScientificData(reopened.payload,saved.payload,'after explicit reopening');assert.deepEqual(reopened.payload.state,saved.payload.state);report.explicitSavedProjectReadable=true;report.limitations.push('Saved project was verified through explicit reopening. Automatic restoration was not established for this browser origin/profile.');}else{assertScientificData(first.payload,saved.payload,'after automatic restoration');report.explicitSavedProjectReadable=true;}
    await page.screenshot({path:path.join(out,'real-updated-editor.png')});assert.equal(report.downloadCommands,1);assert.equal(report.installCommands,1);report.passed=true;log('real-browser-acceptance-complete',{version:after.currentVersion,automaticProjectRestore:report.automaticProjectRestore});
  }catch(error){report.failure=error.message;log('acceptance-stopped',{reason:error.message,installClicked,installCommands:report.installCommands});throw error;}
  finally{
    clearInterval(sampleTimer);report.observedStages=[...observed];report.unobservedStages=['checking','downloading','verifying','ready','preparing','installing'].filter(state=>!observed.has(state));if(report.unobservedStages.length)report.limitations.push('Unobserved stages are not reconstructed or inserted into the recording.');
    // Try every cleanup even if an earlier close or video finalization fails.
    // Keep the original acceptance error and persist initialization failures.
    const cleanupErrors=[];
    for(const [resource,close] of [['context',()=>context?.close()],['browser',()=>browser?.close()],['video',async()=>{if(video)report.video=path.relative(out,await video.path());}]]){
      try{await close();}catch(error){cleanupErrors.push({resource,message:error.message});}
    }
    if(cleanupErrors.length){report.cleanupErrors=cleanupErrors;report.passed=false;}
    fs.writeFileSync(path.join(out,'real-update-result.json'),JSON.stringify(report,null,2));
    if(cleanupErrors.length&&!report.failure)throw Error('Browser cleanup failed; see real-update-result.json');
  }
  console.log(JSON.stringify({passed:report.passed,proof:out,observedStages:report.observedStages,unobservedStages:report.unobservedStages}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
