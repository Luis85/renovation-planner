/**
 * The latest known version per migratable kind. A schema bump edits its DTO module AND
 * this table in the same change — the table is what tells the runner when to stop.
 */
export const LATEST_VERSIONS: Record<string, number> = {
	project: 1,
	plan: 1,
	zone: 1,
	asset: 1,
	requirement: 1,
	'plan-geometry': 1,
};

function migrationError(code: string, message: string): Error & { readonly code: string; readonly category: 'Migration' } {
	// An ERROR instance rather than a bare object: the runner THROWS (its contract has no
	// Result channel), and a thrown non-Error loses its stack at every catch site.
	return Object.assign(new Error(message), { code, category: 'Migration' as const });
}

/**
 * The schema-migration machinery (SDD §44–45). A migration is a PURE function over plain
 * objects, chained `(kind, fromVersion) → toVersion` up to latest BEFORE Zod validates
 * the final shape — a migration reshapes data, it never validates it.
 *
 * At schema version 1 for every shape there is nothing real to migrate from yet; the
 * runner ships empty and is proven by a synthetic v0→v1 fixture in the test suite. A gap
 * in the chain (a version nobody wrote a step for) throws a plain-data `MigrationError`:
 * callers above translate it into the diagnostic their read path carries, and a thrown
 * plain object stays consistent with this codebase's errors-are-values shape everywhere
 * else.
 */
export interface Migration {
	readonly fromVersion: number;
	readonly toVersion: number;
	migrate(input: unknown): unknown;
}

export class MigrationRunner {
	private readonly byKind = new Map<string, Migration[]>();

	register(kind: string, migration: Migration): void {
		const list = this.byKind.get(kind);
		if (list) {
			list.push(migration);
		} else {
			this.byKind.set(kind, [migration]);
		}
	}

	/** Registers every migration of one kind, oldest first — what the composition root calls. */
	registerAll(kind: string, migrations: readonly Migration[]): void {
		for (const migration of migrations) this.register(kind, migration);
	}

	migrateToLatest(kind: string, raw: unknown, fromVersion: number): unknown {
		let current = raw;
		let version = fromVersion;
		const steps = [...(this.byKind.get(kind) ?? [])].toSorted((a, b) => a.fromVersion - b.fromVersion);
		while (version < LATEST_VERSIONS[kind]) {
			const step = steps.find((m) => m.fromVersion === version);
			if (!step || step.toVersion !== version + 1) {
				throw migrationError('migration.chain-gap', `No migration step from version ${version} for "${kind}".`);
			}
			current = step.migrate(current);
			version = step.toVersion;
		}
		return current;
	}
}

/** The one registration table, built once at the composition root (or in its test double). */
export function createMigrationRunner(
	registrations: Readonly<Record<string, readonly Migration[]>>,
): MigrationRunner {
	const runner = new MigrationRunner();
	for (const [kind, migrations] of Object.entries(registrations)) runner.registerAll(kind, migrations);
	return runner;
}
