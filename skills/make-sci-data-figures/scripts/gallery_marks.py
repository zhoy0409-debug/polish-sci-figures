"""Editor metadata for marks. Preserve the actual estimate, including on log axes."""
import functools
import html
import json
import numpy as np
from matplotlib.axes import Axes
from matplotlib.collections import PathCollection
from matplotlib.container import BarContainer, ErrorbarContainer


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
    _prepare_color_sources(fig)


def _axis_of(artist):
    if isinstance(artist, ErrorbarContainer):
        line, caps, stems = artist.lines
        return next((a.axes for a in [line, *caps, *stems] if a is not None), None)
    return getattr(artist, 'axes', None)


def tag_color_source(target, source, paint='fill'):
    """Bind a mark to its actual series artist, without changing rendered paint."""
    if paint not in ('fill', 'stroke') or _axis_of(target) is None or _axis_of(target) is not _axis_of(source):
        raise ValueError('Colour sources must be artists on the same data axis')
    target._studio_color_source = (source, paint)


def _prepare_color_sources(fig):
    """Use explicit object ownership only; never guess from colour or position."""
    for ai, ax in enumerate(fig.axes):
        bars = [c for c in ax.containers if isinstance(c, BarContainer)]
        errors = [c for c in ax.containers if isinstance(c, ErrorbarContainer)]
        bar_patches = {id(p): p for bar in bars for p in bar.patches}
        candidates = {}
        for record in getattr(fig, '_studio_stat_groups', []):
            if record['axis'] is not ax:
                continue
            members = {id(a): a for a in record['members']}
            sources = [a for key, a in bar_patches.items() if key in members]
            if len(sources) != 1:
                continue
            targets = [a for a in members.values() if isinstance(a, PathCollection)]
            for error in errors:
                line, caps, stems = error.lines
                own = [a for a in [line, *caps, *stems] if a is not None]
                if own and all(id(a) in members for a in own):
                    targets.append(error)
                    if line is not None:
                        targets.append(line)
            for target in targets:
                candidates.setdefault(id(target), (target, {}))[1][id(sources[0])] = sources[0]
        for target, sources in candidates.values():
            if len(sources) == 1 and not hasattr(target, '_studio_color_source'):
                tag_color_source(target, next(iter(sources.values())))
        for bar in bars:
            error = bar.errorbar
            if not isinstance(error, ErrorbarContainer) or hasattr(error, '_studio_color_source'):
                continue
            if len(bar.patches) == 1:
                tag_color_source(error, bar.patches[0])
            else:
                # BarContainer owns the errorbar and its original patch order.
                # A filtered errorevery layout lacks this one-to-one relation.
                for stem in error.lines[2]:
                    if len(stem.get_segments()) == len(bar.patches):
                        stem._studio_segment_color_sources = [(patch, 'fill') for patch in bar.patches]
        for error in errors:
            line = error.lines[0]
            if line is not None and not hasattr(error, '_studio_color_source'):
                tag_color_source(error, line, 'stroke')
        # Sources without a prior semantic ID need an address in the final SVG.
        # Preserve all existing IDs, including old editable-category groups.
        sources = []
        for artist in [*ax.collections, *ax.lines, *errors]:
            source = getattr(artist, '_studio_color_source', None)
            if source:
                sources.append(source[0])
            for source, _ in getattr(artist, '_studio_segment_color_sources', []):
                sources.append(source)
        child_ids = {id(child): i for i, child in enumerate(ax.get_children())}
        for source in sources:
            if not source.get_gid() and id(source) in child_ids:
                source.set_gid(f'studio-mark-color-source-{ai}-{child_ids[id(source)]}')


def _color_source_record(value):
    if value is None:
        return None
    source, paint = value
    if not source.get_visible() or not source.get_gid():
        return None
    return {'id': source.get_gid(), 'paint': paint}


def _point_centers(artist, ax, scale, height):
    """Actual data-offset locations, in the same order as serialized markers."""
    transform = artist.get_offset_transform()
    if not transform.contains_branch(ax.transData):
        return None
    try:
        offsets = np.ma.asarray(artist.get_offsets(), dtype=float)
        if offsets.ndim != 2 or offsets.shape[1] != 2:
            return None
        coords = np.asarray(transform.transform(offsets.filled(np.nan)), dtype=float) * scale
        coords[:, 1] = height - coords[:, 1]
        valid = ~np.ma.getmaskarray(offsets).any(axis=1) & np.isfinite(coords).all(axis=1)
        return coords[valid].round(6).tolist()
    except (TypeError, ValueError, FloatingPointError):
        return None


def tag_stat_group(ax, group, facet, center, artists):
    """Record a rendered factor/group cell without inferring labels from colour.

    Coordinates stay in data units until export, after the final axes layout.
    Members are the cell's own data artists, never its legend or neighbouring
    groups. Existing IDs and every artist's geometry/style remain unchanged.
    """
    fig = ax.figure
    records = getattr(fig, '_studio_stat_groups', [])
    members = []
    for artist in artists:
        if artist is None or artist in members:
            continue
        if artist.axes is not ax:
            raise ValueError('Statistical anchor members must belong to their data axis')
        if not artist.get_gid():
            # Preserve the editor's existing studio-mark-* geometry detection.
            artist.set_gid(f'studio-mark-stat-c{len(records)}-m{len(members)}')
        members.append(artist)
    records.append({'axis': ax, 'group': str(group),
                    'facet': {'column': 'factor', 'value': str(facet)},
                    'center': tuple(center), 'members': members})
    fig._studio_stat_groups = records


def _embed_stat_groups(svg, fig):
    """Serialize exact cell membership and centres in final SVG point units."""
    records = getattr(fig, '_studio_stat_groups', [])
    if not records:
        return svg
    axes = {}
    scale, height = 72 / fig.dpi, fig.get_figheight() * 72
    for record in records:
        ax = record['axis']
        if not ax.get_visible() or ax not in fig.axes:
            continue
        center = ax.transData.transform(record['center']) * scale
        center[1] = height - center[1]
        if not np.isfinite(center).all():
            continue
        axis_id = ax.get_gid() or f'axes_{fig.axes.index(ax) + 1}'
        axis = axes.setdefault(axis_id, {'axis': axis_id, 'groups': []})
        members = [a.get_gid() for a in record['members']
                   if a.get_visible() and a.get_gid() and a.axes is ax]
        if not members:
            continue
        axis['groups'].append({'group': record['group'], 'facet': record['facet'],
                               'center': center.round(6).tolist(), 'members': members})
    if not axes:
        return svg
    payload = html.escape(json.dumps({'version': 1, 'group_column': 'group',
                                    'facet_column': 'factor', 'axes': list(axes.values())},
                                    ensure_ascii=False, allow_nan=False), quote=False)
    return svg.replace('</svg>', f'<metadata id="studio-stat-anchors">{payload}</metadata>\n</svg>')


def embed_marks(svg, fig):
    points, point_colors, errors = [], [], []
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
                color_sources = getattr(stem, '_studio_segment_color_sources', [])
                for si, segment in enumerate(stem.get_segments()):
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
                    entry = {'axis': axis, 'ends': coords.round(6).tolist(),
                             'center': middle.round(6).tolist() if middle is not None else None}
                    source = _color_source_record(color_sources[si]) if si < len(color_sources) else None
                    if source:
                        entry['colorSource'] = source
                    entries.append(entry)
                if entries and stem.get_gid():
                    cap_marker = '_' if entries[0]['axis'] == 'y' else '|'
                    errors.append({'id': stem.get_gid(), 'segments': entries,
                                   'caps': [c.get_gid() for c in caps if c.get_gid() and c.get_marker() == cap_marker],
                                   'capWidth': next((float(c.get_markersize()) for c in caps if c.get_marker() == cap_marker), 0),
                                   'lineWidth': float(stem.get_linewidths()[0])})
                    source = _color_source_record(getattr(container, '_studio_color_source', None))
                    if source:
                        errors[-1]['colorSource'] = source
        for artist in ax.collections:
            if isinstance(artist, PathCollection) and artist.get_gid() and len(artist.get_offsets()):
                points.append(artist.get_gid())
                point_colors.append({'id': artist.get_gid(), 'kind': 'collection'})
                centers = _point_centers(artist, ax, scale, height)
                if centers is not None:
                    point_colors[-1]['centers'] = centers
                source = _color_source_record(getattr(artist, '_studio_color_source', None))
                if source:
                    point_colors[-1]['colorSource'] = source
        for artist in ax.lines:
            if id(artist) not in cap_ids and artist.get_gid() and artist.get_marker() not in (None, '', 'None', ' ', '_', '|'):
                points.append(artist.get_gid())
                point_colors.append({'id': artist.get_gid(), 'kind': 'line'})
                source = _color_source_record(getattr(artist, '_studio_color_source', (artist, 'stroke')))
                if source:
                    point_colors[-1]['colorSource'] = source
    payload = html.escape(json.dumps({'version': 1, 'points': points, 'pointColors': point_colors,
                                    'errors': errors}, allow_nan=False), quote=False)
    svg = svg.replace('</svg>', f'<metadata id="studio-mark-styles">{payload}</metadata>\n</svg>')
    return _embed_stat_groups(svg, fig)


install_capture()
