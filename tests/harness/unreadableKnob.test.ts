/**
 * @vitest-environment jsdom
 *
 * `?unreadable=N` — the knob that makes the `unreadable-zones` warning row, and the
 * **Show diagnostics report** button it carries, drawable outside a vault at all. The count was
 * hard-coded to `0` before, so no harness state could reach this row.
 *
 * **It answers a refusal COUNT and drops those N zones**, and for a while it only did the first:
 * four polygons were drawn under a strip saying two of them were never read, and the Floor
 * Inspector summed all four under the same claim. `unreadableKnob.ts` owns which zones go; the
 * cases here hold both halves, at the fixture altitude and through a real mount.
 *
 * **"names which composition layers keep ?unreadable" is the other point of the file.**
 * `PlanEditorHarnessOptions`' own header used to
 * promise every knob was independent, and this one is not: it is armed inside `harnessDeps`'s
 * `findZonesByPlan`, and `mountPlanEditorHarness` composes later layers OVER that bundle. A
 * layer that REPLACES that query rather than wrapping it answers its own `unreadable`, and the
 * count this knob set is gone with no error anywhere. The docblock now states that rule; this
 * file is what re-runs it.
 */
import { beforeEach, expect, it } from 'vitest';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { HARNESS_PLAN, HARNESS_STRUCTURE, HARNESS_ZONES, harnessDeps, mountPlanEditorHarness } from './planEditor';
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
	// And the half of the picture that row was CONTRADICTING. The strip said two zones "are not
	// drawn" while every seeded zone was still listed; asserting the row alone is what let that
	// stand. More than one region of the Inspector draws this list, so the total is a MULTIPLE of
	// the surviving zone count rather than the count itself — measured at both ends: 8 rows for
	// the unpruned four, 4 for the two that load.
	expect(leafEl.querySelectorAll('.rp-room-list__row')).toHaveLength(4);
});

/**
 * The combination the prune MADE REACHABLE, and the only behaviour change outside the knob
 * itself. `?select=` on a zone this knob just refused finds no row: that ended `row?.click()` —
 * a silent no-op — so the capture would have photographed the UNSELECTED editor under a selected
 * shot's name and exited 0. `selectZoneOnceReady` throws now, exactly as its multi-id sibling
 * `selectMultipleOnceReady` already did.
 *
 * Asserted through `view.onClose()` because that is where the knob's rejection is REPLAYED
 * (`guardKnob`), which is what turns it into a named failure rather than a process-level
 * unhandled rejection — the mechanism `knobRejectionIsolation.test.ts` proves for the multi-id
 * path, met here from the single-id one. Driven both ways before it was written: `onClose`
 * resolved silently against `row?.click()` and rejects with this message against the throw.
 */
it('?select= on a zone ?unreadable just refused fails loudly rather than silently', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl, view } = mountPlanEditorHarness(document.body, { unreadable: 2, select: 'harness-terrace' });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector(DIAGNOSTICS_BUTTON) !== null, 'the unreadable row');
	await expect(view.onClose()).rejects.toThrow('No selection row for harness-terrace');
});

/**
 * The prunable set's OTHER precondition, and the one no structure assertion can reach:
 * `harness-garden` is `planEditor.ts`'s `STALE_TRIGGER_ZONE_ID`, so it must survive at every `N`
 * or `?stale` loses the zone it selects, deletes and waits on.
 *
 * `view.onClose()` IS the assertion, because it awaits every knob this mount started and replays
 * whichever one rejected: resolving means `driveStaleKnobOnceReady` selected the Garden, clicked
 * its Delete and saw the stale-projection warning land, all of it beside two refused notes.
 *
 * Measured as a mutation rather than argued: with `harness-garden` put into the prunable set,
 * this rejects with `No selection row for harness-garden` — and it rejects FAST, at the selection,
 * rather than timing out on a Delete button that never arrives, which is what the same mutation
 * did before the case above gave that path its throw.
 */
it('?stale survives ?unreadable — its own sacrifice zone is never pruned', async () => {
	installCanvas();
	installResizeObserver();
	const { leafEl, view } = mountPlanEditorHarness(document.body, { stale: true, unreadable: 2 });
	sizedShellRoot(leafEl);
	await settleUntil(() => leafEl.querySelector(DIAGNOSTICS_BUTTON) !== null, 'the unreadable row');
	await expect(view.onClose()).resolves.toBeUndefined();
});

/**
 * The ANSWER, at the fixture altitude the captures are taken through. A real listing hands back
 * the notes that LOADED plus a count of the ones that refused; this fake answered the whole
 * fixture with a count bolted on, so the canvas drew four polygons under a strip saying two of
 * them were never read.
 *
 * The surviving ids are named rather than counted: WHICH two survive is the decision
 * `unreadableKnob.ts` makes and the one a later reader is most likely to change by accident.
 */
it('?unreadable=2 answers the zones that loaded, not the whole fixture', async () => {
	const found = expectOk(await harnessDeps({ unreadable: 2 }).queries.findZonesByPlan(HARNESS_PLAN.id));
	expect(found.zones.map((zone) => zone.id)).toEqual(['harness-kitchen', 'harness-garden']);
	expect(found.unreadable).toBe(2);
});

/**
 * What the prune is FOR, and the one case here that outlives a change to the prunable set:
 * drawn plus refused is the plan's zone count, at every `N` the knob takes. Stated over the
 * range rather than at a value, so extending the set keeps this honest instead of stale.
 *
 * `structure` is deliberately NOT part of it. The real query reads it from the per-plan geometry
 * sidecar, independently of which zone notes loaded, so it stays whole at every `N` — see
 * `harnessDeps`.
 */
it('drawn plus refused is the whole fixture, at every N', async () => {
	const totals: Record<number, number> = {};
	for (const n of [0, 1, 2]) {
		const found = expectOk(await harnessDeps({ unreadable: n }).queries.findZonesByPlan(HARNESS_PLAN.id));
		totals[n] = found.zones.length + found.unreadable;
		expect(found.structure?.walls).toHaveLength(HARNESS_STRUCTURE.walls.length);
	}
	expect(totals).toEqual({ 0: HARNESS_ZONES.length, 1: HARNESS_ZONES.length, 2: HARNESS_ZONES.length });
});

/**
 * Above the fixture's maximum the knob REFUSES rather than clamping, synchronously, inside
 * `harnessDeps` — so a jsdom case sees it here and a real capture records a page error that
 * `harness-shot` exits non-zero on. Clamping would photograph a two-refusal state under a
 * seven-refusal URL and exit 0.
 *
 * One regex over both halves the message owes a reader: the maximum, and the set to ask for
 * instead.
 */
it('refuses an N above the prunable set rather than clamping to it', () => {
	expect(() => harnessDeps({ unreadable: 3 })).toThrow(/maximum of 2.*harness-bath, harness-terrace/);
});

/**
 * The prunable set's own PRECONDITION, made re-runnable: the zones this knob drops are named by
 * nothing in `HARNESS_STRUCTURE`, so pruning them leaves no wall hosted on a zone that is gone
 * and no boundary naming one.
 *
 * **Narrower than the argument the set actually rests on**, and the gap is worth stating: this
 * is an ID check. It reddens the day somebody gives the Terrace a `boundaries` entry; it does
 * not see a wall DRAWN inside the Terrace's polygon, which is geometry no assertion here
 * measures. The pruned ids are derived from the answer rather than re-listed, so a change to the
 * set arrives here rather than passing over a copy of it.
 */
it('no zone this knob prunes is named anywhere in the structure', async () => {
	const found = expectOk(await harnessDeps({ unreadable: 2 }).queries.findZonesByPlan(HARNESS_PLAN.id));
	const surviving = new Set(found.zones.map((zone) => zone.id));
	const pruned = HARNESS_ZONES.map((zone) => zone.id).filter((id) => !surviving.has(id));
	expect(pruned).toEqual(['harness-bath', 'harness-terrace']);

	const named = [
		...HARNESS_STRUCTURE.boundaries.map((boundary) => boundary.roomId),
		...HARNESS_STRUCTURE.walls.map((wall) => wall.id),
		...HARNESS_STRUCTURE.openings.map((opening) => opening.hostId),
	];
	expect(named.filter((id) => pruned.includes(id))).toEqual([]);
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
 * **It names the ZONE COUNT beside the count of refusals**, because the knob now does two things
 * and a layer could carry one without the other — and because no case here had mounted
 * `?unreadable` with `?rooms`, `?locked`, `?detailed` or `?tree` at all. The base is armed at the
 * fixture's maximum rather than at a distinctive 7: an `N` above it now refuses (see the case
 * above), which is what took 7 away.
 *
 * **What this case can see:** the answer `findZonesByPlan` gives for each layer built directly
 * over that base. **What it cannot:** that `mountPlanEditorHarness` still composes these
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
	const base = harnessDeps({ unreadable: 2 });
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

	const answered: Record<string, string> = {};
	for (const [knob, deps] of Object.entries(layers)) {
		const found = expectOk(await deps.queries.findZonesByPlan(HARNESS_PLAN.id));
		answered[knob] = `${found.zones.length} zones, ${found.unreadable} unreadable`;
	}

	expect(answered).toEqual({
		'base (?unreadable alone)': '2 zones, 2 unreadable',
		'?locked': '2 zones, 2 unreadable',
		'?detailed': '2 zones, 2 unreadable',
		'?rooms': '4 zones, 2 unreadable',
		'?tree': '2 zones, 2 unreadable',
		'?detail': '0 zones, 0 unreadable',
		'?numericArea / ?roomResize / ?roomNaming / ?outline': '4 zones, 0 unreadable',
		'?reference': '0 zones, 0 unreadable',
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
