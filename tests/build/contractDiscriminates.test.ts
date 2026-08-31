import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { REPO } from '../helpers/repo';

/**
 * ONE child process, not one per case.
 *
 * CLAUDE.md records six ESLint-booting child processes costing 3.76s in synchronous bursts
 * on a two-core runner, and timing out a sibling file's cold Vite transform. A spawn per
 * case is what turns a green suite red on the busiest machine, so the child runs once in a
 * `describe`-level constant and every `it` reads the result back.
 */
const child = spawnSync(
	process.execPath,
	['node_modules/vitest/vitest.mjs', 'run', '--config', 'tests/build/fixtures/vitest.brokenFake.config.ts', '--reporter=json'],
	{ cwd: REPO, encoding: 'utf8', timeout: 120_000 },
);

const output = `${child.stdout ?? ''}${child.stderr ?? ''}`;

/**
 * How many contract cases the planted `name` mismatch breaks — MEASURED by running the child
 * once in the direct-run step, never counted by eye. The contract registers its own suite, so
 * this number is a property of `zone-repository.contract.ts` and changes when that file gains a
 * case that touches `name`. When it changes, re-run and update it with the new figure in the
 * commit message: a moving expectation silently widened is the thing this assertion exists to
 * refuse.
 *
 * TWO, not one: dropping `name` in `save()` corrupts every zone the fixture writes, and two
 * separate cases each read a written zone's `name` back — the ID-keyed upsert case (its
 * replacement name never survives the round trip) and the `listByPlan`/`listByProject` case
 * (every listed zone's name reads back empty). A single-failure assumption was never run; this
 * figure is what running it actually produced.
 */
const EXPECTED_FAILURES = '2';

describe('the repository contract discriminates', () => {
	/**
	 * FOUR assertions, and each closes a way this case would otherwise pass vacuously. A
	 * non-zero exit is true of a wrong `include`, a fixture that fails to import, a vitest
	 * that collected nothing, a failure in setup, a failure in repository construction, and
	 * an unexpected `save()` throw — every one of them looks identical to the defect being
	 * watched for.
	 */
	it('exits non-zero', () => {
		expect(child.status).not.toBe(0);
	});

	it('collected something, so the run was not empty', () => {
		expect(output).toMatch(/"numTotalTests":\s*[1-9]/u);
	});

	/**
	 * EXACTLY the planted failure, and nothing else.
	 *
	 * "Some tests were collected" and "the expected text appears" are both still true when the
	 * child fails a SECOND way — and this fixture is outside `tsconfig.json` by design, so a
	 * port member omitted from the delegation wrapper adds a `... is not a function` failure
	 * with no compiler to catch it. That is not hypothetical: `listByProject` was exactly that
	 * omission one round ago, and every parent case here stayed green.
	 *
	 * The whole purpose of this meta-test is that the child fails for ONE reason (the planted
	 * mutation), so the count is the assertion that carries it. Read from the JSON reporter
	 * rather than inferred from the text, and pinned rather than bounded: a failure count that
	 * grows is a fixture that has stopped isolating its subject, whichever direction it grows
	 * in.
	 *
	 * The expected number comes from RUNNING the fixture in the direct-run step, not from
	 * counting the contract's cases by eye — the contract registers its own suite and the count
	 * is a property of that suite, not of anything visible here.
	 */
	it('fails for exactly the planted reason and no other', () => {
		const failed = /"numFailedTests":\s*(\d+)/u.exec(output)?.[1];

		expect(failed).toBe(EXPECTED_FAILURES);
		expect(output).not.toMatch(/is not a function/u);
		expect(output).not.toMatch(/Cannot read propert/u);
		expect(output).not.toMatch(/ReferenceError/u);
	});

	/**
	 * The exact case titles, not a loose word match — `/name/iu` would match almost anything
	 * this contract could ever fail with, which is the vacuity this whole file exists to
	 * refuse. Both titles, because the planted mutation breaks two cases (see
	 * `EXPECTED_FAILURES` above), and asserting only one would silently stop discriminating
	 * the moment the OTHER one regressed.
	 */
	it('names the cases that failed', () => {
		expect(output).toContain('save is an ID-keyed upsert when given the version it returned');
		expect(output).toContain('listByPlan and listByProject each return only their own zones');
	});

	/**
	 * The ASSERTION TEXT that failed, not merely which case did — this is what tells a broken
	 * round trip from a fixture that threw during construction inside the same case. Both
	 * exact messages, one per failing case, measured from the direct run rather than guessed
	 * from the contract's source.
	 */
	it("reports the round-trip mismatch on the zone's name", () => {
		expect(output).toMatch(/AssertionError|expected/iu);
		expect(output).toContain("expected '' to be 'After'");
		expect(output).toContain("expected [ '', '' ] to deeply equal [ 'A', 'A2' ]");
		expect(output).not.toMatch(/Cannot find module|Failed to load|ERR_MODULE_NOT_FOUND/u);
	});
});
