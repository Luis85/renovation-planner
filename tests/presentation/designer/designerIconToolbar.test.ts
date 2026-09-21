/**
 * @vitest-environment jsdom
 *
 * AD18 item 3 (the icon toolbar) and item 6 (canvas proportion at 560-900px).
 *
 * **What this file can and cannot see, stated first because the items are about APPEARANCE.**
 * jsdom lays nothing out: it applies no container query, resolves no `cqi` and computes no used
 * width, so not one case here is a measurement of a rendered toolbar. What the mounted cases read
 * is the MARKUP — the accessible name, the glyph each button asked the host for, the grouping —
 * and what the stylesheet cases read is what a rule DECLARES, through lightningcss
 * (`tests/helpers/selectors.ts`), exactly as `designerStyles.test.ts` does. Whether the labelled
 * toolbar still occupies one row at 80rem, and whether the capped rails leave the canvas the half
 * the arithmetic promises, are questions for a browser.
 *
 * The four small readers below (`onlyRule`, `spelled`, `parsed`, `declared`) are a deliberate
 * clone of `designerStyles.test.ts`'s, and the clone is deliberate because that file is not this
 * card's to edit; a shared helper with two callers would be the right home for them and is the
 * follow-up. `npm run analyze` cannot see it either way — fallow reads no `*.test.ts` file.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import { DESIGNER_TOOL_LABELS } from '../../../src/presentation/designer/tools/registerDesignerTools';
import { DESIGNER_TOOL_ICONS } from '../../../src/presentation/designer/tools/designerToolIcons';
import { designerRig } from '../../helpers/designerRig';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';

/**
 * The drawing tools, which AD18-R3 MOVED into item 5's `Add` rail. Kept in this file because the
 * glyph cases below span both homes: once a label is hidden the glyph is the only thing telling
 * two controls apart, and that claim was never about one container — it is about the surface.
 */
const SHAPE_TOOLS = ['draw-rect', 'draw-rounded-rect', 'draw-circle', 'draw-line'] as const;

/**
 * Every button the TOOLBAR draws, in order: camera mode, the tool table minus the drawing tools,
 * then the history pair.
 *
 * The drawing tools are dropped by asking `DESIGNER_TOOL_ICONS` which rows are `'shape'` rather
 * than by naming them a second time, so the day a fifth shape is added this list loses it exactly
 * as the toolbar does. `SHAPE_TOOLS` above is the hand-written half and is deliberately NOT used
 * here: one of the two has to be independent of the code, or the case becomes a tautology.
 */
const TOOLBAR_LABELS: readonly StringKey[] = [
	'designer.toolbar.pan',
	...(Object.entries(DESIGNER_TOOL_LABELS).flatMap(([id, label]) =>
		DESIGNER_TOOL_ICONS[id as keyof typeof DESIGNER_TOOL_ICONS].group === 'shape' ? [] : [label],
	) as StringKey[]),
	'designer.toolbar.undo',
	'designer.toolbar.redo',
];

/**
 * Every control that draws a tool GLYPH, wherever the shell puts it — the toolbar's row and the
 * `Add` rail's shape group. `.rp-designer-add-shapes` rather than `.rp-designer-add`, because the
 * rail's preset door is a `<button>` in that section with no glyph at all and would make the two
 * counts below disagree for a reason that has nothing to do with icons.
 */
const GLYPH_BEARING = '.rp-designer-tools .rp-host-icon, .rp-designer-add-shapes .rp-host-icon';

function onlyRule(css: string): StyleRule {
	const [rule] = stylesheetRules(css);
	if (rule === undefined) throw new Error(`no rule parsed from: ${css}`);
	return rule;
}

/** How `show` spells a selector, read off the parser rather than retyped. */
const spelled = (selector: string): string => onlyRule(`${selector} { color: inherit; }`).selectors.map(show).join(', ');

/** How the parser reads `property: value`, as the one-item list `declared` answers for a single rule. */
const parsed = (property: string, value: string): unknown[] =>
	onlyRule(`.reference { ${property}: ${value}; }`).declarations.map((declaration) => declaration.value);

/** Every value `property` takes in the rules whose selector list names `selector`, under `condition`. */
function declared(rules: readonly StyleRule[], selector: string, property: string, condition = ''): unknown[] {
	const wanted = spelled(selector);
	return rules
		.filter((rule) => rule.condition === condition && rule.selectors.map(show).includes(wanted))
		.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property).map((declaration) => declaration.value));
}

/** The serialized form of a container condition, taken from the parser rather than written out. */
const container = (query: string): string => onlyRule(`@container ${query} { .reference { color: inherit; } }`).condition;

const TOOLBAR_SHEET = (): StyleRule[] => stylesheetRules(readFileSync('styles/designer-toolbar.css', 'utf8'));

describe('every toolbar button is an icon with a name', () => {
	/**
	 * The label that WAS a button's text is now its text AND its `aria-label`, and the second is
	 * what survives the width at which the first is hidden. Asserted over the whole toolbar rather
	 * than over the tool table alone, because Pan is not in that table and Undo and Redo are not
	 * tools at all — three of them, and exactly the three a case driven off `DESIGNER_TOOL_LABELS`
	 * would miss.
	 *
	 * The `Add` rail's four are NOT here since AD18-R3 moved them; `designerAddRail.test.ts` makes
	 * the same claim about the same markup in its new home, because `DesignerToolButton` is what
	 * both draw and a regression in it would land in both places.
	 */
	it('names every toolbar button with the label it used to spell as text, and draws one glyph in each', async () => {
		const rig = await designerRig();
		const buttons = rig.wrapper.findAll('.rp-designer-tools button');

		expect(buttons.map((button) => button.attributes('aria-label'))).toEqual(TOOLBAR_LABELS.map((label) => t('en', label)));
		expect(buttons.map((button) => button.findAll('.rp-host-icon').length)).toEqual(TOOLBAR_LABELS.map(() => 1));
		rig.unmount();
	});

	/**
	 * **No two buttons wear the same glyph.** Once the text is hidden the glyph is the ONLY thing
	 * that tells two buttons apart on screen, so a table that reused one — the cheapest possible
	 * edit, and the one a reader adding a twelfth tool would reach for — would ship two controls
	 * that look identical and do different things. Nothing else in this repository can see that:
	 * the labels would still differ, so every existing toolbar case stays green.
	 *
	 * **Asked across BOTH homes since AD18-R3**, which is the widening the ruling forces rather
	 * than a convenience: the rail draws its four with their text hidden at every width, so an
	 * icon reused between a rail button and a toolbar button would ship exactly the defect this
	 * case exists for, in the one place where neither control has any text at all.
	 */
	it('asks for a distinct glyph per button across both homes, which is all that tells them apart once the text is hidden', async () => {
		const rig = await designerRig();
		const icons = rig.wrapper.findAll(GLYPH_BEARING).map((icon) => icon.attributes('data-icon'));

		expect(icons).toHaveLength(TOOLBAR_LABELS.length + SHAPE_TOOLS.length);
		expect(new Set(icons).size).toBe(icons.length);
		rig.unmount();
	});

	/**
	 * **Not one requested glyph goes unrendered in the browser harness.**
	 * `tests/fixtures/editor-icons/` is a pinned, licensed subset and its README's rule is that an
	 * unknown request is MARKED (`data-icon-missing`) rather than answered with a different icon —
	 * so a name with no fixture draws as an empty button in `npm run harness` and
	 * `npm run harness-shot` while resolving normally in a vault, where `setIcon` reaches
	 * Obsidian's own catalogue.
	 *
	 * **This case used to pin the three that WERE missing — `anchor`, `circle` and `squircle` — as
	 * an exact set, so that landing a fixture for any of them turned it red.** It did, and the
	 * fixtures landed; the set is empty now and the subject is the stronger claim the empty set
	 * makes: this surface asks for nothing the harness cannot draw. The half of the old case that
	 * still has work to do survives unchanged — a new tool quietly introducing a gap turns this
	 * red exactly as a new fixture once did.
	 *
	 * **A fixture is TWO halves and this case only sees the second.** The SVG under
	 * `tests/fixtures/editor-icons/` is provenance; what the harness renderer actually reads is
	 * `tests/helpers/editorIconNodes.ts`, so a file added with no map entry still draws nothing and
	 * is still counted here. That the entry faithfully reproduces its SVG is a different claim,
	 * checked by `tests/helpers/editorIconNodes.test.ts` and not by this file.
	 *
	 * **And this case reads an ABSENCE, which is a weaker thing than it looks.** While the expected
	 * set was non-empty this file was the tree's only positive producer of `data-icon-missing`;
	 * emptying it left every remaining assertion about that marker anywhere in `tests/**` a
	 * negative, so deleting the line in the fake that writes it turned eight cases vacuous at once
	 * with nothing going red — measured, at W13-A's review. `tests/helpers/obsidianIcons.test.ts`
	 * holds the positive half now, beside the code that produces it rather than here where a later
	 * wave could legitimately carry it off again.
	 */
	it('asks the harness for no glyph it has no fixture for, across both homes', async () => {
		const rig = await designerRig();
		// Both homes, or the shape tools' glyphs would leave with their buttons and the set would
		// shrink for a reason that has nothing to do with fixtures at all.
		const icons = rig.wrapper.findAll(GLYPH_BEARING);
		const missing = icons.map((icon) => icon.attributes('data-icon-missing')).filter((name) => name !== undefined);

		// An empty set proves nothing about a selector that reached nothing, so the count is asserted
		// first. That covers ONE of the two ways this case can go green by failing and not the
		// other: it is equally vacuous if the fake stops WRITING `data-icon-missing` at all, which
		// no assertion here can see, since every one of them reads the attribute's absence.
		// `tests/helpers/obsidianIcons.test.ts` pins the producing side for that reason.
		expect(icons).toHaveLength(TOOLBAR_LABELS.length + SHAPE_TOOLS.length);
		expect(missing).toEqual([]);
		rig.unmount();
	});

	/**
	 * Undo and Redo announce no pressed state, which is the ABSENT arm of `DesignerToolButton`'s
	 * optional prop and not a `false` one: they are actions, and `aria-pressed="false"` would tell
	 * a screen reader they are toggles that happen to be off.
	 */
	it('gives the history pair no pressed state at all, where a mode button has one either way', async () => {
		const rig = await designerRig();
		const pressed = (label: StringKey): string | undefined => rig.toolbarButton(t('en', label)).getAttribute('aria-pressed') ?? undefined;

		expect(pressed('designer.toolbar.undo')).toBeUndefined();
		expect(pressed('designer.toolbar.redo')).toBeUndefined();
		expect(pressed('designer.toolbar.pan')).toBe('true');
		expect(pressed('designer.toolbar.select')).toBe('false');
		rig.unmount();
	});
});

describe('the Basic shapes group', () => {
	/**
	 * **It is not in the toolbar any more (AD18-R3), and this case says so rather than being
	 * deleted.** Wave 10 drew the four drawing tools into one named group inside
	 * `.rp-designer-tools` precisely so wave 11 could lift it; the lift is a MOVE, so the
	 * toolbar's side of it is an absence, and an absence nobody asserts is how a duplicate gets
	 * re-added later with every other case still green.
	 *
	 * Where the group went, what it holds and that its membership still matches the tool table is
	 * `designerAddRail.test.ts`'s subject — that file carries the positive half, and it carries it
	 * against `DESIGNER_TOOL_ICONS` rather than against a template, for the reason this case's
	 * predecessor named: a tool re-grouped in the table must move the group, not sit inside it.
	 */
	it('is gone from the toolbar, which AD18-R3 moved into the Add rail', async () => {
		const rig = await designerRig();

		expect(rig.wrapper.find('.rp-designer-shape-tools').exists()).toBe(false);
		expect(rig.wrapper.findAll('.rp-designer-tools [role="group"]').map((group) => group.attributes('aria-label'))).not.toContain(
			t('en', 'designer.shapes.group'),
		);
		rig.unmount();
	});
});

describe('what the stylesheet declares', () => {
	/**
	 * The label is hidden below 80rem and the rule lives under that container query and no other.
	 * Both halves matter: a `display: none` that escaped its query would hide the text at every
	 * width, and a query naming a container nothing declares would apply nowhere — the failure
	 * `designerNarrowQueryResolved.test.ts` records having shipped once already.
	 */
	it('draws the button text only at 80rem and wider', () => {
		const rules = TOOLBAR_SHEET();
		const narrow = container('rp-designer (width < 80rem)');

		expect(declared(rules, '.renovation-asset-designer .rp-designer-tool-label', 'display', narrow)).toEqual(parsed('display', 'none'));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-tool-label', 'display')).toEqual([]);
	});

	/**
	 * The icon and the text are one row, so the glyph sits beside the label rather than above it —
	 * and the selector is ELEMENT-QUALIFIED, which is the load-bearing half.
	 *
	 * One element in this toolbar carries `.rp-designer-tool-button` and is not a button — named
	 * rather than counted, because the ordinal this sentence used to carry ("a fifteenth element")
	 * was falsified by AD18-R3 lifting four buttons into the `Add` rail, and the stylesheet's own
	 * copy of it was falsified in the same commit:
	 * `DesignerViewMenu.vue`'s `<summary>`, styled by `editor-view.css` with `list-style: none` and
	 * an `::after` chevron. Unqualified, this rule would give that summary `display: inline-flex`
	 * as a side effect of a change about icons. The second assertion is what refuses the widening:
	 * the unqualified spelling must declare nothing.
	 */
	it('lays the button out as an icon beside its text, and reaches no element that is not a button', () => {
		const rules = TOOLBAR_SHEET();

		expect(declared(rules, '.rp-designer-tools button.rp-designer-tool-button', 'display')).toEqual(parsed('display', 'inline-flex'));
		expect(declared(rules, '.rp-designer-tools button.rp-designer-tool-button', 'align-items')).toEqual(parsed('align-items', 'center'));
		expect(declared(rules, '.rp-designer-tools .rp-designer-tool-button', 'display')).toEqual([]);
	});

	/**
	 * ITEM 6. The two rail caps sum to HALF the container, which is the whole of why the canvas
	 * can no longer fall below half — and the sum is asserted over the same two numbers the
	 * expected declarations are BUILT from, so the stylesheet and the arithmetic cannot drift
	 * apart: raising a cap without lowering the other turns both halves red.
	 *
	 * The floor is spelled as the complement of `designer-narrow.css`'s 35rem stacking query so
	 * the two blocks are disjoint — a cap reaching into the stacked layout would pin a rail that
	 * is supposed to be full width — and that disjointness is what makes `styles/index.css`'s
	 * import order irrelevant here.
	 */
	it('caps both rails at half the leaf between them, above the width where the body stacks', () => {
		const rules = TOOLBAR_SHEET();
		const partsCap = 22;
		const inspectorCap = 28;
		const wide = container('rp-designer (width >= 35rem)');

		expect(partsCap + inspectorCap).toBe(50);
		expect(declared(rules, '.renovation-asset-designer .rp-designer-parts', 'width', wide)).toEqual(parsed('width', `min(11rem, ${partsCap}cqi)`));
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'width', wide)).toEqual(parsed('width', `min(14rem, ${inspectorCap}cqi)`));
	});

	/**
	 * And no rule here sets a rail's width OUTSIDE that query. An unconditional cap would reach
	 * the stacked layout, where `designer-narrow.css` gives both rails `width: auto` at the same
	 * specificity — leaving which one wins to the order two `@import` lines happen to be in.
	 */
	it('sets neither rail width unconditionally, so the stacked layout is nobody else’s business', () => {
		const rules = TOOLBAR_SHEET();

		expect(declared(rules, '.renovation-asset-designer .rp-designer-parts', 'width')).toEqual([]);
		expect(declared(rules, '.renovation-asset-designer .rp-designer-inspector', 'width')).toEqual([]);
	});
});
