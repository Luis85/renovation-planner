import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { repoRelative } from '../helpers/repo';
import { declaredEnvironment } from '../helpers/environmentDirective';
import { reachableFrom, repoTree } from '../helpers/importGraph';

/**
 * The inner layers execute in bare node — asked as the EFFECTIVE environment, not as a
 * text scan for one of the ways to change it.
 *
 * The node default is one of the two mechanisms SDD §8 credits with enforcing the layer
 * boundary, and it is the only one that catches an INDIRECT DOM reach: a `domain/` module
 * touching a DOM global through a helper has no import for a per-file lint rule to see.
 * Forgetting a jsdom docblock fails loudly — the DOM test dies under strict node — so the
 * hole this guards is the opposite one: ADDING a docblock where it does not belong, which
 * switches the backstop off with every gate green.
 *
 * A DENYLIST, not an allowlist. An allowlist says "jsdom is permitted here and nowhere
 * else", a claim about the whole tree that nothing needs and that goes stale every time a
 * legitimate DOM-touching helper appears somewhere new — measured, it rejects
 * `tests/helpers/obsidian-mock.test.ts` and `tests/build/entryDrawn.test.ts`, both of which
 * legitimately need jsdom. The subject is narrower: the inner layers' node enforcement.
 *
 * Not `jsdom` by name but "not node", because a rule with an implicit `else` claims
 * everything it never thought about.
 */
const PROTECTED_DIRECTORIES = ['tests/core/', 'tests/domain/', 'tests/application/'] as const;

/**
 * Whether a COLLECTED file reaches `tests/contracts/` through the import graph — the shared walk
 * in `tests/helpers/importGraph.ts`, which reads edges out of the TypeScript and SFC parsers.
 *
 * Transitive rather than one hop, and the distinction is not academic: Vitest selects an
 * environment for the collected file, so a test reaching a contract through a helper has no
 * direct import from `tests/contracts/` and a one-hop predicate never classifies the file
 * whose environment actually decides. Today the callers import directly — measured — so a
 * one-hop test happens to hold, which is exactly the kind of accident that stops holding
 * without telling anyone.
 *
 * This file carried a walker of its own before the shared one existed, and it was holed three
 * times in three rounds — a dynamic `import()` without whitespace, an extensionless `.js`
 * relay, a backtick-quoted specifier — each a regex over source text finding a spelling the
 * last regex did not. The shared walk's header says what the parsers see and what nothing can.
 */
const reachesContracts = (entry: string): boolean =>
	[...reachableFrom(repoRelative(entry), repoTree, ['src/', 'tests/'])].some((file) => file.startsWith('tests/contracts/'));

/**
 * What this seam still cannot see: a CLI flag on the OUTER invocation that actually runs
 * this very suite.
 *
 * `createVitest('test', { watch: false })` below resolves `spec.project.config.environment`
 * from the `options` object passed here and from `vitest.config.ts` on disk, and from
 * nothing else — read directly out of the installed package rather than assumed:
 * `createVitest`'s own implementation, exported from `vitest/node` — read by NAME rather
 * than by the content-hashed chunk file it currently lives in, which rotates on every
 * vitest patch — never touches `process.argv`. So a CLI-level override added to the invocation that
 * actually COLLECTS AND RUNS this suite — `vitest run --coverage --environment=jsdom` in
 * place of `test:coverage`'s current script, with `vitest.config.ts` itself untouched —
 * would run every inner-layer test under jsdom while this guard's own nested `createVitest`
 * call, reading only the unmodified config file, would still report `environment: 'node'`
 * for every spec and pass green. Not the same hole as a per-file directive: nothing on disk
 * changes, so nothing this guard reads would disagree with what actually ran.
 *
 * Not fixed here, and the brief's own scoping already says why: this file protects the
 * suite it collects, not the command line that invoked it, and it "does not attempt to
 * protect its own config file" — a CLI flag on the outer invocation is one layer further
 * out than that. Named as a residual rather than left implicit, the way the shared walk's
 * header names the computed-specifier gap.
 */
describe('the inner layers execute in node', () => {
	it('resolves the effective environment of every collected file to node where it is protected', async () => {
		const { createVitest } = await import('vitest/node');
		const vitest = await createVitest('test', { watch: false });
		const specs = await vitest.globTestSpecifications();
		await vitest.close();

		const offenders: string[] = [];
		// Tracked SEPARATELY from `offenders`, and asserted separately below: a guard that
		// examines nothing passes `toEqual([])` for the same reason a guard that examines
		// everything correctly does, and this repository's own recurring shape is a category
		// check silently reaching zero of the things it claims to cover. Two arrays rather
		// than one combined count, because a single combined assertion would stay green with
		// either arm dead — the "guards one of several things" mutation this branch names
		// throughout, applied to its own gate.
		const examinedByDirectory: string[] = [];
		const examinedByContract: string[] = [];
		for (const spec of specs) {
			const path = repoRelative(spec.moduleId);
			const protectedByDirectory = PROTECTED_DIRECTORIES.some((dir) => path.startsWith(dir));

			// The rule is STRUCTURAL: a file that invokes a repository contract runs in node.
			// Naming the six callers instead would be a list that goes stale — the allowlist
			// defect one level down — and a directory-wide ban on `tests/infrastructure/`
			// reaches past its own justification, since that layer may legitimately touch
			// the DOM.
			if (protectedByDirectory) {
				examinedByDirectory.push(path);
			} else if (reachesContracts(spec.moduleId)) {
				examinedByContract.push(path);
			} else {
				continue;
			}

			const declared = declaredEnvironment(readFileSync(spec.moduleId, 'utf8'));
			const effective = declared ?? spec.project.config.environment;
			if (effective !== 'node') offenders.push(`${path}: ${effective}`);
		}

		expect(offenders).toEqual([]);
		// Both arms, independently: a regression in `PROTECTED_DIRECTORIES` (a typo, an
		// emptied list) reddens the first without touching the second, and a regression in
		// `reachesContracts` (it has already been holed three times — dynamic imports,
		// extensions, backtick delimiters) reddens the second without touching the first.
		// Neither figure is pinned to a number on purpose: the count of files under either
		// arm changes as the suite grows, and hard-coding it is this same file's `spec-files`
		// sibling's stale-figure mistake waiting to happen here too.
		expect(examinedByDirectory.length).toBeGreaterThan(0);
		expect(examinedByContract.length).toBeGreaterThan(0);
		// This case globs the whole suite through a nested `createVitest` and walks every
		// collected file's import graph: measured 5.3 s alone on 2026-09-12 (it was 56 s alone
		// and 128 s under the full gate on a contended machine before the walk was cached per
		// tree). The budget stays wide because a whole-suite glob scales with the tree and the
		// machine, and a red about the machine is what it refuses.
	}, 300_000);
});
