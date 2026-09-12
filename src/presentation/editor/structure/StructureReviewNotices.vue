<script setup lang="ts">
import type { AppError } from '../../../core/errors/AppError';
import { tr } from '../../i18n/strings';
import { spatialMessage } from './spatialMessage';
defineProps<{ error: AppError | null; invalid: boolean; conflict: boolean; errorId: string; numericId: string }>();
</script>
<template>
	<p
		v-if="error"
		:id="errorId"
		role="alert"
	>
		{{ spatialMessage(error) }}
	</p>
	<p
		v-if="invalid"
		:id="numericId"
		role="alert"
	>
		{{ tr('editor.structure.error.numeric') }}
	</p>
	<p
		v-if="conflict"
		role="status"
	>
		{{ tr('editor.structure.conflict') }}
	</p>
</template>
