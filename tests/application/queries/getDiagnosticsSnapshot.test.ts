import { describe, expect, it } from 'vitest';
import { GetDiagnosticsSnapshotQuery } from '../../../src/application/queries/GetDiagnosticsSnapshot';
import type { DiagnosticEntityKind, DiagnosticsLedger, RuntimeVersions } from '../../../src/application/ports/diagnostics';
import type { AppError } from '../../../src/core/errors/AppError';
import type { EntityId } from '../../../src/core/identity/EntityId';
import { InMemoryDiagnosticsLedger } from '../../../src/infrastructure/logging/diagnosticsLedger';

/**
 * SDD §68's hard rule, asserted structurally: the snapshot contains ONLY the fields the
 * interface declares — versions, schema versions, migration state, and issues named by
 * opaque id + code — so project content cannot ride along even when the sources hold
 * plenty of it.
 */

const versions: RuntimeVersions = { pluginVersion: '0.7.0', obsidianVersion: '1.13.0' };

const id = (value: string): EntityId<string> => value as EntityId<string>;

interface Recorded {
	readonly kind: DiagnosticEntityKind;
	readonly entityId: EntityId<string>;
	readonly error: AppError;
}

const refusal = (code: string): AppError => ({ category: 'Validation', code, message: 'refused' });

function ledgerOf(...recorded: Recorded[]): DiagnosticsLedger {
	const ledger = new InMemoryDiagnosticsLedger();
	for (const entry of recorded) ledger.record(entry.kind, entry.entityId, entry.error);
	return ledger;
}

function snapshotFrom(ledger: DiagnosticsLedger) {
	return new GetDiagnosticsSnapshotQuery({
		versions,
		latestSchemaVersions: () => ({ project: 1, plan: 1, zone: 1 }),
		lastAppliedMigration: () => 'zone: 0 -> 1',
		ledger,
	}).execute();
}

describe('GetDiagnosticsSnapshot', () => {
	it('reports versions, schema versions and migration state', async () => {
		const snapshot = await snapshotFrom(new InMemoryDiagnosticsLedger());
		expect(snapshot.pluginVersion).toBe('0.7.0');
		expect(snapshot.obsidianVersion).toBe('1.13.0');
		expect(snapshot.schemaVersions).toEqual({ project: 1, plan: 1, zone: 1 });
		expect(snapshot.migrationState.pending).toEqual([]);
		expect(snapshot.migrationState.lastApplied).toBe('zone: 0 -> 1');
	});

	it('reports validation issues as opaque id plus code', async () => {
		const snapshot = await snapshotFrom(
			ledgerOf({ kind: 'zone', entityId: id('z-123'), error: refusal('zone.schema-version-unsupported') }),
		);
		expect(snapshot.validationIssues).toEqual([
			{ entityType: 'zone', entityId: 'z-123', issue: 'zone.schema-version-unsupported' },
		]);
	});

	/**
	 * **The fixture is content-BEARING on purpose, and that is the whole repair.** This case
	 * used to build the ledger out of two hand-written `ValidationIssue`s that were already
	 * free of names, paths and bodies, and then assert the snapshot held none — a fixture
	 * written content-free by the same hand as the assertion, which could only ever prove
	 * that the query adds nothing of its own.
	 *
	 * Every error below carries a Zone's name, a note path and a frontmatter value in its
	 * `message` and its `cause`, because that is what a real one carries: `migrateNote`
	 * interpolates the value it refused, and `persistenceError` spreads the thrown cause. The
	 * assertion is that none of it survives the ledger. The structural half — that the
	 * snapshot has exactly the five declared fields — stays, because a sixth field is the
	 * other way content could ride along.
	 */
	it('drops the content a real refusal carries, keeping only the code', async () => {
		const snapshot = await snapshotFrom(
			ledgerOf(
				{
					kind: 'zone',
					entityId: id('zone-01JABCDEF'),
					error: {
						category: 'Validation',
						code: 'zone.frontmatter-invalid',
						message: 'The zone "Kitchen" at Renovation/Zones/Kitchen.md has schema-version "banana".',
						cause: { path: 'Renovation/Zones/Kitchen.md', name: 'Kitchen' },
					},
				},
				{
					kind: 'plan',
					entityId: id('plan-01JZZZ'),
					error: {
						category: 'Migration',
						code: 'plan.schema-version-malformed',
						message: 'Migrating Renovation/Plans/Ground floor.md failed.',
						cause: new Error('Ground floor'),
					},
				},
			),
		);
		const text = JSON.stringify(snapshot);
		const leaked = ['Kitchen', 'Ground floor', 'banana', '.md', '/'].filter((content) => text.includes(content));
		expect(leaked).toEqual([]);
		expect(snapshot.validationIssues).toEqual([
			{ entityType: 'zone', entityId: 'zone-01JABCDEF', issue: 'zone.frontmatter-invalid' },
			{ entityType: 'plan', entityId: 'plan-01JZZZ', issue: 'plan.schema-version-malformed' },
		]);
		expect(Object.keys(snapshot).toSorted()).toEqual(
			['obsidianVersion', 'pluginVersion', 'schemaVersions', 'migrationState', 'validationIssues'].toSorted(),
		);
	});
});

describe('the in-memory diagnostics ledger', () => {
	it('collapses duplicates, so a re-read broken entity cannot crowd others out', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		ledger.record('zone', id('z-1'), refusal('zone.schema-version-unsupported'));
		ledger.record('zone', id('z-1'), refusal('zone.schema-version-unsupported'));
		expect(ledger.issues()).toEqual([
			{ entityType: 'zone', entityId: 'z-1', issue: 'zone.schema-version-unsupported' },
		]);
	});

	/**
	 * The dedupe key is the TRIPLE, and the code is what carries the third part of it — so
	 * one entity refusing two different ways is two entries, not one collapsed to the first.
	 * Without this, deriving `issue` from the error rather than taking it as a parameter
	 * could have been implemented as "record the entity once" and nothing would have said so.
	 */
	it('keeps two different codes for one entity apart', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		ledger.record('zone', id('z-1'), refusal('zone.schema-version-unsupported'));
		ledger.record('zone', id('z-1'), refusal('zone.frontmatter-invalid'));
		expect(ledger.issues().map((issue) => issue.issue)).toEqual([
			'zone.schema-version-unsupported',
			'zone.frontmatter-invalid',
		]);
	});

	it('grows without bound-proof: oldest entries fall off past the cap', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		for (let i = 0; i < 250; i += 1) {
			ledger.record('zone', id(`z-${i}`), refusal('x.y'));
		}
		const issues = ledger.issues();
		expect(issues.length).toBeLessThan(250);
		expect(issues[0]?.entityId).not.toBe('z-0');
	});

	it('hands out a copy, so a caller cannot mutate what was recorded', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		ledger.record('zone', id('z-1'), refusal('x.y'));
		// Cast deliberately: `issues()` returns a `readonly` array, so this line is exactly what
		// the type forbids — which is the point. `readonly` is erased at runtime, so "a caller
		// cannot mutate what was recorded" is a claim about the COPY the getter hands out, and
		// only a runtime mutation can test it.
		(ledger.issues() as { length: number }).length = 0;
		expect(ledger.issues()).toHaveLength(1);
	});
});
