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
import type { ShapeEdit } from '../selection/editShape';
import { partKey, type DesignerSelection } from '../selection/designerSelection';
import DesignerSelectionInspector from './DesignerSelectionInspector.vue';
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
	startFromPreset: () => Promise<void>;
	logger: Logger;
	/** The part the canvas has selected, `null` for none; its section is keyed by part, so choosing another starts it fresh. */
	selection: DesignerSelection | null;
	editShape: (edit: ShapeEdit) => Promise<DispatchResult>;
	select: (next: DesignerSelection | null) => void;
	/** The way back to the shared catalogue, or `undefined` where no door is bound (AD06). */
	openLibrary?: () => void;
	/** Every selected part, in selection order — the last is the one whose fields show (AD08). */
	selected: readonly DesignerSelection[];
	/** Whether the sticky "select multiple" mode is on (AD08). */
	multiSelectionMode?: boolean;
	/**
	 * Turn that mode on or off, or `undefined` where no runtime binds one.
	 *
	 * A value down and a callback up, rather than the runtime's `Ref` handed over as a prop:
	 * `v-model` on a prop is a mutation of it, which `vue/no-mutating-props` refuses — measured,
	 * the first version of this control failed exactly there. The Plan Editor's own checkbox
	 * escapes the question by reading its runtime directly; this panel takes everything as props,
	 * so it takes this one the same way.
	 */
	setMultiSelectionMode?: (next: boolean) => void;
}>();

/** How many graphics this design has — what decides whether composing a set is even possible. */
const graphicCount = computed(() => props.design.shape?.details.length ?? 0);

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
	props.design.dimensions === null ? tr('designer.inspector.set-dimensions') : tr('designer.inspector.edit-dimensions'),
);
</script>

<template>
	<!--
		No class here: this `<aside>` is the whole content of `AssetDesignerRoot.vue`'s
		`.rp-designer-inspector` div (padding, background, border-left already there, and no
		sibling this element needs to stand out from), so an own class would style nothing and
		the widened `libraryComponentStyles.test.ts` scan would keep flagging it undeclared. Kept
		as a landmark for its `aria-label`, dropped as a class.

		`tabindex="-1"` makes it a surviving focus TARGET and not a Tab stop (spec Amendment 2):
		`DesignerSelectionInspector` hands focus here when Delete or Duplicate unmounts the button
		that had it — the plan editor's `EntityInspector` aside, for the same reason.
	-->
	<aside
		tabindex="-1"
		:aria-label="tr('designer.inspector')"
	>
		<h2 class="rp-designer-panel-title">
			{{ tr('designer.inspector') }}
		</h2>
		<!--
			**How many parts are selected** (AD08). Drawn only for a set of two or more: with one
			selected the section below already says which part it is, and a count of "1" beside it
			would be a second way of saying the same thing.
		-->
		<p
			v-if="selected.length > 1"
			class="rp-designer-selection-count"
			role="status"
		>
			{{ tr('designer.selection.count', { count: String(selected.length) }) }}
		</p>
		<DesignerSelectionInspector
			v-if="selection !== null"
			:key="partKey(selection)"
			:design="design"
			:selection="selection"
			:edit-shape="editShape"
			:select="select"
		/>
		<!--
			The asset's own block gets a heading of its own, so its Dimensions never read as the size of the
			part whose section sits right above them (selection polish critique, finding 4).
		-->
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.inspector.asset') }}
		</h3>
		<!--
			**Which object is this?** (AD06's first acceptance criterion.) Nothing on this surface
			answered it: `getDisplayText` titles every designer leaf "Asset designer" whatever asset
			it holds — the Plan Editor's own convention, so changing it here alone would make the two
			surfaces disagree — and a per-asset view is precisely the one you can have three of at
			once. The name is already on the DTO this panel is handed; it was simply never drawn.
		-->
		<p class="rp-designer-asset-name">
			{{ design.name }}
		</p>
		<!--
			`design.dimensions` is `null` exactly when the asset has no footprint — the same field
			`GetAssetDesign`'s own docblock says is "never `{ width: 0, depth: 0 }`" — so the block
			and its warning disappear together rather than showing a rectangle of zeroes.
		-->
		<dl
			v-if="design.dimensions !== null"
			class="rp-designer-inspector-fields"
		>
			<dt>{{ tr('designer.inspector.dimensions') }}</dt>
			<!-- Whole millimetres: a curve's box is irrational, and no drawing is read finer than that. -->
			<dd>{{ Math.round(design.dimensions.width) }} × {{ Math.round(design.dimensions.depth) }} mm</dd>
		</dl>
		<p
			v-if="design.dimensions !== null && design.dimensionsUnscaled"
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
		<button
			type="button"
			class="rp-designer-start-preset"
			@click="() => void startFromPreset()"
		>
			{{ tr('designer.inspector.start-preset') }}
		</button>
		<!--
			The way BACK (AD06). Drawn only where a door is bound — the harness and the component
			suites bind none — because slice 14's Amendment 1 refuses a live control that does
			nothing, which is what an unbound one would be.
		-->
		<button
			v-if="openLibrary !== undefined"
			type="button"
			class="rp-designer-open-library"
			@click="openLibrary"
		>
			{{ tr('designer.inspector.open-library') }}
		</button>
		<!--
			C05: adding to a selection needs a control a keyboard and a touch user can reach, not a
			modifier alone. The Plan Editor's own "Select multiple elements" checkbox, in the panel
			that governs the same gesture — same shape, same binding, so the two surfaces behave
			alike (C12). It STAYS while on, for that control's own reason: the mode also governs
			canvas presses, so it must never be left unreachable.
		-->
		<label
			v-if="setMultiSelectionMode !== undefined && (graphicCount > 1 || multiSelectionMode === true)"
			class="rp-designer-multi-select"
		>
			<input
				type="checkbox"
				data-rp-action="multiple-selection"
				:checked="multiSelectionMode === true"
				@change="setMultiSelectionMode(($event.target as HTMLInputElement).checked)"
			>
			{{ tr('designer.selection.toggle-mode') }}
		</label>

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
					@input="height.onInput(($event.target as HTMLInputElement).value)"
					@blur="height.onCommit()"
					@keydown.enter="height.onCommit()"
					@keydown.esc.stop="height.onCancel()"
				>
			</label>
		</FieldError>
	</aside>
</template>
