// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { currencyOf } from '../../../src/core/money/Money';
import { err } from '../../../src/core/result/Result';
import type { PlanId } from '../../../src/domain/plan/PlanId';
import type { Structure } from '../../../src/domain/spatial/Structure';
import { editWall } from '../../../src/domain/spatial/structureGeometry';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { structureServices } from '../../../src/application/commands/spatial/StructureCommand';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { GetProject } from '../../../src/application/queries/GetProject';
import { FindZonesByPlan } from '../../../src/application/queries/FindZonesByPlan';
import { ObsidianPlanGeometrySidecar } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { ObsidianPlanRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { createPlanEditorQueries } from '../../../src/presentation/read-models/planEditorQueries';
import { toPlanDto } from '../../../src/presentation/read-models/PlanDto';
import { unavailablePlanEditorCommands } from '../../../src/presentation/editor/planEditorCommands';
import { useProjectStore } from '../../../src/presentation/stores/ProjectStore';
import { useSelectionStore } from '../../../src/presentation/editor/selection/selection-store';
import { useDialogStore } from '../../../src/presentation/dialogs/dialog-store';
import { openFixtureVault, type FixtureStack } from '../../helpers/fixtureVault';
import { stackFoundation } from '../../helpers/repositoryStack';
import { expectDefined, expectFound, expectOk, injectedPersistenceError } from '../../helpers/domain';
import { mountPlanEditorCanvas, runtimeOf, settle, settleUntil, type EditorHarness } from '../../helpers/editor';
import { WALL_LOOP } from '../../helpers/structure';
import { makePlan, makeProject } from '../../helpers/entities';

const planId = 'plan-opening-fresh' as PlanId;
const openings: Structure['openings'] = [
	{ id: 'opening-window', kind: 'window', hostId: 'wall-a', offset: 425.25, width: 1025, height: 1175, sill: 825 },
	{ id: 'opening-door', kind: 'door', hostId: 'wall-b', offset: 600, width: 850, height: 2075, sill: 0 },
	{ id: 'opening-passage', kind: 'opening', hostId: 'wall-c', offset: 700, width: 1100, height: 2200, sill: 0 },
];
const fixtures: FixtureStack[] = [], mounted: EditorHarness[] = [];
afterEach(() => { for (const h of mounted.splice(0)) h.unmount(); for (const fixture of fixtures.splice(0)) fixture.dispose(); });

async function reopenedEditor() {
	const fixture = await openFixtureVault('valid-project'); fixtures.push(fixture); fixture.rebuildIndex();
	const project = makeProject({ name: 'Opening reload' });
	expectOk(await fixture.projects.save(project, 'absent'));
	expectOk(await fixture.plans.save(makePlan({ id: planId, projectId: project.id, background: null }), 'absent'));
	const writingGeometry = new ObsidianPlanGeometrySidecar(fixture.store);
	const baseline = expectOk(await writingGeometry.read(planId));
	expectOk(await structureServices(writingGeometry, fixture.events).command({ planId, baseline,
		structure: { ...WALL_LOOP, openings }, ledger: new SessionWriteLedger() }).execute());
	const path = expectDefined(fixture.index.getGeometrySidecarPath(planId), 'persisted opening sidecar');
	const bytes = expectDefined(fixture.vault.readOrUndefined(path), 'persisted bytes');
	expect(JSON.parse(bytes).structure.openings).toEqual(openings);
	// Reconstruct index, echo window, stores and repositories; keep only the persisted host files.
	fixture.metadataCache.catchUp();
	const fresh = stackFoundation({ vault: fixture.vault, fileManager: fixture.fileManager, metadataCache: fixture.metadataCache }, fixture.projectFolder);
	fresh.rebuildIndex();
	const geometry = new ObsidianPlanGeometrySidecar(fresh.store);
	const plans = new ObsidianPlanRepository(fresh.deps, fresh.store);
	const projects = new ObsidianProjectRepository(fresh.deps, fresh.projectFolder, 'Library', currencyOf('EUR'));
	const zones = new ObsidianZoneRepository(fresh.deps, fresh.store);
	const services = structureServices(geometry, fresh.events);
	const queries = createPlanEditorQueries({ geometry, getPlan: new GetPlan(plans), getProject: new GetProject(projects), findZonesByPlan: new FindZonesByPlan(zones) });
	const plan = expectFound(await plans.getById(planId)).entity;
	const harness = await mountPlanEditorCanvas({ plan: toPlanDto(plan), queries,
		commands: { ...unavailablePlanEditorCommands(), structure: services, logger: fresh.logger, events: fresh.events, zones } });
	mounted.push(harness);
	const runtime = runtimeOf(harness), projection = useProjectStore(harness.pinia), selection = useSelectionStore(harness.pinia), dialogs = useDialogStore(harness.pinia);
	expect(projection.structure.openings).toEqual(openings);
	expect(fixture.vault.readOrUndefined(path)).toBe(bytes); // A fresh read must never rewrite the fixture.
	expect(runtime.canUndo.value).toBe(false); // History is leaf-local, not durable state.
	return { fixture, fresh, geometry, services, queries, harness, runtime, project: projection, selection, dialogs, path };
}

describe('hosted openings after a fresh disk-backed repository and editor reconstruction', () => {
	it('restores every persisted opening field, edits by list identity and reverses exactly', async () => {
		const r = await reopenedEditor();
		await expectDefined(r.harness.wrapper.findAll('.rp-structure-list__row').find(row => row.text() === 'Window 1'), 'opening list row').trigger('click'); await settle();
		expect(r.selection.selectedIds).toEqual(['opening-window']);
		const pending = r.runtime.structureActions.edit('opening-window');
		await settleUntil(() => r.harness.wrapper.find('.rp-dialog form').exists(), 'fresh opening editor');
		await r.harness.wrapper.get('.rp-dialog input[name="width"]').setValue('1,150');
		await r.harness.wrapper.get('.rp-dialog input[name="height"]').setValue('1.2');
		await r.harness.wrapper.get('.rp-dialog input[name="sill"]').setValue('0.9');
		await r.harness.wrapper.get('.rp-dialog form').trigger('submit');
		expect(expectOk(await r.geometry.read(planId)).document.structure?.openings).toEqual(openings);
		await r.harness.wrapper.get('.rp-dialog form').trigger('submit'); await pending;
		const changed = [{ ...openings[0], width: 1150, height: 1200, sill: 900 }, ...openings.slice(1)];
		expect(r.project.structure.openings).toEqual(changed);
		expect(JSON.parse(expectDefined(r.fixture.vault.readOrUndefined(r.path), 'saved bytes')).structure.openings).toEqual(changed);
		await r.runtime.undo(); expect(r.project.structure.openings).toEqual(openings); expect(r.runtime.canUndo.value).toBe(false);
		await r.runtime.redo(); expect(r.project.structure.openings).toEqual(changed);
	});
	it('refuses missing and too-small hosts, confirms cascading deletion, and restores original IDs through history', async () => {
		const r = await reopenedEditor(), baseline = expectOk(await r.geometry.read(planId));
		const structure = expectDefined(baseline.document.structure, 'fresh structure');
		const missing = { ...structure, walls: structure.walls.filter(wall => wall.id !== 'wall-a') };
		const short = editWall(structure, { ...structure.walls[0], end: { x: 1000, y: 0 } });
		for (const [next, code] of [[missing, 'spatial.host-missing'], [short, 'spatial.opening-containment']] as const) {
			const before = r.fixture.vault.readOrUndefined(r.path);
			expect(await r.runtime.dispatcher.run(r.services.command({ planId, baseline, structure: next, ledger: r.runtime.structureTask.ledger }))).toMatchObject({ ok: false, error: { code } });
			expect(r.fixture.vault.readOrUndefined(r.path)).toBe(before); expect(r.runtime.canUndo.value).toBe(false);
		}
		r.selection.select(['wall-a' as never]);
		let pending = r.runtime.structureActions.remove('wall-a'); await settleUntil(() => r.dialogs.current !== null, 'host deletion confirmation');
		expect(r.harness.wrapper.get('.rp-dialog').text()).toContain('Openings removed: 1');
		r.dialogs.resolve('cancel'); await pending; expect(r.project.structure.openings).toEqual(openings);
		pending = r.runtime.structureActions.remove('wall-a'); await settleUntil(() => r.dialogs.current !== null, 'host deletion confirmation');
		r.dialogs.resolve('confirm'); await pending;
		expect(r.project.structure.walls.some(wall => wall.id === 'wall-a')).toBe(false);
		expect(r.project.structure.openings).toEqual(openings.slice(1));
		await r.runtime.undo(); expect(r.project.structure).toEqual(structure); expect(r.runtime.canUndo.value).toBe(false);
		await r.runtime.redo(); expect(r.project.structure.openings).toEqual(openings.slice(1));
	});
	it('keeps a confirmed opening write after failed readback and refreshes without writing again', async () => {
		const r = await reopenedEditor();
		const baseline = expectOk(await r.geometry.read(planId)), structure = expectDefined(baseline.document.structure, 'fresh structure');
		const changed = { ...structure, openings: structure.openings.map(opening => opening.id === 'opening-window' ? { ...opening, offset: 800 } : opening) };
		const write = vi.spyOn(r.geometry, 'write');
		const readback = vi.spyOn(r.queries, 'findZonesByPlan').mockResolvedValue(err(injectedPersistenceError()));
		expectOk(await r.runtime.dispatcher.run(r.services.command({ planId, baseline, structure: changed, ledger: r.runtime.structureTask.ledger })));
		expect(expectOk(await r.geometry.read(planId)).document.structure).toEqual(changed);
		expect(r.project.stale).toBe(true); expect(r.runtime.canUndo.value).toBe(true); expect(write).toHaveBeenCalledTimes(1);
		for (let attempt = 0; attempt < 2; attempt++) {
			await r.runtime.refreshProjection();
			expect(r.project.stale).toBe(true); expect(write).toHaveBeenCalledTimes(1);
			expect(expectOk(await r.geometry.read(planId)).document.structure).toEqual(changed);
		}
		readback.mockRestore(); await r.runtime.refreshProjection();
		expect(r.project.stale).toBe(false); expect(r.project.structure).toEqual(changed); expect(write).toHaveBeenCalledTimes(1);
		await r.runtime.undo(); expect(r.project.structure).toEqual(structure);
	});
});
