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
import type { PlanDto, ZoneDto } from '../../src/presentation/read-models/PlanDto';

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
