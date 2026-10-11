import sys,numpy as np
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'skills/make-sci-data-figures/scripts'))
from advanced_template_workbench import _roc_points,_trapezoid
x,y,_,t=_roc_points(np.array([0,1,0,1]),np.array([.5,.5,.5,.5]))
assert list(x)==[0,1] and list(y)==[0,1] and _trapezoid(y,x)==.5
from roc_explorer import render_views,KINDS
r=dict(fpr=x,tpr=y,thresholds=t,color='#4477aa',label='Tied scores',auc=.5,ci=[.3,.7],truth=np.array([0,1,0,1]),scores=np.array([.5,.5,.5,.5]))
figs=render_views([r],(4.8,3.6));assert len(figs)==16
for _,fig in figs:fig.canvas.draw()
print('Tied thresholds, invariant AUC and all 16 ROC renderers passed')

from roc_explorer import bootstrap_curves
grid,curves=bootstrap_curves(r["truth"],r["scores"],40)
assert curves.shape==(40,101)
assert np.allclose(curves,grid[None,:])
assert np.all(np.diff(curves,axis=1)>=0)
print("Stratified bootstrap tied-score invariance and monotonicity passed")
