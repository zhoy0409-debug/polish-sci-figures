/* Local, revision-checked operations. No arbitrary JSON patches or source replacement. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioProjectOperations=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SCHEMA='figure-studio-operations/1',INSPECTION='figure-studio-inspection/1',KEY_SCHEME='studio-sanitized-svg-keys/1'; // Bump if sanitizer/key semantics change.
  const STYLE=new Set(['fill','stroke','opacity','font-family','font-size','font-weight','font-style','stroke-width','text-anchor']);
  const clone=value=>JSON.parse(JSON.stringify(value));
  function switchable(panel,from,to){const a=panel?.variants?.[from],b=panel?.variants?.[to];return !!(panel?.provenance==='upstream-bundle'&&panel.table?.rows&&panel.analysis&&panel.recipe&&a&&b&&!['gallery','roc'].includes(panel.recipe.family)&&(a.size||'original')===(b.size||'original')&&a.width===b.width&&a.height===b.height&&canonical(a.viewBox)===canonical(b.viewBox));}
  function canonical(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(v=>canonical(v===undefined?null:v)).join(',')+']';return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';}
  async function digest(value){const crypto=globalThis.crypto||require('node:crypto').webcrypto;return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  const fail=message=>{throw Error(message);};
  function checkPayload(payload){if(!payload?.project||payload.project.schema!=='figure-studio/1'||!Array.isArray(payload.project.panels)||!Array.isArray(payload.state?.order)||!/^[a-f0-9]{20}$/.test(payload.project.id||'')||new Set(payload.project.panels.map(p=>p?.id)).size!==payload.project.panels.length||payload.project.panels.some(p=>!/^panel-\d+$/.test(p?.id||'')||!Array.isArray(p.variants)||!p.variants.length))fail('不支持的工程合同');}
  async function revision(payload,id){const p=payload.project.panels.find(p=>p.id===id),s=payload.state;if(!p||!s.order.includes(id))fail('目标小图不存在');const derived={},prefixes=p.variants.filter(v=>v.sha256).map(v=>v.sha256+'@');for(const field of ['statisticalRenders','heatmapRenders','layoutRenders'])derived[field]=Object.fromEntries(Object.entries(payload.project[field]||{}).filter(([key])=>key.startsWith(id+'/')||field==='layoutRenders'&&prefixes.some(prefix=>key.startsWith(prefix))));return digest({keyScheme:KEY_SCHEME,panel:p,state:s.panels[id],draft:payload.dataDrafts?.[id]||null,derived,layout:{columns:s.columns,gap:s.gap,gapX:s.gapX,gapY:s.gapY,cell:s.grid?.places?.[id],rows:s.grid?.rows,widths:s.grid?.widths,heights:s.grid?.heights,orderIndex:s.grid?undefined:s.order.indexOf(id),typography:s.typography,exportSettings:s.exportSettings,masterFrame:s.masterFrame,compactWhitespace:s.compactWhitespace}});}
  async function inspect(payload,{elements={},selection=null}={}){checkPayload(payload);return {schema:INSPECTION,keyScheme:KEY_SCHEME,projectId:payload.project.id,title:payload.project.title,capabilities:{operations:['element.style','panel.label.style','panel.candidate'],styleProperties:[...STYLE],styleUnits:'SVG local units; text finalSizePt / pointFactor describe the current physical output. Do not guess missing factors.',sourceReplacement:false,arbitraryPatch:false,chartRedraw:'仅切换同一已绑定数据包内、相同画布的现成候选；需要重算的图型请使用既有智能选图／数据工作台',network:false},selection,panels:await Promise.all(payload.state.order.map(async id=>{const p=payload.project.panels.find(p=>p.id===id),s=payload.state.panels[id];return {id,name:p.name,revision:await revision(payload,id),variant:s.variant,locked:!!s.locked,hasBoundData:!!p.table?.rows&&!!p.analysis,variants:p.variants.map((v,index)=>({index,name:v.name,size:v.size,localSwitch:switchable(p,s.variant,index)})),label:s.label?{...s.label}:null,elements:elements[id]||[]};})),privacy:'本地文件可能包含研究文字；检查清单默认不导出测量表或原图。'};}
  function exactKeys(obj,allowed){if(!obj||typeof obj!=='object'||Array.isArray(obj)||Object.keys(obj).some(k=>!allowed.includes(k)))fail('操作包含不支持的字段');}
  async function preflight(payload,patch,host){
    checkPayload(payload);exactKeys(patch,['schema','projectId','base','operations','reason']);if(patch.schema!==SCHEMA||patch.projectId!==payload.project.id)fail('操作协议或工程身份不匹配');
    if(patch.reason!==undefined&&(typeof patch.reason!=='string'||patch.reason.length>2000))fail('操作说明须为不超过 2000 字符的文本');
    if(!Array.isArray(patch.operations)||patch.operations.length<1||patch.operations.length>500)fail('操作数量须为 1–500');
    const affected=new Set(patch.operations.map(op=>op?.panel));exactKeys(patch.base,[...affected]);for(const id of affected){if(typeof patch.base?.[id]!=='string'||patch.base[id]!==await revision(payload,id))fail('目标小图已变化；请重新导出检查清单，避免覆盖人工修改。');}
    const next=clone(payload.state),changes=[];let requiresScientificReview=false;
    for(const op of patch.operations){
      exactKeys(op,['type','panel','variant','key','style']);const s=next.panels[op.panel];if(!s||s.locked)fail('目标小图已锁定或不存在');
      if(op.type==='panel.candidate'){
        if(op.style!==undefined||op.key!==undefined||!Number.isInteger(op.variant)||!switchable(payload.project.panels.find(p=>p.id===op.panel),s.variant,op.variant))fail('候选须来自同一已绑定数据包、相同画布；重算图型请使用现有工作台。');
        if(payload.dataDrafts?.[op.panel]||Object.values(s.lockedElements||{}).some(keys=>keys.length)||s.layoutLock)fail('请先完成数据更新或解除目标小图内的锁定，再切换候选。');
        if(typeof patch.reason!=='string'||!patch.reason.trim()||patch.reason.length>2000)fail('候选切换须说明科学适用性和展示重点；不能只按显著性选择。');
        changes.push({panel:op.panel,type:op.type,from:s.variant,to:op.variant,reason:patch.reason});s.variant=op.variant;requiresScientificReview=true;continue;
      }
      if(!['element.style','panel.label.style'].includes(op.type))fail('暂不支持此操作；不会覆盖工程或重新推断分析。');
      exactKeys(op.style,[...STYLE]);const entries=Object.entries(op.style);if(!entries.length)fail('样式修改不能为空');for(const [key,value]of entries)if(!STYLE.has(key)||!host.validValue(key,value))fail('样式值无效');
      if(op.type==='element.style'){
        if(!Number.isInteger(op.variant)||op.variant!==s.variant||!/^e\d+$/.test(op.key||''))fail('元素版本或标识不匹配');
        // The host must resolve against the same sanitizer and live editable source.
        if(!host.resolveElement)fail('此运行环境不能解析元素；请在编辑器中预检此操作文件。');
        const el=host.resolveElement(op.panel,op.variant,op.key);if(!el||el.locked||(s.lockedElements?.[op.variant]||[]).includes(op.key))fail('目标元素不存在或已锁定');
        if(entries.some(([key])=>key.startsWith('font-')||key==='text-anchor')&&!el.text)fail('文字样式只能应用到文字');
        if(!el.text&&entries.some(([key])=>['fill','stroke','opacity','stroke-width'].includes(key)))requiresScientificReview=true;
        s.edits[op.variant]||={};s.edits[op.variant][op.key]={...(s.edits[op.variant][op.key]||{}),...clone(op.style)};
      }else{
        if(op.key!==undefined||op.variant!==undefined||!s.label||s.label.locked||Object.keys(op.style).some(k=>!['fill','font-family','font-size','font-weight','font-style'].includes(k)))fail('图号样式无效或图号已锁定');
        const map={fill:'color','font-family':'font','font-size':'size','font-weight':'bold','font-style':'fontStyle'};for(const [key,value]of entries)s.label[map[key]]=key==='font-size'?+value:key==='font-weight'?value==='700':value;
      }
      changes.push({panel:op.panel,type:op.type,key:op.key||'label',style:clone(op.style)});
    }
    host.validateState(next,payload.project);
    // Payload, source arrays, history, checkpoints and data drafts are never mutated.
    return {next,changes,affected:[...affected],scope:requiresScientificReview?'scientific-review-required':'cosmetic-only',requiresReview:true,requiresScientificReview};
  }
  return {SCHEMA,INSPECTION,KEY_SCHEME,STYLE:Object.freeze([...STYLE]),canonical,digest,revision,inspect,preflight};
});
