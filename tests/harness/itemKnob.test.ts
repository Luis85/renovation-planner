/**
 * @vitest-environment jsdom
 *
 * `&item=<gesture>` (item modes and "Add to asset library" captures): the reference workspace's real renovation and
 * asset-creation services over a seeded plan with plain items, driven to the state each fixed shot photographs.
 */
import { afterEach, expect, it, vi } from 'vitest';
import { mountPlanEditorHarness } from './planEditor';
import { parseItemKnob, type ItemGesture } from './itemKnob';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver, placeAt, resizeTo } from '../helpers/layout';
import { settle, settleUntil, sizedShellRoot } from '../helpers/editor';

const mounted: Array<ReturnType<typeof mountPlanEditorHarness>> = [];
afterEach(async () => {
	for (const { view } of mounted.splice(0)) await view.onClose();
	vi.restoreAllMocks();
	history.replaceState(null, '', '/');
	document.body.innerHTML = '';
});

async function mountAt(item: ItemGesture, width = 1280) {
	history.replaceState(null, '', `/?view=plan-editor&reference&planning&item=${item}`);
	installCanvas();
	installResizeObserver();
	const harness = mountPlanEditorHarness(document.body, { reference: true, item });
	mounted.push(harness);
	resizeTo(sizedShellRoot(harness.leafEl), width, 900);
	await settleUntil(() => harness.leafEl.querySelector('.rp-plan-canvas') !== null, 'canvas');
	const canvas = harness.leafEl.querySelector<HTMLElement>('.rp-plan-canvas') as HTMLElement;
	placeAt(canvas, 0, 0, width, 900);
	resizeTo(canvas, width, 900);
	return { root: harness.leafEl, canvas };
}
const finishable = (root: HTMLElement) => root.querySelector('.rp-task-banner__finish')?.getAttribute('aria-disabled') === 'false';
const widthShown = (root: HTMLElement) => root.querySelector<HTMLInputElement>('input[name="object-width"]')?.value;

it.each([1280, 460])('draws a rectangle item through Add at %i px, in rectangle mode, with nothing left over it', async (width) => {
	const { root } = await mountAt('rectangle', width);
	await settleUntil(() => finishable(root), 'a drawn rectangle item');
	expect(root.querySelector('.rp-task-banner [data-rp-object-shape="rectangle"]')?.getAttribute('aria-pressed')).toBe('true');
	expect(widthShown(root)).not.toBe('');
	expect(root.querySelector('.rp-add-menu')).toBeNull();
	expect(root.querySelector('.rp-editor-shell')?.querySelector('.rp-inspector-drawer:not([style*="display: none"])')).toBeNull();
});

it.each([['drag', true], ['rectangle', false]] as const)('with &item=%s a later move resizes the rectangle: %s', async (item, held) => {
	const { root, canvas } = await mountAt(item);
	await settleUntil(() => finishable(root), 'a drawn rectangle item');
	const before = widthShown(root);
	canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, buttons: 1, clientX: 1100, clientY: 850 }));
	await settle();
	expect(widthShown(root) !== before).toBe(held);
});

it.each([1280, 460])('opens New asset from Add to asset library on the seeded Cabinet at %i px, with its outline', async (width) => {
	const { root } = await mountAt('promote', width);
	await settleUntil(() => root.querySelector('.rp-new-asset__outline') !== null, 'the New asset dialog');
	expect(root.querySelector('.rp-new-asset__outline')?.textContent).toContain('2000 × 1000');
	expect(root.querySelector<HTMLInputElement>('.rp-dialog-form [data-field="name"]')?.value).toBe('Cabinet');
	// At a sidebar's width the Layers overlay the row was pressed in is closed again, so it does not sit behind the dialog.
	expect(root.querySelector('.rp-overlay-panel__close')).toBeNull();
});

it('saves the vault-shaped item as a building element and leaves its placement, with no banner', async () => {
	const { root } = await mountAt('saved');
	await settleUntil(() => root.querySelector('.rp-element-inspector [data-rp-action="replace-asset"]') !== null || root.querySelector('.rp-form-banner') !== null, 'the promotion outcome');
	expect(root.querySelector('.rp-form-banner')).toBeNull();
	expect(root.querySelector('.rp-dialog-form')).toBeNull();
	expect(root.querySelector('.rp-element-inspector h3')?.textContent).toBe('Garden shed');
});

it('refuses a gesture it does not know, loudly, and reads an absent one as none', () => {
	const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
	expect(parseItemKnob(null)).toBeUndefined();
	expect(error).not.toHaveBeenCalled();
	expect(parseItemKnob('wiggle')).toBeUndefined();
	expect(error).toHaveBeenCalledWith(expect.stringContaining('wiggle'));
	expect(parseItemKnob('saved')).toBe('saved');
});
