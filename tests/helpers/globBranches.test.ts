import { describe, expect, it } from 'vitest';
import {
	MAX_GLOB_BRANCHES,
	expandGlobBranches,
	resolvesOutsideRoots,
	templateSkeleton,
} from './globBranches';

/**
 * `expandGlobBranches` and `resolvesOutsideRoots` were extracted from
 * `tests/harness/harness.test.ts` (Task R7's fix round 1) so two behaviours a review round
 * found uncovered — an unclosed group over-refusing, and a nested group's own inner branch
 * being bounded rather than left opaque — could get direct cases without that file's 450-line
 * cap forcing a choice between the fix and the coverage.
 *
 * `harness.test.ts`'s own `escapesTheRoots` cases still exercise both functions end to end;
 * these cases pin the exact BRANCHES `expandGlobBranches` produces, which a boolean
 * escape/no-escape assertion at `escapesTheRoots` cannot distinguish from a coincidentally
 * correct answer.
 */
describe('expandGlobBranches', () => {
	it('returns the pattern unchanged as its one branch when there is no group', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../../src/prototypes/**/*.vue', branches)).toBe(true);
		expect(branches).toEqual(['../../src/prototypes/**/*.vue']);
	});

	it('expands a brace group into one branch per alternative', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../{a,b,c}.ts', branches)).toBe(true);
		expect(branches).toEqual(['../a.ts', '../b.ts', '../c.ts']);
	});

	it('expands an extglob group the same way, on its own separator', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../@(a|b).ts', branches)).toBe(true);
		expect(branches).toEqual(['../a.ts', '../b.ts']);
	});

	/**
	 * The Important finding from Task R7's fix round 1: nothing in `harness.test.ts`'s own
	 * cases had a group nested inside another group's alternative, so the recursive call that
	 * finds and expands it — rather than leaving `'{b,c}'` as one opaque, unexpanded branch —
	 * had never been exercised.
	 */
	it('finds and expands a group nested inside another group\'s alternative', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../{a,{b,c}}.ts', branches)).toBe(true);
		expect(branches).toEqual(['../a.ts', '../b.ts', '../c.ts']);
	});

	it('expands a group nested inside an extglob alternative, and vice versa', () => {
		const braceInExtglob: string[] = [];
		expect(expandGlobBranches('../@(a|{b,c}).ts', braceInExtglob)).toBe(true);
		expect(braceInExtglob).toEqual(['../a.ts', '../b.ts', '../c.ts']);

		const extglobInBrace: string[] = [];
		expect(expandGlobBranches('../{a,@(b|c)}.ts', extglobInBrace)).toBe(true);
		expect(extglobInBrace).toEqual(['../a.ts', '../b.ts', '../c.ts']);
	});

	/**
	 * The other Important finding: `if (end < 0) return false;` — the over-refusal for a group
	 * with no matching close — had no case driving it at all.
	 */
	it('reports false for an unclosed group rather than guessing at one', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../{a,b', branches)).toBe(false);
	});

	it('reports false for an unclosed extglob group', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../@(a|b', branches)).toBe(false);
	});

	it('reports false rather than truncating once the branch count exceeds the cap', () => {
		const letters = Array.from({ length: MAX_GLOB_BRANCHES + 1 }, (_unused, i) =>
			String.fromCharCode(97 + i),
		);
		const branches: string[] = [];
		expect(expandGlobBranches(`../{${letters.join(',')}}.ts`, branches)).toBe(false);
	});

	/**
	 * The Minor finding from the same round: a literal, non-extglob `)` inside a brace group
	 * desyncs the depth counter (it decrements on a close with no matching increment), so the
	 * whole group reads as unclosed. Pinned as behaviour rather than left to the docblock alone,
	 * because the safe direction is still a claim worth a case: over-refusing here can never
	 * hide an escape, only cost a rename.
	 */
	it('over-refuses a brace group containing a literal, non-extglob close-paren', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../{a(x),b}.ts', branches)).toBe(false);
	});

	/**
	 * `?(a|b)` and `*(a|b)` match ZERO occurrences as well as one — this file's fourth
	 * consecutive-round finding of the same shape, and this time about what a single PATTERN can
	 * expand to rather than which specifier forms reach the check at all. Both need the empty
	 * branch; `@()` and `+()` must NOT gain one, which the next two `it`s hold rather than assume.
	 */
	it.each([
		['?', '../?(a).ts', ['../a.ts', '../.ts']],
		['*', '../*(a).ts', ['../a.ts', '../.ts']],
	])('expands %s(...) into its listed alternative AND the empty match', (_operator, pattern, expected) => {
		const branches: string[] = [];
		expect(expandGlobBranches(pattern, branches)).toBe(true);
		expect(branches).toEqual(expected);
	});

	/**
	 * The narrowing this fix must hold: `@()` matches EXACTLY one of its alternatives and `+()`
	 * matches ONE OR MORE, so neither ever produces an empty match. A fix that added the empty
	 * branch to every group uniformly — "any optional-looking group escapes" — would pass the
	 * `?()`/`*()` cases above and turn both of these red, which is the point of holding them here
	 * rather than trusting the narrower one above to cover it.
	 */
	it.each([
		['@', '../@(a).ts', ['../a.ts']],
		['+', '../+(a).ts', ['../a.ts']],
	])('expands %s(...) into only its listed alternative, never an empty match', (_operator, pattern, expected) => {
		const branches: string[] = [];
		expect(expandGlobBranches(pattern, branches)).toBe(true);
		expect(branches).toEqual(expected);
	});

	/**
	 * `!(a|b)` matches anything EXCEPT `a` or `b` — an unconstrained, unenumerable set that can
	 * contain `/` or `..`. Substituting the negated alternatives themselves (this function's
	 * behaviour before this case existed) checks exactly the two strings `!()` is defined to
	 * REFUSE, which is under-refusing at its most direct: the one case reachable at runtime was
	 * the one case never checked. Reported as an escape immediately, with no attempt to parse the
	 * group's content — there is nothing a literal substitution could safely produce.
	 */
	it('reports false for a negated extglob rather than substituting the negated alternatives', () => {
		const branches: string[] = [];
		expect(expandGlobBranches('../!(a|b).ts', branches)).toBe(false);
	});

	/**
	 * `*()` and `+()` REPEAT their alternative, and an alternative containing `..` walks further
	 * up with every additional occurrence — unboundedly, since nothing caps how many times a
	 * repeating operator may match. `'+(../)prototypes/*.ts'` checked as one repetition
	 * ('../prototypes/*.ts') resolves under `src`, while two repetitions ('../../prototypes/*.ts')
	 * do not — and there is no fixed number of repetitions whose branches could cover every case,
	 * so this reports the escape rather than enumerating up to a cap (a cap is a number someone
	 * has to justify, and the next round finds the pattern that needs one more). Detected on the
	 * alternative's own TEXT — `.includes('..')` — rather than on a resolved path, per the
	 * reported guidance.
	 */
	it.each([
		['*', '../*(../)prototypes.ts'],
		['+', '../+(../)prototypes.ts'],
	])('reports false for %s(...) whose alternative can traverse upward', (_operator, pattern) => {
		const branches: string[] = [];
		expect(expandGlobBranches(pattern, branches)).toBe(false);
	});

	/**
	 * The narrowing this fix must hold: a repeating operator whose alternative CANNOT traverse
	 * upward is unaffected and expands exactly as before — the refusal is about the alternative's
	 * own text, not about `*()`/`+()` as a category.
	 */
	it.each([
		['*', '../*(sub).ts', ['../sub.ts', '../.ts']],
		['+', '../+(sub).ts', ['../sub.ts']],
	])('still expands %s(...) normally when its alternative cannot traverse upward', (_operator, pattern, expected) => {
		const branches: string[] = [];
		expect(expandGlobBranches(pattern, branches)).toBe(true);
		expect(branches).toEqual(expected);
	});
});

describe('resolvesOutsideRoots', () => {
	const roots = ['src', 'tests/harness', 'tests/helpers'];

	it('resolves a literal path against the roots without truncating it', () => {
		expect(resolvesOutsideRoots('tests/helpers/vault.ts', './sibling', roots)).toBe(false);
		expect(resolvesOutsideRoots('tests/harness/page.ts', '../../scripts/helper.ts', roots)).toBe(
			true,
		);
	});

	it('elides a wildcard only when asked to', () => {
		expect(resolvesOutsideRoots('src/prototypes/x.ts', '../scripts/*.ts', roots, true)).toBe(
			false,
		);
	});

	/**
	 * Found while answering the coordinator's own question about this function — measured, not
	 * assumed. The FIRST version of `hasWildcards` truncated at the wildcard instead of eliding
	 * it (`branch.split(/[*?[\]]/)[0]`), which discards everything after the wildcard — and a
	 * `../` living in that discarded tail is exactly the template bug's shape one function over: a
	 * wildcard segment followed by `../../../scripts/x.ts` truncated to `'src/prototypes'`
	 * (inside), while any concrete match of the wildcard resolves to `scripts/x.ts` (outside). A
	 * real directory can never be named `..` literally, so the wildcard itself could not have
	 * produced that escape — only the truncation could, by throwing the tail away.
	 */
	it('does not lose a `../` that follows a wildcard', () => {
		expect(
			resolvesOutsideRoots('src/prototypes/x.ts', '*/../../../scripts/x.ts', roots, true),
		).toBe(true);
	});

	/**
	 * The companion mutation this fix itself needed watching red: reading root-absolute from the
	 * ELIDED text rather than the original would misread a wildcard's own leading `*` as if it
	 * had been a `/` all along.
	 */
	it('does not mistake an elided leading wildcard for root-absolute', () => {
		expect(resolvesOutsideRoots('src/prototypes/x.ts', '*/../x.ts', roots, true)).toBe(false);
	});

	/**
	 * The two fixes compose: a root-absolute TEMPLATE skeleton is still resolved from the
	 * repository root rather than from `file`. Nothing else exercises this combination —
	 * `templateSkeleton` and root-absolute resolution were each proven separately — so this is
	 * measured rather than inferred from the two working alone.
	 */
	it('resolves a root-absolute template skeleton from the repository root', () => {
		expect(
			resolvesOutsideRoots('src/prototypes/x.ts', templateSkeleton('/scripts/', ['.ts']), roots),
		).toBe(true);
	});

	/**
	 * The Windows-separator case `toPosix`'s own docblock argues for, driven directly at the
	 * function that now owns that conversion rather than only through `escapesTheRoots`.
	 */
	it('folds a Windows-style file path to POSIX before resolving it', () => {
		expect(resolvesOutsideRoots('tests\\helpers\\vault.ts', './sibling', roots)).toBe(false);
	});

	/**
	 * Root-absolute — a leading `/` — resolves from the repository root regardless of `file`,
	 * which is what Vite itself does for `import '/scripts/helper.ts'`. Reported: joining it onto
	 * `dirname(file)` as if it were relative silently answered a different question about where
	 * the specifier ends up, the same shape as this module's own brace and template fixes.
	 */
	it('resolves a root-absolute specifier from the repository root, not from the file', () => {
		expect(resolvesOutsideRoots('src/prototypes/x.ts', '/scripts/helper.ts', roots)).toBe(true);
		expect(resolvesOutsideRoots('tests/harness/page.ts', '/src/prototypes/x.ts', roots)).toBe(
			false,
		);
	});

	it('truncates a root-absolute glob at its own first wildcard', () => {
		expect(resolvesOutsideRoots('src/prototypes/x.ts', '/scripts/*.ts', roots, true)).toBe(true);
	});
});

/**
 * `harness.test.ts`'s `collect` only ever calls this with a REAL `ts.TemplateExpression`'s parts,
 * so these cases drive the pure concatenation directly rather than through a parse — the edges a
 * real template can produce (an empty span between two substitutions, a trailing substitution
 * with nothing after it) without needing the TS AST to reach them.
 */
describe('templateSkeleton', () => {
	it('concatenates the head with a single trailing literal span', () => {
		expect(templateSkeleton('./', ['/../../../scripts/helper.ts'])).toBe(
			'.//../../../scripts/helper.ts',
		);
	});

	it('keeps every span in order, including an empty one between two substitutions', () => {
		expect(templateSkeleton('./', ['', '/../../../scripts/x.ts'])).toBe(
			'.//../../../scripts/x.ts',
		);
	});

	it('equals the head alone when a trailing substitution has nothing after it', () => {
		expect(templateSkeleton('./scripts/', [''])).toBe('./scripts/');
	});

	it('equals the head alone when there are no substitutions at all', () => {
		expect(templateSkeleton('./a.ts', [])).toBe('./a.ts');
	});
});
