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
import { nextTick, ref, watchEffect, type Ref } from 'vue';
import { useFormCommit } from '../composables/use-form-commit';
import type { FieldErrorMap } from '../errors/route-error';
import type { Result } from '../../core/result/Result';
import type { Loaded } from '../../application/ports/versioning';
import type { RepositoryError } from '../../application/ports/repositoryErrors';
import type { Project } from '../../domain/project/Project';
import type { CreateProjectInput } from '../../application/commands/project/CreateProject';
import type { Logger } from '../../application/ports/Logger';
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
	/**
	 * This view's logger, required by `useFormCommit` for the one failure it owns both halves
	 * of: a dispatch that THROWS rather than resolving a failed `Result`. The banner is the
	 * user-facing half; this is the developer-facing one, and SDD §66 asks that they come from
	 * one step rather than two. `RequirementRow` takes its own for the identical reason.
	 *
	 * Required, unlike `busy` above: `busy` is optional so this component mounts standalone,
	 * where a caller that never wired it simply gets no busy signalling. A missing logger is
	 * not that shape — it is a fault that reaches nobody.
	 */
	logger: Logger;
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
	'project.invalid-date': ['start', 'targetCompletion'],
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
	logger: props.logger,
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
 * WHILE A WRITE IS IN FLIGHT NO CONTROL IS `:disabled`, and that is a FOCUS rule rather than
 * a styling preference — `FormDialog.vue`'s own docblock already states it as an invariant of
 * the framework, and this form is where it has to hold for the fields too.
 *
 * Chromium moves focus to `<body>` when the element holding it is disabled, and `<body>` is
 * not inside `.rp-dialog`, which is where `DialogHost` binds its `keydown` listener. So
 * disabling the focused control — the submit button on a click, or the text field the user
 * pressed Enter in — took `Escape` and the entire Tab trap out for exactly the duration of
 * the write: the very window `busy` exists to make `Escape` refuse DELIBERATELY, refusing it
 * by accident instead and handing the key to Obsidian's own keymap. It also left focus on
 * `<body>` after a banner-routed rejection, which is precisely what `focusFirstInvalidControl`
 * below promises does not happen.
 *
 * So the controls stay focusable and are made INOPERATIVE instead, by whichever mechanism
 * that control actually has: `readonly` where the platform offers it (the text, textarea and
 * date inputs), announced as read-only and enforced by the browser; `aria-disabled` where it
 * does not (`<select>` has no `readonly`, and a `<button>` has nothing but `disabled`), with
 * the refusal made real by this function. Obsidian's own sheet already dims
 * `button[aria-disabled="true"]` exactly as it dims `button[disabled]`; `styles/dialogs.css`
 * supplies the same affordance for the other two.
 *
 * It RESTORES the control's own DOM value on the way out rather than merely returning. A
 * refused write leaves `values` unchanged, so nothing re-renders — and the character the
 * browser has already put in the field would then sit there as a value the form does not
 * hold, which is a lie about state rather than a refusal of it. `readonly` means this arm is
 * unreachable for most of them; the date picker is the one Chromium still operates on a
 * readonly input, which is why the guard is not left to `readonly` alone.
 */
function refuseWhileSubmitting(control: HTMLElement & { value: string }, rendered: string): boolean {
	if (!form.submitting.value) return false;
	control.value = rendered;
	return true;
}

/**
 * `:value` + `@input`, calling `setField` — never `v-model`, which would assign straight
 * past it and make the sole-write-path rule this composable exists for unenforceable.
 */
function onNameInput(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseWhileSubmitting(control, form.values.value.name)) return;
	form.setField('name', control.value);
}

function onStatusInput(event: Event): void {
	const control = event.target as HTMLSelectElement;
	// `?? ''` mirrors what the `:value` binding renders for an absent status — `status` is
	// optional on `CreateProjectInput`, though `INITIAL` always supplies one — so the restore
	// puts back exactly what the template would have drawn rather than a second answer to it.
	if (refuseWhileSubmitting(control, form.values.value.status ?? '')) return;
	form.setField('status', control.value as ProjectStatus);
}

/** `PROJECT_STATUS_LABELS`'s own doc comment carries the "no status ships unlabelled" rule. */
function statusLabel(status: ProjectStatus): string {
	return tr(PROJECT_STATUS_LABELS[status]);
}

function onDescriptionInput(event: Event): void {
	const control = event.target as HTMLTextAreaElement;
	if (refuseWhileSubmitting(control, form.values.value.description ?? '')) return;
	form.setField('description', control.value);
}

function onStartInput(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseWhileSubmitting(control, toDateInputValue(form.values.value.start))) return;
	form.setField('start', fromDateInputValue(control.value));
}

function onTargetCompletionInput(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseWhileSubmitting(control, toDateInputValue(form.values.value.targetCompletion))) return;
	form.setField('targetCompletion', fromDateInputValue(control.value));
}

/** The rendered `<form>`, for the focus move below. Nothing else reads it. */
const formEl = ref<HTMLFormElement | null>(null);

/**
 * A REJECTED SUBMIT PUTS THE KEYBOARD ON THE FIELD IT IS ABOUT, and that is an
 * accessibility requirement rather than a nicety.
 *
 * `FormBanner` carries `role="alert"` under an explicit argument — it appears in response to
 * the user's own submit and is the only feedback that press produced, so it is announced
 * rather than merely present. That argument is verbatim true of a FIELD error produced by the
 * same press, and `FieldError`'s `<p>` is neither a live region nor focused: a screen-reader
 * user pressed Save on an empty Name, the dialog stayed open, and nothing was spoken while
 * `aria-describedby` changed on an input nobody was on. WCAG 2.2 AA, which `PRODUCT.md` binds
 * by name.
 *
 * The move is chosen over a polite live region because it answers both halves at once: the
 * control's label, its `aria-invalid` and the message `aria-describedby` names are all
 * announced by the focus change, out of markup `FieldError` already renders, and the user is
 * then AT the field rather than merely told about it.
 *
 * It lives here and NOT in `FieldError`, which the Inspector shares. There the commit
 * boundary is blur — the user's attention has already moved on by construction — and pulling
 * focus back to the field they just left would interrupt them somewhere else. Same component,
 * two contexts, and the difference belongs to the context.
 *
 * The control is found by QUERYING the rendered form rather than from a list of field keys:
 * `aria-invalid='true'` is exactly what `FieldError` puts on a control it has a message for,
 * so the first match in document order is the first errored control — and a cross-field error
 * routed to a pair lands on the earlier of the two without this function knowing pairs exist.
 * A second list of keys here would be a second answer to "which fields are wrong".
 *
 * `nextTick` is load-bearing: `submit()` resolves before Vue has flushed the render that
 * applies `aria-invalid`, so the query would find nothing.
 */
async function focusFirstInvalidControl(): Promise<void> {
	await nextTick();
	formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/**
 * Emits `submit` only when the dispatch actually succeeded — never on `false`. A `false`
 * takes the focus move instead; a banner-routed failure names no field, so the query finds
 * nothing, focus stays where the user left it, and `role="alert"` is what announces.
 */
async function onSubmit(): Promise<void> {
	// **No `if (form.submitting.value) return;` here**, for the reason `NewPlanForm.onSubmit`
	// states at length and measured on both: `useFormCommit.submit` clears `fieldErrors` before
	// it sets `submitting`, and `focusFirstInvalidControl` awaits `nextTick` and re-queries, so
	// the focus move a refused press would run finds no `aria-invalid` control. Removed from
	// both forms in one edit rather than from the one it was reported against — the comment was
	// identical in both, so fixing one would have left the same false claim standing next door.
	// `form.submit()` drops the concurrent press itself, which is what keeps one form from
	// creating two projects.
	if (await form.submit()) {
		emit('submit', form.values.value);
		return;
	}
	await focusFirstInvalidControl();
}
</script>

<template>
	<form
		ref="formEl"
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
					:readonly="form.submitting.value"
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
					:aria-disabled="form.submitting.value"
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
					:readonly="form.submitting.value"
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
					:readonly="form.submitting.value"
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
					:readonly="form.submitting.value"
					@input="onTargetCompletionInput"
				>
			</label>
		</FieldError>
		<div class="rp-dialog-actions">
			<button
				type="submit"
				class="rp-dialog-button"
				:aria-disabled="form.submitting.value"
			>
				{{ tr('dialog.form.submit') }}
			</button>
		</div>
	</form>
</template>
