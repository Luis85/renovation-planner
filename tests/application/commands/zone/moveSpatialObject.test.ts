import { describe, expect, it } from 'vitest';
import { MoveSpatialObjectCommand } from '../../../../src/application/commands/zone/MoveSpatialObject';
import { InMemoryZoneRepository } from '../../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	expectErr,
	expectOk,
	injectedReadFailure,
	observationToken,
	RecordingEventBus,
} from '../../../helpers/domain';
import { makeZone, squareAt } from '../../../helpers/entities';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

const wired = () => {
	const zones = new InMemoryZoneRepository();
	const events = new RecordingEventBus();
	return { zones, events, command: new MoveSpatialObjectCommand(zones, events) };
};

const seed = async (zones: InMemoryZoneRepository) => {
	const zone = makeZone({
		projectId: 'project-seed' as ProjectId,
		planId: 'plan-seed' as PlanId,
	});
	await zones.save(zone, 'absent');
	return zone;
};

describe('MoveSpatialObjectCommand', () => {
	it('replaces the whole geometry and publishes ZoneGeometryChanged', async () => {
		const { zones, events, command } = wired();
		const zone = await seed(zones);

		const result = await command.execute({ zoneId: zone.id, geometry: squareAt(999, 999) });
		const { zone: saved } = expectOk(result);
		expect(saved.entity.geometry).toEqual(squareAt(999, 999));
		expect(saved.version.revision).toBe(2);
		expect(expectOk(await zones.getById(zone.id))?.entity.geometry).toEqual(squareAt(999, 999));

		expect(events.published).toEqual([
			{
				type: 'ZoneGeometryChanged',
				payload: { zoneId: zone.id, planId: zone.planId, projectId: zone.projectId },
			},
		]);
	});

	it('is last-writer-wins when no expectation is given', async () => {
		// A fresh gesture asserts where the shape should now be: even if the stored bytes
		// changed out-of-band since some earlier read, the command reloads and writes.
		const { zones, command } = wired();
		const zone = await seed(zones);
		zones.poke(zone.id);
		const result = await command.execute({ zoneId: zone.id, geometry: squareAt(5, 5) });
		expect(expectOk(result).zone.version.revision).toBe(2);
	});

	it('honours a caller-supplied expectation and refuses on mismatch', async () => {
		const { zones, events, command } = wired();
		const zone = await seed(zones);
		const stale = {
			revision: 1,
			observed: observationToken('not-what-is-stored'),
		};
		const error = expectErr(
			await command.execute({ zoneId: zone.id, geometry: squareAt(), expected: stale }),
		);
		expect(error.code).toBe('zone.external-modification');
		expect(events.published).toHaveLength(0);
	});

	it('surfaces a failed read rather than a missing zone', async () => {
		const { events } = wired();
		class FailingRead extends InMemoryZoneRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		const error = expectErr(
			await new MoveSpatialObjectCommand(new FailingRead(), events).execute({
				zoneId: 'zone-x' as never,
				geometry: squareAt(),
			}),
		);
		expect(error.code).toBe('test.injected-failure');
		expect(events.published).toHaveLength(0);
	});

	it('refuses a missing zone with a ReferenceError', async () => {
		const { events, command } = wired();
		const error = expectErr(
			await command.execute({ zoneId: 'zone-missing' as never, geometry: squareAt() }),
		);
		expect(error).toMatchObject({ category: 'Reference', code: 'zone.zone-not-found' });
		expect(events.published).toHaveLength(0);
	});

	it('propagates a geometry failure without saving or publishing', async () => {
		const { zones, events, command } = wired();
		const zone = await seed(zones);
		const error = expectErr(
			await command.execute({ zoneId: zone.id, geometry: { points: [] } }),
		);
		expect(error.code).toBe('polygon-too-few-points');
		expect(events.published).toHaveLength(0);
	});
});
