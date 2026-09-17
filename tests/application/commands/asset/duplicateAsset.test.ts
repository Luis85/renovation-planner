/**
 * `DuplicateAsset` (AD13 item 4, C11) — one catalogue definition copied to a NEW identity,
 * metadata and geometry, across two resources.
 *
 * Driven through the REAL `ObsidianAssetRepository` and the REAL `ObsidianAssetGeometrySidecar`
 * over the in-memory vault, for the reason every design-command suite in this epic gives: what
 * these cases are about is the NOTE and the DOCUMENT that end up on disk, and a hand-written
 * fake would answer whatever it was told to. Each port is WRAPPED rather than replaced, so a
 * case can fail one call without losing the real vault behind every other one.
 */
import { describe, expect, it } from 'vitest';
import { DuplicateAssetCommand } from '../../../../src/application/commands/asset/DuplicateAsset';
import { leftWritesBehind } from '../../../../src/application/commands/DispatchOutcome';
import type { AssetGeometrySidecar } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { AssetRepository } from '../../../../src/application/ports/AssetRepository';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { err } from '../../../../src/core/result/Result';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { editableShape } from '../../../helpers/assetShapes';
import { expectDefined, expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';
import { createRepositoryStack } from '../../../helpers/vault';

const VAULT_FAULT = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the write failed',
} as const;

/** `editableShape` plus a group over both of its graphics — the identity graph a copy must keep. */
function groupedShape(): AssetShape {
	return editableShape({ groups: [{ id: 'group-1', label: 'body', members: ['detail-1', 'detail-2'] }] });
}

async function seeded() {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const real = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const source = expectOk(
		await stack.assets.save(
			makeAsset({ name: 'Wall oven', supplier: 'Bosch', sku: 'HBG-1', notes: 'the tall one', height: 595 }),
			'absent',
		),
	);
	const assetId = source.entity.id;

	let sidecarWriteFails = false;
	let sidecarReadFails = false;
	const sidecar: AssetGeometrySidecar = {
		read: (id) => (sidecarReadFails ? Promise.resolve(err(VAULT_FAULT)) : real.read(id)),
		write: (id, document, expected) =>
			sidecarWriteFails ? Promise.resolve(err(VAULT_FAULT)) : real.write(id, document, expected),
	};

	let noteReadFails = false;
	let deleteFails = false;
	const assets: AssetRepository = {
		getById: (id) => (noteReadFails ? Promise.resolve(err(VAULT_FAULT)) : stack.assets.getById(id)),
		listAll: () => stack.assets.listAll(),
		delete: (id, expected) => (deleteFails ? Promise.resolve(err(VAULT_FAULT)) : stack.assets.delete(id, expected)),
		save: (asset, expected) => stack.assets.save(asset, expected),
	};

	const published: string[] = [];
	for (const type of ['AssetCreated', 'AssetUpdated', 'AssetDeleted', 'AssetDesignChanged'] as const) {
		// Read the way `assetLibraryChangeSource.assetIdOf` reads it: `DomainEvent` carries only a
		// `type`, and the four asset events add the payload.
		events.subscribe(type, (event) => {
			const payload = (event as { payload?: { assetId?: string } }).payload;
			published.push(`${type}:${String(payload?.assetId)}`);
		});
	}

	return {
		stack,
		assetId,
		sidecar: real,
		published,
		duplicate: new DuplicateAssetCommand({ sidecar, assets, events, locks: new ReferenceLocks() }),
		async seedShape(shape: AssetShape | null): Promise<void> {
			expectOk(await real.write(assetId, { calibration: null, shape }));
		},
		failSidecarWrite(): void {
			sidecarWriteFails = true;
		},
		failSidecarRead(): void {
			sidecarReadFails = true;
		},
		failNoteRead(): void {
			noteReadFails = true;
		},
		failDelete(): void {
			deleteFails = true;
		},
		/** Every asset note the vault holds, which is what "did this create an orphan" asks. */
		async catalogue(): Promise<readonly AssetId[]> {
			return expectOk(await stack.assets.listAll()).loaded.map((loaded) => loaded.entity.id);
		},
	};
}

describe('DuplicateAssetCommand', () => {
	it('copies metadata and geometry to a new identity and leaves the original untouched', async () => {
		const rig = await seeded();
		await rig.seedShape(groupedShape());
		const before = expectOk(await rig.stack.assets.getById(rig.assetId));

		const copy = expectOk(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Wall oven (copy)' }));

		expect(copy.id).not.toBe(rig.assetId);
		expect(copy.name).toBe('Wall oven (copy)');
		// Every field but the two that MUST differ, compared against the SOURCE as the vault
		// actually holds it rather than against literals: the note round-trip normalises a money
		// amount (`45.00` reads back as `45`), so literals here would assert the repository's
		// formatting instead of this command's copying.
		const facts = (asset: typeof copy) => ({
			category: asset.category,
			unit: asset.unit,
			amount: asset.unitCost.amount,
			currency: asset.unitCost.currency,
			waste: asset.wasteFactorDefault.toString(),
			supplier: asset.supplier,
			sku: asset.sku,
			notes: asset.notes,
			height: asset.height,
			background: asset.background,
			planPattern: asset.planPattern,
		});
		expect(facts(copy)).toEqual(facts(expectDefined(before, 'the source asset').entity));
		expect(facts(copy).sku).toBe('HBG-1');

		// The geometry is copied VERBATIM: same detail ids, same order, same group membership,
		// same pending flags. `DuplicateAsset`'s docblock states why nothing here is remapped.
		const copied = expectOk(await rig.sidecar.read(copy.id));
		const original = expectOk(await rig.sidecar.read(rig.assetId));
		expect(copied.document).toEqual(original.document);
		expect(copied.document.shape?.details.map((detail) => detail.id)).toEqual(['detail-1', 'detail-2']);
		expect(copied.document.shape?.groups).toEqual([{ id: 'group-1', label: 'body', members: ['detail-1', 'detail-2'] }]);
		expect(copied.document.shape?.details[1].pending).toBe(true);

		// AD13 criterion 3's second half, asserted on the SOURCE rather than inferred: same
		// version means the note was not rewritten, and nothing was published about it.
		const after = expectOk(await rig.stack.assets.getById(rig.assetId));
		expect(after?.version).toStrictEqual(before?.version);
		expect(after?.entity.name).toBe('Wall oven');
		expect(rig.published).toEqual([`AssetCreated:${String(copy.id)}`]);
	});

	it('creates exactly one catalogue entry for a definition holding several graphics', async () => {
		// AD13 criterion 5, proved rather than asserted in prose: the graphics are details INSIDE
		// one shape, so duplicating a definition that holds two of them plus a group adds exactly ONE
		// purchasable asset and no per-graphic entries.
		const rig = await seeded();
		await rig.seedShape(groupedShape());

		const copy = expectOk(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Wall oven (copy)' }));

		expect(await rig.catalogue()).toEqual([rig.assetId, copy.id]);
	});

	it('writes no sidecar for a source that has none', async () => {
		const rig = await seeded();

		const copy = expectOk(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Wall oven (copy)' }));

		// An absent sidecar reads back as the empty document, so the assertion that distinguishes
		// "no file" from "an empty file" is the store's own path lookup.
		expect(rig.stack.index.getGeometrySidecarPath(copy.id)).toBeUndefined();
		expect(expectOk(await rig.sidecar.read(copy.id)).document.shape).toBeNull();
	});

	it('follows a source note that has been renamed and moved', async () => {
		// AD13 item 5: references stay correct across renamed/moved library notes. Nothing here
		// derives a path — the repository and the sidecar both resolve through the index — so the
		// assertion is that a rebuilt index is all it takes, with no reference left behind.
		const rig = await seeded();
		await rig.seedShape(groupedShape());
		const before = rig.stack.index.getPath(rig.assetId) ?? '';
		const moved = 'Renovation/Appliances/Wall oven renamed.md';
		rig.stack.vault.entries.set(moved, rig.stack.vault.entries.get(before) ?? '');
		rig.stack.vault.entries.delete(before);
		rig.stack.rebuildIndex();
		expect(rig.stack.index.getPath(rig.assetId)).toBe(moved);

		const copy = expectOk(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Wall oven (copy)' }));

		expect(expectOk(await rig.sidecar.read(copy.id)).document).toEqual(
			expectOk(await rig.sidecar.read(rig.assetId)).document,
		);
	});

	it('refuses an asset that is not there, and writes nothing', async () => {
		const rig = await seeded();

		const refusal = expectErr(await rig.duplicate.execute({ assetId: 'asset-nope' as AssetId, name: 'Copy' }));

		expect(refusal.code).toBe('asset.not-found');
		expect(await rig.catalogue()).toEqual([rig.assetId]);
	});

	it('reports a failed note read as a vault fault rather than as a missing asset', async () => {
		// C08: "A failed read is not 'asset missing'" — the relabel this repository has paid for.
		const rig = await seeded();
		rig.failNoteRead();

		const refusal = expectErr(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Copy' }));

		expect(refusal.code).toBe('vault.unexpected-failure');
	});

	it('refuses a damaged source sidecar before it writes the note', async () => {
		const rig = await seeded();
		await rig.seedShape(groupedShape());
		rig.failSidecarRead();

		const refusal = expectErr(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Copy' }));

		expect(refusal.code).toBe('vault.unexpected-failure');
		expect(await rig.catalogue()).toEqual([rig.assetId]);
		expect(rig.published).toEqual([]);
	});

	it('deletes the note it created when the sidecar write fails, leaving no orphan', async () => {
		// AD13 criterion 4, and C08's staged/recovery protocol: the cleanup touches only the note
		// this operation created, conditioned on the version its own save produced.
		const rig = await seeded();
		await rig.seedShape(groupedShape());
		rig.failSidecarWrite();

		const refusal = expectErr(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Copy' }));

		expect(refusal.code).toBe('vault.unexpected-failure');
		expect(leftWritesBehind(refusal)).toBe(false);
		expect(await rig.catalogue()).toEqual([rig.assetId]);
		// A gesture that did not happen announces nothing.
		expect(rig.published).toEqual([]);
	});

	it('stamps the refusal uncompensated when the cleanup itself fails', async () => {
		const rig = await seeded();
		await rig.seedShape(groupedShape());
		rig.failSidecarWrite();
		rig.failDelete();

		const refusal = expectErr(await rig.duplicate.execute({ assetId: rig.assetId, name: 'Copy' }));

		expect(leftWritesBehind(refusal)).toBe(true);
		// The metadata-only copy really is on disk, which is what the stamp exists to say.
		expect(await rig.catalogue()).toHaveLength(2);
	});

	it('refuses a name the domain refuses, and writes nothing', async () => {
		const rig = await seeded();
		await rig.seedShape(groupedShape());

		const refusal = expectErr(await rig.duplicate.execute({ assetId: rig.assetId, name: '   ' }));

		expect(refusal.category).toBe('Validation');
		expect(await rig.catalogue()).toEqual([rig.assetId]);
	});
});
