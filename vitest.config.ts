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
			// Which increment moved which figure, so git is not the only record:
			//   - first measurement, 21 statements:  95 / 75 / 90 / 94
			//   - the view, its activation, registration, i18n and the settings pane
			//     (44 statements):                   97 / 91 / 95 / 97
			//   - design slice 1 (92 statements):    98 / 97 / 96 / 98  ← this one
			//
			// The floors are not 100. Rule 3 above wants one covered unit of headroom, and one
			// unit is still large here: a statement is 1.1pp, a BRANCH 2.9pp. Pinning 100 would
			// make the first genuinely unreachable defensive branch a choice between a test
			// gymnastic and lowering a floor, and a floor never comes down. Whole numbers
			// rather than decimals: precision at n=92 would be theatre.
			thresholds: {
				statements: 98,
				branches: 97,
				functions: 96,
				lines: 98,
			},
		},
	},
});
