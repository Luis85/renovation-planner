// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { ok } from '../../../src/core/result/Result';
import { guideOutline } from '../../../src/presentation/editor/hierarchy/parentZoneGuide';
import { NO_HIERARCHY } from '../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, layerNames, mountPlanEditorCanvas, settle } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';

const HOUSE = { name: 'House', points: [{ x: 30000, y: 12000 }, { x: 40000, y: 12000 }, { x: 40000, y: 20000 }, { x: 30000, y: 20000 }] };

describe('guideOutline', () => {
	it('moves the zone so its bounding box top-left corner is world origin, keeping its shape', () => {
		expect(guideOutline(HOUSE).points).toEqual([{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 8000 }, { x: 0, y: 8000 }]);
		expect(guideOutline({ name: 'Empty', points: [] }).points).toEqual([]);
	});
});

describe('the parent zone guide on a detail plan', () => {
	it('draws inside the background layer, at origin, and listens to nothing', async () => {
		const harness = await mountPlanEditorCanvas({
			queries: { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, parentZone: HOUSE })) },
		});
		await settle();
		const guide = harness.stage.findOne<Konva.Line>('.parent-zone-guide');
		expect(guide?.getLayer()?.name()).toBe('background');
		expect(guide?.points().slice(0, 2)).toEqual([0, 0]);
		expect(guide?.listening()).toBe(false);
		expect(layerNames(harness.stage)).toHaveLength(7);
	});

	it('draws nothing for a plan without a parent zone', async () => {
		const harness = await mountPlanEditorCanvas();
		await settle();
		expect(harness.stage.findOne('.parent-zone-guide')).toBeUndefined();
	});
});
