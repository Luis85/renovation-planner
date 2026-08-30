import { describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { REPO } from '../helpers/oxlint';

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

/** The regex Vitest itself matches with, read out of the installed package, not assumed. */
const ENVIRONMENT_DIRECTIVE = /@(?:vitest|jest)-environment\s+([\w-]+)\b/u;

const posix = (path: string): string => relative(REPO, path).split(sep).join('/');

/**
 * Relative import specifiers — STATIC and DYNAMIC both, because both are graph edges.
 *
 * A first draft matched `(?:from|import)\s+['"]` only, which requires whitespace after the
 * keyword and so cannot see `await import('../x')` or `const m = import('../x')`. That is not
 * a hypothetical form in this repository: `tests/plugin/persistence-wiring.test.ts:35` reaches
 * the composition root exactly that way. A collected test reaching a contract through a helper
 * that imports it dynamically would have been classified as not-protected, free to select
 * jsdom with this guard green — the transitive hole closed one round earlier, reopened by the
 * matcher underneath it.
 *
 * What it still cannot see, written down rather than implied, because a matcher over source
 * text is partial by construction: a COMPUTED specifier (`import(someVariable)`), a
 * `require()`, and a re-export chain that leaves the relative tree and comes back. The first
 * is the one that would matter, and nothing in `tests/` writes one today — measured. If that
 * changes, the fix is not a longer regex but Vitest's own resolved module graph, which is the
 * only authority that cannot be partial.
 */
const importsOf = (file: string): string[] => {
	const source = readFileSync(file, 'utf8');
	const statik = [...source.matchAll(/(?:from|import)\s+['"](\.[^'"]+)['"]/gu)];
	const dynamic = [...source.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]/gu)];
	return [...statik, ...dynamic].map((match) => match[1] ?? '');
};

/**
 * Every extension Vitest itself can resolve, in its own order — not just `.ts`.
 *
 * A draft tried the literal path, `.ts` and `/index.ts` alone, so an extensionless import of a
 * `.js` or `.mjs` relay resolved to nothing and its own import of `tests/contracts/` was never
 * visited: the collected caller came back unprotected and free to select jsdom with the guard
 * green. The transitive walk has now been holed twice in three rounds by the RESOLVER beneath
 * it rather than by the walk — first by missing dynamic `import()`, now by missing extensions.
 *
 * Widened rather than made authoritative, and the trade is stated so the next reader inherits
 * it: Vitest's own resolved module graph is the only thing that cannot be partial, and
 * `importsOf`'s header already names it as the remedy when this list stops being enough. What
 * this still cannot resolve is a path alias from `vitest.config.ts` — measured, `tests/` uses
 * none today.
 */
const RESOLVABLE = ['', '.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'] as const;

const resolveSpecifier = (from: string, specifier: string): string | null => {
	const base = resolve(dirname(from), specifier);
	const candidates = [
		...RESOLVABLE.map((extension) => `${base}${extension}`),
		...RESOLVABLE.filter((extension) => extension !== '').map((extension) => `${base}/index${extension}`),
	];
	for (const candidate of candidates) {
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			continue;
		}
	}
	return null;
};

/**
 * Whether a COLLECTED file reaches `tests/contracts/` through the import graph.
 *
 * Transitive rather than one hop, and the distinction is not academic: Vitest selects an
 * environment for the collected file, so a test reaching a contract through a helper has no
 * direct import from `tests/contracts/` and a one-hop predicate never classifies the file
 * whose environment actually decides. Today all six callers import directly — measured — so
 * a one-hop test happens to hold, which is exactly the kind of accident that stops holding
 * without telling anyone.
 */
const reachesContracts = (entry: string): boolean => {
	const seen = new Set<string>();
	const queue = [entry];
	while (queue.length > 0) {
		const file = queue.pop();
		if (file === undefined || seen.has(file)) continue;
		seen.add(file);
		if (posix(file).startsWith('tests/contracts/')) return true;
		for (const specifier of importsOf(file)) {
			const target = resolveSpecifier(file, specifier);
			if (target !== null && !seen.has(target)) queue.push(target);
		}
	}
	return false;
};

describe('the inner layers execute in node', () => {
	it('resolves the effective environment of every collected file to node where it is protected', async () => {
		const { createVitest } = await import('vitest/node');
		const vitest = await createVitest('test', { watch: false });
		const specs = await vitest.globTestSpecifications();
		await vitest.close();

		const offenders: string[] = [];
		for (const spec of specs) {
			const path = posix(spec.moduleId);
			const protectedByDirectory = PROTECTED_DIRECTORIES.some((dir) => path.startsWith(dir));

			// The rule is STRUCTURAL: a file that invokes a repository contract runs in node.
			// Naming the six callers instead would be a list that goes stale — the allowlist
			// defect one level down — and a directory-wide ban on `tests/infrastructure/`
			// reaches past its own justification, since that layer may legitimately touch
			// the DOM.
			if (!protectedByDirectory && !reachesContracts(spec.moduleId)) continue;

			const declared = ENVIRONMENT_DIRECTIVE.exec(readFileSync(spec.moduleId, 'utf8'))?.[1];
			const effective = declared ?? spec.project.config.environment;
			if (effective !== 'node') offenders.push(`${path}: ${effective}`);
		}

		expect(offenders).toEqual([]);
	}, 120_000);
});
