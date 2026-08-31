import { TFile as MockTFile, TFolder as MockTFolder, type FileStats, type TFile } from 'obsidian';
import { serializeFrontmatter } from '../../src/infrastructure/obsidian/repositories/noteIo';
import { ObsidianPlanRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianPlanRepository';
import { ObsidianProjectRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianProjectRepository';
import { ObsidianZoneRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianZoneRepository';
import { ObsidianAssetRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianAssetRepository';
import { ObsidianRequirementRepository } from '../../src/infrastructure/obsidian/repositories/ObsidianRequirementRepository';
import { stackFoundation, type StackFoundation } from './repositoryStack';

/**
 * The three fields Obsidian derives from a note's path, as ONE derivation.
 *
 * Both fakes construct `TFile`s and both derived these by hand, which had already drifted:
 * one spelled the extension strip `/\.[^.]+$/u` and the other `/\.[^.]+$/`. Equivalent
 * today, and the kind of difference that stops being equivalent without anything failing.
 */
export const describeFile = (path: string): { name: string; basename: string; extension: string } => {
	const last = path.split('/').at(-1) ?? '';

	return {
		name: last,
		basename: last.replace(/\.[^.]+$/u, ''),
		extension: path.includes('.') ? (path.split('.').at(-1) ?? '') : '',
	};
};

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

	/**
	 * Creation times, off the same counter, and NOT a synonym for the modification time.
	 *
	 * `ctime` is stamped by the first write to a path and left alone by every later one, so a
	 * file that has been modified reports `ctime < mtime` the way a real one does. Returning
	 * the mtime for both would be the defect the paragraph above already refuses in a second
	 * spelling: a field that type-checks and says nothing, believed by whoever reads it.
	 *
	 * The bound the mtime paragraph states applies here too — a counter cannot produce the
	 * same-tick collision a real clock's finite granularity can, so a file created and
	 * modified inside one tick reports two distinct values where a filesystem may report one.
	 */
	private readonly ctimes = new Map<string, number>();
	private clock = 0;

	/**
	 * Typed as Obsidian's own `FileStats` rather than as the shape it happens to return.
	 *
	 * The literal `{ mtime: number; size: number }` compiled for as long as nothing
	 * type-checked this file, and stopped compiling the moment slice 12's `*.test-d.ts` pulled
	 * it into `tsconfig.json`'s program — `ctime` is required and was absent. Naming the real
	 * interface is what makes the COMPILER answer for the next member Obsidian adds, rather
	 * than a reader noticing.
	 */
	statOf(path: string): FileStats {
		return {
			ctime: this.ctimes.get(path) ?? 0,
			mtime: this.mtimes.get(path) ?? 0,
			size: (this.get(path) ?? '').length,
		};
	}

	/** Stamps the creation time on a path's FIRST write and leaves it alone thereafter. */
	private touch(path: string): void {
		const now = ++this.clock;
		if (!this.ctimes.has(path)) this.ctimes.set(path, now);
		this.mtimes.set(path, now);
	}

	override set(path: string, text: string): this {
		this.onOutsideWrite(path);
		this.touch(path);
		return super.set(path, text);
	}

	/** `FakeVault`s own writers, which record their own parse-lag entry and must not retire it. */
	setOwn(path: string, text: string): void {
		this.touch(path);
		super.set(path, text);
	}

	/**
	 * Removing the bytes removes the STATS with them, and it is an override rather than a
	 * cleanup at each caller for the reason `touch` is one function: a path's records live
	 * here, so the object that owns them is the object that must forget them.
	 *
	 * Without this the `ctime` of a deleted path outlived it, and `touch`'s first-write rule
	 * then handed the RECREATED file its predecessor's creation time — measured, a fresh
	 * create reporting `ctime: 1` against `mtime: 2`, which is a file claiming to have been
	 * modified after it was created and before it existed. No real filesystem answers that,
	 * and a fake that does is the exact "believed by whoever reads it" defect the paragraph
	 * above records for this field. Reported by a review bot.
	 */
	override delete(path: string): boolean {
		this.mtimes.delete(path);
		this.ctimes.delete(path);
		return super.delete(path);
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
			const file = Object.assign(new MockTFile(), { path, ...describeFile(path) });
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

/** The half of `processFrontMatter` that is the same over either vault: values in, body intact. */
export const applyFrontmatterEdit = async (
	vault: { read(file: TFile): Promise<string>; modify(file: TFile, text: string): Promise<void> },
	file: TFile,
	update: (frontmatter: Record<string, unknown>) => void,
): Promise<void> => {
	const text = await vault.read(file);
	const { frontmatter, body } = parseFrontmatter(text);
	update(frontmatter);
	await vault.modify(file, `${serializeFrontmatter(frontmatter)}${body}`);
};

/**
 * What `getFileCache` answers for the text the parse queue last reached — THREE answers, not
 * two, stated once for both fakes.
 *
 * `null` means Obsidian has no entry for the file. A file it parsed and found NO frontmatter
 * in answers an OBJECT whose `frontmatter` is undefined. Conflating those makes "never seen"
 * and "the user deleted the frontmatter" indistinguishable — the exact conflation
 * `frontmatterOf` must not make, and the one both fakes carry a paragraph about.
 */
export const fileCacheAnswer = (seen: string | null | undefined): { frontmatter?: Record<string, unknown> } | null => {
	if (seen === undefined || seen === null) return null;
	if (!seen.startsWith('---\n')) return {};

	return { frontmatter: parseFrontmatter(seen).frontmatter };
};

class FakeFileManager {
	constructor(private readonly vault: FakeVault) {}

	/**
	 * The real method parses the note's frontmatter, hands it to the callback, merges
	 * whatever the callback leaves in back under the same delimiters, and keeps the body.
	 * This fake does the observable half: values in, body intact.
	 */
	processFrontMatter(file: TFile, update: (frontmatter: Record<string, unknown>) => void): Promise<void> {
		return applyFrontmatterEdit(this.vault, file, update);
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
		return fileCacheAnswer(seen);
	}

	/** What Obsidian eventually does on its own, once its parse queue drains. */
	catchUp(): void {
		this.vault.catchUp();
	}
}

/**
 * The in-memory stack: `RepositoryStackCore` over `FakeVault` and its two siblings. Every
 * member but these three is shared with `openFixtureVault`'s disk-backed stack and is
 * declared once, in `repositoryStack.ts`.
 */
export interface RepositoryStack extends StackFoundation {
	projects: ObsidianProjectRepository;
	plans: ObsidianPlanRepository;
	zones: ObsidianZoneRepository;
	assets: ObsidianAssetRepository;
	requirements: ObsidianRequirementRepository;
	vault: FakeVault;
	fileManager: FakeFileManager;
	metadataCache: FakeMetadataCache;
}

export type { FakeVault, FakeFileManager, FakeMetadataCache };

/**
 * The five repositories are constructed by each stack rather than by `stackFoundation`, and
 * that line is drawn by a MEASUREMENT rather than by taste.
 *
 * Fallow resolves a class's members through the annotation in the file where the consuming
 * expression sits, and it does not follow a field through an `extends` into another module.
 * Building them in the shared function took `npm run analyze` from clean to ELEVEN
 * `unused-class-members` findings — `getById`, `save`, `delete`, `listAll`, `listByPlan` and
 * `listByProject` across the three note repositories, every one a method whose only call
 * sites are tests. Redeclaring the fields on both stack interfaces recovered three and left
 * eight; nothing short of the `new` expression living here recovered all eleven.
 *
 * The cost is five constructor calls in each of two files, against the eighty-odd lines the
 * foundation shares. What made the duplication dangerous is gone either way: `deps` and
 * `store` are built in one place, so the ARGUMENTS cannot drift.
 */
export function createRepositoryStack(projectFolder = 'Renovation'): RepositoryStack {
	const vault = new FakeVault();
	const fileManager = new FakeFileManager(vault);
	const metadataCache = new FakeMetadataCache(vault);
	const base = stackFoundation({ vault, fileManager, metadataCache }, projectFolder);

	return {
		vault,
		fileManager,
		metadataCache,
		...base,
		projects: new ObsidianProjectRepository(base.deps, projectFolder),
		plans: new ObsidianPlanRepository(base.deps, base.store),
		zones: new ObsidianZoneRepository(base.deps, base.store),
		assets: new ObsidianAssetRepository(base.deps),
		requirements: new ObsidianRequirementRepository(base.deps),
	};
}
