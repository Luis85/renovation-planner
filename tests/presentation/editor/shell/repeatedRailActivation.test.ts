// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { mountPlanEditorCanvas, runtimeOf, settle, type EditorHarness } from '../../../helpers/editor';
import { resizeTo } from '../../../helpers/layout';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useWorkspaceStore } from '../../../../src/presentation/stores/WorkspaceStore';

let harness: EditorHarness | undefined;
afterEach(() => { harness?.unmount(); });

describe('repeated explicit rail activation', () => {
	it.each([
		['layers', '.rp-overlay-panel'], ['details', '.rp-inspector-drawer'],
	])('moves focus into the already open %s panel so Escape closes it without clearing selection', async (rail, selector) => {
		harness = await mountPlanEditorCanvas();
		const runtime = runtimeOf(harness); runtime.selectAndFrame('zone-kitchen'); await settle();
		resizeTo(harness.rootEl, 460, 800); await settle();
		const selected = [...useSelectionStore(harness.pinia).selectedIds]; expect(selected).not.toHaveLength(0);
		const button = harness.wrapper.get<HTMLButtonElement>(`[data-rp-rail="${rail}"]`);
		for (let activation = 0; activation < 2; activation++) {
			button.element.focus(); button.element.click(); await settle();
			expect(button.attributes('aria-expanded')).toBe('true');
			expect(harness.wrapper.get(selector).element.contains(document.activeElement)).toBe(true);
		}
		document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(useWorkspaceStore(harness.pinia).overlay).toBe('none');
		expect(document.activeElement).toBe(button.element);
		expect([...useSelectionStore(harness.pinia).selectedIds]).toEqual(selected);
	});
	it('leaves focus with the persistent region if reflow retires an explicit rail opening before its focus step', async () => {
		harness = await mountPlanEditorCanvas();
		resizeTo(harness.rootEl, 460, 800); await settle();
		const button = harness.wrapper.get<HTMLButtonElement>('[data-rp-rail="details"]');
		button.element.focus(); button.element.click();
		resizeTo(harness.rootEl, 1280, 800); await settle();
		expect(useWorkspaceStore(harness.pinia).layoutMode).toBe('full');
		expect(document.activeElement).toBe(harness.wrapper.get('[data-rp-region="inspector"]').element);
	});
});
