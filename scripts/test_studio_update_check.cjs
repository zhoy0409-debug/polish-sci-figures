'use strict';
const assert=require('node:assert/strict'),Updates=require('../skills/polish-sci-figures/assets/figure-studio/update-check.js');
const official='https://github.com/zhoy0409-debug/polish-sci-figures/releases',download=official+'/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Setup-x64.exe';
const info={currentVersion:'0.1.6',platform:'windows',architecture:'x86_64',channel:'stable'},available={...info,status:'update-available',latestVersion:'0.1.7',downloadUrl:download,releaseUrl:official+'/tag/v1.4.7'};
assert.equal(Updates.officialURL(download,{download:true}),download);
for(const url of ['https://example.com/update.exe','https://github.com.evil.example/zhoy0409-debug/polish-sci-figures/releases','https://user@github.com/zhoy0409-debug/polish-sci-figures/releases','http://github.com/zhoy0409-debug/polish-sci-figures/releases',official+'/tag/v1?data=private',official+'/download/v1/payload%2eexe',official+'/../../another/releases'])assert.equal(Updates.officialURL(url),null,url);
assert.equal(Updates.normalize(available,info).status,'update-available');
assert.throws(()=>Updates.normalize({...available,downloadUrl:'https://example.com/update.exe'},info));
assert.equal(Updates.normalize({...available,downloadUrl:official+'/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Android-preview.apk'},info).status,'unavailable','A wrong-platform asset is not an update');
assert.equal(Updates.normalize(available,{...info,platform:'ios'}).downloadUrl,null,'Native platform identity overrides returned metadata');
assert.equal(Updates.normalize({...available,downloadUrl:null},info).status,'unavailable','Missing installer must not imply up to date');
assert.equal(Updates.normalize({...available,status:'up-to-date',cached:true,stale:true},info).stale,true);
for(const architecture of ['arm64','x86_64']){const mac={...info,platform:'macos',architecture,channel:'preview'},url=official+'/download/figure-studio-local-preview-20261015/polish-sci-figures-Studio-0.1.7-macOS-'+architecture+'-Preview.zip';assert.equal(Updates.normalize({...available,...mac,downloadUrl:url},mac).downloadUrl,url);assert.equal(Updates.normalize({...available,...mac,downloadUrl:url},{...mac,architecture:architecture==='arm64'?'x86_64':'arm64'}).downloadUrl,null);}
console.log('PASS update metadata: exact official links, trusted current identity, platform/architecture matching, no fake iOS installer, missing packages and stale-cache state');
if(process.argv.includes('--dom'))(async()=>{
  const {JSDOM}=require('jsdom'),dom=new JSDOM('<!doctype html><html><head></head><body><header></header><input id="project-title" value="Private project"></body></html>',{url:'http://127.0.0.1:18767/'}),doc=dom.window.document;
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};dom.window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  let language='en',calls=[],respond=async()=>available,opened=[];
  const host={document:doc,container:doc.querySelector('header'),language:()=>language,info,timeoutMs:100,check:options=>{calls.push(options);return respond(options);},openExternal:url=>{opened.push(url);return true;}};
  const ui=Updates.create(host),button=ui.element,dialog=ui.dialog,query=selector=>dialog.querySelector(selector),tick=()=>new Promise(resolve=>setTimeout(resolve,0));
  assert.equal(calls.length,0,'Creating the control never starts a network request without autoCheck');assert.equal(dialog.open,false);
  button.focus();button.click();await ui.check();assert.equal(calls.length,1,'Opening and checking concurrently share one metadata request');assert.deepEqual(Object.keys(calls[0]),['signal','refresh'],'No project/title/data is passed to the transport');assert.equal(calls[0].refresh,true);assert.equal(doc.querySelector('#project-title').value,'Private project');
  assert.equal(query('.update-download').href,download);assert.equal(query('.update-download').hidden,false);assert.equal(button.querySelector('.studio-update-badge').hidden,false);assert.equal(dialog.open,true);assert.match(dialog.textContent,/0\.1\.7/);assert.doesNotMatch(dialog.textContent,/[\u3400-\u9fff]/);
  query('.update-download').click();await tick();assert.deepEqual(opened,[download]);assert.equal(dialog.open,true,'Downloading does not reset/close the current project');
  query('.update-actions button').click();assert.equal(dialog.open,false);assert.equal(doc.activeElement,button);assert.equal(button.querySelector('.studio-update-badge').hidden,true,'Later quietly snoozes this version');
  await ui.check({manual:false});assert.equal(dialog.open,false,'Background checks never open a dialog');assert.equal(button.querySelector('.studio-update-badge').hidden,true);
  button.click();await ui.check();assert.equal(button.querySelector('.studio-update-badge').hidden,false,'Explicit checking is not hidden by a previous snooze');
  language='zh-CN';ui.refresh();assert.equal(button.textContent,'更新');assert.match(dialog.textContent,/发现新版本/);assert.match(dialog.textContent,/不发送工程、图片或研究数据/);
  respond=async()=>({...available,status:'up-to-date'});await ui.check();assert.equal(query('.update-download').hidden,true);assert.equal(query('.update-download').hasAttribute('href'),false);assert.match(dialog.textContent,/已是当前渠道/);
  respond=async()=>({...available,cached:true,stale:true});await ui.check();assert.match(dialog.textContent,/上次成功检查/);assert.equal([...dialog.querySelectorAll('p')].find(p=>p.textContent.includes('上次成功检查')).hidden,false);
  respond=async()=>{throw Error('offline');};await ui.check();assert.match(dialog.textContent,/暂时无法检查更新/);assert.equal(query('.update-download').hidden,true);assert.equal(query('.update-actions button:nth-child(2)').disabled,false,'Offline checking cannot lock editing or retry');
  respond=()=>new Promise(()=>{});await ui.check();assert.match(dialog.textContent,/暂时无法检查更新/,'A nonresponsive native/network operation has a finite UI deadline');
  dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(dialog.open,false);
  const beforeAuto=calls.length;await ui.check({manual:false});assert.equal(calls.length,beforeAuto,'Automatic checks are limited to once per day');
  respond=async()=>available;ui.open();const pending=ui.check();ui.destroy();await pending;assert.equal(doc.getElementById('studioUpdateDialog'),null);assert.equal(doc.getElementById('studioCheckUpdates'),null);
  const ios=Updates.create({...host,info:{currentVersion:'0.1.6',platform:'ios',channel:'preview'},check:async()=>available});ios.open();await ios.check();assert.equal(ios.dialog.querySelector('.update-download').hidden,true);assert.match(ios.dialog.textContent,/暂无可直接安装/);ios.destroy();
  const initialRequests=calls.length,auto=Updates.create({...host,info:{...info,currentVersion:'0.0.1'},autoCheck:true,autoDelayMs:0});await new Promise(resolve=>setTimeout(resolve,15));assert.equal(calls.length,initialRequests+1);assert.equal(auto.dialog.open,false);auto.destroy();
  // Reopening the app must retain a previously discovered update even though
  // its next automatic request is throttled. Only metadata uses this storage.
  const cache=new Map(),storage={getItem:key=>cache.get(key)||null,setItem:(key,value)=>cache.set(key,value)};
  let clock=1700000000000,automaticRequests=0,visibility='visible',nextReply=async()=>available;
  Object.defineProperty(doc,'visibilityState',{configurable:true,get:()=>visibility});
  const recurringHost={...host,storage,language:()=> 'en',now:()=>clock,autoCheck:true,autoDelayMs:0,check:options=>{automaticRequests++;assert.deepEqual(Object.keys(options),['signal','refresh']);return nextReply(options);}};
  const settle=()=>new Promise(resolve=>setTimeout(resolve,15)),badgeHidden=u=>u.element.querySelector('.studio-update-badge').hidden;
  let recurring=Updates.create(recurringHost);await settle();assert.equal(automaticRequests,1);assert.equal(badgeHidden(recurring),false);assert.equal(recurring.dialog.open,false);
  const record=[...cache.values()].map(JSON.parse)[0];assert.equal(record.result.latestVersion,'0.1.7');assert.equal(record.result.downloadUrl,download);assert.equal(record.lastAutoCheck,clock);assert.equal(JSON.stringify(record).includes('Private project'),false);
  recurring.destroy();recurring=Updates.create(recurringHost);assert.equal(badgeHidden(recurring),false,'cached update badge is restored before any request');await settle();assert.equal(automaticRequests,1,'restart inside 24 hours reuses trusted metadata');
  for(let i=0;i<3;i++){dom.window.dispatchEvent(new dom.window.Event('focus'));doc.dispatchEvent(new dom.window.Event('visibilitychange'));}await settle();assert.equal(automaticRequests,1,'focus and visibility changes respect the same daily throttle');
  recurring.element.click();await recurring.check();assert.equal(automaticRequests,2,'manual check bypasses the automatic throttle');recurring.dialog.querySelector('.update-actions button').click();assert.equal(badgeHidden(recurring),true);recurring.destroy();
  recurring=Updates.create(recurringHost);await settle();assert.equal(automaticRequests,2);assert.equal(badgeHidden(recurring),true,'Later survives closing and reopening the application');
  clock+=23*3600000;dom.window.dispatchEvent(new dom.window.Event('focus'));await settle();assert.equal(automaticRequests,2);clock+=2*3600000;visibility='hidden';doc.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(automaticRequests,2,'a hidden application does not check');visibility='visible';doc.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(automaticRequests,3);assert.equal(badgeHidden(recurring),false,'a remembered snooze expires without hiding future reminders forever');assert.equal(recurring.dialog.open,false);
  // Simultaneous focus and visibility events share one in-flight request.
  clock+=25*3600000;let finish;nextReply=()=>new Promise(resolve=>{finish=resolve;});dom.window.dispatchEvent(new dom.window.Event('focus'));doc.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(automaticRequests,4);finish(available);await recurring.check({manual:false});assert.equal(recurring.dialog.open,false);
  const callsBeforeDestroy=automaticRequests;recurring.destroy();clock+=25*3600000;dom.window.dispatchEvent(new dom.window.Event('focus'));doc.dispatchEvent(new dom.window.Event('visibilitychange'));await settle();assert.equal(automaticRequests,callsBeforeDestroy,'destroy unregisters both automatic event handlers');
  // Cached metadata is revalidated, including exact platform and URL boundaries.
  for(const [key,value]of cache){const state=JSON.parse(value);state.result.downloadUrl='https://example.invalid/stolen.exe';cache.set(key,JSON.stringify(state));}
  const poisoned=Updates.create({...recurringHost,autoCheck:false});assert.equal(badgeHidden(poisoned),true);poisoned.open();assert.equal(poisoned.dialog.querySelector('.update-download').hasAttribute('href'),false);poisoned.destroy();await settle();
  nextReply=async()=>available;const upgraded=Updates.create({...recurringHost,info:{...info,currentVersion:'0.1.7'},autoCheck:false});assert.equal(badgeHidden(upgraded),true,'different installed versions use separate metadata cache keys');upgraded.destroy();
  // Hourly wake-up is only a trigger; the shared 24-hour check remains the gate.
  const originalSetInterval=global.setInterval,originalClearInterval=global.clearInterval;let intervalCall,clearedInterval=false,hourly;
  try{global.setInterval=(callback,delay)=>{assert.equal(delay,3600000);intervalCall=callback;return 67890;};global.clearInterval=id=>{if(id===67890)clearedInterval=true;else originalClearInterval(id);};hourly=Updates.create({...recurringHost,storage:{getItem:()=>null,setItem:()=>{}},autoDelayMs:100000});const count=automaticRequests;intervalCall();await hourly.check({manual:false});assert.equal(automaticRequests,count+1);assert.equal(hourly.dialog.open,false);hourly.destroy();assert.equal(clearedInterval,true);}finally{hourly?.destroy();global.setInterval=originalSetInterval;global.clearInterval=originalClearInterval;}
  dom.window.close();console.log('PASS update UI DOM: manual/background checks, persistent/reopened badge, snooze, daily focus/visibility/hourly triggers, one request, no project inputs, official download, EN/ZH, offline/timeout, cache validation, teardown and iOS unsupported');
})().catch(error=>{console.error(error);process.exitCode=1;});
