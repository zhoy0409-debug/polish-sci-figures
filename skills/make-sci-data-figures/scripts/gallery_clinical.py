"""Clinical and evidence-synthesis templates with explicit observations/result contracts."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from gallery_fonts import font_families, has_cjk
import textwrap
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator
from matplotlib.patches import Rectangle, Polygon, FancyBboxPatch
from scipy import stats
from figure_workbench import resolve_palette

CONTRACTS={};NOTES={};SOURCE_MAP={}
def add(source,key,zh,en,category,cols,nums,note,eng):
 CONTRACTS[key]=(zh,en,category,cols,nums);NOTES[key]=(note,eng);SOURCE_MAP[source]=key
kmnames=[('survival_steps','生存阶梯与删失标记','Survival steps and censoring'),('survival_intervals','生存曲线与点态区间','Survival with pointwise intervals'),('survival_risk_counts','生存曲线与风险人数','Survival and risk counts'),('survival_median','生存曲线与中位时间','Survival median'),('survival_events','累积事件概率','Cumulative event probability'),('survival_hazard','Nelson–Aalen 累积风险','Nelson–Aalen cumulative hazard'),('survival_loglog','生存双对数诊断','Log-minus-log survival')]
for i,(key,zh,en) in enumerate(kmnames,1):add(f'E{i:02}',key,zh,en,'longitudinal','unit group time event','time event','独立对象的右删失数据；event 为 0 或 1，时间同单位。无延迟入组；区间为 Greenwood 对数–对数点态 95% CI。','Independent right-censored observations; event is 0/1, common time unit, no delayed entry. Greenwood log-log pointwise 95% CI.')
add('E08','schoenfeld_results','Schoenfeld 残差诊断','Schoenfeld residual diagnostics','longitudinal','term time residual smooth','time residual smooth','提供已拟合 Cox 模型的缩放残差及平滑结果，不在绘图时重新拟合。','Supplied scaled Schoenfeld residuals and smooths from a fitted Cox model.')
add('E09','competing_incidence','竞争风险累积发生率','Competing-risk cumulative incidence','longitudinal','cause time estimate lower upper','time estimate lower upper','提供考虑竞争事件后的 CIF 与区间；不能用 1 − KM 代替。','Supply competing-risk CIF estimates and intervals; not 1 minus KM.')
for source,key,zh,en in [('E10','clinical_subgroup_forest','临床亚组效应图','Clinical subgroup effects'),('E11','coefficient_forest','回归系数区间图','Regression coefficient intervals'),('G01','meta_forest','Meta 研究与汇总效应','Meta study and pooled effects'),('G02','meta_subgroup_forest','分层 Meta 效应图','Subgroup meta effects'),('G03','meta_cumulative','累积 Meta 分析结果','Cumulative meta-analysis results'),('G04','meta_leave_one_out','留一法敏感性结果','Leave-one-out results')]:
 add(source,key,zh,en,'effects','label subgroup estimate lower upper weight role reference','estimate lower upper weight reference','提供已分析的效应、区间、权重及无效线。role 为 study 或 pooled；保留原分析尺度，不自动重算汇总。','Supply analyzed effects, intervals, weights and null reference. role: study or pooled; retain the analysis scale, no refitting.')
add('E12','calibration_results','分组校准与区间','Grouped calibration and intervals','roc','bin predicted observed lower upper n','predicted observed lower upper n','提供独立验证或已校正的分组预测概率、观察概率和区间。','Supplied validation or optimism-corrected bin predictions, observed probabilities and intervals.')
add('E13','decision_curve_results','决策曲线与参考策略','Decision curve and reference strategies','roc','model threshold net_benefit','threshold net_benefit','提供已计算的模型、全部干预、均不干预净获益结果；阈值须在 0 与 1 之间。','Supply computed model, treat-all and treat-none net benefit; thresholds must be between zero and one.')
add('E14','clinical_impact_results','临床影响曲线','Clinical impact curves','roc','threshold high_risk true_positive population','threshold high_risk true_positive population','提供每个阈值下高风险人数、真阳性人数及目标人群总数。','Supply high-risk counts, true-positive counts and population size at each threshold.')
add('E15','spline_effect_results','限制性立方样条效应','Restricted cubic spline effects','effects','x estimate lower upper reference','x estimate lower upper reference','提供拟合样条及区间；参考效应线与原模型尺度一致。','Supply fitted spline effects and intervals with the original reference scale.')
add('E16','response_waterfall','个体反应瀑布图','Individual-response waterfall','effects','unit group change','change','提供同一基线定义下的变化百分比；不自动添加临床疗效界值。','Supply percent changes under one baseline definition; no invented clinical cutoffs.')
add('E17','classification_counts','分类计数矩阵','Classification count matrix','roc','actual predicted count','count','真实与预测类别的非负整数计数。','Nonnegative integer counts of actual/predicted classes.')
for source,key,zh,en in [('G05','meta_funnel','效应–标准误漏斗图','Effect–SE funnel'),('G06','meta_contour_funnel','显著性区间漏斗图','Significance-contour funnel'),('G07','meta_radial','Galbraith 径向图','Galbraith radial plot'),('G08','meta_regression_results','Meta 回归结果气泡图','Meta-regression result bubbles')]:
 cols='study effect se pooled reference' if source!='G08' else 'study moderator effect weight fitted'
 nums='effect se pooled reference' if source!='G08' else 'moderator effect weight fitted'
 add(source,key,zh,en,'effects',cols,nums,'提供原模型效应和标准误／拟合结果。漏斗不对称不能单独证明发表偏倚。','Supply original effects and SEs/fits. Funnel asymmetry alone does not establish publication bias.')
for source,key,zh,en in [('G09','bias_risk_matrix','偏倚风险评估矩阵','Risk-of-bias assessment'),('G10','bias_risk_summary','偏倚风险比例汇总','Risk-of-bias proportions')]:add(source,key,zh,en,'effects','study domain judgement','','人工或既定工具的评估结果；judgement 为 low、some、high。','Assessment from an explicit tool/review; judgement is low, some or high.')
add('G11','study_flow','文献筛选流程','Study-selection flow','other','node label count x y parent','count x y','提供流程节点、计数、位置和父节点；该模板不替代完整 PRISMA 清单。','Supply nodes, counts, coordinates and parents; a diagram does not replace the full PRISMA checklist.')
add('G12','diagnostic_paired_forest','诊断研究成对森林图','Diagnostic paired forest','effects','study sensitivity se_lower se_upper specificity sp_lower sp_upper','sensitivity se_lower se_upper specificity sp_lower sp_upper','提供各研究灵敏度、特异度和区间；不由此自动拟合诊断 Meta 模型。','Supply study sensitivity, specificity and intervals; no diagnostic meta-model is fitted here.')
PRESERVE_ASPECT={'classification_counts','bias_risk_matrix','study_flow','survival_risk_counts','diagnostic_paired_forest'}
NOTES['meta_contour_funnel']=('需提供同一加性尺度下的效应、标准误、汇总效应和无效值；分区为相对于无效值的双侧正态近似 P 值范围，虚线以汇总效应为中心。比值效应请先提供其对数。','Supply effects, SE, pooled effect and null on one additive scale. Shading shows two-sided normal-approximation P ranges around the null; dashed limits centre on the pooled effect. Supply ratio effects on a log scale.')
NOTES['meta_radial']=('提供加性尺度的效应、标准误与汇总效应；径向坐标为效应/SE 与 1/SE，带宽为 ±1.96；比值效应应先取对数。','Additive-scale effects, SE and pooled effect; coordinates are effect/SE and 1/SE with a ±1.96 band; ratio effects require log transformation.')

def validate(data,view):
 if view not in CONTRACTS:raise ValueError('Unknown clinical template')
 fields=CONTRACTS[view][3].split();nums=CONTRACTS[view][4].split()
 if not set(fields)<=set(data):raise ValueError('Required columns: '+', '.join(fields))
 d=data.copy()
 if d.empty or d[fields].isna().any().any():raise ValueError('Required fields must be nonempty')
 for c in nums:
  d[c]=pd.to_numeric(d[c],errors='raise')
  if not np.isfinite(d[c]).all():raise ValueError('Numeric fields must be finite')
 for c in set(fields)-set(nums):
  d[c]=d[c].astype(str)
  if d[c].str.strip().eq('').any():raise ValueError('Labels must be nonempty')
 if view.startswith('survival_'):
  if d.unit.duplicated().any() or not d.event.isin([0,1]).all() or (d.time<0).any():raise ValueError('One nonnegative follow-up per independent unit; event 0/1')
 if {'lower','estimate','upper'}<=set(fields) and not ((d.lower<=d.estimate)&(d.estimate<=d.upper)).all():raise ValueError('Intervals must contain estimates')
 for c in ['count','weight','n','high_risk','true_positive','population']:
  if c in fields and (d[c]<0).any():raise ValueError(c+' must be nonnegative')
 if view=='competing_incidence':
  if ((d[['lower','estimate','upper']]<0)|(d[['lower','estimate','upper']]>1)).any().any():raise ValueError('CIF and intervals must be probabilities')
  if (d.time<0).any():raise ValueError('CIF follow-up times must be nonnegative')
  if any((g.sort_values('time').estimate.diff().dropna()<0).any() for _,g in d.groupby('cause')):raise ValueError('CIF must be nondecreasing')
  timeline=np.sort(d.time.unique());total=np.zeros(len(timeline))
  for _,q in d.groupby('cause'):
   q=q.sort_values('time');idx=np.searchsorted(q.time,timeline,side='right')-1;total+=np.where(idx>=0,q.estimate.to_numpy()[np.maximum(idx,0)],0)
  if (total>1+1e-9).any():raise ValueError('Competing-cause cumulative incidence sums must not exceed one')
 if view=='calibration_results' and (not ((d.lower<=d.observed)&(d.observed<=d.upper)).all() or ((d[['predicted','observed','lower','upper']]<0)|(d[['predicted','observed','lower','upper']]>1)).any().any()):raise ValueError('Calibration needs valid probability intervals')
 if 'threshold' in fields and not ((d.threshold>0)&(d.threshold<1)).all():raise ValueError('Thresholds must lie strictly between 0 and 1')
 if view=='clinical_impact_results' and not ((d.true_positive<=d.high_risk)&(d.high_risk<=d.population)&(d.population>0)).all():raise ValueError('Require true_positive <= high_risk <= population')
 if view=='classification_counts' and (not np.equal(d['count'],np.floor(d['count'])).all() or d.duplicated(['actual','predicted']).any()):raise ValueError('Integer counts and unique category pairs required')
 if 'se' in fields and (d.se<=0).any():raise ValueError('Positive standard errors required')
 if 'weight' in fields and d.weight.sum()<=0:raise ValueError('Weights must have a positive total')
 if view in {'meta_funnel','meta_contour_funnel','meta_radial','meta_regression_results','diagnostic_paired_forest'} and d.study.duplicated().any():raise ValueError('One result per study is required')
 if view in {'competing_incidence','schoenfeld_results','decision_curve_results'}:
  keys={'competing_incidence':['cause','time'],'schoenfeld_results':['term','time'],'decision_curve_results':['model','threshold']}[view]
  if d.duplicated(keys).any():raise ValueError('Duplicate result coordinates')
 if view in {'clinical_impact_results','calibration_results','spline_effect_results'}:
  key={'clinical_impact_results':'threshold','calibration_results':'bin','spline_effect_results':'x'}[view]
  if d[key].duplicated().any():raise ValueError('Duplicate result keys')
 if view=='response_waterfall' and d.unit.duplicated().any():raise ValueError('One response per subject is required')
 if view=='clinical_impact_results' and d.population.nunique()!=1:raise ValueError('Clinical-impact thresholds must refer to one fixed population')
 if view=='calibration_results' and ((d.n<=0).any() or not np.equal(d.n,np.floor(d.n)).all()):raise ValueError('Each calibration bin needs a positive integer sample count')
 if view=='clinical_impact_results' and not np.equal(d[['high_risk','true_positive','population']],np.floor(d[['high_risk','true_positive','population']])).all().all():raise ValueError('Clinical-impact counts must be integers')
 if view=='classification_counts' and len(set(d.actual)|set(d.predicted))>8:raise ValueError('Use at most eight classes per compact panel')
 if 'role' in fields and not set(d.role)<={'study','pooled'}:raise ValueError('role must be study or pooled')
 if 'reference' in fields and d.reference.nunique()!=1:raise ValueError('One declared reference scale required')
 if 'pooled' in fields and d.pooled.nunique()!=1:raise ValueError('One supplied pooled effect required')
 if view.startswith('bias_risk'):
  if not set(d.judgement)<={'low','some','high'} or d.duplicated(['study','domain']).any():raise ValueError('Unique study/domain with judgement low, some or high')
  if len(d)!=d.study.nunique()*d.domain.nunique():raise ValueError('Supply a complete study-by-domain assessment; missing judgements are not silently omitted')
 if view=='diagnostic_paired_forest':
  if not ((0<=d.se_lower)&(d.se_lower<=d.sensitivity)&(d.sensitivity<=d.se_upper)&(d.se_upper<=1)&(0<=d.sp_lower)&(d.sp_lower<=d.specificity)&(d.specificity<=d.sp_upper)&(d.sp_upper<=1)).all():raise ValueError('Valid sensitivity/specificity intervals required')
 if view=='study_flow':
  if d.node.duplicated().any() or not set(d.parent)-{'none'}<=set(d.node) or d[['x','y']].duplicated().any():raise ValueError('Unique nodes/positions and existing parent IDs required')
  if len(d)>12:raise ValueError('At most twelve flow nodes; split large workflows')
  if not np.equal(d['count'],np.floor(d['count'])).all():raise ValueError('Flow counts must be integers')
  parents=dict(zip(d.node,d.parent))
  for n in parents:
   seen=set()
   while n!='none':
    if n in seen:raise ValueError('Flow contains a cycle')
    seen.add(n);n=parents[n]
 for c,maxn in [('group',5),('cause',5),('term',4),('model',5),('domain',7),('study',18),('label',18)]:
  if c in fields and d[c].nunique()>maxn:raise ValueError('Split dense '+c+' values into panels')
 return d

def km(data):
 times=[0.];surv=[1.];low=[1.];high=[1.];haz=[0.];s=1.;g=0.;h=0.
 for t,q in data.groupby('time',sort=True):
  risk=(data.time>=t).sum();events=q.event.sum();s*=1-events/risk;h+=events/risk
  if events and risk>events:g+=events/(risk*(risk-events))
  if 0<s<1:
   se=np.sqrt(g)/abs(np.log(s));z=np.log(-np.log(s));l=np.exp(-np.exp(z+1.96*se));u=np.exp(-np.exp(z-1.96*se))
  else:l=u=s
  times.append(t);surv.append(s);low.append(l);high.append(u);haz.append(h)
 return tuple(np.array(v) for v in [times,surv,low,high,haz])

def clean(ax,x='',y=''):
 ax.spines[['top','right']].set_visible(False);ax.tick_params(labelsize=8,length=3,pad=4)
 ax.set_xlabel(x,fontsize=9,labelpad=7);ax.set_ylabel(y,fontsize=9,labelpad=7)
def wrap(s,width=16):return textwrap.fill(str(s),width=width,break_long_words=True)
def legend(ax):
 h,l=ax.get_legend_handles_labels();ax.legend(h,[wrap(v,18) for v in l],loc='lower left',bbox_to_anchor=(0,1.01),ncol=2,frameon=False,fontsize=8,borderaxespad=0)
def render(data,view,colors=None,figsize=(4.8,3.6)):
 d=validate(data,view);cs=colors or ['#466b96','#c35e71','#a6b6cc','#c4a052','#716e99']
 plt.rcParams.update({'svg.fonttype':'none','font.family':font_families(),'font.size':8,'axes.linewidth':.75,'figure.autolayout':False})
 fig,ax=plt.subplots(figsize=figsize);fig.subplots_adjust(left=.20,right=.95,bottom=.20,top=.82)
 if view.startswith('survival_'):
  if view=='survival_risk_counts':fig.delaxes(ax);grid=fig.add_gridspec(2,1,height_ratios=[3,1]);ax=fig.add_subplot(grid[0]);tab=fig.add_subplot(grid[1],sharex=ax);tab.spines[:].set_visible(False);tab.tick_params(bottom=False,labelbottom=False,left=False);tab.set_ylim(-.5,d.group.nunique()+.5)
  for i,(group,q) in enumerate(d.groupby('group',sort=False)):
   t,s,l,u,h=km(q);c=cs[i%len(cs)];y=h if view=='survival_hazard' else 1-s if view=='survival_events' else s
   if view=='survival_loglog':mask=(t>0)&(s>0)&(s<1);ax.plot(np.log(t[mask]),np.log(-np.log(s[mask])),color=c,label=group,lw=1.3);continue
   ax.step(t,y,where='post',color=c,label=group,lw=1.4,ls=['-','--',':','-.','-'][i])
   if view in {'survival_intervals','survival_risk_counts'}:ax.fill_between(t,l,u,step='post',color=c,alpha=.13,lw=0)
   if view=='survival_steps':
    cens=q[q.event==0].time.to_numpy();v=y[np.searchsorted(t,cens,side='right')-1];ax.plot(cens,v,'|',color=c,ms=5)
   if view=='survival_median' and (s<=.5).any():
    med=t[np.flatnonzero(s<=.5)[0]];ax.plot([med,med],[0,.5],color=c,ls=':',lw=.8);ax.annotate(f'{med:g}',(med,.5),xytext=(4,6+11*i),textcoords='offset points',fontsize=8,color=c)
  if view=='survival_risk_counts':
   ticks=MaxNLocator(4,integer=True).tick_values(0,d.time.max());ticks=ticks[ticks>=0];ax.set_xlim(0,ticks[-1]);ax.set_xticks(ticks);groups=list(d.groupby('group',sort=False));tab.set_yticks(range(len(groups)),[wrap(g,13) for g,_ in groups]);tab.invert_yaxis();tab.tick_params(axis='y',labelsize=8,pad=7)
   for r,(g,q) in enumerate(groups):
    for time in ticks:tab.text(time,r,str(int((q.time>=time).sum())),ha='center',va='center',fontsize=8,color=cs[r%len(cs)])
   tab.set_title('Number at risk',loc='left',fontsize=8,pad=7)
  if view!='survival_hazard' and view!='survival_loglog':ax.set_ylim(-.03,1.03)
  if view=='survival_median':ax.axhline(.5,color='#acb4bf',ls=':',lw=.7)
  clean(ax,'log(Time)' if view=='survival_loglog' else 'Time','log(−log S)' if view=='survival_loglog' else 'Cumulative hazard' if view=='survival_hazard' else 'Event probability' if view=='survival_events' else 'Survival probability');legend(ax)
 elif view=='schoenfeld_results':
  for i,(term,q) in enumerate(d.groupby('term',sort=False)):
   q=q.sort_values('time');ax.scatter(q.time,q.residual,s=12,color=cs[i],alpha=.35);ax.plot(q.time,q.smooth,color=cs[i],label=term,lw=1.3)
  ax.axhline(0,color='#aeb7c4',lw=.7,ls=':');clean(ax,'Time','Scaled Schoenfeld residual');legend(ax)
 elif view=='competing_incidence':
  for i,(group,q) in enumerate(d.groupby('cause',sort=False)):
   q=q.sort_values('time');ax.step(q.time,q.estimate,where='post',color=cs[i],label=group);ax.fill_between(q.time,q.lower,q.upper,step='post',color=cs[i],alpha=.12,lw=0)
  ax.set_ylim(0,1);clean(ax,'Time','Cumulative incidence');legend(ax)
 elif 'forest' in view or view in {'meta_cumulative','meta_leave_one_out'}:
  if view=='diagnostic_paired_forest':
   fig.delaxes(ax);axes=fig.subplots(1,2,sharey=True);fig.subplots_adjust(left=.25,right=.95,bottom=.20,top=.90,wspace=.25)
   for aa,field,lo,hi in zip(axes,['sensitivity','specificity'],['se_lower','sp_lower'],['se_upper','sp_upper']):
    aa.errorbar(d[field],np.arange(len(d)),xerr=[d[field]-d[lo],d[hi]-d[field]],fmt='o',ms=4,color=cs[0],capsize=2,lw=.9);aa.set_xlim(0,1);aa.set_xticks([0,.5,1]);aa.set_yticks(range(len(d)),[wrap(v,18) for v in d.study]);clean(aa,field.title())
   axes[0].invert_yaxis()
  else:
   fig.subplots_adjust(left=.32,right=.95);ref=d.reference.iloc[0];ax.axvline(ref,color='#adb8c6',ls=':',lw=.9)
   for i,r in enumerate(d.itertuples()):
    c=cs[list(dict.fromkeys(d.subgroup)).index(r.subgroup)%len(cs)];ax.plot([r.lower,r.upper],[i,i],color=c,lw=1)
    if r.role=='pooled':ax.add_patch(Polygon([[r.lower,i],[r.estimate,i-.2],[r.upper,i],[r.estimate,i+.2]],color=c,alpha=.8))
    else:ax.scatter(r.estimate,i,s=64*r.weight/d.weight.max(),marker='o' if view in {'meta_cumulative','meta_leave_one_out','coefficient_forest'} else 's',color=c,alpha=.85)
   ax.set_yticks(range(len(d)),[wrap(v,21) for v in d.label]);ax.invert_yaxis();clean(ax,'Effect with CI')
   strata=list(dict.fromkeys(d.subgroup))
   if len(strata)>1:
    handles=[Line2D([],[],marker='s',ls='',color=cs[j%len(cs)],markersize=5) for j in range(len(strata))];columns=1 if figsize[0]<5 and any(has_cjk(v) for v in strata) else min(2,len(strata));ax.legend(handles,[wrap(v,18) for v in strata],loc='lower left',bbox_to_anchor=(0,1.02),ncol=columns,frameon=False,fontsize=8)
 elif view=='calibration_results':
  ax.plot([0,1],[0,1],color='#aab5c5',ls=':',lw=.9);ax.errorbar(d.predicted,d.observed,yerr=[d.observed-d.lower,d.upper-d.observed],fmt='o-',color=cs[0],lw=1,ms=4,capsize=2);ax.set(xlim=(0,1),ylim=(0,1));clean(ax,'Predicted probability','Observed probability')
 elif view=='decision_curve_results':
  for i,(g,q) in enumerate(d.groupby('model',sort=False)):q=q.sort_values('threshold');ax.plot(q.threshold,q.net_benefit,label=g,color=cs[i],ls=['-','--',':','-.','-'][i],lw=1.4)
  clean(ax,'Threshold probability','Net benefit');legend(ax)
 elif view=='clinical_impact_results':
  q=d.sort_values('threshold');ax.plot(q.threshold,q.high_risk,color=cs[0],label='High risk');ax.plot(q.threshold,q.true_positive,color=cs[1],ls='--',label='True positives');clean(ax,'Threshold probability','People');legend(ax)
 elif view=='spline_effect_results':
  q=d.sort_values('x');ax.fill_between(q.x,q.lower,q.upper,color=cs[0],alpha=.15,lw=0);ax.plot(q.x,q.estimate,color=cs[0],lw=1.5);ax.axhline(q.reference.iloc[0],color='#adb8c6',ls=':',lw=.8);clean(ax,'Exposure','Effect (supplied interval)')
 elif view=='response_waterfall':
  q=d.sort_values('change',ascending=False);groups=list(dict.fromkeys(q.group));ax.bar(range(len(q)),q.change,color=[cs[groups.index(g)%len(cs)] for g in q.group],width=.8);ax.axhline(0,color='#526173',lw=.7);ax.set_xticks([]);clean(ax,'Individuals ordered by response','Change from baseline (%)')
  if len(groups)>1:ax.legend([Rectangle((0,0),1,1,color=cs[i%len(cs)]) for i in range(len(groups))],[wrap(g) for g in groups],loc='lower left',bbox_to_anchor=(0,1.02),ncol=2,frameon=False,fontsize=8)
 elif view=='classification_counts':
  labels=sorted(set(d.actual)|set(d.predicted));m=d.pivot(index='actual',columns='predicted',values='count').reindex(index=labels,columns=labels).fillna(0).to_numpy();from matplotlib.colors import LinearSegmentedColormap
  ax.pcolormesh(m,cmap=LinearSegmentedColormap.from_list('count',['#f0f3f8',cs[0]]),edgecolors='white',linewidth=1)
  for i in range(len(labels)):
   for j in range(len(labels)):ax.text(j+.5,i+.5,str(int(m[i,j])),ha='center',va='center',fontsize=9,color='white' if m[i,j]>.6*m.max() else '#344054')
  ax.set_xticks(np.arange(len(labels))+.5,[wrap(v,11) for v in labels]);ax.set_yticks(np.arange(len(labels))+.5,[wrap(v,11) for v in labels]);ax.invert_yaxis();ax.set_aspect('equal');clean(ax,'Predicted','Actual')
 elif view in {'meta_funnel','meta_contour_funnel','meta_radial'}:
  if view=='meta_radial':x=1/d.se;y=d.effect/d.se;ax.scatter(x,y,s=24,color=cs[0],alpha=.7);xx=np.linspace(0,x.max()*1.08,100);ax.plot(xx,d.pooled.iloc[0]*xx,color=cs[1]);ax.fill_between(xx,d.pooled.iloc[0]*xx-1.96,d.pooled.iloc[0]*xx+1.96,color=cs[0],alpha=.1);clean(ax,'1 / Standard error','Effect / Standard error')
  else:
   se=np.linspace(0,d.se.max()*1.1,150);pool=d.pooled.iloc[0];ref=d.reference.iloc[0]
   if view=='meta_contour_funnel':
    tones=['#F1F4F8','#D7E1EE','#A5BCD7','#6C8EB6'];low=min(d.effect.min(),ref-2.8*se.max(),pool-1.96*se.max());high=max(d.effect.max(),ref+2.8*se.max(),pool+1.96*se.max())
    ax.fill_betweenx(se,low,high,color=tones[3],lw=0)
    for z,tone in [(2.576,tones[2]),(1.96,tones[1]),(1.645,tones[0])]:ax.fill_betweenx(se,ref-z*se,ref+z*se,color=tone,lw=0)
    handles=[Rectangle((0,0),1,1,fc=color,ec='none') for color in tones]
    ax.legend(handles,[r'$P$ ≥ 0.10',r'0.05 ≤ $P$ < 0.10',r'0.01 ≤ $P$ < 0.05',r'$P$ < 0.01'],title='Two-sided P versus null',title_fontsize=8,fontsize=8,loc='lower left',bbox_to_anchor=(0,1.02),ncol=2,frameon=False,columnspacing=.7)
   ax.plot(pool-1.96*se,se,ls='--',color='#a7b2c1',lw=.8);ax.plot(pool+1.96*se,se,ls='--',color='#a7b2c1',lw=.8);ax.axvline(pool,color='#a7b2c1',ls=':',lw=.8);ax.scatter(d.effect,d.se,s=23,color=cs[0],alpha=.8);ax.invert_yaxis();clean(ax,'Effect','Standard error')
 elif view=='meta_regression_results':
  q=d.sort_values('moderator');ax.scatter(q.moderator,q.effect,s=140*q.weight/q.weight.max(),color=cs[0],alpha=.5,edgecolor='white',lw=.5);ax.plot(q.moderator,q.fitted,color=cs[1],lw=1.5);clean(ax,'Moderator','Effect')
 elif view.startswith('bias_risk'):
  groups=['low','some','high'];palette=['#527ca5','#cfb163','#bd6072'];domains=list(dict.fromkeys(d.domain));studies=list(dict.fromkeys(d.study));fig.subplots_adjust(left=.28,right=.95,bottom=.28,top=.78)
  if view=='bias_risk_matrix':
   for r,study in enumerate(studies):
    for c,domain in enumerate(domains):
     q=d[(d.study==study)&(d.domain==domain)]
     if len(q):j=groups.index(q.judgement.iloc[0]);ax.scatter(c,r,s=130,color=palette[j],lw=0);ax.text(c,r,['L','?','H'][j],ha='center',va='center',color='white',fontsize=8)
   ax.set_xticks(range(len(domains)),[wrap(v,12) for v in domains],rotation=35,ha='right');ax.set_yticks(range(len(studies)),[wrap(v,18) for v in studies]);ax.set_xlim(-.6,len(domains)-.4);ax.invert_yaxis();clean(ax)
   handles=[Line2D([],[],ls='',marker='o',color=palette[i],markersize=6) for i in range(3)];ax.legend(handles,['L: Low','?: Some concerns','H: High'],loc='lower left',bbox_to_anchor=(0,1.03),ncol=2,frameon=False,fontsize=8)
  else:
   for r,domain in enumerate(domains):
    q=d[d.domain==domain];start=0
    for j,g in enumerate(groups):v=(q.judgement==g).mean()*100;ax.barh(r,v,left=start,color=palette[j],label=g if r==0 else None,height=.65);start+=v
   ax.set_yticks(range(len(domains)),[wrap(v,18) for v in domains]);ax.set_xlim(0,100);ax.invert_yaxis();clean(ax,'Studies (%)');handles,_=ax.get_legend_handles_labels();ax.legend(handles,['Low','Some concerns','High'],loc='lower left',bbox_to_anchor=(0,1.03),ncol=2,frameon=False,fontsize=8)
 elif view=='study_flow':
  ax.axis('off');fig.subplots_adjust(left=.05,right=.95,bottom=.05,top=.95)
  dx=np.diff(np.sort(d.x.unique()));dy=np.diff(np.sort(d.y.unique()));dx=float(dx.min()) if len(dx) else 2.;dy=float(dy.min()) if len(dy) else 1.
  width=.76*dx;ax.set_xlim(d.x.min()-.55*dx,d.x.max()+.55*dx);ax.set_ylim(d.y.min()-.49*dy,d.y.max()+.49*dy);ax.invert_yaxis();fig.canvas.draw();box=ax.get_window_extent();px_x=box.width/np.ptp(ax.get_xlim());px_y=box.height/abs(np.ptp(ax.get_ylim()));chars=max(9,int(width*px_x/(8*fig.dpi/72*.53)));fontline=8*fig.dpi/72*1.2
  labels={r.node:wrap(r.label,chars)+f'\n{r.count:g}' for r in d.itertuples()};heights={n:max(.48*dy,(label.count('\n')+1)*fontline/px_y+.12*dy) for n,label in labels.items()}
  if max(heights.values())>.82*dy:raise ValueError('Flow text is too long at this panel size; shorten node labels or use a taller panel')
  nodes=d.set_index('node')
  for r in d.itertuples():
   if r.parent!='none':
    p=nodes.loc[r.parent];vx=r.x-p.x;vy=r.y-p.y;start=min(width/2/abs(vx) if vx else np.inf,heights[r.parent]/2/abs(vy) if vy else np.inf);end=min(width/2/abs(vx) if vx else np.inf,heights[r.node]/2/abs(vy) if vy else np.inf)
    ax.annotate('',xy=(r.x-end*vx,r.y-end*vy),xytext=(p.x+start*vx,p.y+start*vy),arrowprops={'arrowstyle':'->','color':'#8b99aa','lw':.9,'shrinkA':3,'shrinkB':3})
  for r in d.itertuples():
   height=heights[r.node];ax.add_patch(FancyBboxPatch((r.x-width/2,r.y-height/2),width,height,boxstyle='round,pad=0.015',facecolor='#f0f3f8',edgecolor='#a3b2c6',lw=.7));ax.text(r.x,r.y,labels[r.node],ha='center',va='center',fontsize=8,linespacing=1.2)
 if view!='study_flow':
  # Reflow labels and legends after the plot is complete; the requested physical
  # canvas size stays fixed rather than stretching a pre-existing image.
  fig.set_layout_engine('constrained');fig.get_layout_engine().set(w_pad=.065,h_pad=.06,wspace=.08,hspace=.08)
 return fig

def fixtures():
 rng=np.random.default_rng(918);out={};surv=pd.DataFrame([[f'S{i}', ['Control','Treatment'][i//35],float(rng.integers(1,30)),int(rng.random()>.3)] for i in range(70)],columns=['unit','group','time','event'])
 for k,_,_ in kmnames:out[k]=surv.copy()
 t=np.linspace(1,30,30);out['schoenfeld_results']=pd.DataFrame({'term':'Marker','time':t,'residual':rng.normal(0,.6,len(t)),'smooth':.06*np.sin(t/5)})
 out['competing_incidence']=pd.DataFrame([[g,x,y,max(0,y-.06),min(1,y+.06)] for j,g in enumerate(['Event A','Event B']) for x,y in zip(t,(.5-.2*j)*(1-np.exp(-t/15)))],columns=['cause','time','estimate','lower','upper'])
 for key in ['clinical_subgroup_forest','coefficient_forest','meta_forest','meta_subgroup_forest','meta_cumulative','meta_leave_one_out']:
  out[key]=pd.DataFrame([[f'Study {i+1}' if i<6 else 'Pooled','Stratum A' if i<3 else 'Stratum B',v,v-.2,v+.2,10+i,'study' if i<6 else 'pooled',0] for i,v in enumerate([.1,.4,.6,.3,.2,.5,.35])],columns=['label','subgroup','estimate','lower','upper','weight','role','reference'])
 p=np.linspace(.08,.88,8);obs=p*.85+.04;out['calibration_results']=pd.DataFrame({'bin':[f'Bin{i}' for i in range(8)],'predicted':p,'observed':obs,'lower':np.maximum(0,obs-.07),'upper':np.minimum(1,obs+.07),'n':40})
 p=np.linspace(.05,.45,30);out['decision_curve_results']=pd.DataFrame([[g,x,y] for g,yy in [('Model',.22-.2*p),('Treat all',.3-.7*p/(1-p)),('Treat none',0*p)] for x,y in zip(p,yy)],columns=['model','threshold','net_benefit'])
 out['clinical_impact_results']=pd.DataFrame({'threshold':p,'high_risk':np.round(900*(1-p)),'true_positive':np.round(280*(1-p*.7)),'population':1000})
 x=np.linspace(0,10,60);e=1+.04*(x-5)**2;out['spline_effect_results']=pd.DataFrame({'x':x,'estimate':e,'lower':e-.18,'upper':e+.18,'reference':1})
 out['response_waterfall']=pd.DataFrame({'unit':[f'S{i}' for i in range(30)],'group':['A']*30,'change':rng.uniform(-80,35,30)})
 out['classification_counts']=pd.DataFrame([['A','A',45],['A','B',5],['B','A',9],['B','B',41]],columns=['actual','predicted','count'])
 for k in ['meta_funnel','meta_contour_funnel','meta_radial']:out[k]=pd.DataFrame({'study':[f'S{i}' for i in range(12)],'effect':rng.normal(.3,.15,12),'se':rng.uniform(.08,.24,12),'pooled':.3,'reference':0})
 x=np.linspace(0,10,12);out['meta_regression_results']=pd.DataFrame({'study':[f'S{i}' for i in range(12)],'moderator':x,'effect':.1+.07*x+rng.normal(0,.1,12),'weight':rng.integers(10,40,12),'fitted':.1+.07*x})
 for k in ['bias_risk_matrix','bias_risk_summary']:out[k]=pd.DataFrame([[f'Study {i+1}',f'Domain {j+1}',rng.choice(['low','some','high'],p=[.65,.25,.1])] for i in range(6) for j in range(5)],columns=['study','domain','judgement'])
 out['study_flow']=pd.DataFrame([['n1','Records identified',500,0,0,'none'],['n2','Records screened',420,0,1,'n1'],['n3','Full texts assessed',70,0,2,'n2'],['n4','Studies included',18,0,3,'n3'],['n5','Excluded records',350,2,1,'n2'],['n6','Excluded full texts',52,2,2,'n3']],columns=['node','label','count','x','y','parent'])
 out['diagnostic_paired_forest']=pd.DataFrame([[f'Study {i+1}',.72+.025*i,.64+.025*i,.80+.025*i,.80+.01*i,.72+.01*i,.88+.01*i] for i in range(6)],columns=['study','sensitivity','se_lower','se_upper','specificity','sp_lower','sp_upper'])

 out['meta_cumulative']['label']=[f'First {i+1} studies' for i in range(7)]
 out['meta_cumulative']['role']='study'
 for i in range(7):
  out['meta_cumulative'].loc[i,'lower']=out['meta_cumulative'].loc[i,'estimate']-.5/(i+1)**.5
  out['meta_cumulative'].loc[i,'upper']=out['meta_cumulative'].loc[i,'estimate']+.5/(i+1)**.5
 out['meta_leave_one_out']['label']=[f'Omit study {i+1}' for i in range(6)]+['Full analysis']
 out['coefficient_forest']['label']=[f'Covariate {i+1}' for i in range(7)]
 out['coefficient_forest']['role']='study'
 out['clinical_subgroup_forest']['label']=[f'Subgroup {i+1}' for i in range(6)]+['Overall']
 return out

COMPATIBLE_GROUPS=[{k for k,_,_ in kmnames}, {'meta_funnel','meta_contour_funnel','meta_radial'}, {'bias_risk_matrix','bias_risk_summary'}]
