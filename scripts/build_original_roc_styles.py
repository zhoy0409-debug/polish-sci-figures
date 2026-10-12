"""Generate our ROC sample layouts from deterministic synthetic result tables.

No reference image, copied artwork or third-party R source is read.
The saved CSV and recipe can be rendered again through the local data engine.
"""
import io,json,sys
from pathlib import Path
import numpy as np
import pandas as pd
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
from figure_workbench import style
from advanced_template_workbench import _roc_points
from roc_contract_workbench import render,VIEWS
from scipy.stats import norm
import matplotlib.pyplot as plt

def fixtures():
    rng=np.random.default_rng(2317);truth=np.r_[np.zeros(80),np.ones(80)].astype(int)
    scores=rng.normal(truth*1.4,1)
    x,y,_,_= _roc_points(truth,scores)
    def curve(label,x=x,y=y,role='curve'):
        return [{'series':label,'role':role,'x':float(a),'y':float(b)} for a,b in zip(x,y)]
    base=curve('Model A')
    output={key:(pd.DataFrame(base),{}) for key in ['partial','convex','probit','cost']}
    output['cost'][1].update(prevalence=.25,cost_fn=3.,cost_fp=1.)
    output['partial'][1].update(max_fpr=.2)
    grid=np.linspace(.001,.999,180)
    neg=scores[truth==0];pos=scores[truth==1]
    fit=norm.cdf((pos.mean()-neg.mean())/pos.std(ddof=0)+neg.std(ddof=0)/pos.std(ddof=0)*norm.ppf(grid))
    output['smooth']=(pd.DataFrame(curve('Empirical',role='empirical')+curve('Binormal fit',grid,fit,'fit')), {})
    # Fixed threshold specified before sampling; Wilson intervals are not selection CIs.
    cut=.7;pred=scores>=cut;se=np.mean(pred[truth==1]);fp=np.mean(pred[truth==0])
    def wilson(p,n):
        z=norm.ppf(.975);center=(p+z*z/(2*n))/(1+z*z/n);half=z*np.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
        return center-half,center+half
    xl,xh=wilson(fp,80);yl,yh=wilson(se,80)
    ci=[{'series':'Fixed cut-off 0.70','role':'operating','x':fp,'y':se,'x_low':xl,'x_high':xh,'y_low':yl,'y_high':yh}]
    output['cutoff_ci']=(pd.DataFrame(ci),{})
    rows=[]
    for i in range(5):
        yy=np.r_[np.zeros(30),np.ones(30)].astype(int);ss=rng.normal(yy*(1.2+.12*i),1)
        xx,tt,_,_=_roc_points(yy,ss);rows+=curve(f'Fold {i+1}',xx,tt,'fold')
    output['cv']=(pd.DataFrame(rows),{})
    rows=[]
    for i in range(4):
        xx,tt,_,_=_roc_points(truth,rng.normal(truth*(1.15+i*.18),1));rows+=curve(f'Subgroup {i+1}',xx,tt)
    output['subgroups']=(pd.DataFrame(rows),{})
    xx,tt,_,_=_roc_points(truth,rng.normal(truth*1.1,1))
    output['training_validation']=(pd.DataFrame(curve('Training')+curve('Validation',xx,tt)),{})
    # One-vs-rest scores are derived from one multinomial outcome and aligned scores.
    classes=np.repeat(np.arange(3),60);logits=rng.normal(0,1,(180,3));logits[np.arange(180),classes]+=1.4
    scores3=np.exp(logits)/np.exp(logits).sum(axis=1,keepdims=True);rows=[];ys=[]
    for i in range(3):
        xx,tt,_,_=_roc_points((classes==i).astype(int),scores3[:,i]);rows+=curve(f'Class {i+1}',xx,tt);ys.append(np.interp(grid,xx,tt))
    rows+=curve('Macro average',grid,np.mean(ys,axis=0));output['multi']=(pd.DataFrame(rows),{})
    # A censoring-free synthetic cohort is a valid special case of dynamic ROC.
    risk=rng.normal(size=250);times=rng.exponential(np.exp(-risk)*3);rows=[]
    for horizon in [1,3,5]:
        xx,tt,_,_=_roc_points((times<=horizon).astype(int),risk);rows+=curve(f'{horizon}-year',xx,tt)
    output['time']=(pd.DataFrame(rows),{})
    # Supplied-model fixture, not a fitted meta-analysis or an estimated pooled result.
    xg=np.linspace(.015,.55,140);yg=12*xg/(1+11*xg)
    rows=curve('Supplied SROC fit',xg,yg,'fit')
    for i in range(10):
        xx=float(rng.uniform(.08,.3));yy=float(np.clip(12*xx/(1+11*xx)+rng.normal(0,.055),0,1));rows.append({'series':f'Study {i+1}','role':'study','x':xx,'y':yy,'weight':float(rng.integers(50,200))})
    rows.append({'series':'Supplied summary point','role':'pooled','x':.18,'y':12*.18/(1+11*.18),'weight':1})
    frame=pd.DataFrame(rows).fillna({'weight':1});output['sroc']=(frame,{})
    assert set(output)==VIEWS
    return output

def main():
    assets=ROOT/'skills/polish-sci-figures/assets/figure-studio';dest=ROOT/'demo/original_roc_styles';dest.mkdir(parents=True,exist_ok=True)
    templates=json.loads((assets/'catalogue-previews.json').read_text(encoding='utf-8'))
    style('Arial')
    for view,(frame,options) in fixtures().items():
        fig=render(frame,view,**options);fig.canvas.draw()
        stream=io.StringIO();fig.savefig(stream,format='svg',metadata={'Date':None});plt.close(fig)
        templates['roc_'+view]=stream.getvalue()
        folder=dest/view;folder.mkdir(exist_ok=True);frame.to_csv(folder/'data.csv',index=False)
        (folder/'figure_recipe.json').write_text(json.dumps({'family':'roc_results','input':'data.csv','font':'Arial','parameters':{'view':view,'method':'Deterministic synthetic analysis-result fixture; not clinical data',**options}},indent=2),encoding='utf-8')
    (assets/'catalogue-previews.json').write_text(json.dumps(templates,ensure_ascii=False),encoding='utf-8')
    print('Built 12 original ROC result layouts with reproducible synthetic input contracts')
if __name__=='__main__':main()
