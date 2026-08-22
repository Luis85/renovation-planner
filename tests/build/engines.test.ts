import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import semver from 'semver';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * `engines.node` is a promise, and every dependency renegotiates it silently. A runtime
 * this project SAYS it supports, holding a dependency that does not, leaves a contributor
 * with an `npm ci` that warns and carries on, an `engine-strict` install that refuses, and
 * nothing in `npm run check` with an opinion either way.
 *
 * It went wrong here twice, and the second time is why this compares whole RANGES rather
 * than lower bounds. `>=22` was already false before oxlint arrived. Raising it to
 * `>=22.22.2` fixed the floor and still over-promised at the top: eighteen installed
 * packages support `^22.x` and `>=24` while excluding Node 23 entirely, and an unbounded
 * floor claims 23. A bound is not a range, and checking one bound only finds the defects
 * that happen to live at that end.
 *
 * So the declaration is a subset test against every installed package, using npm's own
 * semver implementation rather than a matcher of our own — the instrument that decides
 * this in reality is the one that should decide it here.
 *
 * WHAT THIS CANNOT SEE: a constraint expressed anywhere other than `engines.node`, and any
 * package not installed in this tree (an optional dependency skipped on this platform, or
 * a peer nobody pulled in). It reads what `npm ci` put on disk.
 */

const declared = (JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
	engines: { node: string };
}).engines.node;

/** Every `engines.node` in the installed tree, by the package that states it. */
const stated = (dir: string): [name: string, range: string][] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (!entry.isDirectory()) return [];

		const child = path.join(dir, entry.name);

		// A scope directory (`@types`) holds packages, not one.
		if (entry.name.startsWith('@')) return stated(child);

		const deeper = readdirSync(child, { withFileTypes: true }).some((e) => e.name === 'node_modules')
			? stated(path.join(child, 'node_modules'))
			: [];

		try {
			const pkg = JSON.parse(readFileSync(path.join(child, 'package.json'), 'utf8')) as {
				name?: string;
				engines?: { node?: string };
			};
			const range = pkg.engines?.node?.trim();

			// `*` is every version, which constrains nothing and would only add noise.
			return range && range !== '*' ? [[pkg.name ?? entry.name, range] as [string, string], ...deeper] : deeper;
		} catch {
			// Not a package directory, or one without a readable manifest. Nothing to say.
			return deeper;
		}
	});

const ranges = stated(path.join(REPO, 'node_modules'));

/** `null` when semver cannot answer — a range it refuses is a failure, never a skip. */
const covers = (range: string) => {
	try {
		return semver.subset(declared, range);
	} catch {
		return null;
	}
};

describe('the declared Node range', () => {
	/**
	 * The instrument, tested first, and on the exact defect it exists to catch: a subset
	 * test that had stopped answering, or a corpus that had gone empty, would pass the
	 * assertions below by comparing nothing against nothing.
	 */
	it('recognises an over-promise, including one only the upper end shows', () => {
		expect(ranges.length).toBeGreaterThan(100);

		// The floor is right and the range still claims Node 23, which this package excludes.
		expect(semver.subset('>=22.22.2', '^22.22.2 || ^24.15.0 || >=26.0.0')).toBe(false);
		// And the shape that is genuinely covered.
		expect(semver.subset('^22.22.2', '^22.13.0 || >=24')).toBe(true);
	});

	it('is one semver understands, in every package that states one', () => {
		expect(ranges.filter(([, range]) => covers(range) === null)).toEqual([]);
	});

	it('promises no runtime an installed dependency refuses', () => {
		const overPromised = ranges.filter(([, range]) => covers(range) === false).map(([name, range]) => `${name}: ${range}`);

		expect([...new Set(overPromised)]).toEqual([]);
	});
});
