import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { expectErr } from '../../../helpers/domain';
import { makePlan as makePlanEntity, makeZone as makeZoneEntity, squareAt } from '../../../helpers/entities';
import { createPlanId } from '../../../../src/domain/plan/PlanId';
import { createProjectId } from '../../../../src/domain/project/ProjectId';
import {
	planFromPersistence,
	planToPersistence,
} from '../../../../src/infrastructure/persistence/mappers/planMapper';
import { projectFromPersistence } from '../../../../src/infrastructure/persistence/mappers/projectMapper';
import {
	zoneFromPersistence,
	zoneToGeometryEntry,
	zoneToPersistence,
} from '../../../../src/infrastructure/persistence/mappers/zoneMapper';
import { parsePersisted } from '../../../../src/infrastructure/persistence/mappers/parse';

function expectOkOf<T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T {
	if (!result.ok) throw new Error(`expected ok: ${JSON.stringify(result.error)}`);
	return result.value;
}

/**
 * Mapper branches beyond the happy round-trips the repositories exercise: every refusal
 * path (invalid storage shape, domain-refused data) and both background/calibration
 * merge directions.
 */
describe('mappers: refusals and merges', () => {
	it('parsePersisted joins issue paths into one validation error', () => {
		const schema = z.object({ a: z.number(), b: z.object({ c: z.string() }) });
		const result = parsePersisted(schema, { a: 'x', b: { c: 5 } }, 'test.invalid', 'Fixture');
		const error = expectErr(result);
		expect(error.code).toBe('test.invalid');
		expect(error.message).toContain('a:');
		expect(error.message).toContain('b.c:');
	});

	it('projectFromPersistence refuses a domain-invalid row (empty name survives schema)', () => {
		const raw = { type: 'renovation-project', 'schema-version': 1, id: 'project-x', revision: 1, name: '   ', status: 'idea' };
		const result = projectFromPersistence(raw);
		expect(result.ok).toBe(false);
	});

	it('planFromPersistence defaults a pdf page to 1 and drops pages from images', () => {
		const projectId = createProjectId();
		const base = {
			type: 'renovation-plan',
			'schema-version': 1,
			id: 'plan-x',
			project: String(projectId),
			name: 'Ground Floor',
			layers: [],
		};

		// `null` is the second argument `planFromPersistence` has always required — the sidecar's
		// calibration, merged in by the repository. Omitted, it arrived as `undefined`, and these
		// two fixtures are about the BACKGROUND: an uncalibrated plan is what they mean.
		const pdf = expectOkOf(
			planFromPersistence({ ...base, 'background-path': 'a.pdf', 'background-kind': 'pdf', 'background-page': null }, null),
		);
		expect(pdf.background?.page).toBe(1);

		const image = expectOkOf(
			planFromPersistence({ ...base, 'background-path': 'a.png', 'background-kind': 'image', 'background-page': null }, null),
		);
		expect(image.background?.page).toBeUndefined();
	});

	it('planFromPersistence merges sidecar calibration into the entity', () => {
		const projectId = createProjectId();
		const plan = expectOkOf(
			planFromPersistence(
				{
					type: 'renovation-plan',
					'schema-version': 1,
					id: 'plan-x',
					project: String(projectId),
					name: 'Ground Floor',
					'background-path': '',
					'background-kind': 'image',
					'background-page': null,
					layers: [],
				},
				{ pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, knownDistance: 2000, pixelsPerWorldUnit: 20 },
			),
		);
		expect(plan.calibration?.pixelsPerWorldUnit).toBeCloseTo(20);
	});

	it('planToPersistence lowers an image background without a page and a pdf with one', () => {
		const projectId = createProjectId();
		const image = makePlanEntity({ projectId, background: { path: 'a.png', kind: 'image' } });
		const loweredImage = planToPersistence(image, 4);
		expect(loweredImage['background-page']).toBeNull();

		const pdf = makePlanEntity({ projectId, background: { path: 'a.pdf', kind: 'pdf' } });
		expect(planToPersistence(pdf, 4)['background-page']).toBe(1);
	});

	it('zoneFromPersistence refuses a broken geometry half independently of the note half', () => {
		const zone = makeZoneEntity({ projectId: createProjectId(), planId: createPlanId() });
		const goodFrontmatter = zoneToPersistence(zone, 1);
		const result = zoneFromPersistence(goodFrontmatter, { id: zone.id, type: 'polygon', points: 'nope' });
		expect(expectErr(result).code).toBe('zone.geometry-invalid');
	});

	it('zoneToGeometryEntry flattens points to tuples', () => {
		const zone = makeZoneEntity({ projectId: createProjectId(), planId: createPlanId(), geometry: squareAt(2, 3) });
		expect(zoneToGeometryEntry(zone).points[0]).toEqual([2, 3]);
	});
});
