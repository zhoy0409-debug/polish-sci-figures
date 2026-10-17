"""Summary-only data: preserve supplied summaries, never reconstruct observations."""
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
CONTRACTS={'summary_mean_sd':('均值与标准差','Supplied mean and SD','effects','group mean sd n','mean sd n')}
NOTES={'summary_mean_sd':('已提供的均值 ± SD 及样本量；不是置信区间。','Supplied means ± SD and sample sizes; not confidence intervals.')}

def validate(data,view):
    if view not in CONTRACTS or not set('group mean sd n'.split())<=set(data):raise ValueError('Supply group, mean, sd and n')
    d=data.copy()
    for key in ['mean','sd','n']:
        d[key]=pd.to_numeric(d[key],errors='raise')
        if not np.isfinite(d[key]).all():raise ValueError('Summary values must be finite')
    if not 1<=len(d)<=12 or d.group.isna().any() or d.group.astype(str).str.strip().eq('').any() or d.group.astype(str).str.len().gt(48).any() or d.group.duplicated().any():raise ValueError('Use 1–12 uniquely labelled groups with short labels')
    if (d.sd<0).any() or (d.n<2).any() or (d.n%1!=0).any():raise ValueError('SD must be nonnegative; n must be an integer >=2')
    return d

def render(data,view,colors=None,figsize=(4.8,3.6)):
    d=validate(data,view);fig,ax=plt.subplots(figsize=figsize,layout='constrained')
    colors=colors or ['#3f6da3','#c95770']
    for i,row in enumerate(d.itertuples()):
        ax.errorbar(row.mean,i,xerr=row.sd,fmt='o',color=colors[i%len(colors)],capsize=3)
    ax.set_yticks(range(len(d)),[f'{r.group} ($n$ = {int(r.n)})' for r in d.itertuples()]);ax.invert_yaxis()
    ax.set_xlabel('Supplied mean ± SD');ax.spines[['top','right']].set_visible(False)
    return fig

def fixtures():
    return {'summary_mean_sd':pd.DataFrame([['Control',1.5,.3,5],['Treatment',2.1,.4,5]],columns=['group','mean','sd','n'])}
