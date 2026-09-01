/**
 * The plan and zones the editor suites render.
 *
 * Their own module, apart from the mount harness, because a NODE test — a store, a read
 * model — needs the data and has no business loading Vue, Konva and pdf.js to get it. The
 * first version of this DID import them transitively, and it failed at load with
 * `window is not defined` from inside the PDF adapter: a message about the import graph,
 * three layers away from anything under test. That particular cause is fixed (the pdf
 * worker installs lazily now), which is exactly why the separation is worth keeping — the
 * next module-scope host reference will not announce itself.
 */
import { ok } from '../../src/core/result/Result';
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';
import type { PlanEditorQueryServices } from '../../src/presentation/read-models/planEditorQueries';

export const FIXTURE_PLAN: PlanDto = {
	id: 'plan-ground',
	projectId: 'project-1',
	name: 'Ground floor',
	background: null,
	// An UNCALIBRATED plan, which is what a fixture with no background should be — and it was
	// simply ABSENT until `tests/**` was type-checked, on a literal annotated `PlanDto` with
	// the field required. `null` rather than a calibration because the two must not disagree:
	// every area these fixtures produce is at the placeholder scale, and a fixture claiming a
	// calibration it never took would make those figures read as measured.
	calibration: null,
	layers: [],
};

export const FIXTURE_ZONES: readonly ZoneDto[] = [
	{
		id: 'zone-kitchen',
		planId: 'plan-ground',
		name: 'Kitchen',
		zoneType: 'Room',
		status: 'Planned',
		points: [
			{ x: 0, y: 0 },
			{ x: 4000, y: 0 },
			{ x: 4000, y: 3000 },
			{ x: 0, y: 3000 },
		],
	},
	{
		id: 'zone-terrace',
		planId: 'plan-ground',
		name: 'Terrace',
		zoneType: 'Terrace',
		status: 'Complete',
		points: [
			{ x: 5000, y: 0 },
			{ x: 8000, y: 0 },
			{ x: 8000, y: 2000 },
		],
	},
];

/**
 * The full query stack, so that a case wanting ONE member to behave differently overrides
 * that member rather than hand-rolling a stack.
 *
 * Hand-rolled partial stacks are this repository's fake-too-thin rule waiting to happen, and
 * it happened: design slice 17's first draft of `planEditorFailure.test.ts` declared two
 * members, one of them under a name (`listZonesForPlan`) the real interface does not have, and
 * every mount logged `context.queries.listAssets is not a function` while the assertions
 * passed. Spreading this keeps a new member reaching every caller the day it is written.
 *
 * It lives HERE rather than beside the mount harness for this module's own reason: a NODE
 * test — a store, a decorator over `CommandHistory` — needs the stack and has no business
 * loading Vue, Konva and pdf.js to get it. `tests/helpers/editor.ts` re-exports it so the
 * jsdom suites that already reach for it there are unaffected.
 */
/**
 * Slice 10's four reads, answered EMPTY rather than refused.
 *
 * Every fixture world here seeds no Requirements and no Assets, so an empty list is what the
 * real query would return for one — that is the honest stand-in, where a refusal bundle would
 * be the HARSHER-than-the-real-thing fake this repository has already paid for once (a stack
 * that refused `zoneInspector`, a READ, showed the seeded Kitchen selected on the canvas and
 * nothing in the Inspector, with no error anywhere).
 *
 * Shared with `tests/harness/planEditor.ts`, which differs from `fakeQueries` only in its
 * first two members: the harness must `structuredClone` what it hands back, because
 * `PlanEditorRoot.hydrate()` puts whatever it gets straight into Pinia's deep reactive state
 * and the next mutation would otherwise edit the fixture itself.
 */
export const emptyRequirementReads = (): Pick<
	PlanEditorQueryServices,
	'getRequirementsForZone' | 'listAssets' | 'listRequirementsReferencing' | 'listReassignmentTargets'
> => ({
	getRequirementsForZone: () => Promise.resolve(ok([])),
	listAssets: () => Promise.resolve(ok([])),
	listRequirementsReferencing: () => Promise.resolve(ok([])),
	listReassignmentTargets: () => Promise.resolve(ok([])),
});

/**
 * `unreadable` defaults to 0, which is the ordinary vault. It is a parameter rather than a
 * property of `zones` because the two are independent: a plan can have zones AND notes that
 * refused, and the canvas draws the first while saying how many of the second there were.
 */
export function fakeQueries(
	plan: PlanDto | null,
	zones: readonly ZoneDto[] = [],
	unreadable = 0,
): PlanEditorQueryServices {
	return {
		getPlan: () => Promise.resolve(ok(plan)),
		findZonesByPlan: () => Promise.resolve(ok({ zones, unreadable })),
		...emptyRequirementReads(),
	};
}
