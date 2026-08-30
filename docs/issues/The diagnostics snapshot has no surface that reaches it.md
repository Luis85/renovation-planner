---
type: Issue
parent: "[[Errors, diagnostics and the test harness]]"
order: 40
status: New
started: ""
finished: ""
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

## References

- `src/application/queries/GetDiagnosticsSnapshot.ts` and `src/plugin/guardedServices.ts` —
  built, guarded, composed, unconsumed.
- `src/infrastructure/logging/diagnosticsLedger.ts` — `MAX_ISSUES`, the dedup key, the
  eviction order.
- `src/presentation/i18n/locales/en.ts` — `view.project.some-unreadable`, and the comment at
  the key recording why the second sentence is not there.
- `docs/superpowers/specs/2026-08-27-slice-11-14-polish-design.md` — Item 2's
  "Deliberate narrowing: the warning is count-free".
