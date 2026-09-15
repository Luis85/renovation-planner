<script setup lang="ts">
import HostIcon from '../../components/HostIcon.vue';
import { tr } from '../../i18n/strings';
const props = defineProps<{ kind: 'existing' | 'work' | 'planned'; items: readonly { id: string; text: string | undefined; change?: string }[]; compact?: boolean; progress: string }>();
function description(): string { return props.items.slice(0, 3).map(item => item.change ? `${item.change}: ${item.text}` : item.text).join(', ') || tr('renovation.summary.unrecorded'); }
</script>
<template>
	<div>
		<h4>
			{{ tr(`renovation.summary.${kind}`) }}<HostIcon
				v-if="kind !== 'planned'"
				name="arrow-right"
			/>
		</h4>
		<p
			v-if="compact && kind === 'work'"
			class="rp-transformation-progress"
		>
			{{ progress }}
		</p>
		<ul v-if="!compact && items.length">
			<li
				v-for="item in items"
				:key="item.id"
			>
				<template v-if="item.change">
					{{ item.change }}:
				</template>{{ item.text }}
			</li>
		</ul>
		<p v-else>
			{{ description() }}
		</p>
	</div>
</template>
