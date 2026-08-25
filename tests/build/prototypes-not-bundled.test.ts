import path from 'node:path';
import { build } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { REPO } from '../helpers/oxlint';

/**
 * The guarantee with a user on the other end: no mock, prototype or fixture is ever in a built
 * plugin. `prototypes-one-way-door.test.ts` refuses the import; this refuses the OUTCOME.
 *
 * Both exist because neither is sufficient. Lint reads static imports and a dynamic specifier
 * slips past it; this sees whatever actually got in, and reports only after the fact.
 *
 * `write: false` — the modules that composed the chunk are in the returned output, so nothing
 * is emitted to disk and this does not race `npm run build`'s own `dist/`.
 *
 * The output shape is named locally rather than imported from `rollup`: this repo's Vite
 * (`^8`) bundles with Rolldown, so `rollup` itself is not an installed dependency here at
 * all — only `rolldown` is, transitively, as Vite's own. Importing `RollupOutput` from
 * `rollup` type-checks nowhere (this file is outside the one `tests/**` path that gets
 * type-checked — see CLAUDE.md's Testing section) but still trips `npm run analyze`'s
 * unlisted-dependency scan, which reads import specifiers rather than resolved types. The
 * three members this test actually reads are named here instead, true to what `build()`
 * returns in EITHER bundler, since Vite's compat layer keeps `RollupOutput`'s shape as a
 * deprecated alias of `RolldownOutput`.
 */
const BUILD_MS = 120_000;

interface BuiltChunk {
	type: 'chunk' | 'asset';
	modules?: Record<string, unknown>;
}

interface BuildOutput {
	output: BuiltChunk[];
}

let modules: string[] = [];

beforeAll(async () => {
	const result = (await build({
		configFile: path.resolve(REPO, 'vite.config.ts'),
		build: { write: false },
		logLevel: 'error',
	})) as BuildOutput | BuildOutput[];

	const output = Array.isArray(result) ? result[0] : result;
	// EVERY chunk, not the first. A dynamic import — the exact route this test exists to
	// catch, since lint cannot see it — is what Rollup most likely emits as a SEPARATE chunk,
	// so inspecting `output[0]` alone would leave the interesting case unexamined while
	// looking thorough.
	const chunks = output.output.filter((part) => part.type === 'chunk');

	if (chunks.length === 0) throw new Error('the build produced no chunk to inspect');

	// Absolute ids, normalised to forward slashes so this reads the same on Windows — which
	// is one of the four legs `npm run check` rides.
	modules = chunks.flatMap((chunk) =>
		Object.keys(chunk.type === 'chunk' ? chunk.modules : {}).map((id) => id.split(path.sep).join('/')),
	);
}, BUILD_MS);

describe('the built plugin', () => {
	it('was built from real modules, so this test is asserting on something', () => {
		expect(modules.length).toBeGreaterThan(0);
		// A sanity anchor: the entry itself must be in there, or the shape of `chunk.modules`
		// has changed under us and every assertion below would pass vacuously.
		expect(modules.some((id) => id.endsWith('/src/main.ts'))).toBe(true);
	});

	it('contains no module from src/prototypes/', () => {
		const leaked = modules.filter((id) => id.includes('/src/prototypes/'));

		expect(leaked, `prototypes reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});

	/**
	 * EVERY test path, not just `tests/harness/`. The guarantee names fixtures, and they do not
	 * all live in one directory — `tests/fixtures/promotion/` holds the promoted SFC this plan
	 * itself creates, and it would have passed a harness-only assertion.
	 *
	 * Stated as "nothing under `tests/`" rather than as a list of fixture directories, so the
	 * next one somebody adds is covered without anybody remembering to come back here. Nothing
	 * under `tests/` belongs in a plugin under any circumstances, which makes the broad rule
	 * the correct one rather than merely the convenient one.
	 */
	it('contains no test module at all, fixtures included', () => {
		const leaked = modules.filter((id) => id.includes('/tests/'));

		expect(leaked, `test modules reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});
});
