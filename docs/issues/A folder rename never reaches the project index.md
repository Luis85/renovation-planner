---
type: Issue
parent: "[[The project surface]]"
order: 40
status: New
started: ""
finished: ""
horizon: Now
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

# A folder rename never reaches the project index

`RenovationPlannerPlugin` filters the vault's create/modify/delete and rename events to
`TFile` before handing them to `VaultChangeAdapter`. Obsidian reports a folder rename or
delete as a `TFolder` event, so every one of them is dropped before the adapter ever sees it,
and the Project Index keeps every descendant note's OLD path until the next full rebuild.

This is recorded here rather than fixed because it is the largest live gap the 2026-09-05
whole-tree review found (I7) and the polish pass that closed most of that review's findings
ruled it explicitly out of scope (ruling R6): "recorded pre-existing, has a manual case that
names the reload, and the remedy (`Vault.recurseChildren` on the `TFolder` arm) needs its own
test fixture for a folder event."

## What is true today

[`docs/development/agent-guide-increment-history.md`](../development/agent-guide-increment-history.md)
already records this as PRE-EXISTING, dating it to design slice 4's persistence pipeline —
slice 19's library-overlap marker was only the first consumer to make the gap visible, not
its cause. Closing it is a change to the vault-change pipeline every index consumer
inherits, not to whichever surface next notices it.

The manual test case
[`docs/tests/cases/Move the Library.md`](../tests/cases/Move%20the%20Library.md) already carries
the consequence rather than the fix: steps 12 and 12b require a reload (RESTARTING Obsidian,
or a settings save, both of which trigger `onLayoutReady`'s full rebuild) before the project
list's overlap marker reflects a folder the user just dragged. Without that reload the row is
stale — it shows whatever the index believed before the drag — and the case says so rather
than asserting the marker updates live.

## What closes it

- `Vault.recurseChildren` on the `TFolder` arm of both the rename and the delete handlers,
  walking every descendant `TFile` and feeding each one through the same path the existing
  per-file handler already takes — so the fix is in the FILTER, not in a second code path
  the adapter has to learn.
- A fake that actually fires a `TFolder` rename: `tests/helpers/vault.ts`'s `FakeVault`
  already fires `delete` for a folder (`FakeVault.delete`'s folder arm, added by Task 17 of
  the 2026-09-05 polish pass) — `grep -rn "trigger('delete'" tests/helpers/` finds it — but
  `grep -rn "trigger('rename'" tests/helpers/` finds nothing: neither `FakeVault` nor
  `tests/helpers/fixtureVault.ts`'s `FixtureVaultAdapter` raises a `TFolder` rename today,
  and every test needing one stubs `fileManager.renameFile` instead of the vault's own event.
  Closing this issue needs the rename half of that fixture, or the fix is provably correct
  only by reading it.
- The manual case's own reload step loses its reason once the index updates as the folder
  moves: `Move the Library.md` steps 12 and 12b are what should be deleted or rewritten to
  assert immediacy, once the fix lands, as the check that the promise moved from "eventually
  right after a rebuild" to "right".

## References

- [[The project surface]]
- `docs/development/agent-guide-increment-history.md` — the PRE-EXISTING record this note
  points at rather than duplicates.
- `docs/tests/cases/Move the Library.md` — steps 12 and 12b, the reload this issue's fix
  would let the case drop.
- Ruling R6, `.superpowers/sdd/2026-09-05-improvement-and-polish-pass/progress.md` — why this
  pass did not take it: no test fixture exists for a folder event yet, and the remedy needs
  its own.
