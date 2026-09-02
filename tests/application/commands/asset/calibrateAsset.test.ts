/**
 * `CalibrateAssetCommand` (Task B6) — an asset's OWN calibration, driven through the real
 * sidecar port over the in-memory vault for the reason the other design suites give: what
 * these cases are about is the DOCUMENT that ends up in the file, and every property they
 * assert — which coordinates moved, which flags came down, what the calibration's own pair
 * measures — is a property of a store that really replaces a whole document and really keeps
 * a revision. A hand-written fake would have answered whatever it was told to.
 *
 * **The gate under test is one flag per coordinate group, and the cases are the regressions
 * of three gates that each failed somewhere else.** Provenance alone (`footprintOrigin ===
 * 'traced'`) re-multiplies a trace an earlier calibration already converted, because that
 * field stays `'traced'` for the life of the outline. A single shape-level flag rescales a
 * TYPED footprint whenever any later trace is awaiting a scale. The two conjoined patch the
 * footprint out of that and leave the anchor and the clearance sharing one flag — the same
 * defect one level down. Every one of those three passes some of the cases below and fails at
 * least one.
 */
import { describe, expect, it } from 'vitest';
import { CalibrateAssetCommand } from '../../../../src/application/commands/asset/CalibrateAsset';
import type { AssetGeometryDocument } from '../../../../src/application/ports/AssetGeometrySidecar';
import type { PlanGeometryDocument } from '../../../../src/application/ports/PlanGeometrySidecar';
import type { AssetRepository } from '../../../../src/application/ports/AssetRepository';
import { distance } from '../../../../src/core/geometry/operations';
import type { Polygon } from '../../../../src/core/geometry/Polygon';
import { createEventBus, type EventBus } from '../../../../src/core/events/EventBus';
import { err } from '../../../../src/core/result/Result';
import type { AssetId } from '../../../../src/domain/asset/AssetId';
import { createAssetId } from '../../../../src/domain/asset/AssetId';
import type { AssetDesignChanged } from '../../../../src/domain/asset/Asset.events';
import type { AssetShape } from '../../../../src/domain/asset/AssetShape';
import { footprintFromDimensions } from '../../../../src/domain/asset/AssetShape';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { ObsidianAssetGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { createRepositoryStack } from '../../../helpers/vault';
import { ReferenceLocks } from '../../../../src/application/reference/ReferenceLocks';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makeAsset, makePlan, makeProject } from '../../../helpers/entities';

/**
 * A rectangle CENTRED on the origin, through the domain's own constructor rather than four
 * literals — which is what makes `rect(1200, 800).points[2]` be `(600, 400)` and not
 * `(1200, 800)`. Every expectation below is stated in those terms.
 */
function rect(width: number, depth: number): Polygon {
	return expectOk(footprintFromDimensions(width, depth));
}

/**
 * The shape a case seeds, over defaults that are the ordinary undesigned ones. Spelled as a
 * partial so each case names only the fields its own claim is about — the flags, mostly, since
 * the flags are the whole subject of this suite.
 */
function shapeWith(overrides: Partial<AssetShape> = {}): AssetShape {
	return {
		footprint: rect(100, 60),
		footprintOrigin: 'traced',
		footprintPending: false,
		clearance: null,
		clearancePending: false,
		anchor: { x: 0, y: 0 },
		anchorPending: false,
		facing: 0,
		...overrides,
	};
}

/** What a SUBSCRIBER heard — a peer designer leaf rests on nothing else. */
function designChangesHeardOn(bus: EventBus): AssetId[] {
	const heard: AssetId[] = [];
	bus.subscribe('AssetDesignChanged', (event) => {
		heard.push((event as AssetDesignChanged).payload.assetId);
	});
	return heard;
}

/** A vault fault a case can inject, shaped exactly as the ports' own union permits. */
const VAULT_FAULT = {
	category: 'Persistence',
	code: 'vault.unexpected-failure',
	message: 'the sidecar could not be read',
} as const;

/**
 * The command is constructed HERE, once. A command built beside a case is a command a
 * mutation run silently leaves un-mutated, which this epic has already paid for.
 */
async function seeded(options: { assets?: (real: AssetRepository) => AssetRepository } = {}) {
	const stack = createRepositoryStack();
	const events = createEventBus();
	const sidecar = new ObsidianAssetGeometrySidecar(stack.assetGeometry);
	const planSidecar = new ObsidianPlanGeometrySidecar(stack.store);
	const assetId = createAssetId();
	const otherAssetId = createAssetId();
	expectOk(await stack.assets.save(makeAsset({ id: assetId }), 'absent'));
	expectOk(await stack.assets.save(makeAsset({ id: otherAssetId }), 'absent'));
	const assets = options.assets?.(stack.assets) ?? stack.assets;

	return {
		stack,
		events,
		sidecar,
		planSidecar,
		assetId,
		otherAssetId,
		designChanges: designChangesHeardOn(events),
		/**
		 * A real plan, in the SAME fake vault, with a real sidecar of its own — which is what
		 * makes "touches no plan" a claim about one write rather than about three stores that
		 * were never connected. `PlanGeometryStore` resolves a sidecar path through the project
		 * index, so the project and the plan note both have to exist before it can be written.
		 */
		async seedPlan(): Promise<PlanId> {
			const projectId = createProjectId();
			expectOk(await stack.projects.save(makeProject({ id: projectId }), 'absent'));
			const plan = makePlan({ projectId });
			expectOk(await stack.plans.save(plan, 'absent'));
			return plan.id;
		},
		calibrate: new CalibrateAssetCommand({ sidecar, assets, events, locks: new ReferenceLocks() }),
		async seedShape(shape: AssetShape | null): Promise<void> {
			expectOk(await sidecar.write(assetId, { calibration: null, shape }));
		},
		async stored(): Promise<AssetGeometryDocument> {
			return expectOk(await sidecar.read(assetId)).document;
		},
		async storedShape(): Promise<AssetShape | null> {
			return (await this.stored()).shape;
		},
	};
}

/** Two picks 100 units apart called 200 mm — every case below that wants a correction of 2. */
const DOUBLING = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 200 } as const;

describe('what a calibration rescales', () => {
	it('rescales the coordinates that came off the background, its own calibration pair included', async () => {
		const h = await seeded();
		await h.seedShape(
			shapeWith({
				footprintPending: true,
				clearancePending: true,
				anchorPending: true,
				anchor: { x: 10, y: 10 },
				clearance: rect(120, 80),
			}),
		);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		// scaleCorrection is 2: the drawn 100 units are really 200 mm.
		const stored = await h.stored();
		expect(stored.shape?.anchor).toEqual({ x: 20, y: 20 });
		expect(stored.shape?.clearance?.points[1]).toEqual({ x: 120, y: -80 });
		const c = stored.calibration;
		// The at-rest invariant, established by the command and deliberately not by the
		// validator — `Calibration.ts` says why, and that part applies here unchanged.
		expect(c && distance(c.pointA, c.pointB)).toBeCloseTo(c?.knownDistance ?? 0, 6);
	});

	/**
	 * The epic's central separation, asserted rather than asserted-in-prose: the calibration a
	 * designer surface takes belongs to that object and never reaches a plan's — or another
	 * asset's. Both comparisons run over the SAME fake vault, so what is being checked is that
	 * this write touched one file, not that three stores were never connected.
	 */
	it('touches no plan and no other asset', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith({ footprintPending: true }));
		const planId = await h.seedPlan();
		const plan: PlanGeometryDocument = {
			calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, knownDistance: 10, pixelsPerWorldUnit: 1 },
			objects: [],
		};
		expectOk(await h.planSidecar.write(planId, plan));
		expectOk(await h.sidecar.write(h.otherAssetId, { calibration: null, shape: shapeWith({ footprintPending: true }) }));
		const otherBefore = await h.sidecar.read(h.otherAssetId);
		const planBefore = await h.planSidecar.read(planId);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		expect(await h.sidecar.read(h.otherAssetId)).toEqual(otherBefore);
		expect(await h.planSidecar.read(planId)).toEqual(planBefore);
	});

	it('converts a pending clearance and leaves a typed footprint alone, with no rule naming the footprint', async () => {
		const h = await seeded();
		await h.seedShape(
			shapeWith({
				footprint: rect(1200, 800),
				footprintOrigin: 'typed',
				footprintPending: false,
				clearance: rect(1400, 1000),
				clearancePending: true,
			}),
		);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		// The typed rectangle is untouched; the traced clearance is doubled.
		const shape = await h.storedShape();
		expect(shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });
		expect(shape?.clearance?.points[2]).toEqual({ x: 1400, y: 1000 });
	});

	/**
	 * **The plan's expected clearance value here was `{ x: 120, y: 80 }` and could not be**, and
	 * the file's own sixth case is what says so: it seeds the identical `rect(120, 80)` with
	 * `clearancePending: false` and expects `{ x: 60, y: 40 }`. `rect` is centred — proved
	 * independently by every footprint expectation in this file, and by the plan's own
	 * "doubled from 50 x 30" comment two cases down — so an unconverted `rect(120, 80)` has
	 * `points[2] === (60, 40)`, and `(120, 80)` is what a CONVERTED one has. Taking the plan's
	 * number verbatim would have pinned the exact defect the case's own comment forbids.
	 */
	it('clears each flag it converts, and only those', async () => {
		const h = await seeded();
		await h.seedShape(
			shapeWith({ footprintPending: true, clearance: rect(120, 80), clearancePending: false }),
		);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		const shape = await h.storedShape();
		expect(shape?.footprint.points[2]).toEqual({ x: 100, y: 60 });   // pending, so doubled from 50 x 30
		expect(shape?.footprintPending).toBe(false);
		expect(shape?.clearance?.points[2]).toEqual({ x: 60, y: 40 });   // not pending, so not converted
	});

	/**
	 * The case one shape-level flag could not express: a measured asset, its background
	 * replaced (Decision 5), a fresh clearance traced on the new document before it is
	 * calibrated.
	 */
	it('converts a NEW trace on a replaced background without re-multiplying the measured geometry', async () => {
		const h = await seeded();
		await h.seedShape(
			shapeWith({
				footprint: rect(1200, 800),
				footprintPending: false,
				anchor: { x: 10, y: 10 },
				anchorPending: false,
				clearance: rect(100, 60),
				clearancePending: true,
			}),
		);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		const shape = await h.storedShape();
		expect(shape?.clearance?.points[2]).toEqual({ x: 100, y: 60 });   // doubled from 50 x 30
		expect(shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });   // untouched
		expect(shape?.anchor).toEqual({ x: 10, y: 10 });                  // untouched
	});

	it('rescales nothing on a second calibration, because those coordinates are already millimetres', async () => {
		// trace -> calibrate -> replace the background (Decision 5) -> calibrate the new document.
		const h = await seeded();
		await h.seedShape(
			shapeWith({ footprintPending: false, clearance: rect(120, 80), clearancePending: false }),
		);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		// `footprintOrigin` is still 'traced' and always will be. The pending flags are what say
		// these coordinates were already converted; gating on provenance alone doubles a
		// measured oven.
		const stored = await h.stored();
		expect(stored.shape?.footprint.points[2]).toEqual({ x: 50, y: 30 });
		expect(stored.shape?.clearance?.points[2]).toEqual({ x: 60, y: 40 });
		// The calibration itself is still recorded — the command did its job, it just rescaled
		// nothing.
		expect(stored.calibration).not.toBeNull();
	});

	it('rescales its own calibration pair even when no geometry awaits a scale', async () => {
		// The ordinary first calibration: a background, nothing traced on it yet.
		const h = await seeded();
		await h.seedShape(shapeWith({ footprint: rect(1200, 800), footprintOrigin: 'typed' }));

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		const stored = await h.stored();
		// The at-rest invariant is definitional and gated on nothing.
		expect(stored.calibration && distance(stored.calibration.pointA, stored.calibration.pointB))
			.toBeCloseTo(200, 6);
		// ...while the typed footprint it sits beside is still untouched.
		expect(stored.shape?.footprint.points[2]).toEqual({ x: 600, y: 400 });
	});

	/**
	 * A background measured before anything at all is drawn on it — `shape: null`, which
	 * `AssetGeometryDocument` calls the ordinary starting state of a designed asset rather than
	 * a failure to read one. The rescale has nothing to walk and the pair still has to convert.
	 */
	it('calibrates an asset nobody has drawn on, leaving the shape absent', async () => {
		const h = await seeded();
		await h.seedShape(null);

		expectOk(await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING }));

		const stored = await h.stored();
		expect(stored.shape).toBeNull();
		expect(stored.calibration?.pointB).toEqual({ x: 200, y: 0 });
	});

	/** A peer designer leaf on this asset is drawing coordinates this write just moved. */
	it('announces the design change, so a peer leaf re-reads', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith({ footprintPending: true }));

		await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING });

		expect(h.designChanges).toEqual([h.assetId]);
	});
});

describe('what a calibration refuses', () => {
	it('refuses two coincident points, which is a division by zero', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith());
		const p = { x: 40, y: 40 };

		const result = await h.calibrate.execute({ assetId: h.assetId, pointA: p, pointB: p, knownDistance: 200 });

		expect(expectErr(result).code).toBe('calibration.coincident-points');
	});

	it('refuses a non-positive known distance', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith());

		const result = await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING, knownDistance: 0 });

		expect(expectErr(result).code).toBe('calibration.invalid-distance');
		expect((await h.stored()).calibration).toBeNull();
	});

	/**
	 * **`footprintPending` is load-bearing here**: without it the per-coordinate gate leaves the
	 * footprint alone, only the calibration pair rescales, the command SUCCEEDS, and this case
	 * passes against a build with no finite guard at all.
	 *
	 * **The footprint is an ORDINARY 1200 x 800 and the plan asked for `rect(1e300, 1e300)`,
	 * which cannot be seeded.** That rectangle's shoelace terms are 1e600, so `enclosesArea`
	 * answers false and `ObsidianAssetGeometrySidecar.read` refuses the fixture before the
	 * command ever sees it — the case would then fail at its own `expect(isOk(stored))` rather
	 * than at the guard. It needs no such magnitude: a correction of 3.2e305 takes the ordinary
	 * 600 mm half-width to 1.92e308, which is past `Number.MAX_VALUE`, and that is the honest
	 * shape of the hazard anyway — a legal-looking pick overflowing a perfectly ordinary oven.
	 */
	it('refuses a calibration whose rescaled coordinates would overflow, rather than writing nulls', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith({ footprint: rect(1200, 800), footprintPending: true }));

		const result = await h.calibrate.execute({
			assetId: h.assetId,
			pointA: { x: 0, y: 0 },
			pointB: { x: 1e-302, y: 0 },
			knownDistance: 3200,
		});

		expect(expectErr(result).code).toBe('calibration.degenerate-scale');
		// The sidecar is still READABLE, which is the whole point: `JSON.stringify` writes an
		// `Infinity` as `null`, and the schema refuses that on every later read.
		const stored = await h.sidecar.read(h.assetId);
		expect(stored.ok).toBe(true);
	});

	/**
	 * The UNDERFLOW end of the same class, and the reason this command validates the rescaled
	 * shape where `ReversibleCalibratePlan` does not: the asset sidecar runs
	 * `validateAssetShape` over what it READS and refuses rather than repairing, so a
	 * correction small enough to collapse a footprint's area would write a document this plugin
	 * could never open again.
	 */
	it('refuses a rescale that collapses the footprint to no area', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith({ footprint: rect(2e-160, 2e-160), footprintPending: true }));

		const result = await h.calibrate.execute({
			assetId: h.assetId,
			pointA: { x: 0, y: 0 },
			pointB: { x: 1e200, y: 0 },
			knownDistance: 1,
		});

		expect(expectErr(result).code).toBe('asset.degenerate-footprint');
		expect((await h.stored()).calibration).toBeNull();
	});

	/**
	 * A failed READ and an ABSENT asset stay two answers, for the reason `assetNotFound`
	 * records: collapsing them tells a user their catalogue entry is gone about a note whose
	 * bytes are sitting on disk. Both arms, because a build with one branch passes either one
	 * alone.
	 */
	it('propagates a failed asset read rather than reporting the asset gone', async () => {
		const h = await seeded({
			assets: (real) => ({ ...real, getById: () => Promise.resolve(err(VAULT_FAULT)) }),
		});

		const result = await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING });

		expect(expectErr(result).code).toBe('vault.unexpected-failure');
	});

	it('refuses an asset that is not there, rather than writing a sidecar for an invented id', async () => {
		const h = await seeded();
		const invented = createAssetId();

		const result = await h.calibrate.execute({ assetId: invented, ...DOUBLING });

		expect(expectErr(result).code).toBe('asset.not-found');
		expect((await h.sidecar.read(invented)).ok).toBe(true);
		expect(expectOk(await h.sidecar.read(invented)).document.calibration).toBeNull();
	});

	it('propagates a failed sidecar read', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith());
		const failing = new CalibrateAssetCommand({
			sidecar: { read: () => Promise.resolve(err(VAULT_FAULT)), write: (...args) => h.sidecar.write(...args) },
			assets: h.stack.assets,
			locks: new ReferenceLocks(),
			events: h.events,
		});

		const result = await failing.execute({ assetId: h.assetId, ...DOUBLING });

		expect(expectErr(result).code).toBe('vault.unexpected-failure');
	});

	/**
	 * The write is conditional on what this execute's own read returned unless the caller
	 * presented its own expectation, and a stale one is refused rather than merged: an
	 * unconditional whole-document replace is a lost update the moment two designer leaves show
	 * one asset.
	 */
	it('refuses a stale expectation rather than replacing the whole document', async () => {
		const h = await seeded();
		await h.seedShape(shapeWith({ footprintPending: true }));
		const stale = expectOk(await h.sidecar.read(h.assetId)).version;
		// Somebody else writes, so `stale` names a revision the sidecar no longer has.
		expectOk(await h.sidecar.write(h.assetId, { calibration: null, shape: shapeWith() }));

		const result = await h.calibrate.execute({ assetId: h.assetId, ...DOUBLING, expected: stale });

		expect(expectErr(result).category).toBe('Validation');
		expect((await h.stored()).calibration).toBeNull();
	});
});
