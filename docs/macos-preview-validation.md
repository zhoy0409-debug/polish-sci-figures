# macOS preview validation

English · [中文](#中文)

Status recorded on 13 October 2026. Figure Studio 0.1.5 has been built as a local macOS development preview, not a supported production Mac release. This page records the checks actually completed.

## Observed checks

| Environment | Result observed |
| --- | --- |
| Windows development computer | 12 portable packaging tests and 8 launcher/loopback regression tests passed. These are not Mac runtime tests. |
| GitHub `macos-15`, Apple silicon (`arm64`) | Native Python/Tk preflight, launcher/packaging regressions, 306-binary architecture/dependency audit, ad-hoc signature verification, frozen-app self-test and ZIP creation passed. |
| GitHub `macos-15-intel`, Intel (`x86_64`) | Native Python/Tk preflight, launcher/packaging regressions, 307-binary architecture/dependency audit, ad-hoc signature verification, frozen-app self-test and ZIP creation passed. |

Both jobs in [preview run 38383229930](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/38383229930), built from [`76b6570`](https://github.com/zhoy0409-debug/polish-sci-figures/commit/76b65708ebe619fd144bb84111d99c3fe22aa158), succeeded. Their downloaded diagnostics contain `passed: true` and `frozen: true`. Both used CPython 3.12.14 and Tcl/Tk 9.0.4; the synthetic PDF import recovered 11 text objects and 17 paths, chart generation produced 17 variants, and the OpenCV check produced exact-match evidence. The run contains separate architecture-specific preview and diagnostics artifacts, retained for 14 days. These packages supersede the `38587f9` previews and include the subsequent same-file Open retry and compact toolbar labels. The build also records phase progress and timeout logs. These results do not establish interactive Mac or mobile-device validation.

Both distribution ZIPs were also downloaded and matched their CI SHA-256 checksums. Each has one `Figure Studio.app` root, 212 preserved symlinks, a native executable with mode `0755`, version `0.1.5`, and minimum OS metadata `15.0`. The archives were inspected without unpacking or rewriting the app on Windows.

| Archive architecture | Bytes | SHA-256 |
| --- | ---: | --- |
| `arm64` | 106,575,407 | `c83b6a7f8e89625467b0400a9fd4794bc8846897c1484efbacb4fb9f377cce29` |
| `x86_64` | 131,815,574 | `676f26ca19d7544e802b713d6ebec7e77d681856046e265c3a942687852f2534` |

The [first native run](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/38365244433) failed before freezing: the Apple silicon build required a named license file for public-domain SQLite, while the Intel runner had preinstalled Python links that conflicted with Homebrew. The changes preserve an upstream SQLite attribution notice and handle link replacement inside the disposable CI runner. They do not change the end-user application's installation environment.

## Build gates and scope

Each architecture is built natively with bundled CPython, matching Tcl/Tk and the pinned scientific dependencies. Before producing a ZIP, the workflow requires native library architecture/location checks, an ad-hoc signature check, and a fresh frozen-app self-test. The self-test exercises local HTTP authorization, analysis, chart rendering/reflow, editable PDF import, and image duplicate screening/evidence using synthetic data. It creates a hidden Tk shell and does not open a browser. A run must explicitly report both `passed: true` and `frozen: true`; an old report cannot satisfy this gate.

The preview uses loopback-only local computation. Its application data path is `~/Library/Application Support/Figure Studio`; browser autosaves remain tied to the application's local origin. The CI workflow uploads build artifacts and synthetic test diagnostics, not users' research data. The successful jobs produced the complete `.app` ZIPs, SHA-256 checksum files and preview notes. The build workflow did not create a GitHub release.

No Developer ID signing or Apple notarization has been performed. Ad-hoc signing is a native build requirement, not verification by Apple. Finder launch, Gatekeeper handling, installation/upgrade, Safari/Chrome editing and export, sustained performance, and use on a separate Mac without developer tools still need interactive verification. The target is macOS 15 for each listed architecture; older macOS versions, iOS/iPadOS and Android are not validated by this work.

## 中文

记录日期：2026 年 10 月 13 日。Figure Studio 0.1.5 已完成本地 Mac 开发预览版构建，尚不是提供生产环境支持的正式 Mac 版本。本页只记录实际完成的检查。

### 已观察到的结果

| 环境 | 实际结果 |
| --- | --- |
| Windows 开发电脑 | 12 项可跨平台运行的打包测试、8 项启动与本机服务回归测试通过；这些不是 Mac 运行测试。 |
| GitHub `macos-15`，Apple 芯片（`arm64`） | 原生 Python/Tk 预检、启动与打包回归、306 个原生文件的架构和依赖检查、临时签名验证、独立应用自检及 ZIP 打包均通过。 |
| GitHub `macos-15-intel`，Intel（`x86_64`） | 原生 Python/Tk 预检、启动与打包回归、307 个原生文件的架构和依赖检查、临时签名验证、独立应用自检及 ZIP 打包均通过。 |

源码 [`76b6570`](https://github.com/zhoy0409-debug/polish-sci-figures/commit/76b65708ebe619fd144bb84111d99c3fe22aa158) 对应的[预览构建 38383229930](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/38383229930) 两个任务均成功。下载核查的诊断文件均明确记录 `passed: true` 和 `frozen: true`。两者均使用 CPython 3.12.14 和 Tcl/Tk 9.0.4；合成 PDF 导入恢复了 11 个文字对象和 17 条路径，绘图生成了 17 个候选版本，OpenCV 查重生成了完全相同图片的匹配证据。构建页面保留两种架构各自的预览包和诊断产物，保留期为 14 天。本次包替代 `38587f9` 预览，包含取消后重新打开同一文件及紧凑工具栏标签的改动，构建也新增阶段进度与超时日志；这些结果不代表已完成 Mac 实际交互或手机真机验证。

两份实际 ZIP 也已下载，SHA-256 均与 CI 校验文件一致（大小与哈希见上表）。每份均只有一个 `Figure Studio.app` 根目录，保留 212 个链接，原生可执行文件权限为 `0755`，版本为 `0.1.5`，最低系统元数据为 `15.0`。检查没有在 Windows 上解压或重写应用内部结构。

[首次原生构建](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/38365244433) 在冻结程序之前失败：Apple 芯片构建错误地要求公共领域软件 SQLite 必须附带特定文件名的许可证；Intel 环境中的预装 Python 链接与 Homebrew 冲突。修复保留了 SQLite 官方来源声明，并仅在临时 CI 机器中处理链接覆盖，不修改普通用户的安装环境。

### 检查范围

两种架构分别原生构建，程序包含 CPython、匹配的 Tcl/Tk 和固定版本的科研依赖。生成 ZIP 前必须通过原生库架构与位置检查、临时签名检查，以及本次新构建程序的自检。自检使用合成数据，经本机 HTTP 接口验证授权、统计分析、绘图与尺寸重排、可编辑 PDF 导入、图片查重及证据生成；它创建隐藏 Tk 窗口，不打开浏览器。结果必须同时明确记录 `passed: true` 和 `frozen: true`，不能使用上次遗留的报告通过检查。

计算仅在本机回环地址完成。应用数据目录为 `~/Library/Application Support/Figure Studio`；浏览器自动保存仍与本机地址绑定。CI 上传的是构建产物和合成测试记录，不包含用户科研数据。成功任务已生成完整 `.app` ZIP、SHA-256 校验和文件与预览说明；此工作流没有创建 GitHub 正式发行版。

目前没有 Developer ID 签名或 Apple 公证。临时签名只是原生构建要求，不代表 Apple 认证。Finder 启动、Gatekeeper、安装升级、Safari/Chrome 中的编辑导出、持续使用性能，以及无开发工具的另一台 Mac，都仍需实际交互验证。本次目标为两种架构上的 macOS 15；旧版 macOS、iOS/iPadOS 和 Android 不属于本次已验证范围。
