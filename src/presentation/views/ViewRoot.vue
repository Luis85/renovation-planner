<script setup lang="ts">
/**
 * The Vue root of the Renovation Project view — one isolated app per Obsidian `ItemView`
 * (ADR-004, SDD §12).
 *
 * It draws its first real content now (design slice 14): a list of projects, and an empty
 * state when the vault has none. For every slice before this one it drew nothing at all,
 * and that used to be the increment's stated success criterion rather than an omission —
 * "an empty Renovation Planner view opens reliably inside Obsidian". That claim stops being
 * true in this commit, so it stops being said here.
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

const context = useRenovationProjectContext();
const store = useRenovationProjectStore();
const { emptyStateKey } = storeToRefs(store);

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

onMounted(() => {
	void store.hydrate(context.queries);
});
</script>

<template>
	<div class="renovation-planner-view">
		<EmptyState
			v-if="empty !== null"
			v-bind="empty"
		/>
		<DialogHost />
	</div>
</template>
