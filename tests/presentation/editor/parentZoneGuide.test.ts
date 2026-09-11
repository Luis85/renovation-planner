// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { ok } from '../../../src/core/result/Result';
import { guideFramePoints, guideOutline, guideSource } from '../../../src/presentation/editor/hierarchy/parentZoneGuide';
import { DEFAULT_VIEWPORT } from '../../../src/presentation/editor/viewport/Viewport';
import { NO_HIERARCHY } from '../../../src/presentation/read-models/planHierarchy';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { t } from '../../../src/presentation/i18n/strings';
import { expectDefined } from '../../helpers/domain';
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
		expect(guide?.dash()?.length).toBeGreaterThan(0);
		expect(guide?.strokeScaleEnabled()).toBe(false);
		expect(guide?.closed()).toBe(true);
		expect(layerNames(harness.stage)).toHaveLength(7);

		const caption = harness.stage.findOne<Konva.Text>('.parent-zone-guide-caption');
		expect(caption?.text()).toBe(HOUSE.name);
		expect(caption?.scaleX()).toBe(1 / DEFAULT_VIEWPORT.zoom);
		expect(caption?.scaleY()).toBe(1 / DEFAULT_VIEWPORT.zoom);
	});

	it('draws nothing for a plan without a parent zone', async () => {
		const harness = await mountPlanEditorCanvas();
		await settle();
		expect(harness.stage.findOne('.parent-zone-guide')).toBeUndefined();
	});
});

/** Far from origin and far larger than the default camera (1 px per 10 mm) shows. */
const SITE = { name: 'Site', points: [{ x: 5000, y: 5000 }, { x: 65_000, y: 5000 }, { x: 65_000, y: 45_000 }, { x: 5000, y: 45_000 }] };
const withGuide = (parentZone = SITE) => ({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok({ ...NO_HIERARCHY, parentZone })) } });
const shiftOne = () => new KeyboardEvent('keydown', { key: '!', code: 'Digit1', shiftKey: true, bubbles: true });
async function menuFit(harness: Awaited<ReturnType<typeof mountPlanEditorCanvas>>) {
	harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));
	await settle();
	return harness.wrapper.get('[data-rp-context-action="fit"]');
}

describe('guideFramePoints', () => {
	it('answers the guide at origin, and nothing without a parent zone', () => {
		expect(guideFramePoints(null)).toEqual([]);
		const xs = guideFramePoints(HOUSE).map((p) => p.x), ys = guideFramePoints(HOUSE).map((p) => p.y);
		expect([Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]).toEqual([0, 0, 10000, 8000]);
	});
});

const FROM_SITE = { ...NO_HIERARCHY, ancestry: [{ id: 'plan-site', name: 'Site plan' }], parentZone: HOUSE };

describe('guideSource', () => {
	it('names the parent zone and the plan it sits on, and nothing without both', () => {
		expect(guideSource(FROM_SITE)).toEqual({ name: 'House', plan: 'Site plan' });
		expect(guideSource({ ...FROM_SITE, parentZone: null })).toBeNull();
		expect(guideSource({ ...FROM_SITE, ancestry: [] })).toBeNull();
	});
});

describe('explaining the guide on the canvas', () => {
	it('captions the guide with its source', async () => {
		const harness = await mountPlanEditorCanvas({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok(FROM_SITE)) } });
		await settle();
		expect(harness.stage.findOne<Konva.Text>('.parent-zone-guide-caption')?.text()).toBe(t('en', 'editor.input.detail-plan-guide-caption', { name: 'House', plan: 'Site plan' }));
		harness.unmount();
	});

	it('makes the Reference row a live toggle while a guide is drawn, and hiding it hides the guide', async () => {
		const harness = await mountPlanEditorCanvas({ zones: [], queries: { ...fakeQueries(FIXTURE_PLAN, []), hierarchy: () => Promise.resolve(ok(FROM_SITE)) } });
		await settle();
		const checkbox = harness.wrapper.get('[data-rp-layer="reference"]');
		expect(checkbox.attributes('disabled')).toBeUndefined();
		await checkbox.trigger('change');
		await settle();
		expect(harness.stage.findOne<Konva.Line>('.parent-zone-guide')?.isVisible()).toBe(false);
		harness.unmount();
	});
});

describe('framing a detail plan on its guide', () => {
	it('fits an empty detail plan to its guide on first open, and Fit floor frames it while the reference layer is visible', async () => {
		const harness = await mountPlanEditorCanvas(withGuide());
		await settle();
		const editor = useEditorStore(harness.pinia);
		const rect = expectDefined(harness.stage.findOne<Konva.Line>('.parent-zone-guide'), 'the guide').getClientRect();
		expect(rect.x).toBeGreaterThanOrEqual(0);
		expect(rect.y).toBeGreaterThanOrEqual(0);
		expect(rect.x + rect.width).toBeLessThanOrEqual(editor.stageSize.width);
		expect(rect.y + rect.height).toBeLessThanOrEqual(editor.stageSize.height);

		const fitted = editor.viewport;
		editor.viewport = { ...fitted, pan: { x: 10000, y: 10000 } };
		harness.canvasEl?.dispatchEvent(shiftOne()); await settle();
		expect(editor.viewport).toEqual(fitted);

		useWorkspaceStore(harness.pinia).layerVisibility.background = false; await settle();
		editor.viewport = { ...fitted, pan: { x: 10000, y: 10000 } };
		harness.canvasEl?.dispatchEvent(shiftOne()); await settle();
		expect(editor.viewport.pan).toEqual({ x: 10000, y: 10000 });
		harness.unmount();
	});

	it('greys Fit floor on an empty plan with a reason of its own, and offers it once a guide is drawn', async () => {
		const empty = await mountPlanEditorCanvas({ zones: [] });
		await settle();
		const greyed = await menuFit(empty);
		expect(greyed.attributes('aria-disabled')).toBe('true');
		expect(greyed.attributes('title')).toBe(t('en', 'editor.view.fit-nothing'));
		empty.unmount();

		const detail = await mountPlanEditorCanvas(withGuide());
		await settle();
		expect((await menuFit(detail)).attributes('aria-disabled')).not.toBe('true');
		detail.unmount();
	});
});
