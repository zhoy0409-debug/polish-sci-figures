'use strict';
const assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const api=require('../skills/polish-sci-figures/assets/figure-studio/scientific-tiff.js');
const fixture=require('./fixtures/scientific-tiff-uint16.json');
const core=require('../skills/polish-sci-figures/assets/figure-studio/studio.js');
const operations=require('../skills/polish-sci-figures/assets/figure-studio/project-operations.js');
const clone=value=>JSON.parse(JSON.stringify(value));
const dom=new JSDOM();global.DOMParser=dom.window.DOMParser;

(async()=>{
  assert.equal(api.localEndpoint('/api/import-tiff','http://127.0.0.1:19529/'),'/api/import-tiff');
  assert.equal(api.localEndpoint('http://localhost:19529/api/import-tiff','http://localhost:19529/'),'/api/import-tiff');
  for(const [endpoint,href]of [['https://www.ebi.ac.uk/api/import-tiff','http://127.0.0.1:19529/'],['http://127.0.0.1:19530/api/import-tiff','http://127.0.0.1:19529/'],['/api/import-tiff','https://untrusted.invalid/'],['/api/import-tiff','file:///public.html'],['/api/import-tiff?source=private','http://127.0.0.1:19529/'],['//untrusted.invalid/api/import-tiff','http://127.0.0.1:19529/']])assert.equal(api.localEndpoint(endpoint,href),null,'raw TIFF must never be posted to another origin or a hosted page');
  const before=JSON.stringify(fixture),metadata=clone(fixture.metadata);
  const source=api.sourceRecord({name:fixture.name,data:fixture.data,bytes:fixture.bytes,sha256:metadata.fileSha256,metadata});
  const asset=api.asset({name:fixture.name,source,result:clone(fixture.result)});
  asset.id='panel-0';const owner=core.createBlankProject('a'.repeat(20),'PUBLIC native-source regression');
  owner.panels=[asset];owner.scientificSources={[source.sha256]:source};
  assert.equal(api.validateSources(owner),true);assert.equal(await api.verifySources(owner),true);
  assert.equal(api.original(owner,asset),source);
  assert.equal(JSON.stringify(fixture),before,'constructors do not alter actual native/PNG fixtures');

  const originalData=source.data;source.data=(source.data[0]==='A'?'B':'A')+source.data.slice(1);
  await assert.rejects(api.verifySources(owner),/SHA-256/);
  source.data=originalData;assert.equal(await api.verifySources(owner),true,'mutated/corrected record cannot reuse a stale verification promise');

  const tampered=clone(owner),svg=tampered.panels[0].variants[0].svg,png=fixture.result.display.data;
  const changed=png.slice(0,40)+(png[40]==='A'?'B':'A')+png.slice(41);
  tampered.panels[0].variants[0].svg=svg.replace(png,changed);
  await assert.rejects(api.verifySources(tampered),/display failed SHA-256/);
  tampered.panels[0].variants[0].svg=svg.replace('data:image/png;base64,'+png,'https://untrusted.invalid/pixels.png');
  await assert.rejects(api.verifySources(tampered),/Invalid scientific TIFF display PNG/);

  const resizedCount=clone(owner),stored=resizedCount.scientificSources[source.sha256];
  await api.verifySources(resizedCount);stored.bytes--;stored.metadata.fileBytes--;
  if(stored.data.length===Math.ceil(stored.bytes/3)*4)await assert.rejects(api.verifySources(resizedCount),/byte count/);
  else assert.throws(()=>api.validateSources(resizedCount),/source record/);

  const two=clone(owner);two.panels.push({...clone(asset),id:'panel-1'});
  assert.equal(Object.keys(two.scientificSources).length,1);
  assert.equal(JSON.stringify(two).split(source.data).length-1,1,'two views share one original byte record');
  const report=await operations.inspect({project:owner,state:owner.initialState});
  assert.ok(!JSON.stringify(report).includes(source.data),'local operation inspection omits original TIFF bytes');
  assert.ok(!JSON.stringify(report).includes(png),'local operation inspection omits display PNG bytes');

  const invalid=clone(owner);invalid.panels[0].analysis.scientificImage.display.window=[0,Infinity];
  assert.throws(()=>api.validateSources(invalid),/display record/);
  const injection=clone(fixture.result);injection.display.data='"/><script>unsafe</script>';
  assert.throws(()=>api.asset({name:fixture.name,source,result:injection}),/incomplete/);
  const stale=clone(fixture.result);stale.metadata.fileSha256='0'.repeat(64);
  assert.throws(()=>api.asset({name:fixture.name,source,result:stale}),/does not match/);
  assert.equal(await api.verifySources(owner),true);
  assert.equal(source.data,fixture.data);
  dom.window.close();console.log('PASS native TIFF source/display integrity, async verification, tamper rejection, shared-original storage and scoped-operation privacy');
})().catch(error=>{console.error(error);process.exitCode=1;});
