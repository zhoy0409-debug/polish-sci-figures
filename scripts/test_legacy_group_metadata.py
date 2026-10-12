"""Legacy category membership: complete SVG groups, unchanged scientific artwork."""
from __future__ import annotations

import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
from tempfile import TemporaryDirectory
from unittest.mock import patch
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'skills/make-sci-data-figures/scripts'),
               str(ROOT / 'skills/polish-sci-figures/scripts')]
import numpy as np
import pandas as pd
import figure_workbench as wb

NS = '{http://www.w3.org/2000/svg}'
ORDER = ['Control & baseline', 'Treatment <high>']
COLORS = ['#3f6da3', '#c95770']
VIEWS = {'raw_points_estimate_ci': wb.plot_points_ci,
         'estimation_graphic': wb.plot_estimation_graphic}


def fixture(changed=False):
    data = pd.DataFrame({'group': [g for g in ORDER for _ in range(8)],
                         'unit': [f'{g}-{i}' for g in range(2) for i in range(8)],
                         'value': [-2., -1., 0., .5, 1., 2., 2.5, 3.,
                                   -.5, .2, 1., 1.8, 2., 3., 4., 4.5]})
    if changed:
        data.loc[9, 'value'] = 5.7
    return data


def render(view, data, size=(4.8, 3.6)):
    analysis, work = wb.analyse(data, 'group', 'value', ORDER, 'independent', 'unit')
    wb.FIGSIZE = size
    fig = VIEWS[view](work, 'group', 'value', ORDER, COLORS, 'Value (mg/L)', analysis)
    return fig, analysis


def svg(fig):
    output = io.StringIO()
    fig.savefig(output, format='svg', metadata={'Date': None})
    return wb.embed_category_metadata(output.getvalue(), fig)


def check_svg(raw):
    root = ET.fromstring(raw)
    identifiers = [node.get('id') for node in root.iter() if node.get('id')]
    assert len(identifiers) == len(set(identifiers)), 'Duplicate SVG identifiers'
    by_id = {node.get('id'): node for node in root.iter() if node.get('id')}
    metadata = json.loads(by_id['studio-category-groups'].text)
    assert metadata['version'] == 1 and len(metadata['axes']) == 1
    axis = metadata['axes'][0]
    assert axis['axis'] == 'axes_1' and axis['axis'] in by_id
    assert [g['label'] for g in axis['groups']] == ORDER
    centers = []
    for i, group in enumerate(axis['groups']):
        prefix = f'studio-category-a0-g{i}'
        expected = {f'{prefix}-{suffix}' for suffix in
                    ['points', 'mean', 'cap0', 'cap1', 'ci', 'label', 'tick']}
        assert set(group['members']) == expected
        assert expected <= by_id.keys(), f'Missing group members: {expected - by_id.keys()}'
        uses = list(by_id[group['tick']].iter(NS + 'use'))
        assert len(uses) == 1 and np.isfinite(float(uses[0].get('x')))
        centers.append(float(uses[0].get('x')))
        assert len(list(by_id[f'{prefix}-points'].iter(NS + 'use'))) == 8
        assert ORDER[i] == ' '.join(''.join(by_id[f'{prefix}-label'].itertext()).split())
    assert centers[0] < centers[1]
    # The estimation effect panel never joins categorical spacing transforms.
    if 'axes_2' in by_id:
        assert not any(node.get('id', '').startswith('studio-category-')
                       for node in by_id['axes_2'].iter())
    return metadata


def run():
    wb.style('DejaVu Sans')
    output = ROOT / '.cache/legacy-group-metadata'
    output.mkdir(parents=True, exist_ok=True)
    tempfile.tempdir = str(output)
    cases = 0
    for view in VIEWS:
        for size in [(4.8, 3.6), (3.6, 4.8), (7.2, 3.6)]:
            for changed in [False, True]:
                data = fixture(changed)
                before = data.copy(deep=True)
                fig, analysis = render(view, data, size)
                check_svg(svg(fig))
                # Metadata neither mutates input nor changes the underlying y coordinates.
                pd.testing.assert_frame_equal(data, before)
                for index, group in enumerate(ORDER):
                    points = next(c for c in fig.axes[0].collections
                                  if c.get_gid() == f'studio-category-a0-g{index}-points')
                    np.testing.assert_array_equal(points.get_offsets()[:, 1],
                                                  data.loc[data.group == group, 'value'])
                if size == (4.8, 3.6) and not changed:
                    (output / f'{view}.svg').write_text(svg(fig), encoding='utf-8')
                wb.plt.close(fig)
                cases += 1

        # A metadata-only change must be pixel-identical to the same renderer
        # with group tagging disabled, including effect axis and statistical text.
        tagged, analysis = render(view, fixture())
        with patch.object(wb, 'tag_category_groups', lambda *args: None):
            plain, plain_analysis = render(view, fixture())
        tagged.canvas.draw(); plain.canvas.draw()
        np.testing.assert_array_equal(np.asarray(tagged.canvas.buffer_rgba()),
                                      np.asarray(plain.canvas.buffer_rgba()))
        assert analysis == plain_analysis
        wb.save_figure(tagged, output / f'{view}-export')
        check_svg((output / f'{view}-export.svg').read_text(encoding='utf-8'))
        wb.plt.close(plain)
        cases += 1

    from studio_sizes import render_sizes
    with TemporaryDirectory() as tmp:
        directory = Path(tmp)
        data = fixture()
        source = directory / 'data.csv'
        data.to_csv(source, index=False)
        analysis, _ = wb.analyse(data, 'group', 'value', ORDER, 'independent', 'unit')
        analysis['source_sha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
        recipe = {'input': 'data.csv', 'group': 'group', 'value': 'value',
                  'subject': 'unit', 'order': ORDER, 'design': 'independent',
                  'font': 'DejaVu Sans', 'palette': 'zhoy_muted'}
        variants = [{'name': view, 'width': 345.6, 'height': 259.2} for view in VIEWS]
        for view, size, raw in render_sizes(directory, recipe, analysis, variants,
                                            allowed_sizes={'wide', 'portrait'}):
            if view in VIEWS:
                check_svg(raw)
                (output / f'{view}-{size}.svg').write_bytes(raw)
                cases += 1

        # Exercise the real API adapter rather than just direct savefig output.
        from studio_server import regenerate
        rows = [list(data.columns), *data.astype(str).values.tolist()]
        before = copy.deepcopy(rows)
        panel = regenerate(recipe, rows)
        assert rows == before
        for view in VIEWS:
            matching = [v for v in panel['variants'] if v['name'] == view]
            assert matching, view
            for variant in matching:
                check_svg(variant['svg'])
                cases += 1
    print(f'PASS: {cases} legacy group metadata/render checks; pixel-identical artwork; {output}')


if __name__ == '__main__':
    run()
