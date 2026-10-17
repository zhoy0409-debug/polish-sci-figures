"""Same-device paired release/current benchmark; synthetic speed, not accuracy.

Run each sample in a fresh worker. Warm samples explicitly prefill the bounded
cache in that worker; report cold separately. Defaults use five repetitions and
the original 60-image/1,770-pair seeds. Baseline is read from the pinned git tag.
"""
from __future__ import annotations
import argparse
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import importlib.util
import hashlib
import json
import os
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT/'scripts'))


def memory():
    if os.name != 'nt':
        return {'unsupported': True}
    class Counters(ctypes.Structure):
        _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD)]+[(k, ctypes.c_size_t) for k in (
            'PeakWorkingSetSize', 'WorkingSetSize', 'QuotaPeakPagedPoolUsage', 'QuotaPagedPoolUsage',
            'QuotaPeakNonPagedPoolUsage', 'QuotaNonPagedPoolUsage', 'PagefileUsage', 'PeakPagefileUsage', 'PrivateUsage')]
    value = Counters()
    value.cb = ctypes.sizeof(value)
    kernel, psapi = ctypes.WinDLL('kernel32'), ctypes.WinDLL('psapi')
    kernel.GetCurrentProcess.restype = wintypes.HANDLE
    psapi.GetProcessMemoryInfo.argtypes = [wintypes.HANDLE, ctypes.POINTER(Counters), wintypes.DWORD]
    if not psapi.GetProcessMemoryInfo(kernel.GetCurrentProcess(), ctypes.byref(value), value.cb):
        raise ctypes.WinError()
    return {'workingSetBytes': value.WorkingSetSize, 'peakWorkingSetBytes': value.PeakWorkingSetSize,
            'privateCommittedBytes': value.PrivateUsage}


def worker(args):
    import test_image_duplicates as fixture
    import cv2
    spec = importlib.util.spec_from_file_location('benchmark_duplicate', args.module)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    records = [fixture.item(str(i), fixture.raster(700+i)) for i in range(args.images)]
    cache = module.ScreeningCache() if hasattr(module, 'ScreeningCache') else None
    if cache is not None and args.mode == 'warm':
        module.scan_images(records, cache=cache)
    initial = memory()
    pair_start, cancelled = threading.Event(), threading.Event()
    clock = {}
    def progress(value):
        clock['progress'] = value
        if value['stage'] == 'pairs':
            pair_start.set()
    def cancel():
        if pair_start.wait(120):
            time.sleep(.010)
            clock['requested'] = time.perf_counter()
            cancelled.set()
    if args.cancel:
        thread = threading.Thread(target=cancel)
        thread.start()
    cpu, start = time.process_time(), time.perf_counter()
    kwargs = {'cache': cache} if cache is not None else {}
    try:
        report = module.scan_images(records, progress=progress, cancelled=cancelled.is_set, **kwargs)
        result = {'pairCount': report['pairCount'], 'matchCount': len(report['matches']), 'status': report['status']}
    except module.ScanCancelled:
        result = {'status': 'cancelled', 'latencyMilliseconds': (time.perf_counter()-clock['requested'])*1000,
                  'lastProgress': clock['progress']}
    elapsed, cpu_seconds = time.perf_counter()-start, time.process_time()-cpu
    if args.cancel:
        thread.join()
    result.update(elapsedSeconds=elapsed, cpuSeconds=cpu_seconds,
                  cpuOneCorePercent=100*cpu_seconds/elapsed,
                  memoryBefore=initial, memoryAfter=memory(),
                  cacheBytes=cache.bytes if cache is not None else 0,
                  encodedBytes=sum(len(r['data']) for r in records), opencv=cv2.__version__)
    print(json.dumps(result))


def main(args):
    args.out.mkdir(parents=True, exist_ok=True)
    baseline = args.out/'baseline_duplicates.py'
    code = subprocess.check_output(['git', 'show', args.baseline+':skills/polish-sci-figures/scripts/studio_duplicates.py'], cwd=ROOT)
    baseline.write_bytes(code)
    current = ROOT/'skills/polish-sci-figures/scripts/studio_duplicates.py'
    results = {}
    for count in args.counts:
        for name, path, mode in [('baseline', baseline, 'cold'), ('currentCold', current, 'cold'), ('currentWarm', current, 'warm')]:
            key = f'{count}/{name}'
            rows = []
            for repetition in range(args.repetitions):
                raw = subprocess.check_output([sys.executable, '-X', 'utf8', __file__, '--worker', '--module', str(path),
                    '--mode', mode, '--images', str(count)], cwd=ROOT)
                rows.append(json.loads(raw))
                print(key, repetition+1, round(rows[-1]['elapsedSeconds'], 3), flush=True)
            times = sorted(r['elapsedSeconds'] for r in rows)
            # Linear percentile interpolation, stated rather than inventing an
            # unseen tail latency from a small number of repetitions.
            rank = .95*(len(times)-1)
            low = int(rank)
            p95 = times[low]+(times[min(low+1,len(times)-1)]-times[low])*(rank-low)
            results[key] = {'runs': rows, 'p50Seconds': statistics.median(times), 'p95Seconds': p95,
                            'maxPeakWorkingSetBytes': max(r['memoryAfter'].get('peakWorkingSetBytes', 0) for r in rows)}
    cancellation = {}
    for name, path, mode in [('baseline', baseline, 'cold'), ('currentCold', current, 'cold'), ('currentWarm', current, 'warm')]:
        raw = subprocess.check_output([sys.executable, '-X', 'utf8', __file__, '--worker', '--module', str(path),
            '--mode', mode, '--images', '60', '--cancel'], cwd=ROOT)
        cancellation[name] = json.loads(raw)
    output = {'schema': 'screening-performance/1', 'date': datetime.now(timezone.utc).isoformat(),
              'baseline': args.baseline, 'currentCommit': subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
              'baselineEngineSha256': hashlib.sha256(baseline.read_bytes()).hexdigest(),
              'currentEngineSha256': hashlib.sha256(current.read_bytes()).hexdigest(),
              'currentWorkingTree': 'includes uncommitted cache implementation',
              'environment': {'os': platform.platform(), 'python': platform.python_version(), 'cpu': platform.processor(),
                              'logicalCpus': os.cpu_count(), 'cleanVm': False, 'lowEndHardware': False,
                              'memory': 'Windows process lifetime peak working set includes warmup; separate private committed bytes',
                              'cpu': 'process CPU seconds / wall time, 100% = one logical core',
                              'percentile': 'linear interpolation across measured runs; five runs do not characterize production tails'},
              'fixture': 'Deterministic synthetic microscopy-like images, seeds 700 onward; speed comparison only',
              'results': results, 'cancellation': cancellation}
    (args.out/'performance.json').write_text(json.dumps(output, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--worker', action='store_true')
    parser.add_argument('--module', type=Path)
    parser.add_argument('--mode', choices=['cold','warm'], default='cold')
    parser.add_argument('--images', type=int, default=60)
    parser.add_argument('--cancel', action='store_true')
    parser.add_argument('--baseline', default='v1.4.19')
    parser.add_argument('--counts', type=int, nargs='+', default=[5,20,60])
    parser.add_argument('--repetitions', type=int, default=5)
    parser.add_argument('--out', type=Path, default=ROOT/'.cache/round2-validation/benchmark')
    args = parser.parse_args()
    worker(args) if args.worker else main(args)
