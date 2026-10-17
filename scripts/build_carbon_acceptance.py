"""Build the separate, local-only Carbon Atelier acceptance evidence ZIP.

Only approved public QA files, three vector sources and two pinned original
videos are eligible. Existing output files are never overwritten. No network.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / ".cache/carbon-release-final/Figure-Studio-v1.4.21-Acceptance.zip"
QA = ROOT / "docs/qa/carbon-atelier"
TEXT_TYPES = {".json", ".md", ".svg"}
SCREENSHOT_TYPES = {".png", ".jpg", ".jpeg"}
VECTORS = ("mascot-maine-coon.svg", "mascot-border-collie.svg", "mascot-scene.svg")
DOCUMENTS = ("docs/carbon-atelier-validation.md", "docs/update-scene-design.md",
             "docs/figure-studio-appearance.md", "LICENSE")
VIDEOS = (
    (".cache/carbon-real-windows-update-rerun-dialog/video/page@994afaa34c272329862525c7e443e061.webm",
     "videos/01-official-0.1.19-to-0.1.20-original.webm",
     "36b4ee42a41e61172535c90b61b175bb54af9f3630264757f909cc7048d6c396"),
    (".cache/carbon-windows-upgrade-final-rerun/video/page@2a363803a10c882c7685dedcad2cc3fd.webm",
     "videos/02-cli-0.1.20-to-0.1.21-original.webm",
     "3205ca46d8cab3ab00c9b330b4097af8595788c7279ac0306c1d04f25e45fd8f"),
)
SENSITIVE = (
    ("absolute Windows path", re.compile(r"(?<![A-Za-z0-9])[A-Za-z]:[\\/]")),
    ("private Unix profile path", re.compile(r"/(?:Users|home)/[^\s\"'<>]+")),
    ("credential field", re.compile(r'''["'](?:token|nonce|authorization|access_token|refresh_token|requestNonce|csrfToken|csrf_token|x-studio-token|studioToken)["']\s*:\s*["'][^"']+["']''', re.I)),
    ("credential value", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-proj-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._~-]{16,})", re.I)),
    ("private study marker", re.compile(r"补骨脂甲素|SWR01297303|樊亚男|自己个人的|周文婷")),
)


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def scan_text(name: str, value: str) -> None:
    for label, pattern in SENSITIVE:
        if pattern.search(value):
            raise ValueError(f"Refusing {name}: {label} detected (value not logged)")


def reject_raw_profiles(value: object) -> None:
    if isinstance(value, dict):
        if {"nodes", "samples", "timeDeltas"} <= value.keys() or "traceEvents" in value:
            raise ValueError("Raw CPU profiles and traces are forbidden")
        for child in value.values():
            reject_raw_profiles(child)
    elif isinstance(value, list):
        for child in value:
            reject_raw_profiles(child)


def read_safe(path: Path, *, image: bool = False) -> bytes:
    if path.is_symlink() or not path.is_file() or not path.resolve().is_relative_to(ROOT):
        raise ValueError("Input is missing, linked, or outside the repository")
    data = path.read_bytes()
    if path.suffix.lower() in TEXT_TYPES or path.name == "LICENSE":
        text = data.decode("utf-8-sig")
        scan_text(path.name, text)
        if path.suffix.lower() == ".json":
            reject_raw_profiles(json.loads(text))
        if path.suffix.lower() == ".svg":
            tree = ET.fromstring(text)
            for node in tree.iter():
                if node.tag.rsplit("}", 1)[-1].lower() in {"image", "script", "foreignobject"}:
                    raise ValueError("Only self-contained vector mascot sources are allowed")
                for key, value in node.attrib.items():
                    if key.rsplit("}", 1)[-1] == "href" and not value.startswith("#"):
                        raise ValueError("External SVG references are forbidden")
    if image:
        from PIL import Image
        with Image.open(path) as picture:
            for key, value in picture.info.items():
                if isinstance(value, str):
                    scan_text(path.name + " metadata " + key, value)
            for key, value in picture.getexif().items():
                if isinstance(value, str):
                    scan_text(path.name + " EXIF " + str(key), value)
        with Image.open(path) as picture:
            picture.verify()
    return data


def collect() -> tuple[dict[str, bytes], list[str]]:
    files, omitted = {}, []
    for path in sorted(QA.rglob("*")):
        if path.is_dir():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if path.suffix.lower() == ".webm":
            if path.name != "baseline-public-workflow.webm":
                raise ValueError("An unapproved video exists in the public QA folder")
            omitted.append(relative)
            continue
        if path.suffix.lower() not in TEXT_TYPES | SCREENSHOT_TYPES:
            raise ValueError("Unexpected file type in the public QA folder")
        if path.suffix.lower() == ".svg":
            raise ValueError("Mascot vectors must come from the explicit source whitelist")
        files[relative] = read_safe(path, image=path.suffix.lower() in SCREENSHOT_TYPES)
    for name in DOCUMENTS:
        files[name] = read_safe(ROOT / name)
    for name in VECTORS:
        files["assets/" + name] = read_safe(ROOT / "skills/polish-sci-figures/assets/figure-studio" / name)
    for source, target, expected in VIDEOS:
        path = ROOT / source
        if path.is_symlink() or not path.is_file():
            raise ValueError("A pinned original video is missing or linked")
        data = path.read_bytes()
        if not data.startswith(bytes.fromhex("1a45dfa3")) or digest(data) != expected:
            raise ValueError("A pinned original video changed; review it before updating the whitelist")
        files[target] = data
    return files, omitted


def readme() -> bytes:
    return """# Figure Studio v1.4.21 独立验收材料

这是 QA 证据包，不是安装程序，也不替代发行批准。优先阅读 docs/carbon-atelier-validation.md；docs/qa/carbon-atelier 中保留初始失败、后续修正、测量条件和未验证范围。MANIFEST.json 列出文件大小及 SHA-256，SHA256SUMS.txt 可逐文件核对。本包只在本机生成，打包脚本没有上传功能。

## 两段原始录像的范围

| 文件 | 实际流程与结果 | 解释边界 |
| --- | --- | --- |
| videos/01-official-0.1.19-to-0.1.20-original.webm | 旧 0.1.19 官方后端与安装环境，使用当时 Carbon 候选展示；真实官方 0.1.20 下载、校验、一次安装。原始 harness 总结果 FAIL，原因是安装后检查的严格 SVG locator；另一次独立 postverify PASS，没有追加下载或安装。 | 这是动画暂停快照问题修复前的候选，并非最终 0.1.21 安装验收。没有证实自动恢复。短暂 verifying / installing 展示未捕获，不能补造为已观察状态。父任务人工抽查原片 0/25/60/85 秒未见私人路径；抽查不等于逐帧隐私证明。 |
| videos/02-cli-0.1.20-to-0.1.21-original.webm | 命令行调用真实安装器，一次 0.1.20→0.1.21 升级；保留同一浏览器上下文和 origin，自动恢复工程、数据/SVG/state 保持及三组主题操作 PASS。 | 这不是应用内下载/校验/安装动画流程；不能拿它补充前一录像缺失的短暂状态。 |

两段均直接复制原始 WebM 字节，没有剪辑、拼接、转码或伪造补帧。每段哈希同时列于 MANIFEST.json 及 SHA256SUMS.txt。

## 数据、画面与资源

科研项目画面只使用公开 UCI Iris（150 行测量，DOI 10.24432/C56C76，CC BY 4.0）、Kilbad 公有领域 H&E 素材及明确标记的构造示例。来源及素材哈希在 QA 报告中。压力图元和重复导入同一图像用于工程回归，不是独立盲测或算法准确率证据。assets/ 中是三角色矢量源；仓库 MIT 许可随包保留。第三段已公开的基线工作流录像不在本包两段视频白名单中，仅保留其报告/哈希；报告内指向该基线录像的链接需在仓库中查看。

完整浏览器缓存、个人图片、个人工程、用户配置目录、CPU 原始 profile/trace、服务 token/nonce 及未脱敏报告均不纳入。PNG/JPG 的文字与二进制画面不能通过文本扫描得到完整隐私保证；本包仅复制已公开审查的 QA 截图，文本及图片文字元数据另经扫描。

性能结果必须按录屏/无录屏、初始候选/优化候选分别阅读。普通工程改善不代表 5000 图元尾部延迟已达目标；通过的功能矩阵也不表示完整页面 AA 或所有设备均已验证。
""".encode("utf-8")


def package(files: dict[str, bytes], omitted: list[str]) -> dict[str, bytes]:
    files["README.md"] = readme()
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    manifest = {"schema": "figure-studio-carbon-acceptance-package/1", "suiteVersion": "1.4.21",
                "studioVersion": "0.1.21", "createdUTC": datetime.now(timezone.utc).isoformat(),
                "sourceHead": head, "snapshotScope": "Exact collected working-tree bytes; head is context, not a claim that every QA file was committed.",
                "network": "No upload or external service calls", "originalUneditedVideos": [{"file": target, "sha256": expected} for _, target, expected in VIDEOS],
                "excludedPublicBaselineVideo": omitted,
                "files": [{"file": name, "bytes": len(data), "sha256": digest(data)} for name, data in sorted(files.items())]}
    files["MANIFEST.json"] = (json.dumps(manifest, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    files["SHA256SUMS.txt"] = "".join(f"{digest(data)}  {name}\n" for name, data in sorted(files.items())).encode("utf-8")
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Scan and validate the snapshot without writing a ZIP")
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(ROOT / ".cache"):
        raise ValueError("QA output must stay inside the repository's ignored .cache folder")
    if output.exists():
        raise FileExistsError("Output already exists; choose a new filename. It will never be overwritten.")
    files, omitted = collect()
    package(files, omitted)
    if args.check:
        print(json.dumps({"status": "SAFE_SNAPSHOT_CHECKED", "files": len(files), "bytes": sum(map(len, files.values())), "videos": len(VIDEOS), "zipWritten": False}))
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryFile(dir=output.parent) as staged:
        with zipfile.ZipFile(staged, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in sorted(files.items()):
                archive.writestr(name, data, compress_type=zipfile.ZIP_STORED if Path(name).suffix.lower() in SCREENSHOT_TYPES | {".webm"} else zipfile.ZIP_DEFLATED)
        staged.seek(0)
        with zipfile.ZipFile(staged) as archive:
            if archive.testzip() is not None or set(archive.namelist()) != set(files):
                raise ValueError("ZIP structural verification failed")
            for name, data in files.items():
                if digest(archive.read(name)) != digest(data):
                    raise ValueError("ZIP entry checksum verification failed")
        staged.seek(0)
        with output.open("xb") as destination:
            while chunk := staged.read(1024 * 1024):
                destination.write(chunk)
    print(json.dumps({"status": "BUILT_AND_VERIFIED", "file": output.name, "files": len(files), "bytes": output.stat().st_size, "sha256": digest(output.read_bytes()), "videos": len(VIDEOS)}))


if __name__ == "__main__":
    main()
