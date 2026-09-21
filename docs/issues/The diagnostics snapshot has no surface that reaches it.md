---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 40
status: Done
started: 2026-08-31
finished: 2026-08-31
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
strategic-alignment: ""
customer-value: ""
business-impact: ""
reach: ""
risk-reduction: ""
compliance: ""
time-criticality: ""
enablement: ""
confidence: ""
effort: ""
complexity: ""
business-value: ""
business-value-model: ""
---

# The diagnostics snapshot has no surface that reaches it

Found by a final whole-branch review of the slice 11/14 polishing pass, in the one
user-facing sentence that pass added.

## The question

`GetDiagnosticsSnapshot` is built, guarded, composed and tested. It reports versions, schema
versions, migration state and the session's read refusals — and it is consumed by nobody.
`grep -rn -i diagnostics src/presentation/` returns nothing; `src/plugin/` declares four
commands and none of them is this; the settings pane has three settings and none of them is
this.

That was a dormant capability and no more, until the pass wrote a warning string that said:

> "Some projects could not be read from the vault. **Open the diagnostics report for details.**"

The user has no way to do that. The second sentence was removed and the first ships alone, so
nothing today points at a surface that does not exist — but the underlying gap is now
load-bearing rather than dormant, because the partial-listing design explicitly relies on it.
The count travels to the view precisely *because* the per-entity detail was said to live in
the diagnostics report, and that report is unreachable.

## What is true today

- The refusals really are recorded. `ObsidianProjectRepository.getById` writes each into the
  `DiagnosticsLedger` before returning `err`, so a partial listing loses nothing — the data is
  there, on the device, with no way to look at it.
- The ledger is bounded: `MAX_ISSUES = 200`, oldest-first eviction, deduplicated on
  `(kind, id, code)`. Dedup is what keeps the bound out of reach in practice, since re-reading
  the same broken note across hydrations records once.
- The warning the user does see is count-free ("Some projects could not be read"), which was a
  deliberate narrowing: a counted sentence needs string interpolation, and `t(language, key,
  params?)` does not exist yet.
- Nothing in the suite or lint can notice this. A composed-but-unconsumed query is not a dead
  export — `fallow` sees it reached from the composition root — so the gate is green.

## Alternatives weighed, and why they were not taken

- **Keep the sentence and build the surface later.** Rejected: a control that does nothing is
  the exact failure mode this codebase already named for buttons ("Both render no button rather
  than a live control that does nothing"), and a sentence is not exempt from it because it is
  not clickable.
- **Point the user at the developer console instead.** Rejected: the console holds the log
  lines, not the snapshot, and telling a user to open devtools is not an answer for the
  plugin's central surface.
- **Interpolate the count into the warning** so the sentence at least says how many. Rejected
  for now on scope — it needs the interpolating `t()` that slice 15 left open, and it would
  still not say *which* notes, which is the thing the user needs in order to act.

## Why it matters

- The whole argument for `listAll` skipping-and-counting rests on "the per-entity detail
  already lives in the diagnostics report". That is true of the ledger and false of anything
  the user can open, so the design's fallback is currently a fallback to nothing.
- It is the missing half of at least two other recorded limitations: a user who cannot delete
  an unreadable note (see [[A future-version note can be neither read nor deleted]]) and a user
  whose projects partly failed to load both need the same thing — a place that says which note,
  and why.

## What closes it

Not designed here, and the shape is the open question rather than the work. A command
(`open-diagnostics-report`) is the cheapest and matches how everything else in this plugin is
reached; a settings-pane section is more discoverable and fits the "stays on the device"
framing; a view is the most useful and the most expensive. Whichever is chosen, the copy
removed from `view.project.some-unreadable` is what should come back, and the string is a
one-line revert once the surface exists.

## Resolution — 2026-08-31

`src/plugin/diagnostics/DiagnosticsReportModal.ts`, reached by a palette command
(`show-diagnostics-report`) and a settings ACTION row, both through
`showDiagnosticsReport` — one action, every input.

**A plain-DOM `Modal`, and not slice 15's `DialogHost`.** That host is scoped to an
ItemView's Vue app, and a palette command has no such host when no view is open; mounting
this in Vue would have meant a third Vue app — the plugin-global one SDD §12 would need an
exception for and slice 13 deliberately never built. `createDiv`/`createEl` is what the
notice live regions and the settings pane already use.

**The ledger's compile-time guarantee is untouched**, checked rather than assumed:
`git diff main -- tests/application/ports/diagnostics.test-d.ts src/application/ports/diagnostics.ts`
is empty. The VIEW joins an id to a path through the project index so the user can find the
broken note; `diagnosticsReportText` takes the snapshot and NOTHING else — there is no
`resolvePath` parameter to pass — so what leaves the device carries no path, and a future
edit wanting one there has to widen the signature. Both directions of that asymmetry are
measured as mutations rather than argued.

Two limitations remain, both written where they are met rather than only here:

- **Session scope.** The ledger is in-memory, so reopening the vault empties the report. The
  modal says so on its own surface (`diagnostics.session-only`), because an empty report
  after a restart means "not recorded yet" and never "nothing is wrong".
- **A strip's count and the report's rows can disagree, and that is not reconciled.** A strip
  counts ONE listing; the report holds every refusal this session, deduplicated on
  `(kind, id, code)` and bounded at `MAX_ISSUES`.

**A session whose settings could not be read gets a refusal rather than a report.** The query
is composed inside `persistence`, which is `null` exactly when `settings` is, so there is no
snapshot to draw — and an empty report would say "No notes have refused to load in this
session" about a session that never attempted a read.

`view.project.some-unreadable` still carries no second sentence pointing here, and that is now
a choice rather than a constraint: the project LIST's own strip is count-free (the polish
slice's "Deliberate narrowing" this Issue's References already name), so widening it is a
change to that sentence's surface rather than to this one.

Looked at in [[A note that cannot be read]], steps 8 to 12 — written, **not yet run in a
vault**. Nothing anywhere reads `styles/diagnostics.css`: the vendored harness stylesheet
declares no modal chrome, exactly as it declares no `.notice`.

## References

- `src/plugin/diagnostics/DiagnosticsReportModal.ts` and
  `src/plugin/diagnostics/showDiagnosticsReport.ts` — the surface and its one function.
- `src/application/queries/GetDiagnosticsSnapshot.ts` and `src/plugin/guardedServices.ts` —
  built, guarded, composed, unconsumed.
- `src/infrastructure/logging/diagnosticsLedger.ts` — `MAX_ISSUES`, the dedup key, the
  eviction order.
- `src/presentation/i18n/locales/en.ts` — `view.project.some-unreadable`, and the comment at
  the key recording why the second sentence is not there.
- `docs/superpowers/specs/2026-08-27-slice-11-14-polish-design.md` — Item 2's
  "Deliberate narrowing: the warning is count-free".

## Amendment — 2026-09-21: the seam has a SECOND side, and it fails the opposite way

Appended, not edited: everything above stands as written and is about
`view.project.some-unreadable` only. What it does not say is that the Plan Editor meets the
same seam from the other direction. Both halves measured at source on this date.

- **The project list has the report and no sentence pointing at it.** As the Resolution above
  records, deliberately — `src/presentation/i18n/locales/en.ts:337` ships
  `'Some projects could not be read.'` with nothing after it, and the comment at
  `:327-336` gives the reason (the sentence is count-free, so it cannot corroborate the rows
  the report would show).
- **The Plan Editor has the sentence and no way to act on it.**
  `src/presentation/i18n/locales/en.ts:316-317` — `editor.some-zones-unreadable` already ends
  *"Open the diagnostics report to see which notes refused."* It is the counted sentence the
  other key is not, so the objection above does not apply to it. But its row is pushed with no
  `actions` array (`src/presentation/editor/shell/warnings.ts:112-118`), and
  `PersistentWarningStrip.vue:117-130` renders the actions group under
  `v-if="w.actions !== undefined"` — so the strip that carries the instruction offers no
  control that follows it. The two ways to open the report are the palette command and the
  settings ACTION row, neither of them on this surface.

So the copy this Issue says "should come back" is in fact already back on one surface, without
the door beside it. `unreadable-zones` is not alone in carrying no actions — `background-missing`
and `background-unreadable` carry none either, which `warnings.ts:51` states about itself — but
it is the only one of the three whose message names a surface the user is told to open.

**Nothing here proposes the fix**, and no code was touched for this amendment. Recorded so the
seam is findable from the side that has the sentence as well as from the side that has the
report — the shape ADR-0015 already uses for a contradiction findable from only one direction.

- `src/presentation/editor/shell/warnings.ts` — `editorWarnings`, the `unreadable-zones` push.
- `src/presentation/editor/shell/PersistentWarningStrip.vue` — the `v-if` on the actions group.
- `src/plugin/diagnostics/DiagnosticsReportModal.ts:161-162` — the report renders each note's
  vault path as an inert `createSpan`, so neither end of this seam is clickable today.

## Amendment — 2026-09-21 (second) — the Plan Editor half is CLOSED in code

Appended, not edited: the amendment above stated the seam and explicitly proposed no fix. This
one records what was then built, so the note stops describing a gap that no longer exists on one
of its two sides.

**`unreadable-zones` now carries an action** (`b226b6c67`, with its fix round at `f7ec76c22`).
The row's button is labelled with the palette command's own `command.show-diagnostics-report`,
already present in both locales, so **no locale string was minted**. `presentation/` still may not
import `src/plugin/`; what the button presses is a callback injected by the composition root,
landing on the same public `RenovationPlannerPlugin.openDiagnosticsReport()` that the palette
command and the settings ACTION row already call — *one action, every input*, now with three
doors rather than two. `planEditorDeps` declines the member in its return type
(`Omit<PlanEditorDeps, 'openDiagnosticsReport'>`), which makes "this function composes no plugin
action" a compiler-checked fact rather than a convention.

**`background-missing` and `background-unreadable` deliberately still carry none**, and the reason
is stronger than the amendment above had it. It is not that their message names no surface: it is
that `DiagnosticEntityKind` (`src/application/ports/diagnostics.ts`) has **no background member**
and no ledger call site records one, so a diagnostics button on either row would open a report
**structurally incapable of mentioning the background**. That reason is now written into
`warnings.ts`'s own docblock, which previously listed all three rows as having "nothing to do
about it yet".

**What this amendment does NOT close, stated so the note is not read as finished:**

- **The project-list half of the inversion is untouched.** It still has the report and no sentence
  pointing at it.
- **Four other shipped strings tell the user to open the diagnostics report and give them no way
  to do it** — `view.project.some-plans-unreadable` (two renderers), `zone.listing-incomplete`,
  `asset.listing-incomplete`, and `view.asset-library.some-unreadable` (whose button opens a
  *note*, not the report). Measured 2026-09-21. This note's framing of "the sentence" as singular
  was narrower than the tree; the seam this slice built makes the rest cheaper, not done.
- **`DiagnosticsReportModal` still renders each note's vault path as an inert `createSpan`**, so
  the far end of the seam remains unclickable. Unchanged by this work.
- **Nothing here has been run in an Obsidian vault.** The row and its button were verified in the
  browser harness (`?view=plan-editor&unreadable=N`, a knob this work added because the zone read
  was hard-coded to zero refusals and no capture could draw the row at all) and by jsdom tests
  including one axe scan. A harness capture is a browser render, not a vault run.

- `src/presentation/editor/shell/warnings.ts` — the `unreadable-zones` push, its `actions` array,
  and the rewritten `EditorWarning.actions` docblock.
- `src/plugin/RenovationPlannerPlugin.ts` — `planEditorViewDeps()` injects the callback;
  `openDiagnosticsReport()`'s docblock now states the rule rather than listing the doors.
- `tests/harness/unreadableKnob.test.ts` — pins which harness knobs survive being combined, after
  the first version of this work left a docblock claiming more than any check could see.
