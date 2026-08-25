import { describe, expect, it } from 'vitest';
import {
	ReversibleCalibratePlanCommand,
} from '../../../../src/application/commands/plan/ReversibleCalibratePlan';
import type {
	PlanGeometryDocument,
	PlanGeometrySidecar,
	PlanGeometrySnapshot,
	SpatialObjectGeometry,
} from '../../../../src/application/ports/PlanGeometrySidecar';
import type { EntityVersion } from '../../../../src/application/ports/versioning';
import { externalModification, revisionConflict } from '../../../../src/application/ports/versioning';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { distance } from '../../../../src/core/geometry/operations';
import { err, ok, type Result } from '../../../../src/core/result/Result';
import type { PersistenceError, ValidationError } from '../../../../src/core/errors/AppError';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	RecordingEventBus,
	type observationToken,
} from '../../../helpers/domain';
import { makePlan } from '../../../helpers/entities';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import type { PlanId } from '../../../../src/domain/plan/PlanId';

/**
 * An HONEST in-memory sidecar: the version contract is enforced, not decorated. `poke`
 * models another plugin writer (revision moves), `scratch` a hand edit that left the
 * revision alone (only the content digest moves) — the two refusals an undo must tell
 * apart, per slice 6's snapshot-inverse rule.
 */
class InMemoryPlanGeometrySidecar implements PlanGeometrySidecar {
	private readonly plans = new Map<
		string,
		{ document: PlanGeometryDocument; version: EntityVersion }
	>();
	failNextWrite = false;

	private digest(document: PlanGeometryDocument): ReturnType<typeof observationToken> {
		return JSON.stringify(document) as never;
	}

	seed(planId: PlanId, document: PlanGeometryDocument): void {
		this.plans.set(planId, {
			document,
			version: { revision: 1, observed: this.digest(document) },
		});
	}

	poke(planId: PlanId): void {
		const entry = this.plans.get(planId);
		if (!entry) throw new Error(`nothing seeded under ${planId}`);
		entry.version = { revision: entry.version.revision + 1, observed: this.digest(entry.document) };
	}

	scratch(planId: PlanId): void {
		const entry = this.plans.get(planId);
		if (!entry) throw new Error(`nothing seeded under ${planId}`);
		const document = structuredClone(entry.document);
		const first = document.objects[0];
		if (first) {
			document.objects = [{ ...first, points: [{ x: 999, y: 999 }, ...first.points.slice(1)] }];
		}
		entry.document = document;
	}

	read(planId: PlanId): Promise<Result<PlanGeometrySnapshot, PersistenceError | ValidationError>> {
		const entry = this.plans.get(planId);
		if (!entry) return Promise.resolve(err(injectedPersistenceError()));
		return Promise.resolve(ok({ document: structuredClone(entry.document), version: entry.version }));
	}

	write(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>> {
		return Promise.resolve(this.writeSync(planId, document, expected));
	}

	private writeSync(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Result<EntityVersion, PersistenceError | ValidationError> {
		const entry = this.plans.get(planId);
		if (!entry) return err(injectedPersistenceError());
		if (this.failNextWrite) {
			this.failNextWrite = false;
			return err(injectedPersistenceError());
		}
		if (expected) {
			if (expected.revision !== entry.version.revision) {
				return err(revisionConflict('plan-geometry', String(planId)));
			}
			// Like the real store: the digest is recomputed from what the bytes hold NOW,
			// never replayed from a stored token.
			if (expected.observed !== this.digest(entry.document)) {
				return err(externalModification('plan-geometry', String(planId)));
			}
		}
		const version: EntityVersion = {
			revision: entry.version.revision + 1,
			observed: this.digest(document),
		};
		entry.document = structuredClone(document);
		entry.version = version;
		return ok(version);
	}
}

/**
 * Extends the honest fake with one interleaving hook: `intercene` runs when the
 * command's WRITE begins — strictly after its READ — which is how a concurrent writer
 * landing between the two lock acquisitions is simulated. The base fake cannot catch
 * that race even in principle: it is synchronous and cannot interleave.
 */
class InterleavingPlanGeometrySidecar extends InMemoryPlanGeometrySidecar {
	intercene: (() => void) | null = null;

	override write(
		planId: PlanId,
		document: PlanGeometryDocument,
		expected?: EntityVersion,
	): Promise<Result<EntityVersion, PersistenceError | ValidationError>> {
		this.intercene?.();
		return super.write(planId, document, expected);
	}
}

const PICKED_A = { x: 812, y: 240 };
const PICKED_B = { x: 812, y: 1040 }; // 800 world units apart
const KNOWN_MM = 3200;

interface Wired {
	plans: InMemoryPlanRepository;
	events: RecordingEventBus;
	sidecar: InMemoryPlanGeometrySidecar;
	command: ReversibleCalibratePlanCommand;
	planId: PlanId;
	projectId: ProjectId;
}

const wired = async (
	seedObjects: readonly SpatialObjectGeometry[] = [],
	seedCalibration: PlanGeometryDocument['calibration'] = null,
): Promise<Wired> => {
	const projectId = createProjectId();
	const plan = makePlan({ projectId });
	const plans = new InMemoryPlanRepository();
	await plans.save(plan, 'absent');
	const events = new RecordingEventBus();
	const sidecar = new InMemoryPlanGeometrySidecar();
	sidecar.seed(plan.id, { calibration: seedCalibration, objects: seedObjects });
	return {
		plans,
		events,
		sidecar,
		command: new ReversibleCalibratePlanCommand(plans, sidecar, events),
		planId: plan.id,
		projectId,
	};
};

const zoneEntry = (id: string, x: number): SpatialObjectGeometry => ({
	id,
	points: [
		{ x, y: 0 },
		{ x: x + 100, y: 0 },
		{ x: x + 100, y: 100 },
	],
});

describe('ReversibleCalibratePlanCommand', () => {
	it('persists a first calibration whose own points already measure knownDistance', async () => {
		const w = await wired();
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));

		const saved = expectOk(await w.sidecar.read(w.planId)).document.calibration;
		if (!saved) throw new Error('calibration was not persisted');
		expect(distance(saved.pointA, saved.pointB)).toBeCloseTo(KNOWN_MM);
		// Picked 800 apart, corrected by 3200/800.
		expect(saved.pointB.x).toBeCloseTo(PICKED_B.x * 4);
		expect(saved.pixelsPerWorldUnit).toBeCloseTo(1 / 4);
	});

	it('emits only PlanCalibrated when there are no spatial objects', async () => {
		const w = await wired();
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		expect(w.events.published).toEqual([
			{ type: 'PlanCalibrated', payload: { planId: w.planId, projectId: w.projectId } },
		]);
	});

	it('rescales every spatial object in the same write and announces each', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10), zoneEntry('zone-2' as never, -40)]);
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));

		const { document } = expectOk(await w.sidecar.read(w.planId));
		expect(document.objects.map((object) => object.points[2])).toEqual([
			{ x: 440, y: 400 },
			{ x: 240, y: 400 },
		]);

		const types = w.events.published.map((event) => event.type);
		expect(types).toEqual(['PlanCalibrated', 'ZoneGeometryChanged', 'ZoneGeometryChanged']);
		expect(w.events.published[1]).toMatchObject({
			payload: { zoneId: 'zone-1', planId: w.planId, projectId: w.projectId },
		});
	});

	it('recalibrates against the previous scale', async () => {
		const previous = {
			pointA: { x: 0, y: 0 },
			pointB: { x: 2000, y: 0 },
			knownDistance: 2000,
			pixelsPerWorldUnit: 1,
		};
		const w = await wired([], previous);
		expectOk(
			await w.command.execute({
				planId: w.planId,
				pointA: { x: 0, y: 0 },
				pointB: { x: 1000, y: 0 },
				knownDistance: 4000,
			}),
		);
		const saved = expectOk(await w.sidecar.read(w.planId)).document.calibration;
		if (!saved) throw new Error('calibration was not persisted');
		expect(saved.pixelsPerWorldUnit).toBeCloseTo(1 / 4);
	});

	it('undo restores the exact previous document and re-announces every object', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));

		expectOk(await w.command.undo());

		const { document } = expectOk(await w.sidecar.read(w.planId));
		expect(document.calibration).toBeNull();
		const firstObject = document.objects[0];
		if (!firstObject) throw new Error('the seeded zone vanished');
		expect(firstObject.points[2]).toEqual({ x: 110, y: 100 });

		// One ZoneGeometryChanged from execute, one re-emitted by undo.
		const types = w.events.published.slice(1).map((event) => event.type);
		expect(types).toEqual(['ZoneGeometryChanged', 'ZoneGeometryChanged']);
	});

	it('undo refuses against a foreign write and leaves both changes intact', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		w.sidecar.poke(w.planId);

		const error = expectErr(await w.command.undo());

		expect(error).toMatchObject({ category: 'Validation', code: 'plan-geometry.revision-conflict' });
		const { document } = expectOk(await w.sidecar.read(w.planId));
		// The intervening write survived AND so did the calibration — nothing was half-restored.
		expect(document.calibration).not.toBeNull();
		expect(document.objects).toHaveLength(1);
	});

	it('undo refuses a hand edit that left the revision alone', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		w.sidecar.scratch(w.planId);

		const error = expectErr(await w.command.undo());
		expect(error).toMatchObject({ category: 'Validation', code: 'plan-geometry.external-modification' });
	});

	it('a failed write leaves previously valid data intact and publishes nothing', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		w.sidecar.failNextWrite = true;

		const error = expectErr(
			await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }),
		);
		expect(error.code).toBe('test.injected-failure');

		const { document } = expectOk(await w.sidecar.read(w.planId));
		expect(document.calibration).toBeNull();
		const firstObject = document.objects[0];
		if (!firstObject) throw new Error('the seeded zone vanished');
		expect(firstObject.points[2]).toEqual({ x: 110, y: 100 });
		expect(w.events.published).toHaveLength(0);
	});

	it('surfaces derivation failures without touching storage', async () => {
		const w = await wired();
		const error = expectErr(
			await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_A, knownDistance: KNOWN_MM }),
		);
		expect(error).toMatchObject({ category: 'Calculation', code: 'calibration.coincident-points' });
		const { version } = expectOk(await w.sidecar.read(w.planId));
		expect(version.revision).toBe(1);
		expect(w.events.published).toHaveLength(0);
	});

	it('refuses a missing plan with a ReferenceError', async () => {
		const w = await wired();
		const error = expectErr(
			await w.command.execute({ planId: 'plan-missing' as never, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }),
		);
		expect(error.code).toBe('plan.plan-not-found');
	});

	it('surfaces a failed sidecar read rather than calibrating blind', async () => {
		const projectId = createProjectId();
		const plan = makePlan({ projectId });
		const plans = new InMemoryPlanRepository();
		await plans.save(plan, 'absent');
		const events = new RecordingEventBus();
		// No seed: the fake answers every read with the injected failure.
		const sidecar = new InMemoryPlanGeometrySidecar();
		const error = expectErr(
			await new ReversibleCalibratePlanCommand(plans, sidecar, events).execute({
				planId: plan.id,
				pointA: PICKED_A,
				pointB: PICKED_B,
				knownDistance: KNOWN_MM,
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});

	it('refuses an undo with nothing to undo', async () => {
		const w = await wired();
		const error = expectErr(await w.command.undo());
		expect(error.code).toBe('plan.nothing-to-undo');
	});

	it('a foreign write between the read and the write refuses instead of clobbering', async () => {
		const projectId = createProjectId();
		const plan = makePlan({ projectId });
		const plans = new InMemoryPlanRepository();
		await plans.save(plan, 'absent');
		const events = new RecordingEventBus();
		const sidecar = new InterleavingPlanGeometrySidecar();
		sidecar.seed(plan.id, { calibration: null, objects: [zoneEntry('zone-1' as never, 10)] });
		// The Zone move lands AFTER the command has read its snapshot and BEFORE its write:
		// exactly the interleaving two separate lock acquisitions allow.
		sidecar.intercene = () => sidecar.poke(plan.id);
		const command = new ReversibleCalibratePlanCommand(plans, sidecar, events);

		const error = expectErr(
			await command.execute({ planId: plan.id, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }),
		);

		expect(error).toMatchObject({ category: 'Validation', code: 'plan-geometry.revision-conflict' });
		const { document } = expectOk(await sidecar.read(plan.id));
		// The move survived AND nothing was calibrated — no silent lost update.
		expect(document.calibration).toBeNull();
		const untouched = document.objects[0];
		if (!untouched) throw new Error('the seeded zone vanished');
		expect(untouched.points[2]).toEqual({ x: 110, y: 100 });
		expect(events.published).toHaveLength(0);
	});

	it('refuses a correction whose rescaled coordinates overflow to non-finite', async () => {
		// Legal on every axis: an ordinary 100x correction over existing geometry whose
		// coordinates reach 1e307 (the schema allows any number). The RATIO stays finite,
		// but 1e307 times 100 does not — and JSON persists Infinity as null, which the
		// schema then refuses on every later read. The transaction must refuse instead.
		const w = await wired([{ id: 'zone-big' as never, points: [{ x: 1e307, y: 0 }, { x: 1e307, y: 5 }, { x: 5, y: 5 }] }]);
		const error = expectErr(
			await w.command.execute({
				planId: w.planId,
				pointA: { x: 0, y: 0 },
				pointB: { x: 800, y: 0 },
				knownDistance: 80_000,
			}),
		);
		expect(error).toMatchObject({ category: 'Calculation', code: 'calibration.degenerate-scale' });
		const { document, version } = expectOk(await w.sidecar.read(w.planId));
		expect(document.calibration).toBeNull();
		expect(version.revision).toBe(1);
	});

	it('a second undo refuses once the inverse is spent', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		expectOk(await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		expectOk(await w.command.undo());

		const error = expectErr(await w.command.undo());
		expect(error.code).toBe('plan.nothing-to-undo');
	});

	it('an undo after a FAILED execute has nothing to undo', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		w.sidecar.failNextWrite = true;
		expectErr(
			await w.command.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }),
		);

		const error = expectErr(await w.command.undo());
		expect(error.code).toBe('plan.nothing-to-undo');
	});
});
