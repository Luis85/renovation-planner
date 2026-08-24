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
			thresholds: {
				statements: 99,
				functions: 99,
				lines: 99,
				branches: 98,
			},
		},
	},
});
