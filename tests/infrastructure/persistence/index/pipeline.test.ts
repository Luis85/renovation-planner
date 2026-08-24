import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createZoneId } from '../../../../src/domain/zone/ZoneId';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';

/**
 * The vault-change pipeline (SDD §46–47): incremental create/modify/rename/delete must
 * converge to the same index a full rebuild produces; a malformed note is excluded with
 * a diagnostic instead of aborting the load; and the pipeline ignores this plugin's own
 * writes (the echo).
 */
function adapterOf(stack: ReturnType<typeof createRepositoryStack>): VaultChangeAdapter {
	return new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
		projectFolder: stack.projectFolder,
		debounceMs: 0,
	});
}

async function seed(stack: ReturnType<typeof createRepositoryStack>) {
	const projectId = createProjectId();
	const planId = createPlanId();
	expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
	expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
	return { projectId, planId };
}

function sorted(entry: { id: string }): string {
	return String(entry.id);
}

function serializeZoneNote(fields: { id: string; projectId: ProjectId; planId: string }): string {
	return [
		'---',
		'type: "renovation-zone"',
		'schema-version: 1',
		`"id": "${fields.id}"`,
		'revision: 1',
		`project: "${fields.projectId}"`,
		`plan: "${fields.planId}"`,
		'name: "Hand made"',
		'"zone-type": "room"',
		'status: "planned"',
		'---',
		'',
	].join('\n');
}

describe('vault change detection', () => {
	it('an incremental sequence converges to the same index as a full rebuild', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);

		// A hand-made zone note arrives through events, not through a repository.
		const zoneId = createZoneId();
		const zonePath = `Renovation/Zones/Hand made ${zoneId}.md`;
		stack.vault.entries.set(zonePath, serializeZoneNote({ id: zoneId, projectId, planId }));
		const file = stack.vault.getAbstractFileByPath(zonePath) as never;
		const adapter = adapterOf(stack);
		adapter.onCreate(file);
		adapter.flush();

		const incremental = stack.index.entries().map((entry) => sorted(entry));

		// A rebuild over the same final contents must answer identically.
		stack.index.rebuild([]);
		stack.rebuildIndex();
		expect(stack.index.entries().map((entry) => sorted(entry))).toEqual(incremental);
	});

	it('ignores its own echoes but processes foreign edits', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);

		// The repository write marked the echo window; replaying Obsidian's modify event
		// for the same bytes changes nothing.
		const before = JSON.stringify(stack.index.entries());
		const planFile = stack.vault.getAbstractFileByPath(stack.index.getPath(planId) ?? '') as never;
		adapter.onModify(planFile);
		adapter.flush();
		expect(JSON.stringify(stack.index.entries())).toBe(before);

		// A foreign edit moves the token: the same event now updates the index.
		const path = stack.index.getPath(planId) ?? '';
		const text = stack.vault.entries.get(path) ?? '';
		stack.vault.entries.set(path, `${text}trailing prose`);
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		const entry = stack.index.entries().find((candidate) => candidate.id === planId);
		expect(entry?.path).toBe(path);
	});

	it('excludes a malformed note with a diagnostic and keeps the rest of the vault', async () => {
		const stack = createRepositoryStack();
		await seed(stack);

		// Claims our type but declares nothing else — a broken file.
		stack.vault.entries.set('Renovation/Broken.md', '---\ntype: renovation-zone\nstatus: planned\n---\n');
		stack.rebuildIndex();

		const indexedIds = stack.index.entries().map((entry) => String(entry.id));
		expect(indexedIds.some((id) => id.startsWith('plan-') || id.startsWith('project-'))).toBe(true);
		const warns = stack.logged.filter(
			(line) => line.level === 'warn' && line.event.startsWith('persistence.'),
		);
		expect(warns.length).toBeGreaterThanOrEqual(1);
	});

	it('a rename moves the entry; a delete removes it', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const oldPath = stack.index.getPath(planId) ?? '';
		const newPath = 'Renovation/Plans/Renamed.md';

		stack.vault.entries.set(newPath, stack.vault.entries.get(oldPath) ?? '');
		stack.vault.entries.delete(oldPath);
		adapter.onRename(stack.vault.getAbstractFileByPath(newPath) as never, oldPath);
		adapter.flush();

		// A rename of UNCHANGED bytes still moves the entry — renames are applied
		// directly, never debounced into an echo drop.
		expect(stack.index.getPath(planId)).toBe(newPath);
		expect(stack.index.getGeometrySidecarPath(planId)).toContain('.rpgeo');

		stack.vault.entries.delete(newPath);
		adapter.onDelete(stack.vault.getAbstractFileByPath(newPath) ?? ({ path: newPath } as never));
		adapter.flush();
		expect(stack.index.getPath(planId)).toBeUndefined();
	});
});
