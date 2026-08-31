import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectFound, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity, makeZone as makeZoneEntity } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import type { Zone } from '../../../../src/domain/zone/Zone';
import { ObsidianPlanGeometrySidecar } from '../../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { ReversibleCalibratePlanCommand } from '../../../../src/application/commands/plan/ReversibleCalibratePlan';
import { distance } from '../../../../src/core/geometry/operations';
import type { PlanGeometryDocument } from '../../../../src/application/ports/PlanGeometrySidecar';

const seeded = async () => {
	const stack = createRepositoryStack();
	const projectId = createProjectId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	const plan = makePlanEntity({ projectId });
	expectOk(await stack.plans.save(plan, 'absent'));
	const zones: Zone[] = [
		makeZoneEntity({
			projectId,
			planId: plan.id,
			geometry: { points: [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }] },
		}),
		makeZoneEntity({
			projectId,
			planId: plan.id,
			geometry: { points: [{ x: -3, y: 0 }, { x: -4, y: 0 }, { x: -4, y: -1 }] },
		}),
	];
	for (const zone of zones) {
		expectOk(await stack.zones.save(zone, 'absent'));
	}
	return {
		stack,
		zones,
		projectId,
		planId: plan.id,
		sidecar: new ObsidianPlanGeometrySidecar(stack.store),
	};
};

describe('ObsidianPlanGeometrySidecar', () => {
	it('reads the live document with domain shapes and a version', async () => {
		const { sidecar, planId, zones } = await seeded();
		const snapshot = expectOk(await sidecar.read(planId));
		expect(snapshot.document.calibration).toBeNull();
		expect(snapshot.document.objects.map((object) => object.id)).toEqual(zones.map((zone) => zone.id));
		const firstObject = snapshot.document.objects[0];
		if (!firstObject) throw new Error('no geometry entries were read');
		expect(firstObject.points[0]).toEqual({ x: 1, y: 1 });
		expect(snapshot.version.revision).toBeGreaterThan(0);
	});

	it('writes calibration and rescaled objects as one revision bump, and reads them back unchanged', async () => {
		const { sidecar, planId } = await seeded();
		const before = expectOk(await sidecar.read(planId));

		const document: PlanGeometryDocument = {
			calibration: {
				pointA: { x: 3248, y: 960 },
				pointB: { x: 3248, y: 4160 },
				knownDistance: 3200,
				pixelsPerWorldUnit: 0.25,
			},
			objects: before.document.objects.map((object) => ({
				id: object.id,
				points: object.points.map((point) => ({ x: point.x * 4, y: point.y * 4 })),
			})),
		};
		const written = expectOk(await sidecar.write(planId, document));
		expect(written.revision).toBe(before.version.revision + 1);

		const after = expectOk(await sidecar.read(planId));
		expect(after.document).toEqual(document);
		// The persisted calibration measures its own knownDistance.
		const savedCalibration = after.document.calibration;
		if (!savedCalibration) throw new Error('calibration was not persisted');
		expect(distance(savedCalibration.pointA, savedCalibration.pointB)).toBeCloseTo(3200);
	});

	it('refuses a stale expectation with plan-geometry.revision-conflict', async () => {
		const { sidecar, planId } = await seeded();
		const stale = expectOk(await sidecar.read(planId)).version;
		await sidecar.write(planId, { calibration: null, objects: [] });

		const error = expectErr(await sidecar.write(planId, { calibration: null, objects: [] }, stale));
		expect(error).toMatchObject({ category: 'Validation', code: 'plan-geometry.revision-conflict' });
	});

	it('surfaces a failed read as itself — a plan with no indexed sidecar', async () => {
		const stack = createRepositoryStack();
		const sidecar = new ObsidianPlanGeometrySidecar(stack.store);
		const error = expectErr(await sidecar.read('plan-none' as never));
		expect(error).toMatchObject({ category: 'Persistence', code: 'plan-geometry.path-unresolved' });
	});
});

describe('calibration undo against the real sidecar (design slice 7, DoD 3)', () => {
	const PICKED_A = { x: 0, y: 0 };
	const PICKED_B = { x: 800, y: 0 };

	const calibrated = async () => {
		const wired = await seeded();
		const events = new RecordingEventBus();
		const command = new ReversibleCalibratePlanCommand(wired.stack.plans, wired.sidecar, events);
		expectOk(
			await command.execute({ planId: wired.planId, pointA: PICKED_A, pointB: PICKED_B, knownDistance: 3200 }),
		);
		return { ...wired, command };
	};

	it('refuses when a zone moved through its own repository between calibrate and undo', async () => {
		const { stack, zones, planId, command, sidecar } = await calibrated();

		const loaded = expectFound(await stack.zones.getById(zones[0].id));
		const moved = loaded.entity.withGeometry({
			points: [{ x: 500, y: 500 }, { x: 600, y: 500 }, { x: 600, y: 600 }],
		});
		if (!moved.ok) throw new Error(moved.error.message);
		expectOk(await stack.zones.save(moved.value, loaded.version));

		const error = expectErr(await command.undo());
		expect(error).toMatchObject({ category: 'Validation', code: 'plan-geometry.revision-conflict' });

		// Both survive: the move is intact AND the calibration was not half-restored.
		const document = expectOk(await sidecar.read(planId)).document;
		expect(document.calibration).not.toBeNull();
		const movedEntry = document.objects.find((object) => object.id === zones[0].id);
		if (!movedEntry) throw new Error('the moved zone vanished from the sidecar');
		expect(movedEntry.points[2]).toEqual({ x: 600, y: 600 });
	});

	it('refuses a hand edit of the .rpgeo file that left the revision alone', async () => {
		const { stack, planId, command } = await calibrated();

		const path = stack.index.getGeometrySidecarPath(planId);
		if (!path) throw new Error('no sidecar path indexed');
		const raw = JSON.parse(stack.vault.entries.get(path) ?? '{}') as {
			objects: { points: [number, number][] }[];
		};
		const firstEntry = raw.objects[0];
		if (!firstEntry) throw new Error('no geometry entry to hand-edit');
		firstEntry.points[0][0] = 424_242; // content moves, revision does not
		stack.vault.entries.set(path, JSON.stringify(raw));

		const error = expectErr(await command.undo());
		expect(error).toMatchObject({ category: 'Validation', code: 'plan-geometry.external-modification' });
	});
});
