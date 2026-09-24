/**
 * @vitest-environment node
 *
 * The Grid view's tile alignment (AD18-R20): `styles/asset-library-grid.css`'s tile rules, read
 * through lightningcss (`tests/helpers/selectors.ts`) rather than mounted, since jsdom resolves
 * no layout and cannot tell a centred box from a left-aligned one.
 *
 * A one-line tile name previously centred and a two-line one did not, both drawing the same
 * `text-align: start`. The cause is Obsidian's own `button` rule (`align-items: center`,
 * `tests/harness/obsidian.css`), which `.rp-al-tiles .rp-al-tile` did not override: a flex item
 * that fits on one line shrinks to its own content width and that shrunk box centres in the
 * column, while a wrapped two-line box is laid out at the container's width and its own
 * `text-align: start` is what a reader was actually seeing. `align-items: stretch` on the tile
 * makes every child (the mark, the name, the size) fill the tile's width, so `text-align: start`
 * decides both cases the same way. The mark keeps its own `align-self: center`
 * (`.rp-al-tiles .rp-al-tile .rp-al-mark`), which overrides the tile's `align-items` for that one
 * child alone, so it stays centred regardless.
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

/** How the parser reads `property: value`, as the one-item list `declared` answers for a single rule. */
const parsed = (property: string, value: string): unknown[] =>
	onlyRule(`.reference { ${property}: ${value}; }`).declarations.map((declaration) => declaration.value);

/** How `show` spells a selector, read off the parser rather than retyped. */
const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** Every value `property` takes in the sheet's rules whose selector list names `selector`. */
function declared(selector: string, property: string): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value));
}

describe('the Grid tile\'s alignment (AD18-R20)', () => {
	it('stretches every child to the tile\'s own width, overriding Obsidian\'s button centring', () => {
		expect(declared('.rp-al-tiles .rp-al-tile', 'align-items')).toEqual(parsed('align-items', 'stretch'));
	});

	it('still declares the name and size left-aligned, which stretching now actually shows', () => {
		expect(declared('.rp-al-tiles .rp-al-tile', 'text-align')).toEqual(parsed('text-align', 'start'));
	});

	it('keeps the mark centred against the now-stretched tile', () => {
		expect(declared('.rp-al-tiles .rp-al-tile .rp-al-mark', 'align-self')).toEqual(parsed('align-self', 'center'));
	});
});
