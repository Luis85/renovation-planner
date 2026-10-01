/**
 * @vitest-environment node
 *
 * Browse 33 (AD18 audit 2, rank 2): the category placeholder icon's stroke reads at the SAME
 * weight as a real design's mark, not thinner. `assetTileStyles.test.ts`'s own case for this
 * (`holds the icon's stroke at the mark's own 1.5px…`) only ever compares each declaration to
 * the LITERAL string `'1.5'` — a mutation changing only the mark's own `stroke-width` leaves
 * that case, and `assetLibrary.e2e.ts`'s `paint.stroke` check against a literal, both green. This
 * file closes that gap: it reads BOTH declarations from the assembled sheet and asserts them
 * equal to EACH OTHER.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';

function onlyRule(css: string): StyleRule {
	const [rule] = stylesheetRules(css);
	if (rule === undefined) throw new Error(`no rule parsed from: ${css}`);
	return rule;
}

const rules = stylesheetRules(readFileSync('styles/asset-library-grid.css', 'utf8'));

/** How `show` spells a selector, read off the parser rather than retyped. */
const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** Every value `property` takes in the sheet's rules whose selector list names `selector`. */
function declared(selector: string, property: string): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value));
}

/**
 * The bare CSS-pixel magnitude a declared value carries, whichever of the two shapes this file
 * compares hands it: `.rp-al-mark`'s `stroke-width: 1.5px` parses to a typed dimension, while
 * `.rp-al-tile__category-icon`'s `--icon-stroke: 1.5` parses to a raw custom-property token list
 * holding a plain number — `.rp-host-icon svg`'s own `stroke-width: var(--icon-stroke, 1.75)` is
 * what the icon actually draws with. So the equality this clause asks for is between these two
 * NUMBERS, not between the two declaration shapes (which never match structurally, unit vs. none).
 * Throws on anything else, so an unmodelled shape fails loud rather than reading `undefined ===
 * undefined` as equal.
 */
function magnitude(value: unknown): number {
	const dimension = value as { type?: string; value?: unknown };
	if (dimension.type === 'dimension') {
		const length = dimension.value as { value?: unknown };
		if (typeof length.value === 'number') return length.value;
	}
	const custom = value as { value?: unknown[] };
	if (Array.isArray(custom.value)) {
		const [token] = custom.value as [{ type?: string; value?: { type?: string; value?: unknown } }?];
		if (token?.type === 'token' && token.value?.type === 'number' && typeof token.value.value === 'number') return token.value.value;
	}
	throw new Error(`magnitude(): no CSS-pixel reading for ${JSON.stringify(value)}`);
}

describe('the category icon\'s stroke against the mark\'s own (Browse 33, AD18-R30 D)', () => {
	it('declares the same stroke weight as the mark, not a separately hand-pinned one', () => {
		const [markStroke] = declared('.rp-al-tiles .rp-al-tile .rp-al-mark', 'stroke-width');
		const [iconStroke] = declared('.rp-al-tiles .rp-al-tile .rp-al-tile__category-icon', '--icon-stroke');

		expect(markStroke).not.toBeUndefined();
		expect(iconStroke).not.toBeUndefined();
		expect(magnitude(iconStroke)).toBe(magnitude(markStroke));
	});
});
