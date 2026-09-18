/**
 * **AD14's capability GATE** — contract C11 as revision `r1` row 3 settles it: *"Explicit capability
 * gating only. No shape history, no placement pinning."*
 *
 * The premise, measured rather than assumed. Nothing in this product can be APPROVED: `Plan
 * revisions` is a requirement note under `docs/requirements/`, an Epic with a Definition of done and
 * no code, and `r1` row 4 records the matching measurement on the other side — *"There is no export
 * subsystem … `src/` contains no PDF, print or render-to-file path"*. So C11's own conditional
 * applies in full: *"If no such capability is implemented, do not label a live preview as frozen or
 * approved."*
 *
 * **What this file checks, at the width of the check and no wider.** It reads the SHIPPED STRINGS of
 * the two surfaces AD14 is about — the asset designer, the asset library and the asset vocabulary
 * they share — and refuses one that promises a revision, an approval, a freeze or an issued
 * handover. That is C11's rule put at the forbidden thing rather than at a list of components: a
 * card that later adds a "Freeze this design" button, an "Approved" badge or an "Issue to trade"
 * action fails here whether or not anybody remembered this rule, because the text is the promise.
 *
 * **Three things it deliberately does NOT do.**
 *
 * - It does not read `src/` for the absence of a revision mechanism. Absence is not checkable by
 *   listing places, and the requirement note is the durable record of the gap.
 * - It does not scan the whole locale table. `quote.issued` ("Issue date") is a legitimate field on
 *   a supplier's quote, and a blanket ban would refuse a word this product uses correctly
 *   elsewhere. Scoping to the three key families is what makes the vocabulary honest rather than
 *   merely strict.
 * - It does not police the word "reviewed". C07 asks only that *"a 'reviewed' interaction never
 *   certifies code compliance"*, and AD14's Reviewed action says what it means — the notice beside
 *   it hands the judgement to the user (*"Check that it still describes the space you need"*) and
 *   claims nothing about a code, a standard or a third party. `certif*` and `official` ARE in the
 *   vocabulary below, which is where that line is drawn.
 *
 * The scan runs over BOTH locales, because a promise made only in German is still a promise, and
 * the German list is not a translation of the English one — `Freigabe` and `Abnahme` have no
 * single-word English counterpart here.
 */
import { describe, expect, it } from 'vitest';
import { en, type StringKey } from '../../../src/presentation/i18n/locales/en';
import { de } from '../../../src/presentation/i18n/locales/de';

/**
 * The key families this gate covers: the designer's own vocabulary, the asset library view's, and
 * the `asset.*` refusals and labels both draw on. Measured at the time of writing — 338 keys, which
 * the instrument's own case below asserts is still a non-empty set rather than trusting it.
 */
const SURFACES = ['designer.', 'view.asset-library.', 'asset.'] as const;

/**
 * A claim this product cannot honour. Word-boundary and case-insensitive, over a RUNTIME value (a
 * shipped string), which is what keeps this out of the source-text-gate census.
 *
 * `supersed*` / `ersetzt` is deliberately absent from both lists: `designer.clearance.replaces`
 * says *"Das ersetzt die Grenze, die dieses Objekt bereits hat"* about one boundary replacing
 * another, which is an ordinary word and not a revision lifecycle state.
 */
const CLAIMS: Readonly<Record<'en' | 'de', RegExp>> = {
	en: /\b(approv\w*|frozen|freeze|freezing|issued|revision\w*|sign-?off|signed off|certif\w*|official)\b/i,
	de: /\b(genehmig\w*|freigegeben|freigabe|eingefroren|einfrieren|revision\w*|endgültig|abgenommen|abnahme|zertifiz\w*|amtlich|offiziell)\b/i,
};

const inScope = (key: string): boolean => SURFACES.some((prefix) => key.startsWith(prefix));

const scopedKeys = (): StringKey[] => (Object.keys(en) as StringKey[]).filter((key) => inScope(key));

const offenders = (table: Readonly<Record<string, string>>, pattern: RegExp): string[] =>
	scopedKeys().filter((key) => pattern.test(table[key] ?? '')).map((key) => `${key}: ${table[key] ?? ''}`);

describe('the asset surfaces promise no frozen or approved handover (C11, revision r1 row 3)', () => {
	/**
	 * **The instrument's own case, first.** A gate that reaches nothing looks exactly like a clean
	 * tree, and this one is two moving parts — a prefix list and a vocabulary — either of which
	 * could silently match nothing after a rename. So: the scope is non-empty, and the vocabulary
	 * really fires on a string of the shape it exists to refuse.
	 */
	it('reads a non-empty set of keys and really refuses the strings it is about', () => {
		expect(scopedKeys().length).toBeGreaterThan(100);
		expect(inScope('designer.inspector')).toBe(true);
		expect(inScope('quote.issued')).toBe(false);
		for (const planted of ['This drawing is approved.', 'Freeze this revision.', 'Issued to the trade.']) {
			expect(CLAIMS.en.test(planted)).toBe(true);
		}
		for (const planted of ['Diese Zeichnung ist genehmigt.', 'Revision einfrieren.', 'Zur Freigabe.']) {
			expect(CLAIMS.de.test(planted)).toBe(true);
		}
	});

	it.each([
		['en', en as Readonly<Record<string, string>>, CLAIMS.en],
		['de', de as Readonly<Record<string, string>>, CLAIMS.de],
	])('declares no approval, freeze, revision or issued-handover claim in %s', (_language, table, pattern) => {
		expect(offenders(table, pattern)).toEqual([]);
	});

	/**
	 * The one string in this vocabulary that comes closest, pinned so that a later reword cannot
	 * drift it into a certification: the Reviewed action is about a CLEARANCE the user drew, and the
	 * notice beside it asks them to judge it rather than telling them somebody else has.
	 */
	it('offers review of a clearance without claiming anybody certified it', () => {
		expect(en['designer.clearance.review.action']).toBe('Mark clearance as reviewed');
		expect(CLAIMS.en.test(en['designer.clearance.review.notice'])).toBe(false);
		expect(CLAIMS.de.test(de['designer.clearance.review.notice'])).toBe(false);
	});
});
