/**
 * "Every component in the asset designer is reachable from the view that mounts it."
 *
 * A reviewer found this gap in the increment plan and it is worth stating as the general shape
 * rather than as a fact about three files: **Task B3 is the only task that writes
 * `AssetDesignerRoot.vue`, and Tasks B4, B5 and B8 each CREATE a component without any step that
 * mounts one.** Followed literally, each of those tasks ships a component, a green suite of its
 * own and no surface — which is this repository's recorded slice-7 defect exactly: `CalibrateTool`
 * was written, tested and reachable by nothing for two slices, invisible to all four gates
 * because nothing was wrong with the code. `npm run analyze` cannot see it either: fallow reports
 * an unimported FILE, and a component imported by its own test is imported.
 *
 * So this is a category check at the FORBIDDEN THING — a designer component the view cannot
 * reach — rather than a list of the mounts somebody remembered. It holds for components nobody
 * has written yet, which a registry or a named slot cannot: both of those relocate the
 * forgetting rather than closing it, since the only thing that would fill them is
 * `AssetDesignerView`, another Task B3 file.
 *
 * **What the instrument sees, and what it does not.** It reads import SPECIFIERS as text — `from
 * '…'`, a bare `import '…'` and a dynamic `import('…')` — and resolves the relative ones, so:
 *
 * - a component reached through a path alias, a glob or a runtime string is invisible to it;
 * - an import that exists but is never RENDERED counts as reached. That half is closed by LINT
 *   rather than here, and it was measured rather than assumed: adding an unrendered component
 *   import to `AssetDesignerRoot.vue` and running `npx eslint` on it reports
 *   `'ViewRoot' is defined but never used  @typescript-eslint/no-unused-vars` — a `<script
 *   setup>` binding is used by the template or it is used by nothing. So "imported" and
 *   "rendered" are one claim here, held by two gates rather than by one;
 * - it walks only within `src/presentation/`, because the layer bans make anything else
 *   impossible: `core/`, `domain/`, `application/` and `infrastructure/` may not import
 *   presentation at all, and `plugin/` composes the view rather than rendering a tree.
 *
 * The walk is a pure function over an injected tree so that it can be driven against FIXTURES
 * first. An instrument that reaches nothing looks exactly like a clean tree, so it is proven to
 * REPORT an unreachable component before it is pointed at `src/`.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../../helpers/repo';
import { toPosix } from '../../helpers/posix';

/** A filesystem the walk can ask about, so a fixture can stand in for `src/`. */
interface SourceTree {
	read(path: string): string;
	isFile(path: string): boolean;
}

/**
 * Every specifier an ES module names, whether it imports bindings, imports for side effects, or
 * awaits a dynamic import. One expression rather than three, because a second pattern is a
 * second thing to keep in step with the first.
 */
function specifiersIn(source: string): string[] {
	return [...source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].map((match) => match[1] ?? '');
}

/**
 * Resolve one specifier against the file that named it, POSIX-style and relative to the
 * repository root.
 *
 * The extension candidates are tried in the order TypeScript itself would, and the empty one
 * comes FIRST because `.vue` imports are written with their extension. A specifier that is not
 * relative resolves to nothing: a package, or an alias this walk deliberately does not follow.
 */
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
 * Every file reachable from `entry` by relative import, bounded to `within`.
 *
 * Iterative rather than recursive, and `seen`-guarded before it reads, so a cycle terminates —
 * which is a fixture case below rather than an assumption, because a designer tree really can
 * hold one (a shell region that imports a shared type from the root it draws in).
 */
function reachableFrom(entry: string, tree: SourceTree, within: string): Set<string> {
	const seen = new Set<string>();
	const queue = [entry];
	for (let next = queue.pop(); next !== undefined; next = queue.pop()) {
		if (seen.has(next)) continue;
		seen.add(next);
		for (const specifier of specifiersIn(tree.read(next))) {
			const target = resolveSpecifier(next, specifier, tree);
			if (target !== null && target.startsWith(within)) queue.push(target);
		}
	}
	return seen;
}

const fixture = (files: Record<string, string>): SourceTree => ({
	read: (path) => files[path] ?? '',
	isFile: (path) => path in files,
});

describe('the reachability walk', () => {
	it('reaches a component the entry imports', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/')]).toContain(
			'src/presentation/designer/Root.vue',
		);
	});

	/**
	 * The case the whole file exists for, and it is what makes the instrument fail CLOSED: a
	 * component that is merely PRESENT is not reached, so a build where Task B4 creates
	 * `DesignerCanvas.vue` and never mounts it is red rather than silent.
	 */
	it('does not reach a component nothing imports, which is the failure it exists to report', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': '',
			'src/presentation/designer/Canvas.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/')]).not.toContain(
			'src/presentation/designer/Canvas.vue',
		);
	});

	it('reaches a component nested two imports deep, through a subdirectory', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': "import Inspector from './inspector/Inspector.vue';",
			'src/presentation/designer/inspector/Inspector.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/')]).toContain(
			'src/presentation/designer/inspector/Inspector.vue',
		);
	});

	/** A lazily-mounted region is still a mounted region, so `import('…')` counts. */
	it('reaches a component behind a dynamic import', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "const c = defineAsyncComponent(() => import('./Canvas.vue'));",
			'src/presentation/designer/Canvas.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/')]).toContain(
			'src/presentation/designer/Canvas.vue',
		);
	});

	it('terminates on a cycle', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': "import { x } from './View';",
		});

		expect(reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/').size).toBe(2);
	});

	/** A specifier naming a package, or a file that is not there, is skipped rather than fatal. */
	it('ignores a specifier that resolves to nothing', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import { createApp } from 'vue';\nimport x from './gone.vue';",
		});

		expect(reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/').size).toBe(1);
	});

	/** The bound is real: a component outside `src/presentation/` is not walked into. */
	it('stops at the layer boundary it was given', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import { x } from '../../application/queries/Q';",
			'src/application/queries/Q.ts': "import Sneaky from '../../presentation/designer/Sneaky.vue';",
			'src/presentation/designer/Sneaky.vue': '',
		});

		expect(reachableFrom('src/presentation/designer/View.ts', tree, 'src/presentation/').size).toBe(1);
	});
});

const DESIGNER = 'src/presentation/designer';
const ENTRY = `${DESIGNER}/AssetDesignerView.ts`;

const nodeTree: SourceTree = {
	read: (path) => readFileSync(join(REPO, path), 'utf8'),
	isFile: (path) => {
		try {
			return statSync(join(REPO, path)).isFile();
		} catch {
			return false;
		}
	},
};

function componentsUnder(dir: string): string[] {
	return readdirSync(join(REPO, dir)).flatMap((name) => {
		const path = `${dir}/${name}`;
		if (statSync(join(REPO, path)).isDirectory()) return componentsUnder(path);
		return path.endsWith('.vue') ? [path] : [];
	});
}

describe('every asset designer component', () => {
	/**
	 * The instrument must reach something, or a clean report means nothing. Both halves: there is
	 * a designer component to find at all, and the walk found more than the file it started at.
	 */
	it('has components to check, and a walk that reaches past its entry', () => {
		expect(componentsUnder(DESIGNER).length).toBeGreaterThan(0);
		expect(reachableFrom(ENTRY, nodeTree, 'src/presentation/').size).toBeGreaterThan(1);
	});

	/**
	 * The claim. Reported as the LIST of unreachable files rather than as a count, so the failure
	 * names the component somebody forgot to mount instead of saying a number went up.
	 */
	it('is reachable from the view that mounts the designer', () => {
		const reached = reachableFrom(ENTRY, nodeTree, 'src/presentation/');

		expect(componentsUnder(DESIGNER).filter((file) => !reached.has(file))).toEqual([]);
	});
});
