# Official companion distribution

Figure Studio is the visual desktop companion to **polish-sci-figures**,
maintained by Wenting Zhou. Its maintained project and download channel are:

- Project: https://github.com/zhoy0409-debug/polish-sci-figures
- Downloads: https://github.com/zhoy0409-debug/polish-sci-figures/releases

The Windows installer, shortcut, application window, editor link and build
manifest identify the same project. Users do not need an activation key, a
GitHub login, Python, Codex or a separately installed skill to run the package.

## Release contents and provenance

Publish reviewed installers, a portable ZIP, checksums and release notes in this
repository's Releases. Keep desktop preview releases marked as pre-releases so
they do not displace a stable skill-suite release. Do not publish a developer's
workspace, tests, logs or user projects as a release asset.

The installed package retains the project's MIT notice and the licenses of its
bundled third-party components. Python application modules are distributed as
runtime bytecode in the same resource directories; browser code and editable
template resources remain accessible to the runtime. This packaging reduces
casual exposure of Python source but is not encryption, DRM or an access check.

The public repository currently uses MIT. Official branding and this download
policy do not revoke rights already granted under that license, prohibit lawful
forks or prevent redistribution. A different license for future original
components requires an explicit scope and rights review before publication;
this build does not silently introduce one.

SHA-256 checksums allow users to compare an artifact with values published by
the official project. They are not a publisher signature. The current desktop
build is unsigned; do not label it signed, tamper-proof or impossible to copy.

## Maintainer checks before publishing

Confirm that the application files match the tested build, retain all relevant
license notices, and record actual validation scope. A local Windows test with
Python removed from PATH does not establish clean-machine compatibility on
every Windows version. Publish only after the packaged application, installer,
data replacement, analysis and actual exports have passed their checks.

References: [GitHub licensing documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository),
[MIT license](https://choosealicense.com/licenses/mit/),
[GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases).
