# Suite v1.4.23 · Figure Studio 0.1.23

**Candidate status · 2026-10-18:** source and controlled Chrome checks are recorded below. The new Windows build, installed-editor regression and actual in-app upgrade acceptance are pending. This note does not declare a stable publication; download links become available after release.

## What changed

- Restore the original small ink cat from `ef27dbe` and add a matching monochrome dog. The compact pair uses staggered hops, tail movement, inspection and small hover/press feedback; Carbon Atelier and Pearl Pro remain.
- Explain the first-use Windows Setup installation and later **Updates → Download and prepare update → save and confirm → Install and reopen** workflow. Supported installed editions download, verify and install inside the editor without repeated manual extraction or folder replacement.
- Offer an explicit official Setup download to portable or unregistered Windows copies, including when their version is already current. This external link does not enable local installation or bypass native capability, integrity checks or saved-project confirmation.
- Advance suite and native source metadata together. Package/source verification follows the current Windows build version while retaining exact hashes, asset sets, bytecode and portable-tree checks. Mac/mobile source metadata is synchronized; their previously published previews and build numbers are unchanged.

## Recorded checks and pending acceptance

The [minimal-companion evidence](qa/minimal-companions/README.md) records 22 controlled Chrome snapshots, six pointer cases, both themes, reduced motion and narrow emulated device pixel ratios. The generated-source editor saved an equivalent parsed project containing 150 public Iris observations and 12 original SVGs; scientific SVG exports matched after canonical generated-ID normalization. This is not literal JSON/SVG byte equality or a new installed-Windows acceptance result.

The existing real download, verification, backup, saved-project confirmation and installer handoff mechanisms remain. Historical [0.1.20/0.1.21 → 0.1.22 update evidence](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/qa/live-preview/postrelease-20261018/README.md) stays bound to those exact original packages. New 0.1.23 installation, saved-data/editing checks, actual app-driven upgrade, cleanup and final artifact identity must be recorded separately before stable publication.

This release changes update presentation and guidance. It adds no scientific analysis method, image-detection accuracy claim, new native IME session or Mac/mobile hardware validation. Existing scientific and editor features retain their scoped records; the Windows artifacts' own verification must be completed.

## Installation and compatibility

First use: download the official [Windows Setup](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.23/polish-sci-figures-Studio-0.1.23-Setup-x64.exe), run it, and use the desktop or Start-menu shortcut. Later supported updates stay in the editor. Versions through 0.1.8 require one manual Setup run; the 0.1.9 long-path exception and same-version candidate replacement remain in the [quick start](../desktop/QUICKSTART.en.md#save-quit-and-upgrade).

Portable/source/custom copies are not overwritten. Save a project JSON, quit that copy, install official Setup using its default location, and start the installed shortcut if you want supported in-editor updates. Follow any remaining specific error and Windows security prompt; this migration is not a universal repair. [Source design](update-scene-design.md) · [Change log](../CHANGELOG.md) · [Official release page](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.23).

## 中文

**候选状态（2026-10-18）：** 简约猫狗与升级引导已有源码及受控 Chrome 检查；新 Windows 安装包、安装版编辑回归和真实应用内升级仍待验收。本说明不代表已稳定发布，下载链接在发布后生效。

本版保留原来 `ef27dbe` 的圆润单色小猫，增加同画风小狗，通过错相跳跃、摇尾、校验观察及轻微悬停／按压反馈配合。沿用 Carbon Atelier、Pearl Pro 和真实更新状态，不用动画虚构进度。

首次从官方获取 Setup，运行后从桌面或开始菜单启动；以后使用**更新 → 下载并准备更新 → 保存工程并勾选确认 → 安装并重新打开**，受支持的安装版无需反复手动下载、解压或替换目录。便携或未注册副本可显式打开官方 Setup 链接，同版本也可获取安装版；这不会绕过本机能力、完整性校验或安装确认。旧版、长路径和同版本候选的处理见[中文入门](../desktop/QUICKSTART.zh-CN.md#保存退出与升级)。

[当前证据](qa/minimal-companions/README.md)包含受控 Chrome 22 个状态截图、6 组指针操作、双主题与降动效检查。生成源码页核对保存后的解析工程及 150 条公开 Iris 观测、12 份原 SVG；导出只在规范化自动 ID 后比较，不宣称原始字节完全一致。这些结果不替代 0.1.23 新安装、真实下载／校验／安装、工程自动恢复及清理验收。历史 0.1.20／0.1.21 → 0.1.22 记录继续绑定原包，不改写为本版通过。

套件与原生源码版本同步为 1.4.23／0.1.23；Mac、移动端仅同步源码元数据，既有发布链接和移动构建编号不变。本版不新增科学分析方法、图像检测准确率、原生输入法或 Mac／移动硬件验收结论。
