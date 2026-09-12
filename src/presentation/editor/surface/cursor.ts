import type { PanPhase } from '../viewport/pan-override';
import type { ToolId } from '../tools/editor-tool';

/**
 * Tools whose click places a point at an exact spot, and which therefore want a crosshair
 * rather than an arrow. A LIST rather than a `tool.cursor` member on `EditorTool`, because
 * the alternative widens the tool interface every implementation must satisfy for the sake
 * of a presentational detail three of them care about — and `ToolManager`'s own contract is
 * that the framework knows no tool by name, which this file is not part of.
 *
 * **`draw-room` is on it and is deliberately NOT on `CONSTRAINING_TOOLS`, which is a
 * different question with a different answer** — said here because two lists over the same
 * ids, one naming a tool and the other not, otherwise reads as one of them having forgotten
 * it. This list asks whether the click lands on a POINT: `DrawRoomTool.pointerDown` anchors
 * the rectangle at the exact world point of the press, so it does. That list asks whether
 * Shift's angle constraint applies, and for an axis-aligned rectangle there is no free
 * direction to constrain, so it does not.
 *
 * `EditorSurface.vue` was not in the Add Room increment's diff, which is why nothing pointed
 * at this: the empty state's own action moved from `setTool('draw-polygon')` to
 * `activateCreationEntry('room', …)`, so the SAME button quietly stopped changing the cursor
 * — a regression rather than a gap. `canvasNavigation.test.ts`'s 'is precise while the room
 * tool is active' is what would notice it going again; that the class resolves to
 * `crosshair` is checked by nothing here at all (`styles/editor-cursors.css` says so where
 * the keyword is, and `docs/tests/cases/Canvas Navigation.md` is the instrument).
 *
 * **ONE list across both surfaces**, though the two surfaces' ids are disjoint — the same
 * reasoning `CONSTRAINING_TOOLS` (`editorSnapping.ts`) already settled for the Shift-angle
 * question. That surface mounts twice: the Plan Editor with `draw-polygon`, `draw-room`,
 * `calibrate`, and `DesignerCanvas.vue` with `trace-footprint`, `trace-clearance`,
 * `set-anchor`, `set-facing` — each an id the OTHER surface's `ToolManager` never registers,
 * so a designer tool can never be the answer in the Plan Editor and vice versa. What one
 * list buys is that "does this tool want a crosshair" has one answer, checked here rather
 * than reasoned separately per mounter.
 */
const PRECISE_TOOLS: readonly ToolId[] = [
	'move-opening',
	'draw-polygon',
	'draw-room',
	'draw-area',
	'draw-wall',
	'draw-path',
	'draw-fence',
	'measure',
	'place-object',
	'place-asset',
	'place-door',
	'place-window',
	'place-opening',
	'place-stair',
	'draw-arrow',
	'calibrate',
	'trace-footprint',
	'trace-clearance',
	'set-anchor',
	'set-facing',
];

/** What the cursor decision needs of the surface — never the surface's refs themselves. */
export interface CursorInputs {
	readonly panPhase: PanPhase;
	readonly activeToolId: ToolId | null;
	readonly hoveredObjectId: string | null;
	readonly hoveredTargetKind: 'body' | 'handle' | 'rotation' | null;
	readonly rotationActive?: boolean;
}

/**
 * The ONE cursor class on the canvas, and the place the precedence between the camera and
 * the active tool is decided.
 *
 * Decided here rather than left to the cascade in `styles/editor.css` on purpose: as source
 * order it would be a correct rule that no gate reads, and a paste in the wrong place would
 * silently invert it. As a pure function it is an ordinary assertion in the suite.
 *
 * The camera outranks the tool because the ROUTING does — space held during a draw pans,
 * so a crosshair there would be the only thing telling the user otherwise. `idle` maps to
 * no class at all rather than to an `-idle` one: the resting state is what the base rule
 * already describes, and a class that styles nothing is a selector waiting to be given a
 * meaning it was never designed for.
 *
 * Select predicting a body or a vertex handle under the pointer says what a click would
 * take, so the cursor answers what `resolveSelectionTarget` would answer a click. The two
 * hits are DIFFERENT promises and get different cursors (spec §6.2): a body would be
 * selected, so `pointer`; a vertex handle of an already-selected room would be dragged, so
 * `grab` — the same keyword the camera's own armed pan uses, because it is the one the user
 * has already learnt for "this is about to move under your hand".
 */
export function cursorClassFor(inputs: CursorInputs): string | null {
	if (inputs.panPhase !== 'idle') return `rp-plan-canvas-${inputs.panPhase}`;
	if (inputs.activeToolId === 'select' && inputs.rotationActive) return 'rp-plan-canvas-grabbing';
	if (inputs.activeToolId === 'select' && inputs.hoveredObjectId !== null) {
		return inputs.hoveredTargetKind === 'handle' || inputs.hoveredTargetKind === 'rotation' ? 'rp-plan-canvas-grab' : 'rp-plan-canvas-target';
	}
	const tool = inputs.activeToolId;
	return tool !== null && PRECISE_TOOLS.includes(tool) ? 'rp-plan-canvas-precise' : null;
}
