// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';
import WallRotationForm from '../../../src/presentation/editor/structure/WallRotationForm.vue';
import { rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });

async function roomForm() {
	const rig = await renovationEditor(); mounted.push(rig); rig.changePlan(); rig.selection.select([rig.room.id]); await settle();
	const operation = rig.runtime.rotationActions.rotate(rig.room.id);
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'rotation form');
	const form = rig.wrapper.getComponent(ObjectRotationForm), props = form.props();
	await form.get('input').setValue('30');
	const points = expectDefined(rotationPoints(props.element, 30, props.pivot), 'rotated Room');
	return { rig, operation, form, props, points };
}

it.each(['selection', 'tool', 'perspective'] as const)('immediately freezes the numeric rotation draft when its %s retires', async change => {
	const { rig, operation, form, props, points } = await roomForm(), write = vi.spyOn(rig.geometry, 'write');
	if (change === 'selection') { rig.selection.clear(); rig.selection.select([rig.room.id]); }
	else if (change === 'tool') { rig.runtime.setTool(null); rig.runtime.setTool('select'); }
	else rig.session.perspective = 'renovate';
	await settle();
	expect(form.get('input').element).toHaveProperty('readOnly', true);
	expect(form.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
	await form.get('input').setValue('45'); expect(form.get('input').element).toHaveProperty('value', '30');
	props.preview(points); expect(rig.runtime.rotationActions.preview.value).toBeNull();
	expect((await props.dispatch(points)).ok).toBe(false); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});

it('retires queued numeric callbacks on cancel even if the selection and tool stay unchanged', async () => {
	const { rig, operation, props, points } = await roomForm(), write = vi.spyOn(rig.geometry, 'write');
	rig.dialogs.resolve('cancel'); await operation;
	props.preview(points); expect(rig.runtime.rotationActions.preview.value).toBeNull();
	expect((await props.dispatch(points)).ok).toBe(false); expect(write).not.toHaveBeenCalled();
});

it('ignores a cancelled numeric preview callback after a new rotation form owns the preview', async () => {
	const { rig, operation, props } = await roomForm();
	rig.dialogs.resolve('cancel'); await operation;
	const next = rig.runtime.rotationActions.rotate(rig.room.id);
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'next rotation form');
	await rig.wrapper.getComponent(ObjectRotationForm).get('input').setValue('45');
	const preview = expectDefined(rig.runtime.rotationActions.preview.value, 'new preview');
	props.preview(null); expect(rig.runtime.rotationActions.preview.value).toEqual(preview);
	rig.dialogs.resolve('cancel'); await next;
});

it.each(['selection', 'cancel', 'dispose', 'peer'] as const)('retires wall impact-review callbacks on %s', async change => {
	const rig = await structureEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: WALL_LOOP }, baseline.version));
	await rig.runtime.refreshProjection(); rig.selection.select(['wall-a' as never]); await settle();
	const operation = rig.runtime.structureActions.rotateWall('wall-a', 30);
	await settleUntil(() => rig.wrapper.findComponent(WallRotationForm).exists(), 'wall review');
	const form = rig.wrapper.getComponent(WallRotationForm), props = form.props(), preview = expectDefined(rig.runtime.structureActions.preview.value, 'wall preview');
	if (change === 'selection') { rig.selection.clear(); rig.selection.select(['wall-a' as never]); }
	else if (change === 'cancel') { rig.dialogs.resolve('cancel'); await operation; }
	else if (change === 'dispose') { rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); }
	else { rig.project.structure = { ...WALL_LOOP, walls: WALL_LOOP.walls.map(wall => ({ ...wall, height: 2800 })) }; }
	await settle();
	expect(props.retired.value).toBe(true); expect(props.blocked.value).toBe(true);
	const write = vi.spyOn(rig.geometry, 'write'); props.preview(preview);
	expect(rig.runtime.structureActions.preview.value).toBeNull(); expect((await props.dispatch(preview)).ok).toBe(false); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});
