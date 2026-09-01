import { afterEach, describe, expect, it } from 'vitest';
import {
	corruptSchemaVersion,
	corruptSidecar,
	invalidateFrontmatter,
	malformSchemaVersion,
	openFixtureVault,
	type FixtureStack,
} from '../../../helpers/fixtureVault';
import type { PlanId } from '../../../../src/domain/plan/PlanId';
import type { ProjectId } from '../../../../src/domain/project/ProjectId';

/**
 * The fixture's own ids, branded rather than minted — `createPlanId()` takes no argument and
 * would generate a fresh id that names nothing in this vault, so the listing would answer an
 * empty set and every case here would pass for the wrong reason. The fixture is the authority
 * on its own ids; `buildProjectIndexEntries` asserts raw frontmatter into `EntityId` the same
 * way after checking only that it is non-empty.
 */
const PLAN = 'plan-ground' as PlanId;
const PROJECT = 'proj-unreadable' as ProjectId;
const CASUALTY = 'Zones/Pantry.md';
const SIDECAR = 'Geometry/plan-ground.rpgeo';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

const openStack = async (): Promise<FixtureStack> => {
	const stack = await openFixtureVault('unreadable-zone');
	open = stack;
	// The scan the plugin runs at load. Every id the listing walks comes from the index, so a
	// stack without it lists nothing and answers `refused: 0` — a green case about an empty
	// vault, indistinguishable from a green case about a listing that skips.
	stack.rebuildIndex();
	return stack;
};

describe('the zone listing skips a note it cannot read', () => {
	it('answers the readable zones and counts the refusal', async () => {
		const stack = await openStack();
		await corruptSchemaVersion(stack, CASUALTY);

		const listed = await stack.zones.listByPlan(PLAN);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.loaded[0]?.entity.name).toBe('Kitchen');
		expect(listed.value.refused).toBe(1);
	});

	it('records the refusal in the diagnostics ledger, so skipping loses nothing', async () => {
		const stack = await openStack();
		await corruptSchemaVersion(stack, CASUALTY);

		await stack.zones.listByPlan(PLAN);

		expect(stack.ledger.issues()).toHaveLength(1);
		expect(stack.ledger.issues()[0]?.entityId).toBe('pantry');
	});

	it('skips AND records a note that passes migration and fails the mapper', async () => {
		// A corrupt `schema-version` is the ONE refusal that already reached the ledger, through
		// `openNoteById`. Driving only that input passes while every later refusal in `loadOne`
		// records nothing — which is exactly what this spec's own first draft did. This case
		// drives a CURRENT-schema note whose frontmatter fails the mapper, so it exercises the
		// recording the listing itself adds.
		const stack = await openStack();
		await invalidateFrontmatter(stack, CASUALTY, 'zone-type');

		const listed = await stack.zones.listByPlan(PLAN);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
		expect(stack.ledger.issues()).toEqual([
			{ entityType: 'zone', entityId: 'pantry', issue: 'zone.frontmatter-invalid' },
		]);
	});

	it('skips a `schema-version` that is not a number', async () => {
		// `Validation`, not `Migration`, and reachable by typing `v2` into a note. Enumerated in
		// the skippable set rather than inherited from a category, and driven here because the
		// arm is otherwise indistinguishable from the fail-fast behaviour this task removed:
		// without the code in that set, this case is the one that stays red.
		const stack = await openStack();
		await malformSchemaVersion(stack, CASUALTY);

		const listed = await stack.zones.listByPlan(PLAN);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
		expect(stack.ledger.issues()).toEqual([
			{ entityType: 'zone', entityId: 'pantry', issue: 'zone.schema-version-malformed' },
		]);
	});

	it('does NOT skip an unreadable sidecar — one shared failure is not N note failures', async () => {
		// `loadOne` answers `zone.sidecar-unreadable` for EVERY zone when the plan's geometry
		// sidecar cannot be read, and `list` memoises that read across the loop. Skipping it
		// would answer `loaded: [], refused: 2` and draw an empty canvas under a notice blaming
		// two notes for one file — this increment's own claim, inverted.
		const stack = await openStack();
		await corruptSidecar(stack, SIDECAR);

		const listed = await stack.zones.listByPlan(PLAN);

		expect(listed.ok).toBe(false);
		if (listed.ok) return;
		expect(listed.error.code).toBe('zone.sidecar-unreadable');
	});

	it('counts a refusal reached through listByProject too', async () => {
		const stack = await openStack();
		await corruptSchemaVersion(stack, CASUALTY);

		const listed = await stack.zones.listByProject(PROJECT);

		expect(listed.ok).toBe(true);
		if (!listed.ok) return;
		expect(listed.value.loaded).toHaveLength(1);
		expect(listed.value.refused).toBe(1);
	});
});
