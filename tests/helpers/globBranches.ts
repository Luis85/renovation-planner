import path from 'node:path';

/**
 * Bounds specifier forms `tests/harness/harness.test.ts`'s `escapesTheRoots` cannot resolve at
 * face value — a brace (`{a,b}`) or extglob (`@(a|b)`, `?(a|b)`, `*(a|b)`, `+(a|b)`, `!(a|b)`)
 * alternation in an `import.meta.glob` pattern, and a Vite variable dynamic import's template —
 * for the check that a specifier this repo's browser harness scans cannot resolve outside the
 * trees it walks.
 *
 * Extracted from `harness.test.ts` itself once that file's own 450-line cap made it impossible
 * to both fix a Codex-reported gap here (truncating a glob at its first metacharacter bounds
 * only ONE branch of an alternation) and add the coverage that gap's own review round asked
 * for — `harness.test.ts` sits outside `vitest.config.ts`'s coverage `include`
 * (`src/**\/*.{ts,vue}` only), so nothing there would ever flag an untested branch, which is
 * exactly the kind of silent gap this predicate's documented history warns about. This module
 * has no such exemption once it exists: it is under `tests/helpers/`, in the same `${TESTS}`
 * glob every other test file's `max-lines` budget answers to, and its exported functions are
 * exercised directly by `globBranches.test.ts` beside the indirect coverage `harness.test.ts`'s
 * own `escapesTheRoots` cases still provide. The template fix and the root-absolute fix
 * (`resolvesOutsideRoots`'s own docblock) arrived here the same way, one review round each,
 * once this module already existed to receive them.
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
 * Every construct this expander recognises, and what each one's alternatives EXPAND TO — written
 * here because the answer is one level below `isBoundableSpecifier`'s own enumeration in
 * `harness.test.ts` (that one is about specifier FORMS; this one is about what a single glob
 * PATTERN's construct can match), and this predicate has now been found unbounded on one more
 * form in each of four consecutive review rounds. An enumeration that goes stale is the same
 * defect as no enumeration; this one is written against the code beside it rather than from
 * memory, and it says where it stops being complete rather than implying it never does:
 *
 * - **`{a,b}` (brace)** — each listed alternative, exactly once. Complete: a brace has no
 *   optional or repeating form in any glob dialect this file targets.
 * - **`@(a|b)`** — each listed alternative, exactly once. Complete, by extglob's own definition
 *   ("exactly one of the patterns").
 * - **`?(a|b)`** — each listed alternative once, PLUS the empty string (zero occurrences).
 *   Complete for BOUNDING purposes: "zero or one" has exactly two shapes, and both are produced.
 * - **`*(a|b)`** — each listed alternative once, PLUS the empty string. NOT a complete
 *   enumeration of what `*()` can match (two-or-more repeated occurrences are real matches this
 *   does not produce) — declared complete only for the narrower question this function answers,
 *   because the reasoning is asymmetric rather than exhaustive: repeating an alternative can only
 *   ADD literal path segments, which can only push a resolved path DEEPER, never further outside
 *   the roots than the zero-occurrence branch already reaches. The empty branch is the genuine
 *   worst case for escaping upward; every repetition beyond one alternative is safe to leave
 *   unexpanded precisely because it cannot be worse than a case already checked.
 * - **`+(a|b)`** — each listed alternative once, no empty branch. Same asymmetry as `*()` from
 *   the other side: the minimum is ONE occurrence, already the alternative itself, and every
 *   additional repetition only adds segments. Adding an empty branch here would be wrong in the
 *   OTHER direction — it would check a match `+()` cannot actually produce.
 * - **`!(a|b)`** — NOT enumerable at all, and not attempted: negation's true match set is
 *   everything EXCEPT the listed alternatives, which is unconstrained (it can contain `/`, `..`,
 *   anything). Substituting the negated alternatives themselves — this function's behaviour
 *   before this paragraph was added — checks exactly the strings `!()` is defined to REFUSE,
 *   which is under-refusing at its most direct: the one case actually reachable at runtime is the
 *   one case never checked. `expandGlobBranches` reports an escape immediately on finding a `!(`
 *   group, without attempting to parse its content at all.
 * - **Anything not opened by `{` or one of `EXTGLOB_PREFIX`'s five characters** — not a group;
 *   left as literal text for `resolvesOutsideRoots`'s own wildcard elision (`*`, `?`, `[]`) to
 *   handle, or resolved verbatim if it is ordinary path text.
 * - **An unclosed group, or a branch count exceeding `MAX_GLOB_BRANCHES`** — reports an escape;
 *   see this function's own return-value contract below.
 */
type ExtglobOperator = '@' | '?' | '*' | '+' | '!';

/**
 * Expands every `{a,b}` group and every bounded extglob group in `pattern` into `branches`,
 * recursively — a nested group inside one alternative is found on the recursive call over THAT
 * branch, since substituting one alternative leaves the rest of the pattern, any inner group
 * included, untouched. The docblock above states what each construct expands to; this function
 * is that table implemented.
 *
 * Answers `false` — "cannot be bounded, treat the whole pattern as escaping" — for an unclosed
 * group, for a `!(…)` negation, or for more than `MAX_GLOB_BRANCHES` branches, per this
 * predicate's whole glob posture: an unrecognised or unbounded construct moves a pattern toward
 * "counts", never toward "proven safe". `escapesTheRoots` is this function's only caller.
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
		const operator: ExtglobOperator | undefined = isExtglob
			? (pattern[i - 1] as ExtglobOperator)
			: undefined;
		if (operator === '!') return false;

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
		if (operator === '?' || operator === '*') alternatives.push('');

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
 * The literal skeleton of a template expression used as Vite's variable dynamic import form —
 * `` `./${dir}/../../../scripts/helper.ts` `` — `head` (the text before the first `${…}`) plus
 * every trailing literal SPAN, concatenated in source order, with each `${…}` EXPRESSION dropped
 * entirely rather than guessed at.
 *
 * **Reported: reading `head` alone answers "where does this specifier BEGIN" and was read as an
 * answer to "where does it END UP", which static parent traversal in a LATER span can still
 * follow regardless of the substitution's own runtime value** — `` `./${dir}/../../../scripts/
 * helper.ts` `` recorded only `'./'`, resolving inside `src/prototypes`, while the real target is
 * `scripts/helper.ts`. Dropping each substitution is the conservative direction on purpose:
 * eliding it can only make a trailing `../` in a later span walk further back toward the caller's
 * directory than a real, non-empty value would (a real value spends each `../` on an extra path
 * segment first), so the elided form is the WORST CASE for whether the specifier escapes upward —
 * never the best one. It still cannot see a substitution whose own runtime value itself contains
 * `/` or `..`, the same "held in an identifier … whose value exists only at runtime" bound this
 * whole check already accepts elsewhere.
 */
export const templateSkeleton = (head: string, spanLiterals: readonly string[]): string =>
	head + spanLiterals.join('');

/**
 * Resolves one literal path or glob branch and asks whether it lands outside `roots`.
 *
 * **`hasWildcards` ELIDES `*`, `?`, `[`, `]` rather than truncating at the first one — a second,
 * measured instance of the same mistake this module's `templateSkeleton` fix corrected.** The
 * first version truncated: `branch.split(/[*?[\]]/)[0]`, keeping only the text BEFORE the first
 * remaining wildcard once `expandGlobBranches` had already resolved every brace/extglob group.
 * That discards everything after it, and a `../` living in that discarded tail is not
 * hypothetical — measured directly against this function: a wildcard segment followed by
 * `../../../scripts/x.ts` from `src/prototypes/x.ts` truncates to `'src/prototypes'`, reporting
 * no escape, while the real target for ANY concrete match of that wildcard (a real directory can
 * never literally be named `..`, so the wildcard itself can only contribute an ordinary segment)
 * is `scripts/x.ts` — outside every root. Eliding the wildcard characters instead keeps every
 * literal character around them,
 * `../` included, so the SAME arithmetic that already resolves an ordinary path or a template's
 * skeleton handles a glob branch's trailing traversal too, without a second code path for it.
 * Elision is conservative in the identical direction `templateSkeleton`'s docblock argues for a
 * substitution: an eliminated wildcard can only make a trailing `../` walk further back than a
 * real match would (a real match spends each `../` on an extra segment first), so it is the
 * WORST CASE for whether the branch escapes upward, never the best one. A character class's
 * brackets are elided individually rather than as a matched pair — `[ab]` becomes the literal
 * `ab`, which changes no `/`-boundary the roots comparison cares about, since a class matches
 * exactly one character and never contributes one of its own.
 *
 * **A leading `/` means ROOT-ABSOLUTE to Vite** — `import.meta.glob('/scripts/*.ts')` and
 * `import '/scripts/helper.ts'` both resolve from the repository root, never from `file`'s own
 * directory, so this branch is resolved against `''` rather than joined onto `dirname(file)`.
 * Read from the ORIGINAL `branch`, before elision: eliding a LEADING wildcard segment (turning
 * `*` followed by `/../x.ts` into plain `/../x.ts`) must not be mistaken for a specifier that
 * was root-absolute all along — measured as the mutation that reading it from the elided text
 * would have been, and reverted before it shipped. A specifier beginning `//` (protocol-relative
 * — nothing in this tree writes one) is
 * read as root-absolute too, which can only OVER-refuse: the segment before its first real path
 * component is never one of `roots`, so it reports an escape for a specifier Vite would not
 * treat as a local import at all, rather than silently passing it.
 */
export const resolvesOutsideRoots = (
	file: string,
	branch: string,
	roots: readonly string[],
	hasWildcards = false,
): boolean => {
	const rootAbsolute = branch.startsWith('/');
	const literal = toPosix(hasWildcards ? branch.replace(/[*?[\]]/g, '') : branch);
	const resolved = rootAbsolute
		? path.posix.normalize(literal.slice(1))
		: path.posix.normalize(path.posix.join(path.posix.dirname(toPosix(file)), literal));
	return !roots.some((root) => resolved === root || resolved.startsWith(`${root}/`));
};
