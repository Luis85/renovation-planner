import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classesNamed, propertyOf, show, stylesheetRules } from '../helpers/selectors';
import { buttonClasses } from '../helpers/buttonRules';

/**
 * `styles/designer-recovery.css` — card W22-A, ruling AD18-R15.
 *
 * **THE DECLARATION THIS FILE EXISTS FOR IS `align-self: flex-start`.** `.renovation-asset-designer`
 * is a column flex container that declares no `align-items`, so the initial `normal` behaves as
 * `stretch` and a direct child whose cross size is `auto` takes the whole leaf: the unclassed retry
 * button drew **1024 x 30 at `left: 0`** at a 1024 px leaf, reading as a second toolbar rather than
 * as an action. That opt-out is one word long, is the only reason the partial exists, and is
 * exactly the kind of line a later reader tidies as redundant.
 *
 * **What no check here — or anywhere in this repository — can see.** jsdom resolves no CSS, and no
 * fixture reaches this state: `tests/harness/page.ts` passes its `stale` knob to the PLAN EDITOR
 * branch only (`mountAssetDesignerHarness` takes `select`, `mode`, `draw`, `camera`, `pending`,
 * `grid` and `viewMenu`, and no stale knob), so there is no capture of the result and nothing below
 * asserts a rendered box. This reads DECLARATIONS. The measurement is an injected probe's.
 *
 * Read through `lightningcss` rather than through a regex, per `tests/helpers/selectors.ts` — which
 * is also why the value is compared against the parser's own typed node rather than against text.
 *
 * The import of `buttonRules` is load-bearing beyond the one case that names it: that module
 * throws at load unless `styles/index.css` imports every partial on disk, which is the check under
 * "the partial and its `@import` line cannot be separated". Nothing here restates it.
 */
const SHEET = readFileSync('styles/designer-recovery.css', 'utf8');
const RETRY = 'rp-designer-retry';

/**
 * The declarations of the rule whose selector is EXACTLY `selector`, from `css`.
 *
 * Exact rather than "any rule whose subject wears the class", which would fold
 * `.rp-designer-retry:focus-visible` in with the resting rule — and a declaration that applies only
 * while the control is focused is not one that applies. `show` renders the parsed selector, so the
 * comparison is against the parser's spelling and not against the file's whitespace.
 */
const declaredBy = (css: string, selector: string): string[] =>
	stylesheetRules(css)
		.filter((rule) => rule.selectors.some((one) => show(one) === selector))
		.flatMap((rule) => rule.declarations)
		.map((declaration) => propertyOf(declaration));

/**
 * The parsed value of every `property` the rule spelled `selector` declares, in source order.
 *
 * `unknown` rather than a lightningcss type, because the parser's node differs per property — a
 * `self-position` for `align-self`, a token list for an `outline` carrying a `var()`, and
 * `outline-offset` arriving as `custom` because lightningcss's grammar does not model it. Callers
 * compare against the shape they expect, which is what makes each comparison exact.
 */
const valuesOf = (css: string, selector: string, property: string): unknown[] =>
	stylesheetRules(css)
		.filter((rule) => rule.selectors.some((one) => show(one) === selector))
		.flatMap((rule) => rule.declarations)
		.flatMap((declaration) => (propertyOf(declaration) === property ? [declaration.value] : []));

describe('the designer recovery partial', () => {
	/**
	 * The whole rule, as a LIST, so a declaration quietly added to it is a failure here rather
	 * than a surprise in a vault. The margins are the notice's own padding restated —
	 * `.rp-designer-notice` is `padding: var(--size-4-1) var(--size-4-2)` — and they are what puts
	 * the control under the sentence it answers instead of merely somewhere below it.
	 */
	it('opts the retry out of the shell column’s stretch, and sets all four margins', () => {
		expect(declaredBy(SHEET, `.${RETRY}`)).toEqual(['align-self', 'margin-block', 'margin-inline']);
		expect(valuesOf(SHEET, `.${RETRY}`, 'align-self')).toEqual([{ type: 'self-position', overflow: null, value: 'flex-start' }]);
	});

	/**
	 * **THE FOCUS RING WAS GUARDED BY NOTHING until this case, and that was measured rather than
	 * suspected**: deleting the whole `:focus-visible` rule left this file, `buttonFocusRing` and
	 * `focusReach` green — 282 tests across four files. `declaredBy` filters on the EXACT selector,
	 * deliberately, so the case above never sees this rule; `classesNamed` is satisfied by the
	 * resting one; and the two focus scans only require a ring on a FLATTENED button, which this is
	 * not, since nothing here suppresses Obsidian's `box-shadow`.
	 *
	 * What the rule is for, and therefore what each assertion protects: Obsidian's own
	 * `button:focus-visible` shadow measures 2.29:1 dark and 1.88:1 light (`styles/forms.css`),
	 * under WCAG 1.4.11's 3:1, against `--interactive-accent`'s 4.00:1 and 3.43:1. Swapping the
	 * token, dropping the rule or turning the offset negative each reddens a different line here.
	 *
	 * `2` and not `-2`: the offset is POSITIVE because the margin insets the button and leaves room
	 * for a ring outside it. Both spellings are live in this project — six designer rules use `1px`
	 * and four use `-2px` — so the value is asserted rather than left to whichever a reader copies.
	 */
	it('rings its own focus with the accent token, at a positive offset', () => {
		const focus = `.${RETRY}:focus-visible`;

		expect(declaredBy(SHEET, focus)).toEqual(['outline', 'outline-offset']);
		// A `custom` declaration's value carries its own `name`, which is why this is not a bare
		// token list the way `outline`'s is.
		expect(valuesOf(SHEET, focus, 'outline-offset')).toEqual([
			{ name: 'outline-offset', value: [{ type: 'length', value: { unit: 'px', value: 2 } }] },
		]);
		// `outline` arrives UNPARSED — a `var()` anywhere in a value stops lightningcss folding it
		// into a typed node — so the token list is under `value`, and the token that matters is the
		// variable reference. `arrayContaining` rather than the whole list: the width and the style
		// beside it are not what this case is about.
		expect(valuesOf(SHEET, focus, 'outline')).toEqual([
			{
				propertyId: { property: 'outline' },
				value: expect.arrayContaining([
					{ type: 'var', value: { name: { ident: '--interactive-accent', from: null }, fallback: null } },
				]) as unknown,
			},
		]);
	});

	/**
	 * THE INSTRUMENT, before its answers are trusted. `align-self` on some OTHER subject in the
	 * same sheet must not satisfy the case above — which is the shape `continueRowStyles.test.ts`
	 * guards against by hand and that reading a rule's own body gets for free. Asserted rather
	 * than assumed, because a reader that folded the two rules together would look identical and
	 * would pass the case above off the `:focus-visible` rule the day the resting one lost its
	 * declaration.
	 */
	it('does not answer for one subject out of another rule’s body', () => {
		const strayed = `.${RETRY} { margin-block: 0 } .rp-designer-notice { align-self: flex-start }`;

		expect(valuesOf(strayed, `.${RETRY}`, 'align-self')).toEqual([]);
		expect(valuesOf(`.${RETRY}:focus-visible { align-self: flex-start }`, `.${RETRY}`, 'align-self')).toEqual([]);
		// And the other way: the RESTING rule must not answer for the focus one either, which is
		// the arm that matters now that a real `:focus-visible` rule sits beside it.
		expect(declaredBy(`.${RETRY} { outline: 2px solid var(--interactive-accent) }`, `.${RETRY}:focus-visible`)).toEqual([]);
	});

	/**
	 * BOTH ENDS OF THE HOOK, because a rename breaks one at a time and neither end can see the
	 * other. The partial declares exactly one class, and that class is one this project actually
	 * puts on a `<button>` — `buttonClasses` reads every `<button>` tag under `src/presentation`
	 * and `src/prototypes`, so a rule left behind by a renamed attribute reaches nothing and is
	 * reported here rather than rendering as the stretched bar this card removed.
	 */
	it('declares one class, and it is one the project puts on a button', () => {
		expect([...classesNamed(SHEET)]).toEqual([RETRY]);
		expect(buttonClasses().has(`.${RETRY}`)).toBe(true);
	});
});
