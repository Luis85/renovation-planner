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
import { computed, nextTick, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { useEditorStore } from '../../stores/EditorStore';
import { STAGE_PIXELS, worldToScreen } from '../../editor/viewport/Viewport';
import { useAssetDesignStore } from '../stores/assetDesignStore';
import { useDesignerRuntime } from '../runtime';
import { dimensionFigures, type DimensionFigure } from './dimensionFigures';

const editor = useEditorStore();
const { design, selection, preview } = storeToRefs(useAssetDesignStore());
const { allDimensions, editShape } = useDesignerRuntime();

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

/** A figure with its world point already resolved to the two CSS lengths the template writes. */
interface PlacedFigure extends Omit<DimensionFigure, 'at'> {
	readonly style: { readonly left: string; readonly top: string };
}

/**
 * ONE computed over the whole overlay, as `DesignerRulers`' own model is and for its reason: every
 * figure needs the same design, the same camera and the same preview, and splitting them would ask
 * `design === null` again in each — an arm nothing in a mounted designer can reach a second time,
 * since the root mounts the canvas only over a design it has.
 */
const figures = computed((): readonly PlacedFigure[] => {
	const view = design.value;
	if (view === null || view.dimensionsUnscaled) return [];
	// The gesture's PREVIEW while one is live, exactly as `DesignerCanvas`'s own `shape` reads it.
	const drawn = preview.value ?? view.shape;
	if (drawn === null) return [];
	return dimensionFigures(drawn, selection.value, allDimensions.value).map((figure) => {
		const { at, ...rest } = figure;
		const point = worldToScreen(at, editor.viewport, STAGE_PIXELS);
		return { ...rest, style: { left: `${String(point.x)}px`, top: `${String(point.y)}px` } };
	});
});

/** The open figure, re-read from `figures` each render so its edit is built against the live shape. */
const editing = computed(() => figures.value.find((figure) => figure.name === draft.value?.name) ?? null);

async function open(figure: PlacedFigure): Promise<void> {
	refusal.value = null;
	draft.value = { name: figure.name, text: String(Math.round(figure.value)) };
	await nextTick();
	const input = control.value[0];
	// Present on every path a user can take: the field was drawn on the tick just awaited. The arm
	// exists because a peer's write landing in that same tick can withdraw the figure, which is the
	// only way this overlay's DOM changes without a gesture.
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

async function submit(): Promise<void> {
	const figure = editing.value, text = draft.value?.text ?? '';
	// `Number('')` is 0 and `Number(' ')` is 0, so the emptiness is asked before the parse rather
	// than by `Number.isFinite`, which would accept both as a typed zero.
	const typed = text.trim() === '' ? Number.NaN : Number(text);
	if (figure === null || !Number.isFinite(typed)) {
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
				@submit.prevent="void submit()"
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
				{{ Math.round(figure.value) }}
			</button>
		</div>
	</div>
</template>
