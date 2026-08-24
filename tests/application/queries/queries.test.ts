import { describe, expect, it } from 'vitest';
import { GetPlan } from '../../../src/application/queries/GetPlan';
import { GetProject } from '../../../src/application/queries/GetProject';
import { GetZone } from '../../../src/application/queries/GetZone';
import { GetZoneInspector } from '../../../src/application/queries/GetZoneInspector';
import { err, ok } from '../../../src/core/result/Result';
import type { GeometryError } from '../../../src/core/errors/AppError';
import type { Zone } from '../../../src/domain/zone/Zone';
import type { Loaded } from '../../../src/application/ports/versioning';
import type { ZoneRepository } from '../../../src/application/ports/ZoneRepository';
import { InMemoryPlanRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPlanRepository';
import { InMemoryProjectRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryProjectRepository';
import { InMemoryZoneRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryZoneRepository';
import { expectErr, expectOk, injectedReadFailure, observationToken } from '../../helpers/domain';
import { makePlan, makeProject, makeZone, squareAt } from '../../helpers/entities';

describe('the three read queries', () => {
	it('answer ok(Loaded) for an entity seeded directly into the repository', async () => {
		const projects = new InMemoryProjectRepository();
		const project = makeProject();
		await projects.save(project, 'absent');
		const found = await new GetProject(projects).execute({ projectId: project.id });
		expect(expectOk(found)?.entity.name).toBe(project.name);

		const plans = new InMemoryPlanRepository();
		const plan = makePlan({ projectId: project.id });
		await plans.save(plan, 'absent');
		const foundPlan = await new GetPlan(plans).execute({ planId: plan.id });
		expect(expectOk(foundPlan)?.entity.id).toBe(plan.id);

		const zones = new InMemoryZoneRepository();
		const zone = makeZone({ projectId: project.id, planId: plan.id, geometry: squareAt() });
		await zones.save(zone, 'absent');
		const foundZone = await new GetZone(zones).execute({ zoneId: zone.id });
		expect(expectOk(foundZone)?.entity.id).toBe(zone.id);
	});

	it('answer ok(null) — not an error — for a missing id', async () => {
		expect(await new GetProject(new InMemoryProjectRepository()).execute({ projectId: 'project-x' as never })).toEqual({
			ok: true,
			value: null,
		});
		expect(await new GetPlan(new InMemoryPlanRepository()).execute({ planId: 'plan-x' as never })).toEqual({
			ok: true,
			value: null,
		});
		expect(await new GetZone(new InMemoryZoneRepository()).execute({ zoneId: 'zone-x' as never })).toEqual({
			ok: true,
			value: null,
		});
	});

	it('pass a failed read straight through, keeping "no entity" distinguishable', async () => {
		class FailingProjects extends InMemoryProjectRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		class FailingPlans extends InMemoryPlanRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		class FailingZones extends InMemoryZoneRepository {
			override getById() {
				return injectedReadFailure();
			}
		}
		const projectError = await new GetProject(new FailingProjects()).execute({ projectId: 'project-y' as never });
		const planError = await new GetPlan(new FailingPlans()).execute({ planId: 'plan-y' as never });
		const zoneError = await new GetZone(new FailingZones()).execute({ zoneId: 'zone-y' as never });

		expect(expectErr(projectError).code).toBe('test.injected-failure');
		expect(expectErr(planError).code).toBe('test.injected-failure');
		expect(expectErr(zoneError).code).toBe('test.injected-failure');
	});
});

describe('GetZoneInspector', () => {
	it('answers a ZoneInspectorFields DTO computed from the zone geometry', async () => {
		const project = makeProject();
		const plan = makePlan({ projectId: project.id });
		const zones = new InMemoryZoneRepository();
		const zone = makeZone({
			projectId: project.id,
			planId: plan.id,
			name: 'Kitchen',
			geometry: squareAt(0, 0),
		});
		await zones.save(zone, 'absent');

		const found = await new GetZoneInspector(zones).execute({ zoneId: zone.id });

		expect(expectOk(found)).toEqual({ id: zone.id, name: 'Kitchen', areaMm2: 100 });
	});

	it('answers ok(null) — not an error — for a missing id, like GetZone', async () => {
		const found = await new GetZoneInspector(new InMemoryZoneRepository()).execute({ zoneId: 'zone-x' as never });

		expect(found).toEqual({ ok: true, value: null });
	});

	it('passes a failed read straight through', async () => {
		class FailingZones extends InMemoryZoneRepository {
			override getById() {
				return injectedReadFailure();
			}
		}

		const found = await new GetZoneInspector(new FailingZones()).execute({ zoneId: 'zone-y' as never });

		expect(expectErr(found).code).toBe('test.injected-failure');
	});

	it('passes a GeometryError from area() straight through — the widened error union', async () => {
		// Zone.create()/withGeometry() already re-validate every geometry that reaches a
		// real Zone, so area() cannot actually fail on anything a repository could store —
		// this stub bypasses that validation to exercise the branch ambiguity-resolution
		// #1 exists for: the brief's declared `PersistenceError`-only union cannot carry
		// what GetZoneInspector can actually produce, since it calls Zone.area().
		const project = makeProject();
		const plan = makePlan({ projectId: project.id });
		const zone = makeZone({ projectId: project.id, planId: plan.id });
		const geometryFailure: GeometryError = {
			category: 'Geometry',
			code: 'test.injected-area-failure',
			message: 'Injected geometry failure.',
		};
		const corruptedZone = { ...zone, area: () => err(geometryFailure) } as unknown as Zone;
		class GeometryFailingZones implements ZoneRepository {
			getById(): ReturnType<ZoneRepository['getById']> {
				const loaded: Loaded<Zone> = {
					entity: corruptedZone,
					version: { revision: 1, observed: observationToken('v1') },
				};
				return Promise.resolve(ok(loaded));
			}
			save(): ReturnType<ZoneRepository['save']> {
				throw new Error('not used in this test');
			}
			delete(): ReturnType<ZoneRepository['delete']> {
				throw new Error('not used in this test');
			}
			listByPlan(): ReturnType<ZoneRepository['listByPlan']> {
				throw new Error('not used in this test');
			}
			listByProject(): ReturnType<ZoneRepository['listByProject']> {
				throw new Error('not used in this test');
			}
		}

		const found = await new GetZoneInspector(new GeometryFailingZones()).execute({ zoneId: zone.id });

		expect(expectErr(found)).toEqual(geometryFailure);
	});
});
