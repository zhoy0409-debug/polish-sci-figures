/* Visible-only, cancellable work queue for actual source-based thumbnails. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioDeferredPreviews=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create({items,render,isCurrent,view=globalThis,onError=()=>{}}){
    let stopped=false,pending=null,observer=null;const queue=[],queued=new Set(),done=new Set();
    const schedule=view.requestIdleCallback?fn=>view.requestIdleCallback(fn,{timeout:250}):fn=>view.setTimeout(fn,32),unschedule=view.cancelIdleCallback?value=>view.cancelIdleCallback(value):value=>view.clearTimeout(value);
    function stop(){stopped=true;if(pending!==null)unschedule(pending);pending=null;observer?.disconnect();queue.length=0;queued.clear();}
    function next(){pending=null;if(stopped)return;if(!isCurrent()){stop();return;}const item=queue.shift();if(!item)return;queued.delete(item);if(!done.has(item)){try{render(item);done.add(item);}catch(error){done.add(item);onError(error,item);}}if(queue.length)pending=schedule(next);}
    function enqueue(item){if(stopped||done.has(item)||queued.has(item))return;queue.push(item);queued.add(item);if(pending===null)pending=schedule(next);}
    function observe(){if(view.IntersectionObserver){observer=new view.IntersectionObserver(entries=>{if(!isCurrent())return stop();for(const entry of entries)if(entry.isIntersecting){const item=items.find(item=>item.element===entry.target);if(item)enqueue(item);}});for(const item of items)if(!done.has(item))observer.observe(item.element);}else for(const item of items)enqueue(item);}
    function resume(){if(!stopped||!isCurrent())return false;stopped=false;observe();return true;}
    observe();return {cancel:stop,resume,get completed(){return done.size;}};
  }
  return {create};
});
