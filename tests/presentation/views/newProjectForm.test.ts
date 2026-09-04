/**
 * @vitest-environment jsdom
 *
 * The end-to-end form behaviour, asserted on the COMMAND INPUT and on spies rather than on
 * "a dialog opened" — slice 10's rule, because a dialog opening is equally true of a caller
 * that dispatched something else entirely.
 */
import { describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import NewProjectForm from '../../../src/presentation/views/NewProjectForm.vue';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { PersistenceError, ValidationError } from '../../../src/core/errors/AppError';
import type { CreateProjectInput } from '../../../src/application/commands/project/CreateProject';
import type { RepositoryError } from '../../../src/application/ports/repositoryErrors';
import type { Loaded } from '../../../src/application/ports/versioning';
import type { Project } from '../../../src/domain/project/Project';
import type { Logger } from '../../../src/application/ports/Logger';
import { makeProject } from '../../helpers/entities';
import { observationToken } from '../../helpers/domain';

/**
 * `NewProjectForm` requires a logger for the one failure `useFormCommit` owns both halves of
 * (a dispatch that THROWS). Only the fault case below asserts on it; everywhere else it is a
 * stand-in.
 */
const logger: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };


/**
 * `NewProjectForm`'s `dispatch` prop, spelled from the component's own declaration rather than
 * approximated. It read `{ project: { entity: { id: string } } }` — thin enough that no real
 * `CreateProjectCommand` result could ever have been passed to it — and its failure channel was
 * the whole `AppError` union, where the prop admits `RepositoryError`. Both approximations were
 * invisible while `tests/**` went unchecked, and the first is this repository's fake-too-thin
 * rule pointed at a prop: a stand-in narrower than the real value certifies a component against
 * a contract nobody has.
 */
type Dispatch = (input: CreateProjectInput) => Promise<Result<{ project: Loaded<Project> }, RepositoryError>>;

/** A real `Project`, since a success carries a `Loaded<Project>` and nothing less. */
const created = (): { project: Loaded<Project> } => ({
	project: { entity: makeProject(), version: { revision: 1, observed: observationToken('t1') } },
});

/**
 * The refusals these cases inject. `Validation` rather than the bare `AppError` it used to
 * return: `RepositoryError` is `PersistenceError | MigrationError | ValidationError`, and every
 * code below (`project.empty-name`, `project.target-before-start`) is a domain rule the entity
 * refuses on the way in — so the narrower type is also the accurate one.
 */
function projectError(code: string): ValidationError {
	return { category: 'Validation', code, message: 'developer english' };
}

describe('NewProjectForm', () => {
	it('sends exactly the typed values to the command, once', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Kitchen' });
	});

	it('emits submit only after the write succeeded', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(ok(created())), logger },
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	it('keeps the typed value, renders the error under its own field, and does NOT emit submit', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(err(projectError('project.empty-name'))), logger },
		});

		await wrapper.get('input[data-field="name"]').setValue('   ');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		// The dialog stays open: nothing emitted for the host to close on.
		expect(wrapper.emitted('submit')).toBeUndefined();
		// The rejected value survives — this is the point of the case.
		expect((wrapper.get('input[data-field="name"]').element as HTMLInputElement).value).toBe('   ');
		const invalid = wrapper.get('input[data-field="name"]');
		expect(invalid.attributes('aria-invalid')).toBe('true');
	});

	it('puts a two-field error under BOTH of its fields', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(err(projectError('project.target-before-start'))), logger },
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.get('input[data-field="start"]').attributes('aria-invalid')).toBe('true');
		expect(wrapper.get('input[data-field="targetCompletion"]').attributes('aria-invalid')).toBe('true');
	});

	it('puts a vault failure in the banner and under no field', async () => {
		const wrapper = mount(NewProjectForm, {
			props: {
				dispatch: () =>
					Promise.resolve(
						err<PersistenceError>({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'dev' }),
					),
				logger,
			},
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.find('.rp-form-banner').exists()).toBe(true);
		expect(wrapper.get('input[data-field="name"]').attributes('aria-invalid')).toBeUndefined();
	});

	/**
	 * WCAG AA, and the argument is `FormBanner`'s own, applied to the surface it was not
	 * applied to. That component carries `role="alert"` because "it appears in response to the
	 * user's own submit and is the only feedback that press produced, so it is announced rather
	 * than merely present" — which is verbatim true of a FIELD error produced by the same
	 * press, and `FieldError`'s `<p>` is neither a live region nor focused. A screen-reader user
	 * pressed Save on an empty Name, the dialog did not close, and nothing was spoken:
	 * `aria-describedby` changed on an input nobody was on.
	 *
	 * Moving focus rather than adding a live region, because focus is the thing that puts the
	 * user WHERE the problem is as well as telling them about it — the input's label,
	 * `aria-invalid` and `aria-describedby` message are all announced by the move, through
	 * markup `FieldError` already renders. It is done HERE and not in `FieldError`, which the
	 * Inspector shares: there the commit boundary is blur, the user's attention has already
	 * moved on, and pulling focus back would be an interruption rather than an answer. axe
	 * cannot see any of this, so this assertion is the only gate on it.
	 */
	it('moves focus to the first errored control on a rejected submit', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(err(projectError('project.empty-name'))), logger },
			attachTo: document.body,
		});

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(document.activeElement).toBe(wrapper.get('input[data-field="name"]').element);
		wrapper.unmount();
	});

	/**
	 * FIRST in DOM order, not "the one the map happens to name first" — the control is found by
	 * querying the rendered form for `[aria-invalid='true']`, so a cross-field error routed to
	 * a PAIR lands the user on the earlier of the two rather than on whichever the error map
	 * lists first. `start` precedes `targetCompletion` in the template and in
	 * `NEW_PROJECT_ERRORS`'s own array alike, so this case pins the DOM answer by asserting the
	 * later field did NOT take focus as well.
	 */
	it('lands on the earlier of a cross-field pair, not the later', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(err(projectError('project.target-before-start'))), logger },
			attachTo: document.body,
		});

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(document.activeElement).toBe(wrapper.get('input[data-field="start"]').element);
		wrapper.unmount();
	});

	/**
	 * A banner-routed failure names no field, so there is nothing to move to — and `FormBanner`
	 * announces itself. Focus must stay where the user left it rather than being thrown at the
	 * first control of the form.
	 */
	it('moves focus nowhere when the failure routes to the banner', async () => {
		const wrapper = mount(NewProjectForm, {
			props: {
				dispatch: () =>
					Promise.resolve(
						err<PersistenceError>({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'dev' }),
					),
				logger,
			},
			attachTo: document.body,
		});

		const submitButton = wrapper.get('button[type="submit"]').element as HTMLButtonElement;
		submitButton.focus();
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(document.activeElement).toBe(submitButton);
		wrapper.unmount();
	});

	/**
	 * The control-level half of the raw-enum defect: `PROJECT_STATUS_LABELS`'s own
	 * completeness test (`projectStatusLabels.test.ts`) never renders this component, so
	 * reverting the template's interpolation back to the raw `status` loop variable would
	 * leave that test green while the shipped form showed `IDEA`/`AS_BUILT` to every user.
	 */
	it('shows a translated label for every status option, never the raw enum code', () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger } });

		const options = wrapper.findAll('select[data-field="status"] option');

		expect(options.length).toBeGreaterThan(0);
		for (const option of options) {
			const code = option.attributes('value') as string;
			expect(option.text()).not.toBe(code);
			expect(option.text().length).toBeGreaterThan(0);
		}
		// One case pinned by value rather than only by shape, so a wholesale renderer swap
		// (all options reading the same placeholder, say) cannot pass the loop above.
		const design = options.find((option) => option.attributes('value') === 'DESIGN');
		expect(design?.text()).toBe('Design');
	});

	it('sends every field the user filled in, not just name', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('select[data-field="status"]').setValue('DESIGN');
		await wrapper
			.get('textarea[data-field="description"]')
			.setValue('Open the wall between kitchen and dining room.');
		await wrapper.get('input[data-field="start"]').setValue('2026-01-01');
		await wrapper.get('input[data-field="targetCompletion"]').setValue('2026-06-01');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		const sent = dispatch.mock.calls[0][0];
		expect(sent).toMatchObject({
			name: 'Kitchen',
			status: 'DESIGN',
			description: 'Open the wall between kitchen and dining room.',
		});
		// Date-only, UTC — the same round trip Task 5a fixed at the persistence boundary.
		expect(sent.start).toEqual(new Date('2026-01-01T00:00:00Z'));
		expect(sent.targetCompletion).toEqual(new Date('2026-06-01T00:00:00Z'));
	});

	it('clears a date back to null when the field is emptied', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('input[data-field="start"]').setValue('2026-01-01');
		await wrapper.get('input[data-field="start"]').setValue('');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch.mock.calls[0][0].start).toBeNull();
	});

	it('refuses a second submit while the first is still in flight, and moves focus nowhere', async () => {
		// The submit button stays FOCUSABLE while busy (`aria-disabled`, never `:disabled` — see
		// the component's docblock for what disabling the focused control costs the dialog), so a
		// second press is an ordinary thing to reach. `useFormCommit.submit` drops it on its own,
		// which is what keeps one form from creating two projects.
		//
		// **This comment used to credit `onSubmit`'s own `submitting` guard for the focus
		// assertion below, and this case passes without it** — its dispatch resolves `ok`, so no
		// control ever carries `aria-invalid` and there is nothing for a focus move to land on
		// either way. That guard is gone from both creation forms; what actually holds the
		// property is `submit` clearing `fieldErrors` before it sets `submitting`, and
		// `newPlanForm.test.ts`'s *moves focus nowhere on a press refused mid-write* is the case
		// that drives the scenario with a real errored control and reddens when that clear moves.
		let resolveDispatch: (() => void) | null = null;
		const dispatch = vi.fn<Dispatch>(
			() =>
				new Promise((resolve) => {
					resolveDispatch = () => {
						resolve(ok(created()));
					};
				}),
		);
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger }, attachTo: document.body });
		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		const submit = wrapper.get('button[type="submit"]');
		(submit.element as HTMLButtonElement).focus();
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		// Still on the button the user pressed, which is the whole point of it never becoming
		// `:disabled` — inside `.rp-dialog`, where the dialog's own key handling lives.
		expect(document.activeElement).toBe(submit.element);
		expect(wrapper.emitted('submit')).toBeUndefined();

		expect(resolveDispatch).not.toBeNull();
		(resolveDispatch as (() => void) | null)?.();
		await flushPromises();

		expect(wrapper.emitted('submit')).toHaveLength(1);
		wrapper.unmount();
	});

	it('refuses an edit to EVERY control while a write is in flight, restoring what it holds', async () => {
		// A category over all five fields rather than the one the previous case happens to
		// touch: `readonly` is what a real browser enforces for four of them, but Chromium still
		// operates the date picker on a readonly input and `<select>` has no `readonly` at all,
		// so each handler refuses for itself. It RESTORES the control's own DOM value on the way
		// out — a refused write leaves `values` unchanged, so nothing re-renders, and the
		// character the browser already placed would otherwise sit in the field as a value the
		// form does not hold.
		let resolveDispatch: (() => void) | null = null;
		const dispatch = vi.fn<Dispatch>(
			() =>
				new Promise((resolve) => {
					resolveDispatch = () => {
						resolve(ok(created()));
					};
				}),
		);
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger } });
		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		// `setValue` writes the DOM value and fires the event, which is exactly how a date
		// picker or a script reaches a readonly control — the guard, not the attribute, is
		// what this drives.
		await wrapper.get('input[data-field="name"]').setValue('Bathroom');
		await wrapper.get('select[data-field="status"]').setValue('PLANNING');
		await wrapper.get('textarea[data-field="description"]').setValue('later');
		await wrapper.get('input[data-field="start"]').setValue('2026-01-01');
		await wrapper.get('input[data-field="targetCompletion"]').setValue('2026-02-01');

		for (const [selector, held] of [
			['input[data-field="name"]', 'Kitchen'],
			['select[data-field="status"]', 'IDEA'],
			['textarea[data-field="description"]', ''],
			['input[data-field="start"]', ''],
			['input[data-field="targetCompletion"]', ''],
		] as const) {
			expect((wrapper.get(selector).element as HTMLInputElement).value).toBe(held);
		}

		expect(resolveDispatch).not.toBeNull();
		(resolveDispatch as (() => void) | null)?.();
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Kitchen', status: 'IDEA' });
	});

	/**
	 * The inoperative-during-submit rule, asserted on what `dispatch` RECEIVED rather than
	 * merely on a control's attribute — a form that froze its inputs but still read a live
	 * `values` ref at dispatch time would pass a weaker version of this case. `submit` reads
	 * `values.value` ONCE; `setField` replaces the whole ref, so an edit landing during the
	 * slow write must not be visible in what was already sent.
	 *
	 * **`readonly` and `aria-disabled`, never `:disabled`**, and the attribute half of this case
	 * is what pins that. A `:disabled` control is removed from the focus order, so Chromium
	 * blurs the focused one to `<body>` — outside `.rp-dialog`, where `DialogHost` binds its
	 * `keydown` listener — and `Escape` and the Tab trap go with it for the whole write window.
	 * `formBusy.test.ts` holds the trap end of that; the component's own docblock carries the
	 * full account.
	 */
	it('freezes every control while a write is in flight, and ignores a setField racing it', async () => {
		let resolveDispatch: (() => void) | null = null;
		const dispatch = vi.fn<Dispatch>(
			() =>
				new Promise((resolve) => {
					resolveDispatch = () => {
						resolve(ok(created()));
					};
				}),
		);
		const wrapper = mount(NewProjectForm, { props: { dispatch, logger } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		// Frozen by the mechanism each control actually has: `readonly` where the platform
		// offers it, `aria-disabled` where it does not.
		for (const selector of [
			'input[data-field="name"]',
			'textarea[data-field="description"]',
			'input[data-field="start"]',
			'input[data-field="targetCompletion"]',
		]) {
			expect(wrapper.get(selector).attributes('readonly')).toBeDefined();
		}
		expect(wrapper.get('select[data-field="status"]').attributes('aria-disabled')).toBe('true');
		expect(wrapper.get('button[type="submit"]').attributes('aria-disabled')).toBe('true');

		// And NOT by the mechanism that costs the dialog its keyboard. Asserted as a category
		// over the whole form rather than control by control, so a sixth field added later
		// cannot reintroduce it in the one place nobody listed.
		expect(wrapper.findAll('[disabled]')).toHaveLength(0);

		// A racing edit while the write is still pending. `readonly` is what a real browser
		// refuses this on; the component refuses it a second time in its own handler, because
		// Chromium still operates the date picker on a readonly input. What this case drives is
		// the guarantee under both: `submit` already read `values.value` once, before this call,
		// so a later `setField` must not reach the in-flight dispatch either way.
		await wrapper.get('input[data-field="name"]').setValue('Bathroom');
		// The refused keystroke does not sit in the field as a value the form does not hold.
		expect((wrapper.get('input[data-field="name"]').element as HTMLInputElement).value).toBe('Kitchen');

		expect(resolveDispatch).not.toBeNull();
		(resolveDispatch as (() => void) | null)?.();
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Kitchen' });
	});

	/**
	 * The Home surface's signature interaction (Task 7): a query that matched no project
	 * offers to become one, and the form opens carrying what the user already typed rather
	 * than an empty field they have to retype.
	 */
	it('opens with the name it was given, and that name is submitted', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok(created())));
		const wrapper = mount(NewProjectForm, {
			props: { dispatch, logger, initialName: 'Cellar conversion' },
		});

		expect((wrapper.get('input[data-field="name"]').element as HTMLInputElement).value).toBe(
			'Cellar conversion',
		);

		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Cellar conversion' });
	});

	it('opens empty when given no name', () => {
		const wrapper = mount(NewProjectForm, { props: { dispatch: () => Promise.resolve(ok(created())), logger } });

		expect((wrapper.get('input[data-field="name"]').element as HTMLInputElement).value).toBe('');
	});
});
