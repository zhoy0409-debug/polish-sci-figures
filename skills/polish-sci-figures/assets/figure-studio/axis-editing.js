/* Extend a recognized numeric SVG axis without rescaling any observations.
 * Persist DATA bounds, not screen pixels. Run apply on a fresh panel SVG after
 * plot fitting and before assigning/applying edits to generated elements. */
'use strict';
const StudioAxisEditing=(()=>{
  const NS='http://www.w3.org/2000/svg',XLINK='http://www.w3.org/1999/xlink',LIMIT=200;
  const I={a:1,b:0,c:0,d:1,e:0,f:0},KEY=/^e\d+$/;
  const geometry=()=>typeof StudioImageInsets!=='undefined'?StudioImageInsets:require('./image-insets.js');
  const finite=Number.isFinite,near=(a,b,t=1e-6)=>Math.abs(a-b)<=t*Math.max(1,Math.abs(a),Math.abs(b));
  function fail(code,message){const error=new Error(message);error.code='axis-'+code;throw error;}
  const matrix=(node,root,G)=>node===root?I:G.relativeMatrix(node,root);
  const matrixText=m=>'matrix('+['a','b','c','d','e','f'].map(k=>Object.is(m[k],-0)?0:m[k]).join(' ')+')';
  const idMatches=(node,pattern)=>pattern.test(node?.id||'');
  function shown(node,root){for(let n=node;n&&n!==root;n=n.parentElement){if(n.closest?.('defs,clipPath,mask,pattern,symbol'))return false;const s=n.style;if(s?.display==='none'||s?.visibility==='hidden'||n.getAttribute('display')==='none'||n.getAttribute('visibility')==='hidden'||s?.opacity==='0'||n.getAttribute('opacity')==='0')return false;}return true;}
  function segment(node){
    if(node.localName==='line'){
      const n=['x1','y1','x2','y2'].map(k=>Number(node.getAttribute(k)||0));
      return n.every(finite)?[{x:n[0],y:n[1]},{x:n[2],y:n[3]}]:null;
    }
    if(node.localName!=='path')return null;
    const number='([+-]?(?:\\d*\\.\\d+|\\d+\\.?\\d*)(?:[eE][+-]?\\d+)?)',match=(node.getAttribute('d')||'').trim().match(new RegExp('^M\\s*'+number+'[\\s,]+'+number+'\\s*L\\s*'+number+'[\\s,]+'+number+'\\s*$'));
    if(!match)return null;const n=match.slice(1).map(Number);return n.every(finite)?[{x:n[0],y:n[1]},{x:n[2],y:n[3]}]:null;
  }
  function numberLabel(text){
    // Positioned mathtext has per-glyph baselines; replacing it as plain text
    // could alter both its value and alignment. Do not infer that representation.
    if(text.querySelector('tspan'))return null;
    const raw=text.textContent.trim().replace(/\u2212/g,'-');
    if(!/^[+-]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][+-]?\d+)?$/.test(raw))return null;
    const value=Number(raw);return finite(value)&&Math.abs(value)<=1e100?{value,raw}:null;
  }
  function validate(value){
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{fail('record','Axis extension must contain valid data bounds.');}}
    if(!value||Object.keys(value).some(key=>!['version','axis','scale','min','max'].includes(key))||value.version!==1||!['x','y'].includes(value.axis)||!['linear','log'].includes(value.scale)||!finite(value.min)||!finite(value.max)||value.min>=value.max||Math.max(Math.abs(value.min),Math.abs(value.max))>1e100||value.scale==='log'&&value.min<=0)fail('record','Axis extension must contain valid data bounds.');
    return {version:1,axis:value.axis,scale:value.scale,min:value.min,max:value.max};
  }
  function controlsFor(svg,axes,controls){
    if(!controls){const metadata=[...svg.querySelectorAll('metadata')].filter(n=>/(?:^|-)studio-axis-controls$/.test(n.id));if(metadata.length===1)try{controls=JSON.parse(metadata[0].textContent);}catch{}}
    if(!controls||typeof controls!=='object')return null;
    const all=[...svg.querySelectorAll('g')].filter(n=>idMatches(n,/(?:^|[-_])axes_\d+$/)),index=all.indexOf(axes),records=controls.effective?.length?controls.effective:controls.default_axes;
    // Numeric-looking category labels are still categories. Keep the renderer's
    // explicit range capabilities alongside its scale and per-axis limits.
    const withCapabilities=record=>record?{...record,...Object.fromEntries(['x_range','y_range'].filter(name=>controls.supported!==false&&typeof controls[name]==='boolean').map(name=>[name,controls[name]]))}:null;
    if(Array.isArray(records)&&records.length===all.length&&index>=0)return withCapabilities(records[index]);
    return all.length===1?withCapabilities(controls.defaults):null;
  }
  function details(svg,key,options={}){
    const G=geometry();if(svg?.namespaceURI!==NS||svg.localName!=='svg'||!KEY.test(key||''))fail('source','Select a recognized numeric axis line.');
    const nodes=[...svg.querySelectorAll('[data-key]')].filter(n=>n.getAttribute('data-key')===key);
    if(nodes.length!==1)fail('source','The axis line is missing or ambiguous.');
    const spine=nodes[0],local=segment(spine);if(!local||!shown(spine,svg))fail('source','Select a recognized numeric axis line.');
    let axes=spine.parentElement;while(axes&&axes!==svg&&!idMatches(axes,/(?:^|[-_])axes_\d+$/))axes=axes.parentElement;
    if(!axes||axes===svg||!idMatches(spine.parentElement,/(?:^|[-_])patch_\d+$/)||spine.parentElement.parentElement!==axes)fail('structure','This SVG does not identify a numeric plotting axis reliably.');
    for(let node=spine;node&&node!==svg;node=node.parentElement)if(['clip-path','mask','filter'].some(name=>{const value=node.getAttribute(name)||node.style?.getPropertyValue(name);return value&&value!=='none';}))fail('geometry','A clipped or filtered axis cannot be extended reliably.');
    const own=matrix(spine,svg,G),points=local.map(p=>G.point(own,p)),dx=points[1].x-points[0].x,dy=points[1].y-points[0].y,length=Math.hypot(dx,dy);
    if(!finite(length)||length<1e-6)fail('geometry','The axis line has no reliable length.');
    // Canvas endpoint controls are vertical/horizontal. A rotated whole panel
    // remains editable as a whole; do not silently change its numeric mapping.
    const axis=Math.abs(dx)<length*1e-7?'y':Math.abs(dy)<length*1e-7?'x':null;
    if(!axis)fail('geometry','Rotate the plot back before extending its numeric axis.');
    const u={x:dx/length,y:dy/length},project=p=>(p.x-points[0].x)*u.x+(p.y-points[0].y)*u.y,cross=p=>(p.x-points[0].x)*u.y-(p.y-points[0].y)*u.x;
    const candidates=[];
    for(const group of [...axes.children].filter(n=>idMatches(n,/(?:^|[-_])matplotlib\.axis_\d+$/))){
      const ticks=[];let malformed=false;
      for(const tick of [...group.children].filter(n=>idMatches(n,new RegExp('(?:^|[-_])'+axis+'tick_\\d+$')))){
        if(!shown(tick,svg))continue;
        const markers=[...tick.querySelectorAll('use')].filter(n=>!n.closest('defs'));
        const matches=[];
        for(const marker of markers){const href=marker.getAttribute('href')||marker.getAttributeNS(XLINK,'href')||'',definition=[...svg.querySelectorAll('[id]')].filter(n=>n.id===href.slice(1));if(!href.startsWith('#')||definition.length!==1||!segment(definition[0]))continue;const p=G.point(matrix(marker,svg,G),{x:Number(marker.getAttribute('x')||0),y:Number(marker.getAttribute('y')||0)});if(!finite(p.x)||!finite(p.y)||Math.abs(cross(p))>Math.max(1e-4,length*1e-6))continue;matches.push({marker,point:p,position:project(p)});}
        if(matches.length!==1){if(matches.length>1)malformed=true;continue;}
        const texts=[...tick.querySelectorAll('text')].filter(n=>shown(n,svg)),label=texts.length===1?numberLabel(texts[0]):null;
        if(texts.length&&!label){malformed=true;continue;}
        ticks.push({node:tick,text:texts[0]||null,...matches[0],...(label||{})});
      }
      if(ticks.some(t=>t.text))candidates.push({group,ticks,malformed});
    }
    if(candidates.length!==1||candidates[0].malformed)fail('ticks','Axis ticks or numeric labels cannot be identified reliably.');
    const {group,ticks}=candidates[0],labelled=ticks.filter(t=>t.text).sort((a,b)=>a.position-b.position),control=controlsFor(svg,axes,options.controls),declared=control?.[axis+'_scale'];
    if(control?.[axis+'_range']===false||declared&&!['linear','log'].includes(declared))fail('scale','This axis scale is not supported for automatic extension.');
    const scale=declared||'linear',needed=declared?2:3;
    if(labelled.length<needed)fail('ticks','More numeric ticks or explicit axis-scale metadata are needed.');
    if(scale==='log'&&labelled.some(t=>t.value<=0))fail('scale','Logarithmic axis ticks must be positive.');
    // A separate numeric offset/scientific multiplier changes the meaning of
    // every displayed number. Never extrapolate those labels as raw values.
    const extra=[...group.querySelectorAll('text')].filter(n=>!n.closest('[data-axis-generated]')&&!ticks.some(t=>t.node.contains(n))&&shown(n,svg));
    if(extra.some(n=>numberLabel(n)||/[×+]\s*10|1e[+-]?\d|10\s*\^/i.test(n.textContent)))fail('offset','Axes with an offset or multiplier need a data-based range edit.');
    const transform=v=>scale==='log'?Math.log10(v):v,invert=v=>scale==='log'?10**v:v;
    const first=labelled[0],last=labelled[labelled.length-1],slope=(transform(last.value)-transform(first.value))/(last.position-first.position),intercept=transform(first.value)-slope*first.position;
    if(!finite(slope)||slope===0||!finite(intercept))fail('mapping','Numeric labels do not define a reliable axis mapping.');
    const valueTolerance=Math.max(Math.abs(transform(last.value)-transform(first.value))*2e-6,Math.abs(transform(first.value))*Number.EPSILON*16,1e-12);
    for(const tick of labelled)if(Math.abs(transform(tick.value)-(intercept+slope*tick.position))>valueTolerance)fail('mapping','Numeric labels do not follow one consistent axis scale.');
    const gaps=labelled.slice(1).map((tick,i)=>Math.abs(transform(tick.value)-transform(labelled[i].value))),step=gaps[0];
    if(!finite(step)||step<=0||gaps.some(gap=>!near(gap,step,2e-6)))fail('interval','Irregular major tick intervals cannot be extended automatically.');
    const origin=transform(first.value),families=[{phase:0,template:first,labelled:true}];
    // Preserve a regular minor-tick pattern, rather than silently adding only
    // major ticks to one end of an axis that already has minor ticks.
    for(const tick of ticks.filter(t=>!t.text)){
      const value=intercept+slope*tick.position,q=(value-origin)/step,phase=((q%1)+1)%1;
      if(near(phase,0)||near(phase,1))continue;
      if(!families.some(f=>near(f.phase,phase,2e-6)))families.push({phase,template:tick,labelled:false});
    }
    if(families.length>10)fail('interval','The minor tick pattern is too complex to extend safely.');
    const minLabel=Math.min(...labelled.map(t=>transform(t.value))),maxLabel=Math.max(...labelled.map(t=>transform(t.value))),allValues=ticks.map(t=>intercept+slope*t.position);
    for(const family of families.filter(f=>!f.labelled)){
      const firstIndex=Math.ceil((minLabel-origin)/step-family.phase-1e-7),lastIndex=Math.floor((maxLabel-origin)/step-family.phase+1e-7);
      if(lastIndex-firstIndex>LIMIT)fail('interval','The minor tick pattern is too complex to extend safely.');
      for(let i=firstIndex;i<=lastIndex;i++)if(!allValues.some(v=>near(v,origin+(i+family.phase)*step,2e-6)))fail('interval','Irregular minor tick intervals cannot be extended automatically.');
    }
    const range=points.map((_,i)=>invert(intercept+slope*(i?length:0)));
    if(range.some(v=>!finite(v)||Math.abs(v)>1e100)||scale==='log'&&range.some(v=>v<=0))fail('range','The axis range is outside the supported finite range.');
    const min=Math.min(...range),max=Math.max(...range);let base={min,max};
    if(spine.hasAttribute('data-axis-base-range')){try{const value=JSON.parse(spine.getAttribute('data-axis-base-range'));if(finite(value.min)&&finite(value.max)&&value.min<value.max&&(scale!=='log'||value.min>0))base=value;}catch{}}
    return {svg,key,spine,axes,group,local,own,points,u,length,axis,scale,step,origin,slope,intercept,transform,invert,valueTolerance,ticks,labelled,families,min,max,base,range,titles:extra};
  }
  function inspect(svg,key,options={}){
    try{const d=details(svg,key,options);return {supported:true,key,axis:d.axis,scale:d.scale,min:d.min,max:d.max,step:d.step,points:d.points.map(p=>({...p})),tickCount:d.labelled.length,relatedKeys:[d.key,...[d.group,...d.group.querySelectorAll('[data-key]')].map(n=>n.getAttribute('data-key')).filter(Boolean)]};}
    catch(error){const node=[...(svg?.querySelectorAll?.('[data-key]')||[])].find(n=>n.getAttribute('data-key')===key),candidate=!!(node&&segment(node)&&idMatches(node.parentElement,/(?:^|[-_])patch_\d+$/)&&idMatches(node.parentElement?.parentElement,/(?:^|[-_])axes_\d+$/));return {supported:false,candidate,key,reason:error.code||'axis-source',message:error.message};}
  }
  function planResize(svg,key,action,options={}){
    const d=details(svg,key,options),unit=options.unit??1,G=geometry(),n=Array.isArray(action)?action:action&&['a','b','c','d','e','f'].map(k=>action[k]);
    if(!finite(unit)||unit<=0||!n||n.length!==6||n.some(v=>!finite(v)))fail('geometry','Axis resize coordinates are invalid.');
    const m={a:n[0],b:n[1],c:n[2],d:n[3],e:n[4]*unit,f:n[5]*unit},points=d.points.map(p=>G.point(m,p));
    const position=p=>(p.x-d.points[0].x)*d.u.x+(p.y-d.points[0].y)*d.u.y;
    if(points.some(p=>Math.abs((p.x-d.points[0].x)*d.u.y-(p.y-d.points[0].y)*d.u.x)>Math.max(1e-4,d.length*1e-6))||position(points[1])<=position(points[0]))fail('direction','Extend an axis along its existing direction without rotating or moving it sideways.');
    const values=points.map(p=>d.invert(d.intercept+d.slope*position(p)));
    return validate({version:1,axis:d.axis,scale:d.scale,min:Math.min(...values),max:Math.max(...values)});
  }
  const formatted=value=>Number(value.toPrecision(16)).toString().replace(/^-/,'−');
  function generatedKey(key,value,index){
    // Deterministic, independent of the current extent: editing tick 30 must
    // still address tick 30 after adding tick 35. 52-bit decimal keys remain
    // compatible with existing e[0-9]+ selection/history records.
    const text=key+'|'+value+'|'+index;let a=2166136261,b=3339675911;for(const c of text){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b^c.charCodeAt(0),2246822519);}return 'e'+(4503599627370496+(a&0x7fffffff)*1048576+(b>>>12));
  }
  function buildPlan(d,record){
    const G=geometry(),r=validate(record);if(r.axis!==d.axis||r.scale!==d.scale)fail('scale','The saved extension no longer matches this axis scale.');
    // Cropping a numeric range without also clipping observations is misleading.
    // This operation extends the original range; data-based limits remain the
    // separate operation for removing part of a plot.
    const lo=d.transform(r.min),hi=d.transform(r.max),originalLo=d.transform(d.base.min),originalHi=d.transform(d.base.max),tolerance=d.valueTolerance;
    if(lo>originalLo+tolerance||hi<originalHi-tolerance)fail('shrink','This action can extend the original axis range; use data range controls to crop it.');
    const positions=[(lo-d.intercept)/d.slope,(hi-d.intercept)/d.slope].sort((a,b)=>a-b),rootPoints=positions.map(v=>({x:d.points[0].x+d.u.x*v,y:d.points[0].y+d.u.y*v})),localPoints=rootPoints.map(p=>G.point(G.inverse(d.own),p));
    if(localPoints.some(p=>!finite(p.x)||!finite(p.y)||Math.abs(p.x)>1e9||Math.abs(p.y)>1e9))fail('range','The extended axis is too large to render safely.');
    const clones=[],usedKeys=new Set([...d.svg.querySelectorAll('[data-key]')].map(n=>n.getAttribute('data-key'))),existing=d.ticks.map(t=>d.intercept+d.slope*t.position);
    let candidates=0;
    for(const family of d.families){
      const start=Math.ceil((lo-d.origin)/d.step-family.phase-1e-7),end=Math.floor((hi-d.origin)/d.step-family.phase+1e-7);
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end-start>LIMIT)fail('density','This extension would create too many ticks.');
      for(let i=start;i<=end;i++){
        if(++candidates>LIMIT)fail('density','This extension would create too many ticks.');
        const value=d.origin+(i+family.phase)*d.step;if(existing.some(v=>Math.abs(v-value)<=tolerance))continue;
        const position=(value-d.intercept)/d.slope,template=family.template,delta=position-template.position,copy=template.node.cloneNode(true),parentMatrix=matrix(template.node.parentElement,d.svg,G),ownMatrix=G.multiply(G.inverse(parentMatrix),matrix(template.node,d.svg,G)),shift={...I,e:d.u.x*delta,f:d.u.y*delta},action=G.multiply(G.multiply(G.multiply(G.inverse(parentMatrix),shift),parentMatrix),ownMatrix);
        const descendants=[copy,...copy.querySelectorAll('*')],text=family.labelled?copy.querySelector('text'):null;
        for(const definition of copy.querySelectorAll('defs'))definition.remove();
        let index=0;for(const node of descendants){if(node!==copy&&!copy.contains(node))continue;node.removeAttribute('id');node.removeAttribute('class');node.removeAttribute('data-key');node.removeAttribute('clip-path');node.removeAttribute('data-role');const key=generatedKey(d.key,formatted(d.invert(value)),index++);if(usedKeys.has(key))fail('keys','Generated axis tick keys are ambiguous.');usedKeys.add(key);node.setAttribute('data-key',key);}
        copy.setAttribute('transform',matrixText(action));copy.setAttribute('data-axis-generated',d.key);copy.setAttribute('data-axis-value',String(d.invert(value)));
        // Preserve the recognized tick structure through SVG export/import,
        // whose sanitizer deliberately discards internal data-* attributes.
        copy.id=d.group.id+'-'+d.axis+'tick_'+copy.getAttribute('data-key').slice(1);
        if(text){text.textContent=formatted(d.invert(value));text.setAttribute('data-role','ticks');}
        clones.push(copy);
      }
    }
    const midpointDelta=(positions[0]+positions[1]-d.length)/2,titles=d.titles.map(text=>{
      const parent=matrix(text.parentElement,d.svg,G),own=G.multiply(G.inverse(parent),matrix(text,d.svg,G));return {text,transform:matrixText(G.multiply(G.multiply(G.multiply(G.inverse(parent),{...I,e:d.u.x*midpointDelta,f:d.u.y*midpointDelta}),parent),own))};
    });
    const remove=d.ticks.filter(t=>t.node.hasAttribute('data-axis-generated')&&(d.intercept+d.slope*t.position<lo-tolerance||d.intercept+d.slope*t.position>hi+tolerance)).map(t=>t.node);
    return {d,record:r,localPoints,clones,titles,remove};
  }
  function writePlan(plan){
    const {d,localPoints:p,clones,titles,remove}=plan;if(d.spine.localName==='line'){for(const [name,value]of Object.entries({x1:p[0].x,y1:p[0].y,x2:p[1].x,y2:p[1].y}))d.spine.setAttribute(name,value);}else d.spine.setAttribute('d',`M ${p[0].x} ${p[0].y} L ${p[1].x} ${p[1].y}`);
    d.spine.setAttribute('data-axis-base-range',JSON.stringify(d.base));for(const node of remove)node.remove();for(const copy of clones)d.group.append(copy);for(const title of titles)title.text.setAttribute('transform',title.transform);
  }
  function apply(svg,edits,unit=1,options={}){
    if(!finite(unit)||unit<=0||!edits||typeof edits!=='object'||Array.isArray(edits))fail('record','Axis extension edits are invalid.');
    const plans=[],skipped=[];for(const [key,props]of Object.entries(edits)){if(!props||!Object.prototype.hasOwnProperty.call(props,'axis-extension'))continue;const record=validate(props['axis-extension']);try{const d=details(svg,key,options);plans.push(buildPlan(d,record));}catch(error){if(!String(error.code||'').startsWith('axis-'))throw error;skipped.push({key,reason:error.code,message:error.message});}}
    if(new Set(plans.map(p=>p.d.group)).size!==plans.length)fail('source','One axis has conflicting extension records.');
    const keys=new Set();for(const plan of plans)for(const copy of plan.clones)for(const node of [copy,...copy.querySelectorAll('[data-key]')]){const key=node.getAttribute('data-key');if(keys.has(key))fail('keys','Generated axis tick keys are ambiguous.');keys.add(key);}
    // Planning and all numerical validation finish before the first SVG write.
    let generated=0;for(const plan of plans){writePlan(plan);generated+=plan.clones.length;}
    if(skipped.length)svg.setAttribute('data-axis-extension-warning',skipped.map(item=>item.message).join(' '));
    return {changed:plans.length,generated,...(skipped.length?{skipped}:{})};
  }
  function capture(svg,key,options={}){
    const source=svg.cloneNode(true);if(options.ignoreContentTransform)source.querySelector('[data-panel-content]')?.removeAttribute('transform');
    const d=details(source,key,options),info=inspect(source,key,options),originalGroup=d.group.cloneNode(true),originalSpine=d.spine.cloneNode(true),groupKey=d.group.getAttribute('data-key');
    const targetNodes=target=>{const spine=[...target.querySelectorAll('[data-key]')].find(n=>n.getAttribute('data-key')===key),group=[...target.querySelectorAll('g')].find(n=>groupKey?n.getAttribute('data-key')===groupKey:n.id===d.group.id);if(!spine||!group)fail('source','The selected axis changed during resizing.');return {spine,group};};
    const replace=(target,spineSource,groupSource)=>{const {spine,group}=targetNodes(target);for(const name of ['d','x1','y1','x2','y2','data-axis-base-range']){const value=spineSource.getAttribute(name);if(value===null)spine.removeAttribute(name);else spine.setAttribute(name,value);}group.replaceChildren(...[...groupSource.childNodes].map(n=>n.cloneNode(true)));};
    let pending=null;
    return {info,planResize:(action,unit=1)=>{const record=planResize(source,key,action,{...options,unit});pending=buildPlan(d,record);return record;},preview(target,record){
      // Only the axis subtree is cloned per pointer frame. Matrix/scale
      // recognition is captured once, and the live spine keeps its identity.
      const value=validate(record),plan=pending&&JSON.stringify(pending.record)===JSON.stringify(value)?pending:buildPlan(d,value),group=originalGroup.cloneNode(true),spine=originalSpine.cloneNode(true),lookup=key=>[...group.querySelectorAll('[data-key]')].find(n=>n.getAttribute('data-key')===key),local={...plan,clones:plan.clones.map(n=>n.cloneNode(true)),d:{...d,spine,group},titles:plan.titles.map(t=>({text:lookup(t.text.getAttribute('data-key')),transform:t.transform})),remove:plan.remove.map(n=>lookup(n.getAttribute('data-key'))).filter(Boolean)};
      if(local.titles.some(t=>!t.text))fail('source','The axis title is missing an editable key.');writePlan(local);replace(target,spine,group);
    },restore(target){replace(target,originalSpine,originalGroup);}};
  }
  return {inspect,planResize,apply,capture,validate,limits:{maxTicks:LIMIT}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioAxisEditing;
