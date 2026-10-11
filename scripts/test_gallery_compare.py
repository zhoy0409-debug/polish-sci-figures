"""Exercise original A/B templates at actual preview and panel sizes."""
from pathlib import Path
import sys
import warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'skills/make-sci-data-figures/scripts'))
import gallery_compare as g
from gallery_workbench import CONTRACTS as EXISTING
from figure_workbench import style

def bounds(fig,name):
    fig.canvas.draw();renderer=fig.canvas.get_renderer();canvas=fig.bbox
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
    for t in texts:
        if not t.get_visible() or not t.get_text().strip():continue
        box=t.get_window_extent(renderer)
        if box.width<1 or box.height<1:continue
        assert box.x0>=-1 and box.y0>=-1 and box.x1<=canvas.width+1 and box.y1<=canvas.height+1,(name,t.get_text(),tuple(box.bounds),tuple(canvas.bounds))

def main():
    tables=g.fixtures();assert set(tables)==set(g.CONTRACTS)
    assert len(g.SOURCE_MAP)==53 and set(g.SOURCE_MAP.values())<=set(tables)|set(EXISTING)
    output=ROOT/'.cache/gallery-compare-qa';output.mkdir(parents=True,exist_ok=True)
    results=[];proofs=[]
    for view,d in tables.items():
        original=d.copy(deep=True)
        changed=d.copy(deep=True)
        for column in ['value','x','y','before','after','estimate','low','high','fitted','residual','color_value','size']:
            if column in changed:changed[column]=changed[column]*1.17
        for version,table in [('original',d),('edited',changed)]:
            for size in [(4.8,3.6),(3.6,3.6),(7.2,3.6),(4.8,5.4)]:
                with warnings.catch_warnings(record=True) as ww:
                    warnings.simplefilter('always')
                    style('Arial');fig=g.render(table,view,figsize=size);bounds(fig,(view,version,size))
                    np.testing.assert_allclose(fig.get_size_inches(),size)
                    bad=[str(w.message) for w in ww if 'constrained_layout not applied' in str(w.message)]
                    assert not bad,(view,version,size,bad)
                if version=='original' and size==(4.8,3.6):
                    image=output/f'{view}.png';fig.savefig(image,dpi=120);proofs.append((view,image))
                    svg=output/f'{view}.svg';fig.savefig(svg);assert '<image' not in svg.read_text(encoding='utf8')
                if version=='edited':
                    suffix={(4.8,3.6):'standard',(3.6,3.6):'narrow',(7.2,3.6):'wide',(4.8,5.4):'tall'}[size]
                    fig.savefig(output/f'{view}-edited-{suffix}.png',dpi=110)
                plt.close(fig);results.append((view,version,size))
        pd.testing.assert_frame_equal(d,original)
        for broken in [d.drop(columns=g.CONTRACTS[view][3].split()[0]),d.iloc[:0]]:
            try:g.validate(broken,view)
            except ValueError:pass
            else:raise AssertionError(('accepted invalid schema',view))
    # Mathematical and data-preservation properties.
    d=tables['compare_paired_change'];f=g.render(d,'compare_paired_change');np.testing.assert_allclose(f.axes[1].collections[0].get_offsets()[:,1],d.after-d.before);plt.close(f)
    d=tables['compare_ecdf'];f=g.render(d,'compare_ecdf');assert all(line.get_ydata()[-1]==1 for line in f.axes[0].lines);plt.close(f)
    d=tables['relation_labelled'];f=g.render(d,'relation_labelled');assert len(f.axes[0].texts)==int(d.selected.sum());plt.close(f)
    d=tables['relation_bubble'];f=g.render(d,'relation_bubble');sizes=f.axes[0].collections[0].get_sizes();np.testing.assert_allclose(sizes/sizes[0],d['size']/d['size'].iloc[0]);plt.close(f)
    for start in range(0,len(proofs),9):
        page=Image.new('RGB',(1500,1200),'#E9EDF3');draw=ImageDraw.Draw(page)
        for i,(title,path) in enumerate(proofs[start:start+9]):
            im=Image.open(path);im.thumbnail((480,350));x=(i%3)*500;y=(i//3)*400;page.paste(im,(x+(500-im.width)//2,y+35));draw.text((x+12,y+12),title,fill='#263B58')
        page.save(output/f'contact-{start//9}.png')
    for size in ['narrow','wide','tall']:
        for start in range(0,len(proofs),12):
            page=Image.new('RGB',(1600,1350),'#E9EDF3');draw=ImageDraw.Draw(page)
            for i,(title,path) in enumerate(proofs[start:start+12]):
                path=output/f'{title}-edited-{size}.png';im=Image.open(path);im.thumbnail((385,400));x=(i%4)*400;y=(i//4)*450;page.paste(im,(x+(400-im.width)//2,y+34));draw.text((x+8,y+12),title,fill='#263B58')
            page.save(output/f'{size}-contact-{start//12}.png')
    print(f'{len(tables)} original templates; {len(results)} render/data/size cases; SVG vector and semantic checks passed')

if __name__=='__main__':main()
