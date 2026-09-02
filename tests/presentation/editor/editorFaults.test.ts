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
import { beforeEach, describe, expect, it } from 'vitest';
// Mock-only surface, imported BY NAME. `Notice` carries members
// the real `obsidian` module does not declare (`shown`, `constructed`, `opened`, `choose`), so reaching them through the
// `'obsidian'` specifier type-checks against a surface that has no such thing. The
// vitest alias points that specifier at this very file, so this is the SAME class and
// the same statics — proven, not assumed — and the import now says which surface it
// wants.
import { Notice } from '../../helpers/obsidian-mock';
import { mountPlanEditor, settle, settleUntil } from '../../helpers/editor';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import {
	click,
	PLAN_DTO,
	planEditorQueriesFor,
	pointer,
	PROJECT_ID,
	projectRepoWithFixture,
	toolbarButton,
	ZONE_A_DTO,
} from '../../helpers/planEditorRig';
import { expectErr, expectOk, RecordingEventBus } from '../../helpers/domain';
import { CreateZoneCommand } from '../../../src/application/commands/zone/CreateZone';
import { makeDeleteZoneCommand } from '../../helpers/slice10';
import { MoveSpatialObjectCommand } from '../../../src/application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { makePlan, makeZone } from '../../helpers/entities';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { ZoneId } from '../../../src/domain/zone/ZoneId';
import { createPolygon } from '../../../src/core/geometry/Polygon';
import { activateNotices } from '../../../src/presentation/notices/notify';
import { installObsidianDom } from '../../helpers/dom';
import { mapDispatchFaults } from '../../../src/presentation/editor/report-failure';
import { isTechnicalFault } from '../../../src/core/errors/technical-fault';
import { ok } from '../../../src/core/result/Result';
import { lines, recorder } from '../../helpers/logger';

// `activateNotices` — reached here through the real plugin/editor wiring — appends its
// two live regions with Obsidian's `createDiv`, one of the prototype extensions the app
// installs globally and this suite installs per file.
installObsidianDom();

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
	const projects = await projectRepoWithFixture();
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
		queries: planEditorQueriesFor(plans, projects, zonesRepo),
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

/**
 * A notice is INERT until something activates the queue — `onload` is what does that in
 * production, so a suite asserting on `Notice.shown` has to stand where the plugin stands.
 * Per TEST, and for a second reason: the queue DEDUPS, so two cases raising the identical
 * sentence would fold into one `(×2)` and construct no second `Notice` at all.
 */
beforeEach(() => {
	activateNotices();
});

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
		expect(expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded).toHaveLength(1);
		expect(harness.wrapper.text()).toContain('Kitchen');

		// And the leaf still works: a second, clean delete goes through.
		toolbarButton(harness, 'Delete zone').click();
		await settleUntil(
			async () => expectOk(await zonesRepo.listByPlan('plan-e2e' as never)).loaded.length === 0,
			'the second delete lands',
		);

		harness.unmount();
	});
});

/**
 * The same fault, arriving through a TOOL rather than through the delete flow — which is a
 * different door and, until this case existed, an unguarded one.
 *
 * `deleteZoneWithReferences` is wrapped in a `try`/`catch` by `createDeleteZoneAction`, and
 * `wrappedDispatcher.undo()`/`.redo()` are wrapped by `reportDispatchFault`. `run(...)` — what
 * every one of the five tools calls, and the only dispatch door a canvas gesture has — was
 * wrapped by neither, while `withEditorStateRefresh` re-throws on rejection by design and each
 * tool launches its dispatch DETACHED (`void this.commit(...)`). So a vault fault under a drag
 * was an unhandled rejection: no notice, no log line the user's report could name, and the
 * gesture simply did nothing.
 *
 * Driven through the real toolbar and a real drag rather than asserted at the seam, because
 * what is in question is the whole chain — a seam that mapped the fault and a tool that then
 * failed to report it would leave the user exactly as silent.
 */
describe('an unexpected fault during a TOOL gesture', () => {
	it('reaches the user as a notice, and the leaf goes on working', async () => {
		const { harness, zonesRepo } = await faultRig();
		const canvas = harness.canvasEl;
		if (canvas === null) throw new Error('expected a mounted canvas');

		toolbarButton(harness, 'Select').click();
		click(canvas, 300, 300);
		await settle();

		const before = Notice.shown.length;
		zonesRepo.throwNext = true;
		// A body drag of the selected zone: down, move, up on the same button, which is the
		// grammar a real device sends. 50 screen pixels is past `CLICK_EPSILON_PX`, so this is
		// a move rather than a click.
		pointer(canvas, 'pointerdown', 300, 300);
		pointer(canvas, 'pointermove', 350, 300);
		pointer(canvas, 'pointerup', 350, 300);
		await settle();

		// Told. Silence is the whole regression.
		expect(Notice.shown.length).toBe(before + 1);
		// And the leaf is still live: the same drag, unarmed, commits.
		pointer(canvas, 'pointerdown', 350, 300);
		pointer(canvas, 'pointermove', 400, 300);
		pointer(canvas, 'pointerup', 400, 300);
		await settleUntil(
			async () =>
				expectOk(await zonesRepo.listByPlan(PLAN_DTO.id as PlanId))
					.loaded.at(0)
					?.entity.geometry.points.at(0)?.x !== 1500,
			'the second drag lands',
		);

		harness.unmount();
	});
});

/**
 * The seam itself, asked directly — the three properties the two wired cases above rest on but
 * cannot separate, since a build that got any one of them wrong still shows a notice.
 */
describe('mapDispatchFaults', () => {
	it('hands a resolved result straight back, faults or not', async () => {
		const answer = ok('wrote' as const);
		const mapped = mapDispatchFaults({ run: () => Promise.resolve(answer) }, recorder, 'test.faulted');

		expect(await mapped.run({ execute: () => Promise.resolve(answer), undo: () => Promise.resolve(answer) })).toBe(
			answer,
		);
	});

	it('turns a THROW into a resolved failure that carries the technical-fault stamp', async () => {
		const before = lines.length;
		const mapped = mapDispatchFaults(
			{
				run: () => Promise.reject(new Error('the vault went away')),
			},
			recorder,
			'test.faulted',
		);

		const result = await mapped.run({
			execute: () => Promise.resolve(ok('wrote')),
			undo: () => Promise.resolve(ok('wrote')),
		});

		// RESOLVED, not rejected: the whole point, since every tool launches this detached.
		expect(result.ok).toBe(false);
		// STAMPED, which is what makes `reportDispatchFailure` give it its own sentence rather
		// than a "Save error" badge with no cause. A mapped fault that read as an ordinary
		// refusal is a defect this repository has already shipped once.
		expect(isTechnicalFault(expectErr(result))).toBe(true);
		// LOGGED once, under the CALLER's event name — two surfaces dispatch through this and a
		// log line has to say which door faulted. The raw cause goes here and nowhere else.
		const logged = lines.slice(before);
		expect(logged.map((line) => line.event)).toEqual(['test.faulted']);
		expect(logged.at(0)?.context?.cause).toBeInstanceOf(Error);
	});

	/**
	 * And it does NOT notify, which is the property that keeps this from being the
	 * double-report design slice 17 closed. The failed `Result` goes back to the tool, whose own
	 * `reportRejected` door decides the surface — so a build that announced here as well would
	 * put two toasts up for one fault, and the two wired cases above (which count notices) would
	 * both still pass their "the user was told" assertion.
	 */
	it('says nothing itself, leaving the surface to the door the tool already has', async () => {
		activateNotices();
		const before = Notice.shown.length;
		const mapped = mapDispatchFaults(
			{ run: () => Promise.reject(new Error('the vault went away')) },
			recorder,
			'test.faulted',
		);

		await mapped.run({ execute: () => Promise.resolve(ok('wrote')), undo: () => Promise.resolve(ok('wrote')) });

		expect(Notice.shown.length).toBe(before);
	});
});
