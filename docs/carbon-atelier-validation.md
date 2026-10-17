# Carbon Atelier 与更新场景验收汇总

本记录汇总 Suite v1.4.21 / Figure Studio 0.1.21 的界面、科研作品隔离与更新展示验证，区分源码浏览器、受控组件和真实安装器的证据。**截至 2026-10-17，最终 Windows 安装包、便携包、22 图安装版矩阵与 48 项标题栏复核均已有通过记录。** 候选阶段的真实 CLI 升级及实际 Windows 三档缩放分别保留。5000 图元选择／改色的性能尾部退步仍未解决；本轮按可安装 **PRE-RELEASE** 定位交付，稳定推荐保持 0.1.20，不宣称整项体验与性能任务全部完成。

[证据索引](#证据索引) · [浏览器范围](#真实浏览器与数据范围) · [更新验证](#更新展示与真实安装验证) · [性能与待验范围](#性能结果与发行待验范围)

## 证据索引

基线固定为 `2c6d11a0b494c3668a929cc272482e74be58e0fe`，对应 Suite v1.4.20 / Studio 0.1.20。以下链接均为已有安全记录；原始浏览器日志和完整工程保留在忽略缓存中，公开材料仅使用公共数据、许可图片和明确标注的工程示例。

| 范围 | 可核对记录 | 已确认结果及边界 |
| --- | --- | --- |
| 原版保留 | [基线保存核对](qa/carbon-atelier/baseline-preservation.json)、[基线浏览器记录](qa/carbon-atelier/baseline-browser-acceptance.json) | HTML 与 67 个资源文件冻结后未改变；不把后来修复倒写进基线 |
| 设计令牌 | [迁移说明](qa/carbon-atelier/design-tokens.md)、[原始统计](qa/carbon-atelier/token-audit-baseline.json)、[当前统计](qa/carbon-atelier/token-audit-current.json) | 在原组件声明处迁移，统一双主题及交互状态 |
| 组件 Chrome | [组件记录](qa/carbon-atelier/theme-component-checks.json) | 双主题、代表性文字／控件、精确悬停／按压色、焦点、降动效与科研 SVG 示例隔离 |
| 实际页面与导出 | [浏览器记录及复跑入口](qa/carbon-atelier/browser-validation.md)、[52 图安全记录](qa/carbon-atelier/source-browser-acceptance.json) | 52 张功能截图，另列对比度检查；源表、源 SVG 与导出像素比较 |
| 工具栏与标签 | [12 组合布局记录](qa/carbon-atelier/theme-layout-checks.json) | 文字选择前后几何稳定、标签完整、短图层名可读、编辑手柄为深翡翠绿 |
| 上下文与恢复 | [轴／保存状态／周边补查](qa/carbon-atelier/context-acceptance.json)、[3 视口恢复记录](qa/carbon-atelier/layout-restoration-checks.json) | 源码实际页面的上下文、恢复、适应窗口与撤销复核；不代替安装版验收 |
| 非浏览器回归 | [完整脚本结果](qa/carbon-atelier/regression-summary.json) | 55 个脚本、59 项语法检查通过；4 个更新 JS 脚本在暂停显示修复后专项复跑 |
| 图形保护 | [声明与模块保护检查](qa/carbon-atelier/token-protection-checks.json) | 图片 UI 模块除样式外代码未改变；原有非编辑辅助 SVG 绘制声明未改变 |
| 更新组件 | [13 场景 Chrome 记录](qa/carbon-atelier/update-scene-controlled.json)、[场景设计说明](update-scene-design.md) | 受控传输响应，不是实际下载安装录像 |
| 正式性能 | [无录屏基线](qa/carbon-atelier/baseline-no-video-performance-summary.json)、[候选](qa/carbon-atelier/current-no-video-performance-summary.json)、[对照](qa/carbon-atelier/no-video-performance-comparison.json) | 各操作 12 次；普通工程改善，5000 图元选择／改色尾部回退保留 |
| Windows 候选 | [实际 CLI 升级](qa/carbon-atelier/windows-cli-upgrade-verification.json)、[便携版](qa/carbon-atelier/windows-portable-verification.json)、[22 图安装版矩阵](qa/carbon-atelier/windows-installed-browser-acceptance.json) | 按候选各自哈希识别；原矩阵的窄标题栏视觉问题保留，未改写为最终成品结果 |
| 最终 Windows 成品 | [安装包](qa/carbon-atelier/windows-final-installer-verification.json)、[便携包](qa/carbon-atelier/windows-portable-final-verification.json)、[最终 22 图矩阵](qa/carbon-atelier/windows-installed-final-browser-acceptance.json) | 实际安装／运行时与最终页面复核通过；数据、SVG 与导出保持 |
| 实际系统缩放 | [Windows 汇总索引](qa/carbon-atelier/windows-acceptance-index.json)及 [100%](qa/carbon-atelier/windows-os-scale-100-verification.json)／[125%](qa/carbon-atelier/windows-os-scale-125-verification.json)／[150%](qa/carbon-atelier/windows-os-scale-150-verification.json) | 原生最大化 Chrome，未用 DPR 仿真替代系统设置；保留首次 125% 超时 |
| 标题栏修复 | [48 组合源码复核](qa/carbon-atelier/header-layout-verification.json)、[最终安装版 48 项](qa/carbon-atelier/header-installed-final-verification.json) | 保存／保存中／长错误／长冲突文字完整，首要按钮可达且与工程标题分离 |
| Suite／Skill 发布包 | [发布包检查](qa/carbon-atelier/release-package-verification.json) | 两种 ZIP 的成员／校验／冻结源码匹配、解包 CLI 与 Skill 原始表流程通过 |
| 降速离线功能 | [4× CPU 离线记录](qa/carbon-atelier/windows-slow-cpu-preheader.json) | 修复标题栏前的候选，16 个功能步骤完成；不作为正式性能通过 |

脚本数与断言数不同；语法检查也不代表功能、打包或安装通过。因网络沙箱无法创建本机测试套接字而失败的初次尝试保留在回归记录中，同一未修改脚本获本机套接字访问后复跑通过。

## 真实浏览器与数据范围

源码界面使用 Windows Google Chrome 155.0.8059.82。功能矩阵为临时隔离浏览器上下文；外部 HTTP 请求被阻止，未发送研究数据。

| CSS 视口 | 浏览器 DPR | 每个主题检查内容 |
| --- | --- | --- |
| 1280×720 | 1 | 新工程、SVG 文字、坐标轴属性、病理图片、图片查重 |
| 1440×900 | 1 | 上述五项及明确标注示例数据的智能选图候选 |
| 1920×1080 | 1 | 上述五项 |
| 1440×900 | 1.25 | 上述五项 |
| 1440×900 | 1.5 | 上述五项 |

Carbon 和 Pearl 合计 10 个主题／视口／DPR 组合、52 张截图，覆盖六种界面状态。候选页面只在 1440×900、DPR 1 的两主题中截图，不能写成全部状态均覆盖所有组合。主题偏好在重载后恢复。独立布局脚本另以 1280／1440／1920×900、中英两种语言、两种主题检查 12 组合，插入临时文字再清除选择，确认工具栏、视口与图纸大小／位置稳定。

真实数据工程使用公开 UCI Iris 的 150 行测量；H&E 图片使用 Kilbad 公有领域图片，来源与校验值见[浏览器记录](qa/carbon-atelier/browser-validation.md#真实项目与导出保护)。Iris 用于实际工程、文字、坐标轴和数据保留验证，不据此推断实验独立性或增加统计检验。候选示例及 120／5000 图元的压力素材均明确属于工程构造数据。

浏览器 `deviceScaleFactor` 只仿真光栅密度，**DPR 1.25／1.5 不等于 Windows 系统 125%／150% 缩放**。本轮另在实际系统设置下运行安装候选，记录浏览器自然尺寸，并保存 [100% 设置](qa/carbon-atelier/windows-scale100-settings.jpg)、[125% 设置](qa/carbon-atelier/windows-scale125-settings.jpg)、[150% 设置](qa/carbon-atelier/windows-scale150-settings.jpg)与[恢复 150% 的设置](qa/carbon-atelier/windows-scale-restored150-settings.jpg)。三组各有双主题、更新窗口与关闭角色动画共六张截图；它们属于最后标题栏修复之前的阶段，未将最终重打包文件逐档重跑。不将固定 CSS 视口与原生窗口尺寸混为一谈。

100%／125% 复跑均记录真实更新响应为 `current`、`freshCurrentReleaseConfirmed: true`。较早 150% 记录没有新增的 fresh／stale 字段，汇总保持缺失。首次 125% 运行只等待 `scene=current` 60 秒而超时，[原始失败审计](qa/carbon-atelier/windows-os-scale-125-initial-failure.json)保留 SHA-256；当时没有最终更新器状态，不能据此认定离线。后续允许记录真实结束状态的复跑独立通过，未覆盖这次失败。

## 科研作品与导出隔离

本次主题迁移不修改科学分析、数据合同、图形 palette、图片调整参数或用户 SVG 原始绘制值。三份图片 UI 模块去掉样式片段后，与基线代码相同；CSS 保护检查排除明确的编辑辅助选择框与手柄，保留其余原有 `fill`／`stroke` 声明。

实际 Iris 工程在 Carbon 与 Pearl 下的原始源表、原始源 SVG、输出 PNG 以及逐像素 SHA-256 一致。PNG 为 2880×2160 像素，像素哈希为 `b30373809b4b2d95bdd794cbb4b29d40edcad1d14a220f74680f8a273a616a92`。SVG 导出器原本会递增 `fNN-` ID 命名空间，同主题连续导出也有不同原始字节；只规范化已核实的 ID 及对应引用后，两主题规范化哈希均为 `b76582d84052bfc4f6e5de92050acc8b2fd2f1db4bf609a2949a3af38d43847a`。文字、颜色、元数据与科学内容不参与这种规范化，原始哈希同时保留。

上述结论对应这个实际工程和导出器路径，不替代其他图形、格式或期刊尺寸的终稿检查。组件中的固定 `currentColor` SVG 也完成了 DOM、绘制属性与裁切光栅一致性检查；它是主题边界的工程回归，不作为科研图像算法准确率证据。

新增 Chrome 组件回归验证了 `--ink`、`--text`、`--card`、`--border` 四种 SVG 颜色 fallback 及用户显式定义的 `--ink`：两主题均保留预期颜色和原始 DOM。删除未使用的通用别名后，主题根变量为 93 项（80 个命名空间令牌、13 个原有别名）。两项侧栏宽度通过非继承注册继续控制网格，并确认科学 SVG 不继承拖动后的宽度值；这些功能断言不等同于最终性能结论。

## 实际发现与修复

本轮保留失败记录，并区分原有缺陷、修复与复核结果。

- **工程恢复错误：** 导入后改色／撤销或拖动／撤销，再刷新可触发 `undefined variant`；冻结基线也复现。源码修复了恢复时的版本选择，后续工程复核与最终安装版恢复仍按各自记录判断。
- **选择引起 fit 跳动：** 1280 宽等条件下，选中文字让快捷栏增加 42px，挤压或下移图纸。现仅在栏宽或语言变化时测量较大的上下文布局，选择本身不重新测量；12 组合布局复核通过。
- **状态文字低对比：** 初次真实页面抽样保留了 [1317 条可评分样本及两处失败](qa/carbon-atelier/ui-contrast-initial.json)。两处均为同一状态文字在 Carbon／Pearl 下误用了主按钮前景色。原组件规则已改为次级文字色，新增对应组件回归；真实页面轴属性／保存状态专项复核另行归档。功能截图通过不能替代对比度检查，也不构成全页面 WCAG AA 认证。
- **断联进度回退：** 真实旧安装器准备后断联时，场景曾回到零位置并丢失下载信息。现按服务端已接受的阶段和字节保留下载包快照，明确标注“不是安装进度”；乐观的准备请求不算已确认。安装进度仍未知，安装按钮不因断联出现，新下载清空旧作业快照。
- **窄窗口标题栏重叠：** 22 图安装候选矩阵的人工检查发现 1280 英文保存状态被 Appearance 控件覆盖。已在原主题 CSS 修正标题列和控制组收缩，并让完整错误／冲突文字换行。源码及最终安装版均以 3 视口 × 2 语言 × 2 主题 × 4 状态完成 48 项复核；最终实际 Iris 页面也经人工检查。初版自动化缺少兄弟组重叠断言、人工仍发现遮盖的记录及候选视觉标记一并保留。

PR #30 的[首次浏览器 CI 作业](https://github.com/zhoy0409-debug/polish-sci-figures/actions/runs/39030576915/job/117390027958)在 `test_studio_text_formatting.cjs` 的旧 UI 硬编码颜色断言处失败：迁移后返回语义令牌，而测试仍期待旧 RGB。测试已改查语义令牌和禁用规则，本地 23 项通过；实际颜色另由 Chrome 组件检查覆盖。该记录保留初次 CI 失败，后续 CI 是否通过须以新作业结果为准。

## 更新展示与真实安装验证

受控 Chrome 场景覆盖静态主姿态、下载 0／13／52／99／100%、已核验可安装、准备、断联、错误、未知总量、手动关闭动画和系统降动效。下载 100% 显示校验，不自动解释为安装完成；数字、原生进度、保存确认与装饰角色分开。窄视口和 DPR 仿真的边界、可滚动到操作按钮及资源体积见[组件原始记录](qa/carbon-atelier/update-scene-controlled.json)。短组件运行测量不用于宣称完整编辑器持续帧率或 GPU 占用。

独立测试配置中实际运行了官方 **0.1.19 后端 → 官方 0.1.20 安装包**，只给旧客户端接入本次 Carbon 展示层，没有模拟下载或安装传输。首次等待界面超时的尝试未发送下载／安装命令。后一次实际流程分别发送一次下载和一次安装，观测到 `idle`、`checking`、`downloading`、`ready`、`preparing`、`paused`，并确认重开版本为 0.1.20。

该实际流程的总结果保留为**未通过**：安装后的自动化定位器 `#artboard svg` 同时匹配两个元素，后验检查停止。独立 continuation 没有再下载或安装，确认已服务 0.1.20、显式打开升级前 JSON 后工程与源表可读，源表 SHA-256 与升级前一致，原始失败证据未改动。该 continuation 为 **PASS**，不把原运行改成通过，也没有证明工程自动恢复；其 `automaticProjectRestore` 为 `false`。这个旧版本实测也不能替代 0.1.21 新安装包验收。

真实录像没有观测到短暂的 `verifying` 和 `installing` 阶段，不插入、补拍或重建这些片段。受控组件截图只证明对应 UI 状态，不能填补真实安装器录像的观测空白。实际操作脚本见[真实 Windows 更新验收入口](../scripts/test_studio_update_real_windows.cjs)，原始录像和安装记录在隔离 QA 缓存保留；公开索引在[浏览器验收记录](qa/carbon-atelier/browser-validation.md)持续汇总。

本轮还实际执行了 **0.1.20 → 0.1.21 CLI 安装器升级**，安装一次、退出码 0。同一浏览器上下文与原地址重载后自动恢复工程，未再显式 Open；原表、原 SVG、编辑状态、端口及完整 settings JSON 保持一致，另一个既有用户进程未被控制。该证据属于 CLI 升级，不冒充应用内下载安装阶段录像。

便携候选在全新目录解压，2531 个应用文件逐一匹配构建哈希；实际 EXE 在独立数据／输出目录、仅 Windows 系统目录的 PATH 及故意不可用的 PYTHONHOME 下退出 0，并确认 frozen 运行时、Tk、HTTP 分析／重绘／尺寸重排、PDF、OpenCV 和 SIFT。便携版 `inAppInstall=false`，已登记的安装器目录属于另一个 QA 实例。这些图像检查是明确的构造打包素材，不是科研检测准确率。

安装版候选另完成 22 张功能截图；1280 双主题六状态的 1174 个可评分文字样本无失败、最低比值 4.978。其报告仍保留上述标题栏视觉问题；功能或对比度通过不表示全视觉通过。安装与便携记录按各自成品哈希识别，生成于最后的标题栏 CSS 修复前，不能直接当作随后重打包文件的验收。

最终重打包另行完成了以下成品验证，未覆盖候选旧记录：

- **Setup：** SHA-256 为 `35d76ea2a4c4a471fada83723a3802bc29478793d49be5498c3ae61c1f7e5200`。实际安装、2531 个应用文件匹配、冻结 EXE 的 13 项自检、重装保留工程与设置、卸载保留外部数据均通过。隔离自检目录中的更新资格与实际安装页面分别判断；最终安装版页面另确认 `inAppInstall=true`。
- **Portable：** SHA-256 为 `8287b1c196be9c0eef5d374a079e4d3bff195081cffc8d9f585c5462b968505c`。全新目录解压，2531 文件匹配，实际冻结 EXE 自检退出 0，更新资格为 `false`；包内标题栏 CSS 与冻结源码逐字节一致。
- **最终浏览器：** 22 图功能矩阵通过，原表／原 SVG 与 PNG／规范化 SVG 对比保持一致。1280 双主题六状态的 1176 个可评分文字样本无失败、最低比值 4.978。最终安装版的 48 项标题栏边界与键盘可达检查通过；人工查看实际保存状态已与 Appearance 分离。该范围不是整页 AA 认证。
- **原生启动：** 从实际最终 EXE 的启动器点击 Open editor，新开的 Edge 页面未重新加载即读到 0.1.21，保留 Pearl 偏好，控制组 `flex-shrink: 0`、标题区 `min-width: 120px`。[原生启动截图](qa/carbon-atelier/windows-final-native-launcher.jpg)与安装包报告共同记录这一路径。

4× CPU 降速且离线的 16 步功能检查属于修复标题栏前的安装候选，覆盖公开 Iris 的打开、选择、改色、保存、撤销／重做和主题操作。它确认这些步骤可完成，不是最终成品的正式延迟基准，也不消除下面保留的 5000 图元性能回退。

## 性能结果与发行待验范围

正式无录屏对照在同一 Windows 设备、Chrome 155、视口、操作顺序及采样方式下完成，120／5000 图元每种操作各 12 次。120 图元五类操作的输入到下一 rAF 的 P95 均低于 100 ms；选择和改色到第二次 rAF 的 P95 分别为 118.9／180.8 ms，不能写成所有可见响应均低于 100 ms。

5000 图元的正式结果如下。箭头为冻结基线 → 当前候选，单位均为 ms；完整 P50／P95、长任务及帧长分布保留在[机器可读对照](qa/carbon-atelier/no-video-performance-comparison.json)。

| 操作 | 下一 rAF P50 | 下一 rAF P95 | 第二次 rAF P95 |
| --- | ---: | ---: | ---: |
| 选择文字 | 280.3 → 281.8 | 325.7 → 387.4（+18.9%） | 539.9 → 722.8（+33.9%） |
| 改文字颜色 | 382.3 → 399.9 | 485.2 → 564.2（+16.3%） | 681.7 → 822.0（+20.6%） |
| 拖动图形 | 0.2 → 0.2 | 0.3 → 0.3 | 11.9 → 8.8 |
| 调整侧栏 | 0.2 → 0.2 | 0.4 → 0.4 | 185.1 → 150.3 |
| 切换属性标签 | 177.7 → 174.6 | 792.9 → 793.7 | 1130.9 → 1156.5 |

拖动项的时间从首个移动输入起算，不包含整个手势及释放后的提交。侧栏整操作墙钟中位耗时由 785.9 降至 602.6 ms，包含自动化操作开销。标签测试交替打开配色与属性两类面板，[按方向拆分](qa/carbon-atelier/no-video-tab-directions.json)各为 6 次，避免用混合中位数代表单一面板。选择／改色的中位耗时接近基线，尾部退步仍是未解决结果；不能据此宣称全部大图操作无回退。

首轮含录屏的退步记录与优化诊断继续保留在[浏览器记录](qa/carbon-atelier/browser-validation.md)中。优化后含录屏条件未正式复测；不得把无录屏的新结果覆盖或混入旧条件。最终状态与未完成范围如下。

| 范围 | 最终状态 | 证据边界／未完成项 |
| --- | --- | --- |
| Windows 最终安装／便携包 | **范围内 PASS**：安装、2531 文件、冻结自检、重装／设置保留、卸载数据保留、便携资格均有独立最终报告 | 一台本机 Windows 环境；不作为其他账号、设备或干净虚拟机的广泛兼容认证 |
| 最终安装版页面与标题栏 | **范围内 PASS**：22 图矩阵、1176 个文字样本、48 项标题栏及原生启动路径 | 保留旧候选视觉标记；不宣称全页面 AA、GPU 利用率或全部图型验收 |
| 实际系统缩放 | **候选阶段 PASS**：100%／125%／150%，系统恢复 150%，首 125% 失败与复跑分别保存 | 未在最后标题栏修复的包上逐档复跑，不将阶段证据改标为最终包三档通过 |
| Suite／Skill ZIP | **范围内 PASS**：文件匹配、解包 CLI、字节码、16 行原始表至 3 候选及可编辑页 | 需声明的 Python 环境和依赖；不替代原生桌面验收 |
| 编辑性能 | **尚未完成**：普通工程与侧栏改善，正式对照保留 | 5000 图元选择／改色尾部回退仍须修正与复测；优化后含录屏条件未正式复测 |
| 原生其他平台 | **本轮未验** | Mac／Android／iOS 新成品或真机验证未完成，不从共享源码推断通过 |
| 发行定位 | **可安装 PRE-RELEASE**；稳定推荐保持 0.1.20 | 发布与合并状态以 GitHub 实际记录为准；不把预发行交付解释为全部升级任务完成 |

120／5000 图元测量考察编辑器负载，不是科研算法准确率。浏览器下一帧机会、事件延迟、录像开销与系统后台负载应按测量协议报告，不能折算成所有设备持续 60 fps。角色动画的短测量与编辑器正式性能对照也分开报告。

用户操作见[外观与更新指南](figure-studio-appearance.md)，版本范围见[v1.4.21 发行说明](release-notes-v1.4.21.md)。后续补充实际验收时应更新上述状态，并保留原始未通过和未观测项目。
