<script setup lang="ts">
import { nextTick, onBeforeUpdate, onUpdated, ref, useId } from 'vue';
import { tr } from '../../i18n/strings';
import { useEditorRuntime } from '../runtime';
import { formatMetres, type LengthRefusal } from '../shell/formatLength';
import FieldError from '../../components/FieldError.vue';

const runtime = useEditorRuntime();
const input = runtime.areaCorners;
const root = ref<HTMLElement | null>(null);
const hintId = useId();
const cornerId = useId();
const axes = ['x', 'y'] as const;

function message(error: LengthRefusal | null): string | null {
	if (error === null) return null;
	return tr(error === 'too-large' ? 'editor.area.coordinate-too-large' : 'editor.area.coordinate-invalid');
}

function focusInput(): void {
	void nextTick(() => root.value?.querySelector<HTMLInputElement>('input')?.focus());
}

function apply(): void {
	if (input.apply()) focusInput();
	else void nextTick(() => root.value?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus());
}

function edit(index: number): void {
	input.edit(index);
	if (input.editing.value === index) focusInput();
}

function remove(index: number): void {
	if (input.remove(index)) focusInput();
}

/**
 * A row's Edit/Remove button can be the control that REMOVES itself: Escape on it routes to
 * `cancelGesture()` through `PlanEditorRoot`, the outline clears, and every row goes with it.
 * Focus then fell to `<body>`, where the next Escape reached nothing — the documented "clear,
 * then exit the tool" sequence broke on exactly the controls a keyboard user reaches last.
 * Measured across THIS component's own patch rather than guessed from the outcome: focus was
 * inside before the update and is nowhere after it. Apply, not the X input, because a native
 * field keeps Escape for itself and the second press would be swallowed there too.
 */
let focusWasInside = false;
onBeforeUpdate(() => { focusWasInside = root.value?.contains(document.activeElement) === true; });
onUpdated(() => {
	if (focusWasInside && document.activeElement === document.body) root.value?.querySelector<HTMLElement>('[data-rp-corner="apply"]')?.focus();
});

/** Enter applies a coordinate pair, never the Area. Other editing keys remain native. */
function onKey(event: KeyboardEvent): void {
	if (event.key !== 'Enter' || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
	event.preventDefault();
	if (!event.repeat) apply();
}
</script>

<template>
	<div class="rp-area-corners">
		<details ref="root">
			<summary>{{ tr('editor.area.coordinates') }}</summary>
			<div class="rp-area-corners__body">
				<p :id="hintId">
					{{ tr('editor.area.coordinates-hint') }}
				</p>
				<p
					:id="cornerId"
					role="status"
				>
					{{ tr('editor.area.corner', { n: String((input.editing.value ?? input.points.value.length) + 1) }) }}
				</p>
				<div class="rp-area-corners__fields">
					<FieldError
						v-for="axis in axes"
						:key="axis"
						v-slot="{ inputId, aria }"
						:message="message(input.errors[axis])"
					>
						<label :for="inputId">{{ tr(axis === 'x' ? 'editor.area.x' : 'editor.area.y') }}</label>
						<input
							:id="inputId"
							v-model="input.text[axis]"
							v-bind="aria"
							:name="axis"
							type="text"
							inputmode="decimal"
							:readonly="!input.editable.value"
							:aria-describedby="[cornerId, hintId, aria['aria-describedby']].filter(Boolean).join(' ')"
							@input="input.edited[axis] = true"
							@keydown="onKey"
						>
					</FieldError>
				</div>
				<p
					v-if="input.duplicate.value"
					role="alert"
				>
					{{ tr('editor.area.duplicate') }}
				</p>
				<div class="rp-area-corners__actions">
					<button
						type="button"
						:aria-disabled="!input.editable.value"
						data-rp-corner="apply"
						@click="apply"
					>
						{{ tr(input.editing.value === null ? 'editor.area.add-corner' : 'editor.area.update-corner') }}
					</button>
					<button
						type="button"
						data-rp-corner="reset"
						@click="input.reset(); focusInput()"
					>
						{{ tr('editor.area.reset-input') }}
					</button>
				</div>
				<ol
					class="rp-area-corners__list"
					:aria-label="tr('editor.area.coordinates')"
				>
					<li
						v-for="(point, index) in input.points.value"
						:key="index"
					>
						<span>{{ tr('editor.area.corner-position', { n: String(index + 1), x: formatMetres(point.x), y: formatMetres(point.y) }) }}</span>
						<div class="rp-area-corners__actions">
							<button
								type="button"
								:aria-disabled="!input.editable.value || input.pending.value"
								:aria-label="tr('editor.area.edit-corner', { n: String(index + 1) })"
								data-rp-corner="edit"
								@click="edit(index)"
							>
								{{ tr('editor.area.edit') }}
							</button>
							<button
								type="button"
								:aria-disabled="!input.editable.value || input.pending.value"
								:aria-label="tr('editor.area.remove-corner', { n: String(index + 1) })"
								data-rp-corner="remove"
								@click="remove(index)"
							>
								{{ tr('editor.area.remove') }}
							</button>
						</div>
					</li>
				</ol>
			</div>
		</details>
		<p
			v-if="input.pending.value"
			role="status"
		>
			{{ tr('editor.area.pending-input') }}
		</p>
	</div>
</template>
