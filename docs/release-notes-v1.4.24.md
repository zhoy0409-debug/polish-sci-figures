# Suite v1.4.24 · Figure Studio 0.1.24

Status on 2026-10-18: this patch is in development and has not been published. The outline-heart update display, Windows package, scientific/editor regression and real official upgrade still require their own tests. The [published v1.4.23](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.4.23) and its [actual acceptance record](release-notes-v1.4.23.md) remain available and unchanged.

## 中文

本轮计划保留现有简约小猫与小狗，在更新窗口加入透明空心心：按实际收到的下载字节，让翡翠色水面从下向上填入。下载总量未知时不显示虚构百分比；下载完成、完整性校验、可安装与安装中分别表达。关闭角色动画或启用系统降动效后，进度仍应保持可读。

本轮只调整更新展示与相应版本说明，沿用 Carbon Atelier、Mineral Jade 与 Pearl Pro。科研数据、图形、历史记录、工程编辑及更新完整性／安装确认机制应保留；是否无回归，须以本轮实际测试为准。

### 安装与升级

正式发布后，首次使用从官方获取 Windows Setup 并直接运行，无需解压。以后在受支持的安装版中选择**更新 → 下载并准备更新 → 保存工程并勾选确认 → 安装并重新打开**。便携版或未注册副本仍使用明确的官方 Setup 入口；不会绕过本机安装能力与校验。

从 0.1.23 升级到 0.1.24 时，下载过程仍由已安装的 0.1.23 界面显示；新心形在 0.1.24 打开后出现。0.1.24 心形随下一次真实官方升级下载的完整验证，需要未来的新版本；受控状态或字节轨迹演示会单独标注。

### 本轮验证状态

2026-10-18 本机 `scripts/test_release_versions.py` 已通过版本一致性检查；安装版浏览器验收脚本仅通过语法检查。心形字节映射、真实浏览器、Windows 冻结程序自检、科学数据与编辑回归、匹配的 5000 图元性能，以及正式公开后的 0.1.23 → 0.1.24 应用内升级仍待记录。现有 0.1.23 结果不替代这些检查；本页不声明本轮功能验收通过。

本轮未声明新的 Windows 中文输入法、图像检测准确率、Mac／移动设备或所有工作流验收。旧版发行资产、校验和与历史报告保持原样。

## English

This patch is planned to keep the existing simple cat and dog while adding a transparent outline heart whose jade water level follows actual received/total download bytes. Unknown totals must remain indeterminate. Download completion, integrity verification, readiness and installation remain separate; animation preferences and reduced motion must retain readable progress.

The existing Carbon Atelier, Mineral Jade and Pearl Pro styling, scientific data/editing features and update safety gates are retained in scope. First use remains a direct Windows Setup installation; supported later upgrades use **Updates → Download and prepare update → save and confirm → Install and reopen**.

An original 0.1.23 client draws its own real 0.1.23 → 0.1.24 download. The new heart is available only after 0.1.24 opens. A complete later official download drawn by 0.1.24 requires a future release; controlled state or recorded-byte demonstrations will be identified separately.

The local version-consistency check passed on 2026-10-18; the installed-browser harness passed syntax checking only. Heart-state tests, actual browser and installed frozen Windows checks, scientific/editing regression, matched 5000-element measurements and the postpublication real official upgrade remain pending. No new native IME, detector-accuracy, Mac/mobile or all-workflows acceptance is claimed. Historical v1.4.23 evidence and assets are preserved.
