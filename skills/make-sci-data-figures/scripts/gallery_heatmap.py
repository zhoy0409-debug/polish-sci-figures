"""Editable cell-value annotations; values travel with the actual rendered cells.

SVG ids carry exact IEEE-754 values, not rounded display strings.  Transparent
cell rectangles retain geometry for collision-free browser formatting. Missing
cells have neither labels nor invented zero values.
"""
import struct
import numpy as np
from matplotlib.colors import to_hex, to_rgb
from matplotlib.patches import Rectangle


def contrast_color(color):
    rgb = np.asarray(to_rgb(color))
    linear = np.where(rgb <= .04045, rgb / 12.92, ((rgb + .055) / 1.055) ** 2.4)
    luminance = float(linear @ [.2126, .7152, .0722])
    return '#ffffff' if (1.05 / (luminance + .05)) > ((luminance + .05) / .05) else '#000000'


def cell_values(ax, values, mappable, *, visible=False, decimals=2,
                x0=-.5, y0=-.5, cell_width=1, cell_height=1, mask=None,
                suffix='', extra=None, fontsize=8):
    """Attach true plot-space values and editable numeric text to a matrix.

    ``values`` must already be in the same units/order as the displayed color
    scale (e.g. Pearson r, percent inhibition, or supplied matrix values).
    """
    values = np.asarray(values, dtype=float)
    registered = getattr(ax.figure, '_studio_heat_mappables', [])
    if not any(item is mappable for item in registered):
        registered.append(mappable)
        ax.figure._studio_heat_mappables = registered
        if hasattr(mappable, 'set_gid'):
            lo=struct.pack('>d',float(mappable.norm.vmin)).hex()
            hi=struct.pack('>d',float(mappable.norm.vmax)).hex()
            mappable.set_gid(f'studio-heat-source-{len(registered)-1}-{lo}-{hi}')
    cross_zero = mappable.norm.vmin < 0 < mappable.norm.vmax
    kind = 'd' if cross_zero else 's'
    midpoint = float(mappable.norm(0)) if cross_zero else .5
    midpoint_hex = struct.pack('>d', midpoint).hex()
    valid = np.isfinite(values)
    if mask is not None:
        valid &= np.asarray(mask, dtype=bool)
    artists = []
    for row, col in zip(*np.where(valid)):
        value = float(values[row, col])
        index = getattr(ax.figure, '_studio_heat_count', 0)
        ax.figure._studio_heat_count = index + 1
        color = to_hex(mappable.to_rgba(value), keep_alpha=False)
        encoded = struct.pack('>d', value).hex()
        normalized = struct.pack('>d', float(mappable.norm(value))).hex()
        edges = getattr(mappable, 'get_edgecolors', lambda: [])()
        widths = getattr(mappable, 'get_linewidths', lambda: [])()
        edge = edges[0] if len(edges) else 'none'
        width = float(widths[0]) if len(widths) else 0
        box = Rectangle((x0 + col * cell_width, y0 + row * cell_height),
                        cell_width, cell_height, facecolor=color, edgecolor=edge,
                        linewidth=width, alpha=0, zorder=1.1, clip_on=True)
        box.set_gid(f'studio-heat-box-{index}')
        box.set_in_layout(False)
        ax.add_patch(box)
        text = f'{value:.{decimals}f}'
        if float(text) == 0:
            text = f'{0:.{decimals}f}'
        text += suffix
        if extra is not None:
            text += '\n' + str(np.asarray(extra)[row, col])
        label = ax.text(x0 + (col + .5) * cell_width,
                        y0 + (row + .5) * cell_height, text,
                        ha='center', va='center', fontsize=fontsize,
                        color=contrast_color(color), alpha=1 if visible else 0,
                        zorder=6, clip_on=True)
        label.set_gid(f'studio-heat-value-{index}-{encoded}-{color[1:]}-{int(visible)}-{decimals}-{normalized}-{kind}-{midpoint_hex}')
        label.set_in_layout(False)
        artists.append(label)
    return artists


def tag_heatmap_colorbars(fig):
    """Bind each existing colorbar face to its original normalization.

    Called after all axes/colorbars are created. Colorbar ticks, limits and
    geometry remain the renderer's; no per-panel range is recomputed in JS.
    """
    sources = getattr(fig, '_studio_heat_mappables', [])
    if not sources:
        return fig
    for ax in fig.axes:
        bar = getattr(ax, '_colorbar', None)
        if bar is None or bar.solids is None:
            continue
        source = next((source for source in sources
                       if source.cmap is bar.mappable.cmap
                       and type(source.norm) is type(bar.norm)
                       and source.norm.vmin == bar.norm.vmin
                       and source.norm.vmax == bar.norm.vmax), None)
        if source is None:
            continue
        samples = np.asarray(bar.solids.get_array()).ravel()
        positions = np.asarray(bar.norm(samples), dtype=float)
        if not np.isfinite(positions).all():
            raise ValueError('Heatmap colorbar normalization must be finite')
        cross_zero = bar.norm.vmin < 0 < bar.norm.vmax
        kind = 'd' if cross_zero else 's'
        midpoint = struct.pack('>d', float(bar.norm(0)) if cross_zero else .5).hex()
        bar.solids.set_rasterized(False)
        bar.solids.set_gid('studio-heat-scale-' + kind + '-' + midpoint + '-' +
                           '_'.join(struct.pack('>d', float(p)).hex() for p in positions))
    return fig
