/**
 * @vitest-environment jsdom
 *
 * `?unreadable=N` — the knob that makes the `unreadable-zones` warning row, and the
 * **Show diagnostics report** button it carries, drawable outside a vault at all. The count was
 * hard-coded to `0` before, so no harness state could reach this row.
 *
 * **The third case is the point of the file.** `PlanEditorHarnessOptions`' own header used to
 * promise every knob was independent, and this one is not: it is armed inside `harnessDeps`'s
 * `findZonesByPlan`, and `mountPlanEditorHarness` composes later layers OVER that bundle. A
 * layer that REPLACES that query rather than wrapping it answers its own `unreadable`, and the
 * count this knob set is gone with no error anywhere. The docblock now states that rule; this
 * file is what re-runs it.
 */
import { beforeEach, expect, it } from 'vitest';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { HARNESS_PLAN, HARNESS_ZONES, harnessDeps, mountPlanEditorHarness } from './planEditor';
import { detailedZoneDeps, detailPlanDeps, lockedZoneDeps, treePlanDeps } from './detailPlanKnob';
import { roomsDeps } from './roomsKnob';
import { areaNumericWorkspace } from './areaNumericWorkspace';
import { referenceWorkspace } from './referenceWorkspace';
import { installCanvas } from '../helpers/canvas';
import { installResizeObserver } from '../helpers/layout';
import { settleUntil, sizedShellRoot } from '../helpers/editor';
import { expectOk } from '../helpers/domain';

const ROW = '[data-rp-warning="unreadable-zones"]';
const DIAGNOSTICS_BUTTON = `${ROW} button[data-rp-action="open-diagnostics"]`;

/** A base bundle with `?stale` armed — one per layer under test, since the knob counts reads. */
const armedStale = (): PlanEditorDeps => harnessDeps({ stale: true });

/** `?stale`'s whole observable effect: the SECOND `getPlan` refuses. One read to get past the first. */
async function secondReadRefuses(deps: PlanEditorDeps): Promise<boolean> {
	await deps.queries.getPlan(HARNESS_PLAN.id);
	return !(await deps.queries.getPlan(HARNESS_PLAN.id)).ok;
}

beforeEach(() => {
	document.body.innerHTML = '';
});

it('?unreadable=2 draws the unreadable-zones row and its diagnostics button', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl } = mountPlanEditorHarness(document.body, { unreadable: 2 });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector(DIAGNOSTICS_BUTTON) !== null, 'the unreadable row and its button');
	// The COUNT, not merely the row: the knob's whole job is to put N into the message, and a
	// row drawn at any count would satisfy the selector above.
	expect(leafEl.querySelector(ROW)?.textContent).toContain('2');
});

/**
 * The incompatibility at the surface a capture-taker meets it. `?detail` replaces the zone read
 * wholesale (`detailPlanKnob.ts`), so `?detail&unreadable=2` draws NO row, no button and no
 * error — the page simply comes up without the thing the URL asked for.
 *
 * The wait is on the `?detail` knob's OWN marker rather than on the absent row: waiting for
 * something that never arrives is a timeout dressed as an assertion, and would take this case's
 * whole budget to say nothing. Settling on the parent-zone guide proves the editor hydrated
 * through the detail-plan layer, and the absence is then read from a page that is finished.
 */
it('?detail discards ?unreadable — a layer that replaces the zone read drops it', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl } = mountPlanEditorHarness(document.body, { detail: true, unreadable: 2 });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector('.rp-floor-inspector__guide') !== null, 'the ?detail parent-zone guide');
	expect(leafEl.querySelector(ROW)).toBeNull();
});

/**
 * The RULE, stated as a partition over every layer `mountPlanEditorHarness` composes rather than
 * as one more example, and asserted in ONE `toEqual` so it holds in both directions: a replacing
 * layer that started carrying the count through reddens here just as loudly as a wrapping layer
 * that stopped.
 *
 * **What this case can see:** the answer `findZonesByPlan` gives for each layer built directly
 * over a base armed at 7. **What it cannot:** that `mountPlanEditorHarness` still composes these
 * layers in this order over this base — it calls the factories itself, one hop from the
 * `const base = harnessDeps(…)` chain at the top of `mountPlanEditorHarness` — and it cannot see
 * a layer added later, because the list below is written by hand. The case above is the
 * end-to-end half for exactly that reason; this one is the census.
 *
 * **`?downstream` is absent from this table and from the `?stale` one below, and NOT because it
 * inherits anything** — the note that said so was wrong about the mechanism. `downstreamWorkspace`
 * is not a layer over this base at all: it builds `queries` from a real composition root
 * (`planEditorDeps(root, …)`) and spreads `reference.deps.queries` into nothing, so it replaces
 * BOTH queries outright and discards both knobs. It takes a host element, an async fixture scan
 * and a whole plugin root to construct, which is why it is read from the code here rather than
 * re-run; the `0` it would answer agrees with this table's `reference` row by COINCIDENCE — both
 * read the same fixture vault — and nothing holds the two together.
 */
it('names which composition layers keep ?unreadable and which discard it', async () => {
	const base = harnessDeps({ unreadable: 7 });
	const layers: Readonly<Record<string, PlanEditorDeps>> = {
		'base (?unreadable alone)': base,
		'?locked': lockedZoneDeps(base, ['harness-kitchen']),
		'?detailed': detailedZoneDeps(base, ['harness-kitchen']),
		'?rooms': roomsDeps(base, 2),
		'?tree': treePlanDeps(base),
		'?detail': detailPlanDeps(base),
		'?numericArea / ?roomResize / ?roomNaming / ?outline': areaNumericWorkspace(base, HARNESS_PLAN, HARNESS_ZONES),
		'?reference': referenceWorkspace(base, HARNESS_PLAN).deps,
	};

	const answered: Record<string, number> = {};
	for (const [knob, deps] of Object.entries(layers)) {
		answered[knob] = expectOk(await deps.queries.findZonesByPlan(HARNESS_PLAN.id)).unreadable;
	}

	expect(answered).toEqual({
		'base (?unreadable alone)': 7,
		'?locked': 7,
		'?detailed': 7,
		'?rooms': 7,
		'?tree': 7,
		'?detail': 0,
		'?numericArea / ?roomResize / ?roomNaming / ?outline': 0,
		'?reference': 0,
	});
});

/**
 * The SAME rule for the base bundle's other knob, over the SAME seven layers, because the
 * docblock states it as a rule about where a knob is armed rather than as a fact about
 * `?unreadable` — and a sentence wider than its check is the defect this file exists to close,
 * not one to reproduce one knob over.
 *
 * **This table carried four rows while that docblock's `only` quantified over all seven**, which
 * is the same overclaim one table further in: a mutation making `?rooms` REPLACE `getPlan` — the
 * precise defect the sentence forbids — left this file at 4 passed. Both tables name the same
 * seven layers now, so the two blind-spot notes above are true of both.
 *
 * `?stale` arms `getPlan`: the SECOND read and every one after it fail. The ANSWER differs from
 * the table above even though the rule and the layers are the same — only `?reference` replaces
 * `getPlan`, where three layers replace `findZonesByPlan`. Two reads per layer is the whole
 * instrument: one to get past the first, one to ask whether the knob armed — and each layer gets
 * a base of its OWN, because that counter lives in the bundle.
 */
it('names which composition layers keep ?stale and which discard it', async () => {
	const layers: Readonly<Record<string, PlanEditorDeps>> = {
		'base (?stale alone)': armedStale(),
		'?locked': lockedZoneDeps(armedStale(), ['harness-kitchen']),
		'?detailed': detailedZoneDeps(armedStale(), ['harness-kitchen']),
		'?rooms': roomsDeps(armedStale(), 2),
		'?tree': treePlanDeps(armedStale()),
		'?detail': detailPlanDeps(armedStale()),
		'?numericArea / ?roomResize / ?roomNaming / ?outline': areaNumericWorkspace(armedStale(), HARNESS_PLAN, HARNESS_ZONES),
		'?reference': referenceWorkspace(armedStale(), HARNESS_PLAN).deps,
	};

	const armed: Record<string, boolean> = {};
	for (const [knob, deps] of Object.entries(layers)) {
		armed[knob] = await secondReadRefuses(deps);
	}

	expect(armed).toEqual({
		'base (?stale alone)': true,
		'?locked': true,
		'?detailed': true,
		'?rooms': true,
		'?tree': true,
		'?detail': true,
		'?numericArea / ?roomResize / ?roomNaming / ?outline': true,
		'?reference': false,
	});
});
