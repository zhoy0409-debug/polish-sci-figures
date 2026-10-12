"""Fixed-size, replacement-data and scientific-contract QA for advanced results."""
import io
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
from figure_workbench import style
import gallery_temporal_extras as g
from test_gallery_time_composition import check_bounds
import matplotlib.pyplot as plt


def replacement(d,key):
    d=d.copy(deep=True)
    if key=='time_stl_components':d[['observed','trend']]+=.6
    elif key in {'time_pk_target','time_mutant_window'}:
        for c in ['free_concentration','concentration','mic','mpc']:
            if c in d:d[c]*=.85
    elif key=='control_u_results':d[['rate','center','lower','upper']]*=.9
    elif key=='institution_funnel':d['volume']*=1.1
    elif key=='lorenz_curve':d['cumulative_share']**=1.1
    elif key=='rank_abundance':d['abundance']*=.85
    elif key=='hill_diversity':d['diversity']=1+(d.diversity-1)*.9
    else:d[['upper_cusum','lower_cusum','upper_limit','lower_limit']]*=.9
    return d


def main():
    style('Arial');proof=ROOT/'.cache/temporal-extras';proof.mkdir(parents=True,exist_ok=True);tables=g.fixtures();sizes=[(4.8,3.6),(3.6,3.6),(7.2,3.6),(4.8,5.4)];count=0
    assert len(g.REFERENCE_MAP)==9 and set(g.REFERENCE_MAP.values())==set(g.CONTRACTS)
    for key,data in tables.items():
        original=data.copy(deep=True)
        for name,table in [('original',data),('replaced',replacement(data,key))]:
            for si,size in enumerate(sizes):
                fig=g.render(table,key,figsize=size);check_bounds(fig,key);np.testing.assert_allclose(fig.get_size_inches(),size)
                svg=io.StringIO();fig.savefig(svg,format='svg',metadata={'Date':None});assert '<image' not in svg.getvalue()
                if name=='original':fig.savefig(proof/f'{key}-{si}.png',dpi=110)
                plt.close(fig);count+=1
        pd.testing.assert_frame_equal(data,original)
        for c in g.CONTRACTS[key][3].split():
            try:g.validate(data.drop(columns=c),key)
            except ValueError:pass
            else:raise AssertionError((key,c,'accepted missing column'))
        for c in g.CONTRACTS[key][4].split():
            bad=data.copy();bad[c]=bad[c].astype(float);bad.loc[bad.index[0],c]=np.inf
            try:g.validate(bad,key)
            except ValueError:pass
            else:raise AssertionError((key,c,'accepted infinity'))
    bad=tables['time_stl_components'].copy();bad.loc[0,'observed']+=1
    try:g.validate(bad,'time_stl_components')
    except ValueError:pass
    else:raise AssertionError('Accepted inconsistent decomposition')
    for si in range(4):
        sheet=Image.new('RGB',(1400,5*410),'#e9edf3');draw=ImageDraw.Draw(sheet)
        for j,key in enumerate(tables):
            im=Image.open(proof/f'{key}-{si}.png').convert('RGB');im.thumbnail((675,370));sheet.paste(im,((j%2)*700+(700-im.width)//2,(j//2)*410+28));draw.text(((j%2)*700+12,(j//2)*410+8),key,fill='#19314c')
        sheet.save(proof/f'proof-{si}.png')
    print(f'PASS: 9 result templates, 9 reference entries, {count} rendered SVGs; replacement data, fixed sizes, vector output, text bounds, >=8 pt and invalid-input checks')


if __name__=='__main__':main()
