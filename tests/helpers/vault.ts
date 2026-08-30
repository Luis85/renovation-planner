import { TFile as MockTFile, TFolder as MockTFolder, type TFile } from 'obsidian';
import type { LogLevel } from '../../src/application/ports/Logger';
import { serializeFrontmatter } from '../../src/infrastructure/obsidian/repositories/noteIo';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { EchoWindow } from '../../src/infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { InMemoryDiagnosticsLedger } from '../../src/infrastructure/logging/diagnosticsLedger';
import { createMigrationRunner, type MigrationRunner } from '../../src/infrastructure/persistence/migration/MigrationRunner';
import { MIGRATION_SET } from '../../src/infrastructure/persistence/migration/migrationSet';
import { ObsidianPlanRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianAssetRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetRepository';
import { ObsidianRequirementRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianRequirementRepository';
import { PlanGeometryStore } from '../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import type { Line, Logger } from './logger';

/**
 * The vault's bytes, as a `Map` that also knows when a write came from OUTSIDE the plugin.
 *
 * A test putting bytes straight into this map stands for the outside world — a hand edit, a
 * synced note, content that was already there — and anything the outside world does to a
 * file is something Obsidian parses. So a direct `set` retires whatever the parse queue was
 * still behind on for that path, which is what keeps `pendingParse` a model of THIS
 * plugin's own write window rather than of the whole cache. `FakeVault`'s own writers record
 * their pending entry AFTER calling through here, for exactly that reason.
 */
class VaultEntries extends Map<string, string> {
	constructor(private readonly onOutsideWrite: (path: string) => void) {
		super();
	}

	/**
	 * Modification times, as a monotonic counter rather than a clock.
	 *
	 * The mock `TFile` has carried a `stat` field since it was written and it was always
	 * `{ mtime: 0, size: 0 }` — a field that type-checks and says nothing, which is worse
	 * than an absent one because a reader believes it. It is populated now, because
	 * `frontmatterOf` asks whether a file has changed since this plugin wrote it.
	 *
	 * **A counter is KINDER than a real filesystem in exactly one way, and it is written
	 * down rather than hidden**: every write here changes the mtime, where a real clock has
	 * finite granularity and two writes inside one tick can share one. So the same-tick
	 * collision is a case this fake cannot produce, and the guard reading these values
	 * states that as its own bound rather than claiming to be proof.
	 */
	private readonly mtimes = new Map<string, number>();
	private clock = 0;

	statOf(path: string): { mtime: number; size: number } {
		return { mtime: this.mtimes.get(path) ?? 0, size: (this.get(path) ?? '').length };
	}

	override set(path: string, text: string): this {
		this.onOutsideWrite(path);
		this.mtimes.set(path, ++this.clock);
		return super.set(path, text);
	}

	/** `FakeVault`s own writers, which record their own parse-lag entry and must not retire it. */
	setOwn(path: string, text: string): void {
		this.mtimes.set(path, ++this.clock);
		super.set(path, text);
	}
}

/**
 * A vault that BEHAVES like files rather than like a call log: create refuses on an
 * existing path, read refuses on a missing one, delete refuses on a missing one, and
 * every operation is observable through `files`. Not kinder than the real thing — that
 * is the point.
 */
class FakeVault {
	readonly entries = new VaultEntries((path) => this.pendingParse.delete(path));
	private readonly folders = new Set<string>();

	/**
	 * Writes Obsidian's parse queue has not reached yet, mapped to what its metadata cache
	 * still shows for that path — `null` for a file it has never seen at all.
	 *
	 * This is what makes the fake honest about a cache that is populated ASYNCHRONOUSLY, and
	 * it models BOTH windows (see `FakeMetadataCache`): a CREATE leaves `null`, so the cache
	 * has no entry; a MODIFY leaves the PREVIOUS text, so the cache answers a stale one. A
	 * second write before the queue drains keeps the earliest recorded text, because the
	 * cache is behind both.
	 *
	 * Only writes made THROUGH this fake are recorded. Bytes a test puts straight into
	 * `entries` stand for vault content that was already there, and anything the outside
	 * world does to a file is something Obsidian has parsed — so those stay visible, which
	 * is what keeps this a model of the write window rather than of the whole cache.
	 */
	readonly pendingParse = new Map<string, string | null>();

	/** Obsidian's parse queue draining: every write becomes visible to the cache. */
	catchUp(): void {
		this.pendingParse.clear();
	}

	/** Records a write the parse queue has not reached, keeping the earliest text behind it. */
	private pending(path: string, previous: string | null): void {
		if (!this.pendingParse.has(path)) this.pendingParse.set(path, previous);
	}

	/** Injected failures, keyed `<op>:<path>` — how compensation paths are driven red. */
	readonly failures = new Set<string>();
	failedOps: string[] = [];

	/**
	 * Every operation this fake performed, in order, as `<op>:<path>` — the instrument for
	 * asserting how MANY vault reads a repository call costs.
	 *
	 * A count is otherwise invisible: `listByPlan` re-read, re-parsed and re-validated the
	 * whole plan geometry sidecar once per zone, so reflecting one changed zone was O(N)
	 * file reads and O(N²) point validations, and the editor's post-command refresh pays
	 * that on every drag release, drawn polygon, delete and Undo press. Every test passed
	 * throughout, because a correct answer arrived either way.
	 */
	readonly operations: string[] = [];

	/**
	 * A `TFile` for a path that is a note, a `TFolder` for a path Obsidian would know as a
	 * folder — one that was `createFolder`ed, or one something already lives in
	 * (`folderExists`) — and `null` for neither. It used to answer `null` for every folder,
	 * which never resolves a real folder at all: `freshProjectFolder`'s collision arm asks
	 * this exact question, and a fake that cannot answer "yes, a folder is already there"
	 * would pass the suite while doing nothing in a real vault. Files are checked first,
	 * because a path cannot be both — `entries` and `folders` are disjoint namespaces here
	 * as they are in Obsidian.
	 *
	 * The vault ROOT (`''`) resolves to a folder too, deliberately, rather than being a
	 * second case this method disagrees with `folderExists` about: `folderExists('')` has
	 * always answered `true` (the root always "exists"), and a fake where one method treats
	 * the root as a folder while its sibling treats the identical path as nothing is the
	 * thin-fake shape this repository has been burned by more than once. Real Obsidian
	 * resolves the root to its `TFolder` as well.
	 *
	 * A returned folder carries its DIRECT `children`, which is the same rule read once more:
	 * `MockTFolder` declares the field and this fake left it permanently `[]`, so every folder
	 * in the suite read as empty. `undoEnsureFolder` refuses to trash a folder something else
	 * has filled — the one thing standing between a failed insert and Obsidian's recursive
	 * `trashFile` — and against an always-empty fake that refusal could never be driven, nor
	 * could dropping it ever turn a test red. One level deep and rebuilt per call: nothing here
	 * holds a folder across a mutation, and a recursive build would walk the whole tree for
	 * every path lookup a repository makes.
	 */
	getAbstractFileByPath(path: string): TFile | MockTFolder | null {
		return this.nodeAt(path, true);
	}

	private nodeAt(path: string, withChildren: boolean): TFile | MockTFolder | null {
		if (this.entries.has(path)) {
			const segments = path.split('/');
			const file = new MockTFile();
			file.path = path;
			file.name = segments.at(-1) ?? '';
			file.basename = (segments.at(-1) ?? '').replace(/\.[^.]+$/, '');
			file.extension = path.includes('.') ? (path.split('.').at(-1) ?? '') : '';
			file.stat = this.entries.statOf(path);
			return file;
		}
		if (this.folderExists(path)) {
			const segments = path.split('/');
			const folder = new MockTFolder();
			folder.path = path;
			folder.name = segments.at(-1) ?? '';
			if (withChildren) {
				const prefix = path === '' ? '' : `${path}/`;
				folder.children = [...this.childNames(prefix)].flatMap((name) => this.nodeAt(`${prefix}${name}`, false) ?? []);
			}
			return folder;
		}
		return null;
	}

	/** The direct child NAMES under a path prefix, from both namespaces at once. */
	private childNames(prefix: string): Set<string> {
		const names = new Set<string>();
		for (const entry of [...this.entries.keys(), ...this.folders]) {
			if (!entry.startsWith(prefix)) continue;
			const rest = entry.slice(prefix.length);
			if (rest === '') continue;
			names.add(rest.split('/')[0] ?? '');
		}
		return names;
	}

	// The fake mirrors Obsidian's async API: failures REJECT, never throw synchronously,
	// which is what callers' try/catch blocks are written against.
	/**
	 * A folder Obsidian would know about: one that was created, or one something already
	 * lives in. The second half is what keeps a planted note (`entries.set`, the suite's way
	 * of saying "this was already in the vault") from needing its folders declared too.
	 */
	private folderExists(folder: string): boolean {
		if (folder === '') return true;
		if (this.folders.has(folder)) return true;
		const prefix = `${folder}/`;
		for (const path of this.entries.keys()) if (path.startsWith(prefix)) return true;
		return false;
	}

	create(path: string, data: string): Promise<TFile> {
		try {
			this.op('create', path);
			// Obsidian REFUSES a create whose parent folder does not exist, and this fake used
			// to accept it — which is how the geometry sidecar shipped with no `ensureFolder`
			// in front of it: every test passed and a real vault answered "the sidecar could
			// not be created" on the first plan ever saved.
			const parent = path.slice(0, Math.max(path.lastIndexOf('/'), 0));
			if (!this.folderExists(parent)) throw new Error(`Folder does not exist: ${parent}`);
			if (this.entries.has(path)) throw new Error(`File already exists: ${path}`);
			// Ours, so it RECORDS its own parse-lag entry rather than retiring one: the cache has
			// never seen this path. See `VaultEntries`.
			this.pending(path, null);
			this.entries.setOwn(path, data);
			return Promise.resolve(this.getAbstractFileByPath(path) as TFile);
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	modify(file: TFile, data: string): Promise<void> {
		try {
			this.op('modify', file.path);
			if (!this.entries.has(file.path)) throw new Error(`No file to modify: ${file.path}`);
			// Keeps whatever the cache was already behind on — a modify inside the create window
			// leaves it with no entry at all, not with a text it never parsed.
			this.pending(file.path, this.entries.get(file.path) as string);
			this.entries.setOwn(file.path, data);
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	/**
	 * A file OR a folder, because Obsidian's own `trashFile` takes any `TAbstractFile` and this
	 * fake modelled only half of that. The folder arm is DESTRUCTIVE on purpose — Obsidian
	 * takes everything inside — since that is precisely the behaviour `undoEnsureFolder`'s
	 * emptiness check exists to stay clear of, and a fake that politely refused a non-empty
	 * folder would make dropping that check invisible.
	 */
	delete(file: TFile | MockTFolder): Promise<void> {
		try {
			this.op('delete', file.path);
			if (this.entries.has(file.path)) {
				this.entries.delete(file.path);
				this.pendingParse.delete(file.path);
				return Promise.resolve();
			}
			if (!this.folderExists(file.path)) throw new Error(`No file to delete: ${file.path}`);
			const prefix = `${file.path}/`;
			// Deleting during iteration is safe for both: a `Map`/`Set` iterator skips an entry
			// removed before it is reached, and nothing here removes an entry it has not visited.
			for (const path of this.entries.keys()) if (path.startsWith(prefix)) { this.entries.delete(path); this.pendingParse.delete(path); }
			for (const path of this.folders) if (path === file.path || path.startsWith(prefix)) this.folders.delete(path);
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	createFolder(path: string): Promise<void> {
		try {
			this.op('createFolder', path);
			if (this.folderExists(path)) throw new Error(`Folder already exists: ${path}`);
			this.folders.add(path);
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	read(file: TFile): Promise<string> {
		try {
			this.op('read', file.path);
			const data = this.entries.get(file.path);
			if (data === undefined) throw new Error(`No file to read: ${file.path}`);
			return Promise.resolve(data);
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	cachedRead(file: TFile): Promise<string> {
		return this.read(file);
	}

	getMarkdownFiles(): TFile[] {
		return [...this.entries.keys()]
			.filter((path) => path.endsWith('.md'))
			.map((path) => this.getAbstractFileByPath(path))
			.filter((f): f is TFile => f !== null);
	}

	getFiles(): TFile[] {
		return [...this.entries.keys()]
			.map((path) => this.getAbstractFileByPath(path))
			.filter((f): f is TFile => f !== null);
	}

	readBinary(): Promise<ArrayBuffer> {
		throw new Error('not implemented by the fake');
	}

	getResourcePath(): string {
		return '';
	}

	on(): { off(): void } {
		return { off: () => undefined };
	}

	private op(name: string, path: string): void {
		this.operations.push(`${name}:${path}`);
		if (this.failures.has(`${name}:${path}`)) {
			this.failedOps.push(`${name}:${path}`);
			throw new Error(`Injected failure: ${name} ${path}`);
		}
	}
}

/**
 * Frontmatter as the plugin writes it (serializeFrontmatter), parsed back — the same
 * round trip Obsidian's own YAML layer performs, over exactly the shapes this plugin
 * emits. Body text survives untouched, which is what makes body-preservation assertions
 * meaningful.
 */
export { serializeFrontmatter };

export function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } {
	if (!text.startsWith('---\n')) return { frontmatter: {}, body: text };
	const end = text.indexOf('\n---', 4);
	const header = text.slice(4, end);
	const body = text.slice(end + 4).replace(/^\n/, '');
	const frontmatter: Record<string, unknown> = {};
	let currentKey: string | null = null;
	for (const line of header.split('\n')) {
		if (line.startsWith('  - ')) {
			const list = frontmatter[currentKey ?? ''];
			if (Array.isArray(list)) list.push(JSON.parse(line.slice(4)));
			continue;
		}
		const cut = line.indexOf(':');
		if (cut === -1) continue;
		const key = line.slice(0, cut).replace(/^"|"$/g, '');
		currentKey = key;
		const raw = line.slice(cut + 1).trim();
		if (raw === '') frontmatter[key] = [];
		else if (raw === 'null') frontmatter[key] = null;
		else if (/^-?\d+(\.\d+)?$/.test(raw)) frontmatter[key] = Number(raw);
		else if (raw.startsWith('[') || raw.startsWith('{')) frontmatter[key] = JSON.parse(raw);
		else if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
			frontmatter[key] = raw.slice(1, -1);
		} else frontmatter[key] = raw;
	}
	return { frontmatter, body };
}

class FakeFileManager {
	constructor(private readonly vault: FakeVault) {}

	/**
	 * The real method parses the note's frontmatter, hands it to the callback, merges
	 * whatever the callback leaves in back under the same delimiters, and keeps the body.
	 * This fake does the observable half: values in, body intact.
	 */
	async processFrontMatter(
		file: TFile,
		update: (frontmatter: Record<string, unknown>) => void,
	): Promise<void> {
		const text = await this.vault.read(file);
		const { frontmatter, body } = parseFrontmatter(text);
		update(frontmatter);
		await this.vault.modify(file, `${serializeFrontmatter(frontmatter)}${body}`);
	}

	/** `TAbstractFile` in Obsidian, so a folder is as ordinary an argument here as a note. */
	trashFile(file: TFile | MockTFolder): Promise<void> {
		return this.vault.delete(file);
	}
}

class FakeMetadataCache {
	constructor(private readonly vault: FakeVault) {}

	getFileCache(file: TFile): { frontmatter?: Record<string, unknown> } | null {
		// NOT kinder than the real thing, and this fake has been corrected twice for that
		// one rule. Obsidian's metadata cache is populated ASYNCHRONOUSLY, so what it
		// answers is the text its parse queue last reached — never necessarily the bytes on
		// disk. Two windows follow, and this models BOTH of them:
		//
		//  - after a CREATE there is no entry at all, and answering `{}` for one made every
		//    caller read a version-0 document. That is what `create-sample-project` hit on
		//    its first real run: the project note was written, `CreatePlanCommand` read it
		//    back to validate the reference, and the migration runner reported a chain gap.
		//  - after a MODIFY the entry is STALE — present, and parsed from the PREVIOUS
		//    version of the file. This half was unmodelled, under a comment saying so, and
		//    it hid a shipped defect: `SetPlanBackground` wrote the reference and published
		//    its event, the Plan Editor re-hydrated inside the window, and the query read
		//    the pre-write frontmatter straight back — so the canvas drew no background at
		//    all until something re-read the note much later. Every read-after-modify in
		//    the suite passed throughout.
		//
		// `pendingParse` holds the writes the queue has not reached and what the cache still
		// shows for them; anything else is answered from disk. `catchUp()` drains the queue.
		const behind = this.vault.pendingParse.get(file.path);
		const seen = behind === undefined ? this.vault.entries.get(file.path) : behind;
		if (seen === undefined || seen === null) return null;
		// `CachedMetadata | null`, as the real signature says, and the two are NOT the same
		// answer: null means Obsidian has no entry for the file, while a file it parsed and
		// found no frontmatter in answers an OBJECT whose `frontmatter` is undefined. This
		// fake used to answer null for both, which made "never seen" and "frontmatter
		// deleted" indistinguishable — the exact conflation `frontmatterOf` must not make.
		if (!seen.startsWith('---\n')) return {};
		return { frontmatter: parseFrontmatter(seen).frontmatter };
	}

	/** What Obsidian eventually does on its own, once its parse queue drains. */
	catchUp(): void {
		this.vault.catchUp();
	}
}

export interface RepositoryStack {
	vault: FakeVault;
	fileManager: FakeFileManager;
	metadataCache: FakeMetadataCache;
	index: InMemoryProjectIndex;
	echo: EchoWindow;
	migrations: MigrationRunner;
	logged: Line[];
	logger: Logger;
	store: PlanGeometryStore;
	projects: ObsidianProjectRepository;
	plans: ObsidianPlanRepository;
	zones: ObsidianZoneRepository;
	assets: ObsidianAssetRepository;
	requirements: ObsidianRequirementRepository;
	/**
	 * The default root the stack was constructed with — `createRepositoryStack`'s own
	 * argument, echoed back for a caller that needs it. Under ADR-0013 this is no longer a
	 * per-project field any of the five note-backed repositories read: `ObsidianProjectRepository`
	 * is the only one that still takes it directly (Task 5's `newProjectRoot`), because it is
	 * the one repository that ever writes a note whose folder does not already exist to be
	 * derived from. Every other project's folder is `projectFolderOf`'s to answer.
	 */
	projectFolder: string;
	/** Rebuilds the index from the vault contents — the scan the plugin runs at load. */
	rebuildIndex(): void;
}

export type { FakeVault, FakeFileManager, FakeMetadataCache };

export function createRepositoryStack(projectFolder = 'Renovation'): RepositoryStack {
	const vault = new FakeVault();
	const fileManager = new FakeFileManager(vault);
	const metadataCache = new FakeMetadataCache(vault);
	const index = new InMemoryProjectIndex();
	const echo = new EchoWindow();

	// A per-stack recorder, so a suite can assert on its OWN stack's diagnostics without
	// racing the shared module-scope recorder the plugin suites use.
	const logged: Line[] = [];
	const record =
		(level: LogLevel) =>
		(event: string, context?: Record<string, unknown>): void => {
			logged.push({ level, event, context });
		};
	const logger: Logger = { debug: record('debug'), info: record('info'), warn: record('warn'), error: record('error') };

	// The PLUGIN's table, not a copy of it. This used to be four kinds hand-written here
	// while the composition root registered six — a fake thinner than the real thing, so
	// every repository test drove a runner that had never heard of an Asset or a
	// Requirement. Sharing the constant is what makes the drift impossible rather than
	// merely fixed.
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

	return {
		vault,
		fileManager,
		metadataCache,
		index,
		echo,
		migrations,
		logged,
		logger,
		ledger,
		store,
		projects: new ObsidianProjectRepository(deps, projectFolder),
		plans: new ObsidianPlanRepository(deps, store),
		zones: new ObsidianZoneRepository(deps, store),
		assets: new ObsidianAssetRepository(deps),
		requirements: new ObsidianRequirementRepository(deps),
		projectFolder,
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
	};
}
