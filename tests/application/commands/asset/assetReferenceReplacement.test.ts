/**
 * AD12's third acceptance criterion, at the command that could break it: *replacing a reference
 * does not silently mark measured geometry unscaled or erase pending warnings.*
 *
 * `setAssetBackground.test.ts` already holds the first half — *"does NOT re-flag an
 * already-measured outline"* — and it is the more obvious direction. The OTHER direction had
 * nothing: a swap that cleared a pending flag would look like progress (the unscaled warning
 * goes away) while leaving sheet pixels presented as millimetres, and the calibration that was
 * supposed to convert them would then find no group to convert.
 *
 * A file of its own rather than two cases appended to that suite, because AD12's lease does not
 * reach it — and the setup here is deliberately the thin half of that file's: the real
 * repository and the real sidecar, and no fault injection, since neither case is about a write
 * failing.
 *
 * What this does NOT cover, because no such door exists: DELETING a reference.
 * `SetAssetBackgroundInput.path` is a `string` with no null arm, so an asset's sheet can be
 * swapped and never removed. AD12's report records that as a gap in the card rather than in the
 * code.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetBackgroundCommand } from '../../../../src/application/commands/asset/SetAssetBackground';
import type { VaultFileProbe } from '../../../../src/application/ports/VaultFileProbe';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { isOk } from '../../../../src/core/result/Result';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { Calibration } from '../../../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makeAsset } from '../../../helpers/entities';

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

/** Traced on an uncalibrated sheet: every group is in sheet pixels and every flag says so. */
const PENDING_SHAPE: AssetShape = {
	footprint: { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 60 }, { x: 0, y: 60 }] },
	footprintOrigin: 'traced',
	footprintPending: true,
	clearance: { points: [{ x: -10, y: -10 }, { x: 110, y: -10 }, { x: 110, y: 70 }, { x: -10, y: 70 }] },
	clearancePending: true,
	anchor: { x: 50, y: 30 },
	anchorPending: true,
	facing: 0,
	details: [
		{ id: 'detail-1', name: 'top', outline: { points: [{ x: 10, y: 10 }, { x: 40, y: 10 }, { x: 40, y: 30 }] }, line: 'solid', pending: true },
	],
};

const probe: VaultFileProbe = { fileExists: (path) => ['Specs/oven.png', 'Specs/other.png'].includes(path) };

async function seeded() {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const written = expectOk(await stack.assets.save(makeAsset(), 'absent'));
	const assetId = written.entity.id;
	expectOk(await sidecar.write(assetId, { calibration: CALIBRATION, shape: PENDING_SHAPE }));
	return {
		assetId,
		sidecar,
		setBackground: new SetAssetBackgroundCommand(
			{ sidecar, assets: stack.assets, events, locks: new ReferenceLocks() },
			probe,
		),
	};
}

describe('replacing an asset’s reference', () => {
	it('leaves every pending flag exactly as it was, so no warning is erased', async () => {
		const { setBackground, assetId, sidecar } = await seeded();

		expectOk(await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null }));

		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape).toMatchObject({
			footprintPending: true,
			clearancePending: true,
			anchorPending: true,
		});
		expect(isOk(stored) && stored.value.document.shape?.details[0].pending).toBe(true);
	});

	/**
	 * The coordinates themselves, beside the flags: C07's *"replacing a background does not itself
	 * change known millimetres"*. What the swap DOES clear is the calibration measured off the old
	 * document, which that file's own case already holds and this one asserts beside the shape so
	 * the two facts are read together rather than as a contradiction.
	 */
	it('moves no coordinate, while dropping the scale measured off the document being replaced', async () => {
		const { setBackground, assetId, sidecar } = await seeded();

		expectOk(await setBackground.execute({ assetId, path: 'Specs/other.png', kind: 'image', page: null }));

		const stored = await sidecar.read(assetId);
		expect(isOk(stored) && stored.value.document.shape?.footprint).toEqual(PENDING_SHAPE.footprint);
		expect(isOk(stored) && stored.value.document.shape?.anchor).toEqual(PENDING_SHAPE.anchor);
		expect(isOk(stored) && stored.value.document.calibration).toBeNull();
	});
});
