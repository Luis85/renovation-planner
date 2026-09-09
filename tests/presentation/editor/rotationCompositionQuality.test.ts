// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, ref } from 'vue';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, injectedPersistenceError } from '../../helpers/domain';
import { createRotationActions, type RotationRuntime } from '../../../src/presentation/editor/elements/rotationActions';
import { PLAN_EDITOR_CONTEXT, type PlanEditorContext } from '../../../src/presentation/editor/PlanEditorContext';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { rotationPivot, rotationPoints } from '../../../src/presentation/editor/elements/objectRotation';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { screenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import ObjectRotationForm from '../../../src/presentation/editor/elements/ObjectRotationForm.vue';
import { err } from '../../../src/core/result/Result';
import { defer } from '../../helpers/async';
import * as notices from '../../../src/presentation/notices/notify';

const mounted: { unmount(): void }[] = [];
afterEach(() => { for (const item of mounted.splice(0).toReversed()) item.unmount(); vi.restoreAllMocks(); });
async function setup(overrides: Partial<RotationRuntime> = {}) {
	const rig = await renovationEditor(); mounted.push(rig); rig.selection.select([rig.room.id]); await settle();
	const context = rig.wrapper.vm.$.appContext.provides[PLAN_EDITOR_CONTEXT as symbol] as PlanEditorContext;
	let actions!: ReturnType<typeof createRotationActions>;
	const module = mount(defineComponent({ setup() {
		actions = createRotationActions(context, { ...rig.runtime, ledger: new SessionWriteLedger(), elementActions: { active: ref(false) }, ...overrides });
		return () => null;
	} }), { global: { plugins: [rig.pinia] } }); mounted.push(module);
	return { rig, module, actions, context };
}
it('supports free rotation without wall/group modules and safely ignores stale hover IDs and multiple selection', async () => {
	const { rig, actions } = await setup(), editor = useEditorStore(rig.pinia);
	expect(actions.active.value).toBe(false); expect(actions.target.value?.id).toBe(rig.room.id);
	editor.setPointer(screenPoint(200, 100)); rig.runtime.renderState.rotationHoverId = 'missing';
	expect(actions.displayTarget.value).toBeNull(); expect(actions.displayControls.value).toEqual([]);
	rig.selection.select([rig.room.id, 'missing' as never]); rig.runtime.renderState.rotationHoverId = rig.room.id;
	expect(actions.target.value).toBeNull(); expect(actions.displayTarget.value).toBeNull(); expect(actions.canRotateId()).toBe(false);
	const write = vi.spyOn(rig.geometry, 'write'); await actions.rotate('missing'); expect(write).not.toHaveBeenCalled();
});
it('accepts an optional group lookup that has no current group without inventing a target', async () => {
	const { rig, actions } = await setup({ groupRotationTarget: () => null });
	rig.selection.select([rig.room.id, 'missing' as never]);
	useEditorStore(rig.pinia).setPointer(screenPoint(200, 100)); rig.runtime.renderState.rotationHoverId = rig.room.id;
	expect(actions.target.value).toBeNull(); expect(actions.displayTarget.value).toBeNull(); expect(actions.active.value).toBe(false);
});
it('reports a refused pointer rotation and releases its operation without a write', async () => {
	const { rig, actions } = await setup(), original = expectDefined(actions.target.value, 'Room target');
	const points = expectDefined(rotationPoints(original, 30, expectDefined(rotationPivot(original), 'pivot')), 'proposal');
	const write = vi.spyOn(rig.geometry, 'write'), notify = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
	vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err(injectedPersistenceError()));
	await actions.move(original.id, points, original);
	expect(notify).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled(); expect(actions.active.value).toBe(false); expect(actions.preview.value).toBeNull();
});
it('silences a baseline failure that arrives after the rotation module is disposed', async () => {
	const { rig, module, actions } = await setup(), pending = defer<void>(), notify = vi.spyOn(notices, 'notifyFault');
	vi.spyOn(rig.deps.commands.zones, 'getById').mockImplementationOnce(async () => { await pending.promise; throw new Error('Late read'); });
	const operation = actions.rotate(rig.room.id); module.unmount(); mounted.pop(); pending.resolve(); await operation;
	expect(notify).not.toHaveBeenCalled(); expect(actions.active.value).toBe(false); expect(rig.dialogs.current).toBeNull();
});
it('keeps captured rotation retries read-only even after the optional module is disposed', async () => {
	const { rig, module, actions } = await setup(), operation = actions.rotate(rig.room.id);
	await settleUntil(() => rig.wrapper.findComponent(ObjectRotationForm).exists(), 'rotation form');
	const props = rig.wrapper.getComponent(ObjectRotationForm).props();
	const read = vi.spyOn(rig.deps.queries, 'getPlan'), write = vi.spyOn(rig.geometry, 'write');
	await props.retry(); expect(read).toHaveBeenCalled(); expect(write).not.toHaveBeenCalled();
	read.mockClear(); module.unmount(); mounted.pop(); await props.retry(); expect(read).toHaveBeenCalledOnce(); expect(write).not.toHaveBeenCalled();
	rig.dialogs.resolve('cancel'); await operation;
});
