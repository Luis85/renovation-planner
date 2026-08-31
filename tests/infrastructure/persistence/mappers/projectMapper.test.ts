import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { currencyOf } from '../../../../src/core/money/Money';
import { Project } from '../../../../src/domain/project/Project';
import { createProjectId, type ProjectId } from '../../../../src/domain/project/ProjectId';
import { PROJECT_TYPE } from '../../../../src/infrastructure/persistence/dto/projectFrontmatter';
import { PROJECT_MIGRATIONS } from '../../../../src/infrastructure/persistence/migration/project/project.migrations';
import {
	projectFromPersistence,
	projectToPersistence,
} from '../../../../src/infrastructure/persistence/mappers/projectMapper';
import { expectOk } from '../../../helpers/domain';

const EUR = currencyOf('EUR');
const GBP = currencyOf('GBP');

/** A fully-populated v1 project note, the base every malformed-date row mutates one key of. */
const VALID_PROJECT_FRONTMATTER = {
	type: PROJECT_TYPE,
	'schema-version': 1,
	id: 'project-x',
	revision: 1,
	name: 'Kitchen',
	status: 'idea',
	description: null,
	start: null,
	'target-completion': null,
};

/** What a v1 project note written before `description`/`start`/`target-completion`
 * existed actually holds on disk — none of the three keys present at all. */
const VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS = {
	type: PROJECT_TYPE,
	'schema-version': 1,
	id: 'project-x',
	revision: 1,
	name: 'Kitchen',
	status: 'idea',
};

/**
 * Pinned west of Greenwich for the whole file. `toDateOnly`/`fromDateOnly` must reach a
 * calendar day through UTC alone; a mapper that instead used local-time getters to
 * serialize, or parsed the stored string as local time on the way back in, would shift
 * the day under this offset. A suite that only ever ran under the default UTC runner
 * environment could not see either mistake — both directions here are asserted while the
 * process itself is NOT on UTC.
 */
const ORIGINAL_TZ = process.env.TZ;

beforeAll(() => {
	process.env.TZ = 'America/Los_Angeles';
});

afterAll(() => {
	process.env.TZ = ORIGINAL_TZ;
});

describe('projectMapper: description, start and targetCompletion', () => {
	/**
	 * What a Project note keeps. The three fields added here were droppable for five
	 * slices because no test ever wrote one and read it back — each mapper direction was
	 * asserted against a literal, so both agreed about a field neither carried.
	 */
	it('preserves description, start and targetCompletion across a round trip', () => {
		const created = expectOk(
			Project.create({
				id: 'p1' as ProjectId,
				name: 'Kitchen',
				currency: EUR,
				description: 'Full refit',
				start: new Date('2026-03-01T00:00:00Z'),
				targetCompletion: new Date('2026-09-30T00:00:00Z'),
			}),
		);

		const raw = projectToPersistence(created, 1);
		const back = expectOk(projectFromPersistence(raw, EUR));

		expect(back.description).toBe('Full refit');
		expect(back.start?.toISOString()).toBe('2026-03-01T00:00:00.000Z');
		expect(back.targetCompletion?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
	});

	it('writes a date-only string rather than a timestamp', () => {
		// What a user hand-editing frontmatter reads, and what `<input type="date">` round-trips.
		const created = expectOk(
			Project.create({
				id: 'p1' as ProjectId,
				name: 'Kitchen',
				currency: EUR,
				start: new Date('2026-03-01T00:00:00Z'),
			}),
		);

		expect(projectToPersistence(created, 1)['start']).toBe('2026-03-01');
	});

	it.each([
		// Wrong shape — the only one a regex alone would have caught.
		'yesterday',
		// Shape-valid, unparseable: `getTime()` is NaN, every comparison against NaN is
		// false, so `targetCompletion < start` answers "fine" for any pair — and
		// `.toISOString()` on it throws a RangeError rather than returning a string.
		'2026-99-99',
		'2026-13-01',
		'2026-00-10',
		// Shape-valid and QUIETLY WRONG, which is the worse half: these parse, nothing
		// fails anywhere, and the user's February 30th is stored and displayed as March 2nd.
		'2026-02-30',
		'2026-04-31',
	])('reads %s as absent rather than as a date', (stored) => {
		const raw = { ...VALID_PROJECT_FRONTMATTER, start: stored };

		const back = expectOk(projectFromPersistence(raw, EUR));

		expect(back.start).toBeNull();
	});

	it('keeps a real calendar date, including a leap day', () => {
		// The guard must not be so eager it refuses valid dates: 2028 is a leap year, and
		// a hand-written regex clever enough to reject 2026-02-30 usually rejects this too.
		const raw = { ...VALID_PROJECT_FRONTMATTER, start: '2028-02-29' };

		const back = expectOk(projectFromPersistence(raw, EUR));

		expect(back.start?.toISOString()).toBe('2028-02-29T00:00:00.000Z');
	});

	it('reads a note written before these keys existed', () => {
		// `.catch(null)` is what makes this additive rather than a migration. Without it,
		// every project note in every existing vault fails to parse.
		const back = expectOk(projectFromPersistence(VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS, EUR));

		expect(back.description).toBeNull();
		expect(back.start).toBeNull();
	});
});

describe("a project note's currency", () => {
	it('takes the default when the key is absent', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS };
		expect(expectOk(projectFromPersistence(raw, GBP)).currency).toBe('GBP');
	});

	it('honours a stated key over the default', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS, currency: 'CHF' };
		expect(expectOk(projectFromPersistence(raw, GBP)).currency).toBe('CHF');
	});

	it('falls back to the default for a malformed value, rather than refusing the note', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS, currency: 'eur' };
		expect(expectOk(projectFromPersistence(raw, EUR)).currency).toBe('EUR');
	});

	it('round-trips, so the value stops floating once the note is saved', () => {
		const created = expectOk(
			Project.create({ id: createProjectId(), name: 'Kitchen refit', currency: GBP }),
		);
		const raw = projectToPersistence(created, 1);
		expect(raw['currency']).toBe('GBP');
		// The default is EUR here and loses to the written key: the point of the round trip.
		expect(expectOk(projectFromPersistence(raw, EUR)).currency).toBe('GBP');
	});

	/**
	 * The cost of Decision 2, pinned as BEHAVIOUR rather than described. A project that
	 * never stated a currency follows the setting. A later reader who "fixes" this fails
	 * here instead of making the spec quietly wrong.
	 */
	it('FLOATS: an un-stated currency follows whatever default it is read with', () => {
		const raw = { ...VALID_PROJECT_FRONTMATTER_V1_WITHOUT_OPTIONAL_KEYS };
		expect(expectOk(projectFromPersistence(raw, EUR)).currency).toBe('EUR');
		expect(expectOk(projectFromPersistence(raw, GBP)).currency).toBe('GBP');
	});

	it('the schema stays at version 1 — no migration is registered', () => {
		expect(projectToPersistence(
			expectOk(Project.create({ id: createProjectId(), name: 'K', currency: EUR })),
			1,
		)['schema-version']).toBe(1);
		expect(PROJECT_MIGRATIONS).toHaveLength(0);
	});
});
