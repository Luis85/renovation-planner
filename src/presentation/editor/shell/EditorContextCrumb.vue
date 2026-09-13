<script setup lang="ts">
/**
 * One breadcrumb in `EditorContextBar`'s crumb trail — a button when `onOpen` is given
 * (there is somewhere to navigate to), plain text otherwise. Pulled out of the bar's own
 * template so the ancestry `v-for` (ADR-0028) is one line there instead of a nested
 * `v-if`/`v-else` pair repeated per ancestor — `npm run analyze` flagged that template's
 * cognitive complexity the moment the loop landed inline. `icon` is the ancestor's kind icon
 * (`PLAN_KIND_ICONS`), drawn before the name in both branches so the trail reads as the
 * Property tree's levels do — required, since every plan has a kind and the bar draws its
 * own project and current-plan crumbs inline.
 */
import HostIcon from '../../components/HostIcon.vue';
const props = defineProps<{
	readonly name: string;
	readonly icon: string;
	readonly onOpen?: () => void;
	readonly openPlanId?: string;
}>();
</script>

<template>
	<button
		v-if="props.onOpen"
		type="button"
		class="rp-context-bar__crumb rp-context-bar__button"
		:data-rp-open-plan="props.openPlanId"
		@click="props.onOpen()"
	>
		<HostIcon :name="props.icon" />{{ props.name }}
	</button>
	<span
		v-else
		class="rp-context-bar__crumb"
	><HostIcon :name="props.icon" />{{ props.name }}</span>
</template>
