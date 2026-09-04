/**
 * @vitest-environment jsdom
 *
 * Add Room, end to end, through the REAL mounted Plan Editor — real Vue, real Pinia, real
 * Konva, the real canvas/banner/Inspector wiring — against in-memory repositories, so a
 * dragged rectangle is genuinely written and the post-command refresh genuinely re-reads
 * what was written.
 *
 * Tasks 1–10 each proved their own piece against its own seam: the tool against a draft
 * port, `createRoomFromDraft` against a hand-built dispatcher, the form against a mounted
 * canvas with the store driven directly. NONE of them drives the whole chain — a pointer on
 * the canvas, into the draft store, into the form, into one command, into the repository,
 * and back out through the refresh into the selection, the Inspector and the banner. That
 * chain is what this file is for, and the defects it can see are the ones that live BETWEEN
 * two green tasks.
 *
 * Geometry note (`planEditorRig`'s): `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so
 * world = 10 × screen − 480 per axis at the default camera. The fixture plan holds ONE zone,
 * `ZONE_A_DTO`, named "Kitchen" — which is why every assertion about the Inspector's room
 * body below reads `data-rp-id` as well as the heading: the name alone cannot tell the
 * fixture zone from a room this file creates and calls the same thing.
 *
 * **What no case here can see.** jsdom lays nothing out, so nothing below grades where the
 * banner, the form or the sketch actually appear, only that they are in the tree; and
 * `Notice.shown` counts constructions rather than anything a user could read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Mock-only surface, imported BY NAME — `Notice.shown` is a static the real `obsidian`
// module does not declare, and the vitest alias points that specifier at this very file.
import { Notice } from '../../helpers/obsidian-mock';
import { runtimeOf, settle, settleUntil as until } from '../../helpers/editor';
import { actionButton, activateTool, PLAN_DTO, pointer, rig } from '../../helpers/planEditorRig';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { err } from '../../../src/core/result/Result';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

// `activateNotices` — reached here through the real editor wiring — appends its two live
// regions with Obsidian's `createDiv`, one of the prototype extensions the app installs
// globally and this suite installs per file.
installObsidianDom();

/**
 * A notice is INERT until something activates the queue, and case 5 asserts that NO notice
 * was raised. Over an inactive queue that assertion is true of every build ever written, so
 * the queue is armed per test exactly as `zoneEditing.test.ts` arms it.
 */
beforeEach(() => {
	activateNotices();
});

type Harness = Awaited<ReturnType<typeof rig>>['harness'];
type ZonesRepo = Awaited<ReturnType<typeof rig>>['zonesRepo'];

/** Every case reads the same plan back; spelled once rather than at each `listByPlan`. */
async function zonesIn(zonesRepo: ZonesRepo) {
	return expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded;
}

/**
 * The brief's drag: press at screen (100,100), three moves, release at (520,480) — world
 * (520,520) to (4720,4320), so a 4200 × 3800 rectangle with its min corner at (520,520).
 *
 * Three intermediate moves rather than one, because a rectangle tool that wrote only on
 * release would pass a one-move drag identically; and a real `pointerup` at the last move's
 * own coordinates, which is the grammar a mouse actually sends.
 */
function dragRoom(canvas: HTMLElement): void {
	pointer(canvas, 'pointerdown', 100, 100);
	pointer(canvas, 'pointermove', 240, 230);
	pointer(canvas, 'pointermove', 380, 350);
	pointer(canvas, 'pointermove', 520, 480);
	pointer(canvas, 'pointerup', 520, 480);
}

function canvasOf(harness: Harness): HTMLElement {
	const canvas = harness.canvasEl;
	if (canvas === null) throw new Error('expected a mounted canvas');
	return canvas;
}

/** Activates the room task and waits for the form the Inspector routes to. */
async function startRoomTask(harness: Harness): Promise<void> {
	activateTool(harness, 'draw-room');
	await settle();
	if (!harness.wrapper.find('.rp-new-room').exists()) throw new Error('expected the New room form');
}

async function pressCreate(harness: Harness): Promise<void> {
	await harness.wrapper.find('button.rp-new-room__create').trigger('click');
}

/** The one zone in the repository that is not the fixture's. */
function createdZone(loaded: Awaited<ReturnType<typeof zonesIn>>) {
	const created = loaded.find((entry) => entry.entity.id !== 'zone-a');
	if (created === undefined) throw new Error('expected a created room in the repository');
	return created.entity;
}

/**
 * Drag, name and Create through the real form, on a task the CALLER has already started —
 * returning what landed in the repository so each case can go on to assert its own half.
 *
 * Starting the task is deliberately left outside: the keep-adding case has to tick its
 * checkbox between the activation and the drag, because `DrawRoomTool.activate` runs
 * `beginTask`, which clears that flag.
 */
async function createRoomByDrag(harness: Harness, zonesRepo: ZonesRepo, name: string) {
	dragRoom(canvasOf(harness));
	await settle();
	await harness.wrapper.find('input.rp-new-room__name').setValue(name);
	await pressCreate(harness);
	await until(async () => (await zonesIn(zonesRepo)).length === 2, 'the drawn room to be written');
	await settle();
	return createdZone(await zonesIn(zonesRepo));
}

describe('Add Room, end to end', () => {
	it('drags a rectangle, names it, and Create writes it, selects it and ends the task', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		await startRoomTask(harness);
		dragRoom(canvasOf(harness));
		await settle();

		// The drag reached the ONE store both surfaces read (design spec §2.2) — asserted
		// before the name is typed, so this is the pointer's own contribution and not the
		// form's.
		expect(runtime.roomDraft.rect).toEqual({ x: 520, y: 520, width: 4200, depth: 3800 });

		await harness.wrapper.find('input.rp-new-room__name').setValue('Kitchen');
		expect(runtime.roomDraft.name).toBe('Kitchen');
		await pressCreate(harness);
		await until(async () => (await zonesIn(zonesRepo)).length === 2, 'the drawn room to be written');
		await settle();

		// Persisted, not merely drawn — the rectangle the drag described, clockwise from the
		// min corner, under the name the form supplied and the type Add → Room decided.
		const created = createdZone(await zonesIn(zonesRepo));
		expect(created.name).toBe('Kitchen');
		expect(created.zoneType).toBe('Room');
		expect(created.geometry.points).toEqual([
			{ x: 520, y: 520 },
			{ x: 4720, y: 520 },
			{ x: 4720, y: 4320 },
			{ x: 520, y: 4320 },
		]);

		// And the editor came back to rest ON the new room: selected, under Select, with the
		// task's two surfaces gone and the Inspector showing the room body instead.
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual([created.id]);
		expect(runtime.activeToolId.value).toBe('select');
		expect(harness.wrapper.find('.rp-task-banner').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(false);
		const body = harness.wrapper.find('.rp-room-inspector');
		// The `data-rp-id` is what makes this an assertion about the ROOM just created: the
		// fixture zone is also called "Kitchen", so the heading alone cannot tell them apart.
		expect(body.attributes('data-rp-id')).toBe(created.id);
		expect(body.text()).toContain('Kitchen');

		harness.unmount();
	});

	it('undo removes the room and redo restores the SAME id', async () => {
		const { harness, zonesRepo } = await rig();
		await startRoomTask(harness);
		const created = await createRoomByDrag(harness, zonesRepo, 'Kitchen');

		const undoButton = actionButton(harness, 'Undo');
		expect(undoButton.disabled).toBe(false);
		undoButton.click();
		await until(async () => (await zonesIn(zonesRepo)).length === 1, 'the undo of the room to land');

		actionButton(harness, 'Redo').click();
		await until(async () => (await zonesIn(zonesRepo)).length === 2, 'the redo to re-create the room');

		// The SAME entity, not merely another rectangle of the same size — which is the whole
		// claim `ReversibleCreateZoneCommand` makes and the one a count cannot see.
		const afterRedo = await zonesIn(zonesRepo);
		expect(afterRedo.some((entry) => entry.entity.id === created.id)).toBe(true);

		harness.unmount();
	});

	it('Escape clears a drafted rectangle and stays; a second Escape returns to Select', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		const canvas = canvasOf(harness);

		await startRoomTask(harness);
		dragRoom(canvas);
		await settle();
		expect(runtime.roomDraft.rect).not.toBeNull();

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();

		// One step back, not two: the rectangle is gone and the task is still the task, which
		// is what lets a user who mis-dragged simply drag again.
		expect(runtime.roomDraft.rect).toBeNull();
		expect(runtime.activeToolId.value).toBe('draw-room');
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(true);
		expect(await zonesIn(zonesRepo)).toHaveLength(1);

		canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		await settle();
		expect(runtime.activeToolId.value).toBe('select');
		expect(await zonesIn(zonesRepo)).toHaveLength(1);

		harness.unmount();
	});

	it('Cancel leaves the task in one gesture and writes nothing', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		await startRoomTask(harness);
		dragRoom(canvasOf(harness));
		await settle();
		await harness.wrapper.find('input.rp-new-room__name').setValue('Utility room');

		await harness.wrapper.find('button.rp-new-room__cancel').trigger('click');
		await settle();

		// Cancel is the one-gesture exit (R7): the draft goes with the task, and a named,
		// sized rectangle that was never confirmed leaves the vault exactly as it was.
		expect(await zonesIn(zonesRepo)).toHaveLength(1);
		expect(runtime.activeToolId.value).toBe('select');
		expect(runtime.roomDraft.rect).toBeNull();
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(false);

		harness.unmount();
	});

	/**
	 * **The surface is the SAVE-STATE BADGE, and it is the badge rather than a toast on
	 * purpose.** `injectedPersistenceError()` is category `Persistence`, which is not one of
	 * `affectsSaveState`'s four pre-write categories, so `withSaveStateTracking` — one layer
	 * below this dispatch, inside `wrapDispatcher` — resolves it as a save error and flips the
	 * indicator. `reportDispatchFailure`, which `createRoomFromDraft` calls as `reportRejected`,
	 * then asks the SAME predicate and routes it to the `autosave-write` origin, whose sink in
	 * `report-failure.ts` is deliberately a no-op: design slice 17 forbids one failure being
	 * reported through two widgets that can drift apart. So the badge is the whole surface, and
	 * both halves are asserted, because "the badge flipped" is equally true of a build that
	 * toasts as well.
	 */
	it('a detonated save leaves no phantom room: the badge reports it and the task survives', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		// One-shot, at the port: `rig()` has already saved the fixture zone, so the next save
		// is exactly the room this case draws.
		vi.spyOn(zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));

		await startRoomTask(harness);
		dragRoom(canvasOf(harness));
		await settle();
		await harness.wrapper.find('input.rp-new-room__name').setValue('Kitchen');

		const noticesBefore = Notice.shown.length;
		await pressCreate(harness);
		await until(
			() => harness.wrapper.find('.rp-save-state-label').classes().includes('rp-save-state-save-error'),
			'the save indicator to report the refused write',
		);
		await settle();
		expect(Notice.shown.length).toBe(noticesBefore);

		// Nothing was written, nothing was selected, and the user's own rectangle and name are
		// still on screen — a refusal is recoverable by pressing Create again, which it would
		// not be if the draft had been cleared with it.
		expect(await zonesIn(zonesRepo)).toHaveLength(1);
		expect(runtime.roomDraft.rect).toEqual({ x: 520, y: 520, width: 4200, depth: 3800 });
		expect(runtime.roomDraft.name).toBe('Kitchen');
		expect(runtime.activeToolId.value).toBe('draw-room');
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual([]);
		// The guard that is also the in-flight state: left true, Create would be dead for the
		// rest of the task and `canCreateRoom` false with no reason on screen.
		expect(runtime.roomDraft.submitting).toBe(false);
		expect(runtime.canCreateRoom.value).toBe(true);

		harness.unmount();
	});

	it('the numeric route creates a room with no pointer at all, centred on the stage', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		await startRoomTask(harness);
		const width = harness.wrapper.find('input[name="width"]');
		await width.setValue('4.2');
		await width.trigger('blur');
		const depth = harness.wrapper.find('input[name="depth"]');
		await depth.setValue('3.8');
		await depth.trigger('blur');
		await settle();

		await pressCreate(harness);
		await until(async () => (await zonesIn(zonesRepo)).length === 2, 'the typed room to be written');
		// The `until` above returns the moment the WRITE lands, which is inside the dispatch;
		// ending the task is what `createRoomFromDraft` does after it, so the tool assertion
		// below needs the tick after.
		await settle();

		// 800×600 stage at the default camera: centre (400,300) is world (3520,2520), so a
		// 4200 × 3800 rectangle centred there has its min corner at (1420,620).
		const created = createdZone(await zonesIn(zonesRepo));
		expect(created.geometry.points).toEqual([
			{ x: 1420, y: 620 },
			{ x: 5620, y: 620 },
			{ x: 5620, y: 4420 },
			{ x: 1420, y: 4420 },
		]);
		// The counted default the task began with — no name was typed, and the form supplies
		// one rather than refusing.
		expect(created.name).toBe('Room 2');
		expect(runtime.activeToolId.value).toBe('select');

		harness.unmount();
	});

	it('Keep adding rooms restarts the task on the created room and re-counts the default name', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		await startRoomTask(harness);
		// Ticked BEFORE the drag: `beginTask` clears the flag, and it runs on activation.
		await harness.wrapper.find('.rp-new-room__keep input').setValue(true);
		expect(runtime.roomDraft.keepAdding).toBe(true);

		const created = await createRoomByDrag(harness, zonesRepo, 'Kitchen');

		// The room was created and selected exactly as it is without the flag...
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual([created.id]);
		// ...and the task is still running, with a FRESH rectangle-less draft.
		expect(runtime.activeToolId.value).toBe('draw-room');
		expect(runtime.roomDraft.rect).toBeNull();
		expect(runtime.roomDraft.keepAdding).toBe(true);
		expect(harness.wrapper.find('.rp-new-room').exists()).toBe(true);

		// `Room 3`, not `Room 2`: the counted name is read AFTER the post-command refresh has
		// re-read the plan, so the second room is numbered against the two that now exist. A
		// `Room 2` here would be the refresh landing after `createRoomFromDraft` continues.
		expect(runtime.roomDraft.name).toBe('Room 3');
		expect((harness.wrapper.find('input.rp-new-room__name').element as HTMLInputElement).value).toBe('Room 3');

		harness.unmount();
	});
});
