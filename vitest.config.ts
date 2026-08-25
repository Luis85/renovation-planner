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
			// Registration glue that needs the real Obsidian Plugin runtime.
			exclude: ['src/main.ts'],
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
			thresholds: {
				statements: 99,
				functions: 99,
				lines: 99,
				branches: 98,
			},
		},
	},
});
