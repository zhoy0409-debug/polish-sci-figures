# Suite v1.4.25 · Figure Studio 0.1.25

Published stable on 2026-10-18. The revised Windows candidate passed the selected checks below. The original official 0.1.24 editor completed one genuine 0.1.25 download/install, automatic complete-project/settings restoration and independent read-only verification; the observed matched-profile 5000 pair was accepted. After the genuine upgrade, default-profile 0.1.25 focused checks passed: F2/one-step undo/save-reopen, theme SVG/RGBA, the complete scientific payload, companion pointer responses and reduced motion. Normal uninstall and external-profile preservation passed. The [published 0.1.24 and its rejected matched-performance gate](release-notes-v1.4.24.md) remain separate.

## 中文

### 改动范围

本补丁复用现有属性快照缓存：四处经审阅的纯读属性面板调用直接读取分离的 canonical SVG 快照，减少同一轮读取中的重复深拷贝。现有 `editableSource` 仍向写入消费者返回独立克隆；原工程／状态、语言、字体及派生渲染等失效条件保留，不能跨工程或错误复用旧状态。科学分析、原始数据、可编辑图形与保存／撤销语义不在本次改动范围内。

更新窗口仅在需要显示时挂载心形资源，隐藏／销毁时释放对应内容；保留现在的简约小猫小狗、透明翡翠心形、Carbon Atelier / Mineral Jade / Pearl Pro、降动效及反复开关生命周期。水位只来自真实收到字节／实际总量，总量未知时不造百分比；下载、校验、确认安装、安装中与完成继续区分。该生命周期调整不作为 5000 图元性能问题的单独因果结论。

版本信息区改用共享网格行对齐标签与版本值，替换以固定像素定位的字符箭头，采用简洁的翡翠矢量箭头。修订后已在真实 Chrome 中检查中英文、深浅主题、窄窗口和模拟 DPR 的 24 种布局，并重新构建、安装和验收最终包。

### 使用与验收状态

首次使用可从官方直接运行 Windows Setup，无需解压；受支持安装版以后在**更新 → 下载并准备更新 → 保存并确认 → 安装并重新打开**中升级。科研工作继续在本地进行，更新服务不接收图片、数据表或工程。

最终候选已完成三组科学源码回归、30 组 DOM 回归、实际安装版五组功能（72／4／1／5／16 项）、公开 Iris 数据 150 个观测／12 个 SVG 源的保存重开、F2 修改及一次撤销、双主题 SVG／RGBA 一致性，以及正常安装／覆盖安装／卸载后的工程与设置逐字节保护复查。候选自定义数据目录不具备编辑器内安装权限，该项不冒充真实升级。

最终安装包的单次 5000 图元原协议测量保留全部 46 次操作（40 次测量、6 次预热），选择／改色第二次 rAF 等待 P95 分别为 79／71.2 ms。这是本机候选结果，与下述官方24→25配对结果分开记录，不代表光学延迟、持续帧率或所有设备表现。[完整候选证据](qa/jade-hearts/windows-0.1.25/README.md)保留历史拒绝结果、所有样本和原始媒体的有限采样范围。

原官方0.1.24通过编辑器完成一次真实下载和一次安装，自动恢复全部五类工程容器（Iris 150 条观测、12个原SVG、3个历史状态、1个检查点、1份数据草稿）及设置；独立只读验证和2628个原安装备份文件核对通过。实际界面观测到checking／downloading／ready／preparing／installing，短暂verifying界面阶段未观测到；实际包字节的SHA-256校验已通过。详见[官方升级记录](qa/jade-hearts/windows-0.1.25/official-update/README.md)。

同机同默认配置的官方24→25两版测量各保留全部46操作：选择第二次rAF P50／P95由89／116.1变为62.7／89.3 ms，改色由82.4／91.7变为57.9／77.6 ms。此次观测配对已获接受；这是合成5000图元、Tab确认与rAF回调机会的结果，不能推为Enter、光学延迟或普遍加速。[完整配对样本与解释](qa/jade-hearts/windows-0.1.25/matched-performance/README.md)保留原始统计和全部操作。真实升级后，默认配置0.1.25专项已通过F2／一次撤销／保存重开、双主题SVG／RGBA、完整科研工程、猫狗指针及降动效检查。 正常卸载已通过，外部配置与定稿证据保持一致，四个 AppId 注册表视图均无残留；详见[最终验收记录](qa/jade-hearts/windows-0.1.25/postrelease-acceptance.json)。

本次发布后提交只补文档和验收，应用源码、原初始8资产及tag不变；源码ZIP的Git文件模式已在公开前修正并重新核对，未替换已发布资产。安装包内说明保留构建快照，当前说明补记发布后实际结果。本轮在 0.1.25 收尾并冻结；后续仅按新增需求汇总验证、集中更新。

未声明新增中文输入法、图像检测准确率、Mac／移动设备或所有工作流验收。旧版本 tag、初始资产与完整原始性能样本保留。

## English

The inspector change reuses the existing detached canonical SVG snapshot for four reviewed read-only consumers. The existing `editableSource` API continues returning an independent clone to mutating consumers, with the original project/state, language, font and derived-render invalidation rules retained. Scientific analysis, source data, editable figures and save/undo semantics remain outside this patch's change scope.

The update scene mounts heart resources when needed and releases them on hide/destroy. It retains the current simple cat/dog, transparent jade hearts, Carbon Atelier / Mineral Jade / Pearl Pro, reduced motion and repeated-open lifecycle. Water follows genuine received/total bytes; unknown totals, integrity checks and confirmed installation remain distinct. Lazy mounting alone is not the asserted cause or proof of the 5000-element performance fix.

The version information uses shared grid rows for labels and values, with a restrained jade vector arrow replacing the fixed-position text glyph. The revision passed 24 controlled Chrome layout cases across English/Chinese, dark/light, narrow windows and emulated DPR, followed by a fresh Windows build and installed acceptance.

First use remains direct Windows Setup; supported later upgrades use **Updates → Download and prepare update → save and confirm → Install and reopen**. Images, tables and projects are not sent to the update service.

The final candidate passed three selected scientific source groups, 30 DOM groups, five installed functional suites (72/4/1/5/16 checks), public Iris save/reopen and F2/one-undo checks, theme SVG/RGBA equality, and normal install/reinstall/uninstall preservation. Its custom data directory has in-app installation disabled. All 46 original 5000-element operations are retained; selection/colour second-rAF P95 was 79/71.2 ms in this single candidate capture. These are rAF opportunities, not optical latency, sustained FPS or universal device results. [Candidate evidence](qa/jade-hearts/windows-0.1.25/README.md) retains rejected historical results and bounded original-media sampling.

The original official 0.1.24 editor completed one real 0.1.25 download and installation, followed by automatic restoration of all five project containers (Iris 150 observations, 12 original SVGs, 3 history states, 1 checkpoint and 1 draft) and settings. Independent read-only verification and the complete 2628-file rollback inventory passed. The UI showed checking/downloading/ready/preparing/installing; the brief verifying UI stage was not observed, while actual SHA-256 package verification passed. See the [official upgrade record](qa/jade-hearts/windows-0.1.25/official-update/README.md).

The actual same-device/default-profile pair retained all 46 operations per version. Selection second-rAF P50/P95 changed from 89/116.1 to 62.7/89.3 ms; recolouring changed from 82.4/91.7 to 57.9/77.6 ms. This observed pair was accepted. These synthetic 5000/Tab/rAF results do not establish Enter or optical latency or universal acceleration. See [complete matched samples and interpretation](qa/jade-hearts/windows-0.1.25/matched-performance/README.md). After the genuine upgrade, default-profile 0.1.25 focused checks passed: F2/one-step undo/save-reopen, theme SVG/RGBA, the complete scientific payload, companion pointer responses and reduced motion. Normal uninstallation preserved the complete external profile and finalized evidence; all four AppId registry views were absent. The [final acceptance record](qa/jade-hearts/windows-0.1.25/postrelease-acceptance.json) binds these actual results.

This postpublication update changes documentation/evidence only; application code, the initial eight release assets and tag stay unchanged. Source ZIP Git modes were corrected and reverified before publication. Installer-contained guides retain their build-time snapshot; these current guides record subsequent actual results. Freeze this round at 0.1.25; batch and validate later requested changes before a maintenance release. No new native IME, detector-accuracy, Mac/mobile or all-workflows result is claimed; previous tags, assets and complete samples are preserved.
