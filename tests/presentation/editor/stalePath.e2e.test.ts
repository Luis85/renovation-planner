/**
 * @vitest-environment jsdom
 *
 * **Scenario D, end to end, through the real mounted Plan Editor** — design spec §7 case 3:
 * *"Create a room; the read-back refuses; the room is in the repository and the pre-command
 * scene is drawn; Add's entries, Delete and Create are `aria-disabled` with the reason; a
 * Select drag draws no ghost and commits nothing; Undo removes the room (live while stale);
 * Try again refuses once, then succeeds; the strip, the label, and every pause clear; the
 * write count across all of it is exactly what the gestures owed."*
 *
 * Every piece of that has its own node test — the gate against a flag, the strip against a
 * warning list, each paused surface against a store field set by hand. NONE of them drives
 * the chain: a real write into a real repository, a real refresh that really fails, the store
 * field that failure really sets, and every surface that really reads it. The defects this
 * file can see are the ones living BETWEEN those green tasks — a gate wired after the wrong
 * decorator, a retry that replays a write, a pause whose attribute is right and whose
 * behaviour is not.
 *
 * **The order below is not the brief's, and the reason is that the brief's order cannot
 * discriminate.** `withStateRefresh` wraps `undo` as well as `run`, so the Undo the scenario
 * performs re-reads too — and that read fails while the canvas is ALREADY stale, which is
 * exactly what `ProjectStore` counts as a failed retry. Asserting the `.again` message swap
 * after the Undo would therefore have been true of a build where Try again did nothing at
 * all. The retry pair is driven BEFORE the Undo instead, so the message swap is attributable
 * to the button that was pressed.
 *
 * Geometry note (`planEditorRig`'s): `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so
 * world = 10 × screen − 480 per axis at the default camera, and the fixture zone's world rect
 * (1500..4400)² has the screen footprint (198,198)-(488,388).
 *
 * **What no case here can see.** jsdom lays nothing out, so nothing below grades where the
 * strip, the label or the paused controls appear — only that they are in the tree and that
 * pressing them does what it says.
 */
import type Konva from 'konva';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { err } from '../../../src/core/result/Result';
import { t } from '../../../src/presentation/i18n/strings';
import { runtimeOf, settle, settleUntil as until, zoneLines } from '../../helpers/editor';
import { PLAN_DTO, canvasOf, dragRoom, drawRoomThroughAdd, pointer, rig } from '../../helpers/planEditorRig';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

// `activateNotices` — reached here through the real editor wiring — appends its two live
// regions with Obsidian's `createDiv`, one of the prototype extensions the app installs
// globally and this suite installs per file.
installObsidianDom();

beforeEach(() => {
	activateNotices();
});

type Harness = Awaited<ReturnType<typeof rig>>['harness'];
type ZonesRepo = Awaited<ReturnType<typeof rig>>['zonesRepo'];

/**
 * A query bundle whose `getPlan` refuses on demand, counting every call either way.
 *
 * `getPlan` rather than `findZonesByPlan` because it is the FIRST of `hydrate`'s three
 * reads: refusing it means the zone list is never re-read at all, which is what makes "the
 * pre-command scene is still drawn" a claim about the store keeping what it had rather than
 * about the repository happening to answer the same thing twice.
 *
 * `reads` is what turns "Try again re-reads ONLY" into a measurement: a retry that did
 * nothing and a retry that re-read both leave the repository untouched, and only the read
 * count tells them apart.
 */
function flakyPlanRead(): {
	readonly wrap: (queries: PlanEditorQueryServices) => PlanEditorQueryServices;
	fail: () => void;
	heal: () => void;
	reads: () => number;
} {
	let failing = false;
	let reads = 0;
	return {
		fail: () => {
			failing = true;
		},
		heal: () => {
			failing = false;
		},
		reads: () => reads,
		wrap: (queries) => ({
			...queries,
			getPlan: (planId) => {
				reads += 1;
				return failing ? Promise.resolve(err(injectedPersistenceError())) : queries.getPlan(planId);
			},
		}),
	};
}

async function zonesIn(zonesRepo: ZonesRepo) {
	return expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded;
}

/** The Konva stage, asserted rather than cast: a null one means the editor drew no canvas
 * at all, which is a different failure from the one any case here is about. */
function stageOf(harness: Harness): Konva.Stage {
	const stage = harness.stage;
	if (stage === null) throw new Error('expected a mounted stage');
	return stage;
}

/** Press the stale row's Try again, then let the refresh it starts settle. */
async function pressRetry(harness: Harness): Promise<void> {
	await harness.wrapper.find('[data-rp-warning="stale"] button[data-rp-action="retry"]').trigger('click');
	await settle();
}

describe('Scenario D — the write succeeded and the refresh failed', () => {
	it('keeps the pre-command scene, marks stale, pauses new writes, lets undo through, and Try again re-reads only', async () => {
		const flaky = flakyPlanRead();
		const { harness, zonesRepo } = await rig(undefined, { wrapQueries: flaky.wrap });
		const runtime = runtimeOf(harness);
		const projectStore = useProjectStore(harness.pinia);
		// Installed AFTER `rig()`, so the fixture zone's own seed is not counted and every
		// number below is this case's own gestures.
		const saves = vi.spyOn(zonesRepo, 'save');
		const deletes = vi.spyOn(zonesRepo, 'delete');

		flaky.fail();
		await drawRoomThroughAdd(harness, zonesRepo, 'Utility room');

		// The WRITE landed — two zones in the repository, one save — and the READ did not.
		expect(await zonesIn(zonesRepo)).toHaveLength(2);
		expect(saves).toHaveBeenCalledTimes(1);
		// ...so the canvas still draws the scene the command was dispatched against: one zone,
		// two Konva nodes (a translucent fill and a full-opacity outline, per `scene.test.ts`).
		expect(projectStore.zones.size).toBe(1);
		expect(zoneLines(stageOf(harness))).toHaveLength(2);
		expect(projectStore.stale).toBe(true);
		expect(projectStore.status).toBe('ready');

		// The two surfaces that say so, in the two places a user looks.
		expect(harness.wrapper.find('.rp-save-state-label').text()).toBe(t('en', 'save-state.saved-refresh-needed'));
		const strip = harness.wrapper.find('[data-rp-warning="stale"]');
		expect(strip.exists()).toBe(true);
		expect(strip.text()).toContain(t('en', 'editor.refresh-failed'));

		// A Select drag over the fixture zone: it SELECTS (inspecting stays available) and
		// begins no gesture, so nothing is drawn and nothing is written.
		//
		// **The ghost is read MID-DRAG, and that is the whole of what makes it an assertion.**
		// `SelectTool.pointerUp` clears `previewPolygon` on every path, so the same read taken
		// after the release is `null` whether a gesture ran or not — measured, by deleting the
		// tool's own `writesBlocked` guards and watching the after-the-release version stay
		// green.
		const canvas = canvasOf(harness);
		pointer(canvas, 'pointerdown', 200, 200);
		pointer(canvas, 'pointermove', 230, 200);
		await settle();
		expect(useSelectionStore(harness.pinia).selectedIds).toEqual(['zone-a']);
		expect(runtime.renderState.previewPolygon).toBeNull();
		pointer(canvas, 'pointerup', 260, 200);
		await settle();
		// **Two mechanisms protect this one outcome and either alone is enough**, which is why
		// removing either does not redden it: the tool begins no gesture, and `withStaleGate`
		// below would refuse the commit anyway. `pausedSurfaces.test.ts` makes the same note
		// about its assign/reset pair; the gate's own arm is driven directly by the third case
		// in this file, where no control guard stands in front of it.
		expect(saves).toHaveBeenCalledTimes(1);
		expect(expectOk(await zonesRepo.getById('zone-a' as never))?.entity.geometry.points[0]).toEqual({
			x: 1500,
			y: 1500,
		});

		// Delete says it is paused, and says why.
		const del = harness.wrapper.find('.rp-editor-inspector-delete');
		expect(del.attributes('aria-disabled')).toBe('true');
		expect(del.attributes('aria-describedby')?.split(' ')).toContain(runtime.pausedReasonId);

		// A retry that fails AGAIN: one more read, no writes, and the row swaps its message
		// while keeping its node.
		const readsBeforeRetry = flaky.reads();
		const stripNodeBefore = harness.wrapper.find('[data-rp-warning="stale"]').element;
		await pressRetry(harness);
		expect(flaky.reads()).toBe(readsBeforeRetry + 1);
		expect(saves).toHaveBeenCalledTimes(1);
		expect(deletes).not.toHaveBeenCalled();
		expect(projectStore.retriesFailed).toBe(1);
		const afterRetry = harness.wrapper.find('[data-rp-warning="stale"]');
		expect(afterRetry.text()).toContain(t('en', 'editor.refresh-failed.again'));
		expect(afterRetry.element).toBe(stripNodeBefore);

		// Undo is LIVE while stale — its inverse comes from the history's own record, not from
		// the projection — so the room the user could not see removing itself still goes.
		await runtime.undo();
		await until(async () => (await zonesIn(zonesRepo)).length === 1, 'the undo of the room to land');
		expect(deletes).toHaveBeenCalledTimes(1);
		expect(saves).toHaveBeenCalledTimes(1);
		expect(projectStore.stale).toBe(true);

		// A retry that succeeds clears all three in one move: the row, the label, the pause.
		flaky.heal();
		await pressRetry(harness);
		expect(harness.wrapper.find('[data-rp-warning="stale"]').exists()).toBe(false);
		expect(harness.wrapper.find('.rp-save-state-label').text()).toBe(t('en', 'save-state.saved'));
		expect(projectStore.stale).toBe(false);
		expect(projectStore.retriesFailed).toBe(0);
		expect(harness.wrapper.find('.rp-editor-inspector-delete').attributes('aria-disabled')).toBeUndefined();
		expect(harness.wrapper.findAll(`#${runtime.pausedReasonId}`)).toHaveLength(0);

		// Three retries' worth of reads and exactly the one write the one Create owed, plus
		// the one delete the one Undo owed. Nothing in the recovery path replayed anything.
		expect(saves).toHaveBeenCalledTimes(1);
		expect(deletes).toHaveBeenCalledTimes(1);

		harness.unmount();
	});

	/**
	 * Redo's half of §2.2's carve-out. Undo alone would not show it: the gate passes `undo`
	 * and `redo` through the same two lines, but a build that passed only the first would
	 * leave a user who backed out of the failed-refresh write unable to put it back.
	 */
	it('redo while stale is live too, and restores the same room', async () => {
		const flaky = flakyPlanRead();
		const { harness, zonesRepo } = await rig(undefined, { wrapQueries: flaky.wrap });
		const runtime = runtimeOf(harness);

		flaky.fail();
		await drawRoomThroughAdd(harness, zonesRepo, 'Utility room');
		const created = (await zonesIn(zonesRepo)).find((loaded) => loaded.entity.id !== 'zone-a');
		if (created === undefined) throw new Error('expected the created room in the repository');

		await runtime.undo();
		await until(async () => (await zonesIn(zonesRepo)).length === 1, 'the undo to land');
		expect(useProjectStore(harness.pinia).stale).toBe(true);

		await runtime.redo();
		await until(async () => (await zonesIn(zonesRepo)).length === 2, 'the redo to land');

		// The SAME entity, not merely another rectangle of the same size — which is the claim
		// `ReversibleCreateZoneCommand` makes and the one a count cannot see.
		const afterRedo = await zonesIn(zonesRepo);
		expect(afterRedo.some((loaded) => loaded.entity.id === created.entity.id)).toBe(true);
		// And still stale, because nothing on the redo path re-reads successfully: the pause
		// is not something undo/redo quietly lift.
		expect(useProjectStore(harness.pinia).stale).toBe(true);

		harness.unmount();
	});

	/**
	 * The gate itself, at the one door a user can still reach while paused. `pausedSurfaces`
	 * proves the CONTROLS withhold their clicks; this proves what happens if one of them ever
	 * stops — the dispatcher refuses, resolved, and the repository is not touched.
	 */
	it('a command dispatched while stale is refused without reaching the repository', async () => {
		const flaky = flakyPlanRead();
		const { harness, zonesRepo } = await rig(undefined, { wrapQueries: flaky.wrap });
		const runtime = runtimeOf(harness);
		const saves = vi.spyOn(zonesRepo, 'save');

		flaky.fail();
		await drawRoomThroughAdd(harness, zonesRepo, 'Utility room');
		expect(useProjectStore(harness.pinia).stale).toBe(true);
		saves.mockClear();

		// Straight at the runtime's own room-creation action, bypassing every `aria-disabled`
		// control: the draft is valid, so only the gate can still refuse it.
		runtime.setTool('draw-room');
		await settle();
		dragRoom(canvasOf(harness));
		await settle();
		expect(runtime.canCreateRoom.value).toBe(true);
		await runtime.createRoom();
		await settle();

		expect(saves).not.toHaveBeenCalled();
		expect(await zonesIn(zonesRepo)).toHaveLength(2);

		harness.unmount();
	});
});
