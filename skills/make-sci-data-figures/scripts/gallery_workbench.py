"""Original, editable scientific layouts with explicit tidy-table contracts.

Source images inform chart selection only; no source artwork or code is embedded.
Each renderer consumes measurements or declared analysis results, never pixels.
"""
from pathlib import Path
import argparse
import json
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap, Normalize
from scipy import stats
from figure_workbench import style, resolve_palette
from data_family_workbench import _save_bundle, _relative_input

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
        if c in fields and data[c].nunique()>maximum:raise ValueError(f'At most {maximum} {c} labels per panel; split the data into panels')
    return data

def finish(ax,x=None,y=None):
    ax.spines[['top','right']].set_visible(False)
    ax.tick_params(labelsize=8,length=3,pad=4)
    if x: ax.set_xlabel(x,fontsize=9,labelpad=7)
    if y: ax.set_ylabel(y,fontsize=9,labelpad=7)

def render(data,view,colors=None):
    d=validate(data,view);colors=colors or resolve_palette('zhoy_muted',None,8)
    # Compact, consistent type sizes; complex panels receive actual extra space.
    fig,ax=plt.subplots(figsize=(4.8,3.6));fig.subplots_adjust(left=.18,right=.94,bottom=.19,top=.88)
    seq=LinearSegmentedColormap.from_list('studio_sequential',['#f0f3f8',colors[0]])
    div=LinearSegmentedColormap.from_list('studio_diverging',[colors[0],'#f5f6f8',colors[1]])
    rng=np.random.default_rng(2317)
    if view in {'bland_altman','prediction_intervals','hexbin_density'}:
        if view=='bland_altman':
            x=(d.method_a+d.method_b)/2;y=d.method_b-d.method_a;bias=y.mean();sd=y.std(ddof=1)
            ax.scatter(x,y,s=19,color=colors[0],alpha=.7,edgecolor='white',lw=.35)
            for value,label,ls in [(bias,'Bias','-'),(bias+1.96*sd,'Upper LoA','--'),(bias-1.96*sd,'Lower LoA','--')]:
                ax.axhline(value,color='#67758a',ls=ls,lw=.85)
                ax.annotate(f'{label} {value:.2f}',xy=(1,value),xycoords=('axes fraction','data'),xytext=(-3,5),textcoords='offset points',ha='right',fontsize=7.5,bbox=dict(fc='white',ec='none',pad=1))
            ax.margins(y=.25);finish(ax,'Mean of methods','Method B − method A')
        elif view=='prediction_intervals':
            x=d.x.to_numpy();y=d.y.to_numpy();fit=stats.linregress(x,y);gx=np.linspace(x.min(),x.max(),150);fitted=fit.intercept+fit.slope*gx
            se=np.sqrt(np.sum((y-fit.intercept-fit.slope*x)**2)/(len(x)-2));h=1/len(x)+(gx-x.mean())**2/np.sum((x-x.mean())**2);t=stats.t.ppf(.975,len(x)-2)
            ax.fill_between(gx,fitted-t*se*np.sqrt(1+h),fitted+t*se*np.sqrt(1+h),color='#e8ecf1',label='95% prediction interval')
            ax.fill_between(gx,fitted-t*se*np.sqrt(h),fitted+t*se*np.sqrt(h),color=colors[0],alpha=.25,label='Mean 95% CI')
            ax.scatter(x,y,s=12,color=colors[0],alpha=.65);ax.plot(gx,fitted,color=colors[0],lw=1.3)
            ax.legend(loc='upper left',bbox_to_anchor=(0,1.20),ncol=1,fontsize=7,frameon=False);finish(ax,'X','Y')
        else:
            fig.subplots_adjust(right=.80)
            hb=ax.hexbin(d.x,d.y,gridsize=22,mincnt=1,cmap=seq,linewidths=.2);fig.colorbar(hb,ax=ax,pad=.035,fraction=.04,label='Count').solids.set_rasterized(False);finish(ax,'X','Y')
    elif view in {'correlation_circles','correlation_values'}:
        m=d.pivot(index='unit',columns='variable',values='value').corr();n=len(m);fig.set_size_inches(max(4.8,.40*n+1.5),max(3.6,.40*n+1.2));fig.subplots_adjust(right=.80)
        if view=='correlation_values':
            ax.pcolormesh(np.arange(n+1)-.5,np.arange(n+1)-.5,m,vmin=-1,vmax=1,cmap=div,edgecolors='white',linewidth=.5,rasterized=False)
            for i in range(n):
                for j in range(n):ax.text(j,i,f'{m.iloc[i,j]:.2f}',ha='center',va='center',fontsize=7.5,color='white' if abs(m.iloc[i,j])>.7 else '#23344c')
        else:
            for i in range(n):
                for j in range(i+1):ax.scatter(j,i,s=260*abs(m.iloc[i,j]),c=[m.iloc[i,j]],cmap=div,vmin=-1,vmax=1,edgecolor='white',lw=.6)
        ax.set(xticks=range(n),yticks=range(n),xticklabels=m.columns,yticklabels=m.columns,xlim=(-.5,n-.5),ylim=(n-.5,-.5));ax.tick_params(axis='x',rotation=45);ax.set_aspect('equal')
        fig.colorbar(plt.cm.ScalarMappable(norm=Normalize(-1,1),cmap=div),ax=ax,pad=.035,fraction=.04,label='Pearson r').solids.set_rasterized(False);finish(ax)
    elif view=='upset_intersections':
        from collections import Counter
        sets=sorted(d['set'].unique());members=d.groupby('sample')['set'].apply(frozenset);counts=Counter(members);combos=sorted(counts,key=lambda c:(-counts[c],tuple(sorted(c))))
        if len(combos)>24:raise ValueError('At most 24 nonempty intersections per panel; filter sets or split the panel')
        fig.delaxes(ax);fig.set_size_inches(max(4.8,.22*len(combos)+1.5),4.0)
        grid=fig.add_gridspec(2,2,left=.20,right=.97,bottom=.16,top=.93,width_ratios=[1,3],height_ratios=[2,1.6],hspace=.10,wspace=.18)
        bars=fig.add_subplot(grid[0,1]);dots=fig.add_subplot(grid[1,1],sharex=bars);sizes=fig.add_subplot(grid[1,0],sharey=dots)
        bars.bar(range(len(combos)),[counts[c] for c in combos],color=colors[0],width=.65);finish(bars,y='Intersection size');bars.tick_params(axis='x',bottom=False,labelbottom=False)
        for j,c in enumerate(combos):
            rows=[i for i,s in enumerate(sets) if s in c];dots.scatter([j]*len(sets),range(len(sets)),s=12,color='#e1e6ed');dots.plot([j,j],[min(rows),max(rows)],color='#344054',lw=1);dots.scatter([j]*len(rows),rows,s=22,color=colors[0],zorder=3)
        dots.set(xticks=[],yticks=range(len(sets)),ylim=(len(sets)-.5,-.5));dots.tick_params(left=False,labelleft=False);dots.spines[:].set_visible(False)
        sizes.barh(range(len(sets)),[sum(s in c for c in members) for s in sets],color='#a9b9ce',height=.65);sizes.invert_xaxis();sizes.set_yticks(range(len(sets)),sets);finish(sizes,'Set size');sizes.tick_params(axis='y',length=0);return fig
    elif view in {'ma_expression','pvalue_quantiles','variance_scree','genome_manhattan'}:
        if view=='ma_expression':
            sig=d.adjusted_p<.05;cc=np.where(sig& (d.log2fc>0),colors[1],np.where(sig&(d.log2fc<0),colors[0],'#cfd6df'))
            ax.scatter(np.log10(d.mean_expression),d.log2fc,s=13,c=cc,alpha=.7,lw=0);ax.axhline(0,color='#9aa6b7',lw=.7);finish(ax,r'$\log_{10}$ mean expression',r'$\log_{2}$ fold change')
        elif view=='pvalue_quantiles':
            expected=-np.log10((np.arange(1,len(d)+1)-.5)/len(d));observed=-np.log10(np.sort(d.p));ax.scatter(expected,observed,s=16,color=colors[0],alpha=.7)
            lim=max(max(expected),max(observed));ax.plot([0,lim],[0,lim],ls=':',lw=1,color='#9aa6b7');finish(ax,r'Expected $-\log_{10} P$',r'Observed $-\log_{10} P$')
        elif view=='variance_scree':
            ax.bar(np.arange(len(d)),100*d.proportion,color='#a9b9ce',width=.6,label='Individual');ax.plot(np.arange(len(d)),100*d.proportion.cumsum(),'-o',ms=3,color=colors[0],label='Cumulative');ax.set_xticks(range(len(d)),d.component);ax.set_ylim(0,105);ax.legend(frameon=False,fontsize=8);finish(ax,'Component','Explained variance (%)')
        else:
            chrom=list(dict.fromkeys(d.chromosome));offset=0;ticks=[]
            for i,c in enumerate(chrom):
                q=d[d.chromosome==c].sort_values('position');span=max(q.position.max(),1);xx=q.position+offset;ax.scatter(xx,-np.log10(q.p),s=5,color=[colors[0],'#a9b9ce'][i%2],lw=0,alpha=.8);ticks.append(offset+span/2);offset+=span*1.04
            ax.set_xticks(ticks,chrom);ax.tick_params(axis='x',labelsize=6.5);finish(ax,'Chromosome',r'$-\log_{10} P$')
    elif view in {'composition_ring','composition_waffle','ternary_composition'}:
        if view=='ternary_composition':
            a=d[['a','b','c']].to_numpy();a=a/a.sum(axis=1,keepdims=True);x=a[:,1]+a[:,2]/2;y=a[:,2]*np.sqrt(3)/2
            ax.plot([0,1,.5,0],[0,0,np.sqrt(3)/2,0],color='#9aa6b7',lw=.8)
            for f in [.25,.5,.75]:
                ax.plot([f/2,1-f/2],[f*np.sqrt(3)/2]*2,color='#e4e9f0',lw=.6)
            for i,g in enumerate(d.group.unique()):
                mask=d.group==g;ax.scatter(x[mask],y[mask],s=22,color=colors[i%len(colors)],label=g,alpha=.8,edgecolor='white',lw=.35)
            for xx,yy,label in [(0,-.06,'A'),(1,-.06,'B'),(.5,.93,'C')]:ax.text(xx,yy,label,ha='center',fontsize=9)
            ax.legend(loc='lower left',bbox_to_anchor=(0,1.04),ncol=3,fontsize=8,frameon=False);ax.set_aspect('equal');ax.axis('off')
        else:
            shares=d['count']/d['count'].sum();labels=[f'{n}  {v:.1%}' for n,v in zip(d.category,shares)]
            if view=='composition_ring':
                wedges,_=ax.pie(d['count'],colors=colors[:len(d)],startangle=90,counterclock=False,wedgeprops={'width':.25,'edgecolor':'white','linewidth':2});ax.text(0,.07,f'{d["count"].sum():g}',ha='center',va='center',fontsize=16,color='#344054');ax.text(0,-.17,'Total',ha='center',fontsize=8,color='#718096');ax.legend(wedges,labels,loc='center left',bbox_to_anchor=(.98,.5),frameon=False,fontsize=8)
            else:
                raw=100*shares.to_numpy();alloc=np.floor(raw).astype(int);alloc[np.argsort(-(raw-alloc),kind='stable')[:100-alloc.sum()]]+=1;indices=np.repeat(np.arange(len(d)),alloc)
                ax.scatter(np.tile(np.arange(10),10),np.repeat(np.arange(10),10),c=[colors[i] for i in indices],s=130,marker='s',edgecolor='white',lw=1.2)
                for i,label in enumerate(labels):ax.scatter([],[],s=35,marker='s',color=colors[i],label=label)
                ax.legend(loc='center left',bbox_to_anchor=(1,.5),frameon=False,fontsize=8);ax.set_aspect('equal');ax.axis('off')
            fig.subplots_adjust(left=.04,right=.61,bottom=.10,top=.94)
    elif view in {'paired_dumbbell','study_gantt'}:
        fig.set_size_inches(4.8,max(3.6,.27*len(d)+1.1));fig.subplots_adjust(left=.28,right=.94,bottom=.17,top=.91)
        if view=='paired_dumbbell':
            q=d.assign(delta=d.after-d.before).sort_values('delta');yy=np.arange(len(q));ax.hlines(yy,q.before,q.after,color='#c3ccd8',lw=1.7);ax.scatter(q.before,yy,s=25,color=colors[0],label='Before');ax.scatter(q.after,yy,s=25,color=colors[1],label='After');ax.set_yticks(yy,q.unit);ax.legend(loc='lower left',bbox_to_anchor=(0,1.01),ncol=2,frameon=False,fontsize=8);finish(ax,'Value')
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
            ax.set_xticks(range(len(groups)),groups);ax.legend(loc='lower left',bbox_to_anchor=(0,1.01),ncol=min(4,len(experiments)),fontsize=7,frameon=False);finish(ax,y='Value')
        else:
            factors=list(d.factor.unique());groups=list(d.group.unique());width=.7/len(groups)
            for j,g in enumerate(groups):
                for i,f in enumerate(factors):
                    v=d.loc[(d.factor==f)&(d.group==g),'value'].to_numpy()
                    if len(v)<2:raise ValueError('Each factor-group cell requires at least two independent observations')
                    pos=i+(j-(len(groups)-1)/2)*width;c=colors[j%len(colors)];ax.bar(pos,v.mean(),width*.8,color=c,alpha=.65,label=g if i==0 else None)
                    ax.errorbar(pos,v.mean(),yerr=v.std(ddof=1),fmt='none',color='#344054',lw=.8,capsize=2);ax.scatter(pos+rng.uniform(-width*.22,width*.22,len(v)),v,s=15,facecolor='white',edgecolor=c,lw=.7,zorder=3)
            ax.set_xticks(range(len(factors)),factors);ax.set_ylim(min(0,d.value.min()*1.1),max(0,d.value.max()*1.2));ax.legend(loc='lower left',bbox_to_anchor=(0,1.01),ncol=len(groups),fontsize=8,frameon=False);finish(ax,y='Value')
    elif view=='gsea_tracks':
        q=d.sort_values('rank');fig.delaxes(ax);grid=fig.add_gridspec(3,1,left=.18,right=.94,bottom=.19,top=.93,height_ratios=[3,.5,1],hspace=.08)
        a=fig.add_subplot(grid[0]);h=fig.add_subplot(grid[1],sharex=a);r=fig.add_subplot(grid[2],sharex=a)
        a.plot(q['rank'],q.running_score,color=colors[1],lw=1.6);a.axhline(0,color='#b9c4d3',lw=.7);finish(a,y='Running enrichment score');a.tick_params(labelbottom=False)
        h.vlines(q.loc[q['hit']==1,'rank'],0,1,color='#526173',lw=.65);h.axis('off')
        r.fill_between(q['rank'],q.rank_metric,color=colors[0],alpha=.3);finish(r,'Ranked feature list','Rank metric');return fig
    elif view=='coverage_tracks':
        tracks=list(d.track.unique());maximum=d.coverage.max()
        if maximum<=0:raise ValueError('At least one positive coverage value required')
        fig.set_size_inches(4.8,max(3.6,.42*len(tracks)+1));fig.subplots_adjust(left=.24,right=.95,bottom=.18,top=.93)
        for i,t in enumerate(tracks):
            q=d[d.track==t].sort_values('position');ax.fill_between(q.position,i,i+.78*q.coverage/maximum,color=colors[i%len(colors)],alpha=.7,lw=0);ax.plot(q.position,i+.78*q.coverage/maximum,color=colors[i%len(colors)],lw=.65)
        ax.set_yticks(range(len(tracks)),tracks);ax.spines[['left','top','right']].set_visible(False);ax.tick_params(axis='y',length=0);finish(ax,'Genomic position');fig.text(.24,.97,f'Common scale · maximum coverage {maximum:g}',fontsize=8,color='#526173')
    elif view=='quality_profiles':
        for i,(g,p) in enumerate(d.groupby('group',sort=False)):
            for _,q in p.groupby('sample'):q=q.sort_values('position');ax.plot(q.position,q.quality,color=colors[i%len(colors)],alpha=.2,lw=.6)
            q=p.groupby('position').quality.mean();ax.plot(q.index,q.values,color=colors[i%len(colors)],lw=1.6,label=g)
        ax.legend(loc='lower left',bbox_to_anchor=(0,1.01),ncol=3,frameon=False,fontsize=8);finish(ax,'Read position (bp)','Phred quality')
    elif view=='pca_loadings':
        fig.delaxes(ax);grid=fig.add_gridspec(4,4,left=.18,right=.93,bottom=.19,top=.94,hspace=.14,wspace=.14)
        ax=fig.add_subplot(grid[1:,:3]);top=fig.add_subplot(grid[0,:3],sharex=ax);right=fig.add_subplot(grid[1:,3],sharey=ax)
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
        # Label arrows in a reserved footer key; close endpoints never overlap text.
        load=d[d.role=='loading'];fig.subplots_adjust(bottom=.24)
        for i,(_,row) in enumerate(load.iterrows()):
            dx,dy=(7 if row.x>=0 else -7),(7 if row.y>=0 else -7)
            ax.annotate(str(i+1),(row.x,row.y),xytext=(dx,dy),textcoords='offset points',fontsize=7,color='#344054',ha='center',va='center',zorder=8,bbox={'boxstyle':'round,pad=.15','fc':'white','ec':'none','alpha':.95})
        fig.text(.18,.035,'  ·  '.join(f'{i+1}: {v}' for i,v in enumerate(load.id)),fontsize=7,color='#526173',wrap=True)
        ax.axhline(0,color='#dce2eb',ls=':',lw=.7);ax.axvline(0,color='#dce2eb',ls=':',lw=.7);finish(ax,'Component 1','Component 2');ax.legend(loc='best',fontsize=6.5,frameon=False);top.axis('off');right.axis('off')
    return fig

def generate(input_path,outdir,view,palette='zhoy_muted',colors_text=None,font='Arial'):
    style(font);d=pd.read_csv(input_path);colors=resolve_palette(palette,colors_text,8)
    compatible=[view]+[k for k in CONTRACTS if k!=view and CONTRACTS[k][3]==CONTRACTS[view][3]]
    figures=[(key,render(d,key,colors)) for key in compatible]
    recipe={'family':'gallery','input':_relative_input(Path(input_path),Path(outdir)),'palette':palette,'colors':colors_text,'font':font,'parameters':{'view':view}}
    analysis={'family':'gallery','view':view,'input_contract':CONTRACTS[view][3].split(),'description':NOTES[view][1],'inference':'Only explicitly documented summaries; no invented significance or source-model results'}
    return _save_bundle(Path(outdir),figures,{},analysis,recipe)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input',type=Path);parser.add_argument('output',type=Path);parser.add_argument('--view',required=True,choices=sorted(CONTRACTS));a=parser.parse_args();generate(a.input,a.output,a.view)
