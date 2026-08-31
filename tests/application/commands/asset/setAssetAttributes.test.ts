/**
 * The three attribute commands (Task A6) — clearance, anchor and facing — driven through the
 * real sidecar port over the in-memory vault, for the reason `setAssetFootprint.test.ts`
 * gives: what these cases are about is the DOCUMENT that ends up in the file. Which pending
 * flag moved, which one did not, and which revision the write was conditioned on are all
 * properties of a store that really keeps a revision and really replaces a whole document,
 * and a hand-written fake sidecar would have answered whatever it was told to.
 *
 * All five design commands write through `updateAssetShape`, so the cases here that look like
 * repeats of the footprint suite's are not: each one holds the shared path's guarantee FOR
 * THIS COMMAND. Three copies of the write path satisfy every other case in this file and lose
 * the announcement silently, which is what the per-command no-write cases exist to catch.
 */
import { describe, expect, it } from 'vitest';
import { SetAssetClearanceCommand } from '../../../../src/application/commands/asset/SetAssetClearance';
import { SetAssetAnchorCommand } from '../../../../src/application/commands/asset/SetAssetAnchor';
import { SetAssetFacingCommand } from '../../../../src/application/commands/asset/SetAssetFacing';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { Point } from '../../../../src/core/geometry/Point';
import type { EventBus } from '../../../../src/core/events/EventBus';
import { createEventBus } from '../../../../src/core/events/EventBus';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetDesignChanged } from '../../../../src/domain/asset/Asset.events';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import type { Calibration } from '../../../../src/domain/plan/Calibration';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { assetSidecarPathFor } from '../../../../src/infrastructure/obsidian/repositories/paths';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';

const SQUARE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
	{ x: 0, y: 100 },
];

const TRIANGLE: readonly Point[] = [
	{ x: -20, y: -20 },
	{ x: 140, y: -20 },
	{ x: 140, y: 140 },
];

const WIDER: readonly Point[] = [
	{ x: -50, y: -50 },
	{ x: 150, y: -50 },
	{ x: 150, y: 150 },
	{ x: -50, y: 150 },
];

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

/**
 * An outline somebody has already measured: traced, and through a scale. Every pending flag
 * down, so a command that sets a flag it does not own moves one of them UP and a case saying
 * so reddens.
 */
const measured = (): AssetShape => ({
	footprint: { points: [...SQUARE] },
	footprintOrigin: 'traced',
	footprintPending: false,
	clearancePending: false,
	anchorPending: false,
	clearance: null,
	anchor: { x: 0, y: 0 },
	facing: 0,
});

/**
 * The mirror fixture: every pending flag UP, over a shape carrying a clearance so that
 * `clearancePending: true` is a state `validateAssetShape` accepts. Seeded on a CALIBRATED
 * surface in the cases that use it, deliberately — that is the only arrangement in which a
 * command wrongly writing a sibling's flag from `!calibrated` writes a DIFFERENT value and
 * can be seen at all. Seeded uncalibrated, the same mutation writes `true` over `true`.
 */
const awaitingScale = (): AssetShape => ({
	footprint: { points: [...SQUARE] },
	footprintOrigin: 'traced',
	footprintPending: true,
	clearancePending: true,
	anchorPending: true,
	clearance: { points: [...TRIANGLE] },
	anchor: { x: 5, y: 5 },
	facing: 0,
});

/**
 * The REAL bus, for the reason the footprint suite states: `RecordingEventBus.subscribe`
 * discards its handler, so a case built on it asserts an empty list in both worlds. What a
 * peer designer leaf rests on is what a SUBSCRIBER heard.
 */
function designChangesHeardOn(bus: EventBus): AssetId[] {
	const heard: AssetId[] = [];
	// `DomainEvent<TType>` carries only its `type`, so a subscriber narrows to the concrete
	// event to reach a payload — the spelling `onAssetUpdated` already uses.
	bus.subscribe('AssetDesignChanged', (event) => {
		heard.push((event as AssetDesignChanged).payload.assetId);
	});
	return heard;
}

/**
 * Every command is constructed HERE. A command built beside a case is a command a mutation
 * run silently leaves un-mutated, which Task A5a paid for once already.
 */
function seeded() {
	const stack = createRepositoryStack();
	const assetId = createAssetId();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const events = createEventBus();
	return {
		stack,
		assetId,
		sidecar,
		events,
		path: assetSidecarPathFor(stack.libraryFolder, assetId),
		clearance: new SetAssetClearanceCommand(sidecar, events),
		anchor: new SetAssetAnchorCommand(sidecar, events),
		facing: new SetAssetFacingCommand(sidecar, events),
		async seed(document: AssetGeometryDocument): Promise<void> {
			expectOk(await sidecar.write(assetId, document));
		},
		async storedShape(): Promise<AssetShape | null> {
			return expectOk(await sidecar.read(assetId)).document.shape;
		},
		async revision(): Promise<number> {
			return expectOk(await sidecar.read(assetId)).version.revision;
		},
	};
}

describe('SetAssetClearance', () => {
	it('refuses a clearance on an asset with no footprint, because a boundary is relative to one', async () => {
		const { clearance, assetId, storedShape } = seeded();

		expect(expectErr(await clearance.execute({ assetId, points: WIDER })).code)
			.toBe('asset.no-footprint');

		expect(await storedShape()).toBeNull();
	});

	it('captures a boundary and flags it pending when the surface carries no scale', async () => {
		const { clearance, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });

		expect(expectOk(await clearance.execute({ assetId, points: WIDER }))).toBe('wrote');

		const shape = await storedShape();
		expect(shape?.clearance?.points).toEqual(WIDER);
		expect(shape?.clearancePending).toBe(true);
	});

	it('marks a boundary captured on a CALIBRATED surface as already scaled', async () => {
		const { clearance, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });

		await clearance.execute({ assetId, points: WIDER });

		expect((await storedShape())?.clearancePending).toBe(false);
	});

	/**
	 * Removal is not a capture. There are no coordinates left to convert, so the flag goes
	 * down whatever the surface says — and a build deriving it from calibration alone does not
	 * merely store something odd, it fails at the write, because `validateAssetShape` refuses
	 * a pending flag on an absent clearance. Seeded UNCALIBRATED for that reason: on a
	 * calibrated surface the wrong derivation and the right answer agree.
	 */
	it('clears the clearance when given null, and clears its pending flag with it', async () => {
		const { clearance, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });
		expect(expectOk(await clearance.execute({ assetId, points: WIDER }))).toBe('wrote');
		expect((await storedShape())?.clearancePending).toBe(true);

		expect(expectOk(await clearance.execute({ assetId, points: null }))).toBe('wrote');

		const shape = await storedShape();
		expect(shape?.clearance).toBeNull();
		expect(shape?.clearancePending).toBe(false);
	});

	it('sets only its own pending flag, leaving a measured footprint measured', async () => {
		const { clearance, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });

		await clearance.execute({ assetId, points: WIDER });

		const shape = await storedShape();
		expect(shape?.clearancePending).toBe(true);
		expect(shape?.footprintPending).toBe(false);
		expect(shape?.anchorPending).toBe(false);
	});

	it('preserves the footprint, anchor and facing it does not own', async () => {
		const { clearance, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: { ...awaitingScale(), facing: Math.PI / 2 } });

		await clearance.execute({ assetId, points: WIDER });

		const shape = await storedShape();
		expect(shape?.footprint.points).toEqual(SQUARE);
		expect(shape?.anchor).toEqual({ x: 5, y: 5 });
		expect(shape?.facing).toBeCloseTo(Math.PI / 2, 10);
	});

	it('refuses a two-point boundary through the one polygon validator, without touching the vault', async () => {
		const { clearance, assetId, seed, revision, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });
		const before = await revision();

		const error = expectErr(
			await clearance.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }),
		);

		expect(error.code).toBe('asset.invalid-clearance');
		// The code alone is equally true of a build that refused after writing.
		expect(await revision()).toBe(before);
		expect((await storedShape())?.clearance).toBeNull();
	});

	it('reports no-write when the boundary given is the one already stored', async () => {
		const { clearance, assetId, seed, revision } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });
		await clearance.execute({ assetId, points: WIDER });
		const written = await revision();

		expect(expectOk(await clearance.execute({ assetId, points: WIDER }))).toBe('no-write');

		expect(await revision()).toBe(written);
	});

	/**
	 * The state a comparison over coordinates alone answers `no-write` to, leaving the
	 * boundary flagged as awaiting a scale forever: the calibration arrives without the
	 * outline changing, and the re-trace is what records that it has been through one.
	 */
	it('rewrites a boundary whose coordinates are unchanged but which is no longer awaiting a scale', async () => {
		const { clearance, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });
		await clearance.execute({ assetId, points: WIDER });
		await seed({ calibration: CALIBRATION, shape: await storedShape() });

		expect(expectOk(await clearance.execute({ assetId, points: WIDER }))).toBe('wrote');

		expect((await storedShape())?.clearancePending).toBe(false);
	});

	it('reports no-write for a removal on an asset that has no boundary anyway', async () => {
		const { clearance, assetId, seed, revision } = seeded();
		await seed({ calibration: null, shape: measured() });
		const before = await revision();

		expect(expectOk(await clearance.execute({ assetId, points: null }))).toBe('no-write');

		expect(await revision()).toBe(before);
	});

	it('announces a boundary that was written', async () => {
		const { clearance, assetId, seed, events } = seeded();
		await seed({ calibration: null, shape: measured() });
		const heard = designChangesHeardOn(events);

		await clearance.execute({ assetId, points: WIDER });

		expect(heard).toEqual([assetId]);
	});

	it('announces nothing when the write was a no-write', async () => {
		const { clearance, assetId, seed, events } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });
		await clearance.execute({ assetId, points: WIDER });
		const heard = designChangesHeardOn(events);

		expect(expectOk(await clearance.execute({ assetId, points: WIDER }))).toBe('no-write');

		expect(heard).toEqual([]);
	});
});

describe('SetAssetAnchor', () => {
	it('refuses an anchor on an asset with no footprint', async () => {
		const { anchor, assetId, storedShape } = seeded();

		expect(expectErr(await anchor.execute({ assetId, anchor: { x: 10, y: 10 } })).code)
			.toBe('asset.no-footprint');

		expect(await storedShape()).toBeNull();
	});

	it('places the anchor and flags it pending when the surface carries no scale', async () => {
		const { anchor, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });

		expect(expectOk(await anchor.execute({ assetId, anchor: { x: 10, y: 10 } }))).toBe('wrote');

		const shape = await storedShape();
		expect(shape?.anchor).toEqual({ x: 10, y: 10 });
		expect(shape?.anchorPending).toBe(true);
	});

	it('marks an anchor placed on a CALIBRATED surface as already scaled', async () => {
		const { anchor, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });

		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });

		expect((await storedShape())?.anchorPending).toBe(false);
	});

	it('sets only its own pending flag, leaving the footprint and clearance awaiting their scale', async () => {
		const { anchor, assetId, seed, storedShape } = seeded();
		// Calibrated, with both siblings still pending: the one arrangement where a command
		// writing a sibling's flag from `!calibrated` writes a value that differs.
		await seed({ calibration: CALIBRATION, shape: awaitingScale() });

		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });

		const shape = await storedShape();
		expect(shape?.anchorPending).toBe(false);
		expect(shape?.footprintPending).toBe(true);
		expect(shape?.clearancePending).toBe(true);
	});

	it('preserves the footprint, clearance and facing it does not own', async () => {
		const { anchor, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: { ...awaitingScale(), facing: Math.PI / 2 } });

		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });

		const shape = await storedShape();
		expect(shape?.footprint.points).toEqual(SQUARE);
		expect(shape?.clearance?.points).toEqual(TRIANGLE);
		expect(shape?.facing).toBeCloseTo(Math.PI / 2, 10);
	});

	it('refuses a non-finite anchor without touching the vault', async () => {
		const { anchor, assetId, seed, revision, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });
		const before = await revision();

		const error = expectErr(await anchor.execute({ assetId, anchor: { x: 10, y: Number.NaN } }));

		expect(error.code).toBe('asset.invalid-anchor');
		expect(await revision()).toBe(before);
		expect((await storedShape())?.anchor).toEqual({ x: 0, y: 0 });
	});

	it('reports no-write when the anchor given is the anchor already stored', async () => {
		const { anchor, assetId, seed, revision } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });
		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
		const written = await revision();

		expect(expectOk(await anchor.execute({ assetId, anchor: { x: 10, y: 10 } }))).toBe('no-write');

		expect(await revision()).toBe(written);
	});

	/**
	 * The `coincident`-not-`===` case, and the only one that can tell the two apart. A
	 * coordinate that has been through the camera's inverse is never bitwise what it should
	 * be, so re-placing an anchor a nanometre away is the same anchor and must not buy a
	 * revision the save indicator then reports as a save.
	 */
	it('reports no-write for an anchor re-placed within the coincidence tolerance', async () => {
		const { anchor, assetId, seed, revision } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });
		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
		const written = await revision();

		const again = await anchor.execute({ assetId, anchor: { x: 10, y: 10 + 5e-7 } });

		expect(expectOk(again)).toBe('no-write');
		expect(await revision()).toBe(written);
	});

	it('writes when the anchor really moves', async () => {
		const { anchor, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });
		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });

		expect(expectOk(await anchor.execute({ assetId, anchor: { x: 90, y: 10 } }))).toBe('wrote');

		expect((await storedShape())?.anchor).toEqual({ x: 90, y: 10 });
	});

	it('announces an anchor that was written', async () => {
		const { anchor, assetId, seed, events } = seeded();
		await seed({ calibration: null, shape: measured() });
		const heard = designChangesHeardOn(events);

		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });

		expect(heard).toEqual([assetId]);
	});

	it('announces nothing when the write was a no-write', async () => {
		const { anchor, assetId, seed, events } = seeded();
		await seed({ calibration: CALIBRATION, shape: measured() });
		await anchor.execute({ assetId, anchor: { x: 10, y: 10 } });
		const heard = designChangesHeardOn(events);

		expect(expectOk(await anchor.execute({ assetId, anchor: { x: 10, y: 10 } }))).toBe('no-write');

		expect(heard).toEqual([]);
	});
});

describe('SetAssetFacing', () => {
	it('refuses a facing on an asset with no footprint', async () => {
		const { facing, assetId, storedShape } = seeded();

		expect(expectErr(await facing.execute({ assetId, facing: 1 })).code).toBe('asset.no-footprint');

		expect(await storedShape()).toBeNull();
	});

	it('turns the object, and reports that it wrote', async () => {
		const { facing, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });

		expect(expectOk(await facing.execute({ assetId, facing: Math.PI / 2 }))).toBe('wrote');

		expect((await storedShape())?.facing).toBeCloseTo(Math.PI / 2, 10);
	});

	it('normalises a facing given as 2π to 0, so two spellings of north cannot be stored', async () => {
		const { facing, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: { ...measured(), facing: 1 } });

		expect(expectOk(await facing.execute({ assetId, facing: Math.PI * 2 }))).toBe('wrote');

		expect((await storedShape())?.facing).toBe(0);
	});

	it('refuses a non-finite facing without touching the vault', async () => {
		const { facing, assetId, seed, revision, storedShape } = seeded();
		await seed({ calibration: null, shape: measured() });
		const before = await revision();

		expect(expectErr(await facing.execute({ assetId, facing: Number.POSITIVE_INFINITY })).code)
			.toBe('asset.invalid-facing');

		expect(await revision()).toBe(before);
		expect((await storedShape())?.facing).toBe(0);
	});

	/**
	 * An angle is not a coordinate group: no scale converts it, so this command owns no
	 * pending flag at all and must leave all three of them where it found them. Seeded
	 * CALIBRATED with every flag up, so a build deriving any flag from `!calibrated` writes
	 * `false` over `true` and is seen.
	 */
	it('touches no pending flag at all, its own included', async () => {
		const { facing, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: awaitingScale() });

		await facing.execute({ assetId, facing: Math.PI / 2 });

		const shape = await storedShape();
		expect(shape?.footprintPending).toBe(true);
		expect(shape?.clearancePending).toBe(true);
		expect(shape?.anchorPending).toBe(true);
	});

	it('preserves the footprint, clearance and anchor it does not own', async () => {
		const { facing, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: awaitingScale() });

		await facing.execute({ assetId, facing: Math.PI / 2 });

		const shape = await storedShape();
		expect(shape?.footprint.points).toEqual(SQUARE);
		expect(shape?.clearance?.points).toEqual(TRIANGLE);
		expect(shape?.anchor).toEqual({ x: 5, y: 5 });
	});

	it('reports no-write when the facing given is the facing already stored', async () => {
		const { facing, assetId, seed, revision } = seeded();
		await seed({ calibration: null, shape: measured() });
		await facing.execute({ assetId, facing: Math.PI / 2 });
		const written = await revision();

		expect(expectOk(await facing.execute({ assetId, facing: Math.PI / 2 }))).toBe('no-write');

		expect(await revision()).toBe(written);
	});

	/**
	 * The normalisation is what makes this a no-write rather than a rewrite: 2π and 0 are the
	 * same direction, and a command comparing the INPUT against the stored value would write a
	 * revision for a turn nobody made.
	 */
	it('reports no-write for 2π against a stored 0', async () => {
		const { facing, assetId, seed, revision } = seeded();
		await seed({ calibration: null, shape: measured() });
		const before = await revision();

		expect(expectOk(await facing.execute({ assetId, facing: Math.PI * 2 }))).toBe('no-write');

		expect(await revision()).toBe(before);
	});

	it('announces a facing that was written', async () => {
		const { facing, assetId, seed, events } = seeded();
		await seed({ calibration: null, shape: measured() });
		const heard = designChangesHeardOn(events);

		await facing.execute({ assetId, facing: Math.PI / 2 });

		expect(heard).toEqual([assetId]);
	});

	it('announces nothing when the write was a no-write', async () => {
		const { facing, assetId, seed, events } = seeded();
		await seed({ calibration: null, shape: measured() });
		await facing.execute({ assetId, facing: Math.PI / 2 });
		const heard = designChangesHeardOn(events);

		expect(expectOk(await facing.execute({ assetId, facing: Math.PI / 2 }))).toBe('no-write');

		expect(heard).toEqual([]);
	});
});
