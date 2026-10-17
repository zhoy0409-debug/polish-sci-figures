"""Excerpt existing public-fixture recordings without inventing UI or events.

The plan contains repository-relative raw video paths, SHA-256, real clip times
and source runtime hashes. Original recordings are never modified. GIF output
is explicitly a scaled, palette-quantized, frame-rate-converted derivative.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

from PIL import Image, __version__ as pillow_version

ROOT = Path(__file__).resolve().parents[1]


def digest(file):
    return hashlib.sha256(Path(file).read_bytes()).hexdigest()


def build(plan_file, ffmpeg, output):
    plan = json.loads(Path(plan_file).read_text(encoding="utf-8"))
    output = Path(output).resolve()
    if output.exists():
        raise ValueError("Never overwrite earlier demonstration evidence")
    output.mkdir(parents=True)
    report = {"schema": "figure-studio-real-recording-excerpts/1", "status": "BUILDING", "planSha256": digest(plan_file),
              "ffmpegBinarySha256": digest(ffmpeg), "pillowVersion": pillow_version, "clips": [],
              "scope": "Excerpts of existing unedited actual-browser recordings of public inputs. GIFs use scaling, palette quantization and frame-rate conversion. They are presentation derivatives, not source-image/pixel-preservation evidence or continuous performance measurements. No UI or progress states are invented, composited or interpolated. Frame-rate conversion can repeat or drop recorded frames; all displayed content comes from the original video."}
    for clip in plan["clips"]:
        identity = clip["id"]
        if not identity.replace("-", "").isalnum():
            raise ValueError("Simple anonymous clip IDs only")
        source = (ROOT / clip["source"]).resolve()
        if ROOT not in source.parents or digest(source) != clip["sourceSha256"]:
            raise ValueError("Raw video is outside the workspace or does not match the pinned original")
        frames = output / (identity + "-frames")
        frames.mkdir()
        fps, width = int(clip.get("fps", 10)), int(clip.get("width", 1280))
        if fps not in {5, 10} or not 320 <= width <= 1920:
            raise ValueError("Explicit reproducible GIF timing and bounded width required")
        args = [str(ffmpeg), "-hide_banner", "-loglevel", "error", "-ss", str(clip["startSeconds"]), "-i", str(source),
                "-t", str(clip["durationSeconds"]), "-vf", f"scale={width}:-1", "-r", str(fps), "-fps_mode", "cfr", str(frames / "%04d.png")]
        subprocess.run(args, check=True, capture_output=True)
        files = sorted(frames.glob("*.png"))
        if not files:
            raise ValueError("No real frames decoded for " + identity)
        # One palette prevents an unchanged screenshot from being encoded as a
        # full new GIF image solely because independent quantizers chose new
        # colour indices. Sampling is solely a presentation compression step.
        sample = Image.new("RGB", (512, 320 * 3), "white")
        for index, source_index in enumerate([0, len(files) // 2, len(files) - 1]):
            with Image.open(files[source_index]) as image:
                image = image.convert("RGB")
                image.thumbnail((512, 320))
                sample.paste(image, (0, index * 320))
        palette = sample.quantize(colors=256, method=Image.Quantize.FASTOCTREE)
        images = []
        for file in files:
            with Image.open(file) as image:
                images.append(image.convert("RGB").quantize(palette=palette, dither=Image.Dither.NONE))
        target = output / (identity + ".gif")
        images[0].save(target, save_all=True, append_images=images[1:], duration=1000 // fps, loop=0, optimize=True, disposal=1)
        with Image.open(target) as image:
            stored_frames = image.n_frames
            displayed_duration = 0
            for index in range(stored_frames):
                image.seek(index)
                displayed_duration += image.info.get("duration", 0)
        if displayed_duration != len(files) * (1000 // fps):
            raise ValueError("Compressed GIF timing differs from the decoded frame grid")
        entry = {**clip, "file": target.name, "bytes": target.stat().st_size, "sha256": digest(target), "decodedSourceFrames": len(files),
                 "storedGifFrames": stored_frames, "gifDisplayedDurationMs": displayed_duration,
                 "transform": {"width": width, "sampleFps": fps, "gifFrameDurationMs": 1000 // fps, "paletteColors": 256,
                               "palette": "Fixed palette from first/middle/last decoded frame thumbnails; nearest colour without dithering",
                               "unchangedFramesCombinedWithOriginalDuration": True,
                               "croppedPixels": False, "uiOverlaysAdded": False, "frameInterpolation": False},
                 "ffmpegArgumentsTemplate": ["<ffmpeg>", "-hide_banner", "-loglevel", "error", "-ss", str(clip["startSeconds"]),
                                             "-i", clip["source"], "-t", str(clip["durationSeconds"]), "-vf", f"scale={width}:-1",
                                             "-r", str(fps), "-fps_mode", "cfr", "<output>/" + identity + "-frames/%04d.png"]}
        report["clips"].append(entry)
        (output / "demo-manifest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    report["status"] = "REAL_RECORDING_EXCERPTS_GENERATED_REVIEW_REQUIRED"
    (output / "demo-manifest.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--ffmpeg", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(build(args.plan, args.ffmpeg, args.out), indent=2))
