import { describe, expect, it } from 'vitest';
import { toUserMessage } from '../../../src/presentation/i18n/toUserMessage';
import { t } from '../../../src/presentation/i18n/strings';

/**
 * BP-02 slice 3's user-facing refusal: the vault holds an outstanding recovery record for the
 * item being deleted that this build cannot read, so `SequenceMarkerFileStore.write` refuses to
 * open a new destructive sequence over it and `runDeleteResolution` aborts the whole delete.
 *
 * **Its own file, and its own instrument, because nothing else here could be one.** The sibling
 * of this block is `the write-incident refusal copy` in `toUserMessage.test.ts`; adding these
 * cases there took that file to 463 counted lines against its 450-line `max-lines` cap, and this
 * repository's standing answer to that wall is the extraction rather than a wider budget. The
 * two code scans that live in that file could not have caught this either, measured: they reach
 * `${kind}.`-templated codes and codes minted under `src/application/`, and this one is a
 * literal minted in `src/infrastructure/`. So the code resolved to the Persistence category
 * sentence — 'The vault could not be read or written.' — for a whole review round with every
 * gate green, which is false twice over: the vault read fine and was deliberately NOT written.
 *
 * Watched red before the two locale rows landed: both cases below failed with exactly that
 * sentence.
 */
describe('the blocked sequence-marker refusal copy', () => {
	const blocked = { category: 'Persistence', code: 'sequence.marker-write-blocked', message: 'dev' } as const;

	it('resolves the code as a key in both locales rather than falling through to the category', () => {
		expect(toUserMessage('en', blocked)).toBe(t('en', 'sequence.marker-write-blocked'));
		expect(toUserMessage('de', blocked)).toBe(t('de', 'sequence.marker-write-blocked'));
		expect(toUserMessage('en', blocked)).not.toBe(t('en', 'error.category.persistence'));
		expect(toUserMessage('de', blocked)).not.toBe(t('de', 'error.category.persistence'));
	});

	/**
	 * `docs/using-planning-recovery.md` splits the remedy by cause and nothing at this door can
	 * tell the two causes apart, so the copy has to carry both: a newer build for a record a
	 * newer version wrote, and the file-level removal for one a hand edit bent out of shape.
	 */
	it('names the outstanding record and both of the remedies the user guide splits by cause', () => {
		for (const language of ['en', 'de']) {
			const copy = toUserMessage(language, blocked);
			expect(copy).toContain('sequence-markers.json');
			expect(copy).toMatch(/build/i);
		}
	});
});
