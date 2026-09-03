import path from 'node:path';

/**
 * Bounds every branch a brace (`{a,b}`) or extglob (`@(a|b)`, `?(a|b)`, `*(a|b)`, `+(a|b)`,
 * `!(a|b)`) alternation in an `import.meta.glob` pattern can produce, for
 * `tests/harness/harness.test.ts`'s `escapesTheRoots` — the check that a specifier this repo's
 * browser harness scans cannot resolve outside the trees it walks.
 *
 * Extracted from `harness.test.ts` itself once that file's own 450-line cap made it impossible
 * to both fix a Codex-reported gap here (truncating a glob at its first metacharacter bounds
 * only ONE branch of an alternation) and add the coverage that gap's own review round asked
 * for — `harness.test.ts` sits outside `vitest.config.ts`'s coverage `include`
 * (`src/**\/*.{ts,vue}` only), so nothing there would ever flag an untested branch, which is
 * exactly the kind of silent gap this predicate's documented history warns about. This module
 * has no such exemption once it exists: it is under `tests/helpers/`, in the same `${TESTS}`
 * glob every other test file's `max-lines` budget answers to, and its two exported functions
 * are exercised directly by `globBranches.test.ts` beside the indirect coverage
 * `harness.test.ts`'s own `escapesTheRoots` cases still provide.
 */

/**
 * A small cap on how many branches a brace or extglob pattern may expand into before
 * `expandGlobBranches` gives up and reports the pattern as unbounded. Nothing in the harness
 * tree uses even one brace, so the number only has to be large enough that no legitimate
 * pattern trips it and small enough that a pathological one (nested groups multiplying against
 * each other) cannot make this check slow. **Hitting the cap reports an escape rather than
 * checking the first `MAX_GLOB_BRANCHES` branches and ignoring the rest — a cap that silently
 * truncates is the same defect `escapesTheRoots` was rewritten for one layer up.**
 */
export const MAX_GLOB_BRANCHES = 8;

/** One character in front of `(` that makes it an extglob group rather than an ordinary paren. */
const EXTGLOB_PREFIX = '@?*+!';

/**
 * Expands every `{a,b}` and `@(a|b)` group in `pattern` into `branches`, recursively — a nested
 * group inside one alternative is found on the recursive call over THAT branch, since
 * substituting one alternative leaves the rest of the pattern, any inner group included,
 * untouched.
 *
 * Answers `false` — "cannot be bounded, treat the whole pattern as escaping" — for an unclosed
 * group or for more than `MAX_GLOB_BRANCHES` branches, per this predicate's whole glob posture:
 * an unrecognised or unbounded construct moves a pattern toward "counts", never toward "proven
 * safe". `escapesTheRoots` is this function's only caller.
 *
 * One pass finds the leftmost group's matching close AND splits its interior on the group's own
 * separator (`,` for braces, `|` for extglobs) — both are the same "am I at depth zero" question
 * asked of every character between the opener and its close, so one loop does both jobs a brace
 * parser usually splits into two.
 */
export function expandGlobBranches(pattern: string, branches: string[]): boolean {
	for (let i = 0; i < pattern.length; i += 1) {
		const isBrace = pattern[i] === '{';
		const isExtglob = pattern[i] === '(' && i > 0 && EXTGLOB_PREFIX.includes(pattern[i - 1]);
		if (!isBrace && !isExtglob) continue;

		const start = isBrace ? i : i - 1;
		const closeChar = isBrace ? '}' : ')';
		const separator = isBrace ? ',' : '|';

		const alternatives: string[] = [];
		let depth = 0;
		let last = i + 1;
		let end = -1;
		for (let j = i + 1; j < pattern.length && end < 0; j += 1) {
			const c = pattern[j];
			const opensNested = c === '{' || (c === '(' && EXTGLOB_PREFIX.includes(pattern[j - 1] ?? ''));
			if (depth === 0 && c === closeChar) {
				end = j;
			} else if (depth === 0 && c === separator) {
				alternatives.push(pattern.slice(last, j));
				last = j + 1;
			} else if (opensNested) {
				depth += 1;
			} else if (c === '}' || c === ')') {
				depth -= 1;
			}
		}
		if (end < 0) return false;
		alternatives.push(pattern.slice(last, end));

		const before = pattern.slice(0, start);
		const after = pattern.slice(end + 1);
		for (const alternative of alternatives) {
			if (!expandGlobBranches(before + alternative + after, branches)) return false;
			if (branches.length > MAX_GLOB_BRANCHES) return false;
		}
		return true;
	}
	branches.push(pattern);
	return branches.length <= MAX_GLOB_BRANCHES;
}

/**
 * One separator spelling, so `resolvesOutsideRoots` compares paths rather than platforms.
 *
 * **Not the same function as `tests/helpers/posix.ts`'s `toPosix`, on purpose.** That one
 * converts the RUNTIME platform's own `path.sep`, which is a no-op on Linux for a
 * backslash-shaped string — exactly the string `harness.test.ts`'s own Windows-separator case
 * drives from a Linux runner to prove `escapesTheRoots` doesn't depend on which OS built it.
 * This one always folds a literal `\` to `/`, regardless of the runtime platform, because the
 * whole point here is comparing a path built with `path.join` on WINDOWS (backslashes) against
 * `ROOTS` written with forward slashes, from a test that runs on every CI leg including Linux.
 * `harness.test.ts`'s own history: the first version compared `${root}${path.sep}` against a
 * `path.join`-built path, which asked on Windows whether `tests\\helpers\\vault.ts` starts with
 * `tests/helpers\\` — it never does, so `tests/harness` and `tests/helpers` reported as escaping
 * on the Windows CI leg while `src` (which holds no separator to get wrong) survived by
 * accident.
 */
const toPosix = (value: string): string => value.split('\\').join('/');

/**
 * Resolves one literal path or glob branch against `file`'s directory and asks whether it lands
 * outside `roots`. `truncateAtWildcard` is only ever true for a branch already stripped of
 * every brace/extglob group by `expandGlobBranches` — what remains is an ordinary wildcard
 * (`*`, `?`, a character class) truncated at its own first occurrence. A character class is
 * safe to truncate at its `[` rather than expand per character: it matches exactly one
 * character and never a `/`, so truncating there can only shorten the prefix, never hide a
 * branch that leaves through a different directory.
 */
export const resolvesOutsideRoots = (
	file: string,
	branch: string,
	roots: readonly string[],
	truncateAtWildcard = false,
): boolean => {
	const literal = truncateAtWildcard ? (branch.split(/[*?[\]]/)[0] ?? branch) : branch;
	const resolved = path.posix.normalize(
		path.posix.join(path.posix.dirname(toPosix(file)), toPosix(literal)),
	);
	return !roots.some((root) => resolved === root || resolved.startsWith(`${root}/`));
};
