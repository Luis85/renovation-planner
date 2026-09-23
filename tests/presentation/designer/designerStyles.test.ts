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

/**
 * AD18-R16 Task 8's fix round: the integrator's browser measurement of the first version — a
 * `flex-wrap` row, `.rp-designer-selection-actions`'s own shape — found three segments wrapping
 * unevenly (Centre 80px and Back centre 108px on one row, Custom alone at 192px on a second, all
 * 49px tall), which read as three loose buttons rather than a segmented control.
 */
describe('the placement point group’s three equal segments', () => {
	/**
	 * `minmax(0, 1fr)` rather than bare `1fr`, for `designer-add.css`'s own measured reason on its
	 * two-column grid: an `auto` column minimum is each column's own min-content contribution — the
	 * width of its longest unbreakable run — which is what forced the uneven split this fix answers.
	 */
	it('lays the group out as a three-column grid of equal-width segments', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-placement-modes', 'display')).toEqual(parsed('display', 'grid'));
		expect(declared(rules, '.rp-designer-placement-modes', 'grid-template-columns')).toEqual(
			parsed('grid-template-columns', 'repeat(3, minmax(0, 1fr))'),
		);
	});

	/**
	 * No `align-items` here — the SAME answer `designer-add.css`'s own grid now gives, since that
	 * file's final-fix-wave item 5 dropped the `align-items: start` it briefly carried. Grid's
	 * default `stretch` is what gives "Centre" and "Custom" the same height as a two-line "Back
	 * centre" rather than leaving them visibly shorter — three different heights would still read
	 * as three buttons rather than one control.
	 */
	it('sets no align-items on the group, so its segments stretch to an equal height', () => {
		expect(declared(partial('designer-selection.css'), '.rp-designer-placement-modes', 'align-items')).toEqual([]);
	});

	/**
	 * The icon-above-label shape is SHARED with `designer-add.css`'s `Add`-rail tile rule rather
	 * than duplicated — the fix round's own second finding. Read from `designer-add.css`, not
	 * `designer-selection.css`, because that is where the (now two-selector) rule actually lives;
	 * a case reading the wrong partial would pass on an accidental empty result rather than on the
	 * declared value, so `height` is asserted too as the instrument-reaches-something floor.
	 */
	it('reuses the Add rail’s tile layout for each segment rather than a second copy of it', () => {
		const rules = partial('designer-add.css');
		const selector = '.rp-designer-placement-modes .rp-designer-selection-button';

		expect(declared(rules, selector, 'flex-direction')).toEqual(parsed('flex-direction', 'column'));
		expect(declared(rules, selector, 'height')).toEqual(parsed('height', 'auto'));
		expect(declared(rules, selector, 'white-space')).toEqual(parsed('white-space', 'normal'));
		// The declared values must be the SAME as the Add rail's own tile, not merely equal by
		// coincidence — read off the shared selector list rather than retyped, so the two cannot
		// silently drift into two different tile shapes that happen to agree today.
		const tile = '.rp-designer-add button.rp-designer-tool-button';
		for (const property of ['display', 'flex-direction', 'align-items', 'gap', 'height', 'white-space']) {
			expect(declared(rules, selector, property)).toEqual(declared(rules, tile, property));
		}
	});

	/** A two-word segment ("Back centre") may wrap; the label span carries the fix, not the button. */
	it('lets a segment’s label wrap anywhere', () => {
		const rules = partial('designer-selection.css');

		expect(declared(rules, '.rp-designer-placement-modes .rp-designer-selection-button span', 'overflow-wrap')).toEqual(
			parsed('overflow-wrap', 'anywhere'),
		);
	});

	/**
	 * AD18 second parity round, task 1: the integrator measured `Custom` — one word, so
	 * `overflow-wrap: anywhere` above had no space to prefer over a mid-word break — splitting
	 * `Custo` / `m` inside the 61px column. A SEPARATE rule in `designer-add.css` from the shared
	 * tile shape above (the previous case's own selector list stays untouched), narrowing this
	 * segment's own text the same way `.rp-designer-add .rp-designer-tool-label` narrows an
	 * Add-rail tile's. jsdom resolves no layout, so this asserts the declared values exist in the
	 * assembled sheet; whether they are enough is the integrator's measurement.
	 */
	it('narrows the segment’s own text and padding, so a one-word label has room not to split', () => {
		const rules = partial('designer-add.css');
		const selector = '.rp-designer-placement-modes .rp-designer-selection-button';

		expect(declared(rules, selector, 'font-size')).toEqual(parsed('font-size', 'var(--font-ui-smaller)'));
		expect(declared(rules, selector, 'padding-inline')).toEqual(parsed('padding-inline', 'var(--size-4-1)'));
	});
});

/**
 * AD18 second parity round, task 1: the card's `stroke-width: 1.5px` used to sit on the `<svg>`
 * itself, read in `preview.viewBox`'s own millimetre units — for the vanity preset's
 * `-440 -265 880 530` box drawn into a 40px picture, that measured 0.07px on screen. jsdom draws
 * nothing, so what this suite can check is that the declared fix exists in the assembled sheet,
 * not that it is visible; the integrator's capture is that check.
 */
describe('the asset card’s thumbnail strokes', () => {
	const rules = partial('designer-object.css');

	it('reads stroke-width in screen pixels rather than viewBox units, on both the footprint and a detail', () => {
		for (const selector of ['.rp-designer-inspector .rp-designer-asset-thumbnail__footprint', '.rp-designer-inspector .rp-designer-asset-thumbnail__detail']) {
			expect(declared(rules, selector, 'vector-effect')).toEqual(parsed('vector-effect', 'non-scaling-stroke'));
			expect(declared(rules, selector, 'stroke-width')).toEqual(parsed('stroke-width', '1.5'));
		}
	});

	it('dashes only a detail carrying the dashed modifier class', () => {
		expect(declared(rules, '.rp-designer-inspector .rp-designer-asset-thumbnail__detail--dashed', 'stroke-dasharray')).toEqual(
			parsed('stroke-dasharray', '4 3'),
		);
		expect(declared(rules, '.rp-designer-inspector .rp-designer-asset-thumbnail__footprint', 'stroke-dasharray')).toEqual([]);
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

	/**
	 * AD18-R16 Task 6 review (Important finding): the integrator measured the transform and
	 * repeat folds' `<summary>` at 17px tall, under WCAG 2.5.8's 24px target minimum. The
	 * borrowed precedent, `.rp-project-list__completed > summary`, carries
	 * `min-height: var(--size-4-6); padding-inline: var(--size-4-2);` for exactly this reason,
	 * and the new rule had dropped both. Pinned against the SAME declared values on the
	 * precedent selector, so the two cannot quietly drift apart the way this one already did.
	 */
	it('gives the transform and repeat folds’ summary the same 24px hit target the completed-projects disclosure wears', () => {
		const rules = partial('designer-selection.css');
		const precedent = declared(partial('project-list.css'), '.rp-project-list__completed > summary', 'min-height');

		expect(precedent).toEqual(parsed('min-height', 'var(--size-4-6)'));
		expect(declared(rules, '.rp-designer-collapsible > summary', 'min-height')).toEqual(precedent);
		expect(declared(rules, '.rp-designer-collapsible > summary', 'padding-inline')).toEqual(
			declared(partial('project-list.css'), '.rp-project-list__completed > summary', 'padding-inline'),
		);
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
