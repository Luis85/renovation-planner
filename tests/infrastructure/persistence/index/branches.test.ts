import { describe, expect, it, vi } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { KeyedQueues } from '../../../../src/infrastructure/obsidian/repositories/KeyedQueues';
import { EchoWindow } from '../../../../src/infrastructure/persistence/index/EchoWindow';
import type { ObservationToken } from '../../../../src/application/ports/versioning';

/**
 * The remaining pipeline and queue branches: debounced flushes (with a stubbed window,
 * because the app runs inside one), sidecar events through the adapter, and a queue
 * whose tasks may reject without poisoning their successors.
 */

function adapterOf(stack: ReturnType<typeof createRepositoryStack>, debounceMs?: number): VaultChangeAdapter {
	return new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
		debounceMs,
	});
}

	async function seed(stack: ReturnType<typeof createRepositoryStack>) {
		const projectId = createProjectId();
		const planId = createPlanId();
		expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
		expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
		return { projectId, planId };
	}

function zoneNote(id: string, project: string, plan: string): string {
	return [
		'---',
		'type: "renovation-zone"',
		'"schema-version": 1',
		`"id": "${id}"`,
		'revision: 1',
		`project: "${project}"`,
		`plan: "${plan}"`,
		'name: "D"',
		'"zone-type": "room"',
		'status: "planned"',
		'---',
		'',
	].join('\n');
}

describe('debounced flush', () => {
	it('holds events for the debounce window, then processes them', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		try {
			const stack = createRepositoryStack();
			const projectId = createProjectId();
			const planId = createPlanId();
			expectOk(await stack.projects.save(makeProjectEntity({ id: projectId }), 'absent'));
			expectOk(await stack.plans.save(makePlanEntity({ id: planId, projectId }), 'absent'));
			const adapter = adapterOf(stack, 5);

			const zoneId = 'zone-debounced';
			stack.vault.entries.set('Renovation/Zones/D.md', zoneNote(zoneId, String(projectId), String(planId)));
			adapter.onCreate(stack.vault.getAbstractFileByPath('Renovation/Zones/D.md') as never);

			expect(stack.index.getPath(zoneId as never)).toBeUndefined();

			await new Promise<void>((resolve) => {
				setTimeout(() => resolve(), 20);
			});
			expect(stack.index.getPath(zoneId as never)).toBeDefined();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('sidecar events through the pipeline', () => {
	it('an orphan sidecar is skipped with a diagnostic; a known one keeps its mapping', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		try {
			const stack = createRepositoryStack();
			const { planId } = await seed(stack);
			const adapter = adapterOf(stack);

			const orphanPath = `Renovation/Geometry/${createPlanId()}.rpgeo`;
			stack.vault.entries.set(orphanPath, '{}');
			adapter.onModify(stack.vault.getAbstractFileByPath(orphanPath) as never);

			const mappingBefore = stack.index.getGeometrySidecarPath(planId);
			expect(mappingBefore).toContain('.rpgeo');

			stack.logged.length = 0;
			adapter.onModify(stack.vault.getAbstractFileByPath(mappingBefore) as never);
			adapter.flush();
			expect(stack.index.getGeometrySidecarPath(planId)).toBe(mappingBefore);
			expect(stack.logged.some((line) => line.event === 'persistence.pipeline.sidecar-skipped')).toBe(true);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('a note that stops being ours', () => {
	it('loses its index entry when its type changes', async () => {
		vi.stubGlobal('window', { setTimeout, clearTimeout });
		try {
			const stack = createRepositoryStack();
			const { projectId } = await seed(stack);
			const adapter = adapterOf(stack);
			const path = stack.index.getPath(projectId) ?? '';

			stack.vault.entries.set(
				path,
				(stack.vault.entries.get(path) ?? '').replace('"renovation-project"', '"something-else"'),
			);
			adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);

			await new Promise<void>((resolve) => {
				setTimeout(() => resolve(), 10);
			});
			expect(stack.index.getPath(projectId)).toBeUndefined();
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('queue mechanics', () => {
	it('a rejecting task does not poison later tasks for the same key', async () => {
		const queues = new KeyedQueues();
		const boom = queues.run('k', () => Promise.reject(new Error('boom')));
		await expect(boom).rejects.toThrow('boom');
		await expect(queues.run('k', () => Promise.resolve('next'))).resolves.toBe('next');
	});
});

describe('echo window', () => {
	it('move carries the token to the new path and forgets the old one', () => {
		const echo = new EchoWindow();
		echo.mark('/old', 'token-a' as ObservationToken);
		echo.move('/old', '/new');
		expect(echo.matches('/new', 'token-a' as ObservationToken)).toBe(true);
		expect(echo.matches('/old', 'token-a' as ObservationToken)).toBe(false);

		// A move of something never marked is a no-op.
		echo.move('/missing', '/elsewhere');
		expect(echo.matches('/elsewhere', 'token-a' as ObservationToken)).toBe(false);
	});
});
