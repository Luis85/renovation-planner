<script setup lang="ts">
import { tr } from '../../i18n/strings';
defineProps<{ planning?: boolean }>();
</script>
<template>
	<details class="rp-review-scope">
		<summary>{{ tr('renovation.review.limited-scope') }}</summary>
		<p>{{ tr(planning ? 'planning.review-scope' : 'renovation.scope') }}</p>
	</details>
</template>
