'use strict';
// Execute the real DEBUG smoke helpers with a clock that can pause JavaScript
// during a native modal. No native click, File or application result is faked
// in the actual simulator test; these unit cases only verify its deadlines.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Resources/simulator-smoke.js'), 'utf8');
const start = source.indexOf('  async function smokeDeadline(');
const end = source.indexOf('  async function check(', start);
assert.ok(start >= 0 && end > start);

function harness({answer = true, modalMs = 0, confirmError} = {}) {
  const clock = {now: 0, next: 0, timers: new Map()};
  const calls = [];
  const original = function (...args) {
    calls.push(args); clock.now += modalMs; // Timers cannot execute inside confirm.
    if (confirmError) throw confirmError;
    return answer;
  };
  const ctx = {Promise, Error, Reflect,
    assert(value, message) { assert.ok(value, message); },
    window: {confirm: original}, performance: {now: () => clock.now},
    setTimeout(fn, delay) { const id = ++clock.next; clock.timers.set(id, {at: clock.now + delay, fn}); return id; },
    clearTimeout(id) { clock.timers.delete(id); }};
  vm.createContext(ctx); vm.runInContext(source.slice(start, end), ctx);
  const listeners = new Map();
  const input = {files: [],
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type) { for (const fn of listeners.get(type) || []) fn(); }};
  const tick = ms => {
    clock.now += ms;
    for (const [id, timer] of [...clock.timers]) if (timer.at <= clock.now) { clock.timers.delete(id); timer.fn(); }
  };
  const flush = async () => { for (let n = 0; n < 12; n++) await Promise.resolve(); };
  const observer = ctx.observeSmokeProjectImport(input, () => Promise.resolve());
  const dispose = () => { observer.dispose(); assert.equal(ctx.window.confirm, original); assert.equal([...listeners.values()].reduce((n, s) => n + s.size, 0), 0); };
  return {ctx, input, clock, calls, original, tick, flush, observer, dispose};
}

async function main() {
  let count = 0;
  // Reproduce the prior iPhone timeline: change at 34 s, native confirmation
  // returns 60 s later. Even delayed microtasks must use the event timestamps.
  {
    const h = harness({modalMs: 60000}), file = {name: 'figure-studio-project.json'};
    const ready = h.observer.ready(); h.tick(34000); h.input.files = [file]; h.input.emit('change');
    assert.equal(h.ctx.window.confirm('Replace this project?'), true);
    assert.equal(await ready, file); assert.equal(h.clock.now, 94000); assert.deepEqual(h.calls, [['Replace this project?']]);
    assert.equal(h.observer.timings.fileSelectionMs, 34000); assert.equal(h.observer.timings.confirmationMs, 60000);
    // The actual byte-read budget starts now, after the actual modal returned.
    const read = h.ctx.smokeDeadline(Promise.resolve('actual-file-read'), 15000, 'read');
    assert.equal(await read, 'actual-file-read'); h.dispose(); count++;
  }
  {
    const h = harness(), failure = assert.rejects(h.observer.ready(), /native Files input selection/);
    h.tick(90000); await failure; h.dispose(); count++;
  }
  for (const event of ['cancel', 'change']) {
    const h = harness(), failure = assert.rejects(h.observer.ready(), /selection was cancelled/);
    h.input.emit(event); await failure; h.dispose(); count++;
  }
  {
    const h = harness({answer: false, modalMs: 5000}), failure = assert.rejects(h.observer.ready(), /not confirmed/);
    h.input.files = [{}]; h.input.emit('change'); assert.equal(h.ctx.window.confirm('Replace?'), false);
    await failure; h.dispose(); count++;
  }
  {
    const h = harness({modalMs: 91000}), failure = assert.rejects(h.observer.ready(), /native project replacement confirmation/);
    h.tick(100); h.input.files = [{}]; h.input.emit('change'); h.ctx.window.confirm('Replace?');
    await failure; h.dispose(); count++;
  }
  {
    const h = harness(), failure = assert.rejects(h.observer.ready(), /native project replacement confirmation/);
    h.input.files = [{}]; h.input.emit('change'); await h.flush(); h.tick(90000);
    await failure; h.dispose(); count++;
  }
  {
    const h = harness(), failure = assert.rejects(h.ctx.smokeDeadline(new Promise(() => {}), 15000, 'selected project byte read and SHA-256'), /byte read and SHA-256/);
    h.tick(15000); await failure; h.dispose(); count++;
  }
  {
    const h = harness(), failure = assert.rejects(h.ctx.smokeDeadline(Promise.reject(new Error('Unreadable actual file')), 15000, 'read'), /Unreadable actual file/);
    await failure; h.dispose(); count++;
  }
  {
    const h = harness({confirmError: new Error('Native confirmation unavailable')}), failure = assert.rejects(h.observer.ready(), /Native confirmation unavailable/);
    h.input.files = [{}]; h.input.emit('change'); assert.throws(() => h.ctx.window.confirm('Replace?'), /Native confirmation unavailable/);
    await failure; h.dispose(); count++;
  }
  const flow = source.slice(source.indexOf("await check('Actual project Save and Files reimport"));
  assert.ok(flow.indexOf('await observer.ready()') < flow.indexOf('await file.arrayBuffer()'));
  for (const evidence of ['imported.name === saved.name', 'imported.bytes === saved.bytes', 'imported.sha256 === saved.sha256', "guides?.length === 1", 'guides[0].id === prior.guideId', 'extraGuide.id', 'observer.dispose()']) assert.ok(flow.includes(evidence), evidence);
  assert.match(flow, /\}, 30000\)/, 'Actual restored-state deadline remains bounded');
  const swift = fs.readFileSync(path.join(__dirname, 'SimulatorTests.swift'), 'utf8');
  for (const evidence of ['continueAfterFailure = false', 'document.tap()', 'confirmFrame', 'app.terminate()', '"--restore"']) assert.ok(swift.includes(evidence), evidence);
  const workflow = fs.readFileSync(path.join(__dirname, '../../../.github/workflows/ios-simulator-preview.yml'), 'utf8');
  assert.match(workflow, /-test-timeouts-enabled YES -default-test-execution-time-allowance 420 -maximum-test-execution-time-allowance 420/);
  new vm.Script(source);
  console.log(`iOS smoke timing: ${count} real-helper scenarios passed; per-stage deadlines, native confirmation delegation, cancellation, read failures, SHA/state/restart assertions retained`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
