import { TFile, type MetadataCache, type TFile as TFileType, type Vault } from 'obsidian';
import type { Logger } from '../../../application/ports/Logger';
import type { ProjectIndex, ProjectIndexEntry } from '../../../application/ports/ProjectIndex';
import type { EchoWindow } from './EchoWindow';
import { observeFrontmatter } from '../../obsidian/repositories/digest';
import { GEOMETRY_FOLDER, normalizeFolder } from '../../obsidian/repositories/paths';

const OUR_NOTE_TYPES: readonly string[] = ['renovation-project', 'renovation-plan', 'renovation-zone'];

function stringField(value: unknown): string | undefined {
	return typeof value === 'string' && value ? value : undefined;
}

/**
 * The vault-change pipeline (SDD §46): Obsidian's create/modify/rename/delete events,
 * debounced per path, resolved ("is this file one of ours?"), validated against the
 * cached frontmatter, and applied to the Project Index incrementally.
 *
 * The repositories update the index synchronously on their own writes; this pipeline is
 * the SOLE path for everything else — hand edits, sync, another device. A `modify` whose
 * freshly computed digest still matches what this plugin last wrote is an ECHO of the
 * plugin's own write and is dropped (`EchoWindow`); anything else is real and updates
 * the index. A malformed note is excluded with a diagnostic rather than aborting the
 * rest of the scan — one broken file must not take down the vault's data.
 */
export class VaultChangeAdapter {
	private readonly pending = new Set<string>();
	private timer: number | null = null;

	constructor(
		private readonly deps: {
			vault: Vault;
			metadataCache: MetadataCache;
			index: ProjectIndex;
			echo: EchoWindow;
			logger: Logger;
			projectFolder: string;
			/** Tests flush synchronously by passing 0. */
			debounceMs?: number;
		},
	) {}

	/** The four handlers a plugin registers its vault events with. */
	onCreate(file: TFileType): void {
		this.enqueue(file.path);
	}

	onModify(file: TFileType): void {
		this.enqueue(file.path);
	}

	onDelete(file: TFileType): void {
		// Renames and deletes apply immediately, in order against pending writes.
		this.pending.delete(file.path);
		this.processPath(file.path);
	}

	onRename(file: TFileType, oldPath: string): void {
		// A rename moves an EXISTING entry regardless of content echoes — the bytes did
		// not change, so the digest still matches and a debounced re-add would drop the
		// entry entirely. Re-point it here, carry the echo token to the new path.
		const existing = this.findByPath(oldPath);
		if (existing) {
			this.deps.index.upsert({ ...existing, path: file.path });
			this.deps.echo.move(oldPath, file.path);
			this.pending.delete(oldPath);
			this.pending.delete(file.path);
			return;
		}
		this.pending.delete(oldPath);
		this.processPath(oldPath);
		this.enqueue(file.path);
	}

	flush(): void {
		if (this.timer !== null) {
			window.clearTimeout(this.timer);
			this.timer = null;
		}
		for (const path of Array.from(this.pending)) {
			this.pending.delete(path);
			this.processPath(path);
		}
	}

	private enqueue(path: string): void {
		// A zero debounce means "process synchronously" — what tests use, and what keeps
		// this module free of timer APIs when it runs outside a browser window.
		if ((this.deps.debounceMs ?? 500) <= 0) {
			this.processPath(path);
			return;
		}
		this.pending.add(path);
		if (this.timer === null) {
			this.timer = window.setTimeout(() => this.flush(), this.deps.debounceMs);
		}
	}

	private processPath(path: string): void {
		if (path.endsWith('.rpgeo')) {
			this.processSidecar(path);
			return;
		}
		const folder = normalizeFolder(this.deps.projectFolder);
		if (!path.startsWith(`${folder}/`)) return;

		const abstractFile = this.deps.vault.getAbstractFileByPath(path);
		const existing = this.findByPath(path);

		if (!(abstractFile instanceof TFile)) {
			// Deleted (or replaced by something that is not a note).
			if (existing) {
				this.deps.index.remove(existing.id);
				this.deps.echo.forget(path);
			}
			return;
		}
		this.processNote(abstractFile, existing);
	}

	private processNote(file: TFile, existing: ProjectIndexEntry | undefined): void {
		const path = file.path;
		const frontmatter: Record<string, unknown> | undefined = this.deps.metadataCache.getFileCache(file)?.frontmatter;
		const type: unknown = frontmatter?.['type'];

		if (!frontmatter || typeof type !== 'string' || !OUR_NOTE_TYPES.includes(type)) {
			// Not ours — but if it USED to be, it changed into something we cannot index.
			if (existing) {
				this.deps.index.remove(existing.id);
				this.deps.echo.forget(path);
			}
			return;
		}

		const id: unknown = frontmatter['id'];
		if (typeof id !== 'string' || !id) {
			this.deps.logger.warn('persistence.pipeline.note-excluded', {
				path,
				reason: 'a note of this plugin must declare a non-empty id',
			});
			if (existing) this.deps.index.remove(existing.id);
			return;
		}

		// Echo suppression: the digest of what sits on disk now vs. what this plugin last
		// wrote there. Equal means our own write echoed back through Obsidian's events.
		if (this.deps.echo.matches(path, observeFrontmatter(frontmatter))) return;

		this.deps.index.upsert({
			id: id as ProjectIndexEntry['id'],
			type: type as ProjectIndexEntry['type'],
			path,
			projectId: stringField(frontmatter['project']) as ProjectIndexEntry['projectId'],
			planId: stringField(frontmatter['plan']) as ProjectIndexEntry['planId'],
			// Preserve a sidecar mapping an out-of-band note edit cannot have moved —
			// the sidecar path lives only here and in the Plan repository's writers.
			geometrySidecarPath:
				type === 'renovation-plan'
					? (existing?.geometrySidecarPath ?? this.deps.index.getGeometrySidecarPath(id as never))
					: undefined,
		});
	}

	private processSidecar(path: string): void {
		const geometryPrefix = `${normalizeFolder(this.deps.projectFolder)}/${GEOMETRY_FOLDER}/`;
		if (!path.startsWith(geometryPrefix)) return;

		const planId = path.slice(geometryPrefix.length).replace(/\.rpgeo$/, '');
		const planEntry = this.findByPath(this.deps.index.getPath(planId as never) ?? '');
		if (!planEntry || planEntry.type !== 'renovation-plan') {
			this.deps.logger.warn('persistence.pipeline.sidecar-skipped', {
				path,
				reason: 'no indexed plan carries this id',
			});
			return;
		}

		// A sidecar appearing or changing never moves the note entry itself — only the
		// mapping this index exists to hold.
		this.deps.index.upsert({ ...planEntry, geometrySidecarPath: path });
	}

	private findByPath(path: string): ProjectIndexEntry | undefined {
		return this.deps.index.entries().find((entry) => entry.path === path);
	}
}
