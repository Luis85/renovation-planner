/**
 * The blur boundary. Same vocabulary as `useFormCommit`, different commit trigger — and the
 * mirror assertions live here rather than being assumed from that file, because a rule
 * proven on one composable and assumed on the other is how this pair drifted in the first
 * place.
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useFieldCommit } from '../../../src/presentation/composables/use-field-commit';
import type { FieldErrorMap } from '../../../src/presentation/errors/route-error';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';

interface QuantityInput {
	readonly quantity: number;
}

type Run = () => Promise<Result<void, AppError>>;
type Notify = (error: AppError) => void;

const MAP: FieldErrorMap<QuantityInput> = { 'requirement.negative-quantity': 'quantity' };
const say = (error: AppError): string => `copy for ${error.code}`;
const noop = (): void => undefined;

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

function harness(result: Result<void, AppError>, canonical = ref(10)) {
	const run = vi.fn<Run>(() => Promise.resolve(result));
	const notify = vi.fn<Notify>();
	const field = useFieldCommit<number, QuantityInput>({
		canonicalValue: () => canonical.value,
		buildCommand: (value) => ({
			execute: () => Promise.resolve(result),
			undo: () => Promise.resolve(ok(undefined)),
			value,
		}),
		history: { run },
		errorMap: MAP,
		field: 'quantity',
		toUserMessage: say,
		notify,
	});
	return { field, run, canonical, notify };
}

describe('useFieldCommit', () => {
	it('starts clean at the canonical value', () => {
		const { field } = harness(ok(undefined));

		expect(field.draft.value).toBe(10);
		expect(field.error.value).toBeNull();
	});

	it('keeps the rejected value and shows its error, dispatching exactly once', async () => {
		const { field, run } = harness(err(validation('requirement.negative-quantity')));

		field.onInput(-5);
		await field.onCommit();

		expect(field.draft.value).toBe(-5);
		expect(field.error.value).toBe('copy for requirement.negative-quantity');
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('reports a failure it cannot attach to this field instead of swallowing it', async () => {
		// The Inspector has no banner region, so a refusal with no field to sit under has
		// exactly one door left. A first draft cleared the error and called nothing, which
		// made a resolved vault failure invisible on BOTH surfaces — worse than the
		// `notifyError` in `commitEdit` that this slice narrows.
		const fault: AppError = {
			category: 'Persistence',
			code: 'vault.unexpected-failure',
			message: 'developer english',
		};
		const { field, notify } = harness(err(fault));

		field.onInput(-5);
		await field.onCommit();

		expect(notify).toHaveBeenCalledWith(fault);
		// The ORIGINAL error, not a resolved string: the caller's door owns the copy.
		expect(field.error.value).toBeNull();
		// Still kept, for the same reason a refused draft is: the user's typing is not the
		// vault's fault and retyping it is not a fix.
		expect(field.draft.value).toBe(-5);
	});

	it('does not reach the notice door for a refusal this field CAN show', async () => {
		const { field, notify } = harness(err(validation('requirement.negative-quantity')));

		field.onInput(-5);
		await field.onCommit();

		// Both doors for one failure is the double-report `commitEdit`'s narrowing exists to
		// prevent: a message under the input AND a notice about the same press.
		expect(notify).not.toHaveBeenCalled();
		expect(field.error.value).toBe('copy for requirement.negative-quantity');
	});

	it('retires the message when the user corrects the value, dispatching nothing', async () => {
		const { field, run } = harness(err(validation('requirement.negative-quantity')));
		field.onInput(-5);
		await field.onCommit();

		field.onInput(5);

		// BOTH halves: onInput's own job, and its side effect.
		expect(field.draft.value).toBe(5);
		expect(field.error.value).toBeNull();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('discards the draft and clears the error on cancel, dispatching nothing', async () => {
		const { field, run } = harness(err(validation('requirement.negative-quantity')));
		field.onInput(-5);
		await field.onCommit();

		field.onCancel();

		expect(field.draft.value).toBe(10);
		expect(field.error.value).toBeNull();
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('does not discard a keystroke that landed while the write was in flight', async () => {
		// A slow vault write with the user still typing. The success belongs to the OLD draft;
		// clearing unconditionally replaced the newer text with the canonical value mid-word,
		// with nothing erroring and no way for the user to tell it had happened.
		let settle: () => void = noop;
		const run = vi.fn<Run>(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
			}),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: () => ({ execute: () => Promise.resolve(ok(undefined)), undo: () => Promise.resolve(ok(undefined)) }),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn<Notify>(),
		});

		field.onInput(-5);
		const inFlight = field.onCommit();
		expect(field.pending.value).toBe(true);
		field.onInput(-7);
		settle();
		await inFlight;

		expect(field.draft.value).toBe(-7);
		expect(field.pending.value).toBe(false);
	});

	it('coalesces repeated commit gestures into one follow-up dispatch', async () => {
		// The control stays enabled (Task 9), so three blurs during one slow write are
		// ordinary. `CommandHistory` serializes them but still executes and RECORDS each, so
		// without coalescing one edit leaves three undo entries.
		const settles: (() => void)[] = [];
		const run = vi.fn<Run>(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settles.push(() => { resolve(ok(undefined)); });
			}),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: (value) => ({
				execute: () => Promise.resolve(ok(undefined)),
				undo: () => Promise.resolve(ok(undefined)),
				value,
			}),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn<Notify>(),
		});

		field.onInput(-5);
		const first = field.onCommit();
		field.onInput(-6);
		void field.onCommit();
		field.onInput(-7);
		void field.onCommit();
		expect(run).toHaveBeenCalledTimes(1);

		settles[0]();
		await first;

		// Two dispatches for three gestures: the original, then ONE carrying the latest draft.
		expect(run).toHaveBeenCalledTimes(2);
		expect(field.pending.value).toBe(true);
	});

	it('does not re-dispatch when the draft never moved', async () => {
		// Two blurs with no edit between them are one edit. A second identical dispatch would
		// buy an undo entry that undoes nothing visible.
		let settle: () => void = noop;
		const run = vi.fn<Run>(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
			}),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: () => ({ execute: () => Promise.resolve(ok(undefined)), undo: () => Promise.resolve(ok(undefined)) }),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn<Notify>(),
		});

		field.onInput(-5);
		const inFlight = field.onCommit();
		void field.onCommit();
		settle();
		await inFlight;

		expect(run).toHaveBeenCalledTimes(1);
		// And the flag is honest once nothing is outstanding — the defect was the FIRST
		// call's finally clearing it while a later one was still queued.
		expect(field.pending.value).toBe(false);
	});

	it('tracks a new canonical value after an accepted commit', async () => {
		const { field, canonical } = harness(ok(undefined));
		field.onInput(20);
		await field.onCommit();

		// The DTO refresh that follows a successful write.
		canonical.value = 20;

		expect(field.draft.value).toBe(20);
		expect(field.error.value).toBeNull();
	});

	it('routes an unmapped code to no field, leaving error null for the caller to notice', async () => {
		// The Inspector has no banner region, so a banner-routed error is `commitEdit`'s to
		// notify. This composable's contract is that it does not invent a field error for one.
		const { field } = harness(err(validation('vault.unexpected-failure')));
		field.onInput(1);
		await field.onCommit();

		expect(field.error.value).toBeNull();
	});

	it('refuses a draft it cannot even turn into a command, dispatching nothing', async () => {
		// `validate` is this field's own guard for a draft with no command to build at all —
		// distinct from a routed `AppError`, since nothing was ever dispatched to produce one.
		const run = vi.fn<Run>(() => Promise.resolve(ok(undefined)));
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: (value) => ({
				execute: () => Promise.resolve(ok(undefined)),
				undo: () => Promise.resolve(ok(undefined)),
				value,
			}),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn<Notify>(),
			validate: (value) => (value < 0 ? 'must be zero or more' : null),
		});

		field.onInput(-5);
		await field.onCommit();

		expect(field.error.value).toBe('must be zero or more');
		expect(field.draft.value).toBe(-5);
		expect(run).not.toHaveBeenCalled();
		expect(field.pending.value).toBe(false);
	});

	it('retires a queued recommit on cancel, so a settling write cannot resurrect it', async () => {
		// A blur queues a second commit while the first is still in flight, then the user
		// presses Escape before it settles. `recommit` is a request about a VALUE the user has
		// since abandoned, not a standing intent — so cancelling it must stop the settling
		// write's chain from dispatching a draft the user explicitly threw away.
		let settle: (result: Result<void, AppError>) => void = noop;
		const run = vi.fn<Run>(
			() => new Promise<Result<void, AppError>>((resolve) => { settle = resolve; }),
		);
		const field = useFieldCommit<number, QuantityInput>({
			canonicalValue: () => 10,
			buildCommand: (value) => ({
				execute: () => Promise.resolve(ok(undefined)),
				undo: () => Promise.resolve(ok(undefined)),
				value,
			}),
			history: { run },
			errorMap: MAP,
			field: 'quantity',
			toUserMessage: say,
			notify: vi.fn<Notify>(),
		});

		field.onInput(-5);
		const inFlight = field.onCommit();
		field.onInput(-7);
		void field.onCommit();
		field.onCancel();
		settle(ok(undefined));
		await inFlight;

		// Only the original dispatch ever happened: the queued recommit for -7 must not fire
		// once cancel has retired it.
		expect(run).toHaveBeenCalledTimes(1);
		expect(field.draft.value).toBe(10);
		expect(field.pending.value).toBe(false);
	});
});
