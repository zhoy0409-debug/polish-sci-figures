'use strict';
/* Installed-service acceptance only. No HTML fulfillment, bridge injection,
 * download/install command, native process control or release mutation. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const H=require('./test_studio_carbon_helpers.cjs');
const loopback=new Set(['127.0.0.1','localhost','[::1]']);
function argumentsForRun(){
  const allowed=new Set(['url','html','expected-html-sha','expected-version','expected-in-app-install','out']),args={};
  for(const value of process.argv.slice(2)){
    const match=/^--([^=]+)=(.+)$/.exec(value);
    assert.ok(match&&allowed.has(match[1]),'Use only explicit --url= --html= --expected-html-sha= --expected-version= --expected-in-app-install= --out= arguments.');
    assert.equal(args[match[1]],undefined,'Duplicate argument: '+match[1]);args[match[1]]=match[2];
  }
  for(const name of allowed)assert.ok(args[name],'Required --'+name+'= argument missing.');
  assert.ok(['true','false'].includes(args['expected-in-app-install']),'--expected-in-app-install must be exactly true or false.');
  assert.ok(path.isAbsolute(args.out),'--out must be an absolute fresh directory.');
  const out=path.resolve(args.out);assert.equal(fs.existsSync(out),false,'Never overwrite acceptance evidence.');
  fs.mkdirSync(out,{recursive:true});return {args,out};
}
function localAddress(value){
  const address=new URL(value);assert.equal(address.protocol,'http:');assert.ok(loopback.has(address.hostname),'Installed service must use loopback.');
  assert.equal(address.username+address.password+address.search+address.hash,'');assert.ok(address.port,'An explicit installed-service port is required.');return address;
}
function counts(payload){return {observations:payload.project.panels[0].table.rows.length-1,svgSources:payload.project.panels[0].variants.length,historyStates:payload.history?.states?.length??null,historyIndex:payload.history?.index??null,checkpoints:Array.isArray(payload.checkpoints)?payload.checkpoints.length:Object.keys(payload.checkpoints||{}).length,dataDrafts:Object.keys(payload.dataDrafts||{}).length};}
function sameCore(actual,expected,{history=true,state=true}={}){
  for(const key of ['project',...(state?['state']:[]),...(history?['history']:[]),'checkpoints','dataDrafts'])assert.deepEqual(actual[key],expected[key],key+' must remain completely equal.');
}
async function main(){
  const {args,out}=argumentsForRun(),reportFile=path.join(out,'installed-minimal-result.json');
  const report={schema:'figure-studio-installed-minimal-companions/1',kind:'actual_installed_loopback_service',passed:false,startedAt:new Date().toISOString(),harnessSha256:H.sha(fs.readFileSync(__filename)),checks:[],screens:[],network:{externalRequests:[],forbiddenUpdateActions:[],observedUpdateActions:[]},pageErrors:[],unexpectedDialogs:[],realUpdateDownload:false,realUpdateInstallation:false,htmlFulfillmentUsed:false,bridgeInjected:false,limitations:['Chrome uses an isolated headless context against an already installed local service; this harness does not install or start the native application.','Update metadata and status use the actual local service. Its server may contact the official metadata service; browser HTTP requests remain local.','No newer-than-'+args['expected-version']+' update is downloaded or installed. This is installed UI/data acceptance, not an actual update handoff.','The public Iris project is one real-data regression fixture. No native IME, image-detector accuracy, full-editor performance or all-workflows claim.']};
  let browser,context,page,video,cdp,onDocumentResponse,runError,openingProject=false;
  try{
    const address=localAddress(args.url);assert.match(args['expected-version'],/^\d+\.\d+\.\d+$/,'Supply the explicit installed Studio version for this acceptance.');
    assert.match(args['expected-html-sha'],/^[a-fA-F0-9]{64}$/);const expectedSha=args['expected-html-sha'].toLowerCase();
    assert.ok(path.isAbsolute(args.html),'--html must name the actual served HTML capture by absolute path.');
    const htmlFile=fs.realpathSync(args.html),htmlBytes=fs.readFileSync(htmlFile);assert.equal(H.sha(htmlBytes),expectedSha,'Provided HTML bytes differ from the reviewed expected hash.');
    const initialResponse=await fetch(address.href,{redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(initialResponse.status,200);assert.equal(initialResponse.url,address.href);
    const initialBytes=Buffer.from(await initialResponse.arrayBuffer());assert.equal(H.sha(initialBytes),expectedSha,'Actual installed HTTP response differs from reviewed HTML.');
    report.htmlIdentity={expectedSha256:expectedSha,localCaptureSha256:H.sha(htmlBytes),directInstalledResponseSha256:H.sha(initialBytes),bytes:initialBytes.length,loopbackOrigin:address.origin};
    const {chromium}=require('playwright');browser=await chromium.launch({channel:'chrome',headless:true});report.browserVersion=browser.version();
    context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true,recordVideo:{dir:path.join(out,'video'),size:{width:1440,height:900}}});
    // This boundary never fulfills, rewrites or mocks a response. Only the
    // actual installed loopback service and its local engine are permitted.
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(['http:','https:'].includes(url.protocol)&&(!loopback.has(url.hostname)||url.protocol!=='http:')){report.network.externalRequests.push({method:request.method(),origin:url.origin,path:url.pathname});return route.abort('blockedbyclient');}
      if(url.pathname==='/api/update-install'){
        let action;try{action=JSON.parse(request.postData()||'{}').action;}catch{}
        report.network.observedUpdateActions.push(action??'missing');
        if(action!=='status'){report.network.forbiddenUpdateActions.push(action??'missing');return route.abort('blockedbyclient');}
      }
      return route.continue();
    });
    page=await context.newPage();video=page.video();page.on('pageerror',error=>report.pageErrors.push(error.message));
    const openMessages=new Set(['打开工程将替换当前工作区。若当前修改尚未下载，请先取消并保存工程。','Opening a project replaces the current workspace. If your edits have not been downloaded, cancel and save the project first.']);
    page.on('dialog',async dialog=>{
      if(openingProject&&dialog.type()==='confirm'&&openMessages.has(dialog.message()))await dialog.accept();
      else{report.unexpectedDialogs.push({type:dialog.type(),messageSha256:H.sha(dialog.message())});await dialog.dismiss();}
    });
    // The production editor embeds scientific assets and exceeds Chrome's
    // default per-resource inspector cache. Pin this actual main-document
    // request in an independent CDP session with explicit, bounded buffers.
    const mib=1024*1024,resourceBuffer=htmlBytes.length*2+8*mib;
    assert.ok(Number.isSafeInteger(resourceBuffer)&&resourceBuffer<=128*mib,'Reviewed HTML exceeds the bounded 128 MiB per-resource evidence buffer.');
    const totalBuffer=Math.min(256*mib,resourceBuffer*2);
    cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable',{maxTotalBufferSize:totalBuffer,maxResourceBufferSize:resourceBuffer});
    const mainFrameId=(await cdp.send('Page.getFrameTree')).frameTree.frame.id,documentResponses=[];
    onDocumentResponse=event=>{if(event.type==='Document'&&event.response.url===address.href&&event.frameId===mainFrameId)documentResponses.push({requestId:event.requestId,status:event.response.status,url:event.response.url,frameId:event.frameId});};
    cdp.on('Network.responseReceived',onDocumentResponse);
    const navigation=await page.goto(address.href,{waitUntil:'load',timeout:60000});assert.ok(navigation);assert.equal(navigation.status(),200);assert.equal(navigation.url(),address.href);
    assert.equal(documentResponses.length,1,'Exactly one real main-document response must match the reviewed installed URL.');
    const documentResponse=documentResponses[0];assert.equal(documentResponse.status,200);
    const browserBody=await cdp.send('Network.getResponseBody',{requestId:documentResponse.requestId});
    const browserBytes=Buffer.from(browserBody.body,browserBody.base64Encoded?'base64':'utf8');
    assert.equal(H.sha(browserBytes),expectedSha,'Browser must render the exact installed-server HTML, without fulfillment or a substitute fetch.');
    report.htmlIdentity.browserNavigationSha256=H.sha(browserBytes);
    report.htmlIdentity.browserNavigationEvidence={method:'Independent CDP Network.getResponseBody for the exact main-frame Document request',requestId:documentResponse.requestId,bytes:browserBytes.length,base64Encoded:browserBody.base64Encoded,maxResourceBufferSize:resourceBuffer,maxTotalBufferSize:totalBuffer};
    const servedInfo=await page.locator('#local-engine').evaluate(node=>{const info=JSON.parse(node.textContent).updateInfo;return {currentVersion:info.currentVersion,suiteVersion:info.suiteVersion,platform:info.platform,architecture:info.architecture,inAppInstall:info.inAppInstall};});
    assert.equal(servedInfo.currentVersion,args['expected-version']);assert.equal(servedInfo.platform,'windows');assert.equal(servedInfo.inAppInstall,args['expected-in-app-install']==='true','Installed updater capability must match the explicitly reviewed service identity.');report.installedServiceIdentity=servedInfo;
    await page.locator('#language').selectOption('en');await H.dismiss(page);
    const fixture=H.publicIris();report.publicFixture={name:'UCI Iris',doi:'10.24432/C56C76',inputPayloadSha256:H.sha(JSON.stringify(fixture))};
    // Independent expectation for this bound legacy fixture, established from
    // the input and the documented import contract, never from an actual Save.
    // openProjectFile -> migrateLabelHistory migrates missing labelNumbering;
    // panelNumberStyle returns upper when the original states have no labels.
    for(const legacy of [fixture.project.initialState,fixture.state]){
      assert.equal(Object.hasOwn(legacy,'labelNumbering'),false,'The bound legacy Iris input must lack the numbering field.');
      assert.ok(legacy.order.every(id=>!legacy.panels[id].label),'This narrow migration expectation requires the original no-label Iris states.');
    }
    const expectedProject=JSON.parse(JSON.stringify(fixture.project)),expectedState=JSON.parse(JSON.stringify(fixture.state));
    expectedProject.initialState.labelNumbering='upper';expectedState.labelNumbering='upper';
    report.importMigrationEvidence={
      sourceProjectSha256:H.sha(JSON.stringify(fixture.project)),expectedCanonicalProjectSha256:H.sha(JSON.stringify(expectedProject)),
      sourceStateSha256:H.sha(JSON.stringify(fixture.state)),expectedCanonicalStateSha256:H.sha(JSON.stringify(expectedState)),
      definedDefaults:[{path:'project.initialState.labelNumbering',from:'absent',to:'upper'},{path:'state.labelNumbering',from:'absent',to:'upper'}],
      contract:{source:'skills/polish-sci-figures/assets/figure-studio/studio.js',sha256:H.sha(fs.readFileSync(path.join(H.ROOT,'skills/polish-sci-figures/assets/figure-studio/studio.js'))),functions:['openProjectFile','migrateLabelHistory','migratePanelLabels','panelNumberStyle']},
      derivedFromActualSave:false,scientificPanelChangesAllowed:false
    };
    async function load(payload,name){openingProject=true;try{await H.loadProject(page,payload,name);}finally{openingProject=false;}}
    async function save(name){const payload=await H.save(page);fs.writeFileSync(path.join(out,name),JSON.stringify(payload));return payload;}
    async function shot(name){await page.screenshot({path:path.join(out,name)});const bytes=fs.readFileSync(path.join(out,name));report.screens.push({file:name,bytes:bytes.length,sha256:H.sha(bytes)});}
    async function theme(value){await page.locator('#appearanceMenu summary').click();await page.locator('#studioTheme').selectOption(value);await page.locator('#appearanceMenu summary').click();assert.equal(await page.locator('html').getAttribute('data-theme'),value);}
    await load(fixture,'PUBLIC-Iris-installed-'+args['expected-version']+'.json');await page.waitForFunction(()=>document.getElementById('projectTitle').textContent.includes('Iris'));
    const before=await save('project-before-update-dialog.json');assert.equal(counts(before).observations,150);assert.equal(counts(before).svgSources,12);assert.deepEqual(before.project,expectedProject,'Complete project must equal the independently canonicalized input, including every original observation, source SVG, recipe and analysis.');assert.deepEqual(before.state,expectedState,'Only the defined missing numbering default may migrate the original current state.');
    for(let i=0;i<fixture.project.panels.length;i++)for(const key of ['table','variants','recipe','analysis'])assert.deepEqual(before.project.panels[i][key],fixture.project.panels[i][key],'Original scientific panel '+i+' '+key+' must remain completely exact.');
    report.beforeCounts=counts(before);report.importMigrationEvidence.completeProjectAndStateMatchIndependentExpected=true;report.importMigrationEvidence.allOriginalTablesVariantsRecipesAnalysesExact=true;
    await theme('carbon');await page.locator('#studioCheckUpdates').click();await page.locator('.mascot-dog').waitFor({state:'visible'});await page.waitForFunction(()=>!document.getElementById('studioRetryUpdateCheck').disabled,{},{timeout:45000});
    assert.equal(await page.locator('.update-mascot-art').getAttribute('viewBox'),'0 0 500 128');assert.equal(await page.locator('.mascot-cat').count(),1);assert.equal(await page.locator('.mascot-dog').count(),1);assert.equal(await page.locator('.mascot-dog-ear').count(),2);
    assert.equal(await page.locator('.update-mascot-art image,.update-mascot-art linearGradient,.update-mascot-art radialGradient,.mascot-paw-work,.mascot-paw-greet').count(),0);
    assert.equal(await page.locator('.update-heart').count(),10);assert.equal(await page.locator('.update-heart-row').getAttribute('aria-hidden'),'true');
    assert.equal(await page.locator('.mascot-track').evaluate(node=>getComputedStyle(node).display),'none');
    report.installedHeartUi={hearts:10,decorative:true,mode:await page.locator('.update-progress-scene').getAttribute('data-heart-progress'),levels:await page.locator('.update-heart').evaluateAll(nodes=>nodes.map(node=>Number(node.dataset.level)))};
    if(report.installedHeartUi.mode!=='known')assert.deepEqual(report.installedHeartUi.levels,Array(10).fill(0),'An actual idle/current/unsupported status cannot invent a filled download.');
    report.actualUpdateUi={summary:await page.locator('.update-summary').innerText(),state:await page.locator('.update-progress-scene').getAttribute('data-state'),caption:await page.locator('.update-progress-caption').innerText()};await shot('installed-carbon-update.png');
    await page.locator('#studioUpdateMotion').check();await page.waitForFunction(()=>document.querySelector('.update-progress-scene').dataset.animation==='on');
    // Current/ready greetings complete once. Pointer feedback is then measured
    // independently of that genuine, finite animation.
    await page.waitForTimeout(1000);
    async function pose(animal){return page.evaluate(name=>{const values=selector=>[...document.querySelectorAll(selector)].map(node=>{const s=getComputedStyle(node);return {translate:s.translate,transform:s.transform};});return {eyes:values('.mascot-'+name+'-eyes'),hop:values('.mascot-'+name+'-hop')};},animal);}
    report.pointerCases=[];
    for(const enabled of [true,false]){
      await page.locator('#studioUpdateMotion').setChecked(enabled);
      assert.equal(await page.locator('.update-progress-scene').getAttribute('data-animation'),enabled?'on':'off');
      for(const animal of ['cat','dog']){
        await page.mouse.move(1,1);await page.waitForTimeout(240);const rest=await pose(animal),box=await page.locator('.mascot-'+animal+'-head').boundingBox();assert.ok(box);
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(240);assert.equal(await page.locator('.mascot-'+animal).evaluate(node=>node.matches(':hover')),true);const hover=await pose(animal);
        if(enabled)assert.notDeepEqual(hover.eyes.map(p=>p.translate),rest.eyes.map(p=>p.translate));else assert.deepEqual(hover,rest);
        await page.mouse.down();let pressed;try{await page.waitForTimeout(240);pressed=await pose(animal);if(enabled)assert.notDeepEqual(pressed.hop,hover.hop);else assert.deepEqual(pressed,hover);}finally{await page.mouse.up();}
        await page.waitForTimeout(240);assert.deepEqual((await pose(animal)).hop,hover.hop);report.pointerCases.push({animal,motionEnabled:enabled,hover:true,press:true,release:true});
      }
    }
    await page.mouse.move(1,1);assert.equal(await page.locator('.update-progress-scene').evaluate(node=>node.getAnimations({subtree:true}).length),0);await shot('installed-motion-off.png');
    await page.locator('#studioCloseUpdate').click();assert.equal(await page.locator('.update-progress-scene').getAttribute('data-animation'),'off');
    const afterDialog=await save('project-after-update-dialog.json');assert.deepEqual(afterDialog,before,'Decorative interaction must preserve the entire saved payload.');sameCore(afterDialog,before);report.checks.push('Actual registered installed service, exact served HTML and version; real update entry; cat/dog pointer and motion-off; full saved payload unchanged.');
    const exports=[];
    for(const value of ['carbon','pearl']){
      await theme(value);await page.locator('#studioCheckUpdates').click();await page.locator('.mascot-dog').waitFor({state:'visible'});await shot('installed-'+value+'-theme-update.png');await page.locator('#studioCloseUpdate').click();
      const svg=await H.exportBytes(page,'export'),png=await H.exportBytes(page,'png');assert.doesNotMatch(svg.toString('utf8'),/mascot-|update-mascot-art/);assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      fs.writeFileSync(path.join(out,value+'-scientific.svg'),svg);fs.writeFileSync(path.join(out,value+'-scientific.png'),png);
      const pixels=await page.evaluate(async bytes=>{const bitmap=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data,digest=await crypto.subtle.digest('SHA-256',data);return {width:bitmap.width,height:bitmap.height,rgbaSha256:[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('')};}finally{bitmap.close();}},[...png]);
      exports.push({theme:value,svgSha256:H.sha(svg),canonicalSvgSha256:H.sha(H.canonicalSvg(svg)),pngSha256:H.sha(png),pixels});sameCore(await save('project-after-'+value+'-export.json'),before);
    }
    assert.equal(exports[0].canonicalSvgSha256,exports[1].canonicalSvgSha256);assert.deepEqual(exports[0].pixels,exports[1].pixels);report.exports=exports;report.checks.push('Carbon/Pearl canonical scientific SVG and exact PNG pixel equality; source project, state, history, checkpoints and drafts retained.');
    const text=page.locator('#artboard text[data-key]').filter({hasText:/^X$/}).first();assert.equal(await text.count(),1);const textKey=await text.getAttribute('data-key');assert.match(textKey,/^[A-Za-z0-9_.:-]+$/);
    await text.click();await page.keyboard.press('F2');const field=page.locator('.canvas-text-editor');await field.waitFor({state:'visible'});await field.fill('X installed QA');await field.press('Enter');await field.waitFor({state:'hidden'});
    const edited=await save('project-after-real-text-edit.json');sameCore(edited,before,{state:false,history:false});assert.notDeepEqual(edited.state,before.state);assert.equal(edited.history.index,before.history.index+1);assert.match(await page.locator('#artboard [data-key="'+textKey+'"]').first().textContent(),/X installed QA/);
    await page.locator('#undo').click();const undone=await save('project-after-undo.json');sameCore(undone,before,{history:false});assert.equal(undone.history.index,before.history.index);report.textEdit={actualCanvasF2:true,oneHistoryCommit:true,undoRestoredCompleteState:true,originalProjectUnchanged:true,historyAfterUndoRetainsLegitimateRedoTail:true,undoCounts:counts(undone)};
    await load(undone,'PUBLIC-Iris-installed-undo-roundtrip.json');const reopened=await save('project-after-undo-reopen.json');assert.deepEqual(reopened,undone,'Real Open/Save must preserve the complete restored project and history including redo.');await shot('installed-restored-public-iris.png');
    report.checks.push('Actual F2 text edit, one undo commit, complete state restoration and saved-project Open/Save round trip.');report.finalCounts=counts(reopened);
    assert.deepEqual(report.network.externalRequests,[]);assert.deepEqual(report.network.forbiddenUpdateActions,[]);assert.deepEqual(report.pageErrors,[]);assert.deepEqual(report.unexpectedDialogs,[]);
    assert.equal(H.sha(fs.readFileSync(htmlFile)),expectedSha,'Reviewed local HTML capture must remain unchanged.');report.completeScientificAndEditablePayloadPreserved=true;report.passed=true;
  }catch(error){runError=error;report.passed=false;report.failure={name:error.name,message:error.message,stack:error.stack};
  }finally{
    const cleanupErrors=[];let contextClosed=false,browserClosed=false;
    try{if(cdp){if(onDocumentResponse)cdp.off('Network.responseReceived',onDocumentResponse);await cdp.detach();}}catch(error){cleanupErrors.push({resource:'cdp',message:error.message});}
    try{if(context){await context.close();contextClosed=true;}}catch(error){cleanupErrors.push({resource:'context',message:error.message});}
    try{if(browser){await browser.close();browserClosed=true;}}catch(error){cleanupErrors.push({resource:'browser',message:error.message});}
    try{if(video){if(!contextClosed&&!browserClosed)throw Error('Video cannot finalize while both context and browser failed to close.');const file=await video.path(),bytes=fs.readFileSync(file);report.originalRecording={file:path.relative(out,file).replaceAll('\\','/'),bytes:bytes.length,sha256:H.sha(bytes),unedited:true};}}catch(error){cleanupErrors.push({resource:'recording',message:error.message});}
    if(cleanupErrors.length){report.cleanupErrors=cleanupErrors;report.passed=false;}report.finishedAt=new Date().toISOString();fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
  }
  if(runError)throw runError;if(!report.passed)throw Error('Installed acceptance cleanup failed.');console.log(JSON.stringify({passed:true,kind:report.kind,version:report.installedServiceIdentity.currentVersion,out}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
