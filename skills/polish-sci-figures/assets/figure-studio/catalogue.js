/* Eligibility comes from a successfully computed bundle, not names guessed from a screenshot. */
'use strict';
const StudioCatalogue=(()=>{
 const categories={distribution:['raincloud_horizontal','sina_points','ridgeline','group_ecdf','quantile_intervals','raw_points_estimate_ci','box_raw_points','violin_raw_points','raincloud','bar_raw_points','ecdf','complementary_ecdf'],paired:['paired_trajectories','paired_estimation','paired_difference'],effects:['estimation_graphic','group_estimate_forest','forest_intervals','forest_reference_linked','feature_lollipop','feature_interval_rank'],relationship:['relationship_regression','relationship_joint_distribution','embedding_groups','embedding_centroids'],longitudinal:['timecourse_trajectories','timecourse_change_from_baseline','aligned_series','standardized_overlay','kaplan_meier','kaplan_meier_risk_table','swimmer','swimmer_duration','dose_response','dose_response_residuals'],matrix:['matrix_heatmap','matrix_bubble','composition_stacked','composition_heatmap','confusion_counts','confusion_row_normalized'],omics:['volcano','volcano_ranked_hits','enrichment_bubble','enrichment_lollipop','diverging_bars','diverging_lollipop']};
 const labels={distribution:['分布与组间比较','Distributions & groups'],paired:['配对与变化','Paired data & changes'],effects:['效应与不确定性','Effects & uncertainty'],relationship:['关联与嵌入','Relationships & embeddings'],longitudinal:['时间、剂量与生存','Time, dose & survival'],matrix:['矩阵与组成','Matrices & composition'],omics:['组学与排序','Omics & rankings'],roc:['ROC 与分类评估','ROC & classification'],other:['其他素材','Other artwork']};
 function category(name){if(typeof StudioGalleryContracts!=='undefined'&&StudioGalleryContracts[name])return StudioGalleryContracts[name].category;if(name==='roc'||name==='precision_recall'||name.startsWith('roc_'))return 'roc';return Object.keys(categories).find(k=>categories[k].includes(name))||'other';}
 function rank(panel,goal='overview'){
   const order={overview:['compare_strip_median','compare_box_points','compare_mean_ci','compare_raincloud','compare_violin_box','raw_points_estimate_ci','paired_estimation','roc','relationship_regression','forest_intervals','kaplan_meier_risk_table','matrix_heatmap','timecourse_trajectories'],distribution:['compare_ecdf','compare_box_points','compare_raincloud','compare_violin_box','compare_density','group_ecdf','raincloud_horizontal','ecdf','raincloud','box_raw_points','violin_raw_points','relationship_joint_distribution'],effect:['compare_gardner_altman','compare_cumming','compare_mean_ci','compare_paired_change','estimation_graphic','paired_estimation','group_estimate_forest','forest_intervals','roc_auc_intervals'],threshold:['roc_two_graph','roc_threshold_color','roc_threshold_labels','roc_low_fpr','roc_confusion','complementary_ecdf'],uncertainty:['compare_mean_ci','compare_gardner_altman','compare_cumming','compare_uncertainty','roc_pointwise_band','roc_bootstrap_curves','roc_auc_intervals','estimation_graphic','raw_points_estimate_ci','paired_estimation','forest_intervals']}[goal]||[];
   const seen=new Set();return panel.variants.map((v,i)=>({v,i})).filter(({v})=>{if(seen.has(v.name))return false;seen.add(v.name);return true;}).map(item=>{let score=order.includes(item.v.name)?100-order.indexOf(item.v.name)*3:35;
    const n=panel.table?.rows?.length-1;if(n&&n<20&&['violin_raw_points','raincloud'].includes(item.v.name))score-=20;
    const groupColumn=panel.table?.rows?.[0]?.indexOf('group');if(groupColumn>=0){const counts={};for(const row of panel.table.rows.slice(1))counts[row[groupColumn]]=(counts[row[groupColumn]]||0)+1;if(Math.min(...Object.values(counts))<10&&['compare_raincloud','compare_violin','compare_violin_box','compare_density'].includes(item.v.name))score-=35;}
    if(panel.analysis?.family==='roc'&&Object.keys(panel.analysis.metrics||{}).length>3&&item.v.name==='roc_facets')score+=50;
    if(item.v.name==='precision_recall'&&Object.values(panel.analysis?.metrics||{}).some(m=>m.prevalence<.15))score+=50;
    if(['dose_response_residuals','roc_youden','roc_confusion'].includes(item.v.name)&&goal==='overview')score-=15;
    return {...item,score};}).sort((a,b)=>b.score-a.score||a.i-b.i);
 }
 function schematic(name){
   // Conceptual layouts only; these cards never carry an Apply action or measured values.
   const axes='<path d="M35 20V160H250" fill="none" stroke="#77808c" stroke-width="1"/>',diag='<path d="M35 160L245 25" fill="none" stroke="#bbc1ca" stroke-dasharray="3 3"/>',curve='M35 160 L45 112 L62 88 L88 62 L124 44 L176 30 L245 25';
   const line=(d,c='#536eaa',extra='')=>`<path d="${d}" fill="none" stroke="${c}" stroke-width="2" ${extra}/>`;
   let drawing='';
   if(name==='roc_requires_sroc'){drawing=[ [95,72,12],[110,62,15],[135,57,9],[155,42,13],[164,59,10] ].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}" fill="#c88178" fill-opacity=".4"/>`).join('')+line('M75 102Q125 36 185 30','#333');}
   else if(name==='roc_requires_smooth')drawing=line('M35 160 Q40 35 245 25','#bd756c');
   else if(name==='roc_requires_partial')drawing='<path d="M35 160L45 112L62 88L78 71V160Z" fill="#c88178" opacity=".35"/>'+line(curve)+'<path d="M78 160V20" stroke="#89929d" stroke-dasharray="3 3"/>';
   else if(name==='roc_requires_cost')drawing=line(curve)+line('M35 116L183 20','#bd756c','stroke-dasharray="4 3"')+'<circle cx="88" cy="62" r="4" fill="#bd756c"/>';
   else if(name==='roc_requires_bands')drawing='<path d="M35 160L45 98L62 72L88 48L124 34L245 25L124 57L88 78L62 108L45 139Z" fill="#536eaa" opacity=".2"/>'+line(curve);
   else if(name==='roc_requires_subgroups')drawing=line(curve)+line('M35 160L62 130L88 103L124 76L176 45L245 25','#bd756c');
   else if(name.startsWith('roc_'))drawing=line(curve)+line('M35 160L54 124L83 92L122 67L174 41L245 25','#bd756c')+line('M35 160L68 142L98 114L144 82L189 51L245 25','#81a79a',name==='roc_requires_cv'?'stroke-dasharray="3 2"':'');
   else return '';
   return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 190">${axes}${diag}${drawing}<text x="140" y="181" text-anchor="middle" font-size="9" fill="#77808c">Illustrative layout</text></svg>`;
 }
 categories.matrix=categories.matrix.map(n=>n==='matrix_bubble'?'matrix_dotmap':n);
 return {rank,category,labels,schematic,names:[...Object.values(categories).flat(),'roc','precision_recall']};
})();
if(typeof module!=='undefined')module.exports=StudioCatalogue;
