import type { VaultSurface } from './plugin';
import type { FixtureStack } from './fixtureVault';
import type { RepositoryStack } from './vault';
import type { DiagnosticsLedger } from '../../src/application/ports/diagnostics';
import type { Logger as PortLogger } from '../../src/application/ports/Logger';

/**
 * Two ambient augmentations of `./vault` and `./logger` — neither edits the file it
 * augments, and both state a shape those files already have at RUNTIME.
 *
 * `RepositoryStack` below is the first type this program has ever pulled from
 * `tests/helpers/vault.ts` — `tests/**` is normally transpiled without checking, and no
 * earlier `*.test-d.ts` named it. Doing so type-checks that file in full for the first
 * time and surfaces two pre-existing mismatches between its ANNOTATIONS and its CODE,
 * neither reachable through `mustHaveSurface`, `getAbstractFileByPath` or `createFolder`
 * — the three propagations Step 1b already names for `plugin.ts`:
 *
 *  - `vault.ts` imports `{ Line, Logger }` from `./logger`, but `./logger` only EXPORTS
 *    `Line` — its own `Logger` import is a local, unexported binding. `logger: Logger` on
 *    `RepositoryStack` is real at runtime (every suite reading `stack.logger` proves it),
 *    so this augmentation states what `./logger` already provides rather than inventing
 *    one.
 *  - `createRepositoryStack`'s returned object literal includes `ledger`, which
 *    `RepositoryStack` does not declare — the exact gap `fixtureVault.ts`'s own header
 *    already documents ("Not in `RepositoryStack`'s own declared shape either … `tests/**`
 *    is untyped, so this mirrors what that function actually hands back rather than what
 *    its type happens to name"). `FixtureStack` carries the identical field.
 *
 * `tests/helpers/vault.ts` is out of scope for this task — a different, in-flight change
 * owns it — so both are stated here rather than corrected at their source.
 */
declare module './logger' {
	export type Logger = PortLogger;
}
declare module './vault' {
	interface RepositoryStack {
		ledger: DiagnosticsLedger;
	}
}

/**
 * The structural vault surface, proven at COMPILE TIME — the only place it can be proven.
 *
 * `VaultSurface` was widened from a `Pick` over `FakeVault`'s classes so slice 12's
 * disk-backed adapter can satisfy it too. Nothing at runtime can check that, and
 * `npm run build` does not reach either helper, so without this file the widening is a
 * claim in a comment.
 *
 * BOTH directions, because each half fails differently: the fixture adapter satisfying the
 * surface is the new capability, and `RepositoryStack` still satisfying it is what says the
 * widening broke no existing caller.
 */
const fixtureSatisfies: VaultSurface = null as unknown as Pick<FixtureStack, 'vault' | 'fileManager' | 'metadataCache'>;
const fakeStillSatisfies: VaultSurface = null as unknown as Pick<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'>;

void fixtureSatisfies;
void fakeStillSatisfies;
