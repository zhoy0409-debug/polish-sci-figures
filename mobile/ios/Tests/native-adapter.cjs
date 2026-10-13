'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Resources/native-adapter.js'), 'utf8');
const controllerSource = fs.readFileSync(path.join(__dirname, '../Sources/StudioViewController.swift'), 'utf8').replace(/\r\n/g, '\n');

function nativeSection(start, end) {
  const from = controllerSource.indexOf(start), to = controllerSource.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing native source boundary: ${start}`);
  return controllerSource.slice(from, to);
}

function checkModalAccessibilityBoundaries() {
  const isolate = nativeSection('private func isolateModalAccessibility', 'private func restoreModalAccessibility');
  assert.match(isolate, /ObjectIdentifier\(controller\)/, 'One modal must not release another modal isolation');
  assert.match(isolate, /previousWebAccessibilityHidden = webView\.accessibilityElementsHidden/);
  assert.match(isolate, /webView\.accessibilityElementsHidden = true/);
  assert.match(isolate, /controller\.view\.accessibilityViewIsModal = true/);
  assert.doesNotMatch(controllerSource, /\bview\.accessibilityElementsHidden\s*=/, 'Never hide the root that also contains the native dialog');
  assert.doesNotMatch(isolate, /isUserInteractionEnabled|\.isHidden\s*=|\.alpha\s*=/, 'Accessibility isolation must not change visual/touch interaction');
  const restore = nativeSection('private func restoreModalAccessibility', 'private func dismissAccessibleModal');
  assert.match(restore, /removeValue\(forKey: ObjectIdentifier\(controller\)\)/);
  assert.match(restore, /guard modalAccessibilityStates\.isEmpty else \{ return \}/);
  assert.match(restore, /webView\.accessibilityElementsHidden = previousWebAccessibilityHidden \?\? false/);
  assert.match(restore, /UIAccessibility\.post\(notification: \.screenChanged, argument: nil\)/);
  const dismiss = nativeSection('private func dismissAccessibleModal', 'private func showError');
  assert.match(dismiss, /guard !completed else \{ return \}\s*completed = true/, 'UIKit transition and dismiss callbacks cannot reply twice');
  assert.equal((dismiss.match(/guard !continuationClaimed else \{ return \}/g) || []).length, 2, 'An animate(false) fallback and its later callback must share ownership');
  assert.match(dismiss, /dismissAccessibleModal\(controller, completion: finish\)/, 'Recursive dismissal shares the once-only completion');
  assert.match(dismiss, /controller\.transitionCoordinator/);
  assert.match(dismiss, /controller\.dismiss\(animated: false, completion: finish\)/);
  assert.ok(dismiss.indexOf('completion()\n            self?.restoreModalAccessibility') >= 0, 'Resume synchronous JavaScript before exposing its accessibility tree');
  const confirm = nativeSection('runJavaScriptConfirmPanelWithMessage', 'func webView(_ webView: WKWebView, didFinish');
  assert.match(confirm, /isolateModalAccessibility\(dialog\)/);
  assert.match(confirm, /dismissAccessibleModal\(dialog, completion: complete\)/);
  assert.match(confirm, /dismissJavaScriptDialog = \{ finish\(false\) \}/);
  assert.match(confirm, /else \{ finish\(false\); return \}/, 'Presentation/origin failure resolves through the same restoring path');
  const processExit = nativeSection('func webViewWebContentProcessDidTerminate', 'runJavaScriptConfirmPanelWithMessage');
  assert.match(processExit, /dismissJavaScriptDialog\?\(\)/);
  assert.match(processExit, /if let picker = activeExportPicker \{ dismissAccessibleModal\(picker\) \}/);
  const reload = nativeSection('@objc private func reloadEditor', 'func webView(_ webView: WKWebView, decidePolicyFor');
  assert.match(reload, /dismissJavaScriptDialog\?\(\)/);
  assert.match(reload, /completeExport\(cancelled: true\)/);
  const exportEnd = nativeSection('private func finishExportAfterDismissal', 'private func recordSmokeProgress');
  assert.match(exportEnd, /guard closed else \{\s*dismissAccessibleModal\(picker\)/, 'A dismissal failure must finish closing before restoring');
  assert.match(exportEnd, /restoreModalAccessibility\(picker\)[\s\S]*callback\?\(response, nil\)/);
  assert.match(controllerSource, /"backgroundAccessibilityRestored": modalAccessibilityStates\.isEmpty && previousWebAccessibilityHidden == nil && !webView\.accessibilityElementsHidden/, 'Both actual simulator flows verify the final accessibility state');
}

function adapter(options = {}) {
  const calls = [], received = [];
  let expected = 0, index = 0;
  const native = {async postMessage(message) {
    calls.push(message);
    if (message.action === 'begin') { expected = message.bytes; return {id: 'export-1'}; }
    if (message.action === 'chunk') {
      assert.equal(message.index, index++); assert.equal(message.id, 'export-1');
      const bytes = Buffer.from(message.base64, 'base64'); assert.ok(bytes.length <= 256 * 1024);
      if (options.chunkError) throw Error('Disk full');
      received.push(bytes); return {bytes: received.reduce((sum, value) => sum + value.length, 0)};
    }
    if (message.action === 'finish') {
      assert.equal(Buffer.concat(received).length, expected);
      return options.cancel ? {cancelled: true} : {saved: true, name: calls[0].name, bytes: expected};
    }
    if (message.action === 'abort') return {cancelled: true};
    throw Error('Unexpected request');
  }};
  const window = {webkit: {messageHandlers: {figureStudioNative: native}}}; window.top = window;
  vm.runInNewContext(source, {window, Blob, Uint8Array, btoa: value => Buffer.from(value, 'binary').toString('base64'), atob: value => Buffer.from(value, 'base64').toString('binary')});
  return {bridge: window.StudioNativeBridge, calls, received};
}

(async () => {
  checkModalAccessibilityBoundaries();
  const bytes = Buffer.alloc(600001); for (let i = 0; i < bytes.length; i++) bytes[i] = i % 251;
  const saved = adapter();
  assert.equal(saved.bridge.platform, 'ios'); assert.equal(saved.bridge.bundledAssets, true);
  const result = await saved.bridge.saveBlob(new Blob([bytes]), 'real-data.tif');
  assert.equal(result.saved, true); assert.equal(result.bytes, bytes.length);
  assert.equal(saved.calls.filter(call => call.action === 'chunk').length, 3);
  assert.deepEqual(Buffer.concat(saved.received), bytes);
  const cancelled = adapter({cancel: true});
  assert.equal((await cancelled.bridge.saveBlob(new Blob(['test']), 'test.txt')).cancelled, true);
  const failed = adapter({chunkError: true});
  await assert.rejects(failed.bridge.saveBlob(new Blob(['test']), 'test.txt'), /Disk full/);
  assert.equal(failed.calls.at(-1).action, 'abort');
  const base64 = adapter();
  await base64.bridge.saveFile({name: 'image.png', mime: 'image/png', base64: bytes.toString('base64')});
  assert.deepEqual(Buffer.concat(base64.received), bytes);
  await assert.rejects(base64.bridge.saveFile({name: 'bad.txt', base64: 'invalid_='}), /base64/);
  const empty = adapter(); await empty.bridge.saveBlob(new Blob(), 'empty.txt');
  assert.equal(empty.calls.filter(call => call.action === 'chunk').length, 0);
  const locked = adapter(); const pending = locked.bridge.saveBlob(new Blob(['a']), 'one.txt');
  await assert.rejects(locked.bridge.saveBlob(new Blob(['b']), 'two.txt'), /dialog/); await pending;
  const noNative = {top: null}; noNative.top = noNative;
  vm.runInNewContext(source, {window: noNative}); assert.equal(noNative.StudioNativeBridge, undefined);
  new vm.Script(fs.readFileSync(path.join(__dirname, '../Resources/simulator-smoke.js'), 'utf8'));
  console.log('iOS adapter: modal accessibility ownership/restore boundaries, sequential bounded chunks, exact bytes, cancellation, abort, empty files, busy state, base64 and syntax passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
