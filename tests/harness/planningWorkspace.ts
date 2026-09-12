import type { createRepositoryStack } from '../helpers/vault';
import type { PlanGeometrySidecar } from '../../src/application/ports/PlanGeometrySidecar';
import { InMemoryAssetPriceOverrideRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { planningServices, type PlanningDeps } from '../../src/application/commands/renovation/PlanningServices';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { renovationLinkCheck } from '../../src/application/commands/renovation/renovationLinkCheck';
import { constructionAwareRenovation } from '../../src/application/commands/renovation/ConstructionMaterialCommand';
import { ObsidianReviewNotes } from '../../src/infrastructure/obsidian/repositories/ObsidianReviewNotes';
import { ObsidianEvidenceFiles } from '../../src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles';
import { ok } from '../../src/core/result/Result';

/** Production application services and file adapter, with explicitly bounded host stand-ins. */
export function planningWorkspace(stack: ReturnType<typeof createRepositoryStack>, geometry: PlanGeometrySidecar) {
 const deps: PlanningDeps = { ...stack, geometry, overrides: new InMemoryAssetPriceOverrideRepository(), locks: new ReferenceLocks() };
 const planning = planningServices(deps);
 const notes = new ObsidianReviewNotes(stack.deps.vault, stack.index, 'shopping');
 const opened: string[] = [];
 const evidenceFiles = new ObsidianEvidenceFiles({ vault: stack.deps.vault, index: stack.index,
 workspace: { openLinkText: (path, source, newLeaf) => { opened.push(path + source + String(newLeaf)); return Promise.resolve(); } },
 cache: { getFirstLinkpathDest: (link, source) => stack.deps.vault.getFiles().find(file => file.path === source.slice(0, source.lastIndexOf('/') + 1) + link) ?? null } });
 return { planning, evidenceFiles,
 renovation: constructionAwareRenovation(renovationServices(stack.plans, geometry, stack.events, renovationLinkCheck(deps)), deps),
 shoppingNote: async (...args: Parameters<typeof notes.generate>) => { const result = await notes.generate(...args); return result.ok ? ok(undefined) : result; } };
}
