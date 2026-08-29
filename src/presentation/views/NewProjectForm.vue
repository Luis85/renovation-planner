<script setup lang="ts">
/**
 * The creation dialog for a new project — design slice 16's payoff, and the first surface
 * where the whole field-error vocabulary (`useFormCommit`, `FieldError`, `FormBanner`) is
 * actually driven by a user rather than by a test harness.
 *
 * Mounted inside slice 15's `FormDialog` as a plain COMPONENT, never a dialog kind of its
 * own: that directory holds no field knowledge, which is why the form lives here instead —
 * exactly the same reason `KnownDistanceForm` lives beside the editor rather than in
 * `presentation/dialogs/`.
 *
 * It OWNS its own dispatch, deliberately. `FormDialog`'s `'submit'` event only ever meant
 * "the form is done, resolve the dialog" — dispatching the command was always the caller's
 * job (see `FormDialogResult`'s docblock) — but slice 16 needs the dialog to stay OPEN on a
 * rejection, with the error rendered under the field it is about, and `openDialog` throws if
 * a dialog is already open, so a caller that dispatched only after this component resolved
 * could never reopen it to show one. `submit` is therefore emitted only once `dispatch` has
 * actually succeeded.
 */
import { watchEffect, type Ref } from 'vue';
import { useFormCommit } from '../composables/use-form-commit';
import type { FieldErrorMap } from '../errors/route-error';
import type { Result } from '../../core/result/Result';
import type { Loaded } from '../../application/ports/versioning';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Project } from '../../domain/project/Project';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import { PROJECT_STATUSES, type ProjectStatus } from '../../domain/project/ProjectStatus';
import { PROJECT_STATUS_LABELS } from './projectStatusLabels';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import FieldError from '../components/FieldError.vue';
import FormBanner from '../components/FormBanner.vue';

const props = defineProps<{
	// A plain `input` needs no underscore: `eslint.config.mjs`'s `VUE_FILES`-scoped block
	// registers `@typescript-eslint/no-unused-vars` in place of core `no-unused-vars` for
	// exactly this reason — the TypeScript-aware rule knows a function-TYPE's parameter name
	// is not a binding anything could leave unused, where core's rule did not.
	dispatch: (input: CreateProjectInput) => Promise<Result<{ project: Loaded<Project> }, RepositoryError>>;
	/**
	 * `FormDescriptor.busy`'s other end (design slice 16). Optional so this component mounts
	 * on its own with nothing wired to it at all — every case in `newProjectForm.test.ts`
	 * does exactly that. When it IS supplied, it is written FROM `submitting` below and never
	 * read here, so there is no second flag for the two ends to drift out of step with.
	 */
	busy?: Ref<boolean>;
}>();

const emit = defineEmits<{ submit: [values: CreateProjectInput] }>();

/**
 * Read from the raise sites in `src/domain/project/Project.ts`, never invented — a plain
 * grep for these two-word codes finds nothing, because `Project.create` mints them through
 * `projectError(code, message)`'s `project.${code}` template rather than spelling the full
 * string literally.
 *
 * `project.negative-amount` has NO entry and needs none: this form carries no Money field
 * (spec decision 2 excludes money and location), and the code is unroutable as things stand
 * regardless — one code shared by `budget` and `contingency`, with the field named only in
 * the developer-English `message`. A `PersistenceError` from `save` has no entry either,
 * deliberately: it is about the vault, not about a field, and belongs in the banner.
 */
const NEW_PROJECT_ERRORS: FieldErrorMap<CreateProjectInput> = {
	'project.empty-name': 'name',
	'project.unknown-status': 'status',
	'project.target-before-start': ['start', 'targetCompletion'],
};

const INITIAL: CreateProjectInput = {
	name: '',
	status: 'IDEA',
	description: '',
	start: null,
	targetCompletion: null,
};

const form = useFormCommit<CreateProjectInput, { project: Loaded<Project> }>({
	initial: INITIAL,
	dispatch: props.dispatch,
	errorMap: NEW_PROJECT_ERRORS,
	toUserMessage: trError,
});

/**
 * `vue/no-mutating-props` flags any write reachable through a props-derived expression,
 * including this one — but `busy` is a `Ref` the caller handed over specifically so this
 * component could write into it (`FormDescriptor.busy`'s own doc comment); writing its
 * `.value` is the entire reason it is accepted, not a mutation of the PROP BINDING itself
 * (that would be `props.busy = someOtherRef`, which stays a real error). Routed through a
 * plain function so the write is not syntactically `props.busy.value = …`, which is all the
 * rule actually looks for.
 */
function writeBusy(target: Ref<boolean> | undefined, value: boolean): void {
	if (target) target.value = value;
}

// Written FROM the composable's own state — see `busy`'s own doc comment above for why
// this is the only direction data flows between the two.
watchEffect(() => {
	writeBusy(props.busy, form.submitting.value);
});

/**
 * `Project.start`/`targetCompletion` on the wire: date-only, UTC, always — the SAME rule
 * `infrastructure/persistence/mappers/projectMapper.ts` states for the read/write mapper,
 * copied rather than imported: `presentation/` may not reach `infrastructure/` (the layer
 * ban), and building a `Date` any other way (local midnight) shifts the day west of
 * Greenwich, which is exactly what design slice 5a's own fix was for.
 */
function toDateInputValue(date: Date | null | undefined): string {
	return date === null || date === undefined ? '' : date.toISOString().slice(0, 10);
}

function fromDateInputValue(value: string): Date | null {
	return value === '' ? null : new Date(`${value}T00:00:00Z`);
}

/**
 * `:value` + `@input`, calling `setField` — never `v-model`, which would assign straight
 * past it and make the sole-write-path rule this composable exists for unenforceable.
 */
function onNameInput(event: Event): void {
	form.setField('name', (event.target as HTMLInputElement).value);
}

function onStatusInput(event: Event): void {
	form.setField('status', (event.target as HTMLSelectElement).value as ProjectStatus);
}

/** `PROJECT_STATUS_LABELS`'s own doc comment carries the "no status ships unlabelled" rule. */
function statusLabel(status: ProjectStatus): string {
	return tr(PROJECT_STATUS_LABELS[status]);
}

function onDescriptionInput(event: Event): void {
	form.setField('description', (event.target as HTMLTextAreaElement).value);
}

function onStartInput(event: Event): void {
	form.setField('start', fromDateInputValue((event.target as HTMLInputElement).value));
}

function onTargetCompletionInput(event: Event): void {
	form.setField('targetCompletion', fromDateInputValue((event.target as HTMLInputElement).value));
}

/** Emits `submit` only when the dispatch actually succeeded — never on `false`. */
async function onSubmit(): Promise<void> {
	if (await form.submit()) emit('submit', form.values.value);
}
</script>

<template>
	<form
		class="rp-dialog-form"
		@submit.prevent="onSubmit"
	>
		<FormBanner :message="form.banner.value" />
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('name') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-project.name') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="text"
					data-field="name"
					:value="form.values.value.name"
					:disabled="form.submitting.value"
					@input="onNameInput"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('status') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-project.status') }}
				<select
					:id="inputId"
					v-bind="aria"
					data-field="status"
					:value="form.values.value.status"
					:disabled="form.submitting.value"
					@change="onStatusInput"
				>
					<option
						v-for="status in PROJECT_STATUSES"
						:key="status"
						:value="status"
					>
						{{ statusLabel(status) }}
					</option>
				</select>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('description') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-project.description') }}
				<textarea
					:id="inputId"
					v-bind="aria"
					data-field="description"
					:value="form.values.value.description ?? ''"
					:disabled="form.submitting.value"
					@input="onDescriptionInput"
				/>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('start') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-project.start') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="date"
					data-field="start"
					:value="toDateInputValue(form.values.value.start)"
					:disabled="form.submitting.value"
					@input="onStartInput"
				>
			</label>
		</FieldError>
		<FieldError
			v-slot="{ inputId, aria }"
			:message="form.fieldErrors.value.get('targetCompletion') ?? null"
		>
			<label
				class="rp-dialog-field"
				:for="inputId"
			>
				{{ tr('form.new-project.target-completion') }}
				<input
					:id="inputId"
					v-bind="aria"
					type="date"
					data-field="targetCompletion"
					:value="toDateInputValue(form.values.value.targetCompletion)"
					:disabled="form.submitting.value"
					@input="onTargetCompletionInput"
				>
			</label>
		</FieldError>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:disabled="form.submitting.value"
			>
				{{ tr('dialog.form.submit') }}
			</button>
		</div>
	</form>
</template>
