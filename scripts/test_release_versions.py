"""Catch mismatched suite, installer and executable versions before packaging."""
from __future__ import annotations

import ast
from pathlib import Path
import re
import sys
import tempfile
from unittest.mock import patch

from build_release import ROOT, VERSION
from build_portable_skill import VERSION as PORTABLE_VERSION

sys.path.insert(0, str(ROOT / "desktop"))
import build_windows


def constants(path: Path) -> dict:
    values = {}
    for node in ast.parse(path.read_text(encoding="utf-8")).body:
        if isinstance(node, ast.Assign):
            try:
                value = ast.literal_eval(node.value)
            except (TypeError, ValueError):
                continue
            for target in node.targets:
                if isinstance(target, ast.Name):
                    values[target.id] = value
    return values


def main():
    windows = constants(ROOT / "desktop/build_windows.py")
    macos = constants(ROOT / "desktop/build_macos.py")
    assert PORTABLE_VERSION == VERSION == windows["SUITE_VERSION"] == macos["SUITE_VERSION"]
    app_version = windows["VERSION"]
    assert app_version == macos["VERSION"]
    citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    assert re.search(r'^version: "([^"]+)"$', citation, re.M).group(1) == VERSION.removeprefix("v")
    installer = (ROOT / "desktop/FigureStudio.iss").read_text(encoding="utf-8")
    assert re.search(r'#define AppVersion "([^"]+)"', installer).group(1) == app_version
    verifier = (ROOT / "desktop/verify_windows.ps1").read_text(encoding="utf-8")
    assert re.search(r"\$Version = '([^']+)'", verifier).group(1) == app_version

    # The PE resource is generated, not checked in. Exercise its real generator
    # in a private temporary directory so this check works on a clean checkout.
    cache = ROOT / ".cache/release-version-test"
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=cache) as temporary:
        generated = Path(temporary)
        (generated / "desktop").mkdir()
        with patch.object(build_windows, "ROOT", generated):
            build_windows.branding()
        resource = ast.parse((generated / "desktop/resources/version-info.txt").read_text(encoding="utf-8"))
    numeric = tuple(map(int, app_version.split("."))) + (0,)
    version_fields = {}
    for node in ast.walk(resource):
        if isinstance(node, ast.keyword) and node.arg in {"filevers", "prodvers"}:
            version_fields[node.arg] = ast.literal_eval(node.value)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "StringStruct":
            key, value = map(ast.literal_eval, node.args)
            if key in {"FileVersion", "ProductVersion"}:
                version_fields[key] = value
    assert version_fields == {"filevers": numeric, "prodvers": numeric,
                              "FileVersion": app_version, "ProductVersion": app_version}
    # The local image engine needs OpenCV in both the frozen dependency set and
    # the runtime archive; a source-only import test does not verify this boundary.
    assert "opencv-python-headless" in windows["PACKAGES"]
    assert re.search(r"^opencv-python-headless==4\.11\.0\.86$",
                     (ROOT / "desktop/requirements-build.txt").read_text(encoding="utf-8"), re.M)
    assert "'cv2'" in (ROOT / "desktop/FigureStudio.spec").read_text(encoding="utf-8")
    print(f"Release versions and Windows dependency boundary passed: suite {VERSION}, Studio {app_version}")


if __name__ == "__main__":
    main()
