/**
 * The blur boundary. Same vocabulary as `useFormCommit`, different commit trigger — and the
 * mirror assertions live here rather than being assumed from that file, because a rule
 * proven on one composable and assumed on the other is how this pair drifted in the first
 * place.
 */
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import { useFieldCommit } from '../../../src/presentation/composables/use-field-commit';
import type { FieldErrorMap } from '../../../src/presentation/errors/route-error';
import { err, ok, type Result } from '../../../src/core/result/Result';
import type { AppError } from '../../../src/core/errors/AppError';
import type { Logger } from '../../../src/application/ports/Logger';

interface QuantityInput {
	readonly quantity: number;
}

type Run = () => Promise<Result<void, AppError>>;
type Notify = (error: AppError) => void;

/**
 * A spy for every level, so a case can assert WHICH one a fault took as well as that one
 * was taken at all — `faultError` promises `error`, and a version that logged at `warn`
 * would still satisfy a bare 'something was logged'.
 */
type LogAt = (event: string, context?: Record<string, unknown>) => void;

const spyLogger = (): Logger & { error: ReturnType<typeof vi.fn<LogAt>>; warn: ReturnType<typeof vi.fn<LogAt>> } => ({
	debug: vi.fn<LogAt>(),
	info: vi.fn<LogAt>(),
	warn: vi.fn<LogAt>(),
	error: vi.fn<LogAt>(),
});

const MAP: FieldErrorMap<QuantityInput> = { 'requirement.negative-quantity': 'quantity' };
const say = (error: AppError): string => `copy for ${error.code}`;
const noop = (): void => undefined;

function validation(code: string): AppError {
	return { category: 'Validation', code, message: 'developer english' };
}

/**
 * `outcome` is either the `Result` every dispatch settles with, or the whole `run` — the
 * second form is what a case needs when it has to hold a write OPEN and act while it is in
 * flight, and taking both here is what keeps such a case from hand-building a twelfth copy
 * of this options object just to swap one member.
 */
function harness(outcome: Result<void, AppError> | Run, canonical = ref(10)) {
	const dispatch: Run = typeof outcome === 'function' ? outcome : () => Promise.resolve(outcome);
	const run = vi.fn<Run>(dispatch);
	const notify = vi.fn<Notify>();
	const logger = spyLogger();
	// WHICH value each dispatch carried, in order. `history.run` is typed to take no arguments,
	// so the spy cannot answer this — and every coalescing case written before this one
	// asserted only how MANY dispatches happened. That is exactly the gap a coalesced round
	// sending a draft nobody had committed lived in: the count was right and the value was not.
	const built: number[] = [];
	const field = useFieldCommit<number, QuantityInput>({
		canonicalValue: () => canonical.value,
		buildCommand: (value) => {
			built.push(value);
			return {
				// Never actually invoked: the composable hands the command to `history.run`, which
				// is the spy above. Present because `RunnableCommand` requires it.
				execute: dispatch,
				undo: () => Promise.resolve(ok(undefined)),
				value,
			};
		},
		history: { run },
		errorMap: MAP,
		field: 'quantity',
		toUserMessage: say,
		notify,
		logger,
	});
	return { field, run, canonical, notify, logger, built };
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
		const { field } = harness(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
			}),
		);

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
		const { field, run } = harness(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settles.push(() => { resolve(ok(undefined)); });
			}),
		);

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
		const { field, run } = harness(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
			}),
		);

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

	it('announces a field refusal it cannot display, when the draft moved under the write', async () => {
		// THE ONE PATH THAT REPORTED A FAILED WRITE NOWHERE. Two rules meet here and the first
		// draft let them cancel out: a message about a value the user has since replaced is not
		// shown inline, and a refusal that IS this field's own is not notified because the inline
		// message already says it. When the draft has moved, the inline half is suppressed — and
		// a `!mine` test then skipped the notice too, so the write failed and neither door spoke.
		// The notice covers whatever the field did not DISPLAY, not whatever was not `mine`.
		let settle: (result: Result<void, AppError>) => void = noop;
		const refusal = validation('requirement.negative-quantity');
		const { field, notify } = harness(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = resolve;
			}),
		);

		field.onInput(-5);
		const inFlight = field.onCommit();
		// The user types on while the write is in flight, so the refusal is about a value the
		// field no longer holds.
		field.onInput(7);
		settle(err(refusal));
		await inFlight;

		expect(field.error.value).toBeNull();
		expect(field.draft.value).toBe(7);
		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith(refusal);
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
			logger: spyLogger(),
			validate: (value) => (value < 0 ? 'must be zero or more' : null),
		});

		field.onInput(-5);
		await field.onCommit();

		expect(field.error.value).toBe('must be zero or more');
		expect(field.draft.value).toBe(-5);
		expect(run).not.toHaveBeenCalled();
		expect(field.pending.value).toBe(false);
	});

	it('retires a queued recommit on cancel, so a settling write cannot resurrect it even under fresh typing', async () => {
		// A blur queues a second commit while the first is still in flight, then the user
		// presses Escape before it settles, THEN types again. `recommit` is a request about a
		// VALUE the user has since abandoned, not a standing intent — so cancelling it must
		// stop the settling write's chain from dispatching a draft the user explicitly threw
		// away, and must stay retired even once fresh typing makes the draft non-null again.
		//
		// The fresh typing after cancel is load-bearing for what this test can SEE: `onCancel`
		// also nulls `drafted`, and the coalescing guard's `drafted.value !== null` conjunct
		// alone would block a re-dispatch for THAT reason — discriminating nothing about
		// whether `recommit` itself was retired. Only typing again, so `drafted.value` is
		// non-null while `recommit` is the one thing left standing between "nothing queued"
		// and "the abandoned request fires after all", makes the two implementations disagree.
		let settle: (result: Result<void, AppError>) => void = noop;
		const { field, run } = harness(
			() => new Promise<Result<void, AppError>>((resolve) => { settle = resolve; }),
		);

		field.onInput(-5);
		const inFlight = field.onCommit();
		field.onInput(-7);
		void field.onCommit();
		field.onCancel();
		field.onInput(-9);
		settle(ok(undefined));
		await inFlight;

		// Only the original dispatch ever happened: the queued recommit for -7 must not fire
		// once cancel has retired it, and the fresh -9 must not be swept up into it either.
		expect(run).toHaveBeenCalledTimes(1);
		expect(field.draft.value).toBe(-9);
		expect(field.pending.value).toBe(false);
	});

	it('dispatches the draft the QUEUED gesture carried, not text typed after it', async () => {
		// The rule is this composable's own: a keystroke never dispatches. A blur during a slow
		// write queues a commit for the value on screen AT THAT MOMENT; if the user then clicks
		// back in and types WITHOUT blurring, the settling write's continuation must still carry
		// the queued value. Sending the newer text persists a draft nobody committed, and it does
		// so only because an invisible background write happened to be in flight — not a
		// distinction the user can make, so the field would behave differently for a reason it
		// never shows them.
		//
		// `onCancel`'s own comment already records this exact class — "the settling write's loop
		// dispatched keystrokes the user had never committed" — and closed it for the ESCAPE path
		// alone. This is the same defect with no Escape in it.
		let settle: (result: Result<void, AppError>) => void = noop;
		const { field, run, built } = harness(
			() => new Promise<Result<void, AppError>>((resolve) => { settle = resolve; }),
		);

		field.onInput(-5);
		const inFlight = field.onCommit();
		field.onInput(-6);
		void field.onCommit();
		// Typed, never committed — no blur, no Enter, no Escape.
		field.onInput(-7);
		settle(ok(undefined));
		await inFlight;
		await flushPromises();

		expect(run).toHaveBeenCalledTimes(2);
		// The queued gesture's value, not the one typed after it.
		expect(built).toEqual([-5, -6]);
		// And the uncommitted text stays the user's to finish.
		expect(field.draft.value).toBe(-7);
	});

	it('dispatches nothing when a commit gesture lands with no draft to commit', async () => {
		// Task 9 binds `@blur="onCommit"` unconditionally — every blur, not just a dirty one.
		// Tabbing through an untouched Inspector field must not write the canonical value back
		// to itself on every pass.
		const { field, run } = harness(() => Promise.resolve(ok(undefined)));

		field.onInput(20);
		await field.onCommit();
		// Two further blurs with no edit between them and this one.
		await field.onCommit();
		await field.onCommit();

		expect(run).toHaveBeenCalledTimes(1);
	});

	it('treats a null draft as a real value to commit, not as "nothing typed"', async () => {
		// Task 9's real consumers are nullable by construction (`GetRequirementsForZone`'s
		// override fields are `Decimal | null` / `Money | null`), so `onInput(null)` is a real
		// gesture — "clear this override" — that a `?.`/`??`-shaped `draft` would silently
		// collapse back to the canonical value instead of dispatching the clear.
		interface OverrideInput {
			readonly cost: number | null;
		}
		type BuildOverrideCommand = (value: number | null) => {
			execute: () => Promise<Result<void, AppError>>;
			undo: () => Promise<Result<void, AppError>>;
			value: number | null;
		};
		const buildCommand = vi.fn<BuildOverrideCommand>((value) => ({
			execute: () => Promise.resolve(ok(undefined)),
			undo: () => Promise.resolve(ok(undefined)),
			value,
		}));
		const run = vi.fn<Run>(() => Promise.resolve(ok(undefined)));
		const field = useFieldCommit<number | null, OverrideInput>({
			canonicalValue: () => 5,
			buildCommand,
			history: { run },
			errorMap: {},
			field: 'cost',
			toUserMessage: say,
			notify: vi.fn<Notify>(),
			logger: spyLogger(),
		});

		field.onInput(null);

		// Shows the clear, not the canonical value it would collapse into under `?.`/`??`.
		expect(field.draft.value).toBeNull();

		await field.onCommit();

		expect(run).toHaveBeenCalledTimes(1);
		// Dispatched the CLEAR, not the canonical value it would fall back to under `?.`/`??`.
		expect(buildCommand).toHaveBeenCalledWith(null);
	});

	it('re-validates the LATEST draft on a coalesced round rather than trusting a check made earlier', async () => {
		// A version that validated once at the top of the chain and returned early on an
		// invalid draft WITHOUT clearing `recommit` would validate the draft in scope at that
		// moment — but the round that actually fires later carries a DIFFERENT, newer draft.
		// Commit a VALID value (starts a write, still in flight), then type something
		// `validate` refuses, then blur again: when the first write settles, the coalesced
		// round must re-validate and refuse the malformed draft rather than ever dispatching
		// it.
		let settle: () => void = noop;
		const run = vi.fn<Run>(
			() => new Promise<Result<void, AppError>>((resolve) => {
				settle = () => { resolve(ok(undefined)); };
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
			logger: spyLogger(),
			validate: (value) => (value < 0 ? 'must be zero or more' : null),
		});

		field.onInput(5);
		const first = field.onCommit();
		field.onInput(-3);
		void field.onCommit();

		settle();
		await first;

		// The coalesced round validated -3 and refused it — `history.run` was never called a
		// second time, and the malformed draft never reached `buildCommand`/`history.run`.
		expect(run).toHaveBeenCalledTimes(1);
		expect(field.error.value).toBe('must be zero or more');
		expect(field.draft.value).toBe(-3);
		expect(field.pending.value).toBe(false);
	});

	it('resets pending after a thrown fault on the directly-awaited round, and the field stays usable', async () => {
		// `history.run`/`buildCommand` are only EXPECTED to resolve a Result (SDD §65) — a
		// throw is an unexpected technical fault, and this composable must not wedge on one.
		const fault = new Error('vault fault');
		let calls = 0;
		const { field, run } = harness(() => {
			calls += 1;
			return calls === 1 ? Promise.reject(fault) : Promise.resolve(ok(undefined));
		});

		field.onInput(-5);
		await expect(field.onCommit()).rejects.toBe(fault);

		// The throw must not wedge the field: `pending` clears, and a LATER gesture can still
		// dispatch — a regression that drops the `finally` leaves `pending` stuck `true`
		// forever, with every later `onCommit()` swallowed silently by the `if (inFlight)`
		// guard.
		expect(field.pending.value).toBe(false);
		field.onInput(-6);
		await field.onCommit();
		expect(run).toHaveBeenCalledTimes(2);
	});

	it('notifies AND logs the mapped fault from a coalesced round rejection, once each', async () => {
		const fault = new Error('vault fault in continuation');
		let settleFirst: (result: Result<void, AppError>) => void = noop;
		let calls = 0;
		const { field, run, notify, logger } = harness(() => {
			calls += 1;
			if (calls === 1) {
				return new Promise<Result<void, AppError>>((resolve) => { settleFirst = resolve; });
			}
			if (calls === 2) return Promise.reject(fault);
			return Promise.resolve(ok(undefined));
		});

		// A bare `void commitOnce()` on the continuation path gives a throw here no handler at
		// all — nobody holds that specific promise to catch it themselves — so this listener
		// is the deterministic instrument for "did anything become an unhandled rejection",
		// rather than trusting a reporter's incidental formatting.
		const unhandled: unknown[] = [];
		const onUnhandledRejection = (reason: unknown): void => {
			unhandled.push(reason);
		};
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			field.onInput(-5);
			const first = field.onCommit();
			field.onInput(-7);
			void field.onCommit();

			settleFirst(ok(undefined));
			await first;
			// Flush past the continuation's own throw-and-catch, which runs on a later
			// microtask than `first`'s own resolution.
			await flushPromises();
			await flushPromises();
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}

		expect(unhandled).toEqual([]);
		expect(run).toHaveBeenCalledTimes(2);
		// The signal that the write failed: mapped to the SAME coded refusal a guarded service
		// would have produced, since `notify` is the only door this field has for a failure it
		// cannot attach anywhere else. A version that only repaired `inFlight`/`pending` and
		// discarded the cause would leave this uncalled while the field looked perfectly settled.
		expect(notify).toHaveBeenCalledTimes(1);
		expect(notify).toHaveBeenCalledWith({
			category: 'Persistence',
			code: 'vault.unexpected-failure',
			message: fault.message,
			cause: fault,
		});
		// The DEVELOPER-facing half of the same failure, which this door produced for nobody
		// until now: it mapped the cause with a `createVaultExceptionMapper` of its own and
		// called `options.notify`, so a fault reached the user as a sentence and a developer as
		// silence — verbatim the defect CLAUDE.md records `notifyFault` already having had
		// fixed once. SDD §66 asks that the two halves come from ONE step, so the assertion is
		// that `faultError` ran: one `error` line, carrying the ORIGINAL cause (the only detail
		// that exists here, since no guard ran below to have recorded it) and the mapped code.
		expect(logger.error).toHaveBeenCalledTimes(1);
		expect(logger.error).toHaveBeenCalledWith('field.commit.continuation.faulted', {
			cause: fault,
			code: 'vault.unexpected-failure',
		});
		expect(logger.warn).not.toHaveBeenCalled();
		// The continuation's own fault must not wedge the field either.
		expect(field.pending.value).toBe(false);
		field.onInput(-9);
		await field.onCommit();
		expect(run).toHaveBeenCalledTimes(3);
	});
});
