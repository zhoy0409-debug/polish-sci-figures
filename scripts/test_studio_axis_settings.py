"""Render-level professional axes regression with immutable observation tables.

Uses explicit engineering fixtures, not a clinical-validity or general scientific
benchmark. It checks the exported plotting frame, data, ticks and safe refusals.
"""
from __future__ import annotations
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'skills/make-sci-data-figures/scripts'),str(ROOT/'skills/polish-sci-figures/scripts')]
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import gallery_axes as axes
import gallery_registry as gallery
from figure_workbench import style


def rejects(call):
    try:call()
    except ValueError:return
    raise AssertionError('Unsafe axis settings were accepted')


def main():
    style('Arial')
    data=pd.DataFrame({'unit':['A','B','C','D','E'],'x':[.1,.5,1.,5.,10.],'y':[.2,.9,2.4,8.,20.]})
    original=data.copy(deep=True);digest=hashlib.sha256(data.to_csv(index=False).encode()).hexdigest()
    settings={'x_scale':'log','y_scale':'log','x_min':.1,'x_max':100.,'y_min':.1,'y_max':100.,
              'x_major_step':1,'x_minor_count':2,'y_major_count':4,'y_minor_count':1,
              'x_tick_format':'decimal','x_decimals':1,'y_tick_format':'scientific','y_decimals':2,
              'plot_width_pt':260.,'plot_height_pt':160.,'plot_left_pt':70.,'plot_bottom_pt':50.,
              'x_tick_direction':'inout','y_tick_length_pt':6.,'x_tick_label_size_pt':11.,
              'x_axis_width_pt':1.5,'y_axis_width_pt':.6,'x_axis_color':'#cc3355',
              'y_tick_color':'#226688','axis_box':'full','y_title_pad_pt':12.}
    dimensions=axes.geometry_dimensions(settings)
    fig=gallery.render(data,'relation_scatter',figsize=dimensions,axes=settings)
    try:
        ax=fig.axes[0];fig.canvas.draw()
        assert ax.get_xscale()==ax.get_yscale()=='log'
        assert np.allclose(ax.get_xticks(),[.1,1.,10.,100.])
        assert len(ax.get_yticks())==4 and len(ax.get_xticks(minor=True))==6
        assert np.allclose(ax.collections[0].get_offsets(),data[['x','y']].to_numpy())
        assert ax.spines['bottom'].get_linewidth()==1.5 and ax.spines['left'].get_linewidth()==.6
        assert all(spine.get_visible() for spine in ax.spines.values())
        assert all(label.get_fontsize()==11 for label in ax.get_xticklabels())
        geometry=fig._studio_axis_controls['geometry']
        assert np.isclose(geometry['plot_width_pt'],260) and np.isclose(geometry['plot_height_pt'],160)
        assert geometry['text_and_strokes']=='fixed_physical_size'
        assert geometry['plot_left_pt']==70 and np.isclose(geometry['plot_bottom_pt'],50)
        png=io.BytesIO();fig.savefig(png,format='png',dpi=150);assert png.getvalue().startswith(b'\x89PNG')
    finally:plt.close(fig)
    raw=gallery.svg_at_size(data,'relation_scatter',gallery.COLORS,'Arial',dimensions,axes=settings)
    info=axes.controls_from_svg(raw);root=ET.fromstring(raw)
    assert '<text' in raw.decode() and '<image' not in raw.decode()
    assert np.isclose(info['geometry']['plot_width_pt'],260)
    frame=next(node for node in root.iter() if node.attrib.get('id')=='studio-plot-frame')
    assert frame is not None

    negative=data.copy();negative.loc[0,'y']=0
    rejects(lambda:gallery.render(negative,'relation_scatter',axes={'y_scale':'log'}))
    negative.loc[0,'y']=-1
    rejects(lambda:gallery.render(negative,'relation_scatter',axes={'y_scale':'log'}))
    rejects(lambda:gallery.render(data,'relation_scatter',axes={'x_major_step':1e-12}))
    for setting in [{'x_scale':'symlog'},{'x_min':-1,'x_scale':'log'},{'x_major_step':1,'x_major_count':4},
                    {'x_major_count':4.5},{'y_minor_count':100},{'axis_width_pt':0},{'x_tick_color':'red'},
                    {'plot_width_pt':float('nan')},{'axis_visible':'yes'},{'x_tick_format':'expression'}]:
        rejects(lambda:axes.validate_settings('relation_scatter',setting))
    for setting in [{'x_min':0},{'x_scale':'log'},{'x_major_count':3},{'y_scale':'log'}]:
        rejects(lambda:axes.validate_settings('compare_bar_points',setting))
    categories=pd.DataFrame({'group':['A','A','A','B','B','B'],'unit':['a','b','c','d','e','f'],'value':[1.,2.,2.5,3.,4.,4.5]})
    fig=gallery.render(categories,'compare_bar_points',axes={'x_tick_side':'top','x_tick_label_size_pt':13,'y_min':0,'y_max':5,'y_major_step':1,'y_tick_format':'decimal','y_decimals':1,'y_axis_visible':False})
    try:
        ax=fig.axes[0];fig.canvas.draw()
        assert [label.get_text() for label in ax.get_xticklabels()]==['A','B']
        assert not ax.spines['left'].get_visible() and ax.spines['bottom'].get_visible()
        assert np.allclose(ax.get_yticks(),[0,1,2,3,4,5])
    finally:plt.close(fig)
    # Percent formatting is a display transform only; y=.2 remains .2 in data.
    fig=gallery.render(data,'relation_scatter',axes={'y_min':0,'y_max':1,'y_major_count':3,'y_tick_format':'percent','y_decimals':0})
    try:
        fig.canvas.draw();ax=fig.axes[0]
        assert [label.get_text() for label in ax.get_yticklabels()]==['0%','50%','100%']
        assert np.allclose(ax.collections[0].get_offsets(),data[['x','y']].to_numpy())
        assert any(item['code']=='data_range_clipped' for item in fig._studio_axis_controls['warnings'])
    finally:plt.close(fig)

    # Exercise the exact native HTTP engine implementation and persisted recipe.
    from studio_server import regenerate,reflow
    recipe={'family':'gallery','parameters':{'view':'relation_scatter'}}
    rows=[list(data.columns)]+data.astype(str).values.tolist();before=copy.deepcopy(rows)
    result=regenerate(recipe,rows,axes=settings)
    assert result['recipe']['axis_settings']==axes.normalize(settings)
    assert all(v.get('size','original')=='original' for v in result['variants']),'Exact plot sizes must not be replaced by generic responsive variants'
    assert np.isclose(result['variants'][0]['width'],sum([70.,260.,44.]))
    assert np.isclose(result['variants'][0]['height'],sum([50.,160.,56.]))
    assert np.isclose(result['axis_controls']['geometry']['plot_width_pt'],260.)
    refreshed=reflow(result['recipe'],rows,374,266)
    assert np.isclose(refreshed['axis_controls']['geometry']['plot_height_pt'],160)
    rejects(lambda:reflow(result['recipe'],rows,200,200))
    assert rows==before
    pd.testing.assert_frame_equal(data,original)
    assert hashlib.sha256(data.to_csv(index=False).encode()).hexdigest()==digest
    print(json.dumps({'status':'PASS','scope':'native renderer, SVG/PNG, data immutability, exact physical frame, numeric/categorical ticks, log safety, persisted recipe and engine reflow','data_sha256':digest,'cases':24},indent=2))


if __name__=='__main__':main()
