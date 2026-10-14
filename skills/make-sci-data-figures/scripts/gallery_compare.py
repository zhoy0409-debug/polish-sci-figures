"""Original data-driven comparison and relationship templates.

The source gallery supplies chart concepts only. Statistical annotations and fitted
curves that depend on a study's analysis are explicit inputs, never guessed.
"""
import textwrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from gallery_fonts import font_families
from matplotlib.colors import LinearSegmentedColormap
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator, FuncFormatter
from scipy import stats
from gallery_marks import tag_color_source, tag_stat_group

PALETTE = ['#426B9D', '#C35E70', '#93A8C4', '#947DAB', '#A8864F', '#5F728A']
CONTRACTS = {}
NOTES = {}
COLUMN_LABELS = {
    'group':('组别','Group'),'unit':('独立对象编号','Independent subject ID'),
    'value':('测量值','Measurement'),'factor':('第二因素','Second factor'),
    'reference':('参照组','Reference group'),'p':('比较 P 值','Comparison P value'),
    'method':('统计方法','Statistical method'),'estimate':('差值估计','Difference estimate'),
    'low':('置信区间下限','Lower confidence limit'),'high':('置信区间上限','Upper confidence limit'),
    'before':('前测值','Before'),'after':('后测值','After'),'dose':('剂量','Dose'),
    'trend_p':('趋势 P 值','Trend P value'),'trend_method':('趋势分析方法','Trend method'),
    'x':('横轴测量值','X measurement'),'y':('纵轴测量值','Y measurement'),
    'role':('观测或拟合坐标','Observation or fitted coordinate'),'series':('模型名称','Model name'),
    'color_value':('颜色编码变量','Colour-encoded variable'),'size':('面积编码变量','Area-encoded variable'),
    'variable':('变量名称','Variable name'),'fitted':('模型拟合值','Model fitted value'),
    'residual':('模型残差','Model residual'),'leverage':('杠杆值','Leverage'),
    'standardized_residual':('标准化残差','Standardized residual'),'cooks_d':('Cook 距离','Cook distance'),
    'selected':('是否标注（0 或 1）','Label selection (0 or 1)'),
}

def _add(key, zh, en, category, required, numeric, note_zh, note_en):
    CONTRACTS[key] = (zh, en, category, required, numeric)
    NOTES[key] = (note_zh, note_en)

_group_note = ('独立观测长表：group 为组别、unit 为独立对象、value 为测量值；同一对象的重复测量应使用配对模板。',
               'Independent observations: group, unit (independent subject), value; use a paired template for repeated measurements.')
for key,zh,en in [
 ('compare_bar_sd','均值柱形与标准差','Mean bars with SD'),
 ('compare_bar_points','均值柱形、标准差与原始点','Mean bars, SD and observations'),
 ('compare_mean_sd','均值点与标准差','Mean points with SD'),
 ('compare_mean_ci','均值与 95% 置信区间','Mean with 95% confidence intervals'),
 ('compare_box','四分位箱线图','Quartile box plot'),
 ('compare_box_points','箱线图与原始点','Box plot with observations'),
 ('compare_notched_box','带中位数缺口的箱线图','Notched median box plot'),
 ('compare_violin','分布小提琴图','Distribution violin'),
 ('compare_violin_box','小提琴与内嵌箱线','Violin with inner box'),
 ('compare_swarm','蜂群与均值标准差','Beeswarm with mean and SD'),
 ('compare_strip_median','条带散点与中位数','Strip plot with median'),
 ('compare_raincloud','半小提琴、箱线与原始点','Raincloud with box and observations'),
 ('compare_log_points','对数尺度原始点与中位数','Log-scale observations and median'),
 ('compare_ridgeline','分组密度山脊图','Group density ridgelines'),
 ('compare_hist_facets','共同分箱的直方小多图','Histograms with common bins'),
 ('compare_density','分组密度曲线','Group density curves'),
 ('compare_ecdf','分组经验累积分布','Group empirical cumulative distributions'),
 ('compare_cleveland','排序均值点与置信区间','Ranked mean dots with confidence intervals')]:
    _add(key,zh,en,'distribution','group unit value','value',*_group_note)
NOTES['compare_mean_ci'] = ('独立对象的均值及基于 t 分布的 95% CI；需要近似正态的组内均值抽样分布。','Independent-subject means and t-based 95% CIs; requires an approximately normal sampling distribution of the mean.')
NOTES['compare_cleveland'] = NOTES['compare_mean_ci']
NOTES['compare_notched_box'] = ('缺口使用中位数 ± 1.57 IQR / √n 的近似区间；不能替代正式组间检验。','Notches use median ± 1.57 IQR / √n, an approximate interval; they do not replace a between-group test.')
for k in ['compare_violin','compare_violin_box','compare_raincloud','compare_density','compare_ridgeline']:
    NOTES[k] = ('每组至少 8 个非恒定独立观测；高斯核密度使用 Scott 带宽，保留原始量纲。','At least eight nonconstant independent observations per group; Gaussian KDE uses Scott bandwidth and preserves the original units.')
for key,zh,en in [('compare_bracket_stars','比较括号与显著性符号','Comparison brackets and significance symbols'),('compare_bracket_p','比较括号与精确 P 值','Comparison brackets and exact P values'),('compare_control_symbols','与参照组比较的组上标注','Above-group reference comparisons')]:
    _add(key,zh,en,'distribution','group unit value reference p method','value p',
         '输入已完成的比较结果：每组 reference、p、method 保持一致；P 值须已按研究方案完成多重比较校正。',
         'Supply completed comparisons; reference, p and method are constant within each group. P values must include study-required multiplicity adjustment.')
for key,zh,en in [('compare_gardner_altman','双组观测与效应区间','Two-group observations and effect interval'),('compare_cumming','多组观测与效应区间','Multi-group observations and effect intervals')]:
    _add(key,zh,en,'effect','group unit value reference estimate low high','value estimate low high',
         '提供原始观测及同单位的已计算组间差值和置信区间；各组相对于 reference，区间不由绘图程序重新推断。',
         'Supply observations plus calculated same-unit group differences and confidence intervals relative to reference; the renderer does not infer these intervals.')
for key,zh,en in [('compare_paired_lines','配对前后连线','Paired before-after trajectories'),('compare_paired_change','配对连线与个体差值','Paired trajectories and individual changes')]:
    _add(key,zh,en,'paired','unit before after','before after','每个对象一行，前后值单位相同；逐一保持配对关系。','One row per subject, same-unit before and after values; pairing is preserved.')
for key,zh,en in [('compare_interaction','双因素均值交互图','Two-factor mean interaction'),('compare_facet_boxes','按因素分面的箱线与原始点','Factor-faceted boxes and observations')]:
    _add(key,zh,en,'distribution','factor group unit value','value','双因素独立观测；交互图显示均值 ± SD，不由线条交叉推断交互显著性。','Independent two-factor observations; interaction traces show mean ± SD, and crossings do not establish statistical interaction.')
_add('compare_dose_trend','剂量梯度与已计算趋势结果','Dose gradient with supplied trend result','distribution','dose unit value trend_p trend_method','dose value trend_p',
     '各剂量的独立观测及已计算趋势 P 值、方法；不自动选择趋势检验。','Independent observations at each dose plus a supplied trend P value and method; no automatic trend test selection.')

for key,zh,en in [
 ('relation_scatter','双变量散点','Bivariate scatter'),
 ('relation_regression_ci','线性回归与均值置信带','OLS regression and mean confidence band'),
 ('relation_marginal_hist','散点与边际直方分布','Scatter with marginal histograms'),
 ('relation_density_contour','二维核密度等高线','Bivariate density contours'),
 ('relation_density_fill','二维核密度填充','Filled bivariate density'),
 ('relation_transparent','高密度半透明散点','Transparent high-density scatter'),
 ('relation_identity','同单位测量与恒等线','Same-unit measurements and identity line')]:
    _add(key,zh,en,'relationship','unit x y','x y','每个独立对象一对连续测量；恒等线仅适用于相同单位。','One pair of continuous measurements per independent subject; an identity line requires the same units.')
NOTES['relation_regression_ci'] = ('普通最小二乘直线及均值的 t 分布 95% CI；需确认独立性、线性与残差方差假设。','Ordinary least squares with a t-based mean 95% CI; assess independence, linearity and residual variance assumptions.')
for key,zh,en in [('relation_group_regression','分组散点与回归线','Grouped scatter and regressions'),('relation_marginal_box','分组散点与边际箱线','Grouped scatter and marginal boxes')]:
    _add(key,zh,en,'relationship','unit group x y','x y','每个独立对象一对测量及组别；组内回归不作为组间斜率检验。','Paired measurements and group per independent subject; separate regressions are not a test of slope differences.')
_add('relation_loess','已拟合局部回归曲线','Supplied LOESS curve','relationship','unit role x y','x y','role 为 observation 或 fit；fit 为已完成 LOESS 的有序坐标，保留用户的模型与平滑参数。','role is observation or fit; fit rows are ordered coordinates from a completed LOESS analysis, preserving its model and smoothing settings.')
_add('relation_color','连续变量着色散点','Continuous-colour scatter','relationship','unit x y color_value','x y color_value','颜色编码第三个连续变量，并保留连续色标。','Colour encodes a third continuous variable, with an explicit continuous scale.')
_add('relation_bubble','面积编码气泡图','Area-encoded bubble scatter','relationship','unit x y size','x y size','气泡面积与正的 size 值成正比；图例标明原始大小值。','Bubble area is proportional to positive size values; the legend gives original size values.')
_add('relation_scatter_matrix','多变量散点矩阵','Scatterplot matrix','relationship','unit variable value','value','完整对象的 2–4 个连续变量；对角线为各变量分布，避免用不同对象拼接相关性。','Two to four continuous variables measured on complete subjects; diagonal panels show distributions.')
_add('relation_residual_fitted','拟合值与残差诊断','Residuals versus fitted values','relationship','unit fitted residual','fitted residual','来自同一已完成模型的拟合值与原始残差，不重新选择或拟合模型。','Fitted values and raw residuals from the same completed model; no model is selected or refitted.')
_add('relation_residual_qq','残差正态 Q–Q 图','Residual normal Q–Q','relationship','unit residual','residual','使用已有模型残差检查正态分布形状；不是自动正态性检验。','Inspect the distribution of supplied model residuals against normal quantiles; this is not an automatic normality test.')
_add('relation_influence','杠杆值、标准化残差与影响度','Leverage and residual influence','relationship','unit leverage standardized_residual cooks_d','leverage standardized_residual cooks_d','来自同一模型的杠杆值、标准化残差和 Cook 距离；面积编码影响度，不自动删除观测。','Supply leverage, standardized residual and Cook distance from one model; area encodes influence and no observations are removed.')
_add('relation_model_compare','已拟合模型曲线对比','Supplied model-curve comparison','relationship','unit role series x y','x y','role 为 observation 或 fit；每条 fit 曲线有独立 series 名称；不按视觉拟合效果选定统计模型。','role is observation or fit; each fit has a named series; visual fit does not select the statistical model.')
_add('relation_labelled','选定观测的引线标注','Selected observations with labels','relationship','unit x y selected','x y selected','selected 为 0 或 1；最多标注 6 个用户选定对象，不自动宣称异常值。','selected is 0 or 1; labels up to six user-selected subjects without automatically declaring outliers.')

_a = ['compare_bar_sd','compare_bar_points','compare_mean_sd','compare_mean_ci','compare_box','compare_box_points','compare_notched_box','compare_violin','compare_violin_box','compare_swarm','compare_strip_median','compare_raincloud','compare_bracket_stars','compare_bracket_p','compare_control_symbols','compare_gardner_altman','compare_cumming','compare_paired_lines','compare_paired_change','superplot','grouped_observations','compare_interaction','compare_facet_boxes','compare_dose_trend','compare_log_points','compare_ridgeline','compare_hist_facets','compare_density','compare_ecdf','compare_cleveland']
_b = ['relation_scatter','relation_regression_ci','prediction_intervals','relation_loess','relation_group_regression','relation_color','relation_bubble','relation_marginal_hist','relation_marginal_box','relation_density_contour','relation_density_fill','hexbin_density','relation_transparent','bland_altman','relation_identity','correlation_values','correlation_circles','relation_scatter_matrix','relation_residual_fitted','relation_residual_qq','relation_influence','relation_model_compare','relation_labelled']
SOURCE_MAP = {**{f'A{i+1:02}':k for i,k in enumerate(_a)},**{f'B{i+1:02}':k for i,k in enumerate(_b)}}
PRESERVE_ASPECT = {'relation_identity','relation_scatter_matrix','relation_marginal_hist','relation_marginal_box','compare_gardner_altman','compare_cumming','compare_paired_change','compare_hist_facets','compare_facet_boxes'}
COMPATIBLE_GROUPS = [
    set(k for k,v in CONTRACTS.items() if v[3]=='group unit value'),
    {'compare_bracket_stars','compare_bracket_p','compare_control_symbols'},
    {'compare_gardner_altman','compare_cumming'},
    {'compare_paired_lines','compare_paired_change','paired_dumbbell'},
    {'compare_interaction','compare_facet_boxes','grouped_observations'},
    {'relation_scatter','relation_marginal_hist','relation_density_contour','relation_density_fill','relation_transparent','hexbin_density'},
]

def validate(data, view):
    if view not in CONTRACTS: raise ValueError('Unknown comparison template')
    fields=CONTRACTS[view][3].split(); numeric=CONTRACTS[view][4].split()
    if not set(fields)<=set(data): raise ValueError('Required columns: '+', '.join(fields))
    d=data.copy()
    if d.empty or d[fields].isna().any().any(): raise ValueError('Required fields must be nonempty')
    for c in numeric:
        d[c]=pd.to_numeric(d[c],errors='raise')
        if not np.isfinite(d[c]).all(): raise ValueError('Numeric values must be finite')
    for c in set(fields)-set(numeric):
        d[c]=d[c].astype(str)
        if d[c].str.strip().eq('').any(): raise ValueError('Text values must be nonempty')
        if d[c].str.len().max()>70: raise ValueError('Use labels of at most 70 characters, with full detail in the caption')
    keys = ['unit','variable'] if view=='relation_scatter_matrix' else ['unit','role','series'] if view=='relation_model_compare' else ['unit','role'] if view=='relation_loess' else ['unit','factor','group'] if 'factor' in fields else ['unit','dose'] if 'dose' in fields else ['unit','group'] if 'group' in fields else ['unit']
    if d.duplicated(keys).any(): raise ValueError('Duplicate observation keys: '+', '.join(keys))
    if 'group' in fields:
        if not 1<=d.group.nunique()<=6: raise ValueError('Use 1–6 groups per panel')
        for _,g in d.groupby('group',sort=False):
            if len(g)<3: raise ValueError('At least three independent observations per group')
        if view in {'compare_violin','compare_violin_box','compare_raincloud','compare_ridgeline','compare_density'}:
            if any(len(g)<8 or g.value.nunique()<3 for _,g in d.groupby('group')): raise ValueError('Density needs eight nonconstant observations per group')
    if 'factor' in fields:
        cells=d.groupby(['factor','group']).size()
        if d.factor.nunique()>4 or len(cells)!=d.factor.nunique()*d.group.nunique() or cells.min()<3:
            raise ValueError('Use up to four factors, with three or more observations in every factor-group cell')
    if view=='compare_notched_box' and d.groupby('group').size().min()<10:raise ValueError('Notched boxes require at least ten observations per group; use a plain box with raw points for smaller groups')
    if view=='compare_log_points' and (d.value<=0).any(): raise ValueError('Log scales require positive values')
    if 'reference' in fields:
        if not set(d.reference)<=set(d.group): raise ValueError('Every reference must be an observed group')
        result_cols=['reference','p','method'] if 'p' in fields else ['reference','estimate','low','high']
        if (d.groupby('group')[result_cols].nunique()>1).any().any(): raise ValueError('Each group must have one consistent supplied comparison')
    if 'p' in fields and not d.p.between(0,1,inclusive='right').all(): raise ValueError('P values must lie in (0, 1]')
    if 'estimate' in fields:
        if not ((d.low<=d.estimate)&(d.estimate<=d.high)).all(): raise ValueError('Intervals must contain their estimates')
        if d.reference.nunique()!=1: raise ValueError('Estimation views use one common reference group')
        if view=='compare_gardner_altman' and d.group.nunique()!=2: raise ValueError('The two-group estimation view requires exactly two groups')
    if 'trend_p' in fields:
        if d.trend_p.nunique()!=1 or d.trend_method.nunique()!=1 or not d.trend_p.between(0,1,inclusive='right').all(): raise ValueError('Supply one valid trend result and method')
        if not 3<=d.dose.nunique()<=8 or d.groupby('dose').size().min()<3: raise ValueError('Use three to eight dose levels, with three observations per level')
    if view in {'relation_regression_ci','relation_group_regression'}:
        groups=d.groupby('group') if 'group' in fields else [('all',d)]
        if any(len(g)<6 or g.x.nunique()<3 for _,g in groups): raise ValueError('Linear regression needs six observations and three distinct X values per fitted group')
    if view in {'relation_density_contour','relation_density_fill'} and (len(d)<12 or np.linalg.matrix_rank(np.cov(d[['x','y']].to_numpy().T))<2): raise ValueError('2-D KDE needs twelve observations and a nonsingular covariance')
    if 'size' in fields and (d['size']<=0).any(): raise ValueError('Bubble sizes must be positive')
    if view=='relation_scatter_matrix':
        m=d.pivot(index='unit',columns='variable',values='value')
        if m.isna().any().any() or len(m)<5 or not 2<=len(m.columns)<=4 or (m.std()==0).any(): raise ValueError('Use five complete subjects and two to four nonconstant variables')
    if view in {'relation_loess','relation_model_compare'}:
        if set(d.role)!={'observation','fit'}: raise ValueError('Supply both observation and fit rows')
        ff=d[d.role=='fit']; groups=ff.groupby('series') if 'series' in fields else [('fit',ff)]
        for _,g in groups:
            if len(g)<5 or g.x.duplicated().any(): raise ValueError('Each fit needs at least five unique X coordinates')
        if 'series' in fields and ff.series.nunique()>4: raise ValueError('Compare at most four fitted curves')
    if view=='relation_influence' and (not d.leverage.between(0,1).all() or (d.cooks_d<0).any()): raise ValueError('Leverage must be in [0,1], Cook distance nonnegative')
    if view=='relation_labelled' and (not d.selected.isin([0,1]).all() or d.selected.sum()>6): raise ValueError('Select at most six labels using 0 or 1')
    if 'residual' in fields and (len(d)<4 or d.residual.nunique()<3): raise ValueError('At least four nonconstant residuals required')
    if len(d)<3: raise ValueError('At least three observations required')
    return d

def _wrap(value,width=13):
    return '\n'.join(textwrap.wrap(str(value),width=width,break_long_words=True))

def _style(ax,x=None,y=None):
    ax.spines[['top','right']].set_visible(False)
    ax.tick_params(labelsize=8,length=3,pad=4)
    ax.xaxis.set_major_locator(MaxNLocator(4));ax.yaxis.set_major_locator(MaxNLocator(5))
    if x: ax.set_xlabel(x,fontsize=9,labelpad=6)
    if y: ax.set_ylabel(y,fontsize=9,labelpad=6)

def _categorical(ax,names,axis='x'):
    labels=[_wrap(s,11 if len(names)>3 else 15) for s in names]
    if axis=='x':
        ax.set_xticks(range(len(names)),labels)
        available=ax.figure.get_figwidth()*72*ax.get_position().width/max(1,len(names))
        needed=max(len(line) for label in labels for line in label.split('\n'))*4.4
        if needed>available*.9:
            for label in ax.get_xticklabels():label.set_rotation(35);label.set_ha('right');label.set_rotation_mode('anchor')
    else: ax.set_yticks(range(len(names)),labels)

def _points(ax,values,x,color,spread=.13,marker='o'):
    # Deterministic jitter never changes the data coordinate.
    offsets=np.sin(np.arange(len(values))*2.399963)*spread
    return ax.scatter(x+offsets,values,s=15,color=color,alpha=.78,edgecolors='white',linewidths=.4,marker=marker,zorder=3)

def _summary(values):
    a=np.asarray(values); mean=a.mean();sd=a.std(ddof=1)
    return mean,sd,stats.t.ppf(.975,len(a)-1)*sd/np.sqrt(len(a))

def _kde(values):
    v=np.asarray(values);estimate=stats.gaussian_kde(v);pad=3*np.sqrt(estimate.covariance[0,0]);grid=np.linspace(v.min()-pad,v.max()+pad,180)
    return grid,estimate(grid)

def _legend(ax,handles=None,labels=None,columns=2):
    if handles is None: handles,labels=ax.get_legend_handles_labels()
    ax.legend(handles,[_wrap(s,18) for s in labels],loc='lower left',bbox_to_anchor=(0,1.02),ncol=columns,frameon=False,fontsize=8,handlelength=1.8,columnspacing=1.0,borderaxespad=0)

def _swarm(values,width=.3):
    """Greedy packing in normalized value space; preserves every observation."""
    values=np.asarray(values);yy=(values-values.min())/(np.ptp(values) or 1);out=np.zeros(len(values));placed=[]
    for i in np.argsort(yy):
        occupied=[out[j] for j in placed if abs(yy[i]-yy[j])<.032]
        options=[0]+[sign*k*.07 for k in range(1,7) for sign in (-1,1)]
        out[i]=next((x for x in options if all(abs(x-o)>.065 for o in occupied)),options[-1]);placed.append(i)
    if abs(out).max()>width:out*=width/abs(out).max()
    return out

def _ptext(p):
    return r'$\mathit{P}$ = '+(f'{p:.3f}' if p>=.001 else f'{p:.2g}')

def render(data,view,colors=None,figsize=(4.8,3.6)):
    d=validate(data,view);c=list(colors or PALETTE);c=(c*6)[:6]
    plt.rcParams.update({'svg.fonttype':'none','font.family':font_families(),'font.size':8,'axes.linewidth':.75,'axes.labelcolor':'#25344A','xtick.color':'#3E4C60','ytick.color':'#3E4C60','text.color':'#25344A'})
    fig,ax=plt.subplots(figsize=figsize,layout='constrained')
    fig.get_layout_engine().set(w_pad=.055,h_pad=.055,wspace=.10,hspace=.10)
    rng=np.random.default_rng(41)
    names=list(d.group.unique()) if 'group' in d else []
    grouped=[d.loc[d.group==g,'value'].to_numpy() for g in names] if names and 'value' in d else []
    simple={'compare_bar_sd','compare_bar_points','compare_mean_sd','compare_mean_ci','compare_box','compare_box_points','compare_notched_box','compare_violin','compare_violin_box','compare_swarm','compare_strip_median','compare_raincloud','compare_log_points','compare_bracket_stars','compare_bracket_p','compare_control_symbols'}
    if view in simple:
        # Keep categorical glyphs within a physical width when a panel spans columns.
        bar_width=min(.57,.48*len(names)/(figsize[0]*.8))
        violin_width=min(.34,.36*len(names)/(figsize[0]*.8))
        for i,v in enumerate(grouped):
            mean,sd,ci=_summary(v);color=c[i]
            color_bar=None
            if view in {'compare_bar_sd','compare_bar_points'}:
                color_bar=ax.bar(i,mean,width=bar_width,color=color,alpha=.75,zorder=2)[0]
                error=ax.errorbar(i,mean,yerr=sd,fmt='none',ecolor='#33445A',capsize=3,lw=1)
                tag_color_source(error,color_bar)
            if view in {'compare_mean_sd','compare_mean_ci','compare_swarm'}:
                ax.errorbar(i,mean,yerr=ci if view=='compare_mean_ci' else sd,fmt='o',mfc='white' if view=='compare_swarm' else color,mec=color,color=color,capsize=4,ms=5,lw=1.3,zorder=5)
            if view in {'compare_box','compare_box_points','compare_notched_box','compare_violin_box','compare_raincloud'}:
                offset=-.03 if view=='compare_raincloud' else 0
                bp=ax.boxplot([v],positions=[i+offset],widths=.10 if view in {'compare_violin_box','compare_raincloud'} else .45,notch=view=='compare_notched_box',patch_artist=True,showfliers=view in {'compare_box','compare_notched_box'},manage_ticks=False,medianprops=dict(color='#23344C',lw=1.25),boxprops=dict(facecolor='white' if view in {'compare_violin_box','compare_raincloud'} else color,alpha=.65,edgecolor=color),whiskerprops=dict(color=color),capprops=dict(color=color),flierprops=dict(marker='o',markersize=3,markeredgecolor=color,alpha=.6))
            if view in {'compare_violin','compare_violin_box','compare_raincloud'}:
                gy,density=_kde(v);width=violin_width*density/density.max()
                if view=='compare_raincloud':ax.fill_betweenx(gy,i-.12-width,i-.12,color=color,alpha=.25,lw=.8,edgecolor=color)
                else: ax.fill_betweenx(gy,i-width,i+width,color=color,alpha=.25,lw=.8,edgecolor=color)
            if view in {'compare_bar_points','compare_box_points','compare_strip_median','compare_raincloud','compare_log_points','compare_bracket_stars','compare_bracket_p','compare_control_symbols'}:
                points=_points(ax,v,i+(.18 if view=='compare_raincloud' else 0),color,spread=.07 if view=='compare_raincloud' else min(.13,.4*bar_width) if view=='compare_bar_points' else .13)
                if color_bar is not None:tag_color_source(points,color_bar)
            if view=='compare_swarm':ax.scatter(i+_swarm(v),v,s=14,color=color,alpha=.7,edgecolors='white',linewidth=.4)
            if view in {'compare_strip_median','compare_log_points','compare_bracket_stars','compare_bracket_p','compare_control_symbols'}:ax.plot([i-.19,i+.19],[np.median(v)]*2,color='#23344C',lw=1.4,zorder=4)
        _style(ax,y='Value');_categorical(ax,names);ax.set_xlim(-.62,len(names)-.38);ax.margins(y=.12)
        if view.startswith('compare_bar'):ax.set_ylim(bottom=min(0,float(d.value.min())*1.1))
        if view=='compare_log_points':
            ax.set_yscale('log');ax.set_ylabel('Value (log scale)')
            # Keep ordinary magnitudes compact without changing log positions.
            # Math-text minor labels such as 1.2 x 10^1 otherwise consume the
            # shared left margin and collide with the axis title after resizing.
            compact=FuncFormatter(lambda value,position:format(value,'.4g'))
            ax.yaxis.set_major_formatter(compact);ax.yaxis.set_minor_formatter(compact)
        if view in {'compare_bracket_stars','compare_bracket_p','compare_control_symbols'}:
            rows=d.groupby('group',sort=False).first();comparisons=[(g,r) for g,r in rows.iterrows() if g!=r.reference];span=np.ptp(d.value) or max(1,abs(d.value.mean()));base=d.value.max()+.12*span
            for j,(g,r) in enumerate(comparisons):
                x=names.index(g);ref=names.index(r.reference);y=base+j*.19*span
                label=('****' if r.p<.0001 else '***' if r.p<.001 else '**' if r.p<.01 else '*' if r.p<.05 else 'ns') if view!='compare_bracket_p' else _ptext(r.p)
                if view=='compare_control_symbols':ax.text(x,base,label,ha='center',va='bottom',fontsize=9,gid=f'studio-spacing-group-{x}-label')
                else:
                    ax.plot([ref,ref,x,x],[y,y+.025*span,y+.025*span,y],color='#526078',lw=.8)
                    ax.text((x+ref)/2,y+.045*span,label,ha='center',va='bottom',fontsize=8,gid=f'studio-spacing-comparison-label-{ref}-{x}')
            ax.set_ylim(top=base+max(1,len(comparisons))*.19*span)
            if view=='compare_control_symbols' and d.reference.nunique()==1:ax.set_title('Compared with '+_wrap(d.reference.iloc[0],30),fontsize=8,pad=10,loc='left')
    elif view in {'compare_gardner_altman','compare_cumming'}:
        fig.delaxes(ax)
        if view=='compare_gardner_altman': grid=fig.add_gridspec(1,2,width_ratios=[1.6,1]);a=fig.add_subplot(grid[0]);b=fig.add_subplot(grid[1])
        else:grid=fig.add_gridspec(2,1,height_ratios=[1.5,1]);a=fig.add_subplot(grid[0]);b=fig.add_subplot(grid[1])
        ref=d.reference.iloc[0];rr=d.groupby('group',sort=False).first();comparisons=[g for g in names if g!=ref]
        for i,v in enumerate(grouped):_points(a,v,i,c[i]);a.plot([i-.15,i+.15],[v.mean()]*2,color='#33445A',lw=1.5)
        _style(a,y='Observed value');_categorical(a,names);a.set_xlim(-.5,len(names)-.5);a.margins(y=.12)
        for i,g in enumerate(comparisons):
            r=rr.loc[g];pos=names.index(g) if view=='compare_cumming' else i;b.errorbar(pos,r.estimate,yerr=[[r.estimate-r.low],[r.high-r.estimate]],fmt='o',color=c[names.index(g)],capsize=4,ms=5,lw=1.4)
        b.axhline(0,color='#ADB7C4',ls='--',lw=.8);_style(b,y='Difference with CI')
        if view=='compare_cumming':_categorical(b,names);b.set_xlim(a.get_xlim());b.margins(y=.23)
        else:
            _categorical(b,comparisons);b.set_xlim(-.5,len(comparisons)-.5);refmean=d.loc[d.group==ref,'value'].mean();lo,hi=a.get_ylim();b.set_ylim(lo-refmean,hi-refmean)
    elif view in {'compare_paired_lines','compare_paired_change'}:
        if view=='compare_paired_change':fig.delaxes(ax);ax,b=fig.subplots(1,2,gridspec_kw={'width_ratios':[1.45,1]})
        for row in d.itertuples():ax.plot([0,1],[row.before,row.after],color='#ADB8C7',alpha=.5,lw=.7,zorder=1)
        ax.scatter(np.zeros(len(d)),d.before,color=c[0],s=15,edgecolors='white',linewidth=.3);ax.scatter(np.ones(len(d)),d.after,color=c[1],s=15,edgecolors='white',linewidth=.3);_style(ax,y='Value');_categorical(ax,['Before','After']);ax.set_xlim(-.25,1.25);ax.margins(y=.14)
        if view=='compare_paired_change':delta=d.after-d.before;_points(b,delta,0,c[1]);b.axhline(0,color='#ADB7C4',ls='--',lw=.8);b.plot([-.18,.18],[delta.mean()]*2,color='#33445A',lw=1.4);_style(b,y='After − before');_categorical(b,['Change']);b.set_xlim(-.4,.4);b.margins(y=.16)
    elif view in {'compare_interaction','compare_facet_boxes'}:
        factors=list(d.factor.unique())
        if view=='compare_facet_boxes':fig.delaxes(ax);axes=fig.subplots(2 if len(factors)>2 else 1,2 if len(factors)>1 else 1,squeeze=False,sharey=True).ravel()
        for j,g in enumerate(names):
            means=[];sds=[]
            for i,f in enumerate(factors):
                v=d.loc[(d.group==g)&(d.factor==f),'value'].to_numpy();means.append(v.mean());sds.append(v.std(ddof=1))
                if view=='compare_facet_boxes':
                    a=axes[i];boxes=a.boxplot([v],positions=[j],widths=.45,patch_artist=True,showfliers=False,manage_ticks=False,boxprops=dict(facecolor=c[j],alpha=.23,edgecolor=c[j]),medianprops=dict(color=c[j]));points=_points(a,v,j,c[j],.11)
                    tag_stat_group(a,g,f,(j,np.median(v)),[points,*[artist for artists in boxes.values() for artist in artists]])
            if view=='compare_interaction':
                series=ax.errorbar(range(len(factors)),means,yerr=sds,color=c[j],marker=['o','s','^','D','v','P'][j],ls=['-','--',':','-.','-','--'][j],ms=4,lw=1.2,capsize=3,label=g)
                for i,f in enumerate(factors):
                    tag_stat_group(ax,g,f,(i,means[i]),[series.lines[0]],point_index=i,comparison_axis='y')
        if view=='compare_interaction':_style(ax,y='Mean ± SD');_categorical(ax,factors);_legend(ax,columns=min(3,len(names)));ax.margins(x=.1,y=.14)
        else:
            for i,a in enumerate(axes):
                if i>=len(factors):a.set_visible(False);continue
                _style(a,y='Value' if i%2==0 else None);_categorical(a,names);a.set_title(_wrap(factors[i]),fontsize=9,pad=7);a.margins(y=.13)
    elif view=='compare_dose_trend':
        doses=sorted(d.dose.unique());means=[];sd=[]
        for i,dose in enumerate(doses):v=d.loc[d.dose==dose,'value'].to_numpy();_points(ax,v,i,c[0],.09);means.append(v.mean());sd.append(v.std(ddof=1))
        ax.errorbar(range(len(doses)),means,yerr=sd,color=c[0],lw=1.3,ms=4,fmt='o-',capsize=3);_style(ax,'Dose','Value');_categorical(ax,[f'{v:g}' for v in doses]);ax.set_title(_ptext(d.trend_p.iloc[0])+'\n'+_wrap(d.trend_method.iloc[0],38),loc='left',fontsize=8,pad=10);ax.margins(x=.08,y=.13)
    elif view in {'compare_ridgeline','compare_hist_facets','compare_density','compare_ecdf','compare_cleveland'}:
        if view=='compare_hist_facets':fig.delaxes(ax);axes=np.atleast_1d(fig.subplots(len(names),1,sharex=True,sharey=True));edges=np.histogram_bin_edges(d.value,bins='fd');edges=np.linspace(d.value.min(),d.value.max(),min(17,max(6,len(edges))))
        if view=='compare_cleveland':
            order=np.argsort([v.mean() for v in grouped]);labels=[]
            for j,i in enumerate(order):m,sd,ci=_summary(grouped[i]);ax.errorbar(m,j,xerr=ci,fmt='o',color=c[i],capsize=3,ms=5,lw=1.3);labels.append(names[i])
            _style(ax,'Mean and 95% CI');_categorical(ax,labels,'y');ax.margins(x=.18,y=.2)
        else:
            for i,v in enumerate(grouped):
                if view=='compare_ecdf':x=np.sort(v);ax.step(x,np.arange(1,len(v)+1)/len(v),where='post',color=c[i],lw=1.3,ls=['-','--',':','-.','-','--'][i],label=names[i])
                elif view=='compare_hist_facets':a=axes[i];a.hist(v,bins=edges,color=c[i],alpha=.7,edgecolor='white',lw=.6);a.text(.98,.72,_wrap(names[i],22),transform=a.transAxes,ha='right',va='center',fontsize=8,bbox=dict(fc='white',ec='none',alpha=.8,pad=2));_style(a,'Value' if i==len(names)-1 else None,'Count');a.yaxis.set_major_locator(MaxNLocator(2,integer=True))
                else:
                    gx,dd=_kde(v)
                    if view=='compare_ridgeline':
                        dd=dd/dd.max()*.78
                        ax.fill_between(gx,i,i+dd,color=c[i],alpha=.28,gid=f'studio-spacing-group-{i}-density')
                        ax.plot(gx,i+dd,color=c[i],lw=1.1,gid=f'studio-spacing-group-{i}-outline')
                        ax.plot([np.median(v)]*2,[i,i+.12],color=c[i],lw=1.4,gid=f'studio-spacing-group-{i}-median')
                    else:ax.fill_between(gx,0,dd,color=c[i],alpha=.08);ax.plot(gx,dd,color=c[i],lw=1.4,ls=['-','--',':','-.','-','--'][i],label=names[i])
            if view=='compare_ridgeline':_style(ax,'Value');_categorical(ax,names,'y');ax.tick_params(axis='y',length=0);ax.spines['left'].set_visible(False)
            elif view!='compare_hist_facets':_style(ax,'Value','Cumulative proportion' if view=='compare_ecdf' else 'Density');_legend(ax,columns=min(3,len(names)));ax.set_ylim(bottom=0,top=1.04 if view=='compare_ecdf' else None)
    elif view=='relation_scatter_matrix':
        m=d.pivot(index='unit',columns='variable',values='value');cols=list(m);n=len(cols);fig.delaxes(ax);axes=fig.subplots(n,n)
        for i in range(n):
            for j in range(n):
                a=axes[i,j]
                if i==j:a.hist(m.iloc[:,i],bins=9,color=c[0],alpha=.5,edgecolor='white',lw=.4)
                else:a.scatter(m.iloc[:,j],m.iloc[:,i],s=7,color=c[0],alpha=.55,lw=0)
                a.spines[['top','right']].set_visible(False);a.tick_params(labelsize=8,length=2,pad=2);a.xaxis.set_major_locator(MaxNLocator(2));a.yaxis.set_major_locator(MaxNLocator(2))
                if i<n-1:a.tick_params(labelbottom=False)
                else:a.set_xlabel(_wrap(cols[j],7),fontsize=8,labelpad=4)
                if j>0:a.tick_params(labelleft=False)
                else:a.set_ylabel(_wrap(cols[i],7),fontsize=8,labelpad=4)
    elif view in {'relation_residual_fitted','relation_residual_qq','relation_influence'}:
        if view=='relation_residual_fitted':ax.scatter(d.fitted,d.residual,s=19,color=c[0],alpha=.65,edgecolor='white',lw=.4);ax.axhline(0,color='#98A6B9',ls='--',lw=.9);_style(ax,'Fitted value','Residual')
        elif view=='relation_residual_qq':
            (q,ys),(slope,intercept,_)=stats.probplot(d.residual,dist='norm');ax.scatter(q,ys,s=18,color=c[0],alpha=.75);ax.plot(q,intercept+slope*q,color=c[1],lw=1.2);_style(ax,'Theoretical normal quantile','Ordered residual')
        else:
            size=25+150*d.cooks_d/max(d.cooks_d.max(),1e-12);ax.scatter(d.leverage,d.standardized_residual,s=size,color=c[0],alpha=.5,edgecolor='white',lw=.6);ax.axhline(0,color='#98A6B9',lw=.8);_style(ax,'Leverage','Standardized residual');maxc=d.cooks_d.max();vals=np.array([.25,.75])*maxc if maxc>0 else np.array([0]);handles=[ax.scatter([],[],s=25+150*v/max(maxc,1e-12),color=c[0],alpha=.5,edgecolor='white') for v in vals];_legend(ax,handles,[f'Cook D {v:.3g}' for v in vals]);ax.margins(x=.15,y=.2)
    else:
        # Relationship plots. All fitted-result modes keep results distinct from observations.
        joint=view in {'relation_marginal_hist','relation_marginal_box'}
        if joint:
            fig.delaxes(ax);grid=fig.add_gridspec(2,2,width_ratios=[4,1],height_ratios=[1,4],hspace=.03,wspace=.03);ax=fig.add_subplot(grid[1,0]);top=fig.add_subplot(grid[0,0],sharex=ax);right=fig.add_subplot(grid[1,1],sharey=ax)
            top.tick_params(axis='x',labelbottom=False);right.tick_params(axis='y',labelleft=False);top.spines[:].set_visible(False);right.spines[:].set_visible(False);top.tick_params(left=False,labelleft=False,bottom=False);right.tick_params(left=False,bottom=False,labelbottom=False)
        obs=d[d.role=='observation'] if 'role' in d else d
        if view in {'relation_group_regression','relation_marginal_box'}:
            for i,g in enumerate(names):
                dd=d[d.group==g];ax.scatter(dd.x,dd.y,s=17,color=c[i],alpha=.65,marker=['o','s','^','D','v','P'][i],label=g,lw=0)
                if view=='relation_group_regression':fit=stats.linregress(dd.x,dd.y);xx=np.array([dd.x.min(),dd.x.max()]);ax.plot(xx,fit.intercept+fit.slope*xx,color=c[i],lw=1.3,ls=['-','--',':','-.','-','--'][i])
                else:top.boxplot([dd.x],positions=[i],vert=False,widths=.5,patch_artist=True,manage_ticks=False,showfliers=False,boxprops=dict(facecolor=c[i],alpha=.3,edgecolor=c[i]),medianprops=dict(color=c[i]));right.boxplot([dd.y],positions=[i],widths=.5,patch_artist=True,manage_ticks=False,showfliers=False,boxprops=dict(facecolor=c[i],alpha=.3,edgecolor=c[i]),medianprops=dict(color=c[i]))
            if joint:
                top.set_yticks([]);right.set_xticks([]);top.set_ylim(-.7,len(names)-.3);right.set_xlim(-.7,len(names)-.3)
                handles,labels=ax.get_legend_handles_labels();_legend(top,handles,labels,columns=min(3,len(names)))
            else:_legend(ax,columns=min(3,len(names)))
        elif view=='relation_color':
            cmap=LinearSegmentedColormap.from_list('studio_continuous',['#DEE6F0',c[0]])
            sc=ax.scatter(d.x,d.y,c=d.color_value,s=23,cmap=cmap,edgecolor='white',lw=.35);cb=fig.colorbar(sc,ax=ax,shrink=.78,pad=.035,aspect=25);cb.set_label('Colour value',fontsize=8);cb.ax.tick_params(labelsize=8);cb.solids.set_rasterized(False)
        elif view=='relation_bubble':
            scale=160/d['size'].max();ax.scatter(d.x,d.y,s=d['size']*scale,color=c[0],alpha=.5,edgecolors='white',lw=.7);vals=np.quantile(d['size'],[.2,.8]);handles=[ax.scatter([],[],s=v*scale,color=c[0],alpha=.5,edgecolors='white') for v in vals];_legend(ax,handles,[f'Size {v:.2g}' for v in vals])
        elif view in {'relation_density_contour','relation_density_fill'}:
            xpad=np.ptp(d.x)*.15;ypad=np.ptp(d.y)*.15;xx,yy=np.meshgrid(np.linspace(d.x.min()-xpad,d.x.max()+xpad,65),np.linspace(d.y.min()-ypad,d.y.max()+ypad,65));density=stats.gaussian_kde(d[['x','y']].to_numpy().T)(np.vstack([xx.ravel(),yy.ravel()])).reshape(xx.shape);levels=np.linspace(density.max()*.12,density.max()*.95,5)
            if view=='relation_density_fill':ax.contourf(xx,yy,density,levels=np.r_[0,levels,density.max()*1.01],cmap=LinearSegmentedColormap.from_list('studio_density',['#FFFFFF','#D7E2EF',c[0]]))
            ax.contour(xx,yy,density,levels=levels,colors=c[0],linewidths=.7,alpha=.8);ax.scatter(d.x,d.y,s=6,color=c[0],alpha=.18,lw=0)
        else:ax.scatter(obs.x,obs.y,s=10 if view=='relation_transparent' else 18,color=c[0],alpha=.20 if view=='relation_transparent' else .65,edgecolors='white',lw=.3)
        if view=='relation_regression_ci':
            x=d.x.to_numpy();y=d.y.to_numpy();fit=stats.linregress(x,y);gx=np.linspace(x.min(),x.max(),100);gy=fit.intercept+fit.slope*gx;se=np.sqrt(np.sum((y-fit.intercept-fit.slope*x)**2)/(len(x)-2));ci=stats.t.ppf(.975,len(x)-2)*se*np.sqrt(1/len(x)+(gx-x.mean())**2/np.sum((x-x.mean())**2));ax.fill_between(gx,gy-ci,gy+ci,color=c[0],alpha=.18);ax.plot(gx,gy,color=c[0],lw=1.4)
        if view=='relation_identity':
            lo=min(d.x.min(),d.y.min());hi=max(d.x.max(),d.y.max());pad=(hi-lo)*.08;ax.plot([lo-pad,hi+pad],[lo-pad,hi+pad],ls='--',color=c[1],lw=1.1);ax.set(xlim=(lo-pad,hi+pad),ylim=(lo-pad,hi+pad));ax.set_aspect('equal',adjustable='box')
        if view in {'relation_loess','relation_model_compare'}:
            ff=d[d.role=='fit'];groups=ff.groupby('series',sort=False) if 'series' in d else [('LOESS',ff)]
            for i,(label,g) in enumerate(groups):g=g.sort_values('x');ax.plot(g.x,g.y,color=c[i+1],lw=1.5,ls=['-','--',':','-.'][i],label=label)
            _legend(ax,columns=2)
        if view=='relation_marginal_hist':top.hist(d.x,bins='fd',color=c[0],alpha=.45,edgecolor='white',lw=.5);right.hist(d.y,bins='fd',orientation='horizontal',color=c[0],alpha=.45,edgecolor='white',lw=.5)
        if view=='relation_labelled':
            rows=d[d.selected==1].sort_values('y');xlim=(d.x.min(),d.x.max());ylim=(d.y.min(),d.y.max());spanx=np.ptp(d.x) or 1;spany=np.ptp(d.y) or 1;labelx=xlim[1]+.22*spanx
            for row,yy in zip(rows.itertuples(),np.linspace(ylim[0],ylim[1],len(rows))):ax.annotate(_wrap(row.unit,12),xy=(row.x,row.y),xytext=(labelx,yy),ha='left',va='center',fontsize=8,color=c[1],arrowprops=dict(arrowstyle='-',lw=.75,color=c[1]),annotation_clip=False)
            ax.set_xlim(xlim[0]-.08*spanx,xlim[1]+.8*spanx);ax.set_ylim(ylim[0]-.12*spany,ylim[1]+.12*spany)
        _style(ax,'X','Y')
        if view=='relation_identity':ax.set_xlabel('Method A');ax.set_ylabel('Method B')
    return fig

def fixtures():
    """Synthetic, seeded, editable examples. No values originate from a study."""
    rng=np.random.default_rng(1031);groups=['Control','Treatment','Rescue'];base=pd.DataFrame([{'group':g,'unit':f'{g}-U{i+1:02}','value':float(v)} for j,g in enumerate(groups) for i,v in enumerate(rng.normal([10,13,11][j],[.85,1.1,.75][j],24))]);out={}
    for k in CONTRACTS:
        if CONTRACTS[k][3]=='group unit value':out[k]=base.copy()
    paired=pd.DataFrame({'unit':[f'S{i+1:02}' for i in range(20)],'before':rng.normal(10,1,20)});paired['after']=paired.before+rng.normal(1.4,.8,len(paired))
    for k in ['compare_paired_lines','compare_paired_change']:out[k]=paired.copy()
    factorial=pd.concat([base.assign(factor=f,unit=f'D{i+1}-'+base.unit,value=base.value*(1+i*.13)) for i,f in enumerate(['Day 1','Day 7','Day 14'])],ignore_index=True)
    for k in ['compare_interaction','compare_facet_boxes']:out[k]=factorial.copy()
    dose=pd.DataFrame([{'dose':dose,'unit':f'D{dose}-U{i+1:02}','value':float(v)} for dose in [0,1,3,10] for i,v in enumerate(rng.normal(10+dose*.32,.9,12))]);dose['trend_p']=stats.linregress(dose.dose,dose.value).pvalue;dose['trend_method']='OLS slope test on synthetic data';out['compare_dose_trend']=dose
    reference=base.loc[base.group=='Control','value'].to_numpy();contrast={};rawp={}
    for name in groups[1:]:
        values=base.loc[base.group==name,'value'].to_numpy();v1=reference.var(ddof=1)/len(reference);v2=values.var(ddof=1)/len(values);se=np.sqrt(v1+v2);df=(v1+v2)**2/(v1*v1/(len(reference)-1)+v2*v2/(len(values)-1));delta=values.mean()-reference.mean();half=stats.t.ppf(.975,df)*se;contrast[name]=(delta,delta-half,delta+half);rawp[name]=stats.ttest_ind(reference,values,equal_var=False).pvalue
    adjusted={};previous=0
    for i,name in enumerate(sorted(rawp,key=rawp.get)):previous=max(previous,min(1,rawp[name]*(len(rawp)-i)));adjusted[name]=previous
    for k in ['compare_bracket_stars','compare_bracket_p','compare_control_symbols']:
        z=base.copy();z['reference']='Control';z['p']=z.group.map({'Control':1.,**adjusted});z['method']='Welch comparisons; Holm adjusted (synthetic)';out[k]=z
    for k in ['compare_gardner_altman','compare_cumming']:
        z=base.copy() if k=='compare_cumming' else base[base.group!='Rescue'].copy();z['reference']='Control'
        for j,column in enumerate(['estimate','low','high']):z[column]=z.group.map({'Control':0.,**{name:result[j] for name,result in contrast.items()}})
        out[k]=z
    x=rng.uniform(1,12,100);y=2+.72*x+rng.normal(0,1.45,len(x));xy=pd.DataFrame({'unit':[f'S{i+1:03}' for i in range(len(x))],'x':x,'y':y})
    for k in CONTRACTS:
        if CONTRACTS[k][3]=='unit x y':out[k]=xy.copy()
    for k in ['relation_group_regression','relation_marginal_box']:
        z=xy.copy();z['group']=np.where(np.arange(len(z))%2,'Cohort A','Cohort B');z.loc[z.group=='Cohort B','y']+=1.3;out[k]=z
    z=xy.copy();z['color_value']=rng.uniform(0,10,len(z));out['relation_color']=z
    z=xy.iloc[:35].copy();z['size']=rng.uniform(5,80,len(z));out['relation_bubble']=z
    z=xy.copy();z['selected']=0;z.loc[[3,18,55],'selected']=1;out['relation_labelled']=z
    matrix=np.column_stack([x,y,.5*x+rng.normal(0,2,len(x))]);out['relation_scatter_matrix']=pd.DataFrame([{'unit':f'S{i:03}','variable':name,'value':float(matrix[i,j])} for i in range(len(x)) for j,name in enumerate(['Marker A','Marker B','Marker C'])])
    gx=np.linspace(1,12,90);observed=xy.assign(role='observation')
    # Seeded fixture results are actually fitted to these same synthetic points.
    # Local linear LOESS: tricube weights with a fixed 55% nearest-neighbour span.
    local=[]
    for point in gx:
        distance=np.abs(x-point);band=np.partition(distance,int(np.ceil(.55*len(x)))-1)[int(np.ceil(.55*len(x)))-1];weights=np.clip(1-(distance/band)**3,0,None)**3;design=np.column_stack([np.ones(len(x)),x-point]);coef=np.linalg.lstsq(design*np.sqrt(weights[:,None]),y*np.sqrt(weights),rcond=None)[0];local.append(coef[0])
    curve=pd.DataFrame({'unit':[f'F{i}' for i in range(len(gx))],'role':'fit','x':gx,'y':local})
    out['relation_loess']=pd.concat([observed,curve],ignore_index=True)
    fit=stats.linregress(x,y);fitted=fit.intercept+fit.slope*x
    out['relation_model_compare']=pd.concat([observed.assign(series='Observations'),curve.assign(series='Linear',y=fit.intercept+fit.slope*gx),curve.assign(series='LOESS')],ignore_index=True)
    residual=y-fitted;leverage=1/len(x)+(x-x.mean())**2/np.sum((x-x.mean())**2);mse=np.sum(residual**2)/(len(x)-2);standard=residual/np.sqrt(mse*(1-leverage));out['relation_residual_fitted']=pd.DataFrame({'unit':xy.unit,'fitted':fitted,'residual':residual});out['relation_residual_qq']=pd.DataFrame({'unit':xy.unit,'residual':residual});out['relation_influence']=pd.DataFrame({'unit':xy.unit,'leverage':leverage,'standardized_residual':standard,'cooks_d':standard**2*leverage/(2*(1-leverage))})
    return out
