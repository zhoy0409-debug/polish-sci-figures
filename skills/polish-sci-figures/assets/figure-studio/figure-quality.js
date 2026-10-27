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
        texts.push(item);
      }else if(item.kind==='line'&&Number.isFinite(item.strokePt)&&item.strokePt>0&&item.strokePt<p.minLinePt-.005)add('thin-line',item,`最终线宽 ${item.strokePt.toFixed(2)} pt，小于当前阈值 ${p.minLinePt} pt。`,{strokePt:item.strokePt,thresholdPt:p.minLinePt});
    }
    const coverage=[{check:'最终尺寸、可测文字和线条',status:'measured',detail:`${items.length} 个可测对象；${texts.length} 段文字。`},{check:'文字相交',status:pairLimit?'partial':'measured',detail:pairLimit?'达到空间比较上限；结果不代表完整检查。':'外接框筛查，需人工确认。'},{check:'文字与背景对比',status:items.some(i=>i.kind==='text'&&i.background&&i.opaque)?'partial':'unverifiable',detail:'只检查已测得的均匀不透明背景；图片、渐变及复杂遮挡不作推断。'}];
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
        items.push({id:'object-'+i,kind:text?'text':stroked?'line':'graphic',target,box,...(text?{text:node.textContent.slice(0,300),sizePt:parseFloat(style.fontSize)*factor,color:rgb(style.fill),background,opaque:opacity===1&&Number(style.fillOpacity)===1,clipped:clipped.clipped}:stroked?{strokePt:parseFloat(style.strokeWidth)*(style.vectorEffect==='non-scaling-stroke'?72/96:factor)}:{})});
      }catch{unmeasured++;}
    }
    return {paper:{x:vb.x*scale,y:vb.y*scale,width:vb.width*scale,height:vb.height*scale},items,panels,unmeasured,unverifiedClips};
  }
  return {VERSION,PROFILES,profile,inspect,measure,contrast};
});
