// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { settle, settleUntil } from '../../helpers/editor';
import { defer } from '../../helpers/async';
import { err } from '../../../src/core/result/Result';
import { elementInput } from '../../../src/presentation/editor/elements/elementInput';
import type { NamedSpatialElement } from '../../../src/domain/spatial/SpatialElement';
import { createEditorClipboard } from '../../../src/presentation/editor/clipboard/editorClipboard';
import { useSaveStateStore } from '../../../src/presentation/editor/save-state/save-state-store';
import axe from 'axe-core';
import { runOptions } from '../../harness/axeOptions';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { mounted.splice(0).forEach(rig => rig.unmount()); vi.restoreAllMocks(); });
const item: NamedSpatialElement = { id: 'element-cabinet', kind: 'object', name: 'Cabinet', points: [{ x: 500, y: 500 }, { x: 1500, y: 500 }, { x: 1500, y: 1000 }, { x: 500, y: 1000 }] };
async function setup(element = item) {
	const rig = await renovationEditor(true, undefined, createEditorClipboard()); mounted.push(rig); rig.changePlan(); await settle();
	const baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, element), rig.runtime.structureTask.ledger)));
	rig.selection.select([element.id as never]); await settle(); return rig;
}
const colorOf = (rig: Awaited<ReturnType<typeof setup>>) => rig.project.structure.elements?.find(element => element.id === item.id)?.color;
async function menu(rig: Awaited<ReturnType<typeof setup>>) {
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
}

it('shares the Inspector/menu action, persists, undoes/redoes, and resets without a same-color history entry', async () => {
	const rig = await setup(), setColor = vi.spyOn(rig.runtime.elementActions, 'setColor');
	await rig.wrapper.get('[data-rp-item-color="blue"]').trigger('click');
	await settleUntil(() => colorOf(rig) === 'blue', 'blue item');
	expect(setColor).toHaveBeenCalledWith(item.id, 'blue');
	const saved = expectOk(await rig.geometry.read(rig.plan.id));
	expect(saved.document.structure?.elements?.[0].color).toBe('blue');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(14);
	await rig.runtime.elementActions.setColor(item.id, 'blue');
	expect(expectOk(await rig.geometry.read(rig.plan.id)).version).toEqual(saved.version);
	await rig.runtime.undo(); await settle(); expect(colorOf(rig)).toBeUndefined();
	await rig.runtime.redo(); await settle(); expect(colorOf(rig)).toBe('blue');
	await menu(rig);
	const palette = rig.wrapper.get('.rp-canvas-context-menu .rp-item-color');
	expect(palette.get('[data-rp-item-color="blue"]').attributes('aria-checked')).toBe('true');
	await palette.get('[data-rp-item-color="default"]').trigger('click');
	await settleUntil(() => colorOf(rig) === undefined, 'default item');
	expect(setColor).toHaveBeenLastCalledWith(item.id, undefined);
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements?.[0]).not.toHaveProperty('color');
});

it('offers named, selected swatches with menu arrow navigation and keyboard application', async () => {
	const rig = await setup(); await menu(rig);
	const palette = rig.wrapper.get('.rp-canvas-context-menu .rp-item-color');
	expect(palette.findAll('[role="menuitemradio"]')).toHaveLength(7);
	await palette.trigger('keydown', { key: 'Home' });
	const reset = palette.get<HTMLButtonElement>('[data-rp-item-color="default"]'); reset.element.focus();
	await reset.trigger('keydown', { key: 'ArrowLeft' });
	expect(document.activeElement).toBe(palette.get('[data-rp-item-color="violet"]').element);
	await palette.get('[data-rp-item-color="violet"]').trigger('keydown', { key: 'ArrowRight' });
	expect(document.activeElement).toBe(reset.element);
	await reset.trigger('keydown', { key: 'ArrowRight' });
	expect(document.activeElement).toBe(palette.get('[data-rp-item-color="slate"]').element);
	// Native buttons deliver click for Enter/Space; keydown must not be swallowed by the parent menu.
	const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
	document.activeElement?.dispatchEvent(enter); expect(enter.defaultPrevented).toBe(false);
	await palette.get('[data-rp-item-color="slate"]').trigger('click'); await settle();
	expect(colorOf(rig)).toBe('slate');
	expect(rig.wrapper.get('.rp-item-color').text()).toContain('Color · Slate');
});

it.each(['renovate', 'review'] as const)('hides and refuses retained color callbacks in %s', async perspective => {
	const rig = await setup(), retained = () => rig.runtime.elementActions.setColor(item.id, 'rose');
	rig.session.perspective = perspective; await settle();
	const before = [...rig.stack.vault.entries];
	await retained(); await menu(rig);
	expect(rig.wrapper.find('.rp-item-color').exists()).toBe(false);
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('refuses groups/multiple selections without partially writing a member, and still edits an inspected member', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { ...item, id: 'element-second', name: 'Second' }), rig.runtime.structureTask.ledger)));
	const grouped = expectOk(await rig.geometry.read(rig.plan.id));
	const groups = [{ id: 'group-cabinets', name: 'Cabinets', memberIds: [item.id, 'element-second'] }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...grouped.document, groups }, grouped.version));
	await rig.runtime.refreshProjection();
	rig.selection.select([item.id, 'element-second'] as never); await settle();
	const before = [...rig.stack.vault.entries];
	await rig.runtime.elementActions.setColor(item.id, 'green'); await menu(rig);
	expect(rig.wrapper.find('.rp-item-color').exists()).toBe(false); expect([...rig.stack.vault.entries]).toEqual(before);
	rig.selection.focus(item.id as never); await settle();
	await rig.wrapper.get('[data-rp-group-action="inspect"]').trigger('click'); await settle();
	await rig.runtime.elementActions.setColor(item.id, 'green'); expect(colorOf(rig)).toBe('green');
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual(groups);
});

it('does not recolor a path, room or wall at the action boundary', async () => {
	const rig = await setup({ id: 'element-path', kind: 'path', name: 'Path', points: item.points.slice(0, 2) });
	for (const id of ['element-path', rig.room.id, rig.project.structure.walls[0].id]) {
		rig.selection.select([id as never]); await settle(); const before = [...rig.stack.vault.entries];
		await rig.runtime.elementActions.setColor(id, 'green'); expect([...rig.stack.vault.entries]).toEqual(before);
		expect(rig.wrapper.find('.rp-item-color').exists()).toBe(false);
	}
});

it('refuses saving/stale states and compensates a failed color write without changing the shown color', async () => {
	const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id)), save = useSaveStateStore(rig.pinia);
	await rig.runtime.elementActions.setColor(item.id, 'unknown' as never); expect(colorOf(rig)).toBeUndefined();
	rig.project.stale = true; await rig.runtime.elementActions.setColor(item.id, 'blue'); expect(colorOf(rig)).toBeUndefined();
	rig.project.stale = false;
	save.beginSaving(); await settle();
	expect(rig.wrapper.get('[data-rp-item-color="rose"]').attributes('aria-disabled')).toBe('true');
	await rig.wrapper.get('[data-rp-item-color="rose"]').trigger('click');
	await rig.runtime.elementActions.setColor(item.id, 'rose'); expect(colorOf(rig)).toBeUndefined();
	save.resolveNeutral();
	vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.runtime.elementActions.setColor(item.id, 'rose'); await settle();
	const after = expectOk(await rig.renovation.read(rig.plan.id));
	expect(after.geometry.document).toEqual(before.geometry.document); expect(after.plan.entity).toEqual(before.plan.entity);
	expect(colorOf(rig)).toBeUndefined(); expect(rig.runtime.elementActions.active.value).toBe(false);
});

it.each(['selection', 'perspective'] as const)('rejects a %s change during its asynchronous read and a concurrent request', async change => {
	const rig = await setup(), baseline = await rig.renovation.read(rig.plan.id), waiting = defer<typeof baseline>();
	vi.spyOn(rig.renovation, 'read').mockReturnValueOnce(waiting.promise);
	const before = [...rig.stack.vault.entries], pending = rig.runtime.elementActions.setColor(item.id, 'amber');
	expect(rig.runtime.elementActions.active.value).toBe(true);
	await rig.runtime.elementActions.setColor(item.id, 'violet');
	if (change === 'selection') { rig.selection.clear(); rig.selection.select([item.id as never]); }
	else { rig.session.perspective = 'renovate'; rig.session.perspective = 'plan'; }
	waiting.resolve(baseline); await pending;
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('copies and pastes the color as placement content through the editor clipboard and history', async () => {
	const rig = await setup(); await rig.runtime.elementActions.setColor(item.id, 'violet');
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }));
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true }));
	await settleUntil(() => rig.project.structure.elements?.length === 2, 'colored paste');
	const pasted = rig.project.structure.elements?.find(element => element.id !== item.id);
	expect(pasted?.color).toBe('violet');
	await rig.runtime.undo(); await settle(); expect(rig.project.structure.elements).toHaveLength(1);
	await rig.runtime.redo(); await settle(); expect(rig.project.structure.elements?.find(element => element.id !== item.id)?.color).toBe('violet');
});

it('edits a missing asset placement while retaining its reference and geometry', async () => {
	const placement = { ...item, kind: 'asset' as const, assetId: 'asset-missing', points: item.points.slice(0, 2) };
	const rig = await setup(placement);
	await rig.runtime.elementActions.setColor(item.id, 'amber');
	expect(rig.project.structure.elements?.[0]).toEqual({ id: placement.id, kind: placement.kind, assetId: placement.assetId, points: placement.points, color: 'amber' });
	await rig.runtime.undo(); await settle(); expect(colorOf(rig)).toBeUndefined();
});

it('changes only one placement, preserving its library definition and another instance', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig); rig.changePlan(); await settle();
	const asset = await rig.saveAsset('Armchair'), first = await rig.place(asset.id, { x: 1000, y: 1000 }), second = await rig.place(asset.id, { x: 2500, y: 1000 });
	const before = await rig.stack.assets.getById(asset.id);
	rig.selection.select([first as never]); await settle(); await rig.runtime.elementActions.setColor(first, 'green');
	expect(rig.project.structure.elements?.find(element => element.id === first)?.color).toBe('green');
	expect(rig.project.structure.elements?.find(element => element.id === second)?.color).toBeUndefined();
	expect(await rig.stack.assets.getById(asset.id)).toEqual(before);
});

it('keeps a peer color change and refuses the stale projection before making a command', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const current = baseline.document.structure;
	if (!current) throw new Error('Expected a structure');
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...current, elements: [{ ...item, color: 'rose' }] } }, baseline.version));
	const command = vi.spyOn(rig.renovation, 'command');
	await rig.runtime.elementActions.setColor(item.id, 'green'); await settle();
	expect(command).not.toHaveBeenCalled(); expect(colorOf(rig)).toBe('rose');
});

it('has valid accessible names and roles in the Inspector and context-menu routes', { timeout: 30_000 }, async () => {
	const rig = await setup();
	expect((await axe.run(rig.wrapper.get('.rp-item-color').element as HTMLElement, runOptions)).violations).toEqual([]);
	await menu(rig);
	expect((await axe.run(rig.wrapper.get('.rp-canvas-context-menu').element as HTMLElement, runOptions)).violations).toEqual([]);
});

it('refuses to undo over a peer sidecar-only color change', async () => {
	const rig = await setup(); await rig.runtime.elementActions.setColor(item.id, 'blue');
	const baseline = expectOk(await rig.geometry.read(rig.plan.id)), current = baseline.document.structure;
	if (!current) throw new Error('Expected a structure');
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...current, elements: [{ ...item, color: 'rose' }] } }, baseline.version));
	const result = await rig.runtime.dispatcher.undo();
	expect(result).toMatchObject({ ok: false, error: { code: 'undo.superseded' } });
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements?.[0].color).toBe('rose');
});

it('round-trips color with independent A/B wall depths and resets to the wall-only schema without altering them', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id)), current = baseline.document.structure;
	if (!current) throw new Error('Expected a structure');
	const walls = current.walls.map((wall, index) => index === 0 ? { ...wall, sideExtents: { a: 1, b: wall.thickness - 1 } } : wall);
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...current, walls } }, baseline.version));
	await rig.runtime.refreshProjection();
	await rig.runtime.elementActions.setColor(item.id, 'blue');
	const colored = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(colored.schemaVersion).toBe(14); expect(colored.structure?.walls).toEqual(walls);
	await rig.runtime.elementActions.setColor(item.id, undefined);
	const reset = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(reset.schemaVersion).toBe(13); expect(reset.structure?.walls).toEqual(walls);
});
