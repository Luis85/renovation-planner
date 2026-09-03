/**
 * The Home surface's filter: name matching and the runs a highlight is drawn from
 * (design spec §7).
 *
 * **Name only.** The spec's §14 left "should the filter also match the status word" open and it
 * is settled as no: typing `design` finding every project in the Design stage is useful and it
 * makes `2 of 4` ambiguous about which field matched. Revisit when a vault has enough projects
 * for stage filtering to be the faster path.
 *
 * **A COLLATOR rather than `toLowerCase`**, and the difference is the requirement rather than a
 * refinement: a German vault must match `Küche` when the user types `kuche`, and
 * `'küche'.includes('kuche')` is false. `Intl.Collator` at `sensitivity: 'base'` treats a base
 * letter, its case variants and its accented forms as equal — which is also what orders the
 * list, so one instrument answers both and they cannot disagree about two strings.
 *
 * The collator is a PARAMETER for the reason `projectOrder`'s is: the language may not be
 * resolved here, and a node test drives German directly.
 *
 * Everything below is ordered definition-before-use because `no-use-before-define` is on in
 * `.oxlintrc.json` — the public pair sits at the foot of the file rather than at its head.
 */

/**
 * How many collation comparisons pass 2 may spend on ONE name for ONE query. Generous by two
 * orders of magnitude against every measured real case (the worst was 61 — `Haus ﷺ Projekt`
 * against the whole Arabic phrase `ﷺ` expands to), and the only thing standing between a
 * Unicode-heavy name and a quadratic scan on every keystroke.
 */
const EXPANSION_SEARCH_BUDGET = 400;

/**
 * PASS 2: every width EXCEPT the needle's own, shortest first at each position, until the
 * budget runs out.
 *
 * A function of its own rather than a second nest inside `findMatch`, which is a real
 * constraint here rather than tidiness: the two loops plus three guards put `findMatch` over
 * `npm run analyze`'s cognitive-complexity threshold (16 against 15, measured), and the split
 * also gives pass 2 a name, which is what lets `findMatch` read as the two passes it is.
 *
 * It takes the PREDICATE rather than the collator so the slice-and-compare is written once and
 * both passes are provably asking the same question.
 */
function findExpandedSpan(
	name: string,
	needleLength: number,
	equals: (at: number, width: number) => boolean,
): { at: number; width: number } | null {
	let budget = EXPANSION_SEARCH_BUDGET;
	for (let at = 0; at < name.length; at += 1) {
		for (let width = 1; at + width <= name.length; width += 1) {
			if (width === needleLength) continue; // pass 1 tried it
			if (budget-- <= 0) return null;
			if (equals(at, width)) return { at, width };
		}
	}
	return null;
}

/**
 * The earliest, shortest span of `name` the collator considers equal to `query`, or `null`.
 *
 * A window walk rather than `String.prototype.includes`, because `includes` compares code units
 * and the whole point here is that it must not. The alternative — normalizing both sides with
 * `normalize('NFD')` and stripping combining marks — hard-codes one script's idea of what an
 * accent is, and the collator is already the thing this repository resolves per language.
 *
 * **The window's WIDTH VARIES, and that is not a refinement — it is the difference between
 * working and not working in German.** Base sensitivity treats `ß` and `ss` as equal, so a
 * 6-unit name is matched by a 7-unit query: measured in node, not assumed —
 * `new Intl.Collator('de', { sensitivity: 'base' }).compare('Straße', 'Strasse')` is `0`, and
 * the `'en'` collator answers `0` too. A window sized from the query, and the
 * `needle.length > name.length` early return that came with it, rejected exactly that — so a
 * user typing the ordinary ASCII spelling of a street name found nothing. That is the failure
 * the collator was chosen to prevent, arriving through the search that uses it.
 *
 * **There is NO ratio bound.** Measured, in `de` and `en` alike:
 *
 * ```
 * compare('ﬃ', 'ffi')  // 0   — ONE code unit equals THREE
 * compare('æ', 'ae')   // 0   — and so do ﬁ/fi, ﬂ/fl, ﬀ/ff, œ/oe
 * compare('ä', 'ae')   // -1  — the pair a bound derived from one example rested on
 * ```
 *
 * So `Oﬃce` typed as `office` needs a 1-unit window against a 6-unit query, which a `minWidth`
 * of 3 never tries — and `㍿`/`株式会社` (1 against 4) and `ﷺ`/`صلى الله عليه وسلم` (1 against
 * 18) walk past any per-character cap at all. A search that skips those widths reports a match
 * the collator itself recognises as ABSENT, so the WORK is bounded instead of the semantics.
 *
 * **TWO PASSES, so removing the bound does not make this a scan.** The first tries the
 * no-expansion width at every position — the overwhelmingly common case, and O(name.length).
 * Only when that finds nothing does the second walk every other width, bounded by a flat budget
 * of collator calls that makes NO claim about Unicode. Measured by instrumenting this module's
 * own collator, not derived on paper: `Straße`/`strasse` costs 6 calls, `Aeon`/`æon` 5,
 * `ﬃx`/`ffix` 2, `㍿ Renovierung`/`株式会社` 11, `Waffle`/`ﬄ` 17, and
 * `Haus ﷺ Projekt` against that whole Arabic phrase 61 — every realistic case two orders of
 * magnitude inside the budget, while a 40-unit all-Cyrillic name against an absent ASCII query
 * stops at the budget rather than running to O(name.length²).
 *
 * **What the budget costs, stated plainly**: a name long enough to exhaust it can miss an
 * expansion match a slower search would have found. That is a miss, never a crash, and it is
 * the only honest trade available — the alternative is a width cap that is wrong for some
 * character nobody has thought of yet.
 *
 * **What the two-pass ORDER costs**: the first pass wins even when an expansion match starts
 * EARLIER in the name, so the highlight can land on the later of two genuine matches. Cosmetic
 * — both are real matches and the row is shown either way — and the alternative is paying the
 * quadratic pass on every keystroke to place a highlight.
 */
function findMatch(
	name: string,
	query: string,
	collator: Intl.Collator,
): { at: number; width: number } | null {
	const needle = query.trim();
	if (needle.length === 0) return { at: 0, width: 0 };

	const equals = (at: number, width: number): boolean =>
		collator.compare(name.slice(at, at + width), needle) === 0;

	// Pass 1: no expansion. Case and diacritics still differ, which is why it is the collator
	// answering rather than `includes`.
	for (let at = 0; at + needle.length <= name.length; at += 1) {
		if (equals(at, needle.length)) return { at, width: needle.length };
	}

	// Pass 2 exists only for collation expansions, and it runs on every MISS — which is every
	// keystroke of every query that does not match, on every row. Hence the budget.
	return findExpandedSpan(name, needle.length, equals);
}

/** Whether `query` occurs anywhere in `name`. An empty or blank query matches everything. */
export function matchesQuery(name: string, query: string, collator: Intl.Collator): boolean {
	return findMatch(name, query, collator) !== null;
}

/**
 * `name`, split into runs, with the matched one flagged — never a pre-rendered string.
 *
 * The runs carry the NAME's own characters rather than the query's: a `Küche` found by typing
 * `kuche` still renders with its umlaut, because the highlight is a statement about WHERE the
 * match is and not a replacement for the text. Returning runs rather than HTML is also what
 * keeps this free of any markup a template would then have to trust.
 */
export function splitMatch(
	name: string,
	query: string,
	collator: Intl.Collator,
): readonly { text: string; matched: boolean }[] {
	const found = query.trim().length === 0 ? null : findMatch(name, query, collator);
	if (found === null) return [{ text: name, matched: false }];

	const runs = [];
	if (found.at > 0) runs.push({ text: name.slice(0, found.at), matched: false });
	// The MATCHED SPAN, never the query's length — the two differ whenever the collation
	// expanded something (`Straße` matched by `Strasse` is a 6-unit span found by a 7-unit
	// query), and slicing by the query's length would highlight past the run that matched.
	runs.push({ text: name.slice(found.at, found.at + found.width), matched: true });
	if (found.at + found.width < name.length) {
		runs.push({ text: name.slice(found.at + found.width), matched: false });
	}
	return runs;
}
