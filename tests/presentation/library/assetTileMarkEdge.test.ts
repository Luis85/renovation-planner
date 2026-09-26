/**
 * @vitest-environment node
 *
 * AD18 Task 8 / AD18-R27 (browse.md step 32, RULING): the case's own pass condition claims the
 * name, the size and "the same edge the mark sits above" all share one left edge. The case's own
 * evidence for the row already contradicts that — the mark is centred (`align-self: center`) —
 * and `assetTileStyles.test.ts` (owned by a different task this round) already pins that one fact
 * in isolation ("keeps the mark centred against the now-stretched tile"). What nothing pins is
 * the CONTRAST that makes the clause unmeetable rather than merely imprecise: the mark and the
 * design-less placeholder icon that stands in for it (AD18-R21) are the only two `.rp-al-tile`
 * children that override the tile's `align-items: stretch` with their own `align-self: center`,
 * while the name and the size declare no `align-self` at all and so inherit the stretch. Two
 * children centred against the tile's width and two children stretched to fill it cannot share a
 * left edge except at the one box width where a centred 4rem child happens to start at 0 — a
 * coincidence, not a property this stylesheet declares.
 *
 * jsdom lays out nothing (CLAUDE.md's Testing section), so this reads the parsed CSS through
 * `tests/helpers/selectors.ts` rather than a mounted tile's bounding box — a fact anyone can
 * compute from the declarations asserted below, exactly as the case's own "align-self: center"
 * citation already is. It does NOT measure an actual rendered pixel offset (no instrument in this
 * suite can), so it does not itself prove the two edges differ by any particular amount — only
 * that the stylesheet gives the mark/icon and the name/size two different alignment rules, which
 * is what a browser-harness capture would still have to confirm visually.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';

const rules = stylesheetRules(readFileSync('styles/asset-library-grid.css', 'utf8'));

function onlyRule(css: string): StyleRule {
	const [rule] = stylesheetRules(css);
	if (rule === undefined) throw new Error(`no rule parsed from: ${css}`);
	return rule;
}

/** How the parser reads `property: value`, as the one-item list `declaredValues` answers for a single rule. */
const parsed = (property: string, value: string): unknown[] =>
	onlyRule(`.reference { ${property}: ${value}; }`).declarations.map((declaration) => declaration.value);

/** How `show` spells a selector, read off the parser rather than retyped. */
const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** Every value `property` takes in the sheet's rules whose selector list names `selector` — `[]` when the selector declares none. */
function declaredValues(selector: string, property: string): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) =>
			rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value),
		);
}

describe('Browse 32\'s "same edge the mark sits above" (AD18-R27): the stylesheet gives it no fixed left edge', () => {
	it('stretches every tile child to the content edge by default', () => {
		expect(declaredValues('.rp-al-tiles .rp-al-tile', 'align-items')).toEqual(parsed('align-items', 'stretch'));
	});

	it('centres the mark against that stretch, rather than flush against the content edge', () => {
		expect(declaredValues('.rp-al-tiles .rp-al-tile .rp-al-mark', 'align-self')).toEqual(parsed('align-self', 'center'));
	});

	it('centres the design-less placeholder icon the same way, not flush against the mark\'s own slot', () => {
		expect(declaredValues('.rp-al-tiles .rp-al-tile .rp-al-tile__category-icon', 'align-self')).toEqual(
			parsed('align-self', 'center'),
		);
	});

	it('declares no align-self for the name or the size, so both inherit the stretch instead', () => {
		expect(declaredValues('.rp-al-tiles .rp-al-tile__name', 'align-self')).toEqual([]);
		expect(declaredValues('.rp-al-tiles .rp-al-tile__size', 'align-self')).toEqual([]);
	});
});
