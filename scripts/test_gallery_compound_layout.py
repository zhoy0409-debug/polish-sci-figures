"""Compound PCA and genomic charts preserve the common physical data frame."""
import io
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / 'scripts'), str(ROOT / 'skills/make-sci-data-figures/scripts')]
from build_gallery_styles import fixtures
from figure_workbench import style
from gallery_layout import apply_layout, frame_for
from gallery_workbench import render
from test_gallery_time_composition import check_bounds
import matplotlib.pyplot as plt


def check(fig, key):
    apply_layout(fig, key)
    check_bounds(fig, key)
    main = fig._studio_main_axes[0]
    np.testing.assert_allclose(main.get_position().bounds, frame_for(fig), atol=1e-10)
    if key == 'pca_loadings':
        zero, ux, uy = main.transData.transform([[0, 0], [1, 0], [0, 1]])
        np.testing.assert_allclose(np.linalg.norm(ux-zero), np.linalg.norm(uy-zero), rtol=1e-10)
        top, right = fig.axes[1:3]
        np.testing.assert_allclose(top.get_xlim(), main.get_xlim())
        np.testing.assert_allclose(right.get_ylim(), main.get_ylim())
        main_box = main.get_position()
        np.testing.assert_allclose(top.get_position().x0, main_box.x0)
        np.testing.assert_allclose(top.get_position().width, main_box.width)
        np.testing.assert_allclose(right.get_position().y0, main_box.y0)
        np.testing.assert_allclose(right.get_position().height, main_box.height)
        renderer = fig.canvas.get_renderer()
        for legend in fig.legends:
            box = legend.get_window_extent(renderer)
            assert box.x0 >= 0 and box.y0 >= 0 and box.x1 <= fig.bbox.width and box.y1 <= fig.bbox.height
            assert box.y0 > top.get_window_extent(renderer).y1, 'Group legend overlaps marginal density'
        assert '\n' not in fig.texts[0].get_text(), 'Loading key must remain a single line'
    svg = io.StringIO()
    fig.savefig(svg, format='svg', metadata={'Date': None})
    assert '<image' not in svg.getvalue()
    assert 'studio-plot-frame' in svg.getvalue()


def main():
    style('Arial')
    colors = ['#3f6da3', '#c95770', '#93accb', '#69758b', '#b68b56', '#9c83a2']
    sizes = [(4.8, 3.6), (7.2, 3.6), (3.6, 4.8), (14.7333, 3.6), (4.8, 7.3667)]
    tables = fixtures()
    out = ROOT / '.cache/compound-layout'
    out.mkdir(parents=True, exist_ok=True)
    count = 0
    for key in ['pca_loadings', 'coverage_tracks', 'genome_manhattan']:
        original = tables[key].copy(deep=True)
        changed = original.copy(deep=True)
        if key == 'pca_loadings':
            changed['x'] *= 1.5
            changed['y'] = changed['y'] * .83 + 1
        elif key == 'coverage_tracks':
            changed['coverage'] *= .75
        else:
            changed['p'] **= 1.3
        for version, table in [('original', original), ('replaced', changed)]:
            for i, size in enumerate(sizes):
                fig = render(table, key, colors=colors, figsize=size)
                check(fig, key)
                np.testing.assert_allclose(fig.get_size_inches(), size)
                if version == 'original':
                    fig.savefig(out / f'{key}-aligned-{i}.png', dpi=140)
                plt.close(fig)
                count += 1
        pd.testing.assert_frame_equal(original, tables[key])
    # Names that cannot fit the auxiliary strip remain identifiable and do not
    # force the data frame to shrink or overlap the marginal density axes.
    names = tables['pca_loadings'].copy(deep=True)
    scores = names[names.role == 'score'].copy()
    extra = scores.copy()
    extra['id'] += '-replicate'
    extra['group'] += ' extended experimental condition'
    names = pd.concat([names, extra], ignore_index=True)
    names.loc[names.role == 'loading', 'id'] += ' extended feature name'
    for i, size in enumerate(sizes[:3]):
        fig = render(names, 'pca_loadings', colors=colors, figsize=size)
        check(fig, 'pca_loadings')
        fig.savefig(out / f'pca-names-{i}.png', dpi=140)
        plt.close(fig)
        count += 1
    print(f'PASS: {count} aligned PNG/SVG renders; exact main frame, equal PCA units, auxiliary alignment, changed data, fixed canvas')


if __name__ == '__main__':
    main()
