---
type: PBI
parent: "[[Project dashboard and navigation]]"
order: 100
status: Active
started: "2026-09-05"
finished: ""
horizon: "MVP"
start: ""
due: ""
risk: ""
priority: ""
assignee: ""
iteration: ""
dependsOn:
  - "[[Apply or discard a project's own price deliberately]]"
  - "[[Remove a saved project price]]"
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

# Continue safely after a price error or a parallel change

A price write can meet a conflict, an unknown outcome or a refresh that fails after a confirmed write, and the renovator may be leaving the state with a dirty draft. This note names what happens in each case, and states the one boundary the host will not let the plugin defend: a forced leaf close.

## Actor

A renovator saving a price while sync, another leaf or an error changes the data underneath.

## Main flow

1. The renovator applies a draft.
2. The outcome is distinguished: confirmed, conflict, confirmed but the refresh failed, or unknown.
3. They act on it — reapply deliberately, retry the read, or inspect.
4. They leave the state, and a dirty draft or a pending write is guarded.

## Extensions

- **2a. The version conflicts.** No silent retry against newer data; the draft and its captured version are kept for deliberate reapplication.
- **2b. The write succeeded and the refresh failed.** The row reports Saved, could not refresh — not Save failed. Retry performs only the read, and editing is disabled until it succeeds.
- **4a. A dirty draft and an internal navigation —** Stay or Discard is offered.
- **4b. A write is pending.** Departure is blocked until it settles; no unnoticed switch.
- **4c. The host closes the leaf, replaces the view, remounts on a settings save, reloads or tears the plugin down.** `onClose` offers no veto, so the draft may be lost. That boundary is documented, not promised away.
- **4d. Events burst or the component unmounts.** No stale response lands and no subscription outlives the view.

## Guarantee

**A confirmed write is never reported as a failure, a failed write is never reported as saved, and a draft is dropped only by an explicit Discard or by a host action the plugin cannot intercept.**

## Acceptance criteria

- A write confirmed with a failed refresh shows the saved-but-not-refreshed state, and Retry issues a read only.
- A version conflict keeps the draft and does not rewrite with the newer version.
- Navigating within the project with a dirty draft offers Stay and Discard.

## Scope

No durable recovery and no lossless-close promise. The Asset Library's own guard is [[Switch assets without accidentally losing input]] and its save outcomes are [[Continue safely after save failures or external changes]]; the two surfaces share the vocabulary and not the code.

## Project-surface implementation (2026-09-05)

Write and refresh outcomes are separated in `ProjectDetailState` and `ProjectDetailStore`; the snapshot advances only after a confirmed write; internal state changes and note or plan departure consult the dirty-draft guard. Conflict, write-then-failed-read and unmount are tested (WP-04). Real host closing remains an unrun live-vault observation.

Delivered by pull request #73 (`codex/project-experience`). Live-vault observation — host history, split
leaves, a forced leaf close — is still unrun, so this note is Active rather than Done. Evidence and the
remaining limitations: [execution record](../user-experience/renovation-planner-project-specs/implementation/execution-record.md).

## Sources

`docs/user-experience/renovation-planner-project-specs/implementation/repository-reconciliation-and-backlog.md`
PBI-09 and its §1 rows; screens [P04](../user-experience/renovation-planner-project-specs/screens/P04-project-prices.md); the execution record's WP-00 decisions. Adopted into the register on
2026-09-05 with the rest of that package's ten; the five gaps the adoption ledger found were written the same day
and are its siblings under [[Project dashboard and navigation]].
