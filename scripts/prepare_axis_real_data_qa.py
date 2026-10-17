"""Prepare a traceable UCI Iris native-data project for local axis acceptance.

The only network operation is the explicit --download option, which downloads a
public CC BY 4.0 dataset. It never reads or uploads private projects or images.
Browser acceptance is run separately; preparing this project is not a PASS.
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import sys
import urllib.request
import zipfile

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'skills/make-sci-data-figures/scripts'),str(ROOT/'skills/polish-sci-figures/scripts')]
SOURCE='https://archive.ics.uci.edu/static/public/53/iris.zip'
PAGE='https://archive.ics.uci.edu/dataset/53/iris'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--download',action='store_true',help='Explicitly download the public UCI dataset')
    parser.add_argument('--out',type=Path,default=ROOT/'.cache/axis-real-data-qa')
    args=parser.parse_args();destination=args.out.resolve();destination.mkdir(parents=True,exist_ok=True)
    archive=destination/'iris.zip'
    if args.download:
        with urllib.request.urlopen(SOURCE,timeout=30) as response:raw=response.read(100_001)
        if len(raw)>100_000:raise ValueError('Dataset download exceeds its expected bounded size')
        archive.write_bytes(raw)
    if not archive.is_file():parser.error('No cached dataset; run with --download once to fetch the public licensed data')
    raw=archive.read_bytes()
    with zipfile.ZipFile(io.BytesIO(raw)) as bundle:
        # UCI documents corrections in bezdekIris; use that explicitly named file.
        text=bundle.read('bezdekIris.data').decode('ascii')
    measurements=[row for row in csv.reader(io.StringIO(text)) if row]
    if len(measurements)!=150 or any(len(row)!=5 for row in measurements):raise ValueError('Unexpected Iris table shape')
    rows=[['unit','x','y']]+[[f'plant-{i+1:03}',row[0],row[2]] for i,row in enumerate(measurements)]
    from studio_server import regenerate
    recipe={'family':'gallery','parameters':{'view':'relation_scatter'}}
    asset=regenerate(recipe,rows);asset.update(id='panel-0',name='UCI Iris: sepal length vs petal length (cm)',provenance='user-data')
    asset['analysis']['qa_dataset']={'source':PAGE,'doi':'10.24432/C56C76','license':'CC BY 4.0',
        'file':'bezdekIris.data','archive_sha256':hashlib.sha256(raw).hexdigest(),
        'x':'sepal length (cm)','y':'petal length (cm)','unit':'one row / plant as documented by UCI',
        'purpose':'axis rendering acceptance only; no hypothesis test or independence inference'}
    state={'order':['panel-0'],'columns':1,'gap':12,'panels':{'panel-0':{'variant':asset['initialVariant'],'edits':{}}}}
    project={'schema':'figure-studio/1','id':hashlib.sha256(raw).hexdigest()[:20],
        'title':'UCI Iris - sepal length (cm) vs petal length (cm)','panels':[asset],'initialState':state}
    output=destination/'iris-axis-project.json';output.write_text(json.dumps({'project':project,'state':state,'checkpoints':[]}),encoding='utf-8')
    print(json.dumps({'prepared':True,'project':str(output),'source':PAGE,'license':'CC BY 4.0',
        'archive_sha256':hashlib.sha256(raw).hexdigest(),'rows':150,'measurement_mapping':{'x':'sepal length (cm)','y':'petal length (cm)'},
        'browser_acceptance':'NOT RUN by this command'},indent=2))


if __name__=='__main__':main()
