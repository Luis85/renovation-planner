import { beforeAll, describe, expect, it } from 'vitest';
import { BUILD_MS, releaseBuild } from '../helpers/releaseBuild';

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
 *
 * The in-memory build is `../helpers/releaseBuild.ts`, shared with
 * `prototypes-not-bundled.test.ts`.
 */
let code: readonly string[] = [];

beforeAll(async () => {
	({ code } = await releaseBuild());
}, BUILD_MS);

describe('the release bundle', () => {
	it('reads no process.env, so Vue ships in production mode', () => {
		expect(code.length).toBeGreaterThan(0);
		// A count per chunk, not the chunk: a failure that printed the bundle would be 2 MB.
		const reads = code.map((text) => text.split('process.env').length - 1);

		expect(reads, 'process.env reads per emitted chunk').toEqual(code.map(() => 0));
	});
});
