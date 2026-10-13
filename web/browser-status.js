/* Browser-preview setup is separate from desktop installation and project data. */
(function () {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const engine = window.StudioBrowserEngine, offline = window.StudioBrowserOffline;
    const viewport = document.getElementById('viewport');
    if (!engine || !offline || !viewport) return;
    const T = (en, zh) => document.documentElement.lang.startsWith('zh') ? zh : en;
    const region = document.createElement('div');
    region.id = 'browserEngineStatus';
    region.className = 'browser-engine-status';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    const message = document.createElement('span');
    const warning = document.createElement('small');
    warning.id = 'browserRenderingWarning';
    const warningDetails = document.createElement('details');
    const warningSummary = document.createElement('summary');
    warningDetails.hidden = true;
    warningDetails.append(warningSummary, warning);
    const text = document.createElement('div');
    text.append(message, warningDetails);
    const prepare = document.createElement('button');
    prepare.id = 'prepareBrowserOffline';
    prepare.type = 'button';
    region.append(text, prepare);
    viewport.before(region);
    let engineState = engine.status(), offlineState = offline.status();
    function render() {
      const loading = engineState.phase === 'loading', installing = offlineState.phase === 'installing';
      region.dataset.busy = String(loading || installing);
      region.setAttribute('aria-live', loading || installing || engineState.busy ? 'off' : 'polite');
      prepare.disabled = installing || !offlineState.supported;
      prepare.hidden = offlineState.bundled === true;
      prepare.textContent = T(installing ? 'Preparing…' : offlineState.phase === 'ready' ? 'Check offline files' : 'Make available offline', installing ? '正在准备…' : offlineState.phase === 'ready' ? '检查离线文件' : '准备离线使用');
      const seconds = Math.floor((engineState.elapsedMs || 0) / 1000);
      const elapsed = seconds > 1 ? ` · ${seconds} s` : '';
      region.dataset.lastCalculationMs = String(engineState.lastDurationMs ?? '');
      region.dataset.lastInitializationMs = String(engineState.lastInitializationMs ?? '');
      warning.textContent = (engineState.lastWarnings || []).map(item => T(item.en || '', item.zh || '')).filter(Boolean).join(' ');
      warningDetails.hidden = !warning.textContent;
      warningSummary.textContent = T('Preview font substitution', '预览字体替代说明');
      if (installing) message.textContent = T(`Saving app files ${offlineState.completed} / ${offlineState.total || '…'}. Research data stays here.`, `正在保存程序文件 ${offlineState.completed} / ${offlineState.total || '…'}，研究数据留在设备内。`);
      else if (offlineState.phase === 'error') message.textContent = T('Offline setup was not completed. Free some storage or reconnect, then retry.', '离线准备未完成，请检查剩余空间和连接后重试。');
      else if (engineState.phase === 'error') message.textContent = T('Local calculation stopped. Your data is kept; retry the operation to restart.', '设备内计算已停止，数据已保留；请重新执行刚才的操作以重试。');
      else if (loading) message.textContent = T('Starting on-device calculation… The first use loads program files only.', '正在启动设备内计算…首次使用仅加载程序文件。') + elapsed;
      else if (engineState.busy) message.textContent = T('Calculating on this device… You can continue editing.', '正在设备内计算…可以继续编辑。') + elapsed;
      else message.textContent = offlineState.bundled === true
        ? T('Local app preview · Data stays on this device', '本地应用预览版 · 数据保留在当前设备')
        : offlineState.phase === 'ready'
        ? T('Offline files ready · Browser preview · Data stays on this device', '离线文件已就绪 · 浏览器预览版 · 数据保留在当前设备')
        : T('Browser preview · On-device calculation · Offline setup needs about 80 MB', '浏览器预览版 · 设备内计算 · 离线准备约需 80 MB');
    }
    prepare.addEventListener('click', async () => {
      try { await offline.install(); } catch (_) { /* status subscription shows failure */ }
    });
    engine.subscribe(value => { engineState = value; render(); });
    offline.subscribe(value => { offlineState = value; render(); });
    new MutationObserver(render).observe(document.documentElement, {attributes: true, attributeFilter: ['lang']});
    offline.refresh().catch(() => { offlineState = {...offlineState, phase: 'error'}; render(); });
    render();
  }, {once: true});
})();
