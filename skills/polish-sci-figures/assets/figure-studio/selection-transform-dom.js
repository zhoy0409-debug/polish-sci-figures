/* Apply saved presentation transforms to a freshly rendered panel SVG.
 * Source assets, parentage, clipping and inherited styles remain unchanged. */
'use strict';
const StudioSelectionTransformDOM=(()=>{
  const NS='http://www.w3.org/2000/svg',I={a:1,b:0,c:0,d:1,e:0,f:0};
  const has=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
  const geometry=()=>typeof StudioImageInsets!=='undefined'?StudioImageInsets:typeof module!=='undefined'&&module.exports?require('./image-insets.js'):null;
  function fail(message){const error=new Error(message);error.code='object-transform';throw error;}
  function finiteMatrix(value){
    if(!value||['a','b','c','d','e','f'].some(key=>!Number.isFinite(value[key])||Math.abs(value[key])>1e12))fail('Object transform is outside the supported finite range.');
    return value;
  }
  function action(props,unit,api){
    let transform={...I};
    if(has(props,'object-transform')){
      let values;try{values=JSON.parse(props['object-transform']);}catch{fail('Object transform must contain six finite numbers.');}
      if(typeof props['object-transform']!=='string'||!Array.isArray(values)||values.length!==6||values.some(n=>!Number.isFinite(n)))fail('Object transform must contain six finite numbers.');
      transform=finiteMatrix(Object.fromEntries(['a','b','c','d','e','f'].map((key,index)=>[key,values[index]])));
      api.inverse(transform);
    }
    const offset=key=>{
      if(!has(props,key))return 0;
      const raw=props[key];if(typeof raw!=='string'||!raw.trim()||!Number.isFinite(Number(raw))||Math.abs(Number(raw))>14400)fail('Object offset is outside the supported finite range.');
      return Number(raw);
    };
    // unit converts physical pt to this panel SVG's user units. Translation is
    // applied LAST, so ordinary keyboard/pointer movement remains unscaled.
    return finiteMatrix({...transform,e:(transform.e+offset('offset-x'))*unit,f:(transform.f+offset('offset-y'))*unit});
  }
  function applyObjectTransforms(svg,edits,unit=1){
    const api=geometry();
    if(!svg||svg.namespaceURI!==NS||svg.localName!=='svg'||!api?.relativeMatrix)fail('Object transform geometry is unavailable.');
    if(!Number.isFinite(unit)||unit<=0||unit>1e12||!edits||typeof edits!=='object'||Array.isArray(edits))fail('Object transform parameters are invalid.');
    const indexed=new Map(),owners=new Map(),plans=[],skipped=[];
    for(const node of svg.querySelectorAll('[data-key]')){
      const key=node.getAttribute('data-key');if(!indexed.has(key))indexed.set(key,[]);indexed.get(key).push(node);
    }
    for(const node of svg.querySelectorAll('[data-scale-owner]')){
      const key=node.getAttribute('data-scale-owner');if(!owners.has(key))owners.set(key,[]);owners.get(key).push(node);
    }
    // Parse only an element's own transform on an unattached g. Using
    // relativeMatrix(element,parent) here would also include x/y/viewBox when
    // the selected element itself is a nested SVG, counting that viewport twice.
    const scratch=svg.ownerDocument.createElementNS(NS,'svg'),probe=svg.ownerDocument.createElementNS(NS,'g'),ownCache=new Map();scratch.append(probe);
    const ownMatrix=node=>{
      if(node.style?.getPropertyValue('transform')||node.style?.getPropertyValue('transform-origin'))fail('CSS object transforms are not supported.');
      const value=node.getAttribute('transform')||'';
      if(!value.trim())return {...I};
      if(!ownCache.has(value)){probe.setAttribute('transform',value);ownCache.set(value,api.relativeMatrix(probe,scratch));}
      return ownCache.get(value);
    };
    const identity=m=>m.a===1&&m.b===0&&m.c===0&&m.d===1&&m.e===0&&m.f===0;
    const planned=new Set();
    for(const [key,props]of Object.entries(edits)){
      if(!props||typeof props!=='object'||Array.isArray(props))fail('Object edit properties are invalid.');
      if(!['object-transform','offset-x','offset-y'].some(name=>has(props,name)))continue;
      if(!/^e\d+$/.test(key))fail('Object transform key is invalid.');
      const delta=action(props,unit,api);if(identity(delta))continue;
      const candidates=indexed.get(key)||[];
      if(candidates.length>1)fail('Object transform target is ambiguous.');
      const target=candidates[0];
      if(!target){skipped.push({key,reason:'missing'});continue;}
      if(target.localName==='tspan'){skipped.push({key,reason:'text-run'});continue;}
      if(target.closest('defs,clipPath,mask,pattern,symbol')){skipped.push({key,reason:'definition'});continue;}
      for(const node of [target,...(target.localName==='image'?owners.get(key)||[]:[])]){
        if(planned.has(node))fail('Object transform target has conflicting owners.');
        if(node.closest('defs,clipPath,mask,pattern,symbol'))continue;
        const parent=node.parentElement,parentMatrix=parent===svg?{...I}:api.relativeMatrix(parent,svg),own=ownMatrix(node);
        // Every plan uses the ORIGINAL parent matrix, before any writes. Thus
        // parent/child edits do not depend on object-key enumeration order.
        const result=finiteMatrix(api.multiply(api.multiply(api.multiply(api.inverse(parentMatrix),delta),parentMatrix),own));
        api.inverse(result);plans.push({node,result});planned.add(node);
      }
    }
    // No writes occur until every target and matrix has passed validation.
    for(const {node,result}of plans)node.setAttribute('transform','matrix('+['a','b','c','d','e','f'].map(key=>Object.is(result[key],-0)?0:result[key]).join(' ')+')');
    return {changed:plans.length,skipped};
  }
  return {applyObjectTransforms};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=StudioSelectionTransformDOM;
