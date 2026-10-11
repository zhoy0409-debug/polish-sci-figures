"""Editable template registry. Geometry is rendered from tables at each physical size."""
import hashlib
import importlib
import io
import json
from collections import OrderedDict
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt
from figure_workbench import style, resolve_palette
from data_family_workbench import _save_bundle, _relative_input
from gallery_fonts import apply_font_fallback

MODULES = [importlib.import_module(name) for name in (
    'gallery_workbench', 'gallery_compare', 'gallery_time_composition',
    'gallery_clinical', 'gallery_omics_special', 'gallery_misc',
    'gallery_model_extras','gallery_temporal_extras','gallery_structure_extras')]
OWNERS = {key: module for module in MODULES for key in module.CONTRACTS}
CONTRACTS = {key: module.CONTRACTS[key] for key,module in OWNERS.items()}
NOTES = {key: module.NOTES[key] for key,module in OWNERS.items()}
SOURCE_MAP = {source:key for module in MODULES for source,key in getattr(module,'SOURCE_MAP',{}).items()}
SIZES = {'original':(4.8,3.6),'portrait':(3.6,4.8),'wide':(7.2,3.6),
         'spanWide':(9.7667,3.6),'spanThree':(14.7333,3.6),
         'spanTall':(4.8,7.3667),'large':(9.7667,7.3667)}
BASE_GROUPS = [{'composition_ring','composition_waffle'},
               {'correlation_circles','correlation_values'}]
_SVG_CACHE=OrderedDict()
_CACHE_LIMIT=24_000_000

def validate(data,view):
    if view not in OWNERS:raise ValueError('Unknown editable template: '+str(view))
    return OWNERS[view].validate(data,view)

def compatible(data,view):
    """Only explicitly reviewed alternatives; matching column names alone is insufficient."""
    candidates=[view]
    groups=BASE_GROUPS+[g for m in MODULES for g in getattr(m,'COMPATIBLE_GROUPS',[])]
    for group in groups:
        if view in group:
            for key in sorted(group):
                if key not in candidates and key in OWNERS:
                    try:validate(data,key)
                    except (ValueError,TypeError,KeyError):continue
                    candidates.append(key)
    return candidates

COLORS=['#3f6da3','#c95770','#93accb','#69758b','#b68b56','#9c83a2','#263b58','#d2b6bb']

def colors_for(palette='zhoy_muted',colors_text=None):
    return COLORS if palette=='zhoy_muted' and not colors_text else resolve_palette(palette,colors_text,8)

def render(data,view,colors=None,figsize=(4.8,3.6)):
    colors=COLORS if colors is None else colors
    with plt.rc_context():
        apply_font_fallback()
        return OWNERS[view].render(data,view,colors=colors,figsize=figsize)

def svg_at_size(data,view,colors,font,dimensions):
    signature=hashlib.sha256((data.to_csv(index=False)+json.dumps([view,colors,font,dimensions])).encode()).hexdigest()
    if signature in _SVG_CACHE:
        _SVG_CACHE.move_to_end(signature);return _SVG_CACHE[signature]
    with plt.rc_context():
        apply_font_fallback(font)
        fig=render(data,view,colors,dimensions)
    try:
        output=io.StringIO()
        with plt.rc_context({'svg.fonttype':'none'}):
            fig.savefig(output,format='svg',metadata={'Date':None})
        raw=output.getvalue().encode('utf-8')
    finally:plt.close(fig)
    _SVG_CACHE[signature]=raw
    while sum(map(len,_SVG_CACHE.values()))>_CACHE_LIMIT:_SVG_CACHE.popitem(last=False)
    return raw

def generate(input_path,outdir,view,palette='zhoy_muted',colors_text=None,font='Arial'):
    style(font);data=pd.read_csv(input_path,keep_default_na=False);colors=colors_for(palette,colors_text)
    keys=compatible(data,view)
    destination=Path(outdir);destination.mkdir(parents=True,exist_ok=True)
    for key in keys:(destination/(key+'.svg')).write_bytes(svg_at_size(data,key,colors,font,SIZES['original']))
    recipe={'family':'gallery','input':_relative_input(Path(input_path),Path(outdir)),
            'palette':palette,'colors':colors_text,'font':font,'parameters':{'view':view}}
    analysis={'family':'gallery','view':view,'input_contract':CONTRACTS[view][3].split(),
              'description':NOTES[view][1],'source_sha256':hashlib.sha256(Path(input_path).read_bytes()).hexdigest(),
              'inference':'Uses observations or explicitly supplied model results according to the template contract.'}
    for name,value in [('figure_recipe.json',recipe),('analysis_plan.json',analysis),('data_profile.json',{})]:
        (destination/name).write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
    return [destination/(key+'.svg') for key in keys]

def render_sizes(data,view,colors=None,font='Arial'):
    style(font)
    # Other chart types are switched at their original size; only the active view
    # needs all responsive geometries. This keeps data edits responsive.
    for size,dimensions in SIZES.items():
        if size=='original':continue
        yield view,size,svg_at_size(data,view,colors,font,dimensions)
