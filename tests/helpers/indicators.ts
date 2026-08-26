import { propertyOf, stylesheetRules } from './selectors';
import type { Declaration } from 'lightningcss';

/**
 * What a declaration block DRAWS, read through the parser rather than through a value vocabulary.
 *
 * A sibling to `selectors.ts` and the same argument: a CSS value is a grammar. This one answers
 * one question — does this block leave a visible focus indicator — and it has been wrong four
 * times, each time because it was written as a list of spellings that mean "nothing":
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
const RESETS = new Set(['none', 'initial', 'unset', 'revert', 'revert-layer']);

/** Is this a length the parser resolved to exactly zero? */
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

/** Is an unparsed value a single bare keyword that resets the property? */
const isReset = (declaration: Declaration & { property: 'unparsed' }): boolean => {
	const tokens = declaration.value.value;
	const only = tokens.length === 1 ? tokens[0] : null;

	return only?.type === 'token' && only.value.type === 'ident' && RESETS.has(only.value.value.toLowerCase());
};

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
 */
export const indicatorOf = (
	declarations: readonly Declaration[],
): { outline?: boolean; shadow?: boolean; parts: OutlineParts } => {
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
	const touched = new Set<OutlinePart>();
	let shadow: boolean | undefined;

	for (const declaration of declarations) {
		if (declaration.property === 'outline') {
			for (const part of ['width', 'style', 'color'] as const) touched.add(part);
			const shorthandWidth = declaration.value.width;

			// A keyword width (`medium`, `thin`, `thick`) is not a length and is never zero.
			width = shorthandWidth.type === 'length' && isZero(shorthandWidth.value) ? 'blank' : 'draws';
			style = declaration.value.style.value === 'none' ? 'blank' : 'draws';
			color = paints(declaration.value.color) ? 'draws' : 'blank';
			continue;
		}
		if (declaration.property === 'outline-width') {
			touched.add('width');
			width = declaration.value.type === 'length' && isZero(declaration.value.value) ? 'blank' : 'draws';
			continue;
		}
		if (declaration.property === 'outline-style') {
			touched.add('style');
			style = declaration.value.value === 'none' ? 'blank' : 'draws';
			continue;
		}
		if (declaration.property === 'outline-color') {
			touched.add('color');
			color = paints(declaration.value) ? 'draws' : 'blank';
			continue;
		}
		if (declaration.property === 'box-shadow') {
			shadow = declaration.value.some((one) => paints(one.color) && spills(one));
			continue;
		}
		if (declaration.property !== 'unparsed') continue;

		const reset = isReset(declaration);
		const known: Known = reset ? 'blank' : 'unknown';

		switch (propertyOf(declaration)) {
			case 'outline': {
				for (const part of ['width', 'style', 'color'] as const) touched.add(part);
				width = known;
				style = known;
				color = known;
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
				break;
			}
			case 'box-shadow': {
				shadow = !reset;
				break;
			}
			default: {
				break;
			}
		}
	}

	const resolved: Record<OutlinePart, Known> = { width, style, color };
	const parts: OutlineParts = Object.fromEntries([...touched].map((part) => [part, resolved[part]]));
	const outline = touched.size > 0 ? ![width, style, color].some((part) => part === 'blank') : undefined;

	return { outline, shadow, parts };
};

/** Does this block leave a visible focus indicator — an outline or a shadow — behind it? */
export const drawsAnIndicator = (declarations: readonly Declaration[]): boolean => {
	const { outline, shadow } = indicatorOf(declarations);

	return outline === true || shadow === true;
};

/** One declaration list, parsed — so a value fixture is read the way a stylesheet's is. */
export const declarationsOf = (declarations: string): readonly Declaration[] =>
	stylesheetRules(`a { ${declarations} }`)[0]?.declarations ?? [];
