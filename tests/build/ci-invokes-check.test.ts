import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { REPO } from '../helpers/repo';

/**
 * `yaml` — a real, general parser, not a hand-rolled reader — so every one of `ci.yml`'s
 * comments, whether trailing a value or occupying a whole line, is stripped correctly
 * (measured: a `# trailing comment` appended to the `run: npm run check` line changes no
 * assertion below). One residual is still worth naming rather than assuming closed: a
 * YAML block scalar (`run: |` followed by an indented `npm run check` on its own line) is
 * legal, parses to the string `"npm run check\n"` — note the trailing newline literal
 * block style keeps — and would fail every string-equality assertion below that expects
 * the bare `'npm run check'`, for a reason that has nothing to do with whether CI actually
 * runs the gate. Today's file writes it as a plain scalar and this is unlikely to change
 * for a single-line command, but the gap is real and unclosed, so it is written down here
 * rather than left to be rediscovered.
 */
interface Workflow {
	/** The concurrency group, read by the cancel-superseded-runs case below. */
	readonly concurrency?: { readonly group?: string; readonly 'cancel-in-progress'?: boolean };
	readonly on: { readonly push?: { readonly branches?: readonly string[] }; readonly pull_request?: unknown };
	readonly jobs: Record<
		string,
		{
			readonly 'runs-on'?: string;
			readonly strategy?: {
				readonly 'fail-fast'?: boolean;
				readonly matrix?: { readonly include?: readonly { os: string; node: string }[] };
			};
			// `if` is part of the shape at BOTH levels deliberately: the unconditional-execution
			// case below reads them, and a type that omitted either would make that assertion
			// unwritable. The JOB-level one is the half a first draft missed — see that case.
			readonly if?: string;
			readonly 'continue-on-error'?: boolean;
			readonly steps?: readonly { run?: string; if?: string; uses?: string; with?: Record<string, string>; 'continue-on-error'?: boolean }[];
		}
	>;
}

const workflow = parse(readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8')) as Workflow;

describe('CI invokes the definition of done', () => {
	/**
	 * BOTH triggers. "On every PR" leaves the push trigger free to be removed or narrowed
	 * with this test still green, and direct commits to `main` then bypass every
	 * architecture gate. SDD §8's wording is "every push/PR"; this matches it.
	 */
	it('runs on pull requests and on pushes to main, UNFILTERED', () => {
		expect(workflow.on.pull_request).toBeDefined();
		expect(workflow.on.push?.branches).toContain('main');

		// Presence is not enough, and this is the same conjunction defect the step/job
		// condition case already had to fix. `pull_request: { types: [opened] }` passes the
		// assertion above while no SYNCHRONIZE ever runs the gate — a PR verified once and
		// never again after a fixup. `paths`/`paths-ignore` on either trigger passes it too,
		// while a change touching only unfiltered paths skips verification entirely.
		//
		// A filter is refused rather than interpreted: a condition this test has to reason
		// about is one it will eventually reason about wrongly, and the gate this slice builds
		// has no business being conditional on which files a commit touched.
		// Enumerated as a SET rather than one `not.toHaveProperty` per field, because listing
		// them by hand is what left `branches` out of the first version — and a draft of this
		// very comment predicted "the next hole here will also be an existence check standing
		// in for an applicability one" one round before `pull_request: { branches: [x] }` was
		// found doing exactly that. A prediction is not a check.
		//
		// `push.branches` is the one filter that must be PRESENT (it is what scopes the push
		// trigger to main), so it is excluded from the pull-request list rather than shared.
		const PR_FILTERS = ['types', 'paths', 'paths-ignore', 'branches', 'branches-ignore'] as const;
		const PUSH_FILTERS = ['paths', 'paths-ignore', 'branches-ignore'] as const;

		// `pull_request:` with nothing after the colon and no children is legal YAML for
		// "the trigger, unfiltered" — and the real `yaml` package parses that as `null`, not
		// `{}` (measured: `parse('pull_request:\n').pull_request === null`). `not.toHaveProperty`
		// on `null` throws a TypeError rather than failing the assertion, so the loop reads
		// against `?? {}` — the same claim ("this trigger carries none of these keys"), made
		// null-safe rather than reworded.
		for (const filter of PR_FILTERS) expect(workflow.on.pull_request ?? {}).not.toHaveProperty(filter);
		for (const filter of PUSH_FILTERS) expect(workflow.on.push ?? {}).not.toHaveProperty(filter);
	});

	/**
	 * `npm run check` VERBATIM, not a re-enumeration of its steps. A workflow that spelled
	 * out `build && lint && test` would drift silently the day `check` changes.
	 */
	it('runs npm run check on every declared leg, as one command', () => {
		const verify = workflow.jobs['verify'];
		const legs = (verify?.strategy?.matrix?.include ?? []).map((leg) => `${leg.os}:${leg.node}`);
		const commands = (verify?.steps ?? []).map((step) => step.run).filter((run): run is string => run !== undefined);

		// EXACT tuples, not "at least one of each OS". `some(os.startsWith('ubuntu'))` stays
		// true when the 24 and 26 legs are deleted, because 22 is still there — leaving two of
		// the three ranges `engines.node` declares unexecuted, which is the defect
		// `engines.node` itself exists to catch, moved to a different file.
		// `tests/release/manifest.test.ts` deliberately pins only the FLOOR, so nothing else
		// watches the other two.
		expect(new Set(legs)).toEqual(new Set(['ubuntu-latest:22', 'ubuntu-latest:24', 'ubuntu-latest:26', 'windows-latest:22']));
		expect(commands).toContain('npm run check');

		// And every declared leg must be allowed to REACH the command. `fail-fast` defaults to
		// TRUE in GitHub Actions, so a cancelled sibling is the state this workflow is in the
		// moment the key is deleted — the first leg to fail cancels the rest, and the Windows
		// verdict this matrix exists to collect is never produced. The tuple set says four legs
		// are declared; it cannot say four legs report.
		//
		// This one fails in the direction the key allowlist below is structurally blind to.
		// That allowlist refuses a key being ADDED to the job — it is the answer to
		// `continue-on-error` and `timeout-minutes` — and it reads the job's OWN keys, so it
		// does not recurse into `strategy`. A key REMOVED from a nested object is invisible to
		// it twice over. An allowlist cannot express "this must still be here".
		//
		// Asserted as `false` rather than `not.toBe(true)` on purpose: absent and `true` are
		// the same behaviour, and only one of them looks like a change.
		expect(verify?.strategy?.['fail-fast']).toBe(false);
	});

	/**
	 * And each leg actually SELECTS the Node it declares, which the tuple set cannot see.
	 *
	 * `matrix.node` is only a label: `ci.yml` selects the runtime through three conditional
	 * `actions/setup-node` steps, written as literal quoted versions on purpose so
	 * `tests/release/manifest.test.ts` can scan them. So deleting the Node 26 setup step — or
	 * changing its condition to `matrix.node == '24'` — leaves the tuple set and every
	 * assertion above green while the `ubuntu-latest:26` leg silently runs the runner's
	 * DEFAULT Node. The declared range goes unexecuted with the check that exists to prevent
	 * exactly that still passing.
	 *
	 * Third layer of the same property in this file: the command, then its conditions, now
	 * the runtime the command runs under.
	 */
	it('gives every declared Node version a setup step guarded on that version', () => {
		const steps = workflow.jobs['verify']?.steps ?? [];
		const setups = steps.filter((step) => step.uses?.startsWith('actions/setup-node') === true);

		// EXACTLY three, and exactly these versions. A `find` per version validates the step it
		// matches and says nothing about the ones it does not: appending a FOURTH setup step
		// selecting Node 20 leaves all three finds, the matrix tuples, the `runs-on` pin and
		// every allowlist green — while every leg runs the gate on Node 20, because the last
		// setup step before `npm run check` is the one that decides.
		//
		// Same shape as the key allowlists two rounds ago: validating the objects you looked
		// for is not the same as refusing the ones you did not.
		expect(setups.map((step) => step.with?.['node-version']).toSorted()).toEqual(['22', '24', '26']);

		// And each one must run BEFORE the gate. Inventory and contents say nothing about
		// position: moving all three setup steps below `npm run check` leaves the tuples, the
		// `runs-on` pin, every allowlist and this inventory green, while the gate runs on the
		// runner's preinstalled Node and the declared 22/24/26 coverage evaporates.
		//
		// A workflow is a SEQUENCE, and every assertion in this file until now treated it as a
		// set. That is the same "what is true of the thing" versus "what is true of the whole"
		// gap as the four before it, on the one axis a set cannot express.
		const checkIndex = steps.findIndex((step) => step.run === 'npm run check');
		expect(checkIndex).toBeGreaterThan(-1);
		for (const setup of setups) {
			expect(steps.indexOf(setup)).toBeLessThan(checkIndex);
		}

		for (const version of ['22', '24', '26']) {
			const setup = setups.find((step) => step.with?.['node-version'] === version);

			expect(setup?.if).toBe(`\${{ matrix.node == '${version}' }}`);

			// The SAME key allowlist as the job and the check step, applied here too. A draft
			// projected each setup step down to `if` and `node-version`, which discards
			// everything else — so `continue-on-error: true` on the Node 26 setup leaves every
			// assertion green while that setup FAILS and `npm run check` proceeds on the
			// runner's default Node. The declared leg stops being guaranteed to run on the Node
			// it names, which is the whole point of the three conditional steps.
			//
			// I closed this class on the job and the check step one round ago and did not ask
			// it of the third kind of step in the same file. An allowlist is only a category
			// check where it is actually applied.
			expect(Object.keys(setup ?? {}).toSorted()).toEqual(['if', 'uses', 'with']);
			expect(Object.keys(setup?.with ?? {}).toSorted()).toEqual(['cache', 'node-version']);
		}
	});

	/**
	 * One command for every leg. Two platforms invoking DIFFERENT commands is the drift this
	 * job exists to prevent, and a per-platform `run` would be invisible to the case above.
	 */
	it('gives every leg the same command, so the two platforms cannot drift', () => {
		const runs = (workflow.jobs['verify']?.steps ?? [])
			.map((step) => step.run)
			.filter((run): run is string => run !== undefined && run.includes('npm run'));

		expect(new Set(runs)).toEqual(new Set(['npm run check']));
	});

	/**
	 * And it runs UNCONDITIONALLY on every leg, which the three cases above cannot see.
	 *
	 * They are independent: the platform lookup asks the matrix, the command lookup asks the
	 * steps, and neither asks whether the step is gated. So `if: matrix.os !=
	 * 'windows-latest'` on the check step passes all three — Windows is still in the matrix
	 * and `npm run check` is still in the job — while the gate never runs there at all. A
	 * test claiming both platforms invoke the definition of done has to read the condition.
	 *
	 * Any `if` is a finding rather than only a matrix-narrowing one: a condition this test
	 * has to interpret is a condition it will interpret wrongly, and there is no legitimate
	 * reason for the definition of done to be conditional.
	 */
	it('runs it unconditionally, with no key that could discount its verdict', () => {
		const verify = workflow.jobs['verify'];
		const check = (verify?.steps ?? []).find((step) => step.run === 'npm run check');

		expect(check).toBeDefined();

		// An ALLOWLIST of keys, not a denylist of the ways somebody has thought of.
		//
		// This assertion was patched five times — the step's `if`, the job's `if`, trigger
		// path/type filters, trigger branch filters, then `continue-on-error` — and every one
		// was a different way for "the gate exists" to be true while "the gate decides
		// anything" was false. `continue-on-error: true` is the plainest: the command, the
		// matrix, the runtime setup and the absence of `if` all stay exactly as asserted while
		// a failed `npm run check` is reported as a successful job. `timeout-minutes: 1` would
		// have been the sixth.
		//
		// So this stops listing the places. This repository's own rule is that a CATEGORY
		// invariant is checked at the forbidden thing, and the forbidden thing here is *any*
		// key that can alter whether the gate's verdict counts. Measured against `ci.yml` as
		// it stands: the verify job uses `runs-on`, `strategy`, `steps`; the check step uses
		// `name` and `run`.
		//
		// A new key is a DELIBERATE change to how the definition of done is enforced, so it
		// should fail here and be added with a reason, rather than take effect silently.
		expect(Object.keys(verify ?? {}).toSorted()).toEqual(['runs-on', 'steps', 'strategy']);
		expect(Object.keys(check ?? {}).toSorted()).toEqual(['name', 'run']);

		// The WORKFLOW's own keys, which is the level this allowlist did not have and the one
		// that outranks both of the others.
		//
		// `defaults.run.shell` is settable at workflow, job and step level, and it decides how
		// every `run` is executed. A top-level `defaults: run: shell: bash {0} || true` turns a
		// failed `npm run check` into a successful step on every matrix leg — measured, with
		// that exact override present this file reported 5/5 green, because nothing here looked
		// above `jobs`. `working-directory` is the same key's quieter sibling: it would run the
		// gate somewhere that is not this repository.
		//
		// This is the shape the plan's own constraints name and this instrument has now been
		// holed by twice: a guard on one level of a nested structure is only as good as what
		// the ENCLOSING level can express. The step's `if` was closed and the job's `if`
		// reopened it; the job's and the step's keys were closed and the workflow's reopened
		// it. Asked at every level now, so there is no level left above.
		expect(Object.keys(workflow).toSorted()).toEqual(['concurrency', 'jobs', 'name', 'on']);

		// And `concurrency`'s CONTENTS, because the allowlist above permits the key and says
		// nothing about its value — the same gap `strategy` needed its own assertion for a few
		// lines down, reappearing in the key this file had just started permitting.
		//
		// `cancel-in-progress` is deliberately an EXPRESSION, not `true`: a superseded push to a
		// PR should cancel its own stale run, and a push to `main` must never be cancelled by a
		// later one, because main is where both platforms' verdicts are wanted on every commit.
		// Flatten it to `true` and a `main` run can be killed part-way through `npm run check`
		// while every other assertion in this file stays green — the gate reporting on no commit
		// at all. Broadening the group has the same effect from the other direction, by
		// colliding runs that have nothing to do with each other.
		//
		// This branch has its own evidence for how that feels: six pushes in half an hour
		// cancelled six PR runs in turn, so no leg completed until the pushing stopped. That is
		// the intended behaviour for a PR and it is exactly what must not reach `main`.
		//
		// The `$` is interpolated rather than written next to `{{`, because
		// `no-template-curly-in-string` sees `${` in an ordinary string and assumes a template
		// literal was meant — right for JavaScript, wrong for a GitHub expression. An inline
		// suppression is not available: `linterOptions.noInlineConfig` refuses the whole class
		// and `tests/build/suppressions.test.ts` asserts no file turns a rule off.
		const $ = '$';
		expect(workflow.concurrency).toEqual({
			group: `ci-${$}{{ github.workflow }}-${$}{{ github.ref }}`,
			'cancel-in-progress': `${$}{{ github.event_name == 'pull_request' }}`,
		});

		// `strategy`'s OWN keys too, because this allowlist reads the job's and does not
		// recurse — `strategy` was permitted to hold anything, which is how `fail-fast` came
		// to need its own assertion above. `max-parallel: 1` is the member that motivates it
		// beyond tidiness: it does not change any leg's verdict, but combined with a
		// `cancel-in-progress` concurrency group it serialises four legs behind the slow
		// Windows one, so a fixup pushed mid-run cancels legs that never started. The whole
		// matrix then reports on no commit at all, with every assertion in this file green.
		expect(Object.keys(verify?.strategy ?? {}).toSorted()).toEqual(['fail-fast', 'matrix']);

		// And `runs-on` must USE the matrix, not a literal. The tuple set proves only that the
		// matrix declares four legs; `ci.yml:30` is what turns `matrix.os` into an actual
		// runner, so replacing it with a literal `ubuntu-latest` leaves the tuples, every
		// setup-node assertion and both key allowlists green while the Windows leg executes on
		// Ubuntu — and Windows is in this matrix precisely because paths and line endings are
		// the only things that differ between the platforms.
		//
		// Exact twin of the `matrix.node` defect: a matrix entry is a LABEL, and something
		// else turns it into the thing. Having fixed that one for Node and not asked the same
		// question of the OS is why this needed a second round.
		expect(verify?.['runs-on']).toBe(`\${{ matrix.os }}`);

		// The JOB's condition too, which the step's cannot see. GitHub supports
		// `jobs.<job_id>.if`, so `verify.if: github.event_name == 'push'` leaves both declared
		// triggers, every matrix leg AND this unconditional step intact while skipping all PR
		// verification. A first draft of this case checked the step alone — the same defect it
		// was written to fix, one level up, which is why the two assertions live together
		// rather than in separate cases somebody could satisfy one at a time.
		expect(verify).not.toHaveProperty('if');
	});
});
