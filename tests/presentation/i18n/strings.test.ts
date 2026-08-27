import { describe, expect, it } from 'vitest';
import { t, tr } from '../../../src/presentation/i18n/strings';
import { de } from '../../../src/presentation/i18n/locales/de';
import { en } from '../../../src/presentation/i18n/locales/en';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';

/**
 * Pure lookups, asked of the function — no view, no mock, no language global. The
 * fallback cases are the contract that makes an incomplete locale safe to ship.
 */
describe('translating a string', () => {
	it('answers English', () => {
		expect(t('en', 'view.project.name')).toBe('Renovation project');
	});

	it('answers a translated locale', () => {
		expect(t('de', 'view.project.name')).toBe('Renovierungsprojekt');
		expect(t('de', 'command.open-project')).toBe('Renovierungsprojekt öffnen');
	});

	it('falls back to English for a language nothing translates', () => {
		expect(t('fr', 'view.project.name')).toBe('Renovation project');
	});

	// `tr` is `t` in the app's own language — the mock answers 'en', so this pins the
	// delegation, and the per-locale behaviour is already driven through `t` above.
	it('tr answers in the app language', () => {
		expect(tr('view.project.name')).toBe(t('en', 'view.project.name'));
	});
});

/**
 * `de` is typed `Partial<Record<StringKey, string>>` and that is deliberate: an incomplete
 * locale must be SAFE, which is exactly what the English-fallback case above proves.
 * Completeness is a different promise, and the project makes it — "every key goes in BOTH
 * `en.ts` and `de.ts`" — with nothing checking it until now. A forgotten German string is
 * therefore invisible: the type permits its absence, the fallback hides it, and the user is
 * quietly shown English. It measures complete today (73 of 73), which is what makes this one
 * assertion rather than a backlog.
 *
 * Only the one direction. An ORPHANED German key — one whose English original was renamed —
 * is already a build failure: `de.ts` annotates its literal as
 * `Partial<Record<StringKey, string>>`, so excess-property checking rejects a key
 * `StringKey` does not carry. The compiler owns that half; this owns the half it cannot see.
 *
 * ORDER is not checked, and that rule is the reason to say so rather than to widen this:
 * `settings.unrecovered` sits third in `de.ts` and sixth in `en.ts`, and has since before
 * design slice 15 — so "same order" is already false, and asserting it here would add a red
 * for something this change did not break. Reordering a locale file is its own edit.
 */
describe('the German locale', () => {
	it('translates every key English declares', () => {
		const untranslated = Object.keys(en).filter((key) => !(key in de));

		expect(untranslated).toEqual([]);
	});

	/**
	 * The gate this file did not have, and the reason it is needed: NOTHING renders `de.ts`
	 * in any gate, so its only reader is a human who happens to look. The first time anyone
	 * did, it held a word slice 11 had already removed once — `Materialien` for an Asset,
	 * forty lines below a German-language comment recording that correction — plus a garbled
	 * `Tresnornder` and a `Das Tresor` disagreeing with a `Der Tresor` — two keys naming the
	 * same noun, each giving it a different gender.
	 *
	 * A vocabulary check, not a spell check. It expresses "this concept has ONE German word
	 * here", which is exactly what drifts when copy is added a slice at a time by different
	 * hands. What it still cannot see is a misspelling of a word nothing forbids: it refuses
	 * synonyms somebody thought of, and the next wrong word is the one nobody did. The case
	 * below covers exactly that gap for the one term where it is expressible.
	 *
	 * `Vault` is on the list because it is Obsidian's OWN name for the thing and is therefore
	 * not translated at all — the same way the product is not renamed. `Tresor` is what five
	 * keys used to say.
	 */
	const FORBIDDEN: ReadonlyArray<readonly [wrong: string, right: string]> = [
		['Material', 'Objekt'],
		['Tresor', 'Vault'],
	];

	it.each(FORBIDDEN)('never says %s where the German UI says %s', (wrong, right) => {
		const offenders = Object.entries(de)
			.filter(([, value]) => value.includes(wrong))
			.map(([key]) => key);

		expect(offenders, `use "${right}" instead of "${wrong}"`).toEqual([]);
	});

	/**
	 * The stronger half, and the one that earns its place: a forbidden-substring row can only
	 * refuse a wrong word somebody thought of, and the wrong word here was `Tresnornder` — a
	 * corruption that contains neither `Tresor` nor `Vault`, so the row above sails straight
	 * past it. Measured, not assumed: `'Tresnornder…'.includes('Tresor')` is `false`.
	 *
	 * This asks the question from the English side instead. Wherever `en.ts` says "vault",
	 * `de.ts` must say "Vault" — so ANY translation of it fails, including a misspelled one,
	 * and including one nobody predicted. That is the difference between banning a synonym
	 * and requiring the term.
	 */
	it('keeps Obsidian’s own name for the Vault in German, wherever English uses it', () => {
		const offenders = Object.entries(en)
			.filter(([key, value]) => value.toLowerCase().includes('vault') && !(de[key as StringKey] ?? '').includes('Vault'))
			.map(([key]) => key);

		expect(offenders, 'Vault is Obsidian’s own name and is not translated').toEqual([]);
	});
});
