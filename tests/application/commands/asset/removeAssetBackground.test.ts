/**
 * `SetAssetBackground`'s REMOVAL arm (AD12-R2) — `path: null`, the same command that replaces a
 * reference rather than a second one beside it.
 *
 * Driven through the REAL `ObsidianAssetRepository` and the REAL `ObsidianAssetGeometrySidecar`
 * over the in-memory vault, for `setAssetBackground.test.ts`'s reason: what these cases are about
 * is the NOTE and the DOCUMENT that end up on disk.
 *
 * **What is deliberately NOT re-tested here**, because it is the same code and not a second copy
 * of it: the compensation when the note write fails, its uncompensated arm, and the locking. The
 * removal arm resolves its reference and then enters `write()` at exactly the line the replacement
 * arm does — `sameBackground`, the calibration clear, the compensation and both version reports
 * are one path from there down, already covered per-line by `setAssetBackground.test.ts`. A
 * duplicate suite would report the same lines twice and would go green on the day they diverge.
 * What IS about the removal arm specifically is everything below: where it sits relative to the
 * two path-shaped refusals, what it does to the calibration, and what it does NOT do to the
 * pending flags.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetBackgroundCommand } from '../../../../src/application/commands/asset/SetAssetBackground';
import type { VaultFileProbe } from '../../../../src/application/ports/VaultFileProbe';
import { createEventBus } from '../../../../src/core/events/EventBus';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { Calibration } from '../../../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const SHEET = 'Specs/oven.pdf';

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

/** A traced shape with every coordinate group still in the sheet's own pixels. */
function pendingShape(): AssetShape {
	return {
		footprint: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }] },
		footprintOrigin: 'traced',
		footprintPending: true,
		clearance: { points: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 80 }] },
		clearancePending: true,
		anchor: { x: 0, y: 0 },
		anchorPending: true,
		facing: 0,
		details: [{ id: 'd1', name: 'top', outline: { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] }, line: 'solid', pending: true }],
	};
}

/**
 * An asset already pointing at `SHEET`, seeded THROUGH the command rather than by hand, so a case
 * about removal starts from a state this very command produced.
 *
 * `present` is mutable on purpose: it is what lets a case delete the sheet out from under the
 * reference, which is the one state the removal gesture exists to repair.
 */
async function seeded(shape: AssetShape | null = null) {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const written = expectOk(await stack.assets.save(makeAsset(), 'absent'));
	const assetId = written.entity.id;

	const present = new Set<string>([SHEET]);
	const files: VaultFileProbe = { fileExists: (path) => present.has(path) };
	const command = new SetAssetBackgroundCommand({ sidecar, assets: stack.assets, events, locks: new ReferenceLocks() }, files);

	expectOk(await sidecar.write(assetId, { calibration: null, shape }));
	expectOk(await command.execute({ assetId, path: SHEET, kind: 'pdf', page: 2 }));
	const held = expectOk(await sidecar.read(assetId));
	expectOk(await sidecar.write(assetId, { ...held.document, calibration: CALIBRATION }, held.version));

	return {
		assetId,
		command,
		/** The sheet is deleted from the vault's point of view, leaving the reference dangling. */
		deleteSheet: (): void => {
			present.delete(SHEET);
		},
		async background() {
			const loaded = expectOk(await stack.assets.getById(assetId));
			if (loaded === null) throw new Error('expected the asset to be present');
			return loaded.entity.background;
		},
		document: async () => expectOk(await sidecar.read(assetId)).document,
	};
}

describe('SetAssetBackground, removing a reference', () => {
	it('takes the reference off the note and clears the scale measured off it', async () => {
		const seed = await seeded();

		expect(expectOk(await seed.command.execute({ assetId: seed.assetId, path: null }))).toBe('wrote');

		expect(await seed.background()).toBeNull();
		// A scale measured off a document that is no longer referenced names nothing at all
		// (AD12-R2) — the same clear a REPLACEMENT makes, for a sharper reason.
		expect((await seed.document()).calibration).toBeNull();
	});

	/**
	 * **The arm sits ABOVE both path-shaped pre-read refusals, and this is the case that pins it
	 * there.** `backgroundKindOf` and `files.fileExists` each ask about a path and a removal names
	 * none — and the `fileExists` guard deliberately refuses a re-submit of a reference whose file
	 * has gone, which is exactly the state this gesture exists to repair. Below that guard, this
	 * would answer `asset.background-not-found` and leave the user with a dangling reference and no
	 * way to drop it.
	 */
	it('succeeds when the referenced file has already been deleted', async () => {
		const seed = await seeded();
		seed.deleteSheet();

		expect(expectOk(await seed.command.execute({ assetId: seed.assetId, path: null }))).toBe('wrote');
		expect(await seed.background()).toBeNull();
	});

	/**
	 * The removal arm reaches `sameBackground(null, null)` and stops there, so a second press
	 * writes nothing and pushes no history entry — the same no-write a re-submitted reference
	 * takes. No control reaches this anyway (`DesignerReferenceStatus` draws the button only while
	 * there is a reference), which is what makes this the belt rather than the braces.
	 */
	it('writes nothing for an asset that has no reference', async () => {
		const seed = await seeded();
		expectOk(await seed.command.execute({ assetId: seed.assetId, path: null }));
		const before = await seed.document();

		expect(expectOk(await seed.command.execute({ assetId: seed.assetId, path: null }))).toBe('no-write');
		expect(await seed.document()).toEqual(before);
	});

	/**
	 * **The pending flags are UNTOUCHED** (AD12-R2). Coordinates captured in background pixels are
	 * still in background pixels once the picture is taken away; clearing a flag here would present
	 * placeholder geometry as measured, which is the one unsafe direction of those flags.
	 *
	 * **And the guarantee is STRUCTURAL rather than conditional**, which is worth knowing before
	 * anyone widens this command: the flags live on the SIDECAR's shape, and this command's only
	 * sidecar write is `{ ...document, calibration: null }`. Measured while watching this case
	 * fail — clearing them through `Asset.withChanges` left it GREEN, because the note carries no
	 * shape at all; it reddens only when the sidecar write is the thing that touches them. So the
	 * case is honest about the write it is really guarding.
	 */
	it('leaves every per-group pending flag exactly as it was', async () => {
		const seed = await seeded(pendingShape());

		expectOk(await seed.command.execute({ assetId: seed.assetId, path: null }));

		const shape = (await seed.document()).shape;
		expect(shape).not.toBeNull();
		expect(shape?.footprintPending).toBe(true);
		expect(shape?.clearancePending).toBe(true);
		expect(shape?.anchorPending).toBe(true);
		expect(shape?.details[0]?.pending).toBe(true);
	});
});
