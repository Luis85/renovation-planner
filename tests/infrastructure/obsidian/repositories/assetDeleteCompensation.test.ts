/**
 * `trashNoteBackedEntity`'s compensation against the pipeline that is running BESIDE it.
 *
 * Its own docblock says the index entry "survives such a refusal untouched", and that is a
 * claim about what the FUNCTION does — it removes the entry only on success. It is not a claim
 * about the vault, and Obsidian is the other writer: trashing the note raises a delete event,
 * `VaultChangeAdapter.processPath` finds no `TFile` at the path and takes the entry out along
 * with the echo record, and only then does `alsoRemove` refuse. `restoreNoteText` puts the
 * BYTES back, and without this file nothing put the rest back — so every read, all of which
 * resolve through the index, missed an asset whose deletion had REPORTED FAILURE. A refusal
 * that leaves the entity unreachable is the "partly done" (SDD §42) the compensation exists to
 * rule out, arriving through the one door the compensation does not own.
 *
 * Its own file rather than `assetGeometrySidecar.test.ts`'s, which it outgrew: the subject is
 * the shared delete sequence meeting the vault-change pipeline, and the asset's sidecar is
 * merely the only `alsoRemove` that exists to drive it with.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { createEventBus } from '../../../../src/core/events/EventBus';

/**
 * A saved asset with the real pipeline wired over the same stack, and the fake vault taught to
 * raise the two events Obsidian raises. Driven through the REAL `VaultChangeAdapter` rather
 * than a hand-written `index.remove(...)`, so this cannot encode one reader's idea of what the
 * delete arm does.
 *
 * `debounceMs: 0` is what puts the event inside the window. Obsidian's own debounce is 500ms
 * and the race is real either way — a delete event flushed by any later path, or a sidecar
 * removal slower than the debounce.
 */
async function racingStack() {
	const stack: RepositoryStack = createRepositoryStack();
	const asset = makeAsset();
	const saved = expectOk(await stack.assets.save(asset, 'absent'));
	const adapter = new VaultChangeAdapter({
		// `as never` for the two host fakes and a real bus with no subscribers, which is
		// `branches.test.ts`'s own spelling for building this adapter over a stack.
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

	return {
		stack,
		asset,
		version: saved.version,
		notePath: stack.index.getPath(asset.id) ?? '',
		sidecarPath: assetSidecarPathFor(stack.libraryFolder, asset.id),
		sidecar: new ObsidianAssetGeometrySidecar(stack.assetGeometry),
	};
}

describe('a compensated asset delete survives the pipeline seeing the trash', () => {
	/**
	 * Asserted on READABILITY rather than on the index alone, because that is the consequence
	 * a user has: a note on disk that nothing can open is not a delete that failed cleanly.
	 *
	 * Both halves of the fix are load-bearing and each was measured alone. Without the entry
	 * the note sits there unreachable. Without the echo mark the RESTORE's own create event is
	 * read inside Obsidian's parse lag, where the cache has no entry and `frontmatterOf` has no
	 * echo to fall back on — so the note reads as none of ours and the entry just put back is
	 * taken out again, with no later event to repair it.
	 */
	it('leaves the asset readable when the sidecar refuses after the delete event lands', async () => {
		const { stack, asset, version, notePath, sidecarPath, sidecar } = await racingStack();
		expectOk(await sidecar.write(asset.id, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));
		stack.vault.failures.add(`delete:${sidecarPath}`);

		expect(expectErr(await stack.assets.delete(asset.id, version)).code).toBe('asset.delete-failed');

		expect(stack.index.getPath(asset.id)).toBe(notePath);
		expect(expectOk(await stack.assets.getById(asset.id))).not.toBeNull();
	});
});
