/**
 * The transient SFCs `tests/build/lint-edited.test.ts` plants, named and recognised in ONE
 * place so the planter and every walker cannot drift apart.
 *
 * `plantSfc` writes real `.vue` files into `tests/harness/` — it has to, because that is a
 * directory `VUE_FILES` matches, and linting an SFC against this repository's own Vue rules
 * is the whole point of those cases. Two other test files WALK that directory, and under
 * vitest's file parallelism a probe can exist when a walk lists it and be gone by the time
 * that walk's caller reads it. Measured: `tests/harness/harness.test.ts` failed with
 * `ENOENT … lint-edited-probe-1.vue`, on a tree with no source change at all.
 *
 * `tests/build/lint-scope.test.ts` already excluded them and carried the argument for why;
 * `harness.test.ts` never did, so one walker was protected and the other was not — which is
 * this repository's recurring shape, a rule expressed at one of the places that needs it.
 * Hoisting the pair here is what makes "every walker skips a probe" a fact about one import
 * rather than about how many call sites somebody remembered.
 *
 * THE WHOLE PATH, not the basename, and that distinction is `lint-scope.test.ts`'s: its
 * `walk` also runs over `src/` and `scripts/`, and a basename test would let a real file
 * called `lint-edited-probe-*.vue` anywhere in the repository fall out of a coverage check
 * whose whole promise is that no source file falls out of scope. An exclusion inside a
 * coverage check has to be exactly as wide as the thing it excludes.
 *
 * The regex accepts EITHER separator rather than normalising the input first, because the
 * callers spell paths differently — `lint-scope` builds `${dir}/${entry.name}` and `harness`
 * uses `path.join`, which is a BACKSLASH on Windows. A `/`-only regex handed a `path.join`
 * result matches nothing there, silently, on one of the four CI legs and the one nobody
 * develops on. Accepting both is what makes the exclusion's reach a property of the pattern
 * rather than of every caller remembering to normalise.
 */
const PLANTED_PROBE = /(?:^|[\\/])tests[\\/]harness[\\/]lint-edited-probe-\d+\.vue$/;

/** The repository-relative path of probe `n`, POSIX-separated. The planter's only speller. */
export function plantedProbePath(n: number): string {
	return `tests/harness/lint-edited-probe-${n}.vue`;
}

/** Is this path one of those probes — asked by every walk that can list one. */
export function isPlantedProbe(file: string): boolean {
	return PLANTED_PROBE.test(file);
}
