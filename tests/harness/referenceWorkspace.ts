import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { createPlanChangeSource } from '../../src/application/events/planChangeSource';
import { createVaultFileChangeSource } from '../../src/infrastructure/obsidian/vault/vaultFileChanges';
import { planningWorkspace } from './planningWorkspace';
import { createRepositoryStack } from '../helpers/vault';
import { makeAsset, makePlan, makeProject } from '../helpers/entities';
import { expectOk } from '../helpers/domain';
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

/** Real repositories over FakeVault; only the two binary sources are served as static fixtures. */
export function referenceWorkspace(base: PlanEditorDeps, dto: PlanDto, planning = false) {
	const stack = createRepositoryStack();
	const plan = makePlan({ id: dto.id as PlanId, projectId: dto.projectId as ProjectId, name: dto.name, background: null });
	const ready = (async () => {
		expectOk(await stack.projects.save(makeProject({ id: plan.projectId }), 'absent'));
		expectOk(await stack.plans.save(plan, 'absent'));
        if (planning) for (const asset of [makeAsset({ name: 'Oak floor', unit: 'm2' }), makeAsset({ name: 'Skirting', unit: 'm' }), makeAsset({ name: 'Door handles', unit: 'piece' })]) expectOk(await stack.assets.save(asset, 'absent'));
		stack.vault.entries.set('scan.png', 'PNG fixture'); stack.vault.entries.set('scan.pdf', 'PDF fixture');
	})();
	const geometry = new ObsidianPlanGeometrySidecar(stack.store);
	const reviewNotes = new ObsidianReviewNotes(stack.deps.vault, stack.index);
	const sources = { 'scan.png': new URL('../fixtures/editor-background-png-test.png', import.meta.url).href, 'scan.pdf': new URL('../fixtures/editor-background-pdf-test.pdf', import.meta.url).href } as const;
	const services = referencePlanServices(stack.plans, geometry, stack.events, { fileExists: path => path in sources });
	const deps: PlanEditorDeps = {
		...base,
        onPlanChanged: createPlanChangeSource(stack.events),
        onVaultFileChanged: createVaultFileChangeSource(stack.deps.vault),
		queries: { ...base.queries,
			getPlan: async () => { await ready; const result = await stack.plans.getById(plan.id); return result.ok ? ok(result.value ? toPlanDto(result.value.entity) : null) : result; },
			findZonesByPlan: async () => { await ready; const snapshot = await geometry.read(plan.id); if (!snapshot.ok) return snapshot; const result = await stack.zones.listByPlan(plan.id); return result.ok ? ok({ zones: result.value.loaded.map(z => toZoneDto(z.entity)), unreadable: result.value.refused, structure: snapshot.value.document.structure, intended: snapshot.value.document.intended }) : result; },
		},
		commands: { ...base.commands, referencePlan: services, zones: stack.zones, events: stack.events,
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
	return { deps, stack, services, geometry, ready, plan };
}
