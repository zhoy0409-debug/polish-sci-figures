/* Size marks without moving observations; trim intervals at the actual estimate. */
'use strict';
const StudioMarkStyle=(()=>{
  const NS='http://www.w3.org/2000/svg',number=x=>typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<1e8;
  const coordinate=p=>Array.isArray(p)&&p.length===2&&p.every(number),id=s=>typeof s==='string'&&/^[\w.:-]{1,160}$/.test(s);
  function validateMetadata(text){try{const m=JSON.parse(text);return m.version===1&&Array.isArray(m.points)&&m.points.length<=10000&&m.points.every(id)&&Array.isArray(m.errors)&&m.errors.length<=10000&&m.errors.every(e=>id(e.id)&&(e.capWidth===undefined||(number(e.capWidth)&&e.capWidth>=0&&e.capWidth<=100))&&(e.lineWidth===undefined||(number(e.lineWidth)&&e.lineWidth>=0&&e.lineWidth<=100))&&Array.isArray(e.caps)&&e.caps.every(id)&&Array.isArray(e.segments)&&e.segments.length<=100000&&e.segments.every(s=>['x','y'].includes(s.axis)&&Array.isArray(s.ends)&&s.ends.length===2&&s.ends.every(coordinate)&&(s.center===null||coordinate(s.center))));}catch{return false;}}
  const find=(svg,key)=>svg.querySelector(`[id="${key}"]`)||[...svg.querySelectorAll('[id]')].find(e=>e.id.endsWith('-'+key));
  function inspect(svg){
    const meta=[...svg.querySelectorAll('metadata')].find(e=>/(?:^|-)studio-mark-styles$/.test(e.id));
    if(meta&&validateMetadata(meta.textContent)){const m=JSON.parse(meta.textContent);return {points:m.points.map(key=>find(svg,key)).filter(Boolean),errors:m.errors.map(e=>({...e,node:find(svg,e.id)})).filter(e=>e.node),semantic:true};}
    // Older projects still permit proportional point sizing without guessing an estimate.
    const points=[...svg.querySelectorAll('g[id]')].filter(g=>/(?:^|-)PathCollection_\d+$|studio-group-\d+-points$|studio-mark-.*-(?:points|marker)-\d+$/.test(g.id));
    return {points,errors:[],semantic:false};
  }
  function interval(segment,direction){
    const ends=segment.ends.map(p=>[...p]);if(direction==='both'||!segment.center||segment.axis!=='y')return ends;
    const upper=ends[0][1]<ends[1][1]?ends[0]:ends[1],lower=ends[0][1]<ends[1][1]?ends[1]:ends[0];
    return direction==='positive'?[segment.center,upper]:[lower,segment.center];
  }
  function scaleMark(use,factor){
    const x=Number(use.getAttribute('x')||0),y=Number(use.getAttribute('y')||0),base=use.getAttribute('transform')||'';
    use.setAttribute('transform',`${base} translate(${x} ${y}) scale(${factor}) translate(${-x} ${-y})`);
  }
  function apply(svg,style={},direction='both'){
    const info=inspect(svg),factor=style.pointScale??1;
    if(factor!==1)for(const group of info.points)for(const use of group.querySelectorAll('use'))scaleMark(use,factor);
    if(style.capWidth===undefined&&style.errorWidth===undefined&&direction==='both')return info;
    const hidden=new Set();let segmentIndex=0;
    for(const error of info.errors){
      const startIndex=segmentIndex;segmentIndex+=error.segments.length;
      const paths=[...error.node.querySelectorAll('path')].filter(p=>!p.closest('defs'));
      if(paths.length!==error.segments.length)continue;
      error.segments.forEach((segment,i)=>{
        const path=paths[i],ends=interval(segment,direction),[[x1,y1],[x2,y2]]=ends;
        if(direction!=='both'&&segment.center&&segment.axis==='y')path.setAttribute('d',`M ${x1} ${y1} L ${x2} ${y2}`);
        if(style.errorWidth!==undefined)path.style.strokeWidth=style.errorWidth+'px';
        // Preserve original caps unless the user explicitly changes width or direction.
        if(style.capWidth===undefined&&!(direction!=='both'&&segment.center&&segment.axis==='y'))return;
        for(const key of error.caps){const node=find(svg,key);if(node){node.style.display='none';hidden.add(key);}}
        const width=style.capWidth??error.capWidth??6;if(!width)return;
        const values=direction!=='both'&&segment.center&&segment.axis==='y'?[direction==='positive'?ends[1]:ends[0]]:ends;
        for(const [x,y] of values){const cap=svg.ownerDocument.createElementNS(NS,'path'),half=width/2;cap.setAttribute('d',segment.axis==='y'?`M ${x-half} ${y} L ${x+half} ${y}`:`M ${x} ${y-half} L ${x} ${y+half}`);cap.setAttribute('fill','none');cap.setAttribute('stroke',path.style.stroke||path.getAttribute('stroke')||'#20242a');cap.setAttribute('stroke-width',style.errorWidth??(parseFloat(path.style.strokeWidth||path.getAttribute('stroke-width'))||1));for(const name of ['clip-path','opacity','stroke-opacity']){const value=path.getAttribute(name)||path.style.getPropertyValue(name);if(value)cap.setAttribute(name,value);}const side=segment.ends.findIndex(p=>p[0]===x&&p[1]===y);cap.setAttribute('data-key','e'+(7000000+(startIndex+i)*2+Math.max(0,side)));cap.setAttribute('x',x);cap.setAttribute('y',y);cap.setAttribute('data-studio-cap','true');error.node.append(cap);}
      });
    }
    // Width-only edits keep the original marker geometry and cap color.
    if(style.errorWidth!==undefined&&style.capWidth===undefined&&direction==='both')for(const error of info.errors)for(const key of error.caps){const group=find(svg,key);if(group)for(const use of group.querySelectorAll('use'))use.style.strokeWidth=style.errorWidth+'px';}
    return info;
  }
  return {validateMetadata,inspect,apply,interval};
})();
if(typeof module!=='undefined')module.exports=StudioMarkStyle;
