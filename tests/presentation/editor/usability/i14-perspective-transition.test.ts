// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { renovationEditor } from '../../../helpers/renovationEditor';
import { expectOk } from '../../../helpers/domain';
import { settle } from '../../../helpers/editor';
import { pointerAt } from '../../../helpers/tool-context';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); return rig; }

it.each(['body', 'corner', 'wall', 'group'] as const)('retires a Plan %s drag immediately on Renovate and cannot revive it on return', async kind => {
	const rig = await setup(), tool = rig.runtime.toolManager;
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	const history = [rig.runtime.canUndo.value, rig.runtime.canRedo.value];
	const camera = { ...useEditorStore(rig.pinia).viewport };
	rig.selection.select(kind === 'wall' ? ['wall-a' as never] : kind === 'group' ? [rig.room.id, 'wall-a' as never] : [rig.room.id]);
	const start = kind === 'wall' ? pointerAt(4000, 0) : kind === 'corner' ? pointerAt(4000, 3000) : pointerAt(2000, 1500);
	tool.pointerDown(start);
	tool.pointerMove(pointerAt(start.worldPoint.x + 400, start.worldPoint.y + 400));
	expect(tool.activeToolHasDraft()).toBe(true);
	const selection = [...rig.selection.selectedIds];
	await rig.runtime.renovation.perspective('renovate');
	expect(tool.activeToolId).toBe('select');
	expect(tool.gestureInFlight).toBe(false);
	expect(tool.activeToolHasDraft()).toBe(false);
	expect(tool.activeToolTracksPointer()).toBe(false);
	expect(rig.runtime.renderState.previewPolygon).toBeNull();
	expect(rig.runtime.renderState.snapGuides).toEqual([]);
	expect(rig.runtime.structureActions.preview.value).toBeNull();
	await rig.runtime.renovation.perspective('plan');
	tool.pointerUp(pointerAt(start.worldPoint.x + 800, start.worldPoint.y + 800));
	await settle();
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
	expect([rig.runtime.canUndo.value, rig.runtime.canRedo.value]).toEqual(history);
	expect(rig.dialogs.current).toBeNull();
	expect(rig.selection.selectedIds).toEqual(selection);
	expect(useEditorStore(rig.pinia).viewport).toEqual(camera);
});

it('preserves a selection marquee across the perspective change', async () => {
	const rig = await setup(), tool = rig.runtime.toolManager;
	const before = expectOk(await rig.geometry.read(rig.plan.id));
	tool.pointerDown(pointerAt(-1000, -1000));
	tool.pointerMove(pointerAt(5000, 4000));
	await rig.runtime.renovation.perspective('renovate');
	expect(tool.gestureInFlight).toBe(true);
	expect(tool.activeToolHasDraft()).toBe(true);
	tool.pointerUp(pointerAt(5000, 4000));
	await settle();
	expect(rig.selection.selectedIds).toContain(rig.room.id);
	expect(tool.activeToolHasDraft()).toBe(false);
	expect(expectOk(await rig.geometry.read(rig.plan.id))).toEqual(before);
});
