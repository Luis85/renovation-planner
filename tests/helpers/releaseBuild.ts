import path from 'node:path';
import { build } from 'vite';
import type { Rolldown } from 'vite';
import { toPosix } from './posix';
import { REPO } from './repo';

/**
 * The release bundle, built in memory from `vite.config.ts` — what the two gates that ask the
 * EMITTED plugin a question share (`prototypes-not-bundled.test.ts`: which modules composed it;
 * `release-bundle.test.ts`: what its code reads).
 *
 * `write: false` — the modules that composed each chunk are in the returned output, so nothing
 * is emitted to disk and this does not race `npm run build`'s own `dist/`.
 *
 * Memoised per module registry: the `build` project runs `tests/gates/` with `isolate: false`,
 * so two gates that land in one worker pay for one build, and two that do not pay for two.
 *
 * `Rolldown` comes from `vite` itself (`node_modules/vite/dist/node/index.d.ts` re-exports
 * it), not from `rollup`: this repo's Vite (`^8`) bundles with Rolldown, and `rollup` is not
 * an installed dependency here at all — importing `RollupOutput` from it would fail the
 * type-check and `npm run analyze`'s unlisted-dependency scan alike.
 */
export const BUILD_MS = 120_000;

export interface ReleaseBuild {
	/** Every chunk's module ids, absolute and forward-slashed so they read the same on Windows. */
	readonly modules: readonly string[];
	/** Every chunk's emitted code, one entry per chunk. */
	readonly code: readonly string[];
}

let pending: Promise<ReleaseBuild> | undefined;

export function releaseBuild(): Promise<ReleaseBuild> {
	pending ??= buildRelease();
	return pending;
}

async function buildRelease(): Promise<ReleaseBuild> {
	const result = (await build({
		configFile: path.resolve(REPO, 'vite.config.ts'),
		root: REPO,
		build: { write: false },
		logLevel: 'error',
	})) as Rolldown.RolldownOutput | Rolldown.RolldownOutput[];

	const output = Array.isArray(result) ? result[0] : result;
	// EVERY chunk, not the first. A dynamic import — the exact route the prototypes gate exists
	// to catch, since lint cannot see it — is what Rolldown most likely emits as a SEPARATE
	// chunk, so inspecting `output[0]` alone would leave the interesting case unexamined while
	// looking thorough.
	const chunks = output.output.filter((part): part is Rolldown.OutputChunk => part.type === 'chunk');

	if (chunks.length === 0) throw new Error('the build produced no chunk to inspect');

	return {
		modules: chunks.flatMap((chunk) => Object.keys(chunk.modules).map((id) => toPosix(id))),
		code: chunks.map((chunk) => chunk.code),
	};
}
