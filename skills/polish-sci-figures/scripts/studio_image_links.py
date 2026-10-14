"""Offline localization of an ordered child crop in its parent image.

Uses the existing bounded raster/SIFT engine, with stricter geometry than image
reuse screening. Matches are reviewable localization candidates, never proof of
acquisition magnification or scientific identity. Input/output coordinates refer
to EXIF-oriented decoded files, before any editor crop or SVG transformation.
No input is uploaded, no file paths are accepted and no files are written.
"""
from __future__ import annotations

import math

import numpy as np

import studio_duplicates as duplicate


MIN_INLIERS = 20
MIN_CHILD_COVERAGE = .42
MIN_CHILD_SPAN = .70
MIN_OCCUPIED_CELLS = 6
MIN_CONTENT_AGREEMENT = .90
MAX_RESIDUAL_PIXELS = 1.5
MAX_CYCLE_FRACTION = .006
MAX_ORIENTATION_ERROR_DEGREES = 1.
MIN_PARENT_AREA = .02
MAX_PARENT_AREA = .92
MAX_AMBIGUITY = .40

_DIRECTIONS = {
    'normal': (1, 0, 0, 1), 'rotate90': (0, 1, -1, 0),
    'rotate180': (-1, 0, 0, -1), 'rotate270': (0, -1, 1, 0),
    'flipX': (-1, 0, 0, 1), 'flipY': (1, 0, 0, -1),
    'transpose': (0, 1, 1, 0), 'transverse': (0, -1, -1, 0),
}
_FULL_ROI = {'x': 0., 'y': 0., 'w': 1., 'h': 1.}


def _edges(shape):
    """Pixel boundary corners; SIFT coordinates refer to pixel centres."""
    h, w = shape[:2]
    return np.float32([[-.5, -.5], [w-.5, -.5], [w-.5, h-.5], [-.5, h-.5]])


def _normalized(points, shape):
    h, w = shape[:2]
    return (np.asarray(points, dtype=np.float64) + .5) / [w, h]


def _whole_coordinates(points, image):
    roi = image.info['analysisRoi']
    return _normalized(points, image.gray.shape)*[roi['w'], roi['h']] + [roi['x'], roi['y']]


def _visible_edges(image):
    visible, analysis = image.info['visibleRoi'], image.info['analysisRoi']
    whole = np.array([[visible['x'], visible['y']], [visible['x']+visible['w'], visible['y']],
                      [visible['x']+visible['w'], visible['y']+visible['h']], [visible['x'], visible['y']+visible['h']]])
    return np.float32((whole-[analysis['x'], analysis['y']])/[analysis['w'], analysis['h']] * [image.gray.shape[1], image.gray.shape[0]]-.5)


def _validate_roi(record):
    if set(record)-{'id', 'label', 'data', 'roi'}:
        raise ValueError('Image localization accepts only id, label, data and optional roi')
    roi = record.get('roi', _FULL_ROI)
    if (not isinstance(roi, dict) or set(roi) != {'x', 'y', 'w', 'h'} or
            any(type(v) not in (int, float) or not math.isfinite(v) for v in roi.values()) or
            min(roi['x'], roi['y']) < 0 or min(roi['w'], roi['h']) <= 0 or
            roi['x']+roi['w'] > 1+1e-12 or roi['y']+roi['h'] > 1+1e-12):
        raise ValueError('Invalid normalized image ROI')
    return dict(roi)


def _distribution(points, shape):
    normalized = np.clip(_normalized(points, shape), 0, 1-1e-9)
    cells = {tuple(v) for v in (normalized * 3).astype(int)}
    quadrants = {tuple(v) for v in (normalized * 2).astype(int)}
    span = np.ptp(normalized, axis=0)
    return {'occupiedCells': len(cells), 'quadrants': len(quadrants),
            'spanX': round(float(span[0]), 5), 'spanY': round(float(span[1]), 5)}


def _direction(matrix):
    x, y = matrix[:, 0], matrix[:, 1]
    x, y = x / np.linalg.norm(x), y / np.linalg.norm(y)
    values = np.array([x[0], x[1], y[0], y[1]])
    name, basis = min(_DIRECTIONS.items(), key=lambda item: np.linalg.norm(values-item[1]))
    error = math.degrees(math.acos(float(np.clip(np.dot(x, basis[:2]), -1, 1))))
    return name, error


def _best(a, b, cv, cancelled):
    candidates = []
    for variant in b.variants:
        duplicate._check_cancel(cancelled)
        result = duplicate._candidate(a, b, variant, cv)
        if result is not None:
            candidates.append(result)
    return max(candidates, key=lambda r: (r['inliers'], r['contentAgreement'])) if candidates else None


def _reason(pair, reason, quality=None):
    result = {**pair, 'status': 'unresolved', 'reason': reason, 'reviewRequired': True}
    if quality is not None:
        result['quality'] = quality
    # In particular: no guessed rectangle on an insufficient/ambiguous match.
    return result


def _locate(parent, child, cv, cancelled):
    pair = {'parentId': parent.info['id'], 'childId': child.info['id']}
    if parent.info['sha256'] == child.info['sha256'] and parent.info['visibleRoi'] == child.info['visibleRoi']:
        return _reason(pair, 'not_a_magnified_region')
    for image in (parent, child):
        if min(image.gray.shape) < 64 or not image.variants or image.variants[0] is None:
            return _reason(pair, 'insufficient_features')
        if any(v and v['ambiguous'] > MAX_AMBIGUITY for v in image.variants):
            return _reason(pair, 'repetitive_texture')
    forward, reverse = _best(parent, child, cv, cancelled), _best(child, parent, cv, cancelled)
    if forward is None or reverse is None:
        return _reason(pair, 'no_reliable_match')
    child_distribution = [_distribution(forward['_pointsB'], child.gray.shape),
                          _distribution(reverse['_pointsA'], child.gray.shape)]
    quality = {
        'forwardInliers': forward['inliers'], 'reverseInliers': reverse['inliers'],
        'childCoverage': min(forward['coverageB'], reverse['coverageA']),
        'parentCoverage': min(forward['coverageA'], reverse['coverageB']),
        'contentAgreement': min(forward['contentAgreement'], reverse['contentAgreement']),
        'residualPixels': max(forward['residualPixels'], reverse['residualPixels']),
        'childDistribution': child_distribution,
    }
    if (min(forward['inliers'], reverse['inliers']) < MIN_INLIERS or
            quality['childCoverage'] < MIN_CHILD_COVERAGE or
            any(d['occupiedCells'] < MIN_OCCUPIED_CELLS or d['quadrants'] < 4 or
                min(d['spanX'], d['spanY']) < MIN_CHILD_SPAN for d in child_distribution)):
        return _reason(pair, 'insufficient_spatial_support', quality)
    if quality['contentAgreement'] < MIN_CONTENT_AGREEMENT or quality['residualPixels'] > MAX_RESIDUAL_PIXELS:
        return _reason(pair, 'content_or_geometry_disagrees', quality)
    # Duplicate screening compares the feature hull. A localization promises the
    # child's whole field of view, so also compare the complete child footprint;
    # matching a central patch cannot justify a rectangle around new borders.
    whole_agreement = duplicate._content_agreement(child, parent, reverse['_matrix'], _visible_edges(child), cv)
    quality['wholeChildAgreement'] = round(whole_agreement, 5)
    if whole_agreement < MIN_CONTENT_AGREEMENT:
        return _reason(pair, 'whole_child_disagrees', quality)
    direction, angle_error = _direction(reverse['_matrix'])
    quality.update(orientation=direction, orientationErrorDegrees=round(angle_error, 5),
                   mirrored=bool(np.linalg.det(reverse['_matrix'][:, :2]) < 0))
    if angle_error > MAX_ORIENTATION_ERROR_DEGREES:
        return _reason(pair, 'unsupported_rotation', quality)
    corners = _visible_edges(child)
    projected = duplicate._transform(corners, reverse['_matrix'])
    cycled = duplicate._transform(projected, forward['_matrix'])
    cycle_error = float(np.max(np.linalg.norm(cycled-corners, axis=1)))
    cycle_fraction = cycle_error / math.hypot(*child.gray.shape)
    quality.update(cycleErrorPixels=round(cycle_error, 5), cycleErrorFraction=round(cycle_fraction, 7))
    if cycle_fraction > MAX_CYCLE_FRACTION or np.linalg.det(forward['_matrix'][:, :2]) * np.linalg.det(reverse['_matrix'][:, :2]) <= 0:
        return _reason(pair, 'bidirectional_disagreement', quality)
    normalized = _whole_coordinates(projected, parent)
    # Two analysis pixels accommodate feature fitting at file edges, not partial
    # overlap. Snap only this small numerical tolerance; never invent lost area.
    parent_roi, analysis_roi = parent.info['visibleRoi'], parent.info['analysisRoi']
    low = np.array([parent_roi['x'], parent_roi['y']])
    extent = np.array([parent_roi['w'], parent_roi['h']])
    tolerance = 2*np.array([analysis_roi['w'], analysis_roi['h']]) / [parent.gray.shape[1], parent.gray.shape[0]]
    if np.any(normalized < low-tolerance) or np.any(normalized > low+extent+tolerance):
        return _reason(pair, 'child_not_contained', quality)
    normalized = np.clip(normalized, low, low+extent)
    area = float(cv.contourArea(np.float32((normalized-low)/extent)))
    quality['parentAreaFraction'] = round(area, 7)
    if not MIN_PARENT_AREA <= area <= MAX_PARENT_AREA:
        return _reason(pair, 'not_a_magnified_region' if area > MAX_PARENT_AREA else 'region_too_small', quality)
    # Use measured feature coordinates for review, not a decorative confidence
    # percentage. Spacing/hull coverage and correlation are not probabilities.
    indices = np.linspace(0, len(forward['_pointsA'])-1, min(24, len(forward['_pointsA'])), dtype=int)
    points_parent = _whole_coordinates(forward['_pointsA'][indices], parent)
    points_child = _whole_coordinates(forward['_pointsB'][indices], child)
    return {**pair, 'status': 'matched', 'reviewRequired': True,
            'parentCorners': normalized.tolist(), 'quality': quality,
            'evidence': {'method': 'sift_similarity_bidirectional',
                         'parentPoints': points_parent.tolist(), 'childPoints': points_child.tolist()}}


def locate_image_links(images, progress=None, cancelled=None):
    """Locate 1–2 adjacent parent→child pairs from 2–3 ordered local rasters.

    Each input is ``{id, label, data: embeddedRasterDataUrl, roi?}``; optional roi
    is ``{x,y,w,h}`` normalized to the whole EXIF-oriented decoded image. Only
    that visible region participates in matching; cropping precedes downsampling.
    The return is
    JSON-safe. ``parentCorners`` order corresponds to child top-left, top-right,
    bottom-right, bottom-left, normalized against the *whole decoded parent*.
    Caller must account for its own visible crop/SVG transform before drawing.
    Unsupported/weak matches contain no coordinates and remain manually editable.
    Run on an existing local worker, not the UI thread. Cancellation is checked
    between each bounded OpenCV call, as in the image duplicate engine.
    """
    if not isinstance(images, list) or len(images) not in (2, 3):
        raise ValueError('请选择按原图到放大图顺序排列的 2–3 张图片。 / Choose 2–3 images in parent-to-child order.')
    duplicate._validate(images)
    rois = [_validate_roi(record) for record in images]
    duplicate._check_cancel(cancelled)
    cv = duplicate._engine()
    sift = cv.SIFT_create(nfeatures=duplicate.MAX_FEATURES, contrastThreshold=.025, edgeThreshold=12)
    prepared = []
    duplicate._emit(progress, 'images', 0, len(images))
    for index, record in enumerate(images):
        duplicate._check_cancel(cancelled)
        image = duplicate._read(record, cv, roi=rois[index])
        image.info['visibleRoi'] = rois[index]
        duplicate._features(image, sift, cv, cancelled)
        prepared.append(image)
        duplicate._emit(progress, 'images', index+1, len(images))
    pairs = []
    duplicate._emit(progress, 'pairs', 0, len(images)-1)
    for index, (parent, child) in enumerate(zip(prepared, prepared[1:])):
        duplicate._check_cancel(cancelled)
        pairs.append(_locate(parent, child, cv, cancelled))
        duplicate._emit(progress, 'pairs', index+1, len(images)-1)
    matched = sum(p['status'] == 'matched' for p in pairs)
    infos = []
    for image in prepared:
        info = {k: image.info[k] for k in ('id', 'label', 'width', 'height', 'sha256', 'warnings', 'analysisRoi', 'visibleRoi')}
        info.update(analysisWidth=int(image.gray.shape[1]), analysisHeight=int(image.gray.shape[0]))
        if 'intensityMapping' in image.info:
            info['intensityMapping'] = image.info['intensityMapping']
        infos.append(info)
    return {'version': 1, 'coordinateSpace': 'decoded-image-normalized',
            'status': 'matched' if matched == len(pairs) else 'partial' if matched else 'unresolved',
            'reviewRequired': True, 'images': infos, 'pairs': pairs,
            'limits': {'maxImages': 3, 'maxAnalysisSide': duplicate.MAX_SIDE,
                       'supportedOrientations': list(_DIRECTIONS),
                       'maxOrientationErrorDegrees': MAX_ORIENTATION_ERROR_DEGREES}}
