<script setup lang="ts">
/**
 * The four-side clearance helper (AD12 item 4, contract C07): four allowances around a
 * rectangular outline, which GENERATE a boundary.
 *
 * **It generates and never reads back.** C07 is explicit — *"Keep arbitrary traced boundaries …
 * do not infer four setbacks from an arbitrary curved polygon"* — so the fields start EMPTY
 * whatever boundary the object already has, and nothing here ever turns an existing clearance
 * into four numbers. An arbitrary traced polygon is therefore untouched by this panel until the
 * user presses the button, and the warning above it says the press replaces what is there.
 *
 * **It is WITHHELD rather than disabled where the geometry is not supported.** A live control
 * that can only refuse is the defect this repository has already paid for (AD10's review, and
 * `DesignerArrangePanel`'s own docblock); the predicate is `rectangularFootprint` for the
 * outline and `facingQuarter` for the direction, and where either answers `null` the panel says
 * what it needs and offers no fields. Both halves are real: four setbacks mean nothing against a
 * traced curve, and "left" and "right" mean nothing while the front points between two axes.
 *
 * **The generated boundary takes the FOOTPRINT's coordinate space**, so `clearancePending`
 * becomes `footprintPending` — the same rule `DesignerReferencePlacement` applies to a derived
 * anchor, and C07's refusal to combine two coordinate spaces silently.
 *
 * **Nothing here validates a number.** A setback that overflows, or one so negative it collapses
 * the rectangle, reaches `validateAssetShape` through the same door every other edit takes and
 * comes back as a coded refusal this panel shows. A guard here would be a second answer to a
 * question the domain already answers, and would leave that validator's own arm unreachable.
 *
 * **AD18-R17 (board 01) put three things around those fields, and none of them is stored.**
 * `All sides` is one field whose typing fills all four drafts; what it SHOWS is derived from them —
 * the shared text while the four agree, blank the moment one side differs — so there is no fifth
 * draft to fall out of step, and `generate` reads the four exactly as before. The four fields move
 * into an `Advanced` fold, the Arrange panel's bare `.rp-designer-collapsible`, closed by default
 * with its open state its own. And `Show clearance` is a switch over the leaf runtime's
 * `showClearance`, which hides the canvas's clearance layer: a VIEW preference (AD18-R12's kind),
 * drawn only when there is a clearance to hide, and outside the `supported` arm because hiding a
 * traced curve means as much as hiding a generated rectangle. The switch and the fold are drawn by
 * `DesignerClearanceToggle` and `DesignerClearanceSides`, split out to keep this template under
 * fallow's cognitive threshold; the drafts and the switch-on after Generate stay here.
 */
import { computed, reactive, ref } from 'vue';
import { useShowClearance } from '../runtime';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { AppError } from '../../../core/errors/AppError';
import { validateAssetShape } from '../../../domain/asset/AssetShape';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import type { EditShape } from '../selection/editShape';
import { clearanceRectangle, facingQuarter, rectangularFootprint, type ClearanceSetbacks } from '../../../domain/asset/referenceFrame';
import DesignerFieldRowShell from './DesignerFieldRowShell.vue';
import DesignerClearanceToggle from './DesignerClearanceToggle.vue';
import DesignerClearanceSides from './DesignerClearanceSides.vue';

const props = defineProps<{ design: AssetDesignDto; editShape: EditShape }>();

type Side = keyof ClearanceSetbacks;

const SIDES: readonly { readonly side: Side; readonly label: StringKey; readonly short: StringKey }[] = [
	{ side: 'front', label: 'designer.clearance.front', short: 'designer.clearance.front.short' },
	{ side: 'back', label: 'designer.clearance.back', short: 'designer.clearance.back.short' },
	{ side: 'left', label: 'designer.clearance.left', short: 'designer.clearance.left.short' },
	{ side: 'right', label: 'designer.clearance.right', short: 'designer.clearance.right.short' },
];

/**
 * Raw TEXT until the button commits it (C03): a parsed number written back through `:value` on
 * every keystroke corrupts a prefix that parses to `NaN` and makes a leading decimal point
 * untypeable. `Number` is applied once, in `generate`.
 */
const draft = reactive<Record<Side, string>>({ front: '', back: '', left: '', right: '' });
/** The four drafts' shared text, or blank once they disagree — derived, never a fifth draft. */
const allSides = computed(() => (SIDES.every(({ side }) => draft[side] === draft.front) ? draft.front : ''));
function fillAllSides(value: string): void {
	for (const { side } of SIDES) draft[side] = value;
}
function setSide(side: Side, value: string): void {
	draft[side] = value;
}
/** `null` on a bare mount with no leaf runtime — see `useShowClearance`. */
const showClearance = useShowClearance();
const refusal = ref<AppError | null>(null);

const shape = computed(() => props.design.shape);
/** The supported geometry, or `null` — what decides whether the fields are drawn at all. */
const box = computed(() => (shape.value === null ? null : rectangularFootprint(shape.value.footprint)));
const quarter = computed(() => (shape.value === null ? null : facingQuarter(shape.value.facing)));
const supported = computed(() => box.value !== null && quarter.value !== null);
const replaces = computed(() => shape.value !== null && shape.value.clearance !== null);

async function generate(): Promise<void> {
	const result = await props.editShape((design) => {
		// Re-derived from the shape the STEP was handed, never from the render: a peer leaf may
		// have replaced the footprint since this panel drew its fields, and a boundary generated
		// against the box on screen would then stand off an outline that is no longer there.
		const current = rectangularFootprint(design.footprint);
		const turn = facingQuarter(design.facing);
		if (current === null || turn === null) return null;
		const setbacks: ClearanceSetbacks = {
			front: Number(draft.front),
			back: Number(draft.back),
			left: Number(draft.left),
			right: Number(draft.right),
		};
		return validateAssetShape({
			...design,
			clearance: { points: clearanceRectangle(current, turn, setbacks) },
			clearancePending: design.footprintPending,
			// Regenerating the boundary IS the review: this gesture replaces the clearance
			// outright, so whatever a resize flagged about the old one is answered. The site
			// AD14's own grep could not reach, because this file is in no wave-5 row — the card
			// filed it as a change request and shipped the assertion that fails without it.
			clearanceNeedsReview: false,
		});
	});
	refusal.value = result.ok ? null : result.error;
	// A boundary the user just asked for is never born invisible: Generate switches the layer back on.
	if (result.ok && showClearance !== null) showClearance.value = true;
}
</script>

<template>
	<section
		v-if="shape !== null"
		class="rp-designer-clearance"
	>
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.clearance') }}
		</h3>
		<DesignerClearanceToggle v-if="replaces" />
		<template v-if="supported">
			<p class="rp-designer-field-hint">
				{{ tr('designer.clearance.hint') }}
			</p>
			<DesignerFieldRowShell
				short="designer.clearance.all-sides.short"
				unit="mm"
			>
				<input
					type="number"
					step="any"
					inputmode="decimal"
					name="clearance-all-sides"
					:aria-label="tr('designer.clearance.all-sides')"
					:value="allSides"
					@input="fillAllSides(($event.target as HTMLInputElement).value)"
				>
			</DesignerFieldRowShell>
			<DesignerClearanceSides
				:sides="SIDES"
				:draft="draft"
				:on-side="setSide"
			/>
			<p
				v-if="replaces"
				class="rp-designer-unscaled"
			>
				{{ tr('designer.clearance.replaces') }}
			</p>
			<button
				type="button"
				name="generate-clearance"
				class="rp-designer-selection-button"
				@click="() => void generate()"
			>
				{{ tr('designer.clearance.generate') }}
			</button>
			<p
				v-if="refusal !== null"
				role="alert"
				class="rp-designer-selection-error"
			>
				{{ trError(refusal) }}
			</p>
		</template>
		<p
			v-else
			class="rp-designer-field-hint"
		>
			{{ tr('designer.clearance.unsupported') }}
		</p>
	</section>
</template>
