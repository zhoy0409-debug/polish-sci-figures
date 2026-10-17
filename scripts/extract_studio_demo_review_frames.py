"""Decode SHA-pinned actual QA recordings to review frames; never edit sources.

Contact-sheet labels are outside each decoded frame. They are review metadata,
not a composited application UI or a claimed continuous recording.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    output = args.out.resolve()
    if not output.is_relative_to(root / ".cache") or output.exists():
        raise ValueError("Use a new owned cache output; never replace review evidence")
    plan = json.loads(args.plan.read_text(encoding="utf-8-sig"))
    output.mkdir(parents=True)
    evidence = {"schema": "figure-studio-real-recording-frame-review/1", "status": "REQUIRES_MANUAL_REVIEW", "clips": [], "scope": "Actual ffmpeg input seeks decoded to PNG, scaled to 960 pixels wide. Raw source unchanged. Contact labels are outside the UI. These selected frames are not a continuous clip, history overlay or scientific-data edit."}
    for clip in plan["clips"]:
        source = (root / clip["source"]).resolve()
        if not source.is_relative_to(root / ".cache") or digest(source) != clip["sourceSha256"]:
            raise ValueError("The exact authorized recording SHA must match")
        clip_dir = output / clip["id"]
        clip_dir.mkdir()
        item = {"id": clip["id"], "source": clip["source"], "sourceSha256": clip["sourceSha256"], "frames": []}
        images = []
        for seconds in clip["seconds"]:
            if not isinstance(seconds, (int, float)) or seconds < 0:
                raise ValueError("Each input seek must be an explicit nonnegative time")
            target = clip_dir / f"frame-{seconds:06.2f}s.png"
            command = [str(args.ffmpeg.resolve()), "-hide_banner", "-loglevel", "error", "-ss", str(seconds), "-i", str(source), "-frames:v", "1", "-vf", "scale=960:-1", str(target)]
            result = subprocess.run(command, capture_output=True, text=True, check=False)
            if result.returncode or not target.exists():
                (clip_dir / "decode-failure.private.txt").write_text(result.stderr, encoding="utf-8")
                raise RuntimeError("Actual decode failed; original evidence retained")
            item["frames"].append({"inputSeekSeconds": seconds, "file": str(target.relative_to(output)).replace("\\", "/"), "sha256": digest(target), "command": command})
            with Image.open(target) as image:
                images.append((seconds, image.copy().convert("RGB")))
        width, height = images[0][1].size
        sheet = Image.new("RGB", (width * 2, (height + 28) * ((len(images) + 1) // 2)), "#dce2e9")
        draw = ImageDraw.Draw(sheet)
        for index, (seconds, image) in enumerate(images):
            x, y = (index % 2) * width, (index // 2) * (height + 28)
            draw.text((x + 8, y + 7), f"Decoded input seek {seconds:.2f} s - {clip['id']}", fill="#152535")
            sheet.paste(image, (x, y + 28))
        sheet_path = clip_dir / "contact-sheet.png"
        sheet.save(sheet_path)
        item["contactSheet"] = {"file": str(sheet_path.relative_to(output)).replace("\\", "/"), "sha256": digest(sheet_path)}
        if digest(source) != clip["sourceSha256"]:
            raise RuntimeError("Source bytes changed during review decode")
        item["originalSourceUnchanged"] = True
        evidence["clips"].append(item)
    (output / "frame-review.private.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    print(json.dumps({"status": evidence["status"], "clips": len(evidence["clips"]), "frames": sum(len(v["frames"]) for v in evidence["clips"])}))


if __name__ == "__main__":
    main()
