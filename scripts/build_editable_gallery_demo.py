"""A complex, fully editable studio demonstration using declared synthetic tables."""
import hashlib,json,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
tempfile.tempdir=str(ROOT/'.cache/studio-tests')
from studio_server import regenerate
from figure_studio import write_html

def main():
    starters=json.loads((ROOT/'skills/polish-sci-figures/assets/figure-studio/template-starters.json').read_text(encoding='utf-8'))
    keys=['compare_raincloud','model_shap_summary','clustered_matrix','roc_pointwise_band','meta_forest','flow_alluvial','genome_manhattan','pca_loadings','coverage_tracks']
    panels=[]
    for i,key in enumerate(keys):
        print('Demo '+key,flush=True)
        spec=starters[key];panel=regenerate(spec['recipe'],spec['rows'])
        panel.update(id=f'panel-{i}',name=key,provenance='synthetic-template');panels.append(panel)
    identity=hashlib.sha256(json.dumps(panels,sort_keys=True).encode()).hexdigest()[:20]
    project={'schema':'figure-studio/1','id':identity,'title':'可编辑科研图形 · 示例数据','panels':panels,
        'initialState':{'order':[p['id'] for p in panels],'columns':3,'rows':3,'gap':14,
        'panels':{p['id']:{'variant':p['initialVariant'],'edits':{},'label':{'text':chr(65+i),'x':1,'y':5,'size':12,'font':'Arial','bold':True}} for i,p in enumerate(panels)}}}
    dest=ROOT/'demo/figure_studio/editable-templates.html'
    if dest.exists():dest.unlink()
    write_html(project,dest)
    print(dest)

if __name__=='__main__':main()
