# Local browser preview: validation record

English first · [中文](#中文)

This is a development preview, not an iOS, iPadOS or Android release. It has no remote analysis backend. The existing Windows desktop release remains the downloadable product for ordinary users.

## What was actually checked

- The existing Python calculation engine ran under pinned Pyodide 0.29.3 with network calls forbidden: Welch results, 18 chart variants, physical-size reflow, separate facet panels, exact and mirrored-crop image matches, an unrelated negative control, and preservation of 16-bit image intensity identity. All eight dispatcher checks passed with zero network requests.
- The statistical compatibility changes passed 20 desktop tests and 16 calculation/import tests under WASM SciPy 1.14.1. These include tied ranks, seeded permutations, paired sample identities, large-sample Wilcoxon calculations and Holm adjustment.
- Seven worker lifecycle tests cover queue limits, cancellation, stale messages, warnings, timing and operation timeout. Seven offline-cache tests cover hashes, partial failure, eviction, repair and bounded retention of previous app versions. Four build tests check real asset hashes and protect unrelated directories from replacement.
- The editor transport test executes the actual browser/desktop routing function. A missing or failed browser worker never falls back to submitting research data over HTTP; the desktop token refresh path remains intact.
- Gesture and DOM tests cover pointer ownership, a second finger cancelling an unfinished edit, stale capture-loss events, cancellation without commits, mouse/pen behavior, accessible drawers, language switching and desktop restoration. The DOM harness is a simulation, not Safari or Android hardware.

The [clean Ubuntu preview job at `fcfe198`](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/38369473983/job/115202577493) also passed: it installed the pinned public runtime, verified the official wheel cache, built the browser package from source, and ran the build, actual WASM dispatcher and DOM checks. The downloaded report records eight passing checks and zero network requests during calculation. This independently verifies the build and engine on Linux; it is still not a phone or browser-engine test.

## Desktop browser observations

On 13 October 2026, the preview was opened in the Codex in-app browser on Windows at 390 × 844 CSS pixels. English and Chinese labels, Canvas / Panels / Adjustments views, the panel action menu and the export dialog were inspected visually.

The complete public application cache was installed. The local static server was then stopped. Reloading the editor still worked. From this server-off state, a 72-observation grouped chart was generated, its data table opened, and Welch pairwise tests with Holm adjustment produced a visible result and editable figure annotations. A single-panel SVG was downloaded and retained as a local test artifact. After the cache update, a single-panel TIF was also downloaded and decoded with Pillow: 2880 × 2413 px, RGB, 600 dpi on both axes, with nonblank pixel content. This confirms desktop-browser file delivery; phone download/share behavior remains untested.

Restarting the static server and reloading installed the newer application cache while retaining the synthetic project. The updated source includes explicit local calculation failure messages, offline-cache repair, font fallback information and bounded calculation timeouts.

## Limits of this evidence

The isolated Node/WASM run used a 255 MB WASM heap and approximately 763 MB process RSS after the tests. These are snapshots, not peak memory or phone measurements. The first browser render was noticeably slower than subsequent analysis; concurrent development activity and browser automation delays prevent treating that observation as a clean benchmark. In a later run of the updated browser build, locally recorded worker initialization took 11,705 ms, the first analysis operation took 4,926 ms, and repeating it took 74 ms. This is a single Windows desktop observation, not a mobile performance guarantee. Calculation timing is exposed locally to support controlled measurements.

No iPhone, iPad, Android device or Safari session was available for this browser validation. Touch tests do not establish physical gesture quality, keyboard behavior, download/share behavior, installation or performance on low-memory devices. This browser ZIP does not contain an APK or IPA; subsequent native development builds and emulator results are recorded in [mobile validation](mobile-preview-validation.md). Editable PDF import deliberately reports that it is unavailable in this browser build. The desktop editor retains its PDF functionality.

The generated ZIP contains only the blank starter and public program resources. It excludes user projects and test evidence. Public hosting and application-store distribution have not been performed.

## 中文

这是开发预览版，不是已经发布的 iOS、iPadOS 或 Android 版本。没有远程分析后台；普通用户当前可下载的正式产品仍为 Windows 桌面版。

### 实际检查范围

- 在禁止网络调用的 Pyodide 0.29.3 中运行现有 Python 引擎，8 项真实计算检查通过：Welch 结果、18 种图形候选、尺寸重排、分面拆分、相同及镜像裁剪图片匹配、无关图片负对照，以及 16 位图像原始强度身份保留。网络请求数为 0。
- 统计兼容修复通过 20 项桌面测试及 WASM SciPy 1.14.1 的 16 项计算与结果导入回归，覆盖并列秩、确定性置换、配对身份、大样本 Wilcoxon 和 Holm 校正。
- 计算线程、离线缓存、构建边界分别通过 7、7、4 项检查。编辑器真实传输函数验证了：计算线程缺失或失败时，不会退回 HTTP 上传科研数据。
- 手势与 DOM 模拟检查覆盖双指接管、取消不提交、鼠标及触控笔行为、抽屉与语言切换。模拟测试不能代替真机交互测试。

[`fcfe198` 的干净 Ubuntu 预览检查](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/38369473983/job/115202577493) 也已通过：重新安装固定版本公共运行库、校验官方依赖缓存、从源代码构建，并执行构建、真实 WASM 计算与 DOM 检查。下载的报告记录 8 项通过、计算期间网络请求为 0。这独立验证了 Linux 上的构建和计算引擎，仍不等同于手机或浏览器内核测试。

### 浏览器中实际完成的流程

2026 年 10 月 13 日，在 Windows 的 Codex 内置浏览器中以 390 × 844 CSS 像素检查中英文布局、画布／图层／调整抽屉、小图操作与导出窗口。

缓存全部公共程序文件后，关闭本地静态服务器，仍能重新打开编辑器，使用 72 条合成观测生成图形、查看数据表、完成 Welch 两两比较及 Holm 校正，并把统计标注应用到图中。已下载单图 SVG。缓存升级后，也实际下载并用 Pillow 解码了单图 TIF：2880 × 2413 px、RGB、两个方向均为 600 dpi，像素内容非空。这验证了桌面浏览器的文件交付；手机的下载和分享仍未验证。

重新启动静态服务后，缓存升级成功，合成工程保留。最新版增加了计算失败提示、缓存缺失修复、字体替代说明及计算超时处理。

### 尚未验证

独立 Node/WASM 检查结束时，WASM 堆约 255 MB，进程内存约 763 MB；这不是峰值，也不是手机性能测量。首次浏览器绘图等待明显长于后续分析。更新后的浏览器实测记录中，计算线程初始化为 11,705 ms，首次分析为 4,926 ms，重复分析为 74 ms。这只是一次 Windows 桌面观察，不能据此宣称低配置设备或手机已经流畅；耗时记录保留在本地，供后续受控测试使用。

这次浏览器验证未进行 iPhone、iPad、Android 或 Safari 真机检查。该浏览器预览 ZIP 不包含 APK 或 IPA；后续原生开发包和模拟器结果另见[移动端验证记录](mobile-preview-validation.md#中文)。触摸、软键盘、下载分享、安装及低内存性能均需继续实测。浏览器预览明确提示暂不支持可编辑 PDF 导入；桌面版的 PDF 功能保留。

生成的预览 ZIP 仅包含空白启动页和公共程序资源，不含用户工程或测试证据。尚未公开托管或上架应用商店。
