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
			thresholds: {
				statements: 99,
				functions: 99,
				lines: 99,
				branches: 98,
			},
		},
	},
});
