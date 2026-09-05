/**
 * @vitest-environment jsdom
 *
 * **One history per leaf, end to end** — design spec §8: the criteria the *Undo and redo* PBI
 * names and that nothing pinned. Undo and redo have had a mechanism since design slice 6 and
 * a node test each since; what none of those reach is the CHAIN — a real gesture, into
 * `CommandHistory`, into a reversible adapter, into a repository, and back out through the
 * post-command refresh — which is where the questions this file asks actually live: how many
 * inverses one Undo runs, whether a new action really empties the redo branch, what a success
 * that wrote nothing does to the badge, and what a refused Undo leaves behind.
 *
 * Geometry note (`planEditorRig`'s): `DEFAULT_ZOOM` is 0.1 with a 48 px margin, so
 * world = 10 × screen − 480 per axis at the default camera; the fixture zone's world rect
 * (1500..4400)² has the screen footprint (198,198)-(488,388), so a press at (200,200) is
 * inside it and a 60 px drag moves it +600 mm.
 *
 * **What no case here can see.** jsdom lays nothing out, and `Notice.shown` counts
 * constructions rather than anything a user could read — so the one case below that asserts a
 * notice count is asserting that a door was NOT taken, over a live queue, which is the only
 * form of that assertion worth anything.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Decimal } from 'decimal.js';
// Mock-only surface, imported BY NAME — `Notice.shown` is a static the real `obsidian`
// module does not declare, and the vitest alias points that specifier at this very file.
import { Notice } from '../../helpers/obsidian-mock';
import { err } from '../../../src/core/result/Result';
import { runtimeOf, settle, settleUntil as until } from '../../helpers/editor';
import {
	PLAN_DTO,
	canvasOf,
	drawRoomThroughAdd,
	actionButton,
	pointer,
	rig,
} from '../../helpers/planEditorRig';
import { expectOk, injectedPersistenceError } from '../../helpers/domain';
import { makeAsset } from '../../helpers/entities';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';

installObsidianDom();

beforeEach(() => {
	activateNotices();
});

type Harness = Awaited<ReturnType<typeof rig>>['harness'];
type ZonesRepo = Awaited<ReturnType<typeof rig>>['zonesRepo'];

async function zonesIn(zonesRepo: ZonesRepo) {
	return expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded;
}

function pointsOfZoneA(loaded: Awaited<ReturnType<typeof zonesIn>>) {
	const zone = loaded.find((entry) => entry.entity.id === 'zone-a');
	if (zone === undefined) throw new Error('expected the fixture zone');
	return zone.entity.geometry.points;
}

/** Select, then drag the fixture zone's body 60 px right (+600 mm) — one move command. */
async function moveZoneA(harness: Harness): Promise<void> {
	actionButton(harness, 'Select').click();
	await settle();
	const canvas = canvasOf(harness);
	pointer(canvas, 'pointerdown', 200, 200);
	pointer(canvas, 'pointermove', 230, 200);
	pointer(canvas, 'pointermove', 260, 200);
	pointer(canvas, 'pointerup', 260, 200);
	await settle();
}

/** Pick the one seeded asset in the Requirements panel and press Assign. */
async function assignTheAsset(harness: Harness, assetId: string): Promise<void> {
	await harness.wrapper.find('#rp-assign-asset').setValue(assetId);
	await settle();
	const assign = harness.wrapper.findAll('button').find((button) => button.text() === 'Assign');
	if (assign === undefined) throw new Error('no Assign button');
	await assign.trigger('click');
	await settle();
}

describe('one history per leaf', () => {
	/**
	 * One press, ONE inverse. Counted at the repository rather than at the adapter, because
	 * that is the only place a double-dispatch would show: `CommandHistory.undoNow` pops after
	 * the inverse resolves, so a build that ran the inverse twice — a decorator applied twice,
	 * a queue that replayed — would still leave one zone and read identically from the store.
	 */
	it('one Undo runs one inverse, counted at the repository', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);
		const deletes = vi.spyOn(zonesRepo, 'delete');

		await drawRoomThroughAdd(harness, zonesRepo, 'Utility room');
		expect(deletes).not.toHaveBeenCalled();

		await runtime.undo();
		await until(async () => (await zonesIn(zonesRepo)).length === 1, 'the undo of the room to land');

		expect(deletes).toHaveBeenCalledTimes(1);
		expect(runtime.canUndo.value).toBe(false);
		expect(runtime.canRedo.value).toBe(true);

		harness.unmount();
	});

	/**
	 * The redo branch is not a second stack a user can come back to: doing something ELSE
	 * after an Undo discards it. Driven through two DIFFERENT gestures (a room create, then a
	 * zone move) so the case cannot pass by the second command happening to be the same object
	 * as the first.
	 */
	it('a new action after Undo empties the redo branch', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		await drawRoomThroughAdd(harness, zonesRepo, 'Utility room');
		await runtime.undo();
		await until(async () => (await zonesIn(zonesRepo)).length === 1, 'the undo of the room to land');
		expect(runtime.canRedo.value).toBe(true);

		await moveZoneA(harness);
		await until(
			async () => pointsOfZoneA(await zonesIn(zonesRepo))[0]?.x === 2100,
			'the move to land in the repository',
		);

		expect(runtime.canRedo.value).toBe(false);
		expect(runtime.canUndo.value).toBe(true);

		harness.unmount();
	});

	/**
	 * **A success that wrote nothing may not clear a standing save error** — `SaveStateStore`'s
	 * categorical rule, and the one an `ok` alone used to break. Assigning an asset already
	 * linked to the selected zone is `ok` from a READ: `AssignAssetCommand` answers
	 * `created: false` and the adapter reports `'no-write'`, so `withSaveStateTracking`
	 * resolves NEUTRAL and the badge stays where the last real failure left it.
	 *
	 * The standing error is real rather than written into the store: one detonated
	 * `zones.save` behind an ordinary move drag, which is the shape `roomCreation.e2e` already
	 * uses. Without it this case could not discriminate — a neutral resolution and a
	 * successful one both leave a fresh leaf reading `Saved`.
	 *
	 * **It DOES take a history entry, and that is deliberate rather than a defect.** The
	 * brief for this case asked for "no history entry"; `CommandHistory.runNow` says the
	 * opposite in as many words — *"A gesture that wrote nothing still goes on the undo stack:
	 * it happened, and asking to undo it is legal"* — so what is pinned here is the documented
	 * behaviour, by the one instrument that can see it: the Undo that follows pops the NO-WRITE
	 * assign (whose recorded kind is `found`, so it deletes nothing) and leaves the requirement
	 * standing. A build that skipped the entry would pop the FIRST assign instead and take the
	 * requirement with it.
	 */
	it('a no-write success writes nothing, keeps a standing save error, and still takes a history entry', async () => {
		const { harness, zonesRepo, requirementsRepo, assetsRepo } = await rig(async ({ assets }) => {
			await assets.save(
				makeAsset({ name: 'Floor tiles', unit: 'm2', wasteFactorDefault: new Decimal('0.10') }),
				'absent',
			);
		});
		const asset = expectOk(await assetsRepo.listAll()).loaded[0];
		if (asset === undefined) throw new Error('expected the seeded asset');

		actionButton(harness, 'Select').click();
		await settle();
		pointer(canvasOf(harness), 'pointerdown', 200, 200);
		pointer(canvasOf(harness), 'pointerup', 200, 200);
		await settle();

		await assignTheAsset(harness, asset.entity.id);
		await until(
			async () => expectOk(await requirementsRepo.listByZone('zone-a' as never)).length === 1,
			'the first assign to create a requirement',
		);

		// A REAL save error, standing: one detonated zone save behind an ordinary move drag.
		vi.spyOn(zonesRepo, 'save').mockResolvedValueOnce(err(injectedPersistenceError()));
		await moveZoneA(harness);
		await until(
			() => harness.wrapper.find('.rp-save-state-label').classes().includes('rp-save-state-save-error'),
			'the refused move to reach the save indicator',
		);

		const requirementSaves = vi.spyOn(requirementsRepo, 'save');
		await assignTheAsset(harness, asset.entity.id);
		await settle();

		// Nothing written, and the badge is exactly where the failure left it.
		expect(requirementSaves).not.toHaveBeenCalled();
		expect(expectOk(await requirementsRepo.listByZone('zone-a' as never))).toHaveLength(1);
		expect(harness.wrapper.find('.rp-save-state-label').classes()).toContain('rp-save-state-save-error');

		// The entry the brief said would not exist: one Undo pops the no-write assign, and the
		// requirement the FIRST assign created is still there.
		await runtimeOf(harness).undo();
		await settle();
		expect(expectOk(await requirementsRepo.listByZone('zone-a' as never))).toHaveLength(1);

		harness.unmount();
	});

	/**
	 * **A refused Undo reports on exactly ONE surface, and the command stays on the stack.**
	 *
	 * `VersionedStore.poke` is a hand edit or a sync: it moves the zone's `observed` token
	 * without touching its revision, so the restore's conditional write is refused with
	 * `zone.external-modification`. That code is one of `WRITE_BOUNDARY_CODES`, which
	 * `affectsSaveState` carves back out of the pre-write categories — so it flips the badge,
	 * and `reportDispatchFailure` therefore routes it to the `autosave-write` origin whose
	 * toast sink is deliberately a no-op (design slice 17: one failure, one widget).
	 *
	 * **The brief expected a notice and there is none**, which is why the notice half is
	 * asserted as an ABSENCE over a LIVE queue rather than left out: over an inactive queue
	 * that assertion would be true of every build ever written.
	 *
	 * `canUndo` staying true is `CommandHistory.undoNow`'s own rule — a refused inverse leaves
	 * the command on the stack, because the vault is still in the state it left it in — and is
	 * pinned here as the recorded `undo.superseded`-shaped behaviour rather than fixed: the
	 * button stays live and every further press refuses identically, which the second press
	 * below is what says.
	 */
	it('a revision conflict on Undo surfaces once and leaves the stack coherent', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		await moveZoneA(harness);
		await until(
			async () => pointsOfZoneA(await zonesIn(zonesRepo))[0]?.x === 2100,
			'the move to land in the repository',
		);
		expect(runtime.canUndo.value).toBe(true);

		// Somebody else touched the note between the move and the Undo.
		zonesRepo.poke('zone-a' as never);

		const noticesBefore = Notice.shown.length;
		await runtime.undo();
		await settle();

		// The badge is the whole surface; no toast, so the two cannot drift apart.
		expect(harness.wrapper.find('.rp-save-state-label').classes()).toContain('rp-save-state-save-error');
		expect(Notice.shown.length).toBe(noticesBefore);
		// The vault is where the move left it, and the command is still on the stack.
		expect(pointsOfZoneA(await zonesIn(zonesRepo))[0]).toEqual({ x: 2100, y: 1500 });
		expect(runtime.canUndo.value).toBe(true);
		expect(runtime.canRedo.value).toBe(false);

		// And it refuses the same way for the rest of the leaf's life, which is the recorded
		// behaviour rather than a fixed one.
		await runtime.undo();
		await settle();
		expect(pointsOfZoneA(await zonesIn(zonesRepo))[0]).toEqual({ x: 2100, y: 1500 });
		expect(runtime.canUndo.value).toBe(true);

		harness.unmount();
	});

	/**
	 * §8's criterion 4b, from the Undo side: `withStateRefresh` wraps `undo` too, so an Undo
	 * whose read-back fails leaves the same stale canvas a failed forward write does — and Try
	 * again from that state re-reads and nothing else. Counted at the repository, because "no
	 * write was replayed" is the whole claim and a store assertion cannot make it.
	 */
	it('an Undo whose refresh fails marks stale, and Try again re-reads only', async () => {
		let failing = false;
		let reads = 0;
		const wrapQueries = (queries: PlanEditorQueryServices): PlanEditorQueryServices => ({
			...queries,
			getPlan: (planId) => {
				reads += 1;
				return failing ? Promise.resolve(err(injectedPersistenceError())) : queries.getPlan(planId);
			},
		});
		const { harness, zonesRepo } = await rig(undefined, { wrapQueries });
		const runtime = runtimeOf(harness);
		const projectStore = useProjectStore(harness.pinia);

		await moveZoneA(harness);
		await until(
			async () => pointsOfZoneA(await zonesIn(zonesRepo))[0]?.x === 2100,
			'the move to land in the repository',
		);
		expect(projectStore.stale).toBe(false);

		const saves = vi.spyOn(zonesRepo, 'save');
		const deletes = vi.spyOn(zonesRepo, 'delete');
		failing = true;
		await runtime.undo();
		await until(
			async () => pointsOfZoneA(await zonesIn(zonesRepo))[0]?.x === 1500,
			'the undo of the move to land',
		);
		await settle();

		// The inverse WROTE — one save — and the read-back after it did not.
		expect(saves).toHaveBeenCalledTimes(1);
		expect(projectStore.stale).toBe(true);
		expect(harness.wrapper.find('[data-rp-warning="stale"]').exists()).toBe(true);

		failing = false;
		const readsBefore = reads;
		await harness.wrapper
			.find('[data-rp-warning="stale"] button[data-rp-action="retry"]')
			.trigger('click');
		await settle();

		expect(reads).toBe(readsBefore + 1);
		expect(saves).toHaveBeenCalledTimes(1);
		expect(deletes).not.toHaveBeenCalled();
		expect(projectStore.stale).toBe(false);
		expect(harness.wrapper.find('[data-rp-warning="stale"]').exists()).toBe(false);

		harness.unmount();
	});
});
