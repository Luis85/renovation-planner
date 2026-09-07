# Planning boundary choices — verified native cases

Status: **native/type/lint verified in Root; full coverage contribution pending**. Prepared on the root topic worktree from `f3067d82`
on 2026-09-07. The package contains only the new
`tests/presentation/editor/planningBoundaryChoices.test.ts` and this document.
No production, existing tests, fixture helpers or shared status files were edited.
Root owns the subsequent checkpoint and verification. UI retained the heavy slot.

## Five cases

1. Native material fields save a 12 m² Room source with the fixture's 10% waste,
   lot size 5 and minimum order 20. The saved purchase quantity is 20 m² and cost
   900 EUR at 45 EUR/m². Opening its rendered details shows the saved packaging
   explanation. Editing the override to the explicit string `0` preserves those
   source parameters and calculated quantity while the effective quantity and
   estimated cost become zero. Reopening the form retains `0`, `5` and `20`.
2. A material is saved normally, then its actual catalogue Asset note is removed
   from the isolated FakeVault. A real projection refresh precedes opening Cost
   and Evidence forms. Their Requirement/related-record choices retain the
   Requirement's identity as the fallback label. Cancel changes no bytes. Restoring
   the original Asset bytes and refreshing restores its human name in both forms.
3. The canonical `AssignAssetCommand` produces a Requirement with no contextual
   source. Native Edit uses its real Room and Asset, and Cancel preserves all bytes.
   An explicit subsequent Save adds the room-area source to the same identity,
   without changing quantity or estimated cost or duplicating the Requirement.
4. A real renovation command saves a valid removal Subject: Existing description
   `Old parquet`, Planned `remove` and empty Planned description. The native
   material Outcome option displays the Existing description. Saving material
   retains its selected outcome ID and leaves the Subject facts unchanged.
5. `elementInput` and the real renovation command create a valid named Object.
   Spatial selection establishes the fixture's starting selection. From there,
   native Room context, overview, Planned navigation and form controls create the
   proposal. The default kind and persisted Subject must be `fixture`, with the
   Object's identity and selected Room. Current outline stays unchanged; Undo
   removes the proposal and retains the current Object.

The cases use `renovationEditor(true)` and its actual services/repositories.
No private Vue handlers, `$emit` shortcuts, fake success Results, manufactured
baseline gaps, or production overrides are used. Every mounted editor is cleaned
up by the file's `afterEach`. Each vault is confined to that editor fixture.

## Coverage provenance and bounds

The source audit used `ci-95e7510b-linux24/missing-counters.json` under
`%TEMP%/rp-finalization-20260907-88b9ee3d/`. All six audited production files matched
that checkpoint when the cases were proposed. Expected candidates, **not measured
new hits**, are:

- `MaterialNumbers.vue:19`: branches `4:0`, `5:0`, saved lot/minimum explanation.
- `CostFields.vue:37`: branch `7:1`, unavailable catalogue label.
- `recordChoices.ts:9`: branch `1:1`, unavailable catalogue label.
- `planningDraft.ts:23`: branch `1:1`, actual legacy Requirement source fallback.
- `MaterialFields.vue:92`: branch `16:1`, removal outcome's Existing description.
- `renovationDraft.ts:54`: branch `27:0`, Object maps to fixture.

The missing-Asset test deliberately models an external deletion before the index
has processed the change. Repository reads do not remove that mapping; FakeVault
`entries.set` retires the file's pending parse state on repair. The explicit
projection refresh is exercised; automatic host notification is not claimed.

The Object case uses public spatial selection for setup and native controls for
Room context and the proposal. It does not test pointer hit detection. These cases
do not replace the original visual matrix or Obsidian acceptance.

## Verified root follow-up

The initial two-file run passed eight of nine cases; all four Project-entry cases
passed. The sole failure compared equivalent Money serializations (`594.00` and
`594`) as strings after an explicit legacy Save. The corrected assertion uses the
domain Money comparison, still checks identical overrides and retains byte-for-byte
Cancel assertions. No production change was needed. All five planning cases then
passed in 13.50 seconds. Type checking, whole Oxlint and scoped ESLint passed; static
Fallow reports zero dead-code issues or clones. Actual branch contribution awaits
the next full run.

## Historical source-only handoff

Only source inspection and `git diff --check` have been performed. **No tests,
types, lint, build, browser or analyser were run by this owner.** The new test file
is below the 400-line budget. Root should include it in the next authorized native
batch, investigate actual failures without weakening assertions, then run normal
shared verification and measure coverage on the integrated source. Keep original
full-run coverage artifacts intact when running scoped coverage.
