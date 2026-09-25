/**
 * L-47, the owner's ruling "Normal text colour": the context bar's perspective label and the Layers
 * panel's "Set scale" action draw their TEXT in the theme's text colour, and the perspective's or the
 * action's hue survives only on a non-text marker — the label's icon and leading border, the action's
 * underline. axe reported both texts in the accent at under 4.5:1 in the harness's light scheme.
 *
 * Read through lightningcss (`tests/helpers/selectors.ts`) over every partial `styles/index.css`
 * imports, so a colour rule re-added in ANY shipped partial is seen, not only in the two edited here.
 * It reads declarations and never resolves a variable: that `--text-normal` passes contrast under a
 * given theme is outside every gate here, and the markers' own non-text contrast is measured by nothing.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importsIn, propertyOf, show, stylesheetRules, subjectClasses, type StyleRule } from '../../../helpers/selectors';

const partial = (file: string): StyleRule[] => stylesheetRules(readFileSync(`styles/${file}`, 'utf8'));
const shipped: StyleRule[] = importsIn('styles/index.css', readFileSync('styles/index.css')).flatMap((file) => partial(file.replace('./', '')));

function onlyRule(css: string): StyleRule {
	const [rule] = stylesheetRules(css);
	if (rule === undefined) throw new Error(`no rule parsed from: ${css}`);
	return rule;
}

/** How the parser reads `property: value`, as the one-item list `declared` answers for a single rule. */
const parsed = (property: string, value: string): unknown[] =>
	onlyRule(`.reference { ${property}: ${value}; }`).declarations.map((declaration) => declaration.value);

const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** Every value `property` takes in the unconditional rules whose selector list names `selector`. */
function declared(rules: readonly StyleRule[], selector: string, property: string): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value));
}

/** Every `color` value any shipped rule whose SUBJECT wears `cls` declares, under any condition. */
const textColoursOf = (cls: string): unknown[] =>
	shipped
		.filter((rule) => rule.selectors.some((selector) => subjectClasses(selector).includes(cls)))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === 'color').map((declaration) => declaration.value));

const TEXT_COLOURS = ['--text-normal', '--text-muted', '--text-faint'].map((name) => parsed('color', `var(${name})`)[0]);

describe('L-47: the two editor-shell labels draw text in the theme’s text colour', () => {
	it.each(['rp-perspective-context__mode', 'rp-layer-list__action'])('gives .%s only text colours, in every state and partial', (cls) => {
		const colours = textColoursOf(cls);

		// The instrument reaches something: an empty list would pass every assertion below.
		expect(colours.length).toBeGreaterThan(0);
		for (const colour of colours) expect(TEXT_COLOURS).toContainEqual(colour);
	});

	it('draws the perspective name in normal text and keeps the hue on its icon and border', () => {
		const rules = partial('editor-visual-shell.css');

		expect(declared(rules, '.renovation-plan-editor .rp-perspective-context__mode', 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, '.renovation-plan-editor .rp-perspective-context__mode .rp-host-icon', 'color')).toEqual(parsed('color', 'var(--rp-perspective-accent)'));
		expect(declared(rules, '.renovation-plan-editor .rp-perspective-context', 'border-inline-start')).toEqual(parsed('border-inline-start', '2px solid var(--rp-perspective-accent)'));
	});

	it('draws Set scale in normal text with an accent underline', () => {
		const rules = partial('editor-shell-fidelity.css');
		const action = '.renovation-plan-editor .rp-layer-list .rp-layer-list__action';

		expect(declared(rules, action, 'color')).toEqual(parsed('color', 'var(--text-normal)'));
		expect(declared(rules, action, 'text-decoration-color')).toEqual(parsed('text-decoration-color', 'var(--text-accent)'));
	});
});
