"""Check the benchmark's scoped limits and process-tree cleanup, without HTTP."""
from __future__ import annotations
import ctypes as C
from ctypes import wintypes as W
import os
from pathlib import Path
import sys
import time
import unittest
from benchmark_resources_windows import WindowsJob


@unittest.skipUnless(os.name == 'nt', 'Windows Job Objects are required')
class JobTests(unittest.TestCase):
    def test_affinity_child_membership_and_cleanup(self):
        job = WindowsJob(2, 2048)
        handles = []
        try:
            child = "import time; time.sleep(60)"
            command = "import subprocess,sys,time;subprocess.Popen([sys.executable,'-c'," + repr(child) + "]);time.sleep(60)"
            job.start([sys.executable, '-c', command], Path(__file__).resolve().parent)
            deadline = time.monotonic() + 8
            while len(job.pids()) < 2 and time.monotonic() < deadline:
                time.sleep(.05)
            self.assertEqual(len(job.pids()), 2, 'Only the created process and its child belong to the job')
            for pid in job.pids():
                handle = job.k.OpenProcess(0x1000, False, pid)
                self.assertTrue(handle)
                handles.append(handle)
                mask, system = C.c_size_t(), C.c_size_t()
                self.assertTrue(job.k.GetProcessAffinityMask(handle, C.byref(mask), C.byref(system)))
                self.assertEqual(mask.value, sum(1 << cpu for cpu in job.cpu_ids))
            self.assertGreater(job.snapshot()['working_set_mib'], 0)
            job.close()
            for handle in handles:
                code = W.DWORD()
                self.assertTrue(job.k.GetExitCodeProcess(handle, C.byref(code)))
                self.assertNotEqual(code.value, 259, 'Closing the job must end its test child as well')
        finally:
            job.close()
            for handle in handles:
                job.k.CloseHandle(handle)


if __name__ == '__main__':
    unittest.main()
