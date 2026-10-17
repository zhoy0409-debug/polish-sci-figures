/* QA-only native network evidence. No interception, replay, progress generation
 * or retained request/image payloads. Enable and body reads share one CDP agent. */
'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const sha=value=>createHash('sha256').update(value).digest('hex');
const NETWORK_CAPTURE_BUDGET=Object.freeze({maxTotalBufferSize:96*1024*1024,maxResourceBufferSize:48*1024*1024,maxPostDataSize:48*1024*1024});
async function configureNetworkCapture(session){
 const acknowledgment=await session.send('Network.enable',{...NETWORK_CAPTURE_BUDGET});
 assert.ok(acknowledgment&&typeof acknowledgment==='object'&&!Array.isArray(acknowledgment),'Chrome must acknowledge the bounded network capture configuration');
 return{protocol:'CDP Network.enable + same-session Network.getResponseBody',parameters:{...NETWORK_CAPTURE_BUDGET},acknowledged:true,acknowledgmentKeys:Object.keys(acknowledgment),scope:'The same CDP session configures bounded buffers and reads native response bodies. No requests are replayed or mocked. This instrumentation adds overhead and is outside the fixed-protocol performance benchmark.'};
}
function createDuplicateNetworkCollector(session,evidence){
 const requests=new Map(),pending=new Set(),jobs=new Map(),unassociated=[],waiters=[];let startOrdinal=0;
 evidence.requests??=[];evidence.progress??=[];evidence.workerFailures??=[];evidence.startAcknowledgments??=[];
 const failure=(request,error)=>{const message=String(error.message||error);evidence.workerFailures.push({action:'response-decode',requestAction:request?.action??null,error:message});request?.waiter?.reject(error);};
 function recordStatus(request,reply){
  const batch=jobs.get(request.jobId);if(!batch){unassociated.push({request,reply});return;}
  if(request.action==='status'&&reply.progress)evidence.progress.push({observedAt:new Date().toISOString(),batch,jobIdSha256:sha(request.jobId),status:reply.status,stage:reply.progress.stage,completed:reply.progress.completed,total:reply.progress.total});
 }
 function resolveStatuses(){for(let i=unassociated.length-1;i>=0;i--)if(jobs.has(unassociated[i].request.jobId)){const item=unassociated.splice(i,1)[0];recordStatus(item.request,item.reply);}}
 session.on('Network.requestWillBeSent',event=>{
  if(new URL(event.request.url).pathname!=='/api/image-duplicates')return;
  let request;try{
   assert.equal(event.request.method,'POST');assert.ok(!requests.has(event.requestId),'Duplicate request ID must not be silently replaced');
   const data=JSON.parse(event.request.postData);assert.ok(['start','status','cancel'].includes(data.action));
   request={action:data.action,images:Array.isArray(data.images)?data.images.length:null,jobId:typeof data.jobId==='string'?data.jobId:null,startOrdinal:data.action==='start'?++startOrdinal:null,httpStatus:null,waiter:null};
   if(data.action==='start')request.waiter=waiters.shift()??null;
   else assert.ok(request.jobId,'A native status/cancel request must carry its actual job ID');
   requests.set(event.requestId,request);
   evidence.requests.push({action:request.action,images:request.images,jobIdSha256:request.jobId?sha(request.jobId):null,requestIdSha256:sha(event.requestId),startOrdinal:request.startOrdinal,observedAt:new Date().toISOString()});
  }catch(error){failure(request,error);}
 });
 session.on('Network.responseReceived',event=>{const request=requests.get(event.requestId);if(request)request.httpStatus=event.response.status;});
 session.on('Network.loadingFinished',event=>{
  const request=requests.get(event.requestId);if(!request)return;
  const task=(async()=>{try{
   assert.ok(Number.isInteger(request.httpStatus),'A body must match its actual responseReceived event');
   const response=await session.send('Network.getResponseBody',{requestId:event.requestId});assert.equal(typeof response.body,'string');
   const reply=JSON.parse(response.base64Encoded?Buffer.from(response.body,'base64').toString('utf8'):response.body);
   if(request.httpStatus!==200||reply.status==='error'){evidence.workerFailures.push({action:request.action,httpStatus:request.httpStatus,status:reply.status??null});throw Error('Native duplicate request was rejected; no retry or bypass is permitted');}
   if(request.action==='start'){
    assert.ok(typeof reply.jobId==='string'&&reply.jobId.length>0,'The real start response must provide its worker job ID');assert.ok(!jobs.has(reply.jobId),'Each real start must have its own actual job ID');jobs.set(reply.jobId,request.startOrdinal);
    const acknowledgment={images:request.images,httpStatus:request.httpStatus,jobIdSha256:sha(reply.jobId),requestIdSha256:sha(event.requestId),batch:request.startOrdinal};evidence.startAcknowledgments.push(acknowledgment);resolveStatuses();request.waiter?.resolve(acknowledgment);
   }else recordStatus(request,reply);
  }catch(error){failure(request,error);}finally{requests.delete(event.requestId);}})();
  pending.add(task);task.finally(()=>pending.delete(task));
 });
 session.on('Network.loadingFailed',event=>{const request=requests.get(event.requestId);if(request){failure(request,Error('Native duplicate request loading failed: '+event.errorText));requests.delete(event.requestId);}});
 return{
  nextStart(timeoutMs=15000){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('The real worker start acknowledgment was not captured')),timeoutMs);waiters.push({resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});});},
  async drain(){while(pending.size)await Promise.all([...pending]);if(unassociated.length){const error=Error('A status/cancel response has no verified real start job ID');failure(null,error);throw error;}assert.deepEqual(evidence.workerFailures,[],'Every native response must be decoded and associated without error');},
  retainedMetadata(){return[...requests.values()].map(({action,images,jobId,startOrdinal})=>({action,images,jobIdSha256:jobId?sha(jobId):null,startOrdinal}));},
 };
}
module.exports={NETWORK_CAPTURE_BUDGET,configureNetworkCapture,createDuplicateNetworkCollector};
