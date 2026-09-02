/**
 * @vitest-environment node
 *
 * Where an asset's geometry sidecar IS, once a user has moved it.
 *
 * ADR-0014 gives an asset's `.rpgeo` a derived home under `<libraryFolder>/Geometry/`, and
 * `AssetGeometryStore.pathFor` derived it on every read and every write — so a sidecar moved in
 * Obsidian's file explorer or arriving somewhere else through sync left the asset reading as
 * SHAPELESS, and the next design write created a second sidecar at the derived path beside the
 * orphan. A traced footprint disappears and an empty one takes its place, silently, with no
 * refusal anywhere: an absent asset sidecar is the ordinary state of an undesigned asset, so
 * nothing about the read looks wrong.
 *
 * The same ADR asks that resolution go through the index "as it does for plan sidecars", which
 * is ADR-011's rule and was recorded as unbuilt in three places. This is that increment, and
 * `pathFor` is the seam its own docblock reserved: `index.getGeometrySidecarPath(id) ?? derived`
 * — the index first, the derivation as the repair path for a damaged index.
 */
import { describe, expect, it } from 'vitest';
import { TFile } from 'obsidian';
import { createRepositoryStack, type RepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { shapeFromDimensions } from '../../../../src/domain/asset/AssetShape';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { createEventBus } from '../../../../src/core/events/EventBus';

/**
 * A user MOVES a file; they do not rename it. The join is by basename — a sidecar's basename
 * IS its entity id (ADR-011 for a plan, ADR-0014 for an asset) — so a fixture that renamed as
 * well as moved would be testing an orphan rather than a move, and would fail against a correct
 * build for the wrong reason. It did, on the first run.
 */
const MOVED_FOLDER = 'Elsewhere';

async function designedAsset() {
	const stack: RepositoryStack = createRepositoryStack();
	const asset = makeAsset();
	expectOk(await stack.assets.save(asset, 'absent'));
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	expectOk(await sidecar.write(asset.id, { calibration: null, shape: expectOk(shapeFromDimensions(1200, 800)) }));

	const adapter = new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		events: createEventBus(() => undefined),
		logger: stack.logger,
		debounceMs: 0,
	});

	return { stack, asset, sidecar, adapter, derived: assetSidecarPathFor(stack.libraryFolder, asset.id) };
}

/** What Obsidian does to the vault when a user drags a file, plus the event it then raises. */
async function moveFile(stack: RepositoryStack, adapter: VaultChangeAdapter, from: string, to: string): Promise<void> {
	const text = stack.vault.entries.get(from) ?? '';
	stack.vault.entries.delete(from);
	await stack.vault.createFolder(to.slice(0, to.lastIndexOf('/')));
	await stack.vault.create(to, text);
	const moved = stack.vault.getAbstractFileByPath(to);
	if (!(moved instanceof TFile)) throw new Error(`the fake vault did not create ${to}`);
	adapter.onRename(moved, from);
}

describe('an asset sidecar the user has moved', () => {
	it('is still the asset’s shape, read through the mapping the pipeline recorded', async () => {
		const { stack, asset, sidecar, adapter, derived } = await designedAsset();
		expect(stack.vault.entries.has(derived)).toBe(true);

		await moveFile(stack, adapter, derived, `${MOVED_FOLDER}/${asset.id}.rpgeo`);

		const read = expectOk(await sidecar.read(asset.id));
		expect(read.document.shape).not.toBeNull();
	});

	/**
	 * The second half of the reported defect, and the destructive one: without the mapping the
	 * next write derives the original path and mints a SECOND sidecar, leaving the moved file
	 * behind as an orphan that every later library migration carries.
	 */
	it('is written back where it now sits, rather than minting a second one', async () => {
		const { stack, asset, sidecar, adapter, derived } = await designedAsset();
		await moveFile(stack, adapter, derived, `${MOVED_FOLDER}/${asset.id}.rpgeo`);

		const current = expectOk(await sidecar.read(asset.id));
		expectOk(await sidecar.write(asset.id, { ...current.document, calibration: null }, current.version));

		expect(stack.vault.entries.has(derived)).toBe(false);
		expect(stack.vault.entries.has(`${MOVED_FOLDER}/${asset.id}.rpgeo`)).toBe(true);
	});

	/**
	 * The derivation is the REPAIR path, not a fallback nobody reaches: an asset whose sidecar
	 * the index has never seen must still resolve, which is every asset on a build whose index
	 * predates this mapping and every asset before its first scan.
	 */
	it('falls back to the derived path when the index holds no mapping', async () => {
		const { stack, asset, derived } = await designedAsset();
		// The index has never been told about this file: it was written before any scan and no
		// rename event has run, which is every asset on a build whose index predates the mapping.
		expect(stack.index.getGeometrySidecarPath(asset.id)).toBeUndefined();

		const read = expectOk(await stack.assetGeometry.read(asset.id));

		expect(read.path).toBe(derived);
	});
});
