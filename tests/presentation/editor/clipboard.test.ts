// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { mountPlanEditorCanvas, settle, settleUntil } from '../../helpers/editor';
import { Notice } from '../../helpers/obsidian-mock';
import { expectDefined } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { referenceWorkspace } from '../../harness/referenceWorkspace';
import { HARNESS_PLAN, harnessDeps } from '../../harness/planEditor';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
installObsidianDom();
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { createEditorClipboard, type EditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { screenPoint, screenToWorld, stageCentreWorld, STAGE_PIXELS, worldToScreen } from '../../../src/presentation/editor/viewport/Viewport';
import { groupPivot } from '../../../src/domain/spatial/groupGeometry';
import type { Point } from '../../../src/core/geometry/Point';

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
