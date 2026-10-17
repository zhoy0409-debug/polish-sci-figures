/* Pure installed-browser QA contracts. No Chrome, service or registry access. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const D=require('./test_studio_duplicate_responsiveness_browser.cjs'),L=require('./test_studio_large_import_browser.cjs');
const exe='C:\\QA\\Figure Studio\\Figure Studio.exe',directory='C:\\QA\\Figure Studio';
function views(){return ['CurrentUser','LocalMachine'].flatMap(hive=>['Registry64','Registry32'].map(view=>({hive,view,exists:false,directories:[]})));}
function owned(){const v=views();v[0]={...v[0],exists:true,directories:[{name:'Inno Setup: App Path',value:directory},{name:'InstallLocation',value:directory}]};return v;}
let groups=0;function test(name,run){run();groups++;console.log('PASS '+name);}
test('one exact original AppId registration is sufficient and paths are stripped',()=>{const p=D.registryOwnershipProof(owned(),exe);assert.equal(p.registryOwned,true);assert.equal(p.registryPresentViews,1);assert.equal(p.registryViews.length,4);assert.ok(!JSON.stringify(p).includes('C:'));});
test('Windows directory matching is case insensitive and normalizes trailing separators',()=>{const v=owned();v[0].directories.forEach(d=>d.value='c:/qa/FIGURE STUDIO/');assert.equal(D.registryOwnershipProof(v,exe).registryOwned,true);});
test('multiple owned views remain individually checked',()=>{const v=owned();v[3]={...v[3],exists:true,directories:[{name:'Inno Setup: App Path',value:directory}]};assert.equal(D.registryOwnershipProof(v,exe).registryPresentViews,2);});
test('any foreign directory in any view rejects even with a correct owned view',()=>{const v=owned();v[3]={...v[3],exists:true,directories:[{name:'Inno Setup: App Path',value:'C:\\OTHER\\Studio'}]};assert.throws(()=>D.registryOwnershipProof(v,exe),/another directory/);});
test('all absent registry views reject a portable executable',()=>assert.throws(()=>D.registryOwnershipProof(views(),exe),/not registered/));
test('missing or duplicate views reject incomplete reads',()=>{assert.throws(()=>D.registryOwnershipProof(owned().slice(1),exe));const v=owned();v[3]=v[2];assert.throws(()=>D.registryOwnershipProof(v,exe),/Duplicate registry view/);});
test('an existing original key must contain its actual Inno application path',()=>{const v=owned();v[0].directories=[{name:'InstallLocation',value:directory}];assert.throws(()=>D.registryOwnershipProof(v,exe),/must declare/);});
test('a second conflicting installation field cannot be hidden by the first',()=>{const v=owned();v[0].directories[1].value='C:\\OTHER';assert.throws(()=>D.registryOwnershipProof(v,exe),/another directory/);});
test('relative and unexpanded directories reject',()=>{for(const value of ['relative','%LOCALAPPDATA%\\Studio']){const v=owned();v[0].directories[0].value=value;assert.throws(()=>D.registryOwnershipProof(v,exe),/absolute/);}});
test('capability is an explicit strict boolean expectation',()=>{assert.equal(D.expectedCapability('false'),false);assert.equal(D.expectedCapability('true'),true);for(const value of [undefined,null,'False','yes',false])assert.throws(()=>D.expectedCapability(value));D.checkCapability(false,false);D.checkCapability(true,true);assert.throws(()=>D.checkCapability(false,true));assert.throws(()=>D.checkCapability(true,false));assert.throws(()=>D.checkCapability(undefined,false));});
test('both installed CLI contracts reject an omitted capability expectation',()=>{
 const cache=path.resolve('.cache');fs.mkdirSync(cache,{recursive:true});const dir=fs.mkdtempSync(path.join(cache,'identity-contract-')),html=path.join(dir,'fixture.html');fs.writeFileSync(html,'<html>synthetic contract only</html>');
 const hash=require('node:crypto').createHash('sha256').update(fs.readFileSync(html)).digest('hex'),args=['--env=installed-windows','--url=http://127.0.0.1:18788/','--html='+html,'--expected-html-sha256='+hash,'--expected-version=0.1.22','--fixtures='+dir,'--out='+path.join(dir,'not-created'),'--installed-exe='+exe,'--expected-exe-sha256='+'1'.repeat(64)];
 try{for(const module of [D,L]){assert.throws(()=>module.options(args),/expected-in-app-install/);assert.equal(module.options([...args,'--expected-in-app-install=false']).expectedInAppInstall,false);assert.equal(module.options([...args,'--expected-in-app-install=true']).expectedInAppInstall,true);}}
 finally{fs.unlinkSync(html);fs.rmdirSync(dir);}
});
test('capability false does not waive registry ownership',()=>{D.checkCapability(false,false);const v=owned();v[0].directories[0].value='C:\\OTHER';assert.throws(()=>D.registryOwnershipProof(v,exe),/another directory/);});
if(process.platform==='win32')test('actual PowerShell5 stdout roundtrips an explicit synthetic Unicode path in UTF8',()=>{const value='C:\\SYNTHETIC-QA\\科研图表 Ω\\Figure Studio',result=require('node:child_process').spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command','[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false);ConvertTo-Json -Compress -InputObject @{value=$env:FS_QA_SYNTHETIC_UTF8;codePage=[Console]::OutputEncoding.CodePage}'],{env:{...process.env,FS_QA_SYNTHETIC_UTF8:value},windowsHide:true,encoding:'utf8',timeout:10000});assert.equal(result.status,0);const decoded=JSON.parse(result.stdout);assert.equal(decoded.codePage,65001);assert.equal(decoded.value,value);});
else console.log('SKIP actual Windows PowerShell5 Unicode roundtrip on this platform.');
console.log('PASS '+groups+' installed identity/capability QA contracts; no actual registry, app or browser was used.');
