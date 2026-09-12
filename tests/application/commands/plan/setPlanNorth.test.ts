import { describe, expect, it } from 'vitest';
import { planNorthServices } from '../../../../src/application/commands/plan/SetPlanNorth';
import { withPlanNorth } from '../../../../src/domain/plan/Plan';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { InMemoryPlanRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { expectErr, expectFound, expectOk, RecordingEventBus } from '../../../helpers/domain';
import { makePlan } from '../../../helpers/entities';

async function wired(north?: number) {
	const plans = new InMemoryPlanRepository(), events = new RecordingEventBus();
	const loaded = expectOk(await plans.save(makePlan({ projectId: createProjectId(), north }), 'absent'));
	const stored = async () => expectFound(await plans.getById(loaded.entity.id));
	return { plans, events, loaded, stored, services: planNorthServices(plans, events) };
}

describe('setting a plan north', () => {
	it('writes the bearing, announces it, and undo and redo walk it back and forth', async () => {
		const { events, loaded, stored, services } = await wired(30);
		const command = services.command(loaded.entity.id, 90);

		expect(expectOk(await command.execute())).toBe('wrote');
		expect((await stored()).entity.north).toBe(90);
		expect(events.published).toEqual([{ type: 'PlanNorthChanged', payload: { planId: loaded.entity.id, projectId: loaded.entity.projectId } }]);
		expect(expectOk(await command.execute())).toBe('no-write');

		expect(expectOk(await command.undo())).toBe('wrote');
		expect((await stored()).entity.north).toBe(30);
		expect(events.published.map(event => event.type)).toEqual(['PlanNorthChanged', 'PlanNorthChanged']);
		expect(expectOk(await command.undo())).toBe('no-write');
		expect(events.published).toHaveLength(2);

		expect(expectOk(await command.execute())).toBe('wrote');
		expect((await stored()).entity.north).toBe(90);
	});

	it('restores an unset north as unset', async () => {
		const { loaded, stored, services } = await wired();
		const command = services.command(loaded.entity.id, 180);
		expectOk(await command.execute());
		expectOk(await command.undo());
		expect((await stored()).entity.north).toBeUndefined();
	});

	it('refuses an undo once another write moved the plan, and leaves that write standing', async () => {
		const { plans, loaded, stored, services } = await wired();
		const command = services.command(loaded.entity.id, 180);
		expectOk(await command.execute());
		const current = await stored();
		expectOk(await plans.save(expectOk(withPlanNorth(current.entity, 45)), current.version));

		expect(expectErr(await command.undo()).code).toBe('plan.revision-conflict');
		expect((await stored()).entity.north).toBe(45);
	});

	it('refuses a missing plan and an invalid bearing without writing', async () => {
		const { events, loaded, stored, services } = await wired();
		expect(expectErr(await services.command(createPlanId(), 90).execute()).code).toBe('plan.plan-not-found');
		expect(expectErr(await services.command(loaded.entity.id, 361).execute()).code).toBe('plan.invalid-north');
		expect((await stored()).entity.north).toBeUndefined();
		expect(events.published).toEqual([]);
	});
});
