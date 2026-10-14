# Suite v1.4.10 · Figure Studio 0.1.10 for Windows

English · [中文](#中文)

This Windows hotfix addresses update preparation failing when the installed program's files produce a long backup path. It retains the canvas resizing and undoable panel deletion introduced in [0.1.9](release-notes-v1.4.9.md), along with the existing plotting, analysis and editing workflows.

## Install or update

- **New users:** download the [Windows installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-Studio-0.1.10-Setup-x64.exe). The runtime is included; no separate Python or AI app is required.
- **Version 0.1.8 or earlier:** save your project JSON, close Figure Studio and install 0.1.10 manually once. Those versions cannot install this upgrade from inside the app.
- **Installed 0.1.9:** in-app updating is available. If **Download and prepare update** fails on a long path, save your project, close the app and run the 0.1.10 installer manually. The fix cannot reach the old updater until the upgrade is installed.
- **Portable Windows:** download and fully extract the [0.1.10 portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-Studio-0.1.10-Portable-x64.zip); retain its `_internal` folder. Portable replacement remains manual.

The installed 0.1.10 edition retains **Updates → Download and prepare update → Install and reopen**, with integrity checks and explicit confirmation before closing the editor. Keep a project JSON backup. Updating does not upload research data. See the [Windows quick start](../desktop/QUICKSTART.en.md#save-quit-and-upgrade) for storage and upgrade details; finished-package validation is recorded on the release page.

## Scope and other platforms

Suite v1.4.10 is available as a [single-skill upload package](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-v1.4.10-skill.zip) and the [three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/sci-figure-suite-v1.4.10.zip). The core editing workflow is unchanged: select and resize objects, use **Resize panel content** or **Fit to cell**, and remove panels with Undo available.

Mac and Android remain the previously validated **0.1.9 development previews**; this hotfix does not relabel or replace their packages. Use the existing [preview release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.9) and [device installation guide](local-device-trial.md). iPhone/iPad has no installable IPA.

## 中文

本次 Windows 热修复处理安装目录中的文件在备份时形成过长路径，导致更新准备失败的问题。[0.1.9](release-notes-v1.4.9.md#中文) 加入的控制点缩放、可撤销小图删除，以及原有作图、分析和编辑流程全部保留。

### 安装与升级

- **新用户：** 下载 [Windows 安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-Studio-0.1.10-Setup-x64.exe)。运行环境已包含，无需单独安装 Python 或 AI 应用。
- **0.1.8 或更早版本：** 保存工程 JSON、关闭 Figure Studio，再手动安装一次 0.1.10；这些版本不能在应用内安装此次升级。
- **已安装 0.1.9：** 可使用应用内更新。若因长路径导致**下载并准备更新**失败，请保存工程、关闭应用，再手动运行 0.1.10 安装程序；旧更新程序需先完成升级才能获得此修复。
- **Windows 便携版：** 下载并完整解压 [0.1.10 便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-Studio-0.1.10-Portable-x64.zip)，保留 `_internal` 文件夹；便携版仍采用手动替换。

0.1.10 安装版保留**更新 → 下载并准备更新 → 安装并重新打开**流程，检查文件完整性，并在用户明确确认后关闭编辑器。请保留工程 JSON 备份；更新不会上传研究数据。存储位置与升级步骤见 [Windows 快速入门](../desktop/QUICKSTART.zh-CN.md#保存退出与升级)，成品包验收记录见发行页。

### 范围与其他平台

套件 v1.4.10 提供[单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-v1.4.10-skill.zip)和[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/sci-figure-suite-v1.4.10.zip)。核心编辑方式不变：选择对象后缩放，使用**缩放整图**或**适合格子**，删除小图后仍可撤销。

Mac、Android 保持已验证的 **0.1.9 开发预览**；本次不替换其安装包，也不更改其版本标识。继续使用原[预览发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.9)和[设备安装指南](local-device-trial.md#中文)。iPhone/iPad 暂无可安装 IPA。
