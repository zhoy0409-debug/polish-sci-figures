/* Decorative update scene. No transport, timers, project access or success inference. */
'use strict';
const StudioUpdateScene=(()=>{
  function presentation({installation=null,confirmedInstallation=null,busy=false,result=null,connectionLost=false,invalid=false}={}){
    const stage=installation?.status,working=['checking','downloading','preparing','installing'].includes(stage);
    const determinate=stage==='downloading'&&installation.total>0;
    const ready=stage==='ready'&&!connectionLost;
    const verifying=determinate&&installation.received===installation.total;
    // A disconnected preparation has unknown installation progress. Retain only
    // the package's server-confirmed byte snapshot for its decorative position.
    const snapshot=connectionLost?confirmedInstallation:null;
    const confirmedDownload=snapshot&&Number.isFinite(snapshot.received)&&snapshot.received>=0&&Number.isFinite(snapshot.total)&&snapshot.total>=0&&(!snapshot.total||snapshot.received<=snapshot.total)?{received:snapshot.received,total:snapshot.total}:null;
    const state=connectionLost?'paused':verifying?'verifying':stage&&!['idle','unsupported'].includes(stage)?stage:busy?'checking':result?.status==='up-to-date'?'current':result?.status==='offline'?'paused':'idle';
    return {state,working,ready,determinate,verifying,ratio:connectionLost&&confirmedDownload?.total>0?confirmedDownload.received/confirmedDownload.total:determinate?(installation.received||0)/installation.total:ready?1:0,
      confirmedStage:snapshot?.status||null,confirmedDownload,
      indeterminate:(working||busy)&&!determinate&&!ready&&!connectionLost,motion:(working||busy)&&!connectionLost?'working':'still',invalid};
  }
  // The existing updater has no public job ID. A local epoch begins only on
  // explicit download. Never take a global maximum across different downloads.
  function acceptProgress(previous,value,{newJob=false}={}){
    const before=newJob?null:previous;
    if(value.status!=='downloading')return before;
    const received=value.received||0,total=value.total||0;
    if(before&&received<before.received)throw Error('Update bytes moved backwards within the download');
    if(before?.total>0&&total>0&&before.total!==total)throw Error('Update size changed within the download');
    return {received,total:total||before?.total||0};
  }
  function create({document:doc,container,artwork}={}){
    if(!doc||!container)throw Error('Update scene requires a document and container');
    const companion=doc.createElement('div');companion.className='update-companion';
    const template=doc.getElementById('studioUpdateMascotTemplate');
    if(artwork){const source=doc.createElement('template');source.innerHTML=artwork;companion.append(source.content.cloneNode(true));}
    else if(template?.content)companion.append(template.content.cloneNode(true));
    container.append(companion);container.setAttribute('aria-hidden','true');
    let active=false,enabled=true,intersecting=true,lastState='',disposed=false;
    const media=doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion=()=>{if(disposed)return;container.dataset.animation=active&&enabled&&intersecting&&!media?.matches&&doc.visibilityState!=='hidden'?'on':'off';};
    const visibility=()=>{if(doc.visibilityState==='hidden')container.dataset.celebrate='false';motion();};
    doc.addEventListener('visibilitychange',visibility);media?.addEventListener?.('change',motion);
    const Observer=doc.defaultView?.IntersectionObserver,observer=Observer?new Observer(entries=>{for(const entry of entries)if(entry.target===container){intersecting=entry.isIntersecting;if(!intersecting)container.dataset.celebrate='false';}motion();}):null;
    observer?.observe(container);
    motion();
    return {element:container,refresh(value){
      if(disposed)return;const changed=value.state!==lastState;lastState=value.state;
      container.dataset.state=value.state;container.dataset.motion=value.motion;container.dataset.indeterminate=String(value.indeterminate);
      container.style.setProperty('--update-progress',String(value.ratio));
      if(changed)container.dataset.celebrate=String(['ready','current'].includes(value.state)&&active&&enabled&&!media?.matches);
      motion();
    },setActive(value){active=value===true;if(!active)container.dataset.celebrate='false';motion();},
    setEnabled(value){enabled=value===true;if(!enabled)container.dataset.celebrate='false';motion();},
    destroy(){disposed=true;doc.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',motion);observer?.disconnect();companion.remove();}};
  }
  return {create,presentation,acceptProgress};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioUpdateScene;
