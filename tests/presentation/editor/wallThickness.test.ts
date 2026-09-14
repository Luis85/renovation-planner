// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { structureEditor } from '../../helpers/structureEditor';
import { expectOk } from '../../helpers/domain';
import { WALL_LOOP } from '../../helpers/structure';
import { settle, settleUntil } from '../../helpers/editor';
import { useRenovationSession } from '../../../src/presentation/editor/renovation/renovationSession';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import { err, ok } from '../../../src/core/result/Result';
import type { DispatchResult } from '../../../src/application/commands/DispatchOutcome';
import CanvasMenuList from '../../../src/presentation/editor/selection/CanvasMenuList.vue';
import { isSubmenu } from '../../../src/presentation/editor/selection/useCanvasMenuActions';

const mounted: Awaited<ReturnType<typeof structureEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
async function setup() {
	const rig = await structureEditor(); mounted.push(rig);
	const baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...WALL_LOOP, openings: [{ id: 'opening-a', kind: 'door' as const, hostId: 'wall-a', offset: 500, width: 900, height: 2000, sill: 0 }] };
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.runtime.structureTask.ledger })));
	rig.selection.select(['wall-a' as never]); await settle();
	return { ...rig, control: rig.runtime.structureActions.thickness, session: useRenovationSession(rig.pinia), editor: useEditorStore(rig.pinia) };
}

it('previews direct millimetre entry, commits once, undoes, redoes and reads the saved structure', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id)).document, camera = { ...rig.editor.viewport };
	await rig.control.begin('wall-a'); rig.control.update('0,237');
	expect(rig.runtime.structureActions.preview.value?.walls[0].thickness).toBe(237);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	await rig.control.apply(); expect(rig.control.target.value).toBeNull();
	const after = { ...before, structure: { ...before.structure, walls: [{ ...before.structure?.walls[0], thickness: 237 }, ...WALL_LOOP.walls.slice(1)] } };
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(after);
	await rig.runtime.dispatcher.undo(); expect(expectOk(await rig.geometry.read(rig.plan.id)).document).toEqual(before);
	await rig.runtime.dispatcher.redo(); await rig.runtime.refreshProjection(); expect(rig.project.structure).toEqual(after.structure);
	expect(rig.selection.selectedIds).toEqual(['wall-a']); expect(rig.editor.viewport).toEqual(camera);
});

it('clamps step previews, rejects invalid input and cancels without a write', async () => {
	const rig = await setup(), run = vi.spyOn(rig.runtime.dispatcher, 'run');
	await rig.control.begin('wall-a', 'adjust');
	rig.control.increment(1); expect(rig.control.value.value).toBe(160);
	rig.control.increment(-1); expect(rig.control.value.value).toBe(150);
	for (const text of ['bad', '', '0', '-1', '1000.001']) {
		rig.control.update(text); rig.control.increment(1); await rig.control.apply(); expect(rig.control.proposal.value).toBeNull();
	}
	rig.control.update('0.001'); rig.control.increment(-1); expect(rig.control.value.value).toBe(1);
	rig.control.update('1000'); rig.control.increment(1); expect(rig.control.value.value).toBe(1_000_000);
	rig.control.close(); await rig.control.apply(); rig.control.update('0.2'); expect(run).not.toHaveBeenCalled();
	expect(rig.runtime.structureActions.preview.value).toBeNull();
});

it('retires mode, selection and tool changes synchronously, including retained callbacks', async () => {
	const rig = await setup(), run = vi.spyOn(rig.runtime.dispatcher, 'run');
	for (const mode of ['renovate', 'review'] as const) {
		await rig.control.begin('wall-a', 'adjust'); rig.control.increment(1);
		const retained = rig.control.apply;
		rig.session.perspective = mode; expect(rig.control.target.value).toBeNull();
		await rig.control.begin('wall-a'); rig.control.increment(1); await retained();
		rig.session.perspective = 'plan'; await retained(); expect(run).not.toHaveBeenCalled();
	}
	await rig.control.begin('wall-a'); rig.selection.select(['wall-b' as never]); expect(rig.control.target.value).toBeNull();
	await rig.control.begin('wall-a'); expect(rig.control.target.value).toBeNull();
	rig.selection.select(['wall-a' as never]); await rig.control.begin('wall-a'); rig.editor.activeToolId = 'pan'; expect(rig.control.target.value).toBeNull();
	await rig.control.begin('wall-a'); expect(rig.control.target.value).toBeNull();
});

it('refuses stale and saving entry, discards delayed reads on mode round trips and disposal', async () => {
	const rig = await setup(), read = vi.spyOn(rig.services, 'read');
	rig.project.stale = true; await rig.control.begin('wall-a'); expect(read).not.toHaveBeenCalled(); rig.project.stale = false;
	const saves = useSaveStateStore(rig.pinia); saves.beginSaving(); await rig.control.begin('wall-a'); expect(read).not.toHaveBeenCalled(); saves.resolveNeutral();
	let release!: (result: Awaited<ReturnType<typeof rig.services.read>>) => void;
	read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
	const pending = rig.control.begin('wall-a'); await rig.control.begin('wall-a'); rig.control.update('0.2');
	rig.session.perspective = 'review'; rig.session.perspective = 'plan'; release(await rig.geometry.read(rig.plan.id)); await pending; expect(rig.control.target.value).toBeNull();
	read.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
	const late = rig.control.begin('wall-a'); rig.unmount(); release(await rig.geometry.read(rig.plan.id)); await late; await rig.control.begin('wall-a'); expect(rig.control.target.value).toBeNull();
});

it('keeps ordinary refused writes retryable and refuses duplicate or busy updates', async () => {
	const rig = await setup(); await rig.control.begin('wall-a'); rig.control.update('0.2');
	const run = vi.spyOn(rig.runtime.dispatcher, 'run').mockResolvedValueOnce(err({ category: 'Persistence', code: 'spatial.write-failed', message: 'Disk failed' }));
	await rig.control.apply(); expect(rig.control.error.value).not.toBeNull(); expect(rig.control.paused.value).toBe(false);
	let release!: (result: DispatchResult) => void;
	run.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
	const saving = rig.control.apply(); rig.control.update('0.3'); await rig.control.apply(); expect(rig.control.text.value).toBe('0.2'); expect(run).toHaveBeenCalledTimes(2);
	release(ok('wrote')); await saving; expect(rig.control.target.value).toBeNull();
});

it('locks a conflicting preview and catches read/write faults', async () => {
	const rig = await setup(), read = vi.spyOn(rig.services, 'read');
	read.mockRejectedValueOnce(new Error('read')); await rig.control.begin('wall-a'); expect(rig.control.target.value).toBeNull();
	read.mockResolvedValueOnce(err({ category: 'Persistence', code: 'spatial.write-failed', message: 'Read failed' })); await rig.control.begin('wall-a'); expect(rig.control.target.value).toBeNull();
	await rig.control.begin('wall-a'); rig.control.update('0.2');
	const run = vi.spyOn(rig.runtime.dispatcher, 'run').mockRejectedValueOnce(new Error('write')); await rig.control.apply(); expect(rig.control.target.value).toBe('wall-a');
	run.mockResolvedValueOnce(err({ category: 'Validation', code: 'plan-geometry.external-modification', message: 'Changed' })); await rig.control.apply(); expect(rig.control.paused.value).toBe(true);
	await rig.control.apply(); expect(run).toHaveBeenCalledTimes(2);
});

it('offers keyboard focus, live feedback and Escape from the Details thickness route', async () => {
	const rig = await setup(), opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="wall-thickness"]');
	opener.element.focus(); await opener.trigger('click'); await settle();
	const input = rig.wrapper.get<HTMLInputElement>('[name="wall-thickness"]'); expect(document.activeElement).toBe(input.element);
	await input.setValue('0.183'); expect(rig.wrapper.get('.rp-wall-thickness-panel [role="status"]').text()).toContain('0.183');
	await input.trigger('keydown', { key: 'Escape' }); await settle(); expect(rig.wrapper.find('.rp-wall-thickness-panel').exists()).toBe(false); expect(document.activeElement).toBe(opener.element);
	expect(rig.project.structure.walls[0].thickness).toBe(150);
});

it('keeps entered thickness visible while numeric wall drawing focuses the next length', async () => {
	const rig = await setup(); rig.runtime.setTool('draw-wall');
	await settleUntil(() => !rig.runtime.structureTask.draft.loading, 'wall drawing ready');
	const form = rig.wrapper.get('.rp-structure-task');
	await form.get('.rp-wall-thickness-presets button:last-child').trigger('click');
	expect(form.get<HTMLInputElement>('[name="thickness"]').element.value).toBe('0.2');
	await form.trigger('submit'); await settle();
	expect(document.activeElement).toBe(form.get('[name="length"]').element);
	await form.get('[name="length"]').setValue('2'); await form.trigger('submit'); await settle();
	expect(document.activeElement).toBe(form.get('[name="length"]').element);
	expect(rig.runtime.structureTask.draft.text.thickness).toBe('0.2');
});

it('steps an existing fractional millimetre thickness without quantizing it', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...rig.project.structure, walls: rig.project.structure.walls.map(wall => wall.id === 'wall-a' ? { ...wall, thickness: 150.25 } : wall) };
	expectOk(await rig.runtime.dispatcher.run(rig.services.command({ planId: rig.plan.id, baseline, structure, ledger: rig.runtime.structureTask.ledger })));
	await rig.control.begin('wall-a', 'adjust'); await rig.control.apply(); expect(rig.control.value.value).toBe(150.25);
	rig.control.increment(1); expect(rig.control.value.value).toBe(160.25); await rig.control.apply();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.walls[0].thickness).toBe(160.25);
});

it('exposes Plan-only menu entry and rejects both captured menu callbacks in later perspectives', async () => {
	const rig = await setup();
	for (const mode of ['renovate', 'review'] as const) {
		rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
		const actions = rig.wrapper.getComponent(CanvasMenuList).props('items').filter(item => !isSubmenu(item) && ['wall-thickness', 'adjust-thickness'].includes(item.id));
		expect(actions).toHaveLength(2); rig.session.perspective = mode; await settle();
		for (const item of actions) if (!isSubmenu(item)) await item.run();
		expect(rig.control.target.value).toBeNull();
		const entry = rig.wrapper.find('[data-rp-context-action="wall-thickness"]');
		expect(mode === 'renovate' ? entry.attributes('aria-disabled') : entry.exists()).toBe(mode === 'renovate' ? 'true' : false);
		await rig.wrapper.getComponent(CanvasMenuList).trigger('keydown', { key: 'Escape' }); rig.session.perspective = 'plan'; await settle();
	}
});

it('validates the direct form, keeps modified Enter local, and saves only a valid Apply', async () => {
	const rig = await setup(); await rig.control.begin('wall-a'); await settle();
	const form = rig.wrapper.get('.rp-wall-thickness-panel'), input = form.get<HTMLInputElement>('input');
	await input.setValue('not a length'); await form.trigger('submit');
	expect(input.attributes('aria-invalid')).toBe('true'); expect(form.get('[role="alert"]').text()).toContain('0.001');
	expect(document.activeElement).toBe(input.element);
	for (const props of [{ repeat: true }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true }]) {
		const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...props }); input.element.dispatchEvent(event); expect(event.defaultPrevented).toBe(true);
	}
	await input.setValue('0,222'); await form.trigger('submit'); await settleUntil(() => rig.control.target.value === null, 'thickness saved');
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.walls[0].thickness).toBe(222);
});

it('refuses a real pending command when Plan retires before its version read completes', async () => {
	const rig = await setup(); await rig.control.begin('wall-a', 'adjust'); rig.control.update('0.2');
	const originalRead = rig.geometry.read.bind(rig.geometry);
	let release: (() => void) | undefined;
	vi.spyOn(rig.geometry, 'read').mockImplementationOnce(async id => { await new Promise<void>(resolve => { release = resolve; }); return originalRead(id); });
	const pending = rig.control.apply(); await settleUntil(() => release !== undefined, 'command version read');
	const panel = rig.wrapper.get('.rp-wall-thickness-panel');
	expect(panel.attributes('aria-busy')).toBe('true');
	await panel.get('.rp-wall-thickness-stepper button').trigger('click');
	await panel.get('.rp-wall-thickness-footer button[type="button"]').trigger('click');
	await panel.get('input').trigger('keydown', { key: 'Escape' });
	expect(rig.control.target.value).toBe('wall-a'); expect(rig.control.value.value).toBe(200);
	// Stronger than normal navigation, which itself refuses during saving: retire the session at the action boundary.
	rig.session.perspective = 'review'; release?.(); await pending;
	expect(rig.control.target.value).toBeNull(); expect(rig.runtime.structureActions.preview.value).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.walls[0].thickness).toBe(150);
	expect(rig.runtime.structureActions.active.value).toBe(false);
});

it('refreshes an externally changed wall before editing and refuses a vanished target', async () => {
	const rig = await setup(), before = expectOk(await rig.geometry.read(rig.plan.id));
	const structure = { ...rig.project.structure, walls: rig.project.structure.walls.map(wall => wall.id === 'wall-a' ? { ...wall, thickness: 250 } : wall) };
	expectOk(await rig.geometry.write(rig.plan.id, { ...before.document, structure }, before.version));
	await rig.control.begin('wall-a'); expect(rig.control.target.value).toBeNull(); expect(rig.project.structure.walls[0].thickness).toBe(250);
	await rig.control.begin('wall-a'); expect(rig.control.value.value).toBe(250); rig.control.close();
	rig.selection.select(['wall-missing' as never]); await rig.control.begin('wall-missing'); expect(rig.control.target.value).toBeNull();
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure).toEqual(structure);
});

it('retires an entry when a shared save starts during its baseline read', async () => {
	const rig = await setup(), originalRead = rig.services.read.bind(rig.services), saves = useSaveStateStore(rig.pinia);
	let release: (() => void) | undefined;
	vi.spyOn(rig.services, 'read').mockImplementationOnce(async id => { await new Promise<void>(resolve => { release = resolve; }); return originalRead(id); });
	const pending = rig.control.begin('wall-a'); await settleUntil(() => release !== undefined, 'entry baseline read');
	expect(rig.wrapper.get('.rp-wall-thickness-panel').attributes('aria-busy')).toBe('true');
	saves.beginSaving(); release?.(); await pending;
	expect(rig.control.target.value).toBeNull(); expect(rig.runtime.structureActions.active.value).toBe(false);
	saves.resolveNeutral(); expect(rig.project.structure.walls[0].thickness).toBe(150);
});

it('cancels on outside pointer input and restores canvas focus when the opener has disappeared', async () => {
	const rig = await setup(), opener = rig.wrapper.get<HTMLButtonElement>('[data-rp-action="wall-thickness"]');
	opener.element.focus(); await opener.trigger('click'); await settle(); rig.control.increment(1);
	opener.element.remove();
	rig.canvasEl.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })); await settle();
	expect(rig.control.target.value).toBeNull(); expect(document.activeElement).toBe(rig.canvasEl);
	expect(rig.project.structure.walls[0].thickness).toBe(150);
});
