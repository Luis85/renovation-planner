/**
 * `ListCatalogueEntries` — the Asset Library's own read (design "Asset library overview"
 * §5.1), against a full repository stack rather than a hand-built double: two of the three
 * `unreadable` sources (§5.1a) are decided by the real index SCAN — `entityRefOf` and
 * `collectNotes`'s last-writer-wins map — and nothing short of the real pipeline can produce
 * a `no-id` or `duplicate-id` exclusion honestly.
 */
import { describe, expect, it } from 'vitest';
import { ListCatalogueEntries } from '../../../src/application/queries/ListCatalogueEntries';
import { createRepositoryStack, type RepositoryStack } from '../../helpers/vault';
import { expectOk } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import type { AssetId } from '../../../src/domain/asset/AssetId';

function listCatalogue(stack: RepositoryStack) {
	return new ListCatalogueEntries(stack.assets, stack.index).execute();
}

/** A note planted straight into the vault, the way sync or the file explorer does — modelled
 * on `excludedNotes.test.ts`'s own `plant`. */
function plant(stack: RepositoryStack, path: string, frontmatter: string): void {
	stack.vault.entries.set(path, `---\n${frontmatter}\n---\n`);
	stack.metadataCache.catchUp();
}

/** A real note, corrupted at `schema-version` so it refuses as
 * `asset.schema-version-unsupported` — copied from
 * `assetRepositoryListing.test.ts`'s own seed rather than re-derived. */
async function seedUnreadableFutureSchema(
	stack: RepositoryStack,
): Promise<{ assetId: AssetId; path: string }> {
	const written = expectOk(await stack.assets.save(makeAsset({ name: 'Unreadable' }), 'absent'));
	const path = stack.index.getPath(written.entity.id) ?? '';
	stack.vault.entries.set(
		path,
		(stack.vault.entries.get(path) ?? '').replace('schema-version: 1', 'schema-version: 99'),
	);
	return { assetId: written.entity.id, path };
}

describe('ListCatalogueEntries', () => {
	it('answers an empty library with no entries and nothing unreadable', async () => {
		const stack = createRepositoryStack();

		expect(expectOk(await listCatalogue(stack))).toEqual({ entries: [], unreadable: [] });
	});

	it('maps every field of a loaded asset into its DTO', async () => {
		const stack = createRepositoryStack();
		const saved = expectOk(
			await stack.assets.save(
				makeAsset({
					name: 'Porcelain Terrace Tile',
					supplier: 'Acme Supply',
					sku: 'PT-100',
					height: 12,
					notes: 'Fragile edges',
				}),
				'absent',
			),
		);

		const listing = expectOk(await listCatalogue(stack));

		expect(listing.entries).toEqual([
			{
				assetId: saved.entity.id,
				name: 'Porcelain Terrace Tile',
				category: 'material',
				unit: 'm2',
				unitCostAmount: '45',
				currency: 'EUR',
				wasteFactorDefault: '0.1',
				supplier: 'Acme Supply',
				sku: 'PT-100',
				height: 12,
				notes: 'Fragile edges',
				background: null,
			},
		]);
		expect(listing.unreadable).toEqual([]);
	});

	describe('the three sources that feed `unreadable`', () => {
		it('reports a note whose body would not read, with its id, path and refusal code', async () => {
			const stack = createRepositoryStack();
			const bad = await seedUnreadableFutureSchema(stack);

			const listing = expectOk(await listCatalogue(stack));

			expect(listing.entries).toEqual([]);
			expect(listing.unreadable).toEqual([
				{
					assetId: bad.assetId,
					path: bad.path,
					reason: 'read-failed',
					code: 'asset.schema-version-unsupported',
				},
			]);
		});

		it('reports an asset note with no usable id, with a null id and code', async () => {
			const stack = createRepositoryStack();
			plant(stack, 'Library/broken.md', 'type: renovation-asset');
			stack.rebuildIndex();

			const listing = expectOk(await listCatalogue(stack));

			expect(listing.entries).toEqual([]);
			expect(listing.unreadable).toEqual([
				{ assetId: null, path: 'Library/broken.md', reason: 'no-id', code: null },
			]);
		});

		it('reports the loser of a duplicate asset id, with a null id and code', async () => {
			// Two well-formed asset notes made to declare the SAME id, rather than two bare
			// fixtures — so the winner reads cleanly and the only thing under test is the
			// exclusion, with no `read-failed` noise from a note this test never meant to be
			// broken. `collectNotes` is last-writer-wins in scan (insertion) order, so the
			// note saved SECOND keeps its own id and the one saved first is overwritten onto
			// it, making the first the loser.
			const stack = createRepositoryStack();
			const first = expectOk(await stack.assets.save(makeAsset({ name: 'First' }), 'absent'));
			const second = expectOk(await stack.assets.save(makeAsset({ name: 'Second' }), 'absent'));
			const firstPath = stack.index.getPath(first.entity.id) ?? '';
			const secondPath = stack.index.getPath(second.entity.id) ?? '';
			stack.vault.entries.set(
				secondPath,
				(stack.vault.entries.get(secondPath) ?? '').replace(
					`id: "${second.entity.id}"`,
					`id: "${first.entity.id}"`,
				),
			);
			stack.rebuildIndex();

			const listing = expectOk(await listCatalogue(stack));

			expect(listing.entries).toEqual([
				expect.objectContaining({ assetId: first.entity.id, name: 'Second' }),
			]);
			expect(listing.unreadable).toEqual([
				{ assetId: null, path: firstPath, reason: 'duplicate-id', code: null },
			]);
			// Guards the fixture itself: if this ever stopped colliding, the assertions above
			// would pass vacuously on two independent, unrelated assets.
			expect(firstPath).not.toBe(secondPath);
		});

		it('leaves a project note with no id out of the asset catalogue', async () => {
			// The Project Index is one global id namespace — without the `renovation-asset`
			// filter this note would inflate the library's unreadable count and appear in its
			// repair strip.
			const stack = createRepositoryStack();
			plant(stack, 'Renovation/A/Project.md', 'type: renovation-project');
			stack.rebuildIndex();

			const listing = expectOk(await listCatalogue(stack));

			expect(listing.unreadable).toEqual([]);
		});
	});

	it('merges all three sources beside the notes that loaded fine', async () => {
		const stack = createRepositoryStack();
		const good = expectOk(await stack.assets.save(makeAsset({ name: 'Good Tile' }), 'absent'));
		const bad = await seedUnreadableFutureSchema(stack);
		plant(stack, 'Library/broken.md', 'type: renovation-asset');
		// Same colliding-id shape the dedicated case above uses, so the winner reads cleanly
		// and only the loser is reported.
		const dupFirst = expectOk(await stack.assets.save(makeAsset({ name: 'Dup First' }), 'absent'));
		const dupSecond = expectOk(await stack.assets.save(makeAsset({ name: 'Dup Second' }), 'absent'));
		const dupFirstPath = stack.index.getPath(dupFirst.entity.id) ?? '';
		const dupSecondPath = stack.index.getPath(dupSecond.entity.id) ?? '';
		stack.vault.entries.set(
			dupSecondPath,
			(stack.vault.entries.get(dupSecondPath) ?? '').replace(
				`id: "${dupSecond.entity.id}"`,
				`id: "${dupFirst.entity.id}"`,
			),
		);
		// A project note with no id, present to prove it does not leak into this surface.
		plant(stack, 'Renovation/A/Project.md', 'type: renovation-project');
		stack.rebuildIndex();

		const listing = expectOk(await listCatalogue(stack));

		expect(listing.entries).toHaveLength(2);
		expect(listing.entries.map((entry) => entry.assetId)).toEqual(
			expect.arrayContaining([good.entity.id, dupFirst.entity.id]),
		);
		expect(listing.unreadable).toHaveLength(3);
		expect(listing.unreadable).toEqual(
			expect.arrayContaining([
				{ assetId: bad.assetId, path: bad.path, reason: 'read-failed', code: 'asset.schema-version-unsupported' },
				{ assetId: null, path: 'Library/broken.md', reason: 'no-id', code: null },
				{ assetId: null, path: dupFirstPath, reason: 'duplicate-id', code: null },
			]),
		);
	});
});
