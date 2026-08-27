/**
 * The empty-state selectors: the full input/output table from the slice's Design §3.
 *
 * Node, not jsdom, and that is the return on keeping them pure — a rule about which empty
 * state applies is asked of a function, never of a screen.
 */
import { describe, expect, it } from 'vitest';
import {
	selectPlanEditorEmptyState,
	selectRenovationProjectEmptyState,
} from '../../../src/presentation/emptyStates/selectors';
import type { PlanDto, ProjectSummaryDto, ZoneDto } from '../../../src/presentation/read-models/PlanDto';

const PLAN: PlanDto = {
	id: 'plan-1',
	projectId: 'project-1',
	name: 'Ground floor',
	background: null,
	calibration: null,
	layers: [],
};

const ZONE: ZoneDto = {
	id: 'zone-1',
	planId: 'plan-1',
	name: 'Kitchen',
	zoneType: 'Room',
	status: 'Planned',
	points: [
		{ x: 0, y: 0 },
		{ x: 1000, y: 0 },
		{ x: 1000, y: 1000 },
	],
};

const withBackground = (): PlanDto => ({
	...PLAN,
	background: { path: 'Plans/ground.png', kind: 'image' },
});

describe('selectPlanEditorEmptyState', () => {
	it('asks for a background first, even though such a plan also has no zones', () => {
		expect(selectPlanEditorEmptyState(PLAN, [])).toBe('noBackground');
	});

	/**
	 * The precedence is a FIXED order over PRD §93's onboarding sequence, not a re-derived
	 * "which is more missing" — and this case is the one that proves the order does not rest
	 * on the premise two comments used to state, that a background-less plan has no zones.
	 * It does have zones here, and it does in `create-sample-project` and in the browser
	 * harness, which are the two scenes this project ships. This is the arm a user meets
	 * first, and the arm a "simplification" of the selector would break.
	 */
	it('still asks for a background when the plan already has zones', () => {
		expect(selectPlanEditorEmptyState(PLAN, [ZONE])).toBe('noBackground');
	});

	it('asks for a zone once the background is set', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [])).toBe('noZones');
	});

	it('asks for nothing when the plan has both', () => {
		expect(selectPlanEditorEmptyState(withBackground(), [ZONE])).toBeNull();
	});

	/**
	 * `null` is a BROKEN REFERENCE — the leaf's persisted plan id no longer resolves — not
	 * "no plan yet". Rendering `noBackground` here would tell a user they never imported a
	 * plan when they may have imported one that then vanished. Slice 17 owns what this
	 * renders as; this function's job is to return no key for it.
	 */
	it('returns no key for a plan that does not resolve at all', () => {
		expect(selectPlanEditorEmptyState(null, [])).toBeNull();
	});
});

describe('selectRenovationProjectEmptyState', () => {
	it('asks for a project when the vault has none', () => {
		expect(selectRenovationProjectEmptyState([], 0)).toBe('noProjects');
	});

	it('asks for nothing once there is one', () => {
		const project: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };

		expect(selectRenovationProjectEmptyState([project], 0)).toBeNull();
	});

	/**
	 * The arm that makes this a two-argument function. An empty list with a refusal behind it
	 * is NOT "no projects yet": the vault may hold five this build cannot parse, and
	 * onboarding copy inviting the user to create their first one would be wrong AND
	 * unactionable. The view renders the refusal notice for this case.
	 */
	it('asks for nothing when the list is empty only because notes refused', () => {
		expect(selectRenovationProjectEmptyState([], 3)).toBeNull();
	});

	/**
	 * A partial read still shows what loaded. The notice is additive, not a replacement —
	 * suppressing the whole surface because one note refused would hide four readable
	 * projects to report the fifth.
	 */
	it('asks for nothing when some projects loaded and others refused', () => {
		const project: ProjectSummaryDto = { id: 'project-1', name: 'Kitchen refit', status: 'Planning' };

		expect(selectRenovationProjectEmptyState([project], 1)).toBeNull();
	});
});
