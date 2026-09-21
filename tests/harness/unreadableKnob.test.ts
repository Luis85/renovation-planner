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
 * layers in this order over this base — it calls the factories itself, one hop from line 868's
 * chain — and it cannot see a layer added later, because the list below is written by hand. The
 * case above is the end-to-end half for exactly that reason; this one is the census.
 *
 * `?downstream` is absent because it is not reachable alone: `downstreamWorkspace` takes a
 * `referenceWorkspace` as its base and overrides no zone read of its own, so it inherits the
 * `0` on this table's `reference` row.
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
 * The SAME rule for the base bundle's other knob, because the docblock states it as a rule about
 * where a knob is armed rather than as a fact about `?unreadable` — and a sentence wider than its
 * check is the defect this file exists to close, not one to reproduce one knob over.
 *
 * `?stale` arms `getPlan`: the SECOND read and every one after it fail. So the partition is
 * different from the table above even though the rule is the same — `?detail` and
 * `?numericArea` leave `getPlan` alone or wrap it and keep the knob, and only `?reference`
 * replaces it outright. Two reads per layer is the whole instrument: one to get past the first,
 * one to ask whether the knob armed.
 */
it('names which composition layers keep ?stale and which discard it', async () => {
	expect({
		'base (?stale alone)': await secondReadRefuses(armedStale()),
		'?detail': await secondReadRefuses(detailPlanDeps(armedStale())),
		'?numericArea / ?roomResize / ?roomNaming / ?outline': await secondReadRefuses(areaNumericWorkspace(armedStale(), HARNESS_PLAN, HARNESS_ZONES)),
		'?reference': await secondReadRefuses(referenceWorkspace(armedStale(), HARNESS_PLAN).deps),
	}).toEqual({
		'base (?stale alone)': true,
		'?detail': true,
		'?numericArea / ?roomResize / ?roomNaming / ?outline': true,
		'?reference': false,
	});
});
