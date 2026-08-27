import { describe, expect, it } from 'vitest';
import { declarationsOf, drawsAnIndicator } from '../helpers/indicators';

/**
 * WHAT A DECLARATION BLOCK LEAVES ON SCREEN, asked of one block and of nothing else.
 *
 * Split from `buttonFocusRing.test.ts` when that file reached its line budget — the third time this
 * seam has been cut and the same cut each time: `buttonSpecificity` gave up the flattening question,
 * `buttonFocusRing` gave up the cascade SIMULATION to `tests/helpers/focusCascade.ts`, and it now
 * gives up the VALUE cases here. What is left there is about a cascade — many rules, one element,
 * who wins; these are about a value — one block, read in order, does anything paint.
 *
 * The two must not be merged back on the grounds that both call into `indicators.ts`. A case here
 * can be settled by reading one block, and a case there cannot be settled without the others, which
 * is exactly the distinction `indicatorOf`'s `deferred` field exists to carry between them.
 */
describe('what a declaration block draws', () => {
	/**
	 * A CASCADE IS AN ORDER, and asking each declaration in isolation has none in it. Every block
	 * below leaves nothing on screen while its FIRST declaration, read alone, says a ring is drawn:
	 * a longhand overriding one component of the shorthand before it, and the same property written
	 * twice. Both are ordinary CSS, neither is exotic, and `some` accepted all of them.
	 */
	it.each([
		'outline: 2px solid red; outline-color: transparent',
		'outline: 2px solid red; outline-style: none',
		'outline: 2px solid red; outline-width: 0',
		'outline: 2px solid red; outline: none',
		'box-shadow: 0 0 0 3px red; box-shadow: none',
		// A component nobody sets takes its CSS INITIAL value, and `outline-style`'s is `none`. So a
		// block that sets only the colour, or only the width, paints nothing at all — the style
		// nobody wrote is still refusing.
		'outline-color: red',
		'outline-width: 2px',
		'outline-color: red; outline-width: 2px',
		// A `box-shadow` is painted OUTSIDE the border box and clipped inside it, so a shadow that
		// never reaches the edge draws nothing. With the offsets and the blur at zero the spread is
		// the only thing that can push it out, and a negative one pulls it in: this contracts a pixel
		// inside the box and paints nothing at all, while reading as a deliberate red ring. The test
		// was "not every component is zero", which catches `0 0 0 0` and credits this.
		'box-shadow: 0 0 0 -1px red',
		'box-shadow: 0 0 0 -0.5em red',
		// `inherit` is the one CSS-wide keyword whose value a stylesheet does not hold — it is the
		// PARENT's, and under a `.dialog { outline: none }` that is nothing. It fell through to the
		// `var()` arm, which credits an unknown as drawing, so a focus rule spelled this way answered
		// a flattened button with an indicator that is not there.
		'outline: inherit',
		'box-shadow: inherit',
		// `currentcolor` carries no numeric alpha, so it was assumed to paint — and this outline takes
		// its colour from a `color` that paints nothing. Solid, two pixels wide, and invisible.
		'color: transparent; outline: 2px solid currentColor',
		'outline: 2px solid currentColor; color: transparent',
		'color: transparent; outline-style: solid; outline-color: currentColor',
		// And the SHADOW takes its colour from the same place. The outline learned this a commit
		// before the shadow did, in this same reader, and the shadow was not swept for it then.
		'color: transparent; box-shadow: 0 0 0 3px currentColor',
		'box-shadow: 0 0 0 3px currentColor; color: transparent',
		// THE KEYWORD NEED NOT APPEAR AT ALL. `outline-color`'s initial IS `currentcolor`, so an
		// outline whose colour nobody sets is the same value spelled by omission — solid, medium, and
		// invisible over a transparent text colour.
		'color: transparent; outline-style: solid',
		'outline-style: solid; color: transparent',
		// `inherit` takes a colour NO STYLESHEET HOLDS, so a ring drawn in the keyword over it cannot be
		// credited — the same answer `outline: inherit` already gets, for the same reason. `unset` is
		// `inherit` on an inherited property, and `color: currentColor` is a self-reference CSS resolves
		// to the inherited value too, so all three land here.
		'color: inherit; outline: 2px solid currentColor',
		'color: unset; box-shadow: 0 0 0 3px currentColor',
		'color: currentColor; outline: 2px solid currentColor',
		// `color` IS ONE OF THE PROPERTIES `all` IS. Its arm reset the outline and the shadow and left
		// the text colour alone, so the ring drawn AFTER the reset resolved against a colour the reset
		// had already taken away.
		'all: unset; outline: 2px solid currentColor',
		// `all` is both properties at once, and its grammar admits only CSS-wide keywords — none of
		// which this gate can prove an indicator from. It arrives as its own parsed property rather
		// than as an unparsed keyword, so the `RESETS` path never saw it.
		'outline: 2px solid red; all: unset',
		'box-shadow: 0 0 0 3px red; all: revert',
	])('does not count %s as a ring', (declarations) => {
		expect(drawsAnIndicator(declarationsOf(declarations))).toBe(false);
	});

	/**
	 * And the other way down the cascade, or "resolve in order" has quietly become "the last
	 * declaration wins outright". A reset FOLLOWED by a real value draws; an important reset beats
	 * a later normal declaration wherever it was written, which is why `stylesheetRules` hands back
	 * normal declarations before important ones.
	 */
	it.each([
		['outline: none; outline: 2px solid red', true],
		['outline-color: transparent; outline: 2px solid red', true],
		['outline: 2px solid transparent; outline-color: red', true],
		['box-shadow: none; box-shadow: 0 0 0 3px red', true],
		['outline: none !important; outline: 2px solid red', false],
		['box-shadow: none !important; box-shadow: 0 0 0 3px red', false],
		// The other two initials go the opposite way: `medium` and `currentColor` both paint, so a
		// style on its own really does draw. Without these the initial-value fix could have been
		// "treat every absent component as blank", which refuses a legitimate ring.
		['outline-style: solid', true],
		// And a `currentcolor` outline over a colour that DOES paint is a ring, which is what keeps the
		// fix from becoming "never credit currentcolor".
		['color: red; outline: 2px solid currentColor', true],
		['outline: 2px solid currentColor', true],
		['color: red; box-shadow: 0 0 0 3px currentColor', true],
		// AND THE KEYWORD SET FOR `color` IS SHORTER than the outline's, which is the whole reason it is
		// a second set. `color` is inherited and its initial value PAINTS, so `initial` and `revert` name
		// real colours here while meaning "no ring" for `outline-style`. Reusing the outline's set blanks
		// both of these — a false positive, the direction this file may not err in either.
		['color: initial; outline: 2px solid currentColor', true],
		['color: revert; outline: 2px solid currentColor', true],
		// And `var()` is not an unknowable value but an unseen one, credited exactly as the outline's is.
		// This is the case that matters rather than the tidy one: refusing the whole unparsed class —
		// the literal shape of the report that prompted the keyword arm — would have filed all 36
		// `color: var(…)` declarations this project writes as blank and reported rings that are on screen.
		['color: var(--text-normal); outline: 2px solid currentColor', true],
		// The same keyword split reaches `all`, or the arm above has become "any `all` blanks the ring
		// drawn after it": `all: initial` sets `color` to a value that PAINTS.
		['all: initial; outline: 2px solid currentColor', true],
		// An inherited colour blanks only what DEPENDS on it. A ring that names its own colour is
		// untouched, or "unknowable colour" has become "unknowable ring".
		['color: inherit; outline: 2px solid red', true],
		['color: inherit; box-shadow: 0 0 0 3px red', true],
		// A block that never sets `color` INHERITS one no stylesheet holds, so the keyword is credited —
		// the same direction a `var()` takes. THREE readings of the keyword pass the two cases above and
		// this is the one that separates them: "credit unless proven transparent" from "credit only a
		// colour that paints". Its sibling separates the third, "credit only an UNSEEN colour". Both
		// were watched failing against exactly those.
		['box-shadow: 0 0 0 3px currentColor', true],
		// A shadow LIST decides PER ITEM. One flag for the whole declaration has to choose which item
		// it describes, and either choice is wrong for the other: this one is invisible in its first
		// shadow and three solid red pixels in its second.
		['color: transparent; box-shadow: 0 0 0 3px currentColor, 0 0 0 3px red', true],
		['outline-style: solid; outline-color: red', true],
		['outline: 2px solid red; outline-style: none; outline-style: solid', true],
		['all: unset; outline: 2px solid red', true],
	])('resolves %s to %s', (declarations, expected) => {
		expect(drawsAnIndicator(declarationsOf(declarations))).toBe(expected);
	});
});
