import { beforeAll, describe, expect, it } from 'vitest';
import { toPosix } from '../helpers/posix';
import { BUILD_MS, releaseBuild } from '../helpers/releaseBuild';
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
 * The in-memory build is `../helpers/releaseBuild.ts`, shared with `release-bundle.test.ts`.
 */

// Absolute, normalised to forward slashes exactly like `modules` below, so a module id can
// be compared against it the same way on every platform — REPO holds backslashes on
// Windows and the ids `releaseBuild` returns never do.
//
// The trailing separator is APPENDED rather than inherited. `REPO` gets one today from
// `fileURLToPath(new URL('../..', …))`, and both leak filters below build their prefix as
// `${repoRoot}src/prototypes/` — so if it ever loses that slash, both prefixes become
// `…/renovation-plannersrc/prototypes/`, both filters match nothing, and both `toEqual([])`
// assertions pass vacuously. That is the strongest guarantee in this feature going green while
// checking nothing, on a change to a helper in another file. Stripping the trailing slash is
// idempotent, so it is correct whichever way `REPO` is spelled.
const repoRoot = `${toPosix(REPO).replace(/\/$/, '')}/`;

let modules: readonly string[] = [];

beforeAll(async () => {
	({ modules } = await releaseBuild());
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

