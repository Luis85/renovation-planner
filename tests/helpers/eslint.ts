import { ESLint } from 'eslint';
import { REPO } from './oxlint';

/**
 * Driving the real ESLint, for the checks that are ABOUT the lint gate rather than about a
 * rule — the sibling of `oxlint.ts`, and here for the same stated reason: two test files
 * need it and a third would duplicate the work, which `npm run analyze` is right to notice.
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
