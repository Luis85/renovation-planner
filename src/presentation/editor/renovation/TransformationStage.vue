<script setup lang="ts">
import HostIcon from '../../components/HostIcon.vue';
/**
 * One stage block of the transformation summary. The caller decides everything the three
 * stages disagree about — the trailing arrow, the progress span, how far each list and its
 * joined fallback slice — so this component holds only the shape they share.
 */
defineProps<{ label: string; arrow?: boolean; progress?: string; items?: { id: string; text: string }[]; text: string }>();
</script>
<template>
	<div>
		<h4>
			{{ label }}<HostIcon
				v-if="arrow"
				name="arrow-right"
			/>
			<span
				v-if="progress"
				class="rp-transformation-progress"
			>{{ progress }}</span>
		</h4>
		<ul v-if="items">
			<li
				v-for="item in items"
				:key="item.id"
			>
				{{ item.text }}
			</li>
		</ul>
		<p v-else>
			{{ text }}
		</p>
	</div>
</template>
