# Real Windows update acceptance

Studio 0.1.22 status: the new official-version update flow has not been executed. Publication is on hold at the user's request, so there is no published target for this acceptance. Local original-Setup installation, reinstall and uninstall are recorded separately; neither those checks nor historical 0.1.20 → 0.1.21 evidence counts as the new official update. No release offer, package progress or install result is fabricated.

This operator workflow verifies an actual installed client's official download, package validation, backup, installer handoff and same-origin project restoration. It does not replace the user's normal installation. Use a disposable Windows account or the explicitly registered repository `.cache` QA installation and a separate child `LOCALAPPDATA` profile prepared by the operator.

The updater's official GitHub URL, stable-channel, release-digest, registration and path checks remain enabled. A loopback byte-stream unit test verifies transport and hash behavior separately; it is not an official installed-update acceptance result. Draft and prerelease packages are ignored by stable clients. Publishing a higher stable version with “not latest” does **not** hide it from this updater, which selects the highest eligible version.

## Prepare the isolated client

The operator prepares and starts the intended older official installer at `.cache/desktop-installer-qa`, with its child `LOCALAPPDATA` pointing at `.cache/carbon-update-profile`. Its existing settings must select the same explicit loopback port used after the update. Do not pass `--data-dir`: in-app installation intentionally requires the default directory for that child profile.

Before either download or installation, the harness verifies both registered AppId paths and DisplayVersion, the actual listener's executable path and PE version, and any explicitly protected running processes. A normal user installation registered at a different path causes a stop. The harness never stops processes or launches an installer itself; installation is requested exactly once through the actual installed editor UI after the real package reaches `ready` and the saved-project checkbox is selected.

Review [the real acceptance script](../scripts/test_studio_update_real_windows.cjs) and [read-only evidence helpers](../scripts/studio_update_real_evidence.cjs) before execution. Set these process-local variables:

- `STUDIO_REAL_UPDATE_URL`: the prepared loopback editor origin.
- `STUDIO_REAL_UPDATE_FROM` and `STUDIO_REAL_UPDATE_TO`: the exact intended versions. The actual official release offer must match the target.
- `STUDIO_REAL_UPDATE_PROJECT`: a real saved scientific project, such as the existing public UCI Iris acceptance project.
- `STUDIO_REAL_UPDATE_INSTALL_DIR` and `STUDIO_REAL_UPDATE_PROFILE`: optional overrides for the two isolated repository cache directories above.
- `STUDIO_REAL_UPDATE_PROTECTED_PIDS`: the current process IDs to protect, explicitly supplied by the operator; no session-specific PID is built into the script.
- `STUDIO_REAL_UPDATE_PROOF`: a new empty evidence directory. Prior failures are never overwritten.
- `STUDIO_REAL_UPDATE_INSTALL=YES`: authorization for this single real update.

Playwright, installed Chrome and the matching video encoder must be available. `PLAYWRIGHT_BROWSERS_PATH` can select the prepared encoder runtime. Run `node scripts/test_studio_update_real_windows.cjs` only after the operator has reviewed the target, current registration and candidate release. Download and installation timeouts default to ten minutes each and can be set with the corresponding `STUDIO_REAL_UPDATE_*_TIMEOUT_MS` variables.

## What a pass requires

The script actually opens and downloads the project before any update, compares every table row, every original SVG variant and editable state, then confirms the completed IndexedDB autosave and desktop last-project marker. It records one actual download and one install request. At `ready`, it independently checks the downloaded package's size and SHA256 and records the original program's complete file hashes.

After the real helper reopens the target version, the same browser context and origin must automatically restore the project. Actual Save must again contain the exact source tables, original SVGs and editable state. An explicit Open cannot turn a failed automatic-restoration check into a pass; use the separate postverify script to investigate saved-file readability while retaining the original failure.

The helper's `helper-ready.json`, `result.json` with `installed`, and every preserved rollback file must match the original inventory and hashes. The registered target, expected executable version, listener identity and protected processes are checked again. Browser errors, unexpected dialogs, repeat commands, failed rollback, wrong version or changed scientific data stop acceptance.

## Brief stages and honest observation

Download bytes are real received bytes. SHA256 is computed while reading; after EOF, flush/fsync and final digest checks may complete between browser polls. The existing API has no distinct `verifying` status: the illustration infers pending verification when all bytes have arrived. The helper handoff can also be brief because the desktop launcher checks the shutdown event every 100 ms.

The harness records UI samples and a separate authenticated read-only HTTP status observer at 100 ms. The observer does not drive the UI. Preparing clients now poll at 100 ms by default to improve the chance of receiving the real `installing` handshake; stages are never artificially extended or replayed. A missed stage stays absent from the video and `uiObservedStages`, even if a response or journal proves it happened.

New updater code also writes an optional bounded `audit.jsonl` beside its own job. Allowlisted records contain actual UTC/monotonic times, phases, package byte counts, version/hash, file counts and native exit codes. They contain no project data, token, user identity or path. Events distinguish an installer **request** from its actual returned exit code, and a restart dispatch from a healthy reopened server. Audit I/O failure cannot change download validation, installation or rollback decisions.

An older official client and its preserved helper do not contain this new audit implementation. Their audit may be absent; that is recorded, not patched away or fabricated. Their real handoff files, successful helper result, exact rollback hashes and reopened server remain required. A later old-client-to-new-version update does not itself validate the new audit path; bounded audit and failure independence have separate automated tests.

Keep raw videos, projects and per-process evidence in ignored cache. Publish only a reviewed summary with explicit UI/backend/journal distinctions and retained failures. Final installer hash reports must remain outside that same installer's `SUPPORT_FILES`, avoiding a self-referential archive hash.
