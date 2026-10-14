'use strict';
// Actual UI module; no downloads or process launches. The Python companion
// tests exercise streaming/checksums and the installer handoff separately.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const Updates=require('../skills/polish-sci-figures/assets/figure-studio/update-check.js');
const root=path.resolve(__dirname,'..'),official='https://github.com/zhoy0409-debug/polish-sci-figures/releases';
const info={currentVersion:'0.1.9',platform:'windows',architecture:'x86_64',channel:'stable',inAppInstall:true};
const available={...info,status:'update-available',latestVersion:'0.2.0',downloadUrl:official+'/download/v1.5.0/polish-sci-figures-Studio-0.2.0-Setup-x64.exe',releaseUrl:official+'/tag/v1.5.0'};
assert.equal(Updates.normalize({...available,inAppInstall:true},{...info,inAppInstall:false}).inAppInstall,false,'server capability is authoritative over release metadata');
const app=fs.readFileSync(path.join(root,'desktop/figure_studio_app.py'),'utf8'),installer=fs.readFileSync(path.join(root,'desktop/FigureStudio.iss'),'utf8');
assert.match(app,/from windows_updater import WindowsUpdater, registered_install/,'PyInstaller follows the explicit updater import');
assert.match(app,/from windows_updater import apply_handoff/);assert.match(installer,/Check: NotStudioUpdate/);assert.match(installer,/\{param:STUDIOUPDATE\|0\}/);
console.log('PASS installed updater capability and packaged launcher/installer contract');
if(process.argv.includes('--dom'))(async()=>{
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html><html><head></head><body><header></header><input id="project" value="private"></body></html>',{url:'http://127.0.0.1:18767/'}),doc=dom.window.document;
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  const tick=()=>new Promise(resolve=>setTimeout(resolve,0)),wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  let calls=[],external=[],language='en',next={status:'idle',supported:true,received:0,total:1000000};
  const host={document:doc,container:doc.querySelector('header'),language:()=>language,info,check:async()=>available,installPollMs:100,installTimeoutMs:100,installUpdate:async action=>{calls.push(action);return next;},openExternal:url=>{external.push(url);return true;}};
  const ui=Updates.create(host),q=s=>ui.dialog.querySelector(s);assert.deepEqual(calls,[]);
  ui.open();await ui.check();await tick();assert.deepEqual(calls,['status'],'opening never downloads or installs');assert.equal(q('.update-download').textContent,'Download and prepare update');
  next={...next,status:'downloading',received:250000};q('.update-download').click();await tick();assert.equal(calls.at(-1),'download');assert.deepEqual(external,[],'installed update stays within authenticated local updater');assert.equal(q('progress').value,250000);assert.equal(q('progress').max,1000000);assert.equal(q('#studioCancelUpdateDownload').hidden,false);assert.equal(q('#studioInstallUpdate').hidden,true);
  next={...next,status:'ready'};await wait(125);assert.equal(calls.at(-1),'status');assert.equal(q('#studioInstallUpdate').hidden,false);assert.equal(q('#studioInstallUpdate').disabled,true);assert.equal(q('#studioUpdateSaved').checked,false);assert.match(ui.dialog.textContent,/Update verified/);
  q('#studioInstallUpdate').click();await tick();assert.equal(calls.includes('install'),false,'download completion alone cannot install');
  q('#studioUpdateSaved').checked=true;q('#studioUpdateSaved').dispatchEvent(new dom.window.Event('change'));assert.equal(q('#studioInstallUpdate').disabled,false);
  next={...next,status:'preparing'};q('#studioInstallUpdate').click();q('#studioInstallUpdate').click();await tick();assert.equal(calls.filter(a=>a==='install').length,1,'one explicit confirmation produces one installation');assert.match(ui.dialog.textContent,/Preserving the previous version/);assert.equal(q('.update-download').hidden,true);assert.equal(doc.getElementById('project').value,'private');
  language='zh-CN';ui.refresh();assert.match(ui.dialog.textContent,/安全或权限提示/);assert.match(ui.dialog.textContent,/保存/);ui.destroy();const count=calls.length;await wait(150);assert.equal(calls.length,count,'destroy stops installation polling');
  calls=[];next={status:'downloading',supported:true,received:1,total:10};let ui2=Updates.create(host);ui2.open();await ui2.check();await tick();next={...next,status:'cancelled'};ui2.dialog.querySelector('#studioCancelUpdateDownload').click();await tick();assert.equal(calls.at(-1),'cancel');assert.match(ui2.dialog.textContent,/已取消/);assert.equal(ui2.dialog.querySelector('.update-download').hidden,false);ui2.destroy();
  const broken=Updates.create({...host,installUpdate:async()=>({status:'ready',supported:true,received:Infinity})});broken.open();await broken.check();await tick();assert.equal(broken.dialog.querySelector('.update-error').hidden,false);assert.equal(broken.dialog.querySelector('#studioInstallUpdate').hidden,true);broken.destroy();
  const hung=Updates.create({...host,installUpdate:()=>new Promise(()=>{})});hung.open();await hung.check();await wait(130);assert.equal(hung.dialog.querySelector('.update-error').hidden,false,'a hung status request has a finite UI deadline');hung.destroy();
  calls=[];language='en';const portable=Updates.create({...host,info:{...info,inAppInstall:false}});portable.open();await portable.check();portable.dialog.querySelector('.update-download').click();await tick();assert.deepEqual(calls,[]);assert.equal(external.at(-1),available.downloadUrl);assert.match(portable.dialog.textContent,/portable or unregistered/);portable.destroy();
  const macInfo={currentVersion:'0.1.9',platform:'macos',architecture:'arm64',channel:'preview'},mac=Updates.create({...host,info:macInfo,check:async()=>({...available,...macInfo,downloadUrl:official+'/download/preview/polish-sci-figures-Studio-0.2.0-macOS-arm64-Preview.zip'})});mac.open();await mac.check();assert.match(mac.dialog.textContent,/manual app replacement/);assert.equal(mac.dialog.querySelector('#studioInstallUpdate').hidden,true);mac.destroy();
  const ios=Updates.create({...host,info:{...info,platform:'ios'}});ios.open();await ios.check();assert.equal(ios.dialog.querySelector('.update-download').hidden,true);assert.equal(ios.dialog.querySelector('#studioInstallUpdate').hidden,true);ios.destroy();
  dom.window.close();console.log('PASS installed update UI: explicit download, progress, separate saved-project confirmation, single install, cancellation, finite failures, teardown and portable/Mac/iOS boundaries');
})().catch(error=>{console.error(error);process.exit(1);});
