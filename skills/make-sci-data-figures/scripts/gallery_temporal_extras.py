"""Editable advanced temporal/monitoring layouts from explicit result tables.

This renderer does not fit pharmacokinetic, seasonal, control-chart, funnel or
ecological models. Supplied results retain their units and statistical meaning.
"""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.ticker import MaxNLocator, PercentFormatter
from gallery_time_composition import _base, _legend, _wrap, PALETTE

CONTRACTS={
 'time_stl_components':('加性 STL 分解结果','Additive STL decomposition results','longitudinal','time observed trend seasonal remainder','time observed trend seasonal remainder'),
 'time_pk_target':('游离药物浓度与 MIC','Free-drug concentration and MIC','longitudinal','time free_concentration mic ft_fraction','time free_concentration mic ft_fraction'),
 'time_mutant_window':('浓度与突变选择窗','Concentration and mutant-selection window','longitudinal','time concentration mic mpc','time concentration mic mpc'),
 'control_u_results':('单位缺陷数 u 控制图','u control-chart results','longitudinal','sample rate center lower upper','rate center lower upper'),
 'institution_funnel':('机构比较漏斗图','Institutional comparison funnel','effect','site volume rate expected lower upper','volume rate expected lower upper'),
 'lorenz_curve':('Lorenz 累积分布图','Lorenz cumulative share','distribution','group population_share cumulative_share','population_share cumulative_share'),
 'rank_abundance':('秩丰度曲线','Rank–abundance curves','omics','group rank abundance','rank abundance'),
 'hill_diversity':('Hill 多样性谱','Hill diversity profiles','omics','group order diversity','order diversity'),
 'control_cusum_results':('双侧 CUSUM 监测结果','Two-sided CUSUM results','longitudinal','time upper_cusum lower_cusum upper_limit lower_limit','time upper_cusum lower_cusum upper_limit lower_limit'),
}
NOTES={
 'time_stl_components':('提供已计算的加性 STL 分量；观测值必须等于趋势、季节项与余项之和，不在绘图时重新拟合。','Supply calculated additive STL components; observed must equal trend + seasonal + remainder; plotting does not refit the decomposition.'),
 'time_pk_target':('提供游离浓度、同单位 MIC 和已计算的 fT>MIC 比例；图形不代替药代模型或从稀疏点推断达标时间。','Supply free concentrations, same-unit MIC and an already calculated fT>MIC fraction; the chart does not replace a pharmacokinetic model or infer time above MIC from sparse points.'),
 'time_mutant_window':('浓度、MIC 与 MPC 必须同单位且大于零，MPC > MIC；色带仅表示用户给定的阈值区间。','Concentration, MIC and MPC must be positive and use the same unit, with MPC > MIC; shading displays the supplied threshold interval.'),
 'control_u_results':('提供按检验量校准的单位缺陷率、中心线与控制界限；界限可随样本量变化，不把其称为置信区间。','Supply defects per inspection unit, centre and control limits; limits may vary with inspection volume and are not labelled confidence intervals.'),
 'institution_funnel':('提供机构样本量、比例及同方法计算的期望值和漏斗界限；不把排序或越界直接解释为质量优劣。','Supply institutional volumes, rates and consistently calculated expectations/funnel limits; rank or limit crossing alone does not establish quality.'),
 'lorenz_curve':('提供按同一非负指标排序的累积人口与总量份额，须包含 (0,0) 和 (1,1)；保留完整累积定义。','Supply cumulative population and outcome shares sorted by one nonnegative measure, including (0,0) and (1,1).'),
 'rank_abundance':('提供每组按丰度递减排列的正值与名次；纵轴使用对数尺度，不由此自动判断群落差异。','Supply positive abundances in decreasing rank order per group; the y axis is logarithmic and does not itself establish community differences.'),
 'hill_diversity':('提供已计算的多样性阶数与有效物种数，保持估计方法及抽样标准一致；不从图形反推置信区间。','Supply calculated diversity orders and effective species numbers under consistent estimation/sampling conventions; no confidence interval is inferred.'),
 'control_cusum_results':('提供已经标准化或校准的双侧累积和与决策界限；下侧累计采用负号，参数由原分析确定。','Supply calibrated two-sided cumulative sums and decision limits; lower CUSUM values use a negative sign, with parameters determined by the original analysis.'),
}
REFERENCE_MAP={53:'time_stl_components',55:'time_pk_target',56:'time_mutant_window',64:'control_u_results',75:'institution_funnel',87:'lorenz_curve',91:'rank_abundance',92:'hill_diversity',96:'control_cusum_results'}
SOURCE_MAP={}
PRESERVE_ASPECT={'lorenz_curve'}
COMPATIBLE_GROUPS=[]


def validate(data,view):
    if view not in CONTRACTS:raise ValueError('Unknown temporal result view')
    required=CONTRACTS[view][3].split();numeric=CONTRACTS[view][4].split()
    if not set(required)<=set(data):raise ValueError('Required columns: '+', '.join(required))
    d=data.copy(deep=True)
    if d.empty or d[required].isna().any().any():raise ValueError('Required fields cannot be empty')
    for field in numeric:
        d[field]=pd.to_numeric(d[field],errors='raise')
        if not np.isfinite(d[field]).all():raise ValueError(field+' must be finite')
    for field in set(required)-set(numeric):
        d[field]=d[field].astype(str)
        if d[field].str.strip().eq('').any() or d[field].str.len().gt(48).any():raise ValueError('Labels must be nonempty and at most 48 characters')
    if 'group' in d and d.group.nunique()>4:raise ValueError('At most four groups per panel')
    keys={'control_u_results':['sample'],'institution_funnel':['site'],'lorenz_curve':['group','population_share'],'rank_abundance':['group','rank'],'hill_diversity':['group','order']}.get(view,['time'])
    if d.duplicated(keys).any():raise ValueError('Duplicate observation keys: '+', '.join(keys))
    if len(d)<3:raise ValueError('At least three observations/result points required')
    if view=='time_stl_components' and not np.allclose(d.observed,d.trend+d.seasonal+d.remainder,rtol=1e-5,atol=1e-7):raise ValueError('Additive components must reconstruct the observed series')
    if view in {'time_pk_target','time_mutant_window'}:
        c='free_concentration' if view=='time_pk_target' else 'concentration'
        if (d[c]<0).any() or (d.mic<=0).any() or d.mic.nunique()!=1 or (d.time<0).any():raise ValueError('Nonnegative time/concentration and one positive same-unit MIC required')
        if view=='time_pk_target' and (not d.ft_fraction.between(0,1).all() or d.ft_fraction.nunique()!=1):raise ValueError('Supply one fT>MIC fraction between 0 and 1')
        if view=='time_mutant_window' and ((d.concentration<=0).any() or (d.mpc<=d.mic).any() or d.mpc.nunique()!=1):raise ValueError('Positive concentration and one MPC greater than MIC required for the logarithmic plot')
    if view=='control_u_results' and ((d[['rate','center','lower','upper']]<0).any().any() or (d.lower>d.center).any() or (d.center>d.upper).any()):raise ValueError('Nonnegative rates and lower ≤ center ≤ upper required')
    if view=='institution_funnel':
        if (d.volume<=0).any() or not d[['rate','expected','lower','upper']].apply(lambda x:x.between(0,1)).all().all() or (d.lower>d.expected).any() or (d.expected>d.upper).any():raise ValueError('Positive volumes and proportions with lower ≤ expected ≤ upper required')
        if d.groupby('volume')[['expected','lower','upper']].nunique().to_numpy().max()>1:raise ValueError('Equal volumes require identical supplied funnel limits; use separate panels for different reference populations')
    if view=='lorenz_curve':
        for _,q in d.groupby('group'):
            q=q.sort_values('population_share')
            if not q[['population_share','cumulative_share']].apply(lambda x:x.between(0,1)).all().all() or (q.cumulative_share>q.population_share+1e-8).any() or (q.cumulative_share.diff().dropna()<-1e-8).any() or not np.allclose(q[['population_share','cumulative_share']].iloc[[0,-1]],[[0,0],[1,1]]):raise ValueError('Lorenz shares must increase from (0,0) to (1,1) and remain below equality')
    if view=='rank_abundance':
        if (d.abundance<=0).any() or (d['rank']<1).any() or (d['rank']%1!=0).any():raise ValueError('Positive abundances and positive integer ranks required')
        if any(q.sort_values('rank').abundance.diff().dropna().gt(1e-10).any() for _,q in d.groupby('group')):raise ValueError('Abundance must be nonincreasing with rank')
    if view=='hill_diversity':
        if (d.order<0).any() or (d.diversity<1-1e-8).any():raise ValueError('Nonnegative order and at least one effective species required')
        if any(q.sort_values('order').diversity.diff().dropna().gt(1e-7).any() for _,q in d.groupby('group')):raise ValueError('Hill diversity must be nonincreasing with order')
    if view=='control_cusum_results' and ((d.upper_cusum<0).any() or (d.lower_cusum>0).any() or (d.upper_limit<=0).any() or (d.lower_limit>=0).any()):raise ValueError('Upper CUSUM/limits must be nonnegative/positive; lower CUSUM/limits nonpositive/negative')
    return d


def render(data,view,colors=None,figsize=(4.8,3.6)):
    d=validate(data,view);colors=list(colors or PALETTE)
    if len(colors)<4:colors=(colors*4)[:4]
    if view=='time_stl_components':
        fig,axes=_base(figsize,4,1,sharex=True);q=d.sort_values('time')
        for i,(field,label) in enumerate([('observed','Observed'),('trend','Trend'),('seasonal','Seasonal'),('remainder','Residual')]):
            ax=axes.flat[i];ax.plot(q.time,q[field],color=colors[0] if i<2 else colors[1],lw=1.1);ax.set_ylabel(label,fontsize=8);ax.yaxis.set_major_locator(MaxNLocator(3));ax.margins(x=.02,y=.15)
            if i>=2:ax.axhline(0,color='#c1c9d4',lw=.6,zorder=0)
        axes.flat[-1].set_xlabel('Time');return fig
    fig,axes=_base(figsize);ax=axes.flat[0]
    if view=='time_pk_target':
        q=d.sort_values('time');mic=float(q.mic.iloc[0]);ax.plot(q.time,q.free_concentration,color=colors[0],lw=1.6,label='Free concentration');ax.axhline(mic,color=colors[1],ls='--',lw=1.1,label='MIC')
        ax.fill_between(q.time,mic,q.free_concentration,where=q.free_concentration>=mic,interpolate=True,color=colors[0],alpha=.15,linewidth=0)
        ax.set_xlabel('Time');ax.set_ylabel('Free concentration');ax.set_ylim(bottom=0);ax.margins(x=.02,y=.10);_legend(ax)
        ax.text(.97,.95,f'Supplied fT > MIC: {q.ft_fraction.iloc[0]:.0%}',transform=ax.transAxes,ha='right',va='top',fontsize=8,bbox={'fc':'white','ec':'none','alpha':.9,'pad':2})
    elif view=='time_mutant_window':
        q=d.sort_values('time');mic=float(q.mic.iloc[0]);mpc=float(q.mpc.iloc[0]);ax.axhspan(mic,mpc,color=colors[1],alpha=.12,label='Selection window');ax.plot(q.time,q.concentration,color=colors[0],lw=1.6,label='Concentration')
        ax.axhline(mic,color=colors[1],ls='--',lw=.9);ax.axhline(mpc,color=colors[1],ls=':',lw=.9);ax.set_yscale('log');ax.set_xlabel('Time');ax.set_ylabel('Concentration (log scale)');ax.margins(x=.02,y=.18);_legend(ax)
        ax.text(.98,mic,'MIC',transform=ax.get_yaxis_transform(),ha='right',va='bottom',fontsize=8,color=colors[1],bbox={'fc':'white','ec':'none','pad':1});ax.text(.98,mpc,'MPC',transform=ax.get_yaxis_transform(),ha='right',va='bottom',fontsize=8,color=colors[1],bbox={'fc':'white','ec':'none','pad':1})
    elif view=='control_u_results':
        x=np.arange(len(d));ax.fill_between(x,d.lower,d.upper,color='#edf0f5',linewidth=0);ax.plot(x,d.rate,'o-',color=colors[0],ms=3,lw=1.2,label='Observed rate');ax.plot(x,d.center,color='#69768a',lw=1.0,label='Centre')
        ax.plot(x,d.lower,color=colors[1],ls='--',lw=.9,label='Control limits');ax.plot(x,d.upper,color=colors[1],ls='--',lw=.9)
        ids=np.unique(np.linspace(0,len(d)-1,min(6,len(d)),dtype=int));ax.set_xticks(ids,[_wrap(d.iloc[i]['sample'],10) for i in ids]);ax.set_ylabel('Defects per inspection unit');ax.set_ylim(bottom=0);ax.margins(x=.02,y=.12);_legend(ax)
    elif view=='institution_funnel':
        q=d.sort_values('volume');ax.fill_between(q.volume,q.lower,q.upper,color='#edf0f5',linewidth=0);ax.plot(q.volume,q.lower,color='#98a5b7',ls='--',lw=1,label='Supplied limits');ax.plot(q.volume,q.upper,color='#98a5b7',ls='--',lw=1);ax.plot(q.volume,q.expected,color=colors[1],lw=1,label='Expected')
        ax.scatter(q.volume,q.rate,s=24,color=colors[0],edgecolor='white',lw=.5,zorder=3);ax.set_xlabel('Institutional volume');ax.set_ylabel('Outcome rate');ax.yaxis.set_major_formatter(PercentFormatter(1));ax.set_ylim(max(0,float(q[['lower','rate']].min().min())-.02),min(1,float(q[['upper','rate']].max().max())+.02));ax.margins(x=.03);_legend(ax)
    elif view in {'lorenz_curve','rank_abundance','hill_diversity'}:
        x,y={'lorenz_curve':('population_share','cumulative_share'),'rank_abundance':('rank','abundance'),'hill_diversity':('order','diversity')}[view]
        for i,(group,q) in enumerate(d.groupby('group',sort=False)):
            q=q.sort_values(x);ax.plot(q[x],q[y],color=colors[i],ls=['-','--',':','-.'][i],lw=1.5,label=_wrap(group,16))
        if view=='lorenz_curve':
            ax.plot([0,1],[0,1],color='#a4afbd',ls=':',lw=.9);ax.set(xlim=(0,1),ylim=(0,1),xlabel='Cumulative population share',ylabel='Cumulative outcome share');ax.set_aspect('equal');ax.xaxis.set_major_formatter(PercentFormatter(1));ax.yaxis.set_major_formatter(PercentFormatter(1))
        elif view=='rank_abundance':ax.set_yscale('log');ax.set_xlabel('Rank');ax.set_ylabel('Abundance (log scale)');ax.margins(x=.03,y=.12)
        else:ax.set_xlabel('Diversity order q');ax.set_ylabel('Effective number of species');ax.margins(x=.02,y=.10)
        _legend(ax)
    elif view=='control_cusum_results':
        q=d.sort_values('time');ax.plot(q.time,q.upper_cusum,color=colors[1],lw=1.4,label='Upper CUSUM');ax.plot(q.time,q.lower_cusum,color=colors[0],lw=1.4,label='Lower CUSUM')
        ax.plot(q.time,q.upper_limit,color=colors[1],ls='--',lw=.9);ax.plot(q.time,q.lower_limit,color=colors[0],ls='--',lw=.9);ax.axhline(0,color='#b3bdca',lw=.7);ax.set_xlabel('Time');ax.set_ylabel('Supplied cumulative sum');ax.margins(x=.02,y=.14);_legend(ax)
    return fig


def fixtures():
    rng=np.random.default_rng(9653);out={};t=np.arange(48);trend=10+.045*t;seasonal=1.5*np.sin(t/12*2*np.pi);noise=rng.normal(0,.2,len(t))
    out['time_stl_components']=pd.DataFrame({'time':t,'observed':trend+seasonal+noise,'trend':trend,'seasonal':seasonal,'remainder':noise})
    t=np.linspace(0,24,81);concentration=12*np.exp(-.14*t)
    out['time_pk_target']=pd.DataFrame({'time':t,'free_concentration':concentration,'mic':2.,'ft_fraction':np.log(12/2)/.14/24})
    out['time_mutant_window']=pd.DataFrame({'time':t,'concentration':concentration,'mic':1.,'mpc':4.})
    # Synthetic supplied result fixtures. These numbers are not estimated by render().
    n=np.array([75,90,110,80,130,160,120,180,100,150,130,170]);center=np.full(len(n),.12);spread=3*np.sqrt(center/n)
    out['control_u_results']=pd.DataFrame({'sample':[str(i+1) for i in range(len(n))],'rate':rng.poisson(center*n)/n,'center':center,'lower':np.maximum(center-spread,0),'upper':center+spread})
    volume=np.linspace(60,900,24).astype(int);expected=.12;spread=1.96*np.sqrt(expected*(1-expected)/volume)
    out['institution_funnel']=pd.DataFrame({'site':[f'Centre {i+1}' for i in range(len(volume))],'volume':volume,'rate':np.clip(expected+rng.normal(0,.015,len(volume)),0,1),'expected':expected,'lower':np.maximum(expected-spread,0),'upper':np.minimum(expected+spread,1)})
    p=np.linspace(0,1,41);out['lorenz_curve']=pd.DataFrame([[g,x,x**power] for g,power in [('Population A',1.8),('Population B',2.8)] for x in p],columns=['group','population_share','cumulative_share'])
    out['rank_abundance']=pd.DataFrame([[g,r,float(1000*np.exp(-r/s))] for g,s in [('Community A',9),('Community B',15),('Community C',20)] for r in range(1,51)],columns=['group','rank','abundance'])
    rows=[]
    for group,species,alpha in [('Community A',70,.6),('Community B',55,1.4),('Community C',60,2.2)]:
        abundance=rng.dirichlet(np.full(species,alpha))
        for q in np.linspace(0,4,33):
            diversity=np.exp(-np.sum(abundance*np.log(abundance))) if np.isclose(q,1) else np.sum(abundance**q)**(1/(1-q))
            rows.append([group,q,float(diversity)])
    out['hill_diversity']=pd.DataFrame(rows,columns=['group','order','diversity'])
    # Real one-sided recursions on synthetic standardized observations, k = 0.25.
    t=np.arange(1,41);increments=np.r_[rng.normal(0,.4,20),rng.normal(.6,.3,20)];upper=[];lower=[];pos=neg=0.
    for z in increments:
        pos=max(0,pos+z-.25);neg=min(0,neg+z+.25);upper.append(pos);lower.append(neg)
    out['control_cusum_results']=pd.DataFrame({'time':t,'upper_cusum':upper,'lower_cusum':lower,'upper_limit':4.,'lower_limit':-4.})
    assert set(out)==set(CONTRACTS)
    return out
