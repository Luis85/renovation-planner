// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { mountPlanEditorCanvas, settle, settleUntil } from '../../helpers/editor';
import { Notice } from '../../helpers/obsidian-mock';
import { expectDefined, expectOk } from '../../helpers/domain';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import { WALL_LOOP } from '../../helpers/structure';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
import { placeAt } from '../../helpers/layout';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { createEditorClipboard, type EditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { screenPoint, screenToWorld, stageCentreWorld, STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';
import { groupPivot } from '../../../src/domain/spatial/groupGeometry';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';
import type { Point } from '../../../src/core/geometry/Point';
import type { PlanId } from '../../../src/domain/plan/PlanId';

installObsidianDom();

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const cleanups: (() => void)[] = [];
beforeEach(() => { activateNotices(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

async function setup(clipboard?: EditorClipboard): Promise<Rig> {
	const rig = await renovationEditor(true, undefined, clipboard);
	cleanups.push(rig.unmount); rig.changePlan(); await settle();
	return rig;
}
function key(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}
function pointAt(rig: Rig, world: Point): void {
	const editor = useEditorStore(rig.pinia);
	editor.setPointer(worldToScreen(world, editor.viewport, STAGE_PIXELS));
}
const added = (rig: Rig, before: ReadonlySet<string>) => [...rig.project.zones.values()].filter(zone => !before.has(zone.id));
function expectCentred(points: readonly Point[], at: Point): void {
	const centre = expectDefined(groupPivot(points), 'centre');
	expect(centre.x).toBeCloseTo(at.x); expect(centre.y).toBeCloseTo(at.y);
}
const menuIds = (rig: Rig) => rig.wrapper.findAll('[data-rp-context-action]').map(item => item.attributes('data-rp-context-action'));
async function keyboardMenu(rig: Rig): Promise<void> {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
}

it('copies with Ctrl+C and pastes under the pointer with Ctrl+V, as one undo step that selects the result', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys()), walls = rig.project.structure.walls.length;
	rig.selection.select([rig.room.id, ...WALL_LOOP.walls.map(item => item.id)] as never);
	expect(key(rig.canvasEl, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(true);
	pointAt(rig, { x: 20000, y: 20000 });
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(true);
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	const [pasted] = added(rig, before);
	expectCentred(pasted.points, { x: 20000, y: 20000 });
	expect(rig.project.structure.walls).toHaveLength(walls + 4);
	expect(rig.selection.selectedIds).toEqual([pasted.id, ...rig.project.structure.walls.slice(walls).map(item => item.id)]);
	expect(rig.selection.focusedId).toBe(pasted.id);
	key(rig.canvasEl, { key: 'z', metaKey: true });
	await settleUntil(() => rig.project.zones.size === before.size, 'the undone paste');
	expect(rig.project.structure.walls).toHaveLength(walls);
});

it('pastes at the view centre when the pointer is off the canvas', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	editor.setPointer(null); expect(editor.pointerWorld).toBeNull();
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	expectCentred(added(rig, before)[0].points, stageCentreWorld(editor.stageSize, editor.viewport));
});

it('offers Copy for a selection and Paste once something is copied, pasting where the menu was opened', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); await keyboardMenu(rig);
	expect(menuIds(rig)).toContain('copy'); expect(menuIds(rig)).not.toContain('paste');
	await rig.wrapper.get('[data-rp-context-action="copy"]').trigger('click'); await settle();
	const opened = screenToWorld(screenPoint(700, 50), editor.viewport, STAGE_PIXELS);
	rig.canvasEl.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 700, clientY: 50 })); await settle();
	expect(menuIds(rig)).toContain('paste');
	editor.setPointer(null);
	await rig.wrapper.get('[data-rp-context-action="paste"]').trigger('click');
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	expectCentred(added(rig, before)[0].points, opened);
});

it('pastes nothing when the floor goes stale between the menu opening and the click', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	await keyboardMenu(rig);
	const paste = rig.wrapper.get('[data-rp-context-action="paste"]');
	expect(paste.attributes('aria-disabled')).toBeUndefined();
	rig.project.stale = true;
	await paste.trigger('click'); await settle();
	expect(rig.project.zones.size).toBe(before.size);
});

it('leaves fields, dialogs, chords, empty clipboards, stale floors and Review alone', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys());
	// Re-queried each time: Review unmounts the floating Select button, and Plan draws a new one.
	const button = () => rig.wrapper.get('[data-rp-action="select"]').element as HTMLElement;
	expect(key(button(), { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.selection.clear();
	expect(key(button(), { key: 'c', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.selection.select([rig.room.id]);
	for (const chord of [{ key: 'c', ctrlKey: true, shiftKey: true }, { key: 'c', ctrlKey: true, altKey: true }, { key: 'c', ctrlKey: true, isComposing: true }, { key: 'c' }, { key: 'x', ctrlKey: true }]) {
		expect(key(button(), chord).defaultPrevented).toBe(false);
	}
	expect(key(button(), { key: 'C', metaKey: true }).defaultPrevented).toBe(true);
	rig.project.stale = true;
	expect(key(button(), { key: 'c', ctrlKey: true }).defaultPrevented).toBe(true);
	expect(key(button(), { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.project.stale = false;
	await rig.runtime.renovation.perspective('review'); await settle();
	expect(key(rig.canvasEl, { key: 'c', ctrlKey: true }).defaultPrevented).toBe(true);
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	await rig.runtime.renovation.perspective('plan'); await settle();
	// Where a paste would succeed, so a repeat or a mid-gesture paste that did run would show below.
	pointAt(rig, { x: 20000, y: 20000 });
	expect(key(button(), { key: 'v', ctrlKey: true, repeat: true }).defaultPrevented).toBe(true);
	const editor = useEditorStore(rig.pinia);
	editor.beginPan(screenPoint(1, 1), 1);
	expect(key(button(), { key: 'v', ctrlKey: true }).defaultPrevented).toBe(true);
	editor.endPan(1);
	const pending = rig.dialogs.openDialog({ kind: 'confirm', title: 'Confirm', message: 'Example' }); await settle();
	expect(key(button(), { key: 'c', ctrlKey: true }).defaultPrevented).toBe(false);
	rig.dialogs.resolve('cancel'); await pending;
	rig.runtime.setTool('draw-room'); await settle();
	expect(key(rig.wrapper.get('.rp-new-room input').element as HTMLElement, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	await settle();
	expect(rig.project.zones.size).toBe(before.size);
});

it('notifies a refused paste and a faulted one without changing the floor', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys()), walls = rig.project.structure.walls.length;
	rig.selection.select([rig.room.id, ...WALL_LOOP.walls.map(item => item.id)] as never); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	const shown = Notice.shown.length;
	pointAt(rig, { x: 2000, y: 1500 });
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => Notice.shown.length === shown + 1, 'the refusal notice'); await settle();
	expect(Notice.shown.at(-1)).toBe('Walls cross or overlap. Place them so that walls meet only at their ends, then try again.');
	expect(rig.project.zones.size).toBe(before.size);
	expect(rig.project.structure.walls).toHaveLength(walls);
	vi.spyOn(rig.runtime.dispatcher, 'run').mockRejectedValueOnce(new Error('vault gone'));
	pointAt(rig, { x: 20000, y: 20000 });
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => Notice.shown.length === shown + 2, 'the fault notice');
	expect(rig.project.zones.size).toBe(before.size);
});

it('offers no paste on a floor missing the structure or the group services', async () => {
	// `null` is the positive control: the same mount with both services claims the chord, so the two refusals are not vacuous.
	for (const missing of ['renovation', 'groups', null] as const) {
		const clipboard = createEditorClipboard(), source = await setup(clipboard);
		source.selection.select([source.room.id]); key(source.canvasEl, { key: 'c', ctrlKey: true });
		const workspace = referenceWorkspace(harnessDeps(), HARNESS_PLAN); await workspace.ready;
		const commands = missing === null ? workspace.deps.commands : { ...workspace.deps.commands, [missing]: undefined };
		const target = await mountPlanEditorCanvas({ plan: HARNESS_PLAN, queries: workspace.deps.queries, commands, vault: workspace.deps.vault, clipboard });
		cleanups.push(target.unmount);
		expect(key(target.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(missing === null);
		await settle();
	}
});

it('pastes on one floor what was copied on another', async () => {
	const clipboard = createEditorClipboard(), source = await setup(clipboard), target = await setup(clipboard);
	const sourceZones = source.project.zones.size, before = new Set(target.project.zones.keys());
	source.selection.select([source.room.id]); key(source.canvasEl, { key: 'c', ctrlKey: true });
	pointAt(target, { x: 20000, y: 20000 });
	key(target.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => added(target, before).length === 1, 'the room pasted onto the other floor');
	expect(added(target, before)[0].name).toBe('Studio');
	expect(source.project.zones.size).toBe(sourceZones);
});

it('pastes from a keyboard-opened menu at the view centre, measured from the stage rather than the canvas box', async () => {
	const rig = await setup(), editor = useEditorStore(rig.pinia), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	// A box that measures other than the stage — a transform or sub-pixel rounding — must not move where Paste lands.
	placeAt(rig.canvasEl, 0, 0, 1000, 800);
	await keyboardMenu(rig); expect(menuIds(rig)).toContain('paste');
	await rig.wrapper.get('[data-rp-context-action="paste"]').trigger('click');
	await settleUntil(() => added(rig, before).length === 1, 'the pasted room');
	expectCentred(added(rig, before)[0].points, stageCentreWorld(editor.stageSize, editor.viewport));
});

/** Holds `service.read` until the returned release runs: an edit reading its baseline, before its form opens. */
function holdRead(service: { read(planId: PlanId): Promise<unknown> }): () => void {
	const read = service.read.bind(service);
	let release!: () => void;
	const gate = new Promise<void>(resolve => { release = resolve; });
	vi.spyOn(service, 'read').mockImplementation(async planId => { await gate; return read(planId); });
	return release;
}

it('offers no paste while a structure or element edit is in flight, from the menu or the shortcut', async () => {
	const rig = await setup();
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	// A real element, not a stand-in id: `elementActions.edit` on an id `elementFrom` cannot find
	// ends its own in-flight window through the not-found arm rather than the genuine baseline
	// read this case means to hold — `wall-a` names a WALL, which `elementActions` never resolves.
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const desk = { id: 'element-clipboard-guard-desk', kind: 'object' as const, name: 'Desk', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1500 }, { x: 500, y: 1500 }] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, desk), rig.runtime.structureTask.ledger)));
	await rig.runtime.refreshProjection();
	for (const [actions, service, at, targetId] of [[rig.runtime.structureActions, rig.services, 20000, 'wall-a'], [rig.runtime.elementActions, rig.renovation, 40000, desk.id]] as const) {
		const before = new Set(rig.project.zones.keys()), release = holdRead(service);
		const editing = actions.edit(targetId);
		expect(actions.active.value).toBe(true);
		pointAt(rig, { x: at, y: at });
		await keyboardMenu(rig);
		const paste = rig.wrapper.get('[data-rp-context-action="paste"]');
		expect(paste.attributes('aria-disabled')).toBe('true');
		expect(paste.attributes('title')).toBe('Not available while another tool or edit is active.');
		await paste.trigger('keydown', { key: 'Escape' });
		expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
		await settle();
		expect(rig.project.zones.size).toBe(before.size);
		// Released with the selection moved, so the edit ends without opening a form; Paste comes back.
		rig.selection.clear(); release(); await editing; vi.restoreAllMocks();
		expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(true);
		await settleUntil(() => added(rig, before).length === 1, 'the paste once the edit ended');
	}
});

/**
 * C-B3: a rotation reads its own baseline and then saves too (`rotationActions.ts`'s `operate`,
 * `readRotationBaseline`), the same shape the structure/element edit case above guards against —
 * a paste landing mid-read (or while its form is open) would make the rotation's later save
 * refuse as stale. `ready` in `clipboardActions.ts` folds in `runtime.rotationActions.active`,
 * which is already exposed on `EditorRuntime` (no line added to `runtime.ts`). A real ELEMENT
 * rather than the room: `readElementBaseline` reads through `renovation.read`, the same method
 * `holdRead` above already knows how to hold — the room's own `readZoneBaseline` goes through
 * `zones.getById` instead, a second lever this case does not need.
 */
it('offers no paste while a rotation is reading its baseline, from the menu or the shortcut', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys());
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	const desk = { id: 'element-rotation-guard-desk', kind: 'object' as const, name: 'Desk', points: [{ x: 3000, y: 3000 }, { x: 3500, y: 3000 }, { x: 3500, y: 3500 }, { x: 3000, y: 3500 }] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, desk), rig.runtime.structureTask.ledger)));
	await rig.runtime.refreshProjection();
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	rig.selection.select([desk.id as never]);
	const release = holdRead(rig.renovation);
	const rotating = rig.runtime.rotationActions.rotate(desk.id);
	expect(rig.runtime.rotationActions.active.value).toBe(true);
	pointAt(rig, { x: 20000, y: 20000 });
	await keyboardMenu(rig);
	const paste = rig.wrapper.get('[data-rp-context-action="paste"]');
	expect(paste.attributes('aria-disabled')).toBe('true');
	expect(paste.attributes('title')).toBe('Not available while another tool or edit is active.');
	await paste.trigger('keydown', { key: 'Escape' });
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	await settle();
	expect(rig.project.zones.size).toBe(before.size);
	release();
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'Room rotation form');
	rig.dialogs.resolve('cancel'); await rotating; vi.restoreAllMocks();
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(true);
	await settleUntil(() => added(rig, before).length === 1, 'the paste once the rotation ended');
});

/**
 * CI1 (fix round 1): the finding was that `ready` in `clipboardActions.ts` also gated on
 * `runtime.groupActions.active`, redundantly — `rotationActions.active` (`rotationActions.ts`)
 * already folds `runtime.groups?.active`, and the `groups` passed to `createRotationActions`
 * IS the same `groupActions` object `EditorRuntime` exposes (`spatialEditing.ts`). This proves
 * that fold alone still refuses Paste while a group operation reads its baseline: it must go
 * red if the `rotationActions.active` operand is dropped from `ready`'s `editing` expression.
 * The whole loop (room + all four walls) is moved together so no wall sits outside the moved
 * group, which keeps `adjustedNeighbours` at zero and avoids the "connected walls" confirm
 * dialog `groupOperations.ts`'s `commit` would otherwise open.
 */
it('offers no paste while a group move is reading its baseline, from the menu or the shortcut', async () => {
	const rig = await setup(), before = new Set(rig.project.zones.keys());
	rig.selection.select([rig.room.id]); key(rig.canvasEl, { key: 'c', ctrlKey: true });
	rig.selection.select([rig.room.id, ...WALL_LOOP.walls.map(item => item.id)] as never);
	const groups = expectDefined(rig.deps.commands.groups, 'group services');
	const release = holdRead(groups);
	const moving = rig.runtime.groupActions.moveBy({ dx: 100, dy: 100 });
	expect(rig.runtime.groupActions.active.value).toBe(true);
	pointAt(rig, { x: 20000, y: 20000 });
	await keyboardMenu(rig);
	const paste = rig.wrapper.get('[data-rp-context-action="paste"]');
	expect(paste.attributes('aria-disabled')).toBe('true');
	expect(paste.attributes('title')).toBe('Not available while another tool or edit is active.');
	await paste.trigger('keydown', { key: 'Escape' });
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(false);
	await settle();
	expect(rig.project.zones.size).toBe(before.size);
	release(); await moving; vi.restoreAllMocks();
	expect(key(rig.canvasEl, { key: 'v', ctrlKey: true }).defaultPrevented).toBe(true);
	await settleUntil(() => added(rig, before).length === 1, 'the paste once the group move ended');
});
