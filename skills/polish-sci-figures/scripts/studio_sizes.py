"""Render physical canvas alternatives with the existing workbench, never stretch SVGs."""
from __future__ import annotations
import importlib.util
import io
from pathlib import Path
import textwrap


def render_sizes(path, recipe, analysis, variants):
    source = path / str(recipe.get('input', '')).replace('\\', '/')
    if not source.is_file() or not analysis.get('source_sha256'):
        return []
    import hashlib
    if hashlib.sha256(source.read_bytes()).hexdigest() != analysis['source_sha256']:
        raise ValueError('Layout rendering requires unchanged source data')
    supported = {'raw_points_estimate_ci':'plot_points_ci', 'box_raw_points':'plot_box_points',
                 'violin_raw_points':'plot_violin_points', 'raincloud':'plot_raincloud',
                 'estimation_graphic':'plot_estimation_graphic', 'group_estimate_forest':'plot_group_estimates',
                 'paired_trajectories':'plot_paired', 'paired_estimation':'plot_paired_estimation',
                 'paired_difference':'plot_paired_difference'}
    if not all(k in recipe for k in ('group','value','design','subject','order')):
        return []
    module_path = Path(__file__).resolve().parents[2] / 'make-sci-data-figures/scripts/figure_workbench.py'
    spec = importlib.util.spec_from_file_location('studio_workbench', module_path)
    wb = importlib.util.module_from_spec(spec); spec.loader.exec_module(wb)
    actual, _, _, _ = wb.resolve_font(recipe.get('font', 'Arial'), recipe.get('allow_font_fallback', False))
    wb.style(actual)
    order = recipe['order']
    _, data = wb.analyse(wb.read_table(source), recipe['group'], recipe['value'], order, recipe['design'], recipe['subject'])
    colors = wb.resolve_palette(recipe.get('palette', 'zhoy_muted'), recipe.get('colors'), len(order))
    ylabel = recipe['value'] + (f" ({recipe['unit_label']})" if recipe.get('unit_label') else '')
    outputs = []
    # Prepared once; the offline editor subsequently switches immediately.
    width,height=variants[0]['width']/72,variants[0]['height']/72
    for size, dimensions in [('portrait', (3.6, 4.8)), ('wide', (7.2, 3.6)),
                             ('spanWide',(width*2+12/72,height)),
                             ('spanTall',(width,height*2+12/72)),
                             ('large',(width*2+12/72,height*2+12/72))]:
        wb.FIGSIZE = dimensions
        for v in variants:
            name = v['name']
            if name not in supported:
                continue
            fn = getattr(wb, supported[name])
            if name == 'paired_trajectories':
                fig = fn(data, recipe['subject'], order, colors, ylabel, analysis)
            elif name == 'paired_estimation':
                fig = fn(data, order, colors, ylabel, analysis)
            elif name == 'paired_difference':
                fig = fn(data, order, colors[1], ylabel, analysis)
            else:
                fig = fn(data, recipe['group'], recipe['value'], order, colors, ylabel, analysis)
            try:
                # Two-axis estimation views stack vertically on a portrait canvas.
                if size in ('portrait','spanTall') and len(fig.axes) == 2:
                    fig.axes[0].set_position([.24, .58, .70, .27])
                    fig.axes[1].set_position([.24, .16, .70, .27])
                for ax in fig.axes:
                    labels=ax.get_xticklabels()
                    if labels and any(any(c.isalpha() for c in label.get_text()) for label in labels):
                        chars=max(6,int(ax.get_position().width*dimensions[0]*72/len(labels)/(labels[0].get_fontsize()*.6)))
                        wrapped=[textwrap.fill(label.get_text(),width=chars,break_long_words=False,break_on_hyphens=False) for label in labels]
                        ax.set_xticks(ax.get_xticks(),wrapped)
                for label in fig.texts:
                    label.set_text(textwrap.fill(label.get_text(), width=int(dimensions[0]*10)))
                    label.set_position((.06, .98)); label.set_verticalalignment('top')
                output = io.StringIO()
                fig.savefig(output, format='svg', metadata={'Date':None})
                outputs.append((name, size, output.getvalue().encode('utf-8')))
            finally:
                wb.plt.close(fig)
    return outputs
