"""Empirical ROC views: no smoothing, invented cohorts, or new inference."""
import numpy as np
import textwrap
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from figure_workbench import sequential_cmap

KINDS = ('auc_fill','threshold_points','threshold_color','threshold_labels','youden',
         'direct_labels','facets','low_fpr','log_fpr','auc_intervals','two_graph','confusion')


def _facet_grid(records,figsize,bottom=.23,top=.86):
    columns=min(len(records),2);rows=(len(records)+columns-1)//columns
    fig,axes=plt.subplots(rows,columns,figsize=figsize,squeeze=False)
    fig.subplots_adjust(left=.16,right=.96,bottom=bottom,top=top,wspace=.56,hspace=.80)
    for ax in axes.flat[len(records):]:ax.set_visible(False)
    return fig,axes,columns


def _axis(ax,x='1 − specificity',y='Sensitivity',small=False):
    ax.set_xlabel(x,fontsize=8,labelpad=5);ax.set_ylabel(y,fontsize=8,labelpad=5)
    ax.tick_params(labelsize=8,length=2.5,pad=3);ax.spines[['top','right']].set_visible(False)
    if small:ax.set(xticks=[0,.5,1],yticks=[0,.5,1])


def _caption(fig,text,y=.02):
    width=max(32,int(fig.get_figwidth()*72/4.8));fig.text(.5,y,textwrap.fill(text,width),ha='center',va='bottom',fontsize=8,color='#65748a')

def operating_point_figure(records, figsize, matrix=False):
    """Separate the data plot from the numeric summary; no text placed over curves."""
    fig=plt.figure(figsize=figsize)
    columns=min(2,len(records));rows=(len(records)+columns-1)//columns
    grid=fig.add_gridspec(rows,columns,left=.15,right=.97,bottom=.05,top=.9,wspace=.45,hspace=.65)
    for i,r in enumerate(records):
        cell=grid[i//columns,i%columns].subgridspec(2,1,height_ratios=[3,1.55],hspace=.60)
        ax=fig.add_subplot(cell[0]);info=fig.add_subplot(cell[1]);info.set_axis_off()
        x,y,t=r['fpr'],r['tpr'],r['thresholds'];indices=np.flatnonzero(np.isfinite(t))
        k=indices[np.argmax((y-x)[indices])];cut=t[k];color=r['color']
        ax.plot(x,y,color=color,lw=1.3);ax.plot([0,1],[0,1],ls=':',color='#bdc4ce',lw=.65)
        ax.scatter(x[k],y[k],s=22,color=color,edgecolor='white',linewidth=.5,zorder=4)
        if not matrix:ax.plot([x[k],x[k]],[x[k],y[k]],color=color,lw=.85)
        ax.set(xlim=(0,1),ylim=(0,1.02),xticks=[0,.5,1],yticks=[0,.5,1])
        ax.set_title(textwrap.fill(r['label'],18),fontsize=8,pad=6);_axis(ax,y='Sensitivity' if i%columns==0 else '',small=True)
        if matrix:
            positive=r['scores']>=cut;truth=np.asarray(r['truth'],dtype=bool)
            cells=[[np.sum(truth&positive),np.sum(truth&~positive)],[np.sum(~truth&positive),np.sum(~truth&~positive)]]
            table=info.table(cellText=cells,colLabels=['Pred +','Pred −'],rowLabels=['Actual +','Actual −'],cellLoc='center',bbox=[.30,.02,.68,.73])
            table.auto_set_font_size(False);table.set_fontsize(8)
            for (row,col),patch in table.get_celld().items():
                patch.set_edgecolor('#dce2ea');patch.set_linewidth(.5)
                patch.set_facecolor('#f0f3f8' if row==0 or col==-1 else 'white')
            info.text(.5,.94,f'Cut-off {cut:.3g} · max J',ha='center',fontsize=8,color='#465568')
        else:
            for y_pos,left,right in [( .84,'Max J',f'{y[k]-x[k]:.2f}'),(.53,'Cut-off',f'{cut:.3g}'),(.22,'Se / Sp',f'{y[k]:.2f} / {1-x[k]:.2f}')]:
                info.text(.02,y_pos,left,fontsize=8,color='#697586',va='center')
                info.text(.98,y_pos,right,fontsize=8,color='#273449',ha='right',va='center')
    return fig

def render_views(records, figsize=(4.8,3.6), views=None):
    if not records:raise ValueError('At least one ROC record is required')
    views=None if views is None else {str(v).removeprefix('roc_') for v in views}
    outputs=[]
    for kind in KINDS:
        if views is not None and kind not in views:continue
        if kind in {'youden','confusion'}:
            outputs.append(('roc_'+kind,operating_point_figure(records,figsize,kind=='confusion')))
            continue
        faceted=kind in {'threshold_color','threshold_labels','youden','facets','two_graph','confusion'}
        n=len(records) if faceted else 1
        cols=min(n,2);rows=(n+cols-1)//cols
        fig,axes=plt.subplots(rows,cols,figsize=figsize,squeeze=False)
        fig.subplots_adjust(left=.17,right=.94,bottom=.23,top=.87,wspace=.60,hspace=.85)
        if kind=='auc_intervals':fig.subplots_adjust(left=.30)
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
                ax.set(xlabel='Score threshold',ylabel='Rate',ylim=(0,1.02))
            elif kind=='auc_intervals':
                ci=r['ci'];ax.errorbar(r['auc'],i,xerr=[[max(0,r['auc']-ci[0])],[max(0,ci[1]-r['auc'])]],fmt='o',color=color,capsize=3)
                ax.set(xlim=(0,1),xlabel='AUC (bootstrap 95% CI)',yticks=range(len(records)),yticklabels=[v['label'] for v in records]);ax.axvline(.5,color='#aaaaaa',ls=':',lw=.7)
            else:
                px,py=(x[x>0],y[x>0]) if kind=='log_fpr' else (x,y)
                ax.plot(px,py,color='#9faab5' if kind=='threshold_color' else color,lw=1.4,label=f"{label}  AUC {r['auc']:.2f}")
                if kind=='auc_fill':ax.fill_between(x,y,alpha=.12,color=color)
                if kind=='threshold_points':ax.scatter(x[finite],y[finite],s=8,color=color)
                if kind=='threshold_color':
                    dots=ax.scatter(x[finite],y[finite],c=t[finite],cmap=cmap,norm=norm,s=11,zorder=3)
                if kind=='threshold_labels':
                    for k in idx[np.unique(np.linspace(0,len(idx)-1,min(4,len(idx))).astype(int))]:
                        ax.scatter(x[k],y[k],s=14,color=color);ax.annotate(f'{t[k]:.2g}',(x[k],y[k]),xytext=(-4 if x[k]>.7 else 4,-12 if y[k]>.8 else 7),ha='right' if x[k]>.7 else 'left',textcoords='offset points',fontsize=8)
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
                    k=idx[min(len(idx)-1,int((i+1)/(len(records)+1)*len(idx)))];ax.annotate(textwrap.fill(label,16),(x[k],y[k]),xytext=(4,-12-i*7),textcoords='offset points',color=color,fontsize=8)
                ax.set(xlabel='1 − specificity',ylabel='Sensitivity',ylim=(0,1.02))
                if kind!='log_fpr':ax.set_xlim(0,1)
                if kind=='low_fpr':ax.set_xlim(0,.2);ax.set_xticks([0,.05,.10,.15,.20])
                if kind=='log_fpr':ax.set_xscale('log');ax.set_xlim(max(min(v['fpr'][v['fpr']>0].min() for v in records)/2,1e-5),1)
                if i==0 or faceted:
                    reference=np.geomspace(ax.get_xlim()[0],1,180) if kind=='log_fpr' else np.array([0.,1.])
                    ax.plot(reference,reference,color='#aaaaaa',ls='--',lw=.6)
                if not faceted and kind!='direct_labels':ax.legend(frameon=False,fontsize=8,loc='lower right')
            if faceted:ax.set_title(textwrap.fill(label,18),fontsize=8)
            _axis(ax,ax.get_xlabel(),ax.get_ylabel(),small=faceted and kind!='two_graph')
            if faceted and i%cols:ax.set_ylabel('')
            if kind=='threshold_color':
                ax.set_xticks([0,.5,1]);ax.set_yticks([0,.5,1])
                ax.set_xlabel('1 − specificity',fontsize=8)
                ax.set_ylabel('Sensitivity' if i%cols==0 else '',fontsize=8)
        if kind=='threshold_color':
            cax=fig.add_axes([.30,.12,.50,.025])
            bar=fig.colorbar(dots,cax=cax,orientation='horizontal')
            bar.set_label('Score threshold',fontsize=8,labelpad=3)
            bar.ax.tick_params(labelsize=8,pad=2,length=2);bar.outline.set_linewidth(.5)
            if bar.solids is not None:bar.solids.set_rasterized(False)
        if kind=='two_graph':
            from matplotlib.lines import Line2D
            fig.legend([Line2D([],[],color='#52677f'),Line2D([],[],color='#52677f',ls='--')],['Sensitivity','Specificity'],loc='lower center',bbox_to_anchor=(.5,.015),ncol=2,frameon=False,fontsize=8)
        if kind=='low_fpr':fig.suptitle('Low false-positive region (FPR ≤ 0.20)',fontsize=9)
        if kind=='log_fpr':fig.suptitle('Log FPR scale; zero-FPR points outside view',fontsize=8)
        outputs.append(('roc_'+kind,fig))
    outputs.extend(render_uncertainty_views(records, figsize,views=views))
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


def render_uncertainty_views(records,figsize,views=None):
    outputs=[];eligible=all(np.sum(r['truth'])>=2 and np.sum(~np.asarray(r['truth'],dtype=bool))>=2 for r in records)
    wanted=lambda name:views is None or name in views
    if eligible and any(wanted(k) for k in ('pointwise_band','bootstrap_curves')):
        resamples=[bootstrap_curves(r['truth'],r['scores']) for r in records]
        for kind in ('pointwise_band','bootstrap_curves'):
            if not wanted(kind):continue
            fig,axes,columns=_facet_grid(records,figsize,bottom=.30,top=.86)
            for i,(ax,r,(grid,curves)) in enumerate(zip(axes.flat,records,resamples)):
                if kind=='pointwise_band':
                    lo,hi=np.quantile(curves,[.025,.975],axis=0);ax.fill_between(grid,lo,hi,color=r['color'],alpha=.2,label='Pointwise 95% interval')
                else:
                    for curve in curves[:100]:ax.plot(grid,curve,color=r['color'],alpha=.06,lw=.5)
                ax.plot(r['fpr'],r['tpr'],color=r['color'],lw=1.5);ax.plot([0,1],[0,1],ls=':',color='#999999',lw=.7)
                ax.set(xlim=(0,1),ylim=(0,1.02));ax.set_title(textwrap.fill(r['label'],18),fontsize=8);_axis(ax,y='Sensitivity' if i%columns==0 else '',small=len(records)>1)
            _caption(fig,'500 stratified bootstrap samples · fixed predictions'+(' · pointwise, not simultaneous' if kind=='pointwise_band' else ' · first 100 displayed'))
            outputs.append(('roc_'+kind,fig))
    if wanted('score_distribution'):
        fig,axes=plt.subplots(2,len(records),figsize=figsize,squeeze=False)
        fig.subplots_adjust(left=.17,right=.96,bottom=.24,top=.89,wspace=.60,hspace=1.02)
        for j,r in enumerate(records):
            truth=np.asarray(r['truth'],dtype=bool);scores=np.asarray(r['scores']);bins=np.histogram_bin_edges(scores,bins='auto')
            for mask,label,color,ls in [(~truth,'Negative','#98a7bb','--'),(truth,'Positive',r['color'],'-')]:axes[0,j].hist(scores[mask],bins=bins,density=True,histtype='step',lw=1.2,color=color,label=label,ls=ls)
            axes[0,j].set_title(textwrap.fill(r['label'],18),fontsize=8);_axis(axes[0,j],'Prediction score','Density' if j==0 else '')
            axes[1,j].plot(r['fpr'],r['tpr'],color=r['color']);axes[1,j].plot([0,1],[0,1],ls=':',color='#999999',lw=.7);axes[1,j].set(xlim=(0,1),ylim=(0,1.02));_axis(axes[1,j],y='Sensitivity' if j==0 else '',small=len(records)>1)
        from matplotlib.lines import Line2D
        fig.legend([Line2D([],[],color='#98a7bb',ls='--'),Line2D([],[],color='#3b526f')],['Negative','Positive'],loc='lower center',bbox_to_anchor=(.5,.008),ncol=2,frameon=False,fontsize=8)
        outputs.append(('roc_score_distribution',fig))
    if wanted('with_auc_forest'):
        fig=plt.figure(figsize=figsize)
        if figsize[0]>=5.8:
            ax=fig.add_axes([.12,.22,.42,.67]);forest=fig.add_axes([.75,.22,.22,.67])
        else:
            ax=fig.add_axes([.17,.49,.77,.40]);forest=fig.add_axes([.32,.17,.62,.12])
        for i,r in enumerate(records):
            ax.plot(r['fpr'],r['tpr'],color=r['color'],label=r['label']);lo,hi=r['ci'];forest.errorbar(r['auc'],i,xerr=[[max(0,r['auc']-lo)],[max(0,hi-r['auc'])]],fmt='o',color=r['color'],capsize=3)
        ax.plot([0,1],[0,1],ls=':',color='#999999',lw=.7);ax.set(xlim=(0,1),ylim=(0,1.02));ax.legend(frameon=False,fontsize=8);_axis(ax)
        forest.set(yticks=range(len(records)),yticklabels=[textwrap.fill(r['label'],15) for r in records],xlim=(0,1),ylim=(-.5,len(records)-.5));forest.axvline(.5,ls=':',color='#999999');_axis(forest,'AUC (95% CI)','')
        forest.set_xticks([0,.5,1]);outputs.append(('roc_with_auc_forest',fig))
    return outputs
