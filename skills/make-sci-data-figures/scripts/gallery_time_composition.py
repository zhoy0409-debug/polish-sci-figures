"""Original, editable time and composition layouts with explicit data contracts.

Reference chart titles inform coverage, not the artwork or implementation.  Input
tables contain measurements/counts or explicitly supplied fitted values.  No
model, significance claim or confidence interval is inferred from a screenshot.
"""
from __future__ import annotations

import calendar
import textwrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, Normalize, to_rgb
from matplotlib.patches import Rectangle, Wedge
from matplotlib.lines import Line2D
from matplotlib.ticker import MaxNLocator, PercentFormatter

PALETTE = ['#3f6da3', '#c95770', '#93accb', '#69758b', '#b68b56', '#9c83a2']

# Chinese title, English title, gallery category, required fields, numeric fields.
CONTRACTS = {
 'time_mean_sd': ('时间均值与 SD 误差棒','Time means and SD bars','longitudinal','unit group time value','time value'),
 'time_mean_band': ('时间均值与 SD 色带','Time means and SD bands','longitudinal','unit group time value','time value'),
 'time_mean_replicates': ('均值线与全部重复','Mean and replicate trajectories','longitudinal','unit group time value','time value'),
 'time_supplied_fit': ('原始点与拟合曲线','Observations and supplied fit','longitudinal','series role time value','time value'),
 'time_steps': ('阶梯时间曲线','Step time series','longitudinal','series time value','time value'),
 'time_auc_summary': ('个体曲线下面积汇总','Individual time-curve areas','longitudinal','unit group time value','time value'),
 'time_individual_paths': ('个体时间轨迹','Individual trajectories','longitudinal','unit group time value','time value'),
 'time_baseline_change': ('相对基线变化轨迹','Change from baseline','longitudinal','unit group time value','time value'),
 'time_series': ('时间序列','Time series','longitudinal','series time value','time value'),
 'time_moving_average': ('时间序列与移动平均','Time series and moving average','longitudinal','series time value','time value'),
 'time_interrupted': ('中断时间序列结果','Interrupted time-series results','longitudinal','time observed fitted segment','time observed fitted'),
 'time_seasonal': ('年度季节曲线','Seasonal overlay','longitudinal','year month value','year month value'),
 'time_month_matrix': ('年月热图','Year-by-month heatmap','longitudinal','year month value','year month value'),
 'time_epidemic': ('流行曲线','Epidemic curve','longitudinal','date count','count'),
 'time_cumulative': ('累积病例曲线','Cumulative case counts','longitudinal','date count','count'),
 'time_stacked_area': ('组成随时间变化','Stacked time areas','longitudinal','category time value','time value'),
 'time_percent_area': ('组成比例随时间变化','Proportional time areas','longitudinal','category time value','time value'),
 'paired_slope': ('两时点斜率图','Two-time-point slopes','paired','unit before after','before after'),
 'time_small_multiples': ('共享坐标时间分面','Shared-scale time facets','longitudinal','unit group time value','time value'),
 'time_rank_changes': ('排名变化图','Rank changes','longitudinal','item time rank','time rank'),
 'time_swimmer': ('个体随访泳道图','Individual follow-up lanes','longitudinal','unit start end event','start end event'),
 'time_calendar': ('日历热图','Calendar heatmap','longitudinal','date value','value'),
 'category_ranked_bars': ('排序条形图','Ranked category bars','matrix','category value','value'),
 'composition_pie': ('类别组成饼图','Category composition pie','matrix','category count','count'),
 'composition_count_bars': ('组成堆叠条形图','Stacked composition counts','matrix','group category count','count'),
 'composition_percent_bars': ('百分比堆叠条形图','Proportional stacked bars','matrix','group category count','count'),
 'composition_grouped_bars': ('并列组成条形图','Grouped composition bars','matrix','group category count','count'),
 'composition_facets': ('共享坐标组成分面','Shared-scale composition facets','matrix','group category count','count'),
 'composition_mosaic': ('马赛克组成图','Mosaic composition','matrix','group category count','count'),
 'composition_likert': ('发散式有序响应图','Diverging ordered responses','matrix','item response score count','score count'),
 'composition_treemap': ('层级矩形树图','Hierarchical treemap','matrix','parent category count','count'),
 'composition_sunburst': ('层级嵌套环图','Hierarchical sunburst','matrix','parent category count','count'),
 'composition_single_bar': ('单条百分比组成图','Single proportional bar','matrix','category count','count'),
 'composition_pictogram': ('类别点阵计数图','Category dot counts','matrix','category count','count'),
}

NOTES = {
 'time_mean_sd': ('每个时点展示独立对象的均值 ± SD；保留对象编号与组别，不自动进行重复测量检验。','Per-time mean ± SD across independent subjects; retains subject IDs and groups; no repeated-measures test is inferred.'),
 'time_mean_band': ('色带为各时点观测的 ±1 SD，不是均值置信区间。','Bands show ±1 SD of observations at each time; they are not confidence intervals.'),
 'time_mean_replicates': ('细线为每个对象，粗线为组均值；不把重复时点作为独立样本。','Thin lines identify subjects and bold lines group means; repeated time points are not independent samples.'),
 'time_supplied_fit': ('role 为 observed 或 fit；拟合值由用户提供，按 series 匹配原始点；不推算参数或 P 值。','role is observed or fit; fitted values are supplied and matched to observations by series; no parameter or P value is invented.'),
 'time_steps': ('每条线按时间排序，采用右连续阶梯；需确认该规则符合测量含义。','Time-ordered right-continuous steps; verify that this convention matches the measurement.'),
 'time_auc_summary': ('使用梯形法计算每个对象的时间积分；各对象须有相同观测时间网格，显示个体积分与组均值。','Trapezoidal time integral per subject; identical observation grids are required; shows individual areas and group means.'),
 'time_individual_paths': ('连接同一对象的重复观测，保持真实时间间距；组别同时用颜色与线型区分。','Connects repeated observations of each subject at their actual time spacing; colour and line style identify groups.'),
 'time_baseline_change': ('每个对象减去其最早时点数值，显示绝对变化；不自动转成百分比。','Subtracts each subject’s earliest value and shows absolute change, not percentage change.'),
 'time_series': ('按实际时间坐标连线；缺失时间不会被补成零。','Connects observations at their actual time coordinates; missing times are not replaced with zero.'),
 'time_moving_average': ('原始曲线叠加最近 3 次观测的后向平均；首两次不产生平滑值，不推断周期。','Raw values plus a trailing mean of three observations; no smoothed value for the first two observations and no inferred period.'),
 'time_interrupted': ('提供 observed、fitted 和分段 segment；分段边界以竖线显示，不自动估计因果效应。','Supply observed, fitted and segment; boundaries are marked without estimating a causal effect.'),
 'time_seasonal': ('逐年叠加 1–12 月观测，共用数值尺度；缺失月份保留断点。','Overlays months 1–12 for each year on a common scale; missing months remain gaps.'),
 'time_month_matrix': ('年份与月份形成网格，共用连续色标；缺失月份留白。','Year-by-month cells share a continuous colour scale; missing months are blank.'),
 'time_epidemic': ('输入逐日新增病例数；日期需连续，柱高保留真实计数。','Daily incident case counts; dates must be contiguous and bar heights preserve counts.'),
 'time_cumulative': ('输入逐日新增病例数，按日期累加；不得输入已累积的数值。','Input daily incident counts, which are accumulated by date; do not supply already cumulative counts.'),
 'time_stacked_area': ('各类别使用相同时间网格和非负值；显示绝对量，顺序保持一致。','Nonnegative category values on an identical time grid; shows absolute amounts in a consistent order.'),
 'time_percent_area': ('按每个时点总量归一化至 100%；零总量时点不接受。','Normalizes each time-point total to 100%; zero-total time points are not accepted.'),
 'paired_slope': ('每个对象一对同单位数值，以连线显示方向与变化量。','One same-unit value pair per subject; connecting lines show direction and magnitude.'),
 'time_small_multiples': ('每组一个面板，横纵坐标范围保持一致；显示个体轨迹与组均值。','One panel per group with identical x/y ranges; shows subject trajectories and group means.'),
 'time_rank_changes': ('提供已经计算的排名，数值越小名次越靠前；允许并列，不重新定义排名方法。','Supply calculated ranks; smaller values rank higher; ties are allowed and the ranking method is not redefined.'),
 'time_swimmer': ('提供每个对象的随访起止，event 为 0 或 1；终点标记区分事件与删失，不计算生存率。','Subject follow-up start/end and binary event; endpoints distinguish event and censoring without estimating survival.'),
 'time_calendar': ('提供同一年内每日数值，日期与星期位置对应；缺失日期留白。','Daily values within one year, positioned by date and weekday; missing dates remain blank.'),
 'category_ranked_bars': ('按已提供数值排序，允许正负值；条形从零开始。','Sorts supplied values, including signed values; every bar starts at zero.'),
 'composition_pie': ('类别与非负数量；适用于少量类别，图例保留数值和比例。','Categories and nonnegative amounts; best for few categories; legend preserves amount and percentage.'),
 'composition_count_bars': ('组别、类别与非负数量；柱高表示总量，不将不同总量误作相同。','Group, category and nonnegative amount; bar height shows totals without equating unequal totals.'),
 'composition_percent_bars': ('每组归一化至 100%，用于比较组成；总量在标签中保留。','Normalizes each group to 100% for composition comparison; labels retain totals.'),
 'composition_grouped_bars': ('在共同零基线并列显示组别中的各类数量。','Displays category amounts side by side within each group from a common zero baseline.'),
 'composition_facets': ('每组单独显示，所有面板保持相同数量尺度。','One panel per group with identical amount scales.'),
 'composition_mosaic': ('组宽正比于组总量，组内高度正比于类别比例；面积表示数量。','Group widths represent group totals and heights within groups category fractions; tile area represents amount.'),
 'composition_likert': ('提供响应分数和计数；负向在左、正向在右，中性响应跨零线，按项目归一化。','Supply ordered scores and counts; negative responses extend left, positive right, neutral straddles zero; normalized per item.'),
 'composition_treemap': ('两层类别与非负数量；矩形面积严格对应数量，层级通过边框与标题展示。','Two-level categories and nonnegative amounts; rectangle area encodes amount and borders/headers identify hierarchy.'),
 'composition_sunburst': ('提供父类、子类和数量；内外环共享相同角度分配，不通过半径暗示额外数量。','Parent, child and amount; both rings share angular allocation and radius does not imply additional quantity.'),
 'composition_single_bar': ('单条组成归一化至 100%；图例保留各类真实数量。','One bar normalized to 100%; the legend preserves actual category amounts.'),
 'composition_pictogram': ('每个圆点代表 1 个计数，输入必须为非负整数；按类别分行，不进行隐藏的百分比舍入。','One dot represents one count; nonnegative integer input; rows identify categories without hidden percentage rounding.'),
}

SOURCE_MAP = dict(zip(
 [f'C{i:02}' for i in range(1,24)],
 ['time_mean_sd','time_mean_band','time_mean_replicates','time_supplied_fit','time_steps','time_auc_summary','time_individual_paths','time_baseline_change','time_series','time_moving_average','time_interrupted','time_seasonal','time_month_matrix','time_epidemic','time_cumulative','time_stacked_area','time_percent_area','paired_slope','paired_dumbbell','time_small_multiples','time_rank_changes','time_swimmer','time_calendar']))
SOURCE_MAP.update(dict(zip(
 [f'D{i:02}' for i in range(1,16)],
 ['category_ranked_bars','composition_pie','composition_ring','composition_waffle','composition_count_bars','composition_percent_bars','composition_grouped_bars','composition_facets','composition_mosaic','composition_likert','composition_treemap','composition_sunburst','composition_single_bar','composition_pictogram','ternary_composition'])))
PRESERVE_ASPECT = {'composition_pie','composition_treemap','composition_sunburst','composition_mosaic','time_calendar','time_month_matrix','composition_pictogram'}

RAW_TIME = {'time_mean_sd','time_mean_band','time_mean_replicates','time_auc_summary','time_individual_paths','time_baseline_change','time_small_multiples'}
GROUP_COUNTS = {'composition_count_bars','composition_percent_bars','composition_grouped_bars','composition_facets','composition_mosaic'}
COMPATIBLE_GROUPS = [
    RAW_TIME.copy(), GROUP_COUNTS.copy(),
    {'time_series','time_moving_average','time_steps'},
    {'time_seasonal','time_month_matrix'},
    {'time_epidemic','time_cumulative'},
    {'time_stacked_area','time_percent_area'},
    {'paired_slope','paired_dumbbell'},
    {'composition_pie','composition_ring','composition_waffle','composition_single_bar','composition_pictogram'},
    {'composition_treemap','composition_sunburst'},
]

def validate(data, view):
    if view not in CONTRACTS:
        raise ValueError('Unknown time/composition view')
    fields = CONTRACTS[view][3].split(); numeric = CONTRACTS[view][4].split()
    if not set(fields) <= set(data):
        raise ValueError('Required columns: '+', '.join(fields))
    d = data.copy(deep=True)
    if d.empty or d[fields].isna().any().any():
        raise ValueError('Required fields must be nonempty')
    for c in numeric:
        d[c] = pd.to_numeric(d[c], errors='raise')
        if not np.isfinite(d[c]).all():
            raise ValueError(c+' must be finite')
    for c in set(fields)-set(numeric)-{'date'}:
        d[c] = d[c].astype(str)
        if d[c].str.strip().eq('').any() or (d[c].str.len()>48).any():
            raise ValueError('Labels must be nonempty and at most 48 characters')
    if 'date' in fields:
        d['date'] = pd.to_datetime(d.date, errors='raise')
        if d.date.isna().any() or (d.date.dt.normalize()!=d.date).any():
            raise ValueError('Use calendar dates without time-of-day')
        if d.date.dt.tz is not None:
            raise ValueError('Use timezone-free calendar dates')
    for c,n in [('group',4),('series',4),('category',6),('parent',4),('item',8),('segment',4)]:
        if c in fields and d[c].nunique()>n:
            raise ValueError(f'At most {n} {c} labels per panel; use additional panels for more')
    if 'count' in fields and (d['count']<0).any():
        raise ValueError('Counts/amounts must be nonnegative')
    keys = {**{k:['unit','time'] for k in RAW_TIME},
            **{k:['group','category'] for k in GROUP_COUNTS},
            'time_supplied_fit':['series','role','time'],
            'time_steps':['series','time'],'time_series':['series','time'],'time_moving_average':['series','time'],
            'time_interrupted':['time'],'time_seasonal':['year','month'],'time_month_matrix':['year','month'],
            'time_epidemic':['date'],'time_cumulative':['date'],'time_calendar':['date'],
            'time_stacked_area':['category','time'],'time_percent_area':['category','time'],
            'paired_slope':['unit'],'time_rank_changes':['item','time'],'time_swimmer':['unit'],
            'category_ranked_bars':['category'],'composition_pie':['category'],
            'composition_single_bar':['category'],'composition_pictogram':['category'],
            'composition_likert':['item','response'],'composition_treemap':['parent','category'],
            'composition_sunburst':['parent','category']}[view]
    if d.duplicated(keys).any():
        raise ValueError('Duplicate observation keys: '+', '.join(keys))
    if view in RAW_TIME:
        if d.unit.nunique()>36 or d.groupby('unit').group.nunique().gt(1).any():
            raise ValueError('At most 36 subjects; each subject must belong to exactly one group')
        if d.groupby('unit').time.nunique().min()<2:
            raise ValueError('Each subject needs at least two time points')
        if view in {'time_mean_sd','time_mean_band'} and d.groupby(['group','time']).unit.nunique().min()<2:
            raise ValueError('At least two independent subjects per group/time are needed for SD')
        if view=='time_auc_summary':
            grids = d.groupby('unit').time.apply(lambda x: tuple(sorted(x)))
            if len(set(grids))!=1:
                raise ValueError('AUC comparison requires the same observed time grid for all subjects')
        if view=='time_baseline_change' and d.groupby('unit').time.min().nunique()!=1:
            raise ValueError('Baseline-change comparison requires a common baseline time')
    if view=='time_supplied_fit':
        if set(d.role)!={'observed','fit'} or any(set(g.role)!={'observed','fit'} for _,g in d.groupby('series')):
            raise ValueError('Each series requires observed and fit rows')
        if d[d.role=='fit'].groupby('series').time.nunique().min()<2:
            raise ValueError('Each supplied fit requires at least two ordered points')
    if view in {'time_steps','time_series','time_moving_average'} and d.groupby('series').time.nunique().min()<(3 if view=='time_moving_average' else 2):
        raise ValueError('Each series requires enough distinct time points')
    if view=='time_interrupted':
        order = d.sort_values('time'); blocks = order.segment.ne(order.segment.shift()).cumsum()
        if not 2<=d.segment.nunique()<=4 or pd.DataFrame({'segment':order.segment,'block':blocks}).groupby('segment').block.nunique().max()!=1:
            raise ValueError('Provide 2–4 contiguous fitted segments')
        if d.groupby('segment').size().min()<2:
            raise ValueError('Each segment requires at least two time points')
    if view in {'time_seasonal','time_month_matrix'}:
        if not (d.month.between(1,12)&(d.month%1==0)&(d.year%1==0)).all() or d.year.nunique()>6:
            raise ValueError('Use months 1–12, integer years and at most six years')
    if view in {'time_epidemic','time_cumulative'}:
        if not (d['count']%1==0).all() or len(d)>366 or not d.sort_values('date').date.diff().dropna().eq(pd.Timedelta(days=1)).all():
            raise ValueError('Provide up to 366 contiguous daily integer incident counts; insert explicit zeros where known')
    if view=='time_calendar' and d.date.dt.year.nunique()!=1:
        raise ValueError('One calendar year per panel')
    if view in {'time_stacked_area','time_percent_area'}:
        m=d.pivot(index='time',columns='category',values='value')
        if (d.value<0).any() or m.isna().any().any() or len(m)<2 or (m.sum(axis=1)<=0).any():
            raise ValueError('Nonnegative complete category/time grid with positive totals and at least two times required')
    if view=='paired_slope' and len(d)>12:
        raise ValueError('At most 12 paired subjects per slope panel')
    if view=='time_rank_changes':
        m=d.pivot(index='time',columns='item',values='rank')
        if not ((d['rank']>=1)&(d['rank']%1==0)).all() or m.isna().any().any() or not 2<=len(m)<=12:
            raise ValueError('Provide a complete grid of positive integer ranks across 2–12 times')
    if view=='time_swimmer' and (len(d)>16 or (d.end<=d.start).any() or not d.event.isin([0,1]).all()):
        raise ValueError('Up to 16 subjects with end > start and binary event required')
    if view in GROUP_COUNTS:
        if (d.groupby('group')['count'].sum()<=0).any():
            raise ValueError('Each group must have a positive total')
        if d.pivot(index='group',columns='category',values='count').isna().any().any():
            raise ValueError('Provide every group/category count, including explicit zeros; missing values are not inferred')
    if view in {'composition_pie','composition_single_bar','composition_pictogram','composition_treemap','composition_sunburst'} and d['count'].sum()<=0:
        raise ValueError('Composition total must be positive')
    if view in {'composition_treemap','composition_sunburst'} and ((d['count']<=0).any() or len(d)>12):
        raise ValueError('Hierarchy supports at most 12 positive leaf amounts')
    if view=='composition_pictogram' and ((d['count']%1!=0).any() or d['count'].sum()>200):
        raise ValueError('A count pictogram requires integers and at most 200 individual dots')
    if view=='composition_likert':
        if not d.score.isin([-2,-1,0,1,2]).all() or d.groupby('response').score.nunique().gt(1).any() or d.groupby('score').response.nunique().gt(1).any():
            raise ValueError('Use one response name per ordered score from −2 to +2')
        if (d.groupby('item')['count'].sum()<=0).any():
            raise ValueError('Each item requires a positive response total')
        if d.pivot(index='item',columns='score',values='count').isna().any().any():
            raise ValueError('Provide every item/response count, including explicit zeros')
    return d

def _wrap(label, width=15):
    return '\n'.join(textwrap.wrap(str(label),width=width,break_long_words=True))

def _base(figsize, rows=1, cols=1, sharex=False, sharey=False):
    fig,axes=plt.subplots(rows,cols,figsize=figsize,squeeze=False,sharex=sharex,sharey=sharey,layout='constrained')
    fig.get_layout_engine().set(w_pad=.07,h_pad=.07,wspace=.07,hspace=.10)
    for ax in axes.flat:
        ax.spines[['top','right']].set_visible(False)
        ax.tick_params(labelsize=8,length=3,pad=3)
        ax.xaxis.label.set_size(9);ax.yaxis.label.set_size(9)
        ax.xaxis.set_major_locator(MaxNLocator(5));ax.yaxis.set_major_locator(MaxNLocator(5))
    return fig,axes

def _legend(ax, handles=None, labels=None, ncol=2):
    if labels is None:
        handles,labels=ax.get_legend_handles_labels()
    # Long edited labels receive a single column instead of colliding columns.
    longest=max((max(map(len,str(label).splitlines()),default=0) for label in labels),default=0)
    available=ax.figure.get_size_inches()[0]*72-(14 if not ax.axison else 58)
    while ncol>1 and ncol*(longest*4.1+24)>available:ncol-=1
    opts=dict(loc='lower left',bbox_to_anchor=(0,1.02),borderaxespad=0,frameon=False,fontsize=8,ncol=ncol,
              handlelength=1.6,columnspacing=1.1,handletextpad=.5,labelspacing=.4)
    return ax.legend(handles,labels,**opts)

def _light(color, amount=.35):
    return tuple(np.array(to_rgb(color))*amount+(1-amount))

def _date_ticks(ax, dates):
    ids=np.unique(np.linspace(0,len(dates)-1,min(5,len(dates)),dtype=int))
    ax.set_xticks(ids,[dates[i].strftime('%d %b') for i in ids],fontsize=8)

def _time_raw(d, view, colors, figsize):
    groups=list(d.group.unique());facets=view=='time_small_multiples'
    ncols=min(2,len(groups)) if facets else 1;nrows=int(np.ceil(len(groups)/ncols)) if facets else 1
    fig,axes=_base(figsize,nrows,ncols,sharex=facets,sharey=facets)
    if facets:
        for ax in axes.flat[len(groups):]:ax.remove()
    for j,g in enumerate(groups):
        ax=axes.flat[j] if facets else axes.flat[0];sub=d[d.group==g].copy();color=colors[j%len(colors)];ls=['-','--',':','-.'][j%4]
        if view=='time_baseline_change':
            base=sub.sort_values('time').groupby('unit').value.first();sub['value']=sub.value-sub.unit.map(base)
        if view=='time_auc_summary':
            vals=[]
            for _,u in sub.groupby('unit',sort=False):
                u=u.sort_values('time');yv=u.value.to_numpy();xv=u.time.to_numpy();vals.append(np.sum(np.diff(xv)*(yv[:-1]+yv[1:])/2))
            jitter=np.linspace(-.12,.12,len(vals));ax.scatter(j+jitter,vals,s=24,color=color,edgecolors='white',linewidth=.5,zorder=3)
            ax.plot([j-.20,j+.20],[np.mean(vals)]*2,color='#26364a',lw=1.4,zorder=4)
            ax.set_xticks(range(len(groups)),[_wrap(x,12) for x in groups]);ax.set_ylabel('Time-curve area');ax.margins(x=.2)
            continue
        summary=sub.groupby('time').value.agg(['mean','std']).sort_index()
        if view in {'time_individual_paths','time_mean_replicates','time_baseline_change','time_small_multiples'}:
            for _,u in sub.groupby('unit',sort=False):
                u=u.sort_values('time');ax.plot(u.time,u.value,color=color,lw=.8,alpha=.45,linestyle=ls)
        if view=='time_mean_sd':
            ax.errorbar(summary.index,summary['mean'],yerr=summary['std'],fmt=['o-','s--','^:','D-.'][j%4],color=color,lw=1.1,ms=3.5,capsize=2.5,elinewidth=.8,label=_wrap(g,16))
        elif view=='time_mean_band':
            ax.fill_between(summary.index,summary['mean']-summary['std'],summary['mean']+summary['std'],color=color,alpha=.15,linewidth=0)
            ax.plot(summary.index,summary['mean'],color=color,ls=ls,lw=1.5,label=_wrap(g,16))
        elif view!='time_individual_paths':
            ax.plot(summary.index,summary['mean'],color=color,ls=ls,lw=1.7,label=_wrap(g,16))
        else:ax.plot([],[],color=color,ls=ls,label=_wrap(g,16))
        ax.set_xlabel('Time');ax.set_ylabel('Change from baseline' if view=='time_baseline_change' else 'Value');ax.margins(x=.03,y=.12)
        if view=='time_baseline_change':ax.axhline(0,color='#a9b1be',lw=.7,zorder=0)
        if facets:ax.set_title(_wrap(g,18),fontsize=9,loc='left',pad=8)
    if not facets and view!='time_auc_summary':_legend(axes.flat[0],ncol=min(2,len(groups)))
    return fig

def _treemap_rects(values,x=0,y=0,w=1,h=1):
    """Balanced binary split, with exact proportional area and stable order."""
    if len(values)==1:return [(x,y,w,h)]
    total=sum(values);cs=np.cumsum(values);cut=min(range(1,len(values)),key=lambda i:abs(cs[i-1]/total-.5));fraction=cs[cut-1]/total
    if w>=h:
        return _treemap_rects(values[:cut],x,y,w*fraction,h)+_treemap_rects(values[cut:],x+w*fraction,y,w*(1-fraction),h)
    return _treemap_rects(values[:cut],x,y,w,h*fraction)+_treemap_rects(values[cut:],x,y+h*fraction,w,h*(1-fraction))

def render(data, view, colors=None, figsize=(4.8,3.6)):
    d=validate(data,view);colors=list(colors or PALETTE)
    if len(colors)<6:colors=(colors*6)[:6]
    if view in RAW_TIME:return _time_raw(d,view,colors,figsize)
    fig,axes=_base(figsize);ax=axes.flat[0]
    seq=LinearSegmentedColormap.from_list('studio_time_seq',['#f2f4f8',colors[0]])
    if view in {'time_steps','time_series','time_moving_average','time_supplied_fit'}:
        for j,(name,g) in enumerate(d.groupby('series',sort=False)):
            color=colors[j];g=g.sort_values('time');ls=['-','--',':','-.'][j]
            if view=='time_supplied_fit':
                obs=g[g.role=='observed'];fit=g[g.role=='fit'];ax.scatter(obs.time,obs.value,s=19,color=color,alpha=.6,edgecolors='white',linewidth=.4)
                ax.plot(fit.time,fit.value,color=color,ls=ls,lw=1.5,label=_wrap(name,16))
            elif view=='time_moving_average':
                ax.plot(g.time,g.value,color=color,lw=.65,alpha=.35)
                ax.plot(g.time,g.value.rolling(3,min_periods=3).mean(),color=color,ls=ls,lw=1.5,label=_wrap(name,16))
            else:ax.plot(g.time,g.value,color=color,lw=1.4,ls=ls,label=_wrap(name,16),drawstyle='steps-post' if view=='time_steps' else 'default')
        ax.set_xlabel('Time');ax.set_ylabel('Value');ax.margins(x=.03,y=.12);_legend(ax)
        if view=='time_moving_average':ax.set_title('Trailing mean: 3 observations',fontsize=8,loc='left',pad=36)
    elif view=='time_interrupted':
        d=d.sort_values('time');ax.scatter(d.time,d.observed,s=17,color='#8c98aa',alpha=.7,label='Observed')
        for j,(segment,g) in enumerate(d.groupby('segment',sort=False)):
            ax.plot(g.time,g.fitted,color=colors[j],lw=1.8,label=_wrap(segment,14))
            if j:ax.axvline(g.time.min(),color='#a6afbc',ls='--',lw=.8)
        ax.set_xlabel('Time');ax.set_ylabel('Outcome');ax.margins(x=.04,y=.14);_legend(ax)
    elif view in {'time_seasonal','time_month_matrix'}:
        m=d.pivot(index='year',columns='month',values='value').sort_index().reindex(columns=range(1,13))
        if view=='time_seasonal':
            for j,(year,row) in enumerate(m.iterrows()):ax.plot(range(1,13),row,color=colors[j],ls=['-','--',':','-.','-','--'][j],lw=1.4,label=str(int(year)))
            ax.set_xticks([1,3,5,7,9,11],['Jan','Mar','May','Jul','Sep','Nov']);ax.set_ylabel('Value');_legend(ax,ncol=3)
        else:
            mesh=ax.pcolormesh(np.arange(13),np.arange(len(m)+1),m,cmap=seq,edgecolors='white',linewidth=.8,rasterized=False)
            from gallery_heatmap import cell_values
            cell_values(ax,m.to_numpy(),mesh,x0=0,y0=0)
            ax.set_xticks(np.arange(12)+.5,[str(i) for i in range(1,13)]);ax.set_xlabel('Month');ax.set_yticks(np.arange(len(m))+.5,[str(int(y)) for y in m.index]);ax.invert_yaxis();ax.tick_params(length=0);ax.spines[:].set_visible(False)
            cb=fig.colorbar(mesh,ax=ax,orientation='horizontal',fraction=.065,pad=.12,aspect=30);cb.set_label('Value',fontsize=8);cb.ax.tick_params(labelsize=8);cb.solids.set_rasterized(False)
    elif view in {'time_epidemic','time_cumulative'}:
        d=d.sort_values('date');x=np.arange(len(d))
        if view=='time_epidemic':ax.bar(x,d['count'],color=colors[0],width=.92,linewidth=0);ax.set_ylabel('Incident cases')
        else:ax.step(x,d['count'].cumsum(),where='post',color=colors[0],lw=1.6);ax.set_ylabel('Cumulative cases')
        _date_ticks(ax,list(d.date));ax.set_xlabel('Date');ax.set_ylim(bottom=0);ax.yaxis.set_major_locator(MaxNLocator(5,integer=True));ax.margins(x=.02)
    elif view in {'time_stacked_area','time_percent_area'}:
        categories=list(d.category.unique());m=d.pivot(index='time',columns='category',values='value')[categories].sort_index()
        if view=='time_percent_area':m=m.div(m.sum(axis=1),axis=0)*100
        ax.stackplot(m.index,m.to_numpy().T,labels=[_wrap(c,15) for c in categories],colors=colors[:len(categories)],alpha=.8,linewidth=.6,edgecolor='white')
        ax.set_xlabel('Time');ax.set_ylabel('Proportion (%)' if view=='time_percent_area' else 'Amount');ax.margins(x=0,y=0)
        if view=='time_percent_area':ax.set_ylim(0,100)
        _legend(ax,ncol=2)
    elif view=='paired_slope':
        increase=d.after>=d.before
        for i,row in enumerate(d.itertuples(index=False)):
            color=colors[1] if increase.iloc[i] else colors[0]
            ax.plot([0,1],[row.before,row.after],color=color,lw=1.0,alpha=.7,marker='o',ms=3.5)
        ax.set_xticks([0,1],['Before','After']);ax.set_xlim(-.2,1.2);ax.set_ylabel('Value');ax.margins(y=.12)
        _legend(ax,[Line2D([],[],color=colors[1],marker='o',ms=3),Line2D([],[],color=colors[0],marker='o',ms=3)],['Increase / unchanged','Decrease'],ncol=1)
    elif view=='time_rank_changes':
        for j,(item,g) in enumerate(d.groupby('item',sort=False)):
            g=g.sort_values('time');ax.plot(g.time,g['rank'],color=colors[j%6],marker=['o','s','^','D','v','P','X','*'][j],ms=4,lw=1.2,ls='--' if j>=6 else '-',label=_wrap(item,14))
        ax.set_xlabel('Time');ax.set_ylabel('Rank');ax.set_xticks(sorted(d.time.unique())[::max(1,int(np.ceil(d.time.nunique()/6)))]);ax.yaxis.set_major_locator(MaxNLocator(integer=True));ax.set_ylim(d['rank'].max()+.4,.6);ax.margins(x=.06);_legend(ax,ncol=2)
    elif view=='time_swimmer':
        d=d.sort_values('end',ascending=False);yy=np.arange(len(d))
        ax.barh(yy,d.end-d.start,left=d.start,height=.48,color=_light(colors[0],.55),edgecolor='none')
        for y,row in zip(yy,d.itertuples(index=False)):ax.plot(row.end,y,'o' if row.event else '|',color=colors[1] if row.event else '#33445b',ms=4 if row.event else 8,mew=1.2)
        ax.set_yticks(yy,[_wrap(x,14) for x in d.unit]);ax.invert_yaxis();ax.set_xlabel('Follow-up time');ax.margins(x=.06,y=.08)
        _legend(ax,[Line2D([],[],marker='o',color=colors[1],ls='',ms=4),Line2D([],[],marker='|',color='#33445b',ls='',ms=8)],['Event','Censored'])
    elif view=='time_calendar':
        # Reflow complete months while preserving square day cells.
        ratio=figsize[0]/figsize[1];cols=3 if ratio<.9 else (6 if ratio>2.2 else 4)
        plt.close(fig);fig,axes=_base(figsize,12//cols,cols,sharex=True,sharey=True)
        year=int(d.date.dt.year.iloc[0]);lookup=dict(zip(d.date.dt.date,d.value));norm=Normalize(float(d.value.min()),float(d.value.max()) if d.value.max()!=d.value.min() else float(d.value.min())+1)
        fig.suptitle(str(year),fontsize=9,x=.05,ha='left')
        for month,a in enumerate(axes.flat,1):
            a.set_title(calendar.month_abbr[month],fontsize=8,loc='left',pad=2)
            a.set(xlim=(0,7),ylim=(6,0));a.set_aspect('equal');a.axis('off')
            weeks=calendar.Calendar(firstweekday=0).monthdatescalendar(year,month)
            for week,days in enumerate(weeks):
                for weekday,date in enumerate(days):
                    if date.month!=month:continue
                    val=lookup.get(date);a.add_patch(Rectangle((weekday+.03,week+.03),.94,.94,facecolor=seq(norm(val)) if val is not None else '#f1f2f5',edgecolor='white',lw=.3))
                    if val is not None:
                        from gallery_heatmap import cell_values
                        cell_values(a,[[val]],plt.cm.ScalarMappable(norm=norm,cmap=seq),decimals=0,x0=weekday+.03,y0=week+.03,cell_width=.94,cell_height=.94)
        cb=fig.colorbar(plt.cm.ScalarMappable(norm=norm,cmap=seq),ax=list(axes.flat),orientation='horizontal',fraction=.045,pad=.035,aspect=35);cb.set_label('Daily value · Monday → Sunday',fontsize=8);cb.ax.tick_params(labelsize=8);cb.solids.set_rasterized(False)
    elif view=='category_ranked_bars':
        d=d.sort_values('value');ax.barh(np.arange(len(d)),d.value,color=[colors[1] if x<0 else colors[0] for x in d.value],height=.60)
        ax.set_yticks(range(len(d)),[_wrap(x,16) for x in d.category]);ax.axvline(0,color='#59677b',lw=.6);ax.set_xlabel('Value');ax.margins(x=.12,y=.12)
    elif view in {'composition_pie','composition_single_bar','composition_pictogram'}:
        total=d['count'].sum();labels=[f'{_wrap(r.category,16)} · {r.count:g} ({r.count/total:.0%})' for r in d.itertuples(index=False)]
        if view=='composition_pie':
            wedges,_=ax.pie(d['count'],colors=colors[:len(d)],startangle=90,counterclock=False,wedgeprops={'linewidth':1.1,'edgecolor':'white'})
            ax.set_aspect('equal');_legend(ax,wedges,labels,ncol=1 if figsize[0]<4 else 2)
        elif view=='composition_single_bar':
            left=0;handles=[]
            for j,row in enumerate(d.itertuples(index=False)):
                pct=row.count/total*100;ax.barh(0,pct,left=left,height=.32,color=colors[j],edgecolor='white',lw=1);left+=pct;handles.append(Rectangle((0,0),1,1,fc=colors[j]))
            ax.set(xlim=(0,100),ylim=(-.85,.85),yticks=[],xlabel='Proportion (%)');ax.spines[['left','top','right']].set_visible(False);_legend(ax,handles,labels,ncol=1 if figsize[0]<4 else 2)
        else:
            max_count=int(d['count'].max());per_row=max(8,min(16,max_count));block=max(1,int(np.ceil(max_count/per_row)))+.75
            for j,row in enumerate(d.itertuples(index=False)):
                n=int(row.count);ids=np.arange(n);ax.scatter(ids%per_row,-j*block-ids//per_row,s=18,color=colors[j],edgecolor='none')
            ax.set_yticks([-j*block for j in range(len(d))],[_wrap(f'{r.category} ({r.count:g})',18) for r in d.itertuples(index=False)]);ax.set_xticks([]);ax.spines[:].set_visible(False);ax.tick_params(length=0);ax.set_title('One dot = one count',fontsize=8,loc='left',pad=10);ax.set_aspect('equal');ax.margins(x=.06,y=.13)
    elif view in GROUP_COUNTS:
        groups=list(d.group.unique());cats=list(d.category.unique());m=d.pivot(index='group',columns='category',values='count').reindex(index=groups,columns=cats).fillna(0)
        if view=='composition_facets':
            plt.close(fig);cols=min(2,len(groups));fig,axes=_base(figsize,int(np.ceil(len(groups)/cols)),cols,sharex=True)
            for a in axes.flat[len(groups):]:a.remove()
            for (group,row),a in zip(m.iterrows(),axes.flat):
                a.barh(range(len(cats)),row,color=colors[:len(cats)],height=.64);a.set_yticks(range(len(cats)),[_wrap(c,12) for c in cats]);a.invert_yaxis();a.set_xlim(0,m.to_numpy().max()*1.12);a.set_title(_wrap(group,16),fontsize=9,loc='left');a.set_xlabel('Amount')
        elif view=='composition_mosaic':
            left=0;total=m.to_numpy().sum();handles=[Rectangle((0,0),1,1,fc=colors[j]) for j in range(len(cats))];centers=[]
            for group,row in m.iterrows():
                width=row.sum()/total;bottom=0;centers.append(left+width/2)
                for j,count in enumerate(row):
                    height=count/row.sum();ax.add_patch(Rectangle((left,bottom),width,height,fc=colors[j],ec='white',lw=1.3));bottom+=height
                left+=width
            ax.set(xlim=(0,1),ylim=(0,1),ylabel='Within-group proportion');ax.set_xticks(centers,[_wrap(g,11) for g in groups]);ax.yaxis.set_major_formatter(PercentFormatter(1));_legend(ax,handles,[_wrap(c,14) for c in cats],ncol=2)
        else:
            y=np.arange(len(groups));base=np.zeros(len(groups));percent=view=='composition_percent_bars';vals=m.div(m.sum(axis=1),axis=0)*100 if percent else m
            for j,c in enumerate(cats):
                if view=='composition_grouped_bars':ax.barh(y+(j-(len(cats)-1)/2)*(.76/len(cats)),vals[c],height=.70/len(cats),color=colors[j],label=_wrap(c,15))
                else:ax.barh(y,vals[c],left=base,height=.60,color=colors[j],edgecolor='white',lw=.6,label=_wrap(c,15));base+=vals[c].to_numpy()
            labels=[_wrap(f'{g} · total {m.loc[g].sum():g}' if percent else g,18) for g in groups]
            ax.set_yticks(y,labels);ax.invert_yaxis();ax.set_xlabel('Proportion (%)' if percent else 'Amount');ax.margins(y=.13);_legend(ax,ncol=2)
            if percent:ax.set_xlim(0,100)
    elif view=='composition_likert':
        items=list(d.item.unique());scores=sorted(d.score.unique());m=d.pivot(index='item',columns='score',values='count').reindex(index=items,columns=[-2,-1,0,1,2]).fillna(0);p=m.div(m.sum(axis=1),axis=0)*100
        cs={-2:colors[0],-1:_light(colors[0],.48),0:'#d9dfe8',1:_light(colors[1],.50),2:colors[1]};y=np.arange(len(items));names=d.drop_duplicates('score').set_index('score').response
        neutral=p[0]/2;ax.barh(y,p[0],left=-neutral,color=cs[0],height=.58,ec='white',lw=.5)
        left=-neutral.copy();right=neutral.copy()
        for s in [-1,-2]:ax.barh(y,p[s],left=left-p[s],color=cs[s],height=.58,ec='white',lw=.5);left-=p[s]
        for s in [1,2]:ax.barh(y,p[s],left=right,color=cs[s],height=.58,ec='white',lw=.5);right+=p[s]
        ax.set_yticks(y,[_wrap(i,15) for i in items]);ax.invert_yaxis();ax.axvline(0,color='#67758a',lw=.7);ax.set_xlabel('Response proportion (%)');ax.set_xlim(-100,100);ax.set_xticks([-100,-50,0,50,100],['100','50','0','50','100']);ax.margins(y=.12)
        _legend(ax,[Rectangle((0,0),1,1,fc=cs[s]) for s in scores],[_wrap(names[s],16) for s in scores],ncol=2)
    elif view in {'composition_treemap','composition_sunburst'}:
        parents=list(d.parent.unique());totals=d.groupby('parent',sort=False)['count'].sum();labels=[];handles=[]
        if view=='composition_treemap':
            outer=_treemap_rects(totals.tolist())
            for j,(parent,rect) in enumerate(zip(parents,outer)):
                sub=d[d.parent==parent];x,y,w,h=rect
                # A labelled key identifies small rectangles without shrinking text.
                for k,(row,leaf) in enumerate(zip(sub.itertuples(index=False),_treemap_rects(sub['count'].tolist(),x,y,w,h))):
                    xx,yy,ww,hh=leaf;index=len(labels)+1;color=_light(colors[j],.48+.45*(k+1)/len(sub));ax.add_patch(Rectangle((xx,yy),ww,hh,fc=color,ec='white',lw=1.1))
                    if ww>.11 and hh>.12:ax.text(xx+ww/2,yy+hh/2,str(index),ha='center',va='center',fontsize=8,color='#24374f')
                    labels.append(_wrap(f'{index}. {parent} / {row.category}',24));handles.append(Rectangle((0,0),1,1,fc=color))
                ax.add_patch(Rectangle((x,y),w,h,fill=False,ec='#fff',lw=2.8))
            ax.set(xlim=(0,1),ylim=(0,1));ax.set_aspect('equal');ax.axis('off')
        else:
            angle=90;total=totals.sum()
            for j,parent in enumerate(parents):
                sub=d[d.parent==parent];span=float(totals[parent]/total*360)
                ax.add_patch(Wedge((0,0),.58,angle-span,angle,width=.27,fc=colors[j],ec='white',lw=1.2));mid=np.deg2rad(angle-span/2)
                childangle=angle
                for k,row in enumerate(sub.itertuples(index=False)):
                    s=row.count/total*360;color=_light(colors[j],.45+.5*(k+1)/len(sub));ax.add_patch(Wedge((0,0),1,childangle-s,childangle,width=.36,fc=color,ec='white',lw=1.1));index=len(labels)+1;mid=np.deg2rad(childangle-s/2)
                    if s>16:ax.text(.82*np.cos(mid),.82*np.sin(mid),str(index),ha='center',va='center',fontsize=8,color='#24374f')
                    labels.append(_wrap(f'{index}. {parent} / {row.category}',24));handles.append(Rectangle((0,0),1,1,fc=color));childangle-=s
                angle-=span
            ax.set(xlim=(-1.08,1.08),ylim=(-1.08,1.08));ax.set_aspect('equal');ax.axis('off')
        # A dedicated legend below leaves every vector tile intact.
        _legend(ax,handles,labels,ncol=2 if len(labels)>4 else 1)
    return fig

def fixtures():
    rng=np.random.default_rng(4823);out={};rows=[]
    for j,group in enumerate(['Control','Treatment']):
        for unit in range(6):
            shift=rng.normal(0,.4)
            for t in [0,2,4,6,8]:rows.append([f'{group[:1]}{unit+1}',group,t,10+shift+t*(.65-.34*j)+rng.normal(0,.35)])
    raw=pd.DataFrame(rows,columns=['unit','group','time','value'])
    for key in RAW_TIME:out[key]=raw.copy()
    x=np.linspace(0,8,60);out['time_supplied_fit']=pd.DataFrame([['Series A','fit',t,12/(1+np.exp(-(t-4)))+1] for t in x]+[['Series A','observed',t,12/(1+np.exp(-(t-4)))+1+rng.normal(0,.35)] for t in np.linspace(0,8,12)],columns=['series','role','time','value'])
    times=np.arange(24);simple=pd.DataFrame([[name,t,float(8+j*2+.12*t+np.sin(t/2)+rng.normal(0,.25))] for j,name in enumerate(['Series A','Series B']) for t in times],columns=['series','time','value'])
    for key in ['time_steps','time_series','time_moving_average']:out[key]=simple.copy()
    times=np.arange(30);fitted=np.where(times<15,10+.15*times,10+.15*15-2-.08*(times-15));out['time_interrupted']=pd.DataFrame({'time':times,'observed':fitted+rng.normal(0,.45,30),'fitted':fitted,'segment':np.where(times<15,'Before','After')})
    seasonal=pd.DataFrame([[year,month,10+(year-2022)*.8+3*np.sin((month-2)/12*2*np.pi)+rng.normal(0,.25)] for year in [2022,2023,2024] for month in range(1,13)],columns=['year','month','value'])
    out['time_seasonal']=seasonal;out['time_month_matrix']=seasonal.copy()
    dates=pd.date_range('2024-02-01',periods=42);counts=rng.poisson(2+18*np.exp(-.5*((np.arange(42)-18)/6)**2));incident=pd.DataFrame({'date':dates.strftime('%Y-%m-%d'),'count':counts})
    out['time_epidemic']=incident;out['time_cumulative']=incident.copy()
    area=pd.DataFrame([[c,t,float(12+4*j+3*np.sin(t/3+j)+t*(.3+.1*j))] for j,c in enumerate(['Type A','Type B','Type C']) for t in range(12)],columns=['category','time','value'])
    out['time_stacked_area']=area;out['time_percent_area']=area.copy()
    out['paired_slope']=pd.DataFrame({'unit':[f'S{i+1}' for i in range(8)],'before':rng.normal(10,1,8),'after':rng.normal(11,1,8)})
    rankings=[[1,3,2,4],[2,1,4,3],[2,3,1,4],[1,2,4,3]];out['time_rank_changes']=pd.DataFrame([[f'Item {j+1}',t+1,rankings[t][j]] for t in range(4) for j in range(4)],columns=['item','time','rank'])
    out['time_swimmer']=pd.DataFrame({'unit':[f'Patient {i+1}' for i in range(8)],'start':[0]*8,'end':[5,9,12,15,18,22,25,28],'event':[1,0,1,1,0,0,1,0]})
    dates=pd.date_range('2024-01-01','2024-12-31');out['time_calendar']=pd.DataFrame({'date':dates.strftime('%Y-%m-%d'),'value':rng.poisson(5+3*np.sin(np.arange(len(dates))/40))})
    out['category_ranked_bars']=pd.DataFrame({'category':['Feature A','Feature B','Feature C','Feature D','Feature E'],'value':[4.2,2.8,1.6,-.8,-1.7]})
    single=pd.DataFrame({'category':['Type A','Type B','Type C','Type D'],'count':[38,27,16,9]})
    for key in ['composition_pie','composition_single_bar','composition_pictogram']:out[key]=single.copy()
    groupcounts=pd.DataFrame([[g,c,v] for g,vals in zip(['Control','Treatment','Rescue'],[[38,22,15],[19,34,25],[30,28,18]]) for c,v in zip(['Type A','Type B','Type C'],vals)],columns=['group','category','count'])
    for key in GROUP_COUNTS:out[key]=groupcounts.copy()
    out['composition_likert']=pd.DataFrame([[item,r,s,c] for item,counts in zip(['Clarity','Ease of use','Confidence','Efficiency'],[[4,10,20,35,31],[8,12,12,40,28],[5,15,25,35,20],[3,7,17,40,33]]) for r,s,c in zip(['Strongly disagree','Disagree','Neutral','Agree','Strongly agree'],[-2,-1,0,1,2],counts)],columns=['item','response','score','count'])
    hierarchy=pd.DataFrame({'parent':['Domain A']*3+['Domain B']*2+['Domain C'],'category':['A1','A2','A3','B1','B2','C1'],'count':[24,17,9,21,14,15]})
    out['composition_treemap']=hierarchy;out['composition_sunburst']=hierarchy.copy()
    assert set(out)==set(CONTRACTS)
    return out
