# Install polish-sci-figures in an AI tool

[English](platform-installation.en.md) | [中文](platform-installation.md)

Suite v1.4.10 provides a self-contained upload package with an entry skill and the complete local plotting resources. Claude users can upload this package without rebuilding the ZIP or asking the host to locate three separate skills. Windows users who prefer direct graphical editing can use the [Figure Studio installer](../desktop/QUICKSTART.en.md), which does not require AI skills.

## Which package to download

Download [polish-sci-figures-v1.4.10-skill.zip](https://github.com/zhoy0409-debug/polish-sci-figures/releases/download/v1.4.10/polish-sci-figures-v1.4.10-skill.zip). It has one root folder, `polish-sci-figures/`, and exactly one entry `SKILL.md` across the entire ZIP. The three complete workflows are included as `WORKFLOW.md` files inside `suite/`, alongside the CLI and runtime resources. Keep this structure and upload the original ZIP.

The v1.4.0 upload package contained four `SKILL.md` files and was rejected in an actual Claude upload. The corrected single-entry structure was successfully uploaded to Claude in v1.4.1 and is retained in v1.4.10. Use the current package instead of the old file.

To run the source yourself or manage the three skills separately, choose `sci-figure-suite-v1.4.10.zip` from the same release. These packages serve different purposes: do not upload the entire three-skill source archive as one skill.

## Platform entry points

| Platform | Installation | Requirements |
| --- | --- | --- |
| Claude | Customize → Skills → Yours → Add skill → Upload skill; upload the ZIP above | Enable code execution; feature availability depends on your account |
| Claude Code | Extract the single-entry package so that `~/.claude/skills/polish-sci-figures/SKILL.md` exists, or place it under the project's `.claude/skills/` directory | Local Python execution and the suite's dependencies |
| Codex and other folder-based skill environments | Place all three `skills/` subdirectories from the source suite in the tool's configured skill directory | Keep the three companion skills together and install the Python dependencies; see the [README](../README.en.md#ai-and-command-line-workflows) |

The Claude upload path reflects the interface observed during testing; the other entry points were checked against official documentation. On first use, the skill instructs the agent to check existing Python environments: prefer the project's virtual environment, then a runtime supplied by the host, actually import the scientific packages, and reuse the same verified executable. The agent must not assume that the system's `python` is compatible or that a host-bundled Python includes SciPy. Font checks and data processing follow. Users do not need to guess paths or write a setup-check prompt; the skill does not automatically change PATH or install packages globally.

Official sources: [using skills in Claude](https://support.claude.com/en/articles/12512180-use-skills-in-claude), [Claude upload structure](https://support.claude.com/en/articles/12512198-how-to-create-custom-skills), and [Claude Code skill directories](https://code.claude.com/docs/en/skills).

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
