// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { err, ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
const fault = { category: 'Persistence' as const, code: 'spatial.write-failed', message: 'Disk unavailable' };
afterEach(() => { for (const value of mounted.splice(0)) value.unmount(); });
async function rig() {
	const value = await structureEditor(); mounted.push(value);
	const baseline = expectOk(await value.geometry.read(value.plan.id));
	const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0 }] };
	expectOk(await value.runtime.dispatcher.run(value.services.command({ planId: value.plan.id, baseline, structure, ledger: value.runtime.structureTask.ledger })));
	value.selection.select(['wall-a' as never]); await settle(); return value;
}
describe('wall/opening actions and impact forms', () => {
	it('keeps another opening unchanged and allows retry after an ordinary persistence refusal', async () => {
		const value = await rig();
		const before = expectOk(await value.geometry.read(value.plan.id));
		const structure = before.document.structure as typeof WALL_LOOP;
		const other = { ...structure.openings[0], id: 'opening-b', offset: 2500 };
		expectOk(await value.geometry.write(value.plan.id, { ...before.document, structure: { ...structure, openings: [...structure.openings, other] } }, before.version));
		await value.runtime.refreshProjection();
		const pending = value.runtime.structureActions.edit('opening-a'); await settle();
		await value.wrapper.find('.rp-dialog input[name="width"]').setValue('1.1');
		await value.wrapper.find('.rp-dialog form').trigger('submit');
		const run = vi.spyOn(value.runtime.dispatcher, 'run').mockResolvedValueOnce(err(fault));
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await settle();
		expect(value.wrapper.find('.rp-dialog button[type="submit"]').attributes('aria-disabled')).toBe('false');
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await pending;
		expect(run).toHaveBeenCalledTimes(2); expect(value.project.structure.openings[1]).toEqual(other);
		expect(value.project.structure.openings[0].width).toBe(1100);
	});
	it.each(['edit-read', 'delete-read', 'edit-write'] as const)('ignores a late rejected %s after leaf disposal', async kind => {
		const value = await rig();
		let rejectLate!: (cause: Error) => void;
		const deferred = () => new Promise<never>((resolve, reject) => { void resolve; rejectLate = reject; });
		if (kind === 'edit-write') {
			const pending = value.runtime.structureActions.edit('wall-a'); await settle();
			await value.wrapper.find('.rp-dialog input[name="length"]').setValue('5');
			await value.wrapper.find('.rp-dialog form').trigger('submit');
			vi.spyOn(value.runtime.dispatcher, 'run').mockImplementationOnce(deferred);
			await value.wrapper.find('.rp-dialog form').trigger('submit');
			value.unmount(); rejectLate(new Error('retired write')); await pending; await settle();
		} else {
			vi.spyOn(value.services, 'read').mockImplementationOnce(deferred);
			const pending = kind === 'edit-read' ? value.runtime.structureActions.edit('wall-a') : value.runtime.structureActions.remove('wall-a');
			value.unmount(); rejectLate(new Error('retired read')); await pending;
		}
		expect(value.runtime.structureActions.preview.value).toBeNull();
	});
	it('reports refused and thrown deletions, and does not open an action for an absent structure', async () => {
		const value = await rig(), actions = value.runtime.structureActions;
		const run = vi.spyOn(value.runtime.dispatcher, 'run').mockResolvedValueOnce(err(fault)).mockRejectedValueOnce(new Error('delete'));
		for (let i = 0; i < 2; i++) { const pending = actions.remove('wall-a'); await settle(); value.dialogs.resolve('confirm'); await pending; expect(value.project.structure.walls).toHaveLength(4); }
		expect(run).toHaveBeenCalledTimes(2);
		const before = expectOk(await value.geometry.read(value.plan.id));
		vi.spyOn(value.services, 'read').mockResolvedValue(ok({ ...before, document: { ...before.document, structure: undefined } }));
		await actions.edit('wall-a'); await actions.remove('wall-a'); expect(value.dialogs.current).toBeNull();
	});
	it('previews and applies an exact connected length, refuses containment and numeric errors, and preserves unchanged precision', async () => {
		const value = await rig(); const pending = value.runtime.structureActions.edit('wall-a');
		await settleUntil(() => value.wrapper.find('.rp-dialog form').exists(), 'wall form');
		await value.wrapper.find('.rp-dialog form').trigger('submit'); expect(value.runtime.structureActions.preview.value).toBeNull();
		await value.wrapper.find('.rp-dialog input[name="length"]').setValue('bad'); await value.wrapper.find('.rp-dialog form').trigger('submit');
		expect(value.wrapper.find('.rp-dialog [role="alert"]').exists()).toBe(true);
		await value.wrapper.find('.rp-dialog input[name="length"]').setValue('1'); await value.wrapper.find('.rp-dialog form').trigger('submit');
		expect(value.wrapper.find('.rp-dialog').text()).toContain('fit within');
		await value.wrapper.find('.rp-dialog input[name="length"]').setValue('5'); await value.wrapper.find('.rp-dialog form').trigger('submit');
		expect(value.runtime.structureActions.preview.value?.walls[1].start.x).toBe(5000);
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await pending;
		expect(value.project.structure.walls[0].end.x).toBe(5000); expect(value.project.structure.openings[0].offset).toBe(500);
		expect(value.runtime.structureActions.preview.value).toBeNull();
	});
	it('retains a failed form, suppresses busy native Enter, pauses on conflict, and cancels without a write', async () => {
		const value = await rig(); const pending = value.runtime.structureActions.edit('opening-a');
		await settleUntil(() => value.wrapper.find('.rp-dialog form').exists(), 'opening form');
		const width = value.wrapper.find('.rp-dialog input[name="width"]');
		for (const props of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
			const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...props }); width.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
		}
		await width.setValue('1.1'); await value.wrapper.find('.rp-dialog form').trigger('submit');
		const run = vi.spyOn(value.runtime.dispatcher, 'run').mockRejectedValueOnce(new Error('write'));
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await settle(); expect(value.wrapper.find('.rp-dialog [role="alert"]').exists()).toBe(true);
		run.mockResolvedValueOnce(err({ category: 'Validation', code: 'plan-geometry.external-modification', message: 'Peer change' }));
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await settle();
		expect(value.wrapper.find('.rp-dialog').text()).toContain('saved floor changed');
		await value.wrapper.find('.rp-dialog form').trigger('submit'); expect(run).toHaveBeenCalledTimes(2);
		value.dialogs.resolve('cancel'); await pending; expect(value.project.structure.openings[0].width).toBe(900);
	});
	it('pauses an impact form when shared history has been superseded', async () => {
		const value = await rig(); const pending = value.runtime.structureActions.edit('wall-a'); await settle();
		await value.wrapper.find('.rp-dialog input[name="length"]').setValue('5');
		await value.wrapper.find('.rp-dialog form').trigger('submit');
		const run = vi.spyOn(value.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ category: 'Validation', code: 'undo.superseded', message: 'Peer history' }));
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await settle();
		expect(value.wrapper.find('.rp-dialog button[type="submit"]').attributes('aria-disabled')).toBe('true');
		await value.wrapper.find('.rp-dialog form').trigger('submit'); expect(run).toHaveBeenCalledOnce();
		value.dialogs.resolve('cancel'); await pending;
	});
	it('prevents duplicate form submits and ignores dispatch success after the leaf is disposed', async () => {
		const value = await rig(); const pending = value.runtime.structureActions.edit('wall-a', { x: 5000, y: 0 });
		await settleUntil(() => value.wrapper.find('.rp-dialog form').exists(), 'drag impact form');
		expect(value.wrapper.find<HTMLInputElement>('.rp-dialog input[name="length"]').element.value).toBe('5');
		await value.wrapper.find('.rp-dialog form').trigger('submit');
		let release!: (result: DispatchResult) => void;
		const run = vi.spyOn(value.runtime.dispatcher, 'run').mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
		await value.wrapper.find('.rp-dialog form').trigger('submit'); await value.wrapper.find('.rp-dialog form').trigger('submit'); expect(run).toHaveBeenCalledOnce();
		value.unmount(); release(ok('wrote')); await pending; expect(value.runtime.structureActions.preview.value).toBeNull();
	});
	it('previews host deletion, cancels, then deletes its openings and undoes the entire relationship', async () => {
		const value = await rig();
		let pending = value.runtime.structureActions.remove('wall-a'); await settle();
		expect(value.dialogs.current).toMatchObject({ kind: 'confirm', message: expect.stringContaining('Openings removed: 1') });
		value.dialogs.resolve('cancel'); await pending; expect(value.project.structure.openings).toHaveLength(1);
		pending = value.runtime.structureActions.remove('wall-a'); await settle(); value.dialogs.resolve('confirm'); await pending;
		expect(value.project.structure.walls).toHaveLength(3); expect(value.project.structure.openings).toHaveLength(0); expect(value.selection.selectedIds).toEqual([]);
		await value.runtime.dispatcher.undo(); expect(value.project.structure.walls).toHaveLength(4); expect(value.project.structure.openings[0].hostId).toBe('wall-a');
	});
	it('guards unavailable, busy and stale actions, reports read failures and ignores late reads', async () => {
		const value = await rig(), actions = value.runtime.structureActions;
		value.project.stale = true; await actions.edit('wall-a'); await actions.remove('wall-a'); expect(value.dialogs.current).toBeNull(); value.project.stale = false;
		const save = useSaveStateStore(value.pinia); save.beginSaving(); await actions.edit('wall-a'); await actions.remove('wall-a'); save.resolveNeutral();
		const read = vi.spyOn(value.services, 'read');
		for (const action of [actions.edit, actions.remove]) {
			read.mockResolvedValueOnce(err(fault)); await action('wall-a'); expect(value.dialogs.current).toBeNull();
			read.mockRejectedValueOnce(new Error('read')); await action('wall-a'); expect(value.dialogs.current).toBeNull();
		}
		let release!: (response: Awaited<ReturnType<typeof value.services.read>>) => void;
		read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
		const pending = actions.edit('wall-a'); await actions.edit('wall-a'); await actions.remove('wall-a');
		value.selection.select(['wall-b' as never]); release(await value.geometry.read(value.plan.id)); await pending; expect(value.dialogs.current).toBeNull();
		read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
		const late = actions.remove('wall-a'); value.unmount(); release(err(fault)); await late; expect(value.dialogs.current).toBeNull();
	});
});
