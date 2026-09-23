import { beforeAll, describe, expect, it } from 'vitest';
import { ESLINT_BOOT_MS, lintText, warmUpEslint } from '../helpers/eslint';

/**
 * `I18N_LITERAL_BAN` — the `no-restricted-syntax` selectors that keep raw English out of the
 * four call sites this plugin actually puts user-visible text through, which is
 * `docs/requirements/Multilanguage.md`'s rule turned into a gate.
 *
 * **The rule had no instrument at all until design slice 21's improvement pass**, which is
 * the argument for this file rather than a nicety: a selector that stops matching does not
 * fail a lint run, it makes one QUIETER, and a repository that never violates the rule looks
 * identical either way. `eslint.config.mjs`'s own prose enumerated the shapes these see and
 * the shapes they do not, and nothing anywhere read that prose back.
 *
 * It is also what made the widening safe to take. `docs/tasks/21` had recorded
 * `addCommand({ name })` as a gap and declined to close it because widening "touches every
 * existing call site's evidence"; measured, it touches none — every `addCommand` and the one
 * `addRibbonIcon` in `src/` already pass `tr(...)`, a `CallExpression` and not a `Literal` at
 * the position these check.
 *
 * Each selector gets snippets that MUST report, near-misses that must NOT, and the blind
 * spots the config declares in prose asserted AS blind spots — writing down that a one-hop
 * alias escapes is not an endorsement, it is what stops the next reader believing the rule
 * covers a spelling it cannot see.
 *
 * Virtual paths, never files on disk, and REAL ones: `lintText` borrows a path to resolve the
 * flat config without writing anything, and the `.ts` blocks are type-aware, so a path with
 * no file behind it answers `PARSE_ERROR` — a result carrying no rule id, which would read as
 * "the boundary said nothing" in every negative case below. Measured while writing this file:
 * `src/plugin/probe.ts` answered `PARSE_ERROR` for all five fixtures.
 */

const RULE = 'no-restricted-syntax';

/** A real path in the block that carries `SHARED_SRC_SYNTAX_BANS`, so the fixtures resolve. */
const PLUGIN = 'src/plugin/RenovationPlannerPlugin.ts';
/** The other end of `src/`, to prove the ban is shared rather than per-directory. */
const PRESENTATION = 'src/presentation/notices/notify.ts';

/** One `beforeAll` for ESLint's boot and for the first type-aware program build. */
beforeAll(async () => {
	await warmUpEslint();
	await lintText('export const probe = 1;\n', PLUGIN);
}, ESLINT_BOOT_MS);

describe('the i18n literal boundary', () => {
	it.each([
		['setText given a sentence', "export const r = (el: any) => el.setText('Saving failed.');\n"],
		['createEl given a text option', "export const r = (el: any) => el.createEl('p', { text: 'Saving failed.' });\n"],
		['createDiv given a text option', "export const r = (el: any) => el.createDiv({ text: 'Saving failed.' });\n"],
		['createSpan given a text option', "export const r = (el: any) => el.createSpan({ text: 'Saving failed.' });\n"],
		// The two doors this pass added. Both are Obsidian's own registration API, and
		// neither goes through a DOM helper, so neither was reachable from the four above.
		['addCommand given a name', "export const r = (h: any) => h.addCommand({ id: 'x', name: 'Open project' });\n"],
		['addCommand reached through this', "export class C { m() { (this as any).addCommand({ id: 'x', name: 'Open project' }); } }\n"],
		// The quoted-key spelling, which is a different AST shape: `NAME_KEY` and `TEXT_KEY`
		// each match both, and a selector written for one of them alone is silent on the other.
		["addCommand with a quoted name key", "export const r = (h: any) => h.addCommand({ id: 'x', 'name': 'Open project' });\n"],
		['addRibbonIcon given a title', "export const r = (h: any) => h.addRibbonIcon('hammer', 'Open project', () => undefined);\n"],
	])('refuses %s', async (_what, code) => {
		expect(await lintText(code, PLUGIN)).toContain(RULE);
	});

	/**
	 * The shapes the plugin actually uses. Without these the suite could not tell a working
	 * boundary from one that refuses every registration in the repository — which would fail
	 * the build, but only once somebody wrote the next command.
	 */
	it.each([
		['setText given a translated string', "export const r = (el: any, tr: any) => el.setText(tr('a.b'));\n"],
		['createEl given a translated text option', "export const r = (el: any, tr: any) => el.createEl('p', { text: tr('a.b') });\n"],
		['addCommand given a translated name', "export const r = (h: any, tr: any) => h.addCommand({ id: 'x', name: tr('a.b') });\n"],
		['addRibbonIcon given a translated title', "export const r = (h: any, tr: any) => h.addRibbonIcon('hammer', tr('a.b'), () => undefined);\n"],
		// **A command id is DATA**, bound to a user's hotkey, so a literal there is correct and
		// this is the assertion that keeps the `name`-only selector from being widened to the
		// whole descriptor by somebody reading the message rather than the key.
		['addCommand given a literal id and nothing else', "export const r = (h: any, tr: any) => h.addCommand({ id: 'open-project', name: tr('a.b') });\n"],
		// The ICON beside the title is data too, and it is a literal at the same call. The
		// selector keys on the argument POSITION for exactly this: a rule reading "a literal
		// somewhere in an addRibbonIcon call" would refuse every correct one in the plugin.
		['addRibbonIcon given a literal icon', "export const r = (h: any, tr: any) => h.addRibbonIcon('hammer', tr('a.b'), () => undefined);\n"],
		['setText given an empty literal, which carries no copy', "export const r = (el: any) => el.setText('');\n"],
		['addCommand given an empty name', "export const r = (h: any) => h.addCommand({ id: 'x', name: '' });\n"],
	])('allows %s', async (_what, code) => {
		expect(await lintText(code, PLUGIN)).not.toContain(RULE);
	});

	/**
	 * **The blind spots, asserted as blind spots.** Every one is declared in prose in
	 * `eslint.config.mjs`; none of them was checked, so a claim that the rule had narrowed
	 * further would have read the same. A reviewer is the backstop for all three.
	 */
	it.each([
		['a literal held in a variable first', "export const r = (h: any) => { const name = 'Open project'; h.addCommand({ id: 'x', name }); };\n"],
		// A `TemplateLiteral` is a different node type from a `Literal`, so no selector here
		// sees one — the same blind spot `NOTICE_TEXT_BAN` declares about its own.
		['raw English in a template literal', 'export const r = (h: any) => h.addCommand({ id: "x", name: `Open project` });\n'],
		// `callee.property.name`, so a bare function call has no property to match. This is
		// why the notice doors are bare functions and these are member calls: the two rules
		// are blind in OPPOSITE directions and each says so where it lives.
		['a registration reached as a bare function', "export const r = (addCommand: any) => addCommand({ id: 'x', name: 'Open project' });\n"],
		// `title` is not `name`; Obsidian's `addCommand` takes no such key, and a rule that
		// guessed at neighbouring keys would refuse correct code elsewhere.
		['a key this rule does not name', "export const r = (h: any) => h.addCommand({ id: 'x', title: 'Open project' });\n"],
	])('cannot see %s', async (_what, code) => {
		expect(await lintText(code, PLUGIN)).not.toContain(RULE);
	});

	/**
	 * `SHARED_SRC_SYNTAX_BANS` is spread by three blocks, and two flat-config blocks matching
	 * one file OVERRIDE rather than merge — the trap `eslint.config.mjs` names by hand. Driven
	 * at the other end of `src/` so a block that stopped spreading the shared list fails here
	 * rather than in whichever directory somebody next wrote a command in.
	 */
	it('carries the ban in a second block that spreads the shared list', async () => {
		expect(await lintText("export const r = (el: any) => el.setText('Saving failed.');\n", PRESENTATION)).toContain(RULE);
	});
});
