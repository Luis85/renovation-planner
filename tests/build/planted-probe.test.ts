import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { isPlantedProbe, plantedProbePath } from '../helpers/plantedProbe';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The exclusion three files depend on, asked of itself.
 *
 * `tests/build/lint-edited.test.ts` plants real `.vue` files under `tests/harness/` — it must,
 * because that path has to match ESLint's `VUE_FILES` for the cases to lint anything — and two
 * other files WALK that directory in parallel workers. The failure is a walk that lists a probe
 * and then reads a file that is already gone.
 *
 * Every case here is a way the exclusion could be present and reach nothing, which is
 * indistinguishable from a clean tree: too narrow and the race is live, too wide and a real
 * source file drops silently out of a coverage check whose promise is that none can.
 */
describe('the planted-probe exclusion', () => {
	it('recognises the path its own speller produces', () => {
		expect(isPlantedProbe(plantedProbePath(1))).toBe(true);
		expect(isPlantedProbe(plantedProbePath(42))).toBe(true);
	});

	/**
	 * The one that a straight reuse of the old regex would have failed. `lint-scope.test.ts`
	 * builds `${dir}/${entry.name}`; `harness.test.ts` uses `path.join`, which is a BACKSLASH
	 * on Windows — one of the four CI legs — so a `/`-spelled regex would match nothing there,
	 * silently, and only on the platform nobody develops on.
	 */
	it('recognises a probe path spelled with the platform separator', () => {
		expect(isPlantedProbe(path.join('tests', 'harness', 'lint-edited-probe-3.vue'))).toBe(true);
		expect(isPlantedProbe('tests\\harness\\lint-edited-probe-3.vue')).toBe(true);
	});

	/** Both walkers may hand it an absolute path; only the tail is the claim. */
	it('recognises a probe under an absolute repository path', () => {
		expect(isPlantedProbe(path.join('C:', 'Projects', 'x', plantedProbePath(7)))).toBe(true);
		expect(isPlantedProbe(`/home/runner/work/x/${plantedProbePath(7)}`)).toBe(true);
	});

	/**
	 * The leak this cannot prevent and `.gitignore` can: `afterEach` removes a probe, and a
	 * KILLED run — Ctrl+C, a timed-out CI leg — does not. `git add -A` would then commit a real
	 * `.vue` file that matches the exclusion above, so it would be permanently skipped by the
	 * harness walk and by the lint-scope coverage check whose promise is that no source file
	 * falls out of scope: a file in the tree that no gate reads.
	 *
	 * Asked of GIT rather than by pattern-matching the file, because git is what decides this
	 * in reality and a hand-rolled glob would be a second answer to the same question. Two
	 * numbers, so a rule that somehow pinned one index still fails.
	 */
	it('is a path git already ignores, so a killed run cannot commit one', () => {
		for (const n of [1, 97]) {
			const ignored = spawnSync('git', ['check-ignore', '-q', plantedProbePath(n)], { cwd: REPO });
			expect({ n, status: ignored.status }).toEqual({ n, status: 0 });
		}
	});

	/**
	 * The wide direction, which is the one that fails silently. `walk` also runs over `src/`
	 * and `scripts/`, so the test is on the WHOLE PATH: a real file that merely shares the
	 * basename must not drop out of the scope comparison.
	 */
	it('claims nothing outside the one directory, extension and shape it reserves', () => {
		expect(isPlantedProbe('src/prototypes/lint-edited-probe-1.vue')).toBe(false);
		expect(isPlantedProbe('tests/harness/lint-edited-probe-1.ts')).toBe(false);
		expect(isPlantedProbe('tests/harness/lint-edited-probe-.vue')).toBe(false);
		expect(isPlantedProbe('tests/harness/lint-edited-probe-abc.vue')).toBe(false);
		expect(isPlantedProbe('tests/harness/IndexPage.vue')).toBe(false);
		// Not a suffix match on a longer directory name either.
		expect(isPlantedProbe('vendor/nottests/harness/lint-edited-probe-1.vue')).toBe(false);
	});
});
