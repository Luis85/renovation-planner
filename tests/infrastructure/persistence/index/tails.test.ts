import { describe, expect, it } from 'vitest';
import { createRepositoryStack, parseFrontmatter } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { observeFrontmatter } from '../../../../src/infrastructure/obsidian/repositories/digest';

/**
 * The last branch arms: pipeline upserts of plan notes (with and without a prior
 * mapping), and the digest's multi-byte UTF-8 encoding arms.
 */
function adapterOf(stack: ReturnType<typeof createRepositoryStack>): VaultChangeAdapter {
	return new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
		// A real bus with no subscribers: the pipeline announces every entry it changes, and
		// a fake that accepted no publish would be thinner than the port it stands for.
		events: createEventBus(() => undefined),
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

describe('pipeline plan-note upserts', () => {
	it('a foreign owned-key edit of a plan note updates the entry and keeps the sidecar mapping', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(planId) ?? '';

		// An owned key changes out of band → the echo no longer matches → the index updates.
		const text = stack.vault.entries.get(path) ?? '';
		stack.vault.entries.set(path, text.replace('"Ground floor"', '"Ground floor (edited)"'));
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		const entry = stack.index.entries().find((candidate) => candidate.id === planId);
		expect(entry?.path).toBe(path);
		// The mapping survived the note edit — an out-of-band note change cannot move it.
		expect(entry?.geometrySidecarPath).toContain('.rpgeo');
	});

	it('a brand-new plan note arriving through events gets an entry without a sidecar claim', async () => {
		const stack = createRepositoryStack();
		await seed(stack);
		const adapter = adapterOf(stack);

		const newId = `plan-${createPlanId()}`;
		const newPath = `Renovation/Plans/${newId}.md`;
		stack.vault.entries.set(
			newPath,
			'---\ntype: "renovation-plan"\n"schema-version": 1\n"id": "' + newId + '"\nrevision: 1\nproject: "p"\nname: "New"\n"background-path": ""\n"background-kind": "image"\n"background-page": null\nlayers: []\n---\n',
		);
		adapter.onModify(stack.vault.getAbstractFileByPath(newPath) as never);
		adapter.flush();

		const entry = stack.index.entries().find((candidate) => candidate.id === newId);
		expect(entry?.type).toBe('renovation-plan');
		expect(entry?.geometrySidecarPath).toBeUndefined();
	});
});

describe('observation token encodings', () => {
	it('encodes one-, two-, and three-byte UTF-8 characters', () => {
		const ascii = observeFrontmatter({ name: 'A' });
		const twoByte = observeFrontmatter({ name: 'Bü' });
		const threeByte = observeFrontmatter({ name: '客' });
		expect(ascii).not.toBe(twoByte);
		expect(twoByte).not.toBe(threeByte);
		expect(observeFrontmatter({ name: '客' })).toBe(threeByte);
	});
});

describe('zone delete without a plan declaration', () => {
	it('refuses instead of guessing where the geometry lives', async () => {
		const stack = createRepositoryStack();
		const { projectId, planId } = await seed(stack);
		void projectId;
		void planId;

		const zoneId = 'zone-handmade';
		const path = `${stack.projectFolder}/Zones/${zoneId}.md`;
		stack.vault.entries.set(
			path,
			'---\ntype: "renovation-zone"\n"schema-version": 1\n"id": "zone-handmade"\nrevision: 1\nname: "H"\n---\n',
		);
		stack.index.upsert({ id: zoneId as never, type: 'renovation-zone', path });

		const fm = parseFrontmatter(stack.vault.entries.get(path) ?? '').frontmatter;
		const version = {
			revision: typeof fm['revision'] === 'number' ? fm['revision'] : 0,
			observed: observeFrontmatter(fm),
		};
		const result = await stack.zones.delete(zoneId as never, version);
		expect(result.ok).toBe(false);
	});
});
