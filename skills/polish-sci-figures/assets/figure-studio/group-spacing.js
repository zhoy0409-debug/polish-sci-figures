/* Category spacing translates complete groups along their categorical axis.
 * It never scales responses, markers, intervals or typography. */
'use strict';
const StudioGroupSpacing = (() => {
  const previous=new WeakMap();
  const normal=value=>String(value??'').trim().replace(/\s+/g,' ');
  const numeric=value=>/^[+−-]?(?:\d*\.)?\d+(?:[eE][+−-]?\d+)?%?$/.test(value);
  // These views use cell adjacency, continuous coordinates or angles as data.
  // Their category-looking labels are not independent movable data groups.
  const excludedViews=new Set(['correlation_circles','correlation_values','singlecell_dots','oncoprint_matrix','clustered_matrix','antibiogram_matrix','bias_risk_matrix','missingness_matrix','classification_counts','upset_intersections','composition_mosaic','composition_pictogram','phylogeny_traits','rose_frequency','radar_profile','survival_risk_counts','time_seasonal','time_epidemic','time_cumulative','roc_with_auc_forest']);
  const connectedViews=new Set(['variance_scree','parallel_coordinates','compare_paired_lines','compare_paired_change','compare_interaction','paired_slope','compare_bracket_stars','compare_bracket_p']);
  const annotationViews=new Set(['parallel_coordinates','gene_arrows','compare_bracket_stars','compare_bracket_p','compare_control_symbols']);
  const extent=(b,direction)=>direction==='y'?{start:b.top,end:b.bottom}:{start:b.left,end:b.right};
  const finiteBox=b=>b&&['left','right','top','bottom'].every(k=>Number.isFinite(b[k]))&&b.right>=b.left&&b.bottom>=b.top;
  const merge=boxes=>({left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))});
  function inHost(svg,fn){
    if(svg.isConnected||typeof document==='undefined')return fn();
    const parent=svg.parentNode,next=svg.nextSibling,host=document.createElement('div');
    host.style.cssText='position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none';host.append(svg);document.body.append(host);
    try{return fn();}finally{if(parent)parent.insertBefore(svg,next);else svg.remove();host.remove();}
  }
  function point(svg,el,x,y){
    const root=svg.getScreenCTM(),own=el.getScreenCTM();if(!root||!own)throw Error('Geometry is unavailable');
    const m=root.inverse().multiply(own);return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
  }
  function box(svg,node,measure){
    if(measure)return measure(node,svg);
    const b=node.getBBox(),corners=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>point(svg,node,x,y));
    return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
  }
  function axisFrame(svg,axis,measure){
    const relative=svg.getScreenCTM()?.inverse().multiply(axis.getScreenCTM());
    // Rotated or skewed data axes need movement in a different coordinate basis.
    // Do not pretend a horizontal screen drag preserves their response values.
    if(!relative||Math.abs(relative.b)>1e-8||Math.abs(relative.c)>1e-8||relative.a<=0||relative.d<=0)return null;
    for(const node of axis.querySelectorAll('[clip-path]')){
      const id=node.getAttribute('clip-path')?.match(/url\(#([^\s)]+)\)/)?.[1],rect=id&&svg.querySelector(`[id="${id}"] rect`);
      if(!rect)continue;
      const x=Number(rect.getAttribute('x')),y=Number(rect.getAttribute('y')),w=Number(rect.getAttribute('width')),h=Number(rect.getAttribute('height'));
      if(rect.parentNode.getAttribute('clipPathUnits')==='objectBoundingBox'||rect.getAttribute('transform'))return null;
      // The clip rectangle is defined in the axes' user coordinates, not at
      // the document-level location of its <defs> declaration.
      const p=point(svg,axis,x,y),q=point(svg,axis,x+w,y+h),b={left:p.x,right:q.x,top:p.y,bottom:q.y};
      if(finiteBox(b)&&b.right>b.left&&b.bottom>b.top)return b;
    }
    return null;
  }
  function tickCenter(svg,tick,measure,direction='x'){
    const use=tick.querySelector('use');
    if(use){const x=Number(use.getAttribute('x')),y=Number(use.getAttribute('y'));if(Number.isFinite(x)&&Number.isFinite(y))return point(svg,use,x,y)[direction];}
    const text=tick.querySelector('text');if(!text)return NaN;
    const x=text.getAttribute('x'),y=text.getAttribute('y');
    if(x!==null&&y!==null)return point(svg,text,Number(x),Number(y))[direction];
    const b=extent(box(svg,text,measure),direction);return (b.start+b.end)/2;
  }
  function uniqueTop(nodes){return [...new Set(nodes)].filter(node=>!nodes.some(other=>other!==node&&other.contains(node)));}
  function validateMetadata(value){
    try{
      if(typeof value==='string'){if(value.length>131072)return false;value=JSON.parse(value);}
      const ids=new Set(),axes=new Set(),id=value=>typeof value==='string'&&/^[A-Za-z_][\w.:-]{0,159}$/.test(value),keys=(record,allowed)=>record&&typeof record==='object'&&!Array.isArray(record)&&Object.keys(record).every(key=>allowed.includes(key));
      if(!keys(value,['version','axes'])||value.version!==1||!Array.isArray(value.axes)||!value.axes.length||value.axes.length>32)return false;
      for(const axis of value.axes){
        if(!keys(axis,['axis','groups','direction'])||axis.direction!==undefined&&!['x','y'].includes(axis.direction)||!id(axis.axis)||axes.has(axis.axis)||!Array.isArray(axis.groups)||axis.groups.length<2||axis.groups.length>32)return false;axes.add(axis.axis);
        const labels=new Set();
        for(const group of axis.groups){
          if(!keys(group,['label','tick','members'])||typeof group.label!=='string'||!normal(group.label)||group.label.length>4000||labels.has(normal(group.label))||!id(group.tick)||!Array.isArray(group.members)||!group.members.length||group.members.length>64)return false;
          if(group.members.some(member=>!id(member)||ids.has(member))||new Set(group.members).size!==group.members.length||!group.members.includes(group.tick))return false;
          labels.add(normal(group.label));group.members.forEach(member=>ids.add(member));
        }
      }
      return true;
    }catch{return false;}
  }
  function metadata(svg){
    const nodes=[...svg.querySelectorAll('metadata')].filter(node=>/(?:^|-)studio-category-groups$/.test(node.id||''));if(!nodes.length)return null;
    try{const records=nodes.map(node=>JSON.parse(node.textContent));if(!records.every(validateMetadata))return null;const record={version:1,axes:records.flatMap(value=>value.axes)};return validateMetadata(record)?record:null;}catch{return null;}
  }
  function namespaceMetadata(svg,prefix){
    if(typeof prefix!=='string'||!/^[A-Za-z_][\w.:-]*$/.test(prefix))throw Error('Invalid category namespace');
    for(const node of svg.querySelectorAll('metadata'))if(/(?:^|-)studio-category-groups$/.test(node.id||'')&&validateMetadata(node.textContent)){
      const record=JSON.parse(node.textContent);for(const axis of record.axes){axis.axis=prefix+axis.axis;for(const group of axis.groups){group.tick=prefix+group.tick;group.members=group.members.map(id=>prefix+id);}}
      node.textContent=JSON.stringify(record);
    }
  }
  function explicitAxis(svg,record,options){
    const axis=svg.querySelector(`[id="${record.axis}"]`),frame=axis&&axisFrame(svg,axis,options.measure);if(!axis||!frame||!Array.isArray(record.groups)||record.groups.length<2)return null;
    const groups=[],direction=record.direction||'x';
    for(const entry of record.groups){
      const tick=svg.querySelector(`[id="${entry.tick}"]`),members=(entry.members||[]).map(id=>svg.querySelector(`[id="${id}"]`));
      if(!tick||!members.length||members.some(node=>!node||!axis.contains(node)))return null;
      const center=tickCenter(svg,tick,options.measure,direction),nodes=uniqueTop(members),bounds=merge(nodes.map(node=>box(svg,node,options.measure)));
      if(!Number.isFinite(center)||!finiteBox(bounds))return null;
      const texts=nodes.flatMap(node=>node.matches('text')?[node]:[...node.querySelectorAll('text')]);
      const dataNodes=nodes.filter(node=>node!==tick&&!node.matches('text')&&!node.querySelector('text'));
      if(!dataNodes.length)return null;
      groups.push({label:normal(entry.label),center,...bounds,dataBounds:merge(dataNodes.map(node=>box(svg,node,options.measure))),nodes,texts});
    }
    groups.sort((a,b)=>a.center-b.center);
    return validAxis({id:record.axis,axis,frame,groups,direction,connections:[],explicit:true});
  }
  function validAxis(result){
    const {groups,frame,direction='x'}=result,limits=extent(frame,direction);
    if(groups.some((g,i)=>!g.label||i&&g.center<=groups[i-1].center)||new Set(groups.map(g=>g.label)).size!==groups.length)return null;
    // A clipped source cannot safely be reconstructed by moving a visible crop.
    if(groups.some(g=>{const b=extent(g.dataBounds,direction);return b.start<limits.start-.5||b.end>limits.end+.5;}))return null;
    return result;
  }
  function connection(svg,node,groups,direction){
    if(node.localName!=='path')return null;
    const source=node.getAttribute('d')||'',tokens=source.match(/[ML]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/ig)||[];
    if(!source.trim()||source.replace(/[ML]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?|[\s,]/ig,'')||tokens.length%3||tokens.length<6)return null;
    const vertices=[];
    for(let i=0;i<tokens.length;i+=3){if(!['M','L'].includes(tokens[i]))return null;const x=Number(tokens[i+1]),y=Number(tokens[i+2]),p=point(svg,node,x,y),matches=groups.flatMap((g,j)=>Math.abs(g.center-p[direction])<.35?[j]:[]);if(matches.length!==1)return null;vertices.push({command:tokens[i],x,y,index:matches[0]});}
    if(new Set(vertices.map(v=>v.index)).size<2)return null;
    return {node,source,vertices};
  }
  function inferredAxis(svg,axis,options,direction='x'){
    const ticks=[...axis.querySelectorAll(`[id^="${direction}tick_"]`)],labels=ticks.map(t=>normal([...t.querySelectorAll('text')].map(n=>n.textContent).join(' ')));
    if(ticks.length<2||ticks.length>32||labels.some(x=>!x)||new Set(labels).size!==labels.length)return null;
    const declared=(options.orders||[]).some(order=>Array.isArray(order)&&order.length===labels.length&&order.every((name,i)=>normal(name)===labels[i]));
    if(!declared&&labels.some(numeric))return null;
    const frame=axisFrame(svg,axis,options.measure);if(!frame)return null;
    const groups=ticks.map((tick,i)=>({label:labels[i],sourceIndex:i,center:tickCenter(svg,tick,options.measure,direction),nodes:[tick],texts:[...tick.querySelectorAll('text')]})).sort((a,b)=>a.center-b.center);
    if(groups.some((g,i)=>!Number.isFinite(g.center)||i&&g.center<=groups[i-1].center))return null;
    const limits=extent(frame,direction),spans=groups.map((g,i)=>[i?(groups[i-1].center+g.center)/2:limits.start,i<groups.length-1?(g.center+groups[i+1].center)/2:limits.end]);
    const artists=[...axis.children].filter(el=>/^(PathCollection|PolyCollection|FillBetweenPolyCollection|LineCollection|line2d_|patch_|studio-mark-|studio-spacing-group-\d+-(?:density|outline|median))/.test(el.id||'')&&el.querySelector('[clip-path]'));
    if(!artists.length)return null;
    const counts=groups.map(()=>0),connections=[],annotations=[];
    for(const artist of artists){
      const index=artist.id.match(/^studio-spacing-group-(\d+)-(?:density|outline|median)$/)?.[1],mapped=index!==undefined?groups.findIndex(g=>g.sourceIndex===Number(index)):-1;
      if(mapped>=0){groups[mapped].nodes.push(artist);counts[mapped]++;continue;}
      let nodes=[artist],b=box(svg,artist,options.measure),along=extent(b,direction);
      // One collection may hold a separate CI path/marker for each category.
      // Split only its independent primitives; never split a connecting path.
      if(!spans.some(([left,right])=>along.start>=left-.25&&along.end<=right+.25))nodes=[...artist.querySelectorAll('path,use,line,rect,circle,ellipse')].filter(n=>!n.closest('defs'));
      if(!nodes.length)return null;
      for(const node of nodes){
        b=box(svg,node,options.measure);if(!finiteBox(b))return null;along=extent(b,direction);
        // A full-width horizontal reference is fixed; it is not a group glyph.
        const across=extent(b,direction==='x'?'y':'x');
        if(across.end-across.start<.01&&along.start<=limits.start+.5&&along.end>=limits.end-.5)continue;
        const matches=spans.flatMap(([left,right],i)=>along.start>=left-.25&&along.end<=right+.25?[i]:[]);
        if(matches.length!==1){const joined=connectedViews.has(options.view)&&connection(svg,node,groups,direction);if(joined){connections.push(joined);continue;}return null;}
        groups[matches[0]].nodes.push(node);counts[matches[0]]++;
      }
    }
    // Native text inside a data axis may be a comparison label. Only a title
    // above the frame is unambiguously independent of the category positions.
    for(const child of axis.children)if(/^(?:text_|studio-spacing-(?:comparison-label|group)-)/.test(child.id||'')){
      const texts=[...child.querySelectorAll('text')],b=box(svg,child,options.measure);if(!texts.length||b.bottom<=frame.top+.5)continue;
      if(!annotationViews.has(options.view))return null;
      const pair=child.id.match(/^studio-spacing-comparison-label-(\d+)-(\d+)$/),single=child.id.match(/^studio-spacing-group-(\d+)-label(?:-\d+)?$/);
      if(pair){const indices=pair.slice(1).map(index=>groups.findIndex(g=>g.sourceIndex===Number(index)));if(indices.some(i=>i<0))return null;annotations.push({node:child,indices,bounds:b});continue;}
      if(single){const index=groups.findIndex(g=>g.sourceIndex===Number(single[1]));if(index<0)return null;groups[index].nodes.push(child);continue;}
      const center=(b.left+b.right)/2,category=groups.flatMap((g,i)=>Math.abs(g.center-center)<.7?[i]:[]);
      if(category.length===1){groups[category[0]].nodes.push(child);continue;}
      const joined=connections.filter(c=>Math.abs((Math.min(...c.vertices.map(v=>groups[v.index].center))+Math.max(...c.vertices.map(v=>groups[v.index].center)))/2-center)<1);
      if(joined.length){annotations.push({node:child,indices:[...new Set(joined[0].vertices.map(v=>v.index))],bounds:b});continue;}
      // Fixed explanatory text above the highest observation is independent of
      // categories; unmatched text inside the data body remains unsafe.
      if(options.view==='compare_control_symbols'&&normal(child.textContent).startsWith('Compared with '))continue;
      return null;
    }
    // The Cumming effect axis deliberately has no glyph for its reference
    // group. Its tick still belongs to the shared category coordinate system.
    if(counts.some(count=>!count)&&!(options.view==='compare_cumming'&&counts.some(Boolean)))return null;
    for(const group of groups){group.nodes=uniqueTop(group.nodes);const data=group.nodes.slice(1);group.dataBounds=data.length?merge(data.map(node=>box(svg,node,options.measure))):{left:group.center,right:group.center,top:frame.top,bottom:frame.bottom};Object.assign(group,merge(group.nodes.map(node=>box(svg,node,options.measure))));}
    return validAxis({id:axis.id,axis,frame,groups,direction,connections,annotations,explicit:false});
  }
  function inspect(svg,options={}){
    try{return inHost(svg,()=>{
      // Existing bar geometry has its own complete artist map and controls.
      if(svg.querySelector('[id^="studio-bar-"]'))return {available:false,axes:[],reason:'existing-bar-layout'};
      if(excludedViews.has(options.view))return {available:false,axes:[],reason:'coordinate-structure-must-remain-fixed'};
      const declared=metadata(svg),sourceAxes=[...svg.querySelectorAll('[id^="axes_"]')];
      // An imported matrix may have no template name. Never infer independent
      // groups from only one direction of a two-categorical-axis cell grid.
      if(!declared&&sourceAxes.some(axis=>['x','y'].every(direction=>{const labels=[...axis.querySelectorAll(`[id^="${direction}tick_"]`)].map(t=>normal([...t.querySelectorAll('text')].map(n=>n.textContent).join(' ')));return labels.length>1&&labels.every(label=>label&&!numeric(label));})))return {available:false,axes:[],reason:'coordinate-structure-must-remain-fixed'};
      const axes=declared?declared.axes.map(record=>explicitAxis(svg,record,options)).filter(Boolean):sourceAxes.map(axis=>inferredAxis(svg,axis,options,'x')||inferredAxis(svg,axis,options,'y')).filter(Boolean);
      return {available:!!axes.length,axes,reason:axes.length?'':'no-unambiguous-category-groups'};
    });}catch{return {available:false,axes:[],reason:'unavailable-category-geometry'};}
  }
  function plan(info,factor=1){
    if(!Number.isFinite(factor)||factor<=0)throw Error('Group spacing must be a finite positive number');
    if(!info.available)return {...info,requestedFactor:factor,factor:1};
    let low=0,high=Infinity;
    for(const axis of info.axes){
      const gs=axis.groups,center=(gs[0].center+gs.at(-1).center)/2,direction=axis.direction||'x',limits=extent(axis.frame,direction);
      for(let i=1;i<gs.length;i++){
        const previous=gs[i-1],g=gs[i],gap=g.center-previous.center;
        low=Math.max(low,(extent(previous,direction).end-previous.center+g.center-extent(g,direction).start+4)/gap);
      }
      for(const g of gs){const b=extent(g,direction),d=g.center-center,left=Math.min(limits.start,b.start),right=Math.max(limits.end,b.end);if(d<0)high=Math.min(high,(g.center-b.start+left-center)/d);else if(d>0)high=Math.min(high,(right-(b.end-g.center)-center)/d);}
      for(const label of axis.annotations||[]){const anchor=label.indices.reduce((sum,i)=>sum+gs[i].center,0)/label.indices.length,d=anchor-center,b=extent(label.bounds,direction),left=Math.min(limits.start,b.start),right=Math.max(limits.end,b.end);if(d<0)high=Math.min(high,1+(left-b.start)/d);else if(d>0)high=Math.min(high,1+(right-b.end)/d);}
    }
    // Do not unexpectedly expand already-overlapping native labels on inspection.
    if(high<low||high<=0)return {...info,available:false,requestedFactor:factor,factor:1,reason:'insufficient-group-space'};
    const actual=Math.min(high,Math.max(low,factor));
    return {...info,requestedFactor:factor,factor:actual,minFactor:low,maxFactor:high,axes:info.axes.map(axis=>{const center=(axis.groups[0].center+axis.groups.at(-1).center)/2;return {...axis,groups:axis.groups.map(g=>({...g,delta:(g.center-center)*(actual-1),newCenter:center+(g.center-center)*actual}))};})};
  }
  function restore(svg){
    const record=previous.get(svg);if(!record)return;
    for(const [node,transform]of record.transforms)if(transform===null)node.removeAttribute('transform');else node.setAttribute('transform',transform);
    for(const [node,d]of record.paths||[])node.setAttribute('d',d);
    for(const node of record.texts){node.removeAttribute('data-studio-category-center');node.removeAttribute('data-studio-category-center-y');}
    previous.delete(svg);
  }
  function translate(svg,node,delta,direction='x'){
    const root=svg.getScreenCTM(),parent=node.parentNode.getScreenCTM(),p=root.inverse().multiply(parent),k=p.a*p.d-p.b*p.c;
    if(!Number.isFinite(k)||Math.abs(k)<1e-12)throw Error('Invalid group transform');
    const own=node.transform?.baseVal.consolidate()?.matrix||{a:1,b:0,c:0,d:1,e:0,f:0};
    const dx=direction==='x'?delta:0,dy=direction==='y'?delta:0;
    node.setAttribute('transform',`matrix(${own.a} ${own.b} ${own.c} ${own.d} ${own.e+(p.d*dx-p.c*dy)/k} ${own.f+(-p.b*dx+p.a*dy)/k})`);
  }
  function moveConnection(svg,entry,axis){
    const m=svg.getScreenCTM().inverse().multiply(entry.node.getScreenCTM()),k=m.a*m.d-m.b*m.c;if(Math.abs(k)<1e-12)throw Error('Invalid connection transform');
    entry.node.setAttribute('d',entry.vertices.map(v=>{const delta=axis.groups[v.index].delta,dx=axis.direction==='y'?0:delta,dy=axis.direction==='y'?delta:0;return `${v.command} ${v.x+(m.d*dx-m.c*dy)/k} ${v.y+(-m.b*dx+m.a*dy)/k}`;}).join(' '));
  }
  function apply(svg,factor=1,options={}){
    restore(svg);
    const recordStatus=result=>{svg.setAttribute('data-studio-group-spacing-requested',factor);svg.setAttribute('data-studio-group-spacing-actual',result.factor);svg.setAttribute('data-studio-group-spacing-available',String(result.available));svg.setAttribute('data-studio-group-spacing-reason',result.reason||'');return result;};
    return inHost(svg,()=>{
      const result=plan(inspect(svg,options),factor),record={transforms:[],texts:[],paths:[]};
      if(result.available)try{
        for(const axis of result.axes){
          for(const group of axis.groups){
            for(const node of group.nodes){record.transforms.push([node,node.getAttribute('transform')]);if(Math.abs(group.delta)>1e-9)translate(svg,node,group.delta,axis.direction);}
            for(const text of group.texts){text.setAttribute(axis.direction==='y'?'data-studio-category-center-y':'data-studio-category-center',group.newCenter);record.texts.push(text);}
          }
          for(const entry of axis.connections||[]){record.paths.push([entry.node,entry.source]);moveConnection(svg,entry,axis);}
          for(const label of axis.annotations||[]){const delta=label.indices.reduce((n,i)=>n+axis.groups[i].delta,0)/label.indices.length;record.transforms.push([label.node,label.node.getAttribute('transform')]);translate(svg,label.node,delta,axis.direction);}
        }
        previous.set(svg,record);
      }catch(error){previous.set(svg,record);restore(svg);return recordStatus({available:false,axes:[],requestedFactor:factor,factor:1,reason:'invalid-category-transform'});}
      return recordStatus(result);
    });
  }
  return {inspect,plan,apply,restore,validateMetadata,namespaceMetadata};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioGroupSpacing;
