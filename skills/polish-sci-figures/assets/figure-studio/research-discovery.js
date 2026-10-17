/* Shared deterministic scientific rules: browser and CLI execute this exact file.
 * No network, randomness, inference of experimental independence, or submitted code. */
'use strict';
const ResearchDiscovery=(()=>{
 const VERSION='1.0.0';
 const field=(value,source='unknown')=>({value,source});
 const empty=v=>v===null||v===undefined||String(v).trim()==='';
 const numeric=v=>!empty(v)&&Number.isFinite(Number(v));
 const aliases={group:['group','condition','组别','分组'],unit:['unit','subject_id','sample_id','patient_id','对象'],value:['value','response','测量值'],before:['before','pre','术前'],after:['after','post','术后'],time:['time','day','时间'],experiment:['experiment','实验'],x:['x','dose'],y:['y'],feature:['feature','gene'],log2fc:['log2fc','log2FC'],adjusted_p:['adjusted_p','padj','fdr'],mean:['mean','均值'],sd:['sd','SD'],n:['n','N'],outcome:['outcome','truth'],score:['score','prediction'],sample:['sample'],category:['category'],row:['row'],column:['column']};
 function validateInput(rows){
  if(!Array.isArray(rows)||rows.length<2||rows.length>10001||!Array.isArray(rows[0])||!rows[0].length||rows[0].length>100)throw Error('Expected header and 1–10000 rows / 需要列名和 1–10000 行数据');
  const h=rows[0];if(h.some(x=>typeof x!=='string'||!x.trim()||x.length>1000)||new Set(h).size!==h.length||rows.some(r=>!Array.isArray(r)||r.length!==h.length||r.some(v=>v!==null&&!['string','number'].includes(typeof v)||String(v??'').length>1000)))throw Error('Invalid rectangular table / 列名须唯一且表格完整');
 }
 function profile(rows,declarations={}){
  validateInput(rows);const h=rows[0],body=rows.slice(1),columns=Object.create(null),roles={},sources={};
  for(const [i,name]of h.entries()){
   const values=body.map(r=>r[i]),valid=values.filter(v=>!empty(v)),numbers=valid.filter(numeric).map(Number);
   columns[name]={type:valid.length&&numbers.length===valid.length?'numeric':'categorical',missing:values.length-valid.length,unique:new Set(valid.map(String)).size,
    ...(numbers.length===valid.length&&valid.length?{min:Math.min(...numbers),max:Math.max(...numbers)}:{})};
  }
  for(const [role,names]of Object.entries(aliases)){
   const declared=declarations.roles?.[role];const matches=h.filter(n=>names.some(a=>a.toLowerCase()===n.toLowerCase()));
   roles[role]=declared?(h.includes(declared)?declared:null):matches.length===1?matches[0]:null;
   sources[role]=roles[role]?declared?'declared':'inferred_unverified':'unknown';
  }
  const get=(r,k)=>r[h.indexOf(roles[k])],groups=Object.create(null);
  if(roles.group)for(const r of body){if(empty(get(r,'group')))continue;const name=String(get(r,'group'));groups[name]||={observations:0,valid:0,units:new Set()};groups[name].observations++;if(roles.value&&numeric(get(r,'value')))groups[name].valid++;if(roles.unit&&!empty(get(r,'unit')))groups[name].units.add(String(get(r,'unit')));}
  const counts=Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{observations:v.observations,valid:v.valid,distinct_ids:v.units.size}]));
  const unitValues=roles.unit?body.map(r=>get(r,'unit')).filter(v=>!empty(v)).map(String):[];
  const answer=(key)=>field(declarations[key]??null,empty(declarations[key])?'unknown':'declared');
  const confirmations=[];
  if(declarations.data_level==='raw'&&!declarations.design)confirmations.push('design');
  if(!declarations.data_level)confirmations.push('data_level');
  if(declarations.data_level==='raw'&&!declarations.unit_confirmed)confirmations.push('unit_confirmed');
  if(declarations.data_level==='raw'&&!declarations.outcome_type)confirmations.push('outcome_type');
  if(declarations.data_level==='raw'&&!declarations.technical_replicates)confirmations.push('technical_replicates');
  if(declarations.data_level==='raw'&&!declarations.nesting)confirmations.push('nesting');
  return {schema_version:VERSION,research_question:answer('research_question'),sample_type:answer('sample_type'),assay:answer('assay'),outcome_label:answer('outcome_label'),measurement_unit:answer('measurement_unit'),outcome_type:answer('outcome_type'),data_level:answer('data_level'),
   design:answer('design'),group_structure:field(Object.keys(groups),'observed'),sample_size_by_group:field(counts,'observed'),unit_id:field(roles.unit,sources.unit),
   pairing:field(['paired','repeated'].includes(declarations.design)?declarations.design:declarations.design==='independent'?'independent':null,['paired','repeated','independent'].includes(declarations.design)?'declared':'unknown'),
   time_or_dose:field(roles.time,sources.time),technical_replicates:answer('technical_replicates'),nesting:answer('nesting'),declared_methods:answer('declared_methods'),
   columns:Object.fromEntries(Object.entries(columns)),roles,role_sources:sources,rows:body.length,duplicate_id_count:field(unitValues.length-new Set(unitValues).size,'observed'),missingness:field(Object.fromEntries(Object.entries(columns).map(([k,v])=>[k,v.missing])),'observed'),confirmation_needed:confirmations};
 }
 function prepare(rows,p,entry,d){
  let fields=entry.required,body=rows.slice(1);const h=rows[0],get=(r,k)=>r[h.indexOf(p.roles[k])];
  // Paired long input is pivoted by the explicitly confirmed unit and contrast order.
  if(entry.kind==='paired'&&(!p.roles.before||!p.roles.after)&&p.roles.group&&p.roles.value&&p.roles.unit){
   const order=d.pair_order;if(!Array.isArray(order)||order.length!==2||order[0]===order[1])return {error:'pair_order'};
   const pairs=new Map();for(const r of body){const id=get(r,'unit'),g=String(get(r,'group'));if(empty(id)||!order.includes(g))return {error:'pair_cells'};if(!pairs.has(id))pairs.set(id,Object.create(null));const pair=pairs.get(id);if(Object.hasOwn(pair,g))return {error:'duplicate_cells'};pair[g]=get(r,'value');}
   if([...pairs.values()].some(v=>order.some(g=>empty(v[g]))))return {error:'incomplete_pairs'};
   return {rows:[fields,...[...pairs].map(([id,v])=>fields.map(k=>String(k==='unit'?id:k==='before'?v[order[0]]:v[order[1]])))]};
  }
  if(fields.some(k=>!p.roles[k]))return {error:'columns',missing:fields.filter(k=>!p.roles[k])};
  return {rows:[fields,...body.map(r=>fields.map(k=>String(get(r,k)??'')))]};
 }
 function discover({rows,declarations={},goal='auto',limit=6},registry){
  const p=profile(rows,declarations),d=declarations,candidates=[],excluded=[];
  const purposes=[['uncertainty',/不确定|置信|uncertainty|confidence/i],['effect',/效应|差值|变化量|effect|difference/i],['distribution',/分布|distribution/i],['relationship',/相关|关联|correlat|association/i],['longitudinal',/轨迹|趋势|随时间|trajector|trend|over time/i]];
  const inferred=purposes.find(([,pattern])=>pattern.test(String(d.research_question||'')))?.[0];
  const effectiveGoal=goal==='auto'?(inferred||'overview'):goal;
  p.research_purpose=field(effectiveGoal,goal==='auto'?(inferred?'inferred_unverified':'unknown'):'declared');
  for(const entry of registry.charts){
   const reasons=[];const need=(test,code)=>{if(!test)reasons.push(code);};
   need(d.data_level===entry.data_level,'data_level');
   if(entry.designs.length)need(entry.designs.includes(d.design),'design');
   if(entry.data_level==='raw'){need(d.unit_confirmed===true,'unit_confirmed');need(d.outcome_type===entry.outcome_type,'outcome_type');}
   if(entry.kind==='technical')need(d.technical_replicates==='yes','technical_replicates');
   else if(entry.data_level==='raw')need(d.technical_replicates==='no','technical_replicates');
   if(d.nesting&&d.nesting!=='none')need(entry.kind==='technical'&&d.nesting==='experiment','nesting');
   if(entry.data_level==='raw')need(!!d.nesting,'nesting');
   const data=prepare(rows,p,entry,d);if(data.error)reasons.push(data.error);
   const mapped=entry.kind==='paired'&&(!p.roles.before||!p.roles.after)?['unit','group','value']:entry.required;
   const assigned=mapped.map(k=>p.roles[k]).filter(Boolean);need(new Set(assigned).size===assigned.length,'multiple_roles');
   if(!data.error){
    const h=data.rows[0],b=data.rows.slice(1),col=k=>b.map(r=>r[h.indexOf(k)]),keys=cols=>b.map(r=>JSON.stringify(cols.map(k=>r[h.indexOf(k)])));
    for(const k of fieldsOf(entry,'numeric'))need(col(k).every(numeric),'numeric');
    need(b.every(r=>r.every(v=>!empty(v))),'missing_values');
    need(entry.required.filter(k=>!entry.numeric.includes(k)).every(k=>col(k).every(v=>String(v).length<=48)),'label_length');
    if(entry.unique?.length){const key=keys(entry.unique);need(new Set(key).size===key.length,'duplicate_cells');}
    if(entry.kind==='independent'){
     need(new Set(col('unit')).size===b.length,'repeated_units');
     const groups=[...new Set(col('group'))];need(groups.length>=2&&groups.length<=6,'group_count');
     if(entry.chart_id==='estimation_graphic')need(groups.length===2,'two_groups');
     for(const g of groups.slice(0,6)){const vals=b.filter(r=>r[h.indexOf('group')]===g).map(r=>Number(r[h.indexOf('value')]));need(vals.length>=entry.minimum_n,'sample_size');if(entry.density)need(new Set(vals).size>=3,'constant_values');}
    }
    if(entry.kind==='paired')need(b.length>=3&&b.length<=36,'sample_size');
    if(entry.kind==='technical'){
     const groups=[...new Set(col('group'))];need(groups.length<=6&&new Set(col('experiment')).size<=6,'group_count');
     for(const g of groups.slice(0,6))need(new Set(b.filter(r=>r[h.indexOf('group')]===g).map(r=>r[h.indexOf('experiment')])).size>=2,'sample_size');
    }
    if(entry.kind==='longitudinal'){
     const units=[...new Set(col('unit'))];need(units.length<=36&&new Set(col('group')).size<=4,'sample_size');
     const starts=[];for(const u of units.slice(0,36)){const sub=b.filter(r=>r[h.indexOf('unit')]===u);need(new Set(sub.map(r=>r[h.indexOf('group')])).size===1,'unit_changes_group');need(new Set(sub.map(r=>r[h.indexOf('time')])).size>=2,'time_points');starts.push(Math.min(...sub.map(r=>Number(r[h.indexOf('time')]))));}
     if(entry.chart_id==='time_baseline_change')need(new Set(starts).size===1,'common_baseline');
    }
    if(entry.kind==='relationship')need(b.length>=(entry.chart_id==='relation_regression_ci'?6:3)&&new Set(col('x')).size>=3,'sample_size');
    if(entry.kind==='summary'){need(b.length<=12,'group_count');need(col('sd').every(v=>numeric(v)&&+v>=0)&&col('n').every(v=>numeric(v)&&+v>=2&&Number.isInteger(+v)),'summary_values');}
    if(entry.kind==='omics'){need(col('adjusted_p').every(v=>numeric(v)&&+v>0&&+v<=1),'adjusted_p');need(numeric(d.effect_threshold)&&+d.effect_threshold>=0&&numeric(d.p_threshold)&&+d.p_threshold>0&&+d.p_threshold<1,'thresholds');}
    if(entry.kind==='roc'){need(d.positive_class!==undefined&&!empty(d.positive_class)&&col('outcome').includes(String(d.positive_class)),'positive_class');need(new Set(col('outcome')).size===2,'binary_labels');need(new Set(col('score')).size>1,'constant_scores');}
   }
   if(reasons.length){excluded.push({chart_id:entry.chart_id,status:'prerequisites_unmet',reasons:[...new Set(reasons)],missing:data.missing||[]});continue;}
   const score=entry.priority+(entry.goals.includes(effectiveGoal)?12:0);
   const params={...(entry.renderer.parameters||{view:entry.chart_id})};if(entry.kind==='roc')params.positive=String(d.positive_class);if(entry.kind==='omics'){params.effect_threshold=+d.effect_threshold;params.p_threshold=+d.p_threshold;}
   const recipe={family:entry.renderer.family,font:'Arial',...entry.renderer.recipe,parameters:params};if(recipe.design==='independent')recipe.order=[...new Set(data.rows.slice(1).map(r=>r[data.rows[0].indexOf('group')]))];
   candidates.push({chart_id:entry.chart_id,kind:entry.kind,semantic_view:entry.semantic_view,score,reason:entry.question,limitation:entry.limitation,estimand:entry.estimand,renderer_status:'local_contract_ready',required_confirmations:[],
    rendering:{recipe,rows:data.rows},trace:{registry_version:registry.version,rules_version:VERSION,gates:'passed',research_purpose:p.research_purpose,role_sources:p.role_sources}});
  }
  candidates.sort((a,b)=>b.score-a.score||a.chart_id.localeCompare(b.chart_id));const seen=new Set();
  const shortlist=candidates.filter(c=>{if(seen.has(c.semantic_view))return false;seen.add(c.semantic_view);return true;}).slice(0,Math.max(1,Math.min(6,Number(limit)||6)));
  return {schema_version:VERSION,registry_version:registry.version,profile:p,status:shortlist.length?'ready':'waiting_confirmation',candidates:shortlist,other_eligible:candidates.filter(c=>!shortlist.includes(c)),excluded,network_requests:0};
 }
 function fieldsOf(e,key){return e[key]||[];}
 function publicQueryAllowed(text,rows=[],privateLabels=[]){
  const normalized=String(text).normalize('NFKC').toLowerCase();
  const terms=[...privateLabels,...rows.flat()].filter(v=>!empty(v)).map(v=>String(v).normalize('NFKC').toLowerCase());
  return !terms.some(value=>{if(/[\u3400-\u9fff]/.test(value)&&value.length>=2)return normalized.includes(value);if(value.length<3&&!numeric(value))return false;const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return new RegExp('(?:^|[^\\p{L}\\p{N}_])'+escaped+'(?:$|[^\\p{L}\\p{N}_])','u').test(normalized);});
 }
 return {VERSION,profile,discover,validateInput,publicQueryAllowed};
})();
if(typeof module!=='undefined')module.exports=ResearchDiscovery;
