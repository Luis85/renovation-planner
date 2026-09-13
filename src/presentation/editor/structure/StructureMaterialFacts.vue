<script setup lang="ts">
import { tr } from '../../i18n/strings';

defineProps<{ kind: 'material' | 'product'; materials?: { existing?: string; planned?: string } | null }>();
</script>

<template>
	<template v-if="materials">
		<dt>{{ tr(kind === 'material' ? 'renovation.material' : 'renovation.product') }}</dt>
		<dd>{{ materials.existing ?? tr('renovation.material.none') }}</dd>
		<template v-if="materials.planned">
			<dt>{{ tr('editor.structure.planned-material') }}</dt>
			<dd>{{ materials.planned }}</dd>
		</template>
	</template>
</template>
