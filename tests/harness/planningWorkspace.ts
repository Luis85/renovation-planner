import type { createRepositoryStack } from '../helpers/vault';
import type { PlanGeometrySidecar } from '../../src/application/ports/PlanGeometrySidecar';
import { InMemoryAssetPriceOverrideRepository } from '../../src/infrastructure/persistence/in-memory/InMemoryAssetPriceOverrideRepository';
import { ReferenceLocks } from '../../src/application/reference/ReferenceLocks';
import { planningServices } from '../../src/application/commands/renovation/PlanningServices';
import { renovationServices } from '../../src/application/commands/renovation/RenovationCommand';
import { validateDepthLinks } from '../../src/application/commands/renovation/planningLinks';
import { EMPTY_RENOVATION } from '../../src/domain/renovation/Renovation';
import { ObsidianReviewNotes } from '../../src/infrastructure/obsidian/repositories/ObsidianReviewNotes';
import { ObsidianEvidenceFiles } from '../../src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles';
import { ok } from '../../src/core/result/Result';

/** Production application services and file adapter, with explicitly bounded host stand-ins. */
export function planningWorkspace(stack: ReturnType<typeof createRepositoryStack>, geometry: PlanGeometrySidecar) {
 const planning = planningServices({ ...stack, geometry, overrides: new InMemoryAssetPriceOverrideRepository(), locks: new ReferenceLocks() });
 const notes = new ObsidianReviewNotes(stack.deps.vault, stack.index, 'shopping');
 const opened: string[] = [];
 const evidenceFiles = new ObsidianEvidenceFiles({ vault: stack.deps.vault, index: stack.index,
 workspace: { openLinkText: (path, source, newLeaf) => { opened.push(path + source + String(newLeaf)); return Promise.resolve(); } },
 cache: { getFirstLinkpathDest: (link, source) => stack.deps.vault.getFiles().find(file => file.path === source.slice(0, source.lastIndexOf('/') + 1) + link) ?? null } });
 return { planning, evidenceFiles,
 renovation: renovationServices(stack.plans, geometry, stack.events, async (plan, document) => { const read = await planning.read(plan.id); return read.ok ? validateDepthLinks(plan.renovation ?? EMPTY_RENOVATION, { ...read.value, geometry: { ...read.value.geometry, document } }) : read; }),
 shoppingNote: async (...args: Parameters<typeof notes.generate>) => { const result = await notes.generate(...args); return result.ok ? ok(undefined) : result; } };
}
