"""Create hash-pinned real-source engineering pairs; downloads are explicit.

No private data is read. Sources have verified public reuse terms and attribution.
Transforms/negative disjoint regions are constructed ground truth and must never
be described as an independent real-case blind study. Outputs remain in .cache.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
from pathlib import Path
import urllib.request
import numpy as np
from PIL import Image, ImageEnhance, ImageOps, ImageDraw

ROOT = Path(__file__).resolve().parents[1]


def prepare(out, download=False, sources=None):
    out = Path(out).resolve()
    source_file = Path(sources) if sources is not None else ROOT/'scripts/fixtures/real-image-sources.json'
    source_bytes = source_file.read_bytes()
    source_manifest = json.loads(source_bytes)
    if download and source_manifest.get('redistribution') == 'prohibited':
        raise ValueError('Private source manifests are offline only')
    public, derived = out/'public', out/'engineering'
    public.mkdir(parents=True, exist_ok=True)
    derived.mkdir(exist_ok=True)
    images, pairs = [], []
    def save(identity, image, modality, **kwargs):
        if not re.fullmatch(r'[A-Za-z0-9_-]{1,120}',identity):
            raise ValueError('Use anonymous alphanumeric IDs, without paths')
        fmt = kwargs.pop('format', 'PNG')
        file = identity+('.jpg' if fmt == 'JPEG' else '.tif' if fmt == 'TIFF' else '.png')
        target = derived/file
        image.save(target, format=fmt, **kwargs)
        images.append({'id':identity, 'path':'engineering/'+file, 'modality':modality,
                       'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
        return identity
    for source in source_manifest['sources']:
        target = (public/source['file']).resolve()
        if public.resolve() not in target.parents:
            raise ValueError('Source files must remain within the local source directory')
        if not target.exists():
            if not download:
                raise ValueError(f'Missing public source {source["id"]}; rerun with --download to explicitly fetch public files')
            request = urllib.request.Request(source['url'], headers={'User-Agent':'FigureStudio-public-validation/1'})
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read(12_000_001)
            if len(payload) > 12_000_000:
                raise ValueError('Source exceeded the explicit 12 MB download bound')
            if hashlib.sha256(payload).hexdigest() != source['sha256']:
                raise ValueError(f'Public source hash changed: {source["id"]}')
            target.write_bytes(payload)
        if hashlib.sha256(target.read_bytes()).hexdigest() != source['sha256']:
            raise ValueError(f'Public source hash changed: {source["id"]}')
        with Image.open(target) as original:
            if getattr(original,'n_frames',1)!=1:
                raise ValueError('Define a specific frame/page explicitly; the engineering builder does not silently take the first frame')
            bits=getattr(original,'tag_v2',{}).get(258,(8,))
            if isinstance(bits,int):
                bits=(bits,)
            with target.open('rb') as header_stream:
                header=header_stream.read(25)
            png_high_depth=original.format=='PNG' and len(header)>24 and header[24]>8
            if original.mode.startswith('I') or original.mode=='F' or max(bits)>8 or png_high_depth:
                raise ValueError('This transform builder accepts explicit 8-bit analysis sources only; evaluate native high-depth identity directly without RGB conversion')
            original = ImageOps.exif_transpose(original).convert('RGB')
            regions = source.get('regions', [{'id':source['id'], 'crop':[0,0,*original.size]}])
            for region in regions:
                base = original.crop(region['crop'])
                identity, modality = region['id'], source['modality']
                parent = save(identity, base, modality)
                w, h = base.size
                box = (round(.18*w), round(.17*h), round(.82*w), round(.83*h))
                heavy = (round(.4*w), round(.4*h), round(.6*w), round(.6*h))
                corners = (np.array([[box[0],box[1]], [box[2],box[1]], [box[2],box[3]], [box[0],box[3]]])/[w,h]).tolist()
                changed = ImageEnhance.Contrast(ImageEnhance.Brightness(base).enhance(1.12)).enhance(.85)
                overlay = base.copy()
                draw = ImageDraw.Draw(overlay)
                draw.rectangle((12,h-25,min(w-12,125),h-20),fill='white')
                draw.text((12,8),'ENGINEERING LABEL',fill='white',stroke_width=1,stroke_fill='black')
                cases = [
                    ('exact',base,{},None),
                    ('resize',base.resize((round(w*.73),round(h*.73)),Image.Resampling.LANCZOS),{},None),
                    ('rotate90',base.transpose(Image.Transpose.ROTATE_90),{},None),
                    ('mirror',ImageOps.mirror(base),{},None),
                    ('brightness_contrast_jpeg',changed,{'format':'JPEG','quality':80},None),
                    ('overlay',overlay,{},None),
                    ('crop',base.crop(box),{},corners),
                    ('crop_mirror_resize_jpeg',ImageOps.mirror(base.crop(box)).resize((round(w*.51),round(h*.53)),Image.Resampling.LANCZOS),
                     {'format':'JPEG','quality':80},[corners[i] for i in [1,0,3,2]]),
                    ('heavy_crop',base.crop(heavy),{},(np.array([[heavy[0],heavy[1]],[heavy[2],heavy[1]],[heavy[2],heavy[3]],[heavy[0],heavy[3]]])/[w,h]).tolist()),
                ]
                for name, image, kwargs, expected_roi in cases:
                    child = save(identity+'-'+name,image,modality,**kwargs)
                    pair = {'id':identity+'/'+name,'a':parent,'b':child,'duplicate':True,'stratum':modality,
                            'construction':name,'requiredExact':name=='exact'}
                    if expected_roi is not None:
                        pair['localization'] = {'positive':True,'parentCorners':expected_roi}
                    pairs.append(pair)
                left = save(identity+'-left',base.crop((0,0,round(w*.45),h)),modality)
                right = save(identity+'-right',base.crop((round(w*.55),0,w,h)),modality)
                pairs.append({'id':identity+'/nonoverlap','a':left,'b':right,'duplicate':False,'stratum':modality,
                              'construction':'disjoint_regions_same_source', 'localization':{'positive':False}})
    manifest = {'schema':'image-pair-evaluation/1','studyType':'engineered_real_source',
                'independentBlindStudy':False,'labelProvenance':'deterministic construction, not independent human adjudication',
                'sourceManifestSha256':hashlib.sha256(source_bytes).hexdigest(),
                'redistribution':source_manifest.get('redistribution','source-specific licenses'),
                'images':images,'pairs':pairs}
    (out/'engineering-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
    print(json.dumps({'images':len(images),'pairs':len(pairs),'manifest':str(out/'engineering-manifest.json')}))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out',type=Path,default=ROOT/'.cache/round2-validation')
    parser.add_argument('--download',action='store_true')
    parser.add_argument('--sources',type=Path,help='Optional LOCAL source manifest; private manifests require pre-staged local files and cannot download')
    args=parser.parse_args()
    prepare(args.out,args.download,args.sources)
