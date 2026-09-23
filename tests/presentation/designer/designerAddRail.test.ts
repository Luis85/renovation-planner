/**
 * @vitest-environment jsdom
 *
 * AD18 item 5 — the `Add` half of the Add/Parts rail, under AD18-R3, AD18-R5 and AD18-R6.
 *
 * **What this file can and cannot see, stated first because the item is about COMPOSITION.** jsdom
 * lays nothing out: it applies no container query, resolves no `cqi` and computes no used width, so
 * not one case here is a measurement of a rendered rail. What these cases read is the markup — which
 * control exists, where, under what name, and what pressing it does — and what the stylesheet case
 * reads is what a rule DECLARES, through lightningcss (`tests/helpers/selectors.ts`), exactly as
 * `designerStyles.test.ts` does. Whether the rail's new height leaves the Parts panel below it
 * usable at a 460px leaf is the cost AD18-R5 names in its own text as unmeasured, and it is a
 * question for a browser.
 *
 * Mounted through `designerRig` — the real designer, real runtime, real tools — so what is graded is
 * the surface a user gets rather than a fixture of it.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { err } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import type { StringKey } from '../../../src/presentation/i18n/locales/en';
import type { AssetDesignerQueryServices } from '../../../src/presentation/read-models/assetDesignerQueries';
import { DESIGNER_TOOL_LABELS } from '../../../src/presentation/designer/tools/registerDesignerTools';
import { DESIGNER_TOOL_ICONS } from '../../../src/presentation/designer/tools/designerToolIcons';
import { useAssetDesignStore } from '../../../src/presentation/designer/stores/assetDesignStore';
import { designerRig, type DesignerRig } from '../../helpers/designerRig';
import { unwiredPlanUsage } from '../../helpers/designerQueries';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';
import { settle } from '../../helpers/editor';

/**
 * The drawing tools as the TABLE says they are, which is the whole point of reading them from it:
 * a fifth shape, or a tool re-grouped from `'tool'` to `'shape'`, moves this expectation and the
 * rail together. A hand-written list here would let the two disagree silently, which is the shape
 * `designerToolIcons.ts`'s own docblock says the `group` field exists to prevent.
 */
const SHAPE_IDS = Object.keys(DESIGNER_TOOL_ICONS).filter(
	(id) => DESIGNER_TOOL_ICONS[id as keyof typeof DESIGNER_TOOL_ICONS].group === 'shape',
) as (keyof typeof DESIGNER_TOOL_LABELS)[];

/** A read that refuses with a vault fault, which is what blanks `design` for `AssetDesignerRoot`. */
const REFUSING: AssetDesignerQueryServices = {
	getAssetDesign: () => Promise.resolve(err({ category: 'Persistence' as const, code: 'vault.unexpected-failure', message: 'x' })),
	listPlansUsingAsset: unwiredPlanUsage,
};

let open: DesignerRig | null = null;

afterEach(() => {
	open?.unmount();
	open = null;
});

async function railOpen(): Promise<DesignerRig> {
	open = await designerRig();
	return open;
}

describe('the Add rail', () => {
	/**
	 * **The four drawing tools are HERE, and the set is read off the tool table.** AD18-R3 is a
	 * MOVE, so this is the positive half of a claim whose negative half — that the toolbar no
	 * longer draws them — lives in `designerIconToolbar.test.ts`. Neither half alone says the
	 * buttons exist exactly once.
	 *
	 * The order is the table's, because the rail derives it from `Object.entries` exactly as the
	 * toolbar does; asserting it keeps a re-ordering of the table visible on this surface instead
	 * of only in the tool registry.
	 */
	it('draws exactly the shape-grouped tools, in the tool table’s own order', async () => {
		const rig = await railOpen();

		const labels = rig.wrapper.findAll('.rp-designer-add-shapes button').map((button) => button.attributes('aria-label'));

		expect(labels).toEqual(SHAPE_IDS.map((id) => t('en', DESIGNER_TOOL_LABELS[id] as StringKey)));
	});

	/**
	 * **Fix round: the tile's own VISIBLE text is the shape's name, not the toolbar's verb phrase**
	 * — board 01 labels a tile "Rectangle", not "Draw rectangle". The accessible name stays the
	 * long form (asserted above, unchanged), so this is a SECOND string per tile rather than a
	 * rename, and WCAG 2.5.3 label-in-name is what makes the pair legal: each visible text must be
	 * CONTAINED in its own accessible name, checked here rather than trusted from the two locale
	 * tables agreeing by construction. Compared case-insensitively rather than as a literal
	 * substring — sentence-case UI text capitalises a tile's own first (and only) word
	 * ("Rectangle") where the same noun sits mid-sentence in its accessible name ("Draw
	 * rectangle"), and 2.5.3 does not turn on letter case; a same-word, different-case pair is
	 * exactly the "contained" the success criterion means, not a violation of it.
	 */
	it('labels each tile with the shape’s own short name, contained in its accessible name', async () => {
		const rig = await railOpen();
		const buttons = rig.wrapper.findAll('.rp-designer-add-shapes button');
		const visible = buttons.map((button) => button.find('.rp-designer-tool-label').text());
		const accessible = buttons.map((button) => button.attributes('aria-label'));

		expect(visible).toEqual([
			t('en', 'designer.add.tile-rect'),
			t('en', 'designer.add.tile-rounded-rect'),
			t('en', 'designer.add.tile-circle'),
			t('en', 'designer.add.tile-line'),
		]);
		visible.forEach((text, index) => {
			expect(accessible[index]?.toLowerCase()).toContain(text.toLowerCase());
		});
		// The visible text is genuinely shorter, or this case would not be testing what it claims.
		visible.forEach((text, index) => {
			expect(text.length).toBeLessThan((accessible[index] ?? '').length);
		});
	});

	/**
	 * **EVERY registered designer tool has exactly one button, counting both homes.** This is the
	 * property AD18-R3 turns into a risk: two components now filter one table, and a predicate
	 * edited on one side alone either duplicates a tool or loses it. A lost tool is design slice
	 * 7's recorded defect — a tool reachable by nothing, invisible to all four gates because
	 * nothing is wrong with the code — and a duplicated one is the two-answers shape this
	 * repository refuses everywhere it has a name for it.
	 *
	 * Asked of the mounted shell rather than of the two predicates, deliberately: the predicates
	 * agreeing is what makes it true, and the surface is where it has to BE true. Pan, Undo and
	 * Redo are excluded because they are not registered tools — `DESIGNER_TOOL_LABELS` is the
	 * subject, and a count over every button would be a different claim.
	 */
	it('leaves every registered tool with exactly one button across the toolbar and the rail', async () => {
		const rig = await railOpen();

		const named = rig.wrapper
			.findAll('.rp-designer-tools button, .rp-designer-add-shapes button')
			.map((button) => button.attributes('aria-label'));
		const counts = Object.values(DESIGNER_TOOL_LABELS).map((label) => named.filter((name) => name === t('en', label as StringKey)).length);

		expect(counts).toEqual(Object.values(DESIGNER_TOOL_LABELS).map(() => 1));
	});

	/**
	 * The four sit in ONE named group, and the group holds exactly them — wave 10's group, lifted
	 * whole rather than re-invented, which is why the label string is still `designer.shapes.group`.
	 *
	 * **Task 3 turns that label into a visible sub-heading**, so the group is named by
	 * `aria-labelledby` pointing at a rendered `<h3>` rather than by carrying the string itself on
	 * `aria-label` — the group and the heading say the same words because they are the same DOM
	 * node's text read twice, not two copies that could drift.
	 *
	 * Membership is read against the tool table for the reason the toolbar's version of this case
	 * gave: a tool re-grouped in the table must MOVE the group rather than appear inside it, and a
	 * case pinned to four hand-written names could not tell those two apart.
	 */
	it('holds them in one named group, headed by the label wave 10 minted for it', async () => {
		const rig = await railOpen();
		const group = rig.wrapper.find('.rp-designer-add > .rp-designer-add-shapes');
		const headingId = group.attributes('aria-labelledby');

		expect(group.attributes('role')).toBe('group');
		expect(group.attributes('aria-label')).toBeUndefined();
		expect(headingId).toBeTruthy();
		expect(rig.wrapper.find(`h3#${headingId}`).text()).toBe(t('en', 'designer.shapes.group'));
		expect(group.findAll('button')).toHaveLength(SHAPE_IDS.length);
	});

	/** The section names itself, with the same string as its heading — WCAG 2.5.3's pairing. */
	it('names the section and heads it with the same words', async () => {
		const rig = await railOpen();
		const section = rig.wrapper.find('.rp-designer-add');

		expect(section.attributes('aria-label')).toBe(t('en', 'designer.add'));
		expect(section.find('h2.rp-designer-panel-title').text()).toBe(t('en', 'designer.add'));
	});

	/**
	 * **A rail button activates its tool, and it is reached through `designerRig`'s own resolver.**
	 * That resolver used to select `.rp-designer-tools button` alone, so any of its call sites
	 * would have thrown for a shape the moment AD18-R3 moved one — a SELECTOR failure dressed as a
	 * missing label. Driving one button from EACH home through it is what keeps the widened
	 * selector honest: dropping either half of the union turns exactly one of these two red.
	 */
	it('activates a rail tool and a toolbar tool alike, through one resolver', async () => {
		const rig = await railOpen();

		rig.toolbarButton(t('en', 'designer.toolbar.draw-circle')).click();
		await settle();
		expect(rig.activeToolId()).toBe('draw-circle');

		rig.toolbarButton(t('en', 'designer.toolbar.calibrate')).click();
		await settle();
		expect(rig.activeToolId()).toBe('calibrate');
	});

	/** The pressed mirror, which is what a screen reader has instead of the accent border. */
	it('mirrors the active tool on the rail button’s aria-pressed', async () => {
		const rig = await railOpen();
		const pressed = (): (string | undefined)[] =>
			rig.wrapper.findAll('.rp-designer-add-shapes button').map((button) => button.attributes('aria-pressed'));

		expect(new Set(pressed())).toEqual(new Set(['false']));
		rig.toolbarButton(t('en', 'designer.toolbar.draw-line')).click();
		await settle();

		expect(pressed().filter((value) => value === 'true')).toHaveLength(1);
	});

	/**
	 * **AD18-R6: the preset door is HERE**, and the assertion is about its HOME rather than about
	 * its behaviour. What it does — one dialog for two clicks, a cancel writing nothing, the shape
	 * the form submits reaching the asset — is `assetPresetFlow.test.ts`'s subject, and every one
	 * of those cases resolves `.rp-designer-start-preset` against the whole mounted root, so they
	 * followed the button here without an edit and would follow it anywhere else too. That is
	 * exactly why the location needs a case of its own.
	 */
	it('carries the preset door, which AD18-R6 took from the Inspector', async () => {
		const rig = await railOpen();

		expect(rig.wrapper.find('.rp-designer-add .rp-designer-start-preset').text()).toBe(t('en', 'designer.inspector.start-preset'));
		expect(rig.wrapper.findAll('.rp-designer-start-preset')).toHaveLength(1);
	});

	/**
	 * **Task 3: the door comes FIRST, Basic shapes second — board 01's order, not wave 11's.** The
	 * two were written in the opposite sequence when the group was merely lifted whole; ordering
	 * them is this card's own change, so it gets a case of its own rather than riding the one above,
	 * which only ever asked whether the door exists.
	 */
	it('puts the preset door before Basic shapes, following board 01', async () => {
		const rig = await railOpen();
		const section = rig.wrapper.find('.rp-designer-add').element;
		const door = rig.wrapper.find('.rp-designer-start-preset').element;
		const shapes = rig.wrapper.find('.rp-designer-add-shapes').element;
		const children = Array.from(section.children);

		expect(children.indexOf(door)).toBeLessThan(children.indexOf(shapes));
	});

	/**
	 * **AD18-R5's load-bearing half: the `Add` section is UNCONDITIONAL.** It is the reason that
	 * ruling stacks rather than tabs — the shape buttons activate tools, which exist whether or
	 * not a design has been read, so the rail puts a condition on one child and none on the other
	 * and the `design !== null` gate `AssetDesignerRoot` already had is not moved. A tab pair would
	 * have had to answer what `Parts` shows while `design` is `null`, and the cheap answers all
	 * move that gate.
	 *
	 * Both halves are asserted together on purpose. `assetDesignerRoot.test.ts` already requires
	 * every region ELEMENT to survive a refused read; what it cannot say is that this one survives
	 * with its controls in it while its neighbour correctly empties.
	 */
	it('keeps its buttons through a refused read, where the Parts panel empties', async () => {
		const rig = await railOpen();

		await useAssetDesignStore(rig.pinia).hydrate(REFUSING, rig.assetId, { indexScanCompleted: true });
		await settle();

		expect(rig.wrapper.findAll('.rp-designer-add-shapes button')).toHaveLength(SHAPE_IDS.length);
		expect(rig.wrapper.find('.rp-designer-add .rp-designer-start-preset').exists()).toBe(true);
		expect(rig.wrapper.find('.rp-designer-part-list').exists()).toBe(false);
	});
});

/**
 * The four small stylesheet readers, at module scope because they capture nothing —
 * `unicorn/consistent-function-scoping` refuses them inside the `describe`. A deliberate clone of
 * `designerStyles.test.ts`'s, for the reason `designerIconToolbar.test.ts` already records about
 * its own copy: that file is not this card's to edit, a shared helper with three callers is the
 * right home for them and is the follow-up, and `npm run analyze` reads no `*.test.ts` file either
 * way.
 */
const partial = (): StyleRule[] => stylesheetRules(readFileSync('styles/designer-add.css', 'utf8'));

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

/**
 * The serialized form of a container condition, taken from the parser rather than written out —
 * `designerIconToolbar.test.ts`'s own copy, cloned for the reason this file's other four readers
 * already are: that file is not this card's to edit.
 */
const container = (query: string): string => onlyRule(`@container ${query} { .reference { color: inherit; } }`).condition;

describe('what the Add rail’s stylesheet declares', () => {
	/**
	 * **Task 3: the rail shows its tile text at EVERY width now, and the rule is unconditional.**
	 * Board 01's tiles carry a visible label under the icon, so this rule inverts wave 11's — which
	 * hid the same class unconditionally for the toolbar-shaped reason recorded in this partial's own
	 * header. `designer-toolbar.css` still hides `.rp-designer-tool-label` below 80rem for the
	 * TOOLBAR, and that rule reaches this class too since it is unqualified beyond
	 * `.renovation-asset-designer` — so this rule has to win at equal specificity by import order
	 * (`designer-add.css` after `designer-toolbar.css` in `styles/index.css`) rather than merely
	 * existing, which is why `display: block` is asserted rather than the property's mere presence.
	 *
	 * Declared and unrendered: jsdom applies no container query and computes no width, so this is a
	 * statement about the stylesheet and never about a rendered rail.
	 *
	 * Scoped to the rules that NAME this selector, not to the partial, for the reason the
	 * predecessor of this case gave: a legitimate future `@container` about the rail's own width
	 * would otherwise redden a case named for the label.
	 */
	it('shows the rail’s tile label text at every width, unconditionally', () => {
		const rules = partial();
		const wanted = spelled('.rp-designer-add .rp-designer-tool-label');
		const conditions = rules.filter((rule) => rule.selectors.map(show).includes(wanted)).map((rule) => rule.condition);

		expect(declared(rules, '.rp-designer-add .rp-designer-tool-label', 'display')).toEqual(parsed('display', 'block'));
		// One rule names it, and that rule sits under no condition. Listing the conditions rather
		// than counting them means an added `@container` copy of this selector fails by showing its
		// own prelude, which a length assertion would report as a bare number.
		expect(conditions).toEqual(['']);
	});

	/**
	 * **The tile: icon above label.** `DesignerToolButton`'s own docblock says whether the label
	 * shows is the container's decision and not the component's — this is the other half of that
	 * decision, the row-to-column flip that turns the same markup into a tile instead of the
	 * toolbar's icon-beside-text row. Element-qualified for the reason the display/align-items rule
	 * beside it already is: nothing else in this file carries `.rp-designer-tool-button` on a
	 * non-`<button>` element, but the convention is kept rather than broken for one rule.
	 */
	it('stacks each tile’s icon above its label instead of beside it', () => {
		const rules = partial();

		expect(declared(rules, '.rp-designer-add button.rp-designer-tool-button', 'flex-direction')).toEqual(parsed('flex-direction', 'column'));
	});

	/**
	 * **Fix round: the tile sizes to its OWN content instead of Obsidian's fixed button height.**
	 * `tests/harness/obsidian.css`'s base `button` rule sets `height: var(--input-height)` and
	 * `white-space: nowrap` at element specificity, which this element-qualified rule outranks. The
	 * integrator's 460px stacked-leaf capture found "Draw rectangle" painted OVER the circle tile's
	 * icon in the row underneath — a fixed height too short for an icon stacked above a wrapped
	 * label, with the overflow simply painting past the box rather than clipping (no `overflow`
	 * declared). `white-space: normal` is the other half: `nowrap` is what forced a whole label onto
	 * one unbreakable line, which is the ROOT CAUSE the grid test below is the other side of.
	 */
	it('sizes the tile to its own icon-and-label content instead of Obsidian’s fixed button height', () => {
		const rules = partial();

		expect(declared(rules, '.rp-designer-add button.rp-designer-tool-button', 'height')).toEqual(parsed('height', 'auto'));
		expect(declared(rules, '.rp-designer-add button.rp-designer-tool-button', 'white-space')).toEqual(parsed('white-space', 'normal'));
	});

	/**
	 * **Two columns, one when the rail itself is too narrow to hold them — `minmax(0, 1fr)`, not
	 * bare `1fr`.** The integrator's 176px capture measured tile boxes [8,146,98] and [110,146,146]:
	 * two UNEQUAL columns summing to 244px in a ~160px content box. `repeat(2, 1fr)` is
	 * `repeat(2, minmax(auto, 1fr))`, and combined with the button's inherited `white-space: nowrap`
	 * (fixed above), each column's `auto` floor became its longest label's unbroken width rather
	 * than an equal half of the container. `minmax(0, 1fr)` removes that floor so both tracks split
	 * the container exactly in half regardless of content, and the label wraps inside that fixed
	 * width instead of forcing it wider.
	 *
	 * The degrade is a container query keyed to `.rp-designer-add`'s OWN width (`rp-designer-add`)
	 * rather than to the outer `rp-designer` container `designer-narrow.css` and
	 * `designer-toolbar.css` already query — the outer container measures the whole leaf, and "the
	 * rail is narrow" is a fact about the rail, not about the leaf holding it. 9rem sits between the
	 * two rail widths this card's report predicts (176px and 123px, minus the parts panel's 2×8px
	 * padding): wide enough that the 176px case keeps two columns and narrow enough that the 123px
	 * case does not.
	 *
	 * **No `align-items` override (final-fix-wave item 5).** A prior round set `align-items: start`
	 * so a one-line tile would not stretch to a two-line neighbour's height; the integrator's
	 * capture found that trade producing the opposite defect — two tiles in the same row at 58px
	 * and 73px, reading as uneven, loose buttons rather than one grid. Grid's own default `stretch`
	 * is what `.rp-designer-placement-modes` already uses for the identical shape.
	 */
	it('lays the tiles out as a two-column grid, one column once the rail itself is too narrow', () => {
		const rules = partial();
		const narrow = container('rp-designer-add (width < 9rem)');

		expect(declared(rules, '.rp-designer-add-shapes', 'display')).toEqual(parsed('display', 'grid'));
		expect(declared(rules, '.rp-designer-add-shapes', 'grid-template-columns')).toEqual(parsed('grid-template-columns', 'repeat(2, minmax(0, 1fr))'));
		expect(declared(rules, '.rp-designer-add-shapes', 'align-items')).toEqual([]);
		expect(declared(rules, '.rp-designer-add-shapes', 'grid-template-columns', narrow)).toEqual(parsed('grid-template-columns', 'minmax(0, 1fr)'));
	});

	/**
	 * The container itself: `.rp-designer-add` has to declare `container-type`/`container-name`
	 * for the query above to resolve against the RAIL's width rather than falling through to the
	 * outer `rp-designer` container and measuring the leaf instead.
	 */
	it('makes the Add section its own query container, named for the query above', () => {
		const rules = partial();

		expect(declared(rules, '.rp-designer-add', 'container-type')).toEqual(parsed('container-type', 'inline-size'));
		expect(declared(rules, '.rp-designer-add', 'container-name')).toEqual(parsed('container-name', 'rp-designer-add'));
	});

	/**
	 * **Fix round: a long word must wrap inside its fixed-width track rather than overflow it.**
	 * `minmax(0, 1fr)` above fixes the TRACK's width; this is what stops the label's own text from
	 * escaping that fixed width once `white-space: normal` lets it wrap at all.
	 */
	it('lets a tile’s label break anywhere rather than overflow its fixed-width column', () => {
		const rules = partial();

		expect(declared(rules, '.rp-designer-add .rp-designer-tool-label', 'overflow-wrap')).toEqual(parsed('overflow-wrap', 'anywhere'));
	});

	/**
	 * **Fix round: the glyph reads as the tile's own picture, not a small mark beside text.** Board
	 * 01 draws roughly 24–32px icons; `.rp-host-icon`'s own default (`editor-icons.css`) is 18px,
	 * sized for sitting beside a line of text. Scoped through the `--icon-size` custom property
	 * `.rp-host-icon` already reads — the convention every other per-surface icon size in this
	 * codebase follows (e.g. `editor-reference.css`'s `.rp-floor-start > button > .rp-host-icon`) —
	 * rather than a new prop on `HostIcon.vue`, so the toolbar's own 18px glyphs are untouched.
	 */
	it('draws the tile’s glyph larger than the toolbar’s icon-beside-text one', () => {
		const rules = partial();

		expect(declared(rules, '.rp-designer-add .rp-designer-tool-button .rp-host-icon', '--icon-size')).toEqual(parsed('--icon-size', '28px'));
	});

	/**
	 * Every rule here that flattens a button gives its focus indicator back, which is the category
	 * `tests/build/buttonFocusRing.test.ts` holds across the project — repeated at this file's own
	 * two controls because the pair is easy to add one of and forget the other, and this partial
	 * introduced both in one edit.
	 */
	it.each(['.rp-designer-add .rp-designer-tool-button', '.rp-designer-add .rp-designer-start-preset'])(
		'gives %s a visible focus ring to replace the one it removes',
		(selector) => {
			const rules = partial();

			expect(declared(rules, selector, 'box-shadow')).toEqual(parsed('box-shadow', 'none'));
			expect(declared(rules, `${selector}:focus-visible`, 'outline')).toEqual(parsed('outline', '2px solid var(--interactive-accent)'));
		},
	);
});
