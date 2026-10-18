# Suite v1.4.24 · Figure Studio 0.1.24

Published on 2026-10-18 as [v1.4.24](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.24). The initial Windows checks and genuine official 0.1.23 → 0.1.24 upgrade succeeded, but matched 5000-element performance was rejected. Final acceptance remains pending; the original tag and eight initial assets are preserved.

## 中文

0.1.24 已公开发布。更新窗口保留简约小猫与小狗，用透明空心心与翡翠水面呈现实际收到的下载字节。总量未知时保持不定进度；下载完成、完整性校验、可安装与安装中分别表达。关闭角色动画或启用系统降动效后，仍可读取进度。Carbon Atelier、Mineral Jade 与 Pearl Pro 风格沿用原方案。

### 安装与升级

首次使用从官方获取 Windows Setup 并直接运行，无需解压。以后在受支持的安装版中选择**更新 → 下载并准备更新 → 保存工程并勾选确认 → 安装并重新打开**。便携版或未注册副本提供明确的官方 Setup 入口；本机安装能力、完整性校验和保存确认继续生效。

真实官方 0.1.23 → 0.1.24 下载、校验、确认安装、自然重新打开与正常清理已完成，本轮公开 Iris 工程、历史／检查点／草稿及设置恢复通过。下载仍由原 0.1.23 界面绘制；0.1.24 心形描绘下一次真实官方更新，需要后续实际版本才能验证，不能用受控动画替代。

### 实际检查与性能问题

候选安装／启动、冻结代码与源码身份、八项精确 HEAD CI、实际安装版五组科学及编辑回归（72／4／1／5／16 项）、焦点交互、重装与正常卸载已通过。初始包中的[验证范围](qa/jade-hearts/windows-0.1.24/README.md)与[publication-readiness.json](qa/jade-hearts/windows-0.1.24/publication-readiness.json)保留发布前快照及 `finalAcceptance: false`，不改写为后续升级结果。

同一默认 profile 的首次实际 5000 图元配对，选择／改色的 P95 从 0.1.23 的 **120／97.5 ms** 增至 0.1.24 的 **146.3／145.5 ms**；本轮性能未获接受。受控 ABBA 诊断的四批 P95 依次为 A1 **116／101.6**、B1 **219.4／185.7**、B2 **176.3／147.5**、A2 **127／122.6 ms**，两个 B 批次的尾部延迟均较高。完整样本保留，没有以通过技术采集检查代替性能判断。

后续 CPU 采样把重点定位到属性面板重复深拷贝；ABBA／CDDC 代码候选对照用于诊断，不能代替 0.1.25 的正式候选、精确 CI、Windows 或官方升级验收。本页不宣称心形资源节点是 5000 图元热路径原因，也不提前给出尚未发生的 0.1.25 结果。性能门禁未通过，24 的最终验收与后续三份增补资产暂停。

本轮没有新增 Windows 中文输入法、图像检测准确率、Mac／移动设备或所有工作流验收。0.1.23 历史证据、24 原 tag、初始安装包、校验和与原始报告均保留。

## English

The published 0.1.24 keeps the simple cat and dog, Carbon Atelier / Mineral Jade / Pearl Pro styling, and a transparent heart whose jade water level follows actual received/total bytes. Unknown totals remain indeterminate. Download completion, integrity verification and installation are separate; animation preferences and reduced motion retain readable progress.

First use is a direct Windows Setup installation. Supported later upgrades use **Updates → Download and prepare update → save and confirm → Install and reopen**. The genuine official 0.1.23 → 0.1.24 download, verification, confirmed installation, natural reopening, public Iris project/settings restoration and normal cleanup passed. Original 0.1.23 renders that download; a real later official download rendered by 0.1.24 still needs its own future-version check.

Candidate installation/start, frozen-code/source identity, eight exact-head CI jobs, five installed scientific/editing suites (72/4/1/5/16 checks), focused interactions, reinstallation and normal removal passed. The [initial evidence scope](qa/jade-hearts/windows-0.1.24/README.md) remains an initial snapshot with `finalAcceptance: false`.

Matched native 5000-element selection/colour P95 increased from **120/97.5 ms** in 0.1.23 to **146.3/145.5 ms** in 0.1.24. Controlled ABBA P95 was A1 **116/101.6**, B1 **219.4/185.7**, B2 **176.3/147.5**, A2 **127/122.6 ms**. Performance was rejected and all samples retained. CPU sampling then identified repeated inspector deep clones as the hot path; ABBA/CDDC code-candidate diagnostics do not certify an installed 0.1.25 release or assign the regression to heart resource nodes.

Final acceptance and the three postrelease supplements remain suspended. No new native IME, detector-accuracy, Mac/mobile or all-workflows result is claimed. Original published assets, checksums and historical evidence remain unchanged.
