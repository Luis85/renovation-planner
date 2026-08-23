import { createPolygon, type Polygon } from '../../src/core/geometry/Polygon';
import { expectOk } from './domain';
import { Project, type CreateProjectProps } from '../../src/domain/project/Project';
import { createProjectId, type ProjectId } from '../../src/domain/project/ProjectId';
import { Plan, type CreatePlanProps } from '../../src/domain/plan/Plan';
import { createPlanId, type PlanId } from '../../src/domain/plan/PlanId';
import { Zone, type CreateZoneProps } from '../../src/domain/zone/Zone';
import { createZoneId, type ZoneId } from '../../src/domain/zone/ZoneId';

/**
 * Entity fixtures for the command and contract tests. Each call mints fresh IDs, so
 * contract suites can seed several entities without colliding.
 */

export function squareAt(x = 0, y = 0): Polygon {
	return expectOk(
		createPolygon([
			{ x, y },
			{ x: x + 10, y },
			{ x: x + 10, y: y + 10 },
			{ x, y: y + 10 },
		]),
	);
}

export function makeProject(props?: Partial<CreateProjectProps> & { id?: ProjectId }): Project {
	const { id, ...rest } = props ?? {};
	return expectOk(Project.create({ id: id ?? createProjectId(), name: 'Kitchen renovation', ...rest }));
}

export function makePlan(
	props: Partial<CreatePlanProps> & { projectId: ProjectId; id?: PlanId },
): Plan {
	const { id, ...rest } = props;
	return expectOk(
		Plan.create({ id: id ?? createPlanId(), name: 'Ground floor', ...rest }),
	);
}

export function makeZone(
	props: Partial<CreateZoneProps> & { projectId: ProjectId; planId: PlanId; id?: ZoneId },
): Zone {
	const { id, ...rest } = props;
	return expectOk(
		Zone.create({ id: id ?? createZoneId(), name: 'Living room', zoneType: 'Room', geometry: squareAt(), ...rest }),
	);
}
