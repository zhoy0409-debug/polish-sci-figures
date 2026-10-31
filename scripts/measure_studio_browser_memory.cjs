'use strict';
// Isolated production-browser diagnostic. Not native installer acceptance.
const {chromium} = require('playwright');
const {execFileSync} = require('node:child_process');
const H = require('./test_studio_carbon_helpers.cjs');
const {fs, path, assert, sha} = H;

async function run(args) {
  const url = H.localUrl(args.url);
  assert.ok(args.html && args.out && args.label, 'Use --url, --html, --out and --label');
  const htmlHash = sha(fs.readFileSync(path.resolve(args.html)));
  const count = Number(args.elements || 5000);
  assert.ok(Number.isInteger(count) && count >= 2 && count <= 10000);
  const output = path.resolve(args.out);
  assert.ok(!fs.existsSync(output), 'Preserve previous measurements; choose a fresh output');
  const browser = await chromium.launch({channel: 'chrome', headless: true});
  const {context, page, remote, errors} = await H.browserPage(browser);
  const cdp = await context.newCDPSession(page);
  const browserCdp = await browser.newBrowserCDPSession();
  await cdp.send('Performance.enable');
  const report = {
    author: 'a', schema: 'figure-studio-browser-memory/1', label: args.label,
    sourceCommitClaim: args['source-commit'] || null, htmlSha256: htmlHash,
    startedAt: new Date().toISOString(), browser: browser.version(),
    platform: process.platform, elements: count, samples: [],
    scope: 'Own isolated headless Chrome only. No forced garbage collection. Five samples per phase. OS working set and private bytes are sums over that browser CDP process list; PIDs are not retained.',
    limitations: [
      'Observed phase samples are not an absolute process peak or a memory-leak test.',
      'JS heap excludes image buffers, most native DOM memory and the desktop Python engine.',
      'Windows process memory is unavailable on other platforms or if process queries fail.',
      'Not native installed UI, first-install launch, physical low-end hardware or physical display latency.'
    ]
  };
  async function sample(phase) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(200);
      const metrics = new Map((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
      const dom = await cdp.send('Memory.getDOMCounters');
      let processes = null, processMemoryError = null;
      if (process.platform === 'win32') {
        try {
          const ids = (await browserCdp.send('SystemInfo.getProcessInfo')).processInfo.map(p => Number(p.id));
          assert.ok(ids.length && ids.every(id => Number.isSafeInteger(id) && id > 0));
          const script = '$studioProcesses=@(Get-Process -Id ' + ids.join(',') + ' -ErrorAction SilentlyContinue);' +
            '[pscustomobject]@{count=$studioProcesses.Count;workingSetBytes=($studioProcesses|Measure-Object WorkingSet64 -Sum).Sum;privateBytes=($studioProcesses|Measure-Object PrivateMemorySize64 -Sum).Sum}|ConvertTo-Json -Compress';
          processes = JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {encoding: 'utf8', timeout: 5000, windowsHide: true}));
          processes.expectedCount = ids.length;
        } catch (error) { processMemoryError = error.code || error.name; }
      }
      report.samples.push({phase, index: i, jsHeapUsedBytes: metrics.get('JSHeapUsedSize'),
        jsHeapTotalBytes: metrics.get('JSHeapTotalSize'), dom, processes, processMemoryError});
    }
  }
  try {
    // Large self-contained pages can be evicted from the inspector response
    // cache during navigation. Read bytes with the isolated request context.
    const response = await context.request.get(url);
    assert.ok(response.ok());
    assert.equal(sha(await response.body()), htmlHash, 'Served HTML must match the claimed bytes');
    await page.goto(url);
    await H.dismiss(page);
    await H.newProject(page, 'PUBLIC memory diagnostic');
    await sample('empty-project');
    await H.loadSvg(page, H.pressureSvg(count), 'SYNTHETIC-memory.svg');
    assert.equal(await page.locator('#artboard [data-panel] [data-key]').count(), count);
    await sample('imported');
    await page.locator('#artboard text[data-key]').click();
    await sample('selected');
    await page.locator('[data-tab="palette"]').click();
    await sample('palette');
    await page.locator('[data-tab="detail"]').click();
    const saved = await H.save(page);
    await H.loadProject(page, saved, 'PUBLIC-memory-roundtrip.json');
    await sample('reopened');
    const reopened = await H.save(page);
    assert.deepEqual(reopened.project.panels, saved.project.panels, 'Original artwork survives save/reopen');
    const after = await context.request.get(url);
    assert.ok(after.ok());
    assert.equal(sha(await after.body()), htmlHash, 'Served HTML changed during measurement');
    assert.deepEqual(remote, []); assert.deepEqual(errors, []);
    report.remoteRequests = 0; report.pageErrors = 0; report.sourceRoundtripUnchanged = true;
    report.finishedAt = new Date().toISOString(); report.status = 'PASS_VERIFIED_CAPTURE';
  } catch (error) {
    report.status = 'FAIL'; report.error = error.message;
    throw error;
  } finally {
    fs.mkdirSync(path.dirname(output), {recursive: true});
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
    await browser.close();
  }
}

if (require.main === module) {
  const args = Object.fromEntries(process.argv.slice(2).map(item => {
    const split = item.indexOf('=');
    assert.ok(item.startsWith('--') && split > 2, 'Use --name=value');
    return [item.slice(2, split), item.slice(split + 1)];
  }));
  run(args).then(() => console.log('PASS verified browser memory capture'))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
