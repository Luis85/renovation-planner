import { describe, expect, it } from 'vitest';
import {
	ReversibleCalibratePlanCommand,
} from '../../../../src/application/commands/plan/ReversibleCalibratePlan';
import type {
	PlanGeometryDocument,
	SpatialObjectGeometry,
} from '../../../../src/application/ports/PlanGeometrySidecar';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { distance } from '../../../../src/core/geometry/operations';
import { expectErr, expectOk, RecordingEventBus } from '../../../helpers/domain';
import {
	InMemoryPlanGeometrySidecar,
	InterleavingPlanGeometrySidecar,
} from '../../../helpers/geometry-sidecar';
import { makePlan } from '../../../helpers/entities';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import type { PlanId } from '../../../../src/domain/plan/PlanId';

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

		// The WHOLE cascade travels both directions: execute announces `PlanCalibrated` plus
		// one `ZoneGeometryChanged` per rescaled object, and undo announces exactly the same
		// set. `PlanCalibrated` is the one of the two a Plan Editor leaf subscribes to, so an
		// undo that omitted it refreshed no leaf at all — which is what this used to assert.
		const types = w.events.published.slice(1).map((event) => event.type);
		expect(types).toEqual([
			'ZoneGeometryChanged',
			'PlanCalibrated',
			'ZoneGeometryChanged',
		]);
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

/**
 * The SANDWICH, asked of the one adapter that keeps its own `lastWritten` field rather than
 * sharing the history's `WriteLedger` — a foreign write between two of this history's own
 * gestures, whose damage on every ledger-backed adapter is that the second gesture's undo
 * advances the ledger's tip and the FIRST gesture's undo then matches it and writes a
 * pre-peer snapshot back.
 *
 * **Measured rather than assumed, because the shape of the field is not the shape of the
 * exposure.** A private field is per-GESTURE, so gesture one conditions its restore on the
 * version IT wrote and nothing else: a peer write, plus everything the second gesture and its
 * own undo then wrote on top, all leave the sidecar somewhere that version is not, and the
 * store refuses. The `WriteLedger` is the thing that would have carried the second gesture's
 * progress back to the first, and this adapter deliberately does not have one — for the
 * OPPOSITE reason, stated in its own header: design slice 7's DoD refuses an undo when
 * anything at all touched the sidecar in between, including a legitimate sibling.
 *
 * So this case pins an IMMUNITY rather than a repair. It is here so that a later change
 * moving this adapter onto the shared ledger — the obvious tidy-up, since its four siblings
 * are on one — fails at an assertion rather than reintroducing a P1 quietly.
 */
describe('a foreign write sandwiched between two calibration gestures', () => {
	it('refuses the first gesture undo, because a private lastWritten is not a shared tip', async () => {
		const w = await wired([zoneEntry('zone-1' as never, 10)]);
		const gestureOne = w.command;
		expectOk(await gestureOne.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		const afterOne = expectOk(await w.sidecar.read(w.planId));

		// A peer leaf, or a synced change: outside this history entirely.
		expectOk(
			await w.sidecar.write(
				w.planId,
				{ ...afterOne.document, objects: [zoneEntry('zone-1' as never, 999)] },
				afterOne.version,
			),
		);

		const gestureTwo = new ReversibleCalibratePlanCommand(w.plans, w.sidecar, w.events);
		expectOk(await gestureTwo.execute({ planId: w.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: KNOWN_MM }));
		expectOk(await gestureTwo.undo());

		const error = expectErr(await gestureOne.undo());
		expect(error.code).toBe('plan-geometry.revision-conflict');
		// The peer's object survives, which is the consequence the refusal buys rather than a
		// restatement of it.
		expect(expectOk(await w.sidecar.read(w.planId)).document.objects[0]?.points[0]?.x).toBeCloseTo(999);
	});
});
