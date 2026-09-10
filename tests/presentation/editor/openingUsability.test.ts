// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { pointerAt } from '../../helpers/tool-context';
import type { Opening } from '../../../src/domain/spatial/Structure';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';

const door: Opening = { id: 'opening-door', kind: 'door', hostId: 'wall-a', offset: 800, width: 900, height: 2100, sill: 0 };
const rigs: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of rigs.splice(0)) rig.unmount(); });
async function setup(openings: readonly Opening[] = []) {
	const rig = await structureEditor(); rigs.push(rig);
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...WALL_LOOP, openings } }, read.version));
	await rig.runtime.refreshProjection();
	return rig;
}

it.each(['door', 'window', 'opening'] as const)('places one %s centred at the clicked wall position through the normal history path', async kind => {
	const rig = await setup(), task = rig.runtime.structureTask;
	rig.runtime.setTool(`place-${kind}`); await settleUntil(() => !task.draft.loading, 'opening task baseline');
	const write = vi.spyOn(rig.geometry, 'write');
	rig.runtime.toolManager.pointerMove(pointerAt(2000, 0));
	expect(task.draft.text.offset).toBe('1.55');
	expect(write).not.toHaveBeenCalled();
	rig.runtime.toolManager.pointerDown(pointerAt(2000, 0));
	rig.runtime.toolManager.pointerUp(pointerAt(2000, 0));
	await settleUntil(() => rig.project.structure.openings.length === 1, 'clicked opening saved');
	const opening = rig.project.structure.openings[0];
	expect(opening).toMatchObject({ kind, hostId: 'wall-a', offset: 1550, width: 900 });
	expect(opening.swing?.angle).toBe(kind === 'door' ? 90 : kind === 'window' ? 0 : undefined);
	expect(write).toHaveBeenCalledTimes(1);
	expect(rig.runtime.activeToolId.value).toBe('select');
	expect(rig.selection.selectedIds).toEqual([opening.id]);
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([]);
	await rig.runtime.redo(); expect(rig.project.structure.openings).toEqual([opening]);
});

it('reviews move-to-point and swing changes together, preserves hosting and reverses the exact legacy opening', async () => {
	const rig = await setup([door]); rig.selection.select([door.id as never]); await settle();
	const before = [...rig.stack.vault.entries];
	const operation = rig.runtime.structureActions.moveOpeningToPoint(door.id, { x: 3000, y: 15 });
	await settleUntil(() => rig.wrapper.find('.rp-dialog form').exists(), 'opening move review');
	const form = rig.wrapper.get('.rp-dialog form');
	expect(form.get('[name="offset"]').element).toHaveProperty('value', '2.55');
	await form.get('[name="opening-hinge"]').setValue('end');
	await form.get('[name="opening-side"]').setValue('right');
	await form.get('[name="opening-angle"]').setValue('45,5');
	await form.trigger('submit');
	expect([...rig.stack.vault.entries]).toEqual(before);
	expect(rig.runtime.structureActions.preview.value?.openings[0]).toMatchObject({ offset: 2550, swing: { hinge: 'end', side: 'right', angle: 45.5 } });
	await form.trigger('submit'); await operation;
	const changed = { ...door, offset: 2550, swing: { hinge: 'end', side: 'right', angle: 45.5 } };
	expect(rig.project.structure.openings).toEqual([changed]);
	expect(rig.selection.selectedIds).toEqual([door.id]);
	await rig.runtime.undo(); expect(rig.project.structure.openings).toEqual([door]);
	await rig.runtime.redo(); expect(rig.project.structure.openings).toEqual([changed]);
});

it('refuses invalid swing, keeps cancellation write-free and rejects peer changes before Apply', async () => {
	const rig = await setup([door]); rig.selection.select([door.id as never]); await settle();
	let operation = rig.runtime.structureActions.moveOpeningToPoint(door.id, { x: 3999, y: 0 });
	await settleUntil(() => rig.wrapper.find('.rp-dialog form').exists(), 'opening move form');
	let form = rig.wrapper.get('.rp-dialog form');
	await form.get('[name="opening-angle"]').setValue('181'); await form.trigger('submit');
	expect(document.activeElement).toBe(form.get('[name="opening-angle"]').element);
	expect(rig.project.structure.openings).toEqual([door]);
	rig.dialogs.resolve('cancel'); await operation;
	expect(rig.runtime.canUndo.value).toBe(false);
	operation = rig.runtime.structureActions.moveOpeningToPoint(door.id, { x: 3000, y: 0 });
	await settleUntil(() => rig.wrapper.find('.rp-dialog form').exists(), 'second opening move form');
	form = rig.wrapper.get('.rp-dialog form'); await form.trigger('submit');
	const read = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...WALL_LOOP, openings: [{ ...door, offset: 1000 }] } }, read.version));
	const write = vi.spyOn(rig.geometry, 'write');
	await form.trigger('submit'); await settle();
	expect(write).not.toHaveBeenCalled();
	expect(form.text()).toContain('changed');
	rig.dialogs.resolve('cancel'); await operation;
	useRenovationSession(rig.pinia).perspective = 'review';
	await rig.runtime.structureActions.moveOpeningToPoint(door.id, { x: 2500, y: 0 });
	expect(rig.dialogs.current).toBeNull();
});

it('ignores a move to a non-finite point without opening a review dialog', async () => {
	const rig = await setup([door]); rig.selection.select([door.id as never]); await settle();
	await rig.runtime.structureActions.moveOpeningToPoint(door.id, { x: Number.NaN, y: 0 });
	expect(rig.dialogs.current).toBeNull();
	expect(rig.project.structure.openings).toEqual([door]);
});
