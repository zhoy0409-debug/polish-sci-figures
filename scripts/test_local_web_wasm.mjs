/* Actual offline WASM dispatcher smoke tests; no browser automation. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.cache/local-web-preview');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'engine-manifest.json'), 'utf8'));
let networkRequests = 0;
globalThis.fetch = async () => { networkRequests++; throw new Error('Network prohibited throughout offline dispatcher test'); };
const checks = [], started = performance.now();
for (const file of manifest.files) {
  const data = fs.readFileSync(path.join(output, file.path));
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), file.sha256, file.path);
}
const {loadPyodide} = await import(pathToFileURL(path.join(output, 'runtime/pyodide.mjs')));
const py = await loadPyodide({indexURL: path.join(output, 'runtime') + path.sep, stdout() {}, stderr() {}});
await py.loadPackage(manifest.runtime.packages);
for (const source of manifest.pythonSources) {
  py.FS.mkdirTree(path.posix.dirname(source.destination));
  py.FS.writeFile(source.destination, fs.readFileSync(path.join(output, source.path)));
}
await py.runPythonAsync(fs.readFileSync(path.join(output, 'engine-bootstrap.py'), 'utf8'));
const initializationMs = performance.now() - started;
const progress = [];
globalThis._studio_progress = encoded => progress.push(JSON.parse(encoded));
async function dispatch(endpoint, body) {
  const before = JSON.stringify(body);
  py.globals.set('_test_endpoint', endpoint); py.globals.set('_test_payload', before);
  const result = JSON.parse(await py.runPythonAsync('_studio_dispatch(_test_endpoint, _test_payload)'));
  assert.equal(JSON.stringify(body), before, 'JS source input must be unchanged');
  py.globals.delete('_test_endpoint'); py.globals.delete('_test_payload');
  return result;
}
const rows = [['group', 'unit', 'value'], ...[1, 2, 4, 5, 8].map((v, i) => ['A', 'A' + i, String(v)]), ...[2, 4, 6, 9, 11, 14].map((v, i) => ['B', 'B' + i, String(v)])];
const config = {mode: 'raw', group: 'group', value: 'value', unit: 'unit', design: 'independent', method: 'welch', family: 'all_pairs', design_confirmed: true, unit_role: 'independent_experimental_unit'};
let t = performance.now();
const analyzed = await dispatch('/api/analyze', {recipe: {}, rows, config});
assert.equal(analyzed.status, 200, JSON.stringify(analyzed.body));
const p = analyzed.body.analysis.primary_test.pairwise[0].p;
assert.ok(Math.abs(p - 0.13380466116494624) < 1e-12);
checks.push({name: 'Welch analysis same numerical result', passed: true, p, ms: performance.now() - t});
const recipe = {family: 'gallery', parameters: {view: 'compare_bar_points'}, font: 'Arial'};
t = performance.now();
const render = await dispatch('/api/render', {recipe, rows, statistics: config});
assert.equal(render.status, 200, JSON.stringify(render.body));
assert.ok(render.body.panel.variants.length >= 1); assert.ok(render.body.panel.variants[0].svg.includes('<svg'));
assert.equal(render.body.panel.recipe.font, 'Arial');
assert.equal(render.body.warnings[0].code, 'browser_font_fallback');
checks.push({name: 'Existing renderer and explicit font fallback', passed: true, variants: render.body.panel.variants.length, ms: performance.now() - t});
t = performance.now();
const reflow = await dispatch('/api/reflow', {recipe, rows, width: 400, height: 300});
assert.equal(reflow.status, 200, JSON.stringify(reflow.body));
assert.equal(reflow.body.variant.width, 400); assert.equal(reflow.body.variant.height, 300);
checks.push({name: 'Physical-size reflow', passed: true, ms: performance.now() - t});
t = performance.now();
const chineseRows = rows.map(row => row.map(value => value === 'A' ? '对照组' : value === 'B' ? '处理组' : value));
const cjk = await dispatch('/api/reflow', {recipe, rows: chineseRows, width: 400, height: 300});
assert.equal(cjk.status, 200, JSON.stringify(cjk.body));
assert.ok(cjk.body.variant.svg.includes('对照组') && cjk.body.variant.svg.includes('处理组'));
checks.push({name: 'CJK labels preserved as editable SVG text (not visual font validation)', passed: true, ms: performance.now() - t});
t = performance.now();
const facetRows = [['factor', ...rows[0]], ...['Day 1', 'Day 7'].flatMap(factor => rows.slice(1).map(row => [factor, ...row]))];
const split = await dispatch('/api/split-facets', {recipe: {...recipe, parameters: {view: 'compare_facet_boxes'}}, rows: facetRows});
assert.equal(split.status, 200, JSON.stringify(split.body)); assert.equal(split.body.panels.length, 2);
assert.ok(split.body.panels.every(item => item.panel.recipe.font === 'Arial'));
checks.push({name: 'Two independent facet panels with provenance', passed: true, ms: performance.now() - t});
const fixtures = await py.runPythonAsync(`
import random, io, base64
from PIL import Image, ImageDraw, ImageOps
def _fixture(seed):
    rng = random.Random(seed)
    image = Image.new('RGB', (420, 320), (20, 18, 24))
    draw = ImageDraw.Draw(image)
    for index in range(160):
        x, y, r = rng.randrange(15, 400), rng.randrange(15, 300), rng.randrange(3, 13)
        color = tuple(rng.randrange(60, 240) for _ in range(3))
        draw.ellipse((x-r, y-r, x+r, y+r), fill=color, outline=(255, 255, 255))
        draw.line((x-r, y, x+r, y+r), fill=(30, 30, 40), width=2)
    return image
def _item(name, image):
    data = io.BytesIO(); image.save(data, format='PNG')
    return dict(id=name, label=name, data='data:image/png;base64,'+base64.b64encode(data.getvalue()).decode())
original = _fixture(18731)
json.dumps([_item('original', original), _item('copy', original), _item('crop_flip', ImageOps.mirror(original.crop((50, 30, 380, 290))).resize((380, 300))), _item('unrelated', _fixture(82))])
`);
t = performance.now();
const duplicate = await dispatch('/api/image-duplicates', {images: JSON.parse(fixtures)});
assert.equal(duplicate.status, 200, JSON.stringify(duplicate.body));
assert.equal(duplicate.body.matches.length, 3); assert.ok(!duplicate.body.matches.some(pair => pair.a === 'unrelated' || pair.b === 'unrelated'));
assert.ok(progress.some(item => item.stage === 'pairs' && item.total === 6));
checks.push({name: 'Exact + mirrored crop duplicate detection and progress', passed: true, matches: duplicate.body.matches.map(({a, b, kind}) => ({a, b, kind})), ms: performance.now() - t});
const depthFixtures = await py.runPythonAsync(`
import numpy as np
_yy, _xx = np.indices((80, 96))
_intensity = (_yy * 111 + _xx * 17).astype(np.uint16)
json.dumps([_item('depth-original', Image.fromarray(_intensity)), _item('depth-copy', Image.fromarray(_intensity)), _item('depth-different', Image.fromarray(_intensity * 2))])
`);
t = performance.now();
const depth = await dispatch('/api/image-duplicates', {images: JSON.parse(depthFixtures)});
assert.equal(depth.status, 200, JSON.stringify(depth.body));
assert.ok(depth.body.matches.some(pair => pair.a === 'depth-original' && pair.b === 'depth-copy' && pair.kind === 'exact'));
assert.ok(!depth.body.matches.some(pair => pair.b === 'depth-different' && pair.kind === 'exact'));
assert.notEqual(depth.body.images[0].sha256, depth.body.images[2].sha256);
checks.push({name: 'Native 16-bit intensity identity preserved despite equivalent mapped previews', passed: true, ms: performance.now() - t});
assert.equal((await dispatch('/api/analyze', {recipe: {}, rows, config, code: 'raise Exception()'})).status, 422);
assert.equal((await dispatch('/api/image-duplicates', {images: [{id: 'x', label: 'x', data: 'https://example.com/private'}, {id: 'y', label: 'y', data: 'file:///tmp/test'}]})).status, 422);
checks.push({name: 'Rejected extra executable fields and non-raster image paths', passed: true});
assert.equal(networkRequests, 0);
const report = {passed: true, host: 'Node ' + process.version + ' / ' + process.platform, browserTest: false, networkRequests, initializationMs, totalMs: performance.now() - started, wasmHeapBytes: py._module.HEAP8.length, nodeMemory: process.memoryUsage(), checks};
fs.mkdirSync(path.join(root, '.cache/local-web-qa'), {recursive: true});
fs.writeFileSync(path.join(root, '.cache/local-web-qa/wasm-dispatcher.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
