// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { groupEditor } from '../../helpers/groupEditor';
import { expectDefined } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup() { const rig = await groupEditor(); mounted.push(rig); return rig; }
it.each(['group', 'wall'] as const)('blocks repeated shared %s rotation routes during a review and in Review perspective', async kind => {
	const rig = await setup();
	if (kind === 'wall') rig.selection.select([rig.project.structure.walls[0].id as never]);
	await settle(); const shape = expectDefined(rig.runtime.rotationActions.target.value, 'selected rotation shape');
	const points = expectDefined(rotationPoints(shape, 20, expectDefined(rotationPivot(shape), 'pivot')), 'pointer proposal');
	const bytes = [...rig.stack.vault.entries], opened = rig.runtime.rotationActions.rotate(shape.id, kind === 'wall' ? 90 : undefined);
	await settleUntil(() => rig.dialogs.current?.kind === 'form', 'rotation review');
	expect(rig.runtime.rotationActions.active.value).toBe(true);
	await rig.runtime.rotationActions.rotate(shape.id, 90); await rig.runtime.rotationActions.move(shape.id, points, shape);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.dialogs.resolve('cancel'); await opened;
	useRenovationSession(rig.pinia).perspective = 'review'; await settle();
	await rig.runtime.rotationActions.rotate(shape.id, 90); await rig.runtime.rotationActions.move(shape.id, points, shape);
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.runtime.rotationActions.active.value).toBe(false);
	rig.selection.clear(); await rig.runtime.rotationActions.rotate(shape.id, 90); expect([...rig.stack.vault.entries]).toEqual(bytes);
});
it('refuses a captured grouped numeric submission after its selection retires and explains the changed context', async () => {
	const rig = await setup(), shape = expectDefined(rig.runtime.groupActions.target.value, 'group');
	const opened = rig.runtime.groupActions.rotate(shape.id);
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'group form');
	const form = rig.wrapper.getComponent(ObjectRotationForm), dispatch = form.props('dispatch');
	const points = expectDefined(rotationPoints(form.props('element'), 25, form.props('pivot')), 'queued proposal'), bytes = [...rig.stack.vault.entries];
	rig.selection.clear(); expect((await dispatch(points)).ok).toBe(false); await settle();
	expect(form.text()).toContain('changed'); expect(form.get('input').element).toHaveProperty('readOnly', true);
	expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.runtime.groupActions.preview.value).toBeNull();
	rig.dialogs.resolve('cancel'); await opened;
});
it('discards a failed grouped baseline after close without a late error or write', async () => {
	const rig = await setup(), services = expectDefined(rig.deps.commands.groups, 'groups'), gate = defer<void>();
	vi.spyOn(services, 'read').mockImplementationOnce(async () => { await gate.promise; throw new Error('late grouped read'); });
	const log = vi.spyOn(rig.deps.commands.logger, 'error'), bytes = [...rig.stack.vault.entries];
	const moving = rig.runtime.groupActions.moveBy({ dx: 50, dy: 70 });
	rig.unmount(); mounted.splice(mounted.indexOf(rig), 1); gate.resolve(); await moving;
	expect(log).not.toHaveBeenCalled(); expect([...rig.stack.vault.entries]).toEqual(bytes); expect(rig.runtime.groupActions.active.value).toBe(false);
});
