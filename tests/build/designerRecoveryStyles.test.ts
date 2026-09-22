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

/** The parsed value of every `align-self` the rule spelled `selector` declares, in source order. */
const alignSelfIn = (css: string, selector: string): unknown[] =>
	stylesheetRules(css)
		.filter((rule) => rule.selectors.some((one) => show(one) === selector))
		.flatMap((rule) => rule.declarations)
		.flatMap((declaration) => (declaration.property === 'align-self' ? [declaration.value] : []));

describe('the designer recovery partial', () => {
	/**
	 * The whole rule, as a LIST, so a declaration quietly added to it is a failure here rather
	 * than a surprise in a vault. The margins are the notice's own padding restated —
	 * `.rp-designer-notice` is `padding: var(--size-4-1) var(--size-4-2)` — and they are what puts
	 * the control under the sentence it answers instead of merely somewhere below it.
	 */
	it('opts the retry out of the shell column’s stretch, and sets all four margins', () => {
		expect(declaredBy(SHEET, `.${RETRY}`)).toEqual(['align-self', 'margin-block', 'margin-inline']);
		expect(alignSelfIn(SHEET, `.${RETRY}`)).toEqual([{ type: 'self-position', overflow: null, value: 'flex-start' }]);
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

		expect(alignSelfIn(strayed, `.${RETRY}`)).toEqual([]);
		expect(alignSelfIn(`.${RETRY}:focus-visible { align-self: flex-start }`, `.${RETRY}`)).toEqual([]);
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
