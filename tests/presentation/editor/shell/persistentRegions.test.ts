// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settle, type EditorHarness } from '../../../helpers/editor';
import { resizeTo } from '../../../helpers/layout';

let open: EditorHarness | null = null;
afterEach(() => { open?.unmount(); open = null; });

async function resize(harness: EditorHarness, width: number): Promise<void> {
	resizeTo(harness.rootEl, width, 800);
	await settle();
}

describe('persistent editor regions', () => {
	it.each(['4.2', '-'])('keeps the exact native dimension input, pending text %s, focus and selection through shrink and growth', async text => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-room'); await settle();
		const field = harness.wrapper.get('input[name="width"]');
		const input = field.element as HTMLInputElement;
		input.focus(); await field.setValue(text); input.setSelectionRange(0, 1);
		for (const width of [460, 1000, 720, 1280]) {
			await resize(harness, width);
			expect(harness.wrapper.get('input[name="width"]').element).toBe(input);
			expect(document.activeElement).toBe(input);
			expect(input.value).toBe(text);
			expect([input.selectionStart, input.selectionEnd]).toEqual([0, 1]);
			expect(runtime.roomDraft.widthText).toBe(''); // Resize must not blur/commit a pending edit.
			expect(harness.rootEl.querySelector('[data-rp-rail="details"]')?.getAttribute('aria-expanded')).toBe(width < 900 ? 'true' : undefined);
		}
	});

	it('opens the focused Layers region on shrink and preserves its checkbox node through close and reopen', async () => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		const input = harness.wrapper.get('[data-rp-region="layers"] input:not(:disabled)').element as HTMLInputElement;
		input.focus();
		await resize(harness, 460);
		expect(harness.wrapper.get('[data-rp-rail="layers"]').attributes('aria-expanded')).toBe('true');
		expect(document.activeElement).toBe(input);
		await harness.wrapper.get('[data-rp-rail="details"]').trigger('click'); await settle();
		expect(harness.wrapper.get('[data-rp-region="layers"]').isVisible()).toBe(false);
		await harness.wrapper.get('[data-rp-rail="layers"]').trigger('click'); await settle();
		expect(harness.wrapper.get('[data-rp-region="layers"] input:not(:disabled)').element).toBe(input);
		expect(harness.wrapper.get('[data-rp-region="inspector"]').isVisible()).toBe(false);
	});

	it('does not take focus from the canvas when an open overlay becomes a column', async () => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		await resize(harness, 460);
		await harness.wrapper.get('[data-rp-rail="details"]').trigger('click'); await settle();
		harness.canvasEl.focus();
		await resize(harness, 1280);
		expect(document.activeElement).toBe(harness.canvasEl);
	});

	it.each([
		['.rp-overlay-panel__close', 'layers', 'layers'],
		['.rp-inspector-drawer__close', 'details', 'inspector'],
		['[data-rp-rail="layers"]', 'layers', 'layers'],
		['[data-rp-rail="details"]', 'details', 'inspector'],
	])('falls back to the matching region when focused %s disappears on growth', async (control, rail, region) => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		await resize(harness, 460);
		await harness.wrapper.get(`[data-rp-rail="${rail}"]`).trigger('click'); await settle();
		(harness.wrapper.get(control).element as HTMLElement).focus();
		await resize(harness, 1280);
		expect(document.activeElement).toBe(harness.wrapper.get(`[data-rp-region="${region}"]`).element);
	});

	it('hands focus to the unsupported-width action and back to the canvas when that action disappears', async () => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		harness.canvasEl.focus();
		await resize(harness, 320);
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-unsupported-width__action').element);
		await resize(harness, 460);
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-plan-canvas').element);
	});

	it('does not override a newer focus choice while a resize is waiting to render', async () => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		await resize(harness, 460);
		await harness.wrapper.get('[data-rp-rail="details"]').trigger('click'); await settle();
		resizeTo(harness.rootEl, 1280, 800);
		harness.canvasEl.focus();
		await settle();
		expect(document.activeElement).toBe(harness.canvasEl);
	});

	it('ignores an obsolete resize focus handoff and a handoff queued before disposal', async () => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		await resize(harness, 460);
		await harness.wrapper.get('[data-rp-rail="details"]').trigger('click'); await settle();
		resizeTo(harness.rootEl, 1280, 800);
		resizeTo(harness.rootEl, 320, 800);
		await settle();
		expect(document.activeElement).toBe(harness.wrapper.get('.rp-unsupported-width__action').element);
		resizeTo(harness.rootEl, 1280, 800);
		harness.unmount(); open = null;
		await settle();
		expect(document.activeElement).toBe(document.body);
	});

	it('does not consume Escape in a full-width region', async () => {
		const harness = await mountPlanEditorCanvas(); open = harness;
		const region = harness.wrapper.get('[data-rp-region="inspector"]').element;
		const received: string[] = [];
		harness.rootEl.addEventListener('keydown', event => received.push(event.key));
		region.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		expect(received).toEqual(['Escape']);
	});
});
