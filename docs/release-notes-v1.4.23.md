# Suite v1.4.23 · Figure Studio 0.1.23

**预发布实际检查记录（2026-10-18）：** 安装、选定科研／编辑回归、重装、卸载及手动升级的五项检查已有真实证据；官方稳定版应用内升级须首次发布后执行，当前尚未最终全部验收。

本版恢复 `ef27dbe` 原来圆润、单色的小猫，只增加同画风的小狗。小幅错相跳跃、摇尾、校验观察和悬停／按压反馈沿用 Carbon Atelier、Mineral Jade 和 Pearl Pro。动画服从真实更新状态；未知下载总量不显示虚构百分比，关闭窗口、降动效或关闭角色动画时停止动效。

首次使用请从官方获取 [Windows Setup](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.23/polish-sci-figures-Studio-0.1.23-Setup-x64.exe)，安装后从桌面或开始菜单启动。以后使用**更新 → 下载并准备更新 → 保存工程并勾选确认 → 安装并重新打开**。受支持的安装版在编辑器中下载、校验、安装，无需重复解压或手动替换目录。便携／未注册副本可显式打开官方 Setup 链接，同版本也可获取；此入口不授予本机安装能力，不绕过完整性校验或保存确认。旧版及长路径边界见[中文入门](../desktop/QUICKSTART.zh-CN.md#保存退出与升级)。

## 本轮实际验证

- 新 Windows x64 安装包完成安装、启动及冻结程序自检。原始 Setup SHA256 为 `224d8398be4be73d988892a10c54bc80a70af0a3f6b104dfb849d10726dad764`；80 个界面资源、27 个后端源码边界、58 个套件代码对象与 2625 个便携文件经[包源证明](qa/minimal-companions/windows-0.1.23/package-source-match.json)核对。
- [安装版实际编辑验收](qa/minimal-companions/windows-0.1.23/focused/README.md)通过：真实本机服务和 Chrome 主文档哈希一致；小猫、小狗的悬停、按压、释放与关闭动效有效；公开 Iris 的 150 条观测、12 份原 SVG、原表、方案、配方和分析完整保留。弹窗前后整个保存对象相同，真实 F2 编辑只有一次撤销记录，撤销、保存重开保留合法重做历史。双主题规范化 SVG 一致，PNG 的 2880 × 2160 RGBA 像素相同。旧工程导入仅补两个独立预期的既有编号默认值。
- [选定功能回归](qa/minimal-companions/windows-0.1.23/functional/README.md)通过 P0 72 项、资源 4 项、空白工程 1 项、普通选择 5 项和智能选图 16 项，包含预览／取消／单次撤销、边框／轴、保存重开、导出、配对设计确认和断网分支。普通选择覆盖约 8／9 个对象，不能冒充 5000 图元测试。文献失败分支通过拦截并终止请求验证；没有编造文章、图号或真实文献返回。
- 同版本重装第二次实际成功，设置、外部哨兵和实际保存的公开 Iris 工程按字节保留；随后正常卸载及独立只读终检确认四个 AppId 注册视图均不存在、隔离程序已移除，外部数据未变。[原生证明](qa/minimal-companions/windows-0.1.23/native/README.md)说明失败尝试和隔离条件。

原官方 0.1.22 → 0.1.23 的实际手动 Setup 覆盖安装、同一默认子配置／同一浏览器会话自动恢复及正常清理已完成。升级前后的完整保存文件均为 582496 字节，SHA256 同为 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`；五个核心容器、150 条公开 Iris 观测、12 份原 SVG、3 个历史状态、1 个检查点、1 份数据草稿及完整设置字节保持一致。恢复未再次手动打开工程；默认配置能力检查为 true。正常卸载后完整外部配置与已完成的浏览器证据保持不变，四 AppId 视图均不存在。这是手动原包覆盖与恢复验收，尚不是官方编辑器内下载、校验或助手交接。

[手动升级原始证据与录屏范围](qa/minimal-companions/windows-0.1.23/manual-upgrade/README.md)。

## 5000 图元性能

[独立安装版测量](qa/minimal-companions/windows-0.1.23/performance/README.md)保留全部 46 次操作：每项 3 次预热及 20 个计入分位数的样本。选择／改色的输入事件至第二次 rAF P95 分别为 **104.1／94.2 ms**。改色通过真实快捷颜色框后按 Tab 提交，不能解释为 Enter 延迟；rAF 表示呈现机会，不是光学显示延迟或持续 FPS。合成 5000 图元压力工程不属于真实生物学数据。

另行完成的默认配置 0.1.22／0.1.23 匹配测量使用同一 Chrome 155、5000 图元 SVG、1440×900 视口、DPR 1、画布几何及完整设置；每版保留全部 46 次操作（40 个测量样本＋6 次预热），前后原生／来源／设置保护均通过。选择输入至第二 rAF P95 为 172.9 → 115.2 ms，改色为 154.6 → 135.1 ms；改色 Tab 的 change/blur 提交至第二 rAF P95 为 153.8 → 134.4 ms。本次两项操作未观察到这些 P95 延迟增加。该结果来自单机顺序测量，后台活动与调度未完全控制；不能归因为普遍加速、统计显著改善、Enter 确认延迟或全部编辑功能无退步，也不与前述独立候选运行合并。

[匹配操作、全部样本与失败保留范围](qa/minimal-companions/windows-0.1.23/paired-performance/README.md)。

## 证据范围与更新顺序

这是实际本机 Windows 安装与冻结程序自检，加上安装服务上的隔离 **Chrome headless** 操作；不是干净虚拟机、物理触屏、持续性能或普通用户可用性研究。选定科研数据与编辑回归通过，不把它扩大为所有功能、所有设备均无回归。安装版测试使用显式隔离数据目录，其更新能力为 false；正常默认配置的应用内升级必须另验。

手动升级截图中的黄色重连提示来自该验收主动终止 `/api/updates` 元数据请求，现有 `engineFetch` 因此设置离线提示；真实原生 health、来源校验及默认配置更新能力检查仍通过。这组证据用于工程自动恢复、完整保存与升级保留，不据此新增本地科学计算或绘图渲染成功结论；相关绘图由前述独立 functional 套件覆盖。

首次重装因另一个同 EXE 进程占用文件失败；经用户明确批准只关闭该实例后，第二次成功。早期浏览器两次因响应体缓存和旧编号默认值预期缺失失败；测试修正保留独立科学数据断言，运行时和已验安装包未重建。后续匹配／手动升级切换了用户自行关闭旧窗口后的明确保护基线；不把中断的基准或前置防护失败算作成功。历史失败仍保留。

本轮没有重新完成 Windows 中文输入法人工测试。历史 0.1.22／source18 微软拼音人工记录与 source20 合成轴尾事件继续按[原验收范围](live-preview-validation.md)保留；本版不新增图像检测准确率、科学分析方法、Mac／移动硬件验收或性能普遍改善结论。

**官方 0.1.22 → 0.1.23 应用内真实下载、校验、安装与自动恢复：等待 0.1.23 首次公开稳定发布后立即验证，当前 `awaiting_public_stable`、`finalAcceptance: false`。** 历史 [0.1.20／0.1.21 → 0.1.22](https://github.com/zhoy0409-debug/polish-sci-figures/blob/main/docs/qa/live-preview/postrelease-20261018/README.md)不替代这次验收。发布后结果进入另名补充报告与三个附加资产，保留首次发布八资产及其校验和原字节。

安装包内本说明保留构建时的候选快照；本页是构建后的外部证据更新，不能据此推定安装包被重新构建或改变。Mac／移动端只同步源码元数据，原发布链接和移动构建编号不变。SHA256 用于文件完整性核对，不代表发布者数字签名。

## English summary

The original tiny monochrome cat returns with a matching simple dog. Real updater states, reduced motion, saved-project confirmation and integrity gates are retained. Install official Setup once, then use **Updates → Download and prepare → save and confirm → Install and reopen** from the supported installed edition.

Actual Windows installation/startup, the second same-version reinstall, normal uninstall and external-data preservation have recorded evidence. Installed Chrome headless checks retain all 150 public Iris observations, 12 original SVGs and complete scientific project content. The selected functional scope is 72 P0, 4 resources, 1 blank, 5 ordinary-selection and 16 discovery checks; this is not every editor workflow.

Actual original official 0.1.22 → 0.1.23 manual Setup overwrite, same-profile/same-session automatic recovery and normal cleanup completed. Both complete saves are 582496 bytes with identical SHA256 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`; all five core containers, 150 public Iris observations, 12 SVG sources, 3 history states, 1 checkpoint and 1 table draft are preserved. No explicit project Open repaired recovery. Default-profile capability checks were true. Normal cleanup preserved the whole external profile and finalized browser evidence and left all four AppId views absent. This verifies manual original-Setup replacement and recovery, not official in-editor download/verification/helper handoff.

The independent 5000-element capture measured selection/recolour input-to-second-rAF P95 at **104.1/94.2 ms**, using 20 measured samples plus 3 retained warmups per operation. It uses a synthetic pressure fixture, Tab colour confirmation, and presentation opportunities rather than optical latency or sustained FPS. The separate default-profile 0.1.22/0.1.23 pair matched Chrome 155, the 5000-element SVG, 1440×900 viewport, DPR 1, canvas geometry and complete settings. All 46 operations per version are retained (40 measured + 6 warmups), with before/after native/source/settings guards passing. Selection input-to-second-rAF P95 was 172.9 → 115.2 ms; recolour was 154.6 → 135.1 ms; recolour Tab change/blur commit-to-second-rAF P95 was 153.8 → 134.4 ms. These two actions showed no higher observed P95 in this pair. One-device sequential runs with uncontrolled background activity cannot establish general acceleration, statistical improvement, Enter latency or absence of every editor regression; these samples are not pooled with the standalone candidate capture.

Official app-driven 0.1.22 → 0.1.23 remains **awaiting_public_stable**, with **finalAcceptance false**, until the actual stable release is available. New native IME, detector-accuracy and Mac/mobile hardware acceptance are not claimed. The packaged notes retain their build-time snapshot; subsequent evidence is additive and the original eight assets/tag remain immutable.

The yellow reconnect notice in manual-upgrade screenshots is caused by deliberately aborting `/api/updates`; the existing engine fetch handler marks that request offline. Actual native health, source and default-profile capability checks passed. This manual-upgrade evidence verifies recovery/save preservation; scientific computation/rendering is covered separately by the functional suite.
