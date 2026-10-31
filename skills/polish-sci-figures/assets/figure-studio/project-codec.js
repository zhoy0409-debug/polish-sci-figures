/* Local JSON processing. The Worker performs no storage or network operations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioProjectCodec=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_BYTES=200000000,FALLBACK_BYTES=4000000;
  function workerMain(){
    self.onmessage=async event=>{
      const {action,value,limit}=event.data;
      try{
        let result;
        if(action==='serialize'){
          const text=JSON.stringify(value);
          if(typeof text!=='string')throw Error('The project is not JSON serializable');
          result=new Blob([text],{type:'application/json'});
          if(result.size>limit){const error=Error('Project size limit');error.code='project_size_limit';throw error;}
        }else if(action==='parse'){
          if(value.size>limit){const error=Error('Project size limit');error.code='project_size_limit';throw error;}
          result=JSON.parse(await value.text());
        }else throw Error('Unsupported project operation');
        self.postMessage({ok:true,value:result});
      }catch(error){self.postMessage({ok:false,error:error.message,code:error.code||'project_processing_failed'});}
    };
  }
  function smallPayload(value){
    const stack=[value],seen=new Set();let bytes=0,items=0;
    while(stack.length){
      if(++items>100000)return false;
      const item=stack.pop();
      if(typeof item==='string'){bytes+=item.length*3;if(bytes>FALLBACK_BYTES)return false;}
      else if(item&&typeof item==='object'&&!seen.has(item)){seen.add(item);for(const key of Object.keys(item)){bytes+=key.length*3;stack.push(item[key]);}}
    }
    return bytes<=FALLBACK_BYTES;
  }
  function create(dependencies={}){
    const WorkerType=Object.hasOwn(dependencies,'Worker')?dependencies.Worker:globalThis.Worker;
    const urls=dependencies.URL||globalThis.URL,BlobType=dependencies.Blob||globalThis.Blob;
    let active=0;
    function errorFor(code,message,locale){
      if(code==='project_size_limit')message=locale==='en'?'Project exceeds 200 MB. Split the project before saving.':'工程超过 200 MB，请拆分工程后保存。';
      if(code==='project_worker_unavailable')message=locale==='en'?'Background project processing is unavailable. Use a current Edge or Chrome browser.':'无法完成后台工程处理，请使用当前版本 Edge 或 Chrome 后重试。';
      const error=new Error(message);error.code=code;return error;
    }
    function run(action,value,options={}){
      return new Promise((resolve,reject)=>{
        const limit=options.limit??MAX_BYTES,signal=options.signal;
        const aborted=()=>{const error=new Error('Project processing cancelled');error.name='AbortError';return error;};
        if(!Number.isSafeInteger(limit)||limit<=0||limit>MAX_BYTES)return reject(Error('Invalid project size limit'));
        if(signal?.aborted)return reject(aborted());
        if(action==='parse'&&(!value||typeof value.text!=='function'||!Number.isSafeInteger(value.size)||value.size<0))return reject(Error('A local project file is required'));
        if(action==='parse'&&value.size>limit)return reject(errorFor('project_size_limit','',options.locale));
        if(typeof WorkerType!=='function'){
          if(action==='parse'&&value.size>FALLBACK_BYTES||action==='serialize'&&!smallPayload(value))return reject(errorFor('project_worker_unavailable','',options.locale));
          try{
            if(action==='serialize'){
              const text=JSON.stringify(value);if(typeof text!=='string')throw Error('The project is not JSON serializable');
              const blob=new BlobType([text],{type:'application/json'});if(blob.size>limit)throw errorFor('project_size_limit','',options.locale);
              resolve(blob);
            }else Promise.resolve(value.text()).then(text=>{if(signal?.aborted)throw aborted();return JSON.parse(text);}).then(resolve,reject);
          }catch(error){reject(error);}
          return;
        }
        if(active>=2)return reject(Error('Two project operations are already running. Wait for one to finish.'));
        let worker,url,finished=false,counted=false;
        const cleanup=()=>{signal?.removeEventListener('abort',onAbort);worker?.terminate();if(url)urls.revokeObjectURL(url);if(counted){active--;counted=false;}};
        const finish=(ok,result)=>{if(finished)return;finished=true;cleanup();(ok?resolve:reject)(result);};
        const onAbort=()=>finish(false,aborted());
        try{
          url=urls.createObjectURL(new BlobType(['('+workerMain.toString()+')()'],{type:'application/javascript'}));
          worker=new WorkerType(url);active++;counted=true;
          worker.onmessage=event=>{
            const message=event.data;
            if(signal?.aborted)return onAbort();
            if(!message?.ok)return finish(false,errorFor(message?.code||'project_processing_failed',message?.error||'Project processing failed',options.locale));
            if(action==='serialize'&&(!(message.value instanceof BlobType)||message.value.size>limit))return finish(false,errorFor('project_size_limit','',options.locale));
            finish(true,message.value);
          };
          worker.onerror=event=>{event.preventDefault?.();finish(false,errorFor('project_worker_unavailable',event.message,options.locale));};
          worker.onmessageerror=()=>finish(false,Error('Project processing response could not be cloned'));
          signal?.addEventListener('abort',onAbort,{once:true});
          if(signal?.aborted){onAbort();return;}
          // postMessage takes the immutable snapshot now, before this call
          // returns. Later edits cannot be marked as part of this download.
          worker.postMessage({action,value,limit});
        }catch(error){finish(false,error);}
      });
    }
    return Object.freeze({serialize:(value,options)=>run('serialize',value,options),parse:(file,options)=>run('parse',file,options),active:()=>active});
  }
  const instance=create();return Object.freeze({MAX_BYTES,FALLBACK_BYTES,create,...instance});
});
