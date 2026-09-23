<script setup lang="ts">
/**
 * Repeating the selected graphics along an axis (AD10 item 4, C06): how many copies, how far apart,
 * which way, and — the part C06 insists on — what that distance MEANS.
 *
 * **Centre-to-centre and gap-between are different numbers for the same picture**, so the form
 * makes the reader choose and then says what it resolved to: the preview line reports the step it
 * will actually apply, which is the typed spacing under `centres` and the selection's own extent
 * plus the typed spacing under `gaps`. That line is the acceptance criterion's preview — a
 * statement of the intended result before the write, not a ghost drawn on the canvas, which would
 * need the canvas region this task does not own.
 *
 * **The drafts stay raw TEXT until the button is pressed** (C03): a partly typed number is a user
 * mid-keystroke, not a request, so nothing here parses on input and nothing dispatches on blur.
 * Pressing the button is the only thing that writes, and it writes once.
 *
 * That is why the two number fields are `:value` plus `@input` rather than `v-model`: Vue casts a
 * `v-model` on `type="number"` to a NUMBER, which turned the draft into `NaN` for every prefix that
 * does not parse and threw out of the preview's own `trim`. Measured — the first version of this
 * form used `v-model` and three cases in `designerArrangePanel.test.ts` failed on it. The selects
 * keep `v-model`, where the value is one of a closed set of strings and there is no draft state to
 * lose.
 *
 * Bounds belong to the domain, not to the input: `repeatDetails` refuses a count outside 1…
 * `MAX_REPEAT_COPIES`, a fractional one and a non-finite spacing, with a coded refusal the panel
 * shows. A `max` attribute alone would leave a pasted value through, and a second copy of the limit
 * here is the pair that drifts — which is why the `max` attribute reads `MAX_REPEAT_COPIES` itself
 * and the refusal copy states no number at all.
 */
import { computed, ref } from 'vue';
import { unwrap } from '../../../core/result/Result';
import {
	MAX_REPEAT_COPIES,
	repeatDetails,
	type ArrangeAxis,
	type SpacingMode,
} from '../../../domain/asset/arrangeDetails';
import { detailBox } from '../../../domain/asset/detailEdits';
import type { AssetShape } from '../../../domain/asset/AssetShape';
import { tr } from '../../i18n/strings';
import type { ShapeEdit } from '../selection/editShape';
import DesignerFieldRowShell from './DesignerFieldRowShell.vue';

const props = defineProps<{
	shape: AssetShape;
	/** The selected graphics; one is enough to repeat. */
	ids: readonly string[];
	commit: (edit: ShapeEdit) => Promise<boolean>;
}>();

const count = ref('1');
const spacing = ref('100');
const axis = ref<ArrangeAxis>('x');
const mode = ref<SpacingMode>('centres');

const AXES: readonly ArrangeAxis[] = ['x', 'y'];
const MODES: readonly SpacingMode[] = ['centres', 'gaps'];

const typedCount = computed(() => Number(count.value.trim()));
const typedSpacing = computed(() => Number(spacing.value.trim()));

/**
 * The selection's own extent along the chosen axis — the same `detailBox` the domain operation
 * measures with, so the preview and the write cannot disagree about how wide the block is.
 *
 * **It always answers a number, and the two "cannot be measured" arms it used to carry are gone.**
 * Both were UNREACHABLE rather than merely uncovered: `detailBox` refuses only geometry
 * `validateAssetShape` would already have refused, and `props.shape` is always a validated one; and
 * an empty participant list is impossible under the enclosing `v-if="graphics.length > 0"`. An
 * unreachable guard costs a branch it can never pay back, so it is `unwrap` here — the spelling
 * `fitFootprintToDetails` uses at the same kind of position — rather than a `null` the template then
 * has to explain.
 */
const blockExtent = computed((): number => {
	let low = Number.POSITIVE_INFINITY;
	let high = Number.NEGATIVE_INFINITY;
	for (const detail of props.shape.details.filter((item) => props.ids.includes(item.id))) {
		const box = unwrap(detailBox(detail));
		low = Math.min(low, axis.value === 'x' ? box.min.x : box.min.y);
		high = Math.max(high, axis.value === 'x' ? box.max.x : box.max.y);
	}
	return high - low;
});

/** What one copy steps on from the one before, under whichever reading the mode names. */
const step = computed((): number | null => {
	if (!Number.isFinite(typedSpacing.value)) return null;
	return mode.value === 'centres' ? typedSpacing.value : blockExtent.value + typedSpacing.value;
});

/** The preview, or `null` while the form does not describe a repeat that could happen. */
const preview = computed((): string | null => {
	const resolved = step.value;
	if (resolved === null || !Number.isInteger(typedCount.value) || typedCount.value < 1 || typedCount.value > MAX_REPEAT_COPIES) {
		return null;
	}
	return tr('designer.arrange.repeat.preview', { count: String(typedCount.value), step: String(Math.round(resolved)) });
});

function run(): void {
	void props.commit((current) =>
		repeatDetails(current, { ids: props.ids, count: typedCount.value, axis: axis.value, spacing: typedSpacing.value, mode: mode.value }),
	);
}
</script>

<template>
	<h3 class="rp-designer-panel-title rp-designer-section-title">
		{{ tr('designer.arrange.repeat') }}
	</h3>
	<DesignerFieldRowShell short="designer.arrange.repeat.count">
		<input
			type="number"
			name="repeat-count"
			min="1"
			:max="MAX_REPEAT_COPIES"
			step="1"
			inputmode="numeric"
			:aria-label="tr('designer.arrange.repeat.count')"
			:value="count"
			@input="count = ($event.target as HTMLInputElement).value"
		>
	</DesignerFieldRowShell>
	<DesignerFieldRowShell
		short="designer.arrange.repeat.spacing.short"
		unit="mm"
	>
		<input
			type="number"
			name="repeat-spacing"
			step="any"
			inputmode="decimal"
			:aria-label="tr('designer.arrange.repeat.spacing')"
			:value="spacing"
			@input="spacing = ($event.target as HTMLInputElement).value"
		>
	</DesignerFieldRowShell>
	<label class="rp-designer-field">
		{{ tr('designer.arrange.repeat.axis') }}
		<select
			v-model="axis"
			name="repeat-axis"
		>
			<option
				v-for="value in AXES"
				:key="value"
				:value="value"
			>
				{{ tr(`designer.arrange.repeat.axis.${value}`) }}
			</option>
		</select>
	</label>
	<label class="rp-designer-field">
		{{ tr('designer.arrange.repeat.mode') }}
		<select
			v-model="mode"
			name="repeat-mode"
		>
			<option
				v-for="value in MODES"
				:key="value"
				:value="value"
			>
				{{ tr(`designer.arrange.repeat.mode.${value}`) }}
			</option>
		</select>
	</label>
	<p
		v-if="preview !== null"
		class="rp-designer-field-hint"
		data-rp-preview="repeat"
	>
		{{ preview }}
	</p>
	<div class="rp-designer-selection-actions">
		<button
			type="button"
			class="rp-designer-selection-button"
			name="repeat-run"
			@click="run"
		>
			{{ tr('designer.arrange.repeat.run') }}
		</button>
	</div>
</template>
