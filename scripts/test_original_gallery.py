"""Verify the original templates' data contracts, numerics and rendered boundaries."""
import sys,json,copy,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
sys.path.insert(0,str(ROOT/'skills/polish-sci-figures/scripts'))
from build_gallery_styles import fixtures
from build_original_roc_styles import fixtures as roc_fixtures
from gallery_workbench import render,validate,CONTRACTS,style
from roc_contract_workbench import render as render_roc,partial_area,upper_hull
import matplotlib.pyplot as plt
from matplotlib.text import Text
import numpy as np
import pandas as pd

def bounds(fig,name):
    fig.canvas.draw();renderer=fig.canvas.get_renderer();canvas=fig.bbox
    bad=[]
    texts=list(fig.texts)
    for ax in fig.axes:
        if not ax.get_visible():continue
        texts+=list(ax.texts)+[ax.title]
        if ax.axison:
            texts += [ax.xaxis.label,ax.yaxis.label]
            for axis,limits in [(ax.xaxis,ax.get_xlim()),(ax.yaxis,ax.get_ylim())]:
                for tick in axis.get_major_ticks()+axis.get_minor_ticks():
                    if min(limits)-1e-8<=tick.get_loc()<=max(limits)+1e-8:texts += [tick.label1,tick.label2]
        if ax.get_legend():texts+=list(ax.get_legend().get_texts())
        for table in ax.tables:texts += [cell.get_text() for cell in table.get_celld().values()]
    for text in texts:
        if not text.get_visible() or not text.get_text().strip() or text.axes is not None and not text.axes.get_visible():continue
        box=text.get_window_extent(renderer)
        if box.width<1 or box.height<1:continue
        # Hidden tick labels on axes switched off are not drawn.
        if text.axes is not None and not text.axes.axison:continue
        if box.x0 < -1 or box.y0 < -1 or box.x1 > canvas.width+1 or box.y1 > canvas.height+1:bad.append(text.get_text())
    assert not bad,(name,'text outside canvas',bad)

def main():
    style('Arial');tables=fixtures()
    for view,data in tables.items():
        original=data.copy(deep=True);fig=render(data,view);bounds(fig,view);plt.close(fig);pd.testing.assert_frame_equal(data,original)
        broken=data.drop(columns=CONTRACTS[view][3].split()[0])
        try:validate(broken,view)
        except ValueError:pass
        else:raise AssertionError('Accepted missing schema '+view)
    # The display coordinates and numerical estimates must reflect the table.
    d=tables['bland_altman'];fig=render(d,'bland_altman');pts=fig.axes[0].collections[0].get_offsets();np.testing.assert_allclose(pts[:,0],(d.method_a+d.method_b)/2);np.testing.assert_allclose(pts[:,1],d.method_b-d.method_a);plt.close(fig)
    d=tables['composition_waffle'];fig=render(d,'composition_waffle');assert len(fig.axes[0].collections[0].get_offsets())==100;plt.close(fig)
    d=tables['gsea_tracks'];assert abs(d.running_score.iloc[-1])<1e-12
    d=tables['upset_intersections'];fig=render(d,'upset_intersections');assert sum(p.get_height() for p in fig.axes[0].patches)==d['sample'].nunique();plt.close(fig)
    for view,(data,options) in roc_fixtures().items():fig=render_roc(data,view,**options);bounds(fig,'roc_'+view);plt.close(fig)
    for x,y,expected in [([0,1],[0,1],.5),([0,0,1],[0,1,1],1.)]:
        _,_,_,value=partial_area(np.array(x),np.array(y),.2);assert abs(value-expected)<1e-12
    try:partial_area(np.array([.1,1]),np.array([.5,1]),.2)
    except ValueError:pass
    else:raise AssertionError('Incomplete FPR interval accepted')
    # Round-trip through the actual engine, including data revisions and alternatives.
    from studio_server import regenerate
    for view in ['superplot','upset_intersections','composition_ring','composition_waffle','hexbin_density','pca_loadings','gsea_tracks']:
        d=tables[view];rows=[list(d.columns)]+d.astype(str).values.tolist();panel=regenerate({'family':'gallery','parameters':{'view':view},'font':'Arial'},rows)
        assert view in {v['name'] for v in panel['variants']} and panel['table']['rows']==rows
        assert panel['variants'][panel['initialVariant']]['name']==view
        if view in ('composition_ring','composition_waffle','hexbin_density','pca_loadings'):assert panel['variants'][panel['initialVariant']]['preserveAspect']
        if view=='composition_ring':assert 'composition_waffle' in {v['name'] for v in panel['variants']}
    print('21 original layouts, 12 ROC result layouts: boundaries, unchanged data, numerical checks, input rejection and live-engine round trips passed')
if __name__=='__main__':main()
