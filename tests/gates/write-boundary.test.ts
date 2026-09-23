import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

/**
 * `WRITE_BOUNDARY` — the four `no-restricted-syntax` selectors that keep vault mutation inside
 * `src/infrastructure/obsidian/`, and which nothing drove until this file.
 *
 * The layer bans keep `obsidian` out of core, domain and application; these catch the layer
 * that IS allowed to name it — a write from a view, a Bases adapter or the composition root,
 * bypassing the repository that owns the file format. It is the strong form this project asks
 * for everywhere: a category invariant checked at the forbidden call rather than by driving the
 * paths someone thought of.
 *
 * The instrument implementing it had never been tested, and the rule here is that you test the
 * instrument first. A selector that stops matching — reworded by an AST change under a
 * TypeScript upgrade, or edited into a shape that matches nothing — does not fail a lint run.
 * It makes one quieter, and a codebase that never violates the rule looks exactly the same.
 *
 * So each selector gets a snippet that MUST report and a near-miss that must NOT, plus the two
 * blind spots the config already declares in prose, asserted as blind spots. Writing down that
 * an alias escapes is not an endorsement: it is what stops the next reader believing the rule
 * covers a spelling it cannot see.
 *
 * Virtual paths, never files on disk: `lintText` resolves the real flat config for a path
 * without anything being written, so a deliberately-offending fixture cannot be committed under
 * `src/` where it would fail `npm run lint` for the whole repository.
 */

const RULE = 'no-restricted-syntax';

/**
 * Outside `src/infrastructure/obsidian/`, which is the sanctioned writer and is `ignores`d.
 *
 * REAL paths, both of them, and that is a constraint rather than a preference: the `.ts` blocks
 * are type-aware (`projectService: true`), so a path with no file behind it cannot be parsed at
 * all and `lintText` answers `PARSE_ERROR` — a result that contains no rule id and would read
 * as "the boundary said nothing" in every negative case below. Nothing is written and no real
 * content is disturbed; `lintText` only borrows the path to resolve the config.
 */
const BANNED = 'src/main.ts';
const SANCTIONED = 'src/infrastructure/obsidian/repositories/noteIo.ts';

const sfc = (body: string) => `<script setup lang="ts">\n${body}\n</script>\n\n<template>\n\t<p>x</p>\n</template>\n`;

/**
 * One `beforeAll` for two one-time costs, as `prototypes-one-way-door.test.ts` explains at
 * length: ESLint's boot, and the first type-aware `lintText` against a `.ts` path, which builds
 * typescript-eslint's project-service program and would otherwise land inside whichever case
 * ran first — intermittently blowing its 5s budget under full-suite load.
 */
beforeAll(async () => {
	await warmUpEslint();
	await lintText('export const probe = 1;\n', BANNED);
}, ESLINT_BOOT_MS);

describe('the vault write boundary', () => {
	it.each([
		['frontmatter', 'export const write = (m: any, f: any) => m.processFrontMatter(f, () => undefined);\n'],
		['a vault write through a property', "export const write = (app: any) => app.vault.modify(null as any, 'x');\n"],
		['a vault write through a local named vault', "export const write = (vault: any) => vault.create('a.md', 'x');\n"],
		['an adapter write through a property', "export const write = (app: any) => app.vault.adapter.write('a.md', 'x');\n"],
		['an adapter write through a local named adapter', "export const write = (adapter: any) => adapter.mkdir('Geometry');\n"],
		['persisted UI state', "export const write = (app: any) => app.saveLocalStorage('k', 1);\n"],
		['persisted UI state, read back', "export const read = (app: any) => app.loadLocalStorage('k');\n"],
	])('refuses %s outside src/infrastructure/obsidian/', async (_what, code) => {
		expect(await lintText(code, BANNED)).toContain(RULE);
	});

	/**
	 * The same calls in the directory whose JOB this is. Without these the suite could not tell
	 * a working boundary from one that refuses everything everywhere — which would fail the
	 * whole repository's build, but only after someone wrote the next repository method.
	 */
	it.each([
		['a vault write', "export const write = (app: any) => app.vault.modify(null as any, 'x');\n"],
		['a frontmatter write', 'export const write = (m: any, f: any) => m.processFrontMatter(f, () => undefined);\n'],
	])('allows %s inside src/infrastructure/obsidian/', async (_what, code) => {
		expect(await lintText(code, SANCTIONED)).not.toContain(RULE);
	});

	// Reads are not writes, and a selector that took the whole receiver would say otherwise.
	it.each([
		['a vault read', "export const read = (app: any) => app.vault.read(null as any);\n"],
		['an adapter read', "export const read = (app: any) => app.vault.adapter.read('a.md');\n"],
		['an unrelated method of the same name shape', 'export const go = (thing: any) => thing.processSomething();\n'],
	])('says nothing about %s', async (_what, code) => {
		expect(await lintText(code, BANNED)).not.toContain(RULE);
	});

	/**
	 * The two spellings `eslint.config.mjs` states it CANNOT see, pinned as absences rather than
	 * left in prose. The config's own instruction for either is to rename the local rather than
	 * widen the selector, and a reader deciding that needs to know the hole is real.
	 */
	it.each([
		['a differently-named alias', "export const write = (app: any) => { const v = app.vault; return v.modify(null as any, 'x'); };\n"],
		['a destructured method', "export const write = (vault: any) => { const { create } = vault; return create('a.md', 'x'); };\n"],
	])('cannot see %s, which the config says in prose and this pins', async (_what, code) => {
		expect(await lintText(code, BANNED)).not.toContain(RULE);
	});

	/**
	 * The extension list, which went stale once already: the block's glob named only `.ts` and
	 * `.vue` after `SRC_EXTENSIONS` grew, so a `.js` file was covered by every layer ban and
	 * still bypassed this boundary. Three representative extensions rather than the whole list
	 * — a `.js` file, an SFC, and the `.ts` every case above uses — so a glob rebuilt by hand
	 * cannot quietly drop the two that are easy to forget.
	 */
	it.each([
		['a .js file', "export const write = (app) => app.vault.modify(null, 'x');\n", 'src/presentation/Probe.js'],
		['an SFC', sfc("const write = (app: any) => app.vault.modify(null as any, 'x');\nvoid write;"), 'src/presentation/Probe.vue'],
	])('reaches %s too', async (_what, code, filePath) => {
		expect(await lintText(code, filePath)).toContain(RULE);
	});
});
