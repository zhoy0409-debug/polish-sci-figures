# Suite v1.4.7 · Figure Studio 0.1.7

English · [中文](#中文)

This version adds editable image insets, reference-based color previews, links between overview and detail images, and an in-app route to official updates. These notes describe the prepared source version; publication and finished-package checks are recorded on the corresponding GitHub release.

## Show the detail, keep the original

Select a raster image, choose **Magnify region**, and draw over the detail to enlarge. The inset uses the embedded original pixels. Move or resize it, choose 2× / 3× / 4×, adjust the border and connectors, or delete it without modifying the source image. Changes follow the editor's undo and project-save workflow.

For an accurate scale bar, trace a known bar on the original image and enter its real length in µm. Automatic scale bars choose familiar 1 / 2 / 5 × 10ⁿ values and calculate the corresponding line length. You can also choose a suitable common value. A display zoom alone does not establish physical calibration.

Export the inset with its panel or the full figure as SVG or TIFF. SVG retains the embedded source pixels and editable vector elements; TIFF follows the chosen output resolution. Magnification does not create detail absent from the source image.

## Match the display, then refine it yourself

Select an image and open **Match image colors**. For brightfield images with sufficient unsaturated near-white background, choose a reference and preview a suggested adjustment. Brightness, contrast, temperature and green–magenta tint remain directly available, with sliders, precise numeric input and individual resets. Automatic suggestions can be refined manually; original comparison, Cancel and a single Apply keep the workflow reversible. With one image, manual adjustment remains available without an unusable matching button.

Apply one set of parameters to the current image or selected targets. Fluorescence mode provides shared linear brightness and contrast, without automatic white balance or individual channel normalization. These are whole-image display adjustments, not stain normalization; the embedded source pixels are retained.

## Connect overview and detail images

Open **Link magnified images**, choose two or three images in order, then locate their corresponding regions. Review each suggested match before applying it. Unreliable pairs are identified and do not receive an invented frame. Edit frame and connector color, width and dash style; move the source images and the links follow. Individual links can be removed or hidden, and **Hide all** is reversible with Undo.

Browser checks used synthetic images, including a three-image sequence with two nested matches. They verified manual color refinement, linked movement and style edits, hide/undo, project save/reopen, SVG and TIFF exports, and unchanged source-image pixel hashes. Automatic matching is not guaranteed for every microscopy image; review the suggested regions against the originals.

## Find the next version without leaving your work

Use **Updates** in the header to check the official repository, review the available version, postpone the reminder, or open the appropriate platform download. Background checks use a small version request and do not open a dialog over your work. Offline and cached results are labelled; checking failure does not block local editing.

Checks send no images, tables or projects. Downloads come only from this repository's official Releases. The editor does not install an update automatically. iPhone/iPad builds do not offer an installer when none is published.

**Users of 0.1.6 must install 0.1.7 manually once; the old version does not contain the reminder.** Save an editable project backup before upgrading. Earlier Android previews may require export, uninstall and reinstallation because their signing keys differ; follow the [device guide](local-device-trial.md).

## Packages and platform scope

- Windows: [installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Setup-x64.exe) or [portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Portable-x64.zip), with the local runtime included.
- AI workflows: [self-contained skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/polish-sci-figures-v1.4.7-skill.zip) or [complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/sci-figure-suite-v1.4.7.zip).
- Mac and Android: separate [0.1.7 development previews](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.7), not App Store or Google Play releases.
- iPhone/iPad: development and simulator testing only; there is no installable IPA. Simulator results do not establish physical-device performance.

## 中文

本版增加可编辑的图片局部放大、参考图颜色预览、概览图与细节图关联，以及软件内的官方更新入口。这份说明描述待发行源码；实际发布时间与成品包验证记录以对应 GitHub 发行页为准。

### 展示细节，保留原图

选中位图，点击**局部放大**，框选需要展示的细节。放大窗使用嵌入的原始像素，可移动、缩放，选择 2× / 3× / 4×，调整边框和连接线，也可单独删除，不修改源图片。这些操作纳入编辑器的撤销和工程保存流程。

需要准确比例尺时，沿原图已知标尺划线，输入其实际长度（µm）。自动标尺采用常见的 1 / 2 / 5 × 10ⁿ 数值，并计算准确线长，也可手动选择合适的常用值。仅凭显示倍率不能确定真实物理尺寸。

放大窗可随单图或整幅组图导出 SVG、TIFF。SVG 保留嵌入的原始像素和可编辑矢量元素；TIFF 按所选分辨率导出。放大不会生成原图中不存在的细节。

### 参考匹配后，仍可自由微调

选中图片，打开**颜色匹配**。明场图片具有足够、未饱和的近白背景时，可选择参考图，预览建议调整。亮度、对比度、色温和绿—洋红色调直接显示，均支持滑杆、精确数值输入和单项复位。自动建议后仍可手动细调；对照原图、取消及一次应用，让修改保持可逆。只有一张图时，仍可直接手调，不显示无法使用的匹配按钮。

同一组参数可应用到当前图片或所选目标。荧光模式提供共同的线性亮度和对比度调整，不做自动白平衡或逐图通道归一。这些功能调整整张图片的显示，不属于染色归一化；嵌入的原始像素保留不变。

### 关联概览图与细节图

打开**关联放大图**，按顺序选择两张或三张图片，再定位对应区域。逐对核对建议结果后应用；无法可靠匹配的图片会明确提示，不会虚构定位框。边框和连接线可修改颜色、粗细及虚线样式，移动原图后关联线随之更新。支持单条删除或隐藏，**全部隐藏**也可通过撤销恢复。

实际浏览器检查使用合成图像，包括三张图的两级嵌套匹配，已验证手动调色、移动联动、样式修改、隐藏与撤销、工程保存与重开，以及 SVG、TIFF 导出；原图像素哈希保持一致。自动定位不保证适用于任意显微图，请对照原图核对建议区域。

### 在软件内了解后续更新

顶部**更新**入口可查询官方版本、查看当前可用版本、稍后再提醒，或打开对应平台的下载。后台检查只请求少量版本信息，不弹出对话框打断工作；离线或缓存结果会明确说明，检查失败不会阻止本地编辑。

检查不发送图片、数据表或工程，只使用本仓库的官方 Releases。软件不会自动安装更新；没有公开 iPhone/iPad 安装包时，也不会显示虚假的安装下载。

**0.1.6 用户需先手动安装一次 0.1.7；旧版本身没有更新提醒功能。** 升级前请保存可编辑工程备份。旧 Android 预览的签名可能不同，需要先导出、确认文件存在，再卸载和安装；具体步骤见[设备指南](local-device-trial.md#中文)。

### 安装包与平台范围

- Windows：[安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Setup-x64.exe)或[便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/polish-sci-figures-Studio-0.1.7-Portable-x64.zip)，内置本地运行环境。
- AI 工作流：[自包含技能 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/polish-sci-figures-v1.4.7-skill.zip)或[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.7/sci-figure-suite-v1.4.7.zip)。
- Mac、Android：独立提供 [0.1.7 开发预览](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.7)，并非 App Store 或 Google Play 版本。
- iPhone/iPad：仅开发及模拟器测试，目前没有可安装的 IPA；模拟器结果不等于真机性能验证。
