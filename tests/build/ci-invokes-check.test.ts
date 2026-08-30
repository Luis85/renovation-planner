import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../helpers/oxlint';

/**
 * `yaml` is not a declared dependency of this repository (confirmed:
 * `node -p "require('./package.json').devDependencies.yaml"` answers `undefined`), and
 * `CLAUDE.md`'s own rule is that a dependency nothing else imports fails `npm run analyze`
 * — this file would be its only importer. `tests/release/manifest.test.ts` answers the same
 * "what does this workflow file say" question with `readFileSync` plus a targeted regex; this
 * file needs far more of the document's SHAPE (nested jobs, steps, matrix entries, and which
 * keys are and are not present at each level), so the same mechanism — parsing the raw text
 * ourselves, adding nothing to `package.json` — is applied as a small block-YAML reader scoped
 * to the subset `.github/workflows/ci.yml` actually uses: comments and blank lines, block
 * mappings, block sequences of either scalars or mappings, one flow sequence (`[main]`), and
 * quoted or bare scalars. No anchors, no multi-document files, no block scalars (`|`/`>`) —
 * this workflow has none, and this reader does not need to pretend it might.
 */
type YamlValue = string | boolean | YamlScalarArray | YamlMapping;
type YamlScalarArray = readonly string[];
interface YamlMapping {
	readonly [key: string]: YamlValue;
}

const unquote = (raw: string): string => {
	const trimmed = raw.trim();
	const first = trimmed.charAt(0);
	const last = trimmed.charAt(trimmed.length - 1);
	if (trimmed.length >= 2 && (first === '"' || first === "'") && last === first) {
		return trimmed.slice(1, -1);
	}
	return trimmed;
};

/** The colon that ends a YAML key, never one inside a `${{ ... }}` expression or a quoted string. */
const findKeyColon = (line: string): number => {
	let quote: string | null = null;
	let braceDepth = 0;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (quote !== null) {
			if (char === quote) quote = null;
			continue;
		}
		if (char === '"' || char === "'") {
			quote = char;
			continue;
		}
		if (char === '{') braceDepth += 1;
		if (char === '}') braceDepth -= 1;
		if (char === ':' && braceDepth === 0) {
			const next = line[index + 1];
			if (next === undefined || next === ' ') return index;
		}
	}
	return -1;
};

const parseScalar = (raw: string): string | boolean | YamlScalarArray => {
	const trimmed = raw.trim();
	if (trimmed === 'true') return true;
	if (trimmed === 'false') return false;
	if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
		const inner = trimmed.slice(1, -1).trim();
		return inner === '' ? [] : inner.split(',').map((item) => unquote(item));
	}
	return unquote(trimmed);
};

interface Line {
	readonly indent: number;
	content: string;
}

const isSeqItem = (content: string): boolean => content === '-' || content.startsWith('- ');

/** Reads YAML text into the mapping/sequence/scalar tree the block-style subset above allows. */
const parseWorkflowYaml = (text: string): YamlMapping => {
	const lines: Line[] = text
		.split('\n')
		.filter((raw) => raw.trim() !== '' && !raw.trim().startsWith('#'))
		.map((raw) => ({ indent: raw.length - raw.trimStart().length, content: raw.trim() }));

	let cursor = 0;

	// Mutually recursive (a block may be a mapping or a sequence, a mapping's value may be a
	// block, a sequence item may open a mapping): grouped as methods on one object, referenced
	// through the object rather than by bare identifier, since `blockAt`, `mapping` and
	// `sequence` as three separate `const`s would each need the other two declared first,
	// which no ordering of exactly three mutually-referencing declarations can satisfy.
	const block = {
		at(indent: number): YamlValue {
			if (cursor >= lines.length || lines[cursor].indent !== indent) return {};
			return isSeqItem(lines[cursor].content) ? block.sequence(indent) : block.mapping(indent);
		},
		mapping(indent: number): YamlMapping {
			const result: Record<string, YamlValue> = {};
			while (cursor < lines.length && lines[cursor].indent === indent && !isSeqItem(lines[cursor].content)) {
				const { content } = lines[cursor];
				const colon = findKeyColon(content);
				const key = unquote(content.slice(0, colon));
				const rest = content.slice(colon + 1).trim();
				cursor += 1;
				if (rest === '') {
					const childIndent = cursor < lines.length ? lines[cursor].indent : -1;
					result[key] = childIndent > indent ? block.at(childIndent) : {};
				} else {
					result[key] = parseScalar(rest);
				}
			}
			return result;
		},
		sequence(indent: number): readonly YamlValue[] {
			const result: YamlValue[] = [];
			while (cursor < lines.length && lines[cursor].indent === indent && isSeqItem(lines[cursor].content)) {
				const { content } = lines[cursor];
				const after = content === '-' ? '' : content.slice(2);
				const itemIndent = indent + (content.length - after.length);
				if (after === '') {
					cursor += 1;
					const childIndent = cursor < lines.length ? lines[cursor].indent : -1;
					result.push(childIndent > indent ? block.at(childIndent) : {});
				} else if (findKeyColon(after) !== -1) {
					// An inline "- key: value" opens a mapping whose later keys align under it;
					// splice the dash away and hand the rest to `mapping` so the two shapes share
					// one path.
					lines[cursor] = { indent: itemIndent, content: after };
					result.push(block.mapping(itemIndent));
				} else {
					cursor += 1;
					result.push(parseScalar(after));
				}
			}
			return result;
		},
	};

	return block.mapping(0);
};

const asMapping = (value: YamlValue | undefined): YamlMapping => (value !== undefined && typeof value === 'object' && !Array.isArray(value) ? value : {});
const asArray = (value: YamlValue | undefined): readonly YamlValue[] => (Array.isArray(value) ? value : []);

interface Step {
	readonly run?: string;
	readonly if?: string;
	readonly uses?: string;
	readonly with?: YamlMapping;
	readonly name?: string;
	readonly 'continue-on-error'?: boolean;
}

interface Job {
	readonly 'runs-on'?: string;
	readonly strategy?: YamlMapping;
	readonly if?: string;
	readonly steps?: readonly Step[];
	readonly [key: string]: YamlValue | undefined;
}

interface Workflow {
	readonly on: YamlMapping;
	readonly jobs: Record<string, Job>;
}

// A cast, not a rebuild: rebuilding each step with `run: asString(stepMapping['run'])` etc.
// assigns every one of those keys on every step, `undefined` included where the real YAML
// never had it — and an `undefined`-valued key is still an OWN key, so a checkout step
// (only `uses`) would report `['if', 'name', 'run', 'uses', 'with']` to `Object.keys`, not
// `['uses']`. The key-allowlist assertions below depend on exactly the keys the YAML
// declared surviving the parse, so each step and job is spread as parsed and only cast,
// never reconstructed field by field.
const toWorkflow = (root: YamlMapping): Workflow => {
	const jobsRaw = asMapping(root['jobs']);
	const jobs: Record<string, Job> = {};
	for (const [name, job] of Object.entries(jobsRaw)) {
		const jobMapping = asMapping(job);
		const steps = asArray(jobMapping['steps']).map((step) => asMapping(step) as unknown as Step);
		jobs[name] = { ...jobMapping, steps } as Job;
	}
	return { on: asMapping(root['on']), jobs };
};

const workflow = toWorkflow(parseWorkflowYaml(readFileSync(join(REPO, '.github/workflows/ci.yml'), 'utf8')));

describe('CI invokes the definition of done', () => {
	/**
	 * BOTH triggers. "On every PR" leaves the push trigger free to be removed or narrowed
	 * with this test still green, and direct commits to `main` then bypass every
	 * architecture gate. SDD §8's wording is "every push/PR"; this matches it.
	 */
	it('runs on pull requests and on pushes to main, UNFILTERED', () => {
		expect(workflow.on['pull_request']).toBeDefined();
		expect(asMapping(workflow.on['push'])['branches']).toContain('main');

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

		for (const filter of PR_FILTERS) expect(workflow.on['pull_request']).not.toHaveProperty(filter);
		for (const filter of PUSH_FILTERS) expect(workflow.on['push']).not.toHaveProperty(filter);
	});

	/**
	 * `npm run check` VERBATIM, not a re-enumeration of its steps. A workflow that spelled
	 * out `build && lint && test` would drift silently the day `check` changes.
	 */
	it('runs npm run check on every declared leg, as one command', () => {
		const verify = workflow.jobs['verify'];
		const matrixInclude = asArray(asMapping(asMapping(verify?.strategy)['matrix'])['include']).map((leg) => asMapping(leg));
		const legTuples = matrixInclude.map((leg) => `${String(leg['os'])}:${String(leg['node'])}`);
		const commands = (verify?.steps ?? []).map((step) => step.run).filter((run): run is string => run !== undefined);

		// EXACT tuples, not "at least one of each OS". `some(os.startsWith('ubuntu'))` stays
		// true when the 24 and 26 legs are deleted, because 22 is still there — leaving two of
		// the three ranges `engines.node` declares unexecuted, which is the defect
		// `engines.node` itself exists to catch, moved to a different file.
		// `tests/release/manifest.test.ts` deliberately pins only the FLOOR, so nothing else
		// watches the other two.
		expect(new Set(legTuples)).toEqual(new Set(['ubuntu-latest:22', 'ubuntu-latest:24', 'ubuntu-latest:26', 'windows-latest:22']));
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
		expect(asMapping(verify?.strategy)['fail-fast']).toBe(false);
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
