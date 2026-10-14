/* Style marks independently of bars, connecting lines and shared SVG symbols. */
'use strict';
const StudioMarkStyle=(()=>{
  const NS='http://www.w3.org/2000/svg',number=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e8;
  // Keep source geometry separate from the appearance preview. A second
  // slider event must not treat the caps it created as new interval stems.
  const sourceGeometry=new WeakMap(),sourceDisplay=new WeakMap();
  function originalGeometry(node){
    if(!sourceGeometry.has(node))sourceGeometry.set(node,{d:node.getAttribute('d'),transform:node.getAttribute('transform')});
    return sourceGeometry.get(node);
  }
  function display(node,hidden){
    if(!sourceDisplay.has(node))sourceDisplay.set(node,node.style.display);
    const value=hidden?'none':sourceDisplay.get(node);if(value)node.style.display=value;else node.style.removeProperty('display');
  }
  function lineEnds(path){
    const d=originalGeometry(path).d||'',values=d.match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/ig)?.map(Number);
    return /^\s*M\s*[-+\d.]/.test(d)&&!d.replace(/[ML]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?|[\s,]/g,'')&&values?.length===4&&values.every(number)?[[values[0],values[1]],[values[2],values[3]]]:null;
  }
  function localSegment(path,segment){
    const ends=lineEnds(path);if(!ends)return {...segment,ends:segment.ends.map(p=>[...p]),center:segment.center&&[...segment.center]};
    // Matplotlib's metadata uses figure coordinates; the actual SVG stem may
    // have its own local coordinates and transform after importing/editing.
    // Interpolate the real estimate along the immutable stem, including
    // asymmetric and logarithmic intervals, rather than guessing a midpoint.
    const dimension=segment.axis==='y'?1:0,span=segment.ends[1][dimension]-segment.ends[0][dimension],t=segment.center&&Math.abs(span)>1e-12?(segment.center[dimension]-segment.ends[0][dimension])/span:null;
    return {...segment,ends,center:t===null?null:ends[0].map((v,i)=>v+t*(ends[1][i]-v))};
  }
  function localInterval(local,segment,direction){
    if(direction==='both'||!local.center||segment.axis!=='y')return local.ends;
    const upper=segment.ends[0][1]<segment.ends[1][1]?0:1,lower=1-upper;
    return direction==='positive'?[local.center,local.ends[upper]]:[local.ends[lower],local.center];
  }
  const coordinate=p=>Array.isArray(p)&&p.length===2&&p.every(number),id=s=>typeof s==='string'&&/^[\w.:-]{1,160}$/.test(s);
  const source=s=>s===undefined||s&&id(s.id)&&['fill','stroke'].includes(s.paint);
  function validateMetadata(text){try{const m=JSON.parse(text);return m.version===1&&Array.isArray(m.points)&&m.points.length<=10000&&m.points.every(id)
    &&(m.pointColors===undefined||Array.isArray(m.pointColors)&&m.pointColors.length<=10000&&m.pointColors.every(p=>id(p.id)&&source(p.colorSource)&&(p.kind===undefined||['collection','line'].includes(p.kind))&&(p.centers===undefined||Array.isArray(p.centers)&&p.centers.length<=100000&&p.centers.every(coordinate))))
    &&Array.isArray(m.errors)&&m.errors.length<=10000&&m.errors.every(e=>id(e.id)&&source(e.colorSource)&&(e.capWidth===undefined||(number(e.capWidth)&&e.capWidth>=0&&e.capWidth<=100))&&(e.lineWidth===undefined||(number(e.lineWidth)&&e.lineWidth>=0&&e.lineWidth<=100))&&Array.isArray(e.caps)&&e.caps.every(id)&&Array.isArray(e.segments)&&e.segments.length<=100000&&e.segments.every(s=>source(s.colorSource)&&['x','y'].includes(s.axis)&&Array.isArray(s.ends)&&s.ends.length===2&&s.ends.every(coordinate)&&(s.center===null||coordinate(s.center))));}catch{return false;}}
  const find=(svg,key)=>svg.querySelector('[id="'+key+'"]')||[...svg.querySelectorAll('[id]')].find(e=>e.id.endsWith('-'+key));
  function inspect(svg){
    const meta=[...svg.querySelectorAll('metadata')].find(e=>/(?:^|-)studio-mark-styles$/.test(e.id));
    if(meta&&validateMetadata(meta.textContent)){const m=JSON.parse(meta.textContent);return {points:m.points.map(key=>find(svg,key)).filter(Boolean),pointColors:m.pointColors||[],errors:m.errors.map(e=>({...e,node:find(svg,e.id)})).filter(e=>e.node),semantic:true};}
    const points=[...svg.querySelectorAll('g[id]')].filter(g=>/(?:^|-)PathCollection_\d+$|studio-group-\d+-points$|studio-mark-.*-(?:points|marker)-\d+$/.test(g.id));
    return {points,pointColors:[],errors:[],semantic:false};
  }
  function interval(segment,direction){
    const ends=segment.ends.map(p=>[...p]);if(direction==='both'||!segment.center||segment.axis!=='y')return ends;
    const upper=ends[0][1]<ends[1][1]?ends[0]:ends[1],lower=ends[0][1]<ends[1][1]?ends[1]:ends[0];
    return direction==='positive'?[segment.center,upper]:[lower,segment.center];
  }
  function scaleMark(use,factor,center){
    const x=center?center[0]:Number(use.getAttribute('x')||0),y=center?center[1]:Number(use.getAttribute('y')||0),base=use.getAttribute('transform')||'';
    use.setAttribute('transform',base+' translate('+x+' '+y+') scale('+factor+') translate('+(-x)+' '+(-y)+')');
  }
  const hex=value=>{
    const s=String(value||'').trim().toLowerCase();
    if(/^#[a-f0-9]{6}$/.test(s))return s;
    if(/^#[a-f0-9]{3}$/.test(s))return '#'+[...s.slice(1)].map(x=>x+x).join('');
    const rgb=s.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
    return rgb&&rgb.slice(1).every(x=>Number(x)<=255)?'#'+rgb.slice(1).map(x=>Number(x).toString(16).padStart(2,'0')).join(''):null;
  };
  function apply(svg,style={},direction='both',context={}){
    const info=inspect(svg),edits=context.edits||{},palette=context.palette||{},factor=style.pointScale??1;
    info.paintChanges=[];info.paintTargets={point:[],error:[]};
    const key=node=>node.getAttribute('data-key');
    function rawPaint(node,prop){
      for(let p=node;p&&p!==svg;p=p.parentElement){const value=p.style?.getPropertyValue(prop)||p.getAttribute(prop);if(value)return value;}
      if(node.localName==='use'){const href=node.getAttribute('href')||node.getAttribute('xlink:href'),ref=href?.startsWith('#')?find(svg,href.slice(1)):null;if(ref)return ref.style?.getPropertyValue(prop)||ref.getAttribute(prop)||'';}
      return prop==='fill'?'#000000':'';
    }
    const currentPaint=(node,prop)=>edits[key(node)]?.[prop]??rawPaint(node,prop);
    const glyphs=group=>{
      const uses=[...group.querySelectorAll('use')].filter(n=>!n.closest('defs')),meta=info.pointColors.find(p=>find(svg,p.id)===group);
      return uses.length?uses:(meta?.kind==='collection'||/(?:PathCollection_\d+|points(?:-\d+)?)$/.test(group.id))?[...group.querySelectorAll('path')].filter(n=>!n.closest('defs')):[];
    };
    function ownGroupColor(node){
      const fill=hex(rawPaint(node,'fill')),stroke=hex(rawPaint(node,'stroke')),prop=fill&&fill!=='#ffffff'?'fill':stroke?'stroke':'fill',original=hex(rawPaint(node,prop));
      return original&&(palette[original]||palette[original.toUpperCase()])||original||'#20242a';
    }
    function sourceColor(ref,fallback,visited=new Set()){
      if(!ref)return fallback;const group=find(svg,ref.id);if(!group||visited.has(group))return fallback;visited.add(group);
      if(info.points.includes(group)){
        const meta=info.pointColors.find(p=>find(svg,p.id)===group);
        if(meta?.colorSource&&find(svg,meta.colorSource.id)!==group)return sourceColor(meta.colorSource,fallback,visited);
        const hasDataLine=meta?.kind==='line'&&[...group.querySelectorAll('path')].some(n=>!n.closest('defs'));
        if(!hasDataLine){
          // These markers are also an interval's semantic series source. Their
          // saved per-point overrides are independent of the group palette.
          const node=glyphs(group)[0];return node?ownGroupColor(node):fallback;
        }
      }
      const candidates=[group,...group.querySelectorAll('path,use,rect,circle,ellipse,polygon,line')].filter(n=>!n.closest('defs'));
      const node=candidates.find(n=>n.style?.getPropertyValue(ref.paint)||n.hasAttribute(ref.paint)||edits[key(n)]?.[ref.paint]);
      return node?hex(currentPaint(node,ref.paint))||fallback:fallback;
    }
    // Resolve all sources before painting, so custom point colours cannot change error-bar group colours.
    const pointPlans=info.points.map(group=>{const meta=info.pointColors.find(p=>find(svg,p.id)===group),nodes=glyphs(group);return {group,collection:meta?.kind==='collection'||/(?:PathCollection_\d+|points(?:-\d+)?)$/.test(group.id),nodes:nodes.map((node,i)=>({node,center:meta?.centers?.length===nodes.length?meta.centers[i]:null,color:sourceColor(meta?.colorSource,ownGroupColor(node))}))};});
    const errorPlans=info.errors.map(error=>{const paths=[...error.node.querySelectorAll('path')].filter(p=>!p.closest('defs')&&!p.hasAttribute('data-studio-cap'));return {error,paths,colors:error.segments.map((s,i)=>sourceColor(s.colorSource||error.colorSource,paths[i]?hex(currentPaint(paths[i],'stroke')):null))};});
    let cloneIndex=0;const symbolCopies=new Map();
    function symbolPaint(node,properties){
      if(node.localName!=='use'||!properties.length)return;
      const href=node.getAttribute('href')||node.getAttribute('xlink:href'),ref=href?.startsWith('#')?find(svg,href.slice(1)):null;if(!ref)return;
      const signature=href+'|'+[...properties].sort().join(',');
      if(symbolCopies.has(signature)){const copied=symbolCopies.get(signature);node.setAttribute('href','#'+copied);node.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#'+copied);return;}
      const clone=ref.cloneNode(true);let cloneId;do{cloneId='studio-marker-copy-'+(++cloneIndex);}while(find(svg,cloneId));clone.id=cloneId;
      for(const item of [clone,...clone.querySelectorAll('*')]){item.removeAttribute('data-key');if(item!==clone)item.removeAttribute('id');for(const prop of properties){item.removeAttribute(prop);item.style?.removeProperty(prop);}}
      let defs=svg.querySelector('defs');if(!defs){defs=svg.ownerDocument.createElementNS(NS,'defs');svg.prepend(defs);}defs.append(clone);
      symbolCopies.set(signature,cloneId);
      node.setAttribute('href','#'+cloneId);node.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#'+cloneId);
    }
    function paint(node,values,kind){
      symbolPaint(node,Object.keys(values));const nodeKey=key(node);if(nodeKey)info.paintTargets[kind].push(nodeKey);
      for(const [property,value]of Object.entries(values)){node.style.setProperty(property,property==='stroke-width'?value+'px':value);if(nodeKey)info.paintChanges.push({key:nodeKey,property,value:String(value),kind});}
    }
    for(const {group,collection,nodes} of pointPlans){
      if(style.pointsVisible===false&&collection)group.style.display='none';
      for(const {node,color,center}of nodes){
      const nodeKey=key(node);if(nodeKey)info.paintTargets.point.push(nodeKey);
      if(style.pointsVisible===false)node.style.display='none';
      if(factor!==1&&(node.localName==='use'||center))scaleMark(node,factor,node.localName==='use'?null:center);
      const mode=style.pointMode||'original',values={};
      if(mode!=='original'){const resolve=value=>value==='none'?'none':hex(value)||color;values.fill=mode==='hollow'?'none':mode==='custom'?resolve(style.pointFill):color;values.stroke=mode==='custom'?resolve(style.pointStroke):color;}
      if(style.pointStrokeWidth!==undefined)values['stroke-width']=style.pointStrokeWidth;
      if(Object.keys(values).length)paint(node,values,'point');
      }
    }
    let segmentIndex=0;
    for(const {error,paths,colors}of errorPlans){
      const startIndex=segmentIndex;segmentIndex+=error.segments.length;
      const caps=error.caps.map(k=>find(svg,k)).filter(Boolean),capNodes=caps.flatMap(g=>[...g.querySelectorAll('use,path')].filter(n=>!n.closest('defs')));
      for(const node of [...paths,...capNodes]){const nodeKey=key(node);if(nodeKey)info.paintTargets.error.push(nodeKey);}
      display(error.node,style.errorsVisible===false);
      const regenerate=paths.length===error.segments.length&&(style.capWidth!==undefined||direction!=='both'&&error.segments.some(s=>s.center&&s.axis==='y'));
      for(const cap of caps)display(cap,style.errorsVisible===false||regenerate);
      if(paths.length!==error.segments.length)continue;
      for(const cap of error.node.querySelectorAll('[data-studio-cap]'))cap.remove();
      const chosenColor=i=>style.errorColor==='group'?colors[i]:hex(style.errorColor);
      for(const node of capNodes){
        const values={},x=Number(node.getAttribute('x')),y=Number(node.getAttribute('y'));
        const matches=error.segments.map((s,i)=>s.ends.some(p=>Math.abs(p[0]-x)<.001&&Math.abs(p[1]-y)<.001)?i:-1).filter(i=>i>=0);
        if(matches.length===1&&key(paths[matches[0]]))node.setAttribute('data-studio-error-owner',key(paths[matches[0]]));
        const candidate=matches.length===1?chosenColor(matches[0]):new Set(error.segments.map((_,i)=>chosenColor(i))).size===1?chosenColor(0):null;
        if(candidate)values.stroke=candidate;if(style.errorWidth!==undefined)values['stroke-width']=style.errorWidth;
        if(Object.keys(values).length)paint(node,values,'error');
      }
      error.segments.forEach((segment,i)=>{
        const path=paths[i],local=localSegment(path,segment),source=originalGeometry(path),ends=localInterval(local,segment,direction),[[x1,y1],[x2,y2]]=ends,values={},color=chosenColor(i);
        if(direction!=='both'&&segment.center&&segment.axis==='y')path.setAttribute('d','M '+x1+' '+y1+' L '+x2+' '+y2);
        else if(source.d!==null&&path.getAttribute('d')!==source.d)path.setAttribute('d',source.d);
        if(color)values.stroke=color;if(style.errorWidth!==undefined)values['stroke-width']=style.errorWidth;
        if(Object.keys(values).length)paint(path,values,'error');
        if(!regenerate)return;
        const width=style.capWidth??error.capWidth??6;if(!width)return;
        const endsToDraw=direction!=='both'&&segment.center&&segment.axis==='y'?[direction==='positive'?ends[1]:ends[0]]:ends;
        for(const [x,y]of endsToDraw){
          const cap=svg.ownerDocument.createElementNS(NS,'path'),half=width/2;
          cap.setAttribute('d',segment.axis==='y'?'M '+(x-half)+' '+y+' L '+(x+half)+' '+y:'M '+x+' '+(y-half)+' L '+x+' '+(y+half));
          cap.setAttribute('fill','none');cap.setAttribute('stroke',color||currentPaint(path,'stroke')||'#20242a');
          cap.setAttribute('stroke-width',style.errorWidth??(parseFloat(currentPaint(path,'stroke-width'))||1));
          const transform=path.getAttribute('transform');if(transform)cap.setAttribute('transform',transform);
          for(const name of ['clip-path','opacity','stroke-opacity']){const value=path.getAttribute(name)||path.style.getPropertyValue(name);if(value)cap.setAttribute(name,value);}
          const side=local.ends.findIndex(p=>p[0]===x&&p[1]===y);
          cap.setAttribute('data-key','e'+(7000000+(startIndex+i)*2+Math.max(0,side)));cap.setAttribute('x',x);cap.setAttribute('y',y);cap.setAttribute('data-studio-cap','true');cap.setAttribute('data-studio-error-owner',key(path)||error.id);path.parentNode.append(cap);
          if(color||style.errorWidth!==undefined)paint(cap,{...(color?{stroke:color}:{}),...(style.errorWidth!==undefined?{'stroke-width':style.errorWidth}:{})},'error');
        }
      });
    }
    info.paintTargets.point=[...new Set(info.paintTargets.point)];info.paintTargets.error=[...new Set(info.paintTargets.error)];return info;
  }
  // Capture a rendered panel once at gesture start. Subsequent slider frames
  // only change cached DOM nodes: no SVG rebuild, metadata parsing or bbox read.
  function createPreview(svg,options={}){
    const info=inspect(svg),initial={pointScale:1,...options.style},unit=number(options.unit)&&options.unit>0?options.unit:1,snapshots=new Map(),copies=new Map(),overrides=new Map(),references=new Map(),created=[],points=[],errors=[],caps=[];
    const visible=node=>{for(let p=node;p&&p!==svg;p=p.parentElement)if(p.style?.display==='none'||p.style?.visibility==='hidden')return false;return true;};
    const remember=node=>{if(!snapshots.has(node))snapshots.set(node,[...node.attributes].map(a=>({name:a.name,namespace:a.namespaceURI,value:a.value})));return node;};
    const paint=(node,property)=>{for(let p=node;p&&p!==svg;p=p.parentElement){const value=p.style?.getPropertyValue(property)||p.getAttribute(property);if(value)return value;}if(node.localName==='use'){const href=node.getAttribute('href')||node.getAttribute('xlink:href'),ref=href?.startsWith('#')&&find(svg,href.slice(1));if(ref)return ref.style?.getPropertyValue(property)||ref.getAttribute(property)||'';}return '';};
    const groupColor=(ref,fallback)=>{const group=ref&&find(svg,ref.id),nodes=group?[group,...group.querySelectorAll('path,use,rect,circle,ellipse')].filter(n=>!n.closest('defs')):[];return hex(nodes.map(n=>paint(n,ref.paint)).find(v=>hex(v)))||fallback;};
    const shape=d=>{const values=String(d||'').match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/ig)?.map(Number);return /^\s*M\s*[-+\d.]/.test(d||'')&&!String(d).replace(/[ML]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?|[\s,]/g,'')&&values?.length===4&&values.every(number)?[[values[0],values[1]],[values[2],values[3]]]:null;};
    const matrix=node=>{
      if(options.matrix)return options.matrix(node,svg);
      try{const root=svg.getScreenCTM(),own=node.getScreenCTM();if(root&&own)return root.inverse().multiply(own);}catch{}
      return null;
    };
    function captureCap(node,error,segmentIndex){
      let ends=shape(node.getAttribute('d')),offset=[0,0];
      if(node.localName==='use'){const href=node.getAttribute('href')||node.getAttribute('xlink:href'),ref=href?.startsWith('#')&&find(svg,href.slice(1));ends=ref?.localName==='path'?shape(ref.getAttribute('d')):null;offset=[Number(node.getAttribute('x')||0),Number(node.getAttribute('y')||0)];}
      const m=matrix(node);if(!ends||!m)return false;
      const dx=ends[1][0]-ends[0][0],dy=ends[1][1]-ends[0][1],length=Math.hypot(dx,dy);if(length<1e-12)return false;
      const axis=[dx/length,dy/length],physical=Math.hypot(m.a*axis[0]+m.c*axis[1],m.b*axis[0]+m.d*axis[1]);if(!number(physical)||physical<1e-12)return false;
      const center=ends[0].map((v,i)=>(v+ends[1][i])/2+offset[i]),base=hex(paint(node,'stroke'))||'#20242a',color=initial.errorColor==='group'?base:groupColor(error.segments[segmentIndex]?.colorSource||error.colorSource,base);
      caps.push({node:remember(node),center,axis,length,physical,color,transform:node.getAttribute('transform')||'',stroke:paint(node,'stroke'),width:paint(node,'stroke-width')});return true;
    }
    let unsupportedPoints=false,unsupportedCaps=false;
    for(const group of info.points){
      const meta=info.pointColors.find(p=>find(svg,p.id)===group),uses=[...group.querySelectorAll('use')].filter(n=>!n.closest('defs'));
      if(!uses.length&&[...group.querySelectorAll('path')].some(n=>!n.closest('defs')))unsupportedPoints=true;
      for(const node of uses)if(visible(node)){
        const original=hex(paint(node,'fill')),stroke=hex(paint(node,'stroke')),color=groupColor(meta?.colorSource,original&&original!=='#ffffff'?original:stroke||'#20242a');
        points.push({node:remember(node),x:Number(node.getAttribute('x')||0),y:Number(node.getAttribute('y')||0),transform:node.getAttribute('transform')||'',color,fill:paint(node,'fill'),stroke:paint(node,'stroke'),width:paint(node,'stroke-width')});
      }
    }
    for(const error of info.errors){
      const stems=[...error.node.querySelectorAll('path')].filter(n=>!n.closest('defs')&&!n.hasAttribute('data-studio-cap'));
      stems.forEach((node,i)=>{if(visible(node)){const base=hex(paint(node,'stroke'))||'#20242a';errors.push({node:remember(node),color:initial.errorColor==='group'?base:groupColor(error.segments[i]?.colorSource||error.colorSource,base),stroke:paint(node,'stroke'),width:paint(node,'stroke-width')});}});
      const candidates=[...error.node.querySelectorAll('[data-studio-cap]'),...error.caps.flatMap(k=>{const group=find(svg,k);return group?[...group.querySelectorAll('use,path')].filter(n=>!n.closest('defs')):[];})].filter(visible);
      for(const node of candidates){const owner=node.getAttribute('data-studio-error-owner'),byOwner=owner?stems.findIndex(stem=>stem.getAttribute('data-key')===owner):-1,x=Number(node.getAttribute('x')),y=Number(node.getAttribute('y')),matches=error.segments.map((s,i)=>s.ends.some(p=>Math.abs(p[0]-x)<.001&&Math.abs(p[1]-y)<.001)?i:-1).filter(i=>i>=0),index=byOwner>=0?byOwner:matches.length===1?matches[0]:0;if(!captureCap(node,error,index))unsupportedCaps=true;}
    }
    const supported={pointScale:points.length>0&&!unsupportedPoints,pointFill:points.length>0,pointStroke:points.length>0,pointStrokeWidth:points.length>0,pointMode:points.length>0,errorColor:errors.length>0,errorWidth:errors.length>0,capWidth:caps.length>0&&!unsupportedCaps};
    function override(node,properties){
      if(node.localName!=='use')return;
      if(!references.has(node)){const original=snapshots.get(node),href=original?.find(a=>a.name==='href')?.value||original?.find(a=>a.name==='xlink:href')?.value;references.set(node,{href,ref:href?.startsWith('#')&&find(svg,href.slice(1))});}
      const {href,ref}=references.get(node);if(!ref)return;
      const own=overrides.get(node)||new Set();properties.forEach(p=>own.add(p));overrides.set(node,own);properties=[...own];
      const signature=href+'|'+properties.sort().join(',');let cloneId=copies.get(signature);
      if(!cloneId){const clone=ref.cloneNode(true);let serial=1;while(find(svg,'studio-mark-preview-'+serial))serial++;cloneId='studio-mark-preview-'+serial;clone.id=cloneId;for(const item of [clone,...clone.querySelectorAll('*')]){item.removeAttribute('data-key');if(item!==clone)item.removeAttribute('id');for(const prop of properties){item.removeAttribute(prop);item.style?.removeProperty(prop);}}let defs=svg.querySelector('defs');if(!defs){defs=svg.ownerDocument.createElementNS(NS,'defs');svg.prepend(defs);created.push(defs);}defs.append(clone);created.push(clone);copies.set(signature,cloneId);}
      node.setAttribute('href','#'+cloneId);node.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href','#'+cloneId);
    }
    const setPaint=(item,property,value)=>{override(item.node,[property]);item.node.style.setProperty(property,value);};
    // Resolve shared-symbol presentation once, before animation starts. Every
    // frame can then write only the cached use node without searching defs.
    for(const item of points){override(item.node,['fill','stroke','stroke-width']);for(const [property,value]of [['fill',item.fill],['stroke',item.stroke],['stroke-width',item.width]])if(value)item.node.style.setProperty(property,value);}
    for(const item of caps){override(item.node,['stroke','stroke-width']);for(const [property,value]of [['stroke',item.stroke],['stroke-width',item.width]])if(value)item.node.style.setProperty(property,value);}
    function preview(next={}){
      const changes=Object.keys(next).filter(key=>next[key]!==initial[key]);if(changes.some(key=>key in supported&&!supported[key]))return {applied:false,fallback:true,supported};
      if(changes.some(key=>['errorDirection','pointsVisible','errorsVisible'].includes(key)))return {applied:false,fallback:true,supported};
      for(const item of points){
        if(number(next.pointScale)&&next.pointScale>0){const factor=next.pointScale/(initial.pointScale||1);item.node.setAttribute('transform',item.transform+' translate('+item.x+' '+item.y+') scale('+factor+') translate('+(-item.x)+' '+(-item.y)+')');}
        const mode=next.pointMode||initial.pointMode||'original',resolve=value=>value==='none'?'none':hex(value)||item.color;
        if(mode!=='original'){setPaint(item,'fill',mode==='hollow'?'none':mode==='custom'?resolve(next.pointFill??initial.pointFill):item.color);setPaint(item,'stroke',mode==='custom'?resolve(next.pointStroke??initial.pointStroke):item.color);}
        if(number(next.pointStrokeWidth))setPaint(item,'stroke-width',String(next.pointStrokeWidth*unit)+'px');
      }
      for(const item of [...errors,...caps]){
        const color=next.errorColor==='group'?item.color:hex(next.errorColor);if(color)setPaint(item,'stroke',color);
        if(number(next.errorWidth))setPaint(item,'stroke-width',String(next.errorWidth*unit)+'px');
      }
      if(number(next.capWidth)&&next.capWidth>=0)for(const item of caps){
        const length=next.capWidth*unit/item.physical;
        if(item.node.localName==='path'){const half=length/2,[x,y]=item.center,[dx,dy]=item.axis;item.node.setAttribute('d','M '+(x-dx*half)+' '+(y-dy*half)+' L '+(x+dx*half)+' '+(y+dy*half));}
        else {const factor=length/item.length,[x,y]=item.center,[dx,dy]=item.axis,a=1+(factor-1)*dx*dx,b=(factor-1)*dx*dy,d=1+(factor-1)*dy*dy;item.node.setAttribute('transform',item.transform+' translate('+x+' '+y+') matrix('+a+' '+b+' '+b+' '+d+' 0 0) translate('+(-x)+' '+(-y)+')');}
      }
      return {applied:true,fallback:false,supported,count:points.length+errors.length+caps.length};
    }
    function restore(){for(const [node,attributes]of snapshots){for(const attr of [...node.attributes])node.removeAttributeNode(attr);for(const attr of attributes)if(attr.namespace)node.setAttributeNS(attr.namespace,attr.name,attr.value);else node.setAttribute(attr.name,attr.value);}for(const node of created.reverse())node.remove();created.length=0;copies.clear();overrides.clear();}
    return {supported,apply:preview,restore,cancel:restore,counts:{points:points.length,errors:errors.length,caps:caps.length}};
  }
  return {validateMetadata,inspect,apply,interval,createPreview};
})();
if(typeof module!=='undefined')module.exports=StudioMarkStyle;
