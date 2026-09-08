# Spatial removal with optional persisted fields

Status: **native/type/lint verified in Root; full coverage contribution pending**. Prepared on 2026-09-07 in the root topic
worktree. The package consists solely of the new
`tests/presentation/editor/spatialRemovalLegacy.test.ts` and this document. No
production, existing test, helper or shared status file was changed. Root owns
checkpointing and the next verification slot; no tests, types, lint, build,
browser or analyser were run by this owner.

## Persisted-format scenarios

1. **Existing generic elements with an absent optional register.** The real
   `elementInput`/renovation commands first create three valid named elements.
   `withPlanRenovation(plan, undefined)` and the actual conditional Plan repository
   then remove only their empty register, representing a valid external edit of
   optional metadata. This is explicitly not what the current element creator
   writes by default. A real projection refresh and repository read establish the
   absent register and intact geometry before deletion. Native batch Delete and
   Cancel preserve all vault bytes. Confirm deletes only two selected elements
   and their labels, retaining the third, Room outlines, walls and absent Intended
   structure. Native toolbar Undo restores the exact geometry and labels and the
   original absence of `renovation`, including its absence in Plan frontmatter.
2. **Wall proposal predates current elements.** Native Room context, Planned
   navigation and form controls first save a real wall-height proposal from 2400
   to 2500 mm. The freshly read Intended structure has no `elements` property.
   Real commands subsequently add three current elements without replacing that
   proposal. Native batch Cancel preserves bytes. Confirm removes two current
   elements while preserving the third, the wall proposal's geometry and Subject
   facts, and the absence of `intended.elements`. Native toolbar Undo restores
   all previous geometry and labels while retaining the proposal and absence.

Spatial selection is public fixture setup. Delete, disclosure, Cancel, Confirm
and Undo use actual rendered controls. No fabricated Baseline/Result, private Vue
callback, exception injection or test-only production seam is used. The per-file
`afterEach` unmounts every editor fixture.

## Why these cases differ from existing coverage

The audit used the original full `coverage-final.json` from
`%TEMP%/rp-finalization-20260907-88b9ee3d/ci-f3067d82-linux24/`. Both production files
were unchanged since that source checkpoint. Expected candidate arms, not claimed
or measured hits, are:

- `spatialRemoval.ts:37`, branch `6:1`: absent optional renovation register.
- `spatialRemovalInput.ts:15`, branch `3:1`: the same valid persisted absence.
- `spatialRemovalInput.ts:9`, branch `0:1`: filtering the older Intended structure
  without an element array.

Existing batch fixtures create generic elements through commands, thereby
materializing an empty renovation register; their Intended fixtures also copy
the current element array. These cases preserve valid storage invariants while
varying those two assumptions.

Room/Area batches do not enter this removal path. Wall-only batches use
`structureActions`; the generic path requires a current element. No missing-current-
structure or malformed-catch cases were added merely to hit defensive counters.

## Resume and remaining verification

Source review and whitespace checks of the two new files are the only completed
checks. The native run must establish the optional field behavior, exact Cancel
byte identity, correct partial deletion, and toolbar Undo restoration on the
integrated source. In particular, do not weaken absent-field assertions to accept
an empty register/array: those distinctions are the behavior under test.

After the native run, execute the normal shared type/lint gates and measure
coverage against a new combined full-run artifact. Preserve old complete coverage
files when executing scoped coverage. These fixtures cannot prove live Obsidian
event timing or replace the final visual and host acceptance work.

## Root verification

Both native cases passed in37.08seconds. Subsequent whole type checking, whole
Oxlint and scoped ESLint passed. A fresh static Fallow scan reports zero dead-code
issues and clone groups. No production change or assertion correction was needed.
Logs: spatial-removal-legacy-native/types/static under the root finalization scratch.
The expected three new branch arms remain unmeasured until full CI on this checkpoint.
