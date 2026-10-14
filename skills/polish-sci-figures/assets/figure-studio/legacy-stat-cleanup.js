/* Remove only the identifiable, retired Figure Studio comparison footer.
 * Run before the SVG sanitizer drops editor data attributes. Original chart
 * nodes, transforms and data-key values remain untouched. The returned source
 * ordinals let a caller preserve eN identities while sanitizing retained nodes.
 */
'use strict';
const StudioLegacyStatCleanup=(()=>{
  const NS='http://www.w3.org/2000/svg',NUMBER='[-+]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][-+]?\\d+)?';
  const finite=Number.isFinite,near=(a,b)=>Math.abs(a-b)<1e-5*Math.max(1,Math.abs(a),Math.abs(b));
  const words=node=>String(node.textContent||'').replace(/\s+/g,' ').trim();
  const title=value=>/^(?:本小图组间比较|Group comparisons|Within-panel group comparisons|Panel comparisons)(?:\s*[·:：]\s*.+)?$/.test(value);
  function field(node,name,family='stat'){
    const matches=[...node.attributes].filter(a=>new RegExp('^data-(?:[\\w]+-)*'+family+'-'+name+'$').test(a.localName||a.name));
    return matches.length===1?matches[0].value:null;
  }
  function box(node){const value=String(node.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);return value.length===4&&value.every(finite)&&value[2]>0&&value[3]>0?value:null;}
  function length(raw){const match=String(raw||'').match(/^\s*([+]?(?:\d*\.\d+|\d+\.?\d*))\s*(pt|px|mm|cm|in)?\s*$/i);if(!match)return null;const value=Number(match[1]),unit=(match[2]||'px').toLowerCase(),factor={pt:1,px:.75,mm:72/25.4,cm:72/2.54,in:72}[unit];return value>0&&finite(value)?{value,unit,explicit:!!match[2],pt:value*factor,factor}:null;}
  function paint(node,name){return (node.style?.getPropertyValue(name)||node.getAttribute(name)||'').trim().toLowerCase();}
  function translate(node){const value=String(node.getAttribute('transform')||'').trim();if(!value)return{x:0,y:0};let m=value.match(new RegExp('^translate\\(\\s*('+NUMBER+')(?:[\\s,]+('+NUMBER+'))?\\s*\\)$'));if(m)return{x:Number(m[1]),y:Number(m[2]||0)};m=value.match(new RegExp('^matrix\\(\\s*('+NUMBER+')[\\s,]+('+NUMBER+')[\\s,]+('+NUMBER+')[\\s,]+('+NUMBER+')[\\s,]+('+NUMBER+')[\\s,]+('+NUMBER+')\\s*\\)$'));return m&&near(+m[1],1)&&near(+m[2],0)&&near(+m[3],0)&&near(+m[4],1)?{x:+m[5],y:+m[6]}:null;}
  function position(group,canvas){let x=0,y=0;for(let node=group;node&&node!==canvas;node=node.parentElement){const t=translate(node);if(!t)return null;x+=t.x;y+=t.y;}return{x,y};}
  function rule(node,view){
    if(node?.localName!=='path'||paint(node,'fill')!=='none'||paint(node,'stroke')!=='#d7dfe9')return null;
    const match=String(node.getAttribute('d')||'').trim().match(new RegExp('^M\\s*('+NUMBER+')[\\s,]+('+NUMBER+')\\s*H\\s*('+NUMBER+')\\s*$'));
    if(!match)return null;const x=+match[1],y=+match[2],end=+match[3],unit=x/12;
    return finite(unit)&&unit>0&&near(y,4*unit)&&near(end,view[2]-x)?unit:null;
  }
  function generatedBracket(node){
    if(node.localName!=='path'||paint(node,'fill')!=='none'||paint(node,'stroke')!=='#8290a3')return false;
    const raw=String(node.getAttribute('d')||''),tokens=raw.replace(new RegExp(NUMBER,'g'),'').replace(/[\s,]/g,'');
    return raw.length<400&&/^M[MLHVQ]+$/.test(tokens)&&raw.match(new RegExp(NUMBER,'g'))?.every(v=>finite(Number(v)));
  }
  function tableSignature(children,unit,view){
    const result=value=>/^(?:P\s*[=<≤]\s*\S.+|[*#]{1,4}|ns|[a-z]{1,8})$/.test(value);let rows=0;
    for(let i=2;i<children.length;){
      const label=children[i],value=children[i+1],line=children[i+2];
      if(label.localName!=='text')return false;
      const left=Number(label.getAttribute('x')),right=value?.localName==='text'?Number(value.getAttribute('x')):NaN;
      if(value?.localName==='text'&&result(words(value))&&near(left,12*unit)&&right>=view[2]*.5){
        if(/—/.test(words(label))){if(!line||!generatedBracket(line))return false;i+=3;rows++;continue;}
        if(/^[a-z]{1,8}$/.test(words(value))){i+=2;rows++;continue;}
      }
      // The old table used bold isolated facet headings, not free body prose.
      if(!['700','bold'].includes(paint(label,'font-weight'))||!near(left,12*unit))return false;
      i++;
    }
    return rows>0;
  }
  function identify(group,canvas,view){
    if(group.namespaceURI!==NS||group.localName!=='g'||group.closest('svg')!==canvas||group.closest('defs,clipPath,mask,pattern,symbol'))return null;
    const children=[...group.children],first=children[0],marker=field(group,'band'),source=Number(field(canvas,'source-height')),band=Number(field(canvas,'band-height')),knownDimensions=source>0&&band>0&&finite(source)&&finite(band);
    if(marker!==null&&marker!=='whole-panel')return null;
    const marked=marker==='whole-panel',texts=children.filter(node=>node.localName==='text'),allResults=texts.length>0&&texts.every(node=>field(node,'result')==='true');
    // Explicit owner and source-size records survive arbitrary recoloring or
    // manual result wording. Do not make this proof depend on default paint.
    const declared=marked&&knownDimensions&&first?.localName==='path'&&field(first,'decoration')==='true'&&children.length>=4&&allResults&&children.slice(1).every(node=>['text','path'].includes(node.localName)&&field(node,'result')==='true')&&[...group.querySelectorAll('*')].every(node=>['path','text','tspan'].includes(node.localName));
    if(declared){const rawAux=Number(field(canvas,'height','condition')),aux=rawAux>0&&finite(rawAux)?rawAux:0,unit=view[3]/(source+band+aux),top=view[1]+(source+aux)*unit;return finite(unit)&&unit>0&&top>view[1]&&top<view[1]+view[3]?{group,top,unit,marked}:null;}
    const unit=rule(first,view);if(!unit)return null;
    // A user's image, shape, group, link or unrelated path is never discarded.
    if(children.length<4||children.some((node,i)=>i?node.localName!=='text'&&!generatedBracket(node):node!==first))return null;
    if([...group.querySelectorAll('*')].some(node=>!['path','text','tspan'].includes(node.localName)))return null;
    const hasTitle=title(words(texts[0]));
    if(!hasTitle&&!(marked&&allResults))return null;
    const exactTable=hasTitle&&tableSignature(children,unit,view);
    if(!marked&&!allResults&&!exactTable)return null;
    const point=position(group,canvas);if(!point||!near(point.x,view[0])||point.y<=view[1]||point.y>=view[1]+view[3])return null;
    if(marked&&!allResults&&!(knownDimensions&&exactTable))return null;
    const results=texts.slice(1).filter(node=>/^(?:P\s*[=<≤]|[*#]+$|ns$|[a-z]{1,8}$)/i.test(words(node)));
    if(!results.length&&!allResults)return null;
    // Marker-free recovery still needs an actual old table and graph above it.
    if(!marked&&(!hasTitle||(!allResults&&!exactTable)||texts.length<4||!canvas.querySelector('g[id*="axes_"],rect[id*="studio-plot-frame"]')))return null;
    return{group,top:point.y,unit,marked};
  }
  function clean(root,options={}){
    const none={changed:false,removedBands:0,canvases:[],ordinals:null,keyEnd:0,removedKeys:[]};
    if(root?.localName!=='svg'||root.namespaceURI!==NS)return none;
    const plans=[];
    for(const canvas of [root,...root.querySelectorAll('svg')]){
      const view=box(canvas);if(!view)continue;
      const bands=[...canvas.querySelectorAll('g')].map(group=>identify(group,canvas,view)).filter(Boolean);
      if(!bands.length)continue;const top=Math.min(...bands.map(band=>band.top)),height=top-view[1];
      if(!finite(height)||height<=0||height>=view[3])continue;
      plans.push({canvas,bands,beforeViewBox:view,viewBox:[view[0],view[1],view[2],height]});
    }
    if(!plans.length)return none;
    const eligible=options.keyEligible||((node)=>node.localName!=='metadata'),original=[root,...root.querySelectorAll('*')].filter(eligible),ordinals=new Map(original.map((node,index)=>[node,index]));
    const result={changed:true,removedBands:0,canvases:[],ordinals,keyEnd:original.length,removedKeys:[]};
    for(const plan of plans){
      const {canvas,bands,beforeViewBox,viewBox}=plan,originalHeight=canvas.getAttribute('height'),wide=length(canvas.getAttribute('width')),tall=length(originalHeight),scale=wide?wide.pt/viewBox[2]:null;
      let height=originalHeight,heightPt=null;
      // Old appenders changed viewBox only. Derive the restored physical height
      // from width, rather than scaling an already-original height a second time.
      if(scale&&finite(scale)){heightPt=viewBox[3]*scale;const unit=tall?.unit||wide.unit,factor={pt:1,px:.75,mm:72/25.4,cm:72/2.54,in:72}[unit],suffix=tall?tall.explicit?unit:'':wide.explicit?unit:'';height=String(heightPt/factor)+suffix;}
      else if(tall){height=tall.value*viewBox[3]/beforeViewBox[3]+(tall.explicit?tall.unit:'');heightPt=tall.pt*viewBox[3]/beforeViewBox[3];}
      for(const {group}of bands){for(const node of [group,...group.querySelectorAll('[data-key]')]){const key=node.getAttribute('data-key');if(key)result.removedKeys.push(key);}group.remove();result.removedBands++;}
      canvas.setAttribute('viewBox',viewBox.join(' '));if(height!==null)canvas.setAttribute('height',height);
      for(const a of [...canvas.attributes])if(/^data-(?:[\w]+-)*stat-(?:source-height|band-height)$/.test(a.localName||a.name))canvas.removeAttributeNode(a);
      result.canvases.push({node:canvas,beforeViewBox,viewBox,beforeHeight:originalHeight,height,heightPt,removedBands:bands.length});
    }
    return result;
  }
  return{clean};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioLegacyStatCleanup;
if(typeof window!=='undefined')window.StudioLegacyStatCleanup=StudioLegacyStatCleanup;
