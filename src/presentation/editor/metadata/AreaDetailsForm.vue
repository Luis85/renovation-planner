<script setup lang="ts">
import { computed, onBeforeUnmount, type Ref } from 'vue';
import type { DispatchResult } from '../../../application/commands/DispatchOutcome';
import type { ZoneDetails } from '../../../application/commands/zone/EditZoneDetails';
import type { Logger } from '../../../application/ports/Logger';
import { ZONE_TYPES, type ZoneType } from '../../../domain/zone/ZoneType';
import { useFormCommit } from '../../composables/use-form-commit';
import { useDialogFormBusy } from '../../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../../composables/use-invalid-field-focus';
import FieldError from '../../components/FieldError.vue';
import FormBanner from '../../components/FormBanner.vue';
import { tr } from '../../i18n/strings';
import { trError } from '../../i18n/toUserMessage';
import { zoneTypeLabel } from '../shell/zoneTypeLabel';
import { nativeSubmitKey } from '../forms/nativeSubmitKey';
const props = defineProps<{ value: ZoneDetails; busy: Ref<boolean>; blocked: Readonly<Ref<boolean>>;
	latest: Readonly<Ref<string | null>>; dispatch: (details: ZoneDetails) => Promise<DispatchResult>; logger: Logger }>();
const emit = defineEmits<{ submit: [] }>();
let alive = true; onBeforeUnmount(() => { alive = false; });
const form = useFormCommit({ initial: props.value, logger: props.logger, errorMap: { 'zone.empty-name': ['name'], 'zone.unknown-type': ['zoneType'] }, toUserMessage: trError, dispatch: props.dispatch });
const refuseInput = useDialogFormBusy(form.submitting, props.busy);
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();
const paused = computed(() => props.blocked.value || form.submitting.value);
const unchanged = computed(() => form.values.value.name.trim() === props.value.name && form.values.value.zoneType === props.value.zoneType);
const disabled = computed(() => paused.value || props.latest.value !== null || unchanged.value);
const types = ZONE_TYPES.filter(type => type !== 'Room');
function input(key: 'name' | 'zoneType', event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseInput(control, form.values.value[key])) return;
	if (key === 'name') form.setField(key, control.value);
	else form.setField(key, control.value as ZoneType);
}
async function submit(): Promise<void> {
	if (disabled.value) return;
	if (await form.submit()) { if (alive) emit('submit'); }
	else if (alive) await focusFirstInvalidControl();
}
</script>
<template>
	<form
		ref="formEl"
		class="rp-dialog-form"
		data-rp-form="area-details"
		@submit.prevent="submit"
		@keydown="nativeSubmitKey"
	>
		<FormBanner :message="form.banner.value" />
		<p
			v-if="latest.value !== null"
			role="status"
		>
			{{ latest.value }}
		</p>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('name') ?? null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>{{ tr('editor.area.name') }}
				<input
					:id="inputId"
					v-bind="aria"
					name="name"
					type="text"
					:value="form.values.value.name"
					:readonly="paused"
					@input="input('name', $event)"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('zoneType') ?? null"
		>
			<label
				:for="inputId"
				class="rp-dialog-field"
			>{{ tr('editor.area.type') }}
				<select
					:id="inputId"
					v-bind="aria"
					name="zoneType"
					:value="form.values.value.zoneType"
					:disabled="paused"
					@change="input('zoneType', $event)"
				>
					<option
						v-for="type in types"
						:key="type"
						:value="type"
					>{{ tr(zoneTypeLabel(type)) }}</option>
				</select>
			</label>
		</FieldError>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="disabled"
			>
				{{ tr('editor.rename.apply') }}
			</button>
		</div>
	</form>
</template>
