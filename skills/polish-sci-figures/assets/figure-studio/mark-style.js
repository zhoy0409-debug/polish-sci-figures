/* Style marks independently of bars, connecting lines and shared SVG symbols. */
'use strict';
const StudioMarkStyle=(()=>{
  const NS='http://www.w3.org/2000/svg',number=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e8;
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
    const errorPlans=info.errors.map(error=>{const paths=[...error.node.querySelectorAll('path')].filter(p=>!p.closest('defs'));return {error,paths,colors:error.segments.map((s,i)=>sourceColor(s.colorSource||error.colorSource,paths[i]?hex(currentPaint(paths[i],'stroke')):null))};});
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
      if(style.errorsVisible===false){error.node.style.display='none';for(const cap of caps)cap.style.display='none';}
      if(paths.length!==error.segments.length)continue;
      const chosenColor=i=>style.errorColor==='group'?colors[i]:hex(style.errorColor);
      for(const node of capNodes){
        const values={},x=Number(node.getAttribute('x')),y=Number(node.getAttribute('y'));
        const matches=error.segments.map((s,i)=>s.ends.some(p=>Math.abs(p[0]-x)<.001&&Math.abs(p[1]-y)<.001)?i:-1).filter(i=>i>=0);
        const candidate=matches.length===1?chosenColor(matches[0]):new Set(error.segments.map((_,i)=>chosenColor(i))).size===1?chosenColor(0):null;
        if(candidate)values.stroke=candidate;if(style.errorWidth!==undefined)values['stroke-width']=style.errorWidth;
        if(Object.keys(values).length)paint(node,values,'error');
      }
      error.segments.forEach((segment,i)=>{
        const path=paths[i],ends=interval(segment,direction),[[x1,y1],[x2,y2]]=ends,values={},color=chosenColor(i);
        if(direction!=='both'&&segment.center&&segment.axis==='y')path.setAttribute('d','M '+x1+' '+y1+' L '+x2+' '+y2);
        if(color)values.stroke=color;if(style.errorWidth!==undefined)values['stroke-width']=style.errorWidth;
        if(Object.keys(values).length)paint(path,values,'error');
        if(style.capWidth===undefined&&!(direction!=='both'&&segment.center&&segment.axis==='y'))return;
        for(const cap of caps)cap.style.display='none';
        const width=style.capWidth??error.capWidth??6;if(!width)return;
        const endsToDraw=direction!=='both'&&segment.center&&segment.axis==='y'?[direction==='positive'?ends[1]:ends[0]]:ends;
        for(const [x,y]of endsToDraw){
          const cap=svg.ownerDocument.createElementNS(NS,'path'),half=width/2;
          cap.setAttribute('d',segment.axis==='y'?'M '+(x-half)+' '+y+' L '+(x+half)+' '+y:'M '+x+' '+(y-half)+' L '+x+' '+(y+half));
          cap.setAttribute('fill','none');cap.setAttribute('stroke',color||currentPaint(path,'stroke')||'#20242a');
          cap.setAttribute('stroke-width',style.errorWidth??(parseFloat(currentPaint(path,'stroke-width'))||1));
          for(const name of ['clip-path','opacity','stroke-opacity']){const value=path.getAttribute(name)||path.style.getPropertyValue(name);if(value)cap.setAttribute(name,value);}
          const side=segment.ends.findIndex(p=>p[0]===x&&p[1]===y);
          cap.setAttribute('data-key','e'+(7000000+(startIndex+i)*2+Math.max(0,side)));cap.setAttribute('x',x);cap.setAttribute('y',y);cap.setAttribute('data-studio-cap','true');error.node.append(cap);
          if(color||style.errorWidth!==undefined)paint(cap,{...(color?{stroke:color}:{}),...(style.errorWidth!==undefined?{'stroke-width':style.errorWidth}:{})},'error');
        }
      });
    }
    info.paintTargets.point=[...new Set(info.paintTargets.point)];info.paintTargets.error=[...new Set(info.paintTargets.error)];return info;
  }
  return {validateMetadata,inspect,apply,interval};
})();
if(typeof module!=='undefined')module.exports=StudioMarkStyle;
