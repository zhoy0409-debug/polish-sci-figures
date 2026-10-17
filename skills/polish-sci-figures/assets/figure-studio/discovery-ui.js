/* Figure Discovery controller. Existing renderer, sanitizer and install/undo are injected. */
'use strict';
const FigureDiscoveryUI=(()=>{
 const messages={design:['实验设计','Study design'],data_level:['数据层级','Data level'],unit_confirmed:['确认实验单位和字段','Confirm experimental unit and fields'],outcome_type:['结局类型','Outcome type'],technical_replicates:['是否有技术重复','Technical replicates'],nesting:['嵌套关系','Nesting'],columns:['缺少字段','Missing fields'],numeric:['数值字段须为有限数值','Numeric fields must be finite'],missing_values:['必需字段有缺失值；请先处理','Required values are missing; resolve first'],duplicate_cells:['同一对象有重复记录','Duplicate observation keys'],repeated_units:['对象 ID 重复，不能当独立样本','Repeated IDs cannot be treated as independent'],sample_size:['观测数或变化不足','Insufficient observations or variation'],constant_values:['组内数值变化不足','Insufficient within-group variation'],group_count:['组数超出图型范围','Group count outside supported range'],pair_order:['确认前后对比顺序','Confirm before/after contrast order'],pair_cells:['配对字段或组别不完整','Incomplete pairing fields'],incomplete_pairs:['存在不完整配对；请处理后重试','Incomplete pairs; resolve before plotting'],time_points:['每个对象至少两个时间点','At least two time points per unit'],unit_changes_group:['同一对象不能跨组','A unit cannot change groups'],common_baseline:['需要共同基线时间','Common baseline required'],summary_values:['SD ≥ 0，n 为至少 2 的整数','SD ≥ 0; integer n ≥ 2'],adjusted_p:['校正 P 值须在 (0, 1]','Adjusted P values must be in (0, 1]'],positive_class:['确认阳性类别','Confirm positive class'],binary_labels:['需两类真实标签','Two observed classes required'],constant_scores:['预测分数没有变化','Prediction scores are constant'],thresholds:['确认效应量和校正 P 值阈值','Confirm effect and adjusted-P thresholds']};
 function mount(host,api){
  const doc=host.ownerDocument,lang=()=>api.language()==='en'?'en':'zh-CN',t=(zh,en)=>lang()==='en'?en:zh;
  const el=(tag,text,cls)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const btn=(zh,en,fn)=>{const b=el('button',t(zh,en));b.type='button';b.onclick=fn;return b;};
  let rows=null,result=null,serial=0,assets=new Map(),literature=null,origin=null,controller=null,privateFilename='',runContext='';
  const title=el('h2',t('智能选图','Figure Discovery')),intro=el('p',t('从研究问题和数据出发，比较真正适用的呈现方式。原始数据留在本机。','Start with your question and data. Compare scientifically suitable views. Raw data stay on this device.'));
  const close=btn('返回编辑器','Back to editor',()=>host.close());const head=el('div',undefined,'dialog-head');head.append(title,close);host.append(head,intro);
  const upload=el('input');upload.type='file';upload.accept='.csv,.tsv,.xlsx';upload.id='discoveryFile';
  const paste=el('textarea');paste.rows=4;paste.id='discoveryData';paste.placeholder=t('拖入数据，或在这里粘贴带列名的 CSV / TSV','Drop data or paste CSV / TSV with headers');
  const use=btn('读取数据','Read data',()=>readText());use.id='discoveryRead';
  const current=btn('使用当前数据工作台','Use current workbench',()=>{const c=api.context();if(c.rows){rows=c.rows;origin=c.key;updateFields();}else status.textContent=t('当前没有数据表','No current data table');});
  const inputs=el('div',undefined,'discovery-inputs');inputs.append(upload,paste,use,current);host.append(inputs);
  const form=el('div',undefined,'discovery-form'),fields={},roles={},roleSection=el('details'),roleHeading=el('summary',t('核对字段映射（自动识别仅为推断）','Review column roles (automatic matches are unverified)'));roleSection.append(roleHeading);
  function input(key,zh,en,choices){const label=el('label',t(zh,en)),node=el(choices?'select':'input');node.id='discovery-'+key;if(choices)for(const [value,zhText,enText]of choices){const option=el('option',t(zhText,enText));option.value=value;node.append(option);}else node.maxLength=120;label.append(node);form.append(label);fields[key]=node;node.oninput=invalidate;return node;}
  input('research_question','研究目的（留在本机）','Research question (local only)');input('sample_type','样本类型','Sample type');input('assay','实验方法','Assay');
  input('outcome_label','结局名称（可选）','Outcome name (optional)');input('measurement_unit','测量单位（可选）','Measurement unit (optional)');
  input('data_level','这张表包含什么？','What does the table contain?',[['','待确认','Unknown'],['raw','逐个对象的测量','Individual measurements'],['summary','均值 / SD / n 汇总','Mean / SD / n summaries'],['results','已完成的分析结果','Supplied analysis results']]);
  input('design','这些观察之间是什么关系？','How are observations related?',[['','待确认','Unknown'],['independent','不同独立对象','Independent units'],['paired','同一对象前后','Paired before / after'],['repeated','同一对象多个时间点','Repeated over time'],['technical','独立实验内的技术重复','Technical replicates within experiments']]);
  input('outcome_type','测量或结局类型','Outcome type',[['','待确认','Unknown'],['continuous','连续数值','Continuous'],['binary','真实二分类标签','Binary observed labels'],['count','计数（不自动套用连续模型）','Counts (no automatic continuous model)']]);
  input('technical_replicates','有技术重复吗？','Are there technical replicates?',[['','待确认','Unknown'],['no','没有','No'],['yes','有，同一实验内重复测量','Yes, repeated within experiments']]);
  input('nesting','其他嵌套或批次关系','Other nesting or batch structure',[['','待确认','Unknown'],['none','无','None'],['experiment','按独立实验分层','Within independent experiments'],['other','其他层级（需专门模型）','Other hierarchy (specialist model)']]);
  input('pair_before','前测组标签（长表）','Before label (long table)');input('pair_after','后测组标签（长表）','After label (long table)');
  input('positive_class','ROC 阳性类别','ROC positive class');input('effect_threshold','火山图 |log₂FC| 阈值','Volcano |log₂FC| threshold');input('p_threshold','火山图校正 P 值阈值','Volcano adjusted P threshold');
  const confirmed=input('unit_confirmed','已核对：实验单位与字段映射正确','Reviewed: experimental unit and column roles are correct');confirmed.type='checkbox';
  const goal=input('goal','重点呈现什么？','What should the figure emphasize?',[['auto','依据研究目的（可修改）','From my question (editable)'],['overview','主要结果','Main finding'],['distribution','完整分布','Distribution'],['effect','效应量','Effect'],['uncertainty','不确定性','Uncertainty']]);
  host.append(form,roleSection);
  const summary=el('div',undefined,'discovery-summary');summary.id='discoverySummary';const status=el('p');status.id='discoveryStatus';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  const recommend=btn('寻找适合我的数据的方案','Find suitable views',run);recommend.className='primary';recommend.id='discoveryRun';
  const filter=el('select');filter.id='discoveryFilter';for(const [v,zh,en]of [['','全部科学家族','All scientific families'],['independent','独立组','Independent groups'],['paired','配对','Paired'],['technical','技术重复','Technical replicates'],['longitudinal','纵向','Longitudinal'],['relationship','关联','Association'],['omics','组学','Omics'],['roc','分类评估','Classification'],['summary','汇总','Summary']]){const o=el('option',t(zh,en));o.value=v;filter.append(o);}filter.onchange=()=>{for(const card of cards.children)card.hidden=!!filter.value&&card.dataset.kind!==filter.value;};
  const cards=el('div',undefined,'discovery-cards');cards.id='discoveryCards';const rejected=el('details'),rejectedTitle=el('summary',t('暂不适合的图型：查看原因','Unavailable views: see why'));rejected.append(rejectedTitle);
  const evidence=el('div');evidence.id='discoveryEvidence';host.append(summary,status,recommend,filter,cards,rejected,evidence);
  function syncVisibility(){const raw=fields.data_level.value==='raw',paired=raw&&fields.design.value==='paired';for(const key of ['design','outcome_type','technical_replicates','nesting','unit_confirmed'])fields[key].parentElement.hidden=!raw;for(const key of ['pair_before','pair_after'])fields[key].parentElement.hidden=!paired;fields.positive_class.parentElement.hidden=!raw||fields.outcome_type.value!=='binary';for(const key of ['effect_threshold','p_threshold'])fields[key].parentElement.hidden=fields.data_level.value!=='results';}
  function invalidate(){serial++;controller?.abort();controller=null;result=null;assets.clear();cards.replaceChildren();literature?.destroy();literature=null;if(fields.p_threshold)syncVisibility();status.textContent=t('数据或设计已更改，请重新推荐。','Data or design changed. Recompute recommendations.');}
  function declarations(){const d=Object.fromEntries(Object.entries(fields).filter(([k])=>k!=='goal').map(([k,v])=>[k,v.type==='checkbox'?v.checked:v.value]));d.roles=Object.fromEntries(Object.entries(roles).filter(([,v])=>v.value).map(([k,v])=>[k,v.value]));if(d.pair_before&&d.pair_after)d.pair_order=[d.pair_before,d.pair_after];return d;}
  function updateSummary(p){
   summary.replaceChildren(el('strong',t('数据概况 · 观察到的信息','Data overview · observed')));
   summary.append(el('p',`${p.rows} ${t('行','rows')} · ${Object.keys(p.columns).length} ${t('列','columns')} · ${t('重复 ID 记录','Repeated ID records')}: ${p.duplicate_id_count.value}`));
   for(const [g,c]of Object.entries(p.sample_size_by_group.value))summary.append(el('span',`${g}: ${t('有效观察','valid observations')} ${c.valid}, ${t('不同 ID','distinct IDs')} ${c.distinct_ids}  `));
   summary.append(el('p',t('这里的行数及不同 ID 数不自动等于生物学样本量。','Row counts and distinct IDs are not automatically biological sample sizes.')));
   summary.append(el('p',`${t('设计','Design')}: ${p.design.value||t('待确认','unknown')} · ${p.design.source} | ${t('结局','Outcome')}: ${p.outcome_type.value||t('待确认','unknown')} · ${p.outcome_type.source}`));
   if(p.outcome_label?.value||p.measurement_unit?.value)summary.append(el('p',[p.outcome_label?.value,p.measurement_unit?.value].filter(Boolean).join(' · ')));
   if(p.research_purpose)summary.append(el('p',`${t('呈现重点','Presentation focus')}: ${p.research_purpose.value} · ${p.research_purpose.source}`));
   const missing=Object.entries(p.missingness.value).filter(([,v])=>v);if(missing.length)summary.append(el('p',t('缺失：','Missing: ')+missing.map(([k,v])=>`${k} (${v})`).join(', ')));
   const cols=el('details'),heading=el('summary',t('字段类型、范围与来源','Column types, ranges and provenance'));cols.append(heading);
   for(const [name,c]of Object.entries(p.columns))cols.append(el('p',`${name} · ${c.type} · ${t('唯一值','unique')} ${c.unique}${c.min!==undefined?` · ${c.min}–${c.max}`:''}`));
   for(const [role,source]of Object.entries(p.role_sources))if(p.roles[role])cols.append(el('p',`${role} → ${p.roles[role]} · ${source}`));summary.append(cols);
   if(p.confirmation_needed.length)summary.append(el('p',t('等待确认：','Awaiting confirmation: ')+p.confirmation_needed.map(k=>(messages[k]||[k,k])[lang()==='en'?1:0]).join(' · ')));
  }
  function updateFields(){invalidate();confirmed.checked=false;const p=ResearchDiscovery.profile(rows);roleSection.replaceChildren(roleHeading);for(const [role,value]of Object.entries(p.roles)){const label=el('label',role),select=el('select');const none=el('option','—');none.value='';select.append(none);for(const name of rows[0]){const o=el('option',name);o.value=name;select.append(o);}select.value=value||'';select.onchange=()=>{confirmed.checked=false;invalidate();};roles[role]=select;label.append(select);roleSection.append(label);}updateSummary(p);status.textContent=t('请确认影响适用性的实验设计。','Confirm the design details that determine suitability.');}
  function readText(){try{rows=api.parse(paste.value);origin=null;updateFields();}catch{status.textContent=t('无法读取，请粘贴带唯一列名的 CSV / TSV。','Cannot read data. Paste CSV / TSV with unique headers.');}}
  upload.onchange=async()=>{const file=upload.files[0];if(!file)return;privateFilename=file.name;invalidate();const ticket=serial;if(file.size>2000000){status.textContent=t('文件上限 2 MB','File limit: 2 MB');return;}try{const data=/\.xlsx$/i.test(file.name)?await api.readWorkbook(file):api.parse(await file.text());if(serial!==ticket)return;rows=data;origin=null;paste.value='';updateFields();}catch{status.textContent=t('无法读取；可将工作表导出为 CSV 后导入。','Cannot read workbook. Export a sheet as CSV and import it.');}};
  paste.oninput=()=>{rows=null;origin=null;invalidate();};
  host.ondragover=e=>{e.preventDefault();};host.ondrop=e=>{e.preventDefault();if(e.dataTransfer.files.length){upload.files=e.dataTransfer.files;upload.onchange();}};
  function name(id){return api.registry.charts.find(c=>c.chart_id===id)?.names[lang()]||id;}
  async function run(){
   invalidate();if(!rows){status.textContent=t('请先读取一份数据。','Read a data table first.');return;}
   const ticket=serial,context=api.context();runContext=context.key;controller=new AbortController();
   try{result=ResearchDiscovery.discover({rows,declarations:declarations(),goal:goal.value},api.registry);updateSummary(result.profile);
    rejected.replaceChildren(rejectedTitle);for(const x of result.excluded)rejected.append(el('p',name(x.chart_id)+' · '+x.reasons.map(k=>(messages[k]||[k,k])[lang()==='en'?1:0]).join(' / ')+(x.missing.length?' · '+x.missing.join(', '):'')));
    status.textContent=result.candidates.length?t('正在用您的真实数据绘制预览…','Rendering previews with your actual data…'):t('暂时没有满足条件的方案；请查看待确认项及排除原因。','No eligible views yet. Review confirmations and exclusion reasons.');
    if(!result.candidates.length)return;
    for(const [i,c]of result.candidates.entries()){
     const card=el('article',undefined,'discovery-card');card.dataset.kind=c.kind;
     card.append(el('small',i===0?t('最推荐','Recommended'):t('可选替代','Alternative')),el('h3',name(c.chart_id)),el('p',c.reason[lang()]));
     const art=el('div',undefined,'discovery-art'),label=el('small',t('用户真实数据预览','Your actual data preview')),detail=el('p',c.limitation[lang()]);
     const apply=btn('应用到编辑器','Apply to editor',()=>{if(ticket!==serial||context.key!==api.context().key){invalidate();return;}const asset=assets.get(c.chart_id);if(!asset)return;asset.discovery={declarations:declarations(),sourceRows:rows,tableKey:asset.table?.sha256,trace:c.trace};try{api.apply(asset);host.close();}catch{status.textContent=t('无法应用，请检查目标是否锁定。','Cannot apply. Check whether the destination is locked.');}});apply.disabled=true;apply.className='primary discovery-apply';
     card.append(label,art,detail,apply);cards.append(card);
     try{const asset=await api.render(c,controller.signal);if(ticket!==serial)return;assets.set(c.chart_id,asset);const variant=asset.variants.find(v=>v.name===c.chart_id)||asset.variants[asset.initialVariant||0];art.append(api.preview(variant.svg));apply.disabled=false;c.renderer_status='rendered';}
     catch{if(ticket!==serial)return;c.renderer_status='contract_rejected';art.textContent=t('当前数据未通过绘图合同，或本地绘图服务不可用。','The renderer rejected this table, or the local engine is unavailable.');}
    }
    if(ticket!==serial)return;filter.onchange();const usable=result.candidates.filter(c=>c.renderer_status==='rendered');
    status.textContent=t(`已生成 ${usable.length} 个真实数据方案；应用后可撤销。`,`Generated ${usable.length} actual-data views. Applying can be undone.`);
    literature=StudioLiterature.mount(evidence,{getContext:()=>({views:usable.map(c=>c.chart_id),goal:goal.value,language:lang(),contextKey:String(ticket)}),validateTopic:text=>ResearchDiscovery.publicQueryAllowed(text,rows,[privateFilename,api.context().title]),onPreview:view=>cards.children[result.candidates.findIndex(c=>c.chart_id===view)]?.scrollIntoView({block:'center'})});
   }catch{if(ticket===serial)status.textContent=t('无法推荐，请检查数据及设计。','Cannot recommend. Check the data and design.');}
  }
  syncVisibility();const onClose=()=>{serial++;controller?.abort();literature?.destroy();};host.addEventListener('close',onClose);
  return {
   destroy(){onClose();host.removeEventListener('close',onClose);host.replaceChildren();},
   open(){
    origin=null;runContext='';const c=api.context();
    if(c.rows&&!['synthetic-template','blank-canvas','user-import'].includes(c.provenance)){
     rows=c.rows;origin=c.key;updateFields();
     if(c.declarations){
      for(const [k,v]of Object.entries(c.declarations))if(fields[k])fields[k].type==='checkbox'?fields[k].checked=v:fields[k].value=v;
      for(const [role,column]of Object.entries(c.declarations.roles||{}))if(roles[role]&&rows[0].includes(column))roles[role].value=column;
     }
     updateSummary(ResearchDiscovery.profile(rows,declarations()));
    }
    syncVisibility();host.showModal();
   },
   refresh(){if(host.open&&(origin&&api.context().key!==origin||runContext&&api.context().key!==runContext)){rows=null;runContext='';invalidate();}}
  };
 }
 return {mount};
})();
if(typeof module!=='undefined')module.exports=FigureDiscoveryUI;
