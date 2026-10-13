# Local browser engine prototype

This directory is a development prototype. It runs the existing analysis, rendering, physical-size reflow, facet splitting and image-duplicate engine in one Pyodide Web Worker. It does not establish support for iOS, Android or every browser. No backend receives research data.

From a clean source checkout, a developer with Node.js/npm and this repository's Python build environment can prepare the official runtime with:

```sh
npm install --prefix .cache/mobile-local-spike --cache .cache/mobile-local-spike/npm-cache --ignore-scripts --no-audit --no-fund pyodide@0.29.3
node web/prepare-runtime.mjs
node web/prepare-runtime.mjs --offline
python scripts/build_local_web_preview.py
python -m http.server 8790 --bind 127.0.0.1 --directory .cache/local-web-preview
```

Open `http://127.0.0.1:8790/starter.html`. The preparation script obtains only the declared scientific packages and their dependency closure from the official pinned Pyodide distribution on jsDelivr, and verifies each wheel's SHA-256 from the runtime's lockfile before writing it. The `--offline` run verifies the cache without making network requests. Runtime-cache preparation is a developer build step, not a research-data operation. The build command itself does not download anything: it re-verifies cached scientific wheels, copies license notices, and writes public-file checksums into `.cache/local-web-preview`. Only this generated, marked directory may be replaced. Do not open the page through `file://`.

`window.StudioBrowserEngine.fetch(endpoint, options)` provides native `Response` objects with the desktop JSON contracts. Endpoints are `/api/analyze`, `/api/render`, `/api/reflow`, `/api/split-facets` and `/api/image-duplicates`. The duplicate endpoint accepts `start`, `status`, `result` and `cancel`; status responses contain the completed result. `ready()`, `status()`, `subscribe(listener)` and `dispose()` expose the runtime lifecycle. At most one worker and two waiting calculations exist. Cancelling active work terminates that worker; the next task initializes a new one. A queued cancellation does not interrupt another operation. Initialization and each dispatched operation have separate 180-second limits; a timeout stops the worker and returns a visible failure. Status contains local-only elapsed/initialization/operation timing and bounded rendering warnings. Completed duplicate reports retain the existing two-report / 15-minute bound.

`window.StudioBrowserOffline.install()` installs versioned public application files through a service worker. `refresh()`, `status()` and `subscribe(listener)` report progress and cache completeness. The service worker verifies file hashes and writes its completion marker last; research POSTs are never cached. Only HTTPS or localhost supports this setup. Browser storage may be evicted; readiness rechecks all expected entries, and installation can repair an incomplete cache even without a code update. At most one previous public app version is retained. The current source remains a local prototype, with no public hosting or store distribution.

The Python engine receives JSON through worker messages, never through an HTTP request. Runtime fetches are restricted to named same-origin public files and disabled after initialization. There is no submitted-code evaluation, package auto-installation, URL-based image loading or editable-PDF substitute. `/api/import-pdf` returns a bilingual explicit 501 error. Missing system fonts produce an explicit warning when a newly generated preview uses bundled DejaVu Sans; imported artwork and the requested source recipe font remain unchanged. CJK labels remain editable SVG text; their browser appearance needs separate visual verification.

Tests: `node scripts/test_local_web_engine.cjs` checks scheduling and cancellation, `node scripts/test_local_web_offline.cjs` checks service-worker cache behavior, and `node scripts/test_local_web_wasm.mjs` runs the actual dispatcher offline with network calls forbidden. The last is a Node/WASM check, not a real-device browser claim. The existing runtime spike measured several hundred megabytes of process memory; low-memory and mobile-device behavior still require actual tests.

The optional [literature lookup](../README.en.md#examples-in-papers) runs separately from this calculation worker. It connects to Europe PMC only when the user starts a search, sending chart terms and an optional typed topic. It does not upload research data or make local calculation depend on Internet access.

## 本地浏览器引擎原型

本目录是开发原型，通过一个按需启动的 Pyodide 后台线程运行现有统计分析、出图、尺寸重排、分面拆分和图片查重。研究数据通过浏览器内部消息传递，不上传后台。该原型尚不代表已经验证所有手机、平板或浏览器。

可选的[文献检索](../README.zh-CN.md#文献作图实例)与计算线程分开，只在用户主动查找时连接 Europe PMC，发送图型词和手动填写的可选主题，不上传研究数据，也不让本地计算依赖联网。

首次从源代码构建时，开发者先按上方命令安装精确版本 `pyodide@0.29.3`，再运行 `node web/prepare-runtime.mjs` 下载官方科学计算依赖并校验 SHA-256；加上 `--offline` 可在禁止下载的模式下检查完整缓存。随后运行 `python scripts/build_local_web_preview.py`，构建过程本身不联网。生成目录为 `.cache/local-web-preview`；启动上方本地静态服务器后打开 `http://127.0.0.1:8790/starter.html`，不能直接双击 `file://` 文件。这些是开发者的构建步骤，不会读取或上传研究数据。运行库、科学计算依赖、许可证和文件校验清单均随原型保存。

“准备离线使用”仅缓存程序公共文件，逐项验证校验值，并在全部完成后记录就绪状态；不会缓存研究数据请求。离线功能需要 HTTPS 或 localhost。浏览器可能清理存储，因此再次检查时会逐项确认资源是否仍然存在。

同一时间只运行一个计算线程，最多排队两项操作。取消正在计算的任务会终止线程，下次计算时重新初始化；取消排队任务不会打断其他操作。初始化和单项计算分别设有 180 秒上限，超时后停止线程并明确提示；界面状态提供仅在本地使用的耗时信息。图片查重沿用最多两份完成记录、15 分钟保留期限和现有输入上限。

该原型明确不支持可编辑 PDF 导入，不会用栅格化图片冒充可编辑 PDF。缺少系统字体时，生成预览会明确提示使用内置 DejaVu Sans，同时保留源配方中用户请求的字体。导入原图不受影响；中文标签仍保留为可编辑 SVG 文字，实际显示需单独核验。自动化离线计算测试不能代替真实手机和平板的性能、交互与离线测试。
