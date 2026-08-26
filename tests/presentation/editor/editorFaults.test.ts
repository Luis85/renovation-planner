/**
 * @vitest-environment jsdom
 *
 * What the wired Plan Editor does with an UNEXPECTED technical fault — a THROW, not a
 * refused `Result`.
 *
 * SDD §65 reserves throws for exactly this, and every dispatch in a leaf is ultimately
 * bound to a click handler that discards the promise it is handed. So a fault used to
 * surface as a console unhandled rejection: no Notice, no state change, and that button
 * silently stopped working for the rest of the session. Three things have to hold
 * instead — the user is told, the stores are re-read (the write may well have landed), and
 * the leaf goes on working.
 */
import { describe, expect, it } from 'vitest';
import { Notice } from 'obsidian';
import { mountPlanEditor, settle, settleUntil } from '../../helpers/editor';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { click, PLAN_DTO, PROJECT_ID, toolbarButton, ZONE_A_DTO } from '../../helpers/planEditorRig';
import { expectOk, RecordingEventBus } from '../../helpers/domain';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { createPlanEditorQueries } from '../../../src/presentation/read-models/planEditorQueries';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { makePlan, makeZone } from '../../helpers/entities';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';

/** Throws from the read the delete adapter takes for its undo snapshot. */
class ThrowingRead extends InMemoryZoneRepository {
	throwNext = false;
	override getById(id: Parameters<InMemoryZoneRepository['getById']>[0]) {
		if (this.throwNext) {
			this.throwNext = false;
			throw new Error('the vault went away mid-command');
		}
		return super.getById(id);
	}
}

async function faultRig() {
	const plans = new InMemoryPlanRepository();
	const plan = makePlan({ projectId: PROJECT_ID, id: PLAN_DTO.id as PlanId });
	await plans.save(plan, 'absent');
	const zonesRepo = new ThrowingRead();
	await zonesRepo.save(
		makeZone({
			projectId: PROJECT_ID,
			planId: plan.id,
			id: 'zone-a' as ZoneId,
			name: ZONE_A_DTO.name,
			zoneType: 'Room',
			status: 'Planned',
			geometry: expectOk(createPolygon(ZONE_A_DTO.points)),
		}),
		'absent',
	);
	const events = new RecordingEventBus();
	const harness = await mountPlanEditor({
		plan: PLAN_DTO,
		zones: [ZONE_A_DTO],
		queries: createPlanEditorQueries({
			getPlan: new GetPlan(plans),
			findZonesByPlan: new FindZonesByPlan(zonesRepo),
		}),
		commands: {
			// Spread over the refusal bundle so slice 10's members exist: this rig deletes a
			// zone nothing references, so a refusing requirement port is exactly right — what
			// it must not be is ABSENT, which would fail the delete for the wrong reason.
			...unavailablePlanEditorCommands(),
			createZone: new CreateZoneCommand(zonesRepo, plans, events),
			moveObject: new MoveSpatialObjectCommand(zonesRepo, events),
			deleteZone: makeDeleteZoneCommand(zonesRepo, events),
			zones: zonesRepo,
			zoneInspector: new GetZoneInspector(zonesRepo),
		},
	});
	return { harness, zonesRepo };
}

describe('an unexpected fault during a dispatch', () => {
	it('reaches the user as a notice and leaves the editor working', async () => {
		const { harness, zonesRepo } = await faultRig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		click(canvas, 300, 300);
		await settle();

		const noticesBefore = Notice.shown.length;
		zonesRepo.throwNext = true;
		toolbarButton(harness, 'Delete zone').click();
		// `settleUntil` rather than a fixed `settle()`: slice 10's delete flow reads the
		// referencing requirements before it dispatches, so the number of ticks between the
		// click and the write is a property of that flow rather than of this test.
		await settleUntil(() => Notice.shown.length === noticesBefore + 1, 'the fault notice');

		// Told, not swallowed — the same seam every refused gesture already reports through.
		expect(Notice.shown.length).toBe(noticesBefore + 1);
		// Nothing was written, and the panel still shows what it showed.
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never))).toHaveLength(1);
		expect(harness.wrapper.text()).toContain('Kitchen');

		// And the leaf still works: a second, clean delete goes through.
		toolbarButton(harness, 'Delete zone').click();
		await settleUntil(
			async () => expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).length === 0,
			'the second delete lands',
		);

		harness.unmount();
	});
});
