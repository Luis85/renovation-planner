/**
 * AD14-R1's clear-the-flag rule at the COMMAND layer, driven through the real sidecar port over the
 * in-memory vault for `setAssetAttributes.test.ts`'s reason: what these cases are about is the
 * document that ends up in the file, and a hand-written fake sidecar would have answered whatever
 * it was told to.
 *
 * **Which commands are here, and why this list rather than a longer one.** The ruling states the
 * rule — *cleared by any write whose SUBJECT is the clearance itself* — and deliberately not a list,
 * and it names the instrument for obtaining one:
 * `grep -rn "clearance" src/domain/asset/shapeEdits.ts src/application/commands/asset/`. Run in the
 * implementing edit, that grep printed writes in exactly three application-layer files —
 * `SetAssetClearance` (both arms), `SetAssetFootprint` (`InheritedShape` and `UNDESIGNED`) and
 * `CalibrateAsset` (`rescaled`) — and the three get different answers, which is why all three have
 * cases below rather than only the obvious one. The ruling's own example list named
 * `SetAssetClearance` and omitted `SetAssetFootprint`; the grep did not.
 *
 * The domain half of that same grep — `mapPartOutline`, `withOutline` and `removeClearance` — is
 * driven in `tests/domain/asset/shapeEdits.test.ts`, where those functions live.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetClearanceCommand } from '../../../../src/application/commands/asset/SetAssetClearance';
import { SetAssetFootprintCommand } from '../../../../src/application/commands/asset/SetAssetFootprint';
import { CalibrateAssetCommand } from '../../../../src/application/commands/asset/CalibrateAsset';
import type { Point } from '../../../../src/core/geometry/Point';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const SQUARE: readonly Point[] = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
const BOUNDARY: readonly Point[] = [{ x: -50, y: -50 }, { x: 150, y: -50 }, { x: 150, y: 150 }, { x: -50, y: 150 }];
const WIDER: readonly Point[] = [{ x: -80, y: -80 }, { x: 180, y: -80 }, { x: 180, y: 180 }, { x: -80, y: 180 }];

/** A measured design whose authored boundary has been flagged for review by a resize. */
const flagged = (): AssetShape => ({
	footprint: { points: [...SQUARE] },
	footprintOrigin: 'typed',
	footprintPending: false,
	clearancePending: false,
	anchorPending: false,
	clearance: { points: [...BOUNDARY] },
	clearanceNeedsReview: true,
	anchor: { x: 0, y: 0 },
	facing: 0,
	details: [],
});

async function seeded() {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const deps = { sidecar, assets: stack.assets, events: createEventBus(), locks: new ReferenceLocks() };
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	expectOk(await sidecar.write(assetId, { calibration: null, shape: flagged() }));
	return {
		assetId,
		clearance: new SetAssetClearanceCommand(deps),
		footprint: new SetAssetFootprintCommand(deps),
		calibrate: new CalibrateAssetCommand(deps),
		async storedShape(): Promise<AssetShape> {
			const read = expectOk(await sidecar.read(assetId)).document.shape;
			return expectDefined(read, 'the stored shape');
		},
	};
}

describe('the clearance review flag across the design commands', () => {
	it('comes down when a new boundary is traced, because that write IS the review', async () => {
		const { clearance, assetId, storedShape } = await seeded();

		expectOk(await clearance.execute({ assetId, points: WIDER }));

		expect((await storedShape()).clearanceNeedsReview).toBe(false);
	});

	/**
	 * `validateAssetShape` refuses EITHER flag on an absent clearance, so the removal arm must clear
	 * this one or the write fails outright — the same argument `clearancePending` already carries.
	 */
	it('comes down when the boundary is removed, which validation requires rather than merely prefers', async () => {
		const { clearance, assetId, storedShape } = await seeded();

		expectOk(await clearance.execute({ assetId, points: null }));

		const stored = await storedShape();
		expect([stored.clearance, stored.clearanceNeedsReview]).toEqual([null, false]);
	});

	/**
	 * The `sameClearance` half, which is the one a reader is most likely to miss: without the flag
	 * in that comparison a boundary re-traced at the IDENTICAL coordinates reads as no change, the
	 * write is declined as a no-op and the notice stays on screen forever. That is
	 * `sameFootprint`'s own provenance argument, one step further along.
	 */
	it('comes down even when the boundary is re-traced at the identical coordinates', async () => {
		const { clearance, assetId, storedShape } = await seeded();

		expectOk(await clearance.execute({ assetId, points: BOUNDARY }));

		const stored = await storedShape();
		expect(stored.clearance?.points).toEqual([...BOUNDARY]);
		expect(stored.clearanceNeedsReview).toBe(false);
	});

	/**
	 * The counter-case. Replacing the footprint is not a write whose subject is the clearance — if
	 * anything an object whose outline has just changed around an authored boundary needs the review
	 * more, not less.
	 *
	 * **What this case pins and what it does NOT.** It pins the BEHAVIOUR. It does not guard
	 * `InheritedShape` naming `clearanceNeedsReview` or `UNDESIGNED` setting it: `withFootprint`
	 * spreads the stored object, so the flag rides through whether or not the `Pick` mentions it,
	 * and this case stays green with both removed — measured. Those two are declarations that make
	 * the inheritance visible to a reader and become load-bearing only if the field is ever made
	 * required, which is the honest width of the claim.
	 */
	it('survives a footprint replacement, which is not a write about the boundary', async () => {
		const { footprint, assetId, storedShape } = await seeded();

		expectOk(await footprint.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }], measured: true }));

		const stored = await storedShape();
		expect(stored.clearance?.points).toEqual([...BOUNDARY]);
		expect(stored.clearanceNeedsReview).toBe(true);
	});

	/**
	 * The other counter-case, and the sharper one: AD14-R1 refuses reusing `clearancePending` partly
	 * BECAUSE *"it would let a calibration clear a review"*. `rescaled` spreads the shape and names
	 * this field nowhere, which is what makes that true — so a case here is what would notice
	 * somebody adding it beside the three flags that do come down.
	 */
	it('survives a calibration, which brings every pending flag down and answers no review', async () => {
		const { calibrate, assetId, storedShape } = await seeded();

		expectOk(await calibrate.execute({ assetId, pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 }));

		const stored = await storedShape();
		expect(stored.clearancePending).toBe(false);
		expect(stored.clearanceNeedsReview).toBe(true);
	});
});
