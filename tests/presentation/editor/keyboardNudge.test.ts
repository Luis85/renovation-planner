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
import { err } from '../../../src/core/result/Result';
import {
	MoveSpatialObjectCommand,
	type MoveSpatialObjectInput,
} from '../../../src/application/commands/zone/MoveSpatialObject';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import {
	unavailablePlanEditorCommands,
	type PlanEditorCommandServices,
} from '../../../src/presentation/editor/planEditorCommands';
import { dispatchingEventBus } from '../../helpers/slice10';
import { makeZone } from '../../helpers/entities';
import { expectOk } from '../../helpers/domain';
import { actionButton, activateTool } from '../../helpers/planEditorRig';
import { mountPlanEditorCanvas, settle } from '../../helpers/editor';
import { FIXTURE_PLAN, FIXTURE_ZONES } from '../../helpers/planFixtures';
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
		const { zonesRepo, calls, commands } = await nudgeRig();
		// A second zone, so the selection can hold two ids at once.
		const terrace = FIXTURE_ZONES[1];
		const geometry = expectOk(createPolygon(terrace.points));
		await zonesRepo.save(
			makeZone({
				projectId: FIXTURE_PLAN.projectId as ProjectId,
				planId: FIXTURE_PLAN.id as PlanId,
				id: terrace.id as ZoneId,
				name: terrace.name,
				zoneType: 'Terrace',
				geometry,
			}),
			'absent',
		);
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
		// `void` settles on its own — and the refusal left no history entry, which is the
		// observable proof `reportDispatchFailure` ran rather than the write landing.
		key(harness.canvasEl, { key: 'ArrowRight' });
		await settle();

		expect(actionButton(harness, 'Undo').disabled).toBe(true);
		harness.unmount();
	});
});
