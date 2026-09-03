import { describe, expect, it } from 'vitest';
import { MAX_GLOB_BRANCHES, expandGlobBranches, resolvesOutsideRoots } from './globBranches';

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
});

describe('resolvesOutsideRoots', () => {
	const roots = ['src', 'tests/harness', 'tests/helpers'];

	it('resolves a literal path against the roots without truncating it', () => {
		expect(resolvesOutsideRoots('tests/helpers/vault.ts', './sibling', roots)).toBe(false);
		expect(resolvesOutsideRoots('tests/harness/page.ts', '../../scripts/helper.ts', roots)).toBe(
			true,
		);
	});

	it('truncates at the first wildcard only when asked to', () => {
		expect(resolvesOutsideRoots('src/prototypes/x.ts', '../scripts/*.ts', roots, true)).toBe(
			false,
		);
	});

	/**
	 * The Windows-separator case `toPosix`'s own docblock argues for, driven directly at the
	 * function that now owns that conversion rather than only through `escapesTheRoots`.
	 */
	it('folds a Windows-style file path to POSIX before resolving it', () => {
		expect(resolvesOutsideRoots('tests\\helpers\\vault.ts', './sibling', roots)).toBe(false);
	});
});
