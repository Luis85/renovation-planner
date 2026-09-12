import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './repo';
import { toPosix } from './posix';

/**
 * One import-graph walk over specifier TEXT, shared by the two instruments that ask "what does
 * this file reach by relative import": `tests/presentation/designer/regionsReachable.test.ts`
 * (every designer component is reachable from its view) and
 * `tests/build/node-tests-import-no-sfc.test.ts` (no node-environment test reaches an SFC). It
 * lived in the first of those until the second needed it; a second walker would have been a
 * second answer to what an import edge is.
 *
 * **What it sees, and what it does not.** It reads `from '…'`, a bare `import '…'` and a dynamic
 * `import('…')`, and resolves the RELATIVE ones — a package, a path alias, a glob or a runtime
 * string is invisible to it. A TYPE-ONLY import is not an edge: `import type X from`,
 * `import { type A, type B } from` and `export type { X } from` are erased by esbuild before the
 * module is ever requested, which was measured rather than assumed — a node test carrying
 * `import type X from '…/DeleteReferenceDialog.vue'` runs with no `vite:load` of that SFC, and
 * the same import spelled as a value loads and transforms it. A value-syntax import whose
 * binding is used only as a type is elided the same way at runtime and would count here, and
 * that over-count is closed by LINT rather than by this walk: oxlint's
 * `typescript/consistent-type-imports` refuses the spelling, so a file on this tree cannot
 * carry one.
 *
 * Extension candidates are tried in the order TypeScript itself would, with the empty one
 * FIRST because `.vue` imports are written with their extension. `.js`/`.mjs` relays are not
 * resolved — nothing under `src/` or `tests/helpers/` is one, and a `scripts/*.mjs` a build test
 * imports cannot reach an SFC.
 */
export interface SourceTree {
	read(path: string): string;
	isFile(path: string): boolean;
}

/** A clause between `import`/`export` and `from` that names only types, so esbuild erases it. */
function typeOnly(clause: string): boolean {
	const trimmed = clause.trim();
	if (/^type\b/.test(trimmed)) return true;
	const braced = /^\{([^}]*)\}$/.exec(trimmed);
	if (braced === null) return false;
	const names = (braced[1] ?? '').split(',').map((name) => name.trim()).filter((name) => name !== '');
	return names.length > 0 && names.every((name) => /^type\b/.test(name));
}

const STATEMENT =
	/\b(?:import|export)\b([^'"`;]*?)\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]|\bimport\s*['"]([^'"]+)['"]/g;

/** Every specifier a module names as a VALUE edge — bindings, side effects or a dynamic import. */
function specifiersIn(source: string): string[] {
	return [...source.matchAll(STATEMENT)].flatMap((match) => {
		const [, clause, fromSpecifier, dynamicSpecifier, bareSpecifier] = match;
		if (fromSpecifier !== undefined) return typeOnly(clause ?? '') ? [] : [fromSpecifier];
		return [dynamicSpecifier ?? bareSpecifier ?? ''];
	});
}

function resolveSpecifier(from: string, specifier: string, tree: SourceTree): string | null {
	if (!specifier.startsWith('.')) return null;
	const base = toPosix(join(from, '..', specifier));
	for (const extension of ['', '.ts', '.vue', '/index.ts']) {
		const candidate = `${base}${extension}`;
		if (tree.isFile(candidate)) return candidate;
	}
	return null;
}

/**
 * Resolved edges per file, per tree. The SFC gate walks from every node test in the suite and
 * most of those walks share most of their graph: uncached, 464 entries re-read and re-resolved
 * the same few hundred files each — 28.7s measured; cached, under a second. Keyed by the tree
 * object so a fixture never sees another fixture's edges.
 */
const EDGES = new WeakMap<SourceTree, Map<string, readonly string[]>>();

function edgesOf(file: string, tree: SourceTree): readonly string[] {
	let cache = EDGES.get(tree);
	if (cache === undefined) EDGES.set(tree, (cache = new Map()));
	let edges = cache.get(file);
	if (edges === undefined) {
		edges = specifiersIn(tree.read(file))
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

/** The chain of files from the walk's entry down to `file`, entry first. */
export function chainTo(file: string, importer: ReadonlyMap<string, string | null>): string[] {
	const chain: string[] = [];
	for (let at: string | null | undefined = file; at !== null && at !== undefined; at = importer.get(at)) chain.unshift(at);
	return chain;
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
