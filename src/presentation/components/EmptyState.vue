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
import { computed } from 'vue';
import type { EmptyStateProps } from '../emptyStates/resolve';

const props = defineProps<EmptyStateProps & { overlay?: boolean; headingLevel?: 2 | 3 }>();
defineEmits<{ action: [] }>();

/**
 * The headline was a hard-coded `<h2>`, which is right for the two callers that REPLACE a
 * view's whole content region and wrong for one that EMBEDS this component inside a section
 * of its own. `ProjectDetail` is the second kind: its project name is an `<h2>`, so an
 * embedded `<h2>` announced "No plans yet" as a PEER of the project rather than as content of
 * its plans region — and that is the branch a just-created project always lands in.
 *
 * Optional with a default of 2, so the existing callers say nothing and keep the level they
 * had. The union is `2 | 3` rather than `number` because those are the two levels this
 * component can legally sit at today, and a widened type would be a promise no caller checks.
 *
 * Found by a review bot on the pull request. Worth noting what did NOT find it: Task 7 added a
 * heading-order case in the same commit, for the POPULATED branch — the defect lives in the
 * other one. A check written for the case its author had in mind, again.
 */
const headingTag = computed<'h2' | 'h3'>(() => (props.headingLevel === 3 ? 'h3' : 'h2'));
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
			<component
				:is="headingTag"
				class="rp-empty-state__headline"
			>
				{{ headline }}
			</component>
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
