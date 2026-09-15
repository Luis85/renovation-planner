import type { PlanGeometrySidecar } from '../../src/application/ports/PlanGeometrySidecar';
import type { PlanId } from '../../src/domain/plan/PlanId';
import { expectOk } from '../helpers/domain';

/** Explicit synthetic opening fixtures, persisted through the real sidecar before mounting the editor. */
export async function seedOpeningDirectWorkspace(geometry: PlanGeometrySidecar, planId: PlanId): Promise<void> {
	const before = expectOk(await geometry.read(planId));
	expectOk(await geometry.write(planId, { ...before.document, structure: {
		walls: [
			{ id: 'wall-r01-straight', start: { x: 0, y: 0 }, end: { x: 5000, y: 0 }, thickness: 240, sideExtents: { a: 160, b: 80 }, height: 2700 },
			{ id: 'wall-r01-curved', start: { x: 0, y: 3500 }, end: { x: 5000, y: 3500 }, bulge: 0.2, thickness: 240, sideExtents: { a: 160, b: 80 }, height: 2700 },
		],
		openings: [
			{ id: 'opening-r01-door', hostId: 'wall-r01-straight', kind: 'door', width: 900.4, offset: 1200.2, height: 2100, sill: 0 },
			{ id: 'opening-r01-window', hostId: 'wall-r01-curved', kind: 'window', width: 1200, offset: 1800, height: 1200, sill: 900 },
		], boundaries: [],
	} }, before.version));
}
