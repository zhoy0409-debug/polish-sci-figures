#!/usr/bin/env python3
"""Regression checks for the private-runtime dependency gate."""

from __future__ import annotations

from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory

from check_source_portability import main


def run_check(path: Path, *, strict: bool = False) -> tuple[int, str]:
    args = [str(path)]
    if strict:
        args.append("--strict")
    output = StringIO()
    with redirect_stdout(output):
        status = main(args)
    return status, output.getvalue()


def main_test() -> None:
    with TemporaryDirectory() as tmp:
        root = Path(tmp)

        project_local = root / "project_local.py"
        project_local.write_text(
            "from pathlib import Path\n"
            "ROOT = Path(__file__).resolve().parent\n"
            "DATA = ROOT / 'data' / 'input.csv'\n",
            encoding="utf-8",
        )
        status, output = run_check(project_local)
        assert status == 0 and "[PASS]" in output and "portable=True" in output

        private_runtime = root / "private_runtime.py"
        private_runtime.write_text(
            "from pathlib import Path\n"
            "HELPER = Path.home() / '.codex' / 'plugins' / 'helper.py'\n",
            encoding="utf-8",
        )
        status, output = run_check(private_runtime)
        assert status == 1
        assert "HOME_PATH_LOOKUP" in output
        assert "SKILL_RUNTIME_PATH" in output
        assert "portable=False" in output

        expanded_home = root / "expanded_home.py"
        expanded_home.write_text(
            "from pathlib import Path\n"
            "CACHE = Path('~/support').expanduser()\n",
            encoding="utf-8",
        )
        status, output = run_check(expanded_home)
        assert status == 1 and "HOME_PATH_LOOKUP" in output

        declared_tool = root / "declared_tool.py"
        declared_tool.write_text(
            "import subprocess as sp\n"
            "from subprocess import run\n"
            "PDFIMAGES = '/usr/local/bin/pdfimages'\n"
            "sp.run([PDFIMAGES, '-v'], check=True)\n"
            "run([PDFIMAGES, '-v'], check=True)\n",
            encoding="utf-8",
        )
        status, output = run_check(declared_tool)
        assert status == 0
        assert "ABSOLUTE_PATH" in output and "EXTERNAL_PROCESS" in output
        assert "portable=True" in output
        strict_status, strict_output = run_check(declared_tool, strict=True)
        assert strict_status == 1 and "portable=False" in strict_output

        windows_home = root / "windows_home.py"
        windows_home.write_text(
            "HELPER = r'C:\\Users\\Example\\private\\helper.py'\n",
            encoding="utf-8",
        )
        status, output = run_check(windows_home)
        assert status == 1 and "ABSOLUTE_PRIVATE_PATH" in output

        aliased_home = root / "aliased_home.py"
        aliased_home.write_text(
            "from os import getenv, environ as env\n"
            "from pathlib import Path as P\n"
            "HOME_A = getenv('HOME')\n"
            "HOME_B = env['USERPROFILE']\n"
            "HOME_C = P.home()\n",
            encoding="utf-8",
        )
        status, output = run_check(aliased_home)
        assert status == 1
        assert "HOME_ENV_LOOKUP" in output and "HOME_PATH_LOOKUP" in output

        private_variants = root / "private_variants.py"
        private_variants.write_text(
            "import os\n"
            "APP = os.getenv('APPDATA')\n"
            "XDG = os.environ['XDG_CONFIG_HOME']\n"
            "POSIX_URI = 'file:///home/alice/helper.py'\n"
            "WIN_URI = 'file:///C:/Users/Alice/helper.py'\n"
            "NAMED_HOME = '~alice/helper.py'\n",
            encoding="utf-8",
        )
        status, output = run_check(private_variants)
        assert status == 1
        assert "HOME_ENV_LOOKUP" in output and "ABSOLUTE_PRIVATE_PATH" in output

        powershell_home = root / "private_runtime.ps1"
        powershell_home.write_text(
            "$helper = $env:USERPROFILE\\private\\helper.py\n",
            encoding="utf-8",
        )
        status, output = run_check(powershell_home)
        assert status == 1 and "ABSOLUTE_PRIVATE_PATH" in output

        dynamic_home = root / "dynamic_home.py"
        dynamic_home.write_text(
            "user = 'Example'\n"
            "POSIX = f'/home/{user}/helper.py'\n"
            "WINDOWS = fr'C:\\Users\\{user}\\helper.py'\n",
            encoding="utf-8",
        )
        status, output = run_check(dynamic_home)
        assert status == 1 and "ABSOLUTE_PRIVATE_PATH" in output

        strict_python = root / "strict_python.py"
        strict_python.write_text(
            "import importlib.util\n"
            "import os\n"
            "import sys\n"
            "sys.path += ['vendor']\n"
            "spec = importlib.util.spec_from_file_location('helper', 'qa/helper.py')\n"
            "stream = os.popen('pdfimages -v')\n",
            encoding="utf-8",
        )
        status, output = run_check(strict_python)
        assert status == 0
        assert "SYS_PATH_MUTATION" in output
        assert "DYNAMIC_FILE_IMPORT" in output
        assert "EXTERNAL_PROCESS" in output
        strict_status, strict_output = run_check(strict_python, strict=True)
        assert strict_status == 1 and "portable=False" in strict_output

        root_home = root / "root_home.py"
        root_home.write_text(
            "HELPER = '/root/private/helper.py'\n",
            encoding="utf-8",
        )
        status, output = run_check(root_home)
        assert status == 1 and "ABSOLUTE_PRIVATE_PATH" in output

        r_home = root / "private_runtime.R"
        r_home.write_text(
            'helper <- path.expand("~")\n'
            'cache <- Sys.getenv("HOME")\n'
            'dynamic <- file.path("/home", user, "helper.R")\n',
            encoding="utf-8",
        )
        status, output = run_check(r_home)
        assert status == 1
        assert "ABSOLUTE_PRIVATE_PATH" in output
        assert "HOME_ENV_LOOKUP" in output

        strict_r = root / "strict_runtime.R"
        strict_r.write_text(
            'source("qa/helper.R")\n'
            'pipe("pdfimages -v")\n'
            'processx::run("pdfimages", "-v")\n',
            encoding="utf-8",
        )
        status, output = run_check(strict_r)
        assert status == 0
        assert "DYNAMIC_FILE_IMPORT" in output and "EXTERNAL_PROCESS" in output
        strict_status, strict_output = run_check(strict_r, strict=True)
        assert strict_status == 1 and "portable=False" in strict_output

        shared_system = root / "shared_system.py"
        shared_system.write_text(
            "MAC_SHARED = '/Users/Shared/resource'\n"
            "WIN_SHARED = r'C:\\Users\\Public\\resource'\n"
            "NETWORK_TOOL = r'\\\\server\\tools\\pdfimages.exe'\n",
            encoding="utf-8",
        )
        status, output = run_check(shared_system)
        assert status == 0 and "ABSOLUTE_PATH" in output and "portable=True" in output, output
        strict_status, strict_output = run_check(shared_system, strict=True)
        assert strict_status == 1 and "portable=False" in strict_output

    print("check_source_portability regression checks passed")


if __name__ == "__main__":
    main_test()
