// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { runtimeOf, settle, settleUntil as until } from '../../helpers/editor';
import { actionButton, canvasOf, click, rig, ZONE_A_DTO } from '../../helpers/planEditorRig';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { expectOk } from '../../helpers/domain';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

// `rig()` mounts the real Plan Editor, whose notices append live regions with Obsidian's `createDiv`.
installObsidianDom();
beforeEach(() => { activateNotices(); });

/**
 * BP-05's "modifier change mid-gesture" for a MOVE drag. A PIN, not a requirement: no spec,
 * PBI or ADR says what Shift or Alt does once a body move has started. What the code does is
 * read both at the PRESS only (`SelectTool.pointerDown`, where either one makes the press a
 * selection click that starts no drag); the body translation (`SelectTool.moved`) reads no
 * modifier, while the surface re-issues a pointer move on the key itself (`keyDoors.ts`).
 */
it.each([
	['Shift', { shiftKey: true }],
	['Alt', { altKey: true }],
] as const)('keeps a body move drag when %s goes down mid-drag: one write of the plain translation, and the gesture ends', async (name, held) => {
	const { harness, zonesRepo } = await rig();
	const canvas = canvasOf(harness), runtime = runtimeOf(harness);
	actionButton(harness, 'Select').click();
	await settle();
	const saves = vi.spyOn(zonesRepo, 'save');
	const at = (type: string, x: number, y: number, modifiers: PointerEventInit = {}) => canvas.dispatchEvent(
		new PointerEvent(type, { button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, clientX: x, clientY: y, bubbles: true, ...modifiers }));

	// +60 px by +30 px = +600 mm by +300 mm, diagonal so an axis constraint would show.
	at('pointerdown', 200, 200);
	at('pointermove', 230, 215);
	canvas.dispatchEvent(new KeyboardEvent('keydown', { key: name, ...held, bubbles: true }));
	at('pointermove', 245, 222, held);
	at('pointerup', 260, 230, held);
	canvas.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true }));
	await until(async () => expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0]?.x !== 1500, 'the move to land');
	await settle();

	const moved = expectOk(await zonesRepo.getById('zone-a' as never));
	expect(moved?.entity.geometry.points).toEqual(ZONE_A_DTO.points.map(point => ({ x: point.x + 600, y: point.y + 300 })));
	expect(saves).toHaveBeenCalledTimes(1);
	expect(runtime.toolManager.gestureInFlight).toBe(false);
	expect(runtime.toolManager.activeToolHasDraft()).toBe(false);

	// The next click behaves as a click: on empty canvas it clears the selection and writes nothing.
	click(canvas, 700, 550);
	await settle();
	expect(useSelectionStore(harness.pinia).selectedIds).toEqual([]);
	expect(saves).toHaveBeenCalledTimes(1);

	// One history entry: one Undo restores the original outline, and nothing is left to undo.
	actionButton(harness, 'Undo').click();
	await until(async () => expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0]?.x === 1500, 'the undo to land');
	expect(expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points).toEqual(ZONE_A_DTO.points);
	expect(runtime.canUndo.value).toBe(false);

	harness.unmount();
});
