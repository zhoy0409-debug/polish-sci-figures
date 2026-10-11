"""Check density refinement retains observations and actual quartiles."""
import sys
from pathlib import Path
import numpy as np
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'skills/make-sci-data-figures/scripts'))
from figure_workbench import density_outline, plot_raincloud, plot_violin_points
import matplotlib.pyplot as plt

values=np.array([9.8,10.1,10.4,10.6,10.9,11.1])
frame=pd.DataFrame({'group':['A']*6+['B']*6,'value':np.r_[values,values+2]})
original=frame.copy(deep=True)
assert density_outline(np.ones(5)) is None
support,density=density_outline(values)
assert len(support)==256 and np.all(np.diff(support)>0)
assert density[0]<.02 and density[-1]<.02
for fn in (plot_raincloud,plot_violin_points):
    fig=fn(frame,'group','value',['A','B'],['#376795','#B72230'],'Response',{})
    ax=fig.axes[0]
    points=[c.get_offsets() for c in ax.collections if len(c.get_offsets())==6]
    assert len(points)==2
    assert np.array_equal(points[0][:,1],values)
    assert np.array_equal(points[1][:,1],values+2)
    summary=[line for line in ax.lines if len(line.get_ydata())==2]
    assert np.allclose(summary[0].get_ydata(),np.percentile(values,[25,75]))
    fig.canvas.draw()
    plt.close(fig)
pd.testing.assert_frame_equal(frame,original)
print('Smooth density tails, unchanged raw observations, exact quartiles and constant-sample fallback passed')
