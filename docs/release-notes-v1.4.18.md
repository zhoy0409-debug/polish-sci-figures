# Suite v1.4.18 · Figure Studio 0.1.18

Figure Studio 0.1.18 fixes imported-text copy/paste and makes the format painter more selective. It builds on the published 0.1.17 source and retains its editing, layer, paper-frame and update features.

## Changes

- Copy editable text, paths and shapes into the current panel or another grid cell. Pasting into an occupied panel adds an editable insertion instead of replacing the panel asset or changing its original artwork and paper bounds. Pasting into an empty cell preserves existing row and column sizes.
- Keep copied objects as separate insertion records, with bounded element keys and resources. Preserve transformed PDF text's physical size, nested formatting and geometry for subsequent font changes, resizing, keyboard nudging and export.
- Keep the sidebar and canvas font-size measurements consistent for inserted text in fitted native plots, including source viewports that use different units from the displayed figure.
- Guard asynchronous copy/paste against a changed project, history, selection or destination. A denied system-clipboard request does not disable the editor's internal editable clipboard; selected text is also copied as plain text when the browser permits it.
- Choose format-painter fields independently: font family, size, bold/italic, colour and spacing. Keep the source font family and its fallback list even if the font menu does not contain it, or explicitly choose Arial / Times New Roman. These controls do not install a missing font.
- Recognize opaque RGBA, percentage RGB and inherited `currentColor` during text-style capture. Unsupported paint styles retain the target colour instead of blocking the other chosen typography fields.
- Apply quick font-size and colour edits on blur as well as change or Enter. Coalesce previews on animation frames, commit once, and discard a stale preview when another state takes ownership.
- Reduce keyboard-nudge measurements by excluding unrelated objects from automatic alignment scans. Retain selection and continue editing from the committed geometry.
- Align or distribute a group using its complete outer bounds, preserving the relative positions of its contents. A lock protects the whole group. A single selected group does not align its internal objects to each other; ungroup it first to rearrange those objects independently.

## Verification and platform scope

Source regressions cover imported font stacks and colour representations, partial brush scopes, positioned PDF typography, current-panel insertion, empty-cell track sizes, clipboard resources and asynchronous ownership. Quick-style event checks cover input before and after an animation frame, change/blur/Enter/Escape, stale states, subsequent font changes, Undo/Redo, project reopening and native SVG edits. These checks use synthetic fixtures and do not establish a frame rate or a maximum usable file size on every device.

Package acceptance is recorded separately in the corresponding release's `WINDOWS-VALIDATION.json`, `release-verification.json`, `NATIVE-MANIFEST.json` and `NATIVE-VALIDATION.json`. Source checks and older package reports do not certify a newly built installer or preview; consult those records for the exact build, hashes and completed checks.

Plotting, analysis and image screening remain local. Mac packages remain development previews without Developer ID signing or Apple notarization, for the matching Apple silicon or Intel architecture on macOS 15 or later. Android previews require Android 8 or later and a capable current WebView. This release's text and clipboard changes do not establish new physical-phone or tablet acceptance. Mobile editable-PDF import remains unavailable in the browser/WASM engine. No installable iPhone/iPad IPA or TestFlight build is included; Apple developer identity and the required signing and distribution setup remain necessary for those channels. See the [device guide](local-device-trial.md) and [native validation scope](mobile-preview-validation.md). Save a project JSON before upgrading.

## 中文

Figure Studio 0.1.18 基于已发布的 0.1.17 源码，修复导入文字的复制粘贴，并增加格式刷的独立选项；保留原有编辑、图层、母版和更新功能。

- 可编辑文字、路径和图形可粘贴到当前小图或其他格子。已有小图中通过独立插入记录添加内容，不再替换原图资源、改变原有图形或母版边界；粘贴到空格时也保留原有行列尺寸。
- 复制对象采用独立插入记录，元素编号及资源引用有明确边界。保留带变换 PDF 文字的实际字号、局部格式与几何关系，继续换字体、缩放、方向键微调及导出时使用正确尺度。
- 原生图适配后，插入文字的侧栏字号与画布实际字号保持一致，包括原文件坐标单位与成图不同的情况。
- 异步复制粘贴核对工程、历史、选择和目标位置，避免等待期间发生的变化被旧操作覆盖。浏览器拒绝系统剪贴板权限时，仍可使用编辑器内部的可编辑剪贴板；允许时也把所选文字以纯文本复制到系统剪贴板。
- 格式刷可分别选择字体、字号、加粗／斜体、颜色和间距。可保留不在字体菜单中的导入字体名称及回退列表，也可明确换为 Arial／Times New Roman；这些选项不会安装本机缺失的字体。
- 文字取样支持不透明 RGBA、百分比 RGB 和继承的 `currentColor`；不支持的颜色样式保留目标颜色，不再让其他已勾选格式一起失效。
- 快速字号与颜色输入在离开焦点、change 或 Enter 时提交，动画帧合并预览，只记录一次修改；其他状态接手后不会再应用旧预览。
- 方向键微调不再为自动对齐测量无关对象；保留选择，并从提交后的正确位置继续编辑。
- 组合按完整外框参与六向对齐或等距分布，内部元素的相对位置不变，锁定会保护整组。只选一个组合时，不会把组内元素自动互相对齐；需要单独调整内部元素时，先取消组合。

源码回归覆盖导入字体栈、颜色表示、部分格式刷范围、带逐字定位的 PDF 文字、当前格插入、空格行列尺寸、资源引用及异步所有权。快速样式检查覆盖动画帧前后输入、change／blur／Enter／Escape、过期状态、接着换字体、撤销／重做、工程重开及原生 SVG 编辑。这些合成测试不代表所有设备上的帧率，也不保证任意大小的文件都能流畅处理。

成品验收由相应发行附件 `WINDOWS-VALIDATION.json`、`release-verification.json`、`NATIVE-MANIFEST.json` 和 `NATIVE-VALIDATION.json` 单独记录。源码检查与旧版本报告不能替代新安装包或新预览包的验收；具体构建、哈希和已完成检查以对应记录为准。

作图、分析和图片查重仍在本地完成。Mac 仍为尚未取得 Developer ID 签名及 Apple 公证的开发预览，按 Apple 芯片／Intel 分包，要求 macOS 15 或更新系统；Android 要求 Android 8 或更新系统和具备所需能力的较新 WebView。本次文字与剪贴板修改不构成新的手机／平板真机验收。移动端浏览器／WASM 引擎仍不支持可编辑 PDF 导入，目前不提供可安装的 iPhone／iPad IPA 或 TestFlight 版本；这些分发渠道仍需要 Apple 开发者身份及相应签名、分发配置。具体见[设备指南](local-device-trial.md#中文)和[原生验证范围](mobile-preview-validation.md#中文)。升级前请另存工程 JSON。
