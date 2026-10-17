/* QA-only CDP buffer contract; no Chrome, network or application access. */
'use strict';
const assert=require('node:assert/strict');
const {NETWORK_CAPTURE_BUDGET,configureNetworkCapture}=require('./test_studio_duplicate_responsiveness_browser.cjs');
const {createDuplicateNetworkCollector}=require('./studio_duplicate_network_capture.cjs');
const {EventEmitter}=require('node:events');
class NativeSession extends EventEmitter{
 constructor(){super();this.calls=[];this.bodies=new Map();this.gates=new Map();}
 async send(method,parameters){this.calls.push({method,parameters});assert.equal(method,'Network.getResponseBody');if(this.gates.has(parameters.requestId))await this.gates.get(parameters.requestId);const value=this.bodies.get(parameters.requestId);if(value instanceof Error)throw value;return value;}
 request(id,data){this.emit('Network.requestWillBeSent',{requestId:id,request:{url:'http://127.0.0.1:1/api/image-duplicates',method:'POST',postData:JSON.stringify(data)}});}
 reply(id,data,{status=200,base64=false}={}){const body=JSON.stringify(data);this.bodies.set(id,{body:base64?Buffer.from(body).toString('base64'):body,base64Encoded:base64});this.emit('Network.responseReceived',{requestId:id,response:{status}});this.emit('Network.loadingFinished',{requestId:id});}
}
async function main(){
 let groups=0;const pass=name=>{groups++;console.log('PASS '+name);};
 assert.deepEqual(NETWORK_CAPTURE_BUDGET,{maxTotalBufferSize:100663296,maxResourceBufferSize:50331648,maxPostDataSize:50331648});
 assert.ok(Object.isFrozen(NETWORK_CAPTURE_BUDGET));pass('capture budgets are bounded, explicit and exceed the unchanged 44 MB endpoint request ceiling');
 let release,returned=false;const calls=[],pending=configureNetworkCapture({send:async(method,parameters)=>{calls.push({method,parameters});await new Promise(resolve=>{release=resolve;});return{};}}).then(proof=>{returned=true;return proof;});
 await Promise.resolve();assert.equal(returned,false);assert.deepEqual(calls,[{method:'Network.enable',parameters:{...NETWORK_CAPTURE_BUDGET}}]);release();const proof=await pending;
 assert.equal(returned,true);assert.equal(proof.acknowledged,true);assert.deepEqual(proof.parameters,NETWORK_CAPTURE_BUDGET);assert.deepEqual(proof.acknowledgmentKeys,[]);pass('actual Network.enable acknowledgment is awaited before capture may proceed');
 proof.parameters.maxTotalBufferSize=1;assert.equal(NETWORK_CAPTURE_BUDGET.maxTotalBufferSize,100663296);pass('returned metadata cannot mutate the next capture budget');
 await assert.rejects(configureNetworkCapture({send:async()=>{throw Error('synthetic CDP rejected');}}),/synthetic CDP rejected/);pass('a protocol rejection blocks capture rather than silently weakening evidence');
 for(const value of [undefined,null,[],true])await assert.rejects(configureNetworkCapture({send:async()=>value}),/acknowledge/);pass('missing or malformed acknowledgment cannot be reported as a successful configuration');
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence),started=collector.nextStart();session.request('native-start-1',{action:'start',images:[{data:'PRIVATE-SYNTHETIC-DATA-DO-NOT-RETAIN'}]});
  assert.ok(!JSON.stringify(collector.retainedMetadata()).includes('PRIVATE'));session.reply('native-start-1',{jobId:'actual-job-A'},{base64:true});assert.equal((await started).batch,1);
  session.request('native-status-1',{action:'status',jobId:'actual-job-A'});session.reply('native-status-1',{status:'running',progress:{stage:'pairs',completed:3,total:1770}});await collector.drain();
  assert.equal(evidence.progress[0].batch,1);assert.equal(evidence.progress[0].completed,3);assert.ok(!JSON.stringify(evidence).includes('actual-job-A'));assert.ok(!JSON.stringify(evidence).includes('PRIVATE'));assert.deepEqual(session.calls.map(c=>c.parameters.requestId),['native-start-1','native-status-1']);pass('same-session reads match real request IDs, decode base64 and retain only metadata/hash rather than source payloads');
 }
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence);let release;session.gates.set('slow-start',new Promise(resolve=>{release=resolve;}));const started=collector.nextStart();session.request('slow-start',{action:'start',images:[{},{}]});session.reply('slow-start',{jobId:'slow-actual-job'});
  session.request('early-status',{action:'status',jobId:'slow-actual-job'});session.reply('early-status',{status:'running',progress:{stage:'pairs',completed:9,total:1770}});await Promise.resolve();await Promise.resolve();assert.equal(evidence.progress.length,0,'No batch may be guessed before its native start is decoded');release();await started;await collector.drain();assert.equal(evidence.progress[0].batch,1);assert.equal(evidence.progress[0].completed,9);pass('a native status body that decodes before start is deferred until its exact real job ID is verified');
 }
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence);let release;session.gates.set('first-request',new Promise(resolve=>{release=resolve;}));session.request('first-request',{action:'start',images:[{},{}]});session.reply('first-request',{jobId:'first-job'});session.request('second-request',{action:'start',images:[{},{},{}]});session.reply('second-request',{jobId:'second-job'});await Promise.resolve();release();await collector.drain();assert.equal(evidence.startAcknowledgments.find(a=>a.images===2).batch,1);assert.equal(evidence.startAcknowledgments.find(a=>a.images===3).batch,2);pass('start ordinals are fixed at native request time even when responses decode out of order');
 }
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence);session.request('unknown-status',{action:'status',jobId:'never-started'});session.reply('unknown-status',{status:'running',progress:{completed:1,total:1770}});await assert.rejects(collector.drain(),/no verified real start/);assert.equal(evidence.progress.length,0);assert.equal(evidence.workerFailures.length,1);pass('an unknown real job ID remains a failure after drain and is never assigned an observed batch');
 }
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence),started=collector.nextStart();const rejected=assert.rejects(started,/rejected/);session.request('busy',{action:'start',images:[{},{}]});session.reply('busy',{error:'already running'},{status:400});await rejected;await assert.rejects(collector.drain());assert.equal(evidence.startAcknowledgments.length,0);pass('a rejected native start is an immediate failure without retries or invented acknowledgment');
 }
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence),started=collector.nextStart();const rejected=assert.rejects(started,/synthetic body eviction/);session.request('evicted',{action:'start',images:[{},{}]});session.bodies.set('evicted',Error('synthetic body eviction'));session.emit('Network.responseReceived',{requestId:'evicted',response:{status:200}});session.emit('Network.loadingFinished',{requestId:'evicted'});await rejected;await assert.rejects(collector.drain());assert.equal(evidence.startAcknowledgments.length,0);pass('body protocol failures reject the actual start promise and cannot be discarded');
 }
 {
  const session=new NativeSession(),evidence={},collector=createDuplicateNetworkCollector(session,evidence);session.request('missing-response',{action:'status',jobId:'no-job'});session.bodies.set('missing-response',{body:'{}',base64Encoded:false});session.emit('Network.responseReceived',{requestId:'different-id',response:{status:200}});session.emit('Network.loadingFinished',{requestId:'missing-response'});await assert.rejects(collector.drain());assert.equal(session.calls.length,0);pass('mismatched responseReceived/loadingFinished IDs cannot authorize a body read');
 }
 console.log('PASS '+groups+' bounded duplicate-network-capture QA contracts; no browser was launched.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
