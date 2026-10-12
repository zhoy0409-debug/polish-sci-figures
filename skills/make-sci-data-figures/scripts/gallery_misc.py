"""Density-aware points and an explicit uncertainty comparison, from observations."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from scipy import stats

CONTRACTS={
 'distribution_sina':('密度约束散点','Density-constrained Sina points','distribution','group unit value','value'),
 'compare_uncertainty':('SD、SEM 与置信区间对照','SD, SEM and confidence intervals','distribution','group unit value','value')}
NOTES={
 'distribution_sina':('原始观测保留纵坐标；横向散布由组内核密度约束，便于观察集中与离散。','Original values are preserved; horizontal spread follows within-group kernel density.'),
 'compare_uncertainty':('同一批独立观测分别显示均值 ± SD、均值 ± SEM、均值 95% t 区间；三者含义不同。','Identical independent observations shown as mean ± SD, ± SEM, and 95% t intervals; these have different meanings.')}
REFERENCE_MAP={5:'distribution_sina',81:'compare_uncertainty'}
PRESERVE_ASPECT=set()
COMPATIBLE_GROUPS=[{'distribution_sina','compare_uncertainty'}]

def validate(data,view):
 if view not in CONTRACTS or not set(CONTRACTS[view][3].split())<=set(data):raise ValueError('Required columns: group, unit, value')
 d=data.copy();d['value']=pd.to_numeric(d.value,errors='raise')
 if d.empty or d[['group','unit','value']].isna().any().any() or not np.isfinite(d.value).all():raise ValueError('Complete finite observations required')
 if d.unit.duplicated().any():raise ValueError('Independent units must be unique')
 if d.group.nunique()>5:raise ValueError('Use at most five groups per panel')
 if any(len(q)<3 for _,q in d.groupby('group')):raise ValueError('At least three independent observations per group required')
 return d

def render(data,view,colors=None,figsize=(4.8,3.6)):
 d=validate(data,view);colors=colors or ['#3f6da3','#c95770','#93accb','#69758b','#b68b56']
 groups=list(d.group.unique());rng=np.random.default_rng(1502)
 n=3 if view=='compare_uncertainty' else 1
 # A portrait/narrow canvas stacks uncertainty panels, with shared value limits.
 stack=n>1 and figsize[0]<5.5
 fig,aa=plt.subplots(n if stack else 1,1 if stack else n,figsize=figsize,layout='constrained',squeeze=False,sharey=not stack)
 limits=(d.value.min()-.2*d.value.std(),d.value.max()+.2*d.value.std())
 for j,ax in enumerate(aa.flat):
  for i,g in enumerate(groups):
   v=d[d.group==g].value.to_numpy();c=colors[i%len(colors)];mean=v.mean();sd=v.std(ddof=1)
   if n==1:
    den=stats.gaussian_kde(v)(v) if np.ptp(v)>0 else np.ones(len(v));spread=.32*den/den.max()
    ax.scatter(i+rng.uniform(-1,1,len(v))*spread,v,s=14,color=c,alpha=.7,edgecolor='white',lw=.3)
    ax.plot([i-.13,i+.13],[np.median(v)]*2,color='#293b52',lw=1.1)
   else:
    err=[sd,sd/np.sqrt(len(v)),stats.t.ppf(.975,len(v)-1)*sd/np.sqrt(len(v))][j]
    if stack:ax.errorbar(mean,i,xerr=err,fmt='o',color=c,ms=4,capsize=3,lw=1)
    else:ax.errorbar(i,mean,yerr=err,fmt='o',color=c,ms=4,capsize=3,lw=1)
  ax.spines[['top','right']].set_visible(False);ax.tick_params(labelsize=8,pad=4)
  if stack:
   ax.set_yticks(range(len(groups)),groups);ax.set_ylim(-.5,len(groups)-.5);ax.invert_yaxis();ax.set_xlim(limits);ax.set_title(['Mean ± SD','Mean ± SEM','Mean · 95% t CI'][j],loc='left',fontsize=9)
   if j==2:ax.set_xlabel('Value',fontsize=9)
  else:
   ax.set_xticks(range(len(groups)),groups);ax.set_xlim(-.6,len(groups)-.4);ax.set_ylabel('Value' if j==0 else '',fontsize=9)
   if n>1:ax.set_title(['Mean ± SD','Mean ± SEM','Mean · 95% t CI'][j],fontsize=9)
 return fig

def fixtures():
 rng=np.random.default_rng(717)
 d=pd.DataFrame([[g,f'{g}{i}',float(rng.normal(m,1))] for g,m in [('Control',10),('Treatment',13),('Rescue',11)] for i in range(25)],columns=['group','unit','value'])
 return {key:d.copy() for key in CONTRACTS}
