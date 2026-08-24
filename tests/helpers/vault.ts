import type { TFile } from 'obsidian';
import type { LogLevel } from '../../src/application/ports/Logger';
import { serializeFrontmatter } from '../../src/infrastructure/obsidian/repositories/noteIo';
import { buildProjectIndexEntries } from '../../src/infrastructure/persistence/index/buildProjectIndexEntries';
import { EchoWindow } from '../../src/infrastructure/persistence/index/EchoWindow';
import { InMemoryProjectIndex } from '../../src/infrastructure/persistence/index/InMemoryProjectIndex';
import { MigrationRunner } from '../../src/infrastructure/persistence/migration/MigrationRunner';
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
export class FakeVault {
	readonly entries = new Map<string, string>();
	private readonly folders = new Set<string>();

	/** Injected failures, keyed `<op>:<path>` — how compensation paths are driven red. */
	readonly failures = new Set<string>();
	failedOps: string[] = [];

	getAbstractFileByPath(path: string): TFile | null {
		if (!this.entries.has(path)) return null;
		const segments = path.split('/');
		return {
			path,
			name: segments.at(-1),
			basename: (segments.at(-1) ?? '').replace(/\.[^.]+$/, ''),
			extension: path.includes('.') ? path.split('.').at(-1) : '',
			stat: { mtime: 0, size: this.entries.get(path)?.length ?? 0 },
		} as unknown as TFile;
	}

	async create(path: string, data: string): Promise<TFile> {
		this.op('create', path);
		if (this.entries.has(path)) throw new Error(`File already exists: ${path}`);
		this.entries.set(path, data);
		return this.getAbstractFileByPath(path) as TFile;
	}

	async modify(file: TFile, data: string): Promise<void> {
		this.op('modify', file.path);
		if (!this.entries.has(file.path)) throw new Error(`No file to modify: ${file.path}`);
		this.entries.set(file.path, data);
	}

	async delete(file: TFile): Promise<void> {
		this.op('delete', file.path);
		if (!this.entries.has(file.path)) throw new Error(`No file to delete: ${file.path}`);
		this.entries.delete(file.path);
	}

	async createFolder(path: string): Promise<void> {
		this.op('createFolder', path);
		this.folders.add(path);
	}

	async read(file: TFile): Promise<string> {
		this.op('read', file.path);
		const data = this.entries.get(file.path);
		if (data === undefined) throw new Error(`No file to read: ${file.path}`);
		return data;
	}

	async cachedRead(file: TFile): Promise<string> {
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
		const key = line.slice(0, cut);
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

export class FakeFileManager {
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
}

export class FakeMetadataCache {
	constructor(private readonly vault: FakeVault) {}

	getFileCache(file: TFile): { frontmatter: Record<string, unknown> } | null {
		const text = this.vault.entries.get(file.path);
		if (text === undefined || !text.startsWith('---\n')) return null;
		return { frontmatter: parseFrontmatter(text).frontmatter };
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

	const migrations = new MigrationRunner();
	for (const migration of PROJECT_MIGRATIONS) migrations.register('project', migration);
	for (const migration of PLAN_MIGRATIONS) migrations.register('plan', migration);
	for (const migration of ZONE_MIGRATIONS) migrations.register('zone', migration);
	for (const migration of PLAN_GEOMETRY_MIGRATIONS) migrations.register('plan-geometry', migration);

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
	const store = new PlanGeometryStore(vault as never, index, migrations, echo);

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
