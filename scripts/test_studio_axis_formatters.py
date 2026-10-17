"""Lightweight formatter/semantic regression; no canvas drawing or rendering."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'skills/make-sci-data-figures/scripts'))
from matplotlib.figure import Figure
import gallery_axes


def check(view,values,expected):
    fig=Figure();ax=fig.subplots();line,=ax.plot([1,2],values)
    original=list(line.get_ydata())
    gallery_axes.apply_axes(fig,view,{'y_min':0,'y_max':max(values),'y_major_count':3,'y_tick_format':'percent','y_decimals':0})
    ticks=ax.get_yticks();labels=[ax.yaxis.get_major_formatter()(value,i) for i,value in enumerate(ticks)]
    assert labels==expected,(view,ticks,labels)
    assert list(line.get_ydata())==original
    return fig._studio_axis_controls


def main():
    percentage=check('time_percent_area',[0,100],['0%','50%','100%'])
    assert percentage['percentage_base']=={'x':1.,'y':100.}
    fraction=check('compare_ecdf',[0,1],['0%','50%','100%'])
    assert fraction['percentage_base']=={'x':1.,'y':1.}
    for view in ['composition_percent_bars','composition_single_bar','composition_likert','roc','precision_recall','clustered_matrix']:
        assert not gallery_axes.capabilities(view)['supported']
        try:gallery_axes.validate_settings(view,{'y_tick_format':'percent'})
        except ValueError:pass
        else:raise AssertionError('Undeclared axis semantics cannot be formatted: '+view)
    fig=Figure();ax=fig.subplots();ax.plot([0,1],[0,.004])
    gallery_axes.apply_axes(fig,'relation_scatter',{'y_min':0,'y_max':.004,'y_major_count':3,'y_tick_format':'percent','y_decimals':0})
    assert any(item['code']=='tick_precision_collides' for item in fig._studio_axis_controls['warnings'])
    print('PASS fraction/0–100 percent semantics, precision-collision warning, unchanged original values and unsupported-axis refusal; no canvas draw.')


if __name__=='__main__':main()
