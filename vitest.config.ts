import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			// The real 'obsidian' package is types-only; tests run against a small mock.
			// Written INLINE, not imported from a shared module: fallow resolves the
			// alias by reading this literal, and an imported value would blind it to
			// every `import ... from 'obsidian'` in src/. The identical literal in
			// `vite.harness.config.ts` is pinned to this one by
			// `tests/build/config-alias.test.ts`, so the two cannot silently drift.
			obsidian: fileURLToPath(new URL('./tests/helpers/obsidian-mock.ts', import.meta.url)),
		},
	},
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			// `.vue` as well as `.ts`: the floors are ratcheted and they are one of the four
			// gates, so an SFC outside this include is a file whose untested branches cost
			// nothing — component tests run, the numbers do not move, and the gate passes
			// over code it never measured.
			include: ['src/**/*.{ts,vue}'],
			// `src/main.ts` is registration glue needing the real Obsidian Plugin runtime.
			// `src/prototypes/**` is design scaffolding: nothing in the tree ships, so measuring
			// it would let a mock's untested branches move a gate that exists for shipped code —
			// and the floors are a RATCHET, so a tree that drags them is a tree that lowers them.
			// `tests/build/prototypes-not-bundled.test.ts` proves the "never in a built plugin"
			// half directly: a real `vite build` in memory (`write: false`, so nothing is ever
			// written to `dist/`), asking Rolldown which modules composed each chunk.
			exclude: ['src/main.ts', 'src/prototypes/**'],
			reporter: ['text-summary', 'json', 'lcov'],
			// THE RATCHET. Raise these to what a FINISHED increment measures, rounded
			// down, and never lower one to accommodate a change. Three rules that the
			// source project learned the hard way:
			//
			// 1. Leave at least one covered unit of headroom under the measurement
			//    (`1 / total * 100` per metric). A floor set to the exact measured figure
			//    fails on a legitimate change that deletes one fully covered branch — the
			//    numerator and the denominator fall together, so removing covered code
			//    lowers the ratio.
			// 2. A mid-increment figure is not the increment's figure. Refactoring later
			//    in the same branch deletes covered branches and moves the number.
			// 3. Expect the last hundredth to be irreproducible, and do not chase it with
			//    run counts. In the source project, runs on an unchanged tree differed by
			//    exactly one covered statement and one covered branch, and the two CI
			//    platforms differed the same way. Put the floor under the LOWEST figure
			//    any environment has reported.
			//
			// A coverage failure is first a question about which branch nothing can take.
			// Look for the dead branch before writing the test: deleting an unreachable
			// arm raises the figure on a smaller denominator.
			//
			// Measured 2026-08-23 at the end of design slice 1 — the Logger port and its
			// console sink, the composition root, the unrecovered-settings boundary and the
			// Vue mount lifecycle and the plugin-data probe, with `src/**/*.vue` inside
			// `include` above: 92/92 statements, 34/34 branches, 33/33 functions, 81/81 lines —
			// 100% of all four.
			//
			// Measured 2026-08-23 again at the end of design slice 2 — core primitives:
			// geometry types and operations, the mm convention, ULID identity, Result,
			// AppError and the event bus — 241/241 statements, 100/100 branches,
			// 71/71 functions, 220/220 lines. Still 100% of all four.
			//
			// Which increment moved which figure, so git is not the only record:
			//   - first measurement, 21 statements:  95 / 75 / 90 / 94
			//   - the view, its activation, registration, i18n and the settings pane
			//     (44 statements):                   97 / 91 / 95 / 97
			//   - design slice 1 (92 statements):    98 / 97 / 96 / 98
			//   - design slice 2 (241 statements):   99 / 99 / 99 / 99  ← this one
			//
			// The floors are not 100. Rule 3 above wants one covered unit of headroom, and at
			// n=241 a statement is 0.4pp and a BRANCH 1pp — a whole-number floor sits a
			// couple of units under the measurement. Pinning 100 would make the first
			// genuinely unreachable defensive branch a choice between a test gymnastic and
			// lowering a floor, and a floor never comes down.
			//
			// Measured 2026-08-24 at the end of design slice 4 — the Obsidian repositories,
			// geometry sidecar store, project index/builder/change pipeline, migration
			// runner, and the settings/composition extensions: 1277/1284 statements,
			// 615/628 branches, 319/320 functions, 1178/1182 lines. Branches carry ~4
			// phantom arms attributed to bare `import` statements (an ast-v8-to-istanbul
			// artifact that no test can execute) plus deliberately-defensive double-fault
			// logging arms, so the branch floor sits lower than the others per rule 1's
			// headroom arithmetic: at n=628 a branch is 0.16pp.
			//
			// Measured 2026-08-24 again after slice 4's review fixes — the settings-save
			// rewiring, the shared restore/path/version helpers, the duplicate-id
			// diagnostics, and tests for the out-of-band sidecar removal and the zone
			// delete compensation: 1294/1298 statements, 628/635 branches, 321/322
			// functions, 1183/1185 lines. Every metric above the previous measurement, so
			// BRANCHES ratchet 97 → 98: at n=635 a branch is 0.157pp, which leaves 0.89pp
			// — about five branches — of rule-1 headroom under the 98.89 measured.
			//
			// The other three stay at 99 and that is not an oversight: they measure 99.68
			// and up, and the only whole number above 99 is 100, which the paragraph above
			// refuses on purpose. The remaining uncovered arms are the defensive ones named
			// there plus `GeometrySidecarView`'s Obsidian-runtime callback.
			//
			// Measured 2026-08-24 at the end of design slice 5 — the canvas and editor shell:
			// the viewport transform, the three Pinia stores, the presentation read models,
			// the Konva scene and its seven layers, the image/PDF background pipeline,
			// `SetPlanBackgroundCommand` and its snapshot inverse, the Plan Editor view and
			// its two commands: 1783/1789 statements, 802/813 branches, 468/469 functions,
			// 1633/1636 lines — 99.66 / 98.64 / 99.78 / 99.81.
			//
			// NOTHING RATCHETS, and that is the policy working rather than an omission:
			// rounded down, this increment measures exactly the floors already in force.
			// Branches gained the most room (97 → 98 was slice 4's rise; 98.64 now leaves
			// about five branches of headroom at 0.123pp each), and the next whole number
			// is 99, which 98.64 does not reach. The other three sit between 99 and 100,
			// and 100 is refused above.
			//
			// What the six uncovered statements and eleven branches are, so the next
			// increment does not go hunting: slice 4's defensive double-fault logging in
			// `ObsidianZoneRepository`, `GeometrySidecarView`'s Obsidian-runtime callback,
			// the ~4 phantom `import` branches this file already names, the plugin's
			// non-`TFile` vault-event arm, `PlanCanvas`'s null-container guards (a template
			// ref is never null once mounted), and `ReversibleSetPlanBackground`'s
			// re-validation of a snapshot that was valid when it was taken. Every one is
			// either unreachable by construction or an arm whose whole purpose is to not
			// happen.
			//
			// Measured 2026-08-24 again after the pdf.js swap — `pdfRaster.ts` asking
			// Obsidian for its own pdf.js instead of bundling one: 1781/1787 statements,
			// 802/813 branches, 467/468 functions, 1631/1634 lines — 99.66 / 98.64 / 99.78 /
			// 99.81, the same four figures as slice 5 on a denominator two statements and
			// one function smaller (`installWorker` and the worker import are gone).
			// NOTHING RATCHETS, for the reason the slice 5 paragraph gives.
			//
			// Measured 2026-08-24 again after the reviewability work — the three create
			// commands wired into the composition root, the sample-project seed and its
			// command, the plan picker, and `open-plan-editor` losing its active-file
			// precondition: 1809/1815 statements, 806/817 branches, 477/478 functions,
			// 1657/1660 lines — 99.66 / 98.65 / 99.79 / 99.81. The same four rounded figures
			// again, so NOTHING RATCHETS again; the uncovered set is unchanged from the list
			// above, and the seed's three early returns are each driven by their own injected
			// failure rather than left as the increment's new uncovered arms.
			// Measured 2026-08-24 again after the two defects a live vault found — the
			// metadata-cache parse window (`frontmatterOf`'s echo fallback, and the fake that
			// now models the delay) and the leaked `window.Konva` (`onunload`): 1834/1840
			// statements, 814/825 branches, 482/483 functions, 1678/1681 lines —
			// 99.67 / 98.66 / 99.79 / 99.82. Every metric at or above the previous
			// measurement, and NOTHING RATCHETS again for the same reason: rounded down these
			// are the floors already in force, and the next whole number up is 100 for three
			// of them and 99 for branches, which 98.66 does not reach.
			// Measured 2026-08-24 again after the sidecar folder fix and the real-PDF test:
			// 1835/1841 statements, 814/825 branches, 482/483 functions, 1679/1682 lines —
			// 99.67 / 98.66 / 99.79 / 99.82. Unchanged rounded down, so NOTHING RATCHETS.
			// Measured 2026-08-24 again after the sidecar echo-suppression fix: 1838/1844
			// statements, 816/827 branches, 483/484 functions, 1681/1684 lines —
			// 99.67 / 98.66 / 99.79 / 99.82, the same four as before it. Worth recording
			// because the fix briefly LOWERED branches to 98.42: suppressing our own writes
			// left the mapping upsert reachable only by a sidecar this session did not write,
			// which is a real scenario that had been riding on our own writes for its
			// coverage and now has a test of its own. NOTHING RATCHETS.
			// Measured 2026-08-24 again after the restored-leaf fix (`ProjectIndexRebuilt`):
			// 1843/1849 statements, 816/827 branches, 486/487 functions, 1685/1688 lines —
			// 99.67 / 98.66 / 99.79 / 99.82, the same four again. NOTHING RATCHETS.
			//
			// Measured 2026-08-25 on the SLICE-11 BRANCH (before merging main) - error
			// handling, diagnostics and data safety: the schema-version fail-closed gate
			// (future versions refuse as `MigrationError`), the guarded command/query
			// boundary logging BOTH thrown exceptions and resolved failed Results,
			// `toUserMessage`, the diagnostics snapshot query and its deduplicating ledger,
			// and the verbose-logging setting applied live at load AND on save:
			// 1910/1920 statements, 855/871 branches, 506/509 functions, 1748/1755 lines.
			// Kept as that branch's record only; the MERGED tree is re-measured below.
			//
			// Measured 2026-08-25 on the MERGED tree (slice 11 + main through slice 8 and
			// the signed-Money work): the guards now wrap slice 8's zone commands and the
			// Inspector query too; the diagnostics snapshot is driven through the real
			// composition root; and the sidecar read path gained its own fail-closed tests.
			// 2780/2798 statements, 1289/1313 branches, 732/738 functions, 2526/2535 lines -
			// 99.35 / 98.17 / 99.18 / 99.64. NOTHING RATCHETS: rounded down these are the
			// floors already in force.
			//
			// Measured 2026-08-24 at the end of design slice 9 — the quantity and cost
			// engine (`core/money` arithmetic over decimal.js, `core/units`, `core/derived`,
			// `domain/cost`), including the review pass that Result-typed `applyPackaging`
			// and added the pricing-basis/negative-percent/coverage-sign guards:
			// 1946/1954 statements, 893/906 branches, 508/509 functions, 1771/1774 lines —
			// 99.59 / 98.56 / 99.80 / 99.83. Rounded down these are 99 / 98 / 99 / 99 —
			// exactly the floors in force, so NOTHING RATCHETS; statements and branches
			// gained new covered units but not enough to move a whole-number floor.
			//
			// What slice 9 adds to the uncovered set: the two `Result` propagation guards in
			// `costPipeline.ts` (the discount-stage `subtract` and the final tax `add`). Both
			// guard an operation whose operands derive from `unitPrice` itself — the parts
			// are `percentageOf` of values already in that currency — so the mismatch arm is
			// unreachable by construction and kept only because the callee's `Result` cannot
			// be honestly discarded. Every guard the review pass ADDED is covered: driven
			// through both `runQuantityEngine` and its stages, and both sides of each arm.
			// Measured 2026-08-25 at the end of design slice 6 — the editor tool framework:
			// serialized CommandHistory, the reversible move-zone adapter, transformer scale
			// normalization, the injectable SnapService, the selection store, the
			// EditorContext facade and render state, the tool registry, and the Inspector's
			// selection-to-DTO-to-command pipeline: 2043/2049 statements, 908/919 branches,
			// 543/544 functions, 1867/1870 lines — 99.70 / 98.80 / 99.81 / 99.83. NOTHING
			// RATCHETS: rounded down, statements/functions/lines still sit at 99 (100 is
			// refused above) and branches still sit at 98 (98.80 does not reach 99) — the
			// same four floors already in force.
			// Measured 2026-08-25 again after slice 6's whole-branch review fixes — an ordered
			// Transformer/snap-resize box, the Inspector's stale-response token, and the
			// tests that make the undo cap, the gesture's persistence write and DoD 12
			// discriminate: 2052/2058 statements, 912/923 branches, 543/544 functions,
			// 1874/1877 lines — 99.70 / 98.81 / 99.81 / 99.84. The UNCOVERED sets are
			// unchanged (the same six statements, eleven branches, one function and three
			// lines enumerated above); only the denominators grew. NOTHING RATCHETS.
			// Measured 2026-08-25 again after slice 9's review fixes — the Money non-negative
			// invariant at `fromDecimal`, `round` serializing at the minor unit, the private
			// decimal.js constructor clone, the discount's upper bound, and `negativeQuantity`
			// applied at every exported door of the quantity engine and at the cost pipeline's
			// input: 2182/2190 statements, 1013/1026 branches, 568/569 functions, 1982/1985
			// lines — 99.63 / 98.73 / 99.82 / 99.84. NOTHING RATCHETS: rounded down these are
			// the floors already in force. The UNCOVERED set is unchanged — every arm added
			// here is driven, including both sides of each new guard and the throw arms of
			// `fromDecimal`, and `costPipeline.ts`'s two `Result` propagation guards remain
			// the same unreachable-by-construction pair the slice 9 paragraph above names.
			// Measured 2026-08-25 again after REVERSING that Money non-negative invariant —
			// `Money` is signed, `subtract` answers a negative difference as a value, and
			// non-negativity moved to the fields that have it (`cost.negative-amount` on the
			// pipeline's unit price/shipping/surcharge, `project.negative-amount` on a
			// Project's budget/contingency): 2187/2195 statements, 1022/1035 branches,
			// 571/572 functions, 1985/1988 lines — 99.63 / 98.74 / 99.82 / 99.84. NOTHING
			// RATCHETS: rounded down these are the floors already in force, and branches at
			// 98.74 still do not reach 99. The UNCOVERED set is unchanged in both COUNT and
			// membership (8 statements, 13 branches, 1 function, 3 lines — the same arms the
			// paragraphs above enumerate); only the denominators moved, and they moved in
			// both directions at once: `fromDecimal`'s throw and `subtract`'s negative-result
			// arm went away, five new guard arms arrived, and every one of the five is driven
			// from both sides.
			//
			// Measured 2026-08-25 at the end of design slice 7 — calibration: `deriveCalibration`,
			// the `PlanGeometrySidecar` port and its Obsidian adapter, the shared calibration
			// mappers, `ReversibleCalibratePlanCommand` (rescale-everything transaction with its
			// version-checked snapshot inverse) and `CalibrateTool`: 2251/2259 statements,
			// 1038/1051 branches, 594/595 functions, 2055/2058 lines —
			// 99.64 / 98.76 / 99.83 / 99.85. NOTHING RATCHETS: rounded down these are
			// 99 / 98 / 99 / 99, the floors already in force.
			//
			// The uncovered set is the one enumerated above, still in untouched files
			// (`ReversibleSetPlanBackground`'s snapshot re-validation, `costPipeline`'s two
			// Result propagation guards, `ObsidianZoneRepository`'s double-fault logging,
			// `GeometrySidecarView`'s Obsidian-runtime callback, `PlanCanvas`'s null-container
			// guards, the plugin's non-`TFile` vault-event arm). One arm this slice touched grew
			// its own test rather than joining that set: saving an UNCALIBRATED Plan over a
			// sidecar that holds a calibration must lower `null`, driven by
			// `completion.test.ts`.
			//
			// Measured 2026-08-25 again after slice 7's review pass — the conditional FIRST
			// write (a concurrent writer between read and write now refuses instead of being
			// clobbered), the output-finiteness floor on rescaled coordinates, the spent
			// inverse refusing a second undo, the tool's generation guard against a prompt
			// answered after deactivate, and the real-stack refusal tests against the actual
			// sidecar store: 2268/2277 statements, 1052/1066 branches, 596/597 functions,
			// 2071/2075 lines — 99.60 / 98.68 / 99.83 / 99.80. NOTHING RATCHETS again for the
			// same reason.
			//
			// THOSE FIGURES ARE THE SLICE-7 BRANCH'S, and are kept only as that branch's
			// record: the merge with the signed-Money work re-denominated everything, and
			// nobody re-measured the merged tree — where the same claim "every branch of the
			// calibration files is covered" was FALSE. `CalibrateTool`'s non-primary-button
			// guard had no test at all; a config comment is not an instrument, and this one
			// was asserting what only a measurement can say.
			//
			// Measured 2026-08-25 on the MERGED tree, after the slice-7 review pass closed
			// that gap (a secondary/auxiliary click places nothing) and added the
			// one-gesture-at-a-time guard the prompt seam needs: 2309/2317 statements,
			// 1090/1103 branches, 602/603 functions, 2105/2108 lines —
			// 99.65 / 98.82 / 99.83 / 99.85. NOTHING RATCHETS: rounded down these are the
			// 99 / 98 / 99 / 99 already in force. The uncovered set is back to the enumerated
			// one in both COUNT and membership — 8 statements, 13 branches, 1 function, 3
			// lines, every one of them in a file this slice did not touch.
			//
			// Measured 2026-08-25 again after the review pass DELETED slice 3's plain
			// `CalibratePlanCommand`, `Plan.calibrate`, `createCalibration` and the plan
			// repository's `syncCalibration` — calibration now has ONE writer, the geometry
			// sidecar port: 2273/2281 statements, 1064/1077 branches, 596/597 functions,
			// 2072/2075 lines — 99.64 / 98.79 / 99.83 / 99.85. NOTHING RATCHETS. The uncovered
			// set is unchanged in count and membership; the denominators fell for the first
			// time in this file's history, because the change removed code rather than adding
			// it. Seven tests went with the capability they drove, and three arrived for what
			// replaced it: the sidecar-to-entity read merge, the note save that touches no
			// sidecar at all, and a hand-edited calibration refused at `withCalibration`.
			//
			// Measured 2026-08-25 at the end of design slice 8 - zone editing and the review
			// pass that followed it: the two reversible zone adapters and their shared
			// restore, the refresh decorator, the two tools, the per-leaf runtime and its
			// toolbar/canvas/inspector wiring, and the e2e suite driving the real mounted
			// editor against in-memory repositories: 99.2 / 98.1 / 99.1 / 99.5 across
			// statements / branches / functions / lines. NOTHING RATCHETS: rounded down
			// these are the 99 / 98 / 99 / 99 already in force.
			//
			// What slice 8 added to the uncovered set, so the next increment does not go
			// hunting - every one either unreachable by construction or an arm whose whole
			// purpose is to not happen. Named by SYMBOL, never by file:line, for the reason
			// CLAUDE.md gives ("address code by name, not by position"): the numbers in an
			// earlier version of this block were accurate the day they were written and
			// silently retargeted by the next insertion above them, and every other block in
			// this file already named its arms.
			// - `ReversibleCreateZoneCommand`'s and `ReversibleDeleteZoneCommand`'s one-line
			//   error PROPAGATIONS off failed restores, failed undo dispatches and failed
			//   pre-delete reads. The failure arms that carry behaviour (a failed first
			//   create, a failed undo restore leaving the vault as the delete left it) each
			//   have their own test; these are `return err` forwards whose only content is
			//   the error they carry.
			// - `runtime.ts`'s `registerEditorTools` rejection arrows - each seam is
			//   unit-tested on the tool with its own dep, and the runtime arrow is wiring.
			// - `runtime.ts`'s inspector-cycle break, the pre-binding `?? Promise.resolve()`:
			//   the store cannot be read before the runtime finishes building it.
			// - `runtime.ts`'s `viewportAdapter.setPan`/`setZoom` - declared by
			//   `EditorContext` and first consumed by a `PanTool` or a calibration-aware
			//   tool, neither of which exists yet. The adapter's comment says so where the
			//   code is.
			// - `runtime.ts`'s `reportFault` catch - an unexpected technical fault escaping a
			//   dispatch, which the decorator below it already re-reads state for.
			// - `PlanCanvas.vue`'s and `SelectTool`'s null guards on a mounted component and
			//   a completed gesture, which by construction never fire.
			// - `createSerialQueue`'s tail catch, which exists so one command's technical
			//   fault cannot wedge the shared chain - reached only by a throw the queue is
			//   built to survive.
			//
			// Measured 2026-08-26 after the slice 8 review pass CLAUDE.md's harness section
			// narrates (the WriteLedger, the single per-leaf dispatch funnel, the
			// click-versus-drag epsilon and the handleMetrics split, the tool generation
			// guards, the concurrent-hydrate tickets, the plan-change fan-out) and the
			// harness prototyping capability built on top of it (Tasks 1-8) - the latter
			// contributing nothing to this figure itself, since `IndexPage.vue` and
			// `entries.ts` live under `tests/harness/`, outside `include`, and everything the
			// capability added under `src/` is `src/prototypes/`, excluded by the `src/prototypes/**`
			// pattern above rather than by naming a file: 2711/2729 statements, 1247/1269 branches, 711/717 functions,
			// 2461/2470 lines - 99.34 / 98.26 / 99.16 / 99.63. NOTHING RATCHETS: rounded
			// down these are 99 / 98 / 99 / 99, the floors already in force, with 9.3 / 3.3 /
			// 1.15 / 15.6 covered units of headroom respectively (rule 1's `1 / total * 100`
			// per metric) - functions the tightest of the four, same as every measurement
			// since slice 4 introduced the first unreachable arms.
			//
			// Re-measured 2026-08-26 after the whole-branch fix wave (the index test app's
			// missing component registry, the harness Inspector read, the prototypes Vue-rule
			// decision, and the smaller repairs) - IDENTICAL on all four counts, denominators
			// included. That is the expected result rather than a lucky one: everything the
			// wave touched under `src/` is either a comment (`EditorStore.reset` and
			// `WorkspaceStore.reset`'s docblocks) or inside `src/prototypes/`
			// (`ZonePanel.vue`), which this config excludes. NOTHING RATCHETS.
			// Measured 2026-08-26 at the end of design slice 10 - Asset and Requirement, the
			// reference-integrity engine and its compensated sequences, the recalculation
			// cascade, the Requirements panel and the delete-with-references flow:
			// 4102/4132 statements, 2036/2077 branches, 1037/1047 functions, 3669/3687 lines
			// - 99.27 / 98.02 / 99.04 / 99.51. NOTHING RATCHETS, for the third time and the
			// same reason: rounded down these ARE the floors in force.
			//
			// Branches is the metric to watch now, and this is the entry that says so. It
			// finished at 98.02 against a floor of 98 - about 0.4 of a branch of headroom,
			// where the slice-6 measurement had eight. That is not a regression in testing:
			// the denominator grew by a factor of two (919 -> 2077) while the same handful of
			// structurally unreachable arms stayed uncovered, so their cost per arm fell but
			// the ROUNDED figure landed just over the line instead of comfortably above it.
			// The practical consequence for the next increment: one new uncovered branch
			// fails this gate. Plan the test with the code.
			//
			// What slice 10 adds to the uncovered set, all of it the same shape as the list
			// above - a `Result` forward whose only content is the error it carries, or an
			// arm a caller cannot reach:
			// - `deleteResolution.ts`'s `case undefined` in `applyResolutionToRequirement`
			//   and its `resolvedReferents ?? []`: both are refused earlier, by
			//   `checkConsentedSet` and `resolutionInputError` respectively, and kept because
			//   the compiler cannot see that.
			// - the repoint's `!repointed.ok` guard, over a domain method whose only refusal
			//   is a shape the entity already had.
			// - `compensate`'s `!snapshot` continue, for a progress entry naming something
			//   `affectedBefore` does not carry. The mirror of it in `undoDeleteResolution`
			//   IS covered, driven directly rather than through a command that cannot
			//   produce the mismatch; this one is reachable only by hand-building a marker,
			//   which `recovery.test.ts` does for the recovery path and not for this one.
			//
			// `undoDeleteResolution.ts` itself is at 100% of all four, which is what a module
			// whose whole job is a failure path should be.
			//
			// **NEITHER OF THE TWO BLOCKS ABOVE MEASURES THIS TREE**, and this entry is the
			// one that does. They are the trunk's and the slice-10 branch's respectively; the
			// merge of 2026-08-26 joined a 2711-statement tree to a 4102-statement one, so both
			// percentages above are records of trees that no longer exist. That has happened
			// twice before here (the slice-7 paragraph is the first), and both times the claim
			// left standing was FALSE rather than merely stale — which is why the merge was
			// measured rather than reasoned about.
			//
			// Measured 2026-08-26 on the MERGED tree: 4111/4141 statements, 2036/2077 branches,
			// 1039/1049 functions, 3678/3696 lines — 99.27 / 98.02 / 99.04 / 99.51. NOTHING
			// RATCHETS: rounded down these are the 99 / 98 / 99 / 99 already in force.
			//
			// **The branch COUNT did not move across the merge — 2036/2077, identical to the
			// slice-10 figure — and that is the expected result rather than a suspicious one.**
			// Everything the harness-prototyping work added lives under `tests/harness/` or
			// `src/prototypes/`, and `include` reaches neither. So the merge added 9 statements,
			// 2 functions and 9 lines (the fixture and harness repairs that touched `src/`) and
			// no branches at all.
			//
			// Branches therefore remain the metric to watch, at 98.02 against a floor of 98 —
			// about 0.4 of a branch of headroom, unchanged by the merge. One new uncovered
			// branch fails this gate. Plan the test with the code.
			//
			// **NOR DOES THE BLOCK ABOVE MEASURE THIS TREE.** It is main's, from the merge of
			// design slices 10 and 15; this entry is the SLICE-11 branch after main was merged
			// INTO it, which is a third tree again — slice 11's fail-closed schema gate, its
			// guarded boundary and its diagnostics ledger over main's Asset/Requirement stack.
			// The paragraph above already says what happens when a percentage is left standing
			// for a tree that no longer exists, twice; this is the third time and it was
			// measured rather than reasoned about.
			//
			// Measured 2026-08-26 on the MERGED slice-11 tree, with the Error Boundary extended
			// over every slice-10 command and query (the eight commands, the four requirement
			// queries) and slice 10's repository error unions widened to `RepositoryError` so a
			// `MigrationError` from the gate can travel: 4212/4240 statements, 2080/2121
			// branches, 1063/1071 functions, 3775/3791 lines — 99.33 / 98.06 / 99.25 / 99.57.
			// NOTHING RATCHETS: rounded down these are the 99 / 98 / 99 / 99 already in force.
			//
			// Branches is still the metric to watch and the headroom BARELY moved: 98.06 against
			// 98 is about 1.3 branches at 0.047pp each. Two things bought that back rather than
			// one, and the second is the more useful lesson: a test was added for
			// `mappedMigrationFailure`'s tagged NON-Error throw, and `noteIo`'s local
			// `migrationError` lost its OPTIONAL `cause` — every caller passes one, so the
			// `cause === undefined` arm was unreachable, and deleting an unreachable arm raises
			// the figure on a smaller denominator, which is what the note near the top of this
			// block tells the next reader to look for first.
			//
			// The uncovered set is otherwise the enumerated one from main plus slice 11's own:
			// `mappedMigrationFailure`'s untagged fallback arms in `noteIo`, and nothing new.
			// Everything design slice 11's merge ADDED under `src/` — `guardedServices.ts`,
			// the restructured composition root, `notifyError` — measures 100% of all four.
			//
			// Re-measured 2026-08-26 after round 1 of that merge's review closed the last three
			// unguarded commands — `calibratePlan` (a FACTORY, so `composeGuarded` never saw
			// it), `assignAsset`, and BOTH doors of the two override commands — and routed the
			// two remaining thrown-fault notices through `notifyFault`: 4226/4255 statements,
			// 2077/2117 branches, 1071/1080 functions, 3789/3806 lines —
			// 99.31 / 98.11 / 99.16 / 99.55. NOTHING RATCHETS: rounded down these are the
			// 99 / 98 / 99 / 99 already in force.
			//
			// Branches gained headroom for the first time since slice 10 — 98.02 → 98.11, about
			// 2.3 branches at 0.047pp each — and the reason is worth recording because it is
			// counter-intuitive: guarding MORE removed uncovered arms rather than adding them.
			// `notifyFault` replaced two `cause instanceof Error ? … : String(cause)` ternaries
			// (four arms, two of them untaken) with one call, and the mapper it delegates to
			// already had both of its own arms driven.
			//
			// Re-measured 2026-08-26 after the diagnostics claims were made checkable — the
			// derived `latestVersions`, `DiagnosticsLedger.record` narrowed to a kind, a
			// branded id and an `AppError`, and the network ban: 4235/4263 statements,
			// 2081/2121 branches, 1072/1080 functions, 3796/3812 lines —
			// 99.34 / 98.11 / 99.25 / 99.58. NOTHING RATCHETS: rounded down these are the
			// 99 / 98 / 99 / 99 already in force.
			//
			// Branches held at 98.11 across a denominator that GREW by four, and the way that
			// was paid for is the note worth keeping. The first pass measured 98.01 — the
			// derivation replaced a constant lookup with `this.byKind.get(kind) ?? []` twice,
			// and both fallbacks are reachable only for a kind nobody registered, which is a
			// state no existing test produced. The repair was not a coverage exercise: the
			// accessor's own docblock CLAIMED that an unregistered kind answers 1 and passes
			// through, which was an invariant asserted in a comment with nothing under it. The
			// test that says so covers both arms, and `MigrationRunner.ts` is at 100% of all
			// four. An uncovered arm is usually an unchecked sentence somewhere; look for the
			// sentence first.
			//
			// Measured 2026-08-27 at the end of design slice 14, **on the slice-14 branch BEFORE
			// the merge above landed** — so like the two entries this block already scolds, the
			// percentages below describe a tree that no longer exists. Kept rather than deleted
			// because WHICH FILES the slice added and which arm stayed uncovered are still true
			// of the merged tree; only the four figures are not. The merged measurement follows
			// this entry. That this file's own warning caught its author in the act, a fourth
			// time, is the argument for the warning.
			// Measured 2026-08-27 at the end of design slice 14 — the two central views' empty
			// states: `EmptyState.vue`, the typed content registry, the two pure selectors,
			// `RenovationProjectView`'s first data dependency (`ListProjects` and its
			// store), and `ProjectStore.emptyStateKey` as a getter over state it already
			// hydrates: 4197/4227 statements, 2075/2116 branches, 1066/1076 functions,
			// 3755/3773 lines — 99.29 / 98.06 / 99.07 / 99.52. NOTHING RATCHETS: rounded down
			// these are the 99 / 98 / 99 / 99 already in force.
			//
			// Every file this slice added is at 100% branches (`emptyStates/content.ts`,
			// `resolve.ts`, `selectors.ts`, `RenovationProjectStore.ts`,
			// `RenovationProjectContext.ts`, `RenovationProjectView.ts`,
			// `renovationProjectQueries.ts`); the slice contributed no new uncovered arm.
			// `ProjectStore.ts`'s single uncovered branch (19/20) is the pre-existing
			// concurrent-hydrate ticket check at its second `superseded()` guard — reachable
			// only by a hydration superseded strictly between `getPlan` and
			// `findZonesByPlan` resolving, unchanged by this slice.
			//
			// Branches remain the metric to watch and are tighter than before: at n=2116 a
			// branch is 0.047pp, so 98.06 against the 98 floor is only about 1.3 branches of
			// headroom — the smallest margin this file has recorded. One new uncovered branch
			// still fails this gate.
			//
			// Re-measured 2026-08-27 on the MERGED tree — slice 14 merged into a main that already
			// carried slice 11 — which is the tree that actually ships and the fourth distinct one
			// this block describes: 4324/4352 statements, 2120/2160 branches, 1100/1107 functions,
			// 3876/3892 lines — 99.35 / 98.14 / 99.36 / 99.58. NOTHING RATCHETS: rounded down these
			// are the 99 / 98 / 99 / 99 already in force.
			//
			// Branches gained headroom against both parents (98.06 on slice 14 alone, 98.11 on
			// slice 11 alone, 98.14 merged) — about 3 branches at 0.046pp each. The merge itself
			// bought that: `ListProjects` arrived composed RAW, which broke the build (the port
			// now answers `RepositoryError`, a union admitting `ValidationError`, and the query
			// still declared `PersistenceError`) and broke slice 11's category check, which
			// detonated the repositories and watched `persistence.listProjects.execute` REJECT
			// instead of answering the boundary's mapped refusal. Routing it through `guardQuery`
			// like every sibling query is what fixed both, and a guarded query has fewer
			// uncovered arms than a raw one — the same counter-intuitive direction slice 11's own
			// entry above records.
			//
			// **The lesson is about the instrument, not the number.** Both parent branches were
			// green alone; neither figure above predicted the merged one, and two REAL defects
			// lived only in the combination. Worse, the first three verification runs of that
			// merge reported "exit 0" because they were piped (`npm run check 2>&1 | tail`), and a
			// pipeline's status is the LAST stage's — `tail` always succeeds. Capture the gate as
			// `npm run check > log 2>&1; echo $?` and read the code, or the gate is decoration.
			//
			// Measured 2026-08-28 at the end of design slice 18 — a project's folder is derived
			// from its `Project.md` rather than shared with every project (ADR-0013):
			// `entityRefOf` extracted as the one answer to "is this note ours", the Project
			// Index and `VaultChangeAdapter` bounded by declaration rather than by a path
			// prefix, `NoteVaultDeps.projectFolder` deleted with five repositories resolving
			// their folder per write through `projectFolderOf`, project existence moved onto
			// the index, and `freshProjectFolder` giving each newly-created project its own
			// folder under the configurable default root: 4346/4374 statements, 2141/2179
			// branches, 1109/1116 functions, 3901/3917 lines — 99.35 / 98.25 / 99.37 / 99.59.
			// NOTHING RATCHETS: rounded down these are 99 / 98 / 99 / 99, the floors already in
			// force. **Re-measured 2026-08-28, after the four review-fix commits that followed
			// this slice's merge** (`2e7396d`, `d51416b`, `306f3e9`, `14b52dd`): the previous
			// figures here — 4345/4373, 2135/2173, 1107/1114, 3900/3916 — predated those commits
			// by one increment each. The percentages did not move; only the raw counts did.
			//
			// Branches gained headroom — 98.14 on the previous merged tree to 98.25 here, about
			// 5.4 branches at 0.046pp each, the most room this metric has had since slice 11's
			// guard-more-not-less finding. Every new export this slice added measures 100% of
			// all four metrics: `entityRefOf` (`buildProjectIndexEntries.ts`) and
			// `freshProjectFolder`/`projectFolderOf` (`paths.ts`), plus the five repositories'
			// new `folder === undefined` refusal arms and `ObsidianProjectRepository`'s
			// existence-through-the-index rewrite — none of them appears in the uncovered set
			// below.
			//
			// THE UNCOVERED SET IS UNCHANGED from the tree this slice branched from. Verified by
			// reading `coverage/lcov.info` rather than assumed: every file this slice edited
			// (`NoteVaultDeps.ts`, `paths.ts`, `buildProjectIndexEntries.ts`,
			// `VaultChangeAdapter.ts`, `ObsidianProjectRepository.ts`, `ObsidianPlanRepository.ts`,
			// `ObsidianZoneRepository.ts`, `ObsidianRequirementRepository.ts`,
			// `ObsidianAssetRepository.ts`, `composition-root.ts`, `RenovationPlannerPlugin.ts`,
			// `settings/settings.ts`) carries no new uncovered branch, line or function. FOUR of
			// those twelve files still carry an uncovered arm, and all seven arms across them
			// predate this slice — confirmed by diffing each one against `3384084`, not
			// assumed from the shape alone. (This paragraph itself said "five" through the
			// four review-fix commits above, one short of what its own four bullets below add
			// to — caught re-measuring for this same paragraph's numbers, not by a separate
			// pass.)
			// - `ObsidianZoneRepository`'s two `deleteCreatedNote` arms (the non-`TFile` guard
			//   and the `trashFile` catch, both compensation-path double-fault shapes already
			//   named above) and its update/insert compensation-logging arm — three arms,
			//   identical in the pre-slice file.
			// - `ObsidianRequirementRepository.markStale`'s `!marked.ok` branch, guarding
			//   `Requirement.markedStale()` refusing a transition no caller here can produce —
			//   identical in the pre-slice file.
			// - `RenovationPlannerPlugin.startPersistence`'s `if (persistence.markers)` false
			//   arm and its rename handler's `file instanceof TFile` false arm — both on lines
			//   this slice's diff never touches (only a docblock two paragraphs above the first,
			//   and an object literal shedding the deleted `projectFolder` field, changed in this
			//   file at all).
			// - `composition-root.ts`'s `cascadeNotices.cascadeAborted` — an anonymous function
			//   never invoked in the suite, byte-identical to the pre-slice file; this slice's
			//   edits to the file are all inside `composeRepositories` and its two call sites,
			//   `newProjectRoot` becoming a real argument in place of a `deps.projectFolder`
			//   read, dozens of lines away.
			// None of the seven is the new `folder === undefined` refusal this slice added beside
			// each of the five repositories' save paths, which IS driven (the
			// unresolvable-project-folder test removes the index entry between the read and the
			// save, once per entity kind).
			//
			// Re-verified 2026-08-28 against `coverage/lcov.info` freshly generated at HEAD
			// (`14b52dd`, after `findNoteIdInFolder` was deleted and the `notesFolder ===
			// undefined` arm was added): the same four files above name the only uncovered
			// arms, matching the four bullets below one for one, and the other eight files in
			// the list report zero uncovered lines, functions or branches.
			//
			// Measured 2026-08-28 at the end of design slice 13 — the notice queue (dedup, the
			// three-slot cap, promotion, every timer and the hover/focus pause), the four
			// severities and their copy, the `notify` doors and the `Notice`-backed host, the
			// notice stylesheet, the plugin's activate/dispose pair, and the whole save-state
			// half: `SaveStateStore`'s three settlement outcomes, `affectsSaveState`,
			// `withSaveStateTracking` over `run`/`undo`/`redo`, and `SaveStateIndicator` in
			// §60's third status-bar region: 4533/4561 statements, 2189/2228 branches,
			// 1162/1169 functions, 4062/4078 lines — 99.38 / 98.24 / 99.40 / 99.60. NOTHING
			// RATCHETS: rounded down these are the 99 / 98 / 99 / 99 already in force, which is
			// what slices 5, 11 and 15 also measured.
			//
			// Branches held rather than gained: 98.25 on the slice-18 tree, 98.24 here — a
			// hundredth DOWN, and the count of covered branches of headroom is 5.6 at 0.0449pp
			// each, against slice 18's 5.4 and slice 14's 1.3. Both readings are true because
			// the denominator grew by 49; the unit figure is the one to act on. Statements have
			// 17.6 of headroom, lines 24.8, and FUNCTIONS are the tightest at 4.7 — the same
			// metric that has been tightest at every measurement since slice 4.
			//
			// Slice 13 adds exactly ONE arm to the uncovered set, and every other file it
			// introduced measures 100% of all four (`severity.ts`, `notify.ts`,
			// `save-state.ts`, `save-state-store.ts`, `affects-save-state.ts`,
			// `with-save-state-tracking.ts`, `SaveStateIndicator.vue`, and `versioning.ts`'s
			// new `WRITE_BOUNDARY_CODES`):
			// - `createNoticeQueue`'s `release` guard, the false arm of `if (at >= 0)` before
			//   the splice. `release` is reached from `sweep` — which iterates a SNAPSHOT, so
			//   each entry is still present when its own turn comes — and from `arm`'s timeout,
			//   which `release` itself cancels. The entry is in `entries` by construction at
			//   every call; the guard is kept because `indexOf` cannot be told that.
			// Verified against `coverage/coverage-final.json` rather than assumed — every
			// uncovered position in the other three files this slice edited under `src/` was
			// read out and looked at: `runtime.ts`'s `viewportAdapter.setPan`/`setZoom`, its
			// inspector-cycle `?? Promise.resolve()`, its `registerEditorTools` rejection
			// arrows and the two selection/asset guards; `composition-root.ts`'s
			// `cascadeNotices.cascadeAborted` (this slice changed its BODY from `notify` to
			// `notifyWarning` and it is still never invoked in the suite); and the plugin's
			// `persistence.markers` and `file instanceof TFile` false arms. Every one is
			// already enumerated by the slice-8 or slice-18 paragraphs above.
			//
			// Re-measured 2026-08-29, after the code review of the slice 13 branch and the five
			// fixes it produced — `affectsSaveState` widened to `Reference` (nineteen pre-write
			// raise sites the previous grep never looked for), `createNoticeQueue.dispose` made
			// genuinely terminal, the notice host's per-notice concerns moved from `containerEl`
			// to `messageEl`, the native click-to-dismiss latching `handle.live` like our own
			// `×`, and the Toast live region moved off the notice onto two persistent regions
			// `activateNotices` appends to `document.body`: 4556/4584 statements, 2193/2232
			// branches, 1167/1174 functions, 4083/4099 lines — 99.38 / 98.25 / 99.40 / 99.60.
			// NOTHING RATCHETS: rounded down these are the 99 / 98 / 99 / 99 already in force.
			//
			// Branches went 98.24 → 98.25, so headroom is 5.5 covered branches at 0.0448pp each
			// rather than 5.6 — unchanged in any way worth acting on, and worth recording only
			// because the first draft of the live-region fix DID cost one. `announce` read a
			// module-level `regions` and guarded it (`regions?.[…]`, then `if (region)`), and
			// that null arm is unreachable by construction: a host exists only while a queue
			// does, and a queue only after the regions do. `openRegions()` returns the pair and
			// `createObsidianHost` takes it as an argument now, so there is nothing to guard.
			// The general shape, and this repository already has a bullet on its sibling: an
			// unreachable guard is not free here — it costs a branch of a budget with five to
			// spare, and it reads as a case somebody thought could happen.
			//
			// THE UNCOVERED SET IS UNCHANGED by all five fixes. Verified by reading
			// `coverage/coverage-final.json` rather than assumed: across
			// `presentation/notices/`, `presentation/editor/save-state/` and
			// `application/ports/versioning.ts`, exactly one arm is uncovered and it is the
			// slice-13 one already enumerated above — `release`'s `if (at >= 0)` guard.
			//
			// Re-measured 2026-08-29 on the MERGED tree — slice 13 merged into a main carrying
			// the slice 16 design and plan, the Shift-constrained drawing tools, and the `docs/`
			// reorganisation: 4669/4699 statements, 2247/2290 branches, 1193/1199 functions,
			// 4185/4200 lines — 99.36 / 98.12 / 99.49 / 99.64. NOTHING RATCHETS: rounded down
			// these are the 99 / 98 / 99 / 99 already in force.
			//
			// **Branches are the tightest they have been since slice 11: 98.12, about 2.7
			// covered branches of headroom at 0.0437pp each — two, counted as whole branches.**
			// Neither parent predicted it: this branch measured 98.25 alone and the figure fell
			// on merging, exactly as slice 14's merged entry above records happening to it. The
			// denominator grew by 58 branches while the covered count grew by 54, so the drop is
			// main's new arms diluting a ratio, not this branch losing coverage — the unit figure
			// is still the one to act on, and two is small enough that the next untested arm
			// anywhere in `src/` fails the gate rather than merely narrowing it.
			//
			// The merged uncovered set gains exactly one file over this branch's own, and it
			// came from main rather than from the merge: `RequirementRow.vue`'s
			// `row.assetName ?? row.assetId` nullish arm. Verified rather than inferred — the
			// file is byte-identical to `main` (`git diff --quiet main -- <path>`), so no
			// resolution in this merge touched it. Across `presentation/notices/`,
			// `presentation/editor/save-state/` and `application/ports/versioning.ts` the set is
			// still the single slice-13 arm named above.
			//
			// Re-measured 2026-08-29 after the review bot's two findings on PR #26 —
			// `affectsSaveState` widened a third time (`Calculation`, twenty-two pre-write raise
			// sites left out on the strength of one misleading docblock sentence), and the
			// dispatch seam widened so a command REPORTS whether it wrote rather than having the
			// save tracker infer it from `ok`: 4674/4704 statements, 2251/2294 branches,
			// 1196/1202 functions, 4189/4204 lines — 99.36 / 98.12 / 99.50 / 99.64. NOTHING
			// RATCHETS: rounded down these are the 99 / 98 / 99 / 99 already in force.
			//
			// **Every one of the four percentages is unchanged from the merged figure above**,
			// which is the interesting part rather than an absence of news. The seam widening
			// touched fifteen source files and seventeen `ok(...)` return sites, extracted
			// `presentation/editor/inspector-wiring.ts` out of `runtime.ts`, and added a
			// `DispatchOutcome` module — and it moved the branch denominator by FOUR (2290 →
			// 2294), every one of them covered. Replacing `ok(undefined)` with `ok('wrote')` is
			// a different value at the same statement and adds no arm at all; what the four are
			// is the decision the tracker now makes (`result.value === 'no-write'`) and the arms
			// around it. A change can be large in files and nearly invisible here: file count is
			// not a proxy for anything this page measures, and neither is the seventeen-site
			// figure the commit message quotes.
			//
			// One resolution in this merge moved CSS rather than code and is worth naming here
			// because a stylesheet is invisible to every figure on this page: main split the §60
			// status-bar block out of `editor.css` into `styles/editor-status.css` while this
			// branch was extending that same block in place, which is the merge's only conflict.
			// Slice 13's two `.rp-save-state-*` colour rules followed the block into the new
			// partial. Nothing here can see whether they still MATCH — jsdom resolves no `var()`
			// and the harness draws no status bar state on purpose — so that is step 13 of
			// `docs/tests/cases/Notices and save state.md` and a vault.
			//
			// Measured 2026-08-29 at the end of design slice 16 — forms and inline validation
			// feedback: `routeError`, `<FieldError>`/`<FormBanner>`, `useFieldCommit`/
			// `useFormCommit`, `NewProjectForm` and `CreateProjectCommand` as the Renovation
			// Project view's first write, `ProjectList`, the Task 5a persistence fix
			// (`description`/`start`/`targetCompletion` surviving the vault round trip), and
			// Task 9 moving the Inspector's `quantity`/`cost` override rows onto the same
			// composable: 4534/4568 statements, 2259/2300 branches, 1171/1182 functions,
			// 4070/4092 lines — 99.25 / 98.21 / 99.06 / 99.46. NOTHING RATCHETS: rounded down
			// these are 99 / 98 / 99 / 99, the floors already in force, unchanged from the
			// slice-18 measurement it was taken against — this slice's own tests exercise every
			// line and branch it added, and it removed nothing from the denominator either.
			//
			// Re-measured 2026-08-29 on the MERGED tree — slice 13 having landed on main in the
			// meantime, plus the two findings the review bot raised against this branch after
			// that (a coalesced open failure reported once rather than once per click, and a
			// dialog the root swap unmounts being settled rather than stranded): 5264/5301
			// statements, 2613/2662 branches, 1331/1341 functions, 4693/4715 lines —
			// 99.30 / 98.15 / 99.25 / 99.53. NOTHING RATCHETS: rounded down these are the
			// 99 / 98 / 99 / 99 already in force, which is what slices 5, 11, 13, 15 and 18 also
			// measured.
			//
			// Re-measured a third time 2026-08-29, for the FOURTEENTH review round's two
			// findings — the orphan folder a failed project insert left behind, now
			// compensated, and the busy-dialog unmount, recorded rather than closed:
			// 5280/5317 statements, 2619/2668 branches, 1332/1342 functions, 4707/4729 lines —
			// 99.30 / 98.16 / 99.25 / 99.53. NOTHING RATCHETS, again. The compensation adds 16
			// statements, 6 branches, one function and 14 lines, and every one of them is
			// covered — read out of `coverage/coverage-final.json` rather than assumed, where
			// `noteIo.ts`, `ObsidianProjectRepository.ts` and `DialogHost.vue` each measure
			// 100% of all four. So the headroom named below is unchanged in UNITS, which is the
			// figure that matters, while branches move one hundredth: 98.15 to 98.16.
			//
			// Re-measured a fourth time 2026-08-29, for the FIFTEENTH round's single finding — the
			// vault-change pipeline announcing the index entries it changes, so a project note added
			// by hand, copied in or arriving through sync reaches a mounted pane: 5292/5329
			// statements, 2623/2672 branches, 1339/1349 functions, 4718/4740 lines —
			// 99.30 / 98.16 / 99.25 / 99.53. NOTHING RATCHETS. Twelve statements, four branches,
			// seven functions and eleven lines added, every one covered, and the headroom is
			// unchanged in units at 16 / 4 / 3 / 25.
			//
			// The four branches are worth naming, because ONE of them was uncovered for a run and
			// the gate did not catch it — branches read 98.12 against a floor of 98, which is three
			// covered units, so a passing gate is not evidence that a new arm was tested. The arm
			// was `changedEntityTypeOf`'s `null`: an entry event arriving with no payload, which is
			// the guard's whole reason for being a guard rather than a cast. Found by reading
			// `coverage-final.json` for the three changed files rather than by the threshold, and
			// pinned by a case that was then watched failing against a guard rewritten to default
			// the missing payload to a project. **Read the floor as a floor and not as a review**:
			// at this headroom an untested arm costs 0.037pp and hides completely.
			//
			// **FUNCTIONS are the tightest at THREE, and branches are four.** Statements have 16
			// of headroom and lines 25, both counted as whole covered units rather than as
			// percentage points, because a unit is what an untested arm actually costs. Neither
			// parent predicted the branch figure: this branch measured 98.21 alone and main
			// measured 98.12, and the merge lands between them at 98.15 — the denominator grew
			// by 362 branches while the covered count grew by 354, which is two trees' arms
			// diluting one ratio rather than either side losing coverage. Three functions is
			// small enough that the next untested callback anywhere in `src/` fails the gate
			// rather than merely narrowing it.
			//
			// Neither of the two review fixes adds an uncovered arm, verified by reading
			// `coverage/coverage-final.json` rather than assumed: `openNote.ts`,
			// `DialogHost.vue` and `commitField.ts` measure 100% of all four. Across every file
			// this branch and the merge touched, exactly two carry uncovered positions and both
			// are already enumerated above — `composition-root.ts`'s
			// `cascadeNotices.cascadeAborted` (slice 13's paragraph) and `RequirementRow.vue`'s
			// `row.assetName ?? row.assetId` nullish arm (the merged slice-13 entry). What those
			// paragraphs do NOT name, and this one does rather than leaving it to the next
			// reader to rediscover: `RequirementRow.vue` also has three uncovered FUNCTIONS —
			// the two `undo` stubs on the quantity and cost commands, which `history.run`
			// (`command.execute()`) never reaches, and the cost field's `@keydown.esc` handler,
			// whose quantity-field twin IS driven. They are this branch's own, not the merge's,
			// and they are three of the ten uncovered functions the whole tree has.
			// Measured 2026-08-31 at the end of design slice 19 — the Asset catalogue leaving
			// the project: `Asset` losing `projectId` across the entity, the events, the Zod
			// schema, the mapper, `saveNoteBackedEntity`'s constraint and the index axis;
			// `listByProject` → `listAll`; `foldersOverlap`; the
			// `libraryFolder` setting, its informational row, its action row and
			// `migrateLibraryFolder` (validate → move → rebuild → persist LAST) with the
			// serialized settings-write chain under it; `ListRequirementsReferencing`
			// answering per-project groups; `t(language, key, params?)`; the `LibraryOverlaps`
			// port, `IndexLibraryOverlaps` and the §83 marker on a project row:
			// 5610/5654 statements, 2780/2835 branches, 1432/1445 functions, 4991/5018 lines —
			// 99.22 / 98.05 / 99.10 / 99.46.
			//
			// NOTHING RATCHETS, which was predicted rather than discovered: rounded down these
			// are 99 / 98 / 99 / 99, exactly the floors already in force, as slices 5, 11, 13,
			// 15, 16 and 18 also measured. Branches hovered at 98.05–98.06 through the whole
			// slice and end where they started.
			//
			// **The headroom is ONE covered unit on branches and ONE on functions, which is
			// the tightest either metric has ever been here** — read in UNITS, not in
			// percentage points, because a unit is what an untested arm actually costs. The
			// arithmetic, so the next increment does not have to redo it: the branch floor
			// needs `ceil(0.98 × 2835) = 2779` covered and 2780 are, so exactly one may be
			// lost; the function floor needs `ceil(0.99 × 1445) = 1431` and 1432 are. One
			// branch is 0.035pp and one function 0.069pp — both far below the hundredth a
			// summary line prints, so **a passing gate is not evidence a new arm was tested**
			// and neither is a figure that did not visibly move. Statements have 12 units of
			// headroom and lines 23. At this margin, plan the test with the code: an untested
			// arm in either tight metric fails the gate outright, and an untested arm in a
			// slack one hides completely.
			//
			// Every file this slice created or rewrote measures 100% of all four, read out of
			// `coverage/coverage-final.json` rather than assumed: `foldersOverlap.ts`,
			// `libraryMigration.ts`, `SettingsTab.ts`, `IndexLibraryOverlaps.ts`,
			// `ListProjects.ts`, `ListRequirementsReferencing.ts`, `ListReassignmentTargets.ts`,
			// `ObsidianAssetRepository.ts`, `noteEntityWrite.ts`, `assetFrontmatter.ts`,
			// `Asset.ts`, `settings.ts`, `strings.ts`, `deleteZoneFlow.ts` and
			// `ProjectList.vue`. Three files this slice TOUCHED carry uncovered positions and
			// all three are inherited rather than new — named here so the next reader does not
			// go hunting: `assetMapper.ts`'s `if (!unitCost.ok) return unitCost;` (slice 10's,
			// a `createMoney` refusal the schema has already vouched against),
			// `RenovationPlannerPlugin.ts`'s three Obsidian-runtime arms (`openProject`'s
			// `reportFault` closure and two inside `startPersistence`), and one
			// location-less phantom branch in `notify.ts` that no test can execute.
			//
			// Slice 19 also DELETED three refusals, which removes arms from the numerator and
			// the denominator together — the slice document predicted that would leave the
			// ratio level, and it did, to within a hundredth of a point.
			//
			// One thing this entry cannot say, and the omission is the point: there is no
			// slice-12 and no slice-17 entry above it. Both landed on `main` without adding
			// one, so the previous measurement here is slice 16's merged tree and the jump in
			// every denominator between that entry and this one is two slices wide, not one.
			//
			// AMENDED by slice 19's final fix wave, and the amendment is to the COUNTS rather
			// than to any percentage: re-subscribing the assign picker's catalogue read to
			// `onPlanChanged` (`runtime.ts`) added two statements, one function and two lines,
			// every one of them covered, and NO branch at all. Re-measured
			// 5612/5656 statements, 2780/2835 branches, 1433/1446 functions, 4993/5020 lines —
			// 99.22 / 98.05 / 99.10 / 99.46, to the hundredth the same four figures as above,
			// which is exactly why the counts are written out and not only the percentages.
			// The headroom is unchanged in UNITS and both denominators had to be re-checked to
			// say so: the branch floor still needs `ceil(0.98 × 2835) = 2779` against 2780
			// covered, and the function floor now needs `ceil(0.99 × 1446) = 1432` against
			// 1433 — one unit each, still the tightest either metric has been.
			//
			// Measured 2026-09-01 at the end of the CURRENCY increment — design slice 20's
			// first half, the currency the pipeline is told: `core/money`'s branded `Currency`
			// with `parseCurrency` (the untrusted-input door, a `Result`) beside `currencyOf`
			// (the program-literal door, which throws); `Project.currency` and the
			// budget/contingency coherence guard beside it; the `defaultCurrency` setting and
			// its `CURRENCIES` vocabulary; `projectFrontmatter`'s optional `currency` key and
			// `projectFromPersistence`'s default for an absent one; `CostPipelineInput.
			// expectedCurrency` REQUIRED with `cost.currency-mismatch` refused before any
			// arithmetic; the project read `AssignAsset` and `RecalculateRequirement` each
			// gained; `inputsStillMatch`'s project-currency comparison in
			// `GetRequirementsForZone`; and the currency on the project detail row:
			// 5950/5994 statements, 2954/3008 branches, 1534/1548 functions, 5285/5313 lines
			// — 99.26 / 98.20 / 99.09 / 99.47.
			//
			// **The branch figure was 2956/3010 until this increment's own final review**, and
			// the two branches it lost are the point rather than noise: `inputsStillMatch` had
			// hand-spelled the three comparisons `assetMatchesCalculatedFrom` already makes, and
			// the review's structural fix made it CALL that function instead. Two duplicated
			// arms stopped existing, two stopped being covered, and the percentage did not move
			// — which is what deleting a duplicate looks like from here, and is the reason this
			// line records COUNTS beside the percentages rather than percentages alone.
			//
			// NOTHING RATCHETS: rounded down these are 99 / 98 / 99 / 99, exactly the floors
			// already in force, which is what slices 5, 11, 13, 15, 16, 18 and 19 also
			// measured.
			//
			// **THE BLOCK ABOVE DOES NOT MEASURE THE TREE THIS ONE STARTED FROM**, and the
			// paragraph is here because this file has recorded the cost of leaving that
			// unsaid three times already. The previous entry is slice 19's; design slice 21
			// landed on `main` without adding one at all, so the jump in every denominator
			// between that entry and this is TWO increments wide. Branches grew from
			// 2780/2835 to 2956/3010 — 175 arms of denominator and 176 of covered count, so
			// somewhere in those two increments one previously uncovered arm also became
			// covered. What this increment's OWN contribution is cannot be read off this
			// artifact, and no figure here should be attributed to it alone.
			//
			// The headroom, in UNITS with the arithmetic written out so the next increment
			// does not redo it: statements need `ceil(0.99 × 5994) = 5935` covered and 5950
			// are (**15**); branches need `ceil(0.98 × 3010) = 2950` against 2956 (**6**);
			// functions need `ceil(0.99 × 1548) = 1533` against 1534 (**1**); lines need
			// `ceil(0.99 × 5313) = 5260` against 5285 (**25**). **FUNCTIONS is the tightest
			// and is still ONE**, unchanged from slice 19 — the next untested callback
			// anywhere in `src/` fails this gate outright. Branches widened from one unit to
			// six, which is room a later increment can lose without anything visible
			// happening: one branch is 0.033pp, below the hundredth this summary prints.
			// Read it as slack to be careful in, not as a licence.
			//
			// **Every file this increment changed that carries an uncovered position carries
			// only INHERITED ones**, measured by reading `coverage-final.json` per changed
			// file rather than by the summary, which cannot see one arm. Five files report
			// something and `git log -L` traces every one to an earlier slice:
			// `costPipeline.ts`'s `!afterDiscount.ok` and `!taxed.ok` — slice 9's pair,
			// already named in that paragraph above; `AssignAsset.ts`'s `isErr(requirement)`,
			// `RecalculateRequirement.ts`'s `isErr(updated)` and both of
			// `SetRequirementQuantityOverride.ts`'s domain-method forwards — all four slice
			// 10's, at `d7d8ee0`, and NONE of them named in the slice-10 paragraph above, so
			// they are named here rather than left for the next reader to rediscover;
			// `slice10Composition.ts`'s `cascadeNotices.cascadeAborted`, which the slice-13
			// paragraph names at its old address in `composition-root.ts`; and
			// `planEditorCommands.ts`'s refusal-bundle event-bus callback. Every OTHER file this
			// increment wrote into measures 100% of all four: `Money.ts`,
			// `Project.ts`, `projectFrontmatter.ts`, `projectMapper.ts`, `settings.ts`,
			// `SettingsTab.ts`, `GetRequirementsForZone.ts`, `deriveRequirementFigures.ts`,
			// `CreateProject.ts`, `composition-root.ts`, `ObsidianProjectRepository.ts`,
			// `PlanDto.ts`, `ProjectDetail.vue` and both locale files.
			//
			// **One thing about the INSTRUMENT, because the plan's own per-file command was
			// written to print nothing and printed four lines.** Its filter is a substring
			// regex, so `Project\.ts` also matches `sampleProject.ts` — a file this increment
			// never touched, whose uncovered `reportFault` closure was reported as though it
			// were a finding. The same filter MISSED two changed files that do carry
			// inherited arms (`SetRequirementQuantityOverride.ts` and `slice10Composition.ts`),
			// because their names contain none of the words it looks for. A hand-written
			// filename filter over-matches and under-matches at the same time; the question
			// the check is actually asking is "which files did this branch change", and
			// `git diff --name-only` is the instrument that answers it.
			//
			// **The asset designer's review fixes (2026-09-02), measured after all eleven tasks:**
			// 99.39 / 98.33 / 99.07 / 99.53. NOTHING RATCHETS unless a figure
			// rounds down above its floor; functions headroom is 1 unit and branches 12.
			// Every file this increment changed
			// that carries an uncovered position carries only INHERITED ones, measured per changed
			// file from `coverage-final.json` with `git diff --name-only origin/main...HEAD -- src/`
			// as the file list, not a hand-written filter.
			//
			// **PR 43's four review findings (2026-09-02), measured after all four:**
			// 99.39 / 98.30 / 99.07 / 99.54. NOTHING RATCHETS — every figure rounds down to the
			// floor already in force. Functions headroom is 1 unit and branches 11, one fewer
			// than the wave before it, which is this wave's ONE new uncovered position:
			// `noteEntityWrite.ts`'s `if (indexed)` on the delete-compensation path. That arm is
			// uncovered rather than untested and the code says so — it NARROWS
			// `ProjectIndexEntry | undefined` and cannot discriminate, because `openNoteById`
			// resolved through the same index one synchronous statement earlier; deleting it is
			// a build error (measured: TS2345), not a behaviour change.
			//
			// Every other uncovered position in the six files this wave touched is INHERITED,
			// attributed one at a time with `git log -L <line>,<line>:<file>` rather than by
			// reading a filename filter: three in `ReversibleAssetDesignCommands.ts` (two from
			// the background task, one from the undo pre-flight) and two in
			// `DesignerInspector.vue` (from the inspector task). The file list came from
			// `git diff --name-only origin/main...HEAD -- src/`, per the entry above.
			//
			// **PR 43's two remaining review findings (2026-09-02):** 99.39 / 98.31 / 99.07 / 99.54.
			// NOTHING RATCHETS. Functions headroom is 1 unit and branches 11 — branches recovered
			// the unit the wave before it spent, six covered arms arriving with six total. These
			// two fixes added NO uncovered position: the only two in the nine files they touched
			// are inherited (`AssetGeometryStore.ts`'s malformed-sidecar `catch` from the derived-
			// filename task, `DesignerCanvas.vue`'s empty-bounds arm from the layers task), each
			// attributed with `git log -L <line>,<line>:<file>`.
			//
			// **The follow-up the key itself produced (2026-09-02):** 99.39 / 98.31 / 99.07 / 99.54.
			// NOTHING RATCHETS; branches headroom 12, functions 1. Watching `{kind, page, path}`
			// fixed a redundant decode and removed the accidental repair identity-watching had
			// given a CHANGED file, so the key carries the file's `mtime:size` too — reported by
			// a review bot on the push that shipped the key, which is the shortest round trip
			// between a fix and its own consequence this branch has had.
			//
			// **The mapping's own three follow-ups (2026-09-02):** 99.39 / 98.31 / 99.07 / 99.54.
			// NOTHING RATCHETS; branches headroom 12, functions 1. Making an asset's sidecar path
			// index-backed created three ways to lose the mapping — both note-upsert doors and the
			// delete's own lookup — each reported by a review bot on the push that shipped it. No
			// new uncovered position; every one in the files touched is inherited.
			// **PR 43's four review findings, second wave (2026-09-02):** 99.39 / 98.31 / 99.07 /
			// 99.54. NOTHING RATCHETS — every figure rounds down to the floor already in force.
			// Branches headroom 12 covered arms, functions 1, which is where both have sat since the
			// wave before this one.
			//
			// The file list came from `git diff --name-only d9478028 HEAD -- src/` plus
			// `git status --short -- src/`, never a filename filter, per the entry three paragraphs
			// above that records what a hand-written one over- and under-matches. Nineteen files, and
			// FOURTEEN of them measure 100% of all four.
			//
			// **This wave added ONE uncovered position and it was covered rather than attributed.**
			// `vaultFileChanges.ts`'s `create` callback: the unit case fired `modify`, `delete` and
			// `rename` and took `create` on trust from the registration case beside it — which proves
			// a listener was registered and says nothing about what its callback does. Found by
			// reading `coverage-final.json` per changed file, which is the instrument that can see one
			// arm; the summary moved by 0.03pp and could not. That whole directory is 100% now.
			//
			// The five uncovered positions left in the files this wave touched are INHERITED, each
			// attributed with `git log -L <line>,<line>:<file>` rather than assumed:
			// `CalibrateAsset.ts`'s `shape === null` arm in `documentFinite` (7eb83f9e, Task B6),
			// `AssetGeometryStore.ts`'s malformed-sidecar `catch` (0ff672f7, the derived-filename
			// task, already named in an entry above), `AssetDesignerRoot.vue`'s `dialogs.current`
			// re-entry guard (d672c3c8, the inspector task), `DesignerCanvas.vue`'s empty-bounds arm
			// (e6c4ded0, the layers task) and `PlanEditorView.ts`'s `mountedPlanId === null` rebind
			// arm (335a6dc9, design slice 16's root-swap work).
			//
			// **A note about the RUN rather than the numbers, because it cost three attempts.** Two
			// serial coverage runs failed on a `warmUpEslint` hook timing out — a DIFFERENT
			// `tests/build/` file each time (`notice-text-boundary`, then
			// `language-resolution-boundary`), each passing in isolation. Serial is not the remedy for
			// that contention and is arguably its cause: this file's own paragraph on the twelve
			// ESLint-booting files records ~30s per boot under default parallelism against ~60s
			// serial, against a 60s budget. Measured here on the whole suite: **103s parallel against
			// 825s serial**, and the parallel run passed all 342 files. A failing `beforeAll` in that
			// directory is a question about the machine before it is a question about the diff, and
			// running SERIALLY to answer it can be what produces it.
			thresholds: {
				statements: 99,
				functions: 99,
				lines: 99,
				branches: 98,
			},
		},
	},
});
