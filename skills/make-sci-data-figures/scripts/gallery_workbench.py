"""Original, editable scientific layouts with explicit tidy-table contracts.

Source images inform chart selection only; no source artwork or code is embedded.
Each renderer consumes measurements or declared analysis results, never pixels.
"""
from pathlib import Path
import argparse
import json
import textwrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.patches import Rectangle
from matplotlib.ticker import MaxNLocator
from scipy import stats
from figure_workbench import style, resolve_palette
from data_family_workbench import _save_bundle, _relative_input
from gallery_marks import tag_stat_group

# key: Chinese title, English title, category, required columns, numeric columns.
CONTRACTS = {
 'superplot': ('独立实验分层散点','Independent-experiment SuperPlot','distribution','group experiment value','value'),
 'grouped_observations': ('双因素分组与原始点','Grouped observations','distribution','factor group unit value','value'),
 'bland_altman': ('Bland–Altman 一致性图','Bland–Altman agreement','relationship','unit method_a method_b','method_a method_b'),
 'prediction_intervals': ('回归均值与个体预测区间','Mean and prediction intervals','relationship','unit x y','x y'),
 'hexbin_density': ('六边形计数图','Hexagonal counts','relationship','unit x y','x y'),
 'correlation_circles': ('相关矩阵圆点图','Correlation circle matrix','relationship','unit variable value','value'),
 'correlation_values': ('带数值的相关矩阵','Annotated correlation matrix','relationship','unit variable value','value'),
 'upset_intersections': ('集合交集矩阵','UpSet intersections','omics','sample set',''),
 'ma_expression': ('MA 表达差异图','MA expression plot','omics','feature mean_expression log2fc adjusted_p','mean_expression log2fc adjusted_p'),
 'pvalue_quantiles': ('P 值分位数图','P-value quantiles','omics','feature p','p'),
 'variance_scree': ('方差解释碎石图','Explained variance','omics','component proportion','proportion'),
 'composition_ring': ('组成环形图','Composition ring','matrix','category count','count'),
 'composition_waffle': ('百分比方格图','Percentage waffle','matrix','category count','count'),
 'ternary_composition': ('三元组成图','Ternary composition','matrix','sample group a b c','a b c'),
 'paired_dumbbell': ('两时点哑铃图','Paired dumbbell','paired','unit before after','before after'),
 'study_gantt': ('研究任务时间图','Study Gantt','longitudinal','task start end','start end'),
 'genome_manhattan': ('全基因组曼哈顿图','Genome-wide Manhattan','omics','variant chromosome position p','position p'),
 'gsea_tracks': ('GSEA 运行分数与排序轨迹','GSEA running-score tracks','omics','rank running_score hit rank_metric','rank running_score hit rank_metric'),
 'coverage_tracks': ('基因组覆盖轨迹','Genomic coverage tracks','omics','track position coverage','position coverage'),
 'quality_profiles': ('测序质量曲线','Sequencing quality profiles','omics','sample group position quality','position quality'),
 'pca_loadings': ('PCA 载荷与边际分布','PCA loadings and marginals','relationship','id role group x y','x y'),
}

NOTES = {
 'superplot': ('小点为实验内观测，大点为每次独立实验均值；不将技术重复当作独立样本。','Small points: within-experiment observations; large points: independent experiment means.'),
 'grouped_observations': ('显示双因素原始观测和均值 ± SD；不自动生成组间检验。','Two-factor observations and mean ± SD; no automatic between-group test.'),
 'bland_altman': ('每个对象一对同单位测量；一致性界限为差值均值 ± 1.96 SD，需判断差值分布。','One same-unit measurement pair per subject; limits are bias ± 1.96 SD, assuming approximately normal differences.'),
 'prediction_intervals': ('独立对象的连续变量；普通线性回归显示均值 95% CI 和个体 95% 预测区间。','Independent observations; OLS mean 95% CI and individual 95% prediction interval.'),
 'hexbin_density': ('两个连续变量；颜色表示每个六边形内的观测数量。','Two continuous variables; colour encodes observations per hexagon.'),
 'correlation_circles': ('对象、变量、数值长表；在完整对象上计算 Pearson 相关，面积表示绝对相关系数。','Subject-variable-value table; Pearson correlations on complete subjects; area encodes absolute correlation.'),
 'correlation_values': ('对象、变量、数值长表；完整对象上的 Pearson 相关，保留正负号。','Subject-variable-value table; Pearson correlations on complete subjects, preserving signs.'),
 'upset_intersections': ('样本与集合成员关系长表；柱高为互斥交集计数，点阵标明集合组合。','Sample-set membership table; bars show exclusive intersections and dots identify combinations.'),
 'ma_expression': ('已有差异分析结果；平均表达须大于零，校正 P 值与 log₂ 倍数变化分别提供。','Supplied differential-analysis results; positive mean expression, adjusted P values and log₂ fold changes.'),
 'pvalue_quantiles': ('提供原始 P 值；偏离均匀分布可能来自真实效应或偏倚，不能单凭此图定性。','Raw P values; departures from uniformity can reflect true effects or bias.'),
 'variance_scree': ('提供已计算的各主成分方差比例；总和不能超过 1。','Supply calculated component variance proportions; their sum must not exceed one.'),
 'composition_ring': ('类别与非负数量；保留原始总量和每类比例，适用于少量类别。','Categories and nonnegative counts; preserves total and category proportions; best for few categories.'),
 'composition_waffle': ('每格代表 1%；最大余数法分配 100 格，图例保留真实比例。','One cell is 1%; largest-remainder allocation to 100 cells; legend retains exact proportions.'),
 'ternary_composition': ('每个样本三个非负组成量，归一化为总和 1；零总量不接受。','Three nonnegative components per sample, normalized to one; zero totals are invalid.'),
 'paired_dumbbell': ('对象标识与前后两次同单位测量；保持配对关系。','Subject ID and before/after measurements in the same units; preserves pairing.'),
 'study_gantt': ('任务名称、起点和终点；所有时间使用同一单位。','Task, start and end; use the same time unit throughout.'),
 'genome_manhattan': ('变异标识、染色体、位置和原始 P 值；显著性阈值需按研究设定。','Variant, chromosome, position and raw P value; significance threshold must be study-specific.'),
 'gsea_tracks': ('提供 GSEA 运行富集分数、命中位置和排序统计量；不由轨迹反推 NES 或 P 值。','Supplied GSEA running enrichment scores, hits and ranking metric; NES and P values are not inferred from the trace.'),
 'coverage_tracks': ('轨迹、基因组位置和非负覆盖度；所有轨迹使用共同纵向比例。','Track, genomic position and nonnegative coverage; all tracks use a common vertical scale.'),
 'quality_profiles': ('样本、组别、读段位置和 Phred 质量；淡线为样本，粗线为组均值。','Sample, group, read position and Phred quality; light lines are samples and bold lines are group means.'),
 'pca_loadings': ('已计算的得分与载荷坐标；role 为 score 或 loading，须使用同一已声明的双标图尺度。','Supplied scores and loadings; role is score or loading, using one declared biplot scaling convention.'),
}

def validate(data, view):
    if view not in CONTRACTS: raise ValueError('Unknown gallery layout')
    fields=CONTRACTS[view][3].split();numeric=CONTRACTS[view][4].split()
    if not set(fields)<=set(data): raise ValueError('Required columns: '+', '.join(fields))
    data=data.copy()
    if data.empty or data[fields].isna().any().any(): raise ValueError('Required fields must be nonempty')
    for c in numeric:
        data[c]=pd.to_numeric(data[c],errors='raise')
        if not np.isfinite(data[c]).all(): raise ValueError('Numeric fields must be finite')
    for c in set(fields)-set(numeric):
        data[c]=data[c].astype(str)
        if data[c].str.strip().eq('').any(): raise ValueError('Labels must be nonempty')
    unique={
      'bland_altman':['unit'],'prediction_intervals':['unit'],'hexbin_density':['unit'],
      'correlation_circles':['unit','variable'],'correlation_values':['unit','variable'],
      'upset_intersections':['sample','set'],'paired_dumbbell':['unit'],
      'composition_ring':['category'],'composition_waffle':['category'],'study_gantt':['task'],
      'genome_manhattan':['variant'],'gsea_tracks':['rank'],'coverage_tracks':['track','position'],
      'quality_profiles':['sample','position'],'pca_loadings':['role','id'],
      'variance_scree':['component'],'ternary_composition':['sample'],
      'ma_expression':['feature'],'pvalue_quantiles':['feature'],
      'grouped_observations':['factor','group','unit']}.get(view)
    if unique and data.duplicated(unique).any(): raise ValueError('Duplicate observation keys: '+', '.join(unique))
    for c in ['p','adjusted_p']:
        if c in fields and not ((data[c]>0)&(data[c]<=1)).all(): raise ValueError(c+' must lie in (0, 1]; zero values need their original precision')
    for c in ['count','coverage','position','quality','proportion','a','b','c']:
        if c in numeric and (data[c]<0).any(): raise ValueError(c+' must be nonnegative')
    if 'mean_expression' in fields and (data.mean_expression<=0).any(): raise ValueError('Mean expression must be positive')
    if view.startswith('composition_') and (data['count'].sum()<=0 or len(data)>8): raise ValueError('Composition layouts require a positive total and at most eight categories')
    if view=='ternary_composition' and (data[['a','b','c']].sum(axis=1)<=0).any(): raise ValueError('Each composition needs a positive total')
    if view=='variance_scree' and data.proportion.sum()>1+1e-8: raise ValueError('Variance proportions must sum to at most one')
    if view=='study_gantt' and (data.end<data.start).any(): raise ValueError('Task end precedes start')
    if view in {'prediction_intervals','hexbin_density'} and (len(data)<6 or data.x.nunique()<3): raise ValueError('At least six independent observations and three distinct x values required')
    if view=='bland_altman' and len(data)<3: raise ValueError('At least three independent measurement pairs required')
    if view.startswith('correlation_'):
        matrix=data.pivot(index='unit',columns='variable',values='value')
        if matrix.isna().any().any() or len(matrix)<4 or not 2<=len(matrix.columns)<=12 or (matrix.std()==0).any(): raise ValueError('Correlation needs 4+ complete subjects, 2–12 nonconstant variables')
    if view=='upset_intersections' and not 2<=data['set'].nunique()<=8: raise ValueError('UpSet supports 2–8 sets')
    if view=='pca_loadings' and (not set(data.role)<={'score','loading'} or not {'score','loading'}<=set(data.role)): raise ValueError('PCA requires score and loading rows')
    if view=='pca_loadings' and len(data[data.role=='loading'])>8: raise ValueError('Show at most eight selected loading arrows per panel')
    if view=='gsea_tracks' and (not data['hit'].isin([0,1]).all() or len(data)<3): raise ValueError('GSEA requires an ordered trace and binary hit indicators')
    if view=='quality_profiles' and (data.groupby('sample').group.nunique()>1).any(): raise ValueError('A sample cannot change groups')
    if view=='superplot' and data.groupby('group').experiment.nunique().min()<2: raise ValueError('At least two independent experiments per group required')
    for c,maximum in [('group',6),('experiment',6),('factor',6),('track',12),('task',30)]:
        if c not in fields:continue
        labels=data.loc[data.role=='score',c] if view=='pca_loadings' and c=='group' else data[c]
        if labels.nunique()>maximum:raise ValueError(f'At most {maximum} {c} labels per panel; split the data into panels')
    return data

def finish(ax,x=None,y=None):
    ax.spines[['top','right']].set_visible(False)
    ax.tick_params(labelsize=8,length=3,pad=4)
    if x: ax.set_xlabel(x,fontsize=9,labelpad=7)
    if y: ax.set_ylabel(y,fontsize=9,labelpad=7)

def _wrap(value,width=16):
    return '\n'.join(textwrap.wrap(str(value),width=width,break_long_words=True))

def _top_legend(ax,ncol=2):
    handles,labels=ax.get_legend_handles_labels();labels=[_wrap(x,16) for x in labels]
    longest=max((max(map(len,x.splitlines())) for x in labels),default=0)
    available=ax.figure.get_size_inches()[0]*72-60
    while ncol>1 and ncol*(longest*4.1+24)>available:ncol-=1
    return ax.legend(handles,labels,loc='lower left',bbox_to_anchor=(0,1.02),ncol=ncol,fontsize=8,frameon=False,borderaxespad=0,columnspacing=1.1,handlelength=1.7)

def _fixed_colorbar(fig,ax,artist,label):
    """Keep a geometry-locked panel and its colour bar together when widened."""
    from mpl_toolkits.axes_grid1 import make_axes_locatable
    divider=make_axes_locatable(ax);cax=divider.append_axes('right',size='4%',pad=.10)
    cb=fig.colorbar(artist,cax=cax,label=label);cb.solids.set_rasterized(False)
    fig._studio_right_pad_inches=.68
    return cb

def _finalize(fig):
    """Lay out actual artists within the requested physical canvas."""
    if hasattr(fig,'_studio_compound_layout'):
        fig.set_layout_engine(None)
    else:
        fig.set_layout_engine('constrained')
        fig.get_layout_engine().set(w_pad=.08,h_pad=.08,wspace=.08,hspace=.10)
        if getattr(fig,'_studio_right_pad_inches',0):
            fig.get_layout_engine().set(rect=(0,0,1-fig._studio_right_pad_inches/fig.get_size_inches()[0],1))
    for axis in fig.axes:
        axis.tick_params(labelsize=8)
        if axis.get_legend():
            for text in axis.get_legend().get_texts():text.set_fontsize(8)
        for text in axis.texts:
            if text.get_fontsize()<8:text.set_fontsize(8)
    from gallery_layout import apply_layout
    return apply_layout(fig,getattr(fig,'_studio_view',None))

def render(data,view,colors=None,figsize=(4.8,3.6)):
    d=validate(data,view);colors=colors or resolve_palette('zhoy_muted',None,8)
    # Compact, consistent type sizes; complex panels receive actual extra space.
    fig,ax=plt.subplots(figsize=figsize,layout='constrained')
    fig._studio_view=view
    seq=LinearSegmentedColormap.from_list('studio_sequential',['#f0f3f8',colors[0]])
    div=LinearSegmentedColormap.from_list('studio_diverging',[colors[0],'#f5f6f8',colors[1]])
    rng=np.random.default_rng(2317)
    if view in {'bland_altman','prediction_intervals','hexbin_density'}:
        if view=='bland_altman':
            x=(d.method_a+d.method_b)/2;y=d.method_b-d.method_a;bias=y.mean();sd=y.std(ddof=1)
            ax.scatter(x,y,s=19,color=colors[0],alpha=.7,edgecolor='white',lw=.35)
            for value,label,ls in [(bias,'Bias','-'),(bias+1.96*sd,'Upper LoA','--'),(bias-1.96*sd,'Lower LoA','--')]:
                ax.axhline(value,color='#67758a',ls=ls,lw=.85,label=f'{label}: {value:.2f}')
            _top_legend(ax,ncol=3);ax.margins(y=.18);finish(ax,'Mean of methods','Method B − method A')
        elif view=='prediction_intervals':
            x=d.x.to_numpy();y=d.y.to_numpy();fit=stats.linregress(x,y);gx=np.linspace(x.min(),x.max(),150);fitted=fit.intercept+fit.slope*gx
            se=np.sqrt(np.sum((y-fit.intercept-fit.slope*x)**2)/(len(x)-2));h=1/len(x)+(gx-x.mean())**2/np.sum((x-x.mean())**2);t=stats.t.ppf(.975,len(x)-2)
            ax.fill_between(gx,fitted-t*se*np.sqrt(1+h),fitted+t*se*np.sqrt(1+h),color='#e8ecf1',label='95% prediction interval')
            ax.fill_between(gx,fitted-t*se*np.sqrt(h),fitted+t*se*np.sqrt(h),color=colors[0],alpha=.25,label='Mean 95% CI')
            ax.scatter(x,y,s=12,color=colors[0],alpha=.65);ax.plot(gx,fitted,color=colors[0],lw=1.3)
            _top_legend(ax,ncol=1);finish(ax,'X','Y')
        else:
            # Fixed binning and a matching box aspect keep hexagons regular at
            # every canvas size, without changing the aggregation on resize.
            hb=ax.hexbin(d.x,d.y,gridsize=(22,13),mincnt=1,cmap=seq,linewidths=.2)
            dx=np.ptp(ax.get_xlim());dy=np.ptp(ax.get_ylim());ax.set_aspect(np.sqrt(3)*13/22*dx/dy,adjustable='box')
            _fixed_colorbar(fig,ax,hb,'Count');finish(ax,'X','Y')
    elif view in {'correlation_circles','correlation_values'}:
        m=d.pivot(index='unit',columns='variable',values='value').corr();n=len(m)
        if view=='correlation_values':
            mesh=ax.pcolormesh(np.arange(n+1)-.5,np.arange(n+1)-.5,m,vmin=-1,vmax=1,cmap=div,edgecolors='white',linewidth=.5,rasterized=False)
            from gallery_heatmap import cell_values
            cell_values(ax,m,mesh,visible=True)
        else:
            for i in range(n):
                for j in range(i+1):ax.scatter(j,i,s=260*abs(m.iloc[i,j]),c=[m.iloc[i,j]],cmap=div,vmin=-1,vmax=1,edgecolor='white',lw=.6)
        ax.set(xticks=range(n),yticks=range(n),xticklabels=m.columns,yticklabels=m.columns,xlim=(-.5,n-.5),ylim=(n-.5,-.5));ax.tick_params(axis='x',rotation=45);ax.set_aspect('equal')
        _fixed_colorbar(fig,ax,plt.cm.ScalarMappable(norm=Normalize(-1,1),cmap=div),r'Pearson $r$');finish(ax)
    elif view=='upset_intersections':
        from collections import Counter
        sets=sorted(d['set'].unique());members=d.groupby('sample')['set'].apply(frozenset);counts=Counter(members);combos=sorted(counts,key=lambda c:(-counts[c],tuple(sorted(c))))
        if len(combos)>24:raise ValueError('At most 24 nonempty intersections per panel; filter sets or split the panel')
        fig.delaxes(ax);fig.set_size_inches(figsize)
        grid=fig.add_gridspec(2,2,left=.20,right=.97,bottom=.16,top=.93,width_ratios=[1,3],height_ratios=[2,1.6],hspace=.10,wspace=.18)
        bars=fig.add_subplot(grid[0,1]);dots=fig.add_subplot(grid[1,1],sharex=bars);sizes=fig.add_subplot(grid[1,0],sharey=dots)
        bars.bar(range(len(combos)),[counts[c] for c in combos],color=colors[0],width=.65);finish(bars,y='Intersection size');bars.tick_params(axis='x',bottom=False,labelbottom=False)
        for j,c in enumerate(combos):
            rows=[i for i,s in enumerate(sets) if s in c];dots.scatter([j]*len(sets),range(len(sets)),s=12,color='#e1e6ed');dots.plot([j,j],[min(rows),max(rows)],color='#344054',lw=1);dots.scatter([j]*len(rows),rows,s=22,color=colors[0],zorder=3)
        dots.set(xticks=[],yticks=range(len(sets)),ylim=(len(sets)-.5,-.5));dots.tick_params(left=False,labelleft=False);dots.spines[:].set_visible(False)
        sizes.barh(range(len(sets)),[sum(s in c for c in members) for s in sets],color='#a9b9ce',height=.65);sizes.invert_xaxis();sizes.set_yticks(range(len(sets)),sets);finish(sizes,'Set size');sizes.tick_params(axis='y',length=0);return _finalize(fig)
    elif view in {'ma_expression','pvalue_quantiles','variance_scree','genome_manhattan'}:
        if view=='ma_expression':
            sig=d.adjusted_p<.05;cc=np.where(sig& (d.log2fc>0),colors[1],np.where(sig&(d.log2fc<0),colors[0],'#cfd6df'))
            ax.scatter(np.log10(d.mean_expression),d.log2fc,s=13,c=cc,alpha=.7,lw=0);ax.axhline(0,color='#9aa6b7',lw=.7);finish(ax,r'$\log_{10}$ mean expression',r'$\log_{2}$ fold change')
        elif view=='pvalue_quantiles':
            expected=-np.log10((np.arange(1,len(d)+1)-.5)/len(d));observed=-np.log10(np.sort(d.p));ax.scatter(expected,observed,s=16,color=colors[0],alpha=.7)
            lim=max(max(expected),max(observed));ax.plot([0,lim],[0,lim],ls=':',lw=1,color='#9aa6b7');finish(ax,r'Expected $-\log_{10} P$',r'Observed $-\log_{10} P$')
        elif view=='variance_scree':
            ax.bar(np.arange(len(d)),100*d.proportion,color='#a9b9ce',width=.6,label='Individual');ax.plot(np.arange(len(d)),100*d.proportion.cumsum(),'-o',ms=3,color=colors[0],label='Cumulative');ax.set_xticks(range(len(d)),d.component);ax.set_ylim(0,105);_top_legend(ax);finish(ax,'Component','Explained variance (%)')
        else:
            chrom=list(dict.fromkeys(d.chromosome));offset=0;ticks=[];last_position=0
            for i,c in enumerate(chrom):
                q=d[d.chromosome==c].sort_values('position');span=max(q.position.max(),1);xx=q.position+offset;ax.scatter(xx,-np.log10(q.p),s=5,color=[colors[0],'#a9b9ce'][i%2],lw=0,alpha=.8);ticks.append(offset+span/2);last_position=offset+span;offset+=span*1.04
            stride=max(1,int(np.ceil(len(chrom)/max(6,int((figsize[0]*72-104)/15)))))
            shown=list(range(0,len(chrom),stride))
            if shown[-1]!=len(chrom)-1:shown.append(len(chrom)-1)
            ax.set_xticks([ticks[i] for i in shown],[chrom[i] for i in shown]);ax.set_xlim(-last_position*.005,last_position*1.005);ax.set_ylim(0,max(1,float((-np.log10(d.p)).max()))*1.06);ax.tick_params(axis='x',labelsize=8);finish(ax,'Chromosome',r'$-\log_{10} P$')
    elif view in {'composition_ring','composition_waffle','ternary_composition'}:
        if view=='ternary_composition':
            a=d[['a','b','c']].to_numpy();a=a/a.sum(axis=1,keepdims=True);x=a[:,1]+a[:,2]/2;y=a[:,2]*np.sqrt(3)/2
            ax.plot([0,1,.5,0],[0,0,np.sqrt(3)/2,0],color='#9aa6b7',lw=.8)
            for f in [.25,.5,.75]:
                ax.plot([f/2,1-f/2],[f*np.sqrt(3)/2]*2,color='#e4e9f0',lw=.6)
            for i,g in enumerate(d.group.unique()):
                mask=d.group==g;ax.scatter(x[mask],y[mask],s=22,color=colors[i%len(colors)],label=g,alpha=.8,edgecolor='white',lw=.35)
            for xx,yy,label in [(0,-.06,'A'),(1,-.06,'B'),(.5,.93,'C')]:ax.text(xx,yy,label,ha='center',fontsize=9)
            _top_legend(ax);ax.set_aspect('equal');ax.axis('off')
        else:
            shares=d['count']/d['count'].sum();labels=[f'{_wrap(n,14)}  {v:.1%}' for n,v in zip(d.category,shares)]
            if view=='composition_ring':
                wedges,_=ax.pie(d['count'],colors=colors[:len(d)],startangle=90,counterclock=False,wedgeprops={'width':.25,'edgecolor':'white','linewidth':2});ax.text(0,.07,f'{d["count"].sum():g}',ha='center',va='center',fontsize=16,color='#344054');ax.text(0,-.17,'Total',ha='center',fontsize=8,color='#718096');ax.legend(wedges,labels,loc='center left',bbox_to_anchor=(.98,.5),frameon=False,fontsize=8)
            else:
                raw=100*shares.to_numpy();alloc=np.floor(raw).astype(int);alloc[np.argsort(-(raw-alloc),kind='stable')[:100-alloc.sum()]]+=1;indices=np.repeat(np.arange(len(d)),alloc)
                for j,i in enumerate(indices):ax.add_patch(Rectangle((j%10,j//10),1,1,fc=colors[i],ec='white',lw=.9))
                handles=[Rectangle((0,0),1,1,fc=colors[i]) for i in range(len(labels))]
                ax.legend(handles,labels,loc='center left',bbox_to_anchor=(1,.5),frameon=False,fontsize=8);ax.set(xlim=(0,10),ylim=(0,10));ax.set_aspect('equal');ax.axis('off')
    elif view in {'paired_dumbbell','study_gantt'}:
        if view=='paired_dumbbell':
            q=d.assign(delta=d.after-d.before).sort_values('delta');yy=np.arange(len(q));ax.hlines(yy,q.before,q.after,color='#c3ccd8',lw=1.7);ax.scatter(q.before,yy,s=25,color=colors[0],label='Before');ax.scatter(q.after,yy,s=25,color=colors[1],label='After');ax.set_yticks(yy,q.unit);_top_legend(ax);finish(ax,'Value')
        else:ax.barh(range(len(d)),d.end-d.start,left=d.start,color=colors[0],alpha=.75,height=.5);ax.set_yticks(range(len(d)),d.task);ax.invert_yaxis();finish(ax,'Time')
    elif view in {'superplot','grouped_observations'}:
        if view=='superplot':
            groups=list(d.group.unique());experiments=list(d.experiment.unique())
            for i,g in enumerate(groups):
                part=d[d.group==g]
                for j,e in enumerate(experiments):
                    v=part.loc[part.experiment==e,'value'].to_numpy()
                    if not len(v):continue
                    center=i+(j-(len(experiments)-1)/2)*min(.15,.6/max(1,len(experiments)-1));color=colors[j%len(colors)]
                    ax.scatter(center+rng.uniform(-.035,.035,len(v)),v,s=12,color=color,alpha=.42,lw=0)
                    ax.scatter(center,np.mean(v),s=42,color=color,edgecolor='white',lw=.8,marker=['o','s','^','D'][j%4],zorder=5,label=e if i==0 else None)
            ax.set_xticks(range(len(groups)),groups);_top_legend(ax,ncol=min(3,len(experiments)));finish(ax,y='Value')
        else:
            factors=list(d.factor.unique());groups=list(d.group.unique());width=.7/len(groups)
            for j,g in enumerate(groups):
                for i,f in enumerate(factors):
                    v=d.loc[(d.factor==f)&(d.group==g),'value'].to_numpy()
                    if len(v)<2:raise ValueError('Each factor-group cell requires at least two independent observations')
                    pos=i+(j-(len(groups)-1)/2)*width;c=colors[j%len(colors)];bars=ax.bar(pos,v.mean(),width*.8,color=c,alpha=.65,label=g if i==0 else None)
                    error=ax.errorbar(pos,v.mean(),yerr=v.std(ddof=1),fmt='none',color='#344054',lw=.8,capsize=2);points=ax.scatter(pos+rng.uniform(-width*.22,width*.22,len(v)),v,s=15,facecolor='white',edgecolor=c,lw=.7,zorder=3)
                    tag_stat_group(ax,g,f,(pos,v.mean()),[*bars,points,error.lines[0],*error.lines[1],*error.lines[2]])
            ax.set_xticks(range(len(factors)),factors);ax.set_ylim(min(0,d.value.min()*1.1),max(0,d.value.max()*1.2));_top_legend(ax,ncol=len(groups));finish(ax,y='Value')
    elif view=='gsea_tracks':
        q=d.sort_values('rank');fig.delaxes(ax);grid=fig.add_gridspec(3,1,left=.18,right=.94,bottom=.19,top=.93,height_ratios=[3,.5,1],hspace=.08)
        a=fig.add_subplot(grid[0]);h=fig.add_subplot(grid[1],sharex=a);r=fig.add_subplot(grid[2],sharex=a)
        a.plot(q['rank'],q.running_score,color=colors[1],lw=1.6);a.axhline(0,color='#b9c4d3',lw=.7);finish(a,y='Running enrichment score');a.tick_params(labelbottom=False)
        h.vlines(q.loc[q['hit']==1,'rank'],0,1,color='#526173',lw=.65);h.axis('off')
        r.fill_between(q['rank'],q.rank_metric,color=colors[0],alpha=.3);finish(r,'Ranked feature list','Rank metric');return _finalize(fig)
    elif view=='coverage_tracks':
        tracks=list(d.track.unique());maximum=d.coverage.max()
        if maximum<=0:raise ValueError('At least one positive coverage value required')
        for i,t in enumerate(tracks):
            q=d[d.track==t].sort_values('position')
            ax.fill_between(q.position,i,i+.78*q.coverage/maximum,color=colors[i%len(colors)],alpha=.7,lw=0,gid=f'studio-spacing-group-{i}-density')
            ax.plot(q.position,i+.78*q.coverage/maximum,color=colors[i%len(colors)],lw=.65,gid=f'studio-spacing-group-{i}-outline')
        ax.set_yticks(range(len(tracks)),tracks);ax.set_xlim(d.position.min(),d.position.max());ax.set_ylim(-.12,len(tracks)-.08);ax.spines[['left','top','right']].set_visible(False);ax.tick_params(axis='y',length=0);finish(ax,'Genomic position');ax.set_title(f'Common scale · maximum coverage {maximum:g}',fontsize=8,color='#526173',loc='left',pad=10)
    elif view=='quality_profiles':
        for i,(g,p) in enumerate(d.groupby('group',sort=False)):
            for _,q in p.groupby('sample'):q=q.sort_values('position');ax.plot(q.position,q.quality,color=colors[i%len(colors)],alpha=.2,lw=.6)
            q=p.groupby('position').quality.mean();ax.plot(q.index,q.values,color=colors[i%len(colors)],lw=1.6,label=g)
        _top_legend(ax,ncol=3);finish(ax,'Read position (bp)','Phred quality')
    elif view=='pca_loadings':
        # The data axes keep the common physical frame. Marginals occupy the
        # surrounding auxiliary bands, rather than shrinking the scatter plot.
        fig.set_layout_engine(None)
        top=fig.add_axes((.15,.8,.6,.12),sharex=ax)
        right=fig.add_axes((.8,.2,.1,.6),sharey=ax)
        for i,(g,p) in enumerate(d[d.role=='score'].groupby('group',sort=False)):
            c=colors[i%len(colors)];ax.scatter(p.x,p.y,s=13,color=c,alpha=.65,label=g,lw=0)
            for field,axis in [('x',top),('y',right)]:
                v=p[field].to_numpy()
                if len(v)>3 and np.ptp(v)>0:
                    xx=np.linspace(v.min()-.3*np.ptp(v),v.max()+.3*np.ptp(v),100);yy=stats.gaussian_kde(v)(xx)
                    if field=='x':axis.plot(xx,yy,color=c,lw=.9);axis.fill_between(xx,yy,color=c,alpha=.12)
                    else:axis.plot(yy,xx,color=c,lw=.9);axis.fill_betweenx(xx,yy,color=c,alpha=.12)
        for _,row in d[d.role=='loading'].iterrows():
            ax.annotate('',xy=(row.x,row.y),xytext=(0,0),arrowprops={'arrowstyle':'->','color':'#526173','lw':.8})
        # Supplied loading endpoints can extend beyond the observed score cloud.
        # Include both in the bounds; annotations do not update data limits.
        limits=[]
        for column in ['x','y']:
            lo=min(0,float(d[column].min()));hi=max(0,float(d[column].max()));pad=max((hi-lo)*.18,.2);limits.append((lo-pad,hi+pad))
        # Numbered loading arrows use one concise key outside the data frame.
        load=d[d.role=='loading']
        arrow_labels=[]
        for i,(_,row) in enumerate(load.iterrows()):
            dx,dy=(7 if row.x>=0 else -7),(7 if row.y>=0 else -7)
            arrow_labels.append(ax.annotate(str(i+1),(row.x,row.y),xytext=(dx,dy),textcoords='offset points',fontsize=8,color='#344054',ha='center',va='center',zorder=8,bbox={'boxstyle':'round,pad=.15','fc':'white','ec':'none','alpha':.95}))
        footer=fig.text(.5,.02,'',ha='center',va='center',fontsize=8,color='#526173')
        ax.axhline(0,color='#dce2eb',ls=':',lw=.7);ax.axvline(0,color='#dce2eb',ls=':',lw=.7);finish(ax,'Component 1','Component 2');ax.xaxis.labelpad=5;top.axis('off');right.axis('off')
        handles,groups=ax.get_legend_handles_labels();legend=None

        def compound_layout(frame):
            nonlocal legend
            fig.set_layout_engine(None)
            left,bottom,width,height=frame;wp,hp=fig.get_size_inches()*72
            ax.set_position(frame);ax.set_aspect('equal',adjustable='datalim')
            top.set_position((left,bottom+height+4/hp,width,24/hp))
            right.set_position((left+width+4/wp,bottom,24/wp,height))
            # Equal coordinate units are obtained by extending limits, never
            # by reducing or stretching the common data rectangle.
            xlo,xhi=limits[0];ylo,yhi=limits[1];ratio=width*wp/(height*hp)
            xspan=xhi-xlo;yspan=yhi-ylo
            if xspan/yspan<ratio:
                center=(xlo+xhi)/2;xspan=yspan*ratio;xlo=center-xspan/2;xhi=center+xspan/2
            else:
                center=(ylo+yhi)/2;yspan=xspan/ratio;ylo=center-yspan/2;yhi=center+yspan/2
            ax.set_xlim(xlo,xhi);ax.set_ylim(ylo,yhi)
            ax.xaxis.set_major_locator(MaxNLocator(nbins=max(3,int(width*wp/43))))
            ax.yaxis.set_major_locator(MaxNLocator(nbins=max(3,int(height*hp/34))))
            if legend is not None:legend.remove()
            from matplotlib.textpath import TextPath
            prop=footer.get_fontproperties();available=wp*(1-left)-6
            labels=[str(g) for g in groups]
            longest=max((TextPath((0,0),g,prop=prop).get_extents().width for g in labels),default=0)
            ncol=max(int(np.ceil(len(groups)/2)),min(len(groups),int(available/(longest+26))))
            label_width=max(12,(available-(ncol-1)*8)/ncol-22)
            for i,label in enumerate(labels):
                end=len(label)
                while end>2 and TextPath((0,0),labels[i],prop=prop).get_extents().width>label_width:
                    end-=1;labels[i]=label[:end]+'…'
            legend=fig.legend(handles,labels,loc='upper left',bbox_to_anchor=(left,1-3/hp),ncol=ncol,frameon=False,fontsize=8,borderaxespad=0,borderpad=0,columnspacing=1,handlelength=1.2,handletextpad=.4,labelspacing=.3)
            # Keep the loading key to one line at the outer bottom edge. Long
            # names are abbreviated here; the full IDs remain in the data.
            names=[str(v) for v in load.id];max_len=max(map(len,names),default=0)
            while True:
                names_short=[name if len(name)<=max_len else name[:max(1,max_len-1)]+'…' for name in names]
                key='  ·  '.join(f'{i+1}: {name}' for i,name in enumerate(names_short))
                if TextPath((0,0),key,prop=prop).get_extents().width<=wp-12 or max_len<=2:break
                max_len-=1
            footer.set_text(key);footer.set_position((.5,6/hp))
            # Resolve neighbouring endpoint badges in physical point space.
            occupied=[]
            for label,(_,row) in zip(arrow_labels,load.iterrows()):
                px=(row.x-xlo)/(xhi-xlo)*width*wp;py=(row.y-ylo)/(yhi-ylo)*height*hp
                sx=1 if row.x>=0 else -1;sy=1 if row.y>=0 else -1
                options=[(sx*7,sy*7),(sx*14,0),(0,sy*14),(-sx*7,sy*7),(sx*7,-sy*7),(-sx*14,0),(0,-sy*14)]
                chosen=options[0]
                for dx,dy in options:
                    center=(px+dx,py+dy)
                    if not 5<center[0]<width*wp-5 or not 5<center[1]<height*hp-5:continue
                    if all(abs(center[0]-a)>11 or abs(center[1]-b)>11 for a,b in occupied):chosen=(dx,dy);break
                label.set_position(chosen);occupied.append((px+chosen[0],py+chosen[1]))

        fig._studio_compound_layout=compound_layout
        fig._studio_main_axes=[ax]
    return _finalize(fig)

def generate(input_path,outdir,view,palette='zhoy_muted',colors_text=None,font='Arial'):
    style(font);d=pd.read_csv(input_path);colors=resolve_palette(palette,colors_text,8)
    compatible=[view]+[k for k in CONTRACTS if k!=view and CONTRACTS[k][3]==CONTRACTS[view][3]]
    figures=[(key,render(d,key,colors)) for key in compatible]
    recipe={'family':'gallery','input':_relative_input(Path(input_path),Path(outdir)),'palette':palette,'colors':colors_text,'font':font,'parameters':{'view':view}}
    analysis={'family':'gallery','view':view,'input_contract':CONTRACTS[view][3].split(),'description':NOTES[view][1],'inference':'Only explicitly documented summaries; no invented significance or source-model results'}
    return _save_bundle(Path(outdir),figures,{},analysis,recipe)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--view',required=True,choices=sorted(CONTRACTS));a=parser.parse_args();generate(a.input,a.output,a.view)
