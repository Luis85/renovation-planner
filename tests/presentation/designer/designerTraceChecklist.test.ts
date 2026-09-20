/**
 * @vitest-environment jsdom
 *
 * The guided trace checklist (AD18 item 7) and the Reference tab panel that used to be empty.
 *
 * **What this file can and cannot see.** jsdom lays nothing out, so nothing here is a measurement
 * of how the checklist LOOKS — not the strike-through, not the weight change, not whether five
 * rows fit a 224 px rail. The style block at the end pins what the rules DECLARE, which is the
 * same narrower claim `designerStyles.test.ts` makes about its own partial, and the integrator's
 * browser is the only instrument for the rest.
 *
 * **The step count is ASSERTED, not described.** AD12-R1 deletes board 02's `Lock reference` step
 * and only that one, so this surface owes five steps. A sixth arriving without a ruling turns the
 * first case red — which is the point of pinning the keys in order rather than counting rows and
 * calling it done.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mount, type VueWrapper } from '@vue/test-utils';
import DesignerTraceChecklist from '../../../src/presentation/designer/inspector/DesignerTraceChecklist.vue';
import DesignerReferenceStatus from '../../../src/presentation/designer/inspector/DesignerReferenceStatus.vue';
import type { AssetDesignDto } from '../../../src/application/queries/GetAssetDesign';
import type { AssetShape } from '../../../src/domain/asset/AssetShape';
import { t } from '../../../src/presentation/i18n/strings';
import { assetDesign } from '../../helpers/assetDesign';
/*
 * The shared fixture rather than a hand-spelled literal — one copy fewer, which is ALL this
 * import claims. It is not "the one calibration this suite has", and the first version of this
 * comment said so wrongly: `grep -rln "knownDistance:" tests/` prints **36 files** that spell a
 * `Calibration` of their own, `designerReferencePanels.test.ts` — which mounts the very component
 * the block below mounts — among them. Consolidating those is not this card's change; not adding
 * a 37th is.
 */
import { CALIBRATION } from '../../helpers/assetDesignHarness';
import { propertyOf, show, stylesheetRules, type StyleRule } from '../../helpers/selectors';

/** The five keys, in board order minus AD12-R1's deleted step. Spelled out so the ORDER is pinned too. */
const STEPS = [
	'designer.trace.image',
	'designer.trace.scale',
	'designer.trace.footprint',
	'designer.trace.details',
	'designer.trace.dimensions',
] as const;

const checklist = (design: AssetDesignDto, pendingCount = 0): VueWrapper =>
	mount(DesignerTraceChecklist, { props: { design, pendingCount } });

const rows = (wrapper: VueWrapper): HTMLElement[] =>
	[...wrapper.element.querySelectorAll('.rp-designer-trace-step')].map((row) => row as HTMLElement);

/** The label alone — the visually hidden `Done` is a separate assertion and would otherwise ride along. */
const labelOf = (row: HTMLElement): string => (row.firstChild?.textContent ?? '').trim();

const currentLabels = (wrapper: VueWrapper): string[] =>
	rows(wrapper)
		.filter((row) => row.getAttribute('aria-current') === 'step')
		.map((row) => labelOf(row));

/** A shape carrying everything the last two steps look at, so a case can turn one fact off at a time. */
function completeShape(): AssetShape {
	const design = assetDesign();
	if (design.shape === null) throw new Error('the design fixture lost its shape');
	const outline = { points: [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 5 }] };
	return { ...design.shape, details: [{ id: 'd1', name: 'edge', outline, line: 'solid', pending: false }] };
}

describe('the guided trace checklist', () => {
	it('draws five steps in board order, and no Lock reference step (AD12-R1)', () => {
		const wrapper = checklist(assetDesign());

		expect(rows(wrapper).map((row) => labelOf(row))).toEqual(STEPS.map((key) => t('en', key)));
	});

	/**
	 * The current step is the first one that is not done AND not optional (AD18-R4). `assetDesign()`
	 * carries a sheet and a typed footprint but no calibration, so the step that is owed is the
	 * second one — which is also the case that proves "current" is not "the last done plus one".
	 */
	it('marks exactly one step current, and it is the first step owed', () => {
		const wrapper = checklist(assetDesign());

		expect(currentLabels(wrapper)).toEqual([t('en', 'designer.trace.scale')]);
	});

	/**
	 * Out of order, which is the whole reason the cursor is not derived from how far the user has
	 * got: an asset typed from dimensions has a footprint and its measurements and no sheet at all.
	 * The row that is owed is the first one, not the one after the furthest tick.
	 *
	 * **RE-GRADED against AD18-R4 rather than left standing.** This case pinned the old
	 * first-not-done rule and it is still correct under the new one, for a reason worth stating
	 * rather than inferring from a green run: both `Choose a sheet` and `Calibrate the scale` are
	 * undone and NEITHER is optional, so skipping the optional step changes nothing here. The state
	 * where the two rules disagree is the AD18-R4 case above.
	 */
	it('ticks a step that is done out of order and still points at the first one owed', () => {
		const wrapper = checklist(assetDesign({ background: null, calibration: null }));

		const done = rows(wrapper).filter((row) => row.dataset['rpDone'] === 'true');
		expect(done.map((row) => labelOf(row))).toEqual([t('en', 'designer.trace.footprint'), t('en', 'designer.trace.dimensions')]);
		expect(currentLabels(wrapper)).toEqual([t('en', 'designer.trace.image')]);
	});

	/**
	 * **AD18-R4: `Add details` never becomes the current step.** Interior linework is optional —
	 * plenty of assets are a bare outline — so an asset with a sheet, a scale, a traced footprint
	 * and measured dimensions is FINISHED, and pointing at the one row it skipped would read as
	 * unfinished forever.
	 *
	 * It still TICKS when details exist; only the cursor skips it. Which makes this the same rule
	 * as the all-done case below — a finished sequence has no next thing to do — reached by a
	 * different route.
	 */
	it('never makes the optional Add details the current step (AD18-R4)', () => {
		const wrapper = checklist(assetDesign({ calibration: CALIBRATION }));

		const details = rows(wrapper).find((row) => labelOf(row) === t('en', 'designer.trace.details'));
		expect(details?.dataset['rpDone']).toBe('false');
		expect(wrapper.element.querySelector('[aria-current]')).toBeNull();
	});

	/** A finished sequence has no next thing to do, so nothing is marked rather than the last row. */
	it('marks no step current once all five are done', () => {
		const wrapper = checklist(assetDesign({ calibration: CALIBRATION, shape: completeShape() }));

		expect(rows(wrapper).filter((row) => row.dataset['rpDone'] === 'true')).toHaveLength(5);
		expect(wrapper.element.querySelector('[aria-current]')).toBeNull();
	});

	/**
	 * The last step's name is wider than its check and the component's docblock says so; what it
	 * actually reports is that nothing is left in the sheet's own pixels. A pending group holds it
	 * open even though the dimensions are there to read.
	 */
	it('leaves the last step open while any coordinate group is still in sheet pixels', () => {
		const wrapper = checklist(assetDesign({ calibration: CALIBRATION, shape: completeShape() }), 1);

		const last = rows(wrapper).at(-1);
		expect(last?.dataset['rpDone']).toBe('false');
		expect(last?.getAttribute('aria-current')).toBe('step');
	});

	/**
	 * The strike-through is CSS and `data-rp-done` is announced by nothing, so a finished row
	 * carries the one word off-screen. An unfinished row carries no state word at all — an unmarked
	 * checklist item already reads as undone.
	 */
	it('announces a finished step and says nothing extra about an unfinished one', () => {
		const wrapper = checklist(assetDesign());

		const [image, scale] = rows(wrapper);
		expect(image?.querySelector('.rp-visually-hidden')?.textContent).toBe(t('en', 'designer.trace.done'));
		expect(scale?.querySelector('.rp-visually-hidden')).toBeNull();
	});

	/**
	 * **The "read off the design, never stored" invariant, which the component docblock asserts and
	 * nothing was checking.** Every other case here mounts fresh, so all of them would stay green
	 * against a component that snapped its progress at setup and kept it.
	 *
	 * `setProps` is the instrument because it is the shape the real surface takes: the design is a
	 * prop all the way down from `AssetDesignerRoot`, and `withStateRefresh` and the cross-leaf
	 * event both land as a NEW `AssetDesignDto` on the same mounted tree — never as a remount. So a
	 * cursor cached at setup would survive a peer leaf's calibration and go on pointing at
	 * `Calibrate the scale` over a sheet that now has a scale.
	 *
	 * Both directions, because a one-way case passes against a component that only ever advances:
	 * a calibration arrives and the cursor moves on, then the reference is taken away again and the
	 * cursor goes BACK to the first step.
	 */
	it('re-reads the design on every change rather than remembering where the user was', async () => {
		const wrapper = checklist(assetDesign());
		expect(currentLabels(wrapper)).toEqual([t('en', 'designer.trace.scale')]);

		// A calibration finishes every non-optional step, so under AD18-R4 the cursor goes away
		// rather than landing on `Add details`.
		await wrapper.setProps({ design: assetDesign({ calibration: CALIBRATION }) });
		expect(currentLabels(wrapper)).toEqual([]);

		await wrapper.setProps({ design: assetDesign({ background: null, calibration: null }) });
		expect(currentLabels(wrapper)).toEqual([t('en', 'designer.trace.image')]);
	});

	/**
	 * A real `<ol>` of real `<li>`s, so position and total come from the list. The accessibility
	 * gate found the Plan Editor getting this wrong the other way — `aria-label` on role-less
	 * `<div>`s — and pinning the elements is cheaper than waiting for axe to disagree.
	 */
	it('is an ordered list of list items, not labelled divs', () => {
		const wrapper = checklist(assetDesign());

		expect(wrapper.element.querySelector('ol.rp-designer-trace-steps')).not.toBeNull();
		expect(rows(wrapper).map((row) => row.tagName)).toEqual(['LI', 'LI', 'LI', 'LI', 'LI']);
	});
});

describe('the Reference tab panel', () => {
	const removeBackground = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

	/**
	 * **The gap this card was given.** `DesignerInspector.vue`'s own template comment records it:
	 * for an asset typed from dimensions with no sheet, `DesignerReferenceStatus` drew nothing and
	 * the Reference tab was an empty panel.
	 *
	 * The facts block still draws nothing in that state — a block of "none" rows would be the noise
	 * its docblock always said it would be — so this asserts BOTH halves: the facts are still
	 * absent, and the panel is no longer empty.
	 */
	it('draws the guide where the panel used to draw nothing at all', () => {
		const design = assetDesign({ background: null, calibration: null });
		const wrapper = mount(DesignerReferenceStatus, { props: { design, removeBackground } });

		expect(wrapper.find('.rp-designer-reference').exists()).toBe(false);
		expect(rows(wrapper)).toHaveLength(5);
		expect(currentLabels(wrapper)).toEqual([t('en', 'designer.trace.image')]);
	});

	/**
	 * The pending count reaches the guide from the block that already derives it, so the two cannot
	 * disagree about whether anything is still in sheet pixels. Asserted through the real parent
	 * rather than by handing the child a number, which would test the number.
	 */
	it('takes its pending count from the facts block beside it', () => {
		const shape: AssetShape = { ...completeShape(), footprintOrigin: 'traced', footprintPending: true };
		const design = assetDesign({ calibration: CALIBRATION, shape });
		const wrapper = mount(DesignerReferenceStatus, { props: { design, removeBackground } });

		expect(wrapper.findAll('.rp-designer-unscaled')).toHaveLength(1);
		expect(rows(wrapper).at(-1)?.dataset['rpDone']).toBe('false');
	});

	/** Heading order, which axe grades: the guide's own `h3` never precedes the panel's own. */
	it('gives the guide its own h3, after the facts block’s', () => {
		const wrapper = mount(DesignerReferenceStatus, { props: { design: assetDesign(), removeBackground } });

		expect([...wrapper.element.querySelectorAll('h3')].map((heading) => heading.textContent?.trim())).toEqual([
			t('en', 'designer.reference'),
			t('en', 'designer.trace'),
		]);
	});
});

describe('what the trace partial declares', () => {
	const rules: StyleRule[] = stylesheetRules(readFileSync('styles/designer-trace.css', 'utf8'));

	const declared = (selector: string, property: string): unknown[] =>
		rules
			.filter((rule) => rule.condition === '' && rule.selectors.map(show).includes(selector))
			.flatMap((rule) => rule.declarations.filter((declaration) => propertyOf(declaration) === property));

	/**
	 * **A DECLARATION, not an appearance.** jsdom resolves no CSS and there is no pinned Chromium
	 * here, so what this proves is that a rule for each state exists and carries a cue that is not
	 * a colour — a strike on the finished rows and a weight on the current one. Whether either is
	 * legible is the integrator's browser to answer.
	 */
	it.each([
		['.rp-designer-trace-step[data-rp-done="true"]', 'text-decoration'],
		['.rp-designer-trace-step[aria-current="step"]', 'font-weight'],
	])('distinguishes %s by something other than colour', (selector, property) => {
		expect(declared(selector, property)).toHaveLength(1);
	});
});
