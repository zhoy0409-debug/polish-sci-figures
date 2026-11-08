# 在 AI 工具中安装 polish-sci-figures

[English](platform-installation.en.md) | [中文](platform-installation.md)

从 [正式 v1.6.0 发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.6.0) 下载 [单入口 Skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.0/polish-sci-figures-v1.6.0-skill.zip)。解压后的 `polish-sci-figures/` 包含一个 `SKILL.md` 和完整的 `suite/` 资源。

| 宿主 | 安装 | 调用 |
| --- | --- | --- |
| Claude 网页或桌面版 | 保持 ZIP 原样。在 Customize → Skills 中上传，并启用代码执行。 | 在新会话的 Skills 菜单选中 `polish-sci-figures`，再附上数据或图件。 |
| Claude Code | 解压整个目录至 `~/.claude/skills/` 或项目的 `.claude/skills/`。 | 在会话中输入 `/polish-sci-figures`。 |
| Codex | 解压整个目录至个人 `~/.agents/skills/` 或项目根目录的 `.agents/skills/`。 | 在输入框用 `$` 选中 `$polish-sci-figures`，再描述任务。 |

安装后检查宿主目录中的 `polish-sci-figures/SKILL.md` 和同目录的 `suite/`。本机工作流使用已有 Python 环境，Skill 会检查运行依赖。单入口包适用于上表各宿主；需要逐项管理 Skill 或运行 CLI 时，再下载[三技能源码包](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.0/sci-figure-suite-v1.6.0.zip)。同名技能同时存在时，按安装路径选择 Figure Studio 这一份。

独立编辑图件可直接安装 [Figure Studio Windows x64](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.6.0/polish-sci-figures-Studio-0.2.1-Setup-x64.exe)。

[Claude 使用说明](https://support.claude.com/en/articles/12512180-use-skills-in-claude) · [Claude Code 技能目录](https://code.claude.com/docs/en/skills) · [Codex 技能目录与调用](https://developers.openai.com/codex/skills)

## 第一次使用

上传或放置目录后，在新会话里选择相应技能。**Claude 用户先点击输入框旁的 `+` → Skills → polish-sci-figures**，一键插入技能，再上传表格并用日常语言请求：

> 帮我把这张表画成适合论文的图，给我几个合适的样式选一下。

不要仅凭“已经安装”判断技能一定被调用。普通请求不保证自动触发：实际测试中，未选择技能时 Claude 曾自行编写绘图代码，这不计作本技能通过。先用上面的菜单选择即可，无需记忆调用语法。

无需先掌握图型名称或统计术语。技能先检查表格，必要时会用“同一批对象的前后变化，还是两批不同对象？”等具体问题确认设计；后续颜色、字体和排版可直接在编辑器中修改。

请提供真实实验单位和研究设计。模板示例不是用户结果；模型解释、汇总分析等模板需要相应计算结果。浏览器精修可独立于 AI 调用，数据重算需要运行套件本机服务；Windows 桌面版会自动启动内置服务。

## 实际验证

Codex 本机新手流程已复测图库入口：使用实际通过依赖导入的项目 Python 3.12，在未设置 `PYTHONUTF8`、管道编码为 GBK 时，图库列表仍能完整输出中文和科学下标并解析为 JSON；指定 `--palette journal_blue_red` 能生成包含对应颜色的 SVG。另有 5 项回归覆盖正常与错误输出、配色校验、默认配色保留及换色前后几何一致性。

Claude Sonnet 5.5 Medium 中，先从菜单选择技能，再提供 16 行合成数据和普通中文请求，并确认独立实验单位及 mg/L 单位。宿主实际运行了 `doctor`、`workflow` 和 `candidate`，生成 PNG/PDF/SVG、候选 ZIP 和 HTML；PNG 已完成视觉检查。使用日常语言反馈后，HTML 已以一列打开选定的估计图，并通过英文界面视觉检查。CLI 现支持保留显式选定的候选图，单面板默认一列。Claude 下载链路尚未验证，因此不称整条交付流程一次通过。

这些技能由本项目维护，并非 Claude 或 Codex 的官方内置产品。下载与更新统一来自 [polish-sci-figures 官方发行页](https://github.com/zhoy0409-debug/polish-sci-figures/releases)。
