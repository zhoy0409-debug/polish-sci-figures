"""Fetch only the two hash-pinned public live-preview images on --download.

Does not scan projects or private directories, alter pixels, or run detection.
Source credits and reuse terms remain in scripts/fixtures/real-image-sources.json.
"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]


def prepare(destination, download=False):
    sources = json.loads((ROOT / "scripts/fixtures/real-image-sources.json").read_text(encoding="utf-8"))["sources"]
    selected = [source for source in sources if source["id"] in {"he", "tem"}]
    if len(selected) != 2:
        raise ValueError("Exactly the pinned H&E and TEM sources are required")
    destination = Path(destination).resolve()
    destination.mkdir(parents=True, exist_ok=True)
    result = []
    for source in selected:
        target = (destination / source["file"]).resolve()
        if target.parent != destination:
            raise ValueError("The public source must be a direct child of the explicit destination")
        if target.exists():
            payload = target.read_bytes()
        else:
            if not download:
                raise ValueError("A pinned public image is missing; use --download explicitly")
            request = urllib.request.Request(source["url"], headers={"User-Agent": "FigureStudio-public-preview-QA/1"})
            with urllib.request.urlopen(request, timeout=45) as response:
                payload = response.read(12_000_001)
        digest = hashlib.sha256(payload).hexdigest()
        if len(payload) > 12_000_000 or digest != source["sha256"]:
            raise ValueError("Public image size or hash differs from the pinned source: " + source["id"])
        if not target.exists():
            target.write_bytes(payload)
        result.append({"id": source["id"], "file": source["file"], "bytes": len(payload), "sha256": digest})
    return {"status": "PINNED_PUBLIC_IMAGE_BYTES_READY", "downloadExplicitlyEnabled": download, "images": result}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--out", type=Path, default=ROOT / ".cache/round2-validation/public")
    args = parser.parse_args()
    print(json.dumps(prepare(args.out, args.download), indent=2))
