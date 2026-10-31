'use strict';
const assert=require('node:assert/strict');
const Codec=require('../skills/polish-sci-figures/assets/figure-studio/project-codec.js');
(async()=>{
  const codec=Codec.create({Worker:null});
  const input={project:{id:'图像',schemaVersion:1,scientificSources:{s:{data:'QUJD'}}},state:{caption:'µm 实验组'},history:{states:[{a:1}],index:0}};
  const promise=codec.serialize(input),expected=JSON.parse(JSON.stringify(input));input.state.caption='later';
  const blob=await promise;assert.equal(blob.type,'application/json');assert.equal(await blob.text(),JSON.stringify(expected));assert.deepEqual(await codec.parse(blob),expected);
  await assert.rejects(codec.serialize(expected,{limit:3}),{code:'project_size_limit'});
  await assert.rejects(codec.parse(new Blob(['{bad'])),SyntaxError);
  await assert.rejects(codec.parse(new Blob(['12345']),{limit:4}),{code:'project_size_limit'});
  await assert.rejects(codec.parse({size:2}),/local project file/);
  await assert.rejects(codec.serialize(undefined),/serializable/);
  const circular={};circular.loop=circular;await assert.rejects(codec.serialize(circular),TypeError);
  const large={data:'x'.repeat(Codec.FALLBACK_BYTES)};await assert.rejects(codec.serialize(large),{code:'project_worker_unavailable'});
  await assert.rejects(codec.parse(new Blob(['x'.repeat(Codec.FALLBACK_BYTES+1)])),{code:'project_worker_unavailable'});
  const controller=new AbortController();controller.abort();await assert.rejects(codec.serialize(input,{signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(codec.parse(blob,{signal:controller.signal}),{name:'AbortError'});
  await assert.rejects(codec.serialize(input,{limit:Codec.MAX_BYTES+1}),/size limit/);assert.equal(codec.active(),0);

  let created=0,revoked=0,terminated=0;
  const fakeUrls={createObjectURL:()=>{created++;return 'blob:local';},revokeObjectURL:()=>revoked++};
  class PendingWorker{postMessage(){}terminate(){terminated++;}}
  const pending=Codec.create({Worker:PendingWorker,URL:fakeUrls}),c1=new AbortController(),c2=new AbortController();
  const p1=pending.serialize(input,{signal:c1.signal}),p2=pending.serialize(input,{signal:c2.signal});
  assert.equal(pending.active(),2);await assert.rejects(pending.serialize(input),/already running/);
  c1.abort();c2.abort();await assert.rejects(p1,{name:'AbortError'});await assert.rejects(p2,{name:'AbortError'});
  assert.equal(pending.active(),0);assert.equal(created,2);assert.equal(revoked,2);assert.equal(terminated,2);
  class BrokenWorker{postMessage(){throw Error('clone failed');}terminate(){terminated++;}}
  await assert.rejects(Codec.create({Worker:BrokenWorker,URL:fakeUrls}).serialize(input),/clone failed/);
  assert.equal(created,revoked);assert.equal(created,terminated);
  console.log('PASS local JSON codec: exact UTF-8 snapshot, legacy schema, byte limits, unavailable-worker refusal, malformed input, abort, concurrency and resource cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
