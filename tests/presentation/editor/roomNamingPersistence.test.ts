import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../helpers/vault';
import { stackFoundation } from '../../helpers/repositoryStack';
import { makePlan, makeProject, makeZone } from '../../helpers/entities';
import { expectDefined, expectFound, expectOk } from '../../helpers/domain';
import { RenameZoneCommand } from '../../../src/application/commands/zone/RenameZone';
import { ReversibleRenameZoneCommand } from '../../../src/application/commands/zone/reversible-rename-zone-command';
import { SessionWriteLedger } from '../../../src/application/editor/WriteLedger';
import { ObsidianZoneRepository } from '../../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';

async function seed() {
	const stack = createRepositoryStack(); const project = makeProject(), plan = makePlan({ projectId: project.id });
	expectOk(await stack.projects.save(project, 'absent')); expectOk(await stack.plans.save(plan, 'absent'));
	const original = makeZone({ projectId: project.id, planId: plan.id, name: 'Kitchen', geometry: { points: [{ x: 0, y: 0 }, { x: 2000, y: 900 }, { x: 600, y: 3000 }] } });
	expectOk(await stack.zones.save(original, 'absent'));
	const path = expectDefined(stack.index.getPath(original.id), 'path');
	const file = stack.vault.getAbstractFileByPath(path) as never;
	await stack.vault.modify(file, `${expectDefined(stack.vault.entries.get(path), 'note')}\nUser text with [[Linked note]]\n`);
	stack.metadataCache.catchUp();
	const baseline = expectFound(await stack.zones.getById(original.id));
	const adapter = new ReversibleRenameZoneCommand(new RenameZoneCommand(stack.zones, stack.events), new SessionWriteLedger(), {
		zoneId: original.id, name: ' Lounge / A: Küche ', inverse: original.name, expected: baseline.version,
	});
	return { stack, original, path, adapter, baseline };
}

describe('renaming through the actual Markdown/sidecar repository stack', () => {
	it('reopens with fresh repositories and index, preserving paths, body, identity, references and geometry', async () => {
		const { stack, original, path, adapter } = await seed();
		const beforePaths = [...stack.vault.entries.keys()];
		const before = parseFrontmatter(expectDefined(stack.vault.entries.get(path), 'note'));
		const geometryPath = expectDefined(beforePaths.find(p => p.endsWith('.rpgeo')), 'sidecar');
		const geometry = stack.vault.entries.get(geometryPath);
		expectOk(await adapter.execute());
		expect(stack.index.getPath(original.id)).toBe(path); expect([...stack.vault.entries.keys()]).toEqual(beforePaths);
		const afterText = expectDefined(stack.vault.entries.get(path), 'saved note');
		const after = parseFrontmatter(afterText);
		expect(after.frontmatter).toEqual({ ...before.frontmatter, name: 'Lounge / A: Küche', revision: (before.frontmatter['revision'] as number) + 1 });
		expect(afterText).toContain('User text with [[Linked note]]');
		// The repository may revise its sidecar document; the geometry entries must be identical.
		expect(JSON.parse(expectDefined(stack.vault.entries.get(geometryPath), 'sidecar')).objects).toEqual(JSON.parse(expectDefined(geometry, 'original sidecar')).objects);
		stack.metadataCache.catchUp();
		const reopened = stackFoundation({ vault: stack.vault, fileManager: stack.fileManager, metadataCache: stack.metadataCache }, stack.projectFolder);
		reopened.rebuildIndex(); const zones = new ObsidianZoneRepository(reopened.deps, reopened.store);
		const loaded = expectFound(await zones.getById(original.id));
		expect(loaded.entity).toEqual(expectOk(original.withName('Lounge / A: Küche')));
		expect(expectOk(await zones.listByPlan(original.planId)).loaded).toHaveLength(1);
		expect(stack.vault.entries.get(path)).toBe(afterText); // read alone never writes
		expectOk(await adapter.undo()); expect(expectFound(await stack.zones.getById(original.id)).entity.name).toBe('Kitchen');
		expectOk(await adapter.execute()); expect(stack.index.getPath(original.id)).toBe(path);
	});
	it('refuses an external note edit and compensates a sidecar failure using the existing transaction', async () => {
		const { stack, path, adapter, baseline } = await seed();
		const file = stack.vault.getAbstractFileByPath(path) as never;
		await stack.vault.modify(file, expectDefined(stack.vault.entries.get(path), 'note').replace('Kitchen', 'Peer'));
		stack.metadataCache.catchUp();
		expect(await adapter.execute()).toMatchObject({ ok: false, error: { code: 'zone.external-modification' } });
		expect(expectFound(await stack.zones.getById(baseline.entity.id)).entity.name).toBe('Peer');
		const r = await seed(); const snapshot = r.stack.vault.entries.get(r.path);
		const sidecar = expectDefined([...r.stack.vault.entries.keys()].find(p => p.endsWith('.rpgeo')), 'sidecar');
		r.stack.vault.failures.add(`modify:${sidecar}`);
		expect(await r.adapter.execute()).toMatchObject({ ok: false });
		expect(r.stack.vault.entries.get(r.path)).toBe(snapshot);
		expect(expectFound(await r.stack.zones.getById(r.original.id)).entity.name).toBe('Kitchen');
	});
});
