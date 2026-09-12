// @vitest-environment jsdom
/** A zone with detail plans says so under its area (ADR-0028), and only that zone. */
import type Konva from 'konva';
import { afterEach, expect, it } from 'vitest';
import { ok } from '../../../src/core/result/Result';
import { captionOffsetY } from '../../../src/presentation/editor/layers/zone/captionPlacement';
import { t } from '../../../src/presentation/i18n/strings';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import { NO_HIERARCHY, type DetailPlanDto } from '../../../src/presentation/read-models/planHierarchy';
import { fakeQueries, mountPlanEditorCanvas, settle, type CanvasHarness } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';

let open: CanvasHarness | null = null;
afterEach(() => { open?.unmount(); open = null; });

const detail = (id: string, name: string, parentZoneId: string): DetailPlanDto => ({ id: id as PlanId, name, parentZoneId });

async function captions(detailPlans: readonly DetailPlanDto[]) {
	open = await mountPlanEditorCanvas({ queries: { ...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, detailPlans })) } });
	await settle();
	const layer = open.stage.findOne<Konva.Layer>('.zone');
	return (zoneId: string) => {
		const caption = layer?.findOne<Konva.Group>('.' + zoneId)?.findOne<Konva.Text>('.zone-detail-plans');
		return caption?.isVisible() ? caption.text() : null;
	};
}

it('names the one detail plan, counts several, and marks no other zone', async () => {
	const caption = await captions([
		detail('plan-kitchen', 'Kitchen detail', 'zone-kitchen'),
		detail('plan-terrace-a', 'Terrace deck', 'zone-terrace'),
		detail('plan-terrace-b', 'Terrace drainage', 'zone-terrace'),
	]);
	expect(caption('zone-kitchen')).toBe(t('en', 'editor.input.detail-plan-caption-one', { name: 'Kitchen detail' }));
	expect(caption('zone-terrace')).toBe(t('en', 'editor.input.detail-plan-caption-many', { count: '2' }));
});

it('draws no detail-plan caption for a zone nothing details', async () => {
	const caption = await captions([]);
	expect(caption('zone-kitchen')).toBeNull();
	expect(caption('zone-terrace')).toBeNull();
});

it('clears pins below a caption only once it is tall enough to reach them', () => {
	const pin = [{ x: 200, y: 255, number: 1 }];
	expect(captionOffsetY({ x: 200, y: 200 }, pin, 1)).toBe(0);
	expect(captionOffsetY({ x: 200, y: 200 }, pin, 1, [], { bottom: 50 })).toBe(-16);
});
