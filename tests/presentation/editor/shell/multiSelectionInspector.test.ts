// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { useSelectionStore } from '../../../../src/presentation/editor/selection/selection-store';
import { useEditorStore } from '../../../../src/presentation/stores/EditorStore';
import { useProjectStore } from '../../../../src/presentation/stores/ProjectStore';
import { mountPlanEditorCanvas, runtimeOf, settle, type CanvasHarness } from '../../../helpers/editor';
import { resizeTo } from '../../../helpers/layout';
import { click } from '../../../helpers/planEditorRig';
import axe from 'axe-core';
import { runOptions } from '../../../harness/axeOptions';

let harness: CanvasHarness | null = null;
afterEach(() => { harness?.unmount(); harness = null; });

describe('Editor selection across the list, canvas and Inspector', () => {
	it.each([
		{ selector: '[data-rp-id="zone-terrace"]', multiple: false },
		{ selector: '[data-rp-id="zone-terrace"]', multiple: true },
		{ selector: '[data-rp-action="multiple-selection"]', multiple: false },
		{ selector: '[data-rp-action="multiple-selection"]', multiple: true },
	])('clears from $selector with multiple=$multiple and keeps focus there', async ({ selector, multiple }) => {
		harness = await mountPlanEditorCanvas();
		const panel = harness.wrapper.find('.rp-editor-layers');
		await panel.find('[data-rp-action="multiple-selection"]').setValue(multiple);
		await panel.find('[data-rp-id="zone-kitchen"]').trigger('click');
		await panel.find('[data-rp-id="zone-terrace"]').trigger('click');
		await settle();
		expect(useSelectionStore().selectedIds).toHaveLength(multiple ? 2 : 1);
		const control = panel.get(selector).element as HTMLElement;
		control.focus();
		const consumed = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
		consumed.preventDefault();
		control.dispatchEvent(consumed);
		expect(useSelectionStore().selectedIds).toHaveLength(multiple ? 2 : 1);
		control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(useSelectionStore().selectedIds).toEqual([]);
		expect(harness.wrapper.find('.rp-floor-inspector').exists()).toBe(true);
		expect(document.activeElement).toBe(control);
	});
	it.each([['details', 1], ['details', 2], ['layers', 1], ['layers', 2]] as const)('closes the %s overlay first, then clears %i selected elements from restored rail focus', async (rail, count) => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen', 'zone-terrace'].slice(0, count) as never[]);
		resizeTo(harness.rootEl, 700, 700);
		await settle();
		const button = harness.wrapper.find(`[data-rp-rail="${rail}"]`);
		await button.trigger('click');
		await settle();
		document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(document.activeElement).toBe(button.element);
		expect(harness.wrapper.find('.rp-inspector-drawer, .rp-overlay-panel').exists()).toBe(false);
		expect(useSelectionStore().selectedIds).toHaveLength(count);
		await button.trigger('keydown', { key: 'Escape', repeat: true });
		expect(useSelectionStore().selectedIds).toHaveLength(count);
		await button.trigger('keydown', { key: 'Escape' });
		await settle();
		expect(useSelectionStore().selectedIds).toEqual([]);
		expect(document.activeElement).toBe(button.element);
	});
	it('clears a single selection from the Inspector and retains region focus', async () => {
		harness = await mountPlanEditorCanvas();
		await harness.wrapper.find('.rp-editor-layers [data-rp-id="zone-kitchen"]').trigger('click');
		await settle();
		const inspector = harness.wrapper.find('[data-rp-region="inspector"]');
		(inspector.element as HTMLElement).focus();
		await inspector.trigger('keydown', { key: 'Escape' });
		await settle();
		expect(useSelectionStore().selectedIds).toEqual([]);
		expect(harness.wrapper.find('.rp-floor-inspector').exists()).toBe(true);
		expect(document.activeElement).toBe(inspector.element);
	});
	it('does not process a canvas Escape twice when it returns an empty tool to Select', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen', 'zone-terrace'] as never[]);
		runtimeOf(harness).setTool('draw-polygon');
		await settle();
		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(useEditorStore().activeToolId).toBe('select');
		expect(useSelectionStore().selectedIds).toHaveLength(2);
		harness.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(useSelectionStore().selectedIds).toEqual([]);
	});
	it('keeps draft and tool cancellation ahead of selection clearing from the property list', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen', 'zone-terrace'] as never[]);
		const runtime = runtimeOf(harness);
		runtime.setTool('draw-polygon');
		await settle();
		click(harness.canvasEl, 100, 100);
		expect(runtime.toolManager.activeToolHasDraft()).toBe(true);
		const row = harness.wrapper.find('.rp-editor-layers [data-rp-id="zone-kitchen"]');
		(row.element as HTMLElement).focus();
		await row.trigger('keydown', { key: 'Escape' });
		expect(runtime.toolManager.activeToolHasDraft()).toBe(false);
		expect(runtime.activeToolId.value).toBe('draw-polygon');
		expect(useSelectionStore().selectedIds).toHaveLength(2);
		await row.trigger('keydown', { key: 'Escape' });
		expect(runtime.activeToolId.value).toBe('select');
		expect(useSelectionStore().selectedIds).toHaveLength(2);
		await row.trigger('keydown', { key: 'Escape' });
		expect(useSelectionStore().selectedIds).toEqual([]);
	});
	it('keeps multiple-selection mode across the constrained Layers overlay closing and reopening', async () => {
		// The overlay UNMOUNTS `PropertyLayerPanel` when it closes, so a component-local mode
		// was recreated `false` on every reopen: a touch or keyboard user who enabled it,
		// went to the canvas and came back to add a room had the next row click replace the
		// whole set. The mode is per-leaf state on the runtime now, like the tool.
		harness = await mountPlanEditorCanvas();
		resizeTo(harness.rootEl, 700, 700);
		await settle();
		const rail = harness.wrapper.find('[data-rp-rail="layers"]');
		await rail.trigger('click');
		await settle();
		await harness.wrapper.find('.rp-overlay-panel [data-rp-action="multiple-selection"]').setValue(true);
		await harness.wrapper.find('.rp-overlay-panel [data-rp-id="zone-kitchen"]').trigger('click');
		await settle();
		document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
		await settle();
		expect(harness.wrapper.find('.rp-overlay-panel').exists()).toBe(false);
		await rail.trigger('click');
		await settle();
		const mode = harness.wrapper.find('.rp-overlay-panel [data-rp-action="multiple-selection"]');
		expect((mode.element as HTMLInputElement).checked).toBe(true);
		await harness.wrapper.find('.rp-overlay-panel [data-rp-id="zone-terrace"]').trigger('click');
		await settle();
		expect(useSelectionStore().selectedIds).toEqual(['zone-kitchen', 'zone-terrace']);
	});
	it('closes Add before clearing a multi-selection', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen', 'zone-terrace'] as never[]);
		await harness.wrapper.find('[data-rp-action="add"]').trigger('click');
		await settle();
		await harness.wrapper.find('.rp-add-menu button').trigger('keydown', { key: 'Escape' });
		await settle();
		expect(harness.wrapper.find('.rp-add-menu').exists()).toBe(false);
		expect(useSelectionStore().selectedIds).toHaveLength(2);
	});
	it('labels unavailable members rather than showing a complete aggregate over a subset', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['gone', 'zone-kitchen'] as never[]);
		await settle();
		const multiple = harness.wrapper.find('.rp-multi-selection');
		expect(multiple.text()).toContain('Unavailable selected elements: 1');
		expect(multiple.find('.rp-room-list__row').text()).toBe('2. Kitchen');
		useSelectionStore().select(['gone', 'also-gone'] as never[]);
		await settle();
		expect(multiple.text()).toContain('Unavailable selected elements: 2');
		expect(multiple.find('dl').text()).not.toContain('0.00');
	});
	it('keeps the list reachable after selecting, supports multi-selection without modifiers and preserves the camera', async () => {
		harness = await mountPlanEditorCanvas();
		const wrapper = harness.wrapper;
		const panel = wrapper.find('.rp-editor-layers');
		await panel.find('[data-rp-id="zone-kitchen"]').trigger('click');
		await settle();
		expect(wrapper.find('.rp-room-inspector').attributes('data-rp-id')).toBe('zone-kitchen');
		expect(panel.find('[data-rp-id="zone-kitchen"]').attributes('aria-pressed')).toBe('true');
		const viewport = { ...useEditorStore().viewport };
		await panel.find('input[data-rp-action="multiple-selection"]').setValue(true);
		await panel.find('[data-rp-id="zone-terrace"]').trigger('click');
		await settle();
		expect(useSelectionStore().selectedIds).toEqual(['zone-kitchen', 'zone-terrace']);
		expect(useEditorStore().viewport).toEqual(viewport);
		expect(harness.stage.find('.selection-outline')).toHaveLength(2);
		const multiple = wrapper.find('.rp-multi-selection');
		expect(multiple.text()).toContain('Overlapping areas are counted separately.');
		expect(multiple.text()).toContain('Different types');
		expect(multiple.findAll('.rp-room-list__row')).toHaveLength(2);
		await multiple.find('button').trigger('click');
		await settle();
		expect(useSelectionStore().selectedIds).toEqual(['zone-kitchen', 'zone-terrace']);
		expect(useSelectionStore().focusedId).toBe('zone-kitchen');
		expect(harness.stage.find('.selection-badge')).toHaveLength(2);
		expect((await axe.run(wrapper.element as HTMLElement, runOptions)).violations).toEqual([]);
	});

	it('survives constrained layout and clears back to the floor with no persisted mutation', async () => {
		harness = await mountPlanEditorCanvas();
		useSelectionStore().select(['zone-kitchen' as never, 'zone-terrace' as never]);
		await settle();
		const before = [...useProjectStore().zones.values()];
		const viewport = { ...useEditorStore().viewport };
		resizeTo(harness.rootEl, 700, 700);
		await settle();
		await harness.wrapper.find('[data-rp-rail="details"]').trigger('click');
		await settle();
		await harness.wrapper.find('.rp-multi-selection button').trigger('keydown', { key: 'Escape' });
		await settle();
		expect(harness.wrapper.find('.rp-inspector-drawer').exists()).toBe(false);
		expect(useSelectionStore().selectedIds).toHaveLength(2);
		expect(useEditorStore().viewport).toEqual(viewport);
		resizeTo(harness.rootEl, 1400, 700);
		await settle();
		const buttons = harness.wrapper.find('.rp-multi-selection').findAll('button');
		await buttons[buttons.length - 1].trigger('click');
		await settle();
		expect(harness.wrapper.find('.rp-floor-inspector').exists()).toBe(true);
		expect(harness.stage.find('.selection-outline')).toHaveLength(0);
		expect([...useProjectStore().zones.values()]).toEqual(before);
	});

	it('derives a shared type, updates after record removal and ignores a no-longer-readable ID', async () => {
		harness = await mountPlanEditorCanvas();
		const project = useProjectStore();
		project.zones = new Map([...project.zones].map(([id, zone]) => [id, { ...zone, zoneType: 'Room' }]));
		useSelectionStore().select(['zone-kitchen' as never, 'zone-terrace' as never]);
		await settle();
		expect(harness.wrapper.find('.rp-multi-selection').text()).toContain('Room');
		await harness.wrapper.find('.rp-multi-selection button').trigger('keydown', { key: 'Escape' });
		await settle();
		expect(useSelectionStore().selectedIds).toEqual([]);
		expect(document.activeElement).toBe(harness.wrapper.find('[data-rp-region="inspector"]').element);
		project.zones = new Map();
		await settle();
		expect(harness.wrapper.find('.rp-floor-inspector').exists()).toBe(true);
	});
});
