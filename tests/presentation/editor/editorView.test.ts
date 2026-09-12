// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mountPlanEditorCanvas, settle } from '../../helpers/editor';
import { useEditorStore } from '../../../src/presentation/stores/EditorStore';
import { useWorkspaceStore } from '../../../src/presentation/stores/WorkspaceStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { DEFAULT_VIEWPORT, screenPoint } from '../../../src/presentation/editor/viewport/Viewport';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import { expectDefined, expectOk } from '../../helpers/domain';
import { defer } from '../../helpers/async';
import { ok } from '../../../src/core/result/Result';
import { EMPTY_STRUCTURE } from '../../../src/domain/spatial/Structure';
import { placementPoints } from '../../../src/domain/spatial/assetPlacement';
import { shapeFromDimensions } from '../../../src/domain/asset/AssetShape';
import type { AssetShapeAnswer } from '../../../src/presentation/read-models/assetShapes';
import { recorder as logger } from '../../helpers/logger';
import { editorViewPreferencesStore } from '../../../src/infrastructure/obsidian/plugin-data/editorViewPreferencesStore';

const kitchen = expectDefined(FIXTURE_ZONES[0], 'fixture Kitchen');
const press = (target: Element) => target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));

describe('native View controls', () => {
	it('shares floor/selection framing with canvas keys while preserving selection and reference extents', async () => {
		const h = await mountPlanEditorCanvas();
		try {
			const editor = useEditorStore(h.pinia), selection = useSelectionStore(h.pinia);
			expect(h.wrapper.get('[data-rp-view="selection"]').attributes('disabled')).toBeDefined();
			selection.select([kitchen.id as never]); await settle();
			await h.wrapper.get('[data-rp-view="selection"]').trigger('click');
			const selected = editor.viewport;
			editor.panByScreen(91, 13);
			h.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: '@', code: 'Digit2', shiftKey: true, bubbles: true }));
			expect(editor.viewport).toEqual(selected);
			editor.referencePoints = [{ x: -10000, y: -10000 }, { x: 15000, y: 15000 }]; await settle();
			await h.wrapper.get('[data-rp-view="floor"]').trigger('click');
			const floor = editor.viewport;
			expect(floor.zoom).toBeLessThan(selected.zoom);
			editor.panByScreen(50, 50);
			h.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
			expect(editor.viewport).toEqual(floor);
			useWorkspaceStore(h.pinia).toggleLayer('background'); await settle();
			await h.wrapper.get('[data-rp-view="floor"]').trigger('click');
			expect(editor.viewport.zoom).toBeGreaterThan(floor.zoom);
			expect(selection.selectedIds).toEqual([kitchen.id]);
		} finally { h.unmount(); }
	});

	it('zooms about the stage center and refuses camera or snap changes during a pan', async () => {
		const h = await mountPlanEditorCanvas();
		try {
			const editor = useEditorStore(h.pinia);
			const before = editor.viewport;
			await h.wrapper.get('[data-rp-view="zoom-in"]').trigger('click');
			expect(editor.viewport.zoom).toBeCloseTo(before.zoom * 1.25);
			await h.wrapper.get('[data-rp-view="zoom-out"]').trigger('click');
			expect(editor.viewport.zoom).toBeCloseTo(before.zoom);
			editor.beginPan(screenPoint(1, 1), 1);
			const held = editor.viewport;
			await h.wrapper.get('[data-rp-view="floor"]').trigger('click');
			await h.wrapper.get('[data-rp-view="zoom-in"]').trigger('click');
			await h.wrapper.get('[data-rp-view="snap"]').setValue(false);
			expect(editor.viewport).toBe(held); expect(editor.snappingEnabled).toBe(true);
			expect((h.wrapper.get('[data-rp-view="snap"]').element as HTMLInputElement).checked).toBe(true);
			editor.abandonPan(); await h.wrapper.get('[data-rp-view="snap"]').setValue(false);
			expect(h.wrapper.get('.rp-editor-measurements').text()).toContain('Snap off');
		} finally { h.unmount(); }
	});

	it('opens framed on the drawn items rather than at world 0,0', async () => {
		const h = await mountPlanEditorCanvas({ openingFit: true });
		try {
			const editor = useEditorStore(h.pinia);
			expect(editor.viewport).not.toEqual(DEFAULT_VIEWPORT);
			const framed = editor.viewport;
			await h.wrapper.get('[data-rp-view="floor"]').trigger('click');
			expect(editor.viewport).toEqual(framed);
		} finally { h.unmount(); }
	});

	it('waits for placed asset shapes before the opening fit, so it frames a real footprint rather than a placeholder', async () => {
		const shapes = defer<ReadonlyMap<string, AssetShapeAnswer>>();
		const structure = { ...EMPTY_STRUCTURE, elements: [{ id: 'placed-bench', kind: 'asset' as const, assetId: 'bench', points: placementPoints({ x: 0, y: 0 }, 0) }] };
		const h = await mountPlanEditorCanvas({ openingFit: true, queries: { ...fakeQueries(FIXTURE_PLAN, []), findZonesByPlan: () => Promise.resolve(ok({ zones: [], unreadable: 0, structure })), assetShapes: () => shapes.promise } });
		try {
			const editor = useEditorStore(h.pinia);
			expect(editor.viewport).toEqual(DEFAULT_VIEWPORT);
			shapes.resolve(new Map([['bench', { kind: 'placeable', name: 'Bench', shape: expectOk(shapeFromDimensions(12000, 600)), dimensions: { width: 12000, depth: 600 } }]]));
			await settle();
			const opened = editor.viewport;
			expect(opened).not.toEqual(DEFAULT_VIEWPORT);
			await h.wrapper.get('[data-rp-view="floor"]').trigger('click');
			expect(editor.viewport).toEqual(opened);
		} finally { h.unmount(); }
	});

	it('shares grid and snap choices with later plans, and one open leaf never restores another leaf’s older choice', async () => {
		let stored: unknown = null;
		const viewPreferences = editorViewPreferencesStore({ loadLocalStorage: () => stored, saveLocalStorage: (_key, data) => { stored = data; } }, 'editor-view', logger);
		const a = await mountPlanEditorCanvas({ viewPreferences }), b = await mountPlanEditorCanvas({ viewPreferences });
		try {
			await a.wrapper.get('[data-rp-view="grid"]').setValue(true);
			await b.wrapper.get('[data-rp-view="snap"]').setValue(false);
			expect(stored).toEqual({ gridVisible: true, snappingEnabled: false });
		} finally { a.unmount(); b.unmount(); }
		const next = await mountPlanEditorCanvas({ viewPreferences });
		try {
			expect(useWorkspaceStore(next.pinia).gridVisible).toBe(true);
			expect(useEditorStore(next.pinia).snappingEnabled).toBe(false);
			expect((next.wrapper.get('[data-rp-view="snap"]').element as HTMLInputElement).checked).toBe(false);
		} finally { next.unmount(); }
	});

	it('draws a camera-aligned grid, keeps preferences per leaf without a host store, and restores View focus on plain Escape', async () => {
		const h = await mountPlanEditorCanvas();
		try {
			const editor = useEditorStore(h.pinia), workspace = useWorkspaceStore(h.pinia);
			await h.wrapper.get('[data-rp-view="grid"]').setValue(true);
			expect(h.wrapper.get('.rp-editor-measurements').text()).toContain('Grid on');
			const original = h.wrapper.get('.rp-canvas-grid').attributes('style');
			editor.panByScreen(21, 31); await settle();
			expect(h.wrapper.get('.rp-canvas-grid').attributes('style')).not.toBe(original);
			const menu = h.wrapper.get('.rp-view-menu'), details = menu.element as HTMLDetailsElement;
			details.open = true;
			await menu.trigger('keydown', { key: 'Escape', altKey: true }); expect(details.open).toBe(true);
			await menu.trigger('keydown', { key: 'Escape' }); expect(details.open).toBe(false);
			expect(document.activeElement).toBe(menu.get('summary').element);
			const other = await mountPlanEditorCanvas();
			try { expect(useWorkspaceStore(other.pinia).gridVisible).toBe(false); } finally { other.unmount(); }
			workspace.reset(); editor.reset(); await settle();
			expect(h.wrapper.find('.rp-canvas-grid').exists()).toBe(false);
			expect(editor.referencePoints).toEqual([]); expect(editor.snappingEnabled).toBe(true);
		} finally { h.unmount(); }
	});

	it('closes the View menu on a press outside it, keeps it open for a press inside, and stops listening once unmounted', async () => {
		const h = await mountPlanEditorCanvas();
		try {
			const details = h.wrapper.get('.rp-view-menu').element as HTMLDetailsElement;
			press(h.canvasEl);
			expect(details.open).toBe(false);
			details.open = true;
			press(h.wrapper.get('[data-rp-view="grid"]').element);
			expect(details.open).toBe(true);
			press(h.canvasEl);
			expect(details.open).toBe(false);
		} finally {
			const removed = vi.spyOn(document, 'removeEventListener');
			h.unmount();
			expect(removed).toHaveBeenCalledWith('pointerdown', expect.any(Function), { capture: true });
			removed.mockRestore();
		}
	});

	it('keeps an empty floor camera unchanged and disables fit actions until content exists', async () => {
		const h = await mountPlanEditorCanvas({ zones: [] });
		try {
			const editor = useEditorStore(h.pinia), before = editor.viewport;
			expect(h.wrapper.get('[data-rp-view="floor"]').attributes('disabled')).toBeDefined();
			h.canvasEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
			expect(editor.viewport).toBe(before);
			editor.referencePoints = [{ x: 0, y: 0 }, { x: 4000, y: 3000 }]; await settle();
			expect(h.wrapper.get('[data-rp-view="floor"]').attributes('disabled')).toBeUndefined();
			await h.wrapper.get('[data-rp-view="floor"]').trigger('click'); expect(editor.viewport).not.toBe(before);
		} finally { h.unmount(); }
	});

	it('leaves host Find, composition, repeated keys and native inputs untouched', async () => {
		const h = await mountPlanEditorCanvas();
		try {
			const editor = useEditorStore(h.pinia), before = editor.viewport;
			for (const modifiers of [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { isComposing: true }, { repeat: true }]) {
				const event = new KeyboardEvent('keydown', { key: 'f', bubbles: true, cancelable: true, ...modifiers });
				h.canvasEl.dispatchEvent(event); expect(event.defaultPrevented).toBe(false);
			}
			const input = document.createElement('input'); h.canvasEl.append(input);
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
			input.remove(); expect(editor.viewport).toBe(before);
		} finally { h.unmount(); }
	});
});
