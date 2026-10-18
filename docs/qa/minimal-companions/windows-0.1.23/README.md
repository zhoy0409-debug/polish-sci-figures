# Windows 0.1.23 · package and actual acceptance

**实际验收记录（发布后）：** 五项发布前检查及原官方 0.1.22 → 0.1.23 应用内升级、自动恢复和正常清理均已有独立证据；本页更新为六项实际验收结果，仍保留各自测试范围。

本页汇总本轮新 Windows 原包的构建、实际安装及有边界的科研／编辑验收。安装包保留构建时的文档快照；本页后补验收不改写原包字节。

| 实际范围 | 结果与证据 |
| --- | --- |
| 全量构建／来源 | [构建](build-summary.json)退出 0；[包源核对](package-source-match.json)为 80 UI、27 后端源码边界、58 套件代码对象、2625 便携文件；[冻结](source-freeze.json)及[原生代码只读预检](native-code-preflight.json)分别记录自己的范围。 |
| 安装／启动 | 实际原始 Setup 安装、启动、冻结自检通过；自检移除 PATH 中的系统 Python，并设置无效 PYTHONHOME；隔离本机服务与原包身份一致。[原生记录](native/README.md)。 |
| 真实数据及猫狗 | [focused](focused/README.md)：原简约小猫和同画风狗的真实指针／关闭动效有效；公开 Iris 150 条观测、12 原 SVG、完整原表／变体／配方／分析保留；全保存对象、单次撤销、保存重开、双主题导出检查通过。 |
| 高频功能 | [functional](functional/README.md)：P0 72、资源 4、空白 1、普通选择 5、智能选图 16；保留预览、取消、Undo/Redo、设计确认、离线及受控文献请求失败检查。选定套件通过，不代表所有套件已跑。 |
| 重装／卸载 | Reinstall r2 成功；正常卸载和独立终检确认四 AppId 视图缺失、隔离 EXE 移除，设置、外部哨兵和实际保存的公开 Iris 均按字节保留。失败 r1 保留。[native](native/README.md)。 |
| 独立 5000 图元 | [performance](performance/README.md)：选择／改色输入至第二 rAF P95 104.1／94.2 ms；每项 20 个测量样本＋3 次预热，全部 46 次操作保留。 |

原官方 0.1.22 → 0.1.23 的实际手动 Setup 覆盖安装、同一默认子配置／同一浏览器会话自动恢复及正常清理已完成。升级前后的完整保存文件均为 582496 字节，SHA256 同为 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`；五个核心容器、150 条公开 Iris 观测、12 份原 SVG、3 个历史状态、1 个检查点、1 份数据草稿及完整设置字节保持一致。恢复未再次手动打开工程；默认配置能力检查为 true。正常卸载后完整外部配置与已完成的浏览器证据保持不变，四 AppId 视图均不存在。这是手动原包覆盖与恢复验收，尚不是官方编辑器内下载、校验或助手交接。

[手动升级原始证据与录屏范围](manual-upgrade/README.md)。

另行完成的默认配置 0.1.22／0.1.23 匹配测量使用同一 Chrome 155、5000 图元 SVG、1440×900 视口、DPR 1、画布几何及完整设置；每版保留全部 46 次操作（40 个测量样本＋6 次预热），前后原生／来源／设置保护均通过。选择输入至第二 rAF P95 为 172.9 → 115.2 ms，改色为 154.6 → 135.1 ms；改色 Tab 的 change/blur 提交至第二 rAF P95 为 153.8 → 134.4 ms。本次两项操作未观察到这些 P95 延迟增加。该结果来自单机顺序测量，后台活动与调度未完全控制；不能归因为普遍加速、统计显著改善、Enter 确认延迟或全部编辑功能无退步，也不与前述独立候选运行合并。

[匹配操作、全部样本与失败保留范围](paired-performance/README.md)。

## Exact artifacts

| 原文件 | Bytes | SHA256 |
| --- | ---: | --- |
| polish-sci-figures-Studio-0.1.23-Setup-x64.exe | 105868443 | `224d8398be4be73d988892a10c54bc80a70af0a3f6b104dfb849d10726dad764` |
| polish-sci-figures-Studio-0.1.23-Portable-x64.zip | 147699955 | `cd3d2cb353e6a4dc78df0776c5aaa7b208dc8ac05f94a3c3ffef5d96a72521a7` |

冻结 source23 SHA256：`cddcc96746a8733fa2866cfee39ca725af365cf5960c28dfc512e499b727128a`。原生只读模块核对不等于安装成功；实际安装记录单独提供。最终文档提交需自己的 exact-head 八项 CI，历史 `a362947` 已完成的八项 CI 不替代后续提交。

## 保留的失败与范围

早期 focused r1 因 Chrome 响应体缓存取证失败，r2 因测试遗漏原有编号默认值预期失败；r3 以独立 CDP 主文档证据及来自原始输入的两个编号默认值通过，未放宽原始科研数据断言。重装 r1 被另一个同 EXE 实例占用而失败；用户明确授权只处理该实例后 r2 成功。旧版匹配测量一度完成原始基准但最终保护进程检查失败；不作为通过结果或版本改善证据。原 22 的一次手动安装前置校验因旧缓存目录变为 Junction 而拒绝，安装器未执行；随后只读复制官方摘要匹配的原归档到全新普通目录，不修复或删除原 Junction。

这轮是本机实际 Windows 安装及冻结程序自检，编辑操作由隔离 Chrome **headless** 连接真实服务完成，不是全流程原生鼠标／输入法验收。显式数据目录下 `inAppInstall: false`，不能替代默认配置的真实应用内升级。P0 的视口大小／DPR 是浏览器几何，不是物理屏幕与 Windows 缩放。5000 图元是合成压力夹具；Tab 改色时间不能解释为 Enter 确认延迟，rAF 不是光学延迟或持续 FPS。文献失败使用请求中止，不虚构论文返回。

手动升级的两张截图有黄色重连提示：验收主动终止 `/api/updates` 元数据请求后，现有 `engineFetch` 将该请求标记离线；真实原生 health、来源与默认配置更新能力检查通过。这组验收证明工程恢复、保存和保留，不从该提示画面额外推断本地科学计算／渲染成功；独立 functional 记录承担相应绘图验证。

本轮无新增原生微软拼音人工验收、真实图像检测准确率、触屏、Mac／移动硬件或普通新用户研究。历史输入法及 0.1.22 官方升级证据继续绑定历史版本。用户自行关闭旧窗口后的匹配／手动升级采用新的明确保护基线，不能宣称同一旧窗口始终存在。公开原录屏只表示未剪辑，不代表逐帧人工隐私／视觉审阅。

## 官方应用内升级实际完成

原官方 0.1.22 客户端已通过编辑器完成一次真实下载、校验、保存确认、安装及重新打开；同源自动恢复无需再次打开工程。完整保存文件前后均为 582496 字节，SHA256 同为 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`；五个核心容器及完整设置字节保持一致，含 150 条公开 Iris 观测、12 份原 SVG、3 个历史状态、1 个检查点和 1 份表格草稿。完整旧版本回滚备份实际核对 2624 个文件，新版 80 个界面资源与原包匹配。更新助手自然退出后，正常卸载返回 0、四个 AppId 视图缺失，完整外部配置及已完成浏览器证据保留。重启后的 0.1.23 默认配置简约猫狗、指针／降动效和双主题科学导出另行通过。 [官方原始证据、进度采样及录屏范围](official-update/README.md) · [新增六项 final acceptance](final-acceptance.json)。首次八资产与标签不变，[初始 readiness](publication-readiness.json)的 pending/false 保留其发布时真实快照。后续补充文件采用另名资产及独立校验清单。

## English

Actual original-Setup Windows install/start, frozen self-test, second same-version reinstall, normal uninstall and byte-exact preservation have separate evidence. Installed Chrome headless checks retain the complete public Iris scientific payload (150 observations/12 SVG sources), test the original small cat plus matching dog, and pass the selected 72 P0/4 resources/1 blank/5 ordinary selection/16 discovery cases. The standalone 5000-element P95 is 104.1/94.2 ms; matched-version conclusions are separate.

Actual original official 0.1.22 → 0.1.23 manual Setup overwrite, same-profile/same-session automatic recovery and normal cleanup completed. Both complete saves are 582496 bytes with identical SHA256 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`; all five core containers, 150 public Iris observations, 12 SVG sources, 3 history states, 1 checkpoint and 1 table draft are preserved. No explicit project Open repaired recovery. Default-profile capability checks were true. Normal cleanup preserved the whole external profile and finalized browser evidence and left all four AppId views absent. This verifies manual original-Setup replacement and recovery, not official in-editor download/verification/helper handoff.

The separate default-profile 0.1.22/0.1.23 pair matched Chrome 155, the 5000-element SVG, 1440×900 viewport, DPR 1, canvas geometry and complete settings. All 46 operations per version are retained (40 measured + 6 warmups), with before/after native/source/settings guards passing. Selection input-to-second-rAF P95 was 172.9 → 115.2 ms; recolour was 154.6 → 135.1 ms; recolour Tab change/blur commit-to-second-rAF P95 was 153.8 → 134.4 ms. These two actions showed no higher observed P95 in this pair. One-device sequential runs with uncontrolled background activity cannot establish general acceleration, statistical improvement, Enter latency or absence of every editor regression; these samples are not pooled with the standalone candidate capture.

These remain scoped actual-installed tests, not every scientific workflow, optical latency, a new native IME session or detector-accuracy validation. The original official 0.1.22 client completed one actual in-editor download, verification, saved-project confirmation, installation and reopen. Same-origin automatic recovery required no explicit project Open. Both full saves are 582496 bytes with SHA256 `1974a7b03b462aa46fde5bae5d7a39902305b1751d8dfd6965df24b155f9a975`; all five core containers and complete settings bytes are exact (150 public Iris observations, 12 original SVGs, 3 history states, 1 checkpoint and 1 table draft). All 2624 actual original backup files and 80 new UI resources matched. The helper exited naturally before normal uninstall exit 0; four AppId views were absent and the full external profile/finalized browser evidence remained preserved. Separate restarted23 default-profile checks passed the simple companions, pointer/motion controls and both scientific export themes. Later evidence is additive; the original Setup, initial eight assets/tag and original pending readiness are never rewritten.

The manual-upgrade yellow notice reflects the deliberate `/api/updates` abort and existing offline UI handling, while native health/source/capability guards passed. That run establishes project recovery/save preservation; separate functional tests cover scientific computation/rendering.
