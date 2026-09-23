/**
 * The asset designer's stylesheet partials, read through lightningcss (`tests/helpers/selectors.ts`): jsdom
 * resolves no CSS, so what a template's class LOOKS like is only what these rules declare. Every expected
 * value is the same parser's reading of a one-rule reference sheet, so no case spells lightningcss's AST by
 * hand; and a rule is found by its WHOLE selector under its condition, so a descendant rule's declarations
 * are never read as this one's.
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

describe('the designer’s warnings, toolbar and selection actions', () => {
	/**
	 * Critique finding 2: `--text-warning` as TEXT measured about 2.73:1 on the light inspector, under the
	 * 4.5:1 AA floor for text this size. The sentence is normal text and the warning colour is a rule on its
	 * leading edge — on the designer, and in the dimensions dialog, which makes the same claim.
	 */
	it.each([
		['designer.css', '.rp-designer-unscaled'],
		['dialogs.css', '.rp-dialog-warning'],
	])('draws %s’s %s in normal text beside a warning-coloured rule', (file, selector) => {
		const rules = partial(file);

		expect(declared(rules, selector, 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, selector, 'border-inline-start')).toEqual(parsed('border-inline-start', '2px solid var(--text-warning)'));
		expect(declared(rules, selector, 'padding-inline-start')).toEqual(parsed('padding-inline-start', 'var(--size-4-2)'));
	});

	/** Critique finding 5, the half ruled in: a `flex: 1` spacer stops pushing once the toolbar wraps. */
	it('ends Undo and Redo as one group on whichever row they land, with no spacer left', () => {
		const rules = partial('designer.css');

		expect(declared(rules, '.rp-designer-history', 'display')).toEqual(parsed('display', 'flex'));
		expect(declared(rules, '.rp-designer-history', 'margin-inline-start')).toEqual(parsed('margin-inline-start', 'auto'));
		expect(rules.flatMap((rule) => rule.selectors.map(show)).filter((selector) => selector.includes('rp-designer-toolbar-spacer'))).toEqual([]);
	});

	/** Critique finding 15: the pressed mode wore the pressed tool's accent border and read as a second tool. */
	it('draws the selection modes as one bordered control, the pressed mode without the tool’s accent border', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-selection-modes', 'border')).toEqual(parsed('border', '1px solid var(--background-modifier-border)'));
		expect(declared(rules, '.rp-designer-selection-modes', 'border-radius')).toEqual(parsed('border-radius', 'var(--radius-s)'));
		for (const pressed of [
			'.rp-designer-tools .rp-designer-selection-modes .rp-designer-tool-active',
			'.rp-designer-tools .rp-designer-selection-modes .rp-designer-tool-active:hover',
		]) {
			expect(declared(rules, pressed, 'border-color')).toEqual(parsed('border-color', 'transparent'));
		}
	});

	/** Critique finding 22: natural-width actions over full-width asset buttons, wrapping into uneven rows. */
	it('lets each wrapped row of selection actions fill the column', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-inspector .rp-designer-selection-actions .rp-designer-selection-button', 'flex')).toEqual(parsed('flex', '1 1 auto'));
	});
});

describe('the inspector’s headings, hint and unavailable actions', () => {
	/** Critique finding 4: the "Inspector" `<h2>` and the section `<h3>`s were styled alike, so a section added no hierarchy. */
	it('sets the section headings in normal text at semibold, under the muted panel title', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-inspector .rp-designer-section-title', 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, '.rp-designer-inspector .rp-designer-section-title', 'font-weight')).toEqual(parsed('font-weight', 'var(--font-semibold)'));
	});

	/** Critique finding 11: an unavailable action is `aria-disabled` now, and must look exactly as a `:disabled` one did. */
	it('draws an aria-disabled selection action as a disabled one', () => {
		const rules = partial('designer-selection.css');
		const disabled = '.rp-designer-inspector .rp-designer-selection-button:disabled';
		const unavailable = ".rp-designer-inspector .rp-designer-selection-button[aria-disabled='true']";

		expect(declared(rules, unavailable, 'color')).toEqual(parsed('color', 'var(--text-faint)'));
		for (const property of ['color', 'background-color', 'cursor']) {
			expect(declared(rules, unavailable, property)).toEqual(declared(rules, disabled, property));
		}
	});

	/** Critique finding 25: the facing angle's direction hint reads quieter than its label. */
	it('draws a field hint in muted text', () => {
		expect(declared(partial('designer-selection.css'), '.rp-designer-field-hint', 'color')).toEqual(parsed('color', 'var(--text-muted)'));
	});
});

/**
 * Critique finding 6: at a 460px leaf the inspector kept its 14rem and left the canvas about 236px wide.
 * Below 35rem the inspector stacks under the canvas, in FIXED flex shares — a content-sized inspector would
 * take the whole column once a detail is selected and leave `EditorSurface` measuring a canvas of nothing.
 * The condition is the parser's reading of the query itself, never a hand-written serialisation.
 */
describe('the designer at a sidebar leaf’s width', () => {
	const narrow = (): string => onlyRule('@container rp-designer (width < 35rem) { .reference { color: inherit; } }').condition;

	it('makes the designer root the container whose width is asked', () => {
		const rules = partial('designer-narrow.css');

		expect(declared(rules, '.renovation-asset-designer', 'container-type')).toEqual(parsed('container-type', 'inline-size'));
		expect(declared(rules, '.renovation-asset-designer', 'container-name')).toEqual(parsed('container-name', 'rp-designer'));
	});

	it('stacks the inspector under the canvas below 35rem, in fixed shares of the body', () => {
		const rules = partial('designer-narrow.css');

		expect(narrow()).not.toBe('');
		expect(declared(rules, '.renovation-asset-designer .rp-designer-body', 'flex-direction', narrow())).toEqual(parsed('flex-direction', 'column'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-canvas', 'flex', narrow())).toEqual(parsed('flex', '3 1 0'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'flex', narrow())).toEqual(parsed('flex', '2 1 0'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'width', narrow())).toEqual(parsed('width', 'auto'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'border-left', narrow())).toEqual(parsed('border-left', 'none'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'border-top', narrow())).toEqual(parsed('border-top', '1px solid var(--background-modifier-border)'));
	});
});

/**
 * AD18-R16 Task 2: the library door's label clips below the SAME 35rem the body above stacks at,
 * rather than a width invented for this button alone — `designer-header.css`'s own comment argues
 * why. The clip technique is `visually-hidden.css`'s, read off that partial rather than retyped, so
 * a future edit to the utility and this rule cannot quietly drift apart.
 */
describe('the library door’s label below the header’s narrow width', () => {
	const narrow = (): string => onlyRule('@container rp-designer (width < 35rem) { .reference { color: inherit; } }').condition;
	const clipped = partial('visually-hidden.css');

	it('clips the label rather than hiding it, so the text keeps naming the button', () => {
		const rules = partial('designer-header.css');
		const selector = '.rp-designer-title-bar .rp-designer-open-library-label';

		expect(narrow()).not.toBe('');
		for (const property of ['position', 'width', 'height', 'margin', 'padding', 'overflow', 'clip-path', 'white-space']) {
			expect(declared(rules, selector, property, narrow())).toEqual(declared(clipped, '.rp-visually-hidden', property));
		}
	});
});

/**
 * AD18-R16 Task 4's canvas legend. The swatches read the SAME two host variables the Konva layers
 * resolve for the parts they stand for (`themeTokens.ts`): `--text-normal` (`tokens.zoneStroke`)
 * for the footprint and details, `--interactive-accent` (`tokens.accent`) for the clearance, the
 * placement point and the front direction. The clearance swatch alone carries a dashed border
 * style, standing for `clearanceLayer.ts`'s own dash — not its exact `[8, 6]` screen-pixel
 * spacing, which a swatch a few pixels wide has no room for.
 */
describe('the canvas legend’s swatches', () => {
	const rules = partial('designer-legend.css');

	it('takes no pointer at all, unlike its two neighbours which let a child opt back in', () => {
		expect(declared(rules, '.rp-designer-legend', 'pointer-events')).toEqual(parsed('pointer-events', 'none'));
	});

	it('draws the footprint and details swatches in the same ink the layers draw them in', () => {
		expect(declared(rules, '.rp-designer-legend__swatch', 'border-top')).toEqual(parsed('border-top', '2px solid var(--text-normal)'));
		expect(declared(rules, '.rp-designer-legend__swatch--details', 'border-top-width')).toEqual(parsed('border-top-width', '1px'));
	});

	it('draws the clearance, placement point and front direction swatches in the accent colour', () => {
		for (const selector of ['.rp-designer-legend__swatch--clearance', '.rp-designer-legend__swatch--facing']) {
			expect(declared(rules, selector, 'border-top-color')).toEqual(parsed('border-top-color', 'var(--interactive-accent)'));
		}
		expect(declared(rules, '.rp-designer-legend__swatch--placement', 'background-color')).toEqual(parsed('background-color', 'var(--interactive-accent)'));
	});

	it('dashes only the clearance swatch', () => {
		expect(declared(rules, '.rp-designer-legend__swatch--clearance', 'border-top-style')).toEqual(parsed('border-top-style', 'dashed'));
		expect(declared(rules, '.rp-designer-legend__swatch--facing', 'border-top-style')).toEqual([]);
	});
});

/** AD18-R16 Task 4: below 35rem the legend is hidden, on the same container `designer-narrow.css` declares. */
describe('the legend below the designer’s narrow width', () => {
	const narrow = (): string => onlyRule('@container rp-designer (width < 35rem) { .reference { color: inherit; } }').condition;

	it('is not drawn below 35rem', () => {
		const rules = partial('designer-legend.css');

		expect(narrow()).not.toBe('');
		expect(declared(rules, '.renovation-asset-designer .rp-designer-legend', 'display', narrow())).toEqual(parsed('display', 'none'));
	});
});
