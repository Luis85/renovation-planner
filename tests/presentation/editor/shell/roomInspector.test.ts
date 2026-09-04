// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import type Konva from 'konva';
import { t } from '../../../../src/presentation/i18n/strings';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../../../src/presentation/editor/PlanEditorContext';
import type { InspectorDto } from '../../../../src/presentation/editor/inspector/inspector-store';
import type { ZoneDto } from '../../../../src/presentation/read-models/PlanDto';
import { STAGE_PIXELS, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';
import RoomInspector from '../../../../src/presentation/editor/shell/RoomInspector.vue';
import HomeownerQuestionNav from '../../../../src/presentation/editor/shell/HomeownerQuestionNav.vue';
import LinkedContentList from '../../../../src/presentation/editor/shell/LinkedContentList.vue';
import { recorder } from '../../../helpers/logger';
import { mountPlanEditorCanvas, settle, type CanvasHarness } from '../../../helpers/editor';
import { click } from '../../../helpers/planEditorRig';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../../helpers/planFixtures';

/**
 * The interaction layer, by the same `.interaction` name
 * `tests/presentation/editor/interactionLayer.test.ts` finds it under — duplicated locally
 * rather than imported, because that file keeps it as a private helper of its own suite.
 */
function interactionLayer(stage: Konva.Stage | null): Konva.Layer {
	const layer = stage?.findOne<Konva.Layer>('.interaction');
	if (layer === undefined) throw new Error('expected a mounted interaction layer');
	return layer;
}

/**
 * The Room Inspector (Task 16, component library §8): `InspectorPanel.vue`'s body renamed
 * and given the homeowner vocabulary `buildRoomOverview` (Task 7) derives — a zone's type
 * and floor beside its area — plus two navigation lists whose every row this build marks
 * `Not available yet` rather than wiring a control that does nothing.
 *
 * `mountPlanEditorCanvas()`'s default `zoneInspector` answer used to REFUSE
 * (`unavailablePlanEditorCommands()`), so selecting a zone with no override never reached
 * `dto.kind === 'zone'` and this whole component rendered nothing — measured directly before
 * writing a single assertion here, and fixed with a local `commandsWithZoneInspector` helper
 * answering it from a plan's own zones the same way `tests/harness/planEditor.ts` does for
 * the browser harness, where this exact gap was first found and fixed. Task 22 moved that
 * answer into `tests/helpers/editor.ts`'s own default (`defaultPlanEditorCommands`), so every
 * case below now selects a zone against the mount's ordinary default rather than against a
 * bundle this file built by hand.
 */

let harness: CanvasHarness | null = null;

afterEach(() => {
	harness?.unmount();
	harness = null;
});

describe('the Room Inspector, through the real mounted editor', () => {
	/**
	 * [[The cross-surface identity test starts after selection]]: the case this replaces wrote
	 * `SelectionStore` directly and never crossed the canvas-to-selection boundary, so a
	 * regression that stopped a canvas click from selecting, or that suppressed the selected
	 * outline, left it green. This one drives one real primary click through the mounted
	 * canvas and reads the store, the named selection outline and the Inspector — three of
	 * the design's four surfaces.
	 *
	 * The FOURTH — the Room-list row reading pressed AND carrying that stable id — cannot be
	 * asserted in this same mount: `EntityInspector` renders `FloorInspector` (and with it
	 * `RoomSummaryList`) only while `selectedIds.length === 0`, so the instant this click
	 * selects Kitchen, the row this case would read is unmounted. That clause is held instead
	 * by `roomSummaryList.test.ts`'s existing 'marks the row matching the current selection
	 * pressed, and no other', which selects the same stable id the click above writes to,
	 * reads `aria-pressed` on the matching row, AND asserts that row's `data-rp-id` equals the
	 * selected id — a fact `RoomSummaryList.vue`'s row carries as a `:data-rp-id="record.id"`
	 * binding rather than merely as its array position.
	 */
	it('one real click on Kitchen: store, named outline and Inspector all carry zone-kitchen (the pressed row is roomSummaryList.test.ts\'s case)', async () => {
		harness = await mountPlanEditorCanvas();
		const editor = useEditorStore();
		const inKitchen = worldToScreen({ x: 2000, y: 1500 }, editor.viewport, STAGE_PIXELS);
		click(harness.canvasEl, inKitchen.x, inKitchen.y);
		await settle();

		expect(useSelectionStore().selectedIds.map(String)).toEqual(['zone-kitchen']);
		expect(interactionLayer(harness.stage).find('.selection-outline')).toHaveLength(1);
		const room = harness.wrapper.find('.rp-room-inspector');
		expect(room.attributes('data-rp-id')).toBe('zone-kitchen');
		expect(room.find('h3').text()).toBe('Kitchen');
		expect(room.text()).toContain(t('en', 'editor.zone-type.Room'));
		expect(room.text()).toContain('Ground floor');
	});

	it('renders the three homeowner questions in order, each unavailable, with no button and no count', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const nav = harness.wrapper.find('.rp-question-nav');
		expect(nav.findAll('li').map((li) => li.find('.rp-question-nav__label').text())).toEqual([
			t('en', 'editor.inspector.question.existing'),
			t('en', 'editor.inspector.question.planned'),
			t('en', 'editor.inspector.question.work'),
		]);
		expect(nav.findAll('button')).toHaveLength(0);
		expect(nav.findAll('a')).toHaveLength(0);
		expect(nav.text()).not.toMatch(/\d/);
	});

	it('lists costs, documents, photos and notes as unavailable rows without controls', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const list = harness.wrapper.find('.rp-linked-content');
		expect(list.findAll('li').map((li) => li.find('.rp-linked-content__label').text())).toEqual([
			t('en', 'editor.inspector.linked.costs'),
			t('en', 'editor.inspector.linked.documents'),
			t('en', 'editor.inspector.linked.photos'),
			t('en', 'editor.inspector.linked.notes'),
		]);
		expect(list.findAll('button')).toHaveLength(0);
		expect(list.findAll('a')).toHaveLength(0);
		expect(list.text()).not.toMatch(/\d/);
	});

	it('keeps the Requirements panel and the Delete button', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		expect(harness.wrapper.find('.rp-editor-inspector-requirements').exists()).toBe(true);
		expect(harness.wrapper.find('.rp-editor-inspector-delete').exists()).toBe(true);
	});

	/**
	 * `ZONE_TYPE_LABELS` is a `Record<string, StringKey>`, not an exhaustive switch — a zone
	 * whose note was hand-edited to a type nothing here labels still has to render, in the
	 * generic `Custom`/"Other" entry, the same fallback `ZoneRenderModel.zoneFillToken` takes
	 * for its own unknown-type case.
	 */
	it('falls back to the generic "Other" label for a zone type nothing here labels', async () => {
		const mystery: ZoneDto = { ...FIXTURE_ZONES[0], id: 'zone-mystery', name: 'Mystery room', zoneType: 'Mystery' };
		harness = await mountPlanEditorCanvas({ zones: [mystery] });
		useSelectionStore().select(['zone-mystery' as never]);
		await settle();
		const room = harness.wrapper.find('.rp-room-inspector');
		expect(room.text()).toContain(t('en', 'editor.zone-type.Custom'));
	});

	/**
	 * `overview`'s zone-lookup half of `zone && plan`, covered by a mismatch no real session
	 * can produce but a test can: `zoneInspector` resolves the selection (so `dto.kind` is
	 * `'zone'`) while `findZonesByPlan` answers no zones at all, so `projectStore.zones` never
	 * gains the entry `overview` looks up. The name and the Delete control still come from
	 * `dto` alone, so they survive; the derived fields do not.
	 */
	it('omits the type/floor/area fields and both lists when the selected zone is missing from the store', async () => {
		harness = await mountPlanEditorCanvas({ queries: fakeQueries(FIXTURE_PLAN, []) });
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const room = harness.wrapper.find('.rp-room-inspector');
		expect(room.find('h3').text()).toBe('Kitchen');
		expect(room.find('dl').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-question-nav').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-linked-content').exists()).toBe(false);
		expect(room.find('.rp-editor-inspector-delete').exists()).toBe(true);
	});
});

/**
 * `RoomInspector` mounted STANDALONE, with a stub `EditorRuntime` and a fresh Pinia — the
 * one door that can drive `overview`'s OTHER null cause (`ProjectStore.plan` not yet
 * hydrated) without also un-mounting the canvas the case above needs. `RoomSummaryList`'s
 * own suite is the precedent for this shape.
 */
function mountStandalone(dto: InspectorDto) {
	setActivePinia(createPinia());
	const runtime = {
		inspectorDto: ref(dto),
		inspectorRequirements: ref([]),
		assetOptions: ref([]),
		hydrateInspector: () => Promise.resolve(),
		commitEdit: () => Promise.resolve(true),
		deleteZone: () => Promise.resolve(),
	} as unknown as EditorRuntime;
	const context = { commands: { logger: recorder } } as unknown as PlanEditorContext;
	return mount(RoomInspector, {
		global: {
			provide: {
				[EDITOR_RUNTIME as symbol]: runtime,
				[PLAN_EDITOR_CONTEXT as symbol]: context,
			},
		},
	});
}

describe('the Room Inspector, mounted standalone', () => {
	it('omits the type/floor/area fields and both lists while the plan has not hydrated, keeping the name and Delete', () => {
		useProjectStore().zones = new Map([[FIXTURE_ZONES[0].id, FIXTURE_ZONES[0]]]);
		const wrapper = mountStandalone({ kind: 'zone', id: 'zone-kitchen' as never, name: 'Kitchen', areaMm2: 12_000_000 });

		const room = wrapper.find('.rp-room-inspector');
		expect(room.find('h3').text()).toBe('Kitchen');
		expect(room.find('dl').exists()).toBe(false);
		expect(wrapper.find('.rp-question-nav').exists()).toBe(false);
		expect(wrapper.find('.rp-linked-content').exists()).toBe(false);
		expect(room.find('.rp-editor-inspector-delete').exists()).toBe(true);
	});
});

/**
 * `unavailable.includes(row.section)` is only ever asked with `unavailable ===
 * INSPECTOR_SECTIONS` through the mounted editor above — nothing here has a supported
 * section yet — so its FALSE arm and the `--unavailable`/state-span absence it drives are
 * reachable only by mounting the row components directly with an empty list.
 */
describe('HomeownerQuestionNav mounted directly', () => {
	it('marks no row unavailable and prints no state span when nothing is unavailable', () => {
		const wrapper = mount(HomeownerQuestionNav, { props: { unavailable: [] } });
		expect(wrapper.findAll('.rp-question-nav__row--unavailable')).toHaveLength(0);
		expect(wrapper.find('.rp-question-nav__state').exists()).toBe(false);
	});
});

describe('LinkedContentList mounted directly', () => {
	it('marks no row unavailable and prints no state span when nothing is unavailable', () => {
		const wrapper = mount(LinkedContentList, { props: { unavailable: [] } });
		expect(wrapper.findAll('.rp-linked-content__row--unavailable')).toHaveLength(0);
		expect(wrapper.find('.rp-linked-content__state').exists()).toBe(false);
	});
});
