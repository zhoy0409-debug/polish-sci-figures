"""Physical plot-frame contract for reviewed, composable scientific templates.

Axes are laid out before vector export. Fonts, markers, line widths and source
observations are never scaled or rewritten to make a panel fit its neighbours.
Compound charts own an explicit callback for their auxiliary axes.
"""
from matplotlib.transforms import Bbox

MARGINS_PT = dict(left=60., right=44., top=56., bottom=42.)
REVIEWED = {
    'compare_raincloud', 'model_shap_summary', 'clustered_matrix',
    'meta_forest', 'flow_alluvial', 'genome_manhattan', 'pca_loadings',
    'coverage_tracks', 'roc_pointwise_band', 'roc_bootstrap_curves',
    'compare_bar_points', 'compare_bar_sd', 'compare_box', 'compare_box_points',
    'compare_cleveland', 'compare_density', 'compare_ecdf', 'compare_hist_facets',
    'compare_log_points', 'compare_mean_ci', 'compare_mean_sd', 'compare_notched_box',
    'compare_ridgeline', 'compare_strip_median', 'compare_swarm', 'compare_violin',
    'compare_violin_box',
}


def frame_for(fig):
    w, h = fig.get_size_inches() * 72
    m = MARGINS_PT
    geometry=getattr(fig,'_studio_axis_geometry',None)
    if geometry:
        left=geometry.get('plot_left_pt',m['left']);bottom=geometry.get('plot_bottom_pt',m['bottom'])
        width=geometry.get('plot_width_pt',w-left-m['right']);height=geometry.get('plot_height_pt',h-bottom-m['top'])
        if width<36 or height<36 or left+width>w-m['right']+1e-6 or bottom+height>h-m['top']+1e-6:
            raise ValueError('The physical plotting frame does not fit this canvas; enlarge the panel or reduce its plot dimensions/margins')
        return left/w,bottom/h,width/w,height/h
    if w <= m['left'] + m['right'] + 36 or h <= m['top'] + m['bottom'] + 36:
        raise ValueError('Canvas is too small for this plot frame')
    return (m['left']/w, m['bottom']/h,
            (w-m['left']-m['right'])/w, (h-m['top']-m['bottom'])/h)


def apply_layout(fig, view=None):
    """Align reviewed primary axes; leave unrelated, unreviewed layouts intact."""
    if view not in REVIEWED and not hasattr(fig, '_studio_compound_layout') and not hasattr(fig,'_studio_axis_geometry'):
        return fig
    # Resolve original layout once, then remove competing layout engines.
    if not getattr(fig, '_studio_layout_ready', False):
        fig.canvas.draw()
        fig.set_layout_engine('none')
    frame = frame_for(fig)
    callback = getattr(fig, '_studio_compound_layout', None)
    if callback:
        callback(frame)
    else:
        axes = [a for a in fig.axes if a.get_visible() and a.get_label() != '<colorbar>']
        old = Bbox.union([a.get_position() for a in axes])
        for ax in axes:
            p = ax.get_position()
            ax.set_axes_locator(None)
            ax.set_position([frame[0]+(p.x0-old.x0)/old.width*frame[2],
                             frame[1]+(p.y0-old.y0)/old.height*frame[3],
                             p.width/old.width*frame[2],p.height/old.height*frame[3]])
        fig._studio_main_axes = axes
    fig._studio_frame = frame
    fig._studio_layout_ready = True
    info=getattr(fig,'_studio_axis_controls',None)
    if info and info.get('supported'):
        w,h=fig.get_size_inches()*72
        info['geometry']={'plot_left_pt':frame[0]*w,'plot_bottom_pt':frame[1]*h,
                          'plot_width_pt':frame[2]*w,'plot_height_pt':frame[3]*h,
                          'canvas_width_pt':float(w),'canvas_height_pt':float(h),
                          'text_and_strokes':'fixed_physical_size'}
        for record,ax in zip(info.get('effective',[]),getattr(fig,'_studio_main_axes',fig.axes)):
            position=ax.get_position()
            record.update(plot_width_pt=position.width*w,plot_height_pt=position.height*h)
    # This invisible semantic marker survives SVG export and permits checking
    # the actual composite, including its nested SVG coordinate systems.
    marker = getattr(fig, '_studio_frame_marker', None)
    if marker is not None:
        marker.remove()
    from matplotlib.patches import Rectangle
    marker = Rectangle(frame[:2],frame[2],frame[3],transform=fig.transFigure,
                       fill=False,edgecolor='none',linewidth=0)
    marker.set_gid('studio-plot-frame')
    fig.add_artist(marker)
    fig._studio_frame_marker = marker
    return fig
