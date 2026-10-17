"""Build the small reviewed discovery subset from authoritative existing contracts."""
from pathlib import Path
import json, sys
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
import gallery_registry as gallery

def build():
    entries=[]
    groups={
        'independent': ['compare_strip_median','compare_mean_ci','compare_box_points','compare_ecdf','compare_raincloud'],
        'paired':['compare_paired_lines','compare_paired_change','paired_dumbbell'],
        'technical':['superplot'],
        'longitudinal':['time_individual_paths','time_baseline_change','time_mean_replicates'],
        'relationship':['relation_scatter','relation_marginal_hist','relation_regression_ci'],
    }
    semantics={'compare_strip_median':'observations','compare_mean_ci':'mean_uncertainty','compare_box_points':'quartiles','compare_ecdf':'ecdf','compare_raincloud':'density',
               'compare_paired_lines':'paired_levels','compare_paired_change':'paired_changes','paired_dumbbell':'paired_levels',
               'time_individual_paths':'trajectories','time_baseline_change':'baseline_changes','time_mean_replicates':'group_time_means',
               'relation_scatter':'association','relation_marginal_hist':'joint_distribution','relation_regression_ci':'linear_estimate'}
    for kind,views in groups.items():
        for i,view in enumerate(views):
            zh,en,category,required,numeric=gallery.CONTRACTS[view]
            note_zh,note_en=gallery.NOTES[view]
            entries.append(dict(chart_id=view,names={'zh-CN':zh,'en':en},synonyms=[en],kind=kind,category=category,
                semantic_view=semantics.get(view,kind),data_level='raw',outcome_type='continuous',
                designs={'independent':['independent'],'paired':['paired'],'technical':['technical'],'longitudinal':['repeated'],'relationship':['independent']}[kind],
                required=required.split(),numeric=numeric.split(),unique={'paired':['unit'],'relationship':['unit'],'longitudinal':['unit','time']}.get(kind,[]),
                minimum_n=8 if view=='compare_raincloud' else 3,density=view=='compare_raincloud',
                question={'zh-CN':note_zh,'en':note_en},limitation={'zh-CN':note_zh,'en':note_en},
                estimand={'zh-CN':zh,'en':en},goals=['distribution'] if view in ['compare_box_points','compare_ecdf','compare_raincloud'] else ['overview'],
                priority=100-i*5,renderer={'family':'gallery'},supported_views=[view],
                source_contract=f'skills/make-sci-data-figures/scripts/{gallery.OWNERS[view].__name__}.py',last_review_version='1.0.0'))
    effect=dict(entries[0]);effect.update(chart_id='estimation_graphic',names={'zh-CN':'组间差值与不确定性','en':'Group difference and uncertainty'},semantic_view='effect_difference',goals=['effect','uncertainty'],priority=98,
        question={'zh-CN':'同时展示独立样本观测和组间均值差及 Bootstrap 95% CI。','en':'Show independent observations and the mean difference with a bootstrap 95% CI.'},
        limitation={'zh-CN':'调用已有独立组工作台；分析记录包含探索性检验，不自动添加显著性标注。','en':'Uses the existing independent-group workbench; exploratory tests are recorded without automatic significance labels.'},renderer={'family':'group-comparison','recipe':{'design':'independent','group':'group','value':'value','subject':'unit','scope':'exploratory','show_p_value':False}})
    entries.insert(1,effect)
    for view,kind,fields,numerics,level,designs,zh,en,params in [
        ('volcano','omics','feature log2fc adjusted_p','log2fc adjusted_p','results',[],'火山图','Volcano plot',{'feature':'feature','effect':'log2fc','adjusted_p':'adjusted_p'}),
        ('roc','roc','unit outcome score','score','raw',['independent'],'ROC 曲线','ROC curve',{'unit':'unit','outcome':'outcome','score':'score'}),
        ('summary_mean_sd','summary','group mean sd n','mean sd n','summary',[],'均值与标准差','Supplied mean and SD',None),
    ]:
        notes={'omics':('仅呈现已提供的 log₂ 倍数变化及校正 P 值；阈值须明确确认。','Displays supplied log₂ fold changes and adjusted P values; confirm thresholds.'),
               'roc':('需要真实标签、预测分数、阳性类别及每对象一条预测。','Requires observed labels, scores, positive class and one prediction per unit.'),
               'summary':('显示已提供的均值 ± SD 和 n；不是置信区间，不生成原始点。','Supplied means ± SD and n; not confidence intervals. No raw observations are generated.')}[kind]
        entries.append(dict(chart_id=view,names={'zh-CN':zh,'en':en},synonyms=[en],kind=kind,category=kind,semantic_view=kind,
            data_level=level,outcome_type='binary' if kind=='roc' else 'continuous',designs=designs,required=fields.split(),numeric=numerics.split(),unique=['unit'] if kind=='roc' else ['feature'] if kind=='omics' else ['group'],minimum_n=2,
            question=dict(zip(['zh-CN','en'],notes)),limitation=dict(zip(['zh-CN','en'],notes)),estimand={'zh-CN':zh,'en':en},goals=['overview'],priority=105,
            renderer={'family':view,'parameters':params} if params else {'family':'gallery'},supported_views=[view],source_contract='skills/make-sci-data-figures/scripts/advanced_template_workbench.py' if params else 'skills/make-sci-data-figures/scripts/gallery_discovery_summary.py',last_review_version='1.0.0'))
    for entry in entries:
        explanations={
          'compare_strip_median':('保留每一个观测值；中位数短线便于小样本组间比较。','Show every observation; a median marker supports small-sample comparisons.','不显示组间效应量或其置信区间。','Does not display a between-group effect or its confidence interval.'),
          'compare_mean_ci':('比较组均值及其估计不确定性。','Compare group means and estimation uncertainty.','t 分布 95% CI；小样本时应同时查看原始观测。','t-based 95% CIs; inspect individual observations alongside them, especially for small samples.'),
          'compare_box_points':('原始点与四分位数同时呈现，便于比较分布位置和离散程度。','Show observations with quartiles to compare location and spread.','样本少时四分位数不稳定；箱体不是均值置信区间。','Quartiles are unstable in small samples; boxes are not confidence intervals for means.'),
          'compare_ecdf':('直接比较低于任一阈值的观察比例，无需分箱或平滑。','Compare the observed proportion below any threshold without bins or smoothing.','小样本的阶梯较粗；不表示连续密度或生存概率。','Small samples produce coarse steps; this is neither a smooth density nor survival analysis.'),
          'compare_raincloud':('同时比较观测、四分位摘要与估计的分布形态。','Compare observations, quartile summaries and estimated distribution shape.','每组至少 8 个观测且有足够变化；平滑受带宽影响。','Requires at least eight sufficiently varying observations per group; smoothing depends on bandwidth.'),
          'compare_paired_lines':('连接同一对象的前后测量，保留变化方向与基线。','Connect each unit’s before/after measurements, retaining baseline and direction.','不完整或重复配对被阻止；线条交叉不是显著性证据。','Incomplete or duplicate pairs are blocked; crossed lines do not establish significance.'),
          'compare_paired_change':('同时查看配对水平和每个对象的变化量。','Inspect paired levels and each unit’s change.','需确认同单位前后值及比较顺序；不自动检验差异。','Confirm comparable measurement units and contrast order; no difference test is automatically performed.'),
          'superplot':('分开显示实验内测量与独立实验均值，保留真实重复层级。','Separate within-experiment measurements from experiment means, retaining replication levels.','技术重复不计作独立样本；该视图仅作描述，不拟合层级模型。','Technical replicates are not independent samples; this descriptive view does not fit a hierarchical model.'),
          'time_individual_paths':('按真实时间顺序连接同一对象，观察个体轨迹。','Connect the same units in numeric time order to inspect individual trajectories.','同一对象不能跨组或在同一时点重复记录；不做混合模型检验。','Units cannot change groups or duplicate a time point; no mixed-model inference is performed.'),
          'time_baseline_change':('比较每个对象相对共同基线时间的变化。','Compare each unit’s change from a common baseline time.','不显示绝对基线差异；每个对象必须具有共同基线。','Hides absolute baseline differences; every unit must have the common baseline.'),
          'time_mean_replicates':('同时保留每条个体轨迹和逐时点组均值。','Retain individual trajectories alongside group means at each time.','均值不能替代重复测量模型；不完整随访会改变逐时点组成。','Means do not replace a repeated-measures model; incomplete follow-up changes the composition at each time.'),
        }
        if entry['chart_id'] in explanations:
            zh,en,lzh,len_=explanations[entry['chart_id']];entry['question']={'zh-CN':zh,'en':en};entry['limitation']={'zh-CN':lzh,'en':len_}
        entry['advantages']=entry['question'];entry['information_loss']=entry['limitation']
        entry['extension_namespace']='core';entry['statistics_source']='existing-local-workbench' if entry['chart_id'] in {'estimation_graphic','roc'} else 'supplied-results-or-descriptive'
    return {'schema_version':'1.0.0','version':'1.0.0','charts':entries}

if __name__=='__main__':
    target=ROOT/'skills/polish-sci-figures/assets/figure-studio/chart-knowledge.json'
    target.write_text(json.dumps(build(),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Wrote reviewed discovery registry')
