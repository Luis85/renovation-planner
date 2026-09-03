import type { LogLevel, Logger } from '../../src/application/ports/Logger';
import { EchoWindow } from '../../src/infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryDiagnosticsLedger } from '../../src/infrastructure/logging/diagnosticsLedger';
import { createMigrationRunner, type MigrationRunner } from '../../src/infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../../src/infrastructure/persistence/migration/migrationSet';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { PlanGeometryStore } from '../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import type { NoteVaultDeps } from '../../src/infrastructure/obsidian/repositories/NoteVaultDeps';
import type { Line } from './logger';

/**
 * Everything both repository stacks build the same way, EXCEPT the three host surfaces they
 * are built over and the five repositories those surfaces feed.
 *
 * There are two stacks — `createRepositoryStack`'s in-memory one and `openFixtureVault`'s
 * disk-backed one — and `FixtureStack`'s own docblock has always said the difference is the
 * three fakes and nothing else: "the five repositories, the geometry store, the index, the
 * echo window, the migration runner, the logger and its `logged` recorder — is the same
 * shape, constructed the same way". It was a claim two copies made rather than one
 * definition, and `npm run analyze` reported the pair as the repository's largest clone
 * family: four groups, 98 lines, the biggest of them 67.
 *
 * Declared HERE rather than as an `Omit` over `RepositoryStack`, so that both stacks depend
 * on the core instead of one depending on the other — which is also what keeps this module
 * free of a cycle back into `vault.ts`.
 */
export interface StackFoundation {
	index: InMemoryProjectIndex;
	echo: EchoWindow;
	migrations: MigrationRunner;
	logged: Line[];
	logger: Logger;
	/**
	 * Typed as the CONCRETE class, matching `store`/`migrations`/`index`/`echo`, rather than as
	 * the `DiagnosticsLedger` port: a caller reading a concrete-only member later is not
	 * refused, and the port type would buy nothing here. `logger` is the one exception, and it
	 * is one because that field is a plain object literal with no class behind it rather than a
	 * constructed instance.
	 */
	ledger: InMemoryDiagnosticsLedger;
	store: PlanGeometryStore;
	/**
	 * The `NoteVaultDeps` bundle all five repositories are constructed from. Returned rather
	 * than kept private BECAUSE the repositories are not constructed here — see
	 * `stackFoundation`'s docblock for why that line is drawn where it is.
	 */
	deps: NoteVaultDeps;
	/**
	 * The root the stack was constructed with, echoed back for a caller that needs it. Under
	 * ADR-0013 this is no longer a per-project field any of the five note-backed repositories
	 * reads: `ObsidianProjectRepository` is the only one that still takes it directly, because
	 * it is the one repository that ever writes a note whose folder does not already exist to
	 * be derived from. Every other project's folder is `projectFolderOf`'s to answer.
	 */
	projectFolder: string;
	/** Rebuilds the index from the vault contents — the scan the plugin runs at load. */
	rebuildIndex(): void;
}

/**
 * The three host surfaces a stack is built over, as the ONLY thing its two callers differ in.
 *
 * `object` rather than a structural surface, and the three `as never` casts live inside this
 * module rather than at each caller: the repositories want Obsidian's own types, both sets of
 * fakes are structural stand-ins for them, and the assembly itself calls no method on any of
 * the three — it only hands them on. `tests/helpers/plugin.ts`'s `VaultSurface` is the type
 * that states what the two fakes have in common, and `fixtureVault.test-d.ts` proves both
 * satisfy it; that proof is what this parameter would otherwise restate less well.
 */
export interface StackHosts {
	vault: object;
	fileManager: object;
	metadataCache: object;
}

/** A per-stack recorder, so a suite can assert on its OWN stack's diagnostics without racing
 * the shared module-scope recorder the plugin suites use. */
const recorder = (): { logged: Line[]; logger: Logger } => {
	const logged: Line[] = [];
	const record =
		(level: LogLevel) =>
		(event: string, context?: Record<string, unknown>): void => {
			logged.push({ level, event, context });
		};

	return { logged, logger: { debug: record('debug'), info: record('info'), warn: record('warn'), error: record('error') } };
};

/**
 * Builds the half of a repository stack that does not depend on which fakes are underneath.
 *
 * The migration table is the PLUGIN's, not a copy of it. That used to be four kinds
 * hand-written in `vault.ts` while the composition root registered six — a fake thinner than
 * the real thing, so every repository test drove a runner that had never heard of an Asset or
 * a Requirement. Sharing the constant is what makes the drift impossible rather than merely
 * fixed, and there is now one importer of it rather than two.
 */
export const stackFoundation = (hosts: StackHosts, projectFolder: string): StackFoundation => {
	const { logged, logger } = recorder();
	const index = new InMemoryProjectIndex();
	const echo = new EchoWindow();
	const migrations = createMigrationRunner(MIGRATION_SET);
	const ledger = new InMemoryDiagnosticsLedger();

	const vault = hosts.vault as never;
	const fileManager = hosts.fileManager as never;
	const metadataCache = hosts.metadataCache as never;

	const deps: NoteVaultDeps = { vault, fileManager, metadataCache, index, echo, migrations, logger, ledger };
	const store = new PlanGeometryStore(vault, fileManager, index, migrations, echo);

	return {
		index,
		echo,
		migrations,
		logged,
		logger,
		ledger,
		store,
		deps,
		projectFolder,
		rebuildIndex() {
			const scan = buildProjectIndexEntries({ vault, metadataCache, echo, logger });
			index.rebuild(scan.entries, scan.exclusions);
		},
	};
};
