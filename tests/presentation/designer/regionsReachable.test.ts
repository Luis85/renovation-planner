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
 * **What the instrument sees, and what it does not.** The walk is `tests/helpers/importGraph.ts`
 * — shared with `tests/build/test-environments.test.ts` — and it reads import SPECIFIERS out of
 * the real parsers (TypeScript's for a script, `@vue/compiler-sfc`'s for an SFC's script
 * blocks): `from '…'`, a bare `import '…'`, an `export … from`, a dynamic `import()` and a
 * `require()`, skipping a type-only import (its header says why and what was measured), and
 * resolves the relative ones, so:
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
import { beforeAll, describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../../helpers/repo';
import { fixtureTree as fixture, reachableFrom, repoTree as nodeTree } from '../../helpers/importGraph';

/** A fixture SFC whose script is `script`: the walk parses an SFC's blocks, not its raw text. */
const sfc = (script: string): string => `<script setup lang="ts">\n${script}\n</script>\n<template><p /></template>`;

describe('the reachability walk', () => {
	it('reaches a component the entry imports', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/'])]).toContain(
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

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/'])]).not.toContain(
			'src/presentation/designer/Canvas.vue',
		);
	});

	it('reaches a component nested two imports deep, through a subdirectory', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': sfc("import Inspector from './inspector/Inspector.vue';"),
			'src/presentation/designer/inspector/Inspector.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/'])]).toContain(
			'src/presentation/designer/inspector/Inspector.vue',
		);
	});

	/** A lazily-mounted region is still a mounted region, so `import('…')` counts. */
	it('reaches a component behind a dynamic import', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "const c = defineAsyncComponent(() => import('./Canvas.vue'));",
			'src/presentation/designer/Canvas.vue': '',
		});

		expect([...reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/'])]).toContain(
			'src/presentation/designer/Canvas.vue',
		);
	});

	it('terminates on a cycle', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import Root from './Root.vue';",
			'src/presentation/designer/Root.vue': sfc("import { x } from './View';"),
		});

		expect(reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/']).size).toBe(2);
	});

	/**
	 * A component only TYPE-imported is not reached: Oxc erases the import before the module is
	 * requested (`importGraph.ts`'s header carries the measurement), so a view naming a component
	 * as a prop type has not mounted it. Pointed at `src/`, this rule moves the real reach set
	 * from 142 files to 132 — measured by running the walk with `erased` answering `false`, on
	 * the tree this case was written against; the figure is a snapshot, the rule is not.
	 */
	it('does not reach a component the entry only type-imports', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import type Root from './Root.vue';\nimport { type Props } from './Canvas.vue';",
			'src/presentation/designer/Root.vue': '',
			'src/presentation/designer/Canvas.vue': '',
		});

		expect(reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/']).size).toBe(1);
	});

	/** A specifier naming a package is skipped; a relative one naming a file that is not there is
	 * FATAL, since a walk that dropped it would report the component behind a renamed file as
	 * "not reachable" with nothing named — the shared walk's header carries the argument. Watched
	 * red first: the old case here asserted the silent drop, and the loud walk failed it. */
	it('ignores a package specifier and refuses a relative one that resolves to nothing', () => {
		const packageOnly = fixture({ 'src/presentation/designer/View.ts': "import { createApp } from 'vue';" });
		const gone = fixture({ 'src/presentation/designer/View.ts': "import x from './gone.vue';" });

		expect(reachableFrom('src/presentation/designer/View.ts', packageOnly, ['src/presentation/']).size).toBe(1);
		expect(() => reachableFrom('src/presentation/designer/View.ts', gone, ['src/presentation/'])).toThrow("imports './gone.vue'");
	});

	/** The bound is real: a component outside `src/presentation/` is not walked into. */
	it('stops at the layer boundary it was given', () => {
		const tree = fixture({
			'src/presentation/designer/View.ts': "import { x } from '../../application/queries/Q';",
			'src/application/queries/Q.ts': "import Sneaky from '../../presentation/designer/Sneaky.vue';",
			'src/presentation/designer/Sneaky.vue': '',
		});

		expect(reachableFrom('src/presentation/designer/View.ts', tree, ['src/presentation/']).size).toBe(1);
	});
});

const DESIGNER = 'src/presentation/designer';
const ENTRY = `${DESIGNER}/AssetDesignerView.ts`;

function componentsUnder(dir: string): string[] {
	return readdirSync(join(REPO, dir)).flatMap((name) => {
		const path = `${dir}/${name}`;
		if (statSync(join(REPO, path)).isDirectory()) return componentsUnder(path);
		return path.endsWith('.vue') ? [path] : [];
	});
}

describe('every asset designer component', () => {
	/**
	 * ONE walk, in a hook with its own budget, shared by both cases — not one per case under
	 * vitest's default 5 s. The walk parses every file it reaches under `src/presentation/` and
	 * took 512 ms cold on this machine on 2026-09-13; the Windows CI leg runs several times slower
	 * under contention (a sibling parse of 1.49 s overran 5 s there), so a case's budget covers
	 * its assertions and the read that feeds them is paid here.
	 */
	const WALK_MS = 60_000;
	let reached!: ReadonlySet<string>;
	beforeAll(() => {
		reached = reachableFrom(ENTRY, nodeTree, ['src/presentation/']);
	}, WALK_MS);

	/**
	 * The instrument must reach something, or a clean report means nothing. Both halves: there is
	 * a designer component to find at all, and the walk found more than the file it started at.
	 */
	it('has components to check, and a walk that reaches past its entry', () => {
		expect(componentsUnder(DESIGNER).length).toBeGreaterThan(0);
		expect(reached.size).toBeGreaterThan(1);
	});

	/**
	 * The claim. Reported as the LIST of unreachable files rather than as a count, so the failure
	 * names the component somebody forgot to mount instead of saying a number went up.
	 */
	it('is reachable from the view that mounts the designer', () => {
		expect(componentsUnder(DESIGNER).filter((file) => !reached.has(file))).toEqual([]);
	});
});
