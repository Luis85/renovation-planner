import { propertyOf, stylesheetRules } from './selectors';
import type { Declaration } from 'lightningcss';

/**
 * What a declaration block DRAWS, read through the parser rather than through a value vocabulary.
 *
 * A sibling to `selectors.ts` and the same argument: a CSS value is a grammar. This one answers
 * one question — does this block leave a visible focus indicator — and it has been wrong six
 * times. The first four were one mistake, written as a list of spellings that mean "nothing":
 *
 * - it refused the literal `none` and accepted `outline: 0`, `initial`, `unset`, `revert`
 * - it accepted `outline: 0 solid red`, whose width is zero and whose other components read as
 *   deliberate values
 * - it accepted `outline: 2px solid transparent`, and `box-shadow: 0 0 0 3px transparent`, and
 *   `box-shadow: 0 0 0 0 red` — a shadow exactly the size of the box with no blur to spill past it
 * - it asked each declaration in ISOLATION, so `outline: 2px solid red; outline-color: transparent`
 *   passed on the strength of a declaration the next line overrides
 *
 * The first three are answered by asking the parser instead of a list: every spelling of a fully
 * transparent colour folds to one node, and `outline: none` and `outline: 0` both resolve their
 * style to `none`. The fourth is not a parsing question at all — it is an ORDER — and it is why
 * this module resolves a block rather than filtering it.
 *
 * The last two are a DIFFERENT mistake and are the more interesting pair, because the second was
 * this file's own answer to the first, applied to one of the two properties that needed it:
 *
 * - it credited `color: transparent; outline: 2px solid currentColor`, whose colour is a reference
 *   to another property rather than a value at all
 * - it went on crediting `color: transparent; box-shadow: 0 0 0 3px currentColor`, because the fix
 *   was made where the report pointed and the neighbouring property was never swept for it
 *
 * That second one is this reader's THIRD neighbour-shaped miss — `all`, then the outline's initial
 * values, now `currentcolor` — so the rule it teaches is worth stating where the code is: a fix to
 * one value reader is not applied until every reader of that value has been looked at.
 */

/**
 * Does this rule DRAW a focus indicator?
 *
 * Read from the PARSED declaration rather than from the rule's text. Presence of `:focus-visible`
 * in the selector was the whole test once, and presence is not effect: deleting `outline: 2px
 * solid …` while leaving `outline-offset` kept the rule, kept this check green, and left keyboard
 * focus invisible. Then the text version refused only the literal `none`, while `outline: 0`,
 * `initial`, `unset` and `revert` draw nothing either.
 *
 * The parser answers both without a value vocabulary of this file's own. `outline: 0` and
 * `outline: none` both arrive with `style` resolved to `none`, so ONE question — is the line
 * style something other than `none` — covers the whole family, including the zero width that
 * reads as a deliberate value rather than a switch-off. `box-shadow` arrives as a list.
 *
 * **An UNPARSED value is one the parser could not resolve, which here means it holds `var()`** —
 * the shape almost every real rule in this project takes. A value that is a single bare keyword
 * is a reset; anything else draws, because what a variable holds is outside what any gate here
 * can see. That is the same ceiling the specificity check declares, stated rather than implied.
 */
const NOT_KNOWN_TO_PAINT = new Set(['none', 'initial', 'unset', 'revert', 'revert-layer', 'inherit']);

/**
 * Is this line style one an OUTLINE may take at all?
 *
 * `hidden` is a `border-style` value and CSS UI explicitly excludes it from `<outline-line-style>`,
 * so `outline-style: hidden` and `outline: 2px hidden red` are INVALID declarations. lightningcss
 * parses both — it resolves `hidden` to an ordinary `line-style` — which is a tolerance of the
 * parser rather than a fact about CSS, and the reader took it at its word: every style but `none`
 * counted as drawing, so a focus rule that paints nothing satisfied the gate.
 *
 * DROPPED, NOT READ AS `none`, and the difference is a case rather than pedantry. A browser
 * discards an invalid declaration whole, so `outline: 2px hidden red` sets no width and no colour
 * either — and, crucially, changes nothing about a rule it outranks. Read as `none` it would file a
 * BLANK style that wins the longhand, so a more specific `outline: 2px hidden blue` would disqualify
 * a perfectly visible `outline: 2px solid red` beneath it and the gate would fail correct CSS.
 * Dropping leaves the earlier ring winning, which is what the browser draws.
 */
const paintableOutlineStyle = (style: { readonly value?: unknown }): boolean => style.value !== 'hidden';

/**
 * Is this a length the parser resolved to exactly zero?
 *
 * THE NUMBER ONLY, NEVER THE UNIT, and that is a ceiling worth naming beside the `currentcolor` one
 * above rather than left to be rediscovered. A font-relative length REFERS to another property the
 * same way the keyword does: `outline: 2em solid red` under a `font-size: 0` computes to a
 * zero-width outline, and this reads `2` and answers "draws". Percentages, `vw` and `rem` are worse
 * still — they resolve against the parent, the viewport and the root, none of which a stylesheet
 * holds at all.
 *
 * NOT built as a fifth cascade channel, and the measurement is of the risk rather than beside it:
 * the exposure needs a font-relative indicator length AND a computed-zero font size, and this
 * project has NEITHER — no `em`/`ex`/`ch`/`rem` in any `outline` or `box-shadow`, no `font-size: 0`,
 * and all 25 `font-size` declarations are `var(…)`, which is unparsed and so unknowable anyway.
 * The deciding difference from `currentcolor` is not the count though: `color` resolves on the
 * element ITSELF, which the cascade models, while `font-size` is inherited, so a channel reading
 * only same-element declarations would catch the rare half and miss the ordinary one — a mechanism
 * that reads as more complete than it is. Stated, not half-built.
 */
const isZero = (length: { type: string; value?: unknown }): boolean =>
	length.type === 'value' && (length.value as { value: number }).value === 0;

/**
 * Does this shadow SPILL PAST THE BOX — the only part of an outset shadow anyone can see?
 *
 * A `box-shadow` is painted outside the border box and clipped inside it, so a shadow that never
 * reaches past the edge draws nothing at all. With every offset and the blur at zero, the spread
 * is the only thing that can push it out, and a spread of zero or less cannot:
 * `box-shadow: 0 0 0 -1px red` contracts the shadow a pixel INSIDE the box and paints nothing,
 * while reading as a deliberate red ring. The test used to be "not every component is zero", which
 * caught `0 0 0 0 red` and credited that one.
 *
 * THE CEILING, stated because the safe direction here is refusal: a shadow that is offset or
 * blurred is credited whatever its spread, so `1px 0 0 -5px red` — contracted further than it is
 * offset, and equally invisible — still counts. Deciding that needs the element's rendered size,
 * which no stylesheet holds and no gate here can reach.
 *
 * `outline-offset` IS THE SAME CEILING WEARING THE OUTLINE'S CLOTHES, and it is named here rather
 * than left to be rediscovered beside a property this function never reads: a negative offset larger
 * than half the element collapses the ring to nothing, and a large positive one draws it far from the
 * button it belongs to. Both are decided by the rendered size, so both are outside this file for the
 * reason above rather than for a new one. Probed unprompted; the three `outline-offset` declarations
 * this project ships are all `1px`.
 */
const spills = (shadow: {
	xOffset: { type: string; value?: unknown };
	yOffset: { type: string; value?: unknown };
	blur: { type: string; value?: unknown };
	spread: { type: string; value?: unknown };
}): boolean =>
	![shadow.xOffset, shadow.yOffset, shadow.blur].every((length) => isZero(length)) ||
	!(shadow.spread.type === 'value' && (shadow.spread.value as { value: number }).value <= 0);

/**
 * Would this colour paint anything?
 *
 * The parser folds every spelling of a fully transparent colour to the same node — `transparent`,
 * `#0000`, `rgba(0,0,0,0)`, `hsla(0,0%,0%,0)` and even `light-dark(transparent, transparent)` all
 * arrive as `rgb` with `alpha: 0`, which is exactly why this is one comparison rather than a list
 * of spellings. A node carrying no numeric alpha at all — `currentcolor` — is assumed to paint.
 */
const paints = (color: { alpha?: number }): boolean => color.alpha !== 0;

/** Is this the `currentcolor` keyword, whose value is whatever `color` finally resolves to? */
const isCurrentColor = (color: { type?: string }): boolean => color.type === 'currentcolor';

/**
 * What one component of an indicator is known to be. `unknown` is a `var()` — this gate cannot see
 * what a variable holds, so it counts as drawing, which is the same ceiling the specificity check
 * declares rather than a new one.
 */
type Known = 'draws' | 'blank' | 'unknown';

/** The three longhands an `outline` resolves to, which the CASCADE decides one at a time. */
export type OutlinePart = 'width' | 'style' | 'color';

/**
 * What each part of the outline resolves to in this block, for the parts the block DECLARES.
 *
 * A block resolves its own declarations against the CSS initial values, which is right within one
 * block and wrong across several: `outline-color: transparent` in one rule and
 * `outline-style: solid` in a more specific one combine, in the browser, into a solid outline in a
 * transparent colour — invisible — while each block read alone says "no ring" and "a ring", and the
 * more specific answer wins. A caller resolving a cascade therefore needs the parts, not the
 * verdict; `outline` below stays for callers asking about one block, which is the honest question
 * to ask of it.
 */
export type OutlineParts = Partial<Record<OutlinePart, Known>>;

/**
 * Is an unparsed value a single bare keyword this gate may not credit as painting?
 *
 * Five of the six RESET the property, and `inherit` is the odd one — it takes the PARENT's value,
 * which is not knowable from a stylesheet at all. It is in the set anyway, and that is the whole
 * point of the rename: the question this predicate answers is not "does this reset" but "may this
 * be credited", and for a gate about a MISSING focus indicator the answer to an unknowable value is
 * no. `outline: inherit` under a `.dialog { outline: none }` leaves the button bare, and treating
 * it as an unknown that draws — the arm every `var()` takes — passed that.
 *
 * The `var()` arm stays on the other side, and the difference is worth stating: a variable's value
 * is chosen by this project or by the theme and is overwhelmingly a real ring, while `inherit`'s is
 * whatever an ancestor happened to have and is overwhelmingly the initial. Neither is provable
 * here; they are guesses in opposite directions, and this one is the conservative guess about a
 * keyword nothing in this repository writes.
 */
const keyword = (declaration: Declaration & { property: 'unparsed' }): string | null => {
	const tokens = declaration.value.value;
	const only = tokens.length === 1 ? tokens[0] : null;

	return only?.type === 'token' && only.value.type === 'ident' ? only.value.value.toLowerCase() : null;
};

const isBlankKeyword = (declaration: Declaration & { property: 'unparsed' }): boolean =>
	NOT_KNOWN_TO_PAINT.has(keyword(declaration) ?? '');

/**
 * The CSS-wide keywords that leave `color` UNKNOWABLE from a stylesheet, which is a SHORTER list than
 * `NOT_KNOWN_TO_PAINT` and the difference is the whole reason it exists.
 *
 * `color` is an inherited property whose initial value PAINTS (`canvastext`), so `initial` and
 * `revert` name real colours here — the opposite of `outline-style`, whose initial is `none` and for
 * which every one of those keywords means "no ring". Only `inherit` and `unset` — which IS `inherit`
 * on an inherited property — take a value no stylesheet holds. Reusing the outline's set would have
 * made `color: initial` blank every `currentcolor` ring under it, which is a false POSITIVE and the
 * direction this file may not err in either.
 *
 * `var()` is not here and must not be, for the reason the outline's `var()` arm gives: a variable's
 * value is chosen by this project or by the theme and is overwhelmingly a real colour. It is also
 * the case that matters — this project writes 36 `color: var(…)` declarations and not one CSS-wide
 * keyword, so refusing the whole unparsed class (the literal shape of the report that prompted this)
 * would have filed all 36 as blank and reported rings that are on screen.
 */
const UNKNOWABLE_COLOR = new Set(['inherit', 'unset']);

/**
 * THE INDICATOR A DECLARATION BLOCK ACTUALLY LEAVES, resolved in cascade order.
 *
 * This was `declarations.some(…)` — each declaration asked in isolation, any one of them
 * sufficient. Two blocks defeat that and both are ordinary CSS:
 * `outline: 2px solid red; outline-color: transparent` (a longhand overriding one component of the
 * shorthand before it) and `outline: 2px solid red; outline: none` (the same property, twice).
 * Either leaves nothing on screen while an isolated reading of the first declaration says a ring
 * is drawn. A cascade is an ORDER, and `some` has no order in it.
 *
 * So the outline's three components are tracked separately and each declaration overwrites the
 * ones it sets, in the order they appear. `box-shadow` is a single property, so it is last-wins.
 * `stylesheetRules` hands back normal declarations followed by important ones, which is exactly
 * the order that makes last-wins correct: an important declaration beats every normal one in its
 * block regardless of where it was written.
 *
 * Returns `undefined` for a property the block never mentions, which is what lets the caller tell
 * "declared, and draws nothing" — a flattened button — from "not declared here at all".
 *
 * `textColor` and `deferred` are for a caller resolving a CASCADE, and they are the same shape as
 * `parts`: this block's own answer, plus what it could not answer alone. `outline` and `shadow` stay
 * resolved against this block's `color`, which is the honest answer to the question they are asked.
 */
export const indicatorOf = (
	declarations: readonly Declaration[],
): {
	outline?: boolean;
	shadow?: boolean;
	parts: OutlineParts;
	textColor?: boolean;
	deferred: Partial<Record<'color' | 'shadow', boolean>>;
} => {
	// EACH COMPONENT STARTS AT ITS CSS INITIAL VALUE, not at "unset". `outline-style` is initially
	// `none`, so a block that sets only `outline-color` or only `outline-width` draws NOTHING — the
	// style nobody set is still refusing to paint. Started at `undefined` and treated as
	// non-blank, `.button:focus-visible { outline-color: red }` read as a ring.
	//
	// The other two go the other way and for the same reason: `outline-width`'s initial is `medium`
	// and `outline-color`'s is `currentColor`, both of which paint, so `outline-style: solid` alone
	// really does draw a medium outline in the text colour.
	let width: Known = 'draws';
	let style: Known = 'blank';
	let color: Known = 'draws';
	// `currentcolor` carries NO numeric alpha, so `paints` assumed it painted — and
	// `color: transparent; outline: 2px solid currentColor` draws an outline nobody can see. These
	// track it: whether a component's colour came from the keyword, and what this block's own `color`
	// resolves to. Order between them does not matter and must not: `color` is a different property,
	// so the block's final one is what `currentcolor` takes, wherever the indicator was written.
	//
	// BOTH PROPERTIES TAKE IT, which is why the shadow is two flags rather than one boolean. The
	// outline learned this a commit before the shadow did, and the shadow was not swept for it then —
	// the same neighbour-shaped miss `all` made in this very reader. A shadow LIST decides per item,
	// so `0 0 0 3px currentColor, 0 0 0 3px red` still draws over a transparent `color`: one item
	// depends on the keyword and the other does not, and collapsing them into a single flag would
	// have to choose which one lies.
	//
	// ONE BLOCK IS ALL THIS FUNCTION MAY SEE, and that is a limit of the question rather than of the
	// answer: `outline` and `shadow` are asked about a BLOCK. A `color: transparent` winning from
	// another rule is a CASCADE's business, so what this block could not settle alone is handed up in
	// `deferred` for a caller that has the other rules, and `focusCascade.ts` resolves it as a fourth
	// channel. A caller with no cascade — `drawsAnIndicator` — gets the block-local answer, which for
	// an unseen colour is "credited", the same direction a `var()` takes.
	// STARTS TRUE, because `outline-color`'s INITIAL VALUE IS `currentcolor` — the keyword is what an
	// outline takes when nothing sets its colour, so the dependency is there before any declaration
	// is read. Started `false`, `color: transparent; outline-style: solid` drew a solid outline in a
	// colour nobody can see and answered "a ring": the ONE spelling of this defect that needs no
	// `currentcolor` anywhere in the CSS, and the last of three the keyword produced.
	//
	// `outline: 2px solid` with the colour omitted needs no special case — the parser resolves the
	// missing component to `currentcolor`, so the shorthand arm sets this to `true` on its own.
	let fromCurrentColor = true;
	let blockColor: boolean | undefined;
	const touched = new Set<OutlinePart>();
	// `undefined` is "no `box-shadow` in this block at all", which is what lets a caller tell a
	// flattened button from one this block never mentions.
	let shadowPaints: boolean | undefined;
	let shadowFromCurrentColor = false;

	for (const declaration of declarations) {
		if (declaration.property === 'outline') {
			// Before `touched`, so an invalid shorthand contributes nothing at all rather than a blank.
			if (!paintableOutlineStyle(declaration.value.style)) continue;

			for (const part of ['width', 'style', 'color'] as const) touched.add(part);
			const shorthandWidth = declaration.value.width;

			// A keyword width (`medium`, `thin`, `thick`) is not a length and is never zero.
			width = shorthandWidth.type === 'length' && isZero(shorthandWidth.value) ? 'blank' : 'draws';
			style = declaration.value.style.value === 'none' ? 'blank' : 'draws';
			fromCurrentColor = isCurrentColor(declaration.value.color);
			color = paints(declaration.value.color) ? 'draws' : 'blank';
			continue;
		}
		if (declaration.property === 'outline-width') {
			touched.add('width');
			width = declaration.value.type === 'length' && isZero(declaration.value.value) ? 'blank' : 'draws';
			continue;
		}
		if (declaration.property === 'outline-style') {
			if (!paintableOutlineStyle(declaration.value)) continue;

			touched.add('style');
			style = declaration.value.value === 'none' ? 'blank' : 'draws';
			continue;
		}
		if (declaration.property === 'outline-color') {
			touched.add('color');
			fromCurrentColor = isCurrentColor(declaration.value);
			color = paints(declaration.value) ? 'draws' : 'blank';
			continue;
		}
		if (declaration.property === 'color') {
			// `color: currentColor` IS A SELF-REFERENCE, which CSS resolves to the inherited value — so
			// it says nothing about what this element paints in. `paints` sees a node with no numeric
			// alpha and answers true, which is right for an outline drawn in the keyword and wrong for
			// the keyword used as the `color` itself. Not known to paint, like `inherit` below.
			blockColor = isCurrentColor(declaration.value) ? false : paints(declaration.value);
			continue;
		}
		if (declaration.property === 'box-shadow') {
			const spilling = declaration.value.filter((one) => spills(one));

			shadowPaints = spilling.some((one) => !isCurrentColor(one.color) && paints(one.color));
			shadowFromCurrentColor = spilling.some((one) => isCurrentColor(one.color));
			continue;
		}
		// `all` IS BOTH PROPERTIES AT ONCE. Its grammar admits only a CSS-wide keyword, and this gate
		// can prove an indicator from none of them — four reset the property and `inherit` takes a
		// value no stylesheet holds — so every spelling blanks the whole indicator. That makes such a
		// rule a FLATTENING one as surely as `box-shadow: none`, which is the half that matters: it
		// is not merely uncredited, it takes away what an earlier rule drew.
		//
		// Reached here and not through `RESETS`, because the parser gives `all` a property of its own
		// with a plain string value rather than leaving it unparsed. The sibling gate learned to hear
		// `all` two commits ago, in `CONTESTED`; this reader had the identical blind spot and was not
		// swept for it then.
		if (declaration.property === 'all') {
			for (const part of ['width', 'style', 'color'] as const) touched.add(part);
			width = 'blank';
			style = 'blank';
			color = 'blank';
			shadowPaints = false;
			shadowFromCurrentColor = false;
			// AND `color` IS ONE OF THE PROPERTIES `all` IS, which is the third time this reader has had
			// to learn that: `CONTESTED` heard `all` first, `indicatorOf`'s outline and shadow second,
			// and the text-colour channel had the identical blind spot the moment it existed. The same
			// keyword split the unparsed arm makes — `unset`/`inherit` leave a colour no stylesheet
			// holds, `initial` and `revert` name real ones.
			//
			// It also settles `deferred.color` without a line of its own, which is why there is none: a
			// defined `blockColor` makes the deferral test false, so `all` files an outline colour as the
			// BLANK it is rather than as a deferral to be resolved elsewhere. Left undefined, an
			// `all: unset` reset filed `'deferred'` for a part it had just reset outright — masked today
			// by `outline-style` going blank in the same arm, which is exactly how this kind of thing
			// survives to matter later.
			blockColor = !UNKNOWABLE_COLOR.has(declaration.value);
			continue;
		}
		if (declaration.property !== 'unparsed') continue;

		const blank = isBlankKeyword(declaration);
		const known: Known = blank ? 'blank' : 'unknown';

		switch (propertyOf(declaration)) {
			case 'outline': {
				for (const part of ['width', 'style', 'color'] as const) touched.add(part);
				width = known;
				style = known;
				color = known;
				// AN UNPARSED VALUE IS NOT THE KEYWORD, so the provenance has to be cleared with the value.
				// `fromCurrentColor` starts TRUE — `outline-color`'s initial IS `currentcolor` — and these
				// arms overwrote the colour while leaving that flag alone, so `deferred.color` stayed set
				// and a caller resolving the cascade replaced the blank with the text-colour channel.
				// `outline-color: inherit` then read as a visible outline in whatever the button's text is.
				fromCurrentColor = false;
				break;
			}
			case 'outline-width': {
				touched.add('width');
				width = known;
				break;
			}
			case 'outline-style': {
				touched.add('style');
				style = known;
				break;
			}
			case 'outline-color': {
				touched.add('color');
				color = known;
				fromCurrentColor = false;
				break;
			}
			case 'box-shadow': {
				shadowPaints = !blank;
				shadowFromCurrentColor = false;
				break;
			}
			case 'color': {
				blockColor = !UNKNOWABLE_COLOR.has(keyword(declaration) ?? '');
				break;
			}
			default: {
				break;
			}
		}
	}

	// Resolved at the END, because `color` is a different property from either indicator and may be
	// written first or last — the block's final `color` is what the keyword takes. `blockColor === false`
	// rather than `!blockColor` on purpose: a block that never sets `color` inherits one this gate
	// cannot see, and an unseen colour is credited, exactly as a `var()` is.
	const currentColorPaints = blockColor !== false;
	const resolved: Record<OutlinePart, Known> = {
		width,
		style,
		color: fromCurrentColor && !currentColorPaints ? 'blank' : color,
	};
	const shadow =
		shadowPaints === undefined ? undefined : shadowPaints || (shadowFromCurrentColor && currentColorPaints);
	const parts: OutlineParts = Object.fromEntries([...touched].map((part) => [part, resolved[part]]));
	const outline = touched.size > 0 ? !Object.values(resolved).some((part) => part === 'blank') : undefined;

	// WHAT THIS BLOCK COULD NOT ANSWER ALONE, for a caller that can. A channel is deferred when its
	// colour is the keyword AND this block sets no `color` of its own — then the winner is decided by
	// whichever rule's `color` covers the element, which is a cascade question and not a block one.
	// A block that DOES set `color` has already been resolved above and defers nothing; a shadow with
	// an item that paints on its own draws whatever the text colour is, so it defers nothing either.
	const deferred = {
		color: fromCurrentColor && blockColor === undefined,
		shadow: shadowFromCurrentColor && shadowPaints === false && blockColor === undefined,
	};

	return { outline, shadow, parts, textColor: blockColor, deferred };
};

/**
 * Does this block leave a visible focus indicator — an outline or a shadow — behind it?
 *
 * "VISIBLE" MEANS THE INDICATOR'S OWN PAINT, never the element's. `opacity: 0`,
 * `visibility: hidden` and `display: none` each hide a ring as completely as a transparent colour
 * does, and this reader looks at none of them. Probed rather than assumed, and deliberately not
 * built, for a reason that is about the QUESTION rather than about the count:
 *
 * - `visibility: hidden` and `display: none` take the element out of the tab order, so it is never
 *   focused and its focus ring is moot. Modelling them would report buttons that cannot be reached.
 * - `opacity: 0` DOES leave a focusable button with no visible ring — a real defect, and a different
 *   one. Such a button has no visible anything, so the failure is an invisible interactive element
 *   rather than a missing focus indicator, and a gate that reported it here would be answering a
 *   question it was not asked with a mechanism nobody would look for it in.
 *
 * Measured either way, so the next reader need not: no `opacity` and no `visibility` declaration
 * appears in any stylesheet this project ships.
 *
 * A NEARBY ONE with no principled fix, stated so it is not mistaken for an oversight: `paints` asks
 * `alpha !== 0`, so `rgba(255, 0, 0, 0.004)` counts as a ring. It is invisible in practice and CSS
 * defines no threshold at which it stops being a colour, so any cutoff here would be this file's
 * invention rather than the language's.
 */
export const drawsAnIndicator = (declarations: readonly Declaration[]): boolean => {
	const { outline, shadow } = indicatorOf(declarations);

	return outline === true || shadow === true;
};

/** One declaration list, parsed — so a value fixture is read the way a stylesheet's is. */
export const declarationsOf = (declarations: string): readonly Declaration[] =>
	stylesheetRules(`a { ${declarations} }`)[0]?.declarations ?? [];
