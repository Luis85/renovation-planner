/**
 * @vitest-environment jsdom
 *
 * Task 14 / E8: SDD §85's one editor operation slice 5 left unreachable by keyboard — moving
 * the selected room. Driven through the REAL mounted Plan Editor, so what is under test is
 * the actual `onKeyDown` → `EditorRuntime.nudgeSelection` → `moveGesture` → the real
 * `MoveSpatialObjectCommand` chain, never a fake standing in for any one link of it.
 *
 * `commands.moveObject` wraps the real `MoveSpatialObjectCommand` rather than replacing it,
 * so "one dispatch" is a fact about calls into the real chain — a fake command could not
 * distinguish one call from the real write actually landing once.
 */
import { describe, expect, it } from 'vitest';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { err, isErr, ok } from '../../../src/core/result/Result';
import {
	MoveSpatialObjectCommand,
	type MoveSpatialObjectInput,
} from '../../../src/application/commands/zone/MoveSpatialObject';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../../src/presentation/editor/planEditorCommands';
import { toZoneDto } from '../../../src/presentation/read-models/PlanDto';
import type { PlanEditorQueryServices } from '../../../src/presentation/read-models/planEditorQueries';
import { dispatchingEventBus } from '../../helpers/slice10';
import { makeZone } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { actionButton, activateTool, pointer } from '../../helpers/planEditorRig';
import { mountPlanEditorCanvas, settle, settleUntil } from '../../helpers/editor';
import { fakeQueries, FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
import type { ProjectId } from '../../../src/domain/project/ProjectId';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';

const KITCHEN = FIXTURE_ZONES[0]; // 'zone-kitchen': (0,0)-(4000,3000)

function key(canvas: HTMLElement, init: KeyboardEventInit): void {
	canvas.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));
}

/**
 * The one write path this test needs, real end to end: an `InMemoryZoneRepository` seeded
 * with the fixture's `zone-kitchen`, a real `MoveSpatialObjectCommand` over it, and a spy
 * that counts calls into that real command without changing what it does. Every other
 * command stays the refusing stand-in — nothing here dispatches `createZone`, `deleteZone`
 * or a requirement edit.
 */
async function nudgeRig(): Promise<{
	readonly zonesRepo: InMemoryZoneRepository;
	readonly calls: MoveSpatialObjectInput[];
	readonly commands: PlanEditorCommandServices;
}> {
	const zonesRepo = new InMemoryZoneRepository();
	const events = dispatchingEventBus();
	const geometry = expectOk(createPolygon(KITCHEN.points));
	const zoneKitchen = makeZone({
		projectId: FIXTURE_PLAN.projectId as ProjectId,
		planId: FIXTURE_PLAN.id as PlanId,
		id: KITCHEN.id as ZoneId,
		name: KITCHEN.name,
		zoneType: 'Room',
		geometry,
	});
	await zonesRepo.save(zoneKitchen, 'absent');
	const calls: MoveSpatialObjectInput[] = [];
	const realMove = new MoveSpatialObjectCommand(zonesRepo, events);
	const commands: PlanEditorCommandServices = {
		...unavailablePlanEditorCommands(),
		zones: zonesRepo,
		events,
		moveObject: {
			execute: (input) => {
				calls.push(input);
				return realMove.execute(input);
			},
		},
	};
	return { zonesRepo, calls, commands };
}

describe('arrow keys move the selected room (Task 14, E8)', () => {
	it('ArrowRight dispatches one moveObject translated by {dx:10, dy:0}, records a history entry, and Undo restores it', async () => {
		const { zonesRepo, calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });
		// Select is the tool a ready plan opens onto (Task 10); nothing here needs to switch
		// to it by hand.
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		expect(actionButton(harness, 'Undo').disabled).toBe(true);

		harness.canvasEl.focus();
		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(calls).toHaveLength(1);
		expect(calls[0].zoneId).toBe(KITCHEN.id);
		const expectedForward = KITCHEN.points.map((p) => ({ x: p.x + 10, y: p.y }));
		expect(calls[0].geometry.points).toEqual(expectedForward);

		const moved = expectOk(await zonesRepo.getById(KITCHEN.id as never));
		if (moved === null) throw new Error('expected zone-kitchen to exist');
		expect(moved.entity.geometry.points).toEqual(expectedForward);

		// A history entry: Undo went from disabled to enabled by the nudge alone.
		expect(actionButton(harness, 'Undo').disabled).toBe(false);

		actionButton(harness, 'Undo').click();
		await settle();

		const restored = expectOk(await zonesRepo.getById(KITCHEN.id as never));
		if (restored === null) throw new Error('expected zone-kitchen to survive the undo');
		expect(restored.entity.geometry.points).toEqual(KITCHEN.points);

		harness.unmount();
	});

	it('two fast taps (Right then Down) accumulate, rather than the second overwriting the first', async () => {
		// Codex P2: `createNudgeSelectionAction` used to read `projectStore.zones` and build
		// its command SYNCHRONOUSLY, before `dispatcher.run()` ever serialized anything — so
		// two non-repeat presses fired back to back (no `await` between the two `key()` calls
		// below, exactly as the held-ArrowRight case above) both read the pre-move points and
		// the second command overwrote the first translation instead of accumulating it.
		//
		// `fakeQueries`'s own `findZonesByPlan` answers a captured static array, which would
		// never show that: the store's re-hydrate has to read back what the FIRST nudge
		// actually wrote for the accumulation (or its absence) to be observable at all, so
		// this rig's `findZonesByPlan` reads live from `zonesRepo` instead.
		const zonesRepo = new InMemoryZoneRepository();
		const events = dispatchingEventBus();
		const geometry = expectOk(createPolygon(KITCHEN.points));
		const zoneKitchen = makeZone({
			projectId: FIXTURE_PLAN.projectId as ProjectId,
			planId: FIXTURE_PLAN.id as PlanId,
			id: KITCHEN.id as ZoneId,
			name: KITCHEN.name,
			zoneType: 'Room',
			geometry,
		});
		await zonesRepo.save(zoneKitchen, 'absent');
		const calls: MoveSpatialObjectInput[] = [];
		const realMove = new MoveSpatialObjectCommand(zonesRepo, events);
		const commands: PlanEditorCommandServices = {
			...unavailablePlanEditorCommands(),
			zones: zonesRepo,
			events,
			moveObject: {
				execute: (input) => {
					calls.push(input);
					return realMove.execute(input);
				},
			},
		};
		const queries: PlanEditorQueryServices = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			findZonesByPlan: async () => {
				const listing = await zonesRepo.listByPlan(FIXTURE_PLAN.id as PlanId);
				if (isErr(listing)) return listing;
				return ok({
					zones: listing.value.loaded.map((loaded) => toZoneDto(loaded.entity)),
					unreadable: listing.value.refused,
				});
			},
		};
		const harness = await mountPlanEditorCanvas({ commands, queries });
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		harness.canvasEl.focus();
		key(harness.canvasEl, { key: 'ArrowRight' });
		key(harness.canvasEl, { key: 'ArrowDown' });
		await settle();

		expect(calls).toHaveLength(2);
		const afterRight = KITCHEN.points.map((p) => ({ x: p.x + 10, y: p.y }));
		expect(calls[0].geometry.points).toEqual(afterRight);
		// ACCUMULATED: the second command's forward polygon is translated from what the first
		// wrote ({dx:10, dy:10} off the ORIGINAL points), not from the original alone
		// ({dx:0, dy:10}), which is what the race produces.
		const afterBoth = KITCHEN.points.map((p) => ({ x: p.x + 10, y: p.y + 10 }));
		expect(calls[1].geometry.points).toEqual(afterBoth);

		const moved = expectOk(await zonesRepo.getById(KITCHEN.id as never));
		if (moved === null) throw new Error('expected zone-kitchen to exist');
		expect(moved.entity.geometry.points).toEqual(afterBoth);

		// Two accumulated moves are two undo entries, not one collapsed entry: undoing twice
		// restores the original points.
		actionButton(harness, 'Undo').click();
		await settle();
		actionButton(harness, 'Undo').click();
		await settle();

		const restored = expectOk(await zonesRepo.getById(KITCHEN.id as never));
		if (restored === null) throw new Error('expected zone-kitchen to survive both undos');
		expect(restored.entity.geometry.points).toEqual(KITCHEN.points);

		harness.unmount();
	});

	it('a queued press moves the room selected when it was PRESSED, not the selection at release', async () => {
		// Codex P2 (second finding): the serialization chain above fixed the STALE-GEOMETRY
		// race by deferring the whole nudge — read included — behind the chain. That deferred
		// the SELECTION read too, so a press queued behind a slow write picked up whatever was
		// selected once the chain finally reached it, not what was selected at key-down. Here
		// the first write is held open with `firstGate`; the second ArrowRight is pressed while
		// zone-kitchen is still selected (so it must capture zone-kitchen), and ONLY THEN does
		// the selection change to the terrace zone before the first write is released.
		const zonesRepo = new InMemoryZoneRepository();
		const events = dispatchingEventBus();
		const geometry = expectOk(createPolygon(KITCHEN.points));
		const zoneKitchen = makeZone({
			projectId: FIXTURE_PLAN.projectId as ProjectId,
			planId: FIXTURE_PLAN.id as PlanId,
			id: KITCHEN.id as ZoneId,
			name: KITCHEN.name,
			zoneType: 'Room',
			geometry,
		});
		await zonesRepo.save(zoneKitchen, 'absent');
		const terrace = FIXTURE_ZONES[1];
		// Saved too, so a wrong capture of the terrace zone actually finds geometry to move and
		// dispatches — rather than silently no-opping on a missing zone and masking the bug as a
		// call count that never reaches 2 at all.
		const zoneTerrace = makeZone({
			projectId: FIXTURE_PLAN.projectId as ProjectId,
			planId: FIXTURE_PLAN.id as PlanId,
			id: terrace.id as ZoneId,
			name: terrace.name,
			zoneType: 'Room',
			geometry: expectOk(createPolygon(terrace.points)),
		});
		await zonesRepo.save(zoneTerrace, 'absent');
		const calls: MoveSpatialObjectInput[] = [];
		const realMove = new MoveSpatialObjectCommand(zonesRepo, events);
		let releaseFirstWrite!: () => void;
		const firstWriteGate = new Promise<void>((resolve) => {
			releaseFirstWrite = resolve;
		});
		let executions = 0;
		const commands: PlanEditorCommandServices = {
			...unavailablePlanEditorCommands(),
			zones: zonesRepo,
			events,
			moveObject: {
				execute: async (input) => {
					calls.push(input);
					const isFirst = executions === 0;
					executions += 1;
					if (isFirst) await firstWriteGate;
					return realMove.execute(input);
				},
			},
		};
		const queries: PlanEditorQueryServices = {
			...fakeQueries(FIXTURE_PLAN, FIXTURE_ZONES),
			findZonesByPlan: async () => {
				const listing = await zonesRepo.listByPlan(FIXTURE_PLAN.id as PlanId);
				if (isErr(listing)) return listing;
				return ok({
					zones: listing.value.loaded.map((loaded) => toZoneDto(loaded.entity)),
					unreadable: listing.value.refused,
				});
			},
		};
		const harness = await mountPlanEditorCanvas({ commands, queries });
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		harness.canvasEl.focus();
		key(harness.canvasEl, { key: 'ArrowRight' }); // press 1: dispatches for zone-kitchen, blocks on firstWriteGate
		await settle();
		expect(calls).toHaveLength(1);

		key(harness.canvasEl, { key: 'ArrowRight' }); // press 2: zone-kitchen is STILL selected here
		// Nothing selected in between must never occupy the chain — no dispatch, and it must
		// not push a following valid press's turn any further out (checked below by call count).
		useSelectionStore().clear();
		key(harness.canvasEl, { key: 'ArrowRight' }); // press 3: nothing selected — a no-op
		await settle();
		expect(calls).toHaveLength(1); // press 2 still queued behind the open gate; press 3 never dispatches

		// Only NOW does the selection move to the terrace zone — after both later presses were
		// already made, before the first write's queued continuation ever runs.
		useSelectionStore().select([terrace.id as never]);

		releaseFirstWrite();
		await settleUntil(() => calls.length >= 2, 'the queued second press to dispatch');

		expect(calls).toHaveLength(2); // press 3's no-op never added a dispatch
		expect(calls[1].zoneId).toBe(KITCHEN.id); // the room selected when press 2 was PRESSED — never the terrace zone selected at release, and never a no-op from press 3 occupying its slot

		harness.unmount();
	});

	it('a held ArrowRight (OS autorepeat) dispatches only the first press', async () => {
		// The store only refreshes from the queued hydrate after the write lands, so a
		// second synchronous keydown with `repeat: true` would read the same pre-move points
		// and re-dispatch the identical forward translation — one press must mean one move.
		const { calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		harness.canvasEl.focus();
		key(harness.canvasEl, { key: 'ArrowRight' });
		key(harness.canvasEl, { key: 'ArrowRight', repeat: true });
		key(harness.canvasEl, { key: 'ArrowRight', repeat: true });
		await settle();

		expect(calls).toHaveLength(1);
		harness.unmount();
	});

	it('Shift+ArrowDown moves by 100mm instead of 10', async () => {
		const { calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		key(harness.canvasEl, { key: 'ArrowDown', shiftKey: true });
		await settle();

		expect(calls).toHaveLength(1);
		expect(calls[0].geometry.points).toEqual(KITCHEN.points.map((p) => ({ x: p.x, y: p.y + 100 })));

		harness.unmount();
	});

	it('does nothing with nothing selected', async () => {
		const { calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });

		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(calls).toHaveLength(0);
		harness.unmount();
	});

	it('does nothing when the selected id is not one this leaf has hydrated', async () => {
		// A stale or foreign id — a list row naming something this leaf never loaded, or a
		// race with a delete elsewhere. `projectStore.zones` has nothing at that key, and
		// there is no geometry a translate could apply to.
		const { calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select(['zone-does-not-exist' as never]);
		await settle();

		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(calls).toHaveLength(0);
		harness.unmount();
	});

	it('does nothing with more than one zone selected', async () => {
		const { calls, commands } = await nudgeRig();
		// The case rests on the SELECTION holding two ids, not on both resolving to a real
		// zone — the `rest.length > 0` guard reads the selection before any lookup, so a
		// second id the store never hydrated proves the same arm without a second save.
		const terrace = FIXTURE_ZONES[1];
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select([KITCHEN.id as never, terrace.id as never]);
		await settle();

		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(calls).toHaveLength(0);
		harness.unmount();
	});

	it('does nothing while a drawing tool other than Select is active', async () => {
		const { calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select([KITCHEN.id as never]);
		activateTool(harness, 'draw-room');
		await settle();

		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(calls).toHaveLength(0);
		harness.unmount();
	});

	it('reports a refusal through the same door SelectTool\'s drag uses, rather than throwing it away', async () => {
		// A real reason `moveObject` can refuse: the zone this leaf cached has since been
		// deleted underneath it (another leaf, a sync). `commandDispatcher.run` never rejects
		// (`mapDispatchFaults`), so this is a RESOLVED refusal — `!result.ok` — never a throw.
		const commands: PlanEditorCommandServices = {
			...unavailablePlanEditorCommands(),
			zones: new InMemoryZoneRepository(),
			moveObject: {
				execute: () =>
					Promise.resolve(err({ category: 'Reference', code: 'test.zone-gone', message: 'gone' })),
			},
		};
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		// Nothing throws and nothing is left pending — the promise `onKeyDown` discards with
		// `void` settles on its own — and the refusal left no history entry, which is what is
		// actually asserted below: Undo stayed disabled, so no move was recorded.
		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(actionButton(harness, 'Undo').disabled).toBe(true);
		harness.unmount();
	});

	/**
	 * Finding B (the whole-tree review): `gestureInFlight()`'s early return used to sit ABOVE
	 * the arrow branch, so an arrow key pressed mid-gesture reached neither `preventDefault()`
	 * nor `nudgeSelection` — the keydown fell through uncaptured and the Obsidian leaf
	 * underneath the in-progress drag scrolled. `key()` above cannot show this: it discards
	 * the event it dispatches, and `defaultPrevented` is exactly what a discarded event hides.
	 */
	it('an arrow key mid-gesture is consumed rather than left to scroll the leaf', async () => {
		const { calls, commands } = await nudgeRig();
		const harness = await mountPlanEditorCanvas({ commands });
		useSelectionStore().select([KITCHEN.id as never]);
		await settle();

		harness.canvasEl.focus();
		// Select is the tool already active here, so a bare press is enough to claim a
		// gesture with no matching release — the drag this arrow key would otherwise
		// interrupt.
		pointer(harness.canvasEl, 'pointerdown', 10, 10);

		const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
		harness.canvasEl.dispatchEvent(event);
		await settle();

		expect(event.defaultPrevented).toBe(true);
		expect(calls).toHaveLength(0);
		harness.unmount();
	});
});
