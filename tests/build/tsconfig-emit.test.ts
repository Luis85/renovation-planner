import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';
import { REPO } from '../helpers/repo';

/**
 * `allowJs` is on, and `tests/build/` imports the build scripts and `eslint.config.mjs`
 * directly — so those files are program INPUTS, not merely files on disk. A `tsconfig.json`
 * declaring neither `noEmit` nor an `outDir` therefore names each of them as its own emit
 * target, which TypeScript refuses: TS5055, "Cannot write file X because it would overwrite
 * input file".
 *
 * Every gate stayed green while that was true, and that is the whole reason this file
 * exists: `npm run build` passes `-noEmit` on the COMMAND LINE, so the option suppressing
 * the diagnostic was one the config never carried. An IDE's language service reads the
 * config and not the npm script, so seven errors sat on the developer's screen and nowhere
 * else — a defect visible only to whoever has the file open, which is the one gate this
 * repository cannot run.
 *
 * The check asks TypeScript rather than reading the setting back, so it accepts either
 * remedy — `noEmit`, or an `outDir` outside the tree — and refuses only the state that
 * really marks the file. Measured BOTH ways in the case itself: 0 under the project's own
 * options, 13 with `noEmit` forced off.
 */

/** Cannot write file '…' because it would overwrite input file. */
const OVERWRITES_INPUT = 5055;

/**
 * The JavaScript this repository owns — the root configs and the build scripts — read from
 * disk rather than listed, because a list of the files some test happens to import today is
 * exactly what goes stale. It is deliberately WIDER than the seven the real program pulls
 * in: an output path is a property of an input, so a script nothing imports yet is asked
 * the same question before it acquires its first importer.
 */
const jsIn = (dir: string): string[] =>
	readdirSync(path.join(REPO, dir), { withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.[cm]?js$/.test(entry.name))
		.map((entry) => path.join(REPO, dir, entry.name));

/**
 * Where an input's output lands depends on `outDir`, `rootDir` and `noEmit` and on nothing
 * that resolution or the standard library could tell us — so the program is built with the
 * project's real options and those three switched OFF.
 *
 * **That is a cost decision, not a tidiness one, and it was measured.** A program over the
 * whole `include` answers identically, passes alone in 2.8s, and then times out at 30s
 * inside the suite's own file parallelism, taking two neighbouring files over their budgets
 * with it — this repository's own lesson that a test file's CPU cost is part of its
 * correctness when anything in the suite waits in ticks. Resolving imports from these 13
 * roots alone still costs 1.3s; dropping the lib and the ambient types too brings the pair
 * of programs to about 250ms, which is what makes this file an ordinary neighbour.
 */
const PATHS_ONLY: ts.CompilerOptions = { noResolve: true, noLib: true, types: [] };

describe('the project compiler options', () => {
	it('never make an input file its own emit target', () => {
		const config = ts.readConfigFile(path.join(REPO, 'tsconfig.json'), ts.sys.readFile);

		expect(config.error, 'tsconfig.json did not parse').toBeUndefined();

		const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, REPO, undefined, 'tsconfig.json');

		expect(parsed.errors, 'tsconfig.json did not resolve').toStrictEqual([]);

		const roots = [...jsIn('.'), ...jsIn('scripts')];

		// A walk that reached nothing reports no collisions and reads as a clean tree.
		expect(roots.length, 'no JavaScript found to check').toBeGreaterThan(10);

		const collisionsIn = (options: ts.CompilerOptions): string[] =>
			ts
				.createProgram({ rootNames: roots, options: { ...parsed.options, ...PATHS_ONLY, ...options } })
				.getOptionsDiagnostics()
				.filter((diagnostic) => diagnostic.code === OVERWRITES_INPUT)
				.map((diagnostic) => ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));

		expect(collisionsIn({}), 'a program input would be overwritten by its own output').toStrictEqual([]);

		// The instrument, proven able to see the thing it reports the absence of.
		expect(collisionsIn({ noEmit: false })).toHaveLength(roots.length);
	});
});
