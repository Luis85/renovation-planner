import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

/**
 * `NOTICE_TEXT_BAN` — the two `no-restricted-syntax` selectors that keep developer text out
 * of an Obsidian `Notice`, which is design slice 11's Definition of Done item 3 turned into
 * a gate.
 *
 * That item was graded a GAP, for a reason worth restating here because it is the argument
 * for this file existing at all: `notify(message: string)` accepts ANY string, and
 * `I18N_LITERAL_BAN` reaches exactly four call sites of which a `notify(...)` argument is
 * none — so the notice door was the one user-facing surface no gate could see. Two raw
 * `Error.message` notices shipped through it, and design slice 10's error codes reached
 * users as the wrong category sentence, with `npm run check` green the whole time.
 *
 * A rule at the forbidden call rather than a list of the call sites, for the reason this
 * repository states everywhere: "nothing prints developer text" cannot be checked by driving
 * the paths someone thought of, because the next path is the one that breaks it.
 *
 * And the instrument is tested first. A selector that stops matching does not fail a lint
 * run; it makes one quieter, and a codebase that never violates the rule looks identical.
 * So each selector gets snippets that MUST report and near-misses that must NOT, plus the
 * blind spots `eslint.config.mjs` declares in prose, asserted as blind spots — writing down
 * that a one-hop alias escapes is not an endorsement, it is what stops the next reader
 * believing the rule covers a spelling it cannot see.
 *
 * Virtual paths, never files on disk, and REAL ones: `lintText` borrows a path to resolve
 * the flat config without writing anything, and the `.ts` blocks are type-aware, so a path
 * with no file behind it answers `PARSE_ERROR` — a result carrying no rule id, which would
 * read as "the boundary said nothing" in every negative case below.
 */

const RULE = 'no-restricted-syntax';

const PRESENTATION = 'src/presentation/notices/notify.ts';
/** The other block carrying `no-restricted-syntax`, and the override trap it documents. */
const INFRASTRUCTURE = 'src/infrastructure/obsidian/repositories/noteIo.ts';
const SFC = 'src/presentation/Probe.vue';

const sfc = (body: string) => `<script setup lang="ts">\n${body}\n</script>\n\n<template>\n\t<p>x</p>\n</template>\n`;

/** One `beforeAll` for ESLint's boot and for the first type-aware program build. */
beforeAll(async () => {
	await warmUpEslint();
	await lintText('export const probe = 1;\n', PRESENTATION);
}, ESLINT_BOOT_MS);

describe('the notice text boundary', () => {
	it.each([
		['an exception message', 'export const show = (notify: any, e: any) => notify(e.message);\n'],
		['a message read through a Result', 'export const show = (notify: any, r: any) => notify(r.error.message);\n'],
		['a stack trace', 'export const show = (notify: any, e: any) => notify(e.stack);\n'],
		['a message wrapped in a call', 'export const show = (notify: any, e: any) => notify(String(e.message));\n'],
		// A template literal with both delimiters escaped, so the fixture's own source holds
		// no interpolation this file's linters can misread: a plain string containing `${…}`
		// trips `no-template-curly-in-string`, and splitting it in two trips
		// `no-useless-concat`. What the linter UNDER TEST receives is the same either way.
		['a message interpolated into a template', `export const show = (notify: any, e: any) => notify(\`Failed: \${e.message}\`);\n`],
		['a raw literal sentence', "export const show = (notify: any) => notify('Saving failed.');\n"],
		['a message passed to Notice directly', 'export const show = (Notice: any, e: any) => new Notice(e.message);\n'],
		['a literal passed to Notice directly', "export const show = (Notice: any) => new Notice('Saving failed.');\n"],
	])('refuses %s', async (_what, code) => {
		expect(await lintText(code, PRESENTATION)).toContain(RULE);
	});

	/**
	 * The shapes the plugin actually uses. Without these the suite could not tell a working
	 * boundary from one that refuses every notice in the repository — which would fail the
	 * build, but only once somebody wrote the next notice.
	 */
	it.each([
		['a translated string', "export const show = (notify: any, tr: any) => notify(tr('plan.none'));\n"],
		['copy resolved from an AppError', 'export const show = (notify: any, toUserMessage: any, r: any) => notify(toUserMessage("en", r.error));\n'],
		['an AppError handed to notifyError', 'export const show = (notifyError: any, r: any) => notifyError(r.error);\n'],
		['a thrown cause handed to notifyFault', 'export const show = (notifyFault: any, c: unknown) => notifyFault(c);\n'],
		['an empty literal, which carries no copy', "export const clear = (notify: any) => notify('');\n"],
	])('allows %s', async (_what, code) => {
		expect(await lintText(code, PRESENTATION)).not.toContain(RULE);
	});

	/**
	 * A `message` is developer text in a NOTICE, not everywhere. Logging one is the other
	 * half of slice 11's rule, and a selector that took the member access alone would refuse
	 * exactly the line the rule asks for.
	 */
	it.each([
		['logging a cause', "export const log = (logger: any, e: any) => logger.error('x.failed', { cause: e.message });\n"],
		['any other function taking a message', 'export const report = (send: any, e: any) => send(e.message);\n'],
		['building an AppError out of one', 'export const map = (e: any) => ({ code: "x", message: e.message });\n'],
	])('says nothing about %s', async (_what, code) => {
		expect(await lintText(code, PRESENTATION)).not.toContain(RULE);
	});

	/**
	 * The override trap `eslint.config.mjs` documents: two flat-config blocks matching one
	 * file OVERRIDE `no-restricted-syntax` rather than merging it, so the block for
	 * `src/infrastructure/obsidian/` has to repeat these selectors. That directory is also
	 * where the raw exception is actually held, which makes it the likeliest place for one to
	 * be printed — and the one place a forgotten repeat would be invisible. The SFC case is
	 * the extension list, which went stale once already for `WRITE_BOUNDARY`.
	 */
	it.each([
		['an exception message', 'export const show = (notify: any, e: any) => notify(e.message);\n', INFRASTRUCTURE],
		['a raw literal sentence', "export const show = (notify: any) => notify('Saving failed.');\n", INFRASTRUCTURE],
		['an exception message in an SFC', sfc('const show = (notify: any, e: any) => notify(e.message);\nvoid show;'), SFC],
	])('reaches %s too', async (_what, code, filePath) => {
		expect(await lintText(code, filePath)).toContain(RULE);
	});

	/**
	 * The spellings `eslint.config.mjs` states it CANNOT see, pinned as absences rather than
	 * left in prose. Both are the blind spot `I18N_LITERAL_BAN` and `WRITE_BOUNDARY` declare
	 * for themselves: a Literal or a member access one hop away from the call is not at the
	 * position an esquery selector checks. A reviewer is the backstop, and a reader deciding
	 * whether to trust this rule needs to know the hole is real.
	 */
	it.each([
		['a message one hop away', 'export const show = (notify: any, e: any) => { const text = e.message; return notify(text); };\n'],
		['a template literal with no member access', 'export const show = (notify: any) => notify(`Saving failed.`);\n'],
	])('cannot see %s, which the config says in prose and this pins', async (_what, code) => {
		expect(await lintText(code, PRESENTATION)).not.toContain(RULE);
	});
});
