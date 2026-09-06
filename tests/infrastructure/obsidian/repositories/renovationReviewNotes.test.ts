import { withPlanRenovation } from '../../../../src/domain/plan/Plan';
import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import { renovationStack } from '../../../helpers/renovation';
import { expectDefined, expectOk } from '../../../helpers/domain';
import { ObsidianReviewNotes } from '../../../../src/infrastructure/obsidian/repositories/ObsidianReviewNotes';
import { RenovationSchema } from '../../../../src/infrastructure/persistence/dto/renovation';
import { PLAN_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';

describe('generated review notes and v3 recovery', () => {
	it('creates stable sibling paths, updates only its unchanged projection and preserves human edits', async () => {
		const rig = await renovationStack(), notes = new ObsidianReviewNotes(rig.stack.deps.vault, rig.stack.index);
		const path = expectOk(await notes.generate(rig.plan.id, '# Findings\n- Select oil'));
		expect(path).toMatch(/Review-[a-f0-9]+\.md$/);
		const bytes = expectDefined(rig.stack.vault.entries.get(path), 'review note'); expect(bytes).toContain('Select oil');
		expect(expectOk(await notes.generate(rig.plan.id, '# Findings\n- Select oil'))).toBe(path);
		expectOk(await notes.generate(rig.plan.id, '# Findings\nNo unresolved decisions')); expect(rig.stack.vault.entries.get(path)).toContain('No unresolved');
		rig.stack.vault.entries.set(path, `${bytes}
Human annotation`);
		expect(await notes.generate(rig.plan.id, 'next')).toMatchObject({ ok: false, error: { code: 'review.revision-conflict' } });
		expect(rig.stack.vault.entries.get(path)).toContain('Human annotation');
	});
	it('refuses occupied folders, missing sources, races and storage failures', async () => {
		const rig = await renovationStack(), notes = new ObsidianReviewNotes(rig.stack.deps.vault, rig.stack.index);
		const path = expectOk(await notes.generate(rig.plan.id, 'first'));
		vi.spyOn(rig.stack.vault, 'process').mockImplementationOnce((file, update) => { rig.stack.vault.entries.set(file.path, 'peer'); return Promise.resolve(update('peer')); });
		expect(await notes.generate(rig.plan.id, 'second')).toMatchObject({ ok: false }); expect(rig.stack.vault.entries.get(path)).toBe('peer');
		rig.stack.vault.entries.delete(path); await rig.stack.vault.createFolder(path);
		expect(await notes.generate(rig.plan.id, 'third')).toMatchObject({ ok: false }); await rig.stack.vault.delete(rig.stack.vault.getAbstractFileByPath(path) as TFile);
		vi.spyOn(rig.stack.vault, 'create').mockRejectedValueOnce(new Error('disk')); expect(await notes.generate(rig.plan.id, 'fourth')).toMatchObject({ ok: false, error: { code: 'review.write-failed' } });
		rig.stack.index.remove(rig.plan.id); expect(await notes.generate(rig.plan.id, 'fifth')).toMatchObject({ ok: false, error: { code: 'review.source-missing' } });
	});
	it('serializes duplicate generation and validates pure idempotent migrations', async () => {
		const rig = await renovationStack(), notes = new ObsidianReviewNotes(rig.stack.deps.vault, rig.stack.index);
		const result = await Promise.all([notes.generate(rig.plan.id, 'same'), notes.generate(rig.plan.id, 'same')]); expect(result[0]).toEqual(result[1]);
		for (const migration of [PLAN_MIGRATIONS[1], PLAN_GEOMETRY_MIGRATIONS[1]]) {
			for (const value of [null, 4, { custom: 'retained' }]) { const original = structuredClone(value), output = migration.migrate(value); expect(value).toEqual(original); expect(migration.migrate(output)).toEqual(output); }
		}
		expect(RenovationSchema.safeParse(rig.value).success).toBe(true); expect(RenovationSchema.safeParse({ ...rig.value, work: 'bad' }).success).toBe(false);
	});
	it('checks the live metadata in the conditional callback, preserving a peer update', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const process = rig.stack.deps.fileManager.processFrontMatter.bind(rig.stack.deps.fileManager);
		vi.spyOn(rig.stack.deps.fileManager, 'processFrontMatter').mockImplementationOnce((file, callback, options) => process(file, fm => { fm.revision += 1; fm.name = 'Peer floor'; callback(fm); }, options));
		const result = await rig.stack.plans.save(expectOk(withPlanRenovation(baseline.plan.entity, rig.value)), baseline.plan.version);
		expect(result).toMatchObject({ ok: false, error: { code: 'plan.revision-conflict' } });
		expect(rig.stack.vault.entries.get(expectDefined(rig.stack.index.getPath(rig.plan.id), 'plan path'))).toContain('Peer floor');
	});
	it('detects an intervening sidecar edit inside the atomic process callback', async () => {
		const rig = await renovationStack(), baseline = expectOk(await rig.read());
		const path = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'sidecar');
		const peer = expectDefined(rig.stack.vault.entries.get(path), 'bytes') + ' ';
		vi.spyOn(rig.stack.vault, 'process').mockImplementationOnce((file, update) => { expect(file).toBeInstanceOf(TFile); rig.stack.vault.entries.set(file.path, peer); return Promise.resolve(update(peer)); });
		expect(await rig.geometry.write(rig.plan.id, baseline.geometry.document, baseline.geometry.version)).toMatchObject({ ok: false, error: { code: 'plan-geometry.external-modification' } });
		expect(rig.stack.vault.entries.get(path)).toBe(peer);
	});
 it('refuses invalid persisted intended hosts and renovation metadata without rewriting their bytes', async () => {
  const rig = await renovationStack(), baseline = expectOk(await rig.read());
  expectOk(await rig.renovation.command(baseline, { renovation: rig.value, intended: baseline.geometry.document.structure }, rig.ledger).execute());
  const path = expectDefined(rig.stack.index.getGeometrySidecarPath(rig.plan.id), 'geometry');
  const original = expectDefined(rig.stack.vault.entries.get(path), 'geometry bytes');
  const invalid = JSON.parse(original); invalid.intended.openings = [{ id: 'bad', hostId: 'missing', kind: 'door', offset: 0, width: 900, height: 2000, sill: 0 }];
  rig.stack.vault.entries.set(path, JSON.stringify(invalid)); expect((await rig.geometry.read(rig.plan.id)).ok).toBe(false); expect(rig.stack.vault.entries.get(path)).toBe(JSON.stringify(invalid));
  rig.stack.vault.entries.set(path, original);
  const source = expectDefined(rig.stack.index.getPath(rig.plan.id), 'source');
  const note = expectDefined(rig.stack.vault.entries.get(source), 'note');
  rig.stack.vault.entries.set(source, note.replace(/^renovation:.*$/m, 'renovation: invalid'));
  expect((await rig.stack.plans.getById(rig.plan.id)).ok).toBe(false);
  expect((await rig.geometry.write(rig.plan.id, { ...baseline.geometry.document, objects: [], structure: { walls: [], openings: [], boundaries: [] } })).ok).toBe(false);
  expect(rig.stack.vault.entries.get(path)).toBe(original);
 });

});
