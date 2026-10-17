/* Ephemeral visual drafts. This module has no storage, export or history API. */
'use strict';
const StudioPreviewSessions=(()=>{
  const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every((v,i)=>Object.is(v,b[i])):Object.is(a,b);
  function create(host={}){
    const frame=host.requestFrame||globalThis.requestAnimationFrame?.bind(globalThis)||((fn)=>setTimeout(fn,16));
    const unframe=host.cancelFrame||globalThis.cancelAnimationFrame?.bind(globalThis)||clearTimeout;
    let active=null,serial=0;
    const identity=()=>host.identity?.();
    function begin(spec){
      if(typeof spec?.render!=='function'||typeof spec.restore!=='function'||typeof spec.commit!=='function')throw Error('A preview needs render, restore and commit callbacks');
      host.beforeBegin?.(spec.kind||'visual');
      active?.cancel('replaced');
      const captured=identity(),id='preview-'+(++serial);let phase='previewing',reason='',error='',revision=0,lastValue,hasValue=false,queued=false,queuedValue,frameId=null,controller=new AbortController(),pending=null,timer=null,resolvePending=null,ending=false;
      const session={id,kind:spec.kind||'visual',get status(){return phase;},get error(){return error;},get value(){return lastValue;},get originalValue(){return spec.originalValue;},get revision(){return revision;},get pending(){return !!pending;},get hasDraft(){return hasValue||queued;}};
      const current=()=>active===session;
      const valid=()=>current()&&same(captured,identity())&&spec.valid?.()!==false;
      const meta=(version=revision,signal=controller.signal)=>({id,kind:session.kind,revision:version,signal,originalValue:spec.originalValue,isCurrent:()=>current()&&revision===version&&!signal.aborted&&valid()});
      const snapshot=()=>({id,kind:session.kind,status:phase,error,reason,revision,pending:!!pending,hasDraft:hasValue||queued});
      function emit(){const value=snapshot();spec.onState?.(value);host.onState?.(value);}
      function stopWork(){
        controller.abort();controller=new AbortController();revision++;
        if(frameId!==null)unframe(frameId);frameId=null;queued=false;
        if(timer!==null)clearTimeout(timer);timer=null;
        const resolve=resolvePending;resolvePending=null;pending=null;resolve?.(false);
      }
      function usable(){if(!current()||ending)return false;try{if(valid())return true;}catch{}session.invalidate('context-changed');return false;}
      function restore(why){try{spec.restore(why,meta());return true;}catch(e){error=e?.message||String(e);spec.onError?.(error);return false;}}
      function fail(cause){
        error=cause?.message||String(cause||'Preview unavailable');phase='error';
        // Renderers must validate before swapping live nodes. Restore the last
        // successful value too, covering a renderer which failed mid-update.
        try{if(hasValue)spec.render(lastValue,meta());else spec.restore('preview-error',meta());}catch{restore('preview-error');}
        spec.onError?.(error);emit();return false;
      }
      session.isCurrent=()=>{try{return valid();}catch{return false;}};
      session.flush=()=>{
        if(phase==='committing'||!usable())return false;
        if(!queued)return hasValue&&!error;
        if(frameId!==null)unframe(frameId);frameId=null;const value=queuedValue;queued=false;
        try{if(spec.validate?.(value)===false)throw Error('Invalid preview');spec.render(value,meta());lastValue=value;hasValue=true;error='';phase='previewing';emit();return true;}catch(e){return fail(e);}
      };
      session.repaint=()=>{if(phase==='committing'||!usable()||!hasValue)return false;try{spec.render(lastValue,meta());return true;}catch(e){return fail(e);}};
      session.update=value=>{
        if(phase==='committing'||!usable())return false;stopWork();
        try{if(spec.validate?.(value)===false)throw Error('Invalid preview');}catch(e){return fail(e);}
        queuedValue=value;queued=true;phase='previewing';error='';emit();frameId=frame(()=>{frameId=null;session.flush();});return true;
      };
      session.reject=message=>{if(phase==='committing'||!usable())return false;stopWork();return fail(message);};
      session.request=(draft,produce,{delayMs=0}={})=>{
        if(phase==='committing'||!usable())return Promise.resolve(false);
        if(typeof produce!=='function')throw Error('A preview producer is required');stopWork();
        const version=revision,signal=controller.signal;phase='pending-heavy';error='';
        pending=new Promise(resolve=>{resolvePending=resolve;});const result=pending;emit();
        const run=async()=>{timer=null;try{
          const value=await produce(draft,meta(version,signal));
          if(!current()||revision!==version||signal.aborted)return;
          if(!usable())return;
          const resolve=resolvePending;resolvePending=null;pending=null;
          queuedValue=value;queued=true;const ok=session.flush();resolve?.(ok);
        }catch(e){if(!current()||revision!==version||signal.aborted)return;const resolve=resolvePending;resolvePending=null;pending=null;const ok=e?.name==='AbortError'?false:fail(e);resolve?.(ok);}};
        timer=setTimeout(run,Math.max(0,Math.min(10000,Number(delayMs)||0)));return result;
      };
      function finish(outcome){phase=outcome;if(!reason)reason=outcome;emit();if(active===session)active=null;phase='idle';emit();spec.onFinish?.(outcome);}
      session.cancel=(why='cancelled')=>{if(!current()||ending)return false;ending=true;stopWork();reason=why;restore(why);finish('cancelled');return true;};
      session.invalidate=(why='context-changed')=>{if(!current()||ending)return false;ending=true;stopWork();reason=why;restore(why);finish('invalidated');return true;};
      let commitPromise=null;
      async function performCommit(){
        if(!usable()||phase==='committing')return false;
        while(pending){await pending;if(!usable()||error)return false;}
        if(queued&&!session.flush()||error)return false;
        if(!hasValue){session.cancel('unchanged');return true;}
        if(spec.equal?.(spec.originalValue,lastValue)){session.cancel('unchanged');return true;}
        phase='committing';emit();const value=lastValue,commitMeta=meta();
        if(!restore('commit')){phase='previewing';return fail(error);}
        try{
          const result=await spec.commit(value,commitMeta);
          if(!current()||commitMeta.signal.aborted)return false;
          if(result===false){phase='previewing';if(!usable())return false;return fail('Changes could not be committed');}
          stopWork();finish('committed');return true;
        }catch(e){if(!current()||commitMeta.signal.aborted)return false;phase='previewing';if(!usable())return false;return fail(e);}
      }
      // Enter, change and blur may arrive together. They share a single final
      // commit even while a heavy preview is still producing its latest draft.
      session.commit=()=>{
        if(commitPromise)return commitPromise;
        commitPromise=performCommit().finally(()=>{commitPromise=null;});
        return commitPromise;
      };
      active=session;emit();return session;
    }
    return {begin,get active(){return active;},sync(){if(!active||active.status==='committing')return true;return active.isCurrent()||(active.invalidate('context-changed'),false);},cancel(reason){return active?.cancel(reason)||false;},invalidate(reason){return active?.invalidate(reason)||false;}};
  }
  return {create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioPreviewSessions;
