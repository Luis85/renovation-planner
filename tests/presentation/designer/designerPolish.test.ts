/**
 * Task 6 (AD18-R20/R21): the designer canvas focus ring, the designer's styled `<select>`s, the two
 * checkbox focus rings this card adds, and the 24px checkbox rows — `styles/designer-polish.css` —
 * plus the Add rail's equal tile height in `styles/designer-add.css`. Read through lightningcss
 * (`tests/helpers/selectors.ts`), the same instrument `designerStyles.test.ts` uses: jsdom resolves
 * no CSS, so what a template's class LOOKS like is only what these rules declare.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';

function onlyRule(css: string): StyleRule {
	const [rule] = stylesheetRules(css);
	if (rule === undefined) throw new Error(`no rule parsed from: ${css}`);
	return rule;
}

const partial = (file: string): StyleRule[] => stylesheetRules(readFileSync(`styles/${file}`, 'utf8'));

/** How the parser reads `property: value`, as the one-item list `declared` answers for a single rule. */
const parsed = (property: string, value: string): unknown[] =>
	onlyRule(`.reference { ${property}: ${value}; }`).declarations.map((declaration) => declaration.value);

/** How `show` spells a selector, read off the parser rather than retyped — attribute quoting included. */
const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** Every value `property` takes in the rules whose selector list names `selector`, under `condition` (`''`: none). */
function declared(rules: readonly StyleRule[], selector: string, property: string, condition = ''): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === condition && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value));
}

describe('the designer canvas’s focus ring', () => {
	const rules = partial('designer-polish.css');

	it('rings the canvas, inset so the leaf’s own overflow cannot clip it', () => {
		expect(declared(rules, '.renovation-asset-designer .rp-plan-canvas:focus-visible', 'outline')).toEqual(
			parsed('outline', '2px solid var(--interactive-accent)'),
		);
		expect(declared(rules, '.renovation-asset-designer .rp-plan-canvas:focus-visible', 'outline-offset')).toEqual(
			parsed('outline-offset', '-2px'),
		);
	});

	/**
	 * `.rp-plan-canvas` (`EditorSurface.vue`) is shared with the Plan Editor, so the ring must be
	 * reached only through the designer's own root — never the bare class, which would ring both
	 * surfaces, and never `.renovation-plan-editor`, which would ring the wrong one.
	 */
	it('never rings the bare or the Plan Editor’s canvas', () => {
		expect(declared(rules, '.rp-plan-canvas:focus-visible', 'outline')).toEqual([]);
		expect(declared(rules, '.renovation-plan-editor .rp-plan-canvas:focus-visible', 'outline')).toEqual([]);
	});

	/**
	 * Fix round 1 (integrator's measurement): the -2px ring above sits entirely under
	 * `DesignerRulers.vue`'s opaque top/left strips when they are drawn. `:has(.rp-designer-rulers)`
	 * reads whether the strips are actually in the DOM rather than naming a condition that hides
	 * them, so this rule wins by specificity over the base ring whenever they are present and
	 * leaves the base rule's -2px as the answer whenever they are not (an unscaled design, or no
	 * design loaded yet — `DesignerRulers.vue`'s own `model`, `v-if`).
	 */
	it('insets the ring to the ruler strips’ own size once they are in the DOM', () => {
		const selector = '.renovation-asset-designer .rp-plan-canvas:has(.rp-designer-rulers):focus-visible';

		expect(declared(rules, selector, 'outline-offset')).toEqual(parsed('outline-offset', 'calc(-1 * var(--rp-designer-ruler-size))'));
	});

	/**
	 * `--rp-designer-ruler-size` inherits DOWNWARD only, and the strips that declare it
	 * (`.rp-designer-rulers` in `designer-rulers.css`) are `.rp-plan-canvas`'s own descendants, not
	 * an ancestor — so the `calc()` above cannot read that declaration and this file RESTATES the
	 * value instead, the same move `dimensionFigures.ts`'s `RULER_PX` already makes for the
	 * identical reason. Pinned here exactly as `restingLabels.test.ts` already pins that other
	 * restatement, so the two files cannot silently drift if the rulers' own size ever changes.
	 */
	it('restates the rulers’ own strip size, pinned against designer-rulers.css rather than retyped', () => {
		const fromRulers = declared(partial('designer-rulers.css'), '.rp-designer-rulers', '--rp-designer-ruler-size');
		const fromPolish = declared(rules, '.renovation-asset-designer .rp-plan-canvas:has(.rp-designer-rulers):focus-visible', '--rp-designer-ruler-size');

		expect(fromRulers).toEqual(parsed('--rp-designer-ruler-size', '18px'));
		expect(fromPolish).toEqual(fromRulers);
	});
});

describe('the designer’s styled selects', () => {
	const rules = partial('designer-polish.css');

	/**
	 * The same six host variables `tests/harness/obsidian.css` gives a plain `input[type='text']`
	 * (that vendored sheet has no unqualified `select` rule at all), so a designer select reads like
	 * the designer's own text and number fields.
	 */
	it('borrows the vendored sheet’s own text-input look, through the designer root rather than a class', () => {
		expect(declared(rules, '.renovation-asset-designer select', 'height')).toEqual(parsed('height', 'var(--input-height)'));
		expect(declared(rules, '.renovation-asset-designer select', 'padding')).toEqual(parsed('padding', 'var(--input-padding)'));
		expect(declared(rules, '.renovation-asset-designer select', 'font-size')).toEqual(parsed('font-size', 'var(--font-ui-small)'));
		expect(declared(rules, '.renovation-asset-designer select', 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, '.renovation-asset-designer select', 'background')).toEqual(
			parsed('background', 'var(--background-modifier-form-field)'),
		);
		expect(declared(rules, '.renovation-asset-designer select', 'border')).toEqual(
			parsed('border', 'var(--input-border-width) solid var(--background-modifier-border)'),
		);
		expect(declared(rules, '.renovation-asset-designer select', 'border-radius')).toEqual(parsed('border-radius', 'var(--input-radius)'));
	});

	it('rings a focused select, the same shape the asset library’s inspector fields wear', () => {
		const precedent = declared(partial('asset-library-inspector.css'), '.rp-al-inspector .rp-al-fields__select:focus-visible', 'outline-offset');

		expect(precedent).toEqual(parsed('outline-offset', '1px'));
		expect(declared(rules, '.renovation-asset-designer select:focus-visible', 'outline')).toEqual(
			parsed('outline', '2px solid var(--interactive-accent)'),
		);
		expect(declared(rules, '.renovation-asset-designer select:focus-visible', 'outline-offset')).toEqual(precedent);
	});

	it('never styles a select outside the designer root', () => {
		expect(declared(rules, 'select', 'height')).toEqual([]);
	});
});

describe('the designer’s two unringed checkboxes', () => {
	const rules = partial('designer-polish.css');

	/**
	 * `Select multiple parts` (`designer-parts.css`) and `Show clearance` (`designer-clearance.css`)
	 * are the two checkboxes with no `:focus-visible` rule anywhere else in `styles/` — verified by
	 * grep before writing this case, since `editor-view.css`'s `.rp-view-menu__content
	 * input:focus-visible` already rings the View menu's four toggles the brief also named.
	 */
	it('rings both, leaving the box itself unstyled', () => {
		for (const selector of [
			'.renovation-asset-designer .rp-designer-parts .rp-designer-multi-select input:focus-visible',
			'.renovation-asset-designer .rp-designer-clearance-toggle input:focus-visible',
		]) {
			expect(declared(rules, selector, 'outline')).toEqual(parsed('outline', '2px solid var(--interactive-accent)'));
			expect(declared(rules, selector, 'outline-offset')).toEqual(parsed('outline-offset', '1px'));
		}
	});
});

describe('the checkbox rows’ 24px floor', () => {
	const rules = partial('designer-polish.css');

	/** The box stays 13px: only `min-height` on the row, never a size on the input itself. */
	it('gives the three named rows a 24px floor and touches no checkbox’s own size', () => {
		for (const selector of [
			'.renovation-asset-designer .rp-designer-parts .rp-designer-multi-select',
			'.renovation-asset-designer .rp-designer-clearance-toggle',
			'.renovation-asset-designer .rp-view-menu__content label',
		]) {
			expect(declared(rules, selector, 'min-height')).toEqual(parsed('min-height', 'var(--size-4-6)'));
		}
		expect(rules.some((rule) => rule.selectors.map(show).some((selector) => selector.includes('input')) && rule.declarations.some((declaration) => propertyOf(declaration) === 'min-height'))).toBe(false);
	});

	/** Scoped through the designer root: the Plan Editor shares `.rp-view-menu__content label` and must stay untouched. */
	it('never sets the row floor on the bare, shared selector', () => {
		expect(declared(rules, '.rp-view-menu__content label', 'min-height')).toEqual([]);
	});
});

describe('the Add rail’s equal tile height', () => {
	const rules = partial('designer-add.css');

	/** 73px: the integrator’s measured height of row 1’s two-line “Rounded rectangle” tile, the tallest of the two rows measured. */
	it('floors every Add-rail tile at the tallest measured tile’s height', () => {
		expect(declared(rules, '.rp-designer-add button.rp-designer-tool-button', 'min-height')).toEqual(parsed('min-height', '73px'));
	});

	/**
	 * `.rp-designer-placement-modes .rp-designer-selection-button` shares the tile's OTHER
	 * declarations with `.rp-designer-add button.rp-designer-tool-button` (asserted in
	 * `designerStyles.test.ts`'s "reuses the Add rail's tile layout" case) but not this one: its own
	 * three-column row already stretches evenly, and this card's claim is the Add rail only.
	 */
	it('leaves the shared Placement-point segment selector untouched', () => {
		expect(declared(rules, '.rp-designer-placement-modes .rp-designer-selection-button', 'min-height')).toEqual([]);
	});
});
