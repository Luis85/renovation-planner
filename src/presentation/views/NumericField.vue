<script setup lang="ts">
/**
 * One millimetre field of `NewAssetForm` — a `FieldError` wrapper, a label, and a
 * `type="number"` input bound `:value` + `@input` the way `useFieldInput`'s docblock requires.
 * Extracted at AD07 Amendment 1 because width and depth already spelled it identically and the
 * descriptive height needed a third copy, against a form already at 399 of its 400 counted
 * lines: the extraction is what made room for the field rather than a wider budget.
 *
 * **Every prop is REQUIRED, and `readonly` is the one that has to be.** The three call sites do
 * NOT agree on it — width and depth follow `form.submitting` alone, because a retry exists to
 * re-send exactly those two numbers, while the height follows `catalogueInoperative`, being a
 * `createAsset` field that is frozen once the note exists. A default here would be a fourth
 * answer to a question the parent is the only one holding, and the wrong one at one site.
 *
 * `labelKey` rather than a rendered `label`: a `StringKey` makes raw English a compile error,
 * which is a gate `I18N_LITERAL_BAN` does not reach — its selector fires at six call sites,
 * none of them a component prop.
 *
 * **What this component deliberately does NOT own**: which key the parent writes back to. It
 * emits the bare `Event` and the parent names the field in its own handler, so `data-field` and
 * that key are two statements. A child that emitted the key would need to be generic over the
 * parent's value type to keep `useFieldInput`'s `StringField<TInput>` constraint, which buys one
 * removed repetition for a type parameter at every call site.
 */
import FieldError from '../components/FieldError.vue';
import { tr } from '../i18n/strings';
import type { StringKey } from '../i18n/locales/en';

defineProps<{
	labelKey: StringKey;
	/** The `data-field` attribute, which is how every test finds this control. NOT how
	 * `useDialogFormBusy` does: that one is handed the element as `event.target` by
	 * `useFieldInput`, and `grep -rn "data-field" src/ | grep -v '\.vue:'` prints nothing. */
	field: string;
	message: string | null;
	value: string;
	readonly: boolean;
}>();

defineEmits<{ input: [event: Event] }>();
</script>

<template>
	<FieldError
		v-slot="{ inputId, aria }"
		:message="message"
	>
		<label
			class="rp-dialog-field"
			:for="inputId"
		>
			{{ tr(labelKey) }}
			<input
				:id="inputId"
				v-bind="aria"
				type="number"
				min="0"
				step="any"
				:data-field="field"
				:value="value"
				:readonly="readonly"
				@input="$emit('input', $event)"
			>
		</label>
	</FieldError>
</template>
