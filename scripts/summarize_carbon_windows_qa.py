#!/usr/bin/env python3
"""Publish selected Windows QA proofs without local paths, ports or process IDs.

This reads evidence only. It never starts an installer, browser or application,
changes display settings, or adds its reports to the packaged SUPPORT_FILES.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value


def sha(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise ValueError("Invalid evidence SHA-256")
    return value


def theme_checks(rows: list, persistence: str) -> list:
    return [{key: row[key] for key in ("theme", "surround", persistence,
             "tableRowsExact", "originalSVGExact", "stateExact")} for row in rows]


def version_info(value: dict) -> dict:
    return {key: value[key] for key in ("currentVersion", "suiteVersion", "platform")}


def geometry_info(value: dict) -> dict:
    result = {key: value[key] for key in ("devicePixelRatio", "innerWidth", "innerHeight",
              "outerWidth", "outerHeight", "screenX", "screenY")}
    for group, keys in {
        "screen": ("width", "height", "availWidth", "availHeight", "availLeft", "availTop", "colorDepth", "pixelDepth"),
        "document": ("clientWidth", "clientHeight", "scrollWidth", "scrollHeight"),
        "visualViewport": ("width", "height", "scale", "offsetLeft", "offsetTop"),
    }.items():
        result[group] = {key: value[group][key] for key in keys}
    return result


def upgrade_summary(value: dict, proof_sha: str) -> dict:
    if value.get("kind") != "real_cli_windows_upgrade_same_browser_context":
        raise ValueError("Only the explicit real CLI upgrade proof is accepted")
    checks = theme_checks(value["themeChecks"], "persistedOnReload")
    protected = value["protectedBefore"] == value["protectedAfter"]
    registration = (value["registrationBefore"]["appPath"].rstrip("\\/").casefold()
                    == value["registrationAfter"]["appPath"].rstrip("\\/").casefold())
    passed = value.get("passed") is True
    conditions = [value["automaticProjectRestore"], value["scientificSourceUnchanged"],
                  value["settingsPortPreserved"], value["settingsJSONEqual"], protected,
                  registration, value["installer"]["exitCode"] == 0]
    conditions += [row[key] is True for row in checks for key in
                   ("persistedOnReload", "tableRowsExact", "originalSVGExact", "stateExact")]
    if passed and not all(conditions):
        raise ValueError("Passing upgrade proof contradicts its preservation checks")
    return {
        "schema": "figure-studio-carbon-windows-cli-upgrade/1",
        "status": "PASS" if passed else "FAIL", "sourceProofSha256": proof_sha,
        "method": "Actual Windows installer invoked by CLI; same browser context and origin",
        "from": value["from"], "to": value["to"],
        "installerSha256": sha(value["reviewedInstallerSHA256"]),
        "installerAttempts": value["installerAttempts"], "installerRuns": value["installerRuns"],
        "installerExitCode": value["installer"]["exitCode"],
        "before": version_info(value["before"]), "after": version_info(value["after"]),
        "registrationPathPreserved": registration,
        "registeredVersionBefore": value["registrationBefore"]["displayVersion"],
        "registeredVersionAfter": value["registrationAfter"]["displayVersion"],
        "protectedProcessCount": len(value["protectedBefore"]),
        "protectedProcessesUnchanged": protected,
        "autosaveEstablishedBeforeUpgrade": value["autosaveEstablishedBeforeUpgrade"],
        "automaticProjectRestore": value["automaticProjectRestore"],
        "automaticRestoreProof": "Same browser context and origin, reload and actual Save; no post-upgrade Open",
        "scientificSourceUnchanged": value["scientificSourceUnchanged"],
        "scientificTableSha256": sha(value["scientificTableSHA256"]),
        "originalSvgSha256": sha(value["originalSVGSHA256"]),
        "settingsPortPreserved": value["settingsPortPreserved"],
        "settingsJsonEqual": value["settingsJSONEqual"], "themeChecks": checks,
        "limitations": ["This confirms this installer upgrade and retained browser context, not every account or device.",
                        "The CLI path does not demonstrate the in-app download/verification/install presentation."],
    }


def scale_summary(value: dict, percent: int, proof_sha: str) -> dict:
    if (value.get("kind") != "actual_windows_display_scale_headful_chrome"
            or value.get("browserDprEmulation") is not False
            or value.get("operatorDeclaredWindowsScalePercent") != percent):
        raise ValueError("OS scaling requires an explicitly declared actual Windows run, without DPR emulation")
    expected = percent / 100
    if abs(value["expectedDpr"] - expected) > 0.01:
        raise ValueError("Requested scale differs from the recorded expectation")
    checks = theme_checks(value["themeChecks"], "persistsAfterReload")
    initial, final = geometry_info(value["initialGeometry"]), geometry_info(value["finalGeometry"])
    conditions = [abs(geometry["devicePixelRatio"] - expected) < .01 for geometry in (initial, final)]
    conditions += [row[key] is True for row in checks for key in
                   ("persistsAfterReload", "tableRowsExact", "originalSVGExact", "stateExact")]
    conditions += [row["visible"] is True and row["insideViewport"] is True for row in value["controls"]]
    conditions += [not value["errors"], not value["remoteRequests"]]
    passed = value.get("passed") is True
    if passed and not all(conditions):
        raise ValueError("Passing scaling proof contradicts its geometry or functional checks")
    screenshots = []
    for row in value["screenshots"]:
        name = row["file"]
        if Path(name).name != name or "\\" in name:
            raise ValueError("Screenshot reference must be a basename")
        screenshots.append({"file": name, "sha256": sha(row["sha256"]),
                            "geometry": geometry_info(row["geometry"]),
                            "physicalPNG": {key: row["physicalPNG"][key] for key in ("width", "height")}})
    return {
        "schema": "figure-studio-carbon-windows-os-scale/1",
        "status": "PASS" if passed else "FAIL", "sourceProofSha256": proof_sha,
        "generatedUTC": value["generatedUTC"], "browser": value["browser"],
        "operatorDeclaredWindowsScalePercent": percent,
        "browserDprEmulation": False, "osSettingChangedByTestScript": value["osSettingChangedByScript"],
        "viewportConfiguration": value["viewportConfiguration"],
        "windowPolicy": value["browserWindowPolicy"],
        "servedBuild": version_info(value["servedBuild"]), "initialGeometry": initial, "finalGeometry": final,
        "sources": [{key: row[key] for key in ("id", "doi", "license", "inputProjectSHA256")}
                    for row in value["sources"]],
        "themeChecks": checks,
        "updateChecks": [{key: row[key] for key in ("theme", "actualSceneState", "manualMotionOff", "noDownloadOrInstall",
                                                    "summary", "staleCachedResult", "freshCurrentReleaseConfirmed") if key in row}
                         for row in value["updateChecks"]],
        "visibleControlsChecked": len(value["controls"]),
        "allControlsInsideViewport": all(row["visible"] and row["insideViewport"] for row in value["controls"]),
        "autosaveEstablished": value["autosaveEstablished"],
        "scientificTableSha256": sha(value["scientificTableSHA256"]),
        "originalSvgSha256": sha(value["originalSVGSHA256"]),
        "screenshots": screenshots, "remoteRequestCount": len(value["remoteRequests"]),
        "errorCount": len(value["errors"]),
        "limitations": value["limitations"],
    }


def failed_scale_summary(value: dict, percent: int, proof_sha: str) -> dict:
    if (value.get("passed") is not False
            or value.get("kind") != "actual_windows_display_scale_headful_chrome"
            or value.get("operatorDeclaredWindowsScalePercent") != percent
            or value.get("browserDprEmulation") is not False):
        raise ValueError("Expected the explicitly selected failed actual OS-scale proof")
    return {
        "schema": "figure-studio-carbon-windows-os-scale-failure/1",
        "status": "FAIL", "sourceProofSha256": proof_sha,
        "generatedUTC": value["generatedUTC"], "browser": value["browser"],
        "operatorDeclaredWindowsScalePercent": percent, "browserDprEmulation": False,
        "servedBuild": version_info(value["servedBuild"]),
        "failure": value["failure"], "initialGeometry": geometry_info(value["initialGeometry"]),
        "recordedUpdateChecks": len(value["updateChecks"]),
        "finalUpdaterStateRecorded": bool(value["updateChecks"]),
        "screenshotsCaptured": len(value["screenshots"]),
        "limitations": [
            "The initial harness waited only for scene=current and timed out after 60 seconds.",
            "It did not record the final updater state; the timeout alone cannot establish an offline condition.",
            "A later passing run is separate evidence and does not overwrite this failure.",
        ],
    }


def safe_write(path: Path, value: dict) -> None:
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if re.search(r"[A-Za-z]:[\\/]|\\\\\\\\|localhost|127\.0\.0\.1|[\"'](?:pid|processId|protectedPids)[\"']\s*:", text):
        raise ValueError("Public report unexpectedly contains a local identity")
    path.write_text(text, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upgrade", required=True, type=Path)
    parser.add_argument("--portable", required=True, type=Path, help="Existing path-free portable summary")
    parser.add_argument("--scale", action="append", nargs=2, metavar=("PERCENT", "PROOF"), default=[])
    parser.add_argument("--failed-scale", action="append", nargs=2, metavar=("PERCENT", "PROOF"), default=[],
                        help="Preserve the earlier current-only wait timeout as a separate failed proof")
    parser.add_argument("--outdir", required=True, type=Path)
    args = parser.parse_args()
    from build_release import SUPPORT_FILES
    args.outdir.mkdir(parents=True, exist_ok=True)
    portable = read(args.portable)
    if portable.get("status") != "PASS" or portable["updateEligibility"]["localUpdateInfo"]["inAppInstall"] is not False:
        raise ValueError("Portable proof has not confirmed its expected installation eligibility")
    upgrade = upgrade_summary(read(args.upgrade), digest(args.upgrade))
    reports = {"windows-cli-upgrade-verification.json": upgrade}
    scales = {}
    for percent_text, proof_name in args.scale:
        percent, proof = int(percent_text), Path(proof_name)
        if percent not in (100, 125, 150) or percent in scales:
            raise ValueError("Provide each supported scale at most once")
        filename = f"windows-os-scale-{percent}-verification.json"
        reports[filename] = scale_summary(read(proof), percent, digest(proof))
        scales[percent] = {"status": reports[filename]["status"], "report": filename}
    failures = []
    for percent_text, proof_name in args.failed_scale:
        percent, proof = int(percent_text), Path(proof_name)
        if percent not in (100, 125, 150):
            raise ValueError("Unsupported failed scale")
        filename = f"windows-os-scale-{percent}-initial-failure.json"
        if filename in reports:
            raise ValueError("Provide each failed scale at most once")
        reports[filename] = failed_scale_summary(read(proof), percent, digest(proof))
        failures.append({"scalePercent": percent, "status": "FAIL", "report": filename})
    index = {"schema": "figure-studio-carbon-windows-acceptance-index/1",
             "generatedUTC": datetime.now(timezone.utc).isoformat(),
             "scope": "Only explicitly supplied completed Windows proofs; release approval is separate",
             "portable": {"status": portable["status"], "report": args.portable.name,
                          "reportSha256": digest(args.portable)},
             "cliUpgrade": {"status": upgrade["status"], "report": "windows-cli-upgrade-verification.json"},
             "actualOsScales": {str(percent): scales.get(percent, {"status": "NOT_PROVIDED"})
                                for percent in (100, 125, 150)},
             "preservedInitialFailures": failures,
             "packaging": "Post-build evidence; do not embed final-archive hash reports in SUPPORT_FILES"}
    reports["windows-acceptance-index.json"] = index
    root = Path(__file__).resolve().parents[1]
    for filename in reports:
        target = (args.outdir / filename).resolve()
        if target.is_relative_to(root) and target.relative_to(root).as_posix() in SUPPORT_FILES:
            raise ValueError("Artifact-hash evidence must not be embedded in its own package")
    for filename, report in reports.items():
        safe_write(args.outdir / filename, report)
    print(json.dumps({"written": list(reports), "providedOsScales": sorted(scales)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
