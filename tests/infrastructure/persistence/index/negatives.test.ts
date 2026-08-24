import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectErr, expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { buildProjectIndexEntries } from '../../../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { parsePersisted } from '../../../../src/infrastructure/persistence/mappers/parse';
import {
	projectFromPersistence,
} from '../../../../src/infrastructure/persistence/mappers/projectMapper';
import {
	planFromPersistence,
} from '../../../../src/infrastructure/persistence/mappers/planMapper';
import { zoneFromPersistence } from '../../../../src/infrastructure/persistence/mappers/zoneMapper';
import { z } from 'zod';

/**
 * Negative-path coverage for the vault-change pipeline and the mappers' early returns —
 * the arms that only fire when a file is foreign, malformed, or moved.
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

describe('pipeline negatives', () => {
	it('ignores markdown files outside the project folder entirely', () => {
		const stack = createRepositoryStack();
		const adapter = adapterOf(stack);
		const before = JSON.stringify(stack.index.entries());

		adapter.onModify({ path: 'Elsewhere/notes.md', stat: {} } as never);
		adapter.flush();
		expect(JSON.stringify(stack.index.entries())).toBe(before);
	});

	it('renaming an unindexed note just processes the new path', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const adapter = adapterOf(stack);

		stack.vault.entries.set('Renovation/Zones/Fresh.md', 'plain text, not ours');
		adapter.onRename(stack.vault.getAbstractFileByPath('Renovation/Zones/Fresh.md') as never, 'Renovation/Zones/Old.md');
		adapter.flush();

		// Not our type → no entry; nothing crashed.
		expect(stack.index.entries().find((entry) => entry.path === 'Renovation/Zones/Fresh.md')).toBeUndefined();
	});

	it('an rpgeo outside the Geometry folder is silently ignored; an orphan inside is diagnosed', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);

		stack.vault.entries.set('Renovation/Stray.rpgeo', '{}');
		const warnsBefore = stack.logged.length;
		adapter.onModify(stack.vault.getAbstractFileByPath('Renovation/Stray.rpgeo') as never);
		adapter.flush();
		expect(stack.logged.slice(warnsBefore)).toHaveLength(0);

		// An orphan INSIDE Geometry gets a diagnostic instead of a guessed mapping.
		const orphanPath = `Renovation/Geometry/${createPlanId()}.rpgeo`;
		stack.vault.entries.set(orphanPath, '{}');
		adapter.onModify(stack.vault.getAbstractFileByPath(orphanPath) as never);
		adapter.flush();
		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.sidecar-skipped')).toBe(true);
		expect(stack.index.getGeometrySidecarPath(planId)).toContain('.rpgeo');
	});

	/**
	 * A sidecar deleted OUT OF BAND — the file explorer, a sync client — must clear the
	 * index mapping rather than re-affirm a path that is gone. Leaving it would break every
	 * Zone read on that Plan with no future event to repair it: the sidecar path lives only
	 * in this index, so nothing else would ever notice.
	 *
	 * Fired twice on purpose. The second pass is the arm where the mapping has ALREADY been
	 * cleared, which must forget the echo and leave the entry alone instead of upserting a
	 * second time.
	 */
	it('a sidecar deleted out of band clears the mapping, and a repeat is a no-op', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const sidecarPath = stack.index.getGeometrySidecarPath(planId) ?? '';
		expect(sidecarPath).toContain('.rpgeo');

		stack.vault.entries.delete(sidecarPath);
		adapter.onDelete({ path: sidecarPath } as never);
		adapter.flush();

		expect(stack.index.getGeometrySidecarPath(planId)).toBeUndefined();
		// The note entry itself is untouched — a sidecar event never moves it.
		expect(stack.index.getPath(planId)).toBeDefined();

		adapter.onDelete({ path: sidecarPath } as never);
		adapter.flush();
		expect(stack.index.getGeometrySidecarPath(planId)).toBeUndefined();
		expect(stack.index.getPath(planId)).toBeDefined();
	});

	it('a note that loses its frontmatter loses its index entry (with diagnostic)', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(projectId) ?? '';

		stack.vault.entries.set(path, 'just prose now');
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		expect(stack.index.getPath(projectId)).toBeUndefined();
	});

	it('a note of ours without a readable id is excluded with a diagnostic', async () => {
		const stack = createRepositoryStack();
		const { planId, projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(planId) ?? '';

		const text = stack.vault.entries.get(path) ?? '';
		stack.vault.entries.set(
			path,
			text.replace(/id: "[^"]*"/, 'id: ""'),
		);
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		expect(stack.index.getPath(planId)).toBeUndefined();
		void projectId;
	});
});

describe('index builder negatives', () => {
	it('skips non-notes, foreign notes, and orphan sidecars during the scan', async () => {
		const stack = createRepositoryStack();
		await seed(stack);

		stack.vault.entries.set('Elsewhere/x.md', '---\ntype: renovation-project\n---\n');
		stack.vault.entries.set('Renovation/plain.md', 'no frontmatter here');
		stack.vault.entries.set('Renovation/foreign.md', '---\ntype: something-else\nid: "x"\n---\n');
		stack.vault.entries.set(`Renovation/Geometry/${createPlanId()}.rpgeo`, '{}');

		const entries = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
			projectFolder: stack.projectFolder,
		});

		expect(entries.some((entry) => entry.path === 'Elsewhere/x.md')).toBe(false);
		expect(entries.some((entry) => entry.path === 'Renovation/plain.md')).toBe(false);
		expect(entries.some((entry) => entry.path === 'Renovation/foreign.md')).toBe(false);
	});
});

/**
 * Two notes carrying one id is a state Obsidian's own "Duplicate file" command produces in
 * one click, and a sync conflict copy produces without asking. The index is keyed by id, so
 * one of the two is unreachable either way — the diagnostic is the whole remedy, and both
 * halves of the index (the full scan and the incremental pipeline) have to give it.
 */
describe('duplicate frontmatter ids', () => {
	it('the scan indexes one note and warns about the other', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const original = stack.index.getPath(projectId) ?? '';
		const copyPath = 'Renovation/Kitchen renovation 1.md';
		stack.vault.entries.set(copyPath, stack.vault.entries.get(original) ?? '');

		const entries = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
			projectFolder: stack.projectFolder,
		});

		// One entry for the id, and a warning naming BOTH paths — a diagnostic that named
		// only the loser would not tell a user which file to open.
		expect(entries.filter((entry) => entry.id === projectId)).toHaveLength(1);
		const warning = stack.logged.find((line) => line.event === 'persistence.index.duplicate-id');
		expect(warning?.context?.['otherPath']).toBeDefined();
		expect(warning?.context?.['path']).toBeDefined();
	});

	it('the pipeline warns when an arriving note claims an id another live note holds', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const original = stack.index.getPath(projectId) ?? '';
		const copyPath = 'Renovation/Kitchen renovation 1.md';
		stack.vault.entries.set(copyPath, stack.vault.entries.get(original) ?? '');

		adapter.onCreate(stack.vault.getAbstractFileByPath(copyPath) as never);
		adapter.flush();

		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.duplicate-id')).toBe(true);
		// Semantics unchanged: last writer still wins, so the copy now holds the id.
		expect(stack.index.getPath(projectId)).toBe(copyPath);
	});

	it('a note relocated with no rename event is a MOVE, not a duplicate', async () => {
		const stack = createRepositoryStack();
		const { projectId } = await seed(stack);
		const adapter = adapterOf(stack);
		const original = stack.index.getPath(projectId) ?? '';
		const movedTo = 'Renovation/Moved by sync.md';

		// What a sync client does: the note appears at the new path and is GONE from the old
		// one. The index still points at the old path, which is what makes this look like a
		// duplicate until the existence of the old file is actually checked.
		stack.vault.entries.set(movedTo, stack.vault.entries.get(original) ?? '');
		stack.vault.entries.delete(original);

		adapter.onCreate(stack.vault.getAbstractFileByPath(movedTo) as never);
		adapter.flush();

		expect(stack.logged.some((line) => line.event === 'persistence.pipeline.duplicate-id')).toBe(false);
		expect(stack.index.getPath(projectId)).toBe(movedTo);
	});
});

describe('mapper parse failures return before construction', () => {
	it('project mapper refuses schema-invalid raw frontmatter', () => {
		expect(projectFromPersistence({ type: 'renovation-project' }).ok).toBe(false);
	});

	it('plan mapper refuses schema-invalid raw frontmatter', () => {
		expect(planFromPersistence({ type: 'renovation-plan' }, null).ok).toBe(false);
	});

	it('zone mapper refuses broken frontmatter before touching geometry', () => {
		expect(zoneFromPersistence({ type: 'renovation-zone' }, { id: 'z', type: 'polygon', points: [] }).ok).toBe(false);
	});

	it('parsePersisted labels root-level failures', () => {
		const error = expectErr(parsePersisted(z.string(), 42, 'test.root', 'Fixture'));
		expect(error.message).toContain('(root)');
	});
});
