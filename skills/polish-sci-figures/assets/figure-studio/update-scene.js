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
  // Decorative hearts consume only the existing confirmed presentation view.
  function heartProgress(view={}){
    const known=!view.invalid&&['downloading','verifying','ready'].includes(view.state)&&(view.determinate||view.ready)&&Number.isFinite(view.ratio)&&view.ratio>=0&&view.ratio<=1;
    const waiting=!known&&!view.invalid&&view.indeterminate&&view.motion==='working'&&['checking','downloading'].includes(view.state);
    return {mode:known?'known':waiting?'unknown':'inactive',levels:Array.from({length:10},(_,index)=>known?Math.max(0,Math.min(1,view.ratio*10-index)):0)};
  }
  let heartSequence=0;
  function create({document:doc,container,artwork}={}){
    if(!doc||!container)throw Error('Update scene requires a document and container');
    const companion=doc.createElement('div');companion.className='update-companion';
    const template=doc.getElementById('studioUpdateMascotTemplate');
    if(artwork){const source=doc.createElement('template');source.innerHTML=artwork;companion.append(source.content.cloneNode(true));}
    else if(template?.content)companion.append(template.content.cloneNode(true));
    container.append(companion);container.setAttribute('aria-hidden','true');
    const ns='http://www.w3.org/2000/svg',heartShape='M12 20.3C9.4 18 3 13.6 3 8.5C3 4.6 7.9 3 10.5 5.4L12 6.8 13.5 5.4C16.1 3 21 4.6 21 8.5C21 13.6 14.6 18 12 20.3Z';
    // Fixed path vertical bounds: actual SVG getBBox y=4.269051075, bottom=20.3.
    const heartTop=4.269051075,heartBottom=20.3;
    const heartRow=doc.createElement('div');heartRow.className='update-heart-row';heartRow.setAttribute('aria-hidden','true');
    const id=++heartSequence,svgNode=(name,attributes={})=>{const node=doc.createElementNS(ns,name);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));return node;};
    const hearts=Array.from({length:10},(_,index)=>{
      const heart=svgNode('svg',{viewBox:'0 0 24 24',class:'update-heart',focusable:'false','aria-hidden':'true'}),prefix='fs-update-heart-'+id+'-'+index,clipId=prefix+'-clip';
      const defs=svgNode('defs'),clip=svgNode('clipPath',{id:clipId}),clipped=svgNode('g',{'clip-path':'url(#'+clipId+')'}),liquid=svgNode('g',{class:'update-heart-liquid'});
      const gradient=(kind,name,attributes,stops)=>{const node=svgNode(kind,{id:prefix+'-'+name,...attributes});for(const [offset,color,opacity] of stops)node.append(svgNode('stop',{offset,'stop-color':color,'stop-opacity':opacity}));defs.append(node);return 'url(#'+prefix+'-'+name+')';};
      const glass=gradient('linearGradient','glass',{x1:'18%',y1:'4%',x2:'76%',y2:'100%'},[['0%','#ffffff',.94],['42%','#f0f6f2',.56],['100%','#b3c9be',.48]]);
      const rim=gradient('linearGradient','rim',{x1:'15%',y1:'0%',x2:'78%',y2:'100%'},[['0%','#e6f5ec',1],['30%','#8aa99a',.8],['65%','#b7cfc1',.95],['100%','#668b76',.9]]);
      const jade=gradient('linearGradient','jade',{gradientUnits:'userSpaceOnUse',x1:3,y1:0,x2:18,y2:17},[['0%','#9bdfc6',.94],['22%','#62c6a5',.93],['66%','#349a79',.94],['100%','#246d55',.97]]);
      const depth=gradient('radialGradient','depth',{cx:'65%',cy:'91%',r:'85%'},[['0%','#335f49',.19],['67%','#739b86',.03],['100%','#ffffff',.08]]);
      const sheen=gradient('linearGradient','sheen',{x1:'0%',y1:'0%',x2:'100%',y2:'76%'},[['0%','#ffffff',.76],['50%','#ffffff',.11],['100%','#ffffff',0]]);
      const shadow=gradient('radialGradient','shadow',{cx:'50%',cy:'50%',r:'50%'},[['0%','#365446',.16],['100%','#365446',0]]);
      clip.append(svgNode('path',{d:heartShape}));defs.append(clip);
      heart.append(defs,svgNode('ellipse',{cx:12,cy:22,rx:5.7,ry:.9,fill:shadow,class:'update-heart-ground'}),svgNode('path',{d:heartShape,fill:glass,class:'update-heart-glass'}));
      const surface=svgNode('g',{class:'update-heart-waterline'});
      surface.append(svgNode('path',{d:'M-8 .55Q-1-.75 6 .3T20 .3T34 .3',fill:'none',stroke:'#dcfff0','stroke-width':.72,'stroke-linecap':'round'}),svgNode('path',{d:'M-8 1.45Q0 .15 8 1.1T24 1.1T36 1.1',fill:'none',stroke:'#1c7151','stroke-opacity':.28,'stroke-width':.6}));
      liquid.append(svgNode('rect',{x:-2,y:0,width:28,height:26,fill:jade,class:'update-heart-fill'}),svgNode('path',{d:'M5-2H8L2 25H-2Z',fill:'#eafff3',class:'update-heart-reflection'}),surface);
      clipped.append(liquid,svgNode('path',{d:heartShape,fill:depth,class:'update-heart-depth'}),svgNode('path',{d:'M4 5C8 3.8 10.2 6.8 9 11L6.6 17.5Q4 15 4 5Z',fill:sheen,class:'update-heart-sheen'}));
      heart.append(clipped,svgNode('path',{d:heartShape,fill:'none',stroke:rim,class:'update-heart-outline'}),svgNode('path',{d:heartShape,fill:'none',stroke:'#f4fff8','stroke-opacity':.63,'stroke-width':.55,transform:'translate(.85 .85) scale(.9292)',class:'update-heart-inner-rim'}),svgNode('path',{d:'M5.3 8.5C5 6.3 7.7 5 9.3 6.4M15.1 6.2C16.6 5.3 18.7 6.2 18.9 7.7',fill:'none',stroke:'#fff','stroke-opacity':.8,'stroke-width':.92,'stroke-linecap':'round',class:'update-heart-highlight'}));
      heart.style.setProperty('--heart-index',String(index));heartRow.append(heart);return {heart,liquid};
    });container.append(heartRow);
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
      const progress=heartProgress(value);container.dataset.heartProgress=progress.mode;
      hearts.forEach(({heart,liquid},index)=>{const level=progress.levels[index];heart.dataset.fill=level===0?'empty':level===1?'full':'partial';heart.dataset.level=String(level);liquid.style.setProperty('--heart-offset',String(heartBottom-(heartBottom-heartTop)*level)+'px');});
      if(changed)container.dataset.celebrate=String(['ready','current'].includes(value.state)&&active&&enabled&&!media?.matches);
      motion();
    },setActive(value){active=value===true;if(!active)container.dataset.celebrate='false';motion();},
    setEnabled(value){enabled=value===true;if(!enabled)container.dataset.celebrate='false';motion();},
    destroy(){disposed=true;doc.removeEventListener('visibilitychange',visibility);media?.removeEventListener?.('change',motion);observer?.disconnect();companion.remove();heartRow.remove();}};
  }
  return {create,presentation,acceptProgress,heartProgress};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioUpdateScene;
