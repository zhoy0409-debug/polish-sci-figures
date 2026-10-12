"""All-template integration: data contract -> SVG bundle -> editable studio panel."""
import argparse,json,sys,tempfile,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts'),str(ROOT/'skills/polish-sci-figures/scripts')]
tempfile.tempdir=str(ROOT/'.cache/studio-tests')
import gallery_registry as registry
from build_gallery_styles import fixtures
from studio_server import regenerate
import numpy as np

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--engine',action='store_true');parser.add_argument('--start',type=int,default=0);args=parser.parse_args()
    tables=fixtures()
    for module in registry.MODULES[1:]:tables.update(module.fixtures())
    assert set(tables)==set(registry.CONTRACTS)
    assert len(registry.SOURCE_MAP)==160
    assert set(registry.SOURCE_MAP.values())<=set(tables)
    for key,data in tables.items():
        registry.validate(data,key)
        required=registry.CONTRACTS[key][3].split()
        try:registry.validate(data.drop(columns=required[0]),key)
        except ValueError:pass
        else:raise AssertionError(('missing-column accepted',key))
    if args.engine:
        report=[]
        for key,data in list(tables.items())[args.start:]:
            print('Checking '+key,flush=True)
            started=time.monotonic();rows=[list(data.columns)]+data.astype(str).values.tolist()
            panel=regenerate({'family':'gallery','parameters':{'view':key},'font':'Arial'},rows)
            assert panel['variants'][panel['initialVariant']]['name']==key
            assert panel['table']['rows']==rows
            assert panel['recipe']['parameters']['view']==key
            choices={v['size']:v for v in panel['variants'] if v['name']==key}
            assert set(choices)==set(registry.SIZES),(key,set(choices))
            for size,v in choices.items():
                np.testing.assert_allclose([v['width']/72,v['height']/72],registry.SIZES[size],rtol=1e-5)
                assert v['preserveAspect'] and '<svg' in v['svg'] and '<text' in v['svg']
                assert '<image' not in v['svg'],('raster template',key)
            report.append({'template':key,'sizes':len(choices),'seconds':round(time.monotonic()-started,2)})
            if len(report)%10==0:print(f'{len(report)}/{len(tables)} engine round trips passed',flush=True)
        target=ROOT/f'.cache/gallery-engine-qa-{args.start}.json';target.write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(f'{len(tables)} contracts, 160 A–H source entries; '+('all studio data and size round trips passed' if args.engine else 'registry valid'))

if __name__=='__main__':main()
