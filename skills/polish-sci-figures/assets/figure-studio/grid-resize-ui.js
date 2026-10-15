/* Local row/column sizing. Pointer frames change existing viewports, not SVG data. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.StudioGridResize=api;})(typeof window!=='undefined'?window:globalThis,()=>{
  'use strict';
  const NS='http://www.w3.org/2000/svg',MAX=14400,copy=value=>JSON.parse(JSON.stringify(value)),sum=a=>a.reduce((n,x)=>n+x,0);
  function tracks(state,layout){
    const rows=state.grid?.rows||Math.ceil(state.order.length/state.columns),widths=Array.from({length:state.columns},(_,col)=>layout.cells.find(c=>c.row===0&&c.col===col)?.width),heights=Array.from({length:rows},(_,row)=>layout.cells.find(c=>c.row===row&&c.col===0)?.height);
    if([...widths,...heights].some(x=>!Number.isFinite(x)||x<=0||x>MAX))throw Error('工程布局无效');
    return {widths,heights};
  }
  function minimums(state,layout){
    const {widths,heights}=tracks(state,layout),g=state.grid||{places:Object.fromEntries(state.order.map((id,i)=>[id,{row:Math.floor(i/state.columns),col:i%state.columns,rs:1,cs:1}]))};
    return {widths:widths.map(()=>72),heights:heights.map((_,row)=>Math.max(72,...layout.positions.filter(pos=>{const p=g.places[pos.id];return p.row===row||p.row+p.rs-1===row;}).map(pos=>48+(pos.statisticsTop||0)+(pos.statisticsBand||0)+(pos.conditionHeight||0))))};
  }
  function positions(state,base,widths,heights){
    const g=state.grid||{rows:heights.length,places:Object.fromEntries(state.order.map((id,i)=>[id,{row:Math.floor(i/state.columns),col:i%state.columns,rs:1,cs:1}]))},gx=state.gapX??state.gap,gy=state.gapY??state.gap;
    const box=p=>({x:sum(widths.slice(0,p.col))+gx*p.col,y:sum(heights.slice(0,p.row))+gy*p.row,width:sum(widths.slice(p.col,p.col+p.cs))+gx*(p.cs-1),height:sum(heights.slice(p.row,p.row+p.rs))+gy*(p.rs-1)});
    return {...base,compact:undefined,width:sum(widths)+gx*(widths.length-1),height:sum(heights)+gy*(heights.length-1),cells:heights.flatMap((_,row)=>widths.map((_,col)=>({row,col,...box({row,col,rs:1,cs:1})}))),positions:base.positions.map(pos=>{const value=box(g.places[pos.id]),offset=state.panels[pos.id]?.frameOffset||{x:0,y:0};return {...pos,...value,x:value.x+(offset.x||0),y:value.y+(offset.y||0),renderBox:undefined,trim:undefined};})};
  }
  function panelViewport(pos,metrics,manual=false){
    // A manual cell resizes the complete edited figure, including its labels
    // and statistical/condition rows, with one shared scale in both directions.
    if(manual){const scale=Math.max(.0001,Math.min(pos.width/metrics.width,pos.height/metrics.height)),width=metrics.width*scale,height=metrics.height*scale;return {x:pos.x+(pos.width-width)/2,y:pos.y+(pos.height-height)/2,width,height};}
    if(metrics.fitted)return {x:pos.x,y:pos.y,width:pos.width,height:pos.height-(pos.statisticsBand||0)-(pos.conditionHeight||0)};
    const body=pos.height-(pos.statisticsBand||0)-(pos.statisticsTop||0)-(pos.conditionHeight||0),scale=1;
    return {x:pos.x+(pos.width-metrics.width*scale)/2,y:pos.y+(pos.statisticsFirstTop||0)-(metrics.ownHeader||0)*scale+(body-metrics.sourceHeight*scale)/2,width:metrics.width*scale,height:metrics.height*scale};
  }
  function resizedState(state,sizes){
    // Grid gestures change layout only. Keep immutable artwork references until
    // the host records the single final history entry, rather than JSON-copying
    // every selected element on every pointer frame.
    const next={...state,grid:copy(state.grid||{rows:sizes.heights.length,places:Object.fromEntries(state.order.map((id,i)=>[id,{row:Math.floor(i/state.columns),col:i%state.columns,rs:1,cs:1}]))}),compactWhitespace:false};
    Object.assign(next.grid,sizes,{manualTracks:true});return next;
  }
  function hasUncapturedPanelLock(state){return state.order.some(id=>state.panels[id]?.locked&&!state.panels[id]?.layoutLock?.panel);}
  function pinnedExtent(state){if(typeof StudioLayoutLock!=='undefined'){const box=StudioLayoutLock.pinnedBounds(state);if(box)return {width:Math.max(0,box.x+box.width),height:Math.max(0,box.y+box.height)};}const boxes=[];for(const p of Object.values(state.panels||{})){const lock=p.layoutLock;if(lock?.panel?.locked){boxes.push(lock.panel.bounds);if(lock.panel.label?.locked)boxes.push(lock.panel.label.bounds);}if(lock?.label?.locked)boxes.push(lock.label.bounds);for(const records of Object.values(lock?.elements||{}))for(const record of records)if(record.lockedKeys?.length)boxes.push(record.bounds);}return {width:Math.max(0,...boxes.filter(Boolean).map(b=>b.x+b.width)),height:Math.max(0,...boxes.filter(Boolean).map(b=>b.y+b.height))};}
  function protectLocked(state,base,result){
    const pinned=pinnedExtent(state);if(result.width+.001<pinned.width||result.height+.001<pinned.height)throw Error('母版不能裁掉已锁定的内容，请先解锁');
    for(const pos of result.positions){const old=base.positions.find(p=>p.id===pos.id);if(state.panels[pos.id]?.locked&&!state.panels[pos.id]?.layoutLock?.panel&&['x','y','width','height'].some(k=>Math.abs(pos[k]-old[k])>.001))throw Error('调整会改变已锁定小图的格子，请先解锁');}
  }
  function planWhole(state,layout,width=layout.width,height=layout.height,{proportional=false}={}){
    if(![width,height].every(Number.isFinite))throw Error('工程布局无效');
    if(!state.grid?.manualTracks&&hasUncapturedPanelLock(state))throw Error('调整会改变已锁定小图的格子，请先解锁');
    const sizes=tracks(state,layout),mins=minimums(state,layout),gx=state.gapX??state.gap,gy=state.gapY??state.gap,spaces={widths:gx*(sizes.widths.length-1),heights:gy*(sizes.heights.length-1)},limits={};let minimumChanged=false;
    for(const axis of ['widths','heights']){
      sizes[axis]=sizes[axis].map((value,i)=>{if(value<mins[axis][i]){minimumChanged=true;return mins[axis][i];}return value;});
      const total=sum(sizes[axis]),lower=Math.max(...sizes[axis].map((value,i)=>mins[axis][i]/value)),upper=Math.min(...sizes[axis].map(value=>MAX/value));
      limits[axis]={total,minimum:total*lower+spaces[axis],maximum:total*upper+spaces[axis]};
    }
    // Preserve an explicit publication scale while resizing the actual master.
    // A fixed old width would otherwise make a committed width drag snap back.
    if(state.exportSettings){limits.widths.minimum=Math.max(limits.widths.minimum,layout.width*20/state.exportSettings.widthMm);limits.widths.maximum=Math.min(limits.widths.maximum,layout.width*2000/state.exportSettings.widthMm);}
    const pinned=pinnedExtent(state);limits.widths.minimum=Math.max(limits.widths.minimum,pinned.width);limits.heights.minimum=Math.max(limits.heights.minimum,pinned.height);
    let actualWidth,actualHeight,requestedWidth=width,requestedHeight=height;
    if(proportional){
      const wanted=(width*layout.width+height*layout.height)/(layout.width**2+layout.height**2),lower=Math.max(limits.widths.minimum/layout.width,limits.heights.minimum/layout.height),upper=Math.min(limits.widths.maximum/layout.width,limits.heights.maximum/layout.height);
      if(lower>upper)throw Error('格子已达到最小可读尺寸');requestedWidth=layout.width*wanted;requestedHeight=layout.height*wanted;const factor=Math.max(lower,Math.min(upper,wanted));actualWidth=layout.width*factor;actualHeight=layout.height*factor;
    }else{
      if(limits.widths.minimum>limits.widths.maximum||limits.heights.minimum>limits.heights.maximum)throw Error('格子已达到最小可读尺寸');
      actualWidth=Math.max(limits.widths.minimum,Math.min(limits.widths.maximum,width));actualHeight=Math.max(limits.heights.minimum,Math.min(limits.heights.maximum,height));
    }
    const scaleX=(actualWidth-spaces.widths)/limits.widths.total,scaleY=(actualHeight-spaces.heights)/limits.heights.total;
    sizes.widths=sizes.widths.map((value,i)=>Math.max(mins.widths[i],Math.min(MAX,value*scaleX)));sizes.heights=sizes.heights.map((value,i)=>Math.max(mins.heights[i],Math.min(MAX,value*scaleY)));
    const next=resizedState(state,sizes);if(state.exportSettings)next.exportSettings={...state.exportSettings,widthMm:Math.max(20,Math.min(2000,state.exportSettings.widthMm*actualWidth/layout.width))};
    const result=positions(next,layout,sizes.widths,sizes.heights);protectLocked(state,layout,result);
    return {state:next,layout:result,actual:{width:result.width,height:result.height},clamped:minimumChanged||Math.abs(requestedWidth-result.width)>.001||Math.abs(requestedHeight-result.height)>.001};
  }
  function plan(state,layout,axis,index,value,{adjacent=false}={}){
    if(!['widths','heights'].includes(axis)||!Number.isInteger(index)||!Number.isFinite(value))throw Error('工程布局无效');
    if(!state.grid?.manualTracks&&hasUncapturedPanelLock(state))throw Error('调整会改变已锁定小图的格子，请先解锁');
    const sizes=tracks(state,layout),mins=minimums(state,layout);let minimumChanged=false;for(const key of ['widths','heights'])sizes[key]=sizes[key].map((value,i)=>{if(value<mins[key][i]){minimumChanged=true;return mins[key][i];}return value;});const values=sizes[axis],limits=mins[axis];if(index<0||index>=values.length||adjacent&&index>=values.length-1)throw Error('工程布局无效');
    const total=values[index]+(adjacent?values[index+1]:0),lower=adjacent?Math.max(limits[index],total-MAX):limits[index],upper=adjacent?Math.min(MAX,total-limits[index+1]):MAX;if(lower>upper)throw Error('格子已达到最小可读尺寸');
    const actual=Math.max(lower,Math.min(upper,value));values[index]=actual;if(adjacent)values[index+1]=total-actual;
    const next=resizedState(state,sizes);
    const result=positions(next,layout,sizes.widths,sizes.heights);
    protectLocked(state,layout,result);
    return {state:next,layout:result,actual,clamped:minimumChanged||Math.abs(value-actual)>.001};
  }
  function create(host){
    const document=host.controls.ownerDocument,view=document.defaultView,viewport=host.viewport,raf=host.raf||view.requestAnimationFrame.bind(view),caf=host.caf||view.cancelAnimationFrame.bind(view),t=host.t||((x,...args)=>x.replace(/\{(\d+)\}/g,(_,n)=>args[n]??''));
    let shown=true,gesture=null,frame=0,disposed=false,boundRoot=null,layer=null;const controls=host.controls;
    const element=(tag,attrs={},parent=controls)=>{const el=document.createElement(tag);for(const [key,value]of Object.entries(attrs)){if(key==='text')el.textContent=value;else el.setAttribute(key,value);}parent.append(el);return el;};
    const title=element('h3'),note=element('p',{class:'muted'}),visibility=element('label'),check=element('input',{type:'checkbox'},visibility),visibilityText=element('span',{},visibility),form=element('div',{class:'row'}),colLabel=element('label',{},form),colText=element('span',{},colLabel),column=element('select',{},colLabel),width=element('input',{type:'number',min:72,max:MAX,step:1},colLabel),rowLabel=element('label',{},form),rowText=element('span',{},rowLabel),row=element('select',{},rowLabel),height=element('input',{type:'number',min:72,max:MAX,step:1},rowLabel),reset=element('button',{type:'button'}),status=element('p',{class:'muted',role:'status','aria-live':'polite'});check.checked=true;
    const grid=()=>host.grid?.()||host.state().grid||{rows:Math.ceil(host.state().order.length/host.state().columns),places:Object.fromEntries(host.state().order.map((id,i)=>[id,{row:Math.floor(i/host.state().columns),col:i%host.state().columns,rs:1,cs:1}]))};
    const say=message=>{status.textContent=t(message);host.say?.(t(message));};
    function fillSelect(control,count,prefix){const value=Math.min(Number(control.value)||0,count-1);control.replaceChildren();for(let i=0;i<count;i++)element('option',{value:i,text:t(prefix,i+1)},control);control.value=String(value);}
    function fields(){const s=host.state(),l=host.layout(),sizes=tracks(s,l),mins=minimums(s,l);fillSelect(column,sizes.widths.length,'第 {0} 列');fillSelect(row,sizes.heights.length,'第 {0} 行');width.value=sizes.widths[Number(column.value)].toFixed(1);height.value=sizes.heights[Number(row.value)].toFixed(1);width.min=mins.widths[Number(column.value)];height.min=mins.heights[Number(row.value)];for(const el of [column,row,width,height,reset])el.disabled=host.enabled?.()===false;reset.disabled||=!s.grid?.manualTracks;}
    function refresh(){
      if(disposed)return;if(gesture&&(host.state()!==gesture.owner||host.project?.()!==gesture.project||host.root()!==gesture.svg))cancel(false);
      title.textContent=t('格子尺寸');note.textContent=t('拖动外框调整整张母版，拖动分隔柄调整行列；小图始终保持原比例。');visibilityText.textContent=t('显示母版与行列调节柄');colText.textContent=t('列宽（pt）');rowText.textContent=t('行高（pt）');reset.textContent=t('恢复自动格子尺寸');width.setAttribute('aria-label',t('列宽（pt）'));height.setAttribute('aria-label',t('行高（pt）'));fields();draw(gesture?.next?.layout||host.layout());
    }
    function draw(l){
      const svg=host.root();if(!svg)return;if(boundRoot!==svg){layer?.remove();boundRoot=svg;layer=document.createElementNS(NS,'g');layer.setAttribute('data-grid-resize-guides','true');layer.setAttribute('data-editor-guides','true');svg.append(layer);}layer.replaceChildren();if(!shown||host.enabled?.()===false)return;
      const s=host.state(),sizes=tracks(s,l),rect=svg.getBoundingClientRect(),ux=l.width/Math.max(1,rect.width),uy=l.height/Math.max(1,rect.height),gx=s.gapX??s.gap,gy=s.gapY??s.gap;
      const addSvg=(name,attributes,parent)=>{const node=document.createElementNS(NS,name);for(const [key,value]of Object.entries(attributes))node.setAttribute(key,value);parent.append(node);return node;};
      addSvg('rect',{x:0,y:0,width:l.width,height:l.height,fill:'none',stroke:'#7f99bf','stroke-opacity':'.6','stroke-width':'.8','vector-effect':'non-scaling-stroke','pointer-events':'none'},layer);
      for(const [axis,values,minimum]of [['widths',sizes.widths,minimums(s,l).widths],['heights',sizes.heights,minimums(s,l).heights]])for(let i=0;i<values.length-1;i++){
        const horizontal=axis==='heights',boundary=sum(values.slice(0,i+1))+(horizontal?gy:gx)*(i+.5),g=document.createElementNS(NS,'g');g.dataset.gridResize=axis;g.dataset.gridIndex=String(i);g.setAttribute('role','separator');g.setAttribute('tabindex','0');g.setAttribute('aria-orientation',horizontal?'horizontal':'vertical');g.setAttribute('aria-label',t(horizontal?'调整第 {0}、{1} 行高度':'调整第 {0}、{1} 列宽度',i+1,i+2));g.setAttribute('aria-valuemin',minimum[i]);g.setAttribute('aria-valuemax',values[i]+values[i+1]-minimum[i+1]);g.setAttribute('aria-valuenow',values[i].toFixed(1));g.style.cursor=horizontal?'ns-resize':'ew-resize';g.style.touchAction='none';
        const line=document.createElementNS(NS,'line'),hit=document.createElementNS(NS,'rect'),grip=document.createElementNS(NS,'rect'),length=horizontal?l.width:l.height;
        for(const [key,value]of Object.entries(horizontal?{x1:0,x2:length,y1:boundary,y2:boundary}:{x1:boundary,x2:boundary,y1:0,y2:length}))line.setAttribute(key,value);line.setAttribute('stroke','#7f99bf');line.setAttribute('stroke-opacity','.4');line.setAttribute('stroke-width','.65');line.setAttribute('vector-effect','non-scaling-stroke');line.style.pointerEvents='none';
        // Only the middle 28px grip is interactive, leaving data in cells free.
        const cx=horizontal?l.width/2:boundary,cy=horizontal?boundary:l.height/2;
        for(const [key,value]of Object.entries({x:cx-7*ux,y:cy-7*uy,width:14*ux,height:14*uy,fill:'transparent'}))hit.setAttribute(key,value);
        for(const [key,value]of Object.entries({x:cx-(horizontal?14:2)*ux,y:cy-(horizontal?2:14)*uy,width:(horizontal?28:4)*ux,height:(horizontal?4:28)*uy,rx:2*Math.min(ux,uy),fill:'#7f99bf',stroke:'white','stroke-width':.6,'vector-effect':'non-scaling-stroke'}))grip.setAttribute(key,value);
        g.append(line,hit,grip);
        // Repeat track grips near both ends, so tall figures can be resized
        // from the top without scrolling to their middle or bottom.
        for(const [end,along]of [['start',8*(horizontal?ux:uy)],['end',length-8*(horizontal?ux:uy)]]){
          const ex=horizontal?along:boundary,ey=horizontal?boundary:along,h=hit.cloneNode(),v=grip.cloneNode();
          h.setAttribute('x',ex-7*ux);h.setAttribute('y',ey-7*uy);
          v.setAttribute('x',ex-(horizontal?14:2)*ux);v.setAttribute('y',ey-(horizontal?2:14)*uy);v.dataset.trackGrip=end;g.append(h,v);
        }
        layer.append(g);
      }
      for(const edge of ['top','left','right','bottom','corner']){
        const corner=edge==='corner',vertical=edge==='right'||edge==='left',cx=edge==='left'?0:vertical||corner?l.width:edge==='top'?l.width*.25:l.width/2,cy=edge==='top'?0:vertical?l.height/2:l.height,label=t(corner?'调整整张母版大小；Shift 可自由调整比例':vertical?'调整整张母版宽度':'调整整张母版高度'),g=addSvg('g',{'data-grid-resize':'outer','data-grid-edge':edge,role:corner?'button':'separator',tabindex:'0','aria-label':label,'aria-keyshortcuts':corner?'ArrowLeft ArrowRight ArrowUp ArrowDown':'','aria-valuenow':(vertical?l.width:l.height).toFixed(1)},layer);
        if(!corner)g.setAttribute('aria-orientation',vertical?'vertical':'horizontal');g.style.cursor=corner?'nwse-resize':vertical?'ew-resize':'ns-resize';g.style.touchAction='none';
        addSvg('title',{},g).textContent=label;
        addSvg('rect',{x:cx-14*ux,y:cy-14*uy,width:28*ux,height:28*uy,fill:'transparent'},g);
        addSvg('rect',{x:cx-(corner?14:vertical?4:14)*ux,y:cy-(corner?14:vertical?14:4)*uy,width:(corner?28:vertical?8:28)*ux,height:(corner?28:vertical?28:8)*uy,rx:3*Math.min(ux,uy),fill:corner?'#ffffff':'#7f99bf',stroke:corner?'#5278ad':'white','stroke-width':1,'vector-effect':'non-scaling-stroke'},g);
        if(corner)addSvg('path',{d:`M ${cx-6*ux} ${cy+5*uy} L ${cx+5*ux} ${cy-6*uy} M ${cx-1*ux} ${cy+6*uy} L ${cx+6*ux} ${cy-1*uy}`,fill:'none',stroke:'#5278ad','stroke-width':1.5,'vector-effect':'non-scaling-stroke','pointer-events':'none'},g);
      }
    }
    const point=(event,svg,m=svg.getScreenCTM()?.inverse())=>{if(!m)throw Error('工程布局无效');return {x:m.a*event.clientX+m.c*event.clientY+m.e,y:m.b*event.clientX+m.d*event.clientY+m.f};};
    function capture(svg,l){const entries=[];for(const pos of l.positions){const node=svg.querySelector(`svg[data-panel="${pos.id}"]`);if(node&&host.state().panels[pos.id]?.layoutLock?.panel?.variant!==host.state().panels[pos.id]?.variant)entries.push({node,pos,metrics:JSON.parse(node.getAttribute('data-grid-panel')||'null'),attrs:Object.fromEntries(['x','y','width','height'].map(k=>[k,node.getAttribute(k)]))});}return entries;}
    function preview(){frame=0;const g=gesture;if(!g||!valid())return cancel(false);try{g.next=g.whole?planWhole(g.owner,g.base,g.value.width,g.value.height,{proportional:g.edge==='corner'&&!g.freeAspect}):plan(g.owner,g.base,g.axis,g.index,g.value,{adjacent:true});const byId=new Map(g.next.layout.positions.map(pos=>[pos.id,pos]));for(const entry of g.entries){const pos=byId.get(entry.pos.id),box=panelViewport(pos,entry.metrics||{width:Number(entry.attrs.width),height:Number(entry.attrs.height)},true);for(const [key,value]of Object.entries(box))entry.node.setAttribute(key,value);}
      if(g.whole){const l=g.next.layout;g.svg.setAttribute('viewBox',`0 0 ${l.width} ${l.height}`);g.svg.setAttribute('width',l.width+'pt');g.svg.setAttribute('height',l.height+'pt');g.svg.style.width=g.screen.width*l.width/g.base.width+'px';g.svg.style.height=g.screen.height*l.height/g.base.height+'px';host.previewCanvas?.(g.svg,l,g.next.state,g.base);}
      for(const rect of g.svg.querySelectorAll('[data-guide-slot]')){const key=rect.getAttribute('data-guide-slot'),pos=g.next.layout.positions.find(p=>p.id===key)||g.next.layout.cells.find(c=>key===`empty-${c.row}-${c.col}`);if(pos)for(const k of ['x','y','width','height'])rect.setAttribute(k,pos[k]);}
      for(const entry of g.decorations){const pos=byId.get(entry.id),old=entry.pos;if(!pos||!old)continue;if(entry.label){const x=pos.x+(entry.x-old.x)*pos.width/old.width,y=pos.y+(entry.y-old.y)*pos.height/old.height;entry.node.setAttribute('x',x);entry.node.setAttribute('y',y);const stretch=g.owner.panels[entry.id]?.label?.stretch;if(stretch&&stretch!==1)entry.node.setAttribute('transform',`translate(${x} ${y}) scale(${stretch} 1) translate(${-x} ${-y})`);}else entry.node.setAttribute('transform',`translate(${pos.x+pos.width/2-old.x-old.width/2} ${pos.y-old.y}) ${entry.transform||''}`);}
      if(typeof StudioLayoutLock!=='undefined')StudioLayoutLock.refresh(g.svg,g.next.state);host.previewDependents?.(g.svg,g.next.layout,g.next.state);draw(g.next.layout);status.textContent=t(g.next.clamped||g.minimumChanged?'格子已达到最小可读尺寸':'松开应用；Escape 取消');}catch(error){say(error.message);cancel();}}
    const valid=()=>gesture&&host.state()===gesture.owner&&host.project?.()===gesture.project&&host.root()===gesture.svg;
    function cancel(repaint=true){const g=gesture;if(!g)return false;gesture=null;if(frame)caf(frame);frame=0;try{g.svg.releasePointerCapture?.(g.pointer);}catch{}for(const entry of g.entries)for(const [k,value]of Object.entries(entry.attrs))value===null?entry.node.removeAttribute(k):entry.node.setAttribute(k,value);if(g.whole){for(const [key,value]of Object.entries(g.rootAttrs))value===null?g.svg.removeAttribute(key):g.svg.setAttribute(key,value);g.svg.style.width=g.rootStyle.width;g.svg.style.height=g.rootStyle.height;host.previewCanvas?.(g.svg,g.base,g.owner,g.base);}if(repaint)host.repaint();return true;}
    function down(event){
      const handle=event.target.closest?.('[data-grid-resize]');if(gesture){if(event.pointerId!==gesture.pointer){event.preventDefault();event.stopImmediatePropagation();cancel();}return;}if(!handle||event.button!==0||host.enabled?.()===false)return;event.preventDefault();event.stopImmediatePropagation();
      try{
        host.cancelOtherGestures?.();const owner=host.state(),project=host.project?.(),axis=handle.dataset.gridResize,whole=axis==='outer',edge=handle.dataset.gridEdge,index=Number(handle.dataset.gridIndex);let base=host.layout(),sizes=tracks(owner,base);
        const prepared=whole?planWhole(owner,base):plan(owner,base,axis,index,sizes[axis][index],{adjacent:true});
        if(owner.compactWhitespace||!owner.grid?.manualTracks){host.repaint(prepared.state);base=prepared.layout;sizes=tracks(owner,base);}
        const svg=host.root(),mapping=svg.getScreenCTM()?.inverse(),screen=svg.getBoundingClientRect(),byId=new Map(base.positions.map(pos=>[pos.id,pos])),decorations=[...svg.querySelectorAll('[data-panel-label],[data-panel-move]')].filter(node=>{const id=node.getAttribute('data-panel-label')||node.getAttribute('data-panel-move'),lock=owner.panels[id]?.layoutLock;return !node.hasAttribute('data-panel-label')||!(lock?.label||lock?.panel?.variant===owner.panels[id]?.variant&&lock?.panel?.label);}).map(node=>{const id=node.getAttribute('data-panel-label')||node.getAttribute('data-panel-move');return {node,id,pos:byId.get(id),label:node.hasAttribute('data-panel-label'),x:Number(node.getAttribute('x')),y:Number(node.getAttribute('y')),transform:node.getAttribute('transform')};}),startValue=whole?{width:base.width,height:base.height}:sizes[axis][index];
        gesture={owner,project,base,axis,whole,edge,index,svg,mapping,screen,pointer:event.pointerId,start:point(event,svg,mapping),startValue,value:startValue,freeAspect:!!event.shiftKey,entries:capture(svg,base),decorations,minimumChanged:prepared.clamped,next:null,rootAttrs:Object.fromEntries(['viewBox','width','height'].map(key=>[key,svg.getAttribute(key)])),rootStyle:{width:svg.style.width,height:svg.style.height}};
        svg.setPointerCapture?.(event.pointerId);say(prepared.clamped?'格子已达到最小可读尺寸':whole?'拖动调整母版大小；松开应用':'拖动调整列宽或行高；松开应用');
      }catch(error){say(error.message);}
    }
    function updateValue(event){const g=gesture,p=point(event,g.svg,g.mapping),dx=p.x-g.start.x,dy=p.y-g.start.y;g.freeAspect=!!event.shiftKey;if(!g.whole){g.value=g.startValue+(g.axis==='widths'?dx:dy);return;}g.value={width:g.startValue.width+(['bottom','top'].includes(g.edge)?0:g.edge==='left'?-dx:dx),height:g.startValue.height+(['right','left'].includes(g.edge)?0:g.edge==='top'?-dy:dy)};}
    function move(event){if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();if(!valid())return cancel();updateValue(event);if(!frame)frame=raf(preview);}
    function up(event){if(!gesture||event.pointerId!==gesture.pointer)return;event.preventDefault();event.stopImmediatePropagation();if(!valid())return cancel();updateValue(event);if(frame)caf(frame);frame=0;preview();const g=gesture;if(!g)return;gesture=null;try{g.svg.releasePointerCapture?.(g.pointer);}catch{}const changed=g.whole?Math.abs(g.next.actual.width-g.startValue.width)>.001||Math.abs(g.next.actual.height-g.startValue.height)>.001:Math.abs(g.next.actual-g.startValue)>.001;if(!g.next||!changed){host.repaint();return;}if(!host.commit(g.next.state,t(g.whole?'已调整母版大小':'已调整格子尺寸')))host.repaint();}
    function keyboard(event){
      const handle=event.target.closest?.('[data-grid-resize]');if(event.key==='Escape'&&gesture){event.preventDefault();event.stopImmediatePropagation();cancel();return;}
      if(!handle||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)||host.enabled?.()===false)return;
      const axis=handle.dataset.gridResize,whole=axis==='outer',edge=handle.dataset.gridEdge,horizontal=['ArrowLeft','ArrowRight'].includes(event.key);
      if((axis==='widths'||whole&&['right','left'].includes(edge))&&!horizontal||(axis==='heights'||whole&&['bottom','top'].includes(edge))&&horizontal)return;
      event.preventDefault();event.stopImmediatePropagation();const index=Number(handle.dataset.gridIndex),s=host.state(),l=host.layout(),delta=(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)*(event.shiftKey?10:1);
      try{let w=l.width+(horizontal?(edge==='left'?-delta:delta):0),h=l.height+(horizontal?0:edge==='top'?-delta:delta);if(whole&&edge==='corner'&&!event.altKey){if(horizontal)h=w*l.height/l.width;else w=h*l.width/l.height;}const result=whole?planWhole(s,l,w,h,{proportional:edge==='corner'&&!event.altKey}):plan(s,l,axis,index,tracks(s,l)[axis][index]+delta,{adjacent:true});host.commit(result.state,t(whole?'已调整母版大小':'已调整格子尺寸'));host.root()?.querySelector(whole?`[data-grid-resize="outer"][data-grid-edge="${edge}"]`:`[data-grid-resize="${axis}"][data-grid-index="${index}"]`)?.focus();if(result.clamped)say('格子已达到最小可读尺寸');}catch(error){say(error.message);}
    }
    function change(axis,control,index){if(host.enabled?.()===false)return;try{const result=plan(host.state(),host.layout(),axis,Number(index.value),Number(control.value));host.commit(result.state,t('已调整格子尺寸'));if(result.clamped)say('格子已达到最小可读尺寸');}catch(error){say(error.message);fields();}}
    check.onchange=()=>{shown=check.checked;refresh();};column.onchange=row.onchange=fields;width.onchange=()=>change('widths',width,column);height.onchange=()=>change('heights',height,row);
    reset.onclick=()=>{if(host.enabled?.()===false)return;const next=copy(host.state());if(!next.grid?.manualTracks)return;delete next.grid.manualTracks;delete next.grid.widths;delete next.grid.heights;if(hasUncapturedPanelLock(next))return say('调整会改变已锁定小图的格子，请先解锁');host.commit(next,t('已恢复自动格子尺寸'));};
    const abort=event=>{if(gesture&&(!event?.pointerId||event.pointerId===gesture.pointer))cancel();},blur=()=>cancel();viewport.addEventListener('pointerdown',down,true);viewport.addEventListener('pointermove',move,true);viewport.addEventListener('pointerup',up,true);viewport.addEventListener('pointercancel',abort,true);viewport.addEventListener('lostpointercapture',abort,true);viewport.addEventListener('keydown',keyboard,true);view.addEventListener('blur',blur);view.addEventListener('keydown',keyboard,true);
    return {refresh,cancel,destroy(){cancel(false);disposed=true;layer?.remove();controls.replaceChildren();for(const [name,fn]of [['pointerdown',down],['pointermove',move],['pointerup',up],['pointercancel',abort],['lostpointercapture',abort],['keydown',keyboard]])viewport.removeEventListener(name,fn,true);view.removeEventListener('blur',blur);view.removeEventListener('keydown',keyboard,true);}};
  }
  return {tracks,minimums,positions,panelViewport,plan,planWhole,create};
});
