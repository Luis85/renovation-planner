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
	/**
	 * The most recent migration step this runner applied in THIS session, as
	 * `"kind: from -> to"` — content-free (SDD §68), and null until something older than
	 * the latest schema was actually migrated. The diagnostics snapshot reads this; it is
	 * deliberately NOT persisted anywhere.
	 */
	private lastAppliedStep: string | null = null;

	register(kind: string, migration: Migration): void {
		const list = this.byKind.get(kind);
		if (list) {
			list.push(migration);
		} else {
			this.byKind.set(kind, [migration]);
		}
	}

	/**
	 * Registers every migration of one kind, oldest first — what the composition root calls.
	 *
	 * An EMPTY list still registers the kind, and that is the whole reason this is not a
	 * loop over `register`: at schema version 1 no shape has a step yet, so every kind the
	 * composition names arrives here with `[]` — and a kind the runner has never heard of
	 * is a kind `latestVersions` cannot report.
	 */
	registerAll(kind: string, migrations: readonly Migration[]): void {
		const list = this.byKind.get(kind) ?? [];
		this.byKind.set(kind, list);
		for (const migration of migrations) list.push(migration);
	}

	/**
	 * The latest version per kind, DERIVED from what was registered rather than declared
	 * beside it. This accessor is what `GetDiagnosticsSnapshot.schemaVersions` reports, so
	 * the derivation is what makes the composition root's registration table the ONE list a
	 * new entity has to appear in: registering a kind is what puts it in diagnostics, and
	 * there is no second table to remember.
	 *
	 * It replaced a module-level `LATEST_VERSIONS` constant, which was exactly that second
	 * table — a kind added to the composition's registrations alone appeared nowhere in
	 * diagnostics, and the comment claiming otherwise had no check under it.
	 *
	 * **What the derivation costs, stated because it is a real constraint and not a
	 * formality:** a version can no longer be pinned independently of its steps. Bumping a
	 * kind to version 2 means registering a step that ENDS at 2 — a no-op step, if the
	 * reshape is genuinely nothing. That is a narrower vocabulary than the constant allowed,
	 * and deliberately: the one thing the constant made easy was bumping a version with no
	 * step to reach it, which `migrateToLatest` then refused at read time as a chain gap.
	 */
	get latestVersions(): Readonly<Record<string, number>> {
		const versions: Record<string, number> = {};
		for (const kind of this.byKind.keys()) versions[kind] = this.latestVersionOf(kind);
		return versions;
	}

	/**
	 * 1 is the FLOOR, not a fallback for an unregistered kind: a shape with no steps ships
	 * at version 1, which is every shape today. An unregistered kind answers 1 for the same
	 * arithmetic, which keeps `migrateToLatest` total — a v1 note of a kind nobody registered
	 * passes through unchanged, and a note claiming a higher version is still refused as
	 * unsupported rather than best-effort parsed.
	 */
	private latestVersionOf(kind: string): number {
		return Math.max(1, ...(this.byKind.get(kind) ?? []).map((migration) => migration.toVersion));
	}

	get lastApplied(): string | null {
		return this.lastAppliedStep;
	}

	migrateToLatest(kind: string, raw: unknown, fromVersion: number): unknown {
		const latest = this.latestVersionOf(kind);
		// Fail closed on the FUTURE (SDD §44, §87 rule 7): a note written by a newer
		// plugin build must be refused outright, never best-effort parsed — the loop
		// below would otherwise exit immediately on `version >= latest` and hand the
		// unknown shape to Zod, whose literal-version failure reports the wrong defect
		// ("frontmatter-invalid") for what is really "this build is too old".
		if (fromVersion > latest) {
			throw migrationError(
				`${kind}.schema-version-unsupported`,
				`The ${kind} note carries schema-version ${fromVersion}, newer than this build supports (${latest}).`,
			);
		}
		let current = raw;
		let version = fromVersion;
		const steps = [...(this.byKind.get(kind) ?? [])].toSorted((a, b) => a.fromVersion - b.fromVersion);
		while (version < latest) {
			const step = steps.find((m) => m.fromVersion === version);
			if (!step || step.toVersion !== version + 1) {
				throw migrationError('migration.chain-gap', `No migration step from version ${version} for "${kind}".`);
			}
			current = step.migrate(current);
			version = step.toVersion;
			this.lastAppliedStep = `${kind}: ${step.fromVersion} -> ${step.toVersion}`;
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
