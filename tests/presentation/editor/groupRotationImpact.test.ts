// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

it('reviews live connected-wall impact in the numeric form, cancels without writing and applies the reviewed preview once', async () => {
	const rig = await groupEditor(); mounted.push(rig);
	const before = expectOk(await rig.geometry.read(rig.plan.id)).document;
	const selectedWall = rig.project.structure.walls[0];
	rig.selection.select([rig.room.id, selectedWall.id as never]); await settle();
	const write = vi.spyOn(rig.geometry, 'write');
	await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'partial group rotation form');
	let form = rig.wrapper.get('[data-rp-form="object-rotation"]');
	expect(rig.wrapper.find('[data-rp-group-rotation-impact]').exists()).toBe(false);
	await form.get('input').setValue('5');
	const impact = rig.wrapper.get('[data-rp-group-rotation-impact]');
	expect(impact.attributes('role')).toBe('status');
	expect(impact.text()).toContain('shared endpoints of 2 walls outside the selection');
	expect(impact.text()).toContain('Apply the preview?');
	expect(rig.wrapper.findAll('.rp-dialog')).toHaveLength(1);
	for (const angle of ['bad', '0']) {
		await form.get('input').setValue(angle);
		expect(rig.wrapper.find('[data-rp-group-rotation-impact]').exists()).toBe(false);
	}
	await form.get('input').setValue('-5');
	expect(rig.wrapper.get('[data-rp-group-rotation-impact]').text()).toContain('2 walls outside the selection');
	await form.get('input').trigger('keydown', { key: 'Escape' });
	await settleUntil(() => !rig.runtime.groupActions.active.value, 'cancelled rotation');
	expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.groupActions.preview.value).toBeNull();
	expect(write).not.toHaveBeenCalled(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	await rig.wrapper.get('[data-rp-group-transform="rotate"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="object-rotation"]').exists(), 'reopened rotation form');
	form = rig.wrapper.get('[data-rp-form="object-rotation"]'); await form.get('input').setValue('5');
	expect(rig.wrapper.get('[data-rp-group-rotation-impact]').text()).toContain('2 walls outside the selection');
	const preview = expectDefined(rig.runtime.groupActions.preview.value, 'reviewed preview');
	expect(write).not.toHaveBeenCalled();
	await form.get('button[type="submit"]').trigger('click');
	await settleUntil(() => !rig.runtime.groupActions.active.value, 'confirmed rotation');
	expect(rig.dialogs.current).toBeNull(); expect(write).toHaveBeenCalledTimes(1);
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(saved.structure?.walls).toEqual(preview.structure?.walls);
	const savedRoom = expectDefined(saved.objects.find(object => object.id === rig.room.id), 'saved Room');
	expect(savedRoom.points).toEqual(expectDefined(preview.objects.find(object => object.id === rig.room.id), 'preview Room').points);
	expect(savedRoom.points).not.toEqual(rig.room.geometry.points);
	expect(saved.groups).toEqual(before.groups);
	const walls = expectDefined(before.structure, 'original walls').walls;
	const changedOutside = saved.structure?.walls.filter(wall => wall.id !== selectedWall.id
		&& JSON.stringify(wall) !== JSON.stringify(walls.find(original => original.id === wall.id)));
	expect(changedOutside).toHaveLength(2);
	await rig.runtime.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
});
