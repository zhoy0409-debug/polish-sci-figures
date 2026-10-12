"""Exercise actual recomputation and reject malformed tables without changing input files."""
import csv, io, json, sys, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
from studio_server import regenerate

def main():
    source=ROOT/'demo/workbench/figure_recipe.json'
    recipe=json.loads(source.read_text(encoding='utf-8'))
    rows=list(csv.reader((ROOT/'skills/make-sci-data-figures/examples/synthetic_group_comparison.csv').open(encoding='utf-8-sig')))
    original=source.read_bytes()
    first=regenerate(recipe,rows)
    column=rows[0].index(recipe['value'])
    rows[1][column]=str(float(rows[1][column])+1)
    second=regenerate(recipe,rows)
    assert first['table']['sha256']!=second['table']['sha256']
    assert first['analysis']['primary_estimand']['estimate']!=second['analysis']['primary_estimand']['estimate']
    assert source.read_bytes()==original
    assert any(v['name']=='bar_raw_points' for v in second['variants'])
    for bad in ([['x','x'],['1','2']], [['x'],['1','2']]):
        try: regenerate(recipe,bad)
        except ValueError: pass
        else: raise AssertionError('invalid table accepted')
    rows[1][column]='unfinished numeric input'
    try: regenerate(recipe,rows)
    except ValueError: pass
    else: raise AssertionError('invalid numeric observation accepted')
    print('Data revisions recompute statistics and figures; invalid drafts rejected; sources unchanged')

if __name__=='__main__': main()
