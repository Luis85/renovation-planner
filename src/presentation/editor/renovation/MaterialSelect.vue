<script setup lang="ts">
import { restoreInoperativeChoice } from '../forms/inoperativeControl';
import { tr } from '../../i18n/strings';
import type { RenovationSubject } from '../../../domain/renovation/Renovation';
import type { MaterialChoice } from './materialChoices';
defineProps<{ kind: RenovationSubject['kind']; choices: readonly MaterialChoice[]; frozen: boolean }>();
const material = defineModel<string>({ required: true });
</script>
<template>
	<label>{{ tr(kind === 'wall' ? 'renovation.material' : 'renovation.product') }}
		<select
			v-model="material"
			name="material"
			:aria-disabled="frozen"
			@change.capture="restoreInoperativeChoice($event, material)"
		>
			<option value="">{{ tr('renovation.material.none') }}</option>
			<option
				v-for="item in choices"
				:key="item.id"
				:value="item.id"
			>{{ item.name }}</option>
		</select>
	</label>
</template>
