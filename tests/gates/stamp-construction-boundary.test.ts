import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';
import { lintOne } from '../helpers/oxlint';
import { REPO } from '../helpers/repo';

/**
 * `STAMP_CONSTRUCTION_BAN` — the `no-restricted-syntax` selectors that keep a "partly failed
 * write" stamp from being built anywhere in `src/` but `markUncompensated`.
 *
 * Owner ruling 13 moved the write-incident record INTO `markUncompensated`, so the record is only
 * as complete as that function's monopoly on the stamp: a stamp spelled by hand elsewhere would
 * travel to every reader of `leftWritesBehind` — the save indicator, the undo pause — and open no
 * incident at all, which is the unrecorded half-write the ruling exists to close. So the check
 * sits at the forbidden thing, the construction, rather than at a list of raise sites.
 *
 * The instrument is tested first, in both directions and through every block that carries the
 * rule: two flat-config blocks matching one file OVERRIDE `no-restricted-syntax` rather than
 * merging it, so each carve-out has to restate the shared list. The blind spots the config states
 * in prose are asserted AS blind spots, because a rule that had narrowed further would read exactly
 * the same. Virtual paths, and real ones, for the reason `notice-text-boundary.test.ts` gives.
 */

const RULE = 'no-restricted-syntax';

/** The general `src/` block. */
const GENERAL = 'src/application/reference/deleteResolution.ts';
/** The one sanctioned construction site. */
const DEFINITION = 'src/application/commands/DispatchOutcome.ts';
/** The sanctioned WRITER's block, which restates the shared bans. */
const INFRASTRUCTURE = 'src/infrastructure/obsidian/repositories/noteEntityWrite.ts';
/** The sanctioned language RESOLVER's block, which restates them too. */
const RESOLVER = 'src/presentation/i18n/strings.ts';
const SFC = 'src/presentation/Probe.vue';

const sfc = (body: string) => `<script setup lang="ts">\n${body}\n</script>\n\n<template>\n\t<p>x</p>\n</template>\n`;

const HAND_BUILT = 'export const stamp = (e: object) => ({ ...e, uncompensatedWrite: [] });\n';

beforeAll(async () => {
	await warmUpEslint();
	await lintText('export const probe = 1;\n', GENERAL);
}, ESLINT_BOOT_MS);

describe('the stamp construction boundary', () => {
	it.each([
		['an identifier-keyed property', HAND_BUILT],
		['a shorthand property', 'export const stamp = (e: object, uncompensatedWrite: never[]) => ({ ...e, uncompensatedWrite });\n'],
		['a string-keyed property', "export const stamp = (e: object) => ({ ...e, 'uncompensatedWrite': [] });\n"],
		['an Object.assign of a literal', 'export const stamp = (e: object) => Object.assign(e, { uncompensatedWrite: [] });\n'],
		['an assignment', 'export const stamp = (e: { uncompensatedWrite?: never[] }) => { e.uncompensatedWrite = []; };\n'],
		['a string-keyed assignment', "export const stamp = (e: { uncompensatedWrite?: never[] }) => { e['uncompensatedWrite'] = []; };\n"],
	])('refuses %s', async (_what, code) => {
		expect(await lintText(code, GENERAL)).toContain(RULE);
	});

	/**
	 * The sanctioned construction, read from disk at its own path: without this the suite could
	 * not tell a working boundary from one that refuses the definition itself, which would fail
	 * the build only once somebody next touched `DispatchOutcome.ts`.
	 */
	it('allows markUncompensated\'s own body, the one sanctioned construction', async () => {
		const source = readFileSync(path.join(REPO, DEFINITION), 'utf8');
		expect(source).toContain('uncompensatedWrite: entities');
		expect(await lintText(source, DEFINITION)).not.toContain(RULE);
	});

	it.each([
		['a call to markUncompensated', 'export const stamp = (mark: (e: object, x: never[]) => object, e: object) => mark(e, []);\n'],
		['a read of the stamp', 'export const read = (e: { uncompensatedWrite?: unknown }) => e.uncompensatedWrite;\n'],
		['a destructuring read', 'export const read = (e: { uncompensatedWrite?: unknown }) => { const { uncompensatedWrite } = e; return uncompensatedWrite; };\n'],
		['a type declaring the field', 'export interface Stamp { readonly uncompensatedWrite: readonly string[] }\n'],
	])('says nothing about %s', async (_what, code) => {
		expect(await lintText(code, GENERAL)).not.toContain(RULE);
	});

	it.each([
		['the sanctioned writer\'s block', HAND_BUILT, INFRASTRUCTURE],
		['the sanctioned resolver\'s block', HAND_BUILT, RESOLVER],
		['an SFC', sfc('const stamp = (e: object) => ({ ...e, uncompensatedWrite: [] });\nvoid stamp;'), SFC],
	])('reaches %s too', async (_what, code, filePath) => {
		expect(await lintText(code, filePath)).toContain(RULE);
	});

	/**
	 * The spellings `eslint.config.mjs` states it CANNOT see. Each builds a real stamp — an object
	 * `leftWritesBehind` answers `true` for — that opens no incident. A reviewer is the backstop.
	 */
	it.each([
		['a computed key', "const KEY = 'uncompensatedWrite';\nexport const stamp = (e: object) => ({ ...e, [KEY]: [] });\n"],
		['an Object.assign with a computed key', "const KEY = 'uncompensatedWrite';\nexport const stamp = (e: object) => Object.assign(e, { [KEY]: [] });\n"],
		['an Object.defineProperty with a computed name', "const KEY = 'uncompensatedWrite';\nexport const stamp = (e: object) => Object.defineProperty(e, KEY, { value: [] });\n"],
		['an Object.defineProperty with a literal name', "export const stamp = (e: object) => Object.defineProperty(e, 'uncompensatedWrite', { value: [] });\n"],
		['a class field', 'export class Stamp { readonly uncompensatedWrite: never[] = []; }\n'],
		['a SECOND function named markUncompensated', 'export function markUncompensated(e: object) { return { ...e, uncompensatedWrite: [] }; }\n'],
	])('cannot see %s, which the config says in prose and this pins', async (_what, code) => {
		expect(await lintText(code, GENERAL)).not.toContain(RULE);
	});

	/**
	 * oxlint has no `no-restricted-syntax` at all, so the edit-loop hook — oxlint for every `.ts` —
	 * never sees this rule; `npm run check`'s `eslint .` is where it is enforced.
	 */
	it('is invisible to oxlint, and so to the edit-loop hook for a .ts file', () => {
		const probe = path.join(mkdtempSync(path.join(tmpdir(), 'stamp-boundary-')), 'probe.ts');
		writeFileSync(probe, HAND_BUILT);
		expect(lintOne(probe)).toBe('');
	});
});
