/**
 * @vitest-environment jsdom
 *
 * Task 9 widened `EditorSurface`'s Escape branch from an unconditional `cancelGesture()` to
 * `routeEscape` — and this surface is the asset designer's too (`DesignerCanvas.vue` mounts the
 * same component `PlanCanvas.vue` does). The designer registers no `select` tool at all
 * (`registerDesignerTools` names `trace-footprint`, `trace-clearance`, `set-anchor`,
 * `set-facing` and `calibrate`), so `routeEscape`'s `returned-to-select` arm — which always asks
 * for `'select'` — would throw `no tool is registered for id 'select'` the first time a user
 * pressed Escape over a tool with nothing drawn. `DesignerCanvas.vue`'s `escapeSetTool` is the
 * wiring that answers for that: it substitutes camera mode (`null`, this surface's own neutral
 * state — see that file's header) for the id `routeEscape` never learns is unavailable here.
 */
import { describe, expect, it } from 'vitest';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { designerRig } from '../../helpers/designerRig';

function key(canvas: HTMLElement, init: KeyboardEventInit): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
}

describe('Escape on the asset designer surface', () => {
	it('returns an empty gesture to camera mode rather than throwing for a missing Select tool', async () => {
		const rig = await designerRig();
		rig.toolbarButton('Set anchor').click();
		expect(rig.activeToolId()).toBe('set-anchor');

		expect(() => key(rig.canvasEl, { key: 'Escape' })).not.toThrow();

		expect(rig.activeToolId()).toBeNull();
		rig.unmount();
	});

	it('clears a selection in camera mode, the same as the Plan Editor', async () => {
		const rig = await designerRig();
		useSelectionStore(rig.pinia).select(['zone-a' as never]);

		key(rig.canvasEl, { key: 'Escape' });

		expect(useSelectionStore(rig.pinia).selectedIds).toEqual([]);
		rig.unmount();
	});
});
