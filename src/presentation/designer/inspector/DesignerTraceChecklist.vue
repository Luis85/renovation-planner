<script setup lang="ts">
/**
 * The guided trace sequence (AD18 item 7), as a checklist whose current step is marked.
 *
 * **FIVE steps, not the board's six.** Board 02 draws *choose image → calibrate scale → lock
 * reference → trace footprint → add details → verify dimensions*, and **AD12-R1 deletes step 3 and
 * only step 3**: every designer layer is built `listening: false` and no tool moves the
 * background, so "lock reference" names a property that already holds. A step for it would be a
 * checklist row that is permanently ticked — the live control that does nothing, in checklist
 * form. The other five are AD12 card item 1's guided sequence and are not ruled out. The count is
 * asserted rather than described: `designerTraceChecklist.test.ts` requires exactly five rows AND
 * pins the five keys in order, so a sixth arriving without a ruling turns it red.
 *
 * **Every step's done-ness is READ off the design, never stored.** Nothing in this repository
 * records which step a user believes they are on, and a remembered cursor would be a second
 * authority for a fact the geometry already answers — the shape `DesignerReferenceStatus`'s
 * pending flags exist to avoid one layer down. So the sequence cannot go stale, and it cannot be
 * wrong about a change made in a peer leaf.
 *
 * **"Verify the dimensions" is the one step whose NAME is wider than its check, and the sentence
 * has to say so.** A user's own look at the numbers is not observable from here; what is
 * observable is that the footprint measures in real units with no coordinate group left in sheet
 * pixels, which is the state that makes the numbers worth looking at. That is what this row
 * reports, and it is why `pendingCount` is a prop rather than a re-derivation: the four flags
 * behind it are already read once, in `DesignerReferenceStatus`, and reading them twice is how two
 * answers to one question start.
 *
 * **The current step is the first one that is neither DONE nor OPTIONAL.** Not "the last done plus
 * one": the steps can complete OUT OF ORDER — an asset typed from dimensions has a footprint and no
 * sheet — and a cursor derived from the furthest progress would skip the row that is actually owed.
 * Once no such step is left nothing is marked, because a finished sequence has no next thing to do
 * and marking a row would say otherwise.
 *
 * **`Add details` is the one OPTIONAL step, by ruling AD18-R4 — do not "fix" this back to
 * first-not-done.** Interior linework is optional; plenty of assets are a bare outline. So it still
 * TICKS when details exist, and it is skipped when choosing which step is current: a sheet-traced
 * asset that is finished except for details has NO current step, where first-not-done would have
 * read as permanently unfinished. The ruling records what lost — leaving it as-is (the cursor then
 * aims a typed-from-dimensions asset at the step that user deliberately skipped) and ending the
 * sequence at `Verify the dimensions` (a struck row could then sit below an unstruck optional one
 * with nothing marked at all).
 *
 * **Optionality lives in the same PAIR as the key and the condition**, for the reason the pair
 * itself exists: a parallel list of which steps are optional is a second source that drifts by one
 * index, silently.
 *
 * **`aria-current="step"` on the row itself, never an `aria-label` on a role-less element.** The
 * accessibility gate found exactly that defect on the Plan Editor. The rows are real `<li>`s in a
 * real `<ol>`, so their order and position are announced by the list rather than by markup this
 * file invents. Done-ness is struck through in CSS, which no screen reader reads, so a finished row
 * also carries `designer.trace.done` in a visually hidden span — `data-rp-done` is for the
 * stylesheet and for the suites, and is announced by nothing.
 */
import { computed } from 'vue';
import type { AssetDesignDto } from '../../../application/queries/GetAssetDesign';
import type { StringKey } from '../../i18n/locales/en';
import { tr } from '../../i18n/strings';

const props = defineProps<{
	design: AssetDesignDto;
	/**
	 * How many coordinate groups are still in the sheet's own pixels, from
	 * `DesignerReferenceStatus`'s own `pending` list. A count rather than the list: this component
	 * names no group, it only asks whether any is left.
	 */
	pendingCount: number;
}>();

interface TraceStep {
	readonly key: StringKey;
	readonly done: boolean;
	readonly current: boolean;
}

const steps = computed((): readonly TraceStep[] => {
	const shape = props.design.shape;
	// Built as whole rows rather than a key list beside a boolean list, so a step's label, its
	// condition and its optionality cannot drift apart by one index — the failure a parallel-array
	// spelling makes silent.
	const progress = [
		{ key: 'designer.trace.image', done: props.design.background !== null, optional: false },
		{ key: 'designer.trace.scale', done: props.design.calibration !== null, optional: false },
		{ key: 'designer.trace.footprint', done: shape !== null, optional: false },
		{ key: 'designer.trace.details', done: shape !== null && shape.details.length > 0, optional: true },
		// `dimensions` is `null` exactly when there is no footprint to measure (`GetAssetDesign`
		// derives it from the shape, and refuses rather than nulling an unmeasurable one), so this
		// does not have to ask about the shape a second time.
		{ key: 'designer.trace.dimensions', done: props.design.dimensions !== null && props.pendingCount === 0, optional: false },
	] as const;
	const current = progress.findIndex((step) => !step.done && !step.optional);
	return progress.map((step, index) => ({ ...step, current: index === current }));
});
</script>

<template>
	<section class="rp-designer-trace">
		<h3 class="rp-designer-panel-title rp-designer-section-title">
			{{ tr('designer.trace') }}
		</h3>
		<ol class="rp-designer-trace-steps">
			<li
				v-for="step in steps"
				:key="step.key"
				class="rp-designer-trace-step"
				:data-rp-done="step.done"
				:aria-current="step.current ? 'step' : undefined"
			>
				{{ tr(step.key) }}
				<span
					v-if="step.done"
					class="rp-visually-hidden"
				>{{ tr('designer.trace.done') }}</span>
			</li>
		</ol>
	</section>
</template>
