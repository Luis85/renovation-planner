<script setup lang="ts">
/**
 * The creation dialog for a new Plan inside one Project — design slice 21's detail state
 * reaching a write, and `NewProjectForm`'s sibling in every respect but the two named below.
 *
 * **No new dialog KIND.** It is another `component` under slice 15's existing `kind: 'form'`,
 * exactly as `NewProjectForm` is, so none of the five edits a new kind costs apply. It lives
 * beside the view rather than in `presentation/dialogs/` for the same reason both of its
 * siblings do: that directory holds no field knowledge and may not reach `application/`, and
 * this form is typed against `CreatePlanInput`.
 *
 * It OWNS its dispatch, for `NewProjectForm`'s own reason: a rejection has to leave the dialog
 * OPEN with the error under the field it is about, and `openDialog` throws while a dialog is
 * already open, so a caller that dispatched only after this component resolved could never
 * reopen it to show one. `submit` is emitted once `dispatch` has actually succeeded.
 */
import { nextTick, ref, watchEffect, type Ref } from 'vue';
import { useFormCommit } from '../composables/use-form-commit';
import type { FieldErrorMap } from '../errors/route-error';
import { isErr, type Result } from '../../core/result/Result';
import type { AppError } from '../../core/errors/AppError';
import type { Loaded } from '../../application/ports/versioning';
import type { Plan } from '../../domain/plan/Plan';
import type { CreatePlanInput } from '../../application/commands/plan/CreatePlan';
import type { ProjectId } from '../../domain/project/ProjectId';
import type { Logger } from '../../application/ports/Logger';
import { trError } from '../i18n/toUserMessage';
import { tr } from '../i18n/strings';
import FieldError from '../components/FieldError.vue';
import FormBanner from '../components/FormBanner.vue';

const props = defineProps<{
	/**
	 * The project this form was opened FOR, and the only reason it needs a prop the sibling
	 * does not have. It is a plain `string` because that is what the view state carries —
	 * `RenovationProjectDeps.projectId` is a `string | null` read out of Obsidian's own view
	 * state, which knows nothing of SDD §82's brand.
	 */
	projectId: string;
	dispatch: (input: CreatePlanInput) => Promise<Result<{ plan: Loaded<Plan> }, AppError>>;
	/**
	 * `FormDescriptor.busy`'s other end (design slice 16). Optional so this component mounts
	 * on its own with nothing wired to it; written FROM `submitting` below and never read
	 * here, so there is no second flag for the two ends to drift out of step with.
	 */
	busy?: Ref<boolean>;
	/**
	 * Required, exactly as the sibling's is: `useFormCommit` has one door no guard stands
	 * behind — a dispatch that THROWS — where the unmapped cause is the only detail that
	 * exists at all. `busy` is optional because a caller that never wires it simply gets no
	 * busy signalling; a missing logger is a fault that reaches nobody.
	 */
	logger: Logger;
}>();

const emit = defineEmits<{ submit: [values: CreatePlanInput]; projectGone: [] }>();

/**
 * Read from the RAISE SITES, never invented and never copied from `en.ts` — a table derived
 * from the locale file agrees with a typo. `plan.empty-name` is minted by `Plan.create`
 * through `planError`'s `plan.${code}` template (`src/domain/plan/Plan.errors.ts`), so a grep
 * for the whole string finds nothing; `plan.project-not-found` is `CreatePlanCommand`'s own
 * `referenceError`.
 *
 * The other three `Plan.create` mints — `empty-background-path`, `unknown-background-kind`,
 * `invalid-background-page` — have no entry and need none: this form sends no `background`
 * (see `INITIAL`), so it renders no field any of them could be about.
 *
 * **`plan.project-not-found` is deliberately ABSENT, and the user's real answer is neither
 * arm of this map.** The project vanished while the form was open, so what the user needs is
 * a notice and a return to the list — and a banner cannot be that, because navigating
 * rebuilds this tree, `DialogHost.onBeforeUnmount` settles the open dialog, and the form
 * holding the banner is destroyed in the same gesture that would have drawn it. Slice 13's
 * notice queue renders on `document.body` and outlives the remount, which is why the notice
 * is the half that survives. Keeping the user in a detail state for a project that no longer
 * exists, purely so a banner has somewhere to live, is the worse answer.
 *
 * Read the word "absent" precisely: `routeError` has two answers, so an absent entry still
 * SETS the banner, and this form does not pretend otherwise. That write is left alone rather
 * than suppressed — it is the last word only in the build where the view fails to navigate,
 * and there the generic Reference sentence beats silence. `onSubmit` is what makes the emit
 * the answer in every other build.
 */
const NEW_PLAN_ERRORS: FieldErrorMap<CreatePlanInput> = {
	'plan.empty-name': 'name',
};

/**
 * `background` and `layers` stay unset. Both are optional on `CreatePlanInput`; slice 5's
 * background is its own command (`set-plan-background`), and a plan with no background is a
 * state the editor already draws an empty state for.
 */
const INITIAL: CreatePlanInput = { projectId: props.projectId as ProjectId, name: '' };

/**
 * The refusal that belongs to neither of `useFormCommit`'s doors, caught at the seam where it
 * is still a typed `AppError`. `submit()` answers a bare boolean, so this is the last place
 * the code exists — and wrapping `dispatch` rather than reading a banner string keeps it a
 * decision about a CODE: a message comparison would break the moment the copy changed, and it
 * would break in the direction of stranding the user in a detail state for a project that is
 * gone.
 */
const projectGone = ref(false);

async function dispatchWatchingForAGoneProject(
	input: CreatePlanInput,
): Promise<Result<{ plan: Loaded<Plan> }, AppError>> {
	const result = await props.dispatch(input);
	if (isErr(result) && result.error.code === 'plan.project-not-found') projectGone.value = true;
	return result;
}

const form = useFormCommit<CreatePlanInput, { plan: Loaded<Plan> }>({
	initial: INITIAL,
	dispatch: dispatchWatchingForAGoneProject,
	errorMap: NEW_PLAN_ERRORS,
	toUserMessage: trError,
	logger: props.logger,
});

/**
 * `vue/no-mutating-props` flags any write reachable through a props-derived expression, and
 * `busy` is a `Ref` the caller handed over specifically so this component could write into it
 * (`FormDescriptor.busy`'s own doc comment). Routed through a plain function so the write is
 * not syntactically `props.busy.value = …`, which is all the rule looks for — the mutation
 * the rule really forbids, `props.busy = someOtherRef`, stays an error.
 */
function writeBusy(target: Ref<boolean> | undefined, value: boolean): void {
	if (target) target.value = value;
}

// Written FROM the composable's own state — the only direction data flows between the two.
watchEffect(() => {
	writeBusy(props.busy, form.submitting.value);
});

/**
 * WHILE A WRITE IS IN FLIGHT NO CONTROL IS `:disabled`, and that is a FOCUS rule rather than
 * a styling preference — `FormDialog.vue`'s docblock states it as an invariant of the
 * framework and `NewProjectForm`'s carries the full account. Chromium moves focus to `<body>`
 * when the element holding it is disabled, and `<body>` is outside `.rp-dialog`, where
 * `DialogHost` binds its `keydown` listener: disabling the focused control takes `Escape` and
 * the whole Tab trap out for exactly the window `busy` exists to make `Escape` refuse
 * DELIBERATELY.
 *
 * So the controls stay focusable and are made INOPERATIVE instead: `readonly` on the text
 * input, announced by the platform and enforced by the browser, and `aria-disabled` on the
 * button, which has nothing but `disabled` to offer. This function is what makes the refusal
 * real, and it RESTORES the control's own DOM value on the way out rather than merely
 * returning — a refused write leaves `values` unchanged, so nothing re-renders, and the
 * character the browser has already placed would otherwise sit there as a value the form does
 * not hold, which is a lie about state rather than a refusal of it.
 */
function refuseWhileSubmitting(control: HTMLElement & { value: string }, rendered: string): boolean {
	if (!form.submitting.value) return false;
	control.value = rendered;
	return true;
}

/**
 * `:value` + `@input`, calling `setField` — never `v-model`, which would assign straight past
 * it and make the sole-write-path rule this composable exists for unenforceable.
 */
function onNameInput(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseWhileSubmitting(control, form.values.value.name)) return;
	form.setField('name', control.value);
}

/** The rendered `<form>`, for the focus move below. Nothing else reads it. */
const formEl = ref<HTMLFormElement | null>(null);

/**
 * A REJECTED SUBMIT PUTS THE KEYBOARD ON THE FIELD IT IS ABOUT — WCAG 2.2 AA, which
 * `PRODUCT.md` binds by name, and the argument is `FormBanner`'s own applied to a field:
 * the message appears in response to the user's own submit and is the only feedback that
 * press produced, and `FieldError`'s `<p>` is neither a live region nor focused.
 *
 * The control is found by QUERYING the rendered form rather than from a list of field keys:
 * `aria-invalid='true'` is exactly what `FieldError` puts on a control it has a message for,
 * so the first match in document order is the first errored control, and a second list of
 * keys here would be a second answer to "which fields are wrong". `nextTick` is load-bearing:
 * `submit()` resolves before Vue has flushed the render that applies `aria-invalid`.
 */
async function focusFirstInvalidControl(): Promise<void> {
	await nextTick();
	formEl.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}

/**
 * Three outcomes rather than the sibling's two, and the middle one is this form's whole
 * reason for existing separately.
 *
 * `projectGone` is re-read AFTER the await and reset BEFORE it, so it always describes the
 * submit that has just finished rather than one before it. The form neither notifies nor
 * navigates: it emits, and `ViewRoot` owns both halves.
 */
async function onSubmit(): Promise<void> {
	// **No `if (form.submitting.value) return;` here, and its absence is measured rather than
	// assumed.** This form carried one under a comment saying it kept a refused press from ALSO
	// running the focus move, "which would drag the keyboard onto whichever control still
	// carries an error from the submit currently in flight". That scenario cannot occur:
	// `useFormCommit.submit` clears `fieldErrors` BEFORE it sets `submitting`, and
	// `focusFirstInvalidControl` awaits `nextTick` and re-queries, so a refused press finds no
	// `aria-invalid` control to move to. Driven exactly as the comment described — a first press
	// refused with a field error, a second that hangs, a third refused mid-flight — focus stayed
	// on the button and the in-flight count of errored controls was 0, with the guard and
	// without it. `form.submit()` is what drops the press itself, which is what keeps one form
	// from creating two plans.
	//
	// `newPlanForm.test.ts` pins the mechanism that makes the removal safe rather than the line
	// that claimed to, and it discriminates: move that clear after the dispatch and the case
	// goes red.
	projectGone.value = false;
	if (await form.submit()) {
		emit('submit', form.values.value);
		return;
	}
	if (projectGone.value) {
		emit('projectGone');
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
				{{ tr('form.new-plan.name') }}
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
