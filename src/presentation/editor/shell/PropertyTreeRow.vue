<script setup lang="ts">
/**
 * One row of `PropertyTree` — an ancestry row (ADR-0028) or a sibling floor, which draw
 * identically: a `grid-2x-2` icon and a name, a button when `onOpen` is given and plain text
 * otherwise. Pulled out of the tree's own template so each `v-for` is one line there instead
 * of a nested `v-if`/`v-else` pair repeated per row — `npm run analyze` flagged that
 * template's cognitive complexity the moment the ancestry loop joined the floors one inline.
 */
import HostIcon from '../../components/HostIcon.vue';

const props = defineProps<{
	readonly name: string;
	readonly onOpen?: () => void;
	readonly openPlanId?: string;
	readonly current?: boolean;
}>();
</script>

<template>
	<button
		v-if="props.onOpen"
		type="button"
		class="rp-property-tree__floor"
		:data-rp-open-plan="props.openPlanId"
		@click="props.onOpen()"
	>
		<HostIcon name="grid-2x-2" />{{ props.name }}
	</button>
	<p
		v-else
		class="rp-property-tree__floor"
		:aria-current="props.current ? 'page' : undefined"
	>
		<HostIcon name="grid-2x-2" />{{ props.name }}
	</p>
</template>
