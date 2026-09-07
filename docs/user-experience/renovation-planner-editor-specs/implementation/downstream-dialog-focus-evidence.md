# Focus after downstream dialog source changes

Date: 2026-09-07. Bounded PR #91 contribution based on `c1091086`.

## Confirmed behavior and correction

Editing an existing draft Quote into a received offer removes its Edit button during the
successful read-back. A peer can also remove a Work item or Quote while its edit/revision
dialog remains open. In all four reproduced cases, closing the dialog left focus on the
document body: the dialog host could not focus its detached opener, and the action supplied
no replacement destination.

Quote edit/revise and Project Work edit now capture focus immediately before opening their
dialog and restore it after the dialog closes. The shared `captureDownstreamDialogFocus`
helper waits for Vue's DOM update, then uses the same section's persistent Project Back
control if the opener was removed and focus fell to the body. It does not replace normal
focus return to a surviving opener, reclaim focus from another active control, or focus a
disposed section. It performs no read, write or navigation.

The production changes only surround the three existing dialog calls. Save/dispatch,
captured baselines, history, read recovery and templates are unchanged in this checkpoint.
The helper is also available to the integration's separate Retry focus correction; this
checkpoint does not implement or verify that separate change.

## Verification

Four new native form/repository regressions use the real plugin composition and FakeVault.
The draft-to-received case checks Preview writes nothing, Apply writes once, the saved
status is received, and focus reaches the connected Project control. Peer Quote deletion
is exercised during both edit and revision. Peer Work removal uses a real RenovationCommand
with an independent ledger. Cancellation retains the raw draft until close, dispatches no
write, and preserves every persisted path/byte entry after the peer operation.

- Before wiring the helper: four failures, all at the expected focus destination,
  37.02 seconds. No test fixture correction was needed.
- After wiring it: 20 tests passed in four files, 12.66 seconds. This includes all new
  cases and the existing Quote flow, Project Work flow and Project Work recovery suites.
- Final `vue-tsc --noEmit`, whole-tree Oxlint, scoped ESLint for the four changed source/test
  files, and `git diff --check` passed. Fallow dead-code and duplication checks with
  `--fail-on-issues` reported zero dead-code issues and zero clone groups. Health and
  coverage were not rerun in this bounded contribution.

Reports remain in `%TEMP%/rp-e-downstream-focus-red.json` and
`rp-e-downstream-focus-green.json`; the static report is `rp-e-downstream-focus-static.json`.
This is bounded native DOM/repository evidence, not a new browser capture, full quality
gate, performance measurement, live Obsidian or manual screen-reader result. Thresholds,
exclusions and browser assertions are unchanged.
