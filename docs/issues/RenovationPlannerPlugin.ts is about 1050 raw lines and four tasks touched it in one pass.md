---
type: Issue
parent: "[[The project surface]]"
order: 70
status: New
started: ""
finished: ""
horizon: Next
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

# RenovationPlannerPlugin.ts is about 1050 raw lines and four tasks touched it in one pass

`src/plugin/RenovationPlannerPlugin.ts` is 1129 raw lines today (`wc -l`), counting 376 against
the `max-lines` cap of 400 (comments and blank lines skipped) — currently under the cap, but
this pass alone had four separate tasks land changes in it: settings persistence
(`saveSettings`, `persistLibraryFolder`), the disposal cascade, vault-change registration, and
the library migration's rebuild wiring all live in the same file.

## What is true today

The file is not over budget, and no test is red. The ledger's own Task 3 note flags this as a
"watch it at T4/T5/T10" item precisely because it is one file absorbing settings persistence,
plugin lifecycle, vault registration and migration orchestration at once — four concerns that
elsewhere in this codebase each have their own module.

## What closes it

Splitting the settings-persistence half out (`saveSettings`, `persistLibraryFolder`, and the
`settingsFrom` boundary they compose) into its own module is the improvement named in the
brief. `tests/build/registration-locality.test.ts`'s existing scan (the nine registration
members it holds to `src/plugin/`) is what a split would need to keep passing without
widening — the extracted module would still need to live under `src/plugin/` for that gate to
hold.

## References

- [[The project surface]]
- `src/plugin/RenovationPlannerPlugin.ts` — `saveSettings` and `persistLibraryFolder`, the
  settings-persistence half a split would carve out.
- Task 3 note, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/progress.md`.
