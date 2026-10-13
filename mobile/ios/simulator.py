#!/usr/bin/env python3
"""Create a disposable CI simulator and collect its synthetic smoke evidence."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

HERE = Path(__file__).resolve().parent
OUT = HERE / '.generated'
BUNDLE = 'org.polishscifigures.studio.iospreview'


def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, stdout=subprocess.PIPE, **kwargs).stdout.strip()


def create():
    family = os.environ.get('STUDIO_DEVICE_FAMILY', 'iPhone')
    if family not in {'iPhone', 'iPad'}:
        raise SystemExit('STUDIO_DEVICE_FAMILY must be iPhone or iPad')
    devices = json.loads(run('xcrun', 'simctl', 'list', 'devicetypes', '-j'))['devicetypes']
    runtimes = json.loads(run('xcrun', 'simctl', 'list', 'runtimes', '-j'))['runtimes']
    def version(text):
        return tuple((list(map(int, text.split('.'))) + [0, 0])[:3])
    sdk = version(run('xcrun', '--sdk', 'iphonesimulator', '--show-sdk-version'))
    runtime = sorted((item for item in runtimes if item.get('isAvailable') and 'iOS' in item['name'] and version(item['version']) <= sdk), key=lambda item: version(item['version']))[-1]
    major, minor, patch = version(runtime['version'])
    encoded = major * 65536 + minor * 256 + patch
    candidates = [item for item in devices if item.get('productFamily') == family and item.get('minRuntimeVersion', 0) <= encoded <= item.get('maxRuntimeVersion', 0xffffffff)]
    if not candidates:
        raise SystemExit('No compatible ' + family + ' simulator for the installed Xcode SDK')
    device = sorted(candidates, key=lambda item: (item.get('minRuntimeVersion', 0), item['name']))[-1]
    identifier = run('xcrun', 'simctl', 'create', 'Figure Studio isolated CI', device['identifier'], runtime['identifier'])
    (OUT / 'simulator.json').write_text(json.dumps({'id': identifier, 'device': device, 'runtime': runtime}, indent=2))
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as handle:
        handle.write('STUDIO_SIMULATOR_ID=' + identifier + '\n')
    print('Booting isolated simulator', identifier, device['name'], runtime['name'], flush=True)
    run('xcrun', 'simctl', 'boot', identifier, timeout=60)
    try:
        boot_log = run('xcrun', 'simctl', 'bootstatus', identifier, '-b', timeout=360)
        (OUT / 'simulator-boot.log').write_text(boot_log, encoding='utf-8')
    except subprocess.TimeoutExpired as error:
        output = error.stdout or ''
        if isinstance(output, bytes):
            output = output.decode('utf-8', errors='replace')
        (OUT / 'simulator-boot.log').write_text(output, encoding='utf-8')
        (OUT / 'simulator-boot-error.json').write_text(json.dumps({'id': identifier, 'device': device['name'], 'runtime': runtime['name'], 'error': 'CoreSimulator did not finish booting within 360 seconds'}, indent=2))
        raise SystemExit('CoreSimulator boot timed out after 360 seconds; simulator-boot.log retained')
    print('Created isolated simulator', identifier, device['name'], runtime['name'])


def collect():
    result_bundle = OUT / 'SimulatorTests.xcresult'
    if result_bundle.is_dir():
        try:
            run('xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(result_bundle), '--output-path', str(OUT / 'screenshots'), timeout=60)
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            print('Attachment export unavailable; original xcresult retained')
    metadata = OUT / 'simulator.json'
    if not metadata.exists():
        return
    identifier = json.loads(metadata.read_text())['id']
    try:
        container = Path(run('xcrun', 'simctl', 'get_app_container', identifier, BUNDLE, 'data'))
    except subprocess.CalledProcessError:
        print('Application not installed; retain compiler diagnostics')
        return
    reports = []
    progress = container / 'Documents' / 'simulator-progress.json'
    if progress.is_file():
        shutil.copyfile(progress, OUT / progress.name)
        print('Native progress:', progress.read_text())
    for name in ['simulator-smoke.json', 'simulator-restore.json']:
        source = container / 'Documents' / name
        if source.is_file():
            shutil.copyfile(source, OUT / name)
            reports.append(json.loads(source.read_text()))
            print(name + ':', source.read_text())
    try:
        run('xcrun', 'simctl', 'io', identifier, 'screenshot', str(OUT / 'simulator-final.png'))
    except subprocess.CalledProcessError:
        pass
    if len(reports) != 2 or any(item.get('passed') is not True for item in reports):
        raise SystemExit('Missing or failed native simulator report; inspect collected JSON and xcresult')
    print('Both first-launch and process-restart simulator reports passed')


def cleanup():
    metadata = OUT / 'simulator.json'
    if not metadata.exists():
        return
    identifier = json.loads(metadata.read_text())['id']
    inventory = json.loads(run('xcrun', 'simctl', 'list', 'devices', '-j'))['devices']
    device = next((item for entries in inventory.values() for item in entries if item['udid'] == identifier), None)
    if not device or device.get('name') != 'Figure Studio isolated CI':
        raise SystemExit('Refusing to delete a simulator not named Figure Studio isolated CI')
    subprocess.run(['xcrun', 'simctl', 'shutdown', identifier], check=False)
    subprocess.run(['xcrun', 'simctl', 'delete', identifier], check=False)


if __name__ == '__main__':
    {'create': create, 'collect': collect, 'cleanup': cleanup}[sys.argv[1]]()
