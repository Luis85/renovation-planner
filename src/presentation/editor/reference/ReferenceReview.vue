<script setup lang="ts">
import type { ReferenceAppearance } from '../../../domain/plan/ReferenceAppearance';
import { tr } from '../../i18n/strings';
const props = defineProps<{ path: string; page: number | null; rotation: number; crop: ReferenceAppearance['crop']; scaleSummary: string; factor: string; needsConsent: boolean; paused: boolean }>();
const opacity = defineModel<number>('opacity', { required: true });
const visible = defineModel<boolean>('visible', { required: true });
const locked = defineModel<boolean>('locked', { required: true });
const acknowledged = defineModel<boolean>('acknowledged', { required: true });
function refusePaused(event: Event): void { if (props.paused) event.preventDefault(); }
function rangeKey(event: KeyboardEvent): void {
 if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) refusePaused(event);
}
</script>
<template>
	<section>
		<p>
			{{ path }}<template v-if="page !== null">
				· {{ tr('editor.reference.page') }} {{ page }}
			</template> · {{ rotation }}°
			<br>{{ crop.x }}, {{ crop.y }} · {{ crop.width }} × {{ crop.height }} px
		</p>
		<p>{{ scaleSummary }}</p>
		<label class="rp-dialog-field">{{ tr('editor.reference.opacity') }}<input
			v-model.number="opacity"
			name="opacity"
			type="range"
			min="0"
			max="1"
			step="0.05"
			:aria-disabled="paused"
			@keydown="rangeKey"
			@pointerdown="refusePaused"
		></label>
		<label><input
			v-model="visible"
			type="checkbox"
			name="visible"
			:aria-disabled="paused"
			@click="refusePaused"
		>{{ tr('editor.reference.visible') }}</label>
		<label><input
			v-model="locked"
			type="checkbox"
			name="locked"
			:aria-disabled="paused"
			@click="refusePaused"
		>{{ tr('editor.reference.locked') }}</label>
		<p v-if="!locked">
			{{ tr('editor.reference.unlock-help') }}
		</p>
		<label v-if="needsConsent"><input
			v-model="acknowledged"
			type="checkbox"
			name="consent"
			:aria-disabled="paused"
			@click="refusePaused"
		>{{ tr('editor.reference.rescale', { factor: factor }) }}</label>
	</section>
</template>
