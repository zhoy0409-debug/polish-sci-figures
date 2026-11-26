# Figure Studio 0.2.7 · Suite 1.6.6

**[下载 Figure Studio 编辑器｜Windows 10/11 x64](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/polish-sci-figures-Studio-0.2.7-Setup-x64.exe)**。双击安装，从桌面或开始菜单打开，可离线使用。

**[在 Claude / Codex 中使用 AI Skill](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/platform-installation.md)** · [Skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/polish-sci-figures-v1.6.6-skill.zip)。按宿主安装单入口包，保留 suite 目录，再选择 Skill 发出任务。

## 中文

复杂 SVG 的纯移动在松手后保留已绘制的画布，继续使用原有校验、保存与一次撤销。避免再次重建所有图元及整套属性面板；结构性排版、缩放和依赖图形继续使用适用的完整渲染路径。原始图像、SVG 和数据保持独立，取消、撤销、连续拖动与工程重开均有专门检查。

同一 Windows Chrome 合成夹具中，旧版 5000 图元松手 p95 为 210 ms；新实现三轮为 23–32 ms，10000 图元三轮为 38–41 ms。测量从真实指针松手到第二次动画帧，不同时录屏或采样 CPU。这些数值限定于所列夹具和本机环境，不代表任意复杂度或设备的性能承诺。

Mac 发布门槛增加原生可见窗口、系统提示检查、Chromium 与 WebKit 的可见浏览器操作，以及 5000／10000 图元多轮测试。覆盖 ARM 与 Intel macOS 15 托管桌面，区分自动 GUI 验收、原生打包自检与人工设备操作。启动及 Skill 本地服务绑定数值回环地址，移除不必要的反向 DNS 查询；保留原有地址独占、Host／Origin／令牌检查。

[使用向导](figure-studio-usage-guide.md) · [复现、测量与验收范围](qa/large-canvas-20261126/README.md)。最终包、架构、GUI 结果和校验值在本发行的 VALIDATION.json 中记录。macOS 仍是 macOS 15+ 临时签名预览包。

## English

**[Download Figure Studio editor | Windows 10/11 x64](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/polish-sci-figures-Studio-0.2.7-Setup-x64.exe)**. Double-click Setup and open Figure Studio from the desktop or Start menu to work offline.

**[Use the AI Skill in Claude / Codex](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/platform-installation.en.md)** · [Skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/polish-sci-figures-v1.6.6-skill.zip).

Pure translations retain the painted canvas after the existing validated, single-undo commit. Structural edits and dependent graphics retain their canonical rendering path. Original sources and data remain unchanged; cancellation, repeated motion, resizing and canonical project reopen are tested separately.

In the labelled local Windows Chrome fixture, 5000-object pointer-up p95 decreased from 210 ms to 23–32 ms across three rounds; 10000 objects measured 38–41 ms. These event-to-second-rAF results are scoped measurements, not universal device/complexity guarantees.

Mac packaging gates now include visible native windows, unexpected-permission detection, headed Chromium/WebKit editing and repeated large-SVG checks on arm64/x86_64 macOS 15 hosts. Numeric loopback startup avoids reverse DNS while retaining authorization and Windows exclusive-binding guards. Hosted desktop automation is distinct from human physical-device/IME acceptance. macOS remains a macOS 15+ ad-hoc-signed preview.

Secondary downloads: [Windows portable](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/polish-sci-figures-Studio-0.2.7-Portable-x64.zip), [suite sources](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/sci-figure-suite-v1.6.6.zip), [SHA-256](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.6/SHA256SUMS.txt), [Mac scope](local-device-trial.md).
