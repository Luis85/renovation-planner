/**
 * AN ID IS A FILENAME, asked of BOTH index doors.
 *
 * `assetSidecarPathFor` and `sidecarPathFor` interpolate an entity's id straight into a path,
 * so an id of `asset/custom` resolves its sidecar to a NESTED path rather than a direct child
 * of `Geometry/`. Reads and writes derive the same wrong path, so nothing looks broken until a
 * library migration, whose direct-children rule leaves the file behind — and the asset then
 * reads as shapeless, silently, an absent sidecar being a shapeless asset rather than an error.
 *
 * Its own file rather than more cases in `negatives.test.ts`, for two reasons. That file was at
 * 454 counted lines against a 450 cap with these in it, and — the better reason — the claim
 * under test is that ONE rule is enforced at TWO doors, which is a subject rather than a
 * negative. The two cases belong beside each other or each reads as an oversight.
 *
 * The doors are NOT symmetric, and that asymmetry is the whole argument for `bad-id` being its
 * own arm. Measured: adding the arm failed `npm run build` at `buildProjectIndexEntries` with
 * five errors, and said nothing at `VaultChangeAdapter`, which narrows with `ref.kind !==
 * 'ours'` and therefore excludes a new arm correctly, silently and with no diagnostic. The scan
 * is compiler-enforced; the pipeline is enforced by the case below and nothing else.
 */
import { describe, expect, it } from 'vitest';
import { createRepositoryStack } from '../../../helpers/vault';
import { expectOk } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeProject as makeProjectEntity } from '../../../helpers/entities';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createEventBus } from '../../../../src/core/events/EventBus';
import { VaultChangeAdapter } from '../../../../src/infrastructure/persistence/index/VaultChangeAdapter';
import { buildProjectIndexEntries } from '../../../../src/infrastructure/persistence/index/buildProjectIndexEntries';

function adapterOf(stack: ReturnType<typeof createRepositoryStack>): VaultChangeAdapter {
	return new VaultChangeAdapter({
		vault: stack.vault as never,
		metadataCache: stack.metadataCache as never,
		index: stack.index,
		echo: stack.echo,
		logger: stack.logger,
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

describe('an id that is not one path segment', () => {
	/**
	 * The SCAN door's `bad-id` branch, which the pipeline case above does NOT cover.
	 *
	 * Worth its own case for the reason the sibling docblock gives about the two doors being
	 * separately asserted — and worth recording how it was found: the pipeline case was
	 * written first and read as covering "both doors", while `coverage-final.json` reported
	 * this branch uncovered. The gate still PASSED, because the floors had headroom. A claim
	 * about two callers needs a case per caller, and the summary percentage cannot tell you
	 * which one you have.
	 */
	it('excludes a note whose id is not one path segment, with its own reason', async () => {
		const stack = createRepositoryStack();
		await seed(stack);

		stack.vault.entries.set(
			'Renovation/nested-id.md',
			'---\ntype: renovation-asset\nid: "asset/custom"\n---\n',
		);

		const entries = buildProjectIndexEntries({
			vault: stack.vault as never,
			metadataCache: stack.metadataCache as never,
			echo: stack.echo,
			logger: stack.logger,
		});

		expect([...entries.values()].some((e) => e.path === 'Renovation/nested-id.md')).toBe(false);
		expect(
			stack.logged.some(
				(line) =>
					line.event === 'persistence.index.note-excluded' &&
					line.context?.['path'] === 'Renovation/nested-id.md' &&
					String(line.context?.['reason']).includes('one path segment'),
			),
		).toBe(true);
	});

	/**
	 * BOTH DOORS, which is the entire argument for `bad-id` being its own arm rather than
	 * folded into `no-id`.
	 *
	 * The scan's branches are compiler-enforced — measured: adding the arm failed `npm run
	 * build` at `buildProjectIndexEntries` with five errors. This door's are NOT: it narrows
	 * with `ref.kind !== 'ours'`, so a new arm is excluded correctly, silently, with no
	 * diagnostic and no compile error. That asymmetry is why this case exists at all, and why
	 * the adapter enumerates its two excluded kinds rather than leaning on a default.
	 */
	it('a note whose id is not one path segment is excluded here too, with its own reason', async () => {
		const stack = createRepositoryStack();
		const { planId } = await seed(stack);
		const adapter = adapterOf(stack);
		const path = stack.index.getPath(planId) ?? '';

		const text = stack.vault.entries.get(path) ?? '';
		stack.vault.entries.set(path, text.replace(/id: "[^"]*"/, 'id: "plan/nested"'));
		adapter.onModify(stack.vault.getAbstractFileByPath(path) as never);
		adapter.flush();

		expect(stack.index.getPath(planId)).toBeUndefined();
		expect(
			stack.logged.some(
				(line) =>
					line.event === 'persistence.pipeline.note-excluded' &&
					line.context?.['path'] === path &&
					String(line.context?.['reason']).includes('one path segment'),
			),
		).toBe(true);
	});
});
