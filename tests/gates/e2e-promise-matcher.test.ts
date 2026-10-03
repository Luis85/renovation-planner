import { describe, expect, it } from 'vitest';
import { readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import ts from 'typescript';
import { REPO, repoRelative } from '../helpers/repo';

/**
 * Refuses a PROMISE handed to a matcher in `tests/e2e`, read off the type checker.
 *
 * The bug class: WebdriverIO's element array (`browser.$$(...)`) has an ASYNC `map`, so
 * `expect(x).toEqual(panes.map(...))` compares against a pending Promise. It shipped twice in one
 * session (batch 3's `chooseCorner`; batch 5's step 7), each time found only by a ~10 minute real
 * Obsidian run — `vue-tsc` cannot see it because the matchers take `any`, and eslint and oxlint
 * pass it (both measured). The check is therefore at the forbidden thing: any matcher call
 * whose checker type for an ARGUMENT has a `then` member (a union with a Promise member counts).
 * `expect.poll(fn).toEqual(value)` stays green: the poll's argument is a function and the
 * matcher's a value.
 *
 * **Fixture-first.** `fixtures/promiseMatcher/` holds a red, a union, a green and a
 * poll file, and the cases below drive the instrument against them BEFORE pointing it at the
 * tree, because an instrument that reaches nothing looks exactly like a clean tree. The tree case
 * then also asserts a floor on files scanned and matcher calls seen.
 *
 * **Blind spots, named rather than implied:**
 * - the matcher SUBJECT (`expect(promise).toEqual(x)` with no `await expect(...)` / `.resolves`) is
 *   NOT checked. It was built and measured: three false positives on the real tree, all
 *   `expect(choose.length)` reads after `await el.$(sel)`, because WebdriverIO types
 *   `ChainablePromiseArray.length` as `Promise<number>` while the awaited runtime array holds a
 *   number. A type-based subject check needs a carve-out for that typing lie, which is a second
 *   instrument;
 * - a matcher reached through a helper (`const check = expect; check(p).toEqual(...)`, or a
 *   wrapper function taking the value) — only a call literally named `expect(...)` is a subject;
 * - a Promise the checker types as `any` / `unknown` (an untyped `browser` call, a cast): no
 *   `then` member is visible, so it passes. This is the largest hole and the types cannot close it;
 * - files outside `tests/e2e/*.ts` (top level only; the suite has no subdirectory with code), and
 *   matchers outside the six named below (`toHaveLength`, `toBeGreaterThan` take no Promise worth
 *   comparing; a Promise there is a bug this does not look for);
 * - a thenable that is not a Promise is flagged on purpose: it would hang or mismatch all the same.
 *
 * It builds two TypeScript programs (the tree's ~3.5 s, the fixtures' shared one ~1.1 s; measured
 * 2026-10-03 on a quiet four-core box) and boots no ESLint, so it sits in the parallel `build`
 * project and carries a case budget rather than a serial worker. The budget is an instrument, not
 * a ceiling nobody reaches: ~8x the slowest case as measured, so it still turns red on a tenfold
 * slowdown while leaving room for a contended CI leg.
 */
const ARGUMENT_MATCHERS = new Set(['toEqual', 'toStrictEqual', 'toContain', 'toContainEqual', 'toBe', 'toMatchObject']);
const BUDGET_MS = 30_000;

interface Scan {
	readonly files: number;
	readonly matcherCalls: number;
	readonly findings: readonly string[];
}

let options: ts.CompilerOptions | undefined;
function compilerOptions(): ts.CompilerOptions {
	if (options) return options;
	const path = ts.findConfigFile(REPO, ts.sys.fileExists, 'tsconfig.json');
	if (!path) throw new Error('promise-matcher gate: no tsconfig.json found');
	const { config } = ts.readConfigFile(path, ts.sys.readFile);
	const parsed = ts.parseJsonConfigFileContent(config, ts.sys, dirname(path));
	options = { ...parsed.options, noEmit: true, incremental: false };
	return options;
}

/**
 * Each finding is `file:line argument matcher`, with `file` repository-relative. `program` may
 * hold more files than `roots` — the four fixtures share one, since building a program is most of
 * a case's cost (lib loading) and the fixtures are modules, so none sees another's declarations.
 */
function scan(roots: readonly string[], program = ts.createProgram([...roots], compilerOptions())): Scan {
	const checker = program.getTypeChecker();
	const isPromiseLike = (type: ts.Type): boolean =>
		type.isUnion() ? type.types.some(isPromiseLike) : checker.getPropertyOfType(type, 'then') !== undefined;
	const findings: string[] = [];
	let matcherCalls = 0;
	for (const root of roots) {
		const source = program.getSourceFile(root);
		if (!source) throw new Error(`promise-matcher gate: ${root} is not in the program`);
		const report = (node: ts.Node, matcher: string): void => {
			const { line } = source.getLineAndCharacterOfPosition(node.getStart());
			findings.push(`${repoRelative(root)}:${String(line + 1)} argument ${matcher}`);
		};
		const visit = (node: ts.Node): void => {
			if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
				const matcher = node.expression.name.text;
				if (ARGUMENT_MATCHERS.has(matcher)) {
					matcherCalls++;
					for (const arg of node.arguments) if (isPromiseLike(checker.getTypeAtLocation(arg))) report(arg, matcher);
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}
	return { files: roots.length, matcherCalls, findings };
}

const FIXTURES = join(REPO, 'tests/gates/fixtures/promiseMatcher');
const FIXTURE_NAMES = ['redArgument', 'unionArgument', 'green', 'poll'] as const;
const fixturePath = (name: string): string => join(FIXTURES, `${name}.fixture.ts`);
let fixtureProgram: ts.Program | undefined;
const fixture = (name: (typeof FIXTURE_NAMES)[number]): Scan => {
	fixtureProgram ??= ts.createProgram(FIXTURE_NAMES.map((each) => fixturePath(each)), compilerOptions());
	return scan([fixturePath(name)], fixtureProgram);
};
const located = (name: string): string => `tests/gates/fixtures/promiseMatcher/${name}.fixture.ts`;
/** The finding kinds and matchers only, so a case does not pin the fixture's line numbers. */
const shapes = (found: Scan): string[] => found.findings.map((finding) => finding.replace(/^\S+:\d+ /, ''));

describe('the instrument, driven against fixtures first', () => {
	it('refuses an element-array map and an un-awaited call handed to a matcher', () => {
		const found = fixture('redArgument');
		expect(shapes(found)).toEqual(['argument toEqual', 'argument toContain']);
		expect(found.findings.every((finding) => finding.startsWith(located('redArgument')))).toBe(true);
	}, BUDGET_MS);

	it('refuses a union with a Promise member', () => {
		expect(shapes(fixture('unionArgument'))).toEqual(['argument toStrictEqual']);
	}, BUDGET_MS);

	it('passes awaited values and spread arrays', () => {
		const found = fixture('green');
		expect(found.findings).toEqual([]);
		expect(found.matcherCalls).toBe(2);
	}, BUDGET_MS);

	it('passes expect.poll(fn).toEqual(value), whose argument is a function', () => {
		const found = fixture('poll');
		expect(found.findings).toEqual([]);
		expect(found.matcherCalls).toBe(2);
	}, BUDGET_MS);
});

describe('tests/e2e', () => {
	it('hands no Promise to a matcher', () => {
		const dir = join(REPO, 'tests/e2e');
		const roots = readdirSync(dir)
			.filter((file) => file.endsWith('.ts'))
			.map((file) => join(dir, basename(file)));
		const found = scan(roots);
		// Found-something-at-all: a glob that matched nothing, or a program that resolved no
		// `expect`, would otherwise read as a clean tree. Both floors sit well under the tree's
		// measured size (79 files; ~1500 matcher calls on 2026-10-03).
		expect(found.files).toBeGreaterThan(50);
		expect(found.matcherCalls).toBeGreaterThan(1000);
		expect(found.findings).toEqual([]);
	}, BUDGET_MS);
});
