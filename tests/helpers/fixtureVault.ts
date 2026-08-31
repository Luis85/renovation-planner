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
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { TFile, TFolder, type FileStats } from 'obsidian';
import { applyFrontmatterEdit, describeFile, fileCacheAnswer } from './vault';
import { ObsidianPlanRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianAssetRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetRepository';
import { ObsidianRequirementRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianRequirementRepository';
import { stackFoundation, type StackFoundation } from './repositoryStack';

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
/**
 * Whether `candidate` resolves inside `root` — the containment question, asked ONCE.
 *
 * `relative()` answers a path, and reading that path is where this gets subtle:
 * `startsWith('..')` is the obvious test and it is WRONG, because a legal in-root name may
 * itself begin with two dots. Measured: `..draft.md` and `..notes/file.md` are ordinary
 * filenames, and `relative(root, root + '/..draft.md')` is `'..draft.md'` — refused by the
 * naive test, though it never leaves the clone. Only an exact `..`, or a `..` followed by the
 * separator, is a step OUT.
 *
 * One function because this file asked the same question in two places and got two different
 * answers: `absolute()`'s guard and `isUnderTempDir`'s both spelled it `startsWith('..')`, and
 * both carried this defect. The commit that added the first one said, of a different pair of
 * doors, that a question worth asking at one door is a function and the moment it is spelled
 * out longhand anywhere the count of places it is missing is unknowable — and then spelled it
 * out longhand. Reported by a review bot.
 */
const containedIn = (root: string, candidate: string): boolean => {
	const fromRoot = relative(root, candidate);
	return !isAbsolute(fromRoot) && fromRoot !== '..' && !fromRoot.startsWith(`..${sep}`);
};

const fileAt = (path: string, stat?: FileStats): TFile => {
	const file = Object.assign(new TFile(), { path, ...describeFile(path) });
	if (stat !== undefined) file.stat = stat;

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
	 * Writes Obsidian's parse queue has not reached yet, mapped to what its metadata cache
	 * STILL SHOWS for that path — `null` for a file it has never seen at all.
	 *
	 * Named and shaped exactly as `FakeVault.pendingParse`, deliberately: two fakes standing
	 * in for one host object are two chances to disagree about it, and the only defence is
	 * that the second is a transcription of the first rather than a second derivation. This
	 * field was `unparsed: Map<string, string>` — the CREATE window alone — until `main`
	 * taught `FakeVault` the modify window too, at which point this adapter was thinner than
	 * its sibling and this paragraph's predecessor said so in a clause that had become false.
	 *
	 * It lives on the VAULT, exactly as `FakeVault`'s does, and that placement dissolves a
	 * construction cycle rather than working around one: the adapter records the write, and
	 * the cache needs the bytes to parse, so `FixtureMetadataCache(vault)` reads it from here
	 * and there is nothing to resolve.
	 */
	readonly pendingParse = new Map<string, string | null>();

	/** Records a write the parse queue has not reached, keeping the EARLIEST text behind it. */
	private pending(path: string, previous: string | null): void {
		if (!this.pendingParse.has(path)) this.pendingParse.set(path, previous);
	}

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
			this.pending(path, null);
			return Promise.resolve(fileAt(path, this.statOf(path)));
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
		if (!statSync(absolute).isDirectory()) return fileAt(path, this.statOf(path));

		const folder = folderAt(path);
		const prefix = path === '' ? '' : `${path}/`;
		folder.children = readdirSync(absolute, { withFileTypes: true }).map((entry) =>
			entry.isDirectory()
				? folderAt(`${prefix}${entry.name}`)
				: fileAt(`${prefix}${entry.name}`, this.statOf(`${prefix}${entry.name}`)),
		);
		return folder;
	}

	/**
	 * Mirrors `FakeVault.modify`: refuses a path that does not exist, and leaves the metadata
	 * cache STALE rather than making it current — Obsidian's queue has not reached the write,
	 * so what it shows is the PREVIOUS version of the file, not the bytes now on disk.
	 *
	 * The pre-write text is read before the write for exactly that reason. An earlier version
	 * cleared the record here instead, which modelled the opposite of production: a
	 * read-after-modify saw the new bytes immediately, so every such flow passed here while
	 * the same one observed stale frontmatter in a vault. That is the defect `main` fixed in
	 * `FakeVault` (a background written, its event published, the editor re-hydrating inside
	 * the window and reading the PRE-write reference straight back).
	 *
	 * On the VAULT, not through the cache: the record lives here, so `modify` needs no cache
	 * reference and the two objects cannot disagree about it.
	 */
	modify(file: TFile, data: string): Promise<void> {
		try {
			const absolute = this.absolute(file.path);
			if (!existsSync(absolute)) {
				throw new Error(`No file to modify: ${file.path}`);
			}
			this.pending(file.path, this.readOrUndefined(file.path) ?? null);
			writeFileSync(absolute, data, 'utf8');
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	/**
	 * A file OR a folder, because Obsidian's own `trashFile` takes any `TAbstractFile` and
	 * takes everything a folder holds. `rmSync`'s `recursive` option is that same behaviour —
	 * destructive on purpose, mirroring `FakeVault.delete`'s own header on the point.
	 * The pending-parse window IS retired here, for the path and for everything under it when
	 * the target is a folder — mirroring `FakeVault.delete`. Leaving it would be worse than a
	 * stale entry: a recreate at the same path would find a record of the deleted file's text
	 * and serve it as what the cache still shows.
	 */
	delete(file: TFile | TFolder): Promise<void> {
		try {
			const absolute = this.absolute(file.path);
			if (!existsSync(absolute)) {
				throw new Error(`No file to delete: ${file.path}`);
			}
			rmSync(absolute, { recursive: true, force: true });
			this.pendingParse.delete(file.path);
			const prefix = `${file.path}/`;
			for (const path of this.pendingParse.keys()) {
				if (path.startsWith(prefix)) this.pendingParse.delete(path);
			}
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
			// Recursive on purpose, unlike `create` above: this accepts a missing parent
			// where `create` deliberately refuses one, mirroring `FakeVault.createFolder`'s
			// own documented parity gap rather than closing it.
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
		return this.walkFiles().filter((path) => path.endsWith('.md')).map((path) => fileAt(path, this.statOf(path)));
	}

	getFiles(): TFile[] {
		return this.walkFiles().map((path) => fileAt(path, this.statOf(path)));
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
	/**
	 * The clone's real stat for a path, as Obsidian's `TFile.stat` — mirroring
	 * `FakeVault.nodeAt`, which sets `file.stat` on every file it hands out.
	 *
	 * Every `TFile` from here carried the mock's default `{ ctime: 0, mtime: 0, size: 0 }`
	 * until a review bot noticed what that costs: `fileStatAt` records `mtime:size` as the
	 * bound on `frontmatterOf`'s echo fallback, so a whole vault of files reporting `0:0`
	 * makes every pair of writes look like the same write. An external edit restoring earlier
	 * bytes would be read as this plugin's OWN echo rather than withdrawing the fallback — so
	 * a fixture-backed conflict test could pass while the real adapter preserves the external
	 * edit. A stat that type-checks and says nothing, believed by whoever reads it: the same
	 * defect `vault.ts` records for the same field, in the sibling fake.
	 *
	 * Read from disk per lookup rather than cached, for the reason the metadata cache is:
	 * a snapshot is a second place for the truth to live, and staleness is better made
	 * unrepresentable than refreshed.
	 */
	statOf(path: string): FileStats {
		const { ctimeMs, mtimeMs, size } = statSync(this.absolute(path));
		return { ctime: ctimeMs, mtime: mtimeMs, size };
	}

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
	/**
	 * The one place a vault-relative path becomes a native one — and therefore the one place
	 * that can be asked whether it is still inside the clone.
	 *
	 * `join` NORMALIZES, so a `..` segment silently walks out: measured, `join(root,
	 * '../escaped.md')` answers a sibling of the clone and `'../../etc/passwd'` answers an
	 * absolute path nowhere near it. Every read, every write and `delete`'s recursive
	 * `rmSync` resolve through here, so an escaping path is not a wrong answer — it is a real
	 * filesystem operation on somebody else's directory, under a class whose whole claim is
	 * isolation.
	 *
	 * `dispose()` already asks `isUnderTempDir` before its own `rmSync`. That guarded the door
	 * that deletes the clone and left the door that does all the other work unguarded — this
	 * repository's own recurring shape: a question worth asking at one door is a FUNCTION, and
	 * the moment it is spelled out longhand anywhere, the count of places it is missing is
	 * unknowable. This asks the stricter question of the two, because `isUnderTempDir` admits
	 * any sibling clone under `tmpdir()` and containment here means THIS root.
	 *
	 * A throw rather than a refusal: an escaping path is a defect in the caller, not a vault
	 * state a test is entitled to observe, and `''` (the vault root itself) stays legal
	 * because `nodeAt('')` looks it up.
	 */
	private absolute(vaultPath: string): string {
		const resolved = join(this.root, ...vaultPath.split('/'));
		if (!containedIn(this.root, resolved)) {
			throw new Error(`Path escapes the fixture clone: ${vaultPath}`);
		}
		return resolved;
	}
}

/**
 * Mirrors `FakeFileManager` (vault.ts:250) — the two members the repositories reach for on
 * every write and every delete.
 */
class FixtureFileManager {
	constructor(private readonly vault: FixtureVaultAdapter) {}

	processFrontMatter(file: TFile, update: (frontmatter: Record<string, unknown>) => void): Promise<void> {
		return applyFrontmatterEdit(this.vault, file, update);
	}

	/** `TAbstractFile` in Obsidian, so a folder is as ordinary an argument here as a note. */
	trashFile(file: TFile | TFolder): Promise<void> {
		return this.vault.delete(file);
	}
}

class FixtureMetadataCache {
	/**
	 * The window record lives on the VAULT (`FixtureVaultAdapter.pendingParse`), read from
	 * here — the same relationship `FakeMetadataCache` has with `FakeVault`. The cache owns no
	 * state of its own at all, which is what makes staleness unrepresentable rather than
	 * merely refreshed, and what leaves nothing for the two objects to disagree about.
	 */
	constructor(private readonly vault: FixtureVaultAdapter) {}

	/**
	 * What Obsidian's parse queue last reached for this path — never necessarily the bytes on
	 * disk. A checked-in note is visible the moment the clone lands, so no seeding pass is
	 * needed; anything this adapter has written since is answered from `pendingParse`.
	 *
	 * BOTH windows, transcribed from `FakeMetadataCache`:
	 *  - after a CREATE there is no entry at all. Answering `{}` for one made every caller
	 *    read a version-0 document, which is what `create-sample-project` hit on its first
	 *    real run.
	 *  - after a MODIFY the entry is STALE — present, and parsed from the PREVIOUS version.
	 *    This half was unmodelled here, under a comment asserting `FakeVault` did not model it
	 *    either; `main` had since taught it to, and the clause was false when the branch
	 *    merged.
	 *
	 * Three answers, not two. `null` means Obsidian has no entry for the file. A file it
	 * parsed and found NO frontmatter in answers an OBJECT whose `frontmatter` is undefined.
	 * Conflating those makes "never seen" and "the user deleted the frontmatter"
	 * indistinguishable — the exact conflation `frontmatterOf` must not make.
	 */
	getFileCache(file: TFile | TFolder | null): { frontmatter?: Record<string, unknown> } | null {
		if (file === null) return null;

		const behind = this.vault.pendingParse.get(file.path);
		return fileCacheAnswer(behind === undefined ? this.vault.readOrUndefined(file.path) : behind);
	}

	/** What Obsidian eventually does on its own, once its parse queue drains. */
	catchUp(): void {
		this.vault.pendingParse.clear();
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
export interface FixtureStack extends StackFoundation {
	projects: ObsidianProjectRepository;
	plans: ObsidianPlanRepository;
	zones: ObsidianZoneRepository;
	assets: ObsidianAssetRepository;
	requirements: ObsidianRequirementRepository;
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
	return candidate !== tmpdir() && containedIn(tmpdir(), candidate);
};

/**
 * Refuses a symlink anywhere in the clone, and does it at the ONE door the clone is made.
 *
 * `absolute()`'s containment is LEXICAL — it reads the path, not the filesystem — so a
 * symlink is contained by that test and escapes in fact: `cpSync` preserves one, and a write
 * through the cloned link lands on its target. Measured on Node 22.22.2, an absolute symlink
 * out of a fixture let a write through the clone modify a file outside it.
 *
 * **`cpSync`'s own options do not close this**, which is worth recording because it is the
 * obvious remedy and it fails: `dereference: true`, `verbatimSymlinks: false`, and both
 * together each still produced a symlink in the clone and still let the write escape — all
 * four combinations measured, all four escaped.
 *
 * So the fixture is REFUSED rather than sanitised. These are checked-in directories this
 * repository controls; a symlink in one is a mistake, not a scenario, and refusing at the
 * clone closes the class for every later operation instead of asking each of them.
 *
 * What it does NOT cover, named rather than implied: a symlink created DURING a test. Nothing
 * does today — `create` writes files and `createFolder` makes directories — and closing that
 * would mean a `realpath` syscall on every `absolute()` call, which is every read and every
 * write in every fixture-backed suite.
 */
const refuseSymlinks = (directory: string, within: string): void => {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const child = join(directory, entry.name);
		if (entry.isSymbolicLink()) {
			throw new Error(`Fixture vault contains a symlink, which cannot be cloned safely: ${relative(within, child)}`);
		}
		if (entry.isDirectory()) refuseSymlinks(child, within);
	}
};

/**
 * Opens `tests/vault/<caseName>` as a disk-backed repository stack: a writable temp-dir
 * CLONE of the checked-in fixture, with every collaborator `NoteVaultDeps` and the five
 * repositories need constructed over it — mirroring `createRepositoryStack` exactly, for
 * the disk-backed adapters rather than the in-memory ones.
 */
export const openFixtureVault = (caseName: string): Promise<FixtureStack> => {
	const root = mkdtempSync(join(tmpdir(), 'rp-vault-'));
	// Everything between `mkdtempSync` and the returned stack owns the clone with no `dispose()`
	// yet reachable: a caller that never receives a stack cannot dispose of one. A missing
	// fixture makes `cpSync` throw and a symlinked one makes `refuseSymlinks` throw, and either
	// would otherwise strand an `rp-vault-*` directory in the system temp dir — once per run of
	// the very conformance case that asserts the refusal. Reported by a review bot.
	try {
		cpSync(join('tests/vault', caseName), root, { recursive: true });
		refuseSymlinks(root, root);
	} catch (cause) {
		rmSync(root, { recursive: true, force: true });
		throw cause;
	}

	const vault = new FixtureVaultAdapter(root);
	// The cache reads the vault; the vault holds the create-window record. One direction only,
	// so this order is the only order that compiles and there is no cycle to break.
	const metadataCache = new FixtureMetadataCache(vault);
	const fileManager = new FixtureFileManager(vault);
	const base = stackFoundation({ vault, fileManager, metadataCache }, DEFAULT_PROJECT_FOLDER);

	// The five repositories are constructed here rather than inside `stackFoundation`, for the
	// reason `createRepositoryStack`'s own docblock measures: fallow cannot resolve a class's
	// members through a field inherited from another module, and building them there reported
	// eleven live repository methods as dead code.
	return Promise.resolve({
		vault,
		fileManager,
		metadataCache,
		...base,
		projects: new ObsidianProjectRepository(base.deps, DEFAULT_PROJECT_FOLDER),
		plans: new ObsidianPlanRepository(base.deps, base.store),
		zones: new ObsidianZoneRepository(base.deps, base.store),
		assets: new ObsidianAssetRepository(base.deps),
		requirements: new ObsidianRequirementRepository(base.deps),
		root,
		dispose: () => {
			if (!isUnderTempDir(root)) {
				throw new Error(`Refusing to delete a path outside the OS temp directory: ${root}`);
			}
			rmSync(root, { recursive: true, force: true });
		},
	});
};
