# Suite v1.4.16 · Figure Studio 0.1.16

## Changes

- Select locked artwork with a marquee and unlock the selection together, or unlock the whole figure. Undo restores locks.
- Resize from the top and left edges and from the ends of row/column dividers.
- Restore normal aspect ratios without resetting the chosen font family or effective font size, including rotated text. Locked objects are skipped.
- Search the current panel's layer list, select multiple objects, toggle visibility and locks, and retrieve hidden objects.
- Use dedicated object alignment/distribution and paragraph panels. Paragraph controls support text alignment, line/letter spacing and native-text indents; preserve explicit line breaks and scientific character formatting. They do not provide automatic wrapping or full justification.
- New HTML handoffs and packaged skill builders include the same editor resources.

## Verification

Browser checks cover marquee unlock, mixed panel/element locks, undo, aspect restoration, rotated-text font size, top/divider dragging, layer visibility, paragraph save/reopen and object alignment. Synthetic multiline/subscript text retains content and math styling. Thirteen existing figure pages and a newly generated installed-skill page were opened successfully. Scientific source data were not changed.

Package-specific evidence and hashes are attached to this release. Native previews remain previews; existing iPad save/open and portrait-tablet limitations are not marked resolved by desktop browser checks. Save a project JSON before upgrading.

## 中文

本版新增框选锁定元素后批量解锁、整图解锁、顶部和左侧拖动把手、分隔线两端把手，以及保留字体和实际字号的比例还原。图层栏支持搜索、多选、显示／隐藏和锁定；对象对齐、分布与段落设置提供独立面板。段落保留显式换行和科学字符格式，不包含自动换行或两端撑满。

已验证框选解锁、撤销、混合锁定、旋转文字比例还原、顶部拖动、图层显示隐藏、段落保存重开及对象对齐。13 个已有组图页面与通过已安装 skill 新生成的工程均已启动检查。新版 skill 生成的组图直接包含这些功能。各安装包的实际构建与验收结果以本次附件为准；旧版 iPad／平板限制不由桌面测试替代。
