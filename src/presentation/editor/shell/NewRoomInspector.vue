<script setup lang="ts">
/**
 * The Inspector's NEW ROOM state (design spec §2.3, §5.1): the form the frame
 * (`EntityInspector.vue`) routes to while `activeToolId === 'draw-room'`, ahead of the
 * selection routing — a name with a row of suggestions, the two lengths, the area, `Keep
 * adding rooms`, Create and Cancel.
 *
 * **A body in the Inspector rather than a `FormDialog`, and §2.3 gives the reason:** slice
 * 15's dialog makes the rest of the view `inert`, so a user who has seen the numbers could
 * not re-drag to correct them, and no preview could update behind a modal. Everything here
 * reads and writes ONE store — `runtime.roomDraft` — which is the same store the canvas drag
 * writes, so "dragging and typing converge on the same creation command" (§2.2) is a fact
 * about the wiring rather than a claim a test has to make twice.
 *
 * **Create is `aria-disabled`, never `:disabled`** (§5.2, `KnownDistanceForm`'s pattern): the
 * control stays focusable and announced, and `aria-describedby` names the one sentence saying
 * what is still missing. `onCreate` asks `canCreateRoom` itself, so the promise the attribute
 * makes is kept at the control and not only inside the action — a guard on a door nobody
 * dispatches through is a guard nobody has.
 *
 * **`settledSize` is announced and the live width/depth are not** (§5.4). The `<dl>` figures
 * are ordinary reactive reads that change on every pointer move; the `role="status"` element
 * carries the sentence `RoomDraftStore.settle()` writes on a drag's END and on a numeric
 * commit, so a hundred moves announce nothing and an unchanged sentence is not re-announced.
 */
import { computed, nextTick, onBeforeUnmount, ref, useId } from 'vue';
import { tr } from '../../i18n/strings';
import type { StringKey } from '../../i18n/locales/en';
import type { Point } from '../../../core/geometry/Point';
import { useEditorRuntime } from '../runtime';
import { useEditorStore } from '../../stores/EditorStore';
import { screenPoint, screenToWorld, STAGE_PIXELS } from '../viewport/Viewport';
import type { DimensionAxis } from '../add/room-draft-store';
import type { LengthRefusal } from './formatLength';
import { formatArea } from './formatArea';
import FieldError from '../../components/FieldError.vue';

/**
 * `parseMetres`'s three refusals, each with the sentence that names what to do instead. A
 * `Record` keyed on the union rather than a template built through a cast, the same shape
 * `RoomInspector`'s `ZONE_TYPE_LABELS` states its reason for: a refusal added to
 * `LengthRefusal` is a compile error HERE rather than an unresolved key found at render.
 */
const MESSAGE: Readonly<Record<LengthRefusal, StringKey>> = {
	'not-a-number': 'editor.room.error.not-a-number',
	'not-positive': 'editor.room.error.not-positive',
	'too-large': 'editor.room.error.too-large',
};

/**
 * "What room is this?" (§2.4) — six buttons that set the NAME and nothing else. There is no
 * room-KIND field: `ZoneType` is the Room/Area classifier (ADR-0016) and Add → Room has
 * already decided it is `'Room'`, so a kind would be a stored label nothing reads.
 */
const SUGGESTIONS: readonly StringKey[] = [
	'editor.room.suggestion.kitchen',
	'editor.room.suggestion.living-room',
	'editor.room.suggestion.bedroom',
	'editor.room.suggestion.bathroom',
	'editor.room.suggestion.hallway',
	'editor.room.suggestion.office',
];

/** Rendered where a figure would otherwise be, for a rectangle that is not sized yet. */
const NO_FIGURE = '–';

const runtime = useEditorRuntime();
const editor = useEditorStore();
const draft = runtime.roomDraft;

const root = ref<HTMLElement | null>(null);
const nameId = useId();
const hintId = useId();

/**
 * ONE function for both fields rather than two computeds, so the refusing arm is driven by
 * whichever field a case types into rather than needing a case per axis.
 */
function messageFor(refusal: LengthRefusal | null): string | null {
	return refusal === null ? null : tr(MESSAGE[refusal]);
}

/**
 * Where a room typed with no pointer at all lands (§3): the middle of what the user is
 * looking at. A thunk, because `commitDimension` places the rectangle only once BOTH sides
 * are known and the camera may have moved between the two commits.
 */
function stageCentreWorld(): Point {
	const { width, height } = editor.stageSize;
	return screenToWorld(screenPoint(width / 2, height / 2), editor.viewport, STAGE_PIXELS);
}

function commit(axis: DimensionAxis, event: Event): void {
	draft.commitDimension(axis, (event.target as HTMLInputElement).value, stageCentreWorld);
}

function onCreate(): void {
	if (!runtime.canCreateRoom.value) return;
	void runtime.createRoom();
}

const areaText = computed<string>(() => (draft.areaMm2 === null ? NO_FIGURE : formatArea(draft.areaMm2)));

/**
 * **A browser drops focus to `<body>` when the focused control unmounts**, and this whole
 * body unmounts the moment the task ends — Create returns to Select, so the user who pressed
 * it is left nowhere. The frame's `<aside class="rp-editor-inspector">` carries `tabindex="-1"`
 * for exactly this kind of hand-off (its own header records the first one), so focus goes
 * there and the next Tab continues from the Inspector rather than from the top of the pane.
 *
 * `root.value` is CAST rather than optional-chained, the guarantee `OverlayPanel` and
 * `AddMenu` already state: this names the component's own root element, bound for the whole
 * of a mounted lifetime, so a null branch here would be an arm nothing can drive. `closest`
 * genuinely can answer null — this body is mountable outside the frame — and that arm is the
 * same one every unmount with focus elsewhere takes.
 */
onBeforeUnmount(() => {
	const form = root.value as HTMLElement;
	const aside = form.contains(document.activeElement) ? form.closest<HTMLElement>('.rp-editor-inspector') : null;
	if (aside !== null) void nextTick(() => aside.focus());
});
</script>

<template>
	<section
		ref="root"
		class="rp-new-room"
	>
		<h3 class="rp-editor-panel-title">
			{{ tr('editor.room.new.heading') }}
		</h3>

		<div class="rp-new-room__field">
			<label :for="nameId">{{ tr('editor.room.name') }}</label>
			<input
				:id="nameId"
				class="rp-new-room__name"
				type="text"
				:value="draft.name"
				@input="draft.setName(($event.target as HTMLInputElement).value)"
			>
		</div>

		<p class="rp-new-room__suggestions-prompt">
			{{ tr('editor.room.suggestion.prompt') }}
		</p>
		<ul
			class="rp-new-room__suggestions"
			role="list"
		>
			<li
				v-for="key in SUGGESTIONS"
				:key="key"
			>
				<button
					type="button"
					class="rp-new-room__suggestion"
					@click="draft.suggestName(tr(key))"
				>
					{{ tr(key) }}
				</button>
			</li>
		</ul>

		<FieldError
			v-slot="{ inputId, aria }"
			:message="messageFor(draft.widthError)"
		>
			<div class="rp-new-room__field">
				<label :for="inputId">{{ tr('editor.room.width') }}</label>
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					inputmode="decimal"
					name="width"
					:value="draft.widthText"
					@blur="commit('width', $event)"
					@keydown.enter.prevent="commit('width', $event)"
				>
			</div>
		</FieldError>

		<FieldError
			v-slot="{ inputId, aria }"
			:message="messageFor(draft.depthError)"
		>
			<div class="rp-new-room__field">
				<label :for="inputId">{{ tr('editor.room.depth') }}</label>
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					inputmode="decimal"
					name="depth"
					:value="draft.depthText"
					@blur="commit('depth', $event)"
					@keydown.enter.prevent="commit('depth', $event)"
				>
			</div>
		</FieldError>

		<dl class="rp-new-room__area">
			<dt>{{ tr('editor.room.area') }}</dt>
			<dd>{{ areaText }}</dd>
		</dl>

		<label class="rp-new-room__keep">
			<input
				type="checkbox"
				:checked="draft.keepAdding"
				@change="draft.setKeepAdding(($event.target as HTMLInputElement).checked)"
			>
			{{ tr('editor.room.keep-adding') }}
		</label>

		<div class="rp-new-room__actions">
			<button
				type="button"
				class="rp-new-room__create"
				:aria-disabled="!runtime.canCreateRoom.value"
				:aria-describedby="hintId"
				@click="onCreate"
			>
				{{ tr('editor.room.create') }}
			</button>
			<button
				type="button"
				class="rp-new-room__cancel"
				@click="runtime.cancelActiveTask()"
			>
				{{ tr('editor.room.cancel') }}
			</button>
		</div>
		<p
			v-if="!runtime.canCreateRoom.value"
			:id="hintId"
			class="rp-new-room__hint"
		>
			{{ tr('editor.task.finish.blocked') }}
		</p>

		<p
			class="rp-new-room__settled"
			role="status"
		>
			{{ draft.settledSize ?? '' }}
		</p>
	</section>
</template>
