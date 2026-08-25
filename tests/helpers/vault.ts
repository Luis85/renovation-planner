import { TFile as MockTFile, type TFile } from 'obsidian';
import type { LogLevel } from '../../src/application/ports/Logger';
import { serializeFrontmatter } from '../../src/infrastructure/obsidian/repositories/noteIo';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { EchoWindow } from '../../src/infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { createMigrationRunner, type MigrationRunner } from '../../src/infrastructure/persistence/migration/MigrationRunner';
import { PLAN_MIGRATIONS } from '../../src/infrastructure/persistence/migration/entities/plan/plan.migrations';
import { ZONE_MIGRATIONS } from '../../src/infrastructure/persistence/migration/entities/zone/zone.migrations';
import { PROJECT_MIGRATIONS } from '../../src/infrastructure/persistence/migration/project/project.migrations';
import { PLAN_GEOMETRY_MIGRATIONS } from '../../src/infrastructure/persistence/migration/geometry/plan/plan-geometry.migrations';
import { ObsidianPlanRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { PlanGeometryStore } from '../../src/infrastructure/obsidian/repositories/PlanGeometryStore';
import type { Line, Logger } from './logger';

/**
 * A vault that BEHAVES like files rather than like a call log: create refuses on an
 * existing path, read refuses on a missing one, delete refuses on a missing one, and
 * every operation is observable through `files`. Not kinder than the real thing — that
 * is the point.
 */
class FakeVault {
	readonly entries = new Map<string, string>();
	private readonly folders = new Set<string>();

	/**
	 * Paths this fake has created and Obsidian has not parsed yet, mapped to the exact text
	 * that was written — see `FakeMetadataCache`, which is where this is the difference
	 * between the suite and a real vault.
	 *
	 * The TEXT and not just the path, because that is what bounds the window honestly: a
	 * note whose bytes have changed since we created it is a note something else touched,
	 * and anything the outside world does to a file is something Obsidian has parsed. So
	 * the cache goes blind for exactly one thing — a file this plugin just created and
	 * nobody has looked at since — which is the case that produced a real defect.
	 */
	readonly unparsed = new Map<string, string>();

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

	getAbstractFileByPath(path: string): TFile | null {
		if (!this.entries.has(path)) return null;
		const segments = path.split('/');
		const file = new MockTFile();
		file.path = path;
		file.name = segments.at(-1) ?? '';
		file.basename = (segments.at(-1) ?? '').replace(/\.[^.]+$/, '');
		file.extension = path.includes('.') ? (path.split('.').at(-1) ?? '') : '';
		return file;
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
			this.entries.set(path, data);
			this.unparsed.set(path, data);
			return Promise.resolve(this.getAbstractFileByPath(path) as TFile);
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	modify(file: TFile, data: string): Promise<void> {
		try {
			this.op('modify', file.path);
			if (!this.entries.has(file.path)) throw new Error(`No file to modify: ${file.path}`);
			this.entries.set(file.path, data);
			// A modify makes the path CACHE-VISIBLE, and that is where this fake is still
			// kinder than Obsidian — see `FakeMetadataCache`. It models the create window,
			// which is the one that produced a real defect, and not the parse lag after
			// every write.
			this.unparsed.delete(file.path);
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	delete(file: TFile): Promise<void> {
		try {
			this.op('delete', file.path);
			if (!this.entries.has(file.path)) throw new Error(`No file to delete: ${file.path}`);
			this.entries.delete(file.path);
			return Promise.resolve();
		} catch (cause) {
			return Promise.reject(cause);
		}
	}

	createFolder(path: string): Promise<void> {
		try {
			this.op('createFolder', path);
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

	trashFile(file: TFile): Promise<void> {
		return this.vault.delete(file);
	}
}

class FakeMetadataCache {
	constructor(private readonly vault: FakeVault) {}

	getFileCache(file: TFile): { frontmatter?: Record<string, unknown> } | null {
		// NOT kinder than the real thing, and this is the half that used to be. Obsidian
		// parses a new file into its metadata cache ASYNCHRONOUSLY, so a note read back in
		// the same tick it was created has NO cache entry at all. Parsing the vault's own
		// text synchronously made every read-after-write succeed in the suite and fail in a
		// vault — which is exactly what `create-sample-project` did on its first run in
		// Obsidian: the project note was written, `CreatePlanCommand` read it back to
		// validate the reference, got no frontmatter, and reported a migration failure.
		// What this models and what it does NOT, because the second half matters: it models
		// the window after a CREATE, where Obsidian has no entry for the file at all. It
		// does not model the parse lag after a MODIFY, where Obsidian has a STALE entry
		// rather than none — a different failure, which `frontmatterOf`'s echo fallback
		// cannot detect and does not claim to.
		const asCreated = this.vault.unparsed.get(file.path);
		if (asCreated !== undefined && asCreated === this.vault.entries.get(file.path)) return null;
		const text = this.vault.entries.get(file.path);
		// `CachedMetadata | null`, as the real signature says, and the two are NOT the same
		// answer: null means Obsidian has no entry for the file, while a file it parsed and
		// found no frontmatter in answers an OBJECT whose `frontmatter` is undefined. This
		// fake used to answer null for both, which made "never seen" and "frontmatter
		// deleted" indistinguishable — the exact conflation `frontmatterOf` must not make.
		if (text === undefined) return null;
		if (!text.startsWith('---\n')) return {};
		return { frontmatter: parseFrontmatter(text).frontmatter };
	}

	/** What Obsidian eventually does on its own, once its parse queue drains. */
	catchUp(): void {
		this.vault.unparsed.clear();
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

	const migrations = createMigrationRunner({
		project: PROJECT_MIGRATIONS,
		plan: PLAN_MIGRATIONS,
		zone: ZONE_MIGRATIONS,
		'plan-geometry': PLAN_GEOMETRY_MIGRATIONS,
	});

	const deps = {
		vault: vault as never,
		fileManager: fileManager as never,
		metadataCache: metadataCache as never,
		index,
		echo,
		migrations,
		logger,
		projectFolder,
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
		store,
		projects: new ObsidianProjectRepository(deps),
		plans: new ObsidianPlanRepository(deps, store),
		zones: new ObsidianZoneRepository(deps, store),
		projectFolder,
		rebuildIndex() {
			index.rebuild(
				buildProjectIndexEntries({
					vault: vault as never,
					metadataCache: metadataCache as never,
					echo,
					logger,
					projectFolder,
				}),
			);
		},
	};
}
