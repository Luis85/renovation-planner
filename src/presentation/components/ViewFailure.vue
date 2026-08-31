<script setup lang="ts">
/**
 * A view's content replaced by the reason it has none — design slice 17's one new container,
 * and the only surface this slice adds beyond slices 13/15/16.
 *
 * **It is deliberately not `EmptyState.vue`, and the difference is not styling.** An empty
 * state claims the data is legitimately absent and offers onboarding; showing "create your
 * first project" because a vault read failed is actively misleading, which is the objection
 * slice 14 raises when it defers this case here. `EmptyState` is generic enough to have been
 * reused — resolved strings in, one `action` out — and that is precisely the reason not to:
 * reusing it would make "never an empty state" a convention about the copy, where two
 * components make it a fact about the markup. It also keeps `.rp-empty-state` meaning what
 * every existing assertion and the axe case already take it to mean.
 *
 * Like `EmptyState`, it takes RESOLVED strings and knows nothing about i18n, so the composing
 * view owns the copy and a future Budget or Schedule view can reuse this without depending on
 * this slice.
 *
 * `role="alert"` rather than a plain region: this replaces a whole view's content because
 * something failed that the user did not ask to fail, which is the case an assertive
 * announcement exists for. It is not a persistent live region — the element mounts with the
 * failure and unmounts with it, so there is no stale container to announce into later.
 *
 * **The action is OPTIONAL and its absence is a decision the caller makes**, which is what
 * lets one component carry all three of this slice's states: a failed hydration offers a
 * retry, a dangling plan reference offers a way out of the tab, and a bootstrap failure
 * offers NOTHING, because nothing was composed to re-run and slice 1 already refused a
 * repair UI.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`.
 * `styles/view-failure.css` is this component's only entry point into the assembled sheet.
 */
defineProps<{
	readonly headline: string;
	readonly body: string;
	readonly actionLabel?: string;
}>();
defineEmits<{ action: [] }>();
</script>

<template>
	<div
		class="rp-view-failure"
		role="alert"
	>
		<div class="rp-view-failure__panel">
			<h2 class="rp-view-failure__headline">
				{{ headline }}
			</h2>
			<p class="rp-view-failure__body">
				{{ body }}
			</p>
			<button
				v-if="actionLabel !== undefined"
				type="button"
				class="rp-view-failure__action"
				@click="$emit('action')"
			>
				{{ actionLabel }}
			</button>
		</div>
	</div>
</template>
