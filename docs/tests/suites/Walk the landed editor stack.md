---
type: Test suite
order: 230
sources:
  - "[[Smoke Test the Editor]]"
status: Ready
---
# Walk the landed editor stack

The plan-editor stack (#74–#92) landed in `main` on 2026-09-08 at `7d4bc381`. Every one of
its eleven PRs passed the four gates on all four CI legs, and `npm run check` passed once
more on `main` itself (668 files / 8143 tests; statements 99.27%, branches 98.24%,
functions 99.31%, lines 99.56%; fallow 0 above threshold). **None of that has seen
Obsidian.** The build in `.obsidian/plugins/renovation-planner/` is that commit's, produced by
`npm run test-build`, and it is what the cases below are to be walked against.

This list exists because every manual case under `docs/tests/cases/` has NO run against the
landed build. Three carry a dated run from late August (before any of this stack), four carry
browser-harness runs against FakeVault with "live Obsidian: not run" written in them, and the
rest were never run at all. The rows are ordered by risk, and risk here means two things
multiplied: how much of the case's surface the stack changed, and how far the case's pass
condition sits from anything a gate can reach (a real sidecar on disk, two leaves, Obsidian's
own keymap, a `Notice`, a screen reader). The reason column names the change that makes each
walk worth a human's time; the case itself carries the steps.

Nothing here is marked run. That column is the walker's, not this document's: record the
outcome in the case's own Runs table, against `7d4bc381`, and file what fails as an issue
naming the step. [[Smoke Test the Editor]] says what to do with a failure and why the fakes
are the first suspect.

## Cases, most risk first

| # | Case | Last run | Why it is here |
| --- | --- | --- | --- |
| 1 | [[Draw connected walls and openings]] | harness only (Chromium 148, FakeVault) | #86 and #87 changed how a structure edit's undo decides it was superseded (whole-document comparison, objects sorted by id, sidecar receipts on Room deletion and boundary restore). Every one of those is a claim about a sidecar file Obsidian writes and re-reads; the suite's sidecar is in memory. |
| 2 | [[Configure a reference plan]] | harness only (Edge 152, FakeVault) | #85 rewrote what the reference baseline reads (sidecar calibration, `null` clears), what it publishes (Zone cascades in sequence) and how a rotated calibration compares (snapped within 8ε of 1). Its `normalizePath` fix is about what Obsidian's rename events carry, which FakeVault only imitates. |
| 3 | [[Resize a room]] | not run (live host row open) | #82's version now digests the Zone note AND its sidecar entry, so a sync that touches only the `.rpgeo` reaches the conflict path. Only a real second writer on a real file can show the "Latest saved size" arm firing for the right reason. |
| 4 | [[Rename a room]] | not run (live host row open) | #83's Inspector refresh on a PEER leaf's rename needs two Plan Editor leaves on one plan in one workspace; the suite has one fake leaf that records asks. |
| 5 | [[Reload a room]] | not run | #87's metadata-only renovation writes the sidecar as a compare-and-swap no-op, one revision per write. What a reload reads back after that, and after a deletion mid-flight, is the persistence claim this case exists for. |
| 6 | [[Recover from a stale read]] | not run | #88 (and #90's re-implemented recovery) distinguish saved-but-stale from refused, conflicting and unrecovered writes. Every one of those states is drawn from a read that raced a real vault event. |
| 7 | [[Add an area from the catalogue]] | harness only | #75/#76 route every Area completion (Enter, Finish, first-corner click) through one guarded action and move focus to Apply when Escape clears the corner rows. Focus movement and a `<select>`'s Escape are host behaviours the case records rather than asserts. |
| 8 | [[Open a floor and select a room]] | not run | #74's multi-selection mode is now per-leaf state and its Escape handling declined the picker exclusion on a Chromium measurement (an open `<select>` dispatches no keydown). That measurement was made in a browser, not in Obsidian's Electron. |
| 9 | [[Notices and save state]] | not run | The one surface no capture can draw (no `.notice` rule in the vendored sheet). The stack added notices for structure refusals (six command-level `spatial.*` codes), planning faults and review generation; none has been seen. |
| 10 | [[Editor Walkthrough]] | 2026-08-24, item 12 FAILED | Slice 5's Definition of Done. Its last run found a restored leaf hydrating against an empty index; the stack changed leaf creation, view state and the editor shell around it and the case has not been walked since. |
| 11 | [[Zone Editing Walkthrough]] | not run | Slice 8's draw/move/reshape/delete/undo by hand. #86/#87 mixed structure history into the same `CommandHistory`, so every undo sequence here now crosses a boundary that did not exist when the case was written. |
| 12 | [[Calibrate a Plan]] | 2026-08-26, gesture drew nothing | The calibration derivation is the line #85 changed. The last run's defect was a gesture giving no visual feedback, exactly the kind of thing the raised-timeout gate cannot see. |
| 13 | [[Assign an Asset and Delete a Referenced Zone]] | not run | Deleting a Zone now returns a sidecar receipt (#87) and the delete-with-references decision sits over that path. Three of its twenty steps are layout and reload, unreachable from jsdom. |
| 14 | [[Canvas Navigation]] | not run | Nine of seventeen steps need Obsidian's keymap or a real desktop. Unchanged by the stack, but the stack's Alt-cycling fix (#74) shares the pointer grammar. |
| 15 | [[Add a room]] | not run | The Add → Room route gained a free-shape arm and native name field in #91; the case's banner layout was read once in headless Chromium and never in a vault. |
| 16 | [[A note that cannot be read]] | not run | #86 validates a structure draft against the sidecar's ids rather than the readable notes, so one unreadable Room no longer blocks wall editing. This case is where an unreadable note is actually produced. |
| 17 | [[Price a shared asset for one project]] | not run | #88's cost stage transition (settlement link cleared on committed) sits on the price surfaces; the case was written before the planning panels existed beside them. |
| 18 | [[Back arrow over a dirty price draft]] | not run | The pane's back arrow is Obsidian's; `FakeLeaf` records asks. Unchanged by the stack, but every dirty-draft guard in the stack (#88's planning drafts, #91's outline edits) shares this door. |
| 19 | [[Navigate into a project and back]] | not run | Same arrow, same fake; the case's Runs table says "written and not run" and the guide names it as the one place the arrow is checkable. |
| 20 | [[Find and resume a project]] | not run | Nothing on the Home surface has been drawn by Obsidian; #91 added Project and Asset Library navigation beside it. |
| 21 | [[Create a Project]] | not run | Slice 16's field-error vocabulary; its steps 7/7b are the one place a disabled control's focus loss is looked at. Untouched by the stack except through shared form components. |
| 22 | [[Design an Asset]] | not run | Per-asset view, untouched by the stack; listed because it shares the editor shell and the transformer normalisation the stack's tools use. |
| 23 | [[Open the Asset Library]] | not run | Vault-wide catalogue, untouched; #91's Asset Library navigation is a new door into it. |
| 24 | [[Browse the asset library]] | not run | Same surface as above; shelves and inspector unchanged. |
| 25 | [[Move the Library]] | not run | Settings ACTION row; untouched by the stack. |
| 26 | [[A Project Owns Its Folder]] | not run | Slice 18's folder derivation; untouched by the stack. |
| 27 | [[Empty States Walkthrough]] | 2026-08-27, pass | The one clean walkthrough on record. Listed last because its surfaces changed least, and first among things to re-walk if item 10 fails, since both hang on the same restored-leaf timing. |

## What this list is not

It is not a claim that the automated evidence is thin: each PR's body and the review threads
under it name the tests that went red before each fix. It is the record that the eleven PRs'
Definition-of-Done rows reading "live Obsidian: not run" are still true after landing, kept in
one place so the next session does not have to re-derive it from twenty-seven Runs tables.
