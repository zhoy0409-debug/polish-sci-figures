# Suite v1.4.15 · Figure Studio 0.1.15

English · [中文](#中文)

This update connects common editing actions, makes alignment easier to recognize, and accepts project and figure files directly in the workspace. Existing templates, local statistics, text spacing, format painter, eyedropper, image tools, editable PDF/SVG import, SVG/PNG/TIFF export and the companion Codex/Claude skills remain available.

## Changes

- **Continue from the current selection.** Align objects, fine-tune with direction keys, then move or resize them without selecting them again. Preserve the new placement through later commands, manual grid resizing, saved projects and Undo/Redo; locked content stays protected.
- **Recognizable alignment controls.** A compact icon menu shows left, centre, right, top, middle and bottom alignment, with text alignment icons in the text tools. Horizontal and vertical equal spacing become available for three or more editable objects or panels. Tooltips and accessible labels explain each icon in the chosen language.
- **Drop files where you work.** Drag project JSON, PDF, SVG or images into the canvas, header or sidebar. A green outline shows the image destination; an occupied cell is marked separately and its existing figure is preserved. Unsupported or unavailable destinations show a clear warning. One project JSON opens the whole workspace after confirmation; accompanying figure files are then added to that project. PDFs retain the local page-preview step, and CSV/TSV retain the data workflow.
- **Clearer update progress.** A small animated companion moves along a progress track with download, preparation and installation stages. Reduced-motion preferences are respected. Once the installer takes over, an expected shutdown of the old service keeps a neutral installation message instead of a misleading red failure. Connection problems before that handoff retain a separate retry action.

## Install or update

| Device or workflow | Download |
| --- | --- |
| Windows | [Installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/polish-sci-figures-Studio-0.1.15-Setup-x64.exe) · [Portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/polish-sci-figures-Studio-0.1.15-Portable-x64.zip) |
| Mac previews | [Apple silicon](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.15/polish-sci-figures-Studio-0.1.15-macOS-arm64-Preview.zip) · [Intel](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.15/polish-sci-figures-Studio-0.1.15-macOS-x86_64-Preview.zip) |
| Android preview | [Development APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.15/polish-sci-figures-Studio-0.1.15-Android-preview.apk) |
| AI skills | [Single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/polish-sci-figures-v1.4.15-skill.zip) · [Complete suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/sci-figure-suite-v1.4.15.zip) |

Save a project JSON before upgrading. Windows installer editions 0.1.9 and later support confirmed in-app updates; 0.1.8 and earlier need one manual upgrade. If 0.1.9 cannot prepare an update because of a long path, run the linked installer manually. The portable Windows edition and native previews retain manual installation. Downloads are public and do not require a GitHub account.

Mac previews require macOS 15 or later and use ad-hoc signing without Apple notarization. Android requires Android 8 or later and a current System WebView. Temporary signing keys can prevent an in-place Android update; export projects outside the app before replacing an older preview. iPhone/iPad remains simulator-only, without an installable IPA or TestFlight build.

## Verification scope

Regression coverage includes continuous alignment/nudging/resizing, canonical transforms after manual grid changes, locked targets, icon controls, protected file-transfer handling, project confirmation/cancellation, queued PDF import and update handoff states. DOM and browser file-transfer checks do not establish real Explorer/Finder drag delivery. Frozen installers, native builds and publication links require their own release evidence.

The latest completed 0.1.14 native audit passed the iPhone simulator workflow, but the iPad Save/Open sequence failed on both attempts. Android's portrait-tablet capture was visually inconclusive. These remain explicit limits until a fresh platform check supersedes them; earlier passing builds do not qualify a newer package. See the [device guide](local-device-trial.md) and [native validation record](mobile-preview-validation.md#current-status--15-october-2026). Each new package's hashes and acceptance outcomes accompany its release attachments.

## 中文

本版衔接常用编辑操作，让对齐工具更直观，并支持将工程和图形文件直接拖入工作区。原有模板、本地统计、文字间距、格式刷、吸色笔、图像工具、可编辑 PDF/SVG 导入、SVG/PNG/TIFF 导出及 Codex/Claude 配套技能继续保留。

### 本版变化

- **选中后连续修改：** 对齐后继续用方向键微调，再接着移动或缩放，无需重新选择。后续操作、手动调整网格、保存重开及撤销／重做保留新的位置，锁定内容继续受到保护。
- **直观对齐图标：** 紧凑菜单展示左、中、右及顶部、居中、底部对齐，文本工具也使用文字对齐图标。至少选择三个可编辑对象或小图后，可进行水平或垂直等距分布。悬停说明与无障碍标签随界面语言切换。
- **文件直接拖进来：** 工程 JSON、PDF、SVG 和图片可拖入画布、顶部或侧栏。绿色框提示图片实际导入位置，已有小图的格子单独提示保留；不支持或不可用的位置会明确提示。一份工程 JSON 经确认后打开整个工作区，同时拖入的其他图形依次加入。PDF 保留本机预览选页，CSV/TSV 保留数据导入流程。
- **更新进度更清楚：** 小伙伴沿进度轨道移动，展示下载、准备和安装阶段，并遵循系统减少动态效果的设置。安装程序接手后，正常关闭旧服务保留中性的安装提示，不再显示误导性的红色失败；接手前的连接异常仍有独立重试入口。

### 安装与升级

| 设备或工作流 | 下载 |
| --- | --- |
| Windows | [安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/polish-sci-figures-Studio-0.1.15-Setup-x64.exe) · [便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/polish-sci-figures-Studio-0.1.15-Portable-x64.zip) |
| Mac 预览 | [Apple 芯片版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.15/polish-sci-figures-Studio-0.1.15-macOS-arm64-Preview.zip) · [Intel 版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.15/polish-sci-figures-Studio-0.1.15-macOS-x86_64-Preview.zip) |
| Android 预览 | [开发 APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.15/polish-sci-figures-Studio-0.1.15-Android-preview.apk) |
| AI 技能 | [单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/polish-sci-figures-v1.4.15-skill.zip) · [完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.15/sci-figure-suite-v1.4.15.zip) |

升级前请保存工程 JSON。Windows 安装版 0.1.9 及更新版本支持确认后的应用内更新，0.1.8 及更早版本需手动升级一次；0.1.9 若遇到长路径准备失败，可手动运行上方安装程序。Windows 便携版与原生预览版仍手动安装。下载公开提供，无需 GitHub 账号。

Mac 要求 macOS 15 或更新系统，采用临时签名，尚未 Apple 公证。Android 要求 Android 8 或更新系统及较新的 System WebView；临时签名不同可能无法覆盖旧版，替换前请将工程导出到应用外。iPhone/iPad 仍仅供模拟器开发，没有可安装 IPA 或 TestFlight 版本。

### 验证范围

回归检查涵盖连续对齐、键盘微调与缩放、网格调整后的变换一致性、锁定对象、图标控件、受保护的文件拖拽信息、工程确认与取消、PDF 队列和更新接手状态。DOM 或浏览器文件传递检查不等于真实 Explorer/Finder 拖拽已验收；冻结安装包、原生构建和公开下载链接单独核对。

最近完成的 0.1.14 原生验收中，iPhone 模拟器流程通过，iPad 保存／打开流程两次尝试均失败；Android 平板竖屏截图也不足以确认完整视觉通过。新的平台检查通过前保留这些限制，不用旧版通过记录代替新版验收。详见[设备指南](local-device-trial.md#中文)及[原生验证记录](mobile-preview-validation.md#当前状态2026-年-10-月-15-日)。各新成品包的哈希与实际验收结果随对应发行附件提供。
