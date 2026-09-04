import { describe, expect, it } from 'vitest';
import { INSPECTOR_SECTIONS, buildRoomOverview } from '../../../src/presentation/read-models/roomOverview';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';

describe('buildRoomOverview', () => {
	it('carries the same id as the zone and the floor it sits on', () => {
		const overview = buildRoomOverview(FIXTURE_ZONES[0], FIXTURE_PLAN);
		expect(overview.record.id).toBe(FIXTURE_ZONES[0].id);
		expect(overview.floorName).toBe(FIXTURE_PLAN.name);
	});

	it('marks every future section unavailable in this increment — none is empty, none has a count', () => {
		const overview = buildRoomOverview(FIXTURE_ZONES[0], FIXTURE_PLAN);
		expect([...overview.unavailableSections]).toEqual([...INSPECTOR_SECTIONS]);
	});
});
