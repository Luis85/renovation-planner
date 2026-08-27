<script setup lang="ts">
/**
 * One empty state, used two ways (PRD §94, design slice 14).
 *
 * It imports no command, no query, no store and no Obsidian API, and it takes RESOLVED
 * strings rather than i18n keys — so a future Budget, Schedule or Procurement view can reuse
 * it without depending on this slice's registry or on Plan/Project types at all. The
 * composing view resolves `EMPTY_STATE_CONTENT`'s keys through `resolveEmptyState` and passes
 * the results down; this component never learns that i18n exists.
 *
 * `overlay` is the Plan Editor's form. The canvas there is ALWAYS mounted (see the slice's
 * 2026-08-26 amendment), because `create-sample-project` seeds a plan with no background and
 * five zones and the browser harness refuses a background outright — so replacing the region
 * would hide the one thing both exist to show. `styles/empty-state.css` hangs the
 * `pointer-events` pair off this modifier: the panel lets a pan or a zoom through, the button
 * does not.
 *
 * Promoted from `src/prototypes/EmptyState.vue` by MOVING the file. Only this script block
 * differs from the mock, and not only by losing the mock's placeholder defaults: the mock
 * was visual-only and wired no click at all, so the template also gained
 * `@click="$emit('action')"` here — without it the promoted component's `action` event
 * would have been unreachable. `tests/build/prototype-promotion.test.ts` holds templates
 * byte-identical across promotion for exactly one file pair (`ZoneSummary.vue`) and does
 * not cover this one, so nothing caught that gap automatically; CLAUDE.md's design-slice-14
 * entry records it as the reason promotion is not always a byte-for-byte move.
 */
import type { EmptyStateProps } from '../emptyStates/resolve';

defineProps<EmptyStateProps & { overlay?: boolean }>();
defineEmits<{ action: [] }>();
</script>

<template>
	<div
		class="rp-empty-state"
		:class="{ 'rp-empty-state--overlay': overlay }"
	>
		<div class="rp-empty-state__panel">
			<div class="rp-empty-state__icon">
				<slot name="icon" />
			</div>
			<h2 class="rp-empty-state__headline">
				{{ headline }}
			</h2>
			<p class="rp-empty-state__body">
				{{ body }}
			</p>
			<button
				v-if="actionLabel !== undefined"
				type="button"
				class="rp-empty-state__action"
				@click="$emit('action')"
			>
				{{ actionLabel }}
			</button>
		</div>
	</div>
</template>
