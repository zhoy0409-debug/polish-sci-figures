# Install polish-sci-figures in an AI tool

[English](platform-installation.en.md) | [中文](platform-installation.md)

Download the [single-entry Skill ZIP](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.5.0/polish-sci-figures-v1.5.0-skill.zip) from the [stable v1.5.0 release](https://github.com/zhoy0409-debug/polish-sci-figures/releases/tag/v1.5.0). It contains one `SKILL.md` and the full `suite/` resources inside `polish-sci-figures/`.

| Host | Install | Invoke |
| --- | --- | --- |
| Claude web or desktop | Upload the ZIP as-is in Customize → Skills and enable code execution. | Select `polish-sci-figures` in the Skills menu of a new conversation, then attach data or artwork. |
| Claude Code | Extract the complete folder into `~/.claude/skills/` or the project's `.claude/skills/`. | Enter `/polish-sci-figures` in the conversation. |
| Codex | Extract the complete folder into `~/.agents/skills/` or the project's `.agents/skills/`. | Open the skill picker with `$`, choose `$polish-sci-figures` and describe the task. |

For local installation, verify that `polish-sci-figures/SKILL.md` and `suite/` are alongside each other. The skill checks the available Python environment and dependencies. The single-entry ZIP works for the hosts above. Use the [three-skill source suite](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.5.0/sci-figure-suite-v1.5.0.zip) to manage the workflows separately or run the CLI. If the host shows two skills with the same name, choose the Figure Studio skill by installation path.

For hands-on editing, install [Figure Studio for Windows x64](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.5.0/polish-sci-figures-Studio-0.2.0-Setup-x64.exe).

[Claude guide](https://support.claude.com/en/articles/12512180-use-skills-in-claude) · [Claude Code skills](https://code.claude.com/docs/en/skills) · [Codex skills](https://developers.openai.com/codex/skills)

## First use

After uploading the package or placing the directory, select the skill in a new conversation. **In Claude, click `+` beside the message box → Skills → polish-sci-figures** to insert the skill, then upload your table and ask in ordinary language:

> Help me turn this table into a figure for a paper. Show me a few suitable styles to choose from.

An installed skill is not necessarily an invoked skill. An ordinary request does not guarantee automatic activation: in testing, Claude wrote its own plotting code when the skill had not been selected, which does not count as a pass for this skill. Use the menu above first; no invocation syntax needs to be memorized.

You do not need to know chart names or statistical terminology beforehand. The skill inspects the table first and, when necessary, asks a concrete design question such as “Are these before-and-after measurements from the same subjects, or measurements from two different groups?” You can then change colors, fonts, and layout directly in the editor.

Provide the actual experimental units and study design. Template examples are not your results; templates for model interpretation, evidence synthesis, and similar tasks need the corresponding calculated outputs. Browser refinement can proceed without further AI calls. Data recomputation requires the suite's local service, which the Windows desktop application starts automatically.

## Actual verification

The gallery entry point was retested in a local Codex novice workflow using the project's Python 3.12 after successful dependency imports. With `PYTHONUTF8` unset and GBK pipe encoding, the catalogue still emitted complete Chinese text and scientific subscripts as valid JSON. `--palette journal_blue_red` generated an SVG containing the requested colors. Five regression tests additionally cover normal and error output, palette validation, preservation of default colors, and unchanged geometry after recoloring.

In Claude Sonnet 5.5 Medium, the skill was selected from the menu and given 16 synthetic rows with an ordinary Chinese request, followed by confirmation of independent experimental units and mg/L units. The host actually ran `doctor`, `workflow`, and `candidate`, producing PNG/PDF/SVG, a candidate ZIP, and HTML. The PNG passed visual review. After an ordinary-language correction, the HTML opened the selected estimation chart in one column and passed visual review in English. The CLI now preserves an explicitly selected candidate and defaults a single panel to one column. The Claude download path remains unverified, so this is not described as a first-pass success of the entire delivery workflow.

These skills are maintained by this project, not built-in official products of Claude or Codex. Downloads and updates come from the [official polish-sci-figures releases](https://github.com/zhoy0409-debug/polish-sci-figures/releases).
