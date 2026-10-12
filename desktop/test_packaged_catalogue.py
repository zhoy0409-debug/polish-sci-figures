"""Exercise representative templates through an already running packaged app.

Standard library only: starter rows/recipes and the local authorization token
come from the live editor HTML. This is an HTTP/rendering smoke test, not a
visual-overlap review or independent validation of supplied statistical results.
"""
from __future__ import annotations

import argparse
import copy
import csv
from decimal import Decimal
import hashlib
from html.parser import HTMLParser
import http.client
import io
import json
import math
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlsplit
import xml.etree.ElementTree as ET


CASES = (
    ('compare_raincloud', 'gallery_compare', 'Raw observations / raincloud'),
    ('compare_facet_boxes', 'gallery_compare', 'Faceted group comparisons'),
    ('clustered_matrix', 'gallery_omics_special', 'Clustered heatmap'),
    ('roc_pointwise_band', 'roc', 'ROC and pointwise uncertainty'),
    ('roc_smooth', 'roc_results', 'Supplied smoothed ROC results'),
    ('pca_loadings', 'gallery_workbench', 'PCA scores and supplied loadings'),
    ('volcano_labels', 'gallery_omics_special', 'Supplied differential-analysis results'),
    ('meta_forest', 'gallery_clinical', 'Supplied meta-analysis estimates'),
    ('dose_response_result', 'gallery_omics_special', 'Supplied dose-response fit'),
    ('time_mean_band', 'gallery_time_composition', 'Repeated-unit time course'),
    ('upset_intersections', 'gallery_workbench', 'Set intersections'),
    ('flow_alluvial', 'gallery_omics_special', 'Alluvial / Sankey flow'),
    ('survival_risk_counts', 'gallery_clinical', 'Survival curve and risk counts'),
    ('gsea_tracks', 'gallery_workbench', 'Supplied enrichment scores and ranked track'),
    ('model_shap_summary', 'gallery_model_extras', 'Supplied model explanations'),
    ('time_stl_components', 'gallery_temporal_extras', 'Supplied additive STL components'),
    ('mediation_paths_result', 'gallery_structure_extras', 'Supplied mediation path coefficients'),
    ('genome_manhattan', 'gallery_workbench', 'Genome-wide supplied P values'),
    ('distribution_sina', 'gallery_misc', 'Density-constrained observations'),
    ('synergy_surface_result', 'gallery_structure_extras', 'Supplied interaction surface'),
)
SVG_NS = 'http://www.w3.org/2000/svg'


class EditorDataParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.values = {}
        self.active = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('id') in {'local-engine', 'templateStarters'}:
            identity = attrs['id']
            if identity in self.values:
                raise ValueError('Duplicate embedded editor data: ' + identity)
            self.values[identity] = []
            self.active = identity

    def handle_endtag(self, tag):
        if tag == 'script':
            self.active = None

    def handle_data(self, data):
        if self.active:
            self.values[self.active].append(data)

    def decoded(self, identity):
        if identity not in self.values:
            raise ValueError('Live page does not contain ' + identity)
        value = json.loads(''.join(self.values[identity]))
        if not isinstance(value, dict):
            raise ValueError(identity + ' must be an object')
        return value


class LocalClient:
    def __init__(self, url, timeout=300):
        parsed = urlsplit(url)
        if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or parsed.username or parsed.password:
            raise ValueError('Use the packaged application URL: http://127.0.0.1:PORT/')
        if parsed.path not in {'', '/'} or parsed.query or parsed.fragment:
            raise ValueError('Use the editor root URL without a path, query or fragment.')
        self.port = parsed.port or 80
        self.origin = f'http://127.0.0.1:{self.port}'
        self.timeout = timeout
        self.token = None
        self.endpoint = None

    def request(self, path='/', payload=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.port, timeout=self.timeout)
        headers = {}
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8')
            headers = {'Content-Type': 'application/json', 'Origin': self.origin,
                       'X-Studio-Token': self.token}
        try:
            connection.request('POST' if payload is not None else 'GET', path, body=body, headers=headers)
            response = connection.getresponse()
            raw = response.read()
            if response.status != 200:
                try:
                    message = json.loads(raw).get('error', '')
                except (ValueError, AttributeError):
                    message = raw.decode('utf-8', errors='replace')[:500]
                raise RuntimeError(f'HTTP {response.status} at {path}: {message}')
            return raw
        finally:
            connection.close()

    def catalogue(self):
        parser = EditorDataParser()
        parser.feed(self.request().decode('utf-8'))
        engine, starters = parser.decoded('local-engine'), parser.decoded('templateStarters')
        token, endpoint = engine.get('token'), engine.get('endpoint')
        if not isinstance(token, str) or not token or endpoint != '/api/render':
            raise ValueError('Unexpected local engine configuration in the live page.')
        self.token, self.endpoint = token, endpoint
        return starters

    def render(self, starter):
        if not isinstance(starter, dict) or set(starter) != {'recipe', 'rows'}:
            raise ValueError('Expected a starter with exactly recipe and rows.')
        result = json.loads(self.request(self.endpoint, starter))
        if not isinstance(result, dict) or not isinstance(result.get('panel'), dict):
            raise ValueError('The render response did not contain a panel.')
        return result


def table_sha256(rows):
    # Matches the API's source CSV encoding, without importing its modules.
    stream = io.StringIO(newline='')
    csv.writer(stream).writerows(rows)
    return hashlib.sha256(stream.getvalue().encode('utf-8')).hexdigest()


def positive_finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


def artwork_digest(svg):
    """Ignore random Matplotlib IDs and metadata when detecting a redraw."""
    root = ET.fromstring(svg)
    identities = {node.attrib['id']: f'node-{i}' for i, node in enumerate(root.iter()) if 'id' in node.attrib}
    graphics = []
    visible_types = {'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
                     'text', 'tspan', 'image', 'use'}

    def references(value):
        return re.sub(r'#([A-Za-z_][\w:.-]*)', lambda match: '#' + identities.get(match[1], match[1]), value)

    for node in root.iter():
        tag = node.tag.rsplit('}', 1)[-1]
        if tag not in visible_types:
            continue
        attrs = [(key, references(value)) for key, value in sorted(node.attrib.items())
                 if key not in {'id', 'class'} and not key.startswith('data-')]
        graphics.append([tag, attrs, node.text or ''])
    return hashlib.sha256(json.dumps(graphics, ensure_ascii=False).encode()).hexdigest()


def verify_panel(key, starter, panel):
    expected = table_sha256(starter['rows'])
    table = panel.get('table')
    if not isinstance(table, dict) or table.get('rows') != starter['rows'] or table.get('sha256') != expected:
        raise AssertionError('Returned table rows/SHA-256 do not match the exact submitted data.')
    variants = panel.get('variants')
    if not isinstance(variants, list) or not variants:
        raise AssertionError('No SVG variants returned.')
    checked = []
    for variant in variants:
        if not positive_finite(variant.get('width')) or not positive_finite(variant.get('height')):
            raise AssertionError('Variant has non-finite or non-positive physical dimensions.')
        view_box = variant.get('viewBox')
        if (not isinstance(view_box, list) or len(view_box) != 4 or
                not all(type(value) in (int, float) and math.isfinite(value) for value in view_box) or
                not all(value > 0 for value in view_box[2:])):
            raise AssertionError('Variant has an invalid viewBox.')
        raw = variant.get('svg')
        if not isinstance(raw, str) or not raw.strip():
            raise AssertionError('Variant contains no SVG.')
        root = ET.fromstring(raw)
        if root.tag != '{' + SVG_NS + '}svg':
            raise AssertionError('Variant XML root is not SVG.')
        svg_box = [float(value) for value in root.attrib.get('viewBox', '').split()]
        if len(svg_box) != 4 or any(not math.isclose(a, b, abs_tol=1e-5) for a, b in zip(svg_box, view_box)):
            raise AssertionError('SVG viewBox differs from the returned variant dimensions.')
        if not any(node.tag.rsplit('}', 1)[-1] in {'path', 'image', 'rect', 'circle', 'line', 'use'} for node in root.iter()):
            raise AssertionError('SVG contains no graphical elements.')
        checked.append({'name': variant.get('name'), 'size': variant.get('size'),
                        'width_pt': variant['width'], 'height_pt': variant['height']})
    selected = panel.get('initialVariant')
    if type(selected) is not int or not 0 <= selected < len(variants):
        raise AssertionError('Invalid selected variant index.')
    if not any(variant.get('name') == key for variant in variants):
        raise AssertionError('Requested template is absent from returned variants: ' + key)
    if variants[selected].get('name') != key:
        raise AssertionError('The selected view differs from the requested template: ' + str(variants[selected].get('name')))
    result = {'input_sha256': expected, 'returned_sha256': table['sha256'],
              'input_rows': len(starter['rows']) - 1, 'selected_view': key,
              'variant_count': len(variants), 'variants': checked,
              'artwork_sha256': artwork_digest(variants[selected]['svg'])}
    return result, variants[selected]['svg']


def save_report(path, report):
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(report, ensure_ascii=False, allow_nan=False, indent=2), encoding='utf-8')
    temporary.replace(path)


def run(url, outdir, timeout=300):
    outdir = Path(outdir).resolve()
    outdir.mkdir(parents=True, exist_ok=True)
    report_path = outdir / 'catalogue-check.json'
    client = LocalClient(url, timeout)
    report = {'passed': False, 'complete': False, 'url': client.origin + '/',
              'started_at_utc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
              'scope': 'Representative packaged HTTP rendering; not visual layout or statistical-method validation',
              'cases': [], 'edited_heatmap': None}
    save_report(report_path, report)
    try:
        starters = client.catalogue()
        families = {entry['recipe'].get('family') for entry in starters.values()
                    if isinstance(entry, dict) and isinstance(entry.get('recipe'), dict)}
        report['starter_count'] = len(starters)
        report['available_families'] = sorted(str(family) for family in families)
        tested_families = set()
        heatmap_baseline = None
        for key, module, purpose in CASES:
            entry = {'key': key, 'module': module, 'purpose': purpose, 'passed': False}
            began = time.monotonic()
            try:
                if key not in starters:
                    raise AssertionError('Required representative starter is missing from the live page.')
                starter = copy.deepcopy(starters[key])
                response = client.render(starter)
                details, svg = verify_panel(key, starter, response['panel'])
                entry.update(details)
                entry.update(passed=True, family=starter['recipe'].get('family'),
                             server_seconds=response.get('seconds'), svg=key + '.svg')
                (outdir / entry['svg']).write_text(svg, encoding='utf-8')
                tested_families.add(entry['family'])
                if key == 'clustered_matrix':
                    heatmap_baseline = details
            except Exception as error:
                entry['error'] = type(error).__name__ + ': ' + str(error)
            entry['elapsed_seconds'] = round(time.monotonic() - began, 3)
            report['cases'].append(entry)
            save_report(report_path, report)
            print(f'{"PASS" if entry["passed"] else "FAIL"} {key}', flush=True)
        report['uncovered_families'] = sorted(str(family) for family in families - tested_families)
        edited = {'key': 'clustered_matrix', 'passed': False}
        try:
            if heatmap_baseline is None:
                raise AssertionError('The baseline heatmap did not pass.')
            starter = copy.deepcopy(starters['clustered_matrix'])
            column = starter['rows'][0].index('value')
            before = starter['rows'][1][column]
            if not math.isfinite(float(before)):
                raise AssertionError('The heatmap value is not finite.')
            after = str(Decimal(before) + Decimal('0.375'))
            starter['rows'][1][column] = after
            response = client.render(starter)
            details, svg = verify_panel('clustered_matrix', starter, response['panel'])
            if details['input_sha256'] == heatmap_baseline['input_sha256']:
                raise AssertionError('Replacing a heatmap value did not change the source-data hash.')
            if details['artwork_sha256'] == heatmap_baseline['artwork_sha256']:
                raise AssertionError('Replacing a heatmap value did not change the rendered artwork.')
            edited.update(details)
            edited.update(passed=True, changed_cell={'data_row': 1, 'column': 'value', 'before': before, 'after': after},
                          svg='clustered_matrix-edited.svg')
            (outdir / edited['svg']).write_text(svg, encoding='utf-8')
            (outdir / 'clustered_matrix-edited-input.json').write_text(
                json.dumps(starter, ensure_ascii=False, indent=2), encoding='utf-8')
        except Exception as error:
            edited['error'] = type(error).__name__ + ': ' + str(error)
        report['edited_heatmap'] = edited
        report['complete'] = True
        report['passed'] = (all(case['passed'] for case in report['cases']) and edited['passed']
                            and not report['uncovered_families'])
    except Exception as error:
        report['error'] = type(error).__name__ + ': ' + str(error)
    finally:
        report['finished_at_utc'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
        save_report(report_path, report)
    return report


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True, help='Running packaged editor, e.g. http://127.0.0.1:18767/')
    parser.add_argument('--outdir', required=True, type=Path)
    parser.add_argument('--timeout', type=float, default=300, help='Per-request timeout in seconds')
    args = parser.parse_args(argv)
    if not math.isfinite(args.timeout) or args.timeout <= 0:
        parser.error('--timeout must be finite and positive')
    report = run(args.url, args.outdir, args.timeout)
    print(json.dumps({'passed': report['passed'], 'complete': report['complete'],
                      'passed_cases': sum(case['passed'] for case in report['cases']),
                      'cases': len(report['cases']), 'edited_heatmap': bool(report['edited_heatmap'] and report['edited_heatmap']['passed']),
                      'report': str((args.outdir / 'catalogue-check.json').resolve())}))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
