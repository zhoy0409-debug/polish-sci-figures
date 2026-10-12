"""Editor metadata for marks. Preserve the actual estimate, including on log axes."""
import functools
import html
import json
import numpy as np
from matplotlib.axes import Axes
from matplotlib.collections import PathCollection
from matplotlib.container import ErrorbarContainer


def install_capture():
    # Capture at creation: asymmetric intervals do not reveal their estimate.
    # This wrapper changes no artist, data, return value or plotting defaults.
    if getattr(Axes.errorbar, '_studio_capture', False):
        return
    original = Axes.errorbar

    @functools.wraps(original)
    def errorbar(ax, x, y, *args, **kwargs):
        result = original(ax, x, y, *args, **kwargs)
        try:
            xx, yy = np.broadcast_arrays(np.atleast_1d(ax.convert_xunits(x)),
                                          np.atleast_1d(ax.convert_yunits(y)))
            result._studio_centers = np.column_stack((xx, yy)).astype(float)
        except (ValueError, TypeError):
            pass  # Unit types that cannot be represented safely retain their artwork.
        return result

    errorbar._studio_capture = True
    Axes.errorbar = errorbar


def prepare_marks(fig):
    """Assign stable ids before SVG serialization; keep existing semantic ids."""
    for ai, ax in enumerate(fig.axes):
        cap_ids = set()
        for ci, container in enumerate(ax.containers):
            if not isinstance(container, ErrorbarContainer):
                continue
            _, caps, stems = container.lines
            for kind, artists in [('cap', caps), ('stem', stems)]:
                for n, artist in enumerate(artists):
                    if not artist.get_gid():
                        artist.set_gid(f'studio-mark-{ai}-{ci}-{kind}-{n}')
            cap_ids.update(id(a) for a in caps)
        for n, artist in enumerate(ax.collections):
            if isinstance(artist, PathCollection) and len(artist.get_offsets()) and not artist.get_gid():
                artist.set_gid(f'studio-mark-{ai}-points-{n}')
        for n, artist in enumerate(ax.lines):
            if id(artist) not in cap_ids and artist.get_marker() not in (None, '', 'None', ' ', '_', '|') and not artist.get_gid():
                artist.set_gid(f'studio-mark-{ai}-marker-{n}')


def embed_marks(svg, fig):
    points, errors = [], []
    scale = 72 / fig.dpi
    height = fig.get_figheight() * 72
    for ax in fig.axes:
        cap_ids = set()
        for container in ax.containers:
            if not isinstance(container, ErrorbarContainer):
                continue
            line, caps, stems = container.lines
            cap_ids.update(id(a) for a in caps)
            centers = getattr(container, '_studio_centers', None)
            if centers is None and line is not None:
                centers = line.get_xydata()
            for stem in stems:
                entries = []
                for segment in stem.get_segments():
                    if len(segment) != 2 or not np.isfinite(segment).all():
                        continue
                    axis = 'y' if abs(segment[0, 0] - segment[1, 0]) < 1e-10 else 'x'
                    fixed = 0 if axis == 'y' else 1
                    center = None
                    if centers is not None:
                        candidates = [p for p in centers if np.isfinite(p).all() and
                                      np.isclose(p[fixed], segment[0, fixed]) and
                                      min(segment[:, 1-fixed]) - 1e-10 <= p[1-fixed] <= max(segment[:, 1-fixed]) + 1e-10]
                        if len(candidates) == 1:
                            center = candidates[0]
                    coords = ax.transData.transform(segment) * scale
                    coords[:, 1] = height - coords[:, 1]
                    middle = ax.transData.transform(center) * scale if center is not None else None
                    if middle is not None:
                        middle[1] = height - middle[1]
                    if not np.isfinite(coords).all() or (middle is not None and not np.isfinite(middle).all()):
                        continue
                    entries.append({'axis': axis, 'ends': coords.round(6).tolist(),
                                    'center': middle.round(6).tolist() if middle is not None else None})
                if entries and stem.get_gid():
                    cap_marker = '_' if entries[0]['axis'] == 'y' else '|'
                    errors.append({'id': stem.get_gid(), 'segments': entries,
                                   'caps': [c.get_gid() for c in caps if c.get_gid() and c.get_marker() == cap_marker],
                                   'capWidth': next((float(c.get_markersize()) for c in caps if c.get_marker() == cap_marker), 0),
                                   'lineWidth': float(stem.get_linewidths()[0])})
        for artist in ax.collections:
            if isinstance(artist, PathCollection) and artist.get_gid() and len(artist.get_offsets()):
                points.append(artist.get_gid())
        for artist in ax.lines:
            if id(artist) not in cap_ids and artist.get_gid() and artist.get_marker() not in (None, '', 'None', ' ', '_', '|'):
                points.append(artist.get_gid())
    payload = html.escape(json.dumps({'version': 1, 'points': points, 'errors': errors}, allow_nan=False), quote=False)
    return svg.replace('</svg>', f'<metadata id="studio-mark-styles">{payload}</metadata>\n</svg>')


install_capture()
