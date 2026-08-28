/**
 * The submit boundary, driven against a fake dispatch.
 *
 * `values` and `fieldErrors` are REFS, so every assertion dereferences `.value`. The
 * unwrapping that lets a template write `values.name` is a template feature and does not
 * apply here.
 */
import { describe, expect, it, vi } from 'vitest';
import { useFormCommit } from '../../../src/presentation/composables/use-form-commit';
import type { FieldErrorMap } from '../../../src/presentation/errors/route-error';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';

interface NewProject {
	readonly name: string;
	readonly status: string;
}

type Dispatch = (input: NewProject) => Promise<Result<{ id: string }, AppError>>;

const MAP: FieldErrorMap<NewProject> = { 'project.empty-name': 'name' };
const say = (error: AppError): string => `copy for ${error.code}`;
const noop = (): void => undefined;

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

function harness(dispatch: Dispatch) {
	return useFormCommit<NewProject, { id: string }>({
		initial: { name: '', status: 'IDEA' },
		dispatch,
		errorMap: MAP,
		toUserMessage: say,
	});
}

describe('useFormCommit', () => {
	it('keeps every typed value on a rejection, routes the error to its field, and writes nothing', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(err(validation('project.empty-name'))));
		const form = harness(dispatch);

		form.setField('name', '   ');
		const closed = await form.submit();

		expect(closed).toBe(false);
		expect(form.fieldErrors.value.get('name')).toBe('copy for project.empty-name');
		// Draft preservation is the point of this case: the rejected value survives.
		expect(form.values.value.name).toBe('   ');
		expect(form.banner.value).toBeNull();
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('retires a rejected field’s message when the user edits it, and dispatches nothing doing so', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(err(validation('project.empty-name'))));
		const form = harness(dispatch);
		await form.submit();

		form.setField('name', 'Kitchen');

		// BOTH halves. A setField that only cleared the error would satisfy the second alone.
		expect(form.values.value.name).toBe('Kitchen');
		expect(form.fieldErrors.value.has('name')).toBe(false);
		expect(dispatch).toHaveBeenCalledTimes(1);
	});

	it('retires a CROSS-FIELD error from both of its fields when either one is edited', async () => {
		// `project.target-before-start` is about the PAIR. Clearing only the edited half would
		// leave a message describing a pair that may now be valid — the untruth setField's
		// clearing exists to prevent, reintroduced by the array form this slice added to prove.
		const map: FieldErrorMap<NewProject> = { 'project.target-before-start': ['name', 'status'] };
		const form = useFormCommit<NewProject, { id: string }>({
			initial: { name: '', status: 'IDEA' },
			dispatch: () => Promise.resolve(err(validation('project.target-before-start'))),
			errorMap: map,
			toUserMessage: say,
		});
		await form.submit();
		expect(form.fieldErrors.value.size).toBe(2);

		form.setField('name', 'Kitchen');

		expect(form.fieldErrors.value.size).toBe(0);
	});

	it('leaves an unrelated field’s error untouched when one field is edited', async () => {
		const dispatch = vi.fn<Dispatch>(() => Promise.resolve(err(validation('project.empty-name'))));
		const form = harness(dispatch);
		await form.submit();

		form.setField('status', 'PLANNING');

		expect(form.fieldErrors.value.get('name')).toBe('copy for project.empty-name');
	});

	it('routes an unmapped code to the banner and to no field', async () => {
		const persistence: AppError = {
			category: 'Persistence',
			code: 'project.save-failed',
			message: 'developer english',
		};
		const form = harness(() => Promise.resolve(err(persistence)));

		await form.submit();

		expect(form.banner.value).toBe('copy for project.save-failed');
		expect(form.fieldErrors.value.size).toBe(0);
	});

	it('resolves true on success with no errors left behind', async () => {
		const form = harness(() => Promise.resolve(ok({ id: 'p1' })));
		form.setField('name', 'Kitchen');

		await expect(form.submit()).resolves.toBe(true);
		expect(form.fieldErrors.value.size).toBe(0);
		expect(form.banner.value).toBeNull();
	});

	it('clears a previous submission’s errors before dispatching the next one', async () => {
		// Otherwise a stale message from submit #1 outlives the submit that fixed it.
		let fail = true;
		const form = harness(() => Promise.resolve(fail ? err(validation('project.empty-name')) : ok({ id: 'p1' })));
		await form.submit();
		fail = false;

		await form.submit();

		expect(form.fieldErrors.value.size).toBe(0);
	});

	it('refuses a second submit while the first is still in flight', async () => {
		// One form, one project. Without the guard, two Enter presses mint two ids and create
		// two projects, and the user sees one dialog.
		let release: () => void = noop;
		const dispatch = vi.fn<Dispatch>(
			() => new Promise<Result<{ id: string }, AppError>>((resolve) => {
				release = () => resolve(ok({ id: 'p1' }));
			}),
		);
		const form = harness(dispatch);

		const first = form.submit();
		const second = await form.submit();

		expect(second).toBe(false);
		expect(dispatch).toHaveBeenCalledTimes(1);
		release();
		await expect(first).resolves.toBe(true);
	});

	it('marks submitting for the duration of the dispatch', async () => {
		let release: () => void = noop;
		const form = harness(
			() =>
				new Promise((resolve) => {
					release = () => resolve(ok({ id: 'p1' }));
				}),
		);

		const pending = form.submit();
		expect(form.submitting.value).toBe(true);
		release();
		await pending;
		expect(form.submitting.value).toBe(false);
	});
});
