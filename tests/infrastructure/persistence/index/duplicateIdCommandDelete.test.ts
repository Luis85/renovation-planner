/**
 * §5.1a's promotion rule at the door a USER reaches from inside the plugin.
 *
 * Every promotion case in `excludedNotes.test.ts` drives `VaultChangeAdapter` directly —
 * `onDelete`, `onCreate`, `onModify` — which are the out-of-band doors. A duplicate winner
 * deleted through `DeleteAssetCommand` reaches the index by a different route: the repository
 * mutates it itself, so promotion has to be a property of the INDEX rather than of the
 * pipeline, and until it was the surviving note stayed unindexed until the next full rebuild.
 *
 * Asserted against what a full `rebuildIndex()` produces rather than against a hard-coded
 * path, because §5.1a's determinism rule is exactly that the incremental door and the reload
 * must not disagree about which note IS the asset — and a comparison alone would pass over two
 * builds that both lose the asset, so the rebuilt state is pinned too.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { DeleteAssetCommand } from '../../../../src/application/commands/asset/DeleteAsset';
import { RecalculateRequirementCommand } from '../../../../src/application/commands/requirement/RecalculateRequirement';
import { InMemoryAssetPriceOverrideRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';

const settled = (): Promise<void> => Promise.resolve().then(() => undefined);

/**
 * An asset saved through its repository, then COPIED at a second path — Obsidian's own
 * `Duplicate file`, which §5.1a names as the likeliest producer of a collision in a real
 * vault. The copy is planted second, so a rebuild's last-writer-wins makes it the winner and
 * the saved note the `duplicate-id` loser.
 *
 * The real pipeline is wired over the same stack, and the fake vault raises the two events
 * Obsidian raises — the rig `assetDeleteCompensation.test.ts` established, for the same
 * reason: a hand-written `index.remove(...)` would encode one reader's idea of the delete arm.
 */
async function collidingAssets() {
	const stack: RepositoryStack = createRepositoryStack();
	const saved = expectOk(await stack.assets.save(makeAsset(), 'absent'));
	const assetId = saved.entity.id;
	const originalPath = stack.index.getPath(assetId) ?? '';
	const copyPath = `${stack.libraryFolder}/Tile 1.md`;
	stack.vault.entries.set(copyPath, stack.vault.entries.get(originalPath) ?? '');
	stack.metadataCache.catchUp();
	stack.rebuildIndex();

	const adapter = new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		events: createEventBus(() => undefined),
		logger: stack.logger,
		debounceMs: 0,
	});
	type Deleted = Parameters<typeof stack.vault.delete>[0];
	const removeFile = stack.vault.delete.bind(stack.vault);
	stack.vault.delete = async (file: Deleted): Promise<void> => {
		await removeFile(file);
		if (file instanceof TFile) adapter.onDelete(file);
	};
	const createFile = stack.vault.create.bind(stack.vault);
	stack.vault.create = async (path: string, data: string): Promise<TFile> => {
		const created = await createFile(path, data);
		adapter.onCreate(created);
		return created;
	};

	const events = createEventBus(() => undefined);
	const overrides = new InMemoryAssetPriceOverrideRepository();
	const deleteAsset = new DeleteAssetCommand({
		assets: stack.assets,
		requirements: stack.requirements,
		recalculate: new RecalculateRequirementCommand({
			requirements: stack.requirements,
			zones: stack.zones,
			assets: stack.assets,
			events,
			projects: stack.projects,
			overrides,
		}),
		events,
		locks: new ReferenceLocks(),
		logger: stack.logger,
		overrides,
	});

	return { stack, assetId, version: saved.version, originalPath, copyPath, deleteAsset };
}

describe('a duplicate-id delete driven by a command', () => {
	it('promotes the surviving claimant the next rebuild would pick', async () => {
		const { stack, assetId, originalPath, copyPath, deleteAsset } = await collidingAssets();
		// The copy was planted last, so it is the entry and the saved note is the loser.
		expect(stack.index.getPath(assetId)).toBe(copyPath);

		expectOk(await deleteAsset.execute({ assetId }));
		await settled();

		const incremental = {
			path: stack.index.getPath(assetId),
			exclusions: [...stack.index.listExclusions()],
		};
		stack.rebuildIndex();
		const rebuilt = { path: stack.index.getPath(assetId), exclusions: [...stack.index.listExclusions()] };

		// Both halves: the two doors agree, AND what they agree on is the surviving note.
		expect(incremental).toEqual(rebuilt);
		expect(rebuilt).toEqual({ path: originalPath, exclusions: [] });
	});
});

describe("a duplicate winner's delete that refuses after the trash", () => {
	/**
	 * The ROLLBACK door, and the same seam: the compensation puts the winner's entry back
	 * through the index, and the entry it displaces is the loser the vault's own delete event
	 * had just promoted. Through the raw port that loser left the entries and gained no
	 * descriptor — in neither collection, so the repair strip could not even name the file.
	 */
	it('demotes the promoted loser back to a duplicate-id descriptor', async () => {
		const { stack, assetId, version, originalPath, copyPath } = await collidingAssets();
		const sidecarPath = assetSidecarPathFor(stack.libraryFolder, assetId);
		const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
		expectOk(await sidecar.write(assetId, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));
		stack.vault.failures.add(`delete:${sidecarPath}`);

		expect(expectErr(await stack.assets.delete(assetId, version)).code).toBe('asset.delete-failed');
		await settled();

		// The winner is back, so the loser is a loser again — and says so.
		expect(stack.index.getPath(assetId)).toBe(copyPath);
		expect(stack.index.listExclusions()).toEqual([
			{ path: originalPath, entityType: 'renovation-asset', reason: 'duplicate-id' },
		]);
	});
});
