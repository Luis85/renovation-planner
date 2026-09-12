// @vitest-environment jsdom
/**
 * The full layout's side panels (2026-09-12 side panels spec §1), driven through the REAL mounted
 * editor: collapse and expand with their focus moves, the strip's section buttons, the resize
 * handle wired to `WorkspaceStore` and per-device storage, the canvas floor, and M16's constrained
 * overlay left as it was.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditor, settle, type EditorHarness } from '../../../helpers/editor';
import { memoryDeviceStorage } from '../../../helpers/deviceStorage';
import { resizeTo } from '../../../helpers/layout';
import { pointer } from '../../../helpers/planEditorRig';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';

let open: EditorHarness | null = null;
afterEach(() => { open?.unmount(); open = null; });

async function mounted(storage = memoryDeviceStorage()): Promise<{ harness: EditorHarness; storage: ReturnType<typeof memoryDeviceStorage> }> {
	open = await mountPlanEditor({ panelLayout: storage });
	return { harness: open, storage };
}

function lastWrite(storage: ReturnType<typeof memoryDeviceStorage>): unknown {
	return storage.writes[storage.writes.length - 1];
}

describe('full-layout side panels', () => {
	it('collapses from the header to a strip, hides the content and hands focus to the strip', async () => {
		const { harness, storage } = await mounted();
		const toggle = harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]');
		expect(toggle.attributes('aria-expanded')).toBe('true');
		(toggle.element as HTMLElement).focus();
		await toggle.trigger('click');
		await settle();

		expect(harness.wrapper.get('[data-rp-region="layers"]').isVisible()).toBe(false);
		const expand = harness.wrapper.get('[data-rp-strip="layers"] [data-rp-panel-toggle="layers"]');
		expect(expand.attributes('aria-expanded')).toBe('false');
		expect(document.activeElement).toBe(expand.element);
		expect(harness.wrapper.findAll('[data-rp-strip="layers"] [data-rp-strip-section]')).toHaveLength(4);
		expect(lastWrite(storage)).toMatchObject({ layers: { collapsed: true } });
	});

	it('expands from the strip back to the header toggle', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click');
		await settle();
		await harness.wrapper.get('[data-rp-strip="inspector"] [data-rp-panel-toggle="inspector"]').trigger('click');
		await settle();

		expect(harness.wrapper.get('[data-rp-region="inspector"]').isVisible()).toBe(true);
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').element);
	});

	it('expands to the header toggle from a section button whose section does not exist yet', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').trigger('click');
		await settle();
		await harness.wrapper.get('[data-rp-strip-section="details"]').trigger('click');
		await settle();
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="inspector"]').element);
	});

	it('leaves focus where it was when the collapse click came from outside the panel', async () => {
		const { harness } = await mounted();
		(document.body as HTMLElement).focus();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
		await settle();
		expect(document.activeElement).toBe(document.body);
	});

	it('resizes from the keyboard into the store and storage, and resets on double-click', async () => {
		const { harness, storage } = await mounted();
		const handle = harness.wrapper.get('[data-rp-resizer="layers"]');
		await handle.trigger('keydown', { key: 'ArrowRight', shiftKey: true });
		await settle();

		expect(useWorkspaceStore(harness.pinia).panelLayout.layers.width).toBe(320);
		expect(handle.attributes('aria-valuenow')).toBe('320');
		expect(lastWrite(storage)).toMatchObject({ layers: { width: 320, collapsed: false } });

		await handle.trigger('dblclick');
		await settle();
		expect(handle.attributes('aria-valuenow')).toBe('256');
		expect(lastWrite(storage)).toMatchObject({ layers: { width: 256 } });
	});

	it('collapses from the resize handle with Enter', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('[data-rp-resizer="inspector"]').trigger('keydown', { key: 'Enter' });
		await settle();
		expect(harness.wrapper.find('[data-rp-strip="inspector"]').exists()).toBe(true);
	});

	it('mounts at a stored layout, and at the defaults over a malformed one', async () => {
		const stored = memoryDeviceStorage({ layers: { width: 300, collapsed: false }, inspector: { width: 400, collapsed: true } });
		const { harness } = await mounted(stored);
		expect(harness.wrapper.get('[data-rp-resizer="layers"]').attributes('aria-valuenow')).toBe('300');
		expect(harness.wrapper.find('[data-rp-strip="inspector"]').exists()).toBe(true);
		harness.unmount();
		open = null;

		const garbage = await mounted(memoryDeviceStorage('wide'));
		expect(garbage.harness.wrapper.get('[data-rp-resizer="layers"]').attributes('aria-valuenow')).toBe('256');
	});

	it('shrinks the panels to keep the canvas floor without rewriting the stored widths', async () => {
		const { harness, storage } = await mounted();
		resizeTo(harness.rootEl, 900, 800);
		await settle();

		expect(harness.wrapper.get('[data-rp-resizer="layers"]').attributes('aria-valuenow')).toBe('244');
		expect(harness.wrapper.get('[data-rp-resizer="inspector"]').attributes('aria-valuenow')).toBe('335');
		expect(useWorkspaceStore(harness.pinia).panelLayout.layers.width).toBe(256);
		expect(storage.writes).toHaveLength(0);
	});

	/**
	 * The handle announced the shrunk width against a maximum computed from the other panel's
	 * STORED width, so at 900px its value sat above its own maximum and ArrowRight clamped it down.
	 */
	it.each([
		['the defaults at 900px', null, 900],
		['stored widths 400/520 at 1100px', { layers: { width: 400, collapsed: false }, inspector: { width: 520, collapsed: false } }, 1100],
	])('keeps each handle\'s value inside its range, and a grow key never lowers it, with %s', async (_what, stored, shell) => {
		const { harness } = await mounted(memoryDeviceStorage(stored));
		resizeTo(harness.rootEl, shell, 800);
		await settle();

		for (const [side, grow, shrink] of [['layers', 'ArrowRight', 'ArrowLeft'], ['inspector', 'ArrowLeft', 'ArrowRight']] as const) {
			const handle = harness.wrapper.get(`[data-rp-resizer="${side}"]`);
			const value = (name: string): number => Number(handle.attributes(name));
			expect(value('aria-valuemin')).toBeLessThanOrEqual(value('aria-valuenow'));
			expect(value('aria-valuenow')).toBeLessThanOrEqual(value('aria-valuemax'));
			const before = value('aria-valuenow');

			await handle.trigger('keydown', { key: grow });
			await settle();
			expect(value('aria-valuenow')).toBeGreaterThanOrEqual(before);

			await handle.trigger('keydown', { key: shrink });
			await settle();
			expect(value('aria-valuenow')).toBeLessThanOrEqual(before);
		}
	});

	it('writes storage once for a drag, on release, and a drag back returns to where it started', async () => {
		const { harness, storage } = await mounted();
		resizeTo(harness.rootEl, 900, 800);
		await settle();
		const handle = harness.wrapper.get('[data-rp-resizer="layers"]').element as HTMLElement;

		pointer(handle, 'pointerdown', 500, 10);
		pointer(handle, 'pointermove', 470, 10);
		await settle();
		expect(useWorkspaceStore(harness.pinia).panelLayout.layers.width).toBe(226);
		pointer(handle, 'pointermove', 490, 10);
		pointer(handle, 'pointermove', 530, 10);
		await settle();
		expect(storage.writes).toHaveLength(0);

		pointer(handle, 'pointerup', 530, 10);
		await settle();
		expect(storage.writes).toHaveLength(1);
		expect(lastWrite(storage)).toMatchObject({ layers: { width: 256 } });
		expect(handle.getAttribute('aria-valuenow')).toBe('244');
	});

	it('binds no panel width on the body until the shell has a width to measure', async () => {
		const { harness } = await mounted();
		resizeTo(harness.rootEl, 0, 800);
		await settle();
		expect((harness.wrapper.get('.rp-editor-body').element as HTMLElement).style.getPropertyValue('--rp-layers-width')).toBe('');
	});

	it('leaves the constrained overlay usable for a panel collapsed in the full layout', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
		await settle();
		resizeTo(harness.rootEl, 460, 800);
		await settle();

		expect(harness.wrapper.find('.rp-side-panel__strip').exists()).toBe(false);
		await harness.wrapper.get('button[data-rp-rail="layers"]').trigger('click');
		await settle();
		expect(harness.wrapper.get('.rp-overlay-panel .rp-layer-list').isVisible()).toBe(true);
	});

	/**
	 * Widening hides the body of a panel collapsed in the full layout, and with it the control the
	 * open overlay had focused; the region `restoreFocus` used to target is inside that hidden body
	 * and contains the focus, so nothing moved it and a browser dropped it to `<body>`. The strip
	 * stands in for the region, the same way a collapse hands focus to it.
	 */
	it.each([['layers', 'layers'], ['inspector', 'details']])('widening to full with the %s overlay focused hands focus to that collapsed panel\'s strip', async (side, rail) => {
		const { harness } = await mounted();
		await harness.wrapper.get(`.rp-side-panel__toggle[data-rp-panel-toggle="${side}"]`).trigger('click');
		await settle();
		resizeTo(harness.rootEl, 460, 800);
		await settle();
		await harness.wrapper.get(`button[data-rp-rail="${rail}"]`).trigger('click');
		await settle();
		(harness.wrapper.get(`[data-rp-region="${side}"]`).get('input:not(:disabled), button').element as HTMLElement).focus();

		resizeTo(harness.rootEl, 1280, 800);
		await settle();

		expect(document.activeElement).toBe(harness.wrapper.get(`[data-rp-strip="${side}"] [data-rp-panel-toggle="${side}"]`).element);
	});

	it('opens exactly the section a strip button names and focuses its summary', async () => {
		const { harness } = await mounted();
		await harness.wrapper.get('.rp-side-panel__toggle[data-rp-panel-toggle="layers"]').trigger('click');
		await settle();
		expect(harness.wrapper.get('.rp-property-elements').attributes('open')).toBeUndefined();

		await harness.wrapper.get('[data-rp-strip-section="elements"]').trigger('click');
		await settle();

		const elements = harness.wrapper.get('[data-rp-section="elements"]');
		expect(elements.attributes('open')).toBeDefined();
		expect(harness.wrapper.get('.rp-property-context').attributes('open')).toBeDefined();
		expect(document.activeElement).toBe(elements.get('summary').element);
	});
});
