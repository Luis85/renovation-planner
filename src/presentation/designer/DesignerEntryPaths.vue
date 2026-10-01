<script setup lang="ts">
/**
 * The ways into a new object that the empty state does NOT already rank (AD07).
 *
 * `EmptyState` draws one primary action; this is the rest of them, each calling the very function
 * that path's ranked caller calls, so the two spellings of one gesture cannot drift.
 *
 * **Its own component because the root's template breached fallow's cognitive-complexity threshold
 * when these arrived.** They are the branchiest thing in it and the least to do with the shell
 * around them, so they moved rather than the finding being suppressed — this repository's standing
 * answer to a complexity gate.
 *
 * `.rp-empty-state__action` is not decoration: `styles/empty-state.css` hangs `pointer-events: auto`
 * and this surface's readable focus ring off exactly that class, and an overlay's children are
 * `pointer-events: none` otherwise. They wear no second class — the cases find them by their WORDS,
 * and a `.rp-designer-entry-path` hook was added once and reached by nothing (AD07 review).
 *
 * Each is offered only where it is not already the ranked action, and the reference path only where
 * a picker is bound at all — slice 14's Amendment 1 reaches an alternative exactly as it reaches a
 * primary.
 */
import { tr } from '../i18n/strings';

defineProps<{
	emptyStateKey: 'noShape' | 'noBackground' | null;
	/** Whether a file picker is bound at all. No picker, no way to choose a reference. */
	hasPicker: boolean;
	editDimensions: () => Promise<void>;
	traceReference: () => Promise<void>;
	startFromPreset: () => Promise<void>;
}>();
</script>

<template>
	<button
		v-if="emptyStateKey === 'noBackground'"
		type="button"
		class="rp-empty-state__action"
		@click="() => void editDimensions()"
	>
		{{ tr('empty.asset.no-shape.action') }}
	</button>
	<button
		v-if="emptyStateKey === 'noShape' && hasPicker"
		type="button"
		class="rp-empty-state__action"
		@click="() => void traceReference()"
	>
		{{ tr('empty.asset.no-background.action') }}
	</button>
	<button
		type="button"
		class="rp-empty-state__action"
		@click="() => void startFromPreset()"
	>
		{{ tr('designer.inspector.start-preset') }}
	</button>
</template>
