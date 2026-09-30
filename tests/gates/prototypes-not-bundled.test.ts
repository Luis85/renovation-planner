import path from 'node:path';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { beforeAll, describe, expect, it } from 'vitest';
import { toPosix } from '../helpers/posix';
import { REPO } from '../helpers/repo';

/**
 * The guarantee with a user on the other end: no prototype or fixture MODULE composes a
 * built chunk. `prototypes-one-way-door.test.ts` refuses the import statement; this refuses
 * the outcome — together they are what serve the wider claim that no mock, prototype or
 * fixture ever reaches a user, by whichever route.
 *
 * Narrower than that wider claim on purpose: `chunk.modules` is where source provenance
 * lives, so a prototype or fixture shipped as a separate output ASSET — a file with a
 * `fileName` and emitted `source`, no module id list — is outside what this test can see.
 * Not cheaply checkable, which is why the sentence above is narrowed rather than the check
 * widened to cover it.
 *
 * Both exist because neither is sufficient. Lint reads static imports and a dynamic
 * specifier slips past it; this sees whatever actually got in, and reports only after the
 * fact.
 *
 * `write: false` — the modules that composed the chunk are in the returned output, so
 * nothing is emitted to disk and this does not race `npm run build`'s own `dist/`.
 *
 * `Rolldown` comes from `vite` itself (`node_modules/vite/dist/node/index.d.ts` re-exports
 * it), not from `rollup`: this repo's Vite (`^8`) bundles with Rolldown, and `rollup` is not
 * an installed dependency here at all. Importing `RollupOutput` from `rollup` would
 * type-check nowhere — this file is outside the one `tests/**` path that gets type-checked
 * (CLAUDE.md's Testing section) — but would still trip `npm run analyze`'s
 * unlisted-dependency scan, which reads import specifiers rather than resolved types.
 */
const BUILD_MS = 120_000;

// Absolute, normalised to forward slashes exactly like `modules` below, so a module id can
// be compared against it the same way on every platform — REPO holds backslashes on
// Windows and the ids built below never do.
//
// The trailing separator is APPENDED rather than inherited. `REPO` gets one today from
// `fileURLToPath(new URL('../..', …))`, and both leak filters below build their prefix as
// `${repoRoot}src/prototypes/` — so if it ever loses that slash, both prefixes become
// `…/renovation-plannersrc/prototypes/`, both filters match nothing, and both `toEqual([])`
// assertions pass vacuously. That is the strongest guarantee in this feature going green while
// checking nothing, on a change to a helper in another file. Stripping the trailing slash is
// idempotent, so it is correct whichever way `REPO` is spelled.
const repoRoot = `${toPosix(REPO).replace(/\/$/, '')}/`;

let modules: string[] = [];
let code: string[] = [];

beforeAll(async () => {
	const result = (await build({
		configFile: path.resolve(REPO, 'vite.config.ts'),
		root: REPO,
		build: { write: false },
		logLevel: 'error',
	})) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[];

	const output = Array.isArray(result) ? result[0] : result;
	// EVERY chunk, not the first. A dynamic import — the exact route this test exists to
	// catch, since lint cannot see it — is what Rollup most likely emits as a SEPARATE chunk,
	// so inspecting `output[0]` alone would leave the interesting case unexamined while
	// looking thorough.
	const chunks = output.output.filter((part): part is Rolldown.OutputChunk => part.type === 'chunk');

	if (chunks.length === 0) throw new Error('the build produced no chunk to inspect');

	// Absolute ids, normalised to forward slashes so this reads the same on Windows — which
	// is one of the four legs `npm run check` rides.
	modules = chunks.flatMap((chunk) => Object.keys(chunk.modules).map((id) => toPosix(id)));
	code = chunks.map((chunk) => chunk.code);
}, BUILD_MS);

describe('the built plugin', () => {
	it('was built from real modules, so this test is asserting on something', () => {
		expect(modules.length).toBeGreaterThan(0);
		// A sanity anchor: the entry itself must be in there, or the shape of `chunk.modules`
		// has changed under us and every assertion below would pass vacuously.
		//
		// Asserted at the WHOLE prefix the two leak filters use, not as `endsWith('/src/main.ts')`
		// — which is what this was, and which cannot catch the hazard `repoRoot` names above: it
		// is true whether or not `repoRoot` ends in a separator, so the anchor read correct while
		// both filters matched nothing. The prefix is the thing that has to be right, so the
		// prefix is what this asserts.
		expect(modules).toContain(`${repoRoot}src/main.ts`);
	});

	it('contains no module from src/prototypes/', () => {
		// Anchored on this repository's own tree rather than a bare `/src/prototypes/`
		// substring, so a dependency at `node_modules/x/src/prototypes/…` cannot fail this
		// on correct work — `repoRoot` is what excludes `node_modules` from matching at all,
		// since a package inside it never starts with this repo's own absolute path.
		const leaked = modules.filter((id) => id.startsWith(`${repoRoot}src/prototypes/`));

		expect(leaked, `prototypes reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});

	/**
	 * EVERY test path, not just `tests/harness/`. The guarantee names fixtures, and they do
	 * not all live in one directory — `tests/fixtures/promotion/` holds the promoted SFC, and
	 * a harness-only assertion would not have covered it.
	 *
	 * Stated as "nothing under `tests/`" rather than as a list of fixture directories, so the
	 * next one somebody adds is covered without anybody remembering to come back here. Nothing
	 * under `tests/` belongs in a plugin under any circumstances, which makes the broad rule
	 * the correct one rather than merely the convenient one.
	 */
	it('contains no test module at all, fixtures included', () => {
		// Anchored on this repository's own tree for the same reason as the prototypes check
		// above — node_modules/x/tests/… must not trip this on correct work.
		const leaked = modules.filter((id) => id.startsWith(`${repoRoot}tests/`));

		expect(leaked, `test modules reached the bundle: ${leaked.join(', ')}`).toEqual([]);
	});
});

/**
 * The release ships Vue in PRODUCTION mode. Library mode does not replace `process.env`, so
 * without `vite.config.ts`'s `define` every one of Vue's `process.env.NODE_ENV !== 'production'`
 * branches survives into `main.js` — prop validation, `[Vue warn]` and dev-only checks run
 * for every user whose host does not set NODE_ENV, and one of those reads sits at module top
 * level, which throws on a host with no `process` global at all.
 *
 * Asked of the EMITTED code, not of the config: the property is "no read is left", whichever
 * way it would get there. Asserted over `process.env` as a whole rather than only NODE_ENV,
 * so a dependency reading some other variable is caught too — the define removes only the
 * one key, and a bundle that still reads the environment would fail the same hosts.
 */
describe('the release bundle', () => {
	it('reads no process.env, so Vue ships in production mode', () => {
		expect(code.length).toBeGreaterThan(0);
		// A count per chunk, not the chunk: a failure that printed the bundle would be 2 MB.
		const reads = code.map((text) => text.split('process.env').length - 1);

		expect(reads, 'process.env reads per emitted chunk').toEqual(code.map(() => 0));
	});
});
