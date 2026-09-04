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
 * **The STATE is read, and the number still comes from `rooms.length` (R12).** `roomCount.state`
 * says whether the count is trustworthy — `'partial'` means some of this floor's records could
 * not be read, and the sentence withholds the number rather than presenting a lower bound as
 * complete — while the count itself is still `rooms.length`, the same figure `roomCount.value`
 * carries by construction. Reading the state costs nothing past the `unavailable` arm
 * `counted()` never produces for `roomCount`: the three-way `body` below only ever asks
 * `s.roomCount.state === 'partial'`, never `.value`, so there is no `unavailable` branch to
 * narrow past.
 *
 * The plan may be `null` — a leaf restored into a narrow pane draws this before the first
 * hydrate lands, and a plan that is missing or unreadable never gets one at all. The headline
 * and the action hold in every one of those cases, so they render unconditionally; the body is
 * the only part that needs a floor to be about, and it is what withdraws.
 */
import { computed } from 'vue';
import { tr } from '../../i18n/strings';
import { usePlanEditorContext } from '../PlanEditorContext';
import { useFloorSummary } from './useFloorSummary';

const context = usePlanEditorContext();
const summary = useFloorSummary();

/** Three sentences for one count (R12): a partial count is OMITTED rather than presented as complete. */
const body = computed(() => {
	const s = summary.value;
	if (s === null) return null;
	if (s.roomCount.state === 'partial') return tr('editor.unsupported-width.body.partial', { floor: s.floor.name });
	if (s.rooms.length === 1) return tr('editor.unsupported-width.body.one', { floor: s.floor.name });
	return tr('editor.unsupported-width.body.other', { floor: s.floor.name, rooms: String(s.rooms.length) });
});
</script>

<template>
	<div class="rp-unsupported-width">
		<h2 class="rp-unsupported-width__headline">
			{{ tr('editor.unsupported-width.headline') }}
		</h2>
		<p
			v-if="body !== null"
			class="rp-unsupported-width__body"
		>
			{{ body }}
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
