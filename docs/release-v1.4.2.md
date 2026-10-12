# polish-sci-figures v1.4.2

[English](release-v1.4.2.en.md) | [中文](release-v1.4.2.md)

套件 v1.4.2 与 **Figure Studio 0.1.2** 优化编辑器工具栏，并用真实界面展示从开始作图到导出的操作。首页保持完整英文介绍在前、中文在后。

## 本版变化

- **工具栏更清爽。** 保留常用的“保存”，将 SVG、PNG 和 TIF 收入“导出”菜单；新建、打开、项目与预设、恢复初始版本集中到“项目”菜单。撤销、重做与对照使用紧凑图标，让英文界面也有舒适的间距。
- **输入的间距会真正保存。** 输入组间距百分比后，按 Tab 或点击其他位置即可提交预览；修改会写入保存的工程，也可撤销。
- **安装前先看实际界面。** 首页加入编辑器实拍和分步动画；[编辑器导览](editor-tour.zh-CN.md) 提供静态截图与对应操作说明。
- **可跟着示例操作。** 导览展示选模板、替换数据、调整图形、保存可编辑工程与导出。[示例数据可下载](media/demo-observations.csv)，均为合成演示数据。
- **下载内容与介绍一致。** Windows 安装版与便携版均包含新界面；源码套件和单入口技能包包含导览及媒体，桌面包也同时附带相关说明。

本次更新改善展示、导航与编辑体验，不改变统计方法、数据要求、218 个模板起点，以及已有的 SVG/PNG/TIFF 导出能力。此前宿主使用与资源测试的实际范围保留在 [v1.4.1 说明](release-v1.4.1.md) 中。

## 下载

| 文件 | 用途 |
| --- | --- |
| [Windows 安装包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/polish-sci-figures-Studio-0.1.2-Setup-x64.exe) | Windows 10/11 x64；无需另配 Python 或打开 Codex |
| [Windows 便携版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/polish-sci-figures-Studio-0.1.2-Portable-x64.zip) | 完整解压后运行 `Figure Studio.exe`，保留 `_internal` 文件夹 |
| [单入口技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/polish-sci-figures-v1.4.2-skill.zip) | 用于支持技能的宿主；整个压缩包仅有一个 `SKILL.md` |
| [三技能源码套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/sci-figure-suite-v1.4.2.zip) | Codex 等文件夹技能环境，或本机命令行使用 |
| [SHA256SUMS.txt](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.2/SHA256SUMS.txt) | 核对上述四个文件 |

升级前点击 **保存** 下载工程 JSON，退出 Figure Studio 后运行新安装包。通过 **项目 → 打开工程** 恢复编辑。完整步骤见 [桌面入门](../desktop/QUICKSTART.zh-CN.md) 与 [平台安装指南](platform-installation.md)。
