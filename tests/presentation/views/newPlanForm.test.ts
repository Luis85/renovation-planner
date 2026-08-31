/**
 * @vitest-environment jsdom
 *
 * `NewPlanForm` is `NewProjectForm`'s second reader of design slice 16's vocabulary, so its
 * cases assert the same two things that file's do — the COMMAND INPUT and the rendered
 * control — rather than "a dialog opened", which is equally true of a caller that dispatched
 * something else entirely.
 *
 * The one case with no sibling is `projectGone`. That refusal reaches the user through
 * NEITHER of `useFormCommit`'s doors, and it is asserted here as an EMIT because the form
 * does not reach the notice door and does not navigate: `ViewRoot` owns both halves, and this
 * is what says the form told it.
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import NewPlanForm from '../../../src/presentation/views/NewPlanForm.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { CreatePlanInput } from '../../../src/application/commands/plan/CreatePlan';
import type { Loaded, ObservationToken } from '../../../src/application/ports/versioning';
import type { Plan } from '../../../src/domain/plan/Plan';
import { makePlan } from '../../helpers/entities';
import { recorder } from '../../helpers/logger';
import type { ProjectId } from '../../../src/domain/project/ProjectId';

const PROJECT_ID = 'project-1' as ProjectId;

/**
 * The form never reads the success payload — `useFormCommit` asks `isErr` and nothing else —
 * so a real `Plan` is built rather than a literal purely so a widened success type meets this
 * file at the same time it meets production.
 */
const created = (): { readonly plan: Loaded<Plan> } => ({
	plan: {
		entity: makePlan({ projectId: PROJECT_ID }),
		version: { revision: 1, observed: 'observed-1' as ObservationToken },
	},
});

type Dispatch = (input: CreatePlanInput) => Promise<Result<{ plan: Loaded<Plan> }, AppError>>;

function refusal(category: AppError['category'], code: string): AppError {
	return { category, code, message: 'developer english' } as AppError;
}

/**
 * A dispatch that stays pending until `release()` is called — the only way to observe the
 * form mid-write, which is where three of the cases below live.
 */
function deferredDispatch(): { dispatch: ReturnType<typeof vi.fn<Dispatch>>; release: () => void } {
	let settle: ((result: Result<{ plan: Loaded<Plan> }, AppError>) => void) | null = null;
	const dispatch = vi.fn<Dispatch>(
		() =>
			new Promise((resolve) => {
				settle = resolve;
			}),
	);
	return { dispatch, release: () => settle?.(ok(created())) };
}

describe('NewPlanForm', () => {
	it('dispatches the typed name against the project it was opened for', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });

		await wrapper.get('[data-field="name"]').setValue('Ground floor');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toEqual({ projectId: PROJECT_ID, name: 'Ground floor' });
		expect(wrapper.emitted('submit')).toHaveLength(1);
		expect(wrapper.emitted('projectGone')).toBeUndefined();
	});

	/**
	 * Slice 16's rule, and the one this form must not re-decide: a rejected commit KEEPS the
	 * user's typed value and shows a persistent inline error. Reverting destroys the user's
	 * own input for no architectural reason — slice 6 already guarantees a rejected commit
	 * wrote nothing.
	 */
	it('keeps the typed value and shows the field error on a refusal', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(err(refusal('Validation', 'plan.empty-name'))));
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });

		await wrapper.get('[data-field="name"]').setValue('  ');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe('  ');
		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.find('.rp-form-banner').exists()).toBe(false);
		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.emitted('projectGone')).toBeUndefined();
	});

	/**
	 * The message is retired the instant the field it is about changes — slice 16's rule, and
	 * the half a form can get wrong without anything else noticing: a message the user has
	 * already corrected is a lie if it survives.
	 */
	it('retires the field error as soon as the name is edited', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(err(refusal('Validation', 'plan.empty-name'))));
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });
		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBe('true');

		await wrapper.get('[data-field="name"]').setValue('Ground floor');

		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBeUndefined();
	});

	/**
	 * **What actually keeps a refused press from moving the keyboard, measured after the
	 * `onSubmit` guard that claimed to was removed.**
	 *
	 * Both creation forms carried `if (form.submitting.value) return;` above their submit, under
	 * a comment saying it "keeps a refused press from ALSO running the focus move, which would
	 * drag the keyboard onto whichever control still carries an error from the submit currently
	 * in flight". That scenario cannot occur: `useFormCommit.submit` clears `fieldErrors` BEFORE
	 * it sets `submitting`, and `focusFirstInvalidControl` awaits `nextTick` and re-queries — so
	 * by the time a refused press could look, no control carries `aria-invalid` at all. Measured
	 * with the guard and without it, driving exactly the scenario the comment describes: focus
	 * stayed on the button and the in-flight `aria-invalid` count was 0 in both builds.
	 *
	 * So this case pins the MECHANISM rather than the removed line, and it discriminates: move
	 * the clear in `use-form-commit.ts` to after the dispatch and the second press finds the
	 * first submit's error still rendered and focuses the input. Watched red that way.
	 *
	 * `NewProjectForm` carries the identical mechanism and the identical removal;
	 * `newProjectForm.test.ts`'s own in-flight case asserts the same focus and had credited the
	 * guard for it in a comment while passing without it.
	 */
	it('moves focus nowhere on a press refused mid-write, even after an earlier field error', async () => {
		// A definite assignment, this repository's house spelling: a local assigned inside a
		// callback narrows to `null` at every later read, which `npm run build` reports as
		// `TS2349: Type 'never' has no call signatures`. Measured here, not remembered.
		let hang!: (result: Result<{ plan: Loaded<Plan> }, AppError>) => void;
		let call = 0;
		const dispatch = vi.fn<Dispatch>(() => {
			call += 1;
			// The first press REFUSES with a field error, so the name control really does carry
			// `aria-invalid` before the in-flight window opens — without that, this case would be
			// asking its question of a form that has no errored control to find.
			if (call === 1) return Promise.resolve(err(refusal('Domain', 'plan.empty-name')));
			return new Promise((resolve) => {
				hang = resolve;
			});
		});
		const wrapper = mount(NewPlanForm, {
			attachTo: document.body,
			props: { projectId: PROJECT_ID, dispatch, logger: recorder },
		});

		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(wrapper.findAll('[aria-invalid="true"]')).toHaveLength(1);

		const submit = wrapper.get('button[type="submit"]');
		(submit.element as HTMLButtonElement).focus();
		// The second press opens the in-flight window; the third is the refused one.
		await wrapper.get('form').trigger('submit');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(document.activeElement).toBe(submit.element);
		expect(dispatch).toHaveBeenCalledTimes(2);
		hang(ok(created()));
		await flushPromises();
		wrapper.unmount();
	});

	/** A repeated submit is ONE intent pressed twice, so the second is DROPPED. */
	it('drops a second submit while the first is in flight', async () => {
		const { dispatch, release } = deferredDispatch();
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });
		await wrapper.get('[data-field="name"]').setValue('Ground floor');

		await wrapper.get('form').trigger('submit');
		await wrapper.get('form').trigger('submit');
		release();
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	/**
	 * The one refusal that reaches the user through NEITHER of `useFormCommit`'s two doors.
	 * Asserted as an EMIT rather than as a notice, because the form does not reach the notice
	 * door and does not navigate — `ViewRoot` owns both halves, and this case is what says the
	 * form told it.
	 *
	 * The banner assertion beside it is what stops this being re-simplified back into a banner
	 * by someone reading the other two rows of the error map: navigating rebuilds the tree,
	 * `onBeforeUnmount` settles the open dialog, and a banner would be destroyed in the same
	 * gesture that drew it.
	 */
	it('emits projectGone when the project vanished while the form was open', async () => {
		const dispatch = vi.fn<Dispatch>(() =>
			Promise.resolve(err(refusal('Reference', 'plan.project-not-found'))),
		);
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });
		await wrapper.get('[data-field="name"]').setValue('Ground floor');

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.emitted('projectGone')).toHaveLength(1);
		expect(wrapper.emitted('submit')).toBeUndefined();
		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBeUndefined();
		// The banner IS written, and saying so is more honest than asserting it away. `routeError`
		// has exactly two answers and a code with no map entry takes the second one, so this is
		// what "not about a field" MEANS in that vocabulary — it is not a third outcome the form
		// could ask for. What makes the emit the real answer is that the view navigates on it and
		// this whole tree goes with the banner; what makes the banner worth leaving in place is
		// the case where it does not, where the generic Reference sentence is a better last word
		// than silence. A build that routed the code at `name` instead fails the line above.
		expect(wrapper.find('.rp-form-banner').exists()).toBe(true);
	});

	/**
	 * `projectGone` is reset BEFORE each submit, so it always describes the submit that has
	 * just finished rather than one before it. Without the reset a form that survived the first
	 * refusal — which is every build where the view does not navigate, and every future one
	 * where it navigates asynchronously — emits `projectGone` again for a refusal that is
	 * plainly about the name, and the user is thrown back to the list mid-correction.
	 */
	it('does not re-emit projectGone for a later refusal that is about the name', async () => {
		const dispatch = vi
			.fn<Dispatch>()
			.mockResolvedValueOnce(err(refusal('Reference', 'plan.project-not-found')))
			.mockResolvedValueOnce(err(refusal('Validation', 'plan.empty-name')));
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });

		await wrapper.get('form').trigger('submit');
		await flushPromises();
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(2);
		expect(wrapper.emitted('projectGone')).toHaveLength(1);
		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBe('true');
	});

	/**
	 * A failure about neither the name nor the project's existence is a banner, and it takes
	 * the focus move nowhere — `FormBanner` announces itself, and there is no errored control
	 * to land on.
	 */
	it('puts any other failure in the banner, moves focus nowhere, and does not emit projectGone', async () => {
		const dispatch = vi.fn<Dispatch>(() =>
			Promise.resolve(err(refusal('Persistence', 'vault.unexpected-failure'))),
		);
		const wrapper = mount(NewPlanForm, {
			props: { projectId: PROJECT_ID, dispatch, logger: recorder },
			attachTo: document.body,
		});
		const submit = wrapper.get('button[type="submit"]').element as HTMLButtonElement;
		submit.focus();

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.find('.rp-form-banner').exists()).toBe(true);
		expect(wrapper.get('[data-field="name"]').attributes('aria-invalid')).toBeUndefined();
		expect(document.activeElement).toBe(submit);
		expect(wrapper.emitted('projectGone')).toBeUndefined();
		wrapper.unmount();
	});

	/**
	 * A rejected submit puts the keyboard ON the field it is about — WCAG 2.2 AA, and the
	 * argument `NewProjectForm` states at length: `FieldError`'s `<p>` is neither a live
	 * region nor focused, so without the move a screen-reader user pressed Save, the dialog
	 * stayed open, and nothing was spoken.
	 */
	it('moves focus to the errored control on a rejected submit', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(err(refusal('Validation', 'plan.empty-name'))));
		const wrapper = mount(NewPlanForm, {
			props: { projectId: PROJECT_ID, dispatch, logger: recorder },
			attachTo: document.body,
		});

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(document.activeElement).toBe(wrapper.get('[data-field="name"]').element);
		wrapper.unmount();
	});

	/**
	 * `FormDescriptor.busy`'s other end, written FROM `submitting` and never read back — the
	 * shared ref is what makes `DialogHost` refuse `Escape` and disable Cancel for exactly the
	 * write window. Handing it to only one of the two ends is this mechanism's most-repeated
	 * defect: every line reads as correct and the flag never moves.
	 */
	it('drives the shared busy ref for the length of the write', async () => {
		const { dispatch, release } = deferredDispatch();
		const busy = ref(false);
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, busy, logger: recorder } });
		await wrapper.get('[data-field="name"]').setValue('Ground floor');

		await wrapper.get('form').trigger('submit');
		await flushPromises();
		expect(busy.value).toBe(true);

		release();
		await flushPromises();

		expect(busy.value).toBe(false);
	});

	/**
	 * Inoperative, never `:disabled` — asserted on what `dispatch` RECEIVED as well as on the
	 * control, because a form that froze its input but read a live `values` ref at dispatch
	 * time would pass the weaker half alone. A `:disabled` control is removed from the focus
	 * order, so Chromium blurs it to `<body>` — outside `.rp-dialog`, where `DialogHost` binds
	 * its `keydown` listener — and `Escape` and the Tab trap go with it for the whole window
	 * `busy` exists to make `Escape` refuse deliberately.
	 */
	it('refuses an edit while the write is in flight, restoring what the form holds', async () => {
		const { dispatch, release } = deferredDispatch();
		const wrapper = mount(NewPlanForm, { props: { projectId: PROJECT_ID, dispatch, logger: recorder } });
		await wrapper.get('[data-field="name"]').setValue('Ground floor');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.get('[data-field="name"]').attributes('readonly')).toBeDefined();
		expect(wrapper.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');
		expect(wrapper.findAll('[disabled]')).toHaveLength(0);

		// `setValue` writes the DOM value and fires the event, which is how a script — or a
		// picker — reaches a readonly control. The refused keystroke must not sit in the field
		// as a value the form does not hold.
		await wrapper.get('[data-field="name"]').setValue('First floor');
		expect((wrapper.get('[data-field="name"]').element as HTMLInputElement).value).toBe('Ground floor');

		release();
		await flushPromises();

		expect(dispatch.mock.calls[0][0]).toEqual({ projectId: PROJECT_ID, name: 'Ground floor' });
	});
});
