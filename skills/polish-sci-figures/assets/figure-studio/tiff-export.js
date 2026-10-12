/* Standalone, lossless RGB TIFF export. Canvas RGBA pixels are composited on white. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudioTiff = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  // Canvas + ImageData + RGB output require about 11 bytes/pixel, before SVG resources.
  // Reject an oversized export instead of reducing its requested resolution.
  const MAX_PIXELS = 64000000, MAX_DIMENSION = 32767, ROWS_PER_STRIP = 64;
  const TAG_COUNT = 14;

  function fail(code, message) { const error = new Error(message); error.code = code; throw error; }
  function geometry(options) {
    const {width, height} = options || {};
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
      fail('TIFF_DIMENSIONS', 'TIFF dimensions must be positive integers.');
    if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS)
      fail('TIFF_CAPACITY', 'TIFF export exceeds the pixel capacity. Export SVG at the requested size instead.');
    const rowsPerStrip = Math.min(ROWS_PER_STRIP, height), strips = Math.ceil(height / rowsPerStrip);
    // Header + IFD + three SHORT bit depths + two RATIONAL resolutions.
    const bitsOffset = 8 + 2 + TAG_COUNT * 12 + 4;
    const xResolutionOffset = bitsOffset + 6, yResolutionOffset = xResolutionOffset + 8;
    const stripOffsetsOffset = yResolutionOffset + 8;
    const stripCountsOffset = stripOffsetsOffset + (strips > 1 ? strips * 4 : 0);
    const pixelOffset = Math.ceil((stripCountsOffset + (strips > 1 ? strips * 4 : 0)) / 4) * 4;
    const byteLength = pixelOffset + width * height * 3;
    if (!Number.isSafeInteger(byteLength) || byteLength > 0xffffffff)
      fail('TIFF_CAPACITY', 'TIFF export exceeds the classic TIFF file capacity.');
    return {width, height, rowsPerStrip, strips, bitsOffset, xResolutionOffset,
      yResolutionOffset, stripOffsetsOffset, stripCountsOffset, pixelOffset, byteLength};
  }

  function estimateBytes(options) { return geometry(options).byteLength; }
  function gcd(a, b) { while (b) { const next = a % b; a = b; b = next; } return a; }
  function prepare(options) {
    const layout = geometry(options), {data} = options;
    const type = Object.prototype.toString.call(data);
    if (!ArrayBuffer.isView(data) || !['[object Uint8Array]', '[object Uint8ClampedArray]'].includes(type)
        || data.length !== layout.width * layout.height * 4)
      fail('TIFF_PIXELS', 'TIFF requires one RGBA byte tuple per pixel.');
    const dpi = options.dpi === undefined ? 600 : options.dpi;
    if (typeof dpi !== 'number' || !Number.isFinite(dpi) || dpi <= 0 || dpi > 65535)
      fail('TIFF_DPI', 'TIFF resolution must be a positive finite number no greater than 65535 dpi.');
    // Preserve fractional dpi to one thousandth; the editor normally supplies integer dpi.
    const numerator = Math.round(dpi * 1000), divisor = gcd(numerator, 1000);
    if (!numerator) fail('TIFF_DPI', 'TIFF resolution must be at least 0.001 dpi.');
    let bytes;
    try { bytes = new Uint8Array(layout.byteLength); }
    catch (_) { fail('TIFF_CAPACITY', 'Not enough memory for this TIFF export. Export SVG instead.'); }
    const view = new DataView(bytes.buffer);
    bytes[0] = 0x49; bytes[1] = 0x49; view.setUint16(2, 42, true); view.setUint32(4, 8, true);
    view.setUint16(8, TAG_COUNT, true);
    let entry = 10;
    function tag(id, type, count, value) {
      view.setUint16(entry, id, true); view.setUint16(entry + 2, type, true);
      view.setUint32(entry + 4, count, true);
      if (type === 3 && count === 1) view.setUint16(entry + 8, value, true);
      else view.setUint32(entry + 8, value, true);
      entry += 12;
    }
    tag(256, 4, 1, layout.width);
    tag(257, 4, 1, layout.height);
    tag(258, 3, 3, layout.bitsOffset);
    tag(259, 3, 1, 1); // Compression: none, retaining every output pixel.
    tag(262, 3, 1, 2); // PhotometricInterpretation: RGB.
    tag(273, 4, layout.strips, layout.strips === 1 ? layout.pixelOffset : layout.stripOffsetsOffset);
    tag(274, 3, 1, 1); // Orientation: top left.
    tag(277, 3, 1, 3);
    tag(278, 4, 1, layout.rowsPerStrip);
    tag(279, 4, layout.strips, layout.strips === 1 ? layout.width * layout.height * 3 : layout.stripCountsOffset);
    tag(282, 5, 1, layout.xResolutionOffset);
    tag(283, 5, 1, layout.yResolutionOffset);
    tag(284, 3, 1, 1); // PlanarConfiguration: interleaved samples.
    tag(296, 3, 1, 2); // ResolutionUnit: inches.
    view.setUint32(entry, 0, true); // No subsequent image directory.
    for (let i = 0; i < 3; i++) view.setUint16(layout.bitsOffset + i * 2, 8, true);
    for (const offset of [layout.xResolutionOffset, layout.yResolutionOffset]) {
      view.setUint32(offset, numerator / divisor, true); view.setUint32(offset + 4, 1000 / divisor, true);
    }
    if (layout.strips > 1) for (let strip = 0; strip < layout.strips; strip++) {
      const firstRow = strip * layout.rowsPerStrip;
      view.setUint32(layout.stripOffsetsOffset + strip * 4, layout.pixelOffset + firstRow * layout.width * 3, true);
      view.setUint32(layout.stripCountsOffset + strip * 4, Math.min(layout.rowsPerStrip, layout.height - firstRow) * layout.width * 3, true);
    }
    return {layout, bytes, data};
  }

  function writeRow(job, row) {
    const {width, pixelOffset} = job.layout, {data, bytes} = job;
    let input = row * width * 4, output = pixelOffset + row * width * 3;
    for (let col = 0; col < width; col++, input += 4) {
      const alpha = data[input + 3];
      if (alpha === 255) {
        bytes[output++] = data[input]; bytes[output++] = data[input + 1]; bytes[output++] = data[input + 2];
      } else {
        const white = 255 * (255 - alpha);
        for (let channel = 0; channel < 3; channel++)
          bytes[output++] = Math.floor((data[input + channel] * alpha + white + 127) / 255);
      }
    }
  }

  function encode(options) {
    const job = prepare(options);
    for (let row = 0; row < job.layout.height; row++) writeRow(job, row);
    return job.bytes;
  }

  async function encodeAsync(options) {
    const job = prepare(options), progress = typeof options.onProgress === 'function' ? options.onProgress : null;
    const now = typeof performance !== 'undefined' && typeof performance.now === 'function' ? () => performance.now() : () => Date.now();
    if (progress) progress(0);
    // Let the status/progress indicator paint before starting the pixel work.
    await new Promise(resolve => setTimeout(resolve, 0));
    let batchStart = now(), batchRows = 0;
    for (let row = 0; row < job.layout.height; row++) {
      writeRow(job, row); batchRows++;
      if (row + 1 < job.layout.height && (batchRows >= 256 || now() - batchStart >= 16)) {
        if (progress) progress((row + 1) / job.layout.height);
        await new Promise(resolve => setTimeout(resolve, 0));
        batchStart = now(); batchRows = 0;
      }
    }
    if (progress) progress(1);
    return job.bytes;
  }

  return Object.freeze({encode, encodeAsync, estimateBytes, MAX_PIXELS, MAX_DIMENSION});
});
