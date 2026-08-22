import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * `engines.node` is a promise, and every dependency renegotiates it silently. A package
 * whose own floor is higher than ours leaves a contributor on a Node this project SAYS it
 * supports, holding a dependency that does not: `npm ci` warns and moves on, `engine-strict`
 * refuses outright, and nothing in `npm run check` has an opinion either way.
 *
 * That is how it went wrong here. `>=22` was written when it was true and was already
 * false before oxlint arrived — `eslint` wants `^22.13.0` and `jsdom` wants `^22.22.2` —
 * and a review bot found it, on the one package of the three this branch happens to add.
 * Which is the argument for a check rather than a one-line correction: the number is not a
 * decision anybody makes, it is a measurement of the dependency tree, and it moves on its
 * own with every upgrade.
 *
 * WHAT THIS SEES, honestly: the highest floor any installed package states for the major
 * version this project declares. What it cannot see: a package that dropped that major
 * altogether (`>=24` with no 22 clause supports none of our range, and reads here as
 * nothing at all), and any constraint expressed outside `engines.node`.
 */

// `^22.13.0`, `>=22.12.0`, `22.19.0`, `>=v22.19.0`, and the bare `>=22` this project itself
// declared — the spellings a floor is written in. Minor and patch are OPTIONAL and default
// to zero, which matters for the bare form specifically: requiring the full triple made
// this crash on the very declaration it exists to reject, which is a checker that fails
// uselessly rather than one that fails.
//
// Deliberately NOT a semver range parser: this needs the lower bound of each clause, which
// a matcher can take from the text, and a dependency added to read a version range would
// be the tool arriving before the job.
const FLOOR = /^[\^>=~\s]*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

const declared = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as {
	engines: { node: string };
};

const floorsIn = (range: string, major: number) =>
	range
		.split('||')
		.map((clause) => FLOOR.exec(clause.trim()))
		.filter((match): match is RegExpExecArray => match !== null && Number(match[1]) === major)
		.map((match) => [major, Number(match[2] ?? 0), Number(match[3] ?? 0)] as const);

const engineRanges = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		if (!entry.isDirectory()) return [];

		const child = path.join(dir, entry.name);

		// A scope directory (`@types`) holds packages, not one.
		if (entry.name.startsWith('@')) return engineRanges(child);

		const nested = path.join(child, 'node_modules');
		const deeper = readdirSync(child, { withFileTypes: true }).some((e) => e.name === 'node_modules')
			? engineRanges(nested)
			: [];

		try {
			const pkg = JSON.parse(readFileSync(path.join(child, 'package.json'), 'utf8')) as {
				engines?: { node?: string };
			};

			return pkg.engines?.node ? [pkg.engines.node, ...deeper] : deeper;
		} catch {
			// Not a package directory, or one without a readable manifest. Nothing to say.
			return deeper;
		}
	});

describe('the declared Node floor', () => {
	const [ours] = floorsIn(declared.engines.node, Number(FLOOR.exec(declared.engines.node)?.[1]));
	const major = ours[0];
	const ranges = engineRanges(path.join(REPO, 'node_modules'));

	// The instrument, tested first: an empty corpus, or a matcher that stopped recognising
	// the spellings, would pass the assertion below by comparing against nothing.
	it('reads the engine ranges of the installed tree', () => {
		expect(ranges.length).toBeGreaterThan(100);
		expect(floorsIn('^20.19.0 || >=22.12.0', 22)).toEqual([[22, 12, 0]]);
		expect(floorsIn('^22.22.2 || ^24.15.0 || >=26.0.0', 22)).toEqual([[22, 22, 2]]);
		expect(floorsIn('>=24.0.0', 22)).toEqual([]);
		// The bare form, which is what this project declared when the check was written.
		expect(floorsIn('>=22', 22)).toEqual([[22, 0, 0]]);
	});

	it('is at least as high as every installed dependency asks for', () => {
		const demanded = ranges.flatMap((range) => floorsIn(range, major));
		const highest = demanded.reduce((a, b) => (a[1] * 1e6 + a[2] > b[1] * 1e6 + b[2] ? a : b));

		expect(ours.join('.')).toBe(highest.join('.'));
	});
});
