import { describe, expect, it } from 'vitest';
import { buildFloorSummary, toFloorDto, toSpatialRecordDto } from '../../../src/presentation/read-models/spatialRecords';
import { FIXTURE_PLAN, FIXTURE_PROJECT, FIXTURE_ZONES } from '../../helpers/planFixtures';

const [kitchen, terrace] = FIXTURE_ZONES;

describe('toSpatialRecordDto', () => {
	it('keeps the ZoneId as the record id and calls a Room zone a room', () => {
		const record = toSpatialRecordDto(kitchen);
		expect(record.id).toBe(kitchen.id);
		expect(record.kind).toBe('room');
		expect(record.planId).toBe(kitchen.planId);
	});

	it('calls every other zone type an area', () => {
		expect(toSpatialRecordDto(terrace).kind).toBe('area');
		expect(toSpatialRecordDto({ ...terrace, zoneType: 'Custom' }).kind).toBe('area');
	});

	it('derives area from the points rather than reading a stored figure', () => {
		expect(toSpatialRecordDto(kitchen).areaMm2).toBe(12_000_000); // 4000 × 3000
	});

	it('answers 0 for a degenerate polygon rather than throwing', () => {
		expect(toSpatialRecordDto({ ...kitchen, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }).areaMm2).toBe(0);
	});
});

describe('toFloorDto', () => {
	it('is the plan under its homeowner name, beside its project', () => {
		const floor = toFloorDto(FIXTURE_PLAN, FIXTURE_PROJECT);
		expect(floor).toEqual({ id: FIXTURE_PLAN.id, name: FIXTURE_PLAN.name, projectId: FIXTURE_PROJECT.id, projectName: FIXTURE_PROJECT.name });
	});
});

describe('buildFloorSummary', () => {
	const input = { plan: FIXTURE_PLAN, project: FIXTURE_PROJECT, zones: FIXTURE_ZONES, unreadable: 0 };

	it('counts rooms and areas separately and sums their area', () => {
		const summary = buildFloorSummary(input);
		expect(summary.roomCount).toEqual({ state: 'available', value: 1 });
		expect(summary.areaCount).toEqual({ state: 'available', value: 1 });
		expect(summary.totalAreaMm2).toEqual({ state: 'available', value: 12_000_000 + 3_000_000 });
		expect(summary.rooms.map((r) => r.id)).toEqual([kitchen.id]);
		expect(summary.areas.map((a) => a.id)).toEqual([terrace.id]);
	});

	it('marks every count partial when some zones were unreadable, carrying the number', () => {
		const summary = buildFloorSummary({ ...input, unreadable: 2 });
		expect(summary.roomCount).toEqual({ state: 'partial', value: 1, unreadable: 2 });
		expect(summary.totalAreaMm2.state).toBe('partial');
	});

	it('never fabricates a planned-change count or a cost', () => {
		const summary = buildFloorSummary(input);
		expect(summary.plannedChanges).toEqual({ state: 'unavailable' });
		expect(summary.estimatedCost).toEqual({ state: 'unavailable' });
	});

	it('distinguishes a floor with no rooms from one whose rooms could not be read', () => {
		expect(buildFloorSummary({ ...input, zones: [], unreadable: 0 }).roomCount).toEqual({ state: 'available', value: 0 });
		expect(buildFloorSummary({ ...input, zones: [], unreadable: 3 }).roomCount).toEqual({ state: 'partial', value: 0, unreadable: 3 });
	});
});
