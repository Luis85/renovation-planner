// @vitest-environment node
//
// Explicit where every sibling leaves it implicit, because vitest scans a file's TEXT for the
// FIRST directive and the fixtures below spell a jsdom one inside a string — without this line
// this file itself ran under jsdom and died in `repo.ts` at module scope. Measured, not guessed.
/**
 * "No test that runs in the NODE environment reaches a `.vue` file through its imports."
 *
 * The defect this exists for passed every gate and reddened CI anyway. A node-environment test
 * imported a pure function from a module whose import graph reached the editor's SFCs; vitest
 * compiled each of those in SSR shape (an `if` for a `v-if`, a ternary for `<select v-model>`)
 * without ever rendering them, and the v8 coverage merge appended those SSR-only arms — 84
 * uncovered branches across 17 forms nobody had touched — to the client-shaped arms the jsdom
 * suites cover. Branches fell below the 98% floor with every test green. The instance was fixed
 * by moving the function; this is the check at the FORBIDDEN THING, so the next instance is
 * named by file and import chain rather than found by reading `coverage-final.json`.
 *
 * **What it sees.** Every `*.test.ts` under `tests/` whose environment DIRECTIVE is absent or
 * `node` — the regex is vitest's own — is walked through its relative imports by
 * `tests/helpers/importGraph.ts`, static and dynamic, type-only imports skipped because esbuild
 * erases them before the SFC is requested (measured; the helper's header carries it). The walk
 * is bounded to `src/` and `tests/`, which is every relative edge a test file can have.
 *
 * **What it cannot see, written down rather than implied.** A project in `vitest.config.ts`
 * that set a DOM environment would make its files jsdom with no directive, and this gate reads
 * directives only — so the case below pins that the config sets `environment` exactly once and
 * to `'node'`, and a second `environment:` key turns it red with instructions rather than
 * silently widening what "node test" means. A path alias, a glob or a computed specifier is not
 * an edge here; `tests/` writes none today.
 *
 * It is driven against fixtures FIRST, and asserts it examined something at all — an instrument
 * that reaches nothing looks exactly like a clean tree.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from '../helpers/repo';
import { toPosix } from '../helpers/posix';
import { chainTo, fixtureTree, importersFrom, repoTree, type SourceTree } from '../helpers/importGraph';

/** The regex vitest itself matches a per-file directive with. */
const ENVIRONMENT_DIRECTIVE = /@(?:vitest|jest)-environment\s+([\w-]+)\b/u;

const WITHIN = ['src/', 'tests/'] as const;

/** A test file that will run in node: no directive, or one that says so. */
function runsInNode(source: string): boolean {
	return (ENVIRONMENT_DIRECTIVE.exec(source)?.[1] ?? 'node') === 'node';
}

/** The import chain from a node test to the first SFC it reaches, or `null` when it reaches none. */
function sfcChain(test: string, tree: SourceTree): string[] | null {
	if (!runsInNode(tree.read(test))) return null;
	const importer = importersFrom(test, tree, WITHIN);
	const sfc = [...importer.keys()].find((file) => file.endsWith('.vue'));
	return sfc === undefined ? null : chainTo(sfc, importer);
}

describe('the node-test SFC walk', () => {
	it('reports a node test importing an SFC directly, with the chain', () => {
		const tree = fixtureTree({
			'tests/a.test.ts': "import X from '../src/X.vue';",
			'src/X.vue': '',
		});

		expect(sfcChain('tests/a.test.ts', tree)).toEqual(['tests/a.test.ts', 'src/X.vue']);
	});

	it('reports one reached through a helper and a source module, naming every hop', () => {
		const tree = fixtureTree({
			'tests/a.test.ts': "import { rig } from './helpers/rig';",
			'tests/helpers/rig.ts': "import { pure } from '../../src/m';",
			'src/m.ts': "import X from './X.vue';",
			'src/X.vue': '',
		});

		expect(sfcChain('tests/a.test.ts', tree)).toEqual(['tests/a.test.ts', 'tests/helpers/rig.ts', 'src/m.ts', 'src/X.vue']);
	});

	it('passes a node test whose graph holds no SFC', () => {
		const tree = fixtureTree({
			'tests/a.test.ts': "import { pure } from '../src/m';",
			'src/m.ts': "import { x } from './n';",
			'src/n.ts': '',
		});

		expect(sfcChain('tests/a.test.ts', tree)).toBeNull();
	});

	/** A jsdom test MOUNTS components; reaching an SFC is its job, and it is not examined. */
	it('excludes a test whose directive selects jsdom, and examines one that selects node', () => {
		const tree = fixtureTree({
			'tests/dom.test.ts': "// @vitest-environment jsdom\nimport X from '../src/X.vue';",
			'tests/node.test.ts': "// @vitest-environment node\nimport X from '../src/X.vue';",
			'src/X.vue': '',
		});

		expect(sfcChain('tests/dom.test.ts', tree)).toBeNull();
		expect(sfcChain('tests/node.test.ts', tree)).toEqual(['tests/node.test.ts', 'src/X.vue']);
	});

	/**
	 * Erased by esbuild before the module is requested, so no SSR compile and no phantom arm —
	 * measured with `DEBUG=vite:load` on a probe test rather than reasoned from the spec.
	 */
	it('does not count a type-only import as reaching the SFC', () => {
		const tree = fixtureTree({
			'tests/a.test.ts': "import type X from '../src/X.vue';\nimport { type D } from '../src/m';",
			'src/m.ts': "import Y from './Y.vue';",
			'src/X.vue': '',
			'src/Y.vue': '',
		});

		expect(sfcChain('tests/a.test.ts', tree)).toBeNull();
	});
});

const testFiles = (): string[] =>
	readdirSync(join(REPO, 'tests'), { recursive: true, encoding: 'utf8' })
		.filter((name) => name.endsWith('.test.ts'))
		.map((name) => `tests/${toPosix(name)}`);

describe('every node-environment test', () => {
	/**
	 * The precondition the directive-only reading rests on. Counted from the config's TEXT,
	 * which is where a project would declare one; `test-environments.test.ts` asks vitest for
	 * the resolved environment at ~60s a run, and this gate deliberately does not pay that.
	 */
	it('rests on a config whose only environment key is the root node one', () => {
		const config = readFileSync(join(REPO, 'vitest.config.ts'), 'utf8');

		expect(config.match(/^\s*environment:\s*'([^']+)'/gmu)).toEqual(["\t\tenvironment: 'node'"]);
	});

	it('has node tests to examine, and a walk that reaches past its entry', () => {
		const nodeTests = testFiles().filter((file) => runsInNode(repoTree.read(file)));

		expect(nodeTests.length).toBeGreaterThan(0);
		expect(nodeTests.some((file) => importersFrom(file, repoTree, WITHIN).size > 1)).toBe(true);
	});

	/** The claim, reported as the chains rather than a count, so the failure names the hop to cut. */
	it('reaches no .vue file through its imports', () => {
		const offenders = testFiles()
			.map((file) => sfcChain(file, repoTree))
			.filter((chain): chain is string[] => chain !== null)
			.map((chain) => chain.join(' → '));

		expect(offenders).toEqual([]);
	});
});
