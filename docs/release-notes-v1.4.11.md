# Suite v1.4.11 · Figure Studio 0.1.11

English · [中文](#中文)

This release makes importing existing figures and editing their text more direct. The original template plotting, local analysis, image checks, resizing and export workflows remain available.

## Import without leaving your work

The workspace keeps an import entry available after the first figure. Add several PNG, JPEG, WebP or SVG files in sequence; each PDF prompts you to select its page before continuing through the queue. Dropped CSV/TSV files enter the data workflow instead of being treated as pictures. Excel workbooks must first be exported as CSV/TSV.

Import actions distinguish adding figures from replacing a selected panel. A cancelled or rejected file does not discard the existing project. After importing editable artwork, select its elements directly; you do not need to switch out of a leftover panel-arrangement mode first.

## Edit text where it appears

Double-click native text, change it, then click outside to finish. Select text to use the nearby font size, bold, italic and character-format controls. The toolbar explains when text formatting is unavailable, including locked selections or selections without native text.

**Group / Ungroup** and **Lock / Unlock** reflect the current selection. Ungroup removes a group created in the editor so its elements can be selected separately. Imported SVG transforms and clipping are preserved: supported native text and shapes are directly editable without flattening the source. Bitmap text and letters converted to paths remain image or vector content, not editable characters.

## Place selected elements in another cell

If a PDF/SVG already contains a complete assembled figure, select the supported elements you want inside that figure, choose **Copy** or **Cut**, select an empty cell, then choose **Paste into an empty cell**. The result is a separate editable panel. You can repeat the paste, then adjust each copy independently. Cut and paste remain undoable.

Use the toolbar, right-click menu or Ctrl/Cmd+C, X and V inside the editor. Text, shapes, transforms and supported clipping stay editable. Copied statistical labels retain their appearance; recalculate analysis in the original data-linked panel. PDF import uses the desktop engine.

## Install or update

- Windows: [installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/polish-sci-figures-Studio-0.1.11-Setup-x64.exe) or [portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/polish-sci-figures-Studio-0.1.11-Portable-x64.zip).
- Mac: [Apple silicon preview](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.11/polish-sci-figures-Studio-0.1.11-macOS-arm64-Preview.zip) or [Intel preview](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.11/polish-sci-figures-Studio-0.1.11-macOS-x86_64-Preview.zip).
- Android: [development APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.11/polish-sci-figures-Studio-0.1.11-Android-preview.apk).
- AI workflows: [single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/polish-sci-figures-v1.4.11-skill.zip) or [complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/sci-figure-suite-v1.4.11.zip).

Save a project JSON backup before upgrading. Installed Windows 0.1.9 and later support confirmed in-app updates; use the installer manually if 0.1.9 encounters the long-path preparation error. Versions 0.1.8 and earlier need one manual upgrade. The [Windows quick start](../desktop/QUICKSTART.en.md#save-quit-and-upgrade) explains these steps. This release retains the long-path fix from 0.1.10.

Mac and Android are development previews with manual installation. Mac packages are not Apple-notarized. Android previews may have different signing keys: export projects outside the app before uninstalling an older preview. iPhone/iPad has no installable IPA; simulator builds are internal test artifacts. See the [device guide](local-device-trial.md).

## Verification status

Release preparation is in progress. Windows package validation, both Mac architectures, Android and iOS simulator results for this source are pending. The corresponding release will record the actual checks and artifact hashes; earlier 0.1.9/0.1.10 results do not verify these new packages. No physical iPhone/iPad installation is claimed.

## 中文

本版让已有图形的导入和文字编辑更直接。原有模板作图、本地统计、图片检查、缩放和导出流程继续保留。

### 在当前工作区继续导入

放入第一张图后，工作区仍保留导入入口。可依次加入多份 PNG、JPEG、WebP 或 SVG；PDF 会逐份提示选择页面，再继续处理队列。拖入 CSV/TSV 会进入数据处理流程，不会作为图片导入。Excel 工作簿需先导出为 CSV/TSV。

导入区分添加小图与替换所选小图。取消或拒绝一个文件不会丢弃已有工程；导入可编辑图形后可直接选择其中元素，不必先退出之前遗留的排列模式。

### 就在图上修改文字

双击原生文字，修改后点击外部即可完成。选中文字后，直接使用附近的字号、加粗、斜体及字符格式控件；选中内容被锁定或不含原生文字时，工具栏会说明不可用的原因。

**组合 / 取消组合**、**锁定 / 解锁**随当前选中内容变化。取消编辑器中建立的组合后，可分别选取元素。导入 SVG 保留原有变换和裁剪，支持的原生文字、图形可直接修改，无需先破坏性拆散源文件；图片内文字和已转为路径的字形仍属于图片或矢量内容，不能作为字符改写。

### 把选中元素放进另一个格子

如果 PDF/SVG 中已经是一整张组图，可在该图内选中需要的支持元素，点击**复制**或**剪切**，选择空格后点**粘贴到空格**，得到独立可编辑的小图。也可重复粘贴，再分别调整每个副本；剪切和粘贴都支持撤销。

可使用工具栏、右键菜单或编辑器内的 Ctrl/Cmd+C、X、V。文字、形状、变换和支持的裁剪保持可编辑。复制的统计标注保留外观，重新分析请在原来关联数据的小图中进行。PDF 导入使用桌面引擎。

### 安装与升级

- Windows：[安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/polish-sci-figures-Studio-0.1.11-Setup-x64.exe)或[便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/polish-sci-figures-Studio-0.1.11-Portable-x64.zip)。
- Mac：[Apple 芯片预览版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.11/polish-sci-figures-Studio-0.1.11-macOS-arm64-Preview.zip)或 [Intel 预览版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.11/polish-sci-figures-Studio-0.1.11-macOS-x86_64-Preview.zip)。
- Android：[开发 APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-0.1.11/polish-sci-figures-Studio-0.1.11-Android-preview.apk)。
- AI 工作流：[单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/polish-sci-figures-v1.4.11-skill.zip)或[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.11/sci-figure-suite-v1.4.11.zip)。

升级前请保存工程 JSON。Windows 安装版 0.1.9 及更新版本支持确认后在应用内更新；若 0.1.9 遇到长路径准备错误，请手动运行安装程序。0.1.8 及更早版本需先手动升级一次，具体步骤见 [Windows 快速入门](../desktop/QUICKSTART.zh-CN.md#保存退出与升级)。本版保留 0.1.10 的长路径修复。

Mac、Android 继续作为开发预览，需手动安装；Mac 尚未完成 Apple 公证。Android 预览可能使用不同签名，卸载旧版前必须先把工程导出到应用外。iPhone/iPad 暂无可安装 IPA，模拟器构建仅供内部测试。详见[设备安装指南](local-device-trial.md#中文)。

### 验证状态

本版仍在发行准备中。对应源码的 Windows 成品包、Mac 双架构、Android 和 iOS 模拟器验收尚待完成；发行页将记录实际检查结果和文件校验值，旧版 0.1.9/0.1.10 的结果不能代替新版验证。当前不宣称已完成 iPhone/iPad 真机安装。
