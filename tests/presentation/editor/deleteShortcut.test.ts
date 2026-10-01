// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renovationEditor } from '../../helpers/renovationEditor';
import { assetPlacementRig } from '../../helpers/assetPlacement';
import { mountPlanEditorCanvas, settle, settleUntil } from '../../helpers/editor';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
// From the mock's own module: `setLanguage` is the fake's knob, and the German case resets it.
import { Notice, setLanguage } from '../../helpers/obsidian-mock';
import { makeAsset, makeRequirement } from '../../helpers/entities';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { expectDefined, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { planningDraft, materialInput } from '../../../src/presentation/editor/planning/planningDraft';
import { EMPTY_RENOVATION } from '../../../src/domain/renovation/Renovation';
import { WALL_LOOP } from '../../helpers/structure';
import { installObsidianDom } from '../../helpers/dom';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { err, ok } from '../../../src/core/result/Result';

installObsidianDom();

type Rig = Awaited<ReturnType<typeof renovationEditor>>;
const cleanups: (() => void)[] = [];
beforeEach(() => { activateNotices(); });
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.restoreAllMocks(); });

const WALLS = WALL_LOOP.walls.map(wall => wall.id);

/** The editor's Room "Studio" and its four walls saved as one group, selected the way clicking any member selects it. */
async function setup(): Promise<Rig> {
	const rig = await renovationEditor(true);
	cleanups.push(rig.unmount); rig.changePlan(); await settle();
	const read = expectOk(await rig.geometry.read(rig.plan.id)), members = [rig.room.id, ...WALLS];
	expectOk(await rig.geometry.write(rig.plan.id, { ...read.document, groups: [{ id: 'group-studio', name: 'Studio set', memberIds: members }] }, read.version));
	await rig.runtime.refreshProjection();
	rig.selection.select(members as never[]); await settle();
	return rig;
}
function key(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}
const confirmation = (rig: Rig, what: string) => settleUntil(() => rig.dialogs.current?.kind === 'confirm', what);

it('deletes a selected group with the Delete key as one confirmed step that one Undo restores', async () => {
	const rig = await setup(), zones = rig.project.zones.size;
	expect(key(rig.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(true);
	await confirmation(rig, 'the group deletion confirmation');
	const dialog = rig.wrapper.get('.rp-dialog').text();
	expect(dialog).toContain('Studio'); expect(dialog).toContain('Wall 1'); expect(dialog).toContain('Rooms and areas deleted: 1');
	rig.dialogs.resolve('confirm');
	await settleUntil(() => rig.project.zones.size === zones - 1, 'the deleted room');
	await settle();
	expect(rig.project.structure.walls).toEqual([]);
	expect(rig.project.groups).toEqual([]);
	expect(rig.selection.selectedIds).toEqual([]);
	key(rig.canvasEl, { key: 'z', ctrlKey: true });
	await settleUntil(() => rig.project.zones.size === zones && rig.project.structure.walls.length === WALLS.length, 'the restored group');
	await settle();
	expect(rig.project.groups.map(group => group.memberIds)).toEqual([[rig.room.id, ...WALLS]]);
});

it('offers Delete group in a saved group\'s context menu, and Delete for any other selection of several', async () => {
	const rig = await setup(), zones = rig.project.zones.size;
	const openMenu = async () => { rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); };
	await openMenu();
	const item = rig.wrapper.get('[data-rp-context-action="delete"]');
	expect(item.text()).toContain('Delete group');
	await item.trigger('click');
	await confirmation(rig, 'the group deletion confirmation');
	rig.dialogs.resolve('cancel'); await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the cancelled deletion');
	expect(rig.project.zones.size).toBe(zones); expect(rig.project.structure.walls).toHaveLength(WALLS.length);
	rig.selection.select(WALLS.slice(0, 2) as never[]); await settle();
	await openMenu();
	const label = rig.wrapper.get('[data-rp-context-action="delete"]').text();
	expect(label).toContain('Delete'); expect(label).not.toContain('group');
});

it('runs a single item\'s own Delete from Backspace', async () => {
	const rig = await setup();
	rig.selection.select(['wall-a'] as never[]); await settle();
	expect(key(rig.canvasEl, { key: 'Backspace' }).defaultPrevented).toBe(true);
	await confirmation(rig, 'the wall deletion confirmation');
	rig.dialogs.resolve('cancel'); await settleUntil(() => !rig.runtime.structureActions.active.value, 'the cancelled wall deletion');
	expect(rig.project.structure.walls).toHaveLength(WALLS.length);
});

/** M12: a selected placement goes the single-item way, from either key, and Undo brings it back with its asset. */
it.each(['Delete', 'Backspace'])('removes a selected placement with %s as one confirmed step that Undo restores', async (pressed) => {
	const rig = await assetPlacementRig(); cleanups.push(rig.unmount);
	const radiator = await rig.saveAsset('Radiator');
	const id = await rig.place(radiator.id, { x: 1000, y: 1000 });
	rig.selection.select([id as never]); await settle();
	expect(key(rig.canvasEl, { key: pressed }).defaultPrevented).toBe(true);
	await confirmation(rig, 'the placement deletion confirmation');
	rig.dialogs.resolve('confirm');
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 0, 'the removed placement');
	const removed = { elements: rig.project.structure.elements ?? [], metadata: rig.project.plan?.spatialElements ?? [] };
	key(rig.canvasEl, { key: 'z', ctrlKey: true });
	await settleUntil(() => rig.project.structure.elements?.some(item => item.id === id && item.assetId === radiator.id) === true, 'the restored placement');
	// Redo through the same door, the keyboard: Ctrl+Y takes the placement out again, and only it.
	expect(key(rig.canvasEl, { key: 'y', ctrlKey: true }).defaultPrevented).toBe(true);
	await settleUntil(() => (rig.project.structure.elements ?? []).length === 0, 'the redone removal');
	expect({ elements: rig.project.structure.elements ?? [], metadata: rig.project.plan?.spatialElements ?? [] }).toEqual(removed);
	expect(expectOk(await rig.geometry.read(rig.plan.id)).document.structure?.elements ?? []).toEqual([]);
});

it('leaves chords, repeats, composition, dialogs, a stale floor, Review and fields alone', async () => {
	const rig = await setup(), button = () => rig.wrapper.get('[data-rp-action="select"]').element as HTMLElement;
	for (const press of [{ key: 'Delete', ctrlKey: true }, { key: 'Delete', metaKey: true }, { key: 'Delete', altKey: true }, { key: 'Delete', repeat: true }, { key: 'Backspace', isComposing: true }]) {
		expect(key(rig.canvasEl, press).defaultPrevented).toBe(false);
	}
	const pending = rig.dialogs.openDialog({ kind: 'confirm', title: 'Confirm', message: 'Example' }); await settle();
	expect(key(button(), { key: 'Delete' }).defaultPrevented).toBe(false);
	rig.dialogs.resolve('cancel'); await pending;
	rig.project.stale = true;
	expect(key(rig.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(false);
	rig.project.stale = false;
	await rig.runtime.renovation.perspective('review'); await settle();
	expect(key(rig.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(false);
	await rig.runtime.renovation.perspective('plan'); await settle();
	rig.runtime.setTool('draw-room'); await settle();
	expect(key(rig.wrapper.get('.rp-new-room input').element as HTMLElement, { key: 'Backspace' }).defaultPrevented).toBe(false);
	await settle();
	expect(rig.dialogs.current).toBeNull();
	expect(rig.project.structure.walls).toHaveLength(WALLS.length);
});

it('offers no Delete, from the menu or the key, for several items on a floor without renovation services', async () => {
	const harness = await mountPlanEditorCanvas();
	cleanups.push(harness.unmount); await settle();
	const selection = useSelectionStore(harness.pinia), zones = [...useProjectStore(harness.pinia).zones.keys()];
	expect(zones.length).toBeGreaterThan(1);
	selection.select(zones.slice(0, 2) as never[]); await settle();
	expect(key(harness.canvasEl, { key: 'Delete' }).defaultPrevented).toBe(false);
	harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	expect(harness.wrapper.find('[data-rp-context-action="fit"]').exists()).toBe(true);
	expect(harness.wrapper.find('[data-rp-context-action="delete"]').exists()).toBe(false);
});

/** A contextual material on `roomId`, written by the real planning command; answers its asset's name. */
async function material(rig: Rig, roomId: string): Promise<string> {
	const planning = expectDefined(rig.deps.commands.planning, 'planning'), read = expectOk(await planning.read(rig.plan.id));
	const draft = planningDraft('material', read, roomId), asset = expectDefined(read.catalogue.find(item => item.asset.unit === 'm2'), 'area asset').asset;
	draft.assetId = asset.id;
	expectOk(await rig.runtime.dispatcher.run(planning.material(read, materialInput(draft), rig.runtime.structureTask.ledger)));
	return asset.name;
}

// Owner ruling 61: these three were unreachable while the room guards counted origin-zone requirements.
it('refuses a selection holding a room a real material still refers to, naming the room, writing nothing', async () => {
	const rig = await setup(), members = [...rig.selection.selectedIds];
	await material(rig, rig.room.id); rig.selection.select(members as never[]); await settle();
	const bytes = [...rig.stack.vault.entries];
	key(rig.canvasEl, { key: 'Delete' });
	await confirmation(rig, 'the refusal');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Requirements still refer to Studio.');
	rig.dialogs.resolve('confirm'); await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the refused deletion');
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});

it('still blocks a room delete on its renovation records, naming those and not its materials', async () => {
	const rig = await renovationEditor(true); cleanups.push(rig.unmount);
	const read = expectOk(await rig.renovation.read(rig.plan.id));
	const work = { id: 'work-sand', roomId: rig.room.id, targetId: rig.room.id, title: 'Sand floor', description: '', order: 0, progress: 'pending' as const, responsibility: 'unassigned' as const, outcomes: [], dependencies: [] };
	expectOk(await rig.runtime.dispatcher.run(rig.renovation.command(read, { renovation: { ...(read.plan.entity.renovation ?? EMPTY_RENOVATION), work: [work] }, intended: read.geometry.document.intended }, rig.runtime.structureTask.ledger)));
	const name = await material(rig, rig.room.id), bytes = [...rig.stack.vault.entries];
	const deleting = rig.runtime.deleteZone(rig.room.id, rig.room.name);
	await confirmation(rig, 'the renovation refusal');
	const text = rig.wrapper.get('.rp-dialog').text();
	expect(text).toContain('Sand floor'); expect(text).not.toContain(name);
	rig.dialogs.resolve('confirm'); await deleting;
	expect(rig.project.zones.has(rig.room.id)).toBe(true); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

// Owner ruling 62 hides Reassign and Delete anyway for such a room, so the next two answer the dialog
// through its store: the path a script takes, held by the command's own re-check (§87 rule 5).
it('refuses reassigning a contextual material to another room at the command, writing nothing', async () => {
	const rig = await renovationEditor(true); cleanups.push(rig.unmount);
	expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Hall', zoneType: 'Room', geometry: { points: [{ x: 9000, y: 0 }, { x: 11_000, y: 0 }, { x: 11_000, y: 2000 }, { x: 9000, y: 2000 }] } }));
	await material(rig, rig.room.id); await rig.runtime.refreshProjection();
	const bytes = [...rig.stack.vault.entries], shown = Notice.shown.length;
	const deleting = rig.runtime.deleteZone(rig.room.id, rig.room.name);
	await settleUntil(() => rig.dialogs.current !== null, 'a dialog');
	expect(rig.dialogs.current?.kind).toBe('delete-reference');
	rig.dialogs.resolve({ action: 'reassign' });
	await settleUntil(() => rig.wrapper.find('.rp-dialog-candidate').exists(), 'the picker');
	expect(rig.wrapper.get('.rp-dialog-candidate').text()).toContain('Hall');
	await rig.wrapper.get('.rp-dialog-candidate').trigger('click'); await deleting;
	expect(Notice.shown.length).toBe(shown + 1);
	expect(rig.project.zones.has(rig.room.id)).toBe(true); expect([...rig.stack.vault.entries]).toEqual(bytes);
});

// The store's `planningReferentialGuard` refuses the geometry removal; the sequence compensates, so the
// material is rewritten back (a new revision) rather than left untouched — hence entities for it, and
// bytes for everything else: the room note and the sidecar come back byte-identical.
it('refuses Delete anyway on a room a contextual material originates on, restoring the room and its material', async () => {
	const rig = await renovationEditor(true); cleanups.push(rig.unmount);
	await material(rig, rig.room.id);
	const before = expectOk(await rig.stack.requirements.listByZone(rig.room.id)).map(item => item.entity), shown = Notice.shown.length;
	const bytes = new Map(rig.stack.vault.entries);
	const deleting = rig.runtime.deleteZone(rig.room.id, rig.room.name);
	await settleUntil(() => rig.dialogs.current?.kind === 'delete-reference', 'the reference dialog');
	rig.dialogs.resolve({ action: 'delete-anyway' }); await deleting;
	expect(Notice.shown.length).toBe(shown + 1);
	expect(expectOk(await rig.stack.zones.getById(rig.room.id))).not.toBeNull();
	expect(expectOk(await rig.stack.requirements.listByZone(rig.room.id)).map(item => item.entity)).toEqual(before);
	const after = new Map(rig.stack.vault.entries), changed = [...new Set([...bytes.keys(), ...after.keys()])].filter(path => bytes.get(path) !== after.get(path));
	expect(changed).toHaveLength(1); expect(after.get(changed[0])).toContain(before[0].id);
});

// Owner rulings 62, 64 and 69: a room or area any listed requirement is measured from offers only
// Remove references, with one line saying why. Ordinary-only rooms keep all three choices
// (`deleteZoneWithReferences.test.ts`), and so does the Asset library (`assetDelete.test.ts`).
const MEASURED = 'Some of these requirements are measured from this room or area, so they cannot be reassigned elsewhere or kept without it. Removing the references is the only option.';
const GEMESSEN = 'Einige dieser Anforderungen beruhen auf den Maßen dieses Raums oder dieser Fläche. Sie lassen sich weder anderswo neu zuweisen noch ohne diese Grundlage behalten; möglich ist nur das Entfernen der Referenzen.';
type Seed = (rig: Rig) => Promise<{ readonly id: ZoneId; readonly name: string }>;
const contextualRoom: Seed = async (rig) => { await material(rig, rig.room.id); return rig.room; };
const SEEDS: Record<string, Seed> = {
	'a room carrying a contextual material': contextualRoom,
	'a room carrying a contextual and an ordinary material': async (rig) => {
		const paint = expectOk(await rig.stack.assets.save(makeAsset({ name: 'Wall paint', unit: 'm2' }), 'absent')).entity;
		await material(rig, rig.room.id);
		expectOk(await rig.stack.requirements.save(makeRequirement({ projectId: rig.plan.projectId, assetId: paint.id, origin: { kind: 'zone', zoneId: rig.room.id } }), 'absent'));
		return rig.room;
	},
	'an area carrying a contextual material': async (rig) => {
		const garden = expectOk(await rig.deps.commands.createZone.execute({ planId: rig.plan.id, name: 'Garden', zoneType: 'Garden', geometry: { points: [{ x: 5000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 2000 }, { x: 5000, y: 2000 }] } })).zone.entity;
		await rig.runtime.refreshProjection(); await material(rig, garden.id);
		return garden;
	},
};
/** Opens the reference dialog on the seeded zone; answers the pending delete and the vault bytes before it. */
async function askToDelete(seed: Seed) {
	const rig = await renovationEditor(true); cleanups.push(rig.unmount);
	const zone = await seed(rig); await rig.runtime.refreshProjection();
	const bytes = [...rig.stack.vault.entries], deleting = rig.runtime.deleteZone(zone.id, zone.name);
	await settleUntil(() => rig.dialogs.current?.kind === 'delete-reference', 'the reference dialog');
	return { rig, zone, bytes, deleting };
}
const offered = (rig: Rig) => rig.wrapper.findAll('.rp-dialog [data-rp-action]').map(button => button.attributes('data-rp-action'));

it.each(Object.keys(SEEDS))('offers only Remove references for %s, saying why, and writes nothing first', async (name) => {
	const { rig, zone, bytes, deleting } = await askToDelete(expectDefined(SEEDS[name], name));
	expect(offered(rig)).toEqual(['cancel', 'remove-references']);
	expect(rig.wrapper.get('[data-rp-contextual-only]').text()).toBe(MEASURED);
	expect([...rig.stack.vault.entries]).toEqual(bytes);
	await rig.wrapper.get('[data-rp-action="remove-references"]').trigger('click'); await deleting;
	expect(expectOk(await rig.stack.zones.getById(zone.id))).toBeNull();
	expect(expectOk(await rig.stack.requirements.listByZone(zone.id))).toEqual([]);
});

it('says why in the approved German under the German locale', async () => {
	setLanguage('de');
	try {
		const { rig, deleting } = await askToDelete(contextualRoom);
		expect(rig.wrapper.get('[data-rp-contextual-only]').text()).toBe(GEMESSEN);
		rig.dialogs.resolve({ action: 'cancel' }); await deleting;
	} finally { setLanguage('en'); }
});

it('leaves the hidden choices unreachable from the keyboard', async () => {
	const { rig, bytes, deleting } = await askToDelete(contextualRoom);
	const dialog = rig.wrapper.get('.rp-dialog').element;
	const focusable = [...dialog.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]')];
	expect(focusable.map(item => item.dataset.rpAction)).toEqual(['cancel', 'remove-references']);
	for (const pressed of ['Enter', 'Delete', 'r', 'd']) dialog.dispatchEvent(new KeyboardEvent('keydown', { key: pressed, bubbles: true, cancelable: true }));
	await settle();
	expect(rig.dialogs.current?.kind).toBe('delete-reference'); expect([...rig.stack.vault.entries]).toEqual(bytes);
	rig.dialogs.resolve({ action: 'cancel' }); await deleting;
});

it('refuses a selection holding a room requirements still refer to, and reports a failed lookup, writing nothing', async () => {
	const rig = await setup(), bytes = [...rig.stack.vault.entries], lookup = vi.spyOn(rig.deps.queries, 'listRequirementsReferencing');
	lookup.mockResolvedValueOnce(ok([{ projectId: rig.plan.projectId, projectName: 'Home', requirementIds: ['requirement-tiles'] }]) as never);
	key(rig.canvasEl, { key: 'Delete' });
	await confirmation(rig, 'the refusal');
	expect(rig.wrapper.get('.rp-dialog').text()).toContain('Requirements still refer to Studio.');
	rig.dialogs.resolve('confirm'); await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the refused deletion');
	const shown = Notice.shown.length;
	lookup.mockResolvedValueOnce(err(injectedPersistenceError()) as never);
	key(rig.canvasEl, { key: 'Delete' });
	await settleUntil(() => Notice.shown.length === shown + 1, 'the lookup failure notice');
	await settleUntil(() => !rig.runtime.elementActions.removeManyActive.value, 'the failed deletion');
	expect(rig.dialogs.current).toBeNull();
	expect([...rig.stack.vault.entries]).toEqual(bytes);
});
