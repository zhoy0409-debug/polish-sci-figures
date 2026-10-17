"""Evaluate a frozen labelled image-pair manifest, entirely offline.

Separates engineered real-source regressions from an externally labelled blind
study. Unknown labels never become negatives. Geometry truth must be supplied;
neither filenames nor this detector can create independent human truth.
"""
from __future__ import annotations
import argparse
import ast
import base64
from collections import defaultdict
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import platform
import sys
import time
import numpy as np
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
import studio_duplicates as duplicate
import studio_image_links as links


def metric(k,n):
    if n == 0:
        return {'value':None,'numerator':k,'denominator':n,'ci95':None}
    z=1.959963984540054
    p=k/n
    centre=(p+z*z/(2*n))/(1+z*z/n)
    half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n)
    return {'value':p,'numerator':k,'denominator':n,'ci95':[max(0.,centre-half),min(1.,centre+half)]}


def confusion(rows):
    counts={k:0 for k in ('TP','FP','FN','TN')}
    for expected,observed in rows:
        counts['TP' if expected and observed else 'FN' if expected else 'FP' if observed else 'TN']+=1
    tp,fp,fn,tn=(counts[k] for k in ('TP','FP','FN','TN'))
    return {**counts,'n':len(rows),'precision':metric(tp,tp+fp),'recallSensitivity':metric(tp,tp+fn),
            'specificity':metric(tn,tn+fp),'falsePositiveRate':metric(fp,tn+fp),'accuracy':metric(tp+tn,len(rows))}


def geometry(predicted,truth,dimensions):
    cv=duplicate._engine()
    a,b=np.float32(predicted),np.float32(truth)
    if a.shape!=(4,2) or b.shape!=(4,2) or not np.isfinite(a).all() or not np.isfinite(b).all():
        raise ValueError('Geometry requires finite four corners')
    area_a,area_b=abs(cv.contourArea(a)),abs(cv.contourArea(b))
    intersection,_=cv.intersectConvexConvex(cv.convexHull(a),cv.convexHull(b))
    iou=min(1.,max(0.,intersection/max(1e-12,area_a+area_b-intersection)))
    errors=np.linalg.norm((a-b)*np.array(dimensions),axis=1)
    return {'roiIoU':float(iou),'cornerMeanPixels':float(errors.mean()),'cornerMaxPixels':float(errors.max()),
            'cornerMaxFractionDiagonal':float(errors.max()/math.hypot(*dimensions))}


def evaluate(manifest_path,out,module=None):
    global duplicate
    if module:
        spec=importlib.util.spec_from_file_location('evaluated_duplicate',module)
        engine=importlib.util.module_from_spec(spec)
        sys.modules[spec.name]=engine
        spec.loader.exec_module(engine)
        duplicate=engine
        links.duplicate=engine
    manifest_path=Path(manifest_path).resolve(strict=True)
    payload=manifest_path.read_bytes()
    manifest=json.loads(payload)
    if manifest.get('schema')!='image-pair-evaluation/1':
        raise ValueError('Unsupported evaluation manifest')
    study=manifest.get('studyType')
    if study not in {'engineered_real_source','independent_real_case_blind','private_unlabelled_operational'}:
        raise ValueError('State the study type explicitly')
    if study=='independent_real_case_blind' and not (manifest.get('independentBlindStudy') and manifest.get('annotationProtocol')):
        raise ValueError('Blind-study claim requires an explicit external annotation protocol; use engineered or unlabelled otherwise')
    lookup={}
    for image in manifest['images']:
        path=(manifest_path.parent/image['path']).resolve(strict=True)
        if manifest_path.parent not in path.parents:
            raise ValueError('Image paths must remain inside the local evaluation directory')
        raw=path.read_bytes()
        if len(raw)>duplicate.MAX_IMAGE_BYTES:
            raise ValueError('Source is beyond the engine file-size bound')
        if hashlib.sha256(raw).hexdigest()!=image['sha256']:
            raise ValueError(f'Image hash mismatch for anonymous ID {image["id"]}')
        with Image.open(path) as opened:
            fmt=opened.format.lower()
            dimensions=ImageOps.exif_transpose(opened).size
        lookup[image['id']]={'id':image['id'],'label':image['id'],
                           'data':'data:image/'+('jpeg' if fmt=='jpg' else fmt)+';base64,'+base64.b64encode(raw).decode('ascii'),
                           '_dimensions':dimensions}
    def record(identity):
        return {k:v for k,v in lookup[identity].items() if not k.startswith('_')}
    results=[]
    for pair in manifest['pairs']:
        if type(pair.get('duplicate')) not in (bool,type(None)):
            raise ValueError('Duplicate truth must be true/false/null')
        started=time.perf_counter()
        row={'id':pair['id'],'stratum':pair['stratum'],'expectedDuplicate':pair.get('duplicate'),
             'construction':pair.get('construction'),'expectedExact':pair.get('requiredExact',False)}
        try:
            # Fixed OpenCV RNG is a reproducibility aid; it does not modify the
            # released engine thresholds or treat an inferred match as truth.
            duplicate._engine().setRNGSeed(1701)
            report=duplicate.scan_images([record(pair['a']),record(pair['b'])])
            row.update(predictedDuplicate=bool(report['matches']),kind=report['matches'][0]['kind'] if report['matches'] else None,
                       imageWarnings=[r['warnings'] for r in report['images']])
            if pair.get('localization') is not None:
                truth=pair['localization']
                duplicate._engine().setRNGSeed(1701)
                located=links.locate_image_links([record(pair['a']),record(pair['b'])])['pairs'][0]
                row['localization']={'positive':truth['positive'],'predicted':located['status']=='matched',
                                     'reason':located.get('reason'),'quality':located.get('quality')}
                if located['status']=='matched' and truth['positive']:
                    values=geometry(located['parentCorners'],truth['parentCorners'],lookup[pair['a']]['_dimensions'])
                    row['localization'].update(values,correct=values['roiIoU']>=.8 and values['cornerMaxFractionDiagonal']<=.02)
                elif located['status']=='matched':
                    row['localization']['correct']=False
        except (ValueError,RuntimeError) as exc:
            # An unsupported/error request is not a classifier negative. Keep
            # its operational failure visible and outside the confusion table;
            # in particular it must never inflate TN or successful coverage.
            row.update(predictedDuplicate=None,kind=None,error=type(exc).__name__)
            if pair.get('localization') is not None:
                row['localization']={'positive':pair['localization']['positive'],'predicted':False,'reason':'engine_error'}
        row['elapsedSeconds']=time.perf_counter()-started
        row['duplicateCheckStatus']='ERROR' if row.get('error') else 'NOT_SCORED' if row['expectedDuplicate'] is None else (
            'PASS' if row['predictedDuplicate']==row['expectedDuplicate'] and (not row['expectedExact'] or row['kind']=='exact') else 'FAIL')
        if 'localization' in row:
            loc=row['localization']
            row['localizationCheckStatus']='ERROR' if row.get('error') else 'PASS' if (
                (loc['positive'] and loc.get('correct',False)) or (not loc['positive'] and not loc['predicted'])) else 'FAIL'
        results.append(row)
        print(row['id'],row['predictedDuplicate'],row.get('localization',{}).get('reason'),flush=True)
    groups=defaultdict(list)
    for row in results:
        if row['expectedDuplicate'] is not None:
            groups[row['stratum']].append(row)
            groups['overall'].append(row)
    summary={}
    for name,rows in groups.items():
        loc=[r['localization'] for r in rows if 'localization' in r and r.get('error') is None]
        located_positive=[r for r in loc if r['positive'] and r['predicted']]
        returned=[r for r in loc if r['predicted']]
        wrong=[r for r in returned if not r.get('correct',False)]
        geo=[r for r in located_positive if 'roiIoU' in r]
        residuals=[r['quality']['residualPixels'] for r in returned if r.get('quality') and 'residualPixels' in r['quality']]
        cycles=[r['quality']['cycleErrorPixels'] for r in returned if r.get('quality') and 'cycleErrorPixels' in r['quality']]
        summary[name]={'requestedLabelledPairs':len(rows), 'nonEvaluablePairs':sum(r.get('error') is not None for r in rows),
                       'successfulScreeningCoverage':metric(sum(r.get('error') is None for r in rows),len(rows)),
                       'duplicate':confusion([(r['expectedDuplicate'],r['predictedDuplicate']) for r in rows if r.get('error') is None]),
                       'localizationPresence':confusion([(r['positive'],r['predicted']) for r in loc]),
                       'correctLocalizationRate':metric(sum(r.get('correct',False) for r in loc),sum(r['positive'] for r in loc)),
                       'wrongLocalizationAmongReturned':metric(len(wrong),len(returned)),
                       'roiIoUMedian':float(np.median([r['roiIoU'] for r in geo])) if geo else None,
                       'cornerMeanPixelsMedian':float(np.median([r['cornerMeanPixels'] for r in geo])) if geo else None,
                       'cornerMaxPixelsP95':float(np.percentile([r['cornerMaxPixels'] for r in geo],95)) if geo else None,
                       'maxDirectionalMedianResidualAnalysisPixelsP50':float(np.median(residuals)) if residuals else None,
                       'maxDirectionalMedianResidualAnalysisPixelsP95':float(np.percentile(residuals,95)) if residuals else None,
                       'cycleErrorAnalysisPixelsP95':float(np.percentile(cycles,95)) if cycles else None}
    exact=[r for r in results if r['expectedExact']]
    exact_pass=all(r['kind']=='exact' for r in exact)
    failures=[{'id':r['id'],'type':'engine_error' if r.get('error') else 'miss' if r['expectedDuplicate'] else 'false_positive','construction':r['construction'],
               'warnings':r.get('imageWarnings')} for r in results if r['expectedDuplicate'] is not None and r['expectedDuplicate']!=r['predictedDuplicate']]
    versions={}
    build_file=ROOT/'desktop/build_windows.py'
    if build_file.is_file():
        for node in ast.parse(build_file.read_text(encoding='utf-8')).body:
            if isinstance(node,ast.Assign):
                for target in node.targets:
                    if isinstance(target,ast.Name) and target.id in {'VERSION','SUITE_VERSION'}:
                        versions[target.id]=ast.literal_eval(node.value)
    output={'schema':'scientific-image-evaluation/1','date':datetime.now(timezone.utc).isoformat(),
            'declaredBuildVersion':versions, 'versionNote':'Working-tree version declaration; engine hashes identify the tested implementation',
            'engineSha256':hashlib.sha256(Path(duplicate.__file__).read_bytes()).hexdigest(),
            'localizationSha256':hashlib.sha256(Path(links.__file__).read_bytes()).hexdigest(),
            'manifestSha256':hashlib.sha256(payload).hexdigest(),'studyType':study,
            'independentBlindStudy':study=='independent_real_case_blind',
            'annotationIndependence':manifest.get('annotationProtocol','Not independently annotated; deterministic constructed pairs'),
            'independenceVerification':'Operator attestation only; script cannot verify reviewer independence' if study=='independent_real_case_blind' else 'No independent blind-study claim',
            'ciMethod':'Wilson 95% binomial intervals; nominal pair-level intervals only. Engineered pairs share sources and are correlated; these intervals cannot establish general scientific-image sensitivity or specificity.',
            'environment':{'os':platform.platform(),'python':platform.python_version(),'opencv':duplicate._engine().__version__},
            'exactIdentity':{'status':'PASS' if exact_pass and exact else 'FAIL' if exact else 'NOT_TESTED','cases':len(exact)},
            'summary':summary,'failures':failures,'cases':results,
            'unmeasured':['Representative independent human-adjudicated blind test' ] if study!='independent_real_case_blind' else [],
            'geometryRule':'Correct = returned on positive, ROI IoU >= 0.8 and maximum ordered-corner error <= 2% parent diagonal; unreturned positives remain failures.'}
    out=Path(out)
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(output,indent=2),encoding='utf-8')
    print(json.dumps({'exactIdentity':output['exactIdentity'],'duplicate':summary.get('overall',{}).get('duplicate'),
                      'failures':len(failures)}))
    return output


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest',type=Path,required=True)
    parser.add_argument('--out',type=Path,required=True)
    parser.add_argument('--module',type=Path)
    args=parser.parse_args()
    result=evaluate(args.manifest,args.out,args.module)
    raise SystemExit(1 if result['exactIdentity']['status']=='FAIL' else 0)
