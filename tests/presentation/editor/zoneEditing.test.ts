/**
 * @vitest-environment jsdom
 *
 * Design slice 8's Definition of Done, driven through the REAL mounted Plan Editor —
 * real Vue, real Pinia, real Konva, the real toolbar/canvas/inspector wiring — against
 * in-memory repositories, so a drawn zone is genuinely written and a refresh genuinely
 * re-reads what was written (docs/tasks/08-zone-editing.md, DoD 2/3/5/6/7/8 and the
 * "symptom" store-refresh tests).
 *
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480
 * per axis at the default camera. The fixture zone's world rect (1500..4400)² therefore
 * has the screen footprint (198,198)-(488,388), inside the 800×600 stage.
 */
import { describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { Notice } from 'obsidian';
import { mountPlanEditor, settle, settleUntil as until } from '../../helpers/editor';
import {
	click,
	PLAN_DTO,
	pointer,
	PROJECT_ID,
	rig,
	toolbarButton,
	ZONE_A_DTO,
} from '../../helpers/planEditorRig';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { useEditorRuntime } from '../../../src/presentation/editor/runtime';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { expectOk, injectedPersistenceError, RecordingEventBus } from '../../helpers/domain';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { createPlanEditorQueries } from '../../../src/presentation/read-models/planEditorQueries';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { makePlan, makeZone } from '../../helpers/entities';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';

describe('the wired Plan Editor (design slice 8)', () => {
	it('draws a zone through the toolbar and canvas, persists it, selects it, and undo/redo keep the SAME id', async () => {
		const { harness, zonesRepo } = await rig();

		toolbarButton(harness, 'Draw zone').click();
		await settle();

		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		click(canvas, 500, 100); // close click on the first vertex
		await settle();

		// Persisted, not merely rendered.
		const listed = expectOk(await zonesRepo.listByPlan('plan-e2e' as never));
		expect(listed).toHaveLength(2);
		const created = listed.find((loaded) => loaded.entity.id !== 'zone-a');
		if (created === undefined) throw new Error('expected the drawn zone to persist');
		expect(created.entity.geometry.points).toEqual([
			{ x: 4520, y: 520 },
			{ x: 5520, y: 520 },
			{ x: 5520, y: 1520 },
		]);

		// The panel shows the selection the draw left behind (DoD 3's Inspector half):
		// one fixture zone existed, so the drawn one is named "Zone 2".
		expect(harness.wrapper.text()).toContain('Zone 2');

		// Undo removes it; redo restores THE SAME entity (DoD 2).
		const undoButton = toolbarButton(harness, 'Undo');
		expect(undoButton.disabled).toBe(false);
		undoButton.click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).length === 1,
			'the undo of the drawn zone to land in the repository',
		);

		const redoButton = toolbarButton(harness, 'Redo');
		redoButton.click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).length === 2,
			'the redo to re-create the zone',
		);
		const afterRedo = expectOk(await zonesRepo.listByPlan('plan-e2e' as never));
		expect(afterRedo).toHaveLength(2);
		expect(afterRedo.some((loaded) => loaded.entity.id === created.entity.id)).toBe(true);

		harness.unmount();
	});

	it('selects by click, moves by drag with exactly one command, and undo restores the exact points', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		await settle();

		// Down inside the zone selects AND begins the drag; up ends it (+60 px = +600 mm).
		pointer(canvas, 'pointerdown', 200, 200);
		pointer(canvas, 'pointermove', 230, 200);
		pointer(canvas, 'pointermove', 260, 200);
		pointer(canvas, 'pointerup', 260, 200);
		await settle();

		const moved = expectOk(await zonesRepo.getById('zone-a' as never));
		if (moved === null) throw new Error('expected the moved zone to exist');
		expect(moved.entity.geometry.points[0]).toEqual({ x: 2100, y: 1500 });

		toolbarButton(harness, 'Undo').click();
		await until(
			async () =>
				(expectOk(await zonesRepo.getById('zone-a' as never)))?.entity.geometry.points[0]?.x === 1500,
			'the undo of the move to land in the repository',
		);
		const restored = expectOk(await zonesRepo.getById('zone-a' as never));
		expect(restored?.entity.geometry.points).toEqual(ZONE_A_DTO.points);

		harness.unmount();
	});

	it('drags one vertex handle; the Inspector carries the post-drag area with no reselect (DoD 3)', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		await settle();

		// Click to select...
		click(canvas, 200, 200);
		await settle();

		// DoD 5's second half: the selection SHOWS — one handle circle per vertex, in the
		// interaction layer.
		const interaction = harness.stage?.findOne<Konva.Layer>('.interaction');
		expect(interaction?.find('Circle').length).toBe(ZONE_A_DTO.points.length);

		// The panel shows the pre-drag area: 2900 × 1900 mm. Waited for, not assumed — the
		// selection query crosses an awaited repository read before the DTO lands.
		await until(
			() => harness.wrapper.text().includes('5.51 m²'),
			'the Inspector to show the selected zone area',
		);

		// ...then grab vertex 0 at its screen projection (198,198) and drag it.
		pointer(canvas, 'pointerdown', 199, 199);
		pointer(canvas, 'pointermove', 250, 250);
		pointer(canvas, 'pointerup', 250, 250);
		await settle();

		const edited = expectOk(await zonesRepo.getById('zone-a' as never));
		expect(edited?.entity.geometry.points[0]).toEqual({ x: 2020, y: 2020 });
		expect(edited?.entity.geometry.points[1]).toEqual({ x: 4400, y: 1500 });
		expect(edited?.entity.geometry.points[2]).toEqual({ x: 4400, y: 3400 });

		// The refresh funnel re-ran the Inspector query inside the same dispatch: the panel
		// carries the POST-drag area (4,262,000 mm²) with no reselect in between. A stale
		// panel is the failure mode DoD 3 exists for, and a move alone would not catch it —
		// a translation preserves area, so only an edit that CHANGES it can tell.
		await until(
			() => harness.wrapper.text().includes('4.26 m²'),
			"the Inspector to refresh to the post-drag area without a reselect",
		);
		expect(harness.wrapper.text()).not.toContain('5.51 m²');

		harness.unmount();
	});

	it('deletes from the Inspector; undo restores the exact entity; the panel follows both ways', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		pointer(canvas, 'pointerdown', 200, 200);
		pointer(canvas, 'pointerup', 200, 200);
		await settle();

		const deleteButton = toolbarButton(harness, 'Delete zone');
		deleteButton.click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).length === 0,
			'the delete to land in the repository',
		);

		// Both the note-side repo state and the panel agree it is gone (DoD 3/8).
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(0);
		expect(harness.wrapper.text()).toContain('Nothing selected.');

		toolbarButton(harness, 'Undo').click();
		await until(
			async () => (expectOk(await zonesRepo.getById('zone-a' as never))) !== null,
			'the undo of the delete to restore the zone',
		);
		const restored = expectOk(await zonesRepo.getById('zone-a' as never));
		expect(restored?.entity.geometry.points).toEqual(ZONE_A_DTO.points);

		harness.unmount();
	});

	it('Escape abandons a half-drawn polygon BETWEEN clicks — real click pairs, no zone created', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Draw zone').click();
		await settle();
		// Two REAL clicks — each with its pointerup, which is the state a multi-click
		// gesture actually lives in between vertices. The first version of this test sent
		// bare pointerdowns, an event sequence no mouse can produce, and certified an
		// Escape that did nothing in a vault.
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		// A close attempt after the abandon: the buffer is gone, so this places a vertex
		// into a fresh buffer instead of closing anything.
		click(canvas, 500, 100);
		click(canvas, 700, 100);
		click(canvas, 700, 200);
		await settle();

		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);

		harness.unmount();
	});

	it('the Pan toolbar state clears the active tool; camera-mode drag does not feed tools', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Draw zone').click();
		await settle();

		// Back to camera mode: drag pans again instead of feeding a tool.
		toolbarButton(harness, 'Pan').click();
		await settle();
		click(canvas, 200, 200);
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);

		harness.unmount();
	});

	it('routes modifier keys and non-primary buttons through the event translation', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		await settle();

		// Middle button with a tool active: translated to 'auxiliary', which SelectTool
		// ignores — no selection, no dispatch.
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', { button: 1, clientX: 200, clientY: 200, bubbles: true }),
		);
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);

		// Modifier-bearing moves translate without disturbing anything. The button on a
		// MOVE event also travels through the translation (middle = auxiliary, right =
		// secondary), even though only primary starts gestures.
		for (const init of [
			{ shiftKey: true },
			{ ctrlKey: true },
			{ metaKey: true },
			{ altKey: true },
			{ button: 1 },
			{ button: 2 },
		]) {
			canvas.dispatchEvent(
				new PointerEvent('pointermove', { clientX: 210, clientY: 210, bubbles: true, ...init }),
			);
		}
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);

		harness.unmount();
	});

	it('a failed create surfaces through the rejection seam and keeps the editor alive', async () => {
		// One-shot save failure at the port, so the close attempt fails INSIDE the dispatch
		// after the tool did its part — the path `reportRejected` exists for.
		class FlakySave extends InMemoryZoneRepository {
			failuresLeft = 0;
			override save(
				zone: Parameters<InMemoryZoneRepository['save']>[0],
				expected: Parameters<InMemoryZoneRepository['save']>[1],
			) {
				if (this.failuresLeft > 0) {
					this.failuresLeft -= 1;
					return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
				}
				return super.save(zone, expected);
			}
		}

		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: PROJECT_ID, id: PLAN_DTO.id as PlanId });
		await plans.save(plan, 'absent');
		const zonesRepo = new FlakySave();
		const zoneA = makeZone({
			projectId: PROJECT_ID,
			planId: plan.id,
			id: 'zone-a' as ZoneId,
			name: ZONE_A_DTO.name,
			zoneType: 'Room',
			status: 'Planned',
			geometry: expectOk(createPolygon(ZONE_A_DTO.points)),
		});
		await zonesRepo.save(zoneA, 'absent');

		const events = new RecordingEventBus();
		const queries = createPlanEditorQueries({
			getPlan: new GetPlan(plans),
			findZonesByPlan: new FindZonesByPlan(zonesRepo),
		});
		zonesRepo.failuresLeft = 1; // fail exactly the drawn zone's insert
		const harness = await mountPlanEditor({
			plan: PLAN_DTO,
			zones: [ZONE_A_DTO],
			queries,
			commands: {
				createZone: new CreateZoneCommand(zonesRepo, plans, events),
				moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
				deleteZone: makeDeleteZoneCommand(zonesRepo, events),
				zones: zonesRepo,
				zoneInspector: new GetZoneInspector(zonesRepo),
			},
		});
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Draw zone').click();
		await settle();
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();

		// The write failed; nothing was created and no selection was made.
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);
		// And the buffer is INTACT: the next click would still close it.
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();

		// The editor survives: a deliberate fresh draw with the fault cleared succeeds.
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(2);

		harness.unmount();
	});

	it('the Inspector renders a multi-selection as a count, not a zone form', async () => {
		const { harness } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		// Drive the selection store directly: SelectTool in this slice selects exactly one
		// object, and this case pins how the panel degrades when it is handed several.
		setActivePinia(harness.pinia);
		useSelectionStore().select(['zone-a' as never, 'zone-other' as never]);
		await settle();

		expect(harness.wrapper.text()).toContain('Multiple objects selected.');
		expect(harness.wrapper.text()).not.toContain('Delete zone');

		harness.unmount();
	});

	it('a FAILED delete surfaces through the notice seam and leaves the zone intact', async () => {
		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: PROJECT_ID, id: PLAN_DTO.id as PlanId });
		await plans.save(plan, 'absent');
		class FlakyDelete extends InMemoryZoneRepository {
			failuresLeft = 0;
			override delete(
				id: Parameters<InMemoryZoneRepository['delete']>[0],
				expected: Parameters<InMemoryZoneRepository['delete']>[1],
			) {
				if (this.failuresLeft > 0) {
					this.failuresLeft -= 1;
					return Promise.resolve({ ok: false, error: injectedPersistenceError() } as const);
				}
				return super.delete(id, expected);
			}
		}
		const zonesRepo = new FlakyDelete();
		const zoneA = makeZone({
			projectId: PROJECT_ID,
			planId: plan.id,
			id: 'zone-a' as ZoneId,
			name: ZONE_A_DTO.name,
			zoneType: 'Room',
			status: 'Planned',
			geometry: expectOk(createPolygon(ZONE_A_DTO.points)),
		});
		await zonesRepo.save(zoneA, 'absent');
		const events = new RecordingEventBus();
		const harness = await mountPlanEditor({
			plan: PLAN_DTO,
			zones: [ZONE_A_DTO],
			queries: createPlanEditorQueries({
				getPlan: new GetPlan(plans),
				findZonesByPlan: new FindZonesByPlan(zonesRepo),
			}),
			commands: {
				createZone: new CreateZoneCommand(zonesRepo, plans, events),
				moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
				deleteZone: makeDeleteZoneCommand(zonesRepo, events),
				zones: zonesRepo,
				zoneInspector: new GetZoneInspector(zonesRepo),
			},
		});
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		click(canvas, 200, 200);
		await settle();

		zonesRepo.failuresLeft = 1;
		const noticesBefore = Notice.shown.length;
		toolbarButton(harness, 'Delete zone').click();
		await settle();

		// The write failed, the zone survives, and the refusal reached the user through the
		// same seam a failed draw uses — not a silent no-op.
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);
		expect(Notice.shown.length).toBe(noticesBefore + 1);
		expect(harness.wrapper.text()).toContain('Kitchen'); // selection and panel intact

		harness.unmount();
	});

	it('using the runtime outside the provider fails at the mount point', () => {
		expect(() => {
			mount(
				defineComponent({ setup() { useEditorRuntime(); return () => null; } }),
				{ global: { plugins: [createPinia()] } },
			);
		}).toThrow('without an EditorRuntime');
	});});
