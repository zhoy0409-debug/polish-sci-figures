"""Audit delivered plotting sources for private runtime dependencies.

The skill's own scripts and assets are authoring-time resources. Final project
sources must not search Codex/plugin caches, private home directories, or other
machine-specific locations at runtime. This dependency-free checker follows
the same external-preflight pattern used by the nature-figure workflow.
"""

from __future__ import annotations

import argparse
import ast
from dataclasses import dataclass
from pathlib import Path
import re
import sys


PATH_BOUNDARY = r'(?:^|[\s"\'(=])'
PATH_END = r'(?=[\\/\s"\',)]|$)'
PATH_DELIMITER = r'(?=[\s"\',)]|$)'
WINDOWS_ABSOLUTE = re.compile(PATH_BOUNDARY + r"[A-Za-z]:[\\/]")
UNC_ABSOLUTE = re.compile(PATH_BOUNDARY + r"\\\\[^\\\s]+\\[^\\\s]+")
POSIX_ABSOLUTE = re.compile(PATH_BOUNDARY + r"/[A-Za-z0-9._-]+" + PATH_END)
WINDOWS_PRIVATE_ABSOLUTE = re.compile(
    PATH_BOUNDARY
    + r"[A-Za-z]:[\\/]Users(?:"
    + r"[\\/](?!(?:Public|Default(?: User)?|All Users)"
    + PATH_END
    + r")|"
    + PATH_DELIMITER
    + r")",
    re.IGNORECASE,
)
POSIX_PRIVATE_ABSOLUTE = re.compile(
    PATH_BOUNDARY
    + r"(?:/(?:home|root)"
    + PATH_END
    + r"|/Users(?:/(?!Shared"
    + PATH_END
    + r")|"
    + PATH_DELIMITER
    + r"))",
    re.IGNORECASE,
)
FILE_URI_PRIVATE = re.compile(
    r"file:/+(?:(?:[A-Za-z]:/Users)(?:/|$)|(?:home|Users|root)(?:/|$))",
    re.IGNORECASE,
)
HOME_ENV_PATTERN = (
    r"(?:HOME|USERPROFILE|HOMEPATH|HOMEDRIVE|CODEX_HOME|APPDATA|LOCALAPPDATA|"
    r"XDG_CONFIG_HOME|XDG_CACHE_HOME|XDG_DATA_HOME|XDG_STATE_HOME)"
)
HOME_PATH_REFERENCE = re.compile(
    PATH_BOUNDARY
    + r"(?:~(?:[^\\/\s\"']+)?[\\/]|~(?=[\"'\s,)]|$)"
    + r"|\$\{?"
    + HOME_ENV_PATTERN
    + r"\}?(?:[\\/]|$)"
    + r"|\$env:"
    + HOME_ENV_PATTERN
    + r"(?:[\\/]|$)"
    + r"|%"
    + HOME_ENV_PATTERN
    + r"%(?:[\\/]|$))",
    re.IGNORECASE,
)
HOME_ENV_NAMES = {
    "HOME",
    "USERPROFILE",
    "HOMEPATH",
    "HOMEDRIVE",
    "CODEX_HOME",
    "APPDATA",
    "LOCALAPPDATA",
    "XDG_CONFIG_HOME",
    "XDG_CACHE_HOME",
    "XDG_DATA_HOME",
    "XDG_STATE_HOME",
}
SKILL_RUNTIME_MARKERS = (
    ".codex",
    ".codex/",
    ".codex\\",
    ".agents",
    ".agents/",
    ".agents\\",
    "plugin://",
    "skill://",
    "codex_home",
)


@dataclass(frozen=True)
class Issue:
    severity: str
    line: int
    code: str
    message: str


def dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        prefix = dotted_name(node.value)
        return f"{prefix}.{node.attr}" if prefix else node.attr
    return ""


def import_aliases(tree: ast.AST) -> dict[str, str]:
    aliases: dict[str, str] = {}
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for item in node.names:
                if item.asname:
                    aliases[item.asname] = item.name
                else:
                    root = item.name.split(".")[0]
                    aliases[root] = root
        elif isinstance(node, ast.ImportFrom) and node.module:
            for item in node.names:
                if item.name != "*":
                    aliases[item.asname or item.name] = f"{node.module}.{item.name}"
    return aliases


def resolved_name(node: ast.AST, aliases: dict[str, str]) -> str:
    name = dotted_name(node)
    if not name:
        return ""
    root, separator, remainder = name.partition(".")
    resolved_root = aliases.get(root, root)
    return f"{resolved_root}.{remainder}" if separator else resolved_root


def inspect_string(value: str, line: int) -> list[Issue]:
    normalized = value.lower()
    issues: list[Issue] = []
    if any(marker in normalized for marker in SKILL_RUNTIME_MARKERS):
        issues.append(
            Issue(
                "FAIL",
                line,
                "SKILL_RUNTIME_PATH",
                "references a Codex, skill, or plugin runtime location",
            )
        )
    private_path = (
        WINDOWS_PRIVATE_ABSOLUTE.search(value)
        or POSIX_PRIVATE_ABSOLUTE.search(value)
        or FILE_URI_PRIVATE.search(value)
        or HOME_PATH_REFERENCE.search(value)
    )
    if private_path:
        issues.append(
            Issue(
                "FAIL",
                line,
                "ABSOLUTE_PRIVATE_PATH",
                "contains a user-home or home-relative private path",
            )
        )
    elif (
        WINDOWS_ABSOLUTE.search(value)
        or UNC_ABSOLUTE.search(value)
        or POSIX_ABSOLUTE.search(value)
    ):
        issues.append(
            Issue(
                "WARN",
                line,
                "ABSOLUTE_PATH",
                "contains an absolute path; verify that it is a declared system prerequisite",
            )
        )
    return issues


def scan_python(path: Path, text: str) -> list[Issue]:
    try:
        tree = ast.parse(text, filename=str(path))
    except SyntaxError as exc:
        return [Issue("FAIL", exc.lineno or 1, "SYNTAX_ERROR", exc.msg)]

    issues: list[Issue] = []
    aliases = import_aliases(tree)
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            issues.extend(inspect_string(node.value, getattr(node, "lineno", 1)))
        if isinstance(node, ast.Subscript) and resolved_name(node.value, aliases) == "os.environ":
            key = node.slice
            if isinstance(key, ast.Constant) and str(key.value).upper() in HOME_ENV_NAMES:
                issues.append(
                    Issue(
                        "FAIL",
                        getattr(node, "lineno", 1),
                        "HOME_ENV_LOOKUP",
                        f"reads os.environ[{key.value!r}]; delivered sources must not depend on a private home",
                    )
                )
        assignment_targets: list[ast.AST] = []
        if isinstance(node, ast.Assign):
            assignment_targets = list(node.targets)
        elif isinstance(node, (ast.AnnAssign, ast.AugAssign)):
            assignment_targets = [node.target]
        for target in assignment_targets:
            target_name = resolved_name(
                target.value if isinstance(target, ast.Subscript) else target,
                aliases,
            )
            if target_name == "sys.path":
                issues.append(
                    Issue(
                        "WARN",
                        getattr(node, "lineno", 1),
                        "SYS_PATH_MUTATION",
                        "assigns to sys.path; verify that the target is project-local or declared",
                    )
                )
        if not isinstance(node, ast.Call):
            continue
        name = resolved_name(node.func, aliases)
        line = getattr(node, "lineno", 1)
        first_arg = node.args[0] if node.args else None
        first_value = first_arg.value if isinstance(first_arg, ast.Constant) else None
        if name in {"Path.home", "pathlib.Path.home"} or name.endswith(".expanduser") or name == "expanduser":
            issues.append(
                Issue(
                    "FAIL",
                    line,
                    "HOME_PATH_LOOKUP",
                    f"calls {name}; delivered sources must use project-relative paths",
                )
            )
        elif (
            name in {"os.getenv", "os.environ.get"}
            and isinstance(first_value, str)
            and first_value.upper() in HOME_ENV_NAMES
        ):
            issues.append(
                Issue(
                    "FAIL",
                    line,
                    "HOME_ENV_LOOKUP",
                    f"calls {name}({first_value!r}); delivered sources must not depend on a private home",
                )
            )
        elif name in {"sys.path.insert", "sys.path.append", "sys.path.extend"}:
            issues.append(
                Issue(
                    "WARN",
                    line,
                    "SYS_PATH_MUTATION",
                    f"calls {name}; verify that the target is project-local or declared",
                )
            )
        elif name in {
            "importlib.util.spec_from_file_location",
            "importlib.import_module",
            "runpy.run_path",
            "spec_from_file_location",
            "__import__",
        }:
            issues.append(
                Issue(
                    "WARN",
                    line,
                    "DYNAMIC_FILE_IMPORT",
                    "dynamically imports a file; verify that it is delivered project-local",
                )
            )
        elif (
            name in {"shutil.which", "os.system", "os.popen"}
            or name.startswith("subprocess.")
            or name.startswith("os.exec")
            or name.startswith("os.spawn")
        ):
            issues.append(
                Issue(
                    "WARN",
                    line,
                    "EXTERNAL_PROCESS",
                    f"calls {name}; declare the executable or replace it with a project dependency",
                )
            )
    return issues


def scan_text(path: Path, text: str) -> list[Issue]:
    issues: list[Issue] = []
    for line_number, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        issues.extend(inspect_string(stripped, line_number))
        if re.search(
            r"\bSys\.getenv\s*\(\s*['\"]"
            + HOME_ENV_PATTERN
            + r"['\"]",
            stripped,
            re.IGNORECASE,
        ):
            issues.append(
                Issue(
                    "FAIL",
                    line_number,
                    "HOME_ENV_LOOKUP",
                    "reads a private home environment variable",
                )
            )
        if re.search(
            r"\b(?:system|system2|shell|pipe)\s*\(|\bprocessx::run\s*\(",
            stripped,
        ):
            issues.append(
                Issue(
                    "WARN",
                    line_number,
                    "EXTERNAL_PROCESS",
                    "invokes an external process; declare it explicitly",
                )
            )
        if re.search(
            r"\b(?:source|sys\.source)\s*\(|\breticulate::source_python\s*\(",
            stripped,
            re.IGNORECASE,
        ):
            issues.append(
                Issue(
                    "WARN",
                    line_number,
                    "DYNAMIC_FILE_IMPORT",
                    "loads a source file dynamically; verify that it is delivered project-local",
                )
            )
    return issues


def deduplicate(issues: list[Issue]) -> list[Issue]:
    return sorted(set(issues), key=lambda item: (item.line, item.severity, item.code))


def scan(path: Path) -> list[Issue]:
    try:
        text = path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeError) as exc:
        return [Issue("FAIL", 1, "SOURCE_READ_ERROR", str(exc))]
    if path.suffix.lower() == ".py":
        return deduplicate(scan_python(path, text))
    return deduplicate(scan_text(path, text))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Reject private runtime dependencies and report advisory environment coupling."
    )
    parser.add_argument("sources", nargs="+", type=Path)
    parser.add_argument(
        "--strict",
        action="store_true",
        help="also fail on advisory coupling such as dynamic imports or external processes",
    )
    args = parser.parse_args(argv)

    blocked = False
    for path in args.sources:
        if not path.is_file():
            print(f"[FAIL] {path}: source file does not exist")
            blocked = True
            continue
        issues = scan(path)
        if not issues:
            print(f"[PASS] {path}: no non-portable runtime dependency detected")
            continue
        for issue in issues:
            print(
                f"[{issue.severity}] {path}:{issue.line} "
                f"{issue.code}: {issue.message}"
            )
        if any(issue.severity == "FAIL" for issue in issues):
            blocked = True
        if args.strict and issues:
            blocked = True

    print(f"portable={not blocked}")
    return 1 if blocked else 0


if __name__ == "__main__":
    sys.exit(main())
