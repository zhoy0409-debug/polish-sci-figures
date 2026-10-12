"""Benchmark an isolated Windows EXE under process-scoped resource limits.

Standard library only. A 2-CPU/2-GiB job is not a physical low-end computer.
New application directories give first-run measurements; OS disk cache is not
flushed. Only the benchmark job is hidden/terminated, never existing services.
"""
from __future__ import annotations

import argparse
import copy
import ctypes as C
from ctypes import wintypes as W
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
import time
import zipfile

from test_packaged_catalogue import CASES, LocalClient, verify_panel, table_sha256


class IO(C.Structure):
    _fields_ = [(n, C.c_ulonglong) for n in
                ('read_ops', 'write_ops', 'other_ops', 'read_bytes', 'write_bytes', 'other_bytes')]


class BasicLimits(C.Structure):
    _fields_ = [('process_time', C.c_longlong), ('job_time', C.c_longlong),
                ('flags', W.DWORD), ('min_working_set', C.c_size_t),
                ('max_working_set', C.c_size_t), ('active_limit', W.DWORD),
                ('affinity', C.c_size_t), ('priority', W.DWORD), ('scheduling', W.DWORD)]


class Limits(C.Structure):
    _fields_ = [('basic', BasicLimits), ('io', IO),
                ('process_memory', C.c_size_t), ('job_memory', C.c_size_t),
                ('peak_process_memory', C.c_size_t), ('peak_job_memory', C.c_size_t)]


class Startup(C.Structure):
    _fields_ = [('cb', W.DWORD), ('reserved', W.LPWSTR), ('desktop', W.LPWSTR),
                ('title', W.LPWSTR), ('x', W.DWORD), ('y', W.DWORD),
                ('xsize', W.DWORD), ('ysize', W.DWORD), ('xcount', W.DWORD),
                ('ycount', W.DWORD), ('fill', W.DWORD), ('flags', W.DWORD),
                ('show', W.WORD), ('reserved2size', W.WORD), ('reserved2', C.c_void_p),
                ('stdin', W.HANDLE), ('stdout', W.HANDLE), ('stderr', W.HANDLE)]


class Process(C.Structure):
    _fields_ = [('process', W.HANDLE), ('thread', W.HANDLE),
                ('pid', W.DWORD), ('tid', W.DWORD)]


class Memory(C.Structure):
    _fields_ = [('cb', W.DWORD), ('faults', W.DWORD)] + [
        (n, C.c_size_t) for n in ('peak_ws', 'ws', 'peak_pool_paged', 'pool_paged',
                                 'peak_pool_nonpaged', 'pool_nonpaged', 'pagefile',
                                 'peak_pagefile', 'private')]


class HostMemory(C.Structure):
    _fields_ = [('length', W.DWORD), ('load', W.DWORD)] + [
        (n, C.c_ulonglong) for n in ('total', 'available', 'total_page', 'available_page',
                                   'total_virtual', 'available_virtual', 'extended')]


class WindowsJob:
    def __init__(self, cpus=0, memory_mib=0):
        self.k = C.WinDLL('kernel32', use_last_error=True)
        self.ps = C.WinDLL('psapi', use_last_error=True)
        signatures = {
            'CreateJobObjectW': ([C.c_void_p, W.LPCWSTR], W.HANDLE),
            'SetInformationJobObject': ([W.HANDLE, C.c_int, C.c_void_p, W.DWORD], W.BOOL),
            'QueryInformationJobObject': ([W.HANDLE, C.c_int, C.c_void_p, W.DWORD, C.c_void_p], W.BOOL),
            'AssignProcessToJobObject': ([W.HANDLE, W.HANDLE], W.BOOL),
            'TerminateJobObject': ([W.HANDLE, W.UINT], W.BOOL),
            'CloseHandle': ([W.HANDLE], W.BOOL),
            'GetCurrentProcess': ([], W.HANDLE),
            'GetProcessAffinityMask': ([W.HANDLE, C.c_void_p, C.c_void_p], W.BOOL),
            'OpenProcess': ([W.DWORD, W.BOOL, W.DWORD], W.HANDLE),
            'CreateProcessW': ([W.LPCWSTR, W.LPWSTR, C.c_void_p, C.c_void_p, W.BOOL,
                               W.DWORD, C.c_void_p, W.LPCWSTR, C.POINTER(Startup), C.POINTER(Process)], W.BOOL),
            'ResumeThread': ([W.HANDLE], W.DWORD),
            'TerminateProcess': ([W.HANDLE, W.UINT], W.BOOL),
            'GetExitCodeProcess': ([W.HANDLE, C.c_void_p], W.BOOL),
            'WaitForSingleObject': ([W.HANDLE, W.DWORD], W.DWORD),
        }
        for name, (args, result) in signatures.items():
            method = getattr(self.k, name); method.argtypes = args; method.restype = result
        self.ps.GetProcessMemoryInfo.argtypes = [W.HANDLE, C.POINTER(Memory), W.DWORD]
        self.ps.GetProcessMemoryInfo.restype = W.BOOL
        current, system = C.c_size_t(), C.c_size_t()
        self.check(self.k.GetProcessAffinityMask(self.k.GetCurrentProcess(), C.byref(current), C.byref(system)))
        allowed = [i for i in range(C.sizeof(C.c_size_t)*8) if current.value & (1 << i)]
        self.cpu_ids = allowed[:cpus] if cpus else allowed
        if cpus and len(self.cpu_ids) != cpus:
            raise RuntimeError('The host does not expose the requested number of CPUs.')
        self.job = self.k.CreateJobObjectW(None, None)
        self.check(self.job)
        limit = Limits(); limit.basic.flags = 0x2000  # KILL_ON_JOB_CLOSE
        if cpus:
            limit.basic.flags |= 0x10  # AFFINITY
            limit.basic.affinity = sum(1 << i for i in self.cpu_ids)
        if memory_mib:
            limit.basic.flags |= 0x200  # aggregate committed job memory limit
            limit.job_memory = memory_mib * 1024 * 1024
        self.check(self.k.SetInformationJobObject(self.job, 9, C.byref(limit), C.sizeof(limit)))
        actual = Limits()
        self.check(self.k.QueryInformationJobObject(self.job, 9, C.byref(actual), C.sizeof(actual), None))
        if cpus:
            assert actual.basic.affinity == limit.basic.affinity
        if memory_mib:
            assert actual.job_memory == limit.job_memory
        self.process = None

    @staticmethod
    def check(ok):
        if not ok:
            raise C.WinError(C.get_last_error())

    def start(self, command, cwd, environment=None):
        startup = Startup(); startup.cb = C.sizeof(startup)
        startup.flags = 1; startup.show = 0  # STARTF_USESHOWWINDOW, SW_HIDE
        process = Process()
        env = C.create_unicode_buffer('\0'.join(k+'='+v for k,v in sorted(environment.items()))+'\0\0') if environment else None
        self.check(self.k.CreateProcessW(str(command[0]),
                   C.create_unicode_buffer(subprocess.list2cmdline(list(map(str, command)))),
                   None, None, False, 0x4 | (0x400 if env is not None else 0),
                   env, str(cwd), C.byref(startup), C.byref(process)))
        self.process = process
        try:
            self.check(self.k.AssignProcessToJobObject(self.job, process.process))
            if self.k.ResumeThread(process.thread) == 0xffffffff:
                raise C.WinError(C.get_last_error())
        except BaseException:
            self.k.TerminateProcess(process.process, 1)
            raise
        finally:
            self.k.CloseHandle(process.thread)
        return process.pid

    def pids(self):
        storage = C.create_string_buffer(8 + 256*C.sizeof(C.c_size_t))
        self.check(self.k.QueryInformationJobObject(self.job, 3, storage, len(storage), None))
        count = W.DWORD.from_buffer(storage, 4).value
        return list((C.c_size_t*count).from_buffer(storage, 8))

    def snapshot(self):
        limit = Limits()
        self.check(self.k.QueryInformationJobObject(self.job, 9, C.byref(limit), C.sizeof(limit), None))
        working = private = 0
        for pid in self.pids():
            handle = self.k.OpenProcess(0x410, False, pid)
            if not handle:
                continue
            try:
                memory = Memory(); memory.cb = C.sizeof(memory)
                if self.ps.GetProcessMemoryInfo(handle, C.byref(memory), memory.cb):
                    working += memory.ws; private += memory.private
            finally:
                self.k.CloseHandle(handle)
        return {'working_set_mib': working/2**20, 'private_mib': private/2**20,
                'job_peak_commit_mib': limit.peak_job_memory/2**20}

    def alive(self):
        code = W.DWORD()
        return self.process and self.k.GetExitCodeProcess(self.process.process, C.byref(code)) and code.value == 259

    def close(self):
        if self.job:
            self.k.TerminateJobObject(self.job, 0)
            self.k.CloseHandle(self.job); self.job = None
        if self.process:
            self.k.WaitForSingleObject(self.process.process, 5000)
            self.k.CloseHandle(self.process.process); self.process = None


def host_info():
    import winreg
    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'HARDWARE\DESCRIPTION\System\CentralProcessor\0') as key:
        cpu = winreg.QueryValueEx(key, 'ProcessorNameString')[0]
    memory = HostMemory(); memory.length = C.sizeof(memory)
    C.windll.kernel32.GlobalMemoryStatusEx(C.byref(memory))
    return {'cpu': cpu.strip(), 'logical_cpus': os.cpu_count(),
            'physical_memory_gib': memory.total/2**30, 'available_memory_gib': memory.available/2**30}


def edited_starter(key, starter):
    result = copy.deepcopy(starter)
    header, rows = result['rows'][0], result['rows'][1:]
    def add(column, value=.375, row=0):
        index = header.index(column); rows[row][index] = str(float(rows[row][index])+value)
    if key == 'upset_intersections':
        result['rows'].append(['Benchmark-new-unit', rows[0][header.index('set')]])
    elif key == 'roc_pointwise_band':
        index = next(i for i, row in enumerate(rows) if row[header.index('outcome')] == '1')
        rows[index][header.index('score')] = '-1'
    elif key == 'roc_smooth':
        for row in rows:
            index = header.index('y'); row[index] = str(float(row[index])**1.08)
    elif key == 'time_stl_components':
        add('observed'); add('remainder')
    elif key in {'meta_forest', 'mediation_paths_result'}:
        for column in ['estimate', 'lower', 'upper']: add(column, .03)
    elif key == 'genome_manhattan':
        index = header.index('p'); rows[0][index] = str(float(rows[0][index])*.5)
    else:
        column = {'pca_loadings':'x','volcano_labels':'log2fc','dose_response_result':'response',
                  'survival_risk_counts':'time','gsea_tracks':'running_score',
                  'model_shap_summary':'shap_value','synergy_surface_result':'score'}.get(key, 'value')
        add(column)
    return result


def measured(job, action):
    samples, stop = [], threading.Event()
    def monitor():
        while not stop.is_set():
            try: samples.append(job.snapshot())
            except OSError: pass
            stop.wait(.05)
    worker = threading.Thread(target=monitor, daemon=True); worker.start()
    began = time.perf_counter()
    try: result = action()
    finally:
        duration = time.perf_counter()-began; stop.set(); worker.join()
    samples.append(job.snapshot())
    return result, {'seconds':round(duration, 4), **{name:round(max(x[name] for x in samples), 2) for name in samples[0]}}


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')


def run_mode(command, outdir, limited, keys, math_threads=None, port=None):
    outdir.mkdir(parents=True)
    data_dir = outdir/'app-data'
    if port is not None:
        data_dir.mkdir()
        save(data_dir/'settings.json', {'port': port})
    job = WindowsJob(2 if limited else 0, 2048 if limited else 0)
    report = {'kind':'2-CPU 2-GiB job' if limited else 'unrestricted job',
              'cpu_ids':job.cpu_ids,'memory_limit_mib':2048 if limited else None,
              'math_threads_override':math_threads,'port_requested':port,
              'inherited_numeric_threads':{name:os.environ.get(name) for name in
                  ['OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','OMP_NUM_THREADS','NUMEXPR_NUM_THREADS']},
              'passed':False,'cases':[]}
    report_path = outdir/'report.json'
    try:
        def startup():
            environment = dict(os.environ)
            if math_threads:
                environment.update({name:str(math_threads) for name in
                                    ['OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','OMP_NUM_THREADS','NUMEXPR_NUM_THREADS']})
            job.start([*command, '--no-open', '--data-dir', str(data_dir)], outdir, environment)
            deadline = time.monotonic()+120
            record_path = data_dir/'instance.json'
            while time.monotonic()<deadline:
                if not job.alive(): raise RuntimeError('Benchmark executable exited before service ready.')
                try:
                    record=json.loads(record_path.read_text(encoding='utf-8'))
                    report['service_port']=record['port']
                    client=LocalClient(f"http://127.0.0.1:{record['port']}/",timeout=5)
                    starters=client.catalogue()
                    client.timeout=300
                    return client, starters
                except PermissionError:
                    raise
                except (OSError, ValueError, RuntimeError):
                    time.sleep(.05)
            raise TimeoutError('Isolated startup exceeded 120 seconds.')
        (client, starters), report['startup'] = measured(job, startup)
        report['starter_count'] = len(starters)
        save(report_path, report)
        for key, module, purpose in CASES:
            if keys and key not in keys: continue
            entry={'key':key,'module':module,'passed':False}
            try:
                starter=copy.deepcopy(starters[key])
                response, entry['render']=measured(job,lambda:client.render(starter))
                original,_=verify_panel(key,starter,response['panel'])
                entry['input_sha256']=original['input_sha256']
                entry['artwork_sha256']=original['artwork_sha256']
                edited=edited_starter(key,starter)
                changed,entry['replace_data']=measured(job,lambda:client.render(edited))
                revised,_=verify_panel(key,edited,changed['panel'])
                entry['edited_input_sha256']=revised['input_sha256']
                entry['edited_artwork_sha256']=revised['artwork_sha256']
                assert original['input_sha256'] != revised['input_sha256']
                assert original['artwork_sha256'] != revised['artwork_sha256'], 'Edited data must change graphics'
                recipe=copy.deepcopy(changed['panel']['recipe'])
                if recipe.get('family') in {'roc','roc_results'}:recipe['studio_view']=key
                payload={'recipe':recipe,'rows':edited['rows'],'width':480,'height':320}
                def resize():
                    try:return json.loads(client.request('/api/reflow',payload))
                    except RuntimeError as error:
                        if str(error) in {
                            'HTTP 422 at /api/reflow: This figure family does not support precise reflow',
                            'HTTP 422 at /api/reflow: This gallery view has no reviewed reflow layout'}:
                            return {'unsupported':str(error)}
                        raise
                resized,entry['reflow']=measured(job,resize)
                if 'unsupported' in resized:
                    entry['reflow'].update(supported=False,reason=resized['unsupported'])
                    entry['reflow']['preset_dimensions'] = sorted({
                        (v['width'],v['height']) for v in changed['panel']['variants'] if v.get('name')==key})
                else:
                    variant=resized['variant']
                    assert abs(variant['width']-480)<1e-4 and abs(variant['height']-320)<1e-4
                    assert '<svg' in variant['svg']
                    entry['reflow']['supported']=True
                assert changed['panel']['table']['sha256']==table_sha256(edited['rows'])
                entry['variants']=original['variant_count'];entry['passed']=True
            except Exception as error:
                entry['error']=type(error).__name__+': '+str(error)
            report['cases'].append(entry);save(report_path,report)
            print(('PASS' if entry['passed'] else 'FAIL'),report['kind'],key,
                  {name:entry[name]['seconds'] for name in ['render','replace_data','reflow'] if name in entry},
                  entry.get('error',''),flush=True)
        starter=starters['compare_raincloud']
        config={'mode':'raw','group':'group','value':'value','unit':'unit',
                'design':'independent','method':'welch','family':'all_pairs',
                'design_confirmed':True,'unit_role':'independent_experimental_unit'}
        report['analysis']=json.loads(client.request('/api/analyze',
                                      {**starter,'config':config}))
        report['passed']=all(case['passed'] for case in report['cases'])
    except Exception as error:report['error']=type(error).__name__+': '+str(error)
    finally:
        try:
            report['memory_final']=job.snapshot() if job.alive() else None
        finally:
            job.close()
        save(report_path,report)
    return report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive',type=Path,help='Immutable released Portable ZIP baseline')
    parser.add_argument('--source',action='store_true',help='Compare current source using this Python runtime')
    parser.add_argument('--outdir',type=Path,required=True,help='New benchmark directory')
    parser.add_argument('--mode',choices=['both','baseline','limited'],default='both')
    parser.add_argument('--cases',nargs='*',choices=[case[0] for case in CASES])
    parser.add_argument('--math-threads',type=int,choices=[1,2],help='Process-only experimental numeric-library thread cap')
    parser.add_argument('--port',type=int,help='Dedicated localhost port; uses only the new benchmark app settings')
    args=parser.parse_args()
    if args.port is not None and not 1024<=args.port<=65535:parser.error('--port must be between 1024 and 65535.')
    if os.name!='nt':parser.error('Windows is required for Job Object resource limits.')
    if bool(args.archive)==args.source:parser.error('Choose either --archive or --source.')
    output=args.outdir.resolve()
    if output.exists():parser.error('--outdir must be new to preserve first-run isolation and prior results.')
    output.mkdir(parents=True)
    info={'scope':'New process and new app data; OS file cache retained; no browser UI performance claim',
          'host':host_info(),'runs':[]}
    if args.archive:
        archive=args.archive.resolve()
        info['archive_sha256']=hashlib.sha256(archive.read_bytes()).hexdigest()
        extract=output/'released-app';extract.mkdir()
        with zipfile.ZipFile(archive) as handle:
            for name in handle.namelist():
                if not (extract/name).resolve().is_relative_to(extract):raise ValueError('Unsafe archive path')
            handle.extractall(extract)
        executable=extract/'Figure Studio/Figure Studio.exe'
        info['exe_sha256']=hashlib.sha256(executable.read_bytes()).hexdigest()
        command=[executable]
    else:
        command=[Path(sys.executable),Path(__file__).resolve().parent/'figure_studio_app.py']
        info['python']=sys.version
    for mode in (['baseline','limited'] if args.mode=='both' else [args.mode]):
        info['runs'].append(run_mode(command,output/mode,mode=='limited',args.cases,args.math_threads,args.port))
        save(output/'summary.json',info)
    return 0 if all(run['passed'] for run in info['runs']) else 1


if __name__=='__main__':
    raise SystemExit(main())
