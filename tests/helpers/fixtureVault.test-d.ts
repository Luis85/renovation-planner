import type { VaultSurface } from './plugin';
import type { FixtureStack } from './fixtureVault';
import type { RepositoryStack } from './vault';

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
 *
 * `RepositoryStack` is the first type this program has ever pulled from
 * `tests/helpers/vault.ts` — `tests/**` is normally transpiled without checking, and no
 * earlier `*.test-d.ts` named it. Doing so type-checks that file in full for the first time,
 * which is what caught two pre-existing mismatches between its ANNOTATIONS and its CODE:
 * `./logger` re-exporting `Logger` (`tests/helpers/logger.ts`) and `RepositoryStack`
 * declaring `ledger` (`tests/helpers/vault.ts`) — both fixed at their source rather than
 * augmented around here, once the merge-conflict reason for treating `vault.ts` as
 * off-limits no longer applied.
 */
const fixtureSatisfies: VaultSurface = null as unknown as Pick<FixtureStack, 'vault' | 'fileManager' | 'metadataCache'>;
const fakeStillSatisfies: VaultSurface = null as unknown as Pick<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'>;

void fixtureSatisfies;
void fakeStillSatisfies;
