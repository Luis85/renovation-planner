import { describe, expect, it } from 'vitest';
import { matchesQuery, splitMatch } from '../../../src/presentation/views/projectFilter';
import { nameCollator } from '../../../src/presentation/views/projectOrder';

const en = nameCollator('en');
const de = nameCollator('de');

/**
 * A REAL `Intl.Collator` with its `compare` shadowed by a counting wrapper — not a hand-built
 * stand-in, because a fake thinner than the real thing is this repository's most-repeated
 * defect and `findMatch` takes the type rather than a `{ compare }` shape.
 *
 * `compare` is an accessor on `Intl.Collator.prototype` returning a bound function, so reading
 * it once yields the genuine comparison and defining an own data property over it shadows the
 * getter for this instance alone.
 */
function countingCollator(language: string): { collator: Intl.Collator; calls: () => number } {
	const collator = nameCollator(language);
	const real = collator.compare;
	let calls = 0;
	Object.defineProperty(collator, 'compare', {
		value: (left: string, right: string): number => {
			calls += 1;
			return real(left, right);
		},
	});
	return { collator, calls: (): number => calls };
}

describe('matchesQuery', () => {
	it('matches a substring anywhere in the name', () => {
		expect(matchesQuery('House Renovation 2026', 'renov', en)).toBe(true);
		expect(matchesQuery('House Renovation 2026', 'cellar', en)).toBe(false);
	});

	it('ignores case', () => {
		expect(matchesQuery('Kitchen', 'KITCHEN', en)).toBe(true);
	});

	it('ignores diacritics, which is the whole reason a collator is used', () => {
		// A German vault must match `Küche` when the user types `kuche`. A `toLowerCase`
		// comparison answers false here, which is why this is not one.
		expect(matchesQuery('Küche', 'kuche', de)).toBe(true);
		expect(matchesQuery('Ähre', 'ahre', de)).toBe(true);
	});

	it('matches a LIGATURE, where one code unit equals three', () => {
		// Measured in node against both locales, not assumed: `compare('ﬃ', 'ffi')` is 0 in
		// `en` and in `de`, so a 1-unit window has to be tried against a 6-unit query. Any
		// `minWidth` derived from the query's length never tries it.
		expect(matchesQuery('Oﬃce', 'office', en)).toBe(true);
		expect(matchesQuery('Oﬃce', 'ffi', en)).toBe(true);
	});

	it('matches the other single-unit ligatures the collator equates', () => {
		// Measured, all 0 under base sensitivity in both locales: æ/ae, œ/oe, ﬁ/fi, ﬂ/fl, ﬀ/ff.
		expect(matchesQuery('Æther', 'aether', de)).toBe(true);
		expect(matchesQuery('Œuvre', 'oeuvre', de)).toBe(true);
	});

	it('matches an expansion that makes the query LONGER than the name', () => {
		// Measured, not assumed: base sensitivity treats `ß` and `ss` as equal, so a 6-unit
		// name is matched by a 7-unit query. A window sized from the query — and the
		// `needle.length > name.length` early return that came with it — rejected exactly this,
		// so a user typing the ordinary ASCII spelling of a street name found nothing.
		expect(matchesQuery('Straße', 'strasse', de)).toBe(true);
		expect(matchesQuery('Hauptstraße 12', 'hauptstrasse', de)).toBe(true);
	});

	it('matches the same expansion from the other side', () => {
		expect(matchesQuery('Strasse', 'straße', de)).toBe(true);
	});

	/**
	 * The expansion table's remaining rows, and each one kills a width bound an earlier round of
	 * this design believed in. `Aeon`/`æon` and `ﬃx`/`ffix` expand the NEEDLE rather than the
	 * span — the match is WIDER than the query that found it in the first and NARROWER in the
	 * second — and `Waffle`/`ﬄ` puts a 3-unit span at offset 2 under a 1-unit query.
	 *
	 * `Aeon` is genuinely a pass-2 case rather than an accident of the fixture: measured,
	 * `compare('Aeo', 'æon')` is -1 and `compare('eon', 'æon')` is 1, so pass 1's equal-width
	 * walk finds nothing and only the width-4 window at offset 0 answers.
	 */
	it('matches an expansion that changes the WIDTH of the span in either direction', () => {
		expect(matchesQuery('Aeon', 'æon', en)).toBe(true);
		expect(matchesQuery('Waffle', 'ﬄ', en)).toBe(true);
		expect(matchesQuery('ﬃx', 'ffix', en)).toBe(true);
	});

	/**
	 * The two compatibility characters that expand past ANY per-character cap: measured in node,
	 * `en` and `de` alike equate `㍿` with `株式会社` (1 unit against 4) and `ﷺ` with
	 * `صلى الله عليه وسلم` (1 against 18). A search capped above the Latin ligatures reports
	 * these as absent while the collator it was given recognises them as equal — which is why
	 * the WORK is bounded by a budget and the SEMANTICS are not bounded at all.
	 */
	it('matches a compatibility character no per-character cap would reach', () => {
		expect(matchesQuery('㍿ Renovierung', '株式会社', de)).toBe(true);
		expect(matchesQuery('Haus ﷺ Projekt', 'صلى الله عليه وسلم', de)).toBe(true);
	});

	it('still refuses a query that is genuinely absent, however long', () => {
		// The widened band must not turn into "matches anything": the guard against that is
		// that the collator, not the width, decides.
		expect(matchesQuery('Küche', 'badezimmer', de)).toBe(false);
		expect(matchesQuery('Straße', 'strosse', de)).toBe(false);
	});

	it('matches everything on an empty query', () => {
		// At rest the filter excludes nothing, so the count reads the vault's own total.
		expect(matchesQuery('Anything', '', en)).toBe(true);
		expect(matchesQuery('Anything', '   ', en)).toBe(true);
	});
});

/**
 * THE COST, which is the only thing that tells a bounded search from an unbounded one — every
 * correctness case above passes at any budget, including none, which is how four successive
 * budgets could have shipped without a single case going red.
 *
 * Both cases drive a MISS, because a miss is what runs pass 2 to exhaustion: it is every
 * keystroke of every query that does not match, on every row.
 */
describe('the expansion search’s budget', () => {
	/**
	 * The property stated without naming the budget: a bounded pass 2 costs the SAME for a long
	 * name as for a short one, so the whole difference between the two is pass 1's own linear
	 * walk. Measured on this tree — 438 comparisons against 478, a difference of exactly the 40
	 * units of extra name.
	 *
	 * Unbounded, the same pair is 820 against 3240: pass 2 is O(n²), so twice the name is four
	 * times the work and the difference is 2420 rather than 40. That is the mutation this case
	 * was watched failing against.
	 */
	it('costs the same for a longer name, because the budget bounds it rather than the name', () => {
		const short = countingCollator('en');
		const long = countingCollator('en');

		expect(matchesQuery('Ж'.repeat(40), 'zzz', short.collator)).toBe(false);
		expect(matchesQuery('Ж'.repeat(80), 'zzz', long.collator)).toBe(false);

		// 78 - 38: the two pass-1 walks. Everything past that is the one shared budget.
		expect(long.calls() - short.calls()).toBe(40);
	});

	/**
	 * The absolute half, on the 100-unit name the design named. Unbounded this is 5050
	 * comparisons — 91 in pass 1 and 4959 in pass 2 — for ONE row of ONE keystroke; bounded it
	 * is 491. The assertion is a ceiling rather than the exact figure, so a deliberate change to
	 * the budget is not a test edit while removing it outright still reddens by an order of
	 * magnitude.
	 */
	it('stops a hundred-unit name at the budget rather than running it to completion', () => {
		const { collator, calls } = countingCollator('de');

		expect(matchesQuery('Küche'.repeat(20), 'badezimmer', collator)).toBe(false);

		expect(calls()).toBeLessThan(600);
	});
});

describe('splitMatch', () => {
	it('returns one unmatched run for an empty query', () => {
		expect(splitMatch('Kitchen', '', en)).toEqual([{ text: 'Kitchen', matched: false }]);
	});

	it('splits around the matched run, preserving the NAME’s own characters', () => {
		// `Küche` must render with its umlaut even though the query that found it had none —
		// the highlight is a fact about where the match is, never a replacement for the text.
		expect(splitMatch('Küche', 'kuche', de)).toEqual([{ text: 'Küche', matched: true }]);
	});

	it('highlights the MATCHED SPAN, not the query’s length', () => {
		// `Straße` is six units and the query that found it is seven. Slicing by the query's
		// length would run past the end of the name — and on a longer name it would swallow a
		// character that did not match.
		expect(splitMatch('Straße 12', 'strasse', de)).toEqual([
			{ text: 'Straße', matched: true },
			{ text: ' 12', matched: false },
		]);
	});

	it('keeps the text either side of a mid-name match', () => {
		expect(splitMatch('House Renovation', 'reno', en)).toEqual([
			{ text: 'House ', matched: false },
			{ text: 'Reno', matched: true },
			{ text: 'vation', matched: false },
		]);
	});

	it('returns one unmatched run when nothing matches', () => {
		expect(splitMatch('Kitchen', 'zzz', en)).toEqual([{ text: 'Kitchen', matched: false }]);
	});
});
