/* A bounded view of the already-rendered artwork. Selection never reparses SVG
 * or recreates the list; only the visible rows receive state updates. */
'use strict';
const StudioLayersPanel = (() => {
  const ROW_HEIGHT=36, PAGE_SIZE=150, OVERSCAN=4;
  const shapes={
    eye:'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    hidden:'<path d="m3 3 18 18M10 6.2A13 13 0 0 1 12 6c6.5 0 10 6 10 6a17 17 0 0 1-3 3.5M6.3 7.6A18 18 0 0 0 2 12s3.5 6 10 6a13 13 0 0 0 4.5-.8M10 10a3 3 0 0 0 4 4"/>',
    lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
    unlock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.6-1.7M12 14v3"/>',
    text:'<path d="M4 5h16M12 5v15M8 20h8"/>',
    image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 5-5 3 3 4-6 5 8"/>',
    path:'<path d="M4 18C5 3 18 21 20 6"/><rect x="2" y="16" width="4" height="4" rx=".5"/><rect x="18" y="4" width="4" height="4" rx=".5"/>',
    shape:'<rect x="4" y="4" width="16" height="16" rx="3"/>'
  };
  const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shapes[name]||shapes.shape}</svg>`;
  function collect(root){
    if(!root)return [];
    // TreeWalker rejects entire definition/span subtrees. Looking ahead once
    // distinguishes keyed containers from drawable leaves without a nested
    // querySelector for each group (important for deeply nested PDF imports).
    const walker=root.ownerDocument.createTreeWalker(root,1,{acceptNode:node=>['defs','clippath','mask','tspan'].includes(node.localName?.toLowerCase())?2:node.hasAttribute('data-key')?1:3}),rows=[],seen=new Set();
    let previous=null,node=walker.nextNode();
    const add=(item,next)=>{const key=item.getAttribute('data-key');if(seen.has(key)||['g','svg'].includes(item.localName)&&next&&item.contains(next))return;seen.add(key);rows.push({key,type:item.localName,node:item});};
    while(node){if(previous)add(previous,node);previous=node;node=walker.nextNode();}
    if(previous)add(previous,null);return rows.reverse();
  }
  function create(adapter){
    const host=adapter.host,search=adapter.search,more=adapter.more,doc=host.ownerDocument,win=doc.defaultView,t=adapter.t||String;
    const local=(zh,en)=>{const result=t(zh);return result!==zh?result:t('图层显示栏')==='Layers'?en:zh;};
    const disposers=[],on=(target,type,fn,options)=>{target.addEventListener(type,fn,options);disposers.push(()=>target.removeEventListener(type,fn,options));};
    const status=doc.createElement('div');status.className='studio-layer-status';status.setAttribute('role','status');host.before(status);
    const spacer=doc.createElement('div');spacer.className='studio-layer-spacer';spacer.setAttribute('aria-hidden','true');
    const window=doc.createElement('div');window.className='studio-layer-window';window.setAttribute('role','rowgroup');
    const empty=doc.createElement('p');empty.className='studio-layer-empty';host.replaceChildren(spacer,window,empty);host.setAttribute('role','grid');host.setAttribute('aria-colcount','3');host.tabIndex=0;
    let source=null,context=null,contextKey=null,rows=[],matches=[],indexes=new Map(),limit=PAGE_SIZE,query='',revision=null,language='',frame=0,focusKey=null,visible=new Map(),viewportHeight=340,lastStatus='',scrollPosition=0;
    const stats={indexes:0,indexedRows:0,createdRows:0,paints:0};
    const selected=()=>context?.selected||new Set(),isLocked=key=>!!(context?.panelLocked||context?.locked?.has(key)),isHidden=key=>context?.edits?.[key]?.hidden==='true';
    const name=item=>item.type==='text'?t('文字 ')+item.node.textContent:item.type==='image'?t('图片'):item.type==='path'?t('路径'):item.type;
    const filter=()=>{matches=query?rows.filter(item=>(name(item)+' '+item.type+' '+item.key).toLowerCase().includes(query)):rows;indexes=new Map(matches.map((item,index)=>[item.key,index]));};
    const available=()=>Math.min(limit,matches.length);
    // Read scroll geometry on scroll/explicit flush, not after selection writes:
    // a scrollTop getter here otherwise forces layout of the entire SVG.
    const setScroll=value=>{scrollPosition=value;host.scrollTop=value;};
    const schedule=()=>{if(frame)return;frame=win.requestAnimationFrame(()=>{frame=0;paint();});};
    function makeRow(item){
      const row=doc.createElement('div');row.className='studio-layer-row';row.dataset.layerKey=item.key;row.setAttribute('role','row');
      const buttons=['visibility','lock','name'].map(action=>{const cell=doc.createElement('div');cell.setAttribute('role','gridcell');const button=doc.createElement('button');button.type='button';button.dataset.layerAction=action;button.tabIndex=-1;cell.append(button);row.append(cell);return button;});
      const [eye,lock,title]=buttons;eye.className='layer-action';lock.className='layer-action';title.className='layer-name';
      const type=doc.createElement('span');type.className='studio-layer-type';type.innerHTML=icon(item.type==='text'?'text':item.type==='image'?'image':item.type==='path'?'path':'shape');
      const label=doc.createElement('span');label.className='studio-layer-name';const key=doc.createElement('span');key.className='studio-layer-key';key.textContent=item.key;title.append(type,label,key);
      stats.createdRows++;return {row,eye,lock,title,label,key,signature:''};
    }
    function paint(){
      stats.paints++;if(!context)return;
      const count=available(),maxScroll=Math.max(0,count*ROW_HEIGHT-viewportHeight);if(scrollPosition>maxScroll)setScroll(maxScroll);
      const start=Math.max(0,Math.floor(scrollPosition/ROW_HEIGHT)-OVERSCAN),end=Math.min(count,start+Math.ceil(viewportHeight/ROW_HEIGHT)+OVERSCAN*2),next=new Map();
      const retainedFocus=doc.activeElement?.closest?.('[data-layer-key]');
      if(retainedFocus&&!matches.slice(start,end).some(item=>item.key===retainedFocus.dataset.layerKey))host.focus({preventScroll:true});
      if(!focusKey||!indexes.has(focusKey)||indexes.get(focusKey)>=count)focusKey=matches[start]?.key||null;
      let anchor=window.firstChild;
      for(let index=start;index<end;index++){
        const item=matches[index],entry=visible.get(item.key)||makeRow(item),hidden=isHidden(item.key),locked=isLocked(item.key),chosen=selected().has(item.key),title=name(item),signature=JSON.stringify([hidden,locked,chosen,context.readonly,title,language,index,count]);
        if(entry.signature!==signature){entry.signature=signature;entry.row.classList.toggle('is-hidden',hidden);entry.row.classList.toggle('is-locked',locked);entry.row.setAttribute('aria-selected',String(chosen));entry.row.setAttribute('aria-rowindex',String(index+1));entry.label.textContent=title;entry.title.title=title+' · '+item.key;entry.title.setAttribute('aria-label',entry.title.title);
          const eyeTitle=t(hidden?'显示元素':'隐藏元素'),lockTitle=t(locked?'解锁元素':'锁定元素');
          if(entry.eye.dataset.icon!==(hidden?'hidden':'eye')){entry.eye.innerHTML=icon(hidden?'hidden':'eye');entry.eye.dataset.icon=hidden?'hidden':'eye';}entry.eye.title=eyeTitle;entry.eye.setAttribute('aria-label',eyeTitle);entry.eye.setAttribute('aria-pressed',String(!hidden));entry.eye.disabled=!!(context.readonly||locked);
          if(entry.lock.dataset.icon!==(locked?'lock':'unlock')){entry.lock.innerHTML=icon(locked?'lock':'unlock');entry.lock.dataset.icon=locked?'lock':'unlock';}entry.lock.title=lockTitle;entry.lock.setAttribute('aria-label',lockTitle);entry.lock.setAttribute('aria-pressed',String(locked));entry.lock.disabled=!!context.readonly;
        }
        entry.title.tabIndex=item.key===focusKey?0:-1;entry.eye.tabIndex=item.key===focusKey&&!entry.eye.disabled?0:-1;entry.lock.tabIndex=item.key===focusKey&&!entry.lock.disabled?0:-1;
        next.set(item.key,entry);if(entry.row!==anchor)window.insertBefore(entry.row,anchor);anchor=entry.row.nextSibling;
      }
      for(const [key,entry]of visible)if(!next.has(key))entry.row.remove();visible=next;
      const height=count*ROW_HEIGHT+'px',offset=start*ROW_HEIGHT+'px';if(spacer.style.height!==height)spacer.style.height=height;if(window.style.top!==offset)window.style.top=offset;
      host.setAttribute('aria-rowcount',String(count));host.setAttribute('aria-label',t('图层显示栏'));empty.hidden=!!matches.length;empty.textContent=local(rows.length?'没有匹配的元素':'当前小图没有可编辑元素',rows.length?'No matching objects':'No editable objects in this panel');
      more.hidden=count>=matches.length;more.textContent=t('显示更多')+' · '+count.toLocaleString()+' / '+matches.length.toLocaleString();
      const message=(query?matches.length:rows.length).toLocaleString()+' '+local('个元素','objects')+(matches.length>count?' · '+count.toLocaleString()+' '+local('个已显示','shown'):'');if(message!==lastStatus){status.textContent=message;lastStatus=message;}
    }
    function update(next){
      const newPanel=contextKey!==next.key,changed=source!==next.source||newPanel,translated=language!==t('图层显示栏'),stateChanged=revision!==next.revision;context=next;contextKey=next.key;revision=next.revision;language=t('图层显示栏');
      if(changed){source=next.source;rows=collect(source);stats.indexes++;stats.indexedRows+=rows.length;}
      if(newPanel){limit=PAGE_SIZE;setScroll(0);focusKey=null;}
      if(changed||translated||query&&stateChanged)filter();paint();
    }
    on(host,'scroll',()=>{scrollPosition=host.scrollTop;schedule();},{passive:true});
    on(host,'click',event=>{const button=event.target.closest('button[data-layer-action]'),row=button?.closest('[data-layer-key]');if(!row||button.disabled||!host.contains(row))return;focusKey=row.dataset.layerKey;const key=focusKey,action=button.dataset.layerAction;if(action==='name')adapter.choose(key,event.shiftKey||event.ctrlKey||event.metaKey);else if(action==='visibility')adapter.visibility(key,!isHidden(key));else adapter.lock(key,!isLocked(key));});
    on(host,'focusin',event=>{const key=event.target.closest('[data-layer-key]')?.dataset.layerKey;if(key&&focusKey!==key){focusKey=key;paint();}});
    on(host,'keydown',event=>{
      if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)||event.altKey||event.metaKey)return;
      event.preventDefault();event.stopPropagation();const count=available();if(!count)return;
      const row=event.target.closest('[data-layer-key]'),current=indexes.get(row?.dataset.layerKey||focusKey)||0,action=event.target.dataset.layerAction||'name';
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){const entry=visible.get(matches[current]?.key),buttons=entry?[entry.eye,entry.lock,entry.title].filter(button=>!button.disabled):[],index=buttons.indexOf(event.target);buttons[(Math.max(index,0)+(event.key==='ArrowLeft'?-1:1)+buttons.length)%buttons.length]?.focus();return;}
      const index=event.key==='Home'?0:event.key==='End'?count-1:Math.max(0,Math.min(count-1,current+(event.key==='ArrowUp'?-1:1)));focusKey=matches[index].key;
      if(index*ROW_HEIGHT<scrollPosition)setScroll(index*ROW_HEIGHT);else if((index+1)*ROW_HEIGHT>scrollPosition+viewportHeight)setScroll((index+1)*ROW_HEIGHT-viewportHeight);
      paint();const entry=visible.get(focusKey);(action==='visibility'&&!entry.eye.disabled?entry.eye:action==='lock'&&!entry.lock.disabled?entry.lock:entry.title).focus({preventScroll:true});
    });
    on(search,'input',()=>{query=search.value.trim().toLowerCase();limit=PAGE_SIZE;setScroll(0);filter();paint();});
    on(more,'click',()=>{limit+=PAGE_SIZE;paint();});
    const measure=()=>{const next=host.clientHeight||340;if(next!==viewportHeight){viewportHeight=next;paint();}};
    const observer=win.ResizeObserver?new win.ResizeObserver(measure):null;observer?.observe(host);if(!observer)on(win,'resize',measure);measure();
    return {update,stats,flush(){if(frame){win.cancelAnimationFrame(frame);frame=0;}scrollPosition=host.scrollTop;paint();},destroy(){if(frame)win.cancelAnimationFrame(frame);observer?.disconnect();for(const dispose of disposers)dispose();host.replaceChildren();status.remove();}};
  }
  return {create,collect,ROW_HEIGHT,PAGE_SIZE,OVERSCAN};
})();
if(typeof module!=='undefined')module.exports=StudioLayersPanel;
