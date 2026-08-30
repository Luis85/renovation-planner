import { describe, expect, it } from 'vitest';
import { CreateZoneCommand } from '../../../../src/application/commands/zone/CreateZone';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	expectErr,
	expectOk,
	injectedPersistenceError,
	injectedReadFailure,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makePlan, squareAt } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';

const wired = () => {
	const plans = new InMemoryPlanRepository();
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	return {
		plans,
		zones,
		events,
		command: new CreateZoneCommand(zones, plans, events),
	};
};

const seedPlan = async (plans: InMemoryPlanRepository) => {
	const plan = makePlan({ projectId: createProjectId() });
	await plans.save(plan, 'absent');
	return plan;
};

describe('CreateZoneCommand', () => {
	it('creates under an existing plan, denormalizing projectId, and publishes ZoneCreated', async () => {
		const { plans, zones, events, command } = wired();
		const plan = await seedPlan(plans);

		const result = await command.execute({
			planId: plan.id,
			name: 'Living room',
			zoneType: 'Room',
			geometry: squareAt(),
		});
		const { zone } = expectOk(result);
		expect(zone.entity.projectId).toBe(plan.projectId);
		expect(zone.entity.planId).toBe(plan.id);

		const found = await zones.getById(zone.entity.id);
		expect(expectOk(found)?.entity.name).toBe('Living room');

		expect(events.published).toEqual([
			{
				type: 'ZoneCreated',
				payload: { zoneId: zone.entity.id, planId: plan.id, projectId: plan.projectId },
			},
		]);
	});

	it('refuses a missing plan with a ReferenceError', async () => {
		const { events, command } = wired();
		const error = expectErr(
			await command.execute({
				planId: 'plan-missing' as never,
				name: 'Living room',
				zoneType: 'Room',
				geometry: squareAt(),
			}),
		);
		expect(error).toMatchObject({ category: 'Reference', code: 'zone.plan-not-found' });
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed parent read rather than a missing plan', async () => {
		const { zones, events } = wired();
		class FailingRead extends InMemoryPlanRepository {
			override getById() {
				return Promise.resolve(injectedReadFailure());
			}
		}
		const error = expectErr(
			await new CreateZoneCommand(zones, new FailingRead(), events).execute({
				planId: 'plan-x' as never,
				name: 'Living room',
				zoneType: 'Room',
				geometry: squareAt(),
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(error.category).toBe('Persistence');
	});

	it('propagates zone validation — bad name and bad geometry — without saving', async () => {
		const { plans, zones, events, command } = wired();
		const plan = await seedPlan(plans);

		const nameError = expectErr(
			await command.execute({
				planId: plan.id,
				name: '',
				zoneType: 'Room',
				geometry: squareAt(),
			}),
		);
		expect(nameError.code).toBe('zone.empty-name');

		const geometryError = expectErr(
			await command.execute({
				planId: plan.id,
				name: 'Living room',
				zoneType: 'Room',
				geometry: { points: [{ x: 0, y: 0 }] },
			}),
		);
		expect(geometryError).toMatchObject({ category: 'Geometry', code: 'polygon-too-few-points' });

		expect(expectOk(await zones.listByPlan(plan.id))).toHaveLength(0);
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed save', async () => {
		const { plans, events } = wired();
		class FailingSave extends InMemoryZoneRepository {
			override save() {
				return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
			}
		}
		const zones = new FailingSave();
		const plan = await seedPlan(plans);
		const error = expectErr(
			await new CreateZoneCommand(zones, plans, events).execute({
				planId: plan.id,
				name: 'Living room',
				zoneType: 'Room',
				geometry: squareAt(),
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});

	// `status` is OPTIONAL and it defaults, so the two arms are one test rather than two:
	// what matters is that the command FORWARDS what it was given instead of dropping it.
	// It dropped it until the sample-project seed needed a plan showing all three statuses
	// — `Zone.create` has always accepted one, and this input is what could not express it.
	it('forwards an explicit status and defaults to Planned without one', async () => {
		const { plans, zones, command } = wired();
		const plan = await seedPlan(plans);

		const explicit = expectOk(
			await command.execute({
				planId: plan.id,
				name: 'Bathroom',
				zoneType: 'Room',
				status: 'InProgress',
				geometry: squareAt(),
			}),
		);
		const defaulted = expectOk(
			await command.execute({
				planId: plan.id,
				name: 'Kitchen',
				zoneType: 'Room',
				geometry: squareAt(9000, 9000),
			}),
		);

		expect(explicit.zone.entity.status).toBe('InProgress');
		expect(defaulted.zone.entity.status).toBe('Planned');
		// Persisted, not merely returned: a status the repository never saw would read back
		// as `Planned` the moment the editor hydrated from the vault.
		expect(expectOk(await zones.getById(explicit.zone.entity.id))?.entity.status).toBe('InProgress');
	});
});
