/* Fixed synthetic tests. Invoked only by a DEBUG build on an iOS simulator. */
void (async function () {
  const checks = [], started = performance.now();
  let activeStage = 'Editor startup';
  const native = body => window.webkit.messageHandlers.figureStudioNative.postMessage(body);
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const wait = async (test, timeout = 15000) => {
    const end = performance.now() + timeout;
    while (performance.now() < end) { if (await test()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error('Timed out: ' + test.toString().slice(0, 100));
  };
  async function check(name, fn) {
    activeStage = name; await native({action: 'smokeStage', stage: name});
    const before = performance.now(); const details = await fn();
    checks.push({name, passed: true, ms: Math.round(performance.now() - before), ...(details || {})});
  }
  async function editorPaintReady() {
    const visible = node => {
      if (!node) return false;
      const box = node.getBoundingClientRect(), style = getComputedStyle(node);
      return box.width > 1 && box.height > 1 && box.right > 0 && box.bottom > 0 && box.left < innerWidth && box.top < innerHeight && style.visibility !== 'hidden' && style.display !== 'none';
    };
    // render() creates SVG before asynchronous startup has finished installing
    // mobile controls. A DOM guide alone is not proof of a usable painted UI.
    await wait(() => !document.body.inert && document.body.classList.contains('studio-mobile') && document.body.dataset.mobileTab === 'canvas' && visible(document.getElementById('mobileTab-canvas')) && visible(document.getElementById('mobilePan')) && visible(document.querySelector('#artboard svg')) && document.fonts.status === 'loaded');
    // Observe the final mobile layout without clicking Fit, changing zoom, or
    // rendering on the application's behalf. A visible 10%-sized SVG can still
    // be stale from the pre-mobile layout, especially after process restart.
    const measure = () => {
      const viewport = document.getElementById('viewport'), css = getComputedStyle(viewport);
      const canvas = document.querySelector('#artboard svg').getBoundingClientRect();
      const contentWidth = viewport.clientWidth - (parseFloat(css.paddingLeft) || 0) - (parseFloat(css.paddingRight) || 0);
      const contentHeight = viewport.clientHeight - (parseFloat(css.paddingTop) || 0) - (parseFloat(css.paddingBottom) || 0);
      // Publication dimensions are shown in mm; CSS's physical inch is 96 px.
      // Their 0.01-mm display rounding is well below the 1.5-px tolerance.
      const width = Number(document.getElementById('exportWidth').value) * 96 / 25.4;
      const height = Number(document.getElementById('exportHeight').value) * 96 / 25.4;
      const expectedFit = Math.max(.1, Math.min(1, contentWidth / width, contentHeight / height));
      return {viewportWidth: viewport.clientWidth, viewportHeight: viewport.clientHeight,
        viewportContentWidth: contentWidth, viewportContentHeight: contentHeight,
        canvasWidth: canvas.width, canvasHeight: canvas.height, publicationWidthPx: width,
        publicationHeightPx: height, zoomMode: document.getElementById('zoom').value,
        actualFitX: canvas.width / width, actualFitY: canvas.height / height, expectedFit};
    };
    let latest, previous, stable = 0, ready = false;
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline) {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      latest = measure();
      const finite = Object.values(latest).every(value => typeof value !== 'number' || Number.isFinite(value));
      const dimensions = ['viewportContentWidth', 'viewportContentHeight', 'canvasWidth', 'canvasHeight'];
      const unchanged = previous && dimensions.every(key => Math.abs(latest[key] - previous[key]) < .5);
      stable = unchanged ? stable + 1 : 0;
      const fitted = latest.zoomMode === 'fit' && latest.viewportContentWidth > 0 && latest.viewportContentHeight > 0 &&
        Math.abs(latest.canvasWidth - latest.publicationWidthPx * latest.expectedFit) <= 1.5 &&
        Math.abs(latest.canvasHeight - latest.publicationHeightPx * latest.expectedFit) <= 1.5;
      if (finite && fitted && stable >= 3) { ready = true; break; }
      previous = latest;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, 'Canvas did not fit the stable mobile viewport: ' + JSON.stringify(latest));
    return {mobileControlsVisible: true, ...latest, layoutStableSamples: stable + 1,
      canvasTab: document.getElementById('mobileTab-canvas').textContent, language: document.documentElement.lang, fontsReady: true};
  }
  try {
    await wait(() => document.querySelector('#artboard svg [data-panel]') && typeof StudioLibrary !== 'undefined');
    await check('Mobile editor initialization and visual frame are ready', editorPaintReady);
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
      await check('Forbidden-origin listener receives zero requests; loopback POST rejected', async () => {
        // A real, reachable second loopback listener avoids a false pass from
        // an unresolvable public hostname. No research data is used or sent.
        const probe = await native({action: 'smokeStartNetworkProbe'});
        let remoteRejected = false;
        try { await fetch(probe.url, {signal: AbortSignal.timeout(5000)}); } catch (_) { remoteRejected = true; }
        assert(remoteRejected, 'Remote access was not blocked');
        await new Promise(resolve => setTimeout(resolve, 300));
        const counters = await native({action: 'smokeFinishNetworkProbe'});
        assert(counters.requests === 0, 'Forbidden-origin request reached another listener');
        const response = await fetch('/api/analyze', {method: 'POST', body: '{}'});
        assert(response.status === 405, 'Loopback server accepts POST');
        return {remoteRejected, forbiddenOriginRequests: counters.requests, loopbackPostStatus: response.status};
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
        assert(result.pickerClosedBeforeReply === true, 'Cancel resolved before the native picker closed');
        return {cancelled: true, bytesStreamed: bytes.length, nativePicker: true, pickerClosedBeforeReply: true, fileSaveSuccessTested: false};
      });
      await check('Actual project Save and Files reimport preserve the edited project', async () => {
        const prior = JSON.parse(localStorage.getItem('ios-simulator-smoke'));
        document.getElementById('save').click(); // Real application save handler and native picker.
        let saved;
        await wait(async () => {
          saved = await native({action: 'smokeLastExport'});
          if (saved.error) throw new Error(saved.error);
          return saved.saved === true && saved.pickerClosedBeforeReply === true;
        }, 60000);
        // XCTest explicitly selects and asserts the native On My iPhone/iPad
        // location. A valid on-device root need not be inside this app's own
        // Documents folder; a file URL alone cannot identify a cloud provider.
        assert(saved.coordinatedReadback === true && saved.name === 'figure-studio-project.json', 'The native provider did not return the saved project');
        document.getElementById('addHorizontalGuide').click();
        let extraGuide;
        await wait(async () => {
          const current = await StudioLibrary.get('autosaves', prior.projectId);
          extraGuide = current?.payload.state.alignmentGuides.find(guide => guide.id !== prior.guideId);
          return !!extraGuide;
        });
        const input = document.getElementById('projectFile');
        let imported, importError;
        const capture = async () => {
          try {
            const file = input.files[0]; if (!file) return;
            await native({action: 'smokeStage', stage: 'Actual Files input change delivered the selected project'});
            const bytes = await file.arrayBuffer();
            const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');
            imported = {name: file.name, bytes: bytes.byteLength, sha256};
          } catch (error) { importError = error; }
        };
        input.addEventListener('change', capture, true);
        // A real user gesture is needed for WKWebView's standard file input.
        // XCTest taps this fixed test affordance, which invokes the existing
        // Open handler; no File object or application payload is injected.
        const open = document.createElement('button');
        open.textContent = 'Open saved project'; open.id = 'ios-smoke-open-project';
        open.style.cssText = 'position:fixed;bottom:80px;left:20px;z-index:999999;padding:16px;background:white;color:black;border:2px solid black';
        open.onclick = () => document.getElementById('load').click();
        document.body.append(open);
        try {
          await wait(() => { if (importError) throw importError; return imported; }, 90000);
          assert(imported.name === saved.name && imported.bytes === saved.bytes && imported.sha256 === saved.sha256, 'Files reimport bytes differ from the actual saved file');
          await wait(async () => {
            const current = await StudioLibrary.get('autosaves', prior.projectId);
            const guides = current?.payload.state.alignmentGuides;
            return guides?.length === 1 && guides[0].id === prior.guideId && !document.querySelector('[data-alignment-guide="' + extraGuide.id + '"]');
          }, 30000);
          return {fileSaveSuccessTested: true, fileInputReimportTested: true, nativeConfirmationAccepted: true, pickerClosedBeforeReply: true, localDestination: true, localDestinationEvidence: 'Native XCTest selects and asserts On My iPhone/iPad, with screenshot', destinationURL: saved.destinationURL, coordinatedReadback: saved.coordinatedReadback, bytes: saved.bytes, sha256: saved.sha256, originalGuideRestored: true, laterEditRemoved: true};
        } finally { input.removeEventListener('change', capture, true); open.remove(); }
      });
    }
    await check('Final canvas and mobile controls are ready for screenshot', editorPaintReady);
    await native({action: 'smokeComplete', report: {passed: true, userAgent: navigator.userAgent, width: innerWidth, height: innerHeight, totalMs: Math.round(performance.now() - started), checks}});
  } catch (error) {
    await native({action: 'smokeComplete', report: {passed: false, activeStage, error: String(error), stack: String(error.stack || ''), checks}});
  }
})();
