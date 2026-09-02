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
import { ref, type Ref } from 'vue';
import FormSubmitRow from '../dialogs/FormSubmitRow.vue';
import { useDialogFormBusy } from '../composables/use-dialog-form-busy';
import { useInvalidFieldFocus } from '../composables/use-invalid-field-focus';
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
 * arm of this map.** The project vanished while the form was open, so this form emits
 * `projectGone` and the VIEW answers: `ProjectDetailState.onProjectGone` calls
 * `ProjectDetailStore.markGone`, the status settles `'gone'`, the pane draws the screen that
 * says so, and a `watch(status)` retires this dialog. A banner cannot be that answer either
 * way — the form holding it is destroyed by the same gesture that would have drawn it.
 *
 * **This paragraph prescribed a NOTICE and a RETURN TO THE LIST until a review bot read it
 * against the handler**, and both halves had been retired by the improvement pass. The
 * redirect went because an automatic navigation records a history entry nobody asked for, so
 * the pane's Back arrow bounced through a dead project; the notice went with it because it
 * resolved `view.project.gone`, the very key the screen's headline resolves, so the two said
 * one sentence twice at once. The old text also argued that keeping the user in a detail
 * state for a project that no longer exists "is the worse answer" — which is now precisely
 * what ships, and for a better reason than the banner it was arguing about: the screen
 * persists, names what happened, and carries a way back, where a notice expires.
 *
 * Read the word "absent" precisely: `routeError` has two answers, so an absent entry still
 * SETS the banner, and this form does not pretend otherwise. That write is left alone rather
 * than suppressed — it is the last word only in a build where the view ignores the emit, and
 * there the generic Reference sentence beats silence. `onSubmit` is what makes the emit the
 * answer in every other build.
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

// `writeBusy`, the busy `watchEffect` and `refuseWhileSubmitting` were byte-identical
// in this file and its sibling creation form; `useDialogFormBusy` is the one statement
// of both, and its docblock carries the two invariants they each spelled out.
const refuseWhileSubmitting = useDialogFormBusy(form.submitting, props.busy);


/**
 * `:value` + `@input`, calling `setField` — never `v-model`, which would assign straight past
 * it and make the sole-write-path rule this composable exists for unenforceable.
 */
function onNameInput(event: Event): void {
	const control = event.target as HTMLInputElement;
	if (refuseWhileSubmitting(control, form.values.value.name)) return;
	form.setField('name', control.value);
}

// The focus move a rejected submit owes, and the `<form>` ref it queries. One statement of
// both for all three creation forms — `useInvalidFieldFocus`'s docblock carries the WCAG
// argument, why the control is found by query rather than by a key list, and why the
// Inspector's blur-committed fields deliberately do not get this.
const { formEl, focusFirstInvalidControl } = useInvalidFieldFocus();

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
		<FormSubmitRow :submitting="form.submitting.value" />
	</form>
</template>
