<script setup lang="ts">
/**
 * Task B8's inspector region: the asset's derived dimensions, an honest warning when they are
 * not yet real measurements, and the one design scalar that lives in the note rather than in
 * the geometry sidecar — its height.
 *
 * **Dimensions are read-only here on purpose (§88).** `AssetDesignDto.dimensions` is DERIVED
 * from the footprint (`GetAssetDesign`'s own docblock: "a traced outline needs no typed numbers
 * beside it and the two can never disagree"), so a text field bound to it would be a second,
 * writable copy of a value with exactly one source of truth. Editing the rectangle is Task B8's
 * OTHER surface instead — the `asset-dimensions` dialog, reached through the `editDimensions`
 * prop this component only CALLS and never opens itself, so the gesture is written once, in
 * `AssetDesignerRoot.vue`, for its one caller and this component's shared use of it.
 *
 * The height field is the opposite shape: `SetAssetHeight`'s own value, nothing else derives
 * it, and it commits on blur/enter through `useFieldCommit` exactly as `RequirementRow`'s two
 * override fields do — the same commit boundary, the same routed field error, the same rule
 * that a clean field blurred dispatches nothing (slice 16's Reset-button lesson, met here at a
 * field that has no reset button to walk past the guard: `useFieldCommit`'s own `submitted ===
 * null` check is the whole of what closes it).
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { Logger } from '../../../application/ports/Logger';
import { ok } from '../../../core/result/Result';
import { useFieldCommit } from '../../composables/use-field-commit';
import type { FieldErrorMap } from '../../errors/route-error';
import { trError } from '../../i18n/toUserMessage';
import { reportDispatchFailure } from '../../editor/report-failure';
import { tr } from '../../i18n/strings';
import FieldError from '../../components/FieldError.vue';

const props = defineProps<{
	design: AssetDesignDto;
	setHeight: (height: number | null) => Promise<DispatchResult>;
	editDimensions: () => Promise<void>;
	logger: Logger;
}>();

/**
 * Both codes are `SetAssetHeightCommand`'s own — `Asset.ts`'s `checkHeight`, through
 * `withChanges` — read from the raise sites rather than guessed from the field's name (this
 * repository's own rule for every `FieldErrorMap` in the plugin).
 */
const HEIGHT_ERRORS: FieldErrorMap<{ height: number | null }> = {
	'asset.invalid-height': 'height',
	'asset.negative-height': 'height',
};

/**
 * The draft is a raw STRING, exactly as `RequirementRow`'s cost and quantity fields are and
 * for the same reason: a parsed `number` draft rewritten back through `:value` on every
 * keystroke corrupts any prefix that parses to `NaN`, and a leading decimal point could never
 * be typed at all. `Number` is applied once, at `buildCommand`, once `validate` has already
 * passed.
 */
const height = useFieldCommit<string, { height: number | null }>({
	canonicalValue: () => props.design.height?.toString() ?? '',
	buildCommand: (raw) => ({
		// Reached only once `validate` below has passed, so this parse cannot yield `NaN`.
		execute: () => props.setHeight(raw.trim() === '' ? null : Number(raw.trim())),
		undo: () => Promise.resolve(ok('no-write')),
	}),
	// `props.setHeight` already dispatches through the leaf's own mapped, never-rejecting
	// dispatcher (`DesignerRuntime.commitHeight`), so this "history" is a pass-through rather
	// than a second command stack — the same shape `RequirementRow`'s two fields take over
	// `InspectorStore.commit`.
	history: { run: (command) => command.execute() },
	errorMap: HEIGHT_ERRORS,
	field: 'height',
	toUserMessage: trError,
	notify: reportDispatchFailure,
	logger: props.logger,
	validate: (raw) =>
		raw.trim() === '' || Number.isFinite(Number(raw.trim())) ? null : tr('designer.inspector.height.unparseable'),
});

function onHeightInput(raw: string): void {
	height.onInput(raw);
}

/**
 * `null` exactly when the asset has no footprint — the same field `GetAssetDesign`'s own
 * docblock says is "never `{ width: 0, depth: 0 }`" — so the block and its warning disappear
 * together rather than showing a rectangle of zeroes.
 */
const dimensions = computed(() => props.design.dimensions);

/**
 * **The button stays, and only its NAME moves with the state.** It used to disappear with the
 * block above, on the reasoning that the empty state's own action was the hand-off while this
 * is `null` — which was true of `noShape` and not of the state a fresh asset actually lands
 * in. A shapeless asset with no sheet selects `noBackground`, whose only action is the picker,
 * and that ordering is deliberate; so the whole of "type a width and a depth" — which needs no
 * sheet, no calibration and no tracing — was reachable only after choosing an unrelated file.
 * This panel is mounted in every state, which is what makes it the right place to fix that.
 *
 * With no shape there is nothing to EDIT, so the label says what the gesture does instead.
 */
const dimensionsLabel = computed(() =>
	dimensions.value === null ? tr('designer.inspector.set-dimensions') : tr('designer.inspector.edit-dimensions'),
);
</script>

<template>
	<aside
		class="rp-designer-inspector-panel"
		:aria-label="tr('designer.inspector')"
	>
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.inspector') }}
		</h2>
		<dl
			v-if="dimensions !== null"
			class="rp-designer-inspector-fields"
		>
			<dt>{{ tr('designer.inspector.dimensions') }}</dt>
			<dd>{{ dimensions.width }} × {{ dimensions.depth }} mm</dd>
		</dl>
		<p
			v-if="dimensions !== null && design.dimensionsUnscaled"
			class="rp-designer-unscaled"
		>
			{{ tr('designer.inspector.dimensions.unscaled') }}
		</p>
		<button
			type="button"
			class="rp-designer-edit-dimensions"
			@click="() => void editDimensions()"
		>
			{{ dimensionsLabel }}
		</button>

		<FieldError
			v-slot="{ inputId, aria }"
			:message="height.error.value"
		>
			<label
				class="rp-designer-field"
				:for="inputId"
			>
				{{ tr('designer.inspector.height') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="number"
					name="height"
					min="0"
					step="any"
					:aria-busy="height.pending.value"
					:value="height.draft.value"
					@input="onHeightInput(($event.target as HTMLInputElement).value)"
					@blur="height.onCommit()"
					@keydown.enter="height.onCommit()"
					@keydown.esc.stop="height.onCancel()"
				>
			</label>
		</FieldError>
	</aside>
</template>
