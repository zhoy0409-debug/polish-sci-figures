'use strict';
const StudioWorkspace = (()=>{
  function fit(total,left=220,right=320,side=null){
    const available=Math.max(370,total-272);left=Number.isFinite(left)?left:220;right=Number.isFinite(right)?right:320;
    left=Math.max(150,left);right=Math.max(220,right);
    if(left+right>available){if(side==='left')left=Math.max(150,available-right);else if(side==='right')right=Math.max(220,available-left);else{const ratio=(available-370)/Math.max(1,left+right-370);left=150+(left-150)*ratio;right=220+(right-220)*ratio;}}
    if(left+right>available){left=150;right=Math.max(220,available-left);}
    return {left:Math.round(left),right:Math.round(right)};
  }
  function init({resize=()=>{},t=s=>s}={}){
    const workspace=document.querySelector('.workspace');if(!workspace)return;const storageKey='figure-studio-workspace-widths-v1';let widths={left:220,right:320},drag=null,frame=0;
    try{const saved=JSON.parse(localStorage.getItem(storageKey));if(saved&&Number.isFinite(saved.left)&&Number.isFinite(saved.right))widths=saved;}catch{}
    workspace.classList.add('is-resizable');const handles=[];
    const update=()=>{const total=workspace.clientWidth,actual=fit(total,widths.left,widths.right,drag?.side);for(const [name,value]of [['--navigator-width',actual.left+'px'],['--inspector-width',actual.right+'px']])if(workspace.style.getPropertyValue(name)!==value)workspace.style.setProperty(name,value);for(const h of handles){const side=h.dataset.side,min=side==='left'?150:220;h.setAttribute('aria-valuenow',actual[side]);h.setAttribute('aria-valuemin',min);h.setAttribute('aria-valuemax',Math.max(min,total-272-actual[side==='left'?'right':'left']));}resize();};
    const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(widths));}catch{}};
    const stop=cancel=>{if(!drag)return;const old=drag;drag=null;if(frame)cancelAnimationFrame(frame);frame=0;widths=cancel?old.preferred:fit(workspace.clientWidth,widths.left,widths.right,old.side);document.body.classList.remove('is-resizing-workspace');update();if(!cancel)save();if(old.handle.hasPointerCapture?.(old.pointerId))old.handle.releasePointerCapture(old.pointerId);};
    for(const side of ['left','right']){const h=document.createElement('div');h.className='workspace-splitter workspace-splitter-'+side;h.dataset.side=side;h.tabIndex=0;h.setAttribute('role','separator');h.setAttribute('aria-orientation','vertical');h.setAttribute('aria-label',t(side==='left'?'调整左侧区域宽度':'调整右侧区域宽度'));h.title=t('拖动调整区域大小；双击恢复默认');workspace.append(h);handles.push(h);
      h.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();drag={side,screen:e.clientX,start:fit(workspace.clientWidth,widths.left,widths.right),preferred:{...widths},handle:h,pointerId:e.pointerId};document.body.classList.add('is-resizing-workspace');h.setPointerCapture(e.pointerId);};
      h.onpointermove=e=>{if(!drag||drag.handle!==h)return;if(!e.buttons){stop(true);return;}const delta=(e.clientX-drag.screen)*(side==='left'?1:-1),next={...drag.start,[side]:drag.start[side]+delta};widths=fit(workspace.clientWidth,next.left,next.right,side);drag.start={...widths};drag.screen=e.clientX;if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});};
      h.onpointerup=()=>stop(false);h.onpointercancel=()=>stop(true);h.onlostpointercapture=()=>stop(true);
      h.ondblclick=()=>{stop(true);widths={...widths,[side]:side==='left'?220:320};update();save();};
      h.onkeydown=e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const direction=(e.key==='ArrowRight'?1:-1)*(side==='left'?1:-1);widths[side]+=direction*(e.shiftKey?40:10);widths=fit(workspace.clientWidth,widths.left,widths.right,side);update();save();}else if(e.key==='Home'){e.preventDefault();h.ondblclick();}else if(e.key==='Escape')stop(true);};
    }
    window.addEventListener('blur',()=>stop(true));window.addEventListener('resize',()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;update();});});update();
    return {update,translate(){for(const h of handles){h.setAttribute('aria-label',t(h.dataset.side==='left'?'调整左侧区域宽度':'调整右侧区域宽度'));h.title=t('拖动调整区域大小；双击恢复默认');}}};
  }
  return {fit,init};
})();
if(typeof module!=='undefined')module.exports=StudioWorkspace;
