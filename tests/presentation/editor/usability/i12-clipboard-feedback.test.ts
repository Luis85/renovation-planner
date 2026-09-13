// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { settle, settleUntil } from '../../../helpers/editor';
import { Notice } from '../../../helpers/obsidian-mock';
import { activateNotices } from '../../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../../helpers/dom';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { WALL_LOOP } from '../../../helpers/structure';
import { STAGE_PIXELS, worldToScreen } from '../../../../src/presentation/editor/viewport/Viewport';

installObsidianDom();

const cleanups: (() => void)[] = [];
beforeEach(() => { activateNotices(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); });

function key(target: HTMLElement, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

it('I12 reports actual copied geometry, its target floor, exclusions and existing Undo recovery after direct Paste', async () => {
	const rig = await renovationEditor(true);
	cleanups.push(rig.unmount);
	rig.changePlan();
	await settle();
	rig.selection.select([rig.room.id, ...WALL_LOOP.walls.map(item => item.id)] as never);
	key(rig.canvasEl, { key: 'c', ctrlKey: true });
	const editor = useEditorStore(rig.pinia);
	editor.setPointer(worldToScreen({ x: 20000, y: 20000 }, editor.viewport, STAGE_PIXELS));
	const before = Notice.shown.length;
	key(rig.canvasEl, { key: 'v', ctrlKey: true });
	await settleUntil(() => Notice.shown.length === before + 1, 'the copied-scope success notice');
	const message = Notice.shown.at(-1) ?? '';
	expect(message).toContain(`Pasted into ${rig.project.plan?.name ?? 'Floor'}.`);
	expect(message).toContain('Rooms: 1 · Walls: 4');
	expect(message).toContain('Work, materials, costs and evidence stay with the original.');
	expect(message).toContain('Use Undo to reverse this paste.');
	expect(rig.runtime.canUndo.value).toBe(true);
});
