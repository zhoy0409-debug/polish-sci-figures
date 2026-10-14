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
    downloadHere:['下载并准备更新','Download and prepare update'],downloadProgress:['正在下载并校验：{0} / {1} MB','Downloading and verifying: {0} / {1} MB'],
    downloaded:['更新包校验完成，可以安装。','Update verified. Ready to install.'],cancelDownload:['取消下载','Cancel download'],
    savedConfirm:['我已保存工程，可以关闭编辑器并安装。','I have saved my project and am ready to close the editor and install.'],install:['安装并重新打开','Install and reopen'],
    installHint:['安装前将保留旧程序副本。工程和设置保留在原位置；请正常处理 Windows 显示的安全或权限提示。','A rollback copy of the program is kept first. Projects and settings stay in place. Respond to any Windows security or permission prompts normally.'],
    preparing:['正在保留旧版本，请稍候…','Preserving the previous version…'],installing:['正在关闭旧版本并安装；完成后会重新打开。','Closing the previous version and installing. The editor will reopen afterwards.'],
    cancelled:['下载已取消，可继续编辑。','Download cancelled. You can keep editing.'],installFailed:['更新未启动或未通过校验，当前版本仍可继续使用。请重试或从官方页下载。','The update could not start or pass verification. The current version remains available. Retry or download from the official release page.'],
    portable:['此程序是便携版或未识别为注册安装版。请下载新版本；不会自动覆盖此目录。','This is a portable or unregistered copy. Download the new version; this directory will not be replaced automatically.'],
    mac:['Mac 开发预览需手动替换应用，并按系统提示允许打开未公证的应用。','The Mac development preview requires manual app replacement and the system approval for an unnotarized app.'],
    android:['开发预览可能无法覆盖旧安装。请先保存并确认工程文件，再更换安装包。','A development preview may not replace an older installation. Save and verify your project files before switching packages.'],
    newLabel:['发现 Figure Studio {0}，点击查看','Figure Studio {0} is available; open update details'],
    openFailed:['无法打开下载链接，请重试或打开官方发布页。','The download link could not be opened. Retry or open the official release page.']
  };
  const css=`.studio-update-button{position:relative;display:inline-flex;align-items:center;gap:6px;white-space:nowrap}.studio-update-button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.studio-update-badge{width:7px;height:7px;border-radius:50%;background:#b55435;position:absolute;right:5px;top:5px}.studio-update-badge[hidden]{display:none}.studio-update-dialog{width:min(420px,calc(100vw - 28px));max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;padding:22px;border:1px solid #d6dfeb;border-radius:14px;background:#fff;color:#26364b;box-shadow:0 20px 70px #16253b24}.studio-update-dialog::backdrop{background:#17233955}.studio-update-dialog h2{margin:0;font-size:19px;font-weight:650;letter-spacing:-.025em}.studio-update-dialog p{font-size:13px;line-height:1.6;margin:12px 0}.studio-update-dialog .update-summary{margin-top:20px;font-size:15px;font-weight:600}.studio-update-dialog .update-versions{display:grid;grid-template-columns:1fr auto;gap:8px 18px;margin:18px 0;padding:13px 0;border-top:1px solid #e5eaf1;border-bottom:1px solid #e5eaf1;font-size:13px}.studio-update-dialog dt{color:#66748a}.studio-update-dialog dd{margin:0;text-align:right;font-variant-numeric:tabular-nums;overflow-wrap:anywhere}.studio-update-dialog .update-muted{color:#66748a;font-size:12px}.studio-update-dialog .update-actions{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap;margin-top:20px}.studio-update-dialog button,.studio-update-dialog a.update-download{box-sizing:border-box;min-height:36px;border-radius:7px;padding:8px 12px;font-size:13px;line-height:18px}.studio-update-dialog a.update-download{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;background:#526e9e;color:#fff;border:1px solid #526e9e}.studio-update-dialog a.update-release{color:#365c92;font-size:12px}.studio-update-dialog .update-error{color:#a13e49}.studio-update-dialog [hidden]{display:none!important}@media(pointer:coarse),(max-width:1024px){.studio-update-button,.studio-update-dialog button,.studio-update-dialog a.update-download{min-height:44px}.studio-update-dialog{padding:20px}.studio-update-dialog .update-actions{gap:7px}}`;
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
    if(!doc.getElementById('studioUpdateStyles')){const style=el('style');style.id='studioUpdateStyles';style.textContent=css;doc.head.append(style);}
    const button=el('button','studio-update-button');button.id='studioCheckUpdates';button.type='button';button.setAttribute('aria-haspopup','dialog');
    const icon=doc.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 20 20');icon.setAttribute('aria-hidden','true');const path=doc.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M16.5 7A7 7 0 1 0 17 12M16.5 3v4h-4');icon.append(path);
    const buttonText=el('span'),badge=el('span','studio-update-badge');badge.setAttribute('aria-hidden','true');button.append(icon,buttonText,badge);host.container.append(button);
    const dialog=el('dialog','studio-update-dialog');dialog.id='studioUpdateDialog';dialog.setAttribute('aria-labelledby','studioUpdateTitle');
    const title=el('h2');title.id='studioUpdateTitle';const summary=el('p','update-summary');summary.setAttribute('role','status');summary.setAttribute('aria-live','polite');
    const versions=el('dl','update-versions'),currentLabel=el('dt'),currentValue=el('dd'),latestLabel=el('dt'),latestValue=el('dd');versions.append(currentLabel,currentValue,latestLabel,latestValue);
    const channel=el('p','update-muted'),hint=el('p'),stale=el('p','update-muted'),privacy=el('p','update-muted'),release=el('a','update-release'),error=el('p','update-error');error.setAttribute('role','alert');
    const actions=el('div','update-actions'),later=el('button'),checkButton=el('button'),download=el('a','update-download');later.type=checkButton.type='button';
    for(const a of [release,download]){a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';}
    actions.append(later,checkButton,download);dialog.append(title,summary,versions,channel,hint,stale,privacy,release,error,actions);doc.body.append(dialog);
    const installArea=el('div','update-install-area'),progress=el('progress'),progressLabel=el('p'),confirmation=el('label'),savedBox=el('input'),savedText=el('span'),installButton=el('button'),cancelButton=el('button');
    progress.style.width='100%';progress.setAttribute('aria-label',t('downloadHere'));savedBox.type='checkbox';savedBox.id='studioUpdateSaved';confirmation.append(savedBox,savedText);confirmation.style.cssText='display:flex;align-items:flex-start;gap:8px;font-size:13px;line-height:1.5';savedBox.style.cssText='width:18px;min-width:18px;margin:2px 0';installButton.type=cancelButton.type='button';installButton.id='studioInstallUpdate';cancelButton.id='studioCancelUpdateDownload';installArea.append(progress,progressLabel,confirmation);dialog.insertBefore(installArea,actions);actions.append(cancelButton,installButton);
    let result=null,busy=false,destroyed=false,serial=0,inflight=null,controller=null,lastFocus=null,autoTimer=null,repeatTimer=null,temporaryError=false;
    let installation=null,installBusy=false,installTimer=null,installError=false;
    const canInstall=()=>info().platform==='windows'&&info().inAppInstall===true&&typeof host.installUpdate==='function';
    let storage=host.storage;try{if(storage===undefined)storage=doc.defaultView?.localStorage;}catch{}
    const now=()=>typeof host.now==='function'?host.now():Date.now(),key=()=>{const i=info();return 'figure-studio:update-check:'+JSON.stringify([i.platform||'browser',i.architecture||'',i.channel||'stable',i.currentVersion||'unknown']);};
    const saved=()=>{try{const v=JSON.parse(storage?.getItem(key())||'null');return v&&typeof v==='object'?v:{};}catch{return{};}},save=patch=>{try{storage?.setItem(key(),JSON.stringify({...saved(),...patch}));}catch{}};
    try{if(saved().result)result=normalize(saved().result,info());}catch{}
    function refresh(){
      if(destroyed)return;const current=result||normalize({status:'unavailable',...info()}),snooze=saved();
      const showBadge=result?.status==='update-available'&&!(snooze.version===result.latestVersion&&snooze.until>now());
      buttonText.textContent=t('updates');badge.hidden=!showBadge;button.title=showBadge?t('newLabel',result.latestVersion):t('check');button.setAttribute('aria-label',button.title);button.setAttribute('aria-expanded',String(dialog.open));
      title.textContent=t('title');currentLabel.textContent=t('current');currentValue.textContent=current.currentVersion||t('unknown');latestLabel.textContent=t('latest');latestValue.textContent=current.latestVersion||t('unknown');latestLabel.hidden=latestValue.hidden=!current.latestVersion;
      channel.textContent=current.channel==='preview'?t('preview'):t('stable');privacy.textContent=t('privacy');release.textContent=t('releases');release.href=current.releaseUrl||official;
      summary.textContent=busy?t('checking'):t(result?.status==='update-available'?'ready':result?.status==='up-to-date'?(result.stale?'uptodateStale':'uptodate'):result?.status==='offline'?'offline':result?'unavailable':'check');
      hint.textContent=current.platform==='ios'?t('ios'):result?.status==='offline'?t('offlineHint'):result?.status==='update-available'?(current.platform==='android'&&current.channel==='preview'?t('android'):t('save')):result?.status==='unavailable'?t('unsupported'):'';hint.hidden=!hint.textContent;
      stale.textContent=t('stale');stale.hidden=!result?.stale;
      checkButton.textContent=result?t('retry'):t('check');checkButton.disabled=busy;download.textContent=t('download');download.hidden=busy||result?.status!=='update-available'||!current.downloadUrl;
      if(!download.hidden)download.href=current.downloadUrl;else download.removeAttribute('href');later.textContent=result?.status==='update-available'?t('later'):t('close');
      error.textContent=temporaryError?t('openFailed'):'';error.hidden=!temporaryError;
      const stage=installation?.status,working=['checking','downloading','preparing','installing'].includes(stage),ready=stage==='ready';
      installArea.hidden=!canInstall()||!installation;progress.hidden=!['checking','downloading','preparing'].includes(stage);progressLabel.textContent=stage==='downloading'?t('downloadProgress',((installation.received||0)/1e6).toFixed(1),((installation.total||0)/1e6).toFixed(1)):stage==='ready'?t('downloaded'):stage==='preparing'?t('preparing'):stage==='installing'?t('installing'):stage==='cancelled'?t('cancelled'):stage==='checking'?t('checking'):'';
      if(stage==='downloading'){progress.max=installation.total||1;progress.value=installation.received||0;}else progress.removeAttribute('value');
      confirmation.hidden=!ready;progress.setAttribute('aria-label',t('downloadHere'));savedText.textContent=t('savedConfirm');installButton.textContent=t('install');installButton.hidden=!canInstall()||!ready;installButton.disabled=installBusy||!savedBox.checked;
      cancelButton.textContent=t('cancelDownload');cancelButton.hidden=!canInstall()||!['checking','downloading'].includes(stage);cancelButton.disabled=installBusy;
      if(canInstall()){download.textContent=t('downloadHere');if(working||ready)download.hidden=true;checkButton.disabled=busy||working||installBusy;if(ready||stage==='preparing'||stage==='installing'){hint.textContent=t('installHint');hint.hidden=false;}}
      else if(result?.status==='update-available'&&current.platform==='windows'&&info().inAppInstall===false){hint.textContent=t('portable');hint.hidden=false;}
      else if(result?.status==='update-available'&&current.platform==='macos'){hint.textContent=t('mac');hint.hidden=false;}
      if(installError||stage==='error'){error.textContent=t('installFailed');error.hidden=false;}
    }
    function close(snooze=false){
      if(destroyed)return;if(snooze&&result?.status==='update-available')save({version:result.latestVersion,until:now()+86400000});
      if(dialog.open){if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');}refresh();lastFocus?.isConnected&&lastFocus.focus?.();lastFocus=null;
    }
    function open(){
      if(destroyed)return;if(!dialog.open){lastFocus=doc.activeElement;if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');}refresh();check({manual:true});if(canInstall())installRequest('status');
    }
    function pollInstallation(){clearTimeout(installTimer);if(!destroyed&&['checking','downloading','preparing','installing'].includes(installation?.status))installTimer=setTimeout(()=>installRequest('status'),Math.max(100,host.installPollMs||1000));}
    async function installRequest(action){
      if(destroyed||!canInstall()||installBusy)return null;if(action==='install'&&!savedBox.checked)return null;
      installBusy=true;installError=false;refresh();
      let deadline;
      try{
        const value=await Promise.race([Promise.resolve().then(()=>host.installUpdate(action)),new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('Installation status timed out')),Math.max(100,Math.min(30000,host.installTimeoutMs||10000)));})]);
        if(destroyed)return null;
        if(!value||!['idle','checking','downloading','ready','preparing','installing','cancelled','error','unsupported'].includes(value.status)||value.supported!==true||!['received','total'].every(key=>value[key]===undefined||Number.isFinite(value[key])&&value[key]>=0&&value[key]<=2e9))throw Error('Invalid installation response');
        installation=value;if(action==='download')savedBox.checked=false;return value;
      }catch{if(!destroyed&&installation?.status!=='installing')installError=true;return null;}
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
    button.onclick=open;checkButton.onclick=()=>check({manual:true});later.onclick=()=>close(true);release.onclick=external;download.onclick=event=>{if(canInstall()){event.preventDefault();installRequest('download');}else external(event);};
    savedBox.onchange=refresh;installButton.onclick=()=>installRequest('install');cancelButton.onclick=()=>installRequest('cancel');
    dialog.addEventListener('cancel',event=>{event.preventDefault();event.stopPropagation();close(true);});dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}});
    dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close(true);}});
    const checkWhenVisible=()=>{if(doc.visibilityState!=='hidden')check({manual:false});};
    refresh();if(host.autoCheck===true){autoTimer=setTimeout(()=>{autoTimer=null;checkWhenVisible();},Math.max(0,host.autoDelayMs??1200));repeatTimer=setInterval(checkWhenVisible,3600000);doc.addEventListener('visibilitychange',checkWhenVisible);doc.defaultView?.addEventListener('focus',checkWhenVisible);}
    return {refresh,check,open,close,element:button,dialog,destroy(){if(destroyed)return;close();destroyed=true;serial++;clearTimeout(autoTimer);clearTimeout(installTimer);clearInterval(repeatTimer);doc.removeEventListener('visibilitychange',checkWhenVisible);doc.defaultView?.removeEventListener('focus',checkWhenVisible);controller?.abort();button.remove();dialog.remove();}};
  }
  return {create,normalize,officialURL};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioUpdateCheck;
