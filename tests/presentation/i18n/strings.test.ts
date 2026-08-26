import { describe, expect, it } from 'vitest';
import { t, tr } from '../../../src/presentation/i18n/strings';
import { de } from '../../../src/presentation/i18n/locales/de';
import { en } from '../../../src/presentation/i18n/locales/en';

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
});
