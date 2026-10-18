'use strict';
// Real Chrome rendering, explicitly controlled transport. This is not updater
// download/installation acceptance and cannot attest to installation success.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=path.resolve(__dirname,'../skills/polish-sci-figures/assets/figure-studio'),proof=path.resolve(process.env.STUDIO_SCENE_PROOF||'.cache/carbon-update-scene-fixture');fs.mkdirSync(proof,{recursive:true});
const asset=name=>fs.readFileSync(path.join(base,name),'utf8');
(async()=>{
  if(fs.existsSync(path.join(proof,'scene-browser-result.json')))throw Error('Use a fresh STUDIO_SCENE_PROOF directory; previous browser evidence must be retained.');
  let browser,context,page,video,runError;
  const remote=[],errors=[];
  const report={kind:'controlled_transport_fixture',realBrowser:'Chrome',browserVersion:null,realDownload:false,realInstaller:false,limitations:['State responses are controlled component fixtures, not an actual installer run.','125% and 150% use an effective CSS viewport plus emulated device pixel ratio, not Windows system display scaling.','Hidden-document handling is exercised with an explicitly controlled visibilityState event; no user browser or Windows desktop is operated.'],states:[],checks:[]};
  try{
    const {chromium}=require('playwright');
    browser=await chromium.launch({headless:true,channel:'chrome'});report.browserVersion=browser.version();
    context=await browser.newContext({viewport:{width:960,height:900},deviceScaleFactor:1,recordVideo:{dir:path.join(proof,'recordings'),size:{width:960,height:900}}});page=await context.newPage();video=page.video();
    page.on('request',request=>{if(!request.url().startsWith('data:')&&!request.url().startsWith('about:'))remote.push(request.url());});page.on('pageerror',error=>errors.push(error.message));
    await page.setContent('<!doctype html><html data-theme="carbon"><head></head><body style="margin:0;background:var(--fs-app-bg);color:var(--fs-text-primary);font:12px Arial"><p style="margin:10px">CONTROLLED TRANSPORT FIXTURE · No download · No installer</p><header></header><template id="studioUpdateMascotTemplate">'+asset('mascot-scene.svg')+'</template></body></html>');
    await page.addStyleTag({content:asset('theme-tokens.css')});await page.addStyleTag({content:asset('update-scene.css')});await page.addScriptTag({path:path.join(base,'update-scene.js')});await page.addScriptTag({path:path.join(base,'update-check.js')});
    await page.evaluate(()=>{
      window.fixtureFirstShownStart=performance.now();
      window.fixtureNext={status:'idle',supported:true};window.fixtureReject=false;window.fixtureCalls=[];
      const info={currentVersion:'0.1.20',platform:'windows',architecture:'x86_64',channel:'stable',inAppInstall:true};
      window.fixtureUI=StudioUpdateCheck.create({document,container:document.querySelector('header'),language:()=> 'en',info,installPollMs:100000,check:async()=>({...info,status:'update-available',latestVersion:'0.1.21',downloadUrl:'https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.21/polish-sci-figures-Studio-0.1.21-Setup-x64.exe'}),installUpdate:async action=>{window.fixtureCalls.push(action);if(window.fixtureReject)throw Error('Controlled transport loss');return window.fixtureNext;}});
      const disclosure=document.createElement('p');disclosure.textContent='CONTROLLED TRANSPORT FIXTURE · NO DOWNLOAD / INSTALLER';disclosure.style.cssText='font:10px/1.4 Arial;letter-spacing:.04em;color:#c1ccd8;margin:0 0 12px';window.fixtureUI.dialog.prepend(disclosure);
    });
    const set=async(value,reject=false)=>{await page.evaluate(({value,reject})=>{window.fixtureNext=value;window.fixtureReject=reject;const started=performance.now();window.fixtureUI.open();if(window.fixtureDoubleRafMs===undefined)requestAnimationFrame(()=>requestAnimationFrame(()=>{window.fixtureDoubleRafMs=performance.now()-started;}));},{value:{supported:true,...value},reject});await page.waitForFunction(()=>!document.querySelector('#studioRetryUpdateCheck').disabled||document.querySelector('.update-progress-scene').dataset.state!=='idle');await page.waitForTimeout(45);};
    const capture=async name=>{await page.waitForTimeout(180);await page.screenshot({path:path.join(proof,name+'.png')});if(['rest-main','rest-pearl','download-52','verified-ready'].includes(name))await page.locator('.update-progress-scene').screenshot({path:path.join(proof,name+'-scene.png')});report.states.push({name,state:await page.locator('.update-progress-scene').getAttribute('data-state'),animation:await page.locator('.update-progress-scene').getAttribute('data-animation'),caption:await page.locator('.update-progress-caption').innerText()});};
    await set({status:'idle'});await capture('rest-main');
    assert.equal(await page.locator('.mascot-paw-work,.mascot-paw-greet,linearGradient,radialGradient,filter').count(),0,'no leftover detailed-pose placeholders or shaded character rendering');
    const pose=()=>page.evaluate(()=>Object.fromEntries(['.mascot-cat-eyes','.mascot-dog-eyes','.mascot-cat-hop','.mascot-dog-hop'].map(selector=>[selector,[...document.querySelectorAll(selector)].map(node=>{const s=getComputedStyle(node);return {translate:s.translate,transform:s.transform,scale:s.scale};})])));
    const progressSnapshot=()=>page.evaluate(()=>({state:document.querySelector('.update-progress-scene').dataset.state,ratio:document.querySelector('.update-progress-scene').style.getPropertyValue('--update-progress'),progress:document.querySelector('progress').getAttribute('value'),caption:document.querySelector('.update-progress-caption').textContent,calls:[...window.fixtureCalls]}));
    const pointer=async(enabled,label,animal)=>{
      const scene=await page.locator('.mascot-'+animal+'-head').boundingBox();assert.ok(scene);const eyes='.mascot-'+animal+'-eyes',hop='.mascot-'+animal+'-hop';
      await page.mouse.move(1,1);await page.waitForTimeout(240);const rest=await pose(),protocol=await progressSnapshot();
      await page.mouse.move(scene.x+scene.width*.5,scene.y+scene.height*.5);await page.waitForTimeout(240);const hover=await pose();
      assert.equal(await page.locator('.mascot-'+animal).evaluate(node=>node.matches(':hover')),true,'the real pointer must hit the intended '+animal);
      if(enabled)assert.notDeepEqual(hover[eyes].map(value=>value.translate),rest[eyes].map(value=>value.translate),'hover changes the '+animal+' eye translate');else assert.deepEqual(hover,rest,'motion off must also suppress hover transforms');
      await page.mouse.down();try{await page.waitForTimeout(240);const active=await pose();if(enabled)assert.notDeepEqual(active[hop],hover[hop],'press lifts the '+animal);else assert.deepEqual(active,hover,'motion off must suppress press transforms');await capture('pointer-'+label+'-'+animal);}finally{await page.mouse.up();}
      await page.waitForTimeout(240);const released=await pose();assert.deepEqual(released['.mascot-cat-hop'],hover['.mascot-cat-hop']);assert.deepEqual(released['.mascot-dog-hop'],hover['.mascot-dog-hop']);assert.deepEqual(await progressSnapshot(),protocol,'decorative pointer feedback cannot alter updater state, bytes, captions or transport calls');
      await page.mouse.move(1,1);report.checks.push({pointerCase:label,animal,pointerFeedbackEnabled:enabled,hover,pressReleased:true,progressAndTransportUnchanged:true});
    };
    await page.waitForFunction(()=>document.querySelector('.update-progress-scene').dataset.animation==='on');for(const animal of ['cat','dog'])await pointer(true,'pressed',animal);
    await page.locator('#studioUpdateMotion').uncheck();for(const animal of ['cat','dog'])await pointer(false,'manual-off',animal);await page.locator('#studioUpdateMotion').check();
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('.update-progress-scene').dataset.animation==='off');for(const animal of ['cat','dog'])await pointer(false,'reduced-motion',animal);await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('.update-progress-scene').getAttribute('data-animation'),'off');assert.equal(await page.locator('.update-progress-scene').evaluate(node=>node.getAnimations({subtree:true}).length),0);report.checks.push('controlled hidden-document event removes all scene animations');
    await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(()=>document.querySelector('.update-progress-scene').dataset.animation==='on');
    await page.evaluate(()=>document.documentElement.dataset.theme='pearl');await capture('rest-pearl');await page.evaluate(()=>document.documentElement.dataset.theme='carbon');
    for(const received of [0,13,52,99,100]){
      await set({status:'downloading',received:received*10000,total:1000000});assert.equal(await page.locator('.update-progress-percent').innerText(),received+'%');assert.equal(await page.locator('#studioInstallUpdate').isVisible(),false);await capture('download-'+received);
      if(received===0)report.fixtureDoubleRafVisibleMs=await page.evaluate(()=>window.fixtureDoubleRafMs);
    }
    await page.bringToFront();await page.setViewportSize({width:960,height:250});await page.evaluate(()=>{const d=document.querySelector('#studioUpdateDialog');d.querySelector('details').open=true;d.scrollTop=d.scrollHeight;});await page.waitForFunction(()=>document.querySelector('.update-progress-scene').dataset.animation==='off',null,{timeout:3000});assert.equal(await page.locator('.update-progress-scene').evaluate(node=>node.getAnimations({subtree:true}).length),0);report.checks.push('scrolling the illustration out of view pauses its animation through IntersectionObserver');
    await page.setViewportSize({width:960,height:900});await page.evaluate(()=>{const d=document.querySelector('#studioUpdateDialog');d.querySelector('details').open=false;d.scrollTop=0;});await page.waitForTimeout(80);
    assert.equal(await page.locator('.update-progress-scene').getAttribute('data-state'),'verifying');assert.equal(await page.locator('.mascot-inspect').isVisible(),true);
    await set({status:'ready'});assert.equal(await page.locator('#studioInstallUpdate').isVisible(),true);assert.equal(await page.locator('#studioInstallUpdate').isDisabled(),true);await capture('verified-ready');
    await page.locator('#studioUpdateSaved').check();assert.equal(await page.locator('#studioInstallUpdate').isEnabled(),true);await page.locator('#studioUpdateSaved').uncheck();assert.equal(await page.locator('#studioInstallUpdate').isDisabled(),true);report.checks.push('100% of controlled bytes is still verifying; only ready plus explicit saved-project confirmation enables installation');
    await set({status:'preparing'});await capture('backup-preparing');
    await set({status:'preparing'},true);assert.equal(await page.locator('.update-progress-scene').getAttribute('data-state'),'paused');assert.equal(await page.locator('.update-error').isVisible(),false);await capture('connection-lost');
    await set({status:'error',error:'prepare-failed',errorStage:'backup-program'});assert.equal(await page.locator('.update-progress-scene').getAttribute('data-state'),'error');await capture('backend-error');
    // Start a new download through its visible user control; this resets the epoch.
    await page.evaluate(()=>{window.fixtureNext={supported:true,status:'downloading',received:520000,total:0};});await page.locator('.update-download').click();await page.waitForTimeout(45);assert.equal(await page.locator('.update-progress-percent').isVisible(),false);assert.equal(await page.locator('progress').getAttribute('value'),null);await capture('unknown-total');
    await page.locator('#studioUpdateMotion').uncheck();assert.equal(await page.locator('.update-progress-scene').getAttribute('data-animation'),'off');
    assert.equal(await page.locator('.mascot-dog-tail').evaluate(node=>getComputedStyle(node).animationName),'none');report.checks.push('manual motion off pauses character CSS animations');await capture('manual-motion-off');
    await page.locator('#studioUpdateMotion').check();await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.mascot-dog-tail').evaluate(node=>getComputedStyle(node).animationName),'none');
    await page.evaluate(()=>{window.fixtureNext={supported:true,status:'downloading',received:990000,total:1000000};window.fixtureUI.open();});await page.waitForTimeout(45);assert.equal(await page.locator('.update-progress-percent').innerText(),'99%');await capture('reduced-motion-live-progress');report.checks.push('reduced motion stops animation while byte progress continues');
    await page.emulateMedia({reducedMotion:'no-preference'});
    // Asset references and disclosure remain separate from character decoration.
    const ids=await page.locator('.update-mascot-art [id]').evaluateAll(nodes=>nodes.map(n=>n.id));assert.equal(new Set(ids).size,ids.length);assert.equal(await page.locator('.update-mascot-art image').count(),0);
    const snapshot=await page.locator('#studioUpdateDialog').evaluate(node=>{const clone=node.cloneNode(true);for(const input of node.querySelectorAll('input[type=checkbox]'))clone.querySelector('#'+input.id)?.toggleAttribute('checked',input.checked);return clone.outerHTML;});
    for(const zoom of [1,1.25,1.5]){
      const width=Math.round(420/zoom),height=Math.round(900/zoom),scaled=await browser.newPage({viewport:{width,height},deviceScaleFactor:zoom});
      scaled.on('request',request=>{if(!request.url().startsWith('data:')&&!request.url().startsWith('about:'))remote.push(request.url());});scaled.on('pageerror',error=>errors.push(error.message));
      try{
        await scaled.setContent('<!doctype html><html data-theme="carbon"><body style="margin:0;background:var(--fs-app-bg);color:var(--fs-text-primary);font:12px Arial"><p>CONTROLLED FIXTURE · '+Math.round(zoom*100)+'% emulated DPR</p>'+snapshot+'</body></html>');await scaled.addStyleTag({content:asset('theme-tokens.css')});await scaled.addStyleTag({content:asset('update-scene.css')});await scaled.evaluate(()=>{const d=document.querySelector('dialog');d.removeAttribute('open');d.showModal();});
        const geometry=await scaled.locator('.update-progress-scene').evaluate(node=>{const r=node.getBoundingClientRect(),d=node.closest('dialog').getBoundingClientRect();return {sceneWidth:r.width,dialogLeft:d.left,dialogRight:d.right,dialogTop:d.top,dialogBottom:d.bottom,viewport:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio};});
        assert.equal(geometry.dpr,zoom);assert.ok(geometry.dialogLeft>=-1&&geometry.dialogRight<=geometry.viewport+1&&geometry.dialogTop>=-1&&geometry.dialogBottom<=geometry.viewportHeight+1,JSON.stringify(geometry));
        const overlap=await scaled.evaluate(()=>{const percent=document.querySelector('.update-progress-percent').getBoundingClientRect();return [...document.querySelectorAll('.mascot-cat-head,.mascot-dog-head')].some(node=>{const animal=node.getBoundingClientRect();return percent.left<animal.right&&percent.right>animal.left&&percent.top<animal.bottom&&percent.bottom>animal.top;});});assert.equal(overlap,false,'download numbers must remain physically separate from both character heads');
        await scaled.screenshot({path:path.join(proof,'narrow-emulated-dpr-'+Math.round(zoom*100)+'.png')});
        await scaled.locator('#studioCancelUpdateDownload').scrollIntoViewIfNeeded();const control=await scaled.locator('#studioCancelUpdateDownload').boundingBox();assert.ok(control.y>=0&&control.y+control.height<=height+1,'the bottom action is scroll reachable');
        report.checks.push({emulatedScale:zoom,geometry,bottomActionReachable:true});
      }finally{await scaled.close();}
    }
    report.runtimeAssetBytes=Object.fromEntries(['update-scene.js','update-scene.css','mascot-scene.svg'].map(name=>[name,Buffer.byteLength(asset(name))]));
    report.runtimeAssetSha256=Object.fromEntries(['update-scene.js','update-check.js','update-scene.css','mascot-scene.svg','mascot-minimal-cat.svg','mascot-minimal-dog.svg'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,name))).digest('hex')]));
    report.componentTiming=[];
    report.componentTimingScope={measurement:'CDP Performance.getMetrics deltas over two 2.5-second windows, with character animation on and off',cpuMeaning:'Chrome main-thread task/script duration proxy; not operating-system CPU utilization',osCPUUtilizationMeasured:false,gpuUtilizationMeasured:false,instrumentation:'Both windows include the same requestAnimationFrame and long-task observer measurement overhead'};
    const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
    for(const enabled of [true,false]){
      await page.locator('#studioUpdateMotion').setChecked(enabled);
      assert.equal(await page.locator('.update-progress-scene').getAttribute('data-animation'),enabled?'on':'off');
      const before=await cdp.send('Performance.getMetrics');
      const frames=await page.evaluate(()=>new Promise(resolve=>{
        const gaps=[],longTasks=[];let last=performance.now(),started=last;
        const observer=typeof PerformanceObserver!=='undefined'?new PerformanceObserver(list=>{for(const entry of list.getEntries())longTasks.push(entry.duration);}):null;
        try{observer?.observe({type:'longtask',buffered:false});}catch{}
        const frame=now=>{gaps.push(now-last);last=now;if(now-started<2500)requestAnimationFrame(frame);else{observer?.disconnect();gaps.sort((a,b)=>a-b);resolve({elapsedMs:now-started,frames:gaps.length,p50Ms:gaps[Math.floor(gaps.length*.5)],p95Ms:gaps[Math.floor(gaps.length*.95)],maxMs:Math.max(...gaps),longTasks});}};requestAnimationFrame(frame);
      }));
      const after=await cdp.send('Performance.getMetrics'),metric=(value,name)=>value.metrics.find(item=>item.name===name)?.value;
      report.componentTiming.push({animationEnabled:enabled,...frames,cdpTaskDurationSeconds:metric(after,'TaskDuration')-metric(before,'TaskDuration'),cdpScriptDurationSeconds:metric(after,'ScriptDuration')-metric(before,'ScriptDuration')});
    }
    report.limitations.push('Component timing is a short run on this host. CDP task/script duration is a Chrome main-thread CPU proxy, not OS CPU utilization. OS CPU and GPU utilization were not measured. It does not demonstrate full-editor or sustained frame rate on other machines.');
    await page.evaluate(()=>{window.fixtureUI.close();});assert.equal(await page.locator('.update-progress-scene').getAttribute('data-animation'),'off');report.checks.push('closing pauses; scoped scene IDs unique; no image/network dependencies; narrow 100/125/150% emulated DPI geometry');
    // First obtain the registered Setup edition; afterwards the same visible
    // action stays in the local updater. Both routes use controlled responses.
    await page.evaluate(async()=>{
      window.fixtureUI.destroy();window.flowActions=[];window.flowExternal=[];
      const info={currentVersion:'0.1.22',platform:'windows',architecture:'x86_64',channel:'stable',inAppInstall:false};
      window.fixtureUI=StudioUpdateCheck.create({document,container:document.querySelector('header'),language:()=> 'en',info,check:async()=>({...info,status:'up-to-date',latestVersion:'0.1.22',downloadUrl:'https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.22/polish-sci-figures-Studio-0.1.22-Setup-x64.exe'}),installUpdate:async action=>{window.flowActions.push(action);return {status:'idle',supported:true};},openExternal:url=>{window.flowExternal.push(url);return true;}});
      window.fixtureUI.open();await window.fixtureUI.check();
    });
    assert.equal(await page.locator('.update-download').textContent(),'Install Windows desktop edition');assert.equal(await page.locator('.update-download').isVisible(),true);assert.equal(await page.locator('#studioInstallUpdate').isVisible(),false);await page.locator('.update-download').click();
    await page.waitForFunction(()=>window.flowExternal.length===1);assert.deepEqual(await page.evaluate(()=>window.flowActions),[]);assert.match(await page.locator('.update-hint').textContent(),/Future updates run inside the editor/);await capture('first-desktop-install');
    await page.evaluate(async()=>{
      window.fixtureUI.destroy();window.flowActions=[];window.flowExternal=[];
      const info={currentVersion:'0.1.20',platform:'windows',architecture:'x86_64',channel:'stable',inAppInstall:true};
      window.fixtureUI=StudioUpdateCheck.create({document,container:document.querySelector('header'),language:()=> 'en',info,installPollMs:100000,check:async()=>({...info,status:'update-available',latestVersion:'0.1.21',downloadUrl:'https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.21/polish-sci-figures-Studio-0.1.21-Setup-x64.exe'}),installUpdate:async action=>{window.flowActions.push(action);return {status:action==='download'?'downloading':'idle',supported:true,received:25,total:100};},openExternal:url=>{window.flowExternal.push(url);return true;}});
      window.fixtureUI.open();await window.fixtureUI.check();
    });
    assert.match(await page.locator('.update-hint').textContent(),/No manual extraction/);await page.locator('.update-download').click();await page.waitForFunction(()=>window.flowActions.includes('download'));assert.deepEqual(await page.evaluate(()=>window.flowExternal),[]);assert.equal(await page.locator('.update-progress-percent').textContent(),'25%');await capture('in-editor-upgrade');
    await page.evaluate(()=>window.fixtureUI.close());report.checks.push('same-version unregistered copy offers official Setup once; registered edition downloads through local updater without opening GitHub or extracting files manually');report.firstInstallAndUpgrade={firstSetupOpensOfficialLinkOnly:true,sameVersionSetupAvailable:true,registeredUpgradeExternalRequests:0,registeredUpgradeAction:'download',actualInstallerExecuted:false};
    assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);report.remoteRequests=0;report.browserErrors=errors;report.passed=true;
  }catch(error){runError=error;report.passed=false;report.failure={name:error.name,message:error.message,stack:error.stack};
  }finally{
    const cleanupErrors=[];let contextClosed=false,browserClosed=false;
    try{if(context){await context.close();contextClosed=true;}}catch(error){cleanupErrors.push({resource:'context',name:error.name,message:error.message});}
    // Closing the browser is independent of both context cleanup and video
    // finalization. A broken recording must never leave our browser running.
    try{if(browser){await browser.close();browserClosed=true;}}catch(error){cleanupErrors.push({resource:'browser',name:error.name,message:error.message});}
    try{
      if(video){
        if(!contextClosed&&!browserClosed)throw Error('Recording cannot finalize because neither the context nor the browser closed.');
        const original=await video.path(),bytes=fs.readFileSync(original);report.originalRecording={file:path.relative(proof,original).replaceAll('\\','/'),bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),scope:'Unedited Playwright main-context recording of this controlled component browser run. Narrow screenshots use separate contexts and are not in this recording.'};
      }
    }catch(error){cleanupErrors.push({resource:'recording',name:error.name,message:error.message});}
    if(cleanupErrors.length){report.cleanupErrors=cleanupErrors;report.passed=false;}
    fs.writeFileSync(path.join(proof,'scene-browser-result.json'),JSON.stringify(report,null,2));
  }
  if(runError)throw runError;if(!report.passed)throw Error('Browser fixture cleanup failed; inspect scene-browser-result.json.');
  console.log(JSON.stringify({passed:report.passed,kind:report.kind,states:report.states.length,proof}));
})().catch(error=>{console.error(error);process.exitCode=1;});
