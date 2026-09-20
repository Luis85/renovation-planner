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
	 * whole rather than re-invented, which is why the name is still `designer.shapes.group`.
	 *
	 * Membership is read against the tool table for the reason the toolbar's version of this case
	 * gave: a tool re-grouped in the table must MOVE the group rather than appear inside it, and a
	 * case pinned to four hand-written names could not tell those two apart.
	 */
	it('holds them in one named group, under the label wave 10 minted for it', async () => {
		const rig = await railOpen();
		const group = rig.wrapper.find('.rp-designer-add > .rp-designer-add-shapes');

		expect(group.attributes('role')).toBe('group');
		expect(group.attributes('aria-label')).toBe(t('en', 'designer.shapes.group'));
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

describe('what the Add rail’s stylesheet declares', () => {
	/**
	 * **The rail hides its button text at EVERY width, and the rule is unconditional.** Both halves
	 * matter. `designer-toolbar.css` hides the same class only below 80rem, which is a measurement
	 * of the toolbar's row count and governs nothing here; inheriting it would draw four labelled
	 * buttons at 80rem and wider in a column whose own declared cap is `min(11rem, 22cqi)`. So the
	 * declaration must exist, and it must NOT be inside a container query — a rule that acquired
	 * one would silently restore the labelled state at exactly the widths the cap is tightest at.
	 *
	 * Declared and unrendered: jsdom applies no container query and computes no width, so this is a
	 * statement about the stylesheet and never about a rendered rail.
	 */
	it('hides the rail’s button text with no container query around it', () => {
		const rules = partial();

		expect(declared(rules, '.rp-designer-add .rp-designer-tool-label', 'display')).toEqual(parsed('display', 'none'));
		expect(rules.filter((rule) => rule.condition !== '')).toEqual([]);
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
