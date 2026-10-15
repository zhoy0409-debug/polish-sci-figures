/* Presentation-only alignment controls. Commands still use the host's existing
 * change/click handlers so selection, history and physical coordinates have a
 * single owner. Native selects remain as hidden backing controls. */
'use strict';
const StudioAlignmentIcons = (() => {
  const labels={
    left:['左对齐','Align left'],center:['水平居中','Align horizontal centers'],right:['右对齐','Align right'],
    top:['顶端对齐','Align top'],middle:['垂直居中','Align vertical centers'],bottom:['底端对齐','Align bottom'],
    'distribute-x':['水平等距分布','Distribute horizontal spacing'],'distribute-y':['垂直等距分布','Distribute vertical spacing'],
    'text-start':['文字左对齐','Align text left'],'text-middle':['文字居中','Center text'],'text-end':['文字右对齐','Align text right']
  };
  const icons={
    left:'<path d="M4 3v18"/><rect x="7" y="5" width="13" height="4" rx=".7"/><rect x="7" y="14" width="8" height="4" rx=".7"/>',
    center:'<path d="M12 3v18"/><rect x="4" y="5" width="16" height="4" rx=".7"/><rect x="7" y="14" width="10" height="4" rx=".7"/>',
    right:'<path d="M20 3v18"/><rect x="4" y="5" width="13" height="4" rx=".7"/><rect x="9" y="14" width="8" height="4" rx=".7"/>',
    top:'<path d="M3 4h18"/><rect x="5" y="7" width="4" height="13" rx=".7"/><rect x="14" y="7" width="4" height="8" rx=".7"/>',
    middle:'<path d="M3 12h18"/><rect x="5" y="4" width="4" height="16" rx=".7"/><rect x="14" y="7" width="4" height="10" rx=".7"/>',
    bottom:'<path d="M3 20h18"/><rect x="5" y="4" width="4" height="13" rx=".7"/><rect x="14" y="9" width="4" height="8" rx=".7"/>',
    'distribute-x':'<path d="M3 3v18M21 3v18M8 12h8M10 10l-2 2 2 2M14 10l2 2-2 2"/><rect x="5" y="6" width="3" height="12" rx=".5"/><rect x="16" y="6" width="3" height="12" rx=".5"/>',
    'distribute-y':'<path d="M3 3h18M3 21h18M12 8v8M10 10l2-2 2 2M10 14l2 2 2-2"/><rect x="6" y="5" width="12" height="3" rx=".5"/><rect x="6" y="16" width="12" height="3" rx=".5"/>',
    'text-start':'<path d="M4 5h16M4 10h10M4 15h16M4 20h10"/>',
    'text-middle':'<path d="M4 5h16M7 10h10M4 15h16M7 20h10"/>',
    'text-end':'<path d="M4 5h16M10 10h10M4 15h16M10 20h10"/>'
  };
  function icon(mode){return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[mode]||icons.left}</svg>`;}
  function create(adapter){
    const doc=adapter.document||document,win=doc.defaultView,t=adapter.t||String,select=doc.getElementById('quickAlignAction');
    if(!select)return null;
    const local=(zh,en)=>t('对齐')==='Align'?`${en} · ${zh}`:`${zh} · ${en}`,caption=(mode)=>local(...labels[mode]);
    const disposers=[],on=(node,type,handler,options)=>{node.addEventListener(type,handler,options);disposers.push(()=>node.removeEventListener(type,handler,options));};
    const decorate=(button,mode)=>{button.classList.add('alignment-icon-button');button.dataset.alignmentIcon=mode;button.innerHTML=icon(mode);button.title=caption(mode);button.setAttribute('aria-label',caption(mode));};
    const selectControls=[],objectButtons=[];let lastSignature='';
    // The toolbar stays short: eight discoverable icons live in a small popover.
    select.hidden=true;
    const toggle=doc.createElement('button');toggle.type='button';toggle.id='quickAlignmentToggle';toggle.className='quick-icon-button alignment-toggle';toggle.innerHTML=icon('left')+'<svg class="alignment-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"/></svg>';
    toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','quickAlignmentPopover');toggle.setAttribute('aria-haspopup','menu');select.after(toggle);
    const popup=doc.createElement('div');popup.id='quickAlignmentPopover';popup.className='alignment-popover';popup.hidden=true;
    const heading=doc.createElement('p');heading.className='alignment-popover-heading';popup.append(heading);
    const grid=doc.createElement('div');grid.className='alignment-icon-grid';grid.setAttribute('role','menu');popup.append(grid);doc.body.append(popup);
    const close=()=>{popup.hidden=true;toggle.setAttribute('aria-expanded','false');};
    const available=()=>[...grid.querySelectorAll('button')].filter(button=>!button.disabled);
    const position=()=>{const rect=toggle.getBoundingClientRect(),width=146,height=170;popup.style.left=Math.max(8,Math.min(rect.left,(win?.innerWidth||1024)-width-8))+'px';popup.style.top=Math.max(8,Math.min(rect.bottom+7,(win?.innerHeight||768)-height-8))+'px';};
    const choose=mode=>{close();select.value=mode;select.dispatchEvent(new win.Event('change',{bubbles:true}));};
    for(const option of [...select.options].filter(option=>labels[option.value])){
      const button=doc.createElement('button');button.type='button';button.dataset.alignmentAction=option.value;button.setAttribute('role','menuitem');decorate(button,option.value);grid.append(button);
      on(button,'pointerdown',event=>event.preventDefault());on(button,'click',()=>choose(option.value));
    }
    on(toggle,'click',()=>{sync();if(toggle.disabled)return;if(!popup.hidden){close();return;}popup.hidden=false;toggle.setAttribute('aria-expanded','true');position();});
    on(toggle,'keydown',event=>{if(!['ArrowDown','ArrowUp'].includes(event.key)||toggle.disabled)return;event.preventDefault();popup.hidden=false;toggle.setAttribute('aria-expanded','true');position();const items=available();(event.key==='ArrowUp'?items.at(-1):items[0])?.focus();});
    on(popup,'keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();toggle.focus();return;}
      if(event.key==='Tab'){close();return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();const items=available(),current=items.indexOf(doc.activeElement),delta=event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:event.key==='ArrowUp'?-3:3;
      const next=event.key==='Home'?0:event.key==='End'?items.length-1:(Math.max(current,0)+delta+items.length)%items.length;items[next]?.focus();
    });
    on(doc,'pointerdown',event=>{if(!popup.contains(event.target)&&!toggle.contains(event.target))close();},true);
    on(doc,'focusin',event=>{if(!popup.hidden&&!popup.contains(event.target)&&event.target!==toggle)close();});
    on(win,'resize',close);on(doc,'scroll',event=>{if(event.target!==popup&&!popup.contains(event.target))close();},true);
    for(const group of doc.querySelectorAll('.object-align')){
      group.classList.add('alignment-icon-grid');group.setAttribute('role','group');
      for(const mode of ['distribute-x','distribute-y'])if([...select.options].some(option=>option.value===mode)&&!group.querySelector(`[data-align-objects="${mode}"]`)){
        const button=doc.createElement('button');button.type='button';button.dataset.alignObjects=mode;on(button,'click',()=>choose(mode));group.append(button);
      }
      for(const button of group.querySelectorAll('[data-align-objects]')){const mode=button.dataset.alignObjects;if(labels[mode]){decorate(button,mode);objectButtons.push(button);on(button,'pointerdown',event=>event.preventDefault());}}
    }
    // Text alignment changes text anchors; it never invokes object alignment.
    for(const id of ['textAlign','overlayAlign']){
      const input=doc.getElementById(id);if(!input)continue;input.hidden=true;
      const group=doc.createElement('span');group.className='text-align-icons';group.setAttribute('role','group');input.after(group);
      for(const value of ['start','middle','end']){const button=doc.createElement('button');button.type='button';button.dataset.textAlign=value;decorate(button,'text-'+value);on(button,'pointerdown',event=>event.preventDefault());on(button,'click',()=>{input.value=value;input.dispatchEvent(new win.Event('change',{bubbles:true}));sync();});group.append(button);}
      selectControls.push({input,group});
    }
    function sync(){
      const options=new Map([...select.options].map(option=>[option.value,option]));
      const signature=JSON.stringify([t('对齐'),select.disabled,[...options].map(([mode,option])=>[mode,option.disabled]),selectControls.map(({input})=>[input.value,input.disabled])]);
      if(signature===lastSignature)return;lastSignature=signature;
      const title=local('对象对齐','Align objects');toggle.title=title;toggle.setAttribute('aria-label',title);toggle.disabled=select.disabled;heading.textContent=t('对齐');grid.setAttribute('aria-label',title);
      if(toggle.disabled)close();
      for(const button of [...grid.querySelectorAll('button'),...objectButtons]){const mode=button.dataset.alignmentAction||button.dataset.alignObjects;button.disabled=select.disabled||options.get(mode)?.disabled===true;button.title=caption(mode);button.setAttribute('aria-label',caption(mode));}
      for(const group of doc.querySelectorAll('.object-align.alignment-icon-grid'))group.setAttribute('aria-label',title);
      for(const {input,group} of selectControls){group.setAttribute('aria-label',local('文本对齐','Text alignment'));for(const button of group.children){button.disabled=input.disabled;button.setAttribute('aria-pressed',String(input.value===button.dataset.textAlign));button.title=caption('text-'+button.dataset.textAlign);button.setAttribute('aria-label',button.title);}}
    }
    sync();return {sync,close,destroy(){close();for(const dispose of disposers)dispose();toggle.remove();popup.remove();select.hidden=false;for(const {input,group} of selectControls){input.hidden=false;group.remove();}}};
  }
  return {create,icon};
})();
if(typeof module!=='undefined')module.exports=StudioAlignmentIcons;
