import { describe, expect, it } from 'vitest';
import { CalibratePlanCommand } from '../../src/application/commands/plan/CalibratePlan';
import { CreatePlanCommand } from '../../src/application/commands/plan/CreatePlan';
import { CreateProjectCommand } from '../../src/application/commands/project/CreateProject';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { DeleteZoneCommand } from '../../src/application/commands/zone/DeleteZone';
import { MoveSpatialObjectCommand } from '../../src/application/commands/zone/MoveSpatialObject';
import { GetPlan } from '../../src/application/queries/GetPlan';
import { GetProject } from '../../src/application/queries/GetProject';
import { GetZone } from '../../src/application/queries/GetZone';
import { InMemoryPlanRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectOk, RecordingEventBus } from '../helpers/domain';
import { squareAt } from '../helpers/entities';

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
		const events = new RecordingEventBus();

		const project = expectOk(
			await new CreateProjectCommand(projects, events).execute({ name: 'Flat renovation' }),
		).project.entity;

		const plan = expectOk(
			await new CreatePlanCommand(plans, projects, events).execute({
				projectId: project.id,
				name: 'Top floor',
			}),
		).plan.entity;

		expectOk(
			await new CalibratePlanCommand(plans, events).execute({
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

		expectOk(await new DeleteZoneCommand(zones, events).execute({ zoneId: created.id }));

		// Queries read what the commands left behind.
		const queriedProject = await new GetProject(projects).execute({ projectId: project.id });
		expect(expectOk(queriedProject)?.entity.name).toBe('Flat renovation');

		const queriedPlan = await new GetPlan(plans).execute({ planId: plan.id });
		expect(expectOk(queriedPlan)?.entity.calibration?.pixelsPerWorldUnit).toBeCloseTo(0.05);
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
