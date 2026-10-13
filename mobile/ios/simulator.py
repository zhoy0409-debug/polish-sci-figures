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
    devices = json.loads(run('xcrun', 'simctl', 'list', 'devicetypes', '-j'))['devicetypes']
    runtimes = json.loads(run('xcrun', 'simctl', 'list', 'runtimes', '-j'))['runtimes']
    runtime = sorted((item for item in runtimes if item.get('isAvailable') and 'iOS' in item['name']), key=lambda item: tuple(int(part) for part in item['version'].split('.')))[-1]
    candidates = [item for item in devices if 'iPhone' in item['name'] and item.get('minRuntimeVersion', 0) <= int(runtime['version'].split('.')[0]) * 65536]
    device = candidates[-1]
    identifier = run('xcrun', 'simctl', 'create', 'Figure Studio isolated CI', device['identifier'], runtime['identifier'])
    (OUT / 'simulator.json').write_text(json.dumps({'id': identifier, 'device': device, 'runtime': runtime}, indent=2))
    with open(os.environ['GITHUB_ENV'], 'a', encoding='utf-8') as handle:
        handle.write('STUDIO_SIMULATOR_ID=' + identifier + '\n')
    run('xcrun', 'simctl', 'boot', identifier)
    run('xcrun', 'simctl', 'bootstatus', identifier, '-b')
    print('Created isolated simulator', identifier, device['name'], runtime['name'])


def collect():
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
    for name in ['simulator-smoke.json', 'simulator-restore.json']:
        source = container / 'Documents' / name
        if source.is_file():
            shutil.copyfile(source, OUT / name)
            reports.append(json.loads(source.read_text()))
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
