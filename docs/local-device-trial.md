# Try Figure Studio on your device

English · [中文](#中文)

Figure Studio is the visual editor for **polish-sci-figures**. The app includes its calculation runtime: you do not need Python, Codex, Claude, an account or an API key. Analysis and image checks run on your device.

| Device | Download and status |
| --- | --- |
| Windows 10/11, 64-bit | [Installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.5/polish-sci-figures-Studio-0.1.5-Setup-x64.exe) · [Portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.5/polish-sci-figures-Studio-0.1.5-Portable-x64.zip). Current desktop release. |
| Mac with Apple silicon / Intel | [M-series Mac](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-20261013/polish-sci-figures-Studio-0.1.5-macOS-arm64-Preview.zip) · [Intel Mac](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-20261013/polish-sci-figures-Studio-0.1.5-macOS-x86_64-Preview.zip). Development previews require **macOS 15 or later**. [Build and test record](macos-preview-validation.md). |
| Android phone / tablet | [Development APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-20261013/Figure-Studio-Android-Local-Preview.apk). Requires **Android 8 or later** and a current Android System WebView. [Native test record](mobile-preview-validation.md). |
| iPhone / iPad | Development and simulator testing. There is no installable iPhone/iPad package yet; simulator ZIPs cannot be installed on a phone. |

Mac and Android packages are development previews, with more installation steps than the Windows release. They are not App Store or Google Play releases. Native simulator checks do not establish real-device performance.

## Your first figure

1. **Choose a starting point.** Select a template and replace the example data, or import figures you already made.
2. **Make it your own.** Change text, colors, spacing and annotations. On touch screens, use **Pan** to move around and **Edit** to select elements; **Panels** and **Adjustments** open the side controls.
3. **Keep an editable copy.** Save a project, then export SVG, PNG or TIFF. Choose a local folder when you want the exported file to remain on the device.

You can also prepare data and figures with the companion AI skills in Codex or Claude, then continue editing in Figure Studio. Editable PDF import currently requires the desktop version; the mobile calculation engine does not support it.

The first calculation loads the bundled scientific engine and takes longer than later calculations. Keep the app open while it reports progress. Export a project backup before uninstalling or replacing a development preview.

## Installing development previews

**Mac:** check your chip in Apple menu → About This Mac. Unzip the matching archive with Finder and keep `Figure Studio.app` intact. Open the app to start the editor in your default browser. These packages have ad-hoc signing only; they are not notarized by Apple. If macOS blocks startup, retain the exact message. Apple's [opening-apps guide](https://support.apple.com/en-hk/102445) explains its per-app approval flow. This preview does not require you to disable Gatekeeper globally.

**Android:** open the APK on the target device and follow the system installation prompt. Android may require permission for the specific browser or Files app that opens it; see [Google's installation guide](https://support.google.com/pixelphone/answer/7391672). Some devices or distribution routes also apply [developer-verification requirements](https://developer.android.com/developer-verification); installation is not guaranteed on every device. The preview uses a development key, so a later build may require removing the old preview first. Uninstalling erases in-app projects; export backups first. The linked 13 October preview has no Internet permission. The [current source's optional literature search](../README.en.md#examples-in-papers) requires a rebuilt package; it does not change this existing download.

## Help improve the preview

Try a small non-sensitive example first. Tell us your device/model and OS version, what you tried, what you expected, and what happened. A screenshot or short recording helps; remove identifying data before sharing. Feedback can be sent to the person who invited you or submitted as a [GitHub issue](https://github.com/zhoy0409-debug/polish-sci-figures/issues/new).

## 中文

# 在自己的设备上试用 Figure Studio

Figure Studio 是 **polish-sci-figures** 的可视化编辑器。程序内置计算环境，不需要安装 Python、打开 Codex 或 Claude，也不需要账号或 API 密钥。统计分析与图片查重在本机完成。

| 设备 | 下载与当前状态 |
| --- | --- |
| Windows 10/11，64 位 | [下载安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.5/polish-sci-figures-Studio-0.1.5-Setup-x64.exe) · [免安装 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.5/polish-sci-figures-Studio-0.1.5-Portable-x64.zip)。当前桌面发行版。 |
| Apple 芯片 / Intel Mac | [M 系列芯片版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-20261013/polish-sci-figures-Studio-0.1.5-macOS-arm64-Preview.zip) · [Intel 版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-20261013/polish-sci-figures-Studio-0.1.5-macOS-x86_64-Preview.zip)。开发预览，要求 **macOS 15 或更新系统**。[实际验证记录](macos-preview-validation.md#中文)。 |
| Android 手机 / 平板 | [开发 APK](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/figure-studio-local-preview-20261013/Figure-Studio-Android-Local-Preview.apk)。要求 **Android 8 或更新系统**，并使用较新的 Android System WebView。[原生测试记录](mobile-preview-validation.md#中文)。 |
| iPhone / iPad | 正在开发并通过模拟器测试；目前没有可安装到手机、平板的安装包，模拟器 ZIP 不能直接安装。 |

Mac 和 Android 目前属于开发预览，安装步骤比 Windows 正式版多；尚未上架 App Store 或 Google Play。模拟器测试不等于真机流畅度验证。

### 第一张图，三步开始

1. **选起点。** 选择模板换入自己的数据，或者导入已经做好的图。
2. **调细节。** 修改文字、配色、间距和标注。触屏设备用“移动画布”移动视图，用“编辑图形”选取元素；“图层”和“调整”打开相应控制区。
3. **保存成果。** 先保存可继续修改的工程，再导出 SVG、PNG 或 TIFF。需要文件始终留在本机时，选择设备上的本地文件夹。

也可以先通过 Codex 或 Claude 使用配套技能分析数据、生成图形，再进入编辑器继续调整和组图。可编辑 PDF 的导入目前需要桌面版，移动端计算引擎暂不支持。

首次计算需要载入内置科学计算引擎，会比后续计算慢；显示处理进度时请保持应用打开。卸载或替换开发预览版前，请先导出工程备份。

### 安装开发预览版

**Mac：** 在苹果菜单 → 关于本机确认芯片，使用 Finder 解压对应 ZIP，保留完整的 `Figure Studio.app`。打开应用后，编辑器在默认浏览器中启动。当前仅有临时签名，没有 Apple 公证；若系统阻止打开，请保留完整提示。[Apple 的说明](https://support.apple.com/en-hk/102445)介绍了单个应用的批准方式，预览版不要求全局关闭 Gatekeeper。

**Android：** 在目标设备打开 APK，按系统提示安装。系统可能要求为打开 APK 的浏览器或文件应用单独授予安装权限，参见 [Google 的说明](https://support.google.com/pixelphone/answer/7391672)。部分设备或分发渠道还适用[开发者验证要求](https://developer.android.com/developer-verification)，目前不能保证所有设备都能直接安装。当前使用开发密钥，后续测试包可能需要先卸载旧版；卸载会清除应用内工程，请先备份。上述 10 月 13 日预览包没有互联网权限；[当前源码的可选文献检索](../README.zh-CN.md#文献作图实例)需要重新构建，并不会改变这里已有的下载包。

### 帮我们找到真正难用的地方

先用少量、不含敏感信息的示例试用。反馈请附上设备型号与系统版本、操作步骤、原本期待的效果以及实际结果；截图或短录屏更直观，分享前请移除可识别信息。可以反馈给邀请你试用的朋友，或提交 [GitHub issue](https://github.com/zhoy0409-debug/polish-sci-figures/issues/new)。
