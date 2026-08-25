import { describe, expect, it } from 'vitest';
import { GetDiagnosticsSnapshotQuery } from '../../../src/application/queries/GetDiagnosticsSnapshot';
import type { DiagnosticsLedger, RuntimeVersions, ValidationIssue } from '../../../src/application/ports/diagnostics';
import { InMemoryDiagnosticsLedger } from '../../../src/infrastructure/logging/diagnosticsLedger';

/**
 * SDD §68's hard rule, asserted structurally: the snapshot contains ONLY the fields the
 * interface declares — versions, schema versions, migration state, and issues named by
 * opaque id + code — so project content cannot ride along even when the sources hold
 * plenty of it.
 */

const versions: RuntimeVersions = { pluginVersion: '0.7.0', obsidianVersion: '1.13.0' };

function ledgerOf(...issues: ValidationIssue[]): DiagnosticsLedger {
	const ledger = new InMemoryDiagnosticsLedger();
	for (const issue of issues) ledger.record(issue);
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
			ledgerOf({ entityType: 'zone', entityId: 'z-123', issue: 'zone.schema-version-unsupported' }),
		);
		expect(snapshot.validationIssues).toEqual([
			{ entityType: 'zone', entityId: 'z-123', issue: 'zone.schema-version-unsupported' },
		]);
	});

	it('contains zero project content — no names, bodies or paths, only declared fields', async () => {
		const ledger = ledgerOf(
			{ entityType: 'zone', entityId: 'z-123', issue: 'zone.frontmatter-invalid' },
			{ entityType: 'plan', entityId: 'p-9', issue: 'plan.schema-version-malformed' },
		);
		const snapshot = await snapshotFrom(ledger);
		const text = JSON.stringify(snapshot);
		expect(text).not.toContain('Kitchen');
		expect(text).not.toContain('.md');
		expect(text).not.toContain('/');
		expect(Object.keys(snapshot).toSorted()).toEqual(
			['obsidianVersion', 'pluginVersion', 'schemaVersions', 'migrationState', 'validationIssues'].toSorted(),
		);
	});
});

describe('the in-memory diagnostics ledger', () => {
	it('collapses duplicates, so a re-read broken entity cannot crowd others out', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		ledger.record({ entityType: 'zone', entityId: 'z-1', issue: 'zone.schema-version-unsupported' });
		ledger.record({ entityType: 'zone', entityId: 'z-1', issue: 'zone.schema-version-unsupported' });
		expect(ledger.issues()).toEqual([
			{ entityType: 'zone', entityId: 'z-1', issue: 'zone.schema-version-unsupported' },
		]);
	});

	it('grows without bound-proof: oldest entries fall off past the cap', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		for (let i = 0; i < 250; i += 1) {
			ledger.record({ entityType: 'zone', entityId: `z-${i}`, issue: 'x.y' });
		}
		const issues = ledger.issues();
		expect(issues.length).toBeLessThan(250);
		expect(issues[0]?.entityId).not.toBe('z-0');
	});

	it('hands out a copy, so a caller cannot mutate what was recorded', () => {
		const ledger = new InMemoryDiagnosticsLedger();
		ledger.record({ entityType: 'zone', entityId: 'z-1', issue: 'x.y' });
		ledger.issues().length = 0;
		expect(ledger.issues()).toHaveLength(1);
	});
});
