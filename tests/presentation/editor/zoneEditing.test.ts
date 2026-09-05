/**
 * @vitest-environment jsdom
 *
 * Design slice 8's Definition of Done, driven through the REAL mounted Plan Editor —
 * real Vue, real Pinia, real Konva, the real shell/canvas/inspector wiring — against
 * in-memory repositories, so a drawn zone is genuinely written and a refresh genuinely
 * re-reads what was written (docs/tasks/08-zone-editing.md, DoD 2/3/5/6/7/8 and the
 * "symptom" store-refresh tests).
 *
 * Geometry note: `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so world = 10 × screen − 480
 * per axis at the default camera. The fixture zone's world rect (1500..4400)² therefore
 * has the screen footprint (198,198)-(488,388), inside the 800×600 stage.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type Konva from 'konva';
import { createPinia, setActivePinia } from 'pinia';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
// Mock-only surface, imported BY NAME. `Notice` carries members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants.
import { Notice } from '../../helpers/obsidian-mock';
import { mountPlanEditor, settle, settleUntil as until } from '../../helpers/editor';
import {
	actionButton,
	activateTool,
	click,
	PLAN_DTO,
	planEditorQueriesFor,
	pointer,
	PROJECT_ID,
	projectRepoWithFixture,
	rig,
	ZONE_A_DTO,
} from '../../helpers/planEditorRig';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { useEditorRuntime } from '../../../src/presentation/editor/runtime';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { expectOk, injectedPersistenceError, RecordingEventBus } from '../../helpers/domain';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { makePlan, makeZone } from '../../helpers/entities';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

// `activateNotices` — reached here through the real plugin/editor wiring — appends its
// two live regions with Obsidian's `createDiv`, one of the prototype extensions the app
// installs globally and this suite installs per file.
installObsidianDom();

/** `--interactive-accent` is what `themeTokens.ts` resolves the accent from. */
const ACCENT_FOR_TEST = 'rgb(4, 5, 6)';

/**
 * A notice is INERT until something activates the queue — `onload` is what does that in
 * production, so a suite asserting on `Notice.shown` has to stand where the plugin stands.
 * Per TEST, and for a second reason: the queue DEDUPS, so two cases raising the identical
 * sentence would fold into one `(×2)` and construct no second `Notice` at all.
 */
beforeEach(() => {
	activateNotices();
});

describe('the wired Plan Editor (design slice 8)', () => {
	it('draws a zone through the draw tool and canvas, persists it, selects it, and undo/redo keep the SAME id', async () => {
		const { harness, zonesRepo } = await rig();

		activateTool(harness, 'draw-polygon');
		await settle();

		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		click(canvas, 500, 100); // close click on the first vertex
		await settle();

		// Persisted, not merely rendered.
		const listed = expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded;
		expect(listed).toHaveLength(2);
		const created = listed.find((loaded) => loaded.entity.id !== 'zone-a');
		if (created === undefined) throw new Error('expected the drawn zone to persist');
		expect(created.entity.geometry.points).toEqual([
			{ x: 4520, y: 520 },
			{ x: 5520, y: 520 },
			{ x: 5520, y: 1520 },
		]);

		// The completion the plan editor hands `DrawPolygonTool` — plan id, counted name, Room —
		// used to be asserted at the tool and is asserted at the CLOSURE now, which is the only
		// place it exists since the tool stopped hard-wiring `CreateZone`.
		expect(created.entity.planId).toBe('plan-e2e');
		expect(created.entity.name).toBe('Room 2');
		expect(created.entity.zoneType).toBe('Room');

		// The panel shows the selection the draw left behind (DoD 3's Inspector half):
		// one fixture zone existed, so the drawn one is named "Room 2".
		expect(harness.wrapper.text()).toContain('Room 2');

		// Undo removes it; redo restores THE SAME entity (DoD 2).
		const undoButton = actionButton(harness, 'Undo');
		expect(undoButton.disabled).toBe(false);
		undoButton.click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).length === 1,
			'the undo of the drawn zone to land in the repository',
		);

		const redoButton = actionButton(harness, 'Redo');
		redoButton.click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).length === 2,
			'the redo to re-create the zone',
		);
		const afterRedo = expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded;
		expect(afterRedo).toHaveLength(2);
		expect(afterRedo.some((loaded) => loaded.entity.id === created.entity.id)).toBe(true);

		harness.unmount();
	});

	it('selects by click, moves by drag with exactly one command, and undo restores the exact points', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
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

		actionButton(harness, 'Undo').click();
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

		actionButton(harness, 'Select').click();
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

		actionButton(harness, 'Select').click();
		pointer(canvas, 'pointerdown', 200, 200);
		pointer(canvas, 'pointerup', 200, 200);
		await settle();

		const deleteButton = actionButton(harness, 'Delete');
		deleteButton.click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).length === 0,
			'the delete to land in the repository',
		);

		// Both the note-side repo state and the panel agree it is gone (DoD 3/8). The delete
		// clears the selection, so the Inspector falls back to its floor state (Task 15) —
		// "Nothing selected." was `RoomInspector`'s own text through Task 14; the frame's
		// floor state has no rooms left to list instead.
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(0);
		expect(harness.wrapper.text()).toContain('This floor has no rooms yet.');

		actionButton(harness, 'Undo').click();
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

		activateTool(harness, 'draw-polygon');
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

		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);

		harness.unmount();
	});

	it('returning to camera mode clears the active tool; camera-mode drag does not feed tools', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		activateTool(harness, 'draw-polygon');
		await settle();

		// Back to camera mode: drag pans again instead of feeding a tool.
		activateTool(harness, null);
		await settle();
		click(canvas, 200, 200);
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);

		harness.unmount();
	});

	it('routes modifier keys and non-primary buttons through the event translation', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
		await settle();

		// Middle button with a tool active: translated to 'auxiliary', which SelectTool
		// ignores — no selection, no dispatch.
		canvas.dispatchEvent(
			new PointerEvent('pointerdown', { button: 1, clientX: 200, clientY: 200, bubbles: true }),
		);
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);

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
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);

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
		const projects = await projectRepoWithFixture();
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
		const queries = planEditorQueriesFor(plans, projects, zonesRepo);
		zonesRepo.failuresLeft = 1; // fail exactly the drawn zone's insert
		const harness = await mountPlanEditor({
			plan: PLAN_DTO,
			zones: [ZONE_A_DTO],
			queries,
			commands: {
				// Spread over the refusal bundle so every member of the interface EXISTS —
				// slice 10's requirement collaborators and the leaf's logger among them. The
				// five below are the ones these rigs actually drive; the rest refuse, which is
				// right for a rig whose project references nothing.
				...unavailablePlanEditorCommands(),
				createZone: new CreateZoneCommand(zonesRepo, plans, events),
				moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
				deleteZone: makeDeleteZoneCommand(zonesRepo, events),
				zones: zonesRepo,
				zoneInspector: new GetZoneInspector(zonesRepo),
			},
		});
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		activateTool(harness, 'draw-polygon');
		await settle();
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();

		// The write failed; nothing was created and no selection was made.
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);
		// And the buffer is INTACT: the next click would still close it.
		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();

		// The editor survives: a deliberate fresh draw with the fault cleared succeeds.
		click(canvas, 500, 100);
		click(canvas, 600, 100);
		click(canvas, 600, 200);
		click(canvas, 500, 100);
		await settle();
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(2);

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
		expect(harness.wrapper.text()).not.toContain('Delete');

		harness.unmount();
	});

	it('a FAILED delete surfaces through the notice seam and leaves the zone intact', async () => {
		const plans = new InMemoryPlanRepository();
		const projects = await projectRepoWithFixture();
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
			queries: planEditorQueriesFor(plans, projects, zonesRepo),
			commands: {
				// Spread over the refusal bundle so every member of the interface EXISTS —
				// slice 10's requirement collaborators and the leaf's logger among them. The
				// five below are the ones these rigs actually drive; the rest refuse, which is
				// right for a rig whose project references nothing.
				...unavailablePlanEditorCommands(),
				createZone: new CreateZoneCommand(zonesRepo, plans, events),
				moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
				deleteZone: makeDeleteZoneCommand(zonesRepo, events),
				zones: zonesRepo,
				zoneInspector: new GetZoneInspector(zonesRepo),
			},
		});
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
		click(canvas, 200, 200);
		await settle();

		zonesRepo.failuresLeft = 1;
		const noticesBefore = Notice.shown.length;
		actionButton(harness, 'Delete').click();
		await settle();

		// The write failed, the zone survives, and the refusal reached the user through the
		// same seam a failed draw uses — not a silent no-op.
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);
		expect(Notice.shown.length).toBe(noticesBefore + 1);
		expect(harness.wrapper.text()).toContain('Kitchen'); // selection and panel intact

		harness.unmount();
	});

	/**
	 * THREE of the four cases below close gaps the audit of
	 * `docs/tests/cases/Zone Editing Walkthrough.md` found — its steps 1, 2 and 14. Each was
	 * a step the suite was ASSUMED to cover: two because the only interaction-layer assertion
	 * in the editor suite counts `Circle` nodes and is silent about everything beside them,
	 * and one because the REDO side of a delete was never driven end to end.
	 *
	 * The fourth, *undoes a VERTEX edit…*, is not a gap closure and the audit says so at
	 * length: step 7 was reported as a gap by that audit's first pass and the report was
	 * measured false — `selectTool`'s own vertex case asserts the whole pre-drag point list
	 * against the recorded inverse, three lines below the name the first pass stopped at, so
	 * the defect it claimed nothing would catch reddens that case. This one is a SECOND net,
	 * over the narrower thing that really was undriven: no case had pressed Undo after a
	 * vertex edit and then read the REPOSITORY, so the dispatch-to-vault link went untested
	 * while the polygon handed to the dispatcher did not. Counting it among the closures
	 * would inflate the recorded count and contradict the audit it cites.
	 */

	it('draws the accent OUTLINE beside the handles, which a Circle count cannot see', async () => {
		document.documentElement.style.setProperty('--interactive-accent', ACCENT_FOR_TEST);
		const { harness } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 200, 200);
		await settle();

		const interaction = harness.stage?.findOne<Konva.Layer>('.interaction');
		// The handles were already asserted elsewhere; this is the shape drawn BESIDE them,
		// and an outline that stopped being drawn would leave that count untouched.
		const outlines = interaction?.find<Konva.Line>('Line') ?? [];
		expect(outlines).toHaveLength(1);
		expect(outlines[0]?.closed()).toBe(true);
		// The fixture rect (1500..4400)² through the default camera: world = 10 × screen − 480.
		expect(outlines[0]?.points()).toEqual([198, 198, 488, 198, 488, 388, 198, 388]);
		// A node in the tree is not a node the user can SEE: a zero width or an absent stroke
		// leaves every assertion above true and draws nothing. The colour is asserted against
		// the variable it is resolved from, so this also pins it as the ACCENT the step names
		// rather than any stroke at all.
		expect(outlines[0]?.strokeWidth()).toBeGreaterThan(0);
		expect(outlines[0]?.stroke()).toBe(ACCENT_FOR_TEST);

		document.documentElement.style.removeProperty('--interactive-accent');
		harness.unmount();
	});

	it('takes the outline and the handles down on deselection, not just the store entry', async () => {
		const { harness } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 200, 200);
		await settle();

		const interaction = harness.stage?.findOne<Konva.Layer>('.interaction');
		expect(interaction?.find('Circle')).toHaveLength(ZONE_A_DTO.points.length);
		expect(interaction?.find('Line')).toHaveLength(1);

		// (700,500) is world (6520,4520) — outside the fixture rect, so this is empty canvas.
		click(canvas, 700, 500);
		await settle();

		// The store emptying and the Inspector falling back to its floor state (Task 15) are
		// asserted by the unit suite. What neither can see is the CANVAS: handles left behind
		// would satisfy both and go on being drawn over a zone the user no longer has selected.
		expect(interaction?.find('Circle')).toHaveLength(0);
		expect(interaction?.find('Line')).toHaveLength(0);

		harness.unmount();
	});

	it('undoes a VERTEX edit to every original point, not just the one that moved', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 200, 200);
		await settle();

		pointer(canvas, 'pointerdown', 199, 199);
		pointer(canvas, 'pointermove', 250, 250);
		pointer(canvas, 'pointerup', 250, 250);
		await until(
			async () => (expectOk(await zonesRepo.getById('zone-a' as never)))
				?.entity.geometry.points[0]?.x === 2020,
			'the vertex drag to land in the repository',
		);

		actionButton(harness, 'Undo').click();
		await until(
			async () => (expectOk(await zonesRepo.getById('zone-a' as never)))
				?.entity.geometry.points[0]?.x === 1500,
			'the undo of the vertex edit to restore the moved point',
		);

		// EVERY point, not only the moved one. A `SelectTool` that snapshotted the geometry
		// AFTER the edit would restore the dragged vertex and leave the rest as they are —
		// which is indistinguishable from correct until the whole array is compared. That
		// mutation reddens `selectTool`'s own vertex case too, and this is the SECOND net
		// rather than the only one: what it adds is the READ-BACK, since the unit case
		// asserts the inverse the dispatcher was handed and never that the vault took it.
		const restored = expectOk(await zonesRepo.getById('zone-a' as never));
		expect(restored?.entity.geometry.points).toEqual(ZONE_A_DTO.points);

		harness.unmount();
	});

	it('redoes a DELETE, which is the one command whose own undo put the entity back', async () => {
		const { harness, zonesRepo } = await rig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		actionButton(harness, 'Select').click();
		await settle();
		click(canvas, 200, 200);
		await settle();

		actionButton(harness, 'Delete').click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).length === 0,
			'the delete to land in the repository',
		);

		actionButton(harness, 'Undo').click();
		await until(
			async () => (expectOk(await zonesRepo.getById('zone-a' as never))) !== null,
			'the undo of the delete to restore the zone',
		);

		actionButton(harness, 'Redo').click();
		await until(
			async () => (expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).length === 0,
			'the redo of the delete to remove the zone again',
		);
		expect(expectOk(await zonesRepo.getById('zone-a' as never))).toBeNull();

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
