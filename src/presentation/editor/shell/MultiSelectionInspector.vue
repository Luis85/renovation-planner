<script setup lang="ts">
import { nextTick, ref } from 'vue';
import { tr } from '../../i18n/strings';
import type { SpatialSelection } from '../selection/spatialSelection';
import { useSelectionStore } from '../selection/selection-store';
import type { EntityId } from '../../../core/identity/EntityId';
import { formatArea } from './formatArea';
import { zoneTypeLabel } from './zoneTypeLabel';

defineProps<{ selection: Extract<SpatialSelection, { kind: 'multiple' }> }>();
const store = useSelectionStore();
const root = ref<HTMLElement | null>(null);

async function clearSelection(): Promise<void> {
	const inspector = root.value?.closest<HTMLElement>('[data-rp-region="inspector"]');
	store.clear();
	await nextTick();
	inspector?.focus();
}

function onEscape(event: KeyboardEvent): void {
	// An open drawer owns Escape before selection; the full Inspector has no drawer.
	if ((event.currentTarget as HTMLElement).closest('.rp-inspector-drawer') !== null) return;
	event.stopPropagation();
	event.preventDefault();
	void clearSelection();
}
</script>

<template>
	<section
		ref="root"
		class="rp-multi-selection"
		@keydown.esc="onEscape"
	>
		<p>{{ tr('editor.inspector.multiple') }}</p>
		<dl class="rp-editor-inspector-fields">
			<dt>{{ tr('editor.selection.count') }}</dt>
			<dd>{{ selection.ids.length }}</dd>
			<dt>{{ tr('editor.selection.area-sum') }}</dt>
			<dd>{{ selection.areaMm2 === null ? tr('editor.selection.unknown') : formatArea(selection.areaMm2) }}</dd>
			<dt>{{ tr('editor.selection.shared-type') }}</dt>
			<dd v-if="selection.unavailable > 0">
				{{ tr('editor.selection.unknown') }}
			</dd>
			<dd v-else>
				{{ selection.sharedType === null ? tr('editor.selection.mixed') : tr(zoneTypeLabel(selection.sharedType)) }}
			</dd>
		</dl>
		<p v-if="selection.unavailable > 0">
			{{ tr('editor.selection.unavailable', { count: String(selection.unavailable) }) }}
		</p>
		<p>{{ tr('editor.selection.area-sum-hint') }}</p>
		<h3 class="rp-editor-panel-subtitle">
			{{ tr('editor.selection.members') }}
		</h3>
		<ol class="rp-room-list">
			<li
				v-for="record in selection.records"
				:key="record.id"
			>
				<button
					type="button"
					class="rp-room-list__row"
					:data-rp-id="record.id"
					:aria-pressed="store.focusedId === record.id"
					@click="store.focus(record.id as EntityId<string>)"
				>
					{{ selection.ids.indexOf(record.id) + 1 }}. {{ record.name }}
				</button>
			</li>
		</ol>
		<button
			type="button"
			@click="clearSelection()"
		>
			{{ tr('editor.selection.clear') }}
		</button>
	</section>
</template>
