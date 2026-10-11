"""Render, geometry, schema and data-replacement checks for C/D templates."""
import io
import sys
from pathlib import Path
import numpy as np
import pandas as pd
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
from figure_workbench import style
import gallery_time_composition as g
import gallery_workbench as existing
import matplotlib.pyplot as plt


def drawn_text(fig):
    texts=list(fig.texts)
    for ax in fig.axes:
        texts+=list(ax.texts)+[ax.title]
        if not ax.axison:continue
        texts += [ax.xaxis.label,ax.yaxis.label]
        for axis in [ax.xaxis,ax.yaxis]:
            lim=sorted(axis.get_view_interval())
            for tick in axis.get_major_ticks():
                if lim[0]-1e-8<=tick.get_loc()<=lim[1]+1e-8:
                    texts.extend([tick.label1,tick.label2])
        if ax.get_legend():texts+=list(ax.get_legend().get_texts())
    return [t for t in texts if t.get_visible() and t.get_text()]


def check_bounds(fig,key):
    fig.canvas.draw();r=fig.canvas.get_renderer();w,h=fig.bbox.width,fig.bbox.height
    for t in drawn_text(fig):
        b=t.get_window_extent(r)
        assert b.x0>=-1 and b.y0>=-1 and b.x1<=w+1 and b.y1<=h+1,(key,t.get_text(),b.bounds,(w,h))
        assert t.get_fontsize()>=8,(key,t.get_text(),'font too small')


def replaced(d):
    d=d.copy(deep=True)
    if 'count' in d:d['count']=d['count']*2
    elif {'before','after'}<=set(d):d[['before','after']]=d[['before','after']]*1.13+2
    elif 'value' in d:d['value']=d['value']*1.13+2
    elif 'fitted' in d:d[['observed','fitted']]=d[['observed','fitted']]*1.13+2
    elif 'rank' in d:d['rank']=d.groupby('time')['rank'].transform(lambda x:x.max()+1-x)
    elif 'end' in d:d['end']*=1.2
    return d


def main():
    style('Arial');proof=ROOT/'.cache/time-composition';proof.mkdir(parents=True,exist_ok=True)
    fixtures=g.fixtures();sizes=[(4.8,3.6),(3.6,3.6),(7.2,3.6),(4.8,5.4)]
    assert len(g.SOURCE_MAP)==38 and set(g.SOURCE_MAP.values())<=set(g.CONTRACTS)|set(existing.CONTRACTS)
    count=0
    for key,data in fixtures.items():
        original=data.copy(deep=True)
        for name,table in [('original',data),('replaced',replaced(data))]:
            for si,size in enumerate(sizes):
                fig=g.render(table,key,figsize=size);check_bounds(fig,key)
                buf=io.StringIO();fig.savefig(buf,format='svg',metadata={'Date':None});svg=buf.getvalue()
                assert '<image' not in svg and 'data:image' not in svg,(key,'rasterized SVG')
                if name=='original':fig.savefig(proof/f'{key}-{si}.png',dpi=110)
                plt.close(fig);count+=1
        pd.testing.assert_frame_equal(data,original)
        for field in g.CONTRACTS[key][3].split():
            try:g.validate(data.drop(columns=field),key)
            except ValueError:pass
            else:raise AssertionError((key,'accepted missing field',field))
        for field in g.CONTRACTS[key][4].split():
            bad=data.copy();bad.loc[bad.index[0],field]=np.nan
            try:g.validate(bad,key)
            except ValueError:pass
            else:raise AssertionError((key,'accepted nonfinite field',field))
    # Exact amounts, common time grids and calendar placement are preserved.
    rects=g._treemap_rects([2,3,5]);assert np.allclose([w*h for _,_,w,h in rects],[.2,.3,.5])
    raw=pd.DataFrame([['A','Control',0,0],['A','Control',1,2],['A','Control',2,4],['B','Control',0,0],['B','Control',1,3],['B','Control',2,6]],columns=['unit','group','time','value'])
    fig=g.render(raw,'time_auc_summary');assert np.allclose(fig.axes[0].collections[0].get_offsets()[:,1],[4,6]);plt.close(fig)
    raw.loc[2,'time']=3
    try:g.validate(raw,'time_auc_summary')
    except ValueError:pass
    else:raise AssertionError('Unequal integration intervals accepted')
    fig=g.render(fixtures['time_calendar'],'time_calendar');assert sum(len(a.patches) for a in fig.axes)==366;plt.close(fig)
    fig=g.render(fixtures['composition_mosaic'],'composition_mosaic');areas=[p.get_width()*p.get_height() for p in fig.axes[0].patches];assert np.isclose(sum(areas),1);plt.close(fig)
    # Actual-size proof sheets; each chart is included at standard and narrow size.
    keys=list(fixtures)
    for si in [0,1]:
        for offset in range(0,len(keys),8):
            sheet=Image.new('RGB',(1400,4*410),'#e9edf3');draw=ImageDraw.Draw(sheet)
            for j,key in enumerate(keys[offset:offset+8]):
                image=Image.open(proof/f'{key}-{si}.png').convert('RGB');image.thumbnail((675,370))
                x=(j%2)*700+(700-image.width)//2;y=(j//2)*410+28
                sheet.paste(image,(x,y));draw.text(((j%2)*700+15,(j//2)*410+9),key,fill='#192b45')
            sheet.save(proof/f'proof-{si}-{offset//8}.png')
    print(f'PASS: {len(fixtures)} templates, 38 source entries, {count} renders; replacement tables, 4 sizes, vector SVGs, bounds, >=8 pt labels, schema and geometry checks')


if __name__=='__main__':main()
