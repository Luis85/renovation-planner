import { describe, expect, it } from 'vitest';
import { stringify } from 'yaml';
import { planMaterialUsers } from '../../../../src/infrastructure/obsidian/repositories/planningReferentialGuard';
import { createRepositoryStack } from '../../../helpers/vault';
import { makePlan, makeProject } from '../../../helpers/entities';
import { expectOk } from '../../../helpers/domain';
import { createAssetId } from '../../../../src/domain/asset/AssetId';

/**
 * `planMaterialUsers` reads real plan notes through the real frontmatter reader — the
 * command test (`deleteAssetRefusals.test.ts`) only injects a fake answering `['Ground
 * floor']`, which proves nothing about the scan this function actually runs (CLAUDE.md's
 * fake-must-not-be-thinner rule). This drives it against a fixture vault carrying one plan
 * naming the asset in `existing`, one in `planned`, one naming a different asset, and one
 * whose `renovation` frontmatter `RenovationSchema` rejects.
 */
async function planWithFrontmatter(stack: ReturnType<typeof createRepositoryStack>, projectId: Parameters<typeof makePlan>[0]['projectId'], name: string, renovation: unknown) {
	const plan = expectOk(await stack.plans.save(makePlan({ projectId, name }), 'absent'));
	const path = stack.index.getPath(plan.entity.id);
	if (path === undefined) throw new Error('plan not indexed');
	stack.vault.entries.set(path, `---\n${stringify({ name, renovation })}---\n`);
	return plan.entity.id;
}

function subject(overrides: { existing?: { assetId: string }; planned?: { assetId: string } }) {
	return {
		id: 'detail-1',
		targetId: 'wall-a',
		kind: 'wall',
		existing: overrides.existing
			? { description: 'Original wall', condition: 'good', assetId: overrides.existing.assetId }
			: null,
		planned: overrides.planned
			? { change: 'modify', description: 'New wall', assetId: overrides.planned.assetId }
			: null,
	};
}

describe('planMaterialUsers', () => {
	it('names only the readable plans whose subjects name the asset, in either fact, skipping an unreadable one', async () => {
		const stack = createRepositoryStack();
		const project = expectOk(await stack.projects.save(makeProject(), 'absent'));
		const assetId = createAssetId();
		const otherAssetId = createAssetId();

		await planWithFrontmatter(stack, project.entity.id, 'Existing user', {
			subjects: [subject({ existing: { assetId } })],
			work: [],
			decisions: [],
		});
		await planWithFrontmatter(stack, project.entity.id, 'Planned user', {
			subjects: [subject({ planned: { assetId } })],
			work: [],
			decisions: [],
		});
		await planWithFrontmatter(stack, project.entity.id, 'Unrelated plan', {
			subjects: [subject({ existing: { assetId: otherAssetId } })],
			work: [],
			decisions: [],
		});
		// An unreadable note: `renovation` fails `RenovationSchema.safeParse` (subjects is not
		// an array), and is skipped rather than refused — unlike `guardMaterialRemoval`, which
		// has an in-flight edit to refuse and this scan does not.
		await planWithFrontmatter(stack, project.entity.id, 'Broken plan', { subjects: 'not-an-array' });

		const result = await planMaterialUsers({ vault: stack.deps.vault, index: stack.index }, assetId);
		expect(expectOk(result)).toEqual(['Existing user', 'Planned user']);
	});

	it('answers no names when nothing in the vault mentions the asset', async () => {
		const stack = createRepositoryStack();
		const project = expectOk(await stack.projects.save(makeProject(), 'absent'));
		await planWithFrontmatter(stack, project.entity.id, 'Ground floor', { subjects: [], work: [], decisions: [] });

		const result = await planMaterialUsers({ vault: stack.deps.vault, index: stack.index }, createAssetId());
		expect(expectOk(result)).toEqual([]);
	});
});
