/* Plans bind existing results; they never create results or infer causal roles. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.StudioFigurePlanning=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const ROLES=Object.freeze(['overview','comparison','relationship','morphology','validation','other']);
  function plan(inspection,assignments){
    if(inspection?.schema!=='figure-studio-inspection/1'||!Array.isArray(inspection.panels)||!Array.isArray(assignments)||assignments.length!==inspection.panels.length)throw Error('请先导出当前工程检查清单并逐项确认已有结果。');
    const source=new Map(inspection.panels.map((p,index)=>[p.id,{...p,index}])),seen=new Set(),unconfirmed=[],results=[];
    for(const item of assignments){if(!source.has(item?.panel)||seen.has(item.panel)||!ROLES.includes(item.role)||typeof item.question!=='string'||item.question.length>500||typeof item.confirmed!=='boolean')throw Error('结果分配无效；每个已有小图只能出现一次。');seen.add(item.panel);const p=source.get(item.panel);if(!item.confirmed||!item.question.trim())unconfirmed.push(item.panel);results.push({...item,question:item.question.trim(),revision:p.revision,variant:p.variant,sourceIndex:p.index,hasBoundData:p.hasBoundData});}
    const ordered=[...results].sort((a,b)=>ROLES.indexOf(a.role)-ROLES.indexOf(b.role)||a.sourceIndex-b.sourceIndex),count=ordered.length;
    return {schema:'figure-studio-plan/1',projectId:inspection.projectId,ready:!unconfirmed.length,unconfirmed,results:ordered,order:ordered.map(r=>r.panel),suggestions:[{id:'balanced',name:'均衡',columns:Math.min(2,count)},{id:'portrait',name:'纵向',columns:1},...(count>2?[{id:'focus',name:'重点大图',columns:3}]:[])],notes:['顺序依据用户确认的展示角色；不是因果证据强度排序。','只使用当前工程中的真实小图；不补造 A–H 占位结果，不生成未完成的实验。','图像与外部分析记录仍需由研究者核对；没有数据绑定不等于结果无效。','应用仅调整组图布局；原标题、图例、统计数值和数据映射保留。']};
  }
  return {ROLES,plan};
});
