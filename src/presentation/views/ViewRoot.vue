<script setup lang="ts">
/**
 * The Vue root of the Renovation Project view — one isolated app per Obsidian `ItemView`
 * (ADR-004, SDD §12).
 *
 * It draws real content now: an empty state when the vault holds no projects (design slice
 * 14), the mapped failure message when the read refused, a loading line while it is in
 * flight, and a warning strip when some project notes could not be read. It still draws
 * NO list — slice 17 owns that — so the four states above are, between them, everything
 * this component renders. For every slice before slice 14 it drew nothing at all, and that
 * used to be the increment's stated success criterion rather than an omission — "an empty
 * Renovation Planner view opens reliably inside Obsidian". That claim stopped being true
 * then, so it stopped being said here.
 *
 * Failure and loading share one region and the empty state is not one of them: a failed
 * read is not "legitimately nothing yet", and `emptyStateKey` is `null` from any status but
 * `'ready'`, so the two can never be drawn together. The warning strip is the one additive
 * one — a partial read still shows what loaded.
 *
 * No `<style>` block, ever: `vue/no-restricted-block` fails one, because Obsidian's
 * marketplace rejects inline styles and this plugin's CSS lives in `styles/`, assembled
 * into one sheet. The class below is that sheet's only entry point into this view.
 *
 * Slice 15's `DialogHost` mounts here too, not only in the Plan Editor. Not because of an
 * empty-state action: `renovationProject.noProjects` ships with no button at all (slice
 * 14's Amendment 1), so there is no click here yet for `DialogHost` to answer. It mounts
 * because this is one of the two ItemView-scoped Vue apps SDD §12 has the dialog
 * framework mount into (slice 15), and because a later slice's project-creation form —
 * the "Create a project" hand-off `noProjects` names but does not wire — will open from
 * this tree once it exists. A host that mounted only beside a `PlanCanvas` would leave
 * that future form with nothing to open from.
 */
import { computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import DialogHost from '../dialogs/DialogHost.vue';
import EmptyState from '../components/EmptyState.vue';
import { EMPTY_STATE_CONTENT } from '../emptyStates/content';
import { resolveEmptyState } from '../emptyStates/resolve';
import { useRenovationProjectContext } from './RenovationProjectContext';
import { useRenovationProjectStore } from '../stores/RenovationProjectStore';
import { tr } from '../i18n/strings';
import { trError } from '../i18n/toUserMessage';

const context = useRenovationProjectContext();
const store = useRenovationProjectStore();
const { emptyStateKey, status, error, unreadable } = storeToRefs(store);

/**
 * `null` for no empty state (a normal render, once slice 17's project list exists to draw),
 * or the resolved props for the one key this slice's registry declares
 * (`renovationProject.noProjects`). `EMPTY_STATE_CONTENT.renovationProject` is keyed to
 * match `selectRenovationProjectEmptyState`'s own return type, so a widened selector fails
 * here at the type of this lookup rather than at a runtime `undefined`.
 */
const empty = computed(() => {
	const key = emptyStateKey.value;
	return key === null ? null : resolveEmptyState(EMPTY_STATE_CONTENT.renovationProject[key]);
});

/**
 * The reader `store.error` did not have. `trError` is what turns the stored `AppError` into
 * the sentence for its own code — so unrecovered settings say so, and a vault fault says
 * something else — rather than one generic line standing in for both.
 *
 * Non-null exactly when `status === 'failed'`: `hydrate` clears it before every read and
 * `fail` is the only writer. Branching on the message rather than on the status keeps this
 * to one arm instead of two.
 */
const failureMessage = computed(() => (error.value === null ? null : trError(error.value)));

onMounted(() => {
	void store.hydrate(context.queries);
});
</script>

<template>
	<div class="renovation-planner-view">
		<template v-if="status === 'ready'">
			<EmptyState
				v-if="empty !== null"
				v-bind="empty"
			/>
			<p
				v-if="unreadable > 0"
				class="rp-view-notice"
				role="status"
			>
				{{ tr('view.project.some-unreadable') }}
			</p>
		</template>
		<div
			v-else
			class="rp-view-message"
		>
			<p v-if="failureMessage !== null">
				{{ failureMessage }}
			</p>
			<p v-else>
				{{ tr('view.project.loading') }}
			</p>
		</div>
		<DialogHost />
	</div>
</template>
