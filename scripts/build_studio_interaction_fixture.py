from pathlib import Path
import sys,json,os
R=Path(__file__).resolve().parents[1]
B=Path(os.environ.get('STUDIO_QA_DIR',R/'.cache/interaction16-qa'));B.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(R/'skills/polish-sci-figures/scripts'))
import figure_studio as f
svg=B/'test.svg';svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="480pt" height="300pt" viewBox="0 0 480 300"><text x="100" y="100" font-family="Arial" font-size="17">Sample label</text><rect x="100" y="150" width="100" height="40" fill="#2288aa"/><text x="0" y="0" transform="translate(60 220) rotate(-90)" font-family="Arial" font-size="19">Vertical title</text><circle cx="300" cy="170" r="30" fill="#cc6644"/></svg>',encoding='utf8')
p=f.build_project([svg],'Interaction QA',1);p['initialState']['gap']=0
(B/'project.json').write_text(json.dumps(p),encoding='utf8')
out=B/'test.html'
if out.exists():out.unlink()
f.write_html(p,out)
print('Built test editor')

