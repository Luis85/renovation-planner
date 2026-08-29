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
import type { AppError } from '../../../src/core/errors/AppError';
import type { CreateProjectInput } from '../../../src/application/commands/project/CreateProject';

type CreatedProject = { readonly project: { readonly entity: { readonly id: string } } };
type Dispatch = (input: CreateProjectInput) => Promise<Result<CreatedProject, AppError>>;

function projectError(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

describe('NewProjectForm', () => {
	it('sends exactly the typed values to the command, once', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok({ project: { entity: { id: 'p1' } } })));
		const wrapper = mount(NewProjectForm, { props: { dispatch } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Kitchen' });
	});

	it('emits submit only after the write succeeded', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(ok({ project: { entity: { id: 'p1' } } })) },
		});

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.emitted('submit')).toHaveLength(1);
	});

	it('keeps the typed value, renders the error under its own field, and does NOT emit submit', async () => {
		const wrapper = mount(NewProjectForm, {
			props: { dispatch: () => Promise.resolve(err(projectError('project.empty-name'))) },
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
			props: { dispatch: () => Promise.resolve(err(projectError('project.target-before-start'))) },
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
						err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'dev' } as AppError),
					),
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
			props: { dispatch: () => Promise.resolve(err(projectError('project.empty-name'))) },
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
			props: { dispatch: () => Promise.resolve(err(projectError('project.target-before-start'))) },
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
						err({ category: 'Persistence', code: 'vault.unexpected-failure', message: 'dev' } as AppError),
					),
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
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok({ project: { entity: { id: 'p1' } } })));
		const wrapper = mount(NewProjectForm, { props: { dispatch } });

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
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok({ project: { entity: { id: 'p1' } } })));
		const wrapper = mount(NewProjectForm, { props: { dispatch } });

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
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(ok({ project: { entity: { id: 'p1' } } })));
		const wrapper = mount(NewProjectForm, { props: { dispatch } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('input[data-field="start"]').setValue('2026-01-01');
		await wrapper.get('input[data-field="start"]').setValue('');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(dispatch.mock.calls[0][0].start).toBeNull();
	});

	/**
	 * The disable-during-submit rule, asserted on what `dispatch` RECEIVED rather than merely
	 * on a control's attribute — a form that disabled its inputs but still read a live
	 * `values` ref at dispatch time would pass a weaker version of this case. `submit` reads
	 * `values.value` ONCE; `setField` replaces the whole ref, so an edit landing during the
	 * slow write must not be visible in what was already sent.
	 */
	it('disables every control while a write is in flight, and ignores a setField racing it', async () => {
		let resolveDispatch: (() => void) | null = null;
		const dispatch = vi.fn<Dispatch>(
			() =>
				new Promise((resolve) => {
					resolveDispatch = () => {
						resolve(ok({ project: { entity: { id: 'p1' } } }));
					};
				}),
		);
		const wrapper = mount(NewProjectForm, { props: { dispatch } });

		await wrapper.get('input[data-field="name"]').setValue('Kitchen');
		await wrapper.get('form').trigger('submit');
		await flushPromises();

		expect(wrapper.get('input[data-field="name"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('select[data-field="status"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('textarea[data-field="description"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('input[data-field="start"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('input[data-field="targetCompletion"]').attributes('disabled')).toBeDefined();
		expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined();

		// A racing edit while the write is still pending — a real browser refuses this on a
		// disabled control, so what this drives is the underlying guarantee rather than the
		// browser's own enforcement: `submit` already read `values.value` once, before this
		// call, so a later `setField` must not reach the in-flight dispatch either way.
		await wrapper.get('input[data-field="name"]').setValue('Bathroom');

		expect(resolveDispatch).not.toBeNull();
		(resolveDispatch as (() => void) | null)?.();
		await flushPromises();

		expect(dispatch).toHaveBeenCalledTimes(1);
		expect(dispatch.mock.calls[0][0]).toMatchObject({ name: 'Kitchen' });
	});
});
