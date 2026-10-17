"""Local, bounded image-reuse screening with reviewable geometric evidence.

Inputs are embedded raster images, never paths or URLs. Exact matches use decoded
pixels without discarding high bit depth. Other candidates require distinctive SIFT correspondences, a robust
similarity transform and agreement of image content inside the supported region.
The detector screens pairs, not duplicated regions within one image. A match is
a review prompt, not a conclusion about whether image reuse is appropriate.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import io
import math
import re
import warnings
import copy
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageDraw, ImageOps, UnidentifiedImageError

MAX_IMAGES = 60
MAX_ENCODED_BYTES = 40_000_000
MAX_IMAGE_BYTES = 12_000_000
MAX_PIXELS = 20_000_000
MAX_SIDE = 900
MAX_FEATURES = 1400
MAX_EVIDENCE = 120
MAX_EVIDENCE_BYTES = 15_000_000
MAX_REVIEW_PREVIEW_BYTES = 12_000_000
MAX_OPENCV_THREADS = 2
_DATA_URL = re.compile(r'^data:(image/(?:png|jpeg|jpg|webp|gif|tiff|bmp|x-ms-bmp));base64,', re.I)
_FORMATS = {'PNG', 'JPEG', 'WEBP', 'GIF', 'TIFF', 'BMP'}


class ScreeningCache:
    """Bounded, expiring process-memory reuse; never persists private images.

    Callers opt in for repeated local reviews. Native pixels are still decoded
    and hashed on each request, so replacing a source invalidates its entries.
    Only descriptors and pair evidence geometry are retained (no source rasters,
    labels, identifiers, encoded image payloads or reports). A cached negative is
    distinguishable from a missing entry. Thresholds/resolution remain identical.
    """
    def __init__(self, max_bytes=24_000_000, max_entries=4096, ttl_seconds=300,
                 clock=time.monotonic):
        if max_bytes < 1 or max_entries < 1 or ttl_seconds <= 0:
            raise ValueError('Cache bounds must be positive')
        self.max_bytes, self.max_entries, self.ttl = max_bytes, max_entries, ttl_seconds
        self.clock, self.entries, self.bytes = clock, OrderedDict(), 0
        self.lock = threading.RLock()

    def clear(self):
        with self.lock:
            self.entries.clear()
            self.bytes = 0

    def _prune(self, now):
        for key in list(self.entries):
            if now-self.entries[key][0] >= self.ttl:
                self.bytes -= self.entries.pop(key)[2]

    def get(self, key):
        with self.lock:
            self._prune(self.clock())
            record = self.entries.get(key)
            if record is None:
                return False, None
            self.entries.move_to_end(key)
            return True, copy.deepcopy(record[1])

    def put(self, key, value):
        # Numpy buffers dominate feature storage. Include conservative object
        # overhead for negative pairs and small dictionaries, not only buffers.
        def size(v):
            if isinstance(v, np.ndarray):
                return v.nbytes+128
            if isinstance(v, dict):
                return 256+sum(size(k)+size(x) for k, x in v.items())
            if isinstance(v, (list, tuple)):
                return 128+sum(size(x) for x in v)
            return 128+len(v)*4 if isinstance(v, str) else 64
        amount = size(value)+size(key)
        with self.lock:
            self._prune(self.clock())
            previous = self.entries.pop(key, None)
            if previous:
                self.bytes -= previous[2]
            if amount > self.max_bytes:
                return
            # Feature arrays of a 60-image batch may exceed the small budget.
            # Reserve one quarter for pair decisions so a sequential feature
            # miss cannot evict every cached comparison on the next review.
            namespace = key[0] if isinstance(key, tuple) and key and key[0] in {'features', 'pair'} else None
            if namespace:
                limit = self.max_bytes*(.75 if namespace == 'features' else .25)
                if amount > limit:
                    return
                same = [k for k in self.entries if isinstance(k, tuple) and k and k[0] == namespace]
                used = sum(self.entries[k][2] for k in same)
                while same and used+amount > limit:
                    removed = self.entries.pop(same.pop(0))[2]
                    self.bytes -= removed
                    used -= removed
            while self.entries and (self.bytes+amount > self.max_bytes or len(self.entries) >= self.max_entries):
                self.bytes -= self.entries.popitem(last=False)[1][2]
            self.entries[key] = (self.clock(), copy.deepcopy(value), amount)
            self.bytes += amount


def _cache_identity(image):
    # Include analysis settings and visible ROI; a full-image native hash alone
    # cannot identify which cropped preview supplied the descriptors.
    roi = image.info.get('analysisRoi')
    return (image.info['sha256'], tuple(image.gray.shape),
            tuple(roi[k] for k in ('x', 'y', 'w', 'h')) if roi else None,
            MAX_SIDE, MAX_FEATURES, 'sift025-edge12-flann4-check48-v1')


class ScanCancelled(Exception):
    """The user cancelled a scan; incomplete results must not look complete."""


def _check_cancel(cancelled):
    if cancelled is not None and cancelled():
        raise ScanCancelled('Image duplicate check cancelled.')


def _emit(progress, stage, completed, total):
    if progress is not None:
        progress({'stage': stage, 'completed': completed, 'total': total})


def _engine():
    try:
        import cv2
    except ImportError as exc:
        raise ValueError('图片查重需要 OpenCV。请安装最新版 Figure Studio 或更新 skill 依赖。 / '
                         'Image duplicate screening requires OpenCV. Install the current Figure Studio release or update skill dependencies.') from exc
    # OpenCV otherwise sizes its worker pool to the host CPU count. Bound native
    # parallelism so concurrent local checks do not monopolize the editor host.
    if cv2.getNumThreads() > MAX_OPENCV_THREADS:
        cv2.setNumThreads(MAX_OPENCV_THREADS)
    return cv2


def _png_url(image):
    stream = io.BytesIO()
    image.save(stream, format='PNG', optimize=False)
    return 'data:image/png;base64,' + base64.b64encode(stream.getvalue()).decode('ascii')


def _thumbnail(image):
    thumb = image.copy()
    thumb.thumbnail((240, 180), Image.Resampling.LANCZOS)
    return _png_url(thumb)


@dataclass
class _Image:
    info: dict
    rgb: np.ndarray
    gray: np.ndarray
    variants: list


def _validate(images):
    if not isinstance(images, list) or not 2 <= len(images) <= MAX_IMAGES:
        raise ValueError('请选择 2–60 张图片。 / Choose 2–60 images.')
    seen = set()
    encoded = 0
    for record in images:
        if not isinstance(record, dict):
            raise ValueError('Each image must be an object with id, label and raster data.')
        identity, label, data = record.get('id'), record.get('label'), record.get('data')
        if not isinstance(identity, str) or not identity.strip() or len(identity) > 200 or identity in seen:
            raise ValueError('Image identifiers must be nonempty, unique strings of at most 200 characters.')
        if not isinstance(label, str) or not label.strip() or len(label) > 300:
            raise ValueError('Image labels must contain 1–300 characters.')
        if not isinstance(data, str) or not _DATA_URL.match(data):
            raise ValueError('只接受嵌入的 PNG、JPEG、WebP、GIF、TIFF 或 BMP 图片，不接受路径、网址或 SVG。 / '
                             'Use embedded PNG, JPEG, WebP, GIF, TIFF or BMP images; paths, URLs and SVG are not accepted.')
        if len(data) > 4 * ((MAX_IMAGE_BYTES + 2) // 3) + 64:
            raise ValueError('单张图片不应超过 12 MB。 / Each image must be at most 12 MB.')
        encoded += len(data)
        if encoded > MAX_ENCODED_BYTES:
            raise ValueError('本批图片编码后超过 40 MB，请减少图片数量。 / This batch exceeds 40 MB of encoded images; select fewer images.')
        seen.add(identity)


def _roi_box(roi, width, height):
    if (not isinstance(roi, dict) or set(roi) != {'x', 'y', 'w', 'h'} or
            any(type(v) not in (int, float) or not math.isfinite(v) for v in roi.values()) or
            roi['x'] < 0 or roi['y'] < 0 or min(roi['w'], roi['h']) <= 0 or
            roi['x']+roi['w'] > 1+1e-12 or roi['y']+roi['h'] > 1+1e-12):
        raise ValueError('Invalid normalized image ROI')
    box = (math.floor(roi['x']*width), math.floor(roi['y']*height),
           min(width, math.ceil((roi['x']+roi['w'])*width)),
           min(height, math.ceil((roi['y']+roi['h'])*height)))
    return box, {'x': box[0]/width, 'y': box[1]/height,
                 'w': (box[2]-box[0])/width, 'h': (box[3]-box[1])/height}


def _high_depth_preview(payload, original, cv, roi=None):
    """Keep native scientific intensities distinct from an 8-bit preview.

    Pillow exposes 16-bit grayscale, but may expose multichannel 16-bit TIFF/PNG
    as 8-bit RGB. Decode those through OpenCV's unchanged-depth path instead.
    The display intensity mapping is recorded; only the preview is normalized.
    """
    if original.format == 'TIFF' and original.tag_v2.get(262) not in {0, 1, 2}:
        raise ValueError('无法无损读取此高位深 TIFF 色彩模式，请将原始通道逐一导出为保留位深的灰度 TIFF/PNG 后检查。 / '
                         'Unsupported high-depth TIFF color layout; export each original channel as a native-depth grayscale TIFF/PNG before checking.')
    raw = cv.imdecode(np.frombuffer(payload, np.uint8), cv.IMREAD_UNCHANGED)
    if raw is None or raw.dtype.itemsize <= 1 or raw.ndim not in (2, 3):
        raise ValueError('无法保留此高位深图片的原始像素，请先导出为 16 位 TIFF 或 PNG。 / '
                         'Cannot preserve native high-depth pixels; export a supported 16-bit TIFF or PNG.')
    if raw.ndim == 3:
        if raw.shape[2] == 3:
            raw = cv.cvtColor(raw, cv.COLOR_BGR2RGB)
        elif raw.shape[2] == 4:
            raw = cv.cvtColor(raw, cv.COLOR_BGRA2RGBA)
        else:
            raise ValueError('Unsupported high-depth image channel layout.')
    if not np.all(np.isfinite(raw)):
        raise ValueError('高位深图片包含 NaN 或无穷值。 / The high-depth image contains NaN or infinite pixel values.')
    orientation = original.getexif().get(274, 1)
    if orientation == 2:
        raw = raw[:, ::-1]
    elif orientation == 3:
        raw = raw[::-1, ::-1]
    elif orientation == 4:
        raw = raw[::-1]
    elif orientation == 5:
        raw = raw.swapaxes(0, 1)
    elif orientation == 6:
        raw = np.rot90(raw, -1)
    elif orientation == 7:
        raw = raw.swapaxes(0, 1)[::-1, ::-1]
    elif orientation == 8:
        raw = np.rot90(raw)
    raw = np.ascontiguousarray(raw)
    height, width = raw.shape[:2]
    digest = hashlib.sha256(f'{raw.shape}:{raw.dtype}:native:'.encode('ascii'))
    digest.update(raw.tobytes())
    native_intensity = raw[:, :, :3] if raw.ndim == 3 and raw.shape[2] == 4 else raw
    low, high = float(native_intensity.min()), float(native_intensity.max())
    analysis_roi = None
    if roi is not None:
        box, analysis_roi = _roi_box(roi, width, height)
        raw = raw[box[1]:box[3], box[0]:box[2]]
    # Crop native pixels before reducing them. Width/height and the digest
    # continue to describe the full, oriented source, not this analysis view.
    shown_height, shown_width = raw.shape[:2]
    if max(shown_width, shown_height) > MAX_SIDE:
        factor = MAX_SIDE / max(shown_width, shown_height)
        raw = cv.resize(raw, (max(1, round(shown_width * factor)), max(1, round(shown_height * factor))), interpolation=cv.INTER_AREA)
    intensity = raw[:, :, :3] if raw.ndim == 3 and raw.shape[2] == 4 else raw
    shown = np.zeros(intensity.shape, np.uint8)
    if high > low:
        shown = np.clip((intensity.astype(np.float64) - low) * (255. / (high - low)), 0, 255).astype(np.uint8)
    image = Image.fromarray(shown).convert('RGB')
    if raw.ndim == 3 and raw.shape[2] == 4:
        alpha_max = float(np.iinfo(raw.dtype).max) if np.issubdtype(raw.dtype, np.integer) else 1.
        alpha = np.clip(raw[:, :, 3].astype(np.float64) * 255. / alpha_max, 0, 255).astype(np.uint8)
        background = Image.new('RGB', image.size, 'white')
        background.paste(image, mask=Image.fromarray(alpha))
        image = background
    return image, digest, {'sourceDtype': str(raw.dtype), 'minimum': low, 'maximum': high,
                           'previewMapping': 'linear min–max to 8-bit; native pixels used for exact identity'}, (width, height), analysis_roi


def _read(record, cv, roi=None):
    prefix = _DATA_URL.match(record['data'])
    try:
        payload = base64.b64decode(record['data'][prefix.end():], validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError('Invalid base64 raster image.') from exc
    if not payload or len(payload) > MAX_IMAGE_BYTES:
        raise ValueError('Each raster image must contain 1 byte–12 MB of data.')
    try:
        with warnings.catch_warnings():
            warnings.simplefilter('error', Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(payload)) as original:
                if original.format not in _FORMATS:
                    raise ValueError('Unsupported raster image format.')
                width, height = original.size
                if width * height > MAX_PIXELS or max(width, height) > 30_000 or min(width, height) < 1:
                    raise ValueError('单张图片最多 2000 万像素、单边最多 30000 像素。 / Image limit: 20 megapixels and 30000 pixels per side.')
                if getattr(original, 'n_frames', 1) != 1:
                    raise ValueError('请分别导入每帧/每页图片。 / Import each frame or page separately; animated and multipage images are not screened silently.')
                bits = getattr(original, 'tag_v2', {}).get(258, (8,))
                if isinstance(bits, int):
                    bits = (bits,)
                high_depth = (original.mode.startswith('I') or original.mode == 'F' or max(bits) > 8 or
                              (original.format == 'PNG' and len(payload) > 24 and payload[24] > 8))
                intensity_mapping = None
                analysis_roi = None
                if high_depth:
                    rgb, digest, intensity_mapping, (width, height), analysis_roi = _high_depth_preview(payload, original, cv, roi=roi)
                else:
                    rgba = ImageOps.exif_transpose(original).convert('RGBA')
                    width, height = rgba.size
                    digest = hashlib.sha256(f'{width}x{height}:RGBA:'.encode('ascii'))
                    digest.update(rgba.tobytes())
                    background = Image.new('RGBA', rgba.size, 'white')
                    background.alpha_composite(rgba)
                    del rgba
                    rgb = background.convert('RGB')
                    del background
                if roi is not None and not high_depth:
                    box, analysis_roi = _roi_box(roi, width, height)
                    rgb = rgb.crop(box)
                rgb.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning, cv.error) as exc:
        raise ValueError('图片损坏、尺寸过大或格式无法读取。 / The image is damaged, too large or unreadable.') from exc
    array = np.array(rgb)
    gray = cv.cvtColor(array, cv.COLOR_RGB2GRAY)
    info = {'id': record['id'], 'label': record['label'], 'width': width, 'height': height,
            'sha256': digest.hexdigest(), 'thumbnail': _thumbnail(rgb), 'warnings': []}
    if analysis_roi is not None:
        info['analysisRoi'] = analysis_roi
    if intensity_mapping:
        info['intensityMapping'] = intensity_mapping
        info['warnings'].append('high_bit_depth_preview')
    if float(np.std(gray)) < 5 or min(gray.shape) < 24:
        info['warnings'].append('low_information')
    return _Image(info, array, gray, [])


def _features(image, sift, cv, cancelled, cache=None):
    if 'low_information' in image.info['warnings']:
        return
    cache_key = ('features', _cache_identity(image))
    found, stored = cache.get(cache_key) if cache is not None else (False, None)
    if found:
        _check_cancel(cancelled)
        image.info['warnings'].extend(stored['warnings'])
        image.variants = stored['variants']
        for variant in image.variants:
            if variant is not None:
                matcher = cv.FlannBasedMatcher(dict(algorithm=1, trees=4), dict(checks=48))
                matcher.add([variant['descriptors']])
                matcher.train()
                variant['matcher'] = matcher
        return
    for mirrored in (False, True):
        _check_cancel(cancelled)
        gray = np.ascontiguousarray(image.gray[:, ::-1]) if mirrored else image.gray
        points, descriptors = sift.detectAndCompute(gray, None)
        if descriptors is None or len(points) < 12:
            image.variants.append(None)
            continue
        # SIFT may emit several orientations at one location. These are not
        # independent evidence and must not inflate the geometric support count.
        unique = {}
        for index, keypoint in enumerate(points):
            key = (round(keypoint.pt[0] / 2), round(keypoint.pt[1] / 2))
            if key not in unique or keypoint.response > points[unique[key]].response:
                unique[key] = index
        indices = list(unique.values())
        descriptors = np.ascontiguousarray(descriptors[indices], dtype=np.float32)
        coordinates = np.float32([points[i].pt for i in indices])
        if len(indices) < 12:
            image.variants.append(None)
            continue
        matcher = cv.FlannBasedMatcher(dict(algorithm=1, trees=4), dict(checks=48))
        matcher.add([descriptors])
        matcher.train()
        # Dense regular grids and repeated motifs cannot support a reliable
        # identity inference merely because many similar features exist.
        self_matches = matcher.knnMatch(descriptors, k=3)
        ambiguous = sum(len(m) > 1 and m[1].distance < 28 for m in self_matches) / len(indices)
        image.variants.append({'points': coordinates, 'descriptors': descriptors,
                               'matcher': matcher, 'mirrored': mirrored, 'ambiguous': ambiguous})
    if not any(image.variants):
        image.info['warnings'].append('few_distinctive_features')
    elif image.variants[0] and image.variants[0]['ambiguous'] > .55:
        image.info['warnings'].append('repetitive_texture')
    if cache is not None:
        _check_cancel(cancelled)
        cache.put(cache_key, {'variants': [None if variant is None else
                  {key: value for key, value in variant.items() if key != 'matcher'} for variant in image.variants],
                  'warnings': [w for w in image.info['warnings'] if w in {'few_distinctive_features', 'repetitive_texture'}]})


def _hull_coverage(points, shape, cv):
    return float(cv.contourArea(cv.convexHull(np.float32(points)))) / (shape[0] * shape[1])


def _corners(shape):
    height, width = shape[:2]
    return np.float32([[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]])


def _transform(points, matrix):
    return np.float32(points) @ matrix[:, :2].T + matrix[:, 2]


def _content_agreement(a, b, matrix, points, cv):
    # Work in image A coordinates. A hull of verified features limits the
    # photometric comparison to the region actually supported by the match.
    inverse = cv.invertAffineTransform(matrix)
    aligned = cv.warpAffine(b.gray, inverse, (a.gray.shape[1], a.gray.shape[0]))
    valid = cv.warpAffine(np.full(b.gray.shape, 255, np.uint8), inverse,
                         (a.gray.shape[1], a.gray.shape[0]), flags=cv.INTER_NEAREST)
    support = np.zeros(a.gray.shape, np.uint8)
    cv.fillConvexPoly(support, cv.convexHull(np.int32(points)), 255)
    mask = cv.erode(cv.bitwise_and(valid, support), np.ones((5, 5), np.uint8)) > 0
    if np.count_nonzero(mask) < 160:
        return 0.
    aa = cv.GaussianBlur(a.gray, (3, 3), .8)[mask].astype(np.float32)
    bb = cv.GaussianBlur(aligned, (3, 3), .8)[mask].astype(np.float32)
    aa -= aa.mean()
    bb -= bb.mean()
    denominator = float(np.linalg.norm(aa) * np.linalg.norm(bb))
    return float(np.clip(np.dot(aa, bb) / denominator, -1, 1)) if denominator > 1 else 0.


def _candidate(a, b, variant, cv):
    source = a.variants[0] if a.variants else None
    if source is None or variant is None or source['ambiguous'] > .55 or variant['ambiguous'] > .55:
        return None
    neighbors = variant['matcher'].knnMatch(source['descriptors'], k=2)
    good = [pair[0] for pair in neighbors if len(pair) == 2 and pair[0].distance < .72 * pair[1].distance]
    if len(good) < 12:
        return None
    # Enforce one-to-one features, including ambiguous repeated target points.
    unique = {}
    for match in good:
        if match.trainIdx not in unique or match.distance < unique[match.trainIdx].distance:
            unique[match.trainIdx] = match
    good = list(unique.values())
    if len(good) < 12:
        return None
    src = source['points'][[match.queryIdx for match in good]]
    dst = variant['points'][[match.trainIdx for match in good]]
    matrix, mask = cv.estimateAffinePartial2D(src, dst, method=cv.RANSAC,
                                             ransacReprojThreshold=3., maxIters=2500,
                                             confidence=.995, refineIters=10)
    if matrix is None or mask is None or not np.all(np.isfinite(matrix)):
        return None
    inliers = mask.ravel().astype(bool)
    count = int(np.count_nonzero(inliers))
    if count < 12 or count / len(good) < .48:
        return None
    src, dst = src[inliers], dst[inliers]
    scale = float(np.linalg.norm(matrix[0, :2]))
    if not .08 <= scale <= 12:
        return None
    residual = float(np.median(np.linalg.norm(_transform(src, matrix) - dst, axis=1)))
    coverage_a = _hull_coverage(src, a.gray.shape, cv)
    coverage_b = _hull_coverage(dst, b.gray.shape, cv)
    if min(coverage_a, coverage_b) < .015 or max(coverage_a, coverage_b) < .13 or residual > 2:
        return None
    if variant['mirrored']:
        # Convert back from mirrored descriptor coordinates to the original B.
        dst[:, 0] = b.gray.shape[1] - 1 - dst[:, 0]
        matrix[0, :] *= -1
        matrix[0, 2] += b.gray.shape[1] - 1
    correlation = _content_agreement(a, b, matrix, src, cv)
    if correlation < .84:
        return None
    boundary_a = _corners(a.gray.shape)
    boundary_b = _corners(b.gray.shape)
    mapped = _transform(boundary_a, matrix).astype(np.float32)
    intersection, _ = cv.intersectConvexConvex(cv.convexHull(mapped), cv.convexHull(boundary_b))
    area_a = float(cv.contourArea(cv.convexHull(mapped)))
    area_b = float(cv.contourArea(cv.convexHull(boundary_b)))
    overlap_a = min(1., max(0., intersection / max(1., area_a)))
    overlap_b = min(1., max(0., intersection / max(1., area_b)))
    return {'kind': 'transformed' if min(overlap_a, overlap_b) > .9 else 'overlap',
            'inliers': count, 'coverageA': round(coverage_a, 4), 'coverageB': round(coverage_b, 4),
            'overlapA': round(overlap_a, 4), 'overlapB': round(overlap_b, 4),
            'contentAgreement': round(correlation, 4), 'residualPixels': round(residual, 3),
            'mirrored': variant['mirrored'], '_pointsA': src, '_pointsB': dst, '_matrix': matrix}


def _evidence(a, b, result):
    # A/B identifiers intentionally avoid font-dependent label rendering. The
    # report carries original Unicode labels alongside this evidence image.
    pictures, scales = [], []
    for item in (a, b):
        image = Image.fromarray(item.rgb)
        scale = min(480 / image.width, 340 / image.height, 1.)
        scales.append(scale)
        image = image.resize((max(1, round(image.width * scale)), max(1, round(image.height * scale))), Image.Resampling.LANCZOS)
        pictures.append(image)
    gap, padding, top = 26, 12, 28
    height = max(p.height for p in pictures)
    out = Image.new('RGB', (pictures[0].width + pictures[1].width + gap + 2 * padding, height + top + padding), '#f4f6fa')
    offsets = [(padding, top), (padding + pictures[0].width + gap, top)]
    draw = ImageDraw.Draw(out)
    for index, (picture, (x, y)) in enumerate(zip(pictures, offsets)):
        out.paste(picture, (x, y))
        draw.text((x, 8), 'A' if index == 0 else 'B', fill='#243e63')
    if result['kind'] == 'exact':
        for picture, (x, y) in zip(pictures, offsets):
            draw.rectangle((x, y, x + picture.width - 1, y + picture.height - 1), outline='#287caa', width=3)
        draw.text((padding + 22, 8), 'Identical decoded pixels', fill='#243e63')
    else:
        colors = ('#f9bd3b', '#26bcd5', '#eb6b91', '#a594ee')
        points_a, points_b = result['_pointsA'], result['_pointsB']
        indices = np.linspace(0, len(points_a) - 1, min(18, len(points_a)), dtype=int)
        for n, index in enumerate(indices):
            pa = tuple(float(v) for v in points_a[index] * scales[0] + offsets[0])
            pb = tuple(float(v) for v in points_b[index] * scales[1] + offsets[1])
            color = colors[n % len(colors)]
            draw.line((pa, pb), fill=color, width=1)
            for x, y in (pa, pb):
                draw.ellipse((x - 3, y - 3, x + 3, y + 3), outline=color, width=2)
        draw.text((padding + 22, 8), f"{result['inliers']} verified feature matches", fill='#243e63')
    return _png_url(out)


def scan_images(images, progress=None, cancelled=None, cache=None):
    """Screen embedded image pairs; return JSON-safe review records and evidence.

    ``coverageA/B`` are convex-hull coverage of supporting features, not a
    probability. ``contentAgreement`` is normalized correlation in that hull.
    Transform coordinates refer to each image's ``analysisWidth/Height``.
    ``reviewPreview`` is an RGB PNG in those same analysis coordinates, not the
    native-resolution scientific image. High-depth display mappings remain in
    ``intensityMapping``. Its 12 MB total budget counts every serialized image
    entry, including duplicates; omitted previews retain the thumbnail fallback.
    Limits bound a local worker's memory; the caller should run it off the UI
    thread. No files are written and no network operations are performed.
    """
    _validate(images)
    _check_cancel(cancelled)
    cv = _engine()
    sift = cv.SIFT_create(nfeatures=MAX_FEATURES, contrastThreshold=.025, edgeThreshold=12)
    prepared = []
    by_digest = {}
    review_preview_bytes = review_preview_omitted = 0
    _emit(progress, 'images', 0, len(images))
    for index, record in enumerate(images):
        _check_cancel(cancelled)
        item = _read(record, cv)
        same_pixels = by_digest.get(item.info['sha256'])
        if same_pixels is None:
            _features(item, sift, cv, cancelled, cache=cache)
            by_digest[item.info['sha256']] = item
        else:
            item.rgb, item.gray, item.variants = same_pixels.rgb, same_pixels.gray, same_pixels.variants
            item.info['warnings'] = list(same_pixels.info['warnings'])
        item.info['analysisWidth'] = int(item.gray.shape[1])
        item.info['analysisHeight'] = int(item.gray.shape[0])
        _check_cancel(cancelled)
        # Reuse the accepted PNG object for equal pixels. Count its size again
        # for each image entry because JSON serializes shared strings repeatedly.
        if same_pixels is not None:
            preview = same_pixels.info['reviewPreview']
        elif review_preview_bytes < MAX_REVIEW_PREVIEW_BYTES:
            preview = _png_url(Image.fromarray(item.rgb))
        else:
            preview = None
        if preview and review_preview_bytes + len(preview) > MAX_REVIEW_PREVIEW_BYTES:
            preview = None
        item.info['reviewPreview'] = preview
        item.info['reviewPreviewAvailable'] = preview is not None
        if preview:
            review_preview_bytes += len(preview)
        else:
            review_preview_omitted += 1
            if 'review_preview_limit' not in item.info['warnings']:
                item.info['warnings'].append('review_preview_limit')
        prepared.append(item)
        _emit(progress, 'images', index + 1, len(images))
    matches = []
    total = len(prepared) * (len(prepared) - 1) // 2
    completed = omitted = evidence_bytes = 0
    _emit(progress, 'pairs', 0, total)
    for ai, a in enumerate(prepared):
        for b in prepared[ai + 1:]:
            _check_cancel(cancelled)
            if a.info['sha256'] == b.info['sha256']:
                result = {'kind': 'exact', 'inliers': 0, 'coverageA': 1., 'coverageB': 1.,
                          'overlapA': 1., 'overlapB': 1., 'contentAgreement': 1., 'mirrored': False}
            else:
                key = ('pair', _cache_identity(a), _cache_identity(b))
                found, result = cache.get(key) if cache is not None else (False, None)
                if not found:
                    result = None
                    for variant in b.variants:
                        _check_cancel(cancelled)
                        candidate = _candidate(a, b, variant, cv)
                        if candidate and (result is None or candidate['inliers'] > result['inliers']):
                            result = candidate
                    _check_cancel(cancelled)
                    if cache is not None:
                        cache.put(key, result)
            if result:
                result.update({'a': a.info['id'], 'b': b.info['id'], 'reviewRequired': True})
                evidence = _evidence(a, b, result) if len(matches) < MAX_EVIDENCE and evidence_bytes < MAX_EVIDENCE_BYTES else None
                if evidence and evidence_bytes + len(evidence) > MAX_EVIDENCE_BYTES:
                    evidence = None
                result['evidenceAvailable'] = evidence is not None
                result['evidence'] = evidence
                evidence_bytes += len(evidence) if evidence else 0
                if not result['evidenceAvailable']:
                    omitted += 1
                if '_matrix' in result:
                    result['transformAtoB'] = np.round(result.pop('_matrix'), 6).tolist()
                    result['pointsA'] = np.round(result.pop('_pointsA')[:80], 2).tolist()
                    result['pointsB'] = np.round(result.pop('_pointsB')[:80], 2).tolist()
                matches.append(result)
            completed += 1
            _emit(progress, 'pairs', completed, total)
    _check_cancel(cancelled)
    return {'schema': 'image-duplicate-check/1', 'status': 'complete',
            'images': [item.info for item in prepared], 'matches': matches,
            'pairCount': total, 'evidenceOmitted': omitted, 'evidenceBytes': evidence_bytes,
            'reviewPreviewBytes': review_preview_bytes, 'reviewPreviewOmitted': review_preview_omitted,
            'warnings': (['evidence_limit'] if omitted else []) + (['review_preview_limit'] if review_preview_omitted else []),
            'limits': {'maxImages': MAX_IMAGES, 'maxImageBytes': MAX_IMAGE_BYTES,
                       'maxEncodedBytes': MAX_ENCODED_BYTES, 'maxPixels': MAX_PIXELS,
                       'analysisMaxSide': MAX_SIDE, 'maxFeatures': MAX_FEATURES,
                       'maxEvidence': MAX_EVIDENCE, 'maxEvidenceBytes': MAX_EVIDENCE_BYTES,
                       'maxReviewPreviewBytes': MAX_REVIEW_PREVIEW_BYTES,
                       'maxOpenCvThreads': MAX_OPENCV_THREADS},
            'scope': 'between_images',
            'interpretation': 'Suspected image reuse for human review. No matches does not prove absence of reuse. '
                              'Small crops, very low detail, repetitive textures, severe edits and within-image duplication can be missed.'}
