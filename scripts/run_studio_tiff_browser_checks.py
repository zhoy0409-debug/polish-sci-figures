"""Production loopback TIFF/JSON/derivative browser checks; public fixtures only.

Uses the actual local Handler and Pillow renderer, never a mocked HTTP response.
No updater is configured, so this fixture does not initiate external checks.
It does not install or exercise a frozen Windows application.
"""
from __future__ import annotations

import argparse
from http.server import ThreadingHTTPServer
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import threading


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'desktop'))
sys.path.insert(0, str(ROOT / 'skills/polish-sci-figures/scripts'))
from build_starter import build
from studio_server import Handler, LoopbackHTTPServer


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True, help='New evidence directory; refuses overwrite')
    args = parser.parse_args()
    output = args.out.resolve()
    output.mkdir(parents=True, exist_ok=False)
    html = build(output / 'source.html')
    server = LoopbackHTTPServer(('127.0.0.1', 0), Handler)
    server.page = html
    server.token = secrets.token_urlsafe(32)
    server.address = '127.0.0.1:' + str(server.server_port)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    report = {'author': 'a', 'scope': 'Real local browser and production TIFF/JSON/correction engines with public synthetic fixtures; not native installed Windows or independent detector accuracy', 'checks': []}
    try:
        for name in ('test_project_codec_browser.cjs', 'test_scientific_tiff_browser.cjs', 'test_scientific_tiff_derivative_browser.cjs', 'test_submission_profiles_browser.cjs', 'test_history_shortcuts_browser.cjs', 'test_studio_drawer_workspace_browser.cjs', 'test_studio_drawer_compact_browser.cjs', 'test_studio_discovery_dock_browser.cjs', 'test_studio_support_browser.cjs', 'test_studio_text_content_browser.cjs', 'test_studio_wb_browser.cjs', 'test_studio_wb_advanced_browser.cjs', 'test_studio_core_workbench_browser.cjs', 'test_studio_statistics_report_browser.cjs', 'test_studio_feedback_five_browser.cjs', 'test_studio_guided_tasks_browser.cjs', 'test_studio_move_geometry_browser.cjs'):
            target = output / Path(name).stem
            result = subprocess.run(['node', str(ROOT / 'scripts' / name), 'http://' + server.address + '/', str(target)], cwd=ROOT, env=os.environ.copy(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8', errors='replace', timeout=150)
            (output / (name + '.log')).write_text(result.stdout, encoding='utf-8')
            report['checks'].append({'script': name, 'exitCode': result.returncode})
            (output / 'summary.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
            print(result.stdout, flush=True)
        for count in (5000, 10000):
            result = subprocess.run(['node', str(ROOT/'scripts/test_studio_move_performance_browser.cjs'), 'http://' + server.address + '/', str(output/f'move-{count}'), 'candidate', str(count)], cwd=ROOT, env=os.environ.copy(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8', errors='replace', timeout=180)
            (output/f'move-{count}.log').write_text(result.stdout, encoding='utf-8')
            report['checks'].append({'script': f'move-{count}', 'exitCode': result.returncode})
            (output/'summary.json').write_text(json.dumps(report, indent=2)+'\n', encoding='utf-8')
            print(result.stdout, flush=True)
        result = subprocess.run(['node', str(ROOT/'scripts/test_studio_feedback_five_browser.cjs'), html.as_uri(), str(output/'offline-feedback-five')], cwd=ROOT, env=os.environ.copy(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8', errors='replace', timeout=150)
        (output/'offline-feedback-five.log').write_text(result.stdout, encoding='utf-8')
        report['checks'].append({'script':'test_studio_feedback_five_browser.cjs (file)', 'exitCode':result.returncode})
        from make_tiff_browser_fixtures import build as tiff_fixtures
        fixtures = tiff_fixtures(output / 'offline-fixtures')
        result = subprocess.run(['node', str(ROOT/'scripts/test_scientific_tiff_offline_browser.cjs'), str(html), str(fixtures), str(output/'offline-tiff')], cwd=ROOT, env=os.environ.copy(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8', errors='replace', timeout=150)
        (output/'offline-tiff.log').write_text(result.stdout, encoding='utf-8')
        report['checks'].append({'script':'test_scientific_tiff_offline_browser.cjs','exitCode':result.returncode})
        print(result.stdout, flush=True)
        report['passed'] = all(check['exitCode'] == 0 for check in report['checks'])
        return 0 if report['passed'] else 1
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=5)
        (output / 'summary.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    raise SystemExit(main())
