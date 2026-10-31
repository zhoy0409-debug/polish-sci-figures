'use strict';
// Real local Blob Workers; no fake computational result or native UI claim.
const {chromium}=require('playwright'),H=require('./test_studio_carbon_helpers.cjs');
const {fs,path,assert}=H,url=H.localUrl(process.argv[2]||'http://127.0.0.1:19529/');
const out=path.resolve(process.argv[3]||'.cache/next-stable-windows-20261028/browser-project-codec-r1');fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch(process.env.STUDIO_TIFF_BROWSER==='chromium'?{headless:true}:{channel:process.env.STUDIO_TIFF_BROWSER||'chrome',headless:true}),{context,page,remote,errors}=await H.browserPage(browser);
  try{
    await page.goto(url);await H.dismiss(page);
    const result=await page.evaluate(async()=>{
      const original=window.Worker;let started=0,terminated=0;
      class ObservedWorker extends original{constructor(...args){super(...args);started++;}terminate(){terminated++;return super.terminate();}}
      const codec=StudioProjectCodec.create({Worker:ObservedWorker}),controller=new AbortController();
      const snapshot={project:{id:'中文µm',schemaVersion:1,native:'ABCD'.repeat(4000000)},state:{caption:'before'}},expected=JSON.stringify(snapshot);
      const pending=codec.serialize(snapshot);snapshot.state.caption='later';
      const blob=await pending,text=await blob.text(),parsed=await codec.parse(blob);
      let malformed=false,oversize=false,aborted=false;
      try{await codec.parse(new Blob(['{bad']));}catch(error){malformed=error instanceof Error;}
      try{await codec.serialize({s:'中文'.repeat(100)},{limit:10});}catch(error){oversize=error.code==='project_size_limit';}
      const stop=codec.serialize(snapshot,{signal:controller.signal});controller.abort();try{await stop;}catch(error){aborted=error.name==='AbortError';}
      return {same:text===expected,caption:parsed.state.caption,nativeBytes:parsed.project.native.length,mime:blob.type,malformed,oversize,aborted,active:codec.active(),started,terminated};
    });
    assert.equal(result.same,true);assert.equal(result.caption,'before');assert.equal(result.nativeBytes,16000000);assert.equal(result.mime,'application/json');
    assert.equal(result.malformed,true);assert.equal(result.oversize,true);assert.equal(result.aborted,true);assert.equal(result.active,0);assert.ok(result.started>=5);assert.equal(result.started,result.terminated);
    assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({author:'a',scope:'Real Chrome Blob Workers and production bundle; JSON fidelity/call-time snapshot; not native installation',browser:browser.version(),...result,remoteRequests:remote.length,pageErrors:errors,passed:true},null,2));
    console.log('PASS real Chrome local project codec: 16 MB snapshot, UTF-8 exact, worker parse, limits, malformed JSON, abort/cleanup; no remote requests');
  }finally{await context.close();await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
