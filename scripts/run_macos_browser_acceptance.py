"""Run visible editor workflows against an actual macOS application bundle.

The on-screen native launcher is checked through CoreGraphics. Browser tests
run headed, with synthetic inputs. This is automated hosted-macOS acceptance,
not a claim of human testing on a personally owned Mac or native IME coverage.
"""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import plistlib
import platform
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--app', type=Path, required=True)
    parser.add_argument('--out', type=Path, required=True)
    parser.add_argument('--probe', action='store_true', help='Validate the GUI environment using the previous stable app')
    args = parser.parse_args()
    assert sys.platform == 'darwin', 'Run on real macOS, not emulation on Linux'
    app, out = args.app.resolve(strict=True), args.out.resolve()
    out.mkdir(parents=True, exist_ok=False)
    info = plistlib.loads((app/'Contents/Info.plist').read_bytes())
    exe = app/'Contents/MacOS'/info['CFBundleExecutable']
    data = out/'profile'
    report = {'author': 'a', 'platform': platform.platform(), 'architecture': platform.machine(),
              'appVersion': info['CFBundleShortVersionString'], 'headedBrowser': True,
              'scope': 'Automated native macOS desktop/window and frozen-app browser interaction; not human/device IME certification', 'checks': []}
    env = os.environ.copy()
    env['NODE_OPTIONS'] = '--require=' + str(ROOT/'scripts/macos_headed_browser.cjs')
    env['STUDIO_TIFF_BROWSER'] = 'chromium'
    log = (out/'launcher.log').open('wb')
    process = subprocess.Popen([str(exe), '--no-open', '--data-dir', str(data)], env=env, stdout=log, stderr=subprocess.STDOUT)
    try:
        deadline = time.monotonic()+60
        while not (data/'instance.json').is_file():
            assert process.poll() is None and time.monotonic() < deadline, 'Native application did not become ready'
            time.sleep(.2)
        instance = json.loads((data/'instance.json').read_text())
        assert instance['pid'] == process.pid, 'Wrong application instance'
        time.sleep(1)  # Let native startup and any asynchronous OS prompt paint.
        capture = subprocess.run(['screencapture', '-x', str(out/'macos-desktop.png')], capture_output=True, timeout=15)
        assert capture.returncode == 0, 'A real macOS desktop capture is required'
        window = subprocess.run(['swift', str(ROOT/'scripts/macos_window_probe.swift'), str(process.pid), str(out/'macos-desktop.png')], stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=90)
        (out/'native-window.json').write_bytes(window.stdout)
        (out/'native-window.log').write_bytes(window.stderr)
        assert window.returncode == 0, 'Native window missing or an unexpected local-network permission prompt remains'
        report['nativeWindow'] = json.loads(window.stdout)
        report['desktopCaptureAvailable'] = capture.returncode == 0
        url = f"http://127.0.0.1:{instance['port']}/"
        names = ['test_studio_guided_tasks_browser.cjs', 'test_studio_feedback_five_browser.cjs']
        if not args.probe:
            names += ['test_project_codec_browser.cjs', 'test_scientific_tiff_browser.cjs',
                      'test_scientific_tiff_derivative_browser.cjs', 'test_history_shortcuts_browser.cjs',
                      'test_studio_drawer_workspace_browser.cjs', 'test_studio_drawer_compact_browser.cjs',
                      'test_studio_discovery_dock_browser.cjs', 'test_studio_text_content_browser.cjs',
                      'test_studio_wb_browser.cjs', 'test_studio_statistics_report_browser.cjs',
                      'test_submission_profiles_browser.cjs', 'test_studio_move_geometry_browser.cjs',
                      'test_studio_core_workbench_browser.cjs']
        for name in names:
            dest = out/Path(name).stem
            result = subprocess.run(['node', str(ROOT/'scripts'/name), url, str(dest)], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
            (out/(name+'.log')).write_bytes(result.stdout)
            report['checks'].append({'script': name, 'exitCode': result.returncode})
            (out/'result.json').write_text(json.dumps(report, indent=2)+'\n')
            assert result.returncode == 0, f'Mac headed editor check failed: {name}'
        if not args.probe:
            for round_number in (1, 2, 3):
                for count in (5000, 10000):
                    name = f'move-{round_number}-{count}'
                    result = subprocess.run(['node', str(ROOT/'scripts/test_studio_move_performance_browser.cjs'), url, str(out/name), 'candidate', str(count)], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
                    (out/(name+'.log')).write_bytes(result.stdout)
                    report['checks'].append({'script': name, 'exitCode': result.returncode})
                    assert result.returncode == 0, 'Mac pointer-up correctness/latency gate failed'
            env['STUDIO_MAC_ENGINE'] = 'webkit'
            for name in ['test_studio_guided_tasks_browser.cjs', 'test_studio_feedback_five_browser.cjs',
                         'test_studio_move_geometry_browser.cjs', 'test_history_shortcuts_browser.cjs']:
                dest = out/('webkit-'+Path(name).stem)
                result = subprocess.run(['node', str(ROOT/'scripts'/name), url, str(dest)], cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=180)
                (out/('webkit-'+name+'.log')).write_bytes(result.stdout)
                report['checks'].append({'script': 'webkit-'+name, 'exitCode': result.returncode})
                assert result.returncode == 0, 'Mac WebKit headed editing failed'
            report['browserEngines'] = ['chromium', 'webkit']
        report['passed'] = True
        return 0
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        (out/'result.json').write_text(json.dumps(report, indent=2)+'\n')
        process.terminate()
        try:
            process.wait(timeout=15)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
        log.close()


if __name__ == '__main__':
    raise SystemExit(main())
