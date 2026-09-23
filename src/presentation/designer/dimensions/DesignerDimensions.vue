<script setup lang="ts">
/**
 * The designer's dimensions on canvas — the asset designer snapping spec (2026-09-15) §0's
 * increment 2, authorised in full by AD18-R11: *"overall width × depth along the footprint, the
 * selected part's size and its offsets to the footprint edges, each value a button opening an
 * inline field, updated live from the drag preview, an 'All dimensions' view toggle, and no
 * numbers on an unscaled part."*
 *
 * **A DOM overlay and not a Konva layer.** That spec's decision table settles the mechanism for
 * every canvas annotation and this component does not reopen it: a clickable Konva node fights a
 * hit test where every designer layer is `listening: false`, and a hybrid runs two render
 * cadences that visibly lag each other during a drag. It mounts in `EditorSurface`'s `overlay`
 * slot beside `DesignerRulers`, which is what resolves its `position: absolute` against
 * `.rp-plan-canvas` rather than against the shell.
 *
 * **These labels ACCEPT a press, and that is the whole of the mechanism AD18-R11 had to settle.**
 * The premise that the overlay slot forbids interactivity is false and was measured: the wrapper's
 * four `.stop` modifiers are bubble-phase, so a child's own handler runs first in the target phase
 * untouched, and they shield the canvas FROM the overlay rather than the overlay from the user.
 * `.rp-plan-overlay` declares no `pointer-events` at all. So the cost is one CSS line —
 * `pointer-events: none` on the container so these children may set `auto`, which is what
 * `.rp-dimension-labels` has done on the plan side since it shipped — plus `@keydown.stop` on the
 * open form, the twin `AddMenu` carries for the same reason.
 *
 * **Take the PATTERN and not the components**, which that ruling also fixes. The plan editor's
 * `InlineRoomDimension` takes a `RoomDimensionDraft` carrying `submit()`, `error`, `form.values`,
 * `blocked` and a `controls` triple — a Plan Editor task object with no designer equivalent. This
 * surface's edits are pure `ShapeEdit`s through the runtime's `editShape`, so the draft here is
 * the figure's name and a string.
 *
 * **Every number reads the PREVIEW while a gesture is live** (`preview ?? design.shape`), which is
 * the spec's *"updated live from the drag preview"* and the binding AD18-R11 carries forward from
 * the ruler card, which was sent back for exactly this. Nothing here reads the committed shape at
 * all: unlike the rulers, no part of this overlay is a frame that a drag must not slide.
 *
 * **A label that would be covered by another one moves, which is AD18-R14.** `All dimensions` at
 * the camera `DesignerCanvas` fits on mount put three readings in one 33.4 x 30 px box, and since
 * every label wrapper in `styles/designer-dimensions.css` shares one `z-index` (only an open FORM is
 * lifted above it), the paint and hit order among them is DOM order. So the last figure appended
 * took every click and the two under it could not be reached at all. `spreadLabels` is the whole of
 * that answer and it is in the pure module; this component hands it the stage points
 * `worldToScreen` just produced and draws what comes back.
 *
 * **The RESTING state — `All dimensions` off — is held to a stricter floor since AD18-R17**: no two
 * labels touching at all, which AD18-R14 set and which held only at a 1280 leaf; at 460 a selected
 * part's labels overlapped in five pairs. `separateLabels` answers it, and the nothing-selected pair
 * is untouched by construction, since a label touching nothing is returned where it asked to be.
 *
 * **Each figure is drawn as a dimension LINE, not only a number** (AD18-R17, board 01): a line
 * through the placed label with an arrowhead at each end and an extension line to each edge it
 * measures, in one `aria-hidden` SVG before the labels so each opaque label interrupts its own line.
 * `dimensionLines.ts` is the arithmetic. The button reads `800 mm` — the unit rides on the label
 * now, still inside its accessible name.
 *
 * **Nothing is drawn over an UNSCALED design.** `dimensionsUnscaled` is a footprint captured
 * before the asset had a scale, whose coordinates are placeholder pixels; a millimetre reading
 * over it would put a unit on a number that is not a measurement, which is the rule the status
 * row's grid step and the rulers already follow ("Read and correct an object's dimensions",
 * acceptance criterion 6). That is one early return of no figures at all, which gates the open
 * field too: `editing` resolves against that same list.
 *
 * **What is announced.** Each button carries its own accessible name — the figure's noun, its
 * value and the unit — because a button reading `600` alone says nothing about what it measures.
 * The container is a plain `<div>` and not a `role="img"`: unlike the rulers' ticks these ARE
 * controls, and a group role over them would take them out of the tab order they need.
 */
import { computed, nextTick, ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { useEditorStore } from '../../stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../editor/viewport/Viewport';
import { useAssetDesignStore } from '../stores/assetDesignStore';
import { useDesignerRuntime } from '../runtime';
import { dimensionFigures, separateLabels, spreadLabels, type DimensionFigure } from './dimensionFigures';
import { dimensionLine, type DimensionLine } from './dimensionLines';

const editor = useEditorStore();
const { design, selection, preview } = storeToRefs(useAssetDesignStore());
const { allDimensions, editShape, activeToolId, partView, showClearance } = useDesignerRuntime();

/** The overlay's own element, so focus is handed back within it and never stolen from elsewhere. */
const root = ref<HTMLElement | null>(null);
/**
 * The open field's input, focused on the tick it is drawn — `InlineRoomDimension` does the same.
 *
 * **An ARRAY, because the `ref` sits inside a `v-for`**, which is what Vue does there even where
 * only one element of the loop can ever render it. Typed as one and it is a live array at runtime:
 * `input.focus is not a function`, measured, with every assertion about the field still green
 * because the field itself renders perfectly well unfocused.
 */
const control = ref<HTMLInputElement[]>([]);

/** Which figure's field is open, and what has been typed into it. `null` is "every figure is a button". */
const draft = ref<{ readonly name: string; text: string } | null>(null);
/** The refusal the last submission answered, shown inside the open field and cleared by the next one. */
const refusal = ref<string | null>(null);

/** A figure with its world geometry already resolved to the CSS and the path data the template writes. */
interface PlacedFigure extends Omit<DimensionFigure, 'at' | 'from' | 'to'> {
	readonly style: { readonly left: string; readonly top: string; readonly transform: string };
	readonly marks: DimensionLine;
}

/**
 * **The tools under which dimensions are drawn at all**, which is the half of the
 * `RoomDimensionLabels` pattern that keeps the canvas usable and which AD18-R11 did not license
 * dropping: that ruling settled whether the overlay slot PERMITS a control, not whether one should
 * sit over a gesture.
 *
 * `null` is camera mode and `select` is the tool that grabs handles — the two modes in which
 * nothing is being drawn on the canvas. The other ten ids this surface registers are click or drag
 * gestures ON the drawing, and the overall pair anchors on the middles of the footprint's top and
 * left edges — exactly the outline a user traces against. A press there lands on a button in the
 * target phase, the slot wrapper's `@pointerdown.stop` then keeps the bubbled event off the
 * canvas, the vertex is never taken, and the release opens an edit form over the drawing. With
 * `All dimensions` on, six more holes per part.
 *
 * Stated as the ALLOWED set rather than the forbidden one, so a tool added later is out until
 * somebody decides it is in. `AssetDesignerRoot` withdraws the empty state on
 * `activeToolId !== null`, which is the same convention read at a surface with no reason to be
 * live under Select either.
 */
const MEASURING_TOOLS: readonly (string | null)[] = [null, 'select'];

/**
 * ONE computed over the whole overlay, as `DesignerRulers`' own model is and for its reason: every
 * figure needs the same design, the same camera and the same preview, and splitting them would ask
 * `design === null` again in each — an arm nothing in a mounted designer can reach a second time,
 * since the root mounts the canvas only over a design it has.
 */
const figures = computed((): readonly PlacedFigure[] => {
	const view = design.value;
	if (view === null || view.dimensionsUnscaled || !MEASURING_TOOLS.includes(activeToolId.value)) return [];
	// The gesture's PREVIEW while one is live, exactly as `DesignerCanvas`'s own `shape` reads it.
	const drawn = preview.value ?? view.shape;
	if (drawn === null) return [];
	const editing = draft.value?.name;
	const drawing = dimensionFigures(drawn, selection.value, allDimensions.value, partView.hidden.value, showClearance.value);
	const screen = (point: DimensionFigure['at']) => worldToScreen(point, editor.viewport, STAGE_PIXELS);
	// AD18-R14: several figures can want one row of pixels at a zoomed-out camera, and the ones
	// drawn later cover the ones beneath them — a control that cannot be pressed. The rule is
	// `spreadLabels`', in the pure module, because a label box has a size only in stage pixels and
	// this is where world millimetres have just become some. It is handed the VALUE as well as the
	// point because the box's width is the digits the button draws, and only the number knows how
	// many there are. Nothing else about the figure changes, so the two lists stay index-for-index.
	//
	// AD18-R17: the RESTING state — `All dimensions` off — is held to a stricter floor, no two labels
	// touching at all, which `separateLabels` answers. See that function for why the two differ.
	const anchors = drawing.map((figure) => ({ at: screen(figure.at), value: figure.value }));
	const points = allDimensions.value ? spreadLabels(anchors, editor.stageSize) : separateLabels(anchors, editor.stageSize);
	return drawing.map((figure, index) => {
		// The world point is DROPPED here rather than carried: the rule has already answered
		// where this label goes, and a `PlacedFigure` holding both would offer two answers.
		// The span is resolved into the marks instead, drawn through the PLACED label, so a line
		// follows a label the rule moved (`dimensionLines.ts`).
		const { at: _at, from, to, ...rest } = figure;
		const point = points[index];
		const style = { left: `${String(point.x)}px`, top: `${String(point.y)}px`, transform: placement(point, figure.name === editing) };
		return { ...rest, style, marks: dimensionLine(figure.axis, screen(from), screen(to), point) };
	});
});

/**
 * Where a figure's box sits relative to its own mark — and, when its FIELD is open, which way that
 * field grows.
 *
 * **`.rp-plan-canvas` is `overflow: hidden`, so a form drawn past an edge is cut off rather than
 * merely awkward.** The first version of this overlay lifted every open form a full height above
 * its anchor unconditionally, and `DesignerCanvas` fits an opened asset with `FIT_PADDING_PX`'s
 * 48 px margin — so the overall pair's anchors sit 48 px from the top and left edges and BOTH of
 * their forms were clipped on open, at the camera this surface chooses for itself. Structural, and
 * answerable from the code rather than from a browser.
 *
 * **The repair states no SIZE**, which is what keeps this file from holding a second copy of the
 * stylesheet's own box: a form anchored in the top half grows DOWN and one in the left half grows
 * RIGHT, so it always grows into the canvas and away from the nearer edge. Only which side of the
 * middle the anchor is on is asked. `RoomDimensionLabels` clamps with hard-coded pixel constants
 * instead — the same fix with the box written down twice, which that surface needs because its
 * field is fitted between a taskbar and a rail rather than anchored on a point.
 *
 * A BUTTON stays centred on its mark, which is what makes a number read as belonging to the gap or
 * the edge it sits on.
 *
 * `point` is the one `spreadLabels` or `separateLabels` settled on rather than the raw anchor,
 * because a form has to grow away from the edge it is ACTUALLY at — and the two differ for any
 * label either rule moved. A label pushed far enough to cross the middle therefore opens its form the other way,
 * which is this function answering the question it was written to answer and not a special case.
 */
function placement(point: { x: number; y: number }, isOpen: boolean): string {
	if (!isOpen) return 'translate(-50%, -50%)';
	const across = point.x < editor.stageSize.width / 2 ? '0' : '-100%';
	const down = point.y < editor.stageSize.height / 2 ? '0' : '-100%';
	return `translate(${across}, ${down})`;
}

/**
 * **A figure can leave `figures` with no gesture of this overlay's** — the selection clears, the
 * toggle goes off, a tool is picked, a peer's write lands — and the `v-for` then unmounts the open
 * form with no hand-off at all. Without this the draft survives: re-selecting the part drew the
 * field open again, unfocused, holding the text and the refusal from before.
 *
 * Focus still falls to `<body>` in that moment, and this does not pretend otherwise. There is
 * nothing in the overlay to hand it to — every way OUT that a user takes goes through `close`,
 * which hands focus back to the button — and taking it to the canvas on a peer's write would move
 * a user who was typing somewhere else entirely.
 */
watch(figures, (list) => {
	const field = draft.value;
	if (field === null || list.some((figure) => figure.name === field.name)) return;
	draft.value = null;
	refusal.value = null;
});

async function open(figure: PlacedFigure): Promise<void> {
	refusal.value = null;
	draft.value = { name: figure.name, text: String(Math.round(figure.value)) };
	await nextTick();
	const input = control.value[0];
	// Present on every path a user takes: the field was drawn on the tick just awaited. The arm is
	// for a write landing in that same tick and withdrawing the figure — the one way this overlay's
	// DOM changes without a gesture — and it is DRIVEN rather than disclosed, by the case
	// `designerDimensions.test.ts` mutates the store in that tick.
	if (input === undefined) return;
	input.focus();
	input.select();
}

/**
 * Closing hands focus back to the button that opened the field, which has only just been drawn
 * again — hence the tick. `RoomDimensionLabels` does the same through a `flush: 'sync'` watch
 * because its draft is owned by a runtime task object that several components close; here one
 * function is every way out (Escape, Cancel, and a submission that landed), so a watch would be
 * an indirection with nothing to observe that this does not already know.
 */
async function close(name: string): Promise<void> {
	draft.value = null;
	refusal.value = null;
	await nextTick();
	// Scoped to this overlay so focus is never taken from another region, and asked rather than
	// assumed: the button is absent when the figure it belonged to is no longer measured.
	root.value?.querySelector<HTMLElement>(`[data-rp-dimension="${name}"]`)?.focus();
}

/**
 * The figure and the text come from the TEMPLATE rather than being looked up here, which is what
 * removes two guards nothing could ever drive: the form renders only inside the `v-for` entry of a
 * figure that is currently measured, and only while `draft` is set, so a submit event cannot
 * arrive without either. Looking them up again would have been two `null` arms no test could
 * reach, and an unreachable guard costs a branch it can never pay back.
 */
async function submit(figure: PlacedFigure, text: string): Promise<void> {
	// `Number('')` is 0 and `Number(' ')` is 0, so the emptiness is asked before the parse rather
	// than by `Number.isFinite`, which would accept both as a typed zero.
	const typed = text.trim() === '' ? Number.NaN : Number(text);
	if (!Number.isFinite(typed)) {
		refusal.value = tr('designer.dimension.unavailable');
		return;
	}
	const result = await editShape(figure.edit(typed));
	if (!result.ok) {
		refusal.value = trError(result.error);
		return;
	}
	await close(figure.name);
}
</script>

<template>
	<div
		ref="root"
		class="rp-designer-dimensions"
	>
		<!-- The drafting marks: decoration, since each button names what it measures (AD18-R17). -->
		<svg
			class="rp-designer-dimension-lines"
			aria-hidden="true"
		>
			<g
				v-for="figure in figures"
				:key="figure.name"
				:data-rp-dimension-line="figure.name"
			>
				<path
					class="rp-designer-dimension-lines__line"
					:d="figure.marks.line"
				/>
				<path
					class="rp-designer-dimension-lines__arrows"
					:d="figure.marks.arrows"
				/>
			</g>
		</svg>
		<div
			v-for="figure in figures"
			:key="figure.name"
			class="rp-designer-dimension"
			:style="figure.style"
		>
			<form
				v-if="draft !== null && draft.name === figure.name"
				class="rp-designer-dimension__form"
				:aria-label="tr('designer.dimension.edit', { name: tr(figure.label) })"
				@submit.prevent="void submit(figure, draft.text)"
				@keydown.stop
				@keydown.escape.prevent="void close(figure.name)"
			>
				<label>
					{{ tr(figure.label) }}
					<input
						ref="control"
						v-model="draft.text"
						type="text"
						inputmode="decimal"
						:name="figure.name"
					>
				</label>
				<p
					v-if="refusal !== null"
					role="alert"
					class="rp-designer-dimension__error"
				>
					{{ refusal }}
				</p>
				<div class="rp-designer-dimension__actions">
					<button type="submit">
						{{ tr('editor.resize.apply') }}
					</button>
					<button
						type="button"
						@click="void close(figure.name)"
					>
						{{ tr('editor.task.cancel') }}
					</button>
				</div>
			</form>
			<button
				v-else
				type="button"
				class="rp-designer-dimension__value"
				:data-rp-dimension="figure.name"
				:aria-label="tr('designer.dimension.value', { name: tr(figure.label), value: String(Math.round(figure.value)) })"
				@click="void open(figure)"
			>
				{{ tr('designer.dimension.label', { value: String(Math.round(figure.value)) }) }}
			</button>
		</div>
	</div>
</template>
