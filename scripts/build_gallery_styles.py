"""Build original SVG previews and editable synthetic starter tables, not screenshots."""
import io,json,sys
from pathlib import Path
import numpy as np
import pandas as pd
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
from gallery_workbench import CONTRACTS as BASE_CONTRACTS,style
from gallery_registry import CONTRACTS,NOTES,render,MODULES,SOURCE_MAP
import matplotlib.pyplot as plt

def fixtures():
    rng=np.random.default_rng(12021);out={}
    x=rng.normal(30,8,90);y=4+.9*x+rng.normal(0,4,90)
    xy=pd.DataFrame({'unit':[f'S{i+1}' for i in range(90)],'x':x,'y':y})
    for key in ['prediction_intervals','hexbin_density']:out[key]=xy
    out['bland_altman']=xy.rename(columns={'x':'method_a','y':'method_b'})
    rows=[]
    for i,g in enumerate(['Control','Treatment']):
        for j in range(3):
            for v in rng.normal(10+2*i+j*.25,.5,6):rows.append([g,f'Experiment {j+1}',v])
    out['superplot']=pd.DataFrame(rows,columns=['group','experiment','value'])
    out['grouped_observations']=pd.DataFrame([[f'Line {i+1}',g,f'U{k+1}',float(rng.normal(10+2*i-3*j,1))] for i in range(3) for j,g in enumerate(['Control','Stress','Rescue']) for k in range(6)],columns=['factor','group','unit','value'])
    a=rng.normal(size=(50,5));a[:,1]=.65*a[:,0]+.6*a[:,1]
    matrix=pd.DataFrame([[f'S{i+1}',f'Feature {j+1}',a[i,j]] for i in range(50) for j in range(5)],columns=['unit','variable','value'])
    for k in ['correlation_circles','correlation_values']:out[k]=matrix
    rows=[]
    for i in range(100):
        mask=rng.random(4)>.6
        if not mask.any():mask[i%4]=True
        for j in np.flatnonzero(mask):rows.append([f'S{i+1}',f'Set {j+1}'])
    out['upset_intersections']=pd.DataFrame(rows,columns=['sample','set'])
    p=rng.uniform(.001,1,300);p[:30]=10**rng.uniform(-7,-2,30)
    out['ma_expression']=pd.DataFrame({'feature':[f'F{i}' for i in range(300)],'mean_expression':10**rng.uniform(0,4,300),'log2fc':rng.normal(0,.8,300),'adjusted_p':p})
    out['pvalue_quantiles']=pd.DataFrame({'feature':[f'F{i}' for i in range(300)],'p':p})
    out['variance_scree']=pd.DataFrame({'component':[f'PC{i+1}' for i in range(6)],'proportion':[.48,.23,.13,.08,.05,.03]})
    for k in ['composition_ring','composition_waffle']:out[k]=pd.DataFrame({'category':['Type A','Type B','Type C','Type D'],'count':[42,31,18,9]})
    comp=rng.dirichlet([2,3,2],60);out['ternary_composition']=pd.DataFrame({'sample':[f'S{i}' for i in range(60)],'group':['Control']*30+['Treatment']*30,'a':comp[:,0],'b':comp[:,1],'c':comp[:,2]})
    before=rng.normal(20,3,8);out['paired_dumbbell']=pd.DataFrame({'unit':[f'Patient {i+1}' for i in range(8)],'before':before,'after':before+rng.normal(2,3,8)})
    out['study_gantt']=pd.DataFrame({'task':['Design','Recruitment','Assays','Analysis','Manuscript'],'start':[0,2,4,7,10],'end':[2,6,9,11,13]})
    out['genome_manhattan']=pd.DataFrame({'variant':[f'v{i}' for i in range(1440)],'chromosome':np.repeat(np.arange(1,13),120),'position':np.tile(np.arange(120)*1000,12),'p':10**-np.minimum(rng.exponential(1.1,1440),12)})
    # A real weighted running sum on a deterministic synthetic ranked feature list.
    rank=np.arange(1,301);metric=np.sort(rng.normal(size=300))[::-1];hit=np.zeros(300,int);hit[rng.choice(np.arange(140),35,replace=False)]=1
    increments=hit*np.abs(metric)/(hit*np.abs(metric)).sum()-(1-hit)/(1-hit).sum()
    out['gsea_tracks']=pd.DataFrame({'rank':rank,'running_score':np.cumsum(increments),'hit':hit,'rank_metric':metric})
    pos=np.linspace(100,112,160);rows=[]
    for i in range(4):
        cover=sum((i+1)*a*np.exp(-.5*((pos-m)/w)**2) for a,m,w in [(8,101,.22),(12,104,.4),(6,108,.3),(9,110,.5)])
        rows.extend([[f'Track {i+1}',p,c] for p,c in zip(pos,cover)])
    out['coverage_tracks']=pd.DataFrame(rows,columns=['track','position','coverage'])
    rows=[]
    for j,g in enumerate(['Control','Stress']):
        for i in range(4):
            for p in range(1,151):rows.append([f'{g}-{i}',g,p,float(38-p*(.012+.006*j)+rng.normal(0,.15))])
    out['quality_profiles']=pd.DataFrame(rows,columns=['sample','group','position','quality'])
    rows=[]
    for j,g in enumerate(['Control','Stress','Rescue']):
        for i in range(30):rows.append([f'{g}-{i}','score',g,float(rng.normal([-2,0,2][j],.6)),float(rng.normal([1,-1,1][j],.65))])
    for i,(xx,yy) in enumerate([(-1.5,1.5),(1.5,.8),(.8,-1.5),(-1,-1)]):rows.append([f'Feature {i+1}','loading','Loading',xx,yy])
    out['pca_loadings']=pd.DataFrame(rows,columns=['id','role','group','x','y'])
    assert set(out)==set(BASE_CONTRACTS)
    return out

def main():
    assets=ROOT/'skills/polish-sci-figures/assets/figure-studio';previews=json.loads((assets/'catalogue-previews.json').read_text(encoding='utf-8'));starters={};meta={}
    proof=ROOT/'.cache/gallery-originals';proof.mkdir(parents=True,exist_ok=True);style('Arial')
    all_tables=fixtures()
    for module in MODULES[1:]:all_tables.update(module.fixtures())
    assert set(all_tables)==set(CONTRACTS)
    for key,data in all_tables.items():
        fig=render(data,key);fig.canvas.draw();s=io.StringIO();fig.savefig(s,format='svg',metadata={'Date':None});fig.savefig(proof/(key+'.png'),dpi=130);plt.close(fig);previews[key]=s.getvalue()
        starters[key]={'recipe':{'family':'gallery','font':'Arial','parameters':{'view':key}},'rows':[list(data.columns)]+data.astype(str).values.tolist()}
        title,en,category,fields,_=CONTRACTS[key]
        meta[key]={'category':category,'columns':getattr(next(m for m in MODULES if key in m.CONTRACTS),'COLUMN_LABELS',{}),'zh-CN':[title,NOTES[key][0],'数据列：'+fields.replace(' ', '、')],'en':[en,NOTES[key][1],'Columns: '+fields.replace(' ', ', ')]}
    # ROC result templates use exactly the same import/recompute path.
    from build_original_roc_styles import fixtures as roc_fixtures
    from roc_contract_workbench import render as render_roc
    for key,(data,options) in roc_fixtures().items():
        starters['roc_'+key]={'recipe':{'family':'roc_results','font':'Arial','parameters':{'view':key,'method':'Supplied analysis results; replace the synthetic table with matching results',**options}},'rows':[list(data.columns)]+data.astype(str).values.tolist()}
        fig=render_roc(data,key,**options);s=io.StringIO();fig.savefig(s,format='svg',metadata={'Date':None});fig.savefig(proof/('roc_'+key+'.png'),dpi=130);plt.close(fig);previews['roc_'+key]=s.getvalue()
    # All empirical ROC views share one raw-observation contract. The requested
    # style is explicit so a starter opens the selected visualization.
    rng=np.random.default_rng(973);raw=[]
    for cohort in ['Discovery','Validation']:
        for i in range(96):
            truth=i%2;raw.append([cohort+str(i),cohort,truth,float(rng.normal(truth*1.5,1))])
    roc_data=pd.DataFrame(raw,columns=['unit','cohort','outcome','score'])
    from advanced_template_workbench import roc
    raw_dir=ROOT/'.cache/roc-gallery-build';raw_dir.mkdir(parents=True,exist_ok=True)
    raw_path=raw_dir/'data.csv';roc_data.to_csv(raw_path,index=False)
    roc(raw_path,'outcome','score','unit',raw_dir,cohort='cohort',font='Arial')
    for path in raw_dir.glob('*.svg'):previews[path.stem]=path.read_text(encoding='utf-8')
    for key in ['roc','precision_recall','roc_auc_fill','roc_threshold_points','roc_threshold_color','roc_threshold_labels','roc_youden','roc_pointwise_band','roc_direct_labels','roc_bootstrap_curves','roc_with_auc_forest','roc_log_fpr','roc_confusion','roc_score_distribution','roc_two_graph']:
        starters[key]={'recipe':{'family':'roc','font':'Arial','studio_view':key,'parameters':{'outcome':'outcome','score':'score','unit':'unit','cohort':'cohort','positive':'1'}},'rows':[list(roc_data.columns)]+roc_data.astype(str).values.tolist()}
    index_path=ROOT/'skills/polish-sci-figures/references/chart-gallery-index.json'
    index=json.loads(index_path.read_text(encoding='utf-8'))
    roc_map=['roc','roc_smooth','roc_auc_fill','roc_threshold_points','roc_threshold_color','roc_threshold_labels','roc_youden','roc_pointwise_band','roc_cutoff_ci','roc_cost','roc','roc_direct_labels','roc_training_validation','roc_subgroups','roc_cv','roc_bootstrap_curves','roc_with_auc_forest','roc_partial','roc_convex','roc_log_fpr','roc_probit','roc_confusion','roc_score_distribution','roc_two_graph','roc_time','roc_multi','roc_sroc']
    mapping={**SOURCE_MAP,**{f'I{i+1:02}':key for i,key in enumerate(roc_map)}}
    for item in index['items']:
        key=mapping[item['id']];assert key in starters,(item['id'],key)
        item.update(renderer=key,related_renderer=key,status='editable-original-template',note='Original table-driven SVG implementation; reference artwork and code are not distributed.')
    index['coverage']={'reference_entries':len(mapping),'unique_templates':len(set(mapping.values()))}
    index_path.write_text(json.dumps(index,ensure_ascii=False,indent=2),encoding='utf-8')
    # Legacy reference coverage is finalized once its remaining model families are registered.
    from gallery_reference_map import write_coverage
    write_coverage(ROOT,MODULES,starters)
    (assets/'catalogue-previews.json').write_text(json.dumps(previews,ensure_ascii=False),encoding='utf-8')
    (assets/'template-starters.json').write_text(json.dumps(starters,ensure_ascii=False),encoding='utf-8')
    (assets/'gallery-contracts.js').write_text('/* Original layouts; contracts are not inferred from image pixels. */\nconst StudioGalleryContracts='+json.dumps(meta,ensure_ascii=False)+';\nif(typeof module!=="undefined")module.exports=StudioGalleryContracts;\n',encoding='utf-8')
    print(f'Built {len(meta)} original data-driven layouts and {len(starters)} editable starter tables')
if __name__=='__main__':main()
