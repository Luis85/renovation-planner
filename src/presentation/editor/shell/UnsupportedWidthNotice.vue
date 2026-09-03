<script setup lang="ts">
/**
 * What a pane narrower than `CONSTRAINED_MIN_PX` gets instead of a canvas (design spec §5.4):
 * which floor this tab is showing, how many rooms are on it, and the one action available —
 * `PlanEditorContext.focusLeaf()`, which asks Obsidian to reveal this leaf so the workspace
 * gives it an active tab's width.
 *
 * **A summary rather than a bare apology**, because the state is reachable by simply dragging
 * a split: a user who cannot see the plan can still see which plan it is and roughly how big
 * it is. `useFloorSummary` is the same derivation `FloorInspector` renders — one answer to
 * "what is on this floor", read here as one sentence and there as five stats and two lists.
 *
 * **`rooms.length` rather than `roomCount.value`.** They are the same number by construction —
 * `buildFloorSummary` counts one from the other — and the `Aggregate` union admits an
 * `unavailable` state that `counted()` never returns for either, so reading the aggregate here
 * would mean narrowing past a branch no test could ever take. The `partial` annotation a
 * `roomCount` can carry belongs to the Inspector, which has room to explain it; this sentence
 * is a glance.
 *
 * The plan may be `null` — a leaf restored into a narrow pane draws this before the first
 * hydrate lands, and a plan that is missing or unreadable never gets one at all. The headline
 * and the action hold in every one of those cases, so they render unconditionally; the body is
 * the only part that needs a floor to be about, and it is what withdraws.
 */
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useFloorSummary } from './useFloorSummary';

const context = usePlanEditorContext();
const summary = useFloorSummary();
</script>

<template>
	<div class="rp-unsupported-width">
		<h2 class="rp-unsupported-width__headline">
			{{ tr('editor.unsupported-width.headline') }}
		</h2>
		<p
			v-if="summary !== null"
			class="rp-unsupported-width__body"
		>
			{{ tr('editor.unsupported-width.body', { floor: summary.floor.name, rooms: String(summary.rooms.length) }) }}
		</p>
		<button
			type="button"
			class="rp-unsupported-width__action"
			@click="context.focusLeaf()"
		>
			{{ tr('editor.unsupported-width.action') }}
		</button>
	</div>
</template>
