# Host acceptance and remote coverage artifact audit

Date: 2026-09-07. Read-only recommendations requested by integration. No host action, workflow
change or additional test execution is established by this document.

## Prioritized remaining acceptance

The meaningful remaining work is three packages, rather than repeating implementation of
every M00–M17 screen from historical Pending rows:

1. Run the unchanged complete gates and CI on the final pushed source, including coverage,
   Fallow and an up-to-date review audit. Focused local passes do not replace this result.
2. Run the one shared final nine-journey/eighteen-reference browser capture. Inspect current
   M14 date/Work/symbol/pin behavior and M15 saved-overview. Compare the raw large-fixture
   latency, RAF and cleanup results with their budgets; exit zero does not assert all budgets.
3. Execute the host-observable portions below and explicitly retain physical-device and
   assistive-technology observations that have not been performed.

Historical trust-prompt and generic Pending paragraphs are not new product defects. The
designated test vault is accessible, but still held a preliminary plugin at the preparation
checkpoint. The successful German hardening probe predates root's later Evidence-date and
pin-projection changes, so it is not the final combined visual acceptance.

## H1–H6 execution plan

Use only `C:/Users/lum/.codex/tmp/renovation-planner-finalization-vault`. Install/reload the final
pushed build and record source SHA, `main.js`, `styles.css` and manifest hashes, Obsidian version,
OS, language, theme and actual editor dimensions. Preserve the fixture files before testing.
The existing project is `Codex Finalization Synthetic 2026-09-07`, with Plan `Synthetic Ground
Floor`; unchanged PNG/PDF fixtures are in `References/`. See root's `live-host-preparation.md`.

Supported Windows Computer Use offers screenshots, SendInput and UI Automation. Preparation
found that UIA could report the document root despite a visible input caret, so confirm focus
and text visually too. Do not replay an asynchronous submit merely because its first snapshot
has not updated. The ordinary user vault is outside this test plan.

| ID | Executable observation | Evidence and boundary |
| --- | --- | --- |
| H1: files/cache/reopen | Open the old Project/Plan before editing and confirm reading preserves schema1/revision1 bytes. Load/calibrate PNG, exercise Cancel then Save; load the real PDF separately. Open Evidence in a native leaf, rename/move its synthetic file and observe refreshed links/thumbnail. Close/reopen editor and test vault. | Screenshots, file paths, stable identities, hashes/revisions and cache-observed refresh. Retain saved geometry/date/links; a read-only migration must not create a date. |
| H2: keyboard/drafts/leaves | Walk Room → Existing/Planned → Work → Materials → Costs → Evidence → Review with Tab/arrows/Enter/Escape. Open and cancel all eleven Add routes; save/Undo representative Room and Object cases. Switch Project/Library/Quote and source-note split leaves; resize with a draft open. Exercise Overview → Materials → Escape, Evidence Work link and date-sorted pins. | Record connected focus successors, unchanged selection/viewport, retained draft and no record created by Cancel. These are native-host observations via tools, not proof of physical-device behavior. |
| H3: theme/language/reflow | Repeat the filled Room and Evidence/recovery states in Light, Dark and the existing custom-accent configuration. Use German near 460 pixels and native host zoom 200%; measure actual editor width. Check Select/Add, date/Work, symbol/number, Retry/source and Apply/Cancel. Below 400 pixels verify the supported-width refusal. | Screenshots and visible focus/text/overflow checks. No new theme installation is necessary. Browser CSS zoom does not establish native Obsidian zoom acceptance. |
| H4: devices/performance | Review the final 80-Room/240-material/24-asset/40-photo browser measurements against 1500/100/200 ms targets and RAF cadence. Verify actual pan/zoom camera deltas, three Material markers and twelve instrumented close/reopen cycles. Native tools can also demonstrate mouse/wheel behavior. | Physical touch, pen, trackpad pinch and perceived responsiveness require a named real device and observer. SendInput does not substitute for them. Instrumented zero counters are not a complete heap/GPU audit. |
| H5: screen reader | With a named screen reader/version, select Room/layer/evidence, open a modal, Tab/Shift-Tab/Escape, trigger validation and hear M15/Retry. | A person judges understandable names/roles/states, focus-return announcements and absence of repeated background-refresh announcements. Axe/UIA are prechecks, not H5 completion. |
| H6: recovery/conflicts | Hold a native edit draft; change the same synthetic Plan source in a second leaf and wait for cache observation. Old Apply must refuse the conflict and preserve peer data/draft. Temporarily rename a linked synthetic file, observe missing state, restore and retry. Compare revisions/hashes before/after read-only retry. | Exact write counts and deterministic successful Save → failed read-back → two failed retries → recovery remain reproducible in the fault-injected harness. No safe deterministic host fault seam has yet been established; do not claim the entire H6 live case from missing-file/conflict checks alone. No crash-journal claim. |

For each observed part record SHA/environment, action, expected/actual behavior and screenshot
or file evidence. Mark the unperformed portion individually rather than assigning one blanket
Pass to an H row.

## Minimal proposed CI artifact step

`vitest.config.ts` already has `reportOnFailure: true` and JSON/LCOV reporters. Add only this
step after the existing unconditional `npm run check` in the existing four-leg verify matrix:

```yaml
- name: Upload coverage diagnostics
  if: ${{ !cancelled() }}
  uses: actions/upload-artifact@v7
  with:
    name: coverage-${{ matrix.os }}-node-${{ matrix.node }}-${{ github.sha }}-${{ github.run_attempt }}
    path: |
      coverage/coverage-final.json
      coverage/lcov.info
    if-no-files-found: warn
    retention-days: 14
```

The status function permits uploading after failed tests or coverage while preserving stale-PR
cancellation. Distinct matrix names avoid artifact conflicts; SHA/attempt identify downloads.
Missing files warn because an earlier build/lint failure may prevent any coverage generation.
A hard process termination before report creation cannot supply counter maps. The original
check's failure remains a failure; no command, threshold, exclusion or timeout changes.
These behaviors and v7 usage were checked against the official
[upload-artifact documentation](https://github.com/actions/upload-artifact) and
[status-condition documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions).

Existing contracts in `tests/build/ci-invokes-check.test.ts` cover the exact four matrix legs,
Node setup order, single unchanged command and undiscounted check/job/workflow keys. The
extra upload step can preserve those assertions. `tests/release/manifest.test.ts` pins the
Node floor; `tests/build/engines.test.ts` checks dependency compatibility. A small additional
CI contract should check upload ordering, failure-capable condition, the two exact paths and
distinct matrix naming. Verify the actual artifact/download on the next required remote full
run. No implementation or new task was opened by this audit.
