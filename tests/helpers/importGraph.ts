import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { REPO } from './repo';
import { toPosix } from './posix';

/**
 * One import-graph walk, shared by every instrument under `tests/` that asks "what does this
 * file reach by relative import". Counted by grepping `tests/` for `createSourceFile`,
 * `matchAll` and `import(` extractors in the same edit as this sentence: the two callers are
 * `tests/presentation/designer/regionsReachable.test.ts` (every designer component is reachable
 * from its view) and `tests/build/test-environments.test.ts` (a test reaching a repository
 * contract runs in node). `tests/harness/harness.test.ts` has a walk of its own over
 * STYLESHEET specifiers and glob patterns, which is a different question and stays there.
 *
 * **Edges come from the real parsers, never from a pattern over the text.** The script is read
 * with `ts.createSourceFile` and an SFC's `<script>`/`<script setup>` blocks are handed over by
 * `@vue/compiler-sfc`'s `parse` — a template comment or a docblock that happens to spell
 * `import x from '…'` is not an edge, and a real import after comment prose, after an
 * un-semicoloned `export type`, or written as `` import(`…`) `` is one. `importGraph.test.ts`
 * carries each of those as a fixture, watched red against the regex this replaced.
 *
 * **What is an edge.** An `import … from`, a bare `import '…'`, an `export … from`, a dynamic
 * `import()` and a `require()` whose argument is a string literal or a substitution-free
 * template. A TYPE-ONLY import is not one — `import type X from`, `import { type A } from`
 * with every binding typed, and `export type { X } from` — because Oxc (Vite 8 transforms
 * TypeScript with it, not with esbuild) erases those before the module is ever requested:
 * measured with a plugin logging every `.vue` load under vitest, and none of the three loaded
 * the SFC where the value spelling did. That erasure holds because `tsconfig.json` sets
 * `isolatedModules` and NOT `verbatimModuleSyntax`; under the latter an `import {}` residue
 * would survive as a side-effect import and the rule here would be wrong. The same measurement
 * showed a VALUE-syntax import whose binding is used only as a type is dropped too, and counts
 * here as an edge it is not at runtime — that over-count is closed by LINT rather than by this
 * walk, since oxlint's `typescript/consistent-type-imports` refuses the spelling.
 *
 * **What it cannot see.** A specifier held in a variable, built by concatenation or a template
 * with a substitution, a package name, a path alias and a Vite glob are not edges. Relative
 * specifiers are resolved on the filesystem the way TypeScript would try them, with the empty
 * extension FIRST because `.vue` and `.mjs` imports are written with theirs, then `.ts`,
 * `.vue`, `.js`, `.mjs` and `index.ts`.
 */
export interface SourceTree {
	read(path: string): string;
	isFile(path: string): boolean;
}

/** A literal specifier, or `null` for one whose value exists only at runtime. */
function literalSpecifier(argument: ts.Expression | undefined): string | null {
	return argument !== undefined && ts.isStringLiteralLike(argument) ? argument.text : null;
}

const allTypeOnly = (elements: readonly (ts.ImportSpecifier | ts.ExportSpecifier)[]): boolean =>
	elements.length > 0 && elements.every((element) => element.isTypeOnly);

/** An `import`/`export` clause that Oxc erases whole: the statement is type-only, or every named binding is. */
function erased(node: ts.ImportDeclaration | ts.ExportDeclaration): boolean {
	if (ts.isImportDeclaration(node)) {
		const clause = node.importClause;
		if (clause === undefined) return false;
		if (clause.phaseModifier === ts.SyntaxKind.TypeKeyword) return true;
		const bindings = clause.namedBindings;
		return clause.name === undefined && bindings !== undefined && ts.isNamedImports(bindings) && allTypeOnly(bindings.elements);
	}
	if (node.isTypeOnly) return true;
	const clause = node.exportClause;
	return clause !== undefined && ts.isNamedExports(clause) && allTypeOnly(clause.elements);
}

/** Every literal specifier one script names as a VALUE edge. */
function specifiersInScript(content: string): string[] {
	const found: string[] = [];
	const visit = (node: ts.Node): void => {
		if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
			const specifier = erased(node) ? null : literalSpecifier(node.moduleSpecifier);
			if (specifier !== null) found.push(specifier);
		} else if (ts.isCallExpression(node)) {
			const callee = node.expression;
			const isImport = callee.kind === ts.SyntaxKind.ImportKeyword;
			const isRequire = ts.isIdentifier(callee) && callee.text === 'require';
			const specifier = isImport || isRequire ? literalSpecifier(node.arguments[0]) : null;
			if (specifier !== null) found.push(specifier);
		}
		ts.forEachChild(node, visit);
	};
	visit(ts.createSourceFile('module.ts', content, ts.ScriptTarget.Latest, false, ts.ScriptKind.TS));
	return found;
}

function specifiersIn(file: string, source: string): string[] {
	if (!file.endsWith('.vue')) return specifiersInScript(source);
	const { descriptor } = parseSfc(source, { filename: file });
	return [descriptor.script, descriptor.scriptSetup].flatMap((block) => (block === null ? [] : specifiersInScript(block.content)));
}

function resolveSpecifier(from: string, specifier: string, tree: SourceTree): string | null {
	if (!specifier.startsWith('.')) return null;
	const base = toPosix(join(from, '..', specifier));
	for (const extension of ['', '.ts', '.vue', '.js', '.mjs', '/index.ts']) {
		const candidate = `${base}${extension}`;
		if (tree.isFile(candidate)) return candidate;
	}
	return null;
}

/**
 * Resolved edges per file, per tree. `test-environments.test.ts` walks from every collected spec
 * and those walks share most of one graph: uncached, hundreds of entries re-read and re-parse the
 * same few hundred files each. Keyed by the tree object so a fixture never sees another
 * fixture's edges.
 */
const EDGES = new WeakMap<SourceTree, Map<string, readonly string[]>>();

function edgesOf(file: string, tree: SourceTree): readonly string[] {
	let cache = EDGES.get(tree);
	if (cache === undefined) EDGES.set(tree, (cache = new Map()));
	let edges = cache.get(file);
	if (edges === undefined) {
		edges = specifiersIn(file, tree.read(file))
			.map((specifier) => resolveSpecifier(file, specifier, tree))
			.filter((target): target is string => target !== null);
		cache.set(file, edges);
	}
	return edges;
}

/**
 * Every file reachable from `entry` by relative import whose path starts with one of `within`,
 * mapped to the file that first imported it (`null` for the entry) so a caller can print the
 * chain. Iterative and `seen`-guarded before it reads, so a cycle terminates — a fixture case in
 * `regionsReachable.test.ts` rather than an assumption.
 */
export function importersFrom(entry: string, tree: SourceTree, within: readonly string[]): Map<string, string | null> {
	const importer = new Map<string, string | null>();
	const queue: [string, string | null][] = [[entry, null]];
	for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
		const [file, from] = next;
		if (importer.has(file)) continue;
		importer.set(file, from);
		for (const target of edgesOf(file, tree)) {
			if (within.some((prefix) => target.startsWith(prefix))) queue.push([target, file]);
		}
	}
	return importer;
}

export function reachableFrom(entry: string, tree: SourceTree, within: readonly string[]): Set<string> {
	return new Set(importersFrom(entry, tree, within).keys());
}

/** An in-memory tree, so an instrument is driven against fixtures before it is pointed at `src/`. */
export const fixtureTree = (files: Record<string, string>): SourceTree => ({
	read: (path) => files[path] ?? '',
	isFile: (path) => path in files,
});

/** The repository itself, addressed by repository-relative POSIX paths. */
export const repoTree: SourceTree = {
	read: (path) => readFileSync(join(REPO, path), 'utf8'),
	isFile: (path) => {
		try {
			return statSync(join(REPO, path)).isFile();
		} catch {
			return false;
		}
	},
};
