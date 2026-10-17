'use strict';
/* Real installed updater acceptance. NO request routes, mocked responses or
 * fabricated progress. This script performs an installation only when the
 * operator explicitly sets STUDIO_REAL_UPDATE_INSTALL=YES. Keep proof private. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{isDeepStrictEqual}=require('node:util'),{chromium}=require('playwright');
const Evidence=require('./studio_update_real_evidence.cjs');
const rawURL=process.env.STUDIO_REAL_UPDATE_URL;
assert.ok(rawURL,'Set STUDIO_REAL_UPDATE_URL to the explicitly prepared installed regression client');
function loopback(value){const url=new URL(value);assert.equal(url.protocol,'http:');assert.ok(['127.0.0.1','localhost','[::1]'].includes(url.hostname),'only the local installed updater may be controlled');assert.equal(url.username+url.password,'');return url.origin+'/';}
const origin=loopback(rawURL),reopen=process.env.STUDIO_REAL_UPDATE_REOPEN_URL?loopback(process.env.STUDIO_REAL_UPDATE_REOPEN_URL):origin;
assert.equal(reopen,origin,'Strict automatic restoration requires the same browser origin');
const expectedBefore=process.env.STUDIO_REAL_UPDATE_FROM||'0.1.19',expectedAfter=process.env.STUDIO_REAL_UPDATE_TO||'0.1.20';
assert.equal(process.env.STUDIO_REAL_UPDATE_INSTALL,'YES','This action starts a real installation. The operator must explicitly set STUDIO_REAL_UPDATE_INSTALL=YES.');
assert.ok(process.env.STUDIO_REAL_UPDATE_PROJECT,'Supply an actual scientific project for strict data/state/SVG acceptance');
const evidenceConfig=Evidence.configuration(path.resolve(__dirname,'..'),origin);
const out=path.resolve(process.env.STUDIO_REAL_UPDATE_PROOF||'.cache/carbon-real-windows-update-'+new Date().toISOString().replace(/[:.]/g,'-'));
assert.ok(!fs.existsSync(out)||fs.readdirSync(out).length===0,'Use a new empty proof directory for each run; prior update evidence must not be appended or overwritten');fs.mkdirSync(out,{recursive:true});
const elapsed=(()=>{const start=process.hrtime.bigint();return()=>Number(process.hrtime.bigint()-start)/1e6;})(),events=[],observed=new Set(),uiObserved=new Set(),backendObserved=new Set();
const report={kind:'real_installed_updater',clientDescription:process.env.STUDIO_REAL_UPDATE_CLIENT_DESCRIPTION||'operator-supplied installed local client',sourceURL:origin,reopenURL:reopen,expectedBefore,expectedAfter,installCommands:0,downloadCommands:0,observedStages:[],unobservedStages:[],limitations:[],passed:false};
function log(kind,value={}){const event={at:new Date().toISOString(),elapsedMs:elapsed(),kind,...value};events.push(event);fs.appendFileSync(path.join(out,'timed-events.jsonl'),JSON.stringify(event)+'\n');}
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const tables=payload=>payload.project.panels.map(panel=>({id:panel.id,rows:panel.table?.rows??null,sha256:panel.table?.sha256??null}));
const sourceSVG=payload=>payload.project.panels.map(panel=>({id:panel.id,svg:panel.variants.map(variant=>variant.svg)}));
function assertScientificData(actual,expected,label){Evidence.assertCorePayload(actual,expected,label);assert.equal(actual.project.id,expected.project.id,label+': original project identity');assert.deepEqual(tables(actual),tables(expected),label+': every original panel table row/value and table hash must survive');assert.deepEqual(sourceSVG(actual),sourceSVG(expected),label+': all original scientific SVG variants');assert.deepEqual(actual.state,expected.state,label+': exact editable state');}
async function health(url){try{const response=await fetch(url,{signal:AbortSignal.timeout(1800)});if(!response.ok)return null;const html=await response.text(),match=html.match(/<script id="local-engine" type="application\/json">([\s\S]*?)<\/script>/);const info=match?JSON.parse(match[1]).updateInfo:null;return info?{currentVersion:info.currentVersion,suiteVersion:info.suiteVersion,platform:info.platform}:null;}catch{return null;}}
(async()=>{
  let browser,context,page,video,sampleTimer,statusTimer,statusBusy=false,statusToken,sampling=false,lastUI='',lastBytes=null,installClicked=false,projectOpenExpected=false,job=null,beforeFiles=null,releaseOffer=null,settingsBefore=null;
  const checkDialogs=()=>{assert.ok(!report.unexpectedDialogs?.length,'An unexpected browser dialog was dismissed; acceptance must stop');assert.ok(!report.browserErrors?.length,'A real page error occurred; acceptance must stop');assert.ok(!report.commandViolation,'An unexpected or repeated updater action occurred');};
  async function statusProbe(){if(statusBusy||!statusToken)return;statusBusy=true;try{const response=await fetch(origin+'api/update-install',{method:'POST',headers:{Origin:origin.slice(0,-1),'Content-Type':'application/json','X-Studio-Token':statusToken},body:JSON.stringify({action:'status'}),signal:AbortSignal.timeout(1200)});if(response.ok){const value=await response.json();if(value.status){backendObserved.add(value.status);observed.add(value.status);}const stamp=JSON.stringify([value.status,value.received,value.total]);if(stamp!==statusProbe.last){statusProbe.last=stamp;log('passive-authenticated-status',{status:value.status,received:value.received,total:value.total});}}}catch{}finally{statusBusy=false;}}
  async function sample(){if(sampling||!page||page.isClosed())return;sampling=true;try{
    const value=await page.evaluate(()=>{const scene=document.querySelector('.update-progress-scene'),progress=document.querySelector('#studioUpdateDialog progress'),caption=document.querySelector('.update-progress-caption');return scene?{scene:scene.dataset.state,motion:scene.dataset.motion,animation:scene.dataset.animation,indeterminate:scene.dataset.indeterminate,ratio:scene.style.getPropertyValue('--update-progress'),received:progress?.hasAttribute('value')?progress.value:null,total:progress?.hasAttribute('value')?progress.max:null,percent:document.querySelector('.update-progress-percent')?.hidden?null:document.querySelector('.update-progress-percent')?.textContent,caption:caption?.textContent,summary:document.querySelector('.update-summary')?.textContent}:null;});
    if(value){const stamp=JSON.stringify(value);if(stamp!==lastUI){lastUI=stamp;log('ui',value);observed.add(value.scene);uiObserved.add(value.scene);}}
  }catch{if(installClicked)log('ui-temporarily-unreachable');}finally{sampling=false;}}
  async function saveProject(name){checkDialogs();const pending=page.waitForEvent('download',{timeout:30000});await page.locator('#save').click();const download=await pending,target=path.join(out,name);await download.saveAs(target);const bytes=fs.readFileSync(target),payload=JSON.parse(bytes);assert.ok(payload.project&&payload.state,'the Save command must produce a readable actual project');checkDialogs();log('project-saved',{file:name,sha256:hash(bytes),projectId:payload.project.id});return {target,bytes,payload};}
  async function openProject(file,payload){projectOpenExpected=true;try{await page.locator('#projectFile').setInputFiles(file);const expectedTitle=payload.project.title_i18n?.en||payload.project.title;await page.waitForFunction(title=>document.querySelector('#projectTitle')?.textContent===title,expectedTitle,{timeout:30000});checkDialogs();}finally{projectOpenExpected=false;}}
  async function verifyThemePreservation(phase,baseline){
    const available=await page.locator('#appearanceMenu').count()>0&&await page.locator('#studioTheme').count()>0;
    const modern=value=>{const [a,b,c]=value.split('.').map(Number);return a>0||b>1||b===1&&c>=21;};
    if(!available){assert.ok(!(modern(expectedBefore)&&modern(expectedAfter)),'A supported installed version is missing appearance controls');report.limitations.push(phase+': older official UI has no theme controls; no theme-switch acceptance is claimed for this phase.');return;}
    const initial=await page.locator('#studioTheme').inputValue(),hasSurround=await page.locator('#studioSurround').count()>0,initialSurround=hasSurround?await page.locator('#studioSurround').inputValue():null;
    async function choose(theme,surround){const menu=page.locator('#appearanceMenu');if(!await menu.evaluate(node=>node.open))await menu.locator('summary').click();await page.locator('#studioTheme').selectOption(theme);if(hasSurround&&surround!==null)await page.locator('#studioSurround').selectOption(surround);await menu.locator('summary').click();await page.waitForFunction(value=>document.documentElement.dataset.theme===value,theme);}
    for(const [theme,surround] of [['carbon','neutral'],['pearl','dark']]){await choose(theme,surround);assertScientificData((await saveProject(phase+'-theme-'+theme+'.json')).payload,baseline,phase+' '+theme+' preference');(report.themeChecks??=[]).push({phase,theme,completeProjectExact:true,historyExact:true,checkpointsExact:true,dataDraftsExact:true,editableStateExact:true});}
    await choose(initial,initialSurround);assertScientificData((await saveProject(phase+'-theme-restored.json')).payload,baseline,phase+' restored preference');
  }
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
    page.on('pageerror',error=>{(report.browserErrors??=[]).push(error.message);log('browser-error',{message:error.message});});
    page.on('request',request=>{if(new URL(request.url()).pathname==='/api/update-install')try{const payload=JSON.parse(request.postData()||'{}'),action=payload.action;if(Object.keys(payload).join(',')!=='action')report.commandViolation=true;if(action==='install'){report.installCommands++;if(report.installCommands!==1)report.commandViolation=true;}if(action==='download'){report.downloadCommands++;if(report.downloadCommands!==1)report.commandViolation=true;}log('updater-request',{action});}catch(error){report.commandViolation=true;log('request-inspection-error',{message:error.message});}});
    page.on('response',async response=>{if(new URL(response.url()).pathname!=='/api/update-install')return;try{
      const value=await response.json(),record={httpStatus:response.status(),status:value.status,received:value.received,total:value.total,error:value.error,errorStage:value.errorStage};log('updater-response',record);if(value.status){observed.add(value.status);backendObserved.add(value.status);}
      if(value.status==='downloading'&&Number.isFinite(value.received)){if(lastBytes!==null&&value.received<lastBytes){report.progressViolation=true;log('nonmonotonic-backend-progress',{previous:lastBytes,received:value.received});}lastBytes=value.received;}
    }catch{log('updater-response-unreadable',{httpStatus:response.status(),afterInstallClick:installClicked});}});
    page.on('requestfailed',request=>{if(new URL(request.url()).pathname==='/api/update-install')log('updater-transport-disconnected',{afterInstallClick:installClicked,reason:request.failure()?.errorText});});
    await page.goto(origin,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#save').waitFor({timeout:60000});
    report.before=await health(origin);assert.equal(report.before?.currentVersion,expectedBefore);assert.equal(report.before?.platform,'windows');
    report.guardBefore=Evidence.guardClient(evidenceConfig,expectedBefore);report.originalExecutableSHA256=await Evidence.fileHash(evidenceConfig.executable);const jobsBefore=Evidence.jobNames(evidenceConfig);settingsBefore=Evidence.settingsSnapshot(evidenceConfig);report.settingsBefore={bytes:settingsBefore.bytes.length,sha256:settingsBefore.sha256};
    if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();await page.locator('#language').selectOption('en');
    let inputPayload=null;
    if(process.env.STUDIO_REAL_UPDATE_PROJECT){const input=path.resolve(process.env.STUDIO_REAL_UPDATE_PROJECT),bytes=fs.readFileSync(input);inputPayload=JSON.parse(bytes);assert.ok(inputPayload.project&&inputPayload.state);await openProject(input,inputPayload);report.inputProjectSha256=hash(bytes);log('operator-project-opened',{sha256:hash(bytes),projectId:inputPayload.project.id});}
    const saved=await saveProject('project-before-update.json');report.savedProject={file:path.basename(saved.target),sha256:hash(saved.bytes),projectId:saved.payload.project.id};
    if(inputPayload)assertScientificData(saved.payload,inputPayload,'before installation');report.scientificTableSha256=hash(JSON.stringify(tables(saved.payload)));
    report.originalSVGSha256=hash(JSON.stringify(sourceSVG(saved.payload)));
    report.corePayloadBeforeSha256=hash(JSON.stringify(Evidence.corePayload(saved.payload)));await verifyThemePreservation('before-update',saved.payload);report.appearanceBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('figure-studio:appearance:v1')||'null'));report.settingsBeforeInstall=Evidence.assertSettingsUnchanged(evidenceConfig,settingsBefore);
    await page.waitForFunction(async id=>{const value=await StudioLibrary.get('autosaves',id);return value?.payload?.project?.id===id&&localStorage.getItem('figure-studio:desktop-last-project')===id;},saved.payload.project.id,{timeout:30000});
    assertScientificData(await page.evaluate(async id=>(await StudioLibrary.get('autosaves',id)).payload,saved.payload.project.id),saved.payload,'completed IndexedDB autosave');report.autosaveEstablishedBeforeUpdate=true;
    statusToken=await page.evaluate(()=>JSON.parse(document.getElementById('local-engine').textContent).token);
    page.on('response',async response=>{if(new URL(response.url()).pathname==='/api/updates')try{const value=await response.json();if(value.status==='update-available')releaseOffer=value;}catch{}});
    await page.locator('#studioCheckUpdates').click();await page.locator('.update-download').waitFor({state:'visible',timeout:60000});
    const latest=await page.locator('.update-versions dd').last().innerText();assert.equal(latest,expectedAfter,'stop if the real release offer differs from the intended target');
    assert.equal(await page.locator('.update-download').innerText(),'Download and prepare update','installed capability must be available');
    await page.screenshot({path:path.join(out,'before-real-download.png')});sampleTimer=setInterval(()=>sample(),100);statusTimer=setInterval(statusProbe,100);report.passiveStatusObserver={intervalMs:100,readOnlyAuthenticatedAction:'status',drivesUI:false};checkDialogs();await page.locator('.update-download').click();log('user-started-real-download');
    const downloadDeadline=Date.now()+(Number(process.env.STUDIO_REAL_UPDATE_DOWNLOAD_TIMEOUT_MS)||600000);let ready=false;
    while(Date.now()<downloadDeadline){checkDialogs();await sample();if(await page.locator('#studioInstallUpdate').isVisible()){ready=true;break;}if(await page.locator('.update-error').isVisible())throw Error('The real updater reported an error before ready: '+await page.locator('.update-error').innerText());await delay(500);}
    assert.ok(ready,'the real updater did not confirm ready before the download deadline');await sample();await statusProbe();assert.ok(backendObserved.has('ready'),'the ready UI must correspond to an actually observed backend ready response');assert.ok(!report.progressViolation,'real backend progress regressed within this download');
    job=Evidence.newJob(evidenceConfig,jobsBefore);assert.ok(job,'This single explicit download must create one new isolated job');assert.ok(releaseOffer,'A fresh actual official release offer must be captured');report.verifiedDownloadedPackage=await Evidence.verifiedDownload(job,expectedAfter,releaseOffer);
    beforeFiles=await Evidence.inventory(evidenceConfig.target);report.originalProgramInventorySha256=hash(JSON.stringify(beforeFiles));report.guardBeforeInstall=Evidence.guardClient(evidenceConfig,expectedBefore);checkDialogs();assert.equal(report.downloadCommands,1);
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
    clearInterval(sampleTimer);sampleTimer=null;clearInterval(statusTimer);statusTimer=null;statusToken=null;
    report.guardAfter=Evidence.guardClient(evidenceConfig,expectedAfter);for(const entry of report.guardBefore.protected)assert.ok(report.guardAfter.protected.some(after=>after.pid===entry.pid&&after.path===entry.path&&after.created===entry.created),'Protected user process must remain unchanged');
    report.completionEvidence=await Evidence.verifyCompletion(evidenceConfig,job,expectedAfter,beforeFiles);if(!report.completionEvidence.auditAvailable)report.limitations.push('The official older updater/helper has no new audit journal. Its actual helper-ready, installed result and complete rollback hashes establish the safety chain; this run does not cover the newer audit implementation.');
    await page.goto(reopen,{waitUntil:'domcontentloaded',timeout:60000});await page.locator('#artboard > svg').waitFor({timeout:60000});if(await page.locator('#dismissProjectStart').isVisible())await page.locator('#dismissProjectStart').click();
    const first=await saveProject('project-after-reopen.json');report.automaticProjectRestore=isDeepStrictEqual(Evidence.corePayload(first.payload),Evidence.corePayload(saved.payload));
    assert.ok(report.automaticProjectRestore,'Automatic project restoration failed. Strict update acceptance cannot be rescued by an explicit Open; use the separate postverify harness to test saved-file readability.');assertScientificData(first.payload,saved.payload,'after automatic restoration');
    const appearanceAfter=await page.evaluate(()=>JSON.parse(localStorage.getItem('figure-studio:appearance:v1')||'null'));assert.ok(isDeepStrictEqual(appearanceAfter,report.appearanceBefore),'Device appearance preference must survive the actual update');report.appearancePreferencePreserved=true;await verifyThemePreservation('after-update',saved.payload);report.settingsAfterUpdate=Evidence.assertSettingsUnchanged(evidenceConfig,settingsBefore);report.corePayloadAfterSha256=hash(JSON.stringify(Evidence.corePayload(first.payload)));report.completeCorePayloadPreserved=true;
    await page.screenshot({path:path.join(out,'real-updated-editor.png')});checkDialogs();assert.equal(report.downloadCommands,1);assert.equal(report.installCommands,1);report.passed=true;log('real-browser-acceptance-complete',{version:after.currentVersion,automaticProjectRestore:report.automaticProjectRestore});
  }catch(error){report.failure=error.message;log('acceptance-stopped',{reason:error.message,installClicked,installCommands:report.installCommands});throw error;}
  finally{
    clearInterval(sampleTimer);clearInterval(statusTimer);statusToken=null;report.observedStages=[...observed];report.uiObservedStages=[...uiObserved];report.backendObservedStages=[...backendObserved];report.unobservedStages=['checking','downloading','verifying','ready','preparing','installing'].filter(state=>!uiObserved.has(state));if(report.unobservedStages.length)report.limitations.push('Stages not observed in the UI are not reconstructed or inserted into the recording. Passive HTTP status and optional audit events are separate evidence.');
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
