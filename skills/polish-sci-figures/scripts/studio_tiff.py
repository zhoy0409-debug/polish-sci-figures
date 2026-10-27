"""Bounded, read-only scientific TIFF decoding for the local Studio engine.

Native bytes/samples and display pixels are separate. Unsupported sample types,
orientation, photometry or OME references fail explicitly before display conversion.
"""
from __future__ import annotations

import base64
import binascii
from collections import OrderedDict
import copy
import hashlib
import io
import math
from pathlib import Path
import re
import secrets
import sys
import threading
import time
import warnings
import xml.etree.ElementTree as ET

import numpy as np
from PIL import Image

MAX_BYTES = 64_000_000
MAX_PNG_BYTES = 20_000_000
MAX_PIXELS = 32_000_000
MAX_PAGES = 128
MAX_XML_BYTES = 262_144
DISPLAY_TILE_PIXELS = 1_048_576
SCHEMA = "figure-studio-scientific-image/1"
OME_SPEC = "https://docs.openmicroscopy.org/ome-model/6.2.2/ome-tiff/specification.html"


def _display_image(image, window, gamma, lut):
    # Exactly the shared global display formula, processed in bounded strips.
    # No strip/region has its own normalization, background or contrast range.
    if image.mode in ("RGB", "L") and window == [0, 255] and gamma == 1 and lut == "gray":
        return image.convert("RGB")
    standardizer = Path(__file__).resolve().parents[2] / "standardize-sci-images" / "scripts"
    if str(standardizer) not in sys.path:
        sys.path.insert(0, str(standardizer))
    from standardize_images import apply_display
    output = Image.new("RGB", image.size)
    rows = max(1, min(512, DISPLAY_TILE_PIXELS // image.width))
    for top in range(0, image.height, rows):
        tile = image.crop((0, top, image.width, min(image.height, top + rows)))
        output.paste(apply_display(tile, window[0], window[1], gamma, lut), (0, top))
    return output


def _integer(value, label, minimum=0, maximum=MAX_PIXELS):
    if isinstance(value, bool) or not isinstance(value, (int, str)) or isinstance(value, str) and not re.fullmatch(r"\+?\d+", value):
        raise ValueError(f"{label} must be an integer")
    try:
        number = int(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError(f"Invalid {label}") from exc
    if not minimum <= number <= maximum:
        raise ValueError(f"Invalid {label}")
    return number


def _decode(data):
    if not isinstance(data, str) or len(data) > (MAX_BYTES + 2) // 3 * 4 + 100:
        raise ValueError("TIFF limit: 64 MB; provide local bytes")
    if data.startswith("data:"):
        prefix, separator, data = data.partition(",")
        if not separator or prefix not in ("data:image/tiff;base64", "data:application/octet-stream;base64"):
            raise ValueError("Unsupported TIFF data URL")
    try:
        raw = base64.b64decode(data, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid TIFF base64") from exc
    return _validate_bytes(raw)


def _validate_bytes(raw):
    if not isinstance(raw, bytes) or not 8 <= len(raw) <= MAX_BYTES or raw[:4] not in (b"II*\0", b"MM\0*", b"II+\0", b"MM\0+"):
        raise ValueError("A local TIFF file of at most 64 MB is required")
    return raw


def _sequence(value):
    return tuple(value) if isinstance(value, (tuple, list)) else (value,)


def _page_metadata(image, index):
    width, height = image.size
    if min(width, height) <= 0 or max(width, height) > 32768 or width * height > MAX_PIXELS:
        raise ValueError("TIFF page limit: 32 megapixels and 32768 pixels per edge")
    tags = image.tag_v2
    bits = tuple(int(x) for x in _sequence(tags.get(258, 1)))
    samples = int(tags.get(277, 1))
    formats = tuple(int(x) for x in _sequence(tags.get(339, 1)))
    orientation = int(tags.get(274, 1))
    photometry = int(tags.get(262, -1))
    profile = image.info.get("icc_profile")
    reason = None
    if profile and (not isinstance(profile, bytes) or len(profile) > 1_000_000):
        reason = "Unsupported TIFF ICC profile; the profile is not silently discarded"
    elif tags.get(330):
        reason = "TIFF SubIFDs/pyramids require explicit support; no resolution is chosen automatically"
    elif orientation != 1:
        reason = "TIFF orientation is not top-left; automatic orientation is not assumed"
    elif int(tags.get(284, 1)) != 1:
        reason = "Planar TIFF channels are not supported by this display decoder"
    elif any(value != 1 for value in formats):
        reason = "Only unsigned 8/16-bit integer TIFF samples are supported; signed/float samples are retained but not displayed"
    elif samples == 1 and bits in ((8,), (16,)) and photometry == 1:
        expected = ("L",) if bits == (8,) else ("I;16", "I;16L", "I;16B", "I;16N", "I")
        if image.mode not in expected:
            reason = "TIFF decoder mode does not preserve the declared native samples"
    elif not (samples == 3 and bits in ((8,), (8, 8, 8)) and photometry == 2 and image.mode == "RGB"):
        reason = "Unsupported TIFF photometry/channels; RGB16, palette, alpha and CMYK are not silently reduced to RGB8"
    return {
        "index": index, "width": width, "height": height, "bitsPerSample": list(bits),
        "samplesPerPixel": samples, "sampleFormat": list(formats), "mode": image.mode,
        "orientation": orientation, "photometry": photometry,
        "compression": str(image.info.get("compression", "unknown")),
        "supported": reason is None, "unsupportedReason": reason,
        "iccProfileSha256": hashlib.sha256(profile).hexdigest() if isinstance(profile, bytes) and profile else None,
    }


def _ome_metadata(description, pages):
    if not description or not re.search(r"<(?:[A-Za-z_][\w.-]*:)?OME(?:\s|/?>)", description):
        return None
    if len(description.encode("utf-8")) > MAX_XML_BYTES:
        raise ValueError("OME metadata exceeds the supported 256 KiB limit")
    if "<!DOCTYPE" in description.upper() or "<!ENTITY" in description.upper():
        raise ValueError("OME DTD/entity declarations are not supported")
    try:
        root = ET.fromstring(description)
    except ET.ParseError as exc:
        raise ValueError("Invalid OME XML; no channel/plane mapping was inferred") from exc
    local = lambda node: node.tag.rsplit("}", 1)[-1]
    if local(root) != "OME":
        raise ValueError("Unsupported OME metadata root")
    images = [node for node in root if local(node) == "Image"]
    if len(images) != 1:
        raise ValueError("Multi-series OME requires explicit series support; no series is chosen automatically")
    pixels = [node for node in images[0] if local(node) == "Pixels"]
    if len(pixels) != 1:
        raise ValueError("OME must contain one Pixels description")
    pixels = pixels[0]
    order = pixels.get("DimensionOrder", "")
    if not order.startswith("XY") or len(order) != 5 or set(order[2:]) != set("ZCT"):
        raise ValueError("Unsupported OME dimension order")
    sizes = {axis: _integer(pixels.get("Size" + axis), "OME Size" + axis, 1) for axis in "XYZCT"}
    pixel_type = pixels.get("Type")
    if pixel_type not in ("uint8", "uint16"):
        raise ValueError("OME signed/float pixel types are not silently converted")
    if sizes["C"] > 1 and pixels.get("Interleaved", "false").lower() in ("true", "1"):
        raise ValueError("OME interleaved channel storage requires explicit support")
    significant_bits = pixels.get("SignificantBits")
    if significant_bits is not None:
        significant_bits = _integer(significant_bits, "OME SignificantBits", 1, 16 if pixel_type == "uint16" else 8)
    channels = [node for node in pixels if local(node) == "Channel"]
    if channels and (len(channels) != sizes["C"] or any(node.get("SamplesPerPixel", "1") != "1" for node in channels)):
        raise ValueError("OME interleaved/mismatched channel descriptions are not supported")
    blocks = [node for node in pixels if local(node) == "TiffData"]
    if not blocks:
        raise ValueError("OME has no supported TiffData mapping")
    total = sizes["Z"] * sizes["C"] * sizes["T"]
    mapped, positions = {}, set()
    for block in blocks:
        if set(block.attrib) - {"IFD", "FirstZ", "FirstC", "FirstT", "PlaneCount"}:
            raise ValueError("Unsupported OME TiffData mapping attributes")
        for reference in block:
            if local(reference) != "UUID" or not root.get("UUID") or (reference.text or "").strip() != root.get("UUID"):
                raise ValueError("OME references another/unverified file; external files are never opened")
        first_ifd = _integer(block.get("IFD", "0"), "OME IFD", maximum=MAX_PAGES - 1)
        count = _integer(block.get("PlaneCount", str(1 if "IFD" in block.attrib else len(pages))), "OME PlaneCount", maximum=MAX_PAGES)
        coordinate = {axis: _integer(block.get("First" + axis, "0"), "OME First" + axis, maximum=sizes[axis] - 1) for axis in "ZCT"}
        stride, start = 1, 0
        for axis in order[2:]:
            start += coordinate[axis] * stride
            stride *= sizes[axis]
        if not block.attrib:
            count = min(count, total)  # The specification excludes extraneous IFDs.
        if first_ifd + count > len(pages) or start + count > total:
            raise ValueError("OME plane mapping exceeds available/declared planes")
        for step in range(count):
            index, linear, position = first_ifd + step, start + step, {}
            for axis in order[2:]:
                position[axis], linear = linear % sizes[axis], linear // sizes[axis]
            key = tuple(position[axis] for axis in "ZCT")
            if index in mapped or key in positions:
                raise ValueError("OME contains overlapping plane mappings")
            page = pages[index]
            if (page["width"], page["height"]) != (sizes["X"], sizes["Y"]) or page["samplesPerPixel"] != 1 or page["bitsPerSample"] != [16 if pixel_type == "uint16" else 8]:
                raise ValueError("OME declarations disagree with the native TIFF page")
            mapped[index] = position
            positions.add(key)
    if not mapped:
        raise ValueError("OME does not map any local plane")
    return {
        "dimensionOrder": order, "sizes": sizes, "pixelType": pixel_type, "significantBits": significant_bits,
        "channels": [{"index": i, "name": node.get("Name", "")[:200]} for i, node in enumerate(channels)],
        "physicalSize": {key: pixels.get(key) for key in ("PhysicalSizeX", "PhysicalSizeY", "PhysicalSizeZ", "PhysicalSizeXUnit", "PhysicalSizeYUnit", "PhysicalSizeZUnit") if pixels.get(key) is not None},
        "planePositions": {str(index): value for index, value in mapped.items()},
        "mappedPlanes": len(mapped), "declaredPlanes": total,
        "complete": len(mapped) == total, "xmlSha256": hashlib.sha256(description.encode()).hexdigest(),
        "mappingReference": OME_SPEC,
        "validation": "Supported structural mapping; not full OME schema or acquisition validation",
    }


def _inspect(raw, image):
    pages, description = [], None
    for index in range(MAX_PAGES + 1):
        try:
            image.seek(index)
        except EOFError:
            break
        if index == MAX_PAGES:
            raise ValueError("TIFF page limit: 128")
        pages.append(_page_metadata(image, index))
        if index == 0:
            value = image.tag_v2.get(270, "")
            if not isinstance(value, str):
                raise ValueError("Unsupported TIFF image description encoding")
            description = value
    ome = _ome_metadata(description, pages)
    if ome:
        for page in pages:
            page["omePosition"] = ome["planePositions"].get(str(page["index"]))
            if page["omePosition"] is None:
                page.update(supported=False, unsupportedReason="This IFD is not declared by the OME plane mapping")
    return {"schema": SCHEMA, "fileSha256": hashlib.sha256(raw).hexdigest(), "fileBytes": len(raw),
            "byteOrder": "little" if raw[:2] == b"II" else "big", "pages": pages, "ome": ome,
            "displayOnly": True, "originalRetainedRequired": True, "decodingVerified": False,
            "limitations": ["Display PNG is 8-bit; native TIFF bytes/samples are separate and must be retained.",
                            "Without OME, pages are not assumed to be channels, time points, paired samples or replicates.",
                            "TIFF print resolution is not assumed to be a microscopy calibration."]}


def request(payload, *, source_bytes=None, metadata=None):
    allowed = {"action", "data", "page", "window", "gamma", "lut", "previewEdge"}
    required = {"action"} if source_bytes is not None else {"data", "action"}
    if not isinstance(payload, dict) or set(payload) - allowed or not required <= set(payload) or source_bytes is not None and "data" in payload:
        raise ValueError("TIFF import requires local data and an explicit action; paths/URLs are not accepted")
    action = payload["action"]
    if action not in ("inspect", "suggest", "display"):
        raise ValueError("Unsupported TIFF action")
    raw = _decode(payload["data"]) if source_bytes is None else _validate_bytes(source_bytes)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as image:
                if image.format != "TIFF":
                    raise ValueError("The bytes are not TIFF")
                metadata = _inspect(raw, image) if metadata is None else copy.deepcopy(metadata)
                if metadata["fileBytes"] != len(raw):
                    raise ValueError("Cached TIFF metadata does not match its immutable source")
                if action == "inspect":
                    if set(payload) != required:
                        raise ValueError("TIFF inspection accepts only action and data")
                    return {"metadata": metadata}
                index = _integer(payload.get("page", 0), "TIFF page", maximum=len(metadata["pages"]) - 1)
                page = metadata["pages"][index]
                if not page["supported"]:
                    raise ValueError(page["unsupportedReason"])
                image.seek(index)
                image.load()
                metadata["decodingVerified"] = True
                array = np.asarray(image)
                expected_shape = (page["height"], page["width"]) + ((3,) if page["samplesPerPixel"] == 3 else ())
                if array.shape != expected_shape or array.dtype.kind not in ("u", "i"):
                    raise ValueError("Decoded TIFF shape/type differs from native metadata")
                high = 65535 if page["bitsPerSample"] == [16] else 255
                if int(array.min()) < 0 or int(array.max()) > high:
                    raise ValueError("Decoded TIFF samples exceed their native range")
                native_hash = hashlib.sha256(array.astype("<u2" if high == 65535 else "u1", copy=False).tobytes()).hexdigest()
                native = {"page": index, "size": [page["width"], page["height"]], "bits": page["bitsPerSample"],
                          "samplesSha256": native_hash, "omePosition": page.get("omePosition")}
                if action == "suggest":
                    if set(payload) - {"action", "data", "page"}:
                        raise ValueError("TIFF window suggestion accepts only data and page")
                    lo, hi = int(array.min()), int(array.max())
                    return {"metadata": metadata, "native": native, "suggestedWindow": [lo, hi] if lo < hi else [0, high],
                            "method": "global-native-min-max", "forDisplayOnly": True}
                window = payload.get("window")
                if not isinstance(window, list) or len(window) != 2 or any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in window) or not 0 <= window[0] < window[1] <= high:
                    raise ValueError("Display requires an explicit valid window in native intensity units")
                gamma = payload.get("gamma", 1)
                if isinstance(gamma, bool) or not isinstance(gamma, (int, float)) or not math.isfinite(gamma) or not .1 <= gamma <= 10:
                    raise ValueError("TIFF display gamma must be finite within 0.1–10")
                lut = payload.get("lut", "gray")
                if lut not in ("gray", "green", "magenta", "cyan"):
                    raise ValueError("Unsupported scientific display LUT")
                edge = _integer(payload.get("previewEdge", 0), "TIFF preview edge", maximum=2048)
                if edge and edge < 256:
                    raise ValueError("Preview edge must be 0 (native) or 256–2048")
                displayed = _display_image(image, window, gamma, lut)
                if edge:
                    displayed.thumbnail((edge, edge), Image.Resampling.LANCZOS)
                output = io.BytesIO()
                profile = image.info.get("icc_profile") if page["samplesPerPixel"] == 3 else None
                displayed.save(output, format="PNG", **({"icc_profile": profile} if profile else {}))
                result = output.getvalue()
                if len(result) > MAX_PNG_BYTES:
                    raise ValueError("Display PNG exceeds 20 MB; explicitly choose a smaller display resolution")
                return {"metadata": metadata, "native": native,
                        "display": {"mime": "image/png", "data": base64.b64encode(result).decode(),
                                    "sha256": hashlib.sha256(result).hexdigest(), "size": list(displayed.size),
                                    "window": window, "gamma": gamma, "lut": lut,
                                    "resampled": displayed.size != image.size, "previewEdge": edge,
                                    "iccProfileSha256": hashlib.sha256(profile).hexdigest() if profile else None,
                                    "quantitative": False}}
    except (OSError, SyntaxError, Image.DecompressionBombWarning, Image.DecompressionBombError) as exc:
        raise ValueError("TIFF decoding/compression is unsupported or the file is damaged; no fallback conversion was made") from exc


class TiffSessions:
    """Two bounded, ephemeral local byte sources; no files or database.

    Binary upload avoids repeatedly serializing large originals on the UI thread.
    Closing the chooser releases its source. Lazy expiry is checked on requests;
    the raw-byte budget remains 128 MB even if a tab disappears without cleanup.
    """
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.lock = threading.RLock()
        self.entries = OrderedDict()

    def _expire(self):
        cutoff = self.clock() - 1800
        for key in list(self.entries):
            if self.entries[key]["used"] < cutoff:
                del self.entries[key]

    def upload(self, raw):
        raw = _validate_bytes(raw)
        metadata = request({"action": "inspect"}, source_bytes=raw)["metadata"]
        with self.lock:
            self._expire()
            while len(self.entries) >= 2 or sum(len(entry["raw"]) for entry in self.entries.values()) + len(raw) > 128_000_000:
                self.entries.popitem(last=False)
            key = secrets.token_urlsafe(32)
            self.entries[key] = {"raw": raw, "metadata": metadata, "used": self.clock()}
        return {"sourceId": key, "metadata": copy.deepcopy(metadata)}

    def request(self, payload):
        if not isinstance(payload, dict) or set(payload) - {"sourceId", "action", "page", "window", "gamma", "lut", "previewEdge"}:
            raise ValueError("TIFF sessions accept only a local source ID and display settings")
        key = payload.get("sourceId")
        if not isinstance(key, str) or not re.fullmatch(r"[A-Za-z0-9_-]{40,64}", key):
            raise ValueError("Invalid local TIFF source ID")
        with self.lock:
            self._expire()
            if payload.get("action") == "release":
                if set(payload) != {"sourceId", "action"}:
                    raise ValueError("TIFF release accepts only sourceId and action")
                return {"released": self.entries.pop(key, None) is not None}
            entry = self.entries.get(key)
            if entry is None:
                raise ValueError("TIFF session expired; reimport the local original")
            entry["used"] = self.clock()
            self.entries.move_to_end(key)
            raw, metadata = entry["raw"], entry["metadata"]
        parameters = {name: value for name, value in payload.items() if name != "sourceId"}
        return request(parameters, source_bytes=raw, metadata=metadata)

    def snapshot(self):
        with self.lock:
            self._expire()
            return {"count": len(self.entries), "rawBytes": sum(len(entry["raw"]) for entry in self.entries.values())}
