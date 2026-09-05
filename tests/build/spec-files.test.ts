import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, repoRelative } from '../helpers/repo';

const walk = (dir: string): string[] => {
	const found: string[] = [];
	for (const name of readdirSync(dir)) {
		if (name === 'node_modules' || name.startsWith('.')) continue;
		const full = join(dir, name);
		if (statSync(full).isDirectory()) found.push(...walk(full));
		else found.push(full);
	}
	return found;
};

/**
 * **PRE-EXISTING**, and labelled so it does not read as a cost of whatever branch meets it.
 *
 * The case below asks Vitest itself which specifications it collects, which means building a
 * whole `createVitest` instance — config resolution, project setup, a glob over the tree —
 * inside a test. That is real work whose duration is the machine's business, and it runs
 * CONCURRENTLY with the suite project rather than alone: measured on a quiet four-core box,
 * 2.3s on its own and 5.3–5.8s during `npm run check`, against vitest's 5000ms default. So it
 * failed the gate reproducibly here while passing every CI leg, which is the signature of a
 * budget nobody chose rather than of a slow oracle.
 *
 * Verified pre-existing rather than assumed: reproduced at `HEAD` with the working tree
 * stashed, at 5435ms.
 *
 * Bounded rather than removed, and generously: what this case can fail for OTHER than the
 * clock is a real disagreement between the tree and the collection, which is an assertion and
 * not a hang. The same trade `ESLINT_BOOT_MS` and the harness scans already make.
 */
const COLLECTION_ORACLE_MS = 30_000;

describe('test file naming', () => {
	/**
	 * Both trees, because measuring a set and then guarding a subset of it is this
	 * repository's recurring failure in its smallest form. `src/` is the half that matters
	 * more: an uncollected `.spec.ts` under `tests/` is dead weight, while one under `src/`
	 * is unexecuted test code inside the SHIPPED tree.
	 */
	it.each(['tests', 'src'])('has no .spec.ts anywhere under %s/', (tree) => {
		const offenders = walk(join(REPO, tree))
			.map((path) => repoRelative(path))
			.filter((path) => path.endsWith('.spec.ts'));

		expect(offenders).toEqual([]);
	});

	/**
	 * And no `*.test.ts` under `src/` either, which neither rule above can see.
	 *
	 * The naming rule matches `.spec.ts` only, and the collection oracle below enumerates
	 * `tests/` only — so `src/foo.test.ts` is invisible to both while being exactly the case
	 * the `.spec.ts` rationale calls the one that matters most: build input, inside the
	 * shipped tree, never collected and never run. Reported by a review bot against a
	 * paragraph of mine arguing precisely why `src/` is the more important half.
	 *
	 * Rejecting it is the right rule rather than widening the collection oracle to `src/`,
	 * because the slice's own layout requirement is that every test of a `src/` module sits
	 * at its module's MIRRORED path under `tests/`. A collected `src/foo.test.ts` would
	 * satisfy an oracle and still violate the layout.
	 */
	it('has no .test.ts under src/, where a test file would be build input', () => {
		const offenders = walk(join(REPO, 'src'))
			.map((path) => repoRelative(path))
			.filter((path) => path.endsWith('.test.ts'));

		expect(offenders).toEqual([]);
	});

	/**
	 * The other half: a `*.test.ts` that exists on disk and is NOT collected is a suite
	 * nobody runs, which the naming rule alone cannot see. Asked of Vitest itself rather
	 * than by re-implementing the `include` glob, so a config change is answered by the
	 * thing that actually decides.
	 *
	 * `*.fixture.ts` is deliberately outside both rules: it is neither `.spec.ts` nor
	 * `.test.ts`, which is what lets Task 9's deliberately-failing fixture exist without
	 * either breaking the gate it is part of or colliding with this one.
	 */
	it('collects every *.test.ts on disk', async () => {
		const onDisk = walk(join(REPO, 'tests'))
			.map((path) => repoRelative(path))
			.filter((path) => path.endsWith('.test.ts'))
			.toSorted();

		// NO `dir` override. `vitest.config.ts`'s `include` is already `tests/**/*.test.ts`, and
		// `dir` rebases it — measured: `{ watch: false }` returns a non-zero count of
		// specifications while `{ watch: false, dir: 'tests' }` returns ZERO, because the
		// include resolves to `tests/tests/**/*.test.ts`. The SHAPE of that measurement is
		// what is asserted here, deliberately never a specific figure: a count is a fact about
		// today's suite and goes stale the moment a test file is added or removed, which is
		// exactly the mistake this comment itself once made — it read "245" long after the
		// suite had grown past that number. With `onDisk` holding the real suite, the
		// assertion below could never have passed under the rebased call.
		const { createVitest } = await import('vitest/node');
		const vitest = await createVitest('test', { watch: false });
		const specs = await vitest.globTestSpecifications();
		await vitest.close();

		const collected = [...new Set(specs.map((spec) => repoRelative(spec.moduleId)))].toSorted();

		expect(collected).toEqual(onDisk);
	}, COLLECTION_ORACLE_MS);
});
