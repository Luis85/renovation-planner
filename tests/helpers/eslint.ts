import { ESLint } from 'eslint';
import { REPO } from './repo';

/**
 * Driving the real ESLint, for the checks that are ABOUT the lint gate rather than about a
 * rule — the sibling of `oxlint.ts`, and here for the same stated reason: more than one test
 * file needs it and each extra copy would duplicate the work, which `npm run analyze` is right
 * to notice.
 *
 * **This said "two test files" for many slices and the answer is TWELVE**, measured in the edit
 * that wrote this — `grep -rln "helpers/eslint" tests/build/ | wc -l`, 2026-09-05. A count is a
 * fact about the tree at the moment of the grep and nothing re-runs it, so the sentence states
 * the RULE (one instance, shared) and the reader who wants the number runs the grep. The figure
 * matters for one reason beyond accuracy: the boot below is paid once per MODULE REGISTRY, and
 * vitest gives each test file its own — so twelve importers is twelve boots unless the project
 * they sit in confines them to one worker, which is exactly what `vitest.config.ts`'s
 * `maxWorkers: 1` on the `build` project is for. That number and this one move together.
 *
 * `calculateConfigForFile` is the API behind `--print-config`, and asking it in process
 * rather than spawning the bin is not a micro-optimisation. Booting ESLint costs several
 * seconds; `tests/build/suppressions.test.ts` spent 4.4 of vitest's default 5-second budget
 * inside one spawn, so the second caller was the one that would have made a green suite
 * start timing out on whichever machine was slowest that day. One instance, one boot,
 * shared.
 *
 * `cwd` is pinned to `REPO` for the reason `eslint.config.mjs` gives about its own globs: a
 * `files` pattern is matched against the linter's base path, so resolving from anywhere
 * else would answer about a different set of blocks. Another test file in the same worker
 * legitimately `chdir`s while it runs, which is why this cannot be left to default.
 */
const eslint = new ESLint({ cwd: REPO });

/** The resolved flat config for one path — the same object `--print-config` prints. */
export const resolveConfig = async (file: string): Promise<ResolvedConfig> =>
	(await eslint.calculateConfigForFile(file)) as ResolvedConfig;

/**
 * Whether ESLint would skip this path, its own `ignores` resolution.
 *
 * `tests/build/lint-scope.test.ts` measures oxlint's scope as a whole SET, because
 * oxlint's entire justification is that it lints everything and an `ignorePatterns` edit
 * would make that quietly false. ESLint's claim is narrower — it deliberately ignores
 * `scripts/` and the root configs, so "which files" is not a promise it makes — but the
 * direction that matters is still checkable: a global `ignores` entry that grew to cover
 * `src/` or `tests/` would make the gate silent rather than red, which is the same
 * failure mode in a smaller blast radius.
 */
export const isIgnored = (file: string): Promise<boolean> => eslint.isPathIgnored(file);

export interface ResolvedConfig {
	readonly linterOptions: { readonly noInlineConfig?: boolean };
	readonly rules: Record<string, readonly unknown[]>;
}

/** A rule's severity in a resolved config: 0 off, 1 warn, 2 error; `undefined` if absent. */
export const severityOf = (config: ResolvedConfig, rule: string): unknown => config.rules[rule]?.[0];

/**
 * The rule ids ESLint reports for `code` treated as `filePath`.
 *
 * `lintText` resolves the REAL flat config for that path — the same globs, the same
 * per-directory blocks, the same parser — without a file on disk, which is what makes a
 * fixture possible at all: a conforming-except-one-rule `.vue` file committed under `src/`
 * would fail `npm run lint` for the whole repository, and a fixture parked outside `src/`
 * would be linted by different blocks than the ones under test.
 *
 * Rule IDS rather than the exit code, deliberately: a bare exit code cannot tell six rules
 * apart, so a fixture that went red for its own unrelated reason would read as a pass.
 *
 * Three outcomes, kept distinct because they are three different defects and a caller
 * reading only "the rule id is missing" would confuse them:
 *
 * - a rule id — that rule reported.
 * - `PARSE_ERROR` — a message with no rule id, which is what a block whose parser cannot
 *   read the file produces (an SFC lacking `vue-eslint-parser`, say).
 * - `NOT_LINTED` — ESLint returned NO result for the path at all. Under flat config a file
 *   matching no block's `files` is not linted rather than linted with no rules, so an empty
 *   result means the extension is outside the config entirely. Named rather than left to
 *   throw a `TypeError` on `undefined`, which is what the first version of this did and
 *   which reads as a bug in the helper rather than a finding about the config.
 */
export const lintText = async (code: string, filePath: string): Promise<string[]> => {
	const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });

	if (result === undefined) return ['NOT_LINTED'];

	return result.messages.map((message) => message.ruleId ?? 'PARSE_ERROR');
};

/**
 * Resolve the flat config once, so no TEST BODY pays for it.
 *
 * Measured, and the reason this exists rather than a raised global timeout: the first
 * `lintText` or `resolveConfig` call in a worker costs ~3s idle and was seen at 17.8s under
 * full-suite parallel load, while every call after it is 7–30ms. Vitest's default test
 * timeout is 5s, so whichever test happened to be first in its file carried a cost that
 * intermittently blew that budget — a green suite that goes red on whichever machine is
 * busiest, which is the failure mode `suppressions.test.ts` was already one caller away
 * from (its own heaviest case measures 3.0s) and which a third caller made real.
 *
 * A `beforeAll` is where a one-time toolchain boot belongs: it can be given a budget that
 * says "this is slow on purpose" without also telling every test in the repository that
 * five seconds of silence is acceptable. `logging-carve-out.test.ts` already did exactly
 * this, with this number — the constant is here so the other two callers share it rather
 * than each picking their own, and so raising it is one edit. Each file needs its own hook:
 * vitest gives each test file its own module registry, so the instance above is per file,
 * and a file that already resolves a config in a `beforeAll` needs no second warm-up.
 */
export const ESLINT_BOOT_MS = 60_000;

export const warmUpEslint = async (): Promise<void> => {
	await eslint.calculateConfigForFile('src/main.ts');
};

/** One reported diagnostic: which rule fired, and on which line of the linted text. */
export interface Diagnostic {
	readonly ruleId: string;
	readonly line: number;
}

/**
 * `lintText` with the LINE kept — the shape a batched probe needs.
 *
 * A probe that plants several forbidden imports in one module and asserts
 * `toContain('no-restricted-imports')` passes when ANY of them reports, so a spelling that
 * silently becomes allowed is invisible while its neighbours still fire. Matching one
 * diagnostic per planted line is what tells those two worlds apart. Asserting the COUNT
 * alone was the cheaper option and is not enough: it survives one import going silent while
 * another reports twice.
 *
 * A separate export rather than a widening of `lintText`, because six existing test files
 * consume that array-of-ids shape and none of them needs the detail.
 *
 * `line` is `0` for a diagnostic ESLint reports without one, so the field is always a
 * number and a caller never has to narrow it.
 */
export const lintDetailed = async (code: string, filePath: string): Promise<Diagnostic[]> => {
	const [result] = await eslint.lintText(code, { filePath, warnIgnored: false });

	if (result === undefined) return [{ ruleId: 'NOT_LINTED', line: 0 }];

	return result.messages.map((message) => ({
		ruleId: message.ruleId ?? 'PARSE_ERROR',
		line: message.line ?? 0,
	}));
};
