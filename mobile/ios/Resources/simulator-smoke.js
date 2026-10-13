/* Fixed synthetic tests. Invoked only by a DEBUG build on an iOS simulator. */
void (async function () {
  const checks = [], started = performance.now();
  const native = body => window.webkit.messageHandlers.figureStudioNative.postMessage(body);
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = async (test, timeout = 15000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('Timed out: ' + test.toString().slice(0, 100));
  };
  async function check(name, fn) {
    const before = performance.now(); const details = await fn();
    checks.push({name, passed: true, ms: Math.round(performance.now() - before), ...(details || {})});
  }
  try {
    await wait(() => document.querySelector('#artboard svg [data-panel]') && typeof StudioLibrary !== 'undefined');
    assert(window.StudioNativeBridge?.bundledAssets && StudioNativeBridge.platform === 'ios', 'Early native adapter absent');
    if (window.__studioSimulatorRestore) {
      await check('Editor autosave restored after app process restart', async () => {
        const prior = JSON.parse(localStorage.getItem('ios-simulator-smoke') || 'null');
        assert(prior?.origin === location.origin, 'Origin changed across restart');
        const record = await StudioLibrary.get('autosaves', prior.projectId);
        assert(record?.payload.state.alignmentGuides.some(guide => guide.id === prior.guideId), 'IndexedDB project missing');
        await wait(() => document.querySelector('[data-alignment-guide="' + prior.guideId + '"]'));
        assert(record.payload.history, 'Undo history missing');
        return {origin: location.origin, projectId: prior.projectId, guideId: prior.guideId, undoHistory: true};
      });
    } else {
      await check('Native bridge loaded before offline setup', async () => {
        const registrations = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
        assert(registrations.length === 0, 'Bundled app should not install a service worker');
        return {native: StudioNativeBridge.platform, secureContext: isSecureContext, worker: typeof Worker, wasm: typeof WebAssembly};
      });
      await check('Fresh simulator test profile saves a real editor change', async () => {
        const records = await StudioLibrary.list('autosaves');
        // Startup itself autosaves the empty starter. Permit only that untouched
        // blank project; never replace an existing edited project in this profile.
        assert(!localStorage.getItem('ios-simulator-smoke') && records.length <= 1 && records.every(item => item.payload?.project.desktopStarter === true && !item.payload?.state.alignmentGuides?.length && item.payload?.project.panels.every(panel => panel.provenance === 'blank-canvas')), 'Use a fresh simulator test profile; existing edited records are never cleared');
        document.getElementById('addHorizontalGuide').click();
        let saved;
        await wait(async () => { const all = await StudioLibrary.list('autosaves'); saved = all.find(item => item.payload?.state.alignmentGuides?.length); return !!saved; });
        const guideId = saved.payload.state.alignmentGuides[0].id;
        localStorage.setItem('ios-simulator-smoke', JSON.stringify({origin: location.origin, projectId: saved.id, guideId}));
        return {projectId: saved.id, guideId, actualEditorAutosave: true};
      });
      await check('Remote fetch rejected; loopback POST rejected', async () => {
        let remoteRejected = false;
        try { await fetch('https://example.invalid/figure-studio-network-test', {signal: AbortSignal.timeout(5000)}); } catch (_) { remoteRejected = true; }
        assert(remoteRejected, 'Remote access was not blocked');
        const response = await fetch('/api/analyze', {method: 'POST', body: '{}'});
        assert(response.status === 405, 'Loopback server accepts POST');
        return {remoteRejected, loopbackPostStatus: response.status};
      });
      const engine = StudioBrowserEngine;
      await check('Bundled Python/WASM worker initializes in WKWebView', async () => { await engine.ready(); return {status: engine.status()}; });
      const rows = [['group', 'unit', 'value'], ...[1, 2, 4, 5, 8].map((v, i) => ['A', 'A' + i, String(v)]), ...[2, 4, 6, 9, 11, 14].map((v, i) => ['B', 'B' + i, String(v)])];
      const config = {mode: 'raw', group: 'group', value: 'value', unit: 'unit', design: 'independent', method: 'welch', family: 'all_pairs', design_confirmed: true, unit_role: 'independent_experimental_unit'};
      const request = async (url, value) => {
        const response = await engine.fetch(url, {method: 'POST', body: JSON.stringify(value)});
        const body = await response.json(); assert(response.ok, JSON.stringify(body)); return body;
      };
      await check('Welch calculation agrees with native reference', async () => {
        const result = await request('/api/analyze', {recipe: {}, rows, config});
        const p = result.analysis.primary_test.pairwise[0].p;
        assert(Math.abs(p - 0.13380466116494624) < 1e-12, 'Welch result differs'); return {p};
      });
      await check('Tied Mann–Whitney permutation path works on bundled SciPy', async () => {
        const tied = [['group', 'unit', 'value'], ...[1, 1, 2].map((v, i) => ['A', 'A' + i, String(v)]), ...[2, 3, 3].map((v, i) => ['B', 'B' + i, String(v)])];
        const result = await request('/api/analyze', {recipe: {}, rows: tied, config: {...config, method: 'mannwhitney'}});
        const p = result.analysis.primary_test.pairwise[0].p;
        assert(Math.abs(p - .2) < 1e-12, 'Mann–Whitney result differs'); return {p};
      });
      await check('Matplotlib generates editable SVG locally', async () => {
        const recipe = {family: 'gallery', parameters: {view: 'compare_bar_points'}, font: 'DejaVu Sans'};
        const result = await request('/api/reflow', {recipe, rows, width: 400, height: 300});
        const svg = result.variant.svg;
        assert(svg.includes('<svg') && svg.includes('<text'), 'No editable SVG text');
        return {width: result.variant.width, height: result.variant.height, svgBytes: new TextEncoder().encode(svg).length};
      });
      await check('Local image duplicate scan and evidence', async () => {
        const canvas = document.createElement('canvas'); canvas.width = 280; canvas.height = 210;
        const ctx = canvas.getContext('2d'); let seed = 18731;
        const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
        ctx.fillStyle = '#16111d'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 100; i++) { ctx.fillStyle = `rgb(${60 + random() * 180},${60 + random() * 180},${60 + random() * 180})`; ctx.beginPath(); ctx.arc(random() * 270, random() * 200, 2 + random() * 9, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.stroke(); }
        const data = canvas.toDataURL('image/png');
        const start = await request('/api/image-duplicates', {action: 'start', images: [{id: 'synthetic-A', label: 'Synthetic A', data}, {id: 'synthetic-copy', label: 'Synthetic copy', data}]});
        let finished;
        await wait(async () => { finished = await request('/api/image-duplicates', {action: 'status', jobId: start.jobId}); if (finished.status === 'error') throw new Error(finished.error); return finished.status === 'complete'; }, 120000);
        assert(finished.result.matches.length === 1 && finished.result.matches[0].kind === 'exact', 'Exact duplicate not detected');
        assert(finished.result.matches[0].evidence?.startsWith('data:image/png'), 'No evidence PNG');
        return {matches: 1, exactCopyOnly: true};
      });
      await check('Actual iOS Files export picker cancellation reaches JS', async () => {
        // XCTest taps the real native Cancel button. The native file remains private and is deleted.
        const bytes = new Uint8Array(600001); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
        const result = await StudioNativeBridge.saveBlob(new Blob([bytes], {type: 'application/octet-stream'}), 'synthetic-ios-export.bin');
        assert(result.cancelled === true && !result.saved, 'Cancel was incorrectly reported as saved');
        return {cancelled: true, bytesStreamed: bytes.length, nativePicker: true, fileSaveSuccessTested: false};
      });
    }
    await native({action: 'smokeComplete', report: {passed: true, userAgent: navigator.userAgent, width: innerWidth, height: innerHeight, totalMs: Math.round(performance.now() - started), checks}});
  } catch (error) {
    await native({action: 'smokeComplete', report: {passed: false, error: String(error.stack || error), checks}});
  }
})();
