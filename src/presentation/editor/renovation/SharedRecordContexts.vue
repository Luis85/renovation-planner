<script setup lang="ts">
import { nextTick } from 'vue';
import type { SharedSpatialContext, SpatialLink } from '../../../domain/renovation/SharedLinks';
import { spatialContexts } from '../../../domain/renovation/SharedLinks';
import { EMPTY_RENOVATION } from '../../../domain/renovation/Renovation';
import { EMPTY_DEPTH } from '../../../domain/renovation/PlanningDepth';
import { useEditorRuntime } from '../runtime';
import { useRenovationContextLabel } from './renovationContextLabel';
import { tr } from '../../i18n/strings';
const props = defineProps<{ item: SharedSpatialContext & { id: string } }>();
const runtime = useEditorRuntime(), label = useRenovationContextLabel();
async function unlink(link: SpatialLink, event: Event): Promise<void> {
	const inspector = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-rp-region="inspector"]');
	await runtime.renovation.change(read => {
		const value = read.plan.entity.renovation ?? EMPTY_RENOVATION, depth = value.depth ?? EMPTY_DEPTH;
		const update = <T extends SharedSpatialContext & { id: string }>(record: T): T => record.id === props.item.id ? { ...record, links: record.links?.filter(item => item.roomId !== link.roomId || item.targetId !== link.targetId) } : record;
		return { renovation: { ...value, work: value.work.map(update), ...(value.depth ? { depth: { ...depth, evidence: depth.evidence.map(update) } } : {}) }, intended: read.geometry.document.intended };
	}, tr('renovation.shared.unlink-impact', { name: label(link) }));
	await nextTick(); if (inspector?.isConnected) inspector.focus();
}
</script>
<template>
	<section
		v-if="item.links?.length"
		class="rp-shared-contexts"
	>
		<h4>{{ tr('renovation.shared.heading') }}</h4>
		<ul>
			<li
				v-for="(link, index) in spatialContexts(item)"
				:key="`${link.roomId}:${link.targetId}`"
			>
				{{ label(link) }}
				<span v-if="index === 0">{{ tr('renovation.shared.primary') }}</span>
				<button
					v-else
					type="button"
					:disabled="runtime.renovation.blocked.value"
					@click="unlink(link, $event)"
				>
					{{ tr('renovation.shared.unlink') }}
				</button>
			</li>
		</ul>
	</section>
</template>
