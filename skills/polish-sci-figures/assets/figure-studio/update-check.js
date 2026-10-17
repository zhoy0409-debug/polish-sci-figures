/* Optional release checks. No project, image or data-table access. */
'use strict';
const StudioUpdateCheck = (() => {
  const official='https://github.com/zhoy0409-debug/polish-sci-figures/releases';
  const words={
    updates:['更新','Updates'],title:['Figure Studio 更新','Figure Studio updates'],check:['检查更新','Check for updates'],checking:['正在检查官方版本…','Checking official releases…'],
    current:['当前版本','Installed version'],latest:['最新版本','Latest version'],unknown:['未提供','Unavailable'],preview:['开发预览','Development preview'],stable:['正式版','Stable release'],
    ready:['发现新版本','An update is available'],uptodate:['已是当前渠道的最新版本','You are up to date on this release channel'],
    uptodateStale:['上次检查时已是最新版本','Up to date at the last successful check'],
    offline:['暂时无法检查更新','Could not check for updates'],offlineHint:['网络连接暂不可用，请稍后重试。你可以继续本机作图。','The release service is unavailable. Try again later; local editing remains available.'],
    unavailable:['此版本暂无直接更新包','No direct update package is available'],unsupported:['可在官方发布页查看此平台的发行情况。','Check the official release page for availability on this platform.'],
    ios:['iPhone / iPad 暂无可直接安装的公开安装包。','No public iPhone / iPad installer is available yet.'],
    privacy:['只查询官方版本信息，不发送工程、图片或研究数据。','Only official release information is checked. Projects, images and research data are not sent.'],
    stale:['当前无法联网；以下为上次成功检查的信息，可能已有变化。','Currently offline. These are the last successfully checked release details and may have changed.'],
    download:['下载更新','Download update'],releases:['官方发布页','Official releases'],later:['稍后','Later'],close:['关闭','Close'],retry:['重新检查','Check again'],
    save:['安装更新前，请先保存工程。','Save your project before installing the update.'],
    downloadHere:['下载并准备更新','Download and prepare update'],downloadProgress:['正在下载：{0} / {1} MB','Downloading: {0} / {1} MB'],downloadUnknown:['正在下载：已下载 {0} MB','Downloading: {0} MB received'],
    details:['更新说明','Update details'],verifying:['下载完成，正在校验更新包…','Download complete. Verifying the update…'],
    downloadingTitle:['正在下载更新','Downloading your update'],verifyingTitle:['正在校验更新包','Verifying your update'],readyTitle:['准备好了，可以安装','Ready when you are'],preparingTitle:['正在准备安装','Preparing to install'],installingTitle:['正在安装，即将回来','Installing. Back in a moment.'],
    downloaded:['更新包校验完成，可以安装。','Update verified. Ready to install.'],cancelDownload:['取消下载','Cancel download'],
    characterMotion:['角色动画（遵循系统降动效设置）','Character animation (respects reduced motion)'],connectionTitle:['等待更新器确认','Waiting for the updater'],cancelledTitle:['下载已取消','Download cancelled'],failedTitle:['更新暂未完成','Update could not finish'],
    confirmedStage:['最后确认阶段：{0}。','Last confirmed stage: {0}.'],confirmedDownload:['已确认下载：{0} / {1} MB（下载包进度，不是安装进度）。','Confirmed download: {0} / {1} MB (package download, not installation progress).'],confirmedDownloadUnknown:['已确认下载：{0} MB（下载包进度，不是安装进度）。','Confirmed download: {0} MB (package download, not installation progress).'],
    savedConfirm:['我已保存工程，可以关闭编辑器并安装。','I have saved my project and am ready to close the editor and install.'],install:['安装并重新打开','Install and reopen'],
    installHint:['工程和设置保留，安装前会备份旧版本。请按 Windows 安全或权限提示操作。','Your projects and settings stay in place. A backup is kept first; follow any Windows security or permission prompts.'],
    preparing:['正在保留旧版本，请稍候…','Preserving the previous version…'],installing:['正在关闭旧版本并安装；完成后会重新打开。','Closing the previous version and installing. The editor will reopen afterwards.'],
    connecting:['暂时未收到更新器的进度，正在重新连接…','Waiting for the updater. Reconnecting…'],connectionPaused:['暂时无法获取更新器的进度。','The updater is not responding yet.'],connectionHint:['更新可能仍在继续。重新获取进度即可确认，无需重复安装；你也可以先继续编辑。','The update may still be running. Check its progress before starting another installation. You can continue editing.'],checkProgress:['重新获取进度','Check progress'],
    invalidProgress:['更新器返回的状态无法识别，请重新获取进度后再操作。','The updater returned an invalid status. Check its progress before taking another action.'],
    byteCount:['已确认字节：{0} / {1}','Confirmed bytes: {0} / {1}'],downloadFailureDetail:['下载或文件校验未通过。','Download or file verification failed.'],prepareFailureDetail:['安装准备未完成：{0}。','Installation preparation stopped: {0}.'],
    verifyInstaller:['检查安装包','verify installer'],backupProgram:['备份程序','back up program'],verifyBackup:['核对备份','verify backup'],startHelper:['启动更新助手','start updater helper'],waitHelper:['等待更新助手确认','wait for helper confirmation'],
    stepDownload:['下载与校验','Download & verify'],stepPrepare:['保留旧版本','Keep previous version'],stepInstall:['安装并打开','Install & reopen'],
    cancelled:['下载已取消，可继续编辑。','Download cancelled. You can keep editing.'],installFailed:['更新未启动或未通过校验，当前版本仍可继续使用。请重试或从官方页下载。','The update could not start or pass verification. The current version remains available. Retry or download from the official release page.'],
    portable:['此程序是便携版或未识别为注册安装版。请下载新版本；不会自动覆盖此目录。','This is a portable or unregistered copy. Download the new version; this directory will not be replaced automatically.'],
    mac:['Mac 开发预览需手动替换应用，并按系统提示允许打开未公证的应用。','The Mac development preview requires manual app replacement and the system approval for an unnotarized app.'],
    android:['开发预览可能无法覆盖旧安装。请先保存并确认工程文件，再更换安装包。','A development preview may not replace an older installation. Save and verify your project files before switching packages.'],
    newLabel:['发现 Figure Studio {0}，点击查看','Figure Studio {0} is available; open update details'],
    openFailed:['无法打开下载链接，请重试或打开官方发布页。','The download link could not be opened. Retry or open the official release page.']
  };
  const Scene=typeof StudioUpdateScene!=='undefined'?StudioUpdateScene:typeof module!=='undefined'&&module.exports?require('./update-scene.js'):null;
  function officialURL(value,{download=false}={}){
    if(typeof value!=='string'||value.length>700||/[\s\\%?#]/.test(value))return null;
    let url;try{url=new URL(value);}catch{return null;}
    if(url.origin!=='https://github.com'||url.username||url.password||url.port)return null;
    const prefix='/zhoy0409-debug/polish-sci-figures/releases';
    const valid=download?new RegExp('^'+prefix+'/download/[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$').test(url.pathname):url.pathname===prefix||url.pathname===prefix+'/latest'||new RegExp('^'+prefix+'/tag/[A-Za-z0-9][A-Za-z0-9._-]*$').test(url.pathname);
    return valid?url.href:null;
  }
  const version=value=>typeof value==='string'&&/^[0-9][A-Za-z0-9.+_-]{0,69}$/.test(value)?value:null;
  function matchingAsset(url,platform,architecture){
    const name=url.split('/').at(-1),prefix='polish-sci-figures-Studio-[0-9]+\\.[0-9]+\\.[0-9]+';
    if(platform==='windows')return new RegExp('^'+prefix+'-(Setup-x64\\.exe|Portable-x64\\.zip)$').test(name);
    if(platform==='macos')return new RegExp('^'+prefix+'-macOS-'+(['arm64','x86_64'].includes(architecture)?architecture:'(?:arm64|x86_64)')+'-Preview\\.zip$').test(name);
    if(platform==='android')return new RegExp('^'+prefix+'-Android-preview\\.apk$').test(name);
    return false;
  }
  function normalize(value,info={}){
    if(!value||typeof value!=='object'||!['update-available','up-to-date','unavailable','offline'].includes(value.status))throw Error('Invalid update response');
    const platforms=['windows','macos','android','ios','browser'],platform=platforms.includes(info.platform)?info.platform:platforms.includes(value.platform)?value.platform:'browser';
    const result={status:value.status,platform,currentVersion:version(info.currentVersion)||version(value.currentVersion),latestVersion:version(value.latestVersion),channel:(info.channel||value.channel)==='preview'?'preview':'stable',releaseUrl:officialURL(value.releaseUrl)||official,downloadUrl:null,cached:value.cached===true,stale:value.stale===true,inAppInstall:platform==='windows'&&info.inAppInstall===true};
    if(value.downloadUrl){result.downloadUrl=officialURL(value.downloadUrl,{download:true});if(!result.downloadUrl)throw Error('Unofficial update download');if(!matchingAsset(result.downloadUrl,platform,info.architecture||value.architecture))result.downloadUrl=null;}
    // iOS has no downloadable public installer. An invalid server/native
    // response cannot turn a simulator build into an installation offer.
    if(platform==='ios'||platform==='browser'){result.downloadUrl=null;if(result.status!=='offline')result.status='unavailable';}
    if(result.status==='update-available'&&(!result.latestVersion||!result.downloadUrl))result.status='unavailable';
    return result;
  }
  function create(host){
    const doc=host.document||globalThis.document;if(!doc||!host.container)throw Error('Update controls require a container');
    const language=()=>String(host.language?.()||'zh-CN').startsWith('en')?1:0,t=(key,...args)=>(words[key]?.[language()]||key).replace(/\{(\d+)\}/g,(_,i)=>args[i]??'');
    const info=()=>typeof host.info==='function'?host.info()||{}:host.info||{};
    const el=(name,cls)=>{const node=doc.createElement(name);if(cls)node.className=cls;return node;};
    const button=el('button','studio-update-button');button.id='studioCheckUpdates';button.type='button';button.setAttribute('aria-haspopup','dialog');
    const icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 20 20');icon.setAttribute('aria-hidden','true');const path=doc.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M16.5 7A7 7 0 1 0 17 12M16.5 3v4h-4');icon.append(path);
    const buttonText=el('span'),badge=el('span','studio-update-badge');badge.setAttribute('aria-hidden','true');button.append(icon,buttonText,badge);host.container.append(button);
    const dialog=el('dialog','studio-update-dialog');dialog.id='studioUpdateDialog';dialog.setAttribute('aria-labelledby','studioUpdateTitle');
    const heading=el('div','update-heading'),title=el('h2'),closeButton=el('button','update-close');closeButton.type='button';closeButton.id='studioCloseUpdate';title.id='studioUpdateTitle';heading.append(title,closeButton);
    const closeIcon=doc.createElementNS(icon.namespaceURI,'svg');closeIcon.setAttribute('viewBox','0 0 16 16');closeIcon.setAttribute('aria-hidden','true');const closePath=doc.createElementNS(icon.namespaceURI,'path');closePath.setAttribute('d','M4 4l8 8M12 4l-8 8');closeIcon.append(closePath);closeButton.append(closeIcon);
    const summary=el('p','update-summary');summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');
    const versionRow=el('div','update-version-row'),versions=el('dl','update-versions'),currentGroup=el('div','update-version'),latestGroup=el('div','update-version'),currentLabel=el('dt'),currentValue=el('dd'),latestLabel=el('dt'),latestValue=el('dd');currentGroup.append(currentLabel,currentValue);latestGroup.append(latestLabel,latestValue);versions.append(currentGroup,latestGroup);
    const channel=el('p','update-channel'),hint=el('p','update-hint'),stale=el('p','update-muted'),privacy=el('p','update-muted'),release=el('a','update-release'),error=el('p','update-error'),details=el('details','update-details'),detailsTitle=el('summary');error.setAttribute('role','alert');versionRow.append(versions,channel);details.append(detailsTitle,privacy,release);
    const actions=el('div','update-actions'),later=el('button'),checkButton=el('button'),download=el('a','update-download');later.type=checkButton.type='button';
    for(const a of [release,download]){a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
    checkButton.className='update-recheck';checkButton.id='studioRetryUpdateCheck';actions.append(later,checkButton,download);dialog.append(heading,summary,versionRow,hint,stale,error,actions,details);doc.body.append(dialog);
    const installArea=el('div','update-install-area'),progress=el('progress','update-progress-native'),progressLabel=el('p','update-progress-caption'),confirmation=el('label'),savedBox=el('input'),savedText=el('span'),installButton=el('button'),cancelButton=el('button'),retryStatusButton=el('button'),connectionHint=el('p','update-connection-hint');
    const scene=el('div','update-progress-scene'),percent=el('span','update-progress-percent'),steps=el('ol','update-steps');
    if(!Scene)throw Error('Update scene module is missing');
    const sceneUI=Scene.create({document:doc,container:scene,artwork:host.updateSceneSVG});scene.append(percent);dialog.insertBefore(scene,hint);
    const motionSetting=el('label','update-motion-setting'),motionBox=el('input'),motionText=el('span');motionBox.type='checkbox';motionBox.id='studioUpdateMotion';motionBox.checked=true;motionSetting.append(motionBox,motionText);dialog.insertBefore(motionSetting,hint);
    const stepNodes=['stepDownload','stepPrepare','stepInstall'].map((key,index)=>{const item=el('li'),dot=el('span','update-step-dot'),label=el('span');item.append(dot,label);steps.append(item);return {item,dot,label,key,index};});
    progress.setAttribute('aria-label',t('downloadHere'));progressLabel.id='studioUpdateProgressLabel';progress.setAttribute('aria-describedby',progressLabel.id);progressLabel.setAttribute('role','status');progressLabel.setAttribute('aria-live','polite');savedBox.type='checkbox';savedBox.id='studioUpdateSaved';confirmation.className='update-confirmation';confirmation.append(savedBox,savedText);installButton.type=cancelButton.type=retryStatusButton.type='button';installButton.id='studioInstallUpdate';cancelButton.id='studioCancelUpdateDownload';retryStatusButton.id='studioRetryUpdateStatus';installArea.append(progress,progressLabel,steps,connectionHint,confirmation);dialog.insertBefore(installArea,hint);actions.append(cancelButton,retryStatusButton,installButton);
    let result=null,busy=false,destroyed=false,serial=0,inflight=null,controller=null,lastFocus=null,autoTimer=null,repeatTimer=null,temporaryError=false;
    let downloadSample=null,installation=null,confirmedInstallation=null,installBusy=false,installTimer=null,installError=false,connectionLost=false,statusFailures=0,handoffConfirmed=false;
    const canInstall=()=>info().platform==='windows'&&info().inAppInstall===true&&typeof host.installUpdate==='function';
    let storage=host.storage;try{if(storage===undefined)storage=doc.defaultView?.localStorage;}catch{}
    try{motionBox.checked=storage?.getItem('figure-studio:update-motion')!=='off';}catch{}sceneUI.setEnabled(motionBox.checked);
    const now=()=>typeof host.now==='function'?host.now():Date.now(),key=()=>{const i=info();return 'figure-studio:update-check:'+JSON.stringify([i.platform||'browser',i.architecture||'',i.channel||'stable',i.currentVersion||'unknown']);};
    const saved=()=>{try{const v=JSON.parse(storage?.getItem(key())||'null');return v&&typeof v==='object'?v:{};}catch{return{};}},save=patch=>{try{storage?.setItem(key(),JSON.stringify({...saved(),...patch}));}catch{}};
    try{if(saved().result)result=normalize(saved().result,info());}catch{}
    function refresh(){
      if(destroyed)return;const current=result||normalize({status:'unavailable',...info()}),snooze=saved();
      const showBadge=result?.status==='update-available'&&!(snooze.version===result.latestVersion&&snooze.until>now());
      buttonText.textContent=t('updates');badge.hidden=!showBadge;button.title=showBadge?t('newLabel',result.latestVersion):t('check');button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded',String(dialog.open));
      title.textContent=t('title');closeButton.title=t('close');closeButton.setAttribute('aria-label',t('close'));detailsTitle.textContent=t('details');currentLabel.textContent=t('current');currentValue.textContent=current.currentVersion||t('unknown');latestLabel.textContent=t('latest');latestValue.textContent=current.latestVersion||t('unknown');latestGroup.hidden=latestLabel.hidden=latestValue.hidden=!current.latestVersion;
      channel.textContent=current.channel==='preview'?t('preview'):t('stable');privacy.textContent=t('privacy');release.textContent=t('releases');release.href=current.releaseUrl||official;
      summary.textContent=busy?t('checking'):t(result?.status==='update-available'?'ready':result?.status==='up-to-date'?(result.stale?'uptodateStale':'uptodate'):result?.status==='offline'?'offline':result?'unavailable':'check');
      hint.textContent=current.platform==='ios'?t('ios'):result?.status==='offline'?t('offlineHint'):result?.status==='update-available'?(current.platform==='android'&&current.channel==='preview'?t('android'):t('save')):result?.status==='unavailable'?t('unsupported'):'';hint.hidden=!hint.textContent;
      stale.textContent=t('stale');stale.hidden=!result?.stale;
      checkButton.textContent=result?t('retry'):t('check');checkButton.title=checkButton.textContent;checkButton.setAttribute('aria-label',checkButton.textContent);checkButton.disabled=busy;download.textContent=t('download');download.hidden=busy||result?.status!=='update-available'||!current.downloadUrl;
      if(!download.hidden)download.href=current.downloadUrl;else download.removeAttribute('href');later.textContent=result?.status==='update-available'?t('later'):t('close');
      error.textContent=temporaryError?t('openFailed'):'';error.hidden=!temporaryError;
      const view=Scene.presentation({installation,confirmedInstallation,busy,result,connectionLost,invalid:installError}),{working,ready,determinate,ratio,verifying}=view,stage=installation?.status;
      installArea.hidden=!canInstall()||(!installation||['idle','unsupported'].includes(stage))&&!connectionLost;progress.hidden=!working&&!ready&&!connectionLost;steps.hidden=!working&&!ready;
      const mb=value=>(value/1e6).toFixed(2).replace(/0$/,'');
      let caption=connectionLost?t(statusFailures>=3||installError?'connectionPaused':'connecting'):verifying?t('verifying'):stage==='downloading'?installation.total>0?t('downloadProgress',mb(installation.received||0),mb(installation.total)):t('downloadUnknown',mb(installation.received||0)):ready?t('downloaded'):stage==='preparing'?t('preparing'):stage==='installing'?t('installing'):stage==='cancelled'?t('cancelled'):stage==='checking'?t('checking'):'';
      if(connectionLost){const confirmedTitle={checking:'checking',downloading:'downloadingTitle',ready:'readyTitle',preparing:'preparingTitle',installing:'installingTitle',cancelled:'cancelledTitle',error:'failedTitle'}[view.confirmedStage];if(confirmedTitle)caption+=' '+t('confirmedStage',t(confirmedTitle));const bytes=view.confirmedDownload;if(bytes&&(bytes.received>0||bytes.total>0))caption+=' '+(bytes.total>0?t('confirmedDownload',mb(bytes.received),mb(bytes.total)):t('confirmedDownloadUnknown',mb(bytes.received)));}
      if(progressLabel.textContent!==caption)progressLabel.textContent=caption;
      progressLabel.title=determinate?t('byteCount',installation.received||0,installation.total):'';
      if(determinate||ready){progress.max=determinate?installation.total:1;progress.value=determinate?installation.received||0:1;progress.setAttribute('aria-valuetext',Math.floor(ratio*100)+'%');}else{progress.removeAttribute('value');progress.removeAttribute('aria-valuetext');}
      const visualState=view.state;sceneUI.setActive(dialog.open);sceneUI.refresh(view);
      percent.hidden=!determinate&&!ready;percent.textContent=Math.floor(ratio*100)+'%';motionText.textContent=t('characterMotion');
      const stageTitle={checking:'checking',downloading:'downloadingTitle',verifying:'verifyingTitle',ready:'readyTitle',preparing:'preparingTitle',installing:'installingTitle',paused:connectionLost?'connectionTitle':null,cancelled:'cancelledTitle',error:'failedTitle'}[visualState];if(stageTitle)summary.textContent=t(stageTitle);
      const activeStep=stage==='installing'?2:stage==='preparing'?1:0;for(const step of stepNodes){const done=step.index<activeStep||step.index===0&&ready;step.item.dataset.state=done?'done':step.index===activeStep&&!ready?'current':'future';step.dot.textContent=done?'✓':String(step.index+1);step.label.textContent=t(step.key);if(step.item.dataset.state==='current')step.item.setAttribute('aria-current','step');else step.item.removeAttribute('aria-current');}
      connectionHint.textContent=t('connectionHint');connectionHint.hidden=!connectionLost;
      confirmation.hidden=!ready;progress.setAttribute('aria-label',t('downloadHere'));savedText.textContent=t('savedConfirm');installButton.textContent=t('install');installButton.hidden=!canInstall()||!ready;installButton.disabled=installBusy||!savedBox.checked;
      cancelButton.textContent=t('cancelDownload');cancelButton.hidden=!canInstall()||!['checking','downloading'].includes(stage)||connectionLost;cancelButton.disabled=installBusy;
      retryStatusButton.textContent=t('checkProgress');retryStatusButton.hidden=!canInstall()||!connectionLost;retryStatusButton.disabled=installBusy;
      if(canInstall()){download.textContent=t('downloadHere');if(working||ready||connectionLost)download.hidden=true;checkButton.disabled=busy||working||installBusy;if(ready||stage==='preparing'||stage==='installing'){hint.textContent=t('installHint');hint.hidden=false;}}
      else if(result?.status==='update-available'&&current.platform==='windows'&&info().inAppInstall===false){hint.textContent=t('portable');hint.hidden=false;}
      else if(result?.status==='update-available'&&current.platform==='macos'){hint.textContent=t('mac');hint.hidden=false;}
      if(installError||stage==='error'){
        const failureStage={'verify-installer':'verifyInstaller','backup-program':'backupProgram','verify-backup':'verifyBackup','start-helper':'startHelper','wait-helper':'waitHelper'}[installation?.errorStage];
        const detail=installation?.error==='download-verification-failed'?t('downloadFailureDetail'):installation?.error==='prepare-failed'&&failureStage?t('prepareFailureDetail',t(failureStage)):'';
        error.textContent=t(installError?'invalidProgress':'installFailed')+(!installError&&detail?' '+detail:'');error.hidden=false;
      }
    }
    function close(snooze=false){
      if(destroyed)return;if(snooze&&result?.status==='update-available')save({version:result.latestVersion,until:now()+86400000});
      if(dialog.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}refresh();lastFocus?.isConnected&&lastFocus.focus?.();lastFocus=null;
    }
    function open(){
      if(destroyed)return;if(!dialog.open){lastFocus=doc.activeElement;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}refresh();check({manual:true});if(canInstall())installRequest('status');
    }
    function pollInstallation(){clearTimeout(installTimer);if(!destroyed&&!handoffConfirmed&&statusFailures<3&&(connectionLost||['checking','downloading','preparing'].includes(installation?.status)))installTimer=setTimeout(()=>installRequest('status'),Math.max(100,host.installPollMs||(installation?.status==='preparing'?100:1000)));}
    async function installRequest(action){
      if(destroyed||!canInstall()||installBusy)return null;if(action==='install'&&!savedBox.checked)return null;
      // Server-confirmed "installing" means the preserved helper is ready and
      // the old editor is closing. Its expected disconnect is not a failure.
      if(handoffConfirmed)return installation;
      if(action==='download'){downloadSample=null;confirmedInstallation=null;installation={status:'checking',supported:true};savedBox.checked=false;}
      else if(action==='install')installation={...installation,status:'preparing'};
      installBusy=true;installError=false;refresh();
      let deadline,invalidResponse=false;
      try{
        const value=await Promise.race([Promise.resolve().then(()=>host.installUpdate(action)),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Installation status timed out')),Math.max(100,Math.min(30000,host.installTimeoutMs||10000)));})]);
        if(destroyed)return null;
        if(!value||!['idle','checking','downloading','ready','preparing','installing','cancelled','error','unsupported'].includes(value.status)||value.supported!==true||!['received','total'].every(key=>value[key]===undefined||Number.isFinite(value[key])&&value[key]>=0&&value[key]<=2e9)||value.total>0&&value.received>value.total){invalidResponse=true;throw Error('Invalid installation response');}
        try{downloadSample=Scene.acceptProgress(downloadSample,value);}catch{invalidResponse=true;throw Error('Invalid installation progress');}
        installation=value;confirmedInstallation={...value};connectionLost=false;statusFailures=0;handoffConfirmed=value.status==='installing';return value;
      }catch{if(!destroyed){installError=invalidResponse;connectionLost=true;statusFailures++;}return null;}
      finally{clearTimeout(deadline);installBusy=false;if(!destroyed){refresh();if(!installError)pollInstallation();}}
    }
    function check({manual=true}={}){
      if(destroyed)return Promise.resolve(null);if(inflight)return inflight;
      if(!manual&&result&&saved().lastAutoCheck>now()-86400000)return Promise.resolve(result);
      if(!manual)save({lastAutoCheck:now()});
      const ticket=++serial;controller=new AbortController();busy=true;temporaryError=false;refresh();
      const signal=controller.signal;let timeout;
      const failure=()=>new Error('Update check unavailable');
      const guard=new Promise((_,reject)=>{timeout=setTimeout(()=>{controller?.abort();reject(failure());},Math.max(100,Math.min(30000,host.timeoutMs||10000)));signal.addEventListener('abort',()=>reject(failure()),{once:true});});
      const task=Promise.resolve().then(()=>typeof host.check==='function'?host.check({signal,refresh:manual}):{status:'unavailable',...info()});
      inflight=Promise.race([task,guard]).then(value=>{if(destroyed||ticket!==serial)return null;result=normalize(value,info());save({result});if(manual&&result.status==='update-available')save({version:result.latestVersion,until:0});return result;}).catch(()=>{if(destroyed||ticket!==serial)return null;result=normalize({status:'offline'},info());return result;}).finally(()=>{clearTimeout(timeout);if(ticket===serial){busy=false;inflight=null;controller=null;if(!destroyed)refresh();}});
      return inflight;
    }
    const external=event=>{if(!host.openExternal)return;event.preventDefault();const href=event.currentTarget.href;if(!officialURL(href,{download:event.currentTarget===download}))return;temporaryError=false;Promise.resolve().then(()=>host.openExternal(href)).then(value=>{if(value===false)throw Error('Open failed');}).catch(()=>{if(!destroyed){temporaryError=true;refresh();}});};
    button.onclick=open;closeButton.onclick=()=>close(true);checkButton.onclick=()=>check({manual:true});later.onclick=()=>close(true);release.onclick=external;download.onclick=event=>{if(canInstall()){event.preventDefault();installRequest('download');}else external(event);};
    motionBox.onchange=()=>{sceneUI.setEnabled(motionBox.checked);try{storage?.setItem('figure-studio:update-motion',motionBox.checked?'on':'off');}catch{}};
    savedBox.onchange=refresh;installButton.onclick=()=>installRequest('install');cancelButton.onclick=()=>installRequest('cancel');retryStatusButton.onclick=()=>{statusFailures=0;installRequest('status');};
    dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close(true);});dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close(true);}});
    const checkWhenVisible=()=>{if(doc.visibilityState!=='hidden')check({manual:false});};
    refresh();if(host.autoCheck===true){autoTimer=setTimeout(()=>{autoTimer=null;checkWhenVisible();},Math.max(0,host.autoDelayMs??1200));repeatTimer=setInterval(checkWhenVisible,3600000);doc.addEventListener('visibilitychange',checkWhenVisible);doc.defaultView?.addEventListener('focus',checkWhenVisible);}
    return {refresh,check,open,close,element:button,dialog,destroy(){if(destroyed)return;close();destroyed=true;serial++;clearTimeout(autoTimer);clearTimeout(installTimer);clearInterval(repeatTimer);doc.removeEventListener('visibilitychange',checkWhenVisible);doc.defaultView?.removeEventListener('focus',checkWhenVisible);controller?.abort();sceneUI.destroy();button.remove();dialog.remove();}};
  }
  return {create,normalize,officialURL};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioUpdateCheck;
