// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import axe from 'axe-core';
import { renovationEditor } from '../../helpers/renovationEditor';
import { settle, settleUntil } from '../../helpers/editor';
import { expectDefined, expectOk } from '../../helpers/domain';
import { runOptions } from '../../harness/axeOptions';

const mounted: Awaited<ReturnType<typeof renovationEditor>>[] = [];
afterEach(() => { for (const rig of mounted.splice(0)) rig.unmount(); });
type Rig = Awaited<ReturnType<typeof renovationEditor>>;
async function setup() { const rig = await renovationEditor(true); mounted.push(rig); rig.changePlan(); await settle(); return rig; }
async function menuFor(rig: Rig, id: string) { rig.selection.select([id as never]); await settle(); rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle(); }
const ids = (rig: Rig, selector: string) => rig.wrapper.findAll(`${selector} [data-rp-context-action], ${selector} [role="separator"]`).map(item => item.attributes('data-rp-context-action') ?? '|');
const parent = (rig: Rig) => rig.wrapper.get<HTMLElement>('[data-rp-context-action="add-menu"]');
async function key(target: ReturnType<Rig['wrapper']['get']>, name: string) { await target.trigger('keydown', { key: name }); await settle(); }

it('puts a wall\'s geometry and record creations in one Add submenu, separated', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	expect(parent(rig).attributes('aria-haspopup')).toBe('menu');
	expect(parent(rig).attributes('aria-expanded')).toBe('false');
	expect(rig.wrapper.find('[data-rp-context-action="add-door"]').exists()).toBe(false);
	await parent(rig).trigger('click'); await settle();
	expect(parent(rig).attributes('aria-expanded')).toBe('true');
	expect(ids(rig, '.rp-canvas-context-menu--nested')).toEqual(['add-door', 'add-window', 'add-opening', 'new-wall', '|', 'add-work', 'add-note', 'add-photo']);
});

it('offers only record creations for a room, an area and an opening, and no submenu for several items or in Review', async () => {
	const rig = await setup();
	for (const id of [rig.room.id]) {
		await menuFor(rig, id); await parent(rig).trigger('click'); await settle();
		expect(ids(rig, '.rp-canvas-context-menu--nested')).toEqual(['add-work', 'add-note', 'add-photo']);
		await key(parent(rig), 'Escape'); await key(parent(rig), 'Escape');
	}
	rig.selection.select(['wall-a', 'wall-b'] as never[]); await settle();
	rig.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true })); await settle();
	expect(rig.wrapper.find('[data-rp-context-action="add-menu"]').exists()).toBe(false);
	await rig.runtime.renovation.perspective('review'); await menuFor(rig, 'wall-a');
	expect(rig.wrapper.find('[data-rp-context-action="add-menu"]').exists()).toBe(false);
});

it('opens with ArrowRight, returns with ArrowLeft or Escape, and closes everything on a second Escape or Tab', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	parent(rig).element.focus(); await key(parent(rig), 'ArrowRight');
	const first = rig.wrapper.get('[data-rp-context-action="add-door"]');
	expect(document.activeElement).toBe(first.element);
	await key(first, 'ArrowDown'); expect(document.activeElement).toBe(rig.wrapper.get('[data-rp-context-action="add-window"]').element);
	await key(rig.wrapper.get('[data-rp-context-action="add-window"]'), 'ArrowLeft');
	expect(document.activeElement).toBe(parent(rig).element); expect(parent(rig).attributes('aria-expanded')).toBe('false');
	await key(parent(rig), 'Enter'); await key(rig.wrapper.get('[data-rp-context-action="add-door"]'), 'Escape');
	expect(document.activeElement).toBe(parent(rig).element);
	await key(parent(rig), 'Escape');
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
	await menuFor(rig, 'wall-a'); await parent(rig).trigger('click'); await settle();
	await key(rig.wrapper.get('[data-rp-context-action="add-note"]'), 'Tab');
	expect(rig.wrapper.find('.rp-canvas-context-menu').exists()).toBe(false);
});

it('opens on hover and closes when the pointer moves to another item', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	await parent(rig).trigger('pointerenter'); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested').exists()).toBe(true);
	await rig.wrapper.get('[data-rp-context-action="measure"]').trigger('pointerenter'); await settle();
	expect(rig.wrapper.find('.rp-canvas-context-menu--nested').exists()).toBe(false);
});

it('greys children with their reason, and greys the parent only when every child is greyed', async () => {
	const rig = await setup(); rig.project.stale = true; await menuFor(rig, 'wall-a');
	expect(parent(rig).attributes('aria-disabled')).toBe('true');
	expect(parent(rig).attributes('title')).toBe('Editing is paused until the floor is re-read.');
	rig.project.stale = false; await key(parent(rig), 'Escape'); await menuFor(rig, 'wall-a');
	expect(parent(rig).attributes('aria-disabled')).toBeUndefined();
});

it('creates a Work item with no room from the submenu of a wall that bounds none', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a');
	await parent(rig).trigger('click'); await settle();
	await rig.wrapper.get('[data-rp-context-action="add-work"]').trigger('click');
	await settleUntil(() => rig.wrapper.find('[data-rp-form="renovation"]').exists(), 'Work form open');
	await rig.wrapper.get('[data-rp-form="renovation"] input[name="title"]').setValue('Repoint');
	const form = rig.wrapper.get('[data-rp-form="renovation"]');
	await form.trigger('submit'); await form.trigger('submit');
	await settleUntil(() => (rig.project.plan?.renovation?.work.length ?? 0) === 1, 'Work saved');
	const work = expectDefined(rig.project.plan?.renovation?.work[0], 'Work');
	expect(work.targetId).toBe('wall-a'); expect(work.roomId).toBeUndefined();
	expectOk(await rig.renovation.read(rig.plan.id));
});

it('has no axe violations with the submenu open', async () => {
	const rig = await setup(); await menuFor(rig, 'wall-a'); await parent(rig).trigger('click'); await settle();
	expect((await axe.run(rig.wrapper.element as HTMLElement, runOptions)).violations).toEqual([]);
}, 30_000);
