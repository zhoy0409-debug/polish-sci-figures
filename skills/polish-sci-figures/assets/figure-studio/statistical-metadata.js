/* Enrich an older, unchanged chart without replacing a single artwork node.
 * Artist IDs changed when explicit statistical cells were introduced. Exact
 * geometry, resolved marker shapes and axis context identify legacy artists;
 * ambiguous or changed geometry must fail instead of guessing by paint/order. */
'use strict';
const StudioStatisticalMetadata = (() => {
  const NS='http://www.w3.org/2000/svg',XLINK='http://www.w3.org/1999/xlink';
  const META='studio-stat-anchors',ID=/^[A-Za-z_][\w.:-]{0,199}$/;
  const SHAPES=new Set(['path','rect','circle','ellipse','line','polyline','polygon','use','g','clipPath']);
  const GEOMETRY={path:['d','pathLength'],rect:['x','y','width','height','rx','ry'],circle:['cx','cy','r'],ellipse:['cx','cy','rx','ry'],line:['x1','y1','x2','y2'],polyline:['points'],polygon:['points'],use:['x','y','width','height'],g:[],clipPath:[]};
  function numbers(value,commands=false){
    if(value==null)return null;
    const raw=String(value),tokens=raw.match(commands?/[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g:/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)||[];
    const rest=raw.replace(commands?/[A-Za-z]|[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g:/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g,'').replace(/[\s,]/g,'');
    if(rest||raw.length>500000||tokens.length>60000)throw Error('Unsupported geometry');
    return tokens.map(token=>{if(commands&&/^[A-Za-z]$/.test(token))return token;const n=Number(token);if(!Number.isFinite(n)||Math.abs(n)>1e9)throw Error('Invalid geometry');return n;});
  }
  function transform(node){
    const value=node.getAttribute('transform');
    if(value==null)return null;
    // Compare complete transform operations; never erase a translate/scale.
    const parts=[],re=/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^()]*)\)/g;let match,last=0;
    while((match=re.exec(value))){if(value.slice(last,match.index).trim())throw Error('Invalid transform');parts.push([match[1],numbers(match[2])]);last=re.lastIndex;}
    if(!parts.length||value.slice(last).trim())throw Error('Invalid transform');return parts;
  }
  function index(svg){
    if(svg?.localName!=='svg')throw Error('Expected SVG');
    const all=[svg,...svg.querySelectorAll('*')];if(all.length>60000)throw Error('Chart too complex');
    const ids=new Map();for(const node of all){if(node.id){if(ids.has(node.id))throw Error('Duplicate identifier');ids.set(node.id,node);}}
    return {svg,all,ids};
  }
  function parseMetadata(node){
    if(!node||node.children.length||node.textContent.length>200000)throw Error('Invalid anchors');
    const value=JSON.parse(node.textContent);
    if(value?.version!==1||value.group_column!=='group'||value.facet_column!=='factor'||!Array.isArray(value.axes)||!value.axes.length||value.axes.length>24)throw Error('Invalid anchors');
    const axes=new Set(),cells=new Set(),members=new Set();
    for(const axis of value.axes){
      if(!ID.test(axis?.axis)||axes.has(axis.axis)||!Array.isArray(axis.groups)||!axis.groups.length||axis.groups.length>144)throw Error('Invalid axis');axes.add(axis.axis);
      for(const cell of axis.groups){
        if(typeof cell?.group!=='string'||!cell.group||cell.group.length>1000||cell.facet?.column!=='factor'||typeof cell.facet.value!=='string'||!cell.facet.value||cell.facet.value.length>1000||!Array.isArray(cell.center)||cell.center.length!==2||!cell.center.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6)||!Array.isArray(cell.members)||!cell.members.length||cell.members.length>64)throw Error('Invalid cell');
        const key=JSON.stringify([cell.facet.value,cell.group]);if(cells.has(key))throw Error('Repeated cell');cells.add(key);
        for(const member of cell.members){if(typeof member!=='string'||!ID.test(member)||members.has(member))throw Error('Invalid member');members.add(member);}
      }
    }
    return value;
  }
  function fingerprint(node,tree,active=new Set(),depth=0){
    if(depth>20||!SHAPES.has(node.localName))throw Error('Unsupported artist');
    if(active.has(node))throw Error('Circular marker');active.add(node);
    const result=[node.localName,transform(node)];
    for(const name of GEOMETRY[node.localName])result.push([name,numbers(node.getAttribute(name),name==='d')]);
    if(node.localName==='clipPath')result.push(['units',node.getAttribute('clipPathUnits')||'userSpaceOnUse']);
    const clipping=node.getAttribute('clip-path');
    if(clipping){
      const ref=clipping.match(/^url\(#([A-Za-z_][\w.:-]*)\)$/),clip=ref&&tree.ids.get(ref[1]);
      if(!clip||clip.localName!=='clipPath')throw Error('Unsupported clipping');
      result.push(['clip',fingerprint(clip,tree,active,depth+1)]);
    }
    if(node.localName==='use'){
      const ref=node.getAttribute('href')||node.getAttributeNS?.(XLINK,'href');
      if(!ref||!/^#[A-Za-z_][\w.:-]*$/.test(ref))throw Error('External marker');
      const marker=tree.ids.get(ref.slice(1));if(!marker)throw Error('Missing marker');
      result.push(['marker',fingerprint(marker,tree,active,depth+1)]);
    }
    const children=[];
    for(const child of node.children){
      if(child.localName==='defs')continue; // Used definitions are resolved above.
      children.push(fingerprint(child,tree,active,depth+1));
    }
    result.push(children);active.delete(node);return result;
  }
  function axisContext(axis,tree){
    const chain=[];for(let n=axis;n;n=n.parentElement){chain.push(transform(n));if(n===tree.svg)break;}
    const labels=[...axis.querySelectorAll('text')].map(n=>n.textContent);
    const frame=[...axis.children].find(n=>n.localName==='g'&&/^patch_\d+$/.test(n.id)&&n.querySelector('path'));
    if(!frame)throw Error('Missing axis frame');
    return JSON.stringify([chain,labels,fingerprint(frame,tree)]);
  }
  function dimensions(svg){
    const box=numbers(svg.getAttribute('viewBox'));if(!box||box.length!==4||box[2]<=0||box[3]<=0)throw Error('Invalid canvas');
    const physical=name=>{const match=String(svg.getAttribute(name)||'').match(/^\s*([\d.]+)\s*(pt|px|in|cm|mm)?\s*$/);if(!match)throw Error('Missing physical size');const v=Number(match[1])*({pt:1,px:.75,in:72,cm:72/2.54,mm:72/25.4}[match[2]]||.75);if(!Number.isFinite(v)||v<=0)throw Error('Invalid size');return v;};
    return [...box,physical('width'),physical('height')];
  }
  function attach(sourceSvg,freshSvg){
    try{
      const source=index(sourceSvg),fresh=index(freshSvg);
      if(source.ids.has(META))return false;
      const a=dimensions(sourceSvg),b=dimensions(freshSvg);if(a.some((n,i)=>Math.abs(n-b[i])>1e-6))return false;
      const meta=parseMetadata(fresh.ids.get(META)),next={version:1,group_column:'group',facet_column:'factor',axes:[]},used=new Set();
      const sourceAxes=source.all.filter(n=>n.localName==='g'&&/^axes_\d+$/.test(n.id)),freshAxes=fresh.all.filter(n=>n.localName==='g'&&/^axes_\d+$/.test(n.id));
      if(sourceAxes.length!==freshAxes.length)return false;
      for(const entry of meta.axes){
        const oldAxis=source.ids.get(entry.axis),newAxis=fresh.ids.get(entry.axis);
        if(!oldAxis||!newAxis||oldAxis.localName!=='g'||newAxis.localName!=='g'||axisContext(oldAxis,source)!==axisContext(newAxis,fresh))return false;
        const candidates=new Map();
        for(const node of oldAxis.children){
          if(node.localName!=='g'||!ID.test(node.id))continue;
          let key;try{key=JSON.stringify(fingerprint(node,source));}catch{continue;}
          if(candidates.has(key))candidates.set(key,null);else candidates.set(key,node);
        }
        const output={axis:entry.axis,groups:[]};
        for(const cell of entry.groups){
          const members=[];
          for(const id of cell.members){
            const node=fresh.ids.get(id);if(!node||node.parentElement!==newAxis)return false;
            const match=candidates.get(JSON.stringify(fingerprint(node,fresh)));
            if(!match||used.has(match))return false;used.add(match);members.push(match.id);
          }
          output.groups.push({group:cell.group,facet:{column:'factor',value:cell.facet.value},center:[...cell.center],members});
        }
        next.axes.push(output);
      }
      // Nothing above mutates either tree. Commit the single metadata node only
      // after every cell has an unambiguous, exact artwork match.
      const node=sourceSvg.ownerDocument.createElementNS(NS,'metadata');node.id=META;node.textContent=JSON.stringify(next);sourceSvg.appendChild(node);return true;
    }catch{return false;}
  }
  return {attach};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioStatisticalMetadata;
if(typeof window!=='undefined')window.StudioStatisticalMetadata=StudioStatisticalMetadata;
