/**
 * @vitest-environment jsdom
 *
 * `settleUntil` is bounded, and the bound is now a DEADLINE rather than a round count.
 *
 * The helper's docblock has claimed boundedness since it was written — "an unbounded loop turns
 * a real regression into a hung suite" — and nothing checked it, in either spelling. That was
 * survivable while the bound was a round count, because a count cannot fail to terminate. A
 * clock can: a deadline that is never reached, or a comparison written the wrong way round, is
 * a suite that hangs instead of failing, which is the one outcome the sentence promises against.
 *
 * The clock is STUBBED rather than waited out. The real budget is four seconds and the honest
 * version of this file would add four seconds to every CI leg to prove one `throw`; stubbing
 * `Date.now` measures the same property — the loop consults a clock and gives up when it passes
 * — for nothing. What it deliberately does not measure is the VALUE of the budget, which is a
 * judgement about how slow a contended runner gets and which no test here can settle.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { settleUntil } from './editor';

afterEach(() => {
	vi.restoreAllMocks();
});

describe('settleUntil', () => {
	it('returns as soon as the condition holds, without consulting the clock at all', async () => {
		const now = vi.spyOn(Date, 'now');
		let asked = 0;

		await settleUntil(() => {
			asked += 1;
			return true;
		}, 'a condition that is already true');

		expect(asked).toBe(1);
		// One reading, for the deadline it then never needs. A helper that polled before asking
		// would cost every caller a `settle()` they do not need — measurable here as a second
		// question rather than argued.
		expect(now).toHaveBeenCalledTimes(1);
	});

	it('keeps settling while the work is still in flight', async () => {
		let remaining = 3;

		await settleUntil(() => {
			remaining -= 1;
			return remaining <= 0;
		}, 'work that takes three rounds');

		expect(remaining).toBe(0);
	});

	it('gives up when the deadline passes, naming what it was waiting for', async () => {
		// Time leaps past the budget on the second reading, so the loop settles once and then
		// finds itself out of budget. The real four seconds are never spent.
		const start = 1_000_000;
		vi.spyOn(Date, 'now')
			.mockReturnValueOnce(start)
			.mockReturnValue(start + 4_000);

		await expect(settleUntil(() => false, 'something that never happens')).rejects.toThrow(
			/Timed out after \d+ms waiting for: something that never happens/,
		);
	});

	it('accepts a condition that became true during the final settle, rather than losing it to the clock', async () => {
		// The ordering the round-bounded version protected with a re-check after its loop: the
		// condition is asked BEFORE the deadline is tested, so work that lands in the last
		// `settle()` still counts. Written as a mutation guard — swapping those two lines passes
		// every other case in this file.
		//
		// The clock has to be built to reach that ordering, and the first draft of this case was
		// not: it leapt past the deadline on the second reading, so the loop threw having asked
		// the condition exactly once and the sequence the name describes never occurred. The
		// readings are the deadline, then one INSIDE it (so a settle happens), then one outside
		// — which only the mutated order ever consumes.
		const start = 1_000_000;
		vi.spyOn(Date, 'now')
			.mockReturnValueOnce(start)
			.mockReturnValueOnce(start + 100)
			.mockReturnValue(start + 5_000);
		let asked = 0;

		await expect(
			settleUntil(() => {
				asked += 1;
				return asked > 1;
			}, 'work landing on the last round'),
		).resolves.toBeUndefined();
		expect(asked).toBe(2);
	});
});
