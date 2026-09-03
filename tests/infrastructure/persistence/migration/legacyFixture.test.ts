import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMigrationRunner, type Migration } from '../../../../src/infrastructure/persistence/migration/MigrationRunner';
import { openFixtureVault, type FixtureStack } from '../../../helpers/fixtureVault';

let open: FixtureStack | null = null;
afterEach(() => {
	open?.dispose();
	open = null;
});

/**
 * A TEST-LOCAL step, registered in a test-local runner. The production `MIGRATION_SET` is
 * empty for all seven kinds, so there is no production migration to exercise and none may be
 * added here: slice 12 owns no schema. Registered through the SAME `createMigrationRunner`
 * the composition root calls (`plugin/composition-root.ts:457`) — only the TABLE handed to
 * it is test-local, never a second runner mechanism.
 */
const renameLabel: Migration = {
	fromVersion: 1,
	toVersion: 2,
	migrate: (raw: unknown): unknown => {
		const { 'legacy-label': label, ...rest } = raw as Record<string, unknown>;
		// The STEP advances `schema-version`; the runner does not. `migrateToLatest(kind, raw,
		// fromVersion)` takes the version as a PARAMETER and tracks it in a local — it never
		// rewrites the object it returns. A draft omitted this line, so the first case's
		// expected version 2 was unreachable, and deriving the second call's `fromVersion`
		// from the returned frontmatter would have re-applied the migration rather than
		// testing idempotence.
		return { ...rest, name: label, 'schema-version': 2 };
	},
};

const ZONE_PATH = 'Zones/Kitchen.md';

/**
 * The planted note's frontmatter, read THROUGH the fixture rather than typed in as an
 * object literal — `metadataCache.getFileCache` mirrors what a repository's own read path
 * calls, over a file this stack never wrote (a checked-in note carries no create-window
 * record), so no `catchUp()` is needed before it. Without this, `openFixtureVault` would be
 * opened and never read — the "instrument reaches nothing" shape this slice exists to
 * refuse.
 */
const readPlantedZone = (stack: FixtureStack): Record<string, unknown> => {
	const file = stack.vault.getAbstractFileByPath(ZONE_PATH);
	const frontmatter = stack.metadataCache.getFileCache(file)?.frontmatter;
	if (!frontmatter) throw new Error(`fixture note has no frontmatter: ${ZONE_PATH}`);
	return frontmatter;
};

describe('the migration runner accepts a step', () => {
	it('applies it to a note at the version below', async () => {
		open = await openFixtureVault('legacy-schema');
		const runner = createMigrationRunner({ zone: [renameLabel] });
		const raw = readPlantedZone(open);

		const migrated = runner.migrateToLatest('zone', raw, 1);

		expect(migrated).toMatchObject({ name: 'Kitchen', 'schema-version': 2 });
		expect(migrated).not.toHaveProperty('legacy-label');
	});

	it('reaches the same state when run twice', async () => {
		open = await openFixtureVault('legacy-schema');
		const runner = createMigrationRunner({ zone: [renameLabel] });
		const raw = readPlantedZone(open);

		const once = runner.migrateToLatest('zone', raw, 1);
		// `fromVersion: 2` — the version the first pass produced, passed EXPLICITLY. Deriving
		// it from `once` would be reading the object the step just stamped, which is the same
		// number by construction and so proves nothing; passing 1 again here would re-run the
		// step rather than test the RUNNER's own guard against re-applying an already-current
		// note — which is what this half proves.
		const twice = runner.migrateToLatest('zone', once as Record<string, unknown>, 2);
		expect(twice).toEqual(once);

		// That guard is a real, distinct claim from STEP idempotence, and conflating the two
		// was measured wrong: `migrate` above is invoked exactly ONCE by the two lines above,
		// since `fromVersion: 2` already equals `latest` and the loop never re-enters it — so
		// a genuinely non-deterministic `migrate` (one that appends an incrementing counter to
		// its own output) passes both this assertion and the one above unchanged. Watched
		// failing rather than assumed: with that counter planted, THIS is the one assertion in
		// the file that reddens. A second, INDEPENDENT run from the same on-disk frontmatter —
		// `fromVersion: 1` again, over a FRESH parse rather than `once`'s own output — is what
		// actually exercises `migrate` a second time and can tell a deterministic step from one
		// that is not.
		const again = runner.migrateToLatest('zone', readPlantedZone(open), 1);
		expect(again).toEqual(once);
	});

	it('leaves a note already at the current version untouched', async () => {
		open = await openFixtureVault('legacy-schema');
		const runner = createMigrationRunner({ zone: [renameLabel] });
		const raw = readPlantedZone(open);
		// "Already current" state derived from the SAME fixture note (through one honest
		// migration pass) rather than a hand-typed literal — a literal here would be the
		// exact "opened and never read" shape Step 5 exists to refuse, since this case would
		// then be the one of the three that touches no fixture content at all.
		const current = runner.migrateToLatest('zone', raw, 1) as Record<string, unknown>;

		// This call shares its short-circuit with the second half of "reaches the same state
		// when run twice": both pass `fromVersion === latest`, so `while (version < latest)`
		// never re-enters and neither ever reaches `renameLabel.migrate` or its own version
		// guard. Measured rather than assumed: no mutation to `renameLabel` can redden THIS
		// assertion in isolation — only a change to that loop condition can, and that same
		// change also breaks "applies it to a note at the version below", since that case's
		// own single call ends by hitting the identical `version === latest` termination. So
		// this assertion is real and load-bearing (it is what stops the runner from touching
		// already-current data) but is not separable, by mutation, from the other two here —
		// a future reader mutating `renameLabel` and seeing this case stay green while
		// another reddens should read that as expected, not as a coverage hole.
		expect(runner.migrateToLatest('zone', { ...current }, 2)).toEqual(current);
	});

	/**
	 * Task 10's own conformance case, repeated here: every caller of `openFixtureVault` gets
	 * an isolated clone, so the checked-in note must read back identically after the runner
	 * has been driven against the clone's content three times above.
	 */
	it('leaves the checked-in fixture byte-identical', async () => {
		const before = readFileSync(join('tests/vault/legacy-schema', ZONE_PATH), 'utf8');

		open = await openFixtureVault('legacy-schema');
		readPlantedZone(open);

		expect(readFileSync(join('tests/vault/legacy-schema', ZONE_PATH), 'utf8')).toBe(before);
	});
});
