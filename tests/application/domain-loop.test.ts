import { describe, expect, it } from 'vitest';
import { makeDeleteZoneCommand } from '../helpers/slice10';
import { ReversibleCalibratePlanCommand } from '../../src/application/commands/plan/ReversibleCalibratePlan';
import { CreatePlanCommand } from '../../src/application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../../src/application/commands/project/CreateProject';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../src/application/commands/zone/MoveSpatialObject';
import { GetPlan } from '../../src/application/queries/GetPlan';
import { GetProject } from '../../src/application/queries/GetProject';
import { GetZone } from '../../src/application/queries/GetZone';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectOk, RecordingEventBus } from '../helpers/domain';
import { InMemoryPlanGeometrySidecar } from '../helpers/geometry-sidecar';
import { squareAt } from '../helpers/entities';
import { distance } from '../../src/core/geometry/operations';
// `DEFAULT_SETTINGS.defaultCurrency` rather than a direct `currencyOf` import: this file
// already imports `distance` straight from `core/geometry/operations`, and that module and
// `core/money/Money` both export a `scale` — fallow's duplicate-exports check flags a file
// that imports directly from both as an ambiguity risk. Going through settings avoids a
// second direct import of `core/money/Money` here without touching either module.
import { DEFAULT_SETTINGS } from '../../src/plugin/settings/settings';

const origin = { x: 0, y: 0 };

/**
 * Design slice 3's success criterion (SDD Increment 2, scoped to Project/Plan/Zone):
 * a renovation project with a floor plan and a room zone can be created, calibrated,
 * moved and queried — in one test file, against in-memory repositories only, touching
 * zero Obsidian API surface. The module graph of everything imported here contains no
 * `obsidian`, `vue`, `pinia` or `konva` — enforced statically by the ESLint layer bans.
 */
describe('the domain loop, end to end', () => {
	it('creates a project, a plan, calibrates it, then creates, moves and deletes a zone', async () => {
		const projects = new InMemoryProjectRepository();
		const plans = new InMemoryPlanRepository();
		const zones = new InMemoryZoneRepository();
		const sidecar = new InMemoryPlanGeometrySidecar();
		const events = new RecordingEventBus();

		const project = expectOk(
			await new CreateProjectCommand(projects, events, DEFAULT_SETTINGS.defaultCurrency).execute({
				name: 'Flat renovation',
			}),
		).project.entity;

		const plan = expectOk(
			await new CreatePlanCommand(plans, projects, events).execute({
				projectId: project.id,
				name: 'Top floor',
			}),
		).plan.entity;

		// Calibration lives in the geometry sidecar, not the note, so the loop needs the
		// port the command writes through — the only writer of that field.
		sidecar.seed(plan.id, { calibration: null, objects: [] });
		expectOk(
			await new ReversibleCalibratePlanCommand(plans, sidecar, events).execute({
				planId: plan.id,
				pointA: { x: 0, y: 0 },
				pointB: { x: 200, y: 0 },
				knownDistance: 4000,
			}),
		);

		const created = expectOk(
			await new CreateZoneCommand(zones, plans, events).execute({
				planId: plan.id,
				name: 'Bedroom',
				zoneType: 'Room',
				geometry: squareAt(),
			}),
		).zone.entity;
		expect(expectOk(created.area())).toBe(100);

		expectOk(
			await new MoveSpatialObjectCommand(zones, events).execute({
				zoneId: created.id,
				geometry: squareAt(1000, 500),
			}),
		);

		expectOk(await makeDeleteZoneCommand(zones, events).execute({ zoneId: created.id }));

		// Queries read what the commands left behind.
		const queriedProject = await new GetProject(projects).execute({ projectId: project.id });
		expect(expectOk(queriedProject)?.entity.name).toBe('Flat renovation');

		const queriedPlan = await new GetPlan(plans).execute({ planId: plan.id });
		expect(expectOk(queriedPlan)?.entity.name).toBe('Top floor');
		// Read where it was written. `InMemoryPlanRepository` holds notes only — merging the
		// sidecar's calibration into the entity is `ObsidianPlanRepository`'s read path, and
		// asserting it here would be asserting against this fake instead of the loop.
		const calibrated = sidecar.peek(plan.id)?.calibration;
		expect(calibrated?.pixelsPerWorldUnit).toBeCloseTo(0.05);
		// Post-rescale, so the persisted pair measures exactly what the user said it did.
		expect(distance(calibrated?.pointA ?? origin, calibrated?.pointB ?? origin)).toBeCloseTo(4000);
		expect(await new GetZone(zones).execute({ zoneId: created.id })).toEqual({ ok: true, value: null });

		expect(events.published.map((event) => event.type)).toEqual([
			'ProjectCreated',
			'PlanCreated',
			'PlanCalibrated',
			'ZoneCreated',
			'ZoneGeometryChanged',
			'ZoneDeleted',
		]);
	});
});
