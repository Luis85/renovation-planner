import { groupGeometryServices } from '../../src/application/commands/spatial/GroupGeometryCommand';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { createPlanChangeSource } from '../../src/application/events/planChangeSource';
import { createProjectPlansChangeSource } from '../../src/application/events/projectPlansChangeSource';
import { createVaultFileChangeSource } from '../../src/infrastructure/obsidian/vault/vaultFileChanges';
import { GetAssetDesignQuery } from '../../src/application/queries/GetAssetDesign';
import { ObsidianAssetGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetGeometrySidecar';
import { readAssetShapes } from '../../src/presentation/read-models/assetShapes';
import { planningWorkspace } from './planningWorkspace';
import { createRepositoryStack } from '../helpers/vault';
import { makeAsset, makePlan, makeProject } from '../helpers/entities';
import { expectDefined, expectOk } from '../helpers/domain';
import { shapeFromDimensions } from '../../src/domain/asset/AssetShape';
import { placementPoints } from '../../src/domain/spatial/assetPlacement';
import { withPlanSpatialElements } from '../../src/domain/plan/Plan';
import { ObsidianPlanGeometrySidecar } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanGeometrySidecar';
import { referencePlanServices } from '../../src/application/commands/plan/ConfigurePlanReference';
import { structureServices } from '../../src/application/commands/spatial/StructureCommand';
import { ObsidianReviewNotes } from '../../src/infrastructure/obsidian/repositories/ObsidianReviewNotes';
import { makeDeleteZoneCommand } from '../helpers/slice10';
import { CreateZoneCommand } from '../../src/application/commands/zone/CreateZone';
import { MoveSpatialObjectCommand } from '../../src/application/commands/zone/MoveSpatialObject';
import { GetZoneInspector } from '../../src/application/queries/GetZoneInspector';
import { toPlanDto, toZoneDto, type PlanDto } from '../../src/presentation/read-models/PlanDto';
import type { PlanId } from '../../src/domain/plan/PlanId';
import type { ProjectId } from '../../src/domain/project/ProjectId';
import type { PlanEditorDeps } from '../../src/presentation/views/PlanEditorView';
import { ok } from '../../src/core/result/Result';
import { evidenceGalleryFixtures } from './evidenceGalleryFixtures';

/** Real repositories over FakeVault; only the two binary sources are served as static fixtures. */
export function referenceWorkspace(base: PlanEditorDeps, dto: PlanDto, planning = false) {
	const stack = createRepositoryStack();
	const plan = makePlan({ id: dto.id as PlanId, projectId: dto.projectId as ProjectId, name: dto.name, background: null });
	const geometry = new ObsidianPlanGeometrySidecar(stack.store);
	const ready = (async () => {
		expectOk(await stack.projects.save(makeProject({ id: plan.projectId }), 'absent'));
		expectOk(await stack.plans.save(plan, 'absent'));
        if (planning) for (const asset of [makeAsset({ name: 'Oak floor', unit: 'm2' }), makeAsset({ name: 'Skirting', unit: 'm' }), makeAsset({ name: 'Door handles', unit: 'piece' })]) expectOk(await stack.assets.save(asset, 'absent'));
		if (planning && new URLSearchParams(location.search).has('assets')) {
			const radiator = makeAsset({ name: 'Radiator', unit: 'piece' });
			expectOk(await stack.assets.save(radiator, 'absent'));
			expectOk(await new ObsidianAssetGeometrySidecar(stack.assetGeometry).write(radiator.id, { calibration: null, shape: expectOk(shapeFromDimensions(800, 600)) }));
			const baseline = expectOk(await geometry.read(plan.id));
			const elements = [
				{ id: 'element-harness-radiator-a', kind: 'asset' as const, assetId: radiator.id, points: placementPoints({ x: 1500, y: 800 }, 0) },
				{ id: 'element-harness-radiator-b', kind: 'asset' as const, assetId: radiator.id, points: placementPoints({ x: 3000, y: 2000 }, Math.PI / 2) },
				{ id: 'element-harness-missing', kind: 'asset' as const, assetId: 'asset-harness-deleted', points: placementPoints({ x: 800, y: 2200 }, 0) },
			];
			expectOk(await geometry.write(plan.id, { ...baseline.document, structure: { walls: [], openings: [], boundaries: [], elements } }, baseline.version));
			const loaded = expectDefined(expectOk(await stack.plans.getById(plan.id)), 'harness reference plan');
			expectOk(await stack.plans.save(expectOk(withPlanSpatialElements(loaded.entity, elements.map((item, index) => ({ id: item.id, name: ['Radiator', 'Radiator', 'Old boiler'][index] })))), loaded.version));
		}
		stack.vault.entries.set('scan.png', 'PNG fixture'); stack.vault.entries.set('scan.pdf', 'PDF fixture');
	})();
	const reviewNotes = new ObsidianReviewNotes(stack.deps.vault, stack.index);
	const sources: Record<string, string> = { 'scan.png': new URLSearchParams(location.search).has('fidelity') ? new URL('../fixtures/editor-floor-reference.png', import.meta.url).href : new URL('../fixtures/editor-background-png-test.png', import.meta.url).href, 'scan.pdf': new URL('../fixtures/editor-background-pdf-test.pdf', import.meta.url).href };
	if (new URLSearchParams(location.search).has('gallery-fixtures')) {
		Object.assign(sources, evidenceGalleryFixtures());
		for (const path of Object.keys(sources).filter(candidate => candidate.startsWith('gallery-'))) stack.vault.entries.set(path, '1600x1200 synthetic PNG fixture');
	}
	// Opt-in supplemental acceptance data. Existing journeys retain their original fixture catalogue.
	if (new URLSearchParams(location.search).has('modal-placement-fixtures')) {
		for (let index = 0; index < 256; index++) stack.vault.entries.set(`photo-modal-${String(index).padStart(3, '0')}.md`, '# Synthetic non-image search candidate');
		for (let index = 0; index < 64; index++) {
			const path = `photo-modal-${String(index).padStart(2, '0')}.png`;
			sources[path] = sources['scan.png']; stack.vault.entries.set(path, 'Synthetic PNG alias for bounded image-search acceptance');
		}
	}
	const previousResourcePath = stack.deps.vault.getResourcePath.bind(stack.deps.vault);
	stack.deps.vault.getResourcePath = file => sources[file.path as keyof typeof sources] ?? previousResourcePath(file);
	const services = referencePlanServices(stack.plans, geometry, stack.events, { fileExists: path => path in sources });
	const deps: PlanEditorDeps = {
		...base,
        onPlanChanged: createPlanChangeSource(stack.events),
        // Both plan doors over the SAME bus the writes below publish on: this workspace writes, so a
        // sibling created or re-kinded here has to re-read the tree, where `harnessDeps`'s inert door
        // is honest only for the bare page that writes nothing.
        onProjectPlansChanged: createProjectPlansChangeSource(stack.events),
        onVaultFileChanged: createVaultFileChangeSource(stack.deps.vault),
		queries: { ...base.queries,
			getPlan: async () => { await ready; const result = await stack.plans.getById(plan.id); return result.ok ? ok(result.value ? toPlanDto(result.value.entity) : null) : result; },
			findZonesByPlan: async () => { await ready; const snapshot = await geometry.read(plan.id); if (!snapshot.ok) return snapshot; const result = await stack.zones.listByPlan(plan.id); return result.ok ? ok({ zones: result.value.loaded.map(z => toZoneDto(z.entity)), unreadable: result.value.refused, structure: snapshot.value.document.structure, intended: snapshot.value.document.intended, groups: snapshot.value.document.groups }) : result; },
			assetShapes: async ids => { await ready; return readAssetShapes(new GetAssetDesignQuery(stack.assets, new ObsidianAssetGeometrySidecar(stack.assetGeometry)), ids); },
		},
		commands: { ...base.commands, groups: groupGeometryServices(geometry, stack.zones, stack.events), referencePlan: services, zones: stack.zones, events: stack.events,
			...(planning ? planningWorkspace(stack, geometry) : { renovation: renovationServices(stack.plans, geometry, stack.events) }),
			reviewNote: async (id, body) => { const result = await reviewNotes.generate(id, body); return result.ok ? ok(undefined) : result; },
			structure: structureServices(geometry, stack.events), deleteZone: makeDeleteZoneCommand(stack.zones, stack.events, stack.requirements), requirementEdits: { ...base.commands.requirementEdits, requirements: stack.requirements },
			createZone: new CreateZoneCommand(stack.zones, stack.plans, stack.events), moveObject: new MoveSpatialObjectCommand(stack.zones, stack.events), zoneInspector: new GetZoneInspector(stack.zones),
		},
		vault: {
			getAbstractFileByPath: path => stack.vault.getAbstractFileByPath(path) as never,
			getResourcePath: file => sources[file.path as keyof typeof sources],
			readBinary: async file => (await fetch(sources[file.path as keyof typeof sources])).arrayBuffer(),
		},
	};
	const planningServices = deps.commands.planning;
	if (planningServices) {
		const read = planningServices.read;
		planningServices.read = async id => { await ready; return read(id); };
	}
	return { deps, stack, services, geometry, ready, plan };
}
