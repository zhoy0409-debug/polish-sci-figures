'use strict';

const {spawn,spawnSync}=require('node:child_process');
const {once}=require('node:events');
const {setTimeout:delay}=require('node:timers/promises');
const {chromium}=require('playwright');
const H=require('./test_studio_carbon_helpers.cjs');
const {assert,fs,path}=H;
const registration='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{51D78749-35EE-43BB-BA21-F79D6A1D5094}_is1';

function run(exe,args,options={}){
  const result=spawnSync(exe,args,{windowsHide:true,encoding:'utf8',timeout:180000,...options});
  if(result.error)throw result.error;
  assert.equal(result.status,0,`Exit ${result.status} from ${path.basename(exe)}. ${result.stderr}`);
}

function installedLocation(){
  const result=spawnSync('reg.exe',['query',registration,'/v','InstallLocation'],{windowsHide:true,encoding:'utf8'});
  if(result.error)throw result.error;
  const match=result.stdout.match(/REG_SZ\s+([^\r\n]+)/);
  return match ? path.resolve(match[1].trim()) : null;
}

async function stop(app){
  if(!app||app.exitCode!==null||app.signalCode!==null)return;
  const exited=once(app,'exit');
  app.kill();
  await exited;
}

async function waitForInstance(app,data){
  const file=path.join(data,'instance.json'),deadline=Date.now()+45000;
  while(Date.now()<deadline){
    if(app.exitCode!==null||app.signalCode!==null)throw Error('Installed launcher exited early');
    if(fs.existsSync(file)){
      const record=JSON.parse(fs.readFileSync(file,'utf8'));
      if(record.pid===app.pid&&Number.isInteger(record.port))return H.localUrl(`http://127.0.0.1:${record.port}/`);
    }
    await delay(250);
  }
  throw Error('Installed launcher did not become ready');
}

async function main(){
  const [previous,target,oldVersion,newVersion,output]=process.argv.slice(2);
  assert(previous&&target&&oldVersion&&newVersion&&output,'Supply old Setup, new Setup, old version, new version and a new proof directory');
  assert.equal(process.platform,'win32');
  assert.equal(installedLocation(),null,'A clean Windows test profile is required');
  const out=path.resolve(output),install=path.join(out,'app'),data=path.join(out,'profile');
  fs.mkdirSync(out);
  const exe=path.join(install,'Figure Studio.exe');
  function setup(file,version){
    run(path.resolve(file),['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART','/NOCLOSEAPPLICATIONS','/STUDIOUPDATE=1','/NOICONS','/TASKS=',
      `/DIR=${install}`,`/LOG=${path.join(out,version+'.log')}`]);
    assert.equal(installedLocation(),install);
    assert.equal(JSON.parse(fs.readFileSync(path.join(install,'build-info.json'),'utf8')).version,version);
  }
  let app,browser,context;
  try{
    setup(previous,oldVersion);
    const start=()=>spawn(exe,['--no-open','--data-dir',data],{cwd:install,windowsHide:true,stdio:'ignore'});
    app=start();
    const origin=await waitForInstance(app,data);
    browser=await chromium.launch();
    const test=await H.browserPage(browser);
    context=test.context;
    const page=test.page;
    await page.goto(origin);
    await H.loadSvg(page,H.pressureSvg(18),'upgrade-fixture.svg');
    await page.locator('#artboard text').getByText('Synthetic interaction fixture',{exact:true}).dblclick();
    const editor=page.locator('.canvas-text-editor');
    await editor.fill('Saved before Windows upgrade');
    await editor.press('Enter');
    const annotation=page.locator('#artboard text').getByText('Saved before Windows upgrade',{exact:true});
    await annotation.waitFor();
    await page.locator('#autosaveStatus').getByText(/已自动保存|Autosaved/).waitFor();
    const old=await H.save(page),backup=path.join(out,'saved-before-upgrade.json');
    fs.writeFileSync(backup,JSON.stringify(old));
    const backupHash=H.sha(fs.readFileSync(backup));
    assert(old.history.index>=2);

    await stop(app);
    app=null;
    setup(target,newVersion);
    const smoke=path.join(out,'self-test');
    run(exe,['--self-test','--data-dir',path.join(out,'smoke-profile'),'--output-dir',smoke],
      {cwd:out,env:{...process.env,PATH:path.join(process.env.SystemRoot,'System32'),PYTHONPATH:'',PYTHONHOME:''}});
    const self=JSON.parse(fs.readFileSync(path.join(smoke,'self-test.json'),'utf8'));
    assert(self.passed&&self.frozen);
    assert.equal(self.localUpdateInfo.currentVersion,newVersion);
    app=start();
    assert.equal(await waitForInstance(app,data),origin);
    await page.goto(origin);
    await annotation.waitFor();
    const next=await H.save(page);
    assert.equal(next.project.id,old.project.id);
    assert.deepEqual(next.project.panels,old.project.panels);
    assert.deepEqual(next.state,old.state);
    assert.deepEqual(next.history,old.history);
    const png=await H.exportBytes(page,'png');
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(H.sha(fs.readFileSync(backup)),backupHash);
    assert.deepEqual(test.errors,[]);
    assert.deepEqual(test.remote,[]);
    const result={from:oldVersion,to:newVersion,installedWithSameIdentity:true,originPreserved:true,
      projectAndHistoryPreserved:true,frozenSelfTest:true,pngExported:true,backupSha256:backupHash};
    fs.writeFileSync(path.join(out,'official-upgrade-result.json'),JSON.stringify(result,null,2));
    console.log(JSON.stringify(result));
  }finally{
    await context?.close();
    await browser?.close();
    await stop(app);
    if(installedLocation()===install){
      run(path.join(install,'unins000.exe'),['/VERYSILENT','/SUPPRESSMSGBOXES','/NORESTART']);
      assert.equal(installedLocation(),null);
      assert(fs.existsSync(data),'Uninstall must preserve the test profile');
    }
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
