import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * `styles/project-list-narrow.css` — the Home surface's narrow composition, split out of
 * `project-list.css` in Task D when that file hit the 400-line cap for the third time.
 *
 * jsdom resolves no CSS and lays nothing out, so nothing here measures a width, a wrap or a
 * position: whether the row actually becomes two lines at 460px is settled by a capture. What
 * this asserts is that the sheet DECLARES the mechanism — a class whose rule is one word off
 * renders the base look with every mounted test green, which is the defect this repository has
 * already shipped once (`rp-save-state-error` against an emitted `rp-save-state-save-error`).
 *
 * It also inherits `.rp-project-row` from `projectListStyles.test.ts`'s list, which stopped
 * being declared in that sheet when this block left it. A name dropped from one list and added
 * to no other is a name nothing checks, which is the failure `harness-shot.test.ts`'s own
 * fixed-shot list turned out to have.
 *
 * **COMMENTS STRIPPED, and here that is a LIVE instrument rather than a precaution** — which is
 * measured rather than borrowed from the sibling files' weaker claim. This sheet's prose names
 * `.rp-project-row` in three separate paragraphs, so renaming that class out of every SELECTOR
 * in the file leaves the first case below GREEN when the strip is removed and turns it RED when
 * it is there. Both halves were run rather than reasoned: 4 of 11 cases red with the strip, 3 of
 * 11 without it, and the case that changes is the one this paragraph is about.
 */
const RULES_ONLY = /\/\*[\s\S]*?\*\//gu;
const sheet = readFileSync('styles/project-list-narrow.css', 'utf8').replace(RULES_ONLY, '');

/** A rule's own body, so a declaration elsewhere in the file cannot satisfy an assertion about it. */
const bodyOf = (selector: string): string => {
	const start = sheet.indexOf(`${selector} {`);

	expect(start, `${selector} is declared`).toBeGreaterThan(-1);
	return sheet.slice(start, sheet.indexOf('}', start));
};

const declaresClass = (cls: string): boolean => new RegExp(String.raw`\.${cls}(?![\w-])`, 'u').test(sheet);

describe('project-list-narrow.css', () => {
	/**
	 * The classes this sheet NARROWS. It owns none of them exclusively and that is the point —
	 * it is a STATE rather than a region, so every name here is declared somewhere else too and
	 * this file is what changes at width. `.rp-project-row` is in the list because this sheet is
	 * now its only bare declarer.
	 */
	it('addresses every class its narrow composition moves', () => {
		for (const cls of [
			'rp-project-list',
			'rp-project-row',
			'rp-continue',
			'rp-project-list__name',
			'rp-project-row__facts',
			'rp-project-row__status',
			'rp-project-row__status-word',
			'rp-project-row__ticks',
			'rp-project-list__overlap',
		]) {
			expect(declaresClass(cls), `.${cls} is addressed as a class of its own`).toBe(true);
		}
	});

	/**
	 * The instrument, before its results are trusted — both halves, since either one silently
	 * turns every entry above into a pass that proves nothing.
	 */
	it('does not read a longer class as the shorter one it starts with', () => {
		expect(new RegExp(String.raw`\.rp-project-row(?![\w-])`, 'u').test('.rp-project-row__facts {')).toBe(false);
	});

	it('reads a class named in prose as prose, not as a declaration', () => {
		expect('/* mentions .rp-gone here */\n'.replace(RULES_ONLY, '')).toBe('\n');
	});

	/**
	 * A CONTAINER query, never a media query. The pane's width is the leaf's, not the window's;
	 * a media query asks the wrong element, and it is a mistake that looks correct at 1280 and
	 * only at 1280. Moved here from `projectListStyles.test.ts` with the block it is about.
	 */
	it('narrows inside a CONTAINER query, not a media query', () => {
		expect(sheet).toContain('@container rp-project-list');
		expect(sheet).not.toContain('@media');
	});

	/**
	 * BOTH halves of the container declaration, because a `container-name` without a
	 * `container-type` establishes no containment at all — the query would then match nothing
	 * and every row would stay on one line at every width, silently, with this file's other
	 * cases still green.
	 */
	it('establishes the container it queries by name AND by type', () => {
		const body = bodyOf('.rp-project-list');

		expect(body).toContain('container-type: inline-size');
		expect(body).toContain('container-name: rp-project-list');
	});

	/**
	 * The threshold is in `rem`. It has to follow the user's interface font size, because both
	 * halves of the sum it was derived from — the name's room and the trailing group's — move
	 * with it; a `px` threshold is one root size's answer frozen as a constant.
	 */
	it('states its threshold in rem, so it follows the interface font size', () => {
		expect(sheet).toMatch(/@container rp-project-list \(max-width: \d+rem\)/u);
	});

	/**
	 * THE DERIVATION MUST PRODUCE THE NUMBER BESIDE IT, which is the one property a recorded
	 * arithmetic has that a bare number does not — and the first version of this sheet did not
	 * have it. It wrote `32 + 2 × 314.5 = 661px → 42rem`, reading 32 as the row's padding plus
	 * BOTH its gaps, while the 314.5 already itemises the facts↔status gap: one 8px paid twice.
	 * The rule's real output is 653px → 41rem. The shipped 42rem was harmless in pixels and not
	 * harmless in the record, because a reader who does what the file asks — re-derive rather
	 * than trust — gets a different number and concludes the file is wrong. Found in review.
	 *
	 * Read off the RAW text on purpose: the derivation lives in a comment, which is exactly what
	 * every other case in this file strips, so this is the one question that has to ask the
	 * unstripped file. Watched failing against the 42rem pairing before being trusted.
	 */
	/**
	 * EVERY RECORDED SUM MUST EQUAL ITSELF, and this case exists because the narrower one below
	 * has a demonstrated blind spot rather than a theoretical one.
	 *
	 * That case pulls the threshold out of a line shaped `… = Npx → N.Nrem → Nrem`, so its regex
	 * requires TWO arrows — and one commit after it landed, the paragraph EXPLAINING it shipped
	 * `16 + 8 + 2 × 284.0 = 584px → 37rem`, which is 592 and carries one arrow. The identical
	 * defect class, reintroduced in the prose about the correction, one arrow short of the
	 * instrument built for it. Found in review.
	 *
	 * So this asks the question that does not depend on the shape of the line: any expression of
	 * numbers joined by `+` and `×` and followed by `= n` is evaluated, and `n` must be the real
	 * sum.
	 *
	 * **It would NOT have caught the original 42rem defect, and the review round that asked for
	 * this case said it would.** Measured rather than accepted: that line was
	 * `32 + 2 × 314.5 = 661px → 41.3rem → 42rem`, and 32 + 629 IS 661, and 661px IS 42rem once
	 * rounded up, and 42rem is what shipped. Every mechanical check here passes on it. Its error
	 * was in the MODEL — 32 was the wrong overhead, because it counted a gap the 314.5 already
	 * contained — and no arithmetic checker can see a wrong premise. So the two cases in this
	 * file cover a wrong SUM and a wrong TRANSCRIPTION between the derivation and the shipped
	 * rule; a wrong MODEL is caught by a reader re-deriving it from the layout, which is exactly
	 * how that one was caught. Written down because the alternative is a later reader trusting
	 * these two to cover a class they do not reach.
	 *
	 * **What it deliberately does NOT ask**: that every number in the sheet be derivable. A
	 * rounded figure, a measured one and an illustrative example are not arithmetic, and forcing
	 * them to balance would make the sheet's prose unwritable. An `=` with a sum on its left is
	 * the whole of the rule. Two lines here are correctly outside it and are the reason the rule
	 * is spelled this way: `→ 40.8rem → 41rem` is a ROUNDING rather than a sum, and `32 + 2 ×
	 * 314.5` is quoted with no result at all, being the erroneous version this file names.
	 *
	 * **Scoped to this sheet**, which is the one whose header is a derivation. Measured with this
	 * same pattern rather than assumed: it finds **0** in `project-list.css` and **0** in
	 * `project-filter.css`, and exactly the **3** below here. Extending the scan is one more path
	 * in an array on the day a sibling grows one.
	 */
	it('balances every arithmetic derivation it records', () => {
		const raw = readFileSync('styles/project-list-narrow.css', 'utf8');
		const term = String.raw`[\d.]+(?:px)?(?:\s*×\s*[\d.]+(?:px)?)*`;
		const sums = new RegExp(String.raw`(${term}(?:\s*\+\s*${term})+)\s*=\s*([\d.]+)`, 'gu');
		const found = [...raw.matchAll(sums)];

		// A widened pattern that matches nothing passes silently and is worse than no test at
		// all. Three derivations are recorded here today — the strip's width, the threshold, and
		// the counter-example the 16ch paragraph works through — so a pattern that stops reaching
		// them fails HERE rather than going quiet.
		expect(found.length, 'the scan reaches the derivations this sheet records').toBeGreaterThanOrEqual(3);

		for (const [, expression, stated] of found) {
			const sum = expression
				.split('+')
				.reduce((total, addend) => total + addend
					.split('×')
					.reduce((product, factor) => product * Number.parseFloat(factor), 1), 0);

			expect(sum, `${expression.replace(/\s+/gu, ' ').trim()} = ${stated}`).toBeCloseTo(Number.parseFloat(stated), 5);
		}
	});

	it('ends its recorded derivation on the threshold it actually ships', () => {
		const raw = readFileSync('styles/project-list-narrow.css', 'utf8');
		const shipped = /@container rp-project-list \(max-width: (\d+)rem\)/u.exec(raw)?.[1];
		const derived = /=\s*\d+px\s+→\s*[\d.]+rem\s+→\s*(\d+)rem/u.exec(raw)?.[1];

		expect(shipped, 'the container query states a whole-rem threshold').toBeDefined();
		expect(derived, 'the comment carries an arithmetic ending in a whole-rem answer').toBeDefined();
		expect(derived).toBe(shipped);
	});

	/**
	 * **THE SAME INSTRUMENT, ONE DOCUMENT FURTHER.** The case above holds this sheet's own
	 * derivation against this sheet's own rule; the design spec states the number a THIRD time
	 * (§6's amendment and §13's constraint 3), and until this case existed nothing compared it
	 * to anything. That is the count-in-two-places defect this repository keeps paying for, on
	 * a number that has already moved three times — 34rem placeholder, 36rem measured, 42rem,
	 * 41rem — and each move had to be transcribed by hand into a document no gate reads.
	 *
	 * **THIS IS THE FIRST TEST IN THIS SUITE THAT READS `docs/`, and the rule it bends is
	 * stated rather than skirted.** CLAUDE.md's testing section says `docs/` is user land and
	 * that the suite must not depend on paths somebody reorganises while writing notes — which
	 * is why the walkthrough fixtures are tracked twice, in `docs/tests/fixtures/` AND in
	 * `tests/fixtures/`. That reasoning is about FIXTURES a case needs. It does not reach a
	 * design CONTRACT, which is already referenced by path from CLAUDE.md, from the plan, from
	 * every task brief and from the manual case: a move that leaves those five pointers dangling
	 * is a defect, and a red test naming the file is a better way to find out than five silent
	 * links. Duplicating the spec into `tests/` would be the fixtures' remedy applied to a
	 * document whose whole value is that there is one of it.
	 *
	 * Guarded at both ends, because a regex over prose is the instrument this file already
	 * records going quiet: the read fails loudly if the document has moved, and BOTH matches
	 * must be found before either is compared. The two sentences are asserted separately rather
	 * than by one sweep, so a build that amends one and forgets the other fails at the one it
	 * forgot rather than passing on the one it remembered.
	 *
	 * **WHAT IT HOLDS IS TWO SENTENCES, NOT "everywhere the spec states the number", and the
	 * name said the second for a review round.** Measured: `grep -n "41rem"` over that document
	 * prints **ten** lines, of which **four** state the threshold normatively — §6's derivation
	 * (the arithmetic this case's first regex reads), §6's own amendment sentence naming it, §13's
	 * constraint 3 (the second regex), and the §16 amendment table row. The other six are prose
	 * ABOUT the number — a risk note, a translation warning — which a sweep would have to tell
	 * apart from a statement of it, and cannot. So this case pins the two that carry a
	 * DERIVATION or a RULE, and the remaining two normative sites are held by a reader.
	 *
	 * **Neither regex is anchored to its SECTION**, which is the other half of the same
	 * narrowing: the first matches an arithmetic SHAPE (`… → N.Nrem → Nrem`) and would read a
	 * §13 arithmetic of that shape just as happily if §6's were deleted. Anchoring means
	 * splitting the document on its headings, which is a second parser over prose — and this
	 * file's own record is that a regex over prose goes quiet rather than loud. Stated rather
	 * than closed, so the guarantee is not read wider than the check.
	 */
	it('agrees with the threshold stated by the spec’s derivation and by its constraint 3', () => {
		const path = 'docs/user-experience/archive/renovation-planner-home-DESIGN-SPEC.md';
		const shipped = /@container rp-project-list \(max-width: (\d+)rem\)/u
			.exec(readFileSync('styles/project-list-narrow.css', 'utf8'))?.[1];

		expect(shipped, 'the container query states a whole-rem threshold').toBeDefined();

		let spec: string;

		try {
			spec = readFileSync(path, 'utf8');
		} catch {
			throw new Error(`${path} is the contract this sheet implements and could not be read`);
		}

		// §6's amendment, which carries the arithmetic, and §13's constraint 3, which carries the
		// rule a builder must not move the number without. Two distinct sentences, one number.
		const stated = [
			/→\s*[\d.]+rem\s*→\s*(\d+)rem/u.exec(spec)?.[1],
			/it is `(\d+)rem`, and it comes from a DERIVATION/u.exec(spec)?.[1],
		];

		// "both sentences", not "both sections": the regexes match a derivation SHAPE and a
		// constraint's wording, neither anchored to a heading, which the docblock records.
		expect(stated.filter((value) => value !== undefined), `${path} states the threshold in both sentences`)
			.toHaveLength(stated.length);
		for (const value of stated) expect(value).toBe(shipped);
	});

	/**
	 * THE PAIR that makes a wrapped row readable, and either alone is the defect Task 12's first
	 * capture found. `height: auto` releases Obsidian's fixed `--input-height` on the `<button>`,
	 * without which the content wraps and the BOX does not — 41px of content in a 30px box, each
	 * row's second line drawn over the next row's name. `justify-content: flex-start` makes the
	 * second line one phrase instead of putting the status and the facts at opposite edges of
	 * the pane, 280px apart.
	 */
	it('lets the wrapped row grow and packs its second line as one phrase', () => {
		const body = bodyOf('.rp-project-list .rp-project-row');

		expect(body).toContain('height: auto');
		expect(body).toContain('justify-content: flex-start');
	});

	/**
	 * THE RESERVED COLUMNS ARE RELEASED. Task D gives the facts slot and the status word a
	 * `min-width` in `ch` so they form columns on the wide row; at narrow the row is two lines
	 * and a reserved column aligns nothing a reader can follow — it only pushes the phrase apart.
	 *
	 * `auto` rather than `0`, because `auto` is the INITIAL value for a flex item's `min-width`:
	 * this restores exactly what those slots had before the armature existed rather than
	 * substituting a zero of its own.
	 */
	it('releases the wide row reserved columns rather than zeroing them', () => {
		const body = bodyOf('.rp-project-list .rp-project-row .rp-project-row__facts,\n\t.rp-project-list .rp-project-row .rp-project-row__status-word');

		expect(body).toContain('min-width: auto');
		expect(body).not.toContain('min-width: 0');
	});

	it('drops the tick strip', () => {
		expect(bodyOf('.rp-project-list .rp-project-row__ticks')).toContain('display: none');
	});

	/**
	 * THE ORDER RULES ARE SCOPED TO `.rp-project-row`, and the qualifier is load-bearing rather
	 * than tidy: `ContinueRow` reuses `.rp-project-row__facts` for its date, so an unqualified
	 * rule would give that date `order: 2` while that row's own status and its two buttons kept
	 * the default 0 — stranding the date after the controls.
	 *
	 * The WRAP rule deliberately includes `.rp-continue` and the ordering deliberately does not,
	 * so both halves are asserted: a build that scoped the wrap too would stop that row wrapping
	 * at all, and one that unscoped the order would rearrange it.
	 */
	it('scopes the second-line ordering to the project row and the wrapping to both rows', () => {
		expect(sheet).toContain('.rp-project-list .rp-project-row .rp-project-row__status {');
		expect(sheet).toContain('.rp-project-list .rp-continue {');
		expect(sheet).not.toMatch(/^\t\.rp-project-list \.rp-project-row__facts \{/mu);
	});

	it('is assembled into the shipped sheet', () => {
		expect(readFileSync('styles/index.css', 'utf8')).toContain('project-list-narrow.css');
	});
});
