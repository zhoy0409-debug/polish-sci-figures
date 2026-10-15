/* Text spacing and the typography brush. Source text and scientific runs stay
 * intact; these operations never copy content, positions or transforms. */
'use strict';
const StudioTextFormatting = (() => {
  const NS='http://www.w3.org/2000/svg',MAX=1e9;
  const numeric=/^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?$/i;
  function rich(){return typeof StudioRichText!=='undefined'?StudioRichText:typeof module!=='undefined'&&module.exports?require('./rich-text.js'):null;}
  function text(el){return !!el&&['text','tspan'].includes(el.localName);}
  function validateSpacing(key,value){
    if(typeof value!=='string'||!numeric.test(value.trim())||!Number.isFinite(+value))return false;
    return key==='letter-spacing'?Math.abs(+value)<=MAX:key==='line-height'?+value>=.5&&+value<=5:false;
  }
  function fontFamily(value){return typeof value==='string'&&value.trim().length>0&&value.length<=200&&!/[;{}<>\\]|url\s*\(|@/i.test(value)&&!/[\x00-\x1f]/.test(value);}
  function inherited(el,property,fallback=''){
    for(let node=el;node?.nodeType===1;node=node.parentElement){const value=node.style?.getPropertyValue?.(property)||node.getAttribute?.(property);if(value&&value!=='inherit')return value;}
    return fallback;
  }
  function length(value,size=12){
    const match=String(value??'').trim().match(/^([+-]?(?:\d*\.\d+|\d+\.?\d*)(?:e[+-]?\d+)?)(px|pt|pc|in|cm|mm|q|em|%)?$/i);if(!match)return NaN;
    const unit=(match[2]||'').toLowerCase(),factor={'':1,px:1,pt:96/72,pc:16,in:96,cm:96/2.54,mm:96/25.4,q:96/101.6,em:size,'%':size/100}[unit],result=Number(match[1])*factor;
    return Number.isFinite(result)&&Math.abs(result)<=MAX?result:NaN;
  }
  function list(value,size){
    if(typeof value!=='string'||!value.trim())return null;const values=value.trim().split(/[\s,]+/).map(v=>length(v,size));
    return values.length&&values.length<=10000&&values.every(Number.isFinite)?values:null;
  }
  function rounded(value){return String(Number(value.toPrecision(12)));}
  function nodesOf(el){return [el,...el.querySelectorAll('tspan')];}
  function glyphCount(el){let count=0;const visit=node=>{if(node.nodeType===3)count+=Array.from(node.nodeValue||'').length;else for(const child of node.childNodes||[])visit(child);};visit(el);return count;}
  function effectiveSpacing(el){const v=inherited(el,'letter-spacing','0');return v==='normal'?0:length(v,rich()?.pointSize(el)||12)||0;}

  // Build from original positions, once per edit/preview session. An explicit
  // y list may contain superscript offsets: only near-full-sized baseline runs
  // establish lines; small math spans inherit their nearest line unchanged.
  function measure(el,nodes=nodesOf(el)){
    if(!text(el))throw Error('请选择可编辑文字');const api=rich(),size=api?.pointSize(el)||12,indices=new Map(),records=[];
    let at=0;const visit=node=>{if(node.nodeType===3){at+=Array.from(node.nodeValue||'').length;return;}indices.set(node,at);for(const child of node.childNodes||[])visit(child);};visit(el);
    let previousY=list(el.getAttribute('y'),size)?.[0]||0;
    for(const node of nodes){const localSize=api?.pointSize(node)||size,y=list(node.getAttribute('y'),localSize),dy=list(node.getAttribute('dy'),localSize),x=list(node.getAttribute('x'),localSize),dx=list(node.getAttribute('dx'),localSize),full=localSize>=size*.85,shift=inherited(node,'baseline-shift','baseline');
      let baseline=y?.[0];if(!Number.isFinite(baseline)&&dy?.length===1&&full&&!['super','sub'].includes(shift))baseline=previousY+dy[0];
      if(Number.isFinite(baseline)&&full&&!['super','sub'].includes(shift))previousY=baseline;
      records.push({node,size:localSize,x,y,dx,dy,start:indices.get(node)||0,count:glyphCount(node),full:full&&!['super','sub'].includes(shift),baseline});
    }
    const bases=[];for(const r of records)if(r.full)for(const baseline of r.y||[r.baseline])if(Number.isFinite(baseline)&&!bases.some(y=>Math.abs(y-baseline)<size*.55))bases.push(baseline);
    bases.sort((a,b)=>a-b);const anchor=records.find(r=>r.full&&Number.isFinite(r.baseline))?.baseline??bases[0]??0;
    const gaps=bases.slice(1).map((y,i)=>y-bases[i]).filter(n=>n>=size*.55).sort((a,b)=>a-b),pitch=gaps.length?gaps[Math.floor(gaps.length/2)]:size*1.25;
    let active=anchor;for(const r of records){if(r.full&&Number.isFinite(r.baseline))active=bases.reduce((a,b)=>Math.abs(b-r.baseline)<Math.abs(a-r.baseline)?b:a,bases[0]??anchor);r.line=active;}
    const explicit=inherited(el,'line-height',''),lineHeight=validateSpacing('line-height',explicit)?+explicit:pitch/size;
    return {el,nodes,records,size,bases,anchor,pitch,lineHeight,letterSpacing:effectiveSpacing(el)};
  }
  function lineOffset(y,m){if(!m.bases.length)return 0;const base=m.bases.reduce((a,b)=>Math.abs(b-y)<Math.abs(a-y)?b:a,m.bases[0]);return base-m.anchor;}
  function applyMeasured(m,config){
    const el=m.el,hasLetter=config.letterSpacing!==undefined,hasLine=config.lineHeight!==undefined;
    if(hasLetter&&!validateSpacing('letter-spacing',String(config.letterSpacing))||hasLine&&!validateSpacing('line-height',String(config.lineHeight)))throw Error('文字间距参数无效');
    const spacing=hasLetter?Number(config.letterSpacing):m.letterSpacing,delta=spacing-m.letterSpacing,ratio=hasLine?Number(config.lineHeight)*m.size/m.pitch:1;
    const nearest=y=>m.bases.reduce((a,b)=>Math.abs(b-y)<Math.abs(a-y)?b:a,m.bases[0]??m.anchor),lineStarts=new Map();
    for(const r of m.records)if(r.x&&r.full){for(let i=0;i<r.x.length;i++){const base=r.y?.length>1?nearest(r.y[Math.min(i,r.y.length-1)]):r.line,index=r.start+i;if(!lineStarts.has(base)||index<lineStarts.get(base))lineStarts.set(base,index);}}
    for(const r of m.records){
      if(hasLetter&&delta&&r.x)r.node.setAttribute('x',r.x.map((x,i)=>{const base=r.y?.length>1?nearest(r.y[Math.min(i,r.y.length-1)]):r.line,start=lineStarts.get(base)||0;return rounded(x+delta*Math.max(0,r.start-start+i));}).join(' '));
      // A fixed textLength would otherwise cancel the requested spacing.
      if(hasLetter&&delta&&r.node.hasAttribute('textLength')){const old=length(r.node.getAttribute('textLength'),r.size),next=old+Math.max(0,r.count-1)*delta;if(Number.isFinite(next)&&next>0)r.node.setAttribute('textLength',rounded(next));else {r.node.removeAttribute('textLength');r.node.removeAttribute('lengthAdjust');}}
      if(hasLine&&ratio!==1){
        if(r.y)r.node.setAttribute('y',r.y.map(y=>rounded(y+lineOffset(y,m)*(ratio-1))).join(' '));
        // Relative multi-line tspans retain x/y origins and all nested math;
        // small dy values used for superscripts are deliberately untouched.
        else if(r.dy?.length===1&&r.full&&Math.abs(r.dy[0])>=m.size*.55)r.node.setAttribute('dy',rounded(r.dy[0]*ratio));
      }
    }
    if(hasLetter){el.style.setProperty('letter-spacing',rounded(spacing)+'px');for(const r of m.records.slice(1))if(r.node.style?.getPropertyValue('letter-spacing')||r.node.hasAttribute('letter-spacing')){r.node.style.setProperty('letter-spacing',rounded(spacing)+'px');}}
    if(hasLine)el.style.setProperty('line-height',String(Number(config.lineHeight)));
    return el;
  }
  function applySpacing(el,config){return applyMeasured(measure(el),config);}
  function readSpacing(el){const m=measure(el);return {letterSpacing:m.letterSpacing,lineHeight:Math.min(5,Math.max(.5,m.lineHeight)),lines:Math.max(1,m.bases.length)};}
  function validTypography(record){
    return !!record&&typeof record==='object'&&!Array.isArray(record)&&Object.keys(record).every(k=>['fontFamily','fontSize','fontWeight','fontStyle','fill','letterSpacing','lineHeight'].includes(k))&&fontFamily(record.fontFamily)&&Number.isFinite(record.fontSize)&&record.fontSize>=.1&&record.fontSize<=1000&&['400','700'].includes(record.fontWeight)&&['normal','italic','oblique'].includes(record.fontStyle)&&/^#[a-f\d]{6}$/i.test(record.fill)&&Number.isFinite(record.letterSpacing)&&Math.abs(record.letterSpacing)<=1000&&validateSpacing('line-height',String(record.lineHeight));
  }
  function hex(color){
    const value=String(color||'').trim();if(/^#[a-f\d]{6}$/i.test(value))return value.toLowerCase();if(/^#[a-f\d]{3}$/i.test(value))return '#'+value.slice(1).split('').map(c=>c+c).join('').toLowerCase();
    const rgb=value.match(/^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/i);if(rgb&&rgb.slice(1).every(n=>+n<=255))return '#'+rgb.slice(1).map(n=>(+n).toString(16).padStart(2,'0')).join('');
    const named={black:'#000000',white:'#ffffff',red:'#ff0000',blue:'#0000ff',green:'#008000',gray:'#808080',grey:'#808080'};return named[value.toLowerCase()]||null;
  }
  function factor(options){const value=Number(options?.pointFactor??1);if(!Number.isFinite(value)||value<=0||value>MAX)throw Error('文字坐标换算无效');return value;}
  function letterFactor(options){return factor({pointFactor:options?.letterPointFactor??options?.pointFactor??1});}
  function dominant(el,property,fallback){
    const counts=new Map();const visit=node=>{if(node.nodeType===3){const value=inherited(node.parentElement,property,fallback),n=String(node.nodeValue||'').trim().length;if(n)counts.set(value,(counts.get(value)||0)+n);}else for(const child of node.childNodes||[])visit(child);};visit(el);
    return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]||inherited(el,property,fallback);
  }
  function capture(el,options={}){
    if(!text(el))throw Error('请选择可编辑文字');const f=factor(options),api=rich(),spacing=readSpacing(el),weight=dominant(el,'font-weight','400'),record={fontFamily:dominant(el,'font-family','Arial'),fontSize:(api?.pointSize(el)||12)*f,fontWeight:weight==='bold'||+weight>=600?'700':'400',fontStyle:dominant(el,'font-style','normal'),fill:options.fill||hex(dominant(el,'fill','black')),letterSpacing:spacing.letterSpacing*letterFactor(options),lineHeight:spacing.lineHeight};
    if(!validTypography(record))throw Error('当前文字格式暂不能复制');return Object.freeze(record);
  }
  function nativeRichRecord(el){
    const content=el.textContent,styles=[];
    const visit=(node,style={})=>{
      if(node.nodeType===3){for(let i=0;i<(node.nodeValue||'').length;i++)styles.push({...style});return;}
      const next={...style};if(node.hasAttribute?.('data-rich-run')){
        const weight=node.style?.fontWeight||node.getAttribute('font-weight'),italic=node.style?.fontStyle||node.getAttribute('font-style'),script=node.style?.baselineShift||node.getAttribute('baseline-shift');
        if(weight)next.bold=weight==='bold'||+weight>=600;if(italic)next.italic=['italic','oblique'].includes(italic);if(['super','sub','baseline'].includes(script))next.script=script==='baseline'?'normal':script;
      }
      for(const child of node.childNodes||[])visit(child,next);
    };visit(el);
    const runs=[];let previous='';for(let i=0;i<styles.length;i++){const style=styles[i],key=JSON.stringify(style);if(key==='{}'){previous='';continue;}if(previous===key&&runs.at(-1)?.end===i)runs.at(-1).end=i+1;else runs.push({start:i,end:i+1,style});previous=key;}
    return {baseText:content,runs};
  }
  function plan(el,record,options={}){
    if(!text(el)||!validTypography(record))throw Error('文字格式无效');const f=factor(options),oldSize=rich()?.pointSize(el)||12,size=record.fontSize/f,props={'font-family':record.fontFamily,'font-size':rounded(size),'font-weight':record.fontWeight,'font-style':record.fontStyle,fill:record.fill,'letter-spacing':rounded(record.letterSpacing/letterFactor(options)),'line-height':String(record.lineHeight)},children=[];
    for(const node of el.querySelectorAll('tspan[data-key]')){
      const key=node.getAttribute('data-key'),values={},ownSize=node.style?.getPropertyValue?.('font-size')||node.getAttribute('font-size')||'';
      if(ownSize&&!/(?:%|em)$/i.test(ownSize.trim())){const childSize=rich()?.pointSize(node);if(childSize>0&&oldSize>0)values['font-size']=rounded(childSize*size/oldSize);}
      // Explicit native fonts/colors must follow the new base appearance. A
      // character's bold/italic/script semantics stay in its own native/run
      // span, rather than being copied from unrelated source characters.
      if(node.style?.getPropertyValue?.('font-family')||node.hasAttribute('font-family'))values['font-family']=record.fontFamily;
      if(node.style?.getPropertyValue?.('fill')||node.hasAttribute('fill'))values.fill=record.fill;
      if(Object.keys(values).length)children.push({key,props:values});
    }
    // A former whole-text character override must not defeat a regular brush
    // font. Keep target-local partial emphasis and scripts, without importing
    // the source string's character ranges or re-encoding native PDF offsets.
    const api=rich(),native=api?.nativeStyles(el),content=el.textContent;
    if(api&&content){let runs=options.richText?api.remap(options.richText,content):nativeRichRecord(el),changed=false;
      for(const [property,next]of [['bold',record.fontWeight==='700'],['italic',record.fontStyle!=='normal']])if(!next&&native?.runs.filter(run=>run.style[property]===true).reduce((n,run)=>n+run.end-run.start,0)===content.length){runs=api.format(runs,content,0,content.length,property,false);changed=true;}
      if(changed)props['rich-text']=JSON.stringify(runs);
    }
    return {props,children};
  }
  function available(target,role){
    const el=target?.el;if(!text(el)||target.disabled||target.original||role==='target'&&target.locked)return false;
    for(let node=el;node?.nodeType===1;node=node.parentElement)if(node.getAttribute?.('aria-disabled')==='true'||node.getAttribute?.('display')==='none'||node.style?.display==='none'||['hidden','collapse'].includes(node.getAttribute?.('visibility')||node.style?.visibility))return false;
    return true;
  }
  function createPainter(adapter={}){
    let armed=null;
    const status=()=>({active:!!armed,source:armed?.identity||null,record:armed?.record||null});
    const changed=()=>adapter.changed?.(status());
    const valid=(target,role)=>available(target,role)&&adapter.valid?.(target,role)!==false;
    return {
      arm(source){if(!valid(source,'source'))return false;try{const record=adapter.read?adapter.read(source):capture(source.el,{pointFactor:source.pointFactor,fill:source.fill});if(!validTypography(record))return false;armed={identity:source.identity||source.el,record:Object.freeze({...record})};changed();return true;}catch(error){adapter.error?.(error);return false;}},
      apply(targets){if(!armed)return false;const items=Array.isArray(targets)?targets:[targets],seen=new Set(),chosen=items.filter(target=>valid(target,'target')&&!seen.has(target.identity||target.el)&&(seen.add(target.identity||target.el),true));if(!chosen.length)return false;try{const result=adapter.write?.(chosen,armed.record);if(result===false)return false;armed=null;changed();return true;}catch(error){adapter.error?.(error);return false;}},
      cancel(){if(!armed)return false;armed=null;changed();return true;},
      status
    };
  }
  function snapshot(m){return m.nodes.map(node=>({node,attributes:['x','y','dx','dy','textLength','lengthAdjust','style'].map(key=>[key,node.getAttribute(key)])}));}
  function restore(records){for(const {node,attributes}of records)for(const [key,value]of attributes)if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);}
  // Preview does not clone the project or rebuild the board on each input.
  // The host owns one state commit on release/blur and guards stale sessions.
  function createPreview(targets,adapter={}){
    const frames=targets.filter(target=>available(target,'target')).map(target=>{const measured=measure(target.el);return {target,measured,saved:snapshot(measured),pointFactor:letterFactor(target)};}),schedule=adapter.requestFrame||globalThis.requestAnimationFrame||((fn)=>setTimeout(fn,0)),cancel=adapter.cancelFrame||globalThis.cancelAnimationFrame||clearTimeout;
    let handle=0,pending=null,closed=false;
    const valid=()=>!closed&&adapter.valid?.()!==false;
    const draw=()=>{handle=0;if(!valid()){pending=null;return;}for(const frame of frames){restore(frame.saved);const local={...pending};if(local.letterSpacing!==undefined)local.letterSpacing/=frame.pointFactor;applyMeasured(frame.measured,local);}adapter.drawn?.();};
    return {
      update(config){if(!valid()||!config||config.letterSpacing===undefined&&config.lineHeight===undefined)return false;if(config.letterSpacing!==undefined&&(!Number.isFinite(+config.letterSpacing)||Math.abs(+config.letterSpacing)>1000)||config.lineHeight!==undefined&&!validateSpacing('line-height',String(config.lineHeight)))return false;pending={...config};if(!handle)handle=schedule(draw);return true;},
      flush(){if(!valid())return false;if(handle){cancel(handle);handle=0;draw();}return !!pending;},
      finish(keep=false){if(closed)return;this.flush();if(handle)cancel(handle);handle=0;closed=true;if(!keep)for(const frame of frames)restore(frame.saved);pending=null;},
      get count(){return frames.length;}
    };
  }

  function validParagraph(value){try{const p=typeof value==='string'?JSON.parse(value):value;return !!p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).every(k=>['left','right','first'].includes(k))&&Object.values(p).every(v=>Number.isFinite(v)&&Math.abs(v)<=1e8);}catch{return false;}}
  function applyParagraph(el,value){
    if(!validParagraph(value))return el;const p=typeof value==='string'?JSON.parse(value):value,m=measure(el),anchor=inherited(el,'text-anchor','start'),base=anchor==='end'?-(p.right||0):anchor==='middle'?((p.left||0)-(p.right||0))/2:(p.left||0);
    const shift=line=>base+(Math.abs(line-m.anchor)<m.size*.55?(p.first||0):0);
    // Explicit x lists and native math spans retain all relative glyph offsets.
    for(const r of m.records)if(r.x)r.node.setAttribute('x',r.x.map((x,i)=>rounded(x+shift(r.y?.length>1?r.y[Math.min(i,r.y.length-1)]:r.line))).join(' '));
    if(!m.records.some(r=>r.x))el.setAttribute('dx',rounded((m.records[0].dx?.[0]||0)+base+(p.first||0)));
    return el;
  }
  return {validParagraph,applyParagraph,validateSpacing,fontFamily,validTypography,readSpacing,applySpacing,capture,plan,createPainter,createPreview,hex};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioTextFormatting;
