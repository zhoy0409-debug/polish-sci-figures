/* Final-size, local figure review. Measurements are supplied by the real SVG renderer. */
(function(root,factory){const api=factory();
  api.inspectAsync=(manifest,settings={},options={})=>{
    if(options.signal?.aborted)return Promise.reject(Object.assign(Error('检查已取消'),{name:'AbortError'}));
    if(typeof root.Worker!=='function')return Promise.resolve().then(()=>api.inspect(manifest,settings));
    return new Promise((resolve,reject)=>{
      const source=`const rules=(${factory.toString()})();self.onmessage=e=>{try{self.postMessage({ok:true,result:rules.inspect(e.data.manifest,e.data.settings)});}catch(error){self.postMessage({ok:false,error:error.message});}};`,url=root.URL.createObjectURL(new root.Blob([source],{type:'text/javascript'}));let worker;
      const cleanup=()=>{worker?.terminate();root.URL.revokeObjectURL(url);options.signal?.removeEventListener('abort',abort);},abort=()=>{cleanup();reject(Object.assign(Error('检查已取消'),{name:'AbortError'}));};
      try{worker=new root.Worker(url,{name:'figure-quality-local'});worker.onmessage=event=>{cleanup();event.data.ok?resolve(event.data.result):reject(Error(event.data.error));};worker.onerror=event=>{cleanup();reject(Error(event.message||'后台质检失败'));};options.signal?.addEventListener('abort',abort,{once:true});worker.postMessage({manifest,settings});}catch(error){cleanup();reject(error);}
    });
  };
  if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioFigureQuality=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const VERSION='figure-quality/1';
  const PROFILES=Object.freeze({general:Object.freeze({id:'general',name:'通用预检（非期刊认证）',minTextPt:8,minLinePt:.25,minContrast:3,background:'#ffffff'})});
  function profile(value={}){const p={...PROFILES.general,...value};if(!Number.isFinite(p.minTextPt)||p.minTextPt<4||p.minTextPt>36||!Number.isFinite(p.minLinePt)||p.minLinePt<.1||p.minLinePt>3||!Number.isFinite(p.minContrast)||p.minContrast<1||p.minContrast>21||!/^#[0-9a-f]{6}$/i.test(p.background))throw Error('预检阈值无效');return p;}
  function luminance(hex){if(!/^#[0-9a-f]{6}$/i.test(hex||''))return null;const c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*c[0]+.7152*c[1]+.0722*c[2];}
  function contrast(a,b){const x=luminance(a),y=luminance(b);return x===null||y===null?null:(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  // Machado, Oliveira & Fernandes (2009), severity 1.0, in linear RGB.
  // Vision and notation rules stay identical to svg_final_size_qa.py.
  const VISION=Object.freeze({protan:[[.152286,1.052583,-.204868],[.114503,.786281,.099216],[-.003882,-.048116,1.051998]],deutan:[[.367322,.860646,-.227968],[.280085,.672501,.047413],[-.011820,.042940,.968881]],tritan:[[1.255528,-.076749,-.178779],[-.078411,.930809,.147602],[.004733,.691367,.303900]],grayscale:[[.2126,.7152,.0722],[.2126,.7152,.0722],[.2126,.7152,.0722]]});
  const MAX_CATEGORIES=24;
  function lab(hex,vision){
    let c=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
    if(vision)c=VISION[vision].map(row=>Math.min(1,Math.max(0,row.reduce((sum,m,i)=>sum+m*c[i],0))));
    const [r,g,b]=c,[x,y,z]=[(.4124564*r+.3575761*g+.1804375*b)/.95047,.2126729*r+.7151522*g+.0721750*b,(.0193339*r+.1191920*g+.9503041*b)/1.08883].map(v=>v>216/24389?Math.cbrt(v):(24389/27*v+16)/116);
    return [116*y-16,500*(x-y),200*(y-z)];
  }
  function deltaE(p,q){ // CIEDE2000
    const rad=Math.PI/180,[l1,,b1]=p,[l2,,b2]=q;let a1=p[1],a2=q[1];
    const cb=(Math.hypot(a1,b1)+Math.hypot(a2,b2))/2,g=.5*(1-Math.sqrt(cb**7/(cb**7+25**7)));a1*=1+g;a2*=1+g;
    const c1=Math.hypot(a1,b1),c2=Math.hypot(a2,b2),h1=(Math.atan2(b1,a1)/rad+360)%360,h2=(Math.atan2(b2,a2)/rad+360)%360,flat=c1*c2===0;
    const dh=flat?0:((h2-h1+180)%360+360)%360-180,H=2*Math.sqrt(c1*c2)*Math.sin(dh/2*rad),L=(l1+l2)/2,C=(c1+c2)/2;
    const h=flat?h1+h2:Math.abs(h1-h2)<=180?(h1+h2)/2:(h1+h2+360)/2%360;
    const t=1-.17*Math.cos((h-30)*rad)+.24*Math.cos(2*h*rad)+.32*Math.cos((3*h+6)*rad)-.2*Math.cos((4*h-63)*rad),sl=1+.015*(L-50)**2/Math.sqrt(20+(L-50)**2),sc=1+.045*C,sh=1+.015*C*t;
    const rt=-Math.sin(60*Math.exp(-(((h-275)/25)**2))*rad)*2*Math.sqrt(C**7/(C**7+25**7)),x=(l2-l1)/sl,y=(c2-c1)/sc,z=H/sh;
    return Math.sqrt(Math.max(0,x*x+y*y+z*z+rt*y*z));
  }
  // Neutral inks carry axes and text; only chromatic colours are compared.
  function colorConflicts(colors){
    const list=[...new Set([...colors].map(c=>c.toLowerCase()))].filter(c=>/^#[0-9a-f]{6}$/.test(c)&&Math.hypot(...lab(c).slice(1))>=12).sort(),conflicts=[];
    if(list.length>MAX_CATEGORIES)return {conflicts,complete:false};
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const normal=deltaE(lab(list[i]),lab(list[j]));if(normal<12)continue;
      for(const vision of Object.keys(VISION)){const simulated=deltaE(lab(list[i],vision),lab(list[j],vision));if(simulated<6)conflicts.push({first:list[i],second:list[j],vision,normal:Math.round(normal*10)/10,simulated:Math.round(simulated*10)/10});}
    }
    return {conflicts:conflicts.sort((a,b)=>a.simulated-b.simulated),complete:true};
  }
  const SUB=s=>s.replace(/\d/g,d=>'₀₁₂₃₄₅₆₇₈₉'[d]),SUP=s=>s.replace(/[\d+-]/g,d=>d==='-'?'⁻':d==='+'?'⁺':'⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);
  // Last entry: skip text with tspans, where a semantic subscript and a
  // baseline digit look identical once flattened.
  const NOTATION=[
    ['subscript',/\b(MIC|IC|EC|ED|LD|GI|TC|CC|LC)(50|90|99)\b/g,(m,a,b)=>a+SUB(b),true],
    ['subscript',/\b([Ll]og)(2|10)(?![\d.])/g,(m,a,b)=>a+SUB(b),true],
    ['subscript',/\b(?:H2O2|H2O|CO2|CaCl2|MgCl2)\b/g,m=>SUB(m),true],
    ['superscript',/\^\{?([-+−]?\d+)\}?/g,(m,a)=>SUP(a.replace('−','-')),false],
    ['scientific',/(?<![\w.])(\d(?:\.\d+)?)[eE]([-+]?)0*(\d+)(?![\w.])/g,(m,a,sign,b)=>a+' × 10'+SUP(sign.replace('+','')+b),false],
    ['sign',/(?<=\d)\s*[xX*]\s*(?=10[⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g,()=>' × ',false],
    ['sign',/\+\/-/g,()=>'±',false],['sign',/<=/g,()=>'≤',false],['sign',/>=/g,()=>'≥',false],['sign',/^-(?=\d)/g,()=>'−',false],
    ['unit',/(?<![^\d\s(\[/])u(?=(?:g|L|l|M|m|mol)(?:$|[\s)\]/.,·]))/g,()=>'µ',false],
    ['spacing',/\b([PpNnRrqQ])\s*([=<>≤≥])\s*(?=[\d.−-])/g,(m,a,b)=>a+' '+b+' ',false]
  ];
  function suggestNotation(text,plain=true){
    const codes=[];
    for(const [code,pattern,replacement,skipRich]of NOTATION){if(skipRich&&!plain)continue;const updated=text.replace(pattern,replacement);if(updated!==text&&!codes.includes(code))codes.push(code);text=updated;}
    return {text,codes};
  }
  // Many text fonts, including common Arial builds, lack Unicode sub/superscript
  // digits and silently fall back. Corrections use baseline characters plus
  // script ranges, so the figure keeps its declared family.
  function scriptRuns(value){
    const SUBS='₀₁₂₃₄₅₆₇₈₉',SUPS='⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺',runs=[];let text='';
    for(const c of value){
      const low=SUBS.indexOf(c),high=SUPS.indexOf(c),script=low>=0?'sub':high>=0?'super':null,last=runs.at(-1);
      if(script){if(last&&last.script===script&&last.end===text.length)last.end++;else runs.push({start:text.length,end:text.length+1,script});}
      text+=low>=0?String(low):high>=0?'0123456789−+'[high]:c;
    }
    return {text,runs};
  }
  // The editor wraps every edited phrase in tspans. Only positioned, resized,
  // shifted or differently styled runs carry formatting a text edit could lose.
  function plainText(el){
    const read=(n,css,attr)=>n.style?.[css]||n.getAttribute(attr)||'',weight=v=>v==='bold'?'700':v==='normal'||!v?'400':v,base={weight:weight(read(el,'fontWeight','font-weight')),style:read(el,'fontStyle','font-style')||'normal',size:read(el,'fontSize','font-size'),family:read(el,'fontFamily','font-family'),fill:read(el,'fill','fill')};
    return [...el.querySelectorAll('tspan')].every(n=>{
      if(['x','y','dx','dy','rotate'].some(k=>n.hasAttribute(k)))return false;
      const shift=read(n,'baselineShift','baseline-shift'),own=(css,attr,value,normal=v=>v)=>{const v=read(n,css,attr);return !v||normal(v)===value;};
      return (!shift||shift==='baseline'||parseFloat(shift)===0)&&own('fontWeight','font-weight',base.weight,weight)&&own('fontStyle','font-style',base.style)&&own('fontSize','font-size',base.size)&&own('fontFamily','font-family',base.family)&&own('fill','fill',base.fill);
    });
  }
  const intersection=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
  function inspect(manifest,settings={}){
    const p=profile(settings),issues=[],items=manifest.items||[],paper=manifest.paper;let findingCount=0;
    if(!paper||!['x','y','width','height'].every(k=>Number.isFinite(paper[k]))||paper.width<=0||paper.height<=0)throw Error('缺少真实画布测量');
    const add=(code,item,message,extra={})=>{findingCount++;if(issues.length<2000)issues.push({id:code+':'+item.id+':'+findingCount,code,severity:'review',target:item.target||null,message,...extra});};
    const texts=[],buckets=new Map(),pairs=new Set(),cell=36;
    let pairLimit=false,comparisons=0;
    for(const item of items){
      const b=item.box;if(!b||!['x','y','width','height'].every(k=>Number.isFinite(b[k]))||b.width<0||b.height<0||!b.width&&!b.height)continue;
      if(b.x<paper.x-.6||b.y<paper.y-.6||b.x+b.width>paper.x+paper.width+.6||b.y+b.height>paper.y+paper.height+.6)add('outside-canvas',item,'内容超出最终画布，请检查是否会被裁切。',{severity:'warning'});
      if(item.kind==='text'&&item.clipped)add('text-clipped',item,'文字被内部裁切边界截断，请定位检查。',{severity:'warning'});
      if(item.kind==='text'){
        if(Number.isFinite(item.sizePt)&&item.sizePt<p.minTextPt-.05)add('small-text',item,`最终字号 ${item.sizePt.toFixed(1)} pt，小于当前阈值 ${p.minTextPt} pt。`,{sizePt:item.sizePt,thresholdPt:p.minTextPt});
        // Contrast is evaluated only on a measured, opaque uniform background.
        if(item.background&&item.opaque){const ratio=contrast(item.color,item.background);if(ratio!==null&&ratio<p.minContrast)add('text-contrast',item,`文字与已确认背景的对比度 ${ratio.toFixed(2)}，低于 ${p.minContrast}。`,{contrast:ratio,threshold:p.minContrast});}
        const startX=Math.floor(b.x/cell),endX=Math.floor((b.x+b.width)/cell),startY=Math.floor(b.y/cell),endY=Math.floor((b.y+b.height)/cell),neighbours=new Set();
        // Pathological huge boxes are not inserted into millions of cells.
        if(!pairLimit&&(endX-startX+1)*(endY-startY+1)<=1024){
          for(let x=startX;x<=endX;x++)for(let y=startY;y<=endY;y++)for(const old of buckets.get(x+':'+y)||[])neighbours.add(old);
          for(const old of neighbours){if(++comparisons>100000){pairLimit=true;break;}if(item.target&&old.target&&JSON.stringify(item.target)===JSON.stringify(old.target))continue;const area=intersection(b,old.box),minArea=Math.min(b.width*b.height,old.box.width*old.box.height);if(area>1&&area/minArea>.15){const id=[item.id,old.id].sort().join('|');if(!pairs.has(id)){pairs.add(id);add('text-overlap',item,'两段文字的外接框相交，请定位检查；斜排文字可能只是外接框相交。',{related:old.target,otherText:old.text});}}}
          if(!pairLimit)for(let x=startX;x<=endX;x++)for(let y=startY;y<=endY;y++){const key=x+':'+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(item);}
        }else if(!pairLimit)pairLimit=true;
        const notation=suggestNotation(item.text||'',item.plain!==false);
        if(notation.codes.length)add('notation',item,`“${(item.text||'').slice(0,60)}” 建议写作 “${notation.text.slice(0,60)}”。`,{text:item.text,suggestion:notation.text,rules:notation.codes,plain:item.plain!==false});
        texts.push(item);
      }else if(item.kind==='line'&&Number.isFinite(item.strokePt)&&item.strokePt>0&&item.strokePt<p.minLinePt-.005)add('thin-line',item,`最终线宽 ${item.strokePt.toFixed(2)} pt，小于当前阈值 ${p.minLinePt} pt。`,{strokePt:item.strokePt,thresholdPt:p.minLinePt});
    }
    const families=new Map();for(const item of texts)if(item.family)families.set(item.family.toLowerCase(),item.family);
    if(families.size>1)add('mixed-fonts',{id:'figure',target:null},'可见文字使用了多种字体：'+[...families.values()].join('、')+'。',{families:[...families.values()]});
    const painted=new Map();for(const item of items)if(item.kind!=='text')for(const c of item.paints||[])if(c&&!painted.has(c))painted.set(c,item);
    const vision=colorConflicts(painted.keys()),byVision=new Map();for(const c of vision.conflicts){if(!byVision.has(c.vision))byVision.set(c.vision,[]);byVision.get(c.vision).push(c);}
    const visionNames={protan:'红色盲',deutan:'绿色盲',tritan:'蓝色盲',grayscale:'灰度'};
    for(const [name,hits]of byVision)add('color-merge',painted.get(hits[0].first),`${visionNames[name]}视觉下有 ${hits.length} 对颜色难以区分：${hits.slice(0,4).map(c=>c.first+' / '+c.second).join('，')}。若颜色承担分组含义，请增加形状、线型或直接标注。`,{vision:name,conflicts:hits.slice(0,20),count:hits.length});
    const coverage=[{check:'最终尺寸、可测文字和线条',status:'measured',detail:`${items.length} 个可测对象；${texts.length} 段文字。`},{check:'文字相交',status:pairLimit?'partial':'measured',detail:pairLimit?'达到空间比较上限；结果不代表完整检查。':'外接框筛查，需人工确认。'},{check:'文字与背景对比',status:items.some(i=>i.kind==='text'&&i.background&&i.opaque)?'partial':'unverifiable',detail:'只检查已测得的均匀不透明背景；图片、渐变及复杂遮挡不作推断。'},{check:'色觉与灰度区分',status:!painted.size?'unverifiable':vision.complete?'measured':'partial',detail:vision.complete?'按声明颜色模拟；不判断颜色是否承担分组含义，也不含图片与渐变。':'颜色较多，按连续色标处理，未逐对比较。'}];
    for(const panel of manifest.panels||[]){const a=panel.analysis;coverage.push({panel:panel.id,check:'统计与数据设计',status:panel.bound?'recorded':'unverifiable',detail:panel.bound?'存在结构化数据与分析记录；本预检不重新验证模型假设或证明统计正确。':'缺少可核对的结构化数据绑定，无法从图像确认独立性、配对、重复类型或误差含义。'});if(panel.stale)add('stale-statistics',{id:panel.id,target:{panel:panel.id}},'当前统计记录已过期，请按当前数据重新核对或计算。',{severity:'warning'});if(panel.bound&&a?.primary_estimand?.ci95){const ci=a.primary_estimand.ci95;if(!Array.isArray(ci)||ci.length!==2||!ci.every(Number.isFinite)||ci[0]>ci[1])add('invalid-interval',{id:panel.id,target:{panel:panel.id}},'绑定的置信区间无效；请返回数据分析核查。',{severity:'warning'});}}
    if(findingCount>issues.length)coverage.push({check:'报告容量',status:'partial',detail:`已检测 ${findingCount} 项，保留前 2000 项；请分批修正后重新检查。`});
    if(manifest.unmeasured)coverage.push({check:'无法测量的对象',status:'partial',detail:`${manifest.unmeasured} 个对象无法获得可靠几何，不作为通过项目。`});
    if(manifest.unverifiedClips)coverage.push({check:'复杂裁切',status:'partial',detail:`${manifest.unverifiedClips} 个对象的复杂裁切无法可靠核实；保留原始外接框供人工检查。`});
    return {schema:VERSION,profile:p,paper,issues,coverage,summary:{objects:items.length,texts:texts.length,issues:findingCount,reportedIssues:issues.length,overlapComplete:!pairLimit},limitations:['文字相交为外接框筛查，不是逐像素遮挡认证。','不从文字或图片猜测样本单位、误差棒含义、标定或统计模型。','检查结果对应本次快照；编辑或改变导出尺寸后需要重新检查。']};
  }
  function rgb(value){const match=/^rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/.exec(value||'');return match&&(!match[4]||+match[4]===1)?'#'+match.slice(1,4).map(n=>Math.min(255,+n).toString(16).padStart(2,'0')).join(''):null;}
  async function measure(svg,{signal,panels=[],yieldTask=()=>new Promise(r=>setTimeout(r,0))}={}){
    const doc=svg.ownerDocument,view=doc.defaultView,rootMatrix=svg.getScreenCTM();if(!rootMatrix)throw Error('画布尚未渲染');
    const inv=rootMatrix.inverse(),vb=svg.viewBox.baseVal,scale=svg.width.baseVal.value/Math.max(1e-12,vb.width)*72/96,items=[],styles=new WeakMap(),matrices=new WeakMap(),byId=new Map([...svg.querySelectorAll('[id]')].map(n=>[n.id,n]));let unmeasured=0,unverifiedClips=0;
    const styleOf=node=>{if(!styles.has(node))styles.set(node,view.getComputedStyle(node));return styles.get(node);},matrixOf=node=>{if(!matrices.has(node))matrices.set(node,inv.multiply(node.getScreenCTM()));return matrices.get(node);};
    const transformedBox=(b,m)=>{const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f})),xs=points.map(p=>p.x),ys=points.map(p=>p.y);return {x:Math.min(...xs)*scale,y:Math.min(...ys)*scale,width:(Math.max(...xs)-Math.min(...xs))*scale,height:(Math.max(...ys)-Math.min(...ys))*scale};};
    const boxOf=node=>transformedBox(node.getBBox(),matrixOf(node));
    function clipping(node,box){let result={...box},unknown=false;for(let ancestor=node;ancestor&&ancestor!==svg;ancestor=ancestor.parentElement){
      const value=ancestor.getAttribute('clip-path')||styleOf(ancestor).clipPath;if(!value||value==='none')continue;
      const id=/url\(\s*["']?[^"'()]*#([^"'()#]+)["']?\s*\)/.exec(value)?.[1],clip=byId.get(id),rect=clip?.children.length===1&&clip.firstElementChild;
      if(!rect||rect.localName!=='rect'||clip.getAttribute('clipPathUnits')==='objectBoundingBox'||Number(rect.getAttribute('rx')||0)>0||Number(rect.getAttribute('ry')||0)>0){unknown=true;continue;}
      let m=matrixOf(ancestor);for(const part of [clip,rect]){const transform=part.transform?.baseVal?.consolidate()?.matrix;if(transform)m=m.multiply(transform);}if(Math.abs(m.b)>1e-8||Math.abs(m.c)>1e-8){unknown=true;continue;}
      const bounds=transformedBox(rect.getBBox(),m),x=Math.max(result.x,bounds.x),y=Math.max(result.y,bounds.y),right=Math.min(result.x+result.width,bounds.x+bounds.width),bottom=Math.min(result.y+result.height,bounds.y+bounds.height);result={x,y,width:Math.max(0,right-x),height:Math.max(0,bottom-y)};
    }if(unknown)unverifiedClips++;return {box:result,clipped:result.width<box.width-.05||result.height<box.height-.05};}
    const nodes=[...svg.querySelectorAll('text,path,line,polyline,polygon,rect,circle,ellipse,image,use')];
    for(let i=0;i<nodes.length;i++){
      if(i%120===0){if(signal?.aborted)throw Object.assign(Error('检查已取消'),{name:'AbortError'});await yieldTask();}
      const node=nodes[i];if(node.closest('defs,clipPath,mask,[data-editor-guides],[data-grid-resize-guides]'))continue;
      const style=styleOf(node);let opacity=1,hidden=false;for(let parent=node;parent&&parent!==svg.parentElement;parent=parent.parentElement){const s=styleOf(parent);opacity*=Number(s.opacity);if(s.display==='none'||s.visibility==='hidden'||s.visibility==='collapse'){hidden=true;break;}}if(hidden||opacity<.01)continue;
      const transparent=value=>/^rgba\([^)]*[,/]\s*0(?:\.0+)?\s*\)$/.test(value),text=node.localName==='text',stroked=style.stroke!=='none'&&!transparent(style.stroke)&&Number(style.strokeOpacity)>=.01,filled=style.fill!=='none'&&!transparent(style.fill)&&Number(style.fillOpacity)>=.01;if(text&&(!node.textContent.trim()||!filled&&!stroked))continue;if(!text&&!stroked&&!filled&&!['image','use'].includes(node.localName))continue;
      try{const rawBox=boxOf(node),clipped=clipping(node,rawBox),box=text&&clipped.clipped?rawBox:clipped.box,m=matrixOf(node),factor=Math.hypot(m.c,m.d)*scale,pan=node.closest('svg[data-panel]'),label=node.closest('[data-panel-label]'),annotation=node.closest('[data-annotation]'),key=node.getAttribute('data-key'),target=pan&&key?{panel:pan.getAttribute('data-panel'),variant:+pan.getAttribute('data-variant'),key}:label?{panel:label.getAttribute('data-panel-label'),label:true}:annotation?{annotation:annotation.getAttribute('data-annotation')}:pan?{panel:pan.getAttribute('data-panel')}:null;
        let background=null;
        // Only a containing, opaque, unfiltered, axis-aligned rectangle behind
        // the text can establish its actual background. No assumed white canvas.
        if(text){let previous=node.previousElementSibling;for(let count=0;previous&&count++<12;previous=previous.previousElementSibling){if(['metadata','title','desc','defs'].includes(previous.localName))continue;const previousStyle=view.getComputedStyle(previous);if(previousStyle.display==='none'||previousStyle.visibility==='hidden'||Number(previousStyle.opacity)===0)continue;if(previous.localName!=='rect')break;const bs=view.getComputedStyle(previous),bm=inv.multiply(previous.getScreenCTM()),bb=boxOf(previous);if(Math.abs(bm.b)>1e-6||Math.abs(bm.c)>1e-6||previous.hasAttribute('filter')||bs.filter!=='none'||bs.clipPath!=='none'||Number(previous.getAttribute('rx')||0)>0||Number(previous.getAttribute('ry')||0)>0||Number(bs.opacity)!==1||Number(bs.fillOpacity)!==1)continue;if(bb.x<=box.x&&bb.y<=box.y&&bb.x+bb.width>=box.x+box.width&&bb.y+bb.height>=box.y+box.height){background=rgb(bs.fill);break;}}}
        items.push({id:'object-'+i,kind:text?'text':stroked?'line':'graphic',target,box,paints:text?[]:[filled&&node.localName!=='line'?rgb(style.fill):null,stroked?rgb(style.stroke):null].filter(Boolean),...(text?{text:node.textContent.slice(0,500),plain:plainText(node),family:style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g,''),sizePt:parseFloat(style.fontSize)*factor,color:rgb(style.fill),background,opaque:opacity===1&&Number(style.fillOpacity)===1,clipped:clipped.clipped}:stroked?{strokePt:parseFloat(style.strokeWidth)*(style.vectorEffect==='non-scaling-stroke'?72/96:factor)}:{})});
      }catch{unmeasured++;}
    }
    return {paper:{x:vb.x*scale,y:vb.y*scale,width:vb.width*scale,height:vb.height*scale},items,panels,unmeasured,unverifiedClips};
  }
  return {VERSION,PROFILES,VISION,profile,inspect,measure,contrast,lab,deltaE,colorConflicts,suggestNotation,scriptRuns,plainText};
});
