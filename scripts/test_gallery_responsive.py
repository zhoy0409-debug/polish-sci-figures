"""The original 21 layouts retain real geometry across sizes and changed data."""
import io
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'scripts'),str(ROOT/'skills/make-sci-data-figures/scripts')]
from build_gallery_styles import fixtures
from gallery_workbench import render
from figure_workbench import style
from test_gallery_time_composition import check_bounds
import matplotlib.pyplot as plt


def replacement(data,key):
    d=data.copy(deep=True)
    if key=='upset_intersections':
        return pd.concat([d,pd.DataFrame([['New sample',d['set'].iloc[0]]],columns=['sample','set'])],ignore_index=True)
    fields={'bland_altman':'method_b','prediction_intervals':'y','hexbin_density':'y','paired_dumbbell':'after','study_gantt':'end',
            'pca_loadings':'x','genome_manhattan':'p','gsea_tracks':'running_score','coverage_tracks':'coverage',
            'quality_profiles':'quality','ma_expression':'log2fc','pvalue_quantiles':'p','ternary_composition':'a',
            'variance_scree':'proportion','composition_ring':'count','composition_waffle':'count'}
    field=fields.get(key,'value');d[field]*=.87
    if field=='value':d[field]+=np.sin(np.arange(len(d)))*.1
    return d


def main():
    style('Arial');proof=ROOT/'.cache/gallery-responsive';proof.mkdir(parents=True,exist_ok=True)
    sizes=[(4.8,3.6),(3.6,3.6),(7.2,3.6),(4.8,5.4)];count=0;tables=fixtures()
    for key,data in tables.items():
        original=data.copy(deep=True)
        for name,table in [('original',data),('replaced',replacement(data,key))]:
            for si,size in enumerate(sizes):
                fig=render(table,key,figsize=size);check_bounds(fig,key)
                np.testing.assert_allclose(fig.get_size_inches(),size)
                svg=io.StringIO();fig.savefig(svg,format='svg',metadata={'Date':None})
                assert '<image' not in svg.getvalue(),(key,'embedded bitmap')
                if name=='original':fig.savefig(proof/f'{key}-{si}.png',dpi=110)
                plt.close(fig);count+=1
        pd.testing.assert_frame_equal(data,original)
    for si in range(4):
        keys=list(tables)
        for offset in range(0,len(keys),8):
            sheet=Image.new('RGB',(1400,1640),'#e9edf3');draw=ImageDraw.Draw(sheet)
            for j,key in enumerate(keys[offset:offset+8]):
                im=Image.open(proof/f'{key}-{si}.png').convert('RGB');im.thumbnail((680,375))
                sheet.paste(im,((j%2)*700+(700-im.width)//2,(j//2)*410+28));draw.text(((j%2)*700+14,(j//2)*410+8),key,fill='#172b45')
            sheet.save(proof/f'proof-{si}-{offset//8}.png')
    print(f'PASS: 21 layouts; {count} actual renders and SVGs; 4 fixed sizes, changed data, >=8 pt text, canvas bounds, no embedded images')


if __name__=='__main__':main()
