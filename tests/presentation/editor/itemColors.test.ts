// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
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
	const rig = await setup(), setColor = vi.spyOn(rig.runtime.groupActions, 'setColor');
	await rig.wrapper.get('[data-rp-item-color="blue"]').trigger('click');
	await settleUntil(() => colorOf(rig) === 'blue', 'blue item');
	expect(setColor).toHaveBeenCalledWith([item.id], 'blue');
	const saved = expectOk(await rig.geometry.read(rig.plan.id));
	expect(saved.document.structure?.elements?.[0].color).toBe('blue');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(14);
	await rig.runtime.groupActions.setColor([item.id], 'blue');
	expect(expectOk(await rig.geometry.read(rig.plan.id)).version).toEqual(saved.version);
	await rig.runtime.undo(); await settle(); expect(colorOf(rig)).toBeUndefined();
	await rig.runtime.redo(); await settle(); expect(colorOf(rig)).toBe('blue');
	await menu(rig);
	const palette = rig.wrapper.get('.rp-canvas-context-menu .rp-item-color');
	expect(palette.get('[data-rp-item-color="blue"]').attributes('aria-checked')).toBe('true');
	await palette.get('[data-rp-item-color="default"]').trigger('click');
	await settleUntil(() => colorOf(rig) === undefined, 'default item');
	expect(setColor).toHaveBeenLastCalledWith([item.id], undefined);
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
	const rig = await setup(), retained = () => rig.runtime.groupActions.setColor([item.id], 'rose');
	rig.session.perspective = perspective; await settle();
	const before = [...rig.stack.vault.entries];
	await retained(); await menu(rig);
	expect(rig.wrapper.find('.rp-item-color').exists()).toBe(false);
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('recolours every selected member as one undo step and keeps the saved group', async () => {
	const rig = await setup(), baseline = expectOk(await rig.renovation.read(rig.plan.id));
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(baseline, elementInput(baseline, { ...item, id: 'element-second', name: 'Second' }), rig.runtime.structureTask.ledger)));
	const grouped = expectOk(await rig.geometry.read(rig.plan.id));
	const groups = [{ id: 'group-cabinets', name: 'Cabinets', memberIds: [item.id, 'element-second'] }];
	expectOk(await rig.geometry.write(rig.plan.id, { ...grouped.document, groups }, grouped.version));
	await rig.runtime.refreshProjection();
	rig.selection.select([item.id, 'element-second'] as never); await settle();
	await rig.runtime.groupActions.setColor([item.id, 'element-second'], 'green');
	const colors = () => rig.project.structure.elements?.map(element => element.color);
	expect(colors()).toEqual(['green', 'green']);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.groups).toEqual(groups);
	await rig.runtime.undo(); await settle(); expect(colors()).toEqual([undefined, undefined]);
});

/** A door on the first wall, written to the sidecar and projected. */
async function addDoor(rig: Awaited<ReturnType<typeof setup>>) {
	const wall = rig.project.structure.walls[0].id, read = expectOk(await rig.geometry.read(rig.plan.id)), current = expectDefined(read.document.structure, 'structure');
	const door = { id: 'opening-door', kind: 'door' as const, hostId: wall, offset: 500, width: 800, height: 2100, sill: 0 };
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, structure: { ...current, openings: [door] } }, read.version));
	await rig.runtime.refreshProjection(); return { wall, door: door.id };
}

it('recolours a path, a room and a wall at the action, and a wall without its hosted door', async () => {
	const rig = await setup({ id: 'element-path', kind: 'path', name: 'Path', points: item.points.slice(0, 2) });
	const room = rig.room.id, { wall } = await addDoor(rig);
	// The room goes second, so the wall's write proves the projection carries the room's colour (no stale refusal).
	for (const id of ['element-path', room, wall]) { rig.selection.select([id as never]); await settle(); await rig.runtime.groupActions.setColor([id], '#3a7bd5'); }
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document;
	expect(saved.structure?.elements?.find(element => element.id === 'element-path')?.color).toBe('#3a7bd5');
	expect(saved.objects.find(object => object.id === room)?.color).toBe('#3a7bd5');
	expect(saved.structure?.walls.find(candidate => candidate.id === wall)?.color).toBe('#3a7bd5');
	expect(saved.structure?.openings[0]).not.toHaveProperty('color');
	expect(rig.project.zones.get(room)?.color).toBe('#3a7bd5');
});

it('colours a selected door from its Details on the opening, never on its host wall', async () => {
	const rig = await setup(), { wall, door } = await addDoor(rig);
	rig.selection.select([door as never]); await settleUntil(() => rig.wrapper.find('.rp-structure-inspector .rp-item-color').exists(), 'door palette');
	await rig.wrapper.get('.rp-structure-inspector [data-rp-item-color="rose"]').trigger('click');
	await settleUntil(() => rig.project.structure.openings[0]?.color === 'rose', 'rose door');
	const saved = expectOk(await rig.geometry.read(rig.plan.id)).document.structure;
	expect(saved?.openings[0].color).toBe('rose'); expect(saved?.walls.find(candidate => candidate.id === wall)).not.toHaveProperty('color');
});

it('refuses saving/stale states and compensates a failed color write without changing the shown color', async () => {
	const rig = await setup(), before = expectOk(await rig.renovation.read(rig.plan.id)), save = useSaveStateStore(rig.pinia);
	await rig.runtime.groupActions.setColor([item.id], 'unknown' as never); expect(colorOf(rig)).toBeUndefined();
	rig.project.stale = true; await rig.runtime.groupActions.setColor([item.id], 'blue'); expect(colorOf(rig)).toBeUndefined();
	rig.project.stale = false;
	save.beginSaving(); await settle();
	expect(rig.wrapper.get('[data-rp-item-color="rose"]').attributes('aria-disabled')).toBe('true');
	await rig.wrapper.get('[data-rp-item-color="rose"]').trigger('click');
	await rig.runtime.groupActions.setColor([item.id], 'rose'); expect(colorOf(rig)).toBeUndefined();
	save.resolveNeutral();
	vi.spyOn(rig.geometry, 'write').mockResolvedValueOnce(err(injectedPersistenceError()));
	await rig.runtime.groupActions.setColor([item.id], 'rose'); await settle();
	const after = expectOk(await rig.renovation.read(rig.plan.id));
	expect(after.geometry.document).toEqual(before.geometry.document); expect(after.plan.entity).toEqual(before.plan.entity);
	expect(colorOf(rig)).toBeUndefined(); expect(rig.runtime.groupActions.active.value).toBe(false);
});

it.each(['selection', 'perspective'] as const)('rejects a %s change during its asynchronous read and a concurrent request', async change => {
	const rig = await setup(), groups = expectDefined(rig.deps.commands.groups, 'group services');
	const baseline = await groups.read(rig.plan.id), waiting = defer<typeof baseline>();
	vi.spyOn(groups, 'read').mockReturnValueOnce(waiting.promise);
	const before = [...rig.stack.vault.entries], pending = rig.runtime.groupActions.setColor([item.id], 'amber');
	expect(rig.runtime.groupActions.active.value).toBe(true);
	await rig.runtime.groupActions.setColor([item.id], 'violet');
	if (change === 'selection') { rig.selection.clear(); rig.selection.select([item.id as never]); }
	else { rig.session.perspective = 'renovate'; rig.session.perspective = 'plan'; }
	waiting.resolve(baseline); await pending;
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('copies and pastes the color as placement content through the editor clipboard and history', async () => {
	const rig = await setup(); await rig.runtime.groupActions.setColor([item.id], 'violet');
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
	await rig.runtime.groupActions.setColor([item.id], 'amber');
	expect(rig.project.structure.elements?.[0]).toEqual({ id: placement.id, kind: placement.kind, assetId: placement.assetId, points: placement.points, color: 'amber' });
	await rig.runtime.undo(); await settle(); expect(colorOf(rig)).toBeUndefined();
});

it('changes only one placement, preserving its library definition and another instance', async () => {
	const rig = await assetPlacementRig(); mounted.push(rig); rig.changePlan(); await settle();
	const asset = await rig.saveAsset('Armchair'), first = await rig.place(asset.id, { x: 1000, y: 1000 }), second = await rig.place(asset.id, { x: 2500, y: 1000 });
	const before = await rig.stack.assets.getById(asset.id);
	rig.selection.select([first as never]); await settle(); await rig.runtime.groupActions.setColor([first], 'green');
	expect(rig.project.structure.elements?.find(element => element.id === first)?.color).toBe('green');
	expect(rig.project.structure.elements?.find(element => element.id === second)?.color).toBeUndefined();
	expect(await rig.stack.assets.getById(asset.id)).toEqual(before);
});

it('keeps a peer color change and refuses the stale projection before making a command', async () => {
	const rig = await setup(), baseline = expectOk(await rig.geometry.read(rig.plan.id));
	const current = baseline.document.structure;
	if (!current) throw new Error('Expected a structure');
	expectOk(await rig.geometry.write(rig.plan.id, { ...baseline.document, structure: { ...current, elements: [{ ...item, color: 'rose' }] } }, baseline.version));
	const command = vi.spyOn(expectDefined(rig.deps.commands.groups, 'group services'), 'command');
	await rig.runtime.groupActions.setColor([item.id], 'green'); await settle();
	expect(command).not.toHaveBeenCalled(); expect(colorOf(rig)).toBe('rose');
});

it('refuses a recolour while a drawing tool is active', async () => {
	const rig = await setup(), before = [...rig.stack.vault.entries];
	rig.runtime.setTool('draw-polygon'); await settle();
	await rig.runtime.groupActions.setColor([item.id], 'blue');
	expect(colorOf(rig)).toBeUndefined();
	expect([...rig.stack.vault.entries]).toEqual(before);
});

it('has valid accessible names and roles in the Inspector and context-menu routes', { timeout: 30_000 }, async () => {
	const rig = await setup();
	expect((await axe.run(rig.wrapper.get('.rp-item-color').element as HTMLElement, runOptions)).violations).toEqual([]);
	await menu(rig);
	expect((await axe.run(rig.wrapper.get('.rp-canvas-context-menu').element as HTMLElement, runOptions)).violations).toEqual([]);
});

it('refuses to undo over a peer sidecar-only color change', async () => {
	const rig = await setup(); await rig.runtime.groupActions.setColor([item.id], 'blue');
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
	await rig.runtime.groupActions.setColor([item.id], 'blue');
	const colored = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(colored.schemaVersion).toBe(14); expect(colored.structure?.walls).toEqual(walls);
	await rig.runtime.groupActions.setColor([item.id], undefined);
	const reset = expectOk(await rig.stack.store.read(rig.plan.id)).dto;
	expect(reset.schemaVersion).toBe(13); expect(reset.structure?.walls).toEqual(walls);
});

it('commits a custom colour from Details on change, never on input, and names the hex', async () => {
	const rig = await setup(), picker = rig.wrapper.get<HTMLInputElement>('.rp-element-inspector input[type="color"]');
	const wrapper = rig.wrapper.get('.rp-element-inspector .rp-item-color__custom');
	expect(wrapper.element.tagName).toBe('LABEL');
	expect(wrapper.element.contains(picker.element)).toBe(true);
	picker.element.value = '#3a7bd5'; await picker.trigger('input'); await settle();
	expect(colorOf(rig)).toBeUndefined();
	await picker.trigger('change'); await settleUntil(() => colorOf(rig) === '#3a7bd5', 'custom colour');
	expect(rig.wrapper.get('.rp-element-inspector .rp-item-color').text()).toContain('Color · #3a7bd5');
	expect(rig.wrapper.get('.rp-element-inspector input[type="color"]').attributes('aria-label')).toBe('Custom color #3a7bd5');
	expect(expectOk(await rig.stack.store.read(rig.plan.id)).dto.schemaVersion).toBe(16);
	await menu(rig); expect(rig.wrapper.find('.rp-canvas-context-menu input[type="color"]').exists()).toBe(false);
});

it('shows Mixed for an item, a wall and a room with different colours, and one choice sets all three as one undo step', async () => {
	const rig = await setup(), wall = rig.project.structure.walls[0].id;
	await rig.runtime.groupActions.setColor([item.id], 'blue');
	rig.selection.select([item.id, wall, rig.room.id] as never); await settleUntil(() => rig.wrapper.find('.rp-multi-selection .rp-item-color').exists(), 'multi palette');
	const palette = rig.wrapper.get('.rp-multi-selection .rp-item-color');
	expect(palette.text()).toContain('Color · Mixed');
	expect(palette.findAll('[aria-pressed="true"]')).toHaveLength(0);
	await palette.get('[data-rp-item-color="violet"]').trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.color === 'violet', 'violet selection');
	expect([colorOf(rig), rig.project.structure.walls[0].color]).toEqual(['violet', 'violet']);
	await rig.runtime.undo(); await settle();
	expect([colorOf(rig), rig.project.structure.walls[0].color, rig.project.zones.get(rig.room.id)?.color]).toEqual(['blue', undefined, undefined]);
	await menu(rig);
	expect(rig.wrapper.get('.rp-canvas-context-menu .rp-item-color').text()).toContain('Color · Mixed');
});

it('offers the palette for a wall in its Details and for a room in its Details', async () => {
	const rig = await setup(), wall = rig.project.structure.walls[0].id;
	rig.selection.select([wall as never]); await settleUntil(() => rig.wrapper.find('.rp-structure-inspector .rp-item-color').exists(), 'wall palette');
	await rig.wrapper.get('.rp-structure-inspector [data-rp-item-color="rose"]').trigger('click');
	await settleUntil(() => rig.project.structure.walls[0].color === 'rose', 'rose wall');
	rig.selection.select([rig.room.id as never]); await settleUntil(() => rig.wrapper.find('.rp-room-inspector .rp-item-color').exists(), 'room palette');
	await rig.wrapper.get('.rp-room-inspector [data-rp-item-color="amber"]').trigger('click');
	await settleUntil(() => rig.project.zones.get(rig.room.id)?.color === 'amber', 'amber room');
	expect(rig.wrapper.get('.rp-room-inspector .rp-item-color').text()).toContain('Color · Amber');
});
