/**
 * A disk-backed vault adapter over `tests/vault/<caseName>` — SDD §75's Integration Test
 * Vault, as a fixture REPOSITORY STACK rather than as three host surfaces.
 *
 * `NoteVaultDeps` declares eight members and `ObsidianZoneRepository` takes a
 * `PlanGeometryStore` beside them, so a function returning host APIs alone cannot stand up
 * a repository however many of them it returns.
 *
 * Three hardening rules this adapter inherits from `FakeVault` BY CONSTRUCTION, each with a
 * conformance case in `fixtureVault.test.ts` — a header comment is not the mechanism, and
 * with the contract repoint deferred all three in-slice consumers are READ paths, so
 * nothing else would exercise any of them:
 *
 *  1. `create` refuses a path whose parent folder does not exist. Obsidian refuses one;
 *     making the old fake refuse turned 86 tests red.
 *  2. The metadata cache is populated ASYNCHRONOUSLY, with the create-window fallback.
 *     Making the old fake honest turned 65 tests red across 12 files.
 *  3. `getAbstractFileByPath` answers a folder object for a folder, never `null`.
 *
 * Every caller gets an isolated writable CLONE; the checked-in tree is read-only input.
 */
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { TFile, TFolder } from 'obsidian';
import type { LogLevel, Logger } from '../../src/application/ports/Logger';
import { EchoWindow } from '../../src/infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryDiagnosticsLedger } from '../../src/infrastructure/logging/diagnosticsLedger';
import { createMigrationRunner } from '../../src/infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../../src/infrastructure/persistence/migration/migrationSet';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { ObsidianPlanRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianAssetRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetRepository';
import { ObsidianRequirementRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianRequirementRepository';
import { PlanGeometryStore } from '../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import { parseFrontmatter, serializeFrontmatter, type RepositoryStack } from './vault';
import type { Line } from './logger';

/**
 * `getAbstractFileByPath` answers the MOCK MODULE's own `TFile`/`TFolder`, constructed and
 * populated — never a wrapper class of this file's own.
 *
 * `tests/helpers/obsidian-mock.ts`'s header states the rule and the reason: the real
 * `TFile`/`TFolder` are CLASSES and the repositories narrow with `instanceof`, so a fake
 * that answers anything else makes every one of those checks false in tests while true in
 * the app. `grep -rn "instanceof TFile\|instanceof TFolder" src/` prints 19 lines — 16
 * narrowing sites and 3 comments describing the rule. The 16: `NoteVaultDeps.fileAt`,
 * `noteIo.ts` (three — `openNoteById`, `isTFolder`, and its rename-collision check),
 * `PlanGeometryStore` (twice), `VaultChangeAdapter` (three times), `ObsidianZoneRepository`,
 * `BackgroundRenderModel`, `GeometrySidecarView`, `openNote.ts`, `vaultFileProbe.ts`, and
 * `RenovationPlannerPlugin.ts` (twice).
 *
 * A first draft of this file declared its own `FixtureFile`/`FixtureFolder` pair, which
 * would have made every fixture note read as MISSING — Task 11 could have loaded neither the
 * planted record nor the healthy one — while the stack still type-checked. Exactly the defect
 * the mock's own header exists to prevent, introduced one directory away from it.
 */
/** `path` is VAULT-RELATIVE and forward-slashed — never an OS path. See `absolute()`. */
const fileAt = (path: string): TFile => {
	const segments = path.split('/');
	const file = new TFile();
	file.path = path;
	file.name = segments.at(-1) ?? '';
	file.basename = (segments.at(-1) ?? '').replace(/\.[^.]+$/u, '');
	file.extension = path.includes('.') ? (path.split('.').at(-1) ?? '') : '';
	return file;
};

const folderAt = (path: string): TFolder => {
	const segments = path.split('/');
	const folder = new TFolder();
	folder.path = path;
	folder.name = segments.at(-1) ?? '';
	return folder;
};

class FixtureVaultAdapter {
	/**
	 * `root` is the NATIVE absolute path of the clone. Every path this class hands out or
	 * accepts is VAULT-RELATIVE and forward-slashed, and `absolute()` is the only place the
	 * two meet.
	 *
	 * That separation is required rather than tidy, and the leg that proves it is Windows —
	 * one of the four `npm run check` runs, and the one this repository keeps because paths
	 * and line endings are the only things that differ between platforms. `path.join` there
	 * produces backslashes, so an adapter storing the native path in `TFile.path` hands the
	 * repositories something they parse with `/`: `parentOf` searches for a forward slash and
	 * finds none, so an indexed project derives the VAULT ROOT as its folder and every
	 * subsequent plan and zone write targets the wrong directory. `name` and `basename` come
	 * out malformed in the same stroke. Ubuntu would have stayed green throughout.
	 *
	 * `TFile.path` is an Obsidian vault-relative path in production — never an OS path — so
	 * this is fidelity to the real type as much as a platform fix.
	 */
	/**
	 * Paths this adapter created that Obsidian has not parsed yet, with the exact bytes.
	 *
	 * It lives on the VAULT, exactly as `FakeVault.unparsed` does, and that placement is what
	 * dissolves a construction cycle rather than working around one: the adapter needs to
	 * record a create, and the cache needs the current bytes to parse. With the record here,
	 * `FixtureMetadataCache(vault)` reads `vault.unparsed` and there is no cycle to resolve.
	 */
	readonly unparsed = new Map<string, string>();

	constructor(readonly root: string) {}

	/**
	 * Hardening rule 1: Obsidian REFUSES a create whose parent folder does not exist, and so
	 * does this. Making the old fake refuse turned 86 tests red — a precondition only ever
	 * checked in production is a precondition nothing checks.
	 */
	create(path: string, data: string): Promise<TFile> {
		try {
			if (!existsSync(dirname(this.absolute(path)))) {
				throw new Error(`Folder does not exist: ${dirname(path)}`);
			}
			// Obsidian's `Vault.create` REFUSES an existing path, and so does `FakeVault`
			// (vault.ts:118). `writeFileSync` silently truncates, which is kinder than the real
			// thing in the direction that hides a defect: repository code choosing `create` where
			// it should choose `modify` would pass here and destroy a note in a vault.
			if (existsSync(this.absolute(path))) {
				throw new Error(`File already exists: ${path}`);
			}
			writeFileSync(this.absolute(path), data, 'utf8');
			this.unparsed.set(path, data);
			return Promise.resolve(fileAt(path));
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	/**
	 * Hardening rule 3: a folder answers a folder OBJECT, never `null` — and that object's
	 * `children` are populated ONE LEVEL DEEP, mirroring `FakeVault.nodeAt`'s own
	 * `withChildren` branch (vault.ts:99-104). `MockTFolder.children` defaults to `[]`
	 * (`obsidian-mock.ts`), so leaving it unset here would make `undoEnsureFolder`
	 * (`noteIo.ts`) read every folder as empty and trash it — through `FixtureFileManager`
	 * .trashFile → `FixtureVaultAdapter.delete` → `rmSync(..., { recursive: true })` — which
	 * is a REAL filesystem delete, not a map splice. Direct children only, rebuilt per call:
	 * nothing here holds a folder across a mutation, and a recursive build would walk the
	 * whole tree for every path lookup a repository makes.
	 */
	getAbstractFileByPath(path: string): TFile | TFolder | null {
		const absolute = this.absolute(path);
		if (!existsSync(absolute)) return null;
		if (!statSync(absolute).isDirectory()) return fileAt(path);

		const folder = folderAt(path);
		const prefix = path === '' ? '' : `${path}/`;
		folder.children = readdirSync(absolute, { withFileTypes: true }).map((entry) =>
			entry.isDirectory() ? folderAt(`${prefix}${entry.name}`) : fileAt(`${prefix}${entry.name}`),
		);
		return folder;
	}

	/**
	 * Mirrors `FakeVault.modify` (vault.ts:130): refuses a path that does not exist, and
	 * makes the path CACHE-VISIBLE again — the mirror of `create` recording it as unparsed.
	 * On the VAULT, not through the cache: the record lives here, so `modify` needs no cache
	 * reference and the two objects cannot disagree about it.
	 */
	modify(file: TFile, data: string): Promise<void> {
		try {
			const absolute = this.absolute(file.path);
			if (!existsSync(absolute)) {
				throw new Error(`No file to modify: ${file.path}`);
			}
			writeFileSync(absolute, data, 'utf8');
			this.unparsed.delete(file.path);
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	/**
	 * A file OR a folder, because Obsidian's own `trashFile` takes any `TAbstractFile` and
	 * takes everything a folder holds. `rmSync`'s `recursive` option is that same behaviour —
	 * destructive on purpose, mirroring `FakeVault.delete`'s own header on the point.
	 * `unparsed` needs no cleanup here: `readOrUndefined` answers `undefined` for a path that
	 * is gone, and `getFileCache` turns that into `null` on its own.
	 */
	delete(file: TFile | TFolder): Promise<void> {
		try {
			const absolute = this.absolute(file.path);
			if (!existsSync(absolute)) {
				throw new Error(`No file to delete: ${file.path}`);
			}
			rmSync(absolute, { recursive: true, force: true });
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	createFolder(path: string): Promise<void> {
		try {
			const absolute = this.absolute(path);
			if (existsSync(absolute)) {
				throw new Error(`Folder already exists: ${path}`);
			}
			mkdirSync(absolute, { recursive: true });
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	read(file: TFile): Promise<string> {
		try {
			const absolute = this.absolute(file.path);
			if (!existsSync(absolute)) {
				throw new Error(`No file to read: ${file.path}`);
			}
			return Promise.resolve(readFileSync(absolute, 'utf8'));
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	cachedRead(file: TFile): Promise<string> {
		return this.read(file);
	}

	getMarkdownFiles(): TFile[] {
		return this.walkFiles().filter((path) => path.endsWith('.md')).map((path) => fileAt(path));
	}

	getFiles(): TFile[] {
		return this.walkFiles().map((path) => fileAt(path));
	}

	readBinary(): Promise<ArrayBuffer> {
		throw new Error('not implemented by the fixture');
	}

	getResourcePath(): string {
		return '';
	}

	on(): { off(): void } {
		return { off: () => undefined };
	}

	/**
	 * The current bytes, or `undefined` for a path that does not exist — the door
	 * `FixtureMetadataCache` parses through, mirroring `FakeMetadataCache` reading
	 * `vault.entries` directly.
	 *
	 * Synchronous and separate from the async `read` the repositories take, because the cache
	 * is answering "what does Obsidian believe is here" rather than performing a vault read.
	 * `undefined` rather than a throw, because "no such file" is an ANSWER at this door and the
	 * cache's three-way result depends on telling it apart from an empty file.
	 */
	readOrUndefined(path: string): string | undefined {
		const absolute = this.absolute(path);
		return existsSync(absolute) && !statSync(absolute).isDirectory() ? readFileSync(absolute, 'utf8') : undefined;
	}

	/**
	 * Every file path under the root, VAULT-RELATIVE and forward-slashed — built with
	 * template strings rather than `path.relative`, which on Windows would hand the index
	 * `Nested\Deep.md` and derive the wrong parent folder for every note downstream.
	 */
	private walkFiles(dir = ''): string[] {
		const found: string[] = [];
		for (const entry of readdirSync(join(this.root, ...dir.split('/').filter(Boolean)), { withFileTypes: true })) {
			const path = dir === '' ? entry.name : `${dir}/${entry.name}`;
			if (entry.isDirectory()) found.push(...this.walkFiles(path));
			else found.push(path);
		}
		return found;
	}

	/**
	 * The ONE boundary between a vault-relative path and a `TFile`/`TFolder`'s own `path`
	 * field. `join` reintroduces the native separator here (and, for the same reason, inside
	 * `walkFiles`'s own `readdirSync` call) — but in both places the native path is used only
	 * to reach the real filesystem and is never itself assigned into a returned object, so
	 * nothing above this line can leak a native separator into a `TFile`.
	 */
	private absolute(vaultPath: string): string {
		return join(this.root, ...vaultPath.split('/'));
	}
}

/**
 * Mirrors `FakeFileManager` (vault.ts:250) — the two members the repositories reach for on
 * every write and every delete.
 */
class FixtureFileManager {
	constructor(private readonly vault: FixtureVaultAdapter) {}

	async processFrontMatter(file: TFile, update: (frontmatter: Record<string, unknown>) => void): Promise<void> {
		const text = await this.vault.read(file);
		const { frontmatter, body } = parseFrontmatter(text);
		update(frontmatter);
		await this.vault.modify(file, `${serializeFrontmatter(frontmatter)}${body}`);
	}

	/** `TAbstractFile` in Obsidian, so a folder is as ordinary an argument here as a note. */
	trashFile(file: TFile | TFolder): Promise<void> {
		return this.vault.delete(file);
	}
}

class FixtureMetadataCache {
	/**
	 * The create-window record lives on the VAULT (`FixtureVaultAdapter.unparsed`), read from
	 * here — the same relationship `FakeMetadataCache` has with `FakeVault`. The cache owns no
	 * state of its own at all, which is what makes staleness unrepresentable rather than
	 * merely refreshed, and what leaves nothing for the two objects to disagree about.
	 */
	constructor(private readonly vault: FixtureVaultAdapter) {}

	/**
	 * Parsed ON DEMAND from the vault's CURRENT bytes — never from a snapshot map. A checked-in
	 * note is visible the moment the clone lands, so no seeding pass is needed here.
	 *
	 * Three answers, not two. `null` means Obsidian has no entry for the file — never parsed,
	 * or inside the create window. A file it parsed and found NO frontmatter in answers an
	 * OBJECT whose `frontmatter` is undefined. Conflating those makes "never seen" and "the
	 * user deleted the frontmatter" indistinguishable — the exact conflation `frontmatterOf`
	 * must not make.
	 *
	 * What this models and what it does NOT: the window after a CREATE, where Obsidian has no
	 * entry at all. It does not model the parse lag after a MODIFY, where Obsidian holds a
	 * STALE entry rather than none — a different failure, which `FakeVault` does not model
	 * either.
	 */
	getFileCache(file: TFile | TFolder | null): { frontmatter?: Record<string, unknown> } | null {
		if (file === null) return null;

		const asCreated = this.vault.unparsed.get(file.path);
		if (asCreated !== undefined && asCreated === this.vault.readOrUndefined(file.path)) return null;

		const text = this.vault.readOrUndefined(file.path);
		if (text === undefined) return null;
		if (!text.startsWith('---\n')) return {};
		return { frontmatter: parseFrontmatter(text).frontmatter };
	}

	/** What Obsidian eventually does on its own, once its parse queue drains. */
	catchUp(): void {
		this.vault.unparsed.clear();
	}
}

// Exported as TYPES only, mirroring `vault.ts`'s own `export type { FakeVault, FakeFileManager,
// FakeMetadataCache }` — Task 11 and Task 12 need these names to annotate a `FixtureStack`'s
// fields, never to construct one directly (`openFixtureVault` is the one constructor). A value
// export here would be unreachable from outside this module by design, which is exactly what a
// dead-code scan measures: `export class` reported all three as unused exports the moment
// nothing outside this file imported them by name, where `export type` does not carry that
// expectation.
export type { FixtureVaultAdapter, FixtureFileManager, FixtureMetadataCache };

/**
 * `RepositoryStack` shape from `tests/helpers/vault.ts`, with the three FakeVault-flavoured
 * host surfaces replaced by their disk-backed siblings, and a writable clone's root plus a
 * teardown added. Everything else — the five repositories, the geometry store, the index,
 * the echo window, the migration runner, the logger and its `logged` recorder — is the same
 * shape, constructed the same way.
 */
export interface FixtureStack extends Omit<RepositoryStack, 'vault' | 'fileManager' | 'metadataCache'> {
	vault: FixtureVaultAdapter;
	fileManager: FixtureFileManager;
	metadataCache: FixtureMetadataCache;
	/** The native absolute path of the writable clone this stack was opened over. */
	root: string;
	/** Removes the clone from disk. Every caller of `openFixtureVault` owes this a call. */
	dispose(): void;
}

const DEFAULT_PROJECT_FOLDER = 'Renovation';

/**
 * `dispose()`'s one guard: refuses to `rmSync` anything that isn't genuinely under the OS
 * temp directory. `root` is always the exact string `mkdtempSync` returned three lines
 * above it, so under today's code this can never fire — but "the convention holds" is
 * exactly the claim this task's own rule-4 mutation disproved once already: pointing
 * `root` at the checked-in `tests/vault/valid-project` made `dispose()` delete it for
 * real, recovered only with `git checkout --`. `relative` rather than `startsWith`,
 * because a sibling directory sharing the temp dir's string prefix
 * (`/tmp/rp-vault-evil` against `/tmp/rp-vault-`) would pass a prefix check and must not
 * pass this one.
 */
const isUnderTempDir = (candidate: string): boolean => {
	const fromTempDir = relative(tmpdir(), candidate);
	return fromTempDir !== '' && !fromTempDir.startsWith('..') && !isAbsolute(fromTempDir);
};

/**
 * Opens `tests/vault/<caseName>` as a disk-backed repository stack: a writable temp-dir
 * CLONE of the checked-in fixture, with every collaborator `NoteVaultDeps` and the five
 * repositories need constructed over it — mirroring `createRepositoryStack` exactly, for
 * the disk-backed adapters rather than the in-memory ones.
 */
export const openFixtureVault = (caseName: string): Promise<FixtureStack> => {
	const root = mkdtempSync(join(tmpdir(), 'rp-vault-'));
	cpSync(join('tests/vault', caseName), root, { recursive: true });

	const vault = new FixtureVaultAdapter(root);
	// The cache reads the vault; the vault holds the create-window record. One direction only,
	// so this order is the only order that compiles and there is no cycle to break.
	const metadataCache = new FixtureMetadataCache(vault);
	const fileManager = new FixtureFileManager(vault);

	const index = new InMemoryProjectIndex();
	const echo = new EchoWindow();

	const logged: Line[] = [];
	const record =
		(level: LogLevel) =>
		(event: string, context?: Record<string, unknown>): void => {
			logged.push({ level, event, context });
		};
	const logger: Logger = { debug: record('debug'), info: record('info'), warn: record('warn'), error: record('error') };

	// The PLUGIN's table, not a local copy — see `createRepositoryStack`'s own comment on why
	// that distinction matters.
	const migrations = createMigrationRunner(MIGRATION_SET);
	const ledger = new InMemoryDiagnosticsLedger();

	const deps = {
		vault: vault as never,
		fileManager: fileManager as never,
		metadataCache: metadataCache as never,
		index,
		echo,
		migrations,
		logger,
		ledger,
	};
	const store = new PlanGeometryStore(vault as never, fileManager as never, index, migrations, echo);

	return Promise.resolve({
		vault,
		fileManager,
		metadataCache,
		index,
		echo,
		migrations,
		logged,
		logger,
		// Not in `RepositoryStack`'s own declared shape either — `createRepositoryStack`
		// returns it anyway, and `tests/**` is untyped, so this mirrors what that function
		// actually hands back rather than what its type happens to name.
		ledger,
		store,
		projects: new ObsidianProjectRepository(deps, DEFAULT_PROJECT_FOLDER),
		plans: new ObsidianPlanRepository(deps, store),
		zones: new ObsidianZoneRepository(deps, store),
		assets: new ObsidianAssetRepository(deps),
		requirements: new ObsidianRequirementRepository(deps),
		projectFolder: DEFAULT_PROJECT_FOLDER,
		root,
		dispose: () => {
			if (!isUnderTempDir(root)) {
				throw new Error(`Refusing to delete a path outside the OS temp directory: ${root}`);
			}
			rmSync(root, { recursive: true, force: true });
		},
		rebuildIndex() {
			index.rebuild(
				buildProjectIndexEntries({
					vault: vault as never,
					metadataCache: metadataCache as never,
					echo,
					logger,
				}),
			);
		},
	});
};
