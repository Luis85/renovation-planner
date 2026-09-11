import { describe, expect, it } from 'vitest';
import { canvasCandidates } from '../../../../src/presentation/editor/selection/canvasCandidates';
import { EMPTY_STRUCTURE } from '../../../../src/domain/spatial/Structure';
import { makeZone } from '../../../helpers/entities';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { toZoneDto } from '../../../../src/presentation/read-models/PlanDto';
import { toSpatialRecordDto } from '../../../../src/presentation/read-models/spatialRecords';
import { toZoneRenderModel } from '../../../../src/presentation/editor/layers/zone/ZoneRenderModel';

const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];

describe('canvasCandidates', () => {
	it('drops a locked zone, which is what makes click, hover, marquee and right-click pass through it', () => {
		const zones = [{ id: 'zone-site', points: square, locked: true }, { id: 'zone-house', points: square }];
		expect(canvasCandidates(zones, EMPTY_STRUCTURE, { zone: true, architecture: true, asset: true }).map((item) => item.id)).toEqual(['zone-house']);
	});
});

describe('the lock reaches every read model, and only while locked', () => {
	it('is absent for an unlocked zone and true for a locked one', () => {
		const zone = makeZone({ projectId: createProjectId(), planId: createPlanId() });
		expect('locked' in toZoneDto(zone)).toBe(false);
		const locked = toZoneDto(zone.withLocked(true));
		expect(locked.locked).toBe(true);
		expect(toSpatialRecordDto(locked).locked).toBe(true);
		expect(toZoneRenderModel(locked).locked).toBe(true);
		expect('locked' in toSpatialRecordDto(toZoneDto(zone))).toBe(false);
	});
});
