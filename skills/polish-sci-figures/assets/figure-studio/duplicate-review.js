/* Persisted review validation and source identity, independent of canvas layout. */
'use strict';
const StudioDuplicateReview = (() => {
  const raster = value => typeof value==='string' && /^data:image\/(?:png|jpe?g|webp|tiff?|bmp);base64,[a-z\d+/=\s]+$/i.test(value);
  const plain = value => !!value && typeof value==='object' && !Array.isArray(value);
  const text = (value,max) => typeof value==='string' && value.length<=max;
  const safeId = value => text(value,200) && !!value && !['__proto__','prototype','constructor'].includes(value);
  const checkedSources=new WeakSet(),checkedResults=new WeakSet();
  function validate(record, projectId) {
    const fail=()=>{throw Error('Invalid image review record');};
    if(!plain(record)||record.format!=='figure-studio-image-check-v2'||record.projectId!==projectId||!text(record.createdAt,50)||!text(record.updatedAt,50)||!['all','selected','files'].includes(record.scope))fail();
    const sources=record.sources,result=record.result;
    if(!Array.isArray(sources)||sources.length<2||sources.length>60||!plain(result))fail();
    const ids=new Set(sources.map(item=>item?.id));
    if(ids.size!==sources.length)fail();
    if(!checkedSources.has(sources)){
      let size=0;
      for(const source of sources){if(!plain(source)||!safeId(source.id)||!text(source.label,300)||!raster(source.data)||source.data.length>16000150)fail();size+=source.data.length;}
      if(size>40000000)fail();checkedSources.add(sources);
    }
    if(!Array.isArray(result.images)||result.images.length!==sources.length||!Array.isArray(result.matches)||result.matches.length>1770)fail();
    if(!checkedResults.has(result)){
      const resultIds=new Set();let previews=0,evidence=0,thumbs=0;
      for(const item of result.images){
        if(!plain(item)||!ids.has(item.id)||resultIds.has(item.id)||!text(item.label,300))fail();resultIds.add(item.id);
        for(const key of ['width','height','analysisWidth','analysisHeight'])if(!Number.isInteger(item[key])||item[key]<1||item[key]>30000)fail();
        for(const key of ['thumbnail','reviewPreview'])if(item[key]!=null&&!raster(item[key]))fail();
        previews+=(item.reviewPreview||'').length;thumbs+=(item.thumbnail||'').length;
      }
      const pairs=new Set();
      for(const pair of result.matches){
        if(!plain(pair)||!ids.has(pair.a)||!ids.has(pair.b)||pair.a===pair.b||!['exact','overlap','transformed'].includes(pair.kind))fail();
        const key=JSON.stringify([pair.a,pair.b].sort());if(pairs.has(key))fail();pairs.add(key);
        if(pair.evidence!=null&&!raster(pair.evidence))fail();evidence+=(pair.evidence||'').length;
        if(pair.transformAtoB!=null&&(!Array.isArray(pair.transformAtoB)||pair.transformAtoB.length!==2||pair.transformAtoB.some(row=>!Array.isArray(row)||row.length!==3||row.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9))))fail();
        for(const key of ['pointsA','pointsB'])if(pair[key]!=null&&(!Array.isArray(pair[key])||pair[key].length>80||pair[key].some(p=>!Array.isArray(p)||p.length!==2||p.some(n=>!Number.isFinite(n)||Math.abs(n)>30000))))fail();
      }
      if(previews>12000000||evidence>15000000||thumbs>12000000)fail();checkedResults.add(result);
    }
    if(!plain(record.refs)||Object.keys(record.refs).length>60||!plain(record.reviews))fail();
    for(const [id,ref]of Object.entries(record.refs))if(!ids.has(id)||!plain(ref)||ref.sourceId!==id||!/^panel-\d+$/.test(ref.panelId)||!/^e\d+$/.test(ref.key)||!Number.isInteger(ref.vi)||ref.vi<0||ref.vi>127)fail();
    const pairKeys=new Set(result.matches.map(pair=>JSON.stringify([pair.a,pair.b].sort())));
    for(const [key,review]of Object.entries(record.reviews))if(!pairKeys.has(key)||!plain(review)||!['pending','legitimate','replace'].includes(review.status)||!text(review.note,2000)||!text(review.updatedAt,50))fail();
    return record;
  }
  function resolve(refs, inventory) {
    if(!Array.isArray(refs)||!refs.length||!plain(inventory?.refs))return null;
    const live=Object.values(inventory.refs),resolved=[];
    for(const ref of refs){
      if(!raster(ref?.data))return null;
      const current=live.find(item=>item.panelId===ref.panelId&&item.key===ref.key&&item.data===ref.data);
      if(!current)return null;
      resolved.push({...current});
    }
    return resolved;
  }
  function bounds(rects){
    const valid=rects.filter(r=>[r.left,r.top,r.right,r.bottom].every(Number.isFinite)&&r.right>r.left&&r.bottom>r.top);
    if(!valid.length)return null;
    const left=Math.min(...valid.map(r=>r.left)),top=Math.min(...valid.map(r=>r.top)),right=Math.max(...valid.map(r=>r.right)),bottom=Math.max(...valid.map(r=>r.bottom));
    return {left,top,right,bottom,width:right-left,height:bottom-top};
  }
  return {validate,resolve,bounds};
})();
if(typeof module!=='undefined')module.exports=StudioDuplicateReview;
