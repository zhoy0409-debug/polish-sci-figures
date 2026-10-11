"""The AI CLI produces bundles usable by the offline responsive editor."""
import subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'skills/polish-sci-figures/scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
from figure_studio import panel_from_path
from gallery_model_extras import fixtures

def main():
    base=ROOT/'.cache/studio-tests';base.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(dir=base) as tmp:
        root=Path(tmp);source=root/'data.csv';out=root/'bundle'
        fixtures()['model_nomogram'].to_csv(source,index=False)
        subprocess.run([sys.executable,str(ROOT/'skills/make-sci-data-figures/scripts/gallery_cli.py'),'--view','model_nomogram','--input',str(source),'--out',str(out)],check=True,stdout=subprocess.DEVNULL)
        panel=panel_from_path(out,0,with_layouts=True)
        assert len(panel['variants'])==7 and panel['table']['rows'][0]==['role','variable','order','position','tick']
        assert all(v['preserveAspect'] for v in panel['variants'])
        source.write_text(source.read_text()+'\n',encoding='utf-8')
        try:panel_from_path(out,0,with_layouts=True)
        except ValueError as exc:assert 'hash changed' in str(exc)
        else:raise AssertionError('Changed source was accepted without regeneration')
    print('AI CLI bundle → seven offline canvases; changed source rejected')

if __name__=='__main__':main()
