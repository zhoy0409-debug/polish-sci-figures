/* Copy a prepared, editable panel selection without flattening its artwork.
 *
 * serialize({svg, keys, bounds, matrix}) accepts one already-sanitized panel
 * SVG, its selected data-keys, a bounding rectangle in main-canvas physical pt,
 * and an affine matrix from panel SVG user units to those same canvas pt.
 * The matrix includes the panel viewport, but NOT a screen/preview zoom.
 * Ancestor groups and nested SVG viewports stay intact. We prune unrelated
 * artwork, retain referenced definitions, and namespace IDs before producing
 * an independent 0,0,width,height SVG. No source node or pixel is modified.
 *
 * This is deliberately not a general SVG importer. Unsupported/unsafe retained
 * features fail atomically; the caller must also use its normal import validator
 * before installing the returned SVG as a new panel. Statistical/data metadata
 * is not copied: an extracted visual selection is not a new analyzed dataset.
 */
'use strict';
const StudioCanvasClipboard=(()=>{
  const NS='http://www.w3.org/2000/svg',XLINK='http://www.w3.org/1999/xlink';
  const MAX_NODES=100000,MAX_BYTES=20000000,MAX_KEYS=5000;
  const TAGS=new Set(['svg','g','a','symbol','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','use','clipPath','linearGradient','radialGradient','stop','image','title','desc']);
  const ATTRS=new Set(['id','x','y','x1','y1','x2','y2','dx','dy','cx','cy','fx','fy','fr','r','rx','ry','width','height','viewBox','preserveAspectRatio','d','points','transform','fill','stroke','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','clip-path','font-family','font-size','font-style','font-weight','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','baseline-shift','textLength','lengthAdjust','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','color-interpolation','clipPathUnits','href','version','color','display','visibility','overflow']);
  const STYLES=new Set(['display','visibility','fill','stroke','opacity','fill-opacity','stroke-opacity','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','fill-rule','clip-rule','clip-path','font','font-family','font-size','font-style','font-weight','font-stretch','font-variant','letter-spacing','word-spacing','text-anchor','dominant-baseline','alignment-baseline','baseline-shift','stop-color','stop-opacity','color-interpolation','color','overflow']);
  const ID=/^[\w.:-]+$/,KEY=/^e\d+$/,LOCAL=/^#[\w.:-]+$/;
  const imageColor=()=>typeof StudioImageColor!=='undefined'?StudioImageColor:typeof module!=='undefined'&&module.exports?require('./image-color.js'):null;
  let serial=0;
  function fail(code,message){const error=new Error(message);error.code='clipboard-'+code;throw error;}
  function finite(value){return typeof value==='number'&&Number.isFinite(value)&&Math.abs(value)<=1e12;}
  function rect(value){
    if(!value||!['x','y','width','height'].every(key=>finite(value[key]))||value.width<=0||value.height<=0||value.width>14400||value.height>14400)fail('bounds','The copied selection has invalid or unsupported dimensions.');
    return {x:value.x,y:value.y,width:value.width,height:value.height};
  }
  function matrix(value){
    if(value===undefined)return [1,0,0,1,0,0];
    const result=Array.isArray(value)?[...value]:['a','b','c','d','e','f'].map(key=>value?.[key]);
    if(result.length!==6||result.some(v=>!finite(v))||Math.abs(result[0]*result[3]-result[1]*result[2])<1e-12)fail('matrix','The copied selection has an unsupported transform.');
    return result.map(v=>Object.is(v,-0)?0:v);
  }
  function urls(value){
    if(/[<>]|(?:javascript|vbscript)\s*:|expression\s*\(|@import|\\/i.test(value))fail('unsafe','The selection contains an unsupported SVG value.');
    const result=[];let residue=value;
    residue=residue.replace(/url\(\s*(['"]?)#([\w.:-]+)\1\s*\)/gi,(_,quote,id)=>{result.push(id);return '';});
    if(/url\s*\(/i.test(residue))fail('external','Only embedded images and local SVG references can be copied.');
    return result;
  }
  function references(node){
    const refs=[];
    for(const a of [...node.attributes]){
      if(a.name==='data-studio-image-color')continue;
      if(a.localName==='href'){
        if(LOCAL.test(a.value))refs.push(a.value.slice(1));
        else if(node.localName!=='image'||!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(a.value))fail('external','Only embedded images and local SVG references can be copied.');
      }else if(/url\s*\(/i.test(a.value))refs.push(...urls(a.value));
    }
    return refs;
  }
  function visible(node,root){
    for(let current=node;current;current=current.parentElement){
      if(current.style?.display==='none'||current.getAttribute('display')==='none'||['hidden','collapse'].includes(current.style?.visibility||current.getAttribute('visibility')))return false;
      if(current===root)break;
    }
    return true;
  }
  function retainedColorNodes(root,kept){
    const owned=new Set(),api=imageColor();
    for(const node of kept)if(node.localName==='image'&&(node.hasAttribute('data-studio-image-color')||node.hasAttribute('filter')||node.style?.filter)){
      if(!api?.inspect)fail('filter','The selection uses an unsupported image filter.');
      try{
        const adjustment=api.inspect(node,root);if(!adjustment)fail('filter','The selection uses an unsupported image filter.');
        const ids=urls(node.getAttribute('filter')||node.style.filter||'');
        const filter=[...root.querySelectorAll('[id]')].find(el=>el.id===ids[0]);
        if(ids.length!==1||!filter)fail('filter','The selection uses an unsupported image filter.');
        owned.add(node);owned.add(filter);for(const child of filter.querySelectorAll('*'))owned.add(child);
      }catch{fail('filter','The selection uses an unsupported or altered image filter.');}
    }
    return owned;
  }
  function cleanElement(node,owned){
    if(node.namespaceURI!==NS||(!TAGS.has(node.localName)&&!owned.has(node)))fail('feature','The selection contains an unsupported SVG feature.');
    for(const attr of [...node.attributes]){
      if(attr.name==='xmlns'||attr.name==='xmlns:xlink')continue;
      if(/^on/i.test(attr.name))fail('unsafe','The selection contains active SVG content.');
      if(owned.has(node)&&(['data-studio-image-color','filter'].includes(attr.name)||node.localName!=='image'))continue;
      if(attr.name==='style'){
        // A prepared panel has already inlined its stylesheet. Selection styles
        // such as cursor/outline must not enter the copied scientific artwork.
        const remove=[];
        for(let i=0;i<node.style.length;i++){
          const prop=node.style[i],value=node.style.getPropertyValue(prop);
          if(['transform','transform-origin','mask','mask-image','mix-blend-mode','isolation'].includes(prop))fail('feature','The selection uses unsupported CSS transforms or effects.');
          if(prop==='filter'&&!owned.has(node))fail('filter','The selection uses an unsupported image filter.');
          if(!STYLES.has(prop)&&!(prop==='filter'&&owned.has(node)))remove.push(prop);else urls(value);
        }
        for(const prop of remove)node.style.removeProperty(prop);
        if(!node.getAttribute('style'))node.removeAttribute('style');
      }else if(attr.localName==='href'){
        references(node);
        // SVG links must never turn the pasted scientific drawing into a link.
        if(node.localName==='a')node.removeAttributeNode(attr);
      }else if(['filter','mask'].includes(attr.localName))fail('filter','The selection uses an unsupported image filter.');
      else if(!ATTRS.has(attr.localName)||attr.name.startsWith('data-')||attr.name==='class')node.removeAttributeNode(attr);
      else urls(attr.value);
    }
  }
  function serialize(options){
    const {svg,keys}=options||{},bounds=rect(options?.bounds),m=matrix(options?.matrix);
    if(!svg||svg.namespaceURI!==NS||svg.localName!=='svg')fail('source','Select editable objects from one panel.');
    if(svg.querySelector('style'))fail('stylesheet','Inline SVG styles before copying this selection.');
    if(!Array.isArray(keys)||!keys.length||keys.length>MAX_KEYS||keys.some(key=>typeof key!=='string'||!KEY.test(key))||new Set(keys).size!==keys.length)fail('selection','The copied selection is invalid.');
    const nodes=[svg,...svg.querySelectorAll('*')];if(nodes.length>MAX_NODES)fail('size','The selection is too large to copy.');
    const indexed=new Map(),ids=new Map();
    for(const node of nodes){
      const key=node.getAttribute('data-key');if(key){if(indexed.has(key))fail('selection','The panel contains ambiguous editing keys.');indexed.set(key,node);}
      if(node.id){if(!ID.test(node.id)||ids.has(node.id))fail('reference','The panel contains ambiguous SVG references.');ids.set(node.id,node);}
    }
    let selected=keys.map(key=>{
      let node=indexed.get(key);
      if(!node||node===svg||node.closest('defs,clipPath,symbol,linearGradient,radialGradient,filter,metadata'))fail('selection','Select visible artwork, rather than an SVG definition.');
      if(node.localName==='tspan')node=node.closest('text');
      if(!node||!KEY.test(node.getAttribute('data-key')||'')||!visible(node,svg))fail('selection','The selection contains missing or hidden objects.');
      return node;
    });
    selected=[...new Set(selected)].filter(node=>!selected.some(other=>other!==node&&other.contains(node)));
    const selectedSet=new Set(selected),keep=new Set([svg]),full=new Set();
    const ancestors=node=>{for(let p=node;p&&p!==svg;p=p.parentElement)keep.add(p);};
    const entire=node=>{for(const child of [node,...node.querySelectorAll('*')]){keep.add(child);full.add(child);}ancestors(node);};
    selected.forEach(entire);
    // Iterate the growing Set: references in definitions are resolved as well.
    // Outside-defs use targets would require a separate inherited-style context;
    // reject them instead of duplicating visible artwork or guessing that style.
    for(const node of keep){
      if(node.localName==='style')fail('stylesheet','Inline SVG styles before copying this selection.');
      for(const id of references(node)){
        const target=ids.get(id);if(!target)fail('reference','The selection contains a missing SVG reference.');
        if(!target.closest('defs'))fail('reference','This selection references artwork outside its SVG definitions.');
        if(!full.has(target))entire(target);
      }
      if(keep.size>MAX_NODES)fail('size','The selection is too large to copy.');
    }
    const resolved=new Set(),resolving=new Set();
    const checkReference=(id,depth=0)=>{
      if(resolving.has(id)||depth>64)fail('reference','The selection contains cyclic or excessively nested SVG references.');
      if(resolved.has(id))return;
      resolving.add(id);const target=ids.get(id);
      for(const child of [target,...target.querySelectorAll('*')])for(const nested of references(child))checkReference(nested,depth+1);
      resolving.delete(id);resolved.add(id);
    };
    for(const node of keep)for(const id of references(node))checkReference(id);
    // An objectBoundingBox clip on a partially retained group changes when its
    // siblings are removed. Ordinary PDF userSpaceOnUse clipping stays exact.
    for(const node of keep)if(!full.has(node))for(const id of urls(node.style?.getPropertyValue('clip-path')||node.getAttribute('clip-path')||'')){
      const clip=ids.get(id);if(clip?.localName==='clipPath'&&clip.getAttribute('clipPathUnits')==='objectBoundingBox')fail('clip','A group-relative crop cannot be copied partially. Select the complete group.');
    }
    const sourceColors=retainedColorNodes(svg,keep),clone=svg.cloneNode(true),copies=[clone,...clone.querySelectorAll('*')],owned=new Set();
    nodes.forEach((node,i)=>{if(sourceColors.has(node))owned.add(copies[i]);});
    // Reverse traversal removes unwanted sibling artwork without disturbing
    // inherited text/font state or multiplying shared group opacity.
    for(let i=nodes.length-1;i>0;i--)if(!keep.has(nodes[i])||['metadata','style'].includes(nodes[i].localName))copies[i].remove();
    for(const node of [clone,...clone.querySelectorAll('*')])cleanElement(node,owned);
    const box=String(svg.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);
    if(box.length!==4||box.some(v=>!finite(v))||box[2]<=0||box[3]<=0)fail('viewport','The panel requires a finite SVG viewBox before copying.');
    // The caller's matrix already contains the root viewport/transform. Set an
    // identity nested viewport; internal percentage sizes and nested viewports
    // still resolve against the original panel user-space dimensions.
    clone.removeAttribute('transform');clone.style.removeProperty('transform');
    clone.setAttribute('x',box[0]);clone.setAttribute('y',box[1]);clone.setAttribute('width',box[2]);clone.setAttribute('height',box[3]);clone.setAttribute('preserveAspectRatio','none');
    const prefix='clipboard-'+(++serial)+'-',mapping=new Map();
    for(const node of [clone,...clone.querySelectorAll('[id]')])if(node.id)mapping.set(node.id,prefix+node.id);
    for(const node of [clone,...clone.querySelectorAll('*')]){
      if(node.id)node.id=mapping.get(node.id);
      for(const attr of [...node.attributes]){
        if(attr.name==='data-studio-image-color')continue;
        if(attr.localName==='href'&&LOCAL.test(attr.value))attr.value='#'+mapping.get(attr.value.slice(1));
        else if(/url\s*\(/i.test(attr.value))attr.value=attr.value.replace(/url\(\s*(['"]?)#([\w.:-]+)\1\s*\)/gi,(_,q,id)=>'url(#'+mapping.get(id)+')');
      }
    }
    const doc=svg.ownerDocument,output=doc.createElementNS(NS,'svg'),shift=doc.createElementNS(NS,'g'),transform=doc.createElementNS(NS,'g');
    output.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns',NS);output.setAttributeNS('http://www.w3.org/2000/xmlns/','xmlns:xlink',XLINK);
    output.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);output.setAttribute('width',bounds.width+'pt');output.setAttribute('height',bounds.height+'pt');
    shift.setAttribute('transform',`translate(${-bounds.x} ${-bounds.y})`);transform.setAttribute('transform','matrix('+m.join(' ')+')');
    transform.append(clone);shift.append(transform);output.append(shift);
    const serialized=output.outerHTML;
    if(serialized.length>MAX_BYTES||new TextEncoder().encode(serialized).length>MAX_BYTES)fail('size','The selection is too large to copy.');
    return {svg:serialized,width:bounds.width,height:bounds.height,viewBox:[0,0,bounds.width,bounds.height],bounds,count:selectedSet.size,keys:selected.map(node=>node.getAttribute('data-key'))};
  }
  return {serialize,limits:{maxBytes:MAX_BYTES,maxNodes:MAX_NODES,maxKeys:MAX_KEYS}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioCanvasClipboard;
