import type { Ref } from 'vue';
import type { ToolManager } from './tool-manager';
import type { ToolId } from './editor-tool';

/**
 * Switching a leaf's tool, and keeping the reactive mirror of it honest — ONE function, shared
 * by both editing surfaces.
 *
 * **The mirror exists because `ToolManager` is framework-pure.** It holds a plain pointer to
 * the active tool and knows nothing about Vue, which is what lets tools be driven by node
 * tests with no component around them. A Vue consumer — a toolbar's pressed state, a canvas's
 * cursor class, a status bar's Shift hint — needs a `Ref`, so exactly one mirror is kept at
 * this seam and this is its only writer. The Plan Editor once had THREE copies of the active
 * tool id hand-synced at this point, which is two chances to drift where the drift is
 * invisible.
 *
 * **`null` is camera mode, and it CLEARS rather than activating anything.** The camera is
 * ephemeral UI (SDD §15) and never a command, so "no active tool" is what pans and zooms —
 * there is no `PanTool` on either surface for `null` to select.
 *
 * **The mirror is written AFTER the manager, which is the part two copies would lose.**
 * `setActiveTool` throws for an id nothing registered — a wiring mistake, and the one thing
 * standing between a toolbar offering a tool the registration forgot and a leaf that silently
 * reports it active anyway. Writing the mirror first would record a switch that did not
 * happen; writing it after means a failed switch leaves the surface showing the tool it really
 * has. `designerToolbar.test.ts` rests on exactly that ordering.
 *
 * It became shared when the asset designer got its own tool framework (design slice B5) and
 * `npm run analyze` reported the two runtimes as a clone family — correctly: the rule above is
 * a property of `ToolManager` and of the mirror, and nothing either leaf knows about its own
 * subject.
 */
export function createToolSwitch(
	toolManager: ToolManager,
	activeToolId: Ref<ToolId | null>,
): (id: ToolId | null) => void {
	return (id) => {
		if (id === null) {
			toolManager.clearActiveTool();
		} else {
			toolManager.setActiveTool(id);
		}
		activeToolId.value = id;
	};
}
