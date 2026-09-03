import { describe, expect, it } from 'vitest';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

/**
 * §5.1a: `AssetRepository.listAll()` reports the notes it SKIPPED, not only the ones it
 * loaded. The ids and the path are already in hand at the point of the skip — this is a
 * wider return, not new bookkeeping — and the second case below is what tells an
 * all-unreadable library from an empty one, which a bare `loaded: []` cannot.
 */

/** A real note, corrupted at `schema-version` so it refuses as `asset.schema-version-unsupported`
 * rather than at `type` or `id` — the future-schema case §4's repair strip needs to tell apart
 * from an ordinary frontmatter defect. */
async function seedUnreadableFutureSchema(stack: RepositoryStack) {
	const written = expectOk(await stack.assets.save(makeAsset({ name: 'Unreadable' }), 'absent'));
	const path = stack.index.getPath(written.entity.id) ?? '';
	stack.vault.entries.set(
		path,
		(stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: 99'),
	);
	return { assetId: written.entity.id, path };
}

describe('ObsidianAssetRepository.listAll — skipped notes', () => {
	it('reports a note it could not read, with its id, its path and the refusal code', async () => {
		const stack = createRepositoryStack();
		const good = expectOk(await stack.assets.save(makeAsset({ name: 'Good Tile' }), 'absent'));
		const bad = await seedUnreadableFutureSchema(stack);

		const listing = expectOk(await stack.assets.listAll());

		expect(listing.loaded.map((l) => l.entity.id)).toEqual([good.entity.id]);
		// The exact code `MigrationRunner.migrateToLatest` mints for a future schema version —
		// seeded through the real repository rather than hand-picked, so the assertion
		// protects the behaviour rather than a literal somebody guessed.
		expect(listing.skipped).toEqual([
			{ assetId: bad.assetId, code: 'asset.schema-version-unsupported', path: bad.path },
		]);
	});

	it('answers an empty listing with no skips for an empty library', async () => {
		const stack = createRepositoryStack();
		expect(expectOk(await stack.assets.listAll())).toEqual({ loaded: [], skipped: [] });
	});
});
