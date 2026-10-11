"""Original data-driven distribution views, sharing the workbench's analysis."""
import numpy as np
import matplotlib.pyplot as plt
from scipy.stats import gaussian_kde

def render(work,group,value,order,colors,ylabel,analysis,figsize):
    from figure_workbench import density_outline,add_stat_line,clean_axis
    arrays=[work.loc[work[group].astype(str)==g,value].to_numpy(float) for g in order]
    results=[];rng=np.random.default_rng(2317)
    dense=all(len(v)>=10 and np.ptp(v)>0 for v in arrays)
    kinds=['group_ecdf','quantile_intervals']+(['raincloud_horizontal','sina_points','ridgeline'] if dense else [])
    for kind in kinds:
        fig,ax=plt.subplots(figsize=figsize)
        fig.subplots_adjust(left=.23,right=.96,bottom=.20,top=.82)
        for i,(values,color) in enumerate(zip(arrays,colors)):
            q1,median,q3=np.percentile(values,[25,50,75])
            if kind=='group_ecdf':
                xx=np.sort(values);yy=np.arange(1,len(values)+1)/len(values)
                ax.step(xx,yy,where='post',color=color,lw=1.35,label=order[i])
            elif kind=='quantile_intervals':
                low,high=np.percentile(values,[10,90]);ax.plot([low,high],[i,i],color=color,lw=1.2)
                ax.plot([q1,q3],[i,i],color=color,lw=5,solid_capstyle='round',alpha=.45)
                ax.scatter([median],[i],s=26,color=color,edgecolor='white',linewidth=.7,zorder=5)
            elif kind=='sina_points':
                kde=gaussian_kde(values);width=kde(values);width=.27*width/width.max()
                offset=rng.uniform(-1,1,len(values))*width
                ax.scatter(i+offset,values,s=19,color=color,edgecolor='white',lw=.35,alpha=.85)
                ax.hlines(median,i-.11,i+.11,color='#344054',lw=1.2)
            else:
                support,density=density_outline(values);baseline=float(i)
                ax.fill_between(support,baseline,baseline+.46*density,color=color,alpha=.16,lw=0)
                ax.plot(support,baseline+.46*density,color=color,lw=.95)
                if kind=='raincloud_horizontal':
                    ax.scatter(values,baseline-rng.uniform(.17,.30,len(values)),s=16,color=color,alpha=.8,edgecolor='white',lw=.35,zorder=4)
                    ax.plot([q1,q3],[baseline-.065]*2,color=color,lw=3,solid_capstyle='round')
                    ax.scatter([median],[baseline-.065],s=15,color='white',edgecolor=color,lw=.8,zorder=5)
                else:
                    ax.plot(values,np.full(len(values),baseline-.025),'|',color=color,ms=3,alpha=.6)
        if kind=='sina_points':ax.set(xticks=range(len(order)),xticklabels=order,xlim=(-.5,len(order)-.5),ylabel=ylabel)
        elif kind=='group_ecdf':
            ax.set(xlabel=ylabel,ylabel='Cumulative proportion',ylim=(0,1.03));ax.legend(frameon=False,fontsize=7,loc='lower right')
        else:
            ax.set(yticks=range(len(order)),yticklabels=order,xlabel=ylabel,ylim=(-.48,len(order)-.38));ax.spines['left'].set_visible(False);ax.tick_params(axis='y',length=0)
        clean_axis(ax);add_stat_line(fig,analysis)
        results.append((kind,fig))
    return results
