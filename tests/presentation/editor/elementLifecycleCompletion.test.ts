// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { resizeTo } from '../../helpers/layout';
import { defer } from '../../helpers/async';
import { expectErr, expectOk } from '../../helpers/domain';
import type { EntityId } from '../../../src/core/identity/EntityId';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import OutlinePointsForm from '../../../src/presentation/editor/resize/OutlinePointsForm.vue';
import * as notices from '../../../src/presentation/notices/notify';

const path: NamedSpatialElement = { id: 'element-lifecycle-path', kind: 'path', name: 'Garden path', points: [{ x: 500, y: 500 }, { x: 3000, y: 500 }] };
const object: NamedSpatialElement = { id: 'element-lifecycle-object', kind: 'object', name: 'Cabinet', points: [{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 1500 }, { x: 500, y: 1500 }] };
const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); vi.restoreAllMocks(); });
async function setup(element: NamedSpatialElement = path) {
	const rig = await renovationEditor(true); mounted.push(rig);
	rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	rig.selection.select([element.id as EntityId<string>]); await settle();
	return rig;
}
function close(rig: Awaited<ReturnType<typeof setup>>): void {
	mounted.splice(mounted.indexOf(rig), 1); rig.unmount();
}

describe('element editing finishes safely after source and leaf changes', () => {
	it('returns focus to Details after a peer deletes the edited path and the user cancels', async () => {
		const rig = await setup();
		resizeTo(rig.rootEl, 800, 800); await settle();
		const details = rig.wrapper.get<HTMLButtonElement>('[data-rp-rail="details"]');
		details.element.click(); await settle();
		const opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="edit-element"]').element;
		opener.focus(); opener.click(); await settle();
		expect(rig.wrapper.findComponent(OutlinePointsForm).exists()).toBe(true);
		// A sibling writer uses its own history, then the normal projection refresh arrives.
		const baseline = expectOk(await rig.renovation.read(rig.plan.id));
		expectOk(await rig.renovation.command(baseline, elementInput(baseline, path, true), new SessionWriteLedger()).execute());
		const bytes = [...rig.stack.vault.entries];
		await rig.runtime.refreshProjection(); await settle();
		expect(rig.project.structure.elements ?? []).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: path.id })]));
		expect(rig.selection.selectedIds).not.toContain(path.id); expect(opener.isConnected).toBe(false);
		expect(rig.wrapper.findComponent(OutlinePointsForm).exists()).toBe(true);
		const run = vi.spyOn(rig.runtime.dispatcher, 'run');
		rig.wrapper.get<HTMLButtonElement>('[data-rp-action="cancel"]').element.click();
		await settleUntil(() => rig.dialogs.current === null && !rig.runtime.elementActions.active.value, 'retired source edit cancelled');
		await settle();
		expect(document.activeElement).toBe(details.element); expect(details.element.isConnected).toBe(true);
		expect(rig.runtime.elementActions.preview.value).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('retains a zero-area Object edit, then saves corrected corners and restores the original through Undo', async () => {
		const rig = await setup(object), before = expectOk(await rig.renovation.read(rig.plan.id));
		await rig.wrapper.get('[data-rp-action="edit-element"]').trigger('click'); await settle();
		const form = rig.wrapper.get('[data-rp-form="outline-points"]');
		await form.get('[name="2.x"]').setValue('3.5'); await form.get('[name="3.x"]').setValue('4.5');
		await form.get('[name="2.y"]').setValue('0.5'); await form.get('[name="3.y"]').setValue('0.5');
		const run = vi.spyOn(rig.runtime.dispatcher, 'run'), bytes = [...rig.stack.vault.entries];
		await form.trigger('submit'); await settle();
		expect(form.find('[role="alert"]').exists()).toBe(true);
		expect(form.get<HTMLInputElement>('[name="3.x"]').element.value).toBe('4.5');
		expect(rig.runtime.elementActions.preview.value).toBeNull(); expect(run).not.toHaveBeenCalled();
		expect([...rig.stack.vault.entries]).toEqual(bytes);
		await form.get('[name="2.x"]').setValue('2.5'); await form.get('[name="3.x"]').setValue('0.5');
		await form.get('[name="2.y"]').setValue('2'); await form.get('[name="3.y"]').setValue('2');
		expect(form.find('[role="alert"]').exists()).toBe(false);
		await form.trigger('submit'); await settleUntil(() => rig.dialogs.current === null, 'corrected Object saved');
		expect(run).toHaveBeenCalledOnce();
		const saved = expectOk(await rig.renovation.read(rig.plan.id));
		expect(saved.geometry.document.structure?.elements?.find(item => item.id === object.id)?.points).toEqual([
			{ x: 500, y: 500 }, { x: 2500, y: 500 }, { x: 2500, y: 2000 }, { x: 500, y: 2000 },
		]);
		expectOk(await rig.runtime.dispatcher.undo()); await settle();
		const restored = expectOk(await rig.renovation.read(rig.plan.id));
		expect(restored.geometry.document).toEqual(before.geometry.document);
		expect(restored.plan.entity.spatialElements).toEqual(before.plan.entity.spatialElements);
	});
	it('refuses a captured outline dispatch after disposal without writing or restoring the preview', async () => {
		const rig = await setup(), editing = rig.runtime.elementActions.edit(path.id); await settle();
		const form = rig.wrapper.getComponent(OutlinePointsForm), dispatch = form.props('dispatch');
		expect(rig.runtime.elementActions.preview.value?.id).toBe(path.id);
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		close(rig); await editing;
		const result = await dispatch({ points: path.points.map(point => ({ ...point, x: point.x + 100 })) }, 'Retired path');
		expect(expectErr(result).code).toBe('editor.stale-write-refused');
		expect(run).not.toHaveBeenCalled(); expect(rig.runtime.elementActions.preview.value).toBeNull();
		expect(rig.dialogs.current).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
	it('does not announce a rejected initial edit read after the leaf closes', async () => {
		const rig = await setup(), release = defer<void>();
		const report = vi.spyOn(notices, 'notifyFault').mockImplementation(() => undefined);
		const refusal = vi.spyOn(notices, 'notifyOperationFailure').mockImplementation(() => undefined);
		const read = vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(release.promise.then(() => { throw new Error('Retired element edit read'); }));
		const bytes = [...rig.stack.vault.entries], run = vi.spyOn(rig.runtime.dispatcher, 'run');
		const editing = rig.runtime.elementActions.edit(path.id); await settle(); expect(read).toHaveBeenCalledOnce();
		close(rig); release.resolve(); await editing; await settle();
		expect(report).not.toHaveBeenCalled(); expect(refusal).not.toHaveBeenCalled(); expect(run).not.toHaveBeenCalled();
		expect(rig.dialogs.current).toBeNull(); expect(rig.runtime.elementActions.active.value).toBe(false);
		expect(rig.runtime.elementActions.preview.value).toBeNull(); expect([...rig.stack.vault.entries]).toEqual(bytes);
	});
});
