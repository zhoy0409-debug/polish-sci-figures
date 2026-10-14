# Suite v1.4.9 · Figure Studio 0.1.9

English · [中文](#中文)

This version makes figure sizing and panel removal direct canvas operations, and adds guided installation of future updates to the Windows installer edition. Finished-package checks and platform test results are recorded on the corresponding GitHub release.

## Resize where you are working

Select an object, or select several objects across panels and inserted annotations, then drag an edge or corner handle. Corners preserve proportions by default; edges change width or height. The canvas toolbar offers **Auto aspect**, **Lock aspect** and **Free scaling**. Hold **Shift** to switch the aspect behavior temporarily, or **Alt** to resize around the center. Release to save one undo step; cancel to restore the starting appearance.

If a small figure leaves too much room in its cell, choose **Resize panel content** and drag its handles, or choose **Fit to cell** for a proportional fit. These actions adjust the artwork inside the cell, keeping the grid layout separate. Source artwork and data remain unchanged in the project. Resizing an embedded bitmap preserves its source pixels; it cannot create missing image detail.

## Remove a panel without losing your way back

Each panel in the left-hand list has its own trash button. Click it to remove that panel; **Undo** restores its editable contents, linked insets and relationships. Unrelated annotations remain in place. Locked panels must be unlocked first. Deleting the last panel leaves a blank canvas ready for a template, an imported figure or your own annotations.

## Update from inside the Windows app

In the installed Windows edition, **Updates → Download and prepare update** downloads the official installer and checks its size and SHA-256. Save your project, confirm that the editor can close, then choose **Install and reopen**. Installation uses the existing location and reopens the application when successful. It needs your confirmation and does not bypass operating-system security prompts. Checking or installing updates does not upload research data.

**Using 0.1.8 or earlier? Install 0.1.9 manually once.** Versions 0.1.7 and 0.1.8 can show the official download but cannot install this upgrade from inside the application; 0.1.6 has no update reminder. The new installation flow becomes available for later releases after 0.1.9 is installed. The Windows portable edition keeps manual replacement. Mac and Android remain development previews with their existing installation and signing conditions; this release does not promise automatic replacement on those platforms.

## Downloads and scope

- Windows: [installer](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/polish-sci-figures-Studio-0.1.9-Setup-x64.exe) or [portable ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/polish-sci-figures-Studio-0.1.9-Portable-x64.zip).
- AI workflows: [single-skill upload](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/polish-sci-figures-v1.4.9-skill.zip) or [complete three-skill suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/sci-figure-suite-v1.4.9.zip).
- Mac and Android: [development-preview release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.9) and [device installation guide](local-device-trial.md). iPhone/iPad has no installable IPA; simulator bundles are not phone installers.

Save an editable JSON backup before updating. PDF import still requires the desktop engine. The [PDF text fixes](release-notes-v1.4.8.md), image insets, local analysis, image duplicate checks and original AI/CLI workflows remain available. Automated geometry, DOM and history tests verify defined cases; a package is not considered tested on a physical device merely because those checks pass.

## 中文

本版让图形大小调整和小图删除直接在工作区完成，并为 Windows 安装版加入后续更新的引导式安装。成品包验收与平台测试结果记录在对应 GitHub 发行页。

### 就在画布上调整大小

选中一个对象，或跨小图和插入标注多选，再拖动边点或角点。角点默认保持比例，边点改变宽或高；快捷栏提供**自动比例**、**锁定比例**、**自由缩放**。按住 **Shift** 可临时切换比例行为，按住 **Alt** 围绕中心缩放。松手后记录一次撤销；取消操作则恢复起始外观。

小图在格子里显得太小时，可直接点**缩放整图**后拖动控制点，或点**适合格子**等比适配。这些操作调整格子里的图形内容，网格排版本身另行控制，工程中的源图形和数据不变。缩放嵌入图片会保留原始像素，但不能补出原图缺失的细节。

### 直接删除，也能撤销找回

左侧列表每张小图旁都有垃圾桶，点一下即可删除。**撤销**会恢复可编辑内容、所属局部放大和关联关系；其他独立标注保留原位。锁定的小图需先解锁。删掉最后一张后会留下空白画布，可继续选模板、导入图片或插入标注。

### 在 Windows 应用里完成后续更新

Windows 安装版可通过**更新 → 下载并准备更新**获取官方安装程序，程序会检查文件大小和 SHA-256。保存工程，确认可以关闭编辑器后，点**安装并重新打开**。安装沿用当前位置，成功后重新打开应用；必须由用户确认，不会绕过操作系统安全提示。检查和安装更新均不上传研究数据。

**正在使用 0.1.8 或更早版本？需先手动安装一次 0.1.9。** 0.1.7 和 0.1.8 可以显示官方下载，但不能在应用里安装这次升级；0.1.6 没有更新提醒。安装好 0.1.9 后，后续新版才可使用新的安装流程。Windows 便携版仍需手动替换；Mac、Android 继续按开发预览的安装和签名条件使用，不承诺自动覆盖升级。

### 下载与适用范围

- Windows：[安装版](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/polish-sci-figures-Studio-0.1.9-Setup-x64.exe)或[便携 ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/polish-sci-figures-Studio-0.1.9-Portable-x64.zip)。
- AI 工作流：[单技能上传包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/polish-sci-figures-v1.4.9-skill.zip)或[完整三技能套件](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.9/sci-figure-suite-v1.4.9.zip)。
- Mac、Android：[开发预览发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/figure-studio-local-preview-0.1.9)与[设备安装指南](local-device-trial.md#中文)。iPhone/iPad 暂无可安装 IPA；模拟器包不能安装到手机。

升级前请保存可编辑的工程 JSON。[PDF 字号修复](release-notes-v1.4.8.md#中文)、局部放大、本地统计、图片查重及原有 AI/CLI 工作流继续保留；PDF 导入仍需桌面引擎。自动化几何、DOM 与历史记录测试只验证其覆盖场景，通过这些检查不等于已经在真实设备上完成验收。
