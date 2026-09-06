import { guardMaterialGeometry, guardMaterialRemoval } from '../../../../src/infrastructure/obsidian/repositories/planningReferentialGuard';
import { err, ok } from '../../../../src/core/result/Result';
import { withPlanRenovation } from '../../../../src/domain/plan/Plan';
import { describe, expect, it, vi } from 'vitest';
import type { MetadataCache, Workspace } from 'obsidian';
import { planningStack } from '../../../helpers/planning';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { ObsidianEvidenceFiles } from '../../../../src/infrastructure/obsidian/repositories/ObsidianEvidenceFiles';
import { ObsidianReviewNotes } from '../../../../src/infrastructure/obsidian/repositories/ObsidianReviewNotes';
import { relocateEvidence } from '../../../../src/infrastructure/obsidian/repositories/relocateEvidence';
import { PLAN_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { REQUIREMENT_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/entities/requirement/requirement.migrations';
import { RequirementSourceSchema, PlanningDepthSchema } from '../../../../src/infrastructure/persistence/dto/planningDepth';
import { planningInput, planningDraft } from '../../../../src/presentation/editor/planning/planningDraft';

async function filesRig() {
 const rig = await planningStack(), openLinkText = vi.fn<Workspace['openLinkText']>().mockResolvedValue(undefined);
 const cache = { getFirstLinkpathDest: vi.fn<MetadataCache['getFirstLinkpathDest']>((link: string, source: string) => rig.stack.vault.getFiles().find(file => file.path === source.slice(0, source.lastIndexOf('/') + 1) + link) ?? null) };
 const files = new ObsidianEvidenceFiles({ vault: rig.stack.deps.vault, workspace: { openLinkText } as unknown as Workspace, cache: cache as unknown as MetadataCache, index: rig.stack.index });
 return { ...rig, files, cache, openLinkText };
}
describe('ordinary vault evidence and owned generated projections', () => {
 it('resolves canonical and relative links, aliases, headings and duplicate basenames', async () => {
 const rig = await filesRig(), planPath = expectDefined(rig.stack.index.getPath(rig.plan.id), 'plan'), folder = planPath.slice(0, planPath.lastIndexOf('/'));
 rig.stack.vault.entries.set('Elsewhere/detail.md', '# Other'); rig.stack.vault.entries.set(`${folder}/detail.md`, '# Here'); rig.stack.vault.entries.set('photo.jpg', 'jpeg'); rig.stack.vault.entries.set('unsupported.zip', 'zip');
 expect(expectOk(rig.files.resolve('[[detail.md#Heading|alias]]', rig.plan.id))).toMatchObject({ path: `${folder}/detail.md`, subpath: '#Heading', image: null });
 expect(expectOk(rig.files.resolve('Elsewhere/detail.md#^block', rig.plan.id))).toMatchObject({ path: 'Elsewhere/detail.md', subpath: '#^block' });
 expect(expectOk(rig.files.resolve('photo.jpg', rig.plan.id)).image).toBe(''); expect(rig.files.resolve('missing.pdf', rig.plan.id).ok).toBe(false); expect(rig.files.resolve('unsupported.zip', rig.plan.id).ok).toBe(false);
 expect(rig.files.list()).toContain('photo.jpg'); expect(rig.files.list()).not.toContain('unsupported.zip');
 expectOk(await rig.files.open(`${folder}/detail.md`, '#Heading')); expect(rig.openLinkText).toHaveBeenCalledWith(`${folder}/detail.md#Heading`, '', false);
 expect((await rig.files.open('missing', '')).ok).toBe(false); rig.openLinkText.mockRejectedValueOnce(new Error('host')); expect((await rig.files.open('photo.jpg', '')).ok).toBe(false);
 });
 it('creates ordinary notes and binary imports, refusing collisions and unsafe names', async () => {
 const rig = await filesRig(); const path = expectOk(await rig.files.createNote(rig.plan.id, 'note-one', '# Notes\nUser content'));
 expect(rig.stack.vault.entries.get(path)).toBe('# Notes\nUser content'); expect((await rig.files.createNote(rig.plan.id, 'note-one', 'overwrite')).ok).toBe(false);
 const imported = expectOk(await rig.files.importFile(rig.plan.id, 'invoice.pdf', new Uint8Array([0, 255, 10]).buffer)); expect(rig.stack.vault.entries.get(imported)?.charCodeAt(1)).toBe(255);
 for (const name of ['../escape.pdf', 'CON.pdf', 'bad?.png', 'bad.', 'bad ', 'bad\u0001.png']) expect((await rig.files.importFile(rig.plan.id, name, new ArrayBuffer(0))).ok).toBe(false);
 expect((await rig.files.createNote(rig.plan.id, '../bad', '')).ok).toBe(false);
 vi.spyOn(rig.stack.vault, 'create').mockRejectedValueOnce(new Error('disk')); expect((await rig.files.createNote(rig.plan.id, 'note-two', 'keep draft')).ok).toBe(false);
 rig.stack.index.remove(rig.plan.id); expect((await rig.files.createNote(rig.plan.id, 'note-three', '')).ok).toBe(false);
 });
 it('follows renamed files and folder moves, preserves all unrelated records, and unlinks without deleting bytes', async () => {
 const rig = await filesRig(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const baseline = expectOk(await rig.read()); expectOk(await rig.renovation.command(baseline, { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger).execute());
 rig.stack.vault.entries.set('New/invoice.pdf', 'user PDF');
 expectOk(await relocateEvidence({ ...rig.deps, index: rig.stack.index }, 'Evidence', 'New'));
 let read = expectOk(await rig.read()); expect(read.plan.entity.renovation?.depth?.evidence[0].path).toBe('New/invoice.pdf'); expect(read.plan.entity.renovation?.depth?.costs).toEqual(rig.depth.costs);
 expectOk(await relocateEvidence({ ...rig.deps, index: rig.stack.index }, 'New/invoice.pdf', 'New/paid.pdf'));
 read = expectOk(await rig.read()); const depth = expectDefined(read.plan.entity.renovation?.depth, 'depth'); expect(depth.evidence[0].path).toBe('New/paid.pdf');
 const unlink = rig.renovation.command(read, { renovation: { ...rig.value, depth: { ...depth, evidence: [] } }, intended: undefined }, rig.ledger); expectOk(await unlink.execute()); expect(rig.stack.vault.entries.get('New/invoice.pdf')).toBe('user PDF'); expectOk(await unlink.undo());
 });
 it('finds moved shopping/review notes by ownership and refuses human edits or duplicate owners', async () => {
 const rig = await filesRig(), notes = new ObsidianReviewNotes(rig.stack.deps.vault, rig.stack.index, 'shopping');
 const path = expectOk(await notes.generate(rig.plan.id, `[[rp-id:${rig.plan.id}]]\n[[rp-id:unknown]]`)); const bytes = expectDefined(rig.stack.vault.entries.get(path), 'generated');
 expect(bytes).toContain(`[[${expectDefined(rig.stack.index.getPath(rig.plan.id), 'source')}]]`); expect(bytes).toContain('unknown');
 rig.stack.vault.entries.set('Lists/Shopping.md', bytes); rig.stack.vault.entries.delete(path);
 expect(expectOk(await notes.generate(rig.plan.id, 'updated'))).toBe('Lists/Shopping.md'); expect(rig.stack.vault.entries.has(path)).toBe(false);
 const owned = expectDefined(rig.stack.vault.entries.get('Lists/Shopping.md'), 'owned'); rig.stack.vault.entries.set('duplicate.md', owned); expect((await notes.generate(rig.plan.id, 'again')).ok).toBe(false); rig.stack.vault.entries.delete('duplicate.md');
 rig.stack.vault.entries.set('Lists/Shopping.md', owned + '\nHuman'); expect((await notes.generate(rig.plan.id, 'again')).ok).toBe(false);
 });
 it('validates new schemas and migrations, and hydrates all draft record kinds', async () => {
 const rig = await filesRig(); expect(RequirementSourceSchema.safeParse(rig.input.source).success).toBe(true); expect(PlanningDepthSchema.safeParse(rig.depth).success).toBe(true);
 for (const migration of [PLAN_MIGRATIONS.at(-1), REQUIREMENT_MIGRATIONS.at(-1)]) for (const input of [null, 3, { 'schema-version': 1, body: 'keep' }]) { const step = expectDefined(migration, 'migration'); const before = structuredClone(input), result = step.migrate(input); expect(input).toEqual(before); expect(step.migrate(result)).toEqual(result); }
 expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 let baseline = expectOk(await rig.read()); expectOk(await rig.renovation.command(baseline, { renovation: { ...rig.value, depth: rig.depth }, intended: undefined }, rig.ledger).execute()); baseline = expectOk(await rig.read());
 const cost = planningDraft('cost', baseline, rig.roomId, rig.cost.id), evidence = planningDraft('evidence', baseline, rig.roomId, rig.evidence.id);
 expect(cost.facts[0].amount).toBe('500'); expect(evidence.title).toBe(rig.evidence.description); expect(planningInput(cost, baseline).renovation.depth?.costs[0]).toEqual(rig.cost); expect(planningInput(evidence, baseline).renovation.depth?.evidence[0]).toEqual(rig.evidence);
 });
});


it('round-trips Unicode and spaces and refuses ambiguous import delimiters', async () => {
 const rig = await filesRig(), path = expectOk(await rig.files.importFile(rig.plan.id, 'Küche vorher.png', new Uint8Array([7, 8]).buffer));
 expect(expectOk(rig.files.resolve(path, rig.plan.id)).path).toBe(path); expectOk(await rig.files.open(path, '')); expect(rig.openLinkText).toHaveBeenLastCalledWith(path, '', false);
 for (const name of ['part#heading.png', '[photo].png', 'bad|alias.md']) expect((await rig.files.importFile(rig.plan.id, name, new ArrayBuffer(0))).ok).toBe(false);
 const planPath = expectDefined(rig.stack.index.getPath(rig.plan.id), 'source'); rig.stack.vault.entries.delete(planPath); expect((await rig.files.createNote(rig.plan.id, 'missing-source', 'Draft')).ok).toBe(false);
});


it('refuses rename updates that cannot be saved, while preserving unrelated evidence paths', async () => {
 const rig = await filesRig(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const read = expectOk(await rig.read()), evidence = [rig.evidence, { ...rig.evidence, id: 'other-evidence', path: 'Elsewhere/notes.md' }];
 expectOk(await rig.stack.plans.save(expectOk(withPlanRenovation(read.plan.entity, { ...rig.value, depth: { ...rig.depth, evidence } })), read.plan.version));
 const failure = { category: 'Persistence' as const, code: 'test.disk', message: 'offline' }, deps = { ...rig.deps, index: rig.stack.index };
 vi.spyOn(rig.deps.plans, 'getById').mockResolvedValueOnce(err(failure)); expect(await relocateEvidence(deps, 'Evidence', 'New')).toEqual(err(failure));
 vi.spyOn(rig.deps.plans, 'save').mockResolvedValueOnce(err(failure)); expect(await relocateEvidence(deps, 'Evidence', 'New')).toEqual(err(failure)); expect(expectOk(await rig.read()).plan.entity.renovation?.depth?.evidence[0].path).toBe(rig.evidence.path);
 expectOk(await relocateEvidence(deps, 'Evidence', 'New')); expect(expectOk(await rig.read()).plan.entity.renovation?.depth?.evidence[1].path).toBe('Elsewhere/notes.md');
 vi.spyOn(rig.deps.plans, 'getById').mockResolvedValueOnce(ok(null)); expectOk(await relocateEvidence(deps, 'New', 'Next'));
});

it('checks source notes from bytes when metadata is stale or malformed', async () => {
 const rig = await filesRig(); expectOk(await rig.planning.material(expectOk(await rig.read()), rig.input, rig.ledger).execute());
 const path = expectDefined(rig.stack.index.getPath(rig.input.id as never), 'requirement'), bytes = expectDefined(rig.stack.vault.entries.get(path), 'bytes');
 const dto = { unit: 'mm' as const, schemaVersion: 3 as const, revision: 0, planId: rig.plan.id, calibration: null, objects: [] };
 rig.stack.vault.entries.set(path, bytes.replace(/rule: "?room-area"?/, 'rule: unsupported'));
 expect((await guardMaterialGeometry({ vault: rig.stack.deps.vault, index: rig.stack.index }, rig.plan.id, dto, dto)).ok).toBe(false);
 rig.stack.vault.entries.set(path, 'No frontmatter'); expectOk(await guardMaterialGeometry({ vault: rig.stack.deps.vault, index: rig.stack.index }, rig.plan.id, dto, dto));
 rig.stack.vault.entries.delete(path); expectOk(await guardMaterialGeometry({ vault: rig.stack.deps.vault, index: rig.stack.index }, rig.plan.id, dto, dto));
 const planPath = expectDefined(rig.stack.index.getPath(rig.plan.id), 'plan'); rig.stack.vault.entries.set(planPath, '---\nrenovation: invalid\n---\n'); expect((await guardMaterialRemoval({ vault: rig.stack.deps.vault, index: rig.stack.index }, rig.input.id)).ok).toBe(false);
});
