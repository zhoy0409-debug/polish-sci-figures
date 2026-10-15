# Suite v1.4.17 · Figure Studio 0.1.17

Figure Studio 0.1.17 improves editing responsiveness for larger imported figures, font replacement and update progress. It builds on the published 0.1.16 source and retains its existing features.

## Changes

- Reuse SVG element indexes when applying many edits, instead of repeatedly searching the entire imported figure. Native text, paths and shapes remain editable.
- Combine rapid autosaves and defer storage work until the current edit can be displayed. Keep complete undo history, drafts and checkpoints, with separate ownership for projects opened while a write is pending.
- Refresh layer rows when their content or selection changes, preserving search, visibility and lock controls.
- Trim each edge of the master paper frame independently without stretching the artwork. Fit the frame to visible content without extra padding or restore the full paper; locked content cannot be cropped away.
- Apply font-family changes to positioned PDF text, including imported font names with fallback lists. Use portable font fallbacks when an imported face is unavailable, while preserving partial italics, bold, subscripts and superscripts.
- Show update progress with a small ink-style cat, actual download bytes and separate download, verification, preparation and installation stages. Reduced-motion settings are respected; normal installation handoff is not presented as failure, while real errors stay visible.
- Retain marquee and batch unlocking, font-preserving aspect restoration, top/left resize handles, object alignment/distribution, paragraph spacing and indents, direct file drops, image tools, local statistics and editable exports from 0.1.16.

## Verification and platform scope

Source regression checks cover 5,000 edited vector objects with bounded key-index scans, coalesced autosaves with deliberately slow storage, project switching, stale failures and marker conflicts. Master-frame checks cover retained vector, label and inset geometry, locked bounds, and continued insertion, keyboard nudging and resizing after cropping. Existing text, statistics, image-color, selection, import and export integrations have also passed. These checks use synthetic fixtures; they do not establish a frame rate on every computer or device.

Use this release's attached `WINDOWS-VALIDATION.json` and `release-verification.json` for the Windows and skill-package acceptance scope and hashes. Native previews have their own `NATIVE-MANIFEST.json` and `NATIVE-VALIDATION.json`. These package-specific records are the authority for each build; source checks, browser checks and older package reports do not certify a new package.

Windows supports local plotting, analysis and image screening without uploading research data. Mac packages remain development previews without Developer ID signing or Apple notarization, for the matching Apple silicon or Intel architecture on macOS 15 or later. Android previews require Android 8 or later and a capable current WebView. Mobile editable-PDF import remains unavailable in the browser/WASM engine. No installable iPhone/iPad IPA or TestFlight build is included; physical-device behavior is not certified by desktop or simulator tests. See the [device guide](local-device-trial.md) and [native validation scope](mobile-preview-validation.md). Save a project JSON before upgrading.

## 中文

Figure Studio 0.1.17 基于已发布的 0.1.16 源码，保留原有功能，重点改善大组图的编辑响应、字体替换和更新进度。

- 批量修改复用 SVG 元素索引，减少反复扫描整张图；文字、路径与图形仍保持可编辑。
- 快速连续操作合并自动保存，先显示当前修改，再处理存储；保留完整撤销记录、数据草稿和保存版本，切换工程时不会把旧工程的保存结果当作新工程状态。
- 图层栏按实际内容与选择变化刷新，保留搜索、显示／隐藏和锁定操作。
- 母版纸张的四边可分别收紧白边，不会把图形拉伸变形；贴合可见内容时不额外添加白边，也可恢复完整母版，锁定内容不能被裁掉。
- 修复带逐字定位及字体回退列表的 PDF 文字替换字体；原字体不可用时使用可移植字体回退，保留局部斜体、加粗、上下标等科学字符格式。
- 更新界面采用简洁的水墨小猫，按实际下载字节显示进度，清楚区分下载、校验、准备和安装；尊重减少动态效果设置，正常安装接手不误报失败，真实错误仍明确显示。
- 保留 0.1.16 的框选批量解锁、保留字体字号的比例还原、顶部／左侧拖动、对象对齐与分布、段落间距与缩进、文件直接拖入、图像工具、本地统计与可编辑导出。

源码回归已覆盖 5,000 个可编辑矢量对象的索引工作量，以及慢存储、连续修改、切换工程、过期失败和缓存冲突下的自动保存；母版检查覆盖矢量图、图号、局部放大图和锁定边界，并核对裁切后继续插入、方向键微调及缩放。相关文字、统计、颜色、选择、导入和导出集成也已通过。这些合成测试不代表所有设备上的帧率。

Windows 与技能包的具体成品验收范围、哈希以本次发行附件 `WINDOWS-VALIDATION.json`、`release-verification.json` 为准；原生预览版另以 `NATIVE-MANIFEST.json`、`NATIVE-VALIDATION.json` 记录。源码检查、浏览器检查和旧版本报告都不能替代相应新成品包的验收。

Windows 作图、分析和查重在本地完成，不上传研究数据。Mac 仍为尚未取得 Developer ID 签名及 Apple 公证的开发预览，按 Apple 芯片／Intel 分包，要求 macOS 15 或更新系统；Android 要求 Android 8 或更新系统和具备所需能力的较新 WebView。移动端浏览器／WASM 引擎仍不支持可编辑 PDF 导入，目前不提供可安装的 iPhone／iPad IPA 或 TestFlight 版本。桌面或模拟器检查不能替代真机验收，具体见[设备指南](local-device-trial.md#中文)和[原生验证范围](mobile-preview-validation.md#中文)。升级前请另存工程 JSON。
