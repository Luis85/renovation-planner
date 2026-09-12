// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import { mount } from '@vue/test-utils';
import type Konva from 'konva';
import { t } from '../../../../src/presentation/i18n/strings';
import { ok } from '../../../../src/core/result/Result';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { EDITOR_RUNTIME, type EditorRuntime } from '../../../../src/presentation/editor/runtime';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../../../src/presentation/editor/PlanEditorContext';
import type { InspectorDto } from '../../../../src/presentation/editor/inspector/inspector-store';
import type { ZoneDto } from '../../../../src/presentation/read-models/PlanDto';
import { STAGE_PIXELS, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';
import RoomInspector from '../../../../src/presentation/editor/shell/RoomInspector.vue';
import { comingLaterSentence } from '../../../../src/presentation/editor/shell/comingLater';
import { INSPECTOR_SECTIONS } from '../../../../src/presentation/read-models/roomOverview';
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

	it('names every section this build cannot show yet in one Coming later line, with no control and no count', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const line = harness.wrapper.get('.rp-room-inspector .rp-coming-later');
		expect(line.text()).toBe(comingLaterSentence('en', INSPECTOR_SECTIONS));
		expect(line.findAll('button, a')).toHaveLength(0);
		expect(line.text()).not.toMatch(/\d/);
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
	 * Status left the canvas on 2026-09-10 (canvas fidelity spec), so the selected room's own
	 * Inspector is where it is read — M00's first use case is the room's status at a glance.
	 * `InProgress` rather than the fixture's `Planned`, so a row that printed the first status
	 * word it found would not pass by accident.
	 */
	it('shows the selected zone status beside its type, floor and area', async () => {
		const underway: ZoneDto = { ...FIXTURE_ZONES[0], status: 'InProgress' };
		harness = await mountPlanEditorCanvas({ zones: [underway] });
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const fields = harness.wrapper.find('.rp-room-inspector dl');
		expect(fields.findAll('dt').map((term) => term.text())).toContain(t('en', 'editor.inspector.status'));
		expect(fields.findAll('dd').map((value) => value.text())).toContain(t('en', 'zone.status.in-progress'));
	});

	/**
	 * `overview`'s zone-lookup half of `zone && plan`, covered by a mismatch no real session
	 * can produce but a test can: `zoneInspector` resolves the selection (so `dto.kind` is
	 * `'zone'`) while `findZonesByPlan` answers no zones at all, so `projectStore.zones` never
	 * gains the entry `overview` looks up. The name and the Delete control still come from
	 * `dto` alone, so they survive; the derived fields do not.
	 */
	it('omits the type/floor/area fields and the Coming later line when the selected zone is missing from the store', async () => {
		harness = await mountPlanEditorCanvas({ queries: fakeQueries(FIXTURE_PLAN, []) });
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const room = harness.wrapper.find('.rp-room-inspector');
		expect(room.find('h3').text()).toBe('Kitchen');
		expect(room.find('dl').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-coming-later').exists()).toBe(false);
		expect(room.find('.rp-editor-inspector-delete').exists()).toBe(true);
	});

	/**
	 * `ZoneLockRow`'s badge branch and `ZoneLockToggle`'s pressed state, unit 3 of this fix
	 * round's findings: neither had a direct Inspector-level assertion before, only coverage
	 * inherited through `zoneLock.e2e.test.ts`'s single locked-then-undo path.
	 */
	it('shows the Locked badge and a pressed toggle for a locked zone, and neither for an unlocked one', async () => {
		const locked: ZoneDto = { ...FIXTURE_ZONES[0], locked: true };
		harness = await mountPlanEditorCanvas({ zones: [locked, FIXTURE_ZONES[1]] });

		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const lockedRoom = harness.wrapper.find('.rp-room-inspector');
		expect(lockedRoom.find('.rp-editor-inspector-locked').text()).toBe(t('en', 'editor.input.locked'));
		expect(lockedRoom.get('[data-rp-lock="zone-kitchen"]').attributes('aria-pressed')).toBe('true');

		useSelectionStore().select(['zone-terrace' as never]);
		await settle();
		const unlockedRoom = harness.wrapper.find('.rp-room-inspector');
		expect(unlockedRoom.find('.rp-editor-inspector-locked').exists()).toBe(false);
		expect(unlockedRoom.get('[data-rp-lock="zone-terrace"]').attributes('aria-pressed')).toBe('false');
	});

	/**
	 * The default mount's catalogue is `fakeQueries`' empty `listAssets`. Both controls take
	 * `aria-disabled` rather than the native `disabled` (side panels spec §3), so the reason
	 * stays reachable by Tab — and both name it through `aria-describedby`.
	 */
	it('explains an empty asset library beside an aria-disabled picker rather than offering an empty one', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const assign = harness.wrapper.get('.rp-editor-requirement-assign');
		const reason = t('en', 'editor.inspector.assign.none');
		const select = assign.get('#rp-assign-asset');
		expect(select.attributes('aria-disabled')).toBe('true');
		expect((select.element as HTMLSelectElement).disabled).toBe(false);
		expect(assign.get(`[id="${select.attributes('aria-describedby') ?? ''}"]`).text()).toBe(reason);
		expect(assign.get('option').text()).toBe(t('en', 'editor.inspector.assign.placeholder'));
		const button = assign.get('button');
		expect(button.attributes('aria-disabled')).toBe('true');
		expect(assign.get(`[id="${button.attributes('aria-describedby') ?? ''}"]`).text()).toBe(reason);
	});

	/** The catalogue arrives through the runtime's own read (`listAssets`), never a cast-writable ref. */
	it('offers a placeholder and the catalogue, with the picker and Assign live, once there are assets', async () => {
		harness = await mountPlanEditorCanvas({
			queries: {
				...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
				listAssets: () => Promise.resolve(ok([{ id: 'asset-tiles', name: 'Floor tiles' }])),
			},
		});
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const assign = harness.wrapper.get('.rp-editor-requirement-assign');
		const select = assign.get('#rp-assign-asset');
		expect(assign.findAll('option').map((option) => option.attributes('value'))).toEqual(['', 'asset-tiles']);
		expect(select.attributes('aria-disabled')).toBeUndefined();
		expect(select.attributes('aria-describedby')).toBeUndefined();
		expect(assign.get('button').attributes('aria-disabled')).toBeUndefined();
		expect(assign.find('.rp-editor-inspector-empty').exists()).toBe(false);
	});

	it('draws the rotation and lock controls as one toolbar, the actions as rows, and Delete last with its icon', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never]);
		await settle();
		const room = harness.wrapper.get('.rp-room-inspector');
		expect(room.get('.rp-inspector-toolbar').find('[data-rp-lock="zone-kitchen"]').exists()).toBe(true);
		expect(room.get('.rp-inspector-actions').find('[data-rp-action="edit-outline"]').exists()).toBe(true);
		const danger = room.get('.rp-inspector-danger');
		expect(room.element.lastElementChild).toBe(danger.element);
		expect(danger.get('.rp-editor-inspector-delete').find('.rp-host-icon').exists()).toBe(true);
		expect(danger.get('.rp-editor-inspector-delete').text()).toBe(t('en', 'editor.inspector.delete-zone'));
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
		rotationActions: { target: computed(() => null), available: computed(() => false), blocked: computed(() => true), active: computed(() => false), rotate: () => Promise.resolve() } satisfies Pick<EditorRuntime['rotationActions'], 'target' | 'available' | 'blocked' | 'active' | 'rotate'>,
		outlineEdit: { blocked: ref(false), editOutline: () => Promise.resolve() },
		inspectorRequirements: ref([]),
		assetOptions: ref([]),
		hydrateInspector: () => Promise.resolve(),
		commitEdit: () => Promise.resolve(true),
		deleteZone: () => Promise.resolve(),
		// Read unconditionally by the template since design spec §2.9 (Delete and the assign
		// button pause while blocked) — a stub without them threw on mount rather than
		// merely leaving the pause untested.
		writesBlocked: ref(false),
		pausedReasonId: 'stub-paused-reason',
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
	it('omits the type/floor/area fields and the Coming later line while the plan has not hydrated, keeping the name and Delete', () => {
		useProjectStore().zones = new Map([[FIXTURE_ZONES[0].id, FIXTURE_ZONES[0]]]);
		const wrapper = mountStandalone({ kind: 'zone', id: 'zone-kitchen' as never, name: 'Kitchen', areaMm2: 12_000_000 });

		const room = wrapper.find('.rp-room-inspector');
		expect(room.find('h3').text()).toBe('Kitchen');
		expect(room.find('dl').exists()).toBe(false);
		expect(wrapper.find('.rp-coming-later').exists()).toBe(false);
		expect(room.find('.rp-editor-inspector-delete').exists()).toBe(true);
		expect(room.find('.rp-object-rotation-actions').exists()).toBe(false);
	});
});
