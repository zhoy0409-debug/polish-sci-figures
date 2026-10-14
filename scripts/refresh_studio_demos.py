"""Re-embed the current editor into repository demo pages without changing data.

The default writes regenerated previews into .cache. --write-existing atomically
replaces only the known demo/figure_studio/*.html pages after all inputs parse.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
from pathlib import Path
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
DEMO = ROOT / 'demo/figure_studio'
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from figure_studio import write_html


class EmbeddedProject(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.active = False
        self.parts: list[str] = []
        self.count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'script' and attrs.get('id') == 'project':
            if self.active:
                raise ValueError('Nested project payload')
            self.count += 1
            self.active = True

    def handle_endtag(self, tag):
        if tag == 'script':
            self.active = False

    def handle_data(self, data):
        if self.active:
            self.parts.append(data)


def read_project(path: Path) -> dict:
    parser = EmbeddedProject()
    parser.feed(path.read_text(encoding='utf-8-sig'))
    if parser.count != 1:
        raise ValueError(f'{path.name}: expected one embedded project payload')
    project = json.loads(''.join(parser.parts))
    if project.get('schema') != 'figure-studio/1' or not project.get('panels'):
        raise ValueError(f'{path.name}: unsupported project')
    return project


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--write-existing', action='store_true')
    ap.add_argument('--output-dir', type=Path, default=ROOT / '.cache/refreshed-studio-demos')
    args = ap.parse_args()
    # Read every project before the first mutation; do not manufacture data or
    # replace a broken demo with a blank workspace.
    projects = [(path, read_project(path)) for path in sorted(DEMO.glob('*.html'))]
    if not projects:
        raise ValueError('No repository Figure Studio demos were found')
    records = []
    for old, project in projects:
        target = old if args.write_existing else args.output_dir / old.name
        if args.write_existing and target.resolve().parent != DEMO.resolve():
            raise ValueError('Replacement target is outside the known demo directory')
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.' + uuid.uuid4().hex + '.building')
        write_html(project, temporary)
        generated = temporary.read_text(encoding='utf-8')
        if 'const StudioLegacyStatCleanup=' not in generated:
            raise ValueError('Current editor did not include the legacy recovery module')
        if 'const legacyDerivedVariantCache=' not in generated:
            raise ValueError('Current editor did not include derived-viewport recovery')
        temporary.replace(target)
        records.append({'source': str(old.relative_to(ROOT)), 'output': str(target),
                        'panels': len(project['panels']),
                        'variants': sum(len(p['variants']) for p in project['panels']),
                        'original_project_and_data_preserved': True})
    print(json.dumps(records, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
