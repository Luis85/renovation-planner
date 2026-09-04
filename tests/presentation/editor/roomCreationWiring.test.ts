/**
 * @vitest-environment jsdom
 *
 * `EditorRuntime.createRoom` / `.canCreateRoom` / `.roomDraft` (Task 5), driven through the
 * REAL mounted Plan Editor. `roomCreation.test.ts` covers `createRoomFromDraft`'s own branches
 * against a hand-built `RoomCreationDeps`; this is the one case proving the runtime's wiring of
 * that action is reachable at all, rather than declared and never called — the same shape this
 * repository's own "a tool absent from a registration list is invisible to every gate" finding
 * warns against, met here before it could recur.
 */
import { describe, expect, it } from 'vitest';
import { expectOk } from '../../helpers/domain';
import { PLAN_DTO, rig } from '../../helpers/planEditorRig';
import { runtimeOf } from '../../helpers/editor';

describe('EditorRuntime.createRoom', () => {
	it('canCreateRoom follows the draft, and createRoom dispatches through the leaf and persists a Room', async () => {
		const { harness, zonesRepo } = await rig();
		const runtime = runtimeOf(harness);

		runtime.roomDraft.beginTask('Bedroom');
		expect(runtime.canCreateRoom.value).toBe(false); // no rect yet

		runtime.roomDraft.setRect({ x: 0, y: 0, width: 1000, depth: 1000 });
		expect(runtime.canCreateRoom.value).toBe(true);

		expect(await runtime.createRoom()).toBe('created');

		const listed = expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as never)).loaded;
		const created = listed.find((loaded) => loaded.entity.name === 'Bedroom');
		if (created === undefined) throw new Error('expected the room to persist');
		expect(created.entity.zoneType).toBe('Room');

		harness.unmount();
	});
});
