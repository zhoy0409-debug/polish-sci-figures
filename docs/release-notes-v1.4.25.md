# Suite v1.4.25 · Figure Studio 0.1.25

Candidate status on 2026-10-18: not yet published. The final revised Windows candidate passed the selected source, browser, installed-editor and normal install/reinstall/uninstall checks below. Exact-head CI and the genuine public 0.1.24 → 0.1.25 upgrade with matched performance remain pending. The [published 0.1.24 and its rejected matched-performance gate](release-notes-v1.4.24.md) remain separate.

## 中文

### 改动范围

本补丁复用现有属性快照缓存：四处经审阅的纯读属性面板调用直接读取分离的 canonical SVG 快照，减少同一轮读取中的重复深拷贝。现有 `editableSource` 仍向写入消费者返回独立克隆；原工程／状态、语言、字体及派生渲染等失效条件保留，不能跨工程或错误复用旧状态。科学分析、原始数据、可编辑图形与保存／撤销语义不在本次改动范围内。

更新窗口仅在需要显示时挂载心形资源，隐藏／销毁时释放对应内容；保留现在的简约小猫小狗、透明翡翠心形、Carbon Atelier / Mineral Jade / Pearl Pro、降动效及反复开关生命周期。水位只来自真实收到字节／实际总量，总量未知时不造百分比；下载、校验、确认安装、安装中与完成继续区分。该生命周期调整不作为 5000 图元性能问题的单独因果结论。

版本信息区改用共享网格行对齐标签与版本值，替换以固定像素定位的字符箭头，采用简洁的翡翠矢量箭头。修订后已在真实 Chrome 中检查中英文、深浅主题、窄窗口和模拟 DPR 的 24 种布局，并重新构建、安装和验收最终包。

### 使用与验收状态

正式发布后首次使用可从官方直接运行 Windows Setup，无需解压；受支持安装版以后在**更新 → 下载并准备更新 → 保存并确认 → 安装并重新打开**中升级。科研工作继续在本地进行，更新服务不接收图片、数据表或工程。

最终候选已完成三组科学源码回归、30 组 DOM 回归、实际安装版五组功能（72／4／1／5／16 项）、公开 Iris 数据 150 个观测／12 个 SVG 源的保存重开、F2 修改及一次撤销、双主题 SVG／RGBA 一致性，以及正常安装／覆盖安装／卸载后的工程与设置逐字节保护复查。候选自定义数据目录不具备编辑器内安装权限，该项不冒充真实升级。

最终安装包的单次 5000 图元原协议测量保留全部 46 次操作（40 次测量、6 次预热），选择／改色第二次 rAF 等待 P95 分别为 79／71.2 ms。这是本机候选结果，尚非匹配的官方24→25性能结论，也不是光学延迟、持续帧率或所有设备表现。[完整候选证据](qa/jade-hearts/windows-0.1.25/README.md)保留历史拒绝结果、所有样本和原始媒体的有限采样范围。

精确提交 CI、公开稳定版元数据及同 profile 官方24→25更新／匹配性能待随后验证；只有真实升级才可核实原0.1.24绘制0.1.25下载。本次构建中的根目录说明和快速入门保留构建时状态，最终状态将在发布后文档提交中同步，安装包不据此重写。

未声明新增中文输入法、图像检测准确率、Mac／移动设备或所有工作流验收。旧版本 tag、初始资产与完整原始性能样本保留。

## English

The inspector change reuses the existing detached canonical SVG snapshot for four reviewed read-only consumers. The existing `editableSource` API continues returning an independent clone to mutating consumers, with the original project/state, language, font and derived-render invalidation rules retained. Scientific analysis, source data, editable figures and save/undo semantics remain outside this patch's change scope.

The update scene mounts heart resources when needed and releases them on hide/destroy. It retains the current simple cat/dog, transparent jade hearts, Carbon Atelier / Mineral Jade / Pearl Pro, reduced motion and repeated-open lifecycle. Water follows genuine received/total bytes; unknown totals, integrity checks and confirmed installation remain distinct. Lazy mounting alone is not the asserted cause or proof of the 5000-element performance fix.

The version information uses shared grid rows for labels and values, with a restrained jade vector arrow replacing the fixed-position text glyph. The revision passed 24 controlled Chrome layout cases across English/Chinese, dark/light, narrow windows and emulated DPR, followed by a fresh Windows build and installed acceptance.

After publication, first use remains direct Windows Setup; supported later upgrades use **Updates → Download and prepare update → save and confirm → Install and reopen**. Images, tables and projects are not sent to the update service.

The final candidate passed three selected scientific source groups, 30 DOM groups, five installed functional suites (72/4/1/5/16 checks), public Iris save/reopen and F2/one-undo checks, theme SVG/RGBA equality, and normal install/reinstall/uninstall preservation. Its custom data directory has in-app installation disabled. All 46 original 5000-element operations are retained; selection/colour second-rAF P95 was 79/71.2 ms in this single candidate capture. These are rAF opportunities, not optical latency, sustained FPS or universal device results. [Candidate evidence](qa/jade-hearts/windows-0.1.25/README.md) retains rejected historical results and bounded original-media sampling.

Exact-head CI and the genuine public 0.1.24 → 0.1.25 matched-profile upgrade/performance acceptance remain pending. Build-time root guides retain their initial status; a later documentation commit will record final results without rewriting the original installer. No new native IME, detector-accuracy, Mac/mobile or all-workflows result is claimed; previous tags, assets and complete samples are preserved.
