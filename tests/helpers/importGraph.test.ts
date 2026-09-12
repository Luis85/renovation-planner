import { describe, expect, it } from 'vitest';
import { fixtureTree, reachableFrom } from './importGraph';

/**
 * The edge extractor, driven over the shapes a regex walker got wrong before this helper was
 * moved onto the TypeScript compiler API and `@vue/compiler-sfc`.
 *
 * Every "reaches" case below was RED against the regex version of `importGraph.ts` first —
 * watched failing, then the parser swap turned them green — except where a case says it was
 * already passing and is here so the swap cannot narrow what the walk sees. The "does not
 * reach" cases are the erasure rule: a type-only import never requests its module at runtime
 * (Oxc drops it; measured with a plugin logging every `.vue` load under vitest), so it is not
 * an edge.
 */
const WITHIN = ['src/'] as const;

const reaches = (files: Record<string, string>, target: string): boolean =>
	reachableFrom('src/entry.ts', fixtureTree(files), WITHIN).has(target);

describe('an import edge', () => {
	it('is seen after comment prose that mentions an import', () => {
		expect(reaches({ 'src/entry.ts': "// import type-only note\nimport { b } from './b';", 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen after a docblock whose prose says "export type"', () => {
		expect(reaches({ 'src/entry.ts': "/** an export type note */\nimport { b } from './b';", 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen after an un-semicoloned export type alias', () => {
		expect(reaches({ 'src/entry.ts': "export type X = { a: 1 }\nimport { b } from './b';", 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen after a comment carrying an apostrophe', () => {
		expect(reaches({ 'src/entry.ts': "// don't\nexport { b } from './b';", 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen for a backtick dynamic import', () => {
		expect(reaches({ 'src/entry.ts': 'const m = import(`./b`);', 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen for a quoted dynamic import and a bare side-effect import', () => {
		expect(reaches({ 'src/entry.ts': "import './a';\nvoid import('./b');", 'src/a.ts': '', 'src/b.ts': '' }, 'src/a.ts')).toBe(true);
		expect(reaches({ 'src/entry.ts': "import './a';\nvoid import('./b');", 'src/a.ts': '', 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen for a require call', () => {
		expect(reaches({ 'src/entry.ts': "const b = require('./b');", 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is seen for a value re-export', () => {
		expect(reaches({ 'src/entry.ts': "export { b } from './b';\nexport * from './c';", 'src/b.ts': '', 'src/c.ts': '' }, 'src/b.ts')).toBe(true);
		expect(reaches({ 'src/entry.ts': "export * from './c';", 'src/c.ts': '' }, 'src/c.ts')).toBe(true);
	});

	it('is not a type-only import, in any of its three spellings', () => {
		const files = {
			'src/entry.ts': "import type A from './a';\nimport { type B, type C } from './b';\nexport type { D } from './d';",
			'src/a.ts': '',
			'src/b.ts': '',
			'src/d.ts': '',
		};

		expect(reaches(files, 'src/a.ts')).toBe(false);
		expect(reaches(files, 'src/b.ts')).toBe(false);
		expect(reaches(files, 'src/d.ts')).toBe(false);
	});

	it('is still an edge when one named binding is a value beside a type', () => {
		expect(reaches({ 'src/entry.ts': "import { type A, b } from './b';", 'src/b.ts': '' }, 'src/b.ts')).toBe(true);
	});

	it('is not a specifier held in a variable or a template with a substitution', () => {
		const substituted = ['`./$', '{p}`'].join('');
		const files = { 'src/entry.ts': `const p = "./b";\nvoid import(p);\nvoid import(${substituted});`, 'src/b.ts': '' };

		expect(reaches(files, 'src/b.ts')).toBe(false);
	});

	it('resolves an extensionless specifier to .ts, .vue or index.ts, in that order', () => {
		expect(reaches({ 'src/entry.ts': "import './x';", 'src/x.ts': '', 'src/x.vue': '' }, 'src/x.ts')).toBe(true);
		expect(reaches({ 'src/entry.ts': "import './x';", 'src/x.vue': '' }, 'src/x.vue')).toBe(true);
		expect(reaches({ 'src/entry.ts': "import './x';", 'src/x/index.ts': '' }, 'src/x/index.ts')).toBe(true);
	});
});

describe('an SFC', () => {
	it('contributes the imports of its script and script setup blocks', () => {
		const files = {
			'src/entry.ts': "import R from './Root.vue';",
			'src/Root.vue': "<script lang=\"ts\">\nimport './a';\n</script>\n<script setup lang=\"ts\">\nimport B from './B.vue';\n</script>\n<template><B /></template>",
			'src/a.ts': '',
			'src/B.vue': '',
		};

		expect(reaches(files, 'src/a.ts')).toBe(true);
		expect(reaches(files, 'src/B.vue')).toBe(true);
	});

	it('does not import through a template comment that spells an import', () => {
		const files = {
			'src/entry.ts': "import R from './Root.vue';",
			'src/Root.vue': "<template>\n\t<!-- import Nope from './Nope.vue' -->\n\t<p />\n</template>",
			'src/Nope.vue': '',
		};

		expect(reaches(files, 'src/Nope.vue')).toBe(false);
	});
});
