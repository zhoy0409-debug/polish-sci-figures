"""Original ROC layouts for explicitly supplied analysis results.

Input CSV: series, role, x (FPR), y (sensitivity), optionally x_low, x_high,
y_low, y_high, weight. Curves are supplied results, not inferred study designs.
Supported roles: curve, empirical, fit, fold, study, pooled, operating.
Use raw-observation `roc` for binary analysis. This renderer does not fit time-
dependent or diagnostic meta-analysis models from curve coordinates.
"""
from pathlib import Path
import textwrap
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy.stats import norm
from figure_workbench import resolve_palette, style, FIGSIZE
from data_family_workbench import _save_bundle, _relative_input

VIEWS={'smooth','cutoff_ci','cost','cv','subgroups','partial','time','multi','sroc','convex','probit','training_validation'}

def validate(frame,view):
    if view not in VIEWS:raise ValueError('Unsupported ROC presentation')
    required=['series','role','x','y']
    if view=='cutoff_ci':required+=['x_low','x_high','y_low','y_high']
    if not set(required)<=set(frame.columns):raise ValueError('Required columns: '+', '.join(required))
    if frame.empty:raise ValueError('At least one ROC result is required')
    if frame[required].isna().any().any():raise ValueError('Required ROC fields cannot be missing')
    frame=frame.copy()
    for field in [c for c in frame if c in {'x','y','x_low','x_high','y_low','y_high','weight'}]:
        frame[field]=pd.to_numeric(frame[field],errors='raise')
        if not np.isfinite(frame[field]).all():raise ValueError('ROC values must be finite')
        if field!='weight' and not frame[field].between(0,1).all():raise ValueError('ROC coordinates must be between zero and one')
    if 'weight' in frame and (frame.weight<=0).any():raise ValueError('Study weights must be positive')
    if not set(frame.role)<={'curve','empirical','fit','fold','study','pooled','operating'}:raise ValueError('Unsupported ROC role')
    for _,part in frame[frame.role.isin(['curve','empirical','fit','fold'])].groupby(['series','role'],sort=False):
        if len(part)<2 or np.any(np.diff(part.x)<0) or np.any(np.diff(part.y)<0):raise ValueError('Curve points must be ordered with nondecreasing FPR and sensitivity')
    for axis in ['x','y']:
        if {axis+'_low',axis+'_high'}<=set(frame):
            if ((frame[axis+'_low']>frame[axis])|(frame[axis+'_high']<frame[axis])).any():raise ValueError('Intervals must contain their supplied estimate')
    needs={'smooth':{'empirical','fit'},'cutoff_ci':{'operating'},'cv':{'fold'},'sroc':{'study','fit','pooled'}}
    if not needs.get(view,set())<=set(frame.role):raise ValueError('Missing analysis-result roles for '+view)
    if view=='cv' and frame.loc[frame.role=='fold','series'].nunique()<2:raise ValueError('At least two held-out folds required')
    return frame

def upper_hull(x,y):
    points=[]
    for a,b in zip(x,y):
        if points and a==points[-1][0]:points[-1]=(a,max(b,points[-1][1]))
        else:points.append((a,b))
    hull=[]
    for point in points:
        while len(hull)>1:
            a,b=hull[-2:];cross=(b[0]-a[0])*(point[1]-b[1])-(b[1]-a[1])*(point[0]-b[0])
            if cross<0:break
            hull.pop()
        hull.append(point)
    return np.asarray(hull)

def partial_area(x,y,maximum):
    if not 0<maximum<=1:raise ValueError('Maximum FPR must lie in (0, 1]')
    if len(x)<2 or x[0]!=0 or x[-1]<maximum:raise ValueError('The supplied ROC must cover the complete requested FPR interval')
    keep=x<maximum;xx=np.r_[x[keep],maximum];yy=np.r_[y[keep],np.interp(maximum,x,y)]
    area=float(np.trapezoid(yy,xx) if hasattr(np,'trapezoid') else np.trapz(yy,xx))
    standardized=.5*(1+(area-.5*maximum**2)/(maximum-.5*maximum**2))
    return xx,yy,area,standardized

def render(frame,view,colors=None,max_fpr=.2,prevalence=None,cost_fn=None,cost_fp=None,figsize=FIGSIZE):
    data=validate(frame,view);colors=colors or resolve_palette('zhoy_muted',None,6)
    fig=plt.figure(figsize=figsize)
    # Fixed physical footer reserves annotation space without crowding the data.
    ax=fig.add_axes([.18,.34,.76,.58]);footer=fig.add_axes([.18,.025,.76,.16]);footer.set_axis_off()
    extent=[-2.5,2.5] if view=='probit' else [0,1]
    ax.plot(extent,extent,color='#c1c8d1',ls=':',lw=.75,zorder=0)
    curves=data[data.role.isin(['curve','empirical','fit','fold'])]
    groups=list(curves.groupby(['series','role'],sort=False));notes=[]
    if view=='subgroups':
        fig.delaxes(ax)
        if not groups or len(groups)>6:raise ValueError('A subgroup panel requires one to six supplied curves')
        columns=min(2,len(groups));rows=(len(groups)+columns-1)//columns
        grid=fig.add_gridspec(rows,columns,left=.16,right=.96,bottom=.18,top=.89,hspace=.90,wspace=.62)
        for i,((label,_),g) in enumerate(groups):
            small=fig.add_subplot(grid[i//columns,i%columns]);small.plot(g.x,g.y,lw=1.3,color=colors[i%len(colors)])
            small.plot([0,1],[0,1],ls=':',color='#c1c8d1',lw=.6)
            small.set(xlim=(0,1),ylim=(0,1.02),xticks=[0,.5,1],yticks=[0,.5,1])
            small.set_title(textwrap.fill(str(label),18),fontsize=8,pad=5);small.tick_params(labelsize=8,length=2)
            small.spines[['top','right']].set_visible(False)
        fig.text(.55,.035,'1 − specificity',ha='center',fontsize=8)
        fig.text(.035,.54,'Sensitivity',va='center',rotation=90,fontsize=8)
        fig.delaxes(footer);return fig
    if view=='cv':
        grid=np.linspace(0,1,151);ys=[]
        for i,((label,_),g) in enumerate([(key,g) for key,g in groups if key[1]=='fold']):
            ax.plot(g.x,g.y,color=colors[0],alpha=.18,lw=.7)
            ys.append(np.interp(grid,g.x,g.y))
        mean=np.mean(ys,axis=0);sd=np.std(ys,axis=0,ddof=1)
        ax.fill_between(grid,np.maximum(0,mean-sd),np.minimum(1,mean+sd),color=colors[0],alpha=.14)
        ax.plot(grid,mean,color=colors[0],lw=1.6,label='Mean held-out ROC')
        notes=[f'{len(ys)} folds · shading: ±1 SD','Supplied held-out predictions; no model refitting']
    else:
        for i,((label,role),g) in enumerate(groups):
            color=colors[i%len(colors)];x=g.x.to_numpy();y=g.y.to_numpy()
            if view=='smooth':color='#a9b1bc' if role=='empirical' else colors[0]
            if view=='probit':
                mask=(x>0)&(x<1)&(y>0)&(y<1);x=norm.ppf(x[mask]);y=norm.ppf(y[mask])
            ax.plot(x,y,color=color,lw=1.5 if role!='empirical' else .85,ls='--' if view=='training_validation' and i else '-',label=label)
            if view=='partial':
                xx,yy,area,standardized=partial_area(x,y,max_fpr)
                ax.fill_between(xx,yy,color=color,alpha=.13)
                ax.lines[-1].set_label(f'{label}: pAUC {area:.3f}')
                notes=[f'FPR range 0–{max_fpr:g} · shaded area = raw pAUC',f'McClish standardized pAUC = {standardized:.3f}' if len(groups)==1 else 'Raw pAUC reported separately for each curve']
            if view=='convex':
                h=upper_hull(x,y);ax.plot(h[:,0],h[:,1],color=color,lw=1.2,marker='o',ms=3,markerfacecolor='white')
                notes=['Empirical curve and upper convex hull','Hull segments may represent randomized operating rules']
            if view=='cost':
                if prevalence is None or cost_fn is None or cost_fp is None or not 0<prevalence<1 or min(cost_fn,cost_fp)<=0:raise ValueError('Cost view requires target prevalence and positive FN/FP costs')
                loss=cost_fn*prevalence*(1-y)+cost_fp*(1-prevalence)*x;k=int(np.argmin(loss));slope=cost_fp*(1-prevalence)/(cost_fn*prevalence)
                ax.scatter(x[k],y[k],s=24,color=color,zorder=4)
                line=np.array([0.,1.]);ax.plot(line,y[k]+slope*(line-x[k]),color=color,lw=.8,ls='--')
                notes=[f'Target prevalence {prevalence:.0%} · FN : FP = {cost_fn:g} : {cost_fp:g}',f'Iso-cost slope {slope:.3g} · minimum expected loss']
    if view=='cutoff_ci':
        for i,(_,p) in enumerate(data[data.role=='operating'].iterrows()):
            ax.errorbar(p.x,p.y,xerr=[[p.x-p.x_low],[p.x_high-p.x]],yerr=[[p.y-p.y_low],[p.y_high-p.y]],fmt='o',color=colors[i%len(colors)],capsize=3,ms=5,lw=1.1,label=p.series)
        notes=['Supplied interval estimates at a fixed cut-off','Interval method and selection rule must be recorded']
    if view=='sroc':
        pts=data[data.role=='study'];weights=pts.weight if 'weight' in pts else np.ones(len(pts))
        ax.scatter(pts.x,pts.y,s=110*np.asarray(weights)/max(weights),color=colors[0],alpha=.22,edgecolor=colors[0],lw=.65)
        pts=data[data.role=='pooled'];ax.scatter(pts.x,pts.y,marker='D',s=35,color='#2c394b',edgecolor='white',zorder=5)
        notes=['Study estimates + supplied summary-model fit','Circle area reflects the supplied study weight']
    if view=='smooth':notes=['Empirical ROC and supplied binormal-model fit','Model-based AUC is distinct from empirical AUC']
    if view=='time':notes=['Supplied cumulative/dynamic ROC estimates','Time horizon and censoring estimator recorded in recipe']
    if view=='multi':notes=['One-vs-rest curves; macro-average supplied separately']
    if view=='partial':ax.axvline(max_fpr,color='#8793a3',ls=':',lw=.8)
    if view=='probit':
        ticks=norm.ppf([.01,.1,.5,.9,.99]);ax.set(xticks=ticks,yticks=ticks,xticklabels=['.01','.1','.5','.9','.99'],yticklabels=['.01','.1','.5','.9','.99'],xlim=(-2.5,2.5),ylim=(-2.5,2.5));notes=['Probit coordinates; endpoints at 0 and 1 are excluded']
    else:ax.set(xlim=(0,1),ylim=(0,1.02),xticks=[0,.25,.5,.75,1],yticks=[0,.25,.5,.75,1])
    ax.set_xlabel('1 − specificity'+(' (probit)' if view=='probit' else ''),fontsize=8)
    ax.set_ylabel('Sensitivity'+(' (probit)' if view=='probit' else ''),fontsize=8)
    ax.tick_params(labelsize=8);ax.spines[['top','right']].set_visible(False)
    handles,labels=ax.get_legend_handles_labels()
    width=max(26,int(figsize[0]*.76*72/4.8))
    if handles:ax.legend(handles,[textwrap.fill(str(x),max(18,width//2)) for x in labels],frameon=False,fontsize=8,loc='lower right',labelspacing=.5,handlelength=1.5)
    lines=[wrapped for line in notes[:2] for wrapped in textwrap.wrap(line,width=width)]
    line_height=10/(figsize[1]*72*.16)
    for i,line in enumerate(lines):footer.text(0,.97-i*line_height,line,fontsize=8,color='#526173',va='top')
    return fig

def generate(input_path,outdir,view,method,palette='zhoy_muted',colors_text=None,font='Arial',max_fpr=.2,prevalence=None,cost_fn=None,cost_fp=None):
    data=pd.read_csv(input_path)
    if not method.strip():raise ValueError('A documented analysis method is required for supplied ROC results')
    style(font);fig=render(data,view,resolve_palette(palette,colors_text,6),max_fpr,prevalence,cost_fn,cost_fp)
    recipe={'family':'roc_results','input':_relative_input(input_path,outdir),'palette':palette,'colors':colors_text,'font':font,'parameters':{'view':view,'method':method,'max_fpr':max_fpr,'prevalence':prevalence,'cost_fn':cost_fn,'cost_fp':cost_fp}}
    analysis={'family':'roc_results','method':method,'inference':'supplied analysis results; this renderer does not refit the source model','source_sha256':__import__('hashlib').sha256(Path(input_path).read_bytes()).hexdigest()}
    return _save_bundle(Path(outdir),[('roc_'+view,fig)],{},analysis,recipe)
