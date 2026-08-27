import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

/**
 * `LANGUAGE_RESOLUTION_BAN` — the two `no-restricted-syntax` selectors that keep the app
 * language resolved in exactly one module, which is `src/presentation/i18n/strings.ts`.
 *
 * The claim came before the check, on a branch whose whole subject was claims wider than
 * their checks: `currentLanguage()`'s docblock said `tr` and `trError` both come through it
 * "so no call site re-decides it", which is a statement about two callers and says nothing
 * about a third. It happened to be true — one live `getLanguage()` call in `src/` — and
 * nothing but a reviewer's grep held it that way.
 *
 * A rule at the forbidden IMPORT rather than a list of the call sites, for the reason this
 * repository states everywhere: "nothing else resolves the language" cannot be checked by
 * driving the paths someone thought of.
 *
 * And the instrument is tested first. A selector that stops matching does not fail a lint
 * run, it makes one quieter — and a codebase that never violates the rule looks identical
 * either way. So each selector gets snippets that MUST report, the sanctioned file gets one
 * that must NOT, and the blind spots `eslint.config.mjs` declares in prose are asserted as
 * blind spots rather than left as prose.
 *
 * Virtual paths, never files on disk, and REAL ones — see `notice-text-boundary.test.ts`'s
 * header for why a path with no file behind it still resolves the right blocks.
 */

const RULE = 'no-restricted-syntax';

/** The sanctioned resolver: the ONE path the carve-out block names. */
const RESOLVER = 'src/presentation/i18n/strings.ts';
/** Its next-door neighbour, which is what proves the carve-out is a path and not a directory. */
const SIBLING = 'src/presentation/i18n/toUserMessage.ts';
const PLUGIN = 'src/plugin/planEditorCommands.ts';
/** The other block carrying `no-restricted-syntax`, and the override trap it documents. */
const INFRASTRUCTURE = 'src/infrastructure/obsidian/repositories/noteIo.ts';
const SFC = 'src/presentation/Probe.vue';

const sfc = (body: string) => `<script setup lang="ts">\n${body}\n</script>\n\n<template>\n\t<p>x</p>\n</template>\n`;

const NAMED_IMPORT = "import { getLanguage } from 'obsidian';\nexport const probe = (): string => getLanguage();\n";
const NAMESPACE_ACCESS = "import * as obsidian from 'obsidian';\nexport const probe = (): string => obsidian.getLanguage();\n";

/** One `beforeAll` for ESLint's boot and for the first type-aware program build. */
beforeAll(async () => {
	await warmUpEslint();
	await lintText('export const probe = 1;\n', SIBLING);
}, ESLINT_BOOT_MS);

describe('the language resolution boundary', () => {
	it.each([
		['a named getLanguage import', NAMED_IMPORT],
		['a namespaced getLanguage call', NAMESPACE_ACCESS],
		['a renamed named import, which is still the same door', "import { getLanguage as lang } from 'obsidian';\nexport const probe = (): string => lang();\n"],
	])('refuses %s', async (_what, code) => {
		expect(await lintText(code, SIBLING)).toContain(RULE);
	});

	/**
	 * The carve-out, and the reason it is spelled as ONE PATH rather than as a directory: the
	 * sibling above sits in the same folder and is refused, so a directory-shaped glob would
	 * have extended the exception to it and to every file added beside it later.
	 */
	it('allows the one module that IS the resolution point', async () => {
		expect(await lintText(NAMED_IMPORT, RESOLVER)).not.toContain(RULE);
	});

	/**
	 * Every other block carrying `no-restricted-syntax`, because two flat-config blocks
	 * matching one file OVERRIDE the rule rather than merging it — so each block has to spread
	 * the ban, and a forgotten spread is invisible in a tree that never violates it. The SFC
	 * case is the extension list, which went stale once already for `WRITE_BOUNDARY`.
	 */
	it.each([
		['the plugin layer', NAMED_IMPORT, PLUGIN],
		['the sanctioned vault writer', NAMED_IMPORT, INFRASTRUCTURE],
		['an SFC', sfc("import { getLanguage } from 'obsidian';\nconst probe = (): string => getLanguage();\nvoid probe;"), SFC],
		// A dynamic `import()` is only half outside the rule, which is worth pinning as a
		// REACH rather than assuming as a hole: the import specifier is invisible to the first
		// selector, but the call has to reach the function through a member access, and the
		// second selector is not about `obsidian` at all — it is about `.getLanguage`.
		['a dynamic import reached by member access', "export const probe = async (): Promise<string> => (await import('obsidian')).getLanguage();\n", SIBLING],
	])('reaches %s too', async (_what, code, filePath) => {
		expect(await lintText(code, filePath)).toContain(RULE);
	});

	/**
	 * The carve-out subtracts `LANGUAGE_RESOLUTION_BAN` and NOTHING ELSE. Two blocks matching
	 * one file override this rule rather than merging it, so a carve-out naming only its own
	 * subtraction would have taken every other selector off `strings.ts` as well — the exact
	 * trap `eslint.config.mjs` documents three times over. `strings.ts` is a locale module, so
	 * `I18N_LITERAL_BAN` and `NOTICE_TEXT_BAN` are the two most plausible things to lose here.
	 */
	it.each([
		['a notice carrying an exception message', 'export const show = (notify: any, e: any) => notify(e.message);\n'],
		['a literal at an i18n call site', "export const show = (el: any) => el.setText('Saving failed.');\n"],
		['a vault write', 'export const save = (vault: any, f: any) => vault.modify(f, "x");\n'],
	])('still refuses %s in the sanctioned module', async (_what, code) => {
		expect(await lintText(code, RESOLVER)).toContain(RULE);
	});

	/**
	 * The spellings `eslint.config.mjs` states it CANNOT see, pinned as absences rather than
	 * left in prose. The last one is the defect the docblock actually fears and the one no
	 * selector reaches: a language decided from something that is not `getLanguage` at all.
	 * Writing that down is not an endorsement — it is what stops the next reader believing
	 * this rule covers a spelling it structurally cannot.
	 */
	it.each([
		// The one dynamic-import spelling that escapes BOTH selectors: destructured at the
		// await, so there is no `ImportSpecifier` and no member access left to match.
		['a destructured dynamic import', "export const probe = async (): Promise<string> => { const { getLanguage } = await import('obsidian'); return getLanguage(); };\n"],
		['a computed member access', "import * as obsidian from 'obsidian';\nexport const probe = (): string => obsidian['getLanguage']();\n"],
		['a hard-coded language', "export const probe = (t: any, k: any): string => t('de', k);\n"],
		['a plugin-local language setting', 'export const probe = (t: any, s: any, k: any): string => t(s.language, k);\n'],
	])('cannot see %s, which the config says in prose and this pins', async (_what, code) => {
		expect(await lintText(code, SIBLING)).not.toContain(RULE);
	});
});
