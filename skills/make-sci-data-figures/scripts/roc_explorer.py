"""Empirical ROC views: no smoothing, invented cohorts, or new inference."""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from figure_workbench import sequential_cmap

KINDS = ('auc_fill','threshold_points','threshold_color','threshold_labels','youden',
         'direct_labels','facets','low_fpr','log_fpr','auc_intervals','two_graph','confusion')

def render_views(records, figsize):
    outputs=[]
    for kind in KINDS:
        faceted=kind in {'threshold_color','threshold_labels','youden','facets','two_graph','confusion'}
        n=len(records) if faceted else 1
        cols=min(n,2);rows=(n+cols-1)//cols
        fig,axes=plt.subplots(rows,cols,figsize=figsize,squeeze=False)
        fig.subplots_adjust(left=.16,right=.96,bottom=.19,top=.88,wspace=.55,hspace=.7)
        if kind=='threshold_color':
            # One shared numeric scale and a dedicated colourbar strip prevent
            # per-facet colour meanings and overlapping y-axis/colourbar labels.
            thresholds=np.concatenate([r['thresholds'][np.isfinite(r['thresholds'])] for r in records])
            norm=Normalize(float(thresholds.min()),float(thresholds.max()))
            cmap=sequential_cmap(records[0]['color'])
            fig.subplots_adjust(left=.14,right=.96,bottom=.33,top=.88,wspace=.36,hspace=.8)
        for ax in axes.flat[n:]:ax.set_visible(False)
        for i,r in enumerate(records):
            ax=axes.flat[i if faceted else 0]
            x,y,t=r['fpr'],r['tpr'],r['thresholds'];color=r['color'];label=r['label']
            finite=np.isfinite(t);idx=np.flatnonzero(finite)
            if kind=='two_graph':
                ax.plot(t[finite],y[finite],color=color,label='Sensitivity')
                ax.plot(t[finite],1-x[finite],color=color,ls='--',label='Specificity')
                ax.set(xlabel='Score threshold',ylabel='Rate',ylim=(0,1.02));ax.legend(frameon=False,fontsize=6)
            elif kind=='auc_intervals':
                ci=r['ci'];ax.errorbar(r['auc'],i,xerr=[[max(0,r['auc']-ci[0])],[max(0,ci[1]-r['auc'])]],fmt='o',color=color,capsize=3)
                ax.set(xlim=(0,1),xlabel='AUC (bootstrap 95% CI)',yticks=range(len(records)),yticklabels=[v['label'] for v in records]);ax.axvline(.5,color='#aaaaaa',ls=':',lw=.7)
            else:
                ax.plot(x,y,color='#9faab5' if kind=='threshold_color' else color,lw=1.4,label=f"{label}  AUC {r['auc']:.2f}")
                if kind=='auc_fill':ax.fill_between(x,y,alpha=.12,color=color)
                if kind=='threshold_points':ax.scatter(x[finite],y[finite],s=8,color=color)
                if kind=='threshold_color':
                    dots=ax.scatter(x[finite],y[finite],c=t[finite],cmap=cmap,norm=norm,s=11,zorder=3)
                if kind=='threshold_labels':
                    for k in idx[np.unique(np.linspace(0,len(idx)-1,min(4,len(idx))).astype(int))]:
                        ax.scatter(x[k],y[k],s=10,color=color);ax.annotate(f'{t[k]:.2g}',(x[k],y[k]),xytext=(3,-9),textcoords='offset points',fontsize=6)
                if kind in {'youden','confusion'}:
                    k=idx[np.argmax((y-x)[finite])];cut=t[k]
                    ax.scatter(x[k],y[k],s=20,color=color,zorder=4)
                    if kind=='youden':
                        ax.plot([x[k],x[k]],[x[k],y[k]],color=color,lw=.9)
                        ax.text(.98,.05,f'Exploratory max J = {y[k]-x[k]:.2f}\nThreshold {cut:.3g}\nSe {y[k]:.2f}; Sp {1-x[k]:.2f}',ha='right',transform=ax.transAxes,fontsize=6)
                    else:
                        positive=r['scores']>=cut;truth=r['truth'].astype(bool)
                        cells=[[int(np.sum(truth&positive)),int(np.sum(truth&~positive))],[int(np.sum(~truth&positive)),int(np.sum(~truth&~positive))]]
                        ax.table(cellText=cells,rowLabels=['Actual +','Actual -'],colLabels=['Pred +','Pred -'],bbox=[.40,.07,.56,.28])
                        ax.text(.98,.40,f'Exploratory max J\nThreshold {cut:.3g}',ha='right',transform=ax.transAxes,fontsize=6)
                if kind=='direct_labels':
                    k=idx[min(len(idx)-1,int((i+1)/(len(records)+1)*len(idx)))];ax.annotate(label,(x[k],y[k]),xytext=(4,-8-i*5),textcoords='offset points',color=color,fontsize=7)
                ax.set(xlabel='1 − specificity',ylabel='Sensitivity',ylim=(0,1.02))
                if kind!='log_fpr':ax.set_xlim(0,1)
                if kind=='low_fpr':ax.set_xlim(0,.2)
                if kind=='log_fpr':ax.set_xscale('log');ax.set_xlim(max(min(v['fpr'][v['fpr']>0].min() for v in records)/2,1e-5),1)
                if i==0 or faceted:ax.plot([0,1],[0,1],color='#aaaaaa',ls='--',lw=.6)
                if not faceted and kind!='direct_labels':ax.legend(frameon=False,fontsize=6,loc='lower right')
            if faceted:ax.set_title(label,fontsize=8)
            ax.spines[['top','right']].set_visible(False);ax.tick_params(labelsize=7)
            if kind=='threshold_color':
                ax.set_xticks([0,.5,1]);ax.set_yticks([0,.5,1])
                ax.set_xlabel('1 − specificity',fontsize=8)
                ax.set_ylabel('Sensitivity' if i%cols==0 else '',fontsize=8)
        if kind=='threshold_color':
            cax=fig.add_axes([.30,.12,.50,.025])
            bar=fig.colorbar(dots,cax=cax,orientation='horizontal')
            bar.set_label('Score threshold',fontsize=7,labelpad=2)
            bar.ax.tick_params(labelsize=6,pad=2,length=2);bar.outline.set_linewidth(.5)
        if kind=='low_fpr':fig.suptitle('Low false-positive region (FPR ≤ 0.20)',fontsize=9)
        if kind=='log_fpr':fig.suptitle('Log FPR scale; zero-FPR points outside view',fontsize=8)
        outputs.append(('roc_'+kind,fig))
    outputs.extend(render_uncertainty_views(records, figsize))
    return outputs


def bootstrap_curves(truth, scores, repetitions=500):
    """Stratified observation bootstrap for independent units, fixed scores (no model refit)."""
    truth=np.asarray(truth,dtype=bool);scores=np.asarray(scores,dtype=float)
    pos=np.flatnonzero(truth);neg=np.flatnonzero(~truth)
    if len(pos)<2 or len(neg)<2:raise ValueError('At least two observations per class are required')
    grid=np.linspace(0,1,101);rng=np.random.default_rng(20261012);curves=[]
    for _ in range(repetitions):
        index=np.r_[rng.choice(pos,len(pos)),rng.choice(neg,len(neg))]
        order=np.argsort(-scores[index],kind='stable');y=truth[index][order];z=scores[index][order]
        ends=np.r_[np.flatnonzero(np.diff(z)),len(z)-1]
        tpr=np.r_[0,np.cumsum(y)[ends]/len(pos)];fpr=np.r_[0,np.cumsum(~y)[ends]/len(neg)]
        curves.append(np.interp(grid,fpr,tpr))
    return grid,np.asarray(curves)


def render_uncertainty_views(records,figsize):
    outputs=[];eligible=all(np.sum(r['truth'])>=2 and np.sum(~np.asarray(r['truth'],dtype=bool))>=2 for r in records)
    if eligible:
        resamples=[bootstrap_curves(r['truth'],r['scores']) for r in records]
        for kind in ('pointwise_band','bootstrap_curves'):
            fig,axes=plt.subplots(1,len(records),figsize=figsize,squeeze=False)
            for ax,r,(grid,curves) in zip(axes.flat,records,resamples):
                if kind=='pointwise_band':
                    lo,hi=np.quantile(curves,[.025,.975],axis=0);ax.fill_between(grid,lo,hi,color=r['color'],alpha=.2,label='Pointwise 95% interval')
                else:
                    for curve in curves[:100]:ax.plot(grid,curve,color=r['color'],alpha=.06,lw=.5)
                ax.plot(r['fpr'],r['tpr'],color=r['color'],lw=1.5);ax.plot([0,1],[0,1],ls=':',color='#999999',lw=.7)
                ax.set(xlabel='1 − specificity',ylabel='Sensitivity',xlim=(0,1),ylim=(0,1.02),title=r['label']);ax.spines[['top','right']].set_visible(False)
            fig.suptitle('500 stratified bootstrap samples · fixed predictions'+(' · pointwise, not simultaneous' if kind=='pointwise_band' else ' · first 100 displayed'),fontsize=7)
            fig.tight_layout(rect=[0,0,1,.92]);outputs.append(('roc_'+kind,fig))
    fig,axes=plt.subplots(2,len(records),figsize=figsize,squeeze=False)
    for j,r in enumerate(records):
        truth=np.asarray(r['truth'],dtype=bool);scores=np.asarray(r['scores']);bins=np.histogram_bin_edges(scores,bins='auto')
        for mask,label,color in [(~truth,'Negative','#466a90'),(truth,'Positive',r['color'])]:axes[0,j].hist(scores[mask],bins=bins,density=True,histtype='step',lw=1.3,color=color,label=label)
        axes[0,j].set(xlabel='Prediction score',ylabel='Density',title=r['label']);axes[0,j].legend(frameon=False,fontsize=7)
        axes[1,j].plot(r['fpr'],r['tpr'],color=r['color']);axes[1,j].plot([0,1],[0,1],ls=':',color='#999999',lw=.7);axes[1,j].set(xlabel='1 − specificity',ylabel='Sensitivity',xlim=(0,1),ylim=(0,1.02))
        for ax in axes[:,j]:ax.spines[['top','right']].set_visible(False)
    fig.tight_layout();outputs.append(('roc_score_distribution',fig))
    fig,(ax,forest)=plt.subplots(1,2,figsize=figsize,gridspec_kw={'width_ratios':[1.6,1]})
    for i,r in enumerate(records):
        ax.plot(r['fpr'],r['tpr'],color=r['color'],label=r['label']);lo,hi=r['ci'];forest.errorbar(r['auc'],i,xerr=[[max(0,r['auc']-lo)],[max(0,hi-r['auc'])]],fmt='o',color=r['color'],capsize=3)
    ax.plot([0,1],[0,1],ls=':',color='#999999',lw=.7);ax.set(xlabel='1 − specificity',ylabel='Sensitivity',xlim=(0,1),ylim=(0,1.02));ax.legend(frameon=False,fontsize=7)
    forest.set(yticks=range(len(records)),yticklabels=[r['label'] for r in records],xlim=(0,1),xlabel='AUC (95% CI)');forest.axvline(.5,ls=':',color='#999999')
    for a in (ax,forest):a.spines[['top','right']].set_visible(False)
    fig.tight_layout();outputs.append(('roc_with_auc_forest',fig));return outputs
