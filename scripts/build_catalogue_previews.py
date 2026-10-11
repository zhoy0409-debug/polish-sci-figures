"""Build bundled template previews exclusively from deterministic synthetic fixtures."""
import importlib.util,json,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCRIPTS=ROOT/'skills/make-sci-data-figures/scripts'
sys.path.insert(0,str(SCRIPTS))
OUTPUT=ROOT/'skills/polish-sci-figures/assets/figure-studio/catalogue-previews.json'
previews={}
OriginalTemporaryDirectory=tempfile.TemporaryDirectory
class CollectingDirectory(OriginalTemporaryDirectory):
    def __exit__(self,*args):
        for path in Path(self.name).rglob('*.svg'):
            previews.setdefault(path.stem,path.read_text(encoding='utf-8'))
        return super().__exit__(*args)

def main():
    # Run real renderer regressions and capture their synthetic SVGs before cleanup.
    tempfile.TemporaryDirectory=CollectingDirectory
    try:
        for name in ['test_advanced_template_workbench','test_data_family_workbench']:
            spec=importlib.util.spec_from_file_location(name,SCRIPTS/(name+'.py'))
            module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);module.main()
    finally:tempfile.TemporaryDirectory=OriginalTemporaryDirectory
    for folder in ['workbench','paired_workbench','multigroup_workbench']:
        for path in (ROOT/'demo'/folder).glob('*.svg'):previews.setdefault(path.stem,path.read_text(encoding='utf-8'))
    import csv
    sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
    from studio_server import regenerate
    recipe=json.loads((ROOT/'demo/workbench/figure_recipe.json').read_text())
    rows=list(csv.reader((ROOT/'skills/make-sci-data-figures/examples/synthetic_group_comparison.csv').open()))
    for variant in regenerate(recipe,rows)['variants']:previews.setdefault(variant['name'],variant['svg'])
    OUTPUT.write_text(json.dumps(previews,ensure_ascii=False),encoding='utf-8')
    print(f'Bundled {len(previews)} synthetic template previews')
if __name__=='__main__':main()
