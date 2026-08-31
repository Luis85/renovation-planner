/**
 * The two footprint commands (Task A5), driven through the real sidecar port over the
 * in-memory vault — the same stack `assetGeometrySidecar.test.ts` uses, because what these
 * cases are about is the DOCUMENT that ends up in the file: which attributes survived a
 * write that does not own them, and which revision the write was conditioned on.
 *
 * A hand-written fake sidecar would have answered whatever it was told to; the two rules
 * this task exists to hold — preservation and conditioning — are both properties of a store
 * that really keeps a revision and really replaces a whole document.
 */
import { describe, expect, it } from 'vitest';
import {
	SetAssetFootprintCommand,
	SetAssetFootprintFromDimensionsCommand,
} from '../../../../src/application/commands/asset/SetAssetFootprint';
import type {
	AssetGeometryDocument,
	AssetGeometrySidecar,
} from '../../../../src/application/ports/AssetGeometrySidecar';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import type { RepositoryError } from '../../../../src/application/ports/repositoryErrors';
import type { Result } from '../../../../src/core/result/Result';
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

const TRIANGLE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 60 },
];

const SQUARE: readonly Point[] = [
	{ x: 0, y: 0 },
	{ x: 100, y: 0 },
	{ x: 100, y: 100 },
	{ x: 0, y: 100 },
];

/** What `footprintFromDimensions(1200, 800)` produces, spelled out so a case can trace one. */
const CENTRED_RECTANGLE: readonly Point[] = [
	{ x: -600, y: -400 },
	{ x: 600, y: -400 },
	{ x: 600, y: 400 },
	{ x: -600, y: 400 },
];

const CALIBRATION: Calibration = {
	pointA: { x: 0, y: 0 },
	pointB: { x: 800, y: 0 },
	knownDistance: 800,
	pixelsPerWorldUnit: 1,
};

/**
 * A shape carrying something in every field the two footprint commands do NOT own, so a
 * build that composes a fresh document instead of merging over the stored one loses
 * something visible. `clearancePending` needs a clearance to be pending ABOUT — the pair
 * `validateAssetShape` refuses otherwise — and `footprintOrigin: 'traced'` with
 * `footprintPending: false` is a measured outline that has already been through a scale.
 */
const decorated = (): AssetShape => ({
	footprint: { points: [...SQUARE] },
	footprintOrigin: 'traced',
	footprintPending: false,
	clearancePending: true,
	anchorPending: true,
	clearance: { points: [...TRIANGLE] },
	anchor: { x: 100, y: 50 },
	facing: Math.PI / 2,
});

/**
 * The REAL bus (`createEventBus`), not a double. `RecordingEventBus.subscribe` discards its
 * handler, so a case built on it would assert an empty list in both worlds; `dispatchingEventBus`
 * really delivers but also records, and nothing here asks what was published — only what a
 * subscriber HEARD, which is the whole claim a peer designer leaf rests on.
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
		typed: new SetAssetFootprintFromDimensionsCommand(sidecar, events),
		traced: new SetAssetFootprintCommand(sidecar, events),
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

describe('SetAssetFootprintFromDimensions', () => {
	it('writes a centred rectangle and reports that it wrote', async () => {
		const { typed, assetId, storedShape } = seeded();

		const result = await typed.execute({ assetId, width: 1200, depth: 800 });

		expect(expectOk(result)).toBe('wrote');
		expect((await storedShape())?.footprint.points).toEqual(CENTRED_RECTANGLE);
	});

	it('marks the footprint typed, so no unscaled warning is shown for numbers nobody measured', async () => {
		const { typed, assetId, seed, storedShape } = seeded();
		// Uncalibrated, which is what a traced capture would answer `pending` to. Typed
		// millimetres are not a measurement off a background, so the surface says nothing
		// about them.
		await seed({ calibration: null, shape: null });

		await typed.execute({ assetId, width: 1200, depth: 800 });

		const shape = await storedShape();
		expect(shape?.footprintOrigin).toBe('typed');
		expect(shape?.footprintPending).toBe(false);
	});

	it('preserves the clearance, anchor, facing and the pending flags it does not own', async () => {
		const { typed, assetId, seed, storedShape } = seeded();
		await seed({ calibration: null, shape: decorated() });

		expect(expectOk(await typed.execute({ assetId, width: 1200, depth: 800 }))).toBe('wrote');

		const shape = await storedShape();
		expect(shape?.anchor).toEqual({ x: 100, y: 50 });
		expect(shape?.facing).toBeCloseTo(Math.PI / 2, 10);
		expect(shape?.clearance?.points).toEqual(TRIANGLE);
		expect(shape?.clearancePending).toBe(true);
		expect(shape?.anchorPending).toBe(true);
	});

	it('refuses a non-positive dimension without touching the vault', async () => {
		const { typed, assetId, seed, revision, storedShape } = seeded();
		await seed({ calibration: null, shape: decorated() });
		const before = await revision();

		const error = expectErr(await typed.execute({ assetId, width: -5, depth: 800 }));

		expect(error.code).toBe('asset.non-positive-dimension');
		// The code alone is equally true of a build that refused after writing.
		expect(await revision()).toBe(before);
		expect((await storedShape())?.footprint.points).toEqual(SQUARE);
	});

	it('reports no-write when the rectangle asked for is the one already stored', async () => {
		const { typed, assetId, revision } = seeded();
		await typed.execute({ assetId, width: 1200, depth: 800 });
		const written = await revision();

		const again = await typed.execute({ assetId, width: 1200, depth: 800 });

		expect(expectOk(again)).toBe('no-write');
		expect(await revision()).toBe(written);
	});

	it('writes again when a dimension really changes', async () => {
		const { typed, assetId, storedShape } = seeded();
		await typed.execute({ assetId, width: 1200, depth: 800 });

		expect(expectOk(await typed.execute({ assetId, width: 1400, depth: 800 }))).toBe('wrote');

		expect((await storedShape())?.footprint.points[1]).toEqual({ x: 700, y: -400 });
	});
});

describe('SetAssetFootprint', () => {
	it('marks a traced footprint traced, and pending a scale when the surface is uncalibrated', async () => {
		const { traced, assetId, storedShape } = seeded();

		expect(expectOk(await traced.execute({ assetId, points: TRIANGLE }))).toBe('wrote');

		const shape = await storedShape();
		expect(shape?.footprintOrigin).toBe('traced');
		expect(shape?.footprintPending).toBe(true);
	});

	it('marks a trace taken on a CALIBRATED surface as already scaled', async () => {
		const { traced, assetId, seed, storedShape } = seeded();
		await seed({ calibration: CALIBRATION, shape: null });

		await traced.execute({ assetId, points: TRIANGLE });

		expect((await storedShape())?.footprintPending).toBe(false);
	});

	it('rewrites a footprint whose coordinates are unchanged but whose provenance is not', async () => {
		const { traced, assetId, seed, storedShape } = seeded();
		// Calibrated, so `footprintPending` is false on both sides and the ONLY thing that
		// differs is where the outline came from. A comparison over coordinates alone
		// reports `no-write` here and leaves the sidecar claiming somebody typed it.
		await seed({
			calibration: CALIBRATION,
			shape: {
				...decorated(),
				footprint: { points: [...CENTRED_RECTANGLE] },
				footprintOrigin: 'typed',
			},
		});

		expect(expectOk(await traced.execute({ assetId, points: CENTRED_RECTANGLE }))).toBe('wrote');

		expect((await storedShape())?.footprintOrigin).toBe('traced');
	});

	it('records that a re-traced outline is no longer awaiting a scale', async () => {
		const { traced, assetId, seed, storedShape } = seeded();
		await traced.execute({ assetId, points: TRIANGLE });
		const captured = await storedShape();
		// The calibration arrives without the outline changing — which is exactly the state
		// where a comparison over coordinates and provenance alone answers `no-write` and
		// leaves the shape flagged as unscaled forever.
		await seed({ calibration: CALIBRATION, shape: captured });

		expect(expectOk(await traced.execute({ assetId, points: TRIANGLE }))).toBe('wrote');

		expect((await storedShape())?.footprintPending).toBe(false);
	});

	it('writes an outline with a different number of vertices over the one traced before', async () => {
		const { traced, assetId, storedShape } = seeded();
		await traced.execute({ assetId, points: TRIANGLE });

		expect(expectOk(await traced.execute({ assetId, points: SQUARE }))).toBe('wrote');

		expect((await storedShape())?.footprint.points).toEqual(SQUARE);
	});

	it('refuses a two-point outline through the one polygon validator', async () => {
		const { traced, assetId, seed, revision } = seeded();
		await seed({ calibration: null, shape: decorated() });
		const before = await revision();

		const error = expectErr(
			await traced.execute({ assetId, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }] }),
		);

		expect(error.code).toBe('asset.invalid-footprint');
		expect(await revision()).toBe(before);
	});

	it('reports a sidecar it cannot read rather than writing over it', async () => {
		const { traced, assetId, stack, path, seed } = seeded();
		await seed({ calibration: null, shape: decorated() });
		stack.vault.failures.add(`read:${path}`);

		expect(expectErr(await traced.execute({ assetId, points: TRIANGLE })).code)
			.toBe('asset-geometry.unreadable');
	});

	it('refuses the second of two writes built from the same revision, rather than losing one', async () => {
		const { typed, traced, assetId, sidecar, storedShape } = seeded();
		const first = expectOk(await sidecar.read(assetId)).version;
		const second = expectOk(await sidecar.read(assetId)).version;

		expect(expectOk(await typed.execute({ assetId, width: 1200, depth: 800, expected: first })))
			.toBe('wrote');
		const late = await traced.execute({ assetId, points: TRIANGLE, expected: second });

		expect(expectErr(late).code).toBe('asset-geometry.revision-conflict');
		// The refusal alone is equally true of a build that wrote and then reported.
		expect((await storedShape())?.footprint.points).toEqual(CENTRED_RECTANGLE);
	});

	/**
	 * The rule the case above cannot reach: with NO `expected` given, the write is still
	 * conditioned — on the version this command's own read returned. A build passing
	 * `undefined` through to the port writes unconditionally, so a competing write landing
	 * between this command's read and its write is replaced by a document built from the
	 * stale snapshot, with nothing reporting anything.
	 */
	it('conditions an unexpecting write on the version it read, so a racing writer is not lost', async () => {
		const { assetId, sidecar, storedShape, events } = seeded();
		let raced = false;
		const racing: AssetGeometrySidecar = {
			read: (id) => sidecar.read(id),
			async write(
				id: AssetId,
				document: AssetGeometryDocument,
				expected?: EntityVersion,
			): Promise<Result<EntityVersion, RepositoryError>> {
				if (!raced) {
					raced = true;
					expectOk(await sidecar.write(id, { calibration: CALIBRATION, shape: null }));
				}
				return sidecar.write(id, document, expected);
			},
		};

		const late = await new SetAssetFootprintCommand(racing, events).execute({ assetId, points: TRIANGLE });

		expect(expectErr(late).code).toBe('asset-geometry.revision-conflict');
		expect(await storedShape()).toBeNull();
	});

	/**
	 * A stale expectation over an identical footprint is deliberately NOT a conflict: this
	 * command never reaches the port, because there is nothing to lose — no field it owns
	 * would change. Pinned rather than described, so a build that starts refusing here says
	 * so at a case rather than surprising the caller.
	 */
	it('reports no-write for an identical footprint even when the expectation is stale', async () => {
		const { typed, assetId, sidecar } = seeded();
		const stale = expectOk(await sidecar.read(assetId)).version;
		await typed.execute({ assetId, width: 1200, depth: 800 });

		const again = await typed.execute({ assetId, width: 1200, depth: 800, expected: stale });

		expect(expectOk(again)).toBe('no-write');
	});
});

/**
 * `AssetDesignChanged` (Task A5a), asked of a real subscriber on a real bus.
 *
 * The event exists so that a second designer leaf showing the same asset re-reads: it means
 * "the stored design changed", never "somebody pressed something". Every case below is about
 * which of those two it means, which is why they assert on what a SUBSCRIBER heard rather
 * than on a recorder's list — a published event nothing can be subscribed to refreshes no
 * leaf.
 */
describe('AssetDesignChanged', () => {
	it('announces a footprint that was written', async () => {
		const { typed, assetId, events } = seeded();
		const heard = designChangesHeardOn(events);

		await typed.execute({ assetId, width: 1200, depth: 800 });

		expect(heard).toEqual([assetId]);
	});

	/**
	 * The discriminating case. A command that announced regardless would tell every open
	 * designer leaf to re-read on every idle re-submit, and would make the event mean
	 * "somebody pressed something" — not a signal a subscriber can act on. It also covers
	 * every refusal above the no-write guard, since a publish placed anywhere before that
	 * return reddens exactly here.
	 */
	it('announces nothing when the write was a no-write', async () => {
		const { typed, assetId, events } = seeded();
		await typed.execute({ assetId, width: 1200, depth: 800 });
		const heard = designChangesHeardOn(events);

		expect(expectOk(await typed.execute({ assetId, width: 1200, depth: 800 }))).toBe('no-write');

		expect(heard).toEqual([]);
	});

	/**
	 * The other half of "both commands announce through ONE line". Move the publish into
	 * `SetAssetFootprintFromDimensionsCommand.execute` and every case above stays green while
	 * a traced outline silently refreshes nobody.
	 */
	it('announces a traced footprint through the same publish point', async () => {
		const { traced, assetId, events } = seeded();
		const heard = designChangesHeardOn(events);

		await traced.execute({ assetId, points: TRIANGLE });

		expect(heard).toEqual([assetId]);
	});

	/**
	 * The gap between the no-write guard and the port, which the case above cannot reach: a
	 * publish placed BEFORE `sidecar.write` announces a design change that never landed, and
	 * the peer leaf then re-reads the document the initiating leaf failed to write.
	 */
	it('announces nothing when the write itself failed', async () => {
		const { typed, assetId, seed, stack, path, events } = seeded();
		await seed({ calibration: null, shape: decorated() });
		stack.vault.failures.add(`modify:${path}`);
		const heard = designChangesHeardOn(events);

		expect(expectErr(await typed.execute({ assetId, width: 1200, depth: 800 })).code)
			.toBe('asset-geometry.write-failed');

		expect(heard).toEqual([]);
	});
});
