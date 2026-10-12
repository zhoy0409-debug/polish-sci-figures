"""Audit every compatible alternative of the editable nine-panel demonstration.

The temporary REVIEWED extension is deliberately confined to this test process.
It supplies evidence for promoting a view to the shared physical-frame contract.
"""
from pathlib import Path
import argparse, io, json, math, warnings
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from PIL import Image, ImageDraw

from test_composite_alignment import (ROOT, KEYS, expected_box, edited, render,
                                     main_axes, points_box, check_geometry, records_for)
import gallery_registry as registry
import gallery_layout


def sheet(images, keys, out, tag):
    for page in range(math.ceil(len(images) / 9)):
        subset = images[page * 9:(page + 1) * 9]
        pw, ph = subset[0].size
        rows = math.ceil(len(subset) / 3)
        gap, header = 18, 25
        canvas = Image.new('RGB', (pw * 3 + gap * 4, (ph + header) * rows + gap * (rows + 1)), '#f2f4f7')
        draw = ImageDraw.Draw(canvas)
        for i, im in enumerate(subset):
            x = gap + (i % 3) * (pw + gap)
            y = gap + (i // 3) * (ph + gap + header)
            draw.text((x + 8, y + 5), keys[page * 9 + i], fill='#24364f')
            canvas.paste(im, (x, y + header))
        canvas.save(out / f'{tag}-{page + 1}.png')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--audit-only', action='store_true')
    args = parser.parse_args()
    starters = json.loads((ROOT / 'skills/polish-sci-figures/assets/figure-studio/template-starters.json').read_text(encoding='utf8'))
    tables = {key: pd.DataFrame(starters[key]['rows'][1:], columns=starters[key]['rows'][0]) for key in KEYS}
    candidates = {key: registry.compatible(tables[key], key) if key in registry.CONTRACTS else
                  ['roc_pointwise_band', 'roc_bootstrap_curves'] for key in KEYS}
    allkeys = [view for views in candidates.values() for view in views]
    additions = sorted(set(allkeys) - gallery_layout.REVIEWED)
    gallery_layout.REVIEWED.update(additions)
    out = ROOT / '.cache/composite-candidates-qa'
    out.mkdir(parents=True, exist_ok=True)
    report, failures = [], []
    for size, label in [((4.8, 3.6), 'normal'), ((7.2, 3.6), 'wide'), ((3.6, 4.8), 'portrait')]:
        for version in ['original', 'edited']:
            images, viewkeys = [], []
            for source, alternatives in candidates.items():
                data = tables[source] if version == 'original' else edited(tables[source], source)
                for view in alternatives:
                    with warnings.catch_warnings(record=True) as caught:
                        warnings.simplefilter('always')
                        if view == 'roc_bootstrap_curves':
                            from figure_workbench import style
                            from roc_explorer import render_views
                            style('Arial')
                            fig = render_views(records_for(data), figsize=size, views={view})[0][1]
                        else:
                            fig = render(data, view, size)
                        fig.canvas.draw()
                        frame = points_box(fig, main_axes(fig, view))
                        try:
                            check_geometry(fig, view, size)
                            bad = [str(w.message) for w in caught if 'layout' in str(w.message).lower() or 'glyph' in str(w.message).lower()]
                            assert not bad, bad
                        except (AssertionError, StopIteration) as exc:
                            failures.append(dict(view=view, size=label, version=version, error=str(exc)))
                        report.append(dict(source=source, view=view, size=label, version=version,
                                           frame_pt=frame.tolist(), error_pt=(frame - expected_box(size)).tolist(),
                                           axes=len(fig.axes)))
                        buf = io.BytesIO()
                        fig.savefig(buf, format='png', dpi=140)
                        buf.seek(0)
                        images.append(Image.open(buf).convert('RGB'))
                        viewkeys.append(view)
                        plt.close(fig)
            sheet(images, viewkeys, out, f'{version}-{label}')
    (out / 'measurements.json').write_text(json.dumps(dict(candidates=candidates, additions=additions,
                                                          panels=report, failures=failures), ensure_ascii=False, indent=2), encoding='utf8')
    print(f'{len(report)} candidate-frame checks; {len(failures)} failures; {len(additions)} proposed REVIEWED additions')
    print(json.dumps(additions))
    if failures:
        print(json.dumps(failures, ensure_ascii=False, indent=2))
        if not args.audit_only:
            raise AssertionError('Candidate geometry or text bounds failed; inspect measurements.json')


if __name__ == '__main__':
    main()
