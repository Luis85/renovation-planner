// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { mountPlanEditorCanvas, settle, settleUntil } from '../../helpers/editor';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { Notice } from '../../helpers/obsidian-mock';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { installObsidianDom } from '../../helpers/dom';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { err, ok } from '../../../src/core/result/Result';

installObsidianDom();

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const cleanups: (() => void)[] = [];
beforeEach(() => { activateNotices(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

const WALLS = WALL_LOOP.walls.map(wall => wall.id);

/** The editor's Room "Studio" and its four walls saved as one group, selected the way clicking any member selects it. */
async function setup(): Promise<Rig> {
	const rig = await renovationEditor(true);
	cleanups.push(rig.unmount); rig.changePlan(); await settle();
	const read = expectOk(await rig.geometry.read(rig.plan.id)), members = [rig.room.id, ...WALLS];
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups: [{ id: 'group-studio', name: 'Studio set', memberIds: members }] }, read.version));
	await rig.runtime.refreshProjection();
	rig.selection.select(members as never[]); await settle();
	return rig;
}
function key(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}
const confirmation = (rig: Rig, what: string) => settleUntil(() => rig.dialogs.current?.kind === 'confirm', what);

it('deletes a selected group with the Delete key as one confirmed step that one Undo restores', async () => {
	const rig = await setup(), zones = rig.project.zones.size;
	expect(key(rig.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(true);
	await confirmation(rig, 'the group deletion confirmation');
	const dialog = rig.wrapper.get('.rp-dialog').text();
	expect(dialog).toContain('Studio'); expect(dialog).toContain('Wall 1'); expect(dialog).toContain('Rooms and areas deleted: 1');
	rig.dialogs.resolve('confirm');
	await settleUntil(() => rig.project.zones.size === zones - 1, 'the deleted room');
	await settle();
	expect(rig.project.structure.walls).toEqual([]);
	expect(rig.project.groups).toEqual([]);
	expect(rig.selection.selectedIds).toEqual([]);
	key(rig.canvasEl, { key: 'z', ctrlKey: true });
	await settleUntil(() => rig.project.zones.size === zones && rig.project.structure.walls.length === WALLS.length, 'the restored group');
	await settle();
	expect(rig.project.groups.map(group => group.memberIds)).toEqual([[rig.room.id, ...WALLS]]);
});

it('offers Delete group in a saved group\'s context menu, and Delete for any other selection of several', async () => {
	const rig = await setup(), zones = rig.project.zones.size;
	const openMenu = async () => { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); };
	await openMenu();
	const item = rig.wrapper.get('[data-rp-context-action="delete"]');
	expect(item.text()).toContain('Delete group');
	await item.trigger('click');
	await confirmation(rig, 'the group deletion confirmation');
	rig.dialogs.resolve('cancel'); await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the cancelled deletion');
	expect(rig.project.zones.size).toBe(zones); expect(rig.project.structure.walls).toHaveLength(WALLS.length);
	rig.selection.select(WALLS.slice(0, 2) as never[]); await settle();
	await openMenu();
	const label = rig.wrapper.get('[data-rp-context-action="delete"]').text();
	expect(label).toContain('Delete'); expect(label).not.toContain('group');
});

it('runs a single item\'s own Delete from Backspace', async () => {
	const rig = await setup();
	rig.selection.select(['wall-a'] as never[]); await settle();
	expect(key(rig.canvasEl, { key: 'Backspace' }).defaultPrevented).toBe(true);
	await confirmation(rig, 'the wall deletion confirmation');
	rig.dialogs.resolve('cancel'); await settleUntil(() => !rig.runtime.structureActions.active.value, 'the cancelled wall deletion');
	expect(rig.project.structure.walls).toHaveLength(WALLS.length);
});

it('leaves chords, repeats, composition, dialogs, a stale floor, Review and fields alone', async () => {
	const rig = await setup(), button = () => rig.wrapper.get('[data-rp-action="select"]').element as HTMLElement;
	for (const press of [{ key: 'Delete', ctrlKey: true }, { key: 'Delete', metaKey: true }, { key: 'Delete', altKey: true }, { key: 'Delete', repeat: true }, { key: 'Backspace', isComposing: true }]) {
		expect(key(rig.canvasEl, press).defaultPrevented).toBe(false);
	}
	const pending = rig.dialogs.openDialog({ kind: 'confirm', title: 'Confirm', message: 'Example' }); await settle();
	expect(key(button(), { key: 'Delete' }).defaultPrevented).toBe(false);
	rig.dialogs.resolve('cancel'); await pending;
	rig.project.stale = true;
	expect(key(rig.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(false);
	rig.project.stale = false;
	await rig.runtime.renovation.perspective('review'); await settle();
	expect(key(rig.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(false);
	await rig.runtime.renovation.perspective('plan'); await settle();
	rig.runtime.setTool('draw-room'); await settle();
	expect(key(rig.wrapper.get('.rp-new-room input').element as HTMLElement, { key: 'Backspace' }).defaultPrevented).toBe(false);
	await settle();
	expect(rig.dialogs.current).toBeNull();
	expect(rig.project.structure.walls).toHaveLength(WALLS.length);
});

it('offers no Delete, from the menu or the key, for several items on a floor without renovation services', async () => {
	const harness = await mountPlanEditorCanvas();
	cleanups.push(harness.unmount); await settle();
	const selection = useSelectionStore(harness.pinia), zones = [...useProjectStore(harness.pinia).zones.keys()];
	expect(zones.length).toBeGreaterThan(1);
	selection.select(zones.slice(0, 2) as never[]); await settle();
	expect(key(harness.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(false);
	harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	expect(harness.wrapper.find('[data-rp-context-action="fit"]').exists()).toBe(true);
	expect(harness.wrapper.find('[data-rp-context-action="delete"]').exists()).toBe(false);
});

it('refuses a selection holding a room requirements still refer to, and reports a failed lookup, writing nothing', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], lookup = vi.spyOn(rig.deps.queries, 'listRequirementsReferencing');
	lookup.mockResolvedValueOnce(ok([{ projectId: rig.plan.projectId, projectName: 'Home', requirementIds: ['requirement-tiles'] }]) as never);
	key(rig.canvasEl, { key: 'Delete' });
	await confirmation(rig, 'the refusal');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Requirements still refer to Studio.');
	rig.dialogs.resolve('confirm'); await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the refused deletion');
	const shown = Notice.shown.length;
	lookup.mockResolvedValueOnce(err(injectedPersistenceError()) as never);
	key(rig.canvasEl, { key: 'Delete' });
	await settleUntil(() => Notice.shown.length === shown + 1, 'the lookup failure notice');
	await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the failed deletion');
	expect(rig.dialogs.current).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
