<script setup lang="ts">
/**
 * One row of design slice 10's Requirements panel: the asset it links, its effective
 * quantity and cost with §52's overridden/calculated distinction rendered for each
 * INDEPENDENTLY, and the two override controls.
 *
 * Its own component rather than a block in `InspectorPanel.vue`, and the reason is
 * measured rather than stylistic: the inline version put the whole panel's template at
 * cognitive complexity 31 over 248 lines, which `npm run analyze` reports as a refactoring
 * target. Splitting it also retires the two draft `Map`s the panel kept keyed by
 * requirement id — a component instance per row already IS that keying, and a Map outlives
 * the row it describes while a component instance does not.
 *
 * It DISPATCHES nothing. Both controls emit a typed value and the panel commits it through
 * `runtime.commitEdit`, which is the Inspector's ONE commit path (SDD §59); a row that
 * dispatched directly would be a second seam with its own refresh and history behaviour.
 */
import { ref } from 'vue';
import { of as moneyOf } from '../../../core/money/Money';
import type { Money } from '../../../core/money/Money';
import type { RequirementInspectorDTO } from '../../../application/queries/GetRequirementsForZone';
import { tr } from '../../i18n/strings';

const props = defineProps<{ row: RequirementInspectorDTO }>();
const emit = defineEmits<{
	/** `null` is "reset to calculated" — a VALUE in this seam, so undoing a reset restores the figure. */
	'set-quantity': [quantity: number | null];
	'set-cost': [cost: Money | null];
}>();

const quantityDraft = ref('');
const costDraft = ref('');

/** An unparseable draft resets rather than refusing: the command owns what a valid figure is. */
function applyQuantity(): void {
	const parsed = quantityDraft.value.trim() === '' ? null : Number(quantityDraft.value);
	emit('set-quantity', parsed !== null && Number.isFinite(parsed) ? parsed : null);
}

function applyCost(): void {
	const raw = costDraft.value.trim();
	emit('set-cost', raw === '' ? null : moneyOf(raw, props.row.cost.effective.currency));
}

function resetQuantity(): void {
	quantityDraft.value = '';
	applyQuantity();
}

function resetCost(): void {
	costDraft.value = '';
	applyCost();
}
</script>

<template>
	<li class="rp-editor-requirement">
		<p
			v-if="row.recalculationStatus === 'stale'"
			class="rp-editor-requirement-stale"
		>
			{{ tr('editor.inspector.requirement.stale') }}
		</p>
		<dl class="rp-editor-inspector-fields">
			<dt>{{ tr('editor.inspector.requirement.asset') }}</dt>
			<!-- An asset that is gone renders from its ID plus the reason, which is why
			     `assetName` is nullable: typed `string`, this row could not be built at all. -->
			<dd v-if="row.missingTarget !== null">
				{{ row.assetId }} — {{ tr('editor.inspector.requirement.missing-asset') }}
			</dd>
			<dd v-else>
				{{ row.assetName ?? row.assetId }}
			</dd>

			<dt>{{ tr('editor.inspector.requirement.quantity') }}</dt>
			<dd>
				{{ row.quantity.effective.toString() }} {{ row.unit }}
				<template v-if="row.quantity.override !== null">
					<span class="rp-editor-requirement-badge">
						{{ tr('editor.inspector.requirement.overridden') }}
					</span>
					<!-- The calculated figure stays visible beside the override: a badge alone
					     would hide the number the user is overriding. -->
					<span>({{ row.quantity.calculated.toString() }})</span>
				</template>
			</dd>

			<dt>{{ tr('editor.inspector.requirement.cost') }}</dt>
			<dd>
				{{ row.cost.effective.amount }} {{ row.cost.effective.currency }}
				<template v-if="row.cost.override !== null">
					<span class="rp-editor-requirement-badge">
						{{ tr('editor.inspector.requirement.overridden') }}
					</span>
					<span>({{ row.cost.calculated.amount }})</span>
				</template>
			</dd>
		</dl>

		<div class="rp-editor-requirement-overrides">
			<label :for="`rp-qty-${row.requirementId}`">
				{{ tr('editor.inspector.quantity-override.label') }} {{ row.assetName }}
			</label>
			<input
				:id="`rp-qty-${row.requirementId}`"
				v-model="quantityDraft"
				type="text"
			>
			<button
				type="button"
				@click="applyQuantity"
			>
				{{ tr('editor.inspector.override.apply') }}
			</button>
			<button
				type="button"
				@click="resetQuantity"
			>
				{{ tr('editor.inspector.override.reset') }}
			</button>

			<label :for="`rp-cost-${row.requirementId}`">
				{{ tr('editor.inspector.cost-override.label') }} {{ row.assetName }}
			</label>
			<input
				:id="`rp-cost-${row.requirementId}`"
				v-model="costDraft"
				type="text"
			>
			<button
				type="button"
				@click="applyCost"
			>
				{{ tr('editor.inspector.override.apply') }}
			</button>
			<button
				type="button"
				@click="resetCost"
			>
				{{ tr('editor.inspector.override.reset') }}
			</button>
		</div>
	</li>
</template>
