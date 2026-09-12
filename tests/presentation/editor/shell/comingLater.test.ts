/**
 * The Coming later sentence (2026-09-12 side panels spec §3), per locale, through the pure `t` —
 * no call site's language resolution involved, so both tables are driven directly.
 */
import { describe, expect, it } from 'vitest';
import { comingLaterSentence } from '../../../../src/presentation/editor/shell/comingLater';

describe('the Coming later sentence', () => {
	it('names the sections in English, in the order given', () => {
		const list = new Intl.ListFormat('en', { type: 'unit' }).format(['What’s here', 'Costs', 'Notes']);
		expect(comingLaterSentence('en', ['existing', 'costs', 'notes'])).toBe(`Coming later: ${list}`);
	});

	it('names them from the German table in German', () => {
		const list = new Intl.ListFormat('de', { type: 'unit' }).format(['Was ist zu tun', 'Fotos']);
		expect(comingLaterSentence('de', ['work', 'photos'])).toBe(`Später verfügbar: ${list}`);
	});

	it('answers nothing when nothing is unavailable', () => {
		expect(comingLaterSentence('en', [])).toBe('');
	});
});
