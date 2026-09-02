import { afterEach, describe, expect, it } from 'vitest';
import {
	corruptSchemaVersion,
	corruptSidecar,
	displaceNoteId,
	invalidateFrontmatter,
	malformSchemaVersion,
	openFixtureVault,
	type FixtureStack,
} from '../../../helpers/fixtureVault';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

/** The fixture's own ids, branded rather than minted — see `zoneListingSkips.test.ts`. */
const PROJECT = 'proj-plans' as ProjectId;
const CASUALTY = 'Plans/First.md';
const CASUALTY_SIDECAR = 'Geometry/plan-first.rpgeo';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

const openStack = async (): Promise<FixtureStack> => {
	const stack = await openFixtureVault('unreadable-plan');
	open = stack;
	stack.rebuildIndex();
	return stack;
};

describe('the plan listing skips a note it cannot read', () => {
	it('answers the readable plans and counts the refusal', async () => {
		const stack = await openStack();
		await corruptSchemaVersion(stack, CASUALTY);

		const listed = await stack.plans.listByProject(PROJECT);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.loaded[0]?.entity.name).toBe('Ground');
		expect(listed.value.refused).toBe(1);
	});

	it('skips AND records a note that passes migration and fails the mapper', async () => {
		// The recording arm. A corrupt `schema-version` is the one refusal `openNoteById`
		// already reaches the ledger with, so a suite driving only that input would pass while
		// this repository — which records nothing of its own today — went on recording nothing.
		const stack = await openStack();
		await invalidateFrontmatter(stack, CASUALTY, 'background-kind');

		const listed = await stack.plans.listByProject(PROJECT);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
		expect(stack.ledger.issues()).toEqual([
			{ entityType: 'plan', entityId: 'plan-first', issue: 'plan.frontmatter-invalid' },
		]);
	});

	it('skips a `schema-version` that is not a number', async () => {
		const stack = await openStack();
		await malformSchemaVersion(stack, CASUALTY);

		const listed = await stack.plans.listByProject(PROJECT);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
		expect(stack.ledger.issues()).toEqual([
			{ entityType: 'plan', entityId: 'plan-first', issue: 'plan.schema-version-malformed' },
		]);
	});

	it('skips a plan whose note declares a different id', async () => {
		// The arm that arrived across a merge. `note-id-mismatch` is raised by a guard written on
		// a branch that predates this set, so it merged in textually clean and NOT enumerated —
		// one displaced plan note failing the whole listing again, which is the defect this file
		// exists to hold closed. Reachable with one keystroke: `id` is frontmatter, and the index
		// keeps the old entry until the next full rebuild.
		const stack = await openStack();
		await displaceNoteId(stack, CASUALTY, 'plan-somebody-else');

		const listed = await stack.plans.listByProject(PROJECT);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.loaded[0]?.entity.name).toBe('Ground');
		expect(listed.value.refused).toBe(1);
		expect(stack.ledger.issues()).toEqual([
			{ entityType: 'plan', entityId: 'plan-first', issue: 'plan.note-id-mismatch' },
		]);
	});

	it('skips a plan whose OWN sidecar is unreadable, which the zone listing must not', async () => {
		// The asymmetry, asserted rather than left to the README. A plan's sidecar is keyed by
		// its own id, so its failure is about that one plan; a zone's sidecar belongs to its
		// PLAN and is shared by every zone on it, which is why `zoneListingSkips.test.ts` has
		// the opposite case for the same-shaped code.
		const stack = await openStack();
		await corruptSidecar(stack, CASUALTY_SIDECAR);

		const listed = await stack.plans.listByProject(PROJECT);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
	});
});
